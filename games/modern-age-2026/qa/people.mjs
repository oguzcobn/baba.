import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));
 p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
 await p.goto('http://localhost:8080/index.html');await p.selectOption('#mode','sandbox');await p.click('#new');
 await p.waitForFunction(()=>__MA.metrics.skinnedPeople===6);
 await p.selectOption('#quality','high');
 const lightSamples={};
 for(const [label,hour,weather] of [['noon',12,'clear'],['sunset',18,'clear'],['night',0,'clear'],['rain',12,'rain']]){
   await p.click('#climate');
   await p.locator('#hours').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}))},hour);await p.selectOption('#wchoice',weather);
   await p.click('#weather > button');
   await p.waitForTimeout(1200);
   const region=await p.locator('#map').boundingBox();
   const image=await p.screenshot({path:'lighting-'+label+'.png',clip:region});
   lightSamples[label]=await p.evaluate(async b64=>{
     const bitmap=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
     const canvas=document.createElement('canvas');canvas.width=100;canvas.height=64;
     const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,100,64);
     const rgb=context.getImageData(0,0,100,64).data,mean=[0,0,0];
     for(let i=0;i<rgb.length;i+=4)for(let c=0;c<3;c++)mean[c]+=rgb[i+c]/6400;
     bitmap.close();return mean;
   },image.toString('base64'));
 }
 console.log('Mean scene RGB (0–255)',lightSamples);
 assert.ok(lightSamples.noon[1]>lightSamples.night[1]+8,'daylight and moonlight must differ');
 assert.ok(lightSamples.sunset[0]/lightSamples.sunset[2]>lightSamples.night[0]/lightSamples.night[2],'warm sunset and cool night');
 const pos=await p.evaluate(()=>{
   const w=__MA.world,h=w.buildings.find(b=>b.type==='hq');
   __MA.spawnUnit('infantry',h,false,true);
   const workers=w.units.slice(0,2),soldier=w.units.at(-1);
   w.units=[...workers,soldier];
   w.units.forEach((u,i)=>{u.x=19+i*.7;u.y=29-i*.45;u.angle=1.2;u.role='idle';u.path=[]});
   return __MA.project(19.7,28.55)
 });
 await p.waitForFunction(()=>__MA.metrics.skinnedPeople===3);
 const box=await p.locator('#map').boundingBox();
 await p.mouse.move(box.x+pos.x,box.y+pos.y);await p.mouse.wheel(0,-2600);
 await p.waitForTimeout(800);await p.screenshot({path:'people-close.png'});
 await p.evaluate(()=>{const w=__MA.world;const u=w.units[0];u.carry=15;u.kind='mat';u.role='move';u.path=[{x:u.x+2,y:u.y}];});
 await p.waitForTimeout(250);await p.screenshot({path:'people-carry.png'});
 assert.equal(await p.locator('#gfx,#menugfx').count(),0);
 await p.mouse.move(box.x+pos.x,box.y+pos.y);await p.mouse.wheel(0,3200);
 await p.waitForFunction(()=>__MA.metrics.crowdPeople>0);
 const reconnaissance=await p.evaluate(()=>{
   const w=__MA.world,scout=w.units[0];if(w.terrain.length!==128*128||__MA.seen(77,79))throw Error('Initial shroud');
   scout.x=77.5;scout.y=79.5;scout.path=[];return scout.id;
 });
 await p.waitForFunction(()=>__MA.seen(77,79));
 await p.evaluate(id=>{const u=__MA.world.units.find(u=>u.id===id);u.x=19;u.y=29},reconnaissance);
 await p.waitForFunction(()=>!__MA.seen(77,79)&&__MA.world.explored[79*128+77]===1);
 const combat=await p.evaluate(()=>{
   const w=__MA.world,h=w.buildings.find(b=>b.type==='hq');w.relation='war';
   const attacker=w.units.find(u=>u.kindUnit==='infantry');
   attacker.x=19;attacker.y=28;attacker.cool=0;
   for(const kind of ['worker','armor']){
     __MA.spawnUnit(kind,h,true,true);const target=w.units.at(-1);
     target.x=19.9;target.y=28;target.hp=1;target.path=[];attacker.attack=target.id;attacker.cool=0;
     __MA.step(.05);
   }
   return __MA.effects.map(e=>e.kind);
 });
 for(const effect of ['hit','fall','blast'])assert.ok(combat.includes(effect),effect);
 await p.waitForTimeout(150);await p.screenshot({path:'people-combat.png'});
 assert.deepEqual(errors,[]);
 await p.close();
 const offline=await b.newPage(),requests=[];
 offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 await offline.goto(new URL('../OYNA.html',import.meta.url).href);await offline.click('#new');
 await offline.waitForFunction(()=>window.__MA?.renderer?.drawCount>1);
 assert.deepEqual(requests,[]);await offline.close();
 const noGpu=await b.newPage();
 await noGpu.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,...options){return kind==='webgl2'?null:original.call(this,kind,...options)}
 });
 await noGpu.goto('http://localhost:8080/index.html');
 await noGpu.waitForFunction(()=>document.querySelector('#graphicsMessage')?.textContent.includes('3D sahne açılamadı'));
 assert.equal(await noGpu.locator('#new').isDisabled(),true);await noGpu.close();
 console.log('Verified 6 rigged workers, infantry, carrying, close camera, single Three.js renderer and distant instanced 3D meshes.');
}finally{await b.close()}
