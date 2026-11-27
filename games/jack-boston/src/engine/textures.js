// Prosedürel CanvasTexture fabrikası — düz renk yok, her yüzeyin kendi dokusu var.
import * as THREE from 'three';

const cache = new Map();
let ANISO = 4;
export function setAniso(a) { ANISO = a; }

// Deterministik rastgele
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function toTex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function noise(ctx, w, h, n, colors, rMin = 0.5, rMax = 1.6, r = Math.random) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    const s = rMin + r() * (rMax - rMin);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f > 0) c.lerp(new THREE.Color('#ffffff'), f); else c.lerp(new THREE.Color('#000000'), -f);
  return '#' + c.getHexString();
}
export { shade };

// ---------------------------------------------------------------- ZEMİN
function asphaltBase(ctx, w, h, r, base = '#3b3e44') {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  // yamalar
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = `rgba(${r() < .5 ? '20,22,26' : '80,82,86'},${0.06 + r() * 0.08})`;
    ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 20 + r() * 90, 10 + r() * 50, r() * 3, 0, 7); ctx.fill();
  }
  noise(ctx, w, h, w * h / 18, ['#2c2f34', '#46494f', '#53565c', '#34373c', '#5f6268'], 0.6, 1.8, r);
  // çatlaklar
  ctx.strokeStyle = 'rgba(18,18,20,0.55)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    let x = r() * w, y = r() * h; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - .5) * 30; y += (r() - .5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // yağ lekeleri
  for (let i = 0; i < 3; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
    g.addColorStop(0, 'rgba(15,15,18,0.35)'); g.addColorStop(1, 'rgba(15,15,18,0)');
    ctx.save(); ctx.translate(w * .3 + r() * w * .4, r() * h); ctx.scale(1, 1.8); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill(); ctx.restore();
  }
}

// Yol: genişlik boyunca 14m, uzunluk boyunca 14m (V yönünde tekrar eder)
export function roadTex() {
  return cached('road', () => {
    const w = 512, h = 512, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(7);
    asphaltBase(ctx, w, h, r);
    const ppm = w / 14;
    // kenar çizgileri
    ctx.fillStyle = 'rgba(230,230,225,0.85)';
    ctx.fillRect(0.45 * ppm, 0, 0.14 * ppm, h); ctx.fillRect(w - 0.59 * ppm, 0, 0.14 * ppm, h);
    // çift sarı orta şerit (aşınmış)
    ctx.fillStyle = '#e0b532';
    ctx.fillRect(w / 2 - 0.28 * ppm, 0, 0.13 * ppm, h); ctx.fillRect(w / 2 + 0.15 * ppm, 0, 0.13 * ppm, h);
    noise(ctx, w, h, 900, ['rgba(59,62,68,0.9)'], 1, 3, r); // aşınma
    // rögar kapağı
    const mx = w * 0.27, my = h * 0.6;
    ctx.fillStyle = '#2a2b2e'; ctx.beginPath(); ctx.arc(mx, my, 0.45 * ppm, 0, 7); ctx.fill();
    ctx.strokeStyle = '#55575b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#3e4044'; ctx.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(mx - 0.4 * ppm, my + i * 4); ctx.lineTo(mx + 0.4 * ppm, my + i * 4); ctx.stroke(); }
    // ızgara (yağmur suyu) kenarda
    ctx.fillStyle = '#1d1e20'; ctx.fillRect(0.7 * ppm, h * 0.15, 0.5 * ppm, 0.9 * ppm);
    ctx.strokeStyle = '#4a4b4f'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0.7 * ppm, h * 0.15 + i * 5 + 2); ctx.lineTo(1.2 * ppm, h * 0.15 + i * 5 + 2); ctx.stroke(); }
    return toTex(c);
  });
}

