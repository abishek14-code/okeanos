/*
  OKEANOS / AquaSentinel - integrated ESP32 sketch
  Target: classic ESP32, Arduino ESP32 core; USB Serial at 115200 baud.
  Libraries: ArduinoJson 7, Adafruit GFX, Adafruit SH110X, OneWire,
             DallasTemperature, Keypad. LittleFS/Wire come with the ESP32 core.
  This file replaces the reference sketch AND sensor_adapter.h. No adapter needed.

  ALL GPIO assignments below are unchanged from the supplied hardware sketch.
  Relay HIGH = energised/open is retained. Verify polarity and normally-closed
  plumbing on the bench. A GPIO command/ACK is NOT valve position or flow feedback.
  On boot, invalid commands and command timeout BOTH valves are commanded closed.
  GPIO5/23 retain their existing sensor-power/enable function; verify driver current
  and ADC voltage suitability. This sketch does not change the electrical circuit.

  COMMISSION BEFORE ENABLING FLOW:
  1. Replace TDS/PH gain and offset with coefficients measured using standards.
     Original raw*0.15/raw*0.002 are retained ONLY as provisional display values.
     At 4095 counts these reach only 614.25 ppm and pH 8.19: they cannot validate
     the illustrative upper limits. Verify the full required measurement range.
     Set CALIBRATION_CONFIRMED=true only after calibrating the actual modules,
     ADC setup, power settling times and temperature compensation together.
  2. Set limits from the actual membrane specification; match dashboard limits.
     The limits below are illustrative, not proof of potability/membrane life.
  3. Verify drain plumbing, relay behaviour and valve travel; then set
     DRAIN_COMMISSIONED=true AND enable the dashboard's commissioned drain option.
  4. Fresh supply is not observable from these three probes alone. By default
     fresh=false and automatic opening is inhibited, matching the adapter contract.
     For SUPERVISED DEMONSTRATION ONLY, ALLOW_OPERATOR_FRESHNESS may be enabled.
     Press # ONLY after personally verifying fresh supply through the sensor
     chamber (e.g. observe an actual drain purge). Confirmation expires after
     120 seconds; keep observing flow and revoke it with * if flow stops.
     It is an operator assertion, not automatic/sensor-verified flow. Additional
     telemetry labels its basis; the current dashboard ignores those extra fields.
     Unattended operation needs independent flow/fresh-sample evidence and its
     input driver; never substitute elapsed time or a valve command for evidence.

  CONNECT: close Arduino Serial Monitor; open the existing dashboard in Chrome/
  Edge on localhost, choose hardware/USB serial and connect this ESP32.
  Select/validate the source profile in the dashboard. Firmware does not use HTTP,
  Wi-Fi or an invented server endpoint. The dashboard's serial service is the
  implemented transport. The host must renew commands at least every 2500 ms.
  If board reset emits ROM boot text, wait for boot and reconnect the dashboard.

  KEYPAD: A = release local stop (does NOT force main open); B or * = latch stop,
  close both valves and revoke freshness; # = optional supervised confirmation;
  D = toggle raw ADC display. C/numeric keys are reserved. Use dashboard purge
  for the drain. A local veto is acknowledged honestly; the current host treats
  a command/ACK mismatch as a serial fault. Reconnect after resolving the veto.

  TIMING: nonblocking acquisition targets one fresh sensor conversion per second.
  Median filtering rejects spikes inside a measurement; it is not the temporal
  anomaly classifier. Transient/persistent classification, learning quarantine,
  uncertainty, profiles, recovery windows, exposure and replay remain in the host
  controller. Firmware independently enforces validity, hard limits and lease.
  If the host stops, no autonomous reopening is attempted.

  DEVICE -> HOST (one JSON object per line, no debug text):
    {"type":"sample","seq":1,"tds":420,"ph":7.2,"temp":25,
     "valid":true,"fresh":false,"estimated":false,...}
  HOST -> DEVICE:
    {"type":"command","seq":1,"main":"CLOSED","drain":"CLOSED","ttl_ms":2500}
  DEVICE -> HOST:
    {"type":"ack","seq":1,"main":"CLOSED","drain":"CLOSED"}
  valid refers to calibrated sensor acquisition, not acceptable water or valve
  state. estimated=false means no regression-replaced sensor is used.

  LittleFS is mounted WITHOUT autoformat. Logging is optional, once per 10 seconds,
  capped at 256 KiB to avoid unbounded flash use. Full/missing FS disables logging;
  export/remove /okeanos_log.csv explicitly to resume. No old datalog is erased.
  No hardware testing is implied by this source. Bench-test with water diverted:
  disconnect USB, unplug probes, issue conflicting valve commands, test local stop,
  expiry/reboot and recovery. Confirm actual valve states, not just the OLED.
*/
#include <Arduino.h>
#include <ArduinoJson.h>
#include "FS.h"
#include <LittleFS.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Keypad.h>
#include <math.h>

