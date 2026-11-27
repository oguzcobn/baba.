// Ortak malzemeler + gece ışıklı pencere maskeleri
import * as THREE from 'three';
import * as T from '../engine/textures.js';

export const nightMats = [];   // gece emissive yoğunluğu değişen malzemeler
export const lampMats = [];    // lamba başları
const mcache = new Map();

function maskFrom(dayTex, nightTex) {
  const a = dayTex.image, b = nightTex.image, w = a.width, h = a.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
  const da = a.getContext('2d').getImageData(0, 0, w, h).data, nb = b.getContext('2d').getImageData(0, 0, w, h);
  const d = nb.data;
  for (let i = 0; i < d.length; i += 4) {
    const diff = Math.abs(d[i] - da[i]) + Math.abs(d[i + 1] - da[i + 1]) + Math.abs(d[i + 2] - da[i + 2]);
    if (diff < 40) { d[i] = d[i + 1] = d[i + 2] = 0; }
  }
  ctx.putImageData(nb, 0, 0);
  return T.toTex(c);
}

export function lambert(key, tex, opts = {}) {
  if (mcache.has(key)) return mcache.get(key);
  const m = new THREE.MeshLambertMaterial({ map: tex, ...opts });
  mcache.set(key, m); return m;
}

export function litMat(key, dayTex, nightTex) {
  if (mcache.has(key)) return mcache.get(key);
  const m = new THREE.MeshLambertMaterial({ map: dayTex, emissive: 0xffffff, emissiveMap: maskFrom(dayTex, nightTex), emissiveIntensity: 0 });
  nightMats.push(m); mcache.set(key, m); return m;
}

export const M = {};
export function initMaterials() {
  M.road = lambert('road', T.roadTex());
  M.inter = lambert('inter', T.intersectionTex());
  M.side = lambert('side', T.sidewalkTex());
  M.curb = lambert('curb', T.curbTex());
  M.grass = lambert('grass', T.grassTex());
  M.sand = lambert('sand', T.sandTex());
  M.dirt = lambert('dirt', T.dirtTex());
  M.conc = lambert('conc', T.concreteTex());
  M.parking = lambert('parking', T.concreteTex(true));
  M.plaza = lambert('plaza', T.plazaTex());
  M.roofFlat = lambert('rf1', T.roofTex('flat', '#6d6a66', 0));
  M.roofFlat2 = lambert('rf2', T.roofTex('flat', '#55585c', 1));
  M.roofMetal = lambert('rm', T.roofTex('metal', '#8a9096', 0));
  M.roofMetal2 = lambert('rm2', T.roofTex('metal', '#7e6a5a', 1));
  M.shingles = ['#5b4a45', '#3f4a5a', '#6b3b32', '#4a4f45', '#7a5a46'].map((c, i) => lambert('sh' + i, T.roofTex('shingle', c, i)));
  M.metalBox = lambert('mbox', T.upperFacadeTex('metal', '#9aa3a8', 0));
  M.bark = lambert('bark', T.barkTex());
  M.foliage = ['#4f7d3a', '#5d8a3f', '#3f6e3a', '#6b8f45'].map((c, i) => {
    const m = lambert('fol' + i, T.foliageTex(c));
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = M.windTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 wp = modelMatrix * vec4(position,1.0);
         float sway = sin(uTime*1.3 + wp.x*0.15 + wp.z*0.11) * 0.25 * max(0.0, position.y - 2.0) * 0.25;
         transformed.x += sway; transformed.z += sway*0.6;`);
    };
    return m;
  });
  M.windTime = { value: 0 };
  M.pole = new THREE.MeshLambertMaterial({ color: 0x3b4046 });
  M.lampHead = new THREE.MeshLambertMaterial({ color: 0x2c2f33, emissive: 0xffd28a, emissiveIntensity: 0 });
  lampMats.push(M.lampHead);
  M.wood = new THREE.MeshLambertMaterial({ color: 0x7a5a3e });
  M.red = new THREE.MeshLambertMaterial({ color: 0xb8312f });
  M.darkMetal = new THREE.MeshLambertMaterial({ color: 0x3a3f44 });
  M.white = new THREE.MeshLambertMaterial({ color: 0xf0ede6 });
  M.fence = new THREE.MeshLambertMaterial({ color: 0xe9e4d8 });
  M.rock = lambert('rock', T.concreteTex());
  M.rock.color = new THREE.Color(0x8d8576);
  M.hedge = lambert('hedge', T.foliageTex('#3d6a32'));
  M.water = new THREE.MeshPhongMaterial({ map: T.waterTex(), color: 0x9fd6e0, transparent: true, opacity: 0.92, shininess: 90, specular: 0x88aaaa });
  M.water.map.repeat.set(60, 12);
  M.lightPool = new THREE.MeshBasicMaterial({ map: T.lightPoolTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  M.lightPool.userData.noShadow = true;
}
