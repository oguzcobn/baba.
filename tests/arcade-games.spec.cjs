const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';

test('Fire and Water is removed from BABA library and retired route redirects',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));
  await page.goto(BASE+'#oyunlar');
  await expect(page.locator('[data-game-cover="ates-ve-su"]')).toHaveCount(0);
  await expect(page.locator('.lb-slide[data-k="ates-ve-su"]')).toHaveCount(0);
  await page.goto(BASE+'#ates-ve-su');
  await expect(page).toHaveURL(/#oyunlar$/);
});

test('Slitherio initializes immediately and one click starts an arena with multiple bot types',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(BASE+'games/yilan-arenasi/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-snake-ready','true');
  await expect(page.locator('.skin-btn')).toHaveCount(8);
  await expect(page.locator('#difficultySelector button')).toHaveCount(3);
  await page.locator('[data-diff="easy"]').click();
  await expect(page.locator('[data-diff="easy"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#playBtn').click();
  await expect(page.locator('#menuOv')).toHaveClass(/hidden/);
  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
  await expect(page.locator('#lenVal')).not.toBeEmpty();
  const metrics=await page.evaluate(()=>{
    const source=[...document.scripts].map(x=>x.textContent||'').join('\n');
    return ['toplayici','avci','kapan','kacak','dengeci','avoidDanger','huntSmaller','riskyTurn'].map(v=>source.includes(v));
  });
  expect(metrics.every(Boolean)).toBe(true);
  await page.waitForTimeout(1800);
  await expect(page.locator('#menuOv')).toHaveClass(/hidden/);
  expect(errs).toEqual([]);
});

test('Kafa Topu renders multi-part athletes and starts without browser errors',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(BASE+'games/kafa-topu/index.html');
  await page.locator('#startBtn').click();
  await expect(page.locator('#menuOv')).toHaveClass(/hidden/);
  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
  const data=await page.locator('#cv').evaluate(c=>{
    const ctx=c.getContext('2d');if(!ctx)return null;
    const pixels=ctx.getImageData(0,0,Math.min(200,c.width),Math.min(200,c.height)).data;
    return pixels.some((v,i)=>i%4===3&&v>0);
  });
  expect(data).toBeTruthy();
  expect(errs).toEqual([]);
});