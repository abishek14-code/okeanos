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
    },
    {
      id: 'quarantine',
      label: 'Quarantine & Drift',
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
      label: 'Recovery / FSM & Purge',
      icon: <RecoveryFsmIcon size={16} />,
    },
    {
      id: 'exposure',
      label: 'Exposure & Membrane',
      icon: <ExposureIcon size={16} />,
    },
    {
      id: 'challenge',
      label: 'Challenge Replay',
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
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-control)',
                        backgroundColor: 'rgba(232, 160, 160, 0.12)',
                        color: 'var(--feedback-error)',
                        fontFamily: 'var(--font-family-mono)',
                        border: '1px solid rgba(232, 160, 160, 0.25)',
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

      {/* Collapse/Expand Footer */}
      <div className="sidebar__footer">
        <button
          className="ui-btn ui-btn--ghost ui-btn--icon"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{ width: '100%', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-end', height: '28px' }}
        >
          {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
        </button>
      </div>
    </aside>
  );
};
