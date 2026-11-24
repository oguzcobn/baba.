/* =============================================================================
   AMSTERDAM. — MODEL CAST (Sketchfab GLB karakterleri)
   Kullanıcının yüklediği CC-BY / CC-BY-SA modelleri oyuna müşteri olarak ekler.
   • İskeletli modeller (Otter-Chan): bacak/kol kemikleri, modele göre eksen
     bağımsız döndürülerek prosedürel yürütülür (CastEngine ile aynı Froude
     temelli adım frekansı).
   • İskeletsiz modeller (Man in Suit, Viking): gövde salınımı + adım zıplaması.
   • Ürün modeli (Weed Nug): vitrin rafı ve kasa ürünleri için.
   Her modelin yazarı, lisansı ve kaynağı CREDITS'te ve oyunda gösterilir.
   ============================================================================= */
(function () {
  'use strict';
  const THREE = window.THREE, G = 9.81, TAU = Math.PI * 2;
  const BASE = 'models/';
  const DEFS = [
    {
      id: 'glb_otter', file: 'otter.glb', name: 'Otter-Chan', title: 'Tamirci Su Samuru', stature: 1.45, rotX: Math.PI / 2, color: 0x7c5a3a,
      hide: [/^Object_(76|77|85)$/], rigged: true, Fr: 0.25,
      desc: 'Kanal teknelerinin motorlarını tamir eden, İngiliz anahtarını hiç bırakmayan neşeli bir su samuru.',
      credit: { title: 'Otter-Chan', author: 'AKM', url: 'https://sketchfab.com/3d-models/otter-chan-3b3800d3fe4143c882dde553f9005666', license: 'CC BY 4.0' }
    },
    {
      id: 'glb_suit', file: 'suit.glb', name: 'Meneer Pak', title: 'Takım Elbiseli Adam', stature: 1.8, color: 0x475569,
      hide: [/floor/i], rigged: false, Fr: 0.2,
      desc: 'Zuidas\'taki ofisinden öğle arasında kaçan, kravatını hiç gevşetmeyen bir bankacı.',
      credit: { title: 'Man In Suit', author: 'jetsu', url: 'https://sketchfab.com/3d-models/man-in-suit-7668c90721144544b3a929edf9eeac9c', license: 'CC BY 4.0' }
    },
    {
      id: 'glb_viking', file: 'viking.glb', name: 'Bjorn', title: 'Viking Savaşçı', stature: 1.9, color: 0x7f1d1d,
      hide: [], rigged: false, Fr: 0.17,
      desc: 'Kalkanı ve baltasıyla gelen, ama kasada en kibar müşteri olan bir viking.',
      credit: { title: 'Viking/Medieval Game Character', author: 'CGenesis', url: 'https://sketchfab.com/3d-models/vikingmedieval-game-character-a9e99a47d2a24957ab6c08c9e57ad48c', license: 'CC BY 4.0' }
    }
  ];
  const PRODUCT = { file: 'nug.glb', credit: { title: 'Weed Nug 1', author: 'nicholscameron4321', url: 'https://sketchfab.com/3d-models/weed-nug-1-968daae03a614dfa80d9327e067eae94', license: 'CC BY 4.0' } };

  const templates = {}; let readyFlag = false, nugGeo = null, nugMat = null, cursor = 0;
  const readyCbs = [];
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

  function relQuat(obj, root) {      // obj'nin root'a göre dünya dönüşü
    const q = new THREE.Quaternion(), r = new THREE.Quaternion();
    obj.getWorldQuaternion(q); root.getWorldQuaternion(r);
    return r.invert().multiply(q);
  }

  function prepare(def, gltf) {
    const model = gltf.scene;
    model.traverse(o => {
      if (o.isSkinnedMesh) o.skeleton.pose();
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (def.hide.some(re => re.test(o.name))) o.visible = false; }
    });
    const wrap = new THREE.Group(); wrap.add(model); model.rotation.x = def.rotX || 0;
    const fit = () => {
      wrap.updateMatrixWorld(true); const b = new THREE.Box3();
      wrap.traverse(o => {
        if (!o.visible) return;
        if (o.isSkinnedMesh) for (const bn of o.skeleton.bones) { if (/tail|target|root/i.test(bn.name)) continue; b.expandByPoint(bn.getWorldPosition(new THREE.Vector3())); }
        else if (o.isMesh) b.expandByObject(o);
      });
      return b;
    };
    let b = fit(); const h = b.max.y - b.min.y;
    // iskelette baş üstü kemiği yoksa kemik kutusu biraz kısa kalır → %6 pay
    wrap.scale.setScalar(def.stature / (h * (def.rigged ? 1.06 : 1)));
    b = fit(); const c = b.getCenter(new THREE.Vector3());
    model.position.x -= c.x / wrap.scale.x; model.position.z -= c.z / wrap.scale.x;
    b = fit(); wrap.position.y = -b.min.y + (def.rigged ? 0.012 * def.stature : 0);   // ayak bileği kemiği tabanın biraz üstünde
    templates[def.id] = wrap;
  }

  // Kemiği modele göre verilen eksen etrafında döndürme yardımcıları
  function boneCtl(bone, root) {
    const pq = relQuat(bone.parent, root), inv = pq.clone().invert();
    return { bone, rest: bone.quaternion.clone(), inv, pq, axX: X.clone().applyQuaternion(inv), axZ: Z.clone().applyQuaternion(inv) };
  }
  function lowerArm(ctl, child, root, side) {   // T/A pozundaki kolu gövde yanına indir
    root.updateMatrixWorld(true);
    const a = ctl.bone.getWorldPosition(new THREE.Vector3()), b2 = child.getWorldPosition(new THREE.Vector3());
    const rinv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    a.applyMatrix4(rinv); b2.applyMatrix4(rinv);
    const dir = b2.sub(a).normalize(), target = new THREE.Vector3(side * 0.18, -1, 0.05).normalize();
    const qm = new THREE.Quaternion().setFromUnitVectors(dir, target);
    const ql = ctl.inv.clone().multiply(qm).multiply(ctl.pq);
    ctl.bone.quaternion.premultiply(ql); ctl.rest.copy(ctl.bone.quaternion);
  }
  const _q = new THREE.Quaternion();
  function rot(ctl, ax, ang, extra) { _q.setFromAxisAngle(ax, ang); ctl.bone.quaternion.copy(ctl.rest).premultiply(_q); if (extra) ctl.bone.quaternion.premultiply(extra); }

  function build(id) {
    const def = DEFS.find(d => d.id === id), tpl = templates[id];
    if (!def || !tpl) return null;
    const inner = def.rigged ? THREE.SkeletonUtils.clone(tpl) : tpl.clone(true);
    const root = new THREE.Group(), motion = new THREE.Group(), body = new THREE.Group();
    root.add(motion); motion.add(body); body.add(inner); root.name = 'glb:' + id;
    // oyunun beklediği arayüz (poşet/şemsiye/teslim kolları)
    const mk = (sx) => { const shoulder = new THREE.Group(); shoulder.position.set(sx * 0.22, def.stature * 0.78, 0.05); motion.add(shoulder); const elbow = new THREE.Group(); elbow.position.y = -def.stature * 0.22; shoulder.add(elbow); return { shoulder, elbow }; };
    const armL = mk(1), armR = mk(-1);
    const umbrella = new THREE.Group(); umbrella.visible = false;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6), new THREE.MeshStandardMaterial({ color: 0x1f2937 })); pole.position.y = 0.35; umbrella.add(pole);
    const can = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.22, 12), new THREE.MeshStandardMaterial({ color: def.color, side: THREE.DoubleSide })); can.position.y = 0.78; umbrella.add(can);
    armR.elbow.add(umbrella);
    const dummyLeg = () => ({ hip: new THREE.Group(), knee: new THREE.Group(), ankle: new THREE.Group() });

    // iskelet kontrolü
    let rig = null;
    if (def.rigged) {
      root.updateMatrixWorld(true);
      const find = (re) => { let f = null; inner.traverse(o => { if (!f && o.isBone && re.test(o.name)) f = o; }); return f; };
      const bn = {
        thL: find(/^(thigh|femur)\.?l|LeftUpLeg/i), thR: find(/^(thigh|femur)\.?r|RightUpLeg/i),
        shL: find(/^shin\.?l|LeftLeg_/i), shR: find(/^shin\.?r|RightLeg_/i),
        ftL: find(/^foot\.?l|LeftFoot/i), ftR: find(/^foot\.?r|RightFoot/i),
        upL: find(/^bicep\.?l|LeftArm_/i), upR: find(/^bicep\.?r|RightArm_/i),
        foL: find(/^forearm\.?l|LeftForeArm/i), foR: find(/^forearm\.?r|RightForeArm/i),
        spine: find(/^spine_mid|Spine1/i), head: find(/^head_|Head_/i)
      };
      if (bn.thL && bn.thR && bn.shL && bn.shR) {
        rig = {};
        for (const k of Object.keys(bn)) if (bn[k]) rig[k] = boneCtl(bn[k], root);
        if (rig.upL && bn.foL) lowerArm(rig.upL, bn.foL, root, 1);
        if (rig.upR && bn.foR) lowerArm(rig.upR, bn.foR, root, -1);
        const hipY = bn.thL.getWorldPosition(new THREE.Vector3()).y;
        rig.L = Math.max(0.3, hipY);
      }
    }
    const legLen = rig ? rig.L : def.stature * 0.5;
    const speed = Math.sqrt((def.Fr || 0.2) * G * legLen);
    const mass = 70 * Math.pow(def.stature / 1.75, 3);
    const ctrl = { mass, breathF: 0.26 * Math.pow(mass / 70, -0.25) };
    let phase = Math.random(), vS = 0, seed = Math.random() * 10, lastYaw = null, bank = 0;
    function update(dt, sp, t) {
      dt = Math.min(dt, 0.05);
      vS += (sp - vS) * Math.min(1, dt * 6);
      const v = Math.max(0, vS), amp = Math.min(1, v / Math.max(0.3, speed));
      const Fr = v * v / (G * legLen), S = v > 0.03 ? Math.min(2.3 * legLen * Math.pow(Fr, 0.3), 1.6 * legLen) : 0;
      const f = S > 0 ? v / S : 0;
      phase = (phase + f * dt) % 1;
      const ph = phase * TAU, breath = Math.sin(t * ctrl.breathF * TAU + seed);
      const yaw = root.rotation.y; if (lastYaw == null) lastYaw = yaw;
      let dy = yaw - lastYaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; lastYaw = yaw;
      bank += (Math.atan(v * (dy / Math.max(dt, 1e-3)) / G) * 0.6 - bank) * Math.min(1, dt * 5);
      if (rig) {
        const sw = 0.55 * amp, kn = 0.9 * amp;
        rot(rig.thL, rig.thL.axX, -sw * Math.sin(ph)); rot(rig.thR, rig.thR.axX, sw * Math.sin(ph));
        rot(rig.shL, rig.shL.axX, kn * Math.max(0, Math.sin(ph + 1.2)) + 0.05); rot(rig.shR, rig.shR.axX, kn * Math.max(0, Math.sin(ph + Math.PI + 1.2)) + 0.05);
        if (rig.ftL) rot(rig.ftL, rig.ftL.axX, -0.3 * amp * Math.sin(ph + 0.6)); if (rig.ftR) rot(rig.ftR, rig.ftR.axX, 0.3 * amp * Math.sin(ph + 0.6));
        if (rig.upL) rot(rig.upL, rig.upL.axX, 0.45 * amp * Math.sin(ph) + 0.03 * breath); if (rig.upR) rot(rig.upR, rig.upR.axX, -0.45 * amp * Math.sin(ph) + 0.03 * breath);
        if (rig.spine) rot(rig.spine, rig.spine.axZ, 0.06 * amp * Math.sin(ph));
        if (rig.head) rot(rig.head, rig.head.axX, -0.04 * breath + 0.08 * Math.sin(t * 0.37 + seed) * (1 - amp));
        motion.position.y = 0.035 * amp * Math.abs(Math.cos(ph)) - 0.015 * amp;
        motion.rotation.z = -bank + 0.025 * amp * Math.sin(ph);
      } else {
        // iskeletsiz: ters sarkaç zıplaması + yanal yuvarlanma (her adımda bir tepe)
        motion.position.y = 0.045 * amp * Math.abs(Math.sin(ph));
        motion.rotation.z = -bank + 0.06 * amp * Math.sin(ph);
        motion.rotation.y = 0.05 * amp * Math.sin(ph);
        motion.rotation.x = 0.05 * amp;
      }
      const s = 1 + 0.012 * breath * (1 - amp);
      body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }
    return {
      group: root, stature: def.stature, baseHipY: legLen, pelvisPivot: motion, spinePivot: body, headPivot: body, torsoMesh: body,
      legL: dummyLeg(), legR: dummyLeg(), armL, armR, umbrella, _cType: id,
      cast: { def: Object.assign({ loco: 'biped', math: mathNotes(def) }, def), ctx: null, ctrl, speed, update, _rig: rig, _inner: inner }
    };
  }
  function mathNotes(def) {
    return def.rigged
      ? ['Kemikler modele göre eksen bağımsız döndürülür: q = q(eₓ′, θ)·q₀, eₓ′ = q_ebeveyn⁻¹·eₓ', 'Kol T-pozundan setFromUnitVectors ile gövde yanına indirilir', `Adım: λ = 2.3·L·Fr^0.3, Fr = ${def.Fr}`, `Model: ${def.credit.title} — ${def.credit.author} (${def.credit.license})`]
      : ['İskeletsiz model: ters sarkaç zıplaması y = A·|sin φ|', 'Yanal yuvarlanma ve yatış φ = atan(v·ω/g)', `Model: ${def.credit.title} — ${def.credit.author} (${def.credit.license})`];
  }

  // Kadro gezinmesi: her çağrıda sıradaki model tipinden yeni bir örnek
  function next() {
    const ids = DEFS.filter(d => templates[d.id]).map(d => d.id);
    if (!ids.length) return null;
    return build(ids[cursor++ % ids.length]);
  }

  // Ürün (nug) geometrisi: ~7 cm'ye ölçeklenmiş, tabanı y=0'da
  function preparedNug(gltf) {
    let mesh = null; gltf.scene.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh) return;
    gltf.scene.updateMatrixWorld(true);
    const g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld);
    g.computeBoundingBox(); const b = g.boundingBox, s = 0.075 / Math.max(b.max.y - b.min.y, b.max.x - b.min.x);
    const c = b.getCenter(new THREE.Vector3());
    g.translate(-c.x, -b.min.y, -c.z); g.scale(s, s, s);
    nugGeo = g; nugMat = mesh.material;
  }

  function load() {
    if (!THREE.GLTFLoader) { console.warn('ModelCast: GLTFLoader yok'); return; }
    const L = new THREE.GLTFLoader();
    const jobs = DEFS.map(def => new Promise(res => L.load(BASE + def.file, g => { try { prepare(def, g); } catch (e) { console.warn('ModelCast', def.id, e); } res(); }, undefined, (e) => { console.warn('ModelCast yüklenemedi', def.file, e); res(); })));
    jobs.push(new Promise(res => L.load(BASE + PRODUCT.file, g => { try { preparedNug(g); } catch (e) {} res(); }, undefined, () => res())));
    Promise.all(jobs).then(() => {
      readyFlag = true;
      // galeriye ekle
      if (window.CastEngine) for (const d of DEFS) if (templates[d.id] && !CastEngine.CAST.some(c => c.id === d.id)) CastEngine.CAST.unshift(Object.assign({ loco: 'biped', math: mathNotes(d), factory: () => build(d.id) }, d));
      readyCbs.splice(0).forEach(cb => { try { cb(); } catch (e) { console.warn(e); } });
      window.dispatchEvent(new Event('models-ready'));
    });
  }

  window.ModelCast = {
    DEFS, PRODUCT, build, next,
    ready: () => readyFlag,
    onReady: (cb) => { if (readyFlag) cb(); else readyCbs.push(cb); },
    nug: () => (nugGeo ? { geo: nugGeo, mat: nugMat } : null),
    credits: () => [...DEFS.map(d => d.credit), PRODUCT.credit]
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
