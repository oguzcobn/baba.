// PARK. — Konyaaltı Park Simülatörü
// Sakin, el boyaması görünümlü 3B park oyunu. Araç: 2003 Mercedes-Benz C32 AMG (GLB, metre, +Y yukarı, −Z ileri).
// Fizik: düşük hız kinematik bisiklet modeli (arka aks referanslı), Ackermann sınırlı direksiyon, otomatik şanzıman
// sürünmesi, yönlü sınırlayıcı kutu (OBB) çarpışması (SAT) ve yumuşak durma. Ölçüler gerçek araçtan.
import * as T from '../../js/vendor/three.module.min.js';
import { GLTFLoader } from './GLTFLoader.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------------- araç sabitleri (C32 AMG) ---------------- */
const WHEELBASE = 2.715, TRACK = 1.50;
const DELTA_MAX = Math.atan(WHEELBASE / (Math.sqrt(5.38 ** 2 - WHEELBASE ** 2) - 0.79)); // ≈35°: 10,76 m dönüş çapı
const LOCK_TURNS = 1.4;              // direksiyon simidi: kilitten kilide ~2,8 tur
const V_MAX_D = 5.6, V_MAX_R = 2.5;  // park modunda üst hız (≈20 / 9 km/sa)
const CREEP = 1.55;                  // otomatik vites sürünme hızı ≈5,6 km/sa

/* ---------------- render ---------------- */
const canvas = $('view');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputEncoding = T.sRGBEncoding;
const scene = new T.Scene();
scene.fog = new T.Fog(0xe9dcc4, 70, 420);
const camera = new T.PerspectiveCamera(55, 1, 0.1, 1500);
const rearCam = new T.PerspectiveCamera(78, 1.6, 0.05, 120);

/* Kâğıt dokusu (CSS katmanı) */
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${120 + Math.random() * 40 | 0},${100 + Math.random() * 30 | 0},70,${Math.random() * .09})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random(), 1 + Math.random()); }
  for (let i = 0; i < 60; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 20 + Math.random() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(200,180,140,.10)'); gr.addColorStop(1, 'rgba(200,180,140,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  $('paper').style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* Toon gölgelendirme kademeleri: yumuşak 4 ton (boyalı resim etkisi) */
const toneMap = (() => { const d = new Uint8Array([90, 150, 205, 255]); const t = new T.DataTexture(d, 4, 1, T.LuminanceFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
const canvasTex = (w, h, draw, rep = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
/* suluboya lekeleri */
function blots(g, w, h, n, cols, rMin, rMax, a = .12) {
  for (let i = 0; i < n; i++) { const x = Math.random() * w, y = Math.random() * h, r = rMin + Math.random() * (rMax - rMin), gr = g.createRadialGradient(x, y, 0, x, y, r); const c = cols[i % cols.length]; gr.addColorStop(0, c.replace('A', a)); gr.addColorStop(1, c.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
}
const TEX = {
  asphalt: canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#8d8f8b'; g.fillRect(0, 0, w, h); blots(g, w, h, 140, ['rgba(70,72,74,A)', 'rgba(170,166,150,A)', 'rgba(120,118,108,A)'], 20, 90, .16); for (let i = 0; i < 16000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '40,40,40' : '220,215,200'},${Math.random() * .12})`; g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); } }, 6),
  grass: canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#9fb27a'; g.fillRect(0, 0, w, h); blots(g, w, h, 160, ['rgba(110,140,80,A)', 'rgba(190,190,120,A)', 'rgba(80,110,70,A)'], 20, 80, .22); for (let i = 0; i < 6000; i++) { g.strokeStyle = `rgba(70,100,50,${Math.random() * .25})`; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y - rnd(3, 7)); g.stroke(); } }, 14),
  tile: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e2d6bd'; g.fillRect(0, 0, w, h); blots(g, w, h, 50, ['rgba(200,180,140,A)', 'rgba(240,232,215,A)'], 10, 40, .3); g.strokeStyle = 'rgba(150,130,100,.45)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }, 1),
  paint: canvasTex(64, 256, (g, w, h) => { g.fillStyle = 'rgba(250,247,238,.92)'; g.fillRect(4, 0, w - 8, h); for (let i = 0; i < 300; i++) { g.clearRect(Math.random() < .5 ? rnd(0, 6) : rnd(w - 6, w), Math.random() * h, 2, rnd(2, 6)); g.fillStyle = `rgba(150,150,140,${Math.random() * .25})`; g.fillRect(rnd(4, w - 4), Math.random() * h, 2, 2); } }, 1),
  stone: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d8cdb5'; g.fillRect(0, 0, w, h); blots(g, w, h, 70, ['rgba(160,140,110,A)', 'rgba(245,238,222,A)'], 8, 40, .35); g.strokeStyle = 'rgba(120,100,80,.35)'; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 32) % 2 * 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } }, 1),
};
const M = {
  asphalt: new T.MeshLambertMaterial({ map: TEX.asphalt }),
  grass: new T.MeshLambertMaterial({ map: TEX.grass }),
  tile: new T.MeshLambertMaterial({ map: TEX.tile }),
  paint: new T.MeshBasicMaterial({ map: TEX.paint, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  stone: new T.MeshToonMaterial({ map: TEX.stone, gradientMap: toneMap }),
  toon: c => new T.MeshToonMaterial({ color: c, gradientMap: toneMap }),
};

/* ---------------- gökyüzü, deniz, dağlar ---------------- */
const sky = new T.Mesh(new T.SphereGeometry(900, 32, 16), new T.ShaderMaterial({
  side: T.BackSide, depthWrite: false, fog: false,
  uniforms: { t: { value: 0 } },
  vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `varying vec3 v; uniform float t;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s = 0., a = .5; for(int i=0;i<5;i++){ s += a*n(p); p *= 2.03; a *= .5; } return s; }
    void main(){ vec3 d = normalize(v); float y = max(d.y, 0.);
      vec3 c = mix(vec3(.96,.89,.76), vec3(.55,.74,.82), pow(y, .55));
      vec2 uv = d.xz / (d.y + .25) * 1.6 + vec2(t*.004, 0.);
      float cl = smoothstep(.55, .85, fbm(uv)) * smoothstep(0., .25, y);
      c = mix(c, vec3(1., .98, .94), cl * .75);
      c += vec3(1., .85, .6) * pow(max(dot(d, normalize(vec3(-.4, .35, .8))), 0.), 24.) * .35;
      gl_FragColor = vec4(c, 1.); }` }));
scene.add(sky);
{ const pm = new T.PMREMGenerator(renderer), es = new T.Scene(); es.add(new T.Mesh(new T.SphereGeometry(10, 16, 8), new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true }))); const g = es.children[0].geometry, c = []; const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; const k = (y + 1) / 2; c.push(lerp(.75, .7, k), lerp(.68, .82, k), lerp(.55, .9, k)); } g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); scene.environment = pm.fromScene(es, .04).texture; }
const sea = new T.Mesh(new T.PlaneGeometry(2400, 900, 1, 1), new T.ShaderMaterial({
  uniforms: { t: { value: 0 } }, fog: false,
  vertexShader: 'varying vec3 w; void main(){ vec4 p = modelMatrix*vec4(position,1.); w = p.xyz; gl_Position = projectionMatrix*viewMatrix*p; }',
  fragmentShader: `varying vec3 w; uniform float t;
    float h(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 15731.7); }
    void main(){ float d = clamp((w.z - 40.) / 500., 0., 1.);
      vec3 c = mix(vec3(.34,.62,.66), vec3(.55,.72,.78), d);
      float s = sin(w.x*.35 + t*.8 + sin(w.z*.2)) * sin(w.z*.5 - t*.6);
      c += smoothstep(.75, 1., s) * .12 * (1. - d);
      c = mix(c, vec3(.93,.87,.75), smoothstep(.75, 1., d));
      gl_FragColor = vec4(c, 1.); }` }));
sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.35, 490); scene.add(sea);
function mountainLayer(dist, height, col, seed, alpha) {
  const tex = canvasTex(2048, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); let y = h * .6; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) { const s = Math.sin(x * .004 + seed) * .25 + Math.sin(x * .011 + seed * 2) * .14 + Math.sin(x * .029 + seed) * .06; y = h * (.38 - s); g.lineTo(x, y); }
    g.lineTo(w, h); g.closePath(); g.fillStyle = col; g.fill();
    g.globalCompositeOperation = 'source-atop'; blots(g, w, h, 160, ['rgba(255,255,255,A)', 'rgba(40,60,60,A)'], 20, 80, .1);
  });
  tex.wrapS = T.ClampToEdgeWrapping;
  const m = new T.Mesh(new T.PlaneGeometry(dist * 3.2, height), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: alpha, fog: false, depthWrite: false }));
  m.position.set(0, height * .35, -dist); scene.add(m); return m;
}
mountainLayer(700, 260, '#93a8a6', 1.3, .85); mountainLayer(520, 170, '#7f9a8f', 3.1, .95);

