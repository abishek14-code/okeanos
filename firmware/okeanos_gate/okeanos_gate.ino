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
#include <Preferences.h>
#include "gate_policy.h"

#define TDS_PIN 32
#define TDS_POWER_PIN 5
#define PH_PIN 33
#define PH_POWER_PIN 23
#define TEMP_PIN 4
#define DRAIN_VALVE_PIN 27  // Drain LED on existing 12V-path control GPIO: A/B
#define MAIN_VALVE_PIN 17   // Main LED on existing 24V-path control GPIO: C/D
#define I2C_ADDRESS 0x3C

// Keep true for the uploaded LED prototype. Commission drivers before changing.
constexpr bool LED_EMULATOR = true;
constexpr bool DRAIN_COMMISSIONED = LED_EMULATOR;
constexpr bool ACTIVE_HIGH = true;
constexpr int FLOW_SWITCH_PIN = -1; // Optional independent chamber-flow switch; -1 = absent.
constexpr bool FLOW_ACTIVE_LOW = true;
constexpr bool ALLOW_OPERATOR_FRESHNESS = LED_EMULATOR;
constexpr float TDS_GAIN = 0.15f, TDS_OFFSET = 0.0f;
constexpr float PH_GAIN = 0.002f, PH_OFFSET = 0.0f;

constexpr float TDS_TEMP_COEFFICIENT = 0.0f;
constexpr float TDS_MAX = 800, PH_MIN = 6.5f, PH_MAX = 8.5f;
constexpr float TEMP_MIN = 10, TEMP_MAX = 45;
constexpr uint32_t SAMPLE_MS = 1000, MAX_TTL_MS = 2500;
constexpr uint32_t SENSOR_MAX_AGE_MS = 1500, FRESH_CONFIRM_MS = 120000;
constexpr uint32_t POWER_SETTLE_MS = 100, ADC_INTERVAL_MS = 2;
constexpr int SAMPLE_COUNT = 32;
constexpr size_t LOG_MAX_BYTES = 256 * 1024;
const char *dataPath = "/okeanos_led_log.csv";

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
bool mainOpen = false, drainOpen = false;
bool localDemo = false; 
bool keyNotice = false;
uint32_t keyNoticeAt = 0;
char keyEcho = 0;
uint32_t keyEchoAt = 0;
bool oledOK = false, logOK = false, rawPage = false;
bool haveCommand = false, confirmedFresh = false;
uint32_t lastSample = 0, sampleSeq = 0, lastCommand = 0, commandTtl = 0;
uint32_t lastCommandSeq = 0, freshConfirmedAt = 0, lastLog = 0, lastDisplay = 0;
char serialLine[1537];
size_t serialLength = 0;
bool discardLine = false;

uint8_t acquisitionPhase = 0;
int adcIndex = 0;
uint32_t cycleAt = 0, phaseAt = 0, adcAt = 0;
bool firstCycle = true;

struct CalibrationStore {
  uint32_t schema = 2;
  float gain[3] = {TDS_GAIN, PH_GAIN, 1};
  float offset[3] = {TDS_OFFSET, PH_OFFSET, 0};
  bool ready[3] = {false, false, true};
  uint32_t at[3] = {0, 0, 0};
};
CalibrationStore calibration;
Preferences preferences;
bool preferencesOK = false, sensorHealthy = false;
GatePolicy gate;
float rawTemp = NAN;
float stableRaw[3][5] = {};
uint8_t stableSamples = 0, stableIndex = 0;
bool firstPoint[2] = {false, false};
float firstRaw[2] = {}, firstReference[2] = {};
uint32_t firstPointAt[2] = {};
const char *sensorNames[3] = {"tds", "ph", "temp"};

bool calibrated() { return calibration.ready[0] && calibration.ready[1] && calibration.ready[2]; }
const char *actuatorKind() { return LED_EMULATOR ? "LED_EMULATOR" : "VALVE_DRIVER"; }
bool physicalFresh() { return FLOW_SWITCH_PIN >= 0 && digitalRead(FLOW_SWITCH_PIN) == (FLOW_ACTIVE_LOW ? LOW : HIGH); }
void emit(JsonDocument &doc) { serializeJson(doc, Serial); Serial.println(); }
void reply(uint32_t id, bool ok, const char *message) {
  JsonDocument d; d["type"] = "response"; d["id"] = id; d["ok"] = ok; d["message"] = message; emit(d);
}

