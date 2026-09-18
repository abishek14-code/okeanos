import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { DownloadIcon } from '../common/Icons';

export const AuditTrailConfig: React.FC = () => {
<<<<<<< HEAD
  const { frame } = useTelemetry();
=======
  const { frame, config, saveConfig, exportFlightRecorder } = useTelemetry();
>>>>>>> 506c44a (add backend iter-1 by astra)
  const [filterType, setFilterType] = useState<string>('ALL');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Config form state
  const [tdsLower, setTdsLower] = useState(frame.telemetry.tds.lower_bound);
  const [tdsUpper, setTdsUpper] = useState(frame.telemetry.tds.upper_bound);
  const [phLower, setPhLower] = useState(frame.telemetry.ph.lower_bound);
  const [phUpper, setPhUpper] = useState(frame.telemetry.ph.upper_bound);
<<<<<<< HEAD
  const [coverageK, setCoverageK] = useState('2.0');
=======
  const [coverageK, setCoverageK] = useState(String(config.k));
>>>>>>> 506c44a (add backend iter-1 by astra)
  const [cusumH, setCusumH] = useState(frame.quarantine_engine.threshold_h);

  const logs = frame.flight_recorder_log || [];

  const filteredLogs = filterType === 'ALL' ? logs : logs.filter((l) => l.event_type === filterType);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
<<<<<<< HEAD
    setSavedNotice('Configuration committed with cryptographic signature SHA-256.');
=======
    try{setSavedNotice(saveConfig({...config,k:Number(coverageK),cusumH,limits:{...config.limits,tds:[tdsLower,tdsUpper],ph:[phLower,phUpper]}}));}catch(e){setSavedNotice(String(e));}
>>>>>>> 506c44a (add backend iter-1 by astra)
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleExportJson = () => {
<<<<<<< HEAD
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
=======
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(exportFlightRecorder('json'));
>>>>>>> 506c44a (add backend iter-1 by astra)
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `okeanos-flight-log-${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="workspace-viewport">
      <div className="workspace-header">
        <div className="workspace-title-group">
          <h1 className="workspace-title">Audit Trail, Flight Recorder & Configuration</h1>
<<<<<<< HEAD
          <span className="ui-badge ui-badge--success">CRYPTOGRAPHIC CHAIN VALID</span>
=======
          <span className="ui-badge ui-badge--success">SESSION DECISION JOURNAL</span>
>>>>>>> 506c44a (add backend iter-1 by astra)
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={handleExportJson}>
            <DownloadIcon size={14} />
            <span>Export Flight Log (JSON)</span>
          </button>
        </div>
      </div>

      {/* Flight Recorder Log Table */}
      <div className="ui-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
<<<<<<< HEAD
              TAMPER-EVIDENT FLIGHT RECORDER LOG (SHA-256 CHAIN)
            </div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              Immutable circular event recorder. Each block hashes previous signature.
=======
              RECENT DECISION RECORDS
            </div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              Export includes readings, uncertainty, configuration, learning state, commands and replayable actions. Unsigned local records; 10,000-event export limit.
>>>>>>> 506c44a (add backend iter-1 by astra)
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                padding: '4px 8px',
                fontSize: 'var(--font-size-caption)',
              }}
            >
              <option value="ALL">All Event Types</option>
              <option value="GATE_SNAP_CLOSE">GATE_SNAP_CLOSE</option>
              <option value="PURGE_TRIGGER">PURGE_TRIGGER</option>
              <option value="QUARANTINE_FREEZE">QUARANTINE_FREEZE</option>
              <option value="STAGNATION_PURGE">STAGNATION_PURGE</option>
              <option value="SYSTEM_BOOT">SYSTEM_BOOT</option>
            </select>
          </div>
        </div>

        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Event Type</th>
                <th>Trigger Metric</th>
                <th>Value ± U</th>
<<<<<<< HEAD
                <th>Chain Hash (SHA-256)</th>
=======
                <th>Signature</th>
>>>>>>> 506c44a (add backend iter-1 by astra)
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-2xs)' }}>
                    {log.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td>
                    <span
                      className={`ui-badge ${
                        log.event_type.includes('CLOSE') || log.event_type.includes('FREEZE')
                          ? 'ui-badge--error'
                          : log.event_type.includes('PURGE')
                          ? 'ui-badge--warning'
                          : 'ui-badge--info'
                      }`}
                    >
                      {log.event_type}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>{log.trigger}</td>
                  <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
                    {log.value_recorded.toFixed(2)} {log.uncertainty_recorded ? `± ${log.uncertainty_recorded.toFixed(2)}` : ''}
                  </td>
                  <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
                    {log.hash_signature}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Metrological Configuration Editor */}
      <div className="ui-card">
        <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
          METROLOGICAL THRESHOLD & SAFETY CONFIGURATION
        </div>

        <form onSubmit={handleSaveConfig}>
          <div className="grid-3" style={{ marginBottom: '16px' }}>
            {/* TDS Limits */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                TDS Lower Safe Limit (ppm)
              </label>
              <input
                type="number"
                value={tdsLower}
                onChange={(e) => setTdsLower(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-family-mono)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                TDS Upper Safe Limit (ppm)
              </label>
              <input
                type="number"
                value={tdsUpper}
                onChange={(e) => setTdsUpper(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-family-mono)',
                }}
              />
            </div>

            {/* Coverage factor */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Coverage Factor k (ISO GUM)
              </label>
              <select
                value={coverageK}
                onChange={(e) => setCoverageK(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-family-mono)',
                }}
              >
<<<<<<< HEAD
                <option value="1.96">k = 1.96 (95.0% Confidence)</option>
                <option value="2.0">k = 2.00 (95.4% Confidence - Standard)</option>
                <option value="2.58">k = 2.58 (99.0% Confidence)</option>
                <option value="3.0">k = 3.00 (99.73% Confidence - Strict)</option>
=======
                <option value="1.96">k = 1.96</option>
                <option value="2.0">k = 2.00</option>
                <option value="2.58">k = 2.58</option>
                <option value="3.0">k = 3.00</option>
>>>>>>> 506c44a (add backend iter-1 by astra)
              </select>
            </div>

            {/* pH Limits */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                pH Lower Safe Limit
              </label>
              <input
                type="number"
                step="0.1"
                value={phLower}
                onChange={(e) => setPhLower(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-family-mono)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                pH Upper Safe Limit
              </label>
              <input
                type="number"
                step="0.1"
                value={phUpper}
                onChange={(e) => setPhUpper(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-family-mono)',
                }}
              />
            </div>

            {/* CUSUM threshold */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                CUSUM Decision Interval h
              </label>
              <input
                type="number"
                step="0.1"
                value={cusumH}
                onChange={(e) => setCusumH(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-family-mono)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {savedNotice ? (
              <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--feedback-success)', fontFamily: 'var(--font-family-mono)' }}>
                ✓ {savedNotice}
              </span>
            ) : (
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
<<<<<<< HEAD
                Changes will be verified against ASTM D1125 electrical conductivity standards before writing.
=======
                Configuration is validated against commissioning ceilings. Saving closes the gate and restarts recovery.
>>>>>>> 506c44a (add backend iter-1 by astra)
              </span>
            )}
            <button type="submit" className="ui-btn ui-btn--primary">
              Commit Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
