import type { SystemFlightRecorderFrame, LogEntry } from '../types/telemetry.ts';
import { createInitialFrame } from './initialFrame.ts';
import { calculateExpandedUncertainty, calculateInstantaneousStress, calculateMahalanobisDistance, evaluateIntervalGating, SOURCE_PROFILES, stepCusum, inferTdsFromRegression } from './engineMath.ts';

export const KEYS = ['tds', 'ph', 'temp'] as const;
export type Sensor = typeof KEYS[number];
export type Profile = 'MUNICIPAL' | 'BOREWELL' | 'RAINWATER';
export interface Sample {
  seq: number; tds: number; ph: number; temp: number;
  valid: boolean; fresh: boolean; estimated?: boolean;
  noise?: Partial<Record<Sensor, number>>;
  protocol?:number; raw_tds?:number; raw_ph?:number; sensor_valid?:boolean; calibrated?:boolean;
  calibration_at?:Partial<Record<Sensor,number>>; calibration_ready?:Partial<Record<Sensor,boolean>>;
  control_mode?:string; local_override?:boolean; actuator_kind?:string; freshness_basis?:string; physical_flow_verified?:boolean;
  main?:'OPEN'|'CLOSED'; drain?:'OPEN'|'CLOSED'; log_ok?:boolean; nvs_ok?:boolean;
}
export interface Config {
  limits: Record<Sensor, [number, number]>;
  k: number; cusumH: number; recoverySamples: number; purgeSeconds: number;
  hasDrain: boolean; version: number;
}
export const DEFAULT_CONFIG: Config = {
 limits:{tds:[0,800], ph:[6.5,8.5], temp:[10,45]}, k:2, cusumH:4.5,
 recoverySamples:30, purgeSeconds:15, hasDrain:true, version:1,
};
// Illustrative commissioning ceilings. Replace with the installed membrane specification.
const HARD = DEFAULT_CONFIG.limits;
type Bucket = { minute:number; n:number; sums:number[]; squares:number[] };
type Held = { sample:Sample; time:number; profile:Profile; eligible:boolean; version:number };
export type Action =
 | {type:'override'; mode:'FORCE_OPEN'|'FORCE_CLOSE'|'AUTO'}
 | {type:'quarantine'; action:'DISCARD'|'ADMIT_TO_BASELINE'|'RESET_CUSUM'}
 | {type:'profile'; profile:Profile|'UNKNOWN'}
 | {type:'purge'; seconds:number}
 | {type:'config'; config:Config}
 | {type:'calibrate'; sensor:Sensor; reference:number}
 | {type:'device_calibration'; sensor:Sensor; at:number; message:string}
 | {type:'restart'};
