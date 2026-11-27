// Görev yürütücü: async görev adımları, bekleme koşulları, başarısızlık & kontrol noktasından tekrar
import { Ped } from '../entities/ped.js';
import { axes } from '../physics/collide.js';

export class Fail extends Error {}

export class MissionRunner {
  constructor(game, chapter) {
    this.game = game; this.chapter = chapter; this.waiters = []; this.failIfs = []; this.spawned = []; this.active = false; this.S = {}; this.idx = 0;
  }
  waitUntil(pred) { return new Promise((res, rej) => this.waiters.push({ pred, res, rej })); }
  wait(sec) { let t = 0; return this.waitUntil(() => (t += this.dt || 0) >= sec); }
  failIf(pred, reason) { const f = { pred, reason }; this.failIfs.push(f); return f; }
  update(dt) {
    this.dt = dt; if (!this.active) return;
    for (const f of this.failIfs) if (f.pred()) { this.fail(f.reason); return; }
    const ws = this.waiters; this.waiters = [];
    for (const w of ws) { let ok = false; try { ok = w.pred(); } catch (e) { console.error(e); } if (ok) w.res(); else this.waiters.push(w); }
  }
  fail(reason) {
    if (!this.active || this.failing) return; this.failing = true; this.failReason = reason;
    const ws = this.waiters; this.waiters = []; for (const w of ws) w.rej(new Fail(reason));
  }
  // ------- yardımcılar
  spawn(o) { const p = new Ped(this.game, { ...o, persistent: true }); this.game.peds.push(p); this.spawned.push(p); return p; }
  despawn(p) { if (!p) return; this.game.removePed(p); this.spawned = this.spawned.filter(q => q !== p); }
  car(o) { const v = this.game.addVehicle(o); v.persistent = true; this.spawned.push(v); return v; }
  marker(x, z, color) { return this.game.addMarker(x, z, color); }
  inCar(car) { return this.game.playerCar === car; }
  near(x, z, r) { const p = this.game.playerPos(); return Math.hypot(p.x - x, p.z - z) < r; }
  interactAt(getPos, label, r = 2.6) {
    let done = false; const G = this.game;
    return this.waitUntil(() => { const q = getPos(); if (!done) G.interact = { x: q.x, z: q.z, r, label, fn: () => { done = true; } }; return done; });
  }
  walkTo(p, x, z, speed = 1.6, r = 0.8) { p.ai = (dt) => { const dx = x - p.x, dz = z - p.z; if (Math.hypot(dx, dz) < r) { p.move(0, 0, 0, dt); return; } p.move(dx, dz, speed, dt); }; return this.waitUntil(() => Math.hypot(x - p.x, z - p.z) < r + 0.2); }
  board(p, car) { p.ai = null; p.vehicle = car; if (!car.passengers.includes(p)) car.passengers.push(p); this.game.audio.door(); }
  unboard(p, car, side = -1) { const { rx, rz } = axes(car.a); p.vehicle = null; car.passengers = car.passengers.filter(q => q !== p); p.x = car.x + rx * side * (car.hx + 0.8) + Math.sin(car.a) * (Math.random() - .5); p.z = car.z + rz * side * (car.hx + 0.8) + Math.cos(car.a) * (Math.random() - .5); p.a = car.a; this.game.audio.door(); }
  cleanup(keep = []) {
    for (const e of this.spawned) { if (keep.includes(e)) continue; if (e.passengers !== undefined) { if (e === this.game.playerCar) this.game.exitVehicle(); this.game.removeVehicle(e); } else this.game.removePed(e); }
    this.spawned = this.spawned.filter(e => keep.includes(e));
    if (this.onCleanup) { try { this.onCleanup(); } catch (e) { } this.onCleanup = null; }
    this.game.clearMarkers(); this.failIfs = []; this.waiters = []; this.game.interact = null; this.game.ui.setObjective(''); this.game.camOverride = null;
  }
  async run(startIdx = 0) {
    const G = this.game; this.active = true; this.idx = startIdx;
    const ms = this.chapter.missions;
    while (this.idx < ms.length) {
      const m = ms[this.idx]; this.failing = false;
      try {
        G.save?.({ chapter: this.chapter.num, mission: this.idx });
        if (m.setup) await m.setup(this, G);
        await m.run(this, G, this.S);
        this.failIfs = []; this.waiters = []; this.idx++;
      } catch (e) {
        this.retry = true;
        if (!(e instanceof Fail)) { console.error(e); this.failReason = 'Beklenmeyen hata: ' + e.message; }
        this.active = false; G.ui.banner('GÖREV BAŞARISIZ', '#e2574c', this.failReason);
        await new Promise(r => setTimeout(r, 1600));
        await G.ui.failScreen(this.failReason);
        this.cleanup([]); this.S = {}; G.police.clear(); this.active = true;
        await G.ui.fade(1);
      }
    }
    this.active = false;
    if (this.chapter.onComplete) await this.chapter.onComplete(this, G);
  }
}
