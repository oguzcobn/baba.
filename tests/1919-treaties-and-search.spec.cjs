const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
test.use({viewport:{width:390,height:844}});
async function begin(page){
 await page.goto(BASE+'games/1919/age.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:30000});
 await page.locator('[data-a="nations"]').click();
 await page.locator('[data-n="tr"]').click();
 await expect(page.locator('#world')).toBeVisible();
}
async function dipToGreece(page){
 await page.locator('#world [data-p="c300"]').dispatchEvent('click');
 await page.locator('.tabs [data-tab="diplomacy"]').click();
 await expect(page.locator('.dip-target[data-country="gr"]')).toBeVisible();
}
test('trade treaty pays economic income and cannot be purchased twice',async({page})=>{
 await begin(page);await dipToGreece(page);
 await page.locator('.dip-target [data-d="improve:gr"]').click();
 await page.locator('.dip-target [data-d="trade:gr"]').click();
 const state=await page.evaluate(()=>({treaties:S.treaties.trade,bonus:tradeBonus('tr'),otherBonus:tradeBonus('gr'),gold:S.gold}));
 expect(state.treaties).toEqual([['tr','gr']]);expect(state.bonus).toBe(12);
 expect(state.otherBonus).toBe(12);expect(state.gold).toBe(360);
 await expect(page.locator('.dip-target [data-d="trade:gr"]')).toBeDisabled();
 const economy=await page.evaluate(()=>{
  S.aiEconomy.gr={gold:0,men:0};S.turn=1;
  const gr=S.p.filter(p=>p.owner==='gr');
  const base=gr.reduce((n,p)=>n+Math.round(p.pop*.12+p.dev*4+(p.market||0)*8+(p.farm||0)*4),0);
  const upkeep=Math.ceil(gr.reduce((n,p)=>n+p.army,0)*.23);
  ai();return {actual:S.aiEconomy.gr.gold,expected:Math.max(0,base+12+20-upkeep)};
 });
 expect(economy.actual).toBe(economy.expected);
});
test('nonaggression treaty blocks declaration until expiry',async({page})=>{
 await begin(page);await dipToGreece(page);
 await page.locator('.dip-target [data-d="pact:gr"]').click();
 const state=await page.evaluate(()=>({truce:S.truce['gr-tr'],gold:S.gold}));
 expect(state.truce).toBe(13);expect(state.gold).toBe(390);
 await page.locator('.dip-target [data-d="war:gr"]').click();
 expect(await page.evaluate(()=>war('tr','gr'))).toBe(false);
 await expect(page.locator('.dip-target [data-d="pact:gr"]')).toBeDisabled();
});
test('allied AI responds when partner suffers an invasion',async({page})=>{
 await begin(page);await dipToGreece(page);
 await page.evaluate(()=>{S.relations['gr-tr']=50;save();render()});
 await page.locator('.dip-target [data-d="alliance:gr"]').click();
 const state=await page.evaluate(()=>{
  S.wars.push(['fr','tr']);S.turn=5;ai();
  return {alliance:S.alliances,wars:S.wars};
 });
 expect(state.alliance).toEqual([['tr','gr']]);
 expect(state.wars.some(pair=>pair.includes('gr')&&pair.includes('fr'))).toBe(true);
});
test('mobile map search selects a country and focuses on its position',async({page})=>{
 await begin(page);
 await page.locator('#map-search').fill('Greece');
 await page.locator('#map-search').press('Enter');
 await expect(page.locator('#world [data-p="c300"].active')).toBeAttached();
 const state=await page.evaluate(()=>({zoom,px,py,selected:sel,transform:document.querySelector('#world').style.transform}));
 expect(state.selected).toBe('c300');
 expect(state.zoom).toBeGreaterThan(2);
 expect(state.transform).toContain('scale(6)');
});
