/* DSAn Tersane Tycoon — çekirdek: dil, yardımcılar, kayıt migration'ı, erişilebilir modal ve dallı hikâye motoru.
   Tüm yeni modüller window.DSAN altında yaşar; ana oyun (index.html) yalnızca bu API'leri çağırır. */
(function () {
  'use strict';
  const DSAN = window.DSAN = window.DSAN || {};

  // ---------- Dil (BABA. ile ortak 'baba_lang' anahtarı) ----------
  let lang = 'tr';
  try { lang = localStorage.getItem('baba_lang') === 'en' ? 'en' : 'tr'; } catch (e) {}
  const subs = [];
  DSAN.lang = () => lang;
  DSAN.T = (tr, en) => (lang === 'en' && en != null ? en : tr);
  DSAN.onLang = f => subs.push(f);
  DSAN.setLang = l => {
    l = l === 'en' ? 'en' : 'tr'; if (l === lang) return; lang = l;
    try { localStorage.setItem('baba_lang', l); } catch (e) {}
    document.documentElement.lang = l;
    subs.forEach(f => { try { f(l); } catch (e) { console.error(e); } });
  };
  document.documentElement.lang = lang;

  // ---------- Yardımcılar ----------
  const U = DSAN.util = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    irand: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    money: n => (typeof window.fmtMoney === 'function' ? window.fmtMoney(n) : '$' + Math.round(n).toLocaleString('en-US')),
    uid: p => (p || 'id') + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    // Aynı tohumla aynı sonuç: tekne başına sabit detaylar ve tekrarlanabilir testler için
    rng(seed) { let a = typeof seed === 'number' ? seed : U.hash(String(seed)); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
    hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
    sign: v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v)),
    reducedMotion: () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  };

  // ---------- Kayıt sürümü ve migration ----------
  // Eski kayıt anahtarı (dsan_3d_tycoon_save_v2) korunur; yeni alanlar aynı nesneye eklenir.
  // İlk geçişte orijinal kayıt bir kez yedeklenir, eski sürüm oyun da aynı kaydı okumaya devam edebilir.
  DSAN.SAVE_KEY = 'dsan_3d_tycoon_save_v2';
  DSAN.BACKUP_KEY = 'dsan_3d_tycoon_save_v2_backup_pre_v3';
  DSAN.SAVE_VERSION = 3;
  DSAN.migrate = function (state, raw) {
    // Sürüm kayıttaki ham veriden okunur (varsayılan durum zaten v3 alanlarıyla başlar)
    let from = DSAN.SAVE_VERSION; if (raw) { try { from = JSON.parse(raw).saveVersion || 2; } catch (e) { from = 2; } }
    if (from < 3 && raw) { try { if (!localStorage.getItem(DSAN.BACKUP_KEY)) localStorage.setItem(DSAN.BACKUP_KEY, raw); } catch (e) {} }
    state.settings = Object.assign({ quality: 'auto', showFps: false }, state.settings || {});
    state.hr = Object.assign({ interviews: 0, hires: 0, rejected: 0, history: [] }, state.hr || {});
    state.customers = Object.assign({ visits: [], history: [], nextVisitDay: (state.day || 1) + 1, won: 0, lost: 0, seq: 0 }, state.customers || {});
    state.trials = Array.isArray(state.trials) ? state.trials : [];
    (state.workers || []).forEach(w => DSAN.hr && DSAN.hr.normalizeWorker(w, state));
    (state.completedFleet || []).forEach(v => { if (!v.uid) v.uid = U.uid('v'); if (v.trial === undefined) v.trial = null; });
    // Eski 4 alanlı adaylar görüşme sistemi için zenginleştirilir
    if (DSAN.hr && (!Array.isArray(state.candidates) || state.candidates.some(c => !c.expYears))) state.candidates = [];
    state.saveVersion = DSAN.SAVE_VERSION;
    return state;
  };

  // ---------- Olay yolu ----------
  const ev = {};
  DSAN.on = (k, f) => (ev[k] = ev[k] || []).push(f);
  DSAN.emit = (k, d) => (ev[k] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } });

  // ---------- Erişilebilir modal ----------
  const UI = DSAN.ui = {};
  let modalStack = [];
  UI.modal = function (o) {
    const prevFocus = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'dz-ov' + (o.cls ? ' ' + o.cls : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="dz-modal${o.wide ? ' wide' : ''}" tabindex="-1">
      <header class="dz-mh"><div><h3 class="dz-mt"></h3>${o.sub ? '<p class="dz-ms"></p>' : ''}</div>
      ${o.closable === false ? '' : `<button class="dz-x" data-dz-close aria-label="${DSAN.T('Kapat', 'Close')}">${UI.icon('x')}</button>`}</header>
      <div class="dz-mb"></div></div>`;
    ov.querySelector('.dz-mt').textContent = o.title || '';
    if (o.sub) ov.querySelector('.dz-ms').textContent = o.sub;
    const body = ov.querySelector('.dz-mb');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    document.body.appendChild(ov);
    const box = ov.querySelector('.dz-modal');
    let closed = false;
    const api = {
      el: ov, body, box,
      setTitle(t) { ov.querySelector('.dz-mt').textContent = t; },
      close(reason) {
        if (closed) return; closed = true;
        modalStack = modalStack.filter(m => m !== api);
        ov.remove(); document.removeEventListener('keydown', key, true);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {}
        o.onClose && o.onClose(reason);
      }
    };
    function key(e) {
      if (modalStack[modalStack.length - 1] !== api) return;
      if (e.key === 'Escape' && o.closable !== false) { e.preventDefault(); e.stopPropagation(); api.close('esc'); return; }
      if (e.key === 'Tab') { // odak hapsi
        const f = [...box.querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      o.onKey && o.onKey(e);
    }
    document.addEventListener('keydown', key, true);
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-dz-close]')) api.close('x');
      else if (e.target === ov && o.closable !== false && o.backdropClose !== false) api.close('backdrop');
    });
    modalStack.push(api);
    requestAnimationFrame(() => { const f = box.querySelector('[data-autofocus]') || box.querySelector('button:not([data-dz-close])') || box; try { f.focus({ preventScroll: true }); } catch (e) {} });
    return api;
  };
  UI.anyOpen = () => modalStack.length > 0;

  // Satır içi SVG ikonlar (font/emoji'ye bağlı değil)
  const ICONS = {
    x: 'M6 6l12 12M18 6L6 18', play: 'M7 5l12 7-12 7z', pause: 'M8 5v14M16 5v14', skip: 'M5 5l10 7-10 7zM19 5v14',
    exit: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9', check: 'M5 12l5 5 9-10', arrow: 'M5 12h14M13 6l6 6-6 6', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6', ship: 'M3 15l2 5h14l2-5zM6 15V9h12v6M10 9V5h4v4', star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z',
    car: 'M4 16v-4l2-5h12l2 5v4zM4 16v2h3v-2M17 16v2h3v-2M7 13h2M15 13h2', bed: 'M3 18V8M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6', hard: 'M4 16h16M6 16a6 6 0 0112 0M12 6v4',
    chat: 'M4 5h16v11H9l-5 4z', wave: 'M2 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3', gauge: 'M4 18a8 8 0 1116 0M12 18l4-6', globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    fps: 'M4 19V9M10 19V5M16 19v-7M22 19H2', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z'
  };
  UI.icon = (k, s) => `<svg class="dz-ic" viewBox="0 0 24 24" width="${s || 16}" height="${s || 16}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[k] || ICONS.arrow}"/></svg>`;

  UI.bar = (v, cls) => `<span class="dz-bar ${cls || ''}"><i style="width:${U.clamp(Math.round(v), 0, 100)}%"></i></span>`;
  UI.chip = (txt, tone) => `<span class="dz-chip ${tone || ''}">${U.esc(txt)}</span>`;

  // ---------- Dallı hikâye motoru ----------
  // def: { title, sub, meters:[{k,label,fmt}], ctx, start, scenes:{ id: { image, speaker, title, text(ctx), custom(ctx, api)?, choices(ctx)|[] } }, onEnd(ctx, result) }
  // choice: { label, hint, chips:[[txt,tone]], when(ctx)?, apply(ctx) -> {next?, note?, end?} }
  DSAN.story = function (def) {
    const ctx = def.ctx;
    let sceneId = def.start, lastNote = '', ended = false;
    const m = UI.modal({ title: def.title, sub: def.sub, wide: true, cls: 'dz-story', backdropClose: false,
      onClose: r => { if (!ended) { ended = true; def.onEnd && def.onEnd(ctx, { aborted: true, reason: r }); } },
      onKey: e => { const n = +e.key; if (n >= 1 && n <= 6 && !(e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) { const b = m.body.querySelectorAll('[data-ch]')[n - 1]; if (b && !b.disabled) { e.preventDefault(); b.click(); } } } });
    function meters() {
      if (!def.meters) return '';
      return `<div class="dz-meters">${def.meters.map(x => { const v = typeof x.get === 'function' ? x.get(ctx) : ctx[x.k]; return `<div class="dz-meter"><span>${U.esc(x.label)}</span>${x.bar === false ? '' : UI.bar(v, x.tone)}<b>${x.fmt ? x.fmt(v, ctx) : Math.round(v)}</b></div>`; }).join('')}</div>`;
    }
    function render() {
      const sc = def.scenes[sceneId];
      if (!sc) return;
      const choices = (typeof sc.choices === 'function' ? sc.choices(ctx) : sc.choices || []).filter(c => !c.when || c.when(ctx));
      const img = typeof sc.image === 'function' ? sc.image(ctx) : sc.image;
      m.body.innerHTML = `<div class="dz-scene">
        <figure class="dz-art">${img ? `<img src="${img}" alt="" loading="eager">` : ''}<figcaption>${U.esc(typeof sc.title === 'function' ? sc.title(ctx) : sc.title || '')}</figcaption></figure>
        <div class="dz-txt">
          ${sc.step ? `<div class="dz-step">${U.esc(sc.step)}</div>` : ''}
          ${lastNote ? `<div class="dz-note" role="status">${lastNote}</div>` : ''}
          ${sc.speaker ? `<div class="dz-speaker">${UI.icon('chat', 14)} ${U.esc(typeof sc.speaker === 'function' ? sc.speaker(ctx) : sc.speaker)}</div>` : ''}
          <div class="dz-p">${typeof sc.text === 'function' ? sc.text(ctx) : sc.text || ''}</div>
          <div class="dz-custom"></div>
          <div class="dz-choices">${choices.map((c, i) => `<button class="dz-choice" data-ch="${i}" ${c.disabled && c.disabled(ctx) ? 'disabled' : ''}><kbd>${i + 1}</kbd><span><b>${U.esc(typeof c.label === 'function' ? c.label(ctx) : c.label)}</b>${c.hint ? `<small>${U.esc(typeof c.hint === 'function' ? c.hint(ctx) : c.hint)}</small>` : ''}${c.chips ? `<em>${(typeof c.chips === 'function' ? c.chips(ctx) : c.chips).map(([t, tone]) => UI.chip(t, tone)).join('')}</em>` : ''}</span></button>`).join('')}</div>
        </div></div>${meters()}`;
      if (sc.custom) sc.custom(ctx, { el: m.body.querySelector('.dz-custom'), refresh: refreshMeters, go, end });
      m.body.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => {
        const c = choices[+b.dataset.ch]; const r = (c.apply && c.apply(ctx)) || {};
        lastNote = r.note || '';
        if (r.end) return end(r.end);
        go(r.next || c.next);
      }));
      const first = m.body.querySelector('[data-ch]:not([disabled])'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
      m.body.scrollTop = 0;
    }
    function refreshMeters() { const old = m.body.querySelector('.dz-meters'); if (old) old.outerHTML = meters(); }
    function go(id) { if (!id) return; sceneId = id; render(); }
    function end(result) { if (ended) return; ended = true; m.close('end'); def.onEnd && def.onEnd(ctx, result || {}); }
    render();
    return { go, end, modal: m };
  };
})();
