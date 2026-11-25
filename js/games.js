"use strict";
/* =====================================================================
   BABA SAYFASI — şifreyle açılan yetişkin zekâ oyunları
   2048 · Sudoku · Mayın Tarlası · Blok Yığ
   Not: Şifre çocukların yanlışlıkla girmesini önlemek içindir; gerçek bir güvenlik değildir.
   ===================================================================== */
const App = (() => {
  const DEFAULT_HASH = '2d5een7ghm3', PIN_LEN = 6;      // 6 haneli şifre; eski 4 haneli şifreler geçersiz
  const cyrb = (str, seed = 0) => { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
  const hash = pin => cyrb('lale-ela:' + pin);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const storedHash = () => ls.get('baba_pin6_hash', null) || DEFAULT_HASH;
  let unlocked = false; try { unlocked = sessionStorage.getItem('baba_ok') === '1'; } catch (e) {}
  // misafir: sahibinin verdiği davet koduyla bu cihazda açılır
  const norm = n => String(n || '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
  const inviteCode = name => 'B-' + cyrb('baba-davet:' + norm(name)).slice(0, 6).toUpperCase();
  let guest = ls.get('baba_guest', null);
  if (guest && inviteCode(guest.name) !== guest.code) guest = null;
  /* davet bağlantısı (?davet=KOD&ad=AD ya da eski #davet=…): geçerliyse doğrudan davetli olarak açılır.
     Ana ekrana eklenen uygulama Safari'den ayrı hafıza kullandığı için davet adreste ve manifestte taşınır. */
  const fromUrl = () => { try { const s = new URLSearchParams(location.search), h = location.hash.match(/davet=([^&]+)&ad=([^&]+)/), c = s.get('davet') || (h && decodeURIComponent(h[1])), n = s.get('ad') || (h && decodeURIComponent(h[2])); return c && n ? { c: String(c).trim().toUpperCase(), n: String(n).trim().slice(0, 40) } : null; } catch (e) { return null; } };
  { const u = fromUrl(); if (u && !unlocked && inviteCode(u.n) === u.c && (!guest || guest.code !== u.c)) { guest = { name: u.n, code: u.c, at: Date.now() }; ls.set('baba_guest', guest); } }
  let manBase = null, manUrl = null;
  async function setManifest(start) {
    const link = document.querySelector('link[rel=manifest]'); if (!link) return;
    if (manUrl) { URL.revokeObjectURL(manUrl); manUrl = null; }
    if (!start) { link.setAttribute('href', 'manifest.webmanifest'); return; }
    try {
      if (!manBase) manBase = await (await fetch('manifest.webmanifest', { cache: 'no-cache' })).json();
      const dir = location.origin + location.pathname.replace(/[^/]*$/, ''), m = JSON.parse(JSON.stringify(manBase));
      m.start_url = start; m.scope = dir; (m.icons || []).forEach(i => { i.src = new URL(i.src, dir).href; });
      manUrl = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' })); link.setAttribute('href', manUrl);
    } catch (e) {}
  }
  let manFor = '';
  function guestUrl() {
    if (guest && !unlocked) {
      const q = '?davet=' + encodeURIComponent(guest.code) + '&ad=' + encodeURIComponent(guest.name);
      if (location.search !== q) history.replaceState(null, '', location.pathname + q + location.hash);
      if (manFor !== q) { manFor = q; setManifest(location.origin + location.pathname + q); }
    } else if (manFor) { manFor = ''; setManifest(null); }
  }
  const isOwner = () => unlocked, isGuest = () => !unlocked && !!guest, canIn = () => unlocked || !!guest;
  const OWNER_ONLY = ['is', 'erisim', 'ts'];
  const OWNER_GAMES = [];   // yalnız sahibin görüp oynayabildiği oyunlar
  const visibleGames = () => isOwner() ? GAMES : GAMES.filter(g => !OWNER_GAMES.includes(g.id));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const root = () => document.getElementById('view');
  let cleanup = [];
  const onLeave = f => cleanup.push(f);
  function leave() { cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = []; }
  const click = () => Snd.click();
  const blip = (f, d, v) => Snd.note(f, d || .08, 'triangle', v || .05);

  /* Full screen belongs to each football game, not the global app header.
     iOS browsers without an element Fullscreen API use an in-page fallback. */
  function footballFullscreen(page) {
    if (!page) return;
    const button = page.querySelector('[data-football-fullscreen]');
    if (!button) return;
    const nativeActive = () => document.fullscreenElement === page || document.webkitFullscreenElement === page;
    const fallbackActive = () => page.classList.contains('football-fullscreen-fallback');
    const active = () => nativeActive() || fallbackActive();
    const sync = () => {
      const on = active();
      const svg = d => '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:6px"><path d="' + d + '"/></svg>';
      button.innerHTML = on ? svg('M6 6l12 12M18 6L6 18') + T('Tam ekrandan çık', 'Exit full screen') : svg('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5') + T('Tam ekran', 'Full screen');
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', on ? T('Tam ekrandan çık', 'Exit full screen') : T('Tam ekran', 'Full screen'));
      button.title = button.getAttribute('aria-label');
    };
    const fallback = on => {
      page.classList.toggle('football-fullscreen-fallback', on);
      document.body.classList.toggle('football-fullscreen-open', on);
      sync();
    };
    const exit = () => {
      if (fallbackActive()) fallback(false);
      if (nativeActive()) {
        const quit = document.exitFullscreen || document.webkitExitFullscreen;
        if (quit) Promise.resolve(quit.call(document)).catch(() => {});
      }
    };
    button.addEventListener('click', async () => {
      click();
      if (active()) { exit(); sync(); return; }
      const request = page.requestFullscreen || page.webkitRequestFullscreen;
      if (request) {
        try {
          await Promise.resolve(request.call(page));
          if (nativeActive()) { sync(); return; }
        } catch (_) { /* Fall back on iOS / unsupported embedded browsers. */ }
      }
      fallback(true);
    });
    const onKeydown = e => { if (e.key === 'Escape' && fallbackActive()) exit(); };
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    onLeave(() => {
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      exit();
      document.body.classList.remove('football-fullscreen-open');
    });
    sync();
  }

  /* ---------------- PIN kilidi ---------------- */
  function pinPad(title, onOk, opts = {}) {
    const ov = document.createElement('div'); ov.className = 'bb-pin-ov';
    ov.innerHTML = `<div class="bb-pin"><div class="bb-lock">🔒</div><h3>${title}</h3><div class="bb-dots">${'<i></i>'.repeat(PIN_LEN)}</div><p class="bb-msg">${opts.msg || T('6 haneli şifreyi gir', 'Enter your 6-digit PIN')}</p>
      <div class="bb-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '✖', 0, '⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div></div>`;
    document.body.appendChild(ov);
    let v = ''; const dots = ov.querySelectorAll('.bb-dots i'), msg = ov.querySelector('.bb-msg');
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < v.length));
    const close = () => ov.remove();
    ov.querySelectorAll('.bb-keys button').forEach(b => b.onclick = () => {
      const k = b.dataset.k; click();
      if (k === '✖') { close(); if (opts.onCancel) opts.onCancel(); return; }
      if (k === '⌫') { v = v.slice(0, -1); paint(); return; }
      if (v.length >= PIN_LEN) return; v += k; paint();
      if (v.length === PIN_LEN) setTimeout(() => {
        const r = onOk(v);
        if (r === true) { close(); }
        else { ov.querySelector('.bb-pin').classList.add('bad'); msg.textContent = r || T('Şifre yanlış, tekrar dene', 'Wrong PIN, please try again'); setTimeout(() => ov.querySelector('.bb-pin').classList.remove('bad'), 450); v = ''; paint(); }
      }, 120);
    });
    const kd = e => { if (/^[0-9]$/.test(e.key)) ov.querySelector(`[data-k="${e.key}"]`).click(); else if (e.key === 'Backspace') ov.querySelector('[data-k="⌫"]').click(); else if (e.key === 'Escape') ov.querySelector('[data-k="✖"]').click(); };
    addEventListener('keydown', kd); const obs = new MutationObserver(() => { if (!ov.isConnected) { removeEventListener('keydown', kd); obs.disconnect(); } }); obs.observe(document.body, { childList: true });
  }
  function askOpen() {
    pinPad('BABA.', pin => {
      if (hash(pin) !== storedHash()) return T('Şifre yanlış, tekrar dene', 'Wrong PIN, please try again');
      unlocked = true; try { sessionStorage.setItem('baba_ok', '1'); } catch (e) {}
      render(); return true;
    });
  }
  function changePin() {
    pinPad(T('Yeni şifre', 'New PIN'), p1 => {
      setTimeout(() => pinPad(T('Yeni şifreyi tekrar gir', 'Enter the new PIN again'), p2 => { if (p1 !== p2) return T('İki şifre aynı değil', 'The two PINs don’t match'); ls.set('baba_pin6_hash', hash(p1)); toast(T('🔐 Şifre değiştirildi', '🔐 PIN changed')); return true; }), 50);
      return true;
    }, { msg: T('Bu cihazda kullanılacak yeni 6 haneli şifre', 'New 6-digit PIN for this device') });
  }
  function lock() { unlocked = false; try { sessionStorage.removeItem('baba_ok'); } catch (e) {} if (location.hash) location.hash = ''; else render(); }
  function guestOut() { guest = null; try { localStorage.removeItem('baba_guest'); } catch (e) {} history.replaceState(null, '', location.pathname); manFor = 'x'; guestUrl(); render(); }
  function toast(t) { const d = document.createElement('div'); d.className = 'bb-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }

  /* ---------------- menü ---------------- */
  const GAMES = [
    { id:'hayat-oyunu',name:['HAYAT. — Gerçek Yaşam','LIFE. — Life Simulator'],tags:[['Simülasyon','Simulation'],['Kariyer','Career'],['İlişkiler','Relationships']],best:()=>T('Kendi hikâyeni yaz','Write your story') },
    { id: 'futbol', name: ['Futbol — Tarafını Seç', 'Football — Pick Your Side'], tags: [['Draft', 'Draft'], ['Kariyer', 'Career'], ['2D maç', '2D match']], best: () => T('2 mod', '2 modes') },
    { id: 'career', name: ['Menajerlik Kariyeri', 'Manager Career'], tags: [['Kariyer', 'Career'], ['Transfer', 'Transfers'], ['Canlı maç', 'Live match']], best: () => { try { const s = JSON.parse(localStorage.getItem('baba_career_save')); return s ? T(`Sezon ${s.season} · H${Math.min(s.week + 1, 34)}`, `Season ${s.season} · W${Math.min(s.week + 1, 34)}`) : T('Yeni', 'New'); } catch (e) { return ''; } } },
    { id: 'draft', name: 'Süper Lig Draft', tags: [['Futbol', 'Football'], ['18 kulüp', '18 clubs'], ['İstatistik', 'Stats']], best: () => ls.get('draft_best', 0) + T(' p', ' pts') },
    { id: 'istiklal1919', name: ['1919: Medeniyetlerin Çağı', '1919: Age of Civilizations'], tags: [['Strateji', 'Strategy'], ['1919–1923', '1919–1923'], ['İki mod', 'Two modes']], best: () => T('Dünya modu · 32 bölgeli tarihsel senaryo', 'World mode · 32-region historical campaign') },
    { id: 'vadi', name: 'Empires of the Valley', tags: [['Strateji', 'Strategy'], ['Şehir kurma', 'City-building']], best: () => T('3 Bölümlük Sefer', 'Three-Chapter Campaign') },
    { id: 'runaway-cheese', name: ['Peynir Kaçışı 3D', 'Cheese Escape 3D'], tags: [['3D Arcade', '3D Arcade'], ['Fizik', 'Physics'], ['Kovalamaca', 'Chase']], best: () => { try { const v = Number(localStorage.getItem('baba_cheese_best') || 0); return v > 0 ? v + ' m' : T('Yeni', 'New'); } catch (e) { return T('Yeni', 'New'); } } },
    { id: 'sis-hatti', name: ['SİS HATTI. — 02:17', 'FOG LINE. — 02:17'], tags: [['Pixel Art', 'Pixel Art'], ['Hikâye', 'Story'], ['Gizem', 'Mystery']], best: () => { try { const data=JSON.parse(localStorage.getItem('baba_sis_hatti_v1') || '{}'); return data.ending ? T('Hikâye bitti', 'Story completed') : T('4 farklı son', '4 endings'); } catch (_) { return T('4 farklı son', '4 endings'); } } },
    { id: 'living-island', name: ['ERGÜN’ÜN ÇİFTLİĞİ — Living Island', 'ERGÜN’S FARM — Living Island'], tags: [['2.5D', '2.5D'], ['Çiftlik', 'Farming'], ['Huzur', 'Cozy']], best: () => T('Yaşayan ada','Living island') },
    { id: 'koy', name: ['KÖY. — İskoç Yayla Bahçesi', 'VILLAGE. — Scottish Highland Garden'], tags: [['3D Yaşam', '3D Life'], ['Huzur', 'Relaxing'], ['Glencoe', 'Glencoe']], best: () => T('Glenmore · 3D', 'Glenmore · 3D') },
    { id: 'surus', name: ['SÜRÜŞ. — Konyaaltı', 'DRIVE. — Konyaaltı'], tags: [['Sürüş', 'Driving'], ['Simülasyon', 'Simulation']], best: () => T('3 km · Konyaaltı', '3 km · Konyaaltı') },
    { id: 'simitci', name: ['SİMİTÇİ. — Uzun Sokak Tycoon', 'SIMIT. — Uzun Sokak Tycoon'], tags: [['Tycoon', 'Tycoon'], ['2.5D izometrik', '2.5D isometric'], ['Trabzon', 'Trabzon']], best: () => T('9 görev · kortej', '9 missions · fan march') },
    { id: 'yelken', name: ['YELKEN. — Optimist Yelken Simülasyonu', 'SAIL. — Optimist Sailing Simulator'], tags: [['3D Yelken', '3D Sailing'], ['Fizik', 'Physics'], ['Trabzon', 'Trabzon']], best: () => T('5 tekne · 15 denizci', '5 boats · 15 sailors') },
    { id: 'yayla-savunmasi', name: ['Trabzon Yayla Savunması', 'Trabzon Highland Defense'], tags: [['Kule Savunma', 'Tower Defense'], ['3D PBR', '3D PBR'], ['Karadeniz', 'Black Sea']], best: () => T('10 dalga · 3D', '10 waves · 3D') },
    { id: 'amsterdam-coffeeshop', name: ['AMSTERDAM. — Coffeeshop İmparatorluğu', 'AMSTERDAM. — Coffeeshop Empire'], tags: [['Market simülasyonu', 'Store sim'], ['3D birinci şahıs', '3D first person'], ['39 karakter', '39 characters']], best: () => T('Jordaan · 3D · +18', 'Jordaan · 3D · 18+') },
    { id: 'kafa-topu', name: ['Kafa Topu: Süper Lig', 'Sports Heads: Süper Lig'], tags: [['Futbol', 'Football'], ['Süper Lig', 'Süper Lig'], ['1v1 / 2P', '1v1 / 2P']], best: () => { const b = ls.get('bb_best_kafa_topu', 0); return b ? b + T(' Kupa', ' Cups') : T('Yeni', 'New'); } },
    { id: 'age-of-war', name: ["Age of War: Çağlar Savaşı","Age of War"], tags: [["Strateji","Strategy"],["5 çağ","5 eras"],["Üs savunması","Base defense"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'gunblood', name: ["Gunblood: Düello","Gunblood: Duel"], tags: [["Düello","Duel"],["Western","Western"],["Refleks","Reflexes"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'warfare-1917', name: ["Warfare 1917: Siper Savaşı","Warfare 1917"], tags: [["Strateji","Strategy"],["Siper","Trenches"],["1917","1917"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'the-waitress', name: ["The Waitress: BABA Kafe","The Waitress: Cafe"], tags: [["Simülasyon","Simulation"],["Kafe","Cafe"],["Servis","Service"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'fancy-pants-3', name: ["Fancy Pants 3","Fancy Pants 3"], tags: [["Platform","Platformer"],["Macera","Adventure"],["Hız","Speed"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'territory-war', name: ["Territory War: Bölge Savaşı","Territory War"], tags: [["Strateji","Strategy"],["4v4","4v4"],["Sıra tabanlı","Turn-based"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'electric-man-2', name: ["Electric Man 2","Electric Man 2"], tags: [["Dövüş","Fighting"],["Arena","Arena"],["Elektrik","Electric"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'wild-ones-world', name: ["Wild Ones: World Edition","Wild Ones: World Edition"], tags: [["Topçu","Artillery"],["15 karakter","15 characters"],["Dünya","World"]], best: () => T('Yeni oyun', 'New game') },
    { id: 'yilan-arenasi', name: ['Yılan Arenası (Slither.io)', 'Snake Arena (Slither.io)'], tags: [['Arcade', 'Arcade'], ['Arena', 'Arena'], ['Neon', 'Neon']], best: () => { const b = ls.get('bb_best_yilan_arenasi', 0); return b ? b.toLocaleString(I18N.locale) : '—'; } },
    { id: 'gta-vice-city', name: 'GTA: Vice City', tags: [['Aksiyon', 'Action'], ['Klasik', 'Classic'], ['Miniplay', 'Miniplay']], best: () => T('Harici', 'External') },
    { id: 'tekken-3', name: 'Tekken 3', tags: [['Dövüş', 'Fighting'], ['Arcade', 'Arcade'], ['Miniplay', 'Miniplay']], best: () => T('Harici', 'External') },
    { id: 'hungry-shark', name: ['Aç Köpekbalığı', 'Hungry Shark'], tags: [['Arcade', 'Arcade'], ['Okyanus', 'Ocean'], ['Hayatta Kalma', 'Survival']], best: () => { const b = ls.get('bb_best_hungry_shark', 0); return b ? b.toLocaleString(I18N.locale) : '—'; } },
    { id: 'rota-conference', name: ['ROTA. — Denizcilik Konferansı', 'ROTA. — Maritime Conference'], tags: [['Simülasyon', 'Simulation'], ['Etkinlik Yönetimi', 'Event Management'], ['Operasyon', 'Operations']], best: () => { const r = ls.get('rota_conference_records_v2', null); return r?.bestScore ? r.bestScore + T(' puan', ' points') : T('Yeni görev', 'New mission'); } },
    { id: 'dsan-shipyard', name: ['Damen Tersane Tycoon', 'Damen Shipyard Tycoon'], tags: [['3D Yönetim', '3D Management'], ['Gemi İnşası', 'Shipbuilding'], ['Tersane', 'Shipyard']], best: () => T('Antalya · 3D', 'Antalya · 3D') },
    { id: '2048', name: '2048', tags: [['Bulmaca', 'Puzzle'], ['Kaydır', 'Swipe']], best: () => ls.get('bb_best_2048', 0) },
    { id: 'sudoku', name: 'Sudoku', tags: [['Mantık', 'Logic'], ['3 seviye', '3 levels']], best: () => { const b = ls.get('bb_best_sudoku', null); return b ? fmtT(b) : '—'; } },
    { id: 'mines', name: ['Mayın Tarlası', 'Minesweeper'], tags: [['Klasik', 'Classic'], ['Dikkat', 'Focus']], best: () => { const b = ls.get('bb_best_mines', null); return b ? fmtT(b) : '—'; } },
    { id: 'blocks', name: ['Blok Yığ', 'Block Stack'], tags: ['Arcade', ['Hız', 'Speed']], best: () => ls.get('bb_best_blocks', 0) }
  ];
  const P = x => Array.isArray(x) ? T(x[0], x[1]) : x;
  const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function shell(title, inner, tag) {
    root().innerHTML = `<section class="game-page"><div class="gp-head"><a class="back" href="#oyunlar">← ${T('Oyunlar', 'Games')}</a><p class="eyebrow">${tag || T('Zekâ oyunu', 'Brain game')}</p><h1 class="display sm">${title}</h1></div><div class="bb-body">${inner}</div></section>`;
    window.scrollTo(0, 0);
    return root().querySelector('.bb-body');
  }
  function hub() {
    const d = new Date(), pn = (typeof CBN !== 'undefined' && CBN.S && CBN.S.settings && CBN.S.settings.profile && CBN.S.settings.profile.name) || '', name = pn || (isOwner() ? 'Oğuzhan' : (guest && guest.name));
    const CATS = [
      {id:'today',t:'BUGÜN.<i>'+T('Günlük özet','Daily overview')+'</i>',d:T('CBN görevleri, takvim ve bildirimler','CBN tasks, calendar and notifications'),cls:'c-cbn'},
      {id:'cbn',t:'CBN.<i>'+T('Kişisel asistan','Personal assistant')+'</i>',d:T('Notlar, görevler, AI araçları ve kişisel planlama','Notes, tasks, AI tools and planning'),cls:'c-cbn'},
      {id:'kesfet',t:'KEŞFET.<i>GÜNDEM · AKIŞ · PLAY</i>',d:T('Haberler, kişisel akış ve medya','News, personal feed and media'),cls:'c-gundem'},
      {id:'hayat',t:'HAYAT.<i>'+T('Seyahat · Fotoğraf','Travel · Photography')+'</i>',d:T('Yolculuklar, fotoğraflar ve anılar','Journeys, photos and memories'),cls:'c-foto'},
      {id:'sosyal',t:'SOSYAL.<i>Messenger · Dost</i>',d:T('Mesajlaşma ve iyi hissetme','Chat and wellbeing'),cls:'c-msn'},
      ...(isOwner()?[{id:'ismerkez',t:T('İŞ.','WORK.')+'<i>CBN Work</i>',d:T('DSAn ve CBN iş araçları','DSAn and CBN work tools'),cls:'c-is'}]:[]),
      {id:'oyunlar',t:T('OYUNLAR.','GAMES.'),d:T('Mini oyunlar ve futbol','Mini games and football'),cls:'c-oyun'},
      ...(isOwner()?[{id:'ts',t:'TRABZONSPOR.',d:T('Maçlar, kadro ve haberler','Matches, squad and news'),cls:'c-ts'}]:[])
    ];
    root().innerHTML = `
      <section class="hero hub-hero"><p class="eyebrow">${esc(name || '')} · ${d.toLocaleDateString(I18N.locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 class="display xl">BABA<em>.</em></h1>
        <p class="lead">${T('İş, dinlenme, oyun ve yolculuk — hepsi tek yerde, sadece davetlilere açık.', 'Work, rest, play and travel — all in one place, open by invitation only.')}</p></section>
      <section class="hub">${CATS.map((c, i) => `<a class="hub-card ${c.cls}" href="#${c.id}"><span class="hub-n">${String(i + 1).padStart(2, '0')}</span><h2>${c.t}</h2><p>${c.d}</p><span class="arrow">↗</span></a>`).join('')}</section>
      <footer class="foot"><div class="foot-word">BABA<span>.</span></div><div class="foot-row">${isOwner() ? `<button class="link" data-a="pin">${T('Şifreyi değiştir', 'Change PIN')}</button><a class="link" href="#erisim">${T('Davetler &amp; erişim', 'Invitations &amp; access')}</a><button class="link" data-a="lock">${T('Kilitle', 'Lock')}</button>` : `<button class="link" data-a="gout">${T('Bu cihazdan çık', 'Sign out on this device')}</button>`}<span class="muted">${T('Yalnızca davetliler için', 'Invitation only')} · ${T('sürüm', 'version')} 64</span></div></footer>`;
    const q = s => root().querySelector(s);
    if (q('[data-a=pin]')) q('[data-a=pin]').onclick = () => { click(); changePin(); };
    if (q('[data-a=lock]')) q('[data-a=lock]').onclick = () => { click(); lock(); };
    if (q('[data-a=gout]')) q('[data-a=gout]').onclick = () => { if (confirm(T('Davetli erişimi bu cihazdan kaldırılsın mı?', 'Remove guest access from this device?'))) guestOut(); };
    window.scrollTo(0, 0);
  }
  /* ---------------- davetler (yalnızca sahibi) ---------------- */
  function access() {
    const list = ls.get('baba_invites', []);
    const link = (n, c) => location.origin + location.pathname + '?davet=' + encodeURIComponent(c) + '&ad=' + encodeURIComponent(n);
    root().innerHTML = `<section class="game-page"><div class="gp-head"><a class="back" href="#">← ${T('Ana sayfa', 'Home')}</a><p class="eyebrow">${T('Yalnızca sahibi görür', 'Visible to the owner only')}</p><h1 class="display sm">${T('Davetler &amp; erişim', 'Invitations &amp; access')}</h1></div>
      <div class="acc">
        <form class="acc-form"><input name="n" placeholder="${T('Davet edeceğin kişinin adı (ör. Nicole)', 'Name of the person you are inviting (e.g. Nicole)')}" required maxlength="40"><button class="pill">${T('Davet kodu oluştur', 'Create invitation code')}</button></form>
        <div class="acc-list">${list.length ? list.slice().reverse().map(x => `<div class="acc-item"><div><b>${esc(x.name)}</b><code>${x.code}</code><small class="muted">${new Date(x.at).toLocaleDateString(I18N.locale)}</small></div><div class="acc-acts"><button class="pill ghost sm" data-share="${esc(x.name)}">${T('Paylaş', 'Share')}</button><button class="pill ghost sm" data-del="${esc(x.code)}">${T('Listeden sil', 'Remove from list')}</button></div></div>`).join('') : `<p class="muted">${T('Henüz davet yok.', 'No invitations yet.')}</p>`}</div>
        <div class="acc-note">${T(`<h3>Nasıl çalışır?</h3><p><b>Ana ekrana eklemek için:</b> davetli, gönderdiğin bağlantıyı açıp giriş yaptıktan sonra “Ana Ekrana Ekle”yi kullanmalı. Uygulama simgesi daveti hatırlar ve PIN sormadan yalnızca davetlilere açık bölümlerle açılır.</p><p>Uygulamaya yalnızca senin şifrenle ya da senin verdiğin davet koduyla girilir. Katılmak isteyen biri giriş ekranından sana istek mesajı gönderir; uygun görürsen buradan ona özel bir kod oluşturup paylaşırsın. Davetliler İş ve Trabzonspor sayfalarını göremez; kayıtları yalnızca kendi cihazlarında tutulur.</p><p class="muted sm">Not: Site GitHub Pages'te durduğu için bu bir “kapı kilidi”dir, banka kasası değil.</p>`, `<h3>How does it work?</h3><p><b>Adding to the Home Screen:</b> your guest should open the link you sent, sign in, and then use “Add to Home Screen”. The app icon remembers the invitation and opens straight into the guest sections, without asking for a PIN.</p><p>The app can only be opened with your PIN or with an invitation code you give out. Someone who wants to join can send you a request from the sign-in screen; if you are happy with it, create a personal code here and share it. Guests cannot see the Work or Trabzonspor pages, and their records are kept only on their own devices.</p><p class="muted sm">Note: because the site is hosted on GitHub Pages, this is a door latch, not a bank vault.</p>`)}</div>
      </div></section>`;
    const f = root().querySelector('.acc-form');
    const share = n => { const c = inviteCode(n), u = link(n, c), t = T(`Merhaba ${n}, BABA. uygulamama davetlisin 🙂\nGiriş kodun: ${c}\n${u}`, `Hi ${n}, you’re invited to my BABA. app 🙂\nYour sign-in code: ${c}\n${u}`); if (navigator.share) navigator.share({ title: T('BABA. daveti', 'BABA. invitation'), text: t }).catch(() => {}); else { navigator.clipboard && navigator.clipboard.writeText(t); toast(T('📋 Davet metni kopyalandı', '📋 Invitation copied')); } };
    f.onsubmit = e => { e.preventDefault(); const n = f.n.value.trim(); if (!n) return; const c = inviteCode(n); const l = ls.get('baba_invites', []).filter(x => x.code !== c); l.push({ name: n, code: c, at: Date.now() }); ls.set('baba_invites', l); access(); share(n); };
    root().querySelectorAll('[data-share]').forEach(b => b.onclick = () => share(b.dataset.share));
    root().querySelectorAll('[data-del]').forEach(b => b.onclick = () => { ls.set('baba_invites', ls.get('baba_invites', []).filter(x => x.code !== b.dataset.del)); access(); });
    window.scrollTo(0, 0);
  }
  // Cover artwork for the six featured games. Others retain their original SVG artwork.
  // Oyun kütüphanesi kapakları (img/library/*-1280.webp; 640 px sürümü srcset ile)
  const GAME_COVERS = Object.freeze({
    'hayat-oyunu': 'img/library/hayat-oyunu-1280.webp',
    'futbol': 'img/library/futbol-1280.webp',
    'career': 'img/library/career-1280.webp',
    'draft': 'img/library/draft-1280.webp',
    'istiklal1919': 'img/library/istiklal1919-1280.webp',
    'vadi': 'img/library/vadi-1280.webp',
    'kafa-topu': 'img/library/kafa-topu-1280.webp',
    'living-island': 'img/library/living-island-1280.svg',
    'koy': 'img/library/koy-1280.webp',
    'simitci': 'img/library/simitci-1280.webp',
    'yelken': 'img/library/yelken-1280.webp',
    'yayla-savunmasi': 'img/library/yayla-savunmasi-1280.webp',
    'amsterdam-coffeeshop': 'img/library/amsterdam-coffeeshop-1280.webp',
    'yilan-arenasi': 'img/library/yilan-arenasi-1280.webp',
    'gta-vice-city': 'img/library/gta-vice-city-1280.webp',
    'tekken-3': 'img/library/tekken-3-1280.webp',
    'hungry-shark': 'img/library/hungry-shark-1280.webp',
    'dsan-shipyard': 'img/library/dsan-shipyard-1280.webp',
    '2048': 'img/library/2048-1280.webp',
    'sudoku': 'img/library/sudoku-1280.webp',
    'mines': 'img/library/mines-1280.webp',
    'blocks': 'img/library/blocks-1280.webp'
  });
  function menu() {
    // Oyun kütüphanesi (js/oyunlar.js): hero video, vitrin, filtrelenebilir kütüphane, kategoriler
    onLeave(BABALibrary.render({ root: root(), games: visibleGames(), isExternal: id => Object.hasOwn(EXTERNAL_GAME_URLS, id), T, esc, P, isOwner, covers: GAME_COVERS }));
    if (typeof BABACovers !== 'undefined') onLeave(BABACovers.mount({
      container: root(), games: visibleGames().map(g => ({ id: g.id, name: P(g.name) })),
      defaults: GAME_COVERS, isOwner: () => isOwner()
    }));
    window.scrollTo(0, 0);
  }
  const ART = {
    'hayat-oyunu': `<svg viewBox="0 0 200 130"><defs><linearGradient id="hgS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb36b"/><stop offset=".65" stop-color="#ff7a59"/><stop offset="1" stop-color="#c8486b"/></linearGradient><linearGradient id="hgW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a8fc7"/><stop offset="1" stop-color="#123d63"/></linearGradient></defs><rect width="200" height="130" fill="url(#hgS)"/><circle cx="148" cy="70" r="24" fill="#ffe9b0"/><g fill="#5b2a4e" opacity=".55"><rect x="8" y="50" width="16" height="50" rx="2"/><rect x="40" y="38" width="18" height="62" rx="2"/><rect x="92" y="46" width="16" height="54" rx="2"/><rect x="170" y="44" width="20" height="56" rx="2"/></g><g fill="#3a1b3d"><rect x="20" y="62" width="20" height="40" rx="2"/><rect x="60" y="48" width="22" height="54" rx="2"/><rect x="112" y="58" width="18" height="44" rx="2"/><rect x="150" y="66" width="22" height="36" rx="2"/></g><g fill="#ffd27a"><rect x="25" y="68" width="3" height="4"/><rect x="33" y="78" width="3" height="4"/><rect x="65" y="56" width="3" height="4"/><rect x="74" y="66" width="3" height="4"/><rect x="66" y="80" width="3" height="4"/><rect x="117" y="64" width="3" height="4"/><rect x="124" y="76" width="3" height="4"/><rect x="156" y="72" width="3" height="4"/><rect x="164" y="84" width="3" height="4"/></g><rect y="100" width="200" height="30" fill="url(#hgW)"/><path d="M118 108h16l-3 4h-10z" fill="#fff"/><path d="M126 108V97l6 10z" fill="#7b1e3b"/><text x="14" y="30" font-size="14">❤️</text><text x="84" y="26" font-size="13">💼</text><text x="176" y="28" font-size="13">🎓</text><text x="44" y="122" font-size="11">🏠</text></svg>`,
    istiklal1919: `<svg viewBox="0 0 200 130" aria-hidden="true"><defs><linearGradient id="warBg" x2="1" y2="1"><stop stop-color="#263d32"/><stop offset="1" stop-color="#82714b"/></linearGradient></defs><rect width="200" height="130" fill="url(#warBg)"/><path d="M0 95L48 58 84 76 140 34 200 73v57H0Z" fill="#3d5441"/><path d="M0 117L53 75 111 94 159 49 200 80v50H0Z" fill="#273f31"/><path d="M100 18v83" stroke="#e4d2a0" stroke-width="2"/><path d="M100 20h53v31h-53Z" fill="#b43b34"/><path d="M122 27a10 10 0 1 0 0 18 8 8 0 1 1 0-18" fill="#fff"/><path d="m139 31 2 5 5 .2-4 3 1.5 5-4.5-3-4 3 1.5-5-4-3 5-.2Z" fill="#fff"/><text x="16" y="113" fill="#e9d9a8" font-size="29" font-weight="900" font-family="Georgia">1919</text></svg>`,
    vadi: `<svg viewBox="0 0 200 130"><rect width="200" height="130" fill="#bfe3f2"/><path d="M100 30 190 75 100 120 10 75Z" fill="#7cc04f"/><path d="M10 75 100 120v10L10 85Z" fill="#8a5a36"/><path d="M190 75 100 120v10l90-45Z" fill="#6f4628"/><path d="M40 60 70 75 55 82.500 25 67.500Z" fill="#4aa3df"/><path d="M118 62 140 73 118 84 96 73Z" fill="#8b5a2b" fill-opacity=".55"/><g><path d="M92 62v-14l12-7 12 7v14l-12 6Z" fill="#f3e3c3"/><path d="M90 48l14-9 14 9-14 7Z" fill="#b5523a"/><rect x="101" y="57" width="6" height="9" fill="#7a4a2a"/></g><g fill="#2f7d46"><path d="M150 78l7-16 7 16Z"/><path d="M160 86l7-16 7 16Z"/><path d="M140 88l7-16 7 16Z"/><path d="M62 96l7-16 7 16Z"/><path d="M76 102l7-16 7 16Z"/></g><g fill="#9aa3ad"><path d="M120 98l8-6 8 6-8 4Z"/><path d="M130 104l7-5 7 5-7 4Z"/></g></svg>`,
    futbol: `<svg viewBox="0 0 200 130"><rect width="100" height="130" fill="#e9542f"/><rect x="100" width="100" height="130" fill="#0b1c2e"/><g fill="#fff" opacity=".25">${Array.from({ length: 24 }, (_, i) => `<circle cx="${(i * 37) % 100}" cy="${(i * 23) % 130}" r="1.3"/>`).join('')}</g><text x="100" y="62" text-anchor="middle" font-size="26" font-weight="900" font-family="system-ui" fill="#fff" opacity=".92" letter-spacing="-1">TARAFINI</text><text x="100" y="88" text-anchor="middle" font-size="26" font-weight="900" font-family="system-ui" fill="#fff" opacity=".92" letter-spacing="-1">SEÇ.</text><rect x="22" y="104" width="56" height="14" fill="#d8f424"/><text x="50" y="114" text-anchor="middle" font-size="7.5" font-weight="900" font-family="system-ui" fill="#111">DRAFT</text><rect x="122" y="104" width="56" height="14" fill="#d8f424"/><text x="150" y="114" text-anchor="middle" font-size="7.5" font-weight="900" font-family="system-ui" fill="#111">KARİYER</text></svg>`,
    career: `<svg viewBox="0 0 200 130"><defs><linearGradient id="crG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e2a47"/><stop offset="1" stop-color="#1f8a4c"/></linearGradient></defs><rect width="200" height="130" fill="url(#crG)"/><g fill="#fff" opacity=".12">${Array.from({ length: 6 }, (_, i) => `<rect x="${12 + i * 30}" y="${96 - i * 12}" width="20" height="${14 + i * 12}" rx="3"/>`).join('')}</g><path d="M14 104 L44 92 L74 96 L104 78 L134 70 L164 48 L188 36" fill="none" stroke="#ffd54a" stroke-width="3.5" stroke-linecap="round"/><circle cx="188" cy="36" r="5" fill="#ffd54a"/><g transform="translate(22 18)"><rect width="64" height="44" rx="8" fill="#fff"/><text x="32" y="19" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui" fill="#0e2a47">2026/27</text><text x="32" y="35" text-anchor="middle" font-size="13" font-weight="900" font-family="system-ui" fill="#ff4d00">1.</text></g><text x="150" y="112" font-size="30">🏆</text></svg>`,
    draft: `<svg viewBox="0 0 200 130"><rect width="200" height="130" fill="#1f8a4c"/><g stroke="#fff" stroke-opacity=".5" fill="none" stroke-width="1.5"><rect x="8" y="8" width="184" height="114"/><line x1="100" y1="8" x2="100" y2="122"/><circle cx="100" cy="65" r="18"/><rect x="8" y="40" width="22" height="50"/><rect x="170" y="40" width="22" height="50"/></g><g fill="#fff">${[[40, 30], [40, 100], [60, 65], [85, 40], [85, 90], [125, 65], [150, 35], [150, 95], [175, 65]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('')}</g><circle cx="20" cy="65" r="6" fill="#ffd54a"/></svg>`,
    '2048': `<div class="mini2048">${[2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4, 2, 8, 16, 2].map(v => `<i class="v${v}">${v}</i>`).join('')}</div>`,
    sudoku: `<div class="minisd">${'531974862'.split('').map((d, i) => `<i>${i % 2 ? '' : d}</i>`).join('')}</div>`,
    mines: `<div class="minimn">${[1, 1, 2, '🚩', 1, 0, 1, 2, 3, '🚩', 0, 1, '💣', 2, 1, 0].map(v => `<i class="${v === 0 ? 'o' : ''}">${v || ''}</i>`).join('')}</div>`,
    blocks: `<div class="minibk">${[0, 0, 0, 'T', 0, 0, 0, 'T', 'T', 0, 'L', 0, 0, 'T', 'I', 'L', 'L', 'L', 'O', 'O', 'I', 'S', 'S', 'O', 'O', 'I', 'S', 'S', 'Z', 'Z'].map(v => `<i class="${v || ''}"></i>`).join('')}</div>`
  };

  /* ==================== 1919 — İSTİKLAL HARBİ ==================== */
  function istiklal1919() {
    const src = 'games/1919/age.html?v=97';
    const b = shell('1919: Medeniyetlerin Çağı', `<div class="vd-bar"><p class="bb-tip">${T('Dünya modu modern sınırlı ülkelerle; tarihsel 1919–1923 Anadolu modu 32 temsilî bölgeyle oynanır. Diplomasi, ordu ve ekonomi içerir.', 'World campaign with modern borders plus a 32-region historical Anatolian campaign (1919–1923). Diplomacy, armies and economy.')}</p><div class="vd-acts"><button class="bb-btn" data-a="full">${T('Tam ekran', 'Full screen')}</button><a class="bb-btn" href="${src}" target="_blank" rel="noopener">${T('Yeni sekmede aç', 'Open in a new tab')} ↗</a></div></div><div class="vd-frame"><iframe src="${src}" title="1919: Medeniyetlerin Çağı" allow="fullscreen" allowfullscreen loading="eager"></iframe></div><p class="bb-tip">${T('Haritadan eyalet seç, asker yetiştir, diplomasiyle savaş ilan et ve komşuya ilerle. Her tur ekonomi ve rakipler gelişir.', 'Select provinces, recruit armies, declare war through diplomacy and move to adjacent regions. Each turn advances the economy and rivals.')}</p>`, T('Tur bazlı strateji · 1919–1923','Turn-based strategy · 1919–1923'));
    b.closest('.game-page').classList.add('vadi-page','ist1919-page');
    const nav = document.querySelector('body > .nav');
    if(nav){const update=()=>document.documentElement.style.setProperty('--baba-nav-height',Math.ceil(nav.getBoundingClientRect().height)+'px');update();try{window.__baba1919NavObserver?.disconnect();window.__baba1919NavObserver=new ResizeObserver(update);window.__baba1919NavObserver.observe(nav)}catch(_){}}
    const frame = b.querySelector('.vd-frame');
    const iframe = frame.querySelector('iframe');
    iframe.addEventListener('load', () => {
      try {
        const d = iframe.contentDocument;
        if (d && !d.querySelector('#app .top')) {
          const error = d.querySelector('#boot-error');
          if (error) error.textContent = T('Oyun başlatılamadı. Sayfayı yenile.', 'Game failed to start. Reload the page.');
        }
      } catch (_) {}
    });
    b.querySelector('[data-a=full]').onclick = async () => {
      click();
      try { await frame.requestFullscreen(); }
      catch (_) { location.href = src; }
    };
  }

  /* ==================== EMPIRES OF THE VALLEY ==================== */
  // Oyun kendi deposunda (oguzcobn/empires-of-the-valley) durur ve aynı adres kökünden yayınlanır;
  // burada çerçeve içinde açılır, böylece oyunun her güncellemesi buraya kendiliğinden yansır.
  const VADI_URL = 'https://oguzcobn.github.io/empires-of-the-valley/';
  function vadi() {
    const b = shell('Empires of<br>the Valley', `<div class="vd-bar"><p class="bb-tip">${T('Vadide küçük bir köyden medeniyete. Kayıtlar bu cihazda tutulur.', 'From a small village in the valley to a civilisation. Saves are kept on this device.')}</p><div class="vd-acts"><button class="bb-btn" data-a="full">⛶ ${T('Tam ekran', 'Full screen')}</button><a class="bb-btn" href="${VADI_URL}" target="_blank" rel="noopener">${T('Yeni sekmede aç', 'Open in a new tab')} ↗</a></div></div>
      <div class="vd-frame"><iframe src="${VADI_URL}" title="Empires of the Valley" allow="fullscreen; autoplay" allowfullscreen loading="eager"></iframe></div>
      <p class="bb-tip">${T('Kısayollar: Boşluk duraklat · 1/2/3 hız · B inşa · R yol · G ordu hareketi · Esc iptal. Telefonda “Tam ekran”a dokunup cihazı yan çevir.', 'Shortcuts: Space pause · 1/2/3 speed · B build · R road · G move troops · Esc cancel. On your phone, tap “Full screen” and turn your device sideways.')}</p>`, T('Strateji · şehir kurma', 'Strategy · city-building'));
    b.closest('.game-page').classList.add('vadi-page');
    const fr = b.querySelector('.vd-frame'), fb = b.querySelector('[data-a=full]');
    const req = fr.requestFullscreen || fr.webkitRequestFullscreen;
    fb.onclick = async () => {
      click();
      if (req) {
        try {
          await req.call(fr);
          return;
        } catch {
          // Browsers without iframe fullscreen can open the same game directly.
        }
      }
      location.href = VADI_URL;
    };
  }

  /* ==================== YENİ ARCADE & HARİCİ OYUNLAR ==================== */
  function openEmbeddedGame(cfg) {
    const b = shell(cfg.title, `<div class="vd-bar"><p class="bb-tip">${cfg.lead}</p><div class="vd-acts"><button class="bb-btn" data-a="full">⛶ ${T('Tam ekran', 'Full screen')}</button><a class="bb-btn" href="${cfg.url}" target="_blank" rel="noopener">${T('Yeni sekmede aç', 'Open in a new tab')} ↗</a></div></div>
      <div class="dsan-frame"><iframe src="${cfg.url}" title="${esc(cfg.title)}" allow="fullscreen; autoplay; gamepad" allowfullscreen loading="eager"></iframe></div>
      <p class="bb-tip">${cfg.tip}</p>`, cfg.tag);
    b.closest('.game-page').classList.add('dsan-page');
    const frame = b.querySelector('.dsan-frame'), button = b.querySelector('[data-a=full]');
    button.onclick = async () => {
      click();
      const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
      if (req) { try { await req.call(frame); return; } catch (_) {} }
      window.open(cfg.url, '_blank', 'noopener');
    };
    if (cfg.msgType) {
      const onMsg = e => {
        const d = e && e.data;
        if (!d || d.type !== cfg.msgType) return;
        const sc = Math.round(+d.score || 0);
        if (sc > 0 && typeof Scores !== 'undefined') Scores.report(cfg.scoreId, sc, {});
      };
      window.addEventListener('message', onMsg);
      onLeave(() => window.removeEventListener('message', onMsg));
    }
  }
  function kafaTopu() {
    openEmbeddedGame({
      title: T('Kafa Topu: Süper Lig', 'Sports Heads: Süper Lig'),
      url: 'games/kafa-topu/index.html?v=2',
      tag: T('Futbol · Süper Lig · 1v1 / 2P', 'Football · Süper Lig · 1v1 / 2P'),
      lead: T('Süper Lig takımını seç, havadaki güçlendirmeleri kap ve kupayı kaldır.', 'Pick your Süper Lig club, grab floating power-ups and lift the trophy.'),
      tip: T('1. Oyuncu: A/D/W + Boşluk · 2. Oyuncu: Oklar + Enter. Mobilde ekran düğmelerini kullan.', 'P1: A/D/W + Space · P2: Arrows + Enter. Use on-screen buttons on mobile.'),
      msgType: 'baba-kafa-topu-score', scoreId: 'kafa-topu'
    });
  }
  function yilanArenasi() {
    openEmbeddedGame({
      title: T('Yılan Arenası (Slither.io)', 'Snake Arena (Slither.io)'),
      url: 'games/yilan-arenasi/index.html?v=2',
      tag: T('Arcade · Neon Yılan Arenası', 'Arcade · Neon Snake Arena'),
      lead: T('Enerji kürelerini topla, hızlanarak rakiplerinin önünü kes ve liderlik tablosuna çık.', 'Collect glowing orbs, boost to cut off rivals and climb the leaderboard.'),
      tip: T('Fare veya dokunmatikle yön ver · Sol Tık / Boşluk / BOOST ile hızlan.', 'Steer with mouse or touch · Hold Click / Space / BOOST to speed up.'),
      msgType: 'baba-yilan-arenasi-score', scoreId: 'yilan-arenasi'
    });
  }
  const EXTERNAL_GAME_URLS = {
    'age-of-war': 'https://flash-games.io/age-of-war',
    'warfare-1917': 'https://flash-games.io/warfare-1917',
    'the-waitress': 'https://flash-games.io/the-waitress',
    'fancy-pants-3': 'https://flash-games.io/fancy-pants-adventure-3',
    'territory-war': 'https://flash-games.io/territory-war',
    'electric-man-2': 'https://flash-games.io/electric-man-2',
    'gta-vice-city': 'https://www.miniplay.com/game/gta-vice-city',
    'tekken-3': 'https://www.miniplay.com/game/tekken-3'
  };
  const ARCADE_IMPORTED = [{"id":"age-of-war","name":["Age of War: Çağlar Savaşı","Age of War"],"tip":["Strateji","Strategy"]},{"id":"gunblood","name":["Gunblood: Düello","Gunblood: Duel"],"tip":["Düello","Duel"]},{"id":"warfare-1917","name":["Warfare 1917: Siper Savaşı","Warfare 1917"],"tip":["Strateji","Strategy"]},{"id":"the-waitress","name":["The Waitress: BABA Kafe","The Waitress: Cafe"],"tip":["Simülasyon","Simulation"]},{"id":"fancy-pants-3","name":["Fancy Pants 3","Fancy Pants 3"],"tip":["Platform","Platformer"]},{"id":"territory-war","name":["Territory War: Bölge Savaşı","Territory War"],"tip":["Strateji","Strategy"]},{"id":"electric-man-2","name":["Electric Man 2","Electric Man 2"],"tip":["Dövüş","Fighting"]},{"id":"wild-ones-world","name":["Wild Ones: World Edition","Wild Ones: World Edition"],"tip":["Topçu","Artillery"]}];
  function importedArcadeGame(id) {
    const cfg = ARCADE_IMPORTED.find(g => g.id === id);
    if (!cfg) return;
    const externalUrl = EXTERNAL_GAME_URLS[id];
    if (externalUrl) {
      openEmbeddedGame({
        title: T(...cfg.name),
        url: externalUrl,
        tag: T('BABA. ARCADE · Harici Bağlantı', 'BABA. ARCADE · External'),
        lead: T('Flash Games üzerinden oyna. Çerçeve açılmazsa “Yeni sekmede aç ↗” bağlantısını kullan.', 'Play via Flash Games. If the embed is blocked, use “Open in a new tab ↗”.'),
        tip: T("Oyun bağlantısı harici bir siteye açılır.", "The game is hosted on an external site.")
      });
      return;
    }
    openEmbeddedGame({
      title: T(...cfg.name),
      url: 'games/arcade/' + id + '.html?v=2',
      tag: T('BABA. ARCADE · Bağımsız oyun', 'BABA. ARCADE · Standalone game'),
      lead: T('ZIP paketinden eklenen oynanabilir oyun. Oynanış için ekrandaki kontrolleri kullan.', 'Playable game imported from the provided archive. Follow the in-game controls.'),
      tip: T('Oyun açılmazsa “Yeni sekmede aç” bağlantısını kullan; mobilde yatay ekran daha rahat olabilir.', 'If the game does not start, use the Open in new tab link; landscape may work best on mobile.')
    });
  }
  function gtaViceCity() {
    openEmbeddedGame({
      title: 'GTA: Vice City',
      url: EXTERNAL_GAME_URLS['gta-vice-city'],
      tag: T('Klasik Aksiyon · Harici Bağlantı', 'Classic Action · External'),
      lead: T('Miniplay üzerinden GTA: Vice City. Çerçeve tarayıcı güvenlik politikası nedeniyle açılmazsa “Yeni sekmede aç ↗” butonunu kullan.', 'GTA: Vice City via Miniplay. If the embed is blocked by the site, use “Open in a new tab ↗”.'),
      tip: T('Harici site içeriği olduğu için tam ekran veya yeni sekmede daha akıcı çalışır.', 'Opens smoothest in a new tab.')
    });
  }
  function tekken3() {
    openEmbeddedGame({
      title: 'Tekken 3',
      url: EXTERNAL_GAME_URLS['tekken-3'],
      tag: T('Arcade Dövüş · Harici Bağlantı', 'Arcade Fighting · External'),
      lead: T('Miniplay üzerinden Tekken 3. Çerçeve tarayıcı güvenlik politikası nedeniyle açılmazsa “Yeni sekmede aç ↗” butonunu kullan.', 'Tekken 3 via Miniplay. If the embed is blocked by the site, use “Open in a new tab ↗”.'),
      tip: T('Harici site içeriği olduğu için tam ekran veya yeni sekmede daha akıcı çalışır.', 'Opens smoothest in a new tab.')
    });
  }

  /* ==================== AÇ KÖPEKBALIĞI (HUNGRY SHARK) ==================== */
  const HUNGRY_SHARK_URL = 'games/hungry-shark/index.html?v=1';
  function hungryShark() {
    const b = shell(T('Aç Köpekbalığı', 'Hungry Shark'), `<div class="vd-bar"><p class="bb-tip">${T('Sürekli azalan açlığını bastırmak için okyanusu avla, yüzeye fırlayıp martıları kap, Altın Hücumu’nu doldur ve yeni köpekbalıkları aç.', 'Hunt the ocean to keep hunger at bay, breach the waves for seagulls, charge Gold Rush and unlock bigger sharks.')}</p><div class="vd-acts"><button class="bb-btn" data-a="full">⛶ ${T('Tam ekran', 'Full screen')}</button><a class="bb-btn" href="${HUNGRY_SHARK_URL}" target="_blank" rel="noopener">${T('Yeni sekmede aç', 'Open in a new tab')} ↗</a></div></div>
      <div class="dsan-frame"><iframe src="${HUNGRY_SHARK_URL}" title="${T('Aç Köpekbalığı', 'Hungry Shark')}" allow="fullscreen; autoplay" allowfullscreen loading="eager"></iframe></div>
      <p class="bb-tip">${T('Fare veya WASD/Oklarla yüz, Sol Tık/Boşluk ile hızlan. Mobilde sol ekrandaki joystick ve sağdaki BOOST butonunu kullan.', 'Steer with Mouse or WASD/Arrows, hold Left-Click/Space to boost. On mobile use the left joystick and right BOOST button.')}</p>`, T('Arcade · Okyanus Hayatta Kalma', 'Arcade · Ocean Survival'));
    b.closest('.game-page').classList.add('dsan-page');
    const frame = b.querySelector('.dsan-frame'), button = b.querySelector('[data-a=full]');
    button.onclick = async () => {
      click();
      const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
      if (req) { try { await req.call(frame); return; } catch (_) {} }
      window.open(HUNGRY_SHARK_URL, '_blank', 'noopener');
    };
    const onMsg = e => {
      const d = e && e.data;
      if (!d || d.type !== 'baba-hungry-shark-score') return;
      const sc = Math.round(+d.score || 0);
      if (sc > 0) {
        const prev = ls.get('bb_best_hungry_shark', 0);
        if (sc > prev) ls.set('bb_best_hungry_shark', sc);
        if (typeof Scores !== 'undefined') Scores.report('hungry-shark', sc, { gold: d.gold, eaten: d.eaten, depth: d.depth, maxCombo: d.maxCombo });
      }
    };
    window.addEventListener('message', onMsg);
    onLeave(() => window.removeEventListener('message', onMsg));
  }

  /* ==================== DAMEN SHIPYARD TYCOON ==================== */
  const DSAN_SHIPYARD_URL = 'games/dsan-shipyard/index.html';
  function dsanShipyard() {
    const b = shell(T('Damen Tersane Tycoon', 'Damen Shipyard Tycoon'), `<div class="vd-bar"><p class="bb-tip">${T('Antalya Serbest Bölge’de tersaneni yönet, gemiler inşa et ve üretim hattını büyüt.', 'Manage your shipyard in Antalya Free Zone, build vessels and grow your production line.')}</p><div class="vd-acts"><button class="bb-btn" data-a="full">⛶ ${T('Tam ekran', 'Full screen')}</button><a class="bb-btn" href="${DSAN_SHIPYARD_URL}" target="_blank" rel="noopener">${T('Yeni sekmede aç', 'Open in a new tab')} ↗</a></div></div>
      <div class="dsan-frame"><iframe src="${DSAN_SHIPYARD_URL}" title="Damen Shipyard Tycoon" allow="fullscreen; autoplay" allowfullscreen loading="eager"></iframe></div>
      <p class="bb-tip">${T('Üretim, sözleşmeler, showroom, çalışanlar ve yükseltmeler sekmelerini kullan. Telefonda tam ekran için cihazı yatay çevirebilirsin.', 'Use the production, contracts, showroom, workers and upgrades tabs. Turn your phone sideways for a wider full-screen view.')}</p>`, T('3D tersane yönetimi · Antalya', '3D shipyard management · Antalya'));
    b.closest('.game-page').classList.add('dsan-page');
    const frame = b.querySelector('.dsan-frame'), button = b.querySelector('[data-a=full]');
    button.onclick = async () => {
      click();
      const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
      if (req) { try { await req.call(frame); return; } catch (_) {} }
      window.open(DSAN_SHIPYARD_URL, '_blank', 'noopener');
    };
  }

  /* ==================== ROTA. CONFERENCE ==================== */
  const ROTA_CONFERENCE_URL = 'games/rota-conference/index.html';
  function rotaConference() {
    const b = shell(T('ROTA. — Denizcilik Konferansı', 'ROTA. — Maritime Conference'), `<div class="vd-bar"><p class="bb-tip">${T('45 katılımcılı, üç günlük konferans için teklif ver, ekibini kur, tedarikçileri seç ve dört operasyon krizini çöz.', 'Bid on a three-day conference for 45 guests, hire your team, select vendors and handle four operational crises.')}</p><div class="vd-acts"><button class="bb-btn" data-a="full">⛶ ${T('Tam ekran', 'Full screen')}</button><a class="bb-btn" href="${ROTA_CONFERENCE_URL}" target="_blank" rel="noopener">${T('Yeni sekmede aç', 'Open in new tab')} ↗</a></div></div>
      <div class="dsan-frame rota-game-frame"><iframe src="${ROTA_CONFERENCE_URL}" title="ROTA. — Denizcilik Konferansı" allow="fullscreen" allowfullscreen loading="eager"></iframe></div>
      <p class="bb-tip">${T('Kararların kârı, dakikliği ve müşteri memnuniyetini değiştirir. Oyun otomatik kaydedilir.', 'Your choices affect profit, punctuality and satisfaction. Progress is automatically saved.')}</p>`, T('Etkinlik işletme simülasyonu · Antalya', 'Event management simulation · Antalya'));
    b.closest('.game-page').classList.add('dsan-page','rota-game-page');
    const frame = b.querySelector('.rota-game-frame'), button = b.querySelector('[data-a=full]');
    button.onclick = async () => {
      click();
      const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
      if (req) { try { await req.call(frame); return; } catch (_) {} }
      window.open(ROTA_CONFERENCE_URL, '_blank', 'noopener');
    };
  }

  /* ==================== PEYNİR KAÇIŞI 3D ==================== */
  function runawayCheese() {
    openEmbeddedGame({
      title: T('Peynir Kaçışı 3D', 'Cheese Escape 3D'),
      url: 'games/runaway-cheese/index.html',
      tag: T('BABA. ARCADE · 3D Fizik Kovalamacası', 'BABA. ARCADE · 3D Physics Chase'),
      lead: T('Peyniri yokuş aşağı yuvarla, engellerin üzerinden sıçra ve peşindeki koşuculara yakalanma!', 'Roll a cheese wheel downhill, bounce past obstacles and escape the crowd of runners!'),
      tip: T('Bilgisayarda ← → veya A/D; telefonda dokunarak ya da kaydırarak yönlendir. Tam ekran önerilir.', 'Use ← → or A/D on desktop; touch buttons or swipe on mobile. Full screen recommended.')
    });
    const page = root().querySelector('.game-page');
    if (page) page.classList.add('cheese-page');
  }

  /* ==================== KÖY. / GLENMORE SCOTTISH HIGHLAND GARDEN ==================== */
  function livingIsland() {
    openEmbeddedGame({title:'Ergün’ün Çiftliği — Living Island',url:'games/living-island/index.html?v=9',tag:'BABA. · 2.5D',lead:T('Tropikal adada çiftçilik, ticaret ve yaşayan köy.','Farming, trade and village life on a tropical island.'),tip:T('Tarlaya dokun, görevleri sıraya al. Huzur ve fotoğraf modlarını dene.','Tap crops to queue tasks. Try zen and photo modes.')});
  }
  function koy() {
    openEmbeddedGame({
      title: T('KÖY. — İskoç Yayla Bahçesi', 'VILLAGE. — Scottish Highland Garden'),
      url: 'games/koy/index.html?v=9',
      tag: T('BABA. KÖY. · Glenmore, İskoçya · 3D', 'BABA. VILLAGE. · Glenmore, Scotland · 3D'),
      lead: T('Glencoe eteklerinde taş dağ evi, bahçe, gölet, aile ve hayvanlar: rüzgârda dalgalanan çayır, şömine, gün ve gece döngüsü.', 'A stone cottage, garden, pond, family and animals below Glencoe: a meadow waving in the wind, a fireplace and a day–night cycle.'),
      tip: T('Sürükleyerek döndür, WASD ile gez, F ile kapıyı aç, H ile huzur modu. Oyun 60 FPS’i korumak için çimen yoğunluğunu kendiliğinden ayarlar.', 'Drag to orbit, WASD to walk, F opens the door, H for zen mode. The game adjusts grass density by itself to hold 60 fps.')
    });
    const page = root().querySelector('.game-page');
    if (page) page.classList.add('koy-page');
  }

  /* ==================== SİMİTÇİ. / TRABZON UZUN SOKAK TYCOON ==================== */
  function simitci() {
    openEmbeddedGame({
      title: T('SİMİTÇİ. — Uzun Sokak Tycoon', 'SIMIT. — Uzun Sokak Tycoon'),
      url: 'games/simitci/index.html?v=1',
      tag: T('BABA. SİMİTÇİ. · Trabzon Ortahisar · 2.5D', 'BABA. SIMIT. · Trabzon Ortahisar · 2.5D'),
      lead: T('Trabzon Uzun Sokak’ta taş fırından sıcak kel simit, semaverden demli çay ve tereyağlı kaşarlı sat; masa aç, çırak ve komi tut, maç günü taraftar korteji geçerken kazancını katla.', 'Sell hot simit, brewed tea and buttery kaşarlı on Trabzon’s Uzun Sokak; open tables, hire an apprentice and a busboy, and cash in when the matchday fan march passes.'),
      tip: T('WASD/ok tuşları ya da sürükleyerek yürü. Tezgaha yaklaşınca ürün alırsın, masaya gidince servis edersin. Parlak karelerin üstünde durunca para yatırıp yeni masa ve tezgah açarsın. Yağmurda kazanç +%25.', 'Walk with WASD/arrows or drag. Stand by a counter to pick up, go to a table to serve. Stand on glowing pads to pay in and open tables and counters. Rain pays +25%.')
    });
  }

  /* ==================== YELKEN. / OPTIMIST SAILING SIMULATOR ==================== */
  function yelken() {
    openEmbeddedGame({
      title: T('YELKEN. — Optimist Yelken Simülasyonu', 'SAIL. — Optimist Sailing Simulator'),
      url: 'games/yelken/index.html?v=2',
      tag: T('BABA. YELKEN. · Trabzon Körfezi · 3D', 'BABA. SAIL. · Trabzon Bay · 3D'),
      lead: T('Trabzon kıyısında Optimist’ten 11,5 m maxi yata beş tekne: gerçek rüzgâr ve zahiri rüzgâr, yelken kaldırma/sürükleme, dalga üstünde yüzerlik, yatış ve iz dalgası.', 'Five boats from an Optimist to an 11.5 m maxi off the Trabzon coast: true and apparent wind, sail lift and drag, buoyancy on the waves, heel and wake.'),
      tip: T('A/D ya da ← → dümen, W/S yelkeni çevirir. “Oto” ideal yelken açısını tutar. Pusuladaki yeşil çizgi doğru bumba açısını gösterir.', 'A/D or ← → steer, W/S trims the sail. “Oto” holds the ideal sail angle. The green line on the compass shows the right boom angle.')
    });
  }

  /* ==================== TRABZON YAYLA SAVUNMASI / 3D TOWER DEFENSE ==================== */
  function yaylaSavunmasi() {
    openEmbeddedGame({
      title: T('Trabzon Yayla Savunması', 'Trabzon Highland Defense'),
      url: 'games/yayla-savunmasi/index.html?v=1',
      tag: T('BABA. STRATEJİ · 3D Kule Savunma', 'BABA. STRATEGY · 3D Tower Defense'),
      lead: T('Yaylayı 10 dalga boyunca savun: taş platformlara Serender Okçu, Kaçkar Topçu, Fırtına Kulesi kur; Kemençe, Meşale ve Zigana Buzulu güçlerini doğru anda kullan.', 'Defend the highland for 10 waves: build towers on the stone pads and time your Kemençe, Torch and Glacier powers.'),
      tip: T('Platforma dokun → kule seç. Sürükleyerek döndür, iki parmakla yakınlaş. “PBR Kalibrasyon” panelinde ışığı gerçek yayla fotoğraflarına göre ölçüp ayarlayabilirsin.', 'Tap a pad → pick a tower. Drag to orbit, pinch to zoom. The “PBR Calibration” panel measures the lighting against real highland photos.')
    });
  }

  /* ==================== AMSTERDAM. / COFFEESHOP EMPIRE (3D) ==================== */
  function amsterdamCoffeeshop() {
    openEmbeddedGame({
      title: T('AMSTERDAM. — Coffeeshop İmparatorluğu', 'AMSTERDAM. — Coffeeshop Empire'),
      url: 'games/amsterdam-coffeeshop/index.html?v=10',
      tag: T('BABA. ÖZEL · Yalnız sahibine açık · Market simülasyonu', 'BABA. PRIVATE · Owner only · Store simulator'),
      lead: T('Market simülasyonu: tabletten toptan sipariş ver, kutuları vitrine diz, fiyatları belirle, tabelayı çevirip dükkânı aç; kasada ürün okut, kimlik kontrol et, para üstü ver. Seviye atla, lisans ve personel aç.', 'Store simulator: order stock on the tablet, shelve the boxes, set prices, flip the sign to open; scan items at the till, check IDs, give change. Level up to unlock licenses and staff.'),
      tip: T('WASD yürü, fareyle bak (ekrana tıkla), Tık/E etkileşim, Tab tablet, G kutuyu bırak, Esc menü. Telefonda sağ alttaki Etkileşim düğmesini kullan.', 'WASD to walk, mouse to look (click the screen), Click/E to interact, Tab for the tablet, G to drop a box, Esc for the menu. On phones use the Interact button.')
    });
  }

  /* ==================== SİS HATTI. / STORY PIXEL ART ==================== */
  function sisHatti() {
    openEmbeddedGame({
      title: T('SİS HATTI. — 02:17', 'FOG LINE. — 02:17'),
      url: 'games/sis-hatti/index.html',
      tag: T('BABA. STORIES · Pixel Art Hikâye', 'BABA. STORIES · Pixel Art Narrative'),
      lead: T('Lodos Limanı’nda kayıp bir yolcunun izini sür. Keşfet, insanlarla konuş, radyo bulmacasını çöz ve dört olası sondan hangisine ulaşacağına karar ver.', 'Explore a haunted harbor, talk to locals, solve a radio puzzle, and decide which of the multiple endings will be yours.'),
      tip: T('WASD veya ok tuşlarıyla gez, E ile etkileş, J ile günlüğü aç. Telefonda yön tuşları, dokunarak hareket ve etkileşim tuşu var. Oyun otomatik kaydedilir.', 'Move with WASD or arrows, E to interact, J for journal. Mobile controls and tap-to-move supported. Auto-save enabled.')
    });
    const page = root().querySelector('.game-page');if(page)page.classList.add('sis-page');
  }

  /* ==================== 2048 ==================== */
  function g2048() {
    const b = shell('2048', `<div class="g2-head"><div class="g2-sc"><small>${T('SKOR', 'SCORE')}</small><b class="sc">0</b></div><div class="g2-sc"><small>${T('EN İYİ', 'BEST')}</small><b class="bs">${ls.get('bb_best_2048', 0)}</b></div><button class="bb-btn" data-a="undo">↶ ${T('Geri', 'Undo')}</button><button class="bb-btn" data-a="new">${T('Yeni', 'New')}</button></div>
      <div class="g2-board"><div class="g2-cells">${'<i></i>'.repeat(16)}</div><div class="g2-tiles"></div><div class="g2-over" hidden></div></div><p class="bb-tip">${T('Parmağınla kaydır ya da ok tuşlarını kullan', 'Swipe with your finger or use the arrow keys')}</p>`);
    const tilesEl = b.querySelector('.g2-tiles'), scEl = b.querySelector('.sc'), bsEl = b.querySelector('.bs'), over = b.querySelector('.g2-over');
    let grid, score, id, hist = [], won = false;
    const save = () => ls.set('bb_2048_state', { grid: grid.map(r => r.map(t => t && t.v)), score, won });
    function fresh() { grid = Array.from({ length: 4 }, () => Array(4).fill(null)); score = 0; won = false; hist = []; add(); add(); over.hidden = true; render(true); }
    function add() { const e = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!grid[r][c]) e.push([r, c]); if (!e.length) return; const [r, c] = e[Math.floor(Math.random() * e.length)]; grid[r][c] = { v: Math.random() < .9 ? 2 : 4, id: ++id, isNew: true }; }
    id = 0;
    const st = ls.get('bb_2048_state', null);
    if (st && st.grid) { grid = st.grid.map(r => r.map(v => v ? { v, id: ++id } : null)); score = st.score || 0; won = !!st.won; render(true); } else fresh();
    function render(instant) {
      const live = new Set();
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const t = grid[r][c]; if (!t) continue; live.add(String(t.id));
        let e = tilesEl.querySelector(`[data-id="${t.id}"]`);
        if (!e) { e = document.createElement('div'); e.dataset.id = t.id; tilesEl.appendChild(e); if (t.isNew) e.classList.add('new'); }
        e.className = `g2-t v${Math.min(t.v, 4096)}${t.isNew ? ' new' : ''}${t.merged ? ' merged' : ''}`;
        e.textContent = t.v; e.style.setProperty('--r', r); e.style.setProperty('--c', c);
        if (instant) e.style.transition = 'none'; else e.style.transition = '';
        t.isNew = false; t.merged = false;
      }
      tilesEl.querySelectorAll('.g2-t').forEach(e => { if (!live.has(e.dataset.id)) { if (e.dataset.gone) return; e.dataset.gone = 1; setTimeout(() => e.remove(), 120); } });
      scEl.textContent = score; const best = Math.max(score, ls.get('bb_best_2048', 0)); ls.set('bb_best_2048', best); bsEl.textContent = best;
      save();
    }
    function move(dir) {
      if (!over.hidden) return;
      const prev = { g: grid.map(r => r.map(t => t && { v: t.v, id: t.id })), s: score };
      let moved = false, gain = 0;
      const get = (i, j) => dir === 'l' ? [i, j] : dir === 'r' ? [i, 3 - j] : dir === 'u' ? [j, i] : [3 - j, i];
      const next = Array.from({ length: 4 }, () => Array(4).fill(null));
      for (let i = 0; i < 4; i++) {
        const line = []; for (let j = 0; j < 4; j++) { const [r, c] = get(i, j); if (grid[r][c]) line.push(grid[r][c]); }
        const out = [];
        for (let k = 0; k < line.length; k++) {
          if (k + 1 < line.length && line[k].v === line[k + 1].v) {
            const m = { v: line[k].v * 2, id: line[k].id, merged: true }; gain += m.v; out.push(m);
            // birleşen ikinci taş birinciye doğru kayıp kaybolsun
            const ghost = tilesEl.querySelector(`[data-id="${line[k + 1].id}"]`); if (ghost) { const [r, c] = get(i, out.length - 1); ghost.style.setProperty('--r', r); ghost.style.setProperty('--c', c); ghost.dataset.gone = 1; setTimeout(() => ghost.remove(), 130); }
            k++;
          } else out.push(line[k]);
        }
        for (let j = 0; j < 4; j++) { const [r, c] = get(i, j); next[r][c] = out[j] || null; if ((grid[r][c] && grid[r][c].id) !== (next[r][c] && next[r][c].id) || (next[r][c] && next[r][c].merged)) moved = true; }
      }
      if (!moved) return;
      hist.push(prev); if (hist.length > 20) hist.shift();
      grid = next; score += gain; if (gain) blip(300 + Math.log2(gain) * 60, .1); add(); render(false);
      if (!won && grid.some(r => r.some(t => t && t.v >= 2048))) { won = true; showOver(T('🎉 2048! Harikasın!', '🎉 2048! Brilliant!'), true); if (true) confetti(); }
      else if (!canMove()) showOver(T('Hamle kalmadı', 'No moves left'));
    }
    function canMove() { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const t = grid[r][c]; if (!t) return true; if (c < 3 && grid[r][c + 1] && grid[r][c + 1].v === t.v) return true; if (r < 3 && grid[r + 1][c] && grid[r + 1][c].v === t.v) return true; } return false; }
    function showOver(t, canGo) { if (!canGo) typeof Scores !== 'undefined' && Scores.report('2048', score); over.hidden = false; over.innerHTML = `<b>${t}</b><span>${T('Skor', 'Score')}: ${score}</span><div>${canGo ? `<button class="bb-btn" data-a="go">${T('Devam et', 'Keep going')}</button>` : ''}<button class="bb-btn" data-a="again">${T('Yeni oyun', 'New game')}</button></div>`; over.querySelector('[data-a=again]').onclick = () => { ls.set('bb_2048_state', null); tilesEl.innerHTML = ''; fresh(); }; const g = over.querySelector('[data-a=go]'); if (g) g.onclick = () => { over.hidden = true; }; }
    b.querySelector('[data-a=new]').onclick = () => { click(); if (score > 0) typeof Scores !== 'undefined' && Scores.report('2048', score); ls.set('bb_2048_state', null); tilesEl.innerHTML = ''; fresh(); };
    b.querySelector('[data-a=undo]').onclick = () => { const h = hist.pop(); if (!h) return; click(); grid = h.g; score = h.s; over.hidden = true; tilesEl.innerHTML = ''; render(true); };
    const kd = e => { const d = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd' }[e.key]; if (d) { e.preventDefault(); move(d); } };
    addEventListener('keydown', kd); onLeave(() => removeEventListener('keydown', kd));
    const board = b.querySelector('.g2-board'); let sx = 0, sy = 0, act = false;
    board.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; act = true; });
    board.addEventListener('pointerup', e => { if (!act) return; act = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); });
    window.__g2048 = { move, get grid() { return grid; } };
  }

  /* ==================== SUDOKU ==================== */
  function sudokuGen(holes) {
    const g = Array(81).fill(0);
    const ok = (g, i, v) => { const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false; const rr = br + Math.floor(k / 3), cc = bc + k % 3; if (g[rr * 9 + cc] === v) return false; } return true; };
    const fill = (g) => { const i = g.indexOf(0); if (i < 0) return true; for (const v of shuffle9()) { if (ok(g, i, v)) { g[i] = v; if (fill(g)) return true; g[i] = 0; } } return false; };
    const shuffle9 = () => { const a = [1, 2, 3, 4, 5, 6, 7, 8, 9]; for (let i = 8; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const count = (g, lim) => { const i = g.indexOf(0); if (i < 0) return 1; let n = 0; for (let v = 1; v <= 9 && n < lim; v++) if (ok(g, i, v)) { g[i] = v; n += count(g, lim - n); g[i] = 0; } return n; };
    fill(g); const sol = g.slice(), puz = g.slice();
    const order = Array.from({ length: 81 }, (_, i) => i).sort(() => Math.random() - .5);
    let removed = 0;
    for (const i of order) { if (removed >= holes) break; const keep = puz[i]; puz[i] = 0; if (count(puz.slice(), 2) !== 1) puz[i] = keep; else removed++; }
    return { puz, sol };
  }
  const LVL = () => ({ kolay: T('Kolay', 'Easy'), orta: T('Orta', 'Medium'), zor: T('Zor', 'Hard') });
  function sudoku() {
    const lv = ls.get('bb_sudoku_level', 'orta');
    const b = shell('Sudoku', `<div class="sd-head"><div class="seg">${['kolay', 'orta', 'zor'].map(l => `<button data-l="${l}" class="${l === lv ? 'on' : ''}">${LVL()[l]}</button>`).join('')}</div><span class="sd-time">0:00</span><span class="sd-err">❌ 0</span></div>
      <div class="sd-grid"></div><div class="sd-tools"><button class="bb-btn" data-a="note">✏️ ${T('Not: Kapalı', 'Notes: Off')}</button><button class="bb-btn" data-a="erase">⌫ ${T('Sil', 'Erase')}</button><button class="bb-btn" data-a="hint">💡 ${T('İpucu', 'Hint')}</button></div>
      <div class="sd-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}</div>`);
    const gridEl = b.querySelector('.sd-grid'), tEl = b.querySelector('.sd-time'), eEl = b.querySelector('.sd-err');
    let P, S, cur, notes, sel = -1, noteMode = false, errs = 0, t0, timer, done = false;
    function start(level) {
      ls.set('bb_sudoku_level', level);
      b.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x.dataset.l === level));
      gridEl.innerHTML = `<p class="bb-tip">${T('Bulmaca hazırlanıyor…', 'Preparing the puzzle…')}</p>`;
      setTimeout(() => {
        const { puz, sol } = sudokuGen({ kolay: 38, orta: 47, zor: 54 }[level]); P = puz; S = sol; cur = puz.slice(); notes = Array.from({ length: 81 }, () => new Set());
        sel = -1; errs = 0; eEl.textContent = '❌ 0'; done = false; t0 = Date.now(); clearInterval(timer); timer = setInterval(() => { if (!done) tEl.textContent = fmtT((Date.now() - t0) / 1000); }, 500);
        draw();
      }, 30);
    }
    onLeave(() => clearInterval(timer));
    function draw() {
      gridEl.innerHTML = '';
      const sv = sel >= 0 ? cur[sel] : 0;
      for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9), c = i % 9, d = document.createElement('button');
        d.className = 'sd-c' + (P[i] ? ' given' : '') + (i === sel ? ' sel' : '') + (sel >= 0 && (Math.floor(sel / 9) === r || sel % 9 === c || (Math.floor(Math.floor(sel / 9) / 3) === Math.floor(r / 3) && Math.floor(sel % 9 / 3) === Math.floor(c / 3))) ? ' rel' : '') + (sv && cur[i] === sv ? ' same' : '') + (cur[i] && !P[i] && cur[i] !== S[i] ? ' bad' : '') + (c % 3 === 2 && c < 8 ? ' br' : '') + (r % 3 === 2 && r < 8 ? ' bb' : '');
        if (cur[i]) d.textContent = cur[i];
        else if (notes[i].size) d.innerHTML = `<span class="nt">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<i>${notes[i].has(n) ? n : ''}</i>`).join('')}</span>`;
        d.onclick = () => { sel = i; draw(); };
        gridEl.appendChild(d);
      }
      b.querySelectorAll('.sd-pad button').forEach(x => { const n = +x.dataset.n; x.classList.toggle('full', cur.filter(v => v === n).length >= 9); });
    }
    function put(n) {
      if (done || sel < 0 || P[sel]) return;
      if (noteMode) { notes[sel].has(n) ? notes[sel].delete(n) : notes[sel].add(n); draw(); return; }
      cur[sel] = n; notes[sel].clear();
      if (n !== S[sel]) { errs++; eEl.textContent = '❌ ' + errs; blip(160, .15); }
      else { blip(660, .07); const r = Math.floor(sel / 9), c = sel % 9; for (let k = 0; k < 9; k++) { notes[r * 9 + k].delete(n); notes[k * 9 + c].delete(n); notes[(r - r % 3 + Math.floor(k / 3)) * 9 + (c - c % 3 + k % 3)].delete(n); } }
      draw();
      if (cur.every((v, i) => v === S[i])) { done = true; clearInterval(timer); const t = (Date.now() - t0) / 1000; const best = ls.get('bb_best_sudoku', null); if (!best || t < best) ls.set('bb_best_sudoku', Math.round(t)); { const lvl = ls.get('bb_sudoku_level', 'orta'); if (lvl !== 'kolay' && typeof Scores !== 'undefined') Scores.report('sudoku', Math.round(t), { level: lvl, errs }); } if (true) confetti(); if (true) Snd.win(); toast(T(`🧩 Bitti! ${fmtT(t)} · ${errs} hata`, `🧩 Solved! ${fmtT(t)} · ${errs} mistakes`)); }
    }
    b.querySelectorAll('.sd-pad button').forEach(x => x.onclick = () => put(+x.dataset.n));
    b.querySelectorAll('.seg button').forEach(x => x.onclick = () => { click(); start(x.dataset.l); });
    b.querySelector('[data-a=note]').onclick = e => { noteMode = !noteMode; e.target.textContent = '✏️ ' + (noteMode ? T('Not: Açık', 'Notes: On') : T('Not: Kapalı', 'Notes: Off')); e.target.classList.toggle('on', noteMode); };
    b.querySelector('[data-a=erase]').onclick = () => { if (sel >= 0 && !P[sel]) { cur[sel] = 0; notes[sel].clear(); draw(); } };
    b.querySelector('[data-a=hint]').onclick = () => { if (done) return; let i = sel >= 0 && !P[sel] && cur[sel] !== S[sel] ? sel : cur.findIndex((v, k) => v !== S[k]); if (i < 0) return; sel = i; const nm = noteMode; noteMode = false; put(S[i]); noteMode = nm; };
    const kd = e => { if (/^[1-9]$/.test(e.key)) put(+e.key); else if (e.key === 'Backspace' || e.key === 'Delete') b.querySelector('[data-a=erase]').click(); else if (sel >= 0 && e.key.startsWith('Arrow')) { e.preventDefault(); const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key]; sel = (sel + d + 81) % 81; draw(); } };
    addEventListener('keydown', kd); onLeave(() => removeEventListener('keydown', kd));
    start(lv);
    window.__sudoku = { solve: () => { for (let i = 0; i < 81; i++) if (!P[i] && cur[i] !== S[i]) { sel = i; put(S[i]); } } };
  }

  /* ==================== MAYIN TARLASI ==================== */
  function mines() {
    const lv = ls.get('bb_mines_level', 'orta');
    const LV = { kolay: [9, 9, 10], orta: [9, 14, 22], zor: [12, 18, 45] };
    const b = shell(T('Mayın<br>Tarlası', 'Mine-<br>sweeper'), `<div class="sd-head"><div class="seg">${Object.keys(LV).map(l => `<button data-l="${l}" class="${l === lv ? 'on' : ''}">${LVL()[l]}</button>`).join('')}</div><span class="mn-left">💣 0</span><span class="mn-time">0:00</span></div>
      <div class="mn-wrap"><div class="mn-grid"></div></div><div class="sd-tools"><button class="bb-btn mn-mode" data-a="mode">⛏️ ${T('Kazma modu', 'Dig mode')}</button><button class="bb-btn" data-a="new">🙂 ${T('Yeni', 'New')}</button></div><p class="bb-tip">${T('Uzun bas: bayrak · Açık sayıya dokun: çevresini aç', 'Long-press: flag · Tap an open number: clear around it')}</p>`);
    const gridEl = b.querySelector('.mn-grid'), leftEl = b.querySelector('.mn-left'), tEl = b.querySelector('.mn-time'), modeB = b.querySelector('[data-a=mode]');
    let W, H, M, cells, first, over, flagMode = false, t0, timer, level = lv;
    onLeave(() => clearInterval(timer));
    function start(l) {
      level = l; ls.set('bb_mines_level', l); b.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x.dataset.l === l));
      [W, H, M] = LV[l]; cells = Array.from({ length: W * H }, () => ({ m: false, n: 0, o: false, f: false })); first = true; over = false;
      clearInterval(timer); tEl.textContent = '0:00'; gridEl.style.gridTemplateColumns = `repeat(${W},1fr)`; gridEl.style.setProperty('--w', W);
      gridEl.innerHTML = cells.map((_, i) => `<button class="mn-c" data-i="${i}"></button>`).join(''); bind(); count();
    }
    const nb = i => { const x = i % W, y = Math.floor(i / W), r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) r.push(ny * W + nx); } return r; };
    function plant(safe) { const ban = new Set([safe, ...nb(safe)]); let k = 0; while (k < M) { const i = Math.floor(Math.random() * W * H); if (ban.has(i) || cells[i].m) continue; cells[i].m = true; k++; } cells.forEach((c, i) => c.n = nb(i).filter(j => cells[j].m).length); t0 = Date.now(); timer = setInterval(() => { if (!over) tEl.textContent = fmtT((Date.now() - t0) / 1000); }, 500); }
    function openC(i) {
      const c = cells[i]; if (c.o || c.f) return;
      if (first) { first = false; plant(i); }
      c.o = true;
      if (c.m) return lose(i);
      if (!c.n) { const st = [i]; while (st.length) { const k = st.pop(); for (const j of nb(k)) { const d = cells[j]; if (!d.o && !d.f && !d.m) { d.o = true; if (!d.n) st.push(j); } } } }
    }
    function act(i, flag) {
      if (over) return; const c = cells[i];
      if (flag) { if (!c.o) { c.f = !c.f; blip(c.f ? 880 : 440, .06); } }
      else if (c.o && c.n) { const f = nb(i).filter(j => cells[j].f).length; if (f === c.n) nb(i).forEach(j => openC(j)); }
      else openC(i);
      paint(); count(); check();
    }
    function paint() { gridEl.querySelectorAll('.mn-c').forEach((e, i) => { const c = cells[i]; e.className = 'mn-c' + (c.o ? ' o n' + c.n : '') + (c.f && !c.o ? ' f' : '') + (over && c.m ? ' m' : '') + (c.boom ? ' boom' : ''); e.textContent = c.o ? (c.m ? '💥' : c.n || '') : c.f ? '🚩' : (over && c.m ? '💣' : ''); }); }
    function count() { leftEl.textContent = '💣 ' + (M - cells.filter(c => c.f).length); }
    function lose(i) { over = true; cells[i].boom = true; clearInterval(timer); paint(); blip(120, .4, .08); toast(T('💥 Mayına bastın! Tekrar dene', '💥 You hit a mine! Have another go')); }
    function check() { if (over) return; if (cells.every(c => c.m || c.o)) { over = true; clearInterval(timer); const t = (Date.now() - t0) / 1000; if (level !== 'kolay') { const bst = ls.get('bb_best_mines', null); if (!bst || t < bst) ls.set('bb_best_mines', Math.round(t)); typeof Scores !== 'undefined' && Scores.report('mines', Math.round(t), { level }); } cells.forEach(c => { if (c.m) c.f = true; }); paint(); if (true) confetti(); toast(T(`😎 Tarla temizlendi! ${fmtT(t)}`, `😎 Field cleared! ${fmtT(t)}`)); } }
    function bind() {
      gridEl.querySelectorAll('.mn-c').forEach(e => {
        const i = +e.dataset.i; let lt = null, longP = false;
        e.addEventListener('pointerdown', () => { longP = false; lt = setTimeout(() => { longP = true; act(i, true); if (navigator.vibrate) navigator.vibrate(25); }, 420); });
        const cancel = () => clearTimeout(lt);
        e.addEventListener('pointerup', () => { cancel(); if (!longP) act(i, flagMode); });
        e.addEventListener('pointerleave', cancel); e.addEventListener('contextmenu', ev => { ev.preventDefault(); cancel(); if (!longP) act(i, true); longP = true; });
      });
    }
    modeB.onclick = () => { flagMode = !flagMode; modeB.textContent = flagMode ? T('🚩 Bayrak modu', '🚩 Flag mode') : T('⛏️ Kazma modu', '⛏️ Dig mode'); modeB.classList.toggle('on', flagMode); };
    b.querySelector('[data-a=new]').onclick = () => { click(); start(level); };
    b.querySelectorAll('.seg button').forEach(x => x.onclick = () => { click(); start(x.dataset.l); });
    start(lv);
    window.__mines = { win: () => { if (first) act(0, false); cells.forEach((c, i) => { if (!c.m && !c.o) { c.o = true; } }); paint(); check(); }, get over() { return over; } };
  }

  /* ==================== BLOK YIĞ (Tetris tarzı) ==================== */
  function blocks() {
    const b = shell(T('Blok Yığ', 'Block Stack'), `<div class="bk-wrap"><canvas class="bk-cv" width="200" height="400"></canvas><div class="bk-side"><div class="g2-sc"><small>${T('SKOR', 'SCORE')}</small><b class="sc">0</b></div><div class="g2-sc"><small>${T('SATIR', 'LINES')}</small><b class="ln">0</b></div><div class="g2-sc"><small>${T('SEVİYE', 'LEVEL')}</small><b class="lvv">1</b></div><div class="g2-sc"><small>${T('SIRADAKİ', 'NEXT')}</small><canvas class="bk-nx" width="80" height="80"></canvas></div><div class="g2-sc"><small>${T('EN İYİ', 'BEST')}</small><b class="bs">${ls.get('bb_best_blocks', 0)}</b></div><button class="bb-btn" data-a="pause">⏸</button></div></div>
      <div class="bk-ctrl"><button data-k="l">◀</button><button data-k="rot">⟳</button><button data-k="r">▶</button><button data-k="d">▼</button><button data-k="drop">⤓</button></div><div class="bk-over" hidden></div>`);
    const cv = b.querySelector('.bk-cv'), g = cv.getContext('2d'), nx = b.querySelector('.bk-nx').getContext('2d');
    const COLS = 10, ROWS = 20;
    const SH = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
    const COL = { I: '#4fd1ff', O: '#ffd23f', T: '#b06bff', S: '#43d17a', Z: '#ff5d6c', J: '#4f7bff', L: '#ff9a3c' };
    let board, piece, nextK, score, lines, level, dropT, run = true, paused = false, overF = false, bag = [], clearing = null;
    const sz = () => { const W = cv.clientWidth || 200; return W / COLS; };
    function newBag() { bag = Object.keys(SH).sort(() => Math.random() - .5); }
    function take() { if (!bag.length) newBag(); return bag.pop(); }
    function spawn() { const k = nextK || take(); nextK = take(); piece = { k, cells: SH[k].map(c => c.slice()), x: 3, y: k === 'I' ? -1 : 0 }; if (collide(piece.cells, piece.x, piece.y)) gameOver(); drawNext(); }
    function collide(cells, x, y) { return cells.some(([cx, cy]) => { const X = cx + x, Y = cy + y; return X < 0 || X >= COLS || Y >= ROWS || (Y >= 0 && board[Y][X]); }); }
    function rotate() { if (piece.k === 'O') return; const size = piece.k === 'I' ? 4 : 3; const rc = piece.cells.map(([x, y]) => [size - 1 - y, x]); for (const kx of [0, -1, 1, -2, 2]) if (!collide(rc, piece.x + kx, piece.y)) { piece.cells = rc; piece.x += kx; blip(520, .04, .03); return; } }
    function lock() {
      piece.cells.forEach(([cx, cy]) => { const Y = cy + piece.y; if (Y >= 0) board[Y][cx + piece.x] = piece.k; });
      const full = []; board.forEach((r, y) => { if (r.every(v => v)) full.push(y); });
      if (full.length) { clearing = { rows: full, t: 0 }; blip(700 + full.length * 100, .2, .06); }
      else spawn();
    }
    function finishClear() {
      const n = clearing.rows.length; board = board.filter((_, y) => !clearing.rows.includes(y)); while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
      lines += n; score += [0, 100, 300, 500, 800][n] * level; level = 1 + Math.floor(lines / 10); clearing = null; hud(); spawn();
    }
    function hud() { b.querySelector('.sc').textContent = score; b.querySelector('.ln').textContent = lines; b.querySelector('.lvv').textContent = level; const best = Math.max(score, ls.get('bb_best_blocks', 0)); ls.set('bb_best_blocks', best); b.querySelector('.bs').textContent = best; }
    function stepDown(soft) { if (!piece || clearing) return; if (!collide(piece.cells, piece.x, piece.y + 1)) { piece.y++; if (soft) score += 1; } else lock(); }
    function hardDrop() { if (!piece || clearing) return; let d = 0; while (!collide(piece.cells, piece.x, piece.y + 1)) { piece.y++; d++; } score += d * 2; lock(); hud(); }
    function moveX(dx) { if (piece && !clearing && !collide(piece.cells, piece.x + dx, piece.y)) piece.x += dx; }
    function gameOver() { overF = true; run = false; if (score > 0) typeof Scores !== 'undefined' && Scores.report('blocks', score, { lines }); const o = b.querySelector('.bk-over'); o.hidden = false; o.innerHTML = `<b>${T('Oyun bitti', 'Game over')}</b><span>${T('Skor', 'Score')}: ${score}</span><button class="bb-btn">${T('Yeniden başla', 'Play again')}</button>`; o.querySelector('button').onclick = () => { o.hidden = true; start(); }; hud(); }
    function cell(x, y, k, s, alpha) { g.globalAlpha = alpha || 1; const c = COL[k]; g.fillStyle = c; g.beginPath(); g.roundRect(x * s + 1, y * s + 1, s - 2, s - 2, s * .18); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x * s + 3, y * s + 3, s - 6, s * .22); g.globalAlpha = 1; }
    function draw() {
      const s = sz(), W = COLS * s, H = ROWS * s, dpr = Math.min(devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.05)'; for (let x = 1; x < COLS; x++) { g.beginPath(); g.moveTo(x * s, 0); g.lineTo(x * s, H); g.stroke(); }
      board.forEach((r, y) => r.forEach((k, x) => { if (k) cell(x, y, k, s, clearing && clearing.rows.includes(y) ? (Math.sin(clearing.t * 30) > 0 ? 1 : .3) : 1); }));
      if (piece && !clearing) {
        let gy = piece.y; while (!collide(piece.cells, piece.x, gy + 1)) gy++;
        piece.cells.forEach(([cx, cy]) => { if (cy + gy >= 0) cell(cx + piece.x, cy + gy, piece.k, s, .22); });
        piece.cells.forEach(([cx, cy]) => { if (cy + piece.y >= 0) cell(cx + piece.x, cy + piece.y, piece.k, s); });
      }
    }
    function drawNext() { nx.clearRect(0, 0, 80, 80); const c = SH[nextK], s = 18; const minx = Math.min(...c.map(p => p[0])), maxx = Math.max(...c.map(p => p[0])), miny = Math.min(...c.map(p => p[1])), maxy = Math.max(...c.map(p => p[1])); const ox = (80 - (maxx - minx + 1) * s) / 2 - minx * s, oy = (80 - (maxy - miny + 1) * s) / 2 - miny * s; nx.fillStyle = COL[nextK]; c.forEach(([x, y]) => { nx.beginPath(); nx.roundRect(ox + x * s + 1, oy + y * s + 1, s - 2, s - 2, 3); nx.fill(); }); }
    let last = performance.now();
    function loop(t) {
      if (!run) return; const dt = Math.min(.1, (t - last) / 1000); last = t;
      if (!paused) {
        if (clearing) { clearing.t += dt; if (clearing.t > .35) finishClear(); }
        else { dropT += dt; const iv = Math.max(.08, .8 - (level - 1) * .07); if (dropT > iv) { dropT = 0; stepDown(false); } }
      }
      draw(); requestAnimationFrame(loop);
    }
    function start() { board = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); score = 0; lines = 0; level = 1; dropT = 0; nextK = null; newBag(); overF = false; paused = false; clearing = null; spawn(); hud(); if (!run) { run = true; last = performance.now(); requestAnimationFrame(loop); } }
    onLeave(() => { run = false; });
    const act = k => { if (overF || paused) return; if (k === 'l') moveX(-1); else if (k === 'r') moveX(1); else if (k === 'rot') rotate(); else if (k === 'd') { stepDown(true); hud(); } else if (k === 'drop') hardDrop(); };
    b.querySelectorAll('.bk-ctrl button').forEach(btn => {
      let rt = null; const k = btn.dataset.k;
      btn.addEventListener('pointerdown', e => { e.preventDefault(); act(k); if (k === 'l' || k === 'r' || k === 'd') rt = setInterval(() => act(k), 90); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, () => clearInterval(rt)));
    });
    b.querySelector('[data-a=pause]').onclick = e => { paused = !paused; e.target.textContent = paused ? '▶' : '⏸'; };
    const kd = e => { const m = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'rot', ArrowDown: 'd', ' ': 'drop', x: 'rot', z: 'rot' }[e.key]; if (m) { e.preventDefault(); act(m); } if (e.key === 'p') b.querySelector('[data-a=pause]').click(); };
    addEventListener('keydown', kd); onLeave(() => removeEventListener('keydown', kd));
    // kaydırma: sağ/sol taşı, aşağı bırak, dokun döndür
    let sx = 0, sy = 0, moved = 0;
    cv.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; moved = 0; });
    cv.addEventListener('pointermove', e => { if (!e.buttons && e.pointerType === 'mouse') return; const s = sz(), dx = e.clientX - sx; if (Math.abs(dx) > s) { act(dx > 0 ? 'r' : 'l'); sx = e.clientX; moved = 1; } });
    cv.addEventListener('pointerup', e => { const dy = e.clientY - sy; if (dy > 60) act('drop'); else if (!moved && Math.abs(dy) < 10) act('rot'); });
    run = false; start();
    window.__blocks = { get score() { return score; }, get lines() { return lines; }, drop: hardDrop, get over() { return overF; } };
  }

  /* ---------------- yönlendirme ---------------- */
  function lockScreen() {
    document.body.classList.add('locked'); document.body.classList.remove('work-mode', 'dark-mode', 'cbn-mode', 'cbn-dark');
    const m = fromUrl(), pc = m ? m.c : '', pn = m ? m.n : '';
    root().innerHTML = `<section class="hero lockhero"><p class="eyebrow">${T('Özel alan · yalnızca davetliler', 'Private space · invitation only')}</p><h1 class="display xl">BABA<em>.</em></h1>
      <div class="lock-opts">
        <button class="pill big" data-a="open">🔒 ${T('Sahibi olarak gir', 'Sign in as the owner')}</button>
        <form class="lock-card" data-f="inv"><h3>🎟 ${T('Davet kodum var', 'I have an invitation code')}</h3><input name="n" placeholder="${T('Adın', 'Your name')}" value="${esc(pn)}" required maxlength="40"><input name="c" placeholder="${T('Kod (ör. B-1A2B3C)', 'Code (e.g. B-1A2B3C)')}" value="${esc(pc)}" required maxlength="12"><button class="pill">${T('Giriş yap', 'Sign in')}</button><p class="lock-msg"></p></form>
        <form class="lock-card" data-f="req"><h3>✋ ${T('Katılma isteği gönder', 'Ask to join')}</h3><p class="muted sm">${T('BABA. yalnızca Oğuzhan’ın onay verdiği kişilere açık. İsteğini gönder; uygun görürse sana bir davet kodu yollar.', 'BABA. is open only to people Oğuzhan has approved. Send your request; if he is happy with it, he will send you an invitation code.')}</p><input name="n" placeholder="${T('Adın', 'Your name')}" required maxlength="40"><textarea name="m" rows="2" placeholder="${T('Kısa bir not (isteğe bağlı)', 'A short note (optional)')}" maxlength="300"></textarea><button class="pill ghost">${T('İsteği gönder', 'Send request')}</button></form>
      </div></section>`;
    const q = s => root().querySelector(s);
    q('[data-a=open]').onclick = askOpen;
    q('[data-f=inv]').onsubmit = e => { e.preventDefault(); const f = e.target, n = f.n.value.trim(), c = f.c.value.trim().toUpperCase();
      if (inviteCode(n) !== c) { f.querySelector('.lock-msg').textContent = T('Kod bu isimle eşleşmiyor. Adını davetteki gibi yaz.', 'That code doesn’t match this name. Type your name exactly as it appears in the invitation.'); return; }
      guest = { name: n, code: c, at: Date.now() }; ls.set('baba_guest', guest); location.hash = ''; guestUrl(); render(); };
    q('[data-f=req]').onsubmit = e => { e.preventDefault(); const f = e.target, t = T(`Merhaba Oğuzhan, BABA. uygulamasına katılmak istiyorum.\nAdım: ${f.n.value.trim()}${f.m.value.trim() ? '\nNot: ' + f.m.value.trim() : ''}`, `Hi Oğuzhan, I’d like to join the BABA. app.\nMy name: ${f.n.value.trim()}${f.m.value.trim() ? '\nNote: ' + f.m.value.trim() : ''}`);
      if (navigator.share) navigator.share({ title: T('BABA. katılma isteği', 'BABA. join request'), text: t }).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener'); };
    if (!m) askOpen();
  }
  function render() {
    leave(); if (typeof Draft !== 'undefined') Draft.stop();
    if (typeof CBN !== 'undefined') CBN.leave();
    document.querySelectorAll('.bb-pin-ov').forEach(e => e.remove());
    if (!canIn()) return lockScreen();
    document.body.classList.remove('locked');
    let r = location.hash.slice(1); if (r.startsWith('davet=')) { r = ''; history.replaceState(null, '', location.pathname + location.search); }
    guestUrl();
    const isCbn = r === 'cbn' || r.startsWith('cbn/');
    if (OWNER_ONLY.includes(r) && !isOwner()) r = '';
    if (isCbn && !canIn()) r = '';
    const cbnOn = isCbn && r !== '' && typeof CBN !== 'undefined';
    document.body.classList.toggle('cbn-mode', cbnOn); if (!cbnOn) document.body.classList.remove('cbn-dark');
    document.body.classList.toggle('guest', isGuest());
    document.body.classList.toggle('work-mode', r === 'is');
    document.body.classList.toggle('msn-mode', r === 'msn');
    document.body.classList.toggle('dark-mode', ['seyahat', 'gezilerim', 'foto'].includes(r));
    document.querySelectorAll('.nav a[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === r || (a.dataset.r === 'cbn' && cbnOn) || (a.dataset.r === 'dost' && r.startsWith('dost/')) || (a.dataset.r === 'oyunlar' && GAMES.some(g => g.id === r))));
    if (['kesfet','hayat','sosyal','ismerkez'].includes(r) && typeof BABAGroups !== 'undefined' && (r!=='ismerkez'||isOwner())) { root().innerHTML='<div id="groupRoot"></div>'; BABAGroups.open(root().querySelector('#groupRoot'),r); }
    else if (r === 'today' && typeof BABADaily !== 'undefined') { root().innerHTML='<div id="dailyRoot"></div>'; BABADaily.openToday(root().querySelector('#dailyRoot')); }
    else if (r === 'backup' && typeof BABADaily !== 'undefined') { root().innerHTML='<div id="backupRoot"></div>'; BABADaily.openBackup(root().querySelector('#backupRoot')); }
    else if (r === 'ts' && typeof TS !== 'undefined') { root().innerHTML = '<div id="tsRoot"></div>'; window.scrollTo(0, 0); TS.open(root().querySelector('#tsRoot')); }
    else if (cbnOn) { root().innerHTML = '<div id="cbnRoot"></div>'; window.scrollTo(0, 0); CBN.open(root().querySelector('#cbnRoot'), r); }
    else if (r === 'gundem' && typeof Gundem !== 'undefined') { root().innerHTML = '<div id="gundemRoot"></div>'; window.scrollTo(0,0); Gundem.open(root().querySelector('#gundemRoot')); }
    else if (r === 'lab' && typeof Lab !== 'undefined') { root().innerHTML = '<div id="labRoot"></div>'; window.scrollTo(0,0); Lab.open(root().querySelector('#labRoot')); }
    else if (r === 'play' && typeof Play !== 'undefined') { root().innerHTML = '<div id="playRoot"></div>'; window.scrollTo(0,0); Play.open(root().querySelector('#playRoot')); }
    else if (r === 'akis' && typeof Akis !== 'undefined') { root().innerHTML = '<div id="akisRoot"></div>'; window.scrollTo(0,0); Akis.open(root().querySelector('#akisRoot')); }
    else if (r === 'hayat-oyunu' && typeof LifeGame !== 'undefined') { root().innerHTML='<section class="game-page"><div class="gp-head"><a class="back" href="#oyunlar">← '+T('Oyunlar','Games')+'</a></div><div id="lifeGameRoot"></div></section>';window.scrollTo(0,0);LifeGame.open(root().querySelector('#lifeGameRoot')); }
    else if (r === 'draft') { root().innerHTML = '<section class="game-page" id="draft-section"><div class="gp-head"><a class="back" href="#futbol">← ' + T('Futbol', 'Football') + '</a><nav class="mode-switch" aria-label="' + T('Futbol modları', 'Football modes') + '"><a class="on" href="#draft" aria-current="page">⚽ ' + T('Draft Modu', 'Draft Mode') + '</a><a href="#career">🎮 ' + T('Menajerlik Kariyeri', 'Manager Career') + '</a></nav><button type="button" class="football-fs-btn" data-football-fullscreen aria-pressed="false">' + T('Tam ekran', 'Full screen') + '</button></div><div id="draftRoot"></div></section>'; window.scrollTo(0, 0); Draft.open(root().querySelector('#draftRoot')); footballFullscreen(root().querySelector('#draft-section')); }
    else if (r === 'futbol' && typeof FootballHub !== 'undefined') { root().innerHTML = '<div id="footballRoot"></div>'; window.scrollTo(0, 0); FootballHub.open(root().querySelector('#footballRoot')); }
    else if (r === 'career' && typeof Career !== 'undefined') { root().innerHTML = '<section class="game-page" id="career-section"><div class="gp-head"><a class="back" href="#futbol">← ' + T('Futbol', 'Football') + '</a><nav class="mode-switch" aria-label="' + T('Futbol modları', 'Football modes') + '"><a href="#draft">⚽ ' + T('Draft Modu', 'Draft Mode') + '</a><a class="on" href="#career" aria-current="page">🎮 ' + T('Menajerlik Kariyeri', 'Manager Career') + '</a></nav><button type="button" class="football-fs-btn" data-football-fullscreen aria-pressed="false">' + T('Tam ekran', 'Full screen') + '</button></div><div id="careerRoot"></div></section>'; window.scrollTo(0, 0); Career.open(root().querySelector('#careerRoot')); footballFullscreen(root().querySelector('#career-section')); }
    else if (r === 'is' && typeof Is !== 'undefined') { root().innerHTML = '<div id="isRoot"></div>'; window.scrollTo(0, 0); Is.open(root().querySelector('#isRoot')); }
    else if ((r === 'dost' || r.startsWith('dost/')) && typeof Dost !== 'undefined') { root().innerHTML = '<div id="dostRoot"></div>'; window.scrollTo(0, 0); Dost.open(root().querySelector('#dostRoot'), r); }
    else if (r === 'msn' && typeof Msn !== 'undefined') { root().innerHTML = '<div id="msnRoot"></div>'; window.scrollTo(0, 0); Msn.mount(root().querySelector('#msnRoot')); }
    else if (r === 'skor' && typeof Scores !== 'undefined') { root().innerHTML = '<div id="scRoot"></div>'; window.scrollTo(0, 0); Scores.mount(root().querySelector('#scRoot')); }
    else if (r === 'istiklal1919') istiklal1919();
    else if (r === 'vadi') vadi();
    else if (r === 'kafa-topu') kafaTopu();
    else if (r === 'ates-ve-su' || r === 'wild-ones') { location.replace('#oyunlar'); return; }
    else if (r === 'yilan-arenasi') yilanArenasi();
    else if (ARCADE_IMPORTED.some(g => g.id === r)) importedArcadeGame(r);
    else if (r === 'gta-vice-city') gtaViceCity();
    else if (r === 'tekken-3') tekken3();
    else if (r === 'hungry-shark') hungryShark();
    else if (r === 'dsan-shipyard') dsanShipyard();
    else if (r === 'rota-conference') rotaConference();
    else if (r === 'runaway-cheese') runawayCheese();
    else if (r === 'sis-hatti') sisHatti();
    else if (r === 'living-island') livingIsland();
    else if (r === 'koy') koy();
    else if (r === 'yelken') yelken();
    else if (r === 'surus') openEmbeddedGame({
      title: T('SÜRÜŞ. — Konyaaltı', 'DRIVE. — Konyaaltı'),
      url: 'games/surus/index.html',
      tag: T('Sürüş simülasyonu', 'Driving simulator'),
      lead: T('Konyaaltı sahilinde yaklaşık 3 km sür.', 'Drive about 3 km along the Konyaaltı coast.'),
      tip: T('WASD veya ok tuşlarını kullan. Telefonda ekrandaki pedallara dokun.', 'Use WASD or the arrow keys. On phones, use the on-screen controls.')
    });
    else if (r === 'simitci') simitci();
    else if (r === 'yayla-savunmasi') yaylaSavunmasi();
    else if (r === 'amsterdam-coffeeshop') amsterdamCoffeeshop();
    else if (r === '2048') g2048();
    else if (r === 'sudoku') sudoku();
    else if (r === 'mines') mines();
    else if (r === 'blocks') blocks();
    else if (r === 'oyunlar') menu();
    else if (r === 'erisim') access();
    else if ((r === 'seyahat' || r === 'gezilerim') && typeof Travel !== 'undefined') { root().innerHTML = '<div id="tvRoot"></div>'; window.scrollTo(0, 0); Travel.open(root().querySelector('#tvRoot'), r); onLeave(() => Travel.leave()); }
    else if (r === 'foto' && typeof Foto !== 'undefined') { root().innerHTML = '<div id="ftRoot"></div>'; window.scrollTo(0, 0); Foto.open(root().querySelector('#ftRoot')); onLeave(() => Foto.leave()); }
    else hub();
    if (GAMES.some(g => g.id === r) && typeof BABALibrary !== 'undefined') BABALibrary.track(r);
    if(typeof BABAEnhance!=='undefined') BABAEnhance.enhance();
    if(typeof BABADaily!=='undefined') BABADaily.refresh();
    if(typeof BABAGroups!=='undefined') BABAGroups.refresh();
    // Animate each route once on entry; don't interrupt inputs or long-running widgets.
    const appRoot=root();
    appRoot.classList.remove('bb-route-enter');
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      void appRoot.offsetWidth;
      appRoot.classList.add('bb-route-enter');
      appRoot.addEventListener('animationend',e=>{if(e.target===appRoot)appRoot.classList.remove('bb-route-enter')},{once:true});
    }
  }
  addEventListener('hashchange', render);
  return { render, leave, askOpen, lock: () => { if (isOwner()) lock(); else if (confirm(T('Davetli erişimi bu cihazdan kaldırılsın mı?', 'Remove guest access from this device?'))) guestOut(); }, isOwner, user: () => isOwner() ? { name: 'Oğuzhan', key: '' } : guest ? { name: guest.name, key: 'g-' + String(guest.code).toLowerCase().replace(/[^a-z0-9-]/g, '') } : null, get unlocked() { return unlocked; } };
})();
