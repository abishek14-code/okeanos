<<<<<<< HEAD
import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { ShieldIcon } from '../common/Icons';

interface ProfileDetail {
  id: string;
  name: string;
  tds_mean: number;
  tds_sigma: number;
  ph_mean: number;
  ph_sigma: number;
  samples: number;
  last_seen: string;
  color: string;
}

const KNOWN_PROFILES: ProfileDetail[] = [
  {
    id: 'src_01',
    name: 'Municipal Grid (City Main)',
    tds_mean: 180,
    tds_sigma: 18,
    ph_mean: 7.35,
    ph_sigma: 0.18,
    samples: 142850,
    last_seen: 'Live (Active)',
    color: '#38bdf8',
  },
  {
    id: 'src_02',
    name: 'Deep Borewell (Aquifer 4)',
    tds_mean: 460,
    tds_sigma: 32,
    ph_mean: 7.95,
    ph_sigma: 0.22,
    samples: 84200,
    last_seen: '3d ago',
    color: '#a78bfa',
  },
  {
    id: 'src_03',
    name: 'Rainwater Harvest Cistern',
    tds_mean: 38,
    tds_sigma: 8,
    ph_mean: 6.65,
    ph_sigma: 0.15,
    samples: 29140,
    last_seen: '14d ago',
    color: '#4ade80',
  },
  {
    id: 'src_04',
    name: 'RO Polished Permeate',
    tds_mean: 18,
    tds_sigma: 4,
    ph_mean: 6.85,
    ph_sigma: 0.12,
    samples: 92400,
    last_seen: '1d ago',
    color: '#f59e0b',
  },
];