#define TDS_PIN 32
#define TDS_POWER_PIN 5
#define PH_PIN 33
#define PH_POWER_PIN 23
#define TEMP_PIN 4
#define RELAY_PIN 27
#define DRAIN_RELAY_PIN 17
#define I2C_ADDRESS 0x3C

constexpr bool RELAY_ACTIVE_HIGH = true;
constexpr bool CALIBRATION_CONFIRMED = false;
constexpr bool DRAIN_COMMISSIONED = false;
constexpr bool ALLOW_OPERATOR_FRESHNESS = false;
constexpr float TDS_GAIN = 0.15f, TDS_OFFSET = 0.0f;
constexpr float PH_GAIN = 0.002f, PH_OFFSET = 0.0f;
// Set a coefficient validated for the probe/source; zero retains original behaviour.
// E.g. 0.02 means 2 percent per Celsius. Do not assume it is universally correct.
constexpr float TDS_TEMP_COEFFICIENT = 0.0f;
constexpr float TDS_MAX = 800, PH_MIN = 6.5f, PH_MAX = 8.5f;
constexpr float TEMP_MIN = 10, TEMP_MAX = 45;
constexpr uint32_t SAMPLE_MS = 1000, MAX_TTL_MS = 2500;
constexpr uint32_t SENSOR_MAX_AGE_MS = 1500, FRESH_CONFIRM_MS = 120000;
constexpr uint32_t POWER_SETTLE_MS = 100, ADC_INTERVAL_MS = 2;
constexpr int SAMPLE_COUNT = 32;
constexpr size_t LOG_MAX_BYTES = 256 * 1024;
const char *dataPath = "/okeanos_log.csv";

Adafruit_SH1106G display(128, 64, &Wire, -1);
OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);
const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {{'1','2','3','A'}, {'4','5','6','B'},
                       {'7','8','9','C'}, {'*','0','#','D'}};
byte rowPins[ROWS] = {19,18,15,14};
byte colPins[COLS] = {13,12,26,25};
Keypad keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

float tds = 0, ph = 0, tempC = 0;
int rawTds = 0, rawPh = 0, adcBuffer[SAMPLE_COUNT];
bool valid = false, haveSample = false;
bool mainOpen = false, drainOpen = false, localStop = false;
bool oledOK = false, logOK = false, rawPage = false;
bool haveCommand = false, confirmedFresh = false;
uint32_t lastSample = 0, sampleSeq = 0, lastCommand = 0, commandTtl = 0;
uint32_t lastCommandSeq = 0, freshConfirmedAt = 0, lastLog = 0, lastDisplay = 0;
char serialLine[513];
size_t serialLength = 0;
bool discardLine = false;

// 0 idle, 1 TDS settle, 2 TDS samples, 3 pH settle, 4 pH samples, 5 temperature wait.
uint8_t acquisitionPhase = 0;
int adcIndex = 0;
uint32_t cycleAt = 0, phaseAt = 0, adcAt = 0;
bool firstCycle = true;

