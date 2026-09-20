import React,{useState} from 'react';
import {useTelemetry} from '../../context/TelemetryContext';
import type {Sensor} from '../../services/controller';
export const UncertaintyCalibration:React.FC=()=>{
 const {frame,config,calibrateSensor,mode}=useTelemetry();
 const [sensor,setSensor]=useState<Sensor>('ph'),[reference,setReference]=useState('7'),[notice,setNotice]=useState('');
 return <div className="workspace-viewport"><div className="workspace-header"><h1 className="workspace-title">Measurement uncertainty & calibration</h1><span className="ui-badge ui-badge--info">k = {config.k}</span></div>
 <div className="ui-card"><p>Permission requires the entire interval to lie within the configured bounds. U = k √(u_cal² + u_noise² + u_age²). Noise uses recent readings and any larger acquisition noise estimate. Calibration uncertainty values are commissioning assumptions until measured.</p>
 <table className="ui-table"><thead><tr><th>Sensor</th><th>Value</th><th>Calibration u</th><th>Noise u</th><th>Age u</th><th>Expanded interval</th><th>Permission</th></tr></thead><tbody>{(['tds','ph','temp'] as const).map(k=>{const m=frame.telemetry[k];return <tr key={k}><td>{k.toUpperCase()}</td><td>{m.value.toFixed(2)}</td><td>{m.u_cal.toFixed(3)}</td><td>{m.u_noise.toFixed(3)}</td><td>{m.u_age.toFixed(3)}</td><td>{(m.value-m.uncertainty).toFixed(2)} – {(m.value+m.uncertainty).toFixed(2)}</td><td>{m.status.toUpperCase()}</td></tr>;})}</tbody></table></div>
 <div className="ui-card"><h3>{mode==='HARDWARE'?'ESP32 probe calibration':'Single-point software offset calibration'}</h3><p>{mode==='HARDWARE'?'TDS and pH: capture two different known references, waiting at least five stable samples at each. Temperature: capture one reference. Coefficients are saved on the ESP32; outputs close and recovery restarts. This calibration does not establish water freshness.':'Capture a known reference to update the simulation software offset and restart recovery.'}</p>
 <form onSubmit={async e=>{e.preventDefault();try{setNotice(await calibrateSensor(sensor,Number(reference)));}catch(e){setNotice(String(e));}}} style={{display:'flex',gap:12,marginTop:16,flexWrap:'wrap'}}>
 <select aria-label="Calibration sensor" value={sensor} onChange={e=>setSensor(e.target.value as Sensor)}><option value="ph">pH</option><option value="tds">TDS</option><option value="temp">Temperature</option></select>
 <input aria-label="Known calibration reference" type="number" step="any" required value={reference} onChange={e=>setReference(e.target.value)}/><button className="ui-btn ui-btn--primary">{mode==='HARDWARE'?'Capture reference':'Capture offset'}</button></form><p role="status">{notice}</p></div>
 </div>;
};
