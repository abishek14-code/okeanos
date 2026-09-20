#pragma once
#include <cstdint>
#include <cstddef>
#include <cstring>
#include <cstdio>
#include <string>
#include <vector>
#include <map>
#include <cmath>
#include <algorithm>
using byte=uint8_t;
constexpr int LOW=0,HIGH=1,OUTPUT=1,INPUT=0,INPUT_PULLUP=2,ADC_11db=3;
inline uint32_t testMillis=0;
inline int pins[64]={},adcTds=2400,adcPh=3675;
inline float temperature=26;
inline uint32_t millis(){return testMillis;}
inline void digitalWrite(int p,int v){pins[p]=v;}
inline int digitalRead(int p){return pins[p];}
inline void pinMode(int,int){}
inline int analogRead(int p){return p==32?adcTds:adcPh;}
inline void analogReadResolution(int){}
inline void analogSetPinAttenuation(int,int){}
struct TestSerial {
 std::string output;
 void begin(int){} int available(){return 0;} int read(){return 0;}
 size_t write(uint8_t c){output+=char(c);return 1;}
 size_t write(const uint8_t* s,size_t n){output.append((const char*)s,n);return n;}
 void println(){output+='\n';}
};
inline TestSerial Serial;
struct TestESP{uint64_t getEfuseMac(){return 123456;}};
inline TestESP ESP;