void outputs(bool main, bool drain) {
  if (main && drain) { main = false; drain = false; }
  if (!main) digitalWrite(MAIN_VALVE_PIN, ACTIVE_HIGH ? LOW : HIGH);
  if (!drain) digitalWrite(DRAIN_VALVE_PIN, ACTIVE_HIGH ? LOW : HIGH);
  if (main) digitalWrite(MAIN_VALVE_PIN, ACTIVE_HIGH ? HIGH : LOW);
  if (drain) digitalWrite(DRAIN_VALVE_PIN, ACTIVE_HIGH ? HIGH : LOW);
  mainOpen = main; drainOpen = drain;
}

bool freshNow() {
  return !localDemo && (physicalFresh() || (ALLOW_OPERATOR_FRESHNESS && confirmedFresh &&
         uint32_t(millis() - freshConfirmedAt) < FRESH_CONFIRM_MS));
}

bool sensorPermits() {
  return haveSample && valid && freshNow() &&
    uint32_t(millis() - lastSample) <= SENSOR_MAX_AGE_MS &&
    gate.permits(tds, ph, tempC);
}

void invalidateCommand() {
  haveCommand = false;
  // While the keypad holds local control the operator owns the outputs; a host
  // command (or its absence) must not extinguish them every second.
  if (!localDemo) outputs(false, false);
  confirmedFresh = false;
}

void safetyTick() {
  if (localDemo) return; 
  if (haveCommand && uint32_t(millis() - lastCommand) >= commandTtl)
    invalidateCommand();
  if (!haveCommand) outputs(false, false);
  if (mainOpen && !sensorPermits()) outputs(false, false);
}

