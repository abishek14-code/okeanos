# Verification of the integrated delivery

## Completed

- `npm run build`: TypeScript check and Vite production build passed.
- `npm test`: **37 tests passed**, including the real React telemetry provider and mounted recovery, calibration and audit workspaces with a mocked USB device.
- `sh tests/native/run.sh`: the **actual production firmware sketch** passed native C++ tests using real ArduinoJson parsing and mocked peripheral APIs.
- `npm run test:challenges`: all ten synthetic scenarios executed; results are in `challenge-results.json`. They are software simulations, not measured hardware performance.
- All **six original CSS files are byte-identical** to the uploaded project. No layout/style redesign was made. UI changes are hardware calibration wording/button text, asynchronous acknowledgement/error handling, configuration form synchronization, and replacing unsupported zero-latency/NC claims with truthful status text.

Detailed software output: `software-tests.txt`, `dashboard-build.txt`, `firmware-native-tests.txt`.

## Tested behavior

Host tests cover startup/recovery, all sensor limits, uncertainty overlap, source lock, invalid/stale/estimated samples, quarantine eligibility, CUSUM, exposure integration, override limits, purge mutual exclusion, configuration validation, export/replay, per-board persistence, raw ADC mapping, firmware calibration without a duplicate host offset, and quantized temperature readings.

Serial tests cover boot negotiation, fragmented packets, applied-state/configuration acknowledgements, malformed packets, local-mode conflict, explicit firmware vetoes, pending-command expiry and calibration responses. The React integration drives hardware recovery, drain configuration/purge, closure latch, calibration, source selection, recovery, audit export and disconnect using the actual provider.

Firmware native tests cover closed boot, protocol acquisition, closed-only handshake, freshness veto, mutually exclusive outputs, configured and compiled limits, command TTL, independent sensor age, duplicate command rejection, two-point calibration including a negative pH slope, persistence API calls, stale capture rejection and local-mode takeover.

## Limits of verification

- No physical ESP32, sensors, keypad, OLED, valves or plumbing are attached here. Sensor accuracy, power polarity, physical travel/closure, flow-switch placement, acquisition settling time, NVS endurance and real timing need bench validation.
- Browser visual/Playwright execution could not run in this environment: Chromium launch was blocked by the environment's socket restrictions. React integration tests ran in jsdom instead. The input screenshot `dashboard-verified.png` is retained as an original reference, not represented as new evidence.
- The Tauri wrapper is unchanged and has no native serial transport. Use the Chrome/Edge browser dashboard for hardware.
- ESP32 target-build outcome is recorded separately in `esp32-build-status.txt`; native C++ tests alone are not a target build.

## Bench acceptance after flashing

1. Verify both GPIO outputs inactive on boot and while disconnected. Start with the original LEDs.
2. Connect USB in Chrome/Edge; confirm board identity, actuator kind and live raw/calibrated readings. Old v1 firmware must be rejected.
3. Capture known two-point TDS/pH standards, reboot, reconnect and verify coefficients against an independent third reference. Test temperature disconnect and ADC saturation.
4. Assert LED-test freshness with **#**, select the appropriate source, and verify main opens only after fresh acceptable recovery. Let freshness expire and verify closure.
5. Commission the drain checkbox, request purge, then press **Latch closed**. Verify both outputs close and the drain stays closed on subsequent samples.
6. Change a dashboard limit to exclude the reading. Verify both dashboard blocking and local firmware veto. Try invalid/expanded ceilings and verify rejection.
7. Unplug USB, stop host traffic and reset ESP32 independently. Measure closure timing and verify no permission survives reset. Reconnect and explicitly release a persisted manual latch with Auto / recover.
8. Verify profiles, quarantine actions, configuration and audit exports with real sensor transitions. Synthetic challenge/replay must remain disconnected from hardware.
9. For real valves, complete the separate driver, freshness-input and plumbing commissioning described in `HARDWARE_AND_WORKFLOW.md`. Without the additional evidence, do not treat LED states as verified water control.
