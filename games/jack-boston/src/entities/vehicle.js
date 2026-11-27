// Araç: bisiklet sürüş modeli, OBB gövde, bölgesel görünür hasar (göçük/çizik/far/tampon), duman/alev/bozulma
import * as THREE from 'three';
import * as T from '../engine/textures.js';
import { axes } from '../physics/collide.js';

export const KINDS = {
  sedan: { w: 1.9, l: 4.6, mass: 1300, maxV: 31, acc: 8.5, grip: 8.5, name: '1988 Oakridge Sedan' },
  hatch: { w: 1.75, l: 3.9, mass: 1050, maxV: 29, acc: 9, grip: 9, name: 'Şehir Hatch' },
  coupe: { w: 1.85, l: 4.3, mass: 1200, maxV: 36, acc: 11, grip: 9.5, name: 'Coupe' },
  pickup: { w: 2.0, l: 5.1, mass: 1800, maxV: 28, acc: 7.5, grip: 8, name: 'Pikap' },
  police: { w: 1.95, l: 4.8, mass: 1500, maxV: 38, acc: 12, grip: 10, name: 'Polis Aracı' },
  taxi: { w: 1.9, l: 4.7, mass: 1350, maxV: 31, acc: 9, grip: 8.5, name: 'Taksi' },
  suv: { w: 2.05, l: 5.0, mass: 2000, maxV: 30, acc: 8, grip: 8.5, name: 'Kamp SUV' },
  muscle: { w: 1.95, l: 4.8, mass: 1500, maxV: 40, acc: 12, grip: 8, name: 'Klasik Muscle' },
};
export const CAR_COLORS = ['#27355B', '#8e2f2f', '#d9d4c7', '#2f5a4a', '#c9a646', '#5b6770', '#7a4a6b', '#3d6a8a', '#b86a3a', '#1f1f22', '#a8b8b0', '#6b2b2b'];

const tmpV = new THREE.Vector3();

function bodyMaterials(color, kind) {
  const side = new THREE.MeshPhongMaterial({ map: T.carBodyTex(color, kind), shininess: 70, specular: 0x555555, vertexColors: true });
  const top = new THREE.MeshPhongMaterial({ map: T.carTopTex(color, kind), shininess: 80, specular: 0x666666, vertexColors: true });
  const front = new THREE.MeshPhongMaterial({ map: T.grilleTex(color), shininess: 50, vertexColors: true });
  const back = new THREE.MeshPhongMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), shininess: 50, vertexColors: true });
  const bottom = new THREE.MeshLambertMaterial({ color: 0x111111 });
  return [side, side, top, bottom, front, back];
}

