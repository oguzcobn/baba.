/* =====================================================================
   BABA. — Menajerlik Kariyeri arayüz yardımcıları
   · CareerUI.ic(name)        → temiz inline SVG ikon (emoji yerine; her cihazda aynı görünür)
   · CareerUI.iconize(html)   → HTML içindeki metin düğümlerinde kalan emojileri SVG ikona çevirir
   · CareerUI.modal(html, o)  → koyu temalı oyun içi modal (window.confirm / alert yerine)
   · CareerUI.confirm / alert → Promise döndüren onay ve uyarı pencereleri
   ===================================================================== */
const CareerUI = (() => {
  'use strict';
  const T = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? en : tr;
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const F = 'fill="currentColor" stroke="none"';
  const PATHS = {
    ball: `<circle cx="12" cy="12" r="9"/><path d="M12 8l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" ${F}/><path d="M12 3v5M3.5 9.6l4.9 1M6.3 19l3.5-4.2M17.7 19l-3.5-4.2M20.5 9.6l-4.9 1"/>`,
    board: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    scope: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5"/>',
    cup: '<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v4M8 20h8"/>',
    yc: '<rect x="7" y="3.5" width="10" height="17" rx="1.8" fill="#f8d000" stroke="#7a6500"/>',
    rc: '<rect x="7" y="3.5" width="10" height="17" rx="1.8" fill="#e5484d" stroke="#7a1418"/>',
    sqb: '<rect x="5" y="5" width="14" height="14" rx="3" fill="#2f6fd6" stroke="none"/>',
    deal: '<path d="M3 11l4-4 4 2 2-2 4 0 4 4M7 15l3 3M10 13l3.5 3.5M13 11l4 4M3 11v6h3M21 11v6h-3"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    sprout: '<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2.5-5 6.5-5 0 3.5-2.5 5-6.5 5z"/>',
    med: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    stadium: '<ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v6c0 2.2 4 4 9 4s9-1.8 9-4V9M8 12.6v6M16 12.6v6"/>',
    play: `<path d="M8 5l11 7-11 7z" ${F}/>`,
    pause: `<rect x="6.5" y="5" width="4" height="14" rx="1" ${F}/><rect x="13.5" y="5" width="4" height="14" rx="1" ${F}/>`,
    ff: `<path d="M4 6l8 6-8 6zM12 6l8 6-8 6z" ${F}/>`,
    skip: `<path d="M5 6l10 6-10 6z" ${F}/><path d="M18 6v12"/>`,
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    cash: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
    crane: '<path d="M6 21V5l12 3M6 8h9M15 8v5M4 21h10M13.5 13h3v3h-3z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/>',
    tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 21h6M10 3l2 3 2-3"/>',
    up: '<path d="M4 17l5-5 4 3 7-8M15 7h5v5"/>',
    wave: '<path d="M8 13V6.5a1.5 1.5 0 013 0V12M11 11V5.5a1.5 1.5 0 013 0V12M14 12V7.5a1.5 1.5 0 013 0V15c0 3.3-2.5 6-6 6-2.6 0-4.2-1.3-5.5-3.5L4 14.5a1.5 1.5 0 012.6-1.5L8 15"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
    horn: '<path d="M4 10v4h3l8 4.5V5.5L7 10zM18 9.5a4 4 0 010 5"/>',
    glove: '<path d="M7 13V7.5a1.5 1.5 0 013 0V6a1.5 1.5 0 013 0v1.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-1a5 5 0 01-5-5v-1.5a1.5 1.5 0 013-.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6"/>',
    pen: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19zM14 6.5l3.5 3.5M12 20h8"/>',
    case: '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
    star: `<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" ${F}/>`,
    train: '<path d="M3 9v6M6 6.5v11M18 6.5v11M21 9v6M6 12h12"/>',
    flag: `<path d="M6 21V4"/><path d="M6 4h12l-2.5 4L18 12H6z" ${F}/>`,
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
    draw: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    in: '<path d="M12 4v10M8 10.5l4 4 4-4M5 19h14"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>',
    transfer: '<path d="M4 9h13l-3-3M20 15H7l3 3"/><circle cx="12" cy="12" r="9.2" opacity=".35"/>',
    club: '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.4v.2"/>',
    sparkle: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" ${F}/>`,
    assist: '<path d="M4 15.5c2.5 1 4-.5 5.5-2.5l2-4 2.5 1-1 4.5 5.5 1.5c1.5.4 2.5 1.4 2.5 3v1.5H4z"/><path d="M8.5 19.5v1.5M12.5 19.5v1.5M16.5 19.5v1.5"/>',
    ticket: '<path d="M3 8h18v3a2 2 0 000 4v3H3v-3a2 2 0 000-4zM14 8v10"/>',
    shirt: '<path d="M8 4l4 2 4-2 5 3-2 4-2-1v10H7V10l-2 1-2-4z"/>',
    tool: '<path d="M14.5 6.5a4 4 0 005 5L11 20l-3.5-3.5 8.5-8.5a4 4 0 00-1.5-1.5z"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    tower: '<path d="M9 21l1.5-13h3L15 21M8 8h8l-1-4H9zM7.5 15h9"/>',
    bolt: `<path d="M13 3L5 13.5h6L10 21l9-11.5h-6z" ${F}/>`,
    brain: '<path d="M9 5a3 3 0 00-3 3 3 3 0 00-1.5 5.5A3 3 0 009 18.5V5zM15 5a3 3 0 013 3 3 3 0 011.5 5.5A3 3 0 0115 18.5V5zM9 9.5H7M15 9.5h2M9 14h-2M15 14h2"/>',
    swirl: '<path d="M12 12a2 2 0 102-2 4.5 4.5 0 10-4.5 4.5A7 7 0 1016.5 7.5"/>',
    fire: '<path d="M12 3c1 3.5 5 5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5.2 1.5 1 2.5 2 2.5 0-3-0.5-5.5 1-8z"/>',
    calm: '<path d="M3 9c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0M3 15c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0"/>',
    thumb: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 012 2.3l-1 6a2 2 0 01-2 1.7H7"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    arrowUp: '<path d="M12 20V5M6 11l6-6 6 6"/>',
    press: '<path d="M5 12h9M10.5 7.5L15 12l-4.5 4.5M18.5 5v14"/>',
    whistle: '<circle cx="9" cy="14" r="5"/><path d="M9 9h11v4h-6.5M9 14h.01M15 5l1.5-2M18.5 5.5L20 4"/>',
    chart: '<path d="M4 20V5M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    bench: '<path d="M4 10h16v4H4zM6 14v5M18 14v5M6 10V6M18 10V6"/>',
    loan: '<path d="M4 8h12a4 4 0 010 8H8M7 5L4 8l3 3M17 19l3-3-3-3"/>',
    dot: `<circle cx="12" cy="12" r="5" ${F}/>`
  };
  const ic = (n, cls) => `<svg class="ci${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[n] || PATHS.dot}</svg>`;
  const EMOJI = { '⚽': 'ball', '📋': 'board', '🔭': 'scope', '🏆': 'cup', '🟥': 'rc', '🟨': 'yc', '🟦': 'sqb', '🤝': 'deal', '🔁': 'swap', '🔄': 'swap', '🌱': 'sprout', '🏥': 'med', '🚑': 'med', '🏟': 'stadium', '▶': 'play', '⏸': 'pause', '⏩': 'ff', '⏭': 'skip',
    '📅': 'cal', '💰': 'cash', '💸': 'cash', '🏗': 'crane', '🛡': 'shield', '📺': 'tv', '📈': 'up', '👋': 'wave', '📩': 'mail', '📣': 'horn', '🥊': 'glove', '🧤': 'glove', '🎤': 'mic', '✍': 'pen', '💼': 'case', '⭐': 'star', '🌟': 'star', '🏋': 'train', '🏁': 'flag',
    '✅': 'ok', '➖': 'draw', '❌': 'x', '📥': 'in', '🏠': 'home', '💱': 'transfer', '🏛': 'club', '⚠': 'warn', '✨': 'sparkle', '🅰': 'assist', '🎟': 'ticket', '👕': 'shirt', '🔧': 'tool', '🗑': 'trash', '🎯': 'target', '🗼': 'tower', '⚡': 'bolt', '🧠': 'brain', '🌀': 'swirl', '🔥': 'fire', '●': 'dot', '📊': 'chart', '🪑': 'bench' };
  const RX = new RegExp('(' + Object.keys(EMOJI).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gu');
  const swap = t => t.replace(/️/g, '').replace(RX, m => ic(EMOJI[m]));
  // Yalnızca etiket dışındaki metinde değişiklik yapar; <option> ve <textarea> içine SVG konmaz.
  function iconize(html) {
    let skip = 0;
    return String(html).replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
      if (tag) { if (/^<(option|textarea|title)\b/i.test(tag)) skip++; else if (/^<\/(option|textarea|title)\b/i.test(tag)) skip = Math.max(0, skip - 1); return tag; }
      return skip ? text : swap(text);
    });
  }
  const mount = () => document.fullscreenElement || document.webkitFullscreenElement || document.querySelector('#draft-section.football-fullscreen-fallback, #career-section.football-fullscreen-fallback') || document.body;
  /* koyu temalı modal: ekranın ortasında açılır, taşmaz, sağ üstte ✕ ile ve Esc ile kapanır */
  function modal(html, o) {
    o = o || {};
    const ov = document.createElement('div'); ov.className = 'crm-ov' + (o.cls ? ' ' + o.cls : '');
    ov.innerHTML = `<div class="crm" role="dialog" aria-modal="true" ${o.label ? `aria-label="${esc(o.label)}"` : ''} tabindex="-1">${o.noClose ? '' : `<button type="button" class="crm-x" data-crm-x aria-label="${T('Kapat', 'Close')}">${ic('close')}</button>`}<div class="crm-body">${iconize(html)}</div></div>`;
    (o.mount || mount()).appendChild(ov);
    let done = false;
    const api = { el: ov, body: ov.querySelector('.crm-body'), set(h) { api.body.innerHTML = iconize(h); }, close(v) { if (done) return; done = true; document.removeEventListener('keydown', key, true); ov.remove(); if (o.onClose) o.onClose(v); } };
    const key = e => { if (e.key === 'Escape' && !o.noClose) { e.stopPropagation(); e.preventDefault(); api.close(); } };
    document.addEventListener('keydown', key, true);
    ov.addEventListener('click', e => { if (e.target.closest('[data-crm-x]') || (e.target === ov && !o.sticky && !o.noClose)) api.close(); });
    const box = ov.querySelector('.crm'); requestAnimationFrame(() => { try { box.focus({ preventScroll: true }); } catch (e) {} });
    return api;
  }
  const confirm = (title, text, yes, no, danger) => new Promise(res => {
    const m = modal(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}<div class="crm-row"><button type="button" class="crm-btn ghost" data-no>${esc(no || T('Vazgeç', 'Cancel'))}</button><button type="button" class="crm-btn${danger ? ' danger' : ''}" data-yes>${esc(yes || T('Onayla', 'Confirm'))}</button></div>`, { cls: 'crm-sm', onClose: v => res(!!v) });
    m.el.querySelector('[data-yes]').onclick = () => m.close(true); m.el.querySelector('[data-no]').onclick = () => m.close(false);
  });
  const alert = (title, text, icon) => new Promise(res => {
    const m = modal(`<div class="crm-alert">${ic(icon || 'warn')}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}<div class="crm-row"><button type="button" class="crm-btn" data-yes>${T('Tamam', 'OK')}</button></div>`, { cls: 'crm-sm', onClose: () => res() });
    m.el.querySelector('[data-yes]').onclick = () => m.close();
  });
  return { ic, iconize, modal, confirm, alert, mount, EMOJI };
})();
