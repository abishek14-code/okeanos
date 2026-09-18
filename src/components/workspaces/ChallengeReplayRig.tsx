import React, {useState} from 'react';
import {useTelemetry} from '../../context/TelemetryContext';
import {SCENARIOS} from '../../services/scenarios';
export const ChallengeReplayRig:React.FC=()=>{
 const {frame,challengeRun:r,startChallenge,stopChallenge,resetToLive,mode,loadReplay,exportFlightRecorder}=useTelemetry();
 const [intensity,setIntensity]=useState(100),[error,setError]=useState('');
 const download=()=>{const u=URL.createObjectURL(new Blob([exportFlightRecorder('json')],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='okeanos-replay.json';a.click();URL.revokeObjectURL(u);};
 return <div className="workspace-viewport">
  <div className="workspace-header"><h1 className="workspace-title">Challenge testing & decision replay</h1><span className="ui-badge ui-badge--warning">SYNTHETIC TESTS • NO HARDWARE OUTPUT</span></div>
  <div className="ui-card"><p>Each trace runs through the same controller used by all six panels. The comparator checks nominal hard limits and learns an unqualified 60-sample rolling TDS baseline. Results below are calculated, not scripted.</p>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}>
    <button className="ui-btn ui-btn--secondary" onClick={resetToLive} disabled={mode==='HARDWARE'}>Reset to simulation</button>
    <button className="ui-btn ui-btn--secondary" onClick={stopChallenge} disabled={!r.is_running}>Pause challenge</button>
    <button className="ui-btn ui-btn--secondary" onClick={download}>Export decision replay</button>
    <label className="ui-btn ui-btn--secondary">Load replay JSON<input aria-label="Load replay JSON" type="file" accept=".json" disabled={mode==='HARDWARE'} onChange={async e=>{try{const f=e.target.files?.[0];if(f)loadReplay(await f.text());setError('');}catch(e){setError(String(e));}}}/></label>
    <label>Drift/noise intensity <input aria-label="Drift and noise intensity" type="range" min="50" max="200" value={intensity} onChange={e=>setIntensity(+e.target.value)}/>{intensity}%</label>
   </div><p role="alert">{error}</p>
  </div>
  <div className="grid-3">{SCENARIOS.map(s=><div className="ui-card" key={s.id}><h3>{s.name}</h3><p>{s.description}</p><p>{s.duration}s, including 40s startup/recovery input</p><button className="ui-btn ui-btn--primary" disabled={mode==='HARDWARE'} onClick={()=>startChallenge(s.id,intensity)}>{r.active_scenario_id===s.id&&r.is_running?'Restart scenario':'Run scenario'}</button></div>)}</div>
  <div className="ui-card"><h3>Calculated comparison • {r.step_progress}s • {r.is_running?'running':'paused / complete'}</h3>
   <table className="ui-table"><thead><tr><th>Metric</th><th>Nominal comparator</th><th>OKEANOS</th></tr></thead><tbody>
    <tr><td>Valve command</td><td>{r.legacy_valve_open?'OPEN':'CLOSED'}</td><td>{frame.valve_actuator.main_solenoid_state}</td></tr>
    <tr><td>Command transitions</td><td>{r.legacy_chatter_cycles}</td><td>{r.okeanos_chatter_cycles}</td></tr>
    <tr><td>Estimated admitted stress</td><td>{r.legacy_admitted_stress.toFixed(0)}</td><td>{r.okeanos_admitted_stress.toFixed(0)}</td></tr>
    <tr><td>Baseline moved more than 25 ppm</td><td>{String(r.legacy_baseline_contaminated)}</td><td>{String(r.okeanos_baseline_contaminated)}</td></tr>
   </tbody></table><p>Closure reason: {frame.valve_actuator.blockage_reason}. Detection delay and recovery assertions are also reported by <code>npm test</code>. Stress is a command-based estimate, not measured flow or membrane damage.</p>
  </div>
 </div>;
};
