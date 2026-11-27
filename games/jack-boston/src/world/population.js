// Trafik ve yaya nüfusu + yapay zeka (şerit takibi, kaldırım yürüyüşü, kaçma, kavga)
import { Vehicle, CAR_COLORS } from '../entities/vehicle.js';
import { Ped } from '../entities/ped.js';
import { axes } from '../physics/collide.js';

export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const LANE = 3.5;

const CHATTER = [
  'Güzel akşam, değil mi?', 'Kafedeki elmalı turta efsane.', 'Sahil yolu gün batımında harika.', 'Lise maçı bu cuma, gelecek misin?',
  'Marcus yine bir arabayı mı söktü?', 'Fenerin oraya hiç gittin mi? Manzara bambaşka.', 'Sanayide gece yarış oluyormuş, duydun mu?', 'Kütüphane yeni kitaplar getirmiş.',
  'Bu kasabada her şey yavaş… ben böyle seviyorum.', 'Tommy\'nin babası yine yeni araba almış.', 'Yağmur yağacak gibi.', 'Simena Books\'un kurabiyeleri de var biliyor musun?',
  'Selam, nasılsın?', 'Dikkatli sür evlat!', 'Boston mu? Çok uzak orası…', 'Otobüs deposundaki şoförler hep kahve içer.',
];
const ANGRY = ['Ne yapıyorsun be?!', 'Sana gösteririm!', 'Polis! Polis!', 'Hey! Dur!', 'Kafayı mı yedin?!'];
const FLEE = ['İmdat!', 'Kaçın!', 'Aman tanrım!', 'Deli bu!'];
export { CHATTER };