export function intersectionTex() {
  return cached('inter', () => {
    const w = 512, h = 512, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(11);
    asphaltBase(ctx, w, h, r);
    const ppm = w / 14;
    ctx.fillStyle = 'rgba(235,235,230,0.88)';
    const stripe = (vertical, pos) => {
      for (let i = 0; i < 9; i++) {
        const a = 0.9 * ppm + i * 1.4 * ppm;
        if (vertical) ctx.fillRect(pos, a, 2.2 * ppm, 0.7 * ppm); else ctx.fillRect(a, pos, 0.7 * ppm, 2.2 * ppm);
      }
    };
    stripe(false, 0.2 * ppm); stripe(false, h - 2.4 * ppm); stripe(true, 0.2 * ppm); stripe(true, w - 2.4 * ppm);
    noise(ctx, w, h, 1200, ['rgba(59,62,68,0.85)'], 1, 3, r);
    return toTex(c, { repeat: false });
  });
}

export function sidewalkTex() {
  return cached('side', () => {
    const w = 256, h = 256, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(3);
    ctx.fillStyle = '#a7a39b'; ctx.fillRect(0, 0, w, h);
    const s = 64; // 1m karo
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const v = (r() - .5) * 18;
      ctx.fillStyle = `rgb(${167 + v},${163 + v},${155 + v})`; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    }
    noise(ctx, w, h, 2500, ['#8f8b84', '#b9b5ad', '#9c988f', '#c4c0b8'], 0.5, 1.5, r);
    ctx.strokeStyle = 'rgba(80,76,70,0.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i <= w; i += s) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(60,55,50,0.12)'; ctx.beginPath(); ctx.arc(r() * w, r() * h, 4 + r() * 10, 0, 7); ctx.fill(); }
    return toTex(c);
  });
}

export function curbTex() {
  return cached('curb', () => {
    const c = canvas(128, 32), ctx = c.getContext('2d'), r = rng(5);
    ctx.fillStyle = '#bdb8ae'; ctx.fillRect(0, 0, 128, 32);
    noise(ctx, 128, 32, 400, ['#a19d95', '#cfcac0'], 0.5, 1.5, r);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 26, 128, 6);
    for (let x = 0; x < 128; x += 32) { ctx.fillStyle = 'rgba(70,70,70,0.5)'; ctx.fillRect(x, 0, 1, 32); }
    return toTex(c);
  });
}

