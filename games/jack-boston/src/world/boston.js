// BOSTON — Kampüs (batı), Downtown & Barlar Sokağı (merkez), Arka Mahalleler (kuzeydoğu), Liman (doğu), Stadyum (güney)
import * as THREE from 'three';
import { Batcher } from '../engine/batch.js';
import { StaticGrid } from '../physics/collide.js';
import * as T from '../engine/textures.js';
import { M, initMaterials, litMat, lambert } from './materials.js';

export const BVX = [-480, -320, -160, 0, 160, 320, 480];
export const BHZ = [-480, -320, -160, 0, 160, 320, 480];
const bostonZone = (i, j) => (i <= 1 ? 'campus' : i <= 3 ? (j === 5 && i === 3 ? 'stadium' : 'downtown') : (j <= 1 ? 'alley' : 'harbor'));

function signMat(text, bg = '#1f2a33', fg = '#f2e3bd') {
  return lambert('bsign' + text + bg, (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 48); x.strokeStyle = '#c9a646'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 42); x.fillStyle = fg; x.font = 'bold 24px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 25); return T.toTex(c, { repeat: false }); })());
}
function neonMat(text, col) {
  const m = lambert('neon' + text, (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#120c14'; x.fillRect(0, 0, 256, 48); x.shadowColor = col; x.shadowBlur = 12; x.fillStyle = col; x.font = 'bold 28px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 25); return T.toTex(c, { repeat: false }); })());
  m.emissive = new THREE.Color(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = 0.6; return m;
}

export function buildBoston(scene, cfg = {}) {
  initMaterials();
  const BVX = cfg.vx || [-480, -320, -160, 0, 160, 320, 480], BHZ = cfg.hz || BVX, zoneOf = cfg.zone || bostonZone, kind = cfg.kind || 'boston', E = BVX[BVX.length - 1];
  const group = new THREE.Group(); scene.add(group);
  const statics = new StaticGrid(24); const chunks = new Map();
  const B = (x, z) => { const k = Math.floor(x / 200) + ',' + Math.floor(z / 200); if (!chunks.has(k)) chunks.set(k, new Batcher()); return chunks.get(k); };
  const ground = new Batcher(), poolB = new Batcher();
  const lamps = [], sidewalkSegs = [], parkSpots = [], L = {}; const r = T.rng(1776);
  const addObb = (x, z, hx, hz, a = 0, tag = 'bld') => statics.add({ type: 'obb', x, z, hx, hz, a, tag });
  const addCircle = (x, z, rad, tag) => statics.add({ type: 'circle', x, z, r: rad, tag });
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();

  ground.plane(M.conc, 0, 0, 0, E * 2 + 140, E * 2 + 140, 10, 10);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 1600), M.water); water.rotation.x = -Math.PI / 2; water.position.set(kind === 'boston' ? 870 : 99999, 0.06, 0); group.add(water);

  // ---- yollar
  const nodes = [], nidx = new Map();
  const nid = (x, z) => { const k = x + ',' + z; if (!nidx.has(k)) { nidx.set(k, nodes.length); nodes.push({ x, z, links: [], id: nodes.length }); } return nidx.get(k); };
  const link = (a, b) => { nodes[a].links.push(b); nodes[b].links.push(a); };
  for (const z of BHZ) for (let i = 0; i < BVX.length - 1; i++) link(nid(BVX[i], z), nid(BVX[i + 1], z));
  for (const x of BVX) for (let j = 0; j < BHZ.length - 1; j++) link(nid(x, BHZ[j]), nid(x, BHZ[j + 1]));
  const SW = { side: M.curb, top: M.side };
  for (const z of BHZ) for (let i = 0; i < BVX.length - 1; i++) {
    const s = BVX[i] + 7, e = BVX[i + 1] - 7; B((s + e) / 2, z).plane(M.road, (s + e) / 2, 0.02, z, 14, e - s, 14, 14, Math.PI / 2);
    for (const sd of [-1, 1]) { B((s + e) / 2, z).box((s + e) / 2, 0, z + sd * 9, e - s, 0.15, 4, SW, { mu: 4, mv: 1, mt: 4 }); sidewalkSegs.push({ ax: s + 1, az: z + sd * 9, bx: e - 1, bz: z + sd * 9 }); }
  }
  for (const x of BVX) for (let j = 0; j < BHZ.length - 1; j++) {
    const s = BHZ[j] + 7, e = BHZ[j + 1] - 7; B(x, (s + e) / 2).plane(M.road, x, 0.02, (s + e) / 2, 14, e - s, 14, 14, 0);
    for (const sd of [-1, 1]) { const ss = BHZ[j] + 11, ee = BHZ[j + 1] - 11; B(x, (ss + ee) / 2).box(x + sd * 9, 0, (ss + ee) / 2, 4, 0.15, ee - ss, SW, { mu: 4, mv: 1, mt: 4 }); sidewalkSegs.push({ ax: x + sd * 9, az: ss - 1, bx: x + sd * 9, bz: ee + 1 }); }
  }
  for (const x of BVX) for (const z of BHZ) {
    B(x, z).plane(M.inter, x, 0.03, z, 14, 14, 14, 14, 0, true);
    sidewalkSegs.push({ ax: x - 9, az: z - 9, bx: x + 9, bz: z - 9, cross: true }, { ax: x - 9, az: z + 9, bx: x + 9, bz: z + 9, cross: true }, { ax: x - 9, az: z - 9, bx: x - 9, bz: z + 9, cross: true }, { ax: x + 9, az: z - 9, bx: x + 9, bz: z + 9, cross: true });
  }
  // ---- lambalar
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), armGeo = new THREE.BoxGeometry(0.12, 0.12, 2.2), headGeo = new THREE.BoxGeometry(0.6, 0.25, 0.9);
  function lamp(x, z, fx, fz) {
    const b = B(x, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(fx, fz));
    b.geom(M.pole, lampGeo, mtx.compose(pv.set(x, 3.25, z), q, sc)); b.geom(M.pole, armGeo, mtx.compose(pv.set(x + fx, 6.4, z + fz), q, sc)); b.geom(M.lampHead, headGeo, mtx.compose(pv.set(x + fx * 2, 6.3, z + fz * 2), q, sc));
    poolB.plane(M.lightPool, x + fx * 2.4, 0.2, z + fz * 2.4, 14, 14, 1, 1, 0, true); addCircle(x, z, 0.35, 'pole'); lamps.push({ x, z });
  }
  for (const z of BHZ) for (let x = -462; x < 470; x += 40) { if (BVX.some(v => Math.abs(v - x) < 12)) continue; lamp(x, z - 10.4, 0, 1); lamp(x + 20, z + 10.4, 0, -1); }
  for (const x of BVX) for (let z = -462; z < 470; z += 40) { if (BHZ.some(v => Math.abs(v - z) < 12)) continue; lamp(x - 10.4, z, 1, 0); lamp(x + 10.4, z + 20, -1, 0); }
  // ---- ağaç
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6), folGeo = new THREE.IcosahedronGeometry(2.4, 1);
  function tree(x, z, s = 1) { const b = B(x, z); q.identity(); b.geom(M.bark, trunkGeo, mtx.compose(pv.set(x, 1.5 * s, z), q, new THREE.Vector3(s, s, s))); const fm = M.foliage[(r() * 4) | 0]; b.geom(fm, folGeo, mtx.compose(pv.set(x, 4.2 * s, z), q.setFromEuler(new THREE.Euler(r(), r(), r())), new THREE.Vector3(s * 1.1, s * .95, s * 1.1))); addCircle(x, z, 0.5 * s, 'tree'); }
  // ---- bina yardımcıları
  function parapet(b, cx, cz, w, d, y, mat) { for (const [x, z, ww, dd] of [[cx, cz - d / 2 + .2, w, .4], [cx, cz + d / 2 - .2, w, .4], [cx - w / 2 + .2, cz, .4, d - .8], [cx + w / 2 - .2, cz, .4, d - .8]]) b.box(x, y, z, ww, .7, dd, { side: mat, top: M.conc }, { mu: 6, mv: 3.5 }); }
  function roofJunk(b, cx, cz, w, d, y) { for (let i = 0; i < 1 + ((r() * 4) | 0); i++) b.box(cx + (r() - .5) * (w - 5), y, cz + (r() - .5) * (d - 5), 2, 1.2, 1.6, { side: M.metalBox, top: M.roofMetal }, { mu: 2, mv: 1.2, mt: 2 }); if (w > 20 && r() < .5) { const wx = cx + (r() - .5) * (w - 8), wz = cz + (r() - .5) * (d - 8); b.geom(M.darkMetal, new THREE.CylinderGeometry(1.6, 1.6, 3, 10), mtx.compose(pv.set(wx, y + 3.5, wz), q.identity(), sc)); for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(wx + ox, y, wz + oz, .2, 2, .2, { side: M.darkMetal }, {}); } }
  function shop(x0, x1, z0, z1, front, o = {}) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, b = B(cx, cz);
    const floors = o.floors || 2, style = o.style || (r() < .65 ? 'brick' : 'paint'); const color = o.color || T.palettes.brick[(r() * 6) | 0]; const pcol = style === 'paint' ? (o.pcol || T.palettes.paint[(r() * 7) | 0]) : color;
    const v = (r() * 15) | 0, aw = o.awning || ['#2f6f5e', '#8e2f2f', '#2f4a7a', '#7a5a2f', '#5a2f6a', '#1f1f22'][(r() * 6) | 0];
    const up = litMat(`bu${style}${pcol}${v % 3}`, T.upperFacadeTex(style, pcol, v % 3), T.upperFacadeTex(style, pcol, v % 3, true));
    const sf = litMat(`bs${color}${v}${o.name}${aw}`, T.storefrontTex(color, v, o.name, aw), T.storefrontTex(color, v, o.name, aw, true));
    const roof = r() < .5 ? M.roofFlat : M.roofFlat2; const mats = { side: up }; mats[front] = sf;
    const uh = (floors - 1) * 3.5; b.box(cx, 0, cz, w, 4, d, floors === 1 ? { ...mats, top: roof } : mats, { mu: 6, mv: 4 });
    if (floors > 1) b.box(cx, 4, cz, w, uh, d, { side: up, top: roof }, { mu: 6, mv: 3.5 });
    const H = 4 + uh; parapet(b, cx, cz, w, d, H, up); roofJunk(b, cx, cz, w, d, H);
    if (o.neon) { const nm = neonMat(o.neon, o.neonCol || '#ff4fa0'); if (front === 'pz') b.box(cx, 4.3, z1 + 0.15, Math.min(w - 2, 10), 1.4, 0.2, { pz: nm }, { uFixed: true, vFixed: true }); if (front === 'nz') b.box(cx, 4.3, z0 - 0.15, Math.min(w - 2, 10), 1.4, 0.2, { nz: nm }, { uFixed: true, vFixed: true }); if (front === 'px') b.box(x1 + .15, 4.3, cz, .2, 1.4, Math.min(d - 2, 10), { px: nm }, { uFixed: true, vFixed: true }); if (front === 'nx') b.box(x0 - .15, 4.3, cz, .2, 1.4, Math.min(d - 2, 10), { nx: nm }, { uFixed: true, vFixed: true }); }
    if (o.sign) { const sm = signMat(o.sign, o.signBg); const sw = Math.min(w - 2, 16); if (front === 'pz') b.box(cx, H - .2, z1 + .1, sw, 1.8, .3, { pz: sm }, { uFixed: true, vFixed: true }); if (front === 'nz') b.box(cx, H - .2, z0 - .1, sw, 1.8, .3, { nz: sm }, { uFixed: true, vFixed: true }); if (front === 'px') b.box(x1 + .1, H - .2, cz, .3, 1.8, sw, { px: sm }, { uFixed: true, vFixed: true }); if (front === 'nx') b.box(x0 - .1, H - .2, cz, .3, 1.8, sw, { nx: sm }, { uFixed: true, vFixed: true }); }
    addObb(cx, cz, w / 2, d / 2); return { cx, cz, w, d, H };
  }
  function warehouse(cx, cz, w, d, h, o = {}) {
    const b = B(cx, cz), col = o.color || T.palettes.metal[(r() * 5) | 0]; const wm = lambert('bwh' + col, T.upperFacadeTex('metal', col, 0));
    b.box(cx, 0, cz, w, h, d, { side: wm, top: r() < .5 ? M.roofMetal : M.roofMetal2 }, { mu: 6, mv: h, mt: 10 });
    if (o.sign) b.box(cx, h - 2.2, cz + d / 2 + .1, 16, 2, .3, { pz: signMat(o.sign, '#2a2f35', '#f0c94a') }, { uFixed: true, vFixed: true });
    addObb(cx, cz, w / 2, d / 2);
  }
  const contCols = ['#b8432f', '#2f6a8e', '#c9a646', '#3f7a4a', '#7a3f6a', '#d0d0c8', '#2a4a6a'];
  function containers(x0, z0, cols, rows, stack) {
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = x0 + i * 3.2, z = z0 + j * 13; const n = 1 + ((r() * stack) | 0);
      for (let k = 0; k < n; k++) { const c = contCols[(r() * contCols.length) | 0]; const m = lambert('cont' + c, T.upperFacadeTex('metal', c, 1)); B(x, z).box(x, k * 2.6, z, 2.5, 2.6, 12, { side: m, top: lambert('ctop' + c, T.roofTex('metal', c, 2)) }, { mu: 3, mv: 2.6, mt: 3 }); }
      addObb(x, z, 1.25, 6);
    }
  }
  const lot = (i, j) => ({ x0: BVX[i] + 11, x1: BVX[i + 1] - 11, z0: BHZ[j] + 11, z1: BHZ[j + 1] - 11 });
  function ringRow(i, j, opt = {}) {
    const { x0, x1, z0, z1 } = lot(i, j), D = opt.depth || 20;
    const fill = (a, b2, fn, fixed = []) => { let p = a; const gap = (aa, bb) => { const out = []; let pp = aa; while (bb - pp > 10) { let w = (opt.wMin || 14) + r() * (opt.wVar || 14); if (bb - pp - w < 12) w = bb - pp; out.push({ from: pp, to: pp + w }); pp += w; } return out; }; for (const f of fixed) { gap(p, f.from).forEach(fn); fn(f); p = f.to; } gap(p, b2).forEach(fn); };
    const fl = () => opt.floors ? opt.floors[0] + ((r() * (opt.floors[1] - opt.floors[0] + 1)) | 0) : 2;
    fill(x0, x1, s => shop(s.from, s.to, z1 - D, z1, 'pz', { floors: fl(), ...opt.o, ...(s.o || {}) }), opt.south || []);
    fill(x0, x1, s => shop(s.from, s.to, z0, z0 + D, 'nz', { floors: fl(), ...opt.o, ...(s.o || {}) }), opt.north || []);
    fill(z0 + D + 4, z1 - D - 4, s => shop(x0, x0 + D, s.from, s.to, 'nx', { floors: fl(), ...opt.o, ...(s.o || {}) }), opt.west || []);
    fill(z0 + D + 4, z1 - D - 4, s => shop(x1 - D, x1, s.from, s.to, 'px', { floors: fl(), ...opt.o, ...(s.o || {}) }), opt.east || []);
    return { x0, x1, z0, z1, D };
  }
  // ---- BLOKLAR
  for (let i = 0; i < BVX.length - 1; i++) for (let j = 0; j < BHZ.length - 1; j++) {
    const z = zoneOf(i, j), { x0, x1, z0, z1 } = lot(i, j), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (z === 'campus') {
      ground.plane(M.grass, cx, 0.01, cz, x1 - x0, z1 - z0, 10, 10);
      if (kind === 'boston' && i === 1 && j === 2) { // yurt
        shop(x0 + 4, x1 - 4, z1 - 26, z1, 'pz', { floors: 4, color: '#8e4a3a', name: 'DORM HALL', sign: 'Harlow Hall — Yurt', awning: '#7a2121' });
        L.dorm = { x: cx, z: z1 + 3, name: 'Harlow Hall (Yurt)' };
      } else if (kind === 'boston' && i === 0 && j === 3) {
        shop(x0 + 6, x0 + 40, z0, z0 + 22, 'nz', { floors: 2, color: '#9a6248', name: 'CAMPUS CAFE', sign: 'Elena\'s Corner Café', awning: '#2f6f5e' });
        L.elenaCafe = { x: x0 + 23, z: z0 - 4, name: 'Kampüs Kafesi' };
        ground.plane(M.plaza, cx + 10, 0.02, cz + 20, 70, 60, 6, 6);
      } else {
        const hw = 44 + r() * 20; shop(cx - hw / 2, cx + hw / 2, z1 - 30, z1 - 8, 'pz', { floors: 3, color: T.palettes.brick[(r() * 6) | 0], name: ['LIBRARY', 'SCIENCE', 'HALL', 'ARTS'][(i + j) % 4] });
        ground.plane(M.plaza, cx, 0.02, cz - 20, 20, 60, 6, 6);
      }
      for (let k = 0; k < 12; k++) { const tx = x0 + 8 + r() * (x1 - x0 - 16), tz = z0 + 8 + r() * (z1 - z0 - 50); tree(tx, tz, 1 + r() * .5); }
    } else if (z === 'downtown') {
      ground.plane(M.parking, cx, 0.01, cz, x1 - x0, z1 - z0, 6, 6);
      if (kind === 'boston' && j === 2) { // Barlar Sokağı: z=160 yolunun kuzeyi (blok güney sırası) neon
        const names = [['THE ANCHOR', '#4fd0ff'], ['RED LION', '#ff4f4f'], ['BLUE NOTE', '#4f7fff'], ['MCGEE\'S', '#4fff8f'], ['LUCKY 7', '#ffd04f']];
        ringRow(i, j, { floors: [2, 3], south: [{ from: x0, to: x0 + 22, o: { neon: names[i % 5][0], neonCol: names[i % 5][1], awning: '#1f1f22' } }, { from: x0 + 22, to: x0 + 44, o: { neon: names[(i + 2) % 5][0], neonCol: names[(i + 2) % 5][1], awning: '#1f1f22' } }, { from: x0 + 44, to: x0 + 66, o: { neon: names[(i + 3) % 5][0], neonCol: names[(i + 3) % 5][1], awning: '#1f1f22' } }] });
        if (i === 2) L.bars = { x: x0 + 33, z: z1 + 3, name: 'Barlar Sokağı' };
      } else if (kind === 'boston' && i === 2 && j === 1) {
        ringRow(i, j, { floors: [4, 6], south: [{ from: x0, to: x0 + 26, o: { floors: 5, name: 'STUDIO APTS', sign: 'Downtown Stüdyo', awning: '#2f4a7a' } }] });
        L.studio = { x: x0 + 13, z: z1 + 3, name: 'Downtown Stüdyo Daire' };
      } else ringRow(i, j, { floors: [3, 7], wMin: 18, wVar: 12, depth: 24 });
    } else if (z === 'stadium') {
      ground.plane(M.grass, cx, 0.01, cz, x1 - x0, z1 - z0, 10, 10);
      const g = new THREE.CylinderGeometry(62, 66, 14, 40, 1, true); const sm = lambert('stad', T.upperFacadeTex('paint', '#c8ccd0', 2)); sm.side = THREE.DoubleSide;
      B(cx, cz).geom(sm, g, mtx.compose(pv.set(cx, 7, cz), q.identity(), sc));
      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(70, 46), new THREE.MeshLambertMaterial({ map: T.grassTex(), color: 0x9fd08a })); pitch.rotation.x = -Math.PI / 2; pitch.position.set(cx, 0.05, cz); group.add(pitch);
      for (let a = 0; a < 40; a++) { const an = a / 40 * Math.PI * 2; addObb(cx + Math.cos(an) * 64, cz + Math.sin(an) * 64, 5.5, 1.5, -an + Math.PI / 2); }
      L.stadium = { x: cx, z: z0 - 4, name: 'Stadyum' }; L.stadiumC = { x: cx, z: cz };
    } else if (z === 'alley') {
      ground.plane(M.dirt, cx, 0.01, cz, x1 - x0, z1 - z0, 6, 6);
      const ro = ringRow(i, j, { floors: [2, 4], depth: 22, o: { style: 'brick', awning: '#3a3a3a' }, north: kind === 'boston' && i === 4 && j === 1 ? [{ from: x0 + 30, to: x0 + 56, o: { name: 'FIGHT CLUB', neon: 'THE PIT', neonCol: '#ff6a2a', floors: 2 } }] : [], south: kind === 'boston' && i === 4 && j === 1 ? [{ from: x0 + 40, to: x0 + 62, o: { name: 'PAWN & GUNS', sign: 'Rusty\'s Pawn & Guns', signBg: '#3a1a1a', floors: 2 } }] : kind === 'boston' && i === 5 && j === 1 ? [{ from: x0 + 20, to: x0 + 44, o: { name: 'THE CELLAR', neon: 'CELLAR', neonCol: '#c04fff', floors: 3 } }] : [] });
      if (kind === 'boston' && i === 4 && j === 1) { L.fightClub = { x: x0 + 43, z: z0 - 4, name: 'Yeraltı Dövüş Kulübü' }; L.gunShop = { x: x0 + 51, z: z1 + 3, name: 'Silah Satıcısı' }; }
      if (kind === 'boston' && i === 5 && j === 1) L.vinceBar = { x: x0 + 32, z: z1 + 3, name: 'The Cellar (Vince)' };
      for (let k = 0; k < 6; k++) { const dx = x0 + 30 + r() * (x1 - x0 - 60), dz = z0 + 30 + r() * (z1 - z0 - 60); B(dx, dz).box(dx, 0, dz, 2.4, 1.4, 1.4, { side: lambert('dump', T.upperFacadeTex('metal', '#3f6a4a', 1)), top: M.darkMetal }, { mu: 2.4, mv: 1.4 }); addObb(dx, dz, 1.2, 0.7); }
    } else { // harbor
      ground.plane(M.conc, cx, 0.01, cz, x1 - x0, z1 - z0, 8, 8);
      if ((i + j) % 2) { warehouse(cx - 30, cz, 60, 90, 9, { sign: i === 5 && j === 3 ? 'VINCE IMPORTS' : 'PIER ' + (i * 10 + j), color: i === 5 && j === 3 ? '#6f5a4a' : undefined }); containers(cx + 22, z0 + 10, 9, 8, 3); }
      else { containers(x0 + 6, z0 + 10, 14, 9, 3); }
      if (i === 5 && j === 3) L.vinceDepot = { x: cx - 30, z: cz + 50, name: 'Vince\'in Deposu' };
      if (i === 5 && j === 4) L.harborDrop = { x: cx, z: cz, name: 'Liman Teslimat' };
    }
  }
  if (kind === 'boston') {
  // iskele + vinçler (doğu kıyısı)
  ground.plane(M.conc, 512, 0.02, 0, 40, 980, 8, 8);
  for (let z = -440; z < 460; z += 110) { const b = B(520, z); const cm = lambert('crane', T.upperFacadeTex('metal', '#d9a03a', 0)); for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) b.box(520 + ox, 0, z + oz, 0.8, 22, 0.8, { side: cm, top: cm }, { mu: 1, mv: 4 }); b.box(522, 22, z, 40, 2, 3, { side: cm, top: cm }, { mu: 4, mv: 2 }); addObb(520, z, 4.4, 4.4); }
  addObb(538, 0, 4, 600, 0, 'edge');
  for (const [x, z] of [[0, -520], [0, 520], [-520, 0]]) addObb(x, z, x ? 6 : 600, x ? 600 : 6, 0, 'edge');
  } else for (const [x, z] of [[0, -E - 40], [0, E + 40], [-E - 40, 0], [E + 40, 0]]) addObb(x, z, x ? 6 : E + 60, x ? E + 60 : 6, 0, 'edge');
  // park yerleri
  for (const z of BHZ) for (let x = -E + 60; x < E - 40; x += 160) if (r() < .55) parkSpots.push({ x: x + (r() - .5) * 50, z: z - 5.2, a: Math.PI / 2 });
  if (kind === 'boston') { L.campusHouse = { x: -400, z: 312, name: 'Kampüs Bahçeli Ev' }; L.loft = { x: 210, z: 127.5, name: 'Liman Manzaralı Loft' }; }
  L.arrival = { x: -240, z: 163.5, name: 'Kampüs Girişi' };
  L.leoMeet = { x: -240, z: 172, name: 'Leo' };

  ground.build(group, { castShadow: false }); for (const b of chunks.values()) b.build(group);
  const pg = new THREE.Group(); poolB.build(pg, { castShadow: false }); pg.children.forEach(m => { m.castShadow = m.receiveShadow = false; m.renderOrder = 2; }); group.add(pg);

  const onRoad = (x, z) => { for (const zr of BHZ) if (Math.abs(z - zr) < 7 && Math.abs(x) < E + 7) return true; for (const xr of BVX) if (Math.abs(x - xr) < 7 && Math.abs(z) < E + 7) return true; return false; };
  const surfaceAt = (x, z) => { if (onRoad(x, z)) return 'road'; const i = Math.floor((x + E) / 160), j = Math.floor((z + E) / 160); const zn = zoneOf(i, j); return zn === 'campus' ? 'grass' : zn === 'alley' ? 'dirt' : 'conc'; };
  const paintMap = (g, ox, oz, W, H) => { g.fillStyle = '#8d8e8c'; g.fillRect(0, 0, W, H); if (kind === 'boston') { g.fillStyle = '#6f9a58'; g.fillRect(ox - 480, oz - 480, 320, 960); g.fillStyle = '#5aa0b8'; g.fillRect(ox + 540, 0, W, H); } };
  return { name: kind, group, statics, nodes, sidewalkSegs, lamps, L, parkSpots, heightAt: () => 0, onRoad, surfaceAt, paintMap, water, lighthouse: null, bounds: kind === 'boston' ? { x0: -500, x1: 560, z0: -500, z1: 500 } : { x0: -E - 30, x1: E + 30, z0: -E - 30, z1: E + 30 } };
}
