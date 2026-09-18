import type { Sample } from './controller.ts';
// Narrow Web Serial surface keeps browser support optional and avoids Node serial dependencies.
interface Port { readable:ReadableStream<Uint8Array>|null; writable:WritableStream<Uint8Array>|null; open(o:{baudRate:number}):Promise<void>; close():Promise<void>; }
interface SerialAPI {requestPort():Promise<Port>}
export class HardwareSerial {
 private port:Port|null=null;
 private reader:ReadableStreamDefaultReader<Uint8Array>|null=null;
 private writer:WritableStreamDefaultWriter<Uint8Array>|null=null;
 private closing=false;
 private queue:Promise<void>=Promise.resolve();
 private pending=new Map<number,{time:number;main:string;drain:string}>();
 private commandSeq=0;
 lastAck=0;lastSampleAt=0;applied='UNKNOWN';
 async connect(onSample:(s:Sample)=>void,onError:(error:string)=>void) {
  const serial=(navigator as Navigator & {serial?:SerialAPI}).serial;
  if(!serial)throw new Error('USB serial requires Chrome or Edge on localhost. Use the browser app for hardware; Safari and the Tauri shell do not expose Web Serial.');
  this.port=await serial.requestPort();await this.port.open({baudRate:115200});
  if(!this.port.readable||!this.port.writable)throw new Error('Serial port has no data streams');
  this.reader=this.port.readable.getReader();this.writer=this.port.writable.getWriter();this.closing=false;
  this.lastAck=0;this.lastSampleAt=0;this.pending.clear();
  void this.read(onSample,onError);
 }
 private async read(onSample:(s:Sample)=>void,onError:(e:string)=>void){
  const decoder=new TextDecoder();let buffer='';
  try {
   while(this.reader&&!this.closing){
    const {value,done}=await this.reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    if(buffer.length>16384)throw new Error('Oversized serial frame');
    let index:number;
    while((index=buffer.indexOf('\n'))>=0){
     const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);if(!line)continue;
     const p=JSON.parse(line);
     if(p.type==='ack'){
      if(!this.pending.has(p.seq)||!['OPEN','CLOSED'].includes(p.main)||!['OPEN','CLOSED'].includes(p.drain))throw new Error('Invalid command acknowledgement');
      const expected=this.pending.get(p.seq)!;
      if(p.main!==expected.main||p.drain!==expected.drain)throw new Error('Device veto or command-state mismatch');
      this.lastAck=Date.now();this.applied=p.main;this.pending.delete(p.seq);continue;
     }
     if(p.type!=='sample'||!Number.isSafeInteger(p.seq)||!['tds','ph','temp'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))||typeof p.valid!=='boolean'||typeof p.fresh!=='boolean'||(p.estimated!==undefined&&typeof p.estimated!=='boolean'))throw new Error('Malformed sensor packet');
     this.lastSampleAt=Date.now();onSample(p as Sample);
    }
   }
   if(!this.closing)onError('Serial device disconnected');
  }catch(e){if(!this.closing)onError(`Serial fault: ${String(e)}`);}
 }
 async command(main:'OPEN'|'CLOSED',drain:'OPEN'|'CLOSED') {
  const writer=this.writer;if(!writer)throw new Error('Serial is disconnected');
  const seq=++this.commandSeq;
  const line=JSON.stringify({type:'command',seq,main,drain,ttl_ms:2500})+'\n';
  this.pending.set(seq,{time:Date.now(),main,drain});
  for(const [id,item] of this.pending)if(Date.now()-item.time>10000)this.pending.delete(id);
  this.queue=this.queue.then(()=>writer.write(new TextEncoder().encode(line)));
  return this.queue;
 }
 expiredCommand(now=Date.now()){return [...this.pending.values()].some(item=>now-item.time>3000);}
 async disconnect(){
  this.closing=true;
  try {await this.command('CLOSED','CLOSED');} catch { /* Firmware watchdog is the independent fallback. */ }
  try {await this.reader?.cancel();}catch { /* Disconnected port. */ }
  this.reader?.releaseLock();this.reader=null;
  try {await this.queue;}catch { /* Failed write. */ }
  this.writer?.releaseLock();this.writer=null;
  try {await this.port?.close();}catch { /* Already closed. */ }
  this.port=null;
 }
}
