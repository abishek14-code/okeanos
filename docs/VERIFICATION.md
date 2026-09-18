# Verification — 18 September 2026

## Executed checks

| Check | Result |
|---|---|
| TypeScript strict checks + Vite production bundle | Passed (`npm run build`) |
| Controller and serial-protocol tests | 28 passed, 0 failed (`npm test`) |
| Browser integration in Chromium | All eight workspaces load; startup recovery, manual latch/AUTO, source action, challenge injection, replay export/import, mocked USB opening and timeout closure passed without runtime exceptions |
| Shell layout | Main content is beside the sidebar; fixed missing shell selectors and undefined typography/surface aliases; screenshot inspected |
| Deterministic challenge suite | Ten scenarios executed through the actual controller and an explicit nominal-threshold comparator |
| ESP32 physical I/O and plumbing | Not tested; no physical hardware connected |
| Arduino compilation / target-board upload | Not executed in this environment |
| Tauri native compilation / packaging | Not executed in this environment; browser production build was checked |

## Material fixes

- Corrected the expanded-uncertainty formula: the original divided k by two and understated the interval.
- Interval overlap, invalid/estimated/frozen/stale sensors, unknown sources and hard-limit breaches now deny permission immediately.
- Manual closure persists; AUTO and restart require recovery instead of reopening unconditionally.
- Both recovery-state names used by the existing frontend now derive from one FSM.
- Source selection changes the controller; separate source baselines prevent mixed-source learning.
- Quarantine contains actual samples and eligibility/configuration versions. Validation cannot blindly add a displayed count to the baseline.
- Configuration and single-point calibration buttons update the controller and restart recovery; removed simulated commit/EEPROM success claims.
- Challenges inject measurements rather than forcing a scripted output. Comparator transitions and exposure derive from the trace.
- JSON export includes replayable samples/actions plus uncertainty, source, configuration, learning status, decision, commands and exposure. Local records are explicitly unsigned.
- Serial packets are framed and validated. ACKs must match issued commands; missing ACKs or acquisition data latch closure. The reference firmware independently expires commands.
- Simulation/replay cannot write hardware commands. Real hardware input never silently falls back to random readings.
- Removed unsupported claims of verified contamination identity, measured 35 ms actuation, zero leakage, 100% hazard diversion and known membrane life.

## Selected synthetic results

The exact output is in `challenge-results.json`. These are sample-level software results, not measured physical response times. One sample interval is nominally one second; zero-sample detection delay means the first violating sample caused a closed command.

| Scenario | First closure after injected event | OKEANOS transitions | Nominal comparator transitions |
|---|---:|---:|---:|
| Gradual TDS increase | 30 samples | 2 | 1 |
| Source step | 0 samples | 2 | 3 |
| Disconnected sensor | 0 samples | 2 | 2 |
| Frozen sensor | 29 samples | 2 | 1 |
| Uncertainty/source excursion near upper TDS limit | 0 samples | 2 | 1 |
| Threshold chatter | 0 samples | 2 | 61 |
| Recovery followed by relapse | 0 samples | 4 | 4 |
| pH breach | 0 samples | 2 | 2 |
| Temperature breach | 0 samples | 2 | 2 |

The nominal comparator opens immediately on acceptable nominal values and learns a 60-sample rolling mean without qualification. OKEANOS has a conservative startup/recovery hold. Exposure totals include those startup differences; they do not isolate the causal contribution of each feature. Near-limit scenarios may trigger multiple interlocks, including source mismatch. A separate test holds the mean constant and increases only the uncertainty input to isolate uncertainty gating.

In the recovery/relapse trace, recovery occurs at sample 90 after the excursion ends at sample 52: the controller discards unstable history and requires a complete fresh stable window. The report counts 38 acceptable nominal samples held closed during this interval. These are expected recovery holds, not automatically classified as nuisance failures.

## Reproduce

```bash
npm ci
npm test
npm run test:challenges
npm run build
npx playwright install chromium
npm run test:ui
```

Use Node 24. UI tests start/stop a local Vite process and use browser-controlled time. The serial test device is a software stream emulator: it verifies the complete UI → controller → transport → ACK route, but does not validate ESP32 pins or real valve movement.

## Remaining commissioning limits

The uploaded archive did not provide probe models, acquisition drivers, actual ADC connections or calibration constants. `sensor_adapter.h` therefore returns invalid data by default. Replace it with the actual calibrated sensor drivers and independently measured sample freshness. The current firmware is a reference integration scaffold, not an already-tested hardware build.

Manufacturer limits, source priors, uncertainty budgets, sensor-stuck tolerances and hydraulic timing require commissioning. Frozen-value detection is conservative: a low-resolution sensor reporting exactly identical values can produce a false fault. Prototype local storage is not a secure recorder; clear the hardware checkpoint when changing probes/devices. The single-point offset tool cannot certify sensor slope or uncertainty.

A flow/position sensor is needed to verify actual actuation and admitted volume. Permeate flow, rejection and pressure data plus validated modelling are needed to predict membrane life. These unsupported quantities are not presented as measured outputs.
