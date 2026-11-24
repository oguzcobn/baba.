const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
const cases=[
 ['age-of-war','embers'],['warfare-1917','rain'],['the-waitress','steam'],
 ['fancy-pants-3','confetti'],['territory-war','dust'],['electric-man-2','electric']
];
for(const [id] of cases){
 test(id+' renders dedicated art-directed animated scene without gameplay errors',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE+'games/arcade/'+id+'.html');
   await expect(page.locator('#baba-ambient')).toBeVisible();
   await expect(page.locator('#baba-art-label')).toBeVisible();
   await expect(page.locator('canvas#c')).toBeVisible();
   const started=page.locator('#btn-start');
   await expect(started).toBeVisible();
   await started.click();
   await page.waitForTimeout(500);
   const state=await page.locator('#baba-ambient').evaluate(c=>({width:c.width,height:c.height}));
   expect(state.width).toBeGreaterThan(100);
   expect(state.height).toBeGreaterThan(100);
   expect(errors).toEqual([]);
 });
}
