#pragma once
#include "FS.h"
struct TestFS{bool begin(bool){return true;}File open(const char*,int){return {};}};
inline TestFS LittleFS;
