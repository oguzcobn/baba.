const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
test.use({viewport:{width:390,height:844}});
async function begin(page,me='tr'){
 await page.goto(BASE+'games/1919/age.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:30000});
 await page.locator('[data-a="nations"]').click();
 await page.locator('[data-n="'+me+'"]').click();
 await expect(page.locator('#world')).toBeVisible({timeout:12000});
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('baba_1919_age_v1')));
test('national decisions have per-turn limits and cannot mint unlimited currency',async({page})=>{
 await begin(page);
 await page.locator('.tabs [data-tab="nation"]').click();
 const initial=await saved(page);
 await page.locator('.sidebody [data-a="tax"]').click();
 const once=await saved(page);
 expect(once.gold).toBe(initial.gold+60);
 await page.locator('.sidebody [data-a="tax"]').click();
 expect((await saved(page)).gold).toBe(once.gold);
 await page.locator('.sidebody [data-a="stabilize"]').click();
 const reform=await saved(page);
 await page.locator('.sidebody [data-a="stabilize"]').click();
 expect((await saved(page)).gold).toBe(reform.gold);
 await page.locator('.bottom [data-a="end"]').click();
 const historicEvent=page.locator('.modalbg [data-modal="close"]');
 if(await historicEvent.count())await historicEvent.click();
 await page.locator('.sidebody [data-a="tax"]').click();
 expect((await saved(page)).decisions.tax).toBe(2);
});
test('AI recruits only when it pays gold and manpower',async({page})=>{
 await begin(page);
 const result=await page.evaluate(()=>{
   const p=S.p.find(p=>p.owner==='gr');
   S.turn=1;const before=p.army;ai();const noFree=p.army;
   const state=S.aiEconomy.gr;const reserve={gold:state.gold,men:state.men};
   S.turn=2;ai();
   return {before,noFree,after:p.army,reserve,paid:{gold:state.gold,men:state.men}};
 });
 expect(result.noFree).toBe(result.before);
 expect(result.after).toBe(result.before+20);
 expect(result.paid.men).toBe(result.reserve.men-20+1);
 expect(result.paid.gold).toBeLessThan(result.reserve.gold);
});
test('AI respects an active truce even while trying to expand',async({page})=>{
 await begin(page);
 const result=await page.evaluate(()=>{
   S.truce['gr-tr']=100;
   for(let t=10;t<=65;t++){S.turn=t;ai();}
   return {wars:S.wars.filter(x=>x.includes('gr')&&x.includes('tr')),turn:S.turn};
 });
 expect(result.turn).toBe(65);
 expect(result.wars).toEqual([]);
});
test('three save slots protect a campaign when starting a new one',async({page})=>{
 await begin(page);
 await page.locator('.top [data-a="saves"]').click();
 await expect(page.locator('[data-a="slot-save-1"]')).toBeVisible();
 await expect(page.locator('[data-a="slot-save-2"]')).toBeVisible();
 await expect(page.locator('[data-a="slot-save-3"]')).toBeVisible();
 await page.locator('[data-a="slot-save-1"]').click();
 await page.locator('.top [data-a="menu"]').click();
 await page.locator('[data-a="nations"]').click();
 await page.locator('[data-n="gr"]').click();
 let current=await saved(page);expect(current.me).toBe('gr');
 const archives=await page.evaluate(()=>JSON.parse(localStorage.getItem('baba_1919_age_v1_archives')||'[]'));
 expect(archives.length).toBeGreaterThan(0);
 expect(JSON.parse(archives[0].game).me).toBe('tr');
 await page.locator('.top [data-a="saves"]').click();
 await page.locator('[data-a="slot-load-1"]').click();
 current=await saved(page);
 expect(current.me).toBe('tr');
 await expect(page.locator('#world')).toBeVisible();
});
test('defeat displays a dedicated endgame screen and removes turn controls',async({page})=>{
 await begin(page);
 await page.evaluate(()=>{
   for(const p of S.p)if(p.owner===S.me)p.owner='gr';
   outcome();save();render();
 });
 await expect(page.locator('.endgame-summary')).toBeVisible();
 await expect(page.locator('.endgame-summary h1')).toContainText('Sefer Kaybedildi');
 await expect(page.locator('.bottom [data-a="end"]')).toHaveCount(0);
});
test('world map avoids the false Türkiye–Somaliland sea connection',async({page})=>{
 await begin(page);
 const neighbors=await page.evaluate(()=>adj('c792').map(id=>({id,name:prov(id)?.label})));
 expect(neighbors.map(x=>x.name?.toLowerCase())).not.toContain('somaliland');
 await page.locator('.top [data-a="menu"]').click();
 await page.locator('[data-a="nations"]').click();
 await page.locator('#nation-filter').fill('Türkiye');
 expect(await page.locator('[data-n]:visible').count()).toBe(1);
});
test('20 strategic simulations support 50 turns without unbounded AI generation',async({page})=>{
 await begin(page);
 const summary=await page.evaluate(()=>{
   const report=[];
   for(let run=0;run<20;run++){
     S=initial(run%2?'gr':'tr');
     const me=S.me;let reached=1;
     for(let t=2;t<=50;t++){
       const regions=own(),army=regions.reduce((n,p)=>n+p.army,0);
       const income=regions.reduce((n,p)=>n+Math.round(p.pop*.12+p.dev*4+p.market*8+p.farm*4),0);
       const upkeep=Math.ceil(army*.23);
       if(run%5===1&&t%7===0&&S.gold>=95&&regions[0]){S.gold-=95;regions[0].market++}
       if(run%5===2&&t%4===0&&S.gold>=60&&S.men>=20&&regions[0]){S.gold-=60;S.men-=20;regions[0].army+=20}
       if(run%5===3&&t%5===0&&S.gold>=85&&regions[0]){S.gold-=85;regions[0].farm++;regions[0].pop+=4}
       if(run%5===4&&t%8===0&&S.gold>=100){S.gold-=100;S.tech++}
       const unpaid=Math.max(0,upkeep-(S.gold+income));
       S.gold=Math.max(0,S.gold+income-upkeep);
       S.men+=Math.ceil(regions.reduce((n,p)=>n+p.pop,0)/75);
       S.stability=clamp(S.stability+(unpaid>0?-2:income>=upkeep?1:0),0,100);
       for(const p of S.p){p.moved=false;p.pop=Math.min(230,p.pop+(p.farm?2:1))}
       S.turn=t;ai();
       reached=t;
       if(!own().length||S.stability<=0)break;
     }
     report.push({me,reached,aiResources:Object.values(S.aiEconomy).every(e=>Number.isFinite(e.gold)&&e.gold>=0&&Number.isFinite(e.men)&&e.men>=0),maxAIArmy:Math.max(...S.p.filter(p=>p.owner!==S.me).map(p=>p.army))});
   }
   return report;
 });
 expect(summary).toHaveLength(20);
 expect(summary.every(s=>s.aiResources)).toBe(true);
 expect(summary.every(s=>s.maxAIArmy<10000)).toBe(true);
 expect(summary.filter(s=>s.reached===50).length).toBeGreaterThanOrEqual(5);
 console.log('1919 CAMPAIGN SIMULATIONS',JSON.stringify(summary));
});
