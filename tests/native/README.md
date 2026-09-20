# Actual-sketch tests with hardware API stubs

Run `sh tests/native/run.sh` on a machine with a C++17 compiler. This includes the production `.ino` and `gate_policy.h`, runs the actual JSON parser/command/calibration/safety functions, and replaces ESP32 peripherals with deterministic stubs. It checks boot closure, protocol acquisition, closed-only handshake, freshness veto, mutual exclusion, tightened/hard limits, TTL and sample-age closure, duplicate command rejection, two-point calibration/persistence, stale calibration rejection, local-mode takeover and drain commissioning.

It does **not** emulate ESP32 ADC accuracy, real NVS flash behavior, USB timing, OLED I²C or physical valves. Build with PlatformIO for target compilation; perform bench acceptance separately.

`vendor/ArduinoJson.h` is the unmodified ArduinoJson v7.4.2 single-header distribution from https://github.com/bblanchon/ArduinoJson/releases/download/v7.4.2/ArduinoJson-v7.4.2.h, under its embedded MIT license.
