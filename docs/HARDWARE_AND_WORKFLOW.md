# Firmware / dashboard integration — protocol 2

## Hardware map retained from final_code_vinn.ino

| Function | ESP32 GPIO / interface |
|---|---|
| TDS conditioned analogue output | GPIO32, ADC1, 12-bit raw counts |
| TDS module power-control signal | GPIO5 |
| pH conditioned analogue output | GPIO33, ADC1, 12-bit raw counts |
| pH module power-control signal | GPIO23 |
| DS18B20 data | GPIO4, 4.7 kΩ pull-up to 3.3 V |
| Main output control / LED | GPIO17 |
| Drain output control / LED | GPIO27 |
| SH1106 OLED | I²C 0x3C, classic ESP32 SDA21 / SCL22 |
| Keypad rows | 19, 18, 15, 14 |
| Keypad columns | 13, 12, 26, 25 |
| USB serial | 115200 baud, newline-delimited JSON |
| Optional chamber flow switch | `FLOW_SWITCH_PIN=-1` means not fitted; configure a verified spare pin if fitted |

This pin map targets the original classic ESP32 sketch, not an ESP32-S3. GPIO12/15 are boot-strapping pins: check keypad/external pulls if boot or upload fails. Module power signals need suitable switching circuitry; a GPIO must not directly supply a module or solenoid beyond its rating. Keep conditioned analogue input within the board's ADC electrical limits. A pH electrode needs its proper interface module. ESP32 ADC gain/nonlinearity and probe settling still require bench verification.

## Firmware installation

Canonical project sketch: `firmware/okeanos_gate/okeanos_gate.ino` with `gate_policy.h` beside it. The standalone delivered `final_code_vinn.ino` embeds that policy and has identical behavior.

Arduino IDE: select the actual ESP32 board; install ArduinoJson 7, Adafruit GFX, Adafruit SH110X, OneWire, DallasTemperature and Keypad. Preferences, LittleFS and Wire come with the ESP32 core. Compile/upload at a baud rate your board supports. The project also includes a pinned PlatformIO environment for `esp32dev`.

`LittleFS.begin(false)` does not erase existing flash. If no filesystem is provisioned, acquisition and host audit still work and the status bar reports local log unavailable. To provision an empty filesystem with PlatformIO, use `pio run -t uploadfs` after confirming any existing device files may be overwritten. Local logging stops at 256 KiB instead of silently overwriting evidence; the host records up to 10,000 events per session.

## Feature-to-hardware mapping

| Existing dashboard feature | Integrated behavior | Location / prerequisite |
|---|---|---|
| Connect / disconnect | Closed-only protocol handshake, board identity, close on disconnect | Web Serial; integrated v2 firmware |
| TDS / pH / temperature / histories | Real 1 Hz acquisition, validity, ADC counts and calibration metadata | ESP32 sensors |
| Source selection / unknown lock | Restarts recovery and closes hardware; source-specific baseline retained | Host analytics; demonstration profiles must match commissioned sources |
| Uncertainty / interval gate | Uses calibrated readings and configured uncertainty assumptions | Host; no estimated reading can authorize opening |
| Calibration capture | Two-point TDS/pH affine fit; one-point temperature offset; acknowledgement after NVS save | ESP32; stable known standards |
| Limit / drain configuration | Validated host configuration included in every output command; firmware validates inside hard ceilings | Firmware and host; drain capability must be enabled in firmware |
| CUSUM / quarantine discard / admit / reset | Actions run against physical samples; only eligible stable samples admitted; closure commands acknowledged | Host; evidence conditions still apply |
| Latch closed | Cancels purge and closes both outputs; persists across reconnect | Host latch + firmware output |
| Auto / recover | Releases manual latch and requires fresh stable recovery before main permission | Host FSM + firmware local veto |
| Emergency | Thirty minutes of statistical relaxation only; hard limits/freshness/sensor checks still enforced | Host; cannot directly force unsafe main opening |
| Manual / automatic purge | Mutually exclusive drain output; requires commissioned path; closure latch preempts purge | Host timer + firmware watchdog |
| Exposure accounting | Integrates observed sensor stress over previous command state | Command-based proxy, not measured membrane damage |
| Audit, JSON/CSV export | Captures physical samples, actions, configuration and decisions | Host session; unsigned records |
| Replay / challenge scenarios | Operate while hardware is disconnected | Deliberate simulation isolation |
| Theme / navigation / chart controls | Existing behavior retained | UI only |
| OLED / keypad / local CSV | Continue reading/reporting actual sensors and output GPIO state | ESP32; local manual mode restricted to LED builds |

## Calibration procedure

