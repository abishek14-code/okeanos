import type { SystemFlightRecorderFrame } from '../types/telemetry.ts';
const blueprint: SystemFlightRecorderFrame = {
  timestamp: Math.floor(Date.now() / 1000),
  uptime_seconds: 310800, // 3d 14h 20m
  telemetry: {
    tds: {
      value: 386.4,
      uncertainty: 18.2,
      unit: 'ppm',
      raw_adc: 1842,
      status: 'pass',
      u_cal: 12.0,
      u_noise: 6.2,
      u_age: 4.1,
      lower_bound: 100.0,
      upper_bound: 800.0,
      historical_values: [382, 384, 385, 386, 387, 386.4],
    },
    ph: {
      value: 7.28,
      uncertainty: 0.09,
      unit: 'pH',
      raw_adc: 2410,
      status: 'pass',
      u_cal: 0.04,
      u_noise: 0.03,
      u_age: 0.06,
      lower_bound: 6.5,
      upper_bound: 8.5,
      historical_values: [7.25, 7.26, 7.27, 7.28, 7.28],
    },
    temp: {
      value: 28.2,
      uncertainty: 0.40,
      unit: '°C',
      raw_adc: 982,
      status: 'pass',
      u_cal: 0.25,
      u_noise: 0.06,
      u_age: 0.10,
      lower_bound: 10.0,
      upper_bound: 45.0,
      historical_values: [28.0, 28.1, 28.1, 28.2, 28.2],
    },
  },
  quarantine_engine: {
    status: 'NORMAL',
    cusum_s_plus: 0.42,
    cusum_s_minus: 0.12,
    threshold_h: 4.5,
    reference_k: 0.5,
    learning_frozen: false,
    quarantined_samples_count: 0,
    quarantined_mean: 0.0,
    baseline_mean: 382.1,
    baseline_sigma: 21.4,
    trusted_records_count: 2592000,
    cusum_history: [
      { time: '15:41:00', s_plus: 0.12, s_minus: 0.04 },
      { time: '15:41:30', s_plus: 0.28, s_minus: 0.08 },
      { time: '15:42:00', s_plus: 0.42, s_minus: 0.12 },
    ],
  },
  source_profile: {
    active_profile: 'MUNICIPAL',
    active_source: 'Municipal Grid (City Main)',
    confidence_score: 0.962,
    confidence_pct: 96.2,
    mahalanobis_distance: 0.82,
    threshold: 3.50,
    unknown_source_locked: false,
    municipal_distance: 0.82,
    borewell_distance: 4.61,
    rainwater_distance: 6.85,
  },
  fsm_recovery: {
    current_state: 'NORMAL',
    stagnant_chamber_flag: false,
    recovery_timer_seconds: 0,
    violation_timer_seconds: 0,
    purge_timer_seconds: 0,
    hysteresis_margin_pct: 5.0,
    time_in_state_seconds: 1420,
    time_in_state_s: 1420,
    purge_countdown_s: 0,
    settling_countdown_s: 0,
    consecutive_pass_samples: 30,
    required_pass_samples: 30,
  },
  recovery_fsm: {
    current_state: 'NORMAL_FLOW',
    stagnant_chamber_flag: false,
    recovery_timer_seconds: 0,
    violation_timer_seconds: 0,
    purge_timer_seconds: 0,
    hysteresis_margin_pct: 5.0,
    time_in_state_seconds: 1420,
    time_in_state_s: 1420,
    purge_countdown_s: 0,
    settling_countdown_s: 0,
    consecutive_pass_samples: 30,
    required_pass_samples: 30,
  },
  anti_stagnation: {
    time_until_purge_s: 10420,
    biofilm_risk_pct: 14.5,
    outgassing_risk_pct: 8.2,
  },
  calibration_engine: {
    ph_nernst_slope_pct: 98.4,
    days_since_calibration: 6,
    tds_uncertainty_budget: {
      u_adc_quant: 3.2,
      u_temp_drift: 4.5,
      u_cal_residual: 5.0,
      u_aging: 2.1,
      u_noise: 3.8,
      combined_uncertainty_uc: 9.1,
      expanded_uncertainty_k2: 18.2,
    },
  },
  valve_actuator: {
    main_solenoid_state: 'OPEN',
    drain_flush_state: 'CLOSED',
    blockage_reason: 'NONE',
    chatter_lockout_active: false,
    actuation_latency_ms: 35,
    total_cycles_logged: 1428,
    max_rated_cycles: 100000,
    emergency_override_active: false,
    emergency_time_remaining_secs: 0,
  },
  exposure_accounting: {
    admitted_exposure_cmsi: 2841200,
    prevented_exposure_cmsi: 14892400,
    cmsi_limit: 5000000,
    days_remaining_projected: 142,
    daily_stress_velocity: 15200,
    damage_reduction_pct: 84.0,
    nominal_volume_passed_l: 84200,
    nominal_mass_passed_mg: 32501200,
    rejected_volume_purged_l: 340,
    rejected_mass_diverted_mg: 1845000,
    cmsi_current: 2841200,
    cmsi_max_limit: 5000000,
    membrane_rul_pct: 78.4,
    thermal_factor: 1.08,
  },
  flight_recorder_log: [
    {
      id: 'blk_1042',
      timestamp: '2026-09-18T15:40:02Z',
      event_type: 'SYSTEM_BOOT',
      trigger: 'Power On Reset',
      value_recorded: 386.4,
      uncertainty_recorded: 18.2,
      hash_signature: '7e8f90a1b2c3d4e5f60718293a4b5c6d',
    },
    {
      id: 'blk_1043',
      timestamp: '2026-09-18T15:41:20Z',
      event_type: 'GATE_RESTORED',
      trigger: 'Metrological interval verified',
      value_recorded: 385.1,
      uncertainty_recorded: 18.2,
      hash_signature: '9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
    },
  ],
};