export function grassTex() {
  return cached('grass', () => {
    const w = 256, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(9);
    ctx.fillStyle = '#5f8a46'; ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(${r() < .5 ? '70,110,50' : '120,150,70'},0.25)`; ctx.beginPath(); ctx.arc(r() * w, r() * w, 20 + r() * 40, 0, 7); ctx.fill(); }
    for (let i = 0; i < 4000; i++) {
      const x = r() * w, y = r() * w; ctx.strokeStyle = ['#4d7a38', '#6f9b50', '#7fa95c', '#3f6a30', '#8cb366'][(r() * 5) | 0];
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - .5) * 2, y - 2 - r() * 3); ctx.stroke();
    }
    for (let i = 0; i < 25; i++) { ctx.fillStyle = ['#f3efe0', '#f0d36a', '#e9a6b8'][(r() * 3) | 0]; ctx.fillRect(r() * w, r() * w, 2, 2); }
    return toTex(c);
  });
}

export function sandTex() {
  return cached('sand', () => {
    const w = 256, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(13);
    ctx.fillStyle = '#e2cfa2'; ctx.fillRect(0, 0, w, w);
    noise(ctx, w, w, 7000, ['#d6c093', '#ecdcb4', '#c9b183', '#f3e6c4', '#bda679'], 0.5, 1.4, r);
    ctx.strokeStyle = 'rgba(170,140,95,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); const y = r() * w; ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + 8, w * .6, y - 8, w, y); ctx.stroke(); }
    return toTex(c);
  });
}

export function dirtTex() {
  return cached('dirt', () => {
    const w = 256, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(17);
    ctx.fillStyle = '#8b7355'; ctx.fillRect(0, 0, w, w);
    noise(ctx, w, w, 6000, ['#7a6248', '#9c8364', '#6a5440', '#a8916f'], 0.6, 2, r);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = '#b0a594'; ctx.beginPath(); ctx.arc(r() * w, r() * w, 1 + r() * 2.5, 0, 7); ctx.fill(); }
    return toTex(c);
  });
}

export function concreteTex(lines = false) {
  return cached('conc' + lines, () => {
    const w = 256, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(19);
    ctx.fillStyle = '#8d8e8c'; ctx.fillRect(0, 0, w, w);
    noise(ctx, w, w, 5000, ['#7e7f7d', '#9a9b98', '#868785', '#a3a4a0'], 0.5, 1.5, r);
    ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, w);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(40,40,40,0.12)'; ctx.beginPath(); ctx.arc(r() * w, r() * w, 6 + r() * 16, 0, 7); ctx.fill(); }
    if (lines) { ctx.fillStyle = 'rgba(240,240,235,0.8)'; ctx.fillRect(0, 0, 4, w * 0.55); }
    return toTex(c);
  });
}

export function plazaTex() {
  return cached('plaza', () => {
    const w = 256, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(23);
    ctx.fillStyle = '#9a6f5a'; ctx.fillRect(0, 0, w, w);
    const bw = 32, bh = 16;
    for (let y = 0; y < w; y += bh) for (let x = -(y / bh % 2) * bw / 2; x < w; x += bw) {
      const v = (r() - .5) * 30; ctx.fillStyle = `rgb(${160 + v},${112 + v * .8},${88 + v * .6})`;
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
    noise(ctx, w, w, 1500, ['rgba(60,40,30,0.3)', 'rgba(220,200,180,0.2)'], 0.5, 1.5, r);
    return toTex(c);
  });
}

// ---------------------------------------------------------------- BİNALAR
const palettes = {
  brick: ['#8e4a3a', '#a0563f', '#7c4134', '#9a6248', '#b06a4f', '#6f3e35'],
  paint: ['#d9cbb1', '#c9d3c4', '#e6d3b8', '#b9c7cf', '#e3c9b4', '#cfd7b8', '#efe3cc'],
  siding: ['#e8e1d0', '#b8cdd8', '#e9d5a8', '#c8d8c0', '#f0e6df', '#d4b9a5', '#a8bfc9', '#f2ede1'],
  metal: ['#8a959b', '#9d8b72', '#7e8a7a', '#a3a7a9', '#6f7f8e'],
};
export { palettes };

function drawWindow(ctx, x, y, w, h, r, lit = false, frame = '#efe9de') {
  ctx.fillStyle = frame; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (lit && r() < 0.5) { g.addColorStop(0, '#ffd890'); g.addColorStop(1, '#e8a85a'); }
  else { g.addColorStop(0, '#5c7a94'); g.addColorStop(0.45, '#2c3e52'); g.addColorStop(1, '#40566b'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.7); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.75, y); ctx.lineTo(x, y + h); ctx.fill();
  ctx.fillStyle = frame; ctx.fillRect(x + w / 2 - 1, y, 2, h); ctx.fillRect(x, y + h / 2 - 1, w, 2);
  // perde
  if (r() < 0.5) { ctx.fillStyle = 'rgba(230,220,200,0.55)'; ctx.fillRect(x, y, w * 0.22, h); ctx.fillRect(x + w * 0.78, y, w * 0.22, h); }
  // pencere pervazı
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 3, y + h + 2, w + 6, 3);
}

function brickPattern(ctx, w, h, base, r) {
  ctx.fillStyle = shade(base, -0.35); ctx.fillRect(0, 0, w, h);
  const bw = 16, bh = 7;
  for (let y = 0; y < h; y += bh) for (let x = -((y / bh) % 2) * bw / 2; x < w; x += bw) {
    ctx.fillStyle = shade(base, (r() - .5) * 0.25); ctx.fillRect(x + 1, y + 1, bw - 1.5, bh - 1.5);
  }
}

// Üst katlar: modül = 6m genişlik x 3.5m (1 kat). 192x112px
export function upperFacadeTex(style, color, variant = 0, night = false) {
  return cached(`up_${style}_${color}_${variant}_${night}`, () => {
    const w = 192, h = 112, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(31 + variant * 7 + color.length);
    if (style === 'brick') brickPattern(ctx, w, h, color, r);
    else if (style === 'metal') {
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) { ctx.fillStyle = shade(color, -0.18); ctx.fillRect(x, 0, 3, h); ctx.fillStyle = shade(color, 0.12); ctx.fillRect(x + 3, 0, 1, h); }
      noise(ctx, w, h, 600, ['rgba(120,70,40,0.25)', 'rgba(0,0,0,0.12)'], 1, 3, r);
      ctx.fillStyle = 'rgba(40,50,60,0.9)'; ctx.fillRect(20, 14, w - 40, 16);
      ctx.fillStyle = 'rgba(150,180,200,0.35)'; for (let x = 22; x < w - 20; x += 12) ctx.fillRect(x, 16, 9, 12);
      return toTex(c);
    } else {
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 1500, [shade(color, -0.08), shade(color, 0.06)], 0.5, 1.5, r);
    }
    // kat silmesi
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, h - 6, w, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, h - 7, w, 1.5);
    const ww = 42, wh = 52;
    for (let i = 0; i < 2; i++) drawWindow(ctx, 30 + i * 96 - 6, 26, ww, wh, r, night, variant % 2 ? '#efe9de' : '#3d3a36');
    // yağmur lekesi
    for (let i = 0; i < 3; i++) { const g = ctx.createLinearGradient(0, 80, 0, h); g.addColorStop(0, 'rgba(0,0,0,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(25 + r() * 140, 80, 6, 30); }
    return toTex(c);
  });
}

const shopNames = ['BAKERY', 'DINER', 'BOOKS', 'BARBER', 'HARDWARE', 'FLORIST', 'PHARMACY', 'RECORDS', 'DELI', 'LAUNDRY', 'TAILOR', 'GROCERY', 'PIZZA', 'ANTIQUES', 'CAMERAS'];
// Zemin kat vitrini: modül = 6m x 4m. 192x128
export function storefrontTex(color, variant = 0, name = null, awning = '#2f6f5e', night = false) {
  return cached(`shop_${color}_${variant}_${name}_${awning}_${night}`, () => {
    const w = 192, h = 128, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(57 + variant * 13);
    brickPattern(ctx, w, h, shade(color, -0.1), r);
    // vitrin camı
    const g = ctx.createLinearGradient(0, 50, 0, 120);
    if (night) { g.addColorStop(0, '#ffe2a8'); g.addColorStop(1, '#d9964f'); }
    else { g.addColorStop(0, '#6e8ea8'); g.addColorStop(1, '#2b3a49'); }
    ctx.fillStyle = '#2b2622'; ctx.fillRect(10, 48, 120, 74);
    ctx.fillStyle = g; ctx.fillRect(14, 52, 112, 66);
    // vitrin içi silüetler
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(${night ? '120,70,30' : '20,25,30'},0.45)`; ctx.fillRect(20 + i * 17, 88 + r() * 10, 10, 30); }
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(14, 110); ctx.lineTo(70, 52); ctx.lineTo(90, 52); ctx.lineTo(30, 118); ctx.fill();
    // kapı
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(140, 50, 40, 74);
    ctx.fillStyle = night ? '#ffcf7a' : '#4f6a80'; ctx.fillRect(146, 56, 28, 36);
    ctx.fillStyle = '#c9a646'; ctx.fillRect(172, 92, 4, 4);
    // tente (çizgili)
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? awning : '#efe6d4'; ctx.fillRect(4 + i * 15.5, 30, 15.5, 16); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(4, 44, 186, 3);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? awning : '#efe6d4'; ctx.beginPath(); ctx.arc(4 + i * 15.5 + 7.75, 46, 7.75, 0, Math.PI); ctx.fill(); }
    // tabela
    ctx.fillStyle = '#1f2a33'; ctx.fillRect(18, 6, 156, 20);
    ctx.strokeStyle = '#c9a646'; ctx.lineWidth = 2; ctx.strokeRect(19, 7, 154, 18);
    ctx.fillStyle = night ? '#ffe9b0' : '#f2e3bd'; ctx.font = 'bold 14px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name || shopNames[(variant * 7) % shopNames.length], 96, 17);
    return toTex(c);
  });
}

