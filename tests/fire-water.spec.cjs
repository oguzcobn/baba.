const { test, expect } = require('@playwright/test');
const BASE = process.env.BABA_TEST_URL || 'http://127.0.0.1:4173/';

test.describe('Fire and Water playable level redesign', () => {
  test.use({ viewport: { width: 960, height: 600 } });

  test('five levels start and display guiding hints, without runtime errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE + 'games/ates-ve-su/index.html');
    await expect(page.locator('#menuOv')).toBeVisible();
    await expect(page.locator('#lvlGrid button')).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-li="' + i + '"]').click();
      await page.locator('#playBtn').click();
      await expect(page.locator('#hud')).toBeVisible();
      await expect(page.locator('#lvlPill')).toContainText('BÖLÜM ' + (i+1));
      await expect(page.locator('#gameHint')).toContainText('🧭');
      await expect(page.locator('#deathPill')).toContainText('0 düşüş');
      await page.waitForTimeout(120);
      await expect(page.locator('#endOv')).toBeHidden();
      await page.locator('#menuBtn').click();
      await expect(page.locator('#menuOv')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('mobile controls switch characters without hiding playfield', async ({ page }) => {
    await page.setViewportSize({width: 667,height:375});
    await page.goto(BASE + 'games/ates-ve-su/index.html');
    await page.locator('#playBtn').click();
    const selector = page.locator('#swCharBtn');
    await expect(selector).toContainText('ATEŞ');
    await selector.click();
    await expect(selector).toContainText('SU');
    await expect(page.locator('#cv')).toBeVisible();
    await page.locator('[data-k="jump"]').dispatchEvent('pointerdown',{pointerType:'touch'});
    await page.locator('[data-k="jump"]').dispatchEvent('pointerup',{pointerType:'touch'});
    await expect(page.locator('#hud')).toBeVisible();
  });
});
