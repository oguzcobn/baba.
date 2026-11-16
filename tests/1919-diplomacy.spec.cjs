const { test, expect } = require('@playwright/test');
const BASE = process.env.BABA_TEST_URL || 'http://127.0.0.1:4173/';
test.describe('1919 world map diplomacy and army actions', () => {
  test.use({viewport:{width:390,height:844}});
  test.beforeEach(async({page}) => {
    await page.goto(BASE+'games/1919/age.html', {waitUntil:'domcontentloaded'});
    await expect(page.locator('[data-a="nations"]')).toBeVisible({timeout:30000});
    await page.locator('[data-a="nations"]').click();
    await expect(page.locator('[data-n="tr"]')).toBeVisible();
    await page.locator('[data-n="tr"]').click();
    await expect(page.locator('#world [data-p="c300"]')).toBeAttached({timeout:15000});
  });
  const select = async (page,id) => {
    await page.locator('#world [data-p="'+id+'"]').dispatchEvent('click');
  };
  test('diplomacy only shows the selected target and switches on map selection',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await select(page,'c300'); // Greece
    await page.locator('.sidebody [data-tab="diplomacy"]').click();
    await expect(page.locator('.dip-target[data-country="gr"]')).toBeVisible();
    await expect(page.locator('.sidebody [data-d]')).toHaveCount(4);
    await expect(page.locator('.sidebody [data-d="war:fr"]')).toHaveCount(0);
    await select(page,'c250'); // France
    await expect(page.locator('.dip-target[data-country="fr"]')).toBeVisible();
    await expect(page.locator('.sidebody [data-d]')).toHaveCount(4);
    await expect(page.locator('.sidebody [data-d="war:gr"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
  test('the army dialog opens diplomacy for its actual destination and closes',async({page})=>{
    await select(page,'c792'); // player's Turkish province
    await page.locator('.bottom [data-a="move"]').click();
    await expect(page.locator('.bottom [data-a="cancelmove"]')).toBeVisible();
    await select(page,'c300');
    await expect(page.locator('.modalbg [data-modal="dip"]')).toBeVisible();
    await page.locator('.modalbg [data-modal="dip"]').click();
    await expect(page.locator('.modalbg')).toHaveCount(0);
    await expect(page.locator('.dip-target[data-country="gr"]')).toBeVisible();
    page.once('dialog',d=>d.accept());
    await page.locator('.dip-target [data-d="war:gr"]').click();
    await expect(page.locator('.dip-target [data-d="peace:gr"]')).toBeVisible();
    await select(page,'c792');
    await page.locator('.tabs [data-tab="province"]').click();
    await page.locator('.bottom [data-a="move"]').click();
    await select(page,'c300');
    await expect(page.locator('.modalbg [data-modal="go"]')).toBeVisible();
    await page.locator('.modalbg [data-modal="cancel"]').click();
    await expect(page.locator('.modalbg')).toHaveCount(0);
    await expect(page.locator('.bottom [data-a="cancelmove"]')).toHaveCount(0);
  });
  test('army order is applied after declaring war on the selected country',async({page})=>{
    await select(page,'c300');
    await page.locator('.sidebody [data-tab="diplomacy"]').click();
    page.once('dialog',d=>d.accept());
    await page.locator('.dip-target [data-d="war:gr"]').click();
    await select(page,'c792');
    await page.locator('.tabs [data-tab="province"]').click();
    await page.locator('.bottom [data-a="move"]').click();
    await select(page,'c300');
    await expect(page.locator('.modalbg [data-modal="go"]')).toBeVisible();
    await page.locator('.modalbg [data-modal="go"]').click();
    await expect(page.locator('.modalbg')).toHaveCount(0);
    await expect.poll(async()=>page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('baba_1919_age_v1'));
      return !!s?.p?.find(p=>p.id==='c792')?.moved;
    }),{timeout:7000}).toBe(true);
    await expect(page.locator('.bottom [data-a="cancelmove"]')).toHaveCount(0);
  });
  test('cancel army target mode, no stale action after restarting campaign',async({page})=>{
    await page.locator('.bottom [data-a="move"]').click();
    await page.locator('.bottom [data-a="cancelmove"]').click();
    await expect(page.locator('.bottom [data-a="cancelmove"]')).toHaveCount(0);
    await page.locator('.top [data-a="menu"]').click();
    await expect(page.locator('[data-a="nations"]')).toBeVisible();
    await page.locator('[data-a="nations"]').click();
    await page.locator('[data-n="tr"]').click();
    await expect(page.locator('.bottom [data-a="move"]')).toBeEnabled();
  });
});