// Ev cephesi (ahşap kaplama) — modül 4m x 3m: 128x96
export function sidingTex(color, variant = 0, door = false, night = false) {
  return cached(`sid_${color}_${variant}_${door}_${night}`, () => {
    const w = 128, h = 96, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(71 + variant);
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) { ctx.fillStyle = shade(color, -0.15); ctx.fillRect(0, y + 5, w, 1); ctx.fillStyle = shade(color, 0.1); ctx.fillRect(0, y, w, 1); }
    noise(ctx, w, h, 300, [shade(color, -0.1)], 0.5, 1.5, r);
    if (door) {
      ctx.fillStyle = '#efe9de'; ctx.fillRect(46, 30, 36, 66);
      ctx.fillStyle = ['#7a2e2e', '#2e4a6b', '#2f5a3e', '#5b3a24'][variant % 4]; ctx.fillRect(50, 34, 28, 62);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(54, 40, 9, 22); ctx.fillRect(65, 40, 9, 22); ctx.fillRect(54, 68, 9, 22); ctx.fillRect(65, 68, 9, 22);
      ctx.fillStyle = '#d6b552'; ctx.beginPath(); ctx.arc(73, 66, 2, 0, 7); ctx.fill();
    } else drawWindow(ctx, 38, 24, 52, 44, r, night);
    // köşe pervazı
    ctx.fillStyle = '#f4f0e8'; ctx.fillRect(0, 0, 3, h); ctx.fillRect(w - 3, 0, 3, h);
    return toTex(c);
  });
}

