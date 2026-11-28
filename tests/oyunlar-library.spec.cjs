const { test, expect } = require('@playwright/test');
const BASE = process.env.BABA_TEST_URL || 'http://127.0.0.1:4173/';
const IDS=["iki-milyarin-golgesi","sisli-yokus","solstice-swell","kar","modern-age-2026","ambermere","element","subterra","hayat-oyunu","futbol","career","draft","istiklal1919","vadi","runaway-cheese","sis-hatti","living-island","koy","surus","pelagos","serpentia","yasam","akvaryum","dune","mudafi","mete-cubugu","kartal","astra-orbit","operasyon-hatti","simitci","yelken","geko-bahcesi","lanternlight","yayla-savunmasi","amsterdam-coffeeshop","kafa-topu","age-of-war","gunblood","warfare-1917","the-waitress","fancy-pants-3","territory-war","electric-man-2","wild-ones-world","yilan-arenasi","gta-vice-city","tekken-3","hungry-shark","rota-conference","dsan-shipyard","2048","sudoku","mines","blocks"];
const SVG = new Set(["solstice-swell","kar","ambermere","element","surus","living-island","age-of-war","gunblood","warfare-1917","the-waitress","fancy-pants-3","territory-war","electric-man-2","wild-ones-world","rota-conference","runaway-cheese","sis-hatti"]);
for (const vp of [{width:1440,height:900},{width:390,height:844}]) test.describe(`Oyun kütüphanesi ${vp.width}`, () => {
  test.use({viewport:vp});
  test('hero, kapaklar, filtre, arama, vitrin ve son oynanan', async ({page}) => {
    const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.addInitScript(() => sessionStorage.setItem('baba_ok','1'));
    await page.goto(BASE+'#oyunlar');
    await expect(page.locator('.lb-hero')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/lib-mode/);
    await expect(page.locator('.lb-vid')).toHaveAttribute('src',/media\/oyunlar-hero-(1080|720)\.mp4/);
    await expect(page.locator('.lb-card')).toHaveCount(IDS.length);
    for (const id of IDS) await expect(page.locator(`[data-game-cover="${id}"] img`)).toHaveAttribute('src',`img/library/${id}-1280.${SVG.has(id)?'svg':'webp'}`);
    const broken = await page.evaluate(async()=>{const imgs=[...document.querySelectorAll('.lb-card img')];await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));return imgs.filter(i=>!i.naturalWidth).map(i=>i.src);});
    expect(broken).toEqual([]);
    await expect(page.locator('.lb-card[data-cat="web"]:not(.lb-hide)')).toHaveCount(0);
    await expect(page.locator('.lb-slide a[href="#age-of-war"]')).toHaveCount(0);
    await page.locator('.lb-filters button[data-cat="web"]').click();
    await expect(page.locator('.lb-card:not(.lb-hide)')).toHaveCount(8);
    await expect(page.locator('.lb-card[data-id="tekken-3"]')).toBeVisible();
    await page.locator('.lb-filters button[data-cat="puz"]').click();
    await expect(page.locator('.lb-card:not(.lb-hide)')).toHaveCount(3);
    await expect(page.locator('.lb-count b')).toHaveText('3');
    await page.locator('.lb-filters button[data-cat="all"]').click();
    await page.locator('.lb-search input').fill('tersane');
    await expect(page.locator('.lb-card:not(.lb-hide)')).toHaveCount(1);
    await page.locator('.lb-search input').fill('');
    await page.locator('[data-f=next]').click();
    await expect(page.locator('.lb-slide.on')).toHaveAttribute('data-k','1');
    const ov = await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(ov).toBeLessThanOrEqual(1);
    await page.goto(BASE+'#sudoku'); await page.goto(BASE+'#oyunlar');
    await expect(page.locator('.lb-continue, .lb-ctas .lb-btn.pri').first()).toBeVisible();
    await expect(page.locator('.lb-ctas .lb-btn.pri')).toHaveAttribute('href','#sudoku');
    await page.goto(BASE+'#today');
    await expect(page.locator('body')).not.toHaveClass(/lib-mode/);
    expect(errs).toEqual([]);
  });
});


test('Removed imports are absent from the public catalogue', async ({page}) => {
  await page.goto(BASE+'#oyunlar');
  for (const id of ["offroad","velocity-rush","threejs-fish-tank","empires-of-the-ages","nordschleife-racer","ai-town"]) await expect(page.locator('.lb-card[data-id="'+id+'"]')).toHaveCount(0);
});
