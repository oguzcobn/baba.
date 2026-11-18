/* DSAn — roller, yetkinlik/verim/moral etkileri, işe alım koşulları, aday üretimi ve dallı İK görüşmesi. */
(function () {
  'use strict';
  const DSAN = window.DSAN = window.DSAN || {};
  const T = (a, b) => DSAN.T(a, b), U = () => DSAN.util;

  // ppe: baret rengi; acc: aksesuar; anim: 3D iş animasyonu; site: sahada mı ofiste mi; base: günlük ücret tabanı ($)
  const ROLES = {
    architect:  { tr: 'Gemi İnşa Mühendisi', en: 'Naval Architect', icon: '📐', color: 'text-sky-300', bg: 'bg-sky-500/20', base: 820, ppe: '#f8fafc', acc: 'tablet', anim: 'inspect', site: 'yard', cap: 8,
      eff: { tr: 'Kalite: en iyi mühendis +0,25/puan', en: 'Quality: best engineer +0.25/pt' }, req: null },
    cad:        { tr: 'CAD / 3D Tasarım Mühendisi', en: 'CAD / 3D Design Engineer', icon: '🖥️', color: 'text-cyan-300', bg: 'bg-cyan-500/20', base: 700, ppe: '#f8fafc', acc: 'tablet', anim: 'inspect', site: 'office', cap: 2,
      eff: { tr: 'Kalite +2, malzeme −%2 (her uzman, azalan)', en: 'Quality +2, material −2% (each, diminishing)' }, req: { capUpgrade: 'cad_cam_office', capWith: 6 } },
    welder:     { tr: 'Çelik & Alüminyum Kaynakçı', en: 'Steel & Aluminium Welder', icon: '🔥', color: 'text-amber-300', bg: 'bg-amber-500/20', base: 640, ppe: '#facc15', acc: 'mask', anim: 'weld', site: 'yard', cap: 14,
      eff: { tr: 'Çelik/alüminyum gövdede ×1,25 hız', en: '×1.25 speed on steel/aluminium hulls' }, req: null },
    composite:  { tr: 'Kompozit & Vakum İnfüzyon Ustası', en: 'Composite & Vacuum Infusion Tech', icon: '🧪', color: 'text-teal-300', bg: 'bg-teal-500/20', base: 660, ppe: '#facc15', acc: 'respirator', anim: 'work', site: 'yard', cap: 10,
      eff: { tr: 'Kompozit gövdede ×1,3 hız', en: '×1.3 speed on composite hulls' }, req: null },
    electrical: { tr: 'Elektrik & Otomasyon Teknisyeni', en: 'Electrical & Automation Tech', icon: '⚡', color: 'text-yellow-300', bg: 'bg-yellow-500/20', base: 680, ppe: '#3b82f6', acc: 'toolbag', anim: 'work', site: 'yard', cap: 8,
      eff: { tr: 'Elektrikli/hibrit teknede ×1,2 hız; deneme güvenilirliği +', en: '×1.2 on electric/hybrid; trial reliability +' }, req: null },
    hybrid:     { tr: 'Hibrit Tahrik & Batarya Uzmanı', en: 'Hybrid Propulsion & Battery Specialist', icon: '🔋', color: 'text-lime-300', bg: 'bg-lime-500/20', base: 860, ppe: '#3b82f6', acc: 'tablet', anim: 'work', site: 'yard', cap: 4,
      eff: { tr: 'Hibrit/elektrikli teknede ×1,25; deneme enerji puanı +', en: '×1.25 on hybrid/electric; trial energy +' }, req: { rep: 70 } },
    mechanic:   { tr: 'Mekanik & Borulama Ustası', en: 'Mechanical & Piping Fitter', icon: '⚙️', color: 'text-emerald-300', bg: 'bg-emerald-500/20', base: 660, ppe: '#facc15', acc: 'wrench', anim: 'work', site: 'yard', cap: 10,
      eff: { tr: 'Çok motorlu teknede ×1,1; deneme güvenilirliği +', en: '×1.1 on multi-engine; trial reliability +' }, req: null },
    outfitter:  { tr: 'Yat İç Mimari & Donatım Ustası', en: 'Yacht Interior & Outfitting', icon: '🎨', color: 'text-purple-300', bg: 'bg-purple-500/20', base: 700, ppe: '#f37021', acc: 'toolbag', anim: 'work', site: 'yard', cap: 10,
      eff: { tr: 'Yatlarda ×1,25 hız; deneme konforu +', en: '×1.25 on yachts; trial comfort +' }, req: null },
    quality:    { tr: 'Kalite Kontrol (QA/QC) Mühendisi', en: 'Quality Control (QA/QC) Engineer', icon: '🔍', color: 'text-indigo-300', bg: 'bg-indigo-500/20', base: 760, ppe: '#f8fafc', acc: 'clipboard', anim: 'inspect', site: 'yard', cap: 4,
      eff: { tr: 'Kalite +3 (her uzman, azalan)', en: 'Quality +3 (each, diminishing)' }, req: { rep: 60 } },
    hse:        { tr: 'İş Güvenliği (İSG) Uzmanı', en: 'Health & Safety (HSE) Specialist', icon: '🦺', color: 'text-green-300', bg: 'bg-green-500/20', base: 720, ppe: '#22c55e', acc: 'clipboard', anim: 'inspect', site: 'yard', cap: 3,
      eff: { tr: 'Yorgunluk −%12; müşteri turu güvenliği +', en: 'Fatigue −12%; customer tour safety +' }, req: null },
    planning:   { tr: 'Üretim Planlama Mühendisi', en: 'Production Planning Engineer', icon: '📅', color: 'text-blue-300', bg: 'bg-blue-500/20', base: 740, ppe: '#f8fafc', acc: 'tablet', anim: 'inspect', site: 'office', cap: 3,
      eff: { tr: 'Tüm hollerde hız +%5 (azalan)', en: 'All halls speed +5% (diminishing)' }, req: null },
    procurement:{ tr: 'Satın Alma Uzmanı', en: 'Procurement Specialist', icon: '📦', color: 'text-orange-300', bg: 'bg-orange-500/20', base: 620, ppe: '#f8fafc', acc: 'clipboard', anim: 'walk', site: 'office', cap: 3,
      eff: { tr: 'Malzeme maliyeti −%4,5 (azalan)', en: 'Material cost −4.5% (diminishing)' }, req: null },
    sales:      { tr: 'Satış & Müşteri İlişkileri', en: 'Sales & Client Relations', icon: '🤝', color: 'text-rose-300', bg: 'bg-rose-500/20', base: 780, ppe: '#f8fafc', acc: 'tablet', anim: 'walk', site: 'office', cap: 4,
      eff: { tr: 'Müşteri iletişimi +10; sözleşme primi +%2', en: 'Client communication +10; contract premium +2%' }, req: null },
    hr:         { tr: 'İnsan Kaynakları Uzmanı', en: 'HR Specialist', icon: '🧑‍💼', color: 'text-pink-300', bg: 'bg-pink-500/20', base: 600, ppe: '#f8fafc', acc: 'clipboard', anim: 'walk', site: 'office', cap: 2,
      eff: { tr: 'Günlük moral +1,2; daha nitelikli aday', en: 'Daily morale +1.2; stronger candidates' }, req: null },
    driver:     { tr: 'Şoför / Transfer Sorumlusu', en: 'Driver / Transfer Coordinator', icon: '🚐', color: 'text-slate-200', bg: 'bg-slate-500/20', base: 420, ppe: null, acc: 'cap', anim: 'walk', site: 'office', cap: 3,
      eff: { tr: 'Transfer dakikliği +%4, transfer maliyeti −%8', en: 'Transfer punctuality +4%, cost −8%' }, req: null },
    ops:        { tr: 'Tersane Operasyon Şefi (SPMT/Vinç/Syncrolift)', en: 'Yard Operations Lead (SPMT/Crane/Syncrolift)', icon: '🏗️', color: 'text-amber-200', bg: 'bg-amber-500/20', base: 800, ppe: '#f37021', acc: 'radio', anim: 'inspect', site: 'yard', cap: 3,
      eff: { tr: 'Tüm hollerde hız +%3,5; tur düzeni +', en: 'All halls speed +3.5%; tour order +' }, req: null }
  };
  // Eski kodla uyum: label/icon/color/bg alanları
  Object.entries(ROLES).forEach(([k, r]) => { r.key = k; Object.defineProperty(r, 'label', { get: () => T(r.tr, r.en), enumerable: true }); });
  const PRODUCTION = ['welder', 'composite', 'electrical', 'hybrid', 'mechanic', 'outfitter', 'ops'];

  const SKILL_POOL = {
    architect: ['Stabilite & IMO', 'Cadmatic yapısal', 'BV/DNV klas onayı', 'Hidrodinamik', 'Ağırlık kontrolü'],
    cad: ['Rhino 3D', 'Cadmatic Outfitting', 'AutoCAD', 'Nesting & CNC', 'Revit/iç mimari'],
    welder: ['MIG/MAG', 'TIG alüminyum', 'ISO 9606 sertifika', 'Blok montajı', 'Tavan pozisyonu'],
    composite: ['Vakum infüzyon', 'Prepreg', 'Sandviç çekirdek', 'Jelkot tamiri', 'BV Mode I'],
    electrical: ['Pano montajı', 'PLC/otomasyon', 'Kablo çekme', 'Yüksek gerilim', 'Seyir elektroniği'],
    hybrid: ['Batarya yönetimi (BMS)', 'Elektrik tahrik', 'Metanol/hibrit', 'Şarj sistemleri', 'Enerji optimizasyonu'],
    mechanic: ['Ana makine montajı', 'Şaft hizalama', 'Paslanmaz borulama', 'Hidrolik', 'HVAC'],
    outfitter: ['Teak güverte', 'Ahşap işçiliği', 'Lüks kabin', 'Ses yalıtımı', 'Döşeme'],
    quality: ['NDT (UT/MT)', 'ISO 9001 denetim', 'Boyut kontrolü', 'Klas sörveyi', 'Raporlama'],
    hse: ['Permit-to-Work', 'Sıcak iş izni', 'Kapalı alan', 'ISO 45001', 'Acil durum'],
    planning: ['Primavera P6', 'Kritik yol', 'Kapasite planı', 'IFS ERP', 'Yalın üretim'],
    procurement: ['Tedarikçi pazarlığı', 'Serbest bölge gümrüğü', 'Stok yönetimi', 'IFS ERP', 'İngilizce yazışma'],
    sales: ['Teknik satış', 'Yat brokerliği', 'Kamu ihaleleri', 'İngilizce/Hollandaca', 'Teklif hazırlama'],
    hr: ['İşe alım', 'Bordro', 'Eğitim planı', 'İş hukuku', 'Oryantasyon'],
    driver: ['VIP transfer', 'B/D ehliyet', 'Havalimanı protokolü', 'İngilizce temel', 'Defansif sürüş'],
    ops: ['SPMT', 'Syncrolift', 'Vinç sinyalciliği', 'Rıhtım operasyonu', 'Ekip yönetimi']
  };
  const FIRST = ['Kaan', 'Deniz', 'Barış', 'Burak', 'Levent', 'Zeynep', 'Elif', 'Tayfun', 'Hakan', 'Ece', 'Serkan', 'Defne', 'Oğuz', 'Kerem', 'Selin', 'Mert', 'Aslı', 'Cansu', 'Emre', 'Gizem', 'Onur', 'Pınar', 'Yusuf', 'Melis', 'Anouk', 'Ruben', 'Nadia'];
  const LAST = ['Yılmaz', 'Aksoy', 'Soylu', 'Poyraz', 'Karadeniz', 'Çetin', 'Bozkurt', 'Aydın', 'Korkmaz', 'Şahin', 'Vural', 'Erdem', 'Kaplan', 'Özdemir', 'Tekin', 'Arslan', 'Doğan', 'de Vries', 'Bakker'];
  const PREV = ['Tuzla’da bir tersane', 'Yalova tersane bölgesi', 'Antalya Serbest Bölge’de bir yat üreticisi', 'İzmir’de bir kompozit atölyesi', 'Mersin’de bir liman işletmesi', 'Kocaeli’nde makine imalatı', 'Akdeniz Üniversitesi (yeni mezun)', 'İTÜ Gemi İnşaatı', 'KTÜ Gemi İnşaatı', 'Hollanda’da bir tersanede staj'];
  const PERS = { safety: ['titiz', 'meticulous'], team: ['takım oyuncusu', 'team player'], flex: ['esnek', 'flexible'], ambition: ['hırslı', 'ambitious'] };

  // ---------- Etkiler ----------
  function moraleF(w) { return .55 + (w.morale || 80) / 100 * .45 - (w.fatigue > 80 ? .15 : 0); }
  function contrib(workers, role) {
    return workers.filter(w => w.role === role).sort((a, b) => b.skill - a.skill).reduce((s, w, i) => s + (w.skill / 100) * Math.pow(.6, i) * moraleF(w), 0);
  }
  function effects(workers) {
    workers = workers || [];
    const c = r => contrib(workers, r);
    return {
      speed: 1 + .05 * c('planning') + .035 * c('ops'),
      quality: 3 * c('quality') + 2 * c('cad'),
      material: Math.max(.82, 1 - (.045 * c('procurement') + .02 * c('cad'))),
      fatigue: Math.max(.6, 1 - .12 * c('hse')),
      moraleDaily: 1.2 * c('hr'),
      premium: .02 * c('sales'),
      comm: 10 * c('sales'),
      punct: .04 * c('driver'), transferCost: Math.max(.8, 1 - .08 * c('driver')),
      tourSafety: 12 * c('hse'), tourOrder: 8 * c('ops'),
      trialEnergy: 6 * c('hybrid') + 3 * c('electrical'), trialRel: 5 * c('mechanic') + 3 * c('electrical') + 2 * c('quality'), trialComfort: 4 * c('outfitter'),
      candidate: 4 * c('hr')
    };
  }
  const ELECTRIC = ['work_osv_34', 'yacht_explorer_42', 'yacht_mega_62'];
  function roleFit(role, bp) {
    if (!bp) return 1;
    const kind = DSAN.vessels ? DSAN.vessels.hullKind(bp) : 'steel', yacht = bp.category === 'Yacht', elec = ELECTRIC.includes(bp.id);
    switch (role) {
      case 'welder': return kind === 'composite' ? .8 : 1.25;
      case 'composite': return kind === 'composite' ? 1.3 : .75;
      case 'mechanic': return bp.engineReq >= 3 ? 1.1 : 1;
      case 'electrical': return elec ? 1.2 : 1;
      case 'hybrid': return elec ? 1.25 : .9;
      case 'outfitter': return yacht ? 1.25 : .9;
      case 'architect': case 'cad': return .9;
      case 'quality': return .6; case 'ops': return 1;
      case 'hse': case 'planning': return .5;
      default: return .2; // ofis rolleri
    }
  }
  function wageFor(role, skill) { const r = ROLES[role] || ROLES.welder; return Math.round(r.base * (.75 + skill / 100 * .45) / 10) * 10; }

  // ---------- İşe alım koşulları ----------
  function staffCap(state) { return 36 + (state.upgrades && state.upgrades.crew_campus ? 8 : 0); }
  function roleCap(role, state) { const r = ROLES[role]; if (r.req && r.req.capUpgrade) return state.upgrades && state.upgrades[r.req.capUpgrade] ? r.req.capWith : r.cap; return r.cap; }
  function canHire(role, state) {
    const r = ROLES[role]; if (!r) return { ok: false, why: '?' };
    if (state.workers.length >= staffCap(state)) return { ok: false, why: T(`Kadro sınırı dolu (${staffCap(state)} kişi). Personel kampüsü yatırımı +8 kişi açar.`, `Headcount limit reached (${staffCap(state)}). The crew campus upgrade adds 8.`) };
    const n = state.workers.filter(w => w.role === role).length, cap = roleCap(role, state);
    if (n >= cap) return { ok: false, why: T(`Bu rolde en fazla ${cap} kişi çalışabilir.`, `Max ${cap} people in this role.`) };
    if (r.req && r.req.rep && state.reputation < r.req.rep) return { ok: false, why: T(`İtibar en az ${r.req.rep} olmalı (şu an ${state.reputation}).`, `Reputation must be at least ${r.req.rep} (now ${state.reputation}).`) };
    return { ok: true };
  }
  function condText(role, state) {
    const r = ROLES[role], parts = [T(`En fazla ${roleCap(role, state)} kişi`, `Max ${roleCap(role, state)}`)];
    if (r.req && r.req.rep) parts.push(T(`İtibar ≥ ${r.req.rep}`, `Reputation ≥ ${r.req.rep}`));
    if (r.req && r.req.capUpgrade) parts.push(T(`Mühendislik havuzu yatırımıyla ${r.req.capWith} kişi`, `${r.req.capWith} with engineering pool upgrade`));
    parts.push(T('İmza primi kasadan peşin', 'Signing bonus paid upfront'));
    return parts.join(' · ');
  }

  // ---------- Çalışan normalizasyonu (migration) ----------
  function normalizeWorker(w, state) {
    if (!ROLES[w.role]) w.role = 'welder';
    if (!w.expYears) w.expYears = Math.max(2, Math.round((w.skill - 55) / 2.2));
    if (!Array.isArray(w.skills)) { const pool = SKILL_POOL[w.role]; const r = U().rng(w.id); w.skills = pool.filter(() => r() > .5).slice(0, 3); if (!w.skills.length) w.skills = [pool[0]]; }
    if (w.hiredDay == null) w.hiredDay = 1;
    if (w.assignedDock == null) w.assignedDock = ROLES[w.role].site === 'office' ? 0 : 1;
    return w;
  }
  function renameWorker(state, id, name) {
    const w = state.workers.find(x => x.id === id); if (!w) return false;
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return false; w.name = name; return true;
  }

  // ---------- Aday üretimi ----------
  function generateCandidates(state) {
    const fx = effects(state.workers), n = 3 + (state.workers.some(w => w.role === 'hr') ? 1 : 0);
    const keys = Object.keys(ROLES), list = [];
    const weight = k => (state.workers.some(w => w.role === k) ? 1 : 2.6) * (PRODUCTION.includes(k) ? 1.3 : 1);
    for (let i = 0; i < n; i++) {
      const tot = keys.reduce((s, k) => s + weight(k), 0); let r = Math.random() * tot, role = keys[0];
      for (const k of keys) { r -= weight(k); if (r <= 0) { role = k; break; } }
      const exp = Math.max(1, Math.round(Math.pow(Math.random(), 1.3) * 22));
      const skill = Math.round(U().clamp(58 + exp * 1.5 + U().rand(-6, 9) + fx.candidate, 55, 98));
      const tr = { safety: Math.random(), team: Math.random(), flex: Math.random(), ambition: Math.random() };
      const pk = Object.keys(tr).sort((a, b) => tr[b] - tr[a])[0];
      const expectation = Math.round(wageFor(role, skill) * (1 + tr.ambition * .12) / 10) * 10;
      const shown = Math.round(U().clamp(skill + (tr.ambition - .4) * 12 + U().rand(-3, 3), 50, 99));
      const pool = SKILL_POOL[role].slice().sort(() => Math.random() - .5);
      list.push({ id: U().uid('cand'), name: U().pick(FIRST) + ' ' + U().pick(LAST), role, expYears: exp, skillTrue: skill, skill: shown, traits: tr, personality: pk, prev: U().pick(PREV),
        skills: pool.slice(0, 2 + (exp > 8 ? 1 : 0)), expectation, wage: expectation, hiringBonus: expectation * 3, morale: 90, fatigue: 5 });
    }
    state.candidates = list;
  }

  // ---------- Dallı İK görüşmesi ----------
  function sceneImage(role) {
    if (['welder', 'composite', 'mechanic', 'outfitter', 'electrical'].includes(role)) return 'img/hr-welder.webp';
    if (['hse', 'ops', 'planning', 'quality'].includes(role)) return 'img/hr-safety.webp';
    return 'img/hr-engineer.webp';
  }
  function acceptance(ctx) {
    const c = ctx.cand, ratio = ctx.offer / c.expectation;
    let z = (ctx.trust - 50) / 14 + (ratio - 1) * 9 + ctx.bonusX * .28 + (ctx.flexMatch || 0);
    if (c.traits.ambition > .6 && ratio < 1) z -= 1;
    if (ctx.growth) z += .5;
    return U().clamp(1 / (1 + Math.exp(-z)), .03, .97);
  }
  function interview(state, candId, hooks) {
    const cand = state.candidates.find(c => c.id === candId); if (!cand) return;
    const R = ROLES[cand.role], can = canHire(cand.role, state);
    if (!can.ok) { hooks.toast(T('İşe alım koşulu sağlanmıyor', 'Hiring condition not met'), can.why, 'amber'); return; }
    state.hr.interviews++;
    const ctx = { cand, trust: 50, fit: U().clamp(cand.skill - 10, 30, 90), revealed: false, moraleImpact: 0, extraCost: 0, offer: cand.expectation, bonusX: 2, growth: null, flexMatch: 0, countered: false, shift: 'normal', notes: [] };
    const tn = U().esc(cand.name), first = cand.name.split(' ')[0];
    const pers = T(PERS[cand.personality][0], PERS[cand.personality][1]);
    const money = U().money;
    const fit = () => Math.round(ctx.fit);
    DSAN.story({
      title: T('İK Görüşmesi', 'HR Interview') + ' · ' + cand.name, sub: R.label,
      ctx, start: 'intro',
      meters: [
        { k: 'trust', label: T('Güven', 'Trust'), tone: 'sky' },
        { k: 'fit', label: T('İşe uygunluk', 'Job fit'), tone: 'emerald' },
        { label: T('Kabul ihtimali', 'Acceptance'), get: c => acceptance(c) * 100, fmt: v => T('%' + Math.round(v), Math.round(v) + '%'), tone: 'amber' },
        { label: T('Ekip morali etkisi', 'Team morale'), get: c => 50 + c.moraleImpact * 8, fmt: (v, c) => U().sign(c.moraleImpact), tone: 'violet' },
        { label: T('Maaş teklifi / gün', 'Wage offer / day'), get: c => c.offer / c.cand.expectation * 50, fmt: (v, c) => money(c.offer), bar: false }
      ],
      scenes: {
        intro: { step: '1/6', image: sceneImage(cand.role), title: T('Tanışma', 'Introduction'), speaker: cand.name,
          text: () => `<p>${T(`<b>${tn}</b>, ${cand.expYears} yıllık deneyimle <b>${U().esc(R.label)}</b> pozisyonuna başvurdu. Son işi: ${U().esc(cand.prev)}.`, `<b>${tn}</b> applies for <b>${U().esc(R.label)}</b> with ${cand.expYears} years of experience. Last job: ${U().esc(cand.prev)}.`)}</p>
            <ul class="dz-facts"><li>${T('Beyan edilen yetkinlik', 'Stated skill')}: <b>${cand.skill}/100</b></li><li>${T('Maaş beklentisi', 'Wage expectation')}: <b>${money(cand.expectation)}/${T('gün', 'day')}</b></li><li>${T('Beceriler', 'Skills')}: ${cand.skills.map(s => U().esc(s)).join(', ')}</li><li>${T('İlk izlenim', 'First impression')}: ${pers}</li></ul>`,
          choices: [
            { label: T('Samimi karşıla, tersaneyi ve ekibi anlat', 'Warm welcome, introduce the yard and team'), chips: [[T('Güven +8', 'Trust +8'), 'up']], apply: c => { c.trust += 8; return { next: 'tech', note: T(`${first} rahatladı ve gülümsedi.`, `${first} relaxes and smiles.`) }; } },
            { label: T('Doğrudan CV üzerinden teknik sorulara geç', 'Go straight into technical questions'), chips: [[T('Uygunluk netleşir', 'Fit clearer'), 'info']], apply: c => { c.trust += cand.personality === 'safety' ? 6 : 1; c.fit = (c.fit + cand.skillTrue) / 2; return { next: 'tech', note: cand.personality === 'safety' ? T('Titiz aday bu yaklaşımı sevdi.', 'The meticulous candidate liked that.') : '' }; } },
            { label: T('Kısa tut, zamanımız dar', 'Keep it short, we are busy'), chips: [[T('Güven −8', 'Trust −8'), 'down']], apply: c => { c.trust -= 8; return { next: 'tech', note: T('Aday biraz gerildi.', 'The candidate tenses up.') }; } }
          ] },
        tech: { step: '2/6', image: sceneImage(cand.role), title: T('Teknik deneyim', 'Technical experience'), speaker: cand.name,
          text: () => T(`<p>“${U().esc(cand.skills[0])} konusunda en çok güvendiğim alan. ${cand.expYears > 8 ? 'Büyük blok ve klas onaylı projelerde çalıştım.' : 'Hızlı öğreniyorum, sertifikalarımı tamamlıyorum.'}”</p><p>Beyan edilen yetkinliği nasıl doğrulayacaksın?</p>`,
            `<p>“${U().esc(cand.skills[0])} is my strongest area. ${cand.expYears > 8 ? 'I have worked on large class-approved block projects.' : 'I learn fast and am finishing my certificates.'}”</p><p>How will you verify the stated skill?</p>`),
          choices: [
            { label: T('Son projesindeki en zor problemi anlatmasını iste', 'Ask about the hardest problem in the last project'), chips: [[T('Gerçek yetkinlik kısmen görünür', 'Partial reveal'), 'info']], apply: c => { c.fit = U().clamp(cand.skillTrue - 4 + (c.fit - cand.skillTrue) * .3, 30, 98); c.trust += 3; return { next: 'safety', note: T(`Anlattıkları beyanla ${Math.abs(cand.skill - cand.skillTrue) > 6 ? 'tam örtüşmüyor' : 'tutarlı'}.`, `The story is ${Math.abs(cand.skill - cand.skillTrue) > 6 ? 'not fully consistent' : 'consistent'} with the claim.`) }; } },
            { label: T('Uygulamalı test yaptır (numune / tasarım vakası)', 'Run a practical test (sample / design case)'), hint: T('Maliyet: $600 malzeme ve atölye saati', 'Cost: $600 materials and workshop time'), chips: [[T('Kesin ölçüm', 'Exact'), 'info'], ['−$600', 'down']], apply: c => { c.extraCost += 600; c.testCost = 600; c.revealed = true; c.fit = cand.skillTrue; c.trust += cand.skillTrue >= cand.skill - 2 ? 5 : -3; return { next: 'safety', note: T(`Test sonucu: gerçek yetkinlik <b>${cand.skillTrue}/100</b>.`, `Test result: true skill <b>${cand.skillTrue}/100</b>.`) }; } },
            { label: T('Referanslarını ara', 'Call the references'), chips: [[T('Takım uyumu görünür', 'Team fit revealed'), 'info']], apply: c => { const good = cand.traits.team > .5; c.fit += good ? 4 : -4; c.moraleImpact += good ? 1 : -1; return { next: 'safety', note: good ? T('Eski amiri ekip içinde çok sevildiğini söyledi.', 'Former supervisor: well liked by the team.') : T('Referans: işini iyi yapıyor ama ekipte zaman zaman sürtüşme yaşamış.', 'Reference: good at the job, some friction in the team.') }; } }
          ] },
        safety: { step: '3/6', image: 'img/hr-safety.webp', title: T('İş güvenliği senaryosu', 'Safety scenario'), speaker: cand.name,
          text: () => { const ok = cand.traits.safety > .45; return T(`<p>Senaryo: DAMEN 1’de teslim günü yaklaşıyor; bir ekip sıcak iş izni beklemeden kaynağa başlamak istiyor.</p><p>${tn}: “${ok ? 'İzin gelmeden ark yakılmaz. Ekibi durdurur, İSG’yi ararım.' : 'Teslim önemliyse yangın tüpüyle başlayıp izni sonra tamamlarız.'}”</p>`,
            `<p>Scenario: delivery day is close in DAMEN 1; a crew wants to start welding without a hot-work permit.</p><p>${tn}: “${ok ? 'No arc without a permit. I stop the crew and call HSE.' : 'If delivery matters, start with an extinguisher nearby and finish the permit later.'}”</p>`); },
          choices: () => { const ok = cand.traits.safety > .45; return [
            { label: T('Sıfır taviz: cevabı bu ilkeye göre değerlendir', 'Zero tolerance: judge the answer by that'), chips: ok ? [[T('Uygunluk +8', 'Fit +8'), 'up'], [T('Ekip morali +1', 'Team +1'), 'up']] : [[T('Uygunluk −10', 'Fit −10'), 'down'], [T('Güven −4', 'Trust −4'), 'down']], apply: c => { if (ok) { c.fit += 8; c.moraleImpact += 1; } else { c.fit -= 10; c.trust -= 4; } return { next: 'team' }; } },
            { label: T('Eğitim şartı koy: işe başlarsa Permit-to-Work eğitimi alacak', 'Make Permit-to-Work training a condition'), chips: [[T('Maliyet $900', 'Cost $900'), 'down'], [T('Uygunluk +4', 'Fit +4'), 'up']], apply: c => { c.extraCost += 900; c.fit += 4; c.trust += ok ? 2 : -1; return { next: 'team', note: T('Aday eğitim şartını kabul etti.', 'The candidate accepts the training condition.') }; } },
            { label: T('Teslim baskısını anlayışla karşıla', 'Be lenient about delivery pressure'), chips: [[T('Güven +', 'Trust +'), 'up'], [T('Ekip morali −2', 'Team −2'), 'down']], apply: c => { c.trust += ok ? -3 : 5; c.moraleImpact -= 2; c.fit -= 4; return { next: 'team', note: T('Ekipteki İSG sorumluları bu yaklaşımdan rahatsız olabilir.', 'Safety-minded staff may be uneasy.') }; } }
          ]; } },
        team: { step: '4/6', image: () => sceneImage(cand.role), title: T('Takım çalışması', 'Teamwork'), speaker: T('Sen', 'You'),
          text: () => T('<p>Vardiya devrinde iki usta arasında bir hata yüzünden tartışma çıkıyor. Adaydan nasıl bir rol bekliyorsun?</p>', '<p>A shift handover error causes an argument between two craftsmen. What role do you expect from the candidate?</p>'),
          choices: [
            { label: T('Deneyimli bir mentorla eşleştir, birlikte çözsünler', 'Pair with an experienced mentor'), chips: [[T('Ekip morali +2', 'Team +2'), 'up'], [T('Güven +', 'Trust +'), cand.traits.team > .4 ? 'up' : 'info']], apply: c => { c.moraleImpact += 2; c.trust += cand.traits.team > .4 ? 6 : 1; c.fit += 3; return { next: 'shift' }; } },
            { label: T('Bireysel performansı öne çıkar, primle ödüllendir', 'Highlight individual performance, reward with bonus'), chips: [[T('Hırslı adaya güven +', 'Trust + if ambitious'), 'info'], [T('Ekip morali −1', 'Team −1'), 'down']], apply: c => { c.trust += cand.traits.ambition > .55 ? 7 : -2; c.moraleImpact -= 1; return { next: 'shift' }; } },
            { label: T('Vardiya amirine bırak', 'Leave it to the shift supervisor'), chips: [[T('Nötr', 'Neutral'), 'info']], apply: () => ({ next: 'shift' }) }
          ] },
        shift: { step: '5/6', image: () => sceneImage(cand.role), title: T('Vardiya ve maaş', 'Shifts and pay'), speaker: cand.name,
          text: () => T(`<p>“Beklentim günlük <b>${money(cand.expectation)}</b>. ${cand.traits.flex > .55 ? 'Gerekirse fazla mesaiye kalabilirim.' : 'Ailem için düzenli vardiya benim için önemli.'}”</p>`, `<p>“My expectation is <b>${money(cand.expectation)}</b> per day. ${cand.traits.flex > .55 ? 'I can do overtime if needed.' : 'Regular shifts matter to me for my family.'}”</p>`),
          choices: [
            { label: T('Normal vardiya, beklenen maaş', 'Regular shifts, expected wage'), chips: [[T('Güven +4', 'Trust +4'), 'up']], apply: c => { c.trust += 4; c.offer = cand.expectation; c.shift = 'normal'; c.flexMatch = cand.traits.flex > .55 ? 0 : .4; return { next: 'growth' }; } },
            { label: T('Fazla mesai ağırlıklı, maaş +%10', 'Overtime-heavy, wage +10%'), chips: [[T('Maaş maliyeti +%10', 'Wage +10%'), 'down'], [T('Esnek adaya uygun', 'Suits flexible'), 'info']], apply: c => { c.offer = Math.round(cand.expectation * 1.1 / 10) * 10; c.shift = 'overtime'; c.flexMatch = cand.traits.flex > .55 ? .6 : -.8; c.trust += cand.traits.flex > .55 ? 4 : -5; c.moraleImpact -= .5; return { next: 'growth' }; } },
            { label: T('Esnek vardiya + yemek/servis, maaş −%5', 'Flexible shifts + meals/shuttle, wage −5%'), chips: [[T('Maaş −%5', 'Wage −5%'), 'up'], [T('Yan hak maliyeti $1.200', 'Benefits $1,200'), 'down']], apply: c => { c.offer = Math.round(cand.expectation * .95 / 10) * 10; c.extraCost += 1200; c.shift = 'flex'; c.flexMatch = cand.traits.flex > .55 ? .2 : .7; c.trust += 2; return { next: 'growth' }; } }
          ] },
        growth: { step: '6/6', image: 'img/hr-engineer.webp', title: T('Gelişim planı', 'Development plan'), speaker: cand.name,
          text: () => T('<p>“Burada nasıl gelişebilirim?”</p>', '<p>“How can I grow here?”</p>'),
          choices: [
            { label: T('Damen akademi eğitimi + sertifika', 'Damen academy training + certificate'), chips: [['−$3.500', 'down'], [T('Yetkinlik +3', 'Skill +3'), 'up'], [T('Güven +8', 'Trust +8'), 'up']], apply: c => { c.extraCost += 3500; c.growth = 'academy'; c.trust += 8; return { next: 'offer' }; } },
            { label: T('Mentorluk programı', 'Mentoring programme'), chips: [[T('Ekip morali +1', 'Team +1'), 'up'], [T('Güven +4', 'Trust +4'), 'up']], apply: c => { c.growth = 'mentor'; c.trust += 4; c.moraleImpact += 1; return { next: 'offer' }; } },
            { label: T('Şimdilik bir plan sunma', 'Offer no plan for now'), chips: [[T('Güven −6', 'Trust −6'), 'down']], apply: c => { c.trust -= 6; return { next: 'offer' }; } }
          ] },
        offer: { image: 'img/hr-engineer.webp', title: T('Teklif', 'Offer'), speaker: T('Teklif masası', 'Offer table'),
          text: c => T(`<p>Teklifini belirle. Kabul ihtimali güvene, maaş/beklenti oranına, imza primine ve verdiğin sözlere göre değişir.</p>${c.revealed ? '' : `<p class="dz-dim">Gerçek yetkinlik ölçülmedi; tahmini uygunluk ${fit()}/100.</p>`}`,
            `<p>Set your offer. Acceptance depends on trust, wage/expectation, signing bonus and your promises.</p>${c.revealed ? '' : `<p class="dz-dim">True skill not measured; estimated fit ${fit()}/100.</p>`}`),
          custom: (c, api) => {
            const lo = Math.round(cand.expectation * .8 / 10) * 10, hi = Math.round(cand.expectation * 1.25 / 10) * 10;
            api.el.innerHTML = `<div class="dz-offer">
              <label>${T('Günlük maaş', 'Daily wage')} <output data-o>${money(c.offer)}</output><input type="range" min="${lo}" max="${hi}" step="10" value="${c.offer}" data-w aria-label="${T('Günlük maaş', 'Daily wage')}"></label>
              <label>${T('İmza primi', 'Signing bonus')} <select data-b><option value="0">${T('Yok', 'None')}</option><option value="2">2× ${T('günlük', 'daily')}</option><option value="4">4× ${T('günlük', 'daily')}</option></select></label>
              <div class="dz-sum" data-s></div></div>`;
            const sel = api.el.querySelector('[data-b]'); sel.value = String(c.bonusX);
            const upd = () => { c.offer = +api.el.querySelector('[data-w]').value; c.bonusX = +sel.value; api.el.querySelector('[data-o]').textContent = money(c.offer);
              const upfront = c.offer * c.bonusX + c.extraCost;
              api.el.querySelector('[data-s]').innerHTML = T(`Peşin maliyet: <b>${money(upfront)}</b> (prim + görüşmede verilen sözler) · Aylık maaş yükü: <b>${money(c.offer * 30)}</b> · Kasa: ${money(state.cash)}`, `Upfront: <b>${money(upfront)}</b> (bonus + promises) · Monthly wage: <b>${money(c.offer * 30)}</b> · Cash: ${money(state.cash)}`);
              api.refresh(); };
            api.el.querySelector('[data-w]').addEventListener('input', upd); sel.addEventListener('change', upd); upd();
          },
          choices: [
            { label: T('Teklifi ver', 'Make the offer'), chips: c => [[T('Kabul ihtimali %', 'Acceptance %') + Math.round(acceptance(c) * 100), 'info']], apply: c => {
              const upfront = c.offer * c.bonusX + c.extraCost;
              if (state.cash < upfront) return { next: 'offer', note: T(`Bütçe yetersiz: ${money(upfront)} gerekiyor.`, `Insufficient budget: ${money(upfront)} needed.`) };
              const p = acceptance(c);
              if (Math.random() < p) return { next: 'hired' };
              if (!c.countered && p >= .25) { c.countered = true; c.counter = Math.round(Math.max(cand.expectation * 1.05, c.offer * 1.08) / 10) * 10; return { next: 'counter' }; }
              return { end: { result: 'declined' } };
            } },
            { label: T('Adayı reddet', 'Reject the candidate'), chips: [[T('Aday listeden çıkar', 'Removed from list'), 'info']], apply: () => ({ end: { result: 'rejected' } }) }
          ] },
        counter: { image: 'img/hr-engineer.webp', title: T('Karşı teklif', 'Counter-offer'), speaker: cand.name,
          text: c => T(`<p>“Teklifiniz için teşekkürler. <b>${money(c.counter)}</b> olursa hemen başlayabilirim.”</p>`, `<p>“Thank you for the offer. At <b>${money(c.counter)}</b> I can start right away.”</p>`),
          choices: [
            { label: c => T(`Kabul et (${money(c.counter)}/gün)`, `Accept (${money(c.counter)}/day)`), apply: c => { c.offer = c.counter; if (state.cash < c.offer * c.bonusX + c.extraCost) return { next: 'counter', note: T('Bütçe yetersiz.', 'Insufficient budget.') }; return { next: 'hired' }; } },
            { label: T('Son teklif: ortada buluşalım', 'Final offer: meet halfway'), chips: [[T('%50 ihtimal', '50% chance'), 'info']], apply: c => { c.offer = Math.round((c.offer + c.counter) / 20) * 10; return Math.random() < .5 + (c.trust - 50) / 200 ? { next: 'hired' } : { end: { result: 'declined' } }; } },
            { label: T('Vazgeç', 'Walk away'), apply: () => ({ end: { result: 'declined' } }) }
          ] },
        hired: { image: 'img/hr-onboarding.webp', title: T('Oryantasyon', 'Onboarding'), speaker: T('Ekip', 'Team'),
          text: c => T(`<p><b>${tn}</b> teklifi kabul etti! Lacivert iş kıyafeti, turuncu reflektörlü yelek ve role uygun KKD teslim edildi; ekip alkışlarla karşıladı.</p><ul class="dz-facts"><li>Maaş: <b>${money(c.offer)}/gün</b></li><li>İmza primi + sözler: <b>${money(c.offer * c.bonusX + c.extraCost)}</b></li><li>Ekip morali: <b>${U().sign(c.moraleImpact)}</b></li></ul>`,
            `<p><b>${tn}</b> accepted! Navy coveralls, an orange reflective vest and role-specific PPE were issued; the team welcomed them with applause.</p><ul class="dz-facts"><li>Wage: <b>${money(c.offer)}/day</b></li><li>Bonus + promises: <b>${money(c.offer * c.bonusX + c.extraCost)}</b></li><li>Team morale: <b>${U().sign(c.moraleImpact)}</b></li></ul>`),
          choices: [{ label: T('Ekibe kat', 'Join the team'), apply: () => ({ end: { result: 'hired' } }) }] }
      },
      onEnd: (c, r) => {
        const res = r && r.result;
        if (!res) { state.cash -= c.testCost || 0; hooks.render(); return; } // pencere kapatıldı: aday listede kalır
        state.candidates = state.candidates.filter(x => x.id !== cand.id);
        if (res === 'hired') {
          const upfront = c.offer * c.bonusX + c.extraCost; state.cash -= upfront;
          const w = normalizeWorker({ id: U().uid('w'), name: cand.name, role: cand.role, skill: Math.min(100, cand.skillTrue + (c.growth === 'academy' ? 3 : 0)), morale: Math.round(U().clamp(72 + (c.trust - 50) * .45 + c.moraleImpact * 2, 45, 100)), fatigue: 5, wage: c.offer,
            assignedDock: ROLES[cand.role].site === 'office' ? 0 : (state.selectedDockId || 1), expYears: cand.expYears, skills: cand.skills.slice(), hiredDay: state.day, shift: c.shift }, state);
          state.workers.push(w);
          if (c.moraleImpact) state.workers.forEach(x => { if (x !== w) x.morale = Math.round(U().clamp(x.morale + c.moraleImpact, 30, 100)); });
          state.hr.hires++; state.hr.history.unshift({ day: state.day, name: cand.name, role: cand.role, result: 'hired', wage: c.offer });
          hooks.toast(T(`Yeni ekip üyesi: ${cand.name}`, `New team member: ${cand.name}`), `${R.label} · ${money(c.offer)}/${T('gün', 'day')}`, 'emerald');
          hooks.log(T(`👷 ${cand.name} (${R.tr}) görüşme sonrası işe alındı. Peşin maliyet ${money(upfront)}.`, `👷 ${cand.name} (${R.en}) hired after interview. Upfront ${money(upfront)}.`), 'success');
          hooks.sound && hooks.sound('cash');
        } else {
          state.cash -= c.testCost || 0; // yalnız yapılmış uygulamalı test harcanmış olur; verilen sözler işe alım olmadan ödenmez
          state.hr.rejected++; state.hr.history.unshift({ day: state.day, name: cand.name, role: cand.role, result: res });
          hooks.toast(res === 'declined' ? T(`${cand.name} teklifi reddetti`, `${cand.name} declined`) : T(`${cand.name} reddedildi`, `${cand.name} rejected`), res === 'declined' ? T('Güveni veya teklifi artırmayı dene.', 'Try more trust or a better offer.') : '', 'amber');
          hooks.log(T(`İK: ${cand.name} — ${res === 'declined' ? 'teklifi kabul etmedi' : 'reddedildi'}.`, `HR: ${cand.name} — ${res}.`), 'info');
        }
        state.hr.history = state.hr.history.slice(0, 30);
        hooks.render();
      }
    });
  }

  // ---------- Rol rehberi (UI) ----------
  function roleGuideHTML(state) {
    const fx = effects(state.workers);
    return `<div class="dz-roles">${Object.entries(ROLES).map(([k, r]) => {
      const n = state.workers.filter(w => w.role === k).length, can = canHire(k, state);
      const avg = n ? Math.round(state.workers.filter(w => w.role === k).reduce((s, w) => s + w.skill, 0) / n) : 0;
      return `<article class="dz-role"><header><span class="dz-ricon" style="--ppe:${r.ppe || '#94a3b8'}">${r.icon}</span><div><b>${U().esc(r.label)}</b><small>${n} ${T('kişi', 'staff')}${n ? ` · ${T('ort. yetkinlik', 'avg skill')} ${avg}` : ''}</small></div></header>
        <dl><div><dt>${T('Maliyet', 'Cost')}</dt><dd>${U().money(wageFor(k, 70))}–${U().money(wageFor(k, 95))}/${T('gün', 'day')}</dd></div>
        <div><dt>${T('Verim etkisi', 'Effect')}</dt><dd>${U().esc(T(r.eff.tr, r.eff.en))}</dd></div>
        <div><dt>${T('Moral', 'Morale')}</dt><dd>${k === 'hr' ? T(`Günlük +${fx.moraleDaily.toFixed(1)} (şu an)`, `Daily +${fx.moraleDaily.toFixed(1)} (now)`) : k === 'hse' ? T('Yorgunluk birikimini azaltır', 'Reduces fatigue build-up') : T('Yüksek moral verimi ×1,0’a kadar taşır', 'High morale lifts output up to ×1.0')}</dd></div>
        <div><dt>${T('İşe alım', 'Hiring')}</dt><dd>${U().esc(condText(k, state))}${can.ok ? '' : ` <span class="dz-warn">${U().esc(can.why)}</span>`}</dd></div></dl></article>`;
    }).join('')}</div>`;
  }

  DSAN.hr = { ROLES, PRODUCTION, effects, roleFit, wageFor, canHire, condText, normalizeWorker, renameWorker, generateCandidates, interview, roleGuideHTML, acceptance, staffCap };
})();
