import {writeFileSync} from 'node:fs';
import {GateController} from '../src/services/controller.ts';
import {SCENARIOS,syntheticSample,LegacyController} from '../src/services/scenarios.ts';
import {calculateInstantaneousStress} from '../src/services/engineMath.ts';
const rows=[];
for(const s of SCENARIOS){
 const engine=new GateController(),legacy=new LegacyController();let detected=null,acceptableClosures=0,legacyClosures=0,recoveryAt=null;
 for(let i=0;i<s.duration;i++){
  if(s.id==='blocked_restart'&&i===55)engine.action({type:'restart'},i);
  const sample=syntheticSample(i,s.id),before=engine.frame.valve_actuator.main_solenoid_state;
  engine.step(sample,i);legacy.step(sample,calculateInstantaneousStress);
  const isOpen=engine.frame.valve_actuator.main_solenoid_state==='OPEN';
  if(i>=40&&!isOpen&&detected===null)detected=i-40;
  // Only labelled clean segments after startup; counts samples, not events.
  const clean=(s.id==='recovery_relapse'&&i>=52&&i<=135)||(s.id==='blocked_restart'&&i>=75);
  if(clean&&!isOpen)acceptableClosures++;
  if(clean&&!legacy.open)legacyClosures++;
  if(i>55&&isOpen&&before==='CLOSED'&&recoveryAt===null)recoveryAt=i;
 }
 rows.push({scenario:s.id,synthetic:true,detection_delay_samples:detected,recovery_at_sample:recoveryAt,
  acceptable_samples_held_closed:acceptableClosures,legacy_acceptable_samples_closed:legacyClosures,
  valve_command_transitions:engine.frame.valve_actuator.total_cycles_logged,legacy_transitions:legacy.cycles,
  estimated_admitted_exposure:engine.frame.exposure_accounting.admitted_exposure_cmsi,legacy_admitted_exposure:legacy.exposure});
}
writeFileSync('docs/challenge-results.json',JSON.stringify(rows,null,2)+'\n');
console.table(rows);
