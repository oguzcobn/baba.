// BÖLÜM 3: BOSTON — Yeni harita, kırık kalp ve yeraltı
const IMG = (f) => `assets/scenes/${f}`;
const LEO = { skin: '#f1c9a5', hair: '#b8864a', shirt: '#5a7a4a', pants: '#3a4258', shirtKind: 'hoodie' };
const VINCE = { skin: '#e0c0a0', hair: '#141414', shirt: '#1f1f22', pants: '#1a1a1e', shirtKind: 'jacket' };
const THUG = () => ({ skin: ['#f1c9a5', '#c68e64', '#8d5a3b'][(Math.random() * 3) | 0], hair: '#1a1a1a', shirt: ['#3a2f2f', '#2f2f35', '#4a3a2a'][(Math.random() * 3) | 0], pants: '#202024', shirtKind: 'jacket' });

function prep(R, G, o) {
  const S = R.S; G.loadWorld('boston'); const L = G.world.L;
  G.story.chapter = 3; G.setSeason(o.season || 'autumn'); G.setRain(o.rain ?? 0, true); G.setTime(o.time); G.timeScale = 0; G.ui.day = o.day ?? 1;
  G.lockCar = false; G.police.enabled = o.police ?? true; G.setBonfire();
  if (!S.sedan || !G.vehicles.includes(S.sedan)) { const p = o.sedanAt || { x: L.arrival.x - 8, z: L.arrival.z, a: Math.PI / 2 }; S.sedan = R.car({ kind: 'sedan', color: '#27355B', ...p }); S.sedan.isSedan = true; }
  if (R.retry || o.forcePos) { if (G.playerCar) G.exitVehicle(); G.player.x = o.player.x; G.player.z = o.player.z; G.camT.set(G.player.x, 0, G.player.z); }
  G.player.hp = 100; G.player.dead = false; G.story.hasSimenaPhoto = true;
  R.failIf(() => S.sedan && S.sedan.exploded && o.needSedan, 'Sedan patladı.');
  R.retry = false;
}
function leo(R, G, x, z) { const S = R.S; if (!S.leo || !G.peds.includes(S.leo)) S.leo = R.spawn({ name: 'Leo', look: LEO, role: 'story', x, z }); else if (!S.leo.vehicle) { S.leo.x = x; S.leo.z = z; } S.leo.noTalk = true; return S.leo; }
async function goTo(R, G, x, z, text, r = 7, car = null) {
  const mk = R.marker(x, z); G.ui.setObjective(text);
  await R.waitUntil(() => R.near(x, z, r) && (!car || (G.playerCar === car && car.speed < 4)));
  G.removeMarker(mk); G.ui.setObjective('');
}

