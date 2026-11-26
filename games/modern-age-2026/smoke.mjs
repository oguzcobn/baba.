import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const server=createServer(async(req,res)=>{
 try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root))throw Error('invalid path');const data=await readFile(p);res.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'application/octet-stream'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const errors=[],warnings=[],report={scenarios:[],viewport:[1280,800]};
try {
 browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text().slice(0,1000))});
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.click('#new');
 await page.waitForFunction(()=>__MA.renderer?.engine==='Three.js r170',{},{timeout:20000}).catch(()=>{});
 report.engine=await page.evaluate(()=>__MA.renderer?.engine||'Canvas fallback');
 report.gpu=await page.evaluate(()=>__MA.renderer?.gpu||null);
 report.software=await page.evaluate(()=>__MA.renderer?.software??null);
 report.webgl2=await page.evaluate(()=>!!__MA.renderer?.active&&__MA.renderer?.engine==='Three.js r170');
 assert.equal(await page.evaluate(()=>__MA.world.units.filter(u=>!u.enemy).length),6);
 async function build(kind,x,y){
  await page.keyboard.press('Escape');await page.keyboard.press('b');await page.click('[data-build='+kind+']');
  const pos=await page.evaluate(([x,y])=>__MA.project(x,y),[x,y]);
  await page.locator('#map').click({position:pos});
  await page.evaluate(()=>{for(let i=0;i<900;i++)__MA.step(.05)});
  assert.equal(await page.evaluate(kind=>__MA.world.buildings.find(b=>!b.enemy&&b.type===kind)?.progress,kind),1);
 }
 await build('hq',24,27);
 await page.evaluate(()=>Object.assign(__MA.world.stock,{money:5000,mat:5000,food:5000,oil:5000}));
 await build('landmark',23,34);
 assert.equal(await page.evaluate(()=>__MA.world.prestige),100);
 if(report.webgl2){
  await page.waitForFunction(()=>__MA.renderer.drawCount>5);
  assert.ok(await page.evaluate(()=>__MA.metrics.draws>0&&__MA.metrics.triangles>0));
 }
 async function sample(label,ms=6000){
   const result=await page.evaluate(async ms=>{
     const begin=performance.now(),frames=[];let prev=begin;
     await new Promise(resolve=>{function tick(now){if(now>prev)frames.push(now-prev);prev=now;if(now-begin>=ms)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)});
     const elapsed=performance.now()-begin;frames.sort((a,b)=>a-b);const q=p=>frames[Math.min(frames.length-1,Math.floor((frames.length-1)*p))]??null;
     return {frames:frames.length,elapsedMs:elapsed,meanFPS:frames.length*1000/elapsed,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),over16_7:frames.filter(x=>x>16.7).length,units:__MA.world.units.length,drawCalls:__MA.metrics.draws,triangles:__MA.metrics.triangles,resolution:__MA.renderer?.resolution??null,scale:__MA.metrics.scale};
   },ms);report.scenarios.push({label,...result});
 }
 await page.waitForTimeout(1800);await sample('normal game');
 await page.screenshot({path:'modern-age-preview.png'});
 for(const count of [100,500,1500]){
   await page.evaluate(count=>{
     const w=__MA.world;w.mode='sandbox';w.units=Array.from({length:count},(_,i)=>{
       let x=5+(i%50)*.60,y=5+Math.floor(i/50)*.60;
       return {id:100000+i,x,y,tx:x+.15,ty:y,role:'idle',kindUnit:'worker',path:[{x:x+.15,y}],walk:0,angle:0,hp:55,carry:0};
     });
   },count);await page.waitForTimeout(1000);await sample(count+' unit render + simulation');
 }
 assert.deepEqual(errors,[]);
 assert.equal(report.webgl2,true,'Actual Three.js renderer unavailable; fallback is not a pass');
 report.targetVerified=!report.software&&report.scenarios.every(s=>s.meanFPS>=59&&s.p95Ms<=17.5);
 if(process.env.REQUIRE_60FPS==='1')assert.equal(report.targetVerified,true,'Hardware performance target not verified');
} catch(e){report.failure=String(e);process.exitCode=1}
finally{
 report.errors=errors;report.warnings=warnings;
 await writeFile('modern-age-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(browser)await browser.close();await new Promise(r=>server.close(r));
}
