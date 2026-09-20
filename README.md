OKEANOS

Adaptive water-quality gate for RO membrane protection

OKEANOS is a prototype hardware–software controller that monitors inlet-water TDS, pH and temperature before water is admitted toward an RO membrane. It combines conservative valve permission, measurement uncertainty, qualified learning, source profiles, recovery verification, exposure accounting and repeatable challenge tests in one controller.

The current college demonstration uses an ESP32, three water-quality sensors, an OLED, a keypad and two LEDs. The LEDs emulate the commands that would be sent to a normally closed main valve and a drain valve. They show commanded state only; they do not establish valve position or water flow.

The present setup has no continuous water-flow loop. Live sensing and LED command indication are demonstrated physically. Flow-dependent recovery is demonstrated through clearly labelled simulation/replay.

System workflow

flowchart TD
    A["TDS, pH and temperature sensors"] --> B["ESP32 acquisition at 1 Hz"]
    B --> C["USB serial JSON"]
    C --> D["Shared decision controller"]
    D --> E["Uncertainty, profile, fault and drift checks"]
    E --> F["Recovery state machine"]
    F --> G["Main and drain commands"]
    G --> H["ESP32 LED indicators"]
    D --> I["Dashboard, audit log and replay"]

The control loop repeats continuously. Sensor-fault checks run before learning and permission, even though fault inference appears later in the original conceptual flowchart. A failed or estimated sensor cannot independently authorize opening.

What the prototype demonstrates

Capability

Implemented behavior

Learning quarantine

Only qualified, stable measurements can update a source-specific trusted baseline. Suspect measurements are held separately.

Persistent-shift detection

CUSUM detects sustained movement and freezes learning so deteriorating water is not gradually accepted as normal.

Uncertainty-aware permission

The complete uncertainty interval must fit inside every configured measurement limit. Overlap produces a hold.

Source profiles

Municipal, borewell and rainwater profiles have separate baselines. Weak matches enter an unknown-source lockout.

Recovery verification

Immediate closure is followed by hysteresis and a stable fresh-sample window before restoration. One acceptable sample cannot reopen the gate.

Exposure accounting

Observed inlet stress, admitted command-based exposure and blocked-command stress are accumulated separately.

Sensor fault handling

Invalid, estimated, implausible, frozen, stale, duplicate and out-of-order readings deny permission.

Temporal classification

Violations are labelled transient/suspect or persistent. Classification never delays a hard-limit closure.

Challenge and replay

Ten deterministic scenarios run through the same controller and can be exported and replayed without hardware output.

Actuator interlock

Main and drain commands are mutually exclusive. Missing telemetry or command acknowledgement closes the system.

The dashboard also calculates rolling TDS/pH and TDS/temperature correlations, joint source-profile distance, a diagnostic-only regression estimate and a bounded risk score. These diagnostics cannot bypass the primary interlocks.

Current demonstration versus a deployed system

Current prototype

Full deployment requirement

Static water samples around the probes

Upstream flowing sensor chamber or continuously flowing sample loop

Two LEDs emulate actuator commands

Rated normally closed valves, drivers, supplies and transient protection

GPIO state is acknowledged

Independent valve-position or flow feedback

Freshness remains unverified by default

Independent evidence that new inlet water crossed the sensor chamber

Provisional ADC conversions

Probe-specific multi-point calibration and validated temperature compensation

Command-based exposure estimate

Flow measurement plus normalized permeate flow, salt rejection and differential pressure for membrane condition modelling

The project does not claim that inlet TDS, pH and temperature identify a contaminant, prove water origin, certify drinking-water safety or predict exact membrane replacement life.

Repository layout

okeanos/
├── src/
│   ├── components/
│   │   ├── shell/                 # Navigation, status and USB integration bar
│   │   └── workspaces/            # Eight dashboard workspaces
│   ├── context/TelemetryContext.tsx
│   ├── services/
│   │   ├── controller.ts          # Shared decision engine and recovery FSM
│   │   ├── engineMath.ts          # Uncertainty, gating and engineering maths
│   │   ├── scenarios.ts           # Ten deterministic challenge traces
│   │   ├── serial.ts              # Web Serial transport and ACK validation
│   │   └── initialFrame.ts
│   └── types/telemetry.ts
├── firmware/
│   ├── okeanos_led_demo/          # Final fixed-pin LED demo firmware
│   └── okeanos_gate/              # Original generic reference scaffold
├── docs/
│   ├── HARDWARE_AND_WORKFLOW.md
│   ├── VERIFICATION.md
│   ├── challenge-results.json
│   └── example-replay.json
├── tests/
│   ├── controller.test.mjs
│   ├── serial.test.mjs
│   ├── challenge-report.mjs
│   └── ui-smoke.mjs
├── package.json
└── README.md

