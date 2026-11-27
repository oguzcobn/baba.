// Polis & aranma sistemi (GTA: Chinatown Wars tarzı): 1-5 yıldız, devriye, takip, barikat, polis arabası saf dışı bırakarak yıldız düşürme
import { Ped } from './ped.js';
import { axes } from '../physics/collide.js';
import { angDiff } from '../world/population.js';

const CRIME = {
  assault: { stars: 1, needCop: true, radius: 35 },
  carjack: { stars: 1, needCop: true, radius: 40 },
  shooting: { stars: 1, needCop: true, radius: 70 },
  runover: { stars: 1, needCop: false },
  murder: { stars: 2, needCop: false },
  hitCop: { stars: 1, needCop: false, add: 1 },
  ramCop: { stars: 1, needCop: false },
  killCop: { stars: 3, needCop: false, add: 1 },
};

export class Police {
  constructor(game) { this.game = game; this.stars = 0; this.heat = 0; this.units = []; this.foot = []; this.lostT = 0; this.takedowns = 0; this.barricadeT = 0; this.flash = 0; this.spawnT = 0; this.enabled = true; this.bustT = 0; }
  copNear(x, z, r) {
    for (const p of this.game.peds) if (p.role === 'police' && !p.dead && Math.hypot(p.x - x, p.z - z) < r) return true;
    for (const v of this.game.vehicles) if (v.isPolice && v.driver && !v.broken && Math.hypot(v.x - x, v.z - z) < r) return true;
    return false;
  }
  crime(type, x, z) {
    if (!this.enabled) return; const c = CRIME[type]; if (!c) return;
    if (c.needCop && !this.copNear(x, z, c.radius) && this.stars === 0) return;
    const prev = this.stars;
    let ns = Math.max(this.stars, c.stars); if (c.add && this.stars > 0) ns = this.stars + c.add;
    if (type === 'murder' && this.stars >= 2) { this.heat += 1; if (this.heat >= 3) { ns = this.stars + 1; this.heat = 0; } }
    this.stars = Math.min(5, ns); this.lostT = 0;
    if (this.stars > prev) { this.flash = 2; this.game.ui.toast(this.stars === 1 ? '★ Polis seni arıyor!' : `★ Aranma seviyesi: ${this.stars}`, 'warn'); this.takedowns = 0; }
  }
  clear(msg) { this.stars = 0; this.heat = 0; this.takedowns = 0; if (msg) this.game.ui.toast(msg, 'good'); for (const u of this.units) if (u.ai) u.ai.mode = 'leave'; for (const f of this.foot) { f.state = 'leave'; } }
  get need() { return this.stars <= 2 ? 1 : 2; }
  takedown(car) {
    if (car._takenDown) return; car._takenDown = true; if (this.stars <= 0) return;
    this.takedowns++;
    if (this.takedowns >= this.need) {
      this.takedowns = 0; this.stars--; this.flash = 1.5;
      this.game.ui.toast(this.stars > 0 ? 'Polis saf dışı! Aranma azaldı ★' + '★'.repeat(this.stars - 1) : 'Polis saf dışı! Aranma bitti', 'good');
      if (this.stars === 0) this.clear();
    } else this.game.ui.toast(`Polis saf dışı! (${this.takedowns}/${this.need})`, 'good');
  }
  spawnUnit(barricade = false) {
    const g = this.game, pl = g.playerPos(); const pop = g.pop; const W = g.world;
    // oyuncudan 80-140m uzakta bir düğüm
    let cands = W.nodes.filter(n => { const d = Math.hypot(n.x - pl.x, n.z - pl.z); return d > 80 && d < 150; });
    if (barricade) {
      const v = g.playerCar ? { x: g.playerCar.vx, z: g.playerCar.vz } : { x: 0, z: 0 }; const sp = Math.hypot(v.x, v.z);
      if (sp < 5) return; cands = W.nodes.filter(n => { const dx = n.x - pl.x, dz = n.z - pl.z, d = Math.hypot(dx, dz); return d > 60 && d < 140 && (dx * v.x + dz * v.z) / (d * sp) > 0.85; });
    }
    if (!cands.length) return; const n = cands[(Math.random() * cands.length) | 0];
    if (g.vehicles.some(v => Math.hypot(v.x - n.x, v.z - n.z) < 10)) return;
    if (barricade) {
      const dir = g.playerCar ? Math.atan2(g.playerCar.vx, g.playerCar.vz) : 0;
      for (const s of [-1, 1]) { const off = s * 3.2; const c = g.addVehicle({ kind: 'police', x: n.x + Math.cos(dir) * off, z: n.z - Math.sin(dir) * off, a: dir + Math.PI / 2, color: '#f2f2f2' }); c.siren = true; c.barricade = true; c.ai = { type: 'barricade', t: 0 }; this.units.push(c); }
      for (let k = 0; k < 2; k++) this.spawnFootCop(n.x + (Math.random() - .5) * 6, n.z + (Math.random() - .5) * 6);
      g.ui.toast('Barikat ileride!', 'warn'); return;
    }
    const link = n.links[(Math.random() * n.links.length) | 0]; const ln = pop.laneOf(n.id, link);
    const car = g.addVehicle({ kind: 'police', x: n.x + ln.d.x * 12 + ln.rt.x * 3.5, z: n.z + ln.d.z * 12 + ln.rt.z * 3.5, a: Math.atan2(ln.d.x, ln.d.z), color: '#f2f2f2' });
    const drv = new Ped(g, { x: car.x, z: car.z, role: 'police', weapon: 'pistol' }); drv.vehicle = car; car.driver = drv; g.peds.push(drv);
    car.siren = true; car.ai = { type: 'police', mode: 'chase', repath: 0, route: null, stuck: 0, rev: 0 };
    this.units.push(car);
  }
  spawnFootCop(x, z) {
    const g = this.game; const p = new Ped(g, { x, z, role: 'police', weapon: this.stars >= 2 ? 'pistol' : 'fists', hp: 100 }); p.state = 'chase'; g.peds.push(p); this.foot.push(p); return p;
  }
  routeTo(car, tx, tz) {
    const W = this.game.world; const near = (x, z) => { let b = 0, bd = 1e9; W.nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; b = i; } }); return b; };
    const s = near(car.x, car.z), t = near(tx, tz); const prev = new Map([[s, -1]]); const q = [s];
    while (q.length) { const c = q.shift(); if (c === t) break; for (const nb of W.nodes[c].links) if (!prev.has(nb)) { prev.set(nb, c); q.push(nb); } }
    const path = []; let c = t; while (c !== undefined && c !== -1) { path.unshift(W.nodes[c]); c = prev.get(c); }
    return path;
  }
  updateUnit(car, dt) {
    const g = this.game, ai = car.ai, pop = g.pop; const pl = g.playerPos();
    if (car.broken || !car.driver || car.driver.vehicle !== car || car.hp < 18) {
      if (!car._takenDown && this.stars > 0 && Math.hypot(car.x - pl.x, car.z - pl.z) < 120) this.takedown(car);
      car.siren = false; car.ai = null; if (car.driver && car.driver.vehicle === car && !car.broken) { const d = pop.ejectDriver(car, false); if (d) { d.state = 'chase'; this.foot.push(d); } }
      return;
    }
    if (ai.type === 'barricade') { car.in.throttle = 0; car.in.brake = 1; car.in.steer = 0; return; }
    if (ai.mode === 'leave' || this.stars === 0) { car.siren = false; ai.mode = 'leave'; car.in.throttle = 0.4; car.in.brake = 0; car.in.steer = 0; return; }
    const d = Math.hypot(pl.x - car.x, pl.z - car.z);
    // yaya oyuncuya yakınsa in ve tutukla
    if (!g.playerCar && d < 14 && car.speed < 4) { const cop = pop.ejectDriver(car, false); if (cop) { cop.state = 'chase'; this.foot.push(cop); } car.ai = { type: 'parked' }; return; }
    let tx = pl.x, tz = pl.z;
    if (g.playerCar) { tx += g.playerCar.vx * 0.6; tz += g.playerCar.vz * 0.6; }
    if (d > 45) {
      ai.repath -= dt; if (ai.repath <= 0 || !ai.route) { ai.route = this.routeTo(car, pl.x, pl.z); ai.ri = 0; ai.repath = 2.5; }
      while (ai.route[ai.ri] && Math.hypot(ai.route[ai.ri].x - car.x, ai.route[ai.ri].z - car.z) < 12) ai.ri++;
      const n = ai.route[ai.ri]; if (n) { tx = n.x; tz = n.z; }
    }
    if (ai.rev > 0) { ai.rev -= dt; car.in.throttle = 0; car.in.brake = 1; car.in.steer = -Math.sign(angDiff(Math.atan2(tx - car.x, tz - car.z), car.a)); return; }
    const want = this.stars >= 3 ? 34 : 26;
    pop.driveTo(car, tx, tz, d < 15 ? Math.max(8, want * 0.6) : want, dt, false);
    if (car.speed < 1.2 && car.in.throttle > 0) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt * 2);
    if (ai.stuck > 1.6) { ai.rev = 1.1; ai.stuck = 0; }
  }
  updateFootCop(p, dt) {
    const g = this.game; if (p.dead || p.down || p.vehicle) return;
    if (p.state === 'leave' || this.stars === 0) { p.state = 'walk'; g.pop.reattach(p); p.role = 'police'; return; }
    const pl = g.player; const tx = g.playerPos().x, tz = g.playerPos().z; const d = Math.hypot(tx - p.x, tz - p.z);
    if (this.stars >= 2 && p.weapon === 'pistol' && d < 18 && d > 3.5) {
      p.move(0, 0, 0, dt); p.faceTo(Math.atan2(tx - p.x, tz - p.z), dt); p.aiming = true;
      p.shootT = (p.shootT ?? 0.8) - dt; if (p.shootT <= 0) { p.shootT = 0.7 + Math.random() * 0.8; g.combat.fire(p, tx - p.x, tz - p.z, 0.16); }
      return;
    }
    p.aiming = false;
    if (!g.playerCar && d < 1.6 && !pl.down && this.stars <= 2) { p.move(0, 0, 0, dt); this.bustT += dt; p.say('Kıpırdama! Tutuklusun!', 1); if (this.bustT > 1.4) { this.bustT = 0; g.busted(); } return; }
    g.pop.updateFighter(p, dt, pl, { speed: 6.3 });
  }
  update(dt) {
    const g = this.game; this.flash = Math.max(0, this.flash - dt);
    this.units = this.units.filter(u => g.vehicles.includes(u)); this.foot = this.foot.filter(f => g.peds.includes(f) && !f.dead);
    for (const u of this.units) if (u.ai && (u.ai.type === 'police' || u.ai.type === 'barricade')) this.updateUnit(u, dt);
    for (const f of this.foot) if (f.state === 'chase' || f.state === 'leave' || f.state === 'fight') this.updateFootCop(f, dt);
    if (!this.enabled) return;
    if (this.stars > 0) {
      const pl = g.playerPos();
      const want = [0, 1, 2, 3, 4, 5][this.stars]; const active = this.units.filter(u => u.ai && u.ai.type === 'police').length;
      this.spawnT -= dt; if (active < want && this.spawnT <= 0) { this.spawnUnit(); this.spawnT = 3; }
      if (this.stars >= 1 && this.foot.length < Math.min(4, this.stars + 1) && Math.random() < dt * 0.3 && !g.playerCar) { const a = Math.random() * 6.28; this.spawnFootCop(pl.x + Math.cos(a) * 45, pl.z + Math.sin(a) * 45); }
      if (this.stars >= 3) { this.barricadeT -= dt; if (this.barricadeT <= 0) { this.barricadeT = 22; this.spawnUnit(true); } }
      // gizlenerek kaçma (yavaş)
      const near = this.copNear(pl.x, pl.z, 55);
      if (!near) { this.lostT += dt; if (this.lostT > 18 + this.stars * 6) { this.lostT = 0; this.stars--; g.ui.toast(this.stars ? 'Polisi biraz atlattın' : 'Polisi tamamen atlattın', 'good'); if (!this.stars) this.clear(); } }
      else this.lostT = Math.max(0, this.lostT - dt * 2);
      g.audio.setSiren(this.units.some(u => u.siren && Math.hypot(u.x - pl.x, u.z - pl.z) < 90) ? 1 : 0);
    } else g.audio.setSiren(0);
    // uzak polisleri temizle
    for (const u of this.units) if ((u.ai?.mode === 'leave' || !u.ai) && Math.hypot(u.x - g.player.x, u.z - g.player.z) > 160) g.removeVehicle(u);
  }
}