export class Population {
  constructor(game) {
    this.game = game; this.world = game.world; this.trafficTarget = 14; this.pedTarget = 34; this.enabled = true;
    // kaldırım komşulukları
    const segs = this.world.sidewalkSegs; this.ends = [];
    segs.forEach((s, i) => { this.ends.push({ x: s.ax, z: s.az, seg: i, end: 0 }, { x: s.bx, z: s.bz, seg: i, end: 1 }); });
    for (const e of this.ends) e.adj = this.ends.filter(o => o !== e && o.seg !== e.seg && Math.hypot(o.x - e.x, o.z - e.z) < 2.6);
  }
  // ---------- TRAFİK
  laneOf(fromId, toId) {
    const A = this.world.nodes[fromId], B = this.world.nodes[toId]; const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz); const d = { x: dx / L, z: dz / L }, rt = { x: -d.z, z: d.x };
    return { A, B, d, rt, L };
  }
  buildPath(car) {
    const ai = car.ai; const ln = this.laneOf(ai.from, ai.to); const pts = [];
    const endA = this.world.nodes[ai.from].links.length > 1 ? 10 : 2, endB = this.world.nodes[ai.to].links.length > 1 ? 10 : 3;
    pts.push({ x: ln.A.x + ln.d.x * endA + ln.rt.x * LANE, z: ln.A.z + ln.d.z * endA + ln.rt.z * LANE });
    pts.push({ x: ln.B.x - ln.d.x * endB + ln.rt.x * LANE, z: ln.B.z - ln.d.z * endB + ln.rt.z * LANE });
    // sonraki kenar
    const links = this.world.nodes[ai.to].links.filter(n => n !== ai.from); const next = links.length ? links[(Math.random() * links.length) | 0] : ai.from;
    const ln2 = this.laneOf(ai.to, next); const s2 = { x: ln2.A.x + ln2.d.x * 10 + ln2.rt.x * LANE, z: ln2.A.z + ln2.d.z * 10 + ln2.rt.z * LANE };
    const p0 = pts[1]; let cx = ln.B.x + ln.rt.x * LANE + ln2.rt.x * LANE, cz = ln.B.z + ln.rt.z * LANE + ln2.rt.z * LANE;
    if (next === ai.from) { cx = ln.B.x + ln.d.x * 4; cz = ln.B.z + ln.d.z * 4; }
    for (let t = 0.25; t <= 1.001; t += 0.25) { const u = 1 - t; pts.push({ x: u * u * p0.x + 2 * u * t * cx + t * t * s2.x, z: u * u * p0.z + 2 * u * t * cz + t * t * s2.z }); }
    ai.path = pts; ai.wp = 1; ai.next = next;
  }
  spawnTraffic(px, pz, minD = 75, maxD = 170, opts = {}) {
    const W = this.world; for (let tries = 0; tries < 12; tries++) {
      const a = W.nodes[(Math.random() * W.nodes.length) | 0]; const b = W.nodes[a.links[(Math.random() * a.links.length) | 0]];
      const ln = this.laneOf(a.id, b.id); const t = 12 + Math.random() * (ln.L - 24); if (ln.L < 30) continue;
      const x = a.x + ln.d.x * t + ln.rt.x * LANE, z = a.z + ln.d.z * t + ln.rt.z * LANE; const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) continue;
      if (this.game.vehicles.some(v => Math.hypot(v.x - x, v.z - z) < 9)) continue;
      const kind = opts.kind || (Math.random() < 0.1 ? 'taxi' : Math.random() < 0.15 ? 'pickup' : Math.random() < 0.3 ? 'hatch' : Math.random() < 0.08 ? 'muscle' : Math.random() < 0.1 ? 'coupe' : 'sedan');
      const car = this.game.addVehicle({ kind, x, z, a: Math.atan2(ln.d.x, ln.d.z), color: kind === 'taxi' ? '#e8b730' : opts.color });
      car.ai = { type: 'traffic', from: a.id, to: b.id, cruise: 10 + Math.random() * 4, stuck: 0, honkT: 0 };
      const fs = Math.sin(car.a), fc = Math.cos(car.a); car.vx = fs * 8; car.vz = fc * 8;
      this.buildPath(car); car.ai.wp = 1;
      const drv = new Ped(this.game, { x, z }); drv.vehicle = car; car.driver = drv; this.game.peds.push(drv);
      return car;
    }
    return null;
  }
  driveTo(car, tx, tz, desired, dt, avoid = true) {
    const dx = tx - car.x, dz = tz - car.z; const want = Math.atan2(dx, dz); const diff = angDiff(want, car.a);
    const vF = car.fwdSpeed; let st = Math.max(-1, Math.min(1, -diff * 2.2));
    if (vF < -0.5) st = -st;
    let target = desired * (1 - Math.min(0.65, Math.abs(diff) * 0.9));
    let blocked = 0;
    if (avoid) blocked = this.obstacleAhead(car, Math.max(8, vF * 1.4 + 6));
    if (blocked) target = Math.min(target, Math.max(0, (blocked - 5) * 0.8));
    car.in.steer = st; car.in.hand = false;
    if (vF < target - 0.5) { car.in.throttle = 1; car.in.brake = 0; } else if (vF > target + 1.5) { car.in.throttle = 0; car.in.brake = Math.min(1, (vF - target) / 6); } else { car.in.throttle = 0.3; car.in.brake = 0; }
    return { blocked, diff };
  }
  obstacleAhead(car, range) {
    const { fx, fz, rx, rz } = axes(car.a); let best = 0;
    const check = (x, z, w) => { const dx = x - car.x, dz = z - car.z; const f = dx * fx + dz * fz, l = dx * rx + dz * rz; if (f > car.hz && f < range && Math.abs(l) < 1.6 + w) { const d = f - car.hz; if (!best || d < best) best = d; } };
    for (const v of this.game.vehicles) if (v !== car && Math.abs(v.x - car.x) < range + 4 && Math.abs(v.z - car.z) < range + 4) check(v.x, v.z, v.hx);
    for (const p of this.game.peds) if (!p.vehicle && !p.dead && Math.abs(p.x - car.x) < range && Math.abs(p.z - car.z) < range) check(p.x, p.z, 0.4);
    return best;
  }
  updateTrafficCar(car, dt) {
    const ai = car.ai; const drv = car.driver;
    if (!drv || drv.dead || drv.vehicle !== car) { car.ai = null; return; }
    if (car.broken) { this.ejectDriver(car, true); return; }
    if (ai.panic > 0) ai.panic -= dt;
    let wp = ai.path[ai.wp];
    while (wp && Math.hypot(wp.x - car.x, wp.z - car.z) < 5.5) { ai.wp++; wp = ai.path[ai.wp]; }
    if (!wp) { ai.from = ai.to; ai.to = ai.next; this.buildPath(car); wp = ai.path[ai.wp]; }
    // geride kalan yol noktası varsa yeniden planla (çarpışma sonrası)
    const desired = ai.panic > 0 ? ai.cruise * 1.8 : ai.cruise;
    const res = this.driveTo(car, wp.x, wp.z, desired, dt, !(ai.ignoreT > 0));
    if (ai.ignoreT > 0) ai.ignoreT -= dt;
    if (car.speed < 0.6) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt);
    if (ai.stuck > 3 && res.blocked && ai.honkT <= 0) { ai.honkT = 4; if (Math.hypot(car.x - this.game.player.x, car.z - this.game.player.z) < 40) { this.game.audio.horn(); drv.say(['Hadi be!', 'Çekil yoldan!', 'Yol ver!'][(Math.random() * 3) | 0], 2); } }
    ai.honkT -= dt;
    if (ai.stuck > 7) { ai.ignoreT = 2.5; ai.stuck = 0; }
    // çok uzaklaştıysa yolu yeniden kur
    if (Math.hypot(wp.x - car.x, wp.z - car.z) > 40) this.rehome(car);
  }
  rehome(car) {
    // en yakın kenarı bul
    const W = this.world; let best = null, bd = 1e9;
    for (const n of W.nodes) for (const m of n.links) { const ln = this.laneOf(n.id, m); const t = Math.max(0, Math.min(ln.L, (car.x - n.x) * ln.d.x + (car.z - n.z) * ln.d.z)); const px = n.x + ln.d.x * t + ln.rt.x * LANE, pz = n.z + ln.d.z * t + ln.rt.z * LANE; const d = Math.hypot(px - car.x, pz - car.z) + Math.abs(angDiff(Math.atan2(ln.d.x, ln.d.z), car.a)) * 6; if (d < bd) { bd = d; best = [n.id, m]; } }
    if (best) { car.ai.from = best[0]; car.ai.to = best[1]; this.buildPath(car); car.ai.wp = 1; }
  }
  ejectDriver(car, flee = true) {
    const d = car.driver; if (!d) return; d.vehicle = null; car.driver = null; car.ai = null;
    const { rx, rz } = axes(car.a); d.x = car.x + rx * (car.hx + 0.6); d.z = car.z + rz * (car.hx + 0.6); d.state = flee ? 'flee' : 'walk'; d.stateT = 0; d.fleeFrom = { x: this.game.player.x, z: this.game.player.z };
    return d;
  }
  // ---------- YAYALAR
  spawnPed(px, pz, minD = 30, maxD = 110) {
    const segs = this.world.sidewalkSegs;
    for (let tries = 0; tries < 10; tries++) {
      const si = (Math.random() * segs.length) | 0, s = segs[si]; if (s.cross) continue; const t = Math.random();
      const x = s.ax + (s.bx - s.ax) * t, z = s.az + (s.bz - s.az) * t; const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) continue;
      const p = new Ped(this.game, { x, z, female: Math.random() < 0.45 });
      p.walk = { seg: si, dir: Math.random() < 0.5 ? 1 : 0, off: (Math.random() - .5) * 2.4 };
      p.walkSpeed = 1.2 + Math.random() * 0.6; this.game.peds.push(p); return p;
    }
  }
  updateCivilian(p, dt) {
    const g = this.game, pl = g.player;
    if (p.state === 'walk' || p.state === 'idle') {
      if (!p.walk) { p.state = 'idle'; p.move(0, 0, 0, dt); return; }
      const s = this.world.sidewalkSegs[p.walk.seg]; const tx = p.walk.dir ? s.bx : s.ax, tz = p.walk.dir ? s.bz : s.az;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      // yanal ofset
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1, nx = -(s.bz - s.az) / L, nz = (s.bx - s.ax) / L;
      const ox = tx + nx * p.walk.off * (p.walk.dir ? 1 : -1), oz = tz + nz * p.walk.off * (p.walk.dir ? 1 : -1);
      if (d < 1.8) {
        const e = this.ends[p.walk.seg * 2 + p.walk.dir]; let opts = e.adj; const nonCross = opts.filter(o => !this.world.sidewalkSegs[o.seg].cross);
        if (nonCross.length && Math.random() < 0.75) opts = nonCross;
        if (!opts.length) { p.walk.dir ^= 1; return; }
        const n = opts[(Math.random() * opts.length) | 0]; p.walk.seg = n.seg; p.walk.dir = n.end === 0 ? 1 : 0;
        return;
      }
      // karşıdan karşıya geçerken araç yaklaşıyorsa bekle
      let sp = p.walkSpeed;
      if (s.cross) for (const v of g.vehicles) if (v.speed > 4 && Math.hypot(v.x - p.x, v.z - p.z) < 14) { sp = 0; break; }
      if (p.state === 'idle') sp = 0;
      p.move(ox - p.x, oz - p.z, sp, dt);
      return;
    }
    if (p.state === 'flee') {
      const f = p.fleeFrom || pl; let dx = p.x - f.x, dz = p.z - f.z; const d = Math.hypot(dx, dz) || 1;
      p.move(dx / d, dz / d, 6.2, dt);
      if (p.stateT > 7 + Math.random() * 3 && d > 30) { p.state = 'walk'; p.stateT = 0; this.reattach(p); }
      return;
    }
    if (p.state === 'fight') return this.updateFighter(p, dt, p.target || pl);
    if (p.state === 'talk') { p.move(0, 0, 0, dt); p.faceTo(Math.atan2(pl.x - p.x, pl.z - p.z), dt); if (p.stateT > 4) { p.state = 'walk'; p.stateT = 0; } return; }
    if (p.state === 'cower') { p.move(0, 0, 0, dt); if (p.stateT > 3) { p.state = 'flee'; p.stateT = 0; } return; }
  }
  reattach(p) {
    let best = -1, bd = 1e9; const segs = this.world.sidewalkSegs;
    segs.forEach((s, i) => { if (s.cross) return; const d = Math.min(Math.hypot(s.ax - p.x, s.az - p.z), Math.hypot(s.bx - p.x, s.bz - p.z)); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) p.walk = { seg: best, dir: Math.random() < .5 ? 1 : 0, off: (Math.random() - .5) * 2.4 };
  }
  // Ortak dövüşçü YZ'si (çete, sinirli sivil, Tommy, yaya polis)
  updateFighter(p, dt, target, o = {}) {
    const g = this.game; if (!target || target.dead) { p.state = p.role === 'civ' ? 'walk' : 'idle'; p.move(0, 0, 0, dt); return; }
    const tx = target.vehicle ? target.vehicle.x : target.x, tz = target.vehicle ? target.vehicle.z : target.z;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    const reach = target.vehicle ? target.vehicle.hx + 1.4 : 1.35;
    const runSp = o.speed || (p.role === 'gang' ? 6.6 : p.role === 'police' ? 6.4 : 5.8);
    if (p.attackT >= 0) { p.faceTo(Math.atan2(dx, dz), dt, 8); return; }
    if (d > reach) {
      // jetonu olmayan yakına gelmesin, etrafında dolaşsın
      if (target.isPlayer && !g.tokens.has(p) && g.tokens.size >= 2 && d < 4) {
        const ang = Math.atan2(p.x - tx, p.z - tz) + dt * 0.8; p.move(tx + Math.sin(ang) * 3.2 - p.x, tz + Math.cos(ang) * 3.2 - p.z, 2.5, dt, false); p.faceTo(Math.atan2(dx, dz), dt); return;
      }
      p.move(dx, dz, d < 4 ? Math.min(runSp, 3.5) : runSp, dt);
      return;
    }
    p.move(0, 0, 0, dt); p.faceTo(Math.atan2(dx, dz), dt);
    p.cool = (p.cool || 0) - dt;
    if (p.cool <= 0) {
      if (target.isPlayer && !target.vehicle) { if (g.tokens.size >= 2 && !g.tokens.has(p)) return; g.tokens.add(p); p.tokenT = 1.2; }
      if (p.startAttack()) { p.cool = 0.7 + Math.random() * 0.9; g.audio.whoosh(); }
    }
  }
}
Population.prototype.updateShooter = function (p, dt, target) {
  const g = this.game; if (!target || target.dead) { p.move(0, 0, 0, dt); return; }
  const tx = target.vehicle ? target.vehicle.x : target.x, tz = target.vehicle ? target.vehicle.z : target.z; const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  p.strafe = p.strafe ?? (Math.random() < .5 ? 1 : -1); p.aiming = d < 22;
  if (d > 16) p.move(dx, dz, 5.2, dt);
  else if (d < 7) p.move(-dx, -dz, 3.5, dt, false);
  else { if (Math.random() < dt * 0.4) p.strafe *= -1; p.move(-dz * p.strafe, dx * p.strafe, 2.2, dt, false); }
  p.faceTo(Math.atan2(dx, dz), dt, 10);
  p.shootT = (p.shootT ?? 1 + Math.random()) - dt;
  if (d < 22 && p.shootT <= 0 && g.world.statics.raycast(p.x, p.z, dx / d, dz / d, d) >= d - 1) { p.shootT = 0.9 + Math.random() * 1.1; g.combat.fire(p, dx, dz, 0.06); }
};
export { ANGRY, FLEE, CAR_COLORS };
