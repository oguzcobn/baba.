"use strict";
/* =====================================================================
   SÜPER LİG DRAFT — torbadan kulüp çek, 11+2 kur, taktik seç, 34 maç oyna.
   Dribbble "Football Web Dashboard - Player Stats & Match Analytics" UI Entegrasyonu
   ===================================================================== */
const Draft = (() => {
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 68;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CLUB = id => DRAFT_CLUBS.find(c => c.id === id);

  const CFG = { opp: 0, K: 12.5, base: 1.2, home: 1.12, away: .92, noise: 2.2, inj: .011, tac: .5, coach: .5 };
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const ME = 'Senin Takımın';
  const CID = () => (typeof ClubID !== 'undefined' && ClubID.get()) || null;
  const TN = n => n === ME ? ((CID() && CID().name) || T(ME, 'Your Team')) : n;
  const PZ = k => I18N.lang === 'en' ? ({ KL: 'GK', ST: 'CB', BK: 'FB', OS: 'MF', KN: 'W', FV: 'FW' }[k] || k) : k;
  const FL = c => I18N.lang === 'en' ? ({ G: 'W', B: 'D', M: 'L' }[c] || c) : c;
  const COACH_EN = { 'Pres ve tempo': 'Pressing and tempo', 'Sağlam savunma': 'Solid defence', 'Hücum ve moral': 'Attack and morale', 'Dengeli oyun': 'Balanced play', 'Bordo-mavi ruh': 'Claret-and-blue spirit', 'Yaratıcılık': 'Creativity' };
  const CHEM_MAX = 4;
  const TR_FIRST = /^(Kaan|Kerem|Arda|Emre|Okan|Ozan|Okay|Mert|Can|Berat|Yunus|Eren|Efe|Ege|Deniz|Umut|Onur|Volkan|Fatih|Taha|Taylan|Zafer|Mithat|Yusuf|Emin|Bertuğ|Berkay|Batuhan|Hamza|Celil|Samed|Enes|Bilal|Yalçın|Kamil|Ali|Ayberk|Atakan|Melih|Arif|Adil|Rayyan|Bahadır|Baran|Fatih|Tayfur|Bedirhan|Emir|Mustafa|Sefa|Mehmet|Furkan|Veysel|Kahraman|Gökhan|Serdar|Berat|Ahmed|Hasan|Erhan|Metehan|Abdurrahim|Ensar|Salih|Cenk|Sinan|Semih|Rıdvan|Ilhan|Kartal|Doğan|Burak|Hakan|Selçuk|Gökdeniz|Volkan|Serkan|Ömer|Ertuğrul|Yakup|Orhan|Murat|Umut)\b/;
  const nation = p => DRAFT_NAT[p.name] || (/[çğıışşİÇĞŞÖÜöü]/.test(p.name) || TR_FIRST.test(p.name) ? 'TR' : null);

  function chemOf(xi) {
    const per = xi.map(p => { const n = nation(p); let links = 0; xi.forEach(q => { if (q === p) return; if (q.club === p.club) links++; if (n && nation(q) === n) links++; }); return links >= 4 ? 3 : links >= 2 ? 2 : links >= 1 ? 1 : 0; });
    return { per, pct: Math.round(per.reduce((s, v) => s + v, 0) / (3 * Math.max(11, xi.length)) * 100) };
  }

  let S = null, el = null, timers = [], activeHeroIdx = 0;
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
  function stop() { timers.forEach(clearTimeout); timers = []; }

  /* ---------------- DRIBBBLE SHOT #26510553 STİL ENJEKSİYONU ---------------- */
  function injectStyles() {
    if (document.getElementById('dr-dribbble-theme')) return;
    const st = document.createElement('style');
    st.id = 'dr-dribbble-theme';
    st.textContent = `
      .dr-shell {
        position: relative;
        background: radial-gradient(circle at 50% 18%, rgba(28, 64, 148, 0.42) 0%, rgba(10, 14, 24, 0.96) 55%, #060911 100%);
        color: #f8fafc;
        border-radius: 28px;
        padding: 22px 24px 28px 84px;
        margin: 8px auto 28px;
        max-width: 1440px;
        min-height: 86vh;
        box-shadow: 0 28px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.08);
        overflow: hidden;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .dr-shell::before {
        content: "";
        position: absolute;
        inset: 0;
        background: 
          radial-gradient(ellipse at 52% 28%, rgba(56, 189, 248, 0.14) 0%, transparent 55%),
          radial-gradient(ellipse at 20% 85%, rgba(34, 197, 94, 0.12) 0%, transparent 45%);
        pointer-events: none;
        z-index: 0;
      }
      .dr-shell > * { position: relative; z-index: 1; }

      /* Sol Dikey İkon Menüsü (Dribbble Sidebar Dock) */
      .dr-dock {
        position: absolute;
        left: 18px;
        top: 22px;
        bottom: 22px;
        width: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        z-index: 10;
      }
      .dr-dock-ball {
        width: 42px; height: 42px;
        border-radius: 50%;
        background: rgba(255,255,255,0.95);
        color: #090d16;
        display: grid; place-items: center;
        font-size: 20px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        margin-bottom: 10px;
      }
      .dr-dock-btn {
        width: 40px; height: 40px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.65);
        display: grid; place-items: center;
        cursor: pointer;
        transition: all .2s ease;
        backdrop-filter: blur(12px);
        font-size: 15px;
      }
      .dr-dock-btn:hover { background: rgba(255,255,255,0.15); color: #fff; transform: translateY(-1px); }
      .dr-dock-btn.on {
        background: #ffffff;
        color: #090d16;
        border-color: #ffffff;
        box-shadow: 0 0 20px rgba(255,255,255,0.45);
      }

      /* Dribbble Showcase: Üst Bar (All Players / Next Player) */
      .db-showcase {
        position: relative;
        border-radius: 24
