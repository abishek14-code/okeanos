#pragma once
#include "Arduino.h"
constexpr int FILE_APPEND=1;
struct File { operator bool()const{return true;} size_t size(){return 0;} void close(){} size_t println(const char*){return 1;} template<class...T>size_t printf(const char*,T...){return 1;} };
