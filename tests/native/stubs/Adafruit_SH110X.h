#pragma once
#include "Wire.h"
constexpr int SH110X_WHITE=1;
struct Adafruit_SH1106G{Adafruit_SH1106G(int,int,TestWire*,int){} bool begin(int,bool){return true;}void clearDisplay(){} void setTextSize(int){} void setTextColor(int){} void setCursor(int,int){} void drawLine(int,int,int,int,int){}void display(){} template<class...T>void print(T...){} };
