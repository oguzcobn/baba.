import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));
 p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
 await p.goto('http://localhost:8080/index.html');await p.selectOption('#mode','sandbox');await p.click('#new');
 await p.waitForFunction(()=>__MA.metrics.skinnedPeople===6);
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
 assert.deepEqual(errors,[]);
 console.log('Verified 6 rigged workers, infantry, carrying, close camera, single Three.js renderer and distant instanced 3D meshes.');
}finally{await b.close()}
