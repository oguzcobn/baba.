const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
test.use({viewport:{width:390,height:844}});
const start=async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'games/1919/age.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:30000});
 await page.locator('[data-a="nations"]').click();
 await page.locator('[data-n="tr"]').click();
 await expect(page.locator('#world [data-p="c792"]')).toBeAttached({timeout:12000});
 return errors;
};
const select=async(page,id)=>page.locator('#world [data-p="'+id+'"]').dispatchEvent('click');
test('country identifiers are unique and Türkiye only borders geographically relevant states',async({page})=>{
 const errors=await start(page);
 const result=await page.evaluate(()=>{
  const ids=S.p.map(p=>p.id);
  return {count:ids.length,unique:new Set(ids).size,missing:ids.filter(x=>x.includes('undefined')),neighbors:adj('c792').map(id=>prov(id).label),tr:N.tr,sa:N.c682,gb:N.gb};
 });
 expect(result.unique).toBe(result.count);
 expect(result.count).toBeGreaterThanOrEqual(230);
 expect(result.missing).toEqual([]);
 expect(result.neighbors.join(' ')).not.toMatch(/Somaliland|Somali|Pakistan|Keşmir/);
 expect(result.neighbors).toContain('Yunanistan');
 expect(result.tr[0]).toBe('Türkiye');expect(result.tr[4]).toBe('Ankara');
 expect(result.gb[4]).toBe('Londra');expect(result.sa[0]).toBe('Suudi Arabistan');
 expect(errors).toEqual([]);
});
test('SVG polygons do not jump across the world on dateline crossing rings',async({page})=>{
 await start(page);
 const measures=await page.evaluate(()=>{
  const paths=[...document.querySelectorAll('#world path.province')];
  let largestJump=0;
  for(const path of paths){
    const commands=path.getAttribute('d').match(/[ML][^MLZ]+/g)||[];
    let previous=null;
    for(const command of commands){
      const x=Number(command.slice(1).trim().split(/\s+/)[0]);
      if(command[0]==='M')previous=null;
      if(previous!==null)largestJump=Math.max(largestJump,Math.abs(x-previous));
      previous=x;
    }
  }
  return {largestJump,regions:paths.length,russiaD:document.querySelector('[data-p="c643"]')?.getAttribute('d')?.length};
 });
 expect(measures.regions).toBeGreaterThanOrEqual(230);
 expect(measures.russiaD).toBeGreaterThan(200);
 expect(measures.largestJump).toBeLessThan(650);
});
test('native confirm never opens: war confirmation uses in-game modal and unlocks army orders',async({page})=>{
 await start(page);
 const native=[];page.on('dialog',d=>{native.push(d.type());d.dismiss()});
 await select(page,'c300');await page.locator('.tabs [data-tab="diplomacy"]').click();
 await page.locator('[data-d="war:gr"]').click();
 await expect(page.locator('.modalbg [data-modal="confirm"]')).toBeVisible();
 await page.locator('.modalbg [data-modal="cancel"]').click();
 expect(await page.evaluate(()=>war('tr','gr'))).toBe(false);
 await page.locator('[data-d="war:gr"]').click();
 await page.locator('.modalbg [data-modal="confirm"]').click();
 expect(await page.evaluate(()=>war('tr','gr'))).toBe(true);
 await expect(page.locator('.dip-target [data-d="peace:gr"]')).toBeVisible();
 await select(page,'c792');await page.locator('.tabs [data-tab="province"]').click();
 await page.locator('.bottom [data-a="move"]').click();
 await select(page,'c300');
 await expect(page.locator('.modalbg [data-modal="go"]')).toBeVisible();
 await page.locator('.modalbg [data-modal="cancel"]').click();
 expect(native).toEqual([]);
});
test('foreign recruit is visibly disabled and own province is enabled',async({page})=>{
 await start(page);
 await select(page,'c300');
 await expect(page.locator('.bottom [data-a="recruit"]')).toBeDisabled();
 await expect(page.locator('.bottom [data-a="move"]')).toBeDisabled();
 await select(page,'c792');
 await expect(page.locator('.bottom [data-a="recruit"]')).toBeEnabled();
});
test('player income and stability are initially playable and manpower label is accurate',async({page})=>{
 await start(page);
 const initial=await page.evaluate(()=>({net:incomeOf(S.me)-Math.ceil(own().reduce((a,p)=>a+p.army,0)*.23),stability:S.stability}));
 expect(initial.net).toBeGreaterThanOrEqual(0);
 await expect(page.locator('.resources')).toContainText('İnsan Gücü');
 await page.locator('.bottom [data-a="end"]').click();
 const state=await page.evaluate(()=>({stability:S.stability,gold:S.gold}));
 expect(state.stability).toBeGreaterThanOrEqual(initial.stability);
 expect(state.gold).toBeGreaterThan(0);
});
test('sidebar scroll position survives a state-changing research action',async({page})=>{
 await start(page);
 await page.locator('.tabs [data-tab="nation"]').click();
 await page.locator('.sidebody [data-a="research"]').scrollIntoViewIfNeeded();
 const before=await page.locator('.sidebody').evaluate(el=>el.scrollTop);
 expect(before).toBeGreaterThan(60);
 await page.locator('.sidebody [data-a="research"]').click();
 const after=await page.locator('.sidebody').evaluate(el=>el.scrollTop);
 expect(Math.abs(after-before)).toBeLessThan(25);
});
test('zoom buttons and pinch allow deep country inspection',async({page})=>{
 await start(page);
 await page.locator('[data-a="plus"]').click();
 await page.locator('[data-a="plus"]').click();
 await page.locator('[data-a="plus"]').click();
 const first=await page.evaluate(()=>zoom);expect(first).toBeGreaterThan(4);
 await page.locator('[data-a="center"]').click();expect(await page.evaluate(()=>zoom)).toBe(1);
 const pinched=await page.evaluate(()=>{
  const vp=document.querySelector('#viewport');
  const fire=(name,id,x,y)=>vp.dispatchEvent(new PointerEvent(name,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch'}));
  fire('pointerdown',1,100,250);fire('pointerdown',2,180,250);
  fire('pointermove',2,330,250);fire('pointerup',2,330,250);fire('pointerup',1,100,250);
  return zoom;
 });
 expect(pinched).toBeGreaterThan(2.5);
});
test('responsive game contains bottom controls and retains a single game scroll area',async({page})=>{
 await start(page);
 const layout=await page.evaluate(()=>{
  const app=document.querySelector('#app'),end=document.querySelector('.bottom [data-a="end"]'),zoomer=document.querySelector('.zoom'),header=document.querySelector('.top');
  const r=end.getBoundingClientRect(),z=zoomer.getBoundingClientRect();
  return {height:app.clientHeight,scroll:app.scrollHeight,buttonBottom:r.bottom,zoomBottom:z.bottom,top:header.getBoundingClientRect().top,windowHeight:window.innerHeight};
 });
 expect(layout.scroll).toBeLessThanOrEqual(layout.height+3);
 expect(layout.buttonBottom).toBeLessThanOrEqual(layout.windowHeight);
 expect(layout.zoomBottom).toBeLessThanOrEqual(layout.windowHeight);
 expect(layout.top).toBeGreaterThanOrEqual(0);
});
test('nation search is Turkish, alphabetical after featured options and lists actual capitals',async({page})=>{
 await page.goto(BASE+'games/1919/age.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:30000});
 await page.locator('[data-a="nations"]').click();
 const first=await page.locator('[data-n]').first().getAttribute('data-n');expect(first).toBe('tr');
 await page.locator('#nation-filter').fill('Suudi');
 await expect(page.locator('[data-n]:visible')).toHaveCount(1);
 await expect(page.locator('[data-n="c682"]')).toContainText('Riyad');
 await page.locator('#nation-filter').fill('Londra');
 await expect(page.locator('[data-n]:visible')).toHaveCount(1);
 await expect(page.locator('[data-n="gb"]')).toContainText('Birleşik Krallık');
});
test('country markers and header controls are SVG; no missing-symbol boxes',async({page})=>{
 await start(page);
 expect(await page.locator('header.top button .ui-icon').count()).toBeGreaterThanOrEqual(4);
 expect(await page.locator('.resources .country-mark').count()).toBe(1);
 expect(await page.locator('.resources .ui-icon').count()).toBeGreaterThan(4);
 expect(await page.locator('body').innerText()).not.toContain('▯');
});
