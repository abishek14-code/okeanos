import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { PurgeIcon } from '../common/Icons';

interface FSMStateInfo {
  state: string;
  label: string;
  description: string;
  dwell: string;
  exitCriteria: string;
}

const FSM_STATES: FSMStateInfo[] = [
  {
    state: 'NORMAL_FLOW',
    label: '1. NORMAL FLOW',
    description: 'Continuous monitoring. Gating AND condition satisfied. Solenoid energized (OPEN).',
    dwell: 'Continuous',
    exitCriteria: 'Any parameter interval breaches limits or D_M > 3.0',
  },
  {
    state: 'ANOMALY_LOCKOUT',
    label: '2. ANOMALY LOCKOUT',
    description: 'Immediate fail-safe closure (<35ms). Alarm dispatched. Learning buffer frozen.',
    dwell: 'Immediate',
    exitCriteria: 'System dispatches flush command or operator triggers purge',
  },
  {
    state: 'PURGE_ACTIVE',
    label: '3. CHAMBER PURGE',
    description: 'Chamber drain valve opened. 3.0 chamber volumes purged to clear contaminant plume.',
    dwell: '15.0 s countdown',
    exitCriteria: 'Timer expires AND drain valve verifies closed',
  },
  {
    state: 'SENSOR_SETTLING',
    label: '4. SENSOR SETTLING',
    description: 'Awaiting hydrodynamic stabilization and probe boundary layer equilibration (3τ relaxation).',
    dwell: '10.0 s countdown',
    exitCriteria: 'dT/dt < 0.05°C/s and d(TDS)/dt < 1.0 ppm/s',
  },
  {
    state: 'RESIDUAL_HOLD',
    label: '5. RESIDUAL STABILITY',
    description: 'Validating consecutive stable readings. Verification of zero CUSUM drift.',
    dwell: '30.0 s verification',
    exitCriteria: '30 consecutive 1Hz samples inside safe interval with 95.4% confidence',
  },
  {
    state: 'GATE_RESTORED',
    label: '6. GATE RESTORATION',
    description: 'Metrological clearance verified. Solenoid energized open. Event logged to flight recorder.',
    dwell: 'Transition to 1',
    exitCriteria: 'Normal flow resumed',
  },
];