void processCommand(const char *line) {
  JsonDocument doc;
  if (deserializeJson(doc, line)) { invalidateCommand(); return; }
  const char *type = doc["type"] | "";
  if (!strcmp(type, "hello")) {
    // A new host always acquires the device closed, including from local LED test.
    localDemo = false; invalidateCommand(); lastCommandSeq = 0;
    firstPoint[0] = firstPoint[1] = false;
    JsonDocument d; d["type"] = "response"; d["id"] = doc["id"]; d["ok"] = true;
    d["protocol"] = 2; d["firmware"] = "okeanos-2.0";
    char deviceId[17]; snprintf(deviceId, sizeof(deviceId), "%012llx", (unsigned long long)ESP.getEfuseMac());
    d["device_id"] = deviceId; d["actuator_kind"] = actuatorKind();
    d["drain_available"] = DRAIN_COMMISSIONED; d["flow_input"] = FLOW_SWITCH_PIN >= 0;
    d["message"] = "Dashboard control acquired; outputs closed"; emit(d); return;
  }
  if (!strcmp(type, "calibrate")) {
    const uint32_t id = doc["id"] | 0U;
    if (!localDemo) outputs(false, false);
    int k = -1; for (int i=0;i<3;++i) if (doc["sensor"] == sensorNames[i]) k=i;
    if (localDemo || !haveCommand || k<0 || !doc["reference"].is<float>() ||
        !doc["sample_seq"].is<uint32_t>() || doc["sample_seq"].as<uint32_t>() != sampleSeq ||
        !doc["epoch"].is<uint32_t>() || doc["epoch"].as<uint32_t>() < 1700000000U ||
        !sensorHealthy || !haveSample || millis()-lastSample>SENSOR_MAX_AGE_MS || stableSamples<5) {
      reply(id, false, "Need a current healthy reading and five stable samples"); return;
    }
    const float reference=doc["reference"].as<float>();
    const float low[3]={0,0,-10}, high[3]={5000,14,85};
    if (!isfinite(reference) || reference<low[k] || reference>high[k]) { reply(id,false,"Reference outside sensor calibration range"); return; }
    float mn=stableRaw[k][0], mx=mn;
    for(int i=1;i<5;++i) { mn=fminf(mn,stableRaw[k][i]); mx=fmaxf(mx,stableRaw[k][i]); }
    const float tolerance[3]={24,16,0.25f};
    if(mx-mn>tolerance[k]) { reply(id,false,"Reference is not stable; wait and recapture"); return; }
    const float raw = k==0 ? rawTds : k==1 ? rawPh : rawTemp;
    CalibrationStore next=calibration;
    if(k<2) {
      if(!firstPoint[k] || millis()-firstPointAt[k]>900000U) {
        firstRaw[k]=raw; firstReference[k]=reference; firstPoint[k]=true; firstPointAt[k]=millis();
        calibration.ready[k]=false; valid=false;
        reply(id,true,"Point 1 captured; move probe to a different reference, wait five samples, capture point 2"); return;
      }
      const float minRefDelta=k==0?50.0f:1.0f;
      if(fabsf(raw-firstRaw[k])<50 || fabsf(reference-firstReference[k])<minRefDelta) {
        reply(id,false,"References too close: need 50 ADC counts and 50 ppm / 1 pH separation"); return;
      }
      next.gain[k]=(reference-firstReference[k])/(raw-firstRaw[k]);
      next.offset[k]=reference-next.gain[k]*raw;
      if(!isfinite(next.gain[k]) || !isfinite(next.offset[k]) || (k==0&&next.gain[k]<=0)) {
        reply(id,false,"Invalid calibration slope"); return;
      }
    } else next.offset[k]=reference-raw;
    next.ready[k]=true; next.at[k]=doc["epoch"].as<uint32_t>();
    if(!preferencesOK || preferences.putBytes("calibration", &next, sizeof(next))!=sizeof(next)) {
      reply(id,false,"Calibration not saved: NVS unavailable"); return;
    }
    calibration=next; if(k<2)firstPoint[k]=false;
    valid=false; stableSamples=0; confirmedFresh=false;
    reply(id,true,"Calibration saved on ESP32; new readings and recovery required"); return;
  }
  if (strcmp(type,"command") || !doc["seq"].is<uint32_t>() || !doc["ttl_ms"].is<uint32_t>() ||
      !doc["main"].is<const char *>() || !doc["drain"].is<const char *>()) { invalidateCommand(); return; }
  const uint32_t seq=doc["seq"], ttl=doc["ttl_ms"];
  const char *main=doc["main"], *drain=doc["drain"];
  const bool wantMain=!strcmp(main,"OPEN"), wantDrain=!strcmp(drain,"OPEN");
  const bool closedMain=!strcmp(main,"CLOSED"), closedDrain=!strcmp(drain,"CLOSED");
  const bool handshake=!haveCommand && closedMain && closedDrain;
  const char *reason="";
  if(localDemo) reason="LOCAL_LED_TEST";
  else if(!seq || !ttl || ttl>MAX_TTL_MS || (!wantMain&&!closedMain) || (!wantDrain&&!closedDrain) ||
          (wantMain&&wantDrain) || (!haveCommand&&!handshake) || (!handshake&&seq<=lastCommandSeq)) reason="INVALID_COMMAND";
  GatePolicy candidate=gate;
  if(!*reason) {
    if(!doc["config_version"].is<uint32_t>() || !doc["has_drain"].is<bool>()) reason="MISSING_CONFIG";
    else {
      candidate.hasDrain=doc["has_drain"]; candidate.version=doc["config_version"];
      for(int i=0;i<3;++i) for(int j=0;j<2;++j) {
        if(!doc["limits"][sensorNames[i]][j].is<float>()) reason="INVALID_LIMITS";
        else candidate.limits[i][j]=doc["limits"][sensorNames[i]][j];
      }
      if(!candidate.valid(DRAIN_COMMISSIONED)) reason="LIMITS_OR_DRAIN_NOT_COMMISSIONED";
    }
  }
  if(*reason) invalidateCommand();
  else {
    gate=candidate; lastCommandSeq=seq; lastCommand=millis(); commandTtl=ttl; haveCommand=true;
    if(wantMain&&!sensorPermits()) reason="SENSOR_CALIBRATION_FRESHNESS_OR_LIMIT_VETO";
    outputs(wantMain&&sensorPermits(),wantDrain&&gate.hasDrain);
  }
  JsonDocument ack; ack["type"]="ack"; ack["seq"]=seq;
  ack["main"]=mainOpen?"OPEN":"CLOSED"; ack["drain"]=drainOpen?"OPEN":"CLOSED";
  ack["ok"]=!*reason; ack["reason"]=reason; ack["config_version"]=gate.version;
  ack["actuator_kind"]=actuatorKind(); emit(ack);
}

