import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {TelemetryProvider,useTelemetry} from '../src/context/TelemetryContext';
import {UncertaintyCalibration} from '../src/components/workspaces/UncertaintyCalibration';
import {RecoveryFSM} from '../src/components/workspaces/RecoveryFSM';
import {AuditTrailConfig} from '../src/components/workspaces/AuditTrailConfig';

test('React dashboard uses device ACKs for hardware recovery, purge, calibration, configuration and closure', async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 let clock=1800000000000;const originalNow=Date.now;Date.now=()=>clock;
 let stream:any;const commands:any[]=[];
 const push=(p:unknown)=>stream.enqueue(new TextEncoder().encode(JSON.stringify(p)+'\n'));
 const port={readable:new ReadableStream({start(c){stream=c;}}),writable:new WritableStream({write(bytes){const c=JSON.parse(new TextDecoder().decode(bytes));commands.push(c);
  push(c.type==='hello'?{type:'response',id:c.id,ok:true,protocol:2,device_id:'react-board',actuator_kind:'LED_EMULATOR',drain_available:true,flow_input:false}:c.type==='calibrate'?{type:'response',id:c.id,ok:true,message:'Point 1 captured'}:{type:'ack',seq:c.seq,main:c.main,drain:c.drain,config_version:c.config_version,ok:true});
 }}),async open(){},async close(){}};
 Object.defineProperty(globalThis.navigator,'serial',{configurable:true,value:{async requestPort(){return port;}}});
 let ctx:ReturnType<typeof useTelemetry>;
 const Probe=()=>{ctx=useTelemetry();return <><RecoveryFSM/><UncertaintyCalibration/><AuditTrailConfig/></>;};
 const root=createRoot(document.getElementById('root')!);
 const flush=()=>new Promise<void>(r=>setImmediate(r));
 try{
  await act(async()=>{root.render(<TelemetryProvider><Probe/></TelemetryProvider>);});
  await act(async()=>{await ctx.connectHardware();});
  assert.equal(ctx!.mode,'HARDWARE');assert.equal(commands.at(-1).main,'CLOSED');
  const feed=async(n:number)=>{clock+=1000;await act(async()=>{push({type:'sample',protocol:2,seq:n,tds:360+Math.sin(n),ph:7.35+0.005*Math.sin(n),temp:26,valid:true,sensor_valid:true,calibrated:true,fresh:true,estimated:false,raw_tds:2400+n%4,raw_ph:3675+n%3,main:commands.at(-1)?.main||'CLOSED',drain:commands.at(-1)?.drain||'CLOSED',control_mode:'DASHBOARD',actuator_kind:'LED_EMULATOR',freshness_basis:'operator_led_test'});await flush();});};
  for(let i=1;i<=40;i++)await feed(i);
  assert.equal(ctx!.frame.valve_actuator.main_solenoid_state,'OPEN');
  await act(async()=>{await ctx.saveConfig({...ctx.config,hasDrain:true});});
  assert.equal(commands.at(-1).has_drain,true);
  await act(async()=>{await ctx.triggerPurge(15);});assert.equal(commands.at(-1).drain,'OPEN');
  await act(async()=>{await ctx.overrideValve('FORCE_CLOSE');});await feed(41);assert.equal(commands.at(-1).drain,'CLOSED');
  await assert.rejects(ctx!.triggerPurge(15),/latch/);
  await act(async()=>{assert.equal(await ctx.calibrateSensor('ph',7),'Point 1 captured');});
  assert.ok(commands.some(c=>c.type==='calibrate'&&c.sample_seq===41));
  await act(async()=>{await ctx.setSourceProfile('UNKNOWN');});await feed(42);assert.equal(commands.at(-1).main,'CLOSED');
  await act(async()=>{await ctx.setSourceProfile('MUNICIPAL');await ctx.overrideValve('AUTO');});
  for(let i=43;i<=85;i++)await feed(i);
  assert.equal(commands.at(-1).main,'OPEN');
  const record=JSON.parse(ctx!.exportFlightRecorder('json'));assert.equal(record.synthetic,false);assert.ok(record.events.some(e=>e.kind==='action'&&e.action.type==='device_calibration'));
  assert.ok(document.body.textContent?.includes('ESP32 probe calibration'));
  assert.ok(commands.every(c=>!(c.main==='OPEN'&&c.drain==='OPEN')));
  await act(async()=>{await ctx.disconnectHardware();});assert.equal(commands.at(-1).main,'CLOSED');assert.equal(ctx!.connected,false);
  assert.ok(localStorage.getItem('okeanos-hardware-v2-react-board'));
 }finally{await act(async()=>root.unmount());Date.now=originalNow;dom.window.close();}
});
