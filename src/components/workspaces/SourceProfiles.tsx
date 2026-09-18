import React,{useState} from 'react';
import {useTelemetry} from '../../context/TelemetryContext';
import {SOURCE_PROFILES} from '../../services/engineMath';
import type {Profile} from '../../services/controller';
export const SourceProfiles:React.FC=()=>{
 const {frame,setSourceProfile}=useTelemetry();const [notice,setNotice]=useState('');const p=frame.source_profile;
 const choose=async(profile:Profile|'UNKNOWN')=>{try{setNotice(await setSourceProfile(profile));}catch(e){setNotice(String(e));}};
 return <div className="workspace-viewport"><div className="workspace-header"><h1 className="workspace-title">Water-source profiles</h1><span className={`ui-badge ${p.unknown_source_locked?'ui-badge--error':'ui-badge--success'}`}>{p.active_profile}</span></div>
 <div className="ui-card"><p>Selected source: <strong>{p.active_source}</strong>. Normalized distance: {p.mahalanobis_distance.toFixed(2)}; match threshold: {p.threshold}.</p><p>Similarity score: {p.confidence_pct.toFixed(1)}% (heuristic, not a calibrated probability). Profiles describe resemblance, not proven origin or contaminant identity. The supplied profile values are demonstration priors; commission them against labelled samples.</p><p>Source changes close the gate and restart recovery. Each source has a separate qualified baseline. Unknown readings freeze learning and cannot authorize flow.</p><button className="ui-btn ui-btn--secondary" onClick={()=>choose('UNKNOWN')}>Lock as unknown source</button><p role="status">{notice}</p></div>
 <div className="grid-3">{Object.values(SOURCE_PROFILES).map(s=><div className="ui-card" key={s.name}><h3>{s.name}</h3><p>TDS: {s.mu_tds} ± {s.sigma_tds} ppm</p><p>pH: {s.mu_ph} ± {s.sigma_ph}</p><p>Temperature: {s.mu_temp} ± {s.sigma_temp} °C</p><p>Distance: {(s.name==='MUNICIPAL'?p.municipal_distance:s.name==='BOREWELL'?p.borewell_distance:p.rainwater_distance).toFixed(2)}</p><button className="ui-btn ui-btn--primary" onClick={()=>choose(s.name)}>Select labelled source</button></div>)}</div>
 <div className="ui-card"><p>Input contract: conductivity-derived TDS must already be temperature-compensated to the sensor calibration reference. The dashboard does not apply a second compensation. Borewell resemblance does not override the 800 ppm commissioning ceiling.</p></div></div>;
};
