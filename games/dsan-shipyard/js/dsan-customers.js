/* DSAn — müşteri yolculuğu: transfer → Konyaaltı oteli → saha turu → dallı görüşme → deniz denemesi → satış / iptal.
   Memnuniyet açıklanabilir bileşenlerden (ağırlıklı) hesaplanır; iptal eşiği ve fiyat kabulü açıkça gösterilir. */
(function () {
  'use strict';
  const DSAN = window.DSAN = window.DSAN || {};
  const T = (a, b) => DSAN.T(a, b), U = () => DSAN.util;
  const money = n => U().money(n), esc = s => U().esc(s);

  const CANCEL = 40, HESITANT = 55;
  const COMP = {
    fit: ['Ürün uygunluğu', 'Product fit'], quality: ['Kalite', 'Quality'], delay: ['Teslim / gecikme', 'Delivery / delay'], trial: ['Deneme seyri', 'Sea trial'],
    energy: ['Enerji / yakıt', 'Energy / fuel'], comm: ['İletişim', 'Communication'], transfer: ['Transfer', 'Transfer'], hotel: ['Otel', 'Hotel'],
    welcome: ['Karşılama', 'Welcome'], tour: ['Saha turu', 'Yard tour'], service: ['Satış sonrası servis', 'After-sales service']
  };
  const PERSONAS = {
    owner: { tr: 'Yat sahibi (özel aile ofisi)', en: 'Yacht owner (family office)', bps: ['yacht_fly_28', 'yacht_explorer_42', 'yacht_mega_62'], budget: [1.0, 1.22], minQ: 86,
      w: { fit: .13, quality: .1, delay: .06, trial: .12, energy: .04, comm: .1, transfer: .08, hotel: .1, welcome: .07, tour: .07, service: .13 },
      hotel: { comfort: .45, sea: .35, service: .2, price: 0, cap: 9999 }, tr2: { vip: 95, std: 60, none: 22 }, wants: 'comfort',
      companies: ['Özel aile ofisi — Monaco', 'Kuzey Denizi yatırımcısı — Oslo', 'Körfez özel ofisi — Doha', 'Riviera aile holdingi — Nice'] },
    gov: { tr: 'Kamu alım heyeti', en: 'Public procurement delegation', bps: ['work_pilot_15', 'work_tug_24', 'yacht_sport_18'], budget: [.95, 1.07], minQ: 84,
      w: { fit: .16, quality: .16, delay: .14, trial: .12, energy: .06, comm: .08, transfer: .03, hotel: .03, welcome: .04, tour: .1, service: .08 },
      hotel: { comfort: .25, sea: .05, service: .3, price: .4, cap: 180 }, tr2: { vip: 70, std: 90, none: 62 }, wants: 'reliability',
      companies: ['Sahil güvenlik alım komisyonu', 'Akdeniz kıyı emniyeti ajansı', 'Liman başkanlığı heyeti', 'Arama-kurtarma vakfı'] },
    operator: { tr: 'Ticari operatör', en: 'Commercial operator', bps: ['work_osv_34', 'work_sar_46'], budget: [.96, 1.12], minQ: 82,
      w: { fit: .14, quality: .12, delay: .14, trial: .1, energy: .16, comm: .08, transfer: .04, hotel: .04, welcome: .04, tour: .06, service: .08 },
      hotel: { comfort: .3, sea: .1, service: .35, price: .25, cap: 260 }, tr2: { vip: 84, std: 86, none: 50 }, wants: 'efficiency',
      companies: ['Kent içi deniz ulaşımı operatörü — Rotterdam', 'Offshore rüzgâr hizmetleri — Esbjerg', 'Adalar feribot işletmesi', 'Liman pilotaj şirketi'] },
    broker: { tr: 'Yat brokeri', en: 'Yacht broker', bps: ['yacht_fly_28', 'yacht_explorer_42', 'yacht_mega_62', 'yacht_sport_18'], budget: [.98, 1.14], minQ: 84,
      w: { fit: .12, quality: .1, delay: .1, trial: .12, energy: .04, comm: .14, transfer: .07, hotel: .08, welcome: .07, tour: .06, service: .1 },
      hotel: { comfort: .35, sea: .35, service: .3, price: .1, cap: 600 }, tr2: { vip: 90, std: 70, none: 32 }, wants: 'price',
      companies: ['Riviera yat brokerliği — Antibes', 'Ege yat danışmanlık', 'Palma süperyat temsilciliği', 'Dubai marina brokerliği'] }
  };
  const PERSONALITY = { analytic: ['Analitik', 'Analytical'], warm: ['Sıcak / ilişki odaklı', 'Warm / relationship-led'], impatient: ['Sabırsız', 'Impatient'], haggler: ['Pazarlıkçı', 'Hard bargainer'], detail: ['Detaycı', 'Detail-oriented'] };
  // Konyaaltı otelleri (kurgusal isimler)
  const HOTELS = [
    { id: 'falez', name: 'Falez Kıyı Resort', star: 5, price: 420, comfort: 96, sea: 90, service: 93 },
    { id: 'sahil', name: 'Konyaaltı Sahil Butik', star: 4, price: 210, comfort: 82, sea: 97, service: 85 },
    { id: 'hurma', name: 'Hurma İş Oteli', star: 4, price: 165, comfort: 78, sea: 52, service: 88 },
    { id: 'liman', name: 'Liman Pansiyon', star: 2, price: 70, comfort: 52, sea: 70, service: 58 }
  ];
  const FIRST = ['Lars', 'Sophie', 'Marco', 'Elena', 'Hendrik', 'Amira', 'James', 'Nadia', 'Kemal', 'Leyla', 'Thomas', 'Ingrid', 'Rafael', 'Yasmin'];
  const LAST = ['van Dijk', 'Rossi', 'Andersen', 'Haddad', 'Fischer', 'Kaya', 'Moreau', 'Lindqvist', 'Alvarez', 'O’Neill', 'Demir', 'Novak'];
  const STAGES = ['arrival', 'tour', 'meeting', 'trial', 'decision'];
  const STAGE_TXT = { arrival: ['Transfer & otel', 'Transfer & hotel'], tour: ['Saha turu', 'Yard tour'], meeting: ['Görüşme', 'Meeting'], trial: ['Deniz denemesi', 'Sea trial'], decision: ['Karar', 'Decision'], won: ['Satış', 'Won'], lost: ['İptal', 'Cancelled'] };

  let H = null; // ana oyun kancaları
  const C = DSAN.customers = { CANCEL, HESITANT, COMP, PERSONAS, HOTELS, STAGES, init(hooks) { H = hooks; } };

  // ---------- Yardımcı hesaplar ----------
  function bpOf(v) { return H.getBlueprint(v.bpId); }
  function listPrice(state, bp) { const dm = bp.category === 'Yacht' ? state.marketPrices.yachtDemandMult : state.marketPrices.workboatDemandMult; return Math.round(bp.basePrice * 1.18 * dm / 5000) * 5000; }
  function hotelScore(v, h) {
    const p = PERSONAS[v.persona].hotel;
    let s = p.comfort * h.comfort + p.sea * h.sea + p.service * h.service + p.price * U().clamp(100 - (h.price - 60) / 4, 20, 100);
    s = s / (p.comfort + p.sea + p.service + p.price);
    if (h.price > p.cap) s -= 25; // kamu harcırah sınırı
    if (v.persona === 'owner' && h.star < 4) s -= 30;
    return Math.round(U().clamp(s, 5, 100));
  }
  function estimate(v) { // bilinmeyen bileşenler 60 kabul edilir (tahmini)
    const w = PERSONAS[v.persona].w; let sum = 0, known = 0;
    Object.keys(w).forEach(k => { const c = v.comps[k]; sum += w[k] * (c == null ? 60 : c); if (c != null) known += w[k]; });
    return { score: Math.round(sum), known: Math.round(known * 100) };
  }
  C.satisfaction = v => estimate(v).score;
  function willingness(S) { return .88 + (S - 50) * .006; }
  function maxPrice(v, S) { return Math.round(v.budget * willingness(S) / 5000) * 5000; }
  function yardQuality(state, v) {
    const stock = state.completedFleet.filter(f => f.blueprintId === v.bpId).sort((a, b) => b.qualityScore - a.qualityScore)[0];
    const base = 40 + (state.reputation - 60) * 1.25 + (stock ? (stock.qualityScore - 80) * .8 : 0);
    return Math.round(U().clamp(base, 20, 98));
  }
  function delayBase(state) { const over = state.contracts.filter(c => c.accepted && state.day > c.deadlineDay).length; return U().clamp(86 - over * 15, 20, 95); }
  function cost(state, v, amt, label) { if (!amt) return; state.cash -= amt; v.costs += amt; v.costLog.push([label, amt]); }

  // ---------- Ziyaret üretimi ----------
  C.create = function (state, opts) {
    opts = opts || {};
    const keys = Object.keys(PERSONAS);
    let persona = opts.persona || U().pick(keys), P = PERSONAS[persona];
    let pool = P.bps.map(id => H.getBlueprint(id)).filter(bp => bp && bp.length <= state.maxVesselLength && state.reputation >= bp.minRep - 10);
    if (!pool.length) { persona = 'gov'; P = PERSONAS.gov; pool = P.bps.map(id => H.getBlueprint(id)); }
    const bp = opts.bpId ? H.getBlueprint(opts.bpId) : U().pick(pool), lp = listPrice(state, bp);
    const v = { id: U().uid('vis'), seq: ++state.customers.seq, day: state.day + (opts.now ? 0 : 1), name: U().pick(FIRST) + ' ' + U().pick(LAST), company: U().pick(P.companies), persona,
      personality: opts.personality || U().pick(Object.keys(PERSONALITY)), bpId: bp.id, list: lp, budget: Math.round(lp * U().rand(P.budget[0], P.budget[1]) / 5000) * 5000,
      desiredDays: Math.max(14, Math.round(bp.buildHours / 7) + U().irand(4, 14)), stage: 'arrival', comps: {}, costs: 0, costLog: [], notes: [],
      priceMult: 1, deliveryDays: null, warranty: null, custom: null, hotel: null, transfer: null, trialId: null, stockUid: null, closed: false };
    state.customers.visits.push(v);
    return v;
  };
  C.tick = function (state) { // günlük
    const cs = state.customers, active = cs.visits.filter(v => !v.closed);
    if (state.day >= cs.nextVisitDay && active.length < 3) {
      const v = C.create(state, { now: true });
      cs.nextVisitDay = state.day + U().irand(4, 7);
      H.toast(T('Yeni müşteri ziyareti talebi', 'New client visit request'), `${v.name} · ${T(PERSONAS[v.persona].tr, PERSONAS[v.persona].en)} · ${H.getBlueprint(v.bpId).name}`, 'sky');
      H.log(T(`📨 ${v.company} adına ${v.name}, ${H.getBlueprint(v.bpId).name} için tersane ziyareti istiyor.`, `📨 ${v.name} (${v.company}) requests a yard visit for ${H.getBlueprint(v.bpId).name}.`), 'info');
    }
    // Beklemede bekleyen müşteri sabırsızlanır
    active.forEach(v => { if (state.day - v.day > 6 && !v.closed) { v.comps.welcome = Math.max(10, (v.comps.welcome == null ? 70 : v.comps.welcome) - 4); } });
  };
  C.invite = function (state) {
    const cost = 6000;
    if (state.customers.visits.filter(v => !v.closed).length >= 3) return H.toast(T('Aynı anda en fazla 3 ziyaret', 'Max 3 visits at once'), '', 'amber');
    if (state.cash < cost) return H.toast(T('Bütçe yetersiz', 'Insufficient budget'), money(cost), 'rose');
    state.cash -= cost; const v = C.create(state, { now: true });
    H.toast(T('Tanıtım daveti gönderildi', 'Invitation sent'), `${v.name} — ${H.getBlueprint(v.bpId).name} (−${money(cost)})`, 'emerald'); H.render();
  };

  // ---------- Aşama yürütücü ----------
  C.run = function (state, id) {
    const v = state.customers.visits.find(x => x.id === id); if (!v || v.closed) return;
    const next = () => { H.save(); H.render(); if (!v.closed) setTimeout(() => C.run(state, v.id), 120); };
    const stop = () => { H.save(); H.render(); };
    ({ arrival, tour, meeting, trial, decision })[v.stage](state, v, next, stop);
  };
  function advance(v) { v.stage = STAGES[STAGES.indexOf(v.stage) + 1] || 'decision'; }
  function meters(v) {
    return [
      { label: T('Tahmini memnuniyet', 'Est. satisfaction'), get: () => estimate(v).score, tone: 'emerald' },
      { label: T('Bilinen bileşen', 'Known factors'), get: () => estimate(v).known, fmt: x => T('%' + x, x + '%'), tone: 'sky' },
      { label: T('İptal eşiği', 'Cancel threshold'), get: () => CANCEL, fmt: () => '< ' + CANCEL, tone: 'rose' },
      { label: T('Ziyaret maliyeti', 'Visit cost'), get: () => 0, fmt: () => money(v.costs), bar: false }
    ];
  }
  const head = v => `${esc(v.name)} · ${esc(v.company)}`;
  const persTxt = v => T(PERSONAS[v.persona].tr, PERSONAS[v.persona].en) + ' · ' + T(PERSONALITY[v.personality][0], PERSONALITY[v.personality][1]);

  // 1) Transfer + karşılama + otel
  function arrival(state, v, next, stop) {
    const fx = H.fx(), P = PERSONAS[v.persona], bp = bpOf(v);
    const trCost = { vip: Math.round(1800 * fx.transferCost), std: Math.round(450 * fx.transferCost), none: 0 };
    const hasSales = state.workers.some(w => w.role === 'sales'), hasDriver = state.workers.some(w => w.role === 'driver');
    const fitWord = s => s >= 80 ? [T('Uygunluk yüksek', 'High fit'), 'up'] : s >= 60 ? [T('Uygunluk orta', 'Medium fit'), 'info'] : [T('Uygunluk düşük', 'Low fit'), 'down'];
    DSAN.story({ title: T('Müşteri ziyareti', 'Client visit') + ' · ' + v.name, sub: persTxt(v), ctx: v, start: 'req', meters: meters(v),
      scenes: {
        req: { step: '1/3', image: 'img/cx-airport.webp', title: T('Ziyaret öncesi transfer isteği', 'Pre-visit transfer request'), speaker: v.name,
          text: () => T(`<p>“Merhaba, <b>${esc(bp.name)}</b> için Antalya’ya geliyorum. Havalimanından alınmam mümkün mü?”</p><p class="dz-dim">${esc(v.company)} · ${persTxt(v)} · ${T('Bütçe aralığı gizli', 'Budget hidden')}</p>`,
            `<p>“Hello, I’m flying to Antalya for the <b>${esc(bp.name)}</b>. Could you pick me up at the airport?”</p><p class="dz-dim">${esc(v.company)} · ${persTxt(v)}</p>`),
          choices: [
            { label: T('VIP Vito (konforlu, deri koltuk, su/ıslak havlu)', 'VIP Vito (luxury van)'), hint: T(`Maliyet ${money(trCost.vip)} · zamanında karşılama %${Math.round((.95 + fx.punct) * 100)}`, `Cost ${money(trCost.vip)} · on-time ${Math.round((.95 + fx.punct) * 100)}%`), chips: [[T('Memnuniyet: ', 'Satisfaction: ') + P.tr2.vip, P.tr2.vip >= 80 ? 'up' : 'info']], apply: () => pickTr('vip') },
            { label: T('Standart araç', 'Standard car'), hint: T(`Maliyet ${money(trCost.std)} · zamanında %${Math.round((.86 + fx.punct) * 100)}`, `Cost ${money(trCost.std)} · on-time ${Math.round((.86 + fx.punct) * 100)}%`), chips: [[T('Memnuniyet: ', 'Satisfaction: ') + P.tr2.std, P.tr2.std >= 80 ? 'up' : 'info']], apply: () => pickTr('std') },
            { label: T('Transfer sağlama (taksiyle gelsin)', 'No transfer (taxi)'), hint: T('Maliyet $0', 'Cost $0'), chips: [[T('Memnuniyet: ', 'Satisfaction: ') + P.tr2.none, P.tr2.none >= 60 ? 'info' : 'down']], apply: () => pickTr('none') }
          ] },
        greet: { step: '2/3', image: 'img/cx-airport.webp', title: T('Karşılama', 'Welcome'), speaker: T('Sen', 'You'),
          text: () => T('<p>Müşteriyi kim karşılasın?</p>', '<p>Who should welcome the client?</p>'),
          choices: [
            { label: T('Satış müdürü havalimanında karşılasın', 'Sales manager meets at the airport'), hint: hasSales ? T('Satış ekibinden biri gidecek', 'A sales team member goes') : T('Satış uzmanı yok; genel müdür yardımcısı gider', 'No sales staff; deputy GM goes'), chips: [[T('Karşılama ', 'Welcome ') + (hasSales ? 92 : 80), 'up']], apply: c => { c.comps.welcome = hasSales ? 92 : 80; return { next: 'hotel' }; } },
            { label: T('Şoför isim tabelasıyla karşılasın', 'Driver with a name board'), chips: [[T('Karşılama ', 'Welcome ') + (hasDriver ? 76 : 70), 'info']], apply: c => { c.comps.welcome = hasDriver ? 76 : 70; return { next: 'hotel' }; } },
            { label: T('Ertesi sabah otelde buluşun', 'Meet at the hotel next morning'), chips: [[T('Karşılama ', 'Welcome ') + (v.personality === 'impatient' ? 45 : 56), 'down']], apply: c => { c.comps.welcome = v.personality === 'impatient' ? 45 : 56; return { next: 'hotel' }; } }
          ] },
        hotel: { step: '3/3', image: 'img/cx-hotel.webp', title: T('Konyaaltı’nda otel seçimi', 'Hotel in Konyaaltı'), speaker: T('Konaklama (2 gece)', 'Stay (2 nights)'),
          text: () => T(`<p>Konfor, denize yakınlık, servis ve fiyat bu müşterinin profiline göre farklı ağırlık taşır. ${v.persona === 'gov' ? 'Kamu heyetinin gecelik harcırah sınırı <b>$180</b>.' : ''}</p>`, `<p>Comfort, sea proximity, service and price weigh differently for this client. ${v.persona === 'gov' ? 'Public delegation per-diem cap: <b>$180</b>/night.' : ''}</p>`),
          choices: () => HOTELS.map(h => { const s = hotelScore(v, h); return { label: `${h.name} ${'★'.repeat(h.star)}`, hint: T(`${money(h.price)}/gece · konfor ${h.comfort} · denize yakınlık ${h.sea} · servis ${h.service}`, `${money(h.price)}/night · comfort ${h.comfort} · sea ${h.sea} · service ${h.service}`), chips: [fitWord(s), [T('Otel puanı ', 'Hotel score ') + s, 'info']],
            apply: c => { c.hotel = h.id; c.comps.hotel = s; cost(state, c, h.price * 2, T('Otel', 'Hotel')); return { end: { ok: true } }; } }; })
        }
      },
      onEnd: (c, r) => { if (r && r.ok) { advance(v); H.log(T(`🚐 ${v.name}: transfer ve otel ayarlandı (memnuniyet tahmini ${estimate(v).score}).`, `🚐 ${v.name}: transfer and hotel arranged (est. ${estimate(v).score}).`), 'info'); next(); } else stop(); }
    });
    function pickTr(k) {
      v.transfer = k; cost(state, v, trCost[k], 'Transfer');
      if (k === 'none') { v.comps.transfer = P.tr2.none; return { next: 'greet', note: T('Müşteri kendi imkânıyla gelecek.', 'The client will make their own way.') }; }
      const onTime = Math.random() < (k === 'vip' ? .95 : .86) + fx.punct;
      v.comps.transfer = Math.max(5, P.tr2[k] - (onTime ? 0 : 28));
      return { next: 'greet', note: onTime ? T('Araç uçak inmeden kapıdaydı. ✓ Zamanında karşılama.', 'The car was waiting before landing. ✓ On time.') : T('Trafik nedeniyle 35 dakika gecikme yaşandı (−28).', 'A 35-minute delay due to traffic (−28).') };
    }
  }

  // 2) Saha turu
  function tour(state, v, next, stop) {
    const fx = H.fx(), bp = bpOf(v), P = PERSONAS[v.persona];
    const rel = { owner: ['sales', 'outfitter', 'architect'], gov: ['quality', 'hse', 'architect'], operator: ['architect', 'hybrid', 'electrical'], broker: ['sales', 'architect', 'outfitter'] }[v.persona];
    const ctx = Object.assign(v, {}); const tv = { brief: 0, ppe: 0, order: 0, escort: 0, risk: 0 };
    const escorts = state.workers.slice().sort((a, b) => (rel.indexOf(a.role) < 0 ? 9 : rel.indexOf(a.role)) - (rel.indexOf(b.role) < 0 ? 9 : rel.indexOf(b.role)) || b.skill - a.skill).slice(0, 4);
    const sameBuild = state.docks.find(d => d.activeBuild && d.activeBuild.blueprintId === v.bpId), active = state.docks.filter(d => d.activeBuild).length;
    const progress = sameBuild ? 8 + Math.round(sameBuild.activeBuild.progressHours / sameBuild.activeBuild.totalHours * 10) : 0;
    const finishTour = () => {
      let s = 50 + tv.brief + tv.ppe + tv.order + tv.escort + progress + (active >= 2 ? 4 : 0) + Math.min(10, fx.tourSafety + fx.tourOrder);
      let incident = false;
      if (tv.risk && Math.random() < tv.risk) { s -= 20; incident = true; }
      v.comps.tour = Math.round(U().clamp(s, 5, 100));
      return incident;
    };
    DSAN.story({ title: T('Saha turu', 'Yard tour') + ' · ' + v.name, sub: persTxt(v), ctx, start: 'brief', meters: meters(v),
      scenes: {
        brief: { step: '1/4', image: 'img/hr-safety.webp', title: T('Güvenlik brifingi', 'Safety briefing'), speaker: T('İSG', 'HSE'),
          text: () => T('<p>Misafir üretim hollerine girmeden önce brifing alacak mı?</p>', '<p>Will the guest get a briefing before entering the halls?</p>'),
          choices: [
            { label: T('Tam brifing (20 dk, acil toplanma noktası, yürüyüş yolları)', 'Full briefing (20 min, muster point, walkways)'), chips: [[T('Tur +', 'Tour +') + (v.personality === 'impatient' ? 8 : 14), 'up']], apply: () => { tv.brief = v.personality === 'impatient' ? 8 : 14; return { next: 'ppe' }; } },
            { label: T('Kısa brifing (5 dk)', 'Short briefing (5 min)'), chips: [[T('Tur +6', 'Tour +6'), 'info']], apply: () => { tv.brief = 6; tv.risk += .04; return { next: 'ppe' }; } },
            { label: T('Brifingsiz devam', 'Skip the briefing'), chips: [[T('Kaza/ihlal riski', 'Incident risk'), 'down']], apply: () => { tv.brief = -6; tv.risk += .18; return { next: 'ppe' }; } }
          ] },
        ppe: { step: '2/4', image: 'img/hr-safety.webp', title: T('KKD (PPE)', 'PPE'), speaker: T('İSG', 'HSE'),
          text: () => T('<p>Misafire hangi koruyucu donanım verilecek?</p>', '<p>What protective equipment does the guest get?</p>'),
          choices: [
            { label: T('Tam misafir seti: baret, gözlük, yelek, çelik burunlu ayakkabı', 'Full guest kit: helmet, glasses, vest, safety shoes'), hint: '$350', chips: [[T('Tur +12', 'Tour +12'), 'up']], apply: () => { tv.ppe = 12; cost(state, v, 350, 'KKD'); return { next: 'order' }; } },
            { label: T('Yalnızca reflektörlü yelek', 'Reflective vest only'), chips: [[T('Tur +4', 'Tour +4'), 'info']], apply: () => { tv.ppe = 4; tv.risk += .05; return { next: 'order' }; } },
            { label: T('KKD verme', 'No PPE'), chips: [[T('Tur −10', 'Tour −10'), 'down'], [T('İhlal riski', 'Violation risk'), 'down']], apply: () => { tv.ppe = tv.brief < 0 ? -25 : -10; tv.risk += .1; return { next: 'order', note: tv.brief < 0 ? T('Brifingsiz ve KKD’siz tur İSG ihlalidir! (−25)', 'No briefing and no PPE is an HSE violation! (−25)') : '' }; } }
          ] },
        order: { step: '3/4', image: 'img/cx-meeting.webp', title: T('Alan düzeni', 'Site order'), speaker: T('Operasyon', 'Operations'),
          text: () => T('<p>Tur güzergâhı nasıl hazırlansın?</p>', '<p>How should the tour route be prepared?</p>'),
          choices: [
            { label: T('5S düzen ve temizlik ekibi', '5S tidy-up crew'), hint: '$2.500', chips: [[T('Tur +10', 'Tour +10'), 'up']], apply: () => { tv.order = 10; cost(state, v, 2500, '5S'); return { next: 'escort' }; } },
            { label: T('Olduğu gibi göster (gerçek üretim temposu)', 'Show it as it is (real production pace)'), chips: [[v.personality === 'analytic' ? T('Analitik müşteri sever +3', 'Analytic likes it +3') : T('Tur ±0', 'Tour ±0'), 'info']], apply: () => { tv.order = v.personality === 'analytic' ? 3 : 0; return { next: 'escort' }; } }
          ] },
        escort: { step: '4/4', image: 'img/cx-meeting.webp', title: T('Uzman eşliği', 'Expert escort'), speaker: T('Sen', 'You'),
          text: () => T(`<p>Turda müşteriye kim eşlik etsin? Bu profil için en uygun roller: <b>${rel.map(r => esc(DSAN.hr.ROLES[r].label)).join(', ')}</b>.</p><p>${sameBuild ? `${sameBuild.code} holünde aynı modelden bir tekne %${Math.round(sameBuild.activeBuild.progressHours / sameBuild.activeBuild.totalHours * 100)} ilerlemede; müşteri bunu görecek (+${progress}).` : 'Holde aynı modelden bir inşa yok; müşteri genel üretimi görecek.'}</p>`,
            `<p>Who escorts the client? Best roles for this profile: <b>${rel.map(r => esc(DSAN.hr.ROLES[r].label)).join(', ')}</b>.</p><p>${sameBuild ? `A hull of this model is ${Math.round(sameBuild.activeBuild.progressHours / sameBuild.activeBuild.totalHours * 100)}% complete in ${sameBuild.code} (+${progress}).` : 'No build of this model in the halls; the client sees general production.'}</p>`),
          choices: () => escorts.map(w => { const match = rel.indexOf(w.role) >= 0, sc = Math.round((w.skill - 60) / 3 * (match ? 1 : .35)); return { label: `${w.name} — ${DSAN.hr.ROLES[w.role].label}`, chips: [[(match ? T('Uygun rol', 'Matching role') : T('Rol uyumsuz', 'Role mismatch')), match ? 'up' : 'down'], [T('Tur ', 'Tour ') + U().sign(sc), sc > 0 ? 'up' : 'info']],
            apply: () => { tv.escort = sc; const inc = finishTour(); return { end: { ok: true, incident: inc, by: w.name } }; } }; })
        }
      },
      onEnd: (c, r) => {
        if (!(r && r.ok)) return stop();
        if (r.incident) { H.log(T(`⚠️ ${v.name} turu sırasında küçük bir İSG olayı yaşandı (tur −20).`, `⚠️ A minor HSE incident during ${v.name}'s tour (tour −20).`), 'warn'); H.toast(T('Turda İSG olayı', 'HSE incident on tour'), T('Brifing ve KKD riski azaltır.', 'Briefing and PPE reduce the risk.'), 'rose'); state.reputation = Math.max(30, state.reputation - 1); }
        v.comps.quality = yardQuality(state, v); v.comps.delay = delayBase(state);
        advance(v); next();
      }
    });
  }

  // 3) Görüşme
  function meeting(state, v, next, stop) {
    const fx = H.fx(), bp = bpOf(v), P = PERSONAS[v.persona], pers = v.personality;
    const stock = state.completedFleet.filter(f => f.blueprintId === v.bpId).sort((a, b) => b.qualityScore - a.qualityScore)[0];
    const m = { fit: 60, comm: 55 + fx.comm, service: 60, extra: 0, priceAdd: 0, days: v.desiredDays, delayAdj: 0 };
    const elec = ['work_osv_34', 'yacht_explorer_42', 'yacht_mega_62'].includes(v.bpId);
    const priceNow = () => Math.round(v.list * (v.priceMult + m.priceAdd) / 5000) * 5000;
    const mm = meters(v).concat([{ label: T('Teklif fiyatı', 'Quoted price'), get: () => 0, fmt: () => money(priceNow()), bar: false }]);
    const commit = () => { v.comps.fit = Math.round(U().clamp(m.fit, 5, 100)); v.comps.comm = Math.round(U().clamp(m.comm, 5, 100)); v.comps.service = Math.round(U().clamp(m.service, 5, 100)); v.comps.delay = Math.round(U().clamp(delayBase(state) + m.delayAdj, 5, 100)); };
    DSAN.story({ title: T('Müşteri görüşmesi', 'Client meeting') + ' · ' + v.name, sub: persTxt(v) + ' · ' + bp.name, ctx: v, start: 'needs', meters: mm,
      scenes: {
        needs: { step: '1/6', image: 'img/cx-meeting.webp', title: T('İhtiyaç analizi', 'Needs analysis'), speaker: v.name,
          text: () => ({ comfort: T('<p>“Ailem ve misafirlerim için sessiz, konforlu ve uzun menzilli bir platform istiyorum.”</p>', '<p>“I want a quiet, comfortable, long-range platform for family and guests.”</p>'), reliability: T('<p>“Her havada görev yapabilen, bakımı kolay ve klas onaylı bir tekne arıyoruz.”</p>', '<p>“We need an all-weather, easy-to-maintain, class-approved vessel.”</p>'), efficiency: T('<p>“Yakıt/enerji maliyeti ve sefer güvenilirliği bizim için her şey.”</p>', '<p>“Fuel/energy cost and service reliability are everything for us.”</p>'), price: T('<p>“Alıcım net bir fiyat ve hızlı teslim bekliyor; piyasayı iyi biliyoruz.”</p>', '<p>“My buyer wants a clear price and quick delivery; we know the market.”</p>') })[P.wants],
          choices: [
            { label: T('Dinle, soru sor, not al', 'Listen, ask, take notes'), chips: [[T('Uygunluk +12', 'Fit +12'), 'up'], [T('İletişim +8', 'Comm +8'), 'up']], apply: () => { m.fit += 12; m.comm += 8 + (pers === 'warm' ? 4 : 0); return { next: 'tech' }; } },
            { label: T('Hazır kataloğu sun, hızlı geç', 'Present the catalogue, move fast'), chips: [[T('İletişim ', 'Comm ') + (pers === 'impatient' ? '+6' : '−4'), pers === 'impatient' ? 'up' : 'down']], apply: () => { m.comm += pers === 'impatient' ? 6 : -4; return { next: 'tech' }; } },
            { label: T('Rakip teklifleri ve bütçeyi sor', 'Ask about rival offers and budget'), chips: [[T('Bütçe ipucu', 'Budget hint'), 'info'], [T('İletişim ', 'Comm ') + (pers === 'haggler' ? '−6' : '−2'), 'down']], apply: () => { m.comm -= pers === 'haggler' ? 6 : 2; return { next: 'tech', note: T(`Müşteri ${money(Math.round(v.budget * .97 / 50000) * 50000)} civarını “makul” bulduğunu ima etti.`, `The client hints that about ${money(Math.round(v.budget * .97 / 50000) * 50000)} would be “reasonable”.`) }; } }
          ] },
        tech: { step: '2/6', image: 'img/cx-meeting.webp', title: T('Teknik çözüm', 'Technical solution'), speaker: T('Mühendislik', 'Engineering'),
          text: () => T(`<p>${esc(bp.name)} için hangi konfigürasyonu önereceksin?</p>`, `<p>Which configuration do you propose for the ${esc(bp.name)}?</p>`),
          choices: [
            { label: T('Standart, kanıtlanmış konfigürasyon', 'Standard, proven configuration'), chips: [[T('Uygunluk +4', 'Fit +4'), 'info'], [T('Fiyat ±0', 'Price ±0'), 'info']], apply: () => { m.fit += 4 + (v.persona === 'gov' ? 6 : 0); return { next: 'price' }; } },
            { label: elec ? T('Genişletilmiş batarya / hibrit paket', 'Extended battery / hybrid pack') : T('Hibrit-hazır tahrik + verim paketi', 'Hybrid-ready drive + efficiency pack'), chips: [[T('Fiyat +%6', 'Price +6%'), 'info'], [T('Enerji odaklıya uygun', 'Suits efficiency focus'), P.wants === 'efficiency' ? 'up' : 'info']], apply: () => { m.priceAdd += .06; m.fit += P.wants === 'efficiency' ? 14 : P.wants === 'comfort' ? 6 : 2; m.days += 6; v.energyPack = true; return { next: 'price' }; } },
            { label: T('Özel güverte & iç mimari tasarımı', 'Custom deck & interior design'), chips: [[T('Fiyat +%9', 'Price +9%'), 'info'], [T('Teslim +10 gün', 'Delivery +10 d'), 'down']], apply: () => { m.priceAdd += .09; m.fit += P.wants === 'comfort' ? 15 : pers === 'detail' ? 10 : 0; m.days += 10; cost(state, v, Math.round(v.list * .012), T('Ön tasarım', 'Concept design')); return { next: 'price' }; } }
          ] },
        price: { step: '3/6', image: 'img/cx-meeting.webp', title: T('Fiyat ve teslim tarihi', 'Price & delivery'), speaker: T('Sen', 'You'),
          text: () => T(`<p>Liste fiyatı <b>${money(v.list)}</b>. Müşterinin istediği teslim: <b>${v.desiredDays} gün</b>.${stock ? ` Rıhtımda aynı modelden stok tekne var: <b>${esc(stock.customName)}</b> (kalite ${stock.qualityScore}).` : ''}</p>`,
            `<p>List price <b>${money(v.list)}</b>. Desired delivery: <b>${v.desiredDays} days</b>.${stock ? ` A stock vessel of this model is at the quay: <b>${esc(stock.customName)}</b> (quality ${stock.qualityScore}).` : ''}</p>`),
          choices: () => [
            stock && { label: T('Stoktan hemen teslim (rıhtımdaki tekne)', 'Immediate delivery from stock'), chips: [[T('Gecikme puanı +12', 'Delay +12'), 'up'], [T('Fiyat ±0', 'Price ±0'), 'info']], apply: () => { v.stockUid = stock.uid; m.delayAdj += 12; m.days = 0; return { next: 'service' }; } },
            { label: T('Gerçekçi takvim', 'Realistic schedule'), hint: T(`${m.days} gün`, `${m.days} days`), chips: [[T('Gecikme +5', 'Delay +5'), 'up']], apply: () => { m.delayAdj += 5; return { next: 'service' }; } },
            { label: T('Agresif takvim (−%20 gün)', 'Aggressive schedule (−20% days)'), chips: [[T('Uygunluk +6', 'Fit +6'), 'up'], [T('Sözleşme süresi kısalır', 'Shorter deadline'), 'down']], apply: () => { m.days = Math.round(m.days * .8); m.fit += 6; m.delayAdj += 8; return { next: 'service', note: T('Dikkat: sözleşme süresi kısa; gecikirsen itibar kaybedersin.', 'Careful: tight deadline; delays cost reputation.') }; } },
            { label: T('Tamponlu takvim (+%25 gün)', 'Buffered schedule (+25% days)'), chips: [[T('Gecikme ', 'Delay ') + (pers === 'impatient' ? '−14' : '−8'), 'down']], apply: () => { m.days = Math.round(m.days * 1.25); m.delayAdj -= pers === 'impatient' ? 14 : 8; return { next: 'service' }; } }
          ].filter(Boolean) },
        service: { step: '4/6', image: 'img/cx-meeting.webp', title: T('Garanti ve servis', 'Warranty & service'), speaker: v.name,
          text: () => T('<p>“Teslimden sonra yanımızda olacak mısınız?”</p>', '<p>“Will you be there for us after delivery?”</p>'),
          choices: [
            { label: T('Standart 12 ay garanti', 'Standard 12-month warranty'), chips: [[T('Servis 58', 'Service 58'), 'info']], apply: () => { m.service = 58; v.warranty = 12; return { next: 'custom' }; } },
            { label: T('24 ay + Antalya servis istasyonu önceliği', '24 months + Antalya service priority'), hint: T(`Maliyet ${money(Math.round(v.list * .01))}`, `Cost ${money(Math.round(v.list * .01))}`), chips: [[T('Servis 82', 'Service 82'), 'up']], apply: () => { m.service = 82; v.warranty = 24; cost(state, v, Math.round(v.list * .01), T('Garanti karşılığı', 'Warranty reserve')); return { next: 'custom' }; } },
            { label: T('Uzaktan izleme + yerinde ekip (premium, +%2 fiyat)', 'Remote monitoring + on-site team (premium, +2%)'), chips: [[T('Servis 92', 'Service 92'), 'up'], [T('Fiyat +%2', 'Price +2%'), 'info']], apply: () => { m.service = 92 + (P.wants === 'reliability' ? 4 : 0); m.priceAdd += .02; v.warranty = 36; return { next: 'custom' }; } }
          ] },
        custom: { step: '5/6', image: 'img/cx-meeting.webp', title: T('Kişiselleştirme', 'Personalisation'), speaker: v.name,
          text: () => T('<p>Renk, isim, iç mekân ve teslim töreni hakkında ne sunacaksın?</p>', '<p>What do you offer on colours, name, interior and handover ceremony?</p>'),
          choices: [
            { label: T('Gövde rengi + tekne adı + imza töreni', 'Hull colour + vessel name + signing ceremony'), hint: '$1.200', chips: [[T('Uygunluk +6', 'Fit +6'), 'up'], [T('İletişim +5', 'Comm +5'), 'up']], apply: () => { m.fit += 6; m.comm += 5 + (pers === 'warm' ? 4 : 0); cost(state, v, 1200, T('Tören', 'Ceremony')); v.custom = 'full'; return { next: 'nego' }; } },
            { label: T('Seçili paketlerle sınırlı kişiselleştirme', 'Limited options from set packages'), chips: [[T('Uygunluk +2', 'Fit +2'), 'info']], apply: () => { m.fit += 2 + (v.persona === 'gov' ? 3 : 0); v.custom = 'limited'; return { next: 'nego' }; } },
            { label: T('Kişiselleştirme yok, maliyeti düşük tut', 'No personalisation, keep costs low'), chips: [[T('Uygunluk ', 'Fit ') + (pers === 'detail' || v.persona === 'owner' ? '−8' : '±0'), pers === 'detail' || v.persona === 'owner' ? 'down' : 'info']], apply: () => { if (pers === 'detail' || v.persona === 'owner') m.fit -= 8; v.custom = 'none'; return { next: 'nego' }; } }
          ] },
        nego: { step: '6/6', image: 'img/cx-meeting.webp', title: T('Pazarlık', 'Negotiation'), speaker: v.name,
          text: () => T(`<p>“Teklifiniz <b>${money(priceNow())}</b>. ${pers === 'haggler' ? 'Bu rakamla imza zor, biraz daha iyileştirmeniz gerek.' : 'Rakamı biraz daha konuşabilir miyiz?'}”</p>`, `<p>“Your quote is <b>${money(priceNow())}</b>. ${pers === 'haggler' ? 'Hard to sign at this number, you need to improve it.' : 'Can we talk about the number a bit?'}”</p>`),
          choices: [
            { label: T('Fiyatı koru, değeri anlat (kalite, servis, deneme)', 'Hold the price, explain the value'), chips: [[T('İletişim ', 'Comm ') + (pers === 'haggler' ? '−8' : pers === 'analytic' ? '+4' : '−2'), pers === 'analytic' ? 'up' : 'down']], apply: () => { m.comm += pers === 'haggler' ? -8 : pers === 'analytic' ? 4 : -2; return finishMeeting(); } },
            { label: T('%4 indirim ver', 'Give a 4% discount'), chips: [[T('Fiyat −%4', 'Price −4%'), 'down'], [T('İletişim +6', 'Comm +6'), 'up']], apply: () => { m.priceAdd -= .04; m.comm += 6 + (pers === 'haggler' ? 4 : 0); return finishMeeting(); } },
            { label: T('Fiyat sabit, ek hizmet ver (mürettebat eğitimi + yedek parça)', 'Keep price, add services (crew training + spares)'), hint: money(Math.round(v.list * .008)), chips: [[T('Servis +6', 'Service +6'), 'up'], [T('İletişim +4', 'Comm +4'), 'up']], apply: () => { m.service += 6; m.comm += 4; cost(state, v, Math.round(v.list * .008), T('Ek hizmet', 'Extra services')); return finishMeeting(); } }
          ] }
      },
      onEnd: (c, r) => { if (!(r && r.ok)) return stop(); advance(v); next(); }
    });
    function finishMeeting() { v.priceMult = +(v.priceMult + m.priceAdd).toFixed(3); v.deliveryDays = m.days; commit(); return { end: { ok: true } }; }
  }

  // 4) Deniz denemesi
  function trial(state, v, next, stop) {
    const bp = bpOf(v), stock = v.stockUid ? state.completedFleet.find(f => f.uid === v.stockUid) : state.completedFleet.filter(f => f.blueprintId === v.bpId).sort((a, b) => b.qualityScore - a.qualityScore)[0];
    const sp = DSAN.vessels.SPECS[v.bpId];
    const md = DSAN.ui.modal({ title: T('Deniz denemesi', 'Sea trial') + ' · ' + v.name, sub: bp.name, wide: true, body: `<div class="dz-scene"><figure class="dz-art"><img src="img/cx-seatrial.webp" alt=""><figcaption>${T('Konyaaltı açıkları', 'Off Konyaaltı')}</figcaption></figure>
      <div class="dz-txt"><p>${stock ? T(`Rıhtımdaki <b>${esc(stock.customName)}</b> (kalite ${stock.qualityScore}) ile gerçek deneme yapılabilir.`, `A real trial is possible with <b>${esc(stock.customName)}</b> (quality ${stock.qualityScore}) at the quay.`) : T('Bu modelden stok tekne yok; tersanenin demo teknesiyle (kalite itibarına bağlı) deneme yapılabilir.', 'No stock vessel; a trial with the yard demo boat (quality tied to reputation) is possible.')}</p>
      <p class="dz-dim">${T('Deneme puanı ve enerji ölçümü memnuniyete doğrudan girer. Denemeyi atlamak bu bileşenleri nötr/düşük bırakır.', 'Trial score and energy readings feed satisfaction directly. Skipping leaves them neutral/low.')}</p>
      <div class="dz-choices"><button class="dz-choice" data-t="go"><kbd>1</kbd><span><b>${T('Seyire gönder (sinematik)', 'Send to sea (cinematic)')}</b><small>${T('Yakıt + mürettebat yaklaşık ', 'Fuel + crew about ')}${money((sp.energy === 'electric' ? 260 : Math.round(sp.burn * .69)) + 1500)}</small></span></button>
      <button class="dz-choice" data-t="skip"><kbd>2</kbd><span><b>${T('Denemeyi atla', 'Skip the trial')}</b><small>${T('Deneme puanı ', 'Trial score ')}${v.personality === 'analytic' ? 40 : 50}</small></span></button></div></div></div>`,
      onClose: r => { if (r !== 'go' && r !== 'skip') stop(); } });
    md.body.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      if (b.dataset.t === 'skip') { v.comps.trial = v.personality === 'analytic' ? 40 : 50; v.comps.energy = sp.energy === 'electric' ? 80 : sp.energy === 'hybrid' ? 70 : 60; md.close('skip'); advance(v); next(); return; }
      md.close('go');
      const q = stock ? stock.qualityScore : Math.round(U().clamp(state.reputation + 2, 70, 95));
      H.seaTrial({ bp, name: stock ? stock.customName : T('DSAn demo teknesi', 'DSAn demo boat'), uid: stock ? stock.uid : 'demo_' + v.id, quality: q, demo: !stock }, rep => {
        if (!rep) { stop(); return; }
        v.comps.trial = Math.round(rep.overall * (stock ? 1 : .95)); v.comps.energy = rep.scores.energy; v.trialId = rep.id;
        cost(state, v, rep.cost, T('Deneme yakıtı', 'Trial fuel'));
        advance(v); next();
      });
    });
  }

  // 5) Karar: açıklanabilir memnuniyet + fiyat kabulü / iptal
  function decision(state, v, next, stop) {
    const bp = bpOf(v), P = PERSONAS[v.persona], w = P.w;
    Object.keys(w).forEach(k => { if (v.comps[k] == null) v.comps[k] = 60; });
    const S = estimate(v).score, price = Math.round(v.list * v.priceMult / 5000) * 5000, max = maxPrice(v, S);
    const zone = S < CANCEL ? 'cancel' : S < HESITANT ? 'hesitant' : price <= max ? 'accept' : 'counter';
    const rows = Object.keys(w).sort((a, b) => w[b] - w[a]).map(k => `<tr><td>${T(COMP[k][0], COMP[k][1])}</td><td>%${Math.round(w[k] * 100)}</td><td>${DSAN.ui.bar(v.comps[k], v.comps[k] < 50 ? 'rose' : v.comps[k] >= 80 ? 'emerald' : 'sky')}<b>${v.comps[k]}</b></td><td>${(w[k] * v.comps[k]).toFixed(1)}</td></tr>`).join('');
    const msg = {
      cancel: T(`Memnuniyet <b>${S}</b>, iptal eşiği olan <b>${CANCEL}</b>’ın altında: müşteri siparişten vazgeçiyor.`, `Satisfaction <b>${S}</b> is below the cancel threshold <b>${CANCEL}</b>: the client walks away.`),
      hesitant: T(`Memnuniyet <b>${S}</b> (kararsız bölge ${CANCEL}–${HESITANT}). Müşteri ancak ek indirimle imzalar.`, `Satisfaction <b>${S}</b> (hesitant zone ${CANCEL}–${HESITANT}). The client signs only with an extra discount.`),
      accept: T(`Memnuniyet <b>${S}</b>. Teklifin <b>${money(price)}</b>, müşterinin ödemeye razı olduğu üst sınır <b>${money(max)}</b>: kabul!`, `Satisfaction <b>${S}</b>. Your quote <b>${money(price)}</b> is within the client's ceiling <b>${money(max)}</b>: accepted!`),
      counter: T(`Memnuniyet <b>${S}</b>. Teklifin <b>${money(price)}</b> müşterinin üst sınırı <b>${money(max)}</b>’ı aşıyor; karşı teklif: <b>${money(max)}</b>.`, `Satisfaction <b>${S}</b>. Your quote <b>${money(price)}</b> exceeds the ceiling <b>${money(max)}</b>; counter-offer: <b>${money(max)}</b>.`)
    }[zone];
    const disc = Math.round(Math.min(price * .94, max) / 5000) * 5000;
    const btns = zone === 'cancel' ? `<button class="dz-btn" data-d="close">${T('Anlaşıldı', 'Understood')}</button>`
      : zone === 'hesitant' ? `<button class="dz-btn pri" data-d="disc">${T('Ek indirimle imzala', 'Sign with extra discount')} (${money(disc)})</button><button class="dz-btn" data-d="walk">${T('Vazgeç', 'Let it go')}</button>`
      : zone === 'accept' ? `<button class="dz-btn pri" data-d="sign">${T('Sözleşmeyi imzala', 'Sign the contract')} (${money(price)})</button>`
      : `<button class="dz-btn pri" data-d="counter">${T('Karşı teklifi kabul et', 'Accept counter-offer')} (${money(max)})</button><button class="dz-btn" data-d="walk">${T('Reddet', 'Decline')}</button>`;
    const mod = DSAN.ui.modal({ title: T('Satış kararı', 'Sales decision') + ' · ' + v.name, sub: `${bp.name} · ${persTxt(v)}`, wide: true, closable: zone !== 'accept' && zone !== 'counter' ? true : true,
      body: `<div class="dz-decision"><div class="dz-gauge"><div class="dz-gbar"><i style="width:${S}%"></i><em style="left:${CANCEL}%" title="${T('İptal eşiği', 'Cancel threshold')}"></em><em class="h" style="left:${HESITANT}%"></em></div><div class="dz-glab"><span>0</span><span style="left:${CANCEL}%">${T('İptal', 'Cancel')} ${CANCEL}</span><span style="left:${HESITANT}%">${T('Kararsız', 'Hesitant')} ${HESITANT}</span><span>100</span></div><b class="dz-gs">${S}</b></div>
        <p class="dz-verdict ${zone}">${msg}</p>
        <table class="dz-ctab"><thead><tr><th>${T('Bileşen', 'Factor')}</th><th>${T('Ağırlık', 'Weight')}</th><th>${T('Puan', 'Score')}</th><th>${T('Katkı', 'Contribution')}</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="dz-dim">${T(`Fiyat kabul kuralı: üst sınır = müşteri bütçesi × (0,88 + (memnuniyet − 50) × 0,006). Memnun müşteri daha yüksek fiyatı kabul eder. Ziyaret maliyeti: ${money(v.costs)}.`, `Price rule: ceiling = client budget × (0.88 + (satisfaction − 50) × 0.006). Happier clients accept higher prices. Visit cost: ${money(v.costs)}.`)}</p>
        <div class="dz-actions">${btns}</div></div>`,
      onClose: r => { if (!v.closed) stop(); } });
    mod.body.addEventListener('click', e => {
      const b = e.target.closest('[data-d]'); if (!b) return; const d = b.dataset.d;
      if (d === 'sign') win(price); else if (d === 'counter') win(max); else if (d === 'disc') win(disc);
      else lose(d === 'close' ? 'cancel' : 'walk');
      mod.close('done');
    });
    function win(p) {
      v.closed = true; v.stage = 'won'; v.finalPrice = p; v.sat = S;
      const rep = S >= 80 ? 2 : 1; state.reputation = Math.min(100, state.reputation + rep);
      const stock = v.stockUid ? state.completedFleet.find(f => f.uid === v.stockUid) : null;
      if (stock) {
        state.cash += p; state.totalRevenue += p; state.totalSold += 1;
        state.salesHistory.unshift({ name: stock.customName, model: stock.modelName, category: stock.category, quality: stock.qualityScore, buyer: `${v.company} (${T('ziyaret', 'visit')})`, price: p });
        state.completedFleet = state.completedFleet.filter(f => f.uid !== stock.uid);
        H.log(T(`🤝 ${v.company}: stoktaki ${stock.customName} ${money(p)} bedelle satıldı (memnuniyet ${S}).`, `🤝 ${v.company}: stock ${stock.customName} sold for ${money(p)} (satisfaction ${S}).`), 'success');
      } else {
        const up = Math.round(p * .25), days = Math.max(10, v.deliveryDays || v.desiredDays);
        state.contracts.push({ id: U().uid('c_vis'), clientName: v.company, blueprintId: v.bpId, vesselName: (bp.category === 'Yacht' ? 'M/Y ' : 'DSAn ') + v.name.split(' ').pop() + '-' + v.seq, rewardTotal: p, upfrontPaid: up, remainingPayout: p - up, minQuality: P.minQ, deadlineDay: state.day + days, accepted: true, fromVisit: v.id });
        state.cash += up;
        H.log(T(`✍️ ${v.company} ile ${bp.name} sözleşmesi: ${money(p)} (peşinat ${money(up)}, ${days} gün, min. kalite ${P.minQ}).`, `✍️ Contract with ${v.company} for ${bp.name}: ${money(p)} (upfront ${money(up)}, ${days} days, min quality ${P.minQ}).`), 'success');
      }
      state.customers.won++; state.customers.history.unshift({ day: state.day, name: v.name, company: v.company, bp: bp.name, result: 'won', price: p, sat: S, cost: v.costs });
      H.toast(T('Satış kazanıldı!', 'Sale won!'), `${v.company} · ${money(p)}`, 'emerald'); H.sound && H.sound('cash');
      finish();
    }
    function lose(kind) {
      v.closed = true; v.stage = 'lost'; v.sat = S;
      if (S < 30) state.reputation = Math.max(30, state.reputation - 2); else if (S < CANCEL) state.reputation = Math.max(30, state.reputation - 1);
      state.customers.lost++; state.customers.history.unshift({ day: state.day, name: v.name, company: v.company, bp: bp.name, result: kind, sat: S, cost: v.costs });
      H.toast(T('Müşteri vazgeçti', 'Client walked away'), `${v.company} · ${T('memnuniyet', 'satisfaction')} ${S}`, 'rose');
      H.log(T(`❌ ${v.company}: sipariş iptal (memnuniyet ${S}, eşik ${CANCEL}).`, `❌ ${v.company}: order cancelled (satisfaction ${S}, threshold ${CANCEL}).`), 'warn');
      finish();
    }
    function finish() { state.customers.history = state.customers.history.slice(0, 30); state.customers.visits = state.customers.visits.filter(x => !x.closed).concat(state.customers.visits.filter(x => x.closed).slice(-6)); H.save(); H.render(); }
  }

  // ---------- Panel ----------
  C.panelHTML = function (state) {
    const vs = state.customers.visits, active = vs.filter(v => !v.closed), hist = state.customers.history;
    const card = v => {
      const bp = H.getBlueprint(v.bpId), est = estimate(v), si = STAGES.indexOf(v.stage);
      return `<article class="dz-visit glass-card">
        <header><div><b>${esc(v.name)}</b><small>${esc(v.company)} · ${persTxt(v)}</small></div><span class="dz-chip info">${esc(bp.name.split('(')[0].trim())}</span></header>
        <ol class="dz-steps">${STAGES.map((s, i) => `<li class="${i < si ? 'done' : i === si ? 'now' : ''}">${T(STAGE_TXT[s][0], STAGE_TXT[s][1])}</li>`).join('')}</ol>
        <div class="dz-vrow"><span>${T('Tahmini memnuniyet', 'Est. satisfaction')}</span>${DSAN.ui.bar(est.score, est.score < CANCEL ? 'rose' : est.score < HESITANT ? 'amber' : 'emerald')}<b>${est.score}</b><small>${T('bilinen %' + est.known, est.known + '% known')}</small></div>
        <div class="dz-vrow"><span>${T('Liste fiyatı', 'List price')}</span><b>${money(v.list)}</b><small>${T('Ziyaret maliyeti', 'Visit cost')} ${money(v.costs)}</small></div>
        <button class="dz-btn pri" data-action="cx-run" data-vid="${v.id}">${DSAN.ui.icon('arrow')} ${si === 0 ? T('Ziyareti başlat', 'Start the visit') : T('Devam et', 'Continue') + ': ' + T(STAGE_TXT[v.stage][0], STAGE_TXT[v.stage][1])}</button></article>`;
    };
    return `<div class="dz-cx-head"><p>${T(`Müşteri memnuniyeti 11 açıklanabilir bileşenden hesaplanır. <b>${CANCEL}</b> altı iptal, ${CANCEL}–${HESITANT} arası ek indirim ister; memnun müşteri liste fiyatının üzerini kabul edebilir.`, `Client satisfaction comes from 11 explainable factors. Below <b>${CANCEL}</b> the order is cancelled; ${CANCEL}–${HESITANT} asks for a discount; happy clients accept above list.`)}</p>
      <button class="dz-btn" data-action="cx-invite">${DSAN.ui.icon('globe')} ${T('Tanıtım daveti gönder ($6.000)', 'Send an invitation ($6,000)')}</button></div>
      <div class="dz-visits">${active.length ? active.map(card).join('') : `<p class="dz-empty">${T('Şu an bekleyen ziyaret yok. Birkaç gün içinde yeni talep gelir ya da davet gönderebilirsin.', 'No pending visits. New requests arrive every few days, or send an invitation.')}</p>`}</div>
      ${hist.length ? `<h4 class="dz-h4">${T('Son sonuçlar', 'Recent outcomes')}</h4><table class="dz-ctab"><tbody>${hist.slice(0, 8).map(h => `<tr><td>${T('Gün', 'Day')} ${h.day}</td><td>${esc(h.company)}</td><td>${esc(h.bp.split('(')[0])}</td><td>${h.result === 'won' ? `<b class="ok">${money(h.price)}</b>` : `<b class="bad">${T('İptal', 'Cancelled')}</b>`}</td><td>${T('Memnuniyet', 'Sat.')} ${h.sat}</td></tr>`).join('')}</tbody></table>` : ''}`;
  };
})();
