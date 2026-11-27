// BÖLÜM 2: SESSİZ BİR YIL VE SİMENA — 5 görev (Sonbahar -> Kış -> Yaz)
import * as THREE from 'three';
import { headlightConeTex } from '../engine/textures.js';

const IMG = (f) => `assets/scenes/${f}`;
const SIMENA = { skin: '#f4d2b8', hair: '#3a2618', shirt: '#4f7a46', pants: '#3a4258', shirtKind: 'shirt' };
const THUG = () => ({ skin: ['#f1c9a5', '#e0ac85', '#c68e64'][(Math.random() * 3) | 0], hair: '#1a1a1a', shirt: ['#3a3a40', '#4a3a30', '#2f3a40'][(Math.random() * 3) | 0], pants: '#23232a', shirtKind: 'hoodie' });

function prep(R, G, o) {
  G.loadWorld('oakridge');
  const S = R.S, L = G.world.L;
  G.setSeason(o.season); G.setRain(o.rain ?? 0, true); G.setTime(o.time); G.ui.day = o.day ?? 3; G.timeScale = 0;
  G.lockCar = false; G.police.enabled = true; G.setBonfire();
  if (!S.sedan || !G.vehicles.includes(S.sedan)) { S.sedan = R.car({ kind: 'sedan', color: '#27355B', x: L.garage.x, z: L.garage.z - 0.5, a: 0 }); S.sedan.isSedan = true; }
  if (R.retry || o.forcePos) { if (G.playerCar) G.exitVehicle(); G.player.x = o.player.x; G.player.z = o.player.z; G.player.a = 0; }
  G.player.hp = 100; G.player.dead = false; if (G.player.weapon !== 'fists') G.player.setWeaponMesh('fists');
  R.failIf(() => S.sedan && S.sedan.exploded, 'Jack\'in sedanı patladı.');
  R.retry = false;
}
function simena(R, G, x, z) { const S = R.S; if (!S.simena || !G.peds.includes(S.simena)) S.simena = R.spawn({ name: 'Simena', look: SIMENA, female: true, role: 'story', x, z }); else { if (S.simena.vehicle) R.unboard(S.simena, S.simena.vehicle); S.simena.x = x; S.simena.z = z; } return S.simena; }

async function goTo(R, G, x, z, text, r = 6, needCar = false) {
  const mk = R.marker(x, z); G.ui.setObjective(text);
  await R.waitUntil(() => R.near(x, z, r) && (!needCar || (G.playerCar === R.S.sedan && R.S.sedan.speed < 3.5)) && (needCar || !G.playerCar || R.near(x, z, r)));
  G.removeMarker(mk); G.ui.setObjective('');
}

