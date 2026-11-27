// BÖLÜM 1: OAKRIDGE'DE YAZ SONU — düzeltilmiş 10 görevlik akış (senaryoya birebir sadık)
import { axes } from '../physics/collide.js';
import { angDiff } from '../world/population.js';

const IMG = (f) => `assets/scenes/${f}`;
export const LOOKS = {
  jack: { skin: '#f1c9a5', hair: '#2a1d14', shirt: '#3a4a78', pants: '#3a4a66', shirtKind: 'jacket' },
  marcus: { skin: '#c68e64', hair: '#1a1a1a', shirt: '#b86a3a', pants: '#3a3a3a', shirtKind: 'shirt' },
  jeanine: { skin: '#f6d7bf', hair: '#4a3020', shirt: '#c94f4f', pants: '#2f3e5a', shirtKind: 'shirt' },
  sam: { skin: '#e0ac85', hair: '#c9a36a', shirt: '#4f9a6a', pants: '#2f3e5a', shirtKind: 'hoodie' },
  tommy: { skin: '#f1c9a5', hair: '#c9a36a', shirt: '#e8e2d0', pants: '#23324d', shirtKind: 'jacket' },
  gang: () => ({ skin: ['#f1c9a5', '#c68e64', '#e0ac85', '#8d5a3b'][(Math.random() * 4) | 0], hair: '#1a1a1a', shirt: ['#2f2f35', '#3a2f2f', '#2f3a35', '#4a4a4a'][(Math.random() * 4) | 0], pants: '#23232a', shirtKind: 'hoodie' }),
};

// --- ortak hazırlık: her görev bu fonksiyonla kendi başlangıç koşullarını garanti eder (başarısızlık sonrası tekrar için)
function prep(R, G, o) {
  const S = R.S, L = G.world.L;
  if (o.time !== undefined) G.setTime(o.time);
  if (o.rain !== undefined) G.setRain(o.rain, true), G.setTime(G.time);
  if (!S.sedan || !G.vehicles.includes(S.sedan)) {
    const p = o.sedanAt || { x: L.garage.x, z: L.garage.z - 0.5, a: 0 };
    S.sedan = R.car({ kind: 'sedan', color: '#27355B', x: p.x, z: p.z, a: p.a }); S.sedan.isSedan = true;
    if (o.player === 'inSedan') G.enterVehicle(S.sedan);
  } else if (R.retry && o.player === 'inSedan' && !G.playerCar) G.enterVehicle(S.sedan);
  if (R.retry && o.player && o.player !== 'inSedan') { if (G.playerCar) G.exitVehicle(); G.player.x = o.player.x; G.player.z = o.player.z; }
  G.player.hp = 100; G.player.dead = false;
  const mk = (key, look, extra = {}) => { if (!S[key] || !G.peds.includes(S[key])) S[key] = R.spawn({ name: extra.name, look, female: extra.female, role: 'story', x: extra.x ?? 0, z: extra.z ?? 0 }); S[key].noTalk = false; return S[key]; };
  for (const [key, val] of Object.entries(o.cast || {})) {
    const nm = { marcus: 'Marcus', jeanine: 'Jeanine', sam: 'Sam', tommy: 'Tommy' }[key];
    if (val === null) { if (S[key]) { R.despawn(S[key]); S[key] = null; } continue; }
    const fresh = !S[key] || !G.peds.includes(S[key]);
    const p = mk(key, LOOKS[key], { name: nm, female: key === 'jeanine', x: val.x, z: val.z });
    if (val === 'passenger') { if (!p.vehicle) R.board(p, S.sedan); }
    else if (fresh || R.retry) { if (p.vehicle) R.unboard(p, p.vehicle); p.x = val.x; p.z = val.z; if (val.a !== undefined) p.a = val.a; }
  }
  G.carFilter = null; G.lockCar = false;
  R.failIf(() => S.sedan && S.sedan.exploded, 'Jack\'in 1988 Sedan\'ı patladı.');
  R.retry = false;
}

