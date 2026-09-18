export interface SensorMetric {
  value: number;
  uncertainty: number;
  unit: string;
  raw_adc: number;
  status: 'pass' | 'hold' | 'fail';
  u_cal: number;
  u_noise: number;
  u_age: number;
  lower_bound: number;
  upper_bound: number;
  historical_values?: number[];
}

export interface TelemetryData {
  tds: SensorMetric;
  ph: SensorMetric;
  temp: SensorMetric;
}

export interface QuarantineEngineState {
  status: 'NORMAL' | 'QUARANTINE_ACTIVE' | 'BASELINE_FROZEN';
  cusum_s_plus: number;
  cusum_s_minus: number;
  threshold_h: number;
  reference_k: number;
  learning_frozen: boolean;
  quarantined_samples_count: number;
  quarantined_mean: number;
  baseline_mean: number;
  baseline_sigma: number;
  trusted_records_count: number;
  cusum_history: { time: string; s_plus: number; s_minus: number }[];
}

export interface SourceProfileState {
  active_profile: 'MUNICIPAL' | 'BOREWELL' | 'RAINWATER' | 'UNKNOWN (LOCKED)';
  active_source: string;
  confidence_score: number;
  confidence_pct: number;
  mahalanobis_distance: number;
  threshold: number;
  unknown_source_locked: boolean;
  municipal_distance: number;
  borewell_distance: number;
  rainwater_distance: number;
}

export type FsmState =
  | 'NORMAL'
  | 'SUSPECT'
  | 'BLOCKED'
  | 'RECOVERY_CHECK'
  | 'RESTORED'
  | 'NORMAL_FLOW'
  | 'ANOMALY_LOCKOUT'
  | 'PURGE_ACTIVE'
  | 'SENSOR_SETTLING'
  | 'RESIDUAL_HOLD'
  | 'GATE_RESTORED';

export interface FsmRecoveryState {
  current_state: FsmState;
  stagnant_chamber_flag: boolean;
  recovery_timer_seconds: number;
  violation_timer_seconds: number;
  purge_timer_seconds: number;
  hysteresis_margin_pct: number;
  time_in_state_seconds: number;
  time_in_state_s: number;
  purge_countdown_s: number;
  settling_countdown_s: number;
  consecutive_pass_samples: number;
  required_pass_samples: number;
}

export interface AntiStagnationState {
  time_until_purge_s: number;
  biofilm_risk_pct: number;
  outgassing_risk_pct: number;
}

export interface CalibrationEngineState {
  ph_nernst_slope_pct: number;
  days_since_calibration: number;
  tds_uncertainty_budget: {
    u_adc_quant: number;
    u_temp_drift: number;
    u_cal_residual: number;
    u_aging: number;
    u_noise: number;
    combined_uncertainty_uc: number;
    expanded_uncertainty_k2: number;
  };
}

export interface ValveActuatorState {
  main_solenoid_state: 'OPEN' | 'CLOSED';
  drain_flush_state: 'OPEN' | 'CLOSED';
  blockage_reason: 'NONE' | 'MEASURED_BREACH' | 'UNCERTAINTY_OVERLAP' | 'EMERGENCY_SHUTDOWN';
  chatter_lockout_active: boolean;
  actuation_latency_ms: number;
  total_cycles_logged: number;
  max_rated_cycles: number;
  emergency_override_active: boolean;
  emergency_time_remaining_secs: number;
}

export interface ExposureAccountingState {
  admitted_exposure_cmsi: number;
  prevented_exposure_cmsi: number;
  cmsi_limit: number;
  days_remaining_projected: number;
  daily_stress_velocity: number;
  damage_reduction_pct: number;
  nominal_volume_passed_l: number;
  nominal_mass_passed_mg: number;
  rejected_volume_purged_l: number;
  rejected_mass_diverted_mg: number;
  cmsi_current: number;
  cmsi_max_limit: number;
  membrane_rul_pct: number;
  thermal_factor: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'CAUTION' | 'CRITICAL';
  subsystem: 'GATING' | 'CUSUM' | 'FSM' | 'VALVE' | 'CALIBRATION' | 'SOURCE';
  message: string;
}

export interface FlightRecorderLogItem {
  id: string;
  timestamp: string;
  event_type: string;
  trigger: string;
  value_recorded: number;
  uncertainty_recorded?: number;
  hash_signature: string;
}

export interface ChallengeScenario {
  id: string;
  name: string;
  description: string;
  duration_seconds: number;
}

export interface ChallengeRunState {
  active_scenario_id: string | null;
  is_running: boolean;
  step_progress: number;
  speed_multiplier: number;
  legacy_valve_open: boolean;
  legacy_chatter_cycles: number;
  legacy_admitted_stress: number;
  legacy_baseline_contaminated: boolean;
  okeanos_valve_open: boolean;
  okeanos_chatter_cycles: number;
  okeanos_admitted_stress: number;
  okeanos_baseline_contaminated: boolean;
  history: {
    time_sec: number;
    injected_val: number;
    legacy_valve: number;
    okeanos_valve: number;
  }[];
}

export interface SystemFlightRecorderFrame {
  timestamp: number;
  uptime_seconds: number;
  telemetry: TelemetryData;
  quarantine_engine: QuarantineEngineState;
  source_profile: SourceProfileState;
  fsm_recovery: FsmRecoveryState;
  recovery_fsm: FsmRecoveryState;
  anti_stagnation: AntiStagnationState;
  calibration_engine: CalibrationEngineState;
  valve_actuator: ValveActuatorState;
  exposure_accounting: ExposureAccountingState;
  flight_recorder_log: FlightRecorderLogItem[];
}
