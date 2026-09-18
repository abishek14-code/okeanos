import React, { useState, useEffect } from 'react';
import { Sidebar, WorkspaceId } from './components/shell/Sidebar';
import { TopBar } from './components/shell/TopBar';
import { ThemeControlModal } from './components/shell/ThemeControlModal';
import { CommandCenter } from './components/workspaces/CommandCenter';
import { QuarantineMonitor } from './components/workspaces/QuarantineMonitor';
import { UncertaintyCalibration } from './components/workspaces/UncertaintyCalibration';
import { SourceProfiles } from './components/workspaces/SourceProfiles';
import { RecoveryFSM } from './components/workspaces/RecoveryFSM';
import { ExposureAccounting } from './components/workspaces/ExposureAccounting';
import { ChallengeReplayRig } from './components/workspaces/ChallengeReplayRig';
import { AuditTrailConfig } from './components/workspaces/AuditTrailConfig';
import { useTheme } from './context/ThemeContext';

export const App: React.FC = () => {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('command');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const { isThemeModalOpen, toggleThemeModal } = useTheme();

  // Keyboard navigation shortcuts: Ctrl+1 through Ctrl+8, Ctrl+T for theme
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleThemeModal();
      }

      if (e.altKey) {
        const keyMap: { [key: string]: WorkspaceId } = {
          '1': 'command',
          '2': 'quarantine',
          '3': 'uncertainty',
          '4': 'sources',
          '5': 'recovery',
          '6': 'exposure',
          '7': 'challenge',
          '8': 'audit',
        };
        if (keyMap[e.key]) {
          e.preventDefault();
          setActiveWorkspace(keyMap[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleThemeModal]);

  const renderActiveWorkspace = () => {
    switch (activeWorkspace) {
      case 'command':
        return <CommandCenter />;
      case 'quarantine':
        return <QuarantineMonitor />;
      case 'uncertainty':
        return <UncertaintyCalibration />;
      case 'sources':
        return <SourceProfiles />;
      case 'recovery':
        return <RecoveryFSM />;
      case 'exposure':
        return <ExposureAccounting />;
      case 'challenge':
        return <ChallengeReplayRig />;
      case 'audit':
        return <AuditTrailConfig />;
      default:
        return <CommandCenter />;
    }
  };

  return (
    <div className="app-shell">
      {/* Top Application Bar */}
      <TopBar />

      {/* Main Workspace Frame */}
      <div className="app-shell__body">
        {/* Navigation Sidebar */}
        <Sidebar
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={setActiveWorkspace}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Viewport for Active Workspace */}
        <main className="app-shell__content">
          {renderActiveWorkspace()}
        </main>
      </div>

      {/* Live Theme Control Modal */}
      {isThemeModalOpen && <ThemeControlModal />}
    </div>
  );
};

export default App;
