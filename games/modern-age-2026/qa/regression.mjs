import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{
 const filename=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!filename.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return}
 try{res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.html')?'text/html':'application/octet-stream');res.end(await readFile(filename))}
 catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const result={errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>result.errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>window.__MA?.renderer?.drawCount>0);
 result.startMatrix=await page.evaluate(()=>{
  let cases=0;const q=id=>document.getElementById(id);
  for(let seed=1;seed<=100;seed++)for(const mode of ['sandbox','skirmish']){
   const country=['TR','US','IL','IR','GB','GR'][seed%6];
   q('seed').value=seed;q('country').value=country;q('mode').value=mode;q('new').click();
   const w=__MA.world,crew=w.units.filter(v=>!v.enemy),hq=w.buildings.filter(b=>!b.enemy);
   if(w.country!==country||hq.length!==1||hq[0].type!=='hq'||!__MA.selected.includes(hq[0].id)||crew.length!==6||w.stock.mat!==350||w.stock.food!==200||w.stock.money!==500||w.stock.oil!==100)throw Error('Start '+seed);
   for(const u of crew)if(crew.some(v=>u!==v&&Math.hypot(u.x-v.x,u.y-v.y)<.38))throw Error('Overlap');
   if(mode==='skirmish'&&w.units.filter(v=>v.enemy).length!==6)throw Error('Opponent start');
   cases++
  }
  return cases
 });
 result.queue=await page.evaluate(()=>{
  const h=__MA.world.buildings.find(b=>!b.enemy),w=__MA.world,oldFood=w.stock.food;
  if(!__MA.queueUnit('worker',h)||w.stock.food!==oldFood-50)throw Error('reserve');
  document.querySelector('#homebase').click();
  [...document.querySelectorAll('#commands button')].find(b=>b.textContent.includes('Son üretimi')).click();
  if(w.stock.food!==oldFood||w.production.length)throw Error('refund');
  for(let i=0;i<4;i++)if(!__MA.queueUnit('worker',h))throw Error('within cap');
  if(__MA.queueUnit('worker',h))throw Error('over capacity');
  for(let i=0;i<520;i++)__MA.step(.05);
  if(w.units.filter(u=>!u.enemy).length!==10||w.production.length)throw Error('completion');
  return 'reserve / refund / capacity / timed completion passed'
 });
 result.cargo=await page.evaluate(()=>{
  const w=__MA.world,u=w.units.find(u=>!u.enemy),mat=w.resources.find(r=>r.type==='mat'),food=w.resources.find(r=>r.type==='food');
  document.querySelector('#map').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'b'}));
  // Isolate one loaded carrier at a mine and switch his group to food.
  Object.assign(u,{x:mat.x+.4,y:mat.y+.4,role:'gather',target:mat.id,kind:'mat',carry:11,path:[]});
  const before=w.stock.mat;__MA.command({x:food.x+.5,y:food.y+.5});
  if(u.role!=='deliver'||u.carry!==11||w.stock.mat!==before)throw Error('cargo assignment');
  for(let i=0;i<1000&&u.carry===11;i++)__MA.step(.05);
  if(w.stock.mat!==before+11||u.target!==food.id)throw Error('physical delivery');
  return 'material carried to depot before new food order'
 });
 result.freight=await page.evaluate(()=>{
  const w=__MA.world;
  document.querySelector('#tech').click();
  document.querySelector('#techbody button').click();
  const before=w.stock.money;
  [...document.querySelectorAll('#techbody button')].find(b=>b.textContent.includes('Taşıma ekipmanı')).click();
  if(!w.upgrades.freight||w.stock.money!==before-80)throw Error('freight');
  document.querySelector('#techdialog').close();document.querySelector('#save').click();document.querySelector('#load').click();
  if(!__MA.world.upgrades.freight)throw Error('persistence');
  return 'one-time upgrade and save/load passed'
 });
 result.truce=await page.evaluate(()=>{
  const q=id=>document.getElementById(id);q('diplomacy').click();
  const click=n=>[...q('dipbody').querySelectorAll('button')].find(b=>b.textContent===n).click();
  click('Savaş');click('Ateşkes');click('Tarafsız');click('Savaş');
  if(__MA.world.relation!=='truce')throw Error('truce bypass');
  q('dip').close();for(let i=0;i<1810;i++)__MA.step(.05);
  if(__MA.world.relation!=='neutral')throw Error('truce expiry');
  if(!__MA.world.ai.trained)throw Error('AI training');
  return 'truce held then expired; opponent trained troops'
 });
 result.victories=await page.evaluate(()=>{
   const w=__MA.world,q=id=>document.getElementById(id),out=[];
   for(const goal of ['culture','economy','science','alliance']){
     w.victoryGoal=goal;w.outcome='';w.goalTime=0;
     if(goal==='culture')w.buildings.push({id:90000,type:'landmark',x:8,y:9,progress:1,hp:250});
     if(goal==='economy')Object.assign(w.stock,{money:1100,food:650});
     if(goal==='science')w.stage=4;
     if(goal==='alliance')w.relation='alliance';
     for(let i=0;i<1810&&!w.outcome;i++)__MA.step(.05);
     if(w.outcome!=='Zafer'||!w.victoryReason)throw Error(goal);
     out.push(w.victoryReason);q('resultdialog').close();
   }
   return out
 });
 result.research=await page.evaluate(()=>{
   const w=__MA.world,q=id=>document.getElementById(id);
   w.outcome='';w.victoryGoal='none';w.stage=2;w.stock.money=500;w.stock.mat=500;
   w.buildings.push({id:90001,type:'research',x:7,y:10,progress:1,hp:250});
   const button=prefix=>[...q('techbody').querySelectorAll('button')].find(b=>b.textContent.startsWith(prefix));
   q('tech').click();button('Hassas tarım').click();button('Araştırmayı iptal').click();
   if(w.stock.money!==500||w.stock.mat!==500||w.researchOrder)throw Error('research refund');
   button('Hassas tarım').click();q('techdialog').close();
   for(let i=0;i<370;i++)__MA.step(.05);
   if(w.upgrades.agriculture||w.researchOrder.left>=18)throw Error('power shortage rate');
   w.buildings.push({id:90002,type:'power',x:9,y:12,progress:1,hp:250});
   for(let i=0;i<190;i++)__MA.step(.05);
   if(!w.upgrades.agriculture||w.researchOrder)throw Error('powered research completion');
   return 'cancel, refund, energy slowdown and completion passed'
 });
 result.invalidSave=await page.evaluate(async()=>{
   const before=__MA.world,input=document.querySelector('#savefile');
   const data=new DataTransfer();data.items.add(new File(['{"world":{"units":[]}}'],'corrupt.json'));
   input.files=data.files;await input.onchange({target:input});
   return __MA.world===before&&document.querySelector('#notice').textContent.includes('Geçersiz')
 });
 assert.equal(result.invalidSave,true);
 result.aiMatches=await page.evaluate(()=>{
   const games=[],q=id=>document.getElementById(id);
   for(let n=0;n<10;n++){
     q('mode').value='skirmish';q('difficulty').value=['easy','normal','hard'][n%3];q('seed').value=101+n;
     q('new').click();q('diplomacy').click();
     [...q('dipbody').querySelectorAll('button')].find(b=>b.textContent==='Savaş').click();q('dip').close();
     let w=__MA.world;
     for(let i=0;i<4000&&!w.outcome;i++)__MA.step(.05);
     if(w.outcome!=='Yenilgi'||!w.ai.trained)throw Error('AI economic opening '+n);
     games.push({seed:w.seed,seconds:w.time,trained:w.ai.trained,result:w.outcome});
     q('resultdialog').close()
   }
   return games
 });
 result.constructionAndGroups=await page.evaluate(()=>{
   const q=id=>document.getElementById(id),w=()=>__MA.world;
   q('mode').value='sandbox';q('new').click();
   const key=(key,ctrlKey=false)=>window.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey}));
   key('b');key('2',true);const ids=__MA.selected.join();key('Escape');key('2');
   if(__MA.selected.join()!==ids)throw Error('group restore');
   document.querySelector('[data-build=house]').click();
   const money=w().stock.money,mat=w().stock.mat;
   __MA.buildAt(19.2,32.2);
   const house=w().buildings.find(b=>b.type==='house');if(!house)throw Error('build spot');
   const p=__MA.project(house.x+1,house.y+1),cv=q('map'),r=cv.getBoundingClientRect();
   const pointer={clientX:r.left+p.x,clientY:r.top+p.y,button:0,bubbles:true};
   cv.dispatchEvent(new MouseEvent('mousedown',pointer));window.dispatchEvent(new MouseEvent('mouseup',pointer));
   [...q('commands').querySelectorAll('button')].find(b=>b.textContent.includes('İnşaatı iptal')).click();
   if(w().buildings.includes(house)||w().stock.money!==money||w().stock.mat!==mat)throw Error('cancel');
   q('homebase').click();[...q('commands').querySelectorAll('button')].find(b=>b.textContent==='Toplanma noktası').click();
   __MA.command({x:20,y:32});
   const base=w().buildings.find(b=>b.type==='hq');__MA.queueUnit('worker',base);
   for(let i=0;i<130;i++)__MA.step(.05);
   const worker=w().units.at(-1);
   if(worker.kindUnit!=='worker'||worker.tx!==20||worker.ty!==32)throw Error('rally');
   return 'group recall, construction refund, persistent rally destination passed'
 });
 assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1}
finally{await writeFile(new URL('regression.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);await browser.close();server.close()}