export type TraceEvent = {kind:'sample'; sample:Sample; now:number; decision?:unknown} | {kind:'action'; action:Action; now:number};
export interface Recording { schema:'okeanos-replay-v1'; synthetic:boolean; events:TraceEvent[]; truncated:boolean; initial?:unknown }
const mean = (a:number[]) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
const sd = (a:number[]) => a.length>1 ? Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)) : 0;
const correlation=(a:number[],b:number[])=>{const ma=mean(a),mb=mean(b),den=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)*b.reduce((s,x)=>s+(x-mb)**2,0));return den?a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/den:0;};
const finiteSample = (s:Sample) => KEYS.every(k=>Number.isFinite(s[k])) && Number.isSafeInteger(s.seq) && s.seq>=0;
export class GateController {
 frame = createInitialFrame();
 config:Config = structuredClone(DEFAULT_CONFIG);
 logs:LogEntry[]=[];
 records:TraceEvent[]=[];
 truncated=false;
 initial:unknown=undefined;
 profile:Profile='MUNICIPAL';
 private unknown=false;
 private manual=false;
 private emergencyUntil=0;
 private drift=false;
 private lastSeq=-1;
 private lastTime:number|null=null;
 private lastSample:Sample|null=null;
 private history:Sample[]=[];
 private buckets:Record<Profile,Bucket[]>={MUNICIPAL:[],BOREWELL:[],RAINWATER:[]};
 private held:Held[]=[];
 private sPlus=0; private sMinus=0;
 private purgeUntil=0;
 private recoveryCount=0;
 private stableCount=0;
 private stableSince:number|null=null;
 private recoverySince:number|null=null;
 private stateStarted=0;
 private lastFresh:number|null=null;
 private calibration:Record<Sensor,{offset:number;at:number}>={tds:{offset:0,at:0},ph:{offset:0,at:0},temp:{offset:0,at:0}};
 diagnostics={fault:'Awaiting samples', temporal:'STARTUP', anomalyScore:0, riskScore:0, baselineLimits:structuredClone(HARD), mode:'PROTECT', sampleFresh:false, correlationTdsPh:0, correlationTdsTemp:0, diagnosticTdsEstimate:0};
 private record(event:TraceEvent) { if(this.records.length<10000)this.records.push(structuredClone(event));else this.truncated=true; }
 private log(message:string, now:number, subsystem:LogEntry['subsystem']='GATING') {
  this.logs.unshift({id:`${now}-${this.records.length}-${this.logs.length}`,timestamp:new Date(now*1000).toISOString(),severity:'INFO',subsystem,message}); this.logs=this.logs.slice(0,100);
 }
 private close(reason:SystemFlightRecorderFrame['valve_actuator']['blockage_reason']) {
  if(this.frame.valve_actuator.main_solenoid_state==='OPEN')this.frame.valve_actuator.total_cycles_logged++;
  this.purgeUntil=0;
  this.frame.valve_actuator.main_solenoid_state='CLOSED';
  this.frame.valve_actuator.drain_flush_state='CLOSED';
  this.frame.valve_actuator.blockage_reason=reason;
  this.frame.quarantine_engine.learning_frozen=true;
  this.frame.quarantine_engine.status='BASELINE_FROZEN';
  this.frame.fsm_recovery.current_state='BLOCKED';
  this.frame.recovery_fsm.current_state='ANOMALY_LOCKOUT';
  this.recoveryCount=0;this.stableCount=0;this.stableSince=null;this.recoverySince=null;
 }
 private baseline() {
  const p=SOURCE_PROFILES[this.profile], b=this.buckets[this.profile];
  const n=b.reduce((s,x)=>s+x.n,0), sums=[0,1,2].map(i=>b.reduce((s,x)=>s+x.sums[i],0));
  const priors=[p.mu_tds,p.mu_ph,p.mu_temp], floors=[p.sigma_tds,p.sigma_ph,p.sigma_temp];
  return {n,means:priors.map((v,i)=>n>=30?sums[i]/n:v), sigmas:floors.map((v,i)=>n>=30?Math.max(v,Math.sqrt(Math.max(0,b.reduce((s,x)=>s+x.squares[i],0)/n-(sums[i]/n)**2))):v)};
 }
 private commit(s:Sample,time:number, profile=this.profile) {
  const arr=this.buckets[profile],minute=Math.floor(time/60);
  let b=arr.find(b=>b.minute===minute);
  if(!b) { b={minute,n:0,sums:[0,0,0],squares:[0,0,0]};arr.push(b); }
  b.n++;KEYS.forEach((k,i)=>{b!.sums[i]+=s[k];b!.squares[i]+=s[k]**2;});
 }
 action(a:Action,now:number,record=true):string {
  if(!Number.isFinite(now))throw new Error('Invalid action time');
  if(a.type==='restart') {
   const records=this.records, initial=this.initial, checkpoint=this.checkpoint();
   const next=new GateController();next.restore(checkpoint);Object.assign(this,next);
   this.records=records;this.initial=initial;
  } else if(a.type==='config') {
   const c=a.config;
   if(!c || !Number.isFinite(c.k)||c.k<1.96||c.k>3||!Number.isFinite(c.cusumH)||c.cusumH<1||c.cusumH>20 || !Number.isInteger(c.recoverySamples)||c.recoverySamples<30||c.recoverySamples>300 || !Number.isInteger(c.purgeSeconds)||c.purgeSeconds<5||c.purgeSeconds>120 || typeof c.hasDrain!=='boolean')throw new Error('Invalid controller configuration');
   KEYS.forEach(k=>{const l=c.limits[k];if(!l||!l.every(Number.isFinite)||l[0]>=l[1]||l[0]<HARD[k][0]||l[1]>HARD[k][1])throw new Error(`${k}: limits must remain inside commissioning ceilings ${HARD[k].join('–')}`);});
   this.config={...structuredClone(c),version:this.config.version+1};this.close('RECOVERY');
  } else if(a.type==='override') {
   this.manual=a.mode==='FORCE_CLOSE';this.emergencyUntil=a.mode==='FORCE_OPEN'?now+1800:0;
   // Emergency can relax statistical drift only. Measurement/fault/source gates remain mandatory.
   this.close(this.manual?'MANUAL_CLOSE':'RECOVERY');
  } else if(a.type==='profile') {
   if(!['MUNICIPAL','BOREWELL','RAINWATER','UNKNOWN'].includes(a.profile))throw new Error('Unknown profile');
   this.unknown=a.profile==='UNKNOWN';
   if(a.profile!=='UNKNOWN')this.profile=a.profile;
   this.sPlus=0;this.sMinus=0;this.drift=false;this.history=[];this.stableCount=0;
   this.close(this.unknown?'UNKNOWN_SOURCE':'SOURCE_CHANGE');
  } else if(a.type==='purge') {
   if(this.manual)throw new Error('Release the closed latch with Auto / recover before requesting purge');
   if(!this.config.hasDrain)throw new Error('No commissioned drain path; fresh sampling must be provided separately');
   if(!Number.isInteger(a.seconds)||a.seconds<5||a.seconds>120)throw new Error('Purge duration must be 5–120 seconds');
   this.close('PURGE');this.purgeUntil=now+a.seconds;this.frame.valve_actuator.drain_flush_state='OPEN';
  } else if(a.type==='calibrate') {
   if(!KEYS.includes(a.sensor)||!Number.isFinite(a.reference)||a.reference<HARD[a.sensor][0]||a.reference>HARD[a.sensor][1]||!this.lastSample?.valid)throw new Error('A valid reading and in-range reference are required');
   this.calibration[a.sensor]={offset:a.reference-this.lastSample[a.sensor],at:now};
   this.config={...this.config,version:this.config.version+1};
   this.close('RECOVERY');this.history=[];
  } else if(a.type==='device_calibration') {
   if(!KEYS.includes(a.sensor)||!Number.isFinite(a.at)||a.at<0)throw new Error('Invalid device calibration');
   this.calibration[a.sensor]={offset:0,at:a.at};this.config={...this.config,version:this.config.version+1};
   this.close('RECOVERY');this.history=[];this.held=[];
   this.buckets={MUNICIPAL:[],BOREWELL:[],RAINWATER:[]};this.sPlus=0;this.sMinus=0;this.drift=false;
   this.log(a.message,now,'CALIBRATION');
  } else if(a.type==='quarantine') {
   if(!['DISCARD','ADMIT_TO_BASELINE','RESET_CUSUM'].includes(a.action))throw new Error('Unknown quarantine action');
   if(a.action==='ADMIT_TO_BASELINE') {
    if(this.stableCount<this.config.recoverySamples||this.unknown||this.manual||this.emergencyUntil>now)throw new Error('Admission requires 30 fresh stable qualifying samples in the selected profile, with no override');
    const eligible=this.held.filter(h=>h.eligible&&h.version===this.config.version&&h.profile===this.profile&&h.time>=now-30*86400);
    if(!eligible.length)throw new Error('No eligible quarantined samples; abnormal/faulted samples cannot be admitted');
    for(const h of eligible)this.commit(h.sample,h.time,h.profile);
    this.held=this.held.filter(h=>!eligible.includes(h));
   } else if(a.action==='DISCARD')this.held=[];
   if(a.action!=='DISCARD'&&this.stableCount<this.config.recoverySamples)throw new Error('CUSUM reset requires 30 fresh stable qualifying samples');
   if(this.stableCount>=this.config.recoverySamples){this.sPlus=0;this.sMinus=0;this.drift=false;}
  } else throw new Error('Unknown controller action');
  if(record)this.record({kind:'action',action:a,now});
  this.log(`Operator action: ${a.type}`,now);
  this.frame.flight_recorder_log=[{id:`action-${this.records.length}-${now}`,timestamp:new Date(now*1000).toISOString(),event_type:a.type==='purge'?'PURGE_TRIGGER':a.type==='restart'?'SYSTEM_BOOT':a.type==='quarantine'?'QUARANTINE_FREEZE':`OPERATOR_${a.type.toUpperCase()}`,trigger:JSON.stringify(a),value_recorded:0,hash_signature:'Not signed'},...this.frame.flight_recorder_log].slice(0,300);
  return 'Applied. All measurement and recovery interlocks remain active.';
 }
 step(input:Sample, now:number, record=true):SystemFlightRecorderFrame {
  if(!Number.isFinite(now)||now<0)throw new Error('Invalid sample timestamp');
  if(record)this.record({kind:'sample',sample:input,now});
  const f=this.frame, previouslyFrozen=this.frame.quarantine_engine.learning_frozen, previousValve=f.valve_actuator.main_solenoid_state, previousState=f.fsm_recovery.current_state;
  if(this.lastTime===null)f.flight_recorder_log=[{id:`boot-${now}`,timestamp:new Date(now*1000).toISOString(),event_type:'SYSTEM_BOOT',trigger:'New acquisition session; closed startup',value_recorded:0,hash_signature:'Not signed'},...f.flight_recorder_log].slice(0,300);
  const elapsed=this.lastTime===null?0:now-this.lastTime;
  const dt=Math.max(0,Math.min(3,elapsed));
  // Left-endpoint integral: account for the reading and command applied over the preceding interval.
  if(this.lastSample && this.lastSample.valid && finiteSample(this.lastSample)) {
   const stress=calculateInstantaneousStress(f.telemetry.tds.value,f.telemetry.ph.value,f.telemetry.temp.value)*dt;
   if(previousValve==='OPEN')f.exposure_accounting.admitted_exposure_cmsi+=stress;
   else f.exposure_accounting.prevented_exposure_cmsi+=stress;
  }
  const ordered=finiteSample(input)&&input.seq>this.lastSeq&&(this.lastTime===null||(elapsed>=0.5&&elapsed<=3));
  const gap=this.lastTime!==null&&elapsed>3;
  let fault=(!finiteSample(input)||input.valid!==true||input.estimated===true)?'Invalid, disconnected or estimated sensor':!ordered?'Missing, duplicate or out-of-order sample':'';
  if(gap)fault='Telemetry gap exceeded 3 seconds';
  const s={...input};KEYS.forEach(k=>{
   if(input.protocol===2) { // ESP32 calibration is authoritative; never apply a second host offset.
    this.calibration[k].offset=0;
    const at=input.calibration_at?.[k];if(Number.isFinite(at)&&at!>=0)this.calibration[k].at=at!;
   } else s[k]+=this.calibration[k].offset;
  });
  if(!fault && (s.tds<0||s.tds>5000||s.ph<0||s.ph>14||s.temp<0||s.temp>85))fault='Sensor value outside plausible acquisition range';
  if(input.noise && KEYS.some(k=>input.noise?.[k]!==undefined && (!Number.isFinite(input.noise[k])||input.noise[k]!<0)))fault='Invalid uncertainty metadata';
  if(finiteSample(input)&&input.seq>this.lastSeq)this.lastSeq=input.seq;
  if(!fault)this.history=[...this.history,s].slice(-60);
  else this.history=[];
  if(this.history.length>=30&&(input.protocol===2 ? this.history.slice(-30).every(x=>x.raw_tds===s.raw_tds&&x.raw_ph===s.raw_ph&&x.temp===s.temp) : KEYS.some(k=>this.history.slice(-30).every(x=>x[k]===s[k]))))fault='Frozen sensor suspected: 30 identical consecutive values';
  for(const p of Object.keys(this.buckets) as Profile[])this.buckets[p]=this.buckets[p].filter(b=>b.minute>=Math.floor((now-30*86400)/60));
  const b=this.baseline();
  const distances=Object.values(SOURCE_PROFILES).map(p=>calculateMahalanobisDistance(s.tds,s.ph,s.temp,p));
  const activeDistance=calculateMahalanobisDistance(s.tds,s.ph,s.temp,SOURCE_PROFILES[this.profile]);
  const sourceOK=!this.unknown&&Number.isFinite(activeDistance)&&activeDistance<=3.5;
  const driftResult=fault?{s_plus:this.sPlus,s_minus:this.sMinus,shift_detected:false}:stepCusum(s.tds,b.means[0],b.sigmas[0],this.sPlus,this.sMinus,0.5,this.config.cusumH);
  this.sPlus=driftResult.s_plus;this.sMinus=driftResult.s_minus;
  if(driftResult.shift_detected)this.drift=true;
  let intervalsOK=true,hardTrip=false,insideHysteresis=true;
  KEYS.forEach((k,i)=>{
   const m=f.telemetry[k],age=this.calibration[k].at?Math.max(0,(now-this.calibration[k].at)/86400):0;
   const noise=Math.max([2,0.01,0.03][i],sd(this.history.slice(-10).map(s=>s[k])),Number.isFinite(input.noise?.[k])?input.noise![k]!:0);
   m.raw_adc=k==='tds'?(input.raw_tds??0):k==='ph'?(input.raw_ph??0):0;
   m.value=Number.isFinite(s[k])?s[k]:m.value;
   m.u_noise=noise;m.u_age=[0.1,0.001,0.002][i]*age;
   m.uncertainty=calculateExpandedUncertainty(m.u_cal,noise,m.u_age,this.config.k);
   const limits=this.config.limits[k];m.lower_bound=limits[0];m.upper_bound=limits[1];
   const gate=evaluateIntervalGating(s[k],m.uncertainty,...limits);
   m.status=fault?'fail':gate.status;
   hardTrip ||= gate.status==='fail';intervalsOK &&= gate.status==='pass';
   const margin=(limits[1]-limits[0])*0.05;
   insideHysteresis &&=s[k]-m.uncertainty>=limits[0]+margin&&s[k]+m.uncertainty<=limits[1]-margin;
   m.historical_values=this.history.slice(-60).map(x=>x[k]);
   this.diagnostics.baselineLimits[k]=[Math.max(limits[0],b.means[i]-3*b.sigmas[i]),Math.min(limits[1],b.means[i]+3*b.sigmas[i])];
  });
  const adaptiveOK=KEYS.every(k=>s[k]>=this.diagnostics.baselineLimits[k][0]&&s[k]<=this.diagnostics.baselineLimits[k][1]);
  const fresh=ordered&&!fault&&input.fresh===true;
  if(this.lastFresh===null||fresh)this.lastFresh=now;
  const statisticallyStable=this.history.length>=5&&KEYS.every((k,i)=>sd(this.history.slice(-5).map(s=>s[k]))<=[8,0.04,0.2][i]);
  const emergency=now<this.emergencyUntil;
  const recoveryQualified=intervalsOK&&insideHysteresis&&sourceOK&&!fault&&fresh&&statisticallyStable&&(emergency||adaptiveOK);
  this.recoverySince=recoveryQualified?(this.recoverySince??now):null;
  const qualified=intervalsOK&&insideHysteresis&&sourceOK&&!fault&&fresh&&statisticallyStable&&adaptiveOK;
  this.stableCount=qualified?this.stableCount+1:0;
  this.stableSince=qualified?(this.stableSince??now):null;
  const stableWindow=this.stableSince!==null&&now-this.stableSince>=29;
  let permission=intervalsOK&&sourceOK&&!fault&&fresh&&!this.manual&&(emergency||(!this.drift&&adaptiveOK));
  let reason:SystemFlightRecorderFrame['valve_actuator']['blockage_reason']=fault?(gap?'STALE_DATA':'SENSOR_FAULT'):this.manual?'MANUAL_CLOSE':hardTrip?'MEASURED_BREACH':!intervalsOK?'UNCERTAINTY_OVERLAP':!sourceOK?'UNKNOWN_SOURCE':!emergency&&(this.drift||!adaptiveOK)?'DRIFT':'RECOVERY';
  let nextState=previousState;
  if(!permission){this.recoveryCount=0;nextState=hardTrip||fault||this.manual||!sourceOK?'BLOCKED':'SUSPECT';}
  // Recovery evidence may accumulate while a drift latch awaits validated reset.
  if(qualified&&!this.manual&&this.drift&&this.stableCount>=this.config.recoverySamples&&stableWindow){this.drift=false;this.sPlus=0;this.sMinus=0;permission=intervalsOK&&sourceOK&&!fault&&fresh;this.recoveryCount=this.stableCount-1;}
  if(permission) {
   if(previousState==='NORMAL'||previousState==='RESTORED')nextState='NORMAL';
   else {
    nextState='RECOVERY_CHECK';
    if(recoveryQualified)this.recoveryCount++;else this.recoveryCount=0;
    if(this.recoveryCount>=this.config.recoverySamples&&this.recoverySince!==null&&now-this.recoverySince>=29&&now>=this.purgeUntil)nextState='RESTORED';
   }
  }
  const purging=now<this.purgeUntil;
  if(purging){nextState=permission?'RECOVERY_CHECK':'BLOCKED';this.recoveryCount=0;this.recoverySince=null;if(permission)reason='PURGE';}
  const open=permission&&!purging&&(nextState==='NORMAL'||nextState==='RESTORED');
  // Keep a commissioned drain open during recovery. Fresh=true must originate from physical flow evidence.
  const drain=this.config.hasDrain&&!open&&(purging||(nextState==='RECOVERY_CHECK'&&!this.manual));
  f.valve_actuator.main_solenoid_state=open?'OPEN':'CLOSED';f.valve_actuator.drain_flush_state=drain?'OPEN':'CLOSED';
  f.valve_actuator.blockage_reason=open?'NONE':reason;
  f.valve_actuator.emergency_override_active=emergency;f.valve_actuator.emergency_time_remaining_secs=Math.max(0,Math.ceil(this.emergencyUntil-now));
  if(previousValve!==f.valve_actuator.main_solenoid_state)f.valve_actuator.total_cycles_logged++;
  f.valve_actuator.chatter_lockout_active=!open;
  const frozen=!open||!qualified||emergency;
  if(frozen&&!previouslyFrozen)f.flight_recorder_log=[{id:`freeze-${now}`,timestamp:new Date(now*1000).toISOString(),event_type:'QUARANTINE_FREEZE',trigger:reason,value_recorded:s.tds,hash_signature:'Not signed'},...f.flight_recorder_log].slice(0,300);
  if(!fault) {
   if(!frozen)this.commit(s,now);
   else this.held=[...this.held,{sample:s,time:now,profile:this.profile,eligible:qualified&&!emergency&&!this.manual,version:this.config.version}].slice(-3600);
  }
  const baseline=this.baseline();
  f.quarantine_engine={...f.quarantine_engine,status:frozen?'BASELINE_FROZEN':'NORMAL',learning_frozen:frozen,
   cusum_s_plus:this.sPlus,cusum_s_minus:this.sMinus,threshold_h:this.config.cusumH,
   trusted_records_count:baseline.n,baseline_mean:baseline.means[0],baseline_sigma:baseline.sigmas[0],
   quarantined_samples_count:this.held.length,quarantined_mean:mean(this.held.map(h=>h.sample.tds)),
   cusum_history:[...f.quarantine_engine.cusum_history,{time:new Date(now*1000).toISOString(),s_plus:this.sPlus,s_minus:this.sMinus}].slice(-60)};
  f.source_profile={...f.source_profile,active_profile:sourceOK?this.profile:'UNKNOWN (LOCKED)',active_source:this.profile,
   unknown_source_locked:!sourceOK,mahalanobis_distance:Number.isFinite(activeDistance)?activeDistance:999,
   confidence_score:sourceOK?Math.exp(-(activeDistance**2)/2):0,confidence_pct:sourceOK?100*Math.exp(-(activeDistance**2)/2):0,
   municipal_distance:distances[0]||0,borewell_distance:distances[1]||0,rainwater_distance:distances[2]||0};
  if(nextState!==previousState){this.stateStarted=now;this.log(`${previousState} → ${nextState}: ${reason}`,now,'FSM');}
  const recovery={...f.fsm_recovery,current_state:nextState,stagnant_chamber_flag:!fresh,
   time_in_state_s:Math.max(0,now-this.stateStarted),time_in_state_seconds:Math.max(0,now-this.stateStarted),
   violation_timer_seconds:permission?0:f.fsm_recovery.violation_timer_seconds+dt,
   purge_timer_seconds:Math.max(0,this.purgeUntil-now),purge_countdown_s:Math.max(0,this.purgeUntil-now),
   settling_countdown_s:statisticallyStable?0:Math.max(0,5-this.history.length),consecutive_pass_samples:this.recoveryCount,
   required_pass_samples:this.config.recoverySamples,recovery_timer_seconds:open?0:this.config.recoverySamples-this.recoveryCount};
  f.fsm_recovery=recovery;
  f.recovery_fsm={...recovery,current_state:purging?'PURGE_ACTIVE':nextState==='NORMAL'?'NORMAL_FLOW':nextState==='RESTORED'?'GATE_RESTORED':nextState==='RECOVERY_CHECK'?(statisticallyStable?'RESIDUAL_HOLD':'SENSOR_SETTLING'):'ANOMALY_LOCKOUT'};
  f.anti_stagnation.time_until_purge_s=Math.max(0,14400-(now-this.lastFresh));
  // Automatic four-hour purge requires a commissioned drain; it never bypasses recovery.
  if(!this.manual&&this.config.hasDrain&&now-this.lastFresh>=14400&&!purging){this.purgeUntil=now+this.config.purgeSeconds;this.lastFresh=now;f.flight_recorder_log=[{id:`purge-${now}`,timestamp:new Date(now*1000).toISOString(),event_type:'STAGNATION_PURGE',trigger:'Four-hour sampling inactivity',value_recorded:this.config.purgeSeconds,hash_signature:'Not signed'},...f.flight_recorder_log].slice(0,300);}
  const e=f.exposure_accounting;e.cmsi_current=e.admitted_exposure_cmsi;
  e.damage_reduction_pct=100*e.prevented_exposure_cmsi/(e.admitted_exposure_cmsi+e.prevented_exposure_cmsi||1);
  e.membrane_rul_pct=0;e.days_remaining_projected=0;
  const m=f.telemetry.tds;
  f.calibration_engine.tds_uncertainty_budget={u_adc_quant:0,u_temp_drift:0,u_cal_residual:m.u_cal,u_aging:m.u_age,u_noise:m.u_noise,
   combined_uncertainty_uc:m.uncertainty/this.config.k,expanded_uncertainty_k2:m.uncertainty};
  f.calibration_engine.days_since_calibration=this.calibration.tds.at?Math.floor((now-this.calibration.tds.at)/86400):0;
  f.timestamp=now;f.uptime_seconds+=dt;
  this.diagnostics={...this.diagnostics,fault,temporal:permission?'ACCEPTABLE':recovery.violation_timer_seconds>=30?'PERSISTENT':'TRANSIENT / SUSPECT',
   anomalyScore:Number.isFinite(activeDistance)?activeDistance:999,riskScore:Math.min(100,hardTrip||fault?100:activeDistance*20),mode:emergency?'EMERGENCY (INTERLOCKED)':'PROTECT',sampleFresh:fresh,
   correlationTdsPh:correlation(this.history.map(s=>s.tds),this.history.map(s=>s.ph)),
   correlationTdsTemp:correlation(this.history.map(s=>s.tds),this.history.map(s=>s.temp)),
   diagnosticTdsEstimate:inferTdsFromRegression(f.telemetry.ph.value,f.telemetry.temp.value)};
  f.flight_recorder_log=[{id:`decision-${this.records.length}-${now}`,timestamp:new Date(now*1000).toISOString(),event_type:open?'GATE_PERMISSION':'GATE_SNAP_CLOSE',
   trigger:open?'All interlocks passed':reason,value_recorded:m.value,uncertainty_recorded:m.uncertainty,hash_signature:'Not signed'} ,...f.flight_recorder_log].slice(0,300);
  this.lastTime=now;this.lastSample={...input,valid:!fault};
  const event=this.records[this.records.length-1];
  if(record&&event?.kind==='sample'&&event.now===now)event.decision={telemetry:Object.fromEntries(KEYS.map(k=>[k,{...f.telemetry[k],historical_values:undefined}])),profile:f.source_profile.active_profile,config:structuredClone(this.config),learning_frozen:frozen,state:nextState,valve:structuredClone(f.valve_actuator),exposure:structuredClone(f.exposure_accounting),diagnostics:structuredClone(this.diagnostics)};
  return structuredClone(f);
 }
 stale(now:number) { return this.step({seq:this.lastSeq,tds:0,ph:0,temp:0,valid:false,fresh:false},now); }
 export(synthetic=true):Recording {return {schema:'okeanos-replay-v1',synthetic,events:structuredClone(this.records),truncated:this.truncated,initial:this.initial};}
 checkpoint() {return {schema:1,unknown:this.unknown,config:this.config,buckets:this.buckets,exposure:this.frame.exposure_accounting,profile:this.profile,calibration:this.calibration,manual:this.manual,cycles:this.frame.valve_actuator.total_cycles_logged};}
 restore(value:unknown) {
  const p=value as ReturnType<GateController['checkpoint']>;
  if(!p||p.schema!==1)throw new Error('Unsupported checkpoint');
  this.action({type:'config',config:p.config},0,false);
  if(!Number.isSafeInteger(p.config.version)||p.config.version<1)throw new Error('Invalid configuration version');
  this.config.version=p.config.version;
  if(!SOURCE_PROFILES[p.profile])throw new Error('Invalid checkpoint profile');
  for(const list of Object.values(p.buckets))if(!Array.isArray(list)||list.some(b=>!Number.isFinite(b.minute)||!Number.isFinite(b.n)||b.n<1||b.sums.length!==3||b.squares.length!==3||!b.sums.every(Number.isFinite)||!b.squares.every(Number.isFinite)))throw new Error('Invalid baseline checkpoint');
  if(!Object.values(p.exposure).every(x=>Number.isFinite(x)&&x>=0))throw new Error('Invalid exposure checkpoint');
  if(KEYS.some(k=>!p.calibration[k]||!Number.isFinite(p.calibration[k].offset)||!Number.isFinite(p.calibration[k].at)))throw new Error('Invalid calibration checkpoint');
  this.buckets=structuredClone(p.buckets);this.profile=p.profile;this.calibration=structuredClone(p.calibration);
  this.frame.exposure_accounting=structuredClone(p.exposure);this.manual=!!p.manual;this.unknown=!!p.unknown;
  this.frame.valve_actuator.total_cycles_logged=Number.isSafeInteger(p.cycles)&&p.cycles>=0?p.cycles:0;
  this.initial=structuredClone(p);
  this.close('STARTUP'); // Never restore permission, timers, or emergency override from disk.
 }
}
export function parseRecording(text:string):Recording {
 if(text.length>100000000)throw new Error('Replay file exceeds 100 MB');
 const r=JSON.parse(text) as Recording;
 if(r.schema!=='okeanos-replay-v1'||!Array.isArray(r.events)||r.events.length>10000)throw new Error('Unsupported replay file');
 if(r.events.some(e=>!['sample','action'].includes(e.kind)||!Number.isFinite(e.now)))throw new Error('Malformed replay event');
 return r;
}
