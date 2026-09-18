import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import {
  AuditTrailIcon,
  CalibrationIcon,
  ChallengeRigIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CommandCenterIcon,
  ExposureIcon,
  QuarantineIcon,
  RecoveryFsmIcon,
  SourceProfileIcon,
} from '../common/Icons';

export type WorkspaceId =
  | 'command'
  | 'quarantine'
  | 'uncertainty'
  | 'sources'
  | 'recovery'
  | 'exposure'
  | 'challenge'
  | 'audit';

interface SidebarProps {
  activeWorkspace: WorkspaceId;
  onSelectWorkspace: (id: WorkspaceId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  onSelectWorkspace,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { frame } = useTelemetry();

  const navItems: { id: WorkspaceId; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'command',
      label: 'Command Center',
      icon: <CommandCenterIcon size={16} />,
      badge: frame.valve_actuator.main_solenoid_state,
    },
    {
      id: 'quarantine',
      label: 'Quarantine & CUSUM',
      icon: <QuarantineIcon size={16} />,
      badge: frame.quarantine_engine.learning_frozen ? 'FROZEN' : undefined,
    },
    {
      id: 'uncertainty',
      label: 'Uncertainty & Calibration',
      icon: <CalibrationIcon size={16} />,
    },
    {
      id: 'sources',
      label: 'Source Profiles',
      icon: <SourceProfileIcon size={16} />,
    },
    {
      id: 'recovery',
      label: 'Recovery FSM & Purge',
      icon: <RecoveryFsmIcon size={16} />,
      badge: frame.fsm_recovery.current_state,
    },
    {
      id: 'exposure',
      label: 'Exposure & CMSI',
      icon: <ExposureIcon size={16} />,
<<<<<<< HEAD
      badge: `${frame.exposure_accounting.days_remaining_projected}d`,
=======
      badge: 'ESTIMATE',
>>>>>>> 506c44a (add backend iter-1 by astra)
    },
    {
      id: 'challenge',
      label: 'Challenge Replay Rig',
      icon: <ChallengeRigIcon size={16} />,
    },
    {
      id: 'audit',
      label: 'Audit Log & Config',
      icon: <AuditTrailIcon size={16} />,
    },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Navigation Items */}
      <nav className="sidebar__nav">
        {navItems.map((item) => {
          const isActive = activeWorkspace === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onSelectWorkspace(item.id)}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="sidebar__item-icon">{item.icon}</span>
              {!isCollapsed && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor:
                          item.badge === 'FROZEN' || item.badge === 'BLOCKED'
                            ? 'var(--feedback-error-bg)'
                            : item.badge === 'OPEN'
                            ? 'var(--feedback-success-bg)'
                            : 'rgba(255, 255, 255, 0.08)',
                        color:
                          item.badge === 'FROZEN' || item.badge === 'BLOCKED'
                            ? 'var(--feedback-error)'
                            : item.badge === 'OPEN'
                            ? 'var(--feedback-success)'
                            : 'var(--text-muted)',
                        fontFamily: 'var(--font-family-mono)',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Hardware Status Strip at bottom */}
      {!isCollapsed && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border-quiet)',
            fontSize: '11px',
            fontFamily: 'var(--font-family-mono)',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
<<<<<<< HEAD
            <span>NC Valve (GPIO 26):</span>
=======
            <span>Main command:</span>
>>>>>>> 506c44a (add backend iter-1 by astra)
            <span style={{ color: frame.valve_actuator.main_solenoid_state === 'OPEN' ? 'var(--feedback-success)' : 'var(--feedback-error)', fontWeight: 600 }}>
              {frame.valve_actuator.main_solenoid_state}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
<<<<<<< HEAD
            <span>Purge Aux (GPIO 27):</span>
=======
            <span>Drain command:</span>
>>>>>>> 506c44a (add backend iter-1 by astra)
            <span style={{ color: frame.valve_actuator.drain_flush_state === 'OPEN' ? 'var(--accent)' : 'var(--text-muted)' }}>
              {frame.valve_actuator.drain_flush_state}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
<<<<<<< HEAD
            <span>Solenoid Cycles:</span>
            <span>{frame.valve_actuator.total_cycles_logged.toLocaleString()} / 100k</span>
=======
            <span>Command transitions:</span>
            <span>{frame.valve_actuator.total_cycles_logged.toLocaleString()}</span>
>>>>>>> 506c44a (add backend iter-1 by astra)
          </div>
        </div>
      )}

      {/* Collapse/Expand Footer */}
      <div className="sidebar__footer">
        <button
          className="ui-btn ui-btn--ghost ui-btn--icon"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{ width: '100%', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-end' }}
        >
          {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
        </button>
      </div>
    </aside>
  );
};
