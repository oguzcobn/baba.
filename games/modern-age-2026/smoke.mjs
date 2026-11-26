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
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,args:process.env.GPU_HARDWARE==='1'?[]:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'],headless:process.env.HEADED!=='1'});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text().slice(0,1000))});
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.locator('[data-menu-tab=help]').click();
 assert.equal(await page.locator('[data-menu-panel=help]').isVisible(),true);
 await page.locator('[data-menu-tab=settings]').click();
 assert.equal(await page.locator('#menuquality').isVisible(),true);
 await page.locator('[data-menu-tab=setup]').click();
 await page.screenshot({path:'modern-age-menu.png'});
 await page.click('#new');
 await page.waitForFunction(()=>__MA.renderer?.engine==='Three.js r170',{},{timeout:20000}).catch(()=>{});
 report.engine=await page.evaluate(()=>__MA.renderer?.engine||'Canvas fallback');
 report.gpu=await page.evaluate(()=>__MA.renderer?.gpu||null);
 report.software=await page.evaluate(()=>__MA.renderer?.software??null);
 report.webgl2=await page.evaluate(()=>!!__MA.renderer?.active&&__MA.renderer?.engine==='Three.js r170');
 assert.equal(await page.evaluate(()=>__MA.world.units.filter(u=>!u.enemy).length),6);
 async function build(kind,x,y){
  await page.keyboard.press('Escape');await page.keyboard.press('b');await page.click('[data-build='+kind+']');
  const pos=await page.evaluate(({kind,x,y})=>{
   const size=__MA.buildingSize(kind);let startX=Math.floor(x-size/2),startY=Math.floor(y-size/2);
   for(let r=0;r<=10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
    const a=startX+dx,b=startY+dy;if(!__MA.canBuild(kind,a,b))continue;
    const p=__MA.project(a+size/2+.25,b+size/2+.25),cv=document.querySelector('#map');
    if(p.x>40&&p.y>40&&p.x<cv.clientWidth-40&&p.y<cv.clientHeight-40)return p;
   }return null
  },{kind,x,y});
  assert.ok(pos,'No valid visible position for '+kind);
  await page.locator('#map').click({position:pos});
  await page.evaluate(()=>{for(let i=0;i<900;i++)__MA.step(.05)});
  assert.equal(await page.evaluate(kind=>__MA.world.buildings.find(b=>!b.enemy&&b.type===kind)?.progress,kind),1,'Construction failed for '+kind+' at '+JSON.stringify(pos));
 }
 assert.equal(await page.evaluate(()=>__MA.world.buildings.filter(b=>!b.enemy&&b.type==='hq'&&b.progress===1).length),1,'completed starting HQ');
 assert.equal(await page.evaluate(()=>__MA.world.units.filter(u=>!u.enemy).length),6,'six starting workers');
 assert.equal(await page.evaluate(()=>__MA.world.stock.money),500,'no starting HQ charge');
 await page.click('#homebase');
 assert.ok(await page.locator('#info').innerText().then(t=>t.includes('Yönetim merkezi')));
 await page.keyboard.press('Escape');await page.keyboard.press('b');
 await page.locator('[data-category=military]').click();
 assert.equal(await page.locator('[data-build=barracks]').isVisible(),true);
 assert.equal(await page.locator('[data-build=farm]').isVisible(),false);
 await page.locator('[data-category=all]').click();
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
     return {samplesMs:frames,onePercentLowFPS:frames.length?1000/(frames.slice(-Math.ceil(frames.length*.01)).reduce((a,b)=>a+b,0)/Math.ceil(frames.length*.01)):null,frames:frames.length,elapsedMs:elapsed,meanFPS:frames.length*1000/elapsed,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),over16_7:frames.filter(x=>x>16.7).length,units:__MA.world.units.length,drawCalls:__MA.metrics.draws,triangles:__MA.metrics.triangles,resolution:__MA.renderer?.resolution??null,scale:__MA.metrics.scale};
   },ms);report.scenarios.push({label,...result});
 }
 await page.waitForTimeout(1800);await sample('normal game');
 await page.screenshot({path:'modern-age-preview.png'});
 for(const count of [100,500,1500]){
   await page.evaluate(count=>{
     const w=__MA.world;w.mode='sandbox';w.units=Array.from({length:count},(_,i)=>{
       let x=6+(i%50)*.55,y=19+Math.floor(i/50)*.55;
       return {id:100000+i,x,y,tx:x+.35,ty:y,role:'idle',kindUnit:'worker',path:[{x:x+.35,y}],walk:0,angle:0,hp:55,carry:0};
     });
     if(window.__benchTimer)clearInterval(window.__benchTimer);
     let direction=1;
     window.__benchTimer=setInterval(()=>{direction=-direction;for(const u of w.units){u.tx=u.x+direction*.35;u.ty=u.y;u.path=[{x:u.tx,y:u.ty}]}},750);
   },count);await page.waitForTimeout(1000);await sample(count+' unit render + simulation');
 }
 await page.evaluate(()=>clearInterval(window.__benchTimer));
 // A UI-driven playthrough, with accelerated simulation and explicitly seeded combat fixtures.
 report.playtest={};
 await page.click('#menu');await page.selectOption('#mode','skirmish');await page.selectOption('#opponent','GR');await page.selectOption('#difficulty','easy');await page.click('#new');
 assert.equal(await page.evaluate(()=>__MA.world.enemyCountry),'GR');
 assert.equal(await page.evaluate(()=>__MA.world.buildings.filter(b=>!b.enemy&&b.type==='hq'&&b.progress===1).length),1,'completed starting HQ');
 assert.equal(await page.evaluate(()=>__MA.world.units.filter(u=>!u.enemy).length),6,'six starting workers');
 assert.equal(await page.evaluate(()=>__MA.world.stock.money),500,'no starting HQ charge');
 await page.click('#homebase');
 assert.ok(await page.locator('#info').innerText().then(t=>t.includes('Yönetim merkezi')));
 await page.keyboard.press('Escape');await page.keyboard.press('b');
 await page.locator('[data-category=military]').click();
 assert.equal(await page.locator('[data-build=barracks]').isVisible(),true);
 assert.equal(await page.locator('[data-build=farm]').isVisible(),false);
 await page.locator('[data-category=all]').click();
 await page.keyboard.press('Escape');await page.keyboard.press('b');
 const gather=await page.evaluate(()=>__MA.project(13.5,20.5));
 await page.locator('#map').click({position:gather,button:'right'});
 const before=await page.evaluate(()=>__MA.world.stock.mat);
 await page.evaluate(()=>{for(let i=0;i<1400;i++)__MA.step(.05)});
 assert.ok(await page.evaluate(b=>__MA.world.stock.mat>b,before),'worker material delivery');
 report.playtest.gather=true;
 await page.click('#tech');await page.locator('#techbody button').first().click();await page.locator('#techdialog button').last().click();
 assert.equal(await page.evaluate(()=>__MA.world.stage),2);report.playtest.research=true;
 await build('barracks',18,24);
 await page.keyboard.press('Escape');
 const bpos=await page.evaluate(()=>{const b=__MA.world.buildings.find(b=>!b.enemy&&b.type==='barracks');return __MA.project(b.x+1.5,b.y+1.5)});
 await page.locator('#map').click({position:bpos});
 // Select completed barracks via its footprint if needed.
 if(!(await page.locator('#commands button').filter({hasText:'Piyade'}).count())){
   const p=await page.evaluate(()=>{const b=__MA.world.buildings.find(b=>!b.enemy&&b.type==='barracks');return __MA.project(b.x+1.5,b.y+1.5,.6)});
   await page.locator('#map').click({position:p});
 }
 await page.locator('#commands button').filter({hasText:'Piyade'}).click();
 assert.equal(await page.evaluate(()=>__MA.world.production.length),1);
 await page.evaluate(()=>{for(let i=0;i<120;i++)__MA.step(.05)});
 assert.equal(await page.evaluate(()=>__MA.world.units.filter(u=>!u.enemy&&u.kindUnit==='infantry').length),1);
 report.playtest.production=true;
 await page.click('#save');
 await page.click('#menu');await page.click('#new');await page.click('#load');
 assert.equal(await page.evaluate(()=>__MA.world.stage),2);
 report.playtest.save=true;
 await page.click('#diplomacy');await page.locator('#dipbody button').filter({hasText:'Savaş'}).click();await page.locator('#dip > button').click();
 assert.equal(await page.evaluate(()=>__MA.world.relation),'war');
 // Put one player unit by a weakened fictional enemy HQ to isolate actual combat resolution.
 await page.evaluate(()=>{const w=__MA.world,b=w.buildings.find(b=>b.enemy&&b.type==='hq'),u=w.units.find(u=>!u.enemy&&u.kindUnit==='infantry');w.units=w.units.filter(v=>!v.enemy);b.hp=8;u.x=b.x-.6;u.y=b.y+1.5;u.attack=b.id;u.cool=0;u.path=[];for(let i=0;i<100&&!w.outcome;i++)__MA.step(.05)});
 assert.equal(await page.evaluate(()=>__MA.world.outcome),'Zafer');
 assert.equal(await page.locator('#resultdialog').evaluate(e=>e.open),true);
 report.playtest.combatFixture=true;
 report.startupAndMenus=true;
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
