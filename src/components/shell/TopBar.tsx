import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeIcon } from '../common/Icons';

export const TopBar: React.FC = () => {
  const { frame } = useTelemetry();
  const { theme, toggleThemeModal } = useTheme();

  // Format uptime (e.g. 3d 14h 22m)
  const days = Math.floor(frame.uptime_seconds / 86400);
  const hours = Math.floor((frame.uptime_seconds % 86400) / 3600);
  const minutes = Math.floor((frame.uptime_seconds % 3600) / 60);
  const uptimeStr = `${days}d ${hours}h ${minutes}m`;

  // Determine State Pill styling & label
  let statePillClass = 'ui-badge--success';
  let stateDotClass = 'status-dot--success';
  let stateLabel = 'GATE OPEN (SAFE)';

  if (frame.valve_actuator.emergency_override_active) {
    statePillClass = 'ui-badge--error';
    stateDotClass = 'status-dot--error status-dot--pulsing';
    stateLabel = `EMERGENCY OVERRIDE (${Math.floor(frame.valve_actuator.emergency_time_remaining_secs / 60)}m)`;
  } else if (frame.valve_actuator.drain_flush_state === 'OPEN') {
    statePillClass = 'ui-badge--info';
    stateDotClass = 'status-dot--info status-dot--pulsing';
    stateLabel = 'AUTO-FLUSHING TO DRAIN';
  } else if (frame.fsm_recovery.current_state === 'BLOCKED') {
    statePillClass = 'ui-badge--error';
    stateDotClass = 'status-dot--error';
    stateLabel = 'GATE BLOCKED (CONTAMINATION)';
  } else if (frame.fsm_recovery.current_state === 'RECOVERY_CHECK') {
    statePillClass = 'ui-badge--warning';
    stateDotClass = 'status-dot--warning status-dot--pulsing';
    stateLabel = `RECOVERY CHECK (${frame.fsm_recovery.recovery_timer_seconds}s)`;
  } else if (frame.valve_actuator.blockage_reason === 'UNCERTAINTY_OVERLAP') {
    statePillClass = 'ui-badge--warning';
    stateDotClass = 'status-dot--warning status-dot--pulsing';
    stateLabel = 'HOLD: UNCERTAINTY OVERLAP';
  }

  const learningActive = !frame.quarantine_engine.learning_frozen;

  return (
    <header className="top-bar">
      {/* Left: Brand & Operating Status */}
      <div className="top-bar__left">
        <div className="top-bar__brand">
          <span>OKEANOS</span>
          <span className="top-bar__brand-badge">EDGE v1.0</span>
        </div>

        {/* Operating State Pill */}
        <div className={`ui-badge ${statePillClass}`} style={{ fontWeight: 600, padding: '3px 10px' }}>
          <span className={`status-dot ${stateDotClass}`} />
          <span>{stateLabel}</span>
        </div>

        {/* Learning Engine Status Badge */}
        <div
          className={`ui-badge ${learningActive ? 'ui-badge--default' : 'ui-badge--warning'}`}
          style={{ fontSize: 'var(--font-size-2xs)' }}
        >
          <span>{learningActive ? 'LEARNING: ACTIVE' : 'LEARNING: QUARANTINE FREEZE'}</span>
        </div>
      </div>

      {/* Center: Global Uncertainty Telemetry Strip */}
      <div className="top-bar__center">
        <div className="top-bar__telemetry">
          <span className="top-bar__telemetry-item">
            TDS: <strong>{frame.telemetry.tds.value.toFixed(1)}</strong> ± {frame.telemetry.tds.uncertainty.toFixed(1)} ppm
          </span>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <span className="top-bar__telemetry-item">
            pH: <strong>{frame.telemetry.ph.value.toFixed(2)}</strong> ± {frame.telemetry.ph.uncertainty.toFixed(2)}
          </span>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <span className="top-bar__telemetry-item">
            T: <strong>{frame.telemetry.temp.value.toFixed(1)}</strong> ± {frame.telemetry.temp.uncertainty.toFixed(2)} °C
          </span>
        </div>
      </div>

      {/* Right: Source Pill, Uptime & Theme Control Trigger */}
      <div className="top-bar__right">
        {/* Source Profile Pill */}
        <div
          className={`ui-badge ${frame.source_profile.unknown_source_locked ? 'ui-badge--error' : 'ui-badge--default'}`}
          style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-2xs)' }}
        >
          <span>SRC: {frame.source_profile.active_profile}</span>
        </div>

        {/* Live Clock & Uptime */}
        <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
          UP: {uptimeStr}
        </div>

        {/* Theme Control Button */}
        <button
          className="ui-btn ui-btn--secondary ui-btn--sm"
          onClick={toggleThemeModal}
          title="Open Theme & Display Settings (Ctrl+T)"
          style={{ gap: '6px' }}
        >
          <ThemeIcon size={14} />
          <span style={{ textTransform: 'capitalize', fontSize: 'var(--font-size-2xs)' }}>{theme}</span>
          <kbd style={{ fontSize: '9px', padding: '0 3px' }}>Ctrl+T</kbd>
        </button>
      </div>
    </header>
  );
};
