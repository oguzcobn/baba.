// AKVARYUM. fizik çekirdeği doğrulaması: model çıktıları biyomekanik literatürdeki aralıklarda kalmalı.
const assert = require('node:assert/strict');
const P = require('../games/akvaryum/physics.js');
const { SP, ORDER } = require('../games/akvaryum/species.js');

const rows = [];
for (const k of ORDER) {
  const s = SP[k], M = P.morphology(s, s.TL), r = P.steady(s.Uc, M, s.mode);
  rows.push({ tür: k, mod: s.mode, 'U (BL/s)': s.Uc, 'f kuyruk (Hz)': +r.f.toFixed(2), 'f göğüs (Hz)': +r.fp.toFixed(2), St: +r.St.toFixed(2), 'adım/L': +r.stride.toFixed(2), Re: Math.round(r.Re), 'kütle (g)': +(M.mass * 1000).toFixed(2) });
  assert.ok(r.Re > 500 && r.Re < 5e5, `${k}: Reynolds sayısı laminer sınır tabaka varsayımıyla uyumlu olmalı (${r.Re})`);
  assert.ok(M.mass > 1e-4 && M.mass < 0.3, `${k}: kütle makul olmalı (${M.mass} kg)`);
  if (s.mode === 'lab') {
    // Labriform yüzücüler seyir hızında yalnız göğüs yüzgeciyle ilerler (kuyruk pasif)
    assert.equal(r.f, 0, `${k}: seyir hızında kuyruk kullanılmamalı`);
    assert.ok(r.fp > 0 && r.fp <= M.fpmax + 1e-9, `${k}: göğüs yüzgeci frekansı sınır içinde olmalı`);
    // Hız arttıkça göğüs–kuyruk yürüyüş geçişi olmalı
    const fast = P.steady(2.5, M, s.mode);
    assert.ok(fast.f > 0, `${k}: 2.5 BL/s'de kuyruk devreye girmeli`);
  } else {
    // Bainbridge (1958): her vuruşta 0.6–0.8 L; düşük hızlarda daha kısa adımlar normal
    assert.ok(r.stride > 0.4 && r.stride < 0.85, `${k}: adım/boy ${r.stride}`);
    // Taylor, Nudds & Thomas (2003): verimli seyir 0.2 < St < 0.4 (küçük sapma payı)
    assert.ok(r.St > 0.18 && r.St < 0.45, `${k}: Strouhal ${r.St}`);
    // Kayma oranı U/V < 1 olmalı (aksi halde Lighthill itmesi negatif)
    assert.ok(r.slip > 0.3 && r.slip < 1, `${k}: kayma oranı ${r.slip}`);
  }
}
console.table(rows);

// Frekans hızla artmalı, adım boyu yükselip doygunlaşmalı (Bainbridge)
{
  const s = SP.neon, M = P.morphology(s, s.TL);
  let prevF = 0, prevStride = 0;
  for (const u of [1, 2, 4, 6, 8]) {
    const r = P.steady(u, M, 'bcf');
    assert.ok(r.f > prevF, 'frekans hızla artmalı');
    assert.ok(r.stride >= prevStride - 1e-9, 'adım boyu azalmamalı');
    prevF = r.f; prevStride = r.stride;
  }
  assert.ok(prevStride < 0.85, 'en yüksek hızda adım boyu 0.85 L altında kalmalı');
}

// Lighthill ters çözümü tutarlı: thrust(omegaFor(F)) == F
{
  const s = SP.danyo, M = P.morphology(s, s.TL), U = 0.08, F = 2e-4;
  const w = P.omegaFor(F, U, M);
  assert.ok(Math.abs(P.thrust(w, U, M) - F) / F < 1e-9, 'Lighthill ters çözümü');
}

// Zaman integrasyonu: hedef hıza oturur, süzülmede hız azalır
{
  const s = SP.rasbora, M = P.morphology(s, s.TL), st = { U: 0 }, target = 1.6 * M.TL;
  for (let i = 0; i < 600; i++) P.stepSurge(st, M, target, 1 / 120, s.mode, 0.35);
  assert.ok(Math.abs(st.U - target) / target < 0.05, `hedef hıza oturmalı (${st.U} vs ${target})`);
  const U0 = st.U; let U = U0;
  for (let i = 0; i < 60; i++) U -= P.drag(U, M, false) / M.mEff / 120;
  assert.ok(U < U0 && U > 0.5 * U0, 'süzülmede 0.5 s içinde yavaşlamalı ama durmamalı');
  // süzülme sürüklenmesi salınım sürüklenmesinden düşük (Bone–Lighthill)
  assert.ok(P.drag(U0, M, false) < P.drag(U0, M, true), 'süzülürken sürüklenme daha düşük');
}

// Batan yem ve kabarcık son hızları gerçekçi aralıkta
{
  const flake = P.terminalVelocity(0.0015, 1030) * 100, pellet = P.terminalVelocity(0.0012, 1250) * 100, bub = P.bubbleVelocity(0.003) * 100;
  assert.ok(flake > 0.5 && flake < 4, `pul yem ${flake} cm/s`);
  assert.ok(pellet > 2 && pellet < 10, `granül ${pellet} cm/s`);
  assert.ok(bub > 15 && bub < 30, `3 mm kabarcık ${bub} cm/s`);
}
console.log('AKVARYUM fizik doğrulaması geçti');
