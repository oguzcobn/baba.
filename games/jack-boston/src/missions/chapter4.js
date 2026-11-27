// BÖLÜM 4: ÖZGÜRLÜK, DEPLASMANLAR VE AMERİKA TURU
import * as THREE from 'three';
import { angDiff } from '../world/population.js';
const IMG = (f) => `assets/scenes/${f}`;
const LEO = { skin: '#f1c9a5', hair: '#b8864a', shirt: '#5a7a4a', pants: '#3a4258', shirtKind: 'hoodie' };
const VINCE = { skin: '#e0c0a0', hair: '#141414', shirt: '#1f1f22', pants: '#1a1a1e', shirtKind: 'jacket' };
const FAN = (c) => ({ skin: ['#f1c9a5', '#e0ac85', '#c68e64', '#8d5a3b'][(Math.random() * 4) | 0], hair: ['#1a1a1a', '#7a5a35', '#c9a36a'][(Math.random() * 3) | 0], shirt: c, pants: '#2f3e5a', shirtKind: 'stripes' });

function prep(R, G, o) {
  const S = R.S; G.loadWorld(o.world); G.story.chapter = 4; G.setSeason(o.season || 'summer'); G.setRain(o.rain ?? 0, true); G.setTime(o.time); G.timeScale = 0; G.ui.day = o.day ?? 6;
  G.lockCar = false; G.police.enabled = !!o.police; G.police.clear(); G.setBonfire(); G.story.hasSimenaPhoto = true;
  if (!G.owned.pistol) { G.owned.pistol = true; G.ammo.pistol9mm = Math.max(G.ammo.pistol9mm, 36); }
  if (R.retry || o.forcePos) { if (G.playerCar) G.exitVehicle(); G.player.x = o.player.x; G.player.z = o.player.z; G.camT.set(G.player.x, 0, G.player.z); }
  G.player.hp = 100; G.player.dead = false; R.retry = false;
}
const goTo = async (R, G, x, z, text, r = 7, car = null) => { const mk = R.marker(x, z); G.ui.setObjective(text); await R.waitUntil(() => R.near(x, z, r) && (!car || (G.playerCar === car && car.speed < 4))); G.removeMarker(mk); G.ui.setObjective(''); };
function nearestFoe(G, p, foes) { let b = null, bd = 1e9; for (const f of foes) { if (f.dead || f.hp <= 0 || f.down) continue; const d = Math.hypot(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; b = f; } } return b; }

function fishing(G) {
  return new Promise(res => {
    G.cutscene = true; const b = document.getElementById('choicebox'); let pos = 0, dir = 1, caught = 0, tries = 0, zone = 0.4 + Math.random() * 0.4, run = true; const fish = ['Gökkuşağı Alabalığı', 'Levrek', 'Turna Balığı', 'Sarı Levrek', 'Kedi Balığı'];
    const draw = () => { b.innerHTML = `<h2>Balık Tutma</h2><p>Çizgi yeşil bölgedeyken <b>Boşluk</b>'a bas. Yakalanan: ${caught}/3 · Deneme ${tries}</p><div style="position:relative;width:420px;height:26px;background:#20303a;border-radius:13px;margin:12px auto;overflow:hidden"><div style="position:absolute;left:${(zone - 0.09) * 100}%;width:18%;top:0;bottom:0;background:#3f9a5a"></div><div id="fneedle" style="position:absolute;left:${pos * 100}%;width:4px;top:0;bottom:0;background:#ffd34d"></div></div><small>3 balık yakala</small>`; };
    const kf = (e) => { if (e.key !== ' ') return; e.preventDefault(); tries++; if (Math.abs(pos - zone) < 0.09) { caught++; G.audio.pickup(); G.ui.toast('🐟 ' + fish[(Math.random() * fish.length) | 0] + ' yakaladın!', 'good'); zone = 0.15 + Math.random() * 0.7; } else G.audio.tone({ f0: 300, f1: 200, dur: 0.1, gain: 0.1 }); if (caught >= 3) { run = false; removeEventListener('keydown', kf); b.classList.remove('show'); G.cutscene = false; res(); } else draw(); };
    const tick = () => { if (!run) return; pos += dir * 0.012 * (1 + caught * 0.4); if (pos > 1 || pos < 0) dir *= -1; const n = document.getElementById('fneedle'); if (n) n.style.left = pos * 100 + '%'; requestAnimationFrame(tick); };
    addEventListener('keydown', kf); draw(); b.classList.add('show'); requestAnimationFrame(tick);
    if (G.ui.skipAll) { run = false; removeEventListener('keydown', kf); b.classList.remove('show'); G.cutscene = false; res(); }
  });
}

