#pragma once
#include "Arduino.h"
#include "OneWire.h"
constexpr float DEVICE_DISCONNECTED_C=-127;
struct DallasTemperature{DallasTemperature(OneWire*){}void begin(){}void setResolution(int){}void setWaitForConversion(bool){}void requestTemperatures(){}float getTempCByIndex(int){return temperature;}};
