/* =============================================================================
 * GLENMORE RP — Volumetric clouds
 * Schneider & Vos 2015 ("The real-time volumetric cloudscapes of Horizon Zero
 * Dawn"), Hillaire 2016 (energy-conserving integration, Frostbite), Wrenninge
 * 2013 multiple-scattering octaves. Tileable Perlin–Worley 3D noise generated
 * on the CPU at start-up. Also renders a cloud-shadow map for the ground.
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP;

  // ---------------- tileable noise (CPU) --------------------------------------
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function makeWorley(cells, rnd) {
    const pts = new Float32Array(cells * cells * cells * 3);
    for (let i = 0; i < pts.length; i++) pts[i] = rnd();
    return function (x, y, z) { // x,y,z in [0,1)
      const fx = x * cells, fy = y * cells, fz = z * cells;
      const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
      let dmin = 1e9;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, cz = iz + dz;
        const wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells, wz = ((cz % cells) + cells) % cells;
        const o = ((wz * cells + wy) * cells + wx) * 3;
        const px = cx + pts[o] - fx, py = cy + pts[o + 1] - fy, pz = cz + pts[o + 2] - fz;
        const d = px * px + py * py + pz * pz;
        if (d < dmin) dmin = d;
      }
      return 1 - Math.min(1, Math.sqrt(dmin));   // inverted Worley
    };
  }
  function makePerlin(period, rnd) {
    const grads = new Float32Array(period * period * period * 3);
    for (let i = 0; i < period * period * period; i++) {
      const th = rnd() * Math.PI * 2, z = rnd() * 2 - 1, r = Math.sqrt(1 - z * z);
      grads[i * 3] = r * Math.cos(th); grads[i * 3 + 1] = r * Math.sin(th); grads[i * 3 + 2] = z;
    }
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    return function (x, y, z) {
      const fx = x * period, fy = y * period, fz = z * period;
      const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
      const tx = fx - ix, ty = fy - iy, tz = fz - iz;
      let res = 0;
      const u = fade(tx), v = fade(ty), w = fade(tz);
      for (let c = 0; c < 8; c++) {
        const ox = c & 1, oy = (c >> 1) & 1, oz = (c >> 2) & 1;
        const gx = (ix + ox) % period, gy = (iy + oy) % period, gz = (iz + oz) % period;
        const gi = ((gz * period + gy) * period + gx) * 3;
        const dot = grads[gi] * (tx - ox) + grads[gi + 1] * (ty - oy) + grads[gi + 2] * (tz - oz);
        res += dot * (ox ? u : 1 - u) * (oy ? v : 1 - v) * (oz ? w : 1 - w);
      }
      return res; // ≈ [-0.9, 0.9]
    };
  }
  RP.buildCloudNoise = function () {
    const rnd = mulberry(1337);
    const N = 64, M = 32;
    const base = new Uint8Array(N * N * N * 4);
    const p1 = makePerlin(4, rnd), p2 = makePerlin(8, rnd), p3 = makePerlin(16, rnd);
    const w1 = makeWorley(4, rnd), w2 = makeWorley(8, rnd), w3 = makeWorley(16, rnd), w4 = makeWorley(32, rnd);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N, v = (y + 0.5) / N, w = (z + 0.5) / N;
      const perlin = 0.5 + 0.5 * (p1(u, v, w) * 0.625 + p2(u, v, w) * 0.25 + p3(u, v, w) * 0.125) * 1.4;
      const wa = w1(u, v, w), wb = w2(u, v, w), wc = w3(u, v, w), wd = w4(u, v, w);
      const wf = wa * 0.625 + wb * 0.25 + wc * 0.125;
      // Perlin–Worley: remap perlin by worley fbm (Schneider)
      const pw = Math.max(0, Math.min(1, (perlin - (1 - wf)) / (1 - (1 - wf)) ));
      const i = ((z * N + y) * N + x) * 4;
      base[i] = Math.round(Math.max(0, Math.min(1, pw * 0.7 + perlin * 0.3)) * 255);
      base[i + 1] = Math.round((wb * 0.625 + wc * 0.25 + wd * 0.125) * 255);
      base[i + 2] = Math.round((wc * 0.625 + wd * 0.25 + wb * 0.125) * 255);
      base[i + 3] = Math.round((wd * 0.75 + wc * 0.25) * 255);
    }
    const detail = new Uint8Array(M * M * M * 4);
    const d1 = makeWorley(4, rnd), d2 = makeWorley(8, rnd), d3 = makeWorley(16, rnd);
    for (let z = 0; z < M; z++) for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const u = (x + 0.5) / M, v = (y + 0.5) / M, w = (z + 0.5) / M;
      const i = ((z * M + y) * M + x) * 4;
      const a = d1(u, v, w), b = d2(u, v, w), c = d3(u, v, w);
      detail[i] = Math.round((a * 0.625 + b * 0.25 + c * 0.125) * 255);
      detail[i + 1] = Math.round(b * 255); detail[i + 2] = Math.round(c * 255); detail[i + 3] = 255;
    }
    function tex3D(data, n) {
      const t = new THREE.DataTexture3D(data, n, n, n);
      t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
      t.unpackAlignment = 1; t.needsUpdate = true;
      return t;
    }
    // 2D weather noise 128² (tileable value-fbm in R, second octave set in G)
    const W = 128, wx = new Uint8Array(W * W * 4);
    const q1 = makePerlin(4, rnd), q2 = makePerlin(8, rnd), q3 = makePerlin(16, rnd);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / W;
      const a = 0.5 + 0.5 * (q1(u, v, 0.3) * 0.6 + q2(u, v, 0.3) * 0.3 + q3(u, v, 0.3) * 0.1) * 1.6;
      const b = 0.5 + 0.5 * (q2(u, v, 0.7) * 0.6 + q3(u, v, 0.7) * 0.4) * 1.6;
      const i = (y * W + x) * 4;
      wx[i] = Math.round(Math.max(0, Math.min(1, a)) * 255); wx[i + 1] = Math.round(Math.max(0, Math.min(1, b)) * 255); wx[i + 2] = 0; wx[i + 3] = 255;
    }
    const wt = new THREE.DataTexture(wx, W, W, THREE.RGBAFormat);
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.minFilter = wt.magFilter = THREE.LinearFilter; wt.needsUpdate = true;
    return { base: tex3D(base, N), detail: tex3D(detail, M), weather: wt };
  };

  // ---------------- GPU part ---------------------------------------------------
  RP.Clouds = function (renderer, atmo, post) {
    this.renderer = renderer;
    this.ready = false;
    const U = this.uniforms = Object.assign({}, post.common, atmo.uniforms, RP.sceneUniforms, {
      uBase: { value: null }, uDetail: { value: null }, uWeather: { value: null },
      uCloudBottom: { value: 900.0 },   // m above the valley floor
      uCloudTop: { value: 2300.0 },
      uCoverage: { value: 0.5 },
      uDensity: { value: 0.035 },       // σ_t scale (1/m)
      uWind: { value: new THREE.Vector3() },
      uSteps: { value: 40 },
      uLightSteps: { value: 5 },
      uType: { value: 0.5 },            // 0 stratus … 1 cumulus
      uGroundRad: { value: new THREE.Vector3() },
      uCamPosW: { value: new THREE.Vector3() },
      uShadowCenter: { value: new THREE.Vector2() },
      uShadowExtent: { value: 4000.0 }
    });

    const DENSITY_GLSL = `
      precision highp sampler3D;
      uniform sampler3D uBase, uDetail;
      uniform sampler2D uWeather;
      uniform float uCloudBottom, uCloudTop, uCoverage, uDensity, uType;
      uniform vec3 uWind;
      const float ER = 6360000.0;
      float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
      float heightFrac(vec3 p) {
        float h = length(p + vec3(0.0, ER, 0.0)) - ER;
        return (h - uCloudBottom) / (uCloudTop - uCloudBottom);
      }
      float cloudDensity(vec3 p, bool cheap) {
        float hf = heightFrac(p);
        if (hf < 0.0 || hf > 1.0) return 0.0;
        vec2 wuv = (p.xz + uWind.xz * 0.6) / 16000.0;
        vec4 wm = texture(uWeather, wuv);
        float cov = saturate(remap(wm.r, 0.0, 1.0, uCoverage - 0.35, uCoverage + 0.45));
        cov = max(cov, uCoverage * uCoverage);
        // height profiles: stratus (thin, flat) → cumulus (rounded tops)
        float strat = smoothstep(0.0, 0.08, hf) * (1.0 - smoothstep(0.18, 0.32, hf));
        float cumu = smoothstep(0.0, 0.1, hf) * (1.0 - smoothstep(0.45, 1.0, hf));
        float profile = mix(strat, cumu, uType);
        vec3 q = (p + uWind) / 2600.0;
        vec4 n = texture(uBase, q);
        float fbm = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
        float base = remap(n.r, -(1.0 - fbm), 1.0, 0.0, 1.0);
        base *= profile;
        float d = saturate(remap(base, 1.0 - cov, 1.0, 0.0, 1.0)) * cov;
        if (!cheap && d > 0.0) {
          vec3 dn = texture(uDetail, q * 6.3 + vec3(0.0, uWind.y * 0.0002, 0.0)).rgb;
          float dfbm = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
          float mod_ = mix(dfbm, 1.0 - dfbm, saturate(hf * 6.0));
          d = saturate(remap(d, mod_ * 0.32, 1.0, 0.0, 1.0));
        }
        return d * uDensity;
      }
      vec2 shellHits(vec3 ro, vec3 rd, float R) {
        vec3 o = ro + vec3(0.0, ER, 0.0);
        float b = dot(o, rd), c = dot(o, o) - R * R, disc = b * b - c;
        if (disc < 0.0) return vec2(-1.0);
        float s = sqrt(disc);
        return vec2(-b - s, -b + s);
      }
    `;

    this.cloudPass = new RP.Pass(RP.ATMO_GLSL + RP.DEPTH_GLSL + RP.SKY_SAMPLE_GLSL + DENSITY_GLSL + `
      uniform sampler2D uTransLUT;
      uniform vec3 uLightDir, uLightIllum;
      uniform float uViewR, uFrame;
      uniform int uSteps, uLightSteps;
      uniform vec3 rpSH[9];
      uniform vec3 uGroundRad, uCamPosW;
      vec3 shIrr(vec3 n) {
        vec3 e = rpSH[0] * 0.282095 + rpSH[1] * (0.488603 * n.y) + rpSH[2] * (0.488603 * n.z) + rpSH[3] * (0.488603 * n.x)
          + rpSH[4] * (1.092548 * n.x * n.y) + rpSH[5] * (1.092548 * n.y * n.z) + rpSH[6] * (0.315392 * (3.0 * n.z * n.z - 1.0))
          + rpSH[7] * (1.092548 * n.x * n.z) + rpSH[8] * (0.546274 * (n.x * n.x - n.y * n.y));
        return max(e, vec3(0.0));
      }
      float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
      void main() {
        float d = rawDepth(vUv);
        vec3 ro = uCamPosW;
        vec3 rd = viewDirWorld(vUv);
        float tScene = d >= 1.0 ? 1e9 : length(viewPosFromDepth(vUv, d));
        float Rb = ER + uCloudBottom, Rt = ER + uCloudTop;
        float camH = length(ro + vec3(0.0, ER, 0.0)) - ER;
        float t0, t1;
        vec2 hb = shellHits(ro, rd, Rb), ht = shellHits(ro, rd, Rt);
        if (camH < uCloudBottom) {
          if (rd.y < -0.02) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          t0 = hb.y; t1 = ht.y;
        } else if (camH < uCloudTop) { t0 = 0.0; t1 = hb.x > 0.0 ? hb.x : ht.y; }
        else { t0 = ht.x; t1 = hb.x > 0.0 ? hb.x : ht.y; }
        t1 = min(t1, min(tScene, 60000.0));
        if (t1 <= t0 || t0 < 0.0 && camH < uCloudBottom) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        float span = t1 - t0;
        float jitter = ign(gl_FragCoord.xy + 5.588238 * mod(uFrame, 64.0));
        float dt = span / float(uSteps);
        vec3 L = normalize(uLightDir);
        float c = dot(rd, L);
        // dual-lobe HG (forward silver lining + back-scatter)
        float ph = mix(hg(c, 0.8), hg(c, -0.25), 0.35);
        vec3 T = vec3(1.0);
        vec3 S = vec3(0.0);
        vec3 ambTop = shIrr(vec3(0.0, 1.0, 0.0)) / PI;
        vec3 ambBot = uGroundRad;
        float tFirst = -1.0;
        float t = t0 + dt * jitter;
        for (int i = 0; i < 96; i++) {
          if (i >= uSteps || t > t1) break;
          vec3 p = ro + rd * t;
          float sig = cloudDensity(p, false);
          if (sig > 1e-6) {
            if (tFirst < 0.0) tFirst = t;
            // light march toward the sun (cone, growing steps)
            float tauL = 0.0, ls = 60.0;
            vec3 lp = p;
            for (int j = 0; j < 8; j++) {
              if (j >= uLightSteps) break;
              lp += L * ls;
              tauL += cloudDensity(lp, j > 2) * ls;
              ls *= 1.8;
            }
            float hf = saturate(heightFrac(p));
            float altKm = 0.12 + max(length(p + vec3(0.0, ER, 0.0)) - ER, 0.0) * 1e-3;
            vec3 sunE = uLightIllum * transmittanceToTop(uTransLUT, RG + altKm, L.y);
            // Wrenninge multiple-scattering octaves (a=0.5 energy, b=0.5 extinction, c=0.5 eccentricity)
            vec3 inS = vec3(0.0);
            float a = 1.0, b = 1.0, cc = 1.0;
            for (int o = 0; o < 3; o++) {
              float pho = mix(hg(c, 0.8 * cc), hg(c, -0.25 * cc), 0.35);
              inS += sunE * a * pho * exp(-tauL * b);
              a *= 0.5; b *= 0.5; cc *= 0.5;
            }
            // powder (Schneider): dark edges facing the light
            float powder = 1.0 - exp(-sig * 2.0 * 220.0);
            inS *= mix(1.0, powder, 0.6);
            vec3 amb = mix(ambBot, ambTop, hf) * (0.6 + 0.4 * hf);
            vec3 Lsrc = (inS + amb) * sig;               // single-scattering albedo ≈ 1
            float Ts = exp(-sig * dt);
            S += T * (Lsrc - Lsrc * Ts) / sig;
            T *= Ts;
            if (T.x < 0.01) break;
            t += dt;
          } else {
            t += dt * 1.6;   // faster through empty space
          }
        }
        float alpha = 1.0 - T.x;
        // aerial perspective toward the clouds: blend into the clear-sky radiance
        if (tFirst > 0.0) {
          float air = 1.0 - exp(-tFirst / 28000.0);
          vec3 skyC = skyRadiance(rd, L, uViewR);
          S = mix(S, skyC * alpha, air);
        }
        outColor = vec4(S, T.x);
      }`, U);

    // cloud shadow map: optical depth along the light through the shell, per ground texel
    this.shadowRT = RP.makeRT(192, 192, { type: THREE.HalfFloatType });
    this.shadowPass = new RP.Pass(DENSITY_GLSL + `
      uniform vec3 uLightDir;
      uniform vec2 uShadowCenter;
      uniform float uShadowExtent;
      void main() {
        vec3 p = vec3(uShadowCenter.x + (vUv.x - 0.5) * uShadowExtent, 0.0, uShadowCenter.y + (vUv.y - 0.5) * uShadowExtent);
        vec3 L = normalize(uLightDir);
        if (L.y < 0.02) { outColor = vec4(0.25, 0.0, 0.0, 1.0); return; }
        float t0 = uCloudBottom / L.y, t1 = uCloudTop / L.y;
        float tau = 0.0;
        const int N = 10;
        float dt = (t1 - t0) / float(N);
        for (int i = 0; i < N; i++) tau += cloudDensity(p + L * (t0 + (float(i) + 0.5) * dt), true) * dt;
        // diffuse light still gets through thick clouds: two-stream floor
        float T = exp(-tau * 0.85);
        outColor = vec4(T, 0.0, 0.0, 1.0);
      }`, U);
    RP.sceneUniforms.rpCloudShadow.value = this.shadowRT.texture;

    const self = this;
    // build the noise without blocking the first frames
    setTimeout(function () {
      const n = RP.buildCloudNoise();
      U.uBase.value = n.base; U.uDetail.value = n.detail; U.uWeather.value = n.weather;
      self.ready = true;
    }, 30);
  };

  RP.Clouds.prototype.renderShadow = function (camPos) {
    if (!this.ready) return;
    const U = this.uniforms;
    // snap the centre to texels to avoid shimmering
    const texel = U.uShadowExtent.value / 192;
    U.uShadowCenter.value.set(Math.round(camPos.x / texel) * texel, Math.round(camPos.z / texel) * texel);
    RP.sceneUniforms.rpCloudShadowXform.value.set(U.uShadowCenter.value.x, U.uShadowCenter.value.y, 1 / U.uShadowExtent.value, 0);
    this.shadowPass.render(this.renderer, this.shadowRT);
  };
})(window);
