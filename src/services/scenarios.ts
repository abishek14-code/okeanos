import type { Sample } from './controller.ts';
export const SCENARIOS = [
 {id:'creeping_drift',name:'Gradual TDS deterioration',description:'Slow increase; compare qualified learning with an unguarded rolling baseline.',duration:120},
 {id:'source_step',name:'Known then unknown source',description:'Municipal → borewell → unfamiliar profile. Source selection never relaxes hard limits.',duration:100},
 {id:'sensor_detachment',name:'Disconnected sensor',description:'Invalid acquisition flag after 40 seconds.',duration:90},
 {id:'sensor_frozen',name:'Frozen sensor',description:'Identical TDS values persist while other sensors continue varying.',duration:100},
 {id:'noise_overlap',name:'Uncertain near-limit readings',description:'780 ppm with changing noise; intervals may cross the 800 ppm configured ceiling.',duration:100},
 {id:'chatter_test',name:'Threshold chatter',description:'Alternate 785 and 815 ppm. Permission requires a complete recovery window.',duration:100},
 {id:'recovery_relapse',name:'Recovery then recurrence',description:'Good water, excursion, sustained recovery, then another excursion.',duration:160},
 {id:'blocked_restart',name:'Restart while blocked',description:'Controller restarts during an excursion; startup always commands closure.',duration:120},
 {id:'ph_breach',name:'pH limit breach',description:'pH falls below its configured lower bound.',duration:90},
 {id:'temp_breach',name:'Temperature limit breach',description:'Temperature exceeds its configured upper bound.',duration:90},
];
export function syntheticSample(step:number,scenario:string|null=null,intensity=100):Sample {
 const s:Sample={seq:step,tds:360+2*Math.sin(step*0.7),ph:7.35+0.005*Math.sin(step*0.4),temp:26+0.02*Math.cos(step*0.3),valid:true,fresh:true};
 const t=step-40,scale=intensity/100;
 if(t<0)return s;
 switch(scenario){
  case 'creeping_drift':s.tds+=t*3*scale;break;
  case 'source_step':s.tds=t<25?820:570;s.ph=t<25?8.1:7;break;
  case 'sensor_detachment':s.valid=false;s.tds=0;break;
  case 'sensor_frozen':s.tds=365;break;
  case 'noise_overlap':s.tds=780+Math.sin(t)*2;s.noise={tds:(t<20?2:40)*scale};break;
  case 'chatter_test':s.tds=t%2===0?815:785;break;
  case 'recovery_relapse':if(t<12||t>95)s.tds=900;break;
  case 'blocked_restart':if(t<35)s.tds=900;break;
  case 'ph_breach':s.ph=5;break;
  case 'temp_breach':s.temp=49;break;
 }
 return s;
}
// Explicit baseline comparator: nominal hard-limit gating + unqualified 60-sample rolling TDS mean.
export class LegacyController {
 open=false;cycles=0;exposure=0;baseline=360;private values:number[]=[];private previous:Sample|null=null;
 step(s:Sample,stress:(t:number,p:number,c:number)=>number){
  if(this.open&&this.previous)this.exposure+=stress(this.previous.tds,this.previous.ph,this.previous.temp);
  const next=s.valid&&s.tds>=0&&s.tds<=800&&s.ph>=6.5&&s.ph<=8.5&&s.temp>=10&&s.temp<=45;
  if(next!==this.open)this.cycles++;this.open=next;
  if(s.valid){this.values=[...this.values,s.tds].slice(-60);this.baseline=this.values.reduce((a,b)=>a+b,0)/this.values.length;}
  this.previous=s;
 }
}
