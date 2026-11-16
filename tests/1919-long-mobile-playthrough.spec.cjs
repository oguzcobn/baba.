const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
test.use({viewport:{width:390,height:844}});
test.setTimeout(150000);
const configs=[
 {label:'modern world',url:'games/1919/age.html',storageKey:'baba_1919_age_v1'},
 {label:'historical Anatolia',url:'games/1919/age.html?scenario=1919',storageKey:'baba_1919_age_v1_historical'}
];
for(const config of configs){
 test('mobile full 50-turn interactive campaign: '+config.label,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+config.url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.home [data-a="nations"]')).toBeVisible({timeout:30000});
  await page.locator('[data-a="nations"]').click();
  await page.locator('[data-n="tr"]').click();
  await expect(page.locator('#world')).toBeVisible();
  const closeEvent=async()=>{
   const modal=page.locator('.modalbg [data-modal="close"]');
   if(await modal.count())await modal.click();
  };
  await closeEvent();
  for(let i=0;i<50;i++){
   await expect(page.locator('.bottom [data-a="end"]')).toBeVisible({timeout:10000});
   await page.locator('.bottom [data-a="end"]').click();
   await closeEvent();
   const status=await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));return {turn:s?.turn,loss:s?.loss,win:s?.win}},config.storageKey);
   expect(status.turn).toBe(i+2);
   expect(status.loss).toBe(false);
   expect(status.win).toBe(false);
  }
  await expect(page.locator('#world')).toBeVisible();
  const result=await page.evaluate(key=>{
   const s=JSON.parse(localStorage.getItem(key));
   return {turn:s.turn,regions:s.p.filter(p=>p.owner===s.me).length,stability:s.stability,gold:s.gold,log:s.log.length};
  },config.storageKey);
  expect(result.turn).toBe(51);
  expect(result.regions).toBeGreaterThan(0);
  expect(result.stability).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  console.log('50 TURN MOBILE INTERACTIVE',config.label,JSON.stringify(result));
 });
}
