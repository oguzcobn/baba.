// Damen Tersane Tycoon: sözdizimi, 8 model ailesi, deniz denemesi giriş/çıkış, İK işe alım, müşteri yolculuğu,
// kayıt/yeniden yükleme/migration ve mobil görünüm.
const { test, expect } = require('@playwright/test');
const BASE = 'http://127.0.0.1:4173/games/dsan-shipyard/index.html?q=low'; // yazılım GL'de hızlı kalmak için düşük kalite
test.use({ launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
test.beforeEach(() => test.setTimeout(120000));

async function open(page, { keep } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  if (!keep) await page.addInitScript(() => { if (!sessionStorage.getItem('dsan-test')) { localStorage.clear(); sessionStorage.setItem('dsan-test', '1'); } });
  await page.goto(BASE);
  await page.waitForFunction(() => window.DSAN && typeof state === 'object' && document.getElementById('docksDetailedContainer').children.length > 0);
  await page.evaluate(() => { state.speed = 0; });
  return errors;
}

test('loads with local Three.js/Tailwind, 16 roles and a first client visit', async ({ page }) => {
  const external = [];
  page.on('request', r => { if (/cdn\.tailwindcss|cdnjs\.cloudflare/.test(r.url())) external.push(r.url()); });
  const errors = await open(page);
  const info = await page.evaluate(() => ({ three: THREE.REVISION, roles: Object.keys(ROLE_DEFINITIONS).length, sv: state.saveVersion, visits: state.customers.visits.length, blueprints: VESSEL_BLUEPRINTS.map(b => b.id) }));
  expect(info.three).toBe('128');
  expect(info.roles).toBe(16);
  expect(info.sv).toBe(3);
  expect(info.visits).toBeGreaterThan(0);
  expect(info.blueprints).toEqual(['work_pilot_15', 'work_tug_24', 'work_osv_34', 'work_sar_46', 'yacht_sport_18', 'yacht_fly_28', 'yacht_explorer_42', 'yacht_mega_62']);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('eight blueprints map to eight distinct model families that grow from blocks', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => VESSEL_BLUEPRINTS.map(bp => {
    const count = pct => { const g = DSAN.vessels.build(bp, pct); let n = 0; g.traverse(o => { if (o.isMesh) n++; }); const fam = g.userData.family, painted = g.userData.painted; DSAN.vessels.dispose(g); return { n, fam, painted }; };
    const a = count(5), b = count(40), c = count(100);
    return { id: bp.id, fam: c.fam, grows: a.n < b.n && b.n < c.n, primer: !b.painted, painted: c.painted };
  }));
  expect(new Set(r.map(x => x.fam)).size).toBe(8);
  r.forEach(x => { expect(x.grows, x.id).toBe(true); expect(x.primer, x.id).toBe(true); expect(x.painted, x.id).toBe(true); });
});

test('sea trial: cinematic opens, pauses, Esc exits without report, skip produces a vessel-specific report', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await open(page);
  await page.evaluate(() => { const bp = getBlueprint('work_sar_46'); state.completedFleet.unshift({ uid: 'v_spec', blueprintId: bp.id, customName: 'Spec Twin-Axe', modelName: bp.name, category: bp.category, length: bp.length, qualityScore: 90, investedCost: bp.materialCost, marketOffer: bp.basePrice, negotiated: false, trial: null }); switchTab('showroom'); });
  const btn = page.locator('[data-action=sea-trial][data-uid=v_spec]');
  await btn.click();
  await expect(page.locator('.dz-trial')).toBeVisible();
  await page.locator('.dz-trial [data-c=pause]').click();
  expect(await page.evaluate(() => DSAN.seaTrial._debug.paused)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dz-trial')).toHaveCount(0);
  expect(await page.evaluate(() => ({ t: state.trials.length, a: DSAN.seaTrial.active }))).toEqual({ t: 0, a: false });
  await btn.click();
  await expect(page.locator('.dz-trial')).toBeVisible();
  await page.locator('.dz-trial [data-c=next]').click();
  await page.locator('.dz-trial [data-c=skip]').click();
  await expect(page.locator('.dz-report')).toBeVisible();
  const rep = await page.evaluate(() => state.completedFleet[0].trial);
  expect(rep.overall).toBeGreaterThan(30);
  expect(rep.metrics.top).toBeGreaterThan(20); // Twin-Axe ~28 kn
  expect(rep.comments.length).toBe(3);
  expect(errors).toEqual([]);
});

test('HR interview hires a candidate with role and skills; names are editable and saved', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => switchTab('workers'));
  const n0 = await page.evaluate(() => state.workers.length);
  await page.locator('[data-action=interview-candidate]:not([disabled])').first().click();
  await expect(page.locator('.dz-story')).toBeVisible();
  for (let i = 0; i < 12 && await page.locator('.dz-story [data-ch]').count(); i++) {
    if (await page.locator('.dz-offer').count()) await page.locator('.dz-offer [data-w]').evaluate(e => { e.value = e.max; e.dispatchEvent(new Event('input')); });
    await page.locator('.dz-story [data-ch]').first().click();
  }
  const hist = await page.evaluate(() => state.hr.history[0]);
  expect(['hired', 'declined']).toContain(hist.result);
  if (hist.result === 'hired') {
    const w = await page.evaluate(() => state.workers[state.workers.length - 1]);
    expect(await page.evaluate(() => state.workers.length)).toBe(n0 + 1);
    expect(w.skills.length).toBeGreaterThan(0);
    expect(Object.keys(await page.evaluate(() => ROLE_DEFINITIONS))).toContain(w.role);
  }
  const id = await page.evaluate(() => state.workers[0].id);
  await page.locator(`[data-action=rename-worker][data-wid="${id}"]`).click();
  await page.locator('.dz-form input').fill('Deniz <i>Usta</i>');
  await page.locator('.dz-form .pri').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dsan_3d_tycoon_save_v2')).workers[0].name)).toBe('Deniz <i>Usta</i>');
  await expect(page.locator('#workersRosterGrid h4').first()).toContainText('Deniz <i>Usta</i>');
  expect(errors).toEqual([]);
});

