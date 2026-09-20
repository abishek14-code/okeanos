#include <cassert>
#include <iostream>
#include "../../firmware/okeanos_gate/okeanos_gate.ino"
void call(const char*json){Serial.output.clear();processCommand(json);}
void command(uint32_t seq,const char*main,const char*drain,float tdsLimit=800,bool hasDrain=true){
 char line[700];snprintf(line,sizeof(line),"{\"type\":\"command\",\"seq\":%u,\"main\":\"%s\",\"drain\":\"%s\",\"ttl_ms\":2500,\"config_version\":1,\"has_drain\":%s,\"limits\":{\"tds\":[0,%f],\"ph\":[6.5,8.5],\"temp\":[10,45]}}",seq,main,drain,hasDrain?"true":"false",tdsLimit);call(line);
}
void healthy(){haveSample=true;sensorHealthy=true;valid=true;lastSample=millis();tds=360;ph=7.35;tempC=26;calibration.ready[0]=calibration.ready[1]=true;}
void stable(int raw){rawPh=raw;stableSamples=5;for(int i=0;i<5;++i)stableRaw[1][i]=raw;lastSample=millis();sensorHealthy=true;haveSample=true;}
int main(){
 setup();assert(!mainOpen&&!drainOpen&&!localDemo);
 call("{\"type\":\"hello\",\"id\":1}");assert(Serial.output.find("\"protocol\":2")!=std::string::npos);
 healthy();command(1,"OPEN","CLOSED");assert(!mainOpen); // Closed-only handshake required.
 command(2,"CLOSED","CLOSED");command(3,"OPEN","CLOSED");assert(!mainOpen); // No freshness.
 handleKey('#');command(4,"OPEN","CLOSED");assert(mainOpen&&!drainOpen);
 command(5,"OPEN","OPEN");assert(!mainOpen&&!drainOpen&&!haveCommand);
 command(6,"CLOSED","CLOSED");handleKey('#');command(7,"OPEN","CLOSED",300);assert(!mainOpen); // Remote tighter limit honored locally.
 command(8,"CLOSED","OPEN");assert(drainOpen&&!mainOpen);
 testMillis+=2501;safetyTick();assert(!mainOpen&&!drainOpen&&!haveCommand);
 command(9,"CLOSED","CLOSED");healthy();handleKey('#');command(10,"OPEN","CLOSED");assert(mainOpen);
 testMillis+=1501;safetyTick();assert(!mainOpen); // Local sensor age independent of host TTL.
 healthy();command(11,"CLOSED","CLOSED");handleKey('#');command(12,"OPEN","CLOSED");assert(mainOpen);
 command(12,"OPEN","CLOSED");assert(!mainOpen&&!haveCommand); // Duplicate sequence closes.
 command(13,"CLOSED","CLOSED",900);assert(!haveCommand); // Cannot raise compiled ceiling.
 command(14,"CLOSED","CLOSED");sampleSeq=10;stable(2000);
 call("{\"type\":\"calibrate\",\"id\":2,\"sensor\":\"ph\",\"reference\":7,\"sample_seq\":10,\"epoch\":1800000000}");
 assert(firstPoint[1]&&!calibration.ready[1]&&!valid);assert(Serial.output.find("Point 1")!=std::string::npos);
 stable(2500);call("{\"type\":\"calibrate\",\"id\":3,\"sensor\":\"ph\",\"reference\":4,\"sample_seq\":10,\"epoch\":1800000001}");
 assert(calibration.ready[1]&&!firstPoint[1]);assert(fabs(calibration.gain[1]*2500+calibration.offset[1]-4)<0.001);assert(preferences.getBytesLength("calibration")==sizeof(calibration));
 stable(2500);call("{\"type\":\"calibrate\",\"id\":4,\"sensor\":\"ph\",\"reference\":7,\"sample_seq\":9,\"epoch\":1800000001}");assert(Serial.output.find("\"ok\":false")!=std::string::npos);
 handleKey('0');assert(localDemo);handleKey('C');assert(mainOpen);call("{\"type\":\"hello\",\"id\":5}");assert(!localDemo&&!mainOpen&&!drainOpen);
 command(1,"CLOSED","CLOSED");command(2,"CLOSED","OPEN",800,false);assert(!drainOpen);

 // Local keypad override must survive the host's 1 Hz command stream.
 call("{\"type\":\"hello\",\"id\":9}");assert(!localDemo);
 handleKey('A');assert(!drainOpen&&keyNotice); // A-D inert until local mode, with a standing hint.
 handleKey('0');assert(localDemo&&!keyNotice);
 handleKey('C');assert(mainOpen&&!drainOpen);
 command(50,"CLOSED","CLOSED");assert(mainOpen&&!haveCommand); // Host command is refused, not obeyed.
 command(51,"OPEN","CLOSED");assert(mainOpen&&!haveCommand);
 testMillis+=5000;safetyTick();assert(mainOpen); // No TTL sweep while the operator holds control.
 call("{\"type\":\"calibrate\",\"id\":10,\"sensor\":\"ph\",\"reference\":7,\"sample_seq\":1,\"epoch\":1800000000}");
 assert(mainOpen); // A calibrate attempt is rejected without stealing the outputs.
 handleKey('D');assert(!mainOpen);
 handleKey('A');assert(drainOpen&&!mainOpen);
 handleKey('0');assert(!localDemo&&!drainOpen&&!mainOpen); // Leaving local mode closes everything.
 command(52,"OPEN","CLOSED");assert(!mainOpen&&!haveCommand); // Closed-only handshake required again.
 command(53,"CLOSED","CLOSED");assert(haveCommand);
 std::cout<<"Firmware native integration passed: handshake, freshness, mutual exclusion, ceilings, drain, TTL, sensor age, sequence, two-point calibration, persistence and mode takeover, and local keypad override isolation.\n";
}
