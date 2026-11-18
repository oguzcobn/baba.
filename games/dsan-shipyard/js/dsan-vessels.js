/* DSAn — sekiz VESSEL_BLUEPRINTS teknesi için prosedürel Three.js model aileleri.
   Aynı build() fonksiyonu üretim holünde (inşa yüzdesiyle), rıhtım/showroom'da ve deniz denemesinde kullanılır.
   Ölçek: 1 metre = 0.44 sahne birimi (mevcut hol yerleşimiyle uyumlu). Model orijini: omurga altı, pruva +Z yönünde. */
(function () {
  'use strict';
  const DSAN = window.DSAN = window.DSAN || {};
  const S = 0.44;
  const U = () => DSAN.util;

  // ---- Aile tanımları (blueprint id'leri sabit) ----
  // Ölçüler metre; renkler konsept panoları ve yakın çekim referanslarından.
  const FAMILIES = {
    work_pilot_15: { key: 'interceptor', tr: 'IC 1102/1503 Interceptor', L: 15, B: 4.1, D: 2.1, T: 0.85, deadrise: .55, bow: 'raked', sheerRise: .35,
      hull: '#30353b', bottom: '#1b1e22', boot: '#f37021', bootH: .14, sheerBand: '#f37021', deck: '#3a3f46',
      tiers: [{ u0: .34, u1: .64, h: 1.85, w: .82, rake: .9, color: '#f4f6f8', glass: .55, roofColor: '#2b3036' }],
      parts: ['outboards', 'rails', 'mastLight', 'radarBar', 'lifebuoy'] },
    work_tug_24: { key: 'sar', tr: '1906 SAR', L: 19, B: 6.2, D: 2.7, T: 1.1, deadrise: .32, bow: 'raked', sheerRise: .45,
      hull: '#d1281f', bottom: '#d1281f', boot: '#f1f5f9', bootH: .16, deck: '#5b6470',
      tiers: [{ u0: .3, u1: .66, h: 2.2, w: .78, rake: .5, color: '#f8fafc', glass: .42 }, { u0: .4, u1: .64, h: 1.15, w: .7, rake: .7, color: '#d1281f', glass: .7 }],
      parts: ['fenderCollar', 'mastRed', 'searchlight', 'liferaft', 'rescueSled', 'smallCrane', 'rails', 'lifebuoy'] },
    work_osv_34: { key: 'waterbus', tr: 'Waterbus 2907 Electric', L: 29, B: 9, D: 2.7, T: 1.2, deadrise: .25, bow: 'raked', sheerRise: .2, cat: true,
      hull: '#f4f6f8', bottom: '#1e3a8a', boot: '#1e3a8a', bootH: .12, deck: '#94a3b8',
      tiers: [{ u0: .08, u1: .86, h: 2.4, w: .94, rake: .9, color: '#f8fafc', glass: .62 }, { u0: .3, u1: .78, h: 1.6, w: .78, rake: .9, color: '#f8fafc', glass: .5, canopy: true }],
      parts: ['mastSmall', 'rails', 'solar'] },
    work_sar_46: { key: 'twinaxe', tr: 'FCS 2710/3210 Twin-Axe', L: 32, B: 10, D: 3.6, T: 1.8, deadrise: .3, bow: 'axe', sheerRise: .35, cat: true,
      hull: '#1f2d5a', bottom: '#1f2d5a', boot: '#f37021', bootH: .14, deck: '#6b7280', diag: '#f37021',
      tiers: [{ u0: .44, u1: .8, h: 2.6, w: .8, rake: .5, color: '#f8fafc', glass: .4 }, { u0: .54, u1: .78, h: 1.5, w: .66, rake: .8, color: '#f8fafc', glass: .7, band: '#f37021' }],
      parts: ['sideFenders', 'bowFender', 'containers', 'mastWhite', 'hazard', 'rails'] },
    yacht_sport_18: { key: 'patrol', tr: 'SPa 4008 / Stan Patrol', L: 42, B: 8.5, D: 4.3, T: 2.3, deadrise: .3, bow: 'axe', sheerRise: .5,
      hull: '#23365f', bottom: '#7f1d1d', boot: '#0f172a', bootH: .1, deck: '#64748b',
      tiers: [{ u0: .3, u1: .72, h: 2.5, w: .84, rake: .3, color: '#c4cad2', glass: .25 }, { u0: .4, u1: .7, h: 2.3, w: .74, rake: .5, color: '#c4cad2', glass: .4 }, { u0: .5, u1: .68, h: 1.9, w: .62, rake: .8, color: '#c4cad2', glass: .65 }],
      parts: ['knuckleCrane', 'rhibOrange', 'mastGrey', 'domes2', 'rails'] },
    yacht_fly_28: { key: 'yachtsupport', tr: 'YS 5009 Yacht Support', L: 53, B: 11, D: 5.2, T: 2.6, deadrise: .25, bow: 'raked', sheerRise: .45,
      hull: '#0f6f73', bottom: '#7f1d1d', boot: '#0b3b3d', bootH: .1, deck: '#a26b3c', teak: true,
      tiers: [{ u0: .46, u1: .86, h: 2.6, w: .86, rake: .35, color: '#f8fafc', glass: .3 }, { u0: .52, u1: .83, h: 2.4, w: .76, rake: .5, color: '#f8fafc', glass: .45 }, { u0: .58, u1: .8, h: 2.0, w: .62, rake: .8, color: '#f8fafc', glass: .65 }],
      parts: ['helipadFwd', 'tenders', 'knuckleCrane', 'mastBlack', 'domes3', 'rails'] },
    yacht_explorer_42: { key: 'seaxplorer', tr: 'SeaXplorer 58', L: 58, B: 12.6, D: 5.8, T: 3.2, deadrise: .22, bow: 'plumb', sheerRise: .35,
      hull: '#1d2b4f', bottom: '#7f1d1d', boot: '#0f172a', bootH: .1, deck: '#a26b3c', teak: true,
      tiers: [{ u0: .22, u1: .84, h: 2.7, w: .9, rake: .25, color: '#f8fafc', glass: .3 }, { u0: .3, u1: .8, h: 2.5, w: .82, rake: .45, color: '#f8fafc', glass: .4 }, { u0: .42, u1: .77, h: 2.3, w: .7, rake: .7, color: '#f8fafc', glass: .55 }, { u0: .52, u1: .72, h: 1.8, w: .5, rake: .9, color: '#f8fafc', glass: .6 }],
      parts: ['tenderOrange', 'mastBlack', 'domes3', 'rails'] },
    yacht_mega_62: { key: 'xplorer', tr: 'Xplorer SX 6001', L: 60, B: 11.6, D: 5.6, T: 3.0, deadrise: .22, bow: 'plumb', sheerRise: .3,
      hull: '#f4f6f8', bottom: '#1f2937', boot: '#1f2937', bootH: .12, deck: '#a26b3c', teak: true, sleek: true,
      tiers: [{ u0: .14, u1: .88, h: 2.7, w: .92, rake: 1.6, color: '#f8fafc', glass: .4 }, { u0: .24, u1: .82, h: 2.5, w: .84, rake: 1.6, color: '#f8fafc', glass: .5 }, { u0: .36, u1: .76, h: 2.3, w: .72, rake: 1.8, color: '#f8fafc', glass: .55 }, { u0: .48, u1: .7, h: 2.0, w: .56, rake: 1.6, color: '#f8fafc', glass: .65 }],
      parts: ['mastBlack', 'domes3', 'rails', 'tenderWhite', 'anchorPocket'] }
  };

  // Deniz denemesi temel değerleri (yaklaşık, oyun dengesi için)
  const SPECS = {
    work_pilot_15: { top: 50, cruise: 35, turn: 3.2, comfort: 62, energy: 'diesel', burn: 260, rel: 86, range: 300 },
    work_tug_24: { top: 31, cruise: 24, turn: 2.6, comfort: 72, energy: 'diesel', burn: 280, rel: 93, range: 400 },
    work_osv_34: { top: 12, cruise: 9, turn: 2.2, comfort: 88, energy: 'electric', burn: 32, rel: 89, range: 60 },
    work_sar_46: { top: 28, cruise: 24, turn: 2.9, comfort: 83, energy: 'diesel', burn: 520, rel: 91, range: 1100 },
    yacht_sport_18: { top: 26, cruise: 18, turn: 3.0, comfort: 76, energy: 'diesel', burn: 620, rel: 91, range: 2500 },
    yacht_fly_28: { top: 15, cruise: 13, turn: 3.4, comfort: 85, energy: 'diesel', burn: 380, rel: 90, range: 4500 },
    yacht_explorer_42: { top: 16, cruise: 12, turn: 3.3, comfort: 91, energy: 'hybrid', burn: 330, rel: 89, range: 6000 },
    yacht_mega_62: { top: 16.5, cruise: 13, turn: 3.2, comfort: 93, energy: 'hybrid', burn: 300, rel: 88, range: 5000 }
  };

  function hullKind(bp) {
    const h = (bp && bp.hullType || '').toLowerCase();
    if (h.includes('kompozit') && !h.includes('alüminyum')) return 'composite';
    if (h.includes('çelik') || h.includes('steel')) return 'steel';
    return 'aluminium';
  }
  const PRIMER = { steel: '#8a5646', aluminium: '#b9c0c8', composite: '#e9e4d6' };

  // ---- Malzeme önbelleği ----
  const mats = new Map();
  function mat(color, o) {
    o = o || {};
    const key = color + JSON.stringify(o);
    if (mats.has(key)) return mats.get(key);
    const m = o.basic ? new THREE.MeshBasicMaterial({ color, transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity, side: o.side || THREE.FrontSide })
      : new THREE.MeshStandardMaterial({ color, roughness: o.r == null ? .38 : o.r, metalness: o.m == null ? .15 : o.m, vertexColors: !!o.vc, side: o.side || THREE.FrontSide, emissive: o.em || '#000000', emissiveIntensity: o.ei == null ? 1 : o.ei, flatShading: !!o.flat, transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity });
    m.userData.shared = true; mats.set(key, m); return m;
  }
  DSAN.vesselMaterials = mats;
  const GLASS = () => mat('#0b1522', { r: .06, m: .9 });

  // ---- Gövde geometrisi: istasyonlardan örülen kesitler ----
  function hullParams(f, catScale) {
    const L = f.L * S, B = (f.cat ? f.B * .27 : f.B) * S * (catScale || 1), D = f.D * S;
    return { L, B, D, T: f.T * S, dr: f.deadrise, bow: f.bow, sheer: f.sheerRise * S, cat: f.cat };
  }
  function halfBeam(p, u) { // güverte hizasında yarı genişlik
    const tr = p.cat ? .92 : .86;
    if (u < .45) return p.B / 2 * (tr + (1 - tr) * Math.sin(u / .45 * Math.PI / 2));
    const k = (u - .45) / .55;
    const pw = p.bow === 'axe' ? .75 : p.bow === 'plumb' ? .9 : 1.05;
    return p.B / 2 * Math.pow(Math.max(0, 1 - Math.pow(k, 1.9)), pw);
  }
  function keelY(p, u) { // omurga çizgisi; klasik pruvada yükselir, balta pruvada derin kalır
    if (p.bow === 'axe') return u > .9 ? (u - .9) / .1 * p.D * .12 : 0;
    if (p.bow === 'plumb') return u > .88 ? Math.pow((u - .88) / .12, 2) * p.D * .35 : 0;
    return u > .62 ? Math.pow((u - .62) / .38, 1.6) * p.D * .78 : 0;
  }
  function sheerY(p, u) { return p.D + p.sheer * u * u; }
  function sectionPts(p, u, wl, stripe) { // yarım kesit noktaları (z>=0): omurga → kuyruk(chine) → güverte
    const b = Math.max(halfBeam(p, u), .002), yk = keelY(p, u), ys = sheerY(p, u);
    const yc = Math.min(ys - .05, yk + p.dr * b * (u > .7 ? 1 + (u - .7) * 2 : 1));
    const zc = b * (p.cat ? .82 : .9);
    const P0 = [0, yk], P1 = [zc, yc], P2 = [b * (u > .75 ? 1 : .985), ys];
    const onUpper = y => { const t = U().clamp((y - P1[1]) / Math.max(1e-4, P2[1] - P1[1]), 0, 1); return [P1[0] + (P2[0] - P1[0]) * t, P1[1] + (P2[1] - P1[1]) * t]; };
    const mid01 = [(P0[0] + P1[0]) / 2 * 1.04, (P0[1] + P1[1]) / 2];
    return [P0, mid01, P1, onUpper(wl), onUpper(wl + stripe), onUpper((wl + stripe + ys) / 2), onUpper(ys - .06), P2];
  }
  // u0..u1 aralığındaki gövde bloğu: dış kabuk + güverte + (gerekirse) ayna kapağı
  function hullBlock(f, p, u0, u1, colors, opts) {
    const n = Math.max(2, Math.round((u1 - u0) * 30)), wl = p.T, stripe = (f.bootH || .1) * S * 1.6;
    const rows = [];
    for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n; rows.push({ u, z: (u - .5) * p.L, pts: sectionPts(p, u, wl, stripe) }); }
    const m = rows[0].pts.length, pos = [], idx = [];
    const ring = [];  // her istasyon: sağ taraf (z+) ters sırada + sol taraf → tam kesit
    rows.forEach(r => { const pts = r.pts; const full = []; for (let j = m - 1; j >= 1; j--) full.push([-pts[j][0], pts[j][1]]); for (let j = 0; j < m; j++) full.push([pts[j][0], pts[j][1]]); ring.push({ z: r.z, full }); });
    const k = ring[0].full.length;
    ring.forEach(r => r.full.forEach(([x, y]) => pos.push(x, y, r.z)));
    for (let i = 0; i < ring.length - 1; i++) for (let j = 0; j < k - 1; j++) { const a = i * k + j, b = a + 1, c = a + k, d = c + 1; idx.push(a, c, b, b, c, d); }
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    g = g.toNonIndexed();
    // Üçgen başına renk: su altı (zehirli boya) / su hattı şeridi / gövde / güverte bandı
    const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
    for (let t = 0; t < P.count; t += 3) {
      const y = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, z = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3, u = z / p.L + .5;
      const ys = sheerY(p, u);
      let hex = colors.hull;
      if (colors.primer) hex = colors.primer;
      else if (y < wl - .005) hex = colors.bottom;
      else if (y < wl + stripe) hex = colors.boot;
      else if (colors.sheerBand && y > ys - .2 * S * 1.6 * 1.5 && y < ys - .04) hex = colors.sheerBand;
      c.set(hex); for (let q = 0; q < 3; q++) col.set([c.r, c.g, c.b], (t + q) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const grp = new THREE.Group();
    const shell = new THREE.Mesh(g, mat('#ffffff', { vc: true, r: colors.primer ? .7 : .32, m: colors.primer ? .25 : .18, side: THREE.DoubleSide }));
    shell.castShadow = true; shell.receiveShadow = true; grp.add(shell);
    if (opts.deck) { // güverte yüzeyi (iki güverte kenarı arası şerit)
      const dp = [], di = [];
      rows.forEach((r, i) => { const e = r.pts[m - 1]; dp.push(-e[0], e[1] - .02, r.z, e[0], e[1] - .02, r.z); if (i) { const a = (i - 1) * 2; di.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.setIndex(di); dg.computeVertexNormals();
      const deck = new THREE.Mesh(dg, mat(colors.primer ? '#6b6f75' : colors.deck, { r: .85, m: 0, side: THREE.DoubleSide })); deck.receiveShadow = true; grp.add(deck);
    }
    if (u0 <= 0.001) { // ayna (transom)
      const r = ring[0], tp = [0, (r.full[0][1] + r.full[k - 1][1]) / 2 * .6, r.z], tpos = [tp[0], tp[1], tp[2]], ti = [];
      r.full.forEach(([x, y]) => tpos.push(x, y, r.z));
      for (let j = 1; j < k; j++) ti.push(0, j + 1, j);
      ti.push(0, 1, k); // kapanış
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3)); tg.setIndex(ti); tg.computeVertexNormals();
      grp.add(new THREE.Mesh(tg, mat(colors.primer || colors.hull, { r: .4, side: THREE.DoubleSide })));
    }
    return grp;
  }

  // ---- Yardımcı parçalar ----
  function box(w, h, d, m, x, y, z, shadow) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x || 0, y || 0, z || 0); if (shadow !== false) { o.castShadow = true; o.receiveShadow = true; } return o; }
  function cyl(rt, rb, h, m, seg) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), m); o.castShadow = true; return o; }
  // Yandan profil (z,y) ekstrüzyonu: eğimli ön camlı güverte evi
  function house(zA, zF, h, w, rake, m) {
    const s = new THREE.Shape();
    const rk = Math.min(rake * h, (zF - zA) * .45);
    s.moveTo(zA, 0); s.lineTo(zF, 0); s.lineTo(zF - rk, h); s.lineTo(zA + Math.min(.15, (zF - zA) * .05), h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2); // profil z→ sahne z (pruva +Z)
    const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o;
  }
  function rails(p, y0, color) { // ince korkuluk çizgileri
    const pts = [];
    for (let i = 0; i < 16; i++) { const u = .04 + i / 16 * .9, u2 = .04 + (i + 1) / 16 * .9; [-1, 1].forEach(sd => { const b1 = halfBeam(p, u) * .96, b2 = halfBeam(p, u2) * .96; const y1 = sheerY(p, u) + .42 * S * 1.6, y2 = sheerY(p, u2) + .42 * S * 1.6; pts.push(sd * b1, y1, (u - .5) * p.L, sd * b2, y2, (u2 - .5) * p.L); pts.push(sd * b1, y1, (u - .5) * p.L, sd * b1, sheerY(p, u), (u - .5) * p.L); }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: color || '#d7dde4', transparent: true, opacity: .85 }));
  }
  function smallHull(len, beam, color, top) { // bot/tender (RIB)
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(.5, 12, 8); geo.scale(beam, beam * .55, len); // r128'de CapsuleGeometry yok: basık elipsoid gövde
    const body = new THREE.Mesh(geo, mat(color, { r: .45 })); body.castShadow = true; g.add(body);
    if (top) { const c = box(beam * .5, beam * .35, len * .3, mat(top, { r: .4 }), 0, beam * .3, -len * .05); g.add(c); }
    return g;
  }
  function radar(len, m) { const g = new THREE.Group(); g.add(box(len, .05, .09, m, 0, 0, 0, false)); g.userData.spin = true; return g; }
  function dome(r) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat('#f8fafc', { r: .3 })); o.castShadow = true; return o; }
  function decalPlane(w, h, color) { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(color, { r: .4, side: THREE.DoubleSide })); return o; }
  let helipadTex = null;
  function helipad(r) {
    if (!helipadTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#3f6f62'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.strokeStyle = '#facc15'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke();
      x.fillStyle = '#fff'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 64, 68);
      helipadTex = new THREE.CanvasTexture(c);
    }
    const o = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshStandardMaterial({ map: helipadTex, roughness: .7 }));
    o.rotation.x = -Math.PI / 2; o.receiveShadow = true; return o;
  }

  // ---- Model kurucu ----
  // opts: { stageOnly?:bool, noScaffold?:bool, quality?: 'low'|'medium'|'high' }
  function build(bp, pct, opts) {
    opts = opts || {};
    pct = pct == null ? 100 : U().clamp(pct, 0, 100);
    const id = bp && FAMILIES[bp.id] ? bp.id : 'work_pilot_15';
    const f = FAMILIES[id], kind = hullKind(bp), rnd = U().rng(id + ':' + (opts.seed || ''));
    const p = hullParams(f);
    const root = new THREE.Group(); root.name = 'vessel:' + id;
    const painted = pct >= 68, primer = PRIMER[kind];
    const colors = painted ? { hull: f.hull, bottom: f.bottom, boot: f.boot, deck: f.deck, sheerBand: f.sheerBand } : { primer, hull: primer, bottom: primer, boot: primer, deck: '#6b6f75' };
    const hullRoot = new THREE.Group(); root.add(hullRoot);
    const catOff = f.cat ? (f.B * S / 2 - p.B / 2) : 0;
    const hulls = f.cat ? [-catOff, catOff] : [0];

    // 1) Omurga ve postalar (her zaman; boyandıktan sonra gövde içinde kalır)
    if (pct < 60) {
      const keelM = mat(kind === 'composite' ? '#cfc8b8' : '#7b8794', { r: .5, m: .5 });
      hulls.forEach(x => {
        hullRoot.add(box(.16 * S * 4, .2, p.L * .92, keelM, x, .1, 0));
        const nR = Math.round(f.L / 2.2);
        for (let r = 0; r <= nR; r++) {
          const u = .04 + r / nR * .9, sp = sectionPts(p, u, p.T, .1), pts = [];
          for (let j = sp.length - 1; j >= 0; j--) pts.push(new THREE.Vector3(x - sp[j][0], sp[j][1], (u - .5) * p.L));
          for (let j = 1; j < sp.length; j++) pts.push(new THREE.Vector3(x + sp[j][0], sp[j][1], (u - .5) * p.L));
          const g = new THREE.BufferGeometry().setFromPoints(pts);
          hullRoot.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: kind === 'composite' ? '#d6cfbf' : '#9aa5b1' })));
        }
      });
    }
    // 2) Gövde blokları: %12'den itibaren kıçtan pruvaya altı blok
    const nB = 6, shown = pct < 12 ? 0 : pct >= 55 ? nB : Math.ceil((pct - 12) / 43 * nB);
    for (let b = 0; b < shown; b++) {
      const u0 = b / nB, u1 = (b + 1) / nB + (b < nB - 1 ? .002 : 0);
      hulls.forEach(x => { const blk = hullBlock(f, p, u0, u1, colors, { deck: pct >= 50 && !f.cat }); blk.position.x = x; hullRoot.add(blk); });
    }
    // Katamaran: köprü güvertesi
    if (f.cat && pct >= 50) {
      const span = f.B * S, yDeck = p.D * 1.02, len = p.L * .9;
      const wet = box(span, p.D * .32, len * .92, mat(colors.primer || colors.hull, { r: .35 }), 0, yDeck - p.D * .16, -p.L * .02);
      hullRoot.add(wet);
      hullRoot.add(box(span * .98, .06, len * .9, mat(colors.primer ? '#6b6f75' : f.deck, { r: .85, m: 0 }), 0, yDeck + .02, -p.L * .02));
    }
    // Balta pruva: dikey baş bodoslaması vurgusu
    // 3) Üst yapı katları: %55 → %82 arası katman katman
    const deckY = f.cat ? p.D * 1.05 : sheerY(p, .5);
    let yAcc = deckY;
    const supColor = c => (pct >= 74 ? c : (kind === 'composite' ? '#e2ddcf' : '#b8bec6'));
    f.tiers.forEach((t, i) => {
      if (pct < 55 + i * 7) return;
      const h = t.h * S, zA = (t.u0 - .5) * p.L, zF = (t.u1 - .5) * p.L, w = (f.cat ? f.B * S : p.B) * t.w;
      const hm = house(zA, zF, h, w, t.rake, mat(supColor(t.color), { r: .3, m: .1 }));
      hm.position.y = yAcc; root.add(hm);
      if (pct >= 70 && t.glass) { // pencere bandı: evden biraz taşan koyu cam
        const gh = h * t.glass * .55, g = house(zA + .05, zF + .02, gh, w + .03, t.rake * h / gh * .55, GLASS());
        g.position.y = yAcc + h * (1 - t.glass * .55) - h * .08; root.add(g);
        if (f.sleek && i < f.tiers.length - 1) { const g2 = house(zA + .3, zF - .6, gh * .5, w + .04, 1.2, GLASS()); g2.position.y = yAcc + h * .28; root.add(g2); }
      }
      if (t.band && pct >= 74) { const bd = house(zA + .02, zF + .01, h * .1, w + .035, t.rake, mat(t.band, { r: .4 })); bd.position.y = yAcc + h * .9; root.add(bd); }
      if (t.roofColor && pct >= 74) { const rf = box(w * 1.04, .05, (zF - zA) * .9, mat(t.roofColor, { r: .5 }), 0, yAcc + h + .02, zA + (zF - zA) * .45); root.add(rf); }
      if (t.canopy && pct >= 80) { const cp = box(w * 1.08, .05, (zF - zA) * 1.08, mat('#f1f5f9', { r: .4 }), 0, yAcc + h + .25, (zA + zF) / 2); root.add(cp); }
      yAcc += h;
    });
    const topY = yAcc, mastZ = (() => { const t = f.tiers[f.tiers.length - 1]; return ((t.u0 + t.u1) / 2 - .5) * p.L; })();

    // 4) Detaylar: %82'den itibaren
    const det = new THREE.Group(); root.add(det);
    const showDet = k => pct >= 82 + k * 2;
    const parts = f.parts || [];
    const black = mat('#111827', { r: .5, m: .3 }), white = mat('#f8fafc', { r: .3 }), grey = mat('#9ca3af', { r: .4, m: .4 }), orange = mat('#f37021', { r: .45 }), red = mat('#d1281f', { r: .4 }), yellow = mat('#facc15', { r: .5 });
    const mast = (m, h) => { const g = new THREE.Group(); const pole = cyl(.06, .1, h, m, 8); pole.position.y = h / 2; g.add(pole); const yard = box(p.B * .45, .07, .08, m, 0, h * .78, 0, false); g.add(yard); const rd = radar(p.B * .32, black); rd.position.y = h * .92; g.add(rd); g.position.set(0, topY, mastZ - .3); return g; };
    if (showDet(0)) parts.forEach((pt, i) => {
      if (!showDet(i * .5)) return;
      switch (pt) {
        case 'outboards': [-.32, .32].forEach(x => { const o = box(.36, .9, .32, mat('#1f2937', { r: .35, m: .4 }), x, sheerY(p, 0) - .1, -p.L / 2 - .2); det.add(o); }); break;
        case 'rails': det.add(rails(p, 0)); if (f.cat) { const r2 = rails(p, 0); r2.position.x = catOff; const r1 = rails(p, 0); r1.position.x = -catOff; det.add(r1, r2); } break;
        case 'mastLight': det.add(mast(black, 1.3 * S * 1.6)); break;
        case 'radarBar': { const arch = box(p.B * .7, .08, .1, black, 0, topY + .45, mastZ - .4); det.add(arch); const d = dome(.16); d.position.set(.3, topY + .58, mastZ - .4); det.add(d); break; }
        case 'lifebuoy': [-1, 1].forEach(sd => { const t = new THREE.Mesh(new THREE.TorusGeometry(.17, .05, 6, 14), orange); t.position.set(sd * (p.B * .4), deckY + .5, (f.tiers[0].u0 - .5) * p.L + .4); t.rotation.y = Math.PI / 2; det.add(t); }); break;
        case 'fenderCollar': { // siyah kauçuk fender kuşağı
          const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40 * .98; pts.push(new THREE.Vector3(halfBeam(p, u) + .06, sheerY(p, u) - .1, (u - .5) * p.L)); }
          for (let i = 40; i >= 0; i--) { const u = i / 40 * .98; pts.push(new THREE.Vector3(-halfBeam(p, u) - .06, sheerY(p, u) - .1, (u - .5) * p.L)); }
          const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 120, .16, 6, true), mat('#15171a', { r: .9, m: 0 }));
          tube.castShadow = true; det.add(tube); break; }
        case 'diagStripes': if (painted) [-1, 1].forEach(sd => [0, 1].forEach(k => { const u = .64 + k * .05; const d = decalPlane(.22, p.D * .55, '#f8fafc'); d.position.set(sd * (halfBeam(p, u) + .02), p.D * .45, (u - .5) * p.L); d.rotation.set(0, sd * Math.PI / 2, -.5 * sd); det.add(d); })); break;
        case 'mastRed': det.add(mast(red, 1.7 * S * 1.6)); break;
        case 'mastGrey': det.add(mast(grey, 2.6 * S * 1.6)); break;
        case 'mastWhite': det.add(mast(white, 2.2 * S * 1.6)); break;
        case 'mastBlack': det.add(mast(black, 2.8 * S * 1.6)); break;
        case 'mastSmall': det.add(mast(white, 1.2 * S * 1.6)); break;
        case 'searchlight': { const s = cyl(.12, .12, .2, grey); s.rotation.x = Math.PI / 2; s.position.set(.4, topY + .15, mastZ + 1); det.add(s); break; }
        case 'liferaft': { const c = cyl(.22, .22, .7, white); c.rotation.z = Math.PI / 2; c.position.set(0, deckY + .25, -p.L * .38); det.add(c); break; }
        case 'rescueSled': { const s = box(.5, .18, 1.4, orange, p.B * .3, deckY + .5, -p.L * .1); det.add(s); break; }
        case 'smallCrane': case 'knuckleCrane': {
          const cm = pt === 'smallCrane' ? red : mat('#e5e7eb', { r: .4, m: .3 }), base = cyl(.15, .2, .8 * S * 3, cm); base.position.set(p.B * .25, deckY + .5, -p.L * .3); det.add(base);
          const arm = box(.12, .12, p.L * .16, cm, p.B * .25, deckY + 1.1, -p.L * .3 + p.L * .07); arm.rotation.x = -.45; det.add(arm); break; }
        case 'sideFenders': [-1, 1].forEach(sd => [.35, .55].forEach(hf => { const t = cyl(.11, .11, p.L * .78, mat('#15171a', { r: .9, m: 0 }), 8); t.rotation.x = Math.PI / 2; t.position.set(sd * (f.B * S / 2 + .08), p.D * hf, -p.L * .04); det.add(t); })); break;
        case 'bowFender': [-catOff, catOff].forEach(x => { const t = box(.4, p.D * .55, .25, mat('#15171a', { r: .9, m: 0 }), x, p.D * .62, p.L / 2 + .05); det.add(t); }); break;
        case 'containers': [[.25, '#f37021'], [-.25, '#1d4ed8']].forEach(([x, c]) => det.add(box(f.B * S * .22, .55, 1.3, mat(c, { r: .6 }), x * f.B * S, deckY + .3, -p.L * .3))); break;
        case 'hazard': { const h = decalPlane(.5, .5, '#facc15'); h.position.set(f.B * S / 2 - .1, deckY + .35, (f.tiers[0].u0 - .5) * p.L - .05); det.add(h); break; }
        case 'domes2': case 'domes3': { const n = pt === 'domes2' ? 2 : 3; for (let k = 0; k < n; k++) { const d = dome(.22 + rnd() * .08); d.position.set((k - (n - 1) / 2) * .6, topY + .3, mastZ - .9); det.add(d); } break; }
        case 'rhibOrange': case 'tenderOrange': { const t = smallHull(2.6, .9, '#f37021', '#f8fafc'); t.position.set(p.B * .28, deckY + .5, -p.L * .32); det.add(t); break; }
        case 'tenderWhite': { const t = smallHull(3.2, 1.0, '#f8fafc', '#1f2937'); t.position.set(0, deckY + .45, -p.L * .36); det.add(t); break; }
        case 'tenders': { [[-.22, '#1f2937', '#9ca3af'], [.18, '#f8fafc', '#0f6f73']].forEach(([x, c, t]) => { const h = smallHull(3.4, 1.1, c, t); h.position.set(x * p.B, deckY + .5, -p.L * .2); det.add(h); }); const sub = new THREE.Mesh(new THREE.SphereGeometry(.55, 12, 10), mat('#facc15', { r: .3 })); sub.scale.set(1, .8, 1.5); sub.position.set(0, deckY + .6, -p.L * .36); det.add(sub); break; }
        case 'helipadFwd': { const h = helipad(p.B * .34); h.position.set(0, sheerY(p, .86) + .08, p.L * .36); det.add(h); break; }
        case 'aftPad': { const h = helipad(p.B * .3); h.position.set(0, topY + .03, (f.tiers[1].u0 - .5) * p.L + p.B * .3); det.add(h); break; }
        case 'solar': det.add(box(f.B * S * .6, .03, p.L * .3, mat('#1e3a8a', { r: .2, m: .6 }), 0, topY + .3, 0)); break;
        case 'anchorPocket': [-1, 1].forEach(sd => { const a = decalPlane(.35, .45, '#4b5563'); a.position.set(sd * (halfBeam(p, .9) + .01), p.D * .72, p.L * .4); a.rotation.y = sd * Math.PI / 2; det.add(a); }); break;
      }
    });
    // FCS turuncu diyagonal şerit
    if (f.diag && painted) [-1, 1].forEach(sd => { const d = decalPlane(.35, p.D * .7, f.diag); d.position.set(sd * (f.B * S / 2 + .02), p.D * .62, -p.L * .05); d.rotation.set(0, sd * Math.PI / 2, .55 * sd); det.add(d); });
    // Dümen(ler): deniz denemesinde döner
    const rudders = [];
    hulls.forEach(x => { const r = box(.04, p.T * .7, p.L * .045, mat('#374151', { r: .5, m: .5 }), x, -p.T * .15 + .05, -p.L / 2 + p.L * .03, false); rudders.push(r); hullRoot.add(r); });
    // 5) İskele (scaffold) inşa sürerken
    if (!opts.noScaffold && pct >= 8 && pct < 94) {
      const sm = mat('#cbd5e1', { r: .6, m: .6 }), h = Math.max(p.D, topY) + .3, pts = [];
      const w = (f.cat ? f.B * S : p.B) / 2 + .55;
      for (let i = 0; i <= 8; i++) { const z = (i / 8 - .5) * p.L * .95; [-w, w].forEach(x => { pts.push(x, 0, z, x, h, z); }); }
      for (let y = .9; y < h; y += .9) [-w, w].forEach(x => pts.push(x, y, -p.L * .475, x, y, p.L * .475));
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const sc = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cbd5e1' })); sc.name = 'scaffold'; root.add(sc);
      void sm;
    }
    root.userData = { id, family: f.key, L: p.L, beam: f.cat ? f.B * S : p.B, draft: p.T, height: topY, rudders, stage: pct, painted, kind };
    return root;
  }

  function dispose(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (m && !(m.userData && m.userData.shared)) m.dispose(); });
    });
  }

  // ---- Katalog küçük resimleri: aynı modelden, tek seferlik ayrı renderer ----
  const thumbs = {};
  function thumbnails(list) {
    if (!window.THREE) return thumbs;
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return thumbs; }
    try {
      r.setSize(360, 200, false); r.setPixelRatio(1); r.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight('#dbeafe', '#1e293b', 1.0));
      const sun = new THREE.DirectionalLight('#fff3d6', 1.3); sun.position.set(6, 8, 5); sc.add(sun);
      const cam = new THREE.PerspectiveCamera(30, 360 / 200, .1, 400);
      (list || []).forEach(bp => {
        const v = build(bp, 100, { noScaffold: true }); sc.add(v);
        const bb = new THREE.Box3().setFromObject(v), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
        const d = Math.max(sz.z, sz.y * 2.2) * 1.55;
        cam.position.set(c.x + d * .78, c.y + d * .32, c.z + d * .55); cam.lookAt(c);
        r.render(sc, cam); thumbs[bp.id] = r.domElement.toDataURL('image/png');
        sc.remove(v); dispose(v);
      });
    } catch (e) { console.warn('thumbnails', e); }
    r.dispose(); try { r.forceContextLoss(); } catch (e) {}
    return thumbs;
  }

  DSAN.vessels = { S, FAMILIES, SPECS, build, dispose, thumbnails, thumbs, hullKind, family: id => FAMILIES[id] };
})();
