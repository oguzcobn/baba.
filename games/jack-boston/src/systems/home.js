// EV DİZAYNI: emlak satın alma, iç mekân sahnesi, B tuşlu 0.5m ızgara editörü (R döndür, çakışma matrisi, kapı önü kapalı, 3 katman)
import * as THREE from 'three';
import * as T from '../engine/textures.js';
import { Ped } from '../entities/ped.js';

export const PROPS = {
  boston_dorm: { name: 'Harlow Hall — Yurt Odası', price: 0, w: 4, d: 5, loc: 'dorm', track: 'rainy_jazz' },
  boston_studio: { name: 'Downtown Stüdyo Daire', price: 12000, w: 6, d: 7, loc: 'studio', track: 'rainy_jazz' },
  boston_campus_house: { name: 'Kampüs Bahçeli Ev', price: 32000, w: 9, d: 8, loc: 'campusHouse', track: 'acoustic_evening' },
  boston_harbor_loft: { name: 'Liman Manzaralı Loft', price: 65000, w: 12, d: 9, loc: 'loft', track: 'sunset_lofi' },
};
const G = 0.5; // ızgara
// katalog: w,d hücre (0.5m), layer, fiyat, yapıcı
export const CATALOG = {
  bed: { n: 'Yatak', p: 500, w: 4, d: 6, layer: 'floor', act: 'bed' },
  sofa: { n: 'Kanepe', p: 400, w: 5, d: 2, layer: 'floor' },
  table: { n: 'Masa', p: 150, w: 3, d: 2, layer: 'floor', surface: true },
  desk: { n: 'Çalışma Masası', p: 220, w: 3, d: 2, layer: 'floor', surface: true },
  chair: { n: 'Sandalye', p: 60, w: 1, d: 1, layer: 'floor' },
  rug: { n: 'Halı', p: 120, w: 5, d: 4, layer: 'rug' },
  bookcase: { n: 'Kitaplık', p: 250, w: 3, d: 1, layer: 'floor' },
  wardrobe: { n: 'Gardırop', p: 300, w: 3, d: 2, layer: 'floor', act: 'wardrobe' },
  plant: { n: 'Saksı Bitkisi', p: 40, w: 1, d: 1, layer: 'floor' },
  lamp: { n: 'Lambader', p: 80, w: 1, d: 1, layer: 'floor' },
  memshelf: { n: 'Anı Rafı', p: 200, w: 3, d: 1, layer: 'floor', act: 'memories' },
  turntable: { n: 'Pikap', p: 300, w: 2, d: 1, layer: 'surface', act: 'music' },
  tablelamp: { n: 'Masa Lambası', p: 45, w: 1, d: 1, layer: 'surface' },
  vase: { n: 'Çiçek Vazosu', p: 35, w: 1, d: 1, layer: 'surface' },
  painting: { n: 'Tablo', p: 90, w: 3, d: 1, layer: 'wall' },
  clock: { n: 'Duvar Saati', p: 50, w: 1, d: 1, layer: 'wall' },
  curtain: { n: 'Perde', p: 70, w: 3, d: 1, layer: 'wall' },
};
const lm = (c) => new THREE.MeshLambertMaterial({ color: c });
function box(g, w, h, d, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
function makeFurniture(id) {
  const g = new THREE.Group(); const C = CATALOG[id]; const W = C.w * G, D = C.d * G; const wood = lm(0x8a5a3a), dark = lm(0x3a2a20);
  switch (id) {
    case 'bed': box(g, W, 0.35, D, 0, 0, 0, wood); box(g, W - 0.1, 0.2, D - 0.2, 0, 0.35, 0.05, lm(0xe8e2d4)); box(g, W - 0.2, 0.15, 0.5, 0, 0.55, -D / 2 + 0.45, lm(0xf6f2ea)); box(g, W - 0.1, 0.06, D * 0.55, 0, 0.55, D * 0.18, lm(0x4f6a8a)); box(g, W, 0.7, 0.1, 0, 0, -D / 2, wood); break;
    case 'sofa': box(g, W, 0.45, D, 0, 0, 0, lm(0x6a4a6a)); box(g, W, 0.5, 0.25, 0, 0.45, -D / 2 + 0.12, lm(0x5a3a5a)); box(g, 0.25, 0.3, D, -W / 2 + 0.12, 0.45, 0, lm(0x5a3a5a)); box(g, 0.25, 0.3, D, W / 2 - 0.12, 0.45, 0, lm(0x5a3a5a)); break;
    case 'table': case 'desk': box(g, W, 0.06, D, 0, 0.72, 0, wood); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.06, 0.72, 0.06, a * (W / 2 - 0.08), 0, b * (D / 2 - 0.08), dark); if (id === 'desk') box(g, 0.5, 0.35, 0.35, W / 2 - 0.35, 0.78, -0.2, lm(0x2a2a2a)); break;
    case 'chair': box(g, 0.42, 0.05, 0.42, 0, 0.45, 0, wood); box(g, 0.42, 0.5, 0.05, 0, 0.5, -0.19, wood); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.04, 0.45, 0.04, a * 0.18, 0, b * 0.18, dark); break;
    case 'rug': { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#8e3a2f'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#e7c77a'; x.lineWidth = 6; x.strokeRect(10, 10, 108, 108); x.strokeStyle = '#2f4a6a'; x.lineWidth = 4; x.strokeRect(26, 26, 76, 76); x.fillStyle = '#e7c77a'; x.beginPath(); x.arc(64, 64, 16, 0, 7); x.fill(); const m = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: T.toTex(c, { repeat: false }) })); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.receiveShadow = true; g.add(m); break; }
    case 'bookcase': box(g, W, 1.9, D, 0, 0, 0, wood); for (let s = 0; s < 4; s++) for (let k = 0; k < 8; k++) box(g, 0.12, 0.3, 0.3, -W / 2 + 0.15 + k * 0.17, 0.15 + s * 0.45, 0.05, lm([0x8e2f2f, 0x2f4a7a, 0x3f7a4a, 0xc9a646, 0x5a3a5a][(s + k) % 5])); break;
    case 'wardrobe': box(g, W, 2.0, D, 0, 0, 0, lm(0x6a4a32)); box(g, 0.04, 1.8, 0.02, 0, 0.1, D / 2, dark); break;
    case 'plant': box(g, 0.35, 0.35, 0.35, 0, 0, 0, lm(0xb8643a)); { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), lm(0x4f8a3a)); f.position.y = 0.8; f.castShadow = true; g.add(f); } break;
    case 'lamp': box(g, 0.05, 1.5, 0.05, 0, 0, 0, dark); { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.3, 12), new THREE.MeshLambertMaterial({ color: 0xf2e3bd, emissive: 0xffd28a, emissiveIntensity: 0.8 })); s.position.y = 1.55; g.add(s); } break;
    case 'memshelf': box(g, W, 1.2, D, 0, 0, 0, wood); box(g, 0.25, 0.18, 0.2, -0.45, 1.2, 0, lm(0x7a5a3a)); { const pf = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.02), new THREE.MeshLambertMaterial({ color: 0xf8f4ea })); pf.position.set(0.05, 1.33, 0); g.add(pf); } box(g, 0.12, 0.25, 0.12, 0.45, 1.2, 0, lm(0xd9a03a)); break;
    case 'turntable': box(g, 0.9, 0.12, 0.45, 0, 0, 0, lm(0x2a2a2a)); { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), lm(0x111111)); d.position.set(-0.15, 0.13, 0); g.add(d); g.userData.disc = d; } break;
    case 'tablelamp': box(g, 0.12, 0.3, 0.12, 0, 0, 0, dark); { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 10), new THREE.MeshLambertMaterial({ color: 0xf2e3bd, emissive: 0xffd28a, emissiveIntensity: 0.8 })); s.position.y = 0.38; g.add(s); } break;
    case 'vase': box(g, 0.14, 0.25, 0.14, 0, 0, 0, lm(0x3d6a8a)); { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), lm(0xe89ab0)); f.position.y = 0.36; g.add(f); } break;
    case 'painting': { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#f0a46a'); gr.addColorStop(1, '#5a4a7a'); x.fillStyle = gr; x.fillRect(0, 0, 128, 64); x.fillStyle = '#2a2a3a'; x.fillRect(0, 44, 128, 20); x.fillStyle = '#fff3c0'; x.beginPath(); x.arc(84, 38, 9, 0, 7); x.fill(); box(g, W, 0.8, 0.05, 0, 1.3, 0, lm(0x3a2a1a)); const m = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, 0.68), new THREE.MeshLambertMaterial({ map: T.toTex(c, { repeat: false }) })); m.position.set(0, 1.7, 0.03); g.add(m); break; }
    case 'clock': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), lm(0xf2efe6)); m.rotation.x = Math.PI / 2; m.position.set(0, 1.9, 0.03); g.add(m); box(g, 0.02, 0.15, 0.01, 0, 1.88, 0.06, dark); break; }
    case 'curtain': box(g, W, 1.9, 0.06, 0, 0.5, 0, lm(0xa8bfc9)); box(g, W + 0.2, 0.05, 0.08, 0, 2.4, 0, dark); break;
  }
  return g;
}

