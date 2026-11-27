// 2D (XZ düzlemi) katı cisim çarpışması: OBB/SAT, daire, statik ızgara.
// Yön: rotation.y = a  => ileri f = (sin a, cos a), sağ r = (cos a, -sin a)

export function axes(a) { const s = Math.sin(a), c = Math.cos(a); return { fx: s, fz: c, rx: c, rz: -s }; }

export function obbCorners(o) {
  const { fx, fz, rx, rz } = axes(o.a); const out = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) out.push({ x: o.x + rx * sx * o.hx + fx * sz * o.hz, z: o.z + rz * sx * o.hx + fz * sz * o.hz });
  return out;
}

function projRadius(o, ax, nx, nz) { return o.hx * Math.abs(ax.rx * nx + ax.rz * nz) + o.hz * Math.abs(ax.fx * nx + ax.fz * nz); }

export function pointInObb(o, px, pz, margin = 0) {
  const { fx, fz, rx, rz } = axes(o.a); const dx = px - o.x, dz = pz - o.z;
  return Math.abs(dx * rx + dz * rz) <= o.hx + margin && Math.abs(dx * fx + dz * fz) <= o.hz + margin;
}

// A'dan B'ye normal döner
export function obbVsObb(A, B) {
  const aA = axes(A.a), aB = axes(B.a);
  const cand = [[aA.rx, aA.rz], [aA.fx, aA.fz], [aB.rx, aB.rz], [aB.fx, aB.fz]];
  let minO = Infinity, nx = 0, nz = 0;
  const dx = B.x - A.x, dz = B.z - A.z;
  for (const [ax, az] of cand) {
    const ra = projRadius(A, aA, ax, az), rb = projRadius(B, aB, ax, az);
    const d = dx * ax + dz * az; const o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (o < minO) { minO = o; const s = d < 0 ? -1 : 1; nx = ax * s; nz = az * s; }
  }
  // temas noktası
  let cx = 0, cz = 0, n = 0;
  for (const p of obbCorners(B)) if (pointInObb(A, p.x, p.z, 0.05)) { cx += p.x; cz += p.z; n++; }
  for (const p of obbCorners(A)) if (pointInObb(B, p.x, p.z, 0.05)) { cx += p.x; cz += p.z; n++; }
  if (n) { cx /= n; cz /= n; } else { cx = (A.x + B.x) / 2; cz = (A.z + B.z) / 2; }
  return { nx, nz, depth: minO, cx, cz };
}

// daire (merkez px,pz, yarıçap rad) vs OBB — normal OBB'den daireye
export function circleVsObb(px, pz, rad, o) {
  const { fx, fz, rx, rz } = axes(o.a); const dx = px - o.x, dz = pz - o.z;
  const lx = dx * rx + dz * rz, lz = dx * fx + dz * fz;
  const cx = Math.max(-o.hx, Math.min(o.hx, lx)), cz = Math.max(-o.hz, Math.min(o.hz, lz));
  let ex = lx - cx, ez = lz - cz; let d2 = ex * ex + ez * ez;
  if (d2 > rad * rad) return null;
  let nlx, nlz, depth;
  if (d2 < 1e-6) { // merkez içeride
    const px_ = o.hx - Math.abs(lx), pz_ = o.hz - Math.abs(lz);
    if (px_ < pz_) { nlx = Math.sign(lx) || 1; nlz = 0; depth = px_ + rad; } else { nlx = 0; nlz = Math.sign(lz) || 1; depth = pz_ + rad; }
  } else { const d = Math.sqrt(d2); nlx = ex / d; nlz = ez / d; depth = rad - d; }
  const nx = nlx * rx + nlz * fx, nz = nlx * rz + nlz * fz;
  const wx = o.x + cx * rx + cz * fx, wz = o.z + cx * rz + cz * fz;
  return { nx, nz, depth, cx: wx, cz: wz };
}

export function circleVsCircle(ax, az, ar, bx, bz, br) {
  const dx = bx - ax, dz = bz - az, d2 = dx * dx + dz * dz, r = ar + br;
  if (d2 >= r * r) return null; const d = Math.sqrt(d2) || 0.0001;
  return { nx: dx / d, nz: dz / d, depth: r - d, cx: ax + dx / d * ar, cz: az + dz / d * ar };
}

// Statik engeller için ızgara
export class StaticGrid {
  constructor(cell = 24) { this.cell = cell; this.map = new Map(); this.items = []; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(item) { // item: {type:'obb', x,z,hx,hz,a} | {type:'circle', x,z,r}
    this.items.push(item);
    const R = item.type === 'circle' ? item.r : Math.hypot(item.hx, item.hz);
    const c = this.cell;
    for (let i = Math.floor((item.x - R) / c); i <= Math.floor((item.x + R) / c); i++)
      for (let j = Math.floor((item.z - R) / c); j <= Math.floor((item.z + R) / c); j++) {
        const k = this.key(i, j); if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(item);
      }
  }
  query(x, z, R, out = []) {
    out.length = 0; const c = this.cell; const seen = this._seen || (this._seen = new Set()); seen.clear();
    for (let i = Math.floor((x - R) / c); i <= Math.floor((x + R) / c); i++)
      for (let j = Math.floor((z - R) / c); j <= Math.floor((z + R) / c); j++) {
        const arr = this.map.get(this.key(i, j)); if (!arr) continue;
        for (const it of arr) if (!seen.has(it)) { seen.add(it); out.push(it); }
      }
    return out;
  }
  // Işın (2D) — en yakın kesişim mesafesi
  raycast(x, z, dx, dz, maxD) {
    const steps = Math.ceil(maxD / 1.0); let best = maxD; const tmp = [];
    // kaba: hücreleri tara
    const cands = new Set();
    for (let s = 0; s <= steps; s += 6) { this.query(x + dx * s, z + dz * s, 8, tmp); tmp.forEach(t => cands.add(t)); }
    for (const it of cands) {
      const t = it.type === 'circle' ? rayCircle(x, z, dx, dz, it.x, it.z, it.r) : rayObb(x, z, dx, dz, it);
      if (t !== null && t >= 0 && t < best) best = t;
    }
    return best;
  }
}

export function rayCircle(x, z, dx, dz, cx, cz, r) {
  const ox = x - cx, oz = z - cz; const b = ox * dx + oz * dz; const c = ox * ox + oz * oz - r * r;
  const h = b * b - c; if (h < 0) return null; const t = -b - Math.sqrt(h); return t >= 0 ? t : (c < 0 ? 0 : null);
}
export function rayObb(x, z, dx, dz, o) {
  const { fx, fz, rx, rz } = axes(o.a); const ox = x - o.x, oz = z - o.z;
  const lx = ox * rx + oz * rz, lz = ox * fx + oz * fz, ldx = dx * rx + dz * rz, ldz = dx * fx + dz * fz;
  let tmin = -Infinity, tmax = Infinity;
  for (const [p, d, h] of [[lx, ldx, o.hx], [lz, ldz, o.hz]]) {
    if (Math.abs(d) < 1e-8) { if (Math.abs(p) > h) return null; }
    else { let t1 = (-h - p) / d, t2 = (h - p) / d; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null; }
  }
  return tmax < 0 ? null : Math.max(0, tmin);
}
