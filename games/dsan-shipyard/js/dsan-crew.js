/* DSAn — 3D çalışanlar: düşük poligonlu karakterler, lacivert iş kıyafeti, reflektör şeritli turuncu yelek,
   role uygun baret/KKD ve aksesuar; işe göre yürüme ve çalışma animasyonları. Kadrodaki gerçek çalışanları izler. */
(function () {
  'use strict';
  const DSAN = window.DSAN = window.DSAN || {};
  const U = () => DSAN.util;
  let scene = null, halls = [], figures = new Map(), sig = '';
  const M = {}; // ortak malzemeler
  const G = {}; // ortak geometriler
  function mats() {
    if (M.navy) return;
    const s = (c, r, m, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m || 0 }, o || {}));
    Object.assign(M, { navy: s('#1b2a4a', .85), vest: s('#f37021', .7), strip: s('#e5e7eb', .35, .2, { emissive: '#cbd5e1', emissiveIntensity: 0 }), skin: s('#c99a78', .8), skin2: s('#8d5f45', .8),
      boot: s('#15171a', .9), dark: s('#0b1220', .2, .6), grey: s('#9ca3af', .5, .5), tablet: s('#111827', .3, .4, { emissive: '#38bdf8', emissiveIntensity: .35 }), paper: s('#f8fafc', .8), bag: s('#7c2d12', .8), cap: s('#0f172a', .8) });
    Object.assign(G, { leg: new THREE.BoxGeometry(.12, .42, .14), torso: new THREE.BoxGeometry(.34, .4, .2), vest: new THREE.BoxGeometry(.36, .3, .22), strip: new THREE.BoxGeometry(.365, .035, .225),
      arm: new THREE.BoxGeometry(.09, .38, .1), head: new THREE.SphereGeometry(.105, 8, 6), helmet: new THREE.SphereGeometry(.125, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), brim: new THREE.CylinderGeometry(.15, .15, .02, 10),
      boot: new THREE.BoxGeometry(.13, .07, .2), hand: new THREE.BoxGeometry(.07, .07, .07), mask: new THREE.BoxGeometry(.2, .16, .04), tab: new THREE.BoxGeometry(.18, .13, .015), bagG: new THREE.BoxGeometry(.24, .16, .1), bar: new THREE.BoxGeometry(.03, .26, .03), muff: new THREE.CylinderGeometry(.045, .045, .04, 8), resp: new THREE.CylinderGeometry(.04, .05, .06, 8), radio: new THREE.BoxGeometry(.05, .1, .03), capG: new THREE.CylinderGeometry(.11, .115, .07, 10), spark: new THREE.SphereGeometry(.04, 6, 4) });
  }
  const helmetMats = {};
  function helmetMat(c) { return helmetMats[c] || (helmetMats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .35, metalness: .05 })); }
  function mesh(g, m, x, y, z, parent) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; }

  function makeFigure(w) {
    mats();
    const R = (DSAN.hr && DSAN.hr.ROLES[w.role]) || { ppe: '#facc15', acc: '', anim: 'walk', site: 'yard' };
    const rnd = U().rng(w.id), root = new THREE.Group();
    const skin = rnd() > .6 ? M.skin2 : M.skin;
    const hipL = new THREE.Group(), hipR = new THREE.Group(); hipL.position.set(-.07, .5, 0); hipR.position.set(.07, .5, 0); root.add(hipL, hipR);
    mesh(G.leg, M.navy, 0, -.21, 0, hipL); mesh(G.leg, M.navy, 0, -.21, 0, hipR);
    mesh(G.boot, M.boot, 0, -.44, .03, hipL); mesh(G.boot, M.boot, 0, -.44, .03, hipR);
    const body = new THREE.Group(); body.position.y = .5; root.add(body);
    mesh(G.torso, M.navy, 0, .2, 0, body);
    if (R.ppe !== null || R.site === 'yard') { mesh(G.vest, M.vest, 0, .23, 0, body); mesh(G.strip, M.strip, 0, .17, 0, body); mesh(G.strip, M.strip, 0, .27, 0, body); }
    const shL = new THREE.Group(), shR = new THREE.Group(); shL.position.set(-.22, .38, 0); shR.position.set(.22, .38, 0); body.add(shL, shR);
    mesh(G.arm, M.navy, 0, -.18, 0, shL); mesh(G.arm, M.navy, 0, -.18, 0, shR);
    mesh(G.hand, skin, 0, -.39, 0, shL); const handR = mesh(G.hand, skin, 0, -.39, 0, shR);
    const head = new THREE.Group(); head.position.y = .52; body.add(head);
    mesh(G.head, skin, 0, 0, 0, head);
    if (R.ppe) { mesh(G.helmet, helmetMat(R.ppe), 0, .03, 0, head); mesh(G.brim, helmetMat(R.ppe), 0, .035, .02, head); }
    else if (R.acc === 'cap') mesh(G.capG, M.cap, 0, .07, 0, head);
    let spark = null, maskM = null;
    switch (R.acc) {
      case 'mask': maskM = mesh(G.mask, M.dark, 0, .02, .12, head); mesh(G.muff, M.dark, -.12, .02, 0, head).rotation.z = Math.PI / 2; mesh(G.muff, M.dark, .12, .02, 0, head).rotation.z = Math.PI / 2;
        spark = new THREE.Mesh(G.spark, new THREE.MeshBasicMaterial({ color: '#fde68a' })); spark.position.set(0, -.5, .12); shR.add(spark); break;
      case 'tablet': mesh(G.tab, M.tablet, 0, -.36, .09, shR).rotation.x = -.9; break;
      case 'clipboard': mesh(G.tab, M.paper, 0, -.36, .09, shR).rotation.x = -.9; break;
      case 'toolbag': mesh(G.bagG, M.bag, 0, -.46, 0, shL); break;
      case 'wrench': mesh(G.bar, M.grey, 0, -.5, .05, shR); break;
      case 'respirator': mesh(G.resp, M.dark, 0, -.04, .1, head).rotation.x = Math.PI / 2; break;
      case 'radio': mesh(G.radio, M.dark, .1, .3, .12, body); break;
    }
    root.scale.setScalar(1.05);
    root.userData = { w, R, hipL, hipR, shL, shR, body, head, handR, spark, maskM, mode: 'walk', target: null, timer: 0, phase: rnd() * 6, speed: .9 + rnd() * .5 };
    return root;
  }

  function hallFor(dockId) { return halls.find(h => h.id === dockId); }
  function pickTarget(f, st) {
    const w = f.userData.w, R = f.userData.R, h = hallFor(w.assignedDock);
    const dock = st.docks.find(d => d.id === w.assignedDock);
    if (h && dock && dock.unlocked) {
      const busy = !!dock.activeBuild, side = Math.random() < .5 ? -1 : 1;
      if (busy && R.site !== 'office') { // teknenin yanında çalış
        return { x: h.x + side * (3.2 + Math.random() * 2.2), z: h.z + (Math.random() - .5) * h.d * .6, work: true };
      }
      return { x: h.x + (Math.random() - .5) * (h.w - 4), z: h.z + (Math.random() - .5) * (h.d - 4), work: Math.random() < .3 };
    }
    // ofis / genel: ofis ile rıhtım arasında, şoför araç yanında
    if (w.role === 'driver') return { x: 64 + Math.random() * 3, z: -19.5 + Math.random() * 2, work: true };
    const spots = [[72 + Math.random() * 8, -24], [50 + Math.random() * 20, 30], [-20 + Math.random() * 40, 32], [60, -14]];
    const s = spots[Math.floor(Math.random() * spots.length)]; return { x: s[0], z: s[1], work: Math.random() < .5 };
  }

  DSAN.crew = {
    init(sc, hallLayout) { scene = sc; halls = hallLayout || []; },
    sync(st, max) {
      if (!scene) return;
      const list = st.workers.slice(0, max || 18);
      const s = list.map(w => w.id + ':' + w.role + ':' + w.assignedDock).join('|');
      if (s === sig) return; sig = s;
      const keep = new Set(list.map(w => w.id));
      figures.forEach((f, id) => { if (!keep.has(id)) { scene.remove(f); figures.delete(id); } });
      list.forEach((w, i) => {
        let f = figures.get(w.id);
        if (f && f.userData.R !== (DSAN.hr.ROLES[w.role])) { scene.remove(f); figures.delete(w.id); f = null; }
        if (!f) { f = makeFigure(w); const t = pickTarget(f, st); f.position.set(t.x + (Math.random() - .5) * 3, 1.6, t.z + (Math.random() - .5) * 3); scene.add(f); figures.set(w.id, f); }
        f.userData.w = w; f.userData.target = null; void i;
      });
    },
    count: () => figures.size,
    update(t, dt, st, night) {
      if (!scene) return;
      if (M.strip) M.strip.emissiveIntensity = (night || 0) * .9; // reflektör şeritler gece parlar
      const gs = st.speed === 0 ? .35 : Math.min(2, .8 + st.speed * .3);
      figures.forEach(f => {
        const u = f.userData;
        if (!u.target) { u.target = pickTarget(f, st); u.mode = 'walk'; }
        const dx = u.target.x - f.position.x, dz = u.target.z - f.position.z, d = Math.hypot(dx, dz);
        const ph = t * 7 * u.speed + u.phase;
        if (u.mode === 'walk') {
          if (d < .25) { u.mode = u.target.work ? 'work' : 'idle'; u.timer = (u.target.work ? 6 : 2) + Math.random() * 6; }
          else { const step = Math.min(d, dt * 1.25 * u.speed * gs); f.position.x += dx / d * step; f.position.z += dz / d * step; f.rotation.y = Math.atan2(dx, dz);
            const sw = Math.sin(ph) * .55; u.hipL.rotation.x = sw; u.hipR.rotation.x = -sw; u.shL.rotation.x = -sw * .8; u.shR.rotation.x = sw * .8; u.body.position.y = .5 + Math.abs(Math.cos(ph)) * .025; u.body.rotation.x = 0;
            if (u.spark) u.spark.visible = false; if (u.maskM) u.maskM.rotation.x = -1.2; }
        } else {
          u.timer -= dt * gs;
          u.hipL.rotation.x *= .85; u.hipR.rotation.x *= .85;
          const anim = u.mode === 'idle' ? 'idle' : u.R.anim;
          if (anim === 'weld') { u.body.position.y = .38; u.hipL.rotation.x = -1.1; u.hipR.rotation.x = -.4; u.body.rotation.x = .35; u.shR.rotation.x = -1.2 + Math.sin(t * 3) * .05; u.shL.rotation.x = -.6; if (u.maskM) u.maskM.rotation.x = 0; if (u.spark) { u.spark.visible = Math.random() > .35; u.spark.scale.setScalar(.6 + Math.random() * 1.4); } }
          else if (anim === 'work') { u.body.position.y = .5; u.body.rotation.x = .2; u.shR.rotation.x = -1.3 + Math.sin(t * 9 + u.phase) * .55; u.shL.rotation.x = -.9 + Math.sin(t * 9 + u.phase + 1) * .3; }
          else if (anim === 'inspect') { u.body.position.y = .5; u.body.rotation.x = .05; u.shR.rotation.x = -1.0; u.shL.rotation.x = -.3; u.head.rotation.y = Math.sin(t * .8 + u.phase) * .6; u.head.rotation.x = .25; }
          else { u.body.position.y = .5 + Math.sin(t * 1.6 + u.phase) * .006; u.body.rotation.x = 0; u.shR.rotation.x *= .9; u.shL.rotation.x *= .9; u.head.rotation.y = Math.sin(t * .5 + u.phase) * .4; }
          if (u.timer <= 0) { u.target = null; u.head.rotation.set(0, 0, 0); u.body.rotation.x = 0; if (u.spark) u.spark.visible = false; }
        }
      });
    }
  };
})();
