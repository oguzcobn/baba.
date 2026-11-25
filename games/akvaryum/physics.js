/* =====================================================================
   BABA. AKVARYUM — Balık yüzme fiziği (saf fonksiyonlar, tarayıcı + Node)
   ---------------------------------------------------------------------
   Kaynaklar (oyunda ve testlerde kullanılan modeller):
   • Gövde orta hattı:  h(x,t) = A(x)·sin(2π(x/λ − f t))
       karangiform zarf  A(x)/L = 0.02 − 0.0825·x + 0.1625·x²   (Videler; Khalid vd.)
       λ ≈ 1.0 L (karangiform), ≈ 0.9 L (subkarangiform)
   • İtme: Lighthill uzun gövde teorisi (EBT). Ortalama itme yalnızca kuyruk
       ucunun kinematiğine bağlıdır:
       T̄ = ½·mₐ·[ ⟨(∂h/∂t)²⟩ − U²⟨(∂h/∂x)²⟩ ]_kuyruk = ¼·mₐ·A²·(ω² − k²U²)
       mₐ = (π/4)·ρ·s²  (kuyruk ucu açıklığı s olan kesitin ek kütlesi)
   • Sürüklenme: D = ½ρU²·S·C_f·k_form·α
       C_f = 1.328/√Re  (Blasius laminer sınır tabaka; balıklarda Re < 5·10⁵)
       k_form = 1 + 1.5(d/L)^1.5 + 7(d/L)³  (Hoerner, dönel cisim biçim çarpanı)
       α = salınım sırasında sınır tabaka incelmesi (Bone–Lighthill), süzülürken 1
   • Göğüs yüzgeci (labriform, Blake 1979): sürüklenmeye dayalı kürek
       T_p = ½ρ·C_N·S_p·(v_f − U)²,  v_f = 0.75·R_p·Φ·ω_p/π
   • Batan yem: Schiller–Naumann direnç yasasıyla son hız
       C_d = 24/Re·(1 + 0.15·Re^0.687)
   ===================================================================== */
