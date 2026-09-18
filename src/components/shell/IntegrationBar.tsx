import React,{useState} from 'react';
import {useTelemetry} from '../../context/TelemetryContext';
export const IntegrationBar:React.FC=()=>{
 const {mode,connected,connection,connectHardware,disconnectHardware,resetToLive,overrideValve}=useTelemetry();const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);try{await fn();setError('');}catch(e){setError(String(e));}finally{setBusy(false);}};
 return <div style={{padding:'10px 20px',borderBottom:'1px solid var(--border-subtle)',background:'var(--surface-1)',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',fontSize:12}}>
 <strong className="ui-badge ui-badge--info">{mode}</strong><span style={{flex:1,minWidth:200}}>{error||connection}</span>
 <button className="ui-btn ui-btn--secondary ui-btn--sm" disabled={busy} onClick={()=>run(connected?disconnectHardware:connectHardware)}>{connected?'Disconnect USB':'Connect USB hardware'}</button>
 {!connected&&<button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={resetToLive}>Reset to simulation</button>}
 <button className="ui-btn ui-btn--danger ui-btn--sm" onClick={()=>run(()=>overrideValve('FORCE_CLOSE'))}>Latch closed</button>
 <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={()=>run(()=>overrideValve('AUTO'))}>Auto / recover</button>
 <button className="ui-btn ui-btn--secondary ui-btn--sm" title="30 minutes; only statistical drift gating is relaxed. Hard limits, source, uncertainty and recovery remain enforced." onClick={()=>run(()=>overrideValve('FORCE_OPEN'))}>Emergency mode</button>
 </div>;
};
