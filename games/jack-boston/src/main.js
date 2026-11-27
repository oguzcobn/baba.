// Giriş noktası: menü, kayıt, mod seçimi
import { Game } from './game.js';
import { UI } from './ui/ui.js';
import { MissionRunner } from './missions/runner.js';
import { chapter1 } from './missions/chapter1.js';
import { chapter2 } from './missions/chapter2.js';
import { chapter3 } from './missions/chapter3.js';
import { chapter4 } from './missions/chapter4.js';
import { HomeSystem } from './systems/home.js';
import { Jobs } from './systems/jobs.js';
const CHAPTERS = { 1: chapter1, 2: chapter2, 3: chapter3, 4: chapter4 };

const $ = (s) => document.querySelector(s);
const SAVE_KEY = 'jack_boston_save_v1';

const ui = new UI();
let game;
try { game = new Game($('#game'), ui); }
catch (e) { $('#loading').textContent = 'WebGL başlatılamadı: ' + e.message; throw e; }
ui.buildMap(game.world);
window.game = game; // hata ayıklama
game.home = new HomeSystem(game); game.jobs = new Jobs(game); game.home.register(); game.jobs.register();

// kayıt (config/save_schema.json yapısına uygun)
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
game.story = { chapter: 1, choices: { oakridgeNightRace: null, tommyRevenge: null, vinceFate: null }, peaceRep: 50, streetRep: 10 };
game.save = (o) => {
  const data = {
    version: '1.0.0',
    story: { act: o.chapter ?? game.story.chapter, missionIndex: o.mission ?? 0, missionId: CHAPTERS[o.chapter ?? game.story.chapter]?.missions[o.mission ?? 0]?.id, choices: game.story.choices },
    player: { name: 'Jack', age: 16, money: game.money, hp: 100, peaceRep: game.story.peaceRep, streetRep: game.story.streetRep, wantedStars: 0, hasSimenaPhoto: !!game.story.hasSimenaPhoto, simenaPhotoInBox: false, weapons: Object.keys(game.owned), ammo: game.ammo, owned: game.owned }, world: game.worldName, properties: game.home.dump(), memories: game.story.memories || [],
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { }
};

// dokunmatik
if (matchMedia('(pointer: coarse)').matches) {
  document.body.classList.add('touch'); const T = game.input.touch; T.active = true;
  const st = $('#stick'), knob = st.querySelector('i'); let id = null;
  const mv = (e) => { const r = st.getBoundingClientRect(); for (const t of e.changedTouches) if (t.identifier === id) { let dx = (t.clientX - r.left - r.width / 2) / 60, dy = (t.clientY - r.top - r.height / 2) / 60; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; } T.mx = dx; T.mz = dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; } e.preventDefault(); };
  st.addEventListener('touchstart', (e) => { id = e.changedTouches[0].identifier; mv(e); }, { passive: false }); st.addEventListener('touchmove', mv, { passive: false });
  st.addEventListener('touchend', () => { id = null; T.mx = T.mz = 0; knob.style.transform = ''; });
  document.querySelectorAll('.tbtn').forEach(b => { const k = b.dataset.k; b.addEventListener('touchstart', (e) => { T.btn.add(k); T.tapped.add(k); if (k === 'q') game.input.mouse.clicked = true; e.preventDefault(); }, { passive: false }); b.addEventListener('touchend', () => T.btn.delete(k)); });
}

// menü
const menu = $('#menu'); menu.style.backgroundImage = 'url(assets/scenes/ch1_03_lighthouse_sunset.jpg)';
$('#loading').style.display = 'none'; menu.style.display = 'flex';
const save = loadSave(); if (save?.properties) game.home.load(save.properties); if (save?.memories) game.story.memories = save.memories;
if (save?.story && (save.story.act > 1 || save.story.missionIndex > 0)) { const b = $('#btnContinue'); b.style.display = 'block'; b.textContent = CHAPTERS[save.story.act] ? `DEVAM ET — Bölüm ${save.story.act}, Görev ${save.story.missionIndex + 1}` : 'DEVAM ET — Serbest Dolaşım'; }
const bc2 = document.createElement('button'); bc2.className = 'ghost'; bc2.textContent = 'BÖLÜM 2 — SİMENA'; $('#btnStory').after(bc2); bc2.onclick = () => startStory(2, 0);
const bc4 = document.createElement('button'); bc4.className = 'ghost'; bc4.textContent = 'BÖLÜM 4 — AMERİKA TURU';
const bc3 = document.createElement('button'); bc3.className = 'ghost'; bc3.textContent = 'BÖLÜM 3 — BOSTON'; bc2.after(bc3); bc3.onclick = () => { game.money = Math.max(game.money, 400); startStory(3, 0); };
bc3.after(bc4); bc4.onclick = () => { game.money = Math.max(game.money, 1500); game.owned.pistol = true; game.ammo.pistol9mm = Math.max(game.ammo.pistol9mm, 48); game.story.choices.bostonPath ||= 'clean'; startStory(4, 0); };

