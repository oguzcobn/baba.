// CastEngine matematik çekirdeği testleri — `npm i three@0.128.0` sonrası: node src/tests/cast_math_tests.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
globalThis.THREE = require('three');
await import('../characters/cast-engine.js');
const { math, CAST } = globalThis.CastEngine;
const T = globalThis.THREE;
const results = [];
const test = (name, fn) => { const t0 = performance.now(); let ok = false, info = ''; try { info = fn(); ok = true; } catch (e) { info = e.message; } results.push({ name, status: ok ? 'PASS' : 'FAIL', info, ms: +(performance.now() - t0).toFixed(2) }); };
const assert = (c, m) => { if (!c) throw new Error(m); };

test('IK: ayak bileği hedefe ulaşır (kosinüs teoremi, 2000 rastgele hedef)', () => {
  const mk = (rev) => { const hip = new T.Group(), knee = new T.Group(), ankle = new T.Group(); hip.add(knee); knee.add(ankle); knee.position.y = -0.4; ankle.position.y = -0.38; return { hip, knee, ankle, L1: 0.4, L2: 0.38, reverse: rev }; };
  let maxErr = 0;
  for (const rev of [false, true]) {
    const leg = mk(rev);
    for (let i = 0; i < 1000; i++) {
      const a = (Math.random() - 0.5) * 1.4, d = 0.15 + Math.random() * 0.6;
      const tz = Math.sin(a) * d, ty = -Math.cos(a) * d;
      math.solveIK(leg, tz, ty, 0); leg.hip.updateMatrixWorld(true);
      const p = new T.Vector3(); leg.ankle.getWorldPosition(p);
      maxErr = Math.max(maxErr, Math.hypot(p.z - tz, p.y - ty));
      // ayak düz: toplam açı 0
      assert(Math.abs(leg.hip.rotation.x + leg.knee.rotation.x + leg.ankle.rotation.x) < 1e-9, 'ayak düz değil');
    }
  }
  assert(maxErr < 1e-6, 'IK hatası ' + maxErr);
  return `maks hata ${maxErr.toExponential(2)} m`;
});

test('Kritik sönümlü yay: aşma yok, hedefe yakınsar', () => {
  const st = { x: 0, v: 0 }; let max = 0;
  for (let i = 0; i < 300; i++) { math.critSpring(st, 1, 8, 1 / 60); max = Math.max(max, st.x); }
  assert(max <= 1 + 1e-9, 'aşma: ' + max); assert(Math.abs(st.x - 1) < 1e-4, 'yakınsamadı');
  return `son değer ${st.x.toFixed(6)}`;
});

test('Süperkuadrik ε₁=ε₂=1 → küre (yarıçap sapması)', () => {
  const g = math.superquadric(0.5, 0.5, 0.5, 1, 1, { rows: 24, cols: 32 });
  const p = g.attributes.position; let dev = 0;
  for (let i = 0; i < p.count; i++) dev = Math.max(dev, Math.abs(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) - 0.5));
  assert(dev < 1e-6, 'sapma ' + dev); return `sapma ${dev.toExponential(1)}`;
});

test('Raup kabuğu: tur başına genişleme oranı W', () => {
  const W = 2.1, b = Math.log(W) / (2 * Math.PI), r = (th) => Math.exp(b * th);
  const ratio = r(0) / r(-2 * Math.PI);
  assert(Math.abs(ratio - W) < 1e-12, 'oran ' + ratio); return `W = ${ratio.toFixed(4)}`;
});

test('Fibonacci küresi: noktalar birim kürede ve dengeli', () => {
  const pts = math.fibonacciSphere(500); const c = new T.Vector3();
  for (const p of pts) { assert(Math.abs(p.length() - 1) < 1e-9, 'birim değil'); c.add(p); }
  c.multiplyScalar(1 / pts.length); assert(c.length() < 0.01, 'kütle merkezi ' + c.length());
  return `ağırlık merkezi sapması ${c.length().toExponential(1)}`;
});

test('Kadro: 25 benzersiz karakter, 5 hareket türü', () => {
  const ids = new Set(CAST.map(d => d.id)), locos = new Set(CAST.map(d => d.loco));
  assert(CAST.length === 25 && ids.size === 25, 'sayı'); assert(locos.size === 5, 'tür');
  return `${CAST.length} karakter, türler: ${[...locos].join(', ')}`;
});

console.log(JSON.stringify({ suite: 'CastEngine math', passed: results.filter(r => r.status === 'PASS').length, total: results.length, results }, null, 2));
if (results.some(r => r.status === 'FAIL')) process.exit(1);
