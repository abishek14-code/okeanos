#pragma once
#define makeKeymap(x) ((char*)x)
#define NO_KEY '\0'
struct Keypad{Keypad(char*,byte*,byte*,byte,byte){}char getKey(){return NO_KEY;}};
