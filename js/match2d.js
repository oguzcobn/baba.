/* =====================================================================
   BABA. Draft — 2D maç özeti motoru (FM2006 tarzı, kuşbakışı)
   Sadece önemli pozisyonlar: goller + büyük fırsatlar. Tüm maçı izleme yok.
   Match2D.show(opts, onDone)
     opts: { home:{name,short,c1,c2,kit,logo,style,xi:[{name,pos,r,traits?}], slots:[{x,y}]}, away:{…}, gh, ga,
             ev:[{t:'h'|'a',sc,as,min,how?,style?}], cards:[{t,name,min,red,dogso}], lh, la }
   Motor: bölgesel karar ağacı (getZone/decidePlayerAction), baskı algılama (isUnderPressure),
          top sürme hız cezası, destek koşuları, ip gibi savunma çizgisi + tek kişilik pres ve kademe,
          ver-kaç, ters top, bindirme + cutback/orta, ara pas, pivot istasyonu, içe kat edip plase,
          durum makinesi PLAYING / CORNER / FREEKICK / PENALTY / CARD_SHOWN, kart ve efektler
   ===================================================================== */
const Match2D = (() => {
  'use strict';
  const T = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? en : tr;
  const W = 105, H = 68, GY0 = 30.34, GY1 = 37.66;
  const STAND = 11; // metres of stadium surrounding the pitch
  // IFAB Laws 12–14: a penalty requires contact inside the defending penalty area.
  // Coordinates are normalized to the attacking team's frame; boundary lines count.
  const maxShotDistance = pos => pos === 'ST' || pos === 'BK' ? 18 : pos === 'OS' ? 28 : 29;
  const foulRestart = spot => spot && spot.x >= W - 16.5 && spot.x <= W &&
    spot.y >= (H - 40.32) / 2 && spot.y <= (H + 40.32) / 2 ? 'PENALTY' : 'FREEKICK';
  const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)], lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const poisson = l => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
  const SCW = { FV: 3, KN: 2.2, OS: 1.2, ST: .3, BK: .35, KL: 0 }, ASW = { FV: 1.5, KN: 3.5, OS: 3, ST: .3, BK: 1.4, KL: 0 };
  const wpick = (arr, f) => { const w = arr.map(f), t = w.reduce((a, b) => a + b, 0); let r = Math.random() * t; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[0]; };
  const surname = n => { const p = String(n).split(' '); return p.length > 1 && p[p.length - 1].length > 2 ? p.slice(1).join(' ') : n; };

  // renk çakışmasını önle
  function hex2rgb(h) { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const cdist = (a, b) => { const x = hex2rgb(a), y = hex2rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const lum = c => { const [r, g, b] = hex2rgb(c); return (r * 299 + g * 587 + b * 114) / 1000; };

  /* =====================================================================
     KLİPLER — goller, büyük fırsatlar, kırmızı kartlar
     Her klibin bir "plan"ı vardır: hangi hücum seti (overlap, through, target, cutin, counter,
     corner, fk, pen, red) ile hangi oyuncunun hangi sonuca (goal/save/miss/post/block) ulaşacağı.
     ===================================================================== */
  const HOWSET = { pen: 'pen', fk: 'fk', corner: 'corner', header: 'cross', cross: 'cross', through: 'through', long: 'target', rebound: 'overlap', cutin: 'cutin', target: 'target', counter: 'counter', cutback: 'overlap', one: 'through' };
  function makeClips(o) {
    const clips = o.ev.map(e => ({ side: e.t, min: e.min, sc: e.sc, as: e.as, trail: e.trail, out: 'goal', how: e.how, style: e.style })), ch = [];
    (o.cards || []).filter(c => c.red).forEach(c => clips.push({ side: c.t === 'h' ? 'a' : 'h', min: c.min, kind: 'red', fouler: c.name, dogso: c.dogso !== false, out: pick(['save', 'miss', 'block']) }));
    ['h', 'a'].forEach(side => {
      const team = o[side === 'h' ? 'home' : 'away'], n = Math.min(3, poisson((side === 'h' ? o.lh : o.la) * 1.15 + .35));
      for (let i = 0; i < n; i++) {
        const sc = wpick(team.xi, p => SCW[p.pos] || .2), as = Math.random() < .8 ? wpick(team.xi.filter(p => p !== sc), p => ASW[p.pos] || .2) : null;
        ch.push({ side, min: 2 + rnd(88), sc: sc.name, as: as && as.name, out: pick(['save', 'save', 'miss', 'miss', 'post', 'block', 'offside']) });
      }
    });
    ch.sort(() => Math.random() - .5).slice(0, Math.max(2, 10 - clips.length)).forEach(c => clips.push(c));
    clips.sort((a, b) => a.min - b.min);
    for (let i = 1; i < clips.length; i++) if (clips[i].min <= clips[i - 1].min) clips[i].min = Math.min(90, clips[i - 1].min + 1);
    return clips;
  }
  // Hücum planları (maç içi taktik): kısa pas, kanat ortası, ara pas, uzun top, kontra, dengeli
  const STYLES = () => ({ dengeli: T('Dengeli', 'Balanced'), kisa: T('Kısa pasla çık', 'Play out short'), kanat: T('Kanatlardan orta', 'Cross from wide'), arapas: T('Ara pas & derin koşu', 'Through balls'), uzun: T('Uzun top & pivot', 'Long ball to target'), kontra: T('Kontra atak', 'Counter-attack') });
  const BUILD = { kisa: [4, 6], dengeli: [2, 3], kanat: [2, 3], arapas: [2, 3], uzun: [0, 1], kontra: [0, 1] };

  /* --------- dizilişler --------- */
  // slot (x: 0-100 genişlik, y: 0 hücum – 100 kale) → sağa hücum eden takım için saha koordinatı
  const shape = s => ({ x: 3 + (100 - s.y) / 100 * 52, y: 4 + s.x / 100 * 60 });
  const zoneOf = x => x < 35 ? 1 : x < 70 ? 2 : 3; // getZone(): 1 savunma, 2 orta saha, 3 hücum (hücum yönü sağa)
  const RUN = 8.2, JOG = 6.4, DRIB = .78; // m/s; top sürerken hız %22 düşer (DRIB)
  // Türkçe ek uyumu: Salah'ın, Onuachu'nun, Fabinho'nun, Muçi'de, Şimşir'den
  const trs = (name, k) => { const s = String(name || ''), low = s.toLocaleLowerCase('tr-TR'), yV = /[^aeıioöuü]y$/.test(low), vs = low.match(/[aeıioöuü]/g), v = yV ? 'i' : vs ? vs[vs.length - 1] : 'e', last = low.slice(-1), endV = yV || /[aeıioöuü]/.test(last), hard = /[fstkçşhpćčš]/.test(last);
    const v4 = 'aı'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü', v2 = 'aıou'.includes(v) ? 'a' : 'e';
    return s + '’' + (k === 'gen' ? (endV ? 'n' : '') + v4 + 'n' : (hard ? 't' : 'd') + v2 + (k === 'abl' ? 'n' : '')); };
  const has = (p, t) => p && p.traits && p.traits.includes(t);
  const getAttrs = p => (p && p.attrs) || (typeof Traits !== 'undefined' && Traits.attrs ? Traits.attrs(p && p.name, p && p.pos, p && p.r) : { pace: p && p.r || 70, dribbling: p && p.r || 70, passing: p && p.r || 70, defending: p && p.r || 70 });
  const runSp = p => { const a = getAttrs(p); return RUN * clamp(.84 + (a.pace - 60) * .009, .78, 1.24) * (has(p, 'SPEED_DRIBBLER') ? 1.08 : 1); };
  const dribSp = p => { const a = getAttrs(p); const ret = clamp(.74 + (a.dribbling - 60) * .004, .72, .93); return runSp(p) * ret; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // Top fiziği sabitleri: yerçekimi (m/s²), çim sürtünmesi (1/s), sekme katsayısı
  const GRAV = 9.81, MU = 1.15, REST = .5;
  // Kaleci forması adayları: iki takımın saha oyuncusu renklerinden ve çimden en uzak olan seçilir
  const GK_KITS = ['#f6d32d', '#35d07f', '#ff8a1f', '#e84fb0', '#21c7d9', '#8f5bd6', '#1d1d1d', '#f1f1f1'];
  const NUM_PREF = { KL: [1, 12, 23, 25, 99], BK: [2, 3, 22, 13, 77], ST: [4, 5, 6, 15, 24], OS: [8, 6, 10, 14, 16, 20, 18], KN: [7, 11, 17, 21, 19], FV: [9, 10, 19, 18, 99] };

  function show(o, onDone) {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const LIVE = !!o.live, EMBED = !!o.mount;
    const clips = LIVE ? [] : makeClips(o);
    const matchStats = { h: { shots: 0, on: 0, xg: 0 }, a: { shots: 0, on: 0, xg: 0 } };
    const shotQuality = c => { const base = c.out === 'goal' ? .27 : c.out === 'save' ? .19 : c.out === 'post' ? .13 : c.out === 'block' ? .09 : .07; return Math.min(.65, base + (c.as ? .035 : 0)); };
    clips.forEach(c => { if (c.out === 'offside') return; const st = matchStats[c.side]; st.shots++; if (c.out === 'goal' || c.out === 'save') st.on++; st.xg += shotQuality(c); });
    if (o.physics) { ['h', 'a'].forEach((side, i) => { matchStats[side] = { shots: o.physics.shots[i], on: o.physics.on[i], xg: o.physics.xg[i] }; }); }
    const pct = o.physics ? o.physics.possession[0] : clamp(Math.round(50 + ((o.lh || 1) - (o.la || 1)) * 7), 30, 70);
    let hc = o.home.c1 || '#c00', ac = o.away.c1 || '#036';
    if (cdist(hc, ac) < 120) ac = (o.away.c2 && cdist(hc, o.away.c2) > 120) ? o.away.c2 : (lum(hc) > 140 ? '#1d1d1d' : '#f4f4f4');
    const styleOf = side => (side === 'h' ? o.home.style : o.away.style) || 'dengeli';
    const gkKit = ex => GK_KITS.filter(c => c !== ex).map(c => ({ c, s: Math.min(cdist(c, hc), cdist(c, ac), cdist(c, '#2f8f3a') * 1.25, ...[o.home.c2, o.away.c2].filter(Boolean).map(k => cdist(c, k) * 1.2)) })).sort((a, b) => b.s - a.s)[0].c;
    const gkCol = { h: gkKit(null) }; gkCol.a = gkKit(gkCol.h);
    const colOf = p => p.pos === 'KL' ? gkCol[p.side] : p.side === 'h' ? hc : ac;
    // hava ve ışık: bazı maçlar yağmurlu, bazıları gece maçı (parametre verilmezse rastgele)
    const wet = o.weather ? o.weather === 'rain' : Math.random() < .2;
    const night = o.night != null ? !!o.night : Math.random() < .5;
    const ov = document.createElement('div'); ov.className = 'm2d-ov' + (EMBED ? ' m2d-embed' : '');
    ov.innerHTML = `<div class="m2d" role="dialog" aria-modal="true" aria-label="${T('Maç özeti', 'Match highlights')}">
      <header class="m2d-top"><span class="m2d-tm">${o.home.logo || `<i style="background:${hc}"></i>`}${esc(o.home.short || o.home.name)}</span><b class="m2d-sc">0 – 0</b><span class="m2d-tm r">${esc(o.away.short || o.away.name)}${o.away.logo || `<i style="background:${ac}"></i>`}</span><em class="m2d-min">0'</em></header>
      <div class="m2d-pitch"><canvas width="1050" height="680"></canvas><div class="m2d-flash" hidden></div><span class="m2d-state" hidden></span></div>
      <div class="m2d-analytics" aria-label="${T('Maç istatistikleri', 'Match statistics')}"><div class="m2d-analytics-row"><strong>${pct}%</strong><span>${T('Tahmini topa sahip olma', 'Estimated possession')}</span><strong>${100 - pct}%</strong></div><div class="m2d-possession"><i style="width:${pct}%"></i></div><div class="m2d-analytics-row"><strong>${matchStats.h.shots}</strong><span>${T('Şut', 'Shots')}</span><strong>${matchStats.a.shots}</strong></div><div class="m2d-analytics-row"><strong>${matchStats.h.on}</strong><span>${T('İsabetli şut', 'Shots on target')}</span><strong>${matchStats.a.on}</strong></div><div class="m2d-analytics-row"><strong>${matchStats.h.xg.toFixed(2)}</strong><span>${T('Pozisyon xG (tahmini)', 'Highlight xG (estimate)')}</span><strong>${matchStats.a.xg.toFixed(2)}</strong></div></div>
      <div class="m2d-com" aria-live="polite"><span class="m2d-cm">0'</span><p>${T('Maç başlıyor…', 'Kick-off…')}</p></div>
      <div class="m2d-bar"><span class="m2d-cnt">0/${clips.length}</span><button data-k="spd">⏩ 2x</button><button data-k="next">⏭ ${T('Sonraki pozisyon', 'Next highlight')}</button><button data-k="end" class="pr">${T('Özeti bitir', 'Skip to full time')}</button></div></div>`;
    if (EMBED) o.mount.appendChild(ov); else { (document.fullscreenElement || document.webkitFullscreenElement || document.querySelector('#draft-section.football-fullscreen-fallback, #career-section.football-fullscreen-fallback') || document.body).appendChild(ov); document.body.classList.add('m2d-open'); }
    const cv = ov.querySelector('canvas'), screenCtx = cv.getContext('2d'), q = s => ov.querySelector(s);
    let ctx = screenCtx;
    const vert = EMBED ? o.mount.clientWidth < 520 && o.mount.clientHeight > o.mount.clientWidth * .9 : innerWidth < 640 && innerHeight > innerWidth;
    if (vert) ov.querySelector('.m2d').classList.add('vert');
    const SC = vert ? 9 : 10, proj = (x, y) => vert ? [(H - y + STAND) * SC, (x + STAND) * SC] : [(x + STAND) * SC, (y + STAND) * SC];
    cv.width = (vert ? H : W) * SC + STAND * 2 * SC;
    cv.height = (vert ? W : H) * SC + STAND * 2 * SC;
    // Cache the expensive crowd layer at 10 Hz; ball, pitch and players redraw every display refresh.
    const stadiumBuffer = document.createElement('canvas');
    stadiumBuffer.width=cv.width;stadiumBuffer.height=cv.height;
    const stadiumCtx=stadiumBuffer.getContext('2d');
    let stadiumFrameAt=-Infinity,stadiumPaints=0;
    const targetFPS=60;
    const bigHomeMatch=!!(o.important||o.bigMatch||o.derby);
    const homeName=String(o.home.name||'');
    const chants=/trabzonspor/i.test(homeName)
      ? ['Bu dünyada her şey yalan,','Senin sevgin gerçek olan','Sonsuza dek hep sürecek,','Oğlum da seni sevecek!']
      : [homeName+'!','Haydi '+homeName+'!','Tribünler seninle!'];
    const flareSeats=bigHomeMatch?Array.from({length:13},(_,i)=>({
      x:i%2?9+i*6.4:13+i*6.4,y:i%2?-6.3:H+6.1,phase:i*.81
    })):[];
    let speed = vert && !LIVE ? 1.5 : 1, score = [0, 0], ci = -1, raf = 0, closed = false;
    const com = (min, txt, cls) => { q('.m2d-cm').textContent = min + "'"; const p = q('.m2d-com p'); p.textContent = txt; p.className = cls || ''; };

    /* --------- oyuncu nesneleri (Player) ---------
       { name, pos, num, side, base, x, y, tx, ty, traits:[...], off:false, run:{x,y,sp}|null } */
    // gerçek forma numarası verilmişse o kullanılır; yoksa mevkiye uygun ve takım içinde benzersiz numara atanır
    const usedNums = { h: new Set(), a: new Set() };
    function freeNum(side, pos, want) { const used = usedNums[side]; let n = Number.isInteger(want) && want > 0 && want < 100 && !used.has(want) ? want : (NUM_PREF[pos] || []).find(x => !used.has(x)); if (!n) { n = 26; while (used.has(n)) n++; } used.add(n); return n; }
    const mk = (team, side) => team.xi.map((p, i) => { const s = team.slots[i] || { x: 50, y: 50 }, b = shape(s), traits = p.traits || (typeof Traits !== 'undefined' ? Traits.of(p.name, p.pos, p.r || 75) : []), attrs = p.attrs || (typeof Traits !== 'undefined' && Traits.attrs ? Traits.attrs(p.name, p.pos, p.r || 75) : null); return { name: p.name, pos: p.pos, r: p.r || 75, num: freeNum(side, p.pos, p.num), stam: clamp(p.cond == null ? 100 : p.cond, 15, 100), card: null, side, base: b, x: b.x, y: b.y, tx: b.x, ty: b.y, traits, attrs, stunUntil: 0, off: false, run: null }; });
    const P = { h: mk(o.home, 'h'), a: mk(o.away, 'a') };
    const ball = { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, trail: [] };
    /* --------- bağımsız top fiziği: vx, vy, vz + çim sürtünmesi + sekme ---------
       Her vuruş (pas, orta, şut, taç) topa bir ilk hız verir. Uçuş süresince konum bu ilk hızdan
       analitik olarak hesaplanır (yerden pas sürtünmeyle yavaşlar, havadan top parabol çizer, falsolu
       vuruş sabit yanal ivmeyle kavis alır). Uçuş bitince top serbest fizikle yuvarlanır ve seker. */
    let flight = null;
    const net = { L: null, R: null }, up = vert ? { x: -1, y: 0 } : { x: 0, y: -1 };
    function stopBall() { flight = null; ball.vx = ball.vy = ball.vz = 0; }
    function launch(dest, T, f) {
      f = f || {}; T = Math.max(.12, T);
      const x0 = ball.x, y0 = ball.y, z0 = f.z0 != null ? f.z0 : ball.z, zEnd = f.zEnd || 0, air = !!(f.air || z0 > .05 || zEnd > .05);
      const mu = air || f.ctrl ? 0 : (wet ? .55 : .9), k = mu > 0 ? (1 - Math.exp(-mu * T)) / mu : T;
      let vx = (dest.x - x0) / k, vy = (dest.y - y0) / k, ax = 0, ay = 0;
      if (f.ctrl) { vx = 2 * (f.ctrl.x - x0) / T; vy = 2 * (f.ctrl.y - y0) / T; ax = 2 * (x0 - 2 * f.ctrl.x + dest.x) / (T * T); ay = 2 * (y0 - 2 * f.ctrl.y + dest.y) / (T * T); }
      flight = { x0, y0, z0, t: 0, T, vx, vy, ax, ay, mu, air, vz0: air ? (zEnd - z0 + .5 * GRAV * T * T) / T : 0 };
      ball.vx = vx; ball.vy = vy; ball.vz = flight.vz0;
      if (diagnostics) diagnostics.kicks.push({ vx, vy, vz: flight.vz0, air });
    }
    function netHit(k) { if (!net[k] || performance.now() - net[k].t > 600) net[k] = { y: ball.y, t: performance.now(), v: Math.min(1.6, .5 + Math.hypot(ball.vx, ball.vy) / 22) }; }
    function stepBall(dt) {
      if (ball.trail.length) { ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 34) ball.trail.shift(); if (!flight && Math.hypot(ball.vx, ball.vy) < 5) ball.trail = []; }
      if (flight) {
        const f = flight, t = f.t = Math.min(f.T, f.t + dt);
        if (f.mu > 0) { const e = Math.exp(-f.mu * t), s = (1 - e) / f.mu; ball.x = f.x0 + f.vx * s; ball.y = f.y0 + f.vy * s; ball.vx = f.vx * e; ball.vy = f.vy * e; }
        else { ball.x = f.x0 + f.vx * t + .5 * f.ax * t * t; ball.y = f.y0 + f.vy * t + .5 * f.ay * t * t; ball.vx = f.vx + f.ax * t; ball.vy = f.vy + f.ay * t; }
        if (f.air) { ball.z = Math.max(0, f.z0 + f.vz0 * t - .5 * GRAV * t * t); ball.vz = f.vz0 - GRAV * t; } else { ball.z = 0; ball.vz = 0; }
        if (t >= f.T) flight = null;
        return;
      }
      if (holder && !(beat && beat.k === 'carry')) { // top ayakta: oyuncunun bir adım önünde, yumuşak takip
        const d = dir[holder.side] || 1, k = Math.min(1, dt * 15), hz = beat && beat.overhead ? 1.9 : 0;
        ball.x += (holder.x + (hz ? 0 : d * .9) - ball.x) * k; ball.y += (holder.y - ball.y) * k; ball.z += (hz - ball.z) * Math.min(1, dt * 9); ball.vx = ball.vy = ball.vz = 0;
        return;
      }
      if (ball.z > 0 || ball.vz > 0) { // havada: yerçekimi, yere değince seker
        ball.vz -= GRAV * dt; ball.z += ball.vz * dt;
        if (ball.z <= 0) { ball.z = 0; if (ball.vz < -1.4) { ball.vz = -ball.vz * REST; ball.vx *= .8; ball.vy *= .8; } else ball.vz = 0; }
      } else { // yerde: çim sürtünmesi (top sürerken kısa dokunuşlar daha çabuk durur; ıslak zeminde top kayar)
        const k = Math.exp(-(beat && beat.k === 'carry' ? 2.2 : wet ? MU * .72 : MU) * dt); ball.vx *= k; ball.vy *= k;
        if (Math.hypot(ball.vx, ball.vy) < .2) ball.vx = ball.vy = 0;
      }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      // file: kale ağzından giren top ağa takılır, ağ dalgalanır
      if (ball.y > GY0 - .1 && ball.y < GY1 + .1 && ball.z < 2.6) {
        if (ball.x > W + 1.85) { if (Math.abs(ball.vx) > 1) netHit('R'); ball.x = W + 1.85; ball.vx *= -.06; ball.vy *= .25; }
        if (ball.x < -1.85) { if (Math.abs(ball.vx) > 1) netHit('L'); ball.x = -1.85; ball.vx *= -.06; ball.vy *= .25; }
      }
      // reklam panoları
      if (ball.x < -2.5 || ball.x > W + 2.5) { ball.x = clamp(ball.x, -2.5, W + 2.5); ball.vx *= -.2; ball.vy *= .5; }
      if (ball.y < -2.4 || ball.y > H + 2.4) { ball.y = clamp(ball.y, -2.4, H + 2.4); ball.vy *= -.2; ball.vx *= .5; }
    }
    const pressing = { h: null, a: null }, pressHigh = { h: o.home.press === 'high', a: o.away.press === 'high' };
    let dir = { h: 1, a: -1 }, att = 'h', holder = null, beats = [], beat = null, bt = 0, flash = '', plan = null, seg = 0, state = 'PLAYING', carryDist = 0;
    const fx = { bubbles: [], cards: [], shakeUntil: 0, aim: null, offside: null };
    const flashes = [], smoke = [], grass = [];
    let pendingRestart = null, lastGoalBy = null, halfCut = false, atHalf = false, paused = false, cutIdle = false;
    function photoFlash(k, n) { for (let i = 0; i < n; i++) flashes.push({ x: k === 'R' ? W + 2.9 + Math.random() * 1.3 : -2.9 - Math.random() * 1.3, y: 34 + (Math.random() - .5) * 34, t: performance.now() + Math.random() * 500 }); }
    function grassBurst(at, n) { for (let i = 0; i < (n || 12); i++) grass.push({ x: at.x, y: at.y, vx: (Math.random() - .5) * 7, vy: (Math.random() - .5) * 7, life: .5 + Math.random() * .5 }); }
    // kondisyon: maç dakikası ilerledikçe düşer (kariyer modu gerçek kondisyonu setCond ile gönderir)
    function applyMinute(m) { minuteShow(m); P.h.concat(P.a).forEach(p => { const dm = Math.max(0, m - (p.lastMin == null ? 0 : p.lastMin)); p.lastMin = m; if (p.sync) return; p.stam = clamp(p.stam - dm * (.24 + (p.num % 7) * .012 + ({ KN: .05, BK: .05, OS: .06, FV: .02, KL: -.18 }[p.pos] || 0)), 8, 100); }); }
    // Playwright testleri için isteğe bağlı tanılama (normal oyuncularda kapalı)
    const diagnostics = window.__BABA_MATCH_TEST__ === true ? { frames: [], goals: [], passes: [], shots: [], runs: [], states: [], fouls: [], kicks: [], restarts: [], offsides: [], ballMaxZ: 0, stadium: { margin: STAND, width: cv.width, height: cv.height }, done: false } : null;
    if (diagnostics) { window.__BABA_MATCH_DIAGNOSTICS__=diagnostics;diagnostics.targetFPS=targetFPS;diagnostics.renderFrames=0;diagnostics.stadiumDraws=0;diagnostics.importantHome=bigHomeMatch;diagnostics.chants=bigHomeMatch?chants.slice():[]; }
    let lastSample = 0;

    const toField = (side, pt) => dir[side] > 0 ? { x: pt.x, y: pt.y } : { x: W - pt.x, y: H - pt.y }; // kendi-hücum çerçevesi ↔ saha (kendinin tersi)
    const AF = p => toField(att, p); // saha → hücum çerçevesi (ve tersi)
    const def = () => att === 'h' ? 'a' : 'h';
    const live = side => P[side].filter(p => !p.off && !p.leaving);
    const vis = side => P[side].filter(p => !p.off); // çizim: kenara yürüyen oyuncu da görünür
    // kırmızı kart gören oyuncu en yakın taç çizgisine yavaşça yürür, çizgiyi geçince sahadan silinir
    function startLeaving(p) { if (!p || p.off || p.leaving) return; p.leaving = true; p.run = null; if (holder === p) holder = null; const up = p.y < H / 2; p.exit = { x: clamp(p.x + (W / 2 - p.x) * .25, 6, W - 6), y: up ? -1.4 : H + 1.4 }; }
    function leavingUpdate(dt) { P.h.concat(P.a).forEach(p => { if (!p.leaving || p.off) return; const dx = p.exit.x - p.x, dy = p.exit.y - p.y, d = Math.hypot(dx, dy), m = Math.min(d, 2.3 * dt); if (d > .05) { p.x += dx / d * m; p.y += dy / d * m; p.tx = p.x; p.ty = p.y; } else p.off = true; }); }
    const find = (side, name) => live(side).find(p => p.name === name) || null;
    const nearest = (side, pt, ex) => live(side).filter(p => p.pos !== 'KL' && !(ex || []).includes(p)).sort((a, b) => dist(a, pt) - dist(b, pt));
    const tn = p => surname(p.name);
    const bubble = (txt, at, col) => fx.bubbles.push({ txt, x: at.x, y: at.y, t: performance.now(), col: col || '#111' });
    const shake = ms => { fx.shakeUntil = performance.now() + (ms || 380); };
    const setState = s => { state = s; const el = q('.m2d-state'); el.hidden = s === 'PLAYING'; el.textContent = { CORNER: T('KORNER', 'CORNER'), FREEKICK: T('SERBEST VURUŞ', 'FREE KICK'), PENALTY: T('PENALTI', 'PENALTY'), CARD_SHOWN: T('KART', 'CARD'), KICKOFF: T('SANTRA', 'KICK-OFF'), THROWIN: T('TAÇ', 'THROW-IN'), GOALKICK: T('KALE VURUŞU', 'GOAL KICK'), OFFSIDE: T('OFSAYT', 'OFFSIDE'), HALFTIME: T('DEVRE ARASI', 'HALF-TIME') }[s] || ''; if (diagnostics) diagnostics.states.push(s); };

    /* --------- baskı algılama: önündeki 45° koni içinde 5 m'den yakın rakip ya da 2,5 m içinde herhangi bir rakip --------- */
    function isUnderPressure(p) {
      const a = AF(p);
      return live(def()).some(d => { const b = AF(d), dx = b.x - a.x, dy = Math.abs(b.y - a.y), dd = Math.hypot(dx, dy); return dd < 2.5 || (dx > 0 && dy <= dx && dd < 5); });
    }
    // pas kanalı açık mı? rakip, pas çizgisine 1,6 m'den yakınsa kanal kapalıdır
    function laneOpen(a, b) {
      return !live(def()).some(d => { const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy || 1, t = clamp(((d.x - a.x) * vx + (d.y - a.y) * vy) / L, 0, 1); return Math.hypot(a.x + vx * t - d.x, a.y + vy * t - d.y) < 1.6 && t > .1 && t < .95; });
    }

    /* --------- plan kurulumu --------- */
    function setFor(c, shooter) {
      if (c.kind === 'red') return 'red';
      if (c.kind === 'idle') return 'idle';
      if (c.how && HOWSET[c.how]) return HOWSET[c.how];
      const st = styleOf(c.side), pos = shooter ? shooter.pos : 'FV';
      const W8 = { overlap: 2, through: 2, target: 1.1, cutin: 1, cross: 1, counter: .5, corner: .55, fk: .35, pen: .2 };
      const mul = { kisa: { through: 1.4, overlap: 1.2 }, kanat: { overlap: 2.3, cross: 2.5, cutin: 1.3 }, arapas: { through: 2.6, counter: 1.3 }, uzun: { target: 2.6, cross: 1.6 }, kontra: { counter: 4, through: 1.3 } }[st] || {};
      const ok = { FV: ['through', 'cross', 'overlap', 'counter', 'pen', 'corner'], KN: ['cutin', 'through', 'overlap', 'counter', 'pen'], OS: ['target', 'overlap', 'through', 'fk', 'pen'], ST: ['corner', 'fk'], BK: ['corner', 'overlap', 'fk'], KL: ['pen'] }[pos] || ['through'];
      const list = ok.filter(s => s !== 'fk' || has(shooter, 'FREEKICK_MASTER') || pos === 'OS');
      return wpick(list, s => (W8[s] || .5) * (mul[s] || 1) * (s === 'cross' && has(shooter, 'AERIAL_THREAT') ? 2.4 : 1) * (s === 'cutin' && has(shooter, 'FINESSE_SHOT') ? 3 : 1) * (s === 'through' && has(shooter, 'SPEED_DRIBBLER') ? 1.6 : 1) * (s === 'target' && live(c.side).some(p => p.pos === 'FV' && has(p, 'AERIAL_THREAT')) ? 1.8 : 1));
    }
    let needReset = true;
    function setupClip(c) {
      const second = c.min > 45;
      if (LIVE && !needReset && (dir.h === -1) === second) return continueClip(c);
      const firstHalfSwap = (dir.h === -1) !== second, kicker = lastGoalBy ? (lastGoalBy === 'h' ? 'a' : 'h') : second ? 'a' : 'h', cut = halfCut || (firstHalfSwap && seg > 0);
      needReset = false; pendingRestart = null; lastGoalBy = null; halfCut = false; applyMinute(c.min); fx.offside = null;
      P.h.concat(P.a).forEach(p => { p.wall = false; p.goal = null; p.dive = null; });
      att = c.side; seg++; setState('PLAYING');
      dir = { h: second ? -1 : 1, a: second ? 1 : -1 };
      P.h.concat(P.a).forEach(p => { p.run = null; });
      let shooter = c.sc ? find(att, c.sc) : null;
      if (!shooter) shooter = wpick(live(att).filter(p => p.pos !== 'KL'), p => SCW[p.pos] || .2);
      const assister = c.as ? find(att, c.as) : null;
      plan = { c, set: setFor(c, shooter), shooter, assister, out: c.out, stage: 'build', dec: 0, style: styleOf(att) };
      if (c.kind === 'red') { plan.fouler = find(def(), c.fouler) || nearest(def(), AF({ x: 85, y: 34 }))[0]; plan.shooter = wpick(live(att).filter(p => p.pos === 'FV' || p.pos === 'KN'), p => has(p, 'SPEED_DRIBBLER') ? 3 : 1) || shooter; }
      const br = BUILD[plan.set === 'counter' ? 'kontra' : plan.style] || BUILD.dengeli; plan.maxBuild = br[0] + rnd(br[1] - br[0] + 1);
      if (LIVE) { // canlı maçta her sıfırlama gerçek bir santradır: maç başı, gol sonrası, ikinci yarı
        kickoff(c, kicker, cut); carryDist = 0; beat = null; bt = 0; flash = ''; q('.m2d-flash').hidden = true; q('.m2d-min').textContent = c.min + "'"; return;
      }
      // başlangıç: kısa pasla çıkışta kaleci/stoper, kontra ve kırmızı kart pozisyonunda geriden top kazanımı
      const startPool = plan.set === 'counter' ? live(att).filter(p => p.pos === 'ST' || p.pos === 'OS') : plan.style === 'kisa' ? live(att).filter(p => p.pos === 'KL' || p.pos === 'ST') : live(att).filter(p => p.pos === 'ST' || p.pos === 'BK' || p.pos === 'OS');
      const starter = pick(startPool.length ? startPool : live(att));
      const sa = { x: starter.base.x, y: starter.base.y }; // base zaten takımın kendi hücum çerçevesinde
      const startAt = { x: clamp(starter.pos === 'KL' ? 8 : plan.set === 'counter' ? 26 + rnd(10) : sa.x + 6, 6, 50), y: clamp(sa.y, 8, 60) };
      // herkes formasyonunda, top ilk oyuncuda
      ['h', 'a'].forEach(s => P[s].forEach(p => { if (p.off || p.leaving) return; const f = toField(s, shapeFor(p, s, startAt.x, startAt.y)); p.x = p.tx = f.x; p.y = p.ty = f.y; }));
      const f0 = toField(att, startAt); Object.assign(starter, { x: f0.x, y: f0.y, tx: f0.x, ty: f0.y });
      holder = starter; stopBall(); ball.x = f0.x + dir[att] * .9; ball.y = f0.y; ball.z = 0; ball.trail = []; carryDist = 0;
      beats = [{ k: 'hold', d: .26, txt: c.min + "' " + (plan.set === 'counter' ? T(`${tn(holder)} topu kaptı — kontra atak!`, `${tn(holder)} wins it back — counter-attack!`) : plan.style === 'kisa' ? T(`${tn(holder)} kısa pasla oyunu kuruyor`, `${tn(holder)} plays out from the back`) : T(`${tn(holder)} topla buluştu`, `${tn(holder)} picks up the ball`)) }];
      if (plan.set === 'counter') bubble(T('KONTRA!', 'COUNTER!'), f0, '#ff4d00');
      if (LIVE && c.kickoff) { beats[0].txt = c.min + "' " + T('Santra', 'Kick-off'); }
      beat = null; bt = 0; flash = ''; q('.m2d-flash').hidden = true;
      q('.m2d-min').textContent = c.min + "'"; q('.m2d-cnt').textContent = (ci + 1) + '/' + clips.length;
    }

    // canlı mod: önceki pozisyonun bittiği yerden devam — top kimdeyse ya da en yakındaki oyuncu alır
    function continueClip(c) {
      att = c.side; setState('PLAYING'); ball.trail = [];
      P.h.concat(P.a).forEach(p => { if (!p.leaving) p.run = null; });
      let shooter = c.sc ? find(att, c.sc) : null;
      if (!shooter) shooter = wpick(live(att).filter(p => p.pos !== 'KL'), p => SCW[p.pos] || .2);
      plan = { c, set: setFor(c, shooter), shooter, assister: c.as ? find(att, c.as) : null, out: c.out, stage: 'build', dec: 0, style: styleOf(att) };
      if (c.kind === 'red') { plan.fouler = find(def(), c.fouler) || nearest(def(), ball)[0]; plan.shooter = wpick(live(att).filter(p => p.pos === 'FV' || p.pos === 'KN'), p => has(p, 'SPEED_DRIBBLER') ? 3 : 1) || shooter; }
      const br = BUILD[plan.set === 'counter' ? 'kontra' : plan.style] || BUILD.dengeli; plan.maxBuild = br[0] + rnd(br[1] - br[0] + 1);
      applyMinute(c.min); P.h.concat(P.a).forEach(p => { p.wall = false; p.goal = null; p.dive = null; });
      // top oyun dışındaysa ya da hakem oyunu durdurduysa: taç / kale vuruşu / serbest vuruş sahada kullanılır
      const out = ball.x < 0 || ball.x > W || ball.y < 0 || ball.y > H;
      if (!pendingRestart && out) pendingRestart = (ball.x < 0 || ball.x > W) ? { kind: 'GOALKICK', side: (ball.x < 0) === (dir.h > 0) ? 'h' : 'a' } : { kind: 'THROWIN', side: att, spot: { x: clamp(ball.x, 1, W - 1), y: ball.y < 0 ? 0 : H } };
      if (pendingRestart) { const r = pendingRestart; pendingRestart = null; carryDist = 0; beat = null; bt = 0; flash = ''; q('.m2d-flash').hidden = true; q('.m2d-min').textContent = c.min + "'"; return restart(c, r); }
      if (!(holder && holder.side === att && !holder.leaving)) holder = null;
      beats = [];
      if (!holder) { const nh = live(att).filter(p => p.pos !== 'KL' || dist(p, ball) < 8).sort((a, b) => dist(a, ball) - dist(b, ball))[0]; beats.push(passTo(nh, AF(nh), { txt: c.min + "' " + T(`${tn(nh)} topu kazandı`, `${tn(nh)} wins the ball`) })); }
      else beats.push({ k: 'hold', d: .18, txt: c.min + "' " + T(`${tn(holder)} topla`, `${tn(holder)} on the ball`) });
      if (plan.set === 'counter') bubble(T('KONTRA!', 'COUNTER!'), ball, '#ff4d00');
      carryDist = 0; beat = null; bt = 0; flash = ''; q('.m2d-flash').hidden = true; q('.m2d-min').textContent = c.min + "'";
    }
    /* --------- takım şekilleri: hücumda yayılma, savunmada ip gibi hareket eden çizgi --------- */
    function shapeFor(p, side, bx, by) {
      const s = p.base;
      if (side === att) {
        const st = styleOf(side); let push = clamp((bx - 30) * .6, 0, 34) * (p.pos === 'KL' ? .3 : 1), x = s.x, y = s.y;
        if (st === 'kanat' && p.pos === 'BK') { push += 9; y = s.y < 34 ? Math.min(s.y, 5) : Math.max(s.y, 63); } // bekler çizgiye bindirir (overlap)
        if (st === 'kanat' && p.pos === 'KN') y = s.y < 34 ? Math.min(s.y, 9) : Math.max(s.y, 59);
        if (st === 'uzun' && p.pos === 'KN') push += 5; // kenarlar ikinci topa yakın durur
        x = clamp(x + push, 2, 100);
        if (st === 'kisa' && (p.pos === 'OS' || p.pos === 'KN' || p.pos === 'BK')) { if (Math.abs(by - y) < 30) y += (by - y) * .3; if (Math.abs(bx - x) < 30) x += (bx - x) * .22; } // kısa pas: top çevresinde üçgen kuracak yakın destek
        return { x: clamp(x, 2, 100), y: clamp(y, 3, 65) };
      }
      const own = W - bx, oy = H - by, line = clamp(own - 18, 6, 40); // savunma çizgisi: topun 18 m gerisi
      const off = { KL: 0, ST: 0, BK: 1, OS: p.base.x < 26 ? 9 : 16, KN: 24, FV: 33 }[p.pos] || 14, pull = { ST: .28, BK: .28, OS: .38, KN: .22, FV: .2 }[p.pos] || .25;
      if (p.pos === 'KL') return { x: s.x, y: s.y };
      return { x: clamp(line + off, 4, 70), y: clamp(lerp(lerp(s.y, 34, .25), oy, pull), 3, 65) };
    }
    // Pres ve kademe: yalnızca en yakın 1 savunmacı baskı yapar, ikinci adam kademede durur
    function defenseUpdate() {
      const d = def(), outfield = live(d).filter(p => p.pos !== 'KL'), ord = outfield.slice().sort((a, b) => dist(a, ball) - dist(b, ball));
      const goalSide = dir[att], high = !!pressHigh[d];
      // baskıcı değişimi histerezisli: yeni aday belirgin biçimde yakın değilse mevcut baskıcı devam eder (üşüşme ve titreme olmaz)
      let presser = ord[0]; const cur = pressing[d];
      if (cur && cur !== presser && !cur.off && !cur.leaving && presser && dist(cur, ball) < dist(presser, ball) + 3.5) presser = cur;
      pressing[d] = presser || null;
      const rest = ord.filter(p => p !== presser), cover = rest[0];
      if (state === 'PLAYING') {
        if (presser) { presser.tx = ball.x + goalSide * 2.3; presser.ty = ball.y; presser.sp = 7.4; }
        if (cover) {
          if (high && dist(cover, ball) < 16) { cover.tx = ball.x + goalSide * 3.6; cover.ty = ball.y + (cover.y < ball.y ? -3.8 : 3.8); cover.sp = 7.1; } // yüksek pres: 2. oyuncu destek baskısı yapar
          else { cover.tx = lerp(ball.x + goalSide * 8, cover.tx, .4); cover.ty = lerp(ball.y, 34, .35); cover.sp = 6.8; } // kademe
        }
        // diğerleri topa koşmaz: bölgesini korur, yalnızca en yakın pas kanalına doğru hafifçe kayar
        const targets = live(att).filter(p => p !== holder && p.pos !== 'KL');
        rest.slice(1).forEach(m => { if (m.pos === 'ST') return; const t = targets.slice().sort((a, b) => dist(a, m) - dist(b, m))[0]; if (t && dist(t, m) < 12) { m.tx = lerp(m.tx, lerp(ball.x, t.x, .72), .3); m.ty = lerp(m.ty, lerp(ball.y, t.y, .72), .3); } });
      }
      // bölge 3'te ve orta ihtimalinde stoperler ceza sahasındaki hücumculara yapışır
      const bA = AF(ball);
      if (bA.x > 76 && state === 'PLAYING') {
        const box = live(att).filter(p => { const a = AF(p); return a.x > 86 && a.y > 18 && a.y < 50; });
        live(d).filter(p => p.pos === 'ST' || p.pos === 'BK').forEach(m => { if (m === presser) return; const t = box.sort((a, b) => dist(a, m) - dist(b, m))[0]; if (t && dist(t, m) < 14) { m.tx = t.x + goalSide * 2.2; m.ty = t.y + (m.y < t.y ? -2.2 : 2.2); m.sp = 7.2; } });
      }
      return { presser, cover };
    }
    // destek koşuları: top sahibine en yakın 2 takım arkadaşı boş alana açılır (üçgen)
    function supportRuns(ex) {
      if (!holder) return;
      const h = AF(holder), mates = live(att).filter(p => p !== holder && p.pos !== 'KL' && !(ex || []).includes(p) && !p.run).sort((a, b) => dist(a, holder) - dist(b, holder)).slice(0, 2);
      mates.forEach((m, i) => {
        const side = h.y < 34 ? 1 : -1, cand = [{ x: h.x + 9, y: h.y + side * 10 }, { x: h.x + 4, y: h.y - side * 12 }, { x: h.x - 6, y: h.y + side * 13 }, { x: h.x + 14, y: h.y }];
        const best = cand.map(c => ({ c: { x: clamp(c.x, 4, 100), y: clamp(c.y, 4, 64) } })).map(o => Object.assign(o, { s: Math.min(...live(def()).map(d => dist(AF(d), o.c))) })).sort((a, b) => b.s - a.s)[i] || { c: cand[0] };
        const f = toField(att, best.c); m.run = { x: f.x, y: f.y, sp: JOG + 1 };
      });
      // Hızlı hücumcular (Pace >= 80 veya SPEED_DRIBBLER) savunma arkasına derin koşu atar:
      const lineX = (() => { const ds = live(def()).filter(d => d.pos !== 'KL').map(d => AF(d).x); return ds.length ? Math.max(...ds) : 80; })();
      const sprinter = live(att).filter(p => p !== holder && (p.pos === 'FV' || p.pos === 'KN') && (getAttrs(p).pace >= 80 || has(p, 'SPEED_DRIBBLER'))).sort((a, b) => getAttrs(b).pace - getAttrs(a).pace)[0];
      if (sprinter && h.x > 38 && h.x < 78 && lineX < 92) {
        const runTarget = toField(att, { x: clamp(lineX + 5.5, 58, 96), y: clamp(AF(sprinter).y + (AF(sprinter).y < 34 ? 4 : -4), 8, 60) });
        sprinter.run = { x: runTarget.x, y: runTarget.y, sp: Math.min(10, runSp(sprinter) * 1.05) };
      }
    }

    /* --------- karar mekanizması: decidePlayerAction() --------- */
    /* The engine must assess pass corridors and receiver arrival times together.
       FIFA/FM-inspired principles only — no proprietary engine code or assets. */
    const passQuality = (from, target) => {
      if (!from || !target || target === from || target.off || target.leaving) return -1e6;
      const distance = dist(from, target), forward = (target.x - from.x) * dir[att];
      if (distance < 2 || distance > 50) return -1e5;
      const rivals = live(def());
      const closest = rivals.reduce((v, p) => Math.min(v, dist(p, target)), 99);
      const dx = target.x - from.x, dy = target.y - from.y, d2 = dx * dx + dy * dy || 1;
      const risk = rivals.reduce((risk, p) => {
        const u = clamp(((p.x - from.x) * dx + (p.y - from.y) * dy) / d2, 0, 1);
        const gap = Math.hypot(p.x - (from.x + u * dx), p.y - (from.y + u * dy));
        return risk + (u > .08 && u < .92 && gap < 3 ? (3 - gap) * 4.5 : 0);
      }, 0);
      return Math.min(15, forward) * .22 + Math.min(8, closest) * .5 - distance * .08
        - (distance > 30 ? (distance - 30) * .42 : 0) - risk;
    };
    const choosePass = (from, choices) =>
      choices.filter(p => p && p !== from && !p.off).sort((a, b) => passQuality(from, b) - passQuality(from, a))[0] || null;
    const passTo = (to, at, o2) => Object.assign({ k: 'pass', to, at }, o2 || {});
    const towards = (p, at, m) => { const a = AF(p), dx = at.x - a.x, dy = at.y - a.y, L = Math.hypot(dx, dy) || 1, k = Math.min(1, m / L); return { x: a.x + dx * k, y: a.y + dy * k }; };
    function decidePlayerAction() {
      plan.dec++;
      const a = AF(ball), z = zoneOf(a.x), mates = live(att).filter(p => p !== holder), pressed = isUnderPressure(holder);
      if (plan.stage === 'build' && (plan.dec > plan.maxBuild || z === 3)) plan.stage = 'final';
      if (plan.stage === 'final') return finalPhase();
      // 1. BÖLGE — geriden oyun kurma: topla depar yok, kısa pas / bek / stoper / kaleci
      if (z === 1) {
        const longOk = (plan.style === 'uzun' || has(holder, 'PLAYMAKER')) && !pressed;
        if (longOk) { const tgt = wpick(mates.filter(p => p.pos === 'FV' || p.pos === 'KN'), p => has(p, 'AERIAL_THREAT') ? 3 : 1); if (tgt) return [passTo(tgt, { x: clamp(AF(tgt).x + 6, 55, 84), y: AF(tgt).y }, { lob: true, txt: T(`${tn(holder)} uzun diyagonal topu gönderdi`, `${tn(holder)} sends a long diagonal`) })]; }
        if (pressed) { const back = mates.filter(p => (p.pos === 'KL' || p.pos === 'ST') && laneOpen(holder, p)).sort((x, y) => dist(x, holder) - dist(y, holder))[0]; if (back) return [passTo(back, AF(back), { txt: T(`${tn(holder)} baskı altında, geri döndü`, `${tn(holder)} under pressure, plays it back`) })]; }
        const opts = mates.filter(p => (p.pos === 'OS' || p.pos === 'BK' || p.pos === 'ST') && laneOpen(holder, p) && AF(p).x > a.x - 8);
        const t = choosePass(holder, opts.length ? opts : mates.filter(p => p.pos !== 'KL'));
        return t ? [passTo(t, AF(t), { txt: T(`${tn(holder)} → ${tn(t)}`, `${tn(holder)} finds ${tn(t)}`) })] : [{ k: 'hold', d: .4 }];
      }
      // 2. BÖLGE — oyunun yönünü değiştirme, ver-kaç, ters top, çalım ve derin ara pas
      const hAttr = getAttrs(holder), nearestDef = nearest(def(), holder)[0], defDist = nearestDef ? dist(nearestDef, holder) : 99;
      if (nearestDef && defDist < 5.5 && (has(holder, 'SPEED_DRIBBLER') || hAttr.dribbling >= 78) && Math.random() < 0.55) {
        const dAttr = getAttrs(nearestDef);
        const atkRoll = hAttr.dribbling * 0.65 + hAttr.pace * 0.35 + (Math.random() * 14 - 7);
        const defRoll = dAttr.defending * 0.65 + dAttr.pace * 0.35 + (Math.random() * 14 - 7);
        if (atkRoll >= defRoll - 4) {
          nearestDef.stunUntil = performance.now() + 950; nearestDef.run = null;
          const burstAt = { x: clamp(a.x + 10, 35, 90), y: clamp(a.y + (AF(nearestDef).y >= a.y ? -5 : 5), 6, 62) };
          bubble(T('ÇALIM!', 'SKILL!'), holder, '#ff4d00');
          return [{ k: 'carry', to: holder, at: burstAt, txt: T(`⚡ ${tn(holder)} şık bir çalımla ${tn(nearestDef)}'i geçti!`, `⚡ ${tn(holder)} beats ${tn(nearestDef)} with a quick dribble!`) }];
        }
      }
      const deepRunner = mates.find(p => (p.pos === 'FV' || p.pos === 'KN') && (getAttrs(p).pace >= 80 || has(p, 'SPEED_DRIBBLER')) && AF(p).x > a.x + 8 && AF(p).x < 90 && laneOpen(holder, p));
      if (deepRunner && (hAttr.passing >= 76 || has(holder, 'PLAYMAKER') || plan.style === 'arapas') && Math.random() < 0.45) {
        const leadSpot = { x: clamp(AF(deepRunner).x + 9, 55, 92), y: clamp(AF(deepRunner).y, 10, 58) };
        return [passTo(deepRunner, leadSpot, { through: true, txt: T(`🧠 ${tn(holder)} savunma arkasına koşan ${tn(deepRunner)}'in önüne bıraktı!`, `🧠 ${tn(holder)} threads a through ball for ${tn(deepRunner)}!`) })];
      }
      const crowd = live(def()).filter(d => dist(d, holder) < 9).length;
      const near = mates.filter(p => p.pos !== 'KL' && dist(p, holder) < 16 && laneOpen(holder, p)).sort((x, y) => dist(x, holder) - dist(y, holder))[0];
      // hücum planı: kanatlardan orta → oyunu çizgiye aç; uzun top → pivota şişir, kenarlar ikinci topa koşsun
      if (plan.style === 'kanat' && Math.random() < .6) {
        const wide = mates.filter(p => (p.pos === 'KN' || p.pos === 'BK') && AF(p).x > a.x - 4 && laneOpen(holder, p)).sort((x, y) => AF(y).x - AF(x).x)[0];
        if (wide) return [passTo(wide, { x: clamp(AF(wide).x + 4, 30, 92), y: AF(wide).y }, { txt: T(`${tn(holder)} oyunu kanada açtı: ${tn(wide)}`, `${tn(holder)} spreads it wide to ${tn(wide)}`) })];
      }
      if (plan.style === 'uzun' && !pressed && a.x < 60 && Math.random() < .55) {
        const tg = mates.filter(p => p.pos === 'FV').sort((x, y) => has(y, 'AERIAL_THREAT') - has(x, 'AERIAL_THREAT'))[0];
        if (tg) { const at = { x: clamp(AF(tg).x + 4, 62, 86), y: clamp(AF(tg).y, 22, 46) }, wings = mates.filter(p => p.pos === 'KN' || p.pos === 'OS').sort((x, y) => dist(x, tg) - dist(y, tg)).slice(0, 2);
          return [passTo(tg, at, { lob: true, txt: T(`${tn(holder)} uzun topu pivot ${tn(tg)}'e şişirdi`, `${tn(holder)} goes long to target man ${tn(tg)}`) }),
            { k: 'hold', d: .65, hold: true, runs: wings.map((w, i) => ({ p: w, at: { x: at.x - 7, y: clamp(at.y + (i ? 9 : -9), 6, 62) }, sp: runSp(w) })), txt: T(`${tn(tg)} stoperle mücadele ediyor, kenarlar ikinci topa koşuyor`, `${tn(tg)} battles the centre-back; runners chase the second ball`) }];
        }
      }
      if ((crowd >= 2 || (plan.style === 'kisa' && Math.random() < .5)) && near && plan.dec < plan.maxBuild + 2) {
        // Ver-kaç (one-two): pas ver, hemen ileri koş, top boşlukta seni bulsun
        const runTo = { x: clamp(a.x + 13, 40, 88), y: clamp(a.y + (a.y < 34 ? 3 : -3), 6, 62) }, me = holder;
        return [passTo(near, AF(near), { txt: T(`${tn(holder)} ile ${tn(near)} arasında duvar pas…`, `${tn(holder)} plays a one-two with ${tn(near)}…`), runs: [{ p: me, at: runTo, sp: runSp(me) }] }), { k: 'call', fn: () => [passTo(me, runTo, { through: true, txt: T(`…ve top geri ${trs(tn(me), 'loc')}!`, `…and it comes back to ${tn(me)}!`) })] }];
      }
      const central = a.y > 22 && a.y < 46, centerClosed = live(def()).filter(d => { const b = AF(d); return b.x > a.x && b.x < a.x + 18 && b.y > 22 && b.y < 46; }).length >= 3;
      if (central && centerClosed) {
        const far = mates.filter(p => (p.pos === 'BK' || p.pos === 'KN') && Math.abs(AF(p).y - a.y) > 18).sort((x, y) => AF(y).x - AF(x).x)[0];
        if (far) return [passTo(far, { x: clamp(AF(far).x + 5, 45, 80), y: AF(far).y < 34 ? 7 : 61 }, { lob: true, txt: T(`Merkez kapalı: ${tn(holder)} oyunu ${tn(far)}'a çevirdi`, `Centre blocked: ${tn(holder)} switches play to ${tn(far)}`) })];
      }
      if (!pressed && carryDist < 8 && Math.random() < .35) return [{ k: 'carry', to: holder, at: towards(holder, { x: a.x + 8, y: a.y }, 7), txt: T(`${tn(holder)} topu taşıyor`, `${tn(holder)} drives forward`) }];
      const fwd = mates.filter(p => p.pos !== 'KL' && AF(p).x > a.x - 2 && laneOpen(holder, p));
      const t = choosePass(holder, fwd.length ? fwd : mates.filter(p => p.pos !== 'KL'));
      return t ? [passTo(t, AF(t), { txt: T(`${tn(holder)} → ${tn(t)}`, `${tn(holder)} finds ${tn(t)}`) })] : [{ k: 'hold', d: .4 }];
    }

    /* --------- 3. BÖLGE — hücum setleri (evaluateAttackOptions) --------- */
    function wideMan() { const pref = plan.assister && (plan.assister.pos === 'KN' || plan.assister.pos === 'BK') ? plan.assister : null; return pref || wpick(live(att).filter(p => p.pos === 'KN' && p !== plan.shooter), p => has(p, 'SPEED_DRIBBLER') ? 2 : 1) || live(att).find(p => p.pos === 'BK'); }
    function moveIntoPosition(p, target, text) {
      // Every scripted advance must be visible in successive <=11m movements.
      // The player may run into space, but never appear inside the box instantaneously.
      const origin = AF(p), dx = target.x - origin.x, dy = target.y - origin.y;
      const length = Math.hypot(dx, dy);
      if (length < 2.5) return [];
      const n = Math.ceil(length / 10.5), steps = [];
      for (let i = 1; i <= n; i++) {
        steps.push({ k: 'carry', to: p, at: {
          x: clamp(origin.x + dx * i / n, 3, 102),
          y: clamp(origin.y + dy * i / n, 3, 65)
        }, txt: i === 1 ? text : '' });
      }
      return steps;
    }
    function getTo(p, at, txt) {
      if (!p || p.off || p.leaving) return [];
      const first = p !== holder ? [passTo(p, AF(p), { txt })] : [];
      return first.concat(moveIntoPosition(p, at, p === holder ? txt : ''));
    }
    function finalPhase() {
      const S = plan.shooter, set = plan.set; let out = plan.out; plan.stage = 'done';
      if (set === 'idle') { // atak söner: en yakın savunmacı topu kapar (canlı modda top kaybı)
        if (LIVE && holder) { // top kaybı her zaman aynı olmaz: taç, aut, ofsayt, faul, kesilen orta
          const bA = AF(ball), r = Math.random(); let alt = null;
          if (plan.style === 'kanat' && bA.x > 50 && r < .34) alt = idleCross();
          else if (r < .2) alt = strayOut('THROWIN');
          else if (r < .31 && bA.x > 48) alt = strayOut('GOALKICK');
          else if (r < .41 && bA.x > 42) alt = offsideMove();
          else if (r < .5 && bA.x > 28 && bA.x < 82) alt = idleFoul();
          if (alt) return alt;
        }
        const d = nearest(def(), ball)[0];
        return [{ k: 'lose', d: .8, by: d, txt: d ? T(`${tn(d)} araya girdi, top el değiştirdi`, `${tn(d)} steps in and wins it`) : '' }];
      }
      const gy = out === 'miss' ? (Math.random() < .5 ? GY0 - 1.5 - Math.random() * 3 : GY1 + 1.5 + Math.random() * 3) : out === 'post' ? (Math.random() < .5 ? GY0 : GY1) : GY0 + .8 + Math.random() * 5.7;
      const shot = (o2) => Object.assign({ k: 'shot', out, gy, txt: T(`${tn(S)} vuruyor…`, `${tn(S)} shoots…`) }, o2 || {});
      const L = [];
      if (out === 'offside') { const off = offsideMove(); if (off) return off; out = plan.out = 'block'; if (plan.c) plan.c.actualOut = 'block'; } // ofsayt kurulamadıysa metin de 'blok' yazar
      if (set === 'overlap' || set === 'cross') {
        const Wm = wideMan() || plan.assister || S, flank = AF(Wm).y < 34 ? 6 : 62, fb = live(att).find(p => p.pos === 'BK' && Math.abs(AF(p).y - flank) < 26 && p !== Wm);
        L.push(...getTo(Wm, { x: 76 + rnd(6), y: flank }, T(`Top kanatta ${trs(tn(Wm), 'loc')}`, `It's out wide to ${tn(Wm)}`)));
        const runs = [{ p: S, at: { x: 92 + rnd(3), y: set === 'cross' ? (flank < 34 ? 40 : 28) : 34 + (Math.random() - .5) * 6 }, sp: runSp(S) }];
        if (fb) runs.push({ p: fb, at: { x: 95, y: flank < 34 ? 3 : 65 }, sp: runSp(fb) });
        const farW = live(att).find(p => p.pos === 'KN' && p !== Wm && p !== S); // ters kanat arka direğe koşar
        if (farW) runs.push({ p: farW, at: { x: 94, y: flank < 34 ? 45 : 23 }, sp: runSp(farW) });
        L.push({ k: 'hold', d: 3.4, runs, txt: fb ? T(`${tn(fb)} bindirmeye çıkıyor!`, `${tn(fb)} overlaps!`) : '' });
        let crosser = Wm;
        if (fb && !has(Wm, 'SPEED_DRIBBLER') && Math.random() < .6) { L.push(passTo(fb, { x: 95, y: flank < 34 ? 3 : 65 }, { through: true, txt: T(`${tn(Wm)} bindiren ${tn(fb)}'i gördü`, `${tn(Wm)} releases the overlapping ${tn(fb)}`) })); crosser = fb; }
        else L.push({ k: 'carry', to: Wm, at: { x: 96, y: flank < 34 ? 4 : 64 }, txt: T(`${tn(Wm)} çizgiye iniyor`, `${tn(Wm)} gets to the byline`) });
        if (set === 'cross' || has(S, 'AERIAL_THREAT')) { L.push({ k: 'call', fn: () => [passTo(S, null, { lob: true, cross: true, follow: true, txt: T(`${tn(crosser)} arka direğe ortaladı…`, `${tn(crosser)} crosses to the back post…`) }), shot({ header: true, txt: T(`${tn(S)} kafayı vurdu!`, `${tn(S)} rises for the header!`) })] }); }
        else L.push({ k: 'call', fn: () => [passTo(S, null, { follow: true, txt: T(`${tn(crosser)} geri çıkardı (cutback)!`, `${tn(crosser)} pulls it back!`) }), shot({ power: true })] });
        return L;
      }
      if (set === 'through' || set === 'counter') {
        const pm = (plan.assister && plan.assister.pos === 'OS' ? plan.assister : null) || live(att).filter(p => p.pos === 'OS' && p !== S).sort((a, b) => (has(b, 'PLAYMAKER') - has(a, 'PLAYMAKER')) || b.r - a.r)[0] || plan.assister;
        if (pm && pm !== S) L.push(...getTo(pm, { x: set === 'counter' ? 58 : 66 + rnd(6), y: 30 + rnd(10) }, T(`${tn(pm)} topu ayağına aldı, kafasını kaldırdı`, `${tn(pm)} takes it, head up`)));
        const lineX = (() => { const ds = live(def()).filter(p => p.pos === 'ST' || p.pos === 'BK').map(p => AF(p).x); return ds.length ? Math.max(...ds) : 88; })();
        const spot = { x: clamp(Math.max(lineX + 6, 86), 84, 93), y: 30 + rnd(8) };
        L.push({ k: 'hold', d: .35, runs: [{ p: S, at: towards(S, spot, 4), sp: runSp(S) }], txt: T(`${tn(S)} stoperlerin arasına çapraz koşuya başladı`, `${tn(S)} darts between the centre-backs`) });
        L.push({ k: 'call', fn: () => { if (has(pm, 'PLAYMAKER')) bubble(T(`${trs(tn(pm), 'abl')} kilit pas!`, `Killer ball from ${tn(pm)}!`), holder, '#0b3d91'); return [passTo(S, spot, { through: true, txt: T(`Savunma arkasına ara pas — ${tn(S)} kaleciyle karşı karşıya!`, `Through ball — ${tn(S)} is one-on-one!`) }), shot({ oneOnOne: true })]; } });
        return L;
      }
      if (set === 'target') {
        const tg = live(att).filter(p => p.pos === 'FV' && p !== S).sort((a, b) => has(b, 'AERIAL_THREAT') - has(a, 'AERIAL_THREAT'))[0] || plan.assister || live(att).find(p => p.pos === 'KN' && p !== S);
        if (tg && tg !== S) {
          const tAt = { x: 80 + rnd(4), y: 30 + rnd(8) };
          L.push(...getTo(tg, tAt, T(`Uzun top pivot ${tn(tg)}'e`, `Long ball up to ${tn(tg)}`)).map(b => Object.assign(b, { lob: plan.style === 'uzun' || dist(AF(holder), tAt) > 28 })));
          const second = live(att).filter(p => p.pos === 'KN' && p !== S && p !== tg).slice(0, 2).map((w, i) => ({ p: w, at: { x: 74, y: clamp(tAt.y + (i ? 13 : -13), 6, 62) }, sp: runSp(w) }));
          L.push({ k: 'hold', d: .9, hold: true, runs: [{ p: S, at: { x: 76 + rnd(3), y: tAt.y + (Math.random() < .5 ? -7 : 7) }, sp: runSp(S) }].concat(second), txt: T(`${tn(tg)} stoperi sırtına aldı, topu saklıyor`, `${tn(tg)} holds it up with his back to goal`) });
          L.push({ k: 'call', fn: () => [passTo(S, null, { follow: true, txt: T(`${tn(tg)} tek pasla ${tn(S)}'e indirdi`, `${tn(tg)} lays it off to ${tn(S)}`) }), shot({ power: true })] });
          return L;
        }
      }
      if (set === 'cutin' || set === 'target') {
        const flank = AF(S).y < 34 ? 8 : 60;
        L.push(...getTo(S, { x: 78 + rnd(5), y: flank }, T(`${tn(S)} sağ çaprazda topla buluştu`, `${tn(S)} picks it up out wide`)));
        L.push({ k: 'carry', to: S, at: { x: 85, y: flank < 34 ? 24 : 44 }, txt: T(`${tn(S)} içeri kat ediyor…`, `${tn(S)} cuts inside…`) });
        L.push(shot({ curve: true, far: true, txt: T(`${tn(S)} uzak köşeye plase!`, `${tn(S)} curls it towards the far corner!`) }));
        return L;
      }
      if (set === 'corner') {
        const sh = wpick(live(att).filter(p => p.pos === 'FV' || p.pos === 'KN' || p.pos === 'OS'), p => SCW[p.pos] || 1);
        L.push(...getTo(sh, { x: 84, y: 30 + rnd(8) }, T(`${tn(sh)} ceza sahası önünde`, `${tn(sh)} on the edge of the box`)));
        L.push({ k: 'shot', shooter: sh, out: 'corner', gy: Math.random() < .5 ? GY0 + 1 : GY1 - 1, txt: T(`${trs(tn(sh), 'gen')} şutu savunmadan sekti…`, `${tn(sh)}'s shot is deflected…`) });
        return L;
      }
      if (set === 'fk' || set === 'pen' || set === 'red') {
        const victim = set === 'red' ? S : (live(att).filter(p => p.pos === 'KN' || p.pos === 'FV' || p.pos === 'OS').sort((a, b) => has(b, 'SPEED_DRIBBLER') - has(a, 'SPEED_DRIBBLER'))[0] || S);
        const inBox = set === 'pen' || (set === 'red' && Math.random() < .35);
        const at = inBox ? { x: 91 + rnd(3), y: 28 + rnd(12) } : { x: 79 + rnd(4), y: 24 + rnd(20) };
        if (set === 'red') { const pm = live(att).find(p => p.pos === 'OS'); if (pm) L.push(...getTo(pm, { x: 62, y: 34 })); L.push(passTo(victim, towards(victim, at, 30), { through: true, txt: T(`${tn(victim)} savunma arkasına sarktı, kaleye gidiyor!`, `${tn(victim)} breaks clear and heads for goal!`) })); }
        else {
          L.push(...getTo(victim, { x: at.x - 9, y: at.y }, T(`${tn(victim)} topla ceza sahasına yaklaşıyor`, `${tn(victim)} approaches the box`)));
          // A scripted box challenge must actually get into the box before the whistle.
          // Dribble in 12m pieces; no instantaneous movement from midfield to the spot.
          if (set === 'pen') {
            for (let k = 0; k < 4; k++) L.push({ k: 'carry', to: victim, at,
              txt: k === 0 ? T(`${tn(victim)} ceza sahasına yöneliyor`, `${tn(victim)} drives towards the box`) : '' });
          } else L.push({ k: 'carry', to: victim, at, txt: T(`${tn(victim)} çalıma gidiyor…`, `${tn(victim)} takes on his man…`) });
        }
        L.push({ k: 'foul', victim, fouler: plan.fouler || null, card: set === 'red' ? 'R' : (Math.random() < .55 ? 'Y' : null), dogso: set === 'red' && plan.c.dogso, next: inBox ? 'PENALTY' : 'FREEKICK' });
        return L;
      }
      // yedek: düz bitiriş
      L.push(...getTo(S, { x: 86, y: 34 }));
      L.push(shot());
      return L;
    }

    /* --------- duran toplar: CORNER / FREEKICK / PENALTY ve kart gösterimi --------- */
    // Duran toplarda oyun durur: oyuncular ışınlanmaz, koşarak / yürüyerek yerlerine dizilir.
    function arrange(p, f) { if (!p || p.off || p.leaving) return; p.run = null; p.tx = clamp(f.x, -1.5, W + 1.5); p.ty = clamp(f.y, -1.2, H + 1.2); p.sp = 9.6; p.goal = { x: p.tx, y: p.ty }; }
    const placeAF = (p, at) => { if (!p) return; p.spot = at; arrange(p, AF(at)); }; // hücum çerçevesinde hedef konum (her iki takım için)
    const regroup = (txt, max) => ({ k: 'regroup', txt, max: max || 4.2 });
    const whistle = () => { if (typeof AdvAudio !== 'undefined') AdvAudio.note(2100, .3, 'square', .02); };
    const teamName = s => (s === 'h' ? o.home : o.away).short || (s === 'h' ? o.home : o.away).name;
    function setPiece(kind, spotAF, nextOut) {
      if (kind === 'PENALTY' && foulRestart(spotAF) !== 'PENALTY') kind = 'FREEKICK';
      seg++; setState(kind); holder = null; stopBall(); ball.trail = []; ball.z = 0;
      if (diagnostics) diagnostics.restarts.push(kind);
      const A = live(att), D = live(def()), kp = D.find(p => p.pos === 'KL'), S = plan.shooter;
      A.concat(D).forEach(p => { p.spot = null; p.wall = false; });
      let taker = kind === 'PENALTY' ? (A.find(p => has(p, 'FREEKICK_MASTER') && plan.c.out === 'goal' && !plan.c.sc) || S) : (A.filter(p => has(p, 'FREEKICK_MASTER'))[0] || (kind === 'CORNER' ? A.find(p => p.pos === 'KN') : null) || A.filter(p => p.pos === 'OS').sort((a, b) => b.r - a.r)[0] || S);
      if (kp) placeAF(kp, { x: 104.3, y: 34 });
      if (kind === 'CORNER') {
        const fy = AF(ball).y < 34 ? .6 : 67.4, cf = AF({ x: 104.6, y: fy }); ball.x = cf.x; ball.y = cf.y;
        placeAF(taker, { x: 104.6, y: fy < 34 ? -.9 : 68.9 });
        const tall = A.filter(p => p !== taker && p.pos !== 'KL').sort((a, b) => (has(b, 'AERIAL_THREAT') - has(a, 'AERIAL_THREAT')) || ({ ST: 3, FV: 2, OS: 1 }[b.pos] || 0) - ({ ST: 3, FV: 2, OS: 1 }[a.pos] || 0));
        const spots = [{ x: 96, y: 30 }, { x: 97.5, y: 37 }, { x: 94, y: 34 }, { x: 99, y: 33 }, { x: 93, y: 40 }, { x: 88, y: 26 }, { x: 87, y: 42 }, { x: 84, y: 34 }];
        tall.forEach((p, i) => placeAF(p, i < spots.length ? spots[i] : { x: 55 + i * 2, y: 20 + (i % 3) * 14 }));
        D.filter(p => p !== kp).forEach((d, i) => { const m = tall[i]; placeAF(d, m && i < 6 ? { x: Math.min(103, m.spot.x + 1.7), y: m.spot.y + (m.spot.y < 34 ? 2.3 : -2.3) } : { x: 100 - (i - 6) * 9, y: i % 2 ? 26 : 42 }); });
        const hd = tall.find(p => p === S) || tall[0]; plan.shooter = hd; plan.cornerTaker = taker;
        photoFlash(dir[att] > 0 ? 'R' : 'L', 4);
        beats = [regroup(T('Korner! Uzun boylular ceza sahasına geliyor', 'Corner! The big men come up')), { k: 'call', fn: () => [
          { k: 'hold', d: 1.2, wait: true, txt: T(`Korner: ${tn(taker)} topun başında`, `Corner: ${tn(taker)} stands over it`) },
          { k: 'aim', d: .6, at: AF(hd) },
          passTo(hd, AF(hd), { lob: true, cross: true, curve: true, follow: true, noCut: true, txt: T(`${tn(taker)} ortayı açtı…`, `${tn(taker)} whips it in…`) }),
          { k: 'shot', out: nextOut, header: true, gy: nextOut === 'miss' ? GY1 + 2 : nextOut === 'post' ? GY0 : GY0 + 1 + Math.random() * 5, txt: T(`${tn(hd)} kafayı vurdu!`, `${tn(hd)} heads it!`) }] }];
        return;
      }
      const sp = spotAF;
      if (kind === 'PENALTY') {
        placeAF(taker, { x: 90.6, y: 34 }); plan.shooter = taker;
        A.concat(D).filter(p => p !== taker && p !== kp).forEach((p, i) => placeAF(p, i < 16 ? { x: 86 - (i % 2) * 3, y: 15 + i * 2.5 } : { x: 70 - (i - 16) * 6, y: 20 + (i % 2) * 24 }));
        const f = AF({ x: 94, y: 34 }); ball.x = f.x; ball.y = f.y;
        const gy = nextOut === 'miss' ? (Math.random() < .5 ? GY0 - 1.2 : GY1 + 1.2) : nextOut === 'post' ? GY1 : (Math.random() < .5 ? GY0 + 1 : GY1 - 1);
        beats = [regroup(T('PENALTI! Oyuncular ceza sahasının dışına çıkıyor', 'PENALTY! The players clear the box')), { k: 'call', fn: () => [
          { k: 'hold', d: 1.4, wait: true, txt: T(`PENALTI! ${tn(taker)} topu noktaya koydu`, `PENALTY! ${tn(taker)} places the ball on the spot`) }, { k: 'aim', d: .8, at: { x: 105, y: gy } }, { k: 'shot', out: nextOut, gy, pen: true, txt: T(`${tn(taker)} vurdu…`, `${tn(taker)} strikes…`) }] }];
        return;
      }
      // FREEKICK: gerçek temas noktasından. Orta sahadaysa kısa kullanılır ve atak sahada kurulur.
      if (sp.x < 74) {
        if (taker === S) taker = A.find(p => p !== S && (p.pos === 'OS' || p.pos === 'ST')) || A.find(p => p !== S) || S;
        const support = A.find(p => p !== taker && p !== S && p.pos === 'OS') || A.find(p => p !== taker && p !== S && p.pos !== 'KL') || S;
        const sx = clamp(sp.x + 15, 18, 83), tx = clamp(sp.x + 34, 30, 91);
        placeAF(taker, { x: clamp(sp.x - 1.5, 2, W - 3), y: sp.y });
        if (support !== taker) placeAF(support, { x: sx, y: clamp(sp.y + (sp.y < 34 ? 5 : -5), 8, 60) });
        if (S !== taker && S !== support) placeAF(S, { x: tx, y: clamp(sp.y + (sp.y < 34 ? -5 : 5), 10, 58) });
        const f = AF(sp); ball.x = f.x; ball.y = f.y; plan.wall = null;
        const gy = nextOut === 'miss' ? GY1 + 1.8 : nextOut === 'post' ? GY0 : GY0 + 2.3;
        beats = [regroup(T('Serbest vuruş — oyun durdu', 'Free kick — play stops'), 2.6), { k: 'call', fn: () => {
          const L = [{ k: 'hold', d: 1, wait: true, txt: T(`Orta sahada serbest vuruş — ${tn(taker)} kısa kullanıyor`, `Free kick in midfield — ${tn(taker)} plays it short`) },
            passTo(support, AF(support), { noCut: true, txt: T(`${tn(taker)} oyunu kuruyor`, `${tn(taker)} restarts play`) })];
          if (support !== S) L.push(passTo(S, AF(S), { noCut: true, txt: T(`${tn(support)} ileri oynadı`, `${tn(support)} plays it forward`) }));
          L.push({ k: 'shot', out: nextOut, gy, power: true, txt: T(`${tn(S)} şutunu deniyor!`, `${tn(S)} takes the shot!`) });
          return L; } }];
        plan.shooter = S; return;
      }
      // Tehlikeli bölgede direkt serbest vuruş: baraj toptan 9,15 m uzağa kurulur.
      placeAF(taker, { x: sp.x - 2.4, y: sp.y + (sp.y < 34 ? -1 : 1) }); plan.shooter = (plan.c.out === 'goal' && plan.c.sc) ? S : taker; if (plan.shooter !== taker) placeAF(plan.shooter, { x: sp.x - 2, y: sp.y + (sp.y < 34 ? 2.6 : -2.6) });
      const f = AF(sp); ball.x = f.x; ball.y = f.y;
      const gx = 105, gyC = 34, vx = gx - sp.x, vy = gyC - sp.y, L = Math.hypot(vx, vy) || 1, wx = sp.x + vx / L * 9.15, wy = sp.y + vy / L * 9.15;
      const wallers = D.filter(p => p !== kp).sort((a, b) => ({ ST: 0, OS: 1, FV: 2, KN: 2, BK: 1 }[a.pos] - { ST: 0, OS: 1, FV: 2, KN: 2, BK: 1 }[b.pos])).slice(0, 4);
      wallers.forEach((p, i) => { p.wall = true; placeAF(p, { x: wx, y: wy + (i - 1.5) * 2.1 }); });
      const others = D.filter(p => p !== kp && !wallers.includes(p)), box = A.filter(p => p !== taker && p !== plan.shooter && p.pos !== 'KL');
      box.forEach((p, i) => placeAF(p, i < 5 ? { x: 92 + (i % 2) * 3, y: 22 + i * 5 } : { x: 60 - i * 3, y: 20 + (i % 3) * 14 }));
      others.forEach((d, i) => placeAF(d, i < 5 && box[i] ? { x: box[i].spot.x + 1.7, y: box[i].spot.y + 2.3 } : { x: 70 - i * 4, y: 24 + (i % 3) * 10 }));
      plan.wall = wallers;
      const gy = nextOut === 'miss' ? GY1 + 1.8 : nextOut === 'post' ? GY0 : (sp.y < 34 ? GY1 - 1 : GY0 + 1);
      const shooter = plan.shooter;
      beats = [regroup(T('Frikik! Baraj kuruluyor', 'Free kick! The wall lines up')), { k: 'call', fn: () => [
        { k: 'hold', d: 1.4, wait: true, txt: T(`Frikik! Baraj kuruldu, ${tn(shooter)} topun başında`, `Free kick! The wall is set, ${tn(shooter)} over the ball`) }, { k: 'aim', d: .9, at: { x: 105, y: gy } }, { k: 'shot', out: nextOut, gy, curve: true, fk: true, txt: T(`${tn(shooter)} kavisli vurdu!`, `${tn(shooter)} bends it!`) }] }];
    }

    /* --------- santra: maç başı, her gol sonrası ve ikinci yarı --------- */
    function kickoff(c, kicker, cut) {
      att = kicker; seg++; setState('KICKOFF'); holder = null; stopBall(); ball.x = W / 2; ball.y = H / 2; ball.z = 0; ball.trail = [];
      if (diagnostics) diagnostics.restarts.push('KICKOFF');
      const fronts = {};
      ['h', 'a'].forEach(s => {
        const ps = live(s), front = ps.filter(p => p.pos !== 'KL').sort((a, b) => b.base.x - a.base.x); fronts[s] = front;
        ps.forEach(p => { let x = Math.min(p.base.x, 49.4); const y = p.base.y; // herkes kendi yarı sahasında
          if (s !== kicker) { const dy = y - 34; if (Math.hypot(x - 52.5, dy) < 10.4) x = 52.5 - Math.sqrt(Math.max(0, 10.4 * 10.4 - dy * dy)) - .3; } // rakip orta yuvarlağın dışında bekler
          arrange(p, toField(s, { x, y })); });
      });
      const k1 = fronts[kicker][0], k2 = fronts[kicker][1], back = live(kicker).find(p => p.pos === 'OS' && p !== k1 && p !== k2) || fronts[kicker][2];
      if (k1) arrange(k1, toField(kicker, { x: 51.6, y: 34 })); if (k2) arrange(k2, toField(kicker, { x: 50.4, y: 38.6 }));
      if (cut) P.h.concat(P.a).forEach(p => { if (p.goal && !p.off && !p.leaving) { p.x = p.tx; p.y = p.ty; } });
      whistle();
      beats = [regroup(c.min + "' " + T('Takımlar santra için yerini alıyor', 'The teams line up for kick-off'), 4.6), { k: 'call', fn: () => {
        if (!k1 || !k2) return handOver(c);
        holder = k1;
        return [{ k: 'hold', d: 1.1, wait: true, hold: true, txt: c.min + "' " + T(`Santra: ${tn(k1)} topun başında`, `Kick-off: ${tn(k1)} stands over the ball`) },
          passTo(k2, null, { noCut: true, txt: T(`Santra yapıldı — ${teamName(kicker)} başladı`, `We are under way — ${teamName(kicker)} kick off`) }),
          { k: 'call', fn: () => { setState('PLAYING'); return back && back !== k2 ? [passTo(back, null, { noCut: true, txt: T(`${tn(k2)} geriye, ${tn(back)}'e oynadı`, `${tn(k2)} lays it back to ${tn(back)}`) })] : []; } },
          { k: 'call', fn: () => handOver(c) }];
      } }];
    }
    // Duran top / santra tamamlandı: sıradaki pozisyon rakibinse top el değiştirir, değilse atak buradan kurulur.
    function handOver(c) {
      setState('PLAYING'); P.h.concat(P.a).forEach(p => { p.wall = false; p.goal = null; });
      if (cutIdle && c.kind === 'idle') { cutIdle = false; plan.stage = 'over'; return []; } // sırada gerçek bir pozisyon var: dolgu akışı kısa kesilir
      if (att === c.side) return [];
      att = c.side; holder = null;
      const nh = live(att).filter(p => p.pos !== 'KL').sort((a, b) => dist(a, ball) - dist(b, ball))[0];
      return nh ? [passTo(nh, null, { noCut: true, txt: T(`${tn(nh)} araya girdi, top ${trs(teamName(att), 'loc')}`, `${tn(nh)} steps in — ${teamName(att)} have it`) })] : [];
    }
    /* --------- taç, kale vuruşu ve serbest vuruşla oyunun yeniden başlaması --------- */
    function restart(c, r) {
      att = r.side; seg++; setState(r.kind); holder = null; stopBall(); ball.trail = []; ball.z = 0;
      if (diagnostics) diagnostics.restarts.push(r.kind);
      const A = live(att), D = live(def()), all = A.concat(D), fwd = dir[att];
      all.forEach(p => { p.spot = null; p.wall = false; });
      const shapeAll = (bx, by) => all.forEach(p => arrange(p, toField(p.side, shapeFor(p, p.side, bx, by))));
      if (r.kind === 'GOALKICK') {
        const gk = A.find(p => p.pos === 'KL') || A[0], sy = ball.y < H / 2 ? 34 - 5 : 34 + 5, own = fwd > 0 ? 0 : W;
        ball.x = own + fwd * 5.5; ball.y = sy; shapeAll(30, 34);
        D.forEach(p => { if (Math.abs(p.tx - own) < 18) arrange(p, { x: own + fwd * 19, y: p.ty }); }); // rakip ceza sahasının dışında
        arrange(gk, { x: ball.x - fwd * 1.5, y: sy });
        const long = styleOf(att) !== 'kisa', pool = long ? A.filter(p => p.pos === 'FV' || p.pos === 'OS' || p.pos === 'KN') : A.filter(p => p.pos === 'ST' || p.pos === 'BK');
        const tg = wpick(pool.length ? pool : A.filter(p => p !== gk), p => p.pos === 'FV' ? 2 : 1);
        beats = [regroup(c.min + "' " + T('Aut. Kale vuruşu için takımlar açılıyor', 'Goal kick — the teams spread out'), 3.4), { k: 'call', fn: () => { holder = gk; return [
          { k: 'hold', d: 1.1, wait: true, hold: true, txt: T(`Kale vuruşu: ${tn(gk)} kullanıyor`, `Goal kick: ${tn(gk)} to take`) },
          passTo(tg, null, { lob: long, noCut: true, txt: long ? T(`${tn(gk)} uzun oynadı, hedef ${tn(tg)}`, `${tn(gk)} goes long towards ${tn(tg)}`) : T(`${tn(gk)} kısa başlattı: ${tn(tg)}`, `${tn(gk)} plays it short to ${tn(tg)}`) }),
          { k: 'call', fn: () => handOver(c) }]; } }];
        return;
      }
      const spot = r.spot || { x: ball.x, y: ball.y }, sA = AF(spot);
      if (r.kind === 'THROWIN') {
        const top = spot.y < H / 2, inward = top ? 1 : -1; ball.x = spot.x; ball.y = top ? .15 : H - .15;
        const outf = A.filter(p => p.pos !== 'KL'), thrower = outf.slice().sort((a, b) => (dist(a, spot) - (a.pos === 'BK' ? 8 : 0)) - (dist(b, spot) - (b.pos === 'BK' ? 8 : 0)))[0];
        shapeAll(sA.x, sA.y);
        arrange(thrower, { x: spot.x, y: top ? -.9 : H + .9 });
        const mates = outf.filter(p => p !== thrower).sort((a, b) => dist(a, spot) - dist(b, spot)).slice(0, 2);
        mates.forEach((m, i) => arrange(m, { x: clamp(spot.x + fwd * (i ? -5 : 7), 3, W - 3), y: spot.y + inward * (i ? 9.5 : 7) }));
        D.filter(p => p.pos !== 'KL').sort((a, b) => dist(a, spot) - dist(b, spot)).slice(0, mates.length).forEach((d, i) => arrange(d, { x: mates[i].tx - fwd * 2.4, y: mates[i].ty + inward * 2.2 }));
        ars[top ? 1 : 0].flag = performance.now() + 1400;
        const to = mates[0];
        beats = [regroup(c.min + "' " + T(`Taç: ${teamName(att)} kullanacak`, `Throw-in to ${teamName(att)}`), 3), { k: 'call', fn: () => { if (!to) return handOver(c); holder = thrower; return [
          { k: 'hold', d: 1, wait: true, hold: true, overhead: true, txt: T(`Taç atışı: ${tn(thrower)} topu başının üstüne aldı`, `Throw-in: ${tn(thrower)} winds up`) },
          passTo(to, null, { throw: true, noCut: true, txt: T(`${tn(thrower)} taçı ${tn(to)}'e kullandı`, `${tn(thrower)} throws to ${tn(to)}`) }),
          { k: 'call', fn: () => handOver(c) }]; } }];
        return;
      }
      // FREEKICK (ofsayt ya da orta saha faulü): çabuk, kısa kullanılır
      ball.x = clamp(spot.x, 1, W - 1); ball.y = clamp(spot.y, 1, H - 1); shapeAll(sA.x, sA.y);
      const taker = A.filter(p => p.pos !== 'KL' || sA.x < 20).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
      D.forEach(p => { const dd = Math.hypot(p.tx - ball.x, p.ty - ball.y); if (dd < 9.2) arrange(p, { x: ball.x + (p.tx - ball.x) / (dd || 1) * 9.4 + fwd * .01, y: ball.y + (p.ty - ball.y) / (dd || 1) * 9.4 }); });
      arrange(taker, { x: ball.x - fwd * .9, y: ball.y });
      beats = [regroup(c.min + "' " + T(`Serbest vuruş: ${teamName(att)}`, `Free kick to ${teamName(att)}`), 2.8), { k: 'call', fn: () => { holder = taker;
        const mate = choosePass(taker, A.filter(p => p !== taker && p.pos !== 'KL'));
        return [{ k: 'hold', d: .9, wait: true, hold: true, txt: T(`${tn(taker)} serbest vuruşu kullanıyor`, `${tn(taker)} takes the free kick`) }]
          .concat(mate ? [passTo(mate, null, { noCut: true, txt: T(`${tn(taker)} → ${tn(mate)}`, `${tn(taker)} finds ${tn(mate)}`) })] : [], [{ k: 'call', fn: () => handOver(c) }]); } }];
    }
    /* --------- top kaybı çeşitleri (canlı akış): taca çıkan pas, auta giden uzun top, ofsayt, faul, kesilen orta --------- */
    function strayOut(kind) {
      const a = AF(ball), top = a.y < 34, me = holder;
      if (kind === 'THROWIN') {
        const dA = { x: clamp(a.x + 5 + rnd(12), 4, 100), y: top ? -1.7 : H + 1.7 }, f = AF(dA);
        return [{ k: 'stray', dest: f, restart: { kind, side: def(), spot: { x: f.x, y: f.y < H / 2 ? 0 : H } }, txt: T(`${tn(me)} pasında isabet yok — top taca çıktı`, `${tn(me)}'s pass is overhit — out for a throw-in`) }];
      }
      const f = AF({ x: W + 1.9, y: top ? 12 + rnd(14) : 42 + rnd(14) });
      return [{ k: 'stray', lob: true, dest: f, restart: { kind, side: def() }, txt: T(`${tn(me)} uzun oynadı, top auta gitti`, `${tn(me)} overhits the long ball — goal kick`) }];
    }
    function offsideMove() {
      if (!holder) return null;
      // ofsayt çizgisi: rakibin sondan ikinci oyuncusu (kaleci hariç en gerideki savunmacı); kendi yarı sahanda ofsayt olmaz
      const lineNow = () => { const xs = live(def()).filter(p => p.pos !== 'KL').map(p => AF(p).x); return Math.max(52.5, AF(ball).x, xs.length ? Math.max(...xs) : 80); };
      const dl = lineNow(), cand = live(att).filter(p => p !== holder && (p.pos === 'FV' || p.pos === 'KN'));
      const S = (plan.out === 'offside' && plan.shooter && plan.shooter !== holder && plan.shooter.pos !== 'KL' && plan.shooter) || cand.sort((a, b) => AF(b).x - AF(a).x)[0];
      if (!S || dl > 97 || dl + 3 - AF(S).x > 26) return null;
      const spot = { x: clamp(dl + 5, 55, 101), y: clamp(AF(S).y, 14, 54) }, need = clamp((dl + 2.5 - AF(S).x) / runSp(S), .35, 3);
      return [{ k: 'hold', d: need, wait: true, hold: true, runs: [{ p: S, at: spot, sp: runSp(S) }], txt: T(`${tn(S)} savunmanın arkasına koşuyor…`, `${tn(S)} runs in behind…`) },
        tryPass(0)];
      // koşucu çizgiyi henüz geçmediyse pas bekletilir (en çok 2 kez); yine olmazsa savunma keser ve metin de buna göre yazılır
      function tryPass(n) { return { k: 'call', fn: () => {
          const line = lineNow(), sx = AF(S).x;
          if (holder && sx <= line + .4 && n < 2 && line < 99) return [{ k: 'hold', d: clamp((line + 3 - sx) / runSp(S), .3, 1.6), wait: true, hold: true, runs: [{ p: S, at: { x: clamp(line + 6, 55, 102), y: spot.y }, sp: runSp(S) }] }, tryPass(n + 1)];
          if (sx <= line + .4 || !holder) { if (plan.c) plan.c.actualOut = 'block'; const d = nearest(def(), ball)[0]; return [{ k: 'lose', d: .7, by: d, txt: d ? T(`${tn(d)} araya girdi, top el değiştirdi`, `${tn(d)} steps in and wins it`) : '' }]; }
          plan.offX = AF({ x: line, y: 0 }).x; // pasın verildiği andaki ofsayt çizgisi (saha koordinatı)
          return [passTo(S, { x: clamp(sx + 9, 30, 102), y: AF(S).y }, { through: true, noCut: true, txt: T(`${tn(holder)} ara pasını verdi…`, `${tn(holder)} slips it through…`) }), { k: 'offside', who: S, d: 1.5 }];
        } }; }
    }
    function idleCross() {
      const Wm = wpick(live(att).filter(p => p.pos === 'KN' || p.pos === 'BK'), p => p.pos === 'KN' ? 2 : 1), S = live(att).find(p => p.pos === 'FV');
      if (!Wm || !S || Wm === S) return null;
      const flank = AF(Wm).y < 34 ? 5 : 63, far = live(att).find(p => p.pos === 'KN' && p !== Wm), cb = live(def()).find(p => p.pos === 'ST') || nearest(def(), ball)[0];
      const L = getTo(Wm, { x: 78 + rnd(6), y: flank }, T(`Top kanatta ${trs(tn(Wm), 'loc')}`, `It's out wide to ${tn(Wm)}`));
      const runs = [{ p: S, at: { x: 93, y: flank < 34 ? 38 : 30 }, sp: runSp(S) }]; if (far) runs.push({ p: far, at: { x: 94, y: flank < 34 ? 45 : 23 }, sp: runSp(far) });
      L.push({ k: 'carry', to: Wm, at: { x: 96, y: flank < 34 ? 4 : 64 }, runs, txt: T(`${tn(Wm)} çizgiye iniyor, ceza sahası doluyor`, `${tn(Wm)} gets to the byline as the box fills up`) });
      L.push({ k: 'call', fn: () => [passTo(S, null, { lob: true, cross: true, follow: true, noCut: true, txt: T(`${tn(Wm)} ortayı açtı…`, `${tn(Wm)} swings the cross in…`) }), { k: 'lose', d: .5, by: cb, clear: true, txt: cb ? T(`${tn(cb)} ortayı kafayla uzaklaştırdı`, `${tn(cb)} heads the cross clear`) : '' }] });
      return L;
    }
    function idleFoul() {
      const v = holder, d = nearest(def(), v)[0]; if (!v || !d) return null;
      return [{ k: 'tackle', victim: v, fouler: d, d: 1.1 }];
    }

    /* --------- beat başlatma --------- */
    function applyRuns(runs) { (runs || []).forEach(r => { if (!r.p || r.p.off) return; const f = AF(r.at); r.p.run = { x: f.x, y: f.y, sp: Math.min(r.sp || RUN, 10) }; if (diagnostics) diagnostics.runs.push({ name: r.p.name, sp: r.sp }); }); }
    function startBeatInterception(b) {
      const p = b.by;
      if (p) { p.run = null; p.tx = ball.x; p.ty = ball.y; p.sp = runSp(p); }
      if (b.txt) com(clips[ci].min, b.txt);
    }
    function startBeat() {
      beat = beats.shift(); bt = 0;
      if (!beat) { if (plan && plan.stage !== 'over') { beats = decidePlayerAction() || []; if (!beats.length) return nextClip(); return startBeat(); } return nextClip(); }
      if (beat.k === 'call') { const more = beat.fn() || []; beats = more.concat(beats); return startBeat(); }
      if (beat.txt) com(clips[ci].min, beat.txt);
      applyRuns(beat.runs);
      if (beat.k === 'hold' && holder && state === 'PLAYING') supportRuns();
      if (beat.k === 'hold' && !beat.wait) beat.d=clamp(beat.d||.22,.08,beat.hold?.65:.28);
      if (beat.k === 'pass') {
        const r = beat.to; if (!r || r.off) { beat.k = 'hold'; beat.d = .3; return; }
        if (plan && plan.set === 'idle' && holder && !beat.noCut && !beat.lob && !beat.cross &&
            !laneOpen(holder, r) && Math.random() < .55) {
          const interceptor = nearest(def(), ball)[0];
          if (interceptor) {
            beat = { k: 'lose', d: .65, by: interceptor,
              txt: T(`${tn(interceptor)} pas arasını kapatıp topu kesiyor!`, `${tn(interceptor)} reads the pass and intercepts!`) };
            return startBeatInterception(beat);
          }
        }
        let target = beat.at ? AF(beat.at) : { x: r.x, y: r.y };
        if (beat.follow && r.run) target = { x: r.run.x, y: r.run.y };
        beat.rFrom = { x: r.x, y: r.y };
        const sp = Math.min(11, runSp(r)), flight = beat.cross ? 20 : beat.lob ? 22 : beat.throw ? 15 : beat.through ? 31 : 34;
        const lead = beat.through || beat.follow ? 18 : beat.cross ? 8 : 1.5;
        const intended = dist(r, target) || 1;
        const wanted = { x: r.x + (target.x - r.x) / intended * Math.min(lead, intended),
          y: r.y + (target.y - r.y) / intended * Math.min(lead, intended) };
        // A through ball is a genuine lead pass, never a teleport to an arbitrary point.
        let duration = clamp(Math.max(dist(ball, wanted) / flight, dist(r, wanted) / sp, .24), .24, 2.25);
        const reachable = Math.min(dist(r, wanted), sp * Math.max(0, duration - .1));
        const end = { x: clamp(r.x + (wanted.x - r.x) / (dist(r, wanted) || 1) * reachable, 1, W - 1),
          y: clamp(r.y + (wanted.y - r.y) / (dist(r, wanted) || 1) * reachable, 1, H - 1) };
        duration = clamp(Math.max(dist(ball, end) / flight, dist(r, end) / sp, .24), .24, 2.25);
        beat.d = duration; beat.rTo = end; beat.from = { x: ball.x, y: ball.y };
        beat.dest = { x: end.x, y: end.y };
        if (beat.curve) { const mx = (beat.from.x + beat.dest.x) / 2, my = (beat.from.y + beat.dest.y) / 2; beat.ctrl = { x: mx - dir[att] * 2, y: my + (beat.dest.y > beat.from.y ? -3 : 3) }; }
        r.run = null; r.tx = end.x; r.ty = end.y; holder = null; carryDist = 0;
        // topa ilk hız: yerden pas sürtünmeyle yavaşlar; uzun top / orta / taç havadan (vz > 0) gider
        launch(beat.dest, beat.d, { air: !!(beat.lob || beat.throw), ctrl: beat.ctrl, z0: beat.throw ? 1.9 : undefined, zEnd: beat.cross ? 1.75 : beat.lob ? .3 : beat.throw ? .4 : 0 });
        if (diagnostics) diagnostics.passes.push({ receiver: r.name, duration: beat.d, distance: dist(beat.from, beat.dest), start: performance.now(), end: null, type: beat.through ? 'through' : beat.lob ? 'lob' : 'ground', receptionGap: null });
      }
      if (beat.k === 'carry') {
        const r = beat.to, f = AF(beat.at), L = dist(r, f), m = Math.min(L, 12); // kesintisiz top sürme en çok 12 m (solo koşu yok)
        const end = { x: r.x + (f.x - r.x) / (L || 1) * m, y: r.y + (f.y - r.y) / (L || 1) * m };
        // önünde rakip varsa (baskı) hız kesilir ve sürme kısalır
        const k = isUnderPressure(r) ? .45 : 1;
        beat.rFrom = { x: r.x, y: r.y }; beat.rTo = { x: lerp(r.x, end.x, k), y: lerp(r.y, end.y, k) }; beat.d = Math.max(.16, dist(r, beat.rTo) / Math.max(6, dribSp(r)*1.22)); holder = r; r.run = null;
        carryDist += dist(r, beat.rTo);
      }
      if (beat.k === 'aim') { fx.aim = { from: { x: ball.x, y: ball.y }, to: AF(beat.at) }; }
      if (beat.k === 'lose') { const d = beat.by; if (d) { d.run = null; d.tx = ball.x; d.ty = ball.y; d.sp = 8; } }
      if (beat.k === 'regroup') { // herkes yerine varana kadar (en çok beat.max sn) oyun durur
        const far = P.h.concat(P.a).filter(p => p.goal && !p.off && !p.leaving).reduce((m, p) => Math.max(m, Math.hypot(p.goal.x - p.x, p.goal.y - p.y)), 0);
        beat.d = clamp(far / 9.6 + .3, 1, beat.max || 4.2);
      }
      if (beat.k === 'stray') { // isabetsiz pas / uzun top oyun alanını terk eder
        holder = null; beat.d = clamp(dist(ball, beat.dest) / (beat.lob ? 23 : 25), .45, 2.3);
        launch(beat.dest, beat.d, { air: !!beat.lob, zEnd: beat.lob ? .5 : 0 });
      }
      if (beat.k === 'offside') {
        const S = beat.who, x = plan.offX; fx.offside = { x, until: performance.now() + 1500 }; setState('OFFSIDE'); holder = null; stopBall(); if (S) S.run = null;
        ars[x > W / 2 ? 0 : 1].flag = performance.now() + 1700; whistle(); fireShow(plan.c);
        bubble(T('OFSAYT!', 'OFFSIDE!'), S || ball, '#b8860b');
        com(clips[ci].min, T(`${S ? tn(S) : ''} ofsayta takıldı — yan hakem bayrağı kaldırdı.`, `${S ? tn(S) : ''} is caught offside — the flag is up.`), 'miss');
        if (diagnostics) diagnostics.offsides.push({ x, player: S && S.name, playerX: S && S.x });
      }
      if (beat.k === 'tackle') { // orta saha faulü: kayarak müdahale, çim sıçrar, serbest vuruş
        const v = beat.victim, d = beat.fouler; holder = null; stopBall();
        if (d) { d.run = null; d.tx = v.x + dir[att] * .4; d.ty = v.y + 1.2; d.sp = 9.5; }
        grassBurst(v, 14); whistle(); bubble(T('FAUL!', 'FOUL!'), v, '#111');
        com(clips[ci].min, T(`${tn(d)} kayarak girdi, ${tn(v)} yerde — serbest vuruş.`, `${tn(d)} slides in on ${tn(v)} — free kick.`), 'miss');
        if (diagnostics) diagnostics.fouls.push({ spot: { x: AF(v).x, y: AF(v).y }, awarded: 'FREEKICK', requested: 'idle' });
      }
      if (beat.k === 'shot') {
        const shooter = beat.shooter || (plan && plan.shooter);
        if (shooter && state === 'PLAYING' && !beat.pen && !beat.fk) {
          const at = AF(shooter), ballAt = AF(ball);
          const maxDistance = maxShotDistance(shooter.pos);
          const shootingZone = { x: 105 - maxDistance + 4, y: clamp(at.y, 18, 50) };
          if (holder !== shooter || dist(ballAt, at) > 4.6 || at.x < 105 - maxDistance) {
            // Never permit a scripted shot from midfield. Build the attack on the pitch.
            const build = [];
            if (holder && holder !== shooter) build.push(passTo(shooter, AF(shooter), {
              txt: T(`${tn(holder)} topu ${tn(shooter)}'e gönderiyor`, `${tn(holder)} finds ${tn(shooter)}`) }));
            build.push(...moveIntoPosition(shooter, shootingZone,
              T(`${tn(shooter)} ceza sahasına ilerliyor`, `${tn(shooter)} advances into the final third`)));
            if (build.length) {
              beats = build.concat([beat], beats);
              return startBeat();
            }
          }
        }
        if (diagnostics) diagnostics.shots.push({
          shooter: shooter && shooter.name, pos: shooter && shooter.pos,
          x: AF(ball).x, y: AF(ball).y, distance: W - AF(ball).x,
          set: plan && plan.set, out: beat.out
        });
        startShot(beat);
      }
      if (beat.k === 'foul') {
        const v = beat.victim, d = beat.fouler && !beat.fouler.off ? beat.fouler : wpick(nearest(def(), v).slice(0, 2), p => has(p, 'AGGRESSIVE_TACKLER') ? 3 : 1);
        beat.fouler = d; beat.d = 1.1;
        // Freeze the actual contact point at the whistle — never infer it from the planned attack.
        beat.foulSpot = { x: clamp(AF(v).x, 0, W), y: clamp(AF(v).y, 0, H) };
        beat.next = foulRestart(beat.foulSpot);
        if (plan && plan.c) plan.c.actualHow = beat.next === 'PENALTY' ? 'pen' : 'fk';
        if (diagnostics) diagnostics.fouls.push({ spot: { ...beat.foulSpot }, awarded: beat.next, requested: plan.set });
        holder = null; stopBall(); grassBurst(v, 16);
        if (d) { d.run = null; d.tx = v.x - dir[att] * .2; d.ty = v.y + .9; }
        com(clips[ci].min, beat.card === 'R' ? T(`${tn(d)} arkadan sert kaydı — düdük!`, `${tn(d)} slides in from behind — whistle!`) : T(`${tn(d)} müdahale etti, ${tn(v)} yerde — faul!`, `${tn(d)} goes in, ${tn(v)} is down — foul!`), 'miss');
        bubble(T('FAUL!', 'FOUL!'), v, '#111');
        if (typeof AdvAudio !== 'undefined') AdvAudio.note(2100, .35, 'square', .02);
      }
      if (beat.k === 'card') {
        if (beat.red) fireShow(plan.c);
        setState('CARD_SHOWN'); const p = beat.p; fx.cards.push({ p, red: beat.red, t: performance.now() }); if (p) p.card = beat.red || p.card === 'Y' ? 'R' : 'Y';
        bubble(beat.red ? (beat.dogso ? T('KIRMIZI KART! Son adam indirildi!', 'RED CARD! Last man brought down!') : T('KIRMIZI KART!', 'RED CARD!')) : T(`SARI KART — ${tn(p)}`, `YELLOW — ${tn(p)}`), p, beat.red ? '#c8102e' : '#c99a00');
        com(clips[ci].min, beat.red ? T(`🟥 ${p.name} kırmızı kartla oyun dışı! ${p.side === 'h' ? o.home.name : o.away.name} 10 kişi.`, `🟥 ${p.name} is sent off! ${p.side === 'h' ? o.home.name : o.away.name} are down to ten.`) : T(`🟨 ${p.name} sarı kart gördü.`, `🟨 ${p.name} is booked.`), beat.red ? 'red' : '');
        if (beat.red) shake(300);
      }
      if (beat.k === 'result') showResult(beat);
    }
    function startShot(b) {
      const S = b.shooter || plan.shooter, kp = live(def()).find(p => p.pos === 'KL'), out = b.out;
      const gx = dir[att] > 0 ? (out === 'goal' ? W + 1.2 : out === 'miss' ? W + .5 : W - .4) : (out === 'goal' ? -1.2 : out === 'miss' ? -.5 : .4);
      let gy = dir[att] > 0 ? b.gy : H - b.gy;
      if (b.far && holder) { const fy = AF(ball).y < 34 ? GY1 - .7 : GY0 + .7; if (out === 'goal' || out === 'save') gy = dir[att] > 0 ? fy : H - fy; }
      b.from = { x: ball.x, y: ball.y }; b.dest = { x: gx, y: gy }; holder = null;
      const L = dist(b.from, b.dest); b.d = clamp(L / (b.header ? 15 : b.pen ? 26 : b.power ? 28 : 24), .35, 1.4);
      if (b.curve) { const mx = (b.from.x + b.dest.x) / 2, my = (b.from.y + b.dest.y) / 2, side = (AF(ball).y < 34 ? 1 : -1) * dir[att]; b.ctrl = { x: mx, y: my - side * Math.min(7, L * .22) }; }
      if (out === 'save' && kp) { const t = b.oneOnOne && has(kp, 'WALL_GK') ? .7 : .9; b.dest = b.ctrl ? bez(b.from, b.ctrl, { x: gx, y: gy }, .93) : { x: lerp(b.from.x, gx, t), y: lerp(b.from.y, gy, t) }; kp.run = null; kp.tx = b.dest.x; kp.ty = b.dest.y; kp.sp = 9.5; }
      if (out === 'goal' && kp) kp.run = null;
      if (out === 'block' || out === 'corner') {
        const blk = (plan.wall && plan.wall[0]) || nearest(def(), ball)[0];
        if (out === 'block') { b.dest = { x: lerp(b.from.x, gx, .22), y: lerp(b.from.y, gy, .22) }; b.ctrl = null; if (blk && !plan.wall) { blk.run = null; blk.tx = b.dest.x; blk.ty = b.dest.y; } }
        else { b.dest = { x: dir[att] > 0 ? W + 1 : -1, y: gy < 34 ? GY0 - 6 : GY1 + 6 }; b.ctrl = { x: lerp(b.from.x, b.dest.x, .5), y: lerp(b.from.y, gy, .5) }; }
      }
      if (b.oneOnOne && kp && has(kp, 'WALL_GK')) { const towardsBall = { x: lerp(kp.x, ball.x, .3), y: lerp(kp.y, ball.y, .3) }; kp.tx = towardsBall.x; kp.ty = towardsBall.y; }
      if (b.header || b.power || out === 'post') shake(b.header ? 340 : 240);
      // şut fiziği: sert vuruşların arkasında hız izi; top hedefe gerçek bir yörüngeyle gider
      const zEnd = out === 'goal' ? (b.header ? .8 : b.fk ? 1.6 : .3 + Math.random() * 1.3) : out === 'save' ? .5 + Math.random() : out === 'post' ? 1.1 : out === 'miss' ? (b.header || Math.random() < .35 ? 3.3 : .9) : out === 'corner' ? 1.3 : .6;
      launch(b.dest, b.d, { air: true, ctrl: b.ctrl, z0: b.header ? Math.max(1.7, ball.z) : Math.max(.12, ball.z), zEnd });
      if (b.curve || b.fk || b.power || b.header || L / b.d > 21) ball.trail = [{ x: ball.x, y: ball.y }];
      photoFlash(dir[att] > 0 ? 'R' : 'L', 3 + rnd(3));
      if (kp && (out === 'save' || out === 'goal' || out === 'post')) { // kaleci topun köşesine doğru uzanır (dive)
        const wrong = out === 'goal' && Math.random() < .28, ty = out === 'save' ? b.dest.y : wrong ? kp.y - (gy - kp.y) * .6 : kp.y + (gy - kp.y) * (out === 'goal' ? .62 : .8);
        kp.dive = { t: performance.now(), dur: clamp(b.d * 1000, 320, 900), a: Math.atan2(clamp(ty, GY0 - 1.5, GY1 + 1.5) - kp.y, (out === 'save' ? b.dest.x : kp.x) - kp.x) };
        if (out !== 'save') { kp.tx = kp.x; kp.ty = clamp(ty, GY0 - 1, GY1 + 1); kp.sp = 9; }
      }
      fx.aim = null;
    }
    const bez = (a, c, b, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });

    function showResult(b) {
      const c = plan.c, S = plan.shooter, out = b.out;
      if (out === 'goal') {
        needReset = true; lastGoalBy = att; fireShow(plan.c); photoFlash(dir[att] > 0 ? 'R' : 'L', 12); goalAt = performance.now();
        if (diagnostics) diagnostics.goals.push({ side: att, x: ball.x, y: ball.y, goalLine: dir[att] > 0 ? W : 0, valid: dir[att] > 0 ? ball.x >= W : ball.x <= 0 });
        c.counted = true; if (att === 'h') score[0]++; else score[1]++; q('.m2d-sc').textContent = score[0] + ' – ' + score[1]; flash = 'GOL!'; startCheer(att);
        showFlash(T('GOOOL!', 'GOAL!'), tn(S), att === 'h' ? hc : ac); shake(450);
        const flair = b.header && has(S, 'AERIAL_THREAT') ? T(`${tn(S)} kule gibi yükseldi!`, `${tn(S)} towers above everyone!`) : b.curve && has(S, 'FINESSE_SHOT') ? T(`${trs(tn(S), 'abl')} falsolu plase!`, `A curler from ${tn(S)}!`) : b.fk ? T('Barajın üstünden ağlara!', 'Over the wall and in!') : b.pen ? T('Penaltıyı gole çevirdi!', 'Penalty converted!') : null;
        if (flair) bubble(flair, S, att === 'h' ? hc : ac);
        com(c.min, T(`GOOOL! ${S.name}${c.as ? ' (asist: ' + c.as + ')' : ''}! Skor ${score[0]}–${score[1]}`, `GOAL! ${S.name}${c.as ? ' (assist: ' + c.as + ')' : ''}! It’s ${score[0]}–${score[1]}`), 'goal');
        if (typeof AdvAudio !== 'undefined') { AdvAudio.note(784, .15, 'triangle', .05); setTimeout(() => AdvAudio.note(1046, .25, 'triangle', .05), 140); }
        // gol sevinci: golü atan ve en yakın 3 arkadaşı, hücum ettikleri kalenin korner direğine koşup kucaklaşır
        const cx = dir[att] > 0 ? W - 2.2 : 2.2, cy = S.y < H / 2 ? 2.4 : H - 2.4, pals = live(att).filter(p => p !== S && p.pos !== 'KL').sort((a, b) => dist(a, S) - dist(b, S));
        S.run = { x: cx, y: cy, sp: 8.6 };
        pals.slice(0, 3).forEach((p, i) => { p.run = { x: cx - dir[att] * (1.6 + (i % 2) * 2.4), y: cy + (cy < 34 ? 1 : -1) * (1.4 + i * 1.5), sp: 8 }; });
        pals.slice(3).forEach(p => { p.run = { x: lerp(p.x, W / 2 - dir[att] * 6, .5), y: lerp(p.y, 34, .2), sp: 4.5 }; });
        live(def()).forEach(p => { if (p.pos !== 'KL') { p.run = null; p.tx = lerp(p.x, W / 2 + dir[att] * 8, .35); p.ty = lerp(p.y, 34, .2); p.sp = 3; } });
        celebrate = { side: att, t: performance.now(), names: [S.name].concat(pals.slice(0, 3).map(p => p.name)) };
        if (diagnostics) diagnostics.celebrations = (diagnostics.celebrations || []).concat([{ runners: 1 + Math.min(3, pals.length), corner: { x: cx, y: cy }, end: dir[att] > 0 ? 'R' : 'L' }]);
      } else {
        com(c.min, { save: has(live(def()).find(p => p.pos === 'KL'), 'WALL_GK') ? T('Panter gibi uzandı! Kaleci gole izin vermiyor.', 'What a reflex save — like a panther!') : T('Kaleci müthiş bir kurtarışla gole izin vermiyor!', 'What a save from the goalkeeper!'), miss: T(`${tn(S)} topu az farkla auta gönderdi.`, `${tn(S)} drags it just wide.`), post: T(`Direkten döndü! ${tn(S)} inanamıyor.`, `Off the post! ${tn(S)} can’t believe it.`), block: plan.wall ? T('Top baraja çarptı.', 'It hits the wall.') : T('Son anda araya giren savunma topu blokladı.', 'Blocked at the last moment.') }[out] || '', 'miss');
        if (out === 'post') bubble(T('DİREK!', 'POST!'), ball, '#111');
        if (out === 'miss' && LIVE) { pendingRestart = { kind: 'GOALKICK', side: def() }; lastLoser = att; }
        // top fiziği: direkten / kaleciden / savunmadan seken top gerçek bir hızla geri döner
        const sg = Math.random() < .5 ? -1 : 1, kp2 = live(def()).find(p => p.pos === 'KL');
        if (out === 'post') { flight = null; ball.vx = -dir[att] * (8 + Math.random() * 5); ball.vy = sg * (2 + Math.random() * 6); ball.vz = 2.2; }
        if (out === 'block') { flight = null; ball.vx = -dir[att] * (3 + Math.random() * 4); ball.vy = sg * (3 + Math.random() * 5); ball.vz = 2.4; }
        if (out === 'save') {
          if (kp2 && !b.header && Math.random() < .5) { stopBall(); holder = kp2; lastLoser = att; } // kaleci topu kontrol etti
          else { flight = null; ball.vx = -dir[att] * (4 + Math.random() * 4); ball.vy = sg * (6 + Math.random() * 5); ball.vz = 3 + Math.random() * 2; }
        }
      }
    }
    function showFlash(big, small, col) { const f = q('.m2d-flash'); f.innerHTML = `<b style="--c:${col}">${esc(big)}</b><span>${esc(small)}</span>`; f.hidden = false; }
    function endBeat(b) {
      if (b.k === 'pass' || b.k === 'carry') {
        holder = b.to;
        if (b.k === 'pass') {
          // Catch the ball at the receiver's feet, not behind them.
          const gap = dist(holder, ball);
          if (diagnostics) { const entry = diagnostics.passes[diagnostics.passes.length - 1]; if (entry) { entry.end = performance.now(); entry.receptionGap = gap; } }
          flight = null; ball.vx = ball.vy = 0; // ilk dokunuş: top alıcının ayağında / kafasında durur
        }
      }
      if (b.k === 'foul') { const red = b.card === 'R'; if (b.card) beats.unshift({ k: 'card', p: b.fouler, red, dogso: b.dogso, d: 1.5 }); beats.splice(b.card ? 1 : 0, 0, { k: 'call', fn: () => { if (red && b.fouler) startLeaving(b.fouler); const spot = b.foulSpot || AF(b.victim); setPiece(foulRestart(spot), spot, plan.out); plan.stage = 'over'; return []; } }); }
      if (b.k === 'shot') { if (b.out === 'corner') { beats = [{ k: 'hold', d: .24, txt: T('Kornere çıktı.', 'Out for a corner.') }, { k: 'call', fn: () => { setPiece('CORNER', null, plan.out); plan.stage = 'over'; return []; } }]; } else beats = [{ k: 'result', d: b.out === 'goal' ? 3.4 : .8, out: b.out, header: b.header, curve: b.curve, fk: b.fk, pen: b.pen }]; plan.stage = 'over'; }
      if (b.k === 'card') setState('CARD_SHOWN');
      if (b.k === 'regroup') { let snapped = false; P.h.concat(P.a).forEach(p => { if (p.goal && !p.off && !p.leaving && Math.hypot(p.goal.x - p.x, p.goal.y - p.y) > 1.2) { p.x = p.goal.x; p.y = p.goal.y; snapped = true; } p.goal = null; }); if (snapped) seg++; }
      if (b.k === 'stray') { pendingRestart = b.restart; lastLoser = att; plan.stage = 'over'; beats = []; if (b.restart.kind === 'THROWIN') ars[ball.y < H / 2 ? 1 : 0].flag = performance.now() + 1200; }
      if (b.k === 'offside') { const S = b.who; pendingRestart = { kind: 'FREEKICK', side: def(), spot: { x: clamp(S ? S.x : ball.x, 2, W - 2), y: clamp(S ? S.y : ball.y, 2, H - 2) } }; lastLoser = att; plan.stage = 'over'; beats = []; }
      if (b.k === 'tackle') { pendingRestart = { kind: 'FREEKICK', side: att, spot: { x: clamp(b.victim.x, 2, W - 2), y: clamp(b.victim.y, 2, H - 2) } }; lastLoser = def(); plan.stage = 'over'; beats = []; }
      if (b.k === 'aim') fx.aim = null;
      if (b.k === 'lose') { holder = b.by && !b.by.off && !b.clear ? b.by : null; if (holder) stopBall(); else if (b.clear) { flight = null; ball.vx = -dir[att] * (11 + Math.random() * 5); ball.vy = (Math.random() - .5) * 12; ball.vz = 6.5; } plan.stage = 'over'; beats = []; if (b.by) { b.by.tx = b.by.x; b.by.ty = b.by.y; } lastLoser = att; }
      if (b.k === 'result') { plan.stage = 'over'; beats = []; }
    }
    let curMin = 1, momentum = 50, lastLoser = null, ended = false, celebrate = null, goalAt = -1e9;
    function filler() { // canlı mod: olay yokken top dolaşımı
      const side = lastLoser ? (lastLoser === 'h' ? 'a' : 'h') : (Math.random() * 100 < momentum ? 'h' : 'a'); lastLoser = null;
      return { side, min: curMin, kind: 'idle', out: 'lost', kickoff: needReset };
    }
    // canlı mod: skor / kart metni, olay sahada gerçekleştiği anda yazılır (hiç oynanmazsa klip biterken)
    function fireShow(c) { if (c && c.onShow) { const f = c.onShow; c.onShow = null; try { f(); } catch (e) {} } }
    function nextClip() {
      const prev = clips[ci]; fireShow(prev); if (prev && prev.cb) { const f = prev.cb; prev.cb = null; setTimeout(f, 0); }
      ci++; if (!clips.slice(ci).some(x => x.kind !== 'idle')) cutIdle = false;
      if (ci >= clips.length) { if (LIVE && !ended) clips.push(filler()); else return fullTime(); }
      setupClip(clips[ci]); startBeat();
    }
    function fullTime() {
      cancelAnimationFrame(raf); if (!LIVE) { score = [o.gh, o.ga]; q('.m2d-sc').textContent = o.gh + ' – ' + o.ga; } q('.m2d-min').textContent = T('MS', 'FT'); setState('PLAYING');
      com(90, T(`Maç sona erdi: ${o.home.name} ${o.gh} – ${o.ga} ${o.away.name}`, `Full time: ${o.home.name} ${o.gh} – ${o.ga} ${o.away.name}`), 'end');
      if (diagnostics) diagnostics.done = true; ov.querySelector('.m2d').classList.add('ft');
      draw(); const b = q('[data-k=next]'); b.textContent = T('Devam ▶', 'Continue ▶'); b.classList.add('pr'); q('[data-k=end]').hidden = true; q('[data-k=spd]').hidden = true;
      b.onclick = close; b.focus();
    }
    function close() { if (closed) return; closed = true; clips.forEach(fireShow); cancelAnimationFrame(raf); ov.remove(); if (!EMBED) document.body.classList.remove('m2d-open'); document.removeEventListener('keydown', onKey); onDone && onDone(); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); ci = clips.length; fullTime(); } }
    if (!EMBED) document.addEventListener('keydown', onKey);

    /* --------- ana döngü: updateMatch() + ballPhysics() --------- */
    let last = 0;
    function ballPhysics(dt) {
      if (!beat) return;
      const k = clamp(bt / beat.d, 0, 1);
      if (beat.k === 'pass' && beat.rTo) {
        const r = beat.to; const dx = beat.rTo.x - r.x, dy = beat.rTo.y - r.y;
        const rem = Math.hypot(dx, dy), step = Math.min(rem, Math.min(11, runSp(r)) * dt);
        if (rem > .0001) { r.x += dx / rem * step; r.y += dy / rem * step; }
        r.tx = beat.rTo.x; r.ty = beat.rTo.y;
        // topun konumu stepBall()'da ilk hızdan hesaplanır (sürtünme / parabol / kavis)
      } else if (beat.k === 'carry') {
        // top sürme: top ayağa yapışık değildir; oyuncu topa yetiştikçe önüne doğru kısa dokunuşlarla iter
        const r = beat.to; r.x = r.tx = lerp(beat.rFrom.x, beat.rTo.x, k); r.y = r.ty = lerp(beat.rFrom.y, beat.rTo.y, k);
        const dx = beat.rTo.x - beat.rFrom.x, dy = beat.rTo.y - beat.rFrom.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        const ahead = (ball.x - r.x) * ux + (ball.y - r.y) * uy, off = Math.hypot(ball.x - r.x, ball.y - r.y);
        if (ahead < .5 || off > 3.2) { const v = L / beat.d * 1.8, ax = r.x + ux * 1.6 - ball.x, ay = r.y + uy * 1.6 - ball.y, al = Math.hypot(ax, ay) || 1, vv = off > 3.2 ? v * 1.5 : v; ball.vx = ax / al * vv; ball.vy = ay / al * vv; ball.z = 0; ball.vz = 0; if (diagnostics) diagnostics.touches = (diagnostics.touches || 0) + 1; }
      }
    }
    function updateMatch(ts, dt) {
      leavingUpdate(dt);
      if (beat) { bt += dt; ballPhysics(dt); stepBall(dt); if (diagnostics && ball.z > diagnostics.ballMaxZ) diagnostics.ballMaxZ = ball.z; if (bt >= beat.d) { const b = beat; endBeat(b); startBeat(); } }
      // top ayakta: hafifçe ilerle (sürme hızı topsuzdan yavaş), top oyuncunun önünde
      if (holder && beat && beat.k === 'hold' && state === 'PLAYING' && !beat.hold) { const a = AF(holder); if (!isUnderPressure(holder) && a.x < 96) { const f = AF({ x: a.x + dt * dribSp(holder) * .35, y: a.y }); holder.x = holder.tx = f.x; holder.y = holder.ty = f.y; } }
      if (!beat) return;
      if (state !== 'PLAYING' && state !== 'CARD_SHOWN') { movePlayers(dt, ts); return; }
      if (beat.k === 'result' || beat.k === 'foul' || beat.k === 'card' || beat.k === 'tackle') {
        // gol sevinci: koşu hedefleri burada uygulanır (yoksa oyuncular yerinde kalır); "GOOOL!" yazısı 1,3 sn sonra çekilir ki sevinç görünsün
        if (beat.k === 'result') { ['h', 'a'].forEach(s => live(s).forEach(p => { if (p.run) { p.tx = p.run.x; p.ty = p.run.y; p.sp = p.run.sp; } })); if (beat.out === 'goal' && bt > 1.3) q('.m2d-flash').hidden = true; }
        movePlayers(dt, ts); return; }
      const bA = AF(ball);
      ['h', 'a'].forEach(s => live(s).forEach(p => {
        if (locked(p)) return;
        if (p.run) { p.tx = p.run.x; p.ty = p.run.y; p.sp = p.run.sp; return; }
        if (s !== att && p.pos === 'KL') { if (!(beat.k === 'shot' && (beat.out === 'save' || beat.out === 'goal' || beat.out === 'post'))) keeperAI(p, s); return; }
        if (beat.k === 'shot' && Math.hypot(p.tx - beat.dest.x, p.ty - beat.dest.y) < .2) return;
        const f = toField(s, shapeFor(p, s, bA.x, bA.y)); p.tx = f.x + Math.sin(ts / 900 + p.num) * .5; p.ty = f.y + Math.cos(ts / 1100 + p.num) * .5; p.sp = JOG;
      }));
      if (beat.k !== 'shot') defenseUpdate();
      // pivot topu saklarken en yakın stoper sırtına yapışır
      if (beat.hold && holder) { const m = nearest(def(), holder)[0]; if (m) { m.tx = holder.x + dir[att] * 1.3; m.ty = holder.y + .4; } }
      movePlayers(dt, ts);
    }
    // Kaleci: top ile kale merkezi arasındaki açıortayda durur; top yaklaştıkça öne çıkar,
    // bire birde açıyı daraltmak için ceza sahası içinde topa doğru çıkış yapar.
    function keeperAI(p, s) {
      const gx = dir[s] > 0 ? 0 : W, bx = ball.x - gx, by = ball.y - 34, dB = Math.hypot(bx, by) || 1;
      const carrier = holder && holder.side !== s ? holder : null;
      const clear = carrier && dB < 30 && Math.abs(by) < 17 && !live(s).some(d => d !== p && Math.abs(d.x - gx) < Math.abs(carrier.x - gx) - .5 && Math.abs(d.y - carrier.y) < 6);
      const rush = !!(clear || (beat && beat.k === 'pass' && beat.through && dB < 36));
      const out = rush ? clamp(dB * .38, 3.5, 11) : clamp(dB * .075, .9, 5.2);
      p.tx = gx + bx / dB * out; p.ty = 34 + by / dB * out;
      if (!rush) p.ty = clamp(p.ty, GY0 - .6, GY1 + .6);
      p.tx = dir[s] > 0 ? clamp(p.tx, .8, 16) : clamp(p.tx, W - 16, W - .8);
      p.sp = rush ? 8.2 : 6.2;
      if (diagnostics) { const off = Math.abs(p.x - gx); if (off > (diagnostics.keeperMaxOff || 0)) diagnostics.keeperMaxOff = off; diagnostics.keeperMoves = (diagnostics.keeperMoves || 0) + (Math.abs(p.ty - 34) > 1 ? 1 : 0); }
    }
    // Hakemler: orta hakem pozisyonu çaprazdan izler; iki yan hakem kendi yarı sahasında
    // sondan ikinci savunmacının (ya da daha gerideyse topun) hizasında koşar.
    const ref = { x: W / 2 - 6, y: H / 2 - 9 }, ars = [{ x: W * .75, y: H + .75, flag: 0 }, { x: W * .25, y: -.75, flag: 0 }];
    function offsideLineX(right) {
      const s = dir.h < 0 ? (right ? 'h' : 'a') : (right ? 'a' : 'h'), xs = live(s).map(p => p.x).sort((a, b) => right ? b - a : a - b), second = xs.length > 1 ? xs[1] : (right ? W : 0);
      return right ? clamp(Math.max(second, ball.x), W / 2, W) : clamp(Math.min(second, ball.x), 0, W / 2);
    }
    function updateOfficials(dt) {
      const go = (o2, tx, ty, sp) => { const dx = tx - o2.x, dy = ty - o2.y, d = Math.hypot(dx, dy); if (d > .3) { const m = Math.min(d, sp * dt); o2.x += dx / d * m; o2.y += dy / d * m; } };
      go(ref, clamp(ball.x - dir[att] * 7, 8, W - 8), clamp(ball.y + (ball.y < H / 2 ? 9 : -9), 6, H - 6), state === 'PLAYING' ? 7.2 : 4);
      go(ars[0], offsideLineX(true), H + .75, 8.5); go(ars[1], offsideLineX(false), -.75, 8.5);
    }
    const locked = p => p === holder || (beat && (beat.k === 'pass' || beat.k === 'carry') && beat.to === p);
    function movePlayers(dt) {
      const nowMs = performance.now();
      ['h', 'a'].forEach(s => live(s).forEach(p => { if (locked(p) && beat && beat.k !== 'result') return; if (p.stunUntil && nowMs < p.stunUntil) return; const sp = Math.min(p.sp || JOG, 10) * dt, dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy); if (d > .01) { const m = Math.min(d, sp); p.x += dx / d * m; p.y += dy / d * m; } if (p.run && Math.hypot(p.run.x - p.x, p.run.y - p.y) < .4 && !(beat && beat.k === 'result')) p.run = null; }));
      const all = live('h').concat(live('a'));
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const A = all[i], B = all[j], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || .01; const MIN = state === 'PLAYING' || state === 'CARD_SHOWN' ? 3.1 : 2.1; if (d < MIN && !(A.wall && B.wall)) { const m = (MIN - d) / 2 * .7, ux = dx / d, uy = dy / d; /* ayrışma kuvveti: daireler üst üste binmez */ if (!locked(A)) { A.x -= ux * m; A.y -= uy * m; } if (!locked(B)) { B.x += ux * m; B.y += uy * m; } } }
      P.h.concat(P.a).forEach(p => { p.x = clamp(p.x, -2, W + 2); p.y = clamp(p.y, -1.5, H + 1.5); });
      updateOfficials(dt);
    }
    function tick(ts) {
      // Request every refresh (60 fps on a 60 Hz display); the crowd layer is cached.
      const dt = paused ? 0 : Math.min(.05, (ts - (last || ts)) / 1000) * speed; last = ts;
      if (!paused) updateMatch(ts, dt);
      if (diagnostics && ts - lastSample >= 120) { lastSample = ts; diagnostics.frames.push({ time: ts, clip: seg, beat: beat && beat.k, state, ball: { x: ball.x, y: ball.y }, players: P.h.concat(P.a).map(p => ({ x: p.x, y: p.y, name: p.name, off: p.off })) }); if (diagnostics.frames.length > 1500) diagnostics.frames.shift(); }
      draw();
      if (!closed && (LIVE || ci < clips.length)) raf = requestAnimationFrame(tick);
    }
    function draw() {
      if (diagnostics) diagnostics.renderFrames++;
      const s = SC;
      const now = performance.now();
      if (now-stadiumFrameAt>=95) {
        ctx=stadiumCtx;
        if(vert)ctx.setTransform(0,s,-s,0,(H+STAND)*s,STAND*s);
        else ctx.setTransform(s,0,0,s,STAND*s,STAND*s);
        drawStadium(now);stadiumFrameAt=now;stadiumPaints++;
        if (diagnostics) diagnostics.stadiumDraws=stadiumPaints;
      }
      ctx=screenCtx;ctx.setTransform(1,0,0,1,0,0);
      ctx.drawImage(stadiumBuffer,0,0);
      if(vert)ctx.setTransform(0,s,-s,0,(H+STAND)*s,STAND*s);
      else ctx.setTransform(s,0,0,s,STAND*s,STAND*s);
      for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#2f8f3a' : '#2a8434'; ctx.fillRect(i * W / 12, 0, W / 12, H); }
      const lg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 70); lg.addColorStop(0, 'rgba(255,255,255,.06)'); lg.addColorStop(1, 'rgba(0,0,0,.18)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = .28;
      ctx.strokeRect(.5, .5, W - 1, H - 1); ctx.beginPath(); ctx.moveTo(W / 2, .5); ctx.lineTo(W / 2, H - .5); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 9.15, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, H / 2, .35, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      [[.5, 1], [W - .5, -1]].forEach(([x, d]) => { ctx.strokeRect(d > 0 ? x : x - 16.5, H / 2 - 20.16, 16.5, 40.32); ctx.strokeRect(d > 0 ? x : x - 5.5, H / 2 - 9.16, 5.5, 18.32); ctx.beginPath(); ctx.arc(x + d * 11, H / 2, .3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + d * 11, H / 2, 9.15, d > 0 ? -.93 : Math.PI - .93, d > 0 ? .93 : Math.PI + .93); ctx.stroke();
        // file: çizginin dışında, ağ desenli; gol olduğunda topun çarptığı noktadan esneyip dalgalanır
        const gx0 = d > 0 ? x - .5 - 2.2 : x + .5, gx1 = gx0 + 2.2; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(gx0, GY0, 2.2, GY1 - GY0);
        const nh = net[d > 0 ? 'L' : 'R'], tau = nh ? (now - nh.t) / 1000 : 9, amp = nh && tau < 1.9 ? nh.v * Math.exp(-2.4 * tau) * Math.cos(tau * 15) : 0, outw = d > 0 ? -1 : 1;
        const bul = (yy, fr) => amp ? outw * amp * (.25 + fr * .75) * Math.exp(-Math.pow((yy - nh.y) / 1.7, 2)) : 0;
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = .07;
        for (let yy = GY0; yy <= GY1 + .01; yy += .45) { ctx.beginPath(); for (let i2 = 0; i2 <= 5; i2++) { const fr = i2 / 5, xx = (d > 0 ? gx1 - fr * 2.2 : gx0 + fr * 2.2) + bul(yy, fr); if (i2) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); }
        for (let i2 = 0; i2 <= 5; i2++) { const fr = i2 / 5, bx3 = d > 0 ? gx1 - fr * 2.2 : gx0 + fr * 2.2; ctx.beginPath(); for (let yy = GY0, n2 = 0; yy <= GY1 + .01; yy += .45, n2++) { const xx = bx3 + bul(yy, fr); if (n2) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = .32; ctx.beginPath(); const lx = d > 0 ? x - .5 : x + .5, bx2 = d > 0 ? gx0 : gx1; ctx.moveTo(lx, GY0); ctx.lineTo(bx2, GY0); ctx.lineTo(bx2, GY1); ctx.lineTo(lx, GY1); ctx.stroke(); ctx.restore(); ctx.fillStyle = '#fff'; });
      // kavisli şut / frikik izi
      if (ball.trail.length > 1) { ctx.save(); for (let i = 1; i < ball.trail.length; i++) { const a = ball.trail[i - 1], b = ball.trail[i]; ctx.strokeStyle = `rgba(255,255,255,${(i / ball.trail.length) * .75})`; ctx.lineWidth = .18 + (i / ball.trail.length) * .35; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } ctx.restore(); }
      // duran top çizgisi
      if (fx.aim) { ctx.save(); ctx.setLineDash([.9, .7]); ctx.strokeStyle = 'rgba(255,240,120,.9)'; ctx.lineWidth = .22; ctx.beginPath(); ctx.moveTo(fx.aim.from.x, fx.aim.from.y); ctx.lineTo(fx.aim.to.x, fx.aim.to.y); ctx.stroke(); ctx.restore(); }
      if (plan && plan.wall && state === 'FREEKICK') { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([.5, .5]); ctx.lineWidth = .14; ctx.beginPath(); ctx.arc(ball.x, ball.y, 9.15, 0, 7); ctx.stroke(); ctx.restore(); }
      // ofsayt çizgisi: 1,5 sn boyunca kesikli çizgi
      if (fx.offside) { if (now > fx.offside.until) fx.offside = null; else { ctx.save(); ctx.setLineDash([1.3, .9]); ctx.lineDashOffset = -now / 60; ctx.strokeStyle = 'rgba(255,214,10,.95)'; ctx.lineWidth = .34; ctx.beginPath(); ctx.moveTo(fx.offside.x, 0); ctx.lineTo(fx.offside.x, H); ctx.stroke(); ctx.restore(); } }
      // hakemler: orta hakem ve bayraklı iki yan hakem
      [[ref, 1.12, 0], [ars[0], .95, 1], [ars[1], .95, 1]].forEach(([r, rad, ar]) => {
        ctx.beginPath(); ctx.arc(r.x + .2, r.y + .3, rad, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 7); ctx.fillStyle = '#15171b'; ctx.fill(); ctx.lineWidth = .2; ctx.strokeStyle = '#ffe14d'; ctx.stroke();
        if (ar) { const raised = r.flag > now, inw = r.y < 0 ? 1 : -1, fx0 = r.x + .65, fy0 = r.y + inw * (raised ? 1.7 : .5), fw = raised ? 1.5 : .9, fh = raised ? .96 : .6;
          ctx.strokeStyle = '#111'; ctx.lineWidth = .1; ctx.beginPath(); ctx.moveTo(r.x + .4, r.y); ctx.lineTo(fx0, fy0); ctx.stroke();
          ctx.fillStyle = '#ff3b30'; ctx.fillRect(fx0, fy0 - fh / 2, fw, fh); ctx.fillStyle = '#ffd60a'; ctx.fillRect(fx0, fy0 - fh / 2, fw / 2, fh / 2); ctx.fillRect(fx0 + fw / 2, fy0, fw / 2, fh / 2); }
      });
      // oyuncular
      ['h', 'a'].forEach(sd => vis(sd).forEach(p => {
        ctx.globalAlpha = p.leaving ? .62 : 1;
        const col = colOf(p), dv = p.dive && now - p.dive.t < p.dive.dur + 650 ? p.dive : null;
        if (dv) { // kaleci uzanışı: gövde atlayış yönünde uzar, eldivenler uçta
          const k = clamp((now - dv.t) / dv.dur, 0, 1), ext = 1 + Math.sin(k * Math.PI * .5) * 1.25, cx = (ext - 1) * 1.1;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(dv.a);
          ctx.beginPath(); ctx.ellipse(cx + .3, .3, 1.55 * ext, 1.2, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx, 0, 1.55 * ext, 1.15, 0, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = .22; ctx.strokeStyle = lum(col) > 150 ? '#222' : '#fff'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 1.55 * ext, -.45, .42, 0, 7); ctx.arc(cx + 1.55 * ext, .45, .42, 0, 7); ctx.fill();
          ctx.restore(); return;
        }
        ctx.beginPath(); ctx.arc(p.x + .25, p.y + .35, 1.55, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.55, 0, 7); ctx.fillStyle = col; ctx.fill();
        const tm = sd === 'h' ? o.home : o.away, kit = tm.kit, k2 = tm.c2;
        if (p.pos !== 'KL' && kit && kit !== 'duz' && k2 && !(sd === 'a' && ac !== (o.away.c1 || ac))) { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 1.55, 0, 7); ctx.clip(); ctx.fillStyle = k2;
          // ekranda dikey görünsün: dikey sahada eksenler döner
          const V = (a, b, w, h) => vert ? ctx.fillRect(p.x + b, p.y + a, h, w) : ctx.fillRect(p.x + a, p.y + b, w, h);
          if (kit === 'dikey') { V(-1.05, -2, .5, 4); V(.15, -2, .5, 4); } else if (kit === 'ince') { [-1, -.35, .3, .95].forEach(a => V(a, -2, .14, 4)); } else if (kit === 'yatay') { V(-2, -.95, 4, .55); V(-2, .4, 4, .55); }
          else if (kit === 'yarim') V(0, -2, 2, 4); else if (kit === 'bant') V(-2, -.45, 4, .7); else if (kit === 'kol') { ctx.lineWidth = .7; ctx.strokeStyle = k2; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, 7); ctx.stroke(); }
          else if (kit === 'capraz') { ctx.beginPath(); ctx.moveTo(p.x - 2, p.y - 1.2); ctx.lineTo(p.x - 1.2, p.y - 2); ctx.lineTo(p.x + 2, p.y + 1.2); ctx.lineTo(p.x + 1.2, p.y + 2); ctx.fill(); }
          ctx.restore(); }
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.55, 0, 7); ctx.lineWidth = .22; ctx.strokeStyle = lum(col) > 150 ? '#222' : '#fff'; ctx.stroke();
      }));
      // yazılar ekran koordinatında (döndürülmüş sahada da düz okunur)
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 1;
      ['h', 'a'].forEach(sd => vis(sd).forEach(p => { ctx.globalAlpha = p.leaving ? .62 : 1; const col = colOf(p), [X, Y] = proj(p.x, p.y);
        ctx.font = `bold ${1.6 * SC}px system-ui,sans-serif`; const tm = sd === 'h' ? o.home : o.away, striped = p.pos !== 'KL' && tm.kit && tm.kit !== 'duz';
        if (striped) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(p.num, X, Y + 1); ctx.fillStyle = '#fff'; } else ctx.fillStyle = lum(col) > 150 ? '#111' : '#fff'; ctx.fillText(p.num, X, Y + 1);
        // dairenin altında ince kondisyon barı; kart gören oyuncunun üst köşesinde kart ikonu
        const bw = 3 * SC, bh = .36 * SC, by = Y + 1.95 * SC; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(X - bw / 2 - 1, by - 1, bw + 2, bh + 2); ctx.fillStyle = p.stam > 65 ? '#59e13b' : p.stam > 40 ? '#f4c20d' : '#e5484d'; ctx.fillRect(X - bw / 2, by, bw * p.stam / 100, bh);
        if (p.card) { const cx = X + .95 * SC, cy = Y - 2.3 * SC; ctx.fillStyle = p.card === 'R' ? '#d0021b' : '#f8d000'; ctx.fillRect(cx, cy, .82 * SC, 1.16 * SC); ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.strokeRect(cx, cy, .82 * SC, 1.16 * SC); }
      }));
      ctx.globalAlpha = 1;
      // top sahibi / hedef oyuncunun adı
      // isim etiketi her zaman topla o an ilgilenen oyuncuyu gösterir (top kapılırken eski oyuncuda takılı kalmaz)
      const lab = (beat && beat.k === 'lose' && beat.by) || holder || (beat && (beat.k === 'shot' ? (beat.shooter || (plan && plan.shooter)) : beat.k === 'pass' || beat.k === 'carry' ? beat.to : null));
      if (diagnostics) diagnostics.label = lab ? lab.name : null;
      if (lab) { const t = surname(lab.name), [X, Y] = proj(lab.x, lab.y); ctx.font = `600 ${1.8 * SC}px system-ui,sans-serif`; const w = ctx.measureText(t).width + 14; ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(X - w / 2, Y - 46, w, 24); ctx.fillStyle = '#fff'; ctx.fillText(t, X, Y - 34); }
      // kart simgeleri
      fx.cards = fx.cards.filter(c => now - c.t < 2200); fx.cards.forEach(c => { const [X, Y] = proj(c.p.x, c.p.y), up = Math.min(1, (now - c.t) / 250); ctx.save(); ctx.translate(X + 18, Y - 30 - up * 14); ctx.rotate(.18); ctx.fillStyle = c.red ? '#d0021b' : '#f8d000'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.fillRect(-9, -13, 18, 26); ctx.strokeRect(-9, -13, 18, 26); ctx.restore(); });
      // aksiyon baloncukları
      fx.bubbles = fx.bubbles.filter(b => now - b.t < 2000); fx.bubbles.forEach(b => { const [X, Y] = proj(b.x, b.y), a = Math.min(1, (2000 - (now - b.t)) / 400), rise = Math.min(1, (now - b.t) / 300) * 18;
        ctx.save(); ctx.globalAlpha = a; ctx.font = `800 ${2.1 * SC}px system-ui,sans-serif`; const w = ctx.measureText(b.txt).width + 28, bx = clamp(X, w / 2 + 6, cv.width - w / 2 - 6), by = Math.max(40, Y - 70 - rise);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = b.col; ctx.lineWidth = 4; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx - w / 2, by - 22, w, 44, 22); else ctx.rect(bx - w / 2, by - 22, w, 44); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - 8, by + 20); ctx.lineTo(clamp(X, bx - 30, bx + 30), by + 36); ctx.lineTo(bx + 8, by + 20); ctx.fill(); ctx.fillStyle = b.col; ctx.fillText(b.txt, bx, by + 1); ctx.restore(); });
      // ekran titremesi
      cv.style.transform = now < fx.shakeUntil ? `translate(${(Math.random() - .5) * 9}px,${(Math.random() - .5) * 7}px)` : '';
      if (vert) ctx.setTransform(0, s, -s, 0, (H+STAND)*s, STAND*s); else ctx.setTransform(s, 0, 0, s, STAND*s, STAND*s);
      // top
      drawPitchFx(now);
      // top: gölge yerde kalır, yükseklikle büyüyüp solar; top yükseldikçe büyür ve gölgesinden ayrılır
      const bz = Math.min(ball.z, 9), sr = .62 + bz * .13;
      ctx.beginPath(); ctx.ellipse(ball.x - up.x * .22 + bz * .1, ball.y - up.y * .22 + bz * .1, sr, sr * .82, 0, 0, 7); ctx.fillStyle = `rgba(0,0,0,${Math.max(.1, .34 - bz * .028)})`; ctx.fill();
      const bxx = ball.x + up.x * bz * .62, byy = ball.y + up.y * bz * .62, brr = .7 + bz * .1;
      ctx.beginPath(); ctx.arc(bxx, byy, brr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = .15; ctx.strokeStyle = '#111'; ctx.stroke();
      ctx.beginPath(); ctx.arc(bxx - brr * .22, byy - brr * .22, brr * .27, 0, 7); ctx.fillStyle = 'rgba(20,20,20,.7)'; ctx.fill();
      drawConfetti(); drawSkyFx(now);
    }
    /* --------- stadyum: tribün, taraftar, reklam panoları, ışıklar --------- */
    const SEAT0 = 3.6, fans = [], groups = new Map(), confetti = [], flagPoles = [];
    const homeC2 = o.home.c2 && cdist(o.home.c2, hc) > 60 ? o.home.c2 : '#ffffff', awayC2 = o.away.c2 && cdist(o.away.c2, ac) > 60 ? o.away.c2 : '#ffffff';
    const isTS = /trabzonspor/i.test(homeName), tifoText = homeName.toLocaleUpperCase('tr-TR'), tifoStart = performance.now();
    const coach = { h: { arm: 0, x: 0, y: 0 }, a: { arm: 0, x: 0, y: 0 } };
    const light = c => lum(c) < 90 ? '#ffffff' : c;
    const ledWords = [[tifoText, light(hc), 0], ['BABA.', '#ff7a3d', 24], [String(o.away.name || '').toLocaleUpperCase('tr-TR'), light(ac), 34], ['LİMAN LOJİSTİK', '#7fd3ff', 58], ['KARADENİZ ENERJİ', '#b6f09c', 76], ['DRAFT · KARİYER', '#ffd166', 96]], ledSpan = 116;
    let show61At = 0, show61Done = false, show61Seats = [], smokeSrc = [], lastFx = 0, nightCv = null;
    const rain = wet ? Array.from({ length: 95 }, () => ({ x: Math.random() * 1.1, y: Math.random(), l: .014 + Math.random() * .02, v: .9 + Math.random() * .7 })) : null;
    function minuteShow(m) { if (isTS && !show61Done && m >= 61) { show61Done = true; show61At = performance.now(); if (diagnostics) diagnostics.show61 = true; } }
    let cheer = null; // {side, t}
    (function buildCrowd() {
      const awayEnd = Math.random() < .5 ? 'L' : 'R';
      const pal = (c1, c2) => [c1, c1, c1, c1, c2 || '#d9d9d9', '#262c33', '#343a42', '#2c3238'];
      const hp = pal(hc, o.home.c2 && cdist(o.home.c2, hc) > 60 ? o.home.c2 : '#ffffff'), ap = pal(ac, o.away.c2 && cdist(o.away.c2, ac) > 60 ? o.away.c2 : '#ffffff');
      for (let x = -STAND + .5; x < W + STAND - .4; x += (vert ? 1.65 : 1.3)) for (let y = -STAND + .5; y < H + STAND - .4; y += (vert ? 1.65 : 1.3)) {
        if (x > -SEAT0 && x < W + SEAT0 && y > -SEAT0 && y < H + SEAT0) continue;
        if (Math.random() < .07) continue; // boş koltuk
        const away = awayEnd === 'R' ? (x > W + SEAT0 && y < H * .55) : (x < -SEAT0 && y > H * .45);
        const col = pick(away ? ap : hp), f = { x, y, side: away ? 'a' : 'h', ph: Math.random() * 6.28, ang: (Math.atan2(y - H / 2, x - W / 2) + Math.PI) / (2 * Math.PI) };
        fans.push(f); if (!groups.has(col)) groups.set(col, []); groups.get(col).push(f);
      }
      [8, 21, 47, 60].forEach(y => { [[-6.2, -1], [W + 6.2, 1]].forEach(([x, d]) => { const away = awayEnd === 'R' ? (x > W && y < H * .55) : (x < 0 && y > H * .45); flagPoles.push({ x, y, d, side: away ? 'a' : 'h' }); }); });
      const homeFans = fans.filter(f => f.side === 'h');
      show61Seats = Array.from({ length: 16 }, (_, i) => homeFans[Math.floor((i + .5) / 16 * homeFans.length)]).filter(Boolean);
      smokeSrc = flareSeats.length ? flareSeats : Array.from({ length: 9 }, () => homeFans[rnd(homeFans.length)]).filter(Boolean);
    })();
    /* --------- saha içi efektler: çim parçacıkları, meşale dumanı, fotoğrafçı flaşları --------- */
    function drawPitchFx(now) {
      const dtr = lastFx ? Math.min(.05, (now - lastFx) / 1000) : 0; lastFx = now;
      for (let i = grass.length - 1; i >= 0; i--) { const g = grass[i]; g.life -= dtr; if (g.life <= 0) { grass.splice(i, 1); continue; } g.x += g.vx * dtr; g.y += g.vy * dtr; g.vx *= .92; g.vy *= .92; ctx.globalAlpha = Math.min(1, g.life * 2); ctx.fillStyle = i % 3 ? '#57c063' : '#6b4f2a'; ctx.fillRect(g.x, g.y, .34, .34); }
      const smoky = (cheer && now - cheer.t < 5000) || bigHomeMatch || (show61At && now - show61At < 11000);
      if (smoky && smokeSrc.length && smoke.length < 44 && Math.random() < .3) { const s = (show61At && now - show61At < 11000 ? show61Seats : smokeSrc)[rnd(smokeSrc.length)] || smokeSrc[0]; smoke.push({ x: s.x, y: s.y, r: .8, life: 2.6, vx: .3 + Math.random() * .7, vy: -.3 - Math.random() * .6 }); }
      for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.life -= dtr; if (s.life <= 0) { smoke.splice(i, 1); continue; } s.x += s.vx * dtr; s.y += s.vy * dtr; s.r += dtr * 1.1; ctx.globalAlpha = (s.life / 2.6) * .2; ctx.fillStyle = '#dcdcd4'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
      for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i], el = now - f.t; if (el < 0) continue; if (el > 150) { flashes.splice(i, 1); continue; } const r = 2.6 * (1 - el / 150) + .6, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2); }
      ctx.globalAlpha = 1;
    }
    /* --------- hava ve ışık: gece maçında spot ışığı huzmeleri, yağmur --------- */
    function buildNight() {
      nightCv = document.createElement('canvas'); nightCv.width = cv.width; nightCv.height = cv.height; const n = nightCv.getContext('2d');
      n.fillStyle = 'rgba(3,8,26,.4)'; n.fillRect(0, 0, cv.width, cv.height);
      n.globalCompositeOperation = 'destination-out';
      [[W * .25, H * .3], [W * .75, H * .3], [W * .25, H * .7], [W * .75, H * .7], [W / 2, H / 2]].forEach(([x, y]) => { const [X, Y] = proj(x, y), R = 36 * SC, g = n.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = g; n.fillRect(X - R, Y - R, R * 2, R * 2); });
      n.globalCompositeOperation = 'lighter';
      [[-STAND + 1.5, -STAND + 1.5, W * .3, H * .34], [W + STAND - 1.5, -STAND + 1.5, W * .7, H * .34], [-STAND + 1.5, H + STAND - 1.5, W * .3, H * .66], [W + STAND - 1.5, H + STAND - 1.5, W * .7, H * .66]].forEach(([x, y, tx, ty]) => {
        const [X, Y] = proj(x, y), [TX, TY] = proj(tx, ty), a = Math.atan2(TY - Y, TX - X), L = Math.hypot(TX - X, TY - Y) * 1.2, g = n.createLinearGradient(X, Y, TX, TY); g.addColorStop(0, 'rgba(255,250,220,.22)'); g.addColorStop(1, 'rgba(255,250,220,0)');
        n.fillStyle = g; n.beginPath(); n.moveTo(X, Y); n.lineTo(X + Math.cos(a - .19) * L, Y + Math.sin(a - .19) * L); n.lineTo(X + Math.cos(a + .19) * L, Y + Math.sin(a + .19) * L); n.fill(); });
    }
    let lastSky = 0;
    function drawSkyFx(now) {
      if (!night && !rain) return;
      const dtr = lastSky ? Math.min(.05, (now - lastSky) / 1000) : 0; lastSky = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (night) { if (!nightCv) buildNight(); ctx.drawImage(nightCv, 0, 0); }
      if (rain) { ctx.strokeStyle = 'rgba(205,225,255,.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (const d of rain) { d.y += d.v * dtr; d.x -= d.v * dtr * .16; if (d.y > 1) { d.y = -.04; d.x = Math.random() * 1.1; } const X = d.x * cv.width, Y = d.y * cv.height; ctx.moveTo(X, Y); ctx.lineTo(X - d.l * cv.width * .16, Y + d.l * cv.height); } ctx.stroke(); }
      if (vert) ctx.setTransform(0, SC, -SC, 0, (H + STAND) * SC, STAND * SC); else ctx.setTransform(SC, 0, 0, SC, STAND * SC, STAND * SC);
    }
    function drawStadium(now) {
      const t = now / 1000;
      // dış tribün zemini ve basamaklar
      ctx.fillStyle = '#1c2228'; ctx.fillRect(-STAND, -STAND, W + STAND * 2, H + STAND * 2);
      for (let r = SEAT0; r < STAND; r += 1.9) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(-r - .95, -r - .95, W + 2 * r + 1.9, .95); ctx.fillRect(-r - .95, H + r, W + 2 * r + 1.9, .95); ctx.fillRect(-r - .95, -r, .95, H + 2 * r); ctx.fillRect(W + r, -r, .95, H + 2 * r); }
      // merdiven boşlukları
      ctx.fillStyle = '#14181d'; for (let x = 8; x < W; x += 16) { ctx.fillRect(x, -STAND, .7, STAND - SEAT0); ctx.fillRect(x, H + SEAT0, .7, STAND - SEAT0); } for (let y = 10; y < H; y += 16) { ctx.fillRect(-STAND, y, STAND - SEAT0, .7); ctx.fillRect(W + SEAT0, y, STAND - SEAT0, .7); }
      // taraftarlar: sürekli kıpırdayan noktalar; Meksika dalgası yalnızca ev sahibi öndeyken ya da baskı kurarken döner
      const since = cheer ? (now - cheer.t) / 1000 : 99, wave = (t * .09) % 1;
      const waveOn = !(cheer && since < 6) && (score[0] > score[1] || momentum >= 62); // gol kutlaması bitince dalga yeniden başlayabilir
      const homeAttack = att === 'h' && state === 'PLAYING' && AF(ball).x > 68;
      groups.forEach((list, col) => {
        ctx.fillStyle = col; ctx.beginPath();
        for (const f of list) {
          let sz = .56 + Math.sin(t * 1.3 + f.ph) * .05, dy = Math.sin(t * 2.2 + f.ph) * .05;
          if (cheer && since < 5 && f.side === cheer.side) sz += Math.abs(Math.sin(t * 10 + f.ph)) * .34 * (1 - since / 5) + .08;
          else if (cheer && since < 3 && f.side !== cheer.side) sz -= .12;
          else if (waveOn) { const dw = Math.abs(f.ang - wave), dd = Math.min(dw, 1 - dw); if (dd < .045) { const k = 1 - dd / .045; sz += k * .34; dy -= k * .3; } }
          else if (homeAttack && f.side === 'h') sz += Math.abs(Math.sin(t * 6 + f.ph)) * .1;
          ctx.rect(f.x - sz / 2, f.y + dy - sz / 2, sz, sz);
        }
        ctx.fill();
      });
      if (diagnostics) { diagnostics.wave = waveOn; diagnostics.scarves = homeAttack; }
      // atak anında açılan atkılar
      if (homeAttack || (cheer && since < 5 && cheer.side === 'h')) {
        for (let i = 0; i < fans.length; i += 6) { const f = fans[i]; if (f.side !== 'h') continue; const w = 1.5 + Math.sin(t * 5 + f.ph) * .14; ctx.fillStyle = hc; ctx.fillRect(f.x - w / 2, f.y - .66, w / 2, .24); ctx.fillStyle = homeC2; ctx.fillRect(f.x, f.y - .66, w / 2, .24); }
      }
      // kale arkalarında sürekli dalgalanan kulüp bayrakları
      flagPoles.forEach((fl, i) => {
        const cA = fl.side === 'h' ? hc : ac, cB = fl.side === 'h' ? homeC2 : awayC2, wv = k => Math.sin(t * 5 + i * 1.3 + k * .7) * .3 * (k / 6);
        ctx.fillStyle = '#d7dbe0'; ctx.fillRect(fl.x - .09, fl.y - 1.7, .18, 3.4);
        for (let k = 0; k < 6; k++) { const x0 = fl.x + fl.d * k * .6, x1 = x0 + fl.d * .62; ctx.fillStyle = k % 2 ? cB : cA; ctx.beginPath(); ctx.moveTo(x0, fl.y - 1.6 + wv(k)); ctx.lineTo(x1, fl.y - 1.6 + wv(k + 1)); ctx.lineTo(x1, fl.y + .3 + wv(k + 1)); ctx.lineTo(x0, fl.y + .3 + wv(k)); ctx.fill(); }
      });
      // maç başı koreografisi (tifo): ev sahibi tribününde kulüp renklerinde kartonlar ve dev pankart
      const tEl = (now - tifoStart) / 1000;
      if (tEl < 8) {
        const al = clamp((8 - tEl) / 1.4, 0, 1) * clamp(tEl / .5, 0, 1), y0 = -STAND + 1.3, hh = STAND - SEAT0 - 1.5, cols = 36, cw = W / cols, rise = clamp(tEl / 1.6, 0, 1);
        ctx.save(); ctx.globalAlpha = al;
        for (let i = 0; i < cols; i++) { const lift = clamp(rise * cols * .75 - Math.abs(i - cols / 2), 0, 1); if (lift <= 0) continue; ctx.fillStyle = (i + Math.floor(tEl * 1.5)) % 2 ? homeC2 : hc; ctx.fillRect(i * cw + .12, y0 + hh * (1 - lift), cw - .24, hh * lift); }
        const bw = Math.min(46, W * .5); ctx.fillStyle = 'rgba(8,12,16,.92)'; ctx.fillRect(W / 2 - bw / 2, y0 + hh * .26, bw, hh * .5); ctx.strokeStyle = homeC2; ctx.lineWidth = .2; ctx.strokeRect(W / 2 - bw / 2, y0 + hh * .26, bw, hh * .5);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 2.2px system-ui,Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tifoText, W / 2, y0 + hh * .52, bw - 3);
        ctx.restore(); if (diagnostics) diagnostics.tifo = true;
      }
      // 61. dakika: Trabzonspor iç saha şovu — telefon flaşları, bordo-mavi meşaleler, "BİZE HER YER TRABZON!"
      if (show61At && now - show61At < 11000) {
        const e = (now - show61At) / 1000, al = clamp(e / .6, 0, 1) * clamp((11 - e) / 1.5, 0, 1);
        ctx.save(); ctx.globalAlpha = al;
        ctx.fillStyle = '#fff'; for (let i = 0; i < 190; i++) { const f = fans[rnd(fans.length)]; if (f.side === 'h') ctx.fillRect(f.x - .19, f.y - .19, .38, .38); }
        show61Seats.forEach((f, i) => { const rr = 2.6 * (.8 + .25 * Math.sin(t * 7 + i)), g = ctx.createRadialGradient(f.x, f.y, .08, f.x, f.y, rr), c = i % 2 ? '92,184,240' : '168,24,62'; g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.25, `rgba(${c},.85)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(f.x - rr, f.y - rr, rr * 2, rr * 2); });
        ctx.font = 'bold 2px system-ui,Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        [[W / 2, -STAND + 4.4], [W / 2, H + STAND - 4.4]].forEach(([x, y]) => { ctx.fillStyle = 'rgba(88,12,36,.95)'; ctx.fillRect(x - 24, y - 1.9, 48, 3.8); ctx.strokeStyle = '#5cb8f0'; ctx.lineWidth = .22; ctx.strokeRect(x - 24, y - 1.9, 48, 3.8); ctx.fillStyle = '#fff'; ctx.fillText('BİZE HER YER TRABZON!', x, y + .1, 45); });
        ctx.restore();
      }
      // gol sevinci: meşaleler ve flaşlar
      if (cheer && since < 5) {
        const mine = fans.filter((f, i) => f.side === cheer.side && i % 97 === 0);
        mine.forEach((f, i) => { const r = 1.6 + Math.sin(t * 14 + i) * .4, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); g.addColorStop(0, 'rgba(255,230,160,.95)'); g.addColorStop(.35, 'rgba(255,70,30,.7)'); g.addColorStop(1, 'rgba(255,40,20,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2); });
        ctx.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { const f = fans[rnd(fans.length)]; ctx.fillRect(f.x - .25, f.y - .25, .5, .5); }
      }
      // Important home matches: safe in-game flare effects and small chanting bubbles.
      if (bigHomeMatch) {
        for(const flare of flareSeats){
          const rr=2.3*(.8+.22*Math.sin(t*6+flare.phase));
          const g=ctx.createRadialGradient(flare.x,flare.y,.08,flare.x,flare.y,rr);
          g.addColorStop(0,'rgba(255,245,177,.95)');
          g.addColorStop(.25,'rgba(255,115,28,.72)');
          g.addColorStop(.65,'rgba(224,49,19,.26)');
          g.addColorStop(1,'rgba(220,38,15,0)');
          ctx.fillStyle=g;ctx.fillRect(flare.x-rr,flare.y-rr,rr*2,rr*2);
          ctx.fillStyle='#fff6c2';ctx.beginPath();ctx.arc(flare.x,flare.y,.2,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='rgba(210,210,200,.16)';
          ctx.beginPath();ctx.ellipse(flare.x+.6,flare.y-1.3,.85,1.55,-.25,0,Math.PI*2);ctx.fill();
        }
        const phrase=chants[Math.floor(t/3.5)%chants.length];
        ctx.font='bold 1.12px system-ui,Arial,sans-serif';
        ctx.textBaseline='middle';ctx.textAlign='center';
        for(const loc of [{x:18,y:-8},{x:57,y:H+4.4}]){
          const width=Math.min(43,Math.max(17,ctx.measureText(phrase).width+5));
          const bx=clamp(loc.x,2,W-width-2),by=loc.y;
          ctx.fillStyle='rgba(8,28,40,.92)';ctx.fillRect(bx,by,width,3.5);
          ctx.strokeStyle='rgba(197,243,215,.8)';ctx.lineWidth=.11;ctx.strokeRect(bx,by,width,3.5);
          ctx.fillStyle='#f5fff2';ctx.fillText(phrase,bx+width/2,by+1.8,width-3);
          ctx.beginPath();ctx.moveTo(bx+width*.34,by+3.5);ctx.lineTo(bx+width*.37,by+4.1);ctx.lineTo(bx+width*.4,by+3.5);ctx.fillStyle='#b4d8c7';ctx.fill();
        }
      }
      // tribün çatı gölgesi
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-STAND, -STAND, W + STAND * 2, 1.2); ctx.fillRect(-STAND, H + STAND - 1.2, W + STAND * 2, 1.2); ctx.fillRect(-STAND, -STAND, 1.2, H + STAND * 2); ctx.fillRect(W + STAND - 1.2, -STAND, 1.2, H + STAND * 2);
      // koşu bandı ve saha kenarı çimi
      ctx.fillStyle = '#3b3f45'; ctx.fillRect(-SEAT0, -SEAT0, W + SEAT0 * 2, H + SEAT0 * 2);
      ctx.fillStyle = '#236b2c'; ctx.fillRect(-2.4, -2.4, W + 4.8, H + 4.8);
      // kayan LED reklam panoları; golde tüm stadyum çevresinde yanıp sönen "GOOOL!"
      const goalLed = now - goalAt < 5200, blink = Math.floor(t * 6) % 2, ledCol = cheer && cheer.side === 'a' ? ac : hc;
      ctx.fillStyle = goalLed ? (blink ? ledCol : '#f5f7fa') : '#090d12';
      ctx.fillRect(0, -3.3, W, .9); ctx.fillRect(0, H + 2.4, W, .9);
      [[-3.3, 0], [W + 2.4, 0]].forEach(([x]) => { ctx.fillRect(x, 0, .9, GY0 - 2); ctx.fillRect(x, GY1 + 2, .9, H - GY1 - 2); });
      ctx.save(); ctx.beginPath(); ctx.rect(0, -3.3, W, .9); ctx.rect(0, H + 2.4, W, .9); ctx.clip();
      ctx.font = 'bold .62px system-ui,Arial,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const off = (t * 3.4) % ledSpan;
      for (let x = -off - ledSpan; x < W + ledSpan; x += ledSpan) ledWords.forEach(([w, col, dx]) => { ctx.fillStyle = goalLed ? (blink ? '#fff' : '#111') : col; const s2 = goalLed ? T('GOOOL!', 'GOAL!') : w; ctx.fillText(s2, x + dx, -2.83); ctx.fillText(s2, W - x - dx - 8, H + 2.87); });
      ctx.restore();
      // yan panolar: akan ışık şeritleri
      for (let y = (t * 4) % 3; y < H; y += 3) { if (y > GY0 - 3 && y < GY1 + 2) continue; ctx.fillStyle = goalLed ? (blink ? '#fff' : ledCol) : 'rgba(255,255,255,.55)'; ctx.fillRect(-3.15, y, .6, .9); ctx.fillRect(W + 2.55, H - y - .9, .6, .9); }
      if (diagnostics) diagnostics.led = goalLed ? 'goal' : 'scroll';
      // teknik alan ve yedek kulübesi: teknik direktör kenarda yürür, komut verince elini kaldırır; golde yedekler ayağa fırlar
      [['h', W / 2 - 15.5], ['a', W / 2 + 6.5]].forEach(([sd, x]) => {
        const col = sd === 'h' ? hc : ac, c = coach[sd], jump = cheer && since < 4 && cheer.side === sd;
        ctx.fillStyle = 'rgba(200,230,255,.3)'; ctx.fillRect(x, H + 1.3, 9, 1.05);
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([.4, .3]); ctx.lineWidth = .08; ctx.strokeRect(x - .5, H + .22, 10, 1.02); ctx.setLineDash([]);
        for (let k = 0; k < 7; k++) { const jy = jump ? -Math.abs(Math.sin(t * 9 + k)) * .9 - .45 : 0; ctx.fillStyle = col; ctx.fillRect(x + .5 + k * 1.18, H + 1.55 + jy, .62, .62); ctx.fillStyle = '#f2d2b0'; ctx.fillRect(x + .66 + k * 1.18, H + 1.42 + jy, .3, .2); }
        const cx = x + 4.5 + Math.sin(t * .45 + (sd === 'h' ? 0 : 2)) * 3.6, cy = H + .74, arm = c.arm > now || jump;
        ctx.fillStyle = '#14161a'; ctx.beginPath(); ctx.arc(cx, cy, .52, 0, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = .16; ctx.stroke();
        if (arm) { ctx.strokeStyle = '#f2d2b0'; ctx.lineWidth = .18; ctx.beginPath(); ctx.moveTo(cx - .2, cy); ctx.lineTo(cx - .6, cy - 1 - Math.sin(t * 12) * .15); ctx.moveTo(cx + .2, cy); ctx.lineTo(cx + .6, cy - 1 - Math.cos(t * 12) * .15); ctx.stroke(); }
        c.x = cx; c.y = cy;
      });
      if (diagnostics) diagnostics.coach = { h: { x: coach.h.x, arm: coach.h.arm > now }, a: { x: coach.a.x, arm: coach.a.arm > now } };
      // ışık direkleri
      [[-STAND + 1.5, -STAND + 1.5], [W + STAND - 1.5, -STAND + 1.5], [-STAND + 1.5, H + STAND - 1.5], [W + STAND - 1.5, H + STAND - 1.5]].forEach(([x, y]) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 26); g.addColorStop(0, 'rgba(255,255,230,.32)'); g.addColorStop(1, 'rgba(255,255,230,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26, y - 26, 52, 52);
        ctx.fillStyle = '#e9eef2'; ctx.fillRect(x - 1, y - 1, 2, 2); });
    }
    function startCheer(side) {
      cheer = { side, t: performance.now() };
      const cols = side === 'h' ? [hc, o.home.c2 || '#fff', '#fff'] : [ac, o.away.c2 || '#fff', '#fff'];
      const gx = dir[side] > 0 ? W + 5 : -5;
      for (let i = 0; i < 160; i++) confetti.push({ x: gx + (Math.random() - .5) * 8, y: Math.random() * H, vx: -dir[side] * (2 + Math.random() * 6), vy: (Math.random() - .5) * 4, life: 2.5 + Math.random() * 2, rot: Math.random() * 6, col: pick(cols) });
      for (let i = 0; i < 80; i++) { const f = fans[rnd(fans.length)]; if (f.side === side) confetti.push({ x: f.x, y: f.y, vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, life: 2 + Math.random() * 2, rot: 0, col: pick(cols) }); }
    }
    let lastConf = 0;
    function drawConfetti() {
      const now = performance.now(), dt = lastConf ? Math.min(.05, (now - lastConf) / 1000) : 0; lastConf = now;
      for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.life -= dt; if (c.life <= 0) { confetti.splice(i, 1); continue; } c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= .985; c.vy *= .985; c.rot += dt * 6;
        ctx.globalAlpha = Math.min(1, c.life); ctx.fillStyle = c.col; const w = .35 + Math.abs(Math.sin(c.rot)) * .35; ctx.fillRect(c.x - w / 2, c.y - .2, w, .4); }
      ctx.globalAlpha = 1;
    }


    /* --------- kontroller --------- */
    q('[data-k=next]').onclick = () => {
      cancelAnimationFrame(raf);
      const c = clips[ci];
      if (c) { // atlanan pozisyonun sonucunu uygula: gol skora, kırmızı kart sahaya
        if (c.out === 'goal' && !c.counted) { c.counted = true; if (c.side === 'h') score[0]++; else score[1]++; q('.m2d-sc').textContent = score[0] + ' – ' + score[1]; }
        if (c.kind === 'red') { const f = (plan && plan.fouler) || find(c.side === 'h' ? 'a' : 'h', c.fouler); if (f) startLeaving(f); }
      }
      beats = []; beat = null; nextClip(); if (ci < clips.length) { last = 0; raf = requestAnimationFrame(tick); }
    };
    q('[data-k=end]').onclick = () => { ci = clips.length; fullTime(); };
    q('[data-k=spd]').onclick = e => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; e.target.textContent = speed === 1 ? '⏩ 2x' : speed === 2 ? '⏩ 4x' : '▶ 1x'; };
    // hücum planı etiketleri (canlı maçta seçilen taktik)
    const tag = side => { const s = styleOf(side); return s !== 'dengeli' ? `<small class="m2d-style">📋 ${esc(STYLES()[s] || s)}</small>` : ''; };
    q('.m2d-tm').insertAdjacentHTML('beforeend', tag('h')); q('.m2d-tm.r').insertAdjacentHTML('afterbegin', tag('a'));
    if (LIVE) {
      // canlı kontrol nesnesi: kariyer metin maçı olayları buraya gönderir
      const api = {
        push(c, cb) { c.cb = cb; const cur = clips[ci]; if (cur && cur.kind === 'idle' && state !== 'PLAYING') { clips.splice(ci + 1, 0, c); cutIdle = true; } else if (cur && cur.kind === 'idle') { clips.splice(ci + 1, 0, c); beats = []; beat = null; nextClip(); } else { let i = clips.length; while (i > ci + 1 && clips[i - 1].kind === 'idle') i--; clips.splice(i, 0, c); } },
        busy: () => { const cur = clips[ci]; return !!(cur && cur.kind !== 'idle') || clips.slice(ci + 1).some(x => x.kind !== 'idle'); },
        setMin(m) { curMin = m; q('.m2d-min').textContent = m + "'"; applyMinute(m); },
        setMomentum(p) { momentum = clamp(p, 15, 85); },
        setSpeed(v) { speed = v; },
        setScore(h, a) { score = [h, a]; q('.m2d-sc').textContent = h + ' – ' + a; },
        sub(side, outName, inName, inPos, inNum, inCond) { const p = P[side].find(x => x.name === outName && !x.off); if (p) { usedNums[side].delete(p.num); p.name = inName; if (inPos) p.pos = inPos; p.num = freeNum(side, p.pos, inNum); p.card = null; p.sync = false; p.stam = clamp(inCond == null ? 100 : inCond, 15, 100); p.traits = typeof Traits !== 'undefined' ? Traits.of(inName, p.pos, 75) : []; bubble('↔ ' + surname(inName), p, '#111'); } },
        card(side, name, kind) { const p = P[side].find(x => x.name === name && !x.off); if (p) { p.card = kind === 'R' ? 'R' : 'Y'; fx.cards.push({ p, red: kind === 'R', t: performance.now() }); } },
        setStyle(side, st) { (side === 'h' ? o.home : o.away).style = st; },
        setPress(side, v) { pressHigh[side] = !!v; },
        setCond(side, map) { P[side].forEach(p => { if (map && map[p.name] != null) { p.stam = clamp(map[p.name], 5, 100); p.sync = true; } }); },
        shout(side, txt) { coach[side].arm = performance.now() + 2800; if (txt) coach[side].say = { txt, t: performance.now() }; },
        pause(v) { paused = !!v; last = 0; },
        halftime() { needReset = true; halfCut = true; lastGoalBy = null; pendingRestart = null; beats = []; beat = null; holder = null; if (plan) plan.stage = 'over'; setState('HALFTIME'); paused = true; atHalf = true; },
        // ikinci yarı: devre arası bayrağı ayrı tutulur; pause(false) önce çağrılsa bile santra mutlaka başlar
        resume() { if (atHalf) { atHalf = false; paused = false; last = 0; if (!beat) nextClip(); } else if (paused) { paused = false; last = 0; } },
        info: () => ({ wet, night, gk: Object.assign({}, gkCol), nums: { h: P.h.map(p => p.num), a: P.a.map(p => p.num) } }),
        sendOff(side, name) { const p = P[side].find(x => x.name === name); if (p) startLeaving(p); },
        end() { ended = true; },
        flush() { clips.forEach(fireShow); },
        close
      };
      nextClip(); raf = requestAnimationFrame(tick);
      return api;
    }
    if (!clips.length) { com(1, T('Maçta kayda değer bir pozisyon olmadı.', 'There were no notable chances in this match.')); fullTime(); return; }
    if (reduce) speed = 2;
    nextClip(); raf = requestAnimationFrame(tick);
  }
  return { show, STYLES, foulRestart, maxShotDistance };
})();
