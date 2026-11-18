/* DSAn — Konyaaltı açıklarında tam ekran sinematik deniz denemesi + tekneye özgü deneme raporu.
   Ayrı bir WebGL bağlamı açar, kapanınca tamamen serbest bırakır. Kontroller: duraklat/devam, sonraki çekim, atla (rapor), çık (Esc). */
(function () {
  'use strict';
  const DSAN = window.DSAN = window.DSAN || {};
  const T = (a, b) => DSAN.T(a, b), U = () => DSAN.util;
  const ST = DSAN.seaTrial = { active: false };

  // Su yüksekliği: shader ile aynı dalgalar (tekne yalpası/baş-kıç vurması için)
  function waveH(x, z, t) {
    const w = (dx, dz, k, a, s) => { const l = Math.hypot(dx, dz); return a * Math.sin((dx / l * x + dz / l * z) * k + t * s); };
    return w(1, .3, .055, .42, 1.3) + w(-.4, 1, .11, .2, 1.9) + w(.7, -.8, .23, .08, 2.8) + w(.2, .9, .41, .035, 3.6);
  }

  // ---------- Rapor ----------
  function report(bp, o) {
    const sp = DSAN.vessels.SPECS[bp.id] || DSAN.vessels.SPECS.work_pilot_15, q = o.quality == null ? 85 : o.quality, qf = (q - 80) / 100;
    const fx = o.fx || {}, r = U().rng((o.seed || '') + bp.id + q), j = a => (r() - .5) * 2 * a;
    const top = sp.top * (.975 + qf * .16 + j(.012)), cruise = sp.cruise * (.98 + qf * .1 + j(.01));
    const L = bp.length, turnM = sp.turn * L * (1.06 - qf * .32 + j(.03));
    const s = {
      speed: U().clamp(Math.round(72 + (top / sp.top - 1) * 260 + qf * 35 + j(3)), 35, 99),
      maneuver: U().clamp(Math.round(72 + qf * 70 + (sp.turn < 2.8 ? 6 : 0) + j(4)), 35, 99),
      comfort: U().clamp(Math.round(sp.comfort + qf * 28 + (fx.trialComfort || 0) + j(3)), 30, 99),
      energy: U().clamp(Math.round(64 + qf * 45 + (fx.trialEnergy || 0) + (sp.energy === 'electric' ? 14 : sp.energy === 'hybrid' ? 7 : 0) + j(3)), 30, 99),
      reliability: U().clamp(Math.round(sp.rel + qf * 22 + (fx.trialRel || 0) + j(3) - (q < 74 ? 8 : 0)), 30, 99)
    };
    const overall = Math.round((s.speed + s.maneuver + s.comfort + s.energy + s.reliability) / 5);
    const burn = sp.energy === 'electric' ? +(sp.burn * (1.04 - qf * .15 - (fx.trialEnergy || 0) * .004)).toFixed(1) : Math.round(sp.burn * (1.05 - qf * .16 - (fx.trialEnergy || 0) * .004));
    const unit = sp.energy === 'electric' ? 'kWh/nm' : T('L/sa', 'L/h');
    const noise = Math.round(76 - (s.comfort - 55) * .32);
    const faults = s.reliability < 70 ? T('2 alarm (soğutma, sensör)', '2 alarms (cooling, sensor)') : s.reliability < 82 ? T('1 küçük alarm (sensör)', '1 minor alarm (sensor)') : T('Alarm yok', 'No alarms');
    const fam = DSAN.vessels.family(bp.id).key, cm = [];
    cm.push({ who: T('Deneme kaptanı', 'Trial master'), text: s.speed >= 78 ? T(`Tam yolda ${top.toFixed(1)} knot gördük; sözleşme değerinin üzerinde.`, `We saw ${top.toFixed(1)} kn at full power — above contract.`) : T(`Tam yol ${top.toFixed(1)} knot; hedefe yakın ama pervane ayarı gözden geçirilmeli.`, `Full speed ${top.toFixed(1)} kn; close to target, propeller pitch should be reviewed.`) });
    const famText = {
      interceptor: T('Derin-V gövde dönüşlerde çok kararlı; kısa dalgada sert ama tam kontrol.', 'Deep-V hull is very stable in turns; firm in short chop but fully controlled.'),
      sar: T('Fender kuşağı ve kendini doğrultan yapı ekibe güven veriyor; manevra keskin.', 'Fender collar and self-righting design inspire confidence; manoeuvring is sharp.'),
      waterbus: T(`Neredeyse sessiz: yolcu salonunda ${noise} dB. Sıfır emisyonla şehir hattına hazır.`, `Almost silent: ${noise} dB in the saloon. Zero-emission, ready for city service.`),
      twinaxe: T('Balta pruva dalgayı yarıyor; transfer güvertesinde slamming hissedilmedi.', 'The axe bow slices the waves; no slamming felt on the transfer deck.'),
      patrol: T('Uzun menzilde ekonomik seyir; köprüüstü görüşü mükemmel.', 'Economical long-range cruise; excellent bridge visibility.'),
      yachtsupport: T('Arka güverte ve vinç tender operasyonları için ideal; helipad stabil.', 'Aft deck and crane ideal for tender ops; helideck stable.'),
      seaxplorer: T('Keşif gövdesi açık denizde yumuşak; hibrit modda gece seyri çok sessiz.', 'Explorer hull is soft offshore; very quiet at night in hybrid mode.'),
      xplorer: T('Salonlar sessiz ve titreşimsiz; sahil önünde misafirler için kusursuz bir gösteri.', 'Saloons silent and vibration-free; a flawless show off the coast.')
    };
    cm.push({ who: T('Klas sörveyörü', 'Class surveyor'), text: famText[fam] || famText.interceptor });
    const worst = Object.entries(s).sort((a, b) => a[1] - b[1])[0];
    const worstTxt = { speed: T('Hız', 'Speed'), maneuver: T('Manevra', 'Manoeuvring'), comfort: T('Konfor', 'Comfort'), energy: T('Enerji/yakıt', 'Energy/fuel'), reliability: T('Güvenilirlik', 'Reliability') }[worst[0]];
    cm.push({ who: T('Müşteri temsilcisi', 'Client representative'), text: overall >= 85 ? T('Beklentimizin üzerinde. Teslimata hazırız.', 'Above our expectations. Ready for delivery.') : overall >= 72 ? T(`Genel olarak memnunuz; ${worstTxt.toLowerCase()} tarafında küçük iyileştirmeler bekliyoruz.`, `Generally pleased; we expect small improvements in ${worstTxt.toLowerCase()}.`) : T(`${worstTxt} sonuçları zayıf. Teslim öncesi düzeltme istiyoruz.`, `${worstTxt} results are weak. We want fixes before delivery.`) });
    const costFuel = sp.energy === 'electric' ? 260 : Math.round(sp.burn * .6 * 1.15);
    return { id: U().uid('trial'), day: o.day || 1, bpId: bp.id, model: bp.name, vesselName: o.name || bp.name, uid: o.uid || null, quality: q, scores: s, overall,
      metrics: { top: +top.toFixed(1), cruise: +cruise.toFixed(1), turnM: Math.round(turnM), noise, burn, unit, range: Math.round(sp.range * (.95 + qf * .2)), faults, energy: sp.energy },
      comments: cm, cost: costFuel + 1500 };
  }
  ST.report = report;
  ST.reportHTML = function (rep) {
    const lab = { speed: T('Hız', 'Speed'), maneuver: T('Manevra', 'Manoeuvring'), comfort: T('Konfor', 'Comfort'), energy: T('Enerji/yakıt', 'Energy/fuel'), reliability: T('Güvenilirlik', 'Reliability') };
    const m = rep.metrics, e = U().esc;
    return `<div class="dz-report">
      <div class="dz-rep-top"><div class="dz-score"><b>${rep.overall}</b><small>/100</small></div><div><h4>${e(rep.vesselName)}</h4><p>${e(rep.model)} · ${T('Kalite', 'Quality')} ${rep.quality}/100 · ${T('Gün', 'Day')} ${rep.day}</p></div></div>
      <div class="dz-rep-bars">${Object.keys(lab).map(k => `<div><span>${lab[k]}</span>${DSAN.ui.bar(rep.scores[k], k)}<b>${rep.scores[k]}</b></div>`).join('')}</div>
      <table class="dz-rep-tab"><tr><th>${T('Azami hız', 'Top speed')}</th><td>${m.top} kn</td><th>${T('Seyir hızı', 'Cruise')}</th><td>${m.cruise} kn</td></tr>
        <tr><th>${T('Dönüş dairesi', 'Turning circle')}</th><td>${m.turnM} m</td><th>${T('Salon gürültüsü', 'Saloon noise')}</th><td>${m.noise} dB(A)</td></tr>
        <tr><th>${m.energy === 'electric' ? T('Enerji tüketimi', 'Energy use') : T('Yakıt (seyir)', 'Fuel (cruise)')}</th><td>${m.burn} ${m.unit}</td><th>${T('Menzil', 'Range')}</th><td>${m.range} nm</td></tr>
        <tr><th>${T('Arıza/alarm', 'Faults')}</th><td colspan="3">${e(m.faults)}</td></tr></table>
      <div class="dz-rep-cm">${rep.comments.map(c => `<blockquote><b>${e(c.who)}</b>“${e(c.text)}”</blockquote>`).join('')}</div></div>`;
  };

  // ---------- Sinematik ----------
  const SHOTS = [
    { k: 'wide', t: 0, tr: 'Geniş sahil planı', en: 'Wide coastal shot', cap: ['Limandan çıkış', 'Leaving the harbour'] },
    { k: 'chase', t: .15, tr: 'Takip kamerası', en: 'Chase camera', cap: ['Hızlanma testi', 'Acceleration test'] },
    { k: 'bow', t: .32, tr: 'Pruva yakın çekim', en: 'Bow close-up', cap: ['Tam yol', 'Full speed'] },
    { k: 'stern', t: .45, tr: 'Kıç ve dümen', en: 'Stern & rudder', cap: ['Manevra: zikzak', 'Manoeuvre: zig-zag'] },
    { k: 'drone', t: .58, tr: 'Drone çekimi', en: 'Drone shot', cap: ['Dönüş dairesi', 'Turning circle'] },
    { k: 'pano', t: .78, tr: 'Konyaaltı panoraması', en: 'Konyaaltı panorama', cap: ['Seyir: konfor ve enerji ölçümü', 'Cruise: comfort & energy log'] }
  ];
  function speedProfile(tau) { // 0..1 → tam yol oranı
    if (tau < .08) return .14;
    if (tau < .3) return .14 + (tau - .08) / .22 * .86;
    if (tau < .45) return 1;
    if (tau < .74) return .72;
    return .85;
  }

  ST.start = function (o) {
    if (ST.active) return;
    const bp = o.bp, dur = U().reducedMotion() ? 26 : 50;
    const rep = () => report(bp, { quality: o.quality, fx: o.fx, day: o.day, name: o.name, uid: o.uid, seed: o.uid || o.name });
    let renderer;
    try { if (!window.THREE) throw new Error('no three'); renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { // WebGL yoksa sinematik atlanır, rapor yine üretilir
      o.onExit && o.onExit(rep(), { noWebGL: true }); return;
    }
    ST.active = true; DSAN.emit('seatrial', true);
    const lvl = DSAN.world && DSAN.world.PRESETS[DSAN.world.level] || { pr: 1.5, water: 150 };
    const ov = document.createElement('div'); ov.className = 'dz-trial'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', T('Deniz denemesi', 'Sea trial'));
    ov.innerHTML = `<div class="dz-tr-hud">
        <div class="dz-tr-title"><b>${U().esc(o.name || bp.name)}</b><span>${T('Konyaaltı deniz denemesi', 'Konyaaltı sea trial')}</span></div>
        <div class="dz-tr-shot" aria-live="polite"><span data-shot></span><em data-cap></em></div>
      </div>
      <div class="dz-tr-gauges"><div><small>${T('Hız', 'Speed')}</small><b data-kn>0.0</b><i>kn</i></div><div><small>${T('Dümen', 'Rudder')}</small><span class="dz-rud"><i data-rud></i></span><b data-rdeg>0°</b></div><div><small>${T('Rota', 'Heading')}</small><b data-hdg>000°</b></div></div>
      <div class="dz-tr-ctl">
        <div class="dz-tr-prog"><i data-prog></i>${SHOTS.map(s => `<em style="left:${s.t * 100}%"></em>`).join('')}</div>
        <div class="dz-tr-btns">
          <button data-c="pause" aria-label="${T('Duraklat', 'Pause')}">${DSAN.ui.icon('pause', 18)}<span>${T('Duraklat', 'Pause')}</span></button>
          <button data-c="next">${DSAN.ui.icon('skip', 18)}<span>${T('Sonraki çekim', 'Next shot')}</span></button>
          <button data-c="skip">${DSAN.ui.icon('arrow', 18)}<span>${T('Atla · rapor', 'Skip · report')}</span></button>
          <button data-c="exit" class="dz-tr-exit">${DSAN.ui.icon('exit', 18)}<span>${T('Çık (Esc)', 'Exit (Esc)')}</span></button>
        </div>
        <p class="dz-tr-help">${T('Ekrana dokunarak kontrolleri gizle/göster. Çık: rapor olmadan oyuna döner; Atla: denemeyi tamamlayıp raporu gösterir.', 'Tap the screen to hide/show controls. Exit returns without a report; Skip completes the trial and shows the report.')}</p>
      </div>`;
    ov.prepend(renderer.domElement); renderer.domElement.className = 'dz-tr-canvas';
    document.body.appendChild(ov);
    const prevFocus = document.activeElement;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lvl.pr)); renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // --- Sahne ---
    const scene = new THREE.Scene(), W = DSAN.world;
    const cam = new THREE.PerspectiveCamera(42, 1, .3, 2400);
    const hour = o.hour != null && o.hour >= 7 && o.hour <= 18.5 ? o.hour : 18.6;
    const sun = W.sunFor(hour), e = sun.elev;
    const sky = W.makeSky(); scene.add(sky);
    const water = W.makeWater(Math.round((lvl.water || 150) * 1.1)); water.scale.set(1.6, 1, 1.4); water.position.set(100, -1.2, 0); scene.add(water);
    scene.fog = new THREE.FogExp2(0xb7c9d6, .00042);
    const hemi = new THREE.HemisphereLight('#cfe3f5', '#2b3440', .55); scene.add(hemi);
    const sl = new THREE.DirectionalLight('#fff', 1.4); sl.position.copy(sun.dir).multiplyScalar(300); scene.add(sl);
    const zen = W.pal('zen', e), hor = W.pal('hor', e), sunCol = W.pal('sun', e);
    sky.material.uniforms.uZen.value.copy(zen); sky.material.uniforms.uHor.value.copy(hor); sky.material.uniforms.uSun.value.copy(sun.dir); sky.material.uniforms.uSunCol.value.copy(sunCol);
    const wu = water.material.uniforms; wu.uSunDir.value.copy(sun.dir); wu.uSunCol.value.copy(sunCol); wu.uSky.value.copy(hor).lerp(zen, .3); wu.uDeep.value.copy(W.pal('deep', e)); wu.uShallow.value.copy(W.pal('shallow', e));
    scene.fog.color.copy(hor).lerp(zen, .2); sl.color.copy(sunCol); renderer.toneMappingExposure = 1.05 + .15 * U().clamp(e * 3, 0, 1);
    let pm = null; try { pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(), esk = W.makeSky(), eu = esk.material.uniforms; esk.scale.setScalar(.01); eu.uSunK.value = 0; eu.uZen.value.copy(sky.material.uniforms.uZen.value).multiplyScalar(.55); eu.uHor.value.copy(sky.material.uniforms.uHor.value).multiplyScalar(.55); eu.uSun.value.copy(sun.dir); eu.uSunCol.value.copy(sky.material.uniforms.uSunCol.value).multiplyScalar(.4); es.add(esk); scene.environment = pm.fromScene(es, 0, .1, 100).texture; } catch (err) { pm = null; }

    // Kıyı: kuzeyde (-Z) Konyaaltı plajı, şehir ve palmiyeler; batıda Beydağları; doğuda falezler; batı ucunda liman
    scene.add(W.ridge({ x: -900, z: -150, len: 900, depth: 420, sx: 120, sz: 50, h: 260, f: .006, seed: 5, ry: Math.PI / 2 * .85, taper: true, low: '#465240', mid: '#646660', top: '#a29a8e' }));
    scene.add(W.ridge({ x: -100, z: -620, len: 1600, depth: 420, sx: 160, sz: 40, h: 300, f: .005, seed: 11, taper: true, low: '#465240', mid: '#646660', top: '#a29a8e' }));
    scene.add(W.ridge({ x: -1100, z: 500, len: 1200, depth: 300, sx: 120, sz: 30, h: 200, f: .005, seed: 23, ry: Math.PI / 2 * 1.15, taper: true, low: '#5b6470', mid: '#6f7782', top: '#a9b0b8' }));
    const land = new THREE.Mesh(new THREE.BoxGeometry(2200, 6, 420), new THREE.MeshStandardMaterial({ color: '#7f875f', roughness: .95 })); land.position.set(0, 0, -390); scene.add(land);
    const beach = new THREE.Mesh(new THREE.BoxGeometry(1900, 2, 40), new THREE.MeshStandardMaterial({ color: '#d8cbb0', roughness: .95 })); beach.position.set(100, -.4, -168); scene.add(beach);
    const [wt, we] = W.windowTexture();
    const cm = new THREE.MeshStandardMaterial({ map: wt, emissiveMap: we, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: e < .05 ? 1.2 : 0, roughness: .8 });
    const rr = U().rng('trial-city'), bl = [];
    for (let i = 0; i < 240; i++) { const x = -420 + rr() * 1100, z = -200 - rr() * 120, h = 14 + rr() * 34; bl.push({ x, y: h / 2 + 3, z, sx: 10 + rr() * 9, sy: h, sz: 9 + rr() * 8, ry: (rr() - .5) * .2 }); }
    const city = W.instanced(new THREE.BoxGeometry(1, 1, 1), cm, bl); city.castShadow = false; scene.add(city);
    const palms = []; for (let i = 0; i < 160; i++) palms.push({ x: -400 + i * 7 + rr() * 3, z: -186 - rr() * 6 });
    scene.add(W.instanced(new THREE.CylinderGeometry(.4, .6, 10, 6), new THREE.MeshStandardMaterial({ color: '#7c5a3a', roughness: .9 }), palms.map(p => ({ x: p.x, y: 7, z: p.z }))));
    scene.add(W.instanced(new THREE.ConeGeometry(3.6, 2.4, 7), new THREE.MeshStandardMaterial({ color: '#2f6b3a', roughness: .85, flatShading: true }), palms.map(p => ({ x: p.x, y: 12.5, z: p.z, sy: -1 }))));
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(700, 40, 260), new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: .95, flatShading: true })); cliff.position.set(1050, 10, -260); scene.add(cliff);
    // Liman (başlangıç): mendirek, vinçler, fener
    const rock = new THREE.MeshStandardMaterial({ color: '#7d7a72', roughness: .95, flatShading: true }), rocks = [];
    for (let i = 0; i < 70; i++) rocks.push({ x: -520 + i * 2.6, y: 0, z: 40 + Math.sin(i) * 1.5, sx: 3, sy: 2.5, sz: 3, ry: i });
    for (let i = 0; i < 50; i++) rocks.push({ x: -520 + (rr() - .5) * 3, y: 0, z: -90 + i * 2.6, sx: 3, sy: 2.5, sz: 3, ry: i });
    scene.add(W.instanced(new THREE.DodecahedronGeometry(1, 0), rock, rocks));
    const ft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 14, 12), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: .5 })); ft.position.set(-338, 7, 40); scene.add(ft);
    const ftl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ef4444' })); ftl.position.set(-338, 15, 40); scene.add(ftl);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(2, 40, 2), new THREE.MeshStandardMaterial({ color: '#facc15', roughness: .5 })); c.position.set(-520 + k * 34, 20, -175); scene.add(c); const j = new THREE.Mesh(new THREE.BoxGeometry(46, 1.6, 1.6), c.material); j.position.set(-510 + k * 34, 40, -175); scene.add(j); }

    // Tekne
    const boat = DSAN.vessels.build(bp, 100, { noScaffold: true }); scene.add(boat);
    const L = boat.userData.L, beam = boat.userData.beam, draft = boat.userData.draft;
    // Rota (birim): limandan çıkış → kıyıya paralel doğu → zikzak → dönüş dairesi → seyir
    const route = new THREE.CatmullRomCurve3([[-440, 10], [-400, 60], [-300, 70], [-160, 30], [0, -10], [140, -20], [230, 10], [290, -30], [350, 10], [420, 50], [470, 0], [430, -50], [370, -40], [380, 20], [520, 40], [700, 20], [860, -10]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', .35);
    // Hız profiline göre zaman → yol oranı
    const N = 400, cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + speedProfile(i / N)); const tot = cum[N];
    const sOf = tau => { const f = U().clamp(tau, 0, 1) * N, i = Math.floor(f); return i >= N ? 1 : (cum[i] + (cum[i + 1] - cum[i]) * (f - i)) / tot; };
    const spec = DSAN.vessels.SPECS[bp.id] || { top: 20 };

    // Dalga izi + köpük parçacıkları
    const NP = lvl.pr >= 2 ? 1400 : 900, pPos = new Float32Array(NP * 3), pLife = new Float32Array(NP), pVel = new Float32Array(NP * 2), pAlpha = new Float32Array(NP);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
    const pm2 = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.NormalBlending, uniforms: { uSize: { value: 26 * renderer.getPixelRatio() } },
      vertexShader: 'attribute float alpha; varying float vA; uniform float uSize; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = min(uSize * (1. + (1.-alpha)*1.6) / -mv.z * 10., 48.); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); if (d > .5) discard; gl_FragColor = vec4(vec3(.96,.98,1.), vA * smoothstep(.5, .1, d) * .75); }' });
    const parts = new THREE.Points(pg, pm2); parts.frustumCulled = false; scene.add(parts);
    let pIdx = 0;
    function emit(x, z, vx, vz, life) { const i = pIdx = (pIdx + 1) % NP; pPos[i * 3] = x; pPos[i * 3 + 2] = z; pVel[i * 2] = vx; pVel[i * 2 + 1] = vz; pLife[i] = life; }

    // --- Kontroller ---
    const q = s => ov.querySelector(s);
    let tau = 0, paused = false, done = false, last = performance.now(), shotIdx = -1, hideUI = false, raf = 0, t = 0;
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), prevPos = new THREE.Vector3(), prevHead = { v: 0 };
    function setShot(i) { shotIdx = i; const s = SHOTS[i]; q('[data-shot]').textContent = T(s.tr, s.en); q('[data-cap]').textContent = T(s.cap[0], s.cap[1]); camPos.set(0, 0, 0); camLook.set(0, 0, 0); }
    function finish(withReport) {
      if (done) return; done = true; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', size);
      scene.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material && !(x.material.userData && x.material.userData.shared)) (Array.isArray(x.material) ? x.material : [x.material]).forEach(m => m.dispose()); });
      if (pm) pm.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch (err) {}
      ov.remove(); ST.active = false; DSAN.emit('seatrial', false);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (err) {}
      o.onExit && o.onExit(withReport ? rep() : null, {});
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
      else if (ev.key === ' ' && !ev.target.closest('button')) { ev.preventDefault(); toggle(); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); next(); }
    }
    function toggle() { paused = !paused; const b = q('[data-c=pause]'); b.innerHTML = DSAN.ui.icon(paused ? 'play' : 'pause', 18) + `<span>${paused ? T('Devam', 'Resume') : T('Duraklat', 'Pause')}</span>`; b.setAttribute('aria-label', paused ? T('Devam', 'Resume') : T('Duraklat', 'Pause')); }
    function next() { const n = SHOTS.findIndex(s => s.t > tau + .001); if (n === -1) finish(true); else { tau = SHOTS[n].t; prevPos.set(0, 0, 0); } }
    ov.addEventListener('click', ev => {
      const b = ev.target.closest('[data-c]');
      if (b) { ev.stopPropagation(); const c = b.dataset.c; if (c === 'pause') toggle(); else if (c === 'next') next(); else if (c === 'skip') finish(true); else if (c === 'exit') finish(false); return; }
      if (ev.target === renderer.domElement) { hideUI = !hideUI; ov.classList.toggle('dz-tr-clean', hideUI); }
    });
    document.addEventListener('keydown', onKey, true);
    function size() { const w = ov.clientWidth, h = ov.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 42; cam.updateProjectionMatrix(); }
    window.addEventListener('resize', size); size();
    setTimeout(() => { const b = q('[data-c=pause]'); try { b.focus({ preventScroll: true }); } catch (err) {} }, 50);

    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    function frame(now) {
      if (done) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!paused) { tau += dt / dur; t += dt; }
      if (tau >= 1) { finish(true); return; }
      const si = SHOTS.reduce((a, s, i) => (tau >= s.t ? i : a), 0); if (si !== shotIdx) setShot(si);
      // Tekne konumu ve yönü
      const s = sOf(tau), p = route.getPointAt(s), tg = route.getTangentAt(Math.min(.999, s + .002));
      const head = Math.atan2(tg.x, tg.z);
      let yawRate = 0; { let dh = head - prevHead.v; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; yawRate = dt > 0 && !paused ? dh / dt : 0; prevHead.v = head; }
      const kn = spec.top * speedProfile(tau) * (paused ? 0 : 1);
      const hh = waveH(p.x, p.z, t), hb = waveH(p.x + tg.x * L * .45, p.z + tg.z * L * .45, t), hs = waveH(p.x - tg.x * L * .45, p.z - tg.z * L * .45, t);
      const sizeK = U().clamp(16 / Math.max(6, L), .25, 1.2); // küçük tekne daha çok oynar
      boat.position.set(p.x, -1.2 - draft * .9 + hh * (.6 + sizeK * .4) + speedProfile(tau) * (spec.top > 30 ? draft * .5 : .1), p.z);
      boat.rotation.set(0, 0, 0); boat.rotateY(head);
      boat.rotateX(-(hb - hs) / L * (.8 + sizeK) - speedProfile(tau) * (spec.top > 30 ? .05 : .015));
      boat.rotateZ(U().clamp(-yawRate * speedProfile(tau) * .35, -.18, .18) + Math.sin(t * 1.3) * .015 * sizeK);
      const rud = U().clamp(-yawRate * 1.6, -.6, .6);
      (boat.userData.rudders || []).forEach(r => { r.rotation.y = rud; });
      boat.traverse(x => { if (x.userData && x.userData.spin) x.rotation.y += dt * 3; });
      // Dalga izi: kıçtan V şeklinde, hızla orantılı
      if (!paused) {
        const rate = Math.round(4 + speedProfile(tau) * 14), sternX = p.x - tg.x * L * .5, sternZ = p.z - tg.z * L * .5, nx = tg.z, nz = -tg.x;
        for (let k = 0; k < rate; k++) { const side = k % 2 ? 1 : -1, spd = 2 + speedProfile(tau) * 6; emit(sternX + nx * side * beam * .45 + (Math.random() - .5), sternZ + nz * side * beam * .45 + (Math.random() - .5), nx * side * spd * .5 - tg.x * spd * .2, nz * side * spd * .5 - tg.z * spd * .2, 4 + Math.random() * 3); }
        if (speedProfile(tau) > .6) for (let k = 0; k < 3; k++) { const side = k % 2 ? 1 : -1; emit(p.x + tg.x * L * .45 + nx * side * beam * .3, p.z + tg.z * L * .45 + nz * side * beam * .3, nx * side * 5, nz * side * 5, 1.2); }
      }
      for (let i = 0; i < NP; i++) {
        if (pLife[i] <= 0) { pAlpha[i] = 0; continue; }
        if (!paused) { pLife[i] -= dt; pPos[i * 3] += pVel[i * 2] * dt; pPos[i * 3 + 2] += pVel[i * 2 + 1] * dt; pVel[i * 2] *= .985; pVel[i * 2 + 1] *= .985; }
        pPos[i * 3 + 1] = -1.08 + waveH(pPos[i * 3], pPos[i * 3 + 2], t); pAlpha[i] = U().clamp(pLife[i] / 4, 0, 1);
      }
      pg.attributes.position.needsUpdate = true; pg.attributes.alpha.needsUpdate = true;
      // Kamera çekimleri
      const sh = SHOTS[shotIdx].k, H = boat.userData.height;
      const fw = tmpA.set(tg.x, 0, tg.z).normalize(), side = tmpB.set(fw.z, 0, -fw.x);
      let target = new THREE.Vector3(), look = new THREE.Vector3(p.x, H * .5, p.z), lerpK = .06;
      if (sh === 'wide') { target.set(-170, 9 + L * .15, -140); look.set(p.x, H * .3, p.z); lerpK = 1; }
      else if (sh === 'chase') { target.copy(p).addScaledVector(fw, -L * 1.9 - 10).addScaledVector(up, H * 1.1 + 6); }
      else if (sh === 'bow') { target.copy(p).addScaledVector(fw, L * .95 + 6).addScaledVector(side, beam * 1.4 + 4).addScaledVector(up, H * .35 + 1.2); look.copy(p).addScaledVector(fw, L * .2).setY(H * .3); }
      else if (sh === 'stern') { target.copy(p).addScaledVector(fw, -L * .9 - 5).addScaledVector(side, -beam * 1.1 - 3).addScaledVector(up, 1.6 + H * .15); look.copy(p).addScaledVector(fw, -L * .3).setY(.2); }
      else if (sh === 'drone') { const a = t * .25; target.set(p.x + Math.cos(a) * (L * 2.2 + 25), H * 2.4 + 22, p.z + Math.sin(a) * (L * 2.2 + 25)); lerpK = .12; }
      else { target.copy(p).addScaledVector(side, -(L * 2.6 + 40)).addScaledVector(fw, L * .6).setY(6 + H * .4); look.set(p.x + fw.x * L, H * .6 + 10, p.z - 60); lerpK = .04; }
      if (camPos.lengthSq() === 0 || lerpK === 1) camPos.copy(target); else camPos.lerp(target, lerpK);
      camPos.y = Math.max(camPos.y, -1.2 + waveH(camPos.x, camPos.z, t) + .9);
      camLook.lerp(look, camLook.lengthSq() === 0 ? 1 : .12);
      cam.position.copy(camPos); cam.lookAt(camLook);
      sky.position.copy(cam.position); wu.uTime.value = t;
      // HUD
      q('[data-kn]').textContent = kn.toFixed(1);
      const deg = Math.round(rud / .6 * 35); q('[data-rdeg]').textContent = (deg > 0 ? '+' : '') + deg + '°'; q('[data-rud]').style.transform = `translateX(${deg / 35 * 46}%)`;
      q('[data-hdg]').textContent = String(Math.round(((head * 180 / Math.PI) + 360 + 90) % 360)).padStart(3, '0') + '°';
      q('[data-prog]').style.width = (tau * 100).toFixed(1) + '%';
      renderer.render(scene, cam);
    }
    setShot(0); raf = requestAnimationFrame(frame);
    ST._debug = { get tau() { return tau; }, get paused() { return paused; }, finish, next };
  };
})();