export const chapter3 = {
  num: 3, title: 'Boston', sub: 'Yeni şehir, yeni oda arkadaşı. Cebinde bir Polaroid — ve bir sürü vaat.',
  missions: [
    // ---------------------------------------------------------- G1 Boston'a Varış
    { id: 'ch3_m01_varis', title: 'Boston\'a Varış ve Leo',
      setup: (R, G) => { prep(R, G, { time: 16.2, season: 'autumn', forcePos: true, player: { x: -240, z: 163.5 } }); },
      async run(R, G, S) {
        const L = G.world.L; const l = leo(R, G, L.leoMeet.x + 2, L.leoMeet.z); l.state = 'idle';
        await G.ui.fade(2.4, 'Eylül — Boston<br><small>Sedan 1.000 kilometre yolu tek parça çıkardı.</small>');
        await G.ui.cinematic({ image: IMG('ch3_01_boston_arrival.jpg'), title: 'Bölüm 3 · Görev 1 — Boston\'a Varış', mood: 'sunset_warm', lines: [
          ['Leo', 'Sen Jack olmalısın! Oakridge\'li çocuk, değil mi? Ben Leo — oda arkadaşın. Hoş geldin Boston\'a!'],
          ['Jack', 'Selam… Burası düşündüğümden de büyük.'],
          ['Leo', 'Büyük mü? Daha görmedin! Kampüs, downtown, liman, barlar… Bu şehir uyumaz dostum.'],
          ['Jack', '(içinden) Simena\'ya ilk akşam fotoğraf göndermeliyim. Bu kırmızı tuğlalı binaları sever.'],
          ['Leo', 'Valizleri yurda bırakalım, sonra seni barlar sokağına götürüyorum. İlk gece kuralı!'],
        ] });
        G.ui.toast('Yeni harita: <b>Boston</b> — Batı kampüs · Merkez downtown · Doğu liman · Kuzeydoğu arka mahalleler · Güney stadyum', 'good');
        G.ui.setObjective('Sedana bin, Leo\'yu al <b>[F]</b>');
        await R.waitUntil(() => G.playerCar === S.sedan);
        await R.walkTo(l, S.sedan.x - Math.cos(S.sedan.a) * 1.6, S.sedan.z + Math.sin(S.sedan.a) * 1.6, 3, 1.4); R.board(l, S.sedan);
        await goTo(R, G, L.dorm.x, L.dorm.z, '<b>Harlow Hall</b> yurduna git', 9, S.sedan);
        await G.ui.lines([['Leo', 'Valizler tamam. Şimdi: Barlar Sokağı! Neon ışıklarını görünce anlarsın.']]);
        await goTo(R, G, L.bars.x, L.bars.z, '<b>Barlar Sokağı</b>\'na sür (merkez)', 10, S.sedan);
        await G.ui.lines([['Leo', 'İşte! The Anchor, Red Lion, Blue Note… Hepsinin barmeni beni tanır.'], ['Jack', 'Sen buraya ne zaman geldin Leo, geçen hafta mı?'], ['Leo', '(güler) Üç gün önce. Hızlı öğrenirim.']]);
        await G.ui.fade(2.6, 'Sonraki iki ay…<br><small>Her gece Simena ile telefonda konuştular. Sonra aramalar kısaldı.</small>');
      } },
    // ---------------------------------------------------------- G2 Son Telefon
    { id: 'ch3_m02_son_telefon', title: 'Son Telefon',
      setup: (R, G) => { const L = G.world.L || {}; prep(R, G, { time: 23.4, rain: 0.8, season: 'autumn', day: 3, forcePos: true, player: { x: -240, z: 170 }, sedanAt: { x: -260, z: 165, a: Math.PI / 2 } }); },
      async run(R, G, S) {
        const L = G.world.L; if (S.leo) { if (S.leo.vehicle) R.unboard(S.leo, S.leo.vehicle); R.despawn(S.leo); S.leo = null; }
        G.player.x = L.dorm.x; G.player.z = L.dorm.z + 0.5;
        await G.ui.fade(2.2, 'Kasım — Gece 23:20<br><small>Yağmur. Leo dışarıda. Telefon masada.</small>');
        G.audio.phone(); G.ui.toast('📱 Simena arıyor…');
        await R.interactAt(() => ({ x: L.dorm.x, z: L.dorm.z }), '[E] Telefonu aç', 3);
        await G.ui.cinematic({ image: IMG('ch3_02_last_call.jpg'), title: 'Bölüm 3 · Görev 2 — Son Telefon', mood: 'night_rain', lines: [
          ['Simena', 'Jack… Bu akşam düşündüm. Çok düşündüm.'],
          ['Jack', 'Biliyorum. Son aramalarımız… hep yorgunuz, hep aceleyle kapatıyoruz.'],
          ['Simena', 'Sen orada yeni bir hayat kuruyorsun, ben burada kitapçıdayım. Aradaki mesafe her gün biraz daha büyüyor.'],
          ['Jack', 'Kış tatilinde gelirim dedim ya… Simena, lütfen.'],
          ['Simena', 'Seni tutmak istemiyorum Jack. Yaşa. Gerçekten yaşa. …O iki ay benim de en güzel iki ayımdı.'],
          ['Anlatıcı', 'Hat kapandı. Bir daha hiç konuşmadılar. Jack masadaki Polaroid\'i uzun süre elinden bırakmadı.'],
        ] });
        G.story.lastCall = true;
        G.ui.toast('Polaroid hâlâ cebinde. <b>P</b> ile bak — artık iç sesin farklı.', '');
        await R.wait(1.5); G.audio.phone();
        await G.ui.lines([['Leo', '(mesaj) Kanka, The Cellar\'dayım. Kafanı dağıtmaya gel. Biriyle tanıştıracağım seni.']]);
      } },
    // ---------------------------------------------------------- G3 Vince
    { id: 'ch3_m03_vince', title: 'Vince ile Tanışma',
      setup: (R, G) => { prep(R, G, { time: 23.8, rain: 0.6, season: 'autumn', day: 3, forcePos: true, player: { x: -160 + 2, z: 165 }, sedanAt: { x: -260, z: 165, a: Math.PI / 2 } }); },
      async run(R, G, S) {
        const L = G.world.L; const l = leo(R, G, L.vinceBar.x + 3, L.vinceBar.z + 1); l.state = 'idle'; l.blip = '#b8864a';
        await goTo(R, G, L.vinceBar.x, L.vinceBar.z, '<b>The Cellar</b>\'a git — arka mahalleler (kuzeydoğu)', 8);
        if (G.playerCar) { G.ui.setObjective('Arabadan in'); await R.waitUntil(() => !G.playerCar); }
        l.blip = null; await G.ui.fade(1);
        await G.ui.cinematic({ image: IMG('ch3_03_vince_meeting.jpg'), title: 'Bölüm 3 · Görev 3 — Vince ile Tanışma', mood: 'night_rain', lines: [
          ['Leo', 'Vince, bu Jack. Anlattığım çocuk — küçük kasabadan, sağlam yumruklu.'],
          ['Vince', '(viskisini çevirir) Oakridge, ha? Oranın çocukları ya çok sessizdir ya çok tehlikeli. Sen hangisisin?'],
          ['Jack', 'Daha karar vermedim.'],
          ['Vince', '(gülümser) Dürüst. Sevdim. Bak Jack, bu şehir pahalı. Okul, kira, araba… Benim için gece birkaç paket taşırsın, sorusuz.'],
          ['Leo', 'Bir gecede bir aylık kira, kanka. Ben iki kere yaptım, hiçbir şey olmadı.'],
          ['Vince', 'Düşün. Ama çok düşünme. Fırsatlar bu barın kapısı gibidir: açılır, kapanır.'],
        ] });
        const c = await G.ui.choice('Vince\'in teklifi: gece kuryeliği. Ne yapacaksın?', ['Kabul et — Vince için çalış (yüksek kazanç, polis riski)', 'Reddet — temiz kal, Leo\'nun dayısının taksisinde gece çalış']);
        G.story.choices.bostonPath = c === 0 ? 'vince' : 'clean';
        if (c === 0) { G.story.streetRep += 10; await G.ui.subtitle('Vince', 'Akıllı çocuk. Yarın gece limandaki depoma gel. Ve kendini koru — al bunu.', 3); G.owned.pistol = true; G.ammo.pistol9mm += 24; G.money += 300; G.ui.toast('🔫 9mm Tabanca + 24 mermi + $300 avans (3 ile seç)', 'warn'); }
        else { G.story.peaceRep += 10; await G.ui.subtitle('Vince', '(soğuk) Nasıl istersen. Boston\'da temiz kalmak pahalıdır, Oakridge\'li.', 3); await G.ui.subtitle('Leo', 'Dayımın taksisi limanın orada duruyor. Gece vardiyası senin.', 2.6); }
        G.ui.toast('Silahlar artık açık: <b>Rusty\'s Pawn & Guns</b> (arka mahalleler) — C ile siper.', 'good');
        R.despawn(l); S.leo = null;
      } },
    // ---------------------------------------------------------- G4 Dallanma: Kurye veya Taksi
    { id: 'ch3_m04_gece_isi', title: 'Gece İşi',
      setup: (R, G) => { prep(R, G, { time: 22.5, rain: 0.2, season: 'autumn', day: 4, forcePos: true, player: { x: 330, z: 165 }, sedanAt: { x: 320, z: 165, a: Math.PI / 2 } }); },
      async run(R, G, S) {
        const L = G.world.L; const path = G.story.choices.bostonPath || 'clean';
        if (path === 'vince') {
          await goTo(R, G, L.vinceDepot.x, L.vinceDepot.z, '<b>Vince\'in deposu</b>\'na git ve paketi al (liman)', 8);
          await R.interactAt(() => L.vinceDepot, '[E] Paketi al', 4);
          G.audio.pickup(); G.ui.toast('📦 Paket alındı. Teslimat: kampüsün kuzeyi.');
          await G.ui.subtitle('Telsiz', '…tüm birimler, liman bölgesinde şüpheli araç…', 2.4);
          G.police.stars = 0; G.police.crime('murder', G.player.x, G.player.z); G.police.stars = 2;
          const drop = { x: -400, z: -330 }; let t = 160; const mk = R.marker(drop.x, drop.z, 0xff7a6a);
          G.ui.setObjective('Paketi teslim et (kuzeybatı) — polis peşinde! Polis arabalarını kaza yaptırarak yıldız düşürebilirsin');
          await R.waitUntil(() => { t -= R.dt; G.ui.meter(Math.max(0, t / 160), `SÜRE ${Math.ceil(t)} sn`); if (t <= 0) R.fail('Teslimat süresi doldu. Vince hoşnut değil.'); return R.near(drop.x, drop.z, 7) && (!G.playerCar || G.playerCar.speed < 4); });
          G.ui.meter(null); G.removeMarker(mk); G.ui.setObjective('');
          const pay = 1200 + Math.round(t) * 10; G.money += pay; G.audio.pickup(); G.ui.toast(`Teslimat tamam: +$${pay}. Bir de aranıyorsun — dikkat.`, 'good');
          await G.ui.subtitle('Vince', '(telefonda) Hızlıydın. Bunu unutmam, Jack.', 2.6);
        } else {
          const taxi = R.car({ kind: 'taxi', color: '#e8b730', x: 330, z: 172, a: Math.PI / 2 }); S.taxi = taxi;
          await G.ui.subtitle('Leo', '(mesaj) Taksi limanın girişinde. Anahtar güneşliğin arkasında. Bol bahşiş!', 2.6);
          G.ui.setObjective('Taksiye bin <b>[F]</b>'); await R.waitUntil(() => G.playerCar === taxi);
          const stories = [['Yolcu', 'Kızımın düğününe gidiyorum. Otuz yıl önce ben de bu yollarda taksicilik yaptım.'], ['Yolcu', 'Sınavdan çıktım, kafam patladı… Sen öğrenci misin? Dayan, ilk yıl hep zordur.'], ['Yolcu', 'Ayrıldık. Bu gece. Sadece sür, olur mu? Nereye olursa.']];
          for (let k = 0; k < 3; k++) {
            const pick = G.world.nodes.filter(n => { const d = Math.hypot(n.x - taxi.x, n.z - taxi.z); return d > 90 && d < 260; }); const pn = pick[(Math.random() * pick.length) | 0];
            const px = pn.x + 9, pz = pn.z + 12; const pas = R.spawn({ x: px, z: pz, role: 'story', female: Math.random() < .5 }); pas.blip = '#ffd36a'; pas.noTalk = true; pas.state = 'idle';
            await goTo(R, G, px - 6, pz - 5, `Yolcuyu al (${k + 1}/3)`, 9, taxi);
            pas.blip = null; R.board(pas, taxi);
            const dn = G.world.nodes.filter(n => { const d = Math.hypot(n.x - taxi.x, n.z - taxi.z); return d > 180 && d < 420; }); const dd = dn[(Math.random() * dn.length) | 0];
            G.ui.lines([stories[k]]); let t = 75 + Math.hypot(dd.x - taxi.x, dd.z - taxi.z) * 0.18; const t0 = t; const hp0 = taxi.hp; const mk = R.marker(dd.x + 3.5, dd.z + 3.5, 0xffd36a);
            G.ui.setObjective(`Yolcuyu bırak (${k + 1}/3) — hızlı ve hasarsız sür, bahşiş artar`);
            await R.waitUntil(() => { t -= R.dt; G.ui.meter(Math.max(0, t / t0), `SÜRE ${Math.max(0, Math.ceil(t))} sn`); return R.near(dd.x + 3.5, dd.z + 3.5, 9) && taxi.speed < 4; });
            G.ui.meter(null); G.removeMarker(mk); R.unboard(pas, taxi, -1); pas.ai = (dt) => pas.move(1, 0, 1.4, dt); setTimeout(() => R.despawn(pas), 4000);
            const pay = Math.round(80 + Math.max(0, t) * 1.5 - Math.max(0, hp0 - taxi.hp) * 1.2); G.money += Math.max(40, pay); G.audio.pickup(); G.ui.toast(`Ücret + bahşiş: +$${Math.max(40, pay)}`, 'good');
          }
          await G.ui.subtitle('Jack', '(içinden) Temiz para. Az ama… gece rahat uyuyorum.', 2.6);
        }
      } },
    // ---------------------------------------------------------- G5 Silah dükkanı ve ara sokak çatışması
    { id: 'ch3_m05_ara_sokak', title: 'Arka Sokakta Pusu',
      setup: (R, G) => { prep(R, G, { time: 0.6, rain: 0.4, season: 'winter', day: 6, forcePos: true, player: { x: 160 + 9, z: -200 }, sedanAt: { x: 172, z: -215, a: 0 } }); },
      async run(R, G, S) {
        const L = G.world.L; const path = G.story.choices.bostonPath || 'clean';
        await G.ui.fade(2.2, 'Aralık — Gece 00:40<br><small>' + (path === 'vince' ? 'Rakip satıcılar, Vince\'in yeni kuryesini öğrenmiş.' : 'Taksi gecesi sonrası biri seni takip ediyor.') + '</small>');
        if (!G.owned.pistol) { G.money = Math.max(G.money, 900); G.ui.toast('Kendini korumak için silah satıcısına uğra.'); }
        await goTo(R, G, L.gunShop.x, L.gunShop.z, '<b>Rusty\'s Pawn & Guns</b>\'a git ve silah/mermi al <b>[E]</b>', 3.2);
        await new Promise(res => { G.onShopClose = res; G.ui.shop(); }); G.onShopClose = null;
        if (!G.owned.pistol) { G.owned.pistol = true; G.ammo.pistol9mm += 12; G.ui.toast('Rusty: "Al şunu evlat, borcunu sonra ödersin." (9mm)', 'warn'); }
        if (G.player.weapon === 'fists') G.player.setWeaponMesh('pistol');
        await G.ui.subtitle('Rusty', 'Dikkat et çocuk… dışarıda biri seni soruyordu.', 2.4);
        const spots = [[L.gunShop.x + 22, L.gunShop.z + 14], [L.gunShop.x - 20, L.gunShop.z + 16], [L.gunShop.x + 30, L.gunShop.z - 2], [L.gunShop.x - 28, L.gunShop.z]];
        const foes = spots.map(([x, z], k) => { const f = R.spawn({ x, z, role: 'gang', look: THUG(), weapon: k < 3 ? 'pistol' : 'bat', hp: 75 }); f.target = G.player; f.blip = '#ff4040'; f.dmgMul = 0.6; return f; });
        foes[0].say(path === 'vince' ? 'Vince\'in yeni köpeği bu mu?!' : 'Taksici çocuk! Bahşişleri ver bakalım!', 3);
        G.ui.setObjective('Pusudan sağ çık! Siper al <b>[C]</b>, nişan: sağ tık, ateş: sol tık, silah: <b>1-5</b>');
        await R.waitUntil(() => foes.every(f => f.dead || f.hp <= 0));
        G.ui.setObjective(''); G.ui.toast('Pusu atlatıldı.', 'good'); G.police.clear();
        await G.ui.lines([['Jack', '(içinden) Oakridge\'de bir yumruk yüzünden kaçıyordum. Şimdi elimde bir silah var.'], ['Jack', '(Polaroid\'e bakar) …Simena beni böyle görse tanımazdı.']]);
      } },
  ],
  async onComplete(R, G) {
    await G.ui.chapterCard(3, 'Tamamlandı', 'Boston\'da ilk yıl bitti. Jack artık şehrin sokaklarını biliyor — ve sokaklar da onu.<br><br><b>Bölüm 4: Özgürlük, Deplasmanlar ve Amerika Turu</b> — yakında');
    G.story.chapter = 4; G.save({ chapter: 4, mission: 0 }); R.cleanup([]); G.timeScale = 0.02;
    G.ui.toast('Serbest dolaşım: Boston senin. Silah dükkânı açık.', 'good');
  },
};