async function driveTo(R, G, x, z, text, r = 8, color = 0xffd36a) {
  const S = R.S; const mk = R.marker(x, z, color); G.ui.setObjective(text);
  await R.waitUntil(() => {
    const inS = R.inCar(S.sedan); if (!inS) G.ui.setObjective(G.playerCar ? 'Kendi arabana (1988 Sedan) dön' : 'Sedan\'a bin <b>[F]</b>'); else G.ui.setObjective(text);
    return inS && R.near(x, z, r) && S.sedan.speed < 3.5;
  });
  G.removeMarker(mk); G.ui.setObjective('');
}

export const chapter1 = {
  num: 1, title: 'Oakridge\'de Yaz Sonu', sub: '16 yaşındasın. Yaz bitiyor ve her şey değişmek üzere.',
  missions: [
    // ---------------------------------------------------------- G1
    { id: 'ch1_m01_pasli_motor', title: 'Paslı Motor',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 17.2, rain: 0, player: { x: L.garage.x - 2.5, z: L.garage.z - 4 }, cast: { marcus: { x: L.garage.x + 1.8, z: L.garage.z + 2.4, a: Math.PI } } }); },
      async run(R, G, S) {
        const L = G.world.L;
        G.player.x = L.garage.x - 2.5; G.player.z = L.garage.z - 4.2; G.player.a = 0.4; S.marcus.state = 'idle';
        G.camOverride = { x: L.garage.x, z: L.garage.z, dist: 40 };
        await R.wait(0.6);
        await G.ui.cinematic({ image: IMG('ch1_01_garage_marcus.jpg'), title: 'Görev 1 — Paslı Motor', mood: 'sunset_warm', lines: [
          ['Marcus', 'Tamam, son bir kez dene. Bu sefer o pistonları dua ederek bağladım.'],
          ['Jack', 'Üç haftadır bu garajdayız Marcus. Babam bu sedanı hurdaya vermek üzereydi.'],
          ['Marcus', '1988 Oakridge Sedan, dostum. Bunlar ölmez, sadece uyur. Kontağı çevir!'],
          ['Anlatıcı', '(Motor öksürür… tekler… ve sonunda derin bir homurtuyla canlanır.)'],
          ['Marcus', 'İŞTE BU! Duydun mu şunu? Yaz bitmeden bu kasabanın kralısın!'],
          ['Jack', 'Jeanine kafede bekliyor. Onu almaya gidiyorum… ilk kez kendi arabamla.'],
          ['Marcus', 'Git hadi, aşık çocuk. Frenler biraz yumuşak, dikkat et!'],
        ] });
        G.camOverride = null; S.marcus.state = 'cheer';
        G.ui.setObjective('Arabaya bin <b>[F]</b>');
        await R.waitUntil(() => R.inCar(S.sedan));
        S.marcus.state = 'idle'; S.marcus.say('Uçur onu Jack!', 2.5);
        G.ui.toast('Sürüş: <b>W</b> gaz · <b>S</b> fren/geri · <b>A/D</b> direksiyon · <b>Boşluk</b> el freni', '');
        setTimeout(() => G.ui.toast('İpucu: Çarptıkça araç hasar alır — duman çıkarsa dikkat!', ''), 3500);
      } },
    // ---------------------------------------------------------- G2
    { id: 'ch1_m02_kafe', title: 'Oakridge Kafe',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 17.4, rain: 0, player: 'inSedan', cast: { marcus: null, jeanine: { x: L.cafe.x, z: -10.2, a: 0 } } }); },
      async run(R, G, S) {
        const L = G.world.L; S.jeanine.blip = '#ff9fb4'; S.jeanine.state = 'idle';
        await driveTo(R, G, L.cafe.x, L.cafe.z, 'Jeanine\'i <b>Oakridge Cafe</b>\'den al', 9);
        S.jeanine.say('Jack! Gerçekten çalıştırdınız mı onu?!', 2.5);
        await R.wait(1.2);
        await G.ui.cinematic({ image: IMG('ch1_02_cafe_jeanine.jpg'), title: 'Görev 2 — Oakridge Kafe', mood: 'sunset_warm', lines: [
          ['Jeanine', 'Vay… Jack, bu araba gerçekten senin mi? Marcus\'la sonunda başardınız!'],
          ['Jack', 'Üç hafta, iki yanık parmak ve bir sürü küfür. Ama evet, artık bizim.'],
          ['Jeanine', '"Bizim" mi? Hmm… o zaman beni güzel bir yere götür bakalım.'],
          ['Jack', 'Sahil fenerine ne dersin? Gün batımı yarım saat sonra.'],
          ['Jeanine', 'Fener… Tamam, ama müziği ben seçiyorum.'],
        ] });
        await R.walkTo(S.jeanine, S.sedan.x - Math.cos(S.sedan.a) * 1.6, S.sedan.z + Math.sin(S.sedan.a) * 1.6, 2.2, 1.2);
        R.board(S.jeanine, S.sedan); S.jeanine.blip = null;
      } },
    // ---------------------------------------------------------- G3
    { id: 'ch1_m03_sahil', title: 'Sahil Rüzgarı',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 18.3, rain: 0, player: 'inSedan', sedanAt: { x: L.cafe.x, z: L.cafe.z, a: Math.PI / 2 }, cast: { jeanine: 'passenger' } }); },
      async run(R, G, S) {
        const L = G.world.L; G.timeScale = 0.012;
        G.ui.lines([['Jeanine', 'Bu kasabada bir şeyler yapmak için arabası olan birini bulmak zor, biliyor musun?'], ['Jack', 'Artık buldun.']]);
        await driveTo(R, G, L.lighthouse.x, L.lighthouse.z, '<b>Sahil Feneri</b>\'ne sür (güneydoğu)', 10);
        G.timeScale = 0; G.setTime(19.0);
        await G.ui.cinematic({ image: IMG('ch1_03_lighthouse_sunset.jpg'), title: 'Görev 3 — Sahil Rüzgarı', mood: 'sunset_romantic', lines: [
          ['Jeanine', 'Burası… hiç bu kadar güzel görmemiştim. Güneş denize eriyor gibi.'],
          ['Jack', 'Küçükken babam beni buraya getirirdi. Fenerin ışığı dönerken dilek tutardık.'],
          ['Jeanine', 'Peki şimdi ne dilerdin?'],
          ['Jack', 'Bu yazın hiç bitmemesini.'],
          ['Jeanine', '(gülümser) Her şey biter Jack. Ama… bu an güzel.'],
        ] });
        // opsiyonel yan seçim: Marcus'un gece yarışı
        G.audio.phone(); await G.ui.subtitle('Telefon', '📱 Marcus arıyor…', 1.8);
        const c = await G.ui.choice('Marcus: "Bu gece sanayide yarış var Jack! Sedan\'ı göster herkese. Var mısın?"', ['Varım, sedanı göstereceğim!', 'Bu gece olmaz, Jeanine\'leyim.']);
        G.story.choices.oakridgeNightRace = c === 0 ? 'accepted' : 'declined';
        if (c === 0) { G.story.streetRep += 5; await G.ui.subtitle('Marcus', 'İşte benim adamım! Gece görüşürüz!'); }
        else { G.story.peaceRep += 5; await G.ui.subtitle('Marcus', 'Peh, aşık çocuk… Peki, gece yine de bir tur atarız.'); }
        await G.ui.subtitle('Jeanine', 'Geç oldu Jack, beni eve bırakır mısın?');
      } },
    // ---------------------------------------------------------- G4 (KRİTİK DÜZELTME)
    { id: 'ch1_m04_jeanine_eve', title: 'Jeanine\'i Eve Bırak',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 19.4, rain: 0, player: 'inSedan', sedanAt: { x: L.lighthouse.x - 6, z: 252, a: -Math.PI / 2 }, cast: { jeanine: 'passenger' } }); },
      async run(R, G, S) {
        const L = G.world.L; G.timeScale = 0.01;
        await driveTo(R, G, L.jeanineHome.x, -153.5, 'Jeanine\'i <b>evine</b> bırak (kuzeydoğu)', 9);
        R.unboard(S.jeanine, S.sedan, -1);
        S.jeanine.say('İyi geceler Jack. Bugün… çok güzeldi.', 3);
        await R.wait(1);
        G.player.say('İyi geceler Jeanine.', 2);
        await R.walkTo(S.jeanine, L.jeanineHome.x, L.jeanineHome.z - 1.5, 1.5, 0.8);
        G.audio.door(); R.despawn(S.jeanine); S.jeanine = null;
        G.ui.toast('Jeanine evine girdi.');
      } },
    // ---------------------------------------------------------- G5
    { id: 'ch1_m05_eve_don', title: 'Kendi Evine Dön',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 19.8, rain: 0, player: 'inSedan', sedanAt: { x: L.jeanineHome.x, z: -153.5, a: -Math.PI / 2 }, cast: { jeanine: null } }); },
      async run(R, G, S) {
        const L = G.world.L;
        await driveTo(R, G, L.jackHome.x, -153.5, '<b>Eve dön</b> (kuzeybatı, açık mavi ev)', 9);
        G.timeScale = 0;
        G.ui.setObjective('Arabadan in <b>[F]</b> ve eve gir <b>[E]</b>');
        const mk = R.marker(L.jackHome.x, L.jackHome.z, 0x8fc3ff);
        await R.interactAt(() => L.jackHome, '[E] Eve gir');
        G.removeMarker(mk); G.ui.setObjective('');
        await G.ui.fade(2.6, 'Cuma Akşamı — 21:30<br><small>Hafif bir yağmur başladı…</small>');
        G.setRain(0.45, true); G.setTime(21.5); G.ui.day = 5;
        G.player.x = L.jackHome.x; G.player.z = L.jackHome.z + 0.8; G.player.a = 0;
        // sedanı garaj önüne koy (yoldaysa)
        if (!G.playerCar && Math.hypot(S.sedan.x - L.jackHome.x, S.sedan.z - L.jackHome.z) > 25) { S.sedan.x = L.garage.x; S.sedan.z = L.garage.z - 0.5; S.sedan.a = 0; S.sedan.vx = S.sedan.vz = 0; }
        G.audio.phone(); await R.wait(1);
        await G.ui.lines([['Marcus', '(telefonda) Jack! Sam\'le sanayideyiz. ' + (G.story.choices.oakridgeNightRace === 'accepted' ? 'Yarışı polis basmış, iptal! ' : '') + 'Gel bizi al, kasabada bir tur atalım.'], ['Jack', 'Geliyorum.']]);
      } },
    // ---------------------------------------------------------- G6
    { id: 'ch1_m06_gece_turu', title: 'Arkadaşlarla Gece Turu',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 21.5, rain: 0.45, player: { x: L.jackHome.x, z: L.jackHome.z + 1 }, sedanAt: { x: L.garage.x, z: L.garage.z - 0.5, a: 0 }, cast: { marcus: { x: L.meetup.x + 4, z: L.meetup.z - 1.5 }, sam: { x: L.meetup.x + 5, z: L.meetup.z + 1 } } }); },
      async run(R, G, S) {
        const L = G.world.L; S.marcus.blip = '#ffcf7a'; S.sam.blip = '#a8e08a'; S.marcus.state = 'idle'; S.sam.state = 'idle';
        await driveTo(R, G, L.meetup.x - 2, L.meetup.z, '<b>Marcus ve Sam</b>\'i sanayi buluşma noktasından al (doğu)', 9);
        S.marcus.say('İşte geldi! Sedan yağmurda bile parlıyor!', 2.5);
        await Promise.all([R.walkTo(S.marcus, S.sedan.x + 1.5, S.sedan.z, 2.6, 1.4), R.walkTo(S.sam, S.sedan.x + 1.5, S.sedan.z + 1, 2.6, 1.6)]);
        R.board(S.marcus, S.sedan); R.board(S.sam, S.sedan); S.marcus.blip = S.sam.blip = null;
        await G.ui.lines([['Sam', 'Jack, bu gece merkezde herkes dışarıda. Bir tur atalım, sonra burger?'], ['Marcus', 'Radyoyu aç! (M)'], ['Jack', 'Kemerler takılı mı beyler? Gidiyoruz.']]);
      } },
    // ---------------------------------------------------------- G7
    { id: 'ch1_m07_ihanet', title: 'Kırmızı Işıkta İhanet',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 21.7, rain: 0.5, player: 'inSedan', sedanAt: { x: L.meetup.x - 2, z: L.meetup.z, a: Math.PI }, cast: { marcus: 'passenger', sam: 'passenger', jeanine: { x: 24.2, z: -9.4, a: Math.PI / 2 }, tommy: { x: 25.2, z: -9.4, a: -Math.PI / 2 } } }); },
      async run(R, G, S) {
        // Jeanine ve Tommy YALNIZCA bu görevde kafenin önünde, sokak lambasının altında
        S.jeanine.state = 'hug'; S.tommy.state = 'hug'; S.jeanine.noTalk = S.tommy.noTalk = true;
        const hold = (p, a) => p.ai = (dt) => { p.move(0, 0, 0, dt); p.a = a; };
        hold(S.jeanine, Math.PI / 2); hold(S.tommy, -Math.PI / 2);
        const route = [{ x: 150, z: -146.5, t: 'Kasaba merkezinde tur at — kuzey yolu' }, { x: -146.5, z: -75, t: 'Tura devam — meydanın batısı' }, { x: -110, z: 3.5, t: 'Tura devam — kafe caddesi (doğuya)' }];
        for (const c of route) await driveTo(R, G, c.x, c.z, c.t, 11, 0x8fc3ff);
        G.ui.setObjective('Kafe caddesinde doğuya devam et');
        await R.waitUntil(() => R.inCar(S.sedan) && Math.abs(S.sedan.z) < 9 && S.sedan.x > -40 && S.sedan.x < 60);
        S.marcus.say('Dur dur dur! Şu… Jeanine değil mi?!', 3); G.audio.horn();
        await G.ui.subtitle('Marcus', 'Jack… Kafenin önünde. Lambanın altında. Yanındaki… Tommy mi o?!', 3);
        G.ui.setObjective('Ani fren yap ve arabadan in <b>[F]</b>');
        await R.waitUntil(() => !G.playerCar && Math.hypot(G.player.x - S.tommy.x, G.player.z - S.tommy.z) < 28);
        S.tommy.say('Ooo, bak kim gelmiş. Hurda arabalı Jack.', 3);
      } },
    // ---------------------------------------------------------- G8
    { id: 'ch1_m08_tommy', title: 'Tommy ile Yakın Dövüş',
      setup: (R, G) => { const L = G.world.L; prep(R, G, { time: 21.8, rain: 0.55, player: { x: 20, z: -6 }, sedanAt: { x: 14, z: 3.5, a: Math.PI / 2 }, cast: { marcus: { x: 12, z: -7.6 }, sam: { x: 10, z: -8.2 }, jeanine: { x: 28.5, z: -9.6 }, tommy: { x: 25, z: -9 } } }); },
      async run(R, G, S) {
        const p = G.player; p.hp = 100; if (p.weapon !== 'fists') p.setWeaponMesh('fists');
        // Marcus & Sam kenarda bekler
        for (const f of [S.marcus, S.sam]) if (f.vehicle) R.unboard(f, S.sedan, -1);
        R.walkTo(S.marcus, 15, -9.2, 2); R.walkTo(S.sam, 13, -9.6, 2);
        S.jeanine.state = 'idle'; S.jeanine.ai = (dt) => { const dx = 30 - S.jeanine.x, dz = -10 - S.jeanine.z; if (Math.hypot(dx, dz) > 0.6) S.jeanine.move(dx, dz, 2.5, dt); else { S.jeanine.move(0, 0, 0, dt); S.jeanine.faceTo(Math.atan2(p.x - S.jeanine.x, p.z - S.jeanine.z), dt); } };
        const T = S.tommy; T.state = 'fight'; T.role = 'gang'; T.fighter = true; T.nonLethal = true; T.hp = 95; T.dmgMul = 0.8; T.blip = '#ff7a6a'; T.target = p;
        T.ai = (dt) => G.pop.updateFighter(T, dt, p, { speed: 5 });
        G.ui.lines([['Jack', 'Tommy!'], ['Tommy', 'Ne var? Kız seçimini yapmış, kabul et artık.'], ['Jack', 'Bunu bir de yumruğuma anlat.']]);
        G.ui.setObjective('<b>Tommy</b>\'yi yere ser! (Sol tık / Q — vur)');
        setTimeout(() => { S.marcus.state = 'cheer'; S.sam.state = 'cheer'; }, 2500);
        await R.waitUntil(() => T.hp <= 0);
        T.ai = null; T.blip = null; T.state = 'defeated'; G.tokens.clear();
        S.marcus.state = 'idle'; S.sam.state = 'idle';
        G.ui.setObjective(''); G.ui.toast('Tommy yere serildi!', 'good'); S.marcus.say('Ooof… Yerden kalkamıyor!', 2.5);
      } },
    // ---------------------------------------------------------- G9
    { id: 'ch1_m09_yuzlesme', title: 'Yağmurda Yüzleşme',
      setup: (R, G) => { prep(R, G, { time: 21.9, rain: 0.65, player: { x: 23, z: -6 }, sedanAt: { x: 14, z: 3.5, a: Math.PI / 2 }, cast: { marcus: { x: 15, z: -9.2 }, sam: { x: 13, z: -9.6 }, jeanine: { x: 30, z: -10 }, tommy: { x: 24, z: -8 } } }); const T = R.S.tommy; if (!T.down) { T.hp = 0; T.nonLethal = true; T.knock(0, 0.1, 0.5); T.getUpT = 999; } },
      async run(R, G, S) {
        S.jeanine.blip = '#ff9fb4'; G.ui.setObjective('Jeanine\'i kolundan tut ve ara sokağa çek <b>[E]</b>');
        await R.interactAt(() => S.jeanine, '[E] Jeanine ile yüzleş', 2.4);
        S.jeanine.blip = null; G.ui.setObjective('');
        await G.ui.fade(1.2);
        const L = G.world.L; S.jeanine.ai = null; S.jeanine.x = L.alley.x; S.jeanine.z = L.alley.z + 1; G.player.x = L.alley.x; G.player.z = L.alley.z + 3; G.player.a = Math.PI;
        await G.ui.cinematic({ image: IMG('ch1_04_betrayal_rain.jpg'), title: 'Görev 9 — Yağmurda Yüzleşme', mood: 'night_rain', lines: [
          ['Jack', 'Ne zamandır, Jeanine? Fenerde… o dilekten sonra mı? Önce mi?'],
          ['Jeanine', 'Jack, anlamıyorsun… Tommy\'yle her şey… daha kolay.'],
          ['Jack', 'Kolay mı? Ben üç hafta o arabayı senin için tamir ettim.'],
          ['Jeanine', 'Ben bunu hiç istemedim. Herkes onu tanıyor, partileri, arabası… Sen ise hep "bir gün" diyorsun.'],
          ['Jack', 'O "bir gün" seninleydi. Ama artık değil.'],
          ['Jeanine', '(gözleri dolar) Özür dilerim… Lütfen git Jack. Tommy\'nin arkadaşları…'],
          ['Anlatıcı', '(Yağmur sertleşir. Jack arkasını döner. Bir şey göğsünde kırılır — ve bir daha asla tam olarak eskisi gibi olmaz.)'],
        ] });
        R.walkTo(S.jeanine, 40, -60, 4.5, 1).catch(() => { }); setTimeout(() => { if (S.jeanine) R.despawn(S.jeanine); }, 5000);
        G.player.x = 23; G.player.z = -6;
      } },
    // ---------------------------------------------------------- G10
    { id: 'ch1_m10_kacis', title: '10 Kişilik Sürek Avı',
      setup: (R, G) => { prep(R, G, { time: 22.0, rain: 0.75, player: { x: 23, z: -6 }, sedanAt: { x: 14, z: 3.5, a: Math.PI / 2 }, cast: { marcus: { x: 15, z: -9.2 }, sam: { x: 13, z: -9.6 }, tommy: { x: 24, z: -8 }, jeanine: null } }); const T = R.S.tommy; if (!T.down) { T.hp = 0; T.nonLethal = true; T.knock(0, 0.1, 0.5); T.getUpT = 999; } },
      async run(R, G, S) {
        const L = G.world.L, p = G.player; p.hp = 100;
        const T = S.tommy; T.state = 'phone';
        await G.ui.subtitle('Tommy', '(yerde, telefonda) …Evet. Kafenin önü. Hepiniz gelin. HEMEN!', 3.2);
        await G.ui.subtitle('Marcus', 'Jack! Telefonu duydun mu? Tommy\'nin tüm ekibi geliyor — on kişi, sopalarla!', 3);
        await G.ui.subtitle('Sam', 'Jack… sedanın lastiklerini kesmişler! Araba gitmez. Dağılın! Jack, EVİNE KOŞ!', 3);
        // Jack yaya kaçar: sedan lastikleri patlak, hiçbir araca binilemez
        G.lockCar = true; S.sedan.flat = true; S.sedan.wheels.forEach(w => { w.wm.scale.set(1, 0.72, 0.72); }); S.sedan.body.position.y = -0.12;
        for (const f of [S.marcus, S.sam]) { f.state = 'flee'; R.walkTo(f, 37, -70, 7, 1).catch(() => { }); setTimeout(() => R.despawn(f), 6000); }
        S.marcus = S.sam = null;
        G.pop.trafficTarget = 8; G.pop.pedTarget = 14; G.police.enabled = false; G.police.clear();
        // 6 yaya (sopalı) + 2 araç x 2 kişi = 10
        const spots = [[95, -9], [100, -6], [37, -95], [40, -98], [-40, -9], [-44, -6]];
        const gang = [];
        await R.wait(1.5);
        for (const [x, z] of spots) { const g = R.spawn({ x, z, role: 'gang', look: LOOKS.gang(), weapon: 'bat', hp: 70 }); g.dmgMul = 0.5; g.target = p; g.blip = '#ff4040'; gang.push(g); g.say(['Orada!', 'Yakalayın onu!', 'Kaçamazsın Jack!'][(Math.random() * 3) | 0], 2); }
        const cands = G.world.nodes.filter(n => { const d = Math.hypot(n.x - p.x, n.z - p.z); return d > 100 && d < 190; }).sort(() => Math.random() - 0.5);
        for (let k = 0; k < 2; k++) {
          const n = cands[k % cands.length]; const nb = G.world.nodes[n.links[0]]; const ln = G.pop.laneOf(n.id, nb.id);
          const sx = n.x + ln.d.x * 14 + ln.rt.x * 3.5, sz = n.z + ln.d.z * 14 + ln.rt.z * 3.5;
          const car = R.car({ kind: k ? 'pickup' : 'muscle', color: k ? '#3a3a3a' : '#6b2b2b', x: sx, z: sz, a: Math.atan2(p.x - sx, p.z - sz) });
          const crew = [0, 1].map(() => { const g = R.spawn({ x: n.x, z: n.z, role: 'gang', look: LOOKS.gang(), weapon: 'bat', hp: 70 }); g.dmgMul = 0.5; g.target = p; g.vehicle = car; return g; });
          car.driver = crew[0]; car.passengers.push(crew[1]); car.gang = true; gang.push(...crew);
          const ai = { type: 'gangcar', repath: 0, route: null, ri: 0, stuck: 0, rev: 0 };
          ai.fn = (dt) => {
            if (car.broken || !car.driver || car.driver.vehicle !== car) { return; }
            const pp = G.playerPos(); const d = Math.hypot(pp.x - car.x, pp.z - car.z);
            if (!G.playerCar && d < 13 && car.speed < 5) { for (const g of [car.driver, ...car.passengers]) { if (g.vehicle === car) { R.unboard(g, car, Math.random() < .5 ? 1 : -1); g.state = 'fight'; } } car.driver = null; car.passengers = []; car.ai = null; return; }
            let tx = pp.x, tz = pp.z;
            if (d > 45) { ai.repath -= dt; if (ai.repath <= 0 || !ai.route) { ai.route = G.police.routeTo(car, pp.x, pp.z); ai.ri = 0; ai.repath = 2.5; } while (ai.route[ai.ri] && Math.hypot(ai.route[ai.ri].x - car.x, ai.route[ai.ri].z - car.z) < 12) ai.ri++; const nn = ai.route[ai.ri]; if (nn) { tx = nn.x; tz = nn.z; } }
            if (ai.rev > 0) { ai.rev -= dt; car.in.throttle = 0; car.in.brake = 1; car.in.steer = -Math.sign(angDiff(Math.atan2(tx - car.x, tz - car.z), car.a)); return; }
            G.pop.driveTo(car, tx, tz, d < 15 ? 14 : 24, dt, false);
            if (car.speed < 1.2 && car.in.throttle > 0) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt * 2); if (ai.stuck > 1.6) { ai.rev = 1.1; ai.stuck = 0; }
          };
          car.ai = ai;
        }
        for (const g of gang) g.state = 'fight';
        const homeMk = R.marker(L.jackHome.x, L.jackHome.z, 0x7bd389);
        G.ui.setObjective('<b>EVİNE KOŞ!</b> (kuzeybatı) — yakalanırsan ölürsün. Kapıya gel ve <b>[E]</b> ile kilitle');
        G.ui.toast('10 kişi peşinde — 6\'sı yaya, 4\'ü iki arabayla! Ara sokakları kullan, koşmak için Shift.', 'warn');
        await R.interactAt(() => L.jackHome, '[E] İçeri gir ve kapıyı kilitle');
        G.removeMarker(homeMk); G.ui.setObjective('');
        G.audio.door(); await G.ui.fade(2.4, 'Kapıyı kilitledin.<br><small>Dışarıda bağırışlar… sonra sadece yağmur.</small>');
        for (const g of gang) R.despawn(g);
        G.pop.trafficTarget = 14; G.pop.pedTarget = 34; G.police.enabled = true; G.lockCar = false;
      } },
  ],
  async onComplete(R, G) {
    G.ui.setObjective('');
    await G.ui.chapterCard(1, 'Tamamlandı', 'Jack o gece pencereden yağmuru izledi ve kimseye bir daha o kadar kolay güvenmemeye yemin etti.');
    G.story.chapter = 2; G.save({ chapter: 2, mission: 0 });
    R.cleanup([]); G.startChapter?.(2, 0);
  },
};
