const { test, expect } = require('@playwright/test');
const BASE = process.env.BABA_TEST_URL || 'http://127.0.0.1:4173/';
const ids = ['age-of-war','gunblood','warfare-1917','the-waitress','fancy-pants-3','territory-war','electric-man-2','wild-ones-world'];

test('all eight imported arcade games appear in the BABA game library', async ({page}) => {
  await page.addInitScript(() => sessionStorage.setItem('baba_ok','1'));
  await page.goto(BASE + '#oyunlar');
  await expect(page.locator('.lb-card')).toHaveCount(24);
  for (const id of ids) {
    const card=page.locator('.lb-card[data-id="'+id+'"]');
    await expect(card).toHaveCount(1);
    await expect(card.locator('img')).toHaveAttribute('src','img/library/'+id+'-1280.svg');
    await expect(card).toHaveAttribute('href','#'+id);
    const cover=await card.locator('img').evaluate(async image=>{
      image.loading='eager';
      await image.decode().catch(()=>{});
      return image.naturalWidth;
    });
    expect(cover,'Broken cover: '+id).toBeGreaterThan(0);
  }
  await expect(page.locator('.lb-card[data-id="wild-ones"]')).toHaveCount(0);
  await expect(page.locator('.lb-card[data-id="ates-ve-su"]')).toHaveCount(0);
});

const flashSlugs = {
  'age-of-war': 'age-of-war',
  'warfare-1917': 'warfare-1917',
  'the-waitress': 'the-waitress',
  'fancy-pants-3': 'fancy-pants-adventure-3',
  'territory-war': 'territory-war',
  'electric-man-2': 'electric-man-2'
};

for (const [id, slug] of Object.entries(flashSlugs)) {
  test('arcade route links to Flash Games: '+id, async ({page})=>{
    const url = 'https://flash-games.io/'+slug;
    await page.route(url, route=>route.fulfill({body:'Flash Games'}));
    await page.addInitScript(() => sessionStorage.setItem('baba_ok','1'));
    await page.goto(BASE+'#'+id);
    await expect(page.locator('iframe')).toHaveAttribute('src',url);
    await expect(page.locator('a[target="_blank"][href="'+url+'"]')).toBeVisible();
  });
}

for (const id of ['gunblood','wild-ones-world']) {
  test('new arcade route loads and game is executable: '+id, async ({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));
    await page.goto(BASE+'#'+id);
    const frame=page.locator('iframe');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute('src',new RegExp('games/arcade/'+id+'\\.html'));
    const inner=frame.contentFrame();
    await expect(inner.locator('canvas')).toBeVisible();
    await expect(inner.locator('body')).toBeVisible();
    const start=inner.locator('#btn-start');
    if(await start.count() && await start.isVisible()) await start.click();
    await page.waitForTimeout(250);
    expect(errors).toEqual([]);
  });
}