/* ---------------- ışık ---------------- */
scene.add(new T.HemisphereLight(0xfff1d8, 0x8a8f6a, 0.85));
const sun = new T.DirectionalLight(0xffe0b8, 1.35);
sun.position.set(-40, 70, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* ---------------- dünya geometrisi ---------------- */
const obstacles = [];  // {type:'obb', cx, cz, hw, hd, ang} | {type:'circ', cx, cz, r}
const world = new T.Group(); scene.add(world);
function plane(w, d, mat, x, y, z, rot = 0, rep) {
  const g = new T.PlaneGeometry(w, d); if (rep) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / rep, uv.getY(i) * d / rep); }
  const m = new T.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, y, z); m.receiveShadow = true; world.add(m); return m;
}
function box(w, h, d, mat, x, y, z, ang = 0, solid = true) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.rotation.y = ang; m.castShadow = m.receiveShadow = true; world.add(m);
  if (solid) obstacles.push({ type: 'obb', cx: x, cz: z, hw: w / 2, hd: d / 2, ang });
  return m;
}
function stripe(x1, z1, x2, z2, w = 0.12) {
  const L = Math.hypot(x2 - x1, z2 - z1), m = new T.Mesh(new T.PlaneGeometry(w, L), M.paint);
  m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(x2 - x1, z2 - z1); m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); world.add(m); return m;
}
// zemin: çim, otopark asfaltı, kaldırımlar
plane(400, 400, M.grass, 0, -0.02, 0, 0, 8);
plane(66, 50, M.asphalt, 0, 0, 0, 0, 10);
plane(76, 4, M.tile, 0, 0.005, 27, 0, 4); plane(76, 4, M.tile, 0, 0.005, -27, 0, 4);
plane(4, 58, M.tile, 35, 0.005, 0, 0, 4); plane(4, 58, M.tile, -35, 0.005, 0, 0, 4);
// sahil şeridi ve kum
const sandMat = new T.MeshLambertMaterial({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e8d6ae'; g.fillRect(0, 0, w, h); blots(g, w, h, 80, ['rgba(210,185,140,A)', 'rgba(250,240,215,A)'], 10, 50, .3); }, 1) });
plane(400, 22, sandMat, 0, -0.01, 40, 0, 12);
// kenar bordürleri (araç çıkamaz)
const curbMat = M.stone;
[[0, -25.3, 66, .3], [0, 25.3, 66, .3]].forEach(([x, z, w, d]) => box(w, 0.16, d, curbMat, x, 0, z));
[[-33.3, 0, .3, 50.9], [33.3, 0, .3, 50.9]].forEach(([x, z, w, d]) => box(w, 0.16, d, curbMat, x, 0, z));

/* ---------------- park yerleri ---------------- */
const bays = []; // {id, cx, cz, ang (araç ileri yönü, ψ), w, d}
function bayRect(b) { const s = Math.sin(b.ang), c = Math.cos(b.ang), hw = b.w / 2, hd = b.d / 2; const P = (lx, lz) => [b.cx + lx * c + lz * s, b.cz - lx * s + lz * c]; return [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)]; }
function drawBay(b, open = 'front') {
  const [a, bb, c, d] = bayRect(b); // a,b ön (−z yerel), c,d arka
  stripe(a[0], a[1], d[0], d[1]); stripe(bb[0], bb[1], c[0], c[1]);
  if (open !== 'back') stripe(c[0], c[1], d[0], d[1]);
}
// Kuzey sırası: dik park, açık taraf güneye bakar (ileri park → araç kuzeye bakar: ψ=0)
const ROW_N = [], ROW_S = [];
for (let i = 0; i < 15; i++) { const b = { id: 'N' + i, cx: -18.2 + i * 2.6, cz: -20.4, ang: 0, w: 2.6, d: 5.2 }; bays.push(b); ROW_N.push(b); drawBay(b); }
for (let i = 0; i < 15; i++) { const b = { id: 'S' + i, cx: -18.2 + i * 2.6, cz: 20.4, ang: 0, w: 2.6, d: 5.2 }; bays.push(b); ROW_S.push(b); const [a, bb, c, d] = bayRect(b); stripe(a[0], a[1], d[0], d[1]); stripe(bb[0], bb[1], c[0], c[1]); stripe(a[0], a[1], bb[0], bb[1]); }
// Dar boşluk: kuzey sırasında 2,30 m genişlikte özel yer
const NARROW = { id: 'NX', cx: 22.0, cz: -20.4, ang: 0, w: 2.3, d: 5.0 }; bays.push(NARROW); drawBay(NARROW);
// Açılı (45°) park: doğu tarafı
const ANG = [];
for (let i = 0; i < 6; i++) { const b = { id: 'A' + i, cx: 28.6, cz: -9 + i * 3.4, ang: -Math.PI / 4 - Math.PI / 2, w: 2.5, d: 5.0 }; bays.push(b); ANG.push(b); drawBay(b); }
// Paralel park: batı bordürü boyunca (araç güneye bakar, bordür sağda — Türkiye'de sağdan trafik)
const PAR_GAP = { id: 'P0', cx: -31.2, cz: 0.5, ang: Math.PI, w: 2.1, d: 6.6 };
bays.push(PAR_GAP);
stripe(-32.25, -14, -32.25, 14, .1);
// Garaj: güney sırasının doğusunda üç duvarlı kapalı alan
const GARAGE = { id: 'G0', cx: 24.4, cz: 20.6, ang: 0, w: 2.9, d: 5.4 };
bays.push(GARAGE);
const wallMat = M.toon(0xe9dcc3), roofMat = M.toon(0xc8735a);
box(0.25, 2.5, 5.8, wallMat, GARAGE.cx - 1.58, 0, GARAGE.cz + .1); box(0.25, 2.5, 5.8, wallMat, GARAGE.cx + 1.58, 0, GARAGE.cz + .1);
box(3.4, 2.5, 0.25, wallMat, GARAGE.cx, 0, GARAGE.cz + 3.0);
const roof = new T.Mesh(new T.BoxGeometry(3.9, 0.22, 6.3), roofMat); roof.position.set(GARAGE.cx, 2.6, GARAGE.cz + .1); roof.castShadow = true; world.add(roof);
drawBay(GARAGE);
// Duvarlar: sıraların arkasında alçak taş duvar
box(41, 0.55, 0.35, curbMat, 0, 0, -23.35); box(41, 0.55, 0.35, curbMat, 0, 0, 23.35);
// şerit okları ve yaya geçidi
function arrow(x, z, ang) { const s = new T.Shape(); s.moveTo(0, -1.4); s.lineTo(.55, -.4); s.lineTo(.2, -.4); s.lineTo(.2, 1); s.lineTo(-.2, 1); s.lineTo(-.2, -.4); s.lineTo(-.55, -.4); s.closePath(); const m = new T.Mesh(new T.ShapeGeometry(s), M.paint); m.rotation.x = -Math.PI / 2; m.rotation.z = ang; m.position.set(x, 0.012, z); world.add(m); }
arrow(-8, 0, 0); arrow(8, 0, Math.PI); arrow(24, -2, -Math.PI / 2); arrow(-26, 6, Math.PI / 2);
for (let i = 0; i < 7; i++) stripe(-3 + i * 1, 24.2, -3 + i * 1, 26.8, .5);
// Engelli park yeri boyası (S0)
(() => { const b = ROW_S[0]; const m = new T.Mesh(new T.PlaneGeometry(b.w - .2, b.d - .3), new T.MeshBasicMaterial({ color: 0x4f7fb0, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })); m.rotation.x = -Math.PI / 2; m.position.set(b.cx, .011, b.cz); world.add(m); })();

/* ---------------- park etmiş araçlar (el yapımı oyuncak araçlar) ---------------- */
const PASTEL = [0xd99d6c, 0x83a9b8, 0xc8826f, 0xa9b982, 0xe2c27c, 0xb39cc0, 0x9fbfae, 0xe8e1d0, 0x6f8fa6, 0xcf9fa2];
const carGeoCache = {};
function toyCar(color) {
  const g = new T.Group();
  if (!carGeoCache.body) {
    const s = new T.Shape(); // yan profil (z ekseni boyunca, uzunluk 4.4)
    s.moveTo(-2.2, .28); s.lineTo(-2.2, .78); s.quadraticCurveTo(-2.15, .95, -1.9, .98); s.lineTo(1.95, .98); s.quadraticCurveTo(2.2, .95, 2.2, .7); s.lineTo(2.2, .28); s.closePath();
    carGeoCache.body = new T.ExtrudeGeometry(s, { depth: 1.62, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 3 }); carGeoCache.body.translate(0, 0, -.81);
    const c = new T.Shape(); c.moveTo(-1.35, .96); c.lineTo(-.85, 1.42); c.lineTo(.75, 1.42); c.lineTo(1.25, .96); c.closePath();
    carGeoCache.cab = new T.ExtrudeGeometry(c, { depth: 1.36, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 }); carGeoCache.cab.translate(0, 0, -.68);
    carGeoCache.win = new T.ExtrudeGeometry(c, { depth: 1.4, bevelEnabled: false }); carGeoCache.win.scale(.94, .92, 1); carGeoCache.win.translate(0, .1, -.7);
    carGeoCache.wheel = new T.CylinderGeometry(.33, .33, .24, 18); carGeoCache.wheel.rotateZ(Math.PI / 2);
  }
  const mat = M.toon(color);
  const body = new T.Mesh(carGeoCache.body, mat); body.rotation.y = Math.PI / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  const cab = new T.Mesh(carGeoCache.cab, mat); cab.rotation.y = Math.PI / 2; cab.castShadow = true; g.add(cab);
  const win = new T.Mesh(carGeoCache.win, M.toon(0x41545c)); win.rotation.y = Math.PI / 2; win.scale.set(1.002, 1, .985); g.add(win);
  const tyre = M.toon(0x2c2e2c);
  [[-.8, 1.38], [.8, 1.38], [-.8, -1.38], [.8, -1.38]].forEach(([x, z]) => { const w = new T.Mesh(carGeoCache.wheel, tyre); w.position.set(x, .33, z); w.castShadow = true; g.add(w); });
  const lamp = M.toon(0xf3e9c8), tail = M.toon(0xb8493f);
  [-.55, .55].forEach(x => { const a = new T.Mesh(new T.BoxGeometry(.38, .14, .05), lamp); a.position.set(x, .72, -2.27); g.add(a); const b = new T.Mesh(new T.BoxGeometry(.38, .14, .05), tail); b.position.set(x, .74, 2.27); g.add(b); });
  return g;
}
const parked = new T.Group(); world.add(parked);
let parkedObs = [];
function placeParked(b, flip = false, shift = 0) {
  const m = toyCar(PASTEL[(Math.random() * PASTEL.length) | 0]);
  const ang = b.ang + (flip ? Math.PI : 0), jitterA = rnd(-.035, .035), jx = rnd(-.12, .12) + shift;
  const s = Math.sin(b.ang), c = Math.cos(b.ang);
  const cx = b.cx + jx * c, cz = b.cz - jx * s;
  m.position.set(cx, 0, cz); m.rotation.y = ang + jitterA; parked.add(m);
  parkedObs.push({ type: 'obb', cx, cz, hw: .9, hd: 2.27, ang: ang + jitterA });
}
function clearParked() { while (parked.children.length) parked.remove(parked.children[0]); parkedObs = []; }

/* ---------------- çevre detayları ---------------- */
function palm(x, z, h = rnd(6, 8.5)) {
  const g = new T.Group(); g.position.set(x, 0, z); world.add(g);
  const trunkM = M.toon(0x9a7d5c), leafM = new T.MeshToonMaterial({ color: 0x6f8f4e, gradientMap: toneMap, side: T.DoubleSide });
  const lean = rnd(-.25, .25), seg = 9; let px = 0, py = 0;
  for (let i = 0; i < seg; i++) { const t = i / seg, r = .26 - t * .1; const m = new T.Mesh(new T.CylinderGeometry(r * .92, r, h / seg + .02, 8), trunkM); const nx = Math.sin(t * 1.2) * lean * h * .25; m.position.set(nx, py + h / seg / 2, 0); m.castShadow = true; g.add(m); px = nx; py += h / seg; }
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2, lf = new T.Group(); lf.position.set(px, py, 0); lf.rotation.y = a; g.add(lf);
    const s = new T.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(1.6, .55, 3.2, -.6); s.quadraticCurveTo(1.6, -.1, 0, 0);
    const m = new T.Mesh(new T.ShapeGeometry(s, 8), leafM); m.rotation.x = -Math.PI / 2 + rnd(.4, .8); m.castShadow = true; lf.add(m);
  }
  obstacles.push({ type: 'circ', cx: x, cz: z, r: .35 });
}
function lamp(x, z) { const g = new T.Group(); g.position.set(x, 0, z); world.add(g); const pM = M.toon(0x4a5552); const p = new T.Mesh(new T.CylinderGeometry(.07, .1, 5, 8), pM); p.position.y = 2.5; p.castShadow = true; g.add(p); const arm = new T.Mesh(new T.BoxGeometry(.9, .07, .07), pM); arm.position.set(.4, 4.95, 0); g.add(arm); const head = new T.Mesh(new T.SphereGeometry(.22, 10, 8), new T.MeshBasicMaterial({ color: 0xfff2cf })); head.position.set(.85, 4.85, 0); g.add(head); obstacles.push({ type: 'circ', cx: x, cz: z, r: .15 }); }
function bench(x, z, ang) { const w = M.toon(0x9b6f4e), mt = M.toon(0x4d5351); const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ang; world.add(g); for (let i = 0; i < 3; i++) { const s = new T.Mesh(new T.BoxGeometry(1.8, .06, .14), w); s.position.set(0, .46, -.18 + i * .18); s.castShadow = true; g.add(s); } const back = new T.Mesh(new T.BoxGeometry(1.8, .4, .06), w); back.position.set(0, .75, .25); g.add(back); [-.8, .8].forEach(px => { const l = new T.Mesh(new T.BoxGeometry(.06, .46, .5), mt); l.position.set(px, .23, 0); g.add(l); }); }
function hedge(x, z, w, d) { const m = new T.Mesh(new T.BoxGeometry(w, .9, d, 6, 2, 2), M.toon(0x6a8a55)); const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 3 + p.getZ(i) * 2) * .06); m.geometry.computeVertexNormals(); m.position.set(x, .45, z); m.castShadow = true; world.add(m); obstacles.push({ type: 'obb', cx: x, cz: z, hw: w / 2, hd: d / 2, ang: 0 }); }
for (let i = -3; i <= 3; i++) { palm(i * 11, 30.5); palm(i * 11 + 5.5, -30.5); }
[-36.5, 36.5].forEach(x => { for (let z = -20; z <= 20; z += 10) palm(x, z); });
for (const x of [-22, -8, 8]) { lamp(x, 23.9); lamp(x + 2, -23.9); }
lamp(-33.9, -10); lamp(-33.9, 10); lamp(33.9, 12);
bench(-12, 28.5, Math.PI); bench(6, 28.5, Math.PI); bench(18, 28.5, Math.PI);
hedge(-26, -23.4, 11, 1.1); hedge(-24.5, 23.4, 8, 1.1);
// büfe ve otopark ödeme makinesi
(() => { const k = new T.Group(); k.position.set(30, 0, 28.3); world.add(k); const b = new T.Mesh(new T.BoxGeometry(3.2, 2.4, 2.2), M.toon(0xf0e4cc)); b.position.y = 1.2; b.castShadow = true; k.add(b); const aw = new T.Mesh(new T.BoxGeometry(3.6, .12, 1.2), M.toon(0xd9784f)); aw.position.set(0, 2.3, -1.4); aw.rotation.x = .25; k.add(aw); const sign = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#30403f'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6efe1'; g.font = 'bold 40px Georgia'; g.textAlign = 'center'; g.fillText('BÜFE · ÇAY', w / 2, 46); }); const sg = new T.Mesh(new T.PlaneGeometry(2.6, .65), new T.MeshBasicMaterial({ map: sign })); sg.position.set(0, 2.75, -1.12); k.add(sg); })();
(() => { const m = box(.5, 1.5, .4, M.toon(0x5b7d8f), -1.5, 0, 22.1); const p = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2d5d8f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 100px Georgia'; g.textAlign = 'center'; g.fillText('P', w / 2, 100); }); const pole = new T.Mesh(new T.CylinderGeometry(.05, .05, 3.2), M.toon(0x777)); pole.position.set(-31, 1.6, -24.6); world.add(pole); const ps = new T.Mesh(new T.PlaneGeometry(.9, .9), new T.MeshBasicMaterial({ map: p, side: T.DoubleSide })); ps.position.set(-31, 3.4, -24.6); world.add(ps); })();
// kumsalda şemsiyeler ve sahil korkuluğu
for (let i = -6; i <= 6; i++) { const u = new T.Group(); u.position.set(i * 7 + rnd(-1, 1), 0, 42 + rnd(-2, 3)); world.add(u); const p = new T.Mesh(new T.CylinderGeometry(.04, .04, 2.3), M.toon(0xeae2cf)); p.position.y = 1.15; u.add(p); const c = new T.Mesh(new T.ConeGeometry(1.4, .6, 10, 1, true), new T.MeshToonMaterial({ color: [0xd9784f, 0x5f9fb0, 0xe2c27c][i & 1 ? 1 : (i % 3 ? 0 : 2)], gradientMap: toneMap, side: T.DoubleSide })); c.position.y = 2.3; c.castShadow = true; u.add(c); }
for (let x = -38; x <= 38; x += 2) { const p = new T.Mesh(new T.BoxGeometry(.08, .9, .08), M.toon(0x52605d)); p.position.set(x, .45, 29.1); world.add(p); }
const rail = new T.Mesh(new T.BoxGeometry(77, .07, .07), M.toon(0x52605d)); rail.position.set(0, .9, 29.1); world.add(rail);
obstacles.push({ type: 'obb', cx: 0, cz: 29.1, hw: 39, hd: .1, ang: 0 });
// martılar
const gulls = [];
for (let i = 0; i < 5; i++) { const s = new T.Shape(); s.moveTo(-.6, .15); s.quadraticCurveTo(-.3, -.05, 0, 0); s.quadraticCurveTo(.3, -.05, .6, .15); s.quadraticCurveTo(.3, .02, 0, .06); s.quadraticCurveTo(-.3, .02, -.6, .15); const m = new T.Mesh(new T.ShapeGeometry(s), new T.MeshBasicMaterial({ color: 0x3b4544, side: T.DoubleSide, fog: false })); scene.add(m); gulls.push({ m, r: rnd(25, 60), y: rnd(16, 30), p: rnd(0, 6), s: rnd(.08, .15), cz: rnd(20, 60) }); }

/* ---------------- C32 AMG ---------------- */
const carRig = { car: null, body: null, wheels: [], steering: [], rearZ: 1.3, frontZ: -1.4, len: 4.53, wid: 1.73, cz: 0, minZ: -2.3, maxZ: 2.3 };
function loadCar(onProgress) {
  return new Promise((res, rej) => new GLTFLoader().load(new URL('./c32.glb', import.meta.url).href, gltf => {
    const asset = gltf.scene, car = new T.Group(), body = new T.Group();
    scene.add(car); car.add(body); body.add(asset); asset.updateMatrixWorld(true);
    const wheels = [], steering = [], centers = [];
    for (const name of ['Object_32', 'Object_36', 'Object_40', 'Object_44']) {
      const n = asset.getObjectByName(name); if (!n) continue;
      const assembly = n.parent, center = new T.Box3().setFromObject(assembly).getCenter(new T.Vector3());
      const pivot = new T.Group(), wheel = new T.Group(); car.add(pivot); pivot.position.copy(center); pivot.add(wheel); wheel.attach(assembly); wheels.push(wheel); centers.push(center);
      if (center.z < 0) steering.push(pivot);
    }
    asset.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; if (o.material.name && o.material.name.includes('glass_ex')) { o.material.transparent = true; o.material.opacity = .22; o.material.depthWrite = false; o.material.side = T.DoubleSide; } });
    const bb = new T.Box3().setFromObject(asset);
    Object.assign(carRig, { car, body, wheels, steering, len: bb.max.z - bb.min.z, wid: Math.min(1.85, bb.max.x - bb.min.x), minZ: bb.min.z, maxZ: bb.max.z, cz: (bb.min.z + bb.max.z) / 2 });
    if (centers.length) { const rz = centers.filter(c => c.z > 0), fz = centers.filter(c => c.z < 0); if (rz.length) carRig.rearZ = rz.reduce((a, c) => a + c.z, 0) / rz.length; if (fz.length) carRig.frontZ = fz.reduce((a, c) => a + c.z, 0) / fz.length; }
    res();
  }, x => { if (x.total) onProgress(x.loaded / x.total); }, rej));
}

/* ---------------- durum ---------------- */
const S = { x: 0, z: 0, psi: 0, v: 0, delta: 0, wheel: 0, gear: 'P', gas: 0, brake: 0, touches: 0, touchCd: 0, still: 0, done: false, level: 0, rollT: 0, shake: 0 };
const keys = new Set();
let camMode = 0; const CAMS = ['Takip', 'Kuş bakışı', 'Sürücü'];
let guides = true, sound = true;
const fwd = () => [-Math.sin(S.psi), -Math.cos(S.psi)];
// Araç merkezini arka aks noktasından hesapla (yerel +z geri)
function carCenter() { const [fx, fz] = fwd(); const k = carRig.rearZ - carRig.cz; return [S.x + fx * k, S.z + fz * k]; }
function carOBB() { const [cx, cz] = carCenter(); return { type: 'obb', cx, cz, hw: carRig.wid / 2, hd: carRig.len / 2, ang: S.psi }; }

/* ---------------- çarpışma: ayırıcı eksen teoremi (2B) ---------------- */
function corners(o) { const s = Math.sin(o.ang), c = Math.cos(o.ang); return [[-o.hw, -o.hd], [o.hw, -o.hd], [o.hw, o.hd], [-o.hw, o.hd]].map(([lx, lz]) => [o.cx + lx * c + lz * s, o.cz - lx * s + lz * c]); }
function axes(o) { const s = Math.sin(o.ang), c = Math.cos(o.ang); return [[c, -s], [s, c]]; }
function satOBB(a, b) {
  const ca = corners(a), cb = corners(b); let best = Infinity, bax = null;
  for (const ax of [...axes(a), ...axes(b)]) {
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const p of ca) { const d = p[0] * ax[0] + p[1] * ax[1]; amin = Math.min(amin, d); amax = Math.max(amax, d); }
    for (const p of cb) { const d = p[0] * ax[0] + p[1] * ax[1]; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
    const o = Math.min(amax, bmax) - Math.max(amin, bmin); if (o <= 0) return null;
    if (o < best) { best = o; const dir = (a.cx - b.cx) * ax[0] + (a.cz - b.cz) * ax[1] < 0 ? -1 : 1; bax = [ax[0] * dir, ax[1] * dir]; }
  }
  return { depth: best, n: bax };
}
function satCirc(a, c) {
  const s = Math.sin(a.ang), co = Math.cos(a.ang), dx = c.cx - a.cx, dz = c.cz - a.cz;
  const lx = dx * co - dz * s, lz = dx * s + dz * co;
  const qx = clamp(lx, -a.hw, a.hw), qz = clamp(lz, -a.hd, a.hd), ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
  if (d >= c.r) return null;
  const nlx = d > 1e-6 ? -ex / d : 0, nlz = d > 1e-6 ? -ez / d : 1;
  return { depth: c.r - d, n: [nlx * co + nlz * s, -nlx * s + nlz * co] };
}
function collide() {
  const a = carOBB(); let hit = false;
  for (const o of [...obstacles, ...parkedObs]) {
    if (Math.abs(o.cx - a.cx) > 8 || Math.abs(o.cz - a.cz) > 8) { if (o.type === 'circ' || Math.max(o.hw, o.hd) < 6) continue; }
    const r = o.type === 'obb' ? satOBB(a, o) : satCirc(a, o);
    if (r && r.depth > 0) { S.x += r.n[0] * (r.depth + .002); S.z += r.n[1] * (r.depth + .002); a.cx += r.n[0] * r.depth; a.cz += r.n[1] * r.depth; hit = true; }
  }
  if (hit) {
    const impact = Math.abs(S.v); S.v = -S.v * .1;
    if (S.touchCd <= 0 && impact > .08) { S.touches++; S.touchCd = 1.1; S.shake = Math.min(.25, impact * .12); thud(impact); toast(impact > 1 ? 'Hafif bir temas oldu — sorun değil, biraz geri al.' : 'Dokundun. Yavaşça düzelt.'); }
  }
}

/* ---------------- sensör ışınları ---------------- */
function rayOBB(ox, oz, dx, dz, o, maxD) {
  const s = Math.sin(o.ang), c = Math.cos(o.ang), rx = ox - o.cx, rz = oz - o.cz;
  const lox = rx * c - rz * s, loz = rx * s + rz * c, ldx = dx * c - dz * s, ldz = dx * s + dz * c;
  let t0 = 0, t1 = maxD;
  for (const [p, d, h] of [[lox, ldx, o.hw], [loz, ldz, o.hd]]) {
    if (Math.abs(d) < 1e-9) { if (p < -h || p > h) return Infinity; continue; }
    let ta = (-h - p) / d, tb = (h - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return Infinity;
  }
  return t0;
}
function rayCirc(ox, oz, dx, dz, c, maxD) { const fx = ox - c.cx, fz = oz - c.cz, b = fx * dx + fz * dz, cc = fx * fx + fz * fz - c.r * c.r, disc = b * b - cc; if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t >= 0 && t <= maxD ? t : Infinity; }
const SENS = []; // [lx, lz(rel. center), dirAngle(local), front?]
[-.7, -.25, .25, .7].forEach((x, i) => { const sp = (i - 1.5) * .35; SENS.push({ x, front: true, a: sp }); SENS.push({ x, front: false, a: -sp }); });
function readSensors() {
  const out = { f: [], r: [] }, [cx, cz] = carCenter(), s = Math.sin(S.psi), c = Math.cos(S.psi), list = [...obstacles, ...parkedObs], MAXD = 1.8;
  for (const q of SENS) {
    const lz = (q.front ? -1 : 1) * (carRig.len / 2 - .02);
    const ox = cx + q.x * c + lz * s, oz = cz - q.x * s + lz * c;
    const la = (q.front ? Math.PI : 0) + q.a, ldx = Math.sin(la), ldz = Math.cos(la);
    const dx = ldx * c + ldz * s, dz = -ldx * s + ldz * c;
    let d = Infinity;
    for (const o of list) { if (Math.abs(o.cx - ox) > 9 && Math.abs(o.cz - oz) > 9 && Math.max(o.hw || 0, o.hd || 0) < 6) continue; d = Math.min(d, o.type === 'obb' ? rayOBB(ox, oz, dx, dz, o, MAXD) : rayCirc(ox, oz, dx, dz, o, MAXD)); }
    (q.front ? out.f : out.r).push(d);
  }
  return out;
}

/* ---------------- yol çizgileri (tahmini tekerlek izi) ---------------- */
const guideMat = new T.MeshBasicMaterial({ color: 0xf2c15a, transparent: true, opacity: .8, depthWrite: false });
const guideMesh = new T.Mesh(new T.BufferGeometry(), guideMat); guideMesh.frustumCulled = false; scene.add(guideMesh);
const markMats = [0xd9584f, 0xf2c15a, 0x6fb07a].map(c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: .85, depthWrite: false }));
const marks = markMats.map(m => { const x = new T.Mesh(new T.BufferGeometry(), m); x.frustumCulled = false; scene.add(x); return x; });
function ribbon(pts, w) { const pos = []; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2; pos.push(ax + nx, .03, az + nz, ax - nx, .03, az - nz, bx + nx, .03, bz + nz, bx + nx, .03, bz + nz, ax - nx, .03, az - nz, bx - nx, .03, bz - nz); } return new T.Float32BufferAttribute(pos, 3); }
function updateGuides() {
  const show = guides && (S.gear === 'R' || S.gear === 'D');
  guideMesh.visible = show; marks.forEach(m => m.visible = show);
  if (!show) return;
  const back = S.gear === 'R', dir = back ? -1 : 1, s0 = Math.sin(S.psi), c0 = Math.cos(S.psi);
  // araç kenarlarının izdüşümü: kinematik model ile 4 m ileri/geri entegre
  let x = S.x, z = S.z, psi = S.psi; const L = [], Rr = [], ticks = [[], [], []]; const hw = carRig.wid / 2;
  const endZ = back ? (carRig.maxZ - carRig.rearZ) : (carRig.minZ - carRig.rearZ);
  for (let d = 0; d <= 4.0001; d += .12) {
    const s = Math.sin(psi), c = Math.cos(psi), lz = endZ;
    L.push([x + (-hw) * c + lz * s, z - (-hw) * s + lz * c]); Rr.push([x + hw * c + lz * s, z - hw * s + lz * c]);
    const ds = .12 * dir; psi += ds * Math.tan(S.delta) / WHEELBASE; x += -Math.sin(psi) * ds; z += -Math.cos(psi) * ds;
  }
  const g = new T.BufferGeometry(); const a1 = ribbon(L, .07).array, a2 = ribbon(Rr, .07).array; const all = new Float32Array(a1.length + a2.length); all.set(a1); all.set(a2, a1.length);
  g.setAttribute('position', new T.BufferAttribute(all, 3)); guideMesh.geometry.dispose(); guideMesh.geometry = g;
  [[0.5, 0], [1.0, 1], [2.0, 2]].forEach(([dist, k]) => { const i = Math.min(L.length - 1, Math.round(dist / .12)); const gg = new T.BufferGeometry(); gg.setAttribute('position', ribbon([L[i], Rr[i]], .09)); marks[k].geometry.dispose(); marks[k].geometry = gg; });
}