void outputs(bool main, bool drain) {
  if (main && drain) { main = false; drain = false; }
  if (!DRAIN_COMMISSIONED) drain = false;
  const uint8_t off = RELAY_ACTIVE_HIGH ? LOW : HIGH;
  const uint8_t on = RELAY_ACTIVE_HIGH ? HIGH : LOW;
  // Close the outgoing path before energising the other. Unchanged renewals do
  // not pulse relays. Mechanical break-before-make still requires commissioning.
  if (!main) digitalWrite(RELAY_PIN, off);
  if (!drain) digitalWrite(DRAIN_RELAY_PIN, off);
  if (drain) digitalWrite(DRAIN_RELAY_PIN, on);
  if (main) digitalWrite(RELAY_PIN, on);
  mainOpen = main; drainOpen = drain;
}

bool freshNow() {
  return ALLOW_OPERATOR_FRESHNESS && confirmedFresh &&
         uint32_t(millis() - freshConfirmedAt) < FRESH_CONFIRM_MS;
}

bool sensorPermits() {
  return haveSample && valid && freshNow() && !localStop &&
    uint32_t(millis() - lastSample) <= SENSOR_MAX_AGE_MS &&
    tds >= 0 && tds <= TDS_MAX && ph >= PH_MIN && ph <= PH_MAX &&
    tempC >= TEMP_MIN && tempC <= TEMP_MAX;
}

void invalidateCommand() {
  haveCommand = false;
  outputs(false, false);
  confirmedFresh = false;
}

void safetyTick() {
  if (haveCommand && uint32_t(millis() - lastCommand) >= commandTtl)
    invalidateCommand();
  if (localStop) outputs(false, false);
  if (mainOpen && !sensorPermits()) outputs(false, false);
}

void processCommand(const char *line) {
  JsonDocument doc;
  if (deserializeJson(doc, line) || doc["type"] != "command" ||
      !doc["seq"].is<uint32_t>() || !doc["ttl_ms"].is<uint32_t>() ||
      !doc["main"].is<const char *>() || !doc["drain"].is<const char *>()) {
    invalidateCommand(); return;
  }
  const uint32_t seq = doc["seq"].as<uint32_t>();
  const uint32_t ttl = doc["ttl_ms"].as<uint32_t>();
  const char *main = doc["main"], *drain = doc["drain"];
  const bool wantMain = strcmp(main, "OPEN") == 0;
  const bool wantDrain = strcmp(drain, "OPEN") == 0;
  const bool closedMain = strcmp(main, "CLOSED") == 0;
  const bool closedDrain = strcmp(drain, "CLOSED") == 0;
  // Initial/reconnected sessions must first send CLOSED/CLOSED. No open command
  // can start a session after a timeout, malformed input or boot.
  const bool handshake = !haveCommand && closedMain && closedDrain;
  if (!seq || !ttl || ttl > MAX_TTL_MS || (!wantMain && !closedMain) ||
      (!wantDrain && !closedDrain) || (wantMain && wantDrain) ||
      (!haveCommand && !handshake) || (!handshake && seq <= lastCommandSeq)) {
    invalidateCommand(); return;
  }
  lastCommandSeq = seq; lastCommand = millis(); commandTtl = ttl; haveCommand = true;
  outputs(wantMain && sensorPermits(), wantDrain && !localStop);
  JsonDocument ack;
  ack["type"] = "ack"; ack["seq"] = seq;
  ack["main"] = mainOpen ? "OPEN" : "CLOSED";
  ack["drain"] = drainOpen ? "OPEN" : "CLOSED";
  serializeJson(ack, Serial); Serial.println();
}

void serialTick() {
  // Bounded processing prevents a byte flood from starving the local watchdog.
  for (int i = 0; i < 128 && Serial.available(); ++i) {
    const char c = char(Serial.read());
    if (c == '\n') {
      if (!discardLine && serialLength) {
        serialLine[serialLength] = '\0'; processCommand(serialLine);
      }
      serialLength = 0; discardLine = false;
    } else if (c != '\r' && !discardLine) {
      if (c == '\0' || serialLength >= sizeof(serialLine) - 1) {
        discardLine = true; serialLength = 0; invalidateCommand();
      } else serialLine[serialLength++] = c;
    }
  }
}

