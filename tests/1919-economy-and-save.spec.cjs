const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
const KEY='baba_1919_age_v1';
async function begin(page,country='tr'){
 await page.goto(BASE+'games/1919/age.html');
 await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:20000});
 await page.locator('[data-a="nations"]').click();
 await page.locator('[data-n="'+country+'"]').click();
 await expect(page.locator('#world')).toBeVisible({timeout:10000});
}
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
test.describe('1919 extended mechanics and usability audit',()=>{
 test('tax + reform generates free gold without passing a single turn',async({page})=>{
   await begin(page);
   await page.locator('.tabs [data-tab="nation"]').click();
   const before=await saved(page);
   for(let i=0;i<10;i++){
     await page.locator('.sidebody [data-a="tax"]').click();
     await page.locator('.sidebody [data-a="stabilize"]').click();
   }
   const after=await saved(page);
   const report={before:{gold:before.gold,stability:before.stability,turn:before.turn},
     after:{gold:after.gold,stability:after.stability,turn:after.turn},
     profit:after.gold-before.gold,canRepeatWithoutTurn:after.turn===before.turn};
   console.log('1919_ECONOMY_AUDIT '+JSON.stringify(report));
   expect(report.profit).toBe(150);
   expect(report.canRepeatWithoutTurn).toBe(true);
 });
 test('starting another campaign overwrites existing progression without confirmation',async({page})=>{
   await begin(page);
   await page.locator('.bottom [data-a="end"]').click();
   if(await page.locator('.modalbg').count())await page.locator('.modalbg [data-modal="close"]').click();
   const before=await saved(page);
   const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());d.accept()});
   await page.locator('.top [data-a="menu"]').click();
   await page.locator('[data-a="nations"]').click();
   await page.locator('[data-n="gr"]').click();
   const after=await saved(page);
   const report={before:{me:before.me,turn:before.turn},after:{me:after.me,turn:after.turn},warnings:dialogs.length};
   console.log('1919_OVERWRITE_AUDIT '+JSON.stringify(report));
   expect(before.turn).toBe(2);
   expect(after.turn).toBe(1);
   expect(dialogs.length).toBe(0);
 });
 test('AI does not respect an unexpired diplomatic truce',async({page})=>{
   await begin(page);
   await page.evaluate(key=>{
     const s=JSON.parse(localStorage.getItem(key));
     s.turn=6;s.wars=[];s.truce={'gr-tr':100};localStorage.setItem(key,JSON.stringify(s));
   },KEY);
   await page.reload();
   await expect(page.locator('[data-a="continue"]')).toBeVisible({timeout:20000});
   await page.locator('[data-a="continue"]').click();
   await page.locator('.bottom [data-a="end"]').click();
   const s=await saved(page);
   const greekWar=s.wars.some(w=>w.includes('tr')&&w.includes('gr'));
   console.log('1919_TRUCE_AUDIT '+JSON.stringify({turn:s.turn,truceUntil:s.truce['gr-tr'],greekWar,warCount:s.wars.length}));
   expect(s.turn).toBe(7);
   expect(greekWar).toBe(true);
 });
 test('world-country touch target dimensions and search absence',async({page})=>{
   await page.setViewportSize({width:390,height:844});
   await begin(page);
   const audit=await page.evaluate(()=>{
     const rects=[...document.querySelectorAll('#world [data-p]')].map(e=>{
       const r=e.getBoundingClientRect();return {id:e.dataset.p,w:Math.round(r.width),h:Math.round(r.height)};
     });
     return {countries:rects.length,
       under12:rects.filter(r=>r.w<12||r.h<12).length,
       under24:rects.filter(r=>r.w<24||r.h<24).length,
       under44:rects.filter(r=>r.w<44||r.h<44).length,
       sampleSmallest:rects.slice().sort((a,b)=>a.w*a.h-b.w*b.h).slice(0,12),
       hasSearch:!!document.querySelector('input[type=search], input[placeholder*=Ara], input[placeholder*=Search]'),
       bodyScrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
   });
   console.log('1919_TOUCH_AUDIT '+JSON.stringify(audit));
   expect(audit.countries).toBeGreaterThan(200);
 });
});
