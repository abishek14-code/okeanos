import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'pipe'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:1420')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1512,height:1100}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-09-18T12:00:00Z')});
 await page.goto('http://127.0.0.1:1420');
 await page.getByText('Connected hardware and software workflow',{exact:true}).waitFor();
 await page.clock.runFor(40000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('COMMAND: OPEN'));
 const layout=await page.locator('main').boundingBox();const sidebar=await page.locator('aside').boundingBox();assert.ok(layout.x>=sidebar.width,'main workspace must sit beside the sidebar');
 await page.screenshot({path:'docs/dashboard-verified.png',fullPage:true});
 const svg=await page.locator('svg[aria-label^="Sensor acquisition"]').evaluate(el=>{
  const copy=el.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const style=getComputedStyle(document.documentElement);let s=copy.outerHTML;
  return s.replace(/var\((--[^)]+)\)/g,(_,v)=>style.getPropertyValue(v).trim()||'#a0b0c0');
 });
 writeFileSync('docs/connected-workflow.svg',svg);
 await page.getByRole('button',{name:'Latch closed',exact:true}).click();await page.clock.runFor(5000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('CLOSED: MANUAL_CLOSE'));
 await page.getByRole('button',{name:'Auto / recover',exact:true}).click();await page.clock.runFor(1000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('CLOSED'));
 await page.clock.runFor(35000);assert.ok((await page.locator('.top-bar').innerText()).includes('COMMAND: OPEN'));
 for(const title of ['Quarantine & CUSUM','Uncertainty & Calibration','Source Profiles','Recovery FSM & Purge','Exposure & CMSI','Challenge Replay','Audit Log & Config']){
  await page.getByRole('button',{name:new RegExp(title.replace(/[&]/g,'\\&'))}).first().click();
  assert.ok((await page.locator('h1').innerText()).length>0);
 }
 await page.getByRole('button',{name:/Source Profiles/}).first().click();
 await page.getByRole('button',{name:'Select labelled source'}).nth(2).click();await page.clock.runFor(1000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('UNKNOWN_SOURCE'));
 await page.getByRole('button',{name:'Reset to simulation',exact:true}).first().click();
 await page.getByRole('button',{name:/Challenge Replay/}).first().click();
 await page.getByRole('button',{name:'Run scenario',exact:true}).nth(5).click();await page.clock.runFor(55000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('CLOSED'));
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export decision replay'}).click()]);
 await download.saveAs('docs/example-replay.json');
 await page.getByLabel('Load replay JSON',{exact:true}).setInputFiles('docs/example-replay.json');
 await page.clock.runFor(5000);assert.ok((await page.locator('body').innerText()).includes('REPLAY'));
 // End-to-end hardware transport test with a simulated USB device, never real actuators.
 await page.evaluate(()=>{
  let controller, timer, seq=0;
  window.mockCommands=[];
  const port={
   readable:new ReadableStream({start(c){controller=c;}}),
   writable:new WritableStream({write(bytes){const c=JSON.parse(new TextDecoder().decode(bytes));window.mockCommands.push(c);const response=c.type==='hello'?{type:'response',id:c.id,ok:true,protocol:2,device_id:'ui-test',actuator_kind:'LED_EMULATOR',drain_available:true,flow_input:false}:c.type==='calibrate'?{type:'response',id:c.id,ok:true,message:'Calibration saved on ESP32'}:{type:'ack',seq:c.seq,main:c.main,drain:c.drain,config_version:c.config_version,ok:true};controller.enqueue(new TextEncoder().encode(JSON.stringify(response)+'\n'));}}),
   async open(){timer=setInterval(()=>{seq++;controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'sample',protocol:2,seq,tds:360+Math.sin(seq),ph:7.35+0.005*Math.sin(seq),temp:26,valid:true,fresh:true,sensor_valid:true,calibrated:true,estimated:false,raw_tds:2400+seq%4,raw_ph:3675+seq%3,main:'CLOSED',drain:'CLOSED',control_mode:'DASHBOARD',actuator_kind:'LED_EMULATOR',freshness_basis:'operator_led_test'})+'\n'));},1000);},
   async close(){clearInterval(timer);}
  };
  window.stopMockSamples=()=>clearInterval(timer);
  Object.defineProperty(navigator,'serial',{value:{async requestPort(){return port;}},configurable:true});
 });
 await page.getByRole('button',{name:'Connect USB hardware',exact:true}).click();
 await page.clock.runFor(42000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('COMMAND: OPEN'));
 assert.ok(await page.getByRole('button',{name:'Run scenario',exact:true}).first().isDisabled());
 const commands=await page.evaluate(()=>window.mockCommands);
 assert.ok(commands.some(c=>c.main==='OPEN'));
 assert.ok(commands.every(c=>!(c.main==='OPEN'&&c.drain==='OPEN')));
 // Existing hardware controls must await firmware confirmation without layout changes.
 await page.getByRole('button',{name:/Recovery FSM/}).first().click();
 await page.getByRole('checkbox').check();
 await page.getByText('Drain-path configuration saved; recovery restarted.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Request 15-second purge',exact:true}).click();
 await page.clock.runFor(1000);
 assert.ok((await page.evaluate(()=>window.mockCommands)).some(c=>c.drain==='OPEN'));
 await page.getByRole('button',{name:'Latch closed',exact:true}).click();await page.clock.runFor(2000);
 assert.equal((await page.evaluate(()=>window.mockCommands)).at(-1).drain,'CLOSED');
 await page.getByRole('button',{name:/Uncertainty & Calibration/}).first().click();
 await page.getByRole('button',{name:'Capture reference',exact:true}).click();
 await page.getByText('Calibration saved on ESP32',{exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.mockCommands)).some(c=>c.type==='calibrate'&&c.sensor==='ph'));
 await page.getByRole('button',{name:/Audit Log & Config/}).first().click();
 await page.getByRole('button',{name:'Commit Configuration',exact:true}).click();
 await page.getByText(/Applied. All measurement and recovery interlocks remain active/).waitFor();
 await page.getByRole('button',{name:'Auto / recover',exact:true}).click();await page.clock.runFor(42000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('COMMAND: OPEN'));
 await page.evaluate(()=>window.stopMockSamples());await page.clock.runFor(5000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('CLOSED'));
 assert.ok((await page.locator('body').innerText()).includes('timeout'));
 await page.getByRole('button',{name:'Reset to simulation',exact:true}).first().click();
 await page.clock.runFor(40000);assert.ok((await page.locator('.top-bar').innerText()).includes('COMMAND: OPEN'));
 assert.deepEqual(errors,[]);
 console.log('Browser integration passed: all eight workspaces, startup recovery, manual latch, source action, challenge injection, export/import replay, mocked USB actuation and timeout closure, no runtime exceptions.');
}finally{await browser?.close();server.kill();}