/* ---------------- hedef park yeri işaretçisi ---------------- */
const targetGroup = new T.Group(); scene.add(targetGroup);
const tMat = new T.MeshBasicMaterial({ color: 0xe8904f, transparent: true, opacity: .85, depthWrite: false });
const tFill = new T.MeshBasicMaterial({ color: 0xe8904f, transparent: true, opacity: .14, depthWrite: false });
let targetFrame = null, chevron = null;
function setTarget(b) {
  while (targetGroup.children.length) targetGroup.remove(targetGroup.children[0]);
  if (!b) return;
  const r = bayRect(b), g = new T.BufferGeometry(), pts = [];
  for (let i = 0; i < 4; i++) { const a = r[i], c = r[(i + 1) % 4]; const seg = ribbon([a, c], .18).array; pts.push(...seg); }
  g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); targetFrame = new T.Mesh(g, tMat); targetGroup.add(targetFrame);
  const f = new T.Mesh(new T.PlaneGeometry(b.w, b.d), tFill); f.rotation.x = -Math.PI / 2; f.rotation.z = b.ang; f.position.set(b.cx, .02, b.cz); targetGroup.add(f);
  const s = new T.Shape(); s.moveTo(-.6, .4); s.lineTo(0, -.3); s.lineTo(.6, .4); s.lineTo(.6, .05); s.lineTo(0, -.65); s.lineTo(-.6, .05); s.closePath();
  chevron = new T.Mesh(new T.ShapeGeometry(s), new T.MeshBasicMaterial({ color: 0xe8904f, side: T.DoubleSide, depthWrite: false })); chevron.position.set(b.cx, 2.6, b.cz); targetGroup.add(chevron);
  if (b.req !== undefined) { const ar = new T.Shape(); ar.moveTo(0, -1); ar.lineTo(.45, -.2); ar.lineTo(.15, -.2); ar.lineTo(.15, .9); ar.lineTo(-.15, .9); ar.lineTo(-.15, -.2); ar.lineTo(-.45, -.2); ar.closePath(); const m = new T.Mesh(new T.ShapeGeometry(ar), new T.MeshBasicMaterial({ color: 0xf6efe1, transparent: true, opacity: .8, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.rotation.z = b.req; m.position.set(b.cx, .025, b.cz); targetGroup.add(m); }
}

/* ---------------- bölümler ---------------- */
const LEVELS = [
  { name: 'İleri düz park', tip: 'Karşıdaki turuncu yere düz gir. Yavaş ol: fren bırakınca araç kendiliğinden sürünür.', bay: () => ROW_N[7], fill: () => { ROW_N.forEach((b, i) => { if (i !== 7 && i % 3 !== 1) placeParked(b); }); } },
  { name: 'Geri park', tip: 'Arkadaki yere geri girerek park et; araç önü dışarı baksın. R vitesinde geri görüş kamerası açılır.', bay: () => Object.assign({}, ROW_S[9], { req: 0 }), fill: () => { ROW_S.forEach((b, i) => { if (i !== 9 && i % 2 === 0) placeParked(b, Math.random() < .5); }); placeParked(ROW_S[8]); placeParked(ROW_S[10], true); } },
  { name: 'Açılı park', tip: 'Doğudaki 45° açılı yerlerden turuncuya ileri gir. Önce biraz geniş açıl.', bay: () => ANG[3], fill: () => { ANG.forEach((b, i) => { if (i !== 3) placeParked(b); }); } },
  { name: 'Paralel park', tip: 'Batı bordürüne, iki aracın arasındaki boşluğa paralel park et (araç güneye baksın). Öndeki aracın yanına gel, direksiyonu kır ve geri gel.', bay: () => Object.assign({}, PAR_GAP, { req: Math.PI }), fill: () => { placeParked({ cx: -31.2, cz: -5.45, ang: Math.PI }, false, 0); placeParked({ cx: -31.2, cz: 6.45, ang: Math.PI }, false, 0); placeParked({ cx: -31.2, cz: -11.2, ang: Math.PI }); placeParked({ cx: -31.2, cz: 12.2, ang: Math.PI }); } },
  { name: 'Dar boşluk', tip: 'Sadece 2,30 m genişlik var. Aynalara (sensör ekranına) bak ve tam ortadan gir.', bay: () => NARROW, fill: () => { placeParked({ cx: 19.6, cz: -20.4, ang: 0 }, false, .25); placeParked({ cx: 24.4, cz: -20.4, ang: 0 }, true, -.25); ROW_N.forEach((b, i) => { if (i % 2) placeParked(b); }); } },
  { name: 'Garaj', tip: 'Güneydoğudaki garaja geri girerek park et; duvarlar yakın, sensörler yardımcı.', bay: () => Object.assign({}, GARAGE, { req: 0 }), fill: () => { ROW_S.forEach((b, i) => { if (i > 9 && i < 14 && i !== 12) placeParked(b, true); }); } },
  { name: 'Serbest sürüş', tip: 'Hedef yok. Otoparkta dilediğin gibi dolaş ve pratik yap.', bay: () => null, fill: () => { ROW_N.forEach((b, i) => { if (Math.random() < .45) placeParked(b); }); ROW_S.forEach((b, i) => { if (Math.random() < .45) placeParked(b, Math.random() < .5); }); ANG.forEach(b => { if (Math.random() < .4) placeParked(b); }); } },
];
const SAVE = 'park-konyaalti-v1';
let progress = {}; try { progress = JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch (e) {}
let curBay = null;
function startLevel(i) {
  S.level = i; const L = LEVELS[i];
  clearParked(); L.fill(); curBay = L.bay(); setTarget(curBay);
  // Her bölüm haritanın ortasından, kuzeye bakarak başlar
  Object.assign(S, { psi: 0, v: 0, delta: 0, wheel: 0, gear: 'P', touches: 0, touchCd: 0, still: 0, done: false });
  S.x = 0; S.z = 1.5 + (carRig.rearZ - carRig.cz);
  $('mTitle').textContent = `${i + 1}. ${L.name}`; $('mText').textContent = L.tip;
  setGear('P'); $('done').classList.remove('on'); $('levels').style.display = 'none';
  toast(i < 6 ? 'Vitesi D ya da R’ye al, frenden ayağını çek.' : 'Serbest sürüş: keyfine bak.');
}
function bayStatus() {
  if (!curBay) return null;
  const cs = corners(carOBB()), b = curBay, s = Math.sin(b.ang), c = Math.cos(b.ang); let inside = true, worst = -1;
  for (const [x, z] of cs) { const dx = x - b.cx, dz = z - b.cz, lx = dx * c - dz * s, lz = dx * s + dz * c; const ox = Math.abs(lx) - b.w / 2, oz = Math.abs(lz) - b.d / 2; worst = Math.max(worst, ox, oz); if (ox > .03 || oz > .03) inside = false; }
  let dA = b.req !== undefined ? Math.abs(wrapPi(S.psi - b.req)) : Math.min(Math.abs(wrapPi(S.psi - b.ang)), Math.abs(wrapPi(S.psi - b.ang - Math.PI)));
  const [cx, cz] = carCenter(), off = Math.abs((cx - b.cx) * c - (cz - b.cz) * s);
  return { inside, angle: dA * 180 / Math.PI, off, worst };
}
function finish(st) {
  S.done = true;
  let stars = 1; if (S.touches === 0 && st.angle < 3 && st.off < .25) stars = 3; else if (S.touches <= 1 && st.angle < 6) stars = 2;
  const prev = progress[S.level] || 0; progress[S.level] = Math.max(prev, stars); try { localStorage.setItem(SAVE, JSON.stringify(progress)); } catch (e) {}
  $('dTitle').textContent = stars === 3 ? 'Kusursuz park!' : stars === 2 ? 'Güzel park!' : 'Park ettin!';
  $('dStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('dText').textContent = `Açı farkı ${st.angle.toFixed(1)}° · merkezden ${(st.off * 100).toFixed(0)} cm · ${S.touches ? S.touches + ' temas' : 'hiç temas yok'}.`;
  $('dNext').textContent = S.level < LEVELS.length - 2 ? 'Sonraki bölüm' : 'Serbest sürüş';
  $('done').classList.add('on'); chime();
}

/* ---------------- girişler ---------------- */
function setGear(g) {
  if (Math.abs(S.v) > .3 && ((g === 'R' && S.v > 0) || (g === 'D' && S.v < 0) || g === 'P')) { toast('Önce dur, sonra vites değiştir.'); return; }
  S.gear = g; document.querySelectorAll('#gears button').forEach(b => b.classList.toggle('on', b.dataset.g === g));
  $('gearTxt').textContent = { P: 'P · el freni çekili', R: 'R · geri', N: 'N · boş', D: 'D · ileri' }[g];
  if (g === 'P') S.v = 0;
}
document.querySelectorAll('#gears button').forEach(b => b.addEventListener('click', () => { initAudio(); setGear(b.dataset.g); }));
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys.add(k);
  if (k === 'r') setGear('R'); if (k === 'e' || (k === 'd' && e.shiftKey)) setGear('D'); if (k === 'p' || k === ' ') setGear('P'); if (k === 'n') setGear('N');
  if (k === 'v') cycleCam(); if (k === 'g') toggleGuide(); if (k === 'c') S.wheel = 0;
  if ((k === 'w' || k === 'arrowup') && S.gear === 'P') setGear('D');
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function pedal(id, prop) {
  const el = $(id); const on = e => { e.preventDefault(); initAudio(); S['touch' + prop] = 1; el.classList.add('down'); if (prop === 'gas' && S.gear === 'P') setGear('D'); }; const off = () => { S['touch' + prop] = 0; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
pedal('gas', 'gas'); pedal('brake', 'brake');
// Dokunmatik direksiyon: parmak açısının birikimli değişimi simidi çevirir
(() => {
  const el = $('wheelBox'); let last = null, id = null;
  const ang = e => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
  el.addEventListener('pointerdown', e => { initAudio(); id = e.pointerId; el.setPointerCapture(id); last = ang(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const a = ang(e); const d = wrapPi(a - last); last = a; S.wheel = clamp(S.wheel + d / (LOCK_TURNS * Math.PI * 2), -1, 1); });
  const up = e => { if (e.pointerId === id) { id = null; } }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('dblclick', () => { S.wheel = 0; });
})();
function cycleCam() { camMode = (camMode + 1) % CAMS.length; $('bCam').textContent = 'Kamera: ' + CAMS[camMode]; }
function toggleGuide() { guides = !guides; $('bGuide').classList.toggle('on', guides); }
$('bCam').onclick = cycleCam; $('bGuide').onclick = toggleGuide;
$('bSound').onclick = () => { sound = !sound; $('bSound').classList.toggle('on', sound); if (master) master.gain.setTargetAtTime(sound ? .5 : 0, AC.currentTime, .2); };
$('bLevels').onclick = () => { buildLevelMenu(); $('levels').style.display = 'flex'; };
$('levels').addEventListener('click', e => { if (e.target.id === 'levels') $('levels').style.display = 'none'; });
$('dRetry').onclick = () => startLevel(S.level);
$('dNext').onclick = () => startLevel(Math.min(LEVELS.length - 1, S.level + 1));
function buildLevelMenu() { $('lvlGrid').innerHTML = LEVELS.map((L, i) => `<button data-i="${i}"><b>${i + 1}. ${L.name}</b><small>${L.tip.split('.')[0]}.</small><em>${i < 6 ? '★'.repeat(progress[i] || 0) + '☆'.repeat(3 - (progress[i] || 0)) : ''}</em></button>`).join(''); $('lvlGrid').querySelectorAll('button').forEach(b => b.onclick = () => startLevel(+b.dataset.i)); }

/* ---------------- ses ---------------- */
let AC = null, master = null, engO = null, engG = null, engF = null, beepNext = 0;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = sound ? .5 : 0; master.connect(AC.destination);
  // dalga sesi: kahverengi gürültü + yavaş genlik dalgalanması
  const n = AC.sampleRate * 4, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.2; }
  const src = AC.createBufferSource(); src.buffer = b; src.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; const wg = AC.createGain(); wg.gain.value = .12;
  const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = .09; lg.gain.value = .07; lfo.connect(lg); lg.connect(wg.gain); lfo.start();
  src.connect(lp); lp.connect(wg); wg.connect(master); src.start();
  // motor: rölanti ~13 Hz ateşleme (V6 kompresörlü, 750 d/d) + harmonikler
  engO = AC.createOscillator(); engO.type = 'sawtooth'; engF = AC.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 260; engG = AC.createGain(); engG.gain.value = .03;
  engO.frequency.value = 38; engO.connect(engF); engF.connect(engG); engG.connect(master); engO.start();
}
function tone(f, dur, vol, type = 'sine', when = 0) { if (!AC || !sound) return; const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05); }
const chime = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 1.2, .08, 'sine', i * .12));
function thud(v) { if (!AC || !sound) return; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + .15); g.gain.setValueAtTime(Math.min(.25, .05 + v * .08), t); g.gain.exponentialRampToValueAtTime(.0001, t + .22); o.connect(g); g.connect(master); o.start(t); o.stop(t + .3); }

/* ---------------- bildirim ---------------- */
let toastT = null;
function toast(m) { const el = $('toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200); }

/* ---------------- adım: girdi → kinematik → çarpışma ---------------- */
function step(dt) {
  const kg = keys.has('w') || keys.has('arrowup'), kb = keys.has('s') || keys.has('arrowdown');
  const kl = keys.has('a') || keys.has('arrowleft'), kr = (keys.has('d') && !keys.has('shift')) || keys.has('arrowright');
  // pedallar yumuşak basılır (ayak hassasiyeti)
  S.gas = lerp(S.gas, (kg || S.touchgas) ? 1 : 0, 1 - Math.exp(-dt * (kg || S.touchgas ? 3 : 10)));
  S.brake = lerp(S.brake, (kb || S.touchbrake) ? 1 : 0, 1 - Math.exp(-dt * 9));
  // direksiyon: tuşla ~1,8 s'de kilitten kilide; bırakınca olduğu yerde kalır
  if (kl) S.wheel = clamp(S.wheel + dt * 1.1, -1, 1); if (kr) S.wheel = clamp(S.wheel - dt * 1.1, -1, 1);
  // tekerlek açısı simide küçük bir gecikmeyle uyar (direksiyon kutusu esnekliği)
  const dTarget = S.wheel * DELTA_MAX;
  S.delta += clamp(dTarget - S.delta, -1.3 * dt, 1.3 * dt);
  // boylamasına dinamik (park hızı): itme, sürünme, fren, yuvarlanma direnci
  const dir = S.gear === 'R' ? -1 : S.gear === 'D' ? 1 : 0;
  let a = 0;
  if (S.gear === 'P') { S.v *= Math.exp(-dt * 12); if (Math.abs(S.v) < .01) S.v = 0; }
  else {
    if (dir !== 0) {
      const vmax = dir > 0 ? V_MAX_D : V_MAX_R, sp = S.v * dir;
      if (S.gas > .02) a += dir * 2.4 * S.gas * clamp(1 - sp / vmax, 0, 1);
      else if (S.brake < .15 && sp < CREEP) a += dir * 0.9 * (1 - sp / CREEP);      // tork konvertörü sürünmesi
    }
    const roll = .18 + .02 * S.v * S.v;
    a -= Math.sign(S.v) * roll;
    if (S.brake > .02) { const dec = 6.5 * S.brake; if (Math.abs(S.v) < dec * dt) { S.v = 0; a = 0; } else a -= Math.sign(S.v) * dec; }
    const vNew = S.v + a * dt;
    S.v = (Math.sign(vNew) !== Math.sign(S.v) && S.v !== 0 && S.gas < .02) ? 0 : vNew;
  }
  // kinematik bisiklet modeli (arka aks): ψ̇ = v·tanδ / L
  const [fx, fz] = fwd();
  S.x += fx * S.v * dt; S.z += fz * S.v * dt;
  S.psi += S.v * Math.tan(S.delta) / WHEELBASE * dt;
  S.touchCd -= dt;
  collide();
}

/* ---------------- kamera ---------------- */
const camPos = new T.Vector3(0, 6, 12), camLook = new T.Vector3();
function updateCamera(dt) {
  const [cx, cz] = carCenter(), [fx, fz] = fwd();
  let p, l;
  if (camMode === 0) { const back = 7.2, h = 3.3; p = new T.Vector3(cx - fx * back, h, cz - fz * back); l = new T.Vector3(cx + fx * 2.2, .6, cz + fz * 2.2); }
  else if (camMode === 1) { p = new T.Vector3(cx - fx * 2.5, 15, cz - fz * 2.5); l = new T.Vector3(cx + fx * .5, 0, cz + fz * .5); }
  else { const s = Math.sin(S.psi), c = Math.cos(S.psi), lx = -.37, lz = carRig.cz + .25 - carRig.cz; const ox = carRig.car ? carRig.car.position.x : cx, oz = carRig.car ? carRig.car.position.z : cz; p = new T.Vector3(ox + lx * c + .1 * s, 1.17, oz - lx * s + .1 * c); l = new T.Vector3(p.x + fx * 10, .9, p.z + fz * 10); }
  const k = camMode === 2 ? 1 : 1 - Math.exp(-dt * 3.2);
  camPos.lerp(p, k); camLook.lerp(l, camMode === 2 ? 1 : 1 - Math.exp(-dt * 5));
  camera.position.copy(camPos); if (S.shake > 0) { camera.position.x += (Math.random() - .5) * S.shake; camera.position.y += (Math.random() - .5) * S.shake; S.shake *= .85; }
  camera.lookAt(camLook);
  // geri görüş kamerası: arka tampon üstü, aşağı bakan geniş açı
  const s = Math.sin(S.psi), c = Math.cos(S.psi), bz = carRig.maxZ - .05;
  const ox = carRig.car ? carRig.car.position.x : 0, oz = carRig.car ? carRig.car.position.z : 0;
  rearCam.position.set(ox + bz * s, 1.0, oz + bz * c); rearCam.lookAt(rearCam.position.x - fx * 3, 0, rearCam.position.z - fz * 3);
}

/* ---------------- sensör paneli ve direksiyon çizimi ---------------- */
const sctx = $('sensor').getContext('2d'), wctx = $('wheel').getContext('2d');
function drawSensor(r) {
  const g = sctx, W = 240, H = 300; g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(246,239,225,.85)'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, W, H, 26) : g.rect(0, 0, W, H); g.fill();
  g.fillStyle = '#30403f'; g.beginPath(); g.roundRect ? g.roundRect(W / 2 - 34, H / 2 - 74, 68, 148, 18) : g.rect(W / 2 - 34, H / 2 - 74, 68, 148); g.fill();
  g.fillStyle = '#6d8f9a'; g.fillRect(W / 2 - 26, H / 2 - 44, 52, 24); g.fillRect(W / 2 - 24, H / 2 + 34, 48, 18);
  const col = d => d < .3 ? '#d9584f' : d < .6 ? '#e8904f' : d < 1.2 ? '#e2c27c' : 'rgba(111,176,122,.55)';
  const draw = (arr, front) => arr.forEach((d, i) => { const n = arr.length, a0 = (front ? -Math.PI : 0) + Math.PI * (.18 + i * .64 / n), a1 = a0 + Math.PI * .64 / n - .05; const cy = front ? H / 2 - 58 : H / 2 + 58; for (let k = 0; k < 3; k++) { const rr = 50 + k * 14; const lvl = d < .3 ? 3 : d < .6 ? 2 : d < 1.2 ? 1 : 0; g.strokeStyle = k < Math.max(1, lvl) || lvl === 0 && k === 0 ? col(d) : 'rgba(60,70,65,.12)'; g.lineWidth = 9; g.beginPath(); g.arc(W / 2, cy, rr, front ? a0 : a0, a1); g.stroke(); } });
  draw(r.f, true); draw(r.r, false);
  const nr = Math.min(...r.r), nf = Math.min(...r.f); g.fillStyle = '#30403f'; g.font = '800 22px Nunito,sans-serif'; g.textAlign = 'center';
  if (isFinite(nf)) g.fillText(`${(nf * 100).toFixed(0)} cm`, W / 2, 26);
  if (isFinite(nr)) g.fillText(`${(nr * 100).toFixed(0)} cm`, W / 2, H - 12);
}
function drawWheel() {
  const g = wctx, R = 128; g.clearRect(0, 0, 256, 256); g.save(); g.translate(R, R); g.rotate(-S.wheel * LOCK_TURNS * Math.PI * 2);
  g.fillStyle = 'rgba(246,239,225,.55)'; g.beginPath(); g.arc(0, 0, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2c3533'; g.lineWidth = 22; g.beginPath(); g.arc(0, 0, 100, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 18; g.beginPath(); g.moveTo(-92, 8); g.lineTo(-30, 16); g.moveTo(92, 8); g.lineTo(30, 16); g.moveTo(0, 30); g.lineTo(0, 94); g.stroke();
  g.fillStyle = '#3a4542'; g.beginPath(); g.arc(0, 10, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d9784f'; g.fillRect(-5, -112, 10, 22);
  g.fillStyle = '#d8d2bf'; g.font = '700 15px Nunito,sans-serif'; g.textAlign = 'center'; g.fillText('AMG', 0, 15);
  g.restore();
}

/* ---------------- döngü ---------------- */
let last = performance.now(), acc = 0, running = false, simT = 0;
const pipEl = $('pip');
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!running) { renderer.render(scene, camera); return; }
  acc += dt; simT += dt;
  while (acc > 1 / 120) { step(1 / 120); acc -= 1 / 120; }
  // araç modelini yerleştir: orijin = arka aks + f·rearZ
  const [fx, fz] = fwd();
  if (carRig.car) {
    carRig.car.position.set(S.x + fx * carRig.rearZ, 0, S.z + fz * carRig.rearZ); carRig.car.rotation.y = S.psi;
    // Ackermann: iç teker daha çok döner
    const R = Math.abs(S.delta) > 1e-4 ? WHEELBASE / Math.tan(Math.abs(S.delta)) : 1e9;
    carRig.steering.forEach(p => { const left = p.position.x < 0, inner = (S.delta > 0) === left; p.rotation.y = Math.sign(S.delta) * Math.atan(WHEELBASE / (R + (inner ? -1 : 1) * TRACK / 2)); });
    carRig.wheels.forEach(w => { w.rotation.x -= S.v * dt / .315; });
    // gövde salınımı: ivmede yunuslama, dönüşte yalpa
    S.rollT = lerp(S.rollT, S.v * S.v * Math.tan(S.delta) / WHEELBASE * .012, 1 - Math.exp(-dt * 4));
    carRig.body.rotation.z = clamp(S.rollT, -.03, .03);
    carRig.body.rotation.x = lerp(carRig.body.rotation.x, clamp((S.brake * Math.sign(S.v) * -.012) + S.gas * .006 * (S.gear === 'R' ? -1 : 1), -.02, .02), 1 - Math.exp(-dt * 6));
  }
  // görev denetimi: tamamen içeride, hizalı, durmuş
  const st = bayStatus();
  if (st && !S.done) {
    const ok = st.inside && st.angle < 8 && Math.abs(S.v) < .05;
    tMat.color.setHex(st.inside ? (st.angle < 8 ? 0x6fb07a : 0xe2c27c) : 0xe8904f);
    S.still = ok ? S.still + dt : 0;
    if (ok && (S.gear === 'P' || S.still > 1.2)) finish(st);
    if (chevron) { chevron.position.y = 2.4 + Math.sin(simT * 2.2) * .25; chevron.rotation.y = simT * 1.2; chevron.material.color.copy(tMat.color); }
    $('mText').textContent = st.inside ? (st.angle < 8 ? 'Tamam! Dur ve P’ye al.' : `İçeridesin; açıyı düzelt (${st.angle.toFixed(0)}°).`) : LEVELS[S.level].tip;
  }
  // sensörler ve bip
  const r = readSensors(); drawSensor(r); drawWheel();
  const near = S.gear === 'R' ? Math.min(...r.r) : S.gear === 'D' ? Math.min(...r.f) : Infinity;
  if (AC && sound && isFinite(near) && near < 1.5 && Math.abs(S.v) >= 0 && S.gear !== 'P') {
    if (near < .3) { if (now > beepNext) { tone(1850, .12, .05); beepNext = now + 110; } }
    else if (now > beepNext) { tone(1850, .07, .05); beepNext = now + 90 + near * 520; }
  }
  if (engO) { const rpm = 750 + Math.abs(S.v) * 380 + S.gas * 900; engO.frequency.setTargetAtTime(rpm / 60 * 3 / 1.0 / 3.5, AC.currentTime, .1); engG.gain.setTargetAtTime(S.gear === 'P' ? .018 : .026 + S.gas * .03, AC.currentTime, .15); engF.frequency.setTargetAtTime(220 + S.gas * 500, AC.currentTime, .1); }
  $('spd').textContent = Math.round(Math.abs(S.v) * 3.6);
  updateGuides(); updateCamera(dt);
  sky.material.uniforms.t.value = simT; sea.material.uniforms.t.value = simT;
  sun.position.set(camPos.x - 40, 70, camPos.z + 30); sun.target.position.set(camPos.x, 0, camPos.z);
  gulls.forEach(gl => { const a = simT * gl.s + gl.p; gl.m.position.set(Math.cos(a) * gl.r, gl.y + Math.sin(simT * .7 + gl.p) * 1.5, gl.cz + Math.sin(a) * gl.r * .4); gl.m.lookAt(camera.position); gl.m.scale.set(1.6, 1.6 + Math.sin(simT * 5 + gl.p) * .6, 1.6); });
  // ana görüntü
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.render(scene, camera);
  // geri vites: resim-içinde-resim geri görüş kamerası
  const pip = S.gear === 'R' && camMode !== 1; pipEl.style.display = pip ? 'block' : 'none';
  if (pip) { const rc = pipEl.getBoundingClientRect(), y = innerHeight - rc.bottom; renderer.setScissorTest(true); renderer.setScissor(rc.left + 3, y + 3, rc.width - 6, rc.height - 6); renderer.setViewport(rc.left + 3, y + 3, rc.width - 6, rc.height - 6); rearCam.aspect = rc.width / rc.height; rearCam.updateProjectionMatrix(); const vis = carRig.car && carRig.car.visible; renderer.render(scene, rearCam); renderer.setScissorTest(false); }
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < innerHeight ? 68 : 55; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
camera.position.set(14, 9, 22); camera.lookAt(0, 0, 0);
requestAnimationFrame(frame);

/* ---------------- açılış ---------------- */
loadCar(p => { $('bar').firstElementChild.style.width = (p * 100).toFixed(0) + '%'; $('pct').textContent = (p * 100).toFixed(0) + '%'; })
  .then(() => {
    $('bar').firstElementChild.style.width = '100%';
    const go = $('go'); go.disabled = false; go.textContent = 'Park etmeye başla';
    startLevel(0); camPos.set(0, 6, 12); running = false;
    go.onclick = () => { initAudio(); $('intro').style.opacity = '0'; setTimeout(() => $('intro').remove(), 900); running = true; last = performance.now(); };
    if (/debug/.test(location.search)) window.__park = { S, startLevel, setGear, carRig, bayStatus, keys, get running() { return running; }, set running(v) { running = v; } };
  })
  .catch(err => { $('go').textContent = 'Araç modeli yüklenemedi — sayfayı yenile'; console.error(err); });
