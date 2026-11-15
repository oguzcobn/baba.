"use strict";
/* =====================================================================
   SÜPER LİG DRAFT — torbadan kulüp çek, 11+2 kur, taktik seç, 34 maç oyna.
   Dribbble "Football Web Dashboard - Player Stats & Match Analytics" UI
   ===================================================================== */
const Draft = (() => {
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 68;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CLUB = id => (typeof DRAFT_CLUBS !== 'undefined' ? DRAFT_CLUBS.find(c => c.id === id) : null);

  // Wider skill curve and match-to-match uncertainty prevent fixed 4th/5th finishing bands.
  const CFG = { opp: 0, K: 18, base: 1.25, home: 1.12, away: .93, noise: 4.1, inj: .011, tac: .5, coach: .5, seasonForm: 2.3 };
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const ME = 'Senin Takımın';
  // Draft uses a fixed neutral identity. Club creation belongs exclusively to Career.
  const TN = n => n === ME ? T(ME, 'Your Team') : n;
  const PZ = k => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? ({ KL: 'GK', ST: 'CB', BK: 'FB', OS: 'MF', KN: 'W', FV: 'FW' }[k] || k) : k;
  const FL = c => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? ({ G: 'W', B: 'D', M: 'L' }[c] || c) : c;
  const COACH_EN = { 'Pres ve tempo': 'Pressing and tempo', 'Sağlam savunma': 'Solid defence', 'Hücum ve moral': 'Attack and morale', 'Dengeli oyun': 'Balanced play', 'Bordo-mavi ruh': 'Claret-and-blue spirit', 'Yaratıcılık': 'Creativity' };
  const CHEM_MAX = 4;
  const TR_FIRST = /^(Kaan|Kerem|Arda|Emre|Okan|Ozan|Okay|Mert|Can|Berat|Yunus|Eren|Efe|Ege|Deniz|Umut|Onur|Volkan|Fatih|Taha|Taylan|Zafer|Mithat|Yusuf|Emin|Bertuğ|Berkay|Batuhan|Hamza|Celil|Samed|Enes|Bilal|Yalçın|Kamil|Ali|Ayberk|Atakan|Melih|Arif|Adil|Rayyan|Bahadır|Baran|Fatih|Tayfur|Bedirhan|Emir|Mustafa|Sefa|Mehmet|Furkan|Veysel|Kahraman|Gökhan|Serdar|Berat|Ahmed|Hasan|Erhan|Metehan|Abdurrahim|Ensar|Salih|Cenk|Sinan|Semih|Rıdvan|Ilhan|Kartal|Doğan|Burak|Hakan|Selçuk|Gökdeniz|Volkan|Serkan|Ömer|Ertuğrul|Yakup|Orhan|Murat|Umut)\b/;
  const nation = p => (p && ((typeof DRAFT_NAT !== 'undefined' && DRAFT_NAT[p.name]) || (/[çğıışşİÇĞŞÖÜöü]/.test(p.name) || TR_FIRST.test(p.name) ? 'TR' : null))) || null;

  function chemOf(xi) {
    const per = xi.map(p => { const n = nation(p); let links = 0; xi.forEach(q => { if (q === p) return; if (q.club === p.club) links++; if (n && nation(q) === n) links++; }); return links >= 4 ? 3 : links >= 2 ? 2 : links >= 1 ? 1 : 0; });
    return { per, pct: Math.round(per.reduce((s, v) => s + v, 0) / (3 * Math.max(11, xi.length)) * 100) };
  }

  let S = null, el = null, timers = [], activeHeroIdx = 0;
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
  function stop() { timers.forEach(clearTimeout); timers = []; }

  function injectStyles() {
    if (document.getElementById('dr-dribbble-v2')) return;
    const st = document.createElement('style');
    st.id = 'dr-dribbble-v2';
    st.textContent = `
      .db-showcase {
        position: relative;
        background: radial-gradient(circle at 50% 20%, rgba(29, 78, 216, 0.45) 0%, rgba(11, 15, 25, 0.96) 60%, #070a12 100%);
        color: #f8fafc;
        border-radius: 26px;
        padding: 22px 24px 26px 76px;
        margin: 14px 0 24px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.1);
        overflow: hidden;
      }
      .db-dock {
        position: absolute;
        left: 16px;
        top: 22px;
        bottom: 22px;
        width: 44px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        z-index: 5;
      }
      .db-dock-ball {
        width: 38px; height: 38px;
        border-radius: 50%;
        background: #ffffff;
        color: #090d16;
        display: grid; place-items: center;
        font-size: 18px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        margin-bottom: 6px;
      }
      .db-dock-btn {
        width: 38px; height: 38px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.7);
        display: grid; place-items: center;
        cursor: pointer;
        transition: .2s;
        font-size: 14px;
      }
      .db-dock-btn:hover { background: rgba(255,255,255,0.16); color: #fff; }
      .db-dock-btn.on { background: #ffffff; color: #090d16; border-color: #fff; box-shadow: 0 0 16px rgba(255,255,255,0.4); }

      .db-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .db-all-players { display: flex; align-items: center; gap: 10px; }
      .db-circle-btn {
        width: 32px; height: 32px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08);
        color: #fff;
        display: grid; place-items: center;
        cursor: pointer;
      }
      .db-all-players h4 { font-size: 19px; font-weight: 600; margin: 0; color: #fff; }
      .db-next-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.09);
        border: 1px solid rgba(255,255,255,0.15);
        color: #e2e8f0;
        font-size: 13px;
        cursor: pointer;
      }
      .db-stage {
        display: grid;
        grid-template-columns: 1.15fr 1fr 295px;
        gap: 20px;
        align-items: end;
      }
      .db-left-col {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 20px;
      }
      .db-num-label { font-size: 12.5px; color: rgba(255,255,255,0.58); margin-bottom: 6px; display: flex; gap: 8px; }
      .db-hero-name {
        font-size: clamp(34px, 4vw, 58px);
        font-weight: 700;
        line-height: 1.03;
        letter-spacing: -0.03em;
        color: #fff;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .db-inline-crest {
        width: 46px; height: 46px;
        border-radius: 50%;
        display: inline-grid;
        place-items: center;
        font-size: 13px;
        font-weight: 800;
        background: conic-gradient(var(--c1, #1d4ed8) 0 50%, var(--c2, #fff) 50% 100%);
        color: #fff;
        text-shadow: 0 1px 4px rgba(0,0,0,0.85);
        border: 2.5px solid rgba(255,255,255,0.9);
      }
      .db-stat-widget {
        width: 230px;
        border-radius: 20px;
        background: rgba(12, 20, 32, 0.82);
        border: 1.5px solid #22c55e;
        overflow: hidden;
        box-shadow: 0 14px 30px rgba(0,0,0,0.4);
      }
      .db-stat-top {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .db-stat-badges { display: flex; align-items: center; }
      .db-stat-badges span {
        width: 24px; height: 24px;
        border-radius: 50%;
        background: #0f172a;
        color: #fff;
        font-size: 9px;
        font-weight: 800;
        display: inline-grid;
        place-items: center;
        border: 2px solid #fff;
        margin-right: -5px;
      }
      .db-stat-body { padding: 14px 16px 16px; }
      .db-stat-pct { font-size: 42px; font-weight: 700; line-height: 1; color: #fff; margin-bottom: 6px; }
      .db-stat-desc { font-size: 12px; color: rgba(255,255,255,0.68); margin: 0; }

      .db-center-figure {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        min-height: 290px;
      }
      .db-spotlight {
        position: absolute;
        width: 240px; height: 240px;
        border-radius: 50%;
        background: radial-gradient(circle, var(--spot, rgba(37,99,235,0.45)) 0%, transparent 70%);
        filter: blur(16px);
      }
      .db-kit-hero { position: relative; z-index: 1; width: 190px; height: 220px; filter: drop-shadow(0 18px 28px rgba(0,0,0,0.6)); }
      .db-player-pills { position: relative; z-index: 2; display: flex; gap: 8px; margin-top: -10px; }
      .db-player-pills span {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(255,255,255,0.18);
        padding: 4px 11px;
        border-radius: 999px;
        font-size: 11.5px;
        font-weight: 600;
        color: #f8fafc;
      }

      .db-right-matches { display: flex; flex-direction: column; gap: 8px; }
      .db-matches-head { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #f1f5f9; padding: 0 4px 2px; }
      .db-match-card {
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        padding: 8px 12px;
        display: grid;
        grid-template-columns: 42px 1fr 42px;
        align-items: center;
        backdrop-filter: blur(12px);
      }
      .db-mc-team { display: flex; flex-direction: column; align-items: center; gap: 3px; }
      .db-mc-team small { font-size: 9.5px; font-weight: 700; color: rgba(255,255,255,0.55); }
      .db-mc-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .db-rating-pill {
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 10.5px;
        font-weight: 700;
        background: rgba(34, 197, 94, 0.2);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.35);
      }
      .db-rating-pill.warn {
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
        border-color: rgba(245, 158, 11, 0.35);
      }
      .db-mc-score { font-size: 19px; font-weight: 700; letter-spacing: 0.05em; color: #fff; }

      @media (max-width: 960px) {
        .db-showcase { padding: 16px; }
        .db-dock { position: static; flex-direction: row; width: 100%; height: auto; justify-content: center; margin-bottom: 12px; }
        .db-dock-ball { margin-bottom: 0; }
        .db-stage { grid-template-columns: 1fr; }
        .db-stat-widget { width: 100%; }
      }
    `;
    document.head.appendChild(st);
  }

  function fresh(mode) {
    return { v: 3, bag: shuffle(DRAFT_CLUBS.map((c, i) => i)), drawn: [], pf: null, mode: mode || ls.get('draft_mode', 'normal'), picks: {}, bench: [null, null], jokers: 2, club: null, coach: null, tac: { tempo: 'dengeli', pres: 'orta', hat: 'dengeli', yon: 'dengeli' }, phase: 'draft', last: null };
  }
  const picked = () => [...Object.values(S.picks), ...S.bench].filter(Boolean);
  const count = () => picked().length;
  const openSlotsFor = pos => DRAFT_SLOTS.filter(s => s.pos === pos && !S.picks[s.id]);
  const benchOpen = () => S.bench.findIndex(b => !b);
  const canTake = p => !picked().some(q => q.name === p[0]) && (openSlotsFor(p[1]).length > 0 || benchOpen() >= 0);
  const hide = () => S.mode === 'sefir';
  const eraTxt = e => e === 'FC27' ? 'FC 27' : String(e || 'FC27').replace('~', '') + T(' · tahmini', ' · estimated');

  const HISTORY_KEY = 'draft_history_v1';
  function history() { const rows = ls.get(HISTORY_KEY, []); return Array.isArray(rows) ? rows.filter(x => x && Number.isFinite(x.pts) && Number.isFinite(x.rank)).slice(0, 20) : []; }
  function recordSeason(L) {
    const row = { id: Date.now() + '-' + rnd(100000), date: new Date().toISOString(), pts: L.pts, rank: L.rank, w: L.w, d: L.d, l: L.l, gf: L.gf, ga: L.ga, mode: S.mode, coach: S.coach === null ? '' : DRAFT_COACHES[S.coach].name, chemistry: strength().cp, avg: Math.round(avg(DRAFT_SLOTS.map(s => S.picks[s.id]).filter(Boolean).map(p => p.r)) * 10) / 10, title: L.rank === 1 };
    ls.set(HISTORY_KEY, [row, ...history()].slice(0, 20));
  }

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || 'Player');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function renderShowcase(xi, ch, activeTab) {
    try {
      if (typeof DRAFT_CLUBS === 'undefined' || !DRAFT_CLUBS.length) return '';
      const allPicked = picked();
      if (activeTab === 'stats' && S.last) {
        const L = S.last;
        const views = [['scorers','⚽',T('Gol kralı','Top scorer')],['assists','🎯',T('Asist lideri','Assist leader')],['poy','⭐',T('Yılın oyuncusu','Player of the season')],['gk','🧤',T('Altın eldiven','Golden glove')],['mine','👕',T('Takımım','My team')],['table','🏆',T('Puan durumu','Standings')]];
        const view = views.some(v => v[0] === S.seasonView) ? S.seasonView : 'scorers';
        const pl = k => Array.isArray(L[k]) ? L[k] : [];
        const list = view === 'mine' ? pl('mine').slice().sort((a,b)=>(b.g+b.a)-(a.g+a.a)) : pl(view);
        const players = view === 'table' ? [] : list;
        const index = Math.max(0, Math.min(Number(S.seasonHero)||0, players.length-1));
        const hero = players[index] || null;
        const val = p => view==='assists' ? p.a : view==='gk' ? p.cs : view==='poy' ? Math.round(p.score*10)/10 : view==='mine' ? p.g+p.a : p.g;
        const unit = view==='assists'?T('asist','assists'):view==='gk'?T('gol yemedi','clean sheets'):view==='poy'?T('performans puanı','performance score'):view==='mine'?T('gol katkısı','goal contributions'):T('gol','goals');
        const crestOf = p => { const c = DRAFT_CLUBS.find(x => x.name === p.team) || CLUB(p.tid); return c ? crest(c) : '⚽'; };
        const rankRows = (Array.isArray(L.table)?L.table:[]).slice(0,8);
        const right = view==='table' ? rankRows.map((t,i)=>`<div class='ss-row ${t.me?'mine':''}'><span>${i+1}</span><b>${esc(TN(t.name))}</b><strong>${t.p} ${T('puan','pts')}</strong></div>`).join('') :
          list.slice(0,7).map((p,i)=>`<button type='button' class='ss-row ${i===index?'on':''}' data-season-player='${i}' aria-pressed='${i===index}'><span>${i+1}</span><b>${esc(p.name)}</b><small>${esc(TN(p.team))}</small><strong>${val(p)}</strong></button>`).join('');
        const title = views.find(v => v[0]===view)[2];
        const teamBlock = `<div class='ss-team'><span class='eyebrow'>${T('KENDİ TAKIMIM','MY TEAM')}</span><h3>${L.rank}. ${T('sıra','place')} · ${L.pts} ${T('puan','points')}</h3><p>${L.w}G ${L.d}B ${L.l}M · ${L.gf}:${L.ga}</p><button type='button' data-season-view='mine'>${T('Oyuncularımın performansı','Squad performance')} →</button></div>`;
        const featured = view==='table' ? `<div class='ss-standing'><span class='ss-big'>#${L.rank}</span><h3>${T('Sezon sıralaman','Your final standing')}</h3><p>${L.pts} / 102 ${T('puan','points')}</p><div class='ss-metrics'><span>${L.gf} ${T('atılan gol','scored')}</span><span>${L.ga} ${T('yenilen gol','conceded')}</span><span>${L.gf-L.ga} ${T('averaj','goal difference')}</span></div></div>` : hero ? (()=>{
          const club = DRAFT_CLUBS.find(x=>x.name===hero.team)||CLUB(hero.tid);
          const c1 = club&&club.c1||'#286c5a', c2=club&&club.c2||'#c6e4d0';
          const number = hashStr(hero.name)%29+1;
          return `<div class='ss-player'><div class='ss-player-info'><div class='ss-club'>${crestOf(hero)} <span>${esc(TN(hero.team))}</span></div><h3>${esc(hero.name)}</h3><p>${PZ(hero.pos)} · OVR ${hero.r}</p><div class='ss-big'>${val(hero)} <small>${unit}</small></div><div class='ss-metrics'><span>${hero.apps||0} ${T('maç','apps')}</span><span>${hero.g||0} ${T('gol','goals')}</span><span>${hero.a||0} ${T('asist','assists')}</span>${hero.pos==='KL'?`<span>${hero.cs||0} ${T('gol yemedi','clean sheets')}</span>`:''}</div></div><div class='ss-kit' style='--a:${c1};--b:${c2}'><svg viewBox='0 0 190 210' role='img' aria-label='${T('Oyuncu forması','Player jersey')}'><defs><linearGradient id='ssKit' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='var(--a)'/><stop offset='100%' stop-color='var(--b)'/></linearGradient></defs><path d='M53 25 L78 13 Q95 24 112 13 L137 25 L178 66 L148 94 L138 76 L138 190 L52 190 L52 76 L42 94 L12 66 Z' fill='url(#ssKit)' stroke='#bdd6c5' stroke-width='2.5'/><text x='95' y='122' text-anchor='middle' fill='white' font-size='48' font-weight='900'>${number}</text></svg></div></div>`;
        })() : `<p>${T('Bu kategoride sezon verisi yok.','No season data in this category.')}</p>`;
        return `<section class='ss-showcase'><header class='ss-head'><div><span class='eyebrow'>${T('SEZON TAMAMLANDI','SEASON COMPLETE')}</span><h2>${T('Sezonun hikâyesi','Season story')}</h2></div><b>${L.rank}. ${T('sıra','place')} · ${L.pts}/102 ${T('puan','points')}</b></header><div class='ss-layout'><nav class='ss-menu' aria-label='${T('Sezon ayrıntıları','Season details')}'>${views.map(([id,ico,label])=>`<button type='button' data-season-view='${id}' class='${view===id?'on':''}' aria-pressed='${view===id}'><span>${ico}</span><b>${label}</b></button>`).join('')}</nav><div class='ss-feature'><div class='ss-feature-head'><span class='eyebrow'>${title}</span><small>${T('Tamamlanan sezon verileri','Completed season statistics')}</small></div>${featured}</div><aside class='ss-leaders'><div class='ss-leaders-head'><b>${view==='table'?T('LİG SIRALAMASI','STANDINGS'):T('SEZON LİDERLERİ','SEASON LEADERS')}</b><span>TOP ${view==='table'?'8':'7'}</span></div><div class='ss-list'>${right}</div>${teamBlock}</aside></div></section>`;
      }
      let hero = null;
      if (allPicked.length > 0) {
        if (activeHeroIdx >= allPicked.length || activeHeroIdx < 0) activeHeroIdx = 0;
        hero = allPicked[activeHeroIdx];
      } else if (S && S.club && CLUB(S.club)) {
        const c = CLUB(S.club);
        const topP = c.players.slice().sort((a, b) => b[2] - a[2])[0];
        if (topP) hero = { name: topP[0], pos: topP[1], r: topP[2], club: c.id, era: topP[3] };
      }
      if (!hero) {
        const defC = DRAFT_CLUBS[0];
        const topP = defC.players[0] || ['Trevoh Chalobah', 'ST', 82, 'FC27'];
        hero = { name: topP[0], pos: topP[1], r: topP[2], club: defC.id, era: topP[3] };
      }

      const club = CLUB(hero.club) || DRAFT_CLUBS[0];
      const seed = hashStr(hero.name);
      const jerseyNum = (seed % 29) + 1;
      const nameParts = String(hero.name).split(' ');
      const firstName = nameParts[0] || hero.name;
      const lastName = nameParts.slice(1).join(' ') || '';
      const accuracyPct = hide() ? 68 : Math.min(96, Math.max(62, Math.round((hero.r || 78) * 0.84 + ((ch && ch.pct) || 50) * 0.12)));

      const otherClubs = DRAFT_CLUBS.filter(c => c.id !== club.id);
      const matches = [0, 1, 2, 3, 4].map(idx => {
        const opp = otherClubs[(seed + idx * 5) % Math.max(1, otherClubs.length)] || club;
        const isHome = (seed + idx) % 2 === 0;
        const g1 = (seed + idx * 3) % 3;
        const g2 = (seed + idx * 7) % 3;
        const rawRating = (6.3 + (((seed >> idx) % 24) / 10)).toFixed(1).replace('.', ',');
        const high = parseFloat(rawRating.replace(',', '.')) >= 7.0;
        return { homeC: isHome ? club : opp, awayC: isHome ? opp : club, g1, g2, rawRating, high };
      });

      return `
        <section class="db-showcase">
          <aside class="db-dock">
            <div class="db-dock-ball">⚽</div>
            <button type="button" class="db-dock-btn ${activeTab === 'draft' ? 'on' : ''}" data-dock="draft" title="${T('Kadro', 'Squad')}">👤</button>
            <button type="button" class="db-dock-btn ${activeTab === 'tactics' ? 'on' : ''}" data-dock="tactics" title="${T('Taktik', 'Tactics')}">📋</button>
            <button type="button" class="db-dock-btn ${activeTab === 'stats' ? 'on' : ''}" data-dock="stats" title="${T('Analitik', 'Analytics')}">📊</button>
            <button type="button" class="db-dock-btn" data-dock="reset" title="${T('Sıfırla', 'Reset')}">↻</button>
          </aside>
          <div class="db-topbar">
            <div class="db-all-players">
              <button type="button" class="db-circle-btn" data-hero-nav="-1">‹</button>
              <h4>${T('Tüm Oyuncular', 'All Players')} <small style="font-size:12px;opacity:.6;font-weight:400">(${allPicked.length ? (activeHeroIdx + 1) + '/' + allPicked.length : T('Vitrin', 'Showcase')})</small></h4>
            </div>
            <button type="button" class="db-next-pill" data-hero-nav="1">
              <span>${T('Sonraki Oyuncu', 'Next Player')}</span><span>›</span>
            </button>
          </div>
          <div class="db-stage">
            <div class="db-left-col">
              <div>
                <div class="db-num-label">
                  <span>Number ${jerseyNum}</span><span>·</span><span>${PZ(hero.pos)}</span><span>·</span><span>${nation(hero) || '—'}</span>
                </div>
                <h2 class="db-hero-name">
                  <span>${esc(firstName)}</span>
                  <span class="db-inline-crest" style="--c1:${club.c1};--c2:${club.c2 || '#ffffff'}">${esc(club.short)}</span>
                  ${lastName ? `<span style="flex-basis:100%">${esc(lastName)}</span>` : ''}
                </h2>
              </div>
              <div class="db-stat-widget">
                <div class="db-stat-top">
                  <div class="db-stat-badges">
                    <span style="background:${club.c1}">${esc(club.short)}</span>
                    <span>SL</span>
                  </div>
                  <svg width="110" height="26" viewBox="0 0 115 28" fill="none">
                    <path d="M4 22 C18 22, 22 14, 34 16 C46 18, 52 8, 64 14 C76 20, 84 4, 96 7 C104 9, 108 18, 112 19" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="96" cy="7" r="3.5" fill="#090d16" stroke="#ffffff" stroke-width="2"/>
                  </svg>
                </div>
                <div class="db-stat-body">
                  <div class="db-stat-pct">${accuracyPct}%</div>
                  <p class="db-stat-desc">${T('Pas ve oyun kurulumu isabet göstergesi', 'Transmission accuracy indicator')}</p>
                </div>
              </div>
            </div>
            <div class="db-center-figure">
              <div class="db-spotlight" style="--spot:${club.c1}88"></div>
              <svg class="db-kit-hero" viewBox="0 0 200 230" fill="none">
                <defs>
                  <linearGradient id="kitGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${club.c1}"/>
                    <stop offset="100%" stop-color="${club.c2 || '#0f172a'}"/>
                  </linearGradient>
                </defs>
                <path d="M55 24 L82 14 C92 24, 108 24, 118 14 L145 24 L182 66 L154 96 L140 78 L140 205 L60 205 L60 78 L46 96 L18 66 Z" fill="url(#kitGrad)" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-linejoin="round"/>
                <text x="100" y="118" text-anchor="middle" fill="#ffffff" font-size="46" font-weight="800" font-family="sans-serif">${jerseyNum}</text>
                <text x="100" y="148" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-size="12" font-weight="700" letter-spacing="2" font-family="sans-serif">${esc((lastName || firstName).toUpperCase().slice(0, 12))}</text>
              </svg>
              <div class="db-player-pills">
                <span>OVR <b>${hide() ? '??' : hero.r}</b></span>
                <span>${esc(club.name)}</span>
                <span>${eraTxt(hero.era || 'FC27')}</span>
              </div>
            </div>
            <div class="db-right-matches">
              <div class="db-matches-head">
                <span>Trendyol Süper Lig</span><span>📊</span>
              </div>
              ${matches.map(m => `
                <div class="db-match-card">
                  <div class="db-mc-team">${crest(m.homeC)}<small>${esc(m.homeC.short)}</small></div>
                  <div class="db-mc-center">
                    <span class="db-rating-pill ${m.high ? '' : 'warn'}">${m.rawRating} ★</span>
                    <div class="db-mc-score">${m.g1} : ${m.g2}</div>
                  </div>
                  <div class="db-mc-team">${crest(m.awayC)}<small>${esc(m.awayC.short)}</small></div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>`;
    } catch (err) {
      console.error('Showcase render error:', err);
      return '';
    }
  }

  function bindShowcase() {
    if (!el) return;
    el.querySelectorAll('[data-hero-nav]').forEach(btn => btn.onclick = () => {
      const allP = picked();
      if (!allP.length) return;
      const dir = +btn.dataset.heroNav;
      activeHeroIdx = (activeHeroIdx + dir + allP.length) % allP.length;
      render();
    });
    el.querySelectorAll('[data-season-view]').forEach(b => b.onclick = () => { S.seasonView = b.dataset.seasonView; S.seasonHero = 0; save(); renderStats(); });
    el.querySelectorAll('[data-season-player]').forEach(b => b.onclick = () => { S.seasonHero = Number(b.dataset.seasonPlayer) || 0; save(); renderStats(); });
    el.querySelectorAll('[data-dock]').forEach(b => b.onclick = () => {
      const target = b.dataset.dock;
      if (target === 'reset') { S = fresh(S.mode); activeHeroIdx = 0; return render(); }
      if (target === 'tactics' && count() < 13) { flash(T('Önce 13 kişilik kadronu tamamla!', 'Complete your 13-man squad first!')); return; }
      if (target === 'stats' && !S.last) { flash(T('İstatistikleri görmek için önce bir sezon oyna.', 'Play a season first to see analytics.')); return; }
      S.phase = target; render();
    });
  }

  function careerHtml() {
    const rows = history();
    const titles = rows.filter(x => x.title).length, best = rows.length ? Math.max(...rows.map(x => x.pts)) : 0;
    const wins = rows.reduce((a, x) => a + (x.w || 0), 0), goals = rows.reduce((a, x) => a + (x.gf || 0), 0);
    const achievements = [
      { name: T('İlk sezon', 'First season'), ok: rows.length >= 1, icon: '🎟️' },
      { name: T('İlk şampiyonluk', 'First title'), ok: titles >= 1, icon: '🏆' },
      { name: T('Üç şampiyonluk', 'Three titles'), ok: titles >= 3, icon: '👑' },
      { name: T('50 galibiyet', '50 wins'), ok: wins >= 50, icon: '⚽' },
      { name: T('100 gol', '100 goals'), ok: goals >= 100, icon: '🥅' },
      { name: T('80 puanlık sezon', '80-point season'), ok: best >= 80, icon: '⭐' }
    ];
    return `<section class="dr-career"><div class="dr-career-head"><div><p class="eyebrow">${T('Draft kariyeri', 'Draft career')}</p><h2>${T('Sezon arşivi', 'Season history')}</h2></div><span class="chip">🏆 ${titles} ${T('şampiyonluk', 'titles')}</span></div>
      <div class="dr-career-kpis"><span><b>${rows.length}</b><small>${T('Sezon', 'Seasons')}</small></span><span><b>${best}</b><small>${T('En yüksek puan', 'Best points')}</small></span><span><b>${rows.length ? (rows.reduce((a, x) => a + x.pts, 0) / rows.length).toFixed(1) : '—'}</b><small>${T('Puan ortalaması', 'Average points')}</small></span></div>
      <div class="dr-achievements" aria-label="${T('Kariyer başarıları', 'Career achievements')}">${achievements.map(a => `<span class="dr-achievement ${a.ok ? 'earned' : 'locked'}" title="${a.ok ? T('Kazanıldı', 'Unlocked') : T('Henüz kazanılmadı', 'Locked')}">${a.icon} ${a.name}</span>`).join('')}</div>
      ${rows.length ? `<div class="dr-career-list">${rows.slice(0, 8).map(x => `<div class="dr-career-row"><span>${new Date(x.date).toLocaleDateString(typeof I18N !== 'undefined' ? I18N.locale : 'tr-TR')}</span><strong>${x.pts} ${T('puan', 'pts')}</strong><span>#${x.rank}</span><small>${x.w}${T('G', 'W')} ${x.d}${T('B', 'D')} ${x.l}${T('M', 'L')}</small></div>`).join('')}</div>` : `<p class="muted">${T('İlk sezonunu tamamladığında sonuçların burada saklanacak.', 'Finish your first season to see results here.')}</p>`}
      </section>`;
  }

  /* ---------------- ANA ÇİZİM ---------------- */
  function repairSavedState(saved) {
    if (!saved || saved.v !== 3 || !saved.picks || typeof saved.picks !== 'object' ||
        Array.isArray(saved.picks) || !Array.isArray(saved.bench) || !Array.isArray(saved.bag) ||
        !Array.isArray(saved.drawn) || !saved.tac || typeof saved.tac !== 'object') return fresh();
    const slots = new Set(DRAFT_SLOTS.map(p => p.id));
    const safePlayer = p => p && typeof p.name === 'string' && p.name.trim() &&
      typeof p.pos === 'string' && Number.isFinite(p.r) && p.r > 0 && typeof p.club === 'string' && CLUB(p.club);
    saved.picks = Object.fromEntries(Object.entries(saved.picks).filter(([id, p]) => slots.has(id) && safePlayer(p)));
    saved.bench = saved.bench.slice(0, 2).map(p => safePlayer(p) ? p : null);
    while (saved.bench.length < 2) saved.bench.push(null);
    const seen = new Set();
    for (const id of Object.keys(saved.picks)) {
      const p = saved.picks[id];
      if (seen.has(p.name)) delete saved.picks[id]; else seen.add(p.name);
    }
    saved.bench = saved.bench.map(p => {
      if (!p || seen.has(p.name)) return null;
      seen.add(p.name); return p;
    });
    saved.bag = [...new Set(saved.bag)].filter(i => Number.isInteger(i) && i >= 0 && i < DRAFT_CLUBS.length);
    saved.drawn = [...new Set(saved.drawn)].filter(id => !!CLUB(id));
    saved.club = CLUB(saved.club) ? saved.club : null;
    if (saved.club && !CLUB(saved.club).players.some(canTakeWithState(saved))) saved.club = null;
    saved.jokers = Math.max(0, Math.min(2, Number(saved.jokers) || 0));
    saved.tac = Object.assign(fresh(saved.mode).tac, saved.tac);
    if (!['draft', 'tactics', 'stats'].includes(saved.phase)) saved.phase = 'draft';
    if (saved.phase === 'stats' && !saved.last) saved.phase = 'draft';
    if (saved.phase === 'tactics' && seen.size !== 13) saved.phase = 'draft';
    return saved;
  }
  function canTakeWithState(state) {
    return p => ![...Object.values(state.picks), ...state.bench].filter(Boolean).some(q => q.name === p[0]) &&
      (DRAFT_SLOTS.some(slot => slot.pos === p[1] && !state.picks[slot.id]) || state.bench.some(b => !b));
  }
  function showLoadError(error) {
    console.error('Draft startup failed:', error);
    if (!el) return;
    el.innerHTML = '<section class="dr-recovery" role="alert" style="padding:24px;max-width:680px;margin:24px auto;background:#10221b;color:white;border-radius:20px">' +
      '<h2 style="color:white;margin:0 0 12px">⚽ ' + T('Draft yüklenemedi', 'Draft could not load') + '</h2>' +
      '<p>' + T('Kayıtların silinmedi. Oyunu yeniden başlatmayı deneyebilirsin.', 'Your saved data has not been deleted. Try restarting the game.') + '</p>' +
      '<button type="button" class="pill" id="draftRecover">' + T('Yeni Draft başlat', 'Start a fresh Draft') + '</button></section>';
    el.querySelector('#draftRecover').onclick = () => { S = fresh(); swapSel = null; try { render(); } catch (e) { showLoadError(e); } };
  }
  function open(root) {
    el = root; stop(); swapSel = null;
    if (!el) return;
    try {
      injectStyles();
      if (typeof DRAFT_CLUBS === 'undefined' || !Array.isArray(DRAFT_CLUBS) || !DRAFT_CLUBS.length ||
          typeof DRAFT_SLOTS === 'undefined' || !Array.isArray(DRAFT_SLOTS) || !DRAFT_SLOTS.length) {
        throw new Error('Draft club or formation data missing');
      }
      S = repairSavedState(ls.get('draft_state', null));
      render();
    } catch (error) { showLoadError(error); }
  }
  function save() { ls.set('draft_state', S); }

  function render() {
    injectStyles();
    save();
    if (S.phase === 'tactics') return renderTactics();
    if (S.phase === 'stats') return renderStats();
    const n = count();
    const xi = DRAFT_SLOTS.map(s => S.picks[s.id]).filter(Boolean), ch = chemOf(xi);
    CHM = new Map(xi.map((p, i) => [p, ch.per[i]]));
    el.innerHTML = `
      ${renderShowcase(xi, ch, 'draft')}
      <section class="dr-hero"><p class="eyebrow">Trendyol Süper Lig 2026-27 · ${T('18 kulüp · son 10 yıl', '18 clubs · last 10 years')}</p><h1 class="display">${T('Kadro<br>kur. <em>102</em><br>puanı vur.', 'Build a<br>squad. Hit<br><em>102</em> points.')}</h1>
        <div class="dr-meta"><span class="chip">${T('Seçim', 'Picks')} <b>${n}/13</b></span><span class="chip">${T('Joker', 'Jokers')} <b>${S.jokers}</b></span><span class="chip chem-chip">🧪 ${T('Kimya', 'Chemistry')} <b>${ch.pct}</b>/100</span><span class="chip">${T('Ort.', 'Avg.')} <b>${hide() ? '??' : xi.length ? avg(xi.map(p => p.r)).toFixed(1) : '—'}</b></span>
          <button class="chip toggle ${hide() ? 'on' : ''}" data-a="mode">${hide() ? T('🙈 Ligin Sefiri', '🙈 Blind mode') : T('👁 Normal mod', '👁 Normal mode')}</button>
          <span class="chip">🏆 ${T('Rekor', 'Record')} <b>${ls.get('draft_best', 0)}</b></span></div></section>
      <section class="dr-grid">
        <div class="dr-left">
          <div class="draw-box">
            <div class="draw-head"><span class="eyebrow">${T('Torba', 'The draw')}</span><span class="muted sm">${T(`${S.drawn.length}/18 kulüp çekildi · 4 büyüklerin şansı daha yüksek`, `${S.drawn.length}/18 clubs drawn · the Big Four come up more often`)}</span></div>
            <div class="club-grid">${DRAFT_CLUBS.map(tileHtml).join('')}</div>
            <button class="pill big draw-btn" data-a="spin" ${n >= 13 || S.club ? 'disabled' : ''}>${n >= 13 ? T('Kadro tamam ✓', 'Squad complete ✓') : S.club ? T('Oyuncunu seç ↓', 'Pick your player ↓') : T('TAKIM ÇEK', 'DRAW A CLUB')}</button>
          </div>
          <div class="pick-panel">${pickPanel()}</div>
        </div>
        <div class="dr-right">
          <div class="pitch">${DRAFT_SLOTS.map(slotHtml).join('')}<div class="pitch-lines"></div></div>
          <div class="bench"><span class="eyebrow">${T('Yedekler', 'Substitutes')}</span>${S.bench.map((p, i) => `<div class="bslot ${p ? 'full' : ''}${swapCls('b', i)}" ${p ? `data-b="${i}" role="button" tabindex="0"` : ''}>${p ? cardInner(p) : '<span>' + T('Yedek ', 'Sub ') + (i + 1) + '</span>'}</div>`).join('')}${S.bench.some(Boolean) && xi.length ? `<p class="muted sm swap-help">${swapSel ? T('Şimdi yer değiştireceği oyuncuya dokun (parlayanlar uygun) · iptal için tekrar dokun', 'Now tap the player to swap with (highlighted ones fit) · tap again to cancel') : T('🔁 Yedekle ilk 11’i değiştirmek için oyuncuya dokun', '🔁 Tap a player to swap a sub with the starting XI')}</p>` : ''}</div>
          <div class="dr-actions"><p class="muted sm chem-help">${T(`Kimya: aynı kulüpten ya da aynı ülkeden gelen her takım arkadaşı bir bağ kurar (●○○ → ●●●). Maç gücü = ortalama reyting + kimya (en çok +${CHEM_MAX}); her maçta form ve sakatlık şansı var.`, `Chemistry: every teammate from the same club or the same country forms a link (●○○ → ●●●). Match strength = average rating + chemistry (up to +${CHEM_MAX}); every match carries a chance of form swings and injuries.`)}</p><button class="pill ghost" data-a="reset">${T('Sıfırla', 'Reset')}</button><button class="pill" data-a="next" ${n < 13 ? 'disabled' : ''}>${T('Teknik direktör ve taktik', 'Manager and tactics')} →</button></div>
        </div>
      </section>${careerHtml()}`;
    bind();
    bindShowcase();
  }

  function crest(c, cls) { return `<span class="crest ${cls || ''}" style="--c1:${c.c1};--c2:${c.c2}"><b>${esc(c.short)}</b></span>`; }
  function tileHtml(c) {
    const used = S.drawn.includes(c.id), cur = S.club === c.id;
    return `<div class="ct ${used ? 'used' : ''} ${cur ? 'win' : ''}" data-club="${c.id}">${crest(c)}<small>${esc(c.name)}</small></div>`;
  }
  const rating = p => hide() ? '?' : p[2];
  let CHM = null;
  function cardInner(p) {
    const c = CLUB(p.club) || DRAFT_CLUBS[0], k = CHM ? CHM.get(p) : null, n = nation(p) || '–';
    return `<i style="background:${c.c1}"></i><b>${esc(p.name)}</b><small>${PZ(p.pos)} · ${hide() ? '??' : p.r} · ${n}</small>${k == null ? '' : `<span class="chem c${k}">${'●'.repeat(k)}${'○'.repeat(3 - k)}</span>`}`;
  }
  function slotHtml(s) { const p = S.picks[s.id]; return `<div class="slot ${p ? 'full' : ''}${swapCls('s', s.id)}" style="left:${s.x}%;top:${s.y}%" ${p ? `data-slot="${s.id}" role="button" tabindex="0"` : ''}>${p ? cardInner(p) : `<span>${PZ(s.pos)}</span>`}</div>`; }

  const ZONE = { KL: 'g', ST: 'd', BK: 'd', OS: 'm', KN: 'a', FV: 'a' };
  let swapSel = null;
  const slotPos = id => (DRAFT_SLOTS.find(x => x.id === id) || {}).pos;
  function swapOk(sel, t, key) {
    if (!sel || sel.t === t) return false;
    const b = sel.t === 'b' ? S.bench[sel.i] : S.bench[key], sid = sel.t === 's' ? sel.id : key;
    return !!b && !!S.picks[sid] && ZONE[b.pos] === ZONE[slotPos(sid)];
  }
  function swapCls(t, key) {
    if (!swapSel) return '';
    if (swapSel.t === t && (t === 'b' ? swapSel.i === key : swapSel.id === key)) return ' swap-src';
    return swapOk(swapSel, t, key) ? ' swap-ok' : '';
  }
  function onSwap(t, key) {
    if (S.phase !== 'draft') return;
    const clicked = t === 'b' ? S.bench[key] : S.picks[key];
    if (clicked) {
      const idx = picked().findIndex(x => x.name === clicked.name);
      if (idx >= 0) activeHeroIdx = idx;
    }
    if (swapSel && swapSel.t === t && (t === 'b' ? swapSel.i === key : swapSel.id === key)) { swapSel = null; return render(); }
    if (swapSel && swapSel.t !== t) {
      if (!swapOk(swapSel, t, key)) { swapSel = null; flash(T('Bu iki oyuncu aynı bölgede oynamıyor (kaleci · savunma · orta saha · hücum)', 'These two don’t play in the same area (keeper · defence · midfield · attack)')); return render(); }
      const bi = swapSel.t === 'b' ? swapSel.i : key, sid = swapSel.t === 's' ? swapSel.id : key, tmp = S.picks[sid];
      S.picks[sid] = S.bench[bi]; S.bench[bi] = tmp; swapSel = null; save();
      if (typeof AdvAudio !== 'undefined') AdvAudio.note(880, .08, 'triangle', .04);
      flash(T(`🔁 ${S.picks[sid].name} ilk 11’de, ${tmp.name} yedekte`, `🔁 ${S.picks[sid].name} starts, ${tmp.name} to the bench`));
      return render();
    }
    swapSel = t === 'b' ? { t, i: key } : { t, id: key }; render();
  }
  function flash(msg) { const d = document.createElement('div'); d.className = 'dr-flash'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }

  function pickPanel() {
    if (!S.club) return `<p class="muted">${T('“Takım çek”e bas: 18 kulüp bir torbada, her biri bir kez çıkar; 4 büyüklerin çıkma şansı daha yüksek. Gelen kulübün güncel FC 27 kadrosundan ya da son 10 yılın yıldızlarından bir oyuncu seç. Mevkisi boşsa sahaya, değilse yedeğe geçer. Yedekle ilk 11’i istediğin zaman dokunarak değiştirebilirsin.', 'Press “Draw a club”: the 18 clubs are in a bag and each comes out once; the Big Four come up more often. Pick a player from that club’s current FC 27 squad or from the stars of the last 10 years. If their position is free they go on the pitch, otherwise onto the bench. You can swap a sub with a starter at any time by tapping them.')}</p>`;
    const c = CLUB(S.club), need = new Set(DRAFT_SLOTS.filter(s => !S.picks[s.id]).map(s => s.pos));
    const list = c.players.map((p, i) => ({ p, i })).filter(x => !S.pf || x.p[1] === S.pf).sort((a, b) => b.p[2] - a.p[2]);
    return `<div class="club-head">${crest(c, 'lg')}<div><h3>${esc(c.name)}</h3><small class="muted">${c.players.length} ${T('oyuncu', 'players')}</small></div>${S.jokers > 0 ? `<button class="pill ghost sm" data-a="joker">↻ ${T('Joker', 'Joker')} (${S.jokers})</button>` : ''}</div>
      <div class="pos-filter"><button class="${!S.pf ? 'on' : ''}" data-pf="">${T('Tümü', 'All')}</button>${Object.keys(DRAFT_POS_NAMES).map(k => `<button class="${S.pf === k ? 'on' : ''} ${need.has(k) ? 'need' : ''}" data-pf="${k}">${PZ(k)}</button>`).join('')}</div>
      <div class="plist">${list.map(({ p, i }) => { const ok = canTake(p); return `<button class="pl ${ok ? '' : 'no'}" data-i="${i}" ${ok ? '' : 'disabled'}><span class="pos ${need.has(p[1]) ? 'need' : ''}">${PZ(p[1])}</span><b>${esc(p[0])}<small class="era ${p[3] === 'FC27' ? 'off' : ''}">${eraTxt(p[3])}</small></b><span class="rt">${rating(p)}</span></button>`; }).join('') || `<p class="muted">${T('Bu mevkide oyuncu yok.', 'No players in this position.')}</p>`}</div>`;
  }

  function bind() {
    const q = s => el.querySelector(s);
    if (q('[data-a=mode]')) q('[data-a=mode]').onclick = () => { S.mode = hide() ? 'normal' : 'sefir'; ls.set('draft_mode', S.mode); render(); };
    const sp = q('[data-a=spin]'); if (sp) sp.onclick = () => spin();
    const jk = q('[data-a=joker]'); if (jk) jk.onclick = () => { S.jokers--; S.club = null; spin(); };
    if (q('[data-a=reset]')) q('[data-a=reset]').onclick = () => { S = fresh(S.mode); activeHeroIdx = 0; render(); };
    if (q('[data-a=next]')) q('[data-a=next]').onclick = () => { if (count() !== 13) { flash(T('Önce 13 kişilik kadroyu tamamla.', 'Complete the 13-player squad first.')); return; } S.phase = 'tactics'; render(); };
    el.querySelectorAll('.pos-filter button').forEach(b => b.onclick = () => { S.pf = b.dataset.pf || null; render(); });
    el.querySelectorAll('.pl:not(.no)').forEach(b => b.onclick = () => take(+b.dataset.i));
    const sw = (node, t, key) => { node.onclick = () => onSwap(t, key); node.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwap(t, key); } }; };
    el.querySelectorAll('[data-b]').forEach(b => sw(b, 'b', +b.dataset.b));
    el.querySelectorAll('[data-slot]').forEach(b => sw(b, 's', b.dataset.slot));
  }

  const BIG4 = new Set(['gs', 'fb', 'bjk', 'ts']), W_BIG = 2.2;
  const rand01 = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; } catch (e) { return Math.random(); } };
  function drawClub() {
    if (!Array.isArray(S.bag)) S.bag = [];
    // Do not consume clubs that cannot provide an eligible player.
    let eligible = S.bag.filter(k => DRAFT_CLUBS[k] && DRAFT_CLUBS[k].players.some(canTake));
    if (!eligible.length) {
      S.bag = shuffle(DRAFT_CLUBS.map((c, i) => i));
      S.drawn = [];
      eligible = S.bag.filter(k => DRAFT_CLUBS[k].players.some(canTake));
    }
    if (!eligible.length) return -1;
    const weights = eligible.map(k => BIG4.has(DRAFT_CLUBS[k].id) ? W_BIG : 1);
    let r = rand01() * weights.reduce((a, b) => a + b, 0);
    let chosen = eligible[eligible.length - 1];
    for (let i = 0; i < eligible.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosen = eligible[i]; break; }
    }
    S.bag.splice(S.bag.indexOf(chosen), 1);
    return chosen;
  }
  function spin() {
    stop();
    const k = drawClub(); if (k < 0) { flash(T('Uygun oyuncu kalmadı. Kadronu veya seçimlerini kontrol et.', 'No eligible players remain. Check your squad and selections.')); return; }
    const target = DRAFT_CLUBS[k].id;
    el.querySelector('[data-a=spin]').disabled = true;
    const tiles = [...el.querySelectorAll('.ct')], N = 12;
    tiles.forEach(t => t.classList.remove('win', 'hot'));
    let t = 0;
    for (let i = 0; i < N; i++) {
      const last = i === N - 1;
      const tile = last ? el.querySelector(`.ct[data-club="${target}"]`) : tiles[rnd(tiles.length)];
      t += 28 + Math.pow(i / N, 2.4) * 150;
      later(() => {
        tiles.forEach(x => x.classList.remove('hot'));
        if (tile) tile.classList.add(last ? 'win' : 'hot');
        if (typeof AdvAudio !== 'undefined') AdvAudio.note(last ? 1046 : 700 + i * 12, last ? .18 : .03, last ? 'triangle' : 'square', last ? .05 : .02);
      }, t);
    }
    later(() => { S.club = target; S.pf = null; if (!S.drawn.includes(target)) S.drawn.push(target); render(); const pp = el.querySelector('.pick-panel'); if (pp) pp.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, t + 280);
  }
  function take(i) {
    if (S.phase !== 'draft' || !S.club) return;
    const c = CLUB(S.club), p = c && c.players[i];
    if (!p || !canTake(p)) { flash(T('Bu oyuncu artık seçilemiyor.', 'This player is no longer eligible.')); return; }
    swapSel = null;
    const o = { name: p[0], pos: p[1], r: p[2], club: c.id, era: p[3] };
    const s = openSlotsFor(p[1])[0];
    if (s) S.picks[s.id] = o; else S.bench[benchOpen()] = o;
    S.club = null; S.pf = null;
    const allP = picked();
    const idx = allP.findIndex(x => x.name === o.name);
    if (idx >= 0) activeHeroIdx = idx;
    render();
  }

  /* ---------------- TEKNİK DİREKTÖR VE TAKTİK ---------------- */
  const TACF = () => ({
    tempo: [T('Pas temposu', 'Passing tempo'), [['yavas', T('Yavaş', 'Slow')], ['dengeli', T('Dengeli', 'Balanced')], ['hizli', T('Hızlı', 'Fast')]]],
    pres: [T('Pres', 'Pressing'), [['dusuk', T('Düşük', 'Low')], ['orta', T('Orta', 'Medium')], ['yuksek', T('Yüksek', 'High')]]],
    hat: [T('Savunma hattı', 'Defensive line'), [['geride', T('Geride', 'Deep')], ['dengeli', T('Dengeli', 'Balanced')], ['onde', T('Önde', 'High')]]],
    yon: [T('Hücum yönü', 'Attacking focus'), [['kanat', T('Kanatlar', 'Wings')], ['dengeli', T('Dengeli', 'Balanced')], ['merkez', T('Merkez', 'Centre')]]]
  });
  function renderTactics() {
    if (count() !== 13) { S.phase = 'draft'; return render(); }
    save();
    const st = strength();
    el.innerHTML = `<section class="dr-hero"><p class="eyebrow">${T('Adım 2 / 2', 'Step 2 of 2')}</p><h1 class="display">${T('Teknik<br>direktör &amp; <em>taktik.</em>', 'Manager<br>&amp; <em>tactics.</em>')}</h1>
      <div class="dr-meta"><span class="chip">${T('Hücum', 'Attack')} <b>${hide() ? '??' : st.att.toFixed(1)}</b></span><span class="chip">${T('Savunma', 'Defence')} <b>${hide() ? '??' : st.def.toFixed(1)}</b></span><span class="chip chem-chip">🧪 ${T('Kimya', 'Chemistry')} <b>${st.cp}</b>/100 <small>(+${st.chem.toFixed(1)})</small></span><span class="chip">${T('Ort. reyting', 'Avg. rating')} <b>${hide() ? '??' : avg(st.xi.map(p => p.r)).toFixed(1)}</b></span>${S.last ? `<button class="chip" data-a="laststats">📊 ${T('Son sezon istatistikleri', 'Last season’s stats')}</button>` : ''}</div></section>
      <section class="tac">
        <div class="tac-block"><span class="eyebrow">${T('Teknik direktör', 'Manager')}</span><div class="coaches">${DRAFT_COACHES.map((c, i) => `<button class="coach ${S.coach === i ? 'on' : ''}" data-c="${i}"><b>${c.name}</b><small>${typeof I18N !== 'undefined' && I18N.lang === 'en' ? (COACH_EN[c.note] || c.note) : c.note}</small><span>${T('H', 'A')} ${c.att >= 0 ? '+' : ''}${c.att} · ${T('S', 'D')} ${c.def >= 0 ? '+' : ''}${c.def}</span></button>`).join('')}</div></div>
        ${Object.entries(TACF()).map(([k, [lbl, opts]]) => `<div class="tac-block"><span class="eyebrow">${lbl}</span><div class="seg2">${opts.map(([v, t]) => `<button data-k="${k}" data-v="${v}" class="${S.tac[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>`).join('')}
        <div class="dr-actions"><button class="pill ghost" data-a="back">← ${T('Kadroya dön', 'Back to squad')}</button><button class="pill big" data-a="play" ${S.coach === null ? 'disabled' : ''}>${T('SEZONU BAŞLAT', 'START SEASON')}</button></div><div class="dr-mode-switch"><a class="dr-career-link" href="#career">🎮 ${T('Haftalık maçlar, transfer, kondisyon ve canlı maç için ayrı <b>Menajerlik Kariyeri</b> modunu aç →', 'For weekly matches, transfers, fitness and live matches, open the separate <b>Manager Career</b> mode →')}</a></div>
      </section>`;
    el.querySelectorAll('.coach').forEach(b => b.onclick = () => { S.coach = +b.dataset.c; renderTactics(); });
    el.querySelectorAll('.seg2 button').forEach(b => b.onclick = () => { S.tac[b.dataset.k] = b.dataset.v; renderTactics(); });
    el.querySelector('[data-a=back]').onclick = () => { S.phase = 'draft'; render(); };
    el.querySelector('[data-a=play]').onclick = () => { if (S.coach !== null) season(false); };
    const ls2 = el.querySelector('[data-a=laststats]'); if (ls2) ls2.onclick = () => { S.phase = 'stats'; render(); };
  }

  function baseAD(xi) {
    const by = pos => xi.filter(p => p.pos === pos).map(p => p.r);
    const att = .45 * avg([...by('FV'), ...by('KN')]) + .35 * avg(by('OS')) + .2 * avg([...by('FV'), ...by('OS')]);
    const def = .35 * avg(by('KL')) + .45 * avg([...by('ST'), ...by('BK')]) + .2 * avg(by('OS'));
    const top3 = a => a.sort((x, y) => y - x).slice(0, 3), sa = top3([...by('FV'), ...by('KN'), ...by('OS')]), sd = top3([...by('KL'), ...by('ST'), ...by('BK'), ...by('OS')]);
    return { att: att + Math.max(0, avg(sa) - att) * .35, def: def + Math.max(0, avg(sd) - def) * .25 };
  }
  function strength() {
    const xi = DRAFT_SLOTS.map(s => S.picks[s.id]).filter(Boolean);
    let { att, def } = baseAD(xi);
    const cp = chemOf(xi).pct, chem = cp / 100 * CHEM_MAX;
    const benchAvg = avg(S.bench.filter(Boolean).map(p => p.r)); att += (benchAvg - 75) * .02; def += (benchAvg - 75) * .02;
    if (S.coach !== null) { att += DRAFT_COACHES[S.coach].att * CFG.coach; def += DRAFT_COACHES[S.coach].def * CFG.coach; }
    return { att: att + chem, def: def + chem, chem, cp, xi };
  }
  function mods(xi) {
    const t = S.tac; let a = 1, d = 1;
    if (t.tempo === 'hizli') { a *= 1.08; d *= 1.05; } else if (t.tempo === 'yavas') { a *= .95; d *= .94; }
    if (t.pres === 'yuksek') { a *= 1.06; d *= .95; } else if (t.pres === 'dusuk') { a *= .95; d *= 1.04; }
    if (t.hat === 'onde') { a *= 1.05; d *= 1.07; } else if (t.hat === 'geride') { a *= .94; d *= .9; }
    const kn = avg(xi.filter(p => p.pos === 'KN').map(p => p.r)), os = avg(xi.filter(p => p.pos === 'OS').map(p => p.r));
    if (t.yon === 'kanat') a *= kn >= os ? 1.06 : .98; else if (t.yon === 'merkez') a *= os >= kn ? 1.06 : .98;
    return { a: 1 + (a - 1) * CFG.tac, d: 1 + (d - 1) * CFG.tac };
  }
  function clubXI(c, taken) {
    const pool = c.players.filter(p => p[3] === 'FC27' && !taken.has(p[0])).map(p => ({ name: p[0], pos: p[1], r: p[2], club: c.id })).sort((a, b) => b.r - a.r);
    const need = { KL: 1, ST: 2, BK: 2, OS: 3, KN: 2, FV: 1 }, xi = [];
    for (const [pos, n] of Object.entries(need)) pool.filter(p => p.pos === pos && !xi.includes(p)).slice(0, n).forEach(p => xi.push(p));
    for (const [pos, n] of Object.entries(need)) { let have = xi.filter(p => p.pos === pos).length; while (have < n) { const f = pool.find(p => !xi.includes(p)); if (!f) break; xi.push(Object.assign({}, f, { pos, r: f.r - 4, orig: f })); have++; } }
    return xi;
  }
  const poisson = l => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
  const wpick = (arr, wf) => { const w = arr.map(wf), tot = w.reduce((s, v) => s + v, 0); let r = Math.random() * tot; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[0]; };
  const SC_W = { FV: 2.6, KN: 2.2, OS: 1.5, ST: .55, BK: .55, KL: 0 }, AS_W = { FV: 2, KN: 4.5, OS: 3, ST: .4, BK: 1.8, KL: .05 };

  function season(weekly = false) {
    if (count() !== 13 || S.coach === null || !DRAFT_COACHES[S.coach]) { flash(T('Sezona başlamak için kadronu ve teknik direktörünü tamamla.', 'Complete your squad and choose a manager first.')); return; }
    stop(); S.phase = 'season'; save();
    const st = strength(); let m = mods(st.xi);
    const taken = new Set(picked().map(p => p.name));
    const out = DRAFT_CLUBS[rnd(DRAFT_CLUBS.length)];
    const teams = [{ name: ME, short: 'SEN', id: 'me', me: true, xi: st.xi, c1: '#235c45', c2: '#b6dbbf', kit: 'duz' }];
    DRAFT_CLUBS.filter(c => c !== out).forEach(c => { const xi = clubXI(c, taken), ad = baseAD(xi), oc = chemOf(xi).pct / 100 * CHEM_MAX * .5; ad.att += oc; ad.def += oc; teams.push({ name: c.name, short: c.short, id: c.id, xi, att: ad.att + CFG.opp, def: ad.def + CFG.opp, c1: c.c1 }); });
    teams.forEach(t => Object.assign(t, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, form: [] }));
    const stats = {};
    const key = (t, p) => t.id + '|' + p.name;
    teams.forEach(t => t.xi.forEach(p => stats[key(t, p)] = { name: p.name, team: t.name, tid: t.id, c1: t.c1, pos: p.pos, r: p.r, g: 0, a: 0, cs: 0, apps: 0 }));
    // Each team experiences a coherent good/poor season (fitness, adaptation, morale).
    // This affects all teams symmetrically, not just the player or the four biggest clubs.
    const seasonForm = Object.fromEntries(teams.map(t => [t.id, Math.max(-4.5, Math.min(4.5, gauss() * CFG.seasonForm))]));
    const N = teams.length, idx = teams.map((_, i) => i), rounds = [];
    for (let r = 0; r < N - 1; r++) { const pr = []; for (let i = 0; i < N / 2; i++) pr.push(r % 2 ? [idx[N - 1 - i], idx[i]] : [idx[i], idx[N - 1 - i]]); rounds.push(pr); idx.splice(1, 0, idx.pop()); }
    const all = [...rounds, ...rounds.map(r => r.map(([h, a]) => [a, h]))];
    const lam = (att, def) => Math.max(.12, Math.min(4.2, CFG.base * Math.exp((att - def) / CFG.K)));
    const inj = {}; let bench = S.bench.filter(Boolean); const reserves = (S.reserves || []).slice();
    const form = Object.fromEntries(st.xi.map(p => [p.name, 0]));
    let budget = 25, transfers = 0;
    function injPenalty() {
      let pen = 0; const used = new Set();
      Object.entries(inj).forEach(([name, wks]) => { if (wks <= 0) return; const p = st.xi.find(x => x.name === name); if (!p) return;
        const sub = bench.filter(b => !used.has(b.name) && !inj[b.name]).sort((a, b) => (b.pos === p.pos) - (a.pos === p.pos) || b.r - a.r)[0];
        if (sub) used.add(sub.name); const r = sub ? sub.r - (sub.pos === p.pos ? 0 : 4) : 58; pen += (r - p.r) / 11; });
      return pen;
    }
    function goals(t, n, list) {
      for (let k = 0; k < n; k++) {
        const sc = wpick(t.xi, p => SC_W[p.pos] * Math.pow(p.r / 75, 2)); stats[key(t, sc)].g++;
        let as = null;
        if (Math.random() < .78) { as = wpick(t.xi.filter(p => p !== sc), p => AS_W[p.pos] * Math.pow(p.r / 75, 4)); stats[key(t, as)].a++; }
        list.push({ t: t.id, sc: sc.name, as: as && as.name, min: 1 + rnd(90) });
      }
    }
    function play(h, a) {
      const H = teams[h], A = teams[a];
      let lh, la;
      const fh = gauss() * CFG.noise + seasonForm[H.id], fa = gauss() * CFG.noise + seasonForm[A.id], pen = (H.me || A.me) ? injPenalty() + (weekly ? avg(st.xi.map(p => form[p.name] || 0)) * .6 : 0) : 0;
      const ha = (H.me ? st.att + pen : H.att) + fh, hd = (H.me ? st.def + pen : H.def) + fh, aa = (A.me ? st.att + pen : A.att) + fa, ad2 = (A.me ? st.def + pen : A.def) + fa;
      lh = lam(ha, ad2) * CFG.home; la = lam(aa, hd) * CFG.away;
      if (H.me) { lh *= m.a; la /= m.d; } else if (A.me) { la *= m.a; lh /= m.d; }
      const capFor = d => d > 10 ? .85 : d > 6 ? 1.15 : d > 3 ? 1.6 : 4.2;
      lh = Math.min(lh, capFor(ad2 - ha)); la = Math.min(la, capFor(hd - aa));
      const physical = weekly && typeof DraftPhysics !== 'undefined' ? DraftPhysics.simulate(H, A, { homeBoost: .045, tempo: 1 }) : null;
      let gh = physical ? physical.gh : poisson(lh), ga = physical ? physical.ga : poisson(la); const ev = [];
      while (!physical && Math.abs(gh - ga) > 4 && Math.random() < .65) { if (gh > ga) gh--; else ga--; }
      if (physical) {
        physical.ev.forEach(e => {
          const t = e.t === 'h' ? H : A, sc = t.xi.find(p => p.name === e.sc);
          if (sc && stats[key(t, sc)]) stats[key(t, sc)].g++;
          const as = t.xi.find(p => p.name === e.as);
          if (as && stats[key(t, as)]) stats[key(t, as)].a++;
          ev.push({ t: t.id, sc: e.sc, as: e.as, min: e.min, trail: e.trail, xg: e.xg });
        });
      } else { goals(H, gh, ev); goals(A, ga, ev); }
      ev.sort((x, y) => x.min - y.min);
      H.gf += gh; H.ga += ga; A.gf += ga; A.ga += gh;
      [[H, ga], [A, gh]].forEach(([T, conc]) => T.xi.forEach(p => { const s = stats[key(T, p)]; s.apps++; if (!conc && (p.pos === 'KL' || p.pos === 'ST' || p.pos === 'BK')) s.cs++; }));
      if (gh > ga) { H.w++; H.p += 3; A.l++; H.form.push('G'); A.form.push('M'); } else if (gh < ga) { A.w++; A.p += 3; H.l++; H.form.push('M'); A.form.push('G'); } else { H.d++; A.d++; H.p++; A.p++; H.form.push('B'); A.form.push('B'); }
      return { h, a, gh, ga, ev, lh, la, physics: physical && physical.stats };
    }
    el.innerHTML = `<section class="dr-hero"><p class="eyebrow">${T('Sezon simülasyonu', 'Season simulation')} · ${T(`${esc(out.name)}'in yerini sen aldın`, `you have taken ${esc(out.name)}’s place`)}</p><h1 class="display">${T('Hafta', 'Week')} <em class="wk">0</em><span class="slash">/34</span></h1>
      <div class="dr-meta"><span class="chip">${T('Puan', 'Points')} <b class="pts">0</b></span><span class="chip">${T('G-B-M', 'W-D-L')} <b class="wdl">0-0-0</b></span><span class="chip">${T('Gol', 'Goals')} <b class="gl">0:0</b></span><button class="chip toggle" data-a="fast">⏩ ${T('Hızlandır', 'Speed up')}</button></div></section>
      <section class="season"><div class="live"><div class="live-card"><span class="eyebrow lc-t">${T('Maç günü', 'Matchday')}</span><div class="score"><span class="tn h">—</span><b class="sc">0 – 0</b><span class="tn a">—</span></div><div class="minute"><i></i></div><div class="goals-ev"></div><div class="feed"></div></div>
        <div class="bar"><i></i></div><div class="mini-kings"></div></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>${T('Takım', 'Team')}</th><th>${T('O', 'P')}</th><th>${T('G', 'W')}</th><th>${T('B', 'D')}</th><th>${T('M', 'L')}</th><th>${T('A', 'GD')}</th><th>${T('P', 'Pts')}</th></tr></thead><tbody></tbody></table></div></section>`;
    const q = s => el.querySelector(s), me = teams[0];
    let wk = 0, speed = 700;
    q('[data-a=fast]').onclick = e => { speed = speed > 100 ? 60 : 700; e.target.classList.toggle('on', speed < 100); e.target.textContent = speed < 100 ? T('▶ Normal hız', '▶ Normal speed') : T('⏩ Hızlandır', '⏩ Speed up'); };
    const sorted = () => teams.slice().sort((x, y) => y.p - x.p || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
    function table() {
      const s = sorted();
      q('.tbl tbody').innerHTML = s.map((t, i) => `<tr class="${t.me ? 'me' : ''}"><td>${i + 1}</td><td><i class="dot" style="background:${t.c1}"></i>${esc(TN(t.name))}</td><td>${t.w + t.d + t.l}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td><b>${t.p}</b></td></tr>`).join('');
      return s.indexOf(me) + 1;
    }
    function kings() {
      const top = Object.values(stats).filter(s => s.g).sort((a, b) => b.g - a.g || b.a - a.a).slice(0, 3);
      q('.mini-kings').innerHTML = top.length ? `<span class="eyebrow">${T('Gol krallığı', 'Top scorers')}</span>${top.map((s, i) => `<div class="mk ${s.tid === 'me' ? 'me' : ''}"><span>${i + 1}</span><i class="dot" style="background:${s.c1}"></i><b>${esc(s.name)}</b><em>${s.g}</em></div>`).join('')}` : '';
    }
    table();
    function week() {
      if (wk >= all.length) return finish();
      const res = all[wk].map(([h, a]) => play(h, a)), mine = res.find(r => teams[r.h].me || teams[r.a].me);
      Object.keys(inj).forEach(k => { inj[k]--; if (inj[k] <= 0) delete inj[k]; });
      let injMsg = '';
      st.xi.forEach(p => { if (!inj[p.name] && Math.random() < CFG.inj) { const w = 1 + Math.floor(Math.random() * Math.random() * 7); inj[p.name] = w; injMsg = T(`🚑 ${p.name} sakatlandı (${w} hafta)`, `🚑 ${p.name} injured (${w} ${w > 1 ? 'weeks' : 'week'})`); } });
      wk++;
      q('.wk').textContent = wk; q('.pts').textContent = me.p; q('.wdl').textContent = `${me.w}-${me.d}-${me.l}`; q('.gl').textContent = `${me.gf}:${me.ga}`;
      q('.bar i').style.width = (wk / 34 * 100) + '%';
      const home = teams[mine.h].me, opp = teams[home ? mine.a : mine.h];
      q('.lc-t').textContent = T(`${wk}. hafta · ${home ? 'İç saha' : 'Deplasman'}`, `Week ${wk} · ${home ? 'Home' : 'Away'}`);
      q('.tn.h').textContent = TN(teams[mine.h].name); q('.tn.a').textContent = TN(teams[mine.a].name);
      const myG = home ? mine.gh : mine.ga, opG = home ? mine.ga : mine.gh, r = myG > opG ? 'G' : myG < opG ? 'M' : 'B';
      const mn = q('.minute i'); mn.style.transition = 'none'; mn.style.width = '0'; void mn.offsetWidth; mn.style.transition = `width ${Math.max(40, speed * .7)}ms linear`; mn.style.width = '100%';
      q('.sc').textContent = `${mine.gh} – ${mine.ga}`; q('.live-card').dataset.r = r;
      q('.goals-ev').innerHTML = mine.ev.map(e => `<span class="${e.t === 'me' ? 'mine' : ''}">⚽ ${e.min}' ${esc(e.sc)}${e.as ? ` <small>(${esc(e.as)})</small>` : ''}</span>`).join('');
      const f = q('.feed'); f.insertAdjacentHTML('afterbegin', `<div class="fr ${r}"><span>${wk}</span><b>${FL(r)}</b> ${home ? '' : '@ '}${esc(TN(opp.name))} <em>${myG}–${opG}</em></div>${injMsg ? `<div class="fr inj">${esc(injMsg)}</div>` : ''}`); while (f.children.length > 5) f.lastChild.remove();
      if (typeof AdvAudio !== 'undefined' && speed > 100) AdvAudio.note(r === 'G' ? 784 : r === 'B' ? 523 : 330, .12, 'triangle', .04);
      table(); kings(); later(week, speed);
    }
    function finish() {
      const rank = table(), best = ls.get('draft_best', 0); if (me.p > best) ls.set('draft_best', me.p);
      if (typeof Scores !== 'undefined') { Scores.report('draft', me.p, { rank }); const sn = snapshot(); if (sn) Scores.saveSquad(sn); }
      const fin = sorted(), pos = {}; fin.forEach((t, i) => pos[t.id] = i + 1);
      const list = Object.values(stats);
      list.forEach(s => { const tp = pos[s.tid]; s.score = s.g * 1.0 + s.a * .7 + (s.r - 72) * .35 + (s.pos === 'KL' ? s.cs * .45 : (s.pos === 'ST' || s.pos === 'BK') ? s.cs * .18 : 0) + (tp === 1 ? 4 : tp <= 4 ? 1.5 : 0); });
      const top = (arr, f, n) => arr.slice().sort(f).slice(0, n);
      S.last = {
        out: out.name, rank, pts: me.p, w: me.w, d: me.d, l: me.l, gf: me.gf, ga: me.ga, best: me.p > best, prevBest: best,
        table: fin.map(t => ({ name: t.name, id: t.id, c1: t.c1, me: !!t.me, p: t.p, w: t.w, d: t.d, l: t.l, gf: t.gf, ga: t.ga, form: t.form.slice(-5).join('') })),
        scorers: top(list.filter(s => s.g), (a, b) => b.g - a.g || b.a - a.a || b.r - a.r, 15),
        assists: top(list.filter(s => s.a), (a, b) => b.a - a.a || b.g - a.g || b.r - a.r, 15),
        gk: top(list.filter(s => s.pos === 'KL'), (a, b) => b.cs - a.cs || b.r - a.r, 5),
        poy: top(list, (a, b) => b.score - a.score, 5),
        mine: list.filter(s => s.tid === 'me').sort((a, b) => b.g + b.a - (a.g + a.a) || b.r - a.r)
      };
      S.last.manager = weekly ? { transfers, budget } : null;
      recordSeason(S.last);
      S.phase = 'stats'; S.tab = 'awards'; save();
      if (rank === 1 && typeof confetti === 'function') confetti();
      renderStats();
    }
    later(week, 400);
    window.__draftSeason = { fast: () => { speed = 1; } };
  }

  function renderStats() {
    const L = S.last; if (!L) { S.phase = 'tactics'; return renderTactics(); }
    const tab = S.tab || 'awards';
    const msg = L.w === 34 ? T('34’te 34! Efsane sezon!', '34 out of 34! A legendary season!') : L.rank === 1 ? T('Şampiyon!', 'Champions!') : L.rank <= 4 ? T('Avrupa’ya gidiyoruz.', 'We’re going to Europe.') : L.rank <= 10 ? T('Orta sıralar.', 'Mid-table.') : L.rank >= 16 ? T('Küme düştük…', 'Relegated…') : T('Zor bir sezon.', 'A tough season.');
    const award = (ic, ttl, s, val) => s ? `<div class="award"><span class="aw-ic">${ic}</span><span class="eyebrow">${ttl}</span><b>${esc(s.name)}</b><small><i class="dot" style="background:${s.c1}"></i>${esc(TN(s.team))}</small><em>${val}</em></div>` : '';
    const row = (s, i, val) => `<tr class="${s.tid === 'me' ? 'me' : ''}"><td>${i + 1}</td><td><b>${esc(s.name)}</b><small class="muted"> ${PZ(s.pos)}</small></td><td><i class="dot" style="background:${s.c1}"></i>${esc(TN(s.team))}</td><td><b>${val(s)}</b></td></tr>`;
    const body = {
      awards: `<div class="awards">${award('⚽', T('Gol kralı', 'Top scorer'), L.scorers[0], L.scorers[0] ? L.scorers[0].g + T(' gol', ' goals') : '')}${award('🎯', T('Asist kralı', 'Most assists'), L.assists[0], L.assists[0] ? L.assists[0].a + T(' asist', ' assists') : '')}${award('⭐', T('Yılın oyuncusu', 'Player of the season'), L.poy[0], L.poy[0] ? `${L.poy[0].g} ${T('gol', 'goals')} · ${L.poy[0].a} ${T('asist', 'assists')}` : '')}${award('🧤', T('Altın eldiven', 'Golden Glove'), L.gk[0], L.gk[0] ? L.gk[0].cs + T(' gol yemedi', ' clean sheets') : '')}</div>
        <div class="poy-list"><span class="eyebrow">${T('Yılın oyuncusu oylaması', 'Player of the season vote')}</span>${L.poy.map((s, i) => `<div class="mk ${s.tid === 'me' ? 'me' : ''}"><span>${i + 1}</span><i class="dot" style="background:${s.c1}"></i><b>${esc(s.name)}</b><small>${esc(TN(s.team))}</small><em>${s.g}${T('G', 'G')} ${s.a}${T('A', 'A')}</em></div>`).join('')}</div>`,
      table: `<table class="tbl"><thead><tr><th>#</th><th>${T('Takım', 'Team')}</th><th>${T('O', 'P')}</th><th>${T('G', 'W')}</th><th>${T('B', 'D')}</th><th>${T('M', 'L')}</th><th>${T('A', 'GD')}</th><th class="form">Form</th><th>${T('P', 'Pts')}</th></tr></thead><tbody>${L.table.map((t, i) => `<tr class="${t.me ? 'me' : ''} ${i >= 15 ? 'rel' : i < 4 ? 'eur' : ''}"><td>${i + 1}</td><td><i class="dot" style="background:${t.c1}"></i>${esc(TN(t.name))}</td><td>${t.w + t.d + t.l}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td class="form">${t.form.split('').map(c => `<i class="f${c}">${FL(c)}</i>`).join('')}</td><td><b>${t.p}</b></td></tr>`).join('')}</tbody></table>`,
      goals: `<table class="tbl"><thead><tr><th>#</th><th>${T('Oyuncu', 'Player')}</th><th>${T('Takım', 'Team')}</th><th>${T('Gol', 'Goals')}</th></tr></thead><tbody>${L.scorers.map((s, i) => row(s, i, s => s.g)).join('')}</tbody></table>`,
      assists: `<table class="tbl"><thead><tr><th>#</th><th>${T('Oyuncu', 'Player')}</th><th>${T('Takım', 'Team')}</th><th>${T('Asist', 'Assists')}</th></tr></thead><tbody>${L.assists.map((s, i) => row(s, i, s => s.a)).join('')}</tbody></table>`,
      mine: `<table class="tbl"><thead><tr><th>${T('Oyuncu', 'Player')}</th><th>${T('Mevki', 'Pos.')}</th><th>${T('Maç', 'Apps')}</th><th>${T('Gol', 'Goals')}</th><th>${T('Asist', 'Assists')}</th><th>${T('GY', 'CS')}</th></tr></thead><tbody>${L.mine.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${PZ(s.pos)}</td><td>${s.apps}</td><td>${s.g}</td><td>${s.a}</td><td>${s.cs}</td></tr>`).join('')}</tbody></table><p class="muted sm">${T('GY: gol yenmeyen maç (kaleci ve defans)', 'CS: clean sheets (goalkeeper and defence)')}</p>`
    }[tab];
    const xi = DRAFT_SLOTS.map(s => S.picks[s.id]).filter(Boolean), ch = chemOf(xi);
    el.innerHTML = `
      ${renderShowcase(xi, ch, 'stats')}
      <section class="dr-hero"><p class="eyebrow">${T('Sezon sonu', 'End of season')} · ${T(`${esc(L.out)}'in yerini sen aldın`, `you took ${esc(L.out)}’s place`)}</p>
      <div class="end-head"><div class="big-pts">${L.pts}<small>/102</small></div><div><h2>${T(L.rank + '. sıra', 'Finished ' + L.rank + ([, 'st', 'nd', 'rd'][L.rank % 10 > 3 || [11, 12, 13].includes(L.rank % 100) ? 0 : L.rank % 10] || 'th'))} · ${msg}</h2><p class="muted">${L.w}${FL('G')} ${L.d}${FL('B')} ${L.l}${FL('M')} · ${T('Gol', 'Goals')} ${L.gf}:${L.ga}</p>${L.best ? `<span class="chip on">🏆 ${T('Yeni rekor', 'New record')}</span>` : `<span class="chip">${T('Rekor', 'Record')} ${Math.max(L.prevBest, L.pts)}</span>`}</div></div></section>
      <nav class="st-tabs">${[['awards', T('🏅 Ödüller', '🏅 Awards')], ['table', T('Puan durumu', 'League table')], ['goals', T('Gol krallığı', 'Top scorers')], ['assists', T('Asist krallığı', 'Top assists')], ['mine', T('Takımım', 'My team')]].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}</nav>
      <section class="st-body">${body}</section>
      ${careerHtml()}
      <div class="dr-actions"><button class="pill ghost" data-a="tac">${T('Taktiği değiştir', 'Change tactics')}</button><button class="pill ghost" data-a="again">${T('Aynı kadroyla tekrar', 'Replay with the same squad')}</button><button class="pill" data-a="new">${T('Yeni draft', 'New draft')}</button></div>`;
    el.querySelectorAll('.st-tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.t; save(); renderStats(); });
    el.querySelector('[data-a=tac]').onclick = () => { S.phase = 'tactics'; render(); };
    el.querySelector('[data-a=again]').onclick = () => season();
    el.querySelector('[data-a=new]').onclick = () => { S = fresh(S.mode); activeHeroIdx = 0; render(); };
    bindShowcase();
    save();
  }

  function snapshot() {
    if (!S) { const st0 = ls.get('draft_state', null); if (!st0 || st0.v !== 3) return null; S = st0; }
    const xi = DRAFT_SLOTS.map(s => S.picks[s.id]).filter(Boolean);
    if (xi.length < 11 || S.coach === null) return null;
    const st = strength(), m = mods(st.xi), f = x => Math.round(x * 100) / 100;
    return { v: 1, att: f(st.att), def: f(st.def), cp: st.cp, ma: f(m.a * 1000) / 1000, md: f(m.d * 1000) / 1000, avg: Math.round(avg(st.xi.map(p => p.r))), coach: DRAFT_COACHES[S.coach].name, tac: Object.assign({}, S.tac),
      xi: st.xi.map(p => ({ n: p.name, p: p.pos, r: p.r })), bench: S.bench.filter(Boolean).map(p => ({ n: p.name, p: p.pos, r: p.r })) };
  }
  function h2h(H, A, seed) {
    let s0 = seed >>> 0;
    const R = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const G = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const pois = l => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; };
    const pick = (arr, wf) => { const w = arr.map(wf), tot = w.reduce((a, b) => a + b, 0) || 1; let r = R() * tot; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
    const lam = (att, def) => Math.max(.12, Math.min(4.2, CFG.base * Math.exp((att - def) / CFG.K)));
    const fh = G() * CFG.noise, fa = G() * CFG.noise;
    const lh = lam(H.att + fh, A.def + fa) * CFG.home * (H.ma || 1) / (A.md || 1), la = lam(A.att + fa, H.def + fh) * CFG.away * (A.ma || 1) / (H.md || 1);
    const hs = Math.min(12, pois(lh)), as = Math.min(12, pois(la)), ev = [];
    const goals = (T, side, n) => { for (let k = 0; k < n; k++) { const sc = pick(T.xi, p => (SC_W[p.p] || .5) * Math.pow(p.r / 75, 2)); const as_ = R() < .78 ? pick(T.xi.filter(p => p !== sc), p => (AS_W[p.p] || 1) * Math.pow(p.r / 75, 4)) : null; ev.push({ s: side, sc: sc.n, as: as_ && as_.n, min: 1 + Math.floor(R() * 90) }); } };
    goals(H, 'h', hs); goals(A, 'a', as); ev.sort((x, y) => x.min - y.min);
    return { hs, as, ev };
  }

  return { open, stop, snapshot, h2h, _cfg: CFG, get state() { return S; }, _take: take, _spin: spin, _draw: () => drawClub() };
})();