1. Keep outputs closed and connect the dashboard. Invalid/uncommissioned readings are visible so commissioning is possible; they cannot authorize main opening.
2. Select pH. Put the probe in a known standard, wait for stable readings, enter its actual reference value and click **Capture reference**. The response says **Point 1 captured**.
3. Move to a second known standard, wait at least five stable sample cycles, and capture its value. The references must differ by at least 1 pH and 50 raw counts. Negative pH sensor slopes are supported. The second point saves the affine coefficients and timestamp in ESP32 NVS.
4. Repeat for TDS, using standards separated by at least 50 ppm and 50 raw counts. TDS requires a positive slope. The firmware assumes a linear local calibration region; verify a third reference across the intended operating range. Some TDS modules require their manufacturer's nonlinear conversion instead.
5. Temperature calibration is optional and uses a single known water-temperature reference to set an offset. Sensor disconnection and DS18B20's 85 °C startup sentinel remain faults.
6. After either completed calibration, re-establish freshness and run recovery. Calibration invalidates accumulated host baseline/quarantine so previously scaled values are not mixed into learning.

A pending first point expires after 15 minutes and resets on a new connection or reboot. Start a new pair by disconnecting/reconnecting. Acquisition must remain healthy; a request naming an old sample is rejected so a moved probe cannot silently calibrate stale data. Reference captures use raw ADC counts, not already calibrated values. Firmware-calibrated packets bypass host offsets, preventing double calibration.

Original `TDS_TEMP_COEFFICIENT=0` is retained because the probe/module specification was not provided. With zero, calibrate and measure at the reference temperature; no compensation is claimed. If a validated coefficient is fitted, use reference values applicable at calibration temperature and validate the conversion across temperatures. `u_cal` values remain commissioning assumptions, not residuals measured by two points.

## LED bench versus real valves

Default `LED_EMULATOR=true`, `DRAIN_COMMISSIONED=true`, `ACTIVE_HIGH=true`. This matches the uploaded LED prototype. **#** asserts LED-test freshness for 120 seconds, explicitly reported as `operator_led_test`. It does not establish that water moved. The host also displays `LED_EMULATOR` and unverified physical position.

For actual valves, set `LED_EMULATOR=false`, verify driver active polarity, and commission the drain branch before setting `DRAIN_COMMISSIONED=true`. Fit and configure an independent chamber-flow switch on a verified spare pin, with appropriate electrical conditioning/pull resistor. Configure `FLOW_ACTIVE_LOW` to match it. An absent input leaves `fresh=false`; main cannot reopen. A stuck switch is not independently diagnosable by this implementation, so validate switch failure behavior and chamber exchange time before physical use. Flow-present indication is not measured volume.

The sensing chamber must receive fresh inlet water while main is closed. A separate continuously flowing sample loop or upstream drain branch can provide it. Use **Request purge** to establish flow when automatic recovery is waiting for freshness; command state alone never proves flushing. Flow evidence must correspond to the actual sensing chamber.

Main/drain software mutual exclusion does not establish mechanical break-before-make timing, valve closure or leakage. Real valves need suitable normally closed drivers, power supplies, flyback suppression and boot-inactive pulls. Calibrate on a controlled bench before connecting a protected membrane.

## Protocol / failure behavior

All messages are JSON objects followed by `\n`. There are no application debug strings on the serial channel. ROM boot text is ignored only before negotiation.

- `hello` request with `id`: firmware closes outputs, exits local test, resets the host command sequence and responds with protocol 2, device identity and capabilities.
- `command`: `seq`, `main`, `drain`, `ttl_ms`, `limits` (tds/ph/temp pairs), `has_drain`, `config_version`. Firmware ACK returns actual GPIO command states, applied configuration version, `ok`, and veto `reason`.
- `calibrate`: `id`, `sensor`, `reference`, current `sample_seq`, and Unix `epoch`. Firmware responds with correlated success/failure and first-point/saved status.
- `sample`: measurements, raw TDS/pH counts, `sensor_valid`, `calibrated`, `valid`, `fresh`, freshness basis, calibration timestamps, output GPIO state, mode, actuator kind, log/NVS status and monotonic sequence.

Opening requires calibrated valid measurements, independent freshness in a real-valve build, local sample age ≤1.5 seconds, limits inside TDS 0–800 ppm / pH 6.5–8.5 / 10–45 °C, and a live command lease. These inherited example hard limits must be reviewed for the actual membrane. Dashboard configuration can tighten them but cannot raise them. Firmware drops both outputs when the command lease reaches 2.5 seconds. Host rejects missing/mismatched ACKs, malformed packets, restarted/repeated sample sequences, local mode changes and telemetry loss.

The dashboard waits for command ACK before reporting an action applied; ACK means GPIO command application, not measured valve travel. Statistical policies remain host-owned; there is no safe autonomous opening after host loss. A reset always starts closed and requires a new handshake/recovery.

## API references

Implementation follows [Espressif Preferences](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/preferences.html), [ESP32 ADC APIs](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html) and [ArduinoJson 7 deserialization](https://arduinojson.org/v7/tutorial/deserialization/). Hardware calibration and electrical compatibility still depend on the actual installed modules.
