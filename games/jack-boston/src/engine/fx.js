// Efektler: parçacıklar (duman/kıvılcım/alev/toz), lastik izi, kan lekesi, mermi izi, kovan, enkaz, ışık parlaması
import * as THREE from 'three';
import * as T from './textures.js';

const VS = `
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
uniform float uScale; varying vec3 vColor; varying float vAlpha;
void main(){ vColor=aColor; vAlpha=aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.0);
 gl_PointSize = aSize * uScale / max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }`;
const FS = `
uniform sampler2D uMap; varying vec3 vColor; varying float vAlpha;
void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vColor*t.rgb, t.a*vAlpha); if(gl_FragColor.a<0.01) discard; }`;

class ParticleSystem {
  constructor(scene, tex, additive, max = 2500) {
    this.max = max; this.n = 0; this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.col = new Float32Array(max * 3); this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uMap: { value: tex }, uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 6 : 5;
    this.geo = g; scene.add(this.points);
  }
  emit(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: 0, max: o.life || 1, s0: o.s0 ?? 1, s1: o.s1 ?? 2, c0: o.c0 || [1, 1, 1], c1: o.c1 || o.c0 || [1, 1, 1], a0: o.a0 ?? 1, a1: o.a1 ?? 0, g: o.g || 0, drag: o.drag || 0, floor: o.floor ?? true });
  }
  update(dt) {
    const arr = this.p; let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i]; q.life += dt; if (q.life >= q.max) continue;
      q.vy -= q.g * dt; const dr = Math.exp(-q.drag * dt); q.vx *= dr; q.vy *= dr; q.vz *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.floor && q.y < 0.05) { q.y = 0.05; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
      arr[w++] = q;
    }
    arr.length = w;
    for (let i = 0; i < w; i++) {
      const q = arr[i], t = q.life / q.max;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = q.s0 + (q.s1 - q.s0) * t;
      this.col[i * 3] = q.c0[0] + (q.c1[0] - q.c0[0]) * t; this.col[i * 3 + 1] = q.c0[1] + (q.c1[1] - q.c0[1]) * t; this.col[i * 3 + 2] = q.c0[2] + (q.c1[2] - q.c0[2]) * t;
      this.alpha[i] = q.a0 + (q.a1 - q.a0) * t;
    }
    this.geo.setDrawRange(0, w);
    for (const k of ['position', 'aSize', 'aColor', 'aAlpha']) this.geo.attributes[k].needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.smoke = new ParticleSystem(scene, T.smokeTex(), false, 2500);
    this.glow = new ParticleSystem(scene, T.softDotTex(), true, 2500);
    // lastik izleri
    this.skidMax = 2400; this.skidI = 0;
    const sg = new THREE.BufferGeometry(); this.skidPos = new Float32Array(this.skidMax * 4 * 3); const uv = new Float32Array(this.skidMax * 4 * 2); const idx = [];
    for (let i = 0; i < this.skidMax; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); }
    sg.setAttribute('position', new THREE.BufferAttribute(this.skidPos, 3).setUsage(THREE.DynamicDrawUsage)); sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); sg.setIndex(idx);
    this.skidGeo = sg; const sm = new THREE.MeshBasicMaterial({ map: T.skidTex(), transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.skidMesh = new THREE.Mesh(sg, sm); this.skidMesh.frustumCulled = false; this.skidMesh.renderOrder = 1; scene.add(this.skidMesh);
    // kan lekeleri
    this.decals = []; const dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2); this.decalGeo = dg;
    this.bloodMat = new THREE.MeshBasicMaterial({ map: T.bloodTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    // mermi izleri
    this.tracers = []; const tg = new THREE.BufferGeometry(); this.trPos = new Float32Array(64 * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.trPos, 3).setUsage(THREE.DynamicDrawUsage)); this.trGeo = tg;
    this.trLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); this.trLines.frustumCulled = false; scene.add(this.trLines);
    // kovanlar
    this.shellMax = 120; this.shells = [];
    this.shellMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), new THREE.MeshPhongMaterial({ color: 0xd4a640, specular: 0xffeeaa, shininess: 80 }), this.shellMax);
    this.shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shellMesh.count = 0; this.shellMesh.frustumCulled = false; scene.add(this.shellMesh);
    // enkaz
    this.debris = [];
    // parlama ışıkları (sabit sayıda; shader yeniden derlenmez)
    this.flashLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffc070, 0, 22, 1.6); scene.add(l); return { l, t: 0 }; });
    this.flashI = 0;
    this.muzzle = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: T.softDotTex(), color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.muzzle.visible = false; this.muzzle.rotation.x = -Math.PI / 2; scene.add(this.muzzle); this.muzzleT = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._p = new THREE.Vector3();
  }
  setScale(s) { this.smoke.mat.uniforms.uScale.value = s; this.glow.mat.uniforms.uScale.value = s; }

  skid(key, x, z, owner) {
    owner._skid = owner._skid || {}; const last = owner._skid[key];
    owner._skid[key] = { x, z, t: performance.now() };
    if (!last || performance.now() - last.t > 120) return;
    const dx = x - last.x, dz = z - last.z, L = Math.hypot(dx, dz); if (L < 0.05 || L > 3) return;
    const px = -dz / L * 0.14, pz = dx / L * 0.14, i = this.skidI++ % this.skidMax, o = i * 12, y = 0.045;
    this.skidPos.set([last.x - px, y, last.z - pz, last.x + px, y, last.z + pz, x + px, y, z + pz, x - px, y, z - pz], o);
    this.skidGeo.attributes.position.needsUpdate = true;
  }
  endSkid(owner) { if (owner._skid) owner._skid = {}; }
  tireSmoke(x, z, dusty, wet) {
    const c = dusty ? [0.72, 0.62, 0.48] : wet ? [0.85, 0.87, 0.9] : [0.9, 0.9, 0.9];
    this.smoke.emit({ x: x + (Math.random() - .5) * .4, y: 0.3, z: z + (Math.random() - .5) * .4, vx: (Math.random() - .5) * 1.2, vy: 0.8 + Math.random(), vz: (Math.random() - .5) * 1.2, life: 1.2 + Math.random(), s0: 1.2, s1: 4.2, c0: c, a0: dusty ? 0.5 : 0.35, a1: 0, drag: 1.2 });
  }
  engineSmoke(x, y, z, black, wind = [0.6, 0.3]) {
    const c = black ? [0.12, 0.12, 0.13] : [0.75, 0.75, 0.76];
    this.smoke.emit({ x, y, z, vx: wind[0] + (Math.random() - .5), vy: 1.8 + Math.random(), vz: wind[1] + (Math.random() - .5), life: 1.6 + Math.random() * 1.2, s0: 0.8, s1: black ? 4.5 : 3.2, c0: c, a0: black ? 0.75 : 0.45, a1: 0, drag: 0.6 });
  }
  fire(x, y, z, s = 1) {
    this.glow.emit({ x: x + (Math.random() - .5) * 0.8 * s, y, z: z + (Math.random() - .5) * 0.8 * s, vx: (Math.random() - .5) * .5, vy: 2 + Math.random() * 2, vz: (Math.random() - .5) * .5, life: 0.45 + Math.random() * 0.3, s0: 1.6 * s, s1: 0.4, c0: [1, 0.75, 0.3], c1: [0.9, 0.2, 0.05], a0: 0.95, a1: 0 });
  }
  sparks(x, y, z, n = 12, nx = 0, nz = 0, col = [1, 0.8, 0.4]) {
    for (let i = 0; i < n; i++) this.glow.emit({ x, y, z, vx: (Math.random() - .5) * 8 + nx * 4, vy: 1 + Math.random() * 4, vz: (Math.random() - .5) * 8 + nz * 4, life: 0.25 + Math.random() * 0.35, s0: 0.35, s1: 0.05, c0: col, c1: [1, 0.3, 0.05], a0: 1, a1: 0, g: 14 });
  }
  dust(x, z, n = 6) { for (let i = 0; i < n; i++) this.smoke.emit({ x, y: 0.3, z, vx: (Math.random() - .5) * 3, vy: 0.5 + Math.random(), vz: (Math.random() - .5) * 3, life: 0.8, s0: 0.8, s1: 2.5, c0: [0.7, 0.65, 0.58], a0: 0.4, a1: 0, drag: 2 }); }
  hitPuff(x, y, z) { for (let i = 0; i < 6; i++) this.glow.emit({ x, y, z, vx: (Math.random() - .5) * 3, vy: (Math.random()) * 2, vz: (Math.random() - .5) * 3, life: 0.18, s0: 0.9, s1: 0.1, c0: [1, 1, 0.9], a0: 0.9, a1: 0 }); }
  bloodBurst(x, y, z, nx = 0, nz = 0) {
    for (let i = 0; i < 10; i++) this.smoke.emit({ x, y, z, vx: nx * 3 + (Math.random() - .5) * 3, vy: Math.random() * 2.5, vz: nz * 3 + (Math.random() - .5) * 3, life: 0.5, s0: 0.35, s1: 0.2, c0: [0.55, 0.03, 0.05], a0: 0.95, a1: 0.3, g: 9, floor: true });
    this.bloodDecal(x + nx, z + nz, 0.8 + Math.random() * 0.8);
  }
  bloodDecal(x, z, s = 1) {
    const m = new THREE.Mesh(this.decalGeo, this.bloodMat); m.position.set(x, 0.05, z); m.scale.setScalar(s); m.rotation.y = Math.random() * 6; m.renderOrder = 1;
    this.scene.add(m); this.decals.push(m); if (this.decals.length > 50) this.scene.remove(this.decals.shift());
  }
  flash(x, y, z, intensity = 6, dur = 0.06, color = 0xffc070) {
    const f = this.flashLights[this.flashI++ % this.flashLights.length]; f.l.position.set(x, y, z); f.l.intensity = intensity; f.l.color.set(color); f.t = dur; f.max = intensity; f.dur = dur;
  }
  muzzleFlash(x, y, z, dx, dz, big = false) {
    this.muzzle.position.set(x, y, z); this.muzzle.visible = true; this.muzzleT = 0.05; this.muzzle.scale.setScalar(big ? 2 : 1.2); this.muzzle.rotation.z = Math.random() * 6;
    for (let i = 0; i < (big ? 10 : 5); i++) this.glow.emit({ x, y, z, vx: dx * (8 + Math.random() * 10) + (Math.random() - .5) * 2, vy: Math.random(), vz: dz * (8 + Math.random() * 10) + (Math.random() - .5) * 2, life: 0.06 + Math.random() * 0.05, s0: big ? 1.4 : 0.8, s1: 0.2, c0: [1, 0.9, 0.5], c1: [1, 0.5, 0.1], a0: 1, a1: 0, floor: false });
    this.smoke.emit({ x, y, z, vx: dx * 2, vy: 0.6, vz: dz * 2, life: 0.8, s0: 0.5, s1: 2, c0: [0.8, 0.8, 0.8], a0: 0.3, a1: 0, drag: 2 });
    this.flash(x, y + 0.5, z, big ? 14 : 9, 0.07);
  }
  tracer(x0, y0, z0, x1, y1, z1) { this.tracers.push({ a: [x0, y0, z0], b: [x1, y1, z1], t: 0.07 }); if (this.tracers.length > 64) this.tracers.shift(); }
  shell(x, y, z, dx, dz) {
    if (this.shells.length >= this.shellMax) this.shells.shift();
    this.shells.push({ x, y, z, vx: dx * (2 + Math.random() * 1.5) + (Math.random() - .5), vy: 2.5 + Math.random() * 1.5, vz: dz * (2 + Math.random() * 1.5) + (Math.random() - .5), rx: Math.random() * 6, ry: Math.random() * 6, spin: 15 + Math.random() * 20, rest: false, bounces: 0, life: 0 });
  }
  addDebris(mesh, x, y, z, vx, vy, vz) {
    this.scene.add(mesh); mesh.position.set(x, y, z);
    this.debris.push({ mesh, vx, vy, vz, wx: (Math.random() - .5) * 8, wz: (Math.random() - .5) * 8, life: 0 });
    if (this.debris.length > 40) { const d = this.debris.shift(); this.scene.remove(d.mesh); }
  }
  explosion(x, z, onShake) {
    for (let i = 0; i < 40; i++) this.glow.emit({ x, y: 1, z, vx: (Math.random() - .5) * 14, vy: 2 + Math.random() * 8, vz: (Math.random() - .5) * 14, life: 0.6 + Math.random() * 0.5, s0: 4, s1: 1, c0: [1, 0.85, 0.4], c1: [0.9, 0.2, 0.02], a0: 1, a1: 0, drag: 2.5 });
    for (let i = 0; i < 30; i++) this.smoke.emit({ x: x + (Math.random() - .5) * 3, y: 1.5, z: z + (Math.random() - .5) * 3, vx: (Math.random() - .5) * 6, vy: 2 + Math.random() * 4, vz: (Math.random() - .5) * 6, life: 2.5 + Math.random() * 2, s0: 3, s1: 9, c0: [0.15, 0.13, 0.12], a0: 0.85, a1: 0, drag: 1.2 });
    this.sparks(x, 1, z, 40); this.flash(x, 3, z, 40, 0.35, 0xff9a40); onShake && onShake(1.2);
    this.bloodMat; // no-op
  }
  update(dt) {
    this.smoke.update(dt); this.glow.update(dt);
    for (const f of this.flashLights) if (f.t > 0) { f.t -= dt; f.l.intensity = Math.max(0, f.max * (f.t / f.dur)); } else f.l.intensity = 0;
    if (this.muzzleT > 0) { this.muzzleT -= dt; if (this.muzzleT <= 0) this.muzzle.visible = false; }
    // mermi izleri
    let n = 0;
    this.tracers = this.tracers.filter(t => (t.t -= dt) > 0);
    for (const t of this.tracers) { this.trPos.set(t.a, n * 6); this.trPos.set(t.b, n * 6 + 3); n++; }
    this.trGeo.setDrawRange(0, n * 2); this.trGeo.attributes.position.needsUpdate = true;
    // kovanlar
    let i = 0;
    for (const s of this.shells) {
      s.life += dt;
      if (!s.rest) {
        s.vy -= 18 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.rx += s.spin * dt; s.ry += s.spin * 0.7 * dt;
        if (s.y < 0.06) { s.y = 0.06; s.vy = -s.vy * 0.45; s.vx *= 0.6; s.vz *= 0.6; s.spin *= 0.5; s.bounces++; if (s.bounces > 3) { s.rest = true; s.rx = Math.PI / 2; } if (s.bounces === 1 && this.onShellTink) this.onShellTink(s.x, s.z); }
      }
      this._q.setFromEuler(new THREE.Euler(s.rx, s.ry, 0)); this._m.compose(this._p.set(s.x, s.y, s.z), this._q, this._s);
      this.shellMesh.setMatrixAt(i++, this._m);
    }
    this.shellMesh.count = i; this.shellMesh.instanceMatrix.needsUpdate = true;
    // enkaz
    for (const d of this.debris) {
      d.life += dt; if (d.mesh.position.y > 0.1 || d.vy > 0) {
        d.vy -= 18 * dt; d.mesh.position.x += d.vx * dt; d.mesh.position.y += d.vy * dt; d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += d.wx * dt; d.mesh.rotation.z += d.wz * dt;
        if (d.mesh.position.y < 0.1) { d.mesh.position.y = 0.1; d.vy = -d.vy * 0.3; d.vx *= 0.5; d.vz *= 0.5; d.wx *= 0.4; d.wz *= 0.4; if (Math.abs(d.vy) < 1) d.vy = 0; }
      }
    }
  }
}