The revised LED demonstration firmware is firmware/okeanos_led_demo/okeanos_led_demo.ino. It is standalone and does not require sensor_adapter.h. Its pin map supersedes the example GPIO values in the older generic hardware guide.

firmware/okeanos_led_demo/
└── okeanos_led_demo.ino

Dashboard workspaces

Command Center & Real-Time Flow Gate — live values, uncertainty bands, AND-gate results, command status and workflow.

Quarantine & CUSUM — trusted baseline, quarantined samples and persistent-shift statistics.

Uncertainty & Calibration — calibration offsets and the measurement uncertainty budget.

Source Profiles — labelled-source selection, similarity and unknown-source lockout.

Recovery FSM & Purge — Normal, Suspect, Blocked, Recovery Check and Restored states.

Exposure & CMSI — command-based admitted and blocked stress accounting.

Challenge Replay Rig — synthetic fault injection, comparator results, export and replay.

Audit Log & Config — safety limits, coverage factor, recovery configuration and decision history.

Every workspace reads the same GateController state. Values shown on different pages are not independent dashboard mock-ups.

Hardware used in the LED demonstration

ESP32 development board

Analog TDS interface and probe

Analog pH interface and probe

DS18B20 water-temperature sensor

SH1106 128×64 I²C OLED at address 0x3C

4×4 matrix keypad

Two LED/driver circuits representing main and drain commands

USB connection to the dashboard computer

ESP32 pin map

These assignments match the revised demonstration sketch and must remain unchanged unless the physical wiring is changed at the same time.

Function

ESP32 GPIO

TDS analog input

32

TDS module power/enable

5

pH analog input

33

pH module power/enable

23

DS18B20 data

4

Drain-command LED

27

Main-command LED

17

Keypad rows R1–R4

19, 18, 15, 14

Keypad columns C1–C4

13, 12, 26, 25

OLED SDA/SCL

Board-default I²C pins used by Wire.begin()

GPIO 5 and GPIO 23 are treated as sensor-enable outputs because that is how the prototype was wired. Confirm that the attached module/driver is suitable for GPIO control and that every analog output stays inside the ESP32 ADC input range.

Keypad and LED behavior

The firmware boots in LOCAL / LED TEST mode.

Key

Function

A

Drain LED ON; main LED OFF

B

Drain LED OFF

C

Main LED ON; drain LED OFF

D

Main LED OFF

*

Toggle normal readings and raw-ADC OLED pages

0

Switch between LOCAL LED TEST and AUTO LED DEMO; both LEDs close during transition

#

Optional supervised freshness assertion when explicitly enabled and a host lease exists

The firmware prevents both path indicators from being ON together.

LOCAL / LED TEST

The keypad owns the LEDs. This mode is intended to demonstrate indicator wiring without sensors, calibration or a dashboard command. Disconnect the dashboard before using it; the firmware intentionally does not acknowledge host commands while local mode owns the outputs.

AUTO / LED DEMO

The dashboard owns both LEDs. Press 0 before connecting USB hardware. Keys A–D are ignored in AUTO and the OLED displays a reminder, preventing keypad commands from competing with dashboard commands.

The firmware defaults to:

constexpr bool CALIBRATION_CONFIRMED = false;
constexpr bool ALLOW_OPERATOR_FRESHNESS = false;

Therefore, a new uncalibrated build is expected to remain closed in hardware mode. Change these flags only after the corresponding evidence exists. A static timestamp, LED state or valve command is not fresh-water evidence.

Serial interface

The ESP32 and dashboard communicate directly over USB serial at 115200 baud. No cloud server, MQTT broker or Wi-Fi link is required. The browser-side controller is the project backend for this prototype.

Each message is one UTF-8 JSON object followed by a newline. Do not print human-readable debug messages on the same serial channel.

ESP32 to dashboard: sensor sample

{"type":"sample","seq":42,"tds":360.5,"ph":7.35,"temp":26.0,"valid":true,"fresh":true,"estimated":false}

Required fields:

Field

Meaning

seq

Strictly increasing sample number

tds

Calibrated, temperature-compensated TDS in ppm

ph

Calibrated pH

temp

Water temperature in °C

valid

All three physical measurements passed acquisition checks

fresh

Independent evidence that the chamber contains a fresh inlet sample

estimated

true when a failed sensor was replaced by an estimate; this blocks opening

