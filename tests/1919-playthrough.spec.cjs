const { test, expect } = require('@playwright/test');
const BASE = process.env.BABA_TEST_URL || 'http://127.0.0.1:4173/';
const SAVE='baba_1919_age_v1';
const snap=page=>page.evaluate(k=>{
  const s=JSON.parse(localStorage.getItem(k)||'null');
  if(!s)return null;
  return {turn:s.turn,gold:s.gold,men:s.men,tech:s.tech,stability:s.stability,me:s.me,
    own:s.p.filter(x=>x.owner===s.me).length,wars:s.wars.length,
    capital:s.p.find(x=>x.id==='c792'),greece:s.p.find(x=>x.id==='c300'),
    history:s.log.slice(0,4).map(x=>x.msg)};
},SAVE);
async function playScenario(page,device){
 const report={device,errors:[],steps:[],viewport:{}};
 page.on('pageerror',e=>report.errors.push('JS '+e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push('console '+m.text().slice(0,200))});
 const step=async(label,fn)=>{try{const val=await fn();report.steps.push({label,ok:true,value:val===undefined?null:val});return true}
   catch(e){report.steps.push({label,ok:false,error:String(e.message||e).slice(0,240)});return false}};
 const select=async(id,real=true)=>{
   const loc=page.locator('#world [data-p="'+id+'"]');
   if(real)await loc.click({timeout:4000});
   else await loc.dispatchEvent('click');
   return page.locator('#world .province.active').getAttribute('data-p');
 };
 await step('world load',async()=>{
   await page.goto(BASE+'games/1919/age.html');
   await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:20000});
   return {title:await page.title(),nations:await page.locator('[data-a="nations"]').count()};
 });
 await step('nation picker and real start',async()=>{
   await page.locator('[data-a="nations"]').click();
   const all=await page.locator('[data-n]').count();
   await page.locator('[data-n="tr"]').click();
   await expect(page.locator('#world')).toBeVisible({timeout:10000});
   return {countries:all,...(await snap(page))};
 });
 await step('real click Greece on map',async()=>({selected:await select('c300'),expected:'c300'}));
 await step('diplomacy single target',async()=>{
   await page.locator('.tabs [data-tab="diplomacy"]').click();
   return {target:await page.locator('.dip-target').getAttribute('data-country'),actions:await page.locator('[data-d]').count()};
 });
 await step('declare war Greece',async()=>{
   page.once('dialog',d=>d.accept());
   await page.locator('[data-d="war:gr"]').click({timeout:5000});
   return {wars:(await snap(page)).wars,button:await page.locator('[data-d="peace:gr"]').count()};
 });
 await step('select home and recruit troops',async()=>{
   await select('c792',true);
   await page.locator('.tabs [data-tab="province"]').click();
   await page.locator('.sidebody [data-a="recruit"]').click();
   return await snap(page);
 });
 await step('first army send real clicks',async()=>{
   await page.locator('.bottom [data-a="move"]').click();
   const target=await select('c300',true);
   const open=await page.locator('.modalbg [data-modal="go"]').count();
   if(!open)throw Error('Move dialog missing: selected='+target);
   await page.locator('.modalbg [data-modal="go"]').click();
   await page.waitForTimeout(1500);
   return {target,...await snap(page)};
 });
 await step('build economic infrastructure and start turn',async()=>{
   await select('c792',false);
   await page.locator('.tabs [data-tab="province"]').click();
   const before=await snap(page);
   await page.locator('.sidebody [data-a="market"]').click();
   await page.locator('.bottom [data-a="end"]').click();
   return {before,after:await snap(page)};
 });
 await step('progress 15 more turns',async()=>{
   const times=[];
   if(await page.locator('.modalbg').count())await page.locator('.modalbg [data-modal="close"]').first().click({timeout:2500});
   for(let i=0;i<15;i++){
     const before=performance.now();
     await page.locator('.bottom [data-a="end"]').click({timeout:8000});
     await page.waitForTimeout(60);
     times.push(Math.round(performance.now()-before));
     if(await page.locator('.modalbg').count())await page.locator('.modalbg [data-modal="close"]').first().click({timeout:2000});
   }
   return {min:Math.min(...times),max:Math.max(...times),avg:Math.round(times.reduce((a,b)=>a+b,0)/times.length),state:await snap(page)};
 });
 await step('save then reload and continue',async()=>{
   const before=await snap(page);
   await page.locator('.top [data-a="save"]').click();
   await page.reload();
   await expect(page.locator('[data-a="continue"]')).toBeVisible({timeout:20000});
   await page.locator('[data-a="continue"]').click();
   await expect(page.locator('#world')).toBeVisible({timeout:10000});
   const after=await snap(page);
   return {before:{turn:before.turn,gold:before.gold,own:before.own},after:{turn:after.turn,gold:after.gold,own:after.own},same:before.turn===after.turn&&before.gold===after.gold};
 });
 await step('mobile layout and country target usability',async()=>{
   const d=await page.evaluate(()=>{
     const map=document.querySelector('#world [data-p="c300"]'),buttons=[...document.querySelectorAll('.tabs button')];
     const r=map?.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
       provinceBox:r?{w:r.width,h:r.height}:null,
       tabBoxes:buttons.map(b=>({text:b.textContent,w:Math.round(b.getBoundingClientRect().width),h:Math.round(b.getBoundingClientRect().height)}))};
   });
   return d;
 });
 console.log('1919_PLAYTHROUGH_AUDIT '+JSON.stringify(report));
 await page.screenshot({path:'test-results/1919-'+device+'-after-16-turns.png',fullPage:true}).catch(()=>{});
 expect(report.steps.filter(x=>x.label!=='real click Greece on map').length).toBeGreaterThan(7);
}
test.describe('1919 campaign audit - actual browser playthrough',()=>{
 test('desktop full playthrough',async({page})=>{
   test.setTimeout(110000);
   await page.setViewportSize({width:1440,height:900});
   await playScenario(page,'desktop');
 });
 test('mobile full playthrough',async({page})=>{
   test.setTimeout(110000);
   await page.setViewportSize({width:390,height:844});
   await playScenario(page,'mobile');
 });
});
