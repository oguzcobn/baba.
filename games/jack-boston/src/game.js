// JACK: BOSTON'A GİDEN YOL — Oyun çekirdeği
import * as THREE from 'three';
import { setAniso, foliageTex, snowTex, grassTex } from './engine/textures.js';
import { FX } from './engine/fx.js';
import { Post } from './engine/post.js';
import { Audio } from './engine/audio.js';
import { Input } from './engine/input.js';
import { Combat, WEAPONS, WEAPON_KEYS } from './engine/combat.js';
import { buildOakridge, VX, HZ, heightAt } from './world/oakridge.js';
import { nightMats, lampMats, M } from './world/materials.js';
import { Population, CHATTER, angDiff } from './world/population.js';
import { Vehicle } from './entities/vehicle.js';
import { Ped } from './entities/ped.js';
import { Police } from './entities/police.js';
import { obbVsObb, circleVsObb, circleVsCircle, axes } from './physics/collide.js';

// Saat anahtar kareleri (huzurlu, sanatsal palet)
const SKY = [
  { h: 0, sun: '#7d90c4', si: 0.55, el: 40, sky: '#6f80b8', gnd: '#3a3c48', hi: 1.55, fog: '#1d2640', lamp: 1 },
  { h: 5.5, sun: '#8a8fb8', si: 0.5, el: 8, sky: '#7a84a8', gnd: '#3a3c42', hi: 1.3, fog: '#3d4460', lamp: 1 },
  { h: 7, sun: '#ffc89a', si: 1.6, el: 14, sky: '#c9b8c8', gnd: '#5a5048', hi: 0.8, fog: '#d9c2b6', lamp: 0.2 },
  { h: 10, sun: '#fff1dc', si: 2.4, el: 50, sky: '#bcd6ea', gnd: '#6a6a5a', hi: 1.0, fog: '#cfe0ea', lamp: 0 },
  { h: 15, sun: '#fff0d6', si: 2.3, el: 45, sky: '#bcd4e6', gnd: '#6a6a5a', hi: 1.0, fog: '#d3e0e8', lamp: 0 },
  { h: 17.5, sun: '#ffbf7a', si: 2.1, el: 20, sky: '#f0c9a6', gnd: '#6a5040', hi: 0.85, fog: '#f2c9a4', lamp: 0.1 },
  { h: 19, sun: '#ff8f5a', si: 1.4, el: 7, sky: '#d48a7e', gnd: '#4a3a40', hi: 0.7, fog: '#c88a80', lamp: 0.6 },
  { h: 20.5, sun: '#8a8ac0', si: 0.6, el: 30, sky: '#7080b8', gnd: '#3a3a46', hi: 1.5, fog: '#2d3150', lamp: 1 },
  { h: 24, sun: '#7d90c4', si: 0.55, el: 40, sky: '#6f80b8', gnd: '#3a3c48', hi: 1.55, fog: '#1d2640', lamp: 1 },
];
const C = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