The LED firmware also sends metadata such as raw ADC counts, control mode, actuator kind and physical_flow_verified:false. The present dashboard safely ignores unknown fields.

Dashboard to ESP32: command

{"type":"command","seq":14,"main":"CLOSED","drain":"OPEN","ttl_ms":2500}

ESP32 to dashboard: acknowledgement

{"type":"ack","seq":14,"main":"CLOSED","drain":"OPEN","actuator_kind":"LED_EMULATOR"}

An ACK confirms the GPIO command state, not mechanical valve position or water flow. The browser faults on a mismatched ACK or after three seconds without valid samples/acknowledgements. The firmware independently turns both indicators off when its command lease expires after at most 2.5 seconds.

Software requirements

Node.js 24 LTS

npm

Chrome or Edge for physical USB Web Serial

Arduino IDE 2.x for ESP32 firmware

Arduino ESP32 board package

Arduino libraries:

ArduinoJson 7

Adafruit GFX Library

Adafruit SH110X

Adafruit BusIO

OneWire

DallasTemperature

Keypad

FS, LittleFS and Wire are supplied by the ESP32 Arduino core.

Run the dashboard

cd okeanos
npm ci
npm run dev

Open:

http://localhost:1420

The app starts in simulation with a closed command and synthetic 1 Hz samples. With stable fresh input, startup recovery completes after approximately 34 seconds.

Production preview:

npm run build
npm run preview

Safari can run simulation and replay but does not provide the required Web Serial connection. The existing Tauri shell also supports simulation/replay; the implemented USB route is the Chrome/Edge browser path.

Upload the ESP32 firmware

Open firmware/okeanos_led_demo/okeanos_led_demo.ino in Arduino IDE.

Install the required libraries.

Select the correct ESP32 board and USB port.

Compile and upload.

Open Serial Monitor at 115200 only for an isolated packet check.

Close Serial Monitor before connecting the dashboard because only one application can own the port.

Check that the OLED starts in LOCAL / LED TEST and both LEDs are OFF.

The present firmware uses provisional conversions:

TDS = raw ADC × 0.15
pH  = raw ADC × 0.002

At a 12-bit ADC maximum of 4095, these produce only 614.25 ppm and pH 8.19. They cannot validate the complete configured range and must be replaced with coefficients measured from the actual modules and calibration standards.

Recommended demonstration without flowing water

Use two clearly separated stages.

Stage 1: complete controller simulation

Keep USB hardware disconnected.

Click Reset to simulation.

Open Challenge Replay Rig.

Run a scenario such as Recovery then recurrence.

After the 40-second startup segment, show the TDS failure, immediate main-command closure, frozen learning and recorded reason.

Open Recovery FSM & Purge and confirm that the simulation uses a virtual drain.

Request the 15-second purge to show main CLOSED and drain OPEN.

Visit the other workspaces to show that they update from the same event.

Simulation/replay is labelled NO HARDWARE OUTPUT. It cannot drive the ESP32 LEDs while hardware is connected.

Stage 2: physical sensing and command indicators

Leave the probes in the available static sample containers.

Show live sensor values and the OLED.

In LOCAL mode, use A/B/C/D to demonstrate the two LED paths and their mutual exclusion.

Explain that the LEDs emulate relay/solenoid command states.

If demonstrating the USB transport, press 0 to enter AUTO before clicking Connect USB hardware.

Because static water does not independently prove chamber refresh, the controller should not claim automatic recovery. A supervised test may replace the entire sample around the probes and record that human observation, but it must be labelled operator evidence rather than measured flow.

Demonstrating a TDS threshold breach

For the most repeatable dashboard result:

Disconnect USB and reset to simulation.

Run Recovery then recurrence.

Wait for the challenge to reach the excursion; simulated TDS rises to about 900 ppm.

In Command Center, show:

TDS status FAIL

[✗ TDS INTERVAL]

actuator DE-ENERGIZED (CLOSED)

main command CLOSED

closure reason MEASURED_BREACH

Click Trigger Purge (15s) to show drain command OPEN while main remains CLOSED.

A hard TDS breach closes the main path immediately. Drain opening is a separate purge/recovery action; the controller does not leave the drain permanently open for every breach.

Decision rules

The main command can open only when all required conditions pass:

valid physical acquisition
AND ordered 1 Hz telemetry
AND fresh-sample evidence
AND TDS uncertainty interval within limits
AND pH uncertainty interval within limits
AND temperature uncertainty interval within limits
AND known source profile
AND no manual-close latch
AND no unresolved drift/fault
AND recovery window completed

Default illustrative limits:

Parameter

Range

TDS

0–800 ppm

pH

6.5–8.5