export class HomeSystem {
  constructor(game) {
    this.game = game; this.owned = { boston_dorm: true }; this.furniture = {}; this.active = null;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x1a1816);
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 100);
    const hemi = new THREE.HemisphereLight(0xfff2dc, 0x4a3a30, 1.3); this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffe6c0, 1.6); this.sun.position.set(-4, 9, 6); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); const sc = this.sun.shadow.camera; sc.left = sc.bottom = -9; sc.right = sc.top = 9; this.scene.add(this.sun);
    this.warm = new THREE.PointLight(0xffc888, 6, 14, 1.5); this.warm.position.set(0, 2.4, 0); this.scene.add(this.warm);
    this.room = new THREE.Group(); this.scene.add(this.room); this.items = new THREE.Group(); this.scene.add(this.items);
    this.design = false; this.held = null; this.rot = 0; this.ray = new THREE.Raycaster(); this.v2 = new THREE.Vector2(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this.hit = new THREE.Vector3();
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); });
    addEventListener('keydown', (e) => this.key(e)); game.renderer.domElement.addEventListener('mousedown', (e) => { if (this.active && this.design && e.button === 0) this.click(); });
  }
  load(d) { if (!d) return; this.owned = { boston_dorm: true, ...(d.owned || {}) }; this.furniture = d.furniture || {}; }
  dump() { return { owned: this.owned, furniture: this.furniture }; }
  // dış dünya etkileşim noktaları
  register() {
    const g = this.game;
    for (const [id, P] of Object.entries(PROPS)) g.staticInteracts.push({ world: 'boston', r: 3.2, cond: () => g.story.chapter >= 3, pos: () => g.world.L[P.loc], label: () => this.owned[id] ? `[E] ${P.name} — içeri gir` : `[E] ${P.name} — satın al ($${P.price.toLocaleString('tr-TR')})`, fn: () => this.door(id) });
  }
  async door(id) {
    const g = this.game, P = PROPS[id];
    if (!this.owned[id]) {
      const c = await g.ui.choice(`${P.name} — $${P.price.toLocaleString('tr-TR')}<br><small>Bakiye: $${g.money.toLocaleString('tr-TR')}</small>`, ['Satın al', 'Vazgeç']);
      if (c !== 0) return; if (g.money < P.price) { g.ui.toast('Yeterli paran yok. Meslekleri dene: barmenlik, taksi, dövüş kulübü…', 'bad'); return; }
      g.money -= P.price; this.owned[id] = true; g.audio.pickup(); g.ui.toast(`🏠 ${P.name} artık senin!`, 'good'); g.save({});
    }
    this.enter(id);
  }
  buildRoom(id) {
    const P = PROPS[id]; this.room.clear(); const W = P.w, D = P.d; this.W = W; this.D = D;
    const floorC = document.createElement('canvas'); floorC.width = floorC.height = 256; const x = floorC.getContext('2d'); const r = T.rng(5);
    for (let i = 0; i < 8; i++) { x.fillStyle = `rgb(${150 + r() * 30},${100 + r() * 20},${60 + r() * 15})`; x.fillRect(0, i * 32, 256, 31); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i * 32 + 31, 256, 1); x.fillRect((r() * 256) | 0, i * 32, 1, 32); }
    const ft = T.toTex(floorC); ft.repeat.set(W / 2, D / 2);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: ft })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; this.room.add(fl);
    const wallM = new THREE.MeshLambertMaterial({ map: T.sidingTex(id === 'boston_harbor_loft' ? '#b9b0a4' : '#e6dccb', 1, false) });
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 2.8, 0.15), wallM); back.position.set(0, 1.4, -D / 2 - 0.075); back.receiveShadow = true; this.room.add(back);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.8, D), wallM); left.position.set(-W / 2 - 0.075, 1.4, 0); this.room.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, D), wallM); right.position.set(W / 2 + 0.075, 0.2, 0); this.room.add(right);
    const front = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.4, 0.15), wallM); front.position.set(0, 0.2, D / 2 + 0.075); this.room.add(front);
    // pencere (arka duvar)
    const win = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2.4, W * 0.4), 1.3), new THREE.MeshBasicMaterial({ color: this.game.env.night ? 0x1d2a48 : 0x9fc4dc })); win.position.set(W * 0.18, 1.6, -D / 2 + 0.01); this.room.add(win);
    // kapı (ön duvar, sağ)
    this.doorCell = { gx: Math.floor((W / 2 - 1.2) / G), gz: Math.floor(D / G) - 1 };
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.05), new THREE.MeshBasicMaterial({ color: 0x7bd389 })); door.rotation.x = -Math.PI / 2; door.position.set(W / 2 - 1, 0.02, D / 2 - 0.25); this.room.add(door);
    // ızgara
    this.grid = new THREE.GridHelper(Math.max(W, D), Math.max(W, D) / G, 0xe7c77a, 0x6a5a4a); this.grid.position.y = 0.02; this.grid.material.transparent = true; this.grid.material.opacity = 0.35; this.grid.visible = false; this.room.add(this.grid);
    this.camera.position.set(0, Math.max(W, D) * 1.05 + 2, D * 0.95 + 2.5); this.camera.lookAt(0, 0, 0.3);
  }
  cellsOf(f) { const C = CATALOG[f.id]; const w = f.rot % 2 ? C.d : C.w, d = f.rot % 2 ? C.w : C.d; return { w, d }; }
  occupied(layer, ignore) {
    const occ = new Set(); for (const f of this.furniture[this.active] || []) { if (f === ignore || CATALOG[f.id].layer !== layer) continue; const { w, d } = this.cellsOf(f); for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) occ.add((f.gx + i) + ',' + (f.gz + j)); } return occ;
  }
  surfaceCells(ignore) { const s = new Set(); for (const f of this.furniture[this.active] || []) { if (f === ignore || !CATALOG[f.id].surface) continue; const { w, d } = this.cellsOf(f); for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) s.add((f.gx + i) + ',' + (f.gz + j)); } return s; }
  valid(f) {
    const C = CATALOG[f.id], { w, d } = this.cellsOf(f), NX = Math.round(this.W / G), NZ = Math.round(this.D / G);
    if (f.gx < 0 || f.gz < 0 || f.gx + w > NX || f.gz + d > NZ) return false;
    if (C.layer === 'wall' && !(f.gz === 0 && f.rot % 2 === 0) && !(f.gx === 0 && f.rot % 2 === 1)) return false;
    const occ = this.occupied(C.layer, f); const surf = C.layer === 'surface' ? this.surfaceCells(f) : null;
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      const k = (f.gx + i) + ',' + (f.gz + j); if (occ.has(k)) return false;
      if (surf && !surf.has(k)) return false;
      if ((C.layer === 'floor') && Math.abs(f.gx + i - this.doorCell.gx) <= 1 && f.gz + j >= this.doorCell.gz - 1) return false; // kapı önü 2 kare
    }
    return true;
  }
  placeMesh(f) {
    const C = CATALOG[f.id], { w, d } = this.cellsOf(f); const m = makeFurniture(f.id); m.rotation.y = -f.rot * Math.PI / 2;
    const x = -this.W / 2 + (f.gx + w / 2) * G, z = -this.D / 2 + (f.gz + d / 2) * G; let y = C.layer === 'surface' ? 0.78 : 0;
    if (C.layer === 'wall') { if (f.rot % 2) { m.position.set(-this.W / 2 + 0.02, 0, z); m.rotation.y = Math.PI / 2; } else m.position.set(x, 0, -this.D / 2 + 0.02); } else m.position.set(x, y, z);
    m.userData.f = f; return m;
  }
  rebuildItems() { this.items.clear(); for (const f of this.furniture[this.active] || []) this.items.add(this.placeMesh(f)); }
  enter(id) {
    const g = this.game; if (g.playerCar) g.exitVehicle();
    this.active = id; this.furniture[id] = this.furniture[id] || []; this.buildRoom(id); this.rebuildItems();
    if (!this.jack) { this.jack = new Ped({ scene: this.scene }, { isPlayer: false, look: g.player.look }); this.jack.root.scale.setScalar(1); }
    this.jack.x = this.W / 2 - 1; this.jack.z = this.D / 2 - 0.7; this.jack.a = Math.PI;
    g.interiorMode = this; g.cutscene = false; g.audio.style = PROPS[id].track; g.audio.setEngine(false, 0, 0); g.audio.setSkid(0);
    this.hud(true); g.ui.toast(`${PROPS[id].name} — <b>B</b> dizayn modu · <b>E</b> etkileşim · kapıdan çık`, '');
  }
  exit() { const g = this.game; this.design = false; this.dropHeld(); this.active = null; g.interiorMode = null; this.hud(false); g.clock.getDelta(); g.save({}); this.onExit?.(); }
  hud(on) {
    let el = document.getElementById('homehud'); if (!el) { el = document.createElement('div'); el.id = 'homehud'; document.getElementById('ui').appendChild(el); }
    el.style.display = on ? 'block' : 'none'; if (!on) return;
    const g = this.game;
    if (!this.design) { el.innerHTML = `<div class="hh-top">${PROPS[this.active].name} · $${g.money.toLocaleString('tr-TR')}</div><div class="hh-tip">WASD yürü · E etkileşim · B dizayn modu · kapı (yeşil) — çık</div><div class="hh-prompt" id="hhp"></div>`; return; }
    el.innerHTML = `<div class="hh-top">DİZAYN MODU · $${g.money.toLocaleString('tr-TR')}</div><div class="hh-cat">${Object.entries(CATALOG).map(([k, c]) => `<button data-k="${k}">${c.n}<small>$${c.p} · ${c.layer === 'wall' ? 'duvar' : c.layer === 'surface' ? 'yüzey' : c.layer === 'rug' ? 'zemin' : 'zemin'}</small></button>`).join('')}</div><div class="hh-tip">Tık: yerleştir/al · R: 90° döndür · X: sat (%50) · B: çık<br>Duvar eşyaları arka/sol duvara, yüzey eşyaları masa üstüne. Kapı önü kapatılamaz.</div>`;
    el.querySelectorAll('.hh-cat button').forEach(b => b.onclick = (e) => { e.stopPropagation(); const k = b.dataset.k; const C = CATALOG[k]; if (g.money < C.p) { g.ui.toast('Yeterli paran yok', 'bad'); return; } this.dropHeld(); this.held = { f: { id: k, gx: 0, gz: 0, rot: 0 }, isNew: true }; this.held.mesh = this.placeMesh(this.held.f); this.scene.add(this.held.mesh); });
  }
  dropHeld() { if (!this.held) return; this.scene.remove(this.held.mesh); if (!this.held.isNew) { (this.furniture[this.active]).push(this.held.f); this.rebuildItems(); } this.held = null; }
  key(e) {
    if (!this.active) return; const k = e.key.toLowerCase();
    if (k === 'b') { this.design = !this.design; this.grid.visible = this.design; if (!this.design) this.dropHeld(); this.hud(true); }
    if (this.design && k === 'r' && this.held) { this.held.f.rot = (this.held.f.rot + 1) % 4; this.refreshHeld(); }
    if (this.design && k === 'x' && this.held && !this.held.isNew) { this.game.money += Math.round(CATALOG[this.held.f.id].p / 2); this.scene.remove(this.held.mesh); this.held = null; this.hud(true); this.game.audio.pickup(); }
    if (!this.design && k === 'e') this.act();
  }
  refreshHeld() { const h = this.held; this.scene.remove(h.mesh); h.mesh = this.placeMesh(h.f); h.ok = this.valid(h.f); h.mesh.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.7; if (!h.ok) o.material.color?.set(0xe2574c); } }); this.scene.add(h.mesh); }
  click() {
    const g = this.game;
    if (this.held) {
      if (!this.valid(this.held.f)) { g.ui.toast('Buraya konmaz (çakışma / kapı önü / katman)', 'bad'); return; }
      if (this.held.isNew) { g.money -= CATALOG[this.held.f.id].p; g.audio.pickup(); }
      this.scene.remove(this.held.mesh); this.furniture[this.active].push(this.held.f); this.held = null; this.rebuildItems(); this.hud(true); return;
    }
    // mevcut eşyayı al
    this.ray.setFromCamera(this.v2.set(g.input.mouse.nx, g.input.mouse.ny), this.camera); const hits = this.ray.intersectObjects(this.items.children, true);
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.f) o = o.parent; if (o) { const f = o.userData.f; this.furniture[this.active] = this.furniture[this.active].filter(q => q !== f); this.rebuildItems(); this.held = { f, isNew: false }; this.refreshHeld(); } }
  }
  near(act) { const j = this.jack; let best = null, bd = 1.6; for (const f of this.furniture[this.active] || []) { if (CATALOG[f.id].act !== act && act) continue; if (!CATALOG[f.id].act) continue; const { w, d } = this.cellsOf(f); const x = -this.W / 2 + (f.gx + w / 2) * G, z = -this.D / 2 + (f.gz + d / 2) * G; const dd = Math.hypot(x - j.x, z - j.z) - Math.max(w, d) * G / 2; if (dd < bd) { bd = dd; best = f; } } return best; }
  async act() {
    const g = this.game, j = this.jack;
    if (Math.hypot(j.x - (this.W / 2 - 1), j.z - (this.D / 2 - 0.3)) < 1) { this.exit(); return; }
    const f = this.near(); if (!f) return; const a = CATALOG[f.id].act;
    if (a === 'music') { const tr = ['sunset_lofi', 'rainy_jazz', 'acoustic_evening']; const i = (tr.indexOf(g.audio.style) + 1) % 3; g.audio.style = tr[i]; g.audio.musicOn = true; g.ui.toast('♪ Pikap: ' + ['Gün Batımı Lo-fi', 'Yağmurlu Caz', 'Akustik Akşam'][i]); }
    if (a === 'bed') { await g.ui.fade(2, 'Uyuyorsun…<br><small>Oyun kaydedildi.</small>'); g.setTime(g.time + 8); g.player.hp = 100; g.save({}); }
    if (a === 'wardrobe') { const cols = ['#3a4a78', '#5a2f2f', '#2f5a4a', '#2a2a2e', '#7a6a50']; const c = cols[(cols.indexOf(g.player.look.shirt) + 1) % cols.length] || cols[0]; g.player.look.shirt = c; g.player.mats.shirt.map = T.clothTex(c, 'jacket'); g.player.mats.shirt.needsUpdate = true; this.jack.mats.shirt.map = g.player.mats.shirt.map; this.jack.mats.shirt.needsUpdate = true; g.ui.toast('Kıyafet değişti.'); }
    if (a === 'memories') { const items = ['📸 Simena\'nın Polaroid\'i' + (g.story.simenaPhotoInBox ? ' (anı kutusunda)' : ''), g.story.choices.oakridgeNightRace === 'accepted' ? '🏁 Oakridge gece yarışı davetiyesi' : '🌅 Fenerden bir deniz kabuğu', ...(g.story.memories || [])]; await g.ui.letter('<h3>Anı Rafı</h3>' + items.map(s => '· ' + s).join('<br>')); }
  }
  update(dt) {
    const g = this.game, I = g.input; if (!this.active) return;
    if (this.design) {
      if (this.held) { this.ray.setFromCamera(this.v2.set(I.mouse.nx, I.mouse.ny), this.camera); if (this.ray.ray.intersectPlane(this.plane, this.hit)) { const { w, d } = this.cellsOf(this.held.f); const gx = Math.round((this.hit.x + this.W / 2) / G - w / 2), gz = Math.round((this.hit.z + this.D / 2) / G - d / 2); if (gx !== this.held.f.gx || gz !== this.held.f.gz || !this.held.mesh.parent) { this.held.f.gx = gx; this.held.f.gz = gz; this.refreshHeld(); } } }
    } else {
      const j = this.jack; const mx = (I.down('d', 'arrowright') ? 1 : 0) - (I.down('a', 'arrowleft') ? 1 : 0), mz = (I.down('s', 'arrowdown') ? 1 : 0) - (I.down('w', 'arrowup') ? 1 : 0);
      j.move(mx, mz, 2.4, dt);
      const nx = j.x + j.vx * dt, nz = j.z + j.vz * dt; const gx = Math.floor((nx + this.W / 2) / G), gz = Math.floor((nz + this.D / 2) / G);
      const occ = this.occupied('floor'); const inside = Math.abs(nx) < this.W / 2 - 0.25 && Math.abs(nz) < this.D / 2 - 0.2;
      if (inside && !occ.has(gx + ',' + gz)) { j.x = nx; j.z = nz; }
      j.updateAnim(dt); j.sync(); j.speed = Math.hypot(mx, mz) ? 2.4 : 0;
      const f = this.near(); const atDoor = Math.hypot(j.x - (this.W / 2 - 1), j.z - (this.D / 2 - 0.3)) < 1;
      const hp = document.getElementById('hhp'); if (hp) hp.textContent = atDoor ? '[E] Dışarı çık' : f ? `[E] ${{ music: 'Pikabı değiştir', bed: 'Uyu (kaydet, saat +8)', wardrobe: 'Kıyafet değiştir', memories: 'Anılara bak' }[CATALOG[f.id].act]}` : '';
      for (const it of this.items.children) if (it.userData.disc) it.userData.disc.rotation.y += dt * 3;
    }
    I.endFrame && 0;
  }
}
