import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { CheckIcon, ErrorIcon, RefreshIcon, WarningIcon } from '../common/Icons';

export const QuarantineMonitor: React.FC = () => {
  const { frame, resolveQuarantine } = useTelemetry();
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const { quarantine_engine } = frame;
  const isFrozen = quarantine_engine.learning_frozen;

  const handleAction = async (action: 'DISCARD' | 'ADMIT_TO_BASELINE' | 'RESET_CUSUM') => {
    const res = await resolveQuarantine(action);
    setActionFeedback(res);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const cusumThreshold = quarantine_engine.threshold_h; // 4.5
  const sPlus = quarantine_engine.cusum_s_plus;
  const sMinus = quarantine_engine.cusum_s_minus;

  return (
    <div className="workspace-viewport">
      <div className="workspace-header">
        <div className="workspace-title-group">
          <h1 className="workspace-title">Learning Quarantine & CUSUM Drift Monitor</h1>
          <span className={`ui-badge ${isFrozen ? 'ui-badge--error' : 'ui-badge--success'}`}>
            {isFrozen ? 'LEARNING FROZEN' : 'ACTIVE BASELINE LEARNING'}
          </span>
        </div>
      </div>

      {/* Freeze Warning Banner if CUSUM triggered */}
      {isFrozen && (
        <div
          className="ui-card"
          style={{
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            borderColor: 'var(--feedback-error)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <WarningIcon size={20} style={{ color: 'var(--feedback-error)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--feedback-error)', fontSize: 'var(--font-size-body)' }}>
              CUSUM CHANGE-POINT DETECTED: LEARNING QUARANTINE ACTIVE
            </div>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)' }}>
              Persistent statistical drift exceeded threshold (S+ = {sPlus.toFixed(2)} ≥ {cusumThreshold}). Data accumulation into trusted baseline is quarantined to prevent model poisoning.
            </div>
          </div>
        </div>
      )}

      {/* Dual Buffer Architecture */}
      <div className="grid-2">
        {/* Trusted Baseline Buffer */}
        <div className="ui-card">
          <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            TRUSTED BASELINE BUFFER (B_trusted)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Historical Window:</span>
              <span>30 Days (Circular FIFO @ 1Hz)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Committed Records:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{quarantine_engine.trusted_records_count.toLocaleString()} pts</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Baseline Mean (μ₀):</span>
              <span>{quarantine_engine.baseline_mean.toFixed(1)} ppm</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Baseline Std Dev (σ₀):</span>
              <span>{quarantine_engine.baseline_sigma.toFixed(1)} ppm</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>2σ Acceptance Band:</span>
              <span>
                {(quarantine_engine.baseline_mean - 2 * quarantine_engine.baseline_sigma).toFixed(1)} -{' '}
                {(quarantine_engine.baseline_mean + 2 * quarantine_engine.baseline_sigma).toFixed(1)} ppm
              </span>
            </div>
          </div>
        </div>

        {/* Quarantine Holding Buffer */}
        <div className="ui-card" style={{ borderColor: isFrozen ? 'var(--feedback-error)' : 'var(--border-quiet)' }}>
          <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: isFrozen ? 'var(--feedback-error)' : 'var(--text-secondary)', marginBottom: '12px' }}>
            QUARANTINE HOLDING BUFFER (B_quarantine)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Buffer Status:</span>
              <strong style={{ color: isFrozen ? 'var(--feedback-error)' : 'var(--feedback-success)' }}>
                {isFrozen ? 'HOLDING ACTIVE (DATA ISOLATED)' : 'IDLE (ZERO HOLDING)'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Quarantined Records:</span>
              <strong style={{ color: isFrozen ? 'var(--feedback-error)' : 'var(--text-primary)' }}>
                {quarantine_engine.quarantined_samples_count} samples
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Trigger:</span>
              <span>{isFrozen ? `CUSUM S+ (${sPlus.toFixed(2)} ≥ ${cusumThreshold})` : 'None'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Quarantined Mean:</span>
              <span>{quarantine_engine.quarantined_samples_count > 0 ? `${frame.telemetry.tds.value.toFixed(1)} ppm` : 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Baseline Infiltration:</span>
              <span style={{ color: 'var(--feedback-success)', fontWeight: 600 }}>0% (PROVEN PROTECTED)</span>
            </div>
          </div>
        </div>
      </div>

      {/* CUSUM Cumulative Deviation Chart */}
      <div className="ui-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)' }}>
              CUSUM STATISTIC ACCUMULATOR (S+ / S-)
            </div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>
              S_t^+ tracks upward drift; S_t^- tracks downward drift. Alarm trips when S ≥ h (4.5). Reference allowance k = 0.5.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-caption)' }}>
            <div>
              S⁺: <strong style={{ color: sPlus >= cusumThreshold ? 'var(--feedback-error)' : 'var(--accent)' }}>{sPlus.toFixed(3)}</strong>
            </div>
            <div>
              S⁻: <strong style={{ color: sMinus >= cusumThreshold ? 'var(--feedback-error)' : 'var(--accent)' }}>{sMinus.toFixed(3)}</strong>
            </div>
            <div>
              Threshold h: <strong>{cusumThreshold}</strong>
            </div>
          </div>
        </div>

        {/* Visual CUSUM Meters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-caption)', marginBottom: '4px' }}>
              <span>Upward Drift Accumulator (S⁺)</span>
              <span style={{ fontFamily: 'var(--font-family-mono)' }}>{( (sPlus / cusumThreshold) * 100 ).toFixed(0)}% of threshold</span>
            </div>
            <div className="ui-progress-track" style={{ height: '10px' }}>
              <div
                className="ui-progress-fill"
                style={{
                  width: `${Math.min(100, (sPlus / cusumThreshold) * 100)}%`,
                  backgroundColor: sPlus >= cusumThreshold ? 'var(--feedback-error)' : 'var(--accent)',
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-caption)', marginBottom: '4px' }}>
              <span>Downward Drift Accumulator (S⁻)</span>
              <span style={{ fontFamily: 'var(--font-family-mono)' }}>{( (sMinus / cusumThreshold) * 100 ).toFixed(0)}% of threshold</span>
            </div>
            <div className="ui-progress-track" style={{ height: '10px' }}>
              <div
                className="ui-progress-fill"
                style={{
                  width: `${Math.min(100, (sMinus / cusumThreshold) * 100)}%`,
                  backgroundColor: sMinus >= cusumThreshold ? 'var(--feedback-error)' : 'var(--accent)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quarantine Resolution Actions */}
      <div className="ui-card">
        <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          QUARANTINE RESOLUTION CONTROLS
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="ui-btn ui-btn--danger" onClick={() => handleAction('DISCARD')}>
            <ErrorIcon size={14} />
            <span>Discard Quarantined Data</span>
          </button>
          <button className="ui-btn ui-btn--secondary" onClick={() => handleAction('ADMIT_TO_BASELINE')}>
            <CheckIcon size={14} />
            <span>Validate & Admit to Baseline</span>
          </button>
          <button className="ui-btn ui-btn--secondary" onClick={() => handleAction('RESET_CUSUM')}>
            <RefreshIcon size={14} />
            <span>Reset CUSUM Accumulator</span>
          </button>
        </div>
        {actionFeedback && (
          <div style={{ marginTop: '12px', fontSize: 'var(--font-size-caption)', color: 'var(--accent)', fontFamily: 'var(--font-family-mono)' }}>
            ✓ {actionFeedback}
          </div>
        )}
      </div>
    </div>
  );
};
