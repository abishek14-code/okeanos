import React from 'react';
import {useTelemetry} from '../../context/TelemetryContext';
export const ExposureAccounting:React.FC=()=>{
 const {frame}=useTelemetry(),e=frame.exposure_accounting;
 const observed=e.admitted_exposure_cmsi+e.prevented_exposure_cmsi;
 return <div className="workspace-viewport"><div className="workspace-header"><h1 className="workspace-title">Exposure accounting</h1><span className="ui-badge ui-badge--info">COMMAND-BASED ESTIMATES</span></div>
 <div className="grid-3">{[['Observed inlet stress',observed],['Estimated admitted exposure',e.admitted_exposure_cmsi],['Stress during closed commands',e.prevented_exposure_cmsi]].map(([label,value])=><div className="ui-card" key={label}><p>{label}</p><strong style={{fontSize:28}}>{Number(value).toFixed(1)}</strong><p>proxy stress · seconds</p></div>)}</div>
 <div className="ui-card"><h3>How the accounting is connected</h3><p>The previous valid reading and previous valve command are integrated over elapsed time, capped at the 3-second telemetry timeout. Invalid or missing measurements are not filled with regression estimates.</p><p><code>s = 0.8 max(0, TDS − 300) + 120 |pH − 7| + 15 max(0, T − 25)</code></p><p><code>E = Σ s × Δt × commanded_open</code></p><p>Share of observed stress during closed commands: <strong>{e.damage_reduction_pct.toFixed(1)}%</strong>. Successful physical closure is unverified without separate valve/flow feedback.</p></div>
 <div className="ui-card"><h3>Membrane-life workflow connection</h3><p>The accumulated stress proxy is available to the primary workflow. Days remaining and a replacement date are deliberately unavailable: inlet TDS, pH and temperature cannot validate membrane remaining life. A calibrated model using normalized permeate flow, rejection and pressure differential is required.</p><p>Volume passed, diverted mass, leakage percentage and biofilm risk are also unavailable with the supplied sensors.</p></div></div>;
};
