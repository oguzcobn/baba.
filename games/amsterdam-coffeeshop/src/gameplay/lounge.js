/* =============================================================================
   AMSTERDAM. — LOUNGE: masalarda oturan müşteriler, garson servisi, joint/bong,
   küllük + bong masa dekoru, köşede "High Mushroom", yan binada VIP oda
   -----------------------------------------------------------------------------
   Akış (masa):  kapı → boş sandalye → oturur → garson gelir, sipariş alır →
                 bara gider, hazırlar → getirir → müşteri joint içer / bong çeker → öder → çıkar
   Akış (VIP):   sıradan ayrılır → VIP kapısı → giriş ücreti → kanepeye oturur →
                 joint hemen gelir (VIP servisi) → uzun oturur → öder → çıkar
   Duman: her parçacık  p(t) = p0 + v0·t + ½·a·t² (a: kaldırma kuvveti, yukarı),
          yarıçap r(t) = r0·(1 + k·t) (difüzyon), opaklık α(t) = α0·(1 − t/T)²
   ============================================================================= */
(function () {
  'use strict';
  const BASE = 'models/';
  const PRICE = { joint: 12, bong: 9, vip: 55 };
  const COST = { joint: 3.2, bong: 2.1, vip: 6.5 };
  const lg = { ready: false, vip: false, seats: [], vipSeats: [], waiter: null, props: {}, smoke: [], t: 0 };
  let B = null, T = null;

  // ---- Model yükleme yardımcıları -------------------------------------------
  function loadGLB(file) {
    return new Promise(res => new T.GLTFLoader().load(BASE + file, g => res(g.scene), undefined, () => res(null)));
  }
  // modeli istenen boya (m) getir, tabanı y=0'a, merkezi x/z=0'a oturt
  function fit(obj, size, axis = 'y') {
    const w = new T.Group(); w.add(obj); w.updateMatrixWorld(true);
    let b = new T.Box3().setFromObject(obj); const sz = b.getSize(new T.Vector3());
    const k = size / (axis === 'max' ? Math.max(sz.x, sz.y, sz.z) : sz[axis]); obj.scale.multiplyScalar(k);
    w.updateMatrixWorld(true); b = new T.Box3().setFromObject(obj); const c = b.getCenter(new T.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b.min.y;
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return w;
  }

  // ---- Duman parçacıkları ----------------------------------------------------
  let smokeTex = null;
  function smokeTexture() {
    if (smokeTex) return smokeTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(235,235,235,0.9)'); g.addColorStop(0.5, 'rgba(210,210,215,0.35)'); g.addColorStop(1, 'rgba(200,200,205,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); smokeTex = new T.CanvasTexture(c); return smokeTex;
  }
  function emit(pos, n, big) {
    for (let i = 0; i < n; i++) {
      let p = lg.smoke.find(q => !q.alive);
      if (!p) {
        if (lg.smoke.length > 160) return;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0 }));
        B.scene.add(sp); p = { sp }; lg.smoke.push(p);
      }
      p.alive = true; p.t = 0; p.T = big ? 2.6 + Math.random() : 1.6 + Math.random() * 0.8;
      p.p0 = pos.clone().add(new T.Vector3((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.02));
      p.v0 = big ? new T.Vector3((Math.random() - 0.5) * 0.12, 0.08, (Math.random() - 0.5) * 0.12) : new T.Vector3((Math.random() - 0.5) * 0.03, 0.05, (Math.random() - 0.5) * 0.03);
      if (big && big.isVector3) p.v0.addScaledVector(big, 0.35);
      p.a = 0.06 + Math.random() * 0.04; p.r0 = big ? 0.07 : 0.025; p.k = big ? 2.2 : 3.4; p.a0 = big ? 0.55 : 0.35; p.c = 0;
      p.sp.visible = true;
    }
  }
  // Ağızdan üfleme akımı: hava sürtünmesiyle yavaşlayan jet  p(t) = p0 + v0·(1 − e^(−ct))/c + ½·a·t²
  function exhale(mouth, fwd, strength) {
    let p = lg.smoke.find(q => !q.alive);
    if (!p) {
      if (lg.smoke.length > 220) return;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      B.scene.add(sp); p = { sp }; lg.smoke.push(p);
    }
    p.alive = true; p.t = 0; p.T = 2.2 + Math.random() * 0.8;
    p.p0 = mouth.clone();
    p.v0 = fwd.clone().multiplyScalar(0.55 * strength).add(new T.Vector3((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 0.08));
    p.c = 2.4; p.a = 0.07 + Math.random() * 0.03; p.r0 = 0.018; p.k = 4.2; p.a0 = 0.5 * strength;
    p.sp.visible = true;
  }
  function stepSmoke(dt) {
    for (const p of lg.smoke) {
      if (!p.alive) continue;
      p.t += dt; const t = p.t;
      if (t >= p.T) { p.alive = false; p.sp.visible = false; continue; }
      const f = p.c ? (1 - Math.exp(-p.c * t)) / p.c : t;
      p.sp.position.set(p.p0.x + p.v0.x * f, p.p0.y + p.v0.y * f + 0.5 * p.a * t * t, p.p0.z + p.v0.z * f);
      p.sp.scale.setScalar(p.r0 * (1 + p.k * t) * 2);
      const fd = 1 - t / p.T; p.sp.material.opacity = p.a0 * fd * fd;
    }
  }

  // ---- Joint (kâğıt koni + kor ucu) ------------------------------------------
  function makeJoint() {
    const g = new T.Group();
    const paper = new T.Mesh(new T.CylinderGeometry(0.0072, 0.0042, 0.088, 10), new T.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.85 }));
    paper.rotation.x = Math.PI / 2; g.add(paper);
    const filter = new T.Mesh(new T.CylinderGeometry(0.0044, 0.0044, 0.018, 8), new T.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.9 }));
    filter.rotation.x = Math.PI / 2; filter.position.z = -0.05; g.add(filter);
    const ember = new T.Mesh(new T.SphereGeometry(0.0074, 8, 6), new T.MeshStandardMaterial({ color: 0x331107, emissive: 0xff5a1f, emissiveIntensity: 1.2 }));
    ember.position.z = 0.045; g.add(ember);
    g.userData.ember = ember; return g;
  }
  function giveJoint(n) {
    const c = n.meshObj.cast; if (n.lgJoint || !c) return;
    const j = makeJoint(), hand = c.hands && c.hands.R;
    if (hand) { j.position.set(0.02, -0.06, 0.05); j.rotation.set(0.3, 0.4, 0); hand.add(j); }
    else { j.position.set(0.25, 1.0, 0.25); n.meshObj.group.add(j); }
    n.lgJoint = j;
  }
  function dropJoint(n) { if (n.lgJoint) { n.lgJoint.parent && n.lgJoint.parent.remove(n.lgJoint); n.lgJoint = null; } }
  // Her kare: joint yönü (çekerken filtre dudakta), kor parlaması, uçtan ince duman, ağızdan üfleme
  let _v1 = null, _v2 = null;
  function smokeFrame(n, dt) {
    if (!_v1) { _v1 = new T.Vector3(); _v2 = new T.Vector3(); }
    const c = n.meshObj.cast, s = c.smokeState ? c.smokeState() : null, j = n.lgJoint;
    if (j) {
      const hand = j.parent ? j.parent.getWorldPosition(_v1) : null;
      if (hand && s) {
        if (s.ph === 'inhale' || s.ph === 'raise' && s.t > 0.6) j.lookAt(_v2.copy(hand).multiplyScalar(2).sub(s.mouth));   // kor dışarı, filtre ağza
        else j.lookAt(_v2.copy(hand).addScaledVector(s.fwd, 0.8).add(new T.Vector3(0, -0.25, 0)));
      }
      const e = j.userData; const want = s && s.ph === 'inhale' ? 1 : 0;
      e.glow = (e.glow || 0) + (want - (e.glow || 0)) * Math.min(1, dt * (want ? 6 : 1.5));
      e.ember.material.emissiveIntensity = 0.9 + 3.2 * e.glow;
      if (!s || s.ph !== 'inhale') {
        n.lgSmokeAcc = (n.lgSmokeAcc || 0) + dt;
        if (n.lgSmokeAcc > 0.33) { n.lgSmokeAcc = 0; emit(e.ember.getWorldPosition(new T.Vector3()), 1, false); }
      }
    }
    if (s && s.ph === 'exhale' && s.t < 1.25) {
      n.lgExAcc = (n.lgExAcc || 0) + dt;
      while (n.lgExAcc > 0.07) { n.lgExAcc -= 0.07; const up = new T.Vector3(0, 0.35, 0); exhale(s.mouth, s.fwd.clone().add(up).normalize(), 1 - s.t / 1.6); }
    }
  }

  // ---- Dükkân içi: küllük + bong masalara, mantar köşeye ----------------------
  const TABLES = [-8.6, -10.8, -13.0];
  async function buildShopProps() {
    const [ash, bong, mush] = await Promise.all([loadGLB('ashtray.glb'), loadGLB('bong.glb'), loadGLB('mushroom.glb')]);
    const topY = 0.16 + 0.77;
    lg.ashW = TABLES.map(tz => new T.Vector3(-2.85, topY + 0.02, tz - 0.14));
    lg.bongW = TABLES.map(tz => new T.Vector3(-3.38, topY + 0.16, tz + 0.05));
    if (ash) { const a = fit(ash, 0.15, 'max'); TABLES.forEach(tz => { const c = a.clone(); c.position.set(-2.85, topY, tz - 0.14); B.scene.add(c); }); lg.props.ash = a; }
    if (bong) {
      const b = fit(bong, 0.36, 'y'); lg.props.bong = b;
      lg.bongs = TABLES.map(tz => { const c = b.clone(); c.position.set(-3.38, topY, tz + 0.05); c.rotation.y = Math.random() * 6; B.scene.add(c); return c; });
    }
    if (mush) {
      // arka-sol köşe: teslimat kutularından uzak, kapıdan çapraz bakınca görünür
      const m = fit(mush, 1.05, 'y'); m.position.set(-3.82, 0.16, -15.55); m.rotation.y = 0.7; B.scene.add(m);
      B.colliders.push({ minX: -4.22, maxX: -3.42, minZ: -15.95, maxZ: -15.15, tag: 'lg_mushroom' });
    }
    // 6 sandalye (masa x = −3.05, sandalyeler z ± 0.62, masaya bakar)
    TABLES.forEach((tz, ti) => [-0.62, 0.62].forEach(dz => lg.seats.push({ x: -3.05, z: tz + dz, face: dz < 0 ? 0 : Math.PI, seatY: 0.64 - 0.16, table: ti, aisle: { x: -2.12, z: tz + dz * 0.8 }, npc: null })));
  }

  // ---- VIP oda: soldaki kanal evinin zemin katı ---------------------------------
  const VX = -8.2, VZ = -6.8, VW = 5.35, VD = 10.5, VDOOR = 1.4, VFLOOR = 0.13, VCEIL = 3.5;
  function neonTex(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#12051d'; x.fillRect(0, 0, 512, 128);
    x.font = 'bold 74px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#d946ef'; x.shadowBlur = 26; x.fillStyle = '#f5d0fe'; x.fillText(text, 256, 68); x.fillText(text, 256, 68);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  async function buildVIP() {
    // 1) yan evin zemin katını boşalt (üst katlar ve çatı kalır)
    const house = B.scene.children.find(o => o.isGroup && Math.abs(o.position.x - VX) < 0.01 && Math.abs(o.position.z - VZ) < 0.01);
    if (!house) return;
    house.updateMatrixWorld(true);
    house.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.parameters || {};
      if (p.depth && Math.abs(p.depth - VD) < 0.01 && p.height > 6) {   // gövde kutusu: alt 3.6 m'yi kes
        const h0 = p.height, w0 = p.width, cut = VCEIL + 0.1;
        o.geometry.dispose(); o.geometry = new T.BoxGeometry(w0, h0 - cut, VD); o.position.y = cut + (h0 - cut) / 2; return;
      }
      const b = new T.Box3().setFromObject(o); if (b.min.y < VCEIL - 0.2 && b.max.y < VCEIL + 1.2) o.visible = false;
    });
    const ci = B.colliders.findIndex(c => c.tag === 'building' && Math.abs(c.maxZ - VZ) < 0.01 && Math.abs((c.minX + c.maxX) / 2 - VX) < 0.01);
    if (ci >= 0) B.colliders.splice(ci, 1);
    const x0 = VX - VW / 2, x1 = VX + VW / 2, zB = VZ - VD;

    const G = new T.Group(); G.name = 'vip-lounge'; B.scene.add(G);
    const wallM = new T.MeshStandardMaterial({ color: 0x2b1438, roughness: 0.85 });
    const trimM = new T.MeshStandardMaterial({ color: 0x0d0612, roughness: 0.5, metalness: 0.4 });
    const floorM = new T.MeshStandardMaterial({ color: 0x3a2417, roughness: 0.6 });
    const glassM = new T.MeshStandardMaterial({ color: 0x1b0f2a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.45 });
    const box = (w, h, d, m, x, y, z) => { const me = new T.Mesh(new T.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.receiveShadow = true; G.add(me); return me; };
    box(VW, 0.13, VD, floorM, VX, VFLOOR / 2, VZ - VD / 2);
    box(VW, 0.1, VD, wallM, VX, VCEIL + 0.05, VZ - VD / 2);
    box(0.3, VCEIL, VD, wallM, x0 + 0.15, VCEIL / 2, VZ - VD / 2);
    box(0.3, VCEIL, VD, wallM, x1 - 0.15, VCEIL / 2, VZ - VD / 2);
    box(VW, VCEIL, 0.3, wallM, VX, VCEIL / 2, zB + 0.15);
    // ön cephe: koyu çerçeve + buzlu cam + kapı boşluğu
    const side = (VW - VDOOR) / 2;
    box(side, 0.8, 0.3, trimM, x0 + side / 2, 0.4, VZ - 0.15); box(side, 0.8, 0.3, trimM, x1 - side / 2, 0.4, VZ - 0.15);
    box(side - 0.1, 2.2, 0.06, glassM, x0 + side / 2, 1.9, VZ - 0.15); box(side - 0.1, 2.2, 0.06, glassM, x1 - side / 2, 1.9, VZ - 0.15);
    box(VW, VCEIL - 3.0, 0.32, trimM, VX, 3.0 + (VCEIL - 3.0) / 2, VZ - 0.15);
    for (const px of [x0 + 0.06, VX - VDOOR / 2 - 0.06, VX + VDOOR / 2 + 0.06, x1 - 0.06]) box(0.12, 3.0, 0.34, trimM, px, 1.5, VZ - 0.15);
    // neon tabela + kapı ışığı + kırmızı halı
    const sign = new T.Mesh(new T.PlaneGeometry(2.4, 0.6), new T.MeshStandardMaterial({ map: neonTex('VIP LOUNGE'), emissive: 0xffffff, emissiveMap: neonTex('VIP LOUNGE'), emissiveIntensity: 1.1 }));
    sign.position.set(VX, 3.26, VZ + 0.02); G.add(sign);
    const rug = new T.Mesh(new T.PlaneGeometry(1.1, 2.4), new T.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(VX, 0.135, VZ - 1.3); G.add(rug);
    const outRug = rug.clone(); outRug.scale.set(1, 0.5, 1); outRug.position.set(VX, 0.125, VZ + 0.6); G.add(outRug);
    // kadife ip direkleri
    const postM = new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 });
    for (const sx of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.035, 0.05, 0.95, 10), postM); p.position.set(VX + sx * 0.95, 0.6, VZ + 0.55); G.add(p); }
    const l1 = new T.PointLight(0xc026d3, 1.3, 9, 2); l1.position.set(VX, 3.0, VZ - 3.0); G.add(l1);
    const l2 = new T.PointLight(0xffb36b, 1.0, 8, 2); l2.position.set(VX, 3.0, VZ - 8.0); G.add(l2);
    const l3 = new T.PointLight(0xe879f9, 0.8, 4, 2); l3.position.set(VX, 2.8, VZ + 0.6); G.add(l3);
    // çarpışma: duvarlar (kapı boşluğu hariç)
    const C = (a, b, c, d) => B.colliders.push({ minX: a, maxX: b, minZ: c, maxZ: d, tag: 'vip_wall' });
    C(x0, x0 + 0.3, zB, VZ); C(x1 - 0.3, x1, zB, VZ); C(x0, x1, zB, zB + 0.3);
    C(x0, VX - VDOOR / 2, VZ - 0.3, VZ); C(VX + VDOOR / 2, x1, VZ - 0.3, VZ);

    // 2) oda modeli: dik açıya hizala, büyük duvarlarını gizle, arka yarıya yerleştir
    const room = await loadGLB('room.glb');
    if (room) {
      room.updateMatrixWorld(true);
      const meshes = []; room.traverse(o => { if (o.isMesh) meshes.push(o); });
      const all = new T.Box3().setFromObject(room), H = all.max.y - all.min.y;
      const floor = meshes.map(m => [m, new T.Box3().setFromObject(m)]).filter(([, b]) => b.max.y - b.min.y < H * 0.08).sort((a, b) => {
        const sa = a[1].getSize(new T.Vector3()), sb = b[1].getSize(new T.Vector3()); return sb.x * sb.z - sa.x * sa.z; })[0];
      for (const [m, b] of meshes.map(m => [m, new T.Box3().setFromObject(m)])) if (b.max.y - b.min.y > H * 0.8) m.visible = false;
      // floor köşelerinin dik hizası: en küçük xz alanını veren açı
      const holder = new T.Group(); holder.add(room);
      let bestA = 0, bestArea = 1e9;
      for (let d = 0; d < 90; d += 1) {
        holder.rotation.y = d * Math.PI / 180; holder.updateMatrixWorld(true);
        const b = new T.Box3().setFromObject(floor ? floor[0] : room), s = b.getSize(new T.Vector3());
        if (s.x * s.z < bestArea) { bestArea = s.x * s.z; bestA = holder.rotation.y; }
      }
      // ekran (en büyük dikey düz yüzey, havada) arka duvara (−z) baksın: kanepe ekrana dönük oturur
      const named = (n) => meshes.find(m => m.name === n || (m.parent && m.parent.name === n));
      let best = null, bestScore = -1;
      for (const turn of [0, 1, 2, 3]) {
        holder.rotation.y = bestA + turn * Math.PI / 2; holder.updateMatrixWorld(true);
        const scr = named('Object_6') || named('Object_10'), sofa = named('Object_204') || named('Object_202');
        if (!scr || !sofa) { best = holder.rotation.y; break; }
        const a = new T.Box3().setFromObject(scr).getCenter(new T.Vector3()), b = new T.Box3().setFromObject(sofa).getCenter(new T.Vector3());
        const sc = b.z - a.z; if (sc > bestScore) { bestScore = sc; best = holder.rotation.y; }
      }
      holder.rotation.y = best; holder.updateMatrixWorld(true);
      const fb = new T.Box3().setFromObject(floor ? floor[0] : room), fs = fb.getSize(new T.Vector3());
      const k = (VW - 0.7) / Math.max(fs.x, fs.z); holder.scale.setScalar(k); holder.updateMatrixWorld(true);
      const fb2 = new T.Box3().setFromObject(floor ? floor[0] : room);
      holder.position.set(VX - (fb2.min.x + fb2.max.x) / 2, VFLOOR - fb2.max.y + 0.005, (zB + 0.32) - fb2.min.z);
      holder.updateMatrixWorld(true);
      room.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      G.add(holder);
      // kanepe oturma yerleri
      const sofa = named('Object_204') || named('Object_202');
      if (sofa) {
        const sb = new T.Box3().setFromObject(sofa), c = sb.getCenter(new T.Vector3()), s = sb.getSize(new T.Vector3());
        const along = s.x > s.z ? 'x' : 'z', len = Math.max(s.x, s.z);
        const scr = named('Object_6') || named('Object_10'); const sc = scr ? new T.Box3().setFromObject(scr).getCenter(new T.Vector3()) : new T.Vector3(VX, 0, zB);
        const face = Math.atan2(sc.x - c.x, sc.z - c.z);
        const facing = new T.Vector3(Math.sin(face), 0, Math.cos(face));
        for (const f of [-0.3, 0, 0.3]) {
          const p = c.clone(); p[along] += f * len; p.addScaledVector(facing, Math.min(s.x, s.z) * 0.08);
          const fc = along === 'x' ? (facing.z < 0 ? Math.PI : 0) : (facing.x < 0 ? -Math.PI / 2 : Math.PI / 2);
          lg.vipSeats.push({ x: p.x, z: p.z, face: fc, seatY: Math.max(0.36, Math.min(0.5, (sb.max.y - VFLOOR) * 0.55)), npc: null, vip: true });
        }
      }
    }
    if (!lg.vipSeats.length) [-1, 0, 1].forEach(i => lg.vipSeats.push({ x: VX + i * 0.8, z: zB + 2.6, face: Math.PI, seatY: 0.44, npc: null, vip: true }));
    window.__extraDoors = [{ x: VX, z: VZ, x0: x0 - 0.3, x1: x1 + 0.3, lane: 0.26 }];
    lg.vip = true;
  }

  // ---- Garson ---------------------------------------------------------------------
  const STATION = { x: -1.55, z: -13.7 }, BAR = { x: -1.9, z: -13.95 };
  function makeWaiter() {
    if (lg.waiter || !window.ModelCast || !ModelCast.has('glb_char4')) return;
    const rig = ModelCast.build('glb_char4'); if (!rig) return;
    // önlük: garson olduğu belli olsun
    B.scene.add(rig.group);
    rig.group.position.set(STATION.x, 0.16, STATION.z); rig.group.updateMatrixWorld(true);

    lg.waiter = { rig, x: STATION.x, z: STATION.z, tx: STATION.x, tz: STATION.z, task: null, t: 0, yaw: Math.PI, speed: rig.cast.speed * 1.05 };
  }
  function waiterFrame(dt, el) {
    const w = lg.waiter; if (!w) return;
    const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
    let v = 0;
    if (d > 0.12) {
      v = w.speed; const stp = Math.min(v * dt, d); const nx = w.x + dx / d * stp, nz = w.z + dz / d * stp;
      const r = B.resolvePlayerCollision(nx, nz, 0.28, false);
      const moved = Math.hypot(r.x - w.x, r.z - w.z);
      w.stall = moved < stp * 0.3 ? (w.stall || 0) + dt : 0;   // bir engele takıldıysa 1.2 s sonra varmış say
      w.x = r.x; w.z = r.z; w.yaw = Math.atan2(dx, dz);
      if (w.stall > 1.2) { w.tx = w.x; w.tz = w.z; w.stall = 0; }
    }
    w.rig.group.position.set(w.x, 0.16, w.z); w.rig.group.rotation.y = w.yaw;
    w.rig.cast.update(dt, v, el);
    const arrived = d <= 0.12; w.t += dt;
    const task = w.task;
    if (!task) {
      const seat = lg.seats.find(s => s.npc && s.npc.state === 'lg_t_wait' && !s.claimed);
      if (seat) { seat.claimed = true; w.task = { seat, phase: 'go' }; w.tx = seat.aisle.x; w.tz = seat.aisle.z; }
      else { w.tx = STATION.x; w.tz = STATION.z; if (arrived) w.yaw += (0 - w.yaw) * Math.min(1, dt * 3); }
      return;
    }
    const n = task.seat.npc;
    if (!n || !/^lg_t_/.test(n.state)) { task.seat.claimed = false; w.task = null; return; }
    if (!arrived) return;
    if (task.phase === 'go') {
      w.yaw = Math.atan2(task.seat.x - w.x, task.seat.z - w.z);
      task.what = Math.random() < 0.65 ? 'joint' : 'bong';
      MarketMode.emote(n, task.what === 'joint' ? 'Bir joint lütfen 🌿' : 'Bong alabilir miyim? 💨');
      n.state = 'lg_t_ordered'; task.phase = 'take'; w.t = 0;
    } else if (task.phase === 'take') {
      if (w.t > 2.2) { task.phase = 'bar'; w.tx = BAR.x; w.tz = BAR.z; }
    } else if (task.phase === 'bar') {
      w.yaw = Math.PI; if (!task.prep) { task.prep = true; w.t = 0; }
      if (w.t > 3.0) {
        if (task.what === 'joint') { task.carry = makeJoint(); const h = w.rig.cast.hands && w.rig.cast.hands.R; if (h) { task.carry.position.set(0.02, -0.06, 0.05); h.add(task.carry); } }
        task.phase = 'serve'; w.tx = task.seat.aisle.x; w.tz = task.seat.aisle.z;
      }
    } else if (task.phase === 'serve') {
      w.yaw = Math.atan2(task.seat.x - w.x, task.seat.z - w.z);
      if (task.carry) { task.carry.parent && task.carry.parent.remove(task.carry); task.carry = null; }
      startSession(n, task.what, task.seat);
      task.seat.claimed = false; w.task = null;
    }
  }

  function startSession(n, what, seat) {
    n.lgWhat = what; n.lgT = 0; n.lgDur = (seat.vip ? 55 : 32) + Math.random() * 18;
    n.state = seat.vip ? 'lg_v_smoke' : 'lg_t_smoke';
    const c = n.meshObj.cast;
    if (what === 'joint') { giveJoint(n); c.setAct && c.setAct('smoke'); }
    else { c.setAct && c.setAct('bong'); n.lgBong = lg.bongs ? lg.bongs[seat.table] : null; }
  }
  function endSession(n, seat) {
    const what = n.lgWhat, vip = seat && seat.vip;
    const gross = vip ? PRICE.vip : PRICE[what] || PRICE.joint, cost = vip ? COST.vip : COST[what] || COST.joint;
    MarketMode.addRevenue(gross, 0.21, cost, n, vip ? 'VIP harikaydı ✨' : what === 'bong' ? 'Süper bong 💨' : 'Çok rahatladım 🌿', vip ? 14 : 7);
    dropJoint(n); const c = n.meshObj.cast; c.stand && c.stand();
    if (seat) seat.npc = null; n.lgSeat = null; n.lgWhat = null;
    n.state = 'leaving';
  }
  function leaveUnserved(n, msg) {
    const seat = n.lgSeat; dropJoint(n); const c = n.meshObj.cast; c.stand && c.stand();
    if (seat) { seat.npc = null; seat.claimed = false; } n.lgSeat = null;
    MarketMode.emote(n, msg); n.state = 'leaving';
  }


  // ---- PERFORMANS: hareket etmeyen dekoru malzemeye göre tek ağda birleştir (çizim çağrısı ↓) ----
  function mergeStatic(group) {
    group.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(group.matrixWorld).invert(), buckets = new Map();
    group.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.geometry || !o.geometry.attributes.position) return;
      for (let p = o; p && p !== group; p = p.parent) if (!p.visible) return;
      if (o.material.transparent || o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return;
      const key = o.material.uuid + (o.castShadow ? 's' : '') + (o.receiveShadow ? 'r' : '');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, rec: o.receiveShadow, list: [] });
      buckets.get(key).list.push(o);
    });
    let removed = 0;
    for (const b of buckets.values()) {
      if (b.list.length < 2) continue;
      const hasUV = b.list.every(o => o.geometry.attributes.uv);
      let nv = 0, ni = 0;
      for (const o of b.list) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = hasUV ? new Float32Array(nv * 2) : null, I = new Uint32Array(ni);
      let vo = 0, io = 0; const m = new T.Matrix4(), nm = new T.Matrix3(), v = new T.Vector3();
      for (const o of b.list) {
        const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
        m.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m);
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
          if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z; }
          if (U) { U[(vo + i) * 2] = ua.getX(i); U[(vo + i) * 2 + 1] = ua.getY(i); }
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) I[io++] = g.index.getX(i) + vo;
        else for (let i = 0; i < pa.count; i++) I[io++] = i + vo;
        vo += pa.count;
      }
      const mg = new T.BufferGeometry();
      mg.setAttribute('position', new T.BufferAttribute(P, 3)); mg.setAttribute('normal', new T.BufferAttribute(N, 3));
      if (U) mg.setAttribute('uv', new T.BufferAttribute(U, 2));
      mg.setIndex(new T.BufferAttribute(I, 1)); mg.computeBoundingSphere();
      const mesh = new T.Mesh(mg, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.rec; mesh.name = 'merged';
      group.add(mesh);
      for (const o of b.list) { o.parent && o.parent.remove(o); removed++; }
    }
    return removed;
  }
  function perfPass() {
    let n = 0;
    // kanal evleri (sokağın iki yakası) + VIP salon dekoru
    B.scene.children.slice().forEach(o => {
      if (o.isGroup && (Math.abs(o.position.z + 6.8) < 0.01 || Math.abs(o.position.z - 32.2) < 0.01) && o.position.y === 0) n += mergeStatic(o);
    });
    const vip = B.scene.getObjectByName('vip-lounge'); if (vip) n += mergeStatic(vip);
    lg.merged = n;
  }

  // ---- MarketMode kancaları ------------------------------------------------------
  function admit(n) {
    if (!lg.ready || !n.meshObj || !n.meshObj.cast || !n.meshObj.cast.canSit) return false;
    const lvl = MarketMode.level ? MarketMode.level() : 1;
    const vipFree = lg.vip && lg.vipSeats.find(s => !s.npc);
    if (vipFree && Math.random() < (lvl >= 2 ? 0.2 : 0.12)) {
      vipFree.npc = n; n.lgSeat = vipFree; n.state = 'lg_v_go'; n.targetX = VX + 0.4; n.targetZ = VZ + 1.2;
      MarketMode.emote(n, 'VIP odaya geçiyorum ✨'); return true;
    }
    const free = lg.seats.filter(s => !s.npc);
    if (free.length && Math.random() < 0.34) {
      const seat = free[Math.floor(Math.random() * free.length)];
      seat.npc = n; n.lgSeat = seat; n.state = 'lg_t_go'; n.targetX = seat.x; n.targetZ = seat.z;
      B.state.doorOpen = true; return true;
    }
    return false;
  }
  function sitDown(n, seat) {
    n.x = seat.x; n.z = seat.z; n.targetX = seat.x; n.targetZ = seat.z;
    n.meshObj.group.rotation.y = seat.face;
    const o = seat.vip ? {} : { table: { top: 0.93, z: 0.23 }, ash: lg.ashW && lg.ashW[seat.table], bong: lg.bongW && lg.bongW[seat.table] };
    n.meshObj.cast.sit(seat.seatY, null, o);
  }
  function arrive(n, dt) {
    const st = n.state; if (!st || st.slice(0, 3) !== 'lg_') return false;
    const seat = n.lgSeat;
    if (!seat) { n.state = 'leaving'; return true; }
    n.meshObj.group.rotation.y = seat.face;
    switch (st) {
      case 'lg_t_go': sitDown(n, seat); n.state = 'lg_t_wait'; n.lgT = 0; MarketMode.emote(n, 'Garson! 🙋'); break;
      case 'lg_t_wait': n.lgT += dt;
        if (!lg.waiter && n.lgT > 6) startSession(n, Math.random() < 0.65 ? 'joint' : 'bong', seat);   // garson modeli yüklenmediyse
        else if (n.lgT > 60) leaveUnserved(n, 'Garson hiç gelmedi…'); break;
      case 'lg_t_ordered': break;
      case 'lg_t_smoke': case 'lg_v_smoke':
        n.lgT += dt;
        if (n.lgJoint) smokeFrame(n, dt);
        else if (n.lgWhat === 'bong') {   // bong: çek (~2 s) → kafa kalkar → ağızdan yukarı doğru bulut
          n.lgBongAcc = (n.lgBongAcc || 0) + dt;
          if (n.lgBongAcc > 7.5 && n.lgBongAcc < 8.9) { n.lgExAcc = (n.lgExAcc || 0) + dt; while (n.lgExAcc > 0.06) { n.lgExAcc -= 0.06; const m = n.meshObj.cast.mouthWorld(); const f = new T.Vector3(Math.sin(n.meshObj.group.rotation.y), 0.9, Math.cos(n.meshObj.group.rotation.y)).normalize(); exhale(m, f, 1); } }
          if (n.lgBongAcc > 10) n.lgBongAcc = 0;
        }
        if (n.lgT > n.lgDur) endSession(n, seat);
        break;
      case 'lg_v_go': n.state = 'lg_v_in'; n.targetX = seat.x; n.targetZ = seat.z; break;
      case 'lg_v_in': sitDown(n, seat); MarketMode.emote(n, 'VIP servis geliyor 🥂'); startSession(n, 'joint', seat); break;
      default: return false;
    }
    return true;
  }

  function frame(dt, el) {
    if (B && window.ModelCast && ModelCast.beginFrame) ModelCast.beginFrame(B.camera, B.scene);
    if (!B || !lg.ready) return;
    lg.t += dt;
    if (!lg.waiter && Math.floor(lg.t) % 2 === 0) makeWaiter();
    if (MarketMode.active && MarketMode.active()) waiterFrame(dt, el);
    else if (lg.waiter) { lg.waiter.rig.group.position.set(lg.waiter.x, 0.16, lg.waiter.z); lg.waiter.rig.cast.update(dt, 0, el); }
    stepSmoke(dt);
  }

  function init() {
    B = window.GameBridge; T = window.THREE;
    if (!B || !B.scene || !T.GLTFLoader) return;
    if (window.ModelCast) ModelCast.reserve('glb_char4');   // Joris garson olarak çalışır
    Promise.all([buildShopProps(), buildVIP().catch(e => console.warn('VIP', e))]).then(() => {
      try { perfPass(); } catch (e) { console.warn('perf', e); }
      lg.ready = true;
    });
  }
  if (window.ModelCast) ModelCast.reserve('glb_char4');
  window.addEventListener('game-ready', init);
  if (window.GameBridge && window.GameBridge.scene) init();

  window.Lounge = { arrive, admit, frame, vipReady: () => lg.vip, _lg: lg, emit, credits: () => [
    { title: 'CC0 - Ashtray', author: 'plaggy', url: 'https://sketchfab.com/3d-models/cc0-ashtray-313192b7abae47ffa82e4ba24e947f70', license: 'CC BY 4.0' },
    { title: 'Bong glass for smoking Weed', author: 'riosstudio', url: 'https://sketchfab.com/3d-models/bong-glass-for-smoking-weed-50ef251d19cc4e909f8369aae5aa901e', license: 'CC BY 4.0' },
    { title: 'High Mushroom Smoking weed', author: 'damongraphics', url: 'https://sketchfab.com/3d-models/high-mushroom-smoking-weed-d3b9e71cd1d74cf692ab19d0aa392c87', license: 'CC BY 4.0' },
    { title: 'Room Weed', author: 'Cosmar_one', url: 'https://sketchfab.com/3d-models/room-weed-91e12fd8c06f49309a452d82e43d98c0', license: 'CC BY 4.0' }
  ] };
})();
