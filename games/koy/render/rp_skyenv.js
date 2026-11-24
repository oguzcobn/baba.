/* =============================================================================
 * GLENMORE RP — Sky irradiance (SH9) and specular IBL (PMREM) from the
 * physical atmosphere.
 *   • SH9 projection of sky + ground radiance on the GPU (9×1 float target),
 *     convolved with the clamped-cosine kernel (Â0 = π, Â1 = 2π/3, Â2 = π/4).
 *   • Sky cube (RGBE-encoded) → three.js PMREMGenerator → scene.environment.
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP;

  RP.SkyEnv = function (renderer, atmo) {
    this.renderer = renderer;
    this.atmo = atmo;
    const U = this.uniforms = Object.assign({}, atmo.uniforms, {
      uGroundRad: { value: new THREE.Vector3() },
      uCloudCover: { value: 0.0 },
      uCloudGrey: { value: new THREE.Vector3() }
    });

    // radiance in direction d, as seen from the valley: sky LUT above the local
    // horizon, Lambertian moorland below it (mountains and loch shore)
    const RAD_GLSL = RP.ATMO_GLSL + RP.SKY_SAMPLE_GLSL + `
      uniform sampler2D uTransLUT;
      uniform vec3 uLightDir;
      uniform float uViewR;
      uniform vec3 uGroundRad;
      uniform float uCloudCover;
      uniform vec3 uCloudGrey;
      vec3 envRadiance(vec3 d) {
        if (d.y < -0.02) return uGroundRad;
        vec3 sky = skyRadiance(d, uLightDir, uViewR);
        // overcast: clouds replace the clear sky by their own (diffuse, grey) radiance
        float cov = uCloudCover * smoothstep(-0.02, 0.25, d.y);
        sky = mix(sky, uCloudGrey * (0.75 + 0.35 * d.y), cov);
        return mix(uGroundRad, sky, smoothstep(-0.02, 0.02, d.y));
      }
    `;
    this.RAD_GLSL = RAD_GLSL;

    this.shRT = RP.makeRT(9, 1, { type: THREE.FloatType, filter: THREE.NearestFilter });
    this.shPass = new RP.Pass(RAD_GLSL + `
      float Y(int i, vec3 n) {
        if (i == 0) return 0.282095;
        if (i == 1) return 0.488603 * n.y;
        if (i == 2) return 0.488603 * n.z;
        if (i == 3) return 0.488603 * n.x;
        if (i == 4) return 1.092548 * n.x * n.y;
        if (i == 5) return 1.092548 * n.y * n.z;
        if (i == 6) return 0.315392 * (3.0 * n.z * n.z - 1.0);
        if (i == 7) return 1.092548 * n.x * n.z;
        return 0.546274 * (n.x * n.x - n.y * n.y);
      }
      void main() {
        int idx = int(floor(gl_FragCoord.x));
        // SH convention is z-up in the formula; we feed world (x,y,z) with y up and
        // evaluate the same basis in the scene shaders, so the convention cancels.
        const int NT = 24, NP = 48;
        vec3 acc = vec3(0.0);
        for (int i = 0; i < NT; i++) {
          float th = (float(i) + 0.5) / float(NT) * PI;
          float sw = sin(th) * (PI / float(NT)) * (2.0 * PI / float(NP));
          for (int j = 0; j < NP; j++) {
            float ph = (float(j) + 0.5) / float(NP) * 2.0 * PI;
            vec3 d = vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
            acc += envRadiance(d) * Y(idx, d) * sw;
          }
        }
        float A = idx == 0 ? PI : (idx < 4 ? 2.0 * PI / 3.0 : PI / 4.0);
        outColor = vec4(acc * A, 1.0);
      }`, U);

    // sky cube for the PMREM (RGBE in 8-bit: PMREMGenerator decodes it as HDR)
    this.cubeRT = new THREE.WebGLCubeRenderTarget(64, {
      type: THREE.UnsignedByteType, format: THREE.RGBAFormat, encoding: THREE.RGBEEncoding,
      generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter
    });
    this.cubeCam = new THREE.CubeCamera(0.1, 10, this.cubeRT);
    this.cubeScene = new THREE.Scene();
    const cubeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: U,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        #define PI 3.14159265358979
        float saturate(float x){ return clamp(x,0.0,1.0); }
        vec3 saturate(vec3 x){ return clamp(x,0.0,1.0); }
        ${RAD_GLSL.replace(/texture\(/g, 'texture2D(')}
        varying vec3 vDir;
        vec4 toRGBE(vec3 v) {
          float maxC = max(max(v.r, v.g), max(v.b, 1e-12));
          float e = clamp(ceil(log2(maxC)), -128.0, 127.0);
          return vec4(clamp(v / exp2(e), 0.0, 1.0), (e + 128.0) / 255.0);
        }
        void main(){ gl_FragColor = toRGBE(envRadiance(normalize(vDir))); }`
    });
    this.cubeScene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), cubeMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;

    this.shCPU = Array.from({ length: 9 }, () => new THREE.Vector3());
    this._lastEnvKey = '';
  };

  /**
   * Computes ground radiance for the env (albedo/π · (E_sun·cosθ + E_sky)) and
   * re-projects SH9 (cheap) every call; regenerates the PMREM only when the light
   * moved or changed noticeably.
   */
  RP.SkyEnv.prototype.update = function (lightInfo, groundAlbedo, cloudCover, force) {
    const U = this.uniforms;
    const E = lightInfo.illumGround;
    const mu = Math.max(0, lightInfo.dir.y);
    // first pass: ground lit by sun only; second (after SH): add sky irradiance on a horizontal plane
    const skyE = this.shCPU.length ? this.evalIrradiance(new THREE.Vector3(0, 1, 0)) : new THREE.Vector3();
    U.uGroundRad.value.set(
      groundAlbedo.x / Math.PI * (E.x * mu * (1 - 0.8 * cloudCover) + skyE.x),
      groundAlbedo.y / Math.PI * (E.y * mu * (1 - 0.8 * cloudCover) + skyE.y),
      groundAlbedo.z / Math.PI * (E.z * mu * (1 - 0.8 * cloudCover) + skyE.z));
    U.uCloudCover.value = cloudCover;
    // overcast cloud base radiance: thick stratus transmits ~ (1-cover) … use diffuse
    // transmission of a cloud layer with optical depth τ: T_d ≈ 1/(1+0.75τ(1-g)) (two-stream)
    const tau = 2 + 38 * cloudCover * cloudCover;
    const Td = 1 / (1 + 0.75 * tau * (1 - 0.85));
    U.uCloudGrey.value.set(E.x, E.y, E.z).multiplyScalar(Math.max(0.15, mu) * Td / Math.PI * 1.25);

    this.shPass.render(this.renderer, this.shRT);
    this._readSH(!!force);

    // specular IBL only needs refreshing when the sky changed visibly: > 3° of light motion,
    // > 0.5 EV of illuminance or > 0.08 cloud cover, and never more often than every 4 s
    const now = performance.now();
    const L = this._envLight || { dir: lightInfo.dir.clone(), ev: Math.log2(E.y + 1e-9), cov: cloudCover };
    const changed = lightInfo.dir.angleTo(L.dir) > 0.052 || Math.abs(Math.log2(E.y + 1e-9) - L.ev) > 0.5 || Math.abs(cloudCover - L.cov) > 0.08;
    const key = changed && (now - (this._envTime || 0) > 4000) ? String(now) : this._lastEnvKey;
    if (force || key !== this._lastEnvKey) {
      this._envLight = { dir: lightInfo.dir.clone(), ev: Math.log2(E.y + 1e-9), cov: cloudCover };
      this._envTime = now;
      this._lastEnvKey = key;
      const r = this.renderer;
      const prevTarget = r.getRenderTarget();
      this.cubeCam.update(r, this.cubeScene);
      const newEnv = this.pmrem.fromCubemap(this.cubeRT.texture);
      if (this.envRT) this.envRT.dispose();
      this.envRT = newEnv;
      r.setRenderTarget(prevTarget);
      return true;
    }
    return false;
  };

  /**
   * SH readback without stalling the GPU: WebGL2 pixel-pack buffer + fence, the result
   * is picked up on a later frame. `sync` forces the old blocking read (first frames only).
   */
  RP.SkyEnv.prototype._readSH = function (sync) {
    const r = this.renderer, gl = r.getContext();
    const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const apply = (px) => { for (let i = 0; i < 9; i++) this.shCPU[i].set(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); this.shVersion = (this.shVersion || 0) + 1; };
    if (sync || !isGL2) { apply(RP.readRT(r, this.shRT, 0, 0, 9, 1)); return; }
    this.pollSH();
    if (this._pending) return;                     // one read in flight at a time
    const props = r.properties.get(this.shRT);
    if (!props || !props.__webglFramebuffer) { apply(RP.readRT(r, this.shRT, 0, 0, 9, 1)); return; }
    if (!this._pbo) { this._pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, 9 * 4 * 4, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); }
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.shRT);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
    gl.readPixels(0, 0, 9, 1, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    r.setRenderTarget(prev);
    this._pending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    this._apply = apply;
  };
  RP.SkyEnv.prototype.pollSH = function () {
    if (!this._pending) return;
    const gl = this.renderer.getContext();
    const st = gl.clientWaitSync(this._pending, 0, 0);
    if (st === gl.TIMEOUT_EXPIRED) return;
    gl.deleteSync(this._pending); this._pending = null;
    const px = new Float32Array(36);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this._apply(px);
  };

  RP.SkyEnv.prototype.evalIrradiance = function (n) {
    const s = this.shCPU, x = n.x, y = n.y, z = n.z;
    const b = [0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z,
      0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)];
    const e = new THREE.Vector3();
    for (let i = 0; i < 9; i++) e.addScaledVector(s[i], b[i]);
    return e.max(new THREE.Vector3());
  };
})(window);
