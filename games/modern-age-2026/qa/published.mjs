import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const base = 'https://oguzcobn.github.io/baba./games/modern-age-2026/';
const expected = await readFile(new URL('../renderer-three.js', import.meta.url), 'utf8');
let published = false;
for (let i = 0; i < 30; i++) {
  try {
    const response = await fetch(base+'renderer-three.js?release='+Date.now(), {signal:AbortSignal.timeout(8000)});
    published = response.ok && await response.text() === expected;
  } catch {}
  if (published) break;
  await delay(6000);
}
assert.ok(published,'Published renderer must match the tested source');
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage();
  await page.goto(base+'index.html?release='+Date.now());
  await page.click('#new');
  await page.waitForFunction(()=>window.__MA?.renderer?.drawCount>2 && __MA.metrics.skinnedPeople>0);
  assert.equal(await page.locator('#gfx,#menugfx').count(),0);
  console.log('Live game verified',page.url(),await page.title());
} finally {await browser.close();}
