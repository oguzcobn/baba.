const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
test.use({viewport:{width:390,height:844}});
async function historic(page){
 await page.goto(BASE+'games/1919/age.html?scenario=1919',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.home [data-a="nations"]')).toBeVisible({timeout:30000});
 await page.locator('[data-a="nations"]').click();
 await expect(page.locator('[data-n="tr"]')).toBeVisible();
 await page.locator('[data-n="tr"]').click();
 await expect(page.locator('#world')).toBeVisible();
 const event=page.locator('.modalbg [data-modal="close"]');if(await event.count())await event.click();
}
test('historical campaign is separate from modern world map',async({page})=>{
 await historic(page);
 const details=await page.evaluate(()=>({provinces:S.p.length,capital:N.tr[3],historicalKey:SAVEKEY,hasAnkara:!!prov('Ankara'),hasModernTurkey:!!prov('c792')}));
 expect(details.provinces).toBe(32);
 expect(details.capital).toBe('Ankara');
 expect(details.historicalKey).toBe('baba_1919_age_v1_historical');
 expect(details.hasAnkara).toBe(true);
 expect(details.hasModernTurkey).toBe(false);
 await page.locator('.top [data-a="menu"]').click();
 await expect(page.locator('[data-a="world"]')).toBeVisible();
});
test('modern world home opens the historical scenario',async({page})=>{
 await page.goto(BASE+'games/1919/age.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-a="historical"]')).toBeVisible({timeout:30000});
 await page.locator('[data-a="historical"]').click();
 await expect(page).toHaveURL(/scenario=1919/);
 await expect(page.locator('.home [data-a="nations"]')).toBeVisible();
 await expect(page.locator('.home')).toContainText('32 eyalet');
});
test('historic and modern campaign saves never overwrite each other',async({page})=>{
 await page.goto(BASE+'games/1919/age.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:30000});
 await page.locator('[data-a="nations"]').click();await page.locator('[data-n="tr"]').click();
 const modern=await page.evaluate(()=>localStorage.getItem('baba_1919_age_v1'));
 await page.locator('.top [data-a="menu"]').click();
 await page.locator('[data-a="historical"]').click();
 await expect(page).toHaveURL(/scenario=1919/);
 await page.locator('[data-a="nations"]').click();await page.locator('[data-n="tr"]').click();
 const records=await page.evaluate(()=>({modern:localStorage.getItem('baba_1919_age_v1'),historic:JSON.parse(localStorage.getItem('baba_1919_age_v1_historical'))}));
 expect(records.modern).toBe(modern);
 expect(records.historic.p).toHaveLength(32);
});
test('historic AI obeys active truce and never prints money via free troops',async({page})=>{
 await historic(page);
 const result=await page.evaluate(()=>{
  S.truce['gr-tr']=100;
  const before=S.p.filter(p=>p.owner==='gr').reduce((n,p)=>n+p.army,0);
  for(let t=2;t<=40;t++){S.turn=t;ai();}
  return {war:S.wars.some(pair=>pair.includes('gr')&&pair.includes('tr')),economy:S.aiEconomy.gr,before,after:S.p.filter(p=>p.owner==='gr').reduce((n,p)=>n+p.army,0)};
 });
 expect(result.war).toBe(false);
 expect(result.economy.gold).toBeGreaterThanOrEqual(0);
 expect(result.economy.men).toBeGreaterThanOrEqual(0);
 expect(result.after).toBeLessThan(10000);
});
test('historic victory has a dedicated result screen',async({page})=>{
 await historic(page);
 await page.evaluate(()=>{
  for(const id of ['Izmir','Afyon','Eskisehir','Istanbul'])prov(id).owner='tr';
  outcome();save();render();
 });
 await expect(page.locator('.endgame-summary')).toBeVisible();
 await expect(page.locator('.endgame-summary h1')).toContainText('Zaferi');
 await expect(page.locator('.bottom [data-a="end"]')).toHaveCount(0);
});

test('legacy 32-region campaign is imported without overwriting the world save',async({page})=>{
 await historic(page);
 await page.evaluate(()=>{
  const key='baba_1919_age_v1_historical',snapshot=localStorage.getItem(key);
  localStorage.setItem('baba_1919_age_v1_anadolu_backup',snapshot);
  localStorage.setItem('baba_1919_age_v1','{"marker":"keep-modern-save"}');
  localStorage.removeItem(key);
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('.home [data-a="continue"]')).toBeVisible();
 const keys=await page.evaluate(()=>({
  historical:JSON.parse(localStorage.getItem('baba_1919_age_v1_historical')),
  untouched:localStorage.getItem('baba_1919_age_v1')
 }));
 expect(keys.historical.p).toHaveLength(32);
 expect(keys.untouched).toBe('{"marker":"keep-modern-save"}');
 await page.locator('.home [data-a="continue"]').click();
 await expect(page.locator('#world')).toBeVisible();
});
