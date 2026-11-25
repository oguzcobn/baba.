/* =============================================================================
   AMSTERDAM. — MODEL CAST v2 (Sketchfab GLB karakterleri + biyomekanik yürüyüş)
   -----------------------------------------------------------------------------
   İskeletli her modele aynı matematiksel yürüyüş motoru uygulanır:
   • Froude dinamik benzerliği: Fr = v²/(gL), adım uzunluğu λ = 2.3·L·Fr^0.3 (Alexander 1976)
   • Görev faktörü β = 0.64 − 0.3√Fr (çift destek fazı hızla kısalır)
   • Ters sarkaç: kalça yüksekliği H = √(Lₑ² − z²) (destek ayağının yayı)
   • Sikloid salınım yörüngesi z(u) = βλ(u − sin2πu/2π − ½), y(u) = h(1 − cos2πu)/2
   • Analitik 2-kemik IK (kosinüs teoremi) → ayak yerde dünyaya göre sabit (kayma yok)
   • Ayak bileği fazları: topuk vuruşu (dorsifleksiyon) → düz basış → topuk kalkışı → parmak itişi
   • Kalça: dönme (yaw), Trendelenburg düşmesi (roll), yanal ağırlık aktarımı
   • Omuz karşı dönüşü, ivme ile öne eğilme, dönüşte yatış φ = atan(v·ω/g)
   • Kollar: sürülen sönümlü fiziksel sarkaç ω₀ = √(3g / 2ℓ), ζ = 0.45
   • Kleiber nefesi f ∝ M^−1/4, durunca ağırlık aktarma, kritik sönümlü baş/göz takibi
   Kemikler modele göre eksen-bağımsız döndürülür: q = q(eₓ′, θ)·q₀, eₓ′ = q_ebeveyn⁻¹·eₓ
   ============================================================================= */