void serialTick() {
  for (int i = 0; i < 128 && Serial.available(); ++i) {
    const char c = char(Serial.read());
    if (c == '\n') {
      if (!discardLine && serialLength) {
        serialLine[serialLength] = '\0'; processCommand(serialLine);
      }
      serialLength = 0; discardLine = false;
    } else if (c != '\r' && !discardLine) {
      if (c == '\0' || serialLength >= sizeof(serialLine) - 1) {
        discardLine = true; serialLength = 0;
        if (!localDemo) invalidateCommand();
      } else serialLine[serialLength++] = c;
    }
  }
}

int median() {
  for (int i = 1; i < SAMPLE_COUNT; ++i) {
    int v = adcBuffer[i], j = i - 1;
    while (j >= 0 && adcBuffer[j] > v) { adcBuffer[j+1] = adcBuffer[j]; --j; }
    adcBuffer[j+1] = v;
  }
  return (adcBuffer[SAMPLE_COUNT/2 - 1] + adcBuffer[SAMPLE_COUNT/2]) / 2;
}

void publishSample() {
  JsonDocument packet;
  packet["type"] = "sample"; packet["seq"] = ++sampleSeq;
  packet["tds"] = tds; packet["ph"] = ph; packet["temp"] = tempC;
  packet["valid"] = valid && !localDemo;
  packet["sensor_valid"] = sensorHealthy;
  packet["protocol"] = 2;
  packet["fresh"] = freshNow(); packet["estimated"] = false;
  packet["t_ms"] = lastSample;
  packet["raw_tds"] = rawTds; packet["raw_ph"] = rawPh;
  packet["calibrated"] = calibrated();
  for(int i=0;i<3;++i) { packet["calibration_at"][sensorNames[i]]=calibration.at[i]; packet["calibration_ready"][sensorNames[i]]=calibration.ready[i]; }
  packet["log_ok"] = logOK; packet["nvs_ok"] = preferencesOK;
  packet["config_version"] = gate.version;
  packet["freshness_basis"] = physicalFresh() ? "flow_switch" : (freshNow() ? "operator_led_test" : "unverified");
  packet["main"] = mainOpen ? "OPEN" : "CLOSED";
  packet["drain"] = drainOpen ? "OPEN" : "CLOSED";
  packet["control_mode"] = localDemo ? "LOCAL_LED_TEST" : "DASHBOARD";
  packet["local_override"] = localDemo;
  packet["actuator_kind"] = actuatorKind();
  packet["physical_flow_verified"] = physicalFresh();
  serializeJson(packet, Serial); Serial.println();
}