export function roofTex(kind, color = '#5b4a45', variant = 0) {
  return cached(`roof_${kind}_${color}_${variant}`, () => {
    const w = 256, h = 256, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(91 + variant);
    if (kind === 'shingle') {
      ctx.fillStyle = shade(color, -0.3); ctx.fillRect(0, 0, w, h);
      const sw = 20, sh = 14;
      for (let y = 0; y < h; y += sh) for (let x = -((y / sh) % 2) * sw / 2; x < w; x += sw) {
        ctx.fillStyle = shade(color, (r() - .5) * 0.3); ctx.fillRect(x + 1, y, sw - 2, sh - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 1, y + sh - 3, sw - 2, 2);
      }
      noise(ctx, w, h, 800, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.08)'], 0.5, 1.5, r);
      // yosun
      for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(90,110,60,0.15)'; ctx.beginPath(); ctx.arc(r() * w, r() * h, 6 + r() * 18, 0, 7); ctx.fill(); }
    } else if (kind === 'flat') {
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 9000, [shade(color, -0.12), shade(color, 0.1), shade(color, -0.2)], 0.6, 1.6, r);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(30,30,30,0.12)'; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 14, r() * 3, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(40,40,40,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * 64 + 32); ctx.lineTo(w, i * 64 + 32); ctx.stroke(); }
    } else if (kind === 'metal') {
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 10) { ctx.fillStyle = shade(color, -0.2); ctx.fillRect(x, 0, 3, h); ctx.fillStyle = shade(color, 0.15); ctx.fillRect(x + 3, 0, 1, h); }
      noise(ctx, w, h, 900, ['rgba(140,80,40,0.25)', 'rgba(0,0,0,0.1)'], 1, 4, r);
      ctx.fillStyle = 'rgba(200,230,240,0.35)'; ctx.fillRect(40, 30, 24, 190); ctx.fillRect(160, 30, 24, 190);
    }
    return toTex(c);
  });
}