(function () {
  'use strict';
  const THREE = window.THREE, G = 9.81, TAU = Math.PI * 2;
  const BASE = 'models/';
  const C = (t, a, url, lic = 'CC BY 4.0') => ({ title: t, author: a, url, license: lic });
  const DEFS = [
    { id: 'glb_otter', file: 'otter.glb', name: 'Otter-Chan', title: 'Tamirci Su Samuru', stature: 1.45, rotX: Math.PI / 2, color: 0x7c5a3a, hide: [/^Object_(76|77|85)$/], Fr: 0.25, desc: 'Kanal teknelerinin motorlarını tamir eden, İngiliz anahtarını hiç bırakmayan neşeli bir su samuru.', credit: C('Otter-Chan', 'AKM', 'https://sketchfab.com/3d-models/otter-chan-3b3800d3fe4143c882dde553f9005666') },
    { id: 'glb_coat', file: 'coat.glb', name: 'Pieter', title: 'Paltolu Beyefendi', stature: 1.82, color: 0x57534e, Fr: 0.2, desc: 'Her sabah aynı saatte gelip aynı şeyi isteyen, şemsiyesini hiç unutmayan beyefendi.', credit: C('Man In Coat - Human Rigged Model', 'Saitam', 'https://sketchfab.com/saitam_ha') },
    { id: 'glb_doctor', file: 'doctor.glb', name: 'Dr. Visser', title: 'Nöbet Çıkışı Doktor', stature: 1.76, color: 0x0ea5e9, Fr: 0.22, desc: 'Gece nöbetinden çıkıp kahvesini almadan eve gitmeyen yorgun doktor.', credit: C('Doctor - Sketchfab Weekly - 13 Mar\'23', 'BrushDip', 'https://sketchfab.com/BrushDip') },
    { id: 'glb_biker', file: 'biker.glb', name: 'Henk', title: 'Motorcu', stature: 1.86, color: 0x1f2937, Fr: 0.18, desc: 'Motorunu kanal kenarına park edip hep aynı köşe masaya oturan motorcu.', credit: C('Biker', 'user1145', 'https://sketchfab.com/user1145') },
    { id: 'glb_estudiante', file: 'estudiante.glb', name: 'Lucía', title: 'Değişim Öğrencisi', stature: 1.66, color: 0xdb2777, Fr: 0.24, desc: 'Erasmus için Amsterdam\'a gelmiş, her yeri bisikletle gezen öğrenci.', credit: C('ESTUDIANTE METARETAIL', 'vmmaniac', 'https://sketchfab.com/vmmaniac') },
    { id: 'glb_tiffany', file: 'tiffany.glb', name: 'Tiffany', title: 'Gece Kuşu', stature: 1.7, color: 0x7c3aed, Fr: 0.22, desc: 'Konser çıkışı uğrayıp dükkândaki müziği hep yükseltmek isteyen gece kuşu.', credit: C('tiffany cox', 'jerryzilla', 'https://sketchfab.com/jerryzilla') },
    { id: 'glb_sayuri', file: 'sayuri.glb', name: 'Sayuri', title: 'Dansçı', stature: 1.63, color: 0xf43f5e, Fr: 0.24, dance: true, desc: 'Sıra beklerken bile dans etmeden duramayan dansçı.', credit: C('Sayuri Dans', 'Vasian-Digital3D', 'https://sketchfab.com/Vasian-Digital3D') },
    { id: 'glb_scornguy', file: 'scornguy.glb', name: 'Scorn', title: 'Dansçı Yaratık', stature: 1.78, color: 0xf59e0b, Fr: 0.24, dance: true, desc: 'Nereden geldiği bilinmeyen, ama ritmi hiç kaçırmayan dansçı yaratık.', credit: C('Scornguy Dans', 'Vasian-Digital3D', 'https://sketchfab.com/Vasian-Digital3D') },
    { id: 'glb_alien', file: 'alien.glb', name: 'Blip', title: 'Uzaylı Turist', stature: 1.5, color: 0x22c55e, Fr: 0.26, dance: true, desc: 'Dünyanın en meşhur dükkânını görmeye gelmiş, mutlu olunca dans eden uzaylı.', credit: C('Alien Mem', 'Amanda3D', 'https://sketchfab.com/amAmanda') },
    { id: 'glb_char4', file: 'char4.glb', name: 'Joris', title: 'Sokak Stili', stature: 1.76, color: 0x0d9488, Fr: 0.22, desc: 'Kaykayını kapının yanına bırakan, sokak modasını takip eden genç.', credit: C('Character 4', 'iansilvadaher', 'https://sketchfab.com/iansilvadaher') },
    { id: 'glb_boy', file: 'boy.glb', name: 'Daan', title: 'Kampüs Çocuğu', stature: 1.78, color: 0x2563eb, Fr: 0.23, desc: 'Üniversite kampüsünden gelen, sınav haftasında kahvesiz yaşayamayan genç.', credit: C('character boy #1 (FBX)', 'BELAZ', 'https://sketchfab.com/asset_for_games') },
    { id: 'glb_balthazar', file: 'balthazar.glb', name: 'Balthazar', title: 'Gezgin', stature: 1.82, color: 0x92400e, Fr: 0.19, desc: 'Dünyayı dolaşıp her şehirden bir hikâye toplayan gezgin.', credit: C('Balthazar (rigged & animated)', 'Jungle Jim', 'https://sketchfab.com/jungle_jim') },
    { id: 'glb_oldrus', file: 'oldrus.glb', name: 'Ivan', title: 'Yaşlı Denizci', stature: 1.72, color: 0x64748b, Fr: 0.13, desc: 'Gençliğinde Baltık\'ta gemi kaptanlığı yapmış, ağır ve sakin adımlı yaşlı denizci.', credit: C('Realistic Old Russian Guy (animated)', 'Jungle Jim', 'https://sketchfab.com/jungle_jim') },
    { id: 'glb_lady', file: 'lady.glb', name: 'Mevrouw Noir', title: 'Siyah Elbiseli Hanım', stature: 1.72, rotY: Math.PI, color: 0x111827, Fr: 0.2, desc: 'Opera çıkışı uğrayan, her zaman en zarif siparişi veren hanımefendi.', credit: C('Lady In Black Dress', 'aribb', 'https://sketchfab.com/chantinlong1103', 'CC BY-NC 4.0') },
    { id: 'glb_suit', file: 'suit.glb', name: 'Meneer Pak', title: 'Takım Elbiseli Adam', stature: 1.8, color: 0x475569, hide: [/floor/i], Fr: 0.2, desc: 'Zuidas\'taki ofisinden öğle arasında kaçan, kravatını hiç gevşetmeyen bir bankacı.', credit: C('Man In Suit', 'jetsu', 'https://sketchfab.com/3d-models/man-in-suit-7668c90721144544b3a929edf9eeac9c') },
    { id: 'glb_viking', file: 'viking.glb', name: 'Bjorn', title: 'Viking Savaşçı', stature: 1.9, color: 0x7f1d1d, Fr: 0.17, desc: 'Kalkanı ve baltasıyla gelen, ama kasada en kibar müşteri olan bir viking.', credit: C('Viking/Medieval Game Character', 'CGenesis', 'https://sketchfab.com/3d-models/vikingmedieval-game-character-a9e99a47d2a24957ab6c08c9e57ad48c') }
  ];
  const PRODUCT = { file: 'nug.glb', credit: C('Weed Nug 1', 'nicholscameron4321', 'https://sketchfab.com/3d-models/weed-nug-1-968daae03a614dfa80d9327e067eae94') };

  const templates = {}, clips = {};
  let readyFlag = false, nugGeo = null, nugMat = null, cursor = 0;
  const readyCbs = [];
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // Kemik sınıflandırıcı: Mixamo (LeftUpLeg), Blender (thigh.l / femur.l), Unreal (thigh_l / calf_l)
  function classifyBones(root) {
    const out = {};
    root.traverse(o => {
      if (!o.isBone) return;
      // Bip001 (3ds Max), CC_Base (Character Creator) önekleri ve sondaki dışa aktarım numaraları atılır
      const n = o.name.toLowerCase().replace(/mixamorig:?/, '').replace(/^(bip0*\d*|cc_base|def|org)[\s._-]*/, '').replace(/_?\d{2,}$/, '').replace(/_\d$/, '');
      if (/twist|roll|share|^ik|ik$|pole|target|nub|_end$|end$|toe|finger|thumb|index|pinky|ring|middle|^ears?|earbase|eye|jaw|tail|breast|tongue|teeth|lip|brow|cheek|clav/.test(n)) return;
      const tok = n.split(/[\s._:-]+/).filter(Boolean);
      let side = /left/.test(n) ? 'L' : /right/.test(n) ? 'R' : tok.includes('l') ? 'L' : tok.includes('r') ? 'R' : '';
      let b = tok.filter(t => t !== 'l' && t !== 'r').join('').replace(/left|right/, '');
      if (!side && /[a-z][lr]$/.test(b) && !/head|spinel?$/.test(b)) { side = b.slice(-1).toUpperCase(); b = b.slice(0, -1); }
      const part = /forearm|lowerarm/.test(b) ? 'fo' : /upleg|thigh|femur|upperleg/.test(b) ? 'th' : (/shin|calf|lowerleg|knee/.test(b) || b === 'leg') ? 'sh'
        : /foot|ankle/.test(b) ? 'ft' : (/bicep|upperarm/.test(b) || b === 'arm') ? 'up' : /^hand$/.test(b) ? 'hd'
        : /^(spine2|spine02|spine3|spine03|chest|upperchest|spineupper)$/.test(b) ? 'chest' : /^(spine|spine1|spinemid|spinelower|spine01)$/.test(b) ? 'spine' : /^neck/.test(b) ? 'neck' : /^head$/.test(b) ? 'head' : null;
      if (!part) return;
      const key = ['spine', 'chest', 'neck', 'head'].includes(part) ? part : part + side;
      if ((key.length > 2 || side) && !out[key]) out[key] = o;
    });
    return out;
  }

  function relQuat(obj, root) { const q = new THREE.Quaternion(), r = new THREE.Quaternion(); obj.getWorldQuaternion(q); root.getWorldQuaternion(r); return r.invert().multiply(q); }
  function localPos(obj, root) { root.updateMatrixWorld(true); const v = obj.getWorldPosition(new THREE.Vector3()); return v.applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert()); }

  // İskeletli modellerde bağlama pozundaki gerçek (deri) sınır kutusu
  function skinnedBox(wrap) {
    wrap.updateMatrixWorld(true); const b = new THREE.Box3(), v = new THREE.Vector3();
    wrap.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 500));
      if (o.isSkinnedMesh) { o.skeleton.update(); for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); b.expandByPoint(v); } }
      else { o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
    });
    return b;
  }

  // Bağlama (rest) pozu: kemik_dünya = bindMatrix · boneInverse⁻¹ ; yerel = ebeveyn_dünya⁻¹ · kemik_dünya
  // (three.js skeleton.pose() kemik olmayan ebeveynlerin — Sketchfab Armature düğümü — dönüş/ölçeğini yok sayar)
  function restPose(model) {
    model.updateMatrixWorld(true);
    const target = new Map();
    model.traverse(o => {
      if (!o.isSkinnedMesh) return;
      o.skeleton.bones.forEach((b, i) => { if (!target.has(b)) target.set(b, new THREE.Matrix4().copy(o.bindMatrix).multiply(new THREE.Matrix4().copy(o.skeleton.boneInverses[i]).invert())); });
    });
    const inv = new THREE.Matrix4(), m = new THREE.Matrix4();
    const visit = (o) => {
      if (target.has(o)) {
        o.parent.updateMatrixWorld(false);
        m.copy(inv.copy(o.parent.matrixWorld).invert()).multiply(target.get(o));
        m.decompose(o.position, o.quaternion, o.scale);
        o.updateMatrixWorld(false);
      }
      o.children.forEach(visit);
    };
    visit(model);
    model.updateMatrixWorld(true);
  }

  // Üç poz adayından derinin en "insansı" duruşu vereni seç: uzun/dar kutu, baş ayakların üstünde
  function choosePose(model, wrap) {
    const bones = []; model.traverse(o => { if (o.isBone) bones.push(o); });
    if (!bones.length) return 'static';
    const orig = bones.map(b => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    const reset = () => bones.forEach((b, i) => { b.position.copy(orig[i][0]); b.quaternion.copy(orig[i][1]); b.scale.copy(orig[i][2]); });
    const cands = {
      node: () => {},
      pose: () => model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.pose(); }),
      rest: () => restPose(model)
    };
    const bn = classifyBones(model);
    let best = 'node', bestS = -1;
    for (const k of Object.keys(cands)) {
      reset(); cands[k]();
      const sz = skinnedBox(wrap).getSize(new THREE.Vector3());
      let sc = sz.y / Math.max(sz.x, sz.z, 1e-6);
      if (bn.head && bn.ftL) { wrap.updateMatrixWorld(true); if (bn.head.getWorldPosition(new THREE.Vector3()).y < bn.ftL.getWorldPosition(new THREE.Vector3()).y) sc *= 0.2; }
      if (sc > bestS * 1.03) { bestS = sc; best = k; }
    }
    reset(); cands[best]();
    return best;
  }

  function prepare(def, gltf) {
    const model = gltf.scene;
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.frustumCulled = false; if ((def.hide || []).some(re => re.test(o.name))) o.visible = false;
        // Sketchfab dışa aktarımları çoğu zaman tüm kıyafeti "saydam" işaretler → çizim sırası karışır, vücut kıyafetin
        // içinden görünür. Saydamlığı alfa kesmeye çevir: opak yüzeyler doğru derinlikle çizilir, saç kenarları korunur.
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && m.transparent) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; m.needsUpdate = true; } });
      }
    });
    const wrap = new THREE.Group(); wrap.add(model); model.rotation.x = def.rotX || 0; model.rotation.y = def.rotY || 0;
    def.pose = choosePose(model, wrap);
    const bones = classifyBones(model);
    def.rigged = !!(bones.thL && bones.thR && bones.shL && bones.shR && bones.ftL && bones.ftR);
    if (def.local) {    // Z-yukarı dışa aktarımları yakala
      const sz = skinnedBox(wrap).getSize(new THREE.Vector3());
      if (sz.z > sz.y * 1.35) {
        model.rotation.x = -Math.PI / 2;
        if (bones.head && bones.ftL && localPos(bones.head, wrap).y < localPos(bones.ftL, wrap).y) model.rotation.x = Math.PI / 2;
      }
    }
    let b = skinnedBox(wrap); const h = b.max.y - b.min.y;
    wrap.scale.setScalar(def.stature / h);
    b = skinnedBox(wrap); const c = b.getCenter(new THREE.Vector3());
    model.position.x -= c.x / wrap.scale.x; model.position.z -= c.z / wrap.scale.x;
    b = skinnedBox(wrap); wrap.position.y = -b.min.y;
    templates[def.id] = wrap;
    if (def.dance && gltf.animations && gltf.animations.length) {
      // dans klibi: kayma/ölçek izlerini at, yalnızca kemik dönüşleri kalsın (yerinde dans)
      const clip = gltf.animations[0].clone();
      clip.tracks = clip.tracks.filter(t => /\.quaternion$/.test(t.name));
      clips[def.id] = clip;
    }
  }

  // Kemik kontrol yardımcıları (modele göre eksen bağımsız)
  function boneCtl(bone, root) {
    const pq = relQuat(bone.parent, root), inv = pq.clone().invert();
    return { bone, rest: bone.quaternion.clone(), inv, pq, axX: X.clone().applyQuaternion(inv), axY: Y.clone().applyQuaternion(inv), axZ: Z.clone().applyQuaternion(inv) };
  }
  function lowerArm(ctl, child, root, side) {
    const a = localPos(ctl.bone, root), b2 = localPos(child, root);
    const dir = b2.sub(a).normalize(), target = new THREE.Vector3(side * 0.16, -1, 0.06).normalize();
    if (dir.angleTo(target) < 0.15) return;
    const qm = new THREE.Quaternion().setFromUnitVectors(dir, target);
    ctl.bone.quaternion.premultiply(ctl.inv.clone().multiply(qm).multiply(ctl.pq)); ctl.rest.copy(ctl.bone.quaternion);
  }
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  function setRot(c, ax, ay, az) {   // model eksenleri etrafında açılar, dinlenme pozuna göre
    c.bone.quaternion.copy(c.rest);
    if (az) c.bone.quaternion.premultiply(_q3.setFromAxisAngle(c.axZ, az));
    if (ay) c.bone.quaternion.premultiply(_q2.setFromAxisAngle(c.axY, ay));
    if (ax) c.bone.quaternion.premultiply(_q1.setFromAxisAngle(c.axX, ax));
  }
  const pitchOf = (v) => Math.atan2(v.z, -v.y);   // sagital düzlemde aşağı yönden ileri açı

  // Kritik sönümlü yay (kapalı form) ve sürülen sönümlü osilatör
  function crit(st, target, w, dt) { const d = st.x - target, e = Math.exp(-w * dt), k = (st.v + w * d) * dt; st.x = target + (d + k) * e; st.v = (st.v - w * k) * e; return st.x; }
  function osc(st, target, w, z, dt) { const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { st.v += (w * w * (target - st.x) - 2 * z * w * st.v) * h; st.x += st.v * h; } return st.x; }

  // ---------------------------------------------------------------------------
  // BİYOMEKANİK YÜRÜYÜŞ
  // ---------------------------------------------------------------------------
  function makeGait(inner, root, def) {
    root.updateMatrixWorld(true);
    const bn = classifyBones(inner);
    const R = {};
    // önce üst kolları T-pozdan indir, SONRA diğer kemiklerin eksenlerini hesapla (önkol/el eksenleri yeni poza göre)
    if (bn.upL && bn.foL) lowerArm(boneCtl(bn.upL, root), bn.foL, root, 1);
    root.updateMatrixWorld(true);
    if (bn.upR && bn.foR) lowerArm(boneCtl(bn.upR, root), bn.foR, root, -1);
    root.updateMatrixWorld(true);
    for (const k of Object.keys(bn)) R[k] = boneCtl(bn[k], root);
    R.hips = boneCtl(bn.thL.parent, root);
    const leg = (s) => {
      const hip = localPos(bn['th' + s], root), knee = localPos(bn['sh' + s], root), ank = localPos(bn['ft' + s], root);
      const L1 = hip.distanceTo(knee), L2 = knee.distanceTo(ank);
      const Hr = hip.y - ank.y, k = Hr / (L1 + L2);
      return { th: R['th' + s], sh: R['sh' + s], ft: R['ft' + s], L1s: L1 * k, L2s: L2 * k, Hrest: Hr, hipY: hip.y, ankY: ank.y,
        p1: pitchOf(knee.clone().sub(hip)), p2: pitchOf(ank.clone().sub(knee)), footLen: Math.max(0.12, def.stature * 0.13) };
    };
    const legs = { L: leg('L'), R: leg('R') };
    const Hrest = (legs.L.Hrest + legs.R.Hrest) / 2;
    const armLen = (s) => (R['up' + s] && bn['fo' + s]) ? localPos(bn['up' + s], root).distanceTo(localPos(bn['fo' + s], root)) * 2.1 : def.stature * 0.36;
    const arm = { L: { st: { x: 0, v: 0 }, w: Math.sqrt(3 * G / (2 * armLen('L'))) }, R: { st: { x: 0, v: 0 }, w: Math.sqrt(3 * G / (2 * armLen('R'))) } };
    const gz = { yaw: { x: 0, v: 0 }, pit: { x: 0, v: 0 } };
    let sacT = 1 + Math.random() * 2, gazeY = 0, gazeP = 0;

    function solve(L, tz, ty, toeUp) {
      const d = clamp(Math.hypot(tz, ty), Math.abs(L.L1s - L.L2s) + 1e-3, (L.L1s + L.L2s) * 0.999);
      const gam = Math.atan2(tz, -ty);
      const al = Math.acos(clamp((L.L1s * L.L1s + d * d - L.L2s * L.L2s) / (2 * L.L1s * d), -1, 1));
      const inn = Math.acos(clamp((L.L1s * L.L1s + L.L2s * L.L2s - d * d) / (2 * L.L1s * L.L2s), -1, 1));
      const a1 = gam + al, a2 = a1 - (Math.PI - inn);
      setRot(L.th, -(a1 - L.p1), 0, 0);
      setRot(L.sh, -((a2 - L.p2) - (a1 - L.p1)), 0, 0);
      setRot(L.ft, (a2 - L.p2) - toeUp, 0, 0);
    }

    const armSt = { L: { p: { x: 0, v: 0 }, f: { x: 0, v: 0 }, a: { x: 0, v: 0 } }, R: { p: { x: 0, v: 0 }, f: { x: 0, v: 0 }, a: { x: 0, v: 0 } } };
    // Kol pozunu kritik sönümlü yaylarla hedefe götür (ani sıçrama yok)
    function armTo(s, pitch, flex, abd, dt) {
      if (!R['up' + s]) return;
      const a = armSt[s], sg = s === 'L' ? 1 : -1, w = 9;
      setRot(R['up' + s], crit(a.p, pitch, w, dt), 0, sg * crit(a.a, abd, w, dt));
      if (R['fo' + s]) setRot(R['fo' + s], crit(a.f, flex, w, dt), 0, 0);
    }
    function syncArm(s, pitch, flex, abd) { const a = armSt[s]; a.p.x = pitch; a.f.x = flex; a.a.x = abd; a.p.v = a.f.v = a.a.v = 0; }
    const kS = def.stature / 1.75;

    function sit(st, dt, t) {
      const hipY = (legs.L.hipY + legs.R.hipY) / 2, ankY = (legs.L.ankY + legs.R.ankY) / 2;
      const hipT = st.seatY + 0.085 * kS;
      st.motion.position.set(0, hipT - hipY, -0.05 * kS); st.motion.rotation.set(0, 0, 0);
      for (const s of ['L', 'R']) solve(legs[s], legs[s].L1s * 0.9, -(hipT - ankY), 0);
      setRot(R.hips, 0, 0, 0);
      const bongLean = st.act === 'bong' ? 0.42 * st.actW : 0;
      const sp = -0.05 + 0.012 * st.breath + bongLean;
      if (R.spine) setRot(R.spine, sp, 0, 0);
      if (R.chest) setRot(R.chest, 0.4 * bongLean + 0.015 * st.breath, 0, 0);
      sacT -= dt; if (sacT <= 0) { sacT = 1.5 + Math.random() * 3; gazeY = (Math.random() * 2 - 1) * 0.5; gazeP = (Math.random() * 2 - 1) * 0.1; }
      const hy = crit(gz.yaw, st.act === 'bong' ? 0 : gazeY, 5, dt), hp = crit(gz.pit, gazeP, 5, dt);
      if (R.neck) setRot(R.neck, hp * 0.5 + 0.15 * bongLean, hy * 0.5, 0);
      if (R.head) setRot(R.head, hp * 0.5 + 0.2 * bongLean, hy * 0.5, 0);
      if (st.act === 'smoke') {
        // el ağza: 9 s'lik döngü, ~2.4 s nefes; yükselme yumuşak (smoothstep)
        const u = st.actT % 9, rise = u < 0.7 ? u / 0.7 : u < 2.4 ? 1 : u < 3.1 ? 1 - (u - 2.4) / 0.7 : 0;
        const b = rise * rise * (3 - 2 * rise);
        armTo('R', -0.12 - 0.42 * b, -1.05 - 1.15 * b, 0.1 + 0.25 * b, dt);
        if (u >= 2.4 && st.puffAt !== Math.floor(st.actT / 9)) { st.puffAt = Math.floor(st.actT / 9); st.onPuff && st.onPuff(); }
      } else if (st.act === 'bong') armTo('R', -0.75 * st.actW - 0.4, -0.7, 0.05, dt);
      else armTo('R', -0.12, -1.05, 0.1, dt);
      armTo('L', st.act === 'bong' ? -0.75 * st.actW - 0.4 : -0.12, st.act === 'bong' ? -0.55 : -1.05, 0.1, dt);
    }

    return function step(st, dt, t) {
      if (st.mode === 'sit') { sit(st, dt, t); return; }
      const { amp, phase, lean, bank, breath, S, beta } = st;
      const clearance = (0.1 + 0.04 * amp) * Hrest * Math.min(1, amp * 1.6);
      const feet = {};
      for (const [s, off] of [['L', 0], ['R', 0.5]]) {
        const u0 = (phase + off) % 1; let z, y = 0, toe = 0, stance;
        if (u0 < beta) {
          const u = u0 / beta; stance = true;
          z = beta * S * (0.5 - u);
          if (u < 0.12) toe = 0.24 * amp * (1 - u / 0.12);                                  // topuk vuruşu
          else if (u > 0.68) { const q = (u - 0.68) / 0.32; toe = -0.55 * amp * q * q; }        // topuk kalkışı
          y = Math.max(0, Math.sin(-toe)) * legs[s].footLen * 0.55;                             // parmak üstünde dönme
        } else {
          const u = (u0 - beta) / (1 - beta); stance = false;
          z = beta * S * (-0.5 + (u - Math.sin(TAU * u) / TAU));                                // sikloid
          y = clearance * (1 - Math.cos(TAU * u)) / 2 + (u < 0.2 ? legs[s].footLen * 0.3 * amp * (1 - u / 0.2) : 0);
          toe = amp * (-0.55 * Math.max(0, 1 - u / 0.3) + 0.2 * Math.max(0, (u - 0.6) / 0.4));  // itiş → dorsifleksiyon
        }
        feet[s] = { z, y, toe, stance };
      }
      // ters sarkaç kalça yüksekliği
      const Le = Hrest * 0.985;
      let H = Le;
      for (const s of ['L', 'R']) if (feet[s].stance) H = Math.min(H, Math.sqrt(Math.max(1e-4, Le * Le - feet[s].z * feet[s].z)));
      const idleSway = (1 - amp) * Math.sin(t * 0.33 + 1.7) * 0.018;
      st.motion.position.y = H - Hrest;
      st.motion.position.x = 0.022 * amp * Math.sin(phase * TAU) + idleSway;
      st.motion.rotation.z = -bank;
      for (const s of ['L', 'R']) { const f = feet[s]; solve(legs[s], f.z, -H + f.y, f.toe); }
      // pelvis & gövde
      const pYaw = 0.13 * amp * Math.sin(phase * TAU + Math.PI), pRoll = 0.055 * amp * Math.sin(phase * TAU * 2 + Math.PI / 2) + idleSway * 1.2;
      setRot(R.hips, 0.02 * amp, pYaw, pRoll);
      const spP = lean + 0.012 * breath, chP = 0.4 * lean + 0.02 * breath;
      if (R.spine) setRot(R.spine, spP, -pYaw * 0.6, -pRoll * 0.6);
      if (R.chest) setRot(R.chest, chP, -pYaw * 0.7, -pRoll * 0.3);
      // baş: sakkad + kritik sönüm, gövde eğimini dengele
      sacT -= dt; if (sacT <= 0) { sacT = 1.2 + Math.random() * 2.6; gazeY = (Math.random() * 2 - 1) * (amp > 0.3 ? 0.25 : 0.6); gazeP = (Math.random() * 2 - 1) * 0.12; }
      const hy = crit(gz.yaw, gazeY, 6, dt), hp = crit(gz.pit, gazeP, 6, dt);
      if (R.neck) setRot(R.neck, -(spP + chP) * 0.5 + hp * 0.5, hy * 0.5 + pYaw * 0.3, 0);
      if (R.head) setRot(R.head, -(spP + chP) * 0.4 + hp * 0.5 - 0.02 * amp * Math.cos(phase * TAU * 2), hy * 0.5, 0);
      // kollar: sürülen sönümlü sarkaç, karşı bacakla ters faz
      const half = Math.max(0.5 * beta * S, 1e-3);
      for (const [s, opp, sg] of [['L', 'R', 1], ['R', 'L', -1]]) {
        if (!R['up' + s]) continue;
        const target = -0.55 * amp * (feet[opp].z / half) - 0.03;
        const th = osc(arm[s].st, target, arm[s].w, 0.45, dt);
        setRot(R['up' + s], th, 0, sg * (0.05 + 0.015 * breath));
        if (R['fo' + s]) setRot(R['fo' + s], -(0.1 + 0.3 * Math.max(0, -th) + 0.06 * amp), 0, 0);
        if (st.carry === 'box') armTo(s, -0.38 + 0.03 * amp * Math.sin(phase * TAU), -1.15, -0.16, dt);
        else syncArm(s, th, -(0.1 + 0.3 * Math.max(0, -th) + 0.06 * amp), 0.05);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // KARAKTER KURUCU
  // ---------------------------------------------------------------------------
  const _hA = new THREE.Vector3(), _hB = new THREE.Vector3();
  function build(id) {
    const def = DEFS.find(d => d.id === id), tpl = templates[id];
    if (!def || !tpl) return null;
    const inner = def.rigged ? THREE.SkeletonUtils.clone(tpl) : tpl.clone(true);
    const root = new THREE.Group(), motion = new THREE.Group(), body = new THREE.Group();
    root.add(motion); motion.add(body); body.add(inner); root.name = 'glb:' + id;
    const mk = (sx) => { const shoulder = new THREE.Group(); shoulder.position.set(sx * 0.22, def.stature * 0.78, 0.05); motion.add(shoulder); const elbow = new THREE.Group(); elbow.position.y = -def.stature * 0.22; shoulder.add(elbow); return { shoulder, elbow }; };
    const armL = mk(1), armR = mk(-1);
    const umbrella = new THREE.Group(); umbrella.visible = false;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6), new THREE.MeshStandardMaterial({ color: 0x1f2937 })); pole.position.y = 0.35; umbrella.add(pole);
    const can = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.22, 12), new THREE.MeshStandardMaterial({ color: def.color, side: THREE.DoubleSide })); can.position.y = 0.78; umbrella.add(can);
    armR.elbow.add(umbrella);
    const dummyLeg = () => ({ hip: new THREE.Group(), knee: new THREE.Group(), ankle: new THREE.Group() });

    let gait = null;
    if (def.rigged) { try { gait = makeGait(inner, root, def); } catch (e) { console.warn('gait', id, e); } }
    // Gerçek el kemiklerine tutucu: eşyalar (poşet, joint, şemsiye) elle birlikte hareket eder.
    // Tutucu, kemiğin dünya dönüş/ölçeğini sıfırlar → eşyalar dik ve doğru boyda durur.
    const hands = {};
    if (gait) {
      root.updateMatrixWorld(true);
      const hb = classifyBones(inner);
      for (const s of ['L', 'R']) {
        const hand = hb['hd' + s] || hb['fo' + s]; if (!hand) continue;
        const h = new THREE.Group(), ws = new THREE.Vector3();
        h.quaternion.copy(relQuat(hand, root)).invert();
        hand.getWorldScale(ws); h.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
        h.position.set(0, 0, 0); hand.add(h); hands[s] = h;
        // eski kod eşyayı "dirsek" grubuna ~0.34 m aşağı koyuyor; vekil grup bunu ele göre kaydırır
        const proxy = new THREE.Group(); proxy.position.set(0, 0.22, 0); h.add(proxy);
        (s === 'L' ? armL : armR).elbow = proxy;
      }
      if (hands.R) { armR.elbow.add(umbrella); umbrella.position.y = -0.27; }
    }
    // Kutu: iki elle göğüs önünde taşınan alışveriş kutusu
    const box = new THREE.Group(); box.visible = false;
    {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24), new THREE.MeshStandardMaterial({ color: 0xb98b55, roughness: 0.9 }));
      bm.castShadow = true; box.add(bm);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.202, 0.242), new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.6 })); box.add(tape);
      box.position.set(0, def.stature * 0.6, 0.27 * def.stature / 1.75); motion.add(box);
    }
    let mixer = null, dance = null;
    if (clips[id]) { mixer = new THREE.AnimationMixer(inner); dance = mixer.clipAction(clips[id]); }

    const legLen = def.stature * 0.5;
    const speed = Math.sqrt((def.Fr || 0.2) * G * legLen);
    const mass = 70 * Math.pow(def.stature / 1.75, 3);
    const ctrl = { mass, breathF: 0.26 * Math.pow(mass / 70, -0.25) };
    const vS = { x: 0, v: 0 };
    let phase = Math.random(), lastYaw = null, bank = 0, aF = 0, lastV = 0, still = 0, dancing = false;
    const st = { motion, mode: 'walk', carry: null, act: null, actT: 0, actW: 0, seatY: 0.62 };
    function update(dt, sp, t) {
      dt = Math.min(dt, 0.05);
      const v = Math.max(0, crit(vS, sp, 6, dt));
      aF += ((v - lastV) / Math.max(dt, 1e-3) - aF) * 0.2; lastV = v;
      const amp = clamp(v / Math.max(0.35, speed), 0, 1.3);
      const Fr = v * v / (G * legLen);
      const S = v > 0.03 ? Math.min(2.3 * legLen * Math.pow(Fr, 0.3), 1.7 * legLen) : 0;   // λ = 2.3·L·Fr^0.3
      const f = S > 0 ? v / S : 0;
      phase = (phase + f * dt) % 1;
      const beta = clamp(0.64 - 0.3 * Math.sqrt(Fr), 0.52, 0.64);
      const yaw = root.rotation.y; if (lastYaw == null) lastYaw = yaw;
      let dy = yaw - lastYaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; lastYaw = yaw;
      bank += (clamp(Math.atan(v * (dy / Math.max(dt, 1e-3)) / G) * 0.7, -0.25, 0.25) - bank) * Math.min(1, dt * 5);
      const breath = Math.sin(t * ctrl.breathF * TAU);
      const lean = 0.04 + 0.05 * Math.min(1, amp) + clamp(aF * 0.04, -0.08, 0.1);
      still = v < 0.04 ? still + dt : 0;
      if (st.mode === 'sit') {
        if (dancing) { dancing = false; dance.stop(); }
        st.actT += dt; st.actW += ((st.act ? 1 : 0) - st.actW) * Math.min(1, dt * 3);
        st.breath = Math.sin(t * ctrl.breathF * TAU);
        if (gait) gait(st, dt, t); else { motion.position.set(0, -0.32 * def.stature / 1.75, 0); motion.rotation.set(0, 0, 0); }
        return;
      }
      if (dance) {
        const want = still > 2.2 && !st.carry;
        if (want && !dancing) { dancing = true; dance.reset().fadeIn(0.35).play(); }
        else if (!want && dancing) { dancing = false; dance.stop(); }
        if (dancing) { mixer.update(dt); motion.position.set(0, 0, 0); motion.rotation.set(0, 0, 0); return; }
      }
      if (gait) {
        Object.assign(st, { v, amp: Math.min(1, amp), phase, lean, bank, breath, Fr, S, beta });
        gait(st, dt, t);
        if (box.visible && hands.L && hands.R) {   // kutu iki avucun tam ortasında
          root.updateMatrixWorld(true);
          const a = hands.L.getWorldPosition(_hA), b = hands.R.getWorldPosition(_hB);
          a.add(b).multiplyScalar(0.5); motion.worldToLocal(a);
          box.position.set(a.x, a.y - 0.02, a.z + 0.02);
        }
      } else {
        const ph = phase * TAU, a1 = Math.min(1, amp);
        motion.position.y = 0.045 * a1 * Math.abs(Math.sin(ph));
        motion.rotation.z = -bank + 0.06 * a1 * Math.sin(ph);
        motion.rotation.y = 0.05 * a1 * Math.sin(ph);
        motion.rotation.x = lean * 0.8;
        const s = 1 + 0.012 * breath * (1 - a1);
        body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      }
    }
    return {
      group: root, stature: def.stature, baseHipY: legLen, pelvisPivot: motion, spinePivot: body, headPivot: body, torsoMesh: body,
      legL: dummyLeg(), legR: dummyLeg(), armL, armR, umbrella, _cType: id,
      cast: {
        def: Object.assign({ loco: 'biped', math: mathNotes(def) }, def), ctx: null, ctrl, speed, update, _rig: !!gait,
        canSit: !!gait, hands,
        setCarry(kind) { st.carry = kind; box.visible = kind === 'box' && !!hands.R; },
        sit(seatY, act) { st.mode = 'sit'; st.seatY = seatY; st.act = act || null; st.actT = Math.random() * 4; st.carry = null; box.visible = false; },
        setAct(act) { st.act = act || null; st.actT = 0; },
        stand() { st.mode = 'walk'; st.act = null; motion.position.set(0, 0, 0); },
        onPuff(fn) { st.onPuff = fn; },
        headWorld(v) { const hb = this._hb || (this._hb = classifyBones(inner)); return (hb.head || root).getWorldPosition(v || new THREE.Vector3()); }
      }
    };
  }
  function mathNotes(def) {
    const cr = `Model: ${def.credit.title} — ${def.credit.author} (${def.credit.license})`;
    return def.rigged
      ? ['Froude: λ = 2.3·L·Fr^0.3, β = 0.64 − 0.3√Fr', 'Ters sarkaç kalça: H = √(Lₑ² − z²), sikloid salınım', 'Analitik 2-kemik IK: ayak yerde sabit; topuk-düz-parmak fazları', 'Kollar: sürülen sönümlü sarkaç ω₀ = √(3g/2ℓ)', ...(def.dance ? ['Beklerken kendi dans klibi (yalnız kemik dönüşleri)'] : []), cr]
      : ['İskeletsiz model: ters sarkaç zıplaması y = A·|sin φ|', 'Yanal yuvarlanma ve yatış φ = atan(v·ω/g)', cr];
  }

  const reserved = new Set();
  function next() {
    const ids = DEFS.filter(d => templates[d.id] && !reserved.has(d.id)).map(d => d.id);
    if (!ids.length) return null;
    return build(ids[cursor++ % ids.length]);
  }

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
  function addToGallery(d) { if (window.CastEngine && !CastEngine.CAST.some(c => c.id === d.id)) CastEngine.CAST.unshift(Object.assign({ loco: 'biped', math: mathNotes(d), factory: () => build(d.id) }, d)); }

  // ---- Kendi modellerin: yalnız bu cihazın tarayıcısında (IndexedDB), hiçbir yere yüklenmez ----
  const DBN = 'amsterdam-models', STO = 'files';
  const db = () => new Promise((res, rej) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore(STO, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STO, mode), s = t.objectStore(STO), out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
  const PALETTE = [0x0ea5e9, 0xf97316, 0x22c55e, 0xa855f7, 0xeab308, 0xec4899, 0x14b8a6];
  function registerLocal(rec) {
    return new Promise((res) => {
      const def = { id: 'local_' + rec.id, local: true, name: rec.name, title: 'Kendi modelin', stature: rec.stature || 1.75, color: PALETTE[rec.id % PALETTE.length], hide: [], Fr: 0.22,
        desc: 'Bu cihazdan eklendi; yalnızca burada görünür, yayınlanmaz.', credit: { title: rec.name, author: '—', url: '', license: 'Yalnız bu cihazda' } };
      rec.blob.arrayBuffer().then(buf => new THREE.GLTFLoader().parse(buf, '', (g) => {
        try { prepare(def, g); DEFS.push(def); addToGallery(def); res(def); } catch (e) { console.warn('yerel model', e); res(null); }
      }, (e) => { console.warn('yerel model okunamadı', e); res(null); }));
    });
  }
  const local = {
    async list() { try { return (await tx('readonly', s => s.getAll())).map(r => ({ id: r.id, name: r.name, size: r.size, rigged: !!(DEFS.find(d => d.id === 'local_' + r.id) || {}).rigged })); } catch (e) { return []; } },
    async add(file, name) {
      if (!/\.glb$/i.test(file.name)) throw new Error('Yalnızca .glb dosyası');
      const rec = { id: Date.now() % 1e9, name: (name || file.name.replace(/\.glb$/i, '')).slice(0, 28), size: file.size, blob: file, added: Date.now() };
      const def = await registerLocal(rec);
      if (!def) throw new Error('Model okunamadı (bozuk ya da desteklenmeyen dosya)');
      await tx('readwrite', s => s.put(rec));
      return def;
    },
    async remove(id) {
      await tx('readwrite', s => s.delete(id));
      const k = 'local_' + id, i = DEFS.findIndex(d => d.id === k); if (i >= 0) DEFS.splice(i, 1); delete templates[k];
      if (window.CastEngine) { const j = CastEngine.CAST.findIndex(c => c.id === k); if (j >= 0) CastEngine.CAST.splice(j, 1); }
    },
    async loadAll() { let recs = []; try { recs = await tx('readonly', s => s.getAll()); } catch (e) {} for (const r of recs) await registerLocal(r); }
  };

  // Yükleme: ilk 5 model hemen, kalanlar arka planda sırayla (telefonu boğmamak için)
  function loadOne(L, def) {
    return new Promise(res => L.load(BASE + def.file, g => { try { prepare(def, g); addToGallery(def); } catch (e) { console.warn('ModelCast', def.id, e); } res(); }, undefined, (e) => { console.warn('ModelCast yüklenemedi', def.file, e); res(); }));
  }
  function load() {
    if (!THREE.GLTFLoader) { console.warn('ModelCast: GLTFLoader yok'); return; }
    const L = new THREE.GLTFLoader();
    const first = DEFS.slice(0, 5), rest = DEFS.slice(5);
    const jobs = first.map(d => loadOne(L, d));
    jobs.push(new Promise(res => L.load(BASE + PRODUCT.file, g => { try { preparedNug(g); } catch (e) {} res(); }, undefined, () => res())));
    jobs.push(local.loadAll());
    Promise.all(jobs).then(async () => {
      readyFlag = true;
      readyCbs.splice(0).forEach(cb => { try { cb(); } catch (e) { console.warn(e); } });
      window.dispatchEvent(new Event('models-ready'));
      for (const d of rest) await loadOne(L, d);
      window.dispatchEvent(new Event('models-more'));
    });
  }

  window.ModelCast = {
    local, DEFS, PRODUCT, build, next, classifyBones,
    reserve: (id) => reserved.add(id), has: (id) => !!templates[id],
    ready: () => readyFlag,
    onReady: (cb) => { if (readyFlag) cb(); else readyCbs.push(cb); },
    nug: () => (nugGeo ? { geo: nugGeo, mat: nugMat } : null),
    credits: () => [...DEFS.filter(d => !d.local).map(d => d.credit), PRODUCT.credit]
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
