import React from 'react';
import { useTheme, AccentColor, UiDensity, MotionMode } from '../../context/ThemeContext';
import { CloseIcon } from '../common/Icons';

export const ThemeControlModal: React.FC = () => {
  const {
    accent,
    density,
    motion,
    isThemeModalOpen,
    closeThemeModal,
    setAccent,
    setDensity,
    setMotion,
  } = useTheme();

  if (!isThemeModalOpen) return null;

  const accents: { id: AccentColor; label: string; hex: string }[] = [
    { id: 'ice', label: 'Ice Blue', hex: '#91b9f2' },
    { id: 'blue', label: 'Electric Blue', hex: '#3b82f6' },
    { id: 'emerald', label: 'Emerald Sage', hex: '#34d399' },
    { id: 'amber', label: 'Amber Sand', hex: '#fbbf24' },
    { id: 'white', label: 'Crisp White', hex: '#ffffff' },
  ];

  const densities: { id: UiDensity; label: string; desc: string }[] = [
    { id: 'compact', label: 'Compact (26px)', desc: 'Higher data density for multi-card inspection' },
    { id: 'standard', label: 'Standard (30px)', desc: 'Balanced workstation layout for 1080p/4K displays' },
    { id: 'spacious', label: 'Spacious (34px)', desc: 'Enhanced touch and high-visibility spacing' },
  ];

  const motionOptions: { id: MotionMode; label: string; desc: string }[] = [
    { id: 'snappy', label: 'Snappy (120ms)', desc: 'Micro-interactions & tactile hardware button press down' },
    { id: 'reduced', label: 'Reduced Motion', desc: 'Instant 0ms transitions adhering to accessibility standards' },
  ];

  return (
    <div className="ui-modal-backdrop" onClick={closeThemeModal}>
      <div
        className="ui-modal-dialog"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-section)' }}>
              Display Preferences
            </span>
            <kbd>Ctrl+T</kbd>
          </div>
          <button className="ui-btn ui-btn--ghost ui-btn--icon" onClick={closeThemeModal}>
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="ui-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Accent Color Selector */}
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Brand & Highlight Accent
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {accents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: accent === a.id ? 'var(--surface-raised)' : 'var(--surface-input)',
                    border: `1px solid ${accent === a.id ? a.hex : 'var(--border-quiet)'}`,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-caption)',
                    transition: 'all var(--motion-hover)',
                  }}
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: a.hex,
                      display: 'inline-block',
                      boxShadow: accent === a.id ? `0 0 6px ${a.hex}` : 'none',
                    }}
                  />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* UI Density Selector */}
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Workspace Density
            </div>
            <div className="ui-toggle-group" style={{ width: '100%', display: 'flex' }}>
              {densities.map((d) => (
                <button
                  key={d.id}
                  className={`ui-toggle-item ${density === d.id ? 'active' : ''}`}
                  style={{ flex: 1, padding: '8px 12px', textAlign: 'center' }}
                  onClick={() => setDensity(d.id)}
                >
                  <div style={{ fontWeight: 600 }}>{d.label}</div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Motion Toggle */}
          <div>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Motion & Transitions
            </div>
            <div className="ui-toggle-group" style={{ width: '100%', display: 'flex' }}>
              {motionOptions.map((m) => (
                <button
                  key={m.id}
                  className={`ui-toggle-item ${motion === m.id ? 'active' : ''}`}
                  style={{ flex: 1, padding: '8px 12px', textAlign: 'center' }}
                  onClick={() => setMotion(m.id)}
                >
                  <div style={{ fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-muted)' }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="ui-card" style={{ backgroundColor: 'var(--surface-canvas)', borderColor: 'var(--border-subtle)' }}>
            <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live Visual Preview (Current Tokens)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button className="ui-btn ui-btn--primary">Primary Action</button>
              <button className="ui-btn ui-btn--secondary">Secondary Button</button>
              <span className="ui-badge ui-badge--success">Valve Safe</span>
              <span className="ui-badge ui-badge--warning">Quarantine Freeze</span>
              <span className="ui-badge ui-badge--error">Trip Blocked</span>
              <span className="ui-badge ui-badge--info">Ice Blue Accent</span>
            </div>
          </div>
        </div>

        <div className="ui-modal-footer">
          <button className="ui-btn ui-btn--primary" onClick={closeThemeModal}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
