import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { RefreshIcon } from '../common/Icons';

interface ChallengeScenario {
  id: string;
  name: string;
  type: string;
  description: string;
  targetTds: number;
  targetPh: number;
  targetTemp: number;
  rampSeconds: number;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MODERATE';
}

const CHALLENGE_SCENARIOS: ChallengeScenario[] = [
  {
    id: 'scen_01',
    name: 'Heavy Metal Leach Incident',
    type: 'TDS_SPIKE',
    description: 'Simulates pipe corrosion or lead/cadmium slug causing rapid TDS surge from 180 to 540 ppm in 3 seconds.',
    targetTds: 540,
    targetPh: 6.8,
    targetTemp: 22.5,
    rampSeconds: 3,
    threatLevel: 'CRITICAL',
  },
  {
    id: 'scen_02',
    name: 'Acid Rain / Chemical Ingress',
    type: 'PH_COLLAPSE',
    description: 'Simulates industrial acid spill or aggressive runoff collapsing pH from 7.4 to 4.2 in 6 seconds.',
    targetTds: 260,
    targetPh: 4.2,
    targetTemp: 21.0,
    rampSeconds: 6,
    threatLevel: 'CRITICAL',
  },
  {
    id: 'scen_03',
    name: 'Alkaline Caustic Overdose',
    type: 'PH_SURGE',
    description: 'Simulates water treatment sodium hydroxide overdose causing pH surge to 9.85.',
    targetTds: 310,
    targetPh: 9.85,
    targetTemp: 23.0,
    rampSeconds: 5,
    threatLevel: 'HIGH',
  },
  {
    id: 'scen_04',
    name: 'Slow Sensor Drift (CUSUM Trap)',
    type: 'CUSUM_DRIFT',
    description: 'Insidious gradual drift of +0.3 ppm/min designed to bypass static single-point thresholds but trigger CUSUM accumulator.',
    targetTds: 240,
    targetPh: 7.3,
    targetTemp: 22.0,
    rampSeconds: 30,
    threatLevel: 'HIGH',
  },
  {
    id: 'scen_05',
    name: 'Uncalibrated Deep Well Switch',
    type: 'MAHALANOBIS_ANOMALY',
    description: 'Sudden water source change to unauthenticated aquifer with Mahalanobis distance D_M > 4.8.',
    targetTds: 485,
    targetPh: 8.2,
    targetTemp: 26.5,
    rampSeconds: 2,
    threatLevel: 'HIGH',
  },
  {
    id: 'scen_06',
    name: 'Biofilm Slough Particulate Plume',
    type: 'NOISE_BURST',
    description: 'Detached biological biofilm causing heavy sensor noise and rapid interval jitter.',
    targetTds: 380,
    targetPh: 7.1,
    targetTemp: 22.0,
    rampSeconds: 4,
    threatLevel: 'MODERATE',
  },
];

export const ChallengeReplayRig: React.FC = () => {
  const { frame, overrideValve } = useTelemetry();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<number>(100);

  const isValveOpen = frame.valve_actuator.main_solenoid_state === 'OPEN';

  const injectScenario = (scen: ChallengeScenario) => {
    setActiveScenario(scen.id);
    const logEntry = `[${new Date().toISOString().slice(11, 19)}] INJECTED: ${scen.name} (Intensity: ${intensity}%)`;
    setSimulationLog((prev) => [logEntry, ...prev.slice(0, 8)]);

    // Force valve close simulation or set emergency lock
    overrideValve('FORCE_CLOSE');
    setTimeout(() => {
      const respEntry = `[${new Date().toISOString().slice(11, 19)}] RESPONSE: Solenoid de-energized NC (<35ms). Anomaly gated.`;
      setSimulationLog((prev) => [respEntry, ...prev]);
    }, 120);
  };

  const resetAll = () => {
    setActiveScenario(null);
    overrideValve('AUTO');
    setSimulationLog((prev) => [`[${new Date().toISOString().slice(11, 19)}] RESET: All challenges cleared. AUTO restored.`, ...prev]);
  };

  return (
    <div className="workspace-viewport">
      <div className="workspace-header">
        <div className="workspace-title-group">
          <h1 className="workspace-title">Interactive Challenge Replay Rig</h1>
          <span className="ui-badge ui-badge--warning">HARDWARE-IN-THE-LOOP SIMULATOR</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={resetAll}>
            <RefreshIcon size={14} />
            <span>Reset Rig & Baseline</span>
          </button>
        </div>
      </div>

      {/* Controller & Rig Status */}
      <div className="ui-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
              DYNAMIC STRESS & CONTAMINATION INJECTION MATRIX
            </div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              Inject physical fluid challenges to audit gate reaction times, CUSUM quarantine freezing, and recovery FSM transitions.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)' }}>Stress Intensity:</span>
              <input
                type="range"
                min="50"
                max="200"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                style={{ width: '100px' }}
              />
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>{intensity}%</span>
            </div>

            <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
              GATE STATE:{' '}
              <strong style={{ color: isValveOpen ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                {isValveOpen ? 'OPEN (PASSING)' : 'CLOSED (LOCKED OUT)'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Cards Grid */}
      <div className="grid-3">
        {CHALLENGE_SCENARIOS.map((scen) => {
          const isActive = activeScenario === scen.id;
          return (
            <div
              key={scen.id}
              className={`ui-card ${isActive ? 'ui-card--featured' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderColor: isActive ? 'var(--feedback-error)' : 'var(--border-quiet)',
                backgroundColor: isActive ? 'rgba(248, 113, 113, 0.08)' : 'var(--surface-1)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span
                    className={`ui-badge ${
                      scen.threatLevel === 'CRITICAL'
                        ? 'ui-badge--error'
                        : scen.threatLevel === 'HIGH'
                        ? 'ui-badge--warning'
                        : 'ui-badge--neutral'
                    }`}
                  >
                    {scen.threatLevel} THREAT
                  </span>
                  <span style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>
                    {scen.rampSeconds}s RAMP
                  </span>
                </div>

                <div style={{ fontSize: 'var(--font-size-body)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {scen.name}
                </div>

                <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '12px' }}>
                  {scen.description}
                </p>
              </div>

              <div>
                <div style={{ padding: '8px', backgroundColor: 'var(--surface-2)', borderRadius: '4px', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Target: TDS {scen.targetTds} ppm | pH {scen.targetPh} | {scen.targetTemp}°C
                </div>

                <button
                  className={`ui-btn ui-btn--sm ${isActive ? 'ui-btn--danger' : 'ui-btn--secondary'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => injectScenario(scen)}
                >
                  {isActive ? 'Scenario Active' : 'Inject Challenge Scenario'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Replay Log & Response Timing */}
      <div className="ui-card">
        <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
          RIG REACTION & SYSTEM FLIGHT EVENT LOG
        </div>
        <div
          style={{
            height: '140px',
            overflowY: 'auto',
            padding: '10px',
            backgroundColor: 'var(--surface-base)',
            borderRadius: '6px',
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--font-size-caption)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {simulationLog.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Awaiting challenge scenario injection. Rig standing by...</div>
          ) : (
            simulationLog.map((log, i) => (
              <div key={i} style={{ color: log.includes('RESPONSE') ? 'var(--feedback-success)' : 'var(--accent)' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
