import type { Config, Sample, Sensor } from './controller.ts';
interface Port { readable:ReadableStream<Uint8Array>|null; writable:WritableStream<Uint8Array>|null; open(o:{baudRate:number}):Promise<void>; close():Promise<void>; }
interface SerialAPI {requestPort():Promise<Port>}
type Reply = Record<string,unknown> & {ok:boolean; message?:string};
type Pending = {time:number; main:string; drain:string; version:number; resolve:()=>void; reject:(e:Error)=>void; timer:ReturnType<typeof setTimeout>};
export interface DeviceInfo { protocol:2; device_id:string; actuator_kind:'LED_EMULATOR'|'VALVE_DRIVER'; drain_available:boolean; flow_input:boolean }
export class HardwareSerial {
 private port:Port|null=null;
 private reader:ReadableStreamDefaultReader<Uint8Array>|null=null;
 private writer:WritableStreamDefaultWriter<Uint8Array>|null=null;
 private closing=false;
 private queue:Promise<void>=Promise.resolve();
 private pending=new Map<number,Pending>();
 private requests=new Map<number,{resolve:(p:Reply)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private sampleSeq=0;private commandSeq=0;private requestSeq=0;private negotiated=false;
 private lastConfig:Config|null=null;
 lastAck=0;lastSampleAt=0;applied='UNKNOWN';appliedDrain='UNKNOWN';device:DeviceInfo|null=null;localOverride=false;
 async connect(onSample:(s:Sample)=>void,onError:(error:string)=>void) {
  const serial=(navigator as Navigator & {serial?:SerialAPI}).serial;
  if(!serial)throw new Error('USB serial requires Chrome or Edge on localhost. Open the browser dashboard for hardware; the Tauri shell supports simulation/replay.');
  this.closing=false;this.negotiated=false;this.queue=Promise.resolve();this.commandSeq=0;this.sampleSeq=0;
  try{
   this.port=await serial.requestPort();await this.port.open({baudRate:115200});
   if(!this.port.readable||!this.port.writable)throw new Error('Serial port has no data streams');
   this.reader=this.port.readable.getReader();this.writer=this.port.writable.getWriter();
   this.lastAck=0;this.lastSampleAt=0;this.applied='UNKNOWN';this.appliedDrain='UNKNOWN';this.localOverride=false;
   void this.read(onSample,onError);
   // Opening USB can reset an ESP32; retry a bounded, closed-only handshake during boot.
   let hello:Reply|undefined;
   for(let attempt=0;attempt<4&&!this.closing;attempt++){
    try{hello=await this.request('hello',{},1800);break;}catch(e){if(attempt===3)throw e;}
   }
   if(!hello||hello.protocol!==2||typeof hello.device_id!=='string'||!['LED_EMULATOR','VALVE_DRIVER'].includes(String(hello.actuator_kind))||typeof hello.drain_available!=='boolean'||typeof hello.flow_input!=='boolean')throw new Error('Upload the integrated Okeanos protocol v2 firmware first');
   this.device=hello as unknown as DeviceInfo;this.negotiated=true;
  }catch(e){await this.disconnect();throw e;}
 }
 private failPending(error:Error){
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();
  for(const r of this.requests.values()){clearTimeout(r.timer);r.reject(error);}this.requests.clear();
 }
 private async read(onSample:(s:Sample)=>void,onError:(e:string)=>void){
  const decoder=new TextDecoder();let buffer='';
  try {
   while(this.reader&&!this.closing){
    const {value,done}=await this.reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    let index:number;
    while((index=buffer.indexOf('\n'))>=0){
     if(index>16384)throw new Error('Oversized serial frame');
     const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);if(!line)continue;
     // ESP32 ROM boot text is tolerated only before the protocol handshake succeeds.
     if(!this.negotiated&&!line.startsWith('{'))continue;
     const p=JSON.parse(line);
     if(!p||typeof p!=='object')throw new Error('Malformed serial packet');
     if(p.type==='response'){
      const r=this.requests.get(p.id);if(!r)continue; // A timed-out boot probe can reply late.
      if(typeof p.ok!=='boolean')throw new Error('Malformed device response');
      clearTimeout(r.timer);this.requests.delete(p.id);
      if(p.ok)r.resolve(p);else r.reject(new Error(p.message||'Device rejected request'));
      continue;
     }
     if(!this.negotiated)continue;
     if(p.type==='ack'){
      const expected=this.pending.get(p.seq);
      if(!expected||!['OPEN','CLOSED'].includes(p.main)||!['OPEN','CLOSED'].includes(p.drain))throw new Error('Invalid command acknowledgement');
      if(p.reason==='LOCAL_LED_TEST'){
       this.localOverride=true;this.lastAck=Date.now();this.applied=p.main;this.appliedDrain=p.drain;
       clearTimeout(expected.timer);this.pending.delete(p.seq);expected.resolve();continue;
      }
      if(p.ok!==true||p.main!==expected.main||p.drain!==expected.drain||p.config_version!==expected.version)throw new Error(`Device veto or command-state mismatch: ${p.reason||'configuration/state'}`);
      this.lastAck=Date.now();this.applied=p.main;this.appliedDrain=p.drain;
      clearTimeout(expected.timer);this.pending.delete(p.seq);expected.resolve();continue;
     }
     if(p.type!=='sample'||p.protocol!==2||!Number.isSafeInteger(p.seq)||p.seq<1||!['tds','ph','temp'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))||typeof p.valid!=='boolean'||typeof p.fresh!=='boolean'||typeof p.sensor_valid!=='boolean'||typeof p.calibrated!=='boolean'||typeof p.estimated!=='boolean'||!['OPEN','CLOSED'].includes(p.main)||!['OPEN','CLOSED'].includes(p.drain)||!['DASHBOARD','LOCAL_LED_TEST'].includes(p.control_mode)||p.actuator_kind!==this.device?.actuator_kind||!Number.isInteger(p.raw_tds)||p.raw_tds<0||p.raw_tds>4095||!Number.isInteger(p.raw_ph)||p.raw_ph<0||p.raw_ph>4095)throw new Error('Malformed sensor packet or device left dashboard mode');
     if(p.seq<=this.sampleSeq)throw new Error('Device restarted or sample sequence repeated; reconnect required');
     this.sampleSeq=p.seq;
     const override=p.control_mode==='LOCAL_LED_TEST';
     // Entering local control cancels outstanding commands rather than letting
     // them time out into a fault that would close (and reset) the device.
     if(override&&!this.localOverride)for(const [seq,item] of this.pending){clearTimeout(item.timer);this.pending.delete(seq);item.resolve();}
     this.localOverride=override;
     if(override){this.applied=p.main;this.appliedDrain=p.drain;this.lastAck=Date.now();}
     if(p.valid&&(!p.calibrated||!p.sensor_valid))throw new Error('Inconsistent sensor validity');
     if(p.fresh&&p.actuator_kind==='VALVE_DRIVER'&&(p.freshness_basis!=='flow_switch'||p.physical_flow_verified!==true))throw new Error('Real valve requires independent chamber freshness');
     this.lastSampleAt=Date.now();onSample(p as Sample);
    }
    if(buffer.length>16384)throw new Error('Oversized serial frame');
   }
   if(!this.closing)throw new Error('Serial device disconnected');
  }catch(e){
   const error=new Error(`Serial fault: ${String(e)}`);this.failPending(error);
   if(!this.closing)onError(error.message);
  }
 }
 private write(packet:unknown){
  const writer=this.writer;if(!writer)return Promise.reject(new Error('Serial is disconnected'));
  const bytes=new TextEncoder().encode(JSON.stringify(packet)+'\n');
  this.queue=this.queue.then(()=>writer.write(bytes));return this.queue;
 }
 private request(type:string,body:Record<string,unknown>,timeout=2500):Promise<Reply>{
  const id=++this.requestSeq;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.requests.delete(id);reject(new Error(`${type}: device response timeout`));},timeout);
   this.requests.set(id,{resolve,reject,timer});
   void this.write({...body,type,id}).catch(e=>{clearTimeout(timer);this.requests.delete(id);reject(e);});
  });
 }
 calibrate(sensor:Sensor,reference:number,sampleSeq:number){return this.request('calibrate',{sensor,reference,sample_seq:sampleSeq,epoch:Math.floor(Date.now()/1000)});}
 command(main:'OPEN'|'CLOSED',drain:'OPEN'|'CLOSED',config:Config):Promise<void> {
  if(!this.negotiated||this.closing)return Promise.reject(new Error('Serial is not ready'));
  if(this.localOverride)return Promise.reject(new Error('Local keypad override is active on the device; press 0 on the keypad to return control to the dashboard'));
  if(main==='OPEN'&&drain==='OPEN')return Promise.reject(new Error('Main and drain are mutually exclusive'));
  this.lastConfig=structuredClone(config);
  const seq=++this.commandSeq;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(seq);reject(new Error('Command acknowledgement timeout'));},2500);
   this.pending.set(seq,{time:Date.now(),main,drain,version:config.version,resolve,reject,timer});
   void this.write({type:'command',seq,main,drain,ttl_ms:2500,limits:config.limits,has_drain:config.hasDrain,config_version:config.version}).catch(e=>{clearTimeout(timer);this.pending.delete(seq);reject(e);});
  });
 }
 expiredCommand(now=Date.now()){return [...this.pending.values()].some(item=>now-item.time>2500);}
 async disconnect(){
  if(this.closing)return;
  this.closing=true;this.failPending(new Error('Serial disconnected'));
  // Send closure even if the read stream has failed; never wait for an ACK on a dead link.
  try {if(this.writer&&this.lastConfig){const c=this.lastConfig;await this.write({type:'command',seq:++this.commandSeq,main:'CLOSED',drain:'CLOSED',ttl_ms:2500,limits:c.limits,has_drain:c.hasDrain,config_version:c.version});}}catch{/* Local TTL remains the fallback. */}
  try {await this.reader?.cancel();}catch{/* Device unplugged. */}
  this.reader?.releaseLock();this.reader=null;
  try {await this.queue;}catch{/* Failed write. */}
  this.writer?.releaseLock();this.writer=null;
  try {await this.port?.close();}catch{/* Already closed. */}
  this.port=null;this.negotiated=false;
 }
}
