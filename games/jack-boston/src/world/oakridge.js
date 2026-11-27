// OAKRIDGE KASABASI — prosedürel dokulu harita, yol ağı, kaldırımlar, binalar, sahil, fener, seyir tepesi
import * as THREE from 'three';
import { Batcher } from '../engine/batch.js';
import { StaticGrid } from '../physics/collide.js';
import * as T from '../engine/textures.js';
import { M, initMaterials, litMat, lambert } from './materials.js';

export const VX = [-300, -150, 0, 150, 300];
export const HZ = [-300, -150, 0, 150, 240];
export const ROAD_HW = 7, LANE = 3.5;
const HILL = { x: -368, z: 282, r: 38, h: 5 };

export function heightAt(x, z) {
  const d = Math.hypot(x - HILL.x, z - HILL.z);
  if (d >= HILL.r) return 0;
  const t = d / HILL.r; return d < 8 ? HILL.h : HILL.h * (0.5 + 0.5 * Math.cos(Math.PI * (d - 8) / (HILL.r - 8)));
}

function awningMat(color) {
  return lambert('awn' + color, (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32; const ctx = c.getContext('2d');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? color : '#efe6d4'; ctx.fillRect(i * 8, 0, 8, 32); }
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 26, 64, 6);
    return T.toTex(c);
  })());
}
function signMat(text, bg = '#1f2a33', fg = '#f2e3bd') {
  return lambert('sign' + text, (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48; const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 48); ctx.strokeStyle = '#c9a646'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 250, 42);
    ctx.fillStyle = fg; ctx.font = 'bold 26px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 25);
    return T.toTex(c, { repeat: false });
  })());
}

