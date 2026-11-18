/* DSAn — gerçekçi tersane dünyası: gökyüzü + güneş yolu, PBR ortam ışığı, shader su (dalga, Fresnel, güneş parıltısı, gece lamba yansımaları),
   liman/mendirek, rıhtım, vinçler, araçlar, Konyaaltı kıyısı ve şehir ışıkları, Beydağları, gece lambaları, kalite/FPS yönetimi.
   Sahne koordinatları: kara kuzeyde (-Z), deniz güneyde (+Z), doğu +X (Konyaaltı/şehir), batı -X (Beydağları). */
(function () {
  'use strict';
  const DSAN = window.DSAN = window.DSAN || {};
  const W = DSAN.world = {};
  const U = () => DSAN.util;

  const PRESETS = {
    low: { pr: 1, shadows: false, shadowSize: 512, lights: 0, water: 90, env: false, crew: 10, city: .55, glow: true },
    medium: { pr: 1.5, shadows: true, shadowSize: 1024, lights: 4, water: 150, env: true, crew: 18, city: 1, glow: true },
    high: { pr: 2, shadows: true, shadowSize: 2048, lights: 8, water: 220, env: true, crew: 28, city: 1, glow: true }
  };
  W.PRESETS = PRESETS;
  W.level = 'medium';

  let ctx = null; // {scene, renderer, camera, sun, amb, hemi}
  const lamps = [];        // {pos:Vector3, color}
  let lampHeads = null, lampGlow = null, pointLights = [], sky = null, water = null, cityMat = null, hallLights = [], beacons = [];
  const animated = [];     // {update(t,dt)}
  let pmrem = null, envRT = null, envScene = null, envSky = null, lastEnvElev = 99, sunElev = 1, nightK = 0;
  const berths = new Map(); // fleet uid -> group

  // ---------------- Kalite ----------------
  function detectLevel() {
    const mob = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 700;
    const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
    if (mem <= 3 || cores <= 4) return 'low';
    return mob ? 'low' : 'medium';
  }
  W.resolveLevel = mode => (mode && mode !== 'auto' && PRESETS[mode] ? mode : detectLevel());
  W.applyQuality = function (level) {
    if (!ctx) return;
    W.level = PRESETS[level] ? level : 'medium';
    const q = PRESETS[W.level], r = ctx.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    const shadowChange = r.shadowMap.enabled !== q.shadows;
    r.shadowMap.enabled = q.shadows; r.shadowMap.type = W.level === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (ctx.sun) {
      ctx.sun.castShadow = q.shadows;
      if (ctx.sun.shadow.mapSize.x !== q.shadowSize) { ctx.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (ctx.sun.shadow.map) { ctx.sun.shadow.map.dispose(); ctx.sun.shadow.map = null; } }
    }
    if (shadowChange) ctx.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
    pointLights.forEach((l, i) => { l.visible = i < q.lights; });
    if (cityMat && cityMat.userData.inst) cityMat.userData.inst.count = Math.round(cityMat.userData.total * q.city);
    if (!q.env) { ctx.scene.environment = null; } else lastEnvElev = 99;
    W.onResize && W.onResize();
    DSAN.emit('quality', W.level);
  };
  // FPS izleme; 'auto' modda gerektiğinde kaliteyi düşürür/yükseltir
  const fps = { frames: 0, t0: performance.now(), value: 60, good: 0 };
  W.fps = () => fps.value;
  function trackFps(now, mode) {
    fps.frames++;
    const el = now - fps.t0;
    if (el < 2500) return;
    fps.value = Math.round(fps.frames * 1000 / el); fps.frames = 0; fps.t0 = now;
    DSAN.emit('fps', fps.value);
    if (mode !== 'auto' || document.hidden) return;
    const order = ['low', 'medium', 'high'], i = order.indexOf(W.level);
    if (fps.value < 28 && i > 0) { W.applyQuality(order[i - 1]); fps.good = 0; }
    else if (fps.value > 57 && i < 1) { if (++fps.good >= 4) { W.applyQuality(order[i + 1]); fps.good = 0; } }
    else fps.good = 0;
  }

  // ---------------- Gökyüzü ----------------
  function makeSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uSunK: { value: 1 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 uZen,uHor,uSunCol,uSun; uniform float uNight, uSunK; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ vec3 d = normalize(vD); float y = max(d.y, -0.05);
          vec3 c = mix(uHor, uZen, pow(clamp(y,0.,1.), .55));
          float s = max(dot(d, normalize(uSun)), 0.);
          c += uSunCol * (pow(s, 900.)*6.*uSunK + pow(s, 12.)*.35 + pow(s,3.)*.12) * (1.-uNight*.85);
          if (uNight > .01 && d.y > 0.) { vec3 q = floor(d*420.); float st = step(.9975, h(q)); c += vec3(st) * uNight * (.6 + .4*h(q+1.)); }
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    m.frustumCulled = false; m.renderOrder = -100; return m;
  }

  // ---------------- Su ----------------
  function makeWater(seg) {
    const g = new THREE.PlaneGeometry(1400, 1100, seg, Math.round(seg * .8)); g.rotateX(-Math.PI / 2);
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uDeep: { value: new THREE.Color('#06394f') }, uShallow: { value: new THREE.Color('#0f7c94') }, uSky: { value: new THREE.Color('#8ec3e0') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff4e0') }, uNight: { value: 0 }, uAmp: { value: 1 },
      uLightPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) }, uLightCol: { value: Array.from({ length: 8 }, () => new THREE.Color()) }, uLightN: { value: 0 }
    }]);
    const mat = new THREE.ShaderMaterial({
      uniforms, fog: true, lights: false, extensions: { derivatives: true },
      vertexShader: `uniform float uTime, uAmp; varying vec3 vW; varying float vH;
        #include <fog_pars_vertex>
        float wv(vec2 p, vec2 d, float k, float a, float s){ return a*sin(dot(normalize(d),p)*k + uTime*s); }
        void main(){ vec4 w = modelMatrix * vec4(position,1.);
          float h = wv(w.xz, vec2(1.,.3), .055, .42, 1.3) + wv(w.xz, vec2(-.4,1.), .11, .2, 1.9) + wv(w.xz, vec2(.7,-.8), .23, .08, 2.8) + wv(w.xz, vec2(.2,.9), .41, .035, 3.6);
          w.y += h * uAmp; vH = h; vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uNight; uniform vec3 uDeep, uShallow, uSky, uSunDir, uSunCol; uniform vec3 uLightPos[8]; uniform vec3 uLightCol[8]; uniform int uLightN;
        varying vec3 vW; varying float vH;
        #include <fog_pars_fragment>
        void main(){ vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.) n = -n;
          n = normalize(n + vec3(sin(vW.x*1.7+uTime*2.3)*.05 + sin(vW.z*3.1-uTime*1.5)*.04, 0., cos(vW.z*1.9+uTime*2.)*.05 + sin(vW.x*2.7+uTime*1.1)*.03));
          vec3 v = normalize(cameraPosition - vW);
          float fr = .04 + .62 * pow(1. - max(dot(n, v), 0.), 5.);
          vec3 base = mix(uDeep, uShallow, clamp(vH * .9 + .45, 0., 1.));
          vec3 col = mix(base, uSky, fr);
          vec3 r = reflect(-v, n); float sp = pow(max(dot(r, normalize(uSunDir)), 0.), 220.) * 4. + pow(max(dot(r, normalize(uSunDir)), 0.), 24.) * .18;
          col += uSunCol * sp * (1. - uNight);
          for (int i = 0; i < 8; i++) { if (i >= uLightN) break;
            vec3 lp = uLightPos[i]; vec2 d = vW.xz - lp.xz; vec2 vd = normalize(cameraPosition.xz - lp.xz);
            float al = dot(d, vd); float ac = length(d - vd * al);
            float s = exp(-ac * ac * .55) * smoothstep(-3., 0., al) * exp(-max(al, 0.) * .045);
            s *= .45 + .55 * sin(al * 1.4 - uTime * 3. + vH * 7.);
            col += uLightCol[i] * max(s, 0.) * uNight * 1.3; }
          float foam = smoothstep(.55, .75, vH) * .25; col += vec3(foam) * (1. - uNight * .7);
          gl_FragColor = vec4(col, 1.);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
          #include <fog_fragment>
        }`
    });
    const m = new THREE.Mesh(g, mat); m.position.set(0, -1.2, 200); m.receiveShadow = false; m.name = 'dsan-water';
    return m;
  }

  // ---------------- Arazi / dağ sırtları ----------------
  function noise2(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; const a = noise2(ix, iy), b = noise2(ix + 1, iy), c = noise2(ix, iy + 1), d = noise2(ix + 1, iy + 1); const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
  function fbm(x, y) { let v = 0, a = .5, f = 1; for (let i = 0; i < 5; i++) { v += a * vnoise(x * f, y * f); f *= 2.1; a *= .5; } return v; }
  // Bir sırt: uzunluk boyunca profil, derinlik boyunca tepe; ön kenar deniz/kara seviyesine iner
  function ridge(o) {
    const g = new THREE.PlaneGeometry(o.len, o.depth, o.sx, o.sz); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, col = [], c = new THREE.Color();
    const low = new THREE.Color(o.low || '#4b5a3f'), mid = new THREE.Color(o.mid || '#6b6a62'), top = new THREE.Color(o.top || '#b9b4aa');
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), t = (o.depth / 2 - z) / o.depth; // 0: izleyiciye bakan (+Z) alçak etek → 1: arkadaki zirveler
      const prof = Math.sin(Math.min(1, t * 1.25) * Math.PI * .5);
      const n = fbm(x * o.f + o.seed, z * o.f * 1.3 + o.seed * 2);
      const peaks = Math.pow(n, 1.6) * 1.9;
      const y = o.h * prof * (.35 + peaks) * (o.taper ? Math.pow(Math.sin((x / o.len + .5) * Math.PI), .5) : 1);
      P.setY(i, Math.max(0, y) + (o.base || 0));
      const k = y / (o.h * 1.4);
      c.copy(low).lerp(mid, U().clamp(k * 1.8, 0, 1)); if (k > .55) c.lerp(top, U().clamp((k - .55) * 2.5, 0, 1));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, flatShading: true }));
    m.position.set(o.x, o.y || -1, o.z); m.rotation.y = o.ry || 0; m.receiveShadow = true; return m;
  }

  // ---------------- Yardımcılar ----------------
  const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; o.receiveShadow = true; return o; };
  const std = (c, r, m, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r == null ? .7 : r, metalness: m || 0 }, o || {}));
  function instanced(geo, mat, list, setup) { // list: [{x,y,z,sx,sy,sz,ry}]
    const im = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D();
    list.forEach((p, i) => { d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.ry || 0, 0); d.scale.set(p.sx || 1, p.sy || 1, p.sz || 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (setup) setup(im, i, p); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; return im; // r128: örnek sınırları hesaplanmaz
  }
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(.25, 'rgba(255,200,130,.55)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); return glowTex;
  }
  function windowTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#e8e2d6'; x.fillRect(0, 0, 64, 128);
    const e = document.createElement('canvas'); e.width = 64; e.height = 128; const y = e.getContext('2d'); y.fillStyle = '#000'; y.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 16; r++) for (let k = 0; k < 6; k++) {
      x.fillStyle = (r + k) % 3 ? '#5c7085' : '#6e8399'; x.fillRect(4 + k * 10, 4 + r * 8, 6, 5);
      if (noise2(r, k) > .55) { y.fillStyle = noise2(k, r) > .5 ? '#ffd9a0' : '#fff1c9'; y.fillRect(4 + k * 10, 4 + r * 8, 6, 5); }
    }
    const t1 = new THREE.CanvasTexture(c), t2 = new THREE.CanvasTexture(e); return [t1, t2];
  }

  // ---------------- Kurulum ----------------
  W.setup = function (o) {
    ctx = o; const scene = o.scene, q = () => PRESETS[W.level];
    W.level = W.resolveLevel(o.mode);
    // Gökyüzü & su
    sky = makeSky(); scene.add(sky);
    water = makeWater(PRESETS[W.level].water); scene.add(water);
    scene.fog = new THREE.FogExp2(0x8ec3e0, 0.0011);

    // Rıhtım duvarı, babalar, usturmaçalar
    const concrete = std('#8b93a0', .85), dark = std('#1f2329', .9);
    const quayFace = box(175, 5, 2, concrete); quayFace.position.set(-4, -0.9, 39.5); scene.add(quayFace);
    const bollards = []; for (let x = -88; x <= 80; x += 7) if (Math.abs(x - 35) > 14) bollards.push({ x, y: 1.95, z: 38.2 });
    scene.add(instanced(new THREE.CylinderGeometry(.28, .34, .7, 8), std('#2b2f36', .5, .5), bollards));
    const fenders = []; for (let x = -86; x <= 80; x += 5) if (Math.abs(x - 35) > 14) fenders.push({ x, y: -0.2, z: 40.6, sy: 1 });
    scene.add(instanced(new THREE.CylinderGeometry(.42, .42, 2.6, 8), dark, fenders));

    // Mendirek (dolgu taş) ve fenerler — liman ağzı x≈ -5..40
    const rock = std('#7d7a72', .95, 0, { flatShading: true }), rocks = [];
    const arm = (x0, z0, x1, z1, w) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2.4); for (let i = 0; i <= n; i++) { const t = i / n; for (let k = -1; k <= 1; k++) rocks.push({ x: x0 + (x1 - x0) * t + (noise2(i, k) - .5) * 2 + (z1 !== z0 ? k * w / 3 : 0), y: -1 + noise2(k, i) * 1.4 + (k === 0 ? 1.2 : 0), z: z0 + (z1 - z0) * t + (x1 !== x0 ? k * w / 3 : 0) + (noise2(i + 7, k) - .5) * 2, sx: 2.2 + noise2(i, 3) * 1.6, sy: 1.6 + noise2(3, i), sz: 2.2 + noise2(i, 9) * 1.4, ry: noise2(i, k) * 6 }); } };
    arm(-100, 40, -100, 122, 7); arm(-100, 122, -8, 122, 7); arm(100, 40, 100, 100, 7); arm(100, 100, 44, 100, 7);
    scene.add(instanced(new THREE.DodecahedronGeometry(1, 0), rock, rocks));
    const crown = std('#a3a8ae', .8);
    [[-100, 81, 4, 82], [-54, 122, 92, 4], [100, 70, 4, 60], [72, 100, 56, 4]].forEach(([x, z, w, d]) => { const c = box(w, 1, d, crown); c.position.set(x, 1.6, z); scene.add(c); });
    const tower = (x, z, col) => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.2, 9, 12), std('#f8fafc', .5)); t.position.y = 4.5; g.add(t); const band = new THREE.Mesh(new THREE.CylinderGeometry(.95, 1.05, 2, 12), std(col, .5)); band.position.y = 6; g.add(band); const lamp = new THREE.Mesh(new THREE.SphereGeometry(.6, 10, 8), new THREE.MeshBasicMaterial({ color: col })); lamp.position.y = 9.6; g.add(lamp); g.position.set(x, 2, z); scene.add(g); beacons.push({ lamp, col: new THREE.Color(col), ph: x }); lamps.push({ pos: new THREE.Vector3(x, 11, z), color: new THREE.Color(col), water: true }); };
    tower(-8, 122, '#ef4444'); tower(44, 100, '#22c55e');

    // Batı ve kuzey: Beydağları; güneybatı uzak kıyı; doğu: Konyaaltı plajı ve şehir
    scene.add(ridge({ x: -330, z: -40, len: 520, depth: 260, sx: 90, sz: 46, h: 105, f: .011, seed: 3, ry: Math.PI / 2 * .9, taper: true }));
    scene.add(ridge({ x: -40, z: -250, len: 700, depth: 220, sx: 110, sz: 36, h: 120, f: .009, seed: 9, taper: true }));
    scene.add(ridge({ x: -470, z: 380, len: 760, depth: 220, sx: 100, sz: 30, h: 95, f: .008, seed: 17, ry: Math.PI / 2 * 1.1, taper: true, low: '#59616b', mid: '#6f7782', top: '#a6adb6' }));
    const landE = box(560, 3, 260, std('#7b8462', .95)); landE.position.set(380, 0, -60); landE.castShadow = false; scene.add(landE);
    const landW = box(260, 3, 220, std('#6c7356', .95)); landW.position.set(-230, 0, -40); landW.castShadow = false; scene.add(landW);
    // Plaj (çakıl) şeridi doğuya ve güneydoğuya kıvrılır
    const beachPts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40, x = 110 + t * 520, z = 72 - t * 10 + Math.sin(t * 3) * 6; beachPts.push({ x, z }); }
    const sand = std('#d9ccb0', .95);
    beachPts.forEach((p, i) => { if (!i) return; const a = beachPts[i - 1], len = Math.hypot(p.x - a.x, p.z - a.z); const b = box(len + .5, 1, 26, sand); b.castShadow = false; b.position.set((p.x + a.x) / 2, -.6, (p.z + a.z) / 2 - 8); b.rotation.y = -Math.atan2(p.z - a.z, p.x - a.x); scene.add(b); });
    const coastLand = box(520, 3, 70, std('#8a8f6c', .95)); coastLand.position.set(370, 0, 30); coastLand.castShadow = false; scene.add(coastLand);
    // Şehir blokları (InstancedMesh, gece pencere ışıkları)
    const [wt, we] = windowTexture();
    cityMat = new THREE.MeshStandardMaterial({ map: wt, emissiveMap: we, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0, roughness: .8 });
    const blocks = []; const rr = U().rng('konyaalti');
    for (let i = 0; i < 150; i++) { const t = rr(), x = 120 + t * 500, z = 34 - rr() * 70 - (t > .7 ? (t - .7) * 30 : 0); const h = 8 + rr() * 26 * (1 - Math.abs(t - .5) * .6); blocks.push({ x, y: h / 2 + 1, z, sx: 6 + rr() * 6, sy: h, sz: 6 + rr() * 5, ry: (rr() - .5) * .3 }); }
    const city = instanced(new THREE.BoxGeometry(1, 1, 1), cityMat, blocks); city.castShadow = false;
    cityMat.userData.inst = city; cityMat.userData.total = blocks.length; scene.add(city);
    // Palmiyeler sahil yolu ve ofis önünde
    const palms = []; for (let i = 0; i < 70; i++) { const t = i / 70; palms.push({ x: 115 + t * 500, y: 4, z: 46 - t * 8 + (i % 2) * 3 }); }
    [[78, -14], [82, -14], [86, -14], [90, -14], [-70, 30], [-84, 30], [62, 30]].forEach(([x, z]) => palms.push({ x, y: 4, z }));
    const trunk = instanced(new THREE.CylinderGeometry(.22, .35, 6, 6), std('#7c5a3a', .9), palms.map(p => ({ x: p.x, y: 4.6, z: p.z }))); trunk.castShadow = false; scene.add(trunk);
    const crownM = instanced(new THREE.ConeGeometry(2.4, 1.6, 7), std('#2f6b3a', .85, 0, { flatShading: true }), palms.map(p => ({ x: p.x, y: 8, z: p.z, sy: -1 }))); crownM.castShadow = false; scene.add(crownM);

    // İdari bina (ofis) + otopark + VIP Vito
    const glassM = std('#20364d', .12, .85), officeM = std('#e5e7eb', .5);
    const office = new THREE.Group(); office.position.set(76, 1.6, -36);
    const ob = box(22, 12, 14, officeM); ob.position.y = 6; office.add(ob);
    for (let f = 0; f < 3; f++) { const gl = box(22.2, 2.2, 14.2, glassM); gl.position.y = 2.4 + f * 3.6; office.add(gl); }
    const sign = box(10, 2, .4, std('#004b87', .4)); sign.position.set(0, 13.2, 7.1); office.add(sign);
    scene.add(office); W.officePos = new THREE.Vector3(76, 1.6, -26);
    const van = makeVan('#0b0f17'); van.position.set(66, 1.6, -22); van.rotation.y = Math.PI / 2; scene.add(van); W.vipVan = van;

    // Liman vinci (rıhtım) ve iki kule vinç
    const quayCrane = makeHarborCrane(); quayCrane.position.set(-30, 1.6, 33); scene.add(quayCrane);
    animated.push({ update: t => { quayCrane.userData.top.rotation.y = Math.sin(t * .12) * .9 - .4; } });
    [[-2, -50], [30, 2]].forEach(([x, z], i) => { const tc = makeTowerCrane(); tc.position.set(x, 1.6, z); scene.add(tc); animated.push({ update: t => { tc.userData.top.rotation.y = t * .05 * (i ? -1 : 1) + i * 2; } }); });

    // Araçlar: kamyon, forklift, SPMT, servis aracı — yollarda döngü
    [[-80, -2, 1, '#f8fafc', 'truck'], [40, -2, -1, '#facc15', 'fork'], [-60, 33, 1, '#f37021', 'truck'], [10, 33, -1, '#0ea5e9', 'van'], [-20, -2, 1, '#eab308', 'spmt']].forEach(([x0, z, dir, col, kind], i) => {
      const v = kind === 'van' ? makeVan(col) : makeTruck(col, kind); v.position.set(x0, 1.6, z + (dir > 0 ? -2.2 : 2.2)); v.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(v);
      const sp = kind === 'spmt' ? 1.6 : kind === 'fork' ? 3 : 6;
      animated.push({ update: (t) => { const span = 170, ph = ((x0 + 85) / span + t * sp / span * dir) % 1, p = (ph + 1) % 1; v.position.x = -85 + p * span; v.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; } });
      v.traverse(m => { if (m.userData.head) lampsHeadlights.push(m); });
    });

    // Aydınlatma direkleri: yol, rıhtım, ofis
    const posts = [];
    for (let x = -84; x <= 80; x += 16) { posts.push({ x, z: -8.5 }); posts.push({ x: x + 8, z: 26.5 }); }
    for (let x = -84; x <= 78; x += 14) if (Math.abs(x - 35) > 16) posts.push({ x, z: 37 });
    posts.push({ x: 60, z: -28 }, { x: 92, z: -28 });
    scene.add(instanced(new THREE.CylinderGeometry(.12, .18, 9, 6), std('#4b5563', .6, .5), posts.map(p => ({ x: p.x, y: 6.1, z: p.z }))));
    const headGeo = new THREE.BoxGeometry(1.2, .3, .6);
    lampHeads = instanced(headGeo, new THREE.MeshStandardMaterial({ color: '#d1d5db', emissive: '#ffd59a', emissiveIntensity: 0 }), posts.map(p => ({ x: p.x, y: 10.6, z: p.z })));
    lampHeads.castShadow = false; scene.add(lampHeads);
    posts.forEach(p => lamps.push({ pos: new THREE.Vector3(p.x, 10.4, p.z), color: new THREE.Color('#ffcf8a'), water: p.z > 35 }));
    // Parıltı sprite'ları (tek Points nesnesi, ucuz)
    const gp = []; lamps.forEach(l => gp.push(l.pos.x, l.pos.y, l.pos.z));
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    lampGlow = new THREE.Points(gg, new THREE.PointsMaterial({ size: 7, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: '#ffd9a0' }));
    scene.add(lampGlow);
    // Gerçek nokta ışıklar (kaliteye göre 0/4/8) — rıhtım ve hol önleri
    [[-60, 37], [-20, 37], [10, 37], [60, 37], [-40, -8.5], [0, -8.5], [40, -8.5], [76, -28]].forEach(([x, z]) => { const l = new THREE.PointLight('#ffc98a', 0, 34, 2); l.position.set(x, 9.5, z); scene.add(l); pointLights.push(l); });
    // Hol tavan aydınlatma panelleri
    (o.halls || []).forEach(h => { const p = new THREE.Mesh(new THREE.PlaneGeometry(h.w * .8, h.d * .8), new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0, side: THREE.DoubleSide })); p.rotation.x = Math.PI / 2; p.position.set(h.x, 1.6 + h.h - .2, h.z); scene.add(p); hallLights.push(p); });
    // Su yansıması için en yakın lambalar
    const wl = lamps.filter(l => l.water).slice(0, 8);
    water.material.uniforms.uLightN.value = wl.length;
    wl.forEach((l, i) => { water.material.uniforms.uLightPos.value[i].copy(l.pos); water.material.uniforms.uLightCol.value[i].copy(l.color); });

    if (window.THREE && THREE.PMREMGenerator) { try { pmrem = new THREE.PMREMGenerator(o.renderer); envScene = new THREE.Scene(); envSky = makeSky(); envSky.material.uniforms.uSunK.value = 0; envSky.scale.setScalar(.01); envScene.add(envSky); } catch (e) { pmrem = null; } }
    W.applyQuality(W.level);
    return { water, sky };
  };
  const lampsHeadlights = [];

  function makeVan(col) {
    const g = new THREE.Group(), body = box(4.6, 1.8, 2, std(col, .25, .6)); body.position.y = 1.2; g.add(body);
    const win = box(3.2, .7, 2.05, std('#0b1220', .1, .9)); win.position.set(.3, 1.6, 0); g.add(win);
    [[-1.5, .9], [1.5, .9], [-1.5, -.9], [1.5, -.9]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .3, 10), std('#111', .8)); w.rotation.x = Math.PI / 2; w.position.set(x, .38, z); g.add(w); });
    const hl = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, 1.6), new THREE.MeshBasicMaterial({ color: '#fff6d8' })); hl.position.set(2.32, 1, 0); hl.userData.head = true; g.add(hl);
    return g;
  }
  function makeTruck(col, kind) {
    const g = new THREE.Group();
    if (kind === 'spmt') { const p = box(10, .9, 4, std(col, .5, .3)); p.position.y = .7; g.add(p); for (let i = -4; i <= 4; i += 2) [-1.6, 1.6].forEach(z => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .3, 8), std('#111', .8)); w.rotation.x = Math.PI / 2; w.position.set(i, .3, z); g.add(w); }); return g; }
    if (kind === 'fork') { const b = box(2.4, 1.4, 1.4, std(col, .5)); b.position.y = 1; g.add(b); const m = box(.15, 3, 1.2, std('#374151', .5, .5)); m.position.set(1.3, 1.9, 0); g.add(m); const cage = box(1.4, .1, 1.4, std('#111', .6)); cage.position.set(-.3, 2.4, 0); g.add(cage); return g; }
    const cab = box(2.4, 2.4, 2.4, std(col, .4, .3)); cab.position.set(3.2, 1.6, 0); g.add(cab);
    const bed = box(6, 1.6, 2.4, std('#64748b', .6, .4)); bed.position.set(-1.2, 1.4, 0); g.add(bed);
    const steel = box(5, .7, 2, std('#8a5646', .6, .5)); steel.position.set(-1.2, 2.5, 0); g.add(steel);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, 1.8), new THREE.MeshBasicMaterial({ color: '#fff6d8' })); hl.position.set(4.42, 1.1, 0); hl.userData.head = true; g.add(hl);
    return g;
  }
  function makeHarborCrane() {
    const g = new THREE.Group(), m = std('#f37021', .45, .3), w = std('#e5e7eb', .5, .3);
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([x, z]) => { const l = box(.8, 8, .8, m); l.position.set(x, 4, z); g.add(l); });
    const top = new THREE.Group(); top.position.y = 8.5; g.add(top);
    const house = box(5, 3.5, 4, w); house.position.y = 1.7; top.add(house);
    const boom = box(1, 1, 30, m); boom.position.set(0, 6, 13); boom.rotation.x = -.45; top.add(boom);
    const cab = box(1.8, 1.5, 1.8, std('#0b1220', .1, .8)); cab.position.set(2.4, 3, 1.4); top.add(cab);
    g.userData.top = top; return g;
  }
  function makeTowerCrane() {
    const g = new THREE.Group(), y = std('#facc15', .5, .4);
    const mast = box(1.4, 34, 1.4, y); mast.position.y = 17; g.add(mast);
    const top = new THREE.Group(); top.position.y = 34; g.add(top);
    const jib = box(38, .9, .9, y); jib.position.set(10, .8, 0); top.add(jib);
    const cw = box(4, 2, 2, std('#6b7280', .8)); cw.position.set(-10, 0, 0); top.add(cw);
    const cab = box(2, 2, 2, std('#e5e7eb', .4)); cab.position.set(0, -1, 1.4); top.add(cab);
    const hook = box(.3, 12, .3, std('#111827', .6)); hook.position.set(18, -6, 0); top.add(hook);
    g.userData.top = top; return g;
  }

  // ---------------- Güneş yolu & ışık ----------------
  const C = (h) => new THREE.Color(h);
  const PAL = {
    zen: [C('#030915'), C('#1f3560'), C('#2f6fb1')], hor: [C('#0b1a2e'), C('#f0a26a'), C('#a9d4ee')],
    sun: [C('#7aa2d6'), C('#ffb36b'), C('#fff3dc')], deep: [C('#03141f'), C('#0a3a4f'), C('#06394f')], shallow: [C('#08303f'), C('#2a7d8d'), C('#0f7c94')]
  };
  function pal(k, e) { // e: güneş yüksekliği (-1..1) → gece/altın/gündüz karışımı
    const [n, g, d] = PAL[k], out = new THREE.Color();
    if (e < -.08) return out.copy(n);
    if (e < .12) return out.copy(n).lerp(g, (e + .08) / .2);
    if (e < .35) return out.copy(g).lerp(d, (e - .12) / .23);
    return out.copy(d);
  }
  W.sunFor = function (hour) { // Antalya: ~06:30 doğuş, ~19:30 batış
    const a = Math.PI * (hour - 6.5) / 13;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a) * .9, .35 + Math.sin(Math.max(0, Math.min(Math.PI, a))) * .4).normalize();
    return { dir, elev: Math.sin(a) };
  };
  W.update = function (t, dt, hourF, opts) {
    if (!ctx) return;
    opts = opts || {};
    const s = W.sunFor(hourF), e = s.elev; sunElev = e;
    nightK = 1 - U().clamp((e + .06) / .2, 0, 1);
    const sunCol = pal('sun', e), dayK = U().clamp((e + .02) / .4, 0, 1);
    if (ctx.sun) {
      const d = e > -.04 ? s.dir : new THREE.Vector3(-.4, .8, .45).normalize(); // gece: ay ışığı
      ctx.sun.position.copy(d).multiplyScalar(160); ctx.sun.target.position.set(0, 0, 5);
      ctx.sun.color.copy(e > -.04 ? sunCol : C('#9fb8e6'));
      ctx.sun.intensity = e > -.04 ? .3 + 1.25 * U().clamp(e * 3, 0, 1) : .28;
    }
    if (ctx.hemi) { ctx.hemi.intensity = .22 + .45 * dayK; ctx.hemi.color.copy(pal('hor', e)).lerp(C('#bfdbfe'), .4); }
    if (ctx.amb) ctx.amb.intensity = .12 + .22 * dayK;
    const zen = pal('zen', e), hor = pal('hor', e);
    if (sky) { const u = sky.material.uniforms; u.uZen.value.copy(zen); u.uHor.value.copy(hor); u.uSun.value.copy(s.dir); u.uSunCol.value.copy(sunCol); u.uNight.value = nightK; sky.position.copy(ctx.camera.position); }
    if (ctx.scene.fog) ctx.scene.fog.color.copy(hor).lerp(zen, .25);
    if (ctx.scene.background && ctx.scene.background.isColor) ctx.scene.background.copy(hor);
    if (water) { const u = water.material.uniforms; u.uTime.value = t; u.uSunDir.value.copy(s.dir); u.uSunCol.value.copy(sunCol); u.uSky.value.copy(hor).lerp(zen, .3); u.uNight.value = nightK; u.uDeep.value.copy(pal('deep', e)); u.uShallow.value.copy(pal('shallow', e)); }
    if (ctx.renderer) ctx.renderer.toneMappingExposure = 1.05 + .15 * dayK + nightK * .25;
    // Gece ışıkları
    if (lampHeads) lampHeads.material.emissiveIntensity = nightK * 2.2;
    if (lampGlow) lampGlow.material.opacity = nightK * .9;
    pointLights.forEach(l => { l.intensity = nightK * 2.4; });
    lampsHeadlights.forEach(h => { h.material.color.setRGB(.6 + nightK * .4, .6 + nightK * .36, .5 + nightK * .3); });
    hallLights.forEach(p => { p.material.opacity = nightK * .22; });
    if (cityMat) cityMat.emissiveIntensity = nightK * 1.4;
    beacons.forEach(b => { const on = Math.sin(t * 2 + b.ph) > 0; b.lamp.material.color.copy(b.col).multiplyScalar(on ? 1 : .25 + (1 - nightK) * .5); });
    animated.forEach(a => a.update(t, dt));
    // Ortam yansıması (PBR) — güneş yüksekliği belirgin değişince yeniden üret
    if (pmrem && PRESETS[W.level].env && Math.abs(e - lastEnvElev) > .08) {
      lastEnvElev = e; { const a = sky.material.uniforms, b = envSky.material.uniforms; b.uZen.value.copy(a.uZen.value).multiplyScalar(.55); b.uHor.value.copy(a.uHor.value).multiplyScalar(.55); b.uSun.value.copy(a.uSun.value); b.uSunCol.value.copy(a.uSunCol.value).multiplyScalar(.4); b.uNight.value = a.uNight.value; }
      try { if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0, .1, 100); ctx.scene.environment = envRT.texture; } catch (err) { pmrem = null; }
    }
    trackFps(performance.now(), opts.mode || 'auto');
  };
  W.night = () => nightK;
  W.sunElev = () => sunElev;

  // ---------------- Rıhtım showroom: tamamlanan filo ----------------
  // Filo tekneleri rıhtım boyunca (z≈45) suya bağlanır; aynı build() modelleri.
  W.syncFleet = function (fleet, interact) {
    if (!ctx || !DSAN.vessels) return;
    const want = (fleet || []).slice(0, 6), keep = new Set(want.map(v => v.uid));
    berths.forEach((g, uid) => { if (!keep.has(uid)) { ctx.scene.remove(g); DSAN.vessels.dispose(g); berths.delete(uid); } });
    let x = -84;
    want.forEach(v => {
      const bp = (window.getBlueprint ? window.getBlueprint(v.blueprintId) : { id: v.blueprintId });
      let g = berths.get(v.uid);
      if (!g) { g = DSAN.vessels.build(bp, 100, { noScaffold: true }); g.userData.fleetUid = v.uid; g.rotation.y = Math.PI / 2; ctx.scene.add(g); berths.set(v.uid, g); if (interact) interact(g, v); }
      const L = g.userData.L, B = g.userData.beam;
      g.position.set(x + L / 2, -1.2 - g.userData.draft, 41.6 + B / 2 + .3);
      g.userData.baseY = g.position.y; x += L + 4;
    });
  };
  W.berthOf = uid => berths.get(uid);
  W.animateBerths = function (t) { berths.forEach((g, uid) => { const k = U().hash(uid) % 100; g.position.y = g.userData.baseY + Math.sin(t * 1.3 + k) * .08; g.rotation.z = Math.sin(t * .9 + k) * .012; g.traverse(o => { if (o.userData && o.userData.spin) o.rotation.y += .03; }); }); };
  // Deniz denemesi sahnesi aynı gökyüzü/su/arazi üreticilerini kullanır
  Object.assign(W, { makeSky, makeWater, ridge, windowTexture, instanced, glowTexture, pal, makeVan });
  W.disposeAll = function () { if (envRT) envRT.dispose(); if (pmrem) pmrem.dispose(); };
})();
