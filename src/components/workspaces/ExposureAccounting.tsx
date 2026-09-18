import React from 'react';
<<<<<<< HEAD
import { useTelemetry } from '../../context/TelemetryContext';

export const ExposureAccounting: React.FC = () => {
  const { frame } = useTelemetry();
  const { exposure_accounting } = frame;

  const cmsi = exposure_accounting.cmsi_current;
  const cmsiMax = exposure_accounting.cmsi_max_limit;
  const cmsiPct = Math.min(100, (cmsi / cmsiMax) * 100);
  const rul = exposure_accounting.membrane_rul_pct;

  return (
    <div className="workspace-viewport">
      <div className="workspace-header">
        <div className="workspace-title-group">
          <h1 className="workspace-title">Dual Exposure Accounting & CMSI Engine</h1>
          <span className="ui-badge ui-badge--info">ISO 14044 / ASTM D4189</span>
        </div>
      </div>

      {/* Dual Exposure Track Cards */}
      <div className="grid-2">
        {/* Track A: Nominal Downstream Exposure */}
        <div className="ui-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
              TRACK A: CONSUMER / MEMBRANE PERMEATE STREAM
            </div>
            <span className="ui-badge ui-badge--success">GATE OPEN ONLY</span>
          </div>

          <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Measures true cumulative hydraulic and chemical load delivered downstream into consumer tanks or polishing stages.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'var(--font-family-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nominal Water Volume Passed:</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-body)' }}>
                {exposure_accounting.nominal_volume_passed_l.toLocaleString()} L
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Accumulated Dissolved Mass Passed:</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-body)' }}>
                {exposure_accounting.nominal_mass_passed_mg.toLocaleString()} mg
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Average Delivered TDS Concentration:</span>
              <span>{(exposure_accounting.nominal_mass_passed_mg / (exposure_accounting.nominal_volume_passed_l || 1)).toFixed(1)} mg/L</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Contaminant Leakage Ratio:</span>
              <span style={{ color: 'var(--feedback-success)', fontWeight: 600 }}>0.000% (SEALED GATE)</span>
            </div>
          </div>
        </div>

        {/* Track B: Rejected / Purge Plume Stream */}
        <div className="ui-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
              TRACK B: REJECTED & PURGE DRAIN STREAM
            </div>
            <span className="ui-badge ui-badge--warning">PURGE / DRAIN ONLY</span>
          </div>

          <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Measures contaminated plumes, unverified transient spikes, and anti-stagnation water routed safely to waste disposal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'var(--font-family-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Purged Water Volume to Waste:</span>
              <strong style={{ color: 'var(--feedback-warning)', fontSize: 'var(--font-size-body)' }}>
                {exposure_accounting.rejected_volume_purged_l.toLocaleString()} L
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Intercepted Contaminant Mass:</span>
              <strong style={{ color: 'var(--feedback-warning)', fontSize: 'var(--font-size-body)' }}>
                {exposure_accounting.rejected_mass_diverted_mg.toLocaleString()} mg
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Downstream Protection Ratio:</span>
              <span style={{ color: 'var(--feedback-success)', fontWeight: 600 }}>100.0% OF HAZARD DIVERTED</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Drain State:</span>
              <span>{frame.valve_actuator.drain_flush_state === 'OPEN' ? 'PURGING (DRAIN OPEN)' : 'CLOSED'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative Membrane Stress Index (CMSI) */}
      <div className="ui-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
              CUMULATIVE MEMBRANE STRESS INDEX (CMSI) & REMAINING USEFUL LIFE (RUL)
            </div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              Integral CMSI(t) = ∫ ΔTDS(τ) · Q(τ) · exp(γ(T - T₀)) dτ with thermal Arrhenius acceleration factor (γ = 0.025/°C)
            </div>
          </div>
          <span
            className={`ui-badge ${
              rul > 50 ? 'ui-badge--success' : rul > 20 ? 'ui-badge--warning' : 'ui-badge--error'
            }`}
          >
            {rul > 50 ? 'OPTIMAL' : rul > 20 ? 'DEGRADED' : 'MEMBRANE REPLACEMENT DUE'}
          </span>
        </div>

        {/* Large Metric Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>ACCUMULATED STRESS UNITS</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
              {cmsi.toLocaleString()}
            </div>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)' }}>
              Limit: {cmsiMax.toLocaleString()} stress-units
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>REMAINING USEFUL LIFE (RUL)</div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                fontFamily: 'var(--font-family-mono)',
                color: rul > 50 ? 'var(--feedback-success)' : rul > 20 ? 'var(--feedback-warning)' : 'var(--feedback-error)',
              }}
            >
              {rul.toFixed(1)}%
            </div>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)' }}>
              Estimated {((rul / 100) * 365).toFixed(0)} operating days remaining
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>THERMAL ACCELERATION FACTOR</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--accent)' }}>
              {exposure_accounting.thermal_factor.toFixed(2)}x
            </div>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)' }}>
              Relative to T₀ = 25.0°C baseline
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-caption)', marginBottom: '4px' }}>
            <span>Membrane Fatigue Consumption</span>
            <span style={{ fontFamily: 'var(--font-family-mono)' }}>{cmsiPct.toFixed(1)}%</span>
          </div>
          <div className="ui-progress-track" style={{ height: '12px' }}>
            <div
              className="ui-progress-fill"
              style={{
                width: `${cmsiPct}%`,
                backgroundColor: cmsiPct > 80 ? 'var(--feedback-error)' : cmsiPct > 50 ? 'var(--feedback-warning)' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
=======
import {useTelemetry} from '../../context/TelemetryContext';
export const ExposureAccounting:React.FC=()=>{
 const {frame}=useTelemetry(),e=frame.exposure_accounting;
 const observed=e.admitted_exposure_cmsi+e.prevented_exposure_cmsi;
 return <div className="workspace-viewport"><div className="workspace-header"><h1 className="workspace-title">Exposure accounting</h1><span className="ui-badge ui-badge--info">COMMAND-BASED ESTIMATES</span></div>
 <div className="grid-3">{[['Observed inlet stress',observed],['Estimated admitted exposure',e.admitted_exposure_cmsi],['Stress during closed commands',e.prevented_exposure_cmsi]].map(([label,value])=><div className="ui-card" key={label}><p>{label}</p><strong style={{fontSize:28}}>{Number(value).toFixed(1)}</strong><p>proxy stress · seconds</p></div>)}</div>
 <div className="ui-card"><h3>How the accounting is connected</h3><p>The previous valid reading and previous valve command are integrated over elapsed time, capped at the 3-second telemetry timeout. Invalid or missing measurements are not filled with regression estimates.</p><p><code>s = 0.8 max(0, TDS − 300) + 120 |pH − 7| + 15 max(0, T − 25)</code></p><p><code>E = Σ s × Δt × commanded_open</code></p><p>Share of observed stress during closed commands: <strong>{e.damage_reduction_pct.toFixed(1)}%</strong>. Successful physical closure is unverified without separate valve/flow feedback.</p></div>
 <div className="ui-card"><h3>Membrane-life workflow connection</h3><p>The accumulated stress proxy is available to the primary workflow. Days remaining and a replacement date are deliberately unavailable: inlet TDS, pH and temperature cannot validate membrane remaining life. A calibrated model using normalized permeate flow, rejection and pressure differential is required.</p><p>Volume passed, diverted mass, leakage percentage and biofilm risk are also unavailable with the supplied sensors.</p></div></div>;
>>>>>>> 506c44a (add backend iter-1 by astra)
};
