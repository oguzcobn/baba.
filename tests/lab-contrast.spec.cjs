const { test, expect } = require('@playwright/test');
const BASE = process.env.BABA_TEST_URL || 'http://127.0.0.1:4173/';
function rgb(v) { const a=v.match(/[\d.]+/g).slice(0,3).map(Number);return a;}
function luminance([r,g,b]) { const f=x=>x/255<=.04045?x/255/12.92:((x/255+.055)/1.055)**2.4; return .2126*f(r)+.7152*f(g)+.0722*f(b);}
function contrast(a,b) { const l1=luminance(rgb(a)),l2=luminance(rgb(b));return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); }
test('LAB AI Studio headers and catalog card titles have readable colors',async ({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));
  await page.goto(BASE+'#lab');
  const studio=page.locator('.baba-ai-workspace');
  await expect(studio).toBeVisible();
  const head=studio.locator('h2').first();
  const colors=await head.evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.baba-ai-workspace')).backgroundColor}));
  expect(contrast(colors.fg,colors.bg)).toBeGreaterThanOrEqual(7);
  const descriptions=await studio.locator('.baba-ai-head p:not(.eyebrow)').first().evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.baba-ai-workspace')).backgroundColor}));
  expect(contrast(descriptions.fg,descriptions.bg)).toBeGreaterThanOrEqual(4.5);
  const card=page.locator('.bb-open-tool').first();
  await expect(card).toBeVisible();
  const cardColor=await card.locator('h4').evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.bb-open-tool')).backgroundColor}));
  expect(contrast(cardColor.fg,cardColor.bg)).toBeGreaterThanOrEqual(7);
});