Water temperature

10–45 °C

These are commissioning examples, not universal safety limits. Dashboard settings may tighten them but cannot exceed the controller's commissioning ceilings. Firmware limits and dashboard limits must be aligned to the installed membrane specification.

Recovery states

State

Meaning

Normal

All permission conditions remain satisfied

Suspect

A non-hard anomaly is being evaluated and learning is frozen

Blocked

Main command is closed and the reason is recorded

Recovery Check

Fresh, stable, acceptable samples are being counted

Restored

Recovery criteria completed; permission can return

Thirty qualifying fresh samples spanning at least 29 seconds are required by default. Hysteresis prevents threshold chatter and a single acceptable sample cannot reopen the main path.

Persistence and data limits

Hardware configuration, source baselines, calibration offsets, exposure and command-cycle count are checkpointed in browser storage.

Permission, recovery timers and emergency mode are never restored after restart.

The trusted baseline uses source-specific minute aggregates retained for 30 days.

Quarantine retains the newest 3,600 candidate samples.

The visible flight recorder retains 300 decisions.

Export retains up to 10,000 sample/action events and marks longer sessions as truncated.

ESP32 LittleFS logging occurs every 10 seconds and stops at 256 KiB instead of overwriting data automatically.

Browser storage and LittleFS logs are prototype records, not authenticated or tamper-proof audit storage.

Verification

Run the automated checks:

npm test
npm run test:challenges
npm run build

Optional Chromium UI test:

npx playwright install chromium
npm run test:ui

Verified in the current source snapshot:

28 controller and serial-protocol tests passed.

TypeScript checks and the Vite production build passed.

All 10 deterministic challenges executed through the real controller.

Tests cover startup recovery, hard-limit closure, uncertainty overlap, sensor faults, freshness loss, drain interlock, persistent manual closure, restart closure, quarantine, replay, exposure and serial acknowledgements.

Native LED-firmware behavior checks passed for the fixed pin map, A/B/C/D controls, mutual exclusion, LOCAL/AUTO ownership, 1 Hz multiplexed acquisition, timeout closure and serial framing.

Automated checks do not prove ADC calibration, actual flow, valve travel, leakage, electrical noise performance or water safety. Those require the completed physical rig and reference measurements.

Troubleshooting

Challenge buttons are disabled

The dashboard is in HARDWARE mode. Disconnect USB and click Reset to simulation. Synthetic challenges are intentionally prevented from controlling hardware.

ESP32 connects and immediately times out

Press 0 until the OLED shows AUTO / LED DEMO before connecting.

Close Arduino Serial Monitor.

Use Chrome or Edge on localhost.

Confirm 115200 baud and that no debug text is printed on the JSON channel.

Confirm that the ESP32 sends one well-formed sample each second and ACKs every command.

Dashboard reports sensor/calibration fault

This is expected while CALIBRATION_CONFIRMED=false or a probe is disconnected. Calibrate the probes and conversion range before setting it true.

Dashboard never opens the main path

Check valid, fresh, uncertainty intervals, source match, manual latch and recovery count. With static water and fresh:false, automatic opening is intentionally inhibited.

Dashboard shows main CLOSED but drain also CLOSED

A measurement breach closes the main path. The drain opens only during a commissioned purge or applicable recovery state. In simulation, enable the virtual drain and request a purge.

Keypad does not change LEDs

The firmware is in AUTO. Press 0 to return to LOCAL. Disconnect the dashboard first so it does not report the deliberate loss of host ownership as a fault.

Hardware values look unrealistic

Inspect the raw ADC OLED page using *. Check sensor power, grounding, interface output range, settling time and calibration coefficients. Do not correct unexplained values by merely widening safety limits.

Scaling the concept

A deployment can replace the USB connection with an authenticated local gateway while keeping the same packet and decision contracts. Useful extensions include redundant probes, an isolated ADC, valve-position feedback, chamber flow measurement, a commissioned automatic drain, signed audit records, authenticated configuration, remote monitoring and a validated membrane-condition model using permeate flow, rejection and pressure differential.

The technically distinctive direction is the connection between qualified learning, measurement confidence and physical permission: a valve decision controls which samples may influence future baselines, uncertain readings cannot authorize flow, and restoration requires new evidence rather than one good measurement.

Project status

This is an engineering prototype and demonstration platform. The software controller, simulation/replay, browser serial transport and LED-emulator firmware have been developed and tested at software level. Sensor calibration, continuous-flow recovery, actual solenoid plumbing and independent position/flow feedback remain commissioning work.

No project license file is currently supplied. Add an explicit license before distributing or accepting external contributions.
