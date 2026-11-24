import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameClock } from '../core/Clock.js';
import { PhysicsEngine, FIXED_DT, WATER_DENSITY, GRAVITY } from '../physics/PhysicsEngine.js';
import { EconomyEngine } from '../gameplay/EconomyEngine.js';
import { DecorationSystem } from '../gameplay/DecorationSystem.js';
import { FacilitySystem } from '../gameplay/FacilitySystem.js';
import { CanalTourSystem } from '../gameplay/CanalTourSystem.js';
import { NavigationAStar } from '../characters/NavigationAStar.js';
import { computeAnthropometry, evaluateGaitKinematics } from '../characters/HumanBiomechanics.js';

const results = [];
function test(name, fn) {
  const t0 = performance.now();
  try {
    fn();
    results.push({ name, status: 'PASS', ms: +(performance.now() - t0).toFixed(3) });
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message, ms: +(performance.now() - t0).toFixed(3) });
  }
}

test('Astronomical Solar Elevation (Amsterdam 52.3676 N)', () => {
  const clock = new GameClock(12.5, 60);
  const noon = clock.getSolarAngles();
  assert.ok(noon.elevation > 0.4 && !noon.isNight, 'Noon sun must be above horizon');
  clock.timeOfDayHours = 2.0;
  const night = clock.getSolarAngles();
  assert.ok(night.isNight && night.elevation < 0, '2 AM must be night');
});

test('Physics AABB Circle Collision Resolution', () => {
  const phys = new PhysicsEngine();
  phys.addCollider('wall_1', -5, 5, -1, 0, 'building');
  const res = phys.resolveCircleAABB(0, 0.2, 0.5);
  assert.equal(res.collided, true);
  assert.ok(res.z >= 0.499, 'Player circle must be pushed outside wall');
});

test('Archimedes Boat Buoyancy & Hydrodynamic Drag Stability (300 steps)', () => {
  const phys = new PhysicsEngine();
  const boat = {
    x: 0, y: 0.4, z: 14, vx: 0, vy: 0, vz: 0,
    mass: 1800, waterplaneArea: 9.0, hullHeight: 0.9, draftOffset: 0.35,
    verticalDamping: 2600, dragCoeff: 0.42, frontalArea: 1.8, thrust: 650, heading: 0, roll: 0, pitch: 0
  };
  const waveFn = (x, z) => 0.02 * Math.sin(0.4 * x + 0.3 * z);
  let lastForces;
  for (let i = 0; i < 300; i++) {
    lastForces = phys.stepBoat(boat, waveFn, FIXED_DT);
    assert.ok(Number.isFinite(boat.y) && Number.isFinite(boat.vx), 'Boat state must stay finite');
  }
  const eqDiff = Math.abs(lastForces.F_buoyancy - lastForces.F_gravity) / lastForces.F_gravity;
  assert.ok(eqDiff < 0.05, `Boat must settle near Archimedes equilibrium, diff=${eqDiff}`);
  assert.ok(boat.vx > 0.5 && boat.vx < 3.5, `Terminal velocity under quadratic drag must be realistic, vx=${boat.vx}`);
});

test('Economy Invariants: Zero Negative Stock, No Duplicate Tx, Exact Profit Formula', () => {
  const econ = new EconomyEngine(1000);
  const s1 = econ.sellItem('tulip_reserve', 2, 'tx_001');
  assert.equal(s1.ok, true);
  const dup = econ.sellItem('tulip_reserve', 2, 'tx_001');
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'DUPLICATE_TX');
  const over = econ.sellItem('tulip_reserve', 999, 'tx_002');
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'INSUFFICIENT_STOCK');
  const snap = econ.settleDailyFixedCosts(1);
  const expectedProfit = +(snap.revenue - snap.stockCost - snap.staffCost - snap.rent - snap.energy - snap.tax - snap.maintenance).toFixed(2);
  assert.equal(snap.profit, expectedProfit);
});

test('Decoration System: Grid Snap, Collision Rejection, Undo Cash Refund', () => {
  const econ = new EconomyEngine(1000);
  const dec = new DecorationSystem();
  const p1 = dec.place('sofa', 0.12, -5.18, 0, econ);
  assert.equal(p1.ok, true);
  assert.equal(p1.item.x, 0.0);
  assert.equal(p1.item.z, -5.0);
  const col = dec.place('table', 0.1, -5.0, 0, econ);
  assert.equal(col.ok, false);
  assert.equal(col.reason, 'COLLISION');
  const undo = dec.undo(econ);
  assert.equal(undo.ok, true);
  assert.equal(econ.cash, 1000);
});