export function createInitialFrame(): SystemFlightRecorderFrame {
 const f = structuredClone(blueprint);
 f.timestamp = 0; f.uptime_seconds = 0;
 f.flight_recorder_log = [];
 f.quarantine_engine = { ...f.quarantine_engine, cusum_s_plus:0, cusum_s_minus:0, learning_frozen:true,
 status:'BASELINE_FROZEN', trusted_records_count:0, quarantined_samples_count:0,
 baseline_mean:360, baseline_sigma:25, cusum_history:[] };
 f.fsm_recovery = { ...f.fsm_recovery, current_state:'BLOCKED', stagnant_chamber_flag:true,
 consecutive_pass_samples:0, time_in_state_seconds:0, time_in_state_s:0 };
 f.recovery_fsm = {...f.fsm_recovery, current_state:'ANOMALY_LOCKOUT'};
 f.valve_actuator = { ...f.valve_actuator, main_solenoid_state:'CLOSED', total_cycles_logged:0,
 actuation_latency_ms:0, blockage_reason:'STARTUP'};
 for (const key of Object.keys(f.exposure_accounting) as (keyof typeof f.exposure_accounting)[]) f.exposure_accounting[key]=0;
 f.exposure_accounting.cmsi_limit=5000000; f.exposure_accounting.cmsi_max_limit=5000000;
 f.anti_stagnation={time_until_purge_s:14400,biofilm_risk_pct:0,outgassing_risk_pct:0};
 f.calibration_engine.ph_nernst_slope_pct=0; f.calibration_engine.days_since_calibration=0;
 f.source_profile.confidence_score=0; f.source_profile.confidence_pct=0;
 for (const key of ['tds','ph','temp'] as const) { f.telemetry[key].historical_values=[]; f.telemetry[key].raw_adc=0; f.telemetry[key].status='hold'; }
 f.telemetry.tds.value=360; f.telemetry.ph.value=7.35; f.telemetry.temp.value=26;
 return f;
}
