import test from 'node:test';
import assert from 'node:assert/strict';
import {HardwareSerial} from '../src/services/serial.ts';
import {DEFAULT_CONFIG} from '../src/services/controller.ts';
const settle=()=>new Promise(r=>setTimeout(r,15));
export function portMock(){
 let stream;const sent=[];let ack=true;let veto=false;
 const push=s=>stream.enqueue(new TextEncoder().encode(s));
 const packet=p=>push(JSON.stringify(p)+'\n');
 const port={readable:new ReadableStream({start(c){stream=c;}}),writable:new WritableStream({write(bytes){const c=JSON.parse(new TextDecoder().decode(bytes));sent.push(c);
  if(c.type==='hello')packet({type:'response',id:c.id,ok:true,protocol:2,device_id:'test-device',actuator_kind:'LED_EMULATOR',drain_available:true,flow_input:false});
  else if(c.type==='calibrate')packet({type:'response',id:c.id,ok:true,message:'Point 1 captured'});
  else if(ack)packet({type:'ack',seq:c.seq,main:veto?'CLOSED':c.main,drain:c.drain,config_version:c.config_version,ok:!veto,reason:veto?'LOCAL_LIMIT':''});
 }}),async open(){push('rst:0x1 ESP32 boot\n');},async close(){}};
 Object.defineProperty(globalThis.navigator,'serial',{value:{async requestPort(){return port;}},configurable:true});
 return {sent,push,packet,setAck:v=>ack=v,setVeto:v=>veto=v};
}
const sample={type:'sample',protocol:2,seq:1,tds:360,ph:7.35,temp:26,valid:true,sensor_valid:true,calibrated:true,fresh:false,estimated:false,raw_tds:2400,raw_ph:3675,main:'CLOSED',drain:'CLOSED',control_mode:'DASHBOARD',actuator_kind:'LED_EMULATOR'};
test('negotiates v2, ignores boot text, assembles fragmented samples, acknowledges exact configuration',async()=>{
 const mock=portMock(),samples=[],errors=[],p=new HardwareSerial();await p.connect(s=>samples.push(s),e=>errors.push(e));
 const data=JSON.stringify(sample)+'\n';mock.push(data.slice(0,40));mock.push(data.slice(40));await settle();
 assert.equal(samples.length,1);assert.equal(samples[0].raw_tds,2400);assert.equal(p.device.device_id,'test-device');
 await p.command('CLOSED','CLOSED',DEFAULT_CONFIG);assert.ok(p.lastAck>0);assert.equal(errors.length,0);
 assert.deepEqual(mock.sent.at(-1).limits,DEFAULT_CONFIG.limits);await p.disconnect();assert.equal(mock.sent.at(-1).main,'CLOSED');
});
test('malformed packets raise faults rather than default readings',async()=>{
 const mock=portMock(),errors=[],p=new HardwareSerial();await p.connect(()=>assert.fail(),e=>errors.push(e));mock.packet({...sample,tds:'360'});await settle();assert.match(errors[0],/Malformed/);await p.disconnect();
});
test('device veto rejects the awaiting action and never reports successful actuation',async()=>{
 const mock=portMock(),errors=[],p=new HardwareSerial();await p.connect(()=>{},e=>errors.push(e));mock.setVeto(true);
 await assert.rejects(p.command('OPEN','CLOSED',DEFAULT_CONFIG),/veto/);assert.match(errors[0],/veto/);assert.equal(p.applied,'UNKNOWN');await p.disconnect();
});
test('pending command expires even when newer telemetry arrives',async()=>{
 const mock=portMock(),p=new HardwareSerial();await p.connect(()=>{},()=>{});mock.setAck(false);
 const pending=p.command('CLOSED','CLOSED',DEFAULT_CONFIG);const rejected=assert.rejects(pending,/disconnected/);
 assert.ok(p.expiredCommand(Date.now()+3100));await p.disconnect();await rejected;
});
test('calibration waits for correlated firmware response',async()=>{
 const mock=portMock(),p=new HardwareSerial();await p.connect(()=>{},()=>{});
 const result=await p.calibrate('ph',7,5);assert.equal(result.message,'Point 1 captured');assert.equal(mock.sent.at(-1).sample_seq,5);await p.disconnect();
});
test('local keypad override suspends host control without faulting the link',async()=>{
 const mock=portMock(),samples=[],errors=[],p=new HardwareSerial();
 await p.connect(s=>samples.push(s),e=>errors.push(e));
 mock.packet({...sample,control_mode:'LOCAL_LED_TEST',local_override:true,main:'OPEN'});await settle();
 assert.deepEqual(errors,[]);                       // The link stays up: no disconnect, so no ESP32 reset.
 assert.equal(samples.length,1);                    // Telemetry keeps flowing while the operator holds the keypad.
 assert.equal(p.localOverride,true);
 assert.equal(p.applied,'OPEN');                    // Reported LED state tracks the keypad.
 await assert.rejects(p.command('CLOSED','CLOSED',DEFAULT_CONFIG),/Local keypad override/);
 mock.packet({...sample,seq:sample.seq+1,control_mode:'DASHBOARD'});await settle();
 assert.equal(p.localOverride,false);               // Pressing 0 again hands control back.
 assert.deepEqual(errors,[]);
 await p.disconnect();
});
test('a command refused with LOCAL_LED_TEST resolves instead of faulting',async()=>{
 const mock=portMock(),errors=[],p=new HardwareSerial();await p.connect(()=>{},e=>errors.push(e));
 mock.setAck(false);
 const inflight=p.command('CLOSED','CLOSED',DEFAULT_CONFIG);
 await settle();
 const seq=mock.sent.at(-1).seq;
 mock.packet({type:'ack',seq,main:'CLOSED',drain:'CLOSED',ok:false,reason:'LOCAL_LED_TEST',config_version:DEFAULT_CONFIG.version});
 await inflight;                                    // Resolves: a refusal under local control is not a link fault.
 assert.equal(p.localOverride,true);assert.deepEqual(errors,[]);
 await p.disconnect();
});
test('uncalibrated readings remain visible but cannot advertise valid data',async()=>{
 const mock=portMock(),samples=[],errors=[],p=new HardwareSerial();await p.connect(s=>samples.push(s),e=>errors.push(e));
 mock.packet({...sample,calibrated:false,valid:false});await settle();assert.equal(samples.length,1);
 mock.packet({...sample,seq:2,calibrated:false,valid:true});await settle();assert.match(errors[0],/Inconsistent/);await p.disconnect();
});
