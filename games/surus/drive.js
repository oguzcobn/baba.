import { route } from './route.js';

const byId = id => document.getElementById(id);
const canvas = byId('preview');
const ctx = canvas.getContext('2d');
const status = byId('status');
const map = byId('map');
const controls = new Map();
const vehicle = byId('vehicle');
const driver = byId('driver');
const cameraButton = byId('camera');
const driverButtons = [byId('beer'), byId('smoke')];
let chase = true;
let coast;
let turn = 0;
vehicle.classList.add('chase');
let actionEnds = 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const [longitude, latitude] = route[0];
const metersEast = 111320 * Math.cos(latitude * Math.PI / 180);
const metersNorth = 111132;
let length = 0;
const points = route.map(([lon, lat], index) => {
  if (index) {
    const [lastLon, lastLat] = route[index - 1];
    length += Math.hypot((lon - lastLon) * metersEast, (lat - lastLat) * metersNorth);
  }
  return { x: (lon - longitude) * metersEast, y: (lat - latitude) * metersNorth, distance: length };
});
const car = { distance: 0, offset: 1.5, speed: 0 };
const maxSpeed = 80 / 3.6;
let viewer;
let tiles;
let elevation;
let lastSample = -Infinity;
let session = 0;
let cesiumLoad;
let mapFailed = false;
let coverageDeadline = 0;
let lastTime = performance.now();

function at(distance) {
  distance = clamp(distance, 0, length);
  const index = points.findIndex(point => point.distance > distance);
  if (index < 0) return points.at(-1);
  const a = points[index - 1], b = points[index];
  const t = (distance - a.distance) / (b.distance - a.distance);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pose(distance, offset = 0) {
  const center = at(distance);
  const a = at(distance - 3), b = at(distance + 10);
  const heading = Math.atan2(b.x - a.x, b.y - a.y);
  return { x: center.x + Math.cos(heading) * offset, y: center.y - Math.sin(heading) * offset, heading };
}

function update(dt) {
  const input = new Set(controls.values());
  const drag = 0.45 + car.speed * car.speed * 0.006;
  const acceleration = (input.has('gas') ? 3.6 : 0) - (input.has('brake') ? 8 : 0) - drag;
  car.speed = clamp(car.speed + acceleration * dt, 0, maxSpeed);
  const steering = Number(input.has('right')) - Number(input.has('left'));
  turn = steering;
  vehicle.style.setProperty('--steering', (steering * 25) + 'deg');
  car.offset = clamp(car.offset + steering * car.speed * dt * 0.26, -2.8, 2.8);
  car.distance = Math.min(length, car.distance + car.speed * dt);
  if (car.distance >= length) car.speed = 0;
  byId('speed').value = Math.round(car.speed * 3.6);
  byId('distance').value = car.distance / length;
}

function drawPreview() {
  const width = canvas.width, height = canvas.height;
  const horizon = height * (chase ? 0.31 : 0.39);
  ctx.fillStyle = '#87bfd1';
  ctx.fillRect(0, 0, width, horizon);
  ctx.fillStyle = '#607263';
  ctx.fillRect(0, horizon, width, height - horizon);
  const camera = pose(car.distance, car.offset);
  if (chase) {
    camera.x -= Math.sin(camera.heading) * 7;
    camera.y -= Math.cos(camera.heading) * 7;
  }
  const heading = camera.heading;
  const sin = Math.sin(heading), cos = Math.cos(heading);
  const focal = width * 0.73;
  function project(distance, side) {
    const p = pose(distance, side);
    const dx = p.x - camera.x, dy = p.y - camera.y;
    const depth = Math.max(0.85, dx * sin + dy * cos);
    return [width / 2 + (dx * cos - dy * sin) * focal / depth, horizon + (chase ? 3.25 : 1.55) * focal / depth];
  }
  function strip(near, far, left, right, color) {
    const polygon = [project(near, left), project(far, left), project(far, right), project(near, right)];
    ctx.fillStyle = color;
    ctx.beginPath();
    polygon.forEach(([x,y], index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
    ctx.fill();
  }
  const first = Math.max(0, car.distance + 1);
  for (let far = Math.min(length, car.distance + 160); far > first; far -= 2) {
    const near = Math.max(first, far - 2);
    strip(near, far, -4.5, 4.5, '#adb2a6');
    strip(near, far, -3.6, 3.6, '#30383d');
    if (Math.floor(near / 4) % 2 === 0) strip(near, far, -0.07, 0.07, '#eadcaf');
  }
}

function reset() {
  car.distance = 0;
  car.offset = 1.5;
  car.speed = 0;
  lastSample = -Infinity;
  elevation = undefined;
  controls.clear();
  cancelAction();
  updateStatus();
}

const bindings = new Map(Object.entries({
  ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
}));
addEventListener('keydown', event => {
  if (!bindings.has(event.code) || event.target instanceof HTMLInputElement) return;
  event.preventDefault();
  controls.set(event.code, bindings.get(event.code));
});
addEventListener('keyup', event => controls.delete(event.code));
addEventListener('blur', () => controls.clear());
for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown', event => {
    button.setPointerCapture(event.pointerId);
    controls.set(event.pointerId, button.dataset.key);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => controls.delete(event.pointerId));
  }
}
function resize() {
  const scale = Math.min(devicePixelRatio, 1.5);
  canvas.width = Math.round(canvas.clientWidth * scale);
  canvas.height = Math.round(canvas.clientHeight * scale);
}
addEventListener('resize', resize);
byId('reset').addEventListener('click', reset);

