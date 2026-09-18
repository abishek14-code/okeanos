import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { PurgeIcon, ValveClosedIcon, ValveOpenIcon } from '../common/Icons';

export const CommandCenter: React.FC = () => {
  const { frame, oscilloscopeHistory, triggerPurge, overrideValve } = useTelemetry();
  const [activeParam, setActiveParam] = useState<'tds' | 'ph' | 'temp'>('tds');
  const [purgeBusy, setPurgeBusy] = useState(false);

  const { tds, ph, temp } = frame.telemetry;
  const isValveOpen = frame.valve_actuator.main_solenoid_state === 'OPEN';

  const handlePurge = async () => {
    setPurgeBusy(true);
    await triggerPurge(15);
    setTimeout(() => setPurgeBusy(false), 15000);
  };

  // Render SVG oscilloscope
  const renderOscilloscope = () => {
    if (oscilloscopeHistory.length < 2) {
      return (
        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Collecting live sensor trace buffer...
        </div>
      );
    }

    const width = 840;
    const height = 180;
    const padding = 20;

    const values = oscilloscopeHistory.map((d) => d[activeParam]);
    const uppers = oscilloscopeHistory.map((d) => (activeParam === 'tds' ? d.tdsUpper : d[activeParam] * 1.02));
    const lowers = oscilloscopeHistory.map((d) => (activeParam === 'tds' ? d.tdsLower : d[activeParam] * 0.98));

    const minVal = Math.min(...lowers) * 0.95;
    const maxVal = Math.max(...uppers) * 1.05;
    const range = maxVal - minVal || 1;

    const getX = (idx: number) => padding + (idx / (oscilloscopeHistory.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - 2 * padding);

    // Build SVG path
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
        {[0.25, 0.5, 0.75].map((pct) => {
          const y = height - padding - pct * (height - 2 * padding);
          const labelVal = (minVal + pct * range).toFixed(activeParam === 'ph' ? 2 : 1);
          return (
            <g key={pct}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border-quiet)" strokeDasharray="3 3" />
              <text x={padding - 5} y={y + 3} fill="var(--text-muted)" fontSize="9" textAnchor="end" fontFamily="var(--font-family-mono)">
                {labelVal}
              </text>
            </g>
          );
        })}

        {/* Uncertainty Envelope */}
        <path d={envelopePath} fill="var(--accent-subtle)" opacity={0.6} />

        {/* Live Nominal Trace */}
        <path d={mainPath} fill="none" stroke="var(--accent)" strokeWidth={2} />

        {/* Current Point Dot */}
        {oscilloscopeHistory.length > 0 && (
          <circle
            cx={getX(oscilloscopeHistory.length - 1)}
            cy={getY(values[values.length - 1])}
            r={4}
            fill="#ffffff"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}
      </svg>
    );
  };

  return (
    <div className="workspace-viewport">
      {/* Workspace Header */}
      <div className="workspace-header">
        <div className="workspace-title-group">
          <h1 className="workspace-title">Command Center & Real-Time Flow Gate</h1>
          <span className="ui-badge ui-badge--info">Workspace 01</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="ui-btn ui-btn--secondary ui-btn--sm"
            onClick={handlePurge}
            disabled={purgeBusy || frame.valve_actuator.drain_flush_state === 'OPEN'}
          >
            <PurgeIcon size={14} />
            <span>{purgeBusy ? 'Flushing Chamber...' : 'Trigger Purge (15s)'}</span>
          </button>
          <button
            className={`ui-btn ui-btn--sm ${isValveOpen ? 'ui-btn--danger' : 'ui-btn--primary'}`}
            onClick={() => overrideValve(isValveOpen ? 'FORCE_CLOSE' : 'AUTO')}
          >
            {isValveOpen ? <ValveClosedIcon size={14} /> : <ValveOpenIcon size={14} />}
            <span>{isValveOpen ? 'Emergency Close' : 'Restore Auto Mode'}</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Cards: TDS, pH, Temp */}
      <div className="grid-3">
        {/* TDS Card */}
        <div
          className={`ui-card ${activeParam === 'tds' ? 'ui-card--featured' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveParam('tds')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                TOTAL DISSOLVED SOLIDS (TDS)
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>Inline Titanium Probe</div>
            </div>
            <span
              className={`ui-badge ${
                tds.status === 'pass' ? 'ui-badge--success' : tds.status === 'hold' ? 'ui-badge--warning' : 'ui-badge--error'
              }`}
            >
              {tds.status.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
              {tds.value.toFixed(1)}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-section)', fontFamily: 'var(--font-family-mono)' }}>
              ppm
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-caption)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>
            Uncertainty: <strong style={{ color: 'var(--text-primary)' }}>±{tds.uncertainty.toFixed(1)} ppm</strong> (k=2, 95.4%)
          </div>
          <div style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Allowable Range: [{tds.lower_bound.toFixed(0)} - {tds.upper_bound.toFixed(0)} ppm]
          </div>
        </div>

        {/* pH Card */}
        <div
          className={`ui-card ${activeParam === 'ph' ? 'ui-card--featured' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveParam('ph')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                POTENTIAL HYDROGEN (pH)
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>Glass Combination Electrode</div>
            </div>
            <span
              className={`ui-badge ${
                ph.status === 'pass' ? 'ui-badge--success' : ph.status === 'hold' ? 'ui-badge--warning' : 'ui-badge--error'
              }`}
            >
              {ph.status.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
              {ph.value.toFixed(2)}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-section)', fontFamily: 'var(--font-family-mono)' }}>
              pH
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-caption)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>
            Uncertainty: <strong style={{ color: 'var(--text-primary)' }}>±{ph.uncertainty.toFixed(2)} pH</strong> (k=2, 95.4%)
          </div>
          <div style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Allowable Range: [{ph.lower_bound.toFixed(1)} - {ph.upper_bound.toFixed(1)} pH]
          </div>
        </div>

        {/* Temperature Card */}
        <div
          className={`ui-card ${activeParam === 'temp' ? 'ui-card--featured' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveParam('temp')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                WATER TEMPERATURE
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>DS18B20 1-Wire Digital Probe</div>
            </div>
            <span
              className={`ui-badge ${
                temp.status === 'pass' ? 'ui-badge--success' : temp.status === 'hold' ? 'ui-badge--warning' : 'ui-badge--error'
              }`}
            >
              {temp.status.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
              {temp.value.toFixed(1)}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-section)', fontFamily: 'var(--font-family-mono)' }}>
              °C
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-caption)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>
            Uncertainty: <strong style={{ color: 'var(--text-primary)' }}>±{temp.uncertainty.toFixed(2)} °C</strong> (k=2, 95.4%)
          </div>
          <div style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Allowable Range: [{temp.lower_bound.toFixed(1)} - {temp.upper_bound.toFixed(1)} °C]
          </div>
        </div>
      </div>

      {/* AND-Logic Gating Engine & Metrological Permission Strip */}
      <div
        className="ui-card"
        style={{
          backgroundColor: isValveOpen ? 'rgba(74, 222, 128, 0.05)' : 'rgba(248, 113, 113, 0.08)',
          borderColor: isValveOpen ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-metadata)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              METROLOGICAL AND-LOGIC GATING CRITERION
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
              <span style={{ color: tds.status === 'pass' ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{tds.status === 'pass' ? '✓' : '✗'} TDS INTERVAL]
              </span>
              <span>∧</span>
              <span style={{ color: ph.status === 'pass' ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{ph.status === 'pass' ? '✓' : '✗'} pH INTERVAL]
              </span>
              <span>∧</span>
              <span style={{ color: temp.status === 'pass' ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{temp.status === 'pass' ? '✓' : '✗'} TEMP INTERVAL]
              </span>
              <span>∧</span>
              <span style={{ color: !frame.source_profile.unknown_source_locked ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                [{!frame.source_profile.unknown_source_locked ? '✓' : '✗'} KNOWN PROFILE]
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
            <div>
              ACTUATOR: <strong style={{ color: isValveOpen ? 'var(--feedback-success)' : 'var(--feedback-error)' }}>
                {isValveOpen ? 'ENERGIZED (OPEN)' : 'DE-ENERGIZED (CLOSED)'}
              </strong>
            </div>
            <div>
              LATENCY: <strong>{frame.valve_actuator.actuation_latency_ms}ms</strong>
            </div>
            <div>
              FAIL-SAFE: <strong style={{ color: 'var(--feedback-success)' }}>ARMED (NC)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Oscilloscope */}
      <div className="ui-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
              REAL-TIME OSCILLOSCOPE (60s ROLLING WINDOW)
            </div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              Displaying live nominal trace with shaded expanded uncertainty band [x̂ - U, x̂ + U]
            </div>
          </div>
          <div className="ui-toggle-group">
            <button
              className={`ui-toggle-item ${activeParam === 'tds' ? 'active' : ''}`}
              onClick={() => setActiveParam('tds')}
            >
              TDS (ppm)
            </button>
            <button
              className={`ui-toggle-item ${activeParam === 'ph' ? 'active' : ''}`}
              onClick={() => setActiveParam('ph')}
            >
              pH Level
            </button>
            <button
              className={`ui-toggle-item ${activeParam === 'temp' ? 'active' : ''}`}
              onClick={() => setActiveParam('temp')}
            >
              Temp (°C)
            </button>
          </div>
        </div>

        {renderOscilloscope()}
      </div>
    </div>
  );
};
