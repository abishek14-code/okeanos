import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { Workflow } from './Workflow';
import { PurgeIcon, ValveClosedIcon, ValveOpenIcon, CheckIcon, WarningIcon } from '../common/Icons';

export const CommandCenter: React.FC = () => {
  const { frame, oscilloscopeHistory, triggerPurge, overrideValve, config, diagnostics, connected, saveConfig } = useTelemetry();
  const [activeParam, setActiveParam] = useState<'tds' | 'ph' | 'temp'>('tds');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { tds, ph, temp } = frame.telemetry;
  const isValveOpen = frame.valve_actuator.main_solenoid_state === 'OPEN';
  const isDrainOpen = frame.valve_actuator.drain_flush_state === 'OPEN';
  const isFrozen = frame.quarantine_engine.learning_frozen;

  const notify = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handlePurge = async () => {
    setPurgeBusy(true);
    try {
      const res = await triggerPurge(15);
      notify(res || 'Chamber purge initiated (15s)');
    } catch (e) {
      notify(String(e));
    } finally {
      setPurgeBusy(false);
    }
  };

  const handleOverride = async (targetMode: 'FORCE_CLOSE' | 'AUTO' | 'FORCE_OPEN') => {
    try {
      const res = await overrideValve(targetMode);
      notify(res || `Operating mode set to ${targetMode}`);
    } catch (e) {
      notify(String(e));
    }
  };

  // Render SVG Oscilloscope
  const renderOscilloscope = () => {
    if (oscilloscopeHistory.length < 2) {
      return (
        <div style={{ height: '210px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          Collecting 60-second telemetry trace...
        </div>
      );
    }

    const width = 840;
    const height = 210;
    const padding = 24;

    const values = oscilloscopeHistory.map((d) => d[activeParam]);
    const uppers = oscilloscopeHistory.map((d) => (d as any)[`${activeParam}Upper`]);
    const lowers = oscilloscopeHistory.map((d) => (d as any)[`${activeParam}Lower`]);

    const minVal = Math.min(...lowers) * 0.98;
    const maxVal = Math.max(...uppers) * 1.02;
    const range = maxVal - minVal || 1;

    const getX = (idx: number) => padding + (idx / (oscilloscopeHistory.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - 2 * padding);

    let mainPath = '';
    let upperPath = '';
    let lowerPath = '';

    oscilloscopeHistory.forEach((_, i) => {
      const x = getX(i);
      const y = getY(values[i]);
      const yUp = getY(uppers[i]);
      const yLow = getY(lowers[i]);

      if (i === 0) {
        mainPath = `M ${x} ${y}`;
        upperPath = `M ${x} ${yUp}`;
        lowerPath = `L ${x} ${yLow}`;
      } else {
        mainPath += ` L ${x} ${y}`;
        upperPath += ` L ${x} ${yUp}`;
        lowerPath = ` L ${x} ${yLow}` + lowerPath;
      }
    });

    const envelopePath = upperPath + lowerPath + ' Z';

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* Horizontal grid lines */}
        {[0.2, 0.5, 0.8].map((pct) => {
          const y = height - padding - pct * (height - 2 * padding);
          const labelVal = (minVal + pct * range).toFixed(activeParam === 'ph' ? 2 : 1);
          return (
            <g key={pct}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border-quiet)" strokeDasharray="3 3" />
              <text x={padding - 6} y={y + 3.5} fill="var(--text-muted)" fontSize="10" textAnchor="end" fontFamily="var(--font-family-mono)">
                {labelVal}
              </text>
            </g>
          );
        })}

        {/* Shaded expanded uncertainty envelope */}
        <path d={envelopePath} fill="var(--accent-subtle)" opacity={0.6} />

        {/* Nominal Trace */}
        <path d={mainPath} fill="none" stroke="var(--accent)" strokeWidth={2} />

        {/* Active Point Indicator */}
        {oscilloscopeHistory.length > 0 && (
          <circle
            cx={getX(oscilloscopeHistory.length - 1)}
            cy={getY(values[values.length - 1])}
            r={4}
            fill="#ffffff"
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
        )}
      </svg>
    );
  };

  return (
    <div className="workspace-viewport">
      {/* 1. Page Header with Clean Title & Primary Actions */}
      <div className="workspace-header">
        <div className="workspace-title-group">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="workspace-title">Command Center</h1>
              <span className="ui-badge ui-badge--subtle" style={{ fontSize: '10px' }}>
                Workspace 01
              </span>
            </div>
            <p className="workspace-subtitle">Live control and system state</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {actionNotice && (
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-family-mono)', marginRight: '8px' }}>
              {actionNotice}
            </span>
          )}

          {/* Primary Action 1: Trigger Purge */}
          <button
            className="ui-btn ui-btn--secondary"
            onClick={handlePurge}
            disabled={!config.hasDrain || purgeBusy || isDrainOpen}
            title={!config.hasDrain ? 'Drain branch must be commissioned' : 'Flush sensor chamber for 15 seconds'}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
          >
            <PurgeIcon size={14} />
            <span>{purgeBusy ? 'Purging...' : 'Trigger Purge'}</span>
          </button>

          {/* Primary Action 2: Emergency Close (Destructive) / Restore Auto */}
          {isValveOpen ? (
            <button
              className="ui-btn ui-btn--danger"
              onClick={() => handleOverride('FORCE_CLOSE')}
              title="Immediately de-energize and latch main valve closed"
              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
            >
              <ValveClosedIcon size={14} />
              <span>Emergency Close</span>
            </button>
          ) : (
            <button
              className="ui-btn ui-btn--primary"
              onClick={() => handleOverride('AUTO')}
              title="Restore automatic gating permission"
              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
            >
              <ValveOpenIcon size={14} />
              <span>Restore Auto Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Compact Operational Status Strip */}
      <div className="status-strip">
        <div className="status-cell">
          <span className="status-cell__label">Main Valve</span>
          <div className="status-cell__value">
            <span className={`status-dot ${isValveOpen ? 'status-dot--success' : 'status-dot--error'}`} />
            <span>{isValveOpen ? 'OPEN' : 'CLOSED'}</span>
          </div>
        </div>

        <div className="status-cell">
          <span className="status-cell__label">Drain</span>
          <div className="status-cell__value">
            <span className={`status-dot ${isDrainOpen ? 'status-dot--active' : 'status-dot--neutral'}`} />
            <span>{isDrainOpen ? 'OPEN' : 'CLOSED'}</span>
          </div>
        </div>

        <div className="status-cell">
          <span className="status-cell__label">Control</span>
          <div className="status-cell__value">
            <span className="status-dot status-dot--active" />
            <span>{diagnostics.mode || 'AUTO'}</span>
          </div>
        </div>

        <div className="status-cell">
          <span className="status-cell__label">Source</span>
          <div className="status-cell__value">
            <span className={`status-dot ${frame.source_profile.unknown_source_locked ? 'status-dot--warning' : 'status-dot--success'}`} />
            <span>{frame.source_profile.active_profile}</span>
          </div>
        </div>

        <div className="status-cell">
          <span className="status-cell__label">Hardware</span>
          <div className="status-cell__value">
            <span className={`status-dot ${connected ? 'status-dot--success' : 'status-dot--neutral'}`} />
            <span>{connected ? 'CONNECTED' : 'SIMULATION'}</span>
          </div>
        </div>

        <div className="status-cell">
          <span className="status-cell__label">System</span>
          <div className="status-cell__value">
            <span className={`status-dot ${diagnostics.fault ? 'status-dot--error' : isFrozen ? 'status-dot--warning' : 'status-dot--success'}`} />
            <span>{diagnostics.fault ? 'FAULT' : isFrozen ? 'QUARANTINE' : 'NORMAL'}</span>
          </div>
        </div>
      </div>

      {/* 3. Primary Tier: System Flow (8 cols) + Live Control (4 cols) */}
      <div className="grid-12">
        <div className="col-8">
          <Workflow />
        </div>

        {/* Live Control & Actuator Panel */}
        <div className="col-4">
          <div className="ui-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Control
                </span>
                <span className="ui-badge ui-badge--subtle" style={{ fontSize: '10px' }}>
                  Cycles: {frame.valve_actuator.total_cycles_logged.toLocaleString()}
                </span>
              </div>

              {/* Status List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', fontFamily: 'var(--font-family-mono)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '7px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Main Actuator</span>
                  <span style={{ fontWeight: 600, color: isValveOpen ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                    {frame.valve_actuator.main_solenoid_state}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '7px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Drain Flush</span>
                  <span style={{ fontWeight: 600, color: isDrainOpen ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {frame.valve_actuator.drain_flush_state}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '7px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Actuation Latency</span>
                  <span style={{ color: 'var(--text-primary)' }}>{frame.valve_actuator.actuation_latency_ms} ms</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-quiet)', paddingBottom: '7px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fail-Safe State</span>
                  <span style={{ color: 'var(--feedback-success)' }}>ARMED (NC)</span>
                </div>
              </div>
            </div>

            {/* Direct Operational Action Buttons */}
            <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  className="ui-btn ui-btn--secondary"
                  onClick={() => handleOverride('AUTO')}
                  disabled={diagnostics.mode === 'AUTO'}
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  Auto Mode
                </button>
                <button
                  className="ui-btn ui-btn--secondary"
                  onClick={() => handleOverride('FORCE_OPEN')}
                  title="Emergency mode: 30 minutes; statistical drift gating relaxed."
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  Emergency Mode
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  className={`ui-btn ${isValveOpen ? 'ui-btn--danger' : 'ui-btn--secondary'}`}
                  onClick={() => handleOverride(isValveOpen ? 'FORCE_CLOSE' : 'AUTO')}
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  {isValveOpen ? 'Latch Close' : 'Release Latch'}
                </button>

                <button
                  className="ui-btn ui-btn--secondary"
                  onClick={handlePurge}
                  disabled={!config.hasDrain || purgeBusy || isDrainOpen}
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  Drain Flush
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Secondary Tier: Oscilloscope (8 cols) + Sensor Health Stack (4 cols) */}
      <div className="grid-12">
        {/* Oscilloscope Card */}
        <div className="col-8">
          <div className="ui-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent Activity
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>· 60s Rolling Trace</span>
              </div>

              <div className="ui-toggle-group">
                <button
                  className={`ui-toggle-item ${activeParam === 'tds' ? 'active' : ''}`}
                  onClick={() => setActiveParam('tds')}
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                >
                  TDS
                </button>
                <button
                  className={`ui-toggle-item ${activeParam === 'ph' ? 'active' : ''}`}
                  onClick={() => setActiveParam('ph')}
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                >
                  pH
                </button>
                <button
                  className={`ui-toggle-item ${activeParam === 'temp' ? 'active' : ''}`}
                  onClick={() => setActiveParam('temp')}
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                >
                  Temp
                </button>
              </div>
            </div>

            {renderOscilloscope()}
          </div>
        </div>

        {/* Compact Sensor Health Metric Stack */}
        <div className="col-4">
          <div className="ui-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Sensor Health
            </div>

            {/* TDS Row */}
            <div
              onClick={() => setActiveParam('tds')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-control)',
                border: `1px solid ${activeParam === 'tds' ? 'var(--accent)' : 'var(--border-quiet)'}`,
                backgroundColor: 'var(--surface-navigation)',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>TDS</div>
                <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
                  {tds.value.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>ppm</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', fontFamily: 'var(--font-family-mono)' }}>
                <span className={`ui-badge ${tds.status === 'pass' ? 'ui-badge--subtle-success' : 'ui-badge--subtle-error'}`}>
                  {tds.status.toUpperCase()}
                </span>
                <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>±{tds.uncertainty.toFixed(1)} ppm</div>
              </div>
            </div>

            {/* pH Row */}
            <div
              onClick={() => setActiveParam('ph')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-control)',
                border: `1px solid ${activeParam === 'ph' ? 'var(--accent)' : 'var(--border-quiet)'}`,
                backgroundColor: 'var(--surface-navigation)',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>pH Level</div>
                <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
                  {ph.value.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', fontFamily: 'var(--font-family-mono)' }}>
                <span className={`ui-badge ${ph.status === 'pass' ? 'ui-badge--subtle-success' : 'ui-badge--subtle-error'}`}>
                  {ph.status.toUpperCase()}
                </span>
                <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>±{ph.uncertainty.toFixed(2)}</div>
              </div>
            </div>

            {/* Temp Row */}
            <div
              onClick={() => setActiveParam('temp')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-control)',
                border: `1px solid ${activeParam === 'temp' ? 'var(--accent)' : 'var(--border-quiet)'}`,
                backgroundColor: 'var(--surface-navigation)',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>Water Temp</div>
                <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
                  {temp.value.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>°C</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', fontFamily: 'var(--font-family-mono)' }}>
                <span className={`ui-badge ${temp.status === 'pass' ? 'ui-badge--subtle-success' : 'ui-badge--subtle-error'}`}>
                  {temp.status.toUpperCase()}
                </span>
                <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>±{temp.uncertainty.toFixed(2)} °C</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Tertiary Tier: Recovery & Purge State (6 cols) + System Alerts & Gating (6 cols) */}
      <div className="grid-12">
        {/* Recovery State Card */}
        <div className="col-6">
          <div className="ui-card" style={{ padding: '20px 24px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recovery & Purge State
              </span>
              <span className={`ui-badge ${frame.fsm_recovery.current_state === 'RESTORED' ? 'ui-badge--subtle-success' : 'ui-badge--subtle'}`}>
                {frame.fsm_recovery.current_state}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '11px', fontFamily: 'var(--font-family-mono)' }}>
              <div style={{ backgroundColor: 'var(--surface-navigation)', padding: '12px 14px', borderRadius: 'var(--radius-control)', border: '1px solid var(--border-quiet)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', marginBottom: '3px' }}>Qualified Samples</span>
                <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                  {frame.fsm_recovery.consecutive_pass_samples} / {frame.fsm_recovery.required_pass_samples}
                </strong>
              </div>

              <div style={{ backgroundColor: 'var(--surface-navigation)', padding: '12px 14px', borderRadius: 'var(--radius-control)', border: '1px solid var(--border-quiet)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', marginBottom: '3px' }}>Fresh Water</span>
                <strong style={{ fontSize: '14px', color: frame.fsm_recovery.stagnant_chamber_flag ? 'var(--feedback-error)' : 'var(--feedback-success)' }}>
                  {frame.fsm_recovery.stagnant_chamber_flag ? 'STAGNANT' : 'PRESENT'}
                </strong>
              </div>

              <div style={{ backgroundColor: 'var(--surface-navigation)', padding: '12px 14px', borderRadius: 'var(--radius-control)', border: '1px solid var(--border-quiet)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', marginBottom: '3px' }}>Purge Timer</span>
                <strong style={{ fontSize: '16px', color: isDrainOpen ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {frame.fsm_recovery.purge_timer_seconds.toFixed(0)} s
                </strong>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                id="hasDrainCheck"
                checked={config.hasDrain}
                onChange={(e) => {
                  try {
                    saveConfig({ ...config, hasDrain: e.target.checked });
                    notify('Drain configuration updated');
                  } catch (err) {
                    notify(String(err));
                  }
                }}
                style={{ accentColor: 'var(--accent)' }}
              />
              <label htmlFor="hasDrainCheck" style={{ cursor: 'pointer' }}>
                Drain path branch commissioned (required for fresh sampling during closure)
              </label>
            </div>
          </div>
        </div>

        {/* System Alerts & Gate Criteria Card */}
        <div className="col-6">
          <div className="ui-card" style={{ padding: '20px 24px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gating Conditions & Alarms
              </span>
              <span className={`ui-badge ${diagnostics.fault ? 'ui-badge--subtle-error' : 'ui-badge--subtle-success'}`}>
                {diagnostics.fault ? 'ALARM ACTIVE' : 'ALL GATES NORMAL'}
              </span>
            </div>

            {/* AND-Logic Criteria Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'var(--surface-navigation)',
                border: '1px solid var(--border-quiet)',
                fontFamily: 'var(--font-family-mono)',
                fontSize: '12px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: tds.status === 'pass' ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{tds.status === 'pass' ? '✓' : '✗'} TDS]
              </span>
              <span style={{ color: 'var(--text-muted)' }}>∧</span>
              <span style={{ color: ph.status === 'pass' ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{ph.status === 'pass' ? '✓' : '✗'} pH]
              </span>
              <span style={{ color: 'var(--text-muted)' }}>∧</span>
              <span style={{ color: temp.status === 'pass' ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{temp.status === 'pass' ? '✓' : '✗'} Temp]
              </span>
              <span style={{ color: 'var(--text-muted)' }}>∧</span>
              <span style={{ color: !frame.source_profile.unknown_source_locked ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{!frame.source_profile.unknown_source_locked ? '✓' : '✗'} Source]
              </span>
            </div>

            {/* Active Fault / Message */}
            <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {diagnostics.fault ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--feedback-error)' }}>
                  <WarningIcon size={14} />
                  <span>{diagnostics.fault}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--feedback-success)' }}>
                  <CheckIcon size={14} />
                  <span>No sensor, communication, or electrical baseline faults detected.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Quaternary Tier: Progressive Disclosure (Advanced Engineering Details) */}
      <div className="ui-card" style={{ padding: '14px 24px' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span>Advanced Diagnostic Metadata & Watchdog Rules</span>
          <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--accent)', fontSize: '11px' }}>
            {showAdvanced ? 'Collapse ▲' : 'Expand Details ▼'}
          </span>
        </button>

        {showAdvanced && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-quiet)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Pearson Cross-Correlation</strong>
              <div style={{ fontFamily: 'var(--font-family-mono)' }}>TDS / pH: {diagnostics.correlationTdsPh.toFixed(2)}</div>
              <div style={{ fontFamily: 'var(--font-family-mono)' }}>TDS / Temp: {diagnostics.correlationTdsTemp.toFixed(2)}</div>
            </div>

            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Diagnostic Regression</strong>
              <div style={{ fontFamily: 'var(--font-family-mono)' }}>Estimate: {diagnostics.diagnosticTdsEstimate.toFixed(0)} ppm</div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Diagnostic unvalidated proxy; never authorizes flow)</span>
            </div>

            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Hardware Interlock Semantics</strong>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Command acks verify microcontroller register state, not physical valve seating. Auxiliary flow sensor required for physical confirmation.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