(function (root) {
  'use strict';
  const RHO = 997;            // kg/m³, 26 °C tatlı su
  const NU = 0.87e-6;         // m²/s, 26 °C kinematik viskozite
  const MU = RHO * NU;        // Pa·s
  const G = 9.81;

  // Thomsen yaklaşımı: elipsoit yüzey alanı (hata < %1.1)
  function ellipsoidArea(a, b, c) {
    const p = 1.6075;
    return 4 * Math.PI * Math.pow((Math.pow(a * b, p) + Math.pow(a * c, p) + Math.pow(b * c, p)) / 3, 1 / p);
  }

  /* Morfoloji: tür parametreleri + boy (cm) → SI büyüklükler */
  function morphology(sp, TLcm, opts) {
    opts = opts || {};
    const TL = TLcm / 100;                       // toplam boy (m)
    const SL = TL * (sp.slRatio || 0.82);        // standart boy (kuyruksuz gövde)
    const H = SL * sp.h, Wd = SL * (sp.w || 0.14);
    const V = Math.PI / 6 * SL * H * Wd * 0.92;  // gövde hacmi (elipsoit, uçlar incelir)
    const mass = (sp.density || 1.0) * RHO * V;
    const finFactor = opts.finFactor || sp.finArea || 1.3; // yüzgeçlerin ıslak alana katkısı
    const S = ellipsoidArea(SL / 2, H / 2, Wd / 2) * finFactor;
    const d = Math.sqrt(H * Wd);
    const kForm = 1 + 1.5 * Math.pow(d / SL, 1.5) + 7 * Math.pow(d / SL, 3);
    const span = TL * (sp.span || 0.25);         // kuyruk ucu açıklığı
    const ma = Math.PI / 4 * RHO * span * span;  // birim boy başına ek kütle (kg/m)
    const A = TL * (sp.A || 0.1);                // kuyruk ucu yarı-genliği
    const lam = TL * (sp.lam || 1.0);
    const k = 2 * Math.PI / lam;
    const Sp = (sp.pect || 0.012) * SL * SL;     // tek göğüs yüzgeci alanı
    const Rp = (sp.pectLen || 0.2) * SL;         // göğüs yüzgeci uzunluğu
    return {TL, SL, H, Wd, V, mass, mEff: mass * 1.1, S, kForm, span, ma, A, lam, k, Sp, Rp, Phi: 1.4, CN: 1.2,
      fmax: sp.fmax || Math.min(18, 14 * Math.pow(5 / TLcm, 0.35)), fpmax: sp.fpmax || 4.2, alpha: sp.alpha || 1.5};
  }

  const reynolds = (U, M) => Math.max(1, Math.abs(U) * M.TL / NU);
  function skinCf(Re) { return 1.328 / Math.sqrt(Re) + 2.3 / Re; } // düşük Re için viskoz düzeltme

  /* Sürüklenme kuvveti (N); active=true iken gövde salınıyor */
  function drag(U, M, active) {
    const Re = reynolds(U, M);
    const Cd = skinCf(Re) * M.kForm * (active ? M.alpha : 1);
    return 0.5 * RHO * U * Math.abs(U) * M.S * Cd;
  }
  /* Lighthill EBT ortalama itmesi (N) */
  function thrust(omega, U, M) { return 0.25 * M.ma * M.A * M.A * (omega * omega - M.k * M.k * U * U); }
  /* Verilen kuvvet için gereken açısal frekans: ω² = k²U² + 4F/(mₐA²) */
  function omegaFor(F, U, M) { return Math.sqrt(Math.max(0, M.k * M.k * U * U + 4 * Math.max(0, F) / (M.ma * M.A * M.A))); }
  /* Göğüs yüzgeci itmesi ve ters çözümü */
  function pectThrust(omegaP, U, M) {
    const vf = 0.75 * M.Rp * M.Phi * omegaP / Math.PI, rel = vf - U;
    return rel > 0 ? 0.5 * RHO * M.CN * M.Sp * rel * rel : 0;
  }
  function pectOmegaFor(F, U, M) {
    const vf = U + Math.sqrt(2 * Math.max(0, F) / (RHO * M.CN * M.Sp));
    return vf * Math.PI / (0.75 * M.Rp * M.Phi);
  }

  /* Sabit hızda yüzme için kinematik çözüm: f, St, adım boyu, kayma oranı */
  function steady(Ubl, M, mode) {
    const U = Ubl * M.TL;
    let D = drag(U, M, true), fp = 0, F = D;
    if (mode === 'lab' || mode === 'benthic') {
      const D0 = drag(U, M, false), wp = pectOmegaFor(D0, U, M); fp = wp / (2 * Math.PI);
      if (fp > M.fpmax) { const Tp = pectThrust(M.fpmax * 2 * Math.PI, U, M); F = Math.max(0, D - Tp); fp = M.fpmax; } else { F = 0; D = D0; }
    }
    const w = F > 0 ? omegaFor(F, U, M) : 0, f = w / (2 * Math.PI);
    return {U, Re: reynolds(U, M), drag: D, f, fp, St: f > 0 ? f * 2 * M.A / U : 0, stride: f > 0 ? U / (f * M.TL) : 0,
      slip: f > 0 ? U / (f * M.lam) : 0, CoT: D * U};
  }

  /* Bir zaman adımı: ileri hız dinamiği  m_eff·dU/dt = T − D (+ yüzgeç itmesi)
     Denetleyici, hedef hıza ulaşmak için gereken ω'yı Lighthill ilişkisinden çözer. */
  function stepSurge(st, M, target, dt, mode, accelTau) {
    const U = st.U;
    const want = M.mEff * (target - U) / (accelTau || 0.35) + drag(Math.max(U, 0), M, true);
    let Tp = 0, wTail = 0, wp = 0;
    if (want > 0) {
      let rest = want;
      if (mode === 'lab' || mode === 'benthic') {
        wp = Math.min(pectOmegaFor(rest, U, M), M.fpmax * 2 * Math.PI);
        Tp = pectThrust(wp, U, M); rest = Math.max(0, rest - Tp);
        if (rest < want * 0.04) rest = 0;
      }
      if (rest > 0) wTail = Math.min(omegaFor(rest, Math.max(U, 0), M), M.fmax * 2 * Math.PI);
    }
    const active = wTail > 0.5;
    const T = (wTail > 0 ? Math.max(0, thrust(wTail, Math.max(U, 0), M)) : 0) + Tp;
    const D = drag(U, M, active);
    const a = (T - D) / M.mEff;
    let Un = U + a * dt;
    if (Un < 0 && U >= 0 && T <= 0) Un = 0;
    st.U = Un; st.omega = wTail; st.omegaP = wp; st.active = active;
    st.T = T; st.D = D;
    return st;
  }

  /* Yem parçacığı son hızı (m/s): Schiller–Naumann + kaldırma kuvveti, sabit nokta yinelemesi */
  function terminalVelocity(diameter, density) {
    const dr = density - RHO; if (Math.abs(dr) < 1e-6) return 0;
    const vol = Math.PI / 6 * diameter ** 3, area = Math.PI / 4 * diameter ** 2, Fb = Math.abs(dr) * vol * G;
    let v = Fb / (3 * Math.PI * MU * diameter);
    for (let i = 0; i < 40; i++) {
      const Re = Math.max(1e-6, v * diameter / NU), Cd = 24 / Re * (1 + 0.15 * Math.pow(Re, 0.687));
      const vn = Math.sqrt(2 * Fb / (RHO * Cd * area));
      if (Math.abs(vn - v) < 1e-7) { v = vn; break; }
      v = 0.5 * (v + vn);
    }
    return Math.sign(dr) * v;
  }
  /* Kabarcık son hızı (m/s), Clift vd. temiz kabarcık yaklaşımı (d ≈ 1–5 mm) */
  function bubbleVelocity(d) { return Math.min(0.25, Math.sqrt(2.14 * 0.0728 / (RHO * d) + 0.505 * G * d)); }

  /* Karangiform genlik zarfı (x: 0 burun → 1 kuyruk) */
  const envelope = (x, kind) => kind === 'ang' ? 0.0367 + 0.0323 * x + 0.031 * x * x : 0.02 - 0.0825 * x + 0.1625 * x * x;

  const API = {RHO, NU, MU, ellipsoidArea, morphology, reynolds, drag, thrust, omegaFor, pectThrust, pectOmegaFor, steady, stepSurge, terminalVelocity, bubbleVelocity, envelope};
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FishPhysics = API;
})(typeof self !== 'undefined' ? self : this);
