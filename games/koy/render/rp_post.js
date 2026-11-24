/* =============================================================================
 * GLENMORE RP — post-processing passes
 *   GTAO ........ Jimenez, Wu, Pesce, Jarabo 2016 "Practical Real-Time Strategies
 *                 for Accurate Indirect Occlusion" (XeGTAO formulation)
 *   Fog ......... exponential height fog (closed-form transmittance) + ray-marched
 *                 single scattering with shadow-map god rays, Henyey–Greenstein,
 *                 Rayleigh/Mie aerial perspective; σ from Koschmieder V = 3.912/σ
 *   Composite ... physical sky + sun disc + clouds + AO + fog, pre-exposure
 *   TAA ......... Karis 2014 "High Quality Temporal Supersampling", Salvi 2016
 *                 variance clipping, Catmull-Rom history (Jimenez 5-tap)
 *   Bloom ....... Jimenez 2014 (CoD:AW) 13-tap down / tent up, Karis average
 *   Exposure .... Unreal-style log2 histogram (64 bins) with percentile window,
 *                 EV100 & S/K calibration (Lagarde & de Rousiers 2014)
 *   Local exp. .. Unreal 5 local exposure: bilateral log-luminance base layer
 *   Tonemap ..... Unreal "Filmic" ACES-fitted curve (Slope/Toe/Shoulder/Clips),
 *                 Bradford white balance, sRGB OETF, triangular dither
 * ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const RP = global.GlenmoreRP;

  RP.DEPTH_GLSL = `
    uniform sampler2D uDepth;
    uniform mat4 uInvProj;
    uniform mat4 uCamWorld;
    uniform vec2 uNearFar;
    float rawDepth(vec2 uv) { return texture(uDepth, uv).r; }
    vec3 viewPosFromDepth(vec2 uv, float d) {
      vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      return p.xyz / p.w;
    }
    vec3 viewPos(vec2 uv) { return viewPosFromDepth(uv, rawDepth(uv)); }
    vec3 worldFromView(vec3 v) { return (uCamWorld * vec4(v, 1.0)).xyz; }
    vec3 viewDirWorld(vec2 uv) {
      vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
      return normalize(mat3(uCamWorld) * (p.xyz / p.w));
    }
  `;

  // ---------------------------------------------------------------------------
  RP.Post = function (renderer, atmo, opts) {
    this.renderer = renderer;
    this.atmo = atmo;
    this.frame = 0;

    const common = this.common = {
      uDepth: { value: null },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uNearFar: { value: new THREE.Vector2(0.15, 6000) },
      uProj: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uFrame: { value: 0 },
      uExposureTex: { value: null }
    };

    // ---------------- GTAO -------------------------------------------------
    this.aoPass = new RP.Pass(RP.DEPTH_GLSL + `
      uniform mat4 uProj;
      uniform vec2 uRes;      // AO target resolution
      uniform float uFrame;
      uniform float uRadius;  // metres
      uniform int uSlices;
      uniform int uSteps;
      vec3 normalFromDepth(vec2 uv, vec3 P, vec2 px) {
        vec3 r = viewPos(uv + vec2(px.x, 0.0)) - P, l = P - viewPos(uv - vec2(px.x, 0.0));
        vec3 t = viewPos(uv + vec2(0.0, px.y)) - P, b = P - viewPos(uv - vec2(0.0, px.y));
        vec3 dx = abs(r.z) < abs(l.z) ? r : l;
        vec3 dy = abs(t.z) < abs(b.z) ? t : b;
        return normalize(cross(dx, dy));
      }
      void main() {
        float d = rawDepth(vUv);
        if (d >= 1.0) { outColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
        vec3 P = viewPosFromDepth(vUv, d);
        vec2 px = 1.0 / uRes;
        vec3 N = normalFromDepth(vUv, P, px);
        vec3 V = normalize(-P);
        float noiseSlice = ign(gl_FragCoord.xy + 5.588238 * mod(uFrame, 64.0));
        float noiseStep = hash12(gl_FragCoord.xy + 17.0 * mod(uFrame, 64.0));
        // projected radius in uv
        float screenR = uRadius * uProj[1][1] * 0.5 / max(-P.z, 0.1);
        screenR = min(screenR, 0.12);
        float falloffRange = 0.6 * uRadius;
        float falloffFrom = uRadius - falloffRange;
        float falloffMul = -1.0 / falloffRange, falloffAdd = falloffFrom / falloffRange + 1.0;
        float vis = 0.0;
        float aspect = uRes.x / uRes.y;
        for (int s = 0; s < 4; s++) {
          if (s >= uSlices) break;
          float phi = (float(s) + noiseSlice) / float(uSlices) * PI;
          vec2 omega = vec2(cos(phi), sin(phi));
          vec3 dirV = vec3(omega, 0.0);
          vec3 orthoDir = dirV - dot(dirV, V) * V;
          vec3 axis = normalize(cross(orthoDir, V));
          vec3 projN = N - axis * dot(N, axis);
          float projNLen = length(projN);
          float signN = sign(dot(orthoDir, projN));
          float cosN = saturate(dot(projN, V) / max(projNLen, 1e-5));
          float n = signN * acos(cosN);
          float low0 = cos(n + PI * 0.5), low1 = cos(n - PI * 0.5);
          float hc0 = low0, hc1 = low1;
          vec2 omegaUV = omega * vec2(screenR / aspect, screenR);
          for (int k = 0; k < 8; k++) {
            if (k >= uSteps) break;
            float st = (float(k) + noiseStep) / float(uSteps);
            st = st * st + 0.002;
            vec2 o = omegaUV * st;
            vec3 S0 = viewPos(vUv + o), S1 = viewPos(vUv - o);
            vec3 d0 = S0 - P, d1 = S1 - P;
            float l0 = length(d0), l1 = length(d1);
            float w0 = saturate(l0 * falloffMul + falloffAdd), w1 = saturate(l1 * falloffMul + falloffAdd);
            float c0 = mix(low0, dot(d0 / l0, V), w0);
            float c1 = mix(low1, dot(d1 / l1, V), w1);
            hc0 = max(hc0, c0); hc1 = max(hc1, c1);
          }
          float h0 = -acos(clamp(hc1, -1.0, 1.0));
          float h1 = acos(clamp(hc0, -1.0, 1.0));
          h0 = n + clamp(h0 - n, -PI * 0.5, PI * 0.5);
          h1 = n + clamp(h1 - n, -PI * 0.5, PI * 0.5);
          float a0 = (cosN + 2.0 * h0 * sin(n) - cos(2.0 * h0 - n)) * 0.25;
          float a1 = (cosN + 2.0 * h1 * sin(n) - cos(2.0 * h1 - n)) * 0.25;
          vis += projNLen * (a0 + a1);
        }
        vis /= float(uSlices);
        outColor = vec4(saturate(vis), -P.z, 0.0, 1.0);
      }`, Object.assign({}, common, {
      uRadius: { value: 1.1 }, uSlices: { value: 2 }, uSteps: { value: 6 }
    }));

    // depth-aware 4×4 denoise (Jimenez: AO noise has a 4×4 structure)
    this.aoBlurPass = new RP.Pass(`
      uniform sampler2D uAO;
      uniform vec2 uRes;
      void main() {
        vec2 px = 1.0 / uRes;
        vec2 c = texture(uAO, vUv).rg;
        if (c.g <= 0.0) { outColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
        float sum = 0.0, wsum = 0.0;
        for (int y = -2; y <= 1; y++) for (int x = -2; x <= 1; x++) {
          vec2 s = texture(uAO, vUv + (vec2(x, y) + 0.5) * px).rg;
          float w = exp(-abs(s.g - c.g) / (0.04 * c.g + 0.02));
          sum += s.r * w; wsum += w;
        }
        outColor = vec4(sum / max(wsum, 1e-4), c.g, 0.0, 1.0);
      }`, { uAO: { value: null }, uRes: { value: new THREE.Vector2() } });

    // ---------------- Volumetric fog / aerial perspective -------------------
    this.fogUniforms = Object.assign({}, common, atmo.uniforms, RP.sceneUniforms, {
      uFogDensity: { value: 0.0006 },      // σ_t at base height, 1/m
      uFogHeight: { value: 35.0 },         // scale height (m)
      uFogBase: { value: 0.0 },            // m (world y)
      uGroundMist: { value: 0.0 },         // extra dense layer near the ground (1/m)
      uGroundMistH: { value: 2.5 },
      uFogG: { value: 0.72 },
      uFogAlbedo: { value: new THREE.Vector3(0.98, 0.98, 0.98) },
      uSteps: { value: 24 },
      uAerialScale: { value: 1.0 },
      uSkyDist: { value: 4000.0 },
      uIntBox: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uIntBox2: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uIntVis: { value: 0.035 }
    });
    this.fogPass = new RP.Pass(RP.ATMO_GLSL + RP.DEPTH_GLSL + RP.GLSL_SCENE.replace(/texture2D\(/g, 'texture(') + `
      uniform float uFrame;
      uniform float uFogDensity, uFogHeight, uFogBase, uGroundMist, uGroundMistH, uFogG;
      uniform vec3 uFogAlbedo;
      uniform int uSteps;
      uniform float uAerialScale, uSkyDist;
      uniform vec3 uLightDir;
      float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
      uniform vec4 uIntBox[2];
      uniform vec4 uIntBox2[2];
      uniform float uIntVis;
      float interiorMask(vec3 wp) {
        float m = 0.0;
        for (int i = 0; i < 2; i++) {
          if (uIntBox2[i].w < 0.5) continue;
          vec2 d = wp.xz - uIntBox[i].xy;
          float c = cos(-uIntBox2[i].x), s = sin(-uIntBox2[i].x);
          d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
          vec2 q = abs(d) - uIntBox[i].zw;
          m = max(m, step(max(q.x, q.y), 0.0) * step(uIntBox2[i].y, wp.y) * step(wp.y, uIntBox2[i].z));
        }
        return m;
      }
      float fogSigma(float y) {
        return uFogDensity * exp(-max(y - uFogBase, 0.0) / uFogHeight)
             + uGroundMist * exp(-max(y - uFogBase, 0.0) / uGroundMistH);
      }
      void main() {
        float d = rawDepth(vUv);
        bool sky = d >= 1.0;
        vec3 ro = cameraPositionW();
        vec3 rd = viewDirWorld(vUv);
        float tMax = sky ? uSkyDist : length(viewPosFromDepth(vUv, d));
        tMax = min(tMax, 6000.0);
        // atmosphere (Rayleigh + Mie) only for geometry: the sky LUT already contains it
        float aer = sky ? 0.0 : uAerialScale * 1e-3;
        vec3 sigR = uRayleighSca * aer;
        float sigM = uMieSca * aer, sigMa = uMieAbs * aer;
        float c = dot(rd, rpSunDir);
        float pF = hg(c, uFogG), pR = phaseRayleigh(c), pM = phaseMie(c, uMieG);
        vec3 ambRad = rpSH[0] * 0.282095 / PI;          // mean sky radiance
        vec3 ambUp = rpIrradiance(vec3(0.0, 1.0, 0.0)) / PI;
        vec3 amb = mix(ambRad, ambUp, 0.35);
        float jitter = ign(gl_FragCoord.xy + 5.588238 * mod(uFrame, 64.0));
        vec3 T = vec3(1.0), L = vec3(0.0);
        float tPrev = 0.0;
        for (int i = 0; i < 48; i++) {
          if (i >= uSteps) break;
          float f = (float(i) + jitter) / float(uSteps);
          float tCur = tMax * f * f;
          float f2 = (float(i) + 1.0) / float(uSteps);
          float tEnd = tMax * f2 * f2;
          float dt = tEnd - tPrev;
          tPrev = tEnd;
          vec3 p = ro + rd * tCur;
          float inside = interiorMask(p);
          float sf = fogSigma(p.y) * (1.0 - 0.9 * inside);   // mist barely enters the cottage
          vec3 sca = sf * uFogAlbedo + sigR + vec3(sigM);
          vec3 ext = vec3(sf) + sigR + vec3(sigM + sigMa);
          float vis = 1.0;
          if (tCur < 70.0) vis = rpSunShadow(p, vec3(0.0), jitter);
          vis *= rpCloudShadowAt(p);
          vec3 sunIn = rpSunIllum * vis * (sf * uFogAlbedo * pF + sigR * pR + vec3(sigM * pM));
          vec3 inS = sunIn + sca * amb * mix(1.0, uIntVis, inside);
          vec3 Ts = exp(-ext * dt);
          L += T * (inS - inS * Ts) / max(ext, vec3(1e-9));
          T *= Ts;
        }
        outColor = vec4(L, dot(T, vec3(0.3333)));
      }`, this.fogUniforms, {
      defines: `uniform vec3 uCamPosW;\nvec3 cameraPositionW(){ return uCamPosW; }\n`
    });
    this.fogUniforms.uCamPosW = { value: new THREE.Vector3() };
    this.fogPass.material.uniforms.uCamPosW = this.fogUniforms.uCamPosW;

    // ---------------- Composite ------------------------------------------------
    this.compUniforms = Object.assign({}, common, atmo.uniforms, {
      uScene: { value: null },
      uAO: { value: null },
      uFog: { value: null },
      uClouds: { value: null },
      uTrans: { value: null },
      uAOStrength: { value: 1.0 },
      uAOAlbedo: { value: 0.3 },
      uFogRes: { value: new THREE.Vector2() },
      uUseAO: { value: 1 },
      uUseClouds: { value: 1 },
      uUseFog: { value: 1 },
      uCamPosW: this.fogUniforms.uCamPosW
    });
    this.compPass = new RP.Pass(RP.ATMO_GLSL + RP.DEPTH_GLSL + RP.SKY_SAMPLE_GLSL + `
      uniform sampler2D uScene, uAO, uFog, uClouds, uTrans, uTransLUT, uExposureTex;
      uniform mat4 uProj;
      uniform float uFrame;
      uniform vec3 uLightDir;
      uniform float uViewR, uAOStrength, uAOAlbedo;
      uniform vec2 uFogRes;
      uniform int uUseAO, uUseClouds, uUseFog;
      // depth-guided bilateral upsample of a half-res buffer
      vec4 upsample(sampler2D tex, vec2 uv, vec2 lowRes, float zFull) {
        vec2 st = uv * lowRes - 0.5;
        vec2 i = floor(st), f = fract(st);
        vec4 acc = vec4(0.0); float wsum = 0.0;
        for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
          vec2 o = vec2(x, y);
          vec2 suv = (i + o + 0.5) / lowRes;
          float zs = -viewPos(suv).z;
          float wb = (x == 0 ? 1.0 - f.x : f.x) * (y == 0 ? 1.0 - f.y : f.y);
          float wz = 1.0 / (1e-3 + abs(zs - zFull) / max(zFull, 0.1));
          float w = wb * wz;
          acc += texture(tex, suv) * w; wsum += w;
        }
        return acc / max(wsum, 1e-6);
      }
      // screen-space reflection for water pixels (planar normal, view-space ray march + bisection)
      vec3 waterSSR(vec2 uv, float d, vec3 rdW, float F) {
        vec3 P = viewPosFromDepth(uv, d);
        vec3 Nv = normalize(transpose(mat3(uCamWorld)) * vec3(0.0, 1.0, 0.0));
        vec3 Rv = normalize(reflect(normalize(P), Nv));
        float dist = length(P);
        float t = 0.02 * dist + 0.05;
        float jitter = ign(gl_FragCoord.xy + 3.1 * mod(uFrame, 32.0));
        t *= 1.0 + 0.5 * jitter;
        vec2 hitUV = vec2(-1.0);
        float tPrev = 0.0;
        for (int i = 0; i < 40; i++) {
          vec3 Q = P + Rv * t;
          if (Q.z > -0.05) break;
          vec4 c = uProj * vec4(Q, 1.0);
          vec2 q = c.xy / c.w * 0.5 + 0.5;
          if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) break;
          float sd = rawDepth(q);
          if (sd < 1.0) {
            float sz = -viewPosFromDepth(q, sd).z;
            float rz = -Q.z;
            float thick = 0.15 + t * 0.08;
            if (rz > sz && rz - sz < thick) {
              // bisection refinement
              float a = tPrev, b = t;
              for (int k = 0; k < 5; k++) {
                float m = 0.5 * (a + b);
                vec3 M = P + Rv * m;
                vec4 cm = uProj * vec4(M, 1.0);
                vec2 qm = cm.xy / cm.w * 0.5 + 0.5;
                float szm = -viewPos(qm).z;
                if (-M.z > szm) { b = m; q = qm; } else a = m;
              }
              hitUV = q;
              break;
            }
          }
          tPrev = t;
          t = t * 1.13 + 0.04;
        }
        if (hitUV.x < 0.0) return vec3(0.0);
        vec2 e = smoothstep(0.0, 0.08, hitUV) * smoothstep(0.0, 0.08, 1.0 - hitUV);
        float fade = e.x * e.y;
        vec3 hitCol = texture(uScene, hitUV).rgb;
        vec3 Rw = reflect(rdW, vec3(0.0, 1.0, 0.0));
        vec3 skyR = skyRadiance(Rw, uLightDir, uViewR);
        return F * (hitCol - skyR) * fade;
      }
      float multiBounce(float v, float albedo) {
        float a = 2.0404 * albedo - 0.3324, b = -4.7951 * albedo + 0.6417, c = 2.7552 * albedo + 0.6903;
        return max(v, ((v * a + b) * v + c) * v);
      }
      void main() {
        float exposure = texelFetch(uExposureTex, ivec2(0, 0), 0).r;
        float d = rawDepth(vUv);
        bool sky = d >= 1.0;
        vec3 col = texture(uScene, vUv).rgb;
        vec3 rd = viewDirWorld(vUv);
        float zFull = sky ? 1e5 : -viewPosFromDepth(vUv, d).z;
        if (sky) {
          col = skyRadiance(rd, uLightDir, uViewR) + sunDisc(rd, uLightDir, uViewR, uTransLUT);
        } else {
          if (uUseAO == 1) {
            float ao = upsample(uAO, vUv, uFogRes, zFull).r;
            col *= mix(1.0, multiBounce(ao, uAOAlbedo), uAOStrength);
          }
          float wa = texture(uScene, vUv).a;
          if (wa < -0.5) col += waterSSR(vUv, d, rd, -wa - 1.0);
        }
        if (uUseClouds == 1) {
          vec4 cl = texture(uClouds, vUv);
          col = col * cl.a + cl.rgb;
        }
        if (uUseFog == 1) {
          vec4 fg = sky ? texture(uFog, vUv) : upsample(uFog, vUv, uFogRes, zFull);
          col = col * fg.a + fg.rgb;
        }
        vec4 tr = texture(uTrans, vUv);            // premultiplied transparents (smoke, rain, glass, fire)
        col = col * (1.0 - saturate(tr.a)) + tr.rgb;
        col = max(col, vec3(0.0));
        if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
        outColor = vec4(min(col, vec3(60000.0)), 1.0);
      }`, this.compUniforms);

    // ---------------- TAA -------------------------------------------------------
    this.taaUniforms = Object.assign({}, common, {
      uCurrent: { value: null },
      uHistory: { value: null },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uCurViewProjInv: { value: new THREE.Matrix4() },
      uJitter: { value: new THREE.Vector2() },
      uFeedback: { value: 0.9 },
      uReset: { value: 1 }
    });
    this.taaPass = new RP.Pass(RP.DEPTH_GLSL + `
      uniform sampler2D uCurrent, uHistory, uExposureTex;
      uniform mat4 uPrevViewProj, uCurViewProjInv;
      uniform vec2 uRes, uJitter;
      uniform float uFeedback;
      uniform int uReset;
      vec3 rgb2ycocg(vec3 c) { return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
      vec3 ycocg2rgb(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
      vec3 tm(vec3 c) { return c / (1.0 + c.x); }      // Karis luminance weighting in YCoCg
      vec3 itm(vec3 c) { return c / max(1.0 - c.x, 1e-4); }
      // 5-tap Catmull-Rom (Jimenez 2016)
      vec3 sampleHistory(vec2 uv) {
        vec2 sp = uv * uRes, tc = floor(sp - 0.5) + 0.5, f = sp - tc;
        vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
        vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
        vec2 w12 = w1 + w2, tc12 = (tc + w2 / w12) / uRes;
        vec2 tc0 = (tc - 1.0) / uRes, tc3 = (tc + 2.0) / uRes;
        vec3 r = texture(uHistory, vec2(tc12.x, tc0.y)).rgb * (w12.x * w0.y)
               + texture(uHistory, vec2(tc0.x, tc12.y)).rgb * (w0.x * w12.y)
               + texture(uHistory, tc12).rgb * (w12.x * w12.y)
               + texture(uHistory, vec2(tc3.x, tc12.y)).rgb * (w3.x * w12.y)
               + texture(uHistory, vec2(tc12.x, tc3.y)).rgb * (w12.x * w3.y);
        float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
        return max(r / ws, vec3(0.0));
      }
      void main() {
        vec2 px = 1.0 / uRes;
        vec2 uvC = vUv - uJitter * 0.5;      // un-jittered sample position
        vec2 ex = texelFetch(uExposureTex, ivec2(0, 0), 0).rg;   // (this frame, previous frame)
        vec3 cur = texture(uCurrent, vUv).rgb * ex.x;              // pre-exposure happens here
        if (uReset == 1) { outColor = vec4(cur, 1.0); return; }
        // closest depth in 3×3 for reprojection (reduces edge ghosting)
        float dMin = 1.0; vec2 uvD = vUv;
        vec3 m1 = vec3(0.0), m2 = vec3(0.0), cmin = vec3(1e9), cmax = vec3(-1e9);
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(x, y) * px;
          float dd = rawDepth(vUv + o);
          if (dd < dMin) { dMin = dd; uvD = vUv + o; }
          vec3 s = tm(rgb2ycocg(texture(uCurrent, vUv + o).rgb * ex.x));
          m1 += s; m2 += s * s; cmin = min(cmin, s); cmax = max(cmax, s);
        }
        vec4 clip = vec4((uvD - uJitter * 0.5) * 2.0 - 1.0, dMin * 2.0 - 1.0, 1.0);
        vec4 wp = uCurViewProjInv * clip; wp /= wp.w;
        vec4 prev;
        if (dMin >= 1.0) {     // sky: reproject direction only
          vec4 dirW = uCurViewProjInv * vec4(clip.xy, 1.0, 1.0); dirW /= dirW.w;
          vec3 dir = dirW.xyz - (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          prev = uPrevViewProj * vec4(dir, 0.0);
        } else prev = uPrevViewProj * wp;
        vec2 uvPrev = prev.xy / prev.w * 0.5 + 0.5;
        vec2 motion = uvPrev - (vUv - uJitter * 0.5);
        vec3 mu = m1 / 9.0, sig = sqrt(max(m2 / 9.0 - mu * mu, 0.0));
        float gamma = 1.0;
        vec3 bmin = max(cmin, mu - gamma * sig), bmax = min(cmax, mu + gamma * sig);
        vec3 curT = tm(rgb2ycocg(cur));
        bool off = any(lessThan(uvPrev, vec2(0.0))) || any(greaterThan(uvPrev, vec2(1.0)));
        vec3 hist = tm(rgb2ycocg(sampleHistory(uvPrev) * (ex.x / max(ex.y, 1e-12))));
        // clip toward the box centre (Salvi)
        vec3 cen = 0.5 * (bmax + bmin), ext = 0.5 * (bmax - bmin) + 1e-5;
        vec3 v = hist - cen; vec3 a = abs(v / ext);
        float ma = max(a.x, max(a.y, a.z));
        if (ma > 1.0) hist = cen + v / ma;
        float speed = length(motion * uRes);
        float fb = mix(uFeedback, 0.7, saturate(speed / 12.0));
        if (off) fb = 0.0;
        vec3 res = mix(curT, hist, fb);
        outColor = vec4(max(ycocg2rgb(itm(res)), vec3(0.0)), 1.0);
      }`, this.taaUniforms);

    // history rescale when exposure changes: done in TAA by caller (uniform below)
    this.copyPass = new RP.Pass(`
      uniform sampler2D uTex; uniform float uScale;
      void main(){ outColor = vec4(texture(uTex, vUv).rgb * uScale, 1.0); }`,
    { uTex: { value: null }, uScale: { value: 1 } });

    // ---------------- Bloom --------------------------------------------------
    this.bloomDown = new RP.Pass(`
      uniform sampler2D uTex; uniform vec2 uTexel; uniform int uFirst;
      vec3 s(vec2 o) { return texture(uTex, vUv + o * uTexel).rgb; }
      float kw(vec3 c) { return 1.0 / (1.0 + luminance(c)); }
      void main() {
        vec3 a = s(vec2(-2,2)), b = s(vec2(0,2)), c = s(vec2(2,2));
        vec3 d = s(vec2(-2,0)), e = s(vec2(0,0)), f = s(vec2(2,0));
        vec3 g = s(vec2(-2,-2)), h = s(vec2(0,-2)), i = s(vec2(2,-2));
        vec3 j = s(vec2(-1,1)), k = s(vec2(1,1)), l = s(vec2(-1,-1)), m = s(vec2(1,-1));
        vec3 r;
        if (uFirst == 1) {   // Karis average on the first mip kills fireflies
          vec3 g0 = (a+b+d+e)*0.25, g1 = (b+c+e+f)*0.25, g2 = (d+e+g+h)*0.25, g3 = (e+f+h+i)*0.25, g4 = (j+k+l+m)*0.25;
          float w0 = kw(g0), w1 = kw(g1), w2 = kw(g2), w3 = kw(g3), w4 = kw(g4);
          r = (g0*w0*0.125 + g1*w1*0.125 + g2*w2*0.125 + g3*w3*0.125 + g4*w4*0.5) / (w0*0.125+w1*0.125+w2*0.125+w3*0.125+w4*0.5);
        } else {
          r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
        }
        outColor = vec4(r, 1.0);
      }`, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } });
    this.bloomUp = new RP.Pass(`
      uniform sampler2D uTex; uniform vec2 uTexel; uniform float uRadius;
      void main() {
        vec2 o = uTexel * uRadius;
        vec3 r = texture(uTex, vUv).rgb * 4.0;
        r += (texture(uTex, vUv + vec2(-o.x, 0)).rgb + texture(uTex, vUv + vec2(o.x, 0)).rgb + texture(uTex, vUv + vec2(0, -o.y)).rgb + texture(uTex, vUv + vec2(0, o.y)).rgb) * 2.0;
        r += texture(uTex, vUv + vec2(-o.x, -o.y)).rgb + texture(uTex, vUv + vec2(o.x, -o.y)).rgb + texture(uTex, vUv + vec2(-o.x, o.y)).rgb + texture(uTex, vUv + vec2(o.x, o.y)).rgb;
        outColor = vec4(r / 16.0, 1.0);
      }`, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } },
    { blending: THREE.AdditiveBlending });

    // ---------------- Exposure: histogram ------------------------------------
    const HS = 64;   // 64×64 luminance samples, 64 bins over [-12, +18] EV (absolute)
    this.histRT = RP.makeRT(64, 1, { type: THREE.HalfFloatType, filter: THREE.NearestFilter });
    const pts = new Float32Array(HS * HS * 3);
    for (let i = 0; i < HS * HS; i++) { pts[i * 3] = ((i % HS) + 0.5) / HS; pts[i * 3 + 1] = (Math.floor(i / HS) + 0.5) / HS; }
    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.histUniforms = { uTex: { value: null }, uExposureTex: { value: null }, uMinEV: { value: -12 }, uMaxEV: { value: 18 } };
    const histMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.histUniforms,
      vertexShader: `
        precision highp float;
        in vec3 position;
        uniform sampler2D uTex, uExposureTex;
        uniform float uMinEV, uMaxEV;
        out float vW;
        void main() {
          vec2 uv = position.xy;
          vec3 c = texture(uTex, uv).rgb;
          float exposure = texelFetch(uExposureTex, ivec2(0, 0), 0).r;
          float L = dot(c, vec3(0.2126, 0.7152, 0.0722)) / max(exposure, 1e-12);
          // absolute luminance (cd/m²) → EV100 = log2(L·S/K), S = 100, K = 12.5
          float ev = log2(max(L * 1000.0, 1e-9) * 8.0);
          float bin = clamp((ev - uMinEV) / (uMaxEV - uMinEV), 0.0, 0.9999) * 64.0;
          // centre-weighted metering (Gaussian, σ = 0.35 of the frame)
          vec2 cc = (uv - 0.5) / 0.5;
          vW = exp(-0.5 * dot(cc, cc)) * (1.0 / 4096.0) * 4.0;
          gl_Position = vec4((floor(bin) + 0.5) / 64.0 * 2.0 - 1.0, 0.0, 0.0, 1.0);
          gl_PointSize = 1.0;
        }`,
      fragmentShader: `
        precision highp float;
        in float vW;
        layout(location = 0) out highp vec4 outColor;
        void main() { outColor = vec4(vW, 0.0, 0.0, 1.0); }`,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true
    });
    const ptsObj = new THREE.Points(ptGeo, histMat);
    ptsObj.frustumCulled = false;
    this.histScene = new THREE.Scene();
    this.histScene.add(ptsObj);
    this.histCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // exposure state: r = exposure used this frame, g = previous exposure, b = EV100 current, a = target EV100
    this.expRT = [RP.makeRT(1, 1, { type: THREE.FloatType, filter: THREE.NearestFilter }),
      RP.makeRT(1, 1, { type: THREE.FloatType, filter: THREE.NearestFilter })];
    this.expIdx = 0;
    this.expUniforms = {
      uHist: { value: this.histRT.texture },
      uPrevExp: { value: null },
      uMinEV: this.histUniforms.uMinEV, uMaxEV: this.histUniforms.uMaxEV,
      uLowPct: { value: 0.40 }, uHighPct: { value: 0.93 },
      uEVMin: { value: -2.0 }, uEVMax: { value: 16.5 },
      uComp: { value: 0.0 },        // exposure compensation (EV) — calibrated
      uSpeedUp: { value: 2.5 }, uSpeedDown: { value: 1.2 },
      uDt: { value: 0.016 },
      uReset: { value: 1 },
      uManualEV: { value: -100.0 }
    };
    this.expPass = new RP.Pass(`
      uniform sampler2D uHist, uPrevExp;
      uniform float uMinEV, uMaxEV, uLowPct, uHighPct, uEVMin, uEVMax, uComp, uSpeedUp, uSpeedDown, uDt, uManualEV;
      uniform int uReset;
      void main() {
        float total = 0.0;
        for (int i = 0; i < 64; i++) total += texelFetch(uHist, ivec2(i, 0), 0).r;
        float lo = uLowPct * total, hi = uHighPct * total;
        float acc = 0.0, evSum = 0.0, wSum = 0.0;
        for (int i = 0; i < 64; i++) {
          float h = texelFetch(uHist, ivec2(i, 0), 0).r;
          // part of this bin inside [lo, hi]
          float a0 = acc, a1 = acc + h;
          float inside = max(0.0, min(a1, hi) - max(a0, lo));
          float ev = uMinEV + (float(i) + 0.5) / 64.0 * (uMaxEV - uMinEV);
          evSum += ev * inside; wSum += inside;
          acc = a1;
        }
        float evAvg = wSum > 0.0 ? evSum / wSum : 10.0;
        // Unreal: target maps average scene luminance to middle grey; EV100 of the scene average
        float target = clamp(evAvg - uComp, uEVMin, uEVMax);
        if (uManualEV > -50.0) target = uManualEV;
        vec4 prev = texelFetch(uPrevExp, ivec2(0, 0), 0);
        float cur = uReset == 1 ? target : prev.b;
        float diff = target - cur;
        float speed = diff > 0.0 ? uSpeedUp : uSpeedDown;
        cur += diff * (1.0 - exp(-uDt * speed));
        // Lagarde: exposure = 1 / (1.2 · 2^EV100) on luminance in cd/m² → our units ×1000
        float exposure = 1000.0 / (1.2 * exp2(cur));
        outColor = vec4(exposure, uReset == 1 ? exposure : prev.r, cur, target);
      }`, this.expUniforms);

    // ---------------- Local exposure (bilateral log-luminance) ----------------
    this.lumPass = new RP.Pass(`
      uniform sampler2D uTex;
      void main() { outColor = vec4(log2(max(luminance(texture(uTex, vUv).rgb), 1e-6)), 0.0, 0.0, 1.0); }`,
    { uTex: { value: null } });
    this.bilatPass = new RP.Pass(`
      uniform sampler2D uTex; uniform vec2 uTexel; uniform float uSigmaR;
      void main() {
        float c = texture(uTex, vUv).r;
        float sum = 0.0, ws = 0.0;
        for (int y = -4; y <= 4; y++) for (int x = -4; x <= 4; x++) {
          float s = texture(uTex, vUv + vec2(x, y) * uTexel * 1.5).r;
          float r2 = float(x * x + y * y);
          float w = exp(-r2 / 18.0) * exp(-(s - c) * (s - c) / (2.0 * uSigmaR * uSigmaR));
          sum += s * w; ws += w;
        }
        outColor = vec4(sum / ws, 0.0, 0.0, 1.0);
      }`, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uSigmaR: { value: 1.0 } });
    this.blurPass = new RP.Pass(`
      uniform sampler2D uTex; uniform vec2 uDir;
      void main() {
        float w[5]; w[0]=0.2270270270; w[1]=0.1945945946; w[2]=0.1216216216; w[3]=0.0540540541; w[4]=0.0162162162;
        float s = texture(uTex, vUv).r * w[0];
        for (int i = 1; i < 5; i++) s += (texture(uTex, vUv + uDir * float(i)).r + texture(uTex, vUv - uDir * float(i)).r) * w[i];
        outColor = vec4(s, 0.0, 0.0, 1.0);
      }`, { uTex: { value: null }, uDir: { value: new THREE.Vector2() } });

    // ---------------- Final: bloom + local exposure + grading + filmic + OETF --
    this.finalUniforms = {
      uTex: { value: null }, uBloom: { value: null }, uLocalBase: { value: null }, uLocalBlur: { value: null },
      uBloomStrength: { value: 0.04 },
      uHighlightContrast: { value: 0.85 }, uShadowContrast: { value: 0.92 }, uDetail: { value: 1.0 },
      uLocalBlend: { value: 0.6 }, uUseLocal: { value: 1 },
      uWB: { value: new THREE.Matrix3() },
      uSaturation: { value: 1.0 }, uContrast: { value: 1.0 }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uFilmSlope: { value: 0.88 }, uFilmToe: { value: 0.55 }, uFilmShoulder: { value: 0.26 },
      uFilmBlackClip: { value: 0.0 }, uFilmWhiteClip: { value: 0.04 },
      uFrame: common.uFrame, uRes: common.uRes,
      uVignette: { value: 0.18 },
      uPurkinje: { value: 1.0 },
      uExposureTex: common.uExposureTex,
      uOutputLinear: { value: 0 }
    };
    this.finalPass = new RP.Pass(`
      uniform sampler2D uTex, uBloom, uLocalBase, uLocalBlur, uExposureTex;
      uniform float uBloomStrength, uHighlightContrast, uShadowContrast, uDetail, uLocalBlend;
      uniform int uUseLocal, uOutputLinear;
      uniform mat3 uWB;
      uniform float uSaturation, uContrast;
      uniform vec3 uGain;
      uniform float uFilmSlope, uFilmToe, uFilmShoulder, uFilmBlackClip, uFilmWhiteClip;
      uniform float uFrame, uVignette, uPurkinje;
      uniform vec2 uRes;
      const mat3 sRGB_2_AP1 = mat3(0.6130974024, 0.0701937225, 0.0206155929, 0.3395231462, 0.9163538791, 0.1095697729, 0.0473794514, 0.0134523985, 0.8698146342);
      const mat3 AP1_2_sRGB = mat3(1.7050509927, -0.1302564175, -0.0240033568, -0.6217921207, 1.1408047366, -0.1289689761, -0.0832588720, -0.0105483191, 1.1529723329);
      const vec3 AP1_Y = vec3(0.2722287168, 0.6740817658, 0.0536895174);
      vec3 filmToneMap(vec3 c) {
        vec3 w = sRGB_2_AP1 * c;
        w = mix(vec3(dot(w, AP1_Y)), w, 0.96);
        float ToeScale = 1.0 + uFilmBlackClip - uFilmToe;
        float ShoulderScale = 1.0 + uFilmWhiteClip - uFilmShoulder;
        const float InMatch = 0.18, OutMatch = 0.18;
        float ToeMatch;
        if (uFilmToe > 0.8) ToeMatch = (1.0 - uFilmToe - OutMatch) / uFilmSlope + log(InMatch) / log(10.0);
        else {
          float bt = (OutMatch + uFilmBlackClip) / ToeScale - 1.0;
          ToeMatch = log(InMatch) / log(10.0) - 0.5 * log((1.0 + bt) / (1.0 - bt)) * (ToeScale / uFilmSlope);
        }
        float StraightMatch = (1.0 - uFilmToe) / uFilmSlope - ToeMatch;
        float ShoulderMatch = uFilmShoulder / uFilmSlope - StraightMatch;
        vec3 LogColor = log(max(w, vec3(1e-10))) / log(10.0);
        vec3 StraightColor = uFilmSlope * (LogColor + StraightMatch);
        vec3 ToeColor = (-uFilmBlackClip) + (2.0 * ToeScale) / (1.0 + exp((-2.0 * uFilmSlope / ToeScale) * (LogColor - ToeMatch)));
        vec3 ShoulderColor = (1.0 + uFilmWhiteClip) - (2.0 * ShoulderScale) / (1.0 + exp((2.0 * uFilmSlope / ShoulderScale) * (LogColor - ShoulderMatch)));
        ToeColor = mix(StraightColor, ToeColor, vec3(lessThan(LogColor, vec3(ToeMatch))));
        ShoulderColor = mix(StraightColor, ShoulderColor, vec3(greaterThan(LogColor, vec3(ShoulderMatch))));
        vec3 t = saturate((LogColor - ToeMatch) / (ShoulderMatch - ToeMatch));
        t = ShoulderMatch < ToeMatch ? 1.0 - t : t;
        t = (3.0 - 2.0 * t) * t * t;
        vec3 tone = mix(ToeColor, ShoulderColor, t);
        tone = mix(vec3(dot(tone, AP1_Y)), tone, 0.93);
        return max(AP1_2_sRGB * max(tone, vec3(0.0)), vec3(0.0));
      }
      vec3 oetf(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
      void main() {
        vec3 c = texture(uTex, vUv).rgb;
        c += texture(uBloom, vUv).rgb * uBloomStrength;
        float exposure = texelFetch(uExposureTex, ivec2(0, 0), 0).r;
        // Purkinje / scotopic shift (Jensen et al. 2000 night rendering): rod vision at < 0.1 cd/m²
        float Labs = luminance(c) / max(exposure, 1e-12) * 1000.0;
        float sc = uPurkinje * (1.0 - smoothstep(0.01, 0.6, Labs));
        if (sc > 0.0) {
          float V = luminance(c) * 1.05;
          c = mix(c, V * vec3(0.56, 0.75, 1.05), sc * 0.75);
        }
        if (uUseLocal == 1) {
          float logL = log2(max(luminance(c), 1e-6));
          float base = mix(texture(uLocalBase, vUv).r, texture(uLocalBlur, vUv).r, uLocalBlend);
          float mid = log2(0.18);
          float k = base > mid ? uHighlightContrast : uShadowContrast;
          float newBase = mid + (base - mid) * k;
          float newLog = newBase + (logL - base) * uDetail;
          c *= exp2(newLog - logL);
        }
        c = uWB * c;
        c *= uGain;
        float Y = luminance(c);
        c = max(mix(vec3(Y), c, uSaturation), vec3(0.0));
        c = 0.18 * pow(max(c, vec3(0.0)) / 0.18, vec3(uContrast));
        vec2 vq = vUv - 0.5;
        c *= 1.0 - uVignette * dot(vq, vq) * 1.6;
        vec3 o = uOutputLinear == 1 ? c : filmToneMap(c);
        o = oetf(saturate(o));
        // triangular-PDF dither, 1 LSB
        float n1 = hash12(gl_FragCoord.xy + mod(uFrame, 61.0) * 13.1), n2 = hash12(gl_FragCoord.xy * 1.7 + mod(uFrame, 53.0) * 7.3);
        o += (n1 + n2 - 1.0) / 255.0;
        outColor = vec4(o, 1.0);
      }`, this.finalUniforms);

    this.setWhiteBalance(6504, 0);
  };

  /**
   * Bradford chromatic adaptation from a scene white of colour temperature T
   * (+ tint along the iso-temperature line, in Δuv·1e3) to D65.
   */
  RP.Post.prototype.setWhiteBalance = function (T, tint) {
    const rgb = RP.kelvinToLinearRGB(Math.max(1700, Math.min(25000, T)));
    // tint: green–magenta offset, applied as a small G scale
    rgb[1] *= 1 + (tint || 0) * 0.01;
    // XYZ of the source white & D65
    const toXYZ = (c) => [0.4124564 * c[0] + 0.3575761 * c[1] + 0.1804375 * c[2], 0.2126729 * c[0] + 0.7151522 * c[1] + 0.0721750 * c[2], 0.0193339 * c[0] + 0.1191920 * c[1] + 0.9503041 * c[2]];
    const ws = toXYZ(rgb), wd = toXYZ([1, 1, 1]);
    const B = new THREE.Matrix3().set(0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296);
    const Bi = B.clone().invert();
    const s = new THREE.Vector3(ws[0], ws[1], ws[2]).applyMatrix3(B);
    const d = new THREE.Vector3(wd[0], wd[1], wd[2]).applyMatrix3(B);
    const D = new THREE.Matrix3().set(d.x / s.x, 0, 0, 0, d.y / s.y, 0, 0, 0, d.z / s.z);
    const M = new THREE.Matrix3().set(0.4124564, 0.3575761, 0.1804375, 0.2126729, 0.7151522, 0.0721750, 0.0193339, 0.1191920, 0.9503041);
    const Mi = M.clone().invert();
    const cat = new THREE.Matrix3().multiplyMatrices(Mi, new THREE.Matrix3().multiplyMatrices(Bi, new THREE.Matrix3().multiplyMatrices(D, new THREE.Matrix3().multiplyMatrices(B, M))));
    this.finalUniforms.uWB.value.copy(cat);
    this.wbT = T; this.wbTint = tint || 0;
  };
})(window);