int median() {
  // Sort this completed buffer in place; next probe fills it again.
  for (int i = 1; i < SAMPLE_COUNT; ++i) {
    int v = adcBuffer[i], j = i - 1;
    while (j >= 0 && adcBuffer[j] > v) { adcBuffer[j+1] = adcBuffer[j]; --j; }
    adcBuffer[j+1] = v;
  }
  return (adcBuffer[15] + adcBuffer[16]) / 2;
}

void publishSample() {
  JsonDocument packet;
  packet["type"] = "sample"; packet["seq"] = ++sampleSeq;
  packet["tds"] = tds; packet["ph"] = ph; packet["temp"] = tempC;
  packet["valid"] = valid; packet["fresh"] = freshNow(); packet["estimated"] = false;
  packet["t_ms"] = lastSample;
  packet["raw_tds"] = rawTds; packet["raw_ph"] = rawPh;
  packet["calibrated"] = CALIBRATION_CONFIRMED;
  packet["freshness_basis"] = freshNow() ? "operator_assertion" : "unverified";
  packet["main"] = mainOpen ? "OPEN" : "CLOSED";
  packet["drain"] = drainOpen ? "OPEN" : "CLOSED";
  packet["local_stop"] = localStop;
  serializeJson(packet, Serial); Serial.println();
}

void acquisitionTick() {
  const uint32_t now = millis();
  if (acquisitionPhase == 0) {
    if (!firstCycle && uint32_t(now - cycleAt) < SAMPLE_MS) return;
    firstCycle = false; cycleAt = now;
    sensors.requestTemperatures(); // asynchronous; externally powered DS18B20 required
    digitalWrite(PH_POWER_PIN, LOW); digitalWrite(TDS_POWER_PIN, HIGH);
    phaseAt = now; acquisitionPhase = 1; return;
  }
  if (acquisitionPhase == 1 || acquisitionPhase == 3) {
    if (uint32_t(now - phaseAt) < POWER_SETTLE_MS) return;
    adcIndex = 0; adcAt = now - ADC_INTERVAL_MS; ++acquisitionPhase;
  }
  if (acquisitionPhase == 2 || acquisitionPhase == 4) {
    if (uint32_t(now - adcAt) < ADC_INTERVAL_MS) return;
    adcAt = now;
    adcBuffer[adcIndex++] = analogRead(acquisitionPhase == 2 ? TDS_PIN : PH_PIN);
    if (adcIndex < SAMPLE_COUNT) return;
    if (acquisitionPhase == 2) {
      rawTds = median(); digitalWrite(TDS_POWER_PIN, LOW);
      digitalWrite(PH_POWER_PIN, HIGH); phaseAt = now; acquisitionPhase = 3;
    } else {
      rawPh = median(); digitalWrite(PH_POWER_PIN, LOW); acquisitionPhase = 5;
    }
    return;
  }
  if (acquisitionPhase != 5 || uint32_t(now - cycleAt) < 750) return;
  tempC = sensors.getTempCByIndex(0);
  const float compensation = 1.0f + TDS_TEMP_COEFFICIENT * (tempC - 25.0f);
  tds = compensation > 0 ? (rawTds * TDS_GAIN + TDS_OFFSET) / compensation : NAN;
  ph = rawPh * PH_GAIN + PH_OFFSET;
  valid = CALIBRATION_CONFIRMED && rawTds > 0 && rawTds < 4095 &&
    rawPh > 0 && rawPh < 4095 && isfinite(tds) && isfinite(ph) &&
    isfinite(tempC) && tempC != DEVICE_DISCONNECTED_C && tempC != 85.0f &&
    tempC >= -55 && tempC <= 125 && ph >= 0 && ph <= 14 && tds >= 0;
  // Keep packets JSON-numeric even on failed probes; valid remains false.
  if (!isfinite(tds)) tds = 0;
  if (!isfinite(ph)) ph = 0;
  if (!isfinite(tempC)) tempC = 0;
  lastSample = millis(); haveSample = true; acquisitionPhase = 0;
  safetyTick(); publishSample();
}

