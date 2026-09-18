import test from 'node:test';
import assert from 'node:assert/strict';
import {HardwareSerial} from '../src/services/serial.ts';
const settle=()=>new Promise(r=>setTimeout(r,15));
function portMock(){
 let push;const sent=[];
 const port={readable:new ReadableStream({start(c){push=c;}}),writable:new WritableStream({write(bytes){sent.push(JSON.parse(new TextDecoder().decode(bytes)));}}),async open(){},async close(){}};
 Object.defineProperty(globalThis.navigator,'serial',{value:{async requestPort(){return port;}},configurable:true});
 return {sent,push:s=>push.enqueue(new TextEncoder().encode(s))};
}
test('USB stream assembles fragmented packets and acknowledges sequenced commands',async()=>{
 const mock=portMock(),samples=[],errors=[],p=new HardwareSerial();await p.connect(s=>samples.push(s),e=>errors.push(e));
 mock.push('{"type":"sample","seq":1,"tds":360,');mock.push('"ph":7.35,"temp":26,"valid":true,"fresh":false}\n');await settle();
 assert.equal(samples.length,1);assert.equal(samples[0].fresh,false);
 await p.command('CLOSED','CLOSED');const seq=mock.sent[0].seq;
 mock.push(JSON.stringify({type:'ack',seq,main:'CLOSED',drain:'CLOSED'})+'\n');await settle();assert.ok(p.lastAck>0);assert.equal(errors.length,0);
 await p.disconnect();assert.equal(mock.sent.at(-1).main,'CLOSED');
});
test('malformed serial input raises a fault instead of supplying default readings',async()=>{
 const mock=portMock(),errors=[],p=new HardwareSerial();await p.connect(()=>assert.fail('must not pass bad packet'),e=>errors.push(e));mock.push('{"type":"sample","seq":1,"tds":"360"}\n');await settle();assert.match(errors[0],/Malformed/);await p.disconnect();
});
test('device veto is detected and never reported as successful actuation',async()=>{
 const mock=portMock(),errors=[],p=new HardwareSerial();await p.connect(()=>{},e=>errors.push(e));await p.command('OPEN','CLOSED');mock.push(JSON.stringify({type:'ack',seq:mock.sent[0].seq,main:'CLOSED',drain:'CLOSED'})+'\n');await settle();assert.match(errors[0],/veto/);assert.equal(p.applied,'UNKNOWN');await p.disconnect();
});
test('unacknowledged command timeout remains visible despite newer traffic',async()=>{
 const mock=portMock(),p=new HardwareSerial();await p.connect(()=>{},()=>{});await p.command('CLOSED','CLOSED');assert.ok(p.expiredCommand(Date.now()+3100));await p.disconnect();assert.ok(mock.sent.length>=2);
});