// ---------------------------------------------------------------- ARAÇLAR
export function carBodyTex(color, kind = 'sedan') {
  return cached(`carside_${color}_${kind}`, () => {
    const w = 256, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(101);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(color, 0.25)); g.addColorStop(0.45, color); g.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // kapı çizgileri
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(98, 4); ctx.lineTo(98, h - 8); ctx.moveTo(158, 4); ctx.lineTo(158, h - 8); ctx.stroke();
    // kapı kolu
    ctx.fillStyle = 'rgba(220,220,220,0.8)'; ctx.fillRect(140, 18, 10, 3); ctx.fillRect(200, 18, 10, 3);
    // krom şerit
    ctx.fillStyle = 'rgba(230,230,230,0.7)'; ctx.fillRect(10, 30, w - 20, 2);
    // çamurluk kemerleri
    ctx.fillStyle = '#151515';
    ctx.beginPath(); ctx.arc(52, h + 4, 24, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(w - 52, h + 4, 24, Math.PI, 0); ctx.fill();
    if (kind === 'police') { ctx.fillStyle = '#f4f4f4'; ctx.fillRect(80, 6, 100, 30); ctx.fillStyle = '#1b2a4a'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('POLICE', 130, 27); }
    if (kind === 'taxi') { ctx.fillStyle = '#222'; for (let x = 10; x < w - 10; x += 10) ctx.fillRect(x, 34, 5, 5); }
    noise(ctx, w, h, 120, ['rgba(255,255,255,0.15)', 'rgba(0,0,0,0.15)'], 0.5, 1.2, r);
    return toTex(c, { repeat: false });
  });
}

export function carTopTex(color, kind = 'sedan') {
  return cached(`cartop_${color}_${kind}`, () => {
    const w = 128, h = 256, c = canvas(w, h), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, shade(color, -0.2)); g.addColorStop(0.35, shade(color, 0.22)); g.addColorStop(0.6, color); g.addColorStop(1, shade(color, -0.25));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // panel çizgileri
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(20, h - 10); ctx.moveTo(w - 20, 10); ctx.lineTo(w - 20, h - 10); ctx.stroke();
    // parlama
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(38, 0, 10, h); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(52, 0, 5, h);
    if (kind === 'police') { ctx.fillStyle = '#f2f2f2'; ctx.fillRect(14, 90, w - 28, 76); ctx.fillStyle = '#1b2a4a'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.save(); ctx.translate(w / 2, 128); ctx.rotate(Math.PI / 2); ctx.fillText('17', 0, 8); ctx.restore(); }
    if (kind === 'taxi') { ctx.fillStyle = '#111'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.fillText('TAXI', w / 2, 135); }
    return toTex(c, { repeat: false });
  });
}

export function glassTex() {
  return cached('glass', () => {
    const w = 128, h = 128, c = canvas(w, h), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#9fb8cc'); g.addColorStop(0.3, '#2a3a4c'); g.addColorStop(0.7, '#141c26'); g.addColorStop(1, '#3a4e62');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(10, h); ctx.lineTo(70, 0); ctx.lineTo(90, 0); ctx.lineTo(30, h); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(45, h); ctx.lineTo(105, 0); ctx.lineTo(112, 0); ctx.lineTo(52, h); ctx.fill();
    return toTex(c, { repeat: false });
  });
}

export function grilleTex(color) {
  return cached('grille' + color, () => {
    const w = 128, h = 32, c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = shade(color, -0.2); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(34, 6, 60, 18);
    ctx.fillStyle = '#9a9a9a'; for (let y = 8; y < 24; y += 4) ctx.fillRect(36, y, 56, 1.5);
    ctx.fillStyle = '#e8e8e0'; ctx.fillRect(4, 6, 24, 14); ctx.fillRect(w - 28, 6, 24, 14);
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, 26, w, 6);
    return toTex(c, { repeat: false });
  });
}

export function tireTex() {
  return cached('tire', () => {
    const c = canvas(64, 64), ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#2b2b2b'; for (let x = 0; x < 64; x += 6) ctx.fillRect(x, 0, 3, 64);
    return toTex(c);
  });
}

export function rimTex() {
  return cached('rim', () => {
    const c = canvas(64, 64), ctx = c.getContext('2d');
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#b8b8b8'; ctx.beginPath(); ctx.arc(32, 32, 20, 0, 7); ctx.fill();
    ctx.fillStyle = '#6a6a6a'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(32, 32); ctx.rotate(i * 1.2566); ctx.fillRect(-3, 4, 6, 14); ctx.restore(); }
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(32, 32, 5, 0, 7); ctx.fill();
    return toTex(c, { repeat: false });
  });
}