void acquisitionTick() {
  const uint32_t now = millis();
  if (acquisitionPhase == 0) {
    if (!firstCycle && uint32_t(now - cycleAt) < SAMPLE_MS) return;
    firstCycle = false; cycleAt = now;
    sensors.requestTemperatures(); 
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
  rawTemp = sensors.getTempCByIndex(0);
  tempC = rawTemp + calibration.offset[2];
  const float compensation = 1.0f + TDS_TEMP_COEFFICIENT * (tempC - 25.0f);
  tds = compensation > 0 ? (rawTds * calibration.gain[0] + calibration.offset[0]) / compensation : NAN;
  ph = rawPh * calibration.gain[1] + calibration.offset[1];
  sensorHealthy = rawTds > 0 && rawTds < 4095 &&
    rawPh > 0 && rawPh < 4095 && isfinite(tds) && isfinite(ph) &&
    isfinite(tempC) && rawTemp != DEVICE_DISCONNECTED_C && rawTemp != 85.0f &&
    rawTemp >= -55 && rawTemp <= 125;
  valid = sensorHealthy && calibrated() && ph>=0 && ph<=14 && tds>=0;
  if(sensorHealthy) {
    stableRaw[0][stableIndex]=rawTds; stableRaw[1][stableIndex]=rawPh; stableRaw[2][stableIndex]=rawTemp;
    stableIndex=(stableIndex+1)%5; if(stableSamples<5)++stableSamples;
  } else stableSamples=0;
  
  if (!isfinite(tds)) tds = 0;
  if (!isfinite(ph)) ph = 0;
  if (!isfinite(tempC)) tempC = 0;
  lastSample = millis(); haveSample = true; acquisitionPhase = 0;
  safetyTick(); publishSample();
}

void handleKey(char key) {
  if (key == '0' && LED_EMULATOR) {
    localDemo = !localDemo;
    outputs(false, false);      // Entering or leaving local control starts closed.
    haveCommand = false; confirmedFresh = false;
    lastCommandSeq = 0;
    keyNotice = false;
    if (serialLength) { serialLength = 0; discardLine = true; }
    return;
  }
  if (key == '*') { rawPage = !rawPage; keyNotice = false; }
  if (key == 'A' || key == 'B' || key == 'C' || key == 'D') {
    if (!localDemo) { keyNotice = true; keyNoticeAt = millis(); return; }
    keyNotice = false;
    if (key == 'A') outputs(false, true);     // Drain ON, main OFF
    if (key == 'B') outputs(mainOpen, false); // Drain OFF
    if (key == 'C') outputs(true, false);     // Main ON, drain OFF
    if (key == 'D') outputs(false, drainOpen);// Main OFF
  }
  if (key == '#' && ALLOW_OPERATOR_FRESHNESS && !localDemo && haveCommand) {
    confirmedFresh = true; freshConfirmedAt = millis();
  }
}

void keypadTick() {
  const char key = keypad.getKey();
  if (key == NO_KEY) return;
  keyEcho = key; keyEchoAt = millis();
  handleKey(key);
}

// --- REWRITTEN CLEAN OLED UI ---
void displayTick() {
  if (!oledOK || uint32_t(millis() - lastDisplay) < 500) return;
  lastDisplay = millis(); 
  display.clearDisplay(); 
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  // 1. HEADER (y=0)
  display.setCursor(0, 0);
  display.print(localDemo ? "--- LOCAL DEMO ---" : "--- DASHBOARD ---");
  display.drawLine(0, 9, 128, 9, SH110X_WHITE); // Visual Separator Line

  if (rawPage) {
    // 2. RAW SENSORS (y=14 to 24)
    display.setCursor(0, 14); display.print("ADC TDS: "); display.print(rawTds);
    display.setCursor(0, 24); display.print("ADC pH : "); display.print(rawPh);

    // 3. VALVE STATUS (y=36)
    display.setCursor(0, 36);
    display.print("Main:"); display.print(mainOpen ? "OPN" : "CLS");
    display.setCursor(64, 36);
    display.print("Drn:"); display.print(drainOpen ? "OPN" : "CLS");

    // 4. SYS STATUS (y=46)
    display.setCursor(0, 46);
    display.print(calibrated() ? "Status: Calibrated" : "Status: UNCALIBRATED");
    
    // 5. FOOTER (y=56)
    display.drawLine(0, 55, 128, 55, SH110X_WHITE); // Visual Separator Line
    display.setCursor(0, 57);
    if (keyNotice) display.print("PRESS 0 = LOCAL MODE");
    else display.print(localDemo ? "*RAW 0:MODE A-D:VLV" : "*RAW  0:MODE");
    
  } else {
    // 2. MAIN SENSORS (y=14 to 24)
    display.setCursor(0, 14);
    display.print("TDS: "); display.print(tds, 1); display.print(" ppm");

    display.setCursor(0, 24);
    display.print("pH : "); display.print(ph, 2);
    display.setCursor(64, 24); // Push Temp to the right side
    display.print("T: ");
    if (tempC == DEVICE_DISCONNECTED_C || tempC == 85.0f || !haveSample) {
      display.print("ERR");
    } else {
      display.print(tempC, 1); display.print("c");
    }

    // 3. VALVE STATUS (y=36)
    display.setCursor(0, 36);
    display.print("Main:"); display.print(mainOpen ? "OPN" : "CLS");
    display.setCursor(64, 36); // Push Drain to the right side
    display.print("Drn:"); display.print(drainOpen ? "OPN" : "CLS");

    // 4. SYS STATUS (y=46)
    display.setCursor(0, 46);
    if (localDemo) {
      display.print(valid ? "Sensors Calibrated" : "Unqualified Data");
    } else {
      display.print(!haveCommand ? "USB: WAIT / TIMEOUT" :
                    (!valid ? "INVALID/CALIBRATE" : (!freshNow() ? "FRESH UNVERIFIED" : (physicalFresh() ? "FLOW CONFIRMED" : "LED TEST FRESH"))));
    }

    // 5. FOOTER MENU (y=57)
    display.drawLine(0, 55, 128, 55, SH110X_WHITE); // Visual Separator Line
    display.setCursor(0, 57);
    if (keyNotice) {
      display.print("PRESS 0 = LOCAL MODE");
    } else {
      display.print(localDemo ? "*RAW 0:MODE A-D:VLV" : (LED_EMULATOR ? "*RAW 0:MODE #:FRESH" : "*RAW"));
    }
    // Key echo proves the matrix is wired correctly, independent of any policy.
    if (keyEcho && uint32_t(millis()-keyEchoAt) < 1500) {
      display.setCursor(116, 57); display.print(keyEcho);
    }
  }
  display.display();
}

void logTick() {
  if (!logOK || !haveSample || uint32_t(millis() - lastLog) < 10000) return;
  lastLog = millis();
  File file = LittleFS.open(dataPath, FILE_APPEND);
  if (!file) { logOK = false; return; }
  if (file.size() + 256 > LOG_MAX_BYTES) { file.close(); logOK = false; return; }
  if (!file.size() && !file.println("t_ms,tds_ppm,ph,temp_c,sensor_valid,fresh,main_led,drain_led,mode")) {
    file.close(); logOK = false; return;
  }
  const size_t written = file.printf("%lu,%.2f,%.2f,%.2f,%d,%d,%d,%d,%s\n",
    (unsigned long)lastSample, tds, ph, tempC, valid, freshNow(), mainOpen, drainOpen,
    localDemo ? "LOCAL_LED_TEST" : "DASHBOARD");
  file.close(); if (!written) logOK = false;
}

void setup() {
  digitalWrite(MAIN_VALVE_PIN, ACTIVE_HIGH ? LOW : HIGH);
  digitalWrite(DRAIN_VALVE_PIN, ACTIVE_HIGH ? LOW : HIGH);
  pinMode(MAIN_VALVE_PIN, OUTPUT); 
  pinMode(DRAIN_VALVE_PIN, OUTPUT); 
  outputs(false,false); 
  
  Serial.begin(115200);
  if(FLOW_SWITCH_PIN>=0) pinMode(FLOW_SWITCH_PIN, INPUT_PULLUP);
  preferencesOK=preferences.begin("okeanos",false);
  if(preferencesOK && preferences.getBytesLength("calibration")==sizeof(calibration)) {
    CalibrationStore saved;
    preferences.getBytes("calibration",&saved,sizeof(saved));
    bool ok=saved.schema==2;
    for(int i=0;i<3;++i) ok=ok&&isfinite(saved.gain[i])&&isfinite(saved.offset[i])&&saved.gain[i]!=0;
    if(ok) calibration=saved;
  }
  pinMode(TDS_PIN, INPUT); pinMode(PH_PIN, INPUT);
  pinMode(TDS_POWER_PIN, OUTPUT); pinMode(PH_POWER_PIN, OUTPUT);
  digitalWrite(TDS_POWER_PIN, LOW); digitalWrite(PH_POWER_PIN, LOW);
  analogReadResolution(12);
  analogSetPinAttenuation(TDS_PIN, ADC_11db); analogSetPinAttenuation(PH_PIN, ADC_11db);
  sensors.begin(); sensors.setResolution(12); sensors.setWaitForConversion(false);
  Wire.begin(); 
  oledOK = display.begin(I2C_ADDRESS, true);
  if (oledOK) { display.clearDisplay(); display.setTextSize(1); display.setTextColor(SH110X_WHITE); }
  logOK = LittleFS.begin(false);
}

void loop() {
  safetyTick(); serialTick(); keypadTick(); safetyTick();
  acquisitionTick(); safetyTick(); displayTick(); safetyTick(); logTick(); safetyTick();
}