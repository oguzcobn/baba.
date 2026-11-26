/* YAŞAM. — UniRig iskelet çözümleyici ve prosedürel animatör.
 * UniRig kemik adları anlamsızdır (bone_0, bone_1 …). Bu dosya iskeleti
 * geometriden okur: bacak, kol/kanat, boyun-baş ve kuyruk zincirlerini bulur,
 * her eklem için "hangi yöne dönünce ayak öne gider / baş aşağı iner" işaretini
 * sayısal olarak sınar. Böylece UniRig ile iskeletlenen herhangi bir GLB yürür.
 */
(function (global) {
  'use strict';
  const V = () => new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function boneChildren(b) { return b.children.filter(c => c.isBone); }

  function collectBones(root) {
    const set = new Set();
    root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.bones.forEach(b => set.add(b)); });
    if (!set.size) root.traverse(o => { if (o.isBone) set.add(o); });
    return [...set];
  }

  function worldPos(b, out) { return b.getWorldPosition(out || V()); }

  // Bone zincirini yaprağından dallanma noktasına kadar yürü.
  function chainFromLeaf(leaf) {
    const chain = [leaf];
    let b = leaf;
    while (b.parent && b.parent.isBone && boneChildren(b.parent).length === 1) {
      b = b.parent; chain.unshift(b);
    }
    return chain; // [üst … yaprak]
  }

  /* Bir kemiği, kök uzayındaki bir eksen etrafında döndürünce izlenen kemiğin
   * (probe) hareketini ölç. Dinlenme pozunu bozmadan geri yükler. */
  function probe(root, bone, axisWorld, angle, watch) {
    const pq = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(pq);
    const rq = new THREE.Quaternion(); root.getWorldQuaternion(rq);
    const axisLocal = axisWorld.clone().applyQuaternion(rq).applyQuaternion(pq.invert()).normalize();
    const before = worldPos(watch);
    const saved = bone.quaternion.clone();
    bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axisLocal, angle));
    root.updateMatrixWorld(true);
    const after = worldPos(watch);
    bone.quaternion.copy(saved);
    root.updateMatrixWorld(true);
    return after.sub(before);
  }

  /* Şablon modeli çözümle. Kök (root) kimlik dönüşümde olmalı. */
  function analyze(root, opts) {
    opts = opts || {};
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);
    const bones = collectBones(root);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(V()), center = box.getCenter(V());
    const H = Math.max(size.y, 1e-6);
    const info = { bones: bones.length, box, size, center, legs: [], arms: [], wings: [], tails: [], neck: null, spine: [], forward: new THREE.Vector3(0, 0, 1) };
    if (!bones.length) return info;

    const P = new Map(); bones.forEach(b => P.set(b, worldPos(b)));
    const leaves = bones.filter(b => !boneChildren(b).length);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Yan eksen = simetri düzlemi (UniRig iskeletleri ayna simetriktir). İleri = diğer yatay eksen.
    const mirrorScore = axis => {
      let s = 0; const pts = bones.map(b => P.get(b));
      pts.forEach(p => { const m = p.clone(); m[axis] = 2 * center[axis] - p[axis]; let best = 1e9; pts.forEach(q => { const d = m.distanceToSquared(q); if (d < best) best = d; }); s += Math.sqrt(best); });
      return s / pts.length;
    };
    const latAxis = opts.lateralAxis || (mirrorScore('x') <= mirrorScore('z') ? 'x' : 'z');
    const fwd = new THREE.Vector3();
    if (opts.forward) fwd.fromArray(opts.forward).normalize();
    else if (latAxis === 'x') fwd.set(0, 0, 1); // glTF kuralı: model +Z'ye bakar
    else fwd.set(1, 0, 0);
    info.forward = fwd;
    const lat = new THREE.Vector3().crossVectors(UP, fwd).normalize(); // sol (+)
    info.lateral = lat;
    const along = p => p.clone().sub(center).dot(fwd);
    const side = p => p.clone().sub(center).dot(lat);
    const halfLen = Math.max(0.5 * Math.abs(size.clone().dot(fwd)), 1e-6);
    const halfW = Math.max(0.5 * Math.abs(size.clone().dot(lat)), 1e-6);

    const isAnc = (a, b) => { for (let x = b; x; x = x.parent) if (x === a) return true; return false; };
    const lca = list => { let a = list[0]; while (a && !list.every(b => isAnc(a, b))) a = a.parent; return a && a.isBone ? a : list[0]; };
    // Ağaç-farkında kümeleme: iki uç, ortak ataları `same(lca)` koşulunu sağlıyorsa aynı uzvun parçasıdır.
    const cluster = (list, same) => {
      const groups = [];
      list.forEach(b => { const g = groups.find(g => g.some(o => same(lca([o, b]), o, b))); g ? g.push(b) : groups.push([b]); });
      return groups;
    };
    const near = (a, x, y, r) => P.get(a) && P.get(a).distanceTo(P.get(x)) < r && P.get(a).distanceTo(P.get(y)) < r;
    // Uç bir kemikten (end) yukarı, başka bir uzvun ucunu da taşıyan kemiğe varana dek tırman.
    const limb = (end, ends) => {
      const chain = [end]; let b = end;
      while (b.parent && b.parent.isBone && !ends.some(o => o !== end && isAnc(b.parent, o))) { b = b.parent; chain.unshift(b); }
      return chain;
    };

    // 1) Ayaklar: yere yakın yapraklar, ayak başına kümelenir; ucu = kümenin ortak atası.
    const groundLeaves = leaves.filter(l => P.get(l).y < box.min.y + 0.15 * H);
    let feet = cluster(groundLeaves, (a) => P.get(a) && P.get(a).y < box.min.y + 0.12 * H).map(g => g.length > 1 ? lca(g) : g[0]);
    // 2) Yan uçlar (kanat/kol/el): yerden yüksek, gövdeden yana açılan yaprak kümeleri.
    const latLeaves = leaves.filter(l => !groundLeaves.includes(l) && Math.abs(side(P.get(l))) > 0.4 * halfW);
    let hands = cluster(latLeaves, (a, x, y) => P.get(a) && Math.abs(side(P.get(a))) > 0.25 * halfW && near(a, x, y, 0.3 * maxDim)).map(g => g.length > 1 ? lca(g) : g[0]).filter(e => Math.abs(side(P.get(e))) > 0.25 * halfW);
    // 3) Baş: orta hattaki en öndeki yaprak; kuyruk: orta hatta, gövdenin gerisindeki yapraklar.
    const mid = leaves.filter(l => !groundLeaves.includes(l) && !latLeaves.includes(l) && Math.abs(side(P.get(l))) < 0.3 * halfW);
    let head = null;
    mid.forEach(l => { const s = along(P.get(l)) + 0.3 * (P.get(l).y - center.y); if (!head || s > along(P.get(head)) + 0.3 * (P.get(head).y - center.y)) head = l; });
    const tailLeaves = mid.filter(l => l !== head && along(P.get(l)) < -0.3 * halfLen);
    const tails = cluster(tailLeaves, (a, x, y) => P.get(a) && along(P.get(a)) < -0.2 * halfLen).map(g => g.length > 1 ? lca(g) : g[0]);

    const allEnds = [...feet, ...hands, ...(head ? [head] : []), ...tails];

    feet.forEach(end => {
      const c = limb(end, allEnds);
      const top = c[0];
      if (!top.parent || !top.parent.isBone) return;
      const pTop = P.get(top), pEnd = P.get(end);
      if (pTop.y - pEnd.y < 0.1 * H || c.length < 2) return; // yılan vb.: bacak değil
      const tip = groundLeaves.find(l => isAnc(end, l)) || end;
      const len = pTop.distanceTo(pEnd) + pEnd.distanceTo(P.get(tip));
      const d = probe(root, top, lat, 0.1, tip);
      const swingSign = d.dot(fwd) >= 0 ? 1 : -1;
      const knee = c[Math.max(1, Math.floor(c.length / 2))] !== end ? c[Math.max(1, Math.floor(c.length / 2))] : c[c.length - 2] || null;
      let kneeSign = 1;
      if (knee && knee !== top) { const dk = probe(root, knee, lat, 0.1, tip); kneeSign = dk.y >= 0 ? 1 : -1; }
      info.legs.push({ top: top.name, knee: knee && knee !== top ? knee.name : null, swingSign, kneeSign, front: along(pTop) >= 0, left: side(pTop) >= 0, len: Math.max(len, 0.05 * H) });
    });

    hands.forEach(end => {
      const c = limb(end, allEnds);
      if (!c[0].parent || !c[0].parent.isBone) return;
      // Kemik zincirini uçtaki en uzun yaprağa kadar uzat (kanat ucu tüyleri).
      let tip = end; while (boneChildren(tip).length) tip = boneChildren(tip).reduce((a, b) => (Math.abs(side(P.get(b))) > Math.abs(side(P.get(a))) ? b : a));
      const d = probe(root, c[0], fwd, 0.1, tip);
      const ds = probe(root, c[0], lat, 0.1, tip);
      const e = { bones: c.map(b => b.name), upSign: d.y >= 0 ? 1 : -1, swingSign: ds.dot(fwd) >= 0 ? 1 : -1, left: side(P.get(end)) >= 0 };
      (opts.flier ? info.wings : info.arms).push(e);
    });

    if (head) {
      const c = limb(head, allEnds);
      const neck = c.length > 1 ? c.slice(0, -1) : c.slice();
      const nb = neck.slice(0, 5);
      const d = probe(root, nb[0], lat, 0.1, head);
      info.neck = { bones: nb.map(x => x.name), leaf: head.name, downSign: d.y <= 0 ? 1 : -1 };
    }

    tails.forEach(end => {
      const c = limb(end, allEnds);
      let b = end; while (boneChildren(b).length) { b = boneChildren(b).reduce((a, x) => (along(P.get(x)) < along(P.get(a)) ? x : a)); c.push(b); }
      const bonesT = c.filter(x => boneChildren(x).length).slice(0, 8);
      if (!bonesT.length || !bonesT[0].parent || !bonesT[0].parent.isBone) return;
      const d = probe(root, bonesT[0], UP, 0.1, c[c.length - 1]);
      info.tails.push({ bones: bonesT.map(x => x.name), sideSign: d.dot(lat) >= 0 ? 1 : -1 });
    });
    // Gövde nefesi için kökten boyna omurga.
    let s = bones.find(b => !(b.parent && b.parent.isBone));
    while (s && boneChildren(s).length === 1 && info.spine.length < 2) { info.spine.push(s.name); s = boneChildren(s)[0]; }
    if (s && !info.spine.length) info.spine.push(s.name);

    // Eksenleri her kemiğin ebeveyn uzayında önceden hesapla.
    info.axes = {};
    const want = new Set();
    info.legs.forEach(l => { want.add(l.top); l.knee && want.add(l.knee); });
    info.arms.concat(info.wings).forEach(a => a.bones.forEach(n => want.add(n)));
    info.tails.forEach(t => t.bones.forEach(n => want.add(n)));
    info.neck && info.neck.bones.forEach(n => want.add(n));
    info.spine.forEach(n => want.add(n));
    const byName = new Map(bones.map(b => [b.name, b]));
    want.forEach(n => {
      const b = byName.get(n); if (!b || !b.parent) return;
      const pq = new THREE.Quaternion(); b.parent.getWorldQuaternion(pq); pq.invert();
      info.axes[n] = { lat: lat.clone().applyQuaternion(pq).normalize(), fwd: fwd.clone().applyQuaternion(pq).normalize(), up: UP.clone().applyQuaternion(pq).normalize() };
    });
    info.legCount = info.legs.length;
    info.gait = info.legs.length >= 4 ? 'dört' : info.legs.length >= 2 ? 'iki' : 'yok';
    info.legLen = info.legs.length ? info.legs.reduce((s, l) => s + l.len, 0) / info.legs.length : 0.3 * H;
    return info;
  }

  /* Bir örneğe (klon) bağlı animatör. */
  class Animator {
    constructor(root, info) {
      this.root = root; this.info = info; this.phase = Math.random() * 6.28;
      this.map = new Map(); this.rest = new Map();
      collectBones(root).forEach(b => { this.map.set(b.name, b); this.rest.set(b.name, b.quaternion.clone()); });
      this.q = new THREE.Quaternion();
      this.touched = new Set(Object.keys(info.axes || {}));
      this.flap = Math.random() * 6.28;
      this.wave = Math.random() * 6.28;
    }
    rot(name, axisKey, angle) {
      const b = this.map.get(name), ax = this.info.axes[name];
      if (!b || !ax || !angle) return;
      this.q.setFromAxisAngle(ax[axisKey], angle);
      b.quaternion.premultiply(this.q);
    }
    /* s: { speed (m/s, model ölçeğinde), head (0 dik … 1 tamamen aşağı), flying, flapRate, sleep, scale } */
    update(dt, s) {
      const I = this.info;
      this.touched.forEach(n => { const b = this.map.get(n); b && b.quaternion.copy(this.rest.get(n)); });
      const stride = Math.max(I.legLen * 2.2 * (s.scale || 1), 0.05);
      const speed = s.speed || 0;
      this.phase += dt * (speed / stride) * Math.PI * 2;
      const moving = Math.min(1, speed / (0.25 * stride + 1e-6));
      const ph = this.phase, two = Math.PI * 2;
      // Yürüyüş: dörtlüde yanal sıra (LH 0, LF .25, RH .5, RF .75), ikilide karşı faz.
      I.legs.forEach(l => {
        let off;
        if (I.gait === 'dört') off = (l.left ? 0 : 0.5) + (l.front ? 0.25 : 0);
        else off = l.left ? 0 : 0.5;
        const a = ph + off * two;
        const amp = (s.flying ? 0 : 0.42) * moving;
        this.rot(l.top, 'lat', l.swingSign * amp * Math.sin(a));
        if (l.knee) this.rot(l.knee, 'lat', l.kneeSign * (moving * 0.55 * Math.max(0, Math.cos(a)) + (s.flying ? 0.6 : 0) + (s.sleep ? 0.35 : 0)));
      });
      I.arms.forEach(a => {
        const legPh = ph + (a.left ? 0.5 : 0) * two; // kol, aynı taraftaki bacağın tersine
        this.rot(a.bones[0], 'lat', a.swingSign * 0.35 * moving * Math.sin(legPh));
        this.rot(a.bones[0], 'fwd', -a.upSign * (0.9 - 0.1 * Math.sin(this.wave)) * (s.armsDown || 0));
      });
      this.flap += dt * (s.flapRate || 0) * two;
      I.wings.forEach(w => {
        const f = s.flying ? Math.sin(this.flap) * 0.85 + 0.15 : -0.15;
        w.bones.forEach((n, i) => this.rot(n, 'fwd', w.upSign * f * (i ? 0.35 : 1)));
      });
      this.wave += dt * (1.2 + speed * 0.8);
      I.tails.forEach(t => t.bones.forEach((n, i) => this.rot(n, 'up', t.sideSign * 0.18 * Math.sin(this.wave - i * 0.7) * (1 + moving))));
      if (I.neck) {
        const k = I.neck.bones.length;
        const down = (s.head || 0) * 1.1 + (s.sleep ? 0.35 : 0);
        const bob = moving * 0.05 * Math.sin(ph * 2);
        I.neck.bones.forEach((n, i) => this.rot(n, 'lat', I.neck.downSign * (down / k + (i === 0 ? bob : 0))));
      }
      const br = Math.sin(this.wave * (s.sleep ? 0.4 : 1)) * 0.012;
      I.spine.forEach(n => this.rot(n, 'lat', br));
    }
  }

  global.YasamRig = { analyze, Animator, collectBones };
})(window);