export function buildOakridge(scene) {
  initMaterials();
  const group = new THREE.Group(); scene.add(group);
  const statics = new StaticGrid(24);
  const chunks = new Map();
  const B = (x, z) => { const k = Math.floor(x / 200) + ',' + Math.floor(z / 200); if (!chunks.has(k)) chunks.set(k, new Batcher()); return chunks.get(k); };
  const ground = new Batcher();
  const lamps = [], sidewalkSegs = [], parkSpots = [], houses = [], trees = [];
  const L = {}; // kilit konumlar
  const r = T.rng(2024);
  const addObb = (x, z, hx, hz, a = 0, tag) => statics.add({ type: 'obb', x, z, hx, hz, a, tag });
  const addCircle = (x, z, rad, tag) => statics.add({ type: 'circle', x, z, r: rad, tag });

  // ---------------- ZEMİN
  ground.plane(M.grass, 0, 0, -60, 860, 720, 10, 10);
  // kıyı kumu ve deniz
  ground.plane(M.sand, 0, 0.012, 285, 860, 70, 10, 10);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 500), M.water);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.06, 548); group.add(water);
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(1400, 6), new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.55, depthWrite: false }));
  shore.rotation.x = -Math.PI / 2; shore.position.set(0, 0.07, 300); group.add(shore);

  // ---------------- YOL AĞI
  const nodes = []; const nodeIdx = new Map();
  const nid = (x, z) => { const k = x + ',' + z; if (!nodeIdx.has(k)) { nodeIdx.set(k, nodes.length); nodes.push({ x, z, links: [], id: nodes.length }); } return nodeIdx.get(k); };
  const link = (a, b) => { nodes[a].links.push(b); nodes[b].links.push(a); };
  for (const z of HZ) {
    const xs = z === 240 ? [-340, ...VX, 340] : VX;
    for (let i = 0; i < xs.length - 1; i++) link(nid(xs[i], z), nid(xs[i + 1], z));
  }
  for (const x of VX) for (let j = 0; j < HZ.length - 1; j++) link(nid(x, HZ[j]), nid(x, HZ[j + 1]));
  const isGrid = (x, z) => VX.includes(x) && HZ.includes(z);

  const SW = { side: M.curb, top: M.side };
  // yatay yollar
  for (const z of HZ) {
    const xs = z === 240 ? [-340, ...VX, 340] : VX;
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1];
      const s = isGrid(xa, z) ? xa + 7 : xa - 7, e = isGrid(xb, z) ? xb - 7 : xb + 7, len = e - s;
      B((s + e) / 2, z).plane(M.road, (s + e) / 2, 0.02, z, 14, len, 14, 14, Math.PI / 2);
      for (const sd of [-1, 1]) {
        const ss = isGrid(xa, z) ? xa + 7 : xa - 7, ee = isGrid(xb, z) ? xb - 7 : xb + 7;
        if (z === 240 && sd === 1 && (xa === -340 || xb === 340)) { } // sahil tarafı
        B((ss + ee) / 2, z).box((ss + ee) / 2, 0, z + sd * 9, ee - ss, 0.15, 4, SW, { mu: 4, mv: 1, mt: 4 });
        sidewalkSegs.push({ ax: ss + 1, az: z + sd * 9, bx: ee - 1, bz: z + sd * 9 });
      }
    }
  }
  // dikey yollar
  for (const x of VX) for (let j = 0; j < HZ.length - 1; j++) {
    const za = HZ[j], zb = HZ[j + 1], s = za + 7, e = zb - 7;
    B(x, (s + e) / 2).plane(M.road, x, 0.02, (s + e) / 2, 14, e - s, 14, 14, 0);
    for (const sd of [-1, 1]) {
      const ss = za + 11, ee = zb - 11;
      B(x, (ss + ee) / 2).box(x + sd * 9, 0, (ss + ee) / 2, 4, 0.15, ee - ss, SW, { mu: 4, mv: 1, mt: 4 });
      sidewalkSegs.push({ ax: x + sd * 9, az: ss - 1, bx: x + sd * 9, bz: ee + 1 });
    }
  }
  // kavşaklar + yaya geçitleri (kaldırım köşeleri arasında)
  for (const x of VX) for (const z of HZ) {
    B(x, z).plane(M.inter, x, 0.03, z, 14, 14, 14, 14, 0, true);
    sidewalkSegs.push({ ax: x - 9, az: z - 9, bx: x + 9, bz: z - 9, cross: true }, { ax: x - 9, az: z + 9, bx: x + 9, bz: z + 9, cross: true },
      { ax: x - 9, az: z - 9, bx: x - 9, bz: z + 9, cross: true }, { ax: x + 9, az: z - 9, bx: x + 9, bz: z + 9, cross: true });
  }
  // çıkmaz uç: fener otoparkı ve tepe yolu
  ground.plane(M.parking, 352, 0.025, 252, 34, 26, 6, 6);
  ground.plane(M.dirt, -362, 0.02, 252, 30, 22, 8, 8);

  // ---------------- SOKAK LAMBALARI
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6); const armGeo = new THREE.BoxGeometry(0.12, 0.12, 2.2); const headGeo = new THREE.BoxGeometry(0.6, 0.25, 0.9);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
  const poolB = new Batcher();
  function lamp(x, z, faceX, faceZ) {
    const b = B(x, z), ang = Math.atan2(faceX, faceZ);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    b.geom(M.pole, lampGeo, mtx.compose(pv.set(x, 3.25, z), q, sc));
    b.geom(M.pole, armGeo, mtx.compose(pv.set(x + faceX * 1.0, 6.4, z + faceZ * 1.0), q, sc));
    b.geom(M.lampHead, headGeo, mtx.compose(pv.set(x + faceX * 2.0, 6.3, z + faceZ * 2.0), q, sc));
    poolB.plane(M.lightPool, x + faceX * 2.4, 0.2, z + faceZ * 2.4, 14, 14, 1, 1, 0, true);
    addCircle(x, z, 0.35, 'pole'); lamps.push({ x: x + faceX * 2, z: z + faceZ * 2 });
  }
  for (const z of HZ) {
    const x0 = z === 240 ? -340 : -300, x1 = z === 240 ? 340 : 300;
    for (let x = x0 + 18; x < x1 - 10; x += 34) { if (VX.some(v => Math.abs(v - x) < 12)) continue; lamp(x, z - 10.4, 0, 1); if (z !== 240 || (x > -300 && x < 300)) lamp(x + 17, z + 10.4, 0, -1); }
  }
  for (const x of VX) for (let z = -282; z < 230; z += 34) { if (HZ.some(v => Math.abs(v - z) < 12)) continue; lamp(x - 10.4, z, 1, 0); lamp(x + 10.4, z + 17, -1, 0); }

  // ---------------- AĞAÇLAR
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6); const folGeo = new THREE.IcosahedronGeometry(2.4, 1);
  function tree(x, z, s = 1) {
    const b = B(x, z), y = heightAt(x, z); q.identity(); const ss = new THREE.Vector3(s, s, s);
    b.geom(M.bark, trunkGeo, mtx.compose(pv.set(x, y + 1.5 * s, z), q, ss));
    const fm = M.foliage[(r() * 4) | 0];
    b.geom(fm, folGeo, mtx.compose(pv.set(x, y + 4.2 * s, z), q.setFromEuler(new THREE.Euler(r(), r(), r())), new THREE.Vector3(s * 1.1, s * 0.95, s * 1.1)));
    b.geom(fm, folGeo, mtx.compose(pv.set(x + 0.9 * s, y + 5.4 * s, z - 0.5 * s), q, new THREE.Vector3(s * 0.75, s * 0.7, s * 0.75)));
    addCircle(x, z, 0.5 * s, 'tree'); trees.push({ x, z });
  }

  // ---------------- BİNALAR
  function parapet(b, cx, cz, w, d, y, mat) {
    b.box(cx, y, cz - d / 2 + 0.2, w, 0.7, 0.4, { side: mat, top: M.conc }, { mu: 6, mv: 3.5 });
    b.box(cx, y, cz + d / 2 - 0.2, w, 0.7, 0.4, { side: mat, top: M.conc }, { mu: 6, mv: 3.5 });
    b.box(cx - w / 2 + 0.2, y, cz, 0.4, 0.7, d - 0.8, { side: mat, top: M.conc }, { mu: 6, mv: 3.5 });
    b.box(cx + w / 2 - 0.2, y, cz, 0.4, 0.7, d - 0.8, { side: mat, top: M.conc }, { mu: 6, mv: 3.5 });
  }
  function roofJunk(b, cx, cz, w, d, y) {
    const n = 1 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const ax = cx + (r() - .5) * (w - 5), az = cz + (r() - .5) * (d - 5);
      b.box(ax, y, az, 1.8, 1.1, 1.4, { side: M.metalBox, top: M.roofMetal }, { mu: 2, mv: 1.1, mt: 2 });
    }
    if (r() < 0.5) b.box(cx + (r() - .5) * (w - 4), y, cz + (r() - .5) * (d - 4), 0.6, 1.4, 0.6, { side: M.darkMetal, top: M.darkMetal });
  }
  const frontKey = { pz: 'pz', nz: 'nz', px: 'px', nx: 'nx' };
  function shop(x0, x1, z0, z1, front, o = {}) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, b = B(cx, cz);
    const floors = o.floors || 1 + ((r() * 3) | 0), color = o.color || T.palettes.brick[(r() * 6) | 0];
    const style = o.style || (r() < 0.6 ? 'brick' : 'paint'); const pcol = style === 'paint' ? T.palettes.paint[(r() * 7) | 0] : color;
    const v = (r() * 15) | 0, aw = o.awning || ['#2f6f5e', '#8e2f2f', '#2f4a7a', '#7a5a2f', '#5a2f6a'][(r() * 5) | 0];
    const up = litMat(`u${style}${pcol}${v % 3}`, T.upperFacadeTex(style, pcol, v % 3), T.upperFacadeTex(style, pcol, v % 3, true));
    const sf = litMat(`s${color}${v}${o.name}${aw}`, T.storefrontTex(color, v, o.name, aw), T.storefrontTex(color, v, o.name, aw, true));
    const roof = r() < .5 ? M.roofFlat : M.roofFlat2;
    const mats = { side: up }; mats[frontKey[front]] = sf;
    const gh = 4, uh = (floors - 1) * 3.5;
    b.box(cx, 0, cz, w, gh, d, floors === 1 ? { ...mats, top: roof } : mats, { mu: 6, mv: gh });
    if (floors > 1) b.box(cx, gh, cz, w, uh, d, { side: up, top: roof }, { mu: 6, mv: 3.5 });
    const H = gh + uh; parapet(b, cx, cz, w, d, H, up); roofJunk(b, cx, cz, w, d, H);
    // 3B tente
    const awm = awningMat(aw);
    if (!o.noAwning) {
      if (front === 'pz') b.box(cx, 2.9, z1 + 0.8, w - 1, 0.18, 1.6, { side: awm, top: awm }, { mu: 1, mv: 1, mt: 1, uFixed: true, vFixed: true });
      if (front === 'nz') b.box(cx, 2.9, z0 - 0.8, w - 1, 0.18, 1.6, { side: awm, top: awm }, { mu: 1, mv: 1, mt: 1 });
      if (front === 'px') b.box(x1 + 0.8, 2.9, cz, 1.6, 0.18, d - 1, { side: awm, top: awm }, { mu: 1, mv: 1, mt: 1 });
      if (front === 'nx') b.box(x0 - 0.8, 2.9, cz, 1.6, 0.18, d - 1, { side: awm, top: awm }, { mu: 1, mv: 1, mt: 1 });
    }
    if (o.sign) {
      const sm = signMat(o.sign); const sw = Math.min(w - 2, 14);
      if (front === 'pz') b.box(cx, H - 0.2, z1 + 0.1, sw, 1.6, 0.3, { pz: sm, top: M.darkMetal }, { uFixed: true, vFixed: true });
      if (front === 'nz') b.box(cx, H - 0.2, z0 - 0.1, sw, 1.6, 0.3, { nz: sm, top: M.darkMetal }, { uFixed: true, vFixed: true });
      if (front === 'px') b.box(x1 + 0.1, H - 0.2, cz, 0.3, 1.6, sw, { px: sm, top: M.darkMetal }, { uFixed: true, vFixed: true });
      if (front === 'nx') b.box(x0 - 0.1, H - 0.2, cz, 0.3, 1.6, sw, { nx: sm, top: M.darkMetal }, { uFixed: true, vFixed: true });
    }
    addObb(cx, cz, w / 2, d / 2, 0, 'bld');
    return { cx, cz, w, d, H };
  }

  function gableRoof(b, cx, cz, W, D, y, rot, mat, rh = 3, ov = 0.6) {
    const cs = Math.cos(rot), sn = Math.sin(rot); const R = (lx, ly, lz) => [cx + lx * cs + lz * sn, y + ly, cz - lx * sn + lz * cs];
    const hw = W / 2 + ov, hd = D / 2 + ov;
    for (const s of [1, -1]) { // ön/arka eğim
      const a = R(-hw, 0, s * hd), bb = R(hw, 0, s * hd), c = R(hw, rh, 0), dd = R(-hw, rh, 0);
      const uu = W / 4, vv = Math.hypot(rh, hd) / 4;
      if (s > 0) { b.tri(mat, a, bb, c, [0, 0], [uu, 0], [uu, vv]); b.tri(mat, a, c, dd, [0, 0], [uu, vv], [0, vv]); }
      else { b.tri(mat, bb, a, dd, [0, 0], [uu, 0], [uu, vv]); b.tri(mat, bb, dd, c, [0, 0], [uu, vv], [0, vv]); }
    }
    return R;
  }
  function house(cx, cz, rot, o = {}) {
    const b = B(cx, cz), W = 12, D = 9, floors = o.floors || (r() < 0.45 ? 2 : 1), H = floors * 3;
    const col = o.color || T.palettes.siding[(r() * 8) | 0], v = (r() * 4) | 0;
    const win = litMat(`hw${col}${v}`, T.sidingTex(col, v, false), T.sidingTex(col, v, false, true));
    const door = litMat(`hd${col}${v}`, T.sidingTex(col, v, true), T.sidingTex(col, v, true, true));
    const cs = Math.cos(rot), sn = Math.sin(rot); const R = (lx, lz) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs];
    b.box(cx, 0, cz, W, H, D, { px: win, nx: win, nz: win }, { mu: 4, mv: 3, rot });
    // ön cephe: pencere | kapı | pencere
    const [nx, nz] = [sn, cs], [rx, rz] = [cs, -sn];
    for (let f = 0; f < floors; f++) for (let k = -1; k <= 1; k++) {
      const [px, pz] = R(k * 4, D / 2 + 0.01);
      b.quad(k === 0 && f === 0 ? door : win, [px, f * 3 + 1.5, pz], [nx, 0, nz], [rx, 0, rz], [0, 1, 0], 2, 1.5, 1, 1);
    }
    const roofM = M.shingles[o.roofIdx ?? ((r() * 5) | 0)];
    const RR = gableRoof(b, cx, cz, W, D, H, rot, roofM);
    // üçgen alınlıklar
    for (const s of [1, -1]) b.tri(win, RR(s * W / 2, 0, s * D / 2), RR(s * W / 2, 0, -s * D / 2), RR(s * W / 2, 3, 0), [0, 0], [D / 4, 0], [D / 8, 0.9]);
    // veranda basamağı
    const [sx, sz] = R(0, D / 2 + 0.9); b.box(sx, 0, sz, 3.5, 0.3, 1.8, { side: M.conc, top: M.conc }, { rot, mu: 2, mv: 1, mt: 2 });
    addObb(cx, cz, W / 2, D / 2, rot, 'bld');
    const [dx, dz] = R(0, D / 2 + 2.5);
    const h = { cx, cz, rot, door: { x: dx, z: dz } }; houses.push(h); return h;
  }
  function fence(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0); const b = B((x0 + x1) / 2, (z0 + z1) / 2);
    b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, 0.15, 1.1, len, { side: M.fence, top: M.fence }, { rot: ang, mu: 1, mv: 1 });
    addObb((x0 + x1) / 2, (z0 + z1) / 2, 0.1, len / 2, ang, 'fence');
  }
  function warehouse(cx, cz, w, d, h, front, o = {}) {
    const b = B(cx, cz), col = o.color || T.palettes.metal[(r() * 5) | 0];
    const wm = lambert('wh' + col, T.upperFacadeTex('metal', col, 0));
    b.box(cx, 0, cz, w, h, d, { side: wm, top: r() < .5 ? M.roofMetal : M.roofMetal2 }, { mu: 6, mv: h, mt: 10 });
    const doorM = lambert('rolldoor', (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#6c7177'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 64; i += 4) { x.fillStyle = '#50555a'; x.fillRect(0, i, 64, 1.5); } x.fillStyle = '#e0b532'; x.fillRect(0, 60, 64, 4); return T.toTex(c); })());
    const nDoor = Math.max(1, Math.floor((front === 'pz' || front === 'nz' ? w : d) / 12));
    for (let i = 0; i < nDoor; i++) {
      const t = (i + 0.5) / nDoor - 0.5;
      if (front === 'pz') b.quad(doorM, [cx + t * w, 2.5, cz + d / 2 + 0.02], [0, 0, 1], [1, 0, 0], [0, 1, 0], 2.5, 2.5);
      if (front === 'nz') b.quad(doorM, [cx + t * w, 2.5, cz - d / 2 - 0.02], [0, 0, -1], [-1, 0, 0], [0, 1, 0], 2.5, 2.5);
      if (front === 'px') b.quad(doorM, [cx + w / 2 + 0.02, 2.5, cz + t * d], [1, 0, 0], [0, 0, -1], [0, 1, 0], 2.5, 2.5);
      if (front === 'nx') b.quad(doorM, [cx - w / 2 - 0.02, 2.5, cz + t * d], [-1, 0, 0], [0, 0, 1], [0, 1, 0], 2.5, 2.5);
    }
    if (o.sign) { const sm = signMat(o.sign, '#2a2f35', '#f0c94a'); if (front === 'pz') b.box(cx, h - 2, cz + d / 2 + 0.1, 14, 1.8, 0.3, { pz: sm }, { uFixed: true, vFixed: true }); if (front === 'nx') b.box(cx - w / 2 - 0.1, h - 2, cz, 0.3, 1.8, 14, { nx: sm }, { uFixed: true, vFixed: true }); if (front === 'px') b.box(cx + w / 2 + 0.1, h - 2, cz, 0.3, 1.8, 14, { px: sm }, { uFixed: true, vFixed: true }); }
    // çatı vantilatörleri
    for (let i = 0; i < 3; i++) b.box(cx + (r() - .5) * (w - 4), h, cz + (r() - .5) * (d - 4), 1.2, 0.8, 1.2, { side: M.metalBox, top: M.darkMetal }, { mu: 1.2, mv: .8 });
    addObb(cx, cz, w / 2, d / 2, 0, 'bld');
  }
  function lot(i, j) { return { x0: VX[i] + 11, x1: VX[i + 1] - 11, z0: HZ[j] + 11, z1: HZ[j + 1] - 11 }; }

  // ---- banliyö bloğu
  function suburb(i, j, special = {}) {
    const { x0, x1, z0, z1 } = lot(i, j); const out = [];
    ground.plane(M.grass, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 10, 10);
    const deep = z1 - z0 > 100;
    // güney (ön +z) ve kuzey (ön -z) sıraları
    for (let x = x0 + 12; x <= x1 - 12; x += 21) {
      const hS = house(x, z1 - 10.5, 0, special.south?.(x)); out.push({ h: hS, side: 'S', x });
      B(x, z1).plane(M.conc, x + 4.5, 0.02, z1 - 3, 3, 6, 3, 3);
      if (deep) { const hN = house(x, z0 + 10.5, Math.PI); out.push({ h: hN, side: 'N', x }); }
      if (r() < 0.6) tree(x + 9, z1 - 4 - r() * 3, 0.8 + r() * 0.4);
      if (deep && r() < 0.5) tree(x - 8, z0 + 4, 0.9);
    }
    if (deep) {
      // yan sıralar
      for (let z = z0 + 38; z <= z1 - 38; z += 22) { house(x0 + 10.5, z, -Math.PI / 2); house(x1 - 10.5, z, Math.PI / 2); }
      // arka bahçe çitleri ve ağaçlar
      fence(x0 + 22, z0 + 26, x1 - 22, z0 + 26); fence(x0 + 22, z1 - 26, x1 - 22, z1 - 26);
      for (let k = 0; k < 10; k++) tree(x0 + 28 + r() * (x1 - x0 - 56), z0 + 32 + r() * (z1 - z0 - 64), 0.9 + r() * 0.5);
    }
    return out;
  }
  // ---- dükkan bloğu
  function shops(i, j, o = {}) {
    const { x0, x1, z0, z1 } = lot(i, j);
    ground.plane(M.parking, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 5, 5);
    const D = 18, deep = z1 - z0 > 100;
    const fillRow = (a, b2, fn, fixed = []) => {
      let p = a;
      for (const f of fixed) { if (f.from > p + 4) { const segs = fillGap(p, f.from); segs.forEach(fn); } fn(f); p = f.to; }
      fillGap(p, b2).forEach(fn);
    };
    const fillGap = (a, b2) => { const out = []; let p = a; while (b2 - p > 8) { let w = 12 + r() * 12; if (b2 - p - w < 10) w = b2 - p; if (r() < 0.12 && out.length) { p += 6; continue; } out.push({ from: p, to: p + w }); p += w; } return out; };
    fillRow(x0, x1, s => shop(s.from, s.to, z1 - D, z1, 'pz', s.o || {}), o.south || []);
    if (deep) fillRow(x0, x1, s => shop(s.from, s.to, z0, z0 + D, 'nz', s.o || {}), o.north || []);
    const za = deep ? z0 + D + 6 : z0, zb = z1 - D - 6;
    if (zb - za > 20) {
      fillRow(za, zb, s => shop(x0, x0 + D, s.from, s.to, 'nx', s.o || {}), []);
      fillRow(za, zb, s => shop(x1 - D, x1, s.from, s.to, 'px', s.o || {}), o.east || []);
    }
    // arka avlu: çöp konteynerleri + park yerleri
    for (let k = 0; k < 4; k++) { const dx = x0 + 26 + r() * (x1 - x0 - 52), dz = (z0 + z1) / 2 + (r() - .5) * 30; B(dx, dz).box(dx, 0, dz, 2.4, 1.4, 1.4, { side: lambert('dump', T.upperFacadeTex('metal', '#3f6a4a', 1)), top: M.darkMetal }, { mu: 2.4, mv: 1.4 }); addObb(dx, dz, 1.2, 0.7); }
    if (deep) for (let k = 0; k < 4; k++) parkSpots.push({ x: x0 + 30 + k * 12, z: (z0 + z1) / 2 + 6, a: 0, inner: true });
  }

  // ====== BLOKLAR
  // (0,0) banliyö — Jack'in evi
  const sub00 = suburb(0, 0, { south: (x) => (Math.abs(x - (-232)) < 11 ? { color: '#c9d8e6', floors: 2, roofIdx: 1 } : {}) });
  const jackH = sub00.filter(s => s.side === 'S').sort((a, b) => Math.abs(a.x + 232) - Math.abs(b.x + 232))[0].h;
  L.jackHome = { x: jackH.door.x, z: jackH.door.z + 1, name: 'Jack\'in Evi' };
  // Jack'in garajı (evin yanında)
  {
    const gx = jackH.cx + 11, gz = jackH.cz + 1; const b = B(gx, gz);
    const gm = litMat('garageW', T.sidingTex('#c9d8e6', 1, false), T.sidingTex('#c9d8e6', 1, false, true));
    b.box(gx, 0, gz - 2, 7, 3.2, 7, { side: gm, top: M.shingles[1] }, { mu: 4, mv: 3 });
    addObb(gx, gz - 2, 3.5, 3.5);
    L.garage = { x: gx, z: gz + 6, name: 'Garaj' };
  }
  // (1,0) Lise
  {
    const { x0, x1, z0, z1 } = lot(1, 0); ground.plane(M.grass, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 10, 10);
    const sb = litMat('school', T.upperFacadeTex('brick', '#9a5a46', 1), T.upperFacadeTex('brick', '#9a5a46', 1, true));
    const b = B(-75, -200); b.box(-75, 0, z1 - 22, 90, 8, 26, { side: sb, top: M.roofFlat }, { mu: 6, mv: 3.5 }); parapet(b, -75, z1 - 22, 90, 26, 8, sb);
    b.box(-75, 8, z1 - 9.2, 22, 2.2, 0.4, { pz: signMat('OAKRIDGE HIGH', '#7a2121', '#f6e7c1') }, { uFixed: true, vFixed: true });
    roofJunk(b, -75, z1 - 22, 90, 26, 8); addObb(-75, z1 - 22, 45, 13);
    ground.plane(M.dirt, -75, 0.015, z0 + 42, 110, 60, 8, 8); ground.plane(M.grass, -75, 0.02, z0 + 42, 90, 42, 10, 10);
    L.school = { x: -75, z: z1 + 3, name: 'Oakridge Lisesi' };
    for (let k = 0; k < 8; k++) tree(x0 + 6 + k * 16, z1 - 4, 0.9);
  }
  // (2,0) Kütüphane + park
  {
    const { x0, x1, z0, z1 } = lot(2, 0); ground.plane(M.grass, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 10, 10);
    const lb = litMat('lib', T.upperFacadeTex('paint', '#d8cdb5', 2), T.upperFacadeTex('paint', '#d8cdb5', 2, true));
    const b = B(75, -200); const lx = 75, lz = z1 - 20;
    b.box(lx, 0, lz, 46, 7.5, 22, { side: lb, top: M.roofFlat2 }, { mu: 6, mv: 3.75 }); parapet(b, lx, lz, 46, 22, 7.5, lb);
    b.box(lx, 7.5, lz + 11.2, 18, 2, 0.4, { pz: signMat('LIBRARY', '#2c3e50', '#f2e3bd') }, { uFixed: true, vFixed: true });
    const colG = new THREE.CylinderGeometry(0.45, 0.5, 6.5, 10);
    for (let k = -3; k <= 3; k++) { b.geom(M.white, colG, mtx.compose(pv.set(lx + k * 4, 3.25, lz + 12.8), q.identity(), sc)); addCircle(lx + k * 4, lz + 12.8, 0.5); }
    b.box(lx, 6.5, lz + 13, 30, 1, 4, { side: M.white, top: M.roofFlat2 }, { mu: 4, mv: 1 });
    b.box(lx, 0, lz + 14.5, 30, 0.5, 3, { side: M.conc, top: M.conc }, { mu: 4, mv: 1 });
    addObb(lx, lz, 23, 11);
    L.library = { x: lx, z: z1 + 3, name: 'Kütüphane' };
    ground.plane(M.plaza, lx, 0.02, z0 + 35, 50, 40, 6, 6);
    for (let k = 0; k < 14; k++) tree(x0 + 8 + r() * (x1 - x0 - 16), z0 + 8 + r() * 45, 0.9 + r() * 0.5);
  }
  // (3,0) banliyö — Jeanine'in evi
  const sub30 = suburb(3, 0, { south: (x) => (Math.abs(x - 232) < 11 ? { color: '#f0e6df', floors: 2, roofIdx: 2 } : {}) });
  const jeanH = sub30.filter(s => s.side === 'S').sort((a, b) => Math.abs(a.x - 232) - Math.abs(b.x - 232))[0].h;
  L.jeanineHome = { x: jeanH.door.x, z: jeanH.door.z + 1, name: 'Jeanine\'in Evi' };
  // (0,1) banliyö
  suburb(0, 1);
  // (1,1) kasaba meydanı
  {
    const { x0, x1, z0, z1 } = lot(1, 1);
    shops(1, 1, {});
    ground.plane(M.plaza, -75, 0.025, -75, 72, 52, 6, 6);
    const b = B(-75, -75); const fG = new THREE.CylinderGeometry(4.5, 5, 0.8, 20); b.geom(M.conc, fG, mtx.compose(pv.set(-75, 0.4, -75), q.identity(), sc));
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.1, 20), M.water); fw.position.set(-75, 0.82, -75); group.add(fw);
    b.geom(M.white, new THREE.CylinderGeometry(0.4, 0.8, 3, 8), mtx.compose(pv.set(-75, 1.5, -75), q, sc)); addCircle(-75, -75, 5.2);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; tree(-75 + Math.cos(a) * 20, -75 + Math.sin(a) * 16, 1); }
    L.square = { x: -75, z: -75, name: 'Kasaba Meydanı' };
  }
  // (2,1) dükkanlar — OAKRIDGE CAFE güney-batı köşesinde, yanında ara sokak
  shops(2, 1, { south: [{ from: 11, to: 33, o: { name: 'OAKRIDGE CAFE', awning: '#9b2d2d', floors: 2, color: '#8e4a3a', sign: 'Oakridge Cafe' } }, { from: 41, to: 60, o: { floors: 2 } }] });
  L.cafe = { x: 22, z: -6.5, name: 'Oakridge Cafe' };
  L.cafeLamp = { x: 26, z: -9.5 };
  L.alley = { x: 37, z: -18, name: 'Ara Sokak' };
  lamp(28, -10.4, 0, 1);
  // (3,1) sanayi: tamirhane + boyahane + buluşma noktası
  {
    const { x0, x1, z0, z1 } = lot(3, 1); ground.plane(M.conc, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 8, 8);
    warehouse(x0 + 18, z0 + 30, 34, 26, 7, 'nx', { sign: 'OAKRIDGE AUTO', color: '#7e8a7a' });
    warehouse(x0 + 18, z1 - 20, 34, 30, 6, 'nx', { sign: 'BOYA & TAMİR', color: '#9d8b72' });
    warehouse(x1 - 30, (z0 + z1) / 2, 50, 70, 9, 'px', {});
    for (let k = 0; k < 5; k++) parkSpots.push({ x: x0 + 48 + k * 9, z: z0 + 12, a: Math.PI / 2, inner: true });
    L.meetup = { x: 166, z: -62, name: 'Sanayi Buluşma' };
    L.spray = { x: 165, z: -31, name: 'Boyahane (Aranma Sıfırla)' };
  }
  // (0,2) park
  {
    const { x0, x1, z0, z1 } = lot(0, 2); ground.plane(M.grass, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 10, 10);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(16, 32), M.water); pond.rotation.x = -Math.PI / 2; pond.position.set(-225, 0.05, 75); group.add(pond);
    addCircle(-225, 75, 15);
    ground.plane(M.dirt, -225, 0.02, 75, 4, 120, 4, 8);
    for (let k = 0; k < 40; k++) { const tx = x0 + 5 + r() * (x1 - x0 - 10), tz = z0 + 5 + r() * (z1 - z0 - 10); if (Math.hypot(tx + 225, tz - 75) < 20 || Math.abs(tx + 225) < 4) continue; tree(tx, tz, 0.9 + r() * 0.6); }
    L.park = { x: -225, z: 75, name: 'Park' };
  }
  // (1,2) karakol + dükkanlar
  shops(1, 2, { south: [{ from: -139, to: -105, o: { name: 'POLICE', sign: 'OAKRIDGE PD', awning: '#2f4a7a', floors: 2, color: '#6a5a50' } }] });
  L.police = { x: -122, z: 145, name: 'Karakol' };
  // (2,2) dükkanlar
  shops(2, 2, {});
  // (3,2) otobüs deposu
  {
    const { x0, x1, z0, z1 } = lot(3, 2); ground.plane(M.parking, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 6, 6);
    warehouse(x1 - 26, z0 + 40, 44, 70, 10, 'nx', { sign: 'BUS DEPOT', color: '#6f7f8e' });
    const busTex = lambert('bus', (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#e8b730'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#2b3a49'; for (let i = 8; i < 250; i += 30) x.fillRect(i, 8, 24, 22); x.fillStyle = '#222'; x.fillRect(0, 50, 256, 4); return T.toTex(c, { repeat: false }); })());
    for (let k = 0; k < 4; k++) { const bx = x0 + 14 + k * 9, bz = z1 - 24; B(bx, bz).box(bx, 0.3, bz, 3, 3.2, 12, { side: busTex, top: M.roofFlat2 }, { uFixed: true, vFixed: true }); addObb(bx, bz, 1.5, 6); }
    L.busDepot = { x: x0 + 32, z: z0 + 20, name: 'Otobüs Deposu' };
  }
  // (0,3) sahil evleri
  {
    const { x0, x1, z0, z1 } = lot(0, 3); ground.plane(M.grass, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 10, 10);
    for (let x = x0 + 12; x <= x1 - 12; x += 22) house(x, z0 + 12, Math.PI);
    for (let k = 0; k < 8; k++) tree(x0 + 8 + r() * (x1 - x0 - 16), z1 - 8 - r() * 20, 0.8 + r() * 0.4);
  }
  // (1,3) Simena Books
  shops(1, 3, { south: [{ from: -110, to: -90, o: { name: 'SIMENA BOOKS', sign: 'Simena Books', awning: '#2f6f5e', floors: 2, color: '#7c4134' } }] });
  L.books = { x: -100, z: 233, name: 'Simena Books' };
  shops(2, 3, {});
  // (3,3) balıkçı depoları
  { const { x0, x1, z0, z1 } = lot(3, 3); ground.plane(M.conc, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, x1 - x0, z1 - z0, 8, 8); warehouse(x0 + 30, (z0 + z1) / 2, 50, 50, 7, 'pz', { color: '#7e8a7a' }); warehouse(x1 - 30, (z0 + z1) / 2, 44, 50, 6, 'pz', {}); }

  // ---- harita dışı: tarlalar ve orman
  for (let k = 0; k < 160; k++) {
    let tx = (r() - .5) * 840, tz = -410 + r() * 680;
    if (Math.abs(tx) < 318 && tz > -318 && tz < 258) continue;
    if (tz > 250 && Math.abs(tx) < 345) continue;
    if (Math.hypot(tx - 360, tz - 275) < 30) continue;
    if (Math.hypot(tx - HILL.x, tz - HILL.z) < 14) continue;
    tree(tx, tz, 0.9 + r() * 0.7);
  }
  // sahil: banklar ve palmiye benzeri ağaçlar
  for (let x = -280; x < 300; x += 46) tree(x, 256, 0.9);

  // ---- SEYİR TEPESİ
  {
    const g = new THREE.PlaneGeometry(HILL.r * 2.1, HILL.r * 2.1, 40, 40); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i) + HILL.x, p.getZ(i) + HILL.z) + 0.03);
    g.computeVertexNormals(); g.translate(HILL.x, 0, HILL.z);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 8);
    ground.geom(M.grass, g, new THREE.Matrix4());
    const b = B(HILL.x, HILL.z);
    b.box(HILL.x + 2, HILL.h, HILL.z + 3, 3, 0.5, 0.8, { side: M.wood, top: M.wood }, { mu: 1, mv: 1 });
    tree(HILL.x - 5, HILL.z - 4, 1.3);
    L.hilltop = { x: HILL.x, z: HILL.z + 1, name: 'Seyir Tepesi' };
  }

  // ---- SAHİL FENERİ
  const lighthouse = new THREE.Group(); lighthouse.position.set(368, 0, 280); group.add(lighthouse);
  {
    const rockG = new THREE.CylinderGeometry(13, 16, 1.5, 12); const rock = new THREE.Mesh(rockG, M.rock); rock.position.y = 0.5; rock.receiveShadow = true; lighthouse.add(rock);
    const stripe = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#b8312f' : '#f2efe6'; x.fillRect(0, i * 32, 64, 32); } return T.toTex(c); })();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 20, 20, 1, true), new THREE.MeshLambertMaterial({ map: stripe })); tower.position.y = 11.2; tower.castShadow = true; lighthouse.add(tower);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.6, 20), M.darkMetal); cap.position.y = 21.4; lighthouse.add(cap);
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2.4, 16), new THREE.MeshLambertMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 0.3, transparent: true, opacity: 0.85 })); lampRoom.position.y = 22.9; lighthouse.add(lampRoom);
    const dome = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 16), M.red); dome.position.y = 25.2; lighthouse.add(dome);
    const beamTex = T.headlightConeTex();
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(10, 60), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
    beam.rotation.x = -Math.PI / 2; beam.position.set(0, 22.9, 30); const pivot = new THREE.Group(); pivot.position.y = 0; pivot.add(beam); lighthouse.add(pivot);
    lighthouse.userData = { pivot, beam, lampRoom };
    addCircle(368, 280, 4);
    ground.plane(M.dirt, 360, 0.02, 266, 6, 24, 4, 8);
    L.lighthouse = { x: 352, z: 256, name: 'Sahil Feneri' };
  }

  // sınırlar
  addObb(0, -420, 500, 6); addObb(0, 312, 500, 6); addObb(-425, 0, 6, 500); addObb(425, 0, 6, 500);

  // derle
  ground.build(group, { castShadow: false });
  for (const b of chunks.values()) b.build(group);
  const poolGroup = new THREE.Group(); poolB.build(poolGroup, { castShadow: false }); poolGroup.children.forEach(m => { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; }); group.add(poolGroup);

  // trafik park yerleri: yol kenarları (kaldırım dibi)
  for (const z of [-150, 0, 150]) for (const x of [-225, -75, 75, 225]) { parkSpots.push({ x: x + (r() - .5) * 60, z: z - 5.2, a: Math.PI / 2 }); }

  return { group, statics, nodes, sidewalkSegs, lamps, L, parkSpots, heightAt, lighthouse, water, bounds: { x0: -415, x1: 415, z0: -410, z1: 305 } };
}
