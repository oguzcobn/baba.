/* =====================================================================
   BABA. — MENAJERLİK KARİYERİ (#career) · Draft'tan tamamen bağımsız mod
   Kayıt: localStorage 'baba_career_save' (draft'ın 'draft_state' kaydına dokunmaz)
   Sekmeler: Kulüp Merkezi · Kadro & Taktik · Transfer Pazarı · Lig & Fikstür · Kulüp & Tesis
   Mekanikler: kondisyon, sakatlık, kart cezası, moral, genç gelişimi/yaşlanma, sponsorluk,
               tesis yatırımları, scout & altyapı, karar kartları, canlı metin maçı + müdahale, 2D özet
   Bağımlılıklar: DRAFT_CLUBS (draft-data.js) · ClubID (club-id.js, ops.) · Match2D (match2d.js, ops.)
   ===================================================================== */
const Career = (() => {
  'use strict';
  const KEY = 'baba_career_save', VER = 1, WEEKS = 34, MAXSQ = 30, MINSQ = 16;
  const T = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? en : tr;
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)], clamp = (x, a, b) => Math.max(a, Math.min(b, x)), chance = p => Math.random() < p;
  const poisson = l => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
  const wpick = (arr, f) => { const w = arr.map(f), t = w.reduce((a, b) => a + b, 0); if (!t) return arr[0]; let r = Math.random() * t; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[0]; };
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 60;
  const M = n => (Math.round(n * 10) / 10).toLocaleString(T('tr-TR', 'en-GB'), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M€';
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------------- futbol verisi ---------------- */
  const POS = ['KL', 'ST', 'BK', 'OS', 'KN', 'FV'];
  const PZ = p => T({ KL: 'KL', ST: 'STP', BK: 'BEK', OS: 'OS', KN: 'KNT', FV: 'FV' }[p], { KL: 'GK', ST: 'CB', BK: 'FB', OS: 'CM', KN: 'W', FV: 'ST' }[p]);
  const ZONE = { KL: 'G', ST: 'D', BK: 'D', OS: 'M', KN: 'A', FV: 'A' }, NEAR = { ST: ['BK', 'OS'], BK: ['ST', 'KN'], OS: ['ST', 'KN', 'FV'], KN: ['BK', 'OS', 'FV'], FV: ['KN', 'OS'], KL: [] };
  // x: 0 sol – 100 sağ, y: 0 rakip kale – 100 kendi kale (Match2D ile aynı çerçeve)
  const FORMATIONS = {
    '4-3-3': [['KL', 50, 94], ['BK', 12, 74], ['ST', 37, 80], ['ST', 63, 80], ['BK', 88, 74], ['OS', 28, 54], ['OS', 50, 60], ['OS', 72, 54], ['KN', 14, 24], ['FV', 50, 14], ['KN', 86, 24]],
    '4-4-2': [['KL', 50, 94], ['BK', 12, 74], ['ST', 37, 80], ['ST', 63, 80], ['BK', 88, 74], ['KN', 12, 46], ['OS', 38, 54], ['OS', 62, 54], ['KN', 88, 46], ['FV', 36, 16], ['FV', 64, 16]],
    '4-2-3-1': [['KL', 50, 94], ['BK', 12, 74], ['ST', 37, 80], ['ST', 63, 80], ['BK', 88, 74], ['OS', 38, 62], ['OS', 62, 62], ['KN', 14, 34], ['OS', 50, 38], ['KN', 86, 34], ['FV', 50, 14]],
    '3-5-2': [['KL', 50, 94], ['ST', 28, 80], ['ST', 50, 83], ['ST', 72, 80], ['BK', 8, 52], ['OS', 32, 56], ['OS', 50, 64], ['OS', 68, 56], ['BK', 92, 52], ['FV', 36, 16], ['FV', 64, 16]],
    '4-1-4-1': [['KL', 50, 94], ['BK', 12, 74], ['ST', 37, 80], ['ST', 63, 80], ['BK', 88, 74], ['OS', 50, 66], ['KN', 12, 40], ['OS', 36, 46], ['OS', 64, 46], ['KN', 88, 40], ['FV', 50, 14]],
    '5-3-2': [['KL', 50, 94], ['BK', 8, 66], ['ST', 30, 80], ['ST', 50, 83], ['ST', 70, 80], ['BK', 92, 66], ['OS', 30, 52], ['OS', 50, 58], ['OS', 70, 52], ['FV', 36, 16], ['FV', 64, 16]]
  };
  const ROLES = () => ({
    KL: [['klasik', T('Klasik kaleci', 'Goalkeeper'), 0, 1], ['libero', T('Libero kaleci', 'Sweeper keeper'), .4, .6]],
    ST: [['klasik', T('Klasik stoper', 'Centre-back'), 0, 1], ['topcu', T('Top oynayan stoper', 'Ball-playing CB'), .5, .5]],
    BK: [['savunma', T('Savunma beki', 'Defensive full-back'), 0, 1], ['hucum', T('Hücum beki', 'Attacking full-back'), .8, .2]],
    OS: [['onlibero', T('Ön libero', 'Holding midfielder'), 0, 1], ['b2b', 'Box-to-box', .5, .5], ['kurucu', T('Oyun kurucu', 'Playmaker'), 1, 0]],
    KN: [['klasik', T('Klasik kanat', 'Winger'), .8, .2], ['ice', T('İçe kat eden', 'Inside forward'), 1, 0], ['savunan', T('Savunan kanat', 'Defensive winger'), .3, .7]],
    FV: [['bitirici', T('Bitirici', 'Poacher'), 1, 0], ['hedef', T('Hedef santrfor', 'Target man'), .8, .2], ['sahte9', T('Sahte 9', 'False nine'), .6, .4]]
  });
  const MENT = () => ({ savunma: [T('Otobüsü çek', 'Park the bus'), -4, 4], temkinli: [T('Temkinli', 'Cautious'), -2, 2], dengeli: [T('Dengeli', 'Balanced'), 0, 0], hucum: [T('Hücuma kalk', 'Attack'), 3, -3], tumhucum: [T('Topyekûn hücum', 'All-out attack'), 5, -5] });
  const PLANS = () => (typeof Match2D !== 'undefined' && Match2D.STYLES ? Match2D.STYLES() : { dengeli: T('Dengeli', 'Balanced'), kisa: T('Kısa pasla çık', 'Play out short'), kanat: T('Kanatlardan orta', 'Cross from wide'), arapas: T('Ara pas & derin koşu', 'Through balls'), uzun: T('Uzun top & pivot', 'Long ball to target'), kontra: T('Kontra atak', 'Counter-attack') });
  const traitsOf = p => p.traits || (typeof Traits !== 'undefined' ? Traits.of(p.name, p.pos, p.r) : []);
  // plan × kadro özellikleri → gol beklentisi çarpanları (plan kadroya uyuyorsa işe yarar)
  function planMod(style, xiIds, oppStronger) {
    const xi = xiIds.map(id => P(id)).filter(Boolean), cnt = (t, pos) => xi.filter(p => (!pos || pos.includes(p.pos)) && traitsOf(p).includes(t)).length;
    const aer = cnt('AERIAL_THREAT', ['FV', 'ST', 'OS']), aerFV = cnt('AERIAL_THREAT', ['FV']), pm = cnt('PLAYMAKER'), spd = cnt('SPEED_DRIBBLER', ['FV', 'KN']), fin = cnt('FINESSE_SHOT');
    const m = { dengeli: [1, 1], kisa: [1 + .02 * pm, .9], kanat: [.95 + .07 * aer + .03 * spd, 1], arapas: [.94 + .06 * (pm + spd), 1.05], uzun: [.9 + .09 * aerFV + .03 * aer, 1], kontra: [oppStronger ? 1.1 : .94, .9] }[style] || [1, 1];
    if (style === 'kanat' || style === 'dengeli') m[0] += .02 * fin;
    return { me: clamp(m[0], .85, 1.25), op: clamp(m[1], .85, 1.15) };
  }
  // gol şekilleri: plana göre olasılık
  const GOALS = () => ({ long: T('ceza sahası dışından müthiş bir şutla', 'with a stunning strike from outside the box'), cross: T('kanattan gelen ortada kafayla', 'with a header from a cross'), through: T('ara pasla kaleciyle karşı karşıya kalıp soğukkanlı bir vuruşla', 'one-on-one after a through ball, coolly'), corner: T('kornerden gelen topta', 'from a corner'), pen: T('penaltıdan', 'from the penalty spot'), rebound: T('dönen topu tamamlayarak', 'by tucking in the rebound'), fk: T('frikikten kavisli bir vuruşla', 'with a curling free kick'), cutin: T('içeri kat edip uzak köşeye plase vuruşla', 'cutting inside and curling into the far corner'), cutback: T('çizgiden geri çıkan topa vurarak', 'from a cutback'), target: T('pivotun indirdiği topa ilk vuruşla', 'first time from the target man’s lay-off') });
  const GW = { dengeli: { long: 1, cross: 1, through: 1.2, corner: .6, pen: .4, rebound: .8, fk: .3, cutin: .8, cutback: 1, target: .6 }, kisa: { through: 1.8, cutback: 1.4, rebound: 1, cutin: 1, long: .6, cross: .5, corner: .5, pen: .5, fk: .3, target: .3 }, kanat: { cross: 2.6, cutback: 2, corner: .9, cutin: 1.2, through: .6, long: .5, rebound: .9, pen: .4, fk: .3, target: .5 }, arapas: { through: 3, cutin: .8, long: .6, cutback: .8, cross: .5, rebound: .6, corner: .5, pen: .5, fk: .3, target: .4 }, uzun: { target: 2.6, cross: 1.6, corner: 1, rebound: 1.2, long: 1, through: .5, cutback: .4, pen: .4, fk: .4, cutin: .3 }, kontra: { through: 2.8, cutin: 1, long: .8, cutback: 1, cross: .5, rebound: .5, corner: .4, pen: .5, fk: .3, target: .4 } };
  const clubs = () => (typeof DRAFT_CLUBS !== 'undefined' ? DRAFT_CLUBS : []);
  const CLUB = id => clubs().find(c => c.id === id);
  const NAT = n => (typeof DRAFT_NAT !== 'undefined' && DRAFT_NAT[n]) || 'TR';

  /* ---------------- gerçek doğum tarihleri ---------------- */
  const birthDate = name => (typeof CAREER_PLAYER_BIRTHDATES !== 'undefined' && CAREER_PLAYER_BIRTHDATES[name]) || null;
  // Each career season is anchored to 16 November; do not use the real-world clock
  // or replaying a saved season would silently change players' ages.
  function realAge(dob, seasonYear) {
    const [y, m, d] = dob.split('-').map(Number);
    const year = Number.isFinite(seasonYear) ? seasonYear : 2026;
    return year - y - ((m > 11 || (m === 11 && d > 16)) ? 1 : 0);
  }
  const currentAge = name => {
    const dob = birthDate(name);
    return dob ? realAge(dob, S && S.year ? S.year : 2026) : null;
  };
  const syncAge = p => {
    if (!p || p.youth) return false;
    const dob = birthDate(p.name);
    if (!dob) return false;
    const age = realAge(dob, S && S.year ? S.year : 2026);
    if (p.age === age && p.dob === dob) return false;
    p.age = age;
    p.dob = dob;
    return true;
  };
  /* ---------------- oyuncu modeli ---------------- */
  function mkPlayer(name, pos, r, extra) {
    const h = hash(name), exact = (extra && extra.youth) ? null : currentAge(name);
    const age = exact === null ? ((extra && extra.age) ?? (19 + h % 16)) : exact;
    const pot = (extra && extra.pot) || clamp(Math.round(r + (age < 24 ? (24 - age) * 1.6 + h % 5 : age < 28 ? h % 3 : 0)), r, 93);
    const p = Object.assign({ id: uid(), name, pos, r, pot, age, nat: NAT(name), cond: 100, inj: 0, sus: 0, yc: 0, morale: 70, g: 0, a: 0, apps: 0, sg: 0, sa: 0, prog: 0 }, extra || {});
    syncAge(p);
    return p;
  }
  const value = p => { const ag = p.age <= 21 ? 1.5 : p.age <= 24 ? 1.25 : p.age >= 34 ? .45 : p.age >= 31 ? .7 : 1; return Math.max(.1, Math.round(.08 * Math.pow(1.25, p.r - 60) * ag * (p.pot - p.r > 6 ? 1.2 : 1) * 10) / 10); };
  const baseWage = p => .002 + value(p) * .0065; // M€/hafta
  const wage = p => p.wage != null ? p.wage : baseWage(p); // pazarlıkla belirlenen maaş varsa o geçerlidir
  // genç yetenek bedeli potansiyelle birlikte artar: 90+ POT bir oyuncu artık bedavaya gelmez
  const scoutFee = p => Math.max(.2, Math.round((value(p) * .6 + Math.pow(Math.max(0, p.pot - 72), 2) * .0125) * 10) / 10);
  const hex2 = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const cdist = (a, b) => { const x = hex2(a), y = hex2(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  /* ---------------- forma ve ikon yardımcıları ---------------- */
  const UI = typeof CareerUI !== 'undefined' ? CareerUI : null;
  const ic = (n, cls) => UI ? UI.ic(n, cls) : '';
  const ICZ = h => UI ? UI.iconize(h) : h;
  const KIT = (t, away) => typeof ClubID !== 'undefined' && ClubID.kitOf ? ClubID.kitOf(t, away ? 'away' : 'home') : { type: 'solid-trim', c1: (t && t.c1) || '#888', c2: (t && t.c2) || '#fff' };
  const jersey = (t, o) => typeof ClubID !== 'undefined' && ClubID.renderJerseySVG ? ClubID.renderJerseySVG(KIT(t, o && o.away), o) : '';
  // forma numaraları: kadro içinde benzersiz, mevkiye uygun (kaleci 1/12/23…, santrfor 9/10/19…)
  const NUMP = { KL: [1, 12, 23, 25, 31, 34], BK: [2, 3, 22, 13, 27, 77], ST: [4, 5, 6, 15, 24, 14], OS: [8, 6, 10, 16, 20, 18, 14, 21], KN: [7, 11, 17, 19, 21, 27], FV: [9, 10, 19, 18, 29, 99] };
  function assignNums() {
    const used = new Set();
    S.squad.forEach(p => { if (Number.isInteger(p.num) && p.num > 0 && p.num < 100 && !used.has(p.num)) used.add(p.num); else p.num = null; });
    S.squad.slice().sort((a, b) => b.r - a.r).forEach(p => { if (p.num) return; let n = (NUMP[p.pos] || []).find(x => !used.has(x)); if (!n) { n = 30; while (used.has(n)) n++; } p.num = n; used.add(n); });
  }
  const fit = (p, slotPos) => p.pos === slotPos ? 0 : ZONE[p.pos] === ZONE[slotPos] ? -3 : (NEAR[slotPos] || []).includes(p.pos) ? -7 : -14;
  const avail = p => !p.inj && !p.sus;

  /* ---------------- isim üretici (scout / altyapı) ---------------- */
  const REG = () => ({
    tr: { n: T('Türkiye', 'Turkey'), cost: 1, f: ['Emir', 'Kerem', 'Yusuf', 'Arda', 'Efe', 'Mert', 'Kaan', 'Burak', 'Eren', 'Doruk', 'Çınar', 'Ege', 'Alp', 'Batu', 'Onur'], l: ['Yıldız', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Arslan', 'Koç', 'Kurt', 'Öztürk', 'Erdem', 'Aksoy', 'Polat', 'Karadeniz', 'Uzun'] },
    br: { n: T('Brezilya', 'Brazil'), cost: 2.5, f: ['Gabriel', 'Lucas', 'Matheus', 'Vinícius', 'Rafael', 'Thiago', 'Bruno', 'Caio', 'Endrick', 'Wesley', 'Igor', 'Davi'], l: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira', 'Rocha', 'Almeida', 'Barbosa', 'Moura'] },
    nl: { n: T('Hollanda', 'Netherlands'), cost: 2, f: ['Daan', 'Sem', 'Milan', 'Jesse', 'Luuk', 'Thijs', 'Bram', 'Jens', 'Noah', 'Ruben', 'Stijn', 'Xavi'], l: ['de Vries', 'Jansen', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks'] },
    af: { n: T('Batı Afrika', 'West Africa'), cost: 1.5, f: ['Moussa', 'Ibrahim', 'Kwame', 'Sadio', 'Yaw', 'Amadou', 'Kofi', 'Bakary', 'Samuel', 'Issa', 'Ismaila'], l: ['Diallo', 'Traoré', 'Mensah', 'Koné', 'Owusu', 'Camara', 'Sarr', 'Asante', 'Touré', 'Ndiaye', 'Boateng'] }
  });
  const NATOF = { tr: 'TR', br: 'BR', nl: 'NL', af: 'SN' };
  function regen(region, opts) {
    const R = REG()[region] || REG().tr, pos = (opts && opts.pos) || wpick(POS, p => ({ KL: .7, ST: 1.4, BK: 1.3, OS: 1.8, KN: 1.4, FV: 1.2 })[p]);
    const lvl = (S && S.fac && S.fac.scout) || 0; // üst seviye yetenek nadirdir; scout ağı geliştikçe ihtimal artar
    const age = (opts && opts.age) || 16 + rnd(4), r = (opts && opts.r) || 58 + rnd(11), pot = (opts && opts.pot) || clamp(r + 8 + rnd(12) + (chance(.1 + lvl * .03) ? 3 + rnd(8) : 0), r + 6, 91);
    return mkPlayer(pick(R.f) + ' ' + pick(R.l), pos, r, { age, pot, nat: NATOF[region] || 'TR', youth: true });
  }

  /* ---------------- durum ---------------- */
  let S = null, host = null, tab = 'center', fxWeek = null, selSlot = null, mFilter = { pos: '', max: 0, q: '' };
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.v === VER ? s : null; } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  function syncSavedAges() {
    if (!S) return;
    let changed = false;
    (S.squad || []).forEach(p => { if (syncAge(p)) changed = true; });
    (S.scouted || []).forEach(p => { if (syncAge(p)) changed = true; });
    for (const players of Object.values(S.added || {})) {
      if (Array.isArray(players)) players.forEach(p => { if (syncAge(p)) changed = true; });
    }
    if (changed) save();
  }
  const me = () => S.teams.find(t => t.me);
  const BENCH = 9;
  const TRAIN = () => ({
    hucum: [T('Hücum Organizasyonu', 'Attacking Play'), 'target', T('Bu haftaki maçta hücum +1,2 · taktik uyumu +4', 'Attack +1.2 this week · familiarity +4')],
    savunma: [T('Savunma Yerleşimi', 'Defensive Shape'), 'shield', T('Bu haftaki maçta savunma +1,2 · taktik uyumu +4', 'Defence +1.2 this week · familiarity +4')],
    top: [T('Topa Sahip Olma', 'Possession'), 'ball', T('Pas isabeti artar · hücum/savunma +0,4 · taktik uyumu +6', 'Better passing · attack/defence +0.4 · familiarity +6')],
    fizik: [T('Fizik / Kondisyon', 'Fitness'), 'train', T('Maçta %15 daha az yorulma, sakatlık riski düşer · hafta içi toparlanma −6', '15% less match fatigue, lower injury risk · recovery −6')],
    dinlen: [T('Dinlenme', 'Rest'), 'calm', T('Kondisyon +10 · moral +2 · taktik uyumu −2', 'Fitness +10 · morale +2 · familiarity −2')]
  });
  const famKey = () => S.formation + '|' + (S.style || 'dengeli');
  const famNow = () => clamp(S.famKey && S.famKey !== famKey() ? S.fam - 18 : S.fam, 15, 100); // diziliş / plan değişince uyum düşer
  const scoutSlots = () => Math.min(4, 1 + ((S.fac && S.fac.scout) || 0));
  function lgAdd(name, club, g, a) { if (!name || !S.lg) return; const r = S.lg[name] || (S.lg[name] = { g: 0, a: 0, c: club }); r.g += g; r.a += a; r.c = club; }
  // maç günü kadrosu: ilk 11 + en çok 9 yedek
  function autoBench() {
    const xi = new Set(S.xi), pool = S.squad.filter(p => avail(p) && !xi.has(p.id)).sort((a, b) => b.r - a.r), out = [];
    const gk = pool.find(p => p.pos === 'KL'); if (gk) out.push(gk);
    ['ST', 'BK', 'OS', 'KN', 'FV'].forEach(pos => { const p = pool.find(x => x.pos === pos && !out.includes(x)); if (p) out.push(p); });
    pool.forEach(p => { if (out.length < BENCH && !out.includes(p)) out.push(p); });
    S.bench = out.slice(0, BENCH).map(p => p.id);
  }
  function cleanBench() {
    const xi = new Set(S.xi); S.bench = (S.bench || []).filter((id, i, a) => P(id) && !xi.has(id) && a.indexOf(id) === i).slice(0, BENCH);
    if (!S.benchManual && S.bench.filter(id => avail(P(id))).length < Math.min(BENCH, S.squad.filter(p => avail(p) && !xi.has(p.id)).length)) autoBench();
  }
  // eski kayıtları yeni alanlarla tamamla (kayıt sürümü değişmez, hiçbir veri silinmez)
  function migrate() {
    if (!S) return;
    S.bench = S.bench || []; S.training = TRAIN()[S.training] ? S.training : 'top'; S.focus = (S.focus || []).filter(id => P(id)); if (S.fam == null) S.fam = 55;
    S.fac = Object.assign({ train: 0, med: 0, stadium: 0, scout: 0 }, S.fac || {});
    if (!S.scouts) S.scouts = S.scout ? [S.scout] : []; S.scout = null; S.scouted = S.scouted || []; S.cold = S.cold || {};
    if (!S.lg) { S.lg = {}; S.squad.forEach(p => { if (p.sg || p.sa) S.lg[p.name] = { g: p.sg || 0, a: p.sa || 0, c: me().id }; }); }
    assignNums(); cleanBench();
  }
  const P = id => S.squad.find(p => p.id === id);
  const news = (txt, kind) => { S.news.unshift({ t: txt, k: kind || '', w: S.week, s: S.season }); S.news = S.news.slice(0, 40); };

  function clubXI(c) {
    const taken = new Set(S ? S.removed : []);
    const pool = c.players.filter(p => p[3] === 'FC27' && !taken.has(p[0])).map(p => ({ name: p[0], pos: p[1], r: p[2] }))
      .concat((S && S.added[c.id]) || []).sort((a, b) => b.r - a.r);
    const need = { KL: 1, ST: 2, BK: 2, OS: 3, KN: 2, FV: 1 }, xi = [];
    for (const [pos, n] of Object.entries(need)) pool.filter(p => p.pos === pos && !xi.includes(p)).slice(0, n).forEach(p => xi.push(p));
    for (const [pos, n] of Object.entries(need)) { let have = xi.filter(p => p.pos === pos).length; while (have < n) { const f = pool.find(p => !xi.includes(p)); if (!f) break; xi.push(Object.assign({}, f, { pos, r: f.r - 4 })); have++; } }
    return xi;
  }
  function adFrom(list) { // list: [{slot, r}]
    const by = k => list.filter(x => x.slot === k).map(x => x.r);
    let att = .45 * avg([...by('FV'), ...by('KN')]) + .35 * avg(by('OS')) + .2 * avg(by('BK'));
    let def = .35 * avg(by('KL')) + .45 * avg([...by('ST'), ...by('BK')]) + .2 * avg(by('OS'));
    const top3 = a => a.sort((x, y) => y - x).slice(0, 3), sa = top3([...by('FV'), ...by('KN'), ...by('OS')]), sd = top3([...by('KL'), ...by('ST'), ...by('BK'), ...by('OS')]);
    return { att: att + Math.max(0, avg(sa) - att) * .35, def: def + Math.max(0, avg(sd) - def) * .25 };
  }
  const oppAD = t => { const c = CLUB(t.id); return c ? adFrom(clubXI(c).map(p => ({ slot: p.pos, r: p.r }))) : { att: 70, def: 70 }; };
  const eff = (p, slotPos) => (p.r + fit(p, slotPos)) * (.91 + .09 * p.cond / 100) + clamp((p.morale - 65) / 15, -2, 2) + 1.5; // +1.5: rakiplerle aynı tam kondisyon tabanı
  function myAD(xiIds, ment, extra) {
    const F = FORMATIONS[S.formation], R = ROLES();
    const list = F.map(([pos], i) => { const p = P(xiIds[i]); return p ? { slot: pos, r: eff(p, pos), p } : { slot: pos, r: 45 }; });
    const ad = adFrom(list); let ra = 0, rd = 0;
    F.forEach(([pos], i) => { const role = (R[pos] || []).find(x => x[0] === (S.roles[i] || (R[pos][0] || [])[0])) || R[pos][0]; if (role) { ra += role[2] - .5; rd += role[3] - .5; } });
    const m = MENT()[ment || S.ment] || MENT().dengeli;
    const fam = (famNow() - 50) / 50 * 1.2, tr = S.training; // taktik uyumu ve haftalık antrenman
    return { att: ad.att + clamp(ra, -3, 3) * .6 + m[1] - (extra || 0) + fam + (tr === 'hucum' ? 1.2 : tr === 'top' ? .4 : 0), def: ad.def + clamp(rd, -3, 3) * .6 + m[2] - (extra || 0) + fam + (tr === 'savunma' ? 1.2 : tr === 'top' ? .4 : 0) };
  }
  const rating = () => { const ad = myAD(S.xi, 'dengeli'); return Math.round((ad.att + ad.def) / 2); };
  const capFor = d => d > 10 ? .85 : d > 6 ? 1.15 : d > 3 ? 1.6 : 3.6;
  function lambdas(hAD, aAD) {
    let lh = 1.25 * Math.exp((hAD.att - aAD.def) / 12.5) * 1.1, la = 1.25 * Math.exp((aAD.att - hAD.def) / 12.5) * .92;
    return [Math.max(.12, Math.min(lh, capFor(aAD.def - hAD.att))), Math.max(.12, Math.min(la, capFor(hAD.def - aAD.att)))];
  }

  /* ---------------- kariyer kurulumu ---------------- */
  function fixtures(ids) {
    const n = ids.length, arr = ids.slice(), rounds = [];
    for (let r = 0; r < n - 1; r++) { const w = []; for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; w.push(r % 2 ? [b, a] : [a, b]); } rounds.push(w); arr.splice(1, 0, arr.pop()); }
    return rounds.concat(rounds.map(w => w.map(([a, b]) => [b, a])));
  }
  function freshTable() { const t = {}; S.teams.forEach(x => t[x.id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }); return t; }
  function autoXI() {
    const F = FORMATIONS[S.formation], used = new Set(), xi = [];
    // önce kaleci ve doğal mevkiler, sonra boşlar
    F.forEach(([pos], i) => { const best = S.squad.filter(p => avail(p) && !used.has(p.id) && p.pos === pos).sort((a, b) => eff(b, pos) - eff(a, pos))[0]; if (best) { xi[i] = best.id; used.add(best.id); } });
    F.forEach(([pos], i) => { if (xi[i]) return; const best = S.squad.filter(p => avail(p) && !used.has(p.id) && (pos !== 'KL' ? p.pos !== 'KL' : true)).sort((a, b) => eff(b, pos) - eff(a, pos))[0]; if (best) { xi[i] = best.id; used.add(best.id); } });
    S.xi = F.map((_, i) => xi[i] || null);
  }
  function starterSquad() {
    const want = { KL: 2, ST: 4, BK: 4, OS: 6, KN: 4, FV: 3 }, pool = clubs().flatMap(c => c.players.filter(p => p[3] === 'FC27' && p[2] >= 66 && p[2] <= 75).map(p => ({ c: c.id, name: p[0], pos: p[1], r: p[2] }))), out = [];
    for (const [pos, n] of Object.entries(want)) pool.filter(p => p.pos === pos).sort(() => Math.random() - .5).slice(0, n).forEach(p => out.push(p));
    return out;
  }
  function create(kind, clubId) {
    const cid = (typeof ClubID !== 'undefined' && ClubID.get()) || null;
    S = { v: VER, created: Date.now(), kind, season: 1, year: 2026, week: 0, budget: 20, formation: '4-3-3', roles: {}, ment: 'dengeli', squad: [], xi: [], removed: [], added: {}, results: [], news: [], pending: null,
      sponsor: null, offers: null, fac: { train: 0, med: 0, stadium: 0, scout: 0 }, pop: 40, scout: null, scouts: [], scouted: [], history: [], fin: null, ticketDisc: 0, matchLog: null, bench: [], training: 'top', focus: [], fam: 55, lg: {}, cold: {} };
    let mine;
    if (kind === 'club') {
      const c = CLUB(clubId); mine = { id: c.id, name: c.name, short: c.short, c1: c.c1, c2: c.c2, kit: 'duz', me: true };
      S.squad = c.players.filter(p => p[3] === 'FC27').map(p => mkPlayer(p[0], p[1], p[2]));
      const st = avg(S.squad.map(p => p.r)); S.budget = Math.round(clamp((st - 68) * 3.2, 8, 45)); S.pop = clamp(Math.round((st - 62) * 3.2), 25, 85);
      S.replaced = null;
    } else {
      mine = { id: 'me', name: (cid && cid.name) || T('Kariyer FK', 'Career FC'), short: cid ? (cid.short || ClubID.autoShort(cid.name)) : 'KFK', c1: cid ? cid.c1 : '#ff4d00', c2: cid ? cid.c2 : '#111111', kit: cid ? cid.kit : 'duz', me: true, identity: true };
      if (kind === 'draft') {
        let ds = null; try { ds = JSON.parse(localStorage.getItem('draft_state')); } catch (e) {}
        const src = ds ? Object.values(ds.picks || {}).concat(ds.bench || [], ds.reserves || []).filter(Boolean) : [];
        const seen = new Set(); src.forEach(p => { if (!seen.has(p.name)) { seen.add(p.name); S.squad.push(mkPlayer(p.name, p.pos, p.r)); } });
        S.removed = [...seen]; S.budget = 12;
        const need = { KL: 2, ST: 4, BK: 4, OS: 5, KN: 3, FV: 2 };
        for (const [pos, n] of Object.entries(need)) { let have = S.squad.filter(p => p.pos === pos).length; while (have++ < n) S.squad.push(regen('tr', { pos, r: 60 + rnd(7), age: 18 + rnd(3) })); }
      } else {
        starterSquad().forEach(p => { S.squad.push(mkPlayer(p.name, p.pos, p.r)); S.removed.push(p.name); });
        S.budget = 25;
      }
      // en zayıf kulübün yerini al
      const weakest = clubs().map(c => ({ c, s: avg(clubXI(c).map(p => p.r)) })).sort((a, b) => a.s - b.s)[0];
      S.replaced = weakest ? weakest.c.id : null;
    }
    S.teams = clubs().filter(c => c.id !== (kind === 'club' ? clubId : S.replaced)).map(c => ({ id: c.id, name: c.name, short: c.short, c1: c.c1, c2: c.c2 })).concat([mine]);
    while (S.teams.length > 18) S.teams.splice(S.teams.findIndex(t => !t.me), 1);
    S.fix = fixtures(S.teams.map(t => t.id).sort(() => Math.random() - .5)); S.table = freshTable();
    S.rev = kind === 'club' ? clamp(S.squad.reduce((a, p) => a + wage(p), 0) * WEEKS * 1.02 / estIncome(), 1, 5) : 1;
    autoXI(); assignNums(); autoBench(); S.famKey = famKey(); S.offers = sponsorOffers();
    news(kind === 'club' ? T(`${mine.name} yönetimi seni teknik direktör olarak açıkladı. Hedef: üst sıralar!`, `${mine.name} have appointed you as manager. The target: the top of the table!`)
      : T(`${mine.name} kuruldu ve ${S.replaced ? CLUB(S.replaced).name + ' yerine ' : ''}Süper Lig'e katıldı.`, `${mine.name} has been founded and joins the Süper Lig${S.replaced ? ' in place of ' + CLUB(S.replaced).name : ''}.`), 'big');
    save();
  }

  /* ---------------- ekonomi: sponsor, tesis, gelir-gider ---------------- */
  function sponsorOffers() {
    const k = (.5 + S.pop / 100) * (S.rev || 1), nm = ['Liman Lojistik', 'Karadeniz Enerji', 'Mavi Bank', 'Atlas Sigorta', 'Zirve Telekom', 'Nova Gıda', 'Pera Otomotiv', 'Kuzey Yapı'].sort(() => Math.random() - .5);
    return [
      { id: 'sabit', name: nm[0], up: Math.round(9 * k * 10) / 10, win: 0, title: 0, desc: T('Garanti nakit, prim yok', 'Guaranteed cash, no bonuses') },
      { id: 'prim', name: nm[1], up: Math.round(3 * k * 10) / 10, win: Math.round(.42 * k * 100) / 100, title: Math.round(10 * k), desc: T('Düşük ön ödeme, galibiyet ve şampiyonluk primi yüksek', 'Low upfront, big win and title bonuses') },
      { id: 'denge', name: nm[2], up: Math.round(6 * k * 10) / 10, win: Math.round(.2 * k * 100) / 100, title: Math.round(4 * k), desc: T('Dengeli teklif', 'Balanced deal') }
    ];
  }
  const FAC = () => ({ train: [T('Antrenman sahası', 'Training ground'), 'train', T('Genç oyuncular daha hızlı gelişir', 'Young players develop faster'), 4], med: [T('Tıp merkezi', 'Medical centre'), 'med', T('Sakatlıklar kısalır, kondisyon hızlı dolar', 'Shorter injuries, faster recovery'), 3], stadium: [T('Stadyum kapasitesi', 'Stadium capacity'), 'stadium', T('+7.000 koltuk, daha fazla bilet geliri', '+7,000 seats, more ticket income'), 6], scout: [T('Scout ağı', 'Scouting network'), 'scope', T('Her seviye aynı anda +1 bölgeye gözlemci (en çok 4) ve daha iyi raporlar', 'Each level: +1 simultaneous scouting region (max 4) and better reports'), 3] });
  const facCost = k => FAC()[k][3] * (S.fac[k] + 1);
  const capacity = () => Math.round(8000 + S.pop * 250 + S.fac.stadium * 7000);
  // kulüp büyüklüğü: büyük kulüplerin gelirleri maaş yüküyle orantılıdır
  const estIncome = () => capacity() * Math.min(1, .45 + S.pop / 140) * 15 / 1e6 * 17 + S.pop * .0018 * WEEKS + 8 * (.5 + S.pop / 100) + 4;

  /* ---------------- maç motoru ---------------- */
  const SCW = { FV: 3, KN: 2.2, OS: 1.3, ST: .35, BK: .45, KL: 0 }, ASW = { FV: 1.6, KN: 3.4, OS: 3, ST: .35, BK: 1.6, KL: .05 };
  function quickMatch(hId, aId) {
    const hAD = hId === me().id ? myAD(S.xi) : oppAD(S.teams.find(t => t.id === hId)), aAD = aId === me().id ? myAD(S.xi) : oppAD(S.teams.find(t => t.id === aId));
    const [lh, la] = lambdas(hAD, aAD); let gh = poisson(lh), ga = poisson(la);
    while (Math.abs(gh - ga) > 4 && chance(.65)) { if (gh > ga) gh--; else ga--; }
    // lig geneli gol ve asist krallığı için diğer maçların golcüleri de kaydedilir
    [[hId, gh], [aId, ga]].forEach(([id, n]) => { const c = CLUB(id); if (!c || !n || id === me().id) return; const xi = clubXI(c), out = xi.filter(x => x.pos !== 'KL'); if (!out.length) return;
      for (let i = 0; i < n; i++) { const s = wpick(out, x => (SCW[x.pos] || .2) * Math.pow(1.06, x.r - 70)); lgAdd(s.name, id, 1, 0); if (chance(.75)) { const a = wpick(xi.filter(x => x !== s), x => ASW[x.pos] || .2); if (a) lgAdd(a.name, id, 0, 1); } } });
    return { h: hId, a: aId, gh, ga, lh, la };
  }
  function record(r) {
    const H = S.table[r.h], A = S.table[r.a];
    H.p++; A.p++; H.gf += r.gh; H.ga += r.ga; A.gf += r.ga; A.ga += r.gh;
    if (r.gh > r.ga) { H.w++; A.l++; H.pts += 3; H.form.push('G'); A.form.push('M'); } else if (r.gh < r.ga) { A.w++; H.l++; A.pts += 3; A.form.push('G'); H.form.push('M'); } else { H.d++; A.d++; H.pts++; A.pts++; H.form.push('B'); A.form.push('B'); }
    H.form = H.form.slice(-5); A.form = A.form.slice(-5);
  }
  const sorted = () => S.teams.slice().sort((a, b) => { const x = S.table[a.id], y = S.table[b.id]; return y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf; });
  const myFixture = w => { const f = (S.fix[w] || []).find(([h, a]) => h === me().id || a === me().id); return f ? { h: f[0], a: f[1], home: f[0] === me().id, opp: S.teams.find(t => t.id === (f[0] === me().id ? f[1] : f[0])) } : null; };

  // Canlı maç: dakika dakika metin simülasyonu, durdur / taktik / oyuncu değişikliği
  function liveMatch(onEnd, quick) {
    const fx = myFixture(S.week); if (!fx) return;
    const F = FORMATIONS[S.formation];
    const st = { min: 0, gm: 0, go: 0, dGm: 0, dGo: 0, ment: S.ment, style: S.style || 'dengeli', reds: [], xi: S.xi.slice(), played: new Set(S.xi.filter(Boolean)), subs: 0, red: 0, oppRed: 0, ev: [], lines: [], paused: false, speed: 1, done: false, cards: {}, injured: [], ga: {},
      boosts: [], shoutAt: -99, shoutN: 0, pressUntil: -1, ht: false, htOpen: false, htDone: false, talk: null, inMin: {}, outMin: {}, opCards: {}, opReds: {},
      stats: { me: { shots: 0, on: 0, xg: 0, corners: 0, fouls: 0, pass: 0, passOk: 0, poss: 0, off: 0 }, op: { shots: 0, on: 0, xg: 0, corners: 0, fouls: 0, pass: 0, passOk: 0, poss: 0, off: 0 } } };
    S.xi.forEach(id => { if (id) st.inMin[id] = 0; });
    if (!S.bench || !S.bench.length) autoBench();
    const benchNow = () => (S.bench || []).map(id => P(id)).filter(p => p && avail(p) && !st.xi.includes(p.id) && !st.played.has(p.id));
    const homeT = fx.home ? me() : fx.opp, awayT = fx.home ? fx.opp : me();
    // skor her yerde "Ev – Deplasman" sırasıyla yazılır
    const scoreTxt = (gm, go) => `${homeT.name} ${fx.home ? gm : go}–${fx.home ? go : gm} ${awayT.name}`;
    const wk = hash('wx' + S.season + '-' + S.week), night = wk % 2 === 0, rainy = wk % 5 === 0;
    const opp = fx.opp, oAD = oppAD(opp), oXI = clubXI(CLUB(opp.id) || { players: [] });
    // Big home fixtures trigger crowd flares and supporters' chants.
    const tableOrder = sorted(), myRank = tableOrder.findIndex(t => t.id === me().id) + 1,
      opRank = tableOrder.findIndex(t => t.id === opp.id) + 1;
    const BIG = ['gs', 'fb', 'bjk', 'ts'], ids = [me().id, opp.id];
    const isDerby = ids.every(i => BIG.includes(i)) || (ids.includes('ts') && (ids.includes('riz') || ids.includes('sam')));
    const topClash = myRank > 0 && opRank > 0 && myRank <= 6 && opRank <= 6 && S.week > 3;
    const importantHome = isDerby || topClash;
    let m2 = null;
    const meH = fx.home ? 'h' : 'a', opH = fx.home ? 'a' : 'h';
    const tv = c => { if (m2 && !quick) m2.push(c); };
    const meName = me().name, line = (txt, cls) => { st.lines.unshift({ m: st.min, txt, cls }); if (!quick) { if (cls === 'goal' || cls === 'conc' || cls === 'red') renderLive(); else drawLines(); } };
    const lams = () => { const mAD = myAD(st.xi, st.ment, st.red * 3.5), o = { att: oAD.att - st.oppRed * 3.5, def: oAD.def - st.oppRed * 3.5 }; const [lh, la] = fx.home ? lambdas(mAD, o) : lambdas(o, mAD); const pm = planMod(st.style, st.xi, (oAD.att + oAD.def) > (mAD.att + mAD.def) + 2); const r = fx.home ? { me: lh * pm.me, op: la * pm.op } : { me: la * pm.me, op: lh * pm.op }; /* fark 4'ü geçince öndeki takım tempoyu düşürür */ if (st.gm - st.go >= 4) r.me *= .4; if (st.go - st.gm >= 4) r.op *= .4; st.boosts.forEach(b => { if (st.min <= b.until) { r.me *= b.me; r.op *= b.op; } }); /* devre arası konuşması ve kenar komutları */ return r; };
    // gol şekli: plana ve golcünün mevkisine uygun (stoper ara pasla değil kafayla / kornerden atar)
    const POSHOW = { ST: ['corner', 'cross', 'rebound'], BK: ['corner', 'cross', 'rebound', 'cutback'], OS: ['long', 'through', 'rebound', 'cutback', 'target', 'fk', 'pen', 'corner'], KN: ['cutin', 'through', 'cutback', 'cross', 'long', 'pen', 'rebound'], FV: ['through', 'cross', 'cutback', 'pen', 'rebound', 'corner', 'target', 'long'] };
    const howFor = (p, styleKey) => { const w = GW[styleKey] || GW.dengeli, ok = (POSHOW[p.pos] || Object.keys(w)).filter(k => k !== 'fk' || traitsOf(p).includes('FREEKICK_MASTER') || p.pos === 'OS'); return wpick(ok, k => (w[k] || .3) * (k === 'cross' && traitsOf(p).includes('AERIAL_THREAT') ? 2 : 1) * (k === 'cutin' && traitsOf(p).includes('FINESSE_SHOT') ? 2.5 : 1)); };
    const scorerMe = () => { const ps = st.xi.map((id, i) => ({ p: P(id), pos: F[i][0] })).filter(x => x.p); const s = wpick(ps.filter(x => x.pos !== 'KL'), x => (SCW[x.pos] || .2) * Math.pow(1.06, x.p.r - 70) * (traitsOf(x.p).includes('AERIAL_THREAT') && (st.style === 'kanat' || st.style === 'uzun') ? 1.4 : 1)); const as = chance(.78) ? wpick(ps.filter(x => x !== s), x => (ASW[x.pos] || .2) * Math.pow(1.04, x.p.r - 70)) : null; return [s, as]; };
    const scorerOp = () => { const s = wpick(oXI.filter(x => x.pos !== 'KL'), x => (SCW[x.pos] || .2) * Math.pow(1.06, x.r - 70)); const as = chance(.75) ? wpick(oXI.filter(x => x !== s), x => ASW[x.pos] || .2) : null; return [s, as]; };
    const HOW = () => [T('ceza sahası dışından müthiş bir şutla', 'with a stunning strike from outside the box'), T('sağ kanattan gelen ortada kafayla', 'with a header from a right-wing cross'), T('kaleciyle karşı karşıya kalıp soğukkanlı bir vuruşla', 'one-on-one with the keeper, coolly'), T('kısa korner organizasyonunda', 'from a short corner routine'), T('penaltıdan', 'from the penalty spot'), T('kafa vuruşunda dönen topu tamamlayarak', 'by tucking in the rebound'), T('serbest vuruştan', 'from a free kick')];
    let ov = null;
    const minuteTick = () => {
      if (st.done) return;
      st.min++;
      const L = lams(), m = st.min;
      // maç istatistikleri: topla oynama, pas, şut, xG, korner, faul
      const SM = st.stats.me, SO = st.stats.op, dirShout = st.boosts.some(b => b.k === 'dikine' && m <= b.until);
      const shareP = clamp(L.me / (L.me + L.op) * .5 + .25 + (st.style === 'kisa' ? .06 : st.style === 'kontra' || st.style === 'uzun' ? -.06 : 0), .2, .8);
      if (Math.random() < shareP) SM.poss++; else SO.poss++;
      [[SM, L.me, shareP, st.style, true], [SO, L.op, 1 - shareP, 'dengeli', false]].forEach(([s, lam, sh, sty, mine]) => {
        const n = Math.round(sh * (sty === 'kisa' ? 12 : sty === 'uzun' ? 7 : 9) + Math.random() * 2);
        const acc = clamp(.78 + (mine ? (S.training === 'top' ? .04 : 0) + (famNow() - 50) / 800 - (dirShout ? .03 : 0) : 0) + (sty === 'kisa' ? .05 : sty === 'uzun' ? -.07 : sty === 'kontra' ? -.03 : 0), .55, .93);
        s.pass += n; for (let i = 0; i < n; i++) if (Math.random() < acc) s.passOk++;
        if (Math.random() < (3 + lam * 4.2) / 90) { s.shots++; s.xg += clamp(lam / (4 + lam * 4.5) * (.5 + Math.random() * .8), .02, .4); if (Math.random() < .28) s.on++; }
        if (Math.random() < (2.4 + lam * 1.8) / 90) s.corners++;
        if (Math.random() < .135) s.fouls++;
      });
      if (m2 && !quick) { m2.setPress(meH, st.ment === 'hucum' || st.ment === 'tumhucum' || st.pressUntil >= m); if (m % 3 === 0) m2.setCond(meH, Object.fromEntries(st.xi.map(id => P(id)).filter(Boolean).map(p => [p.name, p.cond]))); }
      // goller
      if (Math.random() < L.me / 90) { st.gm++; let [s, a] = scorerMe(); const how = howFor(s.p, st.style); if (how === 'pen' || how === 'fk') a = null;
        s.p.g++; s.p.sg++; if (a) { a.p.a++; a.p.sa++; } st.ev.push({ t: 'me', sc: s.p.name, as: a && a.p.name, min: m, how, style: st.style });
        lgAdd(s.p.name, me().id, 1, 0); if (a) lgAdd(a.p.name, me().id, 0, 1); SM.shots++; SM.on++; SM.xg += how === 'pen' ? .76 : .22 + Math.random() * .3; if (how === 'corner') SM.corners++;
        const fouler = pick(oXI).name, gm = st.gm, go = st.go;
        let shownClip = null;
        const show = () => {
          const actualHow = (shownClip && shownClip.actualHow) || how;
          if (actualHow === 'pen') line(`🟨 ${m}' ${T(`Penaltı! ${s.p.name} ceza sahasında düşürüldü, ${fouler} sarı kart gördü.`, `Penalty! ${s.p.name} is brought down in the box; ${fouler} is booked.`)}`);
          if (actualHow === 'fk') line(`${m}' ${T('Faul sonrası serbest vuruş kullanılıyor.', 'A free kick follows the foul.')}`);
          st.dGm++; line(`⚽ ${m}' ${T('GOL!', 'GOAL!')} ${s.p.name} ${GOALS()[actualHow]}${a ? ' — ' + T('asist', 'assist') + ': ' + a.p.name : ''}. ${scoreTxt(gm, go)}`, 'goal');
        };
        if (m2 && !quick) { shownClip = { side: meH, min: m, sc: s.p.name, as: a && a.p.name, out: 'goal', how, style: st.style, onShow: show }; tv(shownClip); } else show(); }
      if (Math.random() < L.op / 90) { st.go++; let [s, a] = scorerOp(); const how = howFor(s, 'dengeli'); if (how === 'pen' || how === 'fk') a = null; st.ev.push({ t: 'op', sc: s.name, as: a && a.name, min: m, how });
        lgAdd(s.name, opp.id, 1, 0); if (a) lgAdd(a.name, opp.id, 0, 1); SO.shots++; SO.on++; SO.xg += how === 'pen' ? .76 : .22 + Math.random() * .3; if (how === 'corner') SO.corners++;
        const gm = st.gm, go = st.go;
        let shownClip = null;
        const show = () => {
          const actualHow = (shownClip && shownClip.actualHow) || how;
          if (actualHow === 'pen') line(`${m}' ${T(`${opp.name} lehine penaltı!`, `Penalty to ${opp.name}!`)}`);
          else if (actualHow === 'fk') line(`${m}' ${T(`${opp.name} lehine serbest vuruş.`, `Free kick to ${opp.name}.`)}`);
          st.dGo++; line(`⚽ ${m}' ${opp.name}: ${s.name} ${GOALS()[actualHow]}. ${scoreTxt(gm, go)}`, 'conc');
        };
        if (m2 && !quick) { shownClip = { side: opH, min: m, sc: s.name, as: a && a.name, out: 'goal', how, onShow: show }; tv(shownClip); } else show(); }
      // büyük fırsatlar: metinde ne yazıyorsa 2D sahada o oynanır (kurtarış / aut / direk / blok / ofsayt)
      if (Math.random() < .035) {
        const mine = Math.random() < L.me / (L.me + L.op), nm = mine ? scorerMe()[0].p.name : scorerOp()[0].name, out = pick(['save', 'save', 'miss', 'miss', 'post', 'block', 'offside']), S2 = mine ? SM : SO;
        if (out === 'offside') S2.off++; else { S2.shots++; S2.xg += .08 + Math.random() * .2; if (out === 'save') S2.on++; }
        const txt = { save: T(`${nm}'nin şutunu kaleci son anda çeldi!`, `Great save to deny ${nm}!`), miss: T(`${nm} vurdu, top az farkla auta çıktı.`, `${nm} shoots — just wide.`), post: T(`${nm} vurdu, top direkten döndü!`, `${nm} hits the post!`), block: T(`${nm}'nin şutunda savunma araya girdi.`, `${nm}'s shot is blocked.`), offside: T(`${nm} ofsayta takıldı.`, `${nm} is caught offside.`) }[out];
        let clip = null;
        const show = () => { const real = (clip && clip.actualOut) || out; if (real !== out && out === 'offside') { S2.off--; S2.shots++; S2.xg += .06; } line(`${m}' ${real === out ? txt : T(`${nm}'nin şutunda savunma araya girdi.`, `${nm}'s shot is blocked.`)}`, 'ch'); }; // sahada ne oynandıysa o yazılır
        if (m2 && !quick) tv(clip = { side: mine ? meH : opH, min: m, sc: nm, out, onShow: show }); else show();
      }
      // kartlar
      if (Math.random() < .011) { const cand = st.xi.map((id, i) => ({ p: P(id), pos: F[i][0] })).filter(x => x.p && x.pos !== 'KL'); const x = wpick(cand, c => ({ ST: 2, BK: 1.6, OS: 1.6, KN: .8, FV: .7 })[c.pos] || 1); if (x) { const n = (st.cards[x.p.id] || 0) + 1; st.cards[x.p.id] = n; if (n >= 2) { const show = () => line(`🟥 ${m}' ${x.p.name} ${T('ikinci sarıdan kırmızı kart gördü! 10 kişi kaldık.', 'is sent off for a second yellow! Down to ten.')}`, 'red'); st.reds.push({ t: 'me', name: x.p.name, min: m, red: true, dogso: false }); if (m2 && !quick) tv({ kind: 'red', side: opH, min: m, fouler: x.p.name, dogso: false, out: pick(['save', 'miss', 'block']), onShow: show }); else show(); sendOff(x.p); } else { x.p.yc++; SM.fouls++; if (m2 && !quick) m2.card(meH, x.p.name, 'Y'); line(`🟨 ${m}' ${x.p.name} ${T('sarı kart gördü.', 'is booked.')}`); } } }
      if (Math.random() < .0009) { const cand = st.xi.map(id => P(id)).filter(p => p && p.pos !== 'KL'); const p = pick(cand); if (p) { const show = () => line(`🟥 ${m}' ${p.name} ${T('son adam olarak rakibi düşürdü — direkt kırmızı kart!', 'brings down the last man — straight red!')}`, 'red'); st.reds.push({ t: 'me', name: p.name, min: m, red: true, dogso: true }); if (m2 && !quick) tv({ kind: 'red', side: opH, min: m, fouler: p.name, dogso: true, out: pick(['save', 'miss', 'block']), onShow: show }); else show(); p.sus = 2; sendOff(p); } }
      if (Math.random() < .011) { const yp = pick(oXI.filter(x => x.pos !== 'KL' && !st.opReds[x.name])); if (yp) { st.opCards[yp.name] = (st.opCards[yp.name] || 0) + 1; SO.fouls++; if (m2 && !quick) m2.card(opH, yp.name, 'Y'); line(`🟨 ${m}' ${opp.name}: ${yp.name} ${T('sarı kart gördü.', 'is booked.')}`); } }
      if (Math.random() < .0008 && !st.oppRed) { st.oppRed = 1; const rp = pick(oXI.filter(x => x.pos !== 'KL' && x.pos !== 'FV')); st.opReds[rp.name] = 1; st.reds.push({ t: 'op', name: rp.name, min: m, red: true, dogso: true }); const show = () => line(`🟥 ${m}' ${rp.name} ${T(`kırmızı kart gördü, ${opp.name} 10 kişi kaldı!`, `is sent off — ${opp.name} are down to ten!`)}`, 'red'); if (m2 && !quick) tv({ kind: 'red', side: meH, min: m, fouler: rp.name, dogso: true, out: pick(['save', 'miss', 'block']), onShow: show }); else show(); }
      // kondisyon ve sakatlık
      st.xi.forEach(id => { const p = P(id); if (!p) return; p.cond = clamp(p.cond - (.22 + (p.age > 30 ? .05 : 0) + (st.ment === 'tumhucum' || st.ment === 'hucum' ? .03 : 0) + (st.pressUntil >= m ? .07 : 0)) * (S.training === 'fizik' ? .85 : 1), 0, 100);
        const risk = .00012 * (p.cond < 55 ? 3.2 : p.cond < 70 ? 1.8 : 1) * (1 - S.fac.med * .08) * (S.training === 'fizik' ? .8 : 1);
        if (Math.random() < risk) { p.inj = Math.max(1, Math.round((1 + rnd(5)) * (1 - S.fac.med * .12))); st.injured.push(p.id); line(`🚑 ${m}' ${p.name} ${T(`sakatlandı (${p.inj} hafta)!`, `is injured (${p.inj} wk)!`)}${st.subs < 5 ? ' ' + T('Oyuncu değişikliği yap.', 'Make a substitution.') : ''}`, 'inj'); if (quick || st.subs >= 5) autoSubFor(p.id); else { st.paused = true; if (!quick) { renderLive(); openSubs(p.id); } } } });
      if (m === 45) { line(`⏸ 45' ${T('İlk yarı sona erdi', 'Half-time')}: ${scoreTxt(st.gm, st.go)}`, 'ht'); if (!quick && !st.htDone) { st.ht = true; st.paused = true; } } // devre arası: maç otomatik durur
      if (m === 61 && /trabzonspor/i.test(homeT.name)) line(`${m}' ${T('Tribünler ayakta, telefon ışıkları yandı: “BİZE HER YER TRABZON!”', 'The whole ground is on its feet with phone lights: “BİZE HER YER TRABZON!”')}`, 'ht');
      if (m >= 90) { end(); return; }
      if (!quick) renderLive();
    };
    function sendOff(p) { const i = st.xi.indexOf(p.id); if (i >= 0) st.xi[i] = null; st.red++; p.sus = Math.max(p.sus, 1); st.outMin[p.id] = st.min; st.cards[p.id] = Math.max(2, st.cards[p.id] || 0); (st.sentOff = st.sentOff || {})[p.id] = 1; }
    function autoSubFor(outId) {
      const i = st.xi.indexOf(outId); if (i < 0) return; const pos = F[i][0];
      const cand = benchNow().sort((a, b) => eff(b, pos) - eff(a, pos))[0];
      if (cand && st.subs < 5) { if (m2) m2.sub(meH, P(outId).name, cand.name, null, cand.num, cand.cond); st.outMin[outId] = st.min; st.inMin[cand.id] = st.min; st.xi[i] = cand.id; st.played.add(cand.id); st.subs++; line(`🔁 ${st.min}' ${P(outId).name} ⟶ ${cand.name}`); } else st.xi[i] = null;
    }
    function end() {
      st.done = true; clearInterval(timer);
      const res = fx.home ? { h: me().id, a: opp.id, gh: st.gm, ga: st.go } : { h: opp.id, a: me().id, gh: st.go, ga: st.gm };
      const L = lams(); res.lh = fx.home ? L.me : L.op; res.la = fx.home ? L.op : L.me;
      if (m2) { m2.flush(); } st.dGm = st.gm; st.dGo = st.go;
      line(`🏁 ${T('Maç sona erdi', 'Full time')}: ${scoreTxt(st.gm, st.go)}`, 'ft');
      st.played.forEach(id => { const p = P(id); if (p) { p.apps++; } });
      if (m2) m2.end();
      S.matchLog = { lines: st.lines.slice(0, 40), ev: st.ev, res, xi: st.xi.slice(), opp: opp.id, home: fx.home, week: S.week, report: buildReport() };
      finishWeek(res, st);
      if (!quick) renderLive(); onEnd && onEnd();
    }
    // Maç sonu raporu: takım istatistikleri, her oyuncuya 1.0–10.0 maç puanı ve maçın adamı
    function buildReport() {
      const SM = st.stats.me, SO = st.stats.op, tp = SM.poss + SO.poss || 1, won = st.gm > st.go, lost = st.gm < st.go;
      const rate = (r, pos, g, a, yc, rc, conc, mins, w, l, saves) => {
        let v = 6.2 + (r - 72) * .03 + (w ? .35 : l ? -.3 : 0) + g * 1.15 + a * .7 - yc * .35 - rc * 1.6 + (Math.random() - .5) * .9;
        if (pos === 'KL' || pos === 'ST' || pos === 'BK') v += conc === 0 ? .7 : -Math.min(1.2, conc * .28);
        if (pos === 'KL') v += Math.min(1.2, (saves || 0) * .2);
        if (mins < 25) v = 6 + (v - 6) * .55;
        return clamp(Math.round(v * 10) / 10, 1, 10);
      };
      const cnt = (t, name, k) => st.ev.filter(e => e.t === t && e[k] === name).length;
      const my = [...st.played].map(id => P(id)).filter(Boolean).map(p => { const mins = (st.outMin[p.id] != null ? st.outMin[p.id] : Math.max(st.min, 90)) - (st.inMin[p.id] || 0), sent = st.sentOff && st.sentOff[p.id];
        return { name: p.name, pos: p.pos, num: p.num, g: cnt('me', p.name, 'sc'), a: cnt('me', p.name, 'as'), yc: sent ? 0 : (st.cards[p.id] ? 1 : 0), rc: sent ? 1 : 0, mins: clamp(mins, 1, 90), sub: (st.inMin[p.id] || 0) > 0 }; });
      my.forEach(x => { x.r = rate(P2r(x.name), x.pos, x.g, x.a, x.yc, x.rc, st.go, x.mins, won, lost, SO.on - st.go); });
      const op = oXI.map(x => ({ name: x.name, pos: x.pos, g: cnt('op', x.name, 'sc'), a: cnt('op', x.name, 'as'), yc: st.opCards[x.name] ? 1 : 0, rc: st.opReds[x.name] ? 1 : 0, mins: 90 }));
      op.forEach(x => { x.r = rate((oXI.find(o => o.name === x.name) || {}).r || 72, x.pos, x.g, x.a, x.yc, x.rc, st.gm, 90, lost, won, SM.on - st.gm); });
      const all = my.map(x => Object.assign({ me: true }, x)).concat(op), mvp = all.slice().sort((a, b) => b.r - a.r || b.g - a.g)[0];
      const side = s => ({ shots: s.shots, on: Math.min(s.shots, s.on), xg: Math.round(s.xg * 100) / 100, corners: s.corners, fouls: s.fouls, off: s.off, pass: s.pass ? Math.round(s.passOk / s.pass * 100) : 0 });
      return { poss: Math.round(SM.poss / tp * 100), me: side(SM), op: side(SO), my: my.sort((a, b) => b.r - a.r), opp: op.sort((a, b) => b.r - a.r), mvp: mvp ? { name: mvp.name, r: mvp.r, me: !!mvp.me, g: mvp.g, a: mvp.a } : null, talk: st.talk };
    }
    const P2r = name => { const p = S.squad.find(q => q.name === name); return p ? p.r : 72; };
    let timer = 0;
    if (quick) { while (!st.done) minuteTick(); return; }
    // ---------- arayüz ----------
    ov = document.createElement('div'); ov.className = 'cr-live-ov';
    ov.innerHTML = `<div class="cr-live" role="dialog" aria-modal="true" aria-label="${T('Canlı maç', 'Live match')}"><div class="cr-top"></div><div class="cr-pitch2d" hidden></div><div class="cr-dyn"></div></div>`;
    (document.fullscreenElement || document.webkitFullscreenElement || document.querySelector('#draft-section.football-fullscreen-fallback, #career-section.football-fullscreen-fallback') || document.body).appendChild(ov); document.body.classList.add('cr-live-open');
    const SHOUTS = () => ({ baski: [T('Baskıyı Artır', 'Press Harder'), 'press', 1.12, 1.05, 8], konsantre: [T('Konsantre Ol', 'Concentrate'), 'eye', 1, .88, 8], ov: [T('Öv', 'Praise'), 'thumb', 1.05, .98, 6], dikine: [T('Daha Dikine Oyna', 'Play More Direct'), 'arrowUp', 1.1, 1.04, 8] });
    const TALKS = () => ({ atesle: [T('Ateşle', 'Fire Them Up'), 'fire', T('Geride ya da berabereyken hücumu canlandırır', 'Lifts the attack when level or behind')], sakin: [T('Sakinleştir', 'Calm Them Down'), 'calm', T('Öndeyken savunmayı toparlar', 'Steadies the defence when ahead')], memnun: [T('Memnuniyetini Belirt', 'Show You Are Pleased'), 'thumb', T('İyi oynayan takımın moralini yükseltir', 'Boosts morale after a good half')], uyari: [T('Uyarı Ver', 'Give a Warning'), 'warn', T('Kötü oynayan takımı silkeler, morali düşürebilir', 'Shakes up a poor side; may hurt morale')] });
    function drawLines() { const box = ov && ov.querySelector('.cr-feed'); if (box) box.innerHTML = ICZ(st.lines.slice(0, 30).map(l => `<p class="${l.cls || ''}">${esc(l.txt)}</p>`).join('')); }
    // Saha kenarı komutu: kısa süreli tempo / moral etkisi, komutlar arasında 6 dakika bekleme
    function doShout(k) {
      const sh = SHOUTS()[k]; if (!sh || st.done) return;
      const wait = 6 - (st.min - st.shoutAt); if (wait > 0) return toast(T(`Oyuncular önceki komutu uyguluyor (${wait} dk)`, `The players are still acting on your last shout (${wait} min)`));
      st.shoutAt = st.min; st.shoutN++; let me2 = sh[2], op2 = sh[3], extra = '';
      const d = st.gm - st.go, tired = 1 - Math.min(.5, Math.max(0, st.shoutN - 4) * .12); // çok sık bağırmak etkisini azaltır
      if (k === 'ov') { if (d <= -2) { me2 = .99; extra = T(' — skor bu kadar kötüyken övgü ters tepti.', ' — praise at this scoreline backfires.'); } st.xi.forEach(id => { const p = P(id); if (p) p.morale = clamp(p.morale + (d <= -2 ? -1 : 2), 20, 99); }); }
      if (k === 'baski') st.pressUntil = st.min + sh[4];
      st.boosts.push({ k, me: 1 + (me2 - 1) * tired, op: op2 < 1 ? 1 - (1 - op2) * tired : op2, until: st.min + sh[4] });
      if (m2) { m2.shout(meH, sh[0]); if (k === 'baski') m2.setPress(meH, true); }
      line(`📣 ${st.min}' ${T('Kenar komutu', 'Touchline shout')}: ${sh[0]}${extra}`); renderLive();
    }
    function applyTalk(k) {
      if (!k) return; const d = st.gm - st.go, name = TALKS()[k][0]; let me2 = 1, op2 = 1, mor = 0, msg = '';
      if (k === 'atesle') { if (d <= 0) { me2 = 1.14; op2 = 1.03; mor = 2; msg = T('Oyuncular sahaya hırsla dönüyor.', 'The players come out fired up.'); } else { me2 = 1.04; op2 = 1.07; msg = T('Öndeyken fazla gaz verdin; takım dengesini biraz kaybetti.', 'Too much fire while ahead — the side loses some balance.'); } }
      if (k === 'sakin') { if (d > 0) { me2 = .97; op2 = .86; mor = 1; msg = T('Takım skoru korumak için sakin ve organize.', 'Calm and organised to protect the lead.'); } else { me2 = .95; msg = T('Geride değilken bile fazla sakin kaldılar; tempo düştü.', 'A little too calm — the tempo drops.'); } }
      if (k === 'memnun') { if (d > 0) { me2 = 1.05; mor = 4; msg = T('Oyuncular övgüyle rahatladı, moral yükseldi.', 'The praise lifts the dressing room.'); } else if (d === 0) { mor = 1; msg = T('Oyuncular performanslarından emin.', 'The players feel reassured.'); } else { me2 = .97; mor = -3; msg = T('Gerideyken gelen övgü soyunma odasını şaşırttı.', 'Praise while losing confuses the players.'); } }
      if (k === 'uyari') { if (d < 0) { me2 = 1.1; op2 = .96; mor = -1; msg = T('Sert uyarı işe yaradı, takım toparlandı.', 'The warning hits home.'); } else { me2 = 1.02; mor = -3; msg = T('Kötü oynamayan takıma sert çıkmak morali bozdu.', 'A harsh word after a decent half hurts morale.'); } }
      st.talk = k; st.boosts.push({ k: 'talk', me: me2, op: op2, until: 70 });
      st.xi.forEach(id => { const p = P(id); if (p) p.morale = clamp(p.morale + mor, 20, 99); });
      line(`🎤 ${T('Devre arası konuşması', 'Half-time team talk')}: ${name} — ${msg}`, 'ht');
    }
    function renderLive() {
      if (!ov) return;
      const L = lams(), share = clamp(Math.round(L.me / (L.me + L.op) * 100), 25, 75), SH = SHOUTS(), cool = Math.max(0, 6 - (st.min - st.shoutAt));
      ov.querySelector('.cr-top').innerHTML = ICZ(`<div class="cr-match-kicker"><span>⚽ BABA. / ${T('MAÇ MERKEZİ', 'MATCH CENTRE')}</span><span class="cr-live-status">${st.done ? T('MAÇ BİTTİ', 'FULL TIME') : st.htOpen ? T('DEVRE ARASI', 'HALF-TIME') : '● ' + T('CANLI MAÇ', 'LIVE MATCH')}</span></div><header class="cr-score"><span><i class="cr-score-kit">${jersey(homeT, { size: 26 })}</i>${esc(homeT.name)}</span><b>${fx.home ? st.dGm : st.dGo} – ${fx.home ? st.dGo : st.dGm}</b><span>${esc(awayT.name)}<i class="cr-score-kit">${jersey(awayT, { size: 26, away: cdist(KIT(homeT).c1, KIT(awayT).c1) < 110 })}</i></span><em>${st.done ? T('MS', 'FT') : st.min + "'"}</em></header>
        <div class="cr-prog"><i style="width:${st.min / 90 * 100}%"></i></div>
        <div class="cr-mom"><span>${T('Baskı', 'Momentum')}</span><div><i style="width:${share}%"></i></div><small>${share}% – ${100 - share}%</small></div>`);
      if (m2) m2.setMomentum(fx.home ? share : 100 - share);
      const dyn = ov.querySelector('.cr-dyn');
      // Düğmeler her dakika yeniden çizilmez: yalnızca durumları değişince kurulur (aksi halde dokunuşlar kaçar)
      const sig = [st.done, st.done && !!(m2 && m2.busy()), !!m2, st.paused, st.speed, st.subs, st.ment, st.style, cool > 0, Object.keys(SH).map(k => st.boosts.some(b => b.k === k && st.min <= b.until) ? 1 : 0).join(''), typeof I18N !== 'undefined' ? I18N.lang : ''].join('|');
      if (sig === st.sig && dyn.firstChild) { const c = dyn.querySelector('.cr-cool'); if (c) c.textContent = cool ? `(${cool} ${T('dk sonra', 'min')})` : ''; drawLines(); return; }
      st.sig = sig;
      if (st.done) {
        const playing = !!(m2 && m2.busy());
        dyn.innerHTML = ICZ(`<div class="cr-live-bar">${playing ? `<span class="cr-wait">${T('Son pozisyon oynanıyor…', 'Final passage of play…')}</span>` : ''}${typeof Match2D !== 'undefined' && st.ev.length ? `<button class="pill ghost" data-l="hl">📺 ${T('2D özet izle', 'Watch 2D highlights')}</button>` : ''}<button class="pill" data-l="close">${T('Kulüp Merkezi’ne dön', 'Back to Club Centre')} ▶</button></div><div class="cr-rep-wrap">${reportHTML(S.matchLog)}</div><details class="cr-rep-feed"><summary>${T('Maç anlatımı', 'Match commentary')}</summary><div class="cr-feed" aria-live="polite"></div></details>`);
      } else {
        dyn.innerHTML = ICZ(`<div class="cr-feed" aria-live="polite"></div>
          <div class="cr-live-bar">${typeof Match2D !== 'undefined' ? `<button class="pill ghost ${m2 ? 'on' : ''}" data-l="tv">📺 ${m2 ? T('2D açık', '2D on') : T('2D izle', 'Watch 2D')}</button>` : ''}<button class="pill ghost" data-l="pause">${st.paused ? '▶ ' + T('Devam et', 'Resume') : '⏸ ' + T('Durdur', 'Pause')}</button><button class="pill ghost" data-l="spd">⏩ ${st.speed}x</button><button class="pill ghost" data-l="sub">🔁 ${T('Oyuncu değiştir', 'Substitute')} (${5 - st.subs})</button><button class="pill ghost" data-l="skip">⏭ ${T('Sona atla', 'Skip to end')}</button></div>
          <p class="cr-plan-lbl">📣 ${T('Kenar komutları', 'Touchline shouts')} <small class="cr-cool">${cool ? `(${cool} ${T('dk sonra', 'min')})` : ''}</small></p><div class="cr-ment cr-shouts">${Object.entries(SH).map(([k, v]) => `<button data-sh="${k}" class="${st.boosts.some(b => b.k === k && st.min <= b.until) ? 'on' : ''}" ${cool ? 'aria-disabled="true"' : ''}>${ic(v[1])}<span>${v[0]}</span></button>`).join('')}</div>
          <p class="cr-plan-lbl">${ic('shield')} ${T('Mentalite', 'Mentality')}</p><div class="cr-ment" aria-label="${T('Mentalite', 'Mentality')}">${Object.entries(MENT()).map(([k, v]) => `<button data-m="${k}" class="${st.ment === k ? 'on' : ''}">${v[0]}</button>`).join('')}</div>
          <p class="cr-plan-lbl">📋 ${T('Hücum planı', 'Attacking plan')}</p><div class="cr-ment cr-plan">${Object.entries(PLANS()).map(([k, v]) => `<button data-pl="${k}" class="${st.style === k ? 'on' : ''}">${v}</button>`).join('')}</div>`);
      }
      drawLines();
      ov.querySelectorAll('.cr-dyn [data-m]').forEach(b => b.onclick = () => setMent(b.dataset.m));
      ov.querySelectorAll('.cr-dyn [data-pl]').forEach(b => b.onclick = () => setPlan(b.dataset.pl));
      ov.querySelectorAll('[data-sh]').forEach(b => b.onclick = () => doShout(b.dataset.sh));
      const on = (k, f) => { const b = ov.querySelector(`[data-l=${k}]`); if (b) b.onclick = f; };
      on('pause', () => { st.paused = !st.paused; if (m2) m2.pause(st.paused); renderLive(); });
      on('spd', () => { st.speed = st.speed === 1 ? 2 : st.speed === 2 ? 4 : 1; restart(); renderLive(); });
      on('sub', () => openSubs());
      on('tv', () => { if (m2) { stopTV(); S.tv = false; } else { S.tv = true; startTV(); } save(); renderLive(); });
      on('skip', () => { stopTV(); st.paused = false; st.ht = false; clearInterval(timer); while (!st.done) { const was = quick; quick = true; minuteTick(); quick = was; } renderLive(); });
      on('close', close);
      on('hl', () => watch2D());
    }
    // taktik değişiklikleri hem metin motoruna hem 2D sahaya anında yansır
    function setMent(k) { st.ment = k; S.ment = k; if (m2) m2.setPress(meH, k === 'hucum' || k === 'tumhucum' || st.pressUntil >= st.min); line(`📋 ${st.min}' ${T('Taktik değişti', 'Tactical change')}: ${MENT()[st.ment][0]}`); renderLive(); }
    function setPlan(k) { st.style = k; S.style = k; if (m2) m2.setStyle(meH, k); const pm = planMod(st.style, st.xi); line(`📋 ${st.min}' ${T('Hücum planı', 'Attacking plan')}: ${PLANS()[st.style]}${pm.me >= 1.06 ? T(' — kadroya çok uygun!', ' — a great fit for this squad!') : pm.me < .97 ? T(' — kadro bu plana pek uygun değil.', ' — the squad doesn’t really suit this plan.') : ''}`); renderLive(); }
    // Oyuncu değişikliği: yalnızca 9 kişilik maç günü yedek kulübesi listelenir; modal ortada açılır ve ✕ ile kapanır
    function openSubs(forced) {
      let outId = forced || null; st.paused = true; if (m2) m2.pause(true);
      const md = UI.modal('', { mount: ov.parentNode, cls: 'crm-subs', label: T('Oyuncu değişikliği', 'Substitution'), onClose: () => { if (forced && st.xi.includes(forced)) autoSubFor(forced); if (!st.htOpen) { st.paused = false; if (m2) m2.pause(false); } renderLive(); } });
      const draw = () => {
        const bench = benchNow();
        const xiRows = st.xi.map((id, i) => { const p = P(id); return p ? `<button data-o="${p.id}" class="${outId === p.id ? 'on' : ''} ${st.injured.includes(p.id) ? 'inj' : ''}"><span>${PZ(F[i][0])}</span><b>${p.num ? p.num + ' · ' : ''}${esc(p.name)}</b><em>${Math.round(p.cond)}%</em></button>` : ''; }).join('');
        md.set(`<h3>🔁 ${T('Oyuncu değişikliği', 'Substitution')} <small>${5 - st.subs} ${T('hak', 'left')}</small></h3>
          <p class="crm-note">${T(`Maç kadrosu: ilk 11 + ${BENCH} yedek. Önce çıkacak oyuncuyu, sonra kulübeden girecek oyuncuyu seç.`, `Matchday squad: XI + ${BENCH} subs. Pick who comes off, then who comes on.`)}</p>
          <div class="cr-subcols"><div><p class="eyebrow">${T('Çıkacak', 'Off')}</p>${xiRows}</div><div><p class="eyebrow">${T('Yedek kulübesi', 'Bench')} (${bench.length})</p>${bench.map(p => `<button data-i="${p.id}" ${outId && st.subs < 5 ? '' : 'disabled'}><span>${PZ(p.pos)}</span><b>${p.num ? p.num + ' · ' : ''}${esc(p.name)}</b><em>${p.r}</em></button>`).join('') || `<p class="muted">${T('Kulübede kullanılabilir yedek yok', 'No substitutes available')}</p>`}</div></div>
          <div class="crm-row"><button type="button" class="crm-btn" data-crm-x>${T('Kapat ve devam et', 'Close and resume')}</button></div>`);
        md.el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { outId = b.dataset.o; draw(); });
        md.el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { if (!outId || st.subs >= 5) return; const i = st.xi.indexOf(outId), inn = P(b.dataset.i), out = P(outId); if (i < 0 || !inn) return; st.xi[i] = inn.id; st.played.add(inn.id); st.subs++; st.outMin[outId] = st.min; st.inMin[inn.id] = st.min; line(`🔁 ${st.min}' ${out.name} ⟶ ${inn.name}`); if (m2) m2.sub(meH, out.name, inn.name, null, inn.num, inn.cond); if (forced === outId) forced = null; outId = null; if (st.subs >= 5) md.close(); else draw(); });
      };
      draw();
    }
    // Devre arası: maç durur; takım konuşması, taktik ve oyuncu değişikliği yapılabilir
    function openHalftime() {
      st.htOpen = true; if (m2) m2.halftime(); let talk = null;
      const hm = UI.modal('', { mount: ov.parentNode, cls: 'crm-ht', noClose: true, sticky: true, label: T('Devre arası', 'Half-time') });
      const draw = () => {
        const a = st.stats.me, b = st.stats.op, tp = a.poss + b.poss || 1, TK = TALKS();
        hm.set(`<p class="eyebrow">⏸ ${T('DEVRE ARASI', 'HALF-TIME')} · 45'</p><h3>${esc(scoreTxt(st.gm, st.go))}</h3>
          <div class="cr-ht-stats"><span>${T('Topla oynama', 'Possession')} <b>%${Math.round(a.poss / tp * 100)}</b></span><span>${T('Şut', 'Shots')} <b>${a.shots}–${b.shots}</b></span><span>xG <b>${a.xg.toFixed(2)}–${b.xg.toFixed(2)}</b></span><span>${T('Korner', 'Corners')} <b>${a.corners}–${b.corners}</b></span></div>
          <p class="crm-lbl">🎤 ${T('Takım konuşması', 'Team talk')}</p><div class="cr-ht-talks">${Object.entries(TK).map(([k, v]) => `<button type="button" data-talk="${k}" class="${talk === k ? 'on' : ''}">${ic(v[1])}<b>${v[0]}</b><small>${v[2]}</small></button>`).join('')}</div>
          <p class="crm-lbl">${ic('shield')} ${T('Mentalite', 'Mentality')}</p><div class="cr-ment">${Object.entries(MENT()).map(([k, v]) => `<button type="button" data-hm="${k}" class="${st.ment === k ? 'on' : ''}">${v[0]}</button>`).join('')}</div>
          <p class="crm-lbl">📋 ${T('Hücum planı', 'Attacking plan')}</p><div class="cr-ment cr-plan">${Object.entries(PLANS()).map(([k, v]) => `<button type="button" data-hp="${k}" class="${st.style === k ? 'on' : ''}">${v}</button>`).join('')}</div>
          <div class="crm-row"><button type="button" class="crm-btn ghost" data-hsub>🔁 ${T('Oyuncu değiştir', 'Substitute')} (${5 - st.subs})</button><button type="button" class="crm-btn" data-go>▶ ${T('İkinci yarıya başla', 'Start the second half')}</button></div>`);
        hm.el.querySelectorAll('[data-talk]').forEach(x => x.onclick = () => { talk = talk === x.dataset.talk ? null : x.dataset.talk; draw(); });
        hm.el.querySelectorAll('[data-hm]').forEach(x => x.onclick = () => { setMent(x.dataset.hm); draw(); });
        hm.el.querySelectorAll('[data-hp]').forEach(x => x.onclick = () => { setPlan(x.dataset.hp); draw(); });
        hm.el.querySelector('[data-hsub]').onclick = () => openSubs();
        hm.el.querySelector('[data-go]').onclick = () => { applyTalk(talk); st.ht = false; st.htOpen = false; st.htDone = true; st.paused = false; hm.close(); if (m2) { m2.pause(false); m2.resume(); } renderLive(); };
      };
      draw(); renderLive();
    }
    function sides(full) {
      const dk = k => typeof ClubID !== 'undefined' && ClubID.discKit ? ClubID.discKit(k) : 'duz';
      const hk = KIT(homeT), ak = cdist(hk.c1, KIT(awayT).c1) < 110 ? KIT(awayT, true) : KIT(awayT), mk = fx.home ? hk : ak, ok2 = fx.home ? ak : hk;
      const myXI = st.xi.map((id, i) => ({ p: P(id) || (full ? P(S.xi[i]) : null), slot: { x: F[i][1], y: F[i][2] } })).filter(x => x.p);
      const meSide = { name: meName, short: me().short, c1: mk.c1, c2: mk.c2, kit: dk(mk), logo: me().identity && typeof ClubID !== 'undefined' && ClubID.get() ? ClubID.logo(ClubID.get(), 22) : '', xi: myXI.map(x => ({ name: x.p.name, pos: x.p.pos, r: x.p.r, num: x.p.num, cond: full ? 100 : x.p.cond, traits: traitsOf(x.p) })), slots: myXI.map(x => x.slot), style: st.style, press: st.ment === 'hucum' || st.ment === 'tumhucum' ? 'high' : '' };
      const DS = { KL: [[50, 94]], ST: [[37, 80], [63, 80]], BK: [[12, 74], [88, 74]], OS: [[28, 54], [50, 60], [72, 54]], KN: [[14, 24], [86, 24]], FV: [[50, 14]] }, used = {};
      const opSide = { name: opp.name, short: opp.short, c1: ok2.c1, c2: ok2.c2, kit: dk(ok2), xi: oXI.map(p => ({ name: p.name, pos: p.pos, r: p.r })), slots: oXI.map(p => { const k = used[p.pos] = (used[p.pos] || 0) + 1; const c = (DS[p.pos] || [[50, 50]])[k - 1] || [50, 50]; return { x: c[0], y: c[1] }; }) };
      return fx.home ? { home: meSide, away: opSide } : { home: opSide, away: meSide };
    }
    const scene = { important: importantHome, derby: isDerby, night, weather: rainy ? 'rain' : 'clear' };
    // canlı 2D: metin saati olay anlarında 2D pozisyon bitene kadar bekler
    function startTV() {
      if (typeof Match2D === 'undefined' || m2 || st.done) return; const box = ov.querySelector('.cr-pitch2d'); box.hidden = false; box.innerHTML = '';
      m2 = Match2D.show(Object.assign({ live: true, mount: box, gh: 0, ga: 0, lh: 1, la: 1, ev: [] }, scene, sides()));
      if (m2) { m2.setMin(Math.max(1, st.min)); m2.setSpeed(st.speed); m2.setScore(fx.home ? st.gm : st.go, fx.home ? st.go : st.gm); }
    }
    function stopTV() { if (m2) { m2.close(); m2 = null; } const box = ov && ov.querySelector('.cr-pitch2d'); if (box) { box.hidden = true; box.innerHTML = ''; } }
    function watch2D() {
      const sd = sides(true);
      const ev = st.ev.map(e => ({ t: (e.t === 'me') === fx.home ? 'h' : 'a', sc: e.sc, as: e.as, min: e.min, how: e.how, style: e.style }));
      const cards = st.reds.map(c => ({ t: (c.t === 'me') === fx.home ? 'h' : 'a', name: c.name, min: c.min, red: true, dogso: c.dogso }));
      const r = S.matchLog.res;
      ov.style.display = 'none';
      Match2D.show(Object.assign({ gh: r.gh, ga: r.ga, lh: r.lh, la: r.la, ev, cards }, scene, sd), () => { ov.style.display = ''; });
    }
    function close() { stopTV(); clearInterval(timer); clearInterval(endPoll); ov.remove(); document.body.classList.remove('cr-live-open'); tab = 'center'; render(); scrollTop(); }
    let endPoll = 0;
    const restart = () => { clearInterval(timer); if (m2) m2.setSpeed(st.speed); timer = setInterval(() => {
      if (st.done) return;
      if (st.ht && !st.htOpen) { if (!(m2 && m2.busy())) openHalftime(); return; } // devre arası: sahadaki pozisyon bitince açılır
      if (!st.paused && !(m2 && m2.busy())) { minuteTick(); if (m2) m2.setMin(st.min); }
    }, 160 / st.speed); };
    onEnd = (prev => () => { // maç bitince 2D'deki son pozisyonun bitmesi beklenir, sonra saha kapanıp rapor tam ekran gösterilir
      clearInterval(endPoll); endPoll = setInterval(() => { if (!ov.isConnected) return clearInterval(endPoll); if (!m2 || !m2.busy()) { clearInterval(endPoll); stopTV(); renderLive(); } }, 400);
      if (prev) prev();
    })(onEnd);
    const begin = () => {
      line(`🏟️ ${T('Maç başladı', 'Kick-off')}! ${homeT.name} – ${awayT.name}. ${T('Taktik', 'Tactic')}: ${MENT()[st.ment][0]} · ${PLANS()[st.style]}`);
      if (S.tv !== false && typeof Match2D !== 'undefined') startTV();
      renderLive(); restart();
    };
    renderLive();
    // derbi ve zirve maçlarında özel maç önü VS ekranı (formalar karşı karşıya)
    if (isDerby || topClash || S.week === WEEKS - 1) vsIntro(homeT, awayT, isDerby ? T('DERBİ', 'DERBY') : S.week === WEEKS - 1 ? T('SEZONUN SON MAÇI', 'FINAL DAY') : T('ZİRVE MAÇI', 'TOP-OF-THE-TABLE CLASH'), ov, begin); else begin();
  }

  /* ---------------- maç önü VS ekranı ve maç sonu raporu ---------------- */
  function vsIntro(home, away, label, mountEl, done) {
    const el = document.createElement('div'); el.className = 'cr-vsi';
    const awayAlt = cdist(KIT(home).c1, KIT(away).c1) < 110;
    el.innerHTML = `<div class="cr-vsi-in"><p class="cr-vsi-tag">${esc(label)}</p><div class="cr-vsi-row"><div class="cr-vsi-t l">${jersey(home, { size: 150, num: 10 })}<b>${esc(home.name)}</b><small>${T('EV SAHİBİ', 'HOME')}</small></div><span class="cr-vsi-vs">VS</span><div class="cr-vsi-t r">${jersey(away, { size: 150, num: 10, away: awayAlt })}<b>${esc(away.name)}</b><small>${T('DEPLASMAN', 'AWAY')}</small></div></div><p class="cr-vsi-sub">${T('Hafta', 'Week')} ${S.week + 1} · ${S.year}/${String(S.year + 1).slice(2)}</p></div>`;
    (mountEl || document.body).appendChild(el);
    let fired = false; const go = () => { if (fired) return; fired = true; el.classList.add('out'); setTimeout(() => el.remove(), 320); done && done(); };
    el.onclick = go; setTimeout(go, 2600);
  }
  function reportHTML(log) {
    const r = log && log.report; if (!r) return '';
    const res = log.res, hN = teamName(res.h), aN = teamName(res.a), Hs = log.home ? r.me : r.op, As = log.home ? r.op : r.me, ph = log.home ? r.poss : 100 - r.poss;
    const hT = S.teams.find(t => t.id === res.h) || {}, aT = S.teams.find(t => t.id === res.a) || {};
    const row = (l, a, b, wa, wb) => { const sum = (wa + wb) || 1; return `<div class="cr-rep-row"><b>${a}</b><span>${l}</span><b>${b}</b><div class="cr-rep-bar"><i style="width:${Math.round(wa / sum * 100)}%"></i></div></div>`; };
    const plist = (arr, title, team) => `<div class="cr-rep-team"><h4>${jersey(team, { size: 22 })}${esc(title)}</h4>${arr.map(p => `<div class="cr-rep-pl ${r.mvp && r.mvp.name === p.name ? 'mvp' : ''}"><span class="pz">${PZ(p.pos)}</span><b>${esc(p.name)}${p.sub ? ` <small>${T('yedek', 'sub')}</small>` : ''}</b><em>${ic('ball').repeat(Math.min(4, p.g || 0))}${ic('assist').repeat(Math.min(3, p.a || 0))}${p.yc ? ic('yc') : ''}${p.rc ? ic('rc') : ''}${r.mvp && r.mvp.name === p.name ? ic('star') : ''}</em><strong class="${p.r >= 7.5 ? 'hi' : p.r < 6 ? 'lo' : ''}">${p.r.toFixed(1)}</strong></div>`).join('')}</div>`;
    const mvpTeam = r.mvp ? (r.mvp.me ? me() : S.teams.find(t => t.id === log.opp) || {}) : null, mvpNum = r.mvp && r.mvp.me ? ((S.squad.find(p => p.name === r.mvp.name) || {}).num || '') : '';
    return `<section class="cr-rep" aria-label="${T('Maç sonu raporu', 'Post-match report')}">
      <header class="cr-rep-head"><p class="eyebrow">${ic('chart')} ${T('Maç Sonu Raporu', 'Post-Match Report')} · ${T('Hafta', 'Week')} ${log.week + 1}</p><h2><span>${jersey(hT, { size: 34 })}${esc(hN)}</span><b>${res.gh} – ${res.ga}</b><span>${esc(aN)}${jersey(aT, { size: 34 })}</span></h2></header>
      ${r.mvp ? `<div class="cr-rep-mvp">${jersey(mvpTeam, { size: 64, num: mvpNum })}<div><small>${ic('star')} ${T('MAÇIN ADAMI', 'MAN OF THE MATCH')}</small><b>${esc(r.mvp.name)}</b><span>${r.mvp.g ? r.mvp.g + ' ' + T('gol', 'goal') + ' · ' : ''}${r.mvp.a ? r.mvp.a + ' ' + T('asist', 'assist') + ' · ' : ''}${T('Maç puanı', 'Rating')}</span></div><strong>${r.mvp.r.toFixed(1)}</strong></div>` : ''}
      <div class="cr-rep-stats">${row(T('Topla oynama', 'Possession'), '%' + ph, '%' + (100 - ph), ph, 100 - ph)}${row(T('Toplam şut', 'Shots'), Hs.shots, As.shots, Hs.shots, As.shots)}${row(T('İsabetli şut', 'On target'), Hs.on, As.on, Hs.on, As.on)}${row(T('xG (gol beklentisi)', 'xG (expected goals)'), Hs.xg.toFixed(2), As.xg.toFixed(2), Hs.xg, As.xg)}${row(T('Korner', 'Corners'), Hs.corners, As.corners, Hs.corners, As.corners)}${row(T('Faul', 'Fouls'), Hs.fouls, As.fouls, Hs.fouls, As.fouls)}${row(T('Pas isabeti', 'Pass accuracy'), '%' + Hs.pass, '%' + As.pass, Hs.pass, As.pass)}${row(T('Ofsayt', 'Offsides'), Hs.off, As.off, Hs.off, As.off)}</div>
      <div class="cr-rep-cols">${plist(log.home ? r.my : r.opp, hN, hT)}${plist(log.home ? r.opp : r.my, aN, aT)}</div></section>`;
  }
  function openReport(log) { if (!UI || !log || !log.report) return; UI.modal(reportHTML(log) + `<div class="crm-row"><button type="button" class="crm-btn" data-crm-x>${T('Devam', 'Continue')} ▶</button></div>`, { cls: 'crm-report', label: T('Maç sonu raporu', 'Post-match report') }); }
  const scrollTop = () => { const h = host && host.querySelector('.cr-head, .cr'); if (h && h.scrollIntoView) h.scrollIntoView({ block: 'start' }); };

  /* ---------------- haftanın kapanışı ---------------- */
  function finishWeek(myRes, st) {
    const w = S.week, fx = S.fix[w], results = [];
    fx.forEach(([h, a]) => { const r = (myRes && ((h === myRes.h && a === myRes.a))) ? myRes : quickMatch(h, a); record(r); results.push({ h: r.h, a: r.a, gh: r.gh, ga: r.ga }); });
    S.results[w] = results;
    const mr = results.find(r => r.h === me().id || r.a === me().id), home = mr.h === me().id, gf = home ? mr.gh : mr.ga, ga = home ? mr.ga : mr.gh, won = gf > ga, draw = gf === ga;
    const playedIds = st ? st.played : new Set(S.xi);
    // kondisyon, moral, gelişim, sakatlık/ceza sayaçları
    S.squad.forEach(p => {
      const played = playedIds.has(p.id);
      if (p.inj > 0 && !(st && st.injured.includes(p.id))) p.inj--;
      if (p.sus > 0 && !(st && st.cards && st.cards[p.id] >= 2) && !played) p.sus--;
      if (p.yc >= 5) { p.yc = 0; p.sus = Math.max(p.sus, 1); news(T(`${p.name} 5. sarı kartı nedeniyle bir maç ceza aldı.`, `${p.name} is suspended for one match after a fifth booking.`), 'warn'); }
      p.cond = clamp(p.cond + (played ? 16.5 : 30) + S.fac.med * 1.5 - (played && p.age > 30 ? 2 : 0) + (S.training === 'dinlen' ? 10 : S.training === 'fizik' ? -6 : 0), 0, 100);
      p.morale = clamp(p.morale + (won ? 4 : draw ? 1 : -3) + (played ? 1 : -1) + (p.morale < 55 ? 1.5 : p.morale > 85 ? -1 : 0) + (S.training === 'dinlen' ? 2 : 0), 20, 99);
      // gelişim: maç oynayan gençler + bireysel gelişim odağı + fizik antrenmanı
      let gain = 0;
      if (played && p.age <= 22 && p.r < p.pot) gain += .1 * (1 + S.fac.train * .2) + (st ? st.ev.filter(e => e.t === 'me' && (e.sc === p.name || e.as === p.name)).length * .06 : 0);
      if (S.focus.includes(p.id) && p.age <= 23 && p.r < p.pot) gain += .14 * (1 + S.fac.train * .2);
      if (S.training === 'fizik' && p.age <= 23 && p.r < p.pot) gain += .02;
      if (gain) { p.prog += gain; if (p.prog >= 1) { p.prog = 0; p.r++; news(T(`📈 ${p.name} gelişti: reyting ${p.r}.`, `📈 ${p.name} has improved: rating ${p.r}.`), 'good'); } }
    });
    // finans
    const fin = { gate: 0, merch: 0, spon: 0, wages: 0, other: 0 };
    if (home) fin.gate = capacity() * Math.min(1, .45 + S.pop / 140) * 15 * (S.ticketDisc > 0 ? .8 : 1) / 1e6 * (S.rev || 1);
    fin.merch = S.pop * .0018 * (1 + (won ? .2 : 0)) * (S.rev || 1);
    if (S.sponsor && won) fin.spon = S.sponsor.win;
    fin.wages = S.squad.reduce((a, p) => a + wage(p), 0);
    fin.other = .05 + (S.fac.train + S.fac.med + S.fac.stadium) * .02;
    S.budget += fin.gate + fin.merch + fin.spon - fin.wages - fin.other; S.fin = fin;
    if (S.ticketDisc > 0) S.ticketDisc--;
    S.pop = clamp(S.pop + (won ? .7 : draw ? .1 : -.5), 10, 100);
    // scout
    // scout: aynı anda birden çok bölge; yeni rapor eski rapordaki imzalanmamış oyuncuları silmez
    const absW = S.season * WEEKS + S.week;
    S.scouts = (S.scouts || []).filter(sc => { sc.left--; if (sc.left > 0) return true; const R = REG()[sc.region]; S.scouted = S.scouted.concat(Array.from({ length: 3 }, () => Object.assign(regen(sc.region), { from: sc.region, exp: absW + 9 }))); news(T(`🔭 ${R.n} raporu geldi: 3 genç yetenek bulundu.`, `🔭 The ${R.n} scouting report is in: 3 young talents found.`), 'good'); return false; });
    S.scouted = S.scouted.filter(p => { if (p.exp == null || p.exp > absW) return true; news(T(`🔭 ${p.name} için bekleme süresi doldu; başka bir kulüple anlaştı.`, `🔭 ${p.name} got tired of waiting and signed elsewhere.`), 'warn'); return false; });
    while (S.scouted.length > 12) { const gone = S.scouted.shift(); news(T(`🔭 Rapor listesi doldu: ${gone.name} listeden çıkarıldı.`, `🔭 Report list full: ${gone.name} dropped.`), 'warn'); }
    // taktik uyumu: aynı diziliş ve planla oynadıkça ve antrenmanla artar
    S.fam = clamp(famNow() + 2 + ({ hucum: 4, savunma: 4, top: 6, fizik: 0, dinlen: -2 }[S.training] || 0), 15, 100); S.famKey = famKey();
    S.focus = (S.focus || []).filter(id => { const p = P(id); if (!p) return false; if (p.age > 23 || p.r >= p.pot) { news(T(`🎯 ${p.name} bireysel gelişim programını tamamladı.`, `🎯 ${p.name} has completed his individual programme.`)); return false; } return true; });
    news(`${won ? '✅' : draw ? '➖' : '❌'} ${T('Hafta', 'Week')} ${w + 1}: ${teamName(mr.h)} ${mr.gh}–${mr.ga} ${teamName(mr.a)}`, won ? 'good' : draw ? '' : 'bad');
    S.week++;
    if (S.week >= WEEKS) seasonEnd(); else rollEvent();
    autoFixXI(); cleanBench(); save();
  }
  // yardımcı antrenör: hızlı simülasyonda çok yorgun oyuncuyu aynı mevkideki dinç yedekle değiştirir
  function rotate() {
    const F = FORMATIONS[S.formation];
    const taken = new Set(S.xi.filter(Boolean)); // aynı yedek iki mevkiye yazılmaz; kanat oyuncusu beke çekilmez
    S.xi = S.xi.map((id, i) => { const p = P(id), pos = F[i][0]; if (!p || p.cond >= 58) return id;
      const alt = S.squad.filter(q => avail(q) && !taken.has(q.id) && q.cond >= 80 && fit(q, pos) >= -3 && eff(q, pos) >= eff(p, pos) - 2).sort((a, b) => eff(b, pos) - eff(a, pos))[0];
      if (!alt) return id; taken.add(alt.id); news(T(`🔄 Yardımcı antrenör yorgun ${p.name} yerine ${alt.name} oynattı.`, `🔄 Your assistant rested the tired ${p.name} for ${alt.name}.`)); return alt.id; });
  }
  const teamName = id => (S.teams.find(t => t.id === id) || {}).name || id;
  function autoFixXI() { // sakat / cezalı oyuncuyu ilk 11'den çıkar, boşluğu en iyi uygun oyuncuyla doldur
    const F = FORMATIONS[S.formation];
    S.xi = S.xi.map((id, i) => { const p = P(id); if (p && avail(p)) return id; const pos = F[i][0], cand = S.squad.filter(q => avail(q) && !S.xi.includes(q.id)).sort((a, b) => eff(b, pos) - eff(a, pos))[0]; if (p) news(T(`${p.name} ${p.inj ? 'sakat' : 'cezalı'} olduğu için ilk 11'den çıkarıldı${cand ? ', yerine ' + cand.name : ''}.`, `${p.name} was removed from the XI (${p.inj ? 'injured' : 'suspended'})${cand ? ', replaced by ' + cand.name : ''}.`), 'warn'); return cand ? cand.id : null; });
  }
  function seasonEnd() {
    const tab2 = sorted(), rank = tab2.findIndex(t => t.me) + 1, champ = rank === 1;
    const prize = ((19 - rank) * .35 + (champ ? 6 : 0)) * (S.rev || 1) + (champ && S.sponsor ? S.sponsor.title : 0);
    S.budget += prize; S.pop = clamp(S.pop + (champ ? 15 : rank <= 4 ? 6 : rank >= 16 ? -8 : 0), 10, 100);
    const top = S.squad.slice().sort((a, b) => b.sg - a.sg)[0];
    S.history.unshift({ season: S.season, year: S.year, rank, pts: S.table[me().id].pts, champ, top: top ? top.name + ' (' + top.sg + ')' : '-' , prize: Math.round(prize * 10) / 10 });
    S.pending = { kind: 'season', rank, champ, prize, top: top ? top.name : '-', topg: top ? top.sg : 0 };
    news(champ ? T(`🏆 ŞAMPİYON! ${me().name} ${S.season}. sezonda ligi kazandı!`, `🏆 CHAMPIONS! ${me().name} win the league in season ${S.season}!`) : T(`Sezon ${rank}. sırada tamamlandı. Ödül: ${M(prize)}`, `Season finished in ${rank}th place. Prize money: ${M(prize)}`), champ ? 'big' : '');
  }
  function newSeason() {
    const gone = [];
    // kiralık oyuncular sezon sonunda kulüplerine döner
    S.squad.filter(p => p.loan).forEach(p => { S.squad = S.squad.filter(x => x !== p); S.xi = S.xi.map(id => id === p.id ? null : id); if (p.loanOrig) S.removed = S.removed.filter(n => n !== p.name); else (S.added[p.loan] = S.added[p.loan] || []).push({ name: p.name, pos: p.pos, r: p.r, age: p.age + 1, pot: p.pot }); news(T(`↩ ${p.name} kiralık süresi bitti, ${teamName(p.loan)} kulübüne döndü.`, `↩ ${p.name}'s loan has ended; he returns to ${teamName(p.loan)}.`)); });
    S.lg = {}; S.cold = {};
    S.squad.forEach(p => {
      p.age++;
      if (p.age <= 21 && p.r < p.pot) p.r = Math.min(p.pot, p.r + Math.max(1, Math.round((p.pot - p.r) * .25 * (.6 + p.apps / WEEKS) * (1 + S.fac.train * .12))));
      else if (p.age >= 32) p.r = Math.max(50, p.r - (1 + rnd(p.age >= 34 ? 3 : 2)));
      p.cond = 100; p.inj = 0; p.sus = 0; p.yc = 0; p.sg = 0; p.sa = 0; p.apps = 0; p.prog = 0; p.morale = clamp(p.morale + 5, 30, 90);
      if (p.age >= 37 || (p.age >= 35 && chance(.4))) gone.push(p);
    });
    gone.forEach(p => { S.squad = S.squad.filter(x => x !== p); news(T(`👋 ${p.name} futbolu bıraktı.`, `👋 ${p.name} has retired.`)); });
    S.season++; S.year++; syncSavedAges(); S.week = 0; S.results = []; S.table = freshTable(); S.fix = fixtures(S.teams.map(t => t.id).sort(() => Math.random() - .5));
    S.sponsor = null; S.offers = sponsorOffers(); S.pending = null;
    // her sezon 2 altyapı oyuncusu
    for (let i = 0; i < 2 && S.squad.length < MAXSQ; i++) { const y = regen('tr', { age: 17, r: 56 + rnd(8) }); y.youth = true; S.squad.push(y); news(T(`🌱 Altyapıdan A takıma: ${y.name} (${PZ(y.pos)}, potansiyel ${y.pot}).`, `🌱 Academy graduate: ${y.name} (${PZ(y.pos)}, potential ${y.pot}).`), 'good'); }
    autoFixXI(); if (S.xi.filter(Boolean).length < 11) autoXI(); assignNums(); S.benchManual = false; cleanBench();
    news(T(`📅 ${S.season}. sezon başladı (${S.year}/${S.year + 1}). Sponsor tekliflerini incele!`, `📅 Season ${S.season} begins (${S.year}/${S.year + 1}). Review the sponsor offers!`), 'big');
    save();
  }

  /* ---------------- karar kartları ---------------- */
  const EVENTS = [
    { id: 'zam', ok: () => S.squad.some(p => p.r >= 74), mk: () => { const p = S.squad.slice().sort((a, b) => b.r - a.r)[rnd(3)]; return { pid: p.id, t: T(`💰 ${p.name} maaşına zam istiyor`, `💰 ${p.name} wants a pay rise`), d: T(`Yıldız oyuncun menajeri masada. Zam kabul edilmezse oyuncu satış listesine girmek istiyor.`, `Your star's agent is at the table. If you refuse, he wants to be transfer-listed.`), ch: [[T(`Kabul et (−${M(wage(p) * 30)})`, `Accept (−${M(wage(p) * 30)})`), 'zamok'], [T('Reddet', 'Refuse'), 'zamno']] }; } },
    { id: 'teklif', ok: () => S.squad.length > MINSQ + 2, mk: () => { const p = S.squad.slice().sort((a, b) => b.r - a.r)[1 + rnd(5)]; const c = pick(S.teams.filter(t => !t.me)); return { pid: p.id, club: c.id, price: Math.round(value(p) * 1.3 * 10) / 10, t: T(`📩 ${c.name}, ${p.name} için teklif yaptı`, `📩 ${c.name} have bid for ${p.name}`), d: T(`Teklif: ${M(value(p) * 1.3)} (piyasa değeri ${M(value(p))}).`, `Offer: ${M(value(p) * 1.3)} (market value ${M(value(p))}).`), ch: [[T('Sat', 'Sell'), 'bidok'], [T('Satılık değil', 'Not for sale'), 'bidno']] }; } },
    { id: 'taraftar', ok: () => true, mk: () => ({ t: T('📣 Taraftarlar bilet fiyatlarına tepkili', '📣 Fans are unhappy with ticket prices'), d: T('Taraftar grupları indirim istiyor; aksi halde maçları boykot edeceklerini söylüyorlar.', 'Supporter groups want cheaper tickets or they threaten a boycott.'), ch: [[T('5 hafta %20 indirim', '20% off for 5 weeks'), 'fanok'], [T('Fiyatlar aynı kalsın', 'Keep prices'), 'fanno']] }) },
    { id: 'genc', ok: () => S.squad.some(p => p.age <= 21), mk: () => { const p = S.squad.filter(x => x.age <= 21).sort((a, b) => b.pot - a.pot)[0]; return { pid: p.id, t: T(`🌱 ${p.name} forma şansı istiyor`, `🌱 ${p.name} wants a chance`), d: T('Genç oyuncu antrenmanlarda parlıyor ve ilk 11 şansı bekliyor.', 'The youngster is shining in training and wants a start.'), ch: [[T('İlk 11e al', 'Start him'), 'gencok'], [T('Sabırlı olmasını söyle', 'Tell him to be patient'), 'gencno']] }; } },
    { id: 'kavga', ok: () => S.squad.length > 5, mk: () => { const [a, b] = S.squad.slice().sort(() => Math.random() - .5); return { pids: [a.id, b.id], t: T('🥊 Soyunma odasında gerginlik', '🥊 Dressing-room row'), d: T(`${a.name} ile ${b.name} antrenmanda kavga etti.`, `${a.name} and ${b.name} clashed in training.`), ch: [[T('İkisine de para cezası', 'Fine them both'), 'kavgaceza'], [T('Barıştır', 'Make peace'), 'kavgabaris']] }; } },
    { id: 'yatirimci', ok: () => S.pop >= 30, mk: () => ({ t: T('🤝 Yerel iş insanından destek teklifi', '🤝 A local businessman offers support'), d: T('3 M€ destek vermek istiyor; karşılığında yönetimde söz hakkı ve maç günü bilet zammı istiyor.', 'He offers €3M in exchange for a say on the board and a matchday price rise.'), ch: [[T('Kabul et (+3 M€)', 'Accept (+€3M)'), 'yatok'], [T('Reddet', 'Decline'), 'yatno']] }) },
    { id: 'saglik', ok: () => S.squad.filter(p => p.inj > 0).length >= 2, mk: () => ({ t: T('🏥 Sakatlık krizi', '🏥 Injury crisis'), d: T('Sağlık ekibi yoğun bir rehabilitasyon programı öneriyor (0,6 M€).', 'The medical team proposes an intensive rehab programme (€0.6M).'), ch: [[T('Onayla', 'Approve'), 'saglikok'], [T('Gerek yok', 'No need'), 'saglikno']] }) },
    { id: 'basin', ok: () => S.week > 3, mk: () => ({ t: T('🎤 Basın toplantısı', '🎤 Press conference'), d: T('Gazeteciler sezon hedefini soruyor.', 'Journalists ask about your target for the season.'), ch: [[T('“Şampiyon olacağız!”', '“We will win the league!”'), 'basin1'], [T('“Adım adım ilerliyoruz.”', '“One game at a time.”'), 'basin2']] }) }
  ];
  function rollEvent() { if (S.pending || !chance(.24)) return; const pool = EVENTS.filter(e => e.ok()); if (!pool.length) return; const e = pick(pool); S.pending = Object.assign({ kind: 'event', id: e.id }, e.mk()); }
  function resolve(act) {
    const e = S.pending, p = e.pid && P(e.pid); let msg = '';
    if (act === 'zamok' && p) { S.budget -= wage(p) * 30; p.morale = clamp(p.morale + 15, 0, 99); msg = T(`${p.name} ile anlaşıldı, moral yükseldi.`, `Deal agreed with ${p.name}; morale is up.`); }
    if (act === 'zamno' && p) { p.morale = clamp(p.morale - 20, 0, 99); p.listed = true; msg = T(`${p.name} mutsuz ve satış listesine girmek istiyor.`, `${p.name} is unhappy and wants to leave.`); }
    if (act === 'bidok' && p) { sell(p, e.price, e.club); msg = T(`${p.name} ${M(e.price)} karşılığında satıldı.`, `${p.name} sold for ${M(e.price)}.`); }
    if (act === 'bidno' && p) { p.morale = clamp(p.morale - 8, 0, 99); msg = T('Teklif reddedildi.', 'Bid rejected.'); }
    if (act === 'fanok') { S.ticketDisc = 5; S.pop = clamp(S.pop + 5, 0, 100); msg = T('Taraftarlar memnun, popülarite arttı.', 'The fans are happy; popularity rises.'); }
    if (act === 'fanno') { S.pop = clamp(S.pop - 4, 0, 100); msg = T('Tribünlerde tepki var, popülarite düştü.', 'Protests in the stands; popularity falls.'); }
    if (act === 'gencok' && p) { p.morale = clamp(p.morale + 15, 0, 99); p.r = Math.min(p.pot, p.r + 1); const F = FORMATIONS[S.formation]; let i = F.findIndex(([pos]) => pos === p.pos); if (i < 0) i = F.findIndex(([pos]) => ZONE[pos] === ZONE[p.pos]); if (i >= 0 && !S.xi.includes(p.id)) S.xi[i] = p.id; msg = T(`${p.name} ilk 11'de! Motivasyonu tavan.`, `${p.name} starts! His motivation is sky-high.`); }
    if (act === 'gencno' && p) { p.morale = clamp(p.morale - 10, 0, 99); msg = T('Genç oyuncu hayal kırıklığına uğradı.', 'The youngster is disappointed.'); }
    if (act === 'kavgaceza') { e.pids.forEach(id => { const q = P(id); if (q) q.morale = clamp(q.morale - 6, 0, 99); }); S.squad.forEach(q => q.morale = clamp(q.morale + 1, 0, 99)); msg = T('Disiplin sağlandı.', 'Discipline restored.'); }
    if (act === 'kavgabaris') { e.pids.forEach(id => { const q = P(id); if (q) q.morale = clamp(q.morale + 3, 0, 99); }); msg = T('Oyuncular barıştı.', 'The players made up.'); }
    if (act === 'yatok') { S.budget += 3; S.pop = clamp(S.pop - 3, 0, 100); msg = T('3 M€ kasaya girdi.', '€3M added to the budget.'); }
    if (act === 'yatno') { S.pop = clamp(S.pop + 1, 0, 100); msg = T('Taraftarlar kararını alkışladı.', 'The fans applaud your decision.'); }
    if (act === 'saglikok') { S.budget -= .6; S.squad.forEach(q => { if (q.inj > 0) q.inj = Math.max(0, q.inj - 1); }); msg = T('Sakatlık süreleri kısaldı.', 'Injury lay-offs shortened.'); }
    if (act === 'saglikno') msg = T('Program onaylanmadı.', 'Programme rejected.');
    if (act === 'basin1') { const r = sorted().findIndex(t => t.me) + 1; S.squad.forEach(q => q.morale = clamp(q.morale + 4, 0, 99)); S.pop = clamp(S.pop + (r <= 3 ? 4 : -2), 0, 100); msg = T('İddialı açıklama manşetlerde!', 'Bold claim makes the headlines!'); }
    if (act === 'basin2') msg = T('Sakin ve dengeli bir açıklama yaptın.', 'You kept it calm and measured.');
    if (e.kind === 'event') news(e.t + ' — ' + msg);
    S.pending = null; autoFixXI(); save(); render();
  }

  /* ---------------- transfer ---------------- */
  function market() {
    const mine = new Set(S.squad.map(p => p.name)), taken = new Set(S.removed);
    const list = [];
    S.teams.filter(t => !t.me).forEach(t => { const c = CLUB(t.id); if (!c) return; c.players.filter(p => p[3] === 'FC27' && !taken.has(p[0]) && !mine.has(p[0])).forEach(p => list.push({ name: p[0], pos: p[1], r: p[2], club: c.id, cname: c.short || c.name })); (S.added[c.id] || []).forEach(p => { if (!mine.has(p.name)) list.push({ name: p.name, pos: p.pos, r: p.r, club: c.id, cname: c.short || c.name, obj: p }); }); });
    return list.map(x => { const p = x.obj || mkPlayer(x.name, x.pos, x.r); if (x.obj) syncAge(p); return Object.assign(x, { age: p.age, pot: p.pot, price: Math.round(value(p) * 1.15 * 10) / 10 }); });
  }
  function buy(x, deal) {
    deal = deal || { fee: x.price, wage: null, loan: false };
    if (S.squad.length >= MAXSQ) { toast(T(`Kadro dolu (en çok ${MAXSQ})`, `Squad full (max ${MAXSQ})`)); return null; }
    if (S.budget < deal.fee) { toast(T('Bütçe yetersiz', 'Not enough budget')); return null; }
    S.budget -= deal.fee;
    const p = mkPlayer(x.name, x.pos, x.r, Object.assign({ morale: 75 }, x.obj ? { age: x.obj.age, pot: x.obj.pot } : {}));
    syncAge(p);
    if (deal.wage != null) p.wage = deal.wage;
    if (deal.loan) { p.loan = x.club; p.loanOrig = !x.obj; }
    if (x.obj) S.added[x.club] = (S.added[x.club] || []).filter(q => q.name !== x.name); else S.removed.push(x.name);
    S.squad.push(p); assignNums(); cleanBench();
    news(deal.loan ? T(`✍️ ${p.name} sezon sonuna kadar kiralandı (${M(deal.fee)}).`, `✍️ ${p.name} joins on loan until the end of the season (${M(deal.fee)}).`) : T(`✍️ ${p.name} ${M(deal.fee)} bedelle kadroya katıldı.`, `✍️ ${p.name} joins for ${M(deal.fee)}.`), 'good'); save();
    return p;
  }
  const KW = w => Math.round(w * 1000).toLocaleString(T('tr-TR', 'en-GB')) + T(' bin €/hf', 'k €/wk');
  // Gerçekçi pazarlık: bonservis + maaş teklifi ya da kiralama. Kulüp ve oyuncu ayrı ayrı ikna edilir.
  function openDeal(x) {
    if (!UI) return;
    const absW = S.season * WEEKS + S.week;
    if (S.cold[x.name] === absW) return UI.alert(T('Görüşmeler kesildi', 'Talks have broken down'), T(`${x.cname} bu hafta ${x.name} için yeniden masaya oturmuyor. Gelecek hafta tekrar dene.`, `${x.cname} will not reopen talks for ${x.name} this week. Try again next week.`), 'x');
    const tmp = mkPlayer(x.name, x.pos, x.r, x.obj ? { age: x.obj.age, pot: x.obj.pot } : null), val = value(tmp), ask = x.price, w0 = baseWage(tmp), r1 = v => Math.round(v * 10) / 10;
    const seed = hash(x.name + '|' + S.season + '|' + S.week), thr = r1(ask * (.9 + (seed % 19) / 100)); // kulübün kabul eşiği: istenen bedelin %90–108'i
    const wAsk = w0 * (1 + clamp((x.r - rating()) / 40, -.12, .35)) * (S.pop < 40 ? 1.08 : 1);
    const club = CLUB(x.club), clubAvg = club ? avg(clubXI(club).map(p => p.r)) : 70, loanFee = Math.max(.1, r1(val * .12)), loanOk = x.age <= 23 || x.r <= clubAvg - 1, minFee = r1(ask * .6), maxFee = r1(ask * 1.4);
    if (S.budget < Math.min(minFee, loanFee)) return UI.alert(T('Bütçe Yetersiz', 'Insufficient Budget'), T(`${x.name} için en düşük bonservis teklifi ${M(minFee)}, kiralama bedeli ${M(loanFee)}. Kasada ${M(S.budget)} var.`, `The lowest bid for ${x.name} is ${M(minFee)} and a loan costs ${M(loanFee)}. You have ${M(S.budget)}.`), 'cash');
    if (S.squad.length >= MAXSQ) return UI.alert(T('Kadro dolu', 'Squad full'), T(`Kadroda en çok ${MAXSQ} oyuncu olabilir. Önce bir oyuncu sat.`, `You can have at most ${MAXSQ} players. Sell someone first.`));
    let mode = 'buy', fee = clamp(r1(Math.min(ask, S.budget)), minFee, maxFee), wg = w0, round = 0, msg = S.budget < ask ? [T(`Bütçe Yetersiz: istenen bedel ${M(ask)}, kasada ${M(S.budget)}. Daha düşük teklif ya da kiralama deneyebilirsin.`, `Insufficient budget: asking price ${M(ask)}, you have ${M(S.budget)}. Try a lower bid or a loan.`), 'bad'] : null, counter = null;
    const md = UI.modal('', { cls: 'crm-deal', label: T('Transfer görüşmesi', 'Transfer negotiation') });
    const draw = () => {
      const cost = mode === 'loan' ? loanFee : fee;
      md.set(`<div class="cr-deal-head">${jersey(me(), { size: 76, num: '?' })}<div><p class="eyebrow">${T('Transfer görüşmesi', 'Transfer negotiation')} · ${esc(x.cname)}</p><h3>${esc(x.name)}</h3><p class="crm-note">${PZ(x.pos)} · ${x.age} ${T('yaş', 'yrs')} · OVR <b>${x.r}</b> · POT <b>${x.pot}</b> · ${T('Piyasa değeri', 'Value')} <b>${M(val)}</b></p></div></div>
        <div class="cr-deal-modes" role="tablist"><button type="button" data-mode="buy" class="${mode === 'buy' ? 'on' : ''}">${ic('pen')} ${T('Bonservis teklifi', 'Transfer bid')}</button><button type="button" data-mode="loan" class="${mode === 'loan' ? 'on' : ''}">${ic('loan')} ${T('Kiralama (sezon sonuna kadar)', 'Loan (to end of season)')}</button></div>
        ${mode === 'buy' ? `<label class="cr-deal-f"><span>${T('Bonservis teklifin', 'Your bid')} <small>${T('istenen', 'asking')}: ${M(ask)}</small></span><input type="range" data-fee min="${minFee}" max="${maxFee}" step="0.1" value="${fee}"><output>${M(fee)}</output></label>`
          : `<div class="cr-deal-f"><span>${T('Kiralama bedeli', 'Loan fee')} <small>${T('sabit', 'fixed')}</small></span><output>${M(loanFee)}</output></div>`}
        <label class="cr-deal-f"><span>${T('Haftalık maaş teklifin', 'Weekly wage offer')} <small>${T('beklenti yaklaşık', 'expects about')}: ${KW(w0)}</small></span><input type="range" data-wage min="${(w0 * .7).toFixed(4)}" max="${(w0 * 1.9).toFixed(4)}" step="${(w0 / 40).toFixed(5)}" value="${wg}"><output>${KW(wg)}</output></label>
        <div class="cr-deal-sum"><span>${T('İlk ödeme', 'Upfront')} <b>${M(cost)}</b></span><span>${T('Sezonluk maaş', 'Season wages')} <b>${M(wg * WEEKS)}</b></span><span class="${cost > S.budget ? 'bad' : ''}">${T('Kalan bütçe', 'Budget left')} <b>${M(S.budget - cost)}</b></span></div>
        ${msg ? `<p class="cr-deal-msg ${msg[1] || ''}">${esc(msg[0])}</p>` : `<p class="cr-deal-msg">${T('Teklifini ayarla ve gönder. Kulüp bedeli, oyuncu maaşı değerlendirir.', 'Set your offer and submit. The club judges the fee, the player the wage.')}</p>`}
        <div class="crm-row"><button type="button" class="crm-btn ghost" data-crm-x>${T('Vazgeç', 'Walk away')}</button>${counter ? `<button type="button" class="crm-btn alt" data-counter>${T('Karşı teklifi kabul et', 'Accept counter-offer')} · ${M(counter)}</button>` : ''}<button type="button" class="crm-btn" data-send>${T('Teklifi gönder', 'Submit offer')}</button></div>`);
      const q = s => md.el.querySelector(s);
      md.el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; counter = null; msg = null; draw(); });
      const live = () => { const c2 = mode === 'loan' ? loanFee : fee, outs = md.el.querySelectorAll('.cr-deal-f output'), sum = md.el.querySelectorAll('.cr-deal-sum b'); if (mode === 'buy') outs[0].textContent = M(fee); outs[outs.length - 1].textContent = KW(wg); sum[0].textContent = M(c2); sum[1].textContent = M(wg * WEEKS); sum[2].textContent = M(S.budget - c2); sum[2].parentNode.className = c2 > S.budget ? 'bad' : ''; };
      if (q('[data-fee]')) q('[data-fee]').oninput = e => { fee = r1(+e.target.value); counter = null; live(); };
      q('[data-wage]').oninput = e => { wg = +e.target.value; live(); };
      if (q('[data-counter]')) q('[data-counter]').onclick = () => { fee = counter; counter = null; submit(true); };
      q('[data-send]').onclick = () => submit(false);
    };
    const submit = agreedFee => {
      const cost = mode === 'loan' ? loanFee : fee;
      if (cost > S.budget) { msg = [T(`Bütçe Yetersiz: bu teklif ${M(cost)}, kasada ${M(S.budget)} var.`, `Insufficient budget: this offer costs ${M(cost)}, you have ${M(S.budget)}.`), 'bad']; return draw(); }
      round++;
      if (mode === 'loan' && !loanOk) { msg = [T(`${x.cname} ilk 11 oyuncusunu kiralık vermeye sıcak bakmıyor. Bonservis teklifi yap.`, `${x.cname} will not loan out a key player. Make a transfer bid instead.`), 'bad']; return draw(); }
      if (mode === 'buy' && !agreedFee && fee < thr) {
        if (round >= 3) { S.cold[x.name] = absW; save(); md.close(); return UI.alert(T('Görüşmeler kesildi', 'Talks have broken down'), T(`${x.cname} tekliflerini ciddiye almadı ve masadan kalktı.`, `${x.cname} did not take your bids seriously and walked away.`), 'x'); }
        if (fee >= thr * .85) { counter = r1(Math.max(thr, fee * 1.04)); msg = [T(`${x.cname}: “Teklif yetersiz. ${M(counter)} olursa anlaşırız.”`, `${x.cname}: “Not enough. We would accept ${M(counter)}.”`), 'warn']; }
        else msg = [T(`${x.cname} teklifi reddetti: bedel çok düşük. (${3 - round} deneme hakkın kaldı)`, `${x.cname} reject the bid as far too low. (${3 - round} attempts left)`), 'bad'];
        return draw();
      }
      if (wg < wAsk * .97) { msg = [T(`Kulüple anlaşıldı ama ${x.name} haftalık en az ${KW(wAsk)} istiyor.`, `Fee agreed, but ${x.name} wants at least ${KW(wAsk)}.`), 'warn']; if (mode === 'buy') counter = null; return draw(); }
      const p = buy(x, { fee: cost, wage: wg, loan: mode === 'loan' }); if (!p) return;
      md.close(); render(); welcome(p, mode === 'loan');
    };
    draw();
  }
  // "İmza / Hoş Geldin" kartı: oyuncu takım formasıyla kısa bir animasyonla sunulur
  function welcome(p, loan) {
    if (!UI) return;
    const md = UI.modal(`<div class="cr-sign"><p class="cr-sign-tag">${loan ? T('KİRALIK TRANSFER', 'LOAN SIGNING') : T('İMZA ATILDI', 'DEAL SIGNED')}</p><div class="cr-sign-kit">${jersey(me(), { size: 190, num: p.num })}</div><h3>${T('Hoş geldin', 'Welcome')},<br><b>${esc(p.name)}</b></h3><p class="crm-note">${PZ(p.pos)} · OVR ${p.r} · POT ${p.pot} · ${esc(me().name)}</p><svg class="cr-sign-ink" viewBox="0 0 220 40" aria-hidden="true"><path d="M6 28c14-22 22-22 26-6s8 12 16-4 12-10 16 4 10 8 18-6 14-8 20 4 12 6 22-6 16-4 22 6 14 4 24-8 16-2 22 6"/></svg><div class="crm-row"><button type="button" class="crm-btn" data-crm-x>${T('Harika!', 'Great!')}</button></div></div>`, { cls: 'crm-sign', label: T('Hoş geldin', 'Welcome') });
    setTimeout(() => md.close(), 4200);
  }
  function sell(p, price, club) {
    if (S.squad.length <= MINSQ) return toast(T(`Kadroda en az ${MINSQ} oyuncu olmalı`, `You need at least ${MINSQ} players`));
    if (p.loan) return toast(T('Kiralık oyuncu satılamaz', 'A loan player cannot be sold'));
    price = price || Math.round(value(p) * .9 * 10) / 10; club = club || pick(S.teams.filter(t => !t.me)).id;
    S.budget += price; S.squad = S.squad.filter(q => q !== p); S.xi = S.xi.map(id => id === p.id ? null : id); S.bench = (S.bench || []).filter(id => id !== p.id); S.focus = (S.focus || []).filter(id => id !== p.id);
    (S.added[club] = S.added[club] || []).push({ name: p.name, pos: p.pos, r: p.r, age: p.age, pot: p.pot });
    news(T(`💸 ${p.name} ${teamName(club)} kulübüne ${M(price)} bedelle satıldı.`, `💸 ${p.name} sold to ${teamName(club)} for ${M(price)}.`)); autoFixXI(); save();
  }
  const toast = m => { const d = document.createElement('div'); d.className = 'cr-toast'; d.textContent = m; (document.fullscreenElement || document.webkitFullscreenElement || document.querySelector('#draft-section.football-fullscreen-fallback, #career-section.football-fullscreen-fallback') || document.body).appendChild(d); setTimeout(() => d.remove(), 2600); };

  /* ---------------- ekranlar ---------------- */
  const logoOf = (t, px) => t.identity && typeof ClubID !== 'undefined' && ClubID.get() ? ClubID.logo(ClubID.get(), px) : `<span class="cr-crest" style="--a:${t.c1};--b:${t.c2 || '#fff'};width:${px}px;height:${px}px">${esc((t.short || t.name).slice(0, 3))}</span>`;
  const condBar = p => `<i class="cr-cond ${p.cond < 60 ? 'low' : p.cond < 80 ? 'mid' : ''}"><b style="width:${p.cond}%"></b></i>`;
  const badge = p => (p.inj ? `<span class="cr-b inj" title="${T('Sakat', 'Injured')}">🚑 ${p.inj}h</span>` : '') + (p.sus ? `<span class="cr-b sus" title="${T('Cezalı', 'Suspended')}">🟥 ${p.sus}</span>` : '') + (p.yc >= 4 ? `<span class="cr-b">🟨${p.yc}</span>` : '') + (p.listed ? `<span class="cr-b">💼</span>` : '') + (p.loan ? `<span class="cr-b" title="${T('Kiralık', 'On loan')}">${T('KİR', 'LOAN')}</span>` : '') + (S.focus && S.focus.includes(p.id) ? `<span class="cr-b pot" title="${T('Bireysel gelişim odağı', 'Individual focus')}">🎯</span>` : '') + (p.age <= 21 && p.pot - p.r >= 8 ? `<span class="cr-b pot">⭐ ${p.pot}</span>` : '') + (typeof Traits !== 'undefined' ? traitsOf(p).map(t => `<span class="cr-b tr" title="${esc(Traits.LABEL()[t])}">${Traits.ICON[t]}</span>`).join('') : '');

  function startScreen() {
    let ds = null; try { ds = JSON.parse(localStorage.getItem('draft_state')); } catch (e) {}
    const dn = ds ? Object.values(ds.picks || {}).filter(Boolean).length : 0;
    host.innerHTML = `<section id="career-section" class="cr cr-start">
      <p class="eyebrow">BABA. / ${T('Oyunlar', 'Games')} / ${T('Menajerlik Kariyeri', 'Manager Career')}</p>
      <h1 class="display">${T('Menajerlik<br><em>kariyeri.</em>', 'Manager<br><em>career.</em>')}</h1>
      <p class="cr-lead">${T('Draft’tan bağımsız, sezonlar boyu süren bir kariyer: bütçe, transfer, kondisyon, sakatlık, sponsorlar, tesisler, altyapı ve canlı maç müdahalesi.', 'A multi-season career, separate from the Draft: budget, transfers, fitness, injuries, sponsors, facilities, academy and live match control.')}</p>
      <div class="cr-choices">
        <article class="cr-choice"><span class="cr-ico">🏗️</span><h2>${T('Yeni Kariyer Başlat', 'Start a New Career')}</h2><p>${T('Kendi kulübünü kur: başlangıç kadrosu (23 oyuncu) ve 25 M€ bütçe. Ligin en zayıf takımının yerini alırsın.', 'Found your own club: a 23-man starting squad and a €25M budget. You replace the league’s weakest side.')}</p>
          <details class="cr-idwrap"><summary>🛡️ ${T('Kulüp kimliğini ayarla (isim, renk, forma, şehir, logo)', 'Set up your club identity (name, colours, kit, city, crest)')}</summary><div class="cr-idhost"></div></details>
          <button class="pill big" data-s="new">${T('Kulübümü kur', 'Found my club')} →</button></article>
        <article class="cr-choice"><span class="cr-ico">🏟️</span><h2>${T('Mevcut Kulübü Çalıştır', 'Manage an Existing Club')}</h2><p>${T('Süper Lig kulüplerinden birinin başına geç: gerçek kadro, kulübün gücüne göre bütçe.', 'Take charge of a Süper Lig club: real squad, budget by club size.')}</p>
          <select class="cr-clubsel" aria-label="${T('Kulüp seç', 'Choose a club')}">${clubs().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><div class="cr-kitprev" aria-live="polite"></div><button class="pill big" data-s="club">${T('Göreve başla', 'Take the job')} →</button></article>
        <article class="cr-choice ${dn ? '' : 'off'}"><span class="cr-ico">📥</span><h2>${T('Son Draft Kadromu Aktar', 'Import My Last Draft Squad')}</h2><p>${dn ? T(`Draft’ta kurduğun ${dn} kişilik kadro kariyerine taşınır; eksikler altyapıdan tamamlanır. Bütçe 12 M€.`, `Your ${dn}-player Draft squad moves into the career; gaps are filled from the academy. Budget €12M.`) : T('Önce Draft modunda bir kadro kur.', 'Build a squad in Draft mode first.')}</p>
          ${dn ? `<button class="pill big" data-s="draft">${T('Kadromu aktar', 'Import squad')} →</button>` : `<a class="pill big ghost" href="#draft">${T('Draft Moduna git', 'Go to Draft mode')} →</a>`}</article>
      </div></section>`;
    const idh = host.querySelector('.cr-idhost'); if (idh && typeof ClubID !== 'undefined') ClubID.editor(idh);
    // takım seçiminde kulübün 1. ve 2. (deplasman) forması gerçek tasarımıyla gösterilir
    const sel = host.querySelector('.cr-clubsel'), prev = host.querySelector('.cr-kitprev');
    const showKits = () => { const c = CLUB(sel.value); if (c && prev) prev.innerHTML = `<figure>${jersey(c, { size: 96, num: 10, title: c.name + ' — ' + T('iç saha forması', 'home kit') })}<figcaption>${T('1. forma', 'Home')}</figcaption></figure><figure>${jersey(c, { size: 96, num: 10, away: true, title: c.name + ' — ' + T('deplasman forması', 'away kit') })}<figcaption>${T('2. forma', 'Away')}</figcaption></figure><p><b>${esc(c.name)}</b><span>${c.players.filter(p => p[3] === 'FC27').length} ${T('oyuncu', 'players')}</span></p>`; };
    if (sel) { sel.onchange = showKits; showKits(); }
    host.querySelectorAll('.cr-start .cr-ico, .cr-start summary').forEach(el => { el.innerHTML = ICZ(el.innerHTML); });
    host.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const k = b.dataset.s; if (k === 'club') create('club', host.querySelector('.cr-clubsel').value); else create(k === 'draft' ? 'draft' : 'new'); tab = 'center'; render(); window.scrollTo(0, 0); });
  }

  function render(flip) {
    if (!host) return;
    if (!S) return startScreen();
    // FLIP: diziliş değişince formalar yeni koordinatlarına yumuşakça kayar
    const before = flip ? new Map([...host.querySelectorAll('.cr-slot[data-pid]')].filter(el => el.dataset.pid).map(el => [el.dataset.pid, el.getBoundingClientRect()])) : null;
    const m = me(), rank = sorted().findIndex(t => t.me) + 1, tabs = [['center', '🏠 ' + T('Kulüp Merkezi', 'Club Centre')], ['squad', '📋 ' + T('Kadro & Taktik', 'Squad & Tactics')], ['transfer', '💱 ' + T('Transfer Pazarı', 'Transfer Market')], ['league', '🏆 ' + T('Lig & Fikstür', 'League & Fixtures')], ['club', '🏛️ ' + T('Kulüp & Tesis', 'Club & Facilities')]];
    if (m.identity && typeof ClubID !== 'undefined' && ClubID.get()) { const c = ClubID.get(); Object.assign(m, { name: c.name || m.name, short: c.short || ClubID.autoShort(c.name) || m.short, c1: c.c1, c2: c.c2, kit: c.kit }); }
    const body = tab === 'squad' ? squadTab() : tab === 'transfer' ? transferTab() : tab === 'league' ? leagueTab() : tab === 'club' ? clubTab() : centerTab();
    host.innerHTML = ICZ(`<section id="career-section" class="cr">
      <header class="cr-head">${logoOf(m, 58)}<div class="cr-id"><p class="eyebrow">${T('Menajerlik Kariyeri', 'Manager Career')} · ${T('Sezon', 'Season')} ${S.season} (${S.year}/${String(S.year + 1).slice(2)})</p><h1>${esc(m.name)}</h1></div>
        <div class="cr-head-kits" aria-label="${T('Formalar', 'Kits')}"><figure>${jersey(m, { size: 58, title: T('1. forma (iç saha)', 'Home kit') })}<figcaption>${T('1. forma', 'Home')}</figcaption></figure><figure>${jersey(m, { size: 58, away: true, title: T('2. forma (deplasman)', 'Away kit') })}<figcaption>${T('2. forma', 'Away')}</figcaption></figure></div>
        <div class="cr-kpis"><span class="chip">💰 <b>${M(S.budget)}</b></span><span class="chip">📅 ${T('Hafta', 'Week')} <b>${Math.min(S.week + 1, WEEKS)}/${WEEKS}</b></span><span class="chip">🏆 <b>${rank}.</b></span><span class="chip">⭐ <b>${rating()}</b></span></div></header>
      <nav class="cr-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav>
      <div class="cr-body">${body}</div></section>`);
    bind();
    const tb = host.querySelector('.cr-tabs'), on = tb && tb.querySelector('.on'); if (on) tb.scrollLeft = on.offsetLeft - 16;
    if (before && before.size && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      host.querySelectorAll('.cr-slot[data-pid]').forEach(el => { const o = before.get(el.dataset.pid); if (!o) { el.classList.add('pop'); return; } const n = el.getBoundingClientRect(), dx = o.left - n.left, dy = o.top - n.top; if (Math.abs(dx) + Math.abs(dy) < 2) return;
        el.style.transition = 'none'; el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; el.getBoundingClientRect(); el.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)'; el.style.transform = ''; el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true }); });
    }
  }

  function centerTab() {
    const fx = myFixture(S.week), pend = S.pending, rank = sorted().findIndex(t => t.me) + 1;
    const alerts = []; const F = FORMATIONS[S.formation];
    S.xi.forEach((id, i) => { const p = P(id); if (!p) alerts.push(T(`${PZ(F[i][0])} mevkisi boş`, `${PZ(F[i][0])} slot is empty`)); else if (p.cond < 65) alerts.push(T(`${p.name} yorgun (%${Math.round(p.cond)}) — sakatlık riski yüksek`, `${p.name} is tired (${Math.round(p.cond)}%) — high injury risk`)); });
    let card = '';
    if (pend && pend.kind === 'season') card = `<article class="cr-card big ${pend.champ ? 'gold' : ''}"><p class="eyebrow">${T('Sezon sonu', 'End of season')}</p><h2>${pend.champ ? '🏆 ' + T('ŞAMPİYON!', 'CHAMPIONS!') : T(`${pend.rank}. sıra`, `Finished ${pend.rank}th`)}</h2><p>${T(`Ödül: ${M(pend.prize)} · Gol kralımız: ${esc(pend.top)} (${pend.topg})`, `Prize: ${M(pend.prize)} · Top scorer: ${esc(pend.top)} (${pend.topg})`)}</p><p class="muted">${T('Yeni sezonda gençler gelişir, 32 yaş üstü oyuncular düşüşe geçer, altyapıdan 2 oyuncu gelir.', 'Next season the youngsters improve, over-32s decline, and 2 academy players join.')}</p><button class="pill big" data-a="newseason">${T('Yeni sezona başla', 'Start the new season')} →</button></article>`;
    else if (!S.sponsor && S.offers) card = `<article class="cr-card big"><p class="eyebrow">${T('Sezon başı', 'Pre-season')} · ${T('Sponsorluk', 'Sponsorship')}</p><h2>${T('Forma sponsorunu seç', 'Pick your shirt sponsor')}</h2><div class="cr-offers">${S.offers.map((o, i) => `<button data-sp="${i}"><b>${esc(o.name)}</b><span>${T('Peşin', 'Upfront')}: <strong>${M(o.up)}</strong></span><span>${T('Galibiyet primi', 'Win bonus')}: ${o.win ? M(o.win) : '—'}</span><span>${T('Şampiyonluk primi', 'Title bonus')}: ${o.title ? M(o.title) : '—'}</span><small>${esc(o.desc)}</small></button>`).join('')}</div></article>`;
    else if (pend && pend.kind === 'event') card = `<article class="cr-card big event"><p class="eyebrow">${T('Karar zamanı', 'Decision time')}</p><h2>${esc(pend.t)}</h2><p>${esc(pend.d)}</p><div class="cr-row">${pend.ch.map(([l, a]) => `<button class="pill ${a.endsWith('ok') || a === 'basin1' || a === 'kavgaceza' ? '' : 'ghost'}" data-ev="${a}">${esc(l)}</button>`).join('')}</div></article>`;
    const opAD = fx ? oppAD(fx.opp) : null, mAD = myAD(S.xi);
    const last = S.matchLog;
    const clubColor = /^#[0-9a-fA-F]{3,8}$/.test(me().c1 || '') ? me().c1 : '#59e13b';
    const featured = S.squad.filter(p => Number.isFinite(p.r)).slice().sort((a,b) => b.r - a.r).slice(0,3);
    const myForm = (S.table[me().id] && Array.isArray(S.table[me().id].form)) ? S.table[me().id].form.slice(-5) : [];
    const showcase = `<section class="cr-team-spotlight" style="--team-accent:${clubColor}" aria-label="${T('Kulüp vitrini','Club showcase')}">
      <div class="cr-spotlight-copy">
        <p class="cr-spotlight-kicker">BABA. / ${T('KULÜP MERKEZİ','CLUB CENTRE')} · ${S.year}/${String(S.year+1).slice(-2)}</p>
        <div class="cr-spotlight-identity">${logoOf(me(),76)}<div><small>${T('TAKIMININ HİKÂYESİNİ YAZ','WRITE YOUR CLUB STORY')}</small><h2>${esc(me().name)}</h2><p>${T('Her hafta yeni bir karar. Her maç yeni bir mücadele.','A new decision each week. A new challenge every match.')}</p></div></div>
        <div class="cr-spotlight-metrics"><div><span>${T('LİG SIRASI','LEAGUE RANK')}</span><strong>#${rank}</strong></div><div><span>${T('TAKIM GÜCÜ','TEAM RATING')}</span><strong>${rating()}</strong></div><div><span>${T('SEZON','SEASON')}</span><strong>${S.season}</strong></div></div>
        <div class="cr-spotlight-actions"><button type="button" class="pill" data-spotlight-tab="squad">${T('Kadroyu yönet','Manage squad')} →</button><button type="button" class="pill ghost" data-spotlight-tab="league">${T('Puan durumu','Standings')}</button></div>
      </div>
      <div class="cr-spotlight-side"><p class="cr-spotlight-kicker">${T('ÖNE ÇIKAN OYUNCULAR','KEY PLAYERS')}</p>
        <div class="cr-spotlight-players">${featured.map((p,i)=>`<div class="cr-featured-player"><div class="cr-featured-kit" aria-hidden="true">${jersey(me(), { size: 46, num: p.num })}</div><div class="cr-featured-info"><b>${esc(p.name)}</b><small>${PZ(p.pos)} · ${p.age} ${T('yaş','yrs')}</small></div><strong>${p.r}</strong></div>`).join('')}</div>
        <div class="cr-spotlight-form"><span>${T('SON MAÇLAR','RECENT FORM')}</span><div>${myForm.length?myForm.map(x=>`<i class="${x}">${x}</i>`).join(''):'<small>—</small>'}</div></div>
      </div></section>`;
    return showcase + `<div class="cr-grid2">
      <div>${card}
        ${fx && !pend && S.sponsor ? `<article class="cr-card next"><p class="eyebrow">${T('Sıradaki maç', 'Next match')} · ${T('Hafta', 'Week')} ${S.week + 1} · ${fx.home ? T('İç saha', 'Home') : T('Deplasman', 'Away')}</p>
          <div class="cr-vs"><div>${jersey(me(), { size: 62 })}<b>${esc(me().short)}</b><small>${Math.round((mAD.att + mAD.def) / 2)}</small></div><span>vs</span><div>${jersey(fx.opp, { size: 62, away: cdist(KIT(me()).c1, KIT(fx.opp).c1) < 110 })}<b>${esc(fx.opp.short || fx.opp.name)}</b><small>${Math.round((opAD.att + opAD.def) / 2)}</small></div></div>
          <p class="muted">${esc(fx.opp.name)} · ${T('Tablo', 'Table')}: ${sorted().findIndex(t => t.id === fx.opp.id) + 1}. · ${T('Form', 'Form')}: ${S.table[fx.opp.id].form.join(' ') || '—'}</p>
          ${alerts.length ? `<ul class="cr-alerts">${alerts.slice(0, 4).map(a => `<li>⚠️ ${esc(a)}</li>`).join('')}</ul>` : ''}
          <div class="cr-row"><button class="pill big" data-a="live">⚽ ${T('Maça çık (canlı)', 'Play live')}</button><button class="pill ghost" data-a="quick">⏩ ${T('Haftayı simüle et', 'Simulate week')}</button><button class="pill ghost" data-tab="squad">📋 ${T('Kadroyu düzenle', 'Edit squad')}</button></div></article>` : ''}
        ${last ? `<article class="cr-card"><p class="eyebrow">${T('Son maç', 'Last match')} · ${T('Hafta', 'Week')} ${last.week + 1}</p><h3>${esc(teamName(last.res.h))} ${last.res.gh}–${last.res.ga} ${esc(teamName(last.res.a))}</h3><div class="cr-mini-feed">${last.lines.filter(l => /goal|conc|red|inj/.test(l.cls || '')).slice(0, 6).map(l => `<p class="${l.cls}">${esc(l.txt)}</p>`).join('') || `<p class="muted">${T('Golsüz ve sakin bir maç.', 'A quiet, goalless game.')}</p>`}</div>${last.report ? `<button class="pill sm ghost" data-a="report">📊 ${T('Maç raporunu aç', 'Open match report')}</button>` : ''}</article>` : ''}
      </div>
      <div>
        ${trainCard()}
        <article class="cr-card"><p class="eyebrow">${T('Kulüp özeti', 'Club summary')}</p><div class="cr-stats"><div><small>${T('Bütçe', 'Budget')}</small><b>${M(S.budget)}</b></div><div><small>${T('Takım reytingi', 'Team rating')}</small><b>${rating()}</b></div><div><small>${T('Lig sırası', 'League position')}</small><b>${rank}.</b></div><div><small>${T('Popülarite', 'Popularity')}</small><b>${Math.round(S.pop)}</b></div><div><small>${T('Kadro', 'Squad')}</small><b>${S.squad.length}</b></div><div><small>${T('Haftalık maaş', 'Weekly wages')}</small><b>${M(S.squad.reduce((a, p) => a + wage(p), 0))}</b></div></div>
          ${S.sponsor ? `<p class="muted sm">${T('Sponsor', 'Sponsor')}: <b>${esc(S.sponsor.name)}</b></p>` : ''}</article>
        <article class="cr-card"><p class="eyebrow">${T('Haberler', 'News')}</p><ul class="cr-news">${S.news.slice(0, 10).map(n => `<li class="${n.k}"><small>S${n.s} · ${T('H', 'W')}${Math.min(n.w + 1, WEEKS)}</small>${esc(n.t)}</li>`).join('')}</ul></article>
      </div></div>`;
  }

  // Haftalık antrenman, taktik uyumu ve bireysel gelişim odağı
  function trainCard() {
    const TR = TRAIN(), fam = Math.round(famNow()), young = S.squad.filter(p => p.age <= 23 && p.r < p.pot).sort((a, b) => (S.focus.includes(b.id) - S.focus.includes(a.id)) || (b.pot - b.r) - (a.pot - a.r) || b.pot - a.pot).slice(0, 6);
    return `<article class="cr-card cr-train"><p class="eyebrow">${ic('train')} ${T('Haftalık antrenman', 'Weekly training')}</p>
      <div class="cr-train-opts" role="radiogroup" aria-label="${T('Takım antrenmanı', 'Team training')}">${Object.entries(TR).map(([k, v]) => `<button type="button" role="radio" aria-checked="${S.training === k}" data-train="${k}" class="${S.training === k ? 'on' : ''}">${ic(v[1])}<b>${v[0]}</b></button>`).join('')}</div>
      <p class="muted sm">${TR[S.training][2]}</p>
      <div class="cr-fam" title="${T('Aynı diziliş ve hücum planıyla oynadıkça artar; değiştirince düşer', 'Rises while you keep the same shape and plan; drops when you change')}"><span>${T('Taktik uyumu', 'Tactical familiarity')}</span><i><b style="width:${fam}%"></b></i><strong>%${fam}</strong></div>
      <p class="eyebrow" style="margin-top:14px">${ic('target')} ${T('Bireysel gelişim odağı', 'Individual focus')} <small>(${S.focus.length}/2)</small></p>
      ${young.length ? `<div class="cr-focus">${young.map(p => `<button type="button" data-focus="${p.id}" class="${S.focus.includes(p.id) ? 'on' : ''}" aria-pressed="${S.focus.includes(p.id)}"><span class="pz">${PZ(p.pos)}</span><b>${esc(p.name)}</b><em>${p.age} · ${p.r}→${p.pot}</em></button>`).join('')}</div><p class="muted sm">${T('Seçilen 1–2 genç oyuncu, maç oynamasa bile her hafta ek gelişim kazanır.', 'The 1–2 chosen youngsters gain extra development every week, even without playing.')}</p>` : `<p class="muted sm">${T('Kadroda gelişime açık 23 yaş altı oyuncu yok.', 'No under-23 players with room to grow.')}</p>`}</article>`;
  }

  function squadTab() {
    const F = FORMATIONS[S.formation], R = ROLES(), xiSet = new Set(S.xi), benchSet = new Set(S.bench);
    const others = S.squad.filter(p => !xiSet.has(p.id)).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.r - a.r);
    const benchPl = others.filter(p => benchSet.has(p.id)), outPl = others.filter(p => !benchSet.has(p.id));
    const sel = selSlot != null ? F[selSlot] : null;
    const rowOf = p => { const pen = sel ? fit(p, sel[0]) : 0, onB = benchSet.has(p.id); return `<div class="cr-plrow"><button class="cr-pl ${!avail(p) ? 'na' : ''} ${sel && avail(p) && pen === 0 ? 'fit' : ''}" data-pick="${p.id}" ${sel && avail(p) ? '' : sel ? 'disabled' : ''}><span class="pz">${PZ(p.pos)}</span><b><i class="cr-num">${p.num || ''}</i>${esc(p.name)}</b>${badge(p)}<em>${p.r}${sel && pen ? `<small>${pen}</small>` : ''}</em>${condBar(p)}</button><button type="button" class="cr-bt ${onB ? 'on' : ''}" data-bench="${p.id}" aria-pressed="${onB}" title="${onB ? T('Yedek kulübesinden çıkar', 'Remove from bench') : T('Yedek kulübesine al', 'Add to bench')}" ${!avail(p) && !onB ? 'disabled' : ''}>${ic('bench')}</button></div>`; };
    return `<div class="cr-row wrap"><div class="cr-seg">${Object.keys(FORMATIONS).map(f => `<button data-f="${f}" class="${S.formation === f ? 'on' : ''}">${f}</button>`).join('')}</div>
        <div class="cr-seg" aria-label="${T('Mentalite', 'Mentality')}">${Object.entries(MENT()).map(([k, v]) => `<button data-ment="${k}" class="${S.ment === k ? 'on' : ''}">${v[0]}</button>`).join('')}</div><button class="pill sm" data-a="auto">✨ ${T('Otomatik en iyi 11', 'Auto-pick best XI')}</button></div>
      <div class="cr-row wrap"><span class="eyebrow" style="margin:0">📋 ${T('Hücum planı', 'Attacking plan')}</span><div class="cr-seg">${Object.entries(PLANS()).map(([k, v]) => `<button data-plan="${k}" class="${(S.style || 'dengeli') === k ? 'on' : ''}">${v}</button>`).join('')}</div><small class="muted">${(() => { const pm = planMod(S.style || 'dengeli', S.xi); return pm.me >= 1.06 ? T('Kadroya çok uygun', 'Great fit for the squad') : pm.me < .97 ? T('Kadro bu plana uygun değil', 'Squad doesn’t suit it') : T('Uyum: normal', 'Fit: normal'); })()} · ${T('Taktik uyumu', 'Familiarity')} %${Math.round(famNow())}</small></div>
      <p class="muted sm">${T('Sahadan bir formaya dokun, sonra listeden oyuncu seç. Kulübe simgesiyle 9 kişilik maç günü yedeklerini belirle. Yorgun (%60 altı) oyuncuların sakatlanma riski yüksektir.', 'Tap a shirt on the pitch, then pick a player from the list. Use the bench icon to choose your 9 matchday subs. Tired players (under 60%) are injury-prone.')}</p>
      <div class="cr-squad">
        <div class="cr-pitch kits">${F.map(([pos, x, y], i) => { const p = P(S.xi[i]); const pen = p ? fit(p, pos) : 0;
          return `<button class="cr-slot kit ${selSlot === i ? 'sel' : ''} ${!p ? 'empty' : ''} ${pen < -4 ? 'bad' : pen < 0 ? 'meh' : ''}" style="left:${x}%;top:${y}%" data-slot="${i}" data-pid="${p ? p.id : ''}" aria-label="${PZ(pos)}${p ? ': ' + esc(p.name) + ' #' + (p.num || '') : ''}">${p ? jersey(me(), { num: p.num, size: 56 }) : `<span class="cr-slot-ghost">${ic('shirt')}</span>`}<b>${p ? esc(p.name.split(' ').slice(-1)[0]) : '—'}</b><span class="cr-slot-meta"><i class="pz">${PZ(pos)}</i>${p ? `<em>${p.r}</em>` : ''}</span>${p ? condBar(p) : ''}</button>`; }).join('')}</div>
        <div class="cr-side">
          ${sel ? (() => { const p = P(S.xi[selSlot]); const roles = R[sel[0]] || []; return `<div class="cr-card sm"><p class="eyebrow">${T('Seçili mevki', 'Selected slot')}: ${PZ(sel[0])}</p>${p ? `<h3>${p.num ? '#' + p.num + ' ' : ''}${esc(p.name)} <small>${p.r} · ${p.age} ${T('yaş', 'yrs')}</small></h3>` : ''}<label class="cr-lbl">${T('Rol', 'Role')}<select data-role="${selSlot}">${roles.map(([k, l]) => `<option value="${k}" ${(S.roles[selSlot] || roles[0][0]) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${p ? `<button class="pill sm ghost" data-a="bench">${T('İlk 11’den çıkar', 'Drop from XI')}</button>` : ''}</div>`; })() : ''}
          <div class="cr-list-head"><p class="eyebrow">${ic('bench')} ${T('Maç günü yedek kulübesi', 'Matchday bench')} <b class="${benchPl.length === BENCH ? 'full' : ''}">${benchPl.length}/${BENCH}</b></p><button class="pill sm ghost" data-a="autobench">${T('Otomatik seç', 'Auto-pick')}</button></div>
          <div class="cr-list bench">${benchPl.map(rowOf).join('') || `<p class="muted sm">${T('Kulübe boş. Aşağıdaki oyunculardan seç.', 'The bench is empty. Pick from the players below.')}</p>`}</div>
          <p class="eyebrow">${T('Kadro dışı', 'Not in the matchday squad')} (${outPl.length})</p>
          <div class="cr-list">${outPl.map(rowOf).join('') || `<p class="muted sm">—</p>`}</div>
        </div></div>`;
  }

  function transferTab() {
    const all = market().filter(x => (!mFilter.pos || x.pos === mFilter.pos) && (mFilter.max <= 0 || x.price <= mFilter.max) && (!mFilter.q || x.name.toLocaleLowerCase('tr-TR').includes(mFilter.q.toLocaleLowerCase('tr-TR')))).sort((a, b) => b.r - a.r).slice(0, 60);
    const absW = S.season * WEEKS + S.week;
    return `<div class="cr-grid2"><div><article class="cr-card"><p class="eyebrow">${T('Oyuncu ara', 'Search players')} · ${T('Bütçe', 'Budget')}: <b>${M(S.budget)}</b></p>
        <div class="cr-filters"><input data-mf="q" placeholder="${T('İsim ara…', 'Search name…')}" value="${esc(mFilter.q)}"><select data-mf="pos"><option value="">${T('Tüm mevkiler', 'All positions')}</option>${POS.map(p => `<option value="${p}" ${mFilter.pos === p ? 'selected' : ''}>${PZ(p)}</option>`).join('')}</select>
          <select data-mf="max"><option value="0">${T('Fiyat sınırı yok', 'No price limit')}</option>${[1, 3, 5, 10, 20].map(v => `<option value="${v}" ${mFilter.max === v ? 'selected' : ''}>≤ ${v} M€</option>`).join('')}<option value="-1" ${mFilter.max === -1 ? 'selected' : ''}>${T('Bütçeme uyanlar', 'Within my budget')}</option></select></div>
        <div class="cr-table-wrap"><table class="cr-table"><thead><tr><th>${T('Oyuncu', 'Player')}</th><th>${T('Mvk', 'Pos')}</th><th>${T('Yaş', 'Age')}</th><th>OVR</th><th>POT</th><th>${T('Kulüp', 'Club')}</th><th>${T('Fiyat', 'Price')}</th><th></th></tr></thead><tbody>
        ${all.filter(x => mFilter.max !== -1 || x.price <= S.budget).map(x => `<tr class="${x.price > S.budget ? 'poor' : ''}"><td><b>${esc(x.name)}</b></td><td>${PZ(x.pos)}</td><td>${x.age}</td><td><b>${x.r}</b></td><td>${x.pot}</td><td>${esc(x.cname)}</td><td>${M(x.price)}</td><td><button class="pill sm ${x.price > S.budget ? 'ghost' : ''}" data-buy="${esc(x.club)}|${esc(x.name)}" ${S.cold[x.name] === absW ? 'disabled' : ''}>${T('Al', 'Buy')}</button></td></tr>`).join('')}</tbody></table></div>
        <p class="muted sm">${T('“Al” bir pazarlık masası açar: bonservis ve maaş teklifi ya da sezonluk kiralama. Bütçeni aşan oyuncularda net uyarı görürsün.', '“Buy” opens negotiations: transfer fee and wage offer, or a season loan. You get a clear warning when a player is beyond your budget.')}</p></article>
        ${S.scouted.length ? `<article class="cr-card"><p class="eyebrow">🔭 ${T('Scout raporu', 'Scout report')} (${S.scouted.length})</p>${S.scouted.map((p, i) => `<div class="cr-scout"><b>${esc(p.name)}</b><span>${PZ(p.pos)} · ${p.age} ${T('yaş', 'yrs')} · OVR ${p.r} · POT <strong>${p.pot}</strong>${p.from && REG()[p.from] ? ' · ' + REG()[p.from].n : ''}${p.exp != null ? ` · <i class="cr-exp">${Math.max(1, p.exp - absW)} ${T('hafta kaldı', 'wk left')}</i>` : ''}</span><button class="pill sm ${scoutFee(p) > S.budget ? 'ghost' : ''}" data-sign="${i}">${T('İmzala', 'Sign')} (${M(scoutFee(p))})</button></div>`).join('')}<p class="muted sm">${T('İmzalanmayan gençler 9 hafta boyunca raporda kalır; yeni rapor eskisini silmez.', 'Unsigned youngsters stay on the report for 9 weeks; a new report never wipes the old one.')}</p></article>` : ''}</div>
      <div><article class="cr-card"><p class="eyebrow">${T('Kadromdan sat', 'Sell from my squad')}</p><div class="cr-sell">${S.squad.slice().sort((a, b) => b.r - a.r).map(p => `<div class="cr-sell-row"><div class="cr-sell-id"><b>${esc(p.name)}</b><small>${PZ(p.pos)} · ${p.age} ${T('yaş', 'yrs')} · OVR ${p.r}${p.loan ? ' · ' + T('kiralık', 'on loan') : ''}${p.inj ? ' · ' + T('sakat', 'injured') : ''}</small></div><span class="cr-sell-price">${p.loan ? '—' : M(value(p) * .9)}</span><button class="pill sm ghost" data-sell="${p.id}" ${p.loan ? 'disabled' : ''}>${T('Sat', 'Sell')}</button></div>`).join('')}</div></article></div></div>`;
  }

  function leagueTab() {
    const w = fxWeek == null ? Math.min(S.week, WEEKS - 1) : fxWeek, res = S.results[w];
    const lg = Object.entries(S.lg || {}).map(([name, v]) => ({ name, g: v.g, a: v.a, t: S.teams.find(t => t.id === v.c) })).filter(x => x.t);
    const kingRow = (x, i, k) => `<li class="${x.t.me ? 'me' : ''}"><i>${i + 1}</i>${jersey(x.t, { size: 20 })}<b>${esc(x.name)}</b><small>${esc(x.t.short || x.t.name)}</small><strong>${x[k]}</strong></li>`;
    const goals = lg.filter(x => x.g).sort((a, b) => b.g - a.g || b.a - a.a).slice(0, 10), assists = lg.filter(x => x.a).sort((a, b) => b.a - a.a || b.g - a.g).slice(0, 10);
    return `<div class="cr-grid2"><div><article class="cr-card"><p class="eyebrow">${T('Puan durumu', 'League table')}</p><div class="cr-table-wrap"><table class="cr-table league"><thead><tr><th>#</th><th>${T('Takım', 'Team')}</th><th title="${T('Oynanan maç', 'Played')}">O</th><th title="${T('Galibiyet', 'Won')}">G</th><th title="${T('Beraberlik', 'Drawn')}">B</th><th title="${T('Mağlubiyet', 'Lost')}">M</th><th title="${T('Atılan gol', 'Goals for')}">${T('AG', 'GF')}</th><th title="${T('Yenilen gol', 'Goals against')}">${T('YG', 'GA')}</th><th title="${T('Averaj', 'Goal difference')}">${T('AV', 'GD')}</th><th title="${T('Puan', 'Points')}">P</th><th>${T('Form', 'Form')}</th></tr></thead><tbody>
      ${sorted().map((t, i) => { const r = S.table[t.id], gd = r.gf - r.ga; return `<tr class="${t.me ? 'me' : ''} ${i < 2 ? 'cl' : i >= 15 ? 'rel' : ''}"><td>${i + 1}</td><td class="tm">${jersey(t, { size: 18 })}${esc(t.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${gd > 0 ? '+' : ''}${gd}</td><td><b>${r.pts}</b></td><td class="form">${r.form.map(f => `<i class="${f}">${f}</i>`).join('')}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="muted sm">${ic('sqb')} ${T('İlk 2: Avrupa', 'Top 2: Europe')} · ${ic('rc')} ${T('Son 3: küme düşme hattı', 'Bottom 3: relegation zone')} · AG: ${T('atılan gol', 'goals for')} · YG: ${T('yenilen gol', 'goals against')}</p></article>
      <div class="cr-kings"><article class="cr-card"><p class="eyebrow">${ic('ball')} ${T('Gol krallığı', 'Top scorers')} · ${T('tüm lig', 'whole league')}</p><ol class="cr-king">${goals.map((x, i) => kingRow(x, i, 'g')).join('') || `<li class="muted">${T('Henüz gol yok', 'No goals yet')}</li>`}</ol></article>
        <article class="cr-card"><p class="eyebrow">${ic('assist')} ${T('Asist krallığı', 'Top assists')} · ${T('tüm lig', 'whole league')}</p><ol class="cr-king">${assists.map((x, i) => kingRow(x, i, 'a')).join('') || `<li class="muted">${T('Henüz asist yok', 'No assists yet')}</li>`}</ol></article></div></div>
      <div><article class="cr-card"><p class="eyebrow">${T('Fikstür', 'Fixtures')}</p><div class="cr-row"><button class="pill sm ghost" data-fw="-1" ${w <= 0 ? 'disabled' : ''} aria-label="${T('Önceki hafta', 'Previous week')}">←</button><b>${T('Hafta', 'Week')} ${w + 1}</b><button class="pill sm ghost" data-fw="1" ${w >= WEEKS - 1 ? 'disabled' : ''} aria-label="${T('Sonraki hafta', 'Next week')}">→</button></div>
        <ul class="cr-fix">${S.fix[w].map(([h, a], i) => { const r = res && res[i]; const mine = h === me().id || a === me().id; return `<li class="${mine ? 'me' : ''}"><span>${esc(teamName(h))}</span><b>${r ? r.gh + ' – ' + r.ga : '–'}</b><span>${esc(teamName(a))}</span></li>`; }).join('')}</ul></article>
        <article class="cr-card"><p class="eyebrow">${T('Takımımızın golcüleri', 'Our scorers')}</p><ol class="cr-scorers">${S.squad.filter(p => p.sg || p.sa).sort((a, b) => b.sg - a.sg || b.sa - a.sa).slice(0, 8).map(p => `<li><b>${esc(p.name)}</b><span class="cr-ga"><i>${ic('ball')}${p.sg}</i><i>${ic('assist')}${p.sa}</i></span></li>`).join('') || `<li class="muted">${T('Henüz gol yok', 'No goals yet')}</li>`}</ol></article>
        ${S.history.length ? `<article class="cr-card"><p class="eyebrow">${T('Geçmiş sezonlar', 'Past seasons')}</p><ul class="cr-news">${S.history.map(h => `<li>${h.champ ? '🏆' : ''} ${T('Sezon', 'Season')} ${h.season} (${h.year}) · ${h.rank}. · ${h.pts} ${T('puan', 'pts')} · ${esc(h.top)}</li>`).join('')}</ul></article>` : ''}</div></div>`;
  }

  function clubTab() {
    const fin = S.fin, Fc = FAC(), slots = scoutSlots(), busy = (S.scouts || []).map(s => s.region), free = slots - busy.length;
    return `<div class="cr-grid2"><div>
      <article class="cr-card"><p class="eyebrow">${T('Tesis yatırımları', 'Facilities')}</p><div class="cr-facs">${Object.entries(Fc).map(([k, [n, e, d]]) => `<div class="cr-fac"><span>${ic(e)}</span><div><b>${n} · ${T('Seviye', 'Level')} ${S.fac[k]}/5</b><small>${d}</small><i class="cr-lv"><b style="width:${S.fac[k] * 20}%"></b></i></div>${S.fac[k] < 5 ? `<button class="pill sm ${S.budget < facCost(k) ? 'ghost' : ''}" data-fac="${k}">${T('Geliştir', 'Upgrade')} · ${M(facCost(k))}</button>` : `<span class="chip">MAX</span>`}</div>`).join('')}</div>
        <p class="muted sm">${T('Stadyum kapasitesi', 'Stadium capacity')}: <b>${capacity().toLocaleString(T('tr-TR', 'en-GB'))}</b></p></article>
      <article class="cr-card"><p class="eyebrow">🔭 ${T('Scout ve altyapı', 'Scouting and academy')} · ${T('gözlemci', 'scouts')} ${busy.length}/${slots}</p>
        ${(S.scouts || []).map(s => `<p class="cr-scouting">${ic('scope')} ${T(`${REG()[s.region].n}: gözlemci çalışıyor, ${s.left} hafta kaldı.`, `${REG()[s.region].n}: scout at work, ${s.left} weeks left.`)}</p>`).join('')}
        <p class="muted sm">${free > 0 ? T('Gözlemci gönder; 3 hafta sonra 3 genç yetenek bulur. Scout ağını geliştirerek aynı anda daha fazla bölge taranır.', 'Send a scout; in 3 weeks they find 3 young talents. Upgrade the scouting network to cover more regions at once.') : T('Tüm gözlemciler görevde. Daha fazla bölge için Scout ağını geliştir.', 'All scouts are busy. Upgrade the scouting network for more regions.')}</p>
        <div class="cr-row wrap">${Object.entries(REG()).map(([k, r]) => `<button class="pill sm ghost" data-scout="${k}" ${busy.includes(k) || free <= 0 ? 'disabled' : ''}>${r.n} · ${M(r.cost)}</button>`).join('')}</div></article>
      </div><div>
      <article class="cr-card"><p class="eyebrow">${T('Finans', 'Finances')} · ${T('geçen hafta', 'last week')}</p>${fin ? `<table class="cr-table"><tbody><tr><td>🎟️ ${T('Bilet', 'Tickets')}</td><td>+${M(fin.gate)}</td></tr><tr><td>👕 ${T('Forma ve ürün', 'Merchandise')}</td><td>+${M(fin.merch)}</td></tr><tr><td>🤝 ${T('Sponsor primi', 'Sponsor bonus')}</td><td>+${M(fin.spon)}</td></tr><tr><td>💼 ${T('Maaşlar', 'Wages')}</td><td>−${M(fin.wages)}</td></tr><tr><td>🔧 ${T('Diğer giderler', 'Other costs')}</td><td>−${M(fin.other)}</td></tr></tbody></table>` : `<p class="muted sm">${T('İlk maçtan sonra görünür.', 'Shown after the first match.')}</p>`}
        <p class="muted sm">${T('Popülarite bilet ve forma gelirini artırır; galibiyetler ve kupalar popülariteyi yükseltir.', 'Popularity drives ticket and merchandise income; wins and trophies raise it.')}</p></article>
      ${me().identity ? `<details class="cr-card cr-idwrap"><summary>🛡️ ${T('Kulüp kimliğini düzenle', 'Edit club identity')}</summary><div class="cr-idhost"></div></details>` : ''}
      <article class="cr-card"><p class="eyebrow">${T('Kariyer', 'Career')}</p><div class="cr-row wrap"><a class="pill sm ghost" href="#draft">⚽ ${T('Draft Moduna geç', 'Switch to Draft mode')}</a><button class="pill sm ghost" data-a="reset">🗑️ ${T('Kariyeri sil', 'Delete career')}</button></div></article>
      </div></div>`;
  }

  function bind() {
    const $ = s => host.querySelectorAll(s);
    const ask = (title, text, yes, danger) => UI ? UI.confirm(title, text, yes, null, danger) : Promise.resolve(true);
    const poor = (need, what) => UI ? UI.alert(T('Bütçe Yetersiz', 'Insufficient Budget'), T(`${what} için ${M(need)} gerekiyor; kasada ${M(S.budget)} var.`, `${what} costs ${M(need)}; you have ${M(S.budget)}.`), 'cash') : toast(T('Bütçe yetersiz', 'Not enough budget'));
    // sekme değişince sayfa en üste kayar; yapışkan sekme çubuğu başlıkları örtmez
    const go = k => { tab = k; selSlot = null; render(); scrollTop(); };
    $('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
    $('[data-spotlight-tab]').forEach(b => b.onclick = () => go(b.dataset.spotlightTab));
    $('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'live') { if (S.xi.filter(Boolean).length < 11) return toast(T('İlk 11 eksik', 'Your XI is incomplete')); cleanBench(); liveMatch(); }
      if (a === 'quick') { if (S.xi.filter(Boolean).length < 11) autoFixXI(); rotate(); cleanBench(); liveMatch(null, true); render(); scrollTop(); openReport(S.matchLog); }
      if (a === 'report') openReport(S.matchLog);
      if (a === 'newseason') { newSeason(); render(); }
      if (a === 'auto') { autoXI(); cleanBench(); save(); render(true); }
      if (a === 'autobench') { S.benchManual = false; autoBench(); save(); render(); }
      if (a === 'bench' && selSlot != null) { S.xi[selSlot] = null; save(); render(); }
      if (a === 'reset') ask(T('Kariyer silinsin mi?', 'Delete this career?'), T('Kayıt kalıcı olarak silinir; bu işlem geri alınamaz.', 'The save is permanently deleted; this cannot be undone.'), T('Kariyeri sil', 'Delete career'), true).then(ok => { if (ok) { localStorage.removeItem(KEY); S = null; render(); } });
    });
    $('[data-sp]').forEach(b => b.onclick = () => { const o = S.offers[+b.dataset.sp]; S.sponsor = o; S.budget += o.up; S.offers = null; news(T(`🤝 ${o.name} ile sponsorluk imzalandı (+${M(o.up)}).`, `🤝 Sponsorship signed with ${o.name} (+${M(o.up)}).`), 'good'); save(); render(); });
    $('[data-ev]').forEach(b => b.onclick = () => resolve(b.dataset.ev));
    $('[data-f]').forEach(b => b.onclick = () => { if (S.formation === b.dataset.f) return; S.formation = b.dataset.f; S.roles = {}; selSlot = null; autoXI(); cleanBench(); save(); render(true); });
    $('[data-ment]').forEach(b => b.onclick = () => { S.ment = b.dataset.ment; save(); render(); });
    $('[data-plan]').forEach(b => b.onclick = () => { S.style = b.dataset.plan; save(); render(); });
    $('[data-train]').forEach(b => b.onclick = () => { S.training = b.dataset.train; save(); render(); });
    $('[data-focus]').forEach(b => b.onclick = () => { const id = b.dataset.focus; if (S.focus.includes(id)) S.focus = S.focus.filter(x => x !== id); else if (S.focus.length >= 2) return toast(T('En çok 2 oyuncuya odak atanabilir', 'You can focus on at most 2 players')); else S.focus.push(id); save(); render(); });
    $('[data-slot]').forEach(b => b.onclick = () => { selSlot = selSlot === +b.dataset.slot ? null : +b.dataset.slot; render(); });
    $('[data-pick]').forEach(b => b.onclick = () => { if (selSlot == null) return toast(T('Önce sahadan bir mevki seç', 'Pick a slot on the pitch first')); const p = P(b.dataset.pick); if (!avail(p)) return; S.xi[selSlot] = p.id; cleanBench(); save(); selSlot = null; render(true); });
    $('[data-bench]').forEach(b => b.onclick = () => { const id = b.dataset.bench; S.benchManual = true; if (S.bench.includes(id)) S.bench = S.bench.filter(x => x !== id); else if (S.bench.length >= BENCH) return toast(T(`Yedek kulübesi dolu (${BENCH}). Önce birini çıkar.`, `The bench is full (${BENCH}). Remove someone first.`)); else S.bench.push(id); save(); render(); });
    $('[data-role]').forEach(s => s.onchange = () => { S.roles[+s.dataset.role] = s.value; save(); });
    $('[data-mf]').forEach(i => { const ev = i.tagName === 'INPUT' ? 'input' : 'change'; i.addEventListener(ev, () => { const k = i.dataset.mf; mFilter[k] = k === 'max' ? +i.value : i.value; const pos = i.selectionStart; render(); if (k === 'q') { const n = host.querySelector('[data-mf=q]'); n.focus(); n.setSelectionRange(pos, pos); } }); });
    $('[data-buy]').forEach(b => b.onclick = () => { const [club, name] = b.dataset.buy.split('|'); const x = market().find(m => m.club === club && m.name === name); if (x) openDeal(x); });
    $('[data-sell]').forEach(b => b.onclick = () => { const p = P(b.dataset.sell); if (!p) return; if (S.squad.length <= MINSQ) return toast(T(`Kadroda en az ${MINSQ} oyuncu olmalı`, `You need at least ${MINSQ} players`)); const pr = Math.round(value(p) * .9 * 10) / 10; ask(T(`${p.name} satılsın mı?`, `Sell ${p.name}?`), T(`Teklif: ${M(pr)}. Oyuncu kadrodan ayrılır.`, `Offer: ${M(pr)}. The player leaves the squad.`), T('Sat', 'Sell')).then(ok => { if (ok) { sell(p); render(); } }); });
    $('[data-sign]').forEach(b => b.onclick = () => { const i = +b.dataset.sign, p = S.scouted[i]; if (!p) return; const c = scoutFee(p); if (S.budget < c) return poor(c, p.name); if (S.squad.length >= MAXSQ) return toast(T('Kadro dolu', 'Squad full')); ask(T(`${p.name} imzalansın mı?`, `Sign ${p.name}?`), T(`${PZ(p.pos)} · ${p.age} yaş · OVR ${p.r} · POT ${p.pot} — imza bedeli ${M(c)}.`, `${PZ(p.pos)} · age ${p.age} · OVR ${p.r} · POT ${p.pot} — signing fee ${M(c)}.`), T('İmzala', 'Sign')).then(ok => { if (!ok) return; S.budget -= c; delete p.exp; delete p.from; S.squad.push(p); S.scouted.splice(S.scouted.indexOf(p), 1); assignNums(); cleanBench(); news(T(`🌟 Genç yetenek ${p.name} imzaladı (POT ${p.pot}).`, `🌟 Young talent ${p.name} signs (POT ${p.pot}).`), 'good'); save(); render(); welcome(p); }); });
    $('[data-scout]').forEach(b => b.onclick = () => { const k = b.dataset.scout, r = REG()[k]; if ((S.scouts || []).length >= scoutSlots() || S.scouts.some(s => s.region === k)) return; if (S.budget < r.cost) return poor(r.cost, T(`${r.n} gözlemcisi`, `A scout in ${r.n}`)); S.budget -= r.cost; S.scouts.push({ region: k, left: 3 }); news(T(`🔭 Gözlemci ${r.n} bölgesine gönderildi.`, `🔭 Scout sent to ${r.n}.`)); save(); render(); });
    $('[data-fac]').forEach(b => b.onclick = () => { const k = b.dataset.fac, c = facCost(k); if (S.budget < c) return poor(c, FAC()[k][0]); S.budget -= c; S.fac[k]++; news(T(`🏗️ ${FAC()[k][0]} seviye ${S.fac[k]} oldu.`, `🏗️ ${FAC()[k][0]} upgraded to level ${S.fac[k]}.`), 'good'); save(); render(); });
    $('[data-fw]').forEach(b => b.onclick = () => { const w = fxWeek == null ? Math.min(S.week, WEEKS - 1) : fxWeek; fxWeek = clamp(w + +b.dataset.fw, 0, WEEKS - 1); render(); });
    const idh = host.querySelector('.cr-idhost'); if (idh && typeof ClubID !== 'undefined') ClubID.editor(idh, () => { const h = host.querySelector('.cr-head'); if (h) { const m = me(), c = ClubID.get(); Object.assign(m, { name: c.name || m.name, c1: c.c1, c2: c.c2, kit: c.kit, short: c.short || ClubID.autoShort(c.name) }); h.querySelector('h1').textContent = m.name; save(); } });
  }

  function open(el) { host = el; S = load(); syncSavedAges(); migrate(); if (S) save(); tab = 'center'; fxWeek = null; selSlot = null; render(); }
  // test ve diğer modüller için küçük bir API
  return { open, state: () => S, report: () => openReport(S && S.matchLog), _deal: openDeal, _market: market, _sim: (n) => { for (let i = 0; i < (n || 1) && S && S.week < WEEKS; i++) { if (!S.sponsor && S.offers) { S.sponsor = S.offers[0]; S.budget += S.sponsor.up; S.offers = null; } if (S.pending && S.pending.kind === 'event') resolve(S.pending.ch[0][1]); rotate(); liveMatch(null, true); } } };
})();
