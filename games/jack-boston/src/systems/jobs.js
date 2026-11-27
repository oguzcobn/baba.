// Boston meslekleri: Barmenlik (tarif/ritim mini oyunu), Yeraltı Dövüş Kulübü (3 raunt + bahis), Silah dükkânı
const ING = ['Viski', 'Cin', 'Tonik', 'Buz', 'Limon', 'Şeker', 'Bira'];
const RECIPES = [
  ['Old Fashioned', [5, 0, 3]], ['Cin Tonik', [3, 1, 2, 4]], ['Bira', [6]], ['Whiskey Sour', [0, 4, 5, 3]], ['Tom Collins', [1, 4, 5, 2]], ['Viski Buzlu', [0, 3]],
];
const GOSSIP = ['"Vince\'in adamları her perşembe limanda mal indiriyor…"', '"Stadyumun arkasında bir deplasman otobüsü kalkıyormuş, ucuz bilet."', '"Rusty yeni pompalılar getirmiş, ama pahalı."', '"Kampüsteki kafede yeni bir barista var, herkes ondan bahsediyor."', '"Dövüş kulübünde \'Kasap\' diye biri yenilmiyormuş."'];

export class Jobs {
  constructor(game) { this.game = game; this.busy = false; }
  register() {
    const g = this.game, S = g.staticInteracts;
    S.push({ world: 'boston', r: 3.5, cond: () => g.story.chapter >= 3, pos: () => g.world.L.gunShop, label: () => '[E] Rusty\'s Pawn & Guns — alışveriş', fn: () => g.ui.shop() });
    S.push({ world: 'boston', r: 3.5, cond: () => g.story.chapter >= 3 && !this.busy, pos: () => g.world.L.bars, label: () => '[E] Barmenlik — bir vardiya çalış ($150-350)', fn: () => this.bartend() });
    S.push({ world: 'boston', r: 3.5, cond: () => g.story.chapter >= 3 && !this.busy, pos: () => g.world.L.fightClub, label: () => '[E] Yeraltı Dövüş Kulübü — bahisli 3 raunt', fn: () => this.fightClub() });
  }
  // ---------------- BARMENLİK
  bartend() {
    const g = this.game; if (this.busy) return; this.busy = true; g.cutscene = true;
    const b = document.getElementById('choicebox'); let n = 0, score = 0, cur, idx, t, last = performance.now(), run = true;
    const next = () => { if (n >= 6) return end(); cur = RECIPES[(Math.random() * RECIPES.length) | 0]; idx = 0; t = 9 - n * 0.6; n++; draw(); };
    const draw = () => {
      b.innerHTML = `<h2>The Anchor — Bar</h2><p>Sipariş ${n}/6: <b style="color:#e7c77a">${cur[0]}</b></p>
      <div class="bar-rec">${cur[1].map((k, i) => `<span class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${k + 1} · ${ING[k]}</span>`).join('')}</div>
      <div class="bar-ing">${ING.map((s, i) => `<button class="choice" data-k="${i}">${i + 1}. ${s}</button>`).join('')}</div>
      <div id="meterIn" style="height:8px;background:#333;border-radius:4px;margin:10px auto;width:300px;overflow:hidden"><i style="display:block;height:100%;width:${(t / 9) * 100}%;background:#e7c77a"></i></div><small>Tarifteki sırayla malzemeleri ekle (1-7 tuşları veya tıkla)</small>`;
      b.querySelectorAll('.choice').forEach(x => x.onclick = () => press(+x.dataset.k));
    };
    const press = (k) => { if (!run) return; if (k === cur[1][idx]) { idx++; g.audio.tone({ f0: 700 + idx * 120, f1: 900, dur: 0.08, type: 'triangle', gain: 0.12 }); if (idx >= cur[1].length) { score += 25 + Math.round(t * 6); g.audio.pickup(); next(); return; } } else { score -= 8; g.audio.tone({ f0: 200, f1: 150, dur: 0.12, type: 'square', gain: 0.1 }); } draw(); };
    const kf = (e) => { const k = +e.key; if (k >= 1 && k <= 7) press(k - 1); };
    const tick = () => { if (!run) return; const now = performance.now(); t -= (now - last) / 1000; last = now; const m = b.querySelector('#meterIn i'); if (m) m.style.width = Math.max(0, t / 9 * 100) + '%'; if (t <= 0) { score -= 10; next(); } requestAnimationFrame(tick); };
    const end = () => {
      run = false; removeEventListener('keydown', kf); const pay = Math.max(150, Math.min(350, 150 + score)); g.money += pay; g.story.peaceRep += 1;
      b.innerHTML = `<h2>Vardiya bitti</h2><p>Kazanç + bahşiş: <b style="color:#9fe39a">$${pay}</b></p><p>Kulağına çalınan: ${GOSSIP[(Math.random() * GOSSIP.length) | 0]}</p><button class="choice" style="text-align:center">Tamam</button>`;
      b.querySelector('button').onclick = () => { b.classList.remove('show'); g.cutscene = false; this.busy = false; g.save({}); };
    };
    addEventListener('keydown', kf); b.classList.add('show'); next(); requestAnimationFrame(tick);
  }
  // ---------------- DÖVÜŞ KULÜBÜ
  async fightClub() {
    const g = this.game; if (this.busy) return; this.busy = true;
    const c = await g.ui.choice(`THE PIT — 3 raunt yakın dövüş. Bahsin ne?<br><small>Bakiye $${g.money}</small>`, ['$100 (kazanırsan ×2.5)', '$500 (kazanırsan ×2.5)', '$1000 (kazanırsan ×2.5)', 'Vazgeç']);
    const bet = [100, 500, 1000][c]; if (!bet || g.money < bet) { if (bet) g.ui.toast('Bahse yetecek paran yok', 'bad'); this.busy = false; return; }
    g.money -= bet; const L = g.world.L; const rx = L.fightClub.x, rz = L.fightClub.z + 40; const P = g.player.constructor;
    await g.ui.fade(1.2, 'THE PIT<br><small>Kalabalık uğulduyor…</small>');
    g.player.x = rx; g.player.z = rz + 3; g.player.hp = 100; g.player.setWeaponMesh('fists'); g.lockCar = true;
    const crowd = []; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const q = new P(g, { x: rx + Math.cos(a) * 7.5, z: rz + Math.sin(a) * 7.5 }); q.state = 'cheer'; q.persistent = true; q.noTalk = true; q.ai = (dt) => { q.move(0, 0, 0, dt); q.a = Math.atan2(rx - q.x, rz - q.z); }; g.peds.push(q); crowd.push(q); }
    g.camOverride = { x: rx, z: rz, dist: 30 }; const names = ['Sokak Köpeği Ray', 'Demir Dante', 'Kasap']; let wins = 0;
    for (let rd = 0; rd < 3; rd++) {
      g.ui.banner(`RAUNT ${rd + 1}`, '#e7c77a', names[rd]); g.player.hp = 100; g.player.x = rx; g.player.z = rz + 3;
      const o = new P(g, { x: rx, z: rz - 3, role: 'gang', hp: 70 + rd * 30, look: { skin: ['#e0ac85', '#8d5a3b', '#f1c9a5'][rd], hair: '#1a1a1a', shirt: '#2a2a2a', pants: '#3a1a1a', shirtKind: 'shirt' } });
      o.persistent = true; o.nonLethal = true; o.dmgMul = 0.75 + rd * 0.15; o.target = g.player; o.name = names[rd]; g.peds.push(o);
      const res = await new Promise(res2 => { const iv = setInterval(() => { if (g.paused) return; if (o.hp <= 0) { clearInterval(iv); res2(true); } else if (g.player.hp < 16) { clearInterval(iv); g.player.hp = 60; res2(false); } }, 100); });
      g.tokens.clear(); setTimeout(() => g.removePed(o), 1500);
      if (res) { wins++; g.ui.toast(`${names[rd]} yere serildi!`, 'good'); } else { g.ui.toast('Nakavt oldun…', 'bad'); break; }
      await new Promise(r => setTimeout(r, 1800));
    }
    for (const q of crowd) g.removePed(q); g.camOverride = null; g.lockCar = false; g.player.hp = Math.max(g.player.hp, 50);
    if (wins === 3) { const pay = Math.round(bet * 2.5); g.money += pay; g.story.streetRep += 5; g.ui.banner('ŞAMPİYON', '#7bd389', `+$${pay}`); } else g.ui.banner('KAYBETTİN', '#e2574c', `${wins}/3 raunt — bahis gitti`);
    g.player.x = L.fightClub.x; g.player.z = L.fightClub.z - 2; this.busy = false; g.save({});
  }
}
