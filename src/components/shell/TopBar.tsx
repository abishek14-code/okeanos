import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';

export const TopBar: React.FC = () => {
  const { frame, mode, connected, connectHardware, disconnectHardware } = useTelemetry();

  const [connecting, setConnecting] = useState(false);
  const [connNotice, setConnNotice] = useState<string | null>(null);
  const [rawError, setRawError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Format uptime (e.g. 0d 6h 4m)
  const days = Math.floor(frame.uptime_seconds / 86400);
  const hours = Math.floor((frame.uptime_seconds % 86400) / 3600);
  const minutes = Math.floor((frame.uptime_seconds % 3600) / 60);
  const uptimeStr = `${days}d ${hours}h ${minutes}m`;

  const handleConnectToggle = async () => {
    setConnecting(true);
    try {
      if (connected) {
        await disconnectHardware();
        setConnNotice('Hardware disconnected — switched to simulation.');
      } else {
        await connectHardware();
        setConnNotice(null);
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      setRawError(msg);
      if (msg.includes('No port selected') || msg.includes('requestPort') || msg.includes('cancel')) {
        setConnNotice('Hardware connection cancelled — no serial device selected.');
      } else {
        setConnNotice('Hardware connection failed.');
      }
      setTimeout(() => setConnNotice(null), 4500);
    } finally {
      setConnecting(false);
    }
  };

  const { tds, ph, temp } = frame.telemetry;

  return (
    <header className="top-bar">
      {/* Left: Brand & Compact System Mode */}
      <div className="top-bar__left">
        <div className="top-bar__brand">
          <span>OKEANOS</span>
        </div>

        {/* System Mode Pill */}
        <div
          className="ui-badge ui-badge--subtle"
          style={{ gap: '6px', padding: '2px 8px', fontSize: 'var(--font-size-metadata)' }}
        >
          <span className={`status-dot ${connected ? 'status-dot--success' : 'status-dot--active'}`} />
          <span>{mode === 'HARDWARE' ? 'Hardware' : mode === 'REPLAY' ? 'Replay' : 'Simulation'}</span>
        </div>

        {/* Compact Hardware Connect Control */}
        <button
          className="ui-btn ui-btn--ghost ui-btn--sm"
          onClick={handleConnectToggle}
          disabled={connecting}
          style={{
            fontSize: 'var(--font-size-2xs)',
            height: '24px',
            padding: '0 8px',
            border: '1px solid var(--border-quiet)',
            color: connected ? 'var(--feedback-success)' : 'var(--text-muted)',
          }}
          title={connected ? 'Disconnect USB hardware session' : 'Connect physical USB microcontroller'}
        >
          {connecting ? 'Connecting...' : connected ? 'Disconnect USB' : 'Connect Hardware'}
        </button>

        {/* Temporary Operator Notification (if active) */}
        {connNotice && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--feedback-caution)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(214, 183, 123, 0.08)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(214, 183, 123, 0.2)',
            }}
          >
            <span>{connNotice}</span>
            {rawError && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                {showDetails ? 'Hide' : 'Details'}
              </button>
            )}
            {showDetails && (
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}
              >
                ({rawError})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Inline Live Telemetry */}
      <div className="top-bar__center">
        <div className="top-bar__telemetry">
          <span>
            TDS <strong>{tds.value.toFixed(1)}</strong> ppm
          </span>
          <span className="top-bar__sep">·</span>
          <span>
            pH <strong>{ph.value.toFixed(2)}</strong>
          </span>
          <span className="top-bar__sep">·</span>
          <span>
            Temp <strong>{temp.value.toFixed(1)}</strong> °C
          </span>
        </div>
      </div>

      {/* Right: Secondary State & Settings Action */}
      <div className="top-bar__right">
        {/* Active Source Label */}
        <span
          style={{
            fontSize: 'var(--font-size-2xs)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-family-mono)',
            textTransform: 'capitalize',
          }}
        >
          {frame.source_profile.active_profile.toLowerCase()}
        </span>

        <span className="top-bar__sep">·</span>

        {/* Live Uptime */}
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--font-size-2xs)',
            color: 'var(--text-muted)',
          }}
        >
          UP {uptimeStr}
        </span>
      </div>
    </header>
  );
};