export const chapter4 = {
  num: 4, title: 'Özgürlük, Deplasmanlar ve Amerika Turu', sub: 'Üniversite 3. yıl. Hayatının en çılgın, en özgür yılı.',
  missions: [
    // ---------------------------------------------------------- G1 Deplasman
    { id: 'ch4_m01_deplasman', title: 'Deplasman Maçı',
      setup: (R, G) => { prep(R, G, { world: 'away', time: 18.6, season: 'autumn', forcePos: true, player: { x: -150, z: 300 } }); },
      async run(R, G, S) {
        const L = G.world.L; await G.ui.fade(2.4, 'Philadelphia — Deplasman<br><small>Leo, Danny ve Mike ile 5 saatlik otobüs yolculuğu.</small>');
        const crew = [['Leo', LEO], ['Danny', FAN('#2f5a9a')], ['Mike', FAN('#2f5a9a')]].map(([n, lk], k) => { const a = R.spawn({ name: n, look: lk, role: 'ally', x: G.player.x + 2 + k * 1.5, z: G.player.z + 1.5, hp: 400 }); a.nonLethal = true; a.noTalk = true; return a; });
        for (const a of crew) a.ai = (dt) => { const d = Math.hypot(G.player.x - a.x, G.player.z - a.z); if (d > 3) a.move(G.player.x - a.x, G.player.z - a.z, d > 8 ? 6 : 4.5, dt); else a.move(0, 0, 0, dt); };
        G.ui.toast('Taraftar grubun seni izliyor. Stadyuma birlikte yürüyün.');
        await goTo(R, G, L.awayGate.x, L.awayGate.z, '<b>Stadyum kapısı</b>\'na git', 8);
        await G.ui.cinematic({ image: IMG('ch4_01_away_match.jpg'), title: 'Bölüm 4 · Görev 1 — Deplasman Maçı', mood: 'night_rain', lines: [
          ['Leo', 'DUYUYOR MUSUN?! Elli bin kişi bize ıslık çalıyor ve biz yine de en yüksek sesiz!'],
          ['Jack', '(bağırarak) Oakridge\'de cuma maçlarında en fazla iki yüz kişi olurdu!'],
          ['Danny', 'Son dakika golü! 2-1! İnanmıyorum!'],
          ['Anlatıcı', 'Atkılar havada, sesler kısık. Jack o gece yıllardır ilk kez hiçbir şeyi düşünmeden bağırdı.'],
        ] });
        await G.ui.fade(1.4, 'Maç bitti — 2:1 kazandık!<br><small>Ama stadyum çıkışında ev sahibi taraftarlar bekliyor…</small>');
        const gx = L.awayGate.x, gz = L.awayGate.z - 10; G.player.x = gx; G.player.z = gz; crew.forEach((a, k) => { a.x = gx + 2 + k * 1.2; a.z = gz + 1; });
        const rivals = []; for (let k = 0; k < 8; k++) { const f = R.spawn({ x: gx - 12 + (k % 4) * 6, z: gz - 18 - (k > 3 ? 4 : 0), role: 'gang', look: FAN('#9a2f2f'), hp: 55, weapon: k === 2 || k === 6 ? 'bat' : 'fists' }); f.nonLethal = true; f.dmgMul = 0.55; f.blip = '#ff5050'; rivals.push(f); }
        rivals[0].say('Hey! Mavi atkılılar! Buradan sağ çıkamazsınız!', 3);
        for (const f of rivals) f.ai = (dt) => { const t = nearestFoe(G, f, [G.player, ...crew]) || G.player; f.target = t; G.pop.updateFighter(f, dt, t); };
        for (const a of crew) a.ai = (dt) => { const t = nearestFoe(G, a, rivals); if (t) { a.target = t; G.pop.updateFighter(a, dt, t, { speed: 5.5 }); } else a.move(0, 0, 0, dt); };
        G.ui.setObjective('Rakip taraftarlarla meydan kavgası! Arkadaşlarınla birlikte <b>8 kişiyi</b> dağıt');
        await R.waitUntil(() => rivals.filter(f => f.hp <= 0).length >= 8);
        G.tokens.clear(); G.ui.setObjective('');
        await G.ui.subtitle('Leo', 'Siren! Polis kordon kuruyor — OTOBÜSE!', 2.4);
        G.police.enabled = true; G.police.stars = 0; G.police.crime('murder', G.player.x, G.player.z);
        for (const a of crew) a.ai = (dt) => { const d = Math.hypot(L.busStop.x - a.x, L.busStop.z - a.z); if (d > 2) a.move(L.busStop.x - a.x, L.busStop.z - a.z, 6.5, dt); else a.move(0, 0, 0, dt); };
        await goTo(R, G, L.busStop.x, L.busStop.z, 'Polis kordonundan kaç! <b>Deplasman otobüsüne</b> ulaş (güneybatı)', 7);
        G.police.clear(); G.police.enabled = false; await G.ui.fade(2.2, 'Otobüs gece yarısı kalktı.<br><small>Leo\'nun gözü morarmıştı ama durmadan gülüyordu.</small>');
        (G.story.memories ||= []).push('🧣 Philadelphia deplasman atkısı');
      } },
    // ---------------------------------------------------------- G2 Amerika turu ve kamp
    { id: 'ch4_m02_kamp', title: 'Amerika Turu ve Kamp',
      setup: (R, G) => { prep(R, G, { world: 'camp', time: 16.8, season: 'summer', forcePos: true, player: { x: 3.5, z: 318 } }); },
      async run(R, G, S) {
        const L = G.world.L; await G.ui.fade(2.6, 'Yaz — Amerika Turu<br><small>Leo ile bir SUV, iki uyku tulumu ve 3.000 kilometre.</small>');
        const suv = R.car({ kind: 'suv', color: '#4a5a3a', x: 3.5, z: 316, a: Math.PI }); S.suv = suv; G.enterVehicle(suv);
        const leo = R.spawn({ name: 'Leo', look: LEO, role: 'ally', x: 0, z: 0, hp: 400 }); leo.nonLethal = true; leo.noTalk = true; R.board(leo, suv);
        G.ui.lines([['Leo', 'Sağda bir bar var. "Rusty Spur". Kovboy şapkası takan birini görmeden bu turu bitiremeyiz!']]);
        await goTo(R, G, L.saloon.x + 18, L.saloon.z, '<b>Yol üstü bar</b>\'da mola ver', 9, suv);
        G.ui.setObjective('Arabadan in'); await R.waitUntil(() => !G.playerCar); R.unboard(leo, suv, -1);
        await G.ui.lines([['Leo', '(birasını yanlışlıkla iri bir adamın şapkasına döker) …Ups.'], ['Yerli', 'Şehirli çocuklar, ha? Dışarı çıkalım bakalım!']]);
        const locals = [0, 1, 2].map(k => { const f = R.spawn({ x: L.saloon.x - 2 + k * 2, z: L.saloon.z + 3, role: 'gang', look: { skin: '#e0ac85', hair: '#7a5a35', shirt: ['#8e3a2f', '#5a4a3a', '#3a5a6a'][k], pants: '#3a4a66', shirtKind: 'stripes', beard: true }, hp: 60 }); f.nonLethal = true; f.dmgMul = 0.6; f.blip = '#ff5050'; return f; });
        leo.ai = (dt) => { const t = nearestFoe(G, leo, locals); if (t) { leo.target = t; G.pop.updateFighter(leo, dt, t); } else leo.move(0, 0, 0, dt); };
        for (const f of locals) f.ai = (dt) => { const t = nearestFoe(G, f, [G.player, leo]) || G.player; f.target = t; G.pop.updateFighter(f, dt, t); };
        G.ui.setObjective('Bar kavgası! Üç yerliyi yere ser');
        await R.waitUntil(() => locals.every(f => f.hp <= 0)); G.tokens.clear();
        await G.ui.subtitle('Leo', '(burnunu silerek) En iyi tatil. Kampa gidelim, kimse peşimizden gelmeden!', 2.6);
        leo.ai = null; R.board(leo, suv);
        await goTo(R, G, L.parking.x, L.parking.z, '<b>Ulusal park kamp alanı</b>na sür (kuzey)', 9, suv);
        G.ui.setObjective('Arabadan in'); await R.waitUntil(() => !G.playerCar); R.unboard(leo, suv, -1);
        leo.ai = (dt) => { const d = Math.hypot(G.player.x - leo.x, G.player.z - leo.z); if (d > 3) leo.move(G.player.x - leo.x, G.player.z - leo.z, 4.5, dt); else leo.move(0, 0, 0, dt); };
        const cs = L.campSpot;
        await R.interactAt(() => cs, '[E] Çadırı kur', 4);
        const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.2, 4), new THREE.MeshLambertMaterial({ color: 0xd9a03a })); tent.position.set(cs.x + 4, 1.1, cs.z - 3); tent.rotation.y = Math.PI / 4; tent.castShadow = true; G.scene.add(tent); R.onCleanup = () => G.scene.remove(tent); G.world.statics.add({ type: 'circle', x: cs.x + 4, z: cs.z - 3, r: 1.8 });
        G.ui.toast('⛺ Çadır kuruldu.'); G.setTime(19.2);
        await R.interactAt(() => ({ x: cs.x, z: cs.z }), '[E] Kamp ateşini yak', 3);
        G.setBonfire(cs.x, cs.z); G.audio.pickup();
        await goTo(R, G, L.dock.x, L.dock.z, '<b>İskele</b>\'de balık tut', 3);
        await fishing(G);
        G.setTime(22.3); await G.ui.fade(2, 'Gece — milyonlarca yıldız<br><small>Leo çadırda horluyor. Ateş hâlâ çıtırdıyor.</small>');
        G.player.x = cs.x + 1.5; G.player.z = cs.z + 1.2; leo.ai = null; leo.x = cs.x + 4; leo.z = cs.z - 1.5; leo.state = 'sit';
        let looked = false; G.onPolaroid = () => { looked = true; };
        G.ui.setObjective('Ateşin başında, yıldızların altında fotoğrafa bak <b>[P]</b>');
        await R.waitUntil(() => looked || G.ui.skipAll); G.onPolaroid = null; await R.waitUntil(() => !G.cutscene);
        await G.ui.cinematic({ image: IMG('ch4_02_campfire_photo.jpg'), title: 'Bölüm 4 · Görev 2 — Yıldızların Altında', mood: 'summer_bonfire', lines: [
          ['Jack', '(içinden) Üç yıl oldu Simena. Burada da bir ateş var… ama yanımda sen yoksun.'],
          ['Jack', '(içinden) Deplasmanlar, kavgalar, Leo\'nun saçmalıkları… Hepsi güzel. Ama bazen hepsi bir kaçış gibi.'],
          ['Anlatıcı', 'Fotoğrafın köşesi artık yıpranmıştı. Jack onu dikkatle cüzdanına geri koydu ve uzun süre yıldızlara baktı.'],
        ] });
        (G.story.memories ||= []).push('🏕 Ulusal park kamp feneri');
        G.ui.setObjective('');
      } },
    // ---------------------------------------------------------- G3 Vince ile büyük hesaplaşma
    { id: 'ch4_m03_hesaplasma', title: 'Vince ile Büyük Hesaplaşma',
      setup: (R, G) => { prep(R, G, { world: 'boston', time: 23.2, rain: 0.7, season: 'autumn', forcePos: true, player: { x: -240, z: 170 } }); },
      async run(R, G, S) {
        const L = G.world.L;
        await G.ui.fade(2.4, 'Boston\'a dönüş — Gece 23:10<br><small>Leo iki gündür telefonlara çıkmıyor.</small>');
        if (!S.sedan || !G.vehicles.includes(S.sedan)) { S.sedan = R.car({ kind: 'sedan', color: '#27355B', x: -255, z: 165, a: Math.PI / 2 }); S.sedan.isSedan = true; }
        G.audio.phone(); await G.ui.lines([['Vince', '(telefonda) Arkadaşın Leo bana çok borçlandı, Jack. Ve çok konuştu. Limandaki depoma gel. Yalnız.'], ['Jack', 'Ona bir şey olursa…'], ['Vince', 'O zaman acele et.']]);
        G.ammo.pistol9mm = Math.max(G.ammo.pistol9mm, 60); if (G.owned.shotgun) G.ammo.shotgun = Math.max(G.ammo.shotgun, 18);
        G.ui.toast('Mermi: 9mm ' + G.ammo.pistol9mm + (G.owned.shotgun ? ' · Pompalı ' + G.ammo.shotgun : '') + ' — silah dükkânından takviye alabilirsin.');
        await goTo(R, G, L.vinceDepot.x, L.vinceDepot.z + 24, '<b>Liman — Vince\'in deposu</b>na git', 10);
        if (G.playerCar) { G.ui.setObjective('Arabadan in — siper al <b>[C]</b>'); await R.waitUntil(() => !G.playerCar); }
        const dx = L.vinceDepot.x, dz = L.vinceDepot.z; const foes = [];
        const spots = [[-14, -4], [-8, -10], [0, -6], [8, -10], [14, -4], [-20, 6], [20, 6], [0, -16], [-26, -12], [26, -12]];
        for (const [ox, oz] of spots) { const f = R.spawn({ x: dx + ox, z: dz + oz, role: 'gang', look: { skin: '#e0c0a0', hair: '#1a1a1a', shirt: '#1f1f22', pants: '#1a1a1e', shirtKind: 'jacket' }, weapon: Math.random() < 0.25 ? 'shotgun' : 'pistol', hp: 80 }); f.target = G.player; f.dmgMul = 0.6; f.blip = '#ff4040'; foes.push(f); }
        const vince = R.spawn({ name: 'Vince', look: VINCE, role: 'story', x: dx, z: dz - 3 }); vince.invuln = true; vince.noTalk = true; vince.ai = (dt) => { vince.move(0, 0, 0, dt); vince.faceTo(Math.atan2(G.player.x - vince.x, G.player.z - vince.z), dt); };
        const leo = R.spawn({ name: 'Leo', look: LEO, role: 'story', x: dx + 3, z: dz - 2 }); leo.invuln = true; leo.noTalk = true; leo.state = 'sit';
        vince.say('Yalnız gel dedim, değil mi? …Öldürün onu!', 3);
        G.ui.setObjective('Vince\'in adamlarını temizle! (Siper: C · Nişan: sağ tık · Silahlar: 1-5)');
        await R.wait(1.2); vince.ai = (dt) => { const tx = dx + 40, tz = dz - 30; vince.move(tx - vince.x, tz - vince.z, 6, dt); };
        const vcar = R.car({ kind: 'muscle', color: '#141416', x: dx + 44, z: dz - 34, a: 0 });
        await R.waitUntil(() => foes.every(f => f.dead));
        G.ui.setObjective(''); leo.state = 'idle'; await G.ui.subtitle('Leo', 'Jack! Vince arkadan kaçıyor — siyah arabaya bindi!', 2.4);
        R.despawn(vince); const vd = R.spawn({ name: 'Vince', look: VINCE, role: 'story', x: vcar.x, z: vcar.z }); vd.vehicle = vcar; vcar.driver = vd; vcar.persistent = true;
        let route = null, ri = 0, rep = 0;
        vcar.ai = { type: 'flee', fn: (dt) => { if (vcar.broken || vcar.hp < 38) { vcar.in.throttle = 0; vcar.in.brake = 1; vcar.in.steer = 0; return; } rep -= dt; if (rep <= 0 || !route) { const pp = G.playerPos(); const far = G.world.nodes.slice().sort((a, b) => Math.hypot(b.x - pp.x, b.z - pp.z) - Math.hypot(a.x - pp.x, a.z - pp.z))[(Math.random() * 4) | 0]; route = G.police.routeTo(vcar, far.x, far.z); ri = 0; rep = 6; } while (route[ri] && Math.hypot(route[ri].x - vcar.x, route[ri].z - vcar.z) < 12) ri++; const n = route[ri]; if (n) G.pop.driveTo(vcar, n.x, n.z, 27, dt, false); } };
        if (G.vehicles.includes(S.sedan) && Math.hypot(S.sedan.x - G.player.x, S.sedan.z - G.player.z) > 40) { S.sedan.x = G.player.x + 6; S.sedan.z = G.player.z + 6; S.sedan.vx = S.sedan.vz = 0; }
        vd.blip = '#ff2020';
        G.ui.setObjective('<b>Vince</b>\'i durdur! Bir araca bin ve onun arabasına çarparak durdur');
        let lost = 0; await R.waitUntil(() => { const d = Math.hypot(vcar.x - G.player.x, vcar.z - G.player.z); lost = d > 260 ? lost + R.dt : 0; if (lost > 12) R.fail('Vince kaçtı.'); return vcar.hp < 38 || vcar.broken; });
        vcar.ai = null; G.ui.setObjective('Arabadan in ve Vince\'e yaklaş'); vd.blip = null;
        await R.waitUntil(() => !G.playerCar && Math.hypot(vcar.x - G.player.x, vcar.z - G.player.z) < 10);
        R.unboard(vd, vcar, -1); vcar.driver = null;
        await G.ui.cinematic({ image: IMG('ch4_03_harbor_showdown.jpg'), title: 'Bölüm 4 · Görev 3 — Son Hesaplaşma', mood: 'night_rain', lines: [
          ['Vince', '(yaralı, yere çöker) Hah… Oakridge\'li çocuk. Sana bu şehri ben öğrettim, biliyor musun?'],
          ['Jack', 'Sen bana sadece neyi kaybedebileceğimi öğrettin.'],
          ['Vince', 'Hadi. Bitir. Benim dünyamda böyle biter zaten.'],
          ['Anlatıcı', 'Uzakta sirenler. Yağmur, tabancanın namlusundan damlıyor. Leo nefes nefese arkada duruyor.'],
        ] });
        const c = await G.ui.choice('Vince\'in kaderi:', ['İnfaz et — bu iş burada bitsin', 'Polise bırak ve kaç — artık bu dünyadan çıkıyorsun']);
        G.story.choices.vinceFate = c === 0 ? 'executed' : 'police';
        if (c === 0) { G.combat.fire(G.player, vd.x - G.player.x, vd.z - G.player.z); vd.invuln = false; G.combat.damagePed(vd, null, 300, 0, 1, 'bullet'); G.story.streetRep += 20; await G.ui.fade(2.6, 'Silah sesi limanda yankılandı.<br><small>Jack o gece Polaroid\'e bakamadı.</small>'); }
        else { G.story.peaceRep += 20; vd.state = 'idle'; await G.ui.subtitle('Jack', 'Polis seni bulsun Vince. Ben buradan çıkıyorum.', 2.6); G.police.enabled = true; G.police.stars = 0; G.police.crime('shooting', G.player.x, G.player.z); G.police.stars = 2; G.ui.setObjective('Polis geliyor — <b>kaç!</b> Aranma seviyesini düşür (polis arabalarını kaza yaptır)'); await R.waitUntil(() => G.police.stars === 0); }
        G.ui.setObjective(''); G.police.clear(); await G.ui.subtitle('Leo', 'Bitti mi Jack? Gerçekten bitti mi?', 2.4); await G.ui.subtitle('Jack', 'Bitti. Yeraltıyla bütün bağlar koptu.', 2.6);
      } },
  ],
  async onComplete(R, G) {
    const dark = G.story.choices.vinceFate === 'executed';
    await G.ui.chapterCard(4, 'Tamamlandı', dark ? 'Jack kazandı ama içinde bir şey karardı. Son yıl, sessizliği seçti.' : 'Sirenler uzaklaştı. Jack ilk kez Boston\'da huzurlu bir sabah gördü.');
    G.story.chapter = 5; G.save({ chapter: 5, mission: 0 }); R.cleanup([]); G.loadWorld('boston'); G.timeScale = 0.02;
    G.ui.toast('Bölüm 5: Durulma, Elena ve Final — yakında. Serbest dolaşım açık.', 'good');
  },
};