export class Game {
  constructor(container, ui) {
    this.container = container; this.ui = ui; ui.game = this;
    this.WEAPONS = WEAPONS;
    const R = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(devicePixelRatio, 1.75)); R.setSize(innerWidth, innerHeight);
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    container.appendChild(R.domElement); setAniso(R.capabilities.getMaxAnisotropy());
    try { this.post = new Post(R); this.post.resize(); } catch (e) { console.warn('post kapalı', e); this.post = null; }
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 2, 700);
    this.camT = new THREE.Vector3(); this.camDist = 40; this.pitch = THREE.MathUtils.degToRad(57); this.shakeA = 0; this.recoil = 0;
    // ışıklar
    this.hemi = new THREE.HemisphereLight(0xbcd6ea, 0x6a6a5a, 1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 300;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xcfe0ea, 140, 420);
    // oyuncu farı (spot) — gece
    this.headSpot = new THREE.SpotLight(0xfff0d0, 0, 45, 0.55, 0.6, 1.2); this.scene.add(this.headSpot, this.headSpot.target);
    this.fireLight = new THREE.PointLight(0xff9a48, 0, 26, 1.4); this.scene.add(this.fireLight); this.bonfire = null;
    this.season = 'summer'; this.snow = false;
    this.fx = new FX(this.scene); this.audio = new Audio(); this.input = new Input(R.domElement);
    this.fx.onShellTink = (x, z) => this.audio.tink(x, z);
    this.combat = new Combat(this);
    this.world = buildOakridge(this.scene);
    this.vehicles = []; this.peds = []; this.tokens = new Set(); this.markers = [];
    this.pop = new Population(this); this.police = new Police(this);
    this.time = 17.2; this.timeScale = 0; this.rain = 0; this.rainTarget = 0; this.wind = [0.8, 0.4];
    this.hitstop = 0; this.paused = true; this.mode = null; this.money = 150; this.godMode = false;
    this.owned = { fists: true }; this.ammo = { pistol9mm: 0, silenced9mm: 0, shotgun: 0 };
    this.env = {
      fx: this.fx, audio: this.audio, heightAt, wet: false, night: false, wind: this.wind,
      surfaceAt: (x, z) => this.surfaceAt(x, z), meleeHit: (a) => this.combat.meleeHit(a), shake: (s) => this.shake(s),
      onCarBroken: (v) => { if (v === this.playerCar) this.ui.toast('Motor bozuldu! Araç yanıyor — hemen in! [F]', 'bad'); if (v.isPolice) this.police.takedown(v); },
      onExplosion: (x, z, src) => this.explosionDamage(x, z, src),
    };
    this.initRain();
    // oyuncu
    this.player = new Ped(this, { x: 0, z: 0, isPlayer: true, role: 'player', name: 'Jack', look: { skin: '#f1c9a5', hair: '#2a1d14', shirt: '#3a4a78', pants: '#3a4a66', shirtKind: 'jacket', beard: false } });
    this.player.persistent = true; this.playerCar = null; this.lastCar = null;
    // parkta duran araçlar
    for (const s of this.world.parkSpots) { const v = this.addVehicle({ x: s.x, z: s.z, a: s.a, kind: Math.random() < 0.3 ? 'hatch' : Math.random() < 0.15 ? 'pickup' : 'sedan', parked: true }); v.persistent = true; }
    // görev işaretleri malzemesi
    this.markerGeo = new THREE.CylinderGeometry(2.6, 2.6, 6, 28, 1, true);
    addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock(); this.raycaster = new THREE.Raycaster(); this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
    this.aim = new THREE.Vector3(); this._v = new THREE.Vector3();
    this.setTime(this.time); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); this.post?.resize(); }
  // ------------------------------------------------ yardımcılar
  addVehicle(o) { const v = new Vehicle(this, o); this.vehicles.push(v); return v; }
  removeVehicle(v) { const i = this.vehicles.indexOf(v); if (i >= 0) this.vehicles.splice(i, 1); v.dispose(); if (v.driver && v.driver.vehicle === v) this.removePed(v.driver); for (const p of v.passengers) if (!p.persistent) this.removePed(p); }
  removePed(p) { const i = this.peds.indexOf(p); if (i >= 0) this.peds.splice(i, 1); p.dispose(); this.tokens.delete(p); }
  playerPos() { return this.playerCar ? { x: this.playerCar.x, z: this.playerCar.z } : { x: this.player.x, z: this.player.z }; }
  shake(s) { this.shakeA = Math.min(1.6, this.shakeA + s); }
  onRoad(x, z) {
    for (const zr of HZ) { const x0 = zr === 240 ? -347 : -307, x1 = -x0; if (Math.abs(z - zr) < 7 && x > x0 && x < x1) return true; }
    for (const xr of VX) if (Math.abs(x - xr) < 7 && z > -307 && z < 247) return true;
    return false;
  }
  surfaceAt(x, z) {
    if (this.onRoad(x, z)) return 'road';
    if (z > 251 && !(x > 335 && z < 266)) return 'sand';
    if (Math.abs(x) > 311 || z < -311) return 'grass';
    const i = Math.floor((x + 300) / 150), j = z < -150 ? 0 : z < 0 ? 1 : z < 150 ? 2 : 3;
    const grassy = { '0,0': 1, '2,0': 1, '3,0': 1, '0,1': 1, '0,2': 1, '0,3': 1 };
    for (const xr of VX) if (Math.abs(x - xr) < 11) return 'conc';
    for (const zr of HZ) if (Math.abs(z - zr) < 11) return 'conc';
    return grassy[i + ',' + j] ? 'grass' : 'conc';
  }
  // ------------------------------------------------ zaman & hava
  setTime(h) {
    this.time = ((h % 24) + 24) % 24; let a = SKY[0], b = SKY[1];
    for (let i = 0; i < SKY.length - 1; i++) if (this.time >= SKY[i].h && this.time <= SKY[i + 1].h) { a = SKY[i]; b = SKY[i + 1]; break; }
    const t = (this.time - a.h) / (b.h - a.h || 1); const L = (k) => a[k] + (b[k] - a[k]) * t;
    const rainDim = 1 - this.rain * 0.35;
    this.sun.color.copy(C(a.sun, b.sun, t)); this.sun.intensity = L('si') * rainDim;
    this.hemi.color.copy(C(a.sky, b.sky, t)); this.hemi.groundColor.copy(C(a.gnd, b.gnd, t)); this.hemi.intensity = L('hi') * (1 - this.rain * 0.15);
    const fog = C(a.fog, b.fog, t).lerp(new THREE.Color('#5a6270'), this.rain * 0.35); this.scene.fog.color.copy(fog); this.scene.background = fog;
    this.scene.fog.near = 140 - this.rain * 50; this.scene.fog.far = 420 - this.rain * 140;
    this.sunEl = THREE.MathUtils.degToRad(L('el')); this.sunAz = THREE.MathUtils.degToRad(this.time < 12 ? 120 : 235);
    const lamp = Math.min(1, L('lamp') + this.rain * 0.4);
    this.lampLevel = lamp; this.env.night = lamp > 0.5; this.renderer.toneMappingExposure = 1.05 + lamp * 0.3; if (this.post) this.post.mat.uniforms.warm.value = Math.max(0, 1 - lamp) * (this.time > 16 ? 1 : 0.4);
    for (const m of nightMats) m.emissiveIntensity = lamp * 0.95;
    for (const m of lampMats) m.emissiveIntensity = lamp * 2.2;
    M.lightPool.opacity = lamp * 0.55;
    const lh = this.world.lighthouse.userData; lh.beam.material.opacity = lamp * 0.35; lh.lampRoom.material.emissiveIntensity = 0.3 + lamp * 1.5;
  }
  setSeason(sn) {
    this.season = sn; this.snow = sn === 'winter';
    if (!this._folMaps) this._folMaps = M.foliage.map(m => m.map);
    const fol = { autumn: ['#c8742e', '#d9a040', '#b5582a', '#e0b050'], winter: ['#dbe4e8', '#e6eef2', '#cfdade', '#e2eaee'], spring: ['#e8a8c0', '#6d9a48', '#f0b8cc', '#7aa850'] }[sn];
    M.foliage.forEach((m, i) => { m.map = fol ? foliageTex(fol[i]) : this._folMaps[i]; m.needsUpdate = true; });
    M.grass.map = sn === 'winter' ? snowTex() : grassTex(); M.grass.color.set(sn === 'autumn' ? '#e6d49a' : '#ffffff'); M.grass.needsUpdate = true;
    M.hedge.color.set(sn === 'winter' ? '#d8e2e6' : sn === 'autumn' ? '#c89050' : '#ffffff');
    this.rainLines.material.color.set(this.snow ? 0xffffff : 0xb8c8d8); this.rainLines.material.opacity = this.snow ? 0.9 : 0.45;
  }
  setBonfire(x, z) {
    if (this.bonfire) { this.scene.remove(this.bonfire.mesh); this.bonfire = null; this.fireLight.intensity = 0; }
    if (x === undefined) return;
    const g = new THREE.Group(); const logM = new THREE.MeshLambertMaterial({ color: 0x5a3a22 }), stoneM = new THREE.MeshLambertMaterial({ color: 0x8a8478 });
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 6), logM); l.rotation.z = Math.PI / 2 - 0.35; l.rotation.y = i * Math.PI / 4; l.position.y = 0.25; g.add(l); }
    for (let i = 0; i < 10; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2), stoneM); st.position.set(Math.cos(i / 10 * 6.28) * 0.75, 0.1, Math.sin(i / 10 * 6.28) * 0.75); g.add(st); }
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2), new THREE.MeshLambertMaterial({ color: 0xc9a27a })); blanket.rotation.x = -Math.PI / 2; blanket.position.set(2.4, 0.04, 0.6); g.add(blanket);
    g.position.set(x, 0, z); this.scene.add(g); this.bonfire = { x, z, mesh: g };
  }
  setRain(v, instant = false) { this.rainTarget = v; if (instant) this.rain = v; }
  initRain() {
    const N = 1800; const g = new THREE.BufferGeometry(); this.rainPos = new Float32Array(N * 6); this.rainN = N; this.drops = [];
    for (let i = 0; i < N; i++) this.drops.push({ x: (Math.random() - .5) * 120, y: Math.random() * 50, z: (Math.random() - .5) * 120, s: 38 + Math.random() * 12 });
    g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage)); this.rainGeo = g;
    this.rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0.45, depthWrite: false })); this.rainLines.frustumCulled = false; this.scene.add(this.rainLines);
  }
  updateRain(dt) {
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.5); const on = this.rain > 0.05; this.rainLines.visible = on; this.env.wet = this.rain > 0.3;
    this.audio.setRain(this.rain > 0.3 && !this.snow ? this.rain : this.snow ? 0.1 : 0);
    if (!on) return; const cx = this.camT.x, cz = this.camT.z; const n = Math.floor(this.rainN * this.rain);
    for (let i = 0; i < n; i++) {
      const d = this.drops[i]; const sm = this.snow ? 0.07 : 1; d.y -= d.s * dt * sm; d.x += this.wind[0] * (this.snow ? 1.5 + Math.sin(d.s + d.y * 0.3) * 2 : 4) * dt; d.z += this.wind[1] * 4 * dt * sm;
      let wx = cx + ((d.x - cx + 60) % 120 + 120) % 120 - 60, wz = cz + ((d.z - cz + 60) % 120 + 120) % 120 - 60;
      if (d.y < 0) { d.y = 40 + Math.random() * 10; d.x = wx; d.z = wz; if (!this.snow && Math.random() < 0.25 && Math.abs(wx - cx) < 40 && Math.abs(wz - cz) < 30) this.fx.glow.emit({ x: wx, y: 0.1, z: wz, vy: 1, life: 0.15, s0: 0.25, s1: 0.05, c0: [0.6, 0.65, 0.7], a0: 0.5, a1: 0 }); }
      const o = i * 6; this.rainPos[o] = wx; this.rainPos[o + 1] = d.y; this.rainPos[o + 2] = wz; const ln = this.snow ? 0.12 : 1.1; this.rainPos[o + 3] = wx - this.wind[0] * 0.2 * (this.snow ? 0.1 : 1); this.rainPos[o + 4] = d.y + ln; this.rainPos[o + 5] = wz - this.wind[1] * 0.2 * (this.snow ? 0.1 : 1);
    }
    this.rainGeo.setDrawRange(0, n * 2); this.rainGeo.attributes.position.needsUpdate = true;
  }
  // ------------------------------------------------ görev işaretleri
  addMarker(x, z, color = 0xffd36a, label) {
    const mat = new THREE.MeshBasicMaterial({ map: (this._mt ||= (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 64); const t = new THREE.CanvasTexture(c); return t; })()), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.markerGeo, mat); m.position.set(x, heightAt(x, z) + 3, z); this.scene.add(m);
    const mk = { x, z, color, mesh: m, label }; this.markers.push(mk); return mk;
  }
  removeMarker(mk) { if (!mk) return; this.scene.remove(mk.mesh); this.markers = this.markers.filter(m => m !== mk); }
  clearMarkers() { for (const m of this.markers) this.scene.remove(m.mesh); this.markers = []; }
  // ------------------------------------------------ oyuncu
  enterVehicle(v, asPassengerOK = false) {
    const p = this.player;
    if (v.driver && !v.driver.isPlayer) {
      // araba çalma — sürücüyü indir
      const d = this.pop.ejectDriver(v, true); if (d) { d.knock(Math.cos(v.a) * 3, -Math.sin(v.a) * 3, 2); d.say('Arabam!', 2); }
      this.police.crime('carjack', v.x, v.z); if (v.isPolice) this.police.crime('hitCop', v.x, v.z);
    }
    v.ai = null; v.driver = p; p.vehicle = v; this.playerCar = v; this.lastCar = v; v.parked = false; this.audio.door();
    p.attackT = -1; this.tokens.clear();
  }
  exitVehicle() {
    const v = this.playerCar, p = this.player; if (!v) return;
    const { rx, rz } = axes(v.a); let ex = v.x + rx * (v.hx + 0.7), ez = v.z + rz * (v.hx + 0.7);
    // sol taraf kapalıysa sağdan in
    if (this.world.statics.query(ex, ez, 1).some(s => s.type === 'obb' ? Math.abs(ex - s.x) < s.hx + 0.4 && Math.abs(ez - s.z) < s.hz + 0.4 : Math.hypot(ex - s.x, ez - s.z) < s.r + 0.4)) { ex = v.x - rx * (v.hx + 0.7); ez = v.z - rz * (v.hx + 0.7); }
    p.vehicle = null; v.driver = null; this.playerCar = null; p.x = ex; p.z = ez; p.a = v.a; this.audio.door(); this.audio.setEngine(false, 0, 0); this.audio.setSkid(0);
    if (v.speed > 7) { p.knock(v.vx * 0.6, v.vz * 0.6, 3); p.hp -= 8; }
    v.in.throttle = 0; v.in.brake = 0; v.in.steer = 0;
  }
  nearestVehicle(r = 3.6) {
    let best = null, bd = r; const p = this.player;
    for (const v of this.vehicles) { if (v.exploded) continue; const d = Math.hypot(v.x - p.x, v.z - p.z) - v.hx; if (d < bd) { bd = d; best = v; } }
    return best;
  }
  nearestPed(r = 3) {
    let best = null, bd = r; const p = this.player;
    for (const q of this.peds) { if (q.vehicle || q.dead || q.down || q.noTalk) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  updatePlayer(dt) {
    const I = this.input, p = this.player;
    if (this.cutscene) { if (this.playerCar) { const v = this.playerCar; v.in.throttle = 0; v.in.brake = 1; v.in.steer = 0; v.in.hand = false; } else p.move(0, 0, 0, dt); return; }
    if (p.dead) return;
    // silah seçimi
    for (let i = 0; i < 5; i++) if (I.hit(String(i + 1))) { const w = WEAPON_KEYS[i]; if (this.owned[w]) { p.setWeaponMesh(w); this.ui.toast(WEAPONS[w].icon + ' ' + WEAPONS[w].name); } }
    if (I.hit('tab') || I.mouse.wheelHit) { const ow = WEAPON_KEYS.filter(k => this.owned[k]); const i = ow.indexOf(p.weapon); p.setWeaponMesh(ow[(i + 1) % ow.length]); }
    if (this.playerCar) {
      const v = this.playerCar;
      v.in.throttle = I.down('w', 'arrowup') ? 1 : 0; v.in.brake = I.down('s', 'arrowdown') ? 1 : 0;
      v.in.steer = (I.down('d', 'arrowright') ? 1 : 0) - (I.down('a', 'arrowleft') ? 1 : 0); v.in.hand = I.down(' ');
      if (I.touch.active) { const t = I.touch; v.in.steer = Math.max(-1, Math.min(1, t.mx * 1.4)); v.in.throttle = t.mz < -0.25 ? 1 : 0; v.in.brake = t.mz > 0.35 ? 1 : 0; }
      if (I.hit('h')) { this.audio.horn(); for (const q of this.peds) if (!q.vehicle && q.role === 'civ' && Math.hypot(q.x - v.x, q.z - v.z) < 12 && q.state === 'walk') { q.say('Hey!', 1); } }
      if (I.hit('f') && !this.lockCar) this.exitVehicle();
      const fwd = v.fwdSpeed; const rpm = Math.min(1, Math.abs(fwd) / v.K.maxV) * 0.8 + (v.in.throttle ? 0.2 : 0);
      this.audio.setEngine(!v.broken, rpm, v.in.throttle); this.audio.setSkid(v.skidding ? 1 : 0);
      this.ui.setPrompt(v.broken ? '[F] Hemen in!' : '');
      return;
    }
    // yaya hareketi
    let mx = (I.down('d', 'arrowright') ? 1 : 0) - (I.down('a', 'arrowleft') ? 1 : 0), mz = (I.down('s', 'arrowdown') ? 1 : 0) - (I.down('w', 'arrowup') ? 1 : 0);
    if (this.input.touch.active) { mx = this.input.touch.mx; mz = this.input.touch.mz; }
    const sprint = I.down('shift'); const sp = p.stagger > 0 ? 1.5 : sprint ? 7.6 : 5.0;
    const W = WEAPONS[p.weapon]; const gun = !W.melee;
    // nişan
    this.raycaster.setFromCamera(new THREE.Vector2(I.mouse.nx, I.mouse.ny), this.camera); this.raycaster.ray.intersectPlane(this.groundPlane, this.aim);
    const aimA = Math.atan2(this.aim.x - p.x, this.aim.z - p.z);
    p.aiming = gun && (I.mouse.down || I.mouse.right);
    if (p.canAct) {
      p.move(mx, mz, sp, dt, !p.aiming);
      if (p.aiming) p.faceTo(aimA, dt, 20);
    }
    if (p.canAct && (I.mouse.clicked || I.hit('q') || (gun && I.mouse.down))) {
      if (W.melee) {
        // hedef kilidi
        let tgt = null, bd = 2.6; for (const q of this.peds) { if (q.vehicle || q.dead || q.down) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; tgt = q; } }
        if (tgt) p.a = Math.atan2(tgt.x - p.x, tgt.z - p.z); else if (I.mouse.clicked) p.a = aimA;
        if (p.startAttack()) this.audio.whoosh();
      } else if (this.combat.cool <= 0) {
        const k = W.ammoKey; if (this.ammo[k] > 0) { this.ammo[k]--; this.combat.cool = W.rate; this.combat.fire(p, this.aim.x - p.x, this.aim.z - p.z); }
        else if (I.mouse.clicked) { this.ui.toast('Mermi yok!'); this.audio.tone({ f0: 300, f1: 280, dur: 0.05, type: 'square', gain: 0.1 }); }
      }
    }
    // etkileşim
    const car = this.nearestVehicle(); const ped = this.nearestPed(2.8);
    let prompt = '';
    if (car && !this.lockCar) prompt = car.driver ? '[F] Arabayı çal' : car.exploded ? '' : '[F] Bin';
    if (ped && ped.role !== 'police' && ped.state !== 'fight') prompt += (prompt ? '   ' : '') + '[E] Konuş';
    if (this.interact && Math.hypot(this.interact.x - p.x, this.interact.z - p.z) < (this.interact.r || 2.5)) prompt = this.interact.label;
    this.ui.setPrompt(prompt);
    if (I.hit('e')) {
      if (this.interact && Math.hypot(this.interact.x - p.x, this.interact.z - p.z) < (this.interact.r || 2.5)) { const f = this.interact.fn; this.interact = null; f(); }
      else if (ped && ped.state !== 'fight') this.talkTo(ped);
    }
    if (I.hit('f') && car && !this.lockCar && !car.exploded) { if (!this.carFilter || this.carFilter(car)) this.enterVehicle(car); }
  }
  talkTo(q) {
    const p = this.player; q.state = 'talk'; q.stateT = 0; p.a = Math.atan2(q.x - p.x, q.z - p.z);
    const greet = ['Selam!', 'Merhaba, n\'aber?', 'İyi akşamlar!', 'Hey, nasıl gidiyor?'][(Math.random() * 4) | 0];
    p.say(greet, 2.2);
    if (q.onTalk) { q.onTalk(); return; }
    setTimeout(() => q.say(q.lines ? q.lines[(Math.random() * q.lines.length) | 0] : CHATTER[(Math.random() * CHATTER.length) | 0], 3.2), 700);
  }
  onPlayerDeath() {
    if (this.dying) return; this.dying = true; this.ui.toast('YARALANDIN', 'bad');
    setTimeout(() => { this.dying = false; if (this.mission && this.mission.active) this.mission.fail('Jack ağır yaralandı.'); else this.respawn('hospital'); }, 2200);
  }
  busted() {
    if (this.dying) return; this.dying = true; this.ui.banner('TUTUKLANDIN', '#4a7fd4');
    setTimeout(() => { this.dying = false; if (this.mission && this.mission.active) this.mission.fail('Polis Jack\'i yakaladı.'); else { this.money = Math.max(0, this.money - 50); this.respawn('police'); } }, 2200);
  }
  respawn(where) {
    const p = this.player; const L = this.world.L; const s = where === 'police' ? L.police : L.square;
    if (this.playerCar) this.exitVehicle();
    p.dead = false; p.down = false; p.fly = null; p.hp = 100; p.root.rotation.set(0, 0, 0); p.root.position.y = 0; p.x = s.x; p.z = s.z + (where === 'police' ? 0 : 12);
    this.police.clear(); this.ui.fade(0.6);
  }
  explosionDamage(x, z, src) {
    for (const q of [...this.peds, this.player]) { if (q.vehicle) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < 7) { const k = 1 - d / 7; this.combat.damagePed(q, null, 120 * k, (q.x - x) / (d || 1), (q.z - z) / (d || 1), 'blast'); if (!q.dead) q.knock((q.x - x) / (d || 1) * 10 * k, (q.z - z) / (d || 1) * 10 * k, 6 * k); } }
    for (const v of this.vehicles) { if (v === src) continue; const d = Math.hypot(v.x - x, v.z - z); if (d < 9) { const k = 1 - d / 9; v.vx += (v.x - x) / d * 8 * k; v.vz += (v.z - z) / d * 8 * k; v.applyDamage(40 * k, 'left', 0, 0, 10 * k, this.env); } }
    if (this.playerCar === src) { this.exitVehicle(); }
    if (src?.driver?.isPlayer === false && src.driver) { /* sürücü */ }
  }
  polaroidThought() {
    const L = this.world.L, p = this.playerPos(); const near = (k, r = 40) => L[k] && Math.hypot(p.x - L[k].x, p.z - L[k].z) < r;
    const ch = this.story?.chapter || 2; const night = this.env.night, rain = this.rain > 0.3;
    if (ch <= 2) {
      if (near('hilltop')) return 'Burada ona söyledim. Güneş batarken… sesim titriyordu ama o gülümsedi.';
      if (near('books')) return 'Kitapçının ışığı yanıyor. Belki şu an pencerede çiziyor.';
      if (near('lighthouse')) return 'Feneri ona da göstermeliyim. Bu sefer dilek tutmaya gerek yok.';
      if (p.z > 250) return 'Ateşin çıtırtısı hâlâ kulağımda. Bu fotoğraf o gecenin kokusunu taşıyor.';
      if (near('library')) return 'O pencerenin önünde bir yıl boyunca tek kelime edemedim.';
      if (rain) return 'Yağmur yağınca onun çizim defteri aklıma geliyor.';
      if (night) return 'Yarın Boston. Ama bu fotoğraf cebimde olduğu sürece burası hep yanımda.';
      return 'Simena ve ben. Oakridge, ağustos. Hiç bitmesin istediğim iki ay.';
    }
    if (rain) return 'Yağmur her şeyi ona benzetiyor. Neden hâlâ cebimde taşıyorum bunu?';
    if (night) return 'Şehrin ışıkları çok parlak. O sahildeki ateş kadar sıcak değil hiçbiri.';
    return 'Bir daha hiç konuşmadık. Ama gülüşü hâlâ burada, bu küçük karenin içinde.';
  }
  // ------------------------------------------------ fizik
  physics(dt) {
    const vs = this.vehicles, tmp = [];
    for (const v of vs) v.update(dt, this.env);
    // araç-araç
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const A = vs[i], B = vs[j]; const dx = B.x - A.x, dz = B.z - A.z; if (dx * dx + dz * dz > 49) continue;
      const c = obbVsObb(A.obb(), B.obb()); if (!c) continue; this.resolve(A, B, c);
    }
    // araç-statik
    for (const v of vs) {
      const o = v.obb(); this.world.statics.query(v.x, v.z, 4, tmp);
      for (const s of tmp) {
        let c;
        if (s.type === 'obb') c = obbVsObb(o, s); else c = circleVsObb(s.x, s.z, s.r, o);
        if (!c) continue;
        // normal A(araç)'tan B(statik)'e
        this.resolve(v, null, c); o.x = v.x; o.z = v.z; o.a = v.a;
      }
    }
    // yaya-araç, yaya-statik, yaya-yaya
    const all = this.peds.filter(p => !p.vehicle); if (!this.player.vehicle) all.push(this.player);
    for (const p of all) {
      if (p.fly) continue;
      for (const v of vs) {
        if (Math.abs(v.x - p.x) > 4 || Math.abs(v.z - p.z) > 4) continue;
        const c = circleVsObb(p.x, p.z, p.radius, v.obb()); if (!c) continue;
        // temas noktasındaki araç hızı
        const rxp = c.cx - v.x, rzp = c.cz - v.z; const pvx = v.vx + v.w * rzp, pvz = v.vz - v.w * rxp;
        const rel = pvx * c.nx + pvz * c.nz; const sp = Math.hypot(pvx, pvz);
        if (rel > 3.2 && !p.down && !p.dead) this.runOver(p, v, sp, c);
        else if (p.down && sp > 2) { p.x += c.nx * c.depth; p.z += c.nz * c.depth; if (sp > 4 && !p.dead) { this.combat.damagePed(p, v.driver?.isPlayer ? this.player : null, sp * 2 * this.fdt, c.nx, c.nz, 'car'); } }
        else { p.x += c.nx * c.depth; p.z += c.nz * c.depth; }
      }
      this.world.statics.query(p.x, p.z, 1.5, tmp);
      for (const s of tmp) {
        const c = s.type === 'obb' ? circleVsObb(p.x, p.z, p.radius, s) : circleVsCircle(s.x, s.z, s.r, p.x, p.z, p.radius);
        if (c) { p.x += c.nx * c.depth; p.z += c.nz * c.depth; }
      }
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j]; if (a.down || b.down || a.dead || b.dead) continue; const dx = b.x - a.x, dz = b.z - a.z; if (Math.abs(dx) > 0.8 || Math.abs(dz) > 0.8) continue;
      const c = circleVsCircle(a.x, a.z, a.radius, b.x, b.z, b.radius); if (c) { a.x -= c.nx * c.depth / 2; a.z -= c.nz * c.depth / 2; b.x += c.nx * c.depth / 2; b.z += c.nz * c.depth / 2; }
    }
  }
  runOver(p, v, sp, c) {
    const byPlayer = v.driver?.isPlayer;
    if (sp > 6.5) {
      const dmg = sp * 7; this.combat.damagePed(p, byPlayer ? this.player : v.driver, dmg, c.nx, c.nz, 'car');
      if (!p.fly) p.knock(v.vx * 1.05 + c.nx * 2, v.vz * 1.05 + c.nz * 2, 3 + sp * 0.35);
      this.fx.bloodBurst(p.x, 1, p.z, c.nx, c.nz); this.audio.punch(p.x, p.z, true); this.audio.crash(p.x, p.z, 3);
      v.vx *= 0.9; v.vz *= 0.9; v.applyDamage(1.5, 'front', 0, v.hz, 4, this.env);
      if (byPlayer) { this.shake(0.4); if (p.role === 'civ' || p.role === 'story') this.police.crime(p.dead ? 'murder' : 'runover', p.x, p.z); if (p.role === 'police') this.police.crime('killCop', p.x, p.z); }
    } else {
      // düşük hız: sendelet / it
      p.x += c.nx * (c.depth + 0.25); p.z += c.nz * (c.depth + 0.25); p.stagger = 0.5;
      if (sp > 4.2) { p.knock(c.nx * sp * 0.7, c.nz * sp * 0.7, 2.5); this.combat.damagePed(p, byPlayer ? this.player : null, sp * 2.5, c.nx, c.nz, 'car'); if (byPlayer && p.role === 'civ') this.police.crime('runover', p.x, p.z); }
      else if (p.role === 'civ' && p.state === 'walk' && Math.random() < 0.05) p.say('Dikkat etsene!', 1.5);
    }
  }
  resolve(A, B, c) {
    const e = 0.22, mA = A.mass, mB = B ? B.mass : Infinity, iA = 1 / mA, iB = B ? 1 / mB : 0;
    const IA = 1 / A.inertia, IB = B ? 1 / B.inertia : 0;
    const rAx = c.cx - A.x, rAz = c.cz - A.z, rBx = B ? c.cx - B.x : 0, rBz = B ? c.cz - B.z : 0;
    const vAx = A.vx + A.w * rAz, vAz = A.vz - A.w * rAx; const vBx = B ? B.vx + B.w * rBz : 0, vBz = B ? B.vz - B.w * rBx : 0;
    const rvx = vBx - vAx, rvz = vBz - vAz; const vn = rvx * c.nx + rvz * c.nz;
    // konum düzeltme
    const tot = iA + iB; const corr = Math.max(0, c.depth - 0.01) / tot * 0.9;
    A.x -= c.nx * corr * iA; A.z -= c.nz * corr * iA; if (B) { B.x += c.nx * corr * iB; B.z += c.nz * corr * iB; }
    if (vn > 0) return;
    const rnA = rAz * c.nx - rAx * c.nz, rnB = rBz * c.nx - rBx * c.nz;
    const j = -(1 + e) * vn / (iA + iB + rnA * rnA * IA + rnB * rnB * IB);
    A.vx -= j * c.nx * iA; A.vz -= j * c.nz * iA; A.w -= j * rnA * IA * 0.6;
    if (B) { B.vx += j * c.nx * iB; B.vz += j * c.nz * iB; B.w += j * rnB * IB * 0.6; }
    // sürtünme
    const tx = -c.nz, tz = c.nx; const vt = rvx * tx + rvz * tz; const rtA = rAz * tx - rAx * tz, rtB = rBz * tx - rBx * tz;
    let jt = -vt / (iA + iB + rtA * rtA * IA + rtB * rtB * IB); jt = Math.max(-0.35 * j, Math.min(0.35 * j, jt));
    A.vx -= jt * tx * iA; A.vz -= jt * tz * iA; A.w -= jt * rtA * IA * 0.5; if (B) { B.vx += jt * tx * iB; B.vz += jt * tz * iB; B.w += jt * rtB * IB * 0.5; }
    // hasar + efekt
    const dvA = j * iA, dvB = B ? j * iB : 0; const sev = Math.max(dvA, dvB, -vn * (B ? 0.5 : 1));
    if (-vn > 2.2) {
      const now = performance.now();
      if (now - (A._lastFx || 0) > 90) { A._lastFx = now; this.fx.sparks(c.cx, 0.7, c.cz, Math.min(24, 4 + (-vn) * 1.5), -c.nx, -c.nz); this.audio.crash(c.cx, c.cz, -vn); if (-vn > 7) this.fx.dust(c.cx, c.cz, 4); }
      A.impact(c.cx, c.cz, -c.nx, -c.nz, B ? dvA * 1.15 : -vn * 0.72, this.env);
      if (B) B.impact(c.cx, c.cz, c.nx, c.nz, dvB * 1.15, this.env);
      const pc = this.playerCar; if ((A === pc || B === pc) && -vn > 3) { this.shake(Math.min(0.9, -vn * 0.06)); const other = A === pc ? B : A; if (other?.isPolice && other.driver && !other.driver.isPlayer) this.police.crime('ramCop', pc.x, pc.z); if (other?.ai?.type === 'traffic') { other.ai.panic = 4; other.driver?.say(['Hey!!', 'Kör müsün?!', 'Arabam!'][(Math.random() * 3) | 0], 2); } }
    }
  }
  // ------------------------------------------------ nüfus yönetimi
  managePopulation(dt) {
    this._popT = (this._popT || 0) - dt; if (this._popT > 0) return; this._popT = 0.5;
    const pp = this.playerPos();
    if (this.pop.enabled) {
      const traffic = this.vehicles.filter(v => v.ai?.type === 'traffic').length;
      if (traffic < this.pop.trafficTarget) this.pop.spawnTraffic(pp.x, pp.z);
      const civs = this.peds.filter(p => p.role === 'civ' && !p.vehicle).length;
      if (civs < this.pop.pedTarget) { this.pop.spawnPed(pp.x, pp.z); this.pop.spawnPed(pp.x, pp.z); }
    }
    for (const v of [...this.vehicles]) { if (v.persistent || v === this.playerCar || v === this.lastCar || this.police.units.includes(v)) continue; if (Math.hypot(v.x - pp.x, v.z - pp.z) > 210) this.removeVehicle(v); }
    for (const p of [...this.peds]) { if (p.persistent || p.vehicle) continue; const d = Math.hypot(p.x - pp.x, p.z - pp.z); if (d > 150 || (p.dead && d > 70)) this.removePed(p); }
  }
  // ------------------------------------------------ kamera
  updateCamera(dt) {
    const p = this.player, v = this.playerCar; let tx, tz, dist;
    if (v) { tx = v.x + v.vx * 0.5; tz = v.z + v.vz * 0.5; dist = 50 + Math.min(34, v.speed * 1.1); }
    else { tx = p.x; tz = p.z; dist = 38; if (p.aiming) { tx += (this.aim.x - p.x) * 0.25; tz += (this.aim.z - p.z) * 0.25; } }
    if (this.camOverride) { tx = this.camOverride.x; tz = this.camOverride.z; dist = this.camOverride.dist || dist; }
    const k = 1 - Math.exp(-dt * (v ? 3.2 : 5)); this.camT.x += (tx - this.camT.x) * k; this.camT.z += (tz - this.camT.z) * k; this.camDist += (dist - this.camDist) * (1 - Math.exp(-dt * 1.5));
    this.shakeA = Math.max(0, this.shakeA - dt * 2.5); const s = this.shakeA * this.shakeA * 0.8;
    const sx = (Math.random() - .5) * s, sz = (Math.random() - .5) * s;
    const cy = Math.sin(this.pitch) * this.camDist, cz = Math.cos(this.pitch) * this.camDist;
    this.camera.position.set(this.camT.x + sx, cy + sx, this.camT.z + cz + sz); this.camera.lookAt(this.camT.x + sx, 0, this.camT.z + sz);
    // gölge kamerası kamerayı izler
    const se = this.sunEl, sa = this.sunAz; const L = 120;
    this.sun.position.set(this.camT.x + Math.cos(sa) * Math.cos(se) * L, Math.sin(se) * L + 20, this.camT.z - 10 + Math.sin(sa) * Math.cos(se) * L); this.sun.target.position.set(this.camT.x, 0, this.camT.z - 10);
    this.audio.listener.x = this.camT.x; this.audio.listener.z = this.camT.z;
    this.fx.setScale(this.renderer.domElement.height / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
  }
  // ------------------------------------------------ ana döngü
  loop() {
    requestAnimationFrame(this.loop);
    let dt = Math.min(this.clock.getDelta(), 1 / 25);
    if (!this.paused) this.step(dt);
    if (this.post) this.post.render(this.scene, this.camera); else this.renderer.render(this.scene, this.camera);
    this.ui.frame(dt);
    this.input.endFrame();
  }
  step(dt) {
    if (this.input.hit('escape')) { this.ui.pause(); return; }
    if (this.input.hit('p') && this.story?.hasSimenaPhoto && !this.cutscene) { this.ui.polaroid(this.polaroidThought()); this.onPolaroid?.(); }
    if (this.input.hit('m')) { this.audio.musicOn = !this.audio.musicOn; this.ui.toast(this.audio.musicOn ? '♪ Radyo açık' : '♪ Radyo kapalı'); }
    M.windTime.value += dt;
    if (this.hitstop > 0) { this.hitstop -= dt; this.updateCamera(dt); return; }
    if (this.timeScale) this.setTime(this.time + dt * this.timeScale);
    else if (Math.abs(this.rain - this.rainTarget) > 0.01) this.setTime(this.time);
    this.updateRain(dt);
    this.updatePlayer(dt);
    // YZ
    for (const p of this.peds) {
      if (p.vehicle || p.dead || p.down || p.fly) continue;
      if (p.tokenT > 0) { p.tokenT -= dt; if (p.tokenT <= 0) this.tokens.delete(p); }
      if (p.ai) p.ai(dt); else if (p.role === 'civ') this.pop.updateCivilian(p, dt); else if (p.role === 'gang') this.pop.updateFighter(p, dt, p.target || this.player);
    }
    for (const v of this.vehicles) { if (v.ai?.type === 'traffic') this.pop.updateTrafficCar(v, dt); else if (v.ai?.fn) v.ai.fn(dt); }
    this.police.update(dt);
    // fizik (2 alt adım)
    this.fdt = dt / 2; this.physics(dt / 2); this.physics(dt / 2);
    for (const p of this.peds) p.update(dt, this.env);
    this.player.update(dt, this.env);
    if (this.player.hp <= 0 && !this.player.dead) { this.player.die(); this.onPlayerDeath(); }
    if (this.player.hp < 100 && !this.player.dead && this.player.hp > 0) this.player.hp = Math.min(100, this.player.hp + dt * 0.8);
    this.combat.update(dt); this.fx.update(dt);
    this.managePopulation(dt);
    // işaretler
    for (const m of this.markers) { m.mesh.rotation.y += dt; m.mesh.material.opacity = 0.65 + Math.sin(performance.now() / 300) * 0.2; }
    // sonbahar yaprakları
    if (this.season === 'autumn' && Math.random() < dt * 14) { const cx = this.camT.x + (Math.random() - .5) * 70, cz = this.camT.z + (Math.random() - .5) * 45; const col = [[0.85, 0.45, 0.15], [0.9, 0.65, 0.2], [0.7, 0.3, 0.12]][(Math.random() * 3) | 0]; this.fx.smoke.emit({ x: cx, y: 9 + Math.random() * 4, z: cz, vx: this.wind[0] * 2 + (Math.random() - .5), vy: -1.2, vz: this.wind[1] * 2, life: 7, s0: 0.35, s1: 0.35, c0: col, a0: 0.95, a1: 0.8, drag: 0.1 }); }
    if (this.bonfire) { const b = this.bonfire; if (Math.random() < dt * 45) this.fx.fire(b.x, 0.3, b.z, 0.9); if (Math.random() < dt * 6) this.fx.glow.emit({ x: b.x, y: 1, z: b.z, vx: (Math.random() - .5), vy: 2.5 + Math.random() * 2, vz: (Math.random() - .5), life: 1.6, s0: 0.18, s1: 0.05, c0: [1, 0.7, 0.3], a0: 1, a1: 0, floor: false }); this.fireLight.position.set(b.x, 1.6, b.z); this.fireLight.intensity = 9 + Math.sin(performance.now() / 70) * 1.5 + Math.random() * 1.5; }
    // fener ışını
    this.world.lighthouse.userData.pivot.rotation.y += dt * 0.7;
    this.world.water.material.map.offset.x += dt * 0.004; this.world.water.material.map.offset.y += dt * 0.006;
    // oyuncu farı
    const pc = this.playerCar;
    if (pc && this.env.night && pc.headlightsOk) { const { fx, fz } = axes(pc.a); this.headSpot.intensity = 60; this.headSpot.position.set(pc.x + fx * 2.4, 1.6, pc.z + fz * 2.4); this.headSpot.target.position.set(pc.x + fx * 20, 0, pc.z + fz * 20); }
    else this.headSpot.intensity = 0;
    if (this.mission) this.mission.update(dt);
    this.updateCamera(dt);
  }
}
