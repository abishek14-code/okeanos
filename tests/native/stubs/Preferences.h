#pragma once
#include "Arduino.h"
struct Preferences {
 std::map<std::string,std::vector<uint8_t>> memory;
 bool begin(const char*,bool){return true;}
 size_t putBytes(const char*k,const void*p,size_t n){memory[k]=std::vector<uint8_t>((const uint8_t*)p,(const uint8_t*)p+n);return n;}
 size_t getBytesLength(const char*k){return memory[k].size();}
 size_t getBytes(const char*k,void*p,size_t n){auto&v=memory[k];n=std::min(n,v.size());memcpy(p,v.data(),n);return n;}
};