test('client journey: transfer → hotel → tour → meeting → trial → decision ends in a sale or a cancellation', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await open(page);
  await page.evaluate(() => switchTab('customers'));
  const before = await page.evaluate(() => ({ c: state.contracts.length, cash: state.cash }));
  await page.locator('[data-action=cx-run]').first().click();
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.dz-decision').count()) break;
    if (await page.locator('[data-t=skip]').count()) { await page.locator('[data-t=skip]').click(); continue; }
    const ch = page.locator('.dz-story [data-ch]:not([disabled])');
    if (await ch.count()) await ch.first().click(); else await page.waitForTimeout(150);
  }
  await expect(page.locator('.dz-decision')).toBeVisible();
  await expect(page.locator('.dz-ctab tbody tr')).toHaveCount(11); // açıklanabilir bileşenler
  await page.locator('.dz-decision [data-d]').first().click();
  const out = await page.evaluate(() => ({ won: state.customers.won, lost: state.customers.lost, c: state.contracts.length, last: state.contracts[state.contracts.length - 1] }));
  expect(out.won + out.lost).toBe(1);
  if (out.won) expect(out.c === before.c + 1 || out.c === before.c).toBe(true);
  // İptal eşiği
  await page.evaluate(() => { const v = DSAN.customers.create(state, { now: true, persona: 'owner' }); Object.keys(DSAN.customers.PERSONAS.owner.w).forEach(k => { v.comps[k] = 25; }); v.stage = 'decision'; DSAN.customers.run(state, v.id); });
  await expect(page.locator('.dz-verdict.cancel')).toBeVisible();
  await page.locator('.dz-decision [data-d=close]').click();
  expect(await page.evaluate(() => state.customers.history[0].result)).toBe('cancel');
  expect(errors).toEqual([]);
});

test('v2 save migrates to v3 with a backup, and progress survives reload', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => { const s = createInitialState(); delete s.saveVersion; delete s.customers; delete s.hr; s.cash = 777777; s.day = 9; s.workers.forEach(w => { delete w.skills; }); localStorage.clear(); localStorage.setItem('dsan_3d_tycoon_save_v2', JSON.stringify(s)); });
  await page.reload();
  await page.waitForFunction(() => typeof state === 'object' && state.saveVersion === 3);
  const m = await page.evaluate(() => ({ cash: state.cash, day: state.day, backup: JSON.parse(localStorage.getItem('dsan_3d_tycoon_save_v2_backup_pre_v3')).cash, skills: state.workers.every(w => w.skills.length), cx: !!state.customers }));
  expect(m).toEqual({ cash: 777777, day: 9, backup: 777777, skills: true, cx: true });
  await page.evaluate(() => { state.customers.won = 4; saveGameSilent(); });
  await page.reload();
  await page.waitForFunction(() => typeof state === 'object' && state.saveVersion === 3);
  expect(await page.evaluate(() => state.customers.won)).toBe(4);
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('no horizontal overflow; story modal and trial controls fit the screen', async ({ page }) => {
    test.setTimeout(90000);
    const errors = await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.evaluate(() => switchTab('customers'));
    await page.locator('[data-action=cx-run]').first().click();
    const box = await page.locator('.dz-modal').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(391);
    await page.locator('.dz-x').click();
    await page.evaluate(() => { const bp = getBlueprint('work_pilot_15'); state.completedFleet.unshift({ uid: 'v_mob', blueprintId: bp.id, customName: 'Mob IC', modelName: bp.name, category: bp.category, length: bp.length, qualityScore: 88, investedCost: 1, marketOffer: bp.basePrice, negotiated: false, trial: null }); switchTab('showroom'); });
    await page.locator('[data-action=sea-trial][data-uid=v_mob]').click();
    for (const b of await page.locator('.dz-tr-btns button').all()) { const r = await b.boundingBox(); expect(r.height).toBeGreaterThanOrEqual(44); expect(r.x + r.width).toBeLessThanOrEqual(391); }
    await page.locator('.dz-tr-btns [data-c=exit]').click();
    await expect(page.locator('.dz-trial')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
