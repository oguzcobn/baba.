/* =============================================================================
 * GLENMORE RP — Measurement & least-squares calibration  (steps 4–8)
 *
 *  4. References: hand-picked frames (built-in: the Glencoe oil painting and the
 *     cottage concept render shipped with the project; users can add their own).
 *  5. 7–10 labelled sample areas per reference ("sunlit grass", "sky near the
 *     sun", "distant mountains", …) and the same kinds of area in our render.
 *  6. Every area is split into 3×3 sub-patches; each patch is converted
 *     sRGB → linear → OKLab and measured as lightness L, chroma C, hue h.
 *  7. Levenberg–Marquardt least squares over all patch residuals
 *       r = [ ΔL_q (quantile-matched), ΔC, ΔH = 2√(C₁C₂)·sin(Δh/2) ]
 *     with Tikhonov priors keeping each parameter near its physical default.
 *  8. Re-render, re-measure, repeat until the error stops improving.
 *
 *  Display-side parameters are evaluated exactly on the GPU by re-running the
 *  local-exposure / grading / filmic chain on a cached HDR frame, so the
 *  Jacobian costs one fullscreen pass per parameter and needs no re-render.
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP;
  const Calib = global.GlenmoreCalib = {};

  // ---------------------------------------------------------------------------
  // 4–5. References and sample areas (normalised rects, origin top-left)
  // ---------------------------------------------------------------------------
  Calib.REFERENCES = {
    glencoe: {
      title: 'Glencoe yağlı boya (dış mekân, altın saat)',
      src: 'assets/glencoe_oil_painting.jpg',
      areas: {
        sky_sun: [0.62, 0.14, 0.70, 0.21],
        cloud_dark: [0.40, 0.01, 0.55, 0.07],
        sky_blue: [0.17, 0.02, 0.24, 0.06],
        mtn_distant: [0.50, 0.33, 0.58, 0.42],
        mtn_sunlit: [0.29, 0.44, 0.39, 0.51],
        mtn_shade: [0.70, 0.30, 0.78, 0.40],
        loch_bright: [0.58, 0.78, 0.66, 0.86],
        loch_dark: [0.78, 0.86, 0.87, 0.93],
        grass_sunlit: [0.22, 0.61, 0.32, 0.66],
        heather: [0.20, 0.86, 0.30, 0.92]
      }
    },
    cottage: {
      title: 'Dağ evi konsepti (iç mekân, şömine + bulutlu pencere)',
      src: 'assets/oguzhan_cottage_coffee_concept.jpg',
      areas: {
        wall_firelit: [0.70, 0.15, 0.74, 0.38],
        wall_cool: [0.02, 0.45, 0.08, 0.62],
        fire: [0.91, 0.80, 0.97, 0.88],
        stone: [0.70, 0.55, 0.74, 0.75],
        window_sky: [0.40, 0.16, 0.48, 0.24],
        window_grass: [0.40, 0.45, 0.48, 0.55],
        tartan: [0.09, 0.55, 0.13, 0.75],
        shadow: [0.14, 0.92, 0.20, 0.98],
        wood: [0.09, 0.08, 0.11, 0.35]
      }
    }
  };

  // Render views: scene state + camera + the same kinds of areas in our frame
  Calib.VIEWS = {
    glen_sunset: {
      ref: 'glencoe',
      setup: { weather: 'sunset', hours: 19.5, view: [-560, 2, 230, 1.96, 0.03, 100] },
      areas: {
        sky_sun: [0.86, 0.24, 0.97, 0.29],
        cloud_dark: [0.32, 0.03, 0.42, 0.10],
        sky_blue: [0.31, 0.18, 0.36, 0.23],
        mtn_distant: [0.90, 0.295, 0.98, 0.32],
        mtn_sunlit: [0.64, 0.20, 0.72, 0.28],
        mtn_shade: [0.05, 0.15, 0.15, 0.30],
        loch_bright: [0.70, 0.68, 0.85, 0.85],
        loch_dark: [0.05, 0.70, 0.20, 0.85]
      }
    },
    garden_sunset: {
      ref: 'glencoe',
      setup: { weather: 'sunset', hours: 19.5, view: [0, 4, -6, 2.6, 0.08, 30] },
      areas: {
        grass_sunlit: [0.62, 0.82, 0.95, 0.95],
        heather: [0.06, 0.70, 0.12, 0.82]
      }
    },
    hearth: {
      ref: 'cottage',
      setup: { weather: 'mist', hours: 10.0, view: [0, 1.2, -10.6, 0.0, 0.05, 3.4] },
      areas: {
        wall_firelit: [0.71, 0.05, 0.76, 0.30],
        wall_cool: [0.03, 0.05, 0.08, 0.25],
        fire: [0.46, 0.45, 0.53, 0.55],
        stone: [0.32, 0.30, 0.37, 0.65],
        tartan: [0.84, 0.40, 0.92, 0.70],
        shadow: [0.62, 0.80, 0.70, 0.90],
        wood: [0.09, 0.18, 0.12, 0.30]
      }
    },
    window: {
      ref: 'cottage',
      setup: { weather: 'mist', hours: 10.0, view: [-2.05, 1.5, -5.6, Math.PI, 0.0, 2.6] },
      areas: {
        window_sky: [0.38, 0.05, 0.48, 0.18]
      }
    }
  };

  // Display parameters fitted on the GPU (bounds, prior σ for the Tikhonov term)
  Calib.DISPLAY_PARAMS = [
    { k: 'exposureComp', lo: -3, hi: 3, sigma: 1.5 },
    { k: 'wbTemp', lo: 3800, hi: 9500, sigma: 1800, mired: true },
    { k: 'wbTint', lo: -12, hi: 12, sigma: 6 },
    { k: 'saturation', lo: 0.55, hi: 1.6, sigma: 0.3 },
    { k: 'contrast', lo: 0.75, hi: 1.35, sigma: 0.2 },
    { k: 'highlightContrast', lo: 0.45, hi: 1.15, sigma: 0.3 },
    { k: 'shadowContrast', lo: 0.6, hi: 1.25, sigma: 0.3 },
    { k: 'filmToe', lo: 0.35, hi: 0.8, sigma: 0.15 },
    { k: 'filmShoulder', lo: 0.12, hi: 0.5, sigma: 0.12 }
  ];

  // Physical albedo targets (luminance-weighted visible hemispherical reflectance)
  // MODIS white-sky VIS albedo of grassland ≈ 0.06–0.08; conifer/birch canopy ≈ 0.04–0.05;
  // heather moorland / peat ≈ 0.05–0.06 (Henderson-Sellers & Wilson 1983; Schaaf et al. 2002).
  Calib.ALBEDO_TARGETS = { grass: 0.070, foliage: 0.045, terrain: 0.060 };

  // ---------------------------------------------------------------------------
  // Measurement helpers
  // ---------------------------------------------------------------------------
  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  // LUT for 8-bit sRGB → linear
  const S2L = new Float32Array(256);
  for (let i = 0; i < 256; i++) S2L[i] = s2l(i / 255);

  /** Measures 3×3 sub-patches of an area in an RGBA8 buffer (row 0 = top). */
  Calib.measureArea = function (buf, W, H, rect, flipY) {
    const out = [];
    const [x0, y0, x1, y1] = rect;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const px0 = Math.floor((x0 + (x1 - x0) * i / 3) * W), px1 = Math.max(px0 + 1, Math.floor((x0 + (x1 - x0) * (i + 1) / 3) * W));
      const py0 = Math.floor((y0 + (y1 - y0) * j / 3) * H), py1 = Math.max(py0 + 1, Math.floor((y0 + (y1 - y0) * (j + 1) / 3) * H));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = py0; y < py1; y++) for (let x = px0; x < px1; x++) {
        const yy = flipY ? (H - 1 - y) : y;
        const o = (yy * W + x) * 4;
        r += S2L[buf[o]]; g += S2L[buf[o + 1]]; b += S2L[buf[o + 2]]; n++;
      }
      const lch = RP.okLCh([r / n, g / n, b / n]);
      out.push(lch);
    }
    return out;
  };

  Calib.loadImage = function (src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        res({ data: g.getImageData(0, 0, c.width, c.height).data, W: c.width, H: c.height });
      };
      img.onerror = rej;
      img.src = src;
    });
  };

  Calib.measureReference = async function (key, imageOverride) {
    const R = Calib.REFERENCES[key];
    const im = imageOverride || await Calib.loadImage(R.src);
    const res = {};
    for (const a in R.areas) res[a] = Calib.measureArea(im.data, im.W, im.H, R.areas[a], false);
    return res;
  };

  // ---------------------------------------------------------------------------
  // Render-side capture and GPU display re-evaluation
  // ---------------------------------------------------------------------------
  Calib.attach = function (rp, ctx) {
    Calib.rp = rp; Calib.ctx = ctx;
    Calib.buildUI();
  };

  function waitFrames(n) {
    const rp = Calib.rp, f0 = rp.frame;
    return new Promise((res) => {
      (function poll() { if (rp.frame >= f0 + n) res(); else setTimeout(poll, 30); })();
    });
  }

  Calib.applySetup = function (setup) {
    const { state, applyWeather } = Calib.ctx;
    state.timeSpeed = 0;
    if (setup.weather) { applyWeather(setup.weather, false); Calib.rp.setWeather(setup.weather, true); }
    if (setup.hours != null) state.simMinutes = setup.hours * 60;
    if (setup.view) global.__glen.setView.apply(null, setup.view);
  };

  /** Renders a view until TAA and exposure settle, then caches its HDR frame. */
  Calib.captureView = async function (key, frames) {
    const rp = Calib.rp, V = Calib.VIEWS[key];
    Calib.applySetup(V.setup);
    rp.post.expUniforms.uReset.value = 1;
    await waitFrames(frames || 20);
    const W = rp.resolvedRT.width, H = rp.resolvedRT.height;
    const cache = {
      hdr: RP.makeRT(W, H), bloom: RP.makeRT(rp.bloomRT[0].width, rp.bloomRT[0].height),
      exp: RP.makeRT(1, 1, { type: THREE.FloatType, filter: THREE.NearestFilter }), W, H
    };
    const cp = rp.post.copyPass;
    cp.uniforms.uScale.value = 1;
    cp.uniforms.uTex.value = rp.resolvedRT.texture; cp.render(rp.renderer, cache.hdr);
    cp.uniforms.uTex.value = rp.bloomRT[0].texture; cp.render(rp.renderer, cache.bloom);
    cache.exposure = rp.readExposure();
    cache.paramsAtCapture = Object.assign({}, rp.params);
    Calib.caches = Calib.caches || {};
    if (Calib.caches[key]) { Calib.caches[key].hdr.dispose(); Calib.caches[key].bloom.dispose(); }
    Calib.caches[key] = cache;
    return cache;
  };

  /**
   * Re-runs the display chain on a cached frame with candidate parameters.
   * exposureComp acts as a pre-scale 2^(Δcomp) relative to the capture.
   */
  Calib.evalDisplay = function (key, params) {
    const rp = Calib.rp, P = rp.post, r = rp.renderer, cache = Calib.caches[key];
    const W = cache.W, H = cache.H;
    if (!Calib.outRT || Calib.outRT.width !== W || Calib.outRT.height !== H) {
      if (Calib.outRT) Calib.outRT.dispose();
      Calib.outRT = RP.makeRT(W, H, { type: THREE.UnsignedByteType });
      Calib.lumRT = RP.makeRT(Math.ceil(W / 4), Math.ceil(H / 4));
      Calib.bilRT = RP.makeRT(Math.ceil(W / 4), Math.ceil(H / 4));
      Calib.b0 = RP.makeRT(Math.ceil(W / 16), Math.ceil(H / 16));
      Calib.b1 = RP.makeRT(Math.ceil(W / 16), Math.ceil(H / 16));
      Calib.scaledRT = RP.makeRT(W, H);
      Calib.scaledBloom = RP.makeRT(cache.bloom.width, cache.bloom.height);
    }
    const pre = Math.pow(2, params.exposureComp - cache.paramsAtCapture.exposureComp);
    const cp = P.copyPass;
    cp.uniforms.uScale.value = pre;
    cp.uniforms.uTex.value = cache.hdr.texture; cp.render(r, Calib.scaledRT);
    cp.uniforms.uTex.value = cache.bloom.texture; cp.render(r, Calib.scaledBloom);
    P.lumPass.uniforms.uTex.value = Calib.scaledRT.texture; P.lumPass.render(r, Calib.lumRT);
    P.bilatPass.uniforms.uTex.value = Calib.lumRT.texture;
    P.bilatPass.uniforms.uTexel.value.set(1 / Calib.lumRT.width, 1 / Calib.lumRT.height);
    P.bilatPass.render(r, Calib.bilRT);
    P.blurPass.uniforms.uTex.value = Calib.lumRT.texture; P.blurPass.uniforms.uDir.value.set(4 / Calib.lumRT.width, 0); P.blurPass.render(r, Calib.b0);
    P.blurPass.uniforms.uTex.value = Calib.b0.texture; P.blurPass.uniforms.uDir.value.set(0, 4 / Calib.lumRT.height); P.blurPass.render(r, Calib.b1);
    // temporarily load the candidate grade into the final pass
    const saved = Object.assign({}, rp.params);
    Object.assign(rp.params, params);
    rp.applyParams();
    const F = P.finalUniforms;
    const keep = { tex: F.uTex.value, bloom: F.uBloom.value, base: F.uLocalBase.value, blur: F.uLocalBlur.value, frame: F.uFrame.value };
    F.uTex.value = Calib.scaledRT.texture; F.uBloom.value = Calib.scaledBloom.texture;
    F.uLocalBase.value = Calib.bilRT.texture; F.uLocalBlur.value = Calib.b1.texture;
    F.uUseLocal.value = 1;
    P.finalPass.render(r, Calib.outRT);
    Object.assign(F, {});
    F.uTex.value = keep.tex; F.uBloom.value = keep.bloom; F.uLocalBase.value = keep.base; F.uLocalBlur.value = keep.blur;
    Object.assign(rp.params, saved);
    rp.applyParams();
    const buf = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(Calib.outRT, 0, 0, W, H, buf);
    const V = Calib.VIEWS[key], res = {};
    for (const a in V.areas) res[a] = Calib.measureArea(buf, W, H, V.areas[a], true);
    return res;
  };

  // ---------------------------------------------------------------------------
  // 6–7. Residuals and Levenberg–Marquardt
  // ---------------------------------------------------------------------------
  function sortedL(patches) { return patches.map((p) => p.L).sort((a, b) => a - b); }
  function meanLCh(patches) {
    let L = 0, a = 0, b = 0;
    patches.forEach((p) => { L += p.L; a += p.a; b += p.b; });
    L /= patches.length; a /= patches.length; b /= patches.length;
    return { L, a, b, C: Math.hypot(a, b), h: Math.atan2(b, a) };
  }
  /** Residuals for one (reference area, render area) pair: 9 quantile ΔL + ΔC + ΔH. */
  Calib.areaResiduals = function (refP, renP, w) {
    const r = [];
    const qa = sortedL(refP), qb = sortedL(renP);
    for (let i = 0; i < 9; i++) r.push((qb[i] - qa[i]) * w.L / 3);   // 9 quantiles share the weight of one mean
    const ma = meanLCh(refP), mb = meanLCh(renP);
    r.push((mb.L - ma.L) * w.L);
    r.push((mb.C - ma.C) * w.C);
    let dh = mb.h - ma.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    r.push(2 * Math.sqrt(ma.C * mb.C) * Math.sin(dh / 2) * w.H);
    return r;
  };
  Calib.WEIGHTS = { L: 1.0, C: 1.6, H: 1.6 };

  Calib.collectResiduals = function (refMeas, renMeasByView) {
    const res = [];
    for (const vk in renMeasByView) {
      const V = Calib.VIEWS[vk], ref = refMeas[V.ref];
      for (const a in renMeasByView[vk]) {
        if (!ref[a]) continue;
        res.push(...Calib.areaResiduals(ref[a], renMeasByView[vk][a], Calib.WEIGHTS));
      }
    }
    return res;
  };

  function toInternal(d, v) { return d.mired ? 1e6 / v : v; }
  function toExternal(d, u) { return d.mired ? 1e6 / u : u; }

  /**
   * Generic bounded Levenberg–Marquardt (Marquardt 1963 scaling, Nielsen 1999 damping update).
   * f(x) → residual array. x in internal units. Returns { x, cost, history }.
   */
  Calib.levenbergMarquardt = function (f, x0, lo, hi, prior, opts) {
    opts = opts || {};
    const n = x0.length, maxIt = opts.maxIt || 20;
    let x = x0.slice();
    const clamp = (v) => v.map((xi, i) => Math.min(hi[i], Math.max(lo[i], xi)));
    const withPrior = (r, xx) => r.concat(prior ? xx.map((xi, i) => (xi - prior.mu[i]) / prior.sigma[i] * prior.w) : []);
    let r = withPrior(f(x), x);
    let cost = r.reduce((s, v) => s + v * v, 0);
    let lambda = 1e-2, nu = 2;
    const history = [{ it: 0, cost, x: x.slice() }];
    for (let it = 1; it <= maxIt; it++) {
      // numerical Jacobian (forward differences, step relative to the range)
      const J = [];
      for (let j = 0; j < n; j++) {
        const h = (hi[j] - lo[j]) * 0.004;
        const xp = x.slice(); xp[j] = Math.min(hi[j], xp[j] + h);
        const hh = xp[j] - x[j] || -h;
        if (hh < 0) xp[j] = x[j] - h;
        const rp = withPrior(f(xp), xp);
        J.push(rp.map((v, i) => (v - r[i]) / (xp[j] - x[j])));
      }
      // normal equations (JᵀJ + λ diag(JᵀJ)) δ = −Jᵀr
      const A = [], g = [];
      for (let a = 0; a < n; a++) {
        A.push(new Array(n).fill(0));
        let s = 0; for (let i = 0; i < r.length; i++) s += J[a][i] * r[i];
        g.push(s);
        for (let b = 0; b <= a; b++) { let t = 0; for (let i = 0; i < r.length; i++) t += J[a][i] * J[b][i]; A[a][b] = A[b][a] = t; }
      }
      let improved = false;
      for (let tries = 0; tries < 8 && !improved; tries++) {
        const M = A.map((row, a) => row.map((v, b) => v + (a === b ? lambda * (A[a][a] + 1e-9) : 0)));
        const delta = Calib.solve(M, g.map((v) => -v));
        const xn = clamp(x.map((xi, i) => xi + delta[i]));
        const rn = withPrior(f(xn), xn);
        const cn = rn.reduce((s, v) => s + v * v, 0);
        if (cn < cost) {
          const rho = (cost - cn);
          x = xn; r = rn; cost = cn; improved = true;
          lambda *= Math.max(1 / 3, 1 - Math.pow(2 * Math.min(1, rho / (cost + 1e-12)) - 1, 3)); nu = 2;
        } else { lambda *= nu; nu *= 2; }
      }
      history.push({ it, cost, x: x.slice(), lambda });
      if (opts.onIter) opts.onIter(it, cost, x);
      if (!improved || (history.length > 2 && history[history.length - 2].cost - cost < 1e-6 * cost)) break;
    }
    return { x, cost, history };
  };

  // Gaussian elimination with partial pivoting
  Calib.solve = function (A, b) {
    const n = b.length, M = A.map((row, i) => row.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c] || 1e-12;
      for (let i = c + 1; i < n; i++) { const f = M[i][c] / d; for (let k = c; k <= n; k++) M[i][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k]; x[i] = s / (M[i][i] || 1e-12); }
    return x;
  };

  /** Fits the display parameters to all captured views. */
  Calib.fitDisplay = function (refMeas, opts) {
    const rp = Calib.rp, D = Calib.DISPLAY_PARAMS;
    const keys = Object.keys(Calib.caches);
    const base = Object.assign({}, rp.params);
    const lo = D.map((d) => Math.min(toInternal(d, d.lo), toInternal(d, d.hi)));
    const hi = D.map((d) => Math.max(toInternal(d, d.lo), toInternal(d, d.hi)));
    const x0 = D.map((d) => toInternal(d, base[d.k]));
    const def = RP.DEFAULT_PARAMS;
    const prior = {
      mu: D.map((d) => toInternal(d, def[d.k])),
      sigma: D.map((d) => d.mired ? Math.abs(1e6 / def[d.k] - 1e6 / (def[d.k] + d.sigma)) : d.sigma),
      w: (opts && opts.priorWeight) || 0.15
    };
    const toParams = (x) => { const p = Object.assign({}, base); D.forEach((d, i) => { p[d.k] = toExternal(d, x[i]); }); return p; };
    let evals = 0;
    const f = (x) => {
      const p = toParams(x); const meas = {};
      keys.forEach((k) => { meas[k] = Calib.evalDisplay(k, p); });
      evals++;
      return Calib.collectResiduals(refMeas, meas);
    };
    const r0 = f(x0);
    const out = Calib.levenbergMarquardt(f, x0, lo, hi, prior, { maxIt: (opts && opts.maxIt) || 15, onIter: opts && opts.onIter });
    return { params: toParams(out.x), cost0: r0.reduce((s, v) => s + v * v, 0), cost: out.cost, history: out.history, residualCount: r0.length, evals };
  };

  /** Per-area report (ΔE_ok of the means, ΔL, ΔC, Δh in degrees) for the current parameters. */
  Calib.report = function (refMeas, params) {
    const rows = [];
    for (const vk in Calib.caches) {
      const V = Calib.VIEWS[vk], m = Calib.evalDisplay(vk, params || Calib.rp.params), ref = refMeas[V.ref];
      for (const a in m) {
        if (!ref[a]) continue;
        const A = meanLCh(ref[a]), B = meanLCh(m[a]);
        let dh = B.h - A.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        rows.push({ view: vk, area: a, refL: A.L, refC: A.C, refH: A.h * 180 / Math.PI, L: B.L, C: B.C, H: B.h * 180 / Math.PI,
          dE: Math.hypot(B.L - A.L, B.a - A.a, B.b - A.b), dL: B.L - A.L, dC: B.C - A.C, dh: dh * 180 / Math.PI });
      }
    }
    return rows;
  };

  // ---------------------------------------------------------------------------
  // Stage A — physical albedo from HDR radiance (ρ_eff = π·L / E_h)
  // ---------------------------------------------------------------------------
  Calib.measureAlbedo = function (rect) {
    const rp = Calib.rp, rt = rp.sceneRT;
    const W = rt.width, H = rt.height;
    const x0 = Math.floor(rect[0] * W), x1 = Math.ceil(rect[2] * W), y0 = Math.floor((1 - rect[3]) * H), y1 = Math.ceil((1 - rect[1]) * H);
    const px = RP.readRT(rp.renderer, rt, x0, y0, x1 - x0, y1 - y0);
    let Y = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) { Y += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; n++; }
    Y /= n;
    const li = rp.lightInfo, up = rp.skyEnv.evalIrradiance(new THREE.Vector3(0, 1, 0));
    const Es = li.illumGround, mu = Math.max(0, li.dir.y);
    const E = 0.2126 * (Es.x * mu + up.x) + 0.7152 * (Es.y * mu + up.y) + 0.0722 * (Es.z * mu + up.z);
    return { L: Y, E, albedo: Math.PI * Y / E };
  };

  // ---------------------------------------------------------------------------
  // In-app panel (user can add own references and re-fit)
  // ---------------------------------------------------------------------------
  Calib.buildUI = function () {
    if (document.getElementById('rp-calib-panel')) return;
    const btn = document.createElement('button');
    btn.id = 'rp-calib-btn';
    btn.type = 'button';
    btn.textContent = '⚙ Görüntü';
    // lives in the existing top-right toolbar so it never overlaps the bottom bars or side panels
    const bar = document.querySelector('.fixed.top-3.right-3');
    const sib = bar && bar.querySelector('button');
    if (sib) btn.className = sib.className;
    else btn.style.cssText = 'position:fixed;right:12px;top:12px;z-index:60;padding:7px 12px;border-radius:10px;border:1px solid rgba(182,214,192,.25);background:rgba(12,20,17,.82);color:#edf2ee;font:500 12px Inter,system-ui,sans-serif;cursor:pointer';
    const panel = document.createElement('div');
    panel.id = 'rp-calib-panel';
    panel.style.cssText = 'position:fixed;right:12px;top:60px;z-index:40;width:min(340px,calc(100vw - 24px));max-height:calc(100vh - 150px);overflow:auto;padding:12px;border-radius:14px;border:1px solid rgba(182,214,192,.2);background:rgba(12,20,17,.92);color:#edf2ee;font:12px Inter,system-ui,sans-serif;display:none;backdrop-filter:blur(14px)';
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px">Görüntü kalitesi</div>
      <div style="opacity:.75;line-height:1.4;margin-bottom:8px">Otomatik mod 60 FPS'i korur: önce iç çözünürlüğü, gerekirse kaliteyi ayarlar. Elle seçimde de çözünürlük 60 FPS için ayarlanır.</div>
      <div id="rp-q" style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:8px"></div>
      <div id="rp-stat" style="font-family:'JetBrains Mono',monospace;font-size:10.5px;opacity:.85;margin-bottom:10px"></div>
      <div style="font-weight:600;margin:6px 0">Kalibrasyon (ölç → en küçük kareler)</div>
      <div style="opacity:.75;line-height:1.4;margin-bottom:8px">Referans kareler ile render'ı aynı tür bölgelerde (OKLab L, C, h) karşılaştırır ve görüntü parametrelerini Levenberg–Marquardt ile uydurur.</div>
      <button id="rp-fit" style="width:100%;padding:6px;border-radius:8px;border:1px solid #74c69d55;background:#74c69d22;color:#d8f3dc;cursor:pointer">Yerleşik referanslarla yeniden uydur</button>
      <div id="rp-fit-log" style="font-family:'JetBrains Mono',monospace;font-size:10.5px;white-space:pre-wrap;margin-top:8px;opacity:.9"></div>
      <div style="margin-top:8px;display:flex;gap:6px">
        <button id="rp-export" style="flex:1;padding:5px;border-radius:8px;border:1px solid #ffffff22;background:#ffffff10;color:#edf2ee;cursor:pointer">Parametreleri indir (JSON)</button>
        <button id="rp-reset" style="flex:1;padding:5px;border-radius:8px;border:1px solid #ffffff22;background:#ffffff10;color:#edf2ee;cursor:pointer">Varsayılan</button>
      </div>`;
    if (bar) bar.insertBefore(btn, bar.firstChild); else document.body.appendChild(btn);
    document.body.appendChild(panel);
    // the control drawer occupies the same corner: hide it while this panel is open
    let drawerWasOpen = false;
    btn.onclick = () => {
      const open = panel.style.display === 'none';
      panel.style.display = open ? 'block' : 'none';
      const drawer = document.getElementById('panel-drawer');
      if (drawer) {
        if (open) { drawerWasOpen = !drawer.classList.contains('collapsed'); drawer.classList.add('collapsed'); document.body.classList.remove('rp-drawer-open'); }
        else if (drawerWasOpen) { drawer.classList.remove('collapsed'); document.body.classList.add('rp-drawer-open'); }
      }
    };
    setInterval(() => {
      const r = Calib.rp, st = panel.querySelector('#rp-stat');
      if (!r || !st || panel.style.display === 'none') return;
      st.textContent = `${Math.round(1000 / (r._ftEMA || 16.7))} FPS · ${r.quality} · iç çözünürlük ${r.W}×${r.H} → ${r.OW}×${r.OH}`;
    }, 500);
    const q = panel.querySelector('#rp-q');
    const mark = (sel) => [...q.children].forEach((c) => { c.style.background = c === sel ? '#74c69d33' : '#ffffff10'; });
    ['auto', 'low', 'medium', 'high', 'ultra'].forEach((k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = { auto: 'Otomatik', low: 'Düşük', medium: 'Orta', high: 'Yüksek', ultra: 'Ultra' }[k];
      b.style.cssText = 'padding:5px 2px;border-radius:8px;border:1px solid #ffffff22;background:#ffffff10;color:#edf2ee;cursor:pointer;font-size:11px';
      b.onclick = () => { if (k === 'auto') { Calib.rp.autoQuality = true; } else { Calib.rp.setQuality(k); Calib.rp.autoQuality = false; } mark(b); };
      q.appendChild(b);
      if (k === 'auto') mark(b);
    });
    const log = panel.querySelector('#rp-fit-log');
    panel.querySelector('#rp-fit').onclick = async () => {
      log.textContent = 'Referanslar ölçülüyor…';
      const rep = await Calib.runDisplayCalibration((s) => { log.textContent = s; });
      log.textContent = rep.summary;
    };
    panel.querySelector('#rp-export').onclick = () => {
      const blob = new Blob(['window.GLENMORE_CALIBRATION = ' + JSON.stringify(Calib.rp.params, null, 2) + ';\n'], { type: 'text/javascript' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rp_calibration_result.js'; a.click();
    };
    panel.querySelector('#rp-reset').onclick = () => { Object.assign(Calib.rp.params, RP.DEFAULT_PARAMS); Calib.rp.applyParams(); };
  };

  /** Full display calibration in the browser: capture views → LM fit → apply. */
  Calib.runDisplayCalibration = async function (progress) {
    const rp = Calib.rp;
    const say = progress || (() => {});
    const refMeas = {};
    for (const k in Calib.REFERENCES) refMeas[k] = await Calib.measureReference(k);
    const camSave = global.__glen ? [global.__glen.camCtrl.target.clone(), global.__glen.camCtrl.yaw, global.__glen.camCtrl.pitch, global.__glen.camCtrl.dist] : null;
    for (const vk in Calib.VIEWS) { say('Görünüm render ediliyor: ' + vk); await Calib.captureView(vk, 24); }
    say('Levenberg–Marquardt…');
    const before = Calib.report(refMeas, rp.params);
    const fit = Calib.fitDisplay(refMeas, { onIter: (it, c) => say('LM iterasyon ' + it + '  maliyet ' + c.toFixed(4)) });
    Object.assign(rp.params, fit.params); rp.applyParams();
    const after = Calib.report(refMeas, rp.params);
    const mean = (rows) => rows.reduce((s, r) => s + r.dE, 0) / rows.length;
    const summary = `Nokta: ${after.length} bölge × 9 yama, ${fit.residualCount} artık\n` +
      `Ortalama ΔE_ok: ${mean(before).toFixed(4)} → ${mean(after).toFixed(4)}\n` +
      `Maliyet: ${fit.cost0.toFixed(4)} → ${fit.cost.toFixed(4)} (${fit.history.length - 1} iter, ${fit.evals} değerlendirme)\n` +
      Calib.DISPLAY_PARAMS.map((d) => `${d.k}: ${(+fit.params[d.k]).toFixed(d.k === 'wbTemp' ? 0 : 3)}`).join('\n');
    if (camSave) global.__glen.setView(camSave[0].x, camSave[0].y, camSave[0].z, camSave[1], camSave[2], camSave[3]);
    return { refMeas, before, after, fit, summary };
  };
})(window);