export class Vehicle {
  constructor(game, o) {
    this.game = game; this.kind = o.kind || 'sedan'; const K = KINDS[this.kind]; this.K = K;
    this.color = o.color || CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
    this.hx = K.w / 2; this.hz = K.l / 2; this.mass = K.mass; this.inertia = K.mass * (K.w * K.w + K.l * K.l) / 12;
    this.x = o.x; this.z = o.z; this.a = o.a || 0; this.y = 0;
    this.vx = 0; this.vz = 0; this.w = 0; this.steer = 0;
    this.in = { throttle: 0, brake: 0, steer: 0, hand: false };
    this.hp = 100; this.dmg = { front: 0, rear: 0, left: 0, right: 0 };
    this.broken = false; this.burnT = 0; this.exploded = false;
    this.driver = null; this.passengers = []; this.ai = null; this.isPolice = this.kind === 'police';
    this.lightsOn = false; this.siren = false; this.sirenT = 0; this.parked = !!o.parked;
    this.horn = 0; this.lastHitT = 0; this.wheelSpin = 0; this.pitch = 0; this.roll = 0;
    this.build();
    game.scene.add(this.mesh);
  }
  build() {
    const K = this.K, W = K.w, L = K.l;
    const g = new THREE.Group(); this.mesh = g; this.body = new THREE.Group(); g.add(this.body);
    const isPickup = this.kind === 'pickup';
    // alt gövde (göçük için bölümlü)
    const bodyGeo = new THREE.BoxGeometry(W, 0.72, L, 4, 2, 10);
    const cols = new Float32Array(bodyGeo.attributes.position.count * 3).fill(1); bodyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    // burun/kuyruk yuvarlatma
    const p = bodyGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i), x = p.getX(i); const e = Math.abs(z) / (L / 2); if (e > 0.85 && y > 0) p.setY(i, y - (e - 0.85) * 0.9); if (e > 0.9) p.setX(i, x * 0.96); }
    bodyGeo.computeVertexNormals();
    this.bodyGeo = bodyGeo; this.bodyOrig = Float32Array.from(p.array);
    this.mats = bodyMaterials(this.color, this.kind);
    const body = new THREE.Mesh(bodyGeo, this.mats); body.position.y = 0.62; body.castShadow = true; this.body.add(body); this.bodyMesh = body;
    // kabin
    const cl = isPickup ? L * 0.36 : L * 0.5, cz = isPickup ? L * 0.08 : -L * 0.04;
    const cabGeo = new THREE.BoxGeometry(W * 0.9, 0.62, cl, 2, 1, 3);
    const cp = cabGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) if (cp.getY(i) > 0) { cp.setX(i, cp.getX(i) * 0.86); cp.setZ(i, cp.getZ(i) * 0.72 + (cp.getZ(i) > 0 ? -0.05 : 0)); }
    cabGeo.computeVertexNormals();
    const cc = new Float32Array(cp.count * 3).fill(1); cabGeo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    this.cabGeo = cabGeo; this.cabOrig = Float32Array.from(cp.array);
    const glass = new THREE.MeshPhongMaterial({ map: T.glassTex(), shininess: 120, specular: 0xaaaaaa, vertexColors: true });
    this.glassMat = glass;
    const roof = this.mats[2];
    const cab = new THREE.Mesh(cabGeo, [glass, glass, roof, glass, glass, glass]); cab.position.set(0, 1.29, cz); cab.castShadow = true; this.body.add(cab); this.cabMesh = cab;
    if (isPickup) { const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.1, L * 0.38), new THREE.MeshLambertMaterial({ color: 0x2a2a2a })); bed.position.set(0, 0.99, -L * 0.28); this.body.add(bed); }
    // tamponlar
    const bm = new THREE.MeshPhongMaterial({ color: this.kind === 'muscle' || this.kind === 'sedan' ? 0xcfcfcf : 0x2a2a2a, shininess: 90, specular: 0x999999 });
    this.bumpers = {};
    for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, 0.22, 0.22), bm); b.position.set(0, 0.42, s * (L / 2 + 0.06)); b.castShadow = true; this.body.add(b); this.bumpers[s > 0 ? 'front' : 'rear'] = b; }
    // farlar / stoplar
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0x8a1010 });
    this.lights = { fl: null, fr: null, rl: null, rr: null };
    const hlG = new THREE.BoxGeometry(0.36, 0.16, 0.06);
    for (const sx of [1, -1]) {
      const h = new THREE.Mesh(hlG, this.headMat.clone()); h.position.set(sx * W * 0.33, 0.72, L / 2 + 0.01); this.body.add(h); this.lights[sx > 0 ? 'fl' : 'fr'] = h;
      const t = new THREE.Mesh(hlG, this.tailMat.clone()); t.position.set(sx * W * 0.35, 0.74, -L / 2 - 0.01); this.body.add(t); this.lights[sx > 0 ? 'rl' : 'rr'] = t;
    }
    // tekerlekler
    this.wheels = [];
    const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14); wg.rotateZ(Math.PI / 2);
    const tm = [new THREE.MeshLambertMaterial({ map: T.tireTex() }), new THREE.MeshLambertMaterial({ map: T.rimTex() }), new THREE.MeshLambertMaterial({ map: T.rimTex() })];
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const piv = new THREE.Group(); piv.position.set(sx * (W / 2 - 0.08), 0.36, sz * (L / 2 - 0.85)); const wm = new THREE.Mesh(wg, tm); wm.castShadow = true; piv.add(wm); g.add(piv);
      this.wheels.push({ piv, wm, front: sz > 0, sx, sz });
    }
    // polis tepe lambası
    if (this.isPolice) {
      const bar = new THREE.Group(); bar.position.set(0, 1.64, cz);
      this.sirenR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x550000 }));
      this.sirenB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x000055 }));
      this.sirenR.position.x = 0.32; this.sirenB.position.x = -0.32; bar.add(this.sirenR, this.sirenB); this.body.add(bar);
      this.sirenGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: T.softDotTex(), color: 0xff2020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      this.sirenGlow.rotation.x = -Math.PI / 2; this.sirenGlow.position.y = 0.3; g.add(this.sirenGlow);
    }
    // far ışık konisi (zemin, gece)
    this.cone = new THREE.Mesh(new THREE.PlaneGeometry(9, 18), new THREE.MeshBasicMaterial({ map: T.headlightConeTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.cone.rotation.x = -Math.PI / 2; this.cone.rotation.z = Math.PI; this.cone.position.set(0, 0.12, L / 2 + 8.5); this.cone.renderOrder = 3; g.add(this.cone);
    // gölge lekesi (yumuşak)
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, L * 1.25), new THREE.MeshBasicMaterial({ map: T.softDotTex(), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; sh.renderOrder = 1; g.add(sh);
    this.sync();
  }
  obb() { return { x: this.x, z: this.z, hx: this.hx, hz: this.hz, a: this.a }; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwdSpeed() { const s = Math.sin(this.a), c = Math.cos(this.a); return this.vx * s + this.vz * c; }
  get headlightsOk() { return this.lights.fl.visible || this.lights.fr.visible; }

  update(dt, env) {
    const K = this.K, { fx, fz, rx, rz } = axes(this.a);
    let vF = this.vx * fx + this.vz * fz, vR = this.vx * rx + this.vz * rz;
    const inp = this.in; const surf = env.surfaceAt(this.x, this.z);
    let power = this.broken ? 0 : K.acc * (this.hp < 30 ? 0.45 + Math.random() * 0.25 : this.hp < 60 ? 0.85 : 1);
    if (this.hp < 30 && Math.random() < dt * 1.5) power = 0; // tekleme
    let maxV = K.maxV * (this.hp < 30 ? 0.55 : 1) * (surf === 'grass' || surf === 'sand' ? 0.6 : 1);
    if (!this.driver && !this.ai) { inp.throttle = 0; inp.brake = 0.4; inp.steer = 0; inp.hand = false; }
    // ileri/geri
    if (inp.throttle > 0) { if (vF < maxV) vF += power * inp.throttle * dt * (1 - Math.max(0, vF) / (maxV * 1.15)); }
    if (inp.brake > 0) {
      if (vF > 0.8) vF -= 22 * inp.brake * dt; else if (vF > -K.maxV * 0.3) vF -= power * 0.7 * inp.brake * dt;
    }
    const rolling = (surf === 'road' ? 0.35 : 1.2) + (this.broken ? 2.5 : 0);
    vF -= vF * (rolling * 0.25 + 0.0015 * Math.abs(vF)) * dt;
    if (!inp.throttle && !inp.brake && Math.abs(vF) < 0.3) vF *= 0.8;
    if (inp.hand) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 6 * dt);
    // yanal tutuş
    let grip = K.grip * (env.wet && surf === 'road' ? 0.62 : 1) * (surf === 'sand' ? 0.45 : surf === 'grass' || surf === 'dirt' ? 0.6 : 1);
    if (inp.hand) grip *= 0.16;
    const slip = Math.abs(vR);
    vR *= Math.exp(-grip * dt);
    // direksiyon
    const steerTarget = inp.steer * 0.62 / (1 + Math.abs(vF) * 0.045);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 7);
    const yawTarget = -vF * Math.tan(this.steer) / (K.l * 0.6);
    const yawResp = inp.hand ? 3.5 : 9;
    this.w += (yawTarget * (inp.hand ? 1.35 : 1) - this.w) * Math.min(1, dt * yawResp);
    this.vx = fx * vF + rx * vR; this.vz = fz * vF + rz * vR;
    this.x += this.vx * dt; this.z += this.vz * dt; this.a += this.w * dt;
    this.y = env.heightAt(this.x, this.z);
    // görsel süspansiyon
    const accel = (vF - (this._lastVF ?? vF)) / Math.max(dt, 1e-3); this._lastVF = vF;
    this.pitch += ((-accel * 0.006) - this.pitch) * Math.min(1, dt * 6); this.pitch = Math.max(-0.07, Math.min(0.07, this.pitch));
    this.roll += ((this.w * vF * 0.004) - this.roll) * Math.min(1, dt * 6); this.roll = Math.max(-0.08, Math.min(0.08, this.roll));
    this.wheelSpin += vF * dt / 0.36;
    // lastik izi + duman
    const skidding = (slip > 3.2 && Math.abs(vF) > 3) || (inp.brake > 0 && vF > 9 && inp.brake > 0.5) || (inp.hand && Math.abs(vF) > 6) || (inp.throttle > 0 && Math.abs(vF) < 4 && power > 0 && this.driver?.isPlayer && env.keysBurnout);
    this.skidding = skidding;
    if (skidding) {
      for (const wh of this.wheels) if (!wh.front || inp.brake > 0.5) {
        const wx = this.x + rx * wh.sx * (this.hx - 0.1) + fx * wh.sz * (this.hz - 0.85), wz = this.z + rz * wh.sx * (this.hx - 0.1) + fz * wh.sz * (this.hz - 0.85);
        if (surf === 'road' || surf === 'conc') env.fx.skid(wh.sx + '' + wh.sz, wx, wz, this);
        if (Math.random() < dt * 30) env.fx.tireSmoke(wx, wz, surf === 'sand' || surf === 'dirt' || surf === 'grass', env.wet);
      }
    } else env.fx.endSkid(this);
    // hasar dumanı / alev
    const ex = this.x + fx * (this.hz - 0.9), ez = this.z + fz * (this.hz - 0.9);
    if (this.hp < 60 && !this.exploded) { const rate = this.hp < 30 ? 22 : 8; if (Math.random() < dt * rate) env.fx.engineSmoke(ex, 1.1 + this.y, ez, this.hp < 30, [env.wind[0] - this.vx * 0.2, env.wind[1] - this.vz * 0.2]); }
    if (this.broken && !this.exploded) {
      this.burnT += dt; if (Math.random() < dt * 40) env.fx.fire(ex, 1.1 + this.y, ez, 0.8 + this.burnT * 0.08);
      if (Math.random() < dt * 4) env.fx.sparks(ex, 0.9, ez, 2);
      if (this.burnT > 10) this.explode(env);
    }
    if (this.exploded && Math.random() < dt * 6) env.fx.engineSmoke(this.x, 1.2, this.z, true);
    // polis sireni
    if (this.isPolice) {
      this.sirenT += dt;
      const on = this.siren && !this.broken; const ph = Math.floor(this.sirenT * 6) % 2;
      this.sirenR.material.color.set(on && ph ? 0xff2020 : 0x550000); this.sirenB.material.color.set(on && !ph ? 0x2040ff : 0x000055);
      this.sirenGlow.material.opacity = on ? 0.5 : 0; this.sirenGlow.material.color.set(ph ? 0xff2020 : 0x2040ff);
    }
    // farlar
    const night = env.night;
    this.cone.material.opacity = night && this.headlightsOk && !this.exploded && (this.driver || this.ai) ? 0.55 * (this.lights.fl.visible && this.lights.fr.visible ? 1 : 0.55) : 0;
    const braking = inp.brake > 0 && vF > 0.5;
    for (const k of ['rl', 'rr']) this.lights[k].material.color.set(braking ? 0xff2a2a : night && this.driver ? 0xb81818 : 0x6a1010);
    this.sync();
  }
  sync() {
    this.mesh.position.set(this.x, this.y, this.z); this.mesh.rotation.y = this.a;
    this.body.rotation.x = this.pitch; this.body.rotation.z = this.roll;
    for (const wh of this.wheels) { wh.piv.rotation.y = wh.front ? this.steer : 0; wh.wm.rotation.x = this.wheelSpin; }
  }
  // Çarpışma darbesi: (lx,lz) yerel temas, nx/nz dünya normali (araçtan dışarı), dv hız değişimi
  impact(cxw, czw, nx, nz, dv, env, opts = {}) {
    if (dv < 1.2) return 0;
    const { fx, fz, rx, rz } = axes(this.a);
    const dx = cxw - this.x, dz = czw - this.z; const lx = dx * rx + dz * rz, lz = dx * fx + dz * fz;
    const region = Math.abs(lz) / this.hz > Math.abs(lx) / this.hx * 0.9 ? (lz > 0 ? 'front' : 'rear') : (lx > 0 ? 'left' : 'right');
    const dmg = Math.max(0, (dv - 1.6)) * (opts.mult || 3.4);
    this.applyDamage(dmg, region, lx, lz, dv, env);
    return dmg;
  }
  applyDamage(dmg, region, lx, lz, dv, env) {
    if (this.exploded) return;
    this.hp = Math.max(0, this.hp - dmg); this.dmg[region] = Math.min(1, this.dmg[region] + dmg / 60);
    // göçük: gövde köşelerini içeri it
    const sev = Math.min(0.45, dv * 0.03 + dmg * 0.008);
    this.dent(this.bodyGeo, this.bodyOrig, lx, 0.0, lz, sev, 1.1, 0.62);
    this.dent(this.cabGeo, this.cabOrig, lx, 0, lz - (this.cabMesh.position.z), sev * 0.6, 0.9, 1.29);
    // farlar / stoplar kırılsın
    const lt = region === 'front' ? ['fl', 'fr'] : region === 'rear' ? ['rl', 'rr'] : [];
    for (const k of lt) { const L = this.lights[k]; if (L.visible && (this.dmg[region] > 0.35 || dv > 9) && (Math.random() < 0.6 || Math.abs((k.endsWith('l') ? 1 : -1) * this.hx * 0.35 - lx) < 0.6)) { L.visible = false; env.fx.sparks(this.x + Math.sin(this.a) * this.hz * (region === 'front' ? 1 : -1), 0.7, this.z + Math.cos(this.a) * this.hz * (region === 'front' ? 1 : -1), 6, 0, 0, [0.9, 0.95, 1]); env.audio?.glass(); } }
    // tampon düşsün
    if ((region === 'front' || region === 'rear') && this.dmg[region] > 0.6 && this.bumpers[region] && this.bumpers[region].parent) {
      const b = this.bumpers[region]; b.updateWorldMatrix(true, false); b.getWorldPosition(tmpV); this.body.remove(b);
      const m = b.clone(); m.rotation.y = this.a; env.fx.addDebris(m, tmpV.x, tmpV.y, tmpV.z, this.vx * 0.5 + (Math.random() - .5) * 2, 2, this.vz * 0.5 + (Math.random() - .5) * 2); this.bumpers[region] = null;
    }
    if (this.hp <= 0 && !this.broken) { this.broken = true; this.burnT = 0; env.onCarBroken?.(this); }
  }
  dent(geo, orig, lx, ly, lz, sev, radius, yOff) {
    const p = geo.attributes.position, c = geo.attributes.color; let changed = false;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const d = Math.hypot(vx - lx, vz - lz); if (d > radius) continue;
      const f = (1 - d / radius) ** 1.5 * sev;
      // merkeze doğru it + biraz aşağı
      const ox = orig[i * 3], oz = orig[i * 3 + 2];
      let nx = vx - vx * f * 0.6 * (Math.abs(lx) > Math.abs(lz) * 0.4 ? 1 : 0.3), nz = vz - vz * f * 0.35 * (Math.abs(lz) > Math.abs(lx) ? 1 : 0.2);
      // çok fazla ezilmeyi önle
      if (Math.abs(nx) < Math.abs(ox) * 0.55) nx = ox * 0.55; if (Math.abs(nz) < Math.abs(oz) * 0.75) nz = oz * 0.75;
      p.setXYZ(i, nx + (Math.random() - .5) * f * 0.15, vy - f * 0.18 * (vy > 0 ? 1 : 0), nz);
      const k = Math.max(0.35, c.getX(i) - f * 1.6); c.setXYZ(i, k, k * 0.98, k * 0.96); changed = true;
    }
    if (changed) { p.needsUpdate = true; c.needsUpdate = true; geo.computeVertexNormals(); }
  }
  explode(env) {
    if (this.exploded) return; this.exploded = true; this.broken = true; this.hp = 0;
    env.fx.explosion(this.x, this.z, (s) => env.shake(s)); env.audio?.explosion(this.x, this.z);
    for (const m of this.mats) if (m.color) m.color.set(0x1a1714); this.glassMat.color.set(0x111111);
    for (const k in this.lights) this.lights[k].visible = false;
    this.vx += (Math.random() - .5) * 3; this.vz += (Math.random() - .5) * 3; this.w += (Math.random() - .5) * 2;
    env.onExplosion?.(this.x, this.z, this);
  }
  repair(newColor) {
    this.hp = 100; this.broken = false; this.exploded = false; this.burnT = 0; this.dmg = { front: 0, rear: 0, left: 0, right: 0 };
    this.bodyGeo.attributes.position.array.set(this.bodyOrig); this.bodyGeo.attributes.position.needsUpdate = true; this.bodyGeo.attributes.color.array.fill(1); this.bodyGeo.attributes.color.needsUpdate = true; this.bodyGeo.computeVertexNormals();
    this.cabGeo.attributes.position.array.set(this.cabOrig); this.cabGeo.attributes.position.needsUpdate = true; this.cabGeo.attributes.color.array.fill(1); this.cabGeo.attributes.color.needsUpdate = true; this.cabGeo.computeVertexNormals();
    for (const k in this.lights) this.lights[k].visible = true;
    for (const s of ['front', 'rear']) if (!this.bumpers[s]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(this.K.w * 1.02, 0.22, 0.22), new THREE.MeshPhongMaterial({ color: 0xcfcfcf, shininess: 90 })); b.position.set(0, 0.42, (s === 'front' ? 1 : -1) * (this.hz + 0.06)); this.body.add(b); this.bumpers[s] = b;
    }
    if (newColor) {
      this.color = newColor; const nm = bodyMaterials(newColor, this.kind);
      this.bodyMesh.material = nm; this.mats = nm; this.cabMesh.material = [this.glassMat, this.glassMat, nm[2], this.glassMat, this.glassMat, this.glassMat];
    }
    this.glassMat.color.set(0xffffff);
  }
  dispose() { this.game.scene.remove(this.mesh); this.bodyGeo.dispose(); this.cabGeo.dispose(); }
}
