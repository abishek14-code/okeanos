import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ChallengeRunState, LogEntry, SystemFlightRecorderFrame } from '../types/telemetry';
import { GateController, parseRecording } from '../services/controller';
import type { Action, Config, Recording, Sensor } from '../services/controller';
import { LegacyController, SCENARIOS, syntheticSample } from '../services/scenarios';
import { calculateInstantaneousStress } from '../services/engineMath';
import { HardwareSerial } from '../services/serial';
type Mode='SIMULATION'|'HARDWARE'|'REPLAY';
const emptyChallenge=():ChallengeRunState=>({active_scenario_id:null,is_running:false,step_progress:0,speed_multiplier:1,legacy_valve_open:false,legacy_chatter_cycles:0,legacy_admitted_stress:0,legacy_baseline_contaminated:false,okeanos_valve_open:false,okeanos_chatter_cycles:0,okeanos_admitted_stress:0,okeanos_baseline_contaminated:false,history:[]});
interface Context {
 frame:SystemFlightRecorderFrame; logs:LogEntry[]; challengeRun:ChallengeRunState;
 mode:Mode; connected:boolean; connection:string; config:Config; diagnostics:GateController['diagnostics'];
 oscilloscopeHistory:{time:string;tds:number;tdsUpper:number;tdsLower:number;ph:number;temp:number;phUpper:number;phLower:number;tempUpper:number;tempLower:number}[];
 overrideValve:(mode:'FORCE_OPEN'|'FORCE_CLOSE'|'AUTO',pin?:string)=>Promise<string>;
 resolveQuarantine:(action:'DISCARD'|'ADMIT_TO_BASELINE'|'RESET_CUSUM')=>Promise<string>;
 triggerPurge:(durationSecs?:number)=>Promise<string>;
 setSourceProfile:(profile:'MUNICIPAL'|'BOREWELL'|'RAINWATER'|'UNKNOWN')=>Promise<string>;
 startChallenge:(id:string,intensity?:number)=>void;stopChallenge:()=>void;resetToLive:()=>void;
 calibrateSensor:(sensor:Sensor,reference:number)=>Promise<string>;
 exportFlightRecorder:(format:'json'|'csv')=>string;
 saveConfig:(config:Config)=>Promise<string>;connectHardware:()=>Promise<void>;disconnectHardware:()=>Promise<void>;
 loadReplay:(text:string)=>void;
}
const TelemetryContext=createContext<Context|undefined>(undefined);
export const TelemetryProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const engine=useRef(new GateController());
 const [frame,setFrame]=useState(()=>engine.current.frame);
 const [logs,setLogs]=useState<LogEntry[]>([]);
 const [mode,setMode]=useState<Mode>('SIMULATION');const modeRef=useRef<Mode>('SIMULATION');
 const [connection,setConnection]=useState('Synthetic 1 Hz input • hardware disconnected');
 const [challengeRun,setChallengeRun]=useState(emptyChallenge);
 const challenge=useRef(emptyChallenge());const legacy=useRef(new LegacyController());
 const [oscilloscopeHistory,setHistory]=useState<Context['oscilloscopeHistory']>([]);
 const serial=useRef<HardwareSerial|null>(null);const serialStarted=useRef(0);const sampleCount=useRef(0);
 const deviceKey=useRef('');const latestSeq=useRef(0);const calibrating=useRef(false);const actionBusy=useRef(false);
 const localOverride=useRef(false);const scenarioIntensity=useRef(100);const replay=useRef<{data:Recording;index:number}|null>(null);
 const publish=()=>{setFrame(structuredClone(engine.current.frame));setLogs([...engine.current.logs]);};
 const trace=(f:SystemFlightRecorderFrame)=>setHistory(h=>[...h,{time:new Date(f.timestamp*1000).toISOString().slice(11,19),tds:f.telemetry.tds.value,tdsUpper:f.telemetry.tds.value+f.telemetry.tds.uncertainty,tdsLower:f.telemetry.tds.value-f.telemetry.tds.uncertainty,ph:f.telemetry.ph.value,temp:f.telemetry.temp.value,phUpper:f.telemetry.ph.value+f.telemetry.ph.uncertainty,phLower:f.telemetry.ph.value-f.telemetry.ph.uncertainty,tempUpper:f.telemetry.temp.value+f.telemetry.temp.uncertainty,tempLower:f.telemetry.temp.value-f.telemetry.temp.uncertainty}].slice(-60));
 const setOperatingMode=(m:Mode)=>{modeRef.current=m;setMode(m);};
 const saveCheckpoint=()=>{
  if(modeRef.current!=='HARDWARE')return;
  try{localStorage.setItem(deviceKey.current,JSON.stringify(engine.current.checkpoint()));}catch{setConnection('Hardware active; checkpoint storage unavailable. Restart will remain closed.');}
 };
 const fault=(message:string)=>{
  engine.current.action({type:'override',mode:'FORCE_CLOSE'},Date.now()/1000);saveCheckpoint();
  engine.current.stale(Date.now()/1000);publish();setConnection(message+' • closure latched; reconnect after fixing');
  const port=serial.current;serial.current=null;void port?.disconnect();
 };
 const send=async()=>{
  const port=serial.current;if(modeRef.current!=='HARDWARE'||!port)return;
  if(port.localOverride)return; // Keypad holds the outputs; the host stays quiet.
  const v=engine.current.frame.valve_actuator;
  try{await port.command(calibrating.current?'CLOSED':v.main_solenoid_state,calibrating.current?'CLOSED':v.drain_flush_state,engine.current.config);}
  catch(e){if(serial.current===port)fault(String(e));throw e;}
 };
 const apply=async(a:Action)=>{
  if(modeRef.current==='REPLAY')throw new Error('Stop replay before changing controller settings');
  if(modeRef.current==='HARDWARE'&&!serial.current)throw new Error('Connect hardware before changing hardware controls');
  if(modeRef.current==='HARDWARE'&&serial.current?.localOverride)throw new Error('Local keypad override is active on the device; press 0 on the keypad to return control to the dashboard');
  const urgent=a.type==='override'&&a.mode==='FORCE_CLOSE';
  if((actionBusy.current||calibrating.current)&&!urgent)throw new Error('Wait for the current device operation');
  if(!urgent)actionBusy.current=true;
  try{
   if(a.type==='config'&&a.config.hasDrain&&modeRef.current==='HARDWARE'&&!serial.current?.device?.drain_available)throw new Error('Drain output is not commissioned in firmware');
   const message=engine.current.action(a,modeRef.current==='HARDWARE'?Date.now()/1000:sampleCount.current);
   publish();await send();saveCheckpoint();return message;
  }finally{if(!urgent)actionBusy.current=false;}
 };
 useEffect(()=>{
  const tick=setInterval(()=>{
   if(modeRef.current==='HARDWARE')return;
   if(modeRef.current==='REPLAY'){
    const r=replay.current;if(!r)return;
    try {
     while(r.index<r.data.events.length){
      const event=r.data.events[r.index++];
      if(event.kind==='action')engine.current.action(event.action,event.now);
      else {trace(engine.current.step(event.sample,event.now));break;}
     }
     publish();setConnection(`Replay ${r.index}/${r.data.events.length} • outputs disconnected${r.index===r.data.events.length?' • complete':''}`);
    }catch(e){replay.current=null;setConnection(`Replay stopped: ${String(e)}`);}
    return;
   }
   const run=challenge.current;
   if(run.active_scenario_id&&!run.is_running)return;
   sampleCount.current++;
   const n=run.is_running?run.step_progress:sampleCount.current;
   if(run.active_scenario_id==='blocked_restart'&&n===55)engine.current.action({type:'restart'},sampleCount.current);
   const sample=syntheticSample(n,run.is_running?run.active_scenario_id:null,scenarioIntensity.current);
   const f=engine.current.step(sample,sampleCount.current);publish();trace(f);
   if(run.is_running){
    legacy.current.step(sample,calculateInstantaneousStress);
    const l=legacy.current;
    const duration=SCENARIOS.find(s=>s.id===run.active_scenario_id)!.duration;
    challenge.current={...run,step_progress:n+1,is_running:n+1<duration,
     legacy_valve_open:l.open,legacy_chatter_cycles:l.cycles,legacy_admitted_stress:l.exposure,legacy_baseline_contaminated:Math.abs(l.baseline-360)>25,
     okeanos_valve_open:f.valve_actuator.main_solenoid_state==='OPEN',okeanos_chatter_cycles:f.valve_actuator.total_cycles_logged,
     okeanos_admitted_stress:f.exposure_accounting.admitted_exposure_cmsi,okeanos_baseline_contaminated:Math.abs(f.quarantine_engine.baseline_mean-360)>25,
     history:[...run.history,{time_sec:n,injected_val:sample.tds,legacy_valve:l.open?1:0,okeanos_valve:f.valve_actuator.main_solenoid_state==='OPEN'?1:0}]};
    setChallengeRun(challenge.current);
   }
  },1000);
  const watchdog=setInterval(()=>{
   if(modeRef.current!=='HARDWARE'||!serial.current)return;
   const p=serial.current,now=Date.now();
   if(now-(p.lastSampleAt||serialStarted.current)>3000){fault('Telemetry timeout');return;}
   if(p.localOverride)return; // No commands are outstanding under local control.
   if(p.expiredCommand(now)||now-(p.lastAck||serialStarted.current)>3000)fault('Telemetry or command acknowledgement timeout');
  },250);
  return()=>{clearInterval(tick);clearInterval(watchdog);void serial.current?.disconnect();};
 },[]);
 const resetToLive=()=>{
  if(serial.current){setConnection('Disconnect hardware before starting simulation');return;}
  engine.current=new GateController();sampleCount.current=0;challenge.current=emptyChallenge();setChallengeRun(challenge.current);
  legacy.current=new LegacyController();replay.current=null;setHistory([]);setOperatingMode('SIMULATION');setConnection('Synthetic 1 Hz input • hardware disconnected');publish();
 };
 const startChallenge=(id:string,intensity=100)=>{
  if(modeRef.current==='HARDWARE'){setConnection('Disconnect hardware before challenge injection');return;}
  if(!SCENARIOS.some(s=>s.id===id))throw new Error('Unknown scenario');
  resetToLive();scenarioIntensity.current=intensity;challenge.current={...emptyChallenge(),is_running:true,active_scenario_id:id};setChallengeRun(challenge.current);
 };
 const connectHardware=async()=>{
  if(serial.current)throw new Error('Already connected');
  const p=new HardwareSerial();
  try {
   // New hardware session starts closed, with a separately retained hardware baseline.
   let candidate=new GateController();candidate.config.hasDrain=false;
   await p.connect(sample=>{
    if(modeRef.current!=='HARDWARE'||serial.current!==p)return;
    latestSeq.current=sample.seq;
    const override=sample.control_mode==='LOCAL_LED_TEST';
    // Returning from local control re-arms the firmware's closed-only handshake.
    if(!override&&localOverride.current)engine.current.action({type:'override',mode:'FORCE_CLOSE'},Date.now()/1000);
    localOverride.current=override;
    const f=engine.current.step(sample,Date.now()/1000);publish();trace(f);void send().catch(()=>{});
    setConnection(override
     ?`USB ${p.device?.device_id} • LOCAL KEYPAD OVERRIDE • main ${sample.main}, drain ${sample.drain} • dashboard commands suspended • press 0 on the keypad to return control`
     :`USB ${p.device?.device_id} • ${sample.actuator_kind} • main ${sample.main}, drain ${sample.drain} • ${sample.calibrated?'calibrated':'CALIBRATION REQUIRED'} • ${sample.freshness_basis}${sample.fresh?'':' (LED bench: press #; real valve: flow input required)'}${sample.nvs_ok===false?' • NVS fault':''}${sample.log_ok===false?' • local log unavailable':''} • physical position unverified`);
    if(++sampleCount.current%10===0)saveCheckpoint();
   },message=>{if(serial.current===p)fault(message);});
   deviceKey.current=`okeanos-hardware-v2-${p.device!.device_id}`;
   try{const saved=localStorage.getItem(deviceKey.current);if(saved)candidate.restore(JSON.parse(saved));}catch{candidate=new GateController();candidate.config.hasDrain=false;}
   if(!p.device!.drain_available)candidate.config.hasDrain=false;
   engine.current=candidate;serial.current=p;serialStarted.current=Date.now();sampleCount.current=0;
   challenge.current=emptyChallenge();setChallengeRun(challenge.current);setHistory([]);replay.current=null;
   setOperatingMode('HARDWARE');setConnection('USB serial connected • commands are not physical valve-position feedback');publish();await send();
  }catch(e){if(serial.current===p){serial.current=null;engine.current.action({type:'override',mode:'FORCE_CLOSE'},Date.now()/1000);publish();}await p.disconnect();setConnection(String(e));throw e;}
 };
 const disconnectHardware=async()=>{
  engine.current.action({type:'override',mode:'FORCE_CLOSE'},Date.now()/1000);saveCheckpoint();
  const p=serial.current;serial.current=null;await p?.disconnect();publish();setConnection('Hardware disconnected • controller closed. Select Reset to simulation to resume.');
 };
 const loadReplay=(text:string)=>{
  if(modeRef.current==='HARDWARE')throw new Error('Disconnect hardware before replay');
  const data=parseRecording(text);engine.current=new GateController();if(data.initial)engine.current.restore(data.initial);sampleCount.current=0;
  challenge.current=emptyChallenge();setChallengeRun(challenge.current);setHistory([]);
  replay.current={data,index:0};setOperatingMode('REPLAY');publish();setConnection('Recorded samples at one sample per second • outputs disconnected');
 };
 const exportFlightRecorder=(format:'json'|'csv')=>{
  if(format==='json')return JSON.stringify(engine.current.export(modeRef.current!=='HARDWARE'),null,2);
  return 'timestamp,seq,tds,ph,temp,valid,fresh\n'+engine.current.records.filter(e=>e.kind==='sample').map(e=>e.kind==='sample'?[e.now,e.sample.seq,e.sample.tds,e.sample.ph,e.sample.temp,e.sample.valid,e.sample.fresh].join(','):'').join('\n');
 };
 return <TelemetryContext.Provider value={{frame,logs,mode,connected:serial.current!==null,connection,config:engine.current.config,diagnostics:engine.current.diagnostics,challengeRun,oscilloscopeHistory,
  overrideValve:async(mode)=>apply({type:'override',mode}),resolveQuarantine:async(action)=>apply({type:'quarantine',action}),
  triggerPurge:async(seconds=15)=>apply({type:'purge',seconds}),setSourceProfile:async(profile)=>apply({type:'profile',profile}),
  startChallenge,stopChallenge:()=>{challenge.current={...challenge.current,is_running:false};setChallengeRun(challenge.current);},resetToLive,
  calibrateSensor:async(sensor,reference)=>{
   if(modeRef.current!=='HARDWARE')return apply({type:'calibrate',sensor,reference});
   const p=serial.current;if(!p)throw new Error('Hardware is disconnected');
   if(calibrating.current||actionBusy.current)throw new Error('Wait for the current device operation');
   calibrating.current=true;
   try{
    engine.current.action({type:'device_calibration',sensor,at:Date.now()/1000,message:'Calibration capture requested; closed'},Date.now()/1000);publish();
    await send();const result=await p.calibrate(sensor,reference,latestSeq.current);
    const message=String(result.message||'Device calibration acknowledged');
    engine.current.action({type:'device_calibration',sensor,at:Date.now()/1000,message},Date.now()/1000);publish();saveCheckpoint();return message;
   }finally{calibrating.current=false;}
  },
  saveConfig:(config)=>apply({type:'config',config}),exportFlightRecorder,connectHardware,disconnectHardware,loadReplay
 }}>{children}</TelemetryContext.Provider>;
};
export const useTelemetry=()=>{const c=useContext(TelemetryContext);if(!c)throw new Error('TelemetryProvider missing');return c;};
