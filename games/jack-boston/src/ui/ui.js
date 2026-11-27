// Arayüz: HUD, minimap, konuşma balonları, bildirimler, Ken Burns sinematik diyaloglar, menüler
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const SPEAKER_COLORS = { Jack: '#8fc3ff', Marcus: '#ffcf7a', Jeanine: '#ff9fb4', Tommy: '#ff7a6a', Sam: '#a8e08a', Simena: '#c9a8ff', Anlatıcı: '#e8e0d0', Telefon: '#d0d0d0' };
const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export class UI {
  constructor() {
    this.root = $('#ui'); this.game = null; this.bubbles = new Map(); this.toasts = [];
    this.hud = $('#hud'); this.obj = $('#objective'); this.prompt = $('#prompt'); this.toastBox = $('#toasts');
    this.mini = $('#minimap'); this.mctx = this.mini.getContext('2d'); this.mapImg = null;
    this.v = new THREE.Vector3(); this.day = 5;
    this.cine = $('#cine'); this.sub = $('#subtitle');
  }
  // ---------------------------------------------- harita ön-çizimi
  buildMap(world) {
    const bd = world.bounds, ox = -bd.x0 + 20, oz = -bd.z0 + 20, W = Math.ceil(bd.x1 - bd.x0 + 40), H = Math.ceil(bd.z1 - bd.z0 + 240); const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#6f9a58'; g.fillRect(0, 0, W, H);
    if (world.paintMap) world.paintMap(g, ox, oz, W, H); else { g.fillStyle = '#e2cfa2'; g.fillRect(0, 251 + oz, W, 60); g.fillStyle = '#5aa0b8'; g.fillRect(0, 300 + oz, W, 200); }
    for (const s of world.statics.items) if (s.tag === 'bld') { g.save(); g.translate(s.x + ox, s.z + oz); g.rotate(-s.a); g.fillStyle = '#b9aea0'; g.fillRect(-s.hx, -s.hz, s.hx * 2, s.hz * 2); g.restore(); }
    g.strokeStyle = '#3a3d44'; g.lineWidth = 14; g.lineCap = 'square';
    for (const n of world.nodes) for (const m of n.links) { const b = world.nodes[m]; g.beginPath(); g.moveTo(n.x + ox, n.z + oz); g.lineTo(b.x + ox, b.z + oz); g.stroke(); }
    g.strokeStyle = '#d6b54a'; g.lineWidth = 0.8;
    for (const n of world.nodes) for (const m of n.links) { const b = world.nodes[m]; g.beginPath(); g.moveTo(n.x + ox, n.z + oz); g.lineTo(b.x + ox, b.z + oz); g.stroke(); }
    this.mapImg = c; this.mapO = { ox, oz };
  }
  drawMinimap() {
    const g = this.mctx, G = this.game; if (!this.mapImg) return; const S = this.mini.width, R = S / 2, scale = 0.62;
    const pp = G.playerPos(); g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(R, R, R - 3, 0, 7); g.clip();
    g.fillStyle = '#5aa0b8'; g.fillRect(0, 0, S, S);
    g.translate(R, R); g.scale(scale, scale); g.translate(-(pp.x + this.mapO.ox), -(pp.z + this.mapO.oz)); g.drawImage(this.mapImg, 0, 0); g.restore();
    const blip = (x, z, col, r = 4, shape = 'dot', clampEdge = false) => {
      let dx = (x - pp.x) * scale, dz = (z - pp.z) * scale; const d = Math.hypot(dx, dz);
      if (d > R - 8) { if (!clampEdge) return; dx *= (R - 8) / d; dz *= (R - 8) / d; }
      g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath();
      if (shape === 'sq') g.rect(R + dx - r, R + dz - r, r * 2, r * 2); else g.arc(R + dx, R + dz, r, 0, 7); g.fill(); g.stroke();
    };
    for (const v of G.vehicles) if (v.isPolice && v.ai && G.police.stars) blip(v.x, v.z, Math.floor(performance.now() / 250) % 2 ? '#ff3030' : '#3060ff', 3.5);
    for (const p of G.peds) if (!p.dead && !p.vehicle && (p.role === 'gang' || (p.role === 'police' && G.police.stars))) blip(p.x, p.z, p.role === 'gang' ? '#ff5050' : '#5080ff', 2.5);
    for (const p of G.peds) if (p.blip && !p.dead) blip(p.vehicle ? p.vehicle.x : p.x, p.vehicle ? p.vehicle.z : p.z, p.blip, 4.5, 'dot', true);
    for (const m of G.markers) blip(m.x, m.z, '#' + new THREE.Color(m.color).getHexString(), 6, 'sq', true);
    // oyuncu oku
    const a = G.playerCar ? G.playerCar.a : G.player.a;
    g.save(); g.translate(R, R); g.rotate(-a + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4; g.beginPath(); g.arc(R, R, R - 3, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.fillText('K', R, 15);
  }
  // ---------------------------------------------- HUD
  frame(dt) {
    const G = this.game; if (!G || G.paused && !this.cineActive) { return; }
    const inside = !!G.interiorMode; this.hud.style.display = this.mini.style.display = inside ? 'none' : ''; if (inside) { this.setPrompt(''); return; }
    const p = G.player; const h = G.time; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const stars = G.police.stars; let starHtml = ''; for (let i = 0; i < 5; i++) starHtml += `<span class="star ${i < stars ? 'on' : ''} ${G.police.flash > 0 && i < stars ? 'blink' : ''}">★</span>`;
    const W = G.WEAPONS[p.weapon]; const ammo = W.ammoKey ? G.ammo[W.ammoKey] : '';
    const car = G.playerCar;
    this.hud.innerHTML = `
      <div class="row top"><span class="clock">${DAYS[this.day]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span><span class="money">$${G.money.toLocaleString('tr-TR')}</span></div>
      <div class="row stars">${starHtml}</div>
      <div class="row"><div class="bar hp"><i style="width:${Math.max(0, p.hp)}%"></i></div></div>
      <div class="row weap"><span class="wicon">${W.icon}</span><span>${W.name}</span>${ammo !== '' ? `<b>${ammo}</b>` : ''}</div>
      ${car ? `<div class="row carhp"><span>🚗</span><div class="bar car"><i style="width:${car.hp}%;background:${car.hp > 60 ? '#7bd389' : car.hp > 30 ? '#f0c04a' : '#e2574c'}"></i></div><span class="kmh">${Math.round(Math.abs(car.fwdSpeed) * 3.6)} km/s</span></div>` : ''}`;
    this.drawMinimap(); this.updateBubbles();
    // bildirimler
    for (const t of this.toasts) { t.t -= dt; if (t.t < 0 && !t.gone) { t.gone = true; t.el.classList.add('out'); setTimeout(() => t.el.remove(), 400); } }
    this.toasts = this.toasts.filter(t => t.t > -1);
    if (this.hitT > 0) { this.hitT -= dt; $('#hitmark').style.opacity = this.hitT * 5; }
    const cross = $('#cross'); const aimMode = !G.playerCar && !G.WEAPONS[p.weapon].melee && !G.cutscene;
    cross.style.display = aimMode ? 'block' : 'none';
    if (aimMode) { cross.style.left = G.input.mouse.x + 'px'; cross.style.top = G.input.mouse.y + 'px'; const s = 18 + G.combat.bloom * 160; cross.style.width = cross.style.height = s + 'px'; }
    document.body.style.cursor = aimMode ? 'none' : '';
  }
  setObjective(t) { this.obj.innerHTML = t || ''; this.obj.style.opacity = t ? 1 : 0; }
  setPrompt(t) { if (this._lp !== t) { this._lp = t; this.prompt.textContent = t; this.prompt.style.opacity = t ? 1 : 0; } }
  toast(text, kind = '') { const e = el('div', 'toast ' + kind, text); this.toastBox.appendChild(e); this.toasts.push({ el: e, t: 3.2 }); if (this.toasts.length > 5) { const o = this.toasts.shift(); o.el.remove(); } }
  hitMarker() { this.hitT = 0.2; }
  damageFlash() { const d = $('#dmg'); d.style.opacity = 0.55; clearTimeout(this._dt); this._dt = setTimeout(() => d.style.opacity = 0, 120); }
  banner(text, color = '#e2574c', sub = '') { const b = $('#banner'); b.innerHTML = `<div style="color:${color}">${text}</div>${sub ? `<small>${sub}</small>` : ''}`; b.classList.add('show'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), 2600); }
  fade(sec = 0.8, text = '') { return new Promise(res => { const f = $('#fade'); f.innerHTML = text ? `<div>${text}</div>` : ''; f.style.transition = `opacity ${sec / 2}s`; f.style.opacity = 1; setTimeout(() => { res(); setTimeout(() => f.style.opacity = 0, text ? 1400 : 60); }, sec * 500); }); }
  // ---------------------------------------------- konuşma balonları
  updateBubbles() {
    const G = this.game, cam = G.camera; const seen = new Set();
    for (const p of [...G.peds, G.player]) {
      if (!p.bubble) continue; seen.add(p);
      let b = this.bubbles.get(p); if (!b) { b = el('div', 'bubble'); $('#bubbles').appendChild(b); this.bubbles.set(p, b); }
      if (b._t !== p.bubble) { b._t = p.bubble; b.innerHTML = (p.name ? `<b style="color:${SPEAKER_COLORS[p.name] || '#ffd36a'}">${p.name}</b>` : '') + p.bubble; }
      const x = p.vehicle ? p.vehicle.x : p.x, z = p.vehicle ? p.vehicle.z : p.z;
      this.v.set(x, (p.y || 0) + 2.4, z).project(cam);
      b.style.transform = `translate(${(this.v.x * .5 + .5) * innerWidth}px, ${(-this.v.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`;
      b.style.opacity = Math.min(1, p.bubbleT * 3);
    }
    for (const [p, b] of this.bubbles) if (!seen.has(p)) { b.remove(); this.bubbles.delete(p); }
  }
  // ---------------------------------------------- oyun içi altyazı
  subtitle(who, text, dur) {
    dur = this.skipAll ? 0.2 : (dur || Math.max(2.4, text.length * 0.065));
    return new Promise(res => {
      this.sub.innerHTML = `<b style="color:${SPEAKER_COLORS[who] || '#ffd36a'}">${who}</b> ${text}`; this.sub.style.opacity = 1;
      clearTimeout(this._st); this._st = setTimeout(() => { this.sub.style.opacity = 0; res(); }, dur * 1000);
    });
  }
  async lines(arr) { for (const [w, t, d] of arr) await this.subtitle(w, t, d); }
  // ---------------------------------------------- SİNEMATİK (Ken Burns + parçacık)
  cinematic({ image, title, mood = 'sunset_warm', lines = [], choices = null }) {
    return new Promise(async (resolve) => {
      const G = this.game; this.cineActive = true; if (G) G.cutscene = true;
      const c = this.cine; c.innerHTML = '';
      const img = el('div', 'kb'); img.style.backgroundImage = `url(${image})`;
      const dirs = [['-2%', '-1%', '2%', '1%'], ['2%', '1%', '-2%', '-1%'], ['0%', '2%', '0%', '-2%'], ['-2%', '1%', '1%', '-1%']]; const d = dirs[(Math.random() * 4) | 0];
      img.animate([{ transform: `scale(1.04) translate(${d[0]},${d[1]})` }, { transform: `scale(1.17) translate(${d[2]},${d[3]})` }], { duration: 26000, fill: 'forwards', easing: 'ease-in-out' });
      const pc = el('canvas', 'cine-fx'); const tint = el('div', 'cine-tint ' + mood); const bars = el('div', 'bars');
      const ttl = el('div', 'cine-title', title || ''); const box = el('div', 'cine-box'); const hint = el('div', 'cine-hint', '▶ Devam: Tık / Boşluk');
      c.append(img, tint, pc, bars, ttl, box, hint); c.classList.add('show');
      const stopFx = this.cineParticles(pc, mood);
      if (G) G.audio.setEngine(false, 0, 0);
      const waitAdvance = () => this.skipAll ? Promise.resolve() : new Promise(r => { const f = (e) => { if (e.type === 'keydown' && ![' ', 'enter', 'e'].includes(e.key.toLowerCase())) return; e.preventDefault?.(); removeEventListener('keydown', f); c.removeEventListener('click', f); r(); }; setTimeout(() => { addEventListener('keydown', f); c.addEventListener('click', f); }, 250); });
      await new Promise(r => setTimeout(r, this.skipAll ? 50 : 700));
      for (const ln of lines) {
        const [who, text] = ln; box.innerHTML = `<div class="who" style="color:${SPEAKER_COLORS[who] || '#ffd36a'}">${who}</div><div class="txt"></div>`;
        const t = box.querySelector('.txt'); let i = 0, skip = false; const sk = () => skip = true; c.addEventListener('click', sk, { once: true });
        const kk = (e) => { if ([' ', 'enter', 'e'].includes(e.key.toLowerCase())) skip = true; }; addEventListener('keydown', kk);
        await new Promise(r => { const tick = () => { if (skip || this.skipAll) { t.textContent = text; return r(); } t.textContent = text.slice(0, ++i); if (i >= text.length) return r(); setTimeout(tick, 24); }; tick(); });
        removeEventListener('keydown', kk); c.removeEventListener('click', sk);
        await waitAdvance();
      }
      let choice = -1;
      if (choices) {
        hint.style.display = 'none';
        box.innerHTML = `<div class="who" style="color:#ffd36a">Seçim</div>` + choices.map((ch, i) => `<button class="choice" data-i="${i}">${i + 1}. ${ch}</button>`).join('');
        choice = this.skipAll ? 0 : await new Promise(r => { box.querySelectorAll('.choice').forEach(b => b.onclick = (e) => { e.stopPropagation(); r(+b.dataset.i); }); const kf = (e) => { const n = +e.key; if (n >= 1 && n <= choices.length) { removeEventListener('keydown', kf); r(n - 1); } }; addEventListener('keydown', kf); });
      }
      c.classList.remove('show'); stopFx(); setTimeout(() => { c.innerHTML = ''; }, 600);
      this.cineActive = false; if (G) G.cutscene = false; resolve(choice);
    });
  }
  cineParticles(cv, mood) {
    const g = cv.getContext('2d'); let run = true; const W = cv.width = innerWidth, H = cv.height = innerHeight; const P = [];
    const rain = mood.includes('rain'); const embers = mood.includes('bonfire'); const leaves = mood.includes('autumn');
    const N = rain ? 380 : embers ? 90 : 70;
    for (let i = 0; i < N; i++) P.push({ x: Math.random() * W, y: Math.random() * H, v: rain ? 900 + Math.random() * 500 : 10 + Math.random() * 30, s: Math.random() * 2 + 0.5, ph: Math.random() * 6, leaf: leaves && i < 18 });
    let last = performance.now();
    const draw = (now) => {
      if (!run) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; g.clearRect(0, 0, W, H);
      for (const p of P) {
        if (rain && !p.leaf) { p.y += p.v * dt; p.x -= p.v * 0.12 * dt; if (p.y > H) { p.y = -20; p.x = Math.random() * W * 1.1; } g.strokeStyle = 'rgba(200,215,235,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 3, p.y - 22); g.stroke(); }
        else if (p.leaf) { p.y += 40 * dt; p.x += Math.sin(now / 700 + p.ph) * 40 * dt + 20 * dt; p.ph += dt; if (p.y > H) { p.y = -10; p.x = Math.random() * W; } g.fillStyle = 'rgba(200,110,40,0.8)'; g.save(); g.translate(p.x, p.y); g.rotate(now / 500 + p.ph); g.fillRect(-4, -2, 8, 4); g.restore(); }
        else if (embers) { p.y -= p.v * 2 * dt; p.x += Math.sin(now / 500 + p.ph) * 20 * dt; if (p.y < H * 0.2) { p.y = H; p.x = W * 0.3 + Math.random() * W * 0.4; } const a = 0.5 + Math.sin(now / 200 + p.ph) * 0.4; g.fillStyle = `rgba(255,${150 + p.s * 40 | 0},60,${a})`; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); }
        else { p.y -= p.v * 0.4 * dt; p.x += Math.sin(now / 1500 + p.ph) * 12 * dt; if (p.y < 0) { p.y = H; p.x = Math.random() * W; } const a = 0.25 + Math.sin(now / 600 + p.ph) * 0.2; g.fillStyle = `rgba(255,235,190,${a})`; g.beginPath(); g.arc(p.x, p.y, p.s * 1.2, 0, 7); g.fill(); }
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw); return () => run = false;
  }
  choice(question, options) {
    if (this.skipAll) return Promise.resolve(0);
    return new Promise(res => {
      const G = this.game; G.cutscene = true; const b = $('#choicebox');
      b.innerHTML = `<div class="q">${question}</div>` + options.map((o, i) => `<button class="choice" data-i="${i}">${i + 1}. ${o}</button>`).join('');
      b.classList.add('show');
      const done = (i) => { removeEventListener('keydown', kf); b.classList.remove('show'); G.cutscene = false; res(i); };
      const kf = (e) => { const n = +e.key; if (n >= 1 && n <= options.length) done(n - 1); };
      addEventListener('keydown', kf); b.querySelectorAll('.choice').forEach(x => x.onclick = () => done(+x.dataset.i));
    });
  }
  polaroid(thought) {
    const G = this.game; const box = $('#polaroidbox'); if (box.classList.contains('show')) { box.classList.remove('show'); G.cutscene = false; return; }
    G.cutscene = true;
    box.innerHTML = `<div class="pol"><div class="pimg" style="background-image:url(assets/scenes/ch2_03_beach_polaroid.jpg)"></div><div class="pcap">Simena &amp; Jack — Oakridge, Ağustos</div></div><p class="pthought">“${thought}”</p><small>[P] veya tıkla — kapat</small>`;
    box.classList.add('show');
    const close = () => { box.classList.remove('show'); G.cutscene = false; box.onclick = null; };
    box.onclick = close;
  }
  letter(html) {
    return new Promise(res => { const G = this.game; G.cutscene = true; const b = $('#choicebox'); b.innerHTML = `<div class="letter">${html}</div><button class="choice" style="width:auto;text-align:center">Devam</button>`; b.classList.add('show'); b.querySelector('button').onclick = () => { b.classList.remove('show'); G.cutscene = false; res(); }; if (this.skipAll) b.querySelector('button').click(); });
  }
  shop() {
    const G = this.game; G.cutscene = true; const b = $('#choicebox');
    const items = [['bat', 'Beyzbol Sopası', 50], ['pistol', '9mm Tabanca', 850], ['silenced', 'Susturuculu Tabanca', 1600], ['shotgun', 'Pompalı Tüfek', 2400], ['a:pistol9mm:24', '9mm mermi ×24', 80], ['a:silenced9mm:24', 'Susturuculu mermi ×24', 80], ['a:shotgun:12', 'Pompalı fişek ×12', 80]];
    const draw = () => {
      b.innerHTML = `<h2>Rusty's Pawn &amp; Guns</h2><p style="margin:0 0 10px">Bakiye: <b style="color:#9fe39a">$${G.money.toLocaleString('tr-TR')}</b></p>` + items.map(([k, n, p], i) => { const own = !k.startsWith('a:') && G.owned[k]; return `<button class="choice" data-i="${i}" ${own ? 'disabled style="opacity:.45"' : ''}>${n} — $${p}${own ? ' (sende var)' : ''}</button>`; }).join('') + `<button class="choice" data-i="x" style="text-align:center">Çık</button>`;
      b.querySelectorAll('.choice').forEach(x => x.onclick = () => {
        if (x.dataset.i === 'x') { b.classList.remove('show'); G.cutscene = false; G.onShopClose?.(); return; }
        const [k, n, p] = items[+x.dataset.i]; if (G.money < p) { this.toast('Yeterli paran yok.', 'bad'); return; }
        G.money -= p; G.audio.pickup();
        if (k.startsWith('a:')) { const [, key, q] = k.split(':'); G.ammo[key] = (G.ammo[key] || 0) + +q; } else { G.owned[k] = true; const ak = G.WEAPONS[k].ammoKey; if (ak) G.ammo[ak] = (G.ammo[ak] || 0) + 12; }
        this.toast(n + ' alındı.', 'good'); G.onBuy?.(k); draw();
      });
    };
    draw(); b.classList.add('show');
  }
  meter(v, label) { const m = $('#meter'); if (v === null) { m.style.opacity = 0; return; } m.style.opacity = 1; m.innerHTML = `<span>${label}</span><div><i style="width:${Math.round(v * 100)}%"></i></div>`; }
  // ---------------------------------------------- kartlar & menüler
  chapterCard(num, title, sub) {
    return new Promise(res => { const c = $('#card'); c.innerHTML = `<small>BÖLÜM ${num}</small><h1>${title}</h1><p>${sub || ''}</p>`; c.classList.add('show'); setTimeout(() => { c.classList.remove('show'); setTimeout(res, 800); }, this.skipAll ? 300 : 3600); });
  }
  failScreen(reason) {
    return new Promise(res => { const f = $('#failbox'); f.innerHTML = `<h2>GÖREV BAŞARISIZ</h2><p>${reason}</p><button id="retry">Tekrar Dene</button>`; f.classList.add('show'); this.game.paused = true; $('#retry').onclick = () => { f.classList.remove('show'); this.game.paused = false; res(); }; });
  }
  pause() {
    const G = this.game; if (this.cineActive) return; G.paused = true; const m = $('#pausebox'); m.classList.add('show');
    m.innerHTML = `<h2>DURAKLATILDI</h2><button id="resume">Devam</button><button id="ctrls">Kontroller</button><button id="tomenu">Ana Menü</button>`;
    $('#resume').onclick = () => { m.classList.remove('show'); G.paused = false; G.clock.getDelta(); };
    $('#ctrls').onclick = () => this.controls(m);
    $('#tomenu').onclick = () => location.reload();
  }
  controls(container) {
    container.innerHTML = `<h2>KONTROLLER</h2><div class="ctl">
    <div><b>Yürüyüş</b>WASD / Ok tuşları — Shift koş<br>F araca bin/in (dolu arabayı çal)<br>E konuş / etkileşim<br>Sol tık / Q vur — ateş et<br>Sağ tık nişan al · 1-5 silah · Tab silah değiştir</div>
    <div><b>Araç</b>W gaz · S fren/geri<br>A/D direksiyon · Boşluk el freni (drift)<br>H korna · F in</div>
    <div><b>Genel</b>M radyo aç/kapa · Esc duraklat<br>Polis arabalarını kaza yaptır → yıldız düşer<br>Boyahane (sanayi) → aranma sıfırlanır</div></div>
    <button id="back">Geri</button>`;
    $('#back').onclick = () => { container.classList.remove('show'); this.game.paused = false; this.game.clock.getDelta(); };
  }
}
