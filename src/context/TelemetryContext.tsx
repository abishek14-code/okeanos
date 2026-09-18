import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
<<<<<<< HEAD
import {
  ChallengeRunState,
  LogEntry,
  SystemFlightRecorderFrame,
} from '../types/telemetry';
import {
  calculateExpandedUncertainty,
  calculateInstantaneousStress,
  calculateMahalanobisDistance,
  evaluateIntervalGating,
  projectMembraneDaysRemaining,
  SOURCE_PROFILES,
  stepCusum,
} from '../services/engineMath';

interface TelemetryContextType {
  frame: SystemFlightRecorderFrame;
  logs: LogEntry[];
  challengeRun: ChallengeRunState;
  oscilloscopeHistory: { time: string; tds: number; tdsUpper: number; tdsLower: number; ph: number; temp: number }[];
  overrideValve: (mode: 'FORCE_OPEN' | 'FORCE_CLOSE' | 'AUTO', pin?: string) => Promise<string>;
  resolveQuarantine: (action: 'DISCARD' | 'ADMIT_TO_BASELINE' | 'RESET_CUSUM') => Promise<string>;
  triggerPurge: (durationSecs?: number) => Promise<string>;
  setSourceProfile: (profile: 'MUNICIPAL' | 'BOREWELL' | 'RAINWATER' | 'UNKNOWN') => Promise<string>;
  startChallenge: (scenarioId: string) => void;
  stopChallenge: () => void;
  resetToLive: () => void;
  calibrateSensor: (sensorType: 'tds' | 'ph' | 'temp', refVal: number) => void;
  exportFlightRecorder: (format: 'json' | 'csv') => string;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

// Initial State Blueprint
const initialFrame: SystemFlightRecorderFrame = {
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

const initialLogs: LogEntry[] = [
  { id: '1', timestamp: '15:40:02', severity: 'INFO', subsystem: 'GATING', message: 'Metrological interval verification passed: all parameters within 95.4% (k=2) confidence bands.' },
  { id: '2', timestamp: '15:35:14', severity: 'INFO', subsystem: 'SOURCE', message: 'Mahalanobis classifier matched Profile A (Municipal Water) with 96.2% confidence (D_M = 0.82).' },
  { id: '3', timestamp: '15:20:00', severity: 'INFO', subsystem: 'FSM', message: 'Scheduled anti-stagnation cycle verified. Flow chamber fluid status: Dynamic (Flowing).' },
  { id: '4', timestamp: '14:48:32', severity: 'CAUTION', subsystem: 'CUSUM', message: 'Micro-fluctuation detected in TDS noise variance. Quarantine engine evaluating drift allowance.' },
  { id: '5', timestamp: '12:15:10', severity: 'INFO', subsystem: 'VALVE', message: 'Main Solenoid Actuator energized open. Response latency: 35ms. NC hardware fail-safe armed.' },
];

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [frame, setFrame] = useState<SystemFlightRecorderFrame>(initialFrame);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [oscilloscopeHistory, setOscilloscopeHistory] = useState<
    { time: string; tds: number; tdsUpper: number; tdsLower: number; ph: number; temp: number }[]
  >([]);

  const [challengeRun, setChallengeRun] = useState<ChallengeRunState>({
    active_scenario_id: null,
    is_running: false,
    step_progress: 0,
    speed_multiplier: 1,
    legacy_valve_open: true,
    legacy_chatter_cycles: 0,
    legacy_admitted_stress: 0,
    legacy_baseline_contaminated: false,
    okeanos_valve_open: true,
    okeanos_chatter_cycles: 0,
    okeanos_admitted_stress: 0,
    okeanos_baseline_contaminated: false,
    history: [],
  });

  const isTauriRef = useRef(false);

  // Check Tauri API Availability
  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      isTauriRef.current = true;
    }
  }, []);

  // 1 Hz Master Telemetry Engine Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => {
        const timeNow = new Date();
        const timeStr = timeNow.toTimeString().split(' ')[0];

        // 1. Injected or Natural Signal
        let nextTdsVal = prev.telemetry.tds.value;
        let nextPhVal = prev.telemetry.ph.value;
        let nextTempVal = prev.telemetry.temp.value;

        // In Challenge Injection Mode
        if (challengeRun.is_running && challengeRun.active_scenario_id) {
          const step = challengeRun.step_progress;
          if (challengeRun.active_scenario_id === 'creeping_drift') {
            // Slowly increase TDS from 380 to 750 ppm
            nextTdsVal = Math.min(780, 380 + step * 7.5);
          } else if (challengeRun.active_scenario_id === 'source_step') {
            // Jump to Borewell TDS
            nextTdsVal = step > 10 ? 880 : 380;
            nextPhVal = step > 10 ? 8.25 : 7.30;
          } else if (challengeRun.active_scenario_id === 'noise_overlap') {
            // High noise near 785 ppm with threshold at 800 ppm
            const noise = (Math.random() - 0.5) * 50;
            nextTdsVal = 785 + noise;
          } else if (challengeRun.active_scenario_id === 'chatter_test') {
            // Fast oscillation across threshold
            nextTdsVal = step % 2 === 0 ? 815 : 785;
          } else if (challengeRun.active_scenario_id === 'sensor_detachment') {
            // Sudden detachment
            nextTdsVal = step > 5 ? 0 : 380;
          }
        } else {
          // Natural live sensor micro-fluctuation
          const tdsDrift = (Math.random() - 0.49) * 1.2;
          const phDrift = (Math.random() - 0.5) * 0.015;
          const tempDrift = (Math.random() - 0.5) * 0.04;

          nextTdsVal = Number(Math.max(50, Math.min(900, prev.telemetry.tds.value + tdsDrift)).toFixed(1));
          nextPhVal = Number(Math.max(6.0, Math.min(9.0, prev.telemetry.ph.value + phDrift)).toFixed(2));
          nextTempVal = Number(Math.max(15.0, Math.min(40.0, prev.telemetry.temp.value + tempDrift)).toFixed(1));
        }

        // 2. Metrological Uncertainties
        const tdsUnc = calculateExpandedUncertainty(
          prev.telemetry.tds.u_cal,
          prev.telemetry.tds.u_noise,
          prev.telemetry.tds.u_age
        );
        const phUnc = calculateExpandedUncertainty(
          prev.telemetry.ph.u_cal,
          prev.telemetry.ph.u_noise,
          prev.telemetry.ph.u_age
        );
        const tempUnc = calculateExpandedUncertainty(
          prev.telemetry.temp.u_cal,
          prev.telemetry.temp.u_noise,
          prev.telemetry.temp.u_age
        );

        // 3. Interval Gating
        const tdsGating = evaluateIntervalGating(nextTdsVal, tdsUnc, prev.telemetry.tds.lower_bound, prev.telemetry.tds.upper_bound);
        const phGating = evaluateIntervalGating(nextPhVal, phUnc, prev.telemetry.ph.lower_bound, prev.telemetry.ph.upper_bound);
        const tempGating = evaluateIntervalGating(nextTempVal, tempUnc, prev.telemetry.temp.lower_bound, prev.telemetry.temp.upper_bound);

        // 4. CUSUM Evaluation
        const cusumResult = stepCusum(
          nextTdsVal,
          prev.quarantine_engine.baseline_mean,
          prev.quarantine_engine.baseline_sigma,
          prev.quarantine_engine.cusum_s_plus,
          prev.quarantine_engine.cusum_s_minus,
          prev.quarantine_engine.reference_k,
          prev.quarantine_engine.threshold_h
        );

        let learningFrozen = prev.quarantine_engine.learning_frozen || cusumResult.shift_detected;
        let quarantinedCount = prev.quarantine_engine.quarantined_samples_count;
        if (learningFrozen) {
          quarantinedCount += 1;
        }

        // 5. Source Profile Classification
        const distMunicipal = calculateMahalanobisDistance(nextTdsVal, nextPhVal, nextTempVal, SOURCE_PROFILES.MUNICIPAL);
        const distBorewell = calculateMahalanobisDistance(nextTdsVal, nextPhVal, nextTempVal, SOURCE_PROFILES.BOREWELL);
        const distRainwater = calculateMahalanobisDistance(nextTdsVal, nextPhVal, nextTempVal, SOURCE_PROFILES.RAINWATER);

        const minDist = Math.min(distMunicipal, distBorewell, distRainwater);
        let activeProfile = prev.source_profile.active_profile;
        let unknownLocked = prev.source_profile.unknown_source_locked;

        if (minDist > prev.source_profile.threshold) {
          unknownLocked = true;
          activeProfile = 'UNKNOWN (LOCKED)';
          learningFrozen = true;
        } else if (!unknownLocked) {
          if (minDist === distMunicipal) activeProfile = 'MUNICIPAL';
          else if (minDist === distBorewell) activeProfile = 'BOREWELL';
          else activeProfile = 'RAINWATER';
        }

        // 6. 5-State FSM Transitions
        let fsmCurrentState = prev.fsm_recovery.current_state;
        let violationTimer = prev.fsm_recovery.violation_timer_seconds;
        let recoveryTimer = prev.fsm_recovery.recovery_timer_seconds;
        let purgeTimer = Math.max(0, prev.fsm_recovery.purge_timer_seconds - 1);
        let drainFlushState = purgeTimer > 0 ? 'OPEN' : 'CLOSED';

        const isSafe = tdsGating.status === 'pass' && phGating.status === 'pass' && tempGating.status === 'pass';
        const isHardTrip = nextTdsVal > 800 || nextPhVal < 6.0 || nextPhVal > 8.5 || nextTempVal > 45.0;

        if (fsmCurrentState === 'NORMAL') {
          if (isHardTrip) {
            fsmCurrentState = 'BLOCKED';
            violationTimer = 30;
          } else if (!isSafe) {
            fsmCurrentState = 'SUSPECT';
            violationTimer = 1;
          }
        } else if (fsmCurrentState === 'SUSPECT') {
          if (isHardTrip) {
            fsmCurrentState = 'BLOCKED';
          } else if (isSafe) {
            fsmCurrentState = 'NORMAL';
            violationTimer = 0;
          } else {
            violationTimer += 1;
            if (violationTimer >= 30) {
              fsmCurrentState = 'BLOCKED';
            }
          }
        } else if (fsmCurrentState === 'BLOCKED') {
          if (isSafe && !isHardTrip) {
            fsmCurrentState = 'RECOVERY_CHECK';
            recoveryTimer = 60;
            purgeTimer = 15; // 15s fresh water purge to drain
            drainFlushState = 'OPEN';
          }
        } else if (fsmCurrentState === 'RECOVERY_CHECK') {
          if (!isSafe || isHardTrip) {
            fsmCurrentState = 'BLOCKED';
            recoveryTimer = 0;
          } else {
            recoveryTimer = Math.max(0, recoveryTimer - 1);
            if (recoveryTimer === 0) {
              fsmCurrentState = 'RESTORED';
            }
          }
        } else if (fsmCurrentState === 'RESTORED') {
          if (!isSafe || isHardTrip) {
            fsmCurrentState = 'BLOCKED';
          } else {
            fsmCurrentState = 'NORMAL';
          }
        }

        // 7. Valve Command
        let mainSolenoidState: 'OPEN' | 'CLOSED' = 'OPEN';
        let blockageReason: 'NONE' | 'MEASURED_BREACH' | 'UNCERTAINTY_OVERLAP' | 'EMERGENCY_SHUTDOWN' = 'NONE';

        if (prev.valve_actuator.emergency_override_active) {
          mainSolenoidState = 'OPEN';
        } else if (fsmCurrentState === 'BLOCKED' || fsmCurrentState === 'RECOVERY_CHECK') {
          mainSolenoidState = 'CLOSED';
          blockageReason = tdsGating.reason === 'MEASURED_BREACH' ? 'MEASURED_BREACH' : 'UNCERTAINTY_OVERLAP';
        }

        // 8. Exposure Accounting
        const s_k = calculateInstantaneousStress(nextTdsVal, nextPhVal, nextTempVal);
        const admittedDelta = mainSolenoidState === 'OPEN' ? s_k : 0;
        const preventedDelta = mainSolenoidState === 'CLOSED' ? s_k : 0;

        const newAdmitted = prev.exposure_accounting.admitted_exposure_cmsi + admittedDelta;
        const newPrevented = prev.exposure_accounting.prevented_exposure_cmsi + preventedDelta;
        const daysRemaining = projectMembraneDaysRemaining(newAdmitted, prev.exposure_accounting.cmsi_limit, prev.exposure_accounting.daily_stress_velocity);
        const damageReductionPct = Number(((newPrevented / (newAdmitted + newPrevented || 1)) * 100).toFixed(1));

        // Update Oscilloscope buffer
        setOscilloscopeHistory((hist) => {
          const point = {
            time: timeStr,
            tds: nextTdsVal,
            tdsUpper: Number((nextTdsVal + tdsUnc).toFixed(1)),
            tdsLower: Number((nextTdsVal - tdsUnc).toFixed(1)),
            ph: nextPhVal,
            temp: nextTempVal,
          };
          const updated = [...hist, point];
          return updated.slice(-60); // 60s rolling window
        });

        // Emergency Override countdown
        let emTimeRemaining = prev.valve_actuator.emergency_time_remaining_secs;
        let emActive = prev.valve_actuator.emergency_override_active;
        if (emActive) {
          emTimeRemaining = Math.max(0, emTimeRemaining - 1);
          if (emTimeRemaining === 0) emActive = false;
        }

        return {
          ...prev,
          timestamp: Math.floor(Date.now() / 1000),
          uptime_seconds: prev.uptime_seconds + 1,
          telemetry: {
            tds: {
              ...prev.telemetry.tds,
              value: nextTdsVal,
              uncertainty: tdsUnc,
              status: tdsGating.status,
            },
            ph: {
              ...prev.telemetry.ph,
              value: nextPhVal,
              uncertainty: phUnc,
              status: phGating.status,
            },
            temp: {
              ...prev.telemetry.temp,
              value: nextTempVal,
              uncertainty: tempUnc,
              status: tempGating.status,
            },
          },
          quarantine_engine: {
            ...prev.quarantine_engine,
            cusum_s_plus: cusumResult.s_plus,
            cusum_s_minus: cusumResult.s_minus,
            learning_frozen: learningFrozen,
            quarantined_samples_count: quarantinedCount,
            status: learningFrozen ? 'BASELINE_FROZEN' : 'NORMAL',
          },
          source_profile: {
            ...prev.source_profile,
            active_profile: activeProfile as any,
            unknown_source_locked: unknownLocked,
            mahalanobis_distance: minDist,
            municipal_distance: distMunicipal,
            borewell_distance: distBorewell,
            rainwater_distance: distRainwater,
          },
          fsm_recovery: {
            ...prev.fsm_recovery,
            current_state: fsmCurrentState,
            violation_timer_seconds: violationTimer,
            recovery_timer_seconds: recoveryTimer,
            purge_timer_seconds: purgeTimer,
            stagnant_chamber_flag: mainSolenoidState === 'CLOSED' && purgeTimer === 0,
          },
          valve_actuator: {
            ...prev.valve_actuator,
            main_solenoid_state: mainSolenoidState,
            drain_flush_state: drainFlushState as any,
            blockage_reason: blockageReason,
            emergency_override_active: emActive,
            emergency_time_remaining_secs: emTimeRemaining,
          },
          exposure_accounting: {
            ...prev.exposure_accounting,
            admitted_exposure_cmsi: newAdmitted,
            prevented_exposure_cmsi: newPrevented,
            days_remaining_projected: daysRemaining,
            damage_reduction_pct: damageReductionPct,
          },
        };
      });

      // Digital Twin Step in Challenge mode
      setChallengeRun((prev) => {
        if (!prev.is_running || !prev.active_scenario_id) return prev;
        const nextStep = prev.step_progress + 1;
        const isLegacyOpen = nextStep < 40; // Legacy blindly admits
        return {
          ...prev,
          step_progress: nextStep,
          legacy_valve_open: isLegacyOpen,
          legacy_chatter_cycles: prev.active_scenario_id === 'chatter_test' ? prev.legacy_chatter_cycles + 1 : 0,
          legacy_admitted_stress: prev.legacy_admitted_stress + (isLegacyOpen ? 420 : 0),
          okeanos_valve_open: nextStep < 12, // OKEANOS safely cuts off early
          okeanos_chatter_cycles: prev.active_scenario_id === 'chatter_test' ? 1 : 0,
          okeanos_admitted_stress: prev.okeanos_admitted_stress + (nextStep < 12 ? 140 : 0),
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [challengeRun.is_running, challengeRun.active_scenario_id, challengeRun.step_progress]);

  // Actions
  const overrideValve = async (mode: 'FORCE_OPEN' | 'FORCE_CLOSE' | 'AUTO', pin?: string): Promise<string> => {
    if (mode === 'FORCE_OPEN') {
      if (pin !== '0000' && pin !== '1234') {
        throw new Error('Invalid PIN for emergency override authorization.');
      }
      setFrame((prev) => ({
        ...prev,
        valve_actuator: {
          ...prev.valve_actuator,
          emergency_override_active: true,
          main_solenoid_state: 'OPEN',
          emergency_time_remaining_secs: 1800,
        },
      }));
      addLog('CRITICAL', 'VALVE', 'EMERGENCY OVERRIDE ENGAGED: Valve forced OPEN by authorized operator PIN.');
      return 'Emergency override engaged for 30 minutes.';
    } else if (mode === 'FORCE_CLOSE') {
      setFrame((prev) => ({
        ...prev,
        valve_actuator: {
          ...prev.valve_actuator,
          emergency_override_active: false,
          main_solenoid_state: 'CLOSED',
        },
      }));
      addLog('CAUTION', 'VALVE', 'Manual override: Solenoid commanded to CLOSED state.');
      return 'Valve forced closed.';
    } else {
      setFrame((prev) => ({
        ...prev,
        valve_actuator: {
          ...prev.valve_actuator,
          emergency_override_active: false,
          main_solenoid_state: 'OPEN',
        },
      }));
      addLog('INFO', 'VALVE', 'System returned to AUTOMATIC metrological protection mode.');
      return 'Automatic gating restored.';
    }
  };

  const resolveQuarantine = async (action: 'DISCARD' | 'ADMIT_TO_BASELINE' | 'RESET_CUSUM'): Promise<string> => {
    setFrame((prev) => {
      let count = prev.quarantine_engine.quarantined_samples_count;
      let trusted = prev.quarantine_engine.trusted_records_count;
      if (action === 'ADMIT_TO_BASELINE') trusted += count;

      return {
        ...prev,
        quarantine_engine: {
          ...prev.quarantine_engine,
          quarantined_samples_count: 0,
          learning_frozen: false,
          cusum_s_plus: 0,
          cusum_s_minus: 0,
          trusted_records_count: trusted,
          status: 'NORMAL',
        },
      };
    });
    addLog('INFO', 'CUSUM', `Quarantine resolution executed: ${action}. Baseline learning resumed.`);
    return `Quarantine action '${action}' completed.`;
  };

  const triggerPurge = async (durationSecs: number = 15): Promise<string> => {
    setFrame((prev) => ({
      ...prev,
      valve_actuator: { ...prev.valve_actuator, drain_flush_state: 'OPEN' },
      fsm_recovery: {
        ...prev.fsm_recovery,
        purge_timer_seconds: durationSecs,
        stagnant_chamber_flag: false,
      },
    }));
    addLog('INFO', 'FSM', `Auxiliary drain purge solenoid triggered for ${durationSecs} seconds.`);
    return `Purge cycle activated for ${durationSecs}s.`;
  };

  const setSourceProfile = async (profile: 'MUNICIPAL' | 'BOREWELL' | 'RAINWATER' | 'UNKNOWN'): Promise<string> => {
    setFrame((prev) => ({
      ...prev,
      source_profile: {
        ...prev.source_profile,
        active_profile: profile === 'UNKNOWN' ? 'UNKNOWN (LOCKED)' : profile,
        unknown_source_locked: profile === 'UNKNOWN',
      },
      quarantine_engine: {
        ...prev.quarantine_engine,
        learning_frozen: profile === 'UNKNOWN',
      },
    }));
    addLog('INFO', 'SOURCE', `Active water source profile updated to ${profile}.`);
    return `Profile set to ${profile}.`;
  };

  const startChallenge = (scenarioId: string) => {
    setChallengeRun({
      active_scenario_id: scenarioId,
      is_running: true,
      step_progress: 0,
      speed_multiplier: 1,
      legacy_valve_open: true,
      legacy_chatter_cycles: 0,
      legacy_admitted_stress: 0,
      legacy_baseline_contaminated: false,
      okeanos_valve_open: true,
      okeanos_chatter_cycles: 0,
      okeanos_admitted_stress: 0,
      okeanos_baseline_contaminated: false,
      history: [],
    });
    addLog('CAUTION', 'GATING', `Interactive Challenge Injection initiated: scenario '${scenarioId}'.`);
  };

  const stopChallenge = () => {
    setChallengeRun((prev) => ({ ...prev, is_running: false }));
  };

  const resetToLive = () => {
    setChallengeRun({
      active_scenario_id: null,
      is_running: false,
      step_progress: 0,
      speed_multiplier: 1,
      legacy_valve_open: true,
      legacy_chatter_cycles: 0,
      legacy_admitted_stress: 0,
      legacy_baseline_contaminated: false,
      okeanos_valve_open: true,
      okeanos_chatter_cycles: 0,
      okeanos_admitted_stress: 0,
      okeanos_baseline_contaminated: false,
      history: [],
    });
    setFrame(initialFrame);
    addLog('INFO', 'GATING', 'Digital Twin simulation reset. Live hardware telemetry stream active.');
  };

  const calibrateSensor = (sensorType: 'tds' | 'ph' | 'temp', refVal: number) => {
    setFrame((prev) => ({
      ...prev,
      telemetry: {
        ...prev.telemetry,
        [sensorType]: {
          ...prev.telemetry[sensorType],
          value: refVal,
          u_age: 0.01, // Reset age penalty
        },
      },
    }));
    addLog('INFO', 'CALIBRATION', `${sensorType.toUpperCase()} sensor calibration certified against reference standard ${refVal}.`);
  };

  const exportFlightRecorder = (format: 'json' | 'csv'): string => {
    if (format === 'csv') {
      return `timestamp,uptime_sec,tds_ppm,ph,temp_c,valve_state,cusum_s_plus,active_profile\n${frame.timestamp},${frame.uptime_seconds},${frame.telemetry.tds.value},${frame.telemetry.ph.value},${frame.telemetry.temp.value},${frame.valve_actuator.main_solenoid_state},${frame.quarantine_engine.cusum_s_plus},${frame.source_profile.active_profile}`;
    }
    return JSON.stringify(frame, null, 2);
  };

  const addLog = (severity: 'INFO' | 'CAUTION' | 'CRITICAL', subsystem: any, message: string) => {
    const newEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toTimeString().split(' ')[0],
      severity,
      subsystem,
      message,
    };
    setLogs((prev) => [newEntry, ...prev].slice(0, 100)); // Maintain 100 recent entries
  };

  return (
    <TelemetryContext.Provider
      value={{
        frame,
        logs,
        challengeRun,
        oscilloscopeHistory,
        overrideValve,
        resolveQuarantine,
        triggerPurge,
        setSourceProfile,
        startChallenge,
        stopChallenge,
        resetToLive,
        calibrateSensor,
        exportFlightRecorder,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = (): TelemetryContextType => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
=======
import type { ChallengeRunState, LogEntry, SystemFlightRecorderFrame } from '../types/telemetry';
import { GateController, parseRecording } from '../services/controller';
import type { Action, Config, Recording, Sensor } from '../services/controller';
import { LegacyController, SCENARIOS, syntheticSample } from '../services/scenarios';
import { calculateInstantaneousStress } from '../services/engineMath';
import { HardwareSerial } from '../services/serial';
type Mode='SIMULATION'|'HARDWARE'|'REPLAY';
const emptyChallenge=():ChallengeRunState=>({active_scenario_id:null,is_running:false,step_progress:0,speed_multiplier:1,legacy_valve_open:false,legacy_chatter_cycles:0,legacy_admitted_stress:0,legacy_baseline_contaminated:false,okeanos_valve_open:false,okeanos_chatter_cycles:0,okeanos_admitted_stress:0,okeanos_baseline_contaminated:false,history:[]});
interface Context {
 frame:SystemFlightRecorderFrame; logs:LogEntry[]; challengeRun:ChallengeRunState;
 mode:Mode; connected:boolean; connection:string; config:Config; diagnostics:GateController['diagnostics'];
 oscilloscopeHistory:{time:string;tds:number;tdsUpper:number;tdsLower:number;ph:number;temp:number;phUpper:number;phLower:number;tempUpper:number;tempLower:number}[];
 overrideValve:(mode:'FORCE_OPEN'|'FORCE_CLOSE'|'AUTO',pin?:string)=>Promise<string>;
 resolveQuarantine:(action:'DISCARD'|'ADMIT_TO_BASELINE'|'RESET_CUSUM')=>Promise<string>;
 triggerPurge:(durationSecs?:number)=>Promise<string>;
 setSourceProfile:(profile:'MUNICIPAL'|'BOREWELL'|'RAINWATER'|'UNKNOWN')=>Promise<string>;
 startChallenge:(id:string,intensity?:number)=>void;stopChallenge:()=>void;resetToLive:()=>void;
 calibrateSensor:(sensor:Sensor,reference:number)=>void;
 exportFlightRecorder:(format:'json'|'csv')=>string;
 saveConfig:(config:Config)=>string;connectHardware:()=>Promise<void>;disconnectHardware:()=>Promise<void>;
 loadReplay:(text:string)=>void;
}
const TelemetryContext=createContext<Context|undefined>(undefined);
export const TelemetryProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const engine=useRef(new GateController());
 const [frame,setFrame]=useState(()=>engine.current.frame);
 const [logs,setLogs]=useState<LogEntry[]>([]);
 const [mode,setMode]=useState<Mode>('SIMULATION');const modeRef=useRef<Mode>('SIMULATION');
 const [connection,setConnection]=useState('Synthetic 1 Hz input • hardware disconnected');
 const [challengeRun,setChallengeRun]=useState(emptyChallenge);
 const challenge=useRef(emptyChallenge());const legacy=useRef(new LegacyController());
 const [oscilloscopeHistory,setHistory]=useState<Context['oscilloscopeHistory']>([]);
 const serial=useRef<HardwareSerial|null>(null);const serialStarted=useRef(0);const sampleCount=useRef(0);
 const scenarioIntensity=useRef(100);const replay=useRef<{data:Recording;index:number}|null>(null);
 const publish=()=>{setFrame(structuredClone(engine.current.frame));setLogs([...engine.current.logs]);};
 const trace=(f:SystemFlightRecorderFrame)=>setHistory(h=>[...h,{time:new Date(f.timestamp*1000).toISOString().slice(11,19),tds:f.telemetry.tds.value,tdsUpper:f.telemetry.tds.value+f.telemetry.tds.uncertainty,tdsLower:f.telemetry.tds.value-f.telemetry.tds.uncertainty,ph:f.telemetry.ph.value,temp:f.telemetry.temp.value,phUpper:f.telemetry.ph.value+f.telemetry.ph.uncertainty,phLower:f.telemetry.ph.value-f.telemetry.ph.uncertainty,tempUpper:f.telemetry.temp.value+f.telemetry.temp.uncertainty,tempLower:f.telemetry.temp.value-f.telemetry.temp.uncertainty}].slice(-60));
 const setOperatingMode=(m:Mode)=>{modeRef.current=m;setMode(m);};
 const saveCheckpoint=()=>{
  if(modeRef.current!=='HARDWARE')return;
  try{localStorage.setItem('okeanos-hardware-checkpoint-v1',JSON.stringify(engine.current.checkpoint()));}catch{setConnection('Hardware active; checkpoint storage unavailable. Restart will remain closed.');}
 };
 const fault=(message:string)=>{
  engine.current.action({type:'override',mode:'FORCE_CLOSE'},Date.now()/1000);
  engine.current.stale(Date.now()/1000);publish();setConnection(message+' • closure latched; reconnect after fixing');
  const port=serial.current;serial.current=null;void port?.disconnect();
 };
 const send=()=>{
  const port=serial.current;if(modeRef.current!=='HARDWARE'||!port)return;
  const v=engine.current.frame.valve_actuator;
  void port.command(v.main_solenoid_state,v.drain_flush_state).catch(e=>fault(String(e)));
 };
 const apply=(a:Action)=>{
  if(modeRef.current==='REPLAY')throw new Error('Stop replay before changing controller settings');
  const message=engine.current.action(a,modeRef.current==='HARDWARE'?Date.now()/1000:sampleCount.current);
  publish();send();saveCheckpoint();return message;
 };
 useEffect(()=>{
  const tick=setInterval(()=>{
   if(modeRef.current==='HARDWARE')return;
   if(modeRef.current==='REPLAY'){
    const r=replay.current;if(!r)return;
    try {
     while(r.index<r.data.events.length){
      const event=r.data.events[r.index++];
      if(event.kind==='action')engine.current.action(event.action,event.now);
      else {trace(engine.current.step(event.sample,event.now));break;}
     }
     publish();setConnection(`Replay ${r.index}/${r.data.events.length} • outputs disconnected${r.index===r.data.events.length?' • complete':''}`);
    }catch(e){replay.current=null;setConnection(`Replay stopped: ${String(e)}`);}
    return;
   }
   const run=challenge.current;
   if(run.active_scenario_id&&!run.is_running)return;
   sampleCount.current++;
   const n=run.is_running?run.step_progress:sampleCount.current;
   if(run.active_scenario_id==='blocked_restart'&&n===55)engine.current.action({type:'restart'},sampleCount.current);
   const sample=syntheticSample(n,run.is_running?run.active_scenario_id:null,scenarioIntensity.current);
   const f=engine.current.step(sample,sampleCount.current);publish();trace(f);
   if(run.is_running){
    legacy.current.step(sample,calculateInstantaneousStress);
    const l=legacy.current;
    const duration=SCENARIOS.find(s=>s.id===run.active_scenario_id)!.duration;
    challenge.current={...run,step_progress:n+1,is_running:n+1<duration,
     legacy_valve_open:l.open,legacy_chatter_cycles:l.cycles,legacy_admitted_stress:l.exposure,legacy_baseline_contaminated:Math.abs(l.baseline-360)>25,
     okeanos_valve_open:f.valve_actuator.main_solenoid_state==='OPEN',okeanos_chatter_cycles:f.valve_actuator.total_cycles_logged,
     okeanos_admitted_stress:f.exposure_accounting.admitted_exposure_cmsi,okeanos_baseline_contaminated:Math.abs(f.quarantine_engine.baseline_mean-360)>25,
     history:[...run.history,{time_sec:n,injected_val:sample.tds,legacy_valve:l.open?1:0,okeanos_valve:f.valve_actuator.main_solenoid_state==='OPEN'?1:0}]};
    setChallengeRun(challenge.current);
   }
  },1000);
  const watchdog=setInterval(()=>{
   if(modeRef.current!=='HARDWARE'||!serial.current)return;
   const p=serial.current,now=Date.now();
   if(p.expiredCommand(now)||now-(p.lastSampleAt||serialStarted.current)>3000||now-(p.lastAck||serialStarted.current)>3000)fault('Telemetry or command acknowledgement timeout');
  },250);
  return()=>{clearInterval(tick);clearInterval(watchdog);void serial.current?.disconnect();};
 },[]);
 const resetToLive=()=>{
  if(serial.current){setConnection('Disconnect hardware before starting simulation');return;}
  engine.current=new GateController();sampleCount.current=0;challenge.current=emptyChallenge();setChallengeRun(challenge.current);
  legacy.current=new LegacyController();replay.current=null;setHistory([]);setOperatingMode('SIMULATION');setConnection('Synthetic 1 Hz input • hardware disconnected');publish();
 };
 const startChallenge=(id:string,intensity=100)=>{
  if(modeRef.current==='HARDWARE'){setConnection('Disconnect hardware before challenge injection');return;}
  if(!SCENARIOS.some(s=>s.id===id))throw new Error('Unknown scenario');
  resetToLive();scenarioIntensity.current=intensity;challenge.current={...emptyChallenge(),is_running:true,active_scenario_id:id};setChallengeRun(challenge.current);
 };
 const connectHardware=async()=>{
  if(serial.current)throw new Error('Already connected');
  const p=new HardwareSerial();
  try {
   // New hardware session starts closed, with a separately retained hardware baseline.
   let candidate=new GateController();
   const saved=localStorage.getItem('okeanos-hardware-checkpoint-v1');
   if(saved){try{candidate.restore(JSON.parse(saved));}catch{candidate=new GateController();candidate.config.hasDrain=false;}}
   else candidate.config.hasDrain=false;
   await p.connect(sample=>{
    if(modeRef.current!=='HARDWARE'||serial.current!==p)return;
    const f=engine.current.step(sample,Date.now()/1000);publish();trace(f);send();setConnection(`USB active • device command state: ${p.applied} • physical position unverified`);
    if(++sampleCount.current%10===0)saveCheckpoint();
   },fault);
   engine.current=candidate;serial.current=p;serialStarted.current=Date.now();sampleCount.current=0;
   challenge.current=emptyChallenge();setChallengeRun(challenge.current);setHistory([]);replay.current=null;
   setOperatingMode('HARDWARE');setConnection('USB serial connected • commands are not physical valve-position feedback');publish();send();
  }catch(e){await p.disconnect();throw e;}
 };
 const disconnectHardware=async()=>{
  saveCheckpoint();engine.current.action({type:'override',mode:'FORCE_CLOSE'},Date.now()/1000);
  const p=serial.current;serial.current=null;await p?.disconnect();publish();setConnection('Hardware disconnected • controller closed. Select Reset to simulation to resume.');
 };
 const loadReplay=(text:string)=>{
  if(modeRef.current==='HARDWARE')throw new Error('Disconnect hardware before replay');
  const data=parseRecording(text);engine.current=new GateController();if(data.initial)engine.current.restore(data.initial);sampleCount.current=0;
  challenge.current=emptyChallenge();setChallengeRun(challenge.current);setHistory([]);
  replay.current={data,index:0};setOperatingMode('REPLAY');publish();setConnection('Recorded samples at one sample per second • outputs disconnected');
 };
 const exportFlightRecorder=(format:'json'|'csv')=>{
  if(format==='json')return JSON.stringify(engine.current.export(modeRef.current!=='HARDWARE'),null,2);
  return 'timestamp,seq,tds,ph,temp,valid,fresh\n'+engine.current.records.filter(e=>e.kind==='sample').map(e=>e.kind==='sample'?[e.now,e.sample.seq,e.sample.tds,e.sample.ph,e.sample.temp,e.sample.valid,e.sample.fresh].join(','):'').join('\n');
 };
 return <TelemetryContext.Provider value={{frame,logs,mode,connected:serial.current!==null,connection,config:engine.current.config,diagnostics:engine.current.diagnostics,challengeRun,oscilloscopeHistory,
  overrideValve:async(mode)=>apply({type:'override',mode}),resolveQuarantine:async(action)=>apply({type:'quarantine',action}),
  triggerPurge:async(seconds=15)=>apply({type:'purge',seconds}),setSourceProfile:async(profile)=>apply({type:'profile',profile}),
  startChallenge,stopChallenge:()=>{challenge.current={...challenge.current,is_running:false};setChallengeRun(challenge.current);},resetToLive,
  calibrateSensor:(sensor,reference)=>{apply({type:'calibrate',sensor,reference});},
  saveConfig:(config)=>apply({type:'config',config}),exportFlightRecorder,connectHardware,disconnectHardware,loadReplay
 }}>{children}</TelemetryContext.Provider>;
};
export const useTelemetry=()=>{const c=useContext(TelemetryContext);if(!c)throw new Error('TelemetryProvider missing');return c;};
>>>>>>> 506c44a (add backend iter-1 by astra)
