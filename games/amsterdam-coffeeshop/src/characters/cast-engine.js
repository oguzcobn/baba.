/* =============================================================================
   AMSTERDAM: Coffeeshop Empire — CAST ENGINE (25 özgün karakter)
   -----------------------------------------------------------------------------
   Tüm karakterler bu oyun için icat edilmiş hayali figürlerdir. Geometri ve
   animasyon, hazır model ya da keyframe kullanılmadan matematikle üretilir:

   GEOMETRİ
   • Süperkuadrikler (Barr 1981): x = a·cos^ε1(η)·cos^ε2(ω) … + Barr incelme/bükme
   • Catmull-Rom profilli dönel yüzeyler + Fourier kesit modülasyonu r(θ)=r0(1+Σaₖcos kθ)
   • Paralel taşıma (Bishop) çerçeveli süpürme tüpleri (kuyruk, boyun, dokunaç)
   • Logaritmik spiral kabuk (Raup 1966): r(θ)=a·e^{bθ}, b = ln W / 2π
   • Kelebek eğrisi (Fay 1989): r = e^{sinθ} − 2cos4θ + sin⁵((2θ−π)/24)
   • Phyllotaxis / Fibonacci küresi (altın açı 137.508°), Voronoi kabuk dokusu
   • Gül eğrisi r = cos(kθ) ile Delft çini deseni, harmonik seri org boruları Lₙ = L₁/n

   ANİMASYON
   • Merkezi örüntü üreteci (CPG) + Alexander (1976) dinamik benzerlik:
     Froude Fr = v²/(gL), adım uzunluğu λ = 2.3·L·Fr^0.3
   • Ters sarkaç kalça yüksekliği H = √(L² − z²), sikloid salınım yörüngesi
   • Analitik 2-kemikli IK (kosinüs teoremi) → ayak kayması yok
   • Kollar: sürülen sönümlü fiziksel sarkaç ω₀ = √(3g / 2L)
   • Kritik sönümlü yaylar (kapalı form), alt-sönümlü ikincil hareket
   • Verlet ip zinciri + şekil eşleme (Jakobsen 2001)
   • Balistik zıplama y = v₀t − ½gt², hacim koruyan squash/stretch (sx·sy·sz = 1)
   • SLIP yay-kütle zıplaması: temas süresi t_c = π√(m/k)
   • Yatış açısı φ = atan(v·ω/g), kaymasız yuvarlanma ω = v/r
   • Küresel harmonik titreşim (Rayleigh ωₗ ∝ √(l(l−1)(l+2))) + ince film girişimi
   • Eğrilik integrasyonlu elastik çubuk dokunaçlar κ(s,t)
   • Poisson süreçli göz kırpma & sakkadlar, Kleiber nefes f ∝ M^−1/4
   • Kepler 3. yasası ile yörüngedeki kristaller ω ∝ r^−3/2
   ============================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  if (!THREE) { console.error('CastEngine: THREE bulunamadı'); return; }

  const TAU = Math.PI * 2, G = 9.81;
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const V3 = THREE.Vector3;

  // ===========================================================================
  // 1. MATEMATİK ÇEKİRDEĞİ
  // ===========================================================================
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const spow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
  const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Perlin gradyan gürültüsü (kuintik solma 6t⁵−15t⁴+10t³)
  const PERM = (() => {
    const r = mulberry32(1337), p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    return p.concat(p);
  })();
  const grad1 = (h, x) => ((h & 1) ? -1 : 1) * (1 + (h & 7)) * x / 8;
  function noise1(x) {
    const xi = Math.floor(x), i = xi & 255, f = x - xi;
    const u = f * f * f * (f * (f * 6 - 15) + 10);
    return lerp(grad1(PERM[i], f), grad1(PERM[i + 1], f - 1), u) * 2;
  }
  function fbm1(x, oct = 3) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise1(x * f); f *= 2.03; a *= 0.5; } return s; }
  // Üstel dağılım (Poisson süreci varışlar arası süre)
  const expRand = (rnd, mean) => -Math.log(1 - rnd() * 0.999) * mean;

  // Kritik sönümlü yay — kapalı form tam çözüm (zaman adımından bağımsız kararlı)
  // x(t) = x* + (d + (v + ωd)t)e^{−ωt}
  function critSpring(st, target, omega, dt) {
    const d = st.x - target, e = Math.exp(-omega * dt), k = (st.v + omega * d) * dt;
    st.x = target + (d + k) * e;
    st.v = (st.v - omega * k) * e;
    return st.x;
  }
  // Alt-sönümlü 2. derece osilatör θ'' = ω²(θ*−θ) − 2ζωθ' + u   (yarı-örtük Euler, alt adımlı)
  function oscStep(st, target, omega, zeta, dt, force = 0) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = omega * omega * (target - st.x) - 2 * zeta * omega * st.v + force;
      st.v += a * h; st.x += st.v * h;
    }
    return st.x;
  }

  // ===========================================================================
  // 2. GEOMETRİ ÜRETİCİLERİ
  // ===========================================================================
  function gridGeometry(rows, cols, wrap, fn) {
    // (cols+1) sütun: UV dikişi için tekrar eden son sütun; normaller sonra dikişte ortalanır
    const C = cols + 1, pos = new Float32Array((rows + 1) * C * 3), uv = new Float32Array((rows + 1) * C * 2), idx = [];
    let k = 0, q = 0;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const p = fn(j / rows, i / cols);
      pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2];
      uv[q++] = i / cols; uv[q++] = j / rows;
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * C + i, b = a + 1, c = a + C, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    orientOutward(g);
    if (wrap) {
      const n = g.attributes.normal.array;
      for (let j = 0; j <= rows; j++) {
        const a = j * C * 3, b = (j * C + cols) * 3;
        for (let t = 0; t < 3; t++) { const m = (n[a + t] + n[b + t]) * 0.5; n[a + t] = n[b + t] = m; }
        const l = Math.hypot(n[a], n[a + 1], n[a + 2]) || 1;
        for (let t = 0; t < 3; t++) { n[a + t] /= l; n[b + t] = n[a + t]; }
      }
    }
    return g;
  }
  // Düzlemsel / kutu izdüşüm UV
  function projectUV(g, mode) {
    g.computeBoundingBox();
    const bb = g.boundingBox, p = g.attributes.position, uv = g.attributes.uv, s = new V3(), mn = bb.min;
    bb.getSize(s);
    for (let i = 0; i < p.count; i++) {
      const x = (p.getX(i) - mn.x) / (s.x || 1), y = (p.getY(i) - mn.y) / (s.y || 1), z = (p.getZ(i) - mn.z) / (s.z || 1);
      if (mode === 'xz') uv.setXY(i, x, z);
      else if (mode === 'xy') uv.setXY(i, x, y);
      else { const ax = Math.abs(x - 0.5) * s.x, ay = Math.abs(y - 0.5) * s.y, az = Math.abs(z - 0.5) * s.z;
        if (az >= ax && az >= ay) uv.setXY(i, x, y); else if (ax >= ay) uv.setXY(i, z, y); else uv.setXY(i, x, z); }
    }
    uv.needsUpdate = true; return g;
  }

  // Üçgen sarımını kütle merkezine göre dışa çevir (sayısal yönelim testi)
  function orientOutward(g) {
    g.computeBoundingBox();
    const c = new V3(); g.boundingBox.getCenter(c);
    const p = g.attributes.position, ix = g.index.array;
    const a = new V3(), b = new V3(), d = new V3(), n = new V3(), m = new V3();
    let s = 0;
    for (let t = 0; t < ix.length; t += 3) {
      a.fromBufferAttribute(p, ix[t]); b.fromBufferAttribute(p, ix[t + 1]); d.fromBufferAttribute(p, ix[t + 2]);
      n.subVectors(b, a).cross(m.subVectors(d, a));
      m.copy(a).add(b).add(d).multiplyScalar(1 / 3).sub(c);
      s += n.dot(m);
    }
    if (s < 0) for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }

  // Süperkuadrik (Barr 1981), y ekseni kutup ekseni. deform: Barr incelme/bükme
  function superquadric(rx, ry, rz, e1, e2, opt = {}) {
    const rows = opt.rows || 20, cols = opt.cols || 28, deform = opt.deform;
    const g = gridGeometry(rows, cols, true, (v, u) => {
      const eta = -Math.PI / 2 + Math.PI * v, w = -Math.PI + TAU * u;
      const ce = Math.cos(eta);
      let x = rx * spow(ce, e1) * spow(Math.cos(w), e2);
      let z = rz * spow(ce, e1) * spow(Math.sin(w), e2);
      let y = ry * spow(Math.sin(eta), e1);
      if (deform) [x, y, z] = deform(x, y, z);
      return [x, y, z];
    });
    return opt.uv ? projectUV(g, opt.uv) : g;
  }
  // Barr deformasyonları
  const taper = (kx, kz, h) => (x, y, z) => { const t = y / h; return [x * (1 + kx * t), y, z * (1 + kz * t)]; };
  const bendZ = (k) => (x, y, z) => [x, y, z + k * y * y];      // parabolik bükme
  const compose = (...fs) => (x, y, z) => fs.reduce((p, f) => f(p[0], p[1], p[2]), [x, y, z]);

  // Catmull-Rom profilli dönel yüzey + Fourier kesit: r(θ) = r(y)·(1 + Σ aₖ cos(kθ + φₖ))
  function fourierLathe(profile, harmonics = [], opt = {}) {
    const curve = new THREE.SplineCurve(profile.map(p => new THREE.Vector2(p[0], p[1])));
    const rows = opt.rows || 24, cols = opt.cols || 32;
    const pts = curve.getSpacedPoints(rows);
    return gridGeometry(rows, cols, true, (v, u) => {
      const p = pts[Math.round(v * rows)], th = u * TAU;
      let m = 1; for (const [k, a, ph = 0] of harmonics) m += a * Math.cos(k * th + ph);
      const r = Math.max(0, p.x) * m;
      return [r * Math.sin(th), p.y, r * Math.cos(th)];
    });
  }
  const lathe = (profile, opt) => fourierLathe(profile, [], opt);
  function capsuleGeo(r1, r2, len, seg = 12) {
    const prof = [];
    for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; prof.push([r2 * Math.sin(a), -len - r2 * Math.cos(a) + 0.0001]); }
    for (let i = 5; i >= 0; i--) { const a = (i / 5) * Math.PI / 2; prof.push([r1 * Math.sin(a), r1 * Math.cos(a) - 0.0001]); }
    const pts = prof.map(p => new THREE.Vector2(p[0], p[1]));
    return new THREE.LatheGeometry(pts, seg);
  }

  // Paralel taşıma (Bishop) çerçeveleri — Frenet'in burulma tekilliği olmadan
  function parallelTransport(points, T, N, B) {
    const n = points.length, tmp = new V3(), ax = new V3();
    for (let i = 0; i < n; i++) {
      (T[i] || (T[i] = new V3())).subVectors(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)]).normalize();
      N[i] = N[i] || new V3(); B[i] = B[i] || new V3();
    }
    tmp.set(0, 1, 0); if (Math.abs(T[0].y) > 0.9) tmp.set(1, 0, 0);
    N[0].crossVectors(tmp, T[0]).normalize(); B[0].crossVectors(T[0], N[0]);
    for (let i = 1; i < n; i++) {
      ax.crossVectors(T[i - 1], T[i]);
      const s = ax.length();
      N[i].copy(N[i - 1]);
      if (s > 1e-6) N[i].applyAxisAngle(ax.multiplyScalar(1 / s), Math.atan2(s, T[i - 1].dot(T[i])));
      B[i].crossVectors(T[i], N[i]);
    }
  }
  // Dinamik süpürme tüpü: r(s) yarıçap fonksiyonuyla her karede yeniden çatılır
  class SweepTube {
    constructor(nPts, radial, radiusFn, mat) {
      this.n = nPts; this.r = radial; this.radiusFn = radiusFn;
      this.T = []; this.N = []; this.B = [];
      const g = new THREE.BufferGeometry();
      this.pos = new Float32Array((nPts * radial + 1) * 3);
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      const idx = [];
      for (let j = 0; j < nPts - 1; j++) for (let i = 0; i < radial; i++) {
        const a = j * radial + i, b = j * radial + (i + 1) % radial, c = a + radial, d = b + radial;
        idx.push(a, b, c, b, d, c);
      }
      const tip = nPts * radial;
      for (let i = 0; i < radial; i++) idx.push((nPts - 1) * radial + i, (nPts - 1) * radial + (i + 1) % radial, tip);
      g.setIndex(idx);
      this.geo = g;
      this.mesh = new THREE.Mesh(g, mat);
      this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    }
    update(points) {
      parallelTransport(points, this.T, this.N, this.B);
      const { n, r, pos } = this; let k = 0;
      for (let j = 0; j < n; j++) {
        const s = j / (n - 1), rad = this.radiusFn(s), p = points[j], N = this.N[j], B = this.B[j];
        for (let i = 0; i < r; i++) {
          const a = (i / r) * TAU, c = Math.cos(a) * rad, sn = Math.sin(a) * rad;
          pos[k++] = p.x + N.x * c + B.x * sn; pos[k++] = p.y + N.y * c + B.y * sn; pos[k++] = p.z + N.z * c + B.z * sn;
        }
      }
      const last = points[n - 1], T = this.T[n - 1], tr = this.radiusFn(1) * 0.9;
      pos[k++] = last.x + T.x * tr; pos[k++] = last.y + T.y * tr; pos[k++] = last.z + T.z * tr;
      this.geo.attributes.position.needsUpdate = true;
      this.geo.computeVertexNormals();
    }
  }

  // Logaritmik spiral kabuk — Raup (1966) parametrik modeli
  //   W = tur başına genişleme oranı ⇒ b = ln W / 2π
  function raupShell(opt) {
    const W = opt.W || 2.1, b = Math.log(W) / TAU, turns = opt.turns || 3.2;
    const a = opt.a || 0.035, rr = opt.r || 0.72, D = opt.D || 0.12;
    const th0 = -turns * TAU;
    return gridGeometry(opt.rows || 90, opt.cols || 14, true, (v, u) => {
      const th = th0 * (1 - v), g = Math.exp(b * th);
      const phi = u * TAU, R = a * g, rad = a * rr * g;
      const ring = R + rad * Math.cos(phi);
      return [ring * Math.cos(th), ring * Math.sin(th), D * a * g + rad * Math.sin(phi) * 0.85];
    });
  }

  // Kelebek eğrisi (Temple H. Fay, 1989) — kanat şekli için kutupsal eğri
  function butterflyShape(scale, half) {
    // Eğri negatif r değerleriyle kendini keser; kanat için açısal zarf (en dış sınır) alınır
    const sg = half === 'L' ? -1 : 1, bins = 120, env = new Float32Array(bins);
    for (let i = 0; i <= 6000; i++) {
      const th = (i / 6000) * TAU;
      const r = Math.exp(Math.sin(th)) - 2 * Math.cos(4 * th) + Math.pow(Math.sin((2 * th - Math.PI) / 24), 5);
      const x = r * Math.cos(th) * sg, y = r * Math.sin(th);
      if (x < 0) continue;
      const b = Math.round((Math.atan2(y, x) + Math.PI / 2) / Math.PI * (bins - 1));
      env[b] = Math.max(env[b], Math.hypot(x, y));
    }
    const sm = Array.from(env, (_, i) => (env[Math.max(0, i - 1)] + 2 * env[i] + env[Math.min(bins - 1, i + 1)]) / 4);
    const s = new THREE.Shape(); s.moveTo(0, 0);
    for (let i = 0; i < bins; i++) { const a = -Math.PI / 2 + Math.PI * i / (bins - 1); s.lineTo(sg * Math.cos(a) * sm[i] * scale, Math.sin(a) * sm[i] * scale); }
    s.lineTo(0, 0);
    return new THREE.ShapeGeometry(s, 1);
  }

  // Fibonacci küresi: n noktayı küreye eşit alanlı dağıtır (altın açı)
  function fibonacciSphere(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), th = i * GOLDEN_ANGLE;
      out.push(new V3(Math.cos(th) * r, y, Math.sin(th) * r));
    }
    return out;
  }
  // Vogel phyllotaxis diski: rₙ = c√n, θₙ = n·137.508°
  const vogel = (n, c) => Array.from({ length: n }, (_, i) => ({ r: c * Math.sqrt(i + 0.5), th: i * GOLDEN_ANGLE }));

  // ===========================================================================
  // 3. PROSEDÜREL DOKULAR
  // ===========================================================================
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  // Voronoi (F2−F1 sınır) — kaplumbağa kabuğu plakaları
  function voronoiTex(seed, base, line) {
    return canvasTex(160, 160, (ctx, W, H) => {
      const r = mulberry32(seed), sites = Array.from({ length: 14 }, () => [r() * W, r() * H]);
      const img = ctx.createImageData(W, H), b = new THREE.Color(base), l = new THREE.Color(line);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let f1 = 1e9, f2 = 1e9;
        for (const [sx, sy] of sites) for (let ox = -W; ox <= W; ox += W) for (let oy = -H; oy <= H; oy += H) {
          const d = Math.hypot(x - sx - ox, y - sy - oy);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
        const e = clamp((f2 - f1) / 7, 0, 1), shade = 0.75 + 0.25 * (1 - f1 / 40);
        const k = (y * W + x) * 4;
        img.data[k] = 255 * lerp(l.r, b.r * shade, e); img.data[k + 1] = 255 * lerp(l.g, b.g * shade, e); img.data[k + 2] = 255 * lerp(l.b, b.b * shade, e); img.data[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
  }
  // Delft çini: gül eğrisi r = cos(kθ) rozet + köşe süsleri
  function delftTex() {
    return canvasTex(256, 256, (ctx, W) => {
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, W);
      ctx.strokeStyle = '#1e3a8a'; ctx.fillStyle = '#1e40af';
      ctx.lineWidth = 6; ctx.strokeRect(6, 6, W - 12, W - 12);
      ctx.beginPath();
      for (let i = 0; i <= 720; i++) {
        const th = (i / 720) * TAU, r = 90 * Math.cos(4 * th);
        const x = W / 2 + r * Math.cos(th), y = W / 2 + r * Math.sin(th);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5; ctx.stroke();
      for (const [cx, cy] of [[0, 0], [W, 0], [0, W], [W, W]]) {
        ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 18, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(W / 2, W / 2, 14, 0, TAU); ctx.fillStyle = '#f4f1ea'; ctx.fill();
    }, [2, 2]);
  }
  function waffleTex() {
    return canvasTex(256, 256, (ctx, W) => {
      ctx.fillStyle = '#c98a3e'; ctx.fillRect(0, 0, W, W);
      ctx.strokeStyle = '#8a5320'; ctx.lineWidth = 7;
      for (let i = -W; i < 2 * W; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + W, W); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i, W); ctx.lineTo(i + W, 0); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,220,160,0.35)'; ctx.lineWidth = 2;
      for (let i = -W; i < 2 * W; i += 32) { ctx.beginPath(); ctx.moveTo(i + 5, 0); ctx.lineTo(i + W + 5, W); ctx.stroke(); }
    }, [1, 1]);
  }
  function labelTex(txt, bg, fg) {
    return canvasTex(256, 96, (ctx, W, H) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = fg; ctx.lineWidth = 4; ctx.strokeRect(6, 6, W - 12, H - 12);
      ctx.fillStyle = fg; ctx.font = 'bold 38px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, W / 2, H / 2 + 2);
    });
  }

  // İnce film girişimi (sabun köpüğü): I_λ ∝ sin²(2π·n·d·cosθₜ / λ)
  function thinFilmMaterial() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.32, depthWrite: false });
    m.userData.uThick = { value: 0.38 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uThick = m.userData.uThick;
      sh.fragmentShader = 'uniform float uThick;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float ci = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
        float ct = sqrt(1.0 - (1.0 - ci * ci) / 1.769);
        vec3 ph = 6.2831853 * 1.33 * uThick * ct / vec3(0.65, 0.53, 0.45);
        vec3 film = sin(ph) * sin(ph);
        totalEmissiveRadiance += film * (0.5 + 1.3 * pow(1.0 - ci, 2.0));`);
    };
    return m;
  }

  // ===========================================================================
  // 4. YAPI BAĞLAMI (her karakterin kurulumunda kullanılan yardımcılar)
  // ===========================================================================
  class BuildCtx {
    constructor(def) {
      this.def = def;
      this.rnd = mulberry32(def.seed || 7);
      this.root = new THREE.Group(); this.root.name = 'cast:' + def.id;
      this.motion = new THREE.Group(); this.root.add(this.motion);
      this.body = new THREE.Group(); this.motion.add(this.body);           // squash/stretch katmanı
      this.pelvis = new THREE.Group(); this.body.add(this.pelvis);
      this.spine = new THREE.Group(); this.pelvis.add(this.spine);
      this.head = new THREE.Group(); this.spine.add(this.head);
      this.eyesList = []; this.jiggles = []; this.chains = []; this.legs = null; this.armsBuilt = false;
      this.data = {}; this.mats = {};
      this.hipH = 0;
    }
    M(hex, rough = 0.6, metal = 0, extra = {}) {
      const key = hex + '|' + rough + '|' + metal + '|' + JSON.stringify(extra);
      if (this.mats[key]) return this.mats[key];
      const P = extra.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      const o = Object.assign({ color: hex, roughness: rough, metalness: metal }, extra);
      delete o.physical;
      return (this.mats[key] = new P(o));
    }
    mesh(geo, mat, parent, p = [0, 0, 0], r = [0, 0, 0], s) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p[0], p[1], p[2]); m.rotation.set(r[0], r[1], r[2]);
      if (s) (typeof s === 'number') ? m.scale.setScalar(s) : m.scale.set(s[0], s[1], s[2]);
      m.castShadow = true; m.receiveShadow = false;
      (parent || this.body).add(m);
      return m;
    }
    group(parent, p = [0, 0, 0], r = [0, 0, 0]) {
      const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]); g.rotation.set(r[0], r[1], r[2]);
      (parent || this.body).add(g); return g;
    }
    SQ(rx, ry, rz, e1, e2, opt) { return superquadric(rx, ry, rz, e1, e2, opt); }
    sphere(r, w = 18, h = 14) { return new THREE.SphereGeometry(r, w, h); }

    // Göz küresi dönen (sakkad) + kapak ölçekli (kırpma) göz
    eyes(parent, o) {
      const sep = o.sep || 0.07, r = o.r || 0.05, y = o.y || 0, z = o.z || 0.1;
      const scl = this.M(o.sclera || 0xffffff, 0.12, 0, o.glow ? { emissive: o.sclera || 0xffffff, emissiveIntensity: 0.6 } : {});
      const iris = this.M(o.iris || 0x2563eb, 0.25, 0, o.glow ? { emissive: o.iris, emissiveIntensity: 1.2 } : {});
      const pup = this.M(0x0b0b12, 0.1);
      const hl = this.M(0xffffff, 0.2, 0, { emissive: 0xffffff, emissiveIntensity: 0.9 });
      const n = o.count || 2;
      for (let i = 0; i < n; i++) {
        const side = n === 1 ? 0 : (i === 0 ? -1 : 1);
        const eg = this.group(parent, [side * sep, y, z], [0, side * (o.splay || 0), 0]);
        const ball = this.group(eg);
        this.mesh(this.sphere(r, 16, 12), scl, ball);
        this.mesh(this.sphere(r * 0.62, 14, 10), iris, ball, [0, 0, r * 0.52], [0, 0, 0], [1, 1, 0.55]);
        this.mesh(this.sphere(r * 0.34, 12, 8), pup, ball, [0, 0, r * 0.72], [0, 0, 0], [1, 1, 0.5]);
        this.mesh(this.sphere(r * 0.13, 8, 6), hl, ball, [r * 0.24, r * 0.26, r * 0.86]);
        if (o.lid) this.mesh(this.SQ(r * 1.08, r * 0.55, r * 1.08, 1, 1, { rows: 8, cols: 14 }), this.M(o.lid, 0.6), eg, [0, r * 0.62, 0]);
        this.eyesList.push({ eg, ball, open: 1 });
      }
    }
    mouth(parent, o) {
      const g = new THREE.TorusGeometry(o.w || 0.04, o.t || 0.007, 6, 16, Math.PI * (o.arc || 0.8));
      const m = this.mesh(g, this.M(o.color || 0x3b0f0f, 0.5), parent, [0, o.y || 0, o.z || 0.1], [0, 0, Math.PI + (Math.PI - Math.PI * (o.arc || 0.8)) / 2]);
      if (o.frown) m.rotation.z = (Math.PI - Math.PI * (o.arc || 0.8)) / 2;
      return m;
    }
    // İki kemikli bacaklar (uyluk L1, baldır L2) — IK hedefli
    buildLegs(o) {
      const L1 = o.L1, L2 = o.L2, w = o.hipW, mat = o.mat, fm = o.footMat || mat;
      const footH = o.footH != null ? o.footH : 0.035;
      this.hipH = footH + 0.96 * (L1 + L2);
      this.pelvis.position.y = this.hipH;
      const mk = (sx) => {
        const hip = this.group(this.pelvis, [sx * w, 0, 0]);
        this.mesh(capsuleGeo(o.r1, o.r1 * 0.82, L1), mat, hip);
        const knee = this.group(hip, [0, -L1, 0]);
        this.mesh(capsuleGeo(o.r1 * 0.8, o.r2, L2), o.shankMat || mat, knee);
        const ankle = this.group(knee, [0, -L2, 0]);
        if (o.foot) o.foot(ankle, sx); else this.mesh(this.SQ(o.r2 * 1.5, footH * 0.9, (o.footLen || 0.14) / 2, 0.5, 1, { rows: 10, cols: 14 }), fm, ankle, [0, -footH * 0.5, (o.footLen || 0.14) * 0.28]);
        return { hip, knee, ankle, L1, L2, sx, reverse: !!o.reverse };
      };
      this.legs = { L: mk(-1), R: mk(1), L1, L2, footH, hipW: w };
      return this.legs;
    }
    buildArms(o) {
      const mat = o.mat, hm = o.handMat || mat;
      const mk = (sx) => {
        const shoulder = this.group(o.parent || this.spine, [sx * o.w, o.y, o.z || 0]);
        shoulder.rotation.z = sx * (o.splay != null ? o.splay : 0.12);
        if (o.custom) { const r = o.custom(shoulder, sx); return Object.assign({ shoulder, sx, len: o.L1 + o.L2 }, r); }
        this.mesh(capsuleGeo(o.r, o.r * 0.85, o.L1), mat, shoulder);
        const elbow = this.group(shoulder, [0, -o.L1, 0]);
        this.mesh(capsuleGeo(o.r * 0.85, o.r * 0.75, o.L2), o.foreMat || mat, elbow);
        const hand = this.mesh(this.sphere(o.hand || o.r * 1.35, 12, 10), hm, elbow, [0, -o.L2 - (o.hand || o.r) * 0.6, 0]);
        return { shoulder, elbow, hand, sx, len: o.L1 + o.L2 };
      };
      this.arms = { L: mk(-1), R: mk(1) };
      this.armsBuilt = true;
      return this.arms;
    }
    // Alt-sönümlü ikincil hareket (anten, kulak, şapka ucu…)
    jiggle(obj, o = {}) {
      const j = { obj, axis: o.axis || 'x', rest: o.rest != null ? o.rest : obj.rotation[o.axis || 'x'], st: { x: 0, v: 0 }, omega: TAU * (o.freq || 2.2), zeta: o.zeta || 0.18, gain: o.gain || 0.35, src: o.src || 'fwd' };
      this.jiggles.push(j); return j;
    }
    // Verlet zinciri + dinamik tüp
    chain(anchor, o) {
      const ch = { anchor, n: o.n || 8, seg: o.seg || 0.06, dir: new V3(...(o.dir || [0, -1, 0])).normalize(), grav: o.gravity != null ? o.gravity : 1, damp: o.damping || 0.08, stiff: o.stiffness != null ? o.stiffness : 0.06, pts: [], prev: [], local: [], tube: null, init: false, tip: o.tip || null };
      for (let i = 0; i < ch.n; i++) { ch.pts.push(new V3()); ch.prev.push(new V3()); ch.local.push(new V3()); }
      ch.tube = new SweepTube(ch.n, o.radial || 8, o.radius || (s => 0.02 * (1 - 0.6 * s)), o.mat);
      this.root.add(ch.tube.mesh);
      if (ch.tip) this.root.add(ch.tip);
      this.chains.push(ch); return ch;
    }
  }

  // ===========================================================================
  // 5. HAREKET DENETLEYİCİSİ
  // ===========================================================================
  const _v = new V3(), _w = new V3(), _q = new THREE.Quaternion();

  class CastController {
    constructor(ctx) {
      const def = ctx.def;
      this.ctx = ctx; this.def = def;
      this.rnd = mulberry32((def.seed || 1) * 977 + 13);
      this.seed = this.rnd() * 100;
      this.v = { x: 0, v: 0 };                     // yumuşatılmış hız
      this.prevV = 0; this.aFwd = 0; this.aUp = 0; this.prevY = 0; this.prevVy = 0;
      this.cyc = this.rnd();                        // CPG fazı [0,1)
      this.lastYaw = null; this.yawRate = 0; this.bank = { x: 0, v: 0 };
      this.blinkT = expRand(this.rnd, 3.2); this.blinkPhase = -1;
      this.sacT = expRand(this.rnd, 1.4); this.gaze = { yaw: 0, pitch: 0 };
      this.eyeY = { x: 0, v: 0 }; this.eyeP = { x: 0, v: 0 }; this.headY = { x: 0, v: 0 }; this.headP = { x: 0, v: 0 };
      this.armSt = { L: { x: 0, v: 0 }, R: { x: 0, v: 0 } };
      this.hop = { air: false, t: 0, y: 0, vy: 0, nextIdle: expRand(this.rnd, 5) };
      this.spin = 0; this.time = 0;
      // Kleiber yasası: M = 70·(boy/1.75)³ kg, solunum frekansı f ∝ M^−1/4
      this.mass = 70 * Math.pow(def.stature / 1.75, 3);
      this.breathF = 0.26 * Math.pow(this.mass / 70, -0.25);
      this.speedScale = 1;
    }
    update(dt, speedTarget, t) {
      dt = Math.min(dt, 0.05);
      this.time += dt;
      const ctx = this.ctx, def = this.def, root = ctx.root;
      // Hız: kritik sönümlü yumuşatma (anlık kalkış/duruş yerine ivme)
      const v = Math.max(0, critSpring(this.v, speedTarget, 7, dt));
      this.aFwd = lerp(this.aFwd, (v - this.prevV) / Math.max(dt, 1e-4), 0.3); this.prevV = v;
      // Sapma hızı (yaw rate) → yatış açısı φ = atan(v·ω/g)
      const yaw = root.rotation.y;
      if (this.lastYaw == null) this.lastYaw = yaw;
      const dyaw = wrapPi(yaw - this.lastYaw); this.lastYaw = yaw;
      this.yawRate = lerp(this.yawRate, dyaw / Math.max(dt, 1e-4), 0.2);
      const bankTarget = Math.atan(v * this.yawRate / G) * (def.bankGain || 1);
      critSpring(this.bank, clamp(bankTarget, -0.6, 0.6), 6, dt);

      const loco = def.loco;
      if (loco === 'biped') this.biped(dt, v, t);
      else if (loco === 'hop') this.hopper(dt, v, t);
      else if (loco === 'hover') this.hover(dt, v, t);
      else if (loco === 'roll') this.roller(dt, v, t);
      else if (loco === 'crawl') this.crawler(dt, v, t);

      // Dikey ivme (squash ve ikincil hareket girdisi)
      const y = ctx.motion.position.y, vy = (y - this.prevY) / Math.max(dt, 1e-4);
      this.aUp = lerp(this.aUp, (vy - this.prevVy) / Math.max(dt, 1e-4), 0.35); this.prevY = y; this.prevVy = vy;

      this.breathe(t); this.eyesAndHead(dt, v);
      // İkincil hareket yayları
      for (const j of ctx.jiggles) {
        const inp = j.src === 'up' ? -this.aUp * 0.08 : j.src === 'turn' ? this.yawRate * v * 0.5 : -this.aFwd * 0.25 + (loco === 'biped' ? Math.sin(this.cyc * TAU * 2) * v * 0.6 : 0);
        oscStep(j.st, 0, j.omega, j.zeta, dt, inp * j.gain * j.omega);
        j.obj.rotation[j.axis] = j.rest + clamp(j.st.x, -0.9, 0.9);
      }
      if (def.tick) def.tick(ctx, this, dt, t, v);
      if (ctx.chains.length) { root.updateMatrixWorld(true); for (const ch of ctx.chains) this.chainStep(ch, dt); }
    }

    // ---------------- İki ayaklı yürüyüş: CPG + Froude + IK ----------------
    biped(dt, v, t) {
      const ctx = this.ctx, def = this.def, L = ctx.legs;
      const Ltot = L.L1 + L.L2, Le = 0.96 * Ltot;
      const Fr = v * v / (G * Ltot);                       // Froude sayısı
      const S = v > 0.02 ? Math.min(2.3 * Ltot * Math.pow(Fr, 0.3), 1.6 * Ltot) : 0;  // Alexander (1976)
      const f = S > 0 ? v / S : 0;                          // adım frekansı
      this.cyc = (this.cyc + f * dt) % 1;
      const beta = clamp(0.64 - 0.3 * Math.sqrt(Fr), 0.5, 0.64);   // görev faktörü
      const amp = clamp(v / 1.2, 0, 1);
      const clearance = (def.clearance || 0.11) * Ltot * Math.min(1, amp * 1.5);
      const feet = [];
      for (const [k, off] of [['L', 0], ['R', 0.5]]) {
        const s = (this.cyc + off) % 1;
        let z, y, stance, u;
        if (s < beta) { u = s / beta; z = beta * S * (0.5 - u); y = 0; stance = true; }
        else { u = (s - beta) / (1 - beta); z = beta * S * (-0.5 + (u - Math.sin(TAU * u) / TAU)); y = clearance * (1 - Math.cos(TAU * u)) / 2; stance = false; }
        feet.push({ k, z, y, stance, u });
      }
      // Ters sarkaç: kalça yüksekliği duruş ayağının yayı üzerinde H = √(Le² − z²)
      let H = Le;
      for (const ft of feet) if (ft.stance) H = Math.min(H, Math.sqrt(Math.max(1e-4, Le * Le - ft.z * ft.z)));
      const idleSway = (1 - amp) * Math.sin(t * this.breathF * TAU * 0.5 + this.seed) * 0.012 * Ltot;
      ctx.pelvis.position.y = L.footH + H;
      ctx.pelvis.position.x = idleSway + (def.waddle || 0) * Math.sin(this.cyc * TAU) * amp * L.hipW;
      ctx.pelvis.rotation.y = 0.16 * amp * Math.sin(this.cyc * TAU) * (def.pelvisYaw || 1);
      ctx.pelvis.rotation.z = (0.05 + (def.waddle || 0) * 0.4) * amp * Math.sin(this.cyc * TAU) - this.bank.x * 0.5;
      ctx.spine.rotation.y = -ctx.pelvis.rotation.y * 0.9;
      ctx.spine.rotation.x = (def.lean || 0.06) * amp + clamp(this.aFwd * 0.03, -0.12, 0.12);
      for (const ft of feet) {
        const leg = L[ft.k], tz = ft.z, ty = -(H) + ft.y;
        const pitch = ft.stance ? 0 : 0.5 * Math.sin(Math.PI * ft.u) * amp;
        solveIK(leg, tz, ty, pitch);
      }
      // Kollar: sürülen fiziksel sarkaç, karşı bacakla ters faz
      if (ctx.arms && !def.noArmSwing) {
        const half = Math.max(0.5 * beta * S, 1e-3);
        for (const [k, opp] of [['L', 'R'], ['R', 'L']]) {
          const arm = ctx.arms[k]; if (!arm.shoulder) continue;
          const zOpp = feet.find(f2 => f2.k === opp).z;
          const target = -(def.armSwing || 0.45) * amp * (zOpp / half);
          const w0 = Math.sqrt(3 * G / (2 * Math.max(arm.len, 0.15)));
          const th = oscStep(this.armSt[k], target, w0, 0.42, dt);
          arm.shoulder.rotation.x = th + (def.armRest || 0);
          if (arm.elbow) arm.elbow.rotation.x = -(0.22 + 0.35 * Math.max(0, -th));
        }
      }
    }

    // ---------------- Balistik zıplama + hacim koruyan squash ----------------
    hopper(dt, v, t) {
      const ctx = this.ctx, def = this.def, h = this.hop;
      const H = def.hopH || 0.2, v0 = Math.sqrt(2 * G * H), Tair = 2 * v0 / G;
      // SLIP modeli: temas süresi t_c = π√(m/k)
      const tc = def.slipK ? Math.PI * Math.sqrt(this.mass / def.slipK) : (def.contact || 0.16);
      const wantHop = v > 0.08 || (h.nextIdle -= dt) <= 0;
      if (!h.air) {
        h.t += dt;
        if (h.t >= tc) { if (wantHop) { h.air = true; h.t = 0; if (h.nextIdle <= 0) h.nextIdle = expRand(this.rnd, 4.5); } else h.t = tc; }
      } else {
        h.t += dt;
        if (h.t >= Tair) { h.air = false; h.t = 0; }
      }
      let y = 0, s = 1;
      if (h.air) { y = v0 * h.t - 0.5 * G * h.t * h.t; const vy = v0 - G * h.t; s = 1 + (def.stretch || 0.14) * Math.abs(vy) / v0; }
      else if (h.t < tc) { s = 1 - (def.squash || 0.22) * Math.sin(Math.PI * h.t / tc); }
      else s = 1 - 0.015 * Math.sin(t * this.breathF * TAU);
      h.y = y; h.s = s; h.u = h.air ? h.t / Tair : -1;
      ctx.motion.position.y = (def.baseLift || 0) + Math.max(0, y);
      ctx.body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));           // sx·sy·sz = 1
      ctx.motion.rotation.x = h.air ? (def.hopPitch || 0.25) * (0.5 - h.t / Tair) * Math.min(1, v * 2 + 0.3) : 0;
      ctx.motion.rotation.z = -this.bank.x;
    }

    // ---------------- Süzülme: Lissajous + fBm + yatış ----------------
    hover(dt, v, t) {
      const ctx = this.ctx, def = this.def, f = def.hoverF || 0.55, A = def.hoverA || 0.06;
      ctx.motion.position.y = (def.hoverH || 0.35) + A * Math.sin(TAU * f * t + this.seed) + 0.03 * fbm1(t * 0.6 + this.seed);
      ctx.motion.position.x = 0.04 * Math.sin(3 * 0.37 * t + this.seed) * (1 - Math.min(1, v));   // 3:2 Lissajous
      ctx.motion.position.z = 0.03 * Math.sin(2 * 0.37 * t);
      ctx.motion.rotation.z = -this.bank.x * 1.2 + 0.05 * Math.sin(t * 0.9 + this.seed);
      // aerodinamik öne eğilme: tanθ ≈ C·v²
      ctx.motion.rotation.x = Math.atan((def.dragTilt || 0.12) * v * v) + clamp(this.aFwd * 0.04, -0.15, 0.15);
      this.cyc = (this.cyc + dt * (0.6 + v * 0.8)) % 1;
    }

    // ---------------- Kaymasız yuvarlanma ω = v / r ----------------
    roller(dt, v, t) {
      const ctx = this.ctx, def = this.def;
      this.spin += (v / def.wheelR) * dt;
      ctx.motion.rotation.z = -this.bank.x;
      ctx.motion.rotation.x = clamp(this.aFwd * 0.05, -0.2, 0.2);
      ctx.motion.position.y = 0.006 * Math.abs(Math.sin(this.spin * 4)) * Math.min(1, v);   // kaldırım titreşimi
      this.cyc = (this.cyc + dt * v / (TAU * def.wheelR)) % 1;
    }

    // ---------------- Sürünme (peristaltik dalga) ----------------
    crawler(dt, v, t) {
      const ctx = this.ctx, def = this.def;
      this.cyc = (this.cyc + dt * (0.35 + v * (def.waveF || 1.2))) % 1;
      ctx.motion.position.y = def.crawlLift || 0;
      ctx.motion.rotation.z = -this.bank.x * 0.5;
    }

    breathe(t) {
      const ctx = this.ctx, tm = ctx.data.breath;
      if (!tm) return;
      const b = Math.sin(TAU * this.breathF * t + this.seed) * (this.def.breathAmp || 0.025);
      tm.scale.set(1 + b, 1 + b * 0.5, 1 + b);
    }

    // Poisson göz kırpma, sakkadlar ve baş-göz koordinasyonu
    eyesAndHead(dt, v) {
      const ctx = this.ctx, def = this.def;
      this.sacT -= dt;
      if (this.sacT <= 0) {
        this.sacT = expRand(this.rnd, v > 0.2 ? 1.1 : 1.8);
        const range = def.gazeRange || 0.55;
        this.gaze.yaw = (this.rnd() * 2 - 1) * range * (v > 0.2 ? 0.45 : 1);
        this.gaze.pitch = (this.rnd() * 2 - 1) * 0.18 + 0.05;
      }
      critSpring(this.eyeY, this.gaze.yaw, 38, dt); critSpring(this.eyeP, this.gaze.pitch, 38, dt);
      const hy = critSpring(this.headY, this.gaze.yaw * (def.headFollow || 0.55), def.headOmega || 7, dt);
      const hp = critSpring(this.headP, this.gaze.pitch * 0.4, def.headOmega || 7, dt);
      if (!def.noHeadTurn) { ctx.head.rotation.y = hy + (ctx.data.headYaw0 || 0); ctx.head.rotation.x = -hp + (ctx.data.headPitch0 || 0); }
      // kırpma: kapanma eğrisi c(τ) = sin(πτ)^0.6
      this.blinkT -= dt;
      if (this.blinkT <= 0 && this.blinkPhase < 0) { this.blinkPhase = 0; this.blinkT = this.rnd() < 0.12 ? 0.25 : expRand(this.rnd, 3.4); }
      let close = 0;
      if (this.blinkPhase >= 0) { this.blinkPhase += dt / 0.16; close = Math.pow(Math.sin(Math.PI * Math.min(1, this.blinkPhase)), 0.6); if (this.blinkPhase >= 1) this.blinkPhase = -1; }
      for (const e of ctx.eyesList) {
        e.ball.rotation.y = (this.eyeY.x - hy) * 1.2; e.ball.rotation.x = -(this.eyeP.x - hp);
        e.eg.scale.y = 1 - 0.9 * close;
      }
    }

    // Verlet + mesafe kısıtları + şekil eşleme (Jakobsen)
    chainStep(ch, dt) {
      const a = ch.anchor; a.updateMatrixWorld(true);
      const base = a.getWorldPosition(_v);
      a.getWorldQuaternion(_q);
      const dirW = _w.copy(ch.dir).applyQuaternion(_q);
      const P = ch.pts, Q = ch.prev, n = ch.n, seg = ch.seg * this.ctx.root.scale.y;
      if (!ch.init || P[0].distanceToSquared(base) > 4) {
        for (let i = 0; i < n; i++) { P[i].copy(base).addScaledVector(dirW, seg * i); Q[i].copy(P[i]); }
        ch.init = true;
      }
      const g = -G * ch.grav * dt * dt, keep = 1 - ch.damp;
      P[0].copy(base); Q[0].copy(base);
      for (let i = 1; i < n; i++) {
        const p = P[i], q = Q[i];
        const vx = (p.x - q.x) * keep, vy = (p.y - q.y) * keep, vz = (p.z - q.z) * keep;
        q.copy(p); p.x += vx; p.y += vy + g; p.z += vz;
        // şekil eşleme: dinlenme pozuna doğru çekim (bükülme sertliği)
        const rx = base.x + dirW.x * seg * i, ry = base.y + dirW.y * seg * i, rz = base.z + dirW.z * seg * i;
        p.x += (rx - p.x) * ch.stiff; p.y += (ry - p.y) * ch.stiff; p.z += (rz - p.z) * ch.stiff;
      }
      for (let it = 0; it < 4; it++) for (let i = 1; i < n; i++) {
        const p0 = P[i - 1], p1 = P[i];
        const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const k = (d - seg) / d;
        if (i === 1) { p1.x -= dx * k; p1.y -= dy * k; p1.z -= dz * k; }
        else { p0.x += dx * k * 0.5; p0.y += dy * k * 0.5; p0.z += dz * k * 0.5; p1.x -= dx * k * 0.5; p1.y -= dy * k * 0.5; p1.z -= dz * k * 0.5; }
      }
      const root = this.ctx.root;
      for (let i = 0; i < n; i++) root.worldToLocal(ch.local[i].copy(P[i]));
      ch.tube.update(ch.local);
      if (ch.tip) ch.tip.position.copy(ch.local[n - 1]);
    }
  }

  // Analitik iki kemikli IK (kosinüs teoremi). Hedef: kalçaya göre ayak bileği (z ileri, y yukarı)
  function solveIK(leg, tz, ty, footPitch) {
    const L1 = leg.L1, L2 = leg.L2;
    const d = clamp(Math.hypot(tz, ty), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.9995);
    const gamma = Math.atan2(tz, -ty);
    const alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const inner = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    const sgn = leg.reverse ? -1 : 1;
    const hip = gamma + sgn * alpha, knee = sgn * (Math.PI - inner);
    leg.hip.rotation.x = -hip;
    leg.knee.rotation.x = knee;
    leg.ankle.rotation.x = hip - knee - footPitch;
    return { hip, knee };
  }

  // ===========================================================================
  // 6. KADRO — 25 ÖZGÜN KARAKTER
  // ===========================================================================
  const LOCO_TR = { biped: 'İki ayaklı yürüyüş', hop: 'Balistik zıplama', hover: 'Süzülme', roll: 'Yuvarlanma', crawl: 'Sürünme' };
  const skinM = (c, hex) => c.M(hex, 0.62, 0);

  const CAST = [
    // 1 ─ Tulpje
    {
      id: 'tulpje', name: 'Tulpje', title: 'Lale Perisi', loco: 'hover', stature: 1.05, seed: 11, speed: 1.15, color: 0xe11d48,
      hoverH: 0.3, hoverA: 0.06,
      desc: 'Keukenhof tarlalarından kaçmış, sabah çiyiyle beslenen bir lale perisi.',
      math: ['Taç yapraklar: e₁=0.35 süperkuadrik + Barr bükme, 3-katlı simetri (120°)', 'Sap: Verlet zinciri + paralel taşıma tüpü', 'Lissajous 3:2 süzülme + fBm gürültü'],
      build(c) {
        const green = c.M(0x16a34a, 0.55), petal = c.M(0xe11d48, 0.45, 0, { side: THREE.DoubleSide }), petal2 = c.M(0xbe123c, 0.45, 0, { side: THREE.DoubleSide });
        c.pelvis.position.y = 0.35;
        c.head.position.y = 0.34;
        const face = c.mesh(c.SQ(0.13, 0.15, 0.13, 0.9, 1), c.M(0xfde68a, 0.6), c.head);
        c.data.breath = face;
        c.eyes(c.head, { y: 0.02, z: 0.1, sep: 0.05, r: 0.035, iris: 0x15803d });
        c.mouth(c.head, { y: -0.06, z: 0.12, w: 0.025 });
        const bloom = c.group(c.head, [0, 0.09, -0.01]); bloom.scale.setScalar(0.72); c.data.bloom = bloom; c.data.petals = [];
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6 + (i % 2 ? 0 : Math.PI / 6);
          const piv = c.group(bloom, [Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06], [0, a, 0]);
          c.mesh(c.SQ(0.1, 0.2, 0.025, 0.35, 1, { deform: compose(taper(-0.5, 0, 0.2), bendZ(-1.2)) }), i % 2 ? petal : petal2, piv, [0, 0.17, 0.0]);
          piv.rotation.x = 0.3; c.data.petals.push(piv);
        }
        c.mesh(c.SQ(0.07, 0.1, 0.07, 0.8, 1), green, c.spine, [0, 0.12, 0]);
        c.buildArms({ w: 0.07, y: 0.17, L1: 0.12, L2: 0.1, r: 0.016, mat: green, hand: 0.02, splay: 0.6 });
        const leafM = c.M(0x22c55e, 0.5, 0, { side: THREE.DoubleSide });
        c.chain(c.pelvis, { n: 9, seg: 0.06, dir: [0, -1, -0.25], stiffness: 0.05, damping: 0.1, mat: green, radius: s => 0.018 * (1 - 0.4 * s), radial: 6 });
        const leaf = c.mesh(c.SQ(0.05, 0.16, 0.01, 0.4, 1, { deform: bendZ(-1.5) }), leafM, c.pelvis, [0.05, -0.12, 0], [0.3, 0, -0.6]);
        c.jiggle(leaf, { axis: 'z', freq: 1.6, gain: 0.6 });
      },
      tick(c, k, dt, t) { const o = 0.3 + 0.1 * Math.sin(t * k.breathF * TAU + k.seed); for (const p of c.data.petals) p.rotation.x = o; c.data.bloom.rotation.y += dt * 0.2; }
    },
    // 2 ─ Kaasbol
    {
      id: 'kaasbol', name: 'Kaasbol', title: 'Gouda Tekeri', loco: 'roll', stature: 1.25, seed: 22, speed: 1.6, wheelR: 0.42, color: 0xfacc15,
      desc: 'Alkmaar peynir pazarından yuvarlanarak kaçan, 12 kiloluk olgun bir Gouda.',
      math: ['Teker: ε₁=0.28 süperkuadrik (düz yanaklar, yuvarlak sırt)', 'Kaymasız yuvarlanma ω = v/r', 'Yatış φ = atan(v·ω/g), gözler kritik sönümlü yayla'],
      build(c) {
        const R = c.def.wheelR;
        const wheel = c.group(c.body, [0, R, 0]); c.data.wheel = wheel;
        const cheese = c.M(0xfacc15, 0.55), wax = c.M(0xb91c1c, 0.3), hole = c.M(0xb45309, 0.9);
        c.mesh(c.SQ(R, 0.16, R, 0.28, 1, { rows: 22, cols: 36 }), cheese, wheel, [0, 0, 0], [0, 0, Math.PI / 2]);
        c.mesh(new THREE.TorusGeometry(R * 0.985, 0.03, 8, 40), wax, wheel, [0, 0, 0], [0, Math.PI / 2, 0]);
        for (const p of vogel(14, 0.085)) for (const sx of [-1, 1]) c.mesh(c.sphere(0.03 + 0.01 * (p.r % 1), 8, 6), hole, wheel, [sx * 0.15, Math.sin(p.th) * p.r, Math.cos(p.th) * p.r], [0, 0, 0], [0.4, 1, 1]);
        const yoke = c.group(c.body, [0, R, 0]);
        const metal = c.M(0x334155, 0.35, 0.8);
        c.mesh(new THREE.TorusGeometry(R + 0.05, 0.022, 8, 24, Math.PI), metal, yoke, [0, 0, 0], [0, Math.PI / 2, 0]);
        for (const sx of [-1, 1]) c.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), metal, yoke, [sx * 0.19, 0, 0], [0, 0, Math.PI / 2]);
        c.head.position.set(0, 2 * R + 0.1, 0.0); c.body.add(c.head);
        const hb = c.mesh(c.SQ(0.13, 0.08, 0.1, 0.6, 1), cheese, c.head, [0, 0.02, 0]); c.data.breath = hb;
        for (const sx of [-1, 1]) {
          const st = c.group(c.head, [sx * 0.06, 0.06, 0.02], [0, 0, -sx * 0.25]);
          c.mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.14, 8), metal, st, [0, 0.07, 0]);
          c.eyes(st, { y: 0.16, z: 0, count: 1, r: 0.045, iris: 0x7c2d12 });
          c.jiggle(st, { axis: 'x', freq: 2.6, gain: 0.5 });
        }
        c.mouth(c.head, { y: -0.01, z: 0.1, w: 0.035 });
        c.buildArms({ parent: c.head, w: 0.14, y: 0.0, L1: 0.13, L2: 0.12, r: 0.017, mat: metal, handMat: c.M(0xffffff, 0.5), hand: 0.032, splay: 0.5 });
      },
      tick(c, k) { c.data.wheel.rotation.x = k.spin; if (c.arms) { c.arms.L.shoulder.rotation.x = -0.3 + 0.15 * Math.sin(k.time * 3); c.arms.R.shoulder.rotation.x = -0.3 - 0.15 * Math.sin(k.time * 3); } }
    },
    // 3 ─ Molenbot
    {
      id: 'molenbot', name: 'Molenbot', title: 'Değirmen Robotu', loco: 'biped', stature: 1.8, seed: 33, Fr: 0.2, color: 0x7c2d12,
      desc: 'Zaanse Schans’tan emekli olmuş, rüzgârla çalışan nazik bir yel değirmeni robotu.',
      math: ['Gövde: 8. harmonik Fourier kesitli konik dönel yüzey', 'Kanat açısal hızı ω = k·v + rüzgâr fBm', 'Alexander dinamik benzerlik λ = 2.3·L·Fr^0.3 + IK'],
      build(c) {
        const wood = c.M(0x7c2d12, 0.7), steel = c.M(0x475569, 0.35, 0.8), roof = c.M(0x1f2937, 0.6), sail = c.M(0xf5f5f4, 0.8, 0, { side: THREE.DoubleSide });
        c.buildLegs({ L1: 0.36, L2: 0.36, hipW: 0.12, r1: 0.05, r2: 0.04, mat: steel, footMat: wood, footLen: 0.2, footH: 0.045 });
        const tower = c.mesh(fourierLathe([[0.2, 0], [0.22, 0.1], [0.19, 0.4], [0.15, 0.62]], [[8, 0.06]], { cols: 40 }), wood, c.spine);
        c.data.breath = tower;
        c.head.position.y = 0.62;
        c.mesh(new THREE.ConeGeometry(0.2, 0.26, 8), roof, c.head, [0, 0.13, 0]);
        c.data.headPitch0 = 0;
        c.eyes(c.spine, { y: 0.45, z: 0.17, sep: 0.07, r: 0.045, iris: 0xfbbf24, glow: true, sclera: 0xfef3c7 });
        c.mouth(c.spine, { y: 0.33, z: 0.185, w: 0.04, color: 0x1f2937 });
        const hub = c.group(c.spine, [0, 0.5, -0.2]); c.data.hub = hub;
        c.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 10), steel, hub, [0, 0, 0], [Math.PI / 2, 0, 0]);
        for (let i = 0; i < 4; i++) {
          const arm = c.group(hub, [0, 0, -0.03], [0, 0, i * Math.PI / 2]);
          c.mesh(new THREE.BoxGeometry(0.02, 0.5, 0.015), wood, arm, [0, 0.27, 0]);
          c.mesh(new THREE.BoxGeometry(0.12, 0.38, 0.006), sail, arm, [0.07, 0.32, 0]);
        }
        c.buildArms({ w: 0.21, y: 0.5, L1: 0.25, L2: 0.23, r: 0.032, mat: steel, handMat: wood, hand: 0.045 });
      },
      tick(c, k, dt, t, v) { c.data.hub.rotation.z += dt * (0.6 + 2.2 * v + 0.8 * fbm1(t * 0.3)); }
    },
    // 4 ─ Stroopie
    {
      id: 'stroopie', name: 'Stroopie', title: 'Stroopwafel Golemi', loco: 'biped', stature: 1.25, seed: 44, Fr: 0.24, color: 0xc98a3e,
      desc: 'Gouda fırınlarından çıkmış, içi karamel şurubuyla dolu sıcak bir stroopwafel.',
      math: ['Disk gövde: ε₁=0.3 süperkuadrik + çapraz ızgara dokusu', 'Karamel damlası: yerçekimli Verlet zinciri', 'Kollar: sürülen sönümlü sarkaç ω₀=√(3g/2L)'],
      build(c) {
        const waf = c.M(0xffffff, 0.75, 0, { map: waffleTex() }), syrup = c.M(0x92400e, 0.2, 0, { emissive: 0x3b1405, emissiveIntensity: 0.3 });
        c.buildLegs({ L1: 0.22, L2: 0.21, hipW: 0.09, r1: 0.035, r2: 0.03, mat: c.M(0xa16207, 0.7), footMat: c.M(0x78350f, 0.6), footLen: 0.13 });
        const body = c.group(c.spine, [0, 0.36, 0]);
        for (const z of [-0.045, 0.045]) c.mesh(c.SQ(0.36, 0.035, 0.36, 0.3, 1, { cols: 40, uv: 'xz' }), waf, body, [0, 0, z], [Math.PI / 2, 0, 0]);
        c.mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 40), syrup, body, [0, 0, 0], [Math.PI / 2, 0, 0]);
        c.data.breath = body;
        c.head.position.set(0, 0.42, 0.09);
        c.eyes(c.head, { y: 0.05, z: 0.02, sep: 0.09, r: 0.05, iris: 0x7c2d12 });
        c.mouth(c.head, { y: -0.08, z: 0.04, w: 0.06, t: 0.01 });
        c.data.noHeadMove = true;
        c.buildArms({ w: 0.36, y: 0.4, L1: 0.16, L2: 0.15, r: 0.022, mat: c.M(0xa16207, 0.7), splay: 0.3 });
        const drip = c.group(c.spine, [0.12, 0.06, 0.03]);
        c.chain(drip, { n: 5, seg: 0.025, dir: [0, -1, 0], stiffness: 0.02, damping: 0.05, mat: syrup, radius: s => 0.012 * (1 - 0.5 * s) + 0.008 * s, radial: 6 });
      }
    },
    // 5 ─ Grachtkikker
    {
      id: 'kikker', name: 'Grachtkikker', title: 'Kanal Kurbağası', loco: 'hop', stature: 0.8, seed: 55, speed: 1.2, hopH: 0.24, contact: 0.2, squash: 0.25, color: 0x65a30d,
      desc: 'Prinsengracht’ın nilüferleri arasında büyümüş, şarkı söylemeyi seven bir kurbağa.',
      math: ['Balistik yörünge y = v₀t − ½gt², v₀ = √(2gh)', 'Hacim koruma: sx = sz = 1/√sy', 'Sırt benekleri: Vogel phyllotaxis rₙ=c√n, θₙ=137.5°·n'],
      build(c) {
        const skin = c.M(0x65a30d, 0.45), belly = c.M(0xd9f99d, 0.6), spot = c.M(0x365314, 0.6);
        c.pelvis.position.y = 0.18;
        const body = c.mesh(c.SQ(0.24, 0.2, 0.26, 0.8, 1, { deform: taper(-0.15, -0.1, 0.2) }), skin, c.spine, [0, 0.1, 0]);
        c.mesh(c.SQ(0.19, 0.15, 0.1, 0.9, 1), belly, c.spine, [0, 0.06, 0.17]);
        const sac = c.mesh(c.sphere(0.07), c.M(0xfef9c3, 0.3), c.spine, [0, -0.02, 0.2]); c.data.sac = sac;
        for (const p of vogel(13, 0.05)) c.mesh(c.sphere(0.022, 8, 6), spot, c.spine, [Math.cos(p.th) * p.r, 0.28 - p.r * 0.3, Math.sin(p.th) * p.r * 1.1 - 0.05], [0, 0, 0], [1, 0.35, 1]);
        c.head.position.set(0, 0.2, 0.08);
        for (const sx of [-1, 1]) c.mesh(c.sphere(0.07), skin, c.head, [sx * 0.11, 0.06, 0.02]);
        c.eyes(c.head, { y: 0.09, z: 0.06, sep: 0.11, r: 0.055, iris: 0xca8a04 });
        c.mouth(c.head, { y: -0.02, z: 0.2, w: 0.12, t: 0.009, arc: 0.6 });
        c.data.breath = body;
        c.data.legs = [];
        for (const sx of [-1, 1]) {
          const hip = c.group(c.spine, [sx * 0.17, 0.0, -0.1]);
          c.mesh(capsuleGeo(0.05, 0.035, 0.16), skin, hip);
          const knee = c.group(hip, [0, -0.16, 0]);
          c.mesh(capsuleGeo(0.03, 0.025, 0.15), skin, knee);
          const foot = c.mesh(c.SQ(0.06, 0.012, 0.08, 0.5, 0.6), skin, knee, [0, -0.16, 0.05]);
          c.data.legs.push({ hip, knee, foot, sx });
        }
        c.buildArms({ w: 0.15, y: 0.12, z: 0.12, L1: 0.07, L2: 0.07, r: 0.022, mat: skin, hand: 0.03, splay: 0.4 });
      },
      tick(c, k, dt, t) {
        const h = k.hop, ext = h.air ? Math.sin(Math.PI * Math.min(1, h.u * 1.6)) : 0;
        for (const L of c.data.legs) { L.hip.rotation.x = lerp(-1.1, 0.4, ext); L.knee.rotation.x = lerp(2.2, 0.6, ext); L.hip.rotation.z = L.sx * 0.5; }
        c.data.sac.scale.setScalar(1 + 0.35 * Math.max(0, Math.sin(t * 2.4)) * (h.air ? 0 : 1));
      }
    },
    // 6 ─ Fietsgeest
    {
      id: 'fietsgeest', name: 'Fietsgeest', title: 'Bisiklet Hayaleti', loco: 'hover', stature: 1.6, seed: 66, speed: 1.5, hoverH: 0.3, hoverA: 0.08, hoverF: 0.4, color: 0xe2e8f0,
      desc: 'Kanala düşen 15.000 bisikletin zilini çalmaya devam eden, iyi kalpli bir hayalet.',
      math: ['Çarşaf: Catmull-Rom profil, etek dalgası Σ sin(kθ − ωt) her kare', 'Atkı: rüzgâr yüklü Verlet zinciri', 'Öne eğilme tanθ = C·v² (aerodinamik sürükleme)'],
      build(c) {
        const sheet = c.M(0xf8fafc, 0.7, 0, { transparent: true, opacity: 0.88, side: THREE.DoubleSide, emissive: 0xcbd5e1, emissiveIntensity: 0.25 });
        c.pelvis.position.y = 0.2;
        const geo = lathe([[0.001, 1.25], [0.2, 1.18], [0.28, 0.95], [0.3, 0.6], [0.34, 0.25], [0.4, 0.0]], { rows: 26, cols: 36 });
        const m = c.mesh(geo, sheet, c.spine, [0, -0.15, 0]);
        c.data.sheet = m; c.data.base = Float32Array.from(geo.attributes.position.array);
        c.head.position.set(0, 0.85, 0);
        c.eyes(c.head, { y: 0.06, z: 0.25, sep: 0.09, r: 0.05, iris: 0x111827, sclera: 0x111827 });
        c.mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 14), c.M(0x111827, 0.5), c.head, [0, -0.07, 0.27]);
        c.buildArms({ w: 0.28, y: 0.5, L1: 0.18, L2: 0.16, r: 0.04, mat: sheet, hand: 0.05, splay: 0.5 });
        const bell = c.mesh(c.SQ(0.04, 0.03, 0.04, 0.6, 1), c.M(0xd4d4d8, 0.2, 1), c.arms.R.elbow, [0, -0.22, 0.03]); c.data.bell = bell;
        const scarf = c.group(c.head, [0.05, -0.12, -0.2]);
        c.chain(scarf, { n: 10, seg: 0.06, dir: [0, -0.2, -1], stiffness: 0.015, damping: 0.06, gravity: 0.4, mat: c.M(0xdc2626, 0.8, 0, { side: THREE.DoubleSide }), radius: s => 0.03, radial: 6 });
      },
      tick(c, k, dt, t, v) {
        const g = c.data.sheet.geometry, p = g.attributes.position.array, b = c.data.base;
        for (let i = 0; i < p.length; i += 3) {
          const x = b[i], y = b[i + 1], z = b[i + 2], w = Math.max(0, 1 - y / 0.6);
          const th = Math.atan2(x, z), amp = w * w * (0.035 + 0.04 * v);
          const d = amp * (Math.sin(7 * th - t * 4.2) + 0.5 * Math.sin(11 * th + t * 2.7));
          const r = Math.hypot(x, z) || 1;
          p[i] = x + (x / r) * d; p[i + 2] = z + (z / r) * d - w * w * v * 0.12; p[i + 1] = y + d * 0.6;
        }
        g.attributes.position.needsUpdate = true; g.computeVertexNormals();
        c.arms.R.shoulder.rotation.x = -1.1 + 0.08 * Math.sin(t * 9);
      }
    },
    // 7 ─ Klompie
    {
      id: 'klompie', name: 'Klompie', title: 'Takunyalı Cüce', loco: 'biped', stature: 1.0, seed: 77, Fr: 0.3, waddle: 0.6, armSwing: 0.6, color: 0xf59e0b,
      desc: 'Tahta takunyalarıyla kaldırımda “tak-tak” müzik yapan neşeli bir bahçe cücesi.',
      math: ['Takunya: Barr incelme + parabolik bükme (kalkık burun)', 'Paytak yürüyüş: pelvis yanal salınımı & yuvarlanma', 'Külah ucu: alt-sönümlü yay ζ=0.18'],
      build(c) {
        const wood = c.M(0xfbbf24, 0.5), coat = c.M(0x1d4ed8, 0.7), beard = c.M(0xf5f5f4, 0.9), hat = c.M(0xdc2626, 0.6);
        c.buildLegs({
          L1: 0.14, L2: 0.13, hipW: 0.08, r1: 0.04, r2: 0.035, mat: c.M(0x166534, 0.7), footH: 0.06,
          foot: (ankle) => c.mesh(c.SQ(0.06, 0.05, 0.13, 0.5, 0.8, { deform: compose(taper(-0.3, 0, 0.13), (x, y, z) => [x, y + 0.9 * Math.max(0, z) * Math.max(0, z), z]) }), wood, ankle, [0, -0.035, 0.05])
        });
        const body = c.mesh(c.SQ(0.2, 0.22, 0.18, 0.9, 1), coat, c.spine, [0, 0.18, 0]); c.data.breath = body;
        c.mesh(new THREE.TorusGeometry(0.19, 0.02, 6, 24), c.M(0x422006, 0.5), c.spine, [0, 0.12, 0], [Math.PI / 2, 0, 0]);
        c.head.position.y = 0.42;
        c.mesh(c.sphere(0.13), skinM(c, 0xf2c5a6), c.head);
        c.mesh(c.sphere(0.04), c.M(0xf9a8a8, 0.6), c.head, [0, -0.01, 0.13]);
        c.mesh(new THREE.ConeGeometry(0.13, 0.26, 18, 1, true), beard, c.head, [0, -0.15, 0.05], [Math.PI, 0, 0]);
        c.eyes(c.head, { y: 0.04, z: 0.1, sep: 0.05, r: 0.028, iris: 0x1e3a8a });
        const hatG = c.mesh(c.SQ(0.135, 0.22, 0.135, 1, 1, { deform: compose(taper(-0.95, -0.95, 0.22), bendZ(-1.1)) }), hat, c.head, [0, 0.13, -0.01]);
        c.jiggle(hatG, { axis: 'x', freq: 1.8, gain: 0.6, zeta: 0.15 });
        c.buildArms({ w: 0.2, y: 0.28, L1: 0.12, L2: 0.11, r: 0.03, mat: coat, handMat: skinM(c, 0xf2c5a6), hand: 0.035, splay: 0.35 });
      }
    },
    // 8 ─ Reiger Ruud
    {
      id: 'reiger', name: 'Reiger Ruud', title: 'Gri Balıkçıl', loco: 'biped', stature: 1.9, seed: 88, Fr: 0.12, lean: 0.2, armSwing: 0.1, noArmSwing: true, color: 0x94a3b8, clearance: 0.16,
      desc: 'Balık tezgâhlarının önünde nöbet tutan, kibar ama sabırsız bir gri balıkçıl.',
      math: ['Ters dizli IK (kuş eklem geometrisi)', 'Baş sabitleme: duruş fazında dünya-sabit, sonra hızlı itme', 'S-boyun: kübik Bézier üzerinde süpürme tüpü'],
      build(c) {
        const grey = c.M(0x94a3b8, 0.7), dark = c.M(0x334155, 0.7), leg = c.M(0xca8a04, 0.5);
        c.buildLegs({ L1: 0.42, L2: 0.46, hipW: 0.07, r1: 0.022, r2: 0.016, mat: leg, reverse: true, footH: 0.02, foot: (a) => { for (const ry of [-0.5, 0, 0.5]) c.mesh(capsuleGeo(0.01, 0.006, 0.12), leg, a, [0, -0.01, 0], [-Math.PI / 2, ry, 0]); } });
        const body = c.mesh(c.SQ(0.15, 0.14, 0.3, 0.9, 1, { deform: taper(0, 0.3, 0.14) }), grey, c.spine, [0, 0.08, -0.04], [0.35, 0, 0]); c.data.breath = body;
        for (const sx of [-1, 1]) c.mesh(c.SQ(0.03, 0.12, 0.26, 0.6, 1), dark, c.spine, [sx * 0.14, 0.1, -0.06], [0.35, 0, 0]);
        const bez = new THREE.CubicBezierCurve3(new V3(0, 0.12, 0.18), new V3(0, 0.45, 0.05), new V3(0, 0.3, 0.32), new V3(0, 0.6, 0.25));
        const tube = new SweepTube(14, 8, s => 0.045 - 0.02 * s, grey); tube.update(bez.getPoints(13)); c.spine.add(tube.mesh);
        c.head.position.set(0, 0.62, 0.25); c.data.headBase = c.head.position.clone();
        c.mesh(c.SQ(0.06, 0.06, 0.08, 0.9, 1), c.M(0xf1f5f9, 0.6), c.head);
        c.mesh(new THREE.ConeGeometry(0.022, 0.24, 10), c.M(0xf59e0b, 0.4), c.head, [0, -0.01, 0.17], [Math.PI / 2, 0, 0]);
        c.mesh(capsuleGeo(0.008, 0.004, 0.12), c.M(0x0f172a, 0.6), c.head, [0, 0.05, -0.04], [-2.2, 0, 0]);
        c.eyes(c.head, { y: 0.02, z: 0.03, sep: 0.05, r: 0.018, iris: 0xeab308, splay: 0.9 });
        c.buildArms({ w: 0.14, y: 0.12, L1: 0.01, L2: 0.01, r: 0.002, mat: grey });
      },
      tick(c, k, dt, t, v) {
        // Kuş baş sabitleme: her adımda baş %70 süre dünyaya göre sabit (z = −v·τ), kalan sürede ileri fırlar
        const s = (k.cyc * 2) % 1, hold = 0.7, A = 0.09 * Math.min(1, v);
        const off = s < hold ? A * (0.5 - s / hold) : A * (-0.5 + (s - hold) / (1 - hold));
        c.head.position.z = c.data.headBase.z + off;
      }
    },
    // 9 ─ Haring Henk
    {
      id: 'haring', name: 'Haring Henk', title: 'Ringa Denizcisi', loco: 'biped', stature: 1.4, seed: 99, Fr: 0.22, color: 0x60a5fa,
      desc: 'Yeni sezon ringasını kutlamak için karaya çıkmış, gümüş pullu bir denizci balık.',
      math: ['Gövde: ε₁=0.7 süperkuadrik + yanal basıklık', 'Kuyruk: yürüyen dalga θ = A·sin(ωt − ks)', 'Pullar: Fibonacci küresi üzerinde 137.5° dağılım'],
      build(c) {
        const silver = c.M(0x93c5fd, 0.25, 0.65), back = c.M(0x1e3a8a, 0.35, 0.5), fin = c.M(0x60a5fa, 0.4, 0.3, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        c.buildLegs({ L1: 0.2, L2: 0.2, hipW: 0.08, r1: 0.032, r2: 0.028, mat: c.M(0xfcd34d, 0.6), footMat: c.M(0xf59e0b, 0.5), footLen: 0.16 });
        const body = c.mesh(c.SQ(0.16, 0.36, 0.22, 0.7, 1, { deform: taper(-0.2, -0.3, 0.36) }), silver, c.spine, [0, 0.3, 0]); c.data.breath = body;
        c.mesh(c.SQ(0.05, 0.3, 0.14, 0.7, 1), back, c.spine, [0, 0.32, -0.1]);
        for (const p of fibonacciSphere(60)) if (p.z > -0.2 && Math.abs(p.y) < 0.8) c.mesh(c.sphere(0.018, 6, 4), c.M(0xe0f2fe, 0.15, 0.9), c.spine, [p.x * 0.16, 0.3 + p.y * 0.34, p.z * 0.21], [0, 0, 0], [1, 1, 0.3]);
        c.head.position.y = 0.6;
        c.eyes(c.head, { y: 0, z: 0.12, sep: 0.09, r: 0.05, iris: 0x0f172a, splay: 0.4 });
        c.mouth(c.head, { y: -0.1, z: 0.17, w: 0.04, t: 0.012, color: 0xbe185d });
        c.mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.06, 20), c.M(0xffffff, 0.6), c.head, [0, 0.12, -0.02]);
        c.mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 20), c.M(0x1e3a8a, 0.6), c.head, [0, 0.1, -0.02]);
        const tail = c.group(c.spine, [0, 0.05, -0.18]); c.data.tail = [];
        let par = tail;
        for (let i = 0; i < 4; i++) { const g = c.group(par, [0, 0, i ? -0.05 : 0]); c.mesh(c.SQ(0.02, 0.06 + i * 0.03, 0.03, 0.8, 1), i === 3 ? fin : silver, g, [0, 0, -0.03]); c.data.tail.push(g); par = g; }
        c.mesh(new THREE.ConeGeometry(0.1, 0.12, 3), fin, c.data.tail[3], [0, 0, -0.08], [-Math.PI / 2, 0, 0], [0.3, 1, 1.4]);
        c.buildArms({ w: 0.17, y: 0.34, L1: 0.001, L2: 0.001, r: 0.001, mat: fin, custom: (sh) => { c.mesh(c.SQ(0.015, 0.1, 0.06, 0.5, 1), fin, sh, [0, -0.08, 0]); return { elbow: sh }; } });
        c.mesh(c.SQ(0.015, 0.1, 0.12, 0.5, 1), fin, c.spine, [0, 0.66, -0.12]);
      },
      tick(c, k, dt, t, v) { c.data.tail.forEach((g, i) => { g.rotation.y = (0.15 + 0.25 * v) * Math.sin(t * (4 + 4 * v) - i * 0.9); }); }
    },
    // 10 ─ Neonmus
    {
      id: 'neonmus', name: 'Neonmus', title: 'Neon Serçe', loco: 'hop', stature: 0.6, seed: 110, speed: 1.0, hopH: 0.15, contact: 0.1, squash: 0.18, color: 0xec4899,
      desc: 'Geceleri tabelaların ışığında parlayan, ritim tutkunu küçük bir serçe.',
      math: ['Kanat çırpma: f = 12 Hz, iki katlı harmonik dalga', 'Kuyruk yelpazesi: altın açılı tüy dizilimi', 'Emisyon parlaklığı L(t) ∝ 1 + 0.3 sin(2πft)'],
      build(c) {
        const body = c.M(0x7c3aed, 0.5), neon = c.M(0xec4899, 0.3, 0, { emissive: 0xec4899, emissiveIntensity: 1.1 });
        c.pelvis.position.y = 0.12; c.data.neon = neon;
        const b = c.mesh(c.SQ(0.13, 0.13, 0.15, 0.9, 1, { deform: taper(0, -0.2, 0.13) }), body, c.spine, [0, 0.1, 0]); c.data.breath = b;
        c.mesh(c.SQ(0.09, 0.08, 0.06, 0.9, 1), c.M(0xfbcfe8, 0.6), c.spine, [0, 0.06, 0.1]);
        c.head.position.set(0, 0.24, 0.04);
        c.mesh(c.sphere(0.09), body, c.head);
        c.mesh(new THREE.ConeGeometry(0.025, 0.07, 8), c.M(0xfacc15, 0.4), c.head, [0, -0.01, 0.1], [Math.PI / 2, 0, 0]);
        c.eyes(c.head, { y: 0.02, z: 0.06, sep: 0.05, r: 0.025, iris: 0x111827, splay: 0.5 });
        c.data.wings = [];
        for (const sx of [-1, 1]) { const w = c.group(c.spine, [sx * 0.11, 0.14, 0]); c.mesh(c.SQ(0.015, 0.1, 0.09, 0.5, 1), neon, w, [sx * 0.01, -0.06, -0.02], [0, 0, sx * 0.2]); c.data.wings.push({ w, sx }); }
        for (let i = 0; i < 5; i++) { const a = (i - 2) * GOLDEN_ANGLE * 0.12; c.mesh(c.SQ(0.02, 0.005, 0.1, 0.5, 1), neon, c.spine, [Math.sin(a) * 0.04, 0.08, -0.17], [0.3, a, 0]); }
        for (const sx of [-1, 1]) c.mesh(capsuleGeo(0.008, 0.006, 0.1), c.M(0xf59e0b, 0.5), c.pelvis, [sx * 0.05, 0, 0]);
      },
      tick(c, k, dt, t) {
        const air = k.hop.air, f = air ? 12 : 0.6;
        for (const { w, sx } of c.data.wings) w.rotation.z = sx * (air ? 0.9 * Math.sin(TAU * f * t) + 0.3 * Math.sin(2 * TAU * f * t) : 0.05);
        c.data.neon.emissiveIntensity = 1.1 * (1 + 0.3 * Math.sin(TAU * 1.5 * t));
      }
    },
    // 11 ─ Schildpad Sjaak
    {
      id: 'schildpad', name: 'Schildpad Sjaak', title: 'Tramvay Kaplumbağası', loco: 'biped', stature: 1.2, seed: 121, Fr: 0.08, waddle: 0.3, color: 0x4d7c0f,
      desc: 'Amsterdam’ın her tramvay hattını ezbere bilen, acelesi hiç olmayan bilge kaplumbağa.',
      math: ['Kabuk plakaları: Voronoi (F₂ − F₁) mesafe alanı', 'Kabuk kubbesi: ε₁=0.55 süperkuadrik', 'Düşük Froude (Fr = 0.08) → kısa, ağır adımlar'],
      build(c) {
        const skin = c.M(0x84cc16, 0.6), shell = c.M(0xffffff, 0.45, 0, { map: voronoiTex(5, 0x4d7c0f, 0x1a2e05) });
        c.buildLegs({ L1: 0.16, L2: 0.15, hipW: 0.12, r1: 0.06, r2: 0.055, mat: skin, footLen: 0.14 });
        const sh = c.mesh(c.SQ(0.3, 0.36, 0.22, 0.55, 1), shell, c.spine, [0, 0.3, -0.1]); c.data.breath = sh;
        c.mesh(c.SQ(0.24, 0.3, 0.08, 0.6, 1), c.M(0xfde68a, 0.6), c.spine, [0, 0.28, 0.08]);
        c.head.position.set(0, 0.62, 0.08);
        c.mesh(c.SQ(0.12, 0.11, 0.13, 0.85, 1), skin, c.head);
        c.eyes(c.head, { y: 0.03, z: 0.1, sep: 0.06, r: 0.03, iris: 0x713f12, lid: 0x65a30d });
        c.mouth(c.head, { y: -0.04, z: 0.12, w: 0.04 });
        c.mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), c.M(0x111827, 0.2, 0.6), c.head, [0.055, 0.03, 0.12]);
        c.buildArms({ w: 0.26, y: 0.4, L1: 0.14, L2: 0.13, r: 0.045, mat: skin, splay: 0.4 });
      }
    },
    // 12 ─ Bolhoed Bas
    {
      id: 'bolhoed', name: 'Bolhoed Bas', title: 'Melon Şapkalı Balon', loco: 'hover', stature: 2.0, seed: 132, speed: 1.1, hoverH: 0.6, hoverA: 0.1, hoverF: 0.35, color: 0x0ea5e9,
      desc: 'Kral Günü’nde bir çocuğun elinden kaçıp kendine melon şapka bulan nazik balon.',
      math: ['Balon: damla profilli Catmull-Rom dönel yüzey', 'İp: 14 düğümlü Verlet zinciri, yerçekimi + sönüm', 'Kaldırma kuvveti dengesi: y(t) = h₀ + A sin(2πft) + fBm'],
      build(c) {
        const ball = c.M(0x0ea5e9, 0.15, 0, { physical: true, clearcoat: 1, clearcoatRoughness: 0.1 });
        c.pelvis.position.y = 0.45;
        c.head.position.y = 0.2;
        const b = c.mesh(lathe([[0.001, -0.02], [0.06, 0.0], [0.24, 0.18], [0.3, 0.42], [0.22, 0.66], [0.001, 0.72]], { rows: 26, cols: 30 }), ball, c.head, [0, 0, 0]); c.data.breath = b;
        c.mesh(new THREE.ConeGeometry(0.035, 0.05, 10), ball, c.head, [0, -0.03, 0], [Math.PI, 0, 0]);
        c.eyes(c.head, { y: 0.42, z: 0.26, sep: 0.09, r: 0.05, iris: 0x1e293b });
        c.mouth(c.head, { y: 0.3, z: 0.28, w: 0.05, t: 0.01 });
        const hat = c.group(c.head, [0, 0.68, 0]);
        c.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), c.M(0x111827, 0.5), hat);
        c.mesh(c.SQ(0.14, 0.12, 0.14, 0.7, 1), c.M(0x111827, 0.5), hat, [0, 0.04, 0]);
        c.jiggle(hat, { axis: 'z', freq: 1.4, gain: 0.5, src: 'turn' });
        c.buildArms({ parent: c.head, w: 0.28, y: 0.3, L1: 0.001, L2: 0.001, r: 0.001, mat: ball, custom: (sh) => ({ elbow: sh }) });
        const tie = c.group(c.head, [0, -0.04, 0]);
        const weight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), c.M(0xf59e0b, 0.5)); weight.castShadow = true;
        c.chain(tie, { n: 14, seg: 0.05, dir: [0, -1, 0], stiffness: 0.004, damping: 0.03, mat: c.M(0xf8fafc, 0.8), radius: () => 0.005, radial: 4, tip: weight });
      }
    },
    // 13 ─ Kristal Kees
    {
      id: 'kristal', name: 'Kristal Kees', title: 'Kristal Golem', loco: 'biped', stature: 1.95, seed: 143, Fr: 0.15, color: 0x67e8f9,
      desc: 'Elmas kesimcilerinin atölyesinde doğmuş, ışığı kırarak konuşan bir kristal dev.',
      math: ['Yüzeyler: düz gölgeli ikosahedron/oktahedron çokyüzlüler', 'Yörünge kristalleri: Kepler 3. yasası ω ∝ r^−3/2', 'Çekirdek parıltısı: kritik sönümlü nabız'],
      build(c) {
        const cr = c.M(0xa5f3fc, 0.08, 0.1, { physical: true, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.9, emissive: 0x0e7490, emissiveIntensity: 0.25 });
        const dark = c.M(0x155e75, 0.2, 0.2, { flatShading: true });
        c.buildLegs({ L1: 0.4, L2: 0.4, hipW: 0.14, r1: 0.07, r2: 0.06, mat: dark, foot: (a) => c.mesh(new THREE.OctahedronGeometry(0.09, 0), cr, a, [0, -0.03, 0.04], [0, 0, 0], [1, 0.5, 1.5]) });
        c.mesh(new THREE.IcosahedronGeometry(0.3, 0), cr, c.spine, [0, 0.34, 0], [0, 0, 0], [1, 1.25, 0.8]);
        const core = c.mesh(new THREE.OctahedronGeometry(0.1, 0), c.M(0xf0abfc, 0.1, 0, { emissive: 0xd946ef, emissiveIntensity: 1.5 }), c.spine, [0, 0.36, 0.05]); c.data.core = core; c.data.breath = core;
        c.head.position.y = 0.72;
        c.mesh(new THREE.DodecahedronGeometry(0.14, 0), cr, c.head, [0, 0.08, 0]);
        c.eyes(c.head, { y: 0.1, z: 0.11, sep: 0.06, r: 0.03, iris: 0xf0abfc, glow: true, sclera: 0xe0f2fe });
        c.buildArms({ w: 0.3, y: 0.55, L1: 0.3, L2: 0.28, r: 0.055, mat: dark, foreMat: cr, hand: 0.08 });
        c.data.orbit = [];
        for (let i = 0; i < 5; i++) { const r = 0.25 + i * 0.07; const m = c.mesh(new THREE.OctahedronGeometry(0.03, 0), cr, c.head, [r, 0.1, 0]); c.data.orbit.push({ m, r, th: i * GOLDEN_ANGLE, inc: 0.3 * Math.sin(i * 2.1) }); }
      },
      tick(c, k, dt, t) {
        for (const o of c.data.orbit) { o.th += dt * 1.6 * Math.pow(o.r / 0.25, -1.5); o.m.position.set(Math.cos(o.th) * o.r, 0.12 + Math.sin(o.th) * o.r * o.inc, Math.sin(o.th) * o.r); o.m.rotation.y += dt * 3; }
        c.data.core.material.emissiveIntensity = 1.2 + 0.8 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 8);
      }
    },
    // 14 ─ Mistral
    {
      id: 'mistral', name: 'Mistral', title: 'Sis Ruhu', loco: 'hover', stature: 1.4, seed: 154, speed: 1.3, hoverH: 0.35, hoverA: 0.1, hoverF: 0.3, color: 0xcbd5e1,
      desc: 'Sabah sisiyle kanallardan yükselen, kahve kokusuna dayanamayan utangaç bir ruh.',
      math: ['Bulut: 34 kürecik Fibonacci küresi dağılımı', 'Her kürecik yarıçapı: fBm(t) zaman gürültüsü', 'Lissajous 3:2 süzülme + yatış dinamiği'],
      build(c) {
        const fog = c.M(0xe2e8f0, 0.9, 0, { transparent: true, opacity: 0.55, depthWrite: false, emissive: 0x94a3b8, emissiveIntensity: 0.3 });
        c.pelvis.position.y = 0.4; c.data.puffs = [];
        fibonacciSphere(34).forEach((p, i) => { const m = c.mesh(c.sphere(0.13, 10, 8), fog, c.spine, [p.x * 0.28, 0.35 + p.y * 0.36, p.z * 0.24]); m.castShadow = false; c.data.puffs.push({ m, p, s: i * 1.7 }); });
        c.head.position.set(0, 0.42, 0.33);
        c.eyes(c.head, { y: 0, z: 0.05, sep: 0.09, r: 0.05, iris: 0x38bdf8, glow: true, sclera: 0xe0f2fe });
        c.mouth(c.head, { y: -0.09, z: 0.07, w: 0.03, color: 0x475569 });
        c.chain(c.pelvis, { n: 7, seg: 0.07, dir: [0, -0.6, -1], stiffness: 0.03, damping: 0.08, gravity: 0.2, mat: fog, radius: s => 0.12 * (1 - 0.8 * s), radial: 8 });
      },
      tick(c, k, dt, t) { for (const q of c.data.puffs) q.m.scale.setScalar(0.85 + 0.35 * (0.5 + 0.5 * fbm1(t * 0.5 + q.s))); }
    },
    // 15 ─ Poffertje
    {
      id: 'poffertje', name: 'Poffertje', title: 'Pudra Şekerli Topçuk', loco: 'hop', stature: 0.7, seed: 165, speed: 0.9, hopH: 0.18, contact: 0.18, squash: 0.32, stretch: 0.22, color: 0xd97706,
      desc: 'Pazar tezgâhından zıplayarak kaçan, tereyağı şapkalı minik bir poffertje.',
      math: ['Ağır squash: sy = 1 − 0.32·sin(πt/t_c), sx = 1/√sy', 'Pudra şekeri: Vogel phyllotaxis, 55 nokta', 'Tereyağı: dikey ivme girdili alt-sönümlü yay'],
      build(c) {
        const dough = c.M(0xd97706, 0.6), top = c.M(0x92400e, 0.55);
        c.pelvis.position.y = 0.02;
        const b = c.mesh(c.SQ(0.22, 0.15, 0.22, 0.75, 1), dough, c.spine, [0, 0.15, 0]); c.data.breath = b;
        c.mesh(c.SQ(0.2, 0.06, 0.2, 0.6, 1), top, c.spine, [0, 0.25, 0]);
        for (const p of vogel(55, 0.024)) c.mesh(c.sphere(0.009, 5, 4), c.M(0xffffff, 0.9), c.spine, [Math.cos(p.th) * p.r, 0.305 - p.r * p.r * 1.2, Math.sin(p.th) * p.r]);
        const butter = c.mesh(new THREE.BoxGeometry(0.1, 0.035, 0.1), c.M(0xfde047, 0.3), c.spine, [0, 0.33, 0], [0, 0.4, 0]);
        c.jiggle(butter, { axis: 'z', freq: 2.8, gain: 0.8, src: 'up', zeta: 0.12 });
        c.head.position.set(0, 0.15, 0.17);
        c.eyes(c.head, { y: 0.02, z: 0.03, sep: 0.07, r: 0.035, iris: 0x451a03 });
        c.mouth(c.head, { y: -0.05, z: 0.04, w: 0.03 });
        for (const sx of [-1, 1]) c.mesh(c.sphere(0.025), c.M(0xfb7185, 0.6, 0, { transparent: true, opacity: 0.6 }), c.head, [sx * 0.1, -0.03, 0.02]);
        c.buildArms({ w: 0.2, y: 0.15, L1: 0.06, L2: 0.05, r: 0.018, mat: dough, splay: 0.8 });
      }
    },
    // 16 ─ Lantaarn Lotte
    {
      id: 'lantaarn', name: 'Lantaarn Lotte', title: 'Fener Direği', loco: 'hop', stature: 1.95, seed: 176, speed: 1.0, hopH: 0.12, slipK: 9000, squash: 0.08, stretch: 0.05, hopPitch: 0.05, color: 0xfbbf24,
      desc: 'Köprü başındaki fener direği; geceleri tek ayağıyla zıplayarak dükkânlara uğrar.',
      math: ['SLIP yay-kütle modeli: temas süresi t_c = π√(m/k)', 'Fener: sürülen sarkaç, ω₀ = √(g/ℓ)', 'Işık şiddeti: 2700 K sıcak beyaz + titreme fBm'],
      build(c) {
        const iron = c.M(0x1f2937, 0.4, 0.8), glass = c.M(0xfef3c7, 0.1, 0, { emissive: 0xfbbf24, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 });
        c.pelvis.position.y = 0.05;
        c.mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 16), iron, c.pelvis);
        const pole = c.mesh(lathe([[0.05, 0], [0.04, 0.4], [0.035, 1.2], [0.05, 1.3], [0.03, 1.35]], { cols: 14 }), iron, c.spine, [0, 0.02, 0]); c.data.breath = pole;
        c.head.position.y = 1.4; c.data.noHeadTurn = true;
        const arm = c.group(c.spine, [0, 1.38, 0]);
        c.mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), iron, arm, [0, 0, 0.1], [0, Math.PI / 2, 0]);
        const lamp = c.group(arm, [0, 0, 0.2]); lamp.scale.setScalar(1.45); c.data.lamp = lamp; c.data.lst = { x: 0, v: 0 };
        c.mesh(fourierLathe([[0.04, 0], [0.1, -0.08], [0.09, -0.24], [0.03, -0.3]], [[6, 0.08]], { cols: 24 }), glass, lamp);
        c.mesh(new THREE.ConeGeometry(0.12, 0.08, 6), iron, lamp, [0, 0.02, 0]);
        c.eyes(lamp, { y: -0.13, z: 0.09, sep: 0.035, r: 0.022, iris: 0x92400e });
        c.data.glass = glass;
        c.buildArms({ w: 0.05, y: 0.9, L1: 0.18, L2: 0.15, r: 0.016, mat: iron, splay: 0.8 });
      },
      tick(c, k, dt, t) {
        const l = 0.3, w0 = Math.sqrt(G / l);
        const th = oscStep(c.data.lst, 0, w0, 0.12, dt, -(k.aFwd * 0.6 + k.aUp * 0.05) / l);
        c.data.lamp.rotation.x = clamp(th, -0.7, 0.7);
        c.data.glass.emissiveIntensity = 1.3 + 0.25 * fbm1(t * 6 + k.seed);
      }
    },
    // 17 ─ Zeepbel
    {
      id: 'zeepbel', name: 'Zeepbel', title: 'Sabun Köpüğü', loco: 'hover', stature: 1.2, seed: 187, speed: 1.0, hoverH: 0.4, hoverA: 0.12, hoverF: 0.28, color: 0xa5b4fc,
      desc: 'Bir sokak sanatçısının dev köpüğünden doğan, patlamaktan korkan narin bir varlık.',
      math: ['Yüzey: küresel harmonikler Y₂⁰, Y₂², Y₃⁰, Y₃³ toplamı', 'Mod frekansları Rayleigh: ωₗ ∝ √(l(l−1)(l+2))', 'İnce film girişimi I(λ) ∝ sin²(2π·n·d·cosθₜ/λ)'],
      build(c) {
        const film = thinFilmMaterial(); c.data.film = film;
        c.pelvis.position.y = 0.4;
        const geo = new THREE.SphereGeometry(0.38, 40, 28);
        const m = c.mesh(geo, film, c.spine, [0, 0.0, 0]); m.castShadow = false; m.renderOrder = 2;
        c.data.bub = m; c.data.dirs = Float32Array.from(geo.attributes.position.array).map(x => x / 0.38);
        c.data.modes = [[2, 0], [2, 2], [3, 0], [3, 3]].map(([l, mm]) => ({ l, m: mm, st: { x: 0, v: 0 }, w: 3.2 * Math.sqrt(l * (l - 1) * (l + 2)) / Math.sqrt(8) }));
        c.head.position.set(0, -0.02, 0.05);
        c.eyes(c.head, { y: 0.05, z: 0.1, sep: 0.07, r: 0.04, iris: 0x6366f1 });
        c.mouth(c.head, { y: -0.06, z: 0.12, w: 0.025, arc: 0.7 });
        c.mesh(c.sphere(0.1), c.M(0xe0e7ff, 0.3, 0, { transparent: true, opacity: 0.35 }), c.head, [0, 0, 0.05]);
      },
      tick(c, k, dt, t, v) {
        const d = c.data, pos = d.bub.geometry.attributes.position.array, dirs = d.dirs;
        for (const md of d.modes) oscStep(md.st, 0, md.w, 0.06, dt, (k.aFwd * 0.6 + k.aUp * 0.2 + fbm1(t * 1.3 + md.l * 7) * 1.5) * md.w);
        const [a20, a22, a30, a33] = d.modes.map(m => clamp(m.st.x * 0.04, -0.12, 0.12));
        for (let i = 0; i < pos.length; i += 3) {
          const x = dirs[i], y = dirs[i + 1], z = dirs[i + 2];
          const ct = y, st2 = 1 - y * y, phi = Math.atan2(z, x), stt = Math.sqrt(Math.max(0, st2));
          const Y20 = 0.5 * (3 * ct * ct - 1), Y22 = st2 * Math.cos(2 * phi), Y30 = 0.5 * (5 * ct * ct * ct - 3 * ct), Y33 = stt * st2 * Math.cos(3 * phi);
          const r = 0.38 * (1 + a20 * Y20 + a22 * Y22 + a30 * Y30 + a33 * Y33 + 0.015 * Math.sin(t * 2 + y * 6));
          pos[i] = x * r; pos[i + 1] = y * r * (1 - 0.06 * Math.min(1, v)); pos[i + 2] = z * r;
        }
        d.bub.geometry.attributes.position.needsUpdate = true; d.bub.geometry.computeVertexNormals();
        d.film.userData.uThick.value = 0.32 + 0.12 * Math.sin(t * 0.4) + 0.03 * fbm1(t);
      }
    },
    // 18 ─ Draaiorgel Dirk
    {
      id: 'draaiorgel', name: 'Draaiorgel Dirk', title: 'Laterna Robotu', loco: 'roll', stature: 1.65, seed: 198, speed: 1.2, wheelR: 0.26, color: 0xbe123c,
      desc: 'Kalverstraat’ta melodiler çalan, bıyıklı ve gururlu bir laterna.',
      math: ['Borular: harmonik seri uzunlukları Lₙ = L₁/n (kapalı uçlu boru fₙ ∝ 1/L)', 'Tekerlek: ω = v/r, manivela açısı = 2·spin', 'Yatış φ = atan(v·ω/g)'],
      build(c) {
        const red = c.M(0xbe123c, 0.4), gold = c.M(0xfbbf24, 0.25, 0.9), wood = c.M(0x78350f, 0.6);
        const R = c.def.wheelR; c.data.wheels = [];
        for (const sx of [-1, 1]) {
          const w = c.group(c.body, [sx * 0.3, R, 0]);
          c.mesh(new THREE.TorusGeometry(R, 0.025, 8, 28), c.M(0x1f2937, 0.5), w, [0, 0, 0], [0, Math.PI / 2, 0]);
          for (let i = 0; i < 8; i++) c.mesh(new THREE.CylinderGeometry(0.008, 0.008, R * 2, 6), gold, w, [0, 0, 0], [i * Math.PI / 8, 0, 0]);
          c.data.wheels.push(w);
        }
        const box = c.mesh(c.SQ(0.26, 0.32, 0.2, 0.25, 0.25), red, c.body, [0, R + 0.32, 0]); c.data.breath = box;
        for (let n = 1; n <= 7; n++) { const L = 0.42 / Math.pow(n, 0.75); c.mesh(new THREE.CylinderGeometry(0.018, 0.018, L, 10), gold, c.body, [-0.2 + (n - 1) * 0.067, R + 0.18 + L / 2, 0.205]); }
        c.head.position.set(0, R + 0.7, 0.02); c.body.add(c.head);
        c.mesh(c.SQ(0.2, 0.08, 0.15, 0.3, 0.3), wood, c.head, [0, -0.02, 0]);
        c.eyes(c.head, { y: 0.03, z: 0.13, sep: 0.07, r: 0.04, iris: 0x14532d });
        for (const sx of [-1, 1]) c.mesh(c.SQ(0.06, 0.012, 0.012, 0.6, 1, { deform: (x, y, z) => [x, y + 2.5 * x * x, z] }), c.M(0x111827, 0.6), c.head, [sx * 0.05, -0.04, 0.15]);
        const crank = c.group(c.body, [0.29, R + 0.32, 0]); c.data.crank = crank;
        c.mesh(new THREE.BoxGeometry(0.02, 0.02, 0.15), wood, crank, [0.015, 0, 0.07]);
        c.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), wood, crank, [0.05, 0, 0.14], [0, 0, Math.PI / 2]);
        c.buildArms({ parent: c.body, w: 0.27, y: R + 0.5, L1: 0.18, L2: 0.16, r: 0.025, mat: wood, handMat: c.M(0xffffff, 0.5), hand: 0.04 });
      },
      tick(c, k) { for (const w of c.data.wheels) w.rotation.x = k.spin; c.data.crank.rotation.x = k.spin * 2 + k.time * 2; c.arms.R.shoulder.rotation.x = -0.6 + 0.3 * Math.sin(k.spin * 2 + k.time * 2); }
    },
    // 19 ─ Pindakaas Piet
    {
      id: 'pindakaas', name: 'Pindakaas Piet', title: 'Fıstık Ezmesi Kavanozu', loco: 'biped', stature: 1.3, seed: 209, Fr: 0.25, color: 0xa16207,
      desc: 'Kahvaltı sofralarının kahramanı; kapağını şapka gibi kaldırarak selam verir.',
      math: ['Kavanoz: 5 kontrol noktalı Catmull-Rom profil', 'Cam: yarı saydam fiziksel malzeme + clearcoat', 'Selam: kritik sönümlü kapak açısı'],
      build(c) {
        const glass = c.M(0xe0f2fe, 0.05, 0, { physical: true, transparent: true, opacity: 0.35, clearcoat: 1 }), pb = c.M(0xa16207, 0.7), lid = c.M(0xdc2626, 0.35, 0.3);
        c.buildLegs({ L1: 0.2, L2: 0.19, hipW: 0.09, r1: 0.035, r2: 0.03, mat: c.M(0x1e293b, 0.7), footLen: 0.15 });
        const prof = [[0.001, 0], [0.22, 0.01], [0.24, 0.1], [0.24, 0.45], [0.18, 0.52], [0.16, 0.56]];
        c.mesh(lathe(prof, { cols: 30 }), glass, c.spine, [0, 0, 0]).renderOrder = 2;
        const fill = c.mesh(lathe(prof.slice(0, 4).map(([r, y]) => [r * 0.95, y * 0.95 + 0.005]), { cols: 30 }), pb, c.spine); c.data.breath = fill;
        c.mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.14, 30, 1, true), c.M(0xffffff, 0.7, 0, { map: labelTex('PINDA', '#fef3c7', '#b45309'), side: THREE.DoubleSide }), c.spine, [0, 0.22, 0], [0, 0, 0], [1, 1, 1]);
        c.head.position.y = 0.56; c.data.noHeadTurn = true;
        const lidG = c.group(c.head, [0, 0, -0.17]); c.data.lid = lidG; c.data.ls = { x: 0, v: 0 }; c.data.lidT = 4;
        c.mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 28), lid, lidG, [0, 0.03, 0.17]);
        c.eyes(c.spine, { y: 0.38, z: 0.235, sep: 0.07, r: 0.045, iris: 0x7c2d12 });
        c.mouth(c.spine, { y: 0.31, z: 0.245, w: 0.04 });
        c.buildArms({ w: 0.25, y: 0.35, L1: 0.15, L2: 0.14, r: 0.025, mat: c.M(0x1e293b, 0.7), handMat: c.M(0xffffff, 0.6), hand: 0.04 });
      },
      tick(c, k, dt) { const d = c.data; d.lidT -= dt; if (d.lidT < -1.2) d.lidT = 5 + 4 * k.rnd(); critSpring(d.ls, d.lidT < 0 ? -0.9 : 0, 9, dt); d.lid.rotation.x = d.ls.x; }
    },
    // 20 ─ Kraai Karel
    {
      id: 'kraai', name: 'Kraai Karel', title: 'Meraklı Karga', loco: 'hop', stature: 0.75, seed: 220, speed: 1.1, hopH: 0.12, contact: 0.12, squash: 0.12, color: 0x111827,
      desc: 'Parlak bozuk paraları toplayan, kasadaki her kuruşu sayabilen zeki bir karga.',
      math: ['İki ayaklı balistik sekme (kargagiller)', 'Merak eğilmesi: baş yuvarlanma açısı sakkadlara bağlı', 'Kanat: zarf fonksiyonlu sinüs çırpma'],
      build(c) {
        const blk = c.M(0x111827, 0.25, 0.3, { physical: true, clearcoat: 0.6 });
        c.pelvis.position.y = 0.14;
        const b = c.mesh(c.SQ(0.12, 0.14, 0.2, 0.85, 1, { deform: taper(0, -0.3, 0.14) }), blk, c.spine, [0, 0.12, 0], [0.3, 0, 0]); c.data.breath = b;
        c.mesh(c.SQ(0.08, 0.01, 0.16, 0.5, 1), blk, c.spine, [0, 0.08, -0.2], [0.4, 0, 0]);
        c.head.position.set(0, 0.28, 0.1);
        c.mesh(c.sphere(0.085), blk, c.head);
        c.mesh(new THREE.ConeGeometry(0.03, 0.13, 8), c.M(0x374151, 0.3, 0.4), c.head, [0, -0.01, 0.12], [Math.PI / 2, 0, 0]);
        c.eyes(c.head, { y: 0.02, z: 0.05, sep: 0.055, r: 0.022, iris: 0x7dd3fc, splay: 0.7 });
        c.data.wings = [];
        for (const sx of [-1, 1]) { const w = c.group(c.spine, [sx * 0.11, 0.18, 0]); c.mesh(c.SQ(0.015, 0.11, 0.15, 0.5, 1), blk, w, [0, -0.06, -0.04]); c.data.wings.push({ w, sx }); }
        for (const sx of [-1, 1]) c.mesh(capsuleGeo(0.008, 0.006, 0.13), c.M(0x374151, 0.5), c.pelvis, [sx * 0.05, 0, 0]);
        const coin = c.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), c.M(0xfbbf24, 0.2, 1), c.head, [0, -0.03, 0.17], [Math.PI / 2, 0, 0]); c.data.coin = coin;
      },
      tick(c, k, dt, t) {
        c.head.rotation.z = 0.35 * Math.sin(k.gaze.yaw * 3) * (k.v.x < 0.2 ? 1 : 0.2);
        const air = k.hop.air;
        for (const { w, sx } of c.data.wings) w.rotation.z = sx * (air ? 0.5 * Math.sin(TAU * 7 * t) * Math.sin(Math.PI * k.hop.u) : 0);
      }
    },
    // 21 ─ Vlinder Vera
    {
      id: 'vlinder', name: 'Vlinder Vera', title: 'Kelebek Kanatlı', loco: 'hover', stature: 1.35, seed: 231, speed: 1.2, hoverH: 0.5, hoverA: 0.07, hoverF: 0.7, color: 0xf97316,
      desc: 'Hortus Botanicus seralarından süzülüp gelen, kanatları gün batımı renkli bir kelebek.',
      math: ['Kanat: Fay kelebek eğrisi r = e^{sinθ} − 2cos4θ + sin⁵((2θ−π)/24)', 'Çırpma: θ(t) = A·sin(2πft) + ½A·sin(4πft + π/3)', 'Antenler: alt-sönümlü yay'],
      build(c) {
        const body = c.M(0x1c1917, 0.5);
        c.pelvis.position.y = 0.3;
        const b = c.mesh(c.SQ(0.05, 0.26, 0.05, 0.9, 1), body, c.spine, [0, 0.2, 0]); c.data.breath = b;
        c.head.position.y = 0.5;
        c.mesh(c.sphere(0.075), c.M(0xfed7aa, 0.6), c.head);
        c.eyes(c.head, { y: 0.01, z: 0.05, sep: 0.035, r: 0.025, iris: 0x7c2d12 });
        c.mouth(c.head, { y: -0.035, z: 0.07, w: 0.015 });
        for (const sx of [-1, 1]) {
          const a = c.group(c.head, [sx * 0.03, 0.06, 0.02], [0.4, 0, -sx * 0.4]);
          c.mesh(capsuleGeo(0.004, 0.004, 0.14), body, a, [0, 0, 0], [Math.PI, 0, 0]);
          c.mesh(c.sphere(0.012), c.M(0xf97316, 0.4), a, [0, 0.145, 0]);
          c.jiggle(a, { axis: 'x', freq: 3, gain: 0.7, zeta: 0.1 });
        }
        const wingTex = canvasTex(256, 256, (ctx, W) => {
          const g = ctx.createRadialGradient(W / 2, W / 2, 10, W / 2, W / 2, W / 2);
          g.addColorStop(0, '#fde047'); g.addColorStop(0.45, '#f97316'); g.addColorStop(0.8, '#9a3412'); g.addColorStop(1, '#1c1917');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
          ctx.fillStyle = '#fff7ed'; for (const p of vogel(30, 18)) { ctx.beginPath(); ctx.arc(W / 2 + Math.cos(p.th) * p.r * 1.2, W / 2 + Math.sin(p.th) * p.r, 3 + p.r / 30, 0, TAU); ctx.fill(); }
        });
        const wmat = c.M(0xffffff, 0.5, 0, { map: wingTex, side: THREE.DoubleSide, transparent: true, opacity: 0.95, emissive: 0x7c2d12, emissiveIntensity: 0.15 });
        c.data.wings = [];
        for (const [sx, half] of [[-1, 'L'], [1, 'R']]) {
          const piv = c.group(c.spine, [0, 0.28, -0.03]);
          const geo = butterflyShape(0.17, half);
          geo.computeBoundingBox(); const bb = geo.boundingBox, uv = geo.attributes.uv, pa = geo.attributes.position;
          for (let i = 0; i < pa.count; i++) uv.setXY(i, (pa.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pa.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
          const m = new THREE.Mesh(geo, wmat); m.castShadow = true; piv.add(m);
          c.data.wings.push({ piv, sx });
        }
        c.buildArms({ w: 0.04, y: 0.3, L1: 0.1, L2: 0.09, r: 0.01, mat: body, hand: 0.015, splay: 0.6 });
      },
      tick(c, k, dt, t, v) {
        const f = 1.4 + 1.2 * v, A = 0.7;
        const th = A * Math.sin(TAU * f * t) + 0.5 * A * Math.sin(2 * TAU * f * t + Math.PI / 3);
        for (const { piv, sx } of c.data.wings) piv.rotation.y = sx * (0.25 + 0.5 * (th + A) / 2);
      }
    },
    // 22 ─ Tegel Tom
    {
      id: 'tegel', name: 'Tegel Tom', title: 'Delft Çini Adam', loco: 'biped', stature: 1.75, seed: 242, Fr: 0.2, color: 0x1e40af,
      desc: 'Bir kanal evinin şömine çinilerinden yürüyüp çıkmış, porselen gibi kibar bir beyefendi.',
      math: ['Gövde: ε₁ = ε₂ = 0.2 yuvarlatılmış küp süperkuadrik', 'Desen: gül eğrisi r = cos(4θ) rozeti', 'Yürüyüş: ters sarkaç + sikloid salınım'],
      build(c) {
        const tile = c.M(0xffffff, 0.12, 0, { map: delftTex(), physical: true, clearcoat: 1 }), blue = c.M(0x1e3a8a, 0.15, 0, { physical: true, clearcoat: 1 });
        c.buildLegs({ L1: 0.36, L2: 0.35, hipW: 0.1, r1: 0.055, r2: 0.045, mat: tile, footMat: blue, footLen: 0.18 });
        const torso = c.mesh(c.SQ(0.22, 0.27, 0.13, 0.2, 0.2, { uv: 'box' }), tile, c.spine, [0, 0.26, 0]); c.data.breath = torso;
        c.head.position.y = 0.6;
        c.mesh(c.SQ(0.13, 0.13, 0.12, 0.25, 0.25, { uv: 'box' }), tile, c.head, [0, 0.06, 0]);
        c.eyes(c.head, { y: 0.08, z: 0.11, sep: 0.05, r: 0.026, iris: 0x1e3a8a });
        c.mouth(c.head, { y: -0.0, z: 0.12, w: 0.03, color: 0x1e3a8a });
        c.mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 14), blue, c.head, [0, -0.1, 0.03], [Math.PI / 2, 0, 0]);
        c.buildArms({ w: 0.27, y: 0.46, L1: 0.25, L2: 0.23, r: 0.04, mat: tile, handMat: blue, hand: 0.05 });
      }
    },
    // 23 ─ Slak Saar
    {
      id: 'slak', name: 'Slak Saar', title: 'Salyangoz', loco: 'crawl', stature: 0.9, seed: 253, speed: 0.75, waveF: 1.6, color: 0xb45309,
      desc: 'Vondelpark’tan kahve içmeye gelen, evini sırtında taşıyan sakin bir salyangoz.',
      math: ['Kabuk: Raup log-spiral r(θ) = a·e^{bθ}, b = ln W / 2π, W = 2.1', 'Gövde: peristaltik dalga sₓ(z,t) = 1 + A·sin(kz − ωt)', 'Göz sapları: alt-sönümlü yay (ζ = 0.12)'],
      build(c) {
        const flesh = c.M(0xd6d3d1, 0.35, 0, { physical: true, clearcoat: 0.8 }), shellM = c.M(0xb45309, 0.4, 0, { physical: true, clearcoat: 0.5, side: THREE.DoubleSide });
        c.pelvis.position.y = 0.0; c.data.segs = [];
        for (let i = 0; i < 9; i++) { const z = 0.32 - i * 0.075; const r = 0.1 * Math.sin(Math.PI * (i + 1) / 10) + 0.03; const m = c.mesh(c.SQ(r * 1.05, r * 0.75, 0.06, 0.8, 1), flesh, c.spine, [0, r * 0.65, z]); c.data.segs.push({ m, z, i }); }
        const shell = c.group(c.spine, [0, 0.36, -0.08], [0, Math.PI / 2, 0]); c.data.breath = shell;
        c.mesh(raupShell({ W: 2.1, turns: 3.4, a: 0.2, r: 0.6, D: 0.1 }), shellM, shell, [0, 0, 0], [0, 0, 0], 1);
        c.head.position.set(0, 0.16, 0.38);
        c.mesh(c.SQ(0.09, 0.09, 0.08, 0.9, 1), flesh, c.head);
        c.mouth(c.head, { y: -0.03, z: 0.08, w: 0.025 });
        for (const sx of [-1, 1]) {
          const st = c.group(c.head, [sx * 0.04, 0.06, 0.03], [0.3, 0, -sx * 0.3]);
          c.mesh(capsuleGeo(0.012, 0.01, 0.16), flesh, st, [0, 0, 0], [Math.PI, 0, 0]);
          c.eyes(st, { y: 0.18, z: 0, count: 1, r: 0.03, iris: 0x14532d });
          c.jiggle(st, { axis: 'x', freq: 1.8, gain: 0.8, zeta: 0.12 });
        }
      },
      tick(c, k, dt, t, v) {
        for (const s of c.data.segs) { const w = 1 + (0.05 + 0.12 * v) * Math.sin(12 * s.z - k.cyc * TAU); s.m.scale.set(1 / Math.sqrt(w), 1 / Math.sqrt(w), w); }
      }
    },
    // 24 ─ Octo Otto
    {
      id: 'octo', name: 'Octo Otto', title: 'Kanal Ahtapotu', loco: 'crawl', stature: 1.15, seed: 264, speed: 1.0, waveF: 1.0, crawlLift: 0.0, color: 0x9333ea,
      desc: 'IJ nehrinden kanallara karışmış, sekiz koluyla aynı anda sekiz sipariş taşıyabilen ahtapot.',
      math: ['Dokunaçlar: eğrilik integrasyonu κ(s,t) = κ₀ + A·sin(ωt − ks + φᵢ)', 'Teğet açısı ψ(s) = ∫κ ds → elastik çubuk kinematiği', 'Manto: jet nabzı, hacim koruyan ölçekleme'],
      build(c) {
        const skin = c.M(0x9333ea, 0.35, 0, { physical: true, clearcoat: 0.7 }), suck = c.M(0xf5d0fe, 0.5);
        c.pelvis.position.y = 0.32;
        const mantle = c.mesh(c.SQ(0.24, 0.3, 0.26, 0.85, 1, { deform: taper(-0.25, -0.25, 0.3) }), skin, c.spine, [0, 0.28, -0.04], [-0.2, 0, 0]); c.data.mantle = mantle;
        for (const p of vogel(18, 0.05)) c.mesh(c.sphere(0.018, 6, 4), c.M(0xc084fc, 0.4), c.spine, [Math.cos(p.th) * p.r, 0.5 - p.r * 0.4, -0.05 + Math.sin(p.th) * p.r], [0, 0, 0], [1, 0.4, 1]);
        c.head.position.set(0, 0.12, 0.17);
        c.mesh(c.SQ(0.18, 0.12, 0.12, 0.9, 1), skin, c.head);
        c.eyes(c.head, { y: 0.03, z: 0.09, sep: 0.09, r: 0.045, iris: 0xfacc15, lid: 0x7e22ce });
        c.mouth(c.head, { y: -0.06, z: 0.1, w: 0.03 });
        c.data.tent = []; c.data.tmp = Array.from({ length: 12 }, () => new V3());
        for (let i = 0; i < 8; i++) {
          const tube = new SweepTube(12, 7, s => 0.05 * (1 - 0.85 * s) + 0.006, skin);
          c.pelvis.add(tube.mesh);
          c.data.tent.push({ tube, base: i * TAU / 8 + TAU / 16, ph: i * 1.3 });
        }
      },
      tick(c, k, dt, t, v) {
        const d = c.data, Ls = 0.5, n = 12, ds = Ls / (n - 1);
        d.mantle.scale.set(1 + 0.05 * Math.sin(t * 2.2), 1 - 0.07 * Math.sin(t * 2.2), 1 + 0.05 * Math.sin(t * 2.2));
        for (const tn of d.tent) {
          const ca = Math.cos(tn.base), sa = Math.sin(tn.base);
          let psi = -0.15, x = 0.13, y = 0.05;
          for (let j = 0; j < n; j++) {
            const s = j * ds;
            const kappa = 1.6 + (1.8 + 2 * v) * Math.sin(k.cyc * TAU * 1.0 + t * 1.3 - 6 * s + tn.ph);
            if (j > 0) { psi += kappa * ds * (s < 0.15 ? 0.3 : 1); x += Math.cos(psi) * ds; y += Math.sin(-psi) * ds * 0.9; }
            const yy = Math.max(-0.3, y - 0.12 * s);
            d.tmp[j].set(ca * x, yy, sa * x);
          }
          tn.tube.update(d.tmp);
        }
      }
    },
    // 25 ─ Uil Uma
    {
      id: 'uil', name: 'Uil Uma', title: 'Kütüphaneci Baykuş', loco: 'biped', stature: 1.15, seed: 275, Fr: 0.18, waddle: 0.9, gazeRange: 1.5, headFollow: 0.9, headOmega: 11, armSwing: 0.15, color: 0x92400e,
      desc: 'Gece vardiyasının vazgeçilmezi; başını 270° çevirip tüm dükkânı aynı anda izler.',
      math: ['Gövde: Barr incelmeli yumurta süperkuadrik (ε₁ = 0.9)', 'Baş dönüşü ±135°: göz-baş koordinasyonu (baykuş gözü sabit)', 'Paytak yürüyüş: pelvis yuvarlanma genliği 0.9·w'],
      build(c) {
        const feather = c.M(0x92400e, 0.8), chest = c.M(0xfef3c7, 0.85), disk = c.M(0xfde68a, 0.8);
        c.buildLegs({ L1: 0.1, L2: 0.09, hipW: 0.08, r1: 0.035, r2: 0.025, mat: feather, footMat: c.M(0xf59e0b, 0.5), footLen: 0.1 });
        const b = c.mesh(c.SQ(0.24, 0.3, 0.22, 0.9, 1, { deform: taper(0.15, 0.1, 0.3) }), feather, c.spine, [0, 0.26, 0]); c.data.breath = b;
        c.mesh(c.SQ(0.17, 0.22, 0.08, 0.9, 1), chest, c.spine, [0, 0.22, 0.15]);
        for (const p of vogel(24, 0.03)) c.mesh(new THREE.ConeGeometry(0.012, 0.02, 4), c.M(0xb45309, 0.8), c.spine, [Math.cos(p.th) * p.r * 1.1, 0.24 + Math.sin(p.th) * p.r * 1.3, 0.22], [Math.PI / 2, 0, 0]);
        c.head.position.y = 0.58;
        c.mesh(c.SQ(0.2, 0.17, 0.18, 0.85, 1), feather, c.head);
        for (const sx of [-1, 1]) c.mesh(c.SQ(0.085, 0.085, 0.02, 0.9, 1), disk, c.head, [sx * 0.08, 0.0, 0.15]);
        c.eyes(c.head, { y: 0.0, z: 0.17, sep: 0.08, r: 0.05, iris: 0xf59e0b });
        c.mesh(new THREE.ConeGeometry(0.02, 0.06, 6), c.M(0x44403c, 0.5), c.head, [0, -0.07, 0.18], [Math.PI * 0.85, 0, 0]);
        for (const sx of [-1, 1]) { const tuft = c.mesh(new THREE.ConeGeometry(0.035, 0.12, 6), feather, c.head, [sx * 0.13, 0.17, 0], [0, 0, -sx * 0.4]); c.jiggle(tuft, { axis: 'z', freq: 2.4, gain: 0.4 }); }
        c.mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 16), c.M(0xfbbf24, 0.2, 1), c.head, [0.08, 0.0, 0.2]);
        c.buildArms({ w: 0.24, y: 0.42, L1: 0.001, L2: 0.001, r: 0.001, mat: feather, splay: 0.12, custom: (sh, sx) => { c.mesh(c.SQ(0.03, 0.2, 0.13, 0.6, 1, { deform: taper(-0.5, 0, 0.2) }), feather, sh, [sx * 0.01, -0.16, -0.02]); return { elbow: sh }; } });
      }
    }
  ];

  // Froude'a göre doğal yürüme hızı: v = √(Fr·g·L)
  function naturalSpeed(def, ctx) {
    if (def.loco === 'biped' && ctx && ctx.legs) return Math.sqrt((def.Fr || 0.2) * G * (ctx.legs.L1 + ctx.legs.L2));
    return def.speed || 1.2;
  }

  // ===========================================================================
  // 7. KURUCU — oyunun mevcut rig arayüzüyle uyumlu nesne döndürür
  // ===========================================================================
  function build(defOrId) {
    const def = typeof defOrId === 'string' ? CAST.find(d => d.id === defOrId) : defOrId;
    const ctx = new BuildCtx(def);
    def.build(ctx);
    if (def.noHeadTurn || ctx.data.noHeadTurn) def.noHeadTurn = true;
    // Kol / bacak yoksa oyunun beklediği arayüz için boş pivotlar
    if (!ctx.arms) {
      const mk = (sx) => { const shoulder = ctx.group(ctx.spine, [sx * 0.15, 0.2, 0]); const elbow = ctx.group(shoulder, [0, -0.1, 0]); return { shoulder, elbow, sx, len: 0.2 }; };
      ctx.arms = { L: mk(-1), R: mk(1) };
    }
    for (const k of ['L', 'R']) if (!ctx.arms[k].elbow) ctx.arms[k].elbow = ctx.arms[k].shoulder;
    const legs = ctx.legs || { L: { hip: ctx.group(ctx.pelvis), knee: new THREE.Group(), ankle: new THREE.Group() }, R: { hip: ctx.group(ctx.pelvis), knee: new THREE.Group(), ankle: new THREE.Group() } };
    const umbrella = new THREE.Group();
    const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6), ctx.M(0x1f2937, 0.5)); uPole.position.set(0.02, 0.35, 0.15); umbrella.add(uPole);
    const uCan = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.22, 12), ctx.M(def.color || 0x0f766e, 0.45, 0, { side: THREE.DoubleSide })); uCan.position.set(0, 0.78, 0.15); umbrella.add(uCan);
    umbrella.visible = false; ctx.arms.R.elbow.add(umbrella);
    const ctrl = new CastController(ctx);
    const speed = naturalSpeed(def, ctx);
    const rig = {
      group: ctx.root, stature: def.stature, baseHipY: ctx.pelvis.position.y,
      pelvisPivot: ctx.pelvis, spinePivot: ctx.spine, headPivot: ctx.head,
      torsoMesh: ctx.data.breath || ctx.body,
      legL: legs.L, legR: legs.R, armL: ctx.arms.L, armR: ctx.arms.R, umbrella,
      _cType: def.id,
      cast: { def, ctx, ctrl, speed, update: (dt, sp, t) => ctrl.update(dt, sp, t) }
    };
    return rig;
  }

  // ===========================================================================
  // 8. KARAKTER GALERİSİ (koşu bandı önizlemesi + matematik notları)
  // ===========================================================================
  function mountGallery(opt = {}) {
    if (document.getElementById('cast-gallery')) return;
    const css = document.createElement('style');
    css.textContent = `
    #cast-gallery{position:fixed;inset:0;z-index:40;background:rgba(6,10,16,.82);backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;padding:14px}
    #cast-gallery.open{display:flex}
    #cast-gallery .cg-card{background:#0f1724;border:1px solid rgba(148,163,184,.22);border-radius:18px;width:1040px;max-width:100%;height:min(680px,94vh);display:grid;grid-template-columns:300px 1fr;overflow:hidden;color:#f1f5f9;font-family:inherit}
    #cast-gallery .cg-list{overflow:auto;padding:12px;border-right:1px solid rgba(148,163,184,.16);display:flex;flex-direction:column;gap:6px}
    #cast-gallery .cg-head{display:flex;justify-content:space-between;align-items:center;padding:2px 2px 8px}
    #cast-gallery .cg-head b{font-size:13px;letter-spacing:.06em}
    #cast-gallery .cg-item{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:10px;cursor:pointer;border:1px solid transparent;background:rgba(255,255,255,.03);text-align:left;color:inherit;font:inherit}
    #cast-gallery .cg-item:hover{background:rgba(255,255,255,.07)}
    #cast-gallery .cg-item.on{border-color:#10b981;background:rgba(16,185,129,.14)}
    #cast-gallery .cg-dot{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.12)}
    #cast-gallery .cg-n{font-size:12.5px;font-weight:700}
    #cast-gallery .cg-t{font-size:10.5px;color:#94a3b8}
    #cast-gallery .cg-num{margin-left:auto;font-size:10px;color:#64748b;font-variant-numeric:tabular-nums}
    #cast-gallery .cg-main{display:flex;flex-direction:column;min-width:0}
    #cast-gallery .cg-view{flex:1 1 0;min-height:0;position:relative;background:radial-gradient(ellipse at 50% 35%,#1e293b,#0b1220 70%)}
    #cast-gallery .cg-view canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block;cursor:grab;touch-action:none}
    #cast-gallery .cg-ctrl,#cast-gallery .cg-close{z-index:2}
    #cast-gallery .cg-ctrl{position:absolute;left:12px;bottom:12px;display:flex;gap:6px}
    #cast-gallery .cg-close{position:absolute;right:12px;top:12px}
    #cast-gallery .cg-info{flex:none;max-height:45%;overflow:auto;padding:12px 16px 14px;border-top:1px solid rgba(148,163,184,.16);display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}
    #cast-gallery .cg-info h3{font-size:16px;margin:0;grid-column:1/-1}
    #cast-gallery .cg-info .sub{color:#94a3b8;font-size:11.5px;grid-column:1/-1;margin-bottom:6px}
    #cast-gallery .cg-info p{font-size:12px;color:#cbd5e1;margin:0}
    #cast-gallery .cg-info ul{margin:0;padding-left:16px;font-size:11.5px;color:#a7f3d0;line-height:1.55}
    #cast-gallery .cg-stat{font-size:11px;color:#94a3b8;margin-top:6px;font-variant-numeric:tabular-nums}
    @media (max-width:760px){#cast-gallery .cg-card{grid-template-columns:1fr;grid-template-rows:150px 1fr;height:96vh}
      #cast-gallery .cg-list{flex-direction:row;flex-wrap:nowrap;overflow-x:auto;border-right:0;border-bottom:1px solid rgba(148,163,184,.16)}
      #cast-gallery .cg-head{display:none}#cast-gallery .cg-item{flex-direction:column;min-width:96px;text-align:center}#cast-gallery .cg-num{margin:0}
      #cast-gallery .cg-info{grid-template-columns:1fr;max-height:40%}}`;
    document.head.appendChild(css);
    const el = document.createElement('div'); el.id = 'cast-gallery';
    el.innerHTML = `<div class="cg-card"><div class="cg-list"><div class="cg-head"><b>KARAKTERLER · 25</b><span class="cg-t">hepsi özgün</span></div></div>
      <div class="cg-main"><div class="cg-view"><div class="cg-ctrl"><button class="btn" data-s="0">Dur</button><button class="btn btn-active" data-s="1">Yürü</button><button class="btn" data-s="1.7">Hızlı</button></div><button class="btn cg-close">Kapat</button></div>
      <div class="cg-info"></div></div></div>`;
    document.body.appendChild(el);
    const list = el.querySelector('.cg-list'), view = el.querySelector('.cg-view'), info = el.querySelector('.cg-info');
    CAST.forEach((d, i) => {
      const b = document.createElement('button'); b.className = 'cg-item'; b.dataset.id = d.id;
      b.innerHTML = `<span class="cg-dot" style="background:#${new THREE.Color(d.color).getHexString()}"></span><span><div class="cg-n">${d.name}</div><div class="cg-t">${d.title}</div></span><span class="cg-num">${String(i + 1).padStart(2, '0')}</span>`;
      b.onclick = () => select(d.id); list.appendChild(b);
    });
    let renderer, scene, cam, rig, raf = 0, last = 0, speedMul = 1, rotY = 0.6, drag = false, lx = 0, groundTex, clockT = 0;
    function initGL() {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
      renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      view.prepend(renderer.domElement);
      scene = new THREE.Scene();
      cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
      scene.add(new THREE.HemisphereLight(0xdbeafe, 0x3f2e21, 0.75));
      const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.set(2.5, 4, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 }); scene.add(key);
      const rim = new THREE.DirectionalLight(0x93c5fd, 1.2); rim.position.set(-2, 2, -3); scene.add(rim);
      groundTex = canvasTex(256, 256, (ctx, W) => { ctx.fillStyle = '#7f1d1d'; ctx.fillRect(0, 0, W, W); ctx.strokeStyle = '#451a03'; ctx.lineWidth = 6; for (let i = 0; i <= W; i += 64) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); } for (let r = 0; r < 4; r++) for (let x = (r % 2) * 32; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, r * 64); ctx.lineTo(x, r * 64 + 64); ctx.stroke(); } }, [6, 6]);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const dom = renderer.domElement;
      dom.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; });
      global.addEventListener('pointerup', () => { drag = false; });
      global.addEventListener('pointermove', e => { if (drag) { rotY += (e.clientX - lx) * 0.01; lx = e.clientX; } });
      el.querySelectorAll('.cg-ctrl .btn').forEach(b => b.onclick = () => { speedMul = +b.dataset.s; el.querySelectorAll('.cg-ctrl .btn').forEach(x => x.classList.toggle('btn-active', x === b)); });
    }
    function frame() {
      if (!rig) return;
      const h = rig.cast.def.stature, k = Math.max(1, 1.15 / Math.max(0.3, cam.aspect));
      cam.position.set(0, h * 0.62, (h * 2.3 + 0.8) * k); cam.lookAt(0, h * 0.45, 0);
    }
    function resize() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); frame(); }
    function select(id) {
      el.querySelectorAll('.cg-item').forEach(b => b.classList.toggle('on', b.dataset.id === id));
      if (rig) scene.remove(rig.group);
      rig = build(id);
      scene.add(rig.group);
      const d = rig.cast.def, h = d.stature;
      frame();
      info.innerHTML = `<h3>${d.name}</h3><div class="sub">${d.title} · ${LOCO_TR[d.loco]}</div><div><p>${d.desc}</p><div class="cg-stat">Boy ${h.toFixed(2)} m · kütle ≈ ${rig.cast.ctrl.mass.toFixed(0)} kg · doğal hız ${rig.cast.speed.toFixed(2)} m/s · solunum ${(rig.cast.ctrl.breathF * 60).toFixed(0)}/dk</div></div><ul>${d.math.map(m => `<li>${m}</li>`).join('')}</ul>`;
    }
    function loop(now) {
      if (!el.classList.contains('open')) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; clockT += dt;
      if (!drag) rotY += dt * 0.15;
      if (rig) {
        const v = rig.cast.speed * speedMul;
        rig.group.rotation.y = rotY;
        rig.cast.update(dt, v, clockT);
        // Koşu bandı: zemin dokusu, karakterin yönünde v hızıyla kayar → ayak kayması yoksa ayak zemine yapışık görünür
        groundTex.offset.x -= Math.sin(rotY) * v * dt / 1; groundTex.offset.y += Math.cos(rotY) * v * dt / 1;
      }
      renderer.render(scene, cam);
    }
    function open(id) {
      if (!renderer) initGL();
      el.classList.add('open'); resize();
      select(id || (rig ? rig.cast.def.id : CAST[0].id));
      if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
    }
    el.querySelector('.cg-close').onclick = () => el.classList.remove('open');
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
    global.addEventListener('resize', () => { if (el.classList.contains('open')) resize(); });
    if (opt.button) opt.button.addEventListener('click', () => open());
    CastEngine.openGallery = open;
  }

  const CastEngine = {
    CAST, build, mountGallery, LOCO_TR,
    math: { superquadric, fourierLathe, raupShell, butterflyShape, fibonacciSphere, vogel, solveIK, critSpring, oscStep, noise1, fbm1, parallelTransport, SweepTube },
    // Yaya/müşteri dağıtımı için karıştırılmış sıra
    roster(seed = 3) { const r = mulberry32(seed), a = CAST.map(d => d.id); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  };
  global.CastEngine = CastEngine;
})(typeof window !== 'undefined' ? window : globalThis);
