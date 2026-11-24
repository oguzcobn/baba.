/* =============================================================================
 * GLENMORE RP — Water & far-field Glencoe terrain
 *
 *  • Tessendorf (2001) FFT ocean, GPU radix-2 Cooley–Tukey (Flügge 2017
 *    butterfly texture), two cascades:
 *      loch : L = 64 m,  N = 128, fetch-limited JONSWAP (Hasselmann 1973)
 *      pond : L = 1.2 m, N = 64,  capillary–gravity dispersion
 *             ω² = g k (1 + k²/k_m²),  k_m = √(ρ g / σ) ≈ 370 rad/m
 *  • Water optics: Fresnel (n = 1.333 → F0 = 0.02), GGX sun glint with slope
 *    variance from unresolved waves, peat-stained Highland loch water
 *    (CDOM absorption a(λ) = a440·e^{-0.014(λ-440)}, Bricaud 1981) with the
 *    Maritorena (1994) shallow-water reflectance model for the pond bottom.
 *  • Far terrain: ridged multifractal (Musgrave 1989) Glencoe walls with
 *    precomputed horizon angles in 16 azimuths (horizon mapping, Max 1988)
 *    → mountain self-shadowing at any sun position, free on the GPU.
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP;
  const G = 9.81;

  // ---------------------------------------------------------------------------
  // FFT cascade
  // ---------------------------------------------------------------------------
  function bitrev(x, bits) { let r = 0; for (let i = 0; i < bits; i++) { r = (r << 1) | (x & 1); x >>= 1; } return r; }
  function gauss(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return [Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v), Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v)]; }
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  RP.FFTCascade = function (renderer, N, L, opts) {
    this.renderer = renderer; this.N = N; this.L = L;
    this.opts = Object.assign({ capillary: false, depth: 1e9 }, opts || {});
    const log2N = Math.round(Math.log2(N));
    this.log2N = log2N;
    const fl = renderer.capabilities.isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;
    const mk = (filter, wrap) => RP.makeRT(N, N, { type: fl, filter: filter || THREE.NearestFilter, wrap: wrap });
    this.ping = [mk(), mk()];
    this.ping2 = [mk(), mk()];
    this.dispRT = RP.makeRT(N, N, { type: THREE.HalfFloatType, filter: THREE.LinearFilter, wrap: THREE.RepeatWrapping });
    this.slopeRT = RP.makeRT(N, N, { type: THREE.HalfFloatType, filter: THREE.LinearFilter, wrap: THREE.RepeatWrapping });
    [this.dispRT, this.slopeRT].forEach((rt) => {
      rt.texture.generateMipmaps = true;
      rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
      rt.texture.anisotropy = 4;
    });

    // butterfly texture (log2N × N): twiddle (re, im), indices (a, b)
    const bf = new Float32Array(log2N * N * 4);
    for (let s = 0; s < log2N; s++) {
      for (let y = 0; y < N; y++) {
        const span = 1 << s, k = (y * (N / (1 << (s + 1)))) % N;
        const tw = [Math.cos(2 * Math.PI * k / N), Math.sin(2 * Math.PI * k / N)];
        const top = (y % (1 << (s + 1))) < span;
        let a, b;
        if (s === 0) { a = top ? bitrev(y, log2N) : bitrev(y - 1, log2N); b = top ? bitrev(y + 1, log2N) : bitrev(y, log2N); }
        else { a = top ? y : y - span; b = top ? y + span : y; }
        const i = (y * log2N + s) * 4;
        bf[i] = tw[0]; bf[i + 1] = tw[1]; bf[i + 2] = a; bf[i + 3] = b;
      }
    }
    this.butterfly = new THREE.DataTexture(bf, log2N, N, THREE.RGBAFormat, THREE.FloatType);
    this.butterfly.minFilter = this.butterfly.magFilter = THREE.NearestFilter;
    this.butterfly.needsUpdate = true;

    this.h0Tex = new THREE.DataTexture(new Float32Array(N * N * 4), N, N, THREE.RGBAFormat, THREE.FloatType);
    this.h0Tex.minFilter = this.h0Tex.magFilter = THREE.NearestFilter;

    const NN = N.toFixed(1);
    this.evolvePass = new RP.Pass(`
      uniform sampler2D uH0;
      uniform float uTime, uL, uKm;
      layout(location = 1) out highp vec4 outColor2;
      vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
      void main() {
        vec2 nm = floor(gl_FragCoord.xy);
        vec2 k = 2.0 * PI * (nm - ${NN} * 0.5) / uL;
        float kl = max(length(k), 1e-6);
        float w = sqrt(9.81 * kl * (1.0 + (kl * kl) / (uKm * uKm)));
        vec4 h0 = texelFetch(uH0, ivec2(nm), 0);
        vec2 e = vec2(cos(w * uTime), sin(w * uTime));
        vec2 h = cmul(h0.xy, e) + cmul(h0.zw, vec2(e.x, -e.y));
        vec2 ih = vec2(-h.y, h.x);                   // i·h
        vec2 dx = -ih * k.x / kl, dz = -ih * k.y / kl; // choppy displacement −i k/|k| h
        vec2 sx = ih * k.x, sz = ih * k.y;             // slopes i k h
        // pack two real-output fields per complex channel: A + iB
        outColor = vec4(h.x - dx.y, h.y + dx.x, dz.x - sx.y, dz.y + sx.x);
        outColor2 = vec4(sz, 0.0, 0.0);
      }`, { uH0: { value: this.h0Tex }, uTime: { value: 0 }, uL: { value: L }, uKm: { value: this.opts.capillary ? 370.0 : 1e6 } });
    // MRT is not exposed in r128; render the two outputs with two passes instead
    this.evolvePass.material.fragmentShader = this.evolvePass.material.fragmentShader
      .replace('layout(location = 1) out highp vec4 outColor2;', 'uniform int uWhich; vec4 outColor2;')
      .replace('outColor2 = vec4(sz, 0.0, 0.0);', 'outColor2 = vec4(sz, 0.0, 0.0); if (uWhich == 1) outColor = outColor2;');
    this.evolvePass.uniforms.uWhich = { value: 0 };

    this.bfPass = new RP.Pass(`
      uniform sampler2D uSrc, uBF;
      uniform int uStage, uDir;
      vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
      void main() {
        ivec2 p = ivec2(floor(gl_FragCoord.xy));
        int idx = uDir == 0 ? p.x : p.y;
        vec4 d = texelFetch(uBF, ivec2(uStage, idx), 0);
        ivec2 pa = uDir == 0 ? ivec2(int(d.z), p.y) : ivec2(p.x, int(d.z));
        ivec2 pb = uDir == 0 ? ivec2(int(d.w), p.y) : ivec2(p.x, int(d.w));
        vec4 a = texelFetch(uSrc, pa, 0), b = texelFetch(uSrc, pb, 0);
        outColor = vec4(a.xy + cmul(d.xy, b.xy), a.zw + cmul(d.xy, b.zw));
      }`, { uSrc: { value: null }, uBF: { value: this.butterfly }, uStage: { value: 0 }, uDir: { value: 0 } });

    this.assemblePass = new RP.Pass(`
      uniform sampler2D uA, uB;
      uniform float uChop;
      uniform int uWhich;
      void main() {
        ivec2 p = ivec2(floor(gl_FragCoord.xy));
        float sgn = ((p.x + p.y) % 2 == 0) ? 1.0 : -1.0;
        vec4 a = texelFetch(uA, p, 0) * sgn;
        vec4 b = texelFetch(uB, p, 0) * sgn;
        if (uWhich == 0) outColor = vec4(a.y * uChop, a.x, a.z * uChop, 1.0);   // displacement (x, y, z)
        else outColor = vec4(a.w, b.x, 0.0, 1.0);                                 // slopes ∂h/∂x, ∂h/∂z
      }`, { uA: { value: null }, uB: { value: null }, uChop: { value: 1.0 }, uWhich: { value: 0 } });
  };

  /**
   * JONSWAP spectrum, fetch-limited (Hasselmann et al. 1973):
   *   α = 0.076 (gF/U²)^-0.22,  ω_p = 22 (g²/(U F))^(1/3),  γ = 3.3
   *   S(ω) = α g² ω⁻⁵ exp(−5/4 (ω_p/ω)⁴) γ^exp(−(ω−ω_p)²/(2σ²ω_p²))
   * converted to a directional wavenumber spectrum with D(θ) ∝ cos²(θ−θ_w).
   */
  RP.FFTCascade.prototype.setSpectrum = function (U, windDirXZ, fetchM, seed) {
    const N = this.N, L = this.L, dk = 2 * Math.PI / L;
    const rnd = mulberry(seed || 7);
    const U10 = Math.max(0.5, U);
    const F = fetchM;
    const xi = G * F / (U10 * U10);
    const alpha = 0.076 * Math.pow(xi, -0.22);
    const wp = 22 * Math.pow(G * G / (U10 * F), 1 / 3);
    const gamma = 3.3;
    const km = this.opts.capillary ? 370 : 1e6;
    const thw = Math.atan2(windDirXZ.y, windDirXZ.x);
    const amp = new Float32Array(N * N * 2);
    const S = (kx, kz) => {
      const k = Math.hypot(kx, kz);
      if (k < 1e-6) return 0;
      const w = Math.sqrt(G * k * (1 + (k * k) / (km * km)));
      const dwdk = G * (1 + 3 * k * k / (km * km)) / (2 * w);
      const sig = w <= wp ? 0.07 : 0.09;
      const r = Math.exp(-((w - wp) * (w - wp)) / (2 * sig * sig * wp * wp));
      let Sw = alpha * G * G / Math.pow(w, 5) * Math.exp(-1.25 * Math.pow(wp / w, 4)) * Math.pow(gamma, r);
      if (this.opts.capillary) Sw *= 1 + Math.pow(k / km, 2);   // capillary range flattens the tail
      const th = Math.atan2(kz, kx) - thw;
      const c = Math.cos(th);
      const D = 0.92 * (c > 0 ? (2 / Math.PI) * c * c : 0.0) + 0.08 / (2 * Math.PI);
      // suppress waves shorter than the grid can resolve without aliasing
      const kmax = Math.PI * N / L;
      const cut = Math.exp(-Math.pow(k / (kmax * 0.9), 6));
      return Sw * dwdk / k * D * cut;
    };
    let variance = 0;
    const g0 = new Float32Array(N * N * 2);
    for (let i = 0; i < N * N; i++) { const gs = gauss(rnd); g0[i * 2] = gs[0]; g0[i * 2 + 1] = gs[1]; }
    for (let m = 0; m < N; m++) for (let n = 0; n < N; n++) {
      const kx = (n - N / 2) * dk, kz = (m - N / 2) * dk;
      const P = S(kx, kz) * dk * dk;
      const a = Math.sqrt(P / 2);
      const i = m * N + n;
      amp[i * 2] = g0[i * 2] * a; amp[i * 2 + 1] = g0[i * 2 + 1] * a;
      variance += P;
    }
    const data = this.h0Tex.image.data;
    for (let m = 0; m < N; m++) for (let n = 0; n < N; n++) {
      const i = m * N + n;
      const nm = (N - n) % N, mm = (N - m) % N;       // index of −k
      const j = mm * N + nm;
      data[i * 4] = amp[i * 2]; data[i * 4 + 1] = amp[i * 2 + 1];
      data[i * 4 + 2] = amp[j * 2]; data[i * 4 + 3] = -amp[j * 2 + 1];   // conj(h0(−k))
    }
    this.h0Tex.needsUpdate = true;
    this.Hs = 4 * Math.sqrt(variance);   // significant wave height of the synthesised field
    this.peakLambda = 2 * Math.PI * G / (wp * wp);
    return { Hs: this.Hs, peakWavelength: this.peakLambda, alpha, wp };
  };

  RP.FFTCascade.prototype._fft = function (srcRT, pingArr) {
    const r = this.renderer, P = this.bfPass;
    let src = srcRT, idx = 0;
    for (let dir = 0; dir < 2; dir++) {
      for (let s = 0; s < this.log2N; s++) {
        P.uniforms.uSrc.value = src.texture;
        P.uniforms.uStage.value = s;
        P.uniforms.uDir.value = dir;
        const dst = pingArr[idx];
        P.render(r, dst);
        src = dst; idx = 1 - idx;
      }
    }
    return src;
  };

  RP.FFTCascade.prototype.update = function (t) {
    const r = this.renderer;
    const E = this.evolvePass;
    E.uniforms.uTime.value = t;
    // field A → ping[0] / field B → ping2[0]; FFT uses the other buffer of each pair
    E.uniforms.uWhich.value = 0; E.render(r, this.ping[0]);
    E.uniforms.uWhich.value = 1; E.render(r, this.ping2[0]);
    const a = this._fft(this.ping[0], [this.ping[1], this.ping[0]]);
    const b = this._fft(this.ping2[0], [this.ping2[1], this.ping2[0]]);
    const AP = this.assemblePass;
    AP.uniforms.uA.value = a.texture; AP.uniforms.uB.value = b.texture;
    AP.uniforms.uWhich.value = 0; AP.render(r, this.dispRT);
    AP.uniforms.uWhich.value = 1; AP.render(r, this.slopeRT);
  };

  // ---------------------------------------------------------------------------
  // Water material
  // ---------------------------------------------------------------------------
  RP.makeWaterMaterial = function (rp, cascade, opts) {
    const atmo = rp.atmo;
    const uniforms = Object.assign({}, atmo.uniforms, {
      uDisp: { value: cascade.dispRT.texture },
      uSlope: { value: cascade.slopeRT.texture },
      uPatch: { value: cascade.L },
      uDispScale: { value: opts.displace ? 1.0 : 0.0 },
      uDetailScale: { value: opts.detail || 1.0 },
      uKind: { value: opts.kind === 'pond' ? 1 : 0 },
      uPond: { value: new THREE.Vector4(opts.cx || 0, opts.cz || 0, opts.r || 1, 0.56) },   // centre, radius, max depth
      uCdom440: { value: opts.cdom440 || 6.0 },
      uBottomAlbedo: { value: new THREE.Vector3(0.10, 0.085, 0.06) },
      uWaterTime: { value: 0 }
    });
    RP.bindSceneUniformsTo(uniforms);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform sampler2D uDisp;
        uniform float uPatch, uDispScale;
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 d = texture2D(uDisp, wp.xz / uPatch).xyz * uDispScale;
          wp.xyz += d;
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        #define PI 3.14159265358979
        float saturate(float x){ return clamp(x, 0.0, 1.0); }
        vec3 saturate(vec3 x){ return clamp(x, 0.0, 1.0); }
        ${RP.GLSL_SCENE}
        ${RP.ATMO_GLSL}
        ${RP.SKY_SAMPLE_GLSL}
        uniform sampler2D uTransLUT, uDisp, uSlope;
        uniform vec3 uLightDir;
        uniform float uViewR, uPatch, uDetailScale, uCdom440;
        uniform int uKind;
        uniform vec4 uPond;
        uniform vec3 uBottomAlbedo;
        uniform float uWaterTime;
        varying vec3 vWorldPos;
        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          float dist = length(cameraPosition - vWorldPos);
          vec2 uv = vWorldPos.xz / uPatch;
          vec2 s = texture2D(uSlope, uv).xy;
          // second, rotated & scaled octave of the same field for detail
          vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * uv * 3.7 + 0.37;
          vec2 s2 = texture2D(uSlope, uv2).xy;
          s += vec2(0.8 * s2.x + 0.6 * s2.y, -0.6 * s2.x + 0.8 * s2.y) * 0.35 * uDetailScale;
          vec3 N = normalize(vec3(-s.x, 1.0, -s.y));
          // slope variance of waves below the pixel footprint widens the glint (Bruneton 2010)
          float footprint = dist * 0.0018;
          float rough = clamp(0.03 + footprint * (uKind == 1 ? 0.6 : 0.12), 0.03, 0.35);
          float NoV = max(dot(N, V), 1e-3);
          float F = rpF_Schlick(NoV, 0.02);
          vec3 R = reflect(-V, N);
          R.y = abs(R.y);
          vec3 sky = skyRadiance(R, uLightDir, uViewR);
          // overcast: reflection follows the cloud deck (approximated by the irradiance)
          vec3 skyDiffuse = rpIrradiance(R) / PI;
          sky = mix(sky, skyDiffuse, 0.35);
          // sun glint
          vec3 L = rpSunDir;
          vec3 H = normalize(L + V);
          float NoL = max(dot(N, L), 0.0);
          float vis = rpSunShadow(vWorldPos, vec3(0.0, 1.0, 0.0), rpIGN(gl_FragCoord.xy)) * rpCloudShadowAt(vWorldPos);
          vec3 glint = rpSunIllum * vis * rpD_GGX(max(dot(N, H), 0.0), rough) * rpV_Smith(NoV, NoL, rough)
                       * rpF_Schlick(max(dot(V, H), 0.0), 0.02) * NoL;
          // water body: peat-stained Highland water, Maritorena et al. 1994
          vec3 aw = vec3(0.45, 0.064, 0.015);                                  // pure water 650/550/450 nm
          vec3 acdom = uCdom440 * exp(-0.014 * (vec3(650.0, 550.0, 450.0) - 440.0));
          vec3 a = aw + acdom;
          vec3 bb = vec3(0.004, 0.005, 0.006);                                 // particulate back-scatter
          vec3 Rinf = 0.33 * bb / (a + bb);
          float depth = 50.0;
          if (uKind == 1) {
            float dp = length(vWorldPos.xz - uPond.xy);
            float pt = clamp(1.0 - dp / (uPond.z + 1.4), 0.0, 1.0);
            depth = max(0.0, 0.72 * pt * pt - 0.16 + 0.02);
          }
          vec3 K = a + bb;
          vec3 att = exp(-2.0 * K * depth / max(NoV, 0.2));
          vec3 Rrs = Rinf * (1.0 - att) + uBottomAlbedo * att;
          vec3 Ein = rpSunIllum * vis * max(L.y, 0.0) + rpIrradiance(vec3(0.0, 1.0, 0.0));
          vec3 body = Rrs * Ein / PI;
          vec3 col = (1.0 - F) * body + F * sky + glint;
          // foam at the pond rim (wind-blown scum line) – thin
          // alpha: water flag + Fresnel for screen-space reflections in the composite
          gl_FragColor = vec4(col, -1.0 - F);
        }`
    });
    return mat;
  };

  // ---------------------------------------------------------------------------
  // Far-field Glencoe terrain
  // ---------------------------------------------------------------------------
  function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
  }
  // Musgrave ridged multifractal (H = 1, lacunarity 2, offset 1, gain 2)
  function ridged(x, y, oct) {
    let sum = 0, freq = 1, amp = 1, weight = 1;
    for (let i = 0; i < oct; i++) {
      let s = 1 - Math.abs(vnoise(x * freq, y * freq));
      s *= s; s *= weight;
      weight = Math.min(1, Math.max(0, s * 2));
      sum += s * amp;
      freq *= 2.03; amp *= 0.5;
    }
    return sum;
  }
  RP.FAR = {
    loch: { level: 1.2 },
    // [x, z, height, radius]: Buachaille-like pyramid due north, Aonach Eagach-like wall NE/E, Bidean massif SW
    peaks: [[-900, -4300, 1020, 1100], [1200, -5200, 940, 1500], [3300, -3300, 900, 1500], [4300, -900, 760, 1400],
      [-3500, -2600, 880, 1500], [-5200, 600, 700, 1700], [-2600, 3800, 980, 1500], [2600, 4200, 720, 1600], [5200, 2600, 640, 1600]]
  };
  /** Height of the far terrain (m). `nearH(x,z)` is the inner terrain function. */
  RP.farHeight = function (x, z, nearH) {
    const r = Math.hypot(x, z);
    const oct = r < 900 ? 6 : (r < 2500 ? 5 : 4);         // band-limit to the mesh spacing
    const ridge = ridged(x / 1700 + 3.1, z / 1700 - 7.7, oct);
    // glen floor ≈ 3 m with gentle drumlins, mountains rise with distance
    let h = 3.0 + 4.0 * vnoise(x / 400, z / 400) + ridge * 300 * THREE.MathUtils.smoothstep(r, 350, 3000)
          + 35 * THREE.MathUtils.smoothstep(r, 150, 900) * (0.5 + 0.5 * vnoise(x / 700 + 5, z / 700));
    for (const p of RP.FAR.peaks) {
      const d2 = ((x - p[0]) ** 2 + (z - p[1]) ** 2) / (p[3] * p[3]);
      h += p[2] * Math.exp(-d2 * 1.3) * (0.7 + 0.45 * ridge);
    }
    // a U-shaped glacial trough (parabolic section) running WSW from the glen, holding the loch
    const ax = Math.cos(2.75), az = Math.sin(2.75);
    const along = x * ax + z * az;
    const across = -x * az + z * ax + 260 * Math.sin(along / 1300);
    const w = 300 + Math.max(0, along) * 0.08;
    const trough = Math.exp(-Math.pow(across / w, 2)) * THREE.MathUtils.smoothstep(along, 150, 520);
    const floorH = RP.FAR.loch.level - 4.5 + 3.5 * Math.max(0, vnoise(x / 260, z / 260));
    h = h * (1 - trough) + floorH * trough;
    const e = THREE.MathUtils.smoothstep(r, 90, 420);
    const hn = nearH ? nearH(Math.max(-89, Math.min(89, x)), Math.max(-89, Math.min(89, z))) : 0;
    return hn * (1 - e) + h * e;
  };

  RP.FarTerrain = function (scene, rp, nearH) {
    // rectilinear grid with geometric spacing, hole in the middle (inner terrain is ±90 m)
    const coords = [];
    const steps = 72;
    for (let i = 0; i <= steps; i++) coords.push(88 * Math.pow(9000 / 88, i / steps));
    const axis = [];
    for (let i = coords.length - 1; i >= 0; i--) axis.push(-coords[i]);
    const inner = 24;
    for (let i = 1; i < inner; i++) axis.push(-88 + (176 * i) / inner);
    for (let i = 0; i < coords.length; i++) axis.push(coords[i]);
    const n = axis.length;
    const pos = [], col = [], hz = [[], [], [], []], idx = [];
    const vid = new Int32Array(n * n).fill(-1);
    const heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) heights[j * n + i] = RP.farHeight(axis[i], axis[j], nearH);
    const H = (x, z) => RP.farHeight(x, z, nearH);
    let count = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = axis[i], z = axis[j];
      if (Math.abs(x) < 87.9 && Math.abs(z) < 87.9) continue;
      vid[j * n + i] = count++;
      const y = heights[j * n + i] - 0.25;
      pos.push(x, y, z);
      // slope from finite differences
      const e = Math.max(4, Math.hypot(x, z) * 0.01);
      const dx = (H(x + e, z) - H(x - e, z)) / (2 * e), dz = (H(x, z + e) - H(x, z - e)) / (2 * e);
      const slope = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
      const nv = vnoise(x / 700, z / 700) * 0.5 + 0.5;
      // sRGB albedo palette: moor grass, heather, bracken, granite / rhyolite, scree
      let c = new THREE.Color(0x5d6b3a).lerp(new THREE.Color(0x6b4f5d), THREE.MathUtils.smoothstep(nv, 0.35, 0.75) * 0.7);
      c.lerp(new THREE.Color(0x8a6236), THREE.MathUtils.smoothstep(vnoise(x / 1100 + 9, z / 1100), 0.2, 0.7) * 0.45);
      const rock = THREE.MathUtils.smoothstep(slope, 24, 38) * 0.9 + THREE.MathUtils.smoothstep(y, 600, 900) * 0.55;
      c.lerp(new THREE.Color(0x6c6a66).lerp(new THREE.Color(0x4a4846), nv), Math.min(1, rock));
      if (y < RP.FAR.loch.level + 3) c.lerp(new THREE.Color(0x4b5233), 0.6);
      col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = vid[j * n + i], b = vid[j * n + i + 1], c = vid[(j + 1) * n + i], d = vid[(j + 1) * n + i + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      idx.push(a, c, b, b, c, d);
    }
    // horizon angles in 16 azimuths (tan of the max elevation angle), marched over two height grids
    const mkGrid = (ext, res) => {
      const g = new Float32Array(res * res);
      for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) g[j * res + i] = H(-ext + (2 * ext * i) / (res - 1), -ext + (2 * ext * j) / (res - 1));
      return { g, ext, res };
    };
    const fine = mkGrid(1600, 220), coarse = mkGrid(9500, 200);
    const sampleGrid = (G2, x, z) => {
      const fx = (x + G2.ext) / (2 * G2.ext) * (G2.res - 1), fz = (z + G2.ext) / (2 * G2.ext) * (G2.res - 1);
      if (fx < 0 || fz < 0 || fx > G2.res - 1.001 || fz > G2.res - 1.001) return -1e9;
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, r = G2.res, g = G2.g;
      return (g[j * r + i] * (1 - u) + g[j * r + i + 1] * u) * (1 - v) + (g[(j + 1) * r + i] * (1 - u) + g[(j + 1) * r + i + 1] * u) * v;
    };
    const Hg = (x, z) => (Math.abs(x) < 1590 && Math.abs(z) < 1590 ? sampleGrid(fine, x, z) : sampleGrid(coarse, x, z));
    const NA = 16;
    const hor = new Float32Array(count * NA);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = vid[j * n + i];
      if (v < 0) continue;
      const x0 = axis[i], z0 = axis[j], y0 = heights[j * n + i] + 2;
      for (let a = 0; a < NA; a++) {
        const th = (a / NA) * Math.PI * 2;
        const dx = Math.cos(th), dz = Math.sin(th);
        let t = 20, best = -1;
        for (let s2 = 0; s2 < 26; s2++) {
          const tn = (Hg(x0 + dx * t, z0 + dz * t) - y0) / t;
          if (tn > best) best = tn;
          t *= 1.28;
        }
        hor[v * NA + a] = best;
      }
    }
    this.heightAt = Hg;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    for (let q = 0; q < 4; q++) {
      const arr = new Float32Array(count * 4);
      for (let v = 0; v < count; v++) for (let c = 0; c < 4; c++) arr[v * 4 + c] = hor[v * NA + q * 4 + c];
      geo.setAttribute('aHor' + q, new THREE.BufferAttribute(arr, 4));
    }
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0.0 });
    mat.userData.rpHorizonVis = true;
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.rpSunDirH = RP.sceneUniforms.rpSunDir;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aHor0, aHor1, aHor2, aHor3;
          uniform vec3 rpSunDirH;
          varying float vRpHorizon;
          float horAt(int i) {
            int q = i / 4, c = i - q * 4;
            vec4 h = q == 0 ? aHor0 : (q == 1 ? aHor1 : (q == 2 ? aHor2 : aHor3));
            return c == 0 ? h.x : (c == 1 ? h.y : (c == 2 ? h.z : h.w));
          }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            float az = atan(rpSunDirH.z, rpSunDirH.x);
            if (az < 0.0) az += 6.2831853;
            float f = az / 6.2831853 * 16.0;
            int i0 = int(floor(f)) % 16; int i1 = (i0 + 1) % 16;
            float tanH = mix(horAt(i0), horAt(i1), fract(f));
            float tanS = rpSunDirH.y / max(length(rpSunDirH.xz), 1e-4);
            // soft penumbra: the solar disc is 0.53°, terrain edges are fuzzy
            vRpHorizon = smoothstep(-0.03, 0.03, tanS - tanH);
          }`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRpHorizon;');
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    this.mesh = mesh;
  };

  // ---------------------------------------------------------------------------
  // Water system
  // ---------------------------------------------------------------------------
  RP.Water = function (renderer, scene, rp, opts) {
    this.renderer = renderer;
    this.rp = rp;
    this.far = new RP.FarTerrain(scene, rp, opts.terrainHeight);
    this.loch = new RP.FFTCascade(renderer, 128, 64, { capillary: false });
    this.pondC = new RP.FFTCascade(renderer, 64, 1.2, { capillary: true });
    this.wind = -1;
    this.setWind(8.5, new THREE.Vector2(Math.sin(235 * Math.PI / 180), Math.cos(235 * Math.PI / 180)));

    // loch plane (5 km) at the trough level; the far terrain occludes it outside the glen
    const lochGeo = new THREE.RingGeometry(128, 9000, 96, 24);
    lochGeo.rotateX(-Math.PI / 2);
    this.lochMat = RP.makeWaterMaterial(rp, this.loch, { kind: 'loch', cdom440: 7.0, detail: 1.0 });
    this.lochMesh = new THREE.Mesh(lochGeo, this.lochMat);
    this.lochMesh.position.y = RP.FAR.loch.level;
    this.lochMesh.frustumCulled = false;
    // the inner terrain covers the centre; push the loch below it there
    scene.add(this.lochMesh);
    this.lochMat.polygonOffset = true; this.lochMat.polygonOffsetFactor = 2; this.lochMat.polygonOffsetUnits = 2;

    if (opts.pond) {
      const p = opts.pond;
      this.pondMat = RP.makeWaterMaterial(rp, this.pondC, { kind: 'pond', cx: p.x, cz: p.z, r: p.r, cdom440: 5.0, detail: 1.0 });
      p.mesh.material = this.pondMat;
      p.mesh.geometry.dispose();
      p.mesh.geometry = new THREE.CircleGeometry(p.r + 0.25, 72);
      p.mesh.renderOrder = 0;
    }
  };
  RP.Water.prototype.setWind = function (U, dir) {
    const key = U.toFixed(1) + dir.x.toFixed(2) + dir.y.toFixed(2);
    if (key === this._windKey) return;
    this._windKey = key;
    this.lochInfo = this.loch.setSpectrum(U, dir, 3000, 11);      // ~3 km fetch along the loch
    this.pondInfo = this.pondC.setSpectrum(U * 0.55, dir, 6.4, 23); // sheltered by the dyke & reeds, 6.4 m fetch
  };
  RP.Water.prototype.update = function (t, U, dir) {
    if (U !== undefined) this.setWind(Math.max(0.5, Math.round(U * 2) / 2), dir);
    this.loch.update(t);
    this.pondC.update(t);
  };
})(window);