cameraButton.addEventListener('click', () => {
  chase = !chase;
  vehicle.classList.toggle('chase', chase);
  cameraButton.textContent = chase ? 'Kokpit kamerası' : 'Takip kamerası';
});

function cancelAction() {
  driver.hidden = true;
  actionEnds = 0;
}

function startAction(action) {
  if (car.speed !== 0 || actionEnds) return;
  driver.dataset.action = action;
  driver.hidden = false;
  actionEnds = performance.now() + 2800;
  updateStatus(action === 'beer' ? 'Şoför bira içiyor.' : 'Şoför sigara yakıyor.');
}

driverButtons[0].addEventListener('click', () => startAction('beer'));
driverButtons[1].addEventListener('click', () => startAction('smoke'));

function loadCesium() {
  if (cesiumLoad) return cesiumLoad;
  const base = 'https://cdn.jsdelivr.net/npm/cesium@1.127.0/Build/Cesium/';
  const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: base + 'Widgets/widgets.css' });
  document.head.append(css);
  window.CESIUM_BASE_URL = base;
  cesiumLoad = new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), { src: base + 'Cesium.js' });
    script.onload = () => resolve(window.Cesium);
    script.onerror = () => { script.remove(); css.remove(); cesiumLoad = undefined; reject(new Error('Cesium')); };
    document.head.append(script);
  });
  return cesiumLoad;
}

function updateStatus(message) {
  const mode = viewer ? 'Google 3D' : coast ? 'Konyaaltı 3D' : 'Antrenman görünümü';
  status.textContent = message || (car.distance >= length
    ? 'Rota tamamlandı. Yeniden sürmek için Başa dön.'
    : mode + ' · Gaz ve fren için ↑ / ↓, yön için ← / →.');
}

function closeMap() {
  session++;
  if (viewer) viewer.destroy();
  viewer = tiles = undefined;
  mapFailed = false;
  map.hidden = true;
  syncView();
}

byId('offline').addEventListener('click', () => {
  closeMap();
  updateStatus();
});

