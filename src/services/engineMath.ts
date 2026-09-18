// ============================================================================
// OKEANOS Engine Mathematical Models & Formulations
// Strictly implementing OKEANOS.md Section 4
// ============================================================================

/**
 * 1. Uncertainty Interval & Metrological Permission (Section 4, Engine 2)
 * U = sqrt(u_cal^2 + u_noise^2 + u_age^2)
 */
export function calculateExpandedUncertainty(
  u_cal: number,
  u_noise: number,
  u_age: number,
  coverage_factor_k: number = 2.0
): number {
  const combined_variance = u_cal ** 2 + u_noise ** 2 + u_age ** 2;
  const standard_uncertainty = Math.sqrt(combined_variance);
<<<<<<< HEAD
  return Number((standard_uncertainty * (coverage_factor_k / 2.0)).toFixed(2));
=======
  return Number((standard_uncertainty * coverage_factor_k).toFixed(2));
>>>>>>> 506c44a (add backend iter-1 by astra)
}

export type GatingStatus = 'pass' | 'hold' | 'fail';

export interface IntervalCheckResult {
  status: GatingStatus;
  nominal_value: number;
  uncertainty: number;
  interval_lower: number;
  interval_upper: number;
  limit_lower: number;
  limit_upper: number;
  reason: 'SAFE' | 'MEASURED_BREACH' | 'UNCERTAINTY_OVERLAP';
}

export function evaluateIntervalGating(
  nominal_value: number,
  uncertainty: number,
  limit_lower: number,
  limit_upper: number
): IntervalCheckResult {
<<<<<<< HEAD
  const interval_lower = Number((nominal_value - uncertainty).toFixed(2));
  const interval_upper = Number((nominal_value + uncertainty).toFixed(2));

  // Scenario C: Measured nominal breach
  if (nominal_value < limit_lower || nominal_value > limit_upper) {
=======
  const interval_lower = nominal_value - uncertainty;
  const interval_upper = nominal_value + uncertainty;

  // Scenario C: Measured nominal breach
  if (![nominal_value, uncertainty, limit_lower, limit_upper].every(Number.isFinite) || uncertainty < 0 || limit_lower >= limit_upper || nominal_value < limit_lower || nominal_value > limit_upper) {
>>>>>>> 506c44a (add backend iter-1 by astra)
    return {
      status: 'fail',
      nominal_value,
      uncertainty,
      interval_lower,
      interval_upper,
      limit_lower,
      limit_upper,
      reason: 'MEASURED_BREACH',
    };
  }

  // Scenario B: Uncertainty interval overlaps outer limit
  if (interval_lower < limit_lower || interval_upper > limit_upper) {
    return {
      status: 'hold',
      nominal_value,
      uncertainty,
      interval_lower,
      interval_upper,
      limit_lower,
      limit_upper,
      reason: 'UNCERTAINTY_OVERLAP',
    };
  }

  // Scenario A: Confident permission
  return {
    status: 'pass',
    nominal_value,
    uncertainty,
    interval_lower,
    interval_upper,
    limit_lower,
    limit_upper,
    reason: 'SAFE',
  };
}

/**
 * 2. CUSUM Change-Point Detector (Section 4, Engine 1)
 * z_t = (x_t - mu_0) / sigma_0
 * S_t^+ = max(0, S_{t-1}^+ + (z_t - k))
 * S_t^- = max(0, S_{t-1}^- - (z_t + k))
 */
export function stepCusum(
  x_t: number,
  mu_0: number,
  sigma_0: number,
  prev_s_plus: number,
  prev_s_minus: number,
  reference_k: number = 0.5,
  threshold_h: number = 4.5
): {
  s_plus: number;
  s_minus: number;
  shift_detected: boolean;
} {
  const z_t = (x_t - mu_0) / (sigma_0 || 1.0);
  const s_plus = Math.max(0, prev_s_plus + (z_t - reference_k));
  const s_minus = Math.max(0, prev_s_minus - (z_t + reference_k));
  const shift_detected = s_plus >= threshold_h || s_minus >= threshold_h;

  return {
    s_plus: Number(s_plus.toFixed(3)),
    s_minus: Number(s_minus.toFixed(3)),
    shift_detected,
  };
}

/**
 * 3. Mahalanobis Distance for Source Profiles (Section 4, Engine 3)
 */
export interface SourceProfileSpec {
  name: 'MUNICIPAL' | 'BOREWELL' | 'RAINWATER';
  mu_tds: number;
  sigma_tds: number;
  mu_ph: number;
  sigma_ph: number;
  mu_temp: number;
  sigma_temp: number;
}

export const SOURCE_PROFILES: Record<string, SourceProfileSpec> = {
  MUNICIPAL: {
    name: 'MUNICIPAL',
    mu_tds: 360,
    sigma_tds: 25,
    mu_ph: 7.35,
    sigma_ph: 0.15,
    mu_temp: 26.0,
    sigma_temp: 2.0,
  },
  BOREWELL: {
    name: 'BOREWELL',
    mu_tds: 820,
    sigma_tds: 55,
    mu_ph: 8.10,
    sigma_ph: 0.20,
    mu_temp: 27.5,
    sigma_temp: 2.0,
  },
  RAINWATER: {
    name: 'RAINWATER',
    mu_tds: 75,
    sigma_tds: 18,
    mu_ph: 6.80,
    sigma_ph: 0.18,
    mu_temp: 24.0,
    sigma_temp: 2.5,
  },
};

export function calculateMahalanobisDistance(
  tds: number,
  ph: number,
  temp: number,
  profile: SourceProfileSpec
): number {
  const d_tds = (tds - profile.mu_tds) / profile.sigma_tds;
  const d_ph = (ph - profile.mu_ph) / profile.sigma_ph;
  const d_temp = (temp - profile.mu_temp) / profile.sigma_temp;
  return Number(Math.sqrt(d_tds ** 2 + d_ph ** 2 + d_temp ** 2).toFixed(2));
}

/**
 * 4. Dual Exposure Accounting & CMSI (Section 4, Engine 5 & 6)
 * s_k = w1 * max(0, TDS - opt) + w2 * |pH - 7| + w3 * max(0, Temp - opt)
 */
export function calculateInstantaneousStress(
  tds: number,
  ph: number,
  temp: number
): number {
  const w1 = 0.8;
  const w2 = 120.0;
  const w3 = 15.0;

  const tds_excess = Math.max(0, tds - 300);
  const ph_deviation = Math.abs(ph - 7.0);
  const temp_excess = Math.max(0, temp - 25.0);

  return Math.round(w1 * tds_excess + w2 * ph_deviation + w3 * temp_excess);
}

export function projectMembraneDaysRemaining(
  current_admitted_cmsi: number,
  cmsi_limit: number = 5000000,
  daily_velocity: number = 15200
): number {
  const remaining_units = Math.max(0, cmsi_limit - current_admitted_cmsi);
  return Math.max(1, Math.round(remaining_units / (daily_velocity || 1)));
}

/**
 * 5. Cross-Parameter Regression Fallback (Section 4, Engine 8)
 * Estimated TDS = -150 + 65*pH + 2.5*Temp
 */
export function inferTdsFromRegression(ph: number, temp: number): number {
  const estimated = -150 + 65.0 * ph + 2.5 * temp;
  return Math.max(50, Math.round(estimated));
}