// ---------------------------------------------------------------- KARAKTERLER
export function faceTex(skin, hair, { female = false, beard = false, police = false, angry = false } = {}) {
  return cached(`face_${skin}_${hair}_${female}_${beard}_${police}_${angry}`, () => {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = skin; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(32, 38, 4, 32, 38, 34); g.addColorStop(0, 'rgba(255,200,180,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hair; ctx.fillRect(0, 0, w, female ? 20 : 16);
    if (female) { ctx.fillRect(0, 0, 9, h); ctx.fillRect(w - 9, 0, 9, h); }
    // gözler
    ctx.fillStyle = '#fff'; ctx.fillRect(17, 28, 10, 6); ctx.fillRect(37, 28, 10, 6);
    ctx.fillStyle = '#2b2018'; ctx.fillRect(20, 28, 5, 6); ctx.fillRect(40, 28, 5, 6);
    ctx.fillStyle = hair; ctx.fillRect(15, angry ? 25 : 23, 13, 2); ctx.fillRect(36, angry ? 25 : 23, 13, 2);
    ctx.fillStyle = 'rgba(120,60,50,0.5)'; ctx.fillRect(30, 36, 4, 6);
    ctx.fillStyle = female ? '#b34a4a' : '#8a4a40'; ctx.fillRect(25, 46, 14, 3);
    if (female) { ctx.fillStyle = 'rgba(230,120,120,0.25)'; ctx.fillRect(12, 38, 8, 5); ctx.fillRect(44, 38, 8, 5); }
    if (beard) { ctx.fillStyle = 'rgba(40,30,25,0.6)'; ctx.fillRect(14, 44, 36, 20); }
    if (police) { ctx.fillStyle = '#1b2a4a'; ctx.fillRect(0, 0, w, 14); ctx.fillStyle = '#d4b24c'; ctx.fillRect(28, 3, 8, 8); }
    return toTex(c, { repeat: false });
  });
}

export function hairTopTex(hair) {
  return cached('hairtop' + hair, () => {
    const c = canvas(32, 32), ctx = c.getContext('2d'), r = rng(5);
    ctx.fillStyle = hair; ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = shade(hair, 0.2); for (let i = 0; i < 40; i++) { ctx.beginPath(); const x = r() * 32; ctx.moveTo(x, r() * 32); ctx.lineTo(x + 2, r() * 32); ctx.stroke(); }
    return toTex(c, { repeat: false });
  });
}

export function clothTex(color, kind = 'shirt') {
  return cached(`cloth_${color}_${kind}`, () => {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(131);
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 600, [shade(color, -0.12), shade(color, 0.08)], 0.5, 1.2, r);
    if (kind === 'jacket') { ctx.fillStyle = shade(color, -0.3); ctx.fillRect(30, 0, 4, h); ctx.fillStyle = '#bbb'; for (let y = 8; y < h; y += 12) ctx.fillRect(28, y, 2, 2); ctx.fillStyle = shade(color, 0.15); ctx.fillRect(8, 10, 12, 8); }
    if (kind === 'police') { ctx.fillStyle = '#d4b24c'; ctx.fillRect(10, 14, 8, 10); ctx.fillStyle = '#111'; ctx.fillRect(0, 52, w, 6); ctx.fillStyle = '#777'; ctx.fillRect(28, 52, 8, 6); }
    if (kind === 'stripes') { ctx.fillStyle = shade(color, 0.35); for (let y = 0; y < h; y += 10) ctx.fillRect(0, y, w, 4); }
    if (kind === 'jeans') { ctx.strokeStyle = shade(color, 0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(32, h); ctx.stroke(); }
    if (kind === 'hoodie') { ctx.fillStyle = shade(color, -0.25); ctx.fillRect(16, 36, 32, 14); ctx.fillStyle = '#ddd'; ctx.fillRect(26, 4, 2, 14); ctx.fillRect(36, 4, 2, 14); }
    return toTex(c, { repeat: false });
  });
}

// ---------------------------------------------------------------- EFEKT SPRITE'LARI
export function softDotTex() {
  return cached('softdot', () => {
    const c = canvas(64, 64), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return toTex(c, { repeat: false, srgb: false });
  });
}
export function smokeTex() {
  return cached('smoke', () => {
    const c = canvas(64, 64), ctx = c.getContext('2d'), r = rng(77);
    for (let i = 0; i < 14; i++) {
      const x = 20 + r() * 24, y = 20 + r() * 24, rad = 10 + r() * 14;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    }
    return toTex(c, { repeat: false, srgb: false });
  });
}
export function lightPoolTex() {
  return cached('lightpool', () => {
    const c = canvas(128, 128), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,210,140,0.9)'); g.addColorStop(0.5, 'rgba(255,180,100,0.35)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return toTex(c, { repeat: false });
  });
}
export function headlightConeTex() {
  return cached('hlcone', () => {
    const c = canvas(128, 256), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 250, 0, 64, 250, 250);
    g.addColorStop(0, 'rgba(255,245,215,0.9)'); g.addColorStop(0.6, 'rgba(255,240,200,0.25)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(48, 256); ctx.lineTo(0, 0); ctx.lineTo(128, 0); ctx.lineTo(80, 256); ctx.fill();
    return toTex(c, { repeat: false });
  });
}
export function bloodTex() {
  return cached('blood', () => {
    const c = canvas(64, 64), ctx = c.getContext('2d'), r = rng(3);
    ctx.fillStyle = 'rgba(110,10,14,0.85)';
    ctx.beginPath(); ctx.arc(32, 32, 14, 0, 7); ctx.fill();
    for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(32 + (r() - .5) * 44, 32 + (r() - .5) * 44, 1 + r() * 4, 0, 7); ctx.fill(); }
    return toTex(c, { repeat: false });
  });
}
export function skidTex() {
  return cached('skid', () => {
    const c = canvas(16, 64), ctx = c.getContext('2d'), r = rng(9);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(10,10,10,${0.25 + r() * 0.5})`; ctx.fillRect(r() * 16, r() * 64, 1.5, 2); }
    return toTex(c);
  });
}
export function markerTex() {
  return cached('marker', () => {
    const c = canvas(64, 128), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128);
    return toTex(c, { repeat: false });
  });
}
export function waterTex() {
  return cached('water', () => {
    const w = 256, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(41);
    ctx.fillStyle = '#3d7f96'; ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 260; i++) { ctx.strokeStyle = `rgba(${r() < .5 ? '200,235,240' : '30,80,100'},${0.15 + r() * 0.25})`; ctx.lineWidth = 1 + r() * 1.5; const x = r() * w, y = r() * w, l = 6 + r() * 16; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 2, x + l, y); ctx.stroke(); }
    return toTex(c);
  });
}
export function foliageTex(color = '#4f7d3a') {
  return cached('fol' + color, () => {
    const w = 128, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(61);
    ctx.fillStyle = shade(color, -0.2); ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 500; i++) { ctx.fillStyle = shade(color, (r() - .4) * 0.5); ctx.beginPath(); ctx.ellipse(r() * w, r() * w, 2 + r() * 4, 1.5 + r() * 2.5, r() * 3, 0, 7); ctx.fill(); }
    return toTex(c);
  });
}
export function barkTex() {
  return cached('bark', () => {
    const c = canvas(32, 64), ctx = c.getContext('2d'), r = rng(2);
    ctx.fillStyle = '#5b4332'; ctx.fillRect(0, 0, 32, 64);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = r() < .5 ? '#3f2e22' : '#735743'; ctx.fillRect(r() * 32, r() * 64, 2, 6 + r() * 10); }
    return toTex(c);
  });
}

export function snowTex() {
  return cached('snow', () => {
    const w = 256, c = canvas(w, w), ctx = c.getContext('2d'), r = rng(88);
    ctx.fillStyle = '#eef3f6'; ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(${r() < .5 ? '200,215,228' : '255,255,255'},0.5)`; ctx.beginPath(); ctx.ellipse(r() * w, r() * w, 20 + r() * 50, 10 + r() * 30, r() * 3, 0, 7); ctx.fill(); }
    noise(ctx, w, w, 3000, ['#dfe8ee', '#ffffff', '#d2dde6'], 0.5, 1.5, r);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(90,120,70,0.35)'; ctx.fillRect(r() * w, r() * w, 1.5, 3); }
    return toTex(c);
  });
}