function begin() { game.audio.init(); menu.style.display = 'none'; game.paused = false; game.clock.getDelta(); }

async function startStory(ch = 1, idx = 0) {
  begin(); const L = game.world.L;
  game.player.x = L.jackHome.x; game.player.z = L.jackHome.z + 1; game.camT.set(game.player.x, 0, game.player.z);
  if (save?.story?.choices) Object.assign(game.story.choices, save.story.choices);
  if (save?.player?.owned && ch >= 3 && save.story.act >= 3) { Object.assign(game.owned, save.player.owned); Object.assign(game.ammo, save.player.ammo || {}); game.money = save.player.money ?? game.money; }
  if (save?.player) { game.story.peaceRep = save.player.peaceRep ?? 50; game.story.streetRep = save.player.streetRep ?? 10; game.story.hasSimenaPhoto = !!save.player.hasSimenaPhoto; }
  await runChapter(ch, idx);
}
async function runChapter(ch, idx = 0) {
  const C = CHAPTERS[ch]; if (!C) { startFreeRoam(); return; }
  game.story.chapter = ch;
  if (ch === 2 && idx > 0) game.story.hasSimenaPhoto = game.story.hasSimenaPhoto || idx > 4;
  if (idx === 0) await ui.chapterCard(ch, C.title, C.sub);
  const R = new MissionRunner(game, C); game.mission = R; R.retry = idx > 0;
  if (idx > 0) await ui.fade(1);
  R.run(idx);
}
game.startChapter = (ch, idx) => runChapter(ch, idx);
function startFreeRoam() { game.mission = null; game.timeScale = 0.02; ui.toast('Serbest dolaşım — Oakridge senin.', 'good'); }
function startFree() {
  begin(); const L = game.world.L;
  game.player.x = L.square.x + 6; game.player.z = L.square.z + 30; game.camT.set(game.player.x, 0, game.player.z);
  for (const w of ['fists', 'bat', 'pistol', 'silenced', 'shotgun']) game.owned[w] = true;
  game.ammo = { pistol9mm: 120, silenced9mm: 60, shotgun: 40 }; game.money = 2500; game.timeScale = 0.03; game.setTime(16.5);
  ui.toast('Serbest Mod: 1-5 silah seç, F ile araca bin, E ile konuş. Polis arabalarına çarptırarak yıldız düşür!', 'good');
  ui.toast('Saat akıyor — gece yağmur için bekle ya da R tuşuna bas.', '');
  addEventListener('keydown', (e) => { if (game.interiorMode) return; if (e.key.toLowerCase() === 'r') { game.setRain(game.rainTarget > 0 ? 0 : 0.8); ui.toast(game.rainTarget ? '🌧 Yağmur başladı' : '☀ Yağmur dindi'); } if (e.key.toLowerCase() === 't') { game.setTime(game.time + 3); } });
}
$('#btnStory').onclick = () => startStory(1, 0);
$('#btnFree').onclick = startFree;
$('#btnContinue').onclick = () => { if (CHAPTERS[save.story.act]) startStory(save.story.act, save.story.missionIndex); else { begin(); game.story.hasSimenaPhoto = !!save.player?.hasSimenaPhoto; game.story.chapter = save.story.act; if (save.world === 'boston' || save.story.act >= 4) { game.loadWorld('boston'); Object.assign(game.owned, save.player?.owned || {}); Object.assign(game.ammo, save.player?.ammo || {}); game.money = save.player?.money ?? game.money; const L = game.world.L; game.player.x = L.dorm.x; game.player.z = L.dorm.z; game.camT.set(L.dorm.x, 0, L.dorm.z); } startFreeRoam(); } };
$('#btnCtl').onclick = () => { game.paused = true; const m = $('#pausebox'); m.classList.add('show'); ui.controls(m); m.querySelector('#back').onclick = () => m.classList.remove('show'); };

// boyahane: serbest dolaşımda aranmayı sıfırla
setInterval(() => {
  if (!game.playerCar || game.paused || !game.world.L.spray) return; const L = game.world.L; const v = game.playerCar;
  if (Math.hypot(v.x - L.spray.x, v.z - L.spray.z) < 7 && v.speed < 3 && (game.police.stars > 0 || v.hp < 100) && !game._spraying) {
    if (game.money < 100) { ui.toast('Boyahane: $100 gerekli'); return; }
    game._spraying = true; game.money -= 100;
    ui.fade(1.4, 'Boyanıyor…').then(() => { const cols = ['#8e2f2f', '#2f5a4a', '#c9a646', '#5b6770', '#3d6a8a', '#27355B']; v.repair(v.isSedan ? '#27355B' : cols[(Math.random() * cols.length) | 0]); game.police.clear('Araç boyandı — aranma sıfırlandı'); game._spraying = false; });
  }
}, 300);
