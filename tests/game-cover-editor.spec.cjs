const { test, expect, devices } = require('@playwright/test');

const BASE = process.env.BABA_TEST_URL || 'http://127.0.0.1:4173/';
test.describe('Game cover gallery editor', () => {
  test.use({viewport:{width:390,height:844}});
  test('owner can upload, preview, persist, switch fit and restore on mobile', async ({page}) => {
    await page.addInitScript(() => sessionStorage.setItem('baba_ok','1'));
    await page.goto(BASE+'#oyunlar');
    const toggle = page.locator('#bbCoverEditToggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();
    await expect(page.locator('#bbCoverEditor')).toBeHidden();
    await toggle.click();
    await expect(page.locator('#bbCoverEditor')).toBeVisible();
    const row = page.locator('[data-bb-cover-row="hayat-oyunu"]');
    await expect(row.locator('[data-bb-cover-file]')).toBeAttached();
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8r+DAwMDAxMDAwMDAAAARXQFjhE1l/AAAAABJRU5ErkJggg==','base64');
    await row.locator('[data-bb-cover-file]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:tinyPng});
    await expect(row.locator('.bb-cover-editor-status')).toContainText('Kapak kaydedildi',{timeout:12000});
    const image=page.locator('[data-game-cover="hayat-oyunu"] img');
    await expect(image).toHaveAttribute('src',/^blob:/);
    await expect(image).toHaveCSS('object-fit','cover');
    await row.locator('[data-bb-cover-fit="contain"]').click();
    await expect(image).toHaveCSS('object-fit','contain');
    await page.reload();
    await expect(page.locator('[data-game-cover="hayat-oyunu"] img')).toHaveAttribute('src',/^blob:/);
    await page.locator('#bbCoverEditToggle').click();
    const updatedRow = page.locator('[data-bb-cover-row="hayat-oyunu"]');
    await expect(updatedRow.locator('[data-bb-cover-fit="contain"]')).toHaveAttribute('aria-pressed','true');
    await updatedRow.locator('[data-bb-cover-reset]').click();
    await expect(page.locator('[data-game-cover="hayat-oyunu"] img')).toHaveAttribute('src','img/library/hayat-oyunu-1280.webp');
    const dims = await page.evaluate(() => ({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
    expect(dims.s).toBeLessThanOrEqual(dims.w+3);
  });
  test('locked visitor never receives cover editor controls',async ({page}) => {
    await page.goto(BASE+'#oyunlar');
    await expect(page.locator('#bbCoverEditToggle')).toHaveCount(0);
    await expect(page.locator('#bbCoverEditor')).toHaveCount(0);
  });
});
