import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'pipe'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:1420')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
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
   writable:new WritableStream({write(bytes){const c=JSON.parse(new TextDecoder().decode(bytes));window.mockCommands.push(c);controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'ack',seq:c.seq,main:c.main,drain:c.drain})+'\n'));}}),
   async open(){timer=setInterval(()=>{seq++;controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'sample',seq,tds:360+Math.sin(seq),ph:7.35+0.005*Math.sin(seq),temp:26+0.01*Math.cos(seq),valid:true,fresh:true})+'\n'));},1000);},
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
 await page.evaluate(()=>window.stopMockSamples());await page.clock.runFor(5000);
 assert.ok((await page.locator('.top-bar').innerText()).includes('CLOSED'));
 assert.ok((await page.locator('body').innerText()).includes('timeout'));
 await page.getByRole('button',{name:'Reset to simulation',exact:true}).first().click();
 await page.clock.runFor(40000);assert.ok((await page.locator('.top-bar').innerText()).includes('COMMAND: OPEN'));
 assert.deepEqual(errors,[]);
 console.log('Browser integration passed: all eight workspaces, startup recovery, manual latch, source action, challenge injection, export/import replay, mocked USB actuation and timeout closure, no runtime exceptions.');
}finally{await browser?.close();server.kill();}
