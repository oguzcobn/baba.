// Statik dünya geometrisini malzemeye göre birleştiren toplayıcı (az draw call = 60 FPS)
import * as THREE from 'three';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();

export class Batcher {
  constructor() { this.groups = new Map(); }
  g(mat) {
    let b = this.groups.get(mat);
    if (!b) { b = { pos: [], nor: [], uv: [], idx: [], shadow: true, receive: true }; this.groups.set(mat, b); }
    return b;
  }
  // c: merkez, n: normal, rt: sağ, up: yukarı, hw/hh: yarım boyutlar, u0..u1/v0..v1
  quad(mat, c, n, rt, up, hw, hh, u1 = 1, v1 = 1, u0 = 0, v0 = 0) {
    const b = this.g(mat), o = b.pos.length / 3;
    const pts = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    for (const [sx, sy, u, v] of pts) {
      b.pos.push(c[0] + rt[0] * hw * sx + up[0] * hh * sy, c[1] + rt[1] * hw * sx + up[1] * hh * sy, c[2] + rt[2] * hw * sx + up[2] * hh * sy);
      b.nor.push(n[0], n[1], n[2]); b.uv.push(u, v);
    }
    b.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  tri(mat, a, bb, c, uva, uvb, uvc) {
    const b = this.g(mat), o = b.pos.length / 3;
    const e1 = new THREE.Vector3(bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]), e2 = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = e1.cross(e2).normalize();
    for (const [p, uv] of [[a, uva], [bb, uvb], [c, uvc]]) { b.pos.push(...p); b.nor.push(n.x, n.y, n.z); b.uv.push(...uv); }
    b.idx.push(o, o + 1, o + 2);
  }
  // Eksen hizalı (veya rotY ile döndürülmüş) kutu. mats: {px,nx,pz,nz,py} ; mod: modül boyutları {u: m, v: m, top:m}
  box(x, y, z, w, h, d, mats, opt = {}) {
    const rot = opt.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
    const R = (vx, vz) => [vx * cs + vz * sn, -vx * sn + vz * cs];
    const mu = opt.mu || 4, mv = opt.mv || 3, mt = opt.mt || 8;
    const cy = y + h / 2;
    const faces = [
      ['px', [w / 2, 0], [1, 0], [0, -1], d], ['nx', [-w / 2, 0], [-1, 0], [0, 1], d],
      ['pz', [0, d / 2], [0, 1], [1, 0], w], ['nz', [0, -d / 2], [0, -1], [-1, 0], w],
    ];
    for (const [k, off, nn, rr, fw] of faces) {
      const m = mats[k] || mats.side; if (!m) continue;
      const [ox, oz] = R(off[0], off[1]), [nx, nz] = R(nn[0], nn[1]), [rx, rz] = R(rr[0], rr[1]);
      const uScale = opt.uFixed ? 1 : fw / mu, vScale = opt.vFixed ? 1 : h / mv;
      this.quad(m, [x + ox, cy, z + oz], [nx, 0, nz], [rx, 0, rz], [0, 1, 0], fw / 2, h / 2, uScale, vScale);
    }
    const top = mats.py || mats.top;
    if (top) {
      const [rx, rz] = R(1, 0), [ux, uz] = R(0, -1);
      this.quad(top, [x, y + h, z], [0, 1, 0], [rx, 0, rz], [ux, 0, uz], w / 2, d / 2, opt.topFixed ? 1 : w / mt, opt.topFixed ? 1 : d / mt);
    }
  }
  // yatay düzlem (zemin)
  plane(mat, x, y, z, w, d, mu = 8, mv = 8, rot = 0, fixed = false) {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    this.quad(mat, [x, y, z], [0, 1, 0], [cs, 0, -sn], [-sn, 0, -cs], w / 2, d / 2, fixed ? 1 : w / mu, fixed ? 1 : d / mv);
  }
  geom(mat, geometry, matrix) {
    const b = this.g(mat); const gg = geometry.index ? geometry : geometry;
    const p = gg.attributes.position, nr = gg.attributes.normal, uv = gg.attributes.uv; const o = b.pos.length / 3;
    _nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix); b.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(nr, i).applyMatrix3(_nm).normalize(); b.nor.push(_n.x, _n.y, _n.z);
      if (uv) b.uv.push(uv.getX(i), uv.getY(i)); else b.uv.push(0, 0);
    }
    if (gg.index) for (let i = 0; i < gg.index.count; i++) b.idx.push(o + gg.index.getX(i));
    else for (let i = 0; i < p.count; i++) b.idx.push(o + i);
  }
  build(parent, { castShadow = true } = {}) {
    for (const [mat, b] of this.groups) {
      if (!b.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = castShadow && !mat.userData.noShadow; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh);
    }
    this.groups.clear();
  }
}
