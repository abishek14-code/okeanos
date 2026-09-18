use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorMetric {
    pub value: f64,
    pub uncertainty: f64,
    pub unit: String,
    pub raw_adc: u32,
    pub status: String,
    pub u_cal: f64,
    pub u_noise: f64,
    pub u_age: f64,
    pub lower_bound: f64,
    pub upper_bound: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryData {
    pub tds: SensorMetric,
    pub ph: SensorMetric,
    pub temp: SensorMetric,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineEngineState {
    pub status: String,
    pub cusum_s_plus: f64,
    pub cusum_s_minus: f64,
    pub threshold_h: f64,
    pub reference_k: f64,
    pub learning_frozen: bool,
    pub quarantined_samples_count: u32,
    pub quarantined_mean: f64,
    pub baseline_mean: f64,
    pub baseline_sigma: f64,
    pub trusted_records_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceProfileState {
    pub active_profile: String,
    pub confidence_score: f64,
    pub mahalanobis_distance: f64,
    pub threshold: f64,
    pub unknown_source_locked: bool,
    pub municipal_distance: f64,
    pub borewell_distance: f64,
    pub rainwater_distance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsmRecoveryState {
    pub current_state: String, // NORMAL, SUSPECT, BLOCKED, RECOVERY_CHECK, RESTORED
    pub stagnant_chamber_flag: bool,
    pub recovery_timer_seconds: u32,
    pub violation_timer_seconds: u32,
    pub purge_timer_seconds: u32,
    pub hysteresis_margin_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValveActuatorState {
    pub main_solenoid_state: String, // OPEN, CLOSED
    pub drain_flush_state: String,    // OPEN, CLOSED
    pub blockage_reason: String,      // NONE, MEASURED_BREACH, UNCERTAINTY_OVERLAP, EMERGENCY_SHUTDOWN
    pub chatter_lockout_active: bool,
    pub actuation_latency_ms: u32,
    pub total_cycles_logged: u32,
    pub max_rated_cycles: u32,
    pub emergency_override_active: bool,
    pub emergency_time_remaining_secs: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposureAccountingState {
    pub admitted_exposure_cmsi: u64,
    pub prevented_exposure_cmsi: u64,
    pub cmsi_limit: u64,
    pub days_remaining_projected: u32,
    pub daily_stress_velocity: u32,
    pub damage_reduction_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemFlightRecorderFrame {
    pub timestamp: u64,
    pub uptime_seconds: u64,
    pub telemetry: TelemetryData,
    pub quarantine_engine: QuarantineEngineState,
    pub source_profile: SourceProfileState,
    pub fsm_recovery: FsmRecoveryState,
    pub valve_actuator: ValveActuatorState,
    pub exposure_accounting: ExposureAccountingState,
}

pub struct AppState {
    pub flight_frame: Mutex<SystemFlightRecorderFrame>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            flight_frame: Mutex::new(SystemFlightRecorderFrame {
                timestamp: 1789729340,
                uptime_seconds: 142850,
                telemetry: TelemetryData {
                    tds: SensorMetric {
                        value: 386.4,
                        uncertainty: 18.2,
                        unit: "ppm".to_string(),
                        raw_adc: 1842,
                        status: "pass".to_string(),
                        u_cal: 12.0,
                        u_noise: 6.2,
                        u_age: 4.1,
                        lower_bound: 100.0,
                        upper_bound: 800.0,
                    },
                    ph: SensorMetric {
                        value: 7.28,
                        uncertainty: 0.09,
                        unit: "pH".to_string(),
                        raw_adc: 2410,
                        status: "pass".to_string(),
                        u_cal: 0.04,
                        u_noise: 0.03,
                        u_age: 0.06,
                        lower_bound: 6.5,
                        upper_bound: 8.5,
                    },
                    temp: SensorMetric {
                        value: 28.2,
                        uncertainty: 0.40,
                        unit: "°C".to_string(),
                        raw_adc: 982,
                        status: "pass".to_string(),
                        u_cal: 0.25,
                        u_noise: 0.06,
                        u_age: 0.10,
                        lower_bound: 10.0,
                        upper_bound: 45.0,
                    },
                },
                quarantine_engine: QuarantineEngineState {
                    status: "NORMAL".to_string(),
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
                },
                source_profile: SourceProfileState {
                    active_profile: "MUNICIPAL".to_string(),
                    confidence_score: 0.962,
                    mahalanobis_distance: 0.82,
                    threshold: 3.50,
                    unknown_source_locked: false,
                    municipal_distance: 0.82,
                    borewell_distance: 4.61,
                    rainwater_distance: 6.85,
                },
                fsm_recovery: FsmRecoveryState {
                    current_state: "NORMAL".to_string(),
                    stagnant_chamber_flag: false,
                    recovery_timer_seconds: 0,
                    violation_timer_seconds: 0,
                    purge_timer_seconds: 0,
                    hysteresis_margin_pct: 5.0,
                },
                valve_actuator: ValveActuatorState {
                    main_solenoid_state: "OPEN".to_string(),
                    drain_flush_state: "CLOSED".to_string(),
                    blockage_reason: "NONE".to_string(),
                    chatter_lockout_active: false,
                    actuation_latency_ms: 35,
                    total_cycles_logged: 1428,
                    max_rated_cycles: 100000,
                    emergency_override_active: false,
                    emergency_time_remaining_secs: 0,
                },
                exposure_accounting: ExposureAccountingState {
                    admitted_exposure_cmsi: 2841200,
                    prevented_exposure_cmsi: 14892400,
                    cmsi_limit: 5000000,
                    days_remaining_projected: 142,
                    daily_stress_velocity: 15200,
                    damage_reduction_pct: 84.0,
                },
            }),
        }
    }
}

// -----------------------------------------------------------------------------
// Tauri IPC Commands
// -----------------------------------------------------------------------------

#[tauri::command]
fn get_telemetry_snapshot(state: State<'_, AppState>) -> SystemFlightRecorderFrame {
    let frame = state.flight_frame.lock().unwrap();
    frame.clone()
}

#[tauri::command]
fn set_valve_override(
    state: State<'_, AppState>,
    mode: String, // "FORCE_OPEN", "FORCE_CLOSE", "AUTO"
    pin: Option<String>,
) -> Result<String, String> {
    let mut frame = state.flight_frame.lock().unwrap();
    if mode == "FORCE_OPEN" {
        if pin != Some("0000".to_string()) && pin != Some("1234".to_string()) {
            return Err("Invalid confirmation PIN for Emergency Override".to_string());
        }
        frame.valve_actuator.emergency_override_active = true;
        frame.valve_actuator.main_solenoid_state = "OPEN".to_string();
        frame.valve_actuator.emergency_time_remaining_secs = 1800; // 30 min
    } else if mode == "FORCE_CLOSE" {
        frame.valve_actuator.emergency_override_active = false;
        frame.valve_actuator.main_solenoid_state = "CLOSED".to_string();
    } else {
        frame.valve_actuator.emergency_override_active = false;
        frame.valve_actuator.main_solenoid_state = "OPEN".to_string();
    }
    Ok(format!("Valve state updated to: {}", frame.valve_actuator.main_solenoid_state))
}

#[tauri::command]
fn resolve_quarantine(state: State<'_, AppState>, action: String) -> Result<String, String> {
    let mut frame = state.flight_frame.lock().unwrap();
    match action.as_str() {
        "DISCARD" => {
            frame.quarantine_engine.quarantined_samples_count = 0;
            frame.quarantine_engine.learning_frozen = false;
            frame.quarantine_engine.cusum_s_plus = 0.0;
            frame.quarantine_engine.cusum_s_minus = 0.0;
            Ok("Quarantined samples discarded. Learning unfrozen.".to_string())
        }
        "ADMIT_TO_BASELINE" => {
            frame.quarantine_engine.trusted_records_count += frame.quarantine_engine.quarantined_samples_count;
            frame.quarantine_engine.quarantined_samples_count = 0;
            frame.quarantine_engine.learning_frozen = false;
            frame.quarantine_engine.cusum_s_plus = 0.0;
            frame.quarantine_engine.cusum_s_minus = 0.0;
            Ok("Quarantined samples validated & merged into trusted baseline.".to_string())
        }
        "RESET_CUSUM" => {
            frame.quarantine_engine.cusum_s_plus = 0.0;
            frame.quarantine_engine.cusum_s_minus = 0.0;
            frame.quarantine_engine.learning_frozen = false;
            Ok("CUSUM drift accumulators reset to baseline zero.".to_string())
        }
        _ => Err("Unknown quarantine resolution action".to_string()),
    }
}

#[tauri::command]
fn trigger_purge(state: State<'_, AppState>, duration_secs: Option<u32>) -> Result<String, String> {
    let mut frame = state.flight_frame.lock().unwrap();
    let secs = duration_secs.unwrap_or(15);
    frame.valve_actuator.drain_flush_state = "OPEN".to_string();
    frame.fsm_recovery.purge_timer_seconds = secs;
    frame.fsm_recovery.stagnant_chamber_flag = false;
    Ok(format!("Auxiliary drain flush triggered for {} seconds", secs))
}

#[tauri::command]
fn set_source_profile(state: State<'_, AppState>, profile: String) -> Result<String, String> {
    let mut frame = state.flight_frame.lock().unwrap();
    match profile.to_uppercase().as_str() {
        "MUNICIPAL" => {
            frame.source_profile.active_profile = "MUNICIPAL".to_string();
            frame.source_profile.unknown_source_locked = false;
            frame.source_profile.mahalanobis_distance = 0.82;
            frame.source_profile.confidence_score = 0.962;
        }
        "BOREWELL" => {
            frame.source_profile.active_profile = "BOREWELL".to_string();
            frame.source_profile.unknown_source_locked = false;
            frame.source_profile.mahalanobis_distance = 1.15;
            frame.source_profile.confidence_score = 0.941;
        }
        "UNKNOWN" => {
            frame.source_profile.active_profile = "UNKNOWN (LOCKED)".to_string();
            frame.source_profile.unknown_source_locked = true;
            frame.source_profile.mahalanobis_distance = 4.88;
            frame.source_profile.confidence_score = 0.210;
            frame.quarantine_engine.learning_frozen = true;
        }
        _ => return Err("Invalid profile name".to_string()),
    }
    Ok(format!("Active water source profile updated to {}", frame.source_profile.active_profile))
}

#[tauri::command]
fn export_flight_recorder(state: State<'_, AppState>, format_type: String) -> Result<String, String> {
    let frame = state.flight_frame.lock().unwrap();
    if format_type.to_lowercase() == "csv" {
        let csv_data = format!(
            "timestamp,uptime_sec,tds_val,tds_unc,ph_val,ph_unc,temp_val,temp_unc,valve_state,cusum_s_plus,source_profile\n{},{},{},{},{},{},{},{},{},{},{}",
            frame.timestamp,
            frame.uptime_seconds,
            frame.telemetry.tds.value,
            frame.telemetry.tds.uncertainty,
            frame.telemetry.ph.value,
            frame.telemetry.ph.uncertainty,
            frame.telemetry.temp.value,
            frame.telemetry.temp.uncertainty,
            frame.valve_actuator.main_solenoid_state,
            frame.quarantine_engine.cusum_s_plus,
            frame.source_profile.active_profile
        );
        Ok(csv_data)
    } else {
        serde_json::to_string_pretty(&*frame).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_telemetry_snapshot,
            set_valve_override,
            resolve_quarantine,
            trigger_purge,
            set_source_profile,
            export_flight_recorder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
