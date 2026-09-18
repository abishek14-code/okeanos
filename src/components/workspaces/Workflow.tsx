import React from 'react';
import {useTelemetry} from '../../context/TelemetryContext';
export const Workflow:React.FC=()=>{
 const {frame,diagnostics,mode}=useTelemetry();
 const node=(x:number,y:number,title:string,detail:string)=><g><rect x={x} y={y} width="390" height="62" rx="8" fill="var(--surface-2)" stroke="var(--border-subtle)"/><text x={x+16} y={y+25} fill="var(--text-primary)" fontSize="14" fontWeight="600">{title}</text><text x={x+16} y={y+46} fill="var(--text-secondary)" fontSize="11">{detail}</text></g>;
 return <details className="ui-card" open><summary style={{cursor:'pointer',fontWeight:600}}>Connected hardware and software workflow</summary>
 <svg role="img" aria-label="Sensor acquisition connects to qualified baseline, pattern recognition, source analysis, exposure, risk and AND gating; commands return to main and drain valve drivers." viewBox="0 0 940 720" width="100%" style={{maxHeight:600,marginTop:12}}>
 <defs><marker id="workflow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--accent)"/></marker></defs>
 <g stroke="var(--accent)" strokeWidth="2" fill="none" markerEnd="url(#workflow-arrow)">
 <path d="M225 82 V110"/><path d="M225 172 V200"/><path d="M420 231 H490"/>
 {[262,352,442,532].map(y=><path key={y} d={`M685 ${y} V${y+28}`}/>)}
 <path d="M490 591 H450 V621 H420"/><path d="M225 590 V532"/><path d="M225 470 V442"/>
 <path d="M30 411 H12 V141 H30"/>
 </g>
 {node(30,20,'1. Inlet → sensor chamber','TDS / pH / temperature; 1 Hz acquisition')}
 {node(30,110,'2. Device packet + freshness evidence',mode==='HARDWARE'?'USB JSON + sequence + valid/fresh flags':'Synthetic input; hardware output disconnected')}
 {node(30,200,'3. Acquisition and sensor-fault gate',diagnostics.fault||'Values valid; regression cannot grant permission')}
 {node(490,200,'4. Qualified 30-day baseline',frame.quarantine_engine.learning_frozen?'Learning frozen → quarantine':'Stable qualified data → source-specific baseline')}
 {node(490,290,'5. Temporal patterns + uncertainty',`${diagnostics.temporal}; full-interval checks`)}
 {node(490,380,'6. Source and joint anomaly analysis',`${frame.source_profile.active_profile}; distance ${diagnostics.anomalyScore.toFixed(2)}`)}
 {node(490,470,'7. Exposure / membrane model input','Observed + admitted + blocked stress; life unvalidated')}
 {node(490,560,'8. Risk + recovery + AND permission',`${diagnostics.mode}; ${frame.fsm_recovery.current_state}`)}
 {node(30,590,'9. Main / drain command interlock',`Main ${frame.valve_actuator.main_solenoid_state}; drain ${frame.valve_actuator.drain_flush_state}`)}
 {node(30,470,'10. ESP32 driver + local watchdog','Hard-limit veto; command expires after 2.5 seconds')}
 {node(30,380,'11. NC main valve → RO / drain branch','Physical flow evidence returns to acquisition')}
 <text x="30" y="699" fill="var(--text-muted)" fontSize="12">Faults veto permission immediately. Every decision feeds the recorder, replay and all six feature panels.</text>
 </svg><p style={{fontSize:12}}>Main and drain commands are mutually exclusive. An acknowledgement confirms firmware command state, not physical valve position. Software stop/disconnect commands closure; the device watchdog must enforce it independently.</p><p style={{fontSize:12}}>Rolling Pearson correlation: TDS/pH {diagnostics.correlationTdsPh.toFixed(2)}; TDS/temperature {diagnostics.correlationTdsTemp.toFixed(2)}. Diagnostic regression estimate: {diagnostics.diagnosticTdsEstimate.toFixed(0)} ppm (unvalidated; never authorizes flow).</p></details>;
};