test('A* Navigation Pathfinding Around Obstacle', () => {
  const nav = new NavigationAStar(40, 30, 1.0, -20, -15);
  nav.setBlockedRect(-2, 2, -2, 2, 1);
  const path = nav.findPath(-6, 0, 6, 0);
  assert.ok(path.length > 5, 'Valid path around obstacle must be found');
  for (const pt of path) {
    assert.ok(!(pt.x > -1.5 && pt.x < 1.5 && pt.z > -1.5 && pt.z < 1.5), 'Path must not cross blocked obstacle');
  }
});

test('Facility Production & Canal Tour Weather Cancellation', () => {
  const econ = new EconomyEngine(1500);
  const fac = new FacilitySystem();
  const beforeStock = econ.catalog[0].stock;
  const prod = fac.tick(20, econ);
  assert.ok(prod && econ.catalog[0].stock === beforeStock + fac.capacityPerBatch);

  const tour = new CanalTourSystem();
  const rainRes = tour.bookTour('Sunset', 'Rain', econ);
  assert.equal(rainRes.ok, false);
  assert.equal(rainRes.reason, 'WEATHER_CANCELLED');
  const okRes = tour.bookTour('Sunset', 'Clear', econ);
  assert.equal(okRes.ok, true);
  const done = tour.tick(30, 'Clear', econ);
  assert.equal(done.status, 'COMPLETED');
});


test('Winter Anthropometry Segment Sum & Biomechanical Gait Knee Clearance', () => {
  const anth = computeAnthropometry(1.80, 'M');
  const sum = anth.ankleY + anth.shankLen + anth.thighLen + anth.torsoLen + anth.headLen;
  assert.ok(Math.abs(sum - 1.80) < 1e-6, 'Segments must sum exactly to stature');
  let maxKnee = 0;
  for (let i = 0; i < 64; i++) {
    const g = evaluateGaitKinematics((i / 64) * Math.PI * 2, 1.45, 1.80);
    assert.ok(g.left.kneeFlex >= 0, 'Knee cannot hyperextend');
    maxKnee = Math.max(maxKnee, g.left.kneeFlex);
  }
  assert.ok(maxKnee > 0.90, 'Swing phase knee flexion must exceed ~52 deg for toe clearance');
});


test('Business Math: Dutch 9%/21% BTW, Price Elasticity, M/M/c Queueing, EOQ/ROP & RevPASH', () => {
  const econ = new EconomyEngine(2000);
  // 9% Cafe BTW (9/109) vs 21% Botanical BTW (21/121)
  const cafeSale = econ.sellItem('mint_tea', 1, 'btw_cafe_1');
  assert.ok(Math.abs(cafeSale.tax - +(4.5 * 9 / 109).toFixed(2)) < 0.02);
  const botSale = econ.sellItem('canal_haze', 1, 'btw_bot_1');
  assert.ok(Math.abs(botSale.tax - +(14 * 21 / 121).toFixed(2)) < 0.02);

  // Price elasticity: higher price reduces demand
  econ.priceMultiplier = 1.25;
  assert.ok(econ.computeElasticityFactor(econ.catalog[3]) < 0.80);

  // M/M/c stability & Little's Law L = lambda * W
  const q = econ.computeQueueMetrics(9, 12);
  assert.equal(q.stable, true);
  assert.ok(Math.abs(q.avgInSystemL - +(9 * (q.waitMinutes / 60)).toFixed(2)) < 0.05);

  // EOQ & ROP positive bounds + RevPASH
  const pol = econ.computeInventoryPolicy(econ.catalog[0]);
  assert.ok(pol.eoq >= 6 && pol.rop >= 4);
  const kpi = econ.computeKPIs();
  assert.ok(kpi.breakEvenRevenue > 0 && kpi.revPASH >= 0);
});

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const out = { total: results.length, passed, failed, timestamp: new Date().toISOString(), results };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(__dirname, '../../reports/test_results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
if (failed > 0) process.exit(1);
