/* YAŞAM. — UniRig ile iskeletlenmiş canlıların yaşadığı vadi.
 * Her canlının açlık / susuzluk / yorgunluk ihtiyaçları, gün-gece döngüsü,
 * sürü davranışı ve UniRig iskeletinden üretilen prosedürel animasyonu vardır.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Türler ----------
   * file: UniRig çıktısı (iskelet + skinning birleştirilmiş GLB).
   * h: gerçek boy (m). diet: 'yaprak' ağaç, 'ot' yerde otlama, 'tohum' gagalama. */
  const SPECIES = {
    zurafa: { file: 'models/zurafa.glb', name: 'Zürafa', icon: '🦒', h: 4.8, walk: 1.3, run: 2.6, diet: 'yaprak', start: 3, herd: true },
    kus: { file: 'models/kus.glb', name: 'Kuş', icon: '🐦', h: 0.45, walk: 0.5, fly: 6, flier: true, diet: 'tohum', start: 5, herd: true }
    // Yeni model: bash tools/unirig/rig.sh <klasör> model.glb <ad>  ->  buraya bir satır ekle.
  };

  /* ---------- Sahne ---------- */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbcd3c4, 90, 240);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.1); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 220 });
  sun.shadow.bias = -0.0005; scene.add(sun, sun.target);

  /* ---------- Arazi ---------- */
  const SIZE = 160, POND = { x: 16, z: -12, r: 10 }, WATER_Y = -0.35;
  function ground(x, z) {
    let h = 1.3 * Math.sin(x * 0.045) * Math.cos(z * 0.038) + 0.55 * Math.sin(x * 0.12 + z * 0.09) + 0.25 * Math.cos(z * 0.21 - x * 0.05);
    const d = Math.hypot(x - POND.x, z - POND.z) / POND.r;
    if (d < 1) h = WATER_Y - 0.1 - 1.4 * (1 - d * d);           // göl tabanı
    else if (d < 1.7) { const t = (1.7 - d) / 0.7, s = t * t * (3 - 2 * t); h = h * (1 - s) + (WATER_Y + 0.12 * (d - 1) / 0.7 - 0.02) * s; } // kıyı
    const edge = Math.max(Math.abs(x), Math.abs(z)) / (SIZE / 2);
    if (edge > 0.7) h += Math.pow((edge - 0.7) / 0.3, 2) * 14;
    return h;
  }
  {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, 160, 160); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = [];
    const cLow = new THREE.Color(0x5f7f3d), cHigh = new THREE.Color(0x8fa65a), cSand = new THREE.Color(0xb9a77a), cRock = new THREE.Color(0x7c7a6c), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = ground(x, z); p.setY(i, y);
      c.copy(cLow).lerp(cHigh, clamp((y + 1) / 3, 0, 1) * 0.8 + Math.random() * 0.12);
      const pd = Math.hypot(x - POND.x, z - POND.z) / POND.r;
      if (pd < 1.7) c.lerp(cSand, clamp((1.7 - pd) * 1.4, 0, 1));
      if (y > 4) c.lerp(cRock, clamp((y - 4) / 6, 0, 1));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; scene.add(m);
    const w = new THREE.Mesh(new THREE.CircleGeometry(POND.r * 1.08, 64), new THREE.MeshPhongMaterial({ color: 0x3d7f8c, transparent: true, opacity: 0.78, shininess: 90, specular: 0x99bbcc }));
    w.rotation.x = -Math.PI / 2; w.position.set(POND.x, WATER_Y, POND.z); scene.add(w);
  }
  // Ağaçlar (zürafa yaprak yer, kuşlar konar).
  const trees = [];
  {
    const trunkG = new THREE.CylinderGeometry(0.18, 0.32, 1, 7); trunkG.translate(0, 0.5, 0);
    const leafG = new THREE.IcosahedronGeometry(1, 0);
    const trunkM = new THREE.MeshLambertMaterial({ color: 0x6b4a32 }), leafM = new THREE.MeshPhongMaterial({ color: 0x4f7a34, flatShading: true, shininess: 4 });
    let n = 0, guard = 0;
    while (n < 34 && guard++ < 999) {
      const x = rnd(-62, 62), z = rnd(-62, 62);
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 5 || Math.hypot(x, z) < 8) continue;
      const hgt = rnd(4.5, 7.5), t = new THREE.Group();
      const tr = new THREE.Mesh(trunkG, trunkM); tr.scale.set(1, hgt, 1); tr.castShadow = true; t.add(tr);
      for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(leafG, leafM); const s = rnd(1.4, 2.3); l.scale.set(s, s * 0.75, s); l.position.set(rnd(-.8, .8), hgt + rnd(-.3, .7), rnd(-.8, .8)); l.castShadow = true; t.add(l); }
      t.position.set(x, ground(x, z), z); t.rotation.y = rnd(0, TAU); scene.add(t);
      trees.push({ x, z, top: hgt, leaves: 1 }); n++;
    }
  }
  // Çimen öbekleri.
  {
    const g = new THREE.ConeGeometry(0.06, 0.5, 3); g.translate(0, 0.25, 0);
    const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x7ea24a }), 2600);
    const o = new THREE.Object3D(); let i = 0;
    while (i < 2600) {
      const x = rnd(-70, 70), z = rnd(-70, 70), y = ground(x, z); if (y < -0.25) continue;
      o.position.set(x, y, z); o.rotation.set(rnd(-.25, .25), rnd(0, TAU), rnd(-.25, .25)); const s = rnd(.6, 1.5); o.scale.set(s, s, s);
      o.updateMatrix(); im.setMatrixAt(i++, o.matrix);
    }
    scene.add(im);
  }

  /* ---------- Zaman ---------- */
  const DAY = 360; // gerçek saniye / oyun günü (1× hızda)
  let tday = 0.27 * DAY, speedIdx = 0;
  const SPEEDS = [1, 3, 10, 0];
  const hour = () => (tday / DAY) * 24 % 24;
  const isNight = () => { const h = hour(); return h < 5.5 || h > 20.5; };
  const skyDay = new THREE.Color(0xa9cfe6), skyDusk = new THREE.Color(0xe7a774), skyNight = new THREE.Color(0x0d1626);
  function updateSky() {
    const h = hour(), a = (h - 6) / 12 * Math.PI; // 06:00 doğuş, 18:00 batış
    const el = Math.sin(a);
    sun.position.set(Math.cos(a) * 80, Math.max(el, -0.2) * 90 + 5, 30).add(camTarget);
    sun.target.position.copy(camTarget);
    const day = clamp(el * 3, 0, 1), dusk = clamp(1 - Math.abs(el) * 4, 0, 1) * (el > -0.25 ? 1 : 0);
    const sky = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, dusk * 0.55);
    scene.background = sky; scene.fog.color.copy(sky);
    sun.intensity = 0.05 + 1.05 * day; hemi.intensity = 0.18 + 0.6 * day;
    sun.color.setHSL(0.1, 0.6, 0.6 + 0.3 * day);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${isNight() ? '🌙' : '☀️'}`;
  }

  /* ---------- Kamera ---------- */
  const camTarget = new THREE.Vector3(0, 1, 0);
  const cam = { yaw: 0.6, pitch: 0.42, dist: 34 };
  function placeCamera() {
    cam.pitch = clamp(cam.pitch, 0.05, 1.45); cam.dist = clamp(cam.dist, 2, 120);
    camera.position.set(camTarget.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
    const gy = ground(camera.position.x, camera.position.z) + 0.4; if (camera.position.y < gy) camera.position.y = gy;
    camera.lookAt(camTarget);
  }
  const ptrs = new Map(); let dragMoved = 0, pinch0 = 0;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 1) {
      if (e.buttons === 2 || e.shiftKey) { // kaydır
        const f = cam.dist * 0.0016, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
        camTarget.x -= (dx * c - dy * s) * f; camTarget.z -= (-dx * s - dy * c) * f; following = null;
      } else { cam.yaw -= dx * 0.006; cam.pitch += dy * 0.005; }
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0) cam.dist *= pinch0 / d; pinch0 = d;
    }
  });
  const endPtr = e => { const was = ptrs.size; ptrs.delete(e.pointerId); if (was === 1 && dragMoved < 6 && e.type === 'pointerup') pick(e.clientX, e.clientY); if (ptrs.size < 2) pinch0 = 0; };
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist *= Math.exp(e.deltaY * 0.0012); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.key === ' ') { $('spd').click(); e.preventDefault(); }
    if (e.key === 'Escape') select(null);
  });

  /* ---------- Günlük ---------- */
  const logEl = $('log'), logLines = [];
  function log(html) { logLines.unshift(`<p>${html}</p>`); logLines.length = Math.min(logLines.length, 6); logEl.innerHTML = logLines.join(''); }

  /* ---------- Canlılar ---------- */
  const templates = {}; // tür → { scene, info, scale, offset, yaw }
  const creatures = [];
  const loader = new THREE.GLTFLoader();
  let nextId = 1;

  function prepareTemplate(key, gltfScene, sp) {
    let skinned = 0;
    gltfScene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.isSkinnedMesh) skinned++; } });
    if (!skinned) throw new Error('Modelde iskelet (SkinnedMesh) yok — önce UniRig ile iskeletle ve skinning uygula.');
    const info = YasamRig.analyze(gltfScene, { flier: !!sp.flier, forward: sp.forward, lateralAxis: sp.lateralAxis });
    const scale = sp.h / Math.max(info.size.y, 1e-6);
    const yaw = Math.atan2(info.forward.x, info.forward.z);
    templates[key] = { scene: gltfScene, info, scale, yaw, center: info.center.clone(), minY: info.box.min.y };
    return templates[key];
  }

  const NAMES = ['Ada', 'Bora', 'Cemre', 'Deniz', 'Ece', 'Fırat', 'Gece', 'Halay', 'Irmak', 'Kuzey', 'Lale', 'Mavi', 'Nehir', 'Ozan', 'Poyraz', 'Rüzgâr', 'Sarp', 'Tuna', 'Umay', 'Yağmur', 'Zeren', 'Aras', 'Bulut', 'Defne', 'Ela'];

  class Creature {
    constructor(key, x, z) {
      const sp = SPECIES[key], T = templates[key];
      this.id = nextId++; this.key = key; this.sp = sp; this.T = T;
      this.name = `${NAMES[(this.id * 7) % NAMES.length]}`;
      this.size = rnd(0.85, 1.12);
      const model = THREE.SkeletonUtils.clone(T.scene);
      const s = T.scale * this.size;
      model.scale.setScalar(s); model.rotation.y = -T.yaw;
      // Gövdeyi grup merkezine, ayakları zemine hizala.
      const c = T.center.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -T.yaw).multiplyScalar(s);
      model.position.set(-c.x, -T.minY * s, -c.z);
      this.group = new THREE.Group(); this.group.add(model); scene.add(this.group);
      this.model = model;
      this.anim = new YasamRig.Animator(model, T.info);
      this.x = x; this.z = z; this.heading = rnd(0, TAU); this.v = 0; this.alt = sp.flier ? rnd(3, 8) : 0;
      this.hunger = rnd(0.1, 0.4); this.thirst = rnd(0.1, 0.4); this.fatigue = rnd(0, 0.3); this.age = 0;
      this.state = sp.flier ? 'uçuyor' : 'geziniyor'; this.target = null; this.timer = 0; this.head = 0;
      this.helper = null;
    }
    get scaleH() { return this.sp.h * this.size; }
    setTarget(x, z, state) { this.target = { x, z }; if (state) this.state = state; }
    think(dt) {
      const sp = this.sp, night = isNight();
      this.hunger = clamp(this.hunger + dt * 0.0022, 0, 1);
      this.thirst = clamp(this.thirst + dt * 0.003, 0, 1);
      this.fatigue = clamp(this.fatigue + dt * (this.state === 'uyuyor' ? -0.006 : 0.0014 * (1 + this.v / (sp.walk || 1))), 0, 1);
      this.timer -= dt;
      const busy = ['içiyor', 'yiyor', 'otluyor', 'gagalıyor', 'uyuyor'].includes(this.state);
      if (busy) {
        if (this.state === 'içiyor') { this.thirst -= dt * 0.08; if (this.thirst <= 0.02) this.done('Susuzluğunu giderdi.'); }
        else if (this.state === 'uyuyor') { if (!night && this.fatigue < 0.25) this.done('Uyandı.'); }
        else { this.hunger -= dt * 0.05; if (this.hunger <= 0.03 || this.timer <= 0) this.done('Karnını doyurdu.'); }
        this.hunger = clamp(this.hunger, 0, 1); this.thirst = clamp(this.thirst, 0, 1);
        return;
      }
      if (this.target && !this.arrived()) return;
      if (this.target && this.arrived()) return this.onArrive();
      // Karar: en acil ihtiyaç.
      if ((night && this.fatigue > 0.2) || this.fatigue > 0.85) return this.goRest();
      if (this.thirst > 0.55 && this.thirst >= this.hunger) return this.goDrink();
      if (this.hunger > 0.5) return this.goEat();
      this.wander();
    }
    arrived() { return this.target && Math.hypot(this.target.x - this.x, this.target.z - this.z) < Math.max(0.6, this.scaleH * 0.35); }
    done(msg) { log(`<b>${this.name}</b> (${this.sp.name}) — ${msg}`); this.state = this.sp.flier ? 'uçuyor' : 'geziniyor'; this.target = null; this.head = 0; }
    goDrink() {
      const a = Math.atan2(this.z - POND.z, this.x - POND.x) + rnd(-0.3, 0.3), r = POND.r * 1.25 + (this.sp.flier ? 0 : this.scaleH * 0.12);
      this.setTarget(POND.x + Math.cos(a) * r, POND.z + Math.sin(a) * r, 'suya gidiyor');
      log(`<b>${this.name}</b> göle su içmeye gidiyor.`);
    }
    goEat() {
      if (this.sp.diet === 'yaprak') {
        let best = null, bd = 1e9; trees.forEach(t => { const d = Math.hypot(t.x - this.x, t.z - this.z) / (0.3 + t.leaves); if (d < bd) { bd = d; best = t; } });
        const a = rnd(0, TAU), r = 1.6;
        this.food = best; this.setTarget(best.x + Math.cos(a) * r, best.z + Math.sin(a) * r, 'ağaca gidiyor');
      } else {
        const a = rnd(0, TAU), r = rnd(2, 8); this.setTarget(this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, 'yiyecek arıyor');
      }
    }
    goRest() {
      const herd = this.herdCenter();
      const x = herd ? herd.x + rnd(-3, 3) : this.x + rnd(-2, 2), z = herd ? herd.z + rnd(-3, 3) : this.z + rnd(-2, 2);
      this.setTarget(x, z, 'dinlenmeye gidiyor');
    }
    herdCenter() {
      if (!this.sp.herd) return null;
      let n = 0, x = 0, z = 0; creatures.forEach(o => { if (o !== this && o.key === this.key) { n++; x += o.x; z += o.z; } });
      return n ? { x: x / n, z: z / n } : null;
    }
    wander() {
      const herd = this.herdCenter();
      let x, z;
      const R = this.sp.flier ? 30 : 16;
      if (herd && Math.hypot(herd.x - this.x, herd.z - this.z) > 12) { x = herd.x + rnd(-5, 5); z = herd.z + rnd(-5, 5); }
      else { const a = this.heading + rnd(-1.4, 1.4), r = rnd(5, R); x = this.x + Math.sin(a) * r; z = this.z + Math.cos(a) * r; }
      x = clamp(x, -60, 60); z = clamp(z, -60, 60);
      if (!this.sp.flier && Math.hypot(x - POND.x, z - POND.z) < POND.r * 1.1) { x += 10; }
      this.setTarget(x, z, this.sp.flier ? 'uçuyor' : 'geziniyor');
      if (this.sp.flier && Math.random() < 0.35) this.state = 'konuyor';
    }
    onArrive() {
      const s = this.state; this.target = null;
      if (s === 'suya gidiyor') { this.state = 'içiyor'; this.heading = Math.atan2(POND.x - this.x, POND.z - this.z); }
      else if (s === 'ağaca gidiyor') { this.state = 'yiyor'; this.timer = 25; if (this.food) { this.heading = Math.atan2(this.food.x - this.x, this.food.z - this.z); this.food.leaves = Math.max(0.1, this.food.leaves - 0.15); } }
      else if (s === 'yiyecek arıyor') { this.state = this.sp.flier ? 'gagalıyor' : 'otluyor'; this.timer = 20; }
      else if (s === 'dinlenmeye gidiyor') { this.state = 'uyuyor'; log(`<b>${this.name}</b> uykuya daldı.`); }
      else if (s === 'konuyor') { this.state = 'gagalıyor'; this.timer = rnd(6, 14); }
      else this.state = this.sp.flier ? 'uçuyor' : 'geziniyor';
    }
    step(dt) {
      this.think(dt);
      const sp = this.sp; this.age += dt;
      const airborne = sp.flier && !['içiyor', 'gagalıyor', 'uyuyor'].includes(this.state) && (this.target || this.alt > 0.05);
      let want = 0;
      if (this.target) {
        const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
        const th = Math.atan2(dx, dz); let dh = th - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        const turn = (airborne ? 1.6 : 1.1) * dt; this.heading += clamp(dh, -turn, turn);
        const urgent = this.thirst > 0.8 || this.hunger > 0.85;
        want = airborne ? sp.fly : (urgent && sp.run ? sp.run : sp.walk);
        want *= Math.max(0.15, Math.cos(dh)) * clamp(d / 2, 0.25, 1);
      }
      this.v += (want - this.v) * Math.min(1, dt * 2.5);
      // Ayrışma: aynı noktada üst üste durmasınlar.
      creatures.forEach(o => {
        if (o === this) return; const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), m = (this.scaleH + o.scaleH) * 0.18;
        if (d > 1e-3 && d < m) { this.x += dx / d * (m - d) * dt * 2; this.z += dz / d * (m - d) * dt * 2; }
      });
      this.x += Math.sin(this.heading) * this.v * dt; this.z += Math.cos(this.heading) * this.v * dt;
      this.x = clamp(this.x, -66, 66); this.z = clamp(this.z, -66, 66);
      // Uçuş yüksekliği.
      if (sp.flier) {
        const landing = this.state === 'konuyor' || this.state === 'suya gidiyor' || this.state === 'dinlenmeye gidiyor' || this.state === 'yiyecek arıyor';
        const near = this.target ? Math.hypot(this.target.x - this.x, this.target.z - this.z) : 0;
        const goal = !this.target ? 0 : landing ? Math.min(8, near * 0.35) : 6 + 3 * Math.sin(this.age * 0.3 + this.id);
        this.alt += (goal - this.alt) * Math.min(1, dt * 1.2);
        if (this.alt < 0.02) this.alt = 0;
      }
      let gy = ground(this.x, this.z);
      if (!sp.flier && gy < WATER_Y - 0.25) gy = WATER_Y - 0.25; // sığ suda yürür
      this.group.position.set(this.x, gy + this.alt, this.z);
      // Zemin eğimine göre hafif yatış.
      const e = 0.6 * this.scaleH, fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const pitch = sp.flier && this.alt > 0.1 ? -clamp((want - this.v) * 0.05, -0.3, 0.3) : -Math.atan2(ground(this.x + fx * e, this.z + fz * e) - ground(this.x - fx * e, this.z - fz * e), 2 * e) * 0.6;
      this.group.rotation.set(0, 0, 0); this.group.rotateY(this.heading); this.group.rotateX(pitch);
      // Baş pozu.
      const headGoal = { içiyor: 1, otluyor: 1, gagalıyor: 0.5 + 0.5 * Math.max(0, Math.sin(this.age * 7)), yiyor: sp.diet === 'yaprak' ? -0.25 : 0.8, uyuyor: 0.55 }[this.state] || 0;
      this.head += (headGoal - this.head) * Math.min(1, dt * 3);
      const ground2 = sp.flier && this.alt < 0.05;
      this.anim.update(dt, {
        speed: this.v, scale: this.T.scale * this.size, head: this.head, sleep: this.state === 'uyuyor',
        flying: sp.flier && !ground2, flapRate: sp.flier ? (this.alt > 0.05 ? (want > this.v || this.alt < 3 ? 7 : 3.2) : 0) : 0
      });
      if (this.helper) this.helper.visible = true;
    }
    dispose() { scene.remove(this.group); if (this.helper) scene.remove(this.helper); }
  }

  function spawn(key, x, z) {
    if (!templates[key]) return null;
    if (x == null) {
      const herd = creatures.filter(c => c.key === key);
      const base = herd.length ? herd[0] : { x: rnd(-30, 30), z: rnd(-30, 30) };
      x = clamp(base.x + rnd(-6, 6), -55, 55); z = clamp(base.z + rnd(-6, 6), -55, 55);
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2) x += POND.r + 4;
    }
    const c = new Creature(key, x, z); creatures.push(c);
    if (showBones) addHelper(c);
    $('pop').textContent = creatures.length;
    return c;
  }

  /* ---------- Seçim ve panel ---------- */
  let selected = null, following = null;
  const v3 = new THREE.Vector3();
  function pick(px, py) {
    let best = null, bd = 1e9;
    creatures.forEach(c => {
      v3.set(c.x, c.group.position.y + c.scaleH * 0.5, c.z).project(camera); if (v3.z > 1) return;
      const sx = (v3.x + 1) / 2 * innerWidth, sy = (1 - v3.y) / 2 * innerHeight;
      const r = Math.max(28, c.scaleH / (camera.position.distanceTo(c.group.position) + 0.1) * innerHeight * 0.8);
      const d = Math.hypot(sx - px, sy - py); if (d < r && d < bd) { bd = d; best = c; }
    });
    select(best);
  }
  function select(c) {
    selected = c; following = c;
    $('side').hidden = !c; $('follow').classList.toggle('on', !!c);
    if (c) renderPanel(true);
  }
  function bar(label, v, bad) { return `<div class="need${v > 0.6 ? ' bad' : ''}"><label><span>${label}</span><span>${Math.round((bad ? v : 1 - v) * 100)}%</span></label><div><i style="width:${Math.round((1 - v) * 100)}%"></i></div></div>`; }
  function renderPanel() {
    const c = selected; if (!c) return; const I = c.T.info;
    $('side').innerHTML = `<button class="x" id="cl" aria-label="Kapat">✕</button><h2>${c.sp.icon} ${c.name}</h2><div class="sub">${c.sp.name} · ${c.state}</div>
      ${bar('Tokluk', c.hunger)}${bar('Su', c.thirst)}${bar('Enerji', c.fatigue)}
      <div class="kv"><span>Boy</span><b>${c.scaleH.toFixed(2)} m</b><span>Hız</span><b>${c.v.toFixed(2)} m/s</b>
      <span>Kemik</span><b>${I.bones} (UniRig)</b><span>Yürüyüş</span><b>${I.gait === 'yok' ? '—' : I.gait + ' ayaklı'}</b>
      <span>Zincirler</span><b>${I.legs.length} bacak · ${I.arms.length} kol · ${I.wings.length} kanat · ${I.tails.length} kuyruk${I.neck ? ' · boyun' : ''}</b></div>`;
    $('cl').onclick = () => select(null);
  }

  /* ---------- İskelet görünümü ---------- */
  let showBones = false;
  function addHelper(c) { if (c.helper) return; c.helper = new THREE.SkeletonHelper(c.model); c.helper.material.depthTest = false; c.helper.material.linewidth = 2; scene.add(c.helper); }
  $('bones').onclick = () => {
    showBones = !showBones; $('bones').classList.toggle('on', showBones);
    creatures.forEach(c => { if (showBones) addHelper(c); else if (c.helper) { scene.remove(c.helper); c.helper = null; } });
  };
  $('spd').onclick = () => { speedIdx = (speedIdx + 1) % SPEEDS.length; $('spd').textContent = SPEEDS[speedIdx] ? SPEEDS[speedIdx] + '×' : '⏸'; };
  $('follow').onclick = () => { following = following ? null : selected; $('follow').classList.toggle('on', !!following); };

  /* ---------- Kendi modelin ---------- */
  $('own').onclick = () => $('file').click();
  $('file').onchange = async () => {
    const f = $('file').files[0]; $('file').value = ''; if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const g = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
      const box = new THREE.Box3().setFromObject(g.scene), h = box.getSize(new THREE.Vector3()).y;
      const name = f.name.replace(/\.glb$/i, '').replace(/[<>&"]/g, '').slice(0, 24) || 'Model';
      const key = 'ozel-' + Date.now();
      SPECIES[key] = { file: null, name, icon: '✨', h: h > 0.2 && h < 12 ? h : 1.5, walk: 1, run: 2, diet: 'ot', herd: true };
      prepareTemplate(key, g.scene, SPECIES[key]);
      addSpawnButton(key);
      const c = spawn(key, camTarget.x + rnd(-2, 2), camTarget.z + rnd(-2, 2)); select(c);
      const I = templates[key].info;
      log(`<b>${name}</b> vadiye katıldı: ${I.bones} kemik, ${I.legs.length} bacak.`);
    } catch (err) { log(`<b>Model eklenemedi:</b> ${String(err.message || err).replace(/[<>&]/g, '')}`); }
  };

  function addSpawnButton(key) {
    const sp = SPECIES[key], b = document.createElement('button');
    b.textContent = `${sp.icon} ${sp.name}`; b.title = `${sp.name} ekle`;
    b.onclick = () => { const c = spawn(key); if (c) log(`Yeni bir <b>${sp.name.toLowerCase()}</b> doğdu: ${c.name}.`); };
    $('spawns').appendChild(b);
  }

  /* ---------- Yükleme ---------- */
  async function boot() {
    const keys = Object.keys(SPECIES);
    const results = await Promise.all(keys.map(k => new Promise(res => {
      loader.load(SPECIES[k].file, g => { try { prepareTemplate(k, g.scene, SPECIES[k]); res(k); } catch (e) { console.warn(k, e); res(null); } }, undefined, e => { console.warn('yüklenemedi', k, e); res(null); });
    })));
    const ok = results.filter(Boolean);
    ok.forEach(k => { addSpawnButton(k); for (let i = 0; i < SPECIES[k].start; i++) spawn(k); });
    if (creatures.length) { camTarget.set(creatures[0].x, 1.5, creatures[0].z); cam.dist = 22; }
    $('load').classList.add('off');
    log(ok.length ? `Vadi uyandı: ${ok.map(k => SPECIES[k].name).join(', ')}.` : 'Model bulunamadı. ＋ Kendi modelin ile UniRig çıktısı bir GLB ekle.');
    window.__yasam = { creatures, templates, SPECIES, cam, select, ready: true };
  }

  /* ---------- Döngü ---------- */
  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  let last = performance.now(), panelT = 0;
  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000); last = now;
    const k = SPEEDS[speedIdx];
    const steps = Math.max(1, Math.ceil(k)), dt = real * k / steps;
    if (k) for (let s = 0; s < steps; s++) { tday += dt; creatures.forEach(c => c.step(dt)); }
    trees.forEach(t => { t.leaves = Math.min(1, t.leaves + real * k * 0.002); });
    if (following) camTarget.lerp(v3.set(following.x, following.group.position.y + following.scaleH * 0.5, following.z), Math.min(1, real * 3));
    updateSky(); placeCamera();
    if ((panelT += real) > 0.4) { panelT = 0; renderPanel(); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  updateSky(); placeCamera();
  requestAnimationFrame(frame);
  boot();
})();
