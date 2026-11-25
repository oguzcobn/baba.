/* AMSTERDAM. — Sahip kilidi
   Oyun yalnızca BABA. sahibine açılır: BABA.'da PIN ile açılmış oturum (sessionStorage 'baba_ok')
   varsa doğrudan başlar; yoksa aynı 6 haneli PIN istenir. Davetli (misafir) oturumlar açamaz.
   Not: istemci taraflı bir kilittir; dosyalar herkese açık depoda durduğu sürece teknik olarak indirilebilir. */
(function () {
  'use strict';
  const DEFAULT_HASH = '2d5een7ghm3';
  const cyrb = (str, seed = 0) => { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
  const stored = () => { try { const v = localStorage.getItem('baba_pin6_hash'); return v ? JSON.parse(v) : DEFAULT_HASH; } catch (e) { return DEFAULT_HASH; } };
  const isOpen = () => { try { return sessionStorage.getItem('baba_ok') === '1' || (window.parent !== window && window.parent.sessionStorage.getItem('baba_ok') === '1'); } catch (e) { return false; } };
  let waiters = [], open = isOpen();
  function release() { open = true; const w = waiters; waiters = []; w.forEach(f => f()); const ov = document.getElementById('og-ov'); if (ov) ov.remove(); }
  function showLock() {
    if (document.getElementById('og-ov')) return;
    const css = document.createElement('style');
    css.textContent = `#og-ov{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:radial-gradient(ellipse at 30% 20%,#0f2f24,#05080d 70%);color:#f1f5f9;font-family:Inter,system-ui,sans-serif}
    #og-ov .c{width:min(340px,90vw);text-align:center}#og-ov h1{font:700 40px Georgia,serif;margin:0}#og-ov h1 span{color:#10b981}
    #og-ov p{color:#94a3b8;font-size:13px;margin:8px 0 18px}#og-ov .d{display:flex;justify-content:center;gap:10px;margin-bottom:16px}
    #og-ov .d i{width:14px;height:14px;border-radius:50%;border:2px solid #475569}#og-ov .d i.f{background:#10b981;border-color:#10b981}
    #og-ov .k{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}#og-ov button{font:700 20px inherit;font-family:inherit;padding:14px 0;border-radius:14px;border:1px solid rgba(148,163,184,.25);background:rgba(255,255,255,.06);color:#fff;cursor:pointer}
    #og-ov button:active{background:rgba(255,255,255,.16)}#og-ov .e{color:#fca5a5;font-size:12.5px;min-height:18px;margin-top:10px}`;
    document.head.appendChild(css);
    const ov = document.createElement('div'); ov.id = 'og-ov';
    ov.innerHTML = `<div class="c"><h1>AMSTERDAM<span>.</span></h1><p>Bu oyun özel. Yalnızca BABA. sahibi açabilir — şifreni gir.</p><div class="d">${'<i></i>'.repeat(6)}</div>
      <div class="k">${['1','2','3','4','5','6','7','8','9','','0','⌫'].map(k => k ? `<button data-k="${k}">${k}</button>` : '<span></span>').join('')}</div><div class="e"></div></div>`;
    document.body.appendChild(ov);
    let pin = '';
    const dots = () => ov.querySelectorAll('.d i').forEach((d, i) => d.classList.toggle('f', i < pin.length));
    const press = (k) => {
      if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 6) pin += k;
      dots();
      if (pin.length === 6) {
        if (cyrb('lale-ela:' + pin) === stored()) { try { sessionStorage.setItem('baba_ok', '1'); } catch (e) {} release(); }
        else { ov.querySelector('.e').textContent = 'Şifre yanlış'; pin = ''; setTimeout(dots, 150); }
      }
    };
    ov.addEventListener('click', e => { const b = e.target.closest('button'); if (b) press(b.dataset.k); });
    window.addEventListener('keydown', e => { if (!document.getElementById('og-ov')) return; e.stopImmediatePropagation(); if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); }, true);
  }
  window.OwnerGate = {
    isOpen: () => open,
    whenOpen(fn) { if (open) fn(); else { waiters.push(fn); if (document.body) showLock(); else document.addEventListener('DOMContentLoaded', showLock); } }
  };
})();
