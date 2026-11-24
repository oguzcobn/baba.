/* =============================================================================
 * GLENMORE RP — Physical atmosphere
 * Hillaire 2020, "A Scalable and Production Ready Sky and Atmosphere Rendering
 * Technique" (EGSR) — transmittance LUT, multiple-scattering LUT (Ψms),
 * sky-view LUT; Bruneton & Neyret 2008 parametrisations.
 * Lengths in km, coefficients in 1/km. The light source is either the sun or,
 * at night, the moon (same equations, different illuminance & colour).
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP;

  const RG = 6360.0, RT = 6460.0;

  RP.ATMO_GLSL = `
    const float RG = ${RG.toFixed(1)};
    const float RT = ${RT.toFixed(1)};
    uniform vec3 uRayleighSca;     // 1/km at sea level
    uniform float uRayleighH;      // km
    uniform float uMieSca;         // 1/km
    uniform float uMieAbs;         // 1/km
    uniform float uMieH;           // km
    uniform float uMieG;
    uniform vec3 uOzoneAbs;        // 1/km at peak
    uniform vec3 uGroundAlbedo;
    struct Medium { vec3 scaR; float scaM; vec3 ext; };
    Medium sampleMedium(float h) {
      float dR = exp(-h / uRayleighH);
      float dM = exp(-h / uMieH);
      float dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
      Medium m;
      m.scaR = uRayleighSca * dR;
      m.scaM = uMieSca * dM;
      m.ext = m.scaR + vec3((uMieSca + uMieAbs) * dM) + uOzoneAbs * dO;
      return m;
    }
    float phaseRayleigh(float c) { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
    // Cornette–Shanks (1992) improved Henyey–Greenstein
    float phaseMie(float c, float g) {
      float g2 = g * g;
      return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
    }
    // ray (origin o, dir d) vs sphere at origin, returns nearest positive t or -1
    float raySphere(vec3 o, vec3 d, float r) {
      float b = dot(o, d), c = dot(o, o) - r * r, disc = b * b - c;
      if (disc < 0.0) return -1.0;
      float s = sqrt(disc), t0 = -b - s, t1 = -b + s;
      return t0 > 0.0 ? t0 : (t1 > 0.0 ? t1 : -1.0);
    }
    // Bruneton transmittance LUT parametrisation
    vec2 transmittanceUV(float r, float mu) {
      float Hh = sqrt(RT * RT - RG * RG);
      float rho = sqrt(max(r * r - RG * RG, 0.0));
      float disc = r * r * (mu * mu - 1.0) + RT * RT;
      float d = max(0.0, -r * mu + sqrt(max(disc, 0.0)));
      float dMin = RT - r, dMax = rho + Hh;
      return vec2((d - dMin) / (dMax - dMin), rho / Hh);
    }
    vec3 transmittanceToTop(sampler2D lut, float r, float mu) {
      return texture(lut, transmittanceUV(r, mu)).rgb;
    }
    vec2 msUV(float r, float mu) { return vec2(mu * 0.5 + 0.5, saturate((r - RG) / (RT - RG))); }
  `;

  // ---------------------------------------------------------------------------
  RP.Atmosphere = function (renderer) {
    this.renderer = renderer;
    this.params = {
      rayleighSca: new THREE.Vector3(5.802e-3, 13.558e-3, 33.1e-3),
      rayleighH: 8.0,
      mieSca: 3.996e-3,
      mieAbs: 0.444e-3,      // Hillaire: Mie extinction 4.440e-3 → absorption 0.444e-3 (SSA 0.9)
      mieH: 1.2,
      mieG: 0.8,
      ozoneAbs: new THREE.Vector3(0.650e-3, 1.881e-3, 0.085e-3),
      groundAlbedo: new THREE.Vector3(0.09, 0.11, 0.06),   // heather moorland (linear)
      turbidity: 1.0                                       // Mie scale (weather)
    };
    this.viewerAltKm = 0.12;          // Glen Coe valley floor ≈ 120 m a.s.l.
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.lightIllumTOA = new THREE.Vector3(1, 1, 1); // klx, colour included
    this.isMoon = false;

    const U = this.uniforms = {
      uRayleighSca: { value: this.params.rayleighSca.clone() },
      uRayleighH: { value: 8.0 },
      uMieSca: { value: 3.996e-3 },
      uMieAbs: { value: 0.444e-3 },
      uMieH: { value: 1.2 },
      uMieG: { value: 0.8 },
      uOzoneAbs: { value: this.params.ozoneAbs.clone() },
      uGroundAlbedo: { value: this.params.groundAlbedo.clone() },
      uTransLUT: { value: null },
      uMsLUT: { value: null },
      uSkyLUT: { value: null },
      uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightIllum: { value: new THREE.Vector3(1, 1, 1) },
      uViewR: { value: RG + this.viewerAltKm },
      uSunDiskLum: { value: new THREE.Vector3() },
      uSunCosRadius: { value: Math.cos(0.2678 * Math.PI / 180) },
      uNightSky: { value: new THREE.Vector3(0.6e-6, 0.8e-6, 1.4e-6) } // airglow + starlight, k-nits
    };

    this.transRT = RP.makeRT(256, 64, { type: THREE.FloatType });
    this.msRT = RP.makeRT(32, 32, { type: THREE.FloatType });
    this.skyRT = RP.makeRT(192, 108, { type: THREE.HalfFloatType });
    this.skyRT.texture.wrapS = THREE.RepeatWrapping;
    U.uTransLUT.value = this.transRT.texture;
    U.uMsLUT.value = this.msRT.texture;
    U.uSkyLUT.value = this.skyRT.texture;

    // ---- Transmittance LUT ------------------------------------------------
    this.transPass = new RP.Pass(RP.ATMO_GLSL + `
      void main() {
        float Hh = sqrt(RT * RT - RG * RG);
        float rho = Hh * vUv.y;
        float r = sqrt(rho * rho + RG * RG);
        float dMin = RT - r, dMax = rho + Hh;
        float d = dMin + vUv.x * (dMax - dMin);
        float mu = d == 0.0 ? 1.0 : (Hh * Hh - rho * rho - d * d) / (2.0 * r * d);
        mu = clamp(mu, -1.0, 1.0);
        vec3 o = vec3(0.0, r, 0.0);
        vec3 dir = vec3(sqrt(1.0 - mu * mu), mu, 0.0);
        float tMax = raySphere(o, dir, RT);
        const int N = 64;
        float dt = tMax / float(N);
        vec3 od = vec3(0.0);
        for (int i = 0; i < N; i++) {
          vec3 p = o + dir * (float(i) + 0.5) * dt;
          od += sampleMedium(length(p) - RG).ext * dt;
        }
        outColor = vec4(exp(-od), 1.0);
      }`, U);

    // ---- Multiple-scattering LUT Ψms (Hillaire §5.5, unit illuminance) ----
    this.msPass = new RP.Pass(RP.ATMO_GLSL + `
      uniform sampler2D uTransLUT;
      void main() {
        float muS = vUv.x * 2.0 - 1.0;
        float r = RG + vUv.y * (RT - RG) + 0.01;
        vec3 o = vec3(0.0, r, 0.0);
        vec3 sunDir = vec3(sqrt(1.0 - muS * muS), muS, 0.0);
        const int SQRT_DIRS = 8;
        const int STEPS = 20;
        vec3 L2 = vec3(0.0), fms = vec3(0.0);
        for (int a = 0; a < SQRT_DIRS; a++) for (int b = 0; b < SQRT_DIRS; b++) {
          float u = (float(a) + 0.5) / float(SQRT_DIRS), v = (float(b) + 0.5) / float(SQRT_DIRS);
          float th = 2.0 * PI * u, ph = acos(1.0 - 2.0 * v);
          vec3 d = vec3(cos(th) * sin(ph), cos(ph), sin(th) * sin(ph));
          float tG = raySphere(o, d, RG);
          float tT = raySphere(o, d, RT);
          float tMax = tG > 0.0 ? tG : tT;
          float dt = tMax / float(STEPS);
          vec3 T = vec3(1.0), Ls = vec3(0.0), F = vec3(0.0);
          for (int i = 0; i < STEPS; i++) {
            vec3 p = o + d * (float(i) + 0.5) * dt;
            float pr = length(p);
            Medium m = sampleMedium(pr - RG);
            vec3 sca = m.scaR + vec3(m.scaM);
            vec3 Tstep = exp(-m.ext * dt);
            float mu = dot(p / pr, sunDir);
            float earthShadow = raySphere(p, sunDir, RG) > 0.0 ? 0.0 : 1.0;
            vec3 S = transmittanceToTop(uTransLUT, pr, mu) * earthShadow;
            vec3 inv = 1.0 / max(m.ext, vec3(1e-7));
            Ls += T * (sca * S / (4.0 * PI) - sca * S / (4.0 * PI) * Tstep) * inv;
            F  += T * (sca - sca * Tstep) * inv;
            T *= Tstep;
          }
          if (tG > 0.0) {
            vec3 pg = o + d * tG;
            float mu = dot(normalize(pg), sunDir);
            Ls += T * transmittanceToTop(uTransLUT, RG, mu) * saturate(mu) * uGroundAlbedo / PI;
          }
          L2 += Ls; fms += F / (4.0 * PI);
        }
        float invN = 1.0 / float(SQRT_DIRS * SQRT_DIRS);
        L2 *= invN; fms *= invN * 4.0 * PI;   // ∫ over sphere with p_u = 1/4π
        outColor = vec4(L2 / (1.0 - fms), 1.0);
      }`, U);

    // ---- Sky-view LUT (per frame) ------------------------------------------
    this.skyPass = new RP.Pass(RP.ATMO_GLSL + `
      uniform sampler2D uTransLUT;
      uniform sampler2D uMsLUT;
      uniform vec3 uLightDir;
      uniform vec3 uLightIllum;
      uniform float uViewR;
      void main() {
        float r = uViewR;
        float vH = sqrt(r * r - RG * RG);
        float beta = acos(vH / r);
        float zenH = PI - beta;
        float viewZen;
        if (vUv.y < 0.5) { float c = 1.0 - 2.0 * vUv.y; c = 1.0 - c * c; viewZen = zenH * c; }
        else { float c = vUv.y * 2.0 - 1.0; c *= c; viewZen = zenH + beta * c; }
        float az = vUv.x * PI;   // azimuth relative to the light, symmetric
        // frame: y up, light in the +x/y plane
        vec3 L = normalize(uLightDir);
        float lightElev = L.y;
        vec3 Lp = vec3(sqrt(max(0.0, 1.0 - lightElev * lightElev)), lightElev, 0.0);
        vec3 d = vec3(sin(viewZen) * cos(az), cos(viewZen), sin(viewZen) * sin(az));
        vec3 o = vec3(0.0, r, 0.0);
        float tG = raySphere(o, d, RG);
        float tT = raySphere(o, d, RT);
        float tMax = tG > 0.0 ? tG : tT;
        tMax = min(tMax, 400.0);
        const int STEPS = 40;
        vec3 T = vec3(1.0), Lsum = vec3(0.0);
        float cosTh = dot(d, Lp);
        float pR = phaseRayleigh(cosTh), pM = phaseMie(cosTh, uMieG);
        float tPrev = 0.0;
        for (int i = 0; i < STEPS; i++) {
          // quadratic step distribution: dense near the viewer
          float f1 = (float(i) + 1.0) / float(STEPS);
          float tCur = tMax * f1 * f1;
          float dt = tCur - tPrev;
          float tS = tPrev + 0.5 * dt;
          tPrev = tCur;
          vec3 p = o + d * tS;
          float pr = length(p);
          Medium m = sampleMedium(pr - RG);
          vec3 up = p / pr;
          float mu = dot(up, Lp);
          float earthShadow = raySphere(p, Lp, RG) > 0.0 ? 0.0 : 1.0;
          vec3 S = transmittanceToTop(uTransLUT, pr, mu) * earthShadow;
          vec3 psi = texture(uMsLUT, msUV(pr, mu)).rgb;
          vec3 inS = (m.scaR * pR + vec3(m.scaM * pM)) * S + (m.scaR + vec3(m.scaM)) * psi;
          vec3 Tstep = exp(-m.ext * dt);
          Lsum += T * (inS - inS * Tstep) / max(m.ext, vec3(1e-7));
          T *= Tstep;
        }
        if (tG > 0.0 && tG < 400.0) {   // Lambertian ground beyond the modelled terrain
          vec3 pg = o + d * tG;
          vec3 ng = normalize(pg);
          float mu = dot(ng, Lp);
          vec3 Eg = transmittanceToTop(uTransLUT, RG, mu) * saturate(mu) + texture(uMsLUT, msUV(RG, mu)).rgb * PI;
          Lsum += T * Eg * uGroundAlbedo / PI;
        }
        outColor = vec4(Lsum * uLightIllum, 1.0);
      }`, U);

    this._lutDirty = true;
  };

  RP.Atmosphere.prototype.setWeather = function (opts) {
    // opts: { turbidity, mieG, groundAlbedo }
    const P = this.params;
    if (opts.turbidity !== undefined) P.turbidity = opts.turbidity;
    if (opts.mieG !== undefined) P.mieG = opts.mieG;
    const U = this.uniforms;
    U.uMieSca.value = P.mieSca * P.turbidity;
    U.uMieAbs.value = P.mieAbs * P.turbidity;
    U.uMieG.value = P.mieG;
    this._lutDirty = true;
  };

  /** CPU transmittance (same model) — used for the sun/moon illuminance at the viewer. */
  RP.Atmosphere.prototype.transmittanceCPU = function (altKm, mu) {
    const P = this.params, t = P.turbidity;
    const r = RG + altKm;
    // intersect with top
    const b = r * mu, c = r * r - RT * RT;
    const tMax = -b + Math.sqrt(Math.max(0, b * b - c));
    // ground?
    const cg = r * r - RG * RG, dg = b * b - cg;
    if (mu < 0 && dg > 0 && -b - Math.sqrt(dg) > 0) return [0, 0, 0];
    const N = 96, dt = tMax / N;
    let o0 = 0, o1 = 0, o2 = 0;
    for (let i = 0; i < N; i++) {
      const s = (i + 0.5) * dt;
      const x = Math.sqrt(1 - mu * mu) * s, y = r + mu * s;
      const h = Math.hypot(x, y) - RG;
      const dR = Math.exp(-h / P.rayleighH), dM = Math.exp(-h / P.mieH), dO = Math.max(0, 1 - Math.abs(h - 25) / 15);
      const em = (P.mieSca + P.mieAbs) * t * dM;
      o0 += (P.rayleighSca.x * dR + em + P.ozoneAbs.x * dO) * dt;
      o1 += (P.rayleighSca.y * dR + em + P.ozoneAbs.y * dO) * dt;
      o2 += (P.rayleighSca.z * dR + em + P.ozoneAbs.z * dO) * dt;
    }
    return [Math.exp(-o0), Math.exp(-o1), Math.exp(-o2)];
  };

  /**
   * Sets the key light: sun if above −4°, else moon (≈ 0.25 lx full-moon illuminance,
   * 4100 K reflected-sunlight colour). Returns { dir, illumGround (klx rgb), isMoon }.
   */
  RP.Atmosphere.prototype.setLight = function (sunDir, moonFactor) {
    const sunEl = Math.asin(Math.max(-1, Math.min(1, sunDir.y))) * 180 / Math.PI;
    const solarRGB = RP.kelvinToLinearRGB(5778);
    let dir, illum;
    // twilight crossfade sun→moon between −4° and −9°
    const wSun = THREE.MathUtils.smoothstep(sunEl, -9, -4);
    if (wSun > 0.02) {
      dir = sunDir.clone();
      illum = solarRGB.map((v) => v * RP.SOLAR_ILLUMINANCE_TOA);
      this.isMoon = false;
    } else {
      // moon roughly opposite the sun, kept at least 18° above the horizon
      dir = new THREE.Vector3(-sunDir.x, Math.max(0.31, -sunDir.y * 0.8), -sunDir.z).normalize();
      const moonRGB = RP.kelvinToLinearRGB(4100);
      illum = moonRGB.map((v) => v * 0.25e-3 * (moonFactor ?? 1));
      this.isMoon = true;
    }
    this.lightDir.copy(dir);
    this.lightIllumTOA.set(illum[0], illum[1], illum[2]);
    this.uniforms.uLightDir.value.copy(dir);
    this.uniforms.uLightIllum.value.copy(this.lightIllumTOA);
    const T = this.transmittanceCPU(this.viewerAltKm, dir.y);
    const ground = new THREE.Vector3(illum[0] * T[0], illum[1] * T[1], illum[2] * T[2]);
    // smooth fade of the direct sun through the horizon (finite solar disc + terrain)
    const fade = this.isMoon ? 1 : THREE.MathUtils.smoothstep(sunEl, -0.8, 1.5);
    ground.multiplyScalar(fade);
    // sun-disc luminance: E / solid angle, clamped to half-float range
    const omega = 2 * Math.PI * (1 - Math.cos(0.2678 * Math.PI / 180));
    const discScale = this.isMoon ? 0 : 1 / omega;
    this.uniforms.uSunDiskLum.value.set(
      Math.min(60000, this.lightIllumTOA.x * discScale),
      Math.min(60000, this.lightIllumTOA.y * discScale),
      Math.min(60000, this.lightIllumTOA.z * discScale));
    return { dir, illumGround: ground, isMoon: this.isMoon, sunElevDeg: sunEl };
  };

  RP.Atmosphere.prototype.update = function (cameraAltM) {
    const r = this.renderer;
    this.uniforms.uViewR.value = RG + this.viewerAltKm + Math.max(0, cameraAltM || 0) * 1e-3;
    if (this._lutDirty) {
      this.transPass.render(r, this.transRT);
      this.msPass.render(r, this.msRT);
      this._lutDirty = false;
    }
    this.skyPass.render(r, this.skyRT);
  };

  // GLSL to sample the sky radiance in an arbitrary world direction (needs uSkyLUT,
  // uTransLUT, uLightDir, uViewR, uSunDiskLum, uSunCosRadius)
  RP.SKY_SAMPLE_GLSL = `
    uniform sampler2D uSkyLUT;
    uniform vec3 uSunDiskLum;
    uniform float uSunCosRadius;
    uniform vec3 uNightSky;
    vec2 skyViewUV(vec3 d, vec3 L, float r) {
      float vH = sqrt(r * r - RG * RG);
      float beta = acos(vH / r);
      float zenH = PI - beta;
      float viewZen = acos(clamp(d.y, -1.0, 1.0));
      float v;
      if (viewZen < zenH) { float c = viewZen / zenH; c = 1.0 - c; c = sqrt(max(c, 0.0)); c = 1.0 - c; v = c * 0.5; }
      else { float c = (viewZen - zenH) / beta; c = sqrt(max(c, 0.0)); v = c * 0.5 + 0.5; }
      vec2 dh = normalize(d.xz + vec2(1e-6, 0.0)), lh = normalize(L.xz + vec2(1e-6, 0.0));
      float az = acos(clamp(dot(dh, lh), -1.0, 1.0));
      // keep the sample inside the texel centres
      return vec2(clamp(az / PI, 0.5 / 192.0, 1.0 - 0.5 / 192.0), clamp(v, 0.5 / 108.0, 1.0 - 0.5 / 108.0));
    }
    vec3 skyRadiance(vec3 d, vec3 L, float r) {
      return texture(uSkyLUT, skyViewUV(d, L, r)).rgb + uNightSky * smoothstep(-0.05, 0.1, d.y);
    }
    // sun disc with Hestroffer & Magnan (1998) limb darkening, attenuated by the atmosphere
    vec3 sunDisc(vec3 d, vec3 L, float r, sampler2D trans) {
      float c = dot(d, L);
      if (c < uSunCosRadius) return vec3(0.0);
      float x = sqrt(max(0.0, 1.0 - (1.0 - c) / (1.0 - uSunCosRadius)));  // cos of limb angle
      vec3 u = vec3(1.0), a = vec3(0.397, 0.503, 0.652);
      vec3 limb = pow(vec3(x), a);
      if (raySphere(vec3(0.0, r, 0.0), d, RG) > 0.0) return vec3(0.0);
      return uSunDiskLum * limb * transmittanceToTop(trans, r, d.y);
    }
  `;
})(window);
