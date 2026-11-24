/* =============================================================================
 * GLENMORE RP — orchestration
 * Owns the frame: light from astronomy + atmosphere, SH/IBL, cloud shadows,
 * jittered HDR scene pass, GTAO, clouds, fog, composite, TAA, bloom,
 * auto-exposure, local exposure and the filmic output.
 * Also patches every built-in three.js material so that it lives in the same
 * linear, physically scaled world (sRGB→linear inputs, emissive in kcd/m²,
 * cloud shadows on the sun, interior sky-visibility on the IBL).
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP;

  // ---------------------------------------------------------------------------
  // Weather → physical medium parameters.
  // Fog σ from Koschmieder's law V = ln(1/0.02)/σ = 3.912/σ (V = meteorological
  // visibility). Cloud base/top in metres above the glen floor.
  // ---------------------------------------------------------------------------
  RP.WEATHER = {
    // hazeKm: boundary-layer meteorological visibility → aerosol (Mie) turbidity of the atmosphere
    // fogKm / fogH: valley fog visibility at the glen floor and its scale height
    morning: { hazeKm: 22, fogKm: 5.0, fogH: 40, groundMist: 0.0018, mistH: 2.0, mieG: 0.76,
      cover: 0.46, type: 0.85, base: 950, top: 2400, density: 0.030, fogG: 0.70, hour: 9.25 },
    mist: { hazeKm: 7, fogKm: 0.7, fogH: 150, groundMist: 0.004, mistH: 6.0, mieG: 0.74,
      cover: 0.93, type: 0.12, base: 420, top: 1300, density: 0.045, fogG: 0.62, hour: null },
    sunset: { hazeKm: 26, fogKm: 9.0, fogH: 30, groundMist: 0.0010, mistH: 1.8, mieG: 0.78,
      cover: 0.52, type: 0.65, base: 1100, top: 2600, density: 0.028, fogG: 0.74, hour: 19.75 },
    storm: { hazeKm: 6, fogKm: 2.4, fogH: 260, groundMist: 0.0015, mistH: 4.0, mieG: 0.72,
      cover: 0.985, type: 0.35, base: 520, top: 3400, density: 0.06, fogG: 0.6, hour: null }
  };
  // Koschmieder: V = 3.912 / σ_ext (2 % contrast threshold), σ in 1/km for the atmosphere
  RP.turbidityFromVisibility = function (Vkm) {
    const sigma = 3.912 / Vkm;                 // total extinction at sea level, 1/km
    const sigmaR = 13.558e-3;                  // Rayleigh at 550 nm
    const sigmaM = Math.max(0.0, sigma - sigmaR);
    return Math.max(0.3, sigmaM / (3.996e-3 + 0.444e-3));
  };

  RP.QUALITY = {
    low:    { scale: 0.75, ao: false, aoSlices: 1, aoSteps: 4, fogSteps: 12, cloudSteps: 24, cloudLight: 3, cloudScale: 0.25, taa: true, local: false, bloomMips: 4, shadow: 1024 },
    medium: { scale: 1.0, ao: true, aoSlices: 1, aoSteps: 5, fogSteps: 16, cloudSteps: 32, cloudLight: 4, cloudScale: 0.25, taa: true, local: true, bloomMips: 5, shadow: 2048 },
    high:   { scale: 1.0, ao: true, aoSlices: 2, aoSteps: 6, fogSteps: 24, cloudSteps: 44, cloudLight: 5, cloudScale: 0.5, taa: true, local: true, bloomMips: 6, shadow: 2048 },
    ultra:  { scale: 1.0, ao: true, aoSlices: 3, aoSteps: 8, fogSteps: 36, cloudSteps: 64, cloudLight: 6, cloudScale: 0.5, taa: true, local: true, bloomMips: 6, shadow: 4096 }
  };

  // Calibrated parameters (overwritten by rp_calibration_result.js when present)
  RP.DEFAULT_PARAMS = {
    exposureComp: 0.0,      // EV
    bloom: 0.04,
    highlightContrast: 0.85,
    shadowContrast: 0.92,
    localDetail: 1.0,
    saturation: 1.0,
    contrast: 1.0,
    wbTemp: 6504,
    wbTint: 0,
    filmSlope: 0.88, filmToe: 0.55, filmShoulder: 0.26, filmBlackClip: 0.0, filmWhiteClip: 0.04,
    albedoGrass: 1.0,
    albedoFoliage: 1.0,
    grassSat: 0.5,
    grassDry: 0.0,
    foliageSat: 0.7,
    albedoScene: 1.0,
    albedoTerrain: 1.0,
    fogScale: 1.0,
    mistScale: 1.0,
    aerialScale: 1.0,
    aoStrength: 0.85,
    interiorSkyVis: 0.035,
    emissiveScale: 1.0,
    cloudDensityScale: 1.0,
    vignette: 0.18
  };

  // ---------------------------------------------------------------------------
  RP.Pipeline = function (renderer, scene, camera, opts) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.opts = opts || {};
    this.sunLight = opts.sunLight;
    this.hemiLight = opts.hemiLight;
    this.params = Object.assign({}, RP.DEFAULT_PARAMS, global.GLENMORE_CALIBRATION || {});
    this.enabled = true;
    this.debug = { noFog: false, noClouds: false, noAO: false };
    this.frame = 0;
    this.time = 0;
    this.weatherKey = 'morning';
    this.weather = Object.assign({}, RP.WEATHER.morning);
    this._wTarget = Object.assign({}, RP.WEATHER.morning);
    this.lightInfo = null;

    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.autoClear = true;
    scene.background = new THREE.Color(0, 0, 0);
    camera.far = Math.max(camera.far, 9000);
    camera.updateProjectionMatrix();

    this.atmo = new RP.Atmosphere(renderer);
    this.skyEnv = new RP.SkyEnv(renderer, this.atmo);
    this.post = new RP.Post(renderer, this.atmo);
    this.clouds = new RP.Clouds(renderer, this.atmo, this.post);

    this.matUniforms = {
      rpEmissiveScale: { value: 1.0 },
      rpInteriorBoxes: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
      rpInteriorBoxes2: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
      rpInteriorVis: { value: 0.035 },
      rpAlbedoScene: { value: 1.0 },
      rpBasicIllum: { value: new THREE.Vector3(1, 1, 1) },
      rpVColorScaleDefault: { value: 1.0 },
      rpFogP: { value: new THREE.Vector4(1e-5, 1e-4, 40, 0) },
      rpFogL: { value: new THREE.Vector3() }
    };
    this.terrainVColor = { value: 1.0 };

    this.quality = 'high';
    this.autoQuality = true;
    this._fpsAcc = 0; this._fpsN = 0; this._fpsT = 0;
    this.Q = RP.QUALITY.high;
    this._halton = [];
    for (let i = 1; i <= 16; i++) this._halton.push([RP.halton(i, 2) - 0.5, RP.halton(i, 3) - 0.5]);
    this.prevViewProj = new THREE.Matrix4();
    this._unjitteredProj = new THREE.Matrix4();
    this._shUpdateT = 0;
    this.stats = { ev: 0, targetEv: 0 };

    this.resize(true);
    this.applyParams();
  };

  RP.halton = function (i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

  RP.Pipeline.prototype.setQuality = function (q) {
    if (!RP.QUALITY[q]) return;
    this.quality = q;
    this.Q = RP.QUALITY[q];
    if (this.sunLight && this.sunLight.shadow.mapSize.width !== this.Q.shadow) {
      this.sunLight.shadow.mapSize.set(this.Q.shadow, this.Q.shadow);
      if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; }
    }
    this.resize(true);
  };

  RP.Pipeline.prototype.resize = function (force) {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const s = this.Q.scale;
    const W = Math.max(2, Math.round(size.x * s)), H = Math.max(2, Math.round(size.y * s));
    if (!force && this.W === W && this.H === H) return;
    this.W = W; this.H = H;
    const dispose = (rt) => { if (rt) rt.dispose(); };
    [this.sceneRT, this.aoRT, this.aoBlurRT, this.fogRT, this.cloudRT, this.compRT, this.lumRT, this.bilatRT, this.blurRT0, this.blurRT1]
      .forEach(dispose);
    (this.taaRT || []).forEach(dispose);
    (this.bloomRT || []).forEach(dispose);
    this.sceneRT = RP.makeRT(W, H, { depth: true, depthTexture: true });
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    this.aoRT = RP.makeRT(hw, hh, { filter: THREE.LinearFilter });
    this.aoBlurRT = RP.makeRT(hw, hh);
    this.fogRT = RP.makeRT(hw, hh);
    const cs = this.Q.cloudScale;
    this.cloudRT = RP.makeRT(Math.ceil(W * cs), Math.ceil(H * cs));
    this.compRT = RP.makeRT(W, H);
    if (this.transRT) this.transRT.dispose();
    this.transRT = RP.makeRT(W, H, { depth: true });
    this.transRT.depthTexture = this.sceneRT.depthTexture;  // transparents depth-test against the opaque pass
    this.taaRT = [RP.makeRT(W, H), RP.makeRT(W, H)];
    this.taaIdx = 0;
    this.bloomRT = [];
    let bw = W, bh = H;
    for (let i = 0; i < 7; i++) { bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2)); this.bloomRT.push(RP.makeRT(bw, bh)); }
    const qw = Math.ceil(W / 4), qh = Math.ceil(H / 4);
    this.lumRT = RP.makeRT(qw, qh);
    this.bilatRT = RP.makeRT(qw, qh);
    const ew = Math.ceil(W / 16), eh = Math.ceil(H / 16);
    this.blurRT0 = RP.makeRT(ew, eh);
    this.blurRT1 = RP.makeRT(ew, eh);
    this._taaReset = true;
    this.post.expUniforms.uReset.value = 1;
  };

  // ---------------------------------------------------------------------------
  // Parameters & weather
  // ---------------------------------------------------------------------------
  RP.Pipeline.prototype.applyParams = function () {
    const P = this.params, F = this.post.finalUniforms;
    this.post.expUniforms.uComp.value = P.exposureComp;
    F.uBloomStrength.value = P.bloom;
    F.uHighlightContrast.value = P.highlightContrast;
    F.uShadowContrast.value = P.shadowContrast;
    F.uDetail.value = P.localDetail;
    F.uSaturation.value = P.saturation;
    F.uContrast.value = P.contrast;
    F.uFilmSlope.value = P.filmSlope; F.uFilmToe.value = P.filmToe; F.uFilmShoulder.value = P.filmShoulder;
    F.uFilmBlackClip.value = P.filmBlackClip; F.uFilmWhiteClip.value = P.filmWhiteClip;
    F.uVignette.value = P.vignette;
    if (this.post.wbT !== P.wbTemp || this.post.wbTint !== P.wbTint) this.post.setWhiteBalance(P.wbTemp, P.wbTint);
    RP.sceneUniforms.rpAlbedoGrass.value = P.albedoGrass;
    RP.sceneUniforms.rpAlbedoFoliage.value = P.albedoFoliage;
    RP.sceneUniforms.rpGrassSat.value = P.grassSat;
    RP.sceneUniforms.rpGrassDry.value = P.grassDry;
    RP.sceneUniforms.rpFoliageSat.value = P.foliageSat;
    this.matUniforms.rpAlbedoScene.value = P.albedoScene;
    this.terrainVColor.value = P.albedoTerrain;
    this.matUniforms.rpInteriorVis.value = P.interiorSkyVis;
    this.post.fogUniforms.uIntVis.value = P.interiorSkyVis;
    this.matUniforms.rpEmissiveScale.value = P.emissiveScale;
    this.post.compUniforms.uAOStrength.value = P.aoStrength;
  };

  RP.Pipeline.prototype.setWeather = function (key, immediate) {
    if (!RP.WEATHER[key]) return;
    this.weatherKey = key;
    this._wTarget = Object.assign({}, RP.WEATHER[key]);
    if (immediate) this.weather = Object.assign({}, this._wTarget);
  };

  RP.Pipeline.prototype._blendWeather = function (dt) {
    const k = 1 - Math.exp(-dt * 0.6);
    for (const p in this._wTarget) {
      const t = this._wTarget[p];
      if (typeof t === 'number') this.weather[p] += (t - this.weather[p]) * k;
    }
    const W = this.weather, P = this.params;
    this.atmo.setWeather({ turbidity: RP.turbidityFromVisibility(W.hazeKm / P.aerialScale), mieG: W.mieG });
    const fu = this.post.fogUniforms;
    // calibrated against the clear-evening reference: applies to clear weather only (mist/storm keep their physical fog)
    fu.uFogDensity.value = 3.912 / (W.fogKm * 1000) * (W.fogKm > 3 ? P.fogScale : 1);
    fu.uFogHeight.value = W.fogH;
    fu.uGroundMist.value = W.groundMist * P.mistScale;
    fu.uGroundMistH.value = W.mistH;
    fu.uFogG.value = W.fogG;
    fu.uAerialScale.value = 1.0;
    const cu = this.clouds.uniforms;
    cu.uCoverage.value = W.cover;
    cu.uType.value = W.type;
    cu.uCloudBottom.value = W.base;
    cu.uCloudTop.value = W.top;
    cu.uDensity.value = W.density * P.cloudDensityScale;
  };

  /** Interior boxes for sky visibility: centre (x,z), half extents (hx,hz), rotY, yMin, yMax. */
  RP.Pipeline.prototype.setInteriorBox = function (i, cx, cz, hx, hz, rotY, yMin, yMax) {
    this.matUniforms.rpInteriorBoxes.value[i].set(cx, cz, hx, hz);
    this.matUniforms.rpInteriorBoxes2.value[i].set(rotY, yMin, yMax, 1);
    this.post.fogUniforms.uIntBox.value[i].set(cx, cz, hx, hz);
    this.post.fogUniforms.uIntBox2.value[i].set(rotY, yMin, yMax, 1);
  };

  // ---------------------------------------------------------------------------
  // Built-in material patching
  // ---------------------------------------------------------------------------
  const PATCH_HEAD = `
    uniform float rpEmissiveScale;
    uniform float rpEmissiveMul;
    uniform float rpAlbedoScene;
    uniform sampler2D rpCloudShadow;
    uniform vec4 rpCloudShadowXform;
    uniform vec4 rpInteriorBoxes[2];
    uniform vec4 rpInteriorBoxes2[2];
    uniform float rpInteriorVis;
    uniform float rpVColorScale;
    uniform vec4 rpFogP;         // x: aerial σ (1/m), y: fog σ0 (1/m), z: fog scale height, w: fog base
    uniform vec3 rpFogL;         // radiance of an optically thick fog/haze column
    varying vec3 vRpWorldPos;
    vec3 rpApplyFog(vec3 c) {
      vec3 d = vRpWorldPos - cameraPosition;
      float dist = length(d);
      float k = d.y / max(dist, 1e-3);
      float h0 = cameraPosition.y - rpFogP.w;
      // closed-form ∫ σ0 e^{-(h0 + k t)/H} dt
      float od = rpFogP.x * dist + rpFogP.y * rpFogP.z * exp(-max(h0, 0.0) / rpFogP.z) * (abs(k) > 1e-4 ? (1.0 - exp(-k * dist / rpFogP.z)) / k : dist / rpFogP.z);
      float T = exp(-max(od, 0.0));
      return c * T + rpFogL * (1.0 - T);
    }
    vec3 rpToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
    float rpCloudShadowAt(vec3 wp) {
      vec2 uv = (wp.xz - rpCloudShadowXform.xy) * rpCloudShadowXform.z + 0.5;
      return texture2D(rpCloudShadow, uv).r;
    }
    float rpSkyVisibility(vec3 wp) {
      float v = 1.0;
      for (int i = 0; i < 2; i++) {
        if (rpInteriorBoxes2[i].w < 0.5) continue;
        vec2 d = wp.xz - rpInteriorBoxes[i].xy;
        float c = cos(-rpInteriorBoxes2[i].x), s = sin(-rpInteriorBoxes2[i].x);
        d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
        vec2 q = abs(d) - rpInteriorBoxes[i].zw;
        float inside = (1.0 - smoothstep(-0.25, 0.05, max(q.x, q.y)))
                     * step(rpInteriorBoxes2[i].y, wp.y) * step(wp.y, rpInteriorBoxes2[i].z);
        v = min(v, mix(1.0, rpInteriorVis, inside));
      }
      return v;
    }
  `;
  const LIT = { MeshStandardMaterial: 1, MeshPhysicalMaterial: 1, MeshLambertMaterial: 1, MeshPhongMaterial: 1, MeshToonMaterial: 1 };

  RP.softDot = null;
  RP.getSoftDot = function () {
    if (RP.softDot) return RP.softDot;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    RP.softDot = new THREE.CanvasTexture(c);
    return RP.softDot;
  };
  RP.Pipeline.prototype.patchMaterial = function (mat) {
    if (mat && mat.isPointsMaterial && !mat.map && !mat.userData.rpPatched) { mat.map = RP.getSoftDot(); mat.transparent = true; mat.depthWrite = false; }
    if (!mat || mat.userData.rpPatched || mat.isShaderMaterial || mat.isRawShaderMaterial) return;
    if (mat.isMeshDepthMaterial || mat.isMeshDistanceMaterial) return;
    mat.userData.rpPatched = true;
    const self = this;
    const lit = !!LIT[mat.type];
    // texture colour maps are authored in sRGB
    ['map', 'emissiveMap'].forEach((k) => { if (mat[k] && mat[k].encoding !== THREE.sRGBEncoding) { mat[k].encoding = THREE.sRGBEncoding; mat[k].needsUpdate = true; } });
    if (mat.userData.rpEmissiveMul === undefined) mat.userData.rpEmissiveMul = RP.guessEmissiveMul(mat);
    if (mat.emissive && !mat.userData.rpEmissiveLinear) {
      mat.userData.rpEmissiveLinear = true;
      mat.emissive.convertSRGBToLinear();
    }
    const basicEmissive = !lit && (mat.blending === THREE.AdditiveBlending || mat.userData.rpAdditive || RP.BASIC_EMISSIVE[mat.color ? mat.color.getHex() : -1] !== undefined || mat.userData.rpEmissive);
    if (!lit && mat.userData.rpEmissiveMul === 1 && mat.color && RP.BASIC_EMISSIVE[mat.color.getHex()] !== undefined) mat.userData.rpEmissiveMul = RP.BASIC_EMISSIVE[mat.color.getHex()];
    if (!lit && (mat.blending === THREE.AdditiveBlending || mat.userData.rpAdditive) && mat.userData.rpEmissiveMul === 1) mat.userData.rpEmissiveMul = 2.0;
    const mul = { value: mat.userData.rpEmissiveMul };
    mat.userData.rpEmissiveMulUniform = mul;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = function (shader, renderer) {
      if (prev) prev.call(this, shader, renderer);
      Object.assign(shader.uniforms, self.matUniforms, {
        rpEmissiveMul: mul,
        rpVColorScale: mat.userData.rpVColorScale || self.matUniforms.rpVColorScaleDefault,
        rpCloudShadow: RP.sceneUniforms.rpCloudShadow,
        rpCloudShadowXform: RP.sceneUniforms.rpCloudShadowXform
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRpWorldPos;')
        .replace('#include <fog_vertex>', `#include <fog_vertex>
          { vec4 rpWp = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              rpWp = instanceMatrix * rpWp;
            #endif
            vRpWorldPos = (modelMatrix * rpWp).xyz; }`);
      let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + PATCH_HEAD);
      fs = fs.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( rpToLinear(diffuse) * rpAlbedoScene, opacity );');
      fs = fs.replace('#include <color_fragment>', '#ifdef USE_COLOR\n diffuseColor.rgb *= rpToLinear(vColor) * rpVColorScale;\n#endif');
      if (mat.transparent) fs = fs.replace('#include <fog_fragment>', 'gl_FragColor.rgb = rpApplyFog(gl_FragColor.rgb);');
      fs = fs.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * rpEmissiveScale * rpEmissiveMul;');
      if (lit) {
        // expand the light loop so that the directional term can be modulated per fragment
        fs = fs.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin);
        if (mat.userData.rpHorizonVis) fs = fs.replace('getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );',
          'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n directLight.color *= vRpHorizon;');
        fs = fs.replace('getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );',
          'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n directLight.color *= rpCloudShadowAt(vRpWorldPos);');
        fs = fs.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
          { float rpVis = rpSkyVisibility(vRpWorldPos);
            #if defined( RE_IndirectDiffuse )
              iblIrradiance *= rpVis;
            #endif
            #if defined( RE_IndirectSpecular )
              radiance *= rpVis;
            #endif
          }`);
      } else {
        // unlit materials: either emitters (k-nits per unit colour) or albedo under the ambient light
        fs = fs.replace('#include <tonemapping_fragment>',
          (basicEmissive ? 'gl_FragColor.rgb *= rpEmissiveScale * rpEmissiveMul;\n' : 'gl_FragColor.rgb *= rpBasicIllum * rpSkyVisibility(vRpWorldPos);\n') + '#include <tonemapping_fragment>');
        fs = fs.replace('uniform float rpEmissiveScale;', 'uniform float rpEmissiveScale;\nuniform vec3 rpBasicIllum;');
      }
      shader.fragmentShader = fs;
    };
    // the shader source depends on these flags: keep programs apart in three's cache
    const keyExtra = 'rp|' + (lit ? 1 : 0) + (basicEmissive ? 1 : 0) + (mat.userData.rpHorizonVis ? 1 : 0) + (mat.transparent ? 1 : 0);
    const prevKey = mat.customProgramCacheKey;
    mat.customProgramCacheKey = function () { return keyExtra + (prevKey ? prevKey.call(this) : ''); };
    mat.needsUpdate = true;
  };

  /** Emissive luminance per unit emissiveIntensity, in kcd/m² (by material colour). */
  // keyed by the authored sRGB hex of the emissive colour
  RP.EMISSIVE_MUL = {
    0xff9d3b: 0.006,   // cottage windows (interior seen through glass ≈ 5–15 cd/m²)
    0xff420a: 0.15,    // glowing embers ≈ 1100 K
    0xd43808: 0.12,
    0xff9a34: 1.4,     // paper lamp shades lit by a flame ≈ 1 kcd/m²
    0xffaa44: 1.4
  };
  // MeshBasic / Points colours that are light sources
  RP.BASIC_EMISSIVE = {
    0xffe0a3: 1.5,     // picture-lamp tube
    0xffd275: 4.0,     // oil-lamp flame (≈ 4 kcd/m²)
    0xff5418: 0.4,     // cigar ember
    0xffc864: 2.0      // fire sparks
  };
  RP.guessEmissiveMul = function (mat) {
    if (!mat.emissive) return 1;
    const hex = mat.emissive.getHex();
    return RP.EMISSIVE_MUL[hex] !== undefined ? RP.EMISSIVE_MUL[hex] : 0.05;
  };

  /** Give every custom ShaderMaterial that uses the RP lighting GLSL its shared uniforms. */
  RP.Pipeline.prototype.bindCustomMaterials = function () {
    this.scene.traverse(function (o) {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      if (o.customDepthMaterial) mats.push(o.customDepthMaterial);
      mats.forEach(function (m) {
        if (m && m.isShaderMaterial && !m.isRawShaderMaterial && /rpSunDir|rpSH|rpToLinear/.test(m.fragmentShader)) RP.bindSceneUniformsTo(m.uniforms);
      });
    });
  };

  RP.Pipeline.prototype.patchScene = function () {
    const self = this;
    this.scene.traverse(function (o) {
      if (o.isLight) { o.layers.enableAll(); return; }
      if (!o.material) return;
      const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
      // transparent geometry is drawn after the composite (layer 1), over the fogged opaque image
      if (m0 && m0.transparent && !o.userData.rpOpaquePass) o.layers.set(1);
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function (m) {
        if (m && m.blending === THREE.AdditiveBlending) {
          m.blending = THREE.CustomBlending;
          m.blendEquation = THREE.AddEquation;
          m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneFactor;
          m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
          m.userData.rpAdditive = true;
        }
      });
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => self.patchMaterial(m));
    });
  };

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  /**
   * @param {number} dt seconds
   * @param {object} env { dayOfYear, hours, wind: {x,z,speed} }
   */
  RP.Pipeline.prototype.render = function (dt, env) {
    const r = this.renderer, cam = this.camera, scene = this.scene, Q = this.Q;
    dt = Math.min(0.1, Math.max(1e-4, dt || 0.016));
    this.time += dt;
    this.frame++;
    // adaptive quality: step down when the frame rate stays below ~28 fps for 3 s
    if (this.autoQuality && this.frame > 60) {
      this._fpsT += dt; this._fpsN++;
      if (this._fpsT > 3) {
        const fps = this._fpsN / this._fpsT;
        this._fpsT = 0; this._fpsN = 0;
        const order = ['low', 'medium', 'high', 'ultra'];
        const i = order.indexOf(this.quality);
        if (fps < 28 && i > 0) this.setQuality(order[i - 1]);
      }
    }
    if (this.frame % 90 === 1) this.patchScene();
    this.resize(false);
    this._blendWeather(dt);

    // ---- light from astronomy --------------------------------------------------
    const sunDir = RP.solarDirection(env.dayOfYear, env.hours);
    const li = this.lightInfo = this.atmo.setLight(sunDir, 1);
    const sun = this.sunLight;
    if (sun) {
      const E = li.illumGround;
      const Y = 0.2126 * E.x + 0.7152 * E.y + 0.0722 * E.z;
      sun.intensity = Y;
      if (Y > 0) sun.color.setRGB(E.x / Y, E.y / Y, E.z / Y); else sun.color.setRGB(1, 1, 1);
      const tgt = sun.target.position;
      sun.position.copy(tgt).addScaledVector(li.dir, 60);
      sun.target.updateMatrixWorld();
      sun.castShadow = Y > 1e-7;
      if (this.debug.noSun) sun.intensity = 0;
    }
    if (this.hemiLight) this.hemiLight.intensity = 0;
    const SU = RP.sceneUniforms;
    SU.rpSunDir.value.copy(li.dir);
    SU.rpSunIllum.value.copy(li.illumGround);
    SU.rpTime.value = this.time;
    SU.rpCameraPos.value.copy(cam.position);

    this.atmo.update(cam.position.y);

    // ---- SH / IBL (throttled) ------------------------------------------------------
    this._shUpdateT -= dt;
    if (this._shUpdateT <= 0 || this.frame < 3) {
      this._shUpdateT = 0.25;
      const ga = this.atmo.params.groundAlbedo;
      const envChanged = this.skyEnv.update(li, ga, this.weather.cover * this.weather.cover, this.frame < 3);
      for (let i = 0; i < 9; i++) SU.rpSH.value[i].copy(this.skyEnv.shCPU[i]);
      if (envChanged) scene.environment = this.skyEnv.envRT.texture;
      this.clouds.uniforms.uGroundRad.value.copy(this.skyEnv.uniforms.uGroundRad.value);
      // unlit (MeshBasic/Points) albedo is lit by sky + ½ sun on a horizontal plane
      const up = this.skyEnv.evalIrradiance(new THREE.Vector3(0, 1, 0));
      const mu = Math.max(0, li.dir.y) * 0.5;
      this.matUniforms.rpBasicIllum.value.set(
        (up.x + li.illumGround.x * mu) / Math.PI, (up.y + li.illumGround.y * mu) / Math.PI, (up.z + li.illumGround.z * mu) / Math.PI);
    }

    // ---- cloud wind & shadows --------------------------------------------------------
    if (env.wind) {
      // geostrophic wind at cloud level ≈ 2.5× the 10 m wind (Ekman spiral, neglect veer)
      this.clouds.uniforms.uWind.value.x += env.wind.x * env.wind.speed * 2.5 * dt;
      this.clouds.uniforms.uWind.value.z += env.wind.z * env.wind.speed * 2.5 * dt;
      this.clouds.uniforms.uWind.value.y += dt * 0.6;
    }
    this.clouds.renderShadow(cam.position);
    if (this.debug.noCloudShadow) {
      if (!this._whiteTex) { this._whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); this._whiteTex.needsUpdate = true; }
      RP.sceneUniforms.rpCloudShadow.value = this._whiteTex;
    } else RP.sceneUniforms.rpCloudShadow.value = this.clouds.shadowRT.texture;

    // ---- shadow map binding ----------------------------------------------------------
    if (sun && sun.shadow.map) {
      SU.rpShadowMap.value = sun.shadow.map.texture;
      SU.rpShadowMatrix.value.copy(sun.shadow.matrix);
      SU.rpShadowTexel.value.set(1 / sun.shadow.mapSize.x, 1 / sun.shadow.mapSize.y);
    }

    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, cam);
      return;
    }

    // ---- jittered scene pass ---------------------------------------------------------
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    this._unjitteredProj.copy(cam.projectionMatrix);
    const jit = Q.taa && !this.noJitter ? this._halton[this.frame % 8] : [0, 0];
    const jx = (jit[0] * 2) / this.W, jy = (jit[1] * 2) / this.H;
    cam.projectionMatrix.elements[8] += jx;
    cam.projectionMatrix.elements[9] += jy;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    this._jitteredProj = (this._jitteredProj || new THREE.Matrix4()).copy(cam.projectionMatrix);
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    cam.layers.set(0);
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, cam);

    const C = this.post.common;
    C.uDepth.value = this.sceneRT.depthTexture;
    C.uInvProj.value.copy(cam.projectionMatrixInverse);
    C.uProj.value.copy(cam.projectionMatrix);
    C.uCamWorld.value.copy(cam.matrixWorld);
    C.uNearFar.value.set(cam.near, cam.far);
    C.uFrame.value = this.frame;
    const expTex = this.post.expRT[this.post.expIdx].texture;
    C.uExposureTex.value = expTex;
    this.post.compUniforms.uExposureTex.value = expTex;
    this.post.taaUniforms.uExposureTex.value = expTex;
    this.post.finalUniforms.uExposureTex.value = expTex;
    this.post.histUniforms.uExposureTex.value = expTex;
    this.post.fogUniforms.uCamPosW.value.copy(cam.position);
    this.clouds.uniforms.uCamPosW.value.copy(cam.position);

    // restore projection for the rest of the app
    cam.projectionMatrix.copy(this._unjitteredProj);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // ---- transparent pass (layer 1): premultiplied 'over' accumulation, composited after fog -----
    {
      cam.projectionMatrix.copy(this._jitteredProj);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      cam.layers.set(1);
      const bg = scene.background; scene.background = null;
      const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
      r.setRenderTarget(this.transRT);
      r.setClearColor(0x000000, 0);
      r.clear(true, false, false);             // keep the shared depth
      r.autoClear = false;
      r.render(scene, cam);
      r.autoClear = true;
      r.setClearColor(cc, ca);
      scene.background = bg;
      cam.layers.set(0);
      cam.projectionMatrix.copy(this._unjitteredProj);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      r.shadowMap.autoUpdate = true;
    }

    // ---- GTAO -----------------------------------------------------------------------------
    const P = this.post;
    if (Q.ao) {
      P.aoPass.uniforms.uRes.value.set(this.aoRT.width, this.aoRT.height);
      P.aoPass.uniforms.uSlices.value = Q.aoSlices;
      P.aoPass.uniforms.uSteps.value = Q.aoSteps;
      Object.assign(P.aoPass.uniforms, C);
      P.aoPass.render(r, this.aoRT);
      P.aoBlurPass.uniforms.uAO.value = this.aoRT.texture;
      P.aoBlurPass.uniforms.uRes.value.set(this.aoRT.width, this.aoRT.height);
      P.aoBlurPass.render(r, this.aoBlurRT);
    }
    // ---- clouds ------------------------------------------------------------------------------
    const useClouds = this.clouds.ready;
    if (useClouds) {
      this.clouds.uniforms.uSteps.value = Q.cloudSteps;
      this.clouds.uniforms.uLightSteps.value = Q.cloudLight;
      this.clouds.cloudPass.render(r, this.cloudRT);
    }
    // ---- fog ----------------------------------------------------------------------------------
    P.fogUniforms.uSteps.value = Q.fogSteps;
    P.fogPass.render(r, this.fogRT);

    // ---- composite ----------------------------------------------------------------------------
    const CU = P.compUniforms;
    CU.uScene.value = this.sceneRT.texture;
    CU.uAO.value = this.aoBlurRT.texture;
    CU.uFog.value = this.fogRT.texture;
    CU.uClouds.value = this.cloudRT.texture;
    CU.uFogRes.value.set(this.fogRT.width, this.fogRT.height);
    CU.uUseAO.value = Q.ao ? 1 : 0;
    CU.uUseClouds.value = useClouds && !this.debug.noClouds ? 1 : 0;
    // fog parameters for forward-shaded transparents (closed-form height fog + grey aerial term)
    {
      const fu = P.fogUniforms, ag = this.atmo.uniforms;
      const sigAir = (ag.uRayleighSca.value.y + ag.uMieSca.value + ag.uMieAbs.value) * 1e-3;
      this.matUniforms.rpFogP.value.set(sigAir, fu.uFogDensity.value + fu.uGroundMist.value * 0.3, fu.uFogHeight.value, fu.uFogBase.value);
      const eUp = this.skyEnv.evalIrradiance(new THREE.Vector3(0, 1, 0));
      const eSide = this.skyEnv.evalIrradiance(new THREE.Vector3(0.7, 0.2, 0.7).normalize());
      const s2 = 0.5 / Math.PI;
      this.matUniforms.rpFogL.value.set((eUp.x + eSide.x) * s2, (eUp.y + eSide.y) * s2, (eUp.z + eSide.z) * s2);
    }
    CU.uUseFog.value = this.debug.noFog ? 0 : 1;
    if (this.debug.noAO) CU.uUseAO.value = 0;
    CU.uTrans.value = this.transRT.texture;
    P.compPass.render(r, this.compRT);

    // ---- TAA ------------------------------------------------------------------------------------
    let resolved = this.compRT;
    const vp = new THREE.Matrix4().multiplyMatrices(this._unjitteredProj, cam.matrixWorldInverse);
    if (Q.taa) {
      const TU = P.taaUniforms;
      const hist = this.taaRT[this.taaIdx], out = this.taaRT[1 - this.taaIdx];
      TU.uCurrent.value = this.compRT.texture;
      TU.uHistory.value = hist.texture;
      TU.uPrevViewProj.value.copy(this.prevViewProj);
      TU.uCurViewProjInv.value.copy(vp).invert();
      TU.uJitter.value.set(jx, jy);
      TU.uRes.value.set(this.W, this.H);
      TU.uReset.value = this._taaReset ? 1 : 0;
      Object.assign(TU, { uDepth: C.uDepth, uInvProj: C.uInvProj, uCamWorld: C.uCamWorld });
      P.taaPass.render(r, out);
      this.taaIdx = 1 - this.taaIdx;
      resolved = out;
      this._taaReset = false;
    }
    this.prevViewProj.copy(vp);
    this.resolvedRT = resolved;

    // ---- bloom ------------------------------------------------------------------------------------
    const mips = Q.bloomMips;
    let src = resolved;
    for (let i = 0; i < mips; i++) {
      P.bloomDown.uniforms.uTex.value = src.texture;
      P.bloomDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      P.bloomDown.uniforms.uFirst.value = i === 0 ? 1 : 0;
      P.bloomDown.render(r, this.bloomRT[i]);
      src = this.bloomRT[i];
    }
    for (let i = mips - 1; i > 0; i--) {
      P.bloomUp.uniforms.uTex.value = this.bloomRT[i].texture;
      P.bloomUp.uniforms.uTexel.value.set(1 / this.bloomRT[i].width, 1 / this.bloomRT[i].height);
      r.autoClear = false;
      P.bloomUp.render(r, this.bloomRT[i - 1]);
      r.autoClear = true;
    }

    // ---- exposure ----------------------------------------------------------------------------------
    P.histUniforms.uTex.value = resolved.texture;
    r.setRenderTarget(this.histRTRef || P.histRT);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
    r.autoClear = false;
    r.render(P.histScene, P.histCam);
    r.autoClear = true;
    const EU = P.expUniforms;
    EU.uPrevExp.value = P.expRT[P.expIdx].texture;
    EU.uDt.value = dt;
    P.expPass.render(r, P.expRT[1 - P.expIdx]);
    EU.uReset.value = 0;

    // ---- local exposure -----------------------------------------------------------------------------
    if (Q.local) {
      P.lumPass.uniforms.uTex.value = resolved.texture;
      P.lumPass.render(r, this.lumRT);
      P.bilatPass.uniforms.uTex.value = this.lumRT.texture;
      P.bilatPass.uniforms.uTexel.value.set(1 / this.lumRT.width, 1 / this.lumRT.height);
      P.bilatPass.render(r, this.bilatRT);
      P.blurPass.uniforms.uTex.value = this.lumRT.texture;
      P.blurPass.uniforms.uDir.value.set(4 / this.lumRT.width, 0);
      P.blurPass.render(r, this.blurRT0);
      P.blurPass.uniforms.uTex.value = this.blurRT0.texture;
      P.blurPass.uniforms.uDir.value.set(0, 4 / this.lumRT.height);
      P.blurPass.render(r, this.blurRT1);
    }

    // ---- final -----------------------------------------------------------------------------------------
    const FU = P.finalUniforms;
    FU.uTex.value = resolved.texture;
    FU.uBloom.value = this.bloomRT[0].texture;
    FU.uLocalBase.value = this.bilatRT.texture;
    FU.uLocalBlur.value = this.blurRT1.texture;
    FU.uUseLocal.value = Q.local ? 1 : 0;
    FU.uRes.value.set(this.W, this.H);
    P.finalPass.render(r, this.outputTarget || null);

    // swap exposure for next frame
    P.expIdx = 1 - P.expIdx;
  };

  /** Reads the current exposure state {exposure, prev, ev, target}. */
  RP.Pipeline.prototype.readExposure = function () {
    const px = RP.readRT(this.renderer, this.post.expRT[this.post.expIdx], 0, 0, 1, 1);
    return { exposure: px[0], prev: px[1], ev: px[2], target: px[3] };
  };
})(window);