export const RecoveryFSM: React.FC = () => {
  const { frame, triggerPurge } = useTelemetry();
  const { recovery_fsm, anti_stagnation } = frame;
  const currentState = recovery_fsm.current_state;

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="workspace-viewport">
      <div className="workspace-header">
        <div className="workspace-title-group">
          <h1 className="workspace-title">Recovery Verification FSM & Anti-Stagnation</h1>
          <span className="ui-badge ui-badge--info">State: {currentState}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="ui-btn ui-btn--secondary ui-btn--sm"
            onClick={() => triggerPurge(15)}
            disabled={currentState === 'PURGE_ACTIVE'}
          >
            <PurgeIcon size={14} />
            <span>Force Purge Cycle</span>
          </button>
        </div>
      </div>

      {/* FSM State Flow Pipeline */}
      <div className="ui-card">
        <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
          RECOVERY VERIFICATION STATE MACHINE PIPELINE
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          {FSM_STATES.map((fsm, idx) => {
            const isActive = currentState === fsm.state;
            const isPurgeOrLockout = fsm.state === 'ANOMALY_LOCKOUT' || fsm.state === 'PURGE_ACTIVE';

            return (
              <div
                key={fsm.state}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: isActive
                    ? isPurgeOrLockout
                      ? 'rgba(248, 113, 113, 0.15)'
                      : 'rgba(56, 189, 248, 0.15)'
                    : 'var(--surface-2)',
                  border: `1px solid ${
                    isActive
                      ? isPurgeOrLockout
                        ? 'var(--feedback-error)'
                        : 'var(--accent)'
                      : 'var(--border-quiet)'
                  }`,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: 'var(--font-size-2xs)',
                      fontWeight: 700,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    STEP 0{idx + 1}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isPurgeOrLockout ? 'var(--feedback-error)' : 'var(--accent)',
                        boxShadow: `0 0 8px ${isPurgeOrLockout ? 'var(--feedback-error)' : 'var(--accent)'}`,
                      }}
                    />
                  )}
                </div>

                <div
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    fontWeight: 600,
                    color: isActive ? (isPurgeOrLockout ? 'var(--feedback-error)' : 'var(--accent)') : 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  {fsm.label}
                </div>

                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '8px' }}>
                  {fsm.description}
                </div>

                <div style={{ fontSize: '9px', fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
                  Dwell: <strong>{fsm.dwell}</strong>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live FSM Telemetry Strip */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'var(--surface-2)',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--font-size-caption)',
          }}
        >
          <div>
            Time in Current State: <strong>{recovery_fsm.time_in_state_s.toFixed(1)}s</strong>
          </div>
          <div>
            Purge Countdown: <strong>{recovery_fsm.purge_countdown_s.toFixed(1)}s</strong>
          </div>
          <div>
            Settling Time Remaining: <strong>{recovery_fsm.settling_countdown_s.toFixed(1)}s</strong>
          </div>
          <div>
            Consecutive Pass Samples:{' '}
            <strong style={{ color: 'var(--feedback-success)' }}>
              {recovery_fsm.consecutive_pass_samples} / {recovery_fsm.required_pass_samples}
            </strong>
          </div>
        </div>
      </div>

      {/* Anti-Stagnation Architecture */}
      <div className="grid-2">
        <div className="ui-card">
          <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            ANTI-STAGNATION MONITOR (4-HOUR CYCLE)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)' }}>Time Until Scheduled Purge:</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
                {formatTime(anti_stagnation.time_until_purge_s)}
              </span>
            </div>

            <div className="ui-progress-track" style={{ height: '8px' }}>
              <div
                className="ui-progress-fill"
                style={{
                  width: `${( (14400 - anti_stagnation.time_until_purge_s) / 14400 ) * 100}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-caption)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>
              <span>Chamber Water Age: {((14400 - anti_stagnation.time_until_purge_s) / 60).toFixed(0)} min</span>
              <span>Next Run: In {(anti_stagnation.time_until_purge_s / 60).toFixed(0)} min</span>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            CHAMBER WATER QUALITY METRICS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-caption)', marginBottom: '4px' }}>
                <span>Biofilm Risk Index</span>
                <span style={{ fontFamily: 'var(--font-family-mono)', color: anti_stagnation.biofilm_risk_pct > 50 ? 'var(--feedback-warning)' : 'var(--feedback-success)' }}>
                  {anti_stagnation.biofilm_risk_pct.toFixed(1)}%
                </span>
              </div>
              <div className="ui-progress-track">
                <div
                  className="ui-progress-fill"
                  style={{
                    width: `${anti_stagnation.biofilm_risk_pct}%`,
                    backgroundColor: anti_stagnation.biofilm_risk_pct > 50 ? 'var(--feedback-warning)' : 'var(--feedback-success)',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-caption)', marginBottom: '4px' }}>
                <span>Dissolved Gas Outgassing Risk</span>
                <span style={{ fontFamily: 'var(--font-family-mono)', color: anti_stagnation.outgassing_risk_pct > 50 ? 'var(--feedback-warning)' : 'var(--feedback-success)' }}>
                  {anti_stagnation.outgassing_risk_pct.toFixed(1)}%
                </span>
              </div>
              <div className="ui-progress-track">
                <div
                  className="ui-progress-fill"
                  style={{
                    width: `${anti_stagnation.outgassing_risk_pct}%`,
                    backgroundColor: anti_stagnation.outgassing_risk_pct > 50 ? 'var(--feedback-warning)' : 'var(--feedback-success)',
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              Auto-purge dispatches 15s pressurized flush if water age exceeds 4h or biofilm risk exceeds 60%.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