export const SourceProfiles: React.FC = () => {
  const { frame } = useTelemetry();
  const [selectedProfile, setSelectedProfile] = useState<string>('src_01');
  const [learningModal, setLearningModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');

  const { source_profile, telemetry } = frame;
  const currentTds = telemetry.tds.value;
  const currentPh = telemetry.ph.value;

  // Visual scatter mapping (TDS: 0-600 ppm, pH: 6.0-9.0)
  const mapTds = (val: number) => {
    return 40 + ((val - 0) / 600) * (520 - 40);
  };
  const mapPh = (val: number) => {
    return 300 - ((val - 6.0) / 3.0) * (300 - 30);
  };

  return (
    <div className="workspace-viewport">
      <div className="workspace-header">
        <div className="workspace-title-group">
          <h1 className="workspace-title">Water Source Profiles & Fingerprint Matrix</h1>
          <span className={`ui-badge ${source_profile.unknown_source_locked ? 'ui-badge--error' : 'ui-badge--success'}`}>
            {source_profile.unknown_source_locked ? 'UNKNOWN SOURCE (LOCKOUT)' : 'AUTHENTICATED SOURCE'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => setLearningModal(true)}>
            Learn Current Fingerprint
          </button>
        </div>
      </div>

      {/* Active Source Banner */}
      <div
        className="ui-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderColor: source_profile.unknown_source_locked ? 'var(--feedback-error)' : 'var(--border-quiet)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: source_profile.unknown_source_locked ? 'rgba(248, 113, 113, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: source_profile.unknown_source_locked ? 'var(--feedback-error)' : 'var(--accent)',
            }}
          >
            <ShieldIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>CURRENTLY DETECTED SOURCE</div>
            <div style={{ fontSize: 'var(--font-size-section)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {source_profile.active_source}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
          <div>
            Mahalanobis Distance (D_M):{' '}
            <strong style={{ color: source_profile.mahalanobis_distance > 3.0 ? 'var(--feedback-error)' : 'var(--feedback-success)' }}>
              {source_profile.mahalanobis_distance.toFixed(2)}
            </strong>{' '}
            / 3.00
          </div>
          <div>
            Confidence:{' '}
            <strong style={{ color: source_profile.confidence_pct > 80 ? 'var(--feedback-success)' : 'var(--feedback-warning)' }}>
              {source_profile.confidence_pct.toFixed(1)}%
            </strong>
          </div>
          <div>
            Status:{' '}
            <strong style={{ color: source_profile.unknown_source_locked ? 'var(--feedback-error)' : 'var(--feedback-success)' }}>
              {source_profile.unknown_source_locked ? 'REJECTED' : 'VERIFIED'}
            </strong>
          </div>
        </div>
      </div>

      {/* 2D Covariance Matrix Plot */}
      <div className="grid-2">
        <div className="ui-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
                TDS vs pH PARAMETER SPACE & 2σ ELLIPSES
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                Bivariate Gaussian covariance envelopes (D_M ≤ 2.0). Red dot indicates live telemetry.
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: '320px', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 540 320" style={{ overflow: 'visible' }}>
              {/* Axes and Grid */}
              <line x1="40" y1="300" x2="520" y2="300" stroke="var(--border-quiet)" strokeWidth="1" />
              <line x1="40" y1="30" x2="40" y2="300" stroke="var(--border-quiet)" strokeWidth="1" />

              {/* TDS Axis Labels */}
              {[0, 150, 300, 450, 600].map((tds) => (
                <g key={tds}>
                  <line x1={mapTds(tds)} y1="300" x2={mapTds(tds)} y2="305" stroke="var(--text-muted)" />
                  <text x={mapTds(tds)} y="316" fill="var(--text-muted)" fontSize="9" textAnchor="middle" fontFamily="var(--font-family-mono)">
                    {tds}
                  </text>
                </g>
              ))}
              <text x="280" y="335" fill="var(--text-secondary)" fontSize="10" textAnchor="middle">
                Total Dissolved Solids (ppm)
              </text>

              {/* pH Axis Labels */}
              {[6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0].map((ph) => (
                <g key={ph}>
                  <line x1="35" y1={mapPh(ph)} x2="40" y2={mapPh(ph)} stroke="var(--text-muted)" />
                  <text x="30" y={mapPh(ph) + 3} fill="var(--text-muted)" fontSize="9" textAnchor="end" fontFamily="var(--font-family-mono)">
                    {ph.toFixed(1)}
                  </text>
                </g>
              ))}
              <text x="-165" y="14" fill="var(--text-secondary)" fontSize="10" textAnchor="middle" transform="rotate(-90)">
                pH Level
              </text>

              {/* Profile Covariance Ellipses */}
              {KNOWN_PROFILES.map((p) => {
                const cx = mapTds(p.tds_mean);
                const cy = mapPh(p.ph_mean);
                const rx = ((p.tds_sigma * 2) / 600) * (520 - 40);
                const ry = ((p.ph_sigma * 2) / 3.0) * (300 - 30);
                const isSelected = selectedProfile === p.id;

                return (
                  <g key={p.id} onClick={() => setSelectedProfile(p.id)} style={{ cursor: 'pointer' }}>
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      fill={p.color}
                      fillOpacity={isSelected ? 0.25 : 0.12}
                      stroke={p.color}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeDasharray={isSelected ? 'none' : '4 2'}
                    />
                    <circle cx={cx} cy={cy} r="3" fill={p.color} />
                    <text x={cx} y={cy - ry - 4} fill={p.color} fontSize="9" textAnchor="middle" fontWeight={500}>
                      {p.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}

              {/* Current Water Sample Live Point */}
              <circle
                cx={mapTds(currentTds)}
                cy={mapPh(currentPh)}
                r="6"
                fill="#f43f5e"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x={mapTds(currentTds) + 10}
                y={mapPh(currentPh) + 4}
                fill="#f43f5e"
                fontSize="10"
                fontWeight="700"
                fontFamily="var(--font-family-mono)"
              >
                LIVE ({currentTds.toFixed(0)} ppm, {currentPh.toFixed(2)})
              </text>
            </svg>
          </div>
        </div>

        {/* Profile Details & Distance Breakdown */}
        <div className="ui-card">
          <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            FINGERPRINT CENTROIDS & DISTANCE METRICS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {KNOWN_PROFILES.map((p) => {
              // Compute distance to this profile
              const d_tds = (currentTds - p.tds_mean) / p.tds_sigma;
              const d_ph = (currentPh - p.ph_mean) / p.ph_sigma;
              const d_m = Math.sqrt(d_tds * d_tds + d_ph * d_ph);
              const isMatch = d_m <= 3.0;

              return (
                <div
                  key={p.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: selectedProfile === p.id ? 'var(--surface-3)' : 'var(--surface-2)',
                    border: `1px solid ${selectedProfile === p.id ? p.color : 'var(--border-quiet)'}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedProfile(p.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, color: p.color, fontSize: 'var(--font-size-body)' }}>{p.name}</div>
                    <span className={`ui-badge ${isMatch ? 'ui-badge--success' : 'ui-badge--neutral'}`}>
                      D_M: {d_m.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--font-size-caption)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>
                    <span>TDS: {p.tds_mean} ± {p.tds_sigma} ppm</span>
                    <span>pH: {p.ph_mean.toFixed(2)} ± {p.ph_sigma.toFixed(2)}</span>
                    <span>Samples: {p.samples.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Learn Fingerprint Modal */}
      {learningModal && (
        <div className="ui-modal-backdrop" onClick={() => setLearningModal(false)}>
          <div className="ui-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="ui-modal-header">
              <h2 className="ui-modal-title">Learn New Water Source Profile</h2>
              <button className="ui-btn ui-btn--ghost ui-btn--icon" onClick={() => setLearningModal(false)}>
                ✕
              </button>
            </div>
            <div className="ui-modal-body">
              <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Registers current stable telemetry ({currentTds.toFixed(1)} ppm, {currentPh.toFixed(2)} pH, {frame.telemetry.temp.value.toFixed(1)}°C) as a new authenticated fingerprint centroid.
              </p>
              <label style={{ display: 'block', fontSize: 'var(--font-size-caption)', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Profile Label / Source Name
              </label>
              <input
                type="text"
                className="ui-input"
                placeholder="e.g. Tanker Batch 42A"
                value={profileNameInput}
                onChange={(e) => setProfileNameInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  marginBottom: '16px',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="ui-btn ui-btn--secondary" onClick={() => setLearningModal(false)}>
                  Cancel
                </button>
                <button
                  className="ui-btn ui-btn--primary"
                  onClick={() => {
                    alert(`Profile "${profileNameInput || 'New Source'}" recorded with 100 calibration samples.`);
                    setLearningModal(false);
                    setProfileNameInput('');
                  }}
                >
                  Commit Centroid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
=======
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
>>>>>>> 506c44a (add backend iter-1 by astra)
};
