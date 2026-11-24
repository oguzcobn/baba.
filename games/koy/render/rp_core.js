/* =============================================================================
 * GLENMORE RENDER PIPELINE (RP) — core
 * Three.js r128 · WebGL2 · HDR / physically based
 *
 * Unit system ("kilo-photometric"): every radiometric quantity in the pipeline
 * is stored as (photometric value / 1000), so
 *     illuminance  : kilolux          (clear-sky sun at TOA ≈ 127.5)
 *     luminance    : kcd/m² (k-nits)  (overcast sky ≈ 2–8, interior ≈ 0.01–0.1)
 *     intensity    : kcd              (9.5 kW wood fire ≈ 0.28)
 * This keeps the full day/night range (1e-7 … 6e4) inside half-float storage.
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP = global.GlenmoreRP || {};

  RP.UNIT = 1e-3;                 // photometric → pipeline units
  RP.SOLAR_ILLUMINANCE_TOA = 127.5; // klx (CIE / ASTM E490 integrated with V(λ))

  // ---------------------------------------------------------------------------
  // Colour science
  // ---------------------------------------------------------------------------
  // Wyman, Sloan & Shirley (2013) multi-lobe analytic fit of CIE 1931 2° CMFs.
  function g(x, mu, s1, s2) { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
  function cmf(l) {
    return [
      1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
      0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
      1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)
    ];
  }
  const H = 6.62607015e-34, C = 2.99792458e8, KB = 1.380649e-23;
  function planck(lnm, T) { const l = lnm * 1e-9; return (2 * H * C * C) / (Math.pow(l, 5) * (Math.exp((H * C) / (l * KB * T)) - 1)); }
  const XYZ2SRGB = [3.2404542, -1.5371385, -0.4985314, -0.9692660, 1.8760108, 0.0415560, 0.0556434, -0.2040259, 1.0572252];
  RP.xyzToLinearSRGB = function (X, Y, Z) {
    const m = XYZ2SRGB;
    return [m[0] * X + m[1] * Y + m[2] * Z, m[3] * X + m[4] * Y + m[5] * Z, m[6] * X + m[7] * Y + m[8] * Z];
  };
  const _kCache = new Map();
  /** Planckian radiator → linear-sRGB chromaticity normalised to luminance Y = 1. */
  RP.kelvinToLinearRGB = function (T) {
    const key = Math.round(T / 10);
    if (_kCache.has(key)) return _kCache.get(key).slice();
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 4) { const b = planck(l, T); const c = cmf(l); X += b * c[0]; Y += b * c[1]; Z += b * c[2]; }
    const rgb = RP.xyzToLinearSRGB(X / Y, 1, Z / Y).map((v) => Math.max(0, v));
    // renormalise after gamut clipping so that luminance stays exactly 1
    const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    const out = rgb.map((v) => v / y);
    _kCache.set(key, out);
    return out.slice();
  };
  /** Luminous efficacy of blackbody radiation K(T) in lm/W (numerical Planck × V(λ) integral). */
  RP.blackbodyEfficacy = function (T) {
    let vis = 0, tot = 0;
    for (let l = 380; l <= 780; l += 2) vis += planck(l, T) * cmf(l)[1] * 2;
    for (let l = 100; l <= 60000; l += 20) tot += planck(l, T) * 20;
    return (683 * vis) / tot;
  };
  RP.srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  RP.linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  // OKLab (Ottosson 2020) — perceptual space used by the calibration solver
  RP.linearSRGBToOKLab = function (r, g2, b) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g2 + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g2 + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g2 + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  };
  RP.okLCh = function (rgbLin) {
    const lab = RP.linearSRGBToOKLab(Math.max(0, rgbLin[0]), Math.max(0, rgbLin[1]), Math.max(0, rgbLin[2]));
    const Cc = Math.hypot(lab[1], lab[2]);
    return { L: lab[0], C: Cc, h: Math.atan2(lab[2], lab[1]), a: lab[1], b: lab[2] };
  };

  // ---------------------------------------------------------------------------
  // Solar & lunar astronomy (NOAA / Spencer 1971 approximations)
  // ---------------------------------------------------------------------------
  RP.GLENCOE = { lat: 56.68, lon: -5.10 };
  /**
   * Returns the unit vector toward the sun in world space (+y up, north = -z, east = +x)
   * for day-of-year N and local clock time (hours, BST = UTC+1 in summer).
   */
  RP.solarDirection = function (dayOfYear, localHours, latDeg, lonDeg, tzHours) {
    const lat = (latDeg ?? RP.GLENCOE.lat) * Math.PI / 180;
    const lon = lonDeg ?? RP.GLENCOE.lon;
    const tz = tzHours ?? 1;
    const gam = (2 * Math.PI / 365) * (dayOfYear - 1 + (localHours - 12) / 24);
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gam) - 0.032077 * Math.sin(gam) - 0.014615 * Math.cos(2 * gam) - 0.040849 * Math.sin(2 * gam));
    const decl = 0.006918 - 0.399912 * Math.cos(gam) + 0.070257 * Math.sin(gam) - 0.006758 * Math.cos(2 * gam) + 0.000907 * Math.sin(2 * gam) - 0.002697 * Math.cos(3 * gam) + 0.00148 * Math.sin(3 * gam);
    const tst = localHours * 60 + eqTime + 4 * lon - 60 * tz;        // true solar time (min)
    const ha = (tst / 4 - 180) * Math.PI / 180;                      // hour angle
    // local East-North-Up components of the solar unit vector
    const up = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    const east = -Math.cos(decl) * Math.sin(ha);
    const north = Math.cos(lat) * Math.sin(decl) - Math.sin(lat) * Math.cos(decl) * Math.cos(ha);
    // world: east = +x, up = +y, north = -z
    return new THREE.Vector3(east, up, -north).normalize();
  };

  // ---------------------------------------------------------------------------
  // Render-target / full-screen pass helpers
  // ---------------------------------------------------------------------------
  RP.makeRT = function (w, h, opts) {
    opts = opts || {};
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
      type: opts.type ?? THREE.HalfFloatType,
      format: opts.format ?? THREE.RGBAFormat,
      minFilter: opts.filter ?? THREE.LinearFilter,
      magFilter: opts.filter ?? THREE.LinearFilter,
      wrapS: opts.wrap ?? THREE.ClampToEdgeWrapping,
      wrapT: opts.wrap ?? THREE.ClampToEdgeWrapping,
      depthBuffer: !!opts.depth,
      stencilBuffer: false,
      generateMipmaps: false
    });
    if (opts.depthTexture) {
      rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height);
      rt.depthTexture.type = THREE.UnsignedIntType;
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
    }
    return rt;
  };

  const FS_VERT = `
    in vec3 position;
    out vec2 vUv;
    void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  // single over-sized triangle covering the viewport
  const fsGeo = new THREE.BufferGeometry();
  fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  RP.GLSL_COMMON = `
    precision highp float;
    precision highp int;
    precision highp sampler2D;
    precision highp sampler3D;
    #define PI 3.14159265358979
    float saturate(float x) { return clamp(x, 0.0, 1.0); }
    vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
    float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    // Jimenez 2014 interleaved gradient noise
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  `;

  RP.Pass = function (fragBody, uniforms, opts) {
    opts = opts || {};
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: uniforms || {},
      vertexShader: FS_VERT,
      fragmentShader: RP.GLSL_COMMON + (opts.defines || '') + '\nin vec2 vUv;\nlayout(location = 0) out highp vec4 outColor;\n' + fragBody,
      depthTest: false,
      depthWrite: false,
      blending: opts.blending ?? THREE.NoBlending,
      transparent: !!opts.blending
    });
    const mesh = new THREE.Mesh(fsGeo, mat);
    mesh.frustumCulled = false;
    const sc = new THREE.Scene();
    sc.add(mesh);
    this.material = mat;
    this.uniforms = mat.uniforms;
    this.scene = sc;
  };
  RP.Pass.prototype.render = function (renderer, target) {
    renderer.setRenderTarget(target || null);
    renderer.render(this.scene, fsCam);
  };

  RP.readRT = function (renderer, rt, x, y, w, h) {
    const buf = rt.texture.type === THREE.FloatType ? new Float32Array(w * h * 4) : new Uint16Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, x, y, w, h, buf);
    if (buf instanceof Uint16Array) {
      const out = new Float32Array(buf.length);
      for (let i = 0; i < buf.length; i++) out[i] = RP.halfToFloat(buf[i]);
      return out;
    }
    return buf;
  };
  RP.halfToFloat = function (hv) {
    const s = (hv & 0x8000) >> 15, e = (hv & 0x7c00) >> 10, f = hv & 0x03ff;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : (s ? -1 : 1) * Infinity;
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  };

  // ---------------------------------------------------------------------------
  // GLSL injected into the scene's own materials (custom ShaderMaterials and,
  // through onBeforeCompile, every built-in material)
  // ---------------------------------------------------------------------------
  RP.sceneUniforms = {
    rpSunDir: { value: new THREE.Vector3(0, 1, 0) },
    rpSunIllum: { value: new THREE.Vector3(1, 1, 1) },   // klx at ground, after atmospheric transmittance
    rpSH: { value: Array.from({ length: 9 }, () => new THREE.Vector3()) }, // irradiance-convolved SH9
    rpShadowMap: { value: null },
    rpShadowMatrix: { value: new THREE.Matrix4() },
    rpShadowTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
    rpCloudShadow: { value: null },
    rpCloudShadowXform: { value: new THREE.Vector4(0, 0, 1 / 4000, 0) },
    rpAlbedoGrass: { value: 1.0 },
    rpAlbedoFoliage: { value: 1.0 },
    rpGrassSat: { value: 0.5 },
    rpGrassDry: { value: 0.0 },
    rpFoliageSat: { value: 0.7 },
    rpTime: { value: 0 },
    rpCameraPos: { value: new THREE.Vector3() }
  };

  RP.GLSL_SCENE = `
    uniform vec3 rpSunDir;
    uniform vec3 rpSunIllum;
    uniform vec3 rpSH[9];
    uniform sampler2D rpShadowMap;
    uniform mat4 rpShadowMatrix;
    uniform vec2 rpShadowTexel;
    uniform sampler2D rpCloudShadow;
    uniform vec4 rpCloudShadowXform;
    uniform float rpAlbedoGrass;
    uniform float rpAlbedoFoliage;
    uniform float rpGrassSat;
    uniform float rpGrassDry;   // fraction of senescent (straw) blades, late-summer Highland grass
    uniform float rpFoliageSat;
    vec3 rpToLinear(vec3 c) {
      return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
    }
    // chroma scale at constant luminance (maps authored colours onto measured leaf reflectance)
    vec3 rpSat(vec3 c, float s) { float y = dot(c, vec3(0.2126, 0.7152, 0.0722)); return max(mix(vec3(y), c, s), vec3(0.0)); }
    // Irradiance E(n) from the convolved SH9 (Ramamoorthi & Hanrahan 2001)
    vec3 rpIrradiance(vec3 n) {
      vec3 e = rpSH[0] * 0.282095
             + rpSH[1] * (0.488603 * n.y) + rpSH[2] * (0.488603 * n.z) + rpSH[3] * (0.488603 * n.x)
             + rpSH[4] * (1.092548 * n.x * n.y) + rpSH[5] * (1.092548 * n.y * n.z)
             + rpSH[6] * (0.315392 * (3.0 * n.z * n.z - 1.0))
             + rpSH[7] * (1.092548 * n.x * n.z) + rpSH[8] * (0.546274 * (n.x * n.x - n.y * n.y));
      return max(e, vec3(0.0));
    }
    float rpUnpackDepth(vec4 v) { return dot(v, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0)) * (255.0/256.0); }
    // 12-tap rotated Poisson PCF on three's RGBA-packed directional shadow map
    float rpSunShadow(vec3 wp, vec3 n, float noise) {
      vec4 sc = rpShadowMatrix * vec4(wp + n * 0.04, 1.0);
      sc.xyz /= sc.w;
      if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
      float z = sc.z - 0.0009;
      float ang = noise * 6.2831853;
      mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
      vec2 P[12];
      P[0]=vec2(-0.326,-0.406); P[1]=vec2(-0.840,-0.074); P[2]=vec2(-0.696,0.457); P[3]=vec2(-0.203,0.621);
      P[4]=vec2(0.962,-0.195); P[5]=vec2(0.473,-0.480); P[6]=vec2(0.519,0.767); P[7]=vec2(0.185,-0.893);
      P[8]=vec2(0.507,0.064); P[9]=vec2(0.896,0.412); P[10]=vec2(-0.322,-0.933); P[11]=vec2(-0.792,-0.598);
      float s = 0.0;
      for (int i = 0; i < 12; i++) {
        vec2 o = R * P[i] * rpShadowTexel * 1.6;
        s += step(z, rpUnpackDepth(texture2D(rpShadowMap, sc.xy + o)));
      }
      return s / 12.0;
    }
    float rpCloudShadowAt(vec3 wp) {
      vec2 uv = (wp.xz - rpCloudShadowXform.xy) * rpCloudShadowXform.z + 0.5;
      return texture2D(rpCloudShadow, uv).r;
    }
    float rpIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    // GGX / Smith-correlated / Schlick specular, used by foliage and water
    float rpD_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (3.14159265 * d * d); }
    float rpV_Smith(float NoV, float NoL, float a) {
      float a2 = a * a;
      float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
      float gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
      return 0.5 / max(gv + gl, 1e-5);
    }
    float rpF_Schlick(float VoH, float f0) { return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0); }
  `;

  /** Copy the per-frame values the scene shaders read. */
  RP.bindSceneUniformsTo = function (uniformsObj) {
    for (const k in RP.sceneUniforms) uniformsObj[k] = RP.sceneUniforms[k];
    return uniformsObj;
  };
})(window);

(function (global) {
  'use strict';
  const RP = global.GlenmoreRP;
  const _eff = new Map();
  /**
   * Luminous intensity of an open wood fire (kcd):
   *   Φv = Q̇ · χr · K(T),  I = Φv / 2π   (fire radiates into the half-space in front of the hearth)
   * Q̇ heat release (kW), χr ≈ 0.30 radiant fraction of wood flames (Tewarson),
   * K(T) luminous efficacy of blackbody radiation at the soot temperature T.
   */
  RP.fireIntensityKcd = function (QkW, Tk) {
    // soot radiates hotter than the mean flame-body temperature of the hearth model (≈ +18 %)
    Tk = Tk * 1.18;
    const key = Math.round(Tk / 10);
    let K = _eff.get(key);
    if (K === undefined) { K = RP.blackbodyEfficacy(key * 10); _eff.set(key, K); }
    const flux = QkW * 1000 * 0.30 * K;          // lumens
    return flux / (2 * Math.PI) * 1e-3;          // kcd
  };
})(window);
