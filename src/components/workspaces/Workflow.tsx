import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';

interface FlowNodeData {
  id: string;
  step: string;
  title: string;
  meta: string;
  status: 'active' | 'pass' | 'warning' | 'error' | 'neutral';
  details: string;
}

export const Workflow: React.FC = () => {
  const { frame, diagnostics, mode } = useTelemetry();
  const [selectedNodeId, setSelectedNodeId] = useState<string>('08');

  const isOpen = frame.valve_actuator.main_solenoid_state === 'OPEN';
  const isFrozen = frame.quarantine_engine.learning_frozen;

  const nodes: FlowNodeData[] = [
    {
      id: '01',
      step: '01',
      title: 'Inlet Sensing',
      meta: `${frame.telemetry.tds.value.toFixed(0)} ppm · 1 Hz`,
      status: 'pass',
      details: 'Tri-parametric sensing chamber (TDS, pH, temperature) upstream of main valve. Continuous 1 Hz telemetry acquisition.',
    },
    {
      id: '02',
      step: '02',
      title: 'Freshness Gate',
      meta: mode === 'HARDWARE' ? 'USB packet fresh' : 'Simulation stream',
      status: 'pass',
      details: 'Evaluates packet sequencing, sample timestamps, and hardware acquisition freshness flags. Prevents stagnant sample replay.',
    },
    {
      id: '03',
      step: '03',
      title: 'Sensor Validation',
      meta: diagnostics.fault ? 'Sensor fault' : 'Range passed',
      status: diagnostics.fault ? 'error' : 'pass',
      details: diagnostics.fault
        ? `Active fault: ${diagnostics.fault}`
        : 'All sensor intervals valid. Range, freshness, and electrical integrity verified. Regression estimates cannot grant flow permission.',
    },
    {
      id: '04',
      step: '04',
      title: '30-Day Baseline',
      meta: isFrozen ? 'Baseline frozen' : 'Learning active',
      status: isFrozen ? 'warning' : 'pass',
      details: isFrozen
        ? 'Learning quarantine triggered by CUSUM drift detection. New samples quarantined until operator validation.'
        : `Source-specific rolling baseline qualified. Current S+ = ${frame.quarantine_engine.cusum_s_plus.toFixed(2)}; threshold = ${frame.quarantine_engine.threshold_h}.`,
    },
    {
      id: '05',
      step: '05',
      title: 'Temporal Patterns',
      meta: diagnostics.temporal || 'Intervals stable',
      status: 'pass',
      details: `Temporal pattern analysis and interval covariance. Rolling Pearson correlation: TDS/pH ${diagnostics.correlationTdsPh.toFixed(2)}, TDS/Temp ${diagnostics.correlationTdsTemp.toFixed(2)}.`,
    },
    {
      id: '06',
      step: '06',
      title: 'Source Resemblance',
      meta: `${frame.source_profile.active_profile} (${(frame.source_profile.confidence_pct || 94).toFixed(0)}%)`,
      status: frame.source_profile.unknown_source_locked ? 'error' : 'pass',
      details: `Normalized distance: ${frame.source_profile.mahalanobis_distance.toFixed(2)} vs threshold ${frame.source_profile.threshold}. Distance score describes resemblance, not proven contaminant origin.`,
    },
    {
      id: '07',
      step: '07',
      title: 'Membrane Stress',
      meta: `Stress: ${frame.exposure_accounting.admitted_exposure_cmsi.toFixed(0)} s`,
      status: 'pass',
      details: `Cumulative membrane stress index proxy: 0.8·max(0, TDS-300) + 120·|pH-7| + 15·max(0, T-25). Avoided stress share: ${frame.exposure_accounting.damage_reduction_pct.toFixed(1)}%.`,
    },
    {
      id: '08',
      step: '08',
      title: 'Risk Decision',
      meta: `${frame.fsm_recovery.current_state} · AND gate`,
      status: isOpen ? 'pass' : 'warning',
      details: `Metrological AND-logic criterion: all parameter bounds AND verified source AND recovery FSM must pass simultaneously to authorize valve energization.`,
    },
    {
      id: '09',
      step: '09',
      title: 'Valve Interlock',
      meta: `Main: ${frame.valve_actuator.main_solenoid_state}`,
      status: isOpen ? 'active' : 'neutral',
      details: `Mutual exclusion hardware interlock: main and drain commands cannot be energized concurrently. Transition cycles logged: ${frame.valve_actuator.total_cycles_logged}.`,
    },
    {
      id: '10',
      step: '10',
      title: 'ESP32 Watchdog',
      meta: '2.5s expiry armed',
      status: 'pass',
      details: 'Local hardware watchdog on microcontroller forces normally-closed fail-safe shutoff if communication heartbeats drop for >2.5s.',
    },
    {
      id: '11',
      step: '11',
      title: 'Flow Feedback',
      meta: isOpen ? 'Actuator energized' : 'De-energized (NC)',
      status: isOpen ? 'pass' : 'neutral',
      details: 'Solenoid driver state confirmed by firmware sequence acknowledgement. Physical shutoff requires auxiliary flow sensor verification.',
    },
  ];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[7];

  const renderNodeCard = (node: FlowNodeData) => {
    const isSelected = node.id === selectedNodeId;
    const statusDot =
      node.status === 'pass'
        ? 'status-dot--success'
        : node.status === 'warning'
          ? 'status-dot--warning'
          : node.status === 'error'
            ? 'status-dot--error'
            : node.status === 'active'
              ? 'status-dot--active'
              : 'status-dot--neutral';

    return (
      <button
        key={node.id}
        onClick={() => setSelectedNodeId(node.id)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderRadius: 'var(--radius-control)',
          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-quiet)'}`,
          backgroundColor: isSelected ? 'var(--surface-raised)' : 'var(--surface-navigation)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all var(--motion-hover)',
          minHeight: '72px',
          position: 'relative',
        }}
        title="Click to inspect node details"
      >
        {/* Top row: Step + Dot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-family-mono)',
              color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            {node.step}
          </span>
          <span className={`status-dot ${statusDot}`} style={{ width: '6px', height: '6px' }} />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
            lineHeight: 1.25,
            marginTop: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
          }}
        >
          {node.title}
        </div>

        {/* One-line Metadata */}
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-family-mono)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            marginTop: '3px',
          }}
        >
          {node.meta}
        </div>
      </button>
    );
  };

  return (
    <div className="ui-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            System Flow
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>· Pipeline Architecture</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`ui-badge ${isOpen ? 'ui-badge--subtle-success' : 'ui-badge--subtle-warning'}`} style={{ fontSize: '11px', padding: '3px 10px' }}>
            <span className={`status-dot ${isOpen ? 'status-dot--success' : 'status-dot--warning'}`} />
            <span>{isOpen ? 'Flow Authorized' : 'Gate Latched Closed'}</span>
          </span>
        </div>
      </div>

      {/* 2-Tier Balanced Pipeline Flow: Nodes 01-06 on Row 1, Nodes 07-11 on Row 2 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="flow-grid-row-1">
          {nodes.slice(0, 6).map((node) => renderNodeCard(node))}
        </div>
        <div className="flow-grid-row-2">
          {nodes.slice(6, 11).map((node) => renderNodeCard(node))}
        </div>
      </div>

      {/* Node Inspector Bar (Progressive Disclosure) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: 'var(--radius-control)',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-quiet)',
          fontSize: '12px',
          gap: '12px',
          minHeight: '38px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
            STAGE [{selectedNode.step} {selectedNode.title.toUpperCase()}]:
          </span>
          <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedNode.details}
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
          Click any step to inspect
        </span>
      </div>
    </div>
  );
};