void keypadTick() {
  const char key = keypad.getKey();
  if (key == 'A') localStop = false;
  if (key == 'B' || key == '*') { localStop = true; confirmedFresh = false; outputs(false,false); }
  if (key == 'D') rawPage = !rawPage;
  // A deliberate human assertion only. Neither a running timer nor relay state
  // automatically creates evidence that stagnant chamber water has been replaced.
  if (key == '#' && ALLOW_OPERATOR_FRESHNESS && !localStop && haveCommand) {
    confirmedFresh = true; freshConfirmedAt = millis();
  }
}

void displayTick() {
  if (!oledOK || uint32_t(millis() - lastDisplay) < 500) return;
  lastDisplay = millis(); display.clearDisplay(); display.setCursor(0,0);
  display.println("AquaSentinel / USB");
  if (rawPage) {
    display.print("ADC TDS: "); display.println(rawTds);
    display.print("ADC pH:  "); display.println(rawPh);
    display.println(CALIBRATION_CONFIRMED ? "Calibrated" : "CALIBRATE FIRST");
    display.println(logOK ? "Flash logging OK" : "Flash log disabled");
  } else {
    display.print("TDS "); display.print(tds,1); display.println(" ppm");
    display.print("pH "); display.print(ph,2); display.print(" T "); display.println(tempC,1);
    display.print("Main "); display.print(mainOpen ? "ON" : "OFF");
    display.print(" Drain "); display.println(drainOpen ? "ON" : "OFF");
    display.println(localStop ? "LOCAL STOP" : !haveCommand ? "NO HOST LEASE" :
                    !valid ? "INVALID/CALIBRATE" : !freshNow() ? "FRESH UNVERIFIED" : "OPERATOR FRESH");
  }
  display.display();
}

void logTick() {
  if (!logOK || !haveSample || uint32_t(millis() - lastLog) < 10000) return;
  lastLog = millis();
  File file = LittleFS.open(dataPath, FILE_APPEND);
  if (!file) { logOK = false; return; }
  if (file.size() + 160 > LOG_MAX_BYTES) { file.close(); logOK = false; return; }
  if (!file.size()) file.println("t_ms,tds_ppm,ph,temp_c,valid,fresh,main_cmd,drain_cmd");
  const size_t written = file.printf("%lu,%.2f,%.2f,%.2f,%d,%d,%d,%d\n",
    (unsigned long)lastSample, tds, ph, tempC, valid, freshNow(), mainOpen, drainOpen);
  file.close(); if (!written) logOK = false;
}

void setup() {
  // Initialise actuators first. Physical inactive pulls are needed during reset.
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_HIGH ? LOW : HIGH);
  digitalWrite(DRAIN_RELAY_PIN, RELAY_ACTIVE_HIGH ? LOW : HIGH);
  pinMode(RELAY_PIN, OUTPUT); pinMode(DRAIN_RELAY_PIN, OUTPUT); outputs(false,false);
  Serial.begin(115200);
  pinMode(TDS_PIN, INPUT); pinMode(PH_PIN, INPUT);
  pinMode(TDS_POWER_PIN, OUTPUT); pinMode(PH_POWER_PIN, OUTPUT);
  digitalWrite(TDS_POWER_PIN, LOW); digitalWrite(PH_POWER_PIN, LOW);
  analogReadResolution(12);
  analogSetPinAttenuation(TDS_PIN, ADC_11db); analogSetPinAttenuation(PH_PIN, ADC_11db);
  sensors.begin(); sensors.setResolution(12); sensors.setWaitForConversion(false);
  Wire.begin(); // Keep board-default I2C pins, as in the original sketch.
  oledOK = display.begin(I2C_ADDRESS, true);
  if (oledOK) { display.clearDisplay(); display.setTextSize(1); display.setTextColor(SH110X_WHITE); }
  logOK = LittleFS.begin(false);
}

void loop() {
  safetyTick(); serialTick(); keypadTick(); safetyTick();
  acquisitionTick(); safetyTick(); displayTick(); safetyTick(); logTick(); safetyTick();
  // No delay(500), blocking temperature conversion, or human-readable serial logs.
}
