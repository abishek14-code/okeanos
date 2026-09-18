// ESP32 Arduino reference transport + local actuator interlocks.
// Requires ArduinoJson 7. Commission sensor_adapter.h and the driver pin/polarity first.
#include <Arduino.h>
#include <ArduinoJson.h>
#include "sensor_adapter.h"

constexpr int MAIN_DRIVER_PIN = 26; // Example GPIOs for classic ESP32; verify your board.
constexpr int DRAIN_DRIVER_PIN = 27;
constexpr bool DRIVER_ACTIVE_HIGH = true;
constexpr bool DRAIN_COMMISSIONED = false;
constexpr uint32_t MAX_TTL_MS = 2500;
// Illustrative commissioning limits, not drinking-water limits. Match actual membrane data.
constexpr float TDS_MAX=800.0f, PH_MIN=6.5f, PH_MAX=8.5f, TEMP_MIN=10.0f, TEMP_MAX=45.0f;
uint32_t sampleSeq=0,lastSample=0,lastCommand=0,ttl=0;
uint32_t lastCommandSeq=0;
bool haveCommand=false,mainOpen=false,drainOpen=false;
Acquisition measured={0,0,0,false,false};
String buffer;

void outputs(bool main,bool drain) {
  // Break-before-make software command order; actual valve travel time must be commissioned.
  if(main && drain)main=false;
  digitalWrite(MAIN_DRIVER_PIN,DRIVER_ACTIVE_HIGH?LOW:HIGH);
  digitalWrite(DRAIN_DRIVER_PIN,DRIVER_ACTIVE_HIGH?LOW:HIGH);
  mainOpen=main;drainOpen=drain&&DRAIN_COMMISSIONED;
  if(drainOpen)digitalWrite(DRAIN_DRIVER_PIN,DRIVER_ACTIVE_HIGH?HIGH:LOW);
  if(mainOpen)digitalWrite(MAIN_DRIVER_PIN,DRIVER_ACTIVE_HIGH?HIGH:LOW);
}
bool sensorPermits() {
 return measured.valid&&measured.fresh&&isfinite(measured.tds)&&isfinite(measured.ph)&&isfinite(measured.temp)
  &&measured.tds>=0&&measured.tds<=TDS_MAX&&measured.ph>=PH_MIN&&measured.ph<=PH_MAX
  &&measured.temp>=TEMP_MIN&&measured.temp<=TEMP_MAX&&uint32_t(millis()-lastSample)<=1500;
}
void processCommand(const String &line) {
 JsonDocument doc;
 if(deserializeJson(doc,line) || doc["type"]!="command" || !doc["seq"].is<uint32_t>() || !doc["ttl_ms"].is<uint32_t>()) {outputs(false,false);haveCommand=false;return;}
 const uint32_t seq=doc["seq"].as<uint32_t>(),requestedTtl=doc["ttl_ms"].as<uint32_t>();
 const String main=doc["main"] | "",drain=doc["drain"] | "";
 // A closed handshake starts a new host session after the prior command expires.
 const bool sessionReset=!haveCommand&&main=="CLOSED"&&drain=="CLOSED";
 if((!sessionReset&&seq<=lastCommandSeq)||!requestedTtl||requestedTtl>MAX_TTL_MS||(main!="OPEN"&&main!="CLOSED")||(drain!="OPEN"&&drain!="CLOSED")||(main=="OPEN"&&drain=="OPEN")) {
  outputs(false,false);haveCommand=false;return;
 }
 lastCommandSeq=seq;lastCommand=millis();ttl=requestedTtl;haveCommand=true;
 outputs(main=="OPEN"&&sensorPermits(),drain=="OPEN");
 JsonDocument ack;ack["type"]="ack";ack["seq"]=seq;ack["main"]=mainOpen?"OPEN":"CLOSED";ack["drain"]=drainOpen?"OPEN":"CLOSED";
 // This acknowledges GPIO command state. There is no mechanical position feedback here.
 serializeJson(ack,Serial);Serial.println();
}
void setup() {
 // External driver gate pull-downs / appropriate inactive pulls keep coils off during boot.
 digitalWrite(MAIN_DRIVER_PIN,DRIVER_ACTIVE_HIGH?LOW:HIGH);
 digitalWrite(DRAIN_DRIVER_PIN,DRIVER_ACTIVE_HIGH?LOW:HIGH);
 pinMode(MAIN_DRIVER_PIN,OUTPUT);pinMode(DRAIN_DRIVER_PIN,OUTPUT);outputs(false,false);
 Serial.begin(115200);buffer.reserve(512);
}
void loop() {
 const uint32_t now=millis();
 if(haveCommand&&uint32_t(now-lastCommand)>ttl){haveCommand=false;outputs(false,false);}
 // Limit serial work per loop so a continuous byte stream cannot starve the watchdog.
 for(int i=0;i<128&&Serial.available();i++) {
  const char c=Serial.read();
  if(c=='\n'){processCommand(buffer);buffer="";}
  else if(c!='\r') {if(buffer.length()<512)buffer+=c;else{buffer="";haveCommand=false;outputs(false,false);}}
 }
 if(uint32_t(now-lastSample)>=1000){
  measured=readSensors();lastSample=now;
  measured.valid=measured.valid&&isfinite(measured.tds)&&isfinite(measured.ph)&&isfinite(measured.temp);
  if(!sensorPermits()&&mainOpen)outputs(false,drainOpen);
  JsonDocument packet;packet["type"]="sample";packet["seq"]=++sampleSeq;
  packet["tds"]=isfinite(measured.tds)?measured.tds:0;packet["ph"]=isfinite(measured.ph)?measured.ph:0;packet["temp"]=isfinite(measured.temp)?measured.temp:0;
  packet["valid"]=measured.valid;packet["fresh"]=measured.fresh;packet["estimated"]=false;
  serializeJson(packet,Serial);Serial.println();
 }
}
