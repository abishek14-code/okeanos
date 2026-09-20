#pragma once
#include <stdint.h>
#include <math.h>
struct GatePolicy {
  float limits[3][2] = {{0,800},{6.5f,8.5f},{10,45}};
  bool hasDrain=false;
  uint32_t version=1;
  bool valid(bool drainCommissioned) const {
    const float hard[3][2]={{0,800},{6.5f,8.5f},{10,45}};
    if(!version || (hasDrain&&!drainCommissioned)) return false;
    for(int i=0;i<3;++i)
      if(!isfinite(limits[i][0])||!isfinite(limits[i][1])||limits[i][0]>=limits[i][1]||
         limits[i][0]<hard[i][0]||limits[i][1]>hard[i][1]) return false;
    return true;
  }
  bool permits(float tds,float ph,float temp) const {
    const float v[3]={tds,ph,temp};
    for(int i=0;i<3;++i) if(!isfinite(v[i])||v[i]<limits[i][0]||v[i]>limits[i][1]) return false;
    return true;
  }
};
