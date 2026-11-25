/* =============================================================================
   AMSTERDAM. — MARKET MODU
   Market simülasyonu oyun döngüsü (Supermarket Simulator tarzı):
   ana menü / duraklatma / ayarlar · birinci şahıs nişangâh etkileşimi ·
   tabletten toptan sipariş → kutu teslimatı → kutuyu taşı → vitrin rafına diz ·
   fiyat belirleme (piyasa fiyatına göre talep) · tabela ile mağazayı aç/kapat ·
   müşteriler raftan ürün alır, kasada sıraya girer · ürün okutma, kimlik (+18),
   kart terminali / nakit para üstü · gün sonu raporu · XP, seviye, lisans,
   personel, yükseltmeler · görev listesi · otomatik kayıt.
   Ana oyuna window.GameBridge üzerinden bağlanır.
   ============================================================================= */
(function () {
  'use strict';
  const SAVE_KEY = 'AmsterdamMarket_v1', SET_KEY = 'AmsterdamMarket_settings';
  const FLOOR = 0.16;
  let B = null, S = null, T = null;

  // ---------------------------------------------------------------------------
  // VERİ
  // ---------------------------------------------------------------------------
  const META = {
    canal_haze: { box: 8, kind: 'jar', short: 'Canal Haze' },
    jordaan_amber: { box: 8, kind: 'jar', short: 'Jordaan Amber' },
    tulip_reserve: { box: 6, kind: 'jar', short: 'Tulip Reserve' },
    prinsen_gold: { box: 6, kind: 'jar', short: 'Prinsen Gold' },
    mint_tea: { box: 12, kind: 'tin', short: 'Mint Tea' },
    stroop_espresso: { box: 12, kind: 'cup', short: 'Stroop Espresso' },
    truffle_brownie: { box: 10, kind: 'brownie', short: 'Truffle Brownie' },
    cold_brew_tonic: { box: 10, kind: 'bottle', short: 'Cold Brew Tonic' }
  };
  const STARTER = ['canal_haze', 'mint_tea', 'stroop_espresso'];
  const LICENSES = [
    { id: 'jordaan_amber', level: 2, cost: 180 },
    { id: 'truffle_brownie', level: 2, cost: 240 },
    { id: 'tulip_reserve', level: 3, cost: 320 },
    { id: 'cold_brew_tonic', level: 4, cost: 300 },
    { id: 'prinsen_gold', level: 6, cost: 520 }
  ];
  const UPGRADES = [
    { id: 'capacity', name: 'Genişletilmiş salon', desc: 'Aynı anda içeride +2 müşteri', level: 2, cost: 350 },
    { id: 'express', name: 'Ekspres kargo', desc: 'Teslimat süresi yarıya iner', level: 3, cost: 250 },
    { id: 'shelfCap', name: 'Derin raflar', desc: 'Raf bölmesi kapasitesi 10 → 15', level: 3, cost: 400 },
    { id: 'lateHours', name: 'Gece ruhsatı', desc: 'Mağaza 24:00\'e kadar açık kalabilir', level: 4, cost: 450 },
    { id: 'scanner', name: 'Hızlı barkod okuyucu', desc: 'Kasiyer personel %40 daha hızlı', level: 5, cost: 600 }
  ];
  const STAFF = [
    { id: 'cashier', name: 'Kasiyer', desc: 'Sıradaki müşterileri okutur, 18+ ürünlerde kimliğe bakar ve ödemeyi alır', hire: 200, wage: 95, level: 2, max: 3, names: ['Sanne', 'Bram', 'Fleur'] },
    { id: 'stocker', name: 'Vitrin sorumlusu', desc: 'Kolileri teslimat alanından alıp vitrin rafına tek tek dizer; en az kalan ürünü önce doldurur, boş kolileri çöpe atar', hire: 220, wage: 75, level: 2, max: 2, names: ['Daan', 'Noor'] },
    { id: 'cleaner', name: 'Temizlik görevlisi', desc: 'Salonu süpürür, hijyeni zamanla yükseltir (denetimde ≥%75 gerekir)', hire: 140, wage: 65, level: 2, max: 2, names: ['Ahmed', 'Mila'] }
  ];
  const DENOMS = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];
  const xpFor = (L) => 100 + 70 * (L - 1);
  const eur = (v) => '€' + (Math.round(v * 100) / 100).toFixed(2);
  const r2 = (v) => Math.round(v * 100) / 100;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const isTouch = () => matchMedia('(pointer: coarse)').matches;

  const mm = {
    started: false, menu: true, paused: false, open: false, ui: null,
    level: 1, xp: 0, boxes: [], held: null, pending: [], slots: [], pick: [],
    up: {}, unlocked: [], stats: null, totals: { served: 0, playerServed: 0, placed: 0, orders: 0 },
    tut: 0, tutSeenPrices: false, nextEntry: 0, cashierT: 0, merch: [], nav: null, navT: 0, saveT: 0, hudT: 0,
    target: null, co: null, emotes: [], reportShown: false, expectUnlock: false, defs: {},
    settings: { gfx: 'hdr', q: 'auto', sens: 1, day: 'normal', cam: 1 }, holdTimer: null, uid: 1
  };
  const newStats = () => ({ served: 0, lost: 0, items: 0, revenue: 0, xp: 0, missed: 0, repStart: S ? S.reputation : 50, idOk: 0, idBad: 0 });

  const MarketMode = window.MarketMode = {
    active: () => mm.started,
    frame, npcArrive, onRenege, queueHead, enterCheckout, deliverBoxes, openTablet,
    stockerFrame: (...a) => stockerFrame(...a), inCheckout: () => !!(mm.co && mm.co.active),
    addRevenue: (...a) => addRevenue(...a), emote: (n, t) => emote(n, t), isOpen: () => mm.open, level: () => mm.level
  };
  const carry = (n, k) => { const c = n && n.meshObj && n.meshObj.cast; if (c && c.setCarry) c.setCarry(k); };

  // ---------------------------------------------------------------------------
  // BAŞLANGIÇ
  // ---------------------------------------------------------------------------
  window.addEventListener('game-ready', init);
  function init() {
    B = window.GameBridge; S = B.state; T = window.THREE;
    for (const c of S.catalog) mm.defs[c.id] = Object.assign({}, c);
    for (const l of S.licenses) mm.defs[l.id] = Object.assign({ quality: 92, stock: 0 }, l);
    try { Object.assign(mm.settings, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) {}
    injectUI();
    buildWorld();
    applySettings();
    bindInput();
    showMainMenu();
    if (/[?&]mmdebug=1/.test(location.search)) window.__mm = { mm, startGame, pickUp, doAction, dropHeld, setOpen, enterCheckout, exitCheckout, scanUnit, idDecision, finishPayment, openTablet, deliverBoxes, showReport, nextDay, setSlotProduct, refreshSlot, syncStock, item };
  }

  // ---------------------------------------------------------------------------
  // 3D DÜNYA: vitrin rafı, teslimat alanı, tabela, kasa, bilgisayar, çöp
  // ---------------------------------------------------------------------------
  const SHELF = { x: 3.55, cols: [-9.55, -10.45, -11.35, -12.25], tiers: [0.34, 0.74, 1.14] };
  const KIND = {};
  function buildKinds() {
    const brass = new T.MeshStandardMaterial({ color: 0xd4a347, metalness: 0.85, roughness: 0.3 });
    const silver = new T.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.3 });
    const dark = new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
    const wrap = new T.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4, transparent: true, opacity: 0.7 });
    KIND.jar = { body: new T.CylinderGeometry(0.045, 0.045, 0.11, 12), lid: new T.CylinderGeometry(0.048, 0.048, 0.024, 12), h: 0.11, lidY: 0.065, lidMat: brass, glass: true };
    KIND.tin = { body: new T.CylinderGeometry(0.05, 0.05, 0.12, 14), lid: new T.CylinderGeometry(0.052, 0.052, 0.014, 14), h: 0.12, lidY: 0.066, lidMat: silver, metal: true };
    KIND.cup = { body: new T.CylinderGeometry(0.046, 0.034, 0.11, 14), lid: new T.CylinderGeometry(0.049, 0.049, 0.016, 14), h: 0.11, lidY: 0.062, lidMat: dark };
    KIND.brownie = { body: new T.BoxGeometry(0.1, 0.05, 0.08), lid: new T.BoxGeometry(0.104, 0.012, 0.084), h: 0.05, lidY: 0.03, lidMat: wrap };
    KIND.bottle = { body: new T.CylinderGeometry(0.034, 0.04, 0.14, 12), lid: new T.CylinderGeometry(0.016, 0.016, 0.04, 8), h: 0.14, lidY: 0.09, lidMat: dark, glass: true };
  }
  const matCache = {};
  function bodyMat(pid) {
    if (matCache[pid]) return matCache[pid];
    const d = mm.defs[pid], k = KIND[META[pid].kind];
    return (matCache[pid] = new T.MeshStandardMaterial({ color: d.color, roughness: k.glass ? 0.18 : k.metal ? 0.35 : 0.55, metalness: k.metal ? 0.5 : 0.05, transparent: !!k.glass, opacity: k.glass ? 0.88 : 1 }));
  }
  const clearGlass = () => mm._glass || (mm._glass = new T.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }));
  const lidColor = (pid) => matCache['lid_' + pid] || (matCache['lid_' + pid] = new T.MeshStandardMaterial({ color: mm.defs[pid].color, roughness: 0.35, metalness: 0.4 }));
  function unitMesh(pid) {
    const k = KIND[META[pid].kind], g = new T.Group();
    const nug = META[pid].kind === 'jar' && window.ModelCast && ModelCast.nug();
    const b = new T.Mesh(k.body, nug ? clearGlass() : bodyMat(pid)); b.castShadow = true; g.add(b);
    const l = new T.Mesh(k.lid, nug ? lidColor(pid) : k.lidMat); l.position.y = k.lidY; g.add(l);
    if (nug) { const n = new T.Mesh(nug.geo, nug.mat); n.position.y = -k.h / 2 + 0.004; n.scale.setScalar(0.95); g.add(n); }
    g.userData.h = k.h; return g;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  const hex = (n) => '#' + new T.Color(n).getHexString();

  function buildWorld() {
    const scene = B.scene;
    buildKinds();
    const root = new T.Group(); root.name = 'market-mode'; scene.add(root); mm.root = root;
    const wood = new T.MeshStandardMaterial({ color: 0x123828, roughness: 0.5 });
    const oak = new T.MeshStandardMaterial({ color: 0xb07a45, roughness: 0.55 });
    const led = new T.MeshBasicMaterial({ color: 0xffe0a8 });
    const zMid = (SHELF.cols[0] + SHELF.cols[3]) / 2, len = 3.75;
    const box = (w, h, d, m, x, y, z) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
    // Gondol vitrin rafı (sağ duvar)
    box(0.04, 1.44, len, wood, 3.83, FLOOR + 0.72, zMid);
    box(0.58, 0.12, len, wood, 3.55, FLOOR + 0.06, zMid);
    for (const zz of [zMid - len / 2, zMid + len / 2]) box(0.6, 1.44, 0.04, wood, 3.55, FLOOR + 0.72, zz);
    for (const ty of SHELF.tiers) {
      box(0.58, 0.03, len - 0.06, oak, 3.55, FLOOR + ty, zMid);
      box(0.02, 0.012, len - 0.1, led, 3.27, FLOOR + ty - 0.025, zMid);
    }
    const head = canvasTex(1024, 96, (c, w, h) => {
      c.fillStyle = '#0b2a1d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fde68a'; c.font = 'bold 52px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('VİTRİN · SELF SERVICE', w / 2, h / 2 + 3);
    });
    const header = new T.Mesh(new T.PlaneGeometry(len, 0.2), new T.MeshStandardMaterial({ map: head, emissive: 0xffffff, emissiveMap: head, emissiveIntensity: 0.55 }));
    header.position.set(3.8, FLOOR + 1.58, zMid); header.rotation.y = -Math.PI / 2; root.add(header);
    B.colliders.push({ minX: 3.24, maxX: 4.3, minZ: zMid - len / 2 - 0.05, maxZ: zMid + len / 2 + 0.05, tag: 'mm_shelf' });

    // Raf bölmeleri
    const hitMat = new T.MeshBasicMaterial({ visible: false });
    SHELF.tiers.forEach((ty, tier) => SHELF.cols.forEach((zc, col) => {
      const s = { i: mm.slots.length, tier, col, zc, y: FLOOR + ty + 0.015, pid: null, count: 0, inst: null, standX: 2.78, standZ: zc };
      const hit = new T.Mesh(new T.BoxGeometry(0.58, 0.38, 0.86), hitMat);
      hit.position.set(3.52, s.y + 0.19, zc); hit.userData.mm = { type: 'slot', slot: s }; root.add(hit); mm.pick.push(hit);
      const tc = document.createElement('canvas'); tc.width = 256; tc.height = 112;
      const tt = new T.CanvasTexture(tc); tt.encoding = T.sRGBEncoding;
      const tag = new T.Mesh(new T.PlaneGeometry(0.3, 0.13), new T.MeshStandardMaterial({ map: tt, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 0.35 }));
      tag.position.set(3.255, s.y - 0.06, zc); tag.rotation.y = -Math.PI / 2; root.add(tag);
      s.tag = tag; s.tagCanvas = tc; s.tagTex = tt;
      mm.slots.push(s); drawTag(s);
    }));

    // Teslimat alanı
    const zoneTex = canvasTex(256, 144, (c, w, h) => {
      c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
      c.strokeStyle = '#facc15'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
      c.save(); c.beginPath(); c.rect(6, 6, w - 12, h - 12); c.clip();
      c.strokeStyle = 'rgba(250,204,21,0.35)'; c.lineWidth = 10;
      for (let x = -h; x < w; x += 34) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
      c.restore();
      c.fillStyle = '#facc15'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('TESLİMAT', w / 2, h - 18);
    });
    const zone = new T.Mesh(new T.PlaneGeometry(1.7, 0.95), new T.MeshBasicMaterial({ map: zoneTex, transparent: true, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; zone.position.set(-2.2, FLOOR + 0.006, -7.3); root.add(zone);

    // AÇIK / KAPALI tabelası
    mm.signTex = {
      open: canvasTex(256, 140, (c, w, h) => signDraw(c, w, h, '#065f46', '#d1fae5', 'AÇIK', 'OPEN')),
      closed: canvasTex(256, 140, (c, w, h) => signDraw(c, w, h, '#7f1d1d', '#fee2e2', 'KAPALI', 'CLOSED'))
    };
    const sign = new T.Group(); sign.position.set(-1.35, 2.0, -6.33); root.add(sign);
    mm.signMat = new T.MeshStandardMaterial({ map: mm.signTex.closed, emissive: 0xffffff, emissiveMap: mm.signTex.closed, emissiveIntensity: 0.5, side: T.DoubleSide });
    const sp = new T.Mesh(new T.PlaneGeometry(0.56, 0.31), mm.signMat); sign.add(sp);
    const chainM = new T.MeshStandardMaterial({ color: 0xd4a347, metalness: 0.9, roughness: 0.3 });
    for (const sx of [-0.22, 0.22]) { const ch = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.36, 4), chainM); ch.position.set(sx, 0.33, 0); sign.add(ch); }
    const signHit = new T.Mesh(new T.BoxGeometry(0.62, 0.38, 0.2), hitMat); signHit.userData.mm = { type: 'sign' }; sign.add(signHit); mm.pick.push(signHit);
    mm.sign = sign;

    // Kasa (tezgâh) ve bilgisayar
    const reg = new T.Mesh(new T.BoxGeometry(1.4, 0.5, 1.2), hitMat); reg.position.set(-1.1, 1.45, -15.1); reg.userData.mm = { type: 'register' }; root.add(reg); mm.pick.push(reg);
    const scanner = new T.Group(); scanner.position.set(-0.5, 1.29, -15.05); root.add(scanner);
    scanner.add(Object.assign(new T.Mesh(new T.BoxGeometry(0.22, 0.03, 0.16), new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 })), {}));
    const glassScan = new T.Mesh(new T.PlaneGeometry(0.16, 0.1), new T.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 }));
    glassScan.rotation.x = -Math.PI / 2; glassScan.position.y = 0.017; scanner.add(glassScan); mm.scanGlow = glassScan;
    const bagM = new T.MeshStandardMaterial({ color: 0xc8a576, roughness: 0.85 });
    const bag = new T.Mesh(new T.BoxGeometry(0.22, 0.26, 0.14), bagM); bag.position.set(-0.12, 1.415, -15.15); bag.castShadow = true; root.add(bag); mm.bagPos = bag.position.clone();
    let pc = null;
    B.scene.traverse(o => { const p = o.geometry && o.geometry.parameters; if (o.isMesh && p && Math.abs(p.width - 0.38) < 1e-3 && Math.abs(p.height - 0.28) < 1e-3 && Math.abs(p.depth - 0.05) < 1e-3) pc = o; });
    if (pc) {
      const scr = canvasTex(256, 192, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#064e3b'); g.addColorStop(1, '#0f172a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = '#a7f3d0'; c.font = 'bold 30px sans-serif'; c.fillText('GrachtOS', 18, 48);
        c.font = '18px sans-serif'; c.fillStyle = '#e2e8f0'; ['Toptancı', 'Fiyatlar', 'Lisanslar', 'Personel'].forEach((t, i) => c.fillText('▸ ' + t, 22, 90 + i * 26));
      });
      const front = new T.Mesh(new T.PlaneGeometry(0.34, 0.24), new T.MeshBasicMaterial({ map: scr }));
      front.position.z = 0.026; pc.add(front);
      const back = front.clone(); back.position.z = -0.026; back.rotation.y = Math.PI; pc.add(back);
      pc.userData.mm = { type: 'pc' }; mm.pick.push(pc); mm.pc = pc;
    }
    // Çöp kutusu: rafın yanına taşı ve etkileşimli yap
    B.scene.traverse(o => { const p = o.geometry && o.geometry.parameters; if (o.isMesh && p && Math.abs((p.radiusTop || 0) - 0.2) < 1e-3 && Math.abs((p.height || 0) - 0.56) < 1e-3 && Math.abs(o.position.z + 12.1) < 0.05) mm.trash = o; });
    if (mm.trash) {
      mm.trash.position.set(3.72, 0.44, -14.02); mm.trash.userData.mm = { type: 'trash' }; mm.pick.push(mm.trash);
      B.colliders.push({ minX: 3.5, maxX: 3.95, minZ: -14.25, maxZ: -13.8, tag: 'mm_trash' });
    }
    if (!B.camera.parent) B.scene.add(B.camera);
    if (window.ModelCast) ModelCast.onReady(() => { for (const s of mm.slots) if (s.pid && META[s.pid].kind === 'jar') { const c = s.count; setSlotProduct(s, s.pid); s.count = c; refreshSlot(s); } });
    mm.ray = new T.Raycaster(); mm.ray.far = 2.9;
  }
  function signDraw(c, w, h, bg, fg, a, b) {
    c.fillStyle = '#f8fafc'; c.fillRect(0, 0, w, h);
    c.fillStyle = bg; c.fillRect(8, 8, w - 16, h - 16);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 54px Georgia, serif'; c.fillText(a, w / 2, h / 2 - 12);
    c.font = 'bold 22px sans-serif'; c.fillText(b, w / 2, h / 2 + 36);
  }
  function drawTag(s) {
    const c = s.tagCanvas.getContext('2d'), w = 256, h = 112;
    c.fillStyle = '#fffdf5'; c.fillRect(0, 0, w, h);
    if (!s.pid) { c.fillStyle = '#94a3b8'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('BOŞ BÖLME', w / 2, h / 2 + 9); }
    else {
      const d = item(s.pid) || mm.defs[s.pid];
      c.fillStyle = hex(d.color); c.fillRect(0, 0, w, 16);
      c.fillStyle = '#0f172a'; c.font = 'bold 24px sans-serif'; c.textAlign = 'left'; c.fillText(META[s.pid].short, 12, 44);
      c.font = 'bold 44px sans-serif'; c.fillStyle = '#b91c1c'; c.fillText(eur(d.price), 12, 96);
      c.font = '18px sans-serif'; c.fillStyle = '#475569'; c.textAlign = 'right'; c.fillText(d.category === 'Botanical' ? '18+' : 'KAFE', w - 10, 96);
    }
    s.tagTex.needsUpdate = true;
  }

  // Bölme içi ürün yerleşimi: InstancedMesh (bölme başına 2 çizim çağrısı)
  function slotCap() { return mm.up.shelfCap ? 15 : 10; }
  function setSlotProduct(s, pid) {
    if (s.inst) { for (const k in s.inst) { mm.root.remove(s.inst[k]); s.inst[k].dispose && s.inst[k].dispose(); } s.inst = null; }
    s.pid = pid;
    if (pid) {
      const k = KIND[META[pid].kind], cap = 15;
      const nug = META[pid].kind === 'jar' && window.ModelCast && ModelCast.nug();
      const body = new T.InstancedMesh(k.body, nug ? clearGlass() : bodyMat(pid), cap), lid = new T.InstancedMesh(k.lid, nug ? lidColor(pid) : k.lidMat, cap);
      const fill = nug ? new T.InstancedMesh(nug.geo, nug.mat, cap) : null;
      body.castShadow = true; const m = new T.Matrix4();
      for (let u = 0; u < cap; u++) {
        const row = Math.floor(u / 5), colI = u % 5;
        const x = 3.38 + row * 0.15, z = s.zc + (colI - 2) * 0.155, y = s.y + k.h / 2;
        m.makeTranslation(x, y, z); body.setMatrixAt(u, m);
        m.makeTranslation(x, y + k.lidY, z); lid.setMatrixAt(u, m);
        if (fill) { m.makeRotationY(u * 2.4).setPosition(x, s.y + 0.004, z); fill.setMatrixAt(u, m); }
      }
      if (fill) { fill.renderOrder = -1; mm.root.add(fill); body.renderOrder = 1; }
      mm.root.add(body); mm.root.add(lid); s.inst = fill ? { body, lid, fill } : { body, lid };
    }
    refreshSlot(s);
  }
  function refreshSlot(s) {
    if (s.inst) { const n = Math.min(s.count, slotCap()); for (const k in s.inst) s.inst[k].count = n; }
    drawTag(s);
  }
  function syncStock() {
    for (const it of S.catalog) it.stock = mm.slots.reduce((a, s) => a + (s.pid === it.id ? s.count : 0), 0);
  }
  const item = (pid) => S.catalog.find(c => c.id === pid);

  // ---------------------------------------------------------------------------
  // KUTULAR
  // ---------------------------------------------------------------------------
  const boxTexCache = {};
  function boxTex(pid) {
    if (boxTexCache[pid]) return boxTexCache[pid];
    const d = mm.defs[pid];
    return (boxTexCache[pid] = canvasTex(256, 192, (c, w, h) => {
      c.fillStyle = '#c4935a'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 30; i++) c.fillRect(0, i * 7, w, 2);
      c.fillStyle = '#e7c99a'; c.fillRect(w / 2 - 22, 0, 44, h);
      c.fillStyle = hex(d.color); c.fillRect(14, 58, w - 28, 74);
      c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText(META[pid].short, w / 2, 102);
      c.font = 'bold 22px sans-serif'; c.fillStyle = '#3b2412'; c.fillText('× ' + META[pid].box + ' ADET', w / 2, 168);
      c.font = 'bold 18px sans-serif'; c.fillText('JORDAAN GROOTHANDEL', w / 2, 34);
    }));
  }
  const boxSide = () => mm._side || (mm._side = new T.MeshStandardMaterial({ color: 0xc4935a, roughness: 0.9 }));
  function makeBox(pid, qty) {
    const lab = new T.MeshStandardMaterial({ map: boxTex(pid), roughness: 0.85 });
    const mesh = new T.Mesh(new T.BoxGeometry(0.44, 0.3, 0.36), [lab, lab, boxSide(), boxSide(), lab, lab]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const bx = { id: mm.uid++, pid, qty, mesh, drop: 0 };
    mesh.userData.mm = { type: 'box', box: bx };
    return bx;
  }
  function addBoxToWorld(bx, x, y, z, drop) {
    bx.mesh.position.set(x, y + (drop ? 1.6 : 0), z); bx.mesh.rotation.set(0, (Math.random() - 0.5) * 0.3, 0);
    bx.restY = y; bx.vy = 0; bx.dropping = !!drop;
    mm.root.add(bx.mesh); mm.boxes.push(bx); mm.pick.push(bx.mesh);
  }
  function freeDeliverySpot() {
    for (let i = 0; i < 18; i++) {
      const x = -2.75 + (i % 3) * 0.52, z = -7.12 - (Math.floor(i / 3) % 2) * 0.42, layer = Math.floor(i / 6);
      const y = FLOOR + 0.15 + layer * 0.31;
      if (!mm.boxes.some(b => b !== mm.held && Math.abs(b.mesh.position.x - x) < 0.25 && Math.abs(b.mesh.position.z - z) < 0.2 && Math.abs(b.restY - y) < 0.1)) return { x, y, z };
    }
    return { x: -2.2 + Math.random() * 0.4, y: FLOOR + 0.15 + 3 * 0.31, z: -7.3 };
  }
  function deliverBoxes(pid, units, from) {
    const per = META[pid].box; let left = units;
    while (left > 0) { const q = Math.min(per, left); left -= q; const sp = freeDeliverySpot(); addBoxToWorld(makeBox(pid, q), sp.x, sp.y, sp.z, true); }
    B.sound.bell(); toast(`${from || 'Kargo'} teslim edildi: ${META[pid].short} (${units} adet) — kapının solundaki teslimat alanında.`);
  }
  function removeBox(bx) {
    if (bx.mesh.parent) bx.mesh.parent.remove(bx.mesh);
    mm.boxes = mm.boxes.filter(b => b !== bx); mm.pick = mm.pick.filter(m => m !== bx.mesh);
    if (mm.held === bx) mm.held = null;
  }
  function pickUp(bx) {
    if (mm.held) return;
    mm.held = bx; mm.pick = mm.pick.filter(m => m !== bx.mesh); mm.boxes = mm.boxes.filter(b => b !== bx);
    bx.mesh.parent.remove(bx.mesh); B.camera.add(bx.mesh);
    bx.mesh.position.set(0.3, -0.34, -0.72); bx.mesh.rotation.set(0.12, -0.35, 0); bx.dropping = false;
    beep(520, 0.05);
  }
  function dropHeld() {
    const bx = mm.held; if (!bx) return;
    const p = B.player, fx = -Math.sin(p.yaw) * 0.8, fz = -Math.cos(p.yaw) * 0.8;
    const x = p.x + fx, z = p.z + fz, inside = x > -4.2 && x < 4.2 && z < -6.25 && z > -17.4;
    const y = (inside ? FLOOR : 0.12) + 0.15;
    B.camera.remove(bx.mesh); mm.held = null; mm.boxes = mm.boxes.filter(b => b !== bx);
    addBoxToWorld(bx, x, y, z, false); bx.mesh.rotation.y = p.yaw;
  }

  // ---------------------------------------------------------------------------
  // ETKİLEŞİM (nişangâh)
  // ---------------------------------------------------------------------------
  let _c = null;
  function resolveTarget() {
    if (mm.co || mm.ui || mm.menu || mm.paused) return null;
    let hit = null;
    if (S.cameraMode === 1) {
      if (!_c) _c = new T.Vector2(0, 0);
      mm.ray.setFromCamera(_c, B.camera);
      const hs = mm.ray.intersectObjects(mm.pick, false);
      if (hs.length) hit = hs[0].object.userData.mm;
    }
    if (!hit) {   // yakınlık yedeği (3. şahıs ve dokunmatikte ince nişan gerekmesin)
      const p = B.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); let best = S.cameraMode === 1 ? 1.5 : 2.0;
      const minDot = S.cameraMode === 1 ? 0.55 : 0.25;
      const wp = new T.Vector3();
      for (const o of mm.pick) {
        o.getWorldPosition(wp); const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
        if (d < best && (dx * fx + dz * fz) / (d || 1) > minDot) { best = d; hit = o.userData.mm; }
      }
    }
    if (!hit) return null;
    const t = Object.assign({}, hit), held = mm.held;
    if (t.type === 'box') {
      const bx = t.box; t.label = held ? 'Elin dolu — önce kutuyu bırak [G]' : `Kutuyu al — ${META[bx.pid].short} (${bx.qty} adet)`; t.ok = !held;
    } else if (t.type === 'slot') {
      const s = t.slot, cap = slotCap();
      if (held) {
        if (!held.qty) { t.label = 'Kutu boş — çöpe at'; t.ok = false; }
        else if (s.pid && s.pid !== held.pid && s.count > 0) { t.label = `Bu bölmede ${META[s.pid].short} var`; t.ok = false; }
        else if (s.count >= cap) { t.label = 'Bölme dolu'; t.ok = false; }
        else { t.label = `Rafa diz — ${META[held.pid].short} (${s.pid === held.pid ? s.count : 0}/${cap})`; t.ok = true; }
      } else if (s.pid) { const it = item(s.pid); t.label = `${META[s.pid].short} · ${s.count}/${cap} · ${eur(it ? it.price : 0)} — fiyat için [E]`; t.ok = true; }
      else { t.label = 'Boş raf bölmesi — kutu getir'; t.ok = false; }
    } else if (t.type === 'pc') { t.label = 'Bilgisayarı kullan'; t.ok = true; }
    else if (t.type === 'sign') { t.label = mm.open ? 'Tabelayı çevir — mağazayı KAPAT' : 'Tabelayı çevir — mağazayı AÇ'; t.ok = true; }
    else if (t.type === 'register') { t.label = held ? 'Kasaya geçmeden önce kutuyu bırak [G]' : 'Kasaya geç'; t.ok = !held; }
    else if (t.type === 'trash') { t.label = held ? (held.qty ? `Kutuyu at (${held.qty} ürün kaybolur)` : 'Boş kutuyu at') : 'Çöp kutusu'; t.ok = !!held; }
    return t;
  }
  let trashConfirm = 0;
  function doAction() {
    const t = mm.target; if (!t || !t.ok) { if (t && t.type === 'slot' && mm.held) beep(180, 0.08); return; }
    if (t.type === 'box') pickUp(t.box);
    else if (t.type === 'slot') {
      const s = t.slot;
      if (!mm.held) { openTablet('prices', s.pid); return; }
      const bx = mm.held;
      if (s.pid !== bx.pid) setSlotProduct(s, bx.pid);
      s.count++; bx.qty--; mm.totals.placed++;
      refreshSlot(s); syncStock(); beep(880 + s.count * 30, 0.04);
      if (bx.qty <= 0) toast('Kutu boşaldı — çöp kutusuna at (rafın yanında) ya da [G] ile bırak.');
    } else if (t.type === 'pc') openTablet();
    else if (t.type === 'sign') setOpen(!mm.open);
    else if (t.type === 'register') enterCheckout();
    else if (t.type === 'trash') {
      const bx = mm.held;
      if (bx.qty > 0 && performance.now() - trashConfirm > 2500) { trashConfirm = performance.now(); toast(`Kutuda ${bx.qty} ürün var. Atmak için tekrar [E].`); return; }
      removeBox(bx); mm.held = null; beep(140, 0.1);
    }
  }

  // ---------------------------------------------------------------------------
  // MAĞAZA AÇ / KAPAT, GÜN DÖNGÜSÜ
  // ---------------------------------------------------------------------------
  const closeHour = () => (mm.up.lateHours ? 23.99 : 22);
  function setOpen(v, auto) {
    if (v && S.hour >= closeHour()) { toast('Kapanış saati geçti — günü bitirip yarın açabilirsin.'); return; }
    if (v && !S.catalog.some(c => c.stock > 0)) toast('Uyarı: raflar boş! Müşteriler eli boş dönecek.');
    mm.open = v; S.doorOpen = v;
    mm.signMat.map = mm.signMat.emissiveMap = v ? mm.signTex.open : mm.signTex.closed; mm.signMat.needsUpdate = true;
    mm.sign.rotation.z = 0.12; mm.signSwing = 1;
    if (v) { mm.nextEntry = 2; B.sound.chime(); toast('Mağaza AÇIK! Müşteriler gelmeye başlayacak.'); }
    else toast(auto ? `Saat ${Math.floor(closeHour())}:00 — mağaza kapandı. İçerideki müşterilere hizmet et.` : 'Mağaza KAPALI. Yeni müşteri girmeyecek.');
    hud(true);
  }
  function customers() { return B.npcs.filter(n => n.role === 'customer'); }
  const INSIDE = ['entering', 'mm_browse', 'mm_toqueue', 'queued'];
  const insideCount = () => customers().filter(n => INSIDE.includes(n.state) || /^lg_t_/.test(n.state)).length;
  const maxInside = () => Math.min(8, 3 + Math.floor(mm.level / 2) + (mm.up.capacity ? 2 : 0));
  const entryGap = () => clamp(15 - mm.level * 1.1 - (S.reputation - 50) / 8, 4.5, 18);

  // Müşteri ziyaret planı: 1-3 ürün; her ürün için ilgili raf bölmesine gidilir
  function planVisit(n) {
    const pool = S.catalog.map(c => c.id);
    const k = 1 + (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0);
    const want = [];
    for (let i = 0; i < k && pool.length; i++) { const j = Math.floor(Math.random() * pool.length); want.push(pool.splice(j, 1)[0]); }
    n.mmPlan = want.map(pid => ({ pid, qty: Math.random() < 0.22 ? 2 : 1 }));
    n.mmTaken = []; n.mmUnhappy = 0;
  }
  function marketPrice(it) { const d = mm.defs[it.id]; return r2(d.price * (1 + (S.marketIndex - 1) * 0.5)); }
  function unitCost(it) { const d = mm.defs[it.id]; return r2(d.unitCost * S.marketIndex); }
  function nextStop(n) {
    while (n.mmPlan && n.mmPlan.length) {
      const st = n.mmPlan.shift();
      const slots = mm.slots.filter(s => s.pid === st.pid);
      if (!slots.length) { emote(n, 'Bu ürün yok mu?'); n.mmUnhappy++; mm.stats.missed++; continue; }
      const s = slots.find(x => x.count > 0) || slots[0];
      n.state = 'mm_browse'; n.mmStop = { st, s }; n.targetX = s.standX + (Math.random() - 0.5) * 0.12; n.targetZ = s.standZ + (Math.random() - 0.5) * 0.2;
      n.browseT = 1.0 + Math.random() * 1.6; return;
    }
    if (n.mmTaken.length) { n.state = 'mm_toqueue'; n.queuedAt = performance.now(); return; }
    emote(n, 'Eli boş çıkıyorum…'); S.reputation = Math.max(5, +(S.reputation - 0.8).toFixed(1)); mm.stats.lost++;
    n.state = 'leaving';
  }
  function npcArrive(n, dt) {
    if (!mm.started) return false;
    if (window.Lounge && Lounge.arrive(n, dt)) return true;   // masa / VIP oda durumları
    const st = n.state;
    if (st === 'approach_door') {
      if (!mm.open) { n.state = 'walk_away'; n.targetX = n.x < 0 ? -22 : 22; n.targetZ = -4.8; return true; }
      if (insideCount() >= maxInside() || mm.nextEntry > 0) return true;   // kapıda bekler
      if (customers().some(o => o !== n && o.state === 'approach_door' && o.lineT && o.lineT < n.lineT)) return true;   // sıradaki önce girer
      mm.nextEntry = entryGap();
      if (window.Lounge && Lounge.admit(n)) return true;          // masaya ya da VIP odaya yönlendirildi
      S.doorOpen = true; n.state = 'entering'; n.targetX = (Math.random() - 0.5) * 0.8; n.targetZ = -7.7;
      planVisit(n); return true;
    }
    if (st === 'entering') { if (!n.mmPlan) planVisit(n); nextStop(n); return true; }
    if (st === 'mm_browse') {
      n.browseT -= dt; if (n.browseT > 0) return true;
      const { st: want, s } = n.mmStop, it = item(want.pid);
      if (!it || s.pid !== want.pid || s.count <= 0) { emote(n, 'Rafta kalmamış!'); n.mmUnhappy++; mm.stats.missed++; S.reputation = Math.max(5, +(S.reputation - 0.3).toFixed(1)); }
      else {
        const ratio = it.price / marketPrice(it), slope = Math.abs(mm.defs[it.id].eps || 1) * 2;
        const pBuy = ratio <= 1 ? 1 : Math.max(0, 1 - (ratio - 1) * slope);
        if (Math.random() > pBuy) { emote(n, 'Çok pahalı!'); n.mmUnhappy++; }
        else {
          const q = Math.min(s.count, want.qty + (ratio < 0.9 && Math.random() < 0.3 ? 1 : 0));
          s.count -= q; for (let i = 0; i < q; i++) n.mmTaken.push(it.id);
          carry(n, 'box');
          refreshSlot(s); syncStock(); n.handoffTimer = 0.45;
        }
      }
      nextStop(n); return true;
    }
    if (st === 'mm_toqueue') { n.state = 'queued'; makeOrder(n); return true; }
    return false;
  }
  function makeOrder(n) {
    const hasBot = n.mmTaken.some(id => (item(id) || mm.defs[id]).category === 'Botanical');
    const under = hasBot && Math.random() < 0.14;
    const pat = 70 + S.reputation * 0.4 + S.ambianceScore * 0.2;
    n.order = {
      custName: n.castName || B.CUST_NAMES[n.id % B.CUST_NAMES.length],
      age: under ? 17 : 19 + Math.floor(Math.random() * 45), items: n.mmTaken.slice(), taken: true,
      idChecked: !hasBot, needsId: hasBot, upsellTried: true, queuedAt: n.queuedAt,
      patienceMax: pat, patienceLeft: pat, pay: Math.random() < 0.58 ? 'card' : 'cash'
    };
    B.attachOrderBubbleToNPC(n);
  }
  function returnToShelf(ids) {
    for (const id of ids) {
      const s = mm.slots.find(x => x.pid === id && x.count < slotCap()) || mm.slots.find(x => x.pid === id);
      if (s) { s.count++; refreshSlot(s); }
    }
    syncStock();
  }
  function onRenege(n) {
    if (!mm.started) return;
    carry(n, null);
    if (mm.co && mm.co.npc === n) clearCounter(true);
    else if (n.order && n.order.taken) returnToShelf(n.order.items);
    n.inCheckout = false; mm.stats.lost++;
  }
  function queueList() {
    return customers().filter(n => (n.state === 'queued' || n.state === 'mm_toqueue') && !n.mmDone).sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
  }
  function queueHead(excludeCheckout) {
    return queueList().find(n => n.state === 'queued' && n.order && !(excludeCheckout && n.inCheckout)) || null;
  }

  // Satışı kapat: muhasebe, XP, itibar, poşet teslimi
  function settleSale(n, by, extra = {}) {
    carry(n, null);
    const items = n.order.items; let gross = 0, tax = 0, cogs = 0, ratioSum = 0;
    for (const id of items) {
      const it = item(id) || mm.defs[id]; const p = it.price, r = it.btw || 0.21;
      gross += p; tax += p * (r / (1 + r)); cogs += it.unitCost; ratioSum += p / marketPrice(it);
    }
    gross = r2(gross); tax = r2(tax); const net = r2(gross - tax);
    S.cash = r2(S.cash + net - (extra.loss || 0));
    const L = S.ledger;
    L.revenue = r2(L.revenue + gross); L.netRevenue = r2(L.netRevenue + net); L.cogs = r2(L.cogs + cogs); L.tax = r2(L.tax + tax); L.salesCount += items.length;
    B.recomputeProfit();
    const waitFrac = n.order.patienceLeft / n.order.patienceMax, avgRatio = ratioSum / items.length;
    const dRep = clamp(0.25 + waitFrac * 0.5 - Math.max(0, avgRatio - 1) * 2 - (n.mmUnhappy || 0) * 0.25, -1.5, 1.0);
    S.reputation = clamp(+(S.reputation + dRep).toFixed(1), 5, 100);
    S.hygiene = Math.max(0, +(S.hygiene - 0.6).toFixed(1));
    const xp = by === 'player' ? 10 + items.length * 3 : 4 + items.length;
    addXP(xp);
    mm.stats.served++; mm.stats.items += items.length; mm.stats.revenue = r2(mm.stats.revenue + gross);
    mm.totals.served++; if (by === 'player') mm.totals.playerServed++;
    if (by === 'player' && waitFrac > 0.6 && Math.random() < 0.35) { const tip = r2(0.5 + Math.random() * 2); S.cash = r2(S.cash + tip); emote(n, `Bahşiş ${eur(tip)} 💚`); }
    else emote(n, dRep > 0.3 ? 'Harika dükkân!' : dRep < -0.2 ? 'Biraz pahalı…' : 'Teşekkürler!');
    n.mmDone = true; n.inCheckout = false; n.order.patienceLeft = 9999;
    B.startOrderHandoffAnimation(n, () => { n.state = 'leaving'; n.order = null; n.mmDone = false; n.mmPlan = null; });
    B.updateUI();
  }
  // Masa / VIP oda satışları (garson servisi, giriş ücreti) — kasadaki satışla aynı muhasebe
  function addRevenue(gross, btw, cogs, n, msg, xp) {
    gross = r2(gross); const tax = r2(gross * (btw / (1 + btw))), net = r2(gross - tax);
    S.cash = r2(S.cash + net);
    const L = S.ledger; L.revenue = r2(L.revenue + gross); L.netRevenue = r2(L.netRevenue + net); L.cogs = r2(L.cogs + (cogs || 0)); L.tax = r2(L.tax + tax); L.salesCount += 1;
    B.recomputeProfit();
    mm.stats.served++; mm.stats.revenue = r2(mm.stats.revenue + gross); mm.totals.served++;
    S.reputation = clamp(+(S.reputation + 0.3).toFixed(1), 5, 100);
    addXP(xp || 6); if (n && msg) emote(n, msg + ' · ' + eur(gross));
    B.updateUI();
  }
  function rejectCustomer(n, msg) {
    carry(n, null);
    returnToShelf(n.order.items);
    B.removeOrderBubbleFromNPC(n);
    n.inCheckout = false; n.state = 'leaving'; n.order = null; n.mmPlan = null; emote(n, msg);
  }
  function addXP(v) {
    mm.xp += v; mm.stats.xp += v;
    while (mm.xp >= xpFor(mm.level)) {
      mm.xp -= xpFor(mm.level); mm.level++;
      const un = [...LICENSES.filter(l => l.level === mm.level).map(l => META[l.id].short), ...UPGRADES.filter(u => u.level === mm.level).map(u => u.name), ...STAFF.filter(s => s.level === mm.level).map(s => s.name)];
      banner(`SEVİYE ${mm.level}!`, un.length ? 'Açılanlar: ' + un.join(', ') : 'Müşteri kapasiten arttı.');
      B.sound.chime(); setTimeout(() => B.sound.chime(), 220);
    }
    hud(true);
  }

  // ---------------------------------------------------------------------------
  // KASA (checkout)
  // ---------------------------------------------------------------------------
  const CO_POS = { x: -1.1, z: -16.0, camY: 2.22, cx: -1.1 };
  const HEAD_SPOT = { x: -1.1, z: -13.95 };
  function enterCheckout() {
    if (!mm.started) return;
    if (mm.held) { toast('Kasaya geçmeden önce kutuyu bırak [G].'); return; }
    if (!mm.co) mm.co = { npc: null, units: [], scanned: [], phase: 'wait', idDone: true, pay: null };
    mm.co.active = true;
    B.player.x = CO_POS.x; B.player.z = CO_POS.z; B.player.yaw = Math.PI; B.player.pitch = -0.35;
    if (S.cameraMode !== 1) B.setCameraMode(1);
    releaseLock(); clearKeys();
    document.body.classList.add('mm-in-co');
    renderCO();
  }
  function exitCheckout() {
    if (!mm.co) return;
    mm.co.active = false; document.body.classList.remove('mm-in-co');
    B.player.pitch = -0.1;
    const co = mm.co;
    if (co.npc && co.scanned.length === 0) {   // hiç okutulmadıysa müşteriyi serbest bırak (kasiyer bakabilir)
      for (const u of co.units) if (u.parent) u.parent.remove(u);
      carry(co.npc, 'box'); co.npc.inCheckout = false; co.npc = null; co.units = []; co.id = null; co.phase = 'wait';
    }
    if (!mm.co.npc) mm.co = null;
  }
  function beginCustomer(n) {
    const co = mm.co; co.npc = n; n.inCheckout = true; co.scanned = []; co.units = []; co.pay = null; carry(n, null);
    co.idDone = !n.order.needsId; co.phase = 'scan';
    n.order.items.forEach((pid, i) => {
      const u = unitMesh(pid), row = Math.floor(i / 4), col = i % 4;
      u.position.set(CO_POS.cx + (col - 1.5) * 0.15, 1.285 + u.userData.h / 2, -14.78 - row * 0.15);
      u.rotation.y = Math.random() * 6; u.traverse(o => { o.userData.mmUnit = u; });
      u.userData.pid = pid; mm.root.add(u); co.units.push(u);
    });
    if (n.order.needsId) makeIdCard(n);
    renderCO(); beep(660, 0.05);
  }
  function clearCounter(returnItems) {
    const co = mm.co; if (!co) return;
    for (const u of co.units) if (u.parent) u.parent.remove(u);
    if (returnItems && co.npc && co.npc.order) returnToShelf(co.npc.order.items);
    if (co.npc) co.npc.inCheckout = false;
    co.units = []; co.scanned = []; co.npc = null; co.phase = 'wait'; co.pay = null; co.id = null;
    if (!co.active) mm.co = null; renderCO();
  }
  function scanUnit(u) {
    const co = mm.co; if (!co || u.userData.scanning) return;
    u.userData.scanning = 0.0001; co.scanned.push(u.userData.pid);
    beep(1850, 0.06, 'square'); mm.scanGlow.material.color.set(0x22c55e); setTimeout(() => mm.scanGlow.material.color.set(0xef4444), 160);
    renderCO();
  }
  function coTotal() { return r2(mm.co.scanned.reduce((a, id) => a + (item(id) || mm.defs[id]).price, 0)); }
  function makeIdCard(n) {
    const today = gameDate(), age = n.order.age;
    const b = new Date(today); b.setFullYear(b.getFullYear() - age);
    // yaşı tam tutan doğum günü: 18'ine birkaç gün kala olanlar da olabilir
    const back = age === 17 ? -(1 + Math.floor(Math.random() * 40)) : Math.floor(Math.random() * 330);
    b.setDate(b.getDate() - back);
    mm.co.id = { name: n.order.custName.split(' (')[0], dob: b, no: 'NL' + Math.floor(1e7 + Math.random() * 9e7), color: n.meshObj && n.meshObj.cast ? hex(n.meshObj.cast.def.color) : '#64748b' };
  }
  function gameDate() { const d = new Date(2026, 10, 24); d.setDate(d.getDate() + S.day - 1); return d; }
  const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  function idDecision(ok) {
    const co = mm.co, n = co.npc; if (!n) return;
    const under = n.order.age < 18;
    if (ok) {
      co.idDone = true;
      if (under) { S.cash = r2(S.cash - 150); S.reputation = Math.max(5, +(S.reputation - 6).toFixed(1)); mm.stats.idBad++; banner('CEZA: −€150', '18 yaşından küçük müşteriye satış yaptın! Doğum tarihini dikkatle kontrol et.'); beep(150, 0.3); }
      else { addXP(3); mm.stats.idOk++; }
      renderCO();
    } else {
      if (under) { S.reputation = Math.min(100, +(S.reputation + 1.5).toFixed(1)); addXP(8); mm.stats.idOk++; toast('Doğru karar! 18 yaş altı müşteri reddedildi (+1.5 itibar).'); }
      else { S.reputation = Math.max(5, +(S.reputation - 2).toFixed(1)); mm.stats.idBad++; toast('Müşteri reşitti, gereksiz reddedildi (−2 itibar).'); }
      const n2 = n; for (const u of co.units) if (u.parent) u.parent.remove(u);
      co.units = []; co.npc = null; co.phase = 'wait'; co.id = null;
      rejectCustomer(n2, under ? 'Of, peki…' : 'Ama ben reşidim!');
      renderCO();
    }
  }
  function startPayment() {
    const co = mm.co, n = co.npc, total = coTotal();
    co.phase = 'pay';
    if (n.order.pay === 'card') co.pay = { type: 'card', total, entered: '' };
    else {
      const c = [Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20, 50, 100].filter((v, i, a) => v >= total && a.indexOf(v) === i);
      const paid = c[Math.min(c.length - 1, Math.floor(Math.random() * Math.min(3, c.length)))];
      co.pay = { type: 'cash', total, paid, change: r2(paid - total), given: [] };
    }
    beep(990, 0.05); renderCO();
  }
  function finishPayment() {
    const co = mm.co, n = co.npc, p = co.pay;
    let loss = 0;
    if (p.type === 'card') {
      if (Math.abs(parseFloat(p.entered || '0') - p.total) > 0.001) { beep(160, 0.25); toast('Tutar hatalı! Kart terminaline toplamı doğru gir.'); p.entered = ''; renderCO(); return; }
    } else {
      const g = r2(p.given.reduce((a, v) => a + v, 0));
      if (g < p.change - 0.001) { beep(160, 0.25); toast(`Para üstü eksik: ${eur(p.change - g)} daha ver.`); return; }
      loss = r2(g - p.change);
      if (loss > 0) toast(`Fazla para üstü verdin: −${eur(loss)}`);
    }
    B.sound.chime();
    for (const u of co.units) if (u.parent) u.parent.remove(u);
    co.units = []; co.npc = null; co.phase = 'wait'; co.pay = null; co.id = null;
    settleSale(n, 'player', { loss });
    renderCO();
  }

  // ---------------------------------------------------------------------------
  // KARE DÖNGÜSÜ
  // ---------------------------------------------------------------------------
  function frame(dt, t) {
    if (!B) return;
    const cam = B.camera;
    if (mm.menu) {      // ana menü sinematik kamera
      const a = performance.now() * 0.00006;
      cam.position.set(Math.sin(a) * 7.5, 3.1, -1.2 + Math.cos(a) * 3.2); cam.lookAt(0, 1.6, -9);
      return;
    }
    if (!mm.started) return;
    // kasa kamerası
    if (mm.co && mm.co.active) { cam.position.set(CO_POS.cx, CO_POS.camY, -16.45); cam.lookAt(CO_POS.cx, 1.18, -14.55); B.player.x = CO_POS.x; B.player.z = CO_POS.z; }
    if (dt <= 0) { hud(); return; }

    if (mm.open && S.hour >= closeHour()) setOpen(false, true);
    if (mm.nextEntry > 0) mm.nextEntry -= dt;
    // teslimatlar
    for (const p of mm.pending) p.t -= dt;
    const ready = mm.pending.filter(p => p.t <= 0); mm.pending = mm.pending.filter(p => p.t > 0);
    for (const r of ready) deliverBoxes(r.pid, r.units, 'Toptancı siparişi');
    // kutu düşme animasyonu
    for (const bx of mm.boxes) if (bx.dropping) {
      bx.vy -= 9.81 * dt; bx.mesh.position.y += bx.vy * dt;
      if (bx.mesh.position.y <= bx.restY) { bx.mesh.position.y = bx.restY; if (Math.abs(bx.vy) > 1.2) bx.vy *= -0.3; else { bx.vy = 0; bx.dropping = false; } }
    }
    if (mm.signSwing > 0) { mm.signSwing -= dt; mm.sign.rotation.z = Math.sin(mm.signSwing * 14) * 0.15 * mm.signSwing; }
    // kuyruk düzeni
    queueList().forEach((n, i) => { n.targetX = HEAD_SPOT.x + Math.min(i, 4) * 0.12; n.targetZ = Math.min(-7.9, HEAD_SPOT.z + i * 0.78); });
    // kasa
    const co = mm.co;
    if (co) {
      if (!co.npc) {
        const h = queueHead(false);
        if (co.active && h && Math.hypot(h.x - HEAD_SPOT.x, h.z - HEAD_SPOT.z) < 0.5) beginCustomer(h);
      } else {
        const n = co.npc;
        if (n.order && co.active) n.order.patienceLeft = Math.max(n.order.patienceLeft, n.order.patienceMax * 0.6);
        for (const u of co.units) if (u.userData.scanning) {
          const s = (u.userData.scanning += dt * 4), target = mm.bagPos;
          u.position.lerp(target, Math.min(1, dt * 10)); u.scale.setScalar(Math.max(0.01, 1 - s * 0.8));
          if (s >= 1 && u.parent) u.parent.remove(u);
        }
        if (co.phase === 'scan' && co.scanned.length === n.order.items.length && co.idDone) startPayment();
      }
    }
    // personel: kasiyer
    const cashiers = Math.min(3, S.staffCount || 0);
    if (cashiers > 0) {
      mm.cashierT += dt * cashiers * (mm.up.scanner ? 1.4 : 1);
      const h = queueHead(true);
      if (h && mm.cashierT >= 9) {
        mm.cashierT = 0;
        if (Math.hypot(h.x - HEAD_SPOT.x, h.z - HEAD_SPOT.z) < 2.5) {
          if (h.order.needsId && h.order.age < 18) { rejectCustomer(h, 'Kimlik… tamam, gidiyorum.'); S.reputation = Math.min(100, S.reputation + 0.5); }
          else { settleSale(h, 'staff'); beep(1850, 0.05, 'square'); if (mm.scanGlow) { mm.scanGlow.material.color.set(0x22c55e); setTimeout(() => mm.scanGlow.material.color.set(0xef4444), 200); } }
        }
      } else if (!h) mm.cashierT = Math.min(mm.cashierT, 6);
    }
    // emote balonları
    for (const e of mm.emotes) { e.t -= dt; const g = e.n.meshObj.group; e.sp.position.set(g.position.x, g.position.y + (e.n.meshObj.stature || 1.75) + 0.55 + (2.2 - e.t) * 0.12, g.position.z); e.sp.material.opacity = Math.min(1, e.t * 2); }
    mm.emotes = mm.emotes.filter(e => { if (e.t <= 0) { B.scene.remove(e.sp); e.sp.material.map.dispose(); e.sp.material.dispose(); return false; } return true; });
    // hedef & HUD
    mm.target = resolveTarget();
    // gün sonu
    if (!mm.open && S.hour >= closeHour() - 0.001 && !mm.reportShown && insideCount() === 0 && !(mm.co && mm.co.npc)) { mm.reportShown = true; setTimeout(showReport, 600); }
    checkTutorial();
    mm.saveT += dt; if (mm.saveT > 45) { mm.saveT = 0; save(true); }
    hud();
  }


  // ---------------------------------------------------------------------------
  // VİTRİN SORUMLUSU (Daan, Noor) — kolileri teslimat alanından alır, rafa tek tek dizer
  // İş akışı (gerçek market raf düzeni): en az stoklu ürünün kolisini seç → koliye yürü →
  // kaldır → o ürünün bölmesine (yoksa boş bölmeye) yürü → birim birim diz (≈0.45 sn/adet) →
  // bölme dolarsa sıradaki bölmeye → koli boşalınca çöpe at → boşta: yerdeki boş kolileri topla,
  // yoksa rafları gezip düzenle. Yol: dükkân içi ızgara üzerinde A* (çarpışma kutuları + 0.3 m pay).
  // ---------------------------------------------------------------------------
  const NAV = { x0: -4.5, z0: -17.5, cs: 0.25, W: 36, H: 45 };
  function buildNav() {
    const g = new Uint8Array(NAV.W * NAV.H), r = 0.3;
    for (const c of B.colliders) {
      if (c.tag === 'door') continue;
      for (let gz = 0; gz < NAV.H; gz++) {
        const z = NAV.z0 + (gz + 0.5) * NAV.cs; if (z < c.minZ - r || z > c.maxZ + r) continue;
        for (let gx = 0; gx < NAV.W; gx++) {
          const x = NAV.x0 + (gx + 0.5) * NAV.cs;
          if (x >= c.minX - r && x <= c.maxX + r) g[gz * NAV.W + gx] = 1;
        }
      }
    }
    mm.nav = g;
  }
  const navCell = (x, z) => [clamp(Math.floor((x - NAV.x0) / NAV.cs), 0, NAV.W - 1), clamp(Math.floor((z - NAV.z0) / NAV.cs), 0, NAV.H - 1)];
  const navWorld = (gx, gz) => ({ x: NAV.x0 + (gx + 0.5) * NAV.cs, z: NAV.z0 + (gz + 0.5) * NAV.cs });
  const navFree = (gx, gz) => gx >= 0 && gz >= 0 && gx < NAV.W && gz < NAV.H && !mm.nav[gz * NAV.W + gx];
  function nearestFree(gx, gz) {
    if (navFree(gx, gz)) return [gx, gz];
    for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r && navFree(gx + dx, gz + dz)) return [gx + dx, gz + dz];
    return [gx, gz];
  }
  function lineFree(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (NAV.cs * 0.5));
    for (let i = 1; i < n; i++) { const t = i / n, [gx, gz] = navCell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t); if (!navFree(gx, gz)) return false; }
    return true;
  }
  function findPath(sx, sz, tx, tz) {
    if (!mm.nav) buildNav();
    const [s0, s1] = nearestFree(...navCell(sx, sz)), [g0, g1] = nearestFree(...navCell(tx, tz));
    const W = NAV.W, start = s1 * W + s0, goal = g1 * W + g0;
    const gs = new Float32Array(W * NAV.H).fill(1e9), from = new Int32Array(W * NAV.H).fill(-1), closed = new Uint8Array(W * NAV.H);
    const open = [start]; gs[start] = 0;
    const hfn = (k) => Math.hypot(k % W - g0, Math.floor(k / W) - g1);
    let found = false, guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (gs[open[i]] + hfn(open[i]) < gs[open[bi]] + hfn(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0]; if (cur === goal) { found = true; break; }
      closed[cur] = 1; const cx = cur % W, cz = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (!navFree(nx, nz)) continue;
        if (dx && dz && (!navFree(cx + dx, cz) || !navFree(cx, cz + dz))) continue;   // köşe kesme yok
        const k = nz * W + nx; if (closed[k]) continue;
        const ng = gs[cur] + (dx && dz ? 1.4142 : 1);
        if (ng < gs[k]) { gs[k] = ng; from[k] = cur; if (!open.includes(k)) open.push(k); }
      }
    }
    if (!found) return [{ x: tx, z: tz }];
    const cells = []; for (let k = goal; k !== -1; k = from[k]) cells.push(navWorld(k % W, Math.floor(k / W)));
    cells.reverse(); cells.push({ x: tx, z: tz });
    const out = [{ x: sx, z: sz }];   // görüş hattı ile sadeleştir
    let i = 0;
    while (i < cells.length - 1) { let j = cells.length - 1; while (j > i + 1 && !lineFree(out[out.length - 1], cells[j])) j--; out.push(cells[j]); i = j; }
    return out.slice(1);
  }
  const SHELF_STAND_X = 2.78, TRASH_STAND = { x: 3.15, z: -14.05 };
  const merchName = (i) => (STAFF.find(x => x.id === 'stocker').names[i] || 'Vitrin');
  function shelfStock(pid) { return mm.slots.reduce((a, s) => a + (s.pid === pid ? s.count : 0), 0); }
  function slotFor(pid) {
    const cap = slotCap();
    return mm.slots.find(x => x.pid === pid && x.count < cap)
      || mm.slots.find(x => !x.pid)
      || mm.slots.find(x => x.count === 0 && x.pid !== pid && mm.slots.some(y => y !== x && y.pid === x.pid))   // ürünün başka bölmesi varsa boş bölmeyi devral
      || mm.slots.find(x => x.count === 0 && !S.catalog.some(c => c.id === x.pid));
  }
  function claimable(b) { return b !== mm.held && !b.dropping && !b.claimedBy && !b.carriedBy && mm.boxes.includes(b); }
  function pickJob(w) {
    // 1) dolu koli: rafta en az kalan ürün önce
    const full = mm.boxes.filter(b => claimable(b) && b.qty > 0 && slotFor(b.pid)).sort((a, b) => shelfStock(a.pid) - shelfStock(b.pid) || a.id - b.id);
    if (full.length) return { box: full[0], dispose: false };
    // 2) yerde kalmış boş koli
    const empty = mm.boxes.find(b => claimable(b) && b.qty <= 0);
    if (empty) return { box: empty, dispose: true };
    return null;
  }
  function goTo(w, x, z, task) { w.path = findPath(w.x, w.z, x, z); w.task = task; }
  function merchDropBox(w) {
    const bx = w.box; if (!bx) return;
    bx.carriedBy = null; w.box = null;
    if (bx.mesh.parent) bx.mesh.parent.remove(bx.mesh);
    if (bx.qty > 0) { const sp = freeDeliverySpot(); addBoxToWorld(bx, sp.x, sp.y, sp.z, false); }
  }
  function staffStatus(role, i) {
    if (role === 'stocker') { const w = mm.merch[i]; return w ? w.status || 'Hazır' : 'İşe başlıyor'; }
    if (role === 'cashier') return queueHead(true) ? 'Kasada müşteriye bakıyor' : 'Kasada bekliyor';
    if (role === 'cleaner') return `Salonu temizliyor · hijyen %${Math.round(S.hygiene)}`;
    return '';
  }
  function stockerFrame(st, i, dt, el, anim) {
    if (!mm.started) return false;
    let w = mm.merch[i];
    if (!w) w = mm.merch[i] = { name: merchName(i), x: st.x, z: st.z, yaw: Math.PI, task: 'idle', path: [], t: 0, box: null, slot: null, phase: i, think: 0.3 * i, status: 'Hazır' };
    mm.navT += dt; if (mm.navT > 8) { mm.navT = 0; mm.nav = null; }   // dekor eklenirse yolu yenile
    const cap = slotCap();
    let speed = 0;
    // yol izleme
    if (w.path && w.path.length) {
      const p = w.path[0], dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz), v = w.box ? 1.05 : 1.25;
      if (d < 0.08) w.path.shift();
      else { const k = Math.min(1, v * dt / d); w.x += dx * k; w.z += dz * k; speed = v; const ty = Math.atan2(dx, dz); w.yaw += Math.atan2(Math.sin(ty - w.yaw), Math.cos(ty - w.yaw)) * Math.min(1, dt * 10); }
    }
    const arrived = !w.path || !w.path.length;
    // kutu oyuncu tarafından alındıysa ya da kaybolduysa işi bırak
    if (w.task === 'toBox' && (!w.target || !mm.boxes.includes(w.target) || mm.held === w.target)) { if (w.target) w.target.claimedBy = null; w.target = null; w.task = 'idle'; w.path = []; }
    if (w.task === 'idle') {
      w.think -= dt;
      if (w.think <= 0) {
        w.think = 0.6;
        const job = pickJob(w);
        if (job) {
          const b = job.box; b.claimedBy = w; w.target = b; w.dispose = job.dispose;
          const bp = b.mesh.position, ax = clamp(bp.x + 0.55, -3.9, 3.9);
          goTo(w, ax, bp.z - 0.15, 'toBox');
          w.status = job.dispose ? 'Boş koliyi topluyor' : `${META[b.pid].short} kolisine gidiyor`;
        } else if (!w.tidyT || w.tidyT <= 0) {
          const s = mm.slots[(i * 5 + Math.floor(el / 7)) % mm.slots.length];
          goTo(w, SHELF_STAND_X, s.zc, 'tidy'); w.tidyT = 6; w.status = 'Rafları düzenliyor';
        }
      }
    } else if (w.task === 'toBox' && arrived) {
      const b = w.target; w.target = null; b.claimedBy = null;
      // kutuyu kaldır: dünyadan ve nişan listesinden çıkar, elde taşınır
      mm.boxes = mm.boxes.filter(x => x !== b); mm.pick = mm.pick.filter(m => m !== b.mesh);
      b.carriedBy = w; b.dropping = false; w.box = b; beep(420, 0.04);
      if (w.dispose || b.qty <= 0) { goTo(w, TRASH_STAND.x, TRASH_STAND.z, 'toTrash'); w.status = 'Boş koliyi çöpe götürüyor'; }
      else {
        const s = slotFor(b.pid);
        if (s) { w.slot = s; goTo(w, SHELF_STAND_X, s.zc, 'toSlot'); w.status = `${META[b.pid].short} rafa taşınıyor`; }
        else { merchDropBox(w); w.task = 'idle'; w.status = 'Rafta yer yok — koli bekliyor'; }
      }
    } else if (w.task === 'toSlot' && arrived) {
      w.task = 'placing'; w.t = 0.3; w.status = `${META[w.box.pid].short} diziliyor`;
    } else if (w.task === 'placing') {
      const ty = Math.PI / 2; w.yaw += Math.atan2(Math.sin(ty - w.yaw), Math.cos(ty - w.yaw)) * Math.min(1, dt * 8);
      w.t -= dt;
      if (w.t <= 0) {
        const b = w.box, sl = w.slot;
        const ok = sl && (sl.pid === b.pid || sl.count === 0) && sl.count < cap;
        if (ok && b.qty > 0) {
          if (sl.pid !== b.pid) setSlotProduct(sl, b.pid);
          sl.count++; b.qty--; mm.totals.staffPlaced = (mm.totals.staffPlaced || 0) + 1;
          refreshSlot(sl); syncStock(); w.t = 0.45;
          if (Math.abs(B.player.x - w.x) + Math.abs(B.player.z - w.z) < 6) beep(880 + sl.count * 30, 0.03);
        }
        if (b.qty <= 0) { emote({ meshObj: st.meshObj }, `${w.name}: raf doldu ✓`); goTo(w, TRASH_STAND.x, TRASH_STAND.z, 'toTrash'); w.status = 'Boş koliyi çöpe götürüyor'; }
        else if (!ok || sl.count >= cap) {
          const s2 = slotFor(b.pid);
          if (s2 && s2 !== sl) { w.slot = s2; goTo(w, SHELF_STAND_X, s2.zc, 'toSlot'); }
          else { goTo(w, -2.0, -7.9, 'return'); w.status = 'Raf dolu — koliyi teslimat alanına geri koyuyor'; }
        }
      }
    } else if (w.task === 'toTrash' && arrived) {
      const b = w.box; w.box = null; if (b) { b.carriedBy = null; removeBox(b); }
      beep(140, 0.06); w.task = 'idle'; w.think = 0.4; w.status = 'Hazır';
    } else if (w.task === 'return' && arrived) {
      merchDropBox(w); w.task = 'idle'; w.status = 'Hazır';
    } else if (w.task === 'tidy') {
      w.think -= dt;
      if (w.think <= 0) { w.think = 0.6; if (pickJob(w)) { w.task = 'idle'; w.think = 0; w.path = []; } }
      if (w.task === 'tidy' && arrived) { w.tidyT -= dt; const ty = Math.PI / 2; w.yaw += Math.atan2(Math.sin(ty - w.yaw), Math.cos(ty - w.yaw)) * Math.min(1, dt * 6); if (w.tidyT <= 0 || pickJob(w)) { w.task = 'idle'; w.think = 0; } }
    }
    // taşınan koli: göğüs hizasında, raf önünde biraz alçalır
    if (w.box) {
      const m = w.box.mesh; if (m.parent !== mm.root) { if (m.parent) m.parent.remove(m); mm.root.add(m); }
      const reach = w.task === 'placing' ? 0.5 : 0.36, y = w.task === 'placing' && w.slot ? Math.max(0.55, w.slot.y + 0.32) : 1.02;
      m.position.set(w.x + Math.sin(w.yaw) * reach, FLOOR + y, w.z + Math.cos(w.yaw) * reach); m.rotation.set(0, w.yaw, 0);
    }
    // karakter: konum, yön, yürüme/taşıma animasyonu
    st.x = w.x; st.z = w.z;
    const g = st.meshObj.group; g.position.set(w.x, FLOOR, w.z); g.rotation.y = w.yaw;
    w.phase += speed * 3.6 * dt;
    anim(st, w.phase, speed, el);
    const c = st.meshObj.cast;
    if (c && c.setCarry) c.setCarry(w.box && w.task !== 'placing' ? 'box' : null);
    else if (st.meshObj.armL) {
      const placing = w.task === 'placing', lift = placing ? -1.1 + Math.sin(el * 9) * 0.25 : w.box ? -0.85 : null;
      if (lift != null) { st.meshObj.armL.shoulder.rotation.x = lift; st.meshObj.armR.shoulder.rotation.x = placing ? -1.25 - Math.sin(el * 9) * 0.25 : lift; }
      if (st.crate) st.crate.visible = false;
    }
    return true;
  }

  function emote(n, text) {
    const tex = canvasTex(320, 80, (c, w, h) => {
      c.fillStyle = 'rgba(15,23,42,0.88)'; roundRect(c, 4, 4, w - 8, h - 8, 26); c.fill();
      c.strokeStyle = 'rgba(16,185,129,0.8)'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#f8fafc'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2);
    });
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(1.2, 0.3, 1); sp.renderOrder = 999; B.scene.add(sp);
    mm.emotes.push({ n, sp, t: 2.2 });
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ---------------------------------------------------------------------------
  // GÖREVLER
  // ---------------------------------------------------------------------------
  const TUT = [
    { t: 'Tableti aç [Tab] ve Toptancı\'dan ilk kutunu sipariş et', done: () => mm.totals.orders > 0 },
    { t: 'Kargo gelince kapının solundaki kutuyu al [E]', done: () => !!mm.held || mm.totals.placed > 0 },
    { t: 'Ürünleri sağ duvardaki vitrin rafına diz (bölmeye bakıp tıkla)', done: () => mm.totals.placed >= 4 },
    { t: 'Fiyat etiketlerini kontrol et (Tablet → Fiyatlar)', done: () => mm.tutSeenPrices },
    { t: 'Kapı yanındaki tabelayı çevirip mağazayı AÇ', done: () => mm.open || mm.totals.served > 0 },
    { t: 'Kasaya geç: ürünleri okut, kimliğe bak, ödemeyi al', done: () => mm.totals.playerServed > 0 },
    { t: 'Kapanıştan sonra gün sonu raporunu incele', done: () => S.day > 1 }
  ];
  const GOALS = [
    { t: 'Seviye 3\'e ulaş', done: () => mm.level >= 3 },
    { t: 'Yeni bir ürün lisansı satın al', done: () => S.catalog.length > STARTER.length },
    { t: 'Bir kasiyer işe al', done: () => (S.staffCount || 0) > 0 },
    { t: 'Bir vitrin sorumlusu işe al (kolileri rafa o dizsin)', done: () => (S.roles.stocker || 0) > 0 },
    { t: 'Toplam 50 müşteriye hizmet et', done: () => mm.totals.served >= 50 },
    { t: 'Seviye 6\'ya ulaş ve Prinsen Gold\'u aç', done: () => S.catalog.some(c => c.id === 'prinsen_gold') },
    { t: '€10.000 nakite ulaş', done: () => S.cash >= 10000 }
  ];
  function currentGoal() {
    if (mm.tut < TUT.length) return { t: TUT[mm.tut].t, i: mm.tut + 1, n: TUT.length, tut: true };
    const g = GOALS.find(x => !x.done()); return g ? { t: g.t, i: GOALS.indexOf(g) + 1, n: GOALS.length } : { t: 'Amsterdam\'ın en iyi dükkânı sensin!', i: GOALS.length, n: GOALS.length };
  }
  function checkTutorial() {
    if (mm.tut < TUT.length && TUT[mm.tut].done()) {
      mm.tut++; S.cash = r2(S.cash + 50); addXP(15);
      toast('Görev tamamlandı ✓  +€50  +15 XP'); B.sound.chime();
    }
  }

  // ---------------------------------------------------------------------------
  // KAYIT
  // ---------------------------------------------------------------------------
  function save(silent) {
    if (!mm.started) return;
    const data = {
      v: 1, cash: S.cash, rep: S.reputation, day: S.day, hour: S.hour, level: mm.level, xp: mm.xp, open: false,
      catalog: S.catalog.map(c => ({ id: c.id, price: c.price })), slots: mm.slots.map(s => ({ pid: s.pid, count: s.count })),
      boxes: [...mm.boxes, ...(mm.held ? [mm.held] : []), ...mm.merch.filter(w => w && w.box).map(w => w.box)].filter(b => b.qty > 0).map(b => ({ pid: b.pid, qty: b.qty, x: (b === mm.held || b.carriedBy) ? null : b.mesh.position.x, y: (b === mm.held || b.carriedBy) ? null : b.restY, z: (b === mm.held || b.carriedBy) ? null : b.mesh.position.z })),
      pending: mm.pending, up: mm.up, staff: S.staffCount, roles: S.roles, tut: mm.tut, seenPrices: mm.tutSeenPrices, totals: mm.totals, marketIndex: S.marketIndex,
      ledger: S.ledger, stats: mm.stats, hygiene: S.hygiene, savedAt: Date.now()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); if (!silent) toast('Oyun kaydedildi.'); } catch (e) { if (!silent) toast('Kayıt yapılamadı (depolama kapalı).'); }
  }
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  function catalogItemFromDef(id) {
    const d = mm.defs[id];
    return { id, name: d.name, category: d.category, btw: d.btw, eps: d.eps, rop: d.rop || 8, eoq: d.eoq || 12, price: d.price, unitCost: d.unitCost, stock: 0, quality: d.quality || 90, color: d.color };
  }
  function resetWorld() {
    for (const b of [...mm.boxes]) removeBox(b);
    if (mm.held) { B.camera.remove(mm.held.mesh); mm.held = null; }
    for (const w of mm.merch) if (w && w.box && w.box.mesh.parent) w.box.mesh.parent.remove(w.box.mesh);
    mm.merch = [];
    for (const s of mm.slots) { s.count = 0; setSlotProduct(s, null); }
    mm.pending = []; if (mm.co) clearCounter(false); mm.co = null;
    for (const n of customers()) { if (n.order) B.removeOrderBubbleFromNPC(n); n.order = null; n.mmPlan = null; n.inCheckout = false; n.mmDone = false; if (n.state !== 'walk_away') { n.state = 'walk_away'; n.targetX = n.x < 0 ? -22 : 22; n.targetZ = -4.8; } }
  }
  function startGame(data) {
    resetWorld();
    const d = data || {};
    const ids = d.catalog ? d.catalog.map(c => c.id) : STARTER;
    S.catalog.length = 0;
    for (const id of ids) { if (!mm.defs[id]) continue; const it = catalogItemFromDef(id); const sv = d.catalog && d.catalog.find(c => c.id === id); if (sv) it.price = sv.price; S.catalog.push(it); }
    for (const l of S.licenses) l.unlocked = ids.includes(l.id);
    S.cash = d.cash != null ? d.cash : 1200; S.reputation = d.rep != null ? d.rep : 55; S.day = d.day || 1; S.hour = d.hour != null ? Math.min(d.hour, 21.5) : 8.0;
    if (d.hour != null && d.hour >= 21.5) S.hour = 8.0;
    S.priceMultiplier = 1.0; S.autoEOQ = false; S.marketIndex = d.marketIndex || 1.0; S.hygiene = d.hygiene || 96;
    S.staffCount = d.staff || 0; Object.assign(S.roles, { cleaner: 0, stocker: 0, security: 0 }, d.roles || {});
    S.ledger = d.ledger || { revenue: 0, netRevenue: 0, cogs: 0, stockCost: 0, staffCost: 0, rent: 0, energy: 0, tax: 0, maintenance: 0, profit: 0, salesCount: 0 };
    mm.level = d.level || 1; mm.xp = d.xp || 0; mm.up = d.up || {}; mm.tut = d.tut || 0; mm.tutSeenPrices = !!d.seenPrices;
    mm.totals = Object.assign({ served: 0, playerServed: 0, placed: 0, orders: 0 }, d.totals || {});
    mm.pending = d.pending || [];
    if (d.slots) d.slots.forEach((sv, i) => { const s = mm.slots[i]; if (!s) return; if (sv.pid && mm.defs[sv.pid]) { setSlotProduct(s, sv.pid); s.count = sv.count; refreshSlot(s); } });
    else STARTER.forEach((id, i) => setSlotProduct(mm.slots[i], id));
    if (d.boxes) d.boxes.forEach(b => { const bx = makeBox(b.pid, b.qty); if (b.x == null) { const sp = freeDeliverySpot(); addBoxToWorld(bx, sp.x, sp.y, sp.z, false); } else addBoxToWorld(bx, b.x, b.y, b.z, false); });
    syncStock();
    mm.stats = d.stats || newStats(); mm.stats.repStart = mm.stats.repStart || S.reputation;
    mm.open = false; mm.reportShown = false; setOpenSilent(false);
    B.syncStaffEntities(); B.recomputeProfit(); B.updateAtmosphere(); B.updateUI();
    // oyuncuyu mağazanın içinde, kapının yanında başlat
    Object.assign(B.player, { x: 0.6, z: -8.2, yaw: Math.PI * 0.15, pitch: -0.05 });
    B.setCameraMode(mm.settings.cam === 2 ? 2 : 1);
    mm.started = true; mm.menu = false;
    document.body.classList.add('mm-on'); document.body.classList.remove('mm-menu');
    hideAll(); setPaused(false); hud(true);
    if (!data) banner('Hoş geldin!', 'Jordaan\'daki dükkânın senin. Önce tabletten [Tab] ürün sipariş et.');
    else toast(`Gün ${S.day} yüklendi.`);
  }
  function setOpenSilent(v) { mm.open = v; S.doorOpen = v; mm.signMat.map = mm.signMat.emissiveMap = v ? mm.signTex.open : mm.signTex.closed; mm.signMat.needsUpdate = true; }

  // ---------------------------------------------------------------------------
  // GÜN SONU RAPORU
  // ---------------------------------------------------------------------------
  function dayCosts() {
    const roleW = (S.roles.cleaner || 0) * 65 + (S.roles.stocker || 0) * 75 + (S.roles.security || 0) * 85;
    const branch = S.branches.reduce((a, b) => a + (b.owned ? b.dailyNet : 0), 0);
    return { rent: 140, staff: (S.staffCount || 0) * 95 + roleW, energy: 60, branch };
  }
  function showReport() {
    if (mm.ui === 'report') return;
    const st = mm.stats, L = S.ledger, c = dayCosts();
    const net = r2(L.netRevenue - L.stockCost - c.rent - c.staff - c.energy + c.branch);
    const dRep = +(S.reputation - st.repStart).toFixed(1);
    openUI('report');
    el('mm-report-body').innerHTML = `
      <div class="mm-rep-grid">
        <div class="mm-kpi"><b>${st.served}</b><span>Hizmet edilen müşteri</span></div>
        <div class="mm-kpi"><b>${st.items}</b><span>Satılan ürün</span></div>
        <div class="mm-kpi"><b>${eur(st.revenue)}</b><span>Brüt ciro</span></div>
        <div class="mm-kpi ${dRep >= 0 ? 'ok' : 'bad'}"><b>${dRep >= 0 ? '+' : ''}${dRep}</b><span>İtibar değişimi</span></div>
      </div>
      <table class="mm-table">
        <tr><td>Satışlar (KDV hariç)</td><td>${eur(L.netRevenue)}</td></tr>
        <tr><td>Toptan alımlar (stok)</td><td class="neg">−${eur(L.stockCost)}</td></tr>
        <tr><td>Kira</td><td class="neg">−${eur(c.rent)}</td></tr>
        <tr><td>Personel maaşları</td><td class="neg">−${eur(c.staff)}</td></tr>
        <tr><td>Enerji & bakım</td><td class="neg">−${eur(c.energy)}</td></tr>
        ${c.branch ? `<tr><td>Şube gelirleri</td><td>${eur(c.branch)}</td></tr>` : ''}
        <tr class="tot"><td>Günün net sonucu</td><td class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '' : '−'}${eur(Math.abs(net))}</td></tr>
      </table>
      <div class="mm-rep-foot">Satılan malın maliyeti: <b>${eur(L.cogs)}</b> (brüt kâr ${eur(L.netRevenue - L.cogs)}) · Kaçan müşteri: <b>${st.lost}</b> · Bulunamayan ürün: <b>${st.missed}</b> · Kimlik kontrolü: <b>${st.idOk}</b> doğru / <b>${st.idBad}</b> hatalı · Kazanılan XP: <b>${st.xp}</b></div>`;
  }
  function nextDay() {
    // stok alımları ve COGS zaten nakitten düşüldü; endDaySettlement sabit giderleri düşer
    B.endDaySettlement();
    S.hour = 8.0; mm.stats = newStats(); mm.reportShown = false; setOpenSilent(false);
    if (S.hygiene < 70 && !(S.roles.cleaner > 0)) toast('Hijyen düşük! Temizlik görevlisi işe almayı düşün.');
    S.hygiene = Math.min(100, S.hygiene + 8 + (S.roles.cleaner || 0) * 10);
    // Atölye: günde bir parti, toptan maliyetin %55'i ile üretilir ve teslimat alanına bırakılır
    let fac = '';
    const F = S.facility, fit = F && S.catalog[F.productIdx % S.catalog.length];
    if (fit) {
      const cost = r2(unitCost(fit) * 0.55 * F.capacity);
      if (S.cash >= cost) { S.cash = r2(S.cash - cost); S.ledger.stockCost = r2((S.ledger.stockCost || 0) + cost); deliverBoxes(fit.id, F.capacity, 'Atölye'); fac = ` · Atölye: ${F.capacity} ${META[fit.id].short} (${eur(cost)})`; }
    }
    hideAll(); setPaused(false); save(true);
    banner(`GÜN ${S.day}`, `Piyasa endeksi ×${S.marketIndex.toFixed(2)} — toptan fiyatlar ${S.marketIndex > 1 ? 'yükseldi' : 'düştü'}.${fac}`);
  }
  function endDayNow() {
    if (mm.open) { toast('Önce mağazayı kapat (tabela).'); return; }
    if (insideCount() > 0) { toast('İçeride hâlâ müşteri var.'); return; }
    mm.reportShown = true; showReport();
  }

  // ---------------------------------------------------------------------------
  // TABLET (GrachtOS)
  // ---------------------------------------------------------------------------
  const cart = {};
  let tabApp = 'order', tabFocus = null;
  function openTablet(app, focus) {
    if (!mm.started) return;
    tabApp = app || tabApp; tabFocus = focus || null;
    openUI('tablet'); renderTablet();
  }
  function renderTablet() {
    document.querySelectorAll('#mm-tablet .mm-nav button').forEach(b => b.classList.toggle('on', b.dataset.app === tabApp));
    el('mm-tab-cash').textContent = eur(S.cash);
    const body = el('mm-tab-body');
    if (tabApp === 'prices') mm.tutSeenPrices = true;
    if (tabApp === 'order') {
      const rows = S.catalog.map(it => {
        const per = META[it.id].box, uc = unitCost(it), bc = r2(uc * per), q = cart[it.id] || 0;
        const inBoxes = [...mm.boxes, ...(mm.held ? [mm.held] : []), ...mm.merch.filter(w => w && w.box).map(w => w.box)].filter(b => b.pid === it.id).reduce((a, b) => a + b.qty, 0);
        const onWay = mm.pending.filter(p => p.pid === it.id).reduce((a, p) => a + p.units, 0);
        return `<div class="mm-prod"><div class="sw" style="background:${hex(it.color)}"></div>
          <div class="info"><b>${META[it.id].short}</b><small>${it.category === 'Botanical' ? 'Botanik · 18+' : 'Kafe'} · kutu ${per} adet</small>
          <small>Rafta <b>${it.stock}</b> · Kutuda <b>${inBoxes}</b>${onWay ? ` · Yolda <b>${onWay}</b>` : ''}</small></div>
          <div class="pr"><small>Birim ${eur(uc)}</small><b>${eur(bc)}</b><small>/ kutu</small></div>
          <div class="qty"><button data-q="-1" data-id="${it.id}">−</button><span>${q}</span><button data-q="1" data-id="${it.id}">+</button></div></div>`;
      }).join('');
      const total = r2(S.catalog.reduce((a, it) => a + (cart[it.id] || 0) * unitCost(it) * META[it.id].box, 0));
      body.innerHTML = `<div class="mm-app-head"><h3>Toptancı</h3><span>Piyasa endeksi ×${S.marketIndex.toFixed(2)} · teslimat ${mm.up.express ? '≈10 sn' : '≈20 sn'}</span></div>
        <div class="mm-prod-list">${rows}</div>
        <div class="mm-cart"><span>Sepet: <b>${Object.values(cart).reduce((a, b) => a + b, 0)}</b> kutu</span><b class="tot">${eur(total)}</b>
        <button class="mm-btn pri" id="mm-buy" ${total <= 0 || total > S.cash ? 'disabled' : ''}>${total > S.cash ? 'Bakiye yetersiz' : 'Sipariş ver'}</button></div>`;
    } else if (tabApp === 'prices') {
      const rows = S.catalog.map(it => {
        const mp = marketPrice(it), uc = unitCost(it), margin = it.price > 0 ? Math.round((1 - uc / (it.price / (1 + it.btw))) * 100) : 0, ratio = it.price / mp;
        const dem = ratio <= 1 ? ['Yüksek', 'ok'] : ratio < 1.15 ? ['Normal', ''] : ratio < 1.35 ? ['Düşük', 'warn'] : ['Çok düşük', 'bad'];
        return `<tr class="${tabFocus === it.id ? 'focus' : ''}"><td><span class="dot" style="background:${hex(it.color)}"></span>${META[it.id].short}</td><td>${eur(uc)}</td><td>${eur(mp)}</td>
          <td class="pset"><button data-p="-0.5" data-id="${it.id}">−.50</button><button data-p="-0.1" data-id="${it.id}">−.10</button><b>${eur(it.price)}</b><button data-p="0.1" data-id="${it.id}">+.10</button><button data-p="0.5" data-id="${it.id}">+.50</button></td>
          <td class="${margin < 0 ? 'neg' : ''}">%${margin}</td><td><span class="tag ${dem[1]}">${dem[0]}</span></td>
          <td><button class="mm-btn sm" data-pm="${it.id}">Piyasa</button></td></tr>`;
      }).join('');
      body.innerHTML = `<div class="mm-app-head"><h3>Fiyatlar</h3><span>Piyasa fiyatının üstüne çıktıkça müşteriler ürünü rafta bırakır.</span></div>
        <table class="mm-table mm-prices"><tr><th>Ürün</th><th>Maliyet</th><th>Piyasa</th><th>Senin fiyatın</th><th>Marj</th><th>Talep</th><th></th></tr>${rows}</table>`;
    } else if (tabApp === 'licenses') {
      body.innerHTML = `<div class="mm-app-head"><h3>Ürün lisansları</h3><span>Seviye atladıkça yeni ürünler satabilirsin.</span></div><div class="mm-cards">` + LICENSES.map(l => {
        const d = mm.defs[l.id], own = S.catalog.some(c => c.id === l.id), lock = mm.level < l.level;
        return `<div class="mm-card ${own ? 'own' : lock ? 'lock' : ''}"><div class="sw" style="background:${hex(d.color)}"></div><b>${META[l.id].short}</b>
          <small>${d.category === 'Botanical' ? 'Botanik · 18+' : 'Kafe'} · piyasa ${eur(d.price)}</small>
          ${own ? '<span class="tag ok">Satışta</span>' : lock ? `<span class="tag">Seviye ${l.level}</span>` : `<button class="mm-btn pri" data-lic="${l.id}" ${S.cash < l.cost ? 'disabled' : ''}>Satın al ${eur(l.cost)}</button>`}</div>`;
      }).join('') + '</div>';
    } else if (tabApp === 'staff') {
      const cnt = { cashier: S.staffCount || 0, stocker: S.roles.stocker || 0, cleaner: S.roles.cleaner || 0 };
      const roster = [];
      STAFF.forEach(st => { for (let i = 0; i < cnt[st.id]; i++) roster.push(`<div><b>${st.names[i] || st.name}</b> · ${st.name} — <span>${staffStatus(st.id, i)}</span></div>`); });
      body.innerHTML = `<div class="mm-app-head"><h3>Personel</h3><span>Günlük maaş toplamı ${eur(dayCosts().staff)} · gün sonunda ödenir.</span></div>` +
        (roster.length ? `<div class="mm-reviews mm-roster">${roster.join('')}</div>` : '') + `<div class="mm-cards">` + STAFF.map(s => {
        const lock = mm.level < s.level;
        return `<div class="mm-card ${lock ? 'lock' : ''}"><b>${s.name}</b><small>${s.desc}</small><small>Ekip: ${s.names.slice(0, s.max).join(', ')}</small><small>İşe alım ${eur(s.hire)} · günlük ${eur(s.wage)}</small>
          <div class="row"><span class="tag">Çalışan: ${cnt[s.id]}/${s.max}</span>${lock ? `<span class="tag">Seviye ${s.level}</span>` :
          `<button class="mm-btn sm" data-fire="${s.id}" ${cnt[s.id] ? '' : 'disabled'}>Çıkar</button><button class="mm-btn pri sm" data-hire="${s.id}" ${cnt[s.id] >= s.max || S.cash < s.hire ? 'disabled' : ''}>İşe al</button>`}</div></div>`;
      }).join('') + '</div>';
    } else if (tabApp === 'upgrades') {
      body.innerHTML = `<div class="mm-app-head"><h3>Mağaza yükseltmeleri</h3><span>Dekorasyon için: Yönetim → Dekor</span></div><div class="mm-cards">` + UPGRADES.map(u => {
        const own = mm.up[u.id], lock = mm.level < u.level;
        return `<div class="mm-card ${own ? 'own' : lock ? 'lock' : ''}"><b>${u.name}</b><small>${u.desc}</small>
          ${own ? '<span class="tag ok">Kuruldu</span>' : lock ? `<span class="tag">Seviye ${u.level}</span>` : `<button class="mm-btn pri" data-up="${u.id}" ${S.cash < u.cost ? 'disabled' : ''}>Satın al ${eur(u.cost)}</button>`}</div>`;
      }).join('') + '</div>';
    } else if (tabApp === 'report') {
      const st = mm.stats, q = queueList().length;
      body.innerHTML = `<div class="mm-app-head"><h3>Bugün — Gün ${S.day}</h3><span>${mm.open ? 'Mağaza açık' : 'Mağaza kapalı'} · kuyrukta ${q} müşteri</span></div>
        <div class="mm-rep-grid"><div class="mm-kpi"><b>${st.served}</b><span>Müşteri</span></div><div class="mm-kpi"><b>${st.items}</b><span>Ürün</span></div>
        <div class="mm-kpi"><b>${eur(st.revenue)}</b><span>Ciro</span></div><div class="mm-kpi"><b>${S.reputation.toFixed(0)}</b><span>İtibar</span></div></div>
        <div class="mm-reviews">${S.reviews.slice(-4).reverse().map(r => `<div>${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)} <span>${r.text}</span></div>`).join('')}</div>
        <div class="row" style="gap:8px;margin-top:12px"><button class="mm-btn" id="mm-save-now">Kaydet</button><button class="mm-btn pri" id="mm-end-day">Günü bitir</button></div>`;
    }
  }
  function tabletClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.app) { tabApp = b.dataset.app; tabFocus = null; renderTablet(); return; }
    if (b.id === 'mm-tab-close') { closeUI(); return; }
    if (b.dataset.q) { const id = b.dataset.id; cart[id] = Math.max(0, Math.min(20, (cart[id] || 0) + (+b.dataset.q))); beep(700, 0.03); renderTablet(); return; }
    if (b.id === 'mm-buy') {
      let total = 0; const lines = [];
      for (const it of S.catalog) { const k = cart[it.id] || 0; if (!k) continue; const c = r2(k * META[it.id].box * unitCost(it)); total += c; lines.push({ pid: it.id, units: k * META[it.id].box }); }
      total = r2(total); if (!lines.length || total > S.cash) return;
      S.cash = r2(S.cash - total); S.ledger.stockCost = r2(S.ledger.stockCost + total); B.recomputeProfit();
      const eta = mm.up.express ? 10 : 20;
      lines.forEach((l, i) => mm.pending.push({ pid: l.pid, units: l.units, t: eta + i * 0.6 }));
      for (const k in cart) delete cart[k];
      mm.totals.orders++; B.sound.chime(); toast(`Sipariş verildi (${eur(total)}). Kargo ~${eta} sn içinde kapının soluna gelecek.`);
      renderTablet(); hud(true); return;
    }
    if (b.dataset.p) { const it = item(b.dataset.id); it.price = r2(Math.max(0.5, it.price + (+b.dataset.p))); afterPrice(it); return; }
    if (b.dataset.pm) { const it = item(b.dataset.pm); it.price = marketPrice(it); afterPrice(it); return; }
    if (b.dataset.lic) {
      const l = LICENSES.find(x => x.id === b.dataset.lic); if (!l || S.cash < l.cost || mm.level < l.level) return;
      S.cash = r2(S.cash - l.cost); S.catalog.push(catalogItemFromDef(l.id));
      const lic = S.licenses.find(x => x.id === l.id); if (lic) lic.unlocked = true;
      const s = mm.slots.find(x => !x.pid) || mm.slots.find(x => x.count === 0 && !S.catalog.some(c => c.id === x.pid));
      if (s) setSlotProduct(s, l.id);
      B.sound.chime(); banner('Yeni ürün!', `${META[l.id].short} artık satışta — Toptancı'dan sipariş edebilirsin.`); renderTablet(); B.updateUI(); return;
    }
    if (b.dataset.hire) {
      const s = STAFF.find(x => x.id === b.dataset.hire); if (S.cash < s.hire) return;
      S.cash = r2(S.cash - s.hire);
      const idx = s.id === 'cashier' ? (S.staffCount || 0) : (S.roles[s.id] || 0);
      if (s.id === 'cashier') S.staffCount = (S.staffCount || 0) + 1; else S.roles[s.id] = (S.roles[s.id] || 0) + 1;
      B.syncStaffEntities(); B.sound.chime(); toast(`${s.names[idx] || ''} işe başladı — ${s.name}.`); renderTablet(); return;
    }
    if (b.dataset.fire) {
      const id = b.dataset.fire;
      if (id === 'stocker') { const k = (S.roles.stocker || 0) - 1, w = mm.merch[k]; if (w) { merchDropBox(w); mm.merch.length = Math.max(0, k); } }
      if (id === 'cashier') S.staffCount = Math.max(0, (S.staffCount || 0) - 1); else S.roles[id] = Math.max(0, (S.roles[id] || 0) - 1);
      B.syncStaffEntities(); renderTablet(); return;
    }
    if (b.dataset.up) {
      const u = UPGRADES.find(x => x.id === b.dataset.up); if (S.cash < u.cost) return;
      S.cash = r2(S.cash - u.cost); mm.up[u.id] = true; if (u.id === 'shelfCap') mm.slots.forEach(refreshSlot);
      B.sound.chime(); toast(`${u.name} kuruldu.`); renderTablet(); return;
    }
    if (b.id === 'mm-save-now') { save(); return; }
    if (b.id === 'mm-end-day') { closeUI(); endDayNow(); return; }
  }
  function afterPrice(it) { mm.slots.filter(s => s.pid === it.id).forEach(drawTag); beep(760, 0.03); renderTablet(); }

  // ---------------------------------------------------------------------------
  // UI (DOM)
  // ---------------------------------------------------------------------------
  const el = (id) => document.getElementById(id);
  function toast(m) { B.showToast(m); }
  let bannerT = null;
  function banner(a, b) {
    const x = el('mm-banner'); x.querySelector('b').textContent = a; x.querySelector('span').textContent = b || '';
    x.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => x.classList.remove('show'), 3600);
  }
  function beep(f, d, type) { try { B.sound.playTone(f, d, type || 'sine', 0.05); } catch (e) {} }
  function clearKeys() { for (const k in B.keys) B.keys[k] = false; }
  function setPaused(v) { window.__gamePaused = v; }
  function openUI(name) {
    mm.ui = name; releaseLock(); clearKeys();
    ['mm-tablet', 'mm-pause', 'mm-settings', 'mm-help', 'mm-report', 'mm-confirm'].forEach(id => el(id).classList.toggle('open', id === 'mm-' + name));
    if (name === 'pause' || name === 'report' || name === 'settings' || name === 'help' || name === 'confirm') setPaused(true);
  }
  function closeUI() {
    const was = mm.ui; mm.ui = null; clearKeys();
    ['mm-tablet', 'mm-pause', 'mm-settings', 'mm-help', 'mm-report', 'mm-confirm'].forEach(id => el(id).classList.remove('open'));
    if (mm.menu) { el('mm-menu').classList.add('open'); return; }
    if (was === 'settings' || was === 'help') { if (mm.started) { openUI('pause'); return; } }
    setPaused(false);
  }
  function hideAll() { mm.ui = null; ['mm-tablet', 'mm-pause', 'mm-settings', 'mm-help', 'mm-report', 'mm-confirm', 'mm-menu'].forEach(id => el(id).classList.remove('open')); }
  function showMainMenu() {
    mm.menu = true; setPaused(true); releaseLock();
    if (mm.started) save(true);
    mm.started = false; document.body.classList.add('mm-menu'); document.body.classList.remove('mm-on', 'mm-in-co');
    hideAll(); el('mm-menu').classList.add('open');
    const sv = loadSave(), c = el('mm-continue');
    c.style.display = sv ? '' : 'none';
    if (sv) c.querySelector('small').textContent = `Gün ${sv.day} · Seviye ${sv.level} · ${eur(sv.cash)}`;
  }
  function confirmBox(text, yes) {
    openUI('confirm'); el('mm-confirm-text').textContent = text;
    el('mm-confirm-yes').onclick = () => { hideAll(); yes(); };
    el('mm-confirm-no').onclick = () => { if (mm.menu) { hideAll(); el('mm-menu').classList.add('open'); } else closeUI(); };
  }
  function applySettings() {
    B.setRenderMode(mm.settings.gfx === 'basic' ? 'basic' : 'hdr');
    if (window.setGfxQuality) window.setGfxQuality(mm.settings.q || 'auto');
    S.timeScale = { short: 84, normal: 60, long: 40 }[mm.settings.day] || 60;
    try { localStorage.setItem(SET_KEY, JSON.stringify(mm.settings)); } catch (e) {}
    renderSettings();
  }
  function renderSettings() {
    const s = mm.settings, seg = (k, opts) => opts.map(([v, l]) => `<button class="mm-seg ${s[k] === v ? 'on' : ''}" data-set="${k}" data-v="${v}">${l}</button>`).join('');
    el('mm-settings-body').innerHTML = `
      <label>Grafik kalitesi</label><div class="mm-segs">${seg('q', [['auto', 'Otomatik'], ['low', 'Düşük'], ['med', 'Orta'], ['high', 'Yüksek'], ['ultra', 'Ultra']])}</div>
      <p class="hint">Otomatik: oyun en az 45 FPS'te kalacak şekilde çözünürlüğü kendisi ayarlar. Diğer seçeneklerde kalite sabit kalır, otomatik düşmez.${window.__perfGov && window.__perfGov.fps ? ` Şu an ≈ <b>${Math.round(window.__perfGov.fps)} FPS</b>.` : ''}</p>
      <label>Işık modu</label><div class="mm-segs">${seg('gfx', [['hdr', 'HDR'], ['basic', 'Uyumlu (hızlı)']])}</div>
      <p class="hint">Görüntü bozuk ya da takılıyorsa “Uyumlu” seç.</p>
      <label>Gün uzunluğu</label><div class="mm-segs">${seg('day', [['short', 'Kısa · 10 dk'], ['normal', 'Normal · 14 dk'], ['long', 'Uzun · 21 dk']])}</div>
      <label>Kamera</label><div class="mm-segs">${seg('cam', [[1, '1. şahıs'], [2, '3. şahıs']])}</div>
      <label>Fare hassasiyeti <b>${s.sens.toFixed(1)}×</b></label><input type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}" id="mm-sens">
      <label>Ses</label><div class="mm-segs"><button class="mm-seg ${S.audioEnabled ? 'on' : ''}" id="mm-snd">${S.audioEnabled ? 'Açık' : 'Kapalı'}</button></div>
      ${window.ModelCast && ModelCast.local ? `<label>Kendi modellerin</label><div class="mm-local" id="mm-local-list">Yükleniyor…</div>
      <div class="mm-local-add"><input id="mm-local-name" maxlength="28" placeholder="Karakter adı (isteğe bağlı)"><label class="mm-btn pri sm">GLB ekle<input type="file" accept=".glb" id="mm-local-file" hidden></label></div>
      <p class="hint">Dosya yalnızca bu cihazın tarayıcısında saklanır, hiçbir yere yüklenmez. Eklenen karakter müşterilere ve galeriye katılır. İskeletli (rigged) modeller kol ve bacaklarıyla yürür.</p>` : ''}`;
    refreshLocal();
  }

  async function refreshLocal() {
    const box = el('mm-local-list'); if (!box || !window.ModelCast) return;
    const list = await ModelCast.local.list();
    box.innerHTML = list.length ? list.map(m => `<div class="row"><span>${m.name.replace(/[<>&]/g, '')} <small>${(m.size / 1048576).toFixed(1)} MB · ${m.rigged ? 'iskeletli' : 'iskeletsiz'}</small></span><button class="mm-btn sm" data-ldel="${m.id}">Sil</button></div>`).join('') : '<small>Henüz eklenmedi.</small>';
  }
  function hud(force) {
    if (!mm.started) return;
    const now = performance.now(); if (!force && now - mm.hudT < 150) { crosshair(); return; } mm.hudT = now;
    el('mm-cash').textContent = eur(S.cash);
    el('mm-lv').textContent = mm.level;
    el('mm-xp').style.width = Math.min(100, mm.xp / xpFor(mm.level) * 100) + '%';
    el('mm-xp-t').textContent = `${mm.xp}/${xpFor(mm.level)} XP`;
    el('mm-rep').textContent = S.reputation.toFixed(0);
    const h = Math.floor(S.hour), m = Math.floor((S.hour % 1) * 60);
    el('mm-clock').textContent = `Gün ${S.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const st = el('mm-store'); st.textContent = mm.open ? 'AÇIK' : 'KAPALI'; st.className = 'mm-store ' + (mm.open ? 'on' : 'off');
    const g = currentGoal(); el('mm-goal-t').textContent = g.t; el('mm-goal-n').textContent = g.tut ? `Eğitim ${g.i}/${g.n}` : `Hedef ${g.i}/${g.n}`;
    const q = queueList().filter(n => n.state === 'queued').length, alert = el('mm-alert');
    const staffed = (S.staffCount || 0) > 0;
    if (q > 0 && !(mm.co && mm.co.active) && !staffed) { alert.textContent = `Kasada ${q} müşteri bekliyor!`; alert.className = 'show'; }
    else if (mm.pending.length) { const tt = Math.max(0, Math.ceil(Math.min(...mm.pending.map(p => p.t)))); alert.textContent = `Kargo yolda · ${tt} sn`; alert.className = 'show info'; }
    else alert.className = '';
    const hint = el('mm-hint');
    hint.innerHTML = mm.co && mm.co.active ? '<span><kbd>Tık</kbd> Ürünü okut</span><span><kbd>Esc</kbd> Kasadan çık</span>' :
      mm.held ? '<span><kbd>Tık/E</kbd> Rafa diz</span><span><kbd>G</kbd> Kutuyu bırak</span><span><kbd>Tab</kbd> Tablet</span>' :
        '<span><kbd>WASD</kbd> Yürü</span><span><kbd>Tık/E</kbd> Etkileşim</span><span><kbd>Tab</kbd> Tablet</span><span><kbd>Esc</kbd> Menü</span>';
    el('mm-act').textContent = mm.target ? (mm.target.ok ? 'Etkileşim' : '—') : 'Etkileşim';
    el('mm-drop').style.display = mm.held ? '' : 'none';
    crosshair();
  }
  function crosshair() {
    const t = mm.target, lab = el('mm-target');
    el('mm-cross').classList.toggle('hot', !!(t && t.ok));
    if (t) { lab.textContent = (t.ok ? '[E]  ' : '') + t.label; lab.classList.add('show'); lab.classList.toggle('no', !t.ok); }
    else lab.classList.remove('show');
  }

  // Kasa ekranı
  function renderCO() {
    const box = el('mm-co'); const co = mm.co;
    if (!co || !co.active) { box.classList.remove('open'); return; }
    box.classList.add('open');
    const n = co.npc, list = el('mm-co-list'), pay = el('mm-co-pay'), idb = el('mm-co-id'), cust = el('mm-co-cust');
    el('mm-co-date').textContent = fmtDate(gameDate());
    if (!n) {
      cust.innerHTML = `<b>Kasa boş</b><small>${queueList().length ? 'Sıradaki müşteri geliyor…' : 'Bekleyen müşteri yok. Mağazanın açık olduğundan emin ol.'}</small>`;
      list.innerHTML = '<div class="empty">—</div>'; el('mm-co-total').textContent = eur(0); pay.innerHTML = ''; idb.innerHTML = ''; idb.classList.remove('show'); return;
    }
    const left = n.order.items.length - co.scanned.length;
    cust.innerHTML = `<b>${n.order.custName}</b><small>${left > 0 ? `Okutulacak ${left} ürün — tezgâhtaki ürünlere tıkla` : co.idDone ? 'Ödeme bekleniyor' : 'Kimliği kontrol et'}</small>`;
    const grouped = {}; co.scanned.forEach(id => grouped[id] = (grouped[id] || 0) + 1);
    list.innerHTML = Object.keys(grouped).map(id => { const it = item(id) || mm.defs[id]; return `<div class="ln"><span>${grouped[id]}× ${META[id].short}</span><b>${eur(it.price * grouped[id])}</b></div>`; }).join('') || '<div class="empty">Ürün okutulmadı</div>';
    el('mm-co-total').textContent = eur(coTotal());
    if (co.id && !co.idDone) {
      const d = co.id;
      idb.classList.add('show');
      idb.innerHTML = `<div class="idc"><div class="idh">KONINKRIJK DER NEDERLANDEN · KİMLİK KARTI</div>
        <div class="idr"><div class="ph" style="background:${d.color}">${d.name[0]}</div><div>
        <small>Ad Soyad</small><b>${d.name}</b><small>Doğum tarihi</small><b class="dob">${fmtDate(d.dob)}</b><small>Belge no</small><b>${d.no}</b></div></div></div>
        <div class="idq">Bugün <b>${fmtDate(gameDate())}</b>. Botanik ürünler için müşteri <b>18 yaşını doldurmuş</b> olmalı.</div>
        <div class="row"><button class="mm-btn bad" id="mm-id-no">Reddet</button><button class="mm-btn pri" id="mm-id-ok">Onayla</button></div>`;
    } else { idb.classList.remove('show'); idb.innerHTML = ''; }
    if (co.phase === 'pay' && co.pay) {
      const p = co.pay;
      if (p.type === 'card') {
        pay.innerHTML = `<div class="ph-t">💳 Kartla ödeme — tutarı terminale gir</div><div class="term"><div class="scr">${p.entered ? '€' + p.entered : '€0.00'}</div>
          <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
          <button class="mm-btn pri wide" id="mm-pay-ok">Onayla ✓</button></div>`;
      } else {
        const g = r2(p.given.reduce((a, v) => a + v, 0));
        pay.innerHTML = `<div class="ph-t">💶 Nakit — müşteri <b>${eur(p.paid)}</b> verdi</div>
          <div class="chg"><div><small>Para üstü</small><b>${eur(p.change)}</b></div><div><small>Verilen</small><b class="${g > p.change + 0.001 ? 'neg' : g >= p.change - 0.001 ? 'pos' : ''}">${eur(g)}</b></div></div>
          <div class="mm-drawer">${DENOMS.map(v => `<button class="${v >= 5 ? 'note' : 'coin'}" data-d="${v}">${v >= 1 ? '€' + v : (v * 100).toFixed(0) + 'c'}</button>`).join('')}</div>
          <div class="row"><button class="mm-btn" id="mm-pay-undo">Geri al</button><button class="mm-btn pri" id="mm-pay-ok">Para üstünü ver</button></div>`;
      }
    } else pay.innerHTML = '';
  }
  function coClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const co = mm.co; if (!co) return;
    if (b.id === 'mm-co-exit') { exitCheckout(); renderCO(); return; }
    if (b.id === 'mm-id-ok') { idDecision(true); return; }
    if (b.id === 'mm-id-no') { idDecision(false); return; }
    const p = co.pay; if (!p) return;
    if (b.dataset.k) { const k = b.dataset.k; if (k === '⌫') p.entered = p.entered.slice(0, -1); else if (p.entered.length < 8 && !(k === '.' && p.entered.includes('.')) && !(p.entered.includes('.') && p.entered.split('.')[1].length >= 2)) p.entered += k; beep(1200, 0.02); renderCO(); }
    if (b.dataset.d) { p.given.push(+b.dataset.d); beep(1000, 0.02); renderCO(); }
    if (b.id === 'mm-pay-undo') { p.given.pop(); renderCO(); }
    if (b.id === 'mm-pay-ok') finishPayment();
  }

  // ---------------------------------------------------------------------------
  // GİRDİ
  // ---------------------------------------------------------------------------
  function releaseLock() { if (document.pointerLockElement) { mm.expectUnlock = true; document.exitPointerLock(); } }
  function bindInput() {
    const canvas = B.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      if (mm.menu || mm.ui) { e.stopImmediatePropagation(); return; }
      if (!mm.started) return;
      if (mm.co && mm.co.active) {
        const r = canvas.getBoundingClientRect(), v = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        mm.ray.setFromCamera(v, B.camera); const far = mm.ray.far; mm.ray.far = 5;
        const hs = mm.ray.intersectObjects(mm.co.units, true); mm.ray.far = far;
        if (hs.length) { const u = hs[0].object.userData.mmUnit; if (u) scanUnit(u); }
        e.stopImmediatePropagation(); return;
      }
      if (S.decorMode) return;
      if (!isTouch() && S.cameraMode === 1 && document.pointerLockElement !== canvas) { canvas.requestPointerLock(); e.stopImmediatePropagation(); return; }
      if (document.pointerLockElement === canvas) {
        e.stopImmediatePropagation(); doAction();
        clearInterval(mm.holdTimer); mm.holdTimer = setInterval(() => { if (mm.held && mm.target && mm.target.type === 'slot') doAction(); }, 170);
      }
    }, true);
    window.addEventListener('pointerup', () => clearInterval(mm.holdTimer));
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || !mm.started || mm.ui) return;
      const k = 0.0022 * mm.settings.sens;
      B.player.yaw -= e.movementX * k; B.player.pitch = clamp(B.player.pitch - e.movementY * k, -1.2, 1.05);
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) return;
      if (mm.expectUnlock) { mm.expectUnlock = false; return; }
      if (mm.started && !mm.ui && !(mm.co && mm.co.active)) openUI('pause');
    });
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (mm.menu) { e.stopImmediatePropagation(); return; }
      if (!mm.started) return;
      if (code === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (mm.ui === 'report') return;
        if (mm.ui) closeUI(); else if (mm.co && mm.co.active) { exitCheckout(); renderCO(); } else openUI('pause');
        return;
      }
      if (code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); if (mm.ui === 'tablet') closeUI(); else if (!mm.ui) openTablet(); return; }
      if (mm.ui) { e.stopImmediatePropagation(); return; }
      if (mm.co && mm.co.active) {
        e.stopImmediatePropagation();
        const p = mm.co.pay;
        if (p && p.type === 'card') { if (/^Digit\d$|^Numpad\d$/.test(code)) { coClick({ target: { closest: () => ({ dataset: { k: code.slice(-1) } }) } }); return; } if (code === 'Period' || code === 'NumpadDecimal' || code === 'Comma') { coClick({ target: { closest: () => ({ dataset: { k: '.' } }) } }); return; } if (code === 'Backspace') { coClick({ target: { closest: () => ({ dataset: { k: '⌫' } }) } }); return; } }
        if ((code === 'Enter' || code === 'NumpadEnter') && p) { finishPayment(); return; }
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) { exitCheckout(); renderCO(); }
        return;
      }
      if (code === 'KeyE') { e.stopImmediatePropagation(); doAction(); return; }
      if (code === 'KeyG' || code === 'KeyQ') { e.stopImmediatePropagation(); dropHeld(); return; }
      if (code === 'KeyP') { e.stopImmediatePropagation(); openUI('pause'); return; }
      if (code === 'KeyB' && mm.held) { e.stopImmediatePropagation(); return; }
    }, true);

    // DOM düğmeleri
    el('mm-tablet').addEventListener('click', tabletClick);
    el('mm-co').addEventListener('click', coClick);
    el('mm-menu').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      B.sound.init && B.sound.init();
      const a = b.dataset.m;
      if (a === 'continue') { const sv = loadSave(); if (sv) startGame(sv); }
      else if (a === 'new') { if (loadSave()) confirmBox('Mevcut kayıt silinip yeni oyun başlasın mı?', () => { localStorage.removeItem(SAVE_KEY); startGame(null); }); else startGame(null); }
      else if (a === 'help') { el('mm-menu').classList.remove('open'); openUI('help'); }
      else if (a === 'settings') { el('mm-menu').classList.remove('open'); openUI('settings'); renderSettings(); }
      else if (a === 'cast') { if (window.CastEngine && CastEngine.openGallery) CastEngine.openGallery(); }
    });
    el('mm-pause').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; const a = b.dataset.m;
      if (a === 'resume') closeUI();
      else if (a === 'save') { save(); }
      else if (a === 'settings') { openUI('settings'); renderSettings(); }
      else if (a === 'help') openUI('help');
      else if (a === 'endday') { closeUI(); endDayNow(); }
      else if (a === 'menu') confirmBox('Oyun kaydedilip ana menüye dönülsün mü?', () => { save(true); showMainMenu(); });
    });
    el('mm-settings').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.set) { const k = b.dataset.set; mm.settings[k] = k === 'cam' ? +b.dataset.v : b.dataset.v; if (k === 'cam' && mm.started) B.setCameraMode(mm.settings.cam); applySettings(); }
      if (b.dataset.ldel) { ModelCast.local.remove(+b.dataset.ldel).then(refreshLocal); return; }
      if (b.id === 'mm-snd') { const ab = el('btn-audio'); if (ab) ab.click(); setTimeout(renderSettings, 50); }
      if (b.dataset.close) closeUI();
    });
    el('mm-settings').addEventListener('change', async (e) => {
      if (e.target.id !== 'mm-local-file' || !e.target.files.length) return;
      const f = e.target.files[0], nm = (el('mm-local-name') || {}).value || '';
      if (f.size > 60 * 1048576) { toast('Dosya çok büyük (60 MB üstü). Sketchfab\'de 1k dokulu GLB seç.'); return; }
      el('mm-local-list').textContent = 'Model okunuyor…';
      try { const d = await ModelCast.local.add(f, nm); toast(`${d.name} eklendi — ${d.rigged ? 'iskeletli, kol-bacakla yürüyecek' : 'iskeletsiz, gövde salınımıyla yürüyecek'}.`); }
      catch (err) { toast('Eklenemedi: ' + err.message); }
      e.target.value = ''; refreshLocal();
    });
    el('mm-settings').addEventListener('input', (e) => { if (e.target.id === 'mm-sens') { mm.settings.sens = +e.target.value; applySettings(); } });
    el('mm-help').addEventListener('click', (e) => { if (e.target.closest('button[data-close]')) closeUI(); });
    if (window.ModelCast) el('mm-credits').innerHTML = '<b>3D model lisansları</b>' + ModelCast.credits().concat(window.Lounge ? Lounge.credits() : []).map(c => `<div>“${c.title}” — ${c.author} · <a href="${c.url}" target="_blank" rel="noopener">Sketchfab</a> · ${c.license} (oyun için optimize edildi)</div>`).join('');
    el('mm-report').addEventListener('click', (e) => { if (e.target.closest('#mm-next-day')) nextDay(); });
    el('mm-top').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; const a = b.dataset.t;
      if (a === 'tablet') openTablet();
      else if (a === 'manage') { const d = el('main-drawer'); if (d) d.classList.toggle('collapsed'); }
      else if (a === 'cam') { const m = S.cameraMode === 1 ? 2 : 1; mm.settings.cam = m; B.setCameraMode(m); applySettings(); }
      else if (a === 'cast') { if (window.CastEngine && CastEngine.openGallery) CastEngine.openGallery(); }
      else if (a === 'pause') openUI('pause');
    });
    el('mm-act').addEventListener('click', () => doAction());
    el('mm-drop').addEventListener('click', () => dropHeld());
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  }

  // ---------------------------------------------------------------------------
  // HTML + CSS
  // ---------------------------------------------------------------------------
  function injectUI() {
    const css = document.createElement('style');
    css.textContent = `
    body.mm-on .hud-top, body.mm-menu .hud-top, body.mm-on #interact-prompt, body.mm-menu #interact-prompt, body.mm-menu .hud-bottom, body.mm-menu #main-drawer { display:none !important; }
    body.mm-on .hud-bottom .dpad { display:none; }
    @media (pointer:coarse){ body.mm-on .hud-bottom .dpad { display:grid; } }
    body.mm-in-co .hud-bottom { display:none; }
    #toast { z-index:60 !important; }
    .mm-ov { position:fixed; inset:0; z-index:30; display:none; align-items:center; justify-content:center; background:rgba(4,8,14,.62); backdrop-filter:blur(6px); font-family:inherit; color:#f1f5f9; }
    .mm-ov.open { display:flex; }
    .mm-panel { background:rgba(13,20,31,.96); border:1px solid rgba(148,163,184,.22); border-radius:18px; box-shadow:0 30px 80px rgba(0,0,0,.5); padding:22px 24px; width:min(460px,94vw); max-height:92vh; overflow:auto; }
    .mm-panel h2 { font-size:20px; margin-bottom:14px; letter-spacing:.02em; }
    .mm-btn { font:inherit; font-size:13px; font-weight:700; color:#e2e8f0; background:rgba(255,255,255,.06); border:1px solid rgba(148,163,184,.25); border-radius:10px; padding:9px 14px; cursor:pointer; transition:background .15s, transform .1s; }
    .mm-btn:hover:not(:disabled) { background:rgba(255,255,255,.12); }
    .mm-btn:active:not(:disabled) { transform:scale(.97); }
    .mm-btn:disabled { opacity:.4; cursor:not-allowed; }
    .mm-btn.pri { background:#10b981; border-color:#10b981; color:#03140d; }
    .mm-btn.pri:hover:not(:disabled) { background:#34d399; }
    .mm-btn.bad { background:#b91c1c; border-color:#b91c1c; color:#fff; }
    .mm-btn.sm { padding:5px 9px; font-size:11.5px; }
    .mm-btn.wide { width:100%; margin-top:8px; }
    .row { display:flex; align-items:center; gap:8px; justify-content:space-between; }

    /* Ana menü */
    #mm-menu { background:linear-gradient(90deg, rgba(3,7,12,.92) 0%, rgba(3,7,12,.75) 38%, rgba(3,7,12,.15) 70%, rgba(3,7,12,0) 100%); backdrop-filter:none; justify-content:flex-start; }
    .mm-menu-in { margin-left:clamp(20px,7vw,110px); display:flex; flex-direction:column; gap:10px; width:min(360px,86vw); }
    .mm-logo { font-family:Georgia,'Times New Roman',serif; font-size:clamp(40px,7vw,64px); font-weight:700; letter-spacing:.01em; line-height:1; }
    .mm-logo span { color:#10b981; }
    .mm-sub { color:#fcd34d; font-weight:700; letter-spacing:.32em; font-size:12px; margin:4px 0 26px; }
    .mm-mb { text-align:left; font:inherit; font-size:17px; font-weight:700; color:#e2e8f0; background:transparent; border:0; border-left:3px solid transparent; padding:11px 16px; cursor:pointer; border-radius:0 10px 10px 0; transition:all .15s; display:flex; flex-direction:column; }
    .mm-mb small { font-size:11.5px; color:#94a3b8; font-weight:500; margin-top:2px; }
    .mm-mb:hover { background:linear-gradient(90deg, rgba(16,185,129,.22), rgba(16,185,129,0)); border-left-color:#10b981; padding-left:22px; }
    .mm-mb.hero { background:linear-gradient(90deg, rgba(16,185,129,.3), rgba(16,185,129,0)); border-left-color:#10b981; }
    .mm-ver { position:fixed; left:clamp(20px,7vw,110px); bottom:18px; color:#64748b; font-size:11px; }

    /* HUD */
    #mm-top { position:fixed; top:10px; left:10px; right:10px; z-index:12; display:none; justify-content:space-between; align-items:flex-start; gap:8px; pointer-events:none; }
    body.mm-on #mm-top { display:flex; }
    .mm-grp { display:flex; align-items:center; gap:10px; background:rgba(10,15,22,.82); backdrop-filter:blur(10px); border:1px solid rgba(148,163,184,.2); border-radius:14px; padding:7px 12px; pointer-events:auto; }
    .mm-cash { font-size:18px; font-weight:800; color:#34d399; font-variant-numeric:tabular-nums; }
    .mm-lv { display:flex; align-items:center; gap:7px; }
    .mm-lv i { font-style:normal; width:28px; height:28px; border-radius:50%; background:#f59e0b; color:#1c1105; font-weight:900; display:grid; place-items:center; font-size:13px; }
    .mm-xpb { width:92px; height:6px; border-radius:4px; background:rgba(255,255,255,.12); overflow:hidden; }
    .mm-xpb div { height:100%; background:linear-gradient(90deg,#f59e0b,#fde047); width:0; transition:width .3s; }
    .mm-lv small { display:block; font-size:9.5px; color:#94a3b8; margin-top:2px; }
    .mm-rep { color:#fcd34d; font-weight:700; font-size:13px; }
    .mm-clock { font-weight:700; font-size:13px; font-variant-numeric:tabular-nums; }
    .mm-store { font-size:11px; font-weight:900; letter-spacing:.08em; padding:4px 9px; border-radius:7px; }
    .mm-store.on { background:#065f46; color:#a7f3d0; } .mm-store.off { background:#7f1d1d; color:#fecaca; }
    .mm-tb { font:inherit; font-size:12px; font-weight:700; color:#e2e8f0; background:rgba(255,255,255,.06); border:1px solid rgba(148,163,184,.22); border-radius:9px; padding:6px 10px; cursor:pointer; }
    .mm-tb:hover { background:rgba(255,255,255,.14); }
    .mm-tb.pri { background:#10b981; color:#03140d; border-color:#10b981; }
    #mm-goal { position:fixed; right:10px; top:62px; z-index:11; display:none; width:min(300px,60vw); background:rgba(10,15,22,.8); backdrop-filter:blur(10px); border:1px solid rgba(148,163,184,.2); border-left:3px solid #f59e0b; border-radius:12px; padding:9px 12px; }
    body.mm-on #mm-goal { display:block; }
    #mm-goal small { color:#fcd34d; font-weight:800; font-size:10px; letter-spacing:.12em; }
    #mm-goal div { font-size:12.5px; margin-top:3px; line-height:1.35; }
    #mm-alert { position:fixed; left:50%; top:62px; transform:translateX(-50%); z-index:11; display:none; background:#b91c1c; color:#fff; font-weight:800; font-size:13px; padding:7px 14px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.35); animation:mmPulse 1.4s infinite; }
    #mm-alert.info { background:rgba(10,15,22,.85); color:#fde68a; animation:none; border:1px solid rgba(250,204,21,.4); }
    body.mm-on #mm-alert.show { display:block; }
    @keyframes mmPulse { 50% { transform:translateX(-50%) scale(1.04); } }
    #mm-cross { position:fixed; left:50%; top:50%; width:8px; height:8px; margin:-4px 0 0 -4px; border-radius:50%; background:rgba(255,255,255,.85); box-shadow:0 0 0 2px rgba(0,0,0,.35); z-index:11; display:none; pointer-events:none; transition:transform .1s, background .1s; }
    #mm-cross.hot { background:#34d399; transform:scale(1.6); }
    body.mm-on #mm-cross { display:block; } body.mm-in-co #mm-cross, body.mm-in-co #mm-target { display:none !important; }
    #mm-target { position:fixed; left:50%; top:calc(50% + 22px); transform:translateX(-50%); z-index:11; font-size:13px; font-weight:700; background:rgba(10,15,22,.78); padding:5px 11px; border-radius:8px; display:none; white-space:nowrap; pointer-events:none; }
    #mm-target.show { display:block; } #mm-target.no { color:#fca5a5; }
    #mm-hint { position:fixed; left:50%; bottom:14px; transform:translateX(-50%); z-index:11; display:none; gap:14px; font-size:12px; color:#cbd5e1; background:rgba(10,15,22,.7); padding:7px 14px; border-radius:10px; }
    body.mm-on #mm-hint { display:flex; }
    @media (pointer:coarse){ body.mm-on #mm-hint { display:none; } }
    kbd { font:inherit; font-weight:800; background:rgba(255,255,255,.14); border-radius:5px; padding:1px 6px; margin-right:4px; color:#fff; }
    #mm-touch { position:fixed; right:14px; bottom:18px; z-index:12; display:none; flex-direction:column; gap:10px; align-items:flex-end; }
    @media (pointer:coarse){ body.mm-on #mm-touch { display:flex; } body.mm-in-co #mm-touch { display:none; } }
    #mm-touch button { font:inherit; font-weight:800; font-size:14px; color:#03140d; background:#10b981; border:0; border-radius:50%; width:78px; height:78px; box-shadow:0 8px 24px rgba(0,0,0,.4); }
    #mm-touch #mm-drop { background:#f59e0b; width:58px; height:58px; font-size:12px; }
    #mm-banner { position:fixed; left:50%; top:28%; transform:translate(-50%,-10px); z-index:25; text-align:center; opacity:0; pointer-events:none; transition:all .35s; }
    #mm-banner.show { opacity:1; transform:translate(-50%,0); }
    #mm-banner b { display:block; font-family:Georgia,serif; font-size:clamp(30px,6vw,52px); color:#fde047; text-shadow:0 4px 24px rgba(0,0,0,.6); }
    #mm-banner span { display:inline-block; margin-top:6px; font-size:14px; background:rgba(10,15,22,.8); padding:6px 14px; border-radius:10px; }

    /* Tablet */
    #mm-tablet .tab { width:min(980px,96vw); height:min(640px,92vh); background:#0b1220; border:10px solid #111827; border-radius:26px; box-shadow:0 40px 90px rgba(0,0,0,.6); display:grid; grid-template-rows:42px 1fr; overflow:hidden; }
    .tab-bar { display:flex; align-items:center; justify-content:space-between; padding:0 14px; background:linear-gradient(90deg,#064e3b,#0f172a); font-weight:800; font-size:13px; }
    .tab-bar span { color:#a7f3d0; } .tab-bar b { color:#34d399; margin-left:10px; }
    .tab-in { display:grid; grid-template-columns:168px 1fr; min-height:0; }
    .mm-nav { background:#0f172a; padding:10px 8px; display:flex; flex-direction:column; gap:4px; border-right:1px solid rgba(148,163,184,.12); }
    .mm-nav button { font:inherit; text-align:left; font-size:13px; font-weight:700; color:#cbd5e1; background:transparent; border:0; border-radius:9px; padding:10px 12px; cursor:pointer; }
    .mm-nav button.on { background:#10b981; color:#03140d; } .mm-nav button:hover:not(.on) { background:rgba(255,255,255,.07); }
    #mm-tab-body { padding:16px 18px; overflow:auto; min-height:0; }
    .mm-app-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
    .mm-app-head h3 { font-size:19px; } .mm-app-head span { font-size:12px; color:#94a3b8; }
    .mm-prod-list { display:flex; flex-direction:column; gap:8px; }
    .mm-prod { display:grid; grid-template-columns:10px 1fr auto auto; gap:12px; align-items:center; background:rgba(255,255,255,.04); border:1px solid rgba(148,163,184,.14); border-radius:12px; padding:10px 12px; }
    .mm-prod .sw { width:10px; height:44px; border-radius:4px; }
    .mm-prod .info b { font-size:14px; } .mm-prod small { display:block; font-size:11px; color:#94a3b8; margin-top:2px; } .mm-prod small b { color:#e2e8f0; }
    .mm-prod .pr { text-align:right; } .mm-prod .pr b { font-size:16px; color:#fde68a; }
    .qty { display:flex; align-items:center; gap:6px; } .qty button { font:inherit; width:32px; height:32px; border-radius:9px; border:1px solid rgba(148,163,184,.3); background:rgba(255,255,255,.06); color:#fff; font-size:17px; font-weight:800; cursor:pointer; }
    .qty span { min-width:22px; text-align:center; font-weight:800; font-size:15px; }
    .mm-cart { position:sticky; bottom:-16px; margin:14px -18px -16px; padding:12px 18px; background:#0f172a; border-top:1px solid rgba(148,163,184,.16); display:flex; align-items:center; gap:14px; }
    .mm-cart .tot { margin-left:auto; font-size:20px; color:#34d399; }
    .mm-table { width:100%; border-collapse:collapse; font-size:13px; }
    .mm-table td, .mm-table th { padding:8px 6px; border-bottom:1px solid rgba(148,163,184,.12); text-align:left; }
    .mm-table th { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; }
    .mm-table td:last-child { text-align:right; }
    .mm-table .tot td { font-weight:900; font-size:15px; border-top:2px solid rgba(148,163,184,.3); }
    .mm-table tr.focus { background:rgba(16,185,129,.12); }
    .neg { color:#f87171; } .pos { color:#34d399; }
    .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:7px; vertical-align:middle; }
    .pset { white-space:nowrap; } .pset b { display:inline-block; min-width:62px; text-align:center; font-size:14px; color:#fde68a; }
    .pset button { font:inherit; font-size:11px; font-weight:700; color:#e2e8f0; background:rgba(255,255,255,.06); border:1px solid rgba(148,163,184,.22); border-radius:7px; padding:4px 6px; cursor:pointer; margin:0 1px; }
    .tag { display:inline-block; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px; background:rgba(148,163,184,.18); color:#cbd5e1; }
    .tag.ok { background:rgba(16,185,129,.2); color:#6ee7b7; } .tag.warn { background:rgba(245,158,11,.2); color:#fcd34d; } .tag.bad { background:rgba(239,68,68,.2); color:#fca5a5; }
    .mm-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; }
    .mm-card { background:rgba(255,255,255,.04); border:1px solid rgba(148,163,184,.16); border-radius:14px; padding:13px; display:flex; flex-direction:column; gap:6px; }
    .mm-card .sw { height:8px; border-radius:4px; } .mm-card b { font-size:14px; } .mm-card small { color:#94a3b8; font-size:11.5px; line-height:1.4; }
    .mm-card.lock { opacity:.55; } .mm-card.own { border-color:rgba(16,185,129,.45); }
    .mm-rep-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:14px; }
    .mm-kpi { background:rgba(255,255,255,.05); border-radius:12px; padding:11px; } .mm-kpi b { display:block; font-size:19px; } .mm-kpi span { font-size:11px; color:#94a3b8; }
    .mm-kpi.ok b { color:#34d399; } .mm-kpi.bad b { color:#f87171; }
    .mm-reviews div { font-size:12.5px; color:#fcd34d; padding:5px 0; } .mm-reviews span { color:#cbd5e1; margin-left:6px; }
    .mm-rep-foot { margin-top:12px; font-size:12px; color:#94a3b8; line-height:1.6; }
    #mm-report .mm-panel { width:min(560px,94vw); }

    /* Ayarlar */
    #mm-settings-body label { display:block; font-size:12px; color:#94a3b8; font-weight:700; margin:12px 0 6px; text-transform:uppercase; letter-spacing:.06em; }
    #mm-settings-body .hint { font-size:11.5px; color:#64748b; margin-top:5px; }
    .mm-segs { display:flex; gap:6px; flex-wrap:wrap; }
    .mm-seg { font:inherit; font-size:12.5px; font-weight:700; color:#cbd5e1; background:rgba(255,255,255,.05); border:1px solid rgba(148,163,184,.22); border-radius:9px; padding:8px 12px; cursor:pointer; }
    .mm-seg.on { background:#10b981; color:#03140d; border-color:#10b981; }
    #mm-sens { width:100%; accent-color:#10b981; }
    .mm-local { display:flex; flex-direction:column; gap:6px; font-size:13px; } .mm-local small { color:#94a3b8; margin-left:6px; }
    .mm-local-add { display:flex; gap:8px; margin-top:8px; } .mm-local-add input { flex:1; min-width:0; font:inherit; font-size:13px; color:#fff; background:rgba(255,255,255,.06); border:1px solid rgba(148,163,184,.25); border-radius:9px; padding:7px 10px; }
    #mm-settings-body .mm-local-add label { cursor:pointer; display:inline-flex; align-items:center; margin:0; text-transform:none; letter-spacing:0; color:#03140d; font-size:12.5px; }
    .mm-help-list { display:flex; flex-direction:column; gap:9px; font-size:13px; line-height:1.45; color:#cbd5e1; }
    .mm-help-list b { color:#fff; } .mm-help-list .n { display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:#10b981; color:#03140d; font-weight:900; font-size:12px; margin-right:8px; }
    .mm-keys { display:grid; grid-template-columns:auto 1fr; gap:6px 12px; font-size:12.5px; margin-top:14px; color:#cbd5e1; }
    .mm-credits { margin-top:16px; font-size:11.5px; color:#94a3b8; line-height:1.6; } .mm-credits b { color:#cbd5e1; display:block; margin-bottom:2px; } .mm-credits a { color:#6ee7b7; }
    .mm-pause-list { display:flex; flex-direction:column; gap:8px; }
    .mm-pause-list .mm-btn { font-size:15px; padding:12px; text-align:left; }

    /* Kasa */
    #mm-co { position:fixed; inset:0; z-index:14; display:none; pointer-events:none; }
    #mm-co.open { display:block; }
    #mm-co .pos { pointer-events:auto; position:absolute; right:14px; top:14px; bottom:14px; width:min(330px,40vw); background:rgba(8,13,22,.94); border:1px solid rgba(148,163,184,.22); border-radius:16px; display:flex; flex-direction:column; overflow:hidden; }
    #mm-co .pos-h { padding:11px 14px; background:linear-gradient(90deg,#064e3b,#0f172a); display:flex; justify-content:space-between; font-weight:800; font-size:12.5px; }
    #mm-co-cust { padding:11px 14px; border-bottom:1px solid rgba(148,163,184,.14); } #mm-co-cust b { font-size:15px; display:block; } #mm-co-cust small { color:#94a3b8; font-size:12px; }
    #mm-co-list { flex:1; overflow:auto; padding:8px 14px; font-family:ui-monospace,Menlo,monospace; font-size:12.5px; }
    #mm-co-list .ln { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed rgba(148,163,184,.18); } #mm-co-list .empty { color:#64748b; padding:10px 0; }
    .pos-tot { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-top:1px solid rgba(148,163,184,.2); font-weight:900; } .pos-tot b { font-size:22px; color:#34d399; }
    #mm-co-pay { padding:0 14px 12px; } .ph-t { font-size:13px; font-weight:700; margin:8px 0; }
    .term { background:#111827; border-radius:12px; padding:10px; } .term .scr { background:#a7f3d0; color:#052e1d; font-family:ui-monospace,monospace; font-weight:900; font-size:22px; text-align:right; padding:8px 10px; border-radius:8px; margin-bottom:8px; }
    .term .keys { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; } .term .keys button { font:inherit; font-size:17px; font-weight:800; padding:10px 0; border-radius:9px; border:0; background:#1f2937; color:#fff; cursor:pointer; } .term .keys button:active { background:#374151; }
    .chg { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; } .chg div { background:rgba(255,255,255,.05); border-radius:10px; padding:8px; } .chg small { display:block; font-size:10.5px; color:#94a3b8; } .chg b { font-size:18px; }
    .mm-drawer { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; margin-bottom:8px; }
    .mm-drawer button { font:inherit; font-weight:800; font-size:12px; cursor:pointer; border:0; }
    .mm-drawer .note { border-radius:6px; padding:10px 0; background:linear-gradient(180deg,#86efac,#4ade80); color:#14532d; }
    .mm-drawer .coin { border-radius:50%; aspect-ratio:1; background:radial-gradient(circle at 35% 30%,#fef3c7,#d4a347); color:#422006; }
    #mm-co-id { pointer-events:auto; position:absolute; left:14px; top:14px; width:min(330px,40vw); display:none; background:rgba(8,13,22,.94); border:1px solid rgba(148,163,184,.22); border-radius:16px; padding:12px; }
    #mm-co-id.show { display:block; }
    .idc { background:linear-gradient(135deg,#e0f2fe,#fdf2f8); color:#0f172a; border-radius:12px; padding:10px; } .idh { font-size:9px; font-weight:900; letter-spacing:.08em; color:#1e3a8a; margin-bottom:8px; }
    .idr { display:flex; gap:10px; } .idr .ph { width:64px; height:80px; border-radius:8px; display:grid; place-items:center; font-size:30px; font-weight:900; color:#fff; flex:none; }
    .idr small { display:block; font-size:9px; color:#475569; text-transform:uppercase; } .idr b { display:block; font-size:13px; margin-bottom:3px; } .idr .dob { font-size:16px; color:#b91c1c; }
    .idq { font-size:12px; color:#cbd5e1; margin:10px 0; line-height:1.45; }
    #mm-co-exit { pointer-events:auto; position:absolute; left:14px; bottom:14px; }
    body.mm-in-co #mm-goal, body.mm-in-co #mm-alert, body.mm-in-co #mm-top { display:none !important; }
    @media (max-width:960px) { #mm-co .pos { width:30vw; font-size:12px; } #mm-co-id { width:30vw; padding:8px; } .idr .ph { width:44px; height:56px; font-size:22px; } .term .keys button { padding:7px 0; font-size:15px; } .mm-drawer .note { padding:7px 0; } #mm-co-list { font-size:11px; } }
    @media (max-width:760px) { .mm-rep-grid { grid-template-columns:repeat(2,1fr); } .tab-in { grid-template-columns:1fr; grid-template-rows:auto 1fr; } .mm-nav { flex-direction:row; overflow-x:auto; } .mm-nav button { white-space:nowrap; } .mm-prod { grid-template-columns:8px 1fr auto; } .mm-prod .pr { display:none; } }
    `;
    document.head.appendChild(css);
    const h = document.createElement('div');
    h.innerHTML = `
    <div id="mm-top">
      <div class="mm-grp"><span class="mm-cash" id="mm-cash">€0</span>
        <div class="mm-lv"><i id="mm-lv">1</i><div><div class="mm-xpb"><div id="mm-xp"></div></div><small id="mm-xp-t">0 XP</small></div></div>
        <span class="mm-rep">★ <span id="mm-rep">50</span></span><span class="mm-clock" id="mm-clock">Gün 1 · 08:00</span><span class="mm-store off" id="mm-store">KAPALI</span></div>
      <div class="mm-grp"><button class="mm-tb pri" data-t="tablet">Tablet <kbd>Tab</kbd></button><button class="mm-tb" data-t="manage">Yönetim</button><button class="mm-tb" data-t="cam">Kamera</button><button class="mm-tb" data-t="cast">Karakterler</button><button class="mm-tb" data-t="pause">☰</button></div>
    </div>
    <div id="mm-goal"><small id="mm-goal-n">EĞİTİM</small><div id="mm-goal-t"></div></div>
    <div id="mm-alert"></div><div id="mm-cross"></div><div id="mm-target"></div><div id="mm-hint"></div>
    <div id="mm-touch"><button id="mm-drop">Bırak</button><button id="mm-act">Etkileşim</button></div>
    <div id="mm-banner"><b></b><span></span></div>

    <div class="mm-ov open" id="mm-menu"><div class="mm-menu-in">
      <div class="mm-logo">AMSTERDAM<span>.</span></div><div class="mm-sub">COFFEESHOP İMPARATORLUĞU</div>
      <button class="mm-mb hero" data-m="continue" id="mm-continue">Devam et<small></small></button>
      <button class="mm-mb" data-m="new">Yeni oyun<small>Jordaan'da küçük bir dükkânla başla</small></button>
      <button class="mm-mb" data-m="help">Nasıl oynanır</button>
      <button class="mm-mb" data-m="settings">Ayarlar</button>
      <button class="mm-mb" data-m="cast">Karakterler<small>39 karakter · 14 model</small></button>
    </div><div class="mm-ver">BABA. Oyunlar · Market modu v1</div></div>

    <div class="mm-ov" id="mm-pause"><div class="mm-panel"><h2>Duraklatıldı</h2><div class="mm-pause-list">
      <button class="mm-btn pri" data-m="resume">Devam et</button><button class="mm-btn" data-m="save">Kaydet</button>
      <button class="mm-btn" data-m="endday">Günü bitir (mağaza kapalıyken)</button>
      <button class="mm-btn" data-m="settings">Ayarlar</button><button class="mm-btn" data-m="help">Nasıl oynanır</button>
      <button class="mm-btn" data-m="menu">Ana menü</button></div></div></div>

    <div class="mm-ov" id="mm-settings"><div class="mm-panel"><div class="row"><h2>Ayarlar</h2><button class="mm-btn sm" data-close="1">Kapat</button></div><div id="mm-settings-body"></div></div></div>

    <div class="mm-ov" id="mm-help"><div class="mm-panel" style="width:min(560px,94vw)"><div class="row"><h2>Nasıl oynanır</h2><button class="mm-btn sm" data-close="1">Kapat</button></div>
      <div class="mm-help-list">
        <div><span class="n">1</span><b>Sipariş ver:</b> Tablet'i aç (Tab ya da tezgâhtaki bilgisayar). Toptancı'dan kutu al; kargo kapının solundaki sarı alana gelir.</div>
        <div><span class="n">2</span><b>Rafları doldur:</b> Kutuya bak, E/tık ile al. Sağ duvardaki vitrin rafında bir bölmeye bakıp tıkla — her tıkta bir ürün dizilir. Boş kutuyu çöpe at.</div>
        <div><span class="n">3</span><b>Fiyat belirle:</b> Tablet → Fiyatlar. Piyasa fiyatının çok üstündeki ürünleri müşteriler rafta bırakır.</div>
        <div><span class="n">4</span><b>Mağazayı aç:</b> Kapının yanındaki AÇIK/KAPALI tabelasına bak ve tıkla.</div>
        <div><span class="n">5</span><b>Kasaya geç:</b> Müşteriler raftan alıp sıraya girer. Tezgâhtaki ürünlere tıklayıp okut; botanik ürünlerde kimlikteki doğum tarihini kontrol et (18+). Kartta tutarı terminale gir, nakitte doğru para üstünü ver.</div>
        <div><span class="n">6</span><b>Büyü:</b> Satışlar XP kazandırır. Seviye atladıkça yeni ürün lisansları, personel ve yükseltmeler açılır. 22:00'de mağaza kapanır, gün sonu raporu gelir.</div>
      </div>
      <div class="mm-keys"><kbd>WASD</kbd><span>Yürü</span><kbd>Fare</kbd><span>Etrafa bak (ekrana tıklayınca kilitlenir)</span><kbd>Tık / E</kbd><span>Etkileşim · al · diz · okut</span><kbd>G</kbd><span>Elindeki kutuyu bırak</span><kbd>Tab</kbd><span>Tablet</span><kbd>Esc</kbd><span>Duraklat / kasadan çık</span><kbd>K</kbd><span>Karakter galerisi</span></div>
      <div class="mm-credits" id="mm-credits"></div>
    </div></div>

    <div class="mm-ov" id="mm-report"><div class="mm-panel"><h2>Gün sonu raporu</h2><div id="mm-report-body"></div><button class="mm-btn pri wide" id="mm-next-day" style="margin-top:14px">Sonraki gün →</button></div></div>
    <div class="mm-ov" id="mm-confirm"><div class="mm-panel"><p id="mm-confirm-text" style="margin-bottom:16px;font-size:14px"></p><div class="row"><button class="mm-btn" id="mm-confirm-no">Vazgeç</button><button class="mm-btn pri" id="mm-confirm-yes">Evet</button></div></div></div>

    <div class="mm-ov" id="mm-tablet"><div class="tab"><div class="tab-bar"><span>GrachtOS · Mağaza Yönetimi</span><div><b id="mm-tab-cash">€0</b> <button class="mm-btn sm" id="mm-tab-close" style="margin-left:10px">Kapat ✕</button></div></div>
      <div class="tab-in"><div class="mm-nav"><button data-app="order">📦 Toptancı</button><button data-app="prices">🏷️ Fiyatlar</button><button data-app="licenses">📜 Lisanslar</button><button data-app="staff">👥 Personel</button><button data-app="upgrades">🛠️ Yükseltmeler</button><button data-app="report">📊 Rapor</button></div>
      <div id="mm-tab-body"></div></div></div></div>

    <div id="mm-co"><div id="mm-co-id"></div>
      <div class="pos"><div class="pos-h"><span>KASA · Chill &amp; Brew</span><span id="mm-co-date"></span></div><div id="mm-co-cust"></div><div id="mm-co-list"></div>
      <div class="pos-tot"><span>TOPLAM</span><b id="mm-co-total">€0.00</b></div><div id="mm-co-pay"></div></div>
      <button class="mm-btn" id="mm-co-exit">Kasadan çık (Esc)</button></div>`;
    while (h.firstElementChild) document.body.appendChild(h.firstElementChild);
    document.body.classList.add('mm-menu');
  }
})();