byId('google').addEventListener('submit', async event => {
  event.preventDefault();
  const key = byId('key').value.trim();
  if (!key) return;
  byId('key').value = '';
  closeMap();
  const attempt = session;
  updateStatus('Google 3D yükleniyor…');
  let candidate;
  try {
    const C = await loadCesium();
    if (attempt !== session) return;
    map.hidden = false;
    candidate = new C.Viewer(map, {
      baseLayer: false, globe: false, geocoder: false, timeline: false, animation: false,
      sceneModePicker: false, baseLayerPicker: false, homeButton: false, navigationHelpButton: false,
      fullscreenButton: false, selectionIndicator: false, infoBox: false
    });
    candidate.scene.screenSpaceCameraController.enableInputs = false;
    const connection = await C.createGooglePhotorealistic3DTileset(
      { key, usingOnlyWithGoogleGeocoder: true },
      { showCreditsOnScreen: true, maximumScreenSpaceError: 12 }
    );
    if (attempt !== session) {
      connection.destroy();
      return;
    }
    viewer = candidate;
    tiles = viewer.scene.primitives.add(connection);
    tiles.tileFailed.addEventListener(() => { mapFailed = true; });
    viewer.scene.renderError.addEventListener(() => { mapFailed = true; });
    candidate.canvas.addEventListener('webglcontextlost', () => { mapFailed = true; });
    syncView();
    lastSample = -Infinity;
    elevation = undefined;
    coverageDeadline = performance.now() + 25000;
    updateStatus();
  } catch {
    if (attempt !== session) return;
    closeMap();
    updateStatus('Google 3D açılamadı. API anahtarını, faturalandırmayı ve WebGL desteğini kontrol et.');
  } finally {
    if (candidate && candidate !== viewer && !candidate.isDestroyed()) candidate.destroy();
  }
});

function drawMap() {
  const C = window.Cesium;
  const p = pose(car.distance, car.offset);
  const lon = longitude + p.x / metersEast, lat = latitude + p.y / metersNorth;
  if (Math.abs(car.distance - lastSample) >= 2 || elevation === undefined) {
    lastSample = car.distance;
    if (viewer.scene.sampleHeightSupported && tiles.tilesLoaded) {
      const ground = viewer.scene.sampleHeight(C.Cartographic.fromDegrees(lon, lat));
      if (Number.isFinite(ground)) elevation = ground;
    }
  }
  const height = elevation === undefined ? 38 : elevation + 1.65;
  const follow = chase ? 7 : 0;
  viewer.camera.setView({
    destination: C.Cartesian3.fromDegrees(
      lon - Math.sin(p.heading) * follow / metersEast,
      lat - Math.cos(p.heading) * follow / metersNorth,
      height + (chase ? 2.1 : 0)
    ),
    orientation: { heading: p.heading, pitch: elevation === undefined ? -0.30 : chase ? -0.21 : -0.055, roll: 0 }
  });
}

function frame(now) {
  const finished = car.distance >= length;
  update(Math.min((now - lastTime) / 1000, 0.05));
  lastTime = now;
  if (actionEnds && (car.speed > 0 || now >= actionEnds)) {
    cancelAction();
    updateStatus();
  }
  for (const button of driverButtons) button.disabled = car.speed > 0 || Boolean(actionEnds);
  if (!finished && car.distance >= length) updateStatus();
  if (mapFailed || (viewer && elevation === undefined && now > coverageDeadline)) {
    closeMap();
    updateStatus('Google 3D bağlantısı kesildi. Yerel görünümde sürüşe devam edebilirsin.');
  }
  if (viewer) drawMap();
  else if (coast) coast.draw(car,chase,turn);
  else drawPreview();
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);

const coastView = byId('coast');
function syncView() {
  coastView.hidden = Boolean(viewer) || !coast;
  canvas.hidden = Boolean(viewer || coast);
  vehicle.classList.toggle('rendered-car', !viewer && Boolean(coast));
  resize();
}
import('./scene.js?v=2').then(({createCoast}) => {
  coast = createCoast(coastView,pose,length);
  coastView.addEventListener('webglcontextlost', () => {
    coast = undefined;
    syncView();
    updateStatus('WebGL bağlantısı kesildi. 2D antrenman görünümüne geçildi.');
  }, true);
  syncView();
  updateStatus();
}).catch(() => {
  syncView();
  updateStatus('3D başlatılamadı. 2D antrenman görünümünde sürebilirsin.');
});
