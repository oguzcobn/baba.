// Özel haritalar: Deplasman şehri (stadyumlu küçük şehir) ve Ulusal Park Kamp Alanı
import * as THREE from 'three';
import { Batcher } from '../engine/batch.js';
import { StaticGrid } from '../physics/collide.js';
import * as T from '../engine/textures.js';
import { M, initMaterials, lambert } from './materials.js';
import { buildBoston } from './boston.js';

export function buildAway(scene) {
  const w = buildBoston(scene, { kind: 'away', vx: [-320, -160, 0, 160, 320], zone: (i, j) => (i === 1 || i === 2) && (j === 1 || j === 2) ? (i === 2 && j === 2 ? 'stadium' : 'downtown') : (j === 0 ? 'alley' : 'downtown') });
  w.L.busStop = { x: -150, z: 300, name: 'Deplasman Otobüsü' }; w.L.awayGate = { x: w.L.stadium.x, z: w.L.stadium.z, name: 'Stadyum Kapısı' };
  return w;
}

export function buildCamp(scene) {
  initMaterials();
  const group = new THREE.Group(); scene.add(group); const statics = new StaticGrid(24); const b = new Batcher(), gb = new Batcher(); const r = T.rng(77);
  const L = {}; const addCircle = (x, z, rad) => statics.add({ type: 'circle', x, z, r: rad, tag: 'tree' }); const addObb = (x, z, hx, hz, tag = 'bld') => statics.add({ type: 'obb', x, z, hx, hz, a: 0, tag });
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3();
  gb.plane(M.grass, 0, 0, 0, 900, 900, 10, 10);
  // otoyol (güneyden) + toprak kamp yolu
  gb.plane(M.road, 0, 0.02, 190, 14, 300, 14, 14, 0);
  gb.plane(M.dirt, 0, 0.02, 20, 8, 80, 8, 8, 0); gb.plane(M.dirt, 40, 0.02, -10, 80, 8, 8, 8, 0);
  gb.plane(M.parking, 0, 0.025, 55, 26, 16, 6, 6);
  // göl
  const lake = new THREE.Mesh(new THREE.CircleGeometry(48, 40), M.water); lake.rotation.x = -Math.PI / 2; lake.position.set(95, 0.05, -70); group.add(lake); addCircle(95, -70, 40);
  gb.plane(M.sand, 95, 0.015, -70, 110, 110, 10, 10);
  // iskele
  b.box(70, 0.1, -40, 3, 0.25, 14, { side: M.wood, top: M.wood }, { mu: 1, mv: 1, mt: 2 }); L.dock = { x: 64, z: -38, name: 'Balık İskelesi' };
  // orman
  const trunk = new THREE.CylinderGeometry(0.3, 0.45, 5, 6), pine = new THREE.ConeGeometry(2.6, 7, 8);
  for (let k = 0; k < 520; k++) {
    const x = (r() - .5) * 860, z = (r() - .5) * 860;
    if (Math.abs(x) < 14 && z > 30) continue; if (Math.hypot(x - 95, z + 70) < 60) continue; if (Math.hypot(x - 30, z - 10) < 34) continue; if (Math.abs(x + 32) < 22 && Math.abs(z - 220) < 18) continue;
    const s = 0.8 + r() * 0.7; q.identity(); b.geom(M.bark, trunk, mtx.compose(pv.set(x, 2.5 * s, z), q, new THREE.Vector3(s, s, s)));
    b.geom(M.foliage[(r() * 4) | 0], pine, mtx.compose(pv.set(x, 7 * s, z), q, new THREE.Vector3(s, s, s))); addCircle(x, z, 0.6 * s);
  }
  // yol kenarı bar
  const barW = lambert('saloonW', T.sidingTex('#8a6a4a', 2, false)); b.box(-32, 0, 220, 20, 5, 14, { side: barW, top: M.shingles[4] }, { mu: 4, mv: 5 });
  const sg = lambert('saloonSign', (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#3a2210'; x.fillRect(0, 0, 256, 48); x.fillStyle = '#f0c94a'; x.font = 'bold 24px Georgia'; x.textAlign = 'center'; x.fillText('RUSTY SPUR SALOON', 128, 32); return T.toTex(c, { repeat: false }); })());
  b.box(-32, 5, 227.2, 14, 1.6, 0.3, { pz: sg, top: M.darkMetal }, { uFixed: true, vFixed: true }); addObb(-32, 220, 10, 7);
  L.saloon = { x: -24, z: 230, name: 'Yol Üstü Bar' };
  L.campSpot = { x: 30, z: 10, name: 'Kamp Alanı' }; L.parking = { x: 0, z: 55, name: 'Kamp Otoparkı' }; L.entry = { x: 3.5, z: 320, name: 'Otoyol' };
  for (const [x, z] of [[0, -450], [0, 450], [-450, 0], [450, 0]]) addObb(x, z, x ? 6 : 460, x ? 460 : 6, 'edge');
  gb.build(group, { castShadow: false }); b.build(group);
  const nodes = [{ x: 0, z: 330, links: [1], id: 0 }, { x: 0, z: 60, links: [0], id: 1 }];
  const onRoad = (x, z) => Math.abs(x) < 7 && z > 40 && z < 345;
  return { name: 'camp', group, statics, nodes, sidewalkSegs: [], lamps: [], L, parkSpots: [], heightAt: () => 0, onRoad, surfaceAt: (x, z) => onRoad(x, z) ? 'road' : 'dirt', paintMap: (g, ox, oz) => { g.fillStyle = '#3f6a32'; g.fillRect(0, 0, 2000, 2000); g.fillStyle = '#5aa0b8'; g.beginPath(); g.arc(ox + 95, oz - 70, 48, 0, 7); g.fill(); g.fillStyle = '#8b7355'; g.fillRect(ox - 4, oz - 20, 8, 80); }, water: lake, lighthouse: null, bounds: { x0: -450, x1: 450, z0: -450, z1: 450 } };
}
