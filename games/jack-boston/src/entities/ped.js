// İnsan karakter: prosedürel dokulu low-poly gövde, yürüme/koşma/vuruş/düşme animasyonları
import * as THREE from 'three';
import * as T from '../engine/textures.js';

const SKINS = ['#f1c9a5', '#e0ac85', '#c68e64', '#8d5a3b', '#f6d7bf', '#b97c55'];
const HAIRS = ['#2b1d14', '#4a3020', '#7a5a35', '#c9a36a', '#1a1a1a', '#8a3b1f', '#5a5a5a'];
const SHIRTS = ['#c94f4f', '#4f7fc9', '#e8e2d0', '#4f9a6a', '#d9a03a', '#7a5ac9', '#2f2f35', '#c97a9a', '#5a8a9a', '#a85f3a'];
const PANTS = ['#2f3e5a', '#3a3a3a', '#5a4a3a', '#6a6f75', '#23324d'];
export const LOOKS = { SKINS, HAIRS, SHIRTS, PANTS };

const geoCache = {};
function G(k, f) { return geoCache[k] || (geoCache[k] = f()); }

export class Ped {
  constructor(game, o = {}) {
    this.game = game; this.x = o.x || 0; this.z = o.z || 0; this.a = o.a || 0; this.y = 0;
    this.vx = 0; this.vz = 0; this.radius = 0.42;
    this.hp = o.hp ?? 100; this.maxHp = this.hp; this.role = o.role || 'civ'; // civ, police, gang, story, player
    this.name = o.name || null; this.female = !!o.female; this.isPlayer = !!o.isPlayer;
    this.state = 'walk'; this.stateT = 0; this.anim = 0; this.speed = 0;
    this.weapon = o.weapon || 'fists'; this.attackT = -1; this.attackPhase = null; this.hitDone = false;
    this.vehicle = null; this.dead = false; this.down = false; this.downT = 0; this.fly = null;
    this.persistent = !!o.persistent; this.invuln = !!o.invuln; this.nonLethal = !!o.nonLethal;
    this.bubble = null; this.bubbleT = 0; this.target = null; this.fear = 0; this.aggro = o.aggro || 0;
    this.look = o.look || {
      skin: SKINS[(Math.random() * SKINS.length) | 0], hair: HAIRS[(Math.random() * HAIRS.length) | 0],
      shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0], pants: PANTS[(Math.random() * PANTS.length) | 0],
      shirtKind: ['shirt', 'stripes', 'hoodie', 'jacket'][(Math.random() * 4) | 0], beard: !this.female && Math.random() < 0.2,
    };
    if (this.role === 'police') this.look = { ...this.look, shirt: '#2b3a5c', pants: '#1f2a40', shirtKind: 'police', police: true, beard: false };
    this.scale = (o.scale || (this.female ? 0.94 : 1)) * 1.18;
    this.build(); game.scene.add(this.mesh);
  }
  build() {
    const L = this.look; const g = new THREE.Group(); this.mesh = g; const s = this.scale;
    const skin = new THREE.MeshLambertMaterial({ color: L.skin });
    const shirt = new THREE.MeshLambertMaterial({ map: T.clothTex(L.shirt, L.shirtKind) });
    const pants = new THREE.MeshLambertMaterial({ map: T.clothTex(L.pants, 'jeans') });
    const shoes = new THREE.MeshLambertMaterial({ color: 0x1e1a18 });
    const hairM = new THREE.MeshLambertMaterial({ map: T.hairTopTex(L.hair) });
    const face = new THREE.MeshLambertMaterial({ map: T.faceTex(L.skin, L.hair, { female: this.female, beard: L.beard, police: L.police, angry: this.role === 'gang' }) });
    for (const m of [skin, shirt, pants, face, hairM]) { m.emissive = new THREE.Color(m.color).multiplyScalar(0.0); m.emissiveMap = m.map || null; m.emissive.setRGB(0.16, 0.16, 0.16); }
    if (!skin.map) skin.emissive.copy(new THREE.Color(L.skin)).multiplyScalar(0.16);
    this.mats = { skin, shirt, pants };
    const root = new THREE.Group(); root.scale.setScalar(s); g.add(root); this.root = root;
    const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips); this.hips = hips;
    // bacaklar
    const legG = G('leg', () => { const b = new THREE.BoxGeometry(0.2, 0.86, 0.22); b.translate(0, -0.43, 0); return b; });
    const shoeG = G('shoe', () => { const b = new THREE.BoxGeometry(0.22, 0.12, 0.32); b.translate(0, -0.86, 0.05); return b; });
    this.legs = [-1, 1].map(sx => { const p = new THREE.Group(); p.position.x = sx * 0.12; const m = new THREE.Mesh(legG, pants); m.castShadow = true; p.add(m, new THREE.Mesh(shoeG, shoes)); hips.add(p); return p; });
    // gövde
    const torsoG = G('torso', () => { const b = new THREE.BoxGeometry(0.52, 0.66, 0.3); b.translate(0, 0.33, 0); return b; });
    const torso = new THREE.Group(); hips.add(torso); this.torso = torso;
    const tm = new THREE.Mesh(torsoG, shirt); tm.castShadow = true; torso.add(tm);
    if (this.female) { const skirt = new THREE.Mesh(G('skirt', () => { const b = new THREE.CylinderGeometry(0.28, 0.36, 0.34, 8); b.translate(0, -0.12, 0); return b; }), pants); torso.add(skirt); }
    // kollar
    const armG = G('arm', () => { const b = new THREE.BoxGeometry(0.16, 0.62, 0.18); b.translate(0, -0.31, 0); return b; });
    const handG = G('hand', () => { const b = new THREE.BoxGeometry(0.14, 0.14, 0.14); b.translate(0, -0.66, 0); return b; });
    this.arms = [-1, 1].map(sx => { const p = new THREE.Group(); p.position.set(sx * 0.35, 0.6, 0); const m = new THREE.Mesh(armG, shirt); m.castShadow = true; p.add(m, new THREE.Mesh(handG, skin)); torso.add(p); return p; });
    // kafa
    const head = new THREE.Group(); head.position.y = 0.68; torso.add(head); this.head = head;
    const headG = G('head', () => new THREE.BoxGeometry(0.36, 0.38, 0.36));
    const hm = new THREE.Mesh(headG, [skin, skin, hairM, skin, face, hairM]); hm.position.y = 0.2; hm.castShadow = true; head.add(hm);
    const hairCap = new THREE.Mesh(G('hcap' + this.female, () => new THREE.BoxGeometry(0.39, this.female ? 0.16 : 0.1, 0.39)), hairM); hairCap.position.y = 0.42; head.add(hairCap);
    if (this.female) { const back = new THREE.Mesh(G('hback', () => new THREE.BoxGeometry(0.4, 0.5, 0.12)), hairM); back.position.set(0, 0.12, -0.18); head.add(back); }
    if (L.police) { const cap = new THREE.Mesh(G('pcap', () => new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10)), new THREE.MeshLambertMaterial({ color: 0x1b2a4a })); cap.position.y = 0.44; head.add(cap); const brim = new THREE.Mesh(G('brim', () => new THREE.BoxGeometry(0.3, 0.03, 0.16)), new THREE.MeshLambertMaterial({ color: 0x111111 })); brim.position.set(0, 0.4, 0.22); head.add(brim); }
    // silah tutucu (sağ el)
    this.hand = new THREE.Group(); this.hand.position.set(0, -0.66, 0.06); this.arms[0].add(this.hand);
    this.setWeaponMesh(this.weapon);
    // yumuşak gölge
    const sh = new THREE.Mesh(G('pshadow', () => { const p = new THREE.PlaneGeometry(1.1, 1.1); p.rotateX(-Math.PI / 2); return p; }), Ped.shadowMat || (Ped.shadowMat = new THREE.MeshBasicMaterial({ map: T.softDotTex(), color: 0, transparent: true, opacity: 0.4, depthWrite: false })));
    sh.position.y = 0.05; sh.renderOrder = 1; g.add(sh); this.shadow = sh;
    // seçim halkası (görev karakterleri)
    this.sync();
  }
  setWeaponMesh(w) {
    this.weapon = w; this.hand.clear();
    if (w === 'bat') { const b = new THREE.Mesh(G('bat', () => { const c = new THREE.CylinderGeometry(0.05, 0.03, 0.9, 6); c.rotateX(Math.PI / 2); c.translate(0, 0, 0.4); return c; }), new THREE.MeshLambertMaterial({ color: 0xb08850 })); this.hand.add(b); }
    else if (w === 'pistol' || w === 'silenced') { const b = new THREE.Mesh(G('gun', () => { const c = new THREE.BoxGeometry(0.06, 0.12, 0.26); c.translate(0, 0, 0.1); return c; }), new THREE.MeshLambertMaterial({ color: 0x222222 })); this.hand.add(b); if (w === 'silenced') { const s = new THREE.Mesh(G('sil', () => { const c = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6); c.rotateX(Math.PI / 2); c.translate(0, 0.02, 0.33); return c; }), new THREE.MeshLambertMaterial({ color: 0x111111 })); this.hand.add(s); } }
    else if (w === 'shotgun') { const b = new THREE.Mesh(G('sg', () => { const c = new THREE.BoxGeometry(0.07, 0.1, 0.8); c.translate(0, 0, 0.25); return c; }), new THREE.MeshLambertMaterial({ color: 0x3a2a1a })); this.hand.add(b); }
  }
  get alive() { return !this.dead; }
  get canAct() { return !this.dead && !this.down && !this.fly && !this.vehicle; }

  move(dx, dz, speed, dt, face = true) {
    const L = Math.hypot(dx, dz);
    if (L > 0.01) { this.vx = dx / L * speed; this.vz = dz / L * speed; if (face) this.faceTo(Math.atan2(dx, dz), dt); } else { this.vx = 0; this.vz = 0; }
    this.speed = L > 0.01 ? speed : 0;
  }
  faceTo(target, dt, rate = 12) { let d = target - this.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; this.a += d * Math.min(1, dt * rate); }
  startAttack() { if (this.attackT >= 0 || !this.canAct) return false; this.attackT = 0; this.hitDone = false; this.combo = ((this.combo || 0) + 1) % 2; return true; }
  // Saldırı fazları: startup 0.12 -> active 0.1 -> recovery 0.3
  attackTiming() { return this.weapon === 'bat' ? [0.2, 0.12, 0.38] : [0.12, 0.1, 0.28]; }
  updateAnim(dt) {
    const sp = this.speed; this.anim += dt * (sp > 4 ? 11 : 7.5) * Math.min(1.4, sp / 2.5 + 0.2);
    const sw = sp > 0.2 ? Math.sin(this.anim) * Math.min(0.9, 0.3 + sp * 0.11) : 0;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    this.arms[0].rotation.x = -sw * 0.8; this.arms[1].rotation.x = sw * 0.8; this.arms[0].rotation.z = 0; this.arms[1].rotation.z = 0;
    this.torso.rotation.x = sp > 4 ? 0.18 : 0; this.torso.rotation.y = 0; this.hips.position.y = 0.92 + (sp > 0.2 ? Math.abs(Math.cos(this.anim)) * 0.05 : 0);
    if (this.state === 'talk') { this.arms[1].rotation.x = -0.4 + Math.sin(performance.now() / 300) * 0.25; }
    this.root.position.y = this.state === 'sit' ? -0.5 : 0;
    if (this.state === 'sit') { this.legs[0].rotation.x = this.legs[1].rotation.x = -1.45; this.arms[0].rotation.x = this.arms[1].rotation.x = -0.5; }
    if (this.state === 'cheer') { this.arms[0].rotation.x = -2.6 + Math.sin(performance.now() / 150) * 0.3; this.arms[1].rotation.x = -2.6 + Math.cos(performance.now() / 150) * 0.3; }
    if (this.state === 'phone') { this.arms[0].rotation.x = -2.2; this.arms[0].rotation.z = 0.5; }
    if (this.state === 'hug') { this.arms[0].rotation.x = -1.3; this.arms[1].rotation.x = -1.3; this.arms[0].rotation.z = 0.4; this.arms[1].rotation.z = -0.4; }
    if (this.aiming) { this.arms[0].rotation.x = -Math.PI / 2; if (this.weapon === 'shotgun') { this.arms[1].rotation.x = -1.4; this.arms[1].rotation.z = -0.5; } }
    if (this.attackT >= 0) {
      const [s, a, r] = this.attackTiming(); const t = this.attackT; const arm = this.arms[this.combo ? 1 : 0];
      if (this.weapon === 'bat') {
        const k = t < s ? t / s : t < s + a ? 1 : 1 - (t - s - a) / r;
        this.arms[0].rotation.x = -1.2 - (t < s ? -0.6 * k : 0.4); this.arms[1].rotation.x = this.arms[0].rotation.x; this.torso.rotation.y = t < s ? 0.8 * k : 0.8 - 1.8 * Math.min(1, (t - s) / (a + 0.05));
      } else {
        const k = t < s ? -0.3 * (t / s) : t < s + a ? 1 : Math.max(0, 1 - (t - s - a) / r);
        arm.rotation.x = -Math.PI / 2 * Math.max(0, k) + (k < 0 ? 0.5 : 0); this.torso.rotation.y = (this.combo ? -1 : 1) * 0.35 * Math.max(0, k);
      }
    }
  }
  update(dt, env) {
    this.stateT += dt; if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null; }
    if (this.vehicle) { this.mesh.visible = false; this.x = this.vehicle.x; this.z = this.vehicle.z; return; }
    this.mesh.visible = true;
    if (this.fly) { // savrulma
      const f = this.fly; f.vy -= 22 * dt; this.x += f.vx * dt; this.z += f.vz * dt; this.y += f.vy * dt; f.spin += dt;
      this.root.rotation.x = Math.min(Math.PI / 2, this.root.rotation.x + f.rx * dt); this.root.rotation.z += f.rz * dt * 0.5;
      const gy = env.heightAt(this.x, this.z);
      if (this.y <= gy) { this.y = gy; if (Math.abs(f.vy) > 4) { f.vy = -f.vy * 0.25; f.vx *= 0.5; f.vz *= 0.5; env.fx.dust(this.x, this.z, 3); } else { this.fly = null; this.root.rotation.x = -Math.PI / 2; this.root.rotation.z = 0; this.root.position.y = 0.18; this.down = true; this.downT = 0; } }
      this.sync(); return;
    }
    if (this.dead || this.down) {
      this.downT += dt; this.speed = 0;
      this.root.rotation.x += (-Math.PI / 2 - this.root.rotation.x) * Math.min(1, dt * 10); this.root.position.y = 0.18;
      this.legs.forEach(l => l.rotation.x = 0.1); this.arms[0].rotation.x = -2.8; this.arms[1].rotation.x = 0.4;
      if (this.down && !this.dead && this.downT > (this.getUpT || 3.2)) this.getUp();
      this.sync(); return;
    }
    if (this.attackT >= 0) {
      const [s, a, r] = this.attackTiming(); this.attackT += dt;
      if (this.attackT >= s && !this.hitDone) { this.hitDone = true; env.meleeHit(this); }
      if (this.attackT > s + a + r) this.attackT = -1;
      this.vx *= 0.8; this.vz *= 0.8;
    }
    if (this.stagger > 0) { this.stagger -= dt; }
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.y = env.heightAt(this.x, this.z);
    this.updateAnim(dt); this.sync();
  }
  getUp() { this.down = false; this.root.rotation.set(0, 0, 0); this.root.position.y = 0; this.state = this.aggro > 0 ? 'fight' : 'flee'; this.stateT = 0; }
  knock(vx, vz, vy = 4) {
    this.fly = { vx, vz, vy, rx: 6 + Math.random() * 4, rz: (Math.random() - .5) * 6, spin: 0 }; this.attackT = -1; this.y += 0.05;
  }
  die() { if (this.dead) return; this.dead = true; this.hp = 0; this.down = true; this.state = 'dead'; this.attackT = -1; this.bubble = null; }
  say(text, t = 3) { this.bubble = text; this.bubbleT = t; }
  sync() {
    this.mesh.position.set(this.x, this.y, this.z); this.mesh.rotation.y = this.a;
    this.shadow.visible = !this.fly && !this.down;
  }
  dispose() { this.game.scene.remove(this.mesh); }
}