export const chapter2 = {
  num: 2, title: 'Sessiz Bir Yıl ve Simena', sub: '17 yaşındasın. Kabuğuna çekildin, gözün sadece Boston\'da… ta ki onu görene kadar.',
  missions: [
    // ---------------------------------------------------------- G1 Kütüphane Penceresi
    { id: 'ch2_m01_kutuphane', title: 'Kütüphane Penceresi',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { season: 'autumn', rain: 0.45, time: 15.5, day: 2, forcePos: true, player: { x: L.jackHome.x, z: L.jackHome.z + 1 } }); },
      async run(R, G, S) {
        const L = G.world.L;
        await G.ui.fade(2.4, 'Ekim — Sonbahar<br><small>Jack aylardır kimseyle konuşmuyor. Tek hedefi: Boston.</small>');
        G.ui.toast('Sedanın lastikleri yenilendi.', '');
        await goTo(R, G, L.library.x, L.library.z + 2, '<b>Kütüphane</b>\'ye git ve sınavlara çalış (kuzey)', 7);
        if (G.playerCar) G.exitVehicle();
        await G.ui.fade(1);
        await G.ui.cinematic({ image: IMG('ch2_01_library_simena.jpg'), title: 'Bölüm 2 · Görev 1 — Kütüphane Penceresi', mood: 'autumn_rain', lines: [
          ['Anlatıcı', 'Yağmurlu bir ekim öğleden sonrası. Jack türev formüllerine gömülmüş, Boston\'ı düşünüyor.'],
          ['Anlatıcı', 'Sonra camın önündeki masada onu fark eder: kulaklıklı, yeşil hırkalı, çizim defterine eğilmiş bir kız.'],
          ['Jack', '(içinden) …Kim bu? Hiç görmedim onu. Kalemini tutuşu bile… sakin.'],
          ['Anlatıcı', 'Kızın adı Simena. Ailesinin sahil yolunda küçük bir kitapçısı var: Simena Books.'],
          ['Jack', '(içinden) Git konuş. Bir "merhaba" de. …Hayır. Jeanine\'den sonra değil. Henüz değil.'],
          ['Anlatıcı', 'Jack o gün tek kelime edemedi. Ne o gün, ne ertesi hafta… tam bir yıl boyunca.'],
        ] });
        G.ui.toast('Simena\'yı haritada izleyemezsin — ama onu kimsenin üzmesine de izin vermeyeceksin.', '');
      } },
    // ---------------------------------------------------------- G2 Kitapçı baskını
    { id: 'ch2_m02_kitapci', title: 'Gizli Destek: Kitapçı Baskını',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { season: 'autumn', rain: 0.7, time: 22.6, day: 4, forcePos: true, player: { x: L.jackHome.x, z: L.jackHome.z + 1 } }); },
      async run(R, G, S) {
        const L = G.world.L; const door = { x: L.books.x, z: 230.5 };
        await G.ui.fade(2.2, 'Kasım — Gece 22:40<br><small>Marcus\'tan bir mesaj: "Sahildeki kitapçıya serseriler dadanmış…"</small>');
        await G.ui.lines([['Marcus', '(mesaj) Simena Books\'un camlarını tekmeliyorlarmış. Kızın babası yaşlı adam, polise de güvenmiyor.'], ['Jack', '(içinden) Simena\'nın kitapçısı… Kimse bilmeyecek. Sadece gidip bakacağım.']]);
        const thugs = [];
        for (let k = 0; k < 3; k++) { const t = R.spawn({ x: door.x - 3 + k * 3, z: door.z + 2.5, role: 'story', look: THUG(), weapon: k === 1 ? 'bat' : 'fists', hp: 60 }); t.state = 'idle'; t.noTalk = true; t.ai = (dt) => { t.move(0, 0, 0, dt); t.a = Math.PI; if (Math.random() < dt * 0.6) G.fx.sparks(door.x + (Math.random() - .5) * 6, 1.5, door.z - 0.3, 3, 0, -1, [0.9, 0.95, 1]); }; thugs.push(t); }
        thugs[0].say('Yaşlı adam kapıyı açmıyor!', 3);
        await goTo(R, G, door.x, door.z + 7, '<b>Simena Books</b>\'a git (güney, sahil yolu)', 12);
        if (G.playerCar) G.ui.setObjective('Arabadan in <b>[F]</b>');
        await R.waitUntil(() => !G.playerCar);
        thugs[1].say('Ne bakıyorsun? Yürü git!', 2.5); G.player.say('Dükkândan uzak durun.', 2);
        for (const t of thugs) { t.role = 'gang'; t.fighter = true; t.nonLethal = true; t.dmgMul = 0.55; t.target = G.player; t.blip = '#ff5050'; t.ai = (dt) => G.pop.updateFighter(t, dt, G.player, { speed: 5.4 }); }
        G.ui.setObjective('Üç serseriyi etkisiz hâle getir (yumruk — Sol tık / Q)');
        await R.waitUntil(() => thugs.every(t => t.hp <= 0));
        G.tokens.clear(); G.ui.setObjective('');
        await G.ui.subtitle('Serseri', '(yerde inleyerek) Tamam, tamam! Gidiyoruz…', 2);
        for (const t of thugs) { t.ai = null; t.getUpT = 1.5; t.nonLethal = false; t.hp = 40; t.blip = null; setTimeout(() => { if (!t.dead) { t.down = false; t.root.rotation.set(0, 0, 0); t.root.position.y = 0; t.role = 'story'; R.walkTo(t, door.x + 60, 160, 6.5).catch(() => { }); setTimeout(() => R.despawn(t), 7000); } }, 1600); }
        // gizli kalmak: ışık yanar, fark edilmeden uzaklaş
        await R.wait(1.2);
        G.ui.subtitle('Ses', '(dükkânın içinden) Kim var orada? Simena, kızım, sen yukarıda kal!', 3);
        let t = 0; G.ui.setObjective('Fark edilmeden uzaklaş! Kapıdan <b>35 m</b> uzağa git');
        await R.waitUntil(() => { t += R.dt; G.ui.meter(Math.min(1, t / 12), 'KAPI AÇILIYOR'); if (t > 12) { G.ui.meter(null); R.fail('Simena\'nın babası seni gördü. Destek gizli kalmalıydı.'); } return Math.hypot(G.player.x - door.x, G.player.z - door.z) > 35; });
        G.ui.meter(null); G.ui.setObjective(''); G.ui.toast('Kimse kim olduğunu bilmiyor. Böyle olması daha iyi.', 'good');
        G.story.peaceRep += 3;
      } },
    // ---------------------------------------------------------- G3 Kayıp çizim defteri
    { id: 'ch2_m03_defter', title: 'Gizli Destek: Kayıp Çizim Defteri',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { season: 'winter', rain: 0.5, time: 23.2, day: 1, forcePos: true, player: { x: L.jackHome.x, z: L.jackHome.z + 1 } }); },
      async run(R, G, S) {
        const L = G.world.L;
        await G.ui.fade(2.4, 'Ocak — Kış<br><small>Kütüphanede Simena arkadaşına anlatıyordu: "Çizim defterimi otobüste unuttum… bütün yılım içindeydi."</small>');
        await G.ui.subtitle('Jack', '(içinden) Otobüsler gece doğudaki depoda kalıyor. Bekçi var ama… o defter bulunmalı.', 3.2);
        // bekçi devriyesi
        const route = [[168, 100], [214, 100], [214, 132], [168, 132]]; let wi = 0;
        const guard = R.spawn({ x: 168, z: 100, role: 'story', look: { skin: '#c68e64', hair: '#5a5a5a', shirt: '#2b3a5c', pants: '#1f2a40', shirtKind: 'police', beard: true }, name: 'Bekçi' }); guard.noTalk = true;
        const cone = new THREE.Mesh(new THREE.PlaneGeometry(9, 15), new THREE.MeshBasicMaterial({ map: headlightConeTex(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff2c0 }));
        cone.rotation.x = -Math.PI / 2; cone.rotation.z = Math.PI; cone.position.set(0, 0.15, 7.5); guard.mesh.add(cone);
        let pause = 0, alert = 0;
        guard.ai = (dt) => {
          if (pause > 0) { pause -= dt; guard.move(0, 0, 0, dt); guard.a += Math.sin(performance.now() / 600) * dt * 0.8; return; }
          const [tx, tz] = route[wi]; if (Math.hypot(tx - guard.x, tz - guard.z) < 1) { wi = (wi + 1) % route.length; pause = 2.2; return; }
          guard.move(tx - guard.x, tz - guard.z, 1.5, dt);
        };
        const seesPlayer = () => {
          const p = G.player; if (G.playerCar) return 0; const dx = p.x - guard.x, dz = p.z - guard.z, d = Math.hypot(dx, dz);
          if (d < 2.2) return 3;
          if (d > 15) return 0; const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - guard.a), Math.cos(Math.atan2(dx, dz) - guard.a)));
          if (ang > 0.42) return (p.speed > 6 && d < 7) ? 0.6 : 0;
          if (G.world.statics.raycast(guard.x, guard.z, dx / d, dz / d, d) < d - 0.6) return 0;
          return 1.6 * (1 - d / 18) + 0.4;
        };
        R.failIf(() => alert >= 1, 'Bekçi seni fark etti! Depodan atıldın.');
        const watch = R.waitUntil(() => { const s = seesPlayer(); alert = Math.max(0, alert + (s ? s * R.dt * 0.9 : -R.dt * 0.35)); if (s && alert > 0.25) guard.say(alert > 0.7 ? 'Hey! Kim var orada?!' : '…?', 0.4); G.ui.meter(alert > 0.02 ? Math.min(1, alert) : null, 'GÖRÜLME'); return false; });
        watch.catch(() => { });
        await goTo(R, G, 156, 122, '<b>Otobüs Deposu</b>\'na git (doğu). Bekçinin fener ışığından uzak dur', 6);
        if (G.playerCar) { G.ui.setObjective('Arabadan in — yaya sessizce gir'); await R.waitUntil(() => !G.playerCar); }
        const buses = [0, 1, 2, 3].map(k => ({ x: 175 + k * 9 - 2.4, z: 115 })); const hit = 2 + ((Math.random() * 2) | 0); let found = false;
        G.ui.setObjective('Otobüsleri ara <b>[E]</b> (4 otobüs) — Shift ile koşmak ses çıkarır');
        const mks = buses.map(b => G.addMarker(b.x, b.z, 0x8fc3ff));
        while (!found) {
          const near = buses.findIndex(b => !b.done && Math.hypot(G.player.x - b.x, G.player.z - b.z) < 2.2);
          if (near < 0) { G.interact = null; await R.waitUntil(() => buses.some(b => !b.done && Math.hypot(G.player.x - b.x, G.player.z - b.z) < 2.2)); continue; }
          const b = buses[near]; await R.interactAt(() => b, '[E] Otobüsü ara', 2.4);
          b.done = true; G.removeMarker(mks[near]); G.player.say('…', 1);
          await R.wait(1.2);
          if (near === hit) found = true; else G.ui.toast(['Sadece unutulmuş bir şemsiye.', 'Bir eldiven, bilet koçanları… yok.', 'Koltukların altında hiçbir şey yok.'][near % 3]);
        }
        for (const m of mks) G.removeMarker(m);
        G.audio.pickup(); G.ui.toast('📒 Simena\'nın çizim defteri bulundu! Kapağında küçük bir fener çizimi var.', 'good');
        G.ui.setObjective('Depodan fark edilmeden çık');
        await R.waitUntil(() => Math.hypot(G.player.x - 193, G.player.z - 115) > 45 || G.player.x < 150);
        G.ui.meter(null); R.failIfs = R.failIfs.filter(f => !f.reason.startsWith('Bekçi')); R.despawn(guard);
        await G.ui.fade(2.2, 'Sabah 06:40<br><small>Kar dinmiş. Kasaba hâlâ uyuyor.</small>');
        G.setTime(6.7); G.setRain(0.1, true); G.ui.day = 2;
        const door = { x: L.books.x, z: 230.5 };
        await goTo(R, G, door.x, door.z, 'Defteri <b>Simena Books</b>\'un kapısına bırak', 2.5);
        if (G.playerCar) { G.ui.setObjective('Arabadan in'); await R.waitUntil(() => !G.playerCar); }
        await R.interactAt(() => door, '[E] Defteri kapının önüne bırak');
        G.audio.door(); G.ui.toast('Defteri bıraktın. Bir not bile yazmadın.');
        await goTo(R, G, door.x + 26, 236, 'Köşeye saklan ve izle', 4);
        const sim = simena(R, G, door.x, door.z - 1.2); sim.noTalk = true; sim.ai = (dt) => { sim.move(0, 0, 0, dt); sim.faceTo(Math.atan2(G.player.x - sim.x, G.player.z - sim.z) + 0.8, dt, 2); };
        G.camOverride = { x: door.x + 12, z: door.z + 4, dist: 32 };
        await R.wait(1.5); sim.say('Defterim?! …Bunu kim bıraktı?', 3); await R.wait(3);
        sim.say('(sayfaları çevirir, gülümser, etrafına bakınır)', 3); await R.wait(3.2);
        G.camOverride = null; R.despawn(sim); S.simena = null;
        await G.ui.subtitle('Jack', '(içinden) Gülümsedi. Bu yeter… şimdilik.', 2.6);
      } },
    // ---------------------------------------------------------- G4 Seyir Tepesi'nde itiraf
    { id: 'ch2_m04_itiraf', title: 'Seyir Tepesi\'nde İtiraf',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { season: 'summer', rain: 0, time: 17.6, day: 5, forcePos: true, player: { x: L.jackHome.x, z: L.jackHome.z + 1 } }); },
      async run(R, G, S) {
        const L = G.world.L;
        await G.ui.fade(2.4, 'Bir yıl sonra — Haziran<br><small>Postacı bir zarf bıraktı. Üzerinde Boston\'ın mührü var.</small>');
        const mb = { x: L.jackHome.x + 3.5, z: L.jackHome.z + 3 }; const mk = R.marker(mb.x, mb.z, 0x8fc3ff);
        G.ui.setObjective('Posta kutusunu kontrol et <b>[E]</b>');
        await R.interactAt(() => mb, '[E] Zarfı aç');
        G.removeMarker(mk); G.audio.pickup();
        await G.ui.letter('<h3>Boston Üniversitesi — Kabul Mektubu</h3>Sevgili Jack,<br><br>Güz dönemi itibarıyla üniversitemize <b>kabul edildiğinizi</b> bildirmekten mutluluk duyarız. Dersler <b>1 Eylül</b>\'de başlıyor.<br><br>Boston\'da görüşmek üzere.');
        G.story.streetRep += 0; G.player.say('BOSTON! Kabul edildim!', 3);
        await G.ui.lines([['Jack', '(içinden) İki ay. Gitmeden önce sadece iki ay kaldı…'], ['Jack', '(içinden) Bir yıl sustum. Artık değil. Bugün ona söyleyeceğim.']]);
        const door = { x: L.books.x, z: 230.5 }; const sim = simena(R, G, door.x + 1.5, door.z + 1); sim.blip = '#c9a8ff'; sim.noTalk = true; sim.state = 'idle';
        await goTo(R, G, L.books.x, 236, 'Sedanla <b>Simena Books</b>\'a git ve Simena\'yı al', 9, true);
        await G.ui.lines([['Simena', 'Sen… kütüphanedeki çocuksun. Hep pencerenin karşısında oturan.'], ['Jack', 'Jack. Sana göstermek istediğim bir yer var. Gün batmadan.'], ['Simena', '(kısa bir sessizlik, sonra gülümser) Tamam, Jack.']]);
        await R.walkTo(sim, S.sedan.x - Math.cos(S.sedan.a) * 1.6, S.sedan.z + Math.sin(S.sedan.a) * 1.6, 2.2, 1.3); R.board(sim, S.sedan); sim.blip = null;
        G.timeScale = 0.01;
        await goTo(R, G, -360, 252, '<b>Seyir Tepesi</b>\'ne sür (güneybatı, sahil yolunun sonu)', 10, true);
        G.ui.setObjective('Arabadan in <b>[F]</b>'); await R.waitUntil(() => !G.playerCar);
        R.unboard(sim, S.sedan, -1); R.walkTo(sim, L.hilltop.x + 1.2, L.hilltop.z + 0.5, 1.6).catch(() => { });
        await goTo(R, G, L.hilltop.x, L.hilltop.z, 'Tepeye yürü', 3);
        G.timeScale = 0; G.setTime(19.1);
        await G.ui.cinematic({ image: IMG('ch2_02_hilltop_confession.jpg'), title: 'Bölüm 2 · Görev 4 — Seyir Tepesi\'nde İtiraf', mood: 'summer_sunset', lines: [
          ['Simena', 'Buradan bütün Oakridge görünüyor… kitapçı bile. Hiç bilmiyordum.'],
          ['Jack', 'Simena, sana bir şey söylemeliyim. Kitapçıdaki o gece… ve otobüsteki defterin…'],
          ['Simena', '(gözleri büyür) O sendin. Kapının önündeki defter… Hep sen miydin?'],
          ['Jack', 'Bir yıl boyunca seninle konuşmaya cesaret edemedim. Ama Boston\'a gitmeden önce bilmeni istedim: Sana aşığım.'],
          ['Simena', '(defterini açar; içinde pencerenin karşısında oturan bir çocuk çizimi var) Ben de seni çizip duruyordum, Jack.'],
          ['Anlatıcı', 'Güneş denize karışırken iki kişi aynı anda güldü. O akşam sevgili oldular. Boston\'a iki ay vardı.'],
        ] });
        G.story.peaceRep += 5;
      } },
    // ---------------------------------------------------------- G5 En güzel iki ay & Polaroid
    { id: 'ch2_m05_polaroid', title: 'En Güzel İki Ay & Polaroid',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { season: 'summer', rain: 0, time: 18.6, day: 0, forcePos: true, player: { x: -30, z: 262 } }); },
      async run(R, G, S) {
        const L = G.world.L;
        await G.ui.fade(2.6, 'Temmuz… Ağustos…<br><small>Fener, park göleti, kitapçının arka odası, gece yüzmeleri. Hayatının en güzel iki ayı.</small>');
        await G.ui.fade(2.4, '31 Ağustos — Boston\'dan önceki son akşam');
        const fx = -40, fz = 279; G.setBonfire(fx, fz);
        const sim = simena(R, G, fx + 2.6, fz + 0.4); sim.noTalk = true; sim.ai = (dt) => { sim.move(0, 0, 0, dt); sim.a = -Math.PI / 2 - 0.3; };
        sim.state = 'sit';
        G.player.x = -30; G.player.z = 262;
        await goTo(R, G, fx + 1.6, fz - 1.2, 'Sahildeki kamp ateşine, Simena\'nın yanına git', 2.6);
        await G.ui.lines([['Simena', 'Yarın bu saatte Boston yolunda olacaksın.'], ['Jack', 'Her hafta sonu ararım. Kış tatilinde de gelirim.'], ['Simena', 'Bir şey getirdim… (eski bir Polaroid fotoğraf makinesi çıkarır) Bir anı bırakalım.']]);
        await R.interactAt(() => ({ x: fx + 1.6, z: fz - 1.2 }), '[E] Polaroid fotoğraf çek', 3);
        G.fx.flash(fx + 2, 2, fz, 30, 0.25, 0xffffff); G.audio.tone({ f0: 1800, f1: 900, dur: 0.12, type: 'square', gain: 0.1 }); await R.wait(0.8);
        await G.ui.cinematic({ image: IMG('ch2_03_beach_polaroid.jpg'), title: 'Bölüm 2 · Görev 5 — En Güzel İki Ay & Polaroid', mood: 'summer_bonfire', lines: [
          ['Simena', '(fotoğraf yavaşça belirirken) Bak… ikimiz de gülüyoruz. Bu pek sık olmaz.'],
          ['Jack', 'Bunu her yere götüreceğim. Cüzdanımda, cebimde… her yerde.'],
          ['Simena', 'Söz mü? Unutursan, fotoğraf sana hatırlatsın: Oakridge\'de seni bekleyen biri var.'],
          ['Jack', 'Söz.'],
          ['Anlatıcı', 'Ateş sönene kadar konuştular. Dalgalar, kıvılcımlar ve bir Polaroid. Bazı anlar insanın cebinde ömür boyu taşınır.'],
        ] });
        G.story.hasSimenaPhoto = true; G.audio.pickup();
        G.ui.toast('📸 Polaroid fotoğraf envantere eklendi — istediğin an <b>P</b> ile bak.', 'good');
        G.ui.setObjective('Fotoğrafa bak <b>[P]</b>');
        let looked = false; G.onPolaroid = () => { looked = true; };
        await R.waitUntil(() => looked || G.ui.skipAll); G.onPolaroid = null;
        await R.waitUntil(() => !G.cutscene);
        G.ui.setObjective('');
      } },
  ],
  async onComplete(R, G) {
    G.setBonfire();
    await G.ui.chapterCard(2, 'Tamamlandı', 'Ertesi sabah Jack sedanın bagajına iki valiz koydu. Cebinde bir Polaroid vardı.');
    G.story.chapter = 3; G.save({ chapter: 3, mission: 0 });
    R.cleanup([]); G.startChapter?.(3, 0);
  },
};
