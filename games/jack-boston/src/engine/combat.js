// Dövüş & ateşli silahlar: yakın dövüş vuruşu, hitstop, raycast atış, bloom, kovan, ses yarıçapı
import { rayCircle, rayObb, axes } from '../physics/collide.js';
import { FLEE, ANGRY } from '../world/population.js';

export const WEAPONS = {
  fists: { name: 'Yumruk', icon: '✊', melee: true, dmg: 11 },
  bat: { name: 'Beyzbol Sopası', icon: '🏏', melee: true, dmg: 26 },
  pistol: { name: '9mm Tabanca', icon: '🔫', dmg: 34, rate: 0.28, spread: 0.035, bloom: 0.05, ammoKey: 'pistol9mm', noise: 70, clip: 12 },
  silenced: { name: 'Susturuculu', icon: '🔇', dmg: 30, rate: 0.3, spread: 0.03, bloom: 0.04, ammoKey: 'silenced9mm', noise: 12, clip: 12 },
  shotgun: { name: 'Pompalı', icon: '💥', dmg: 15, pellets: 7, rate: 0.85, spread: 0.12, bloom: 0.06, ammoKey: 'shotgun', noise: 90, clip: 6 },
};
export const WEAPON_KEYS = ['fists', 'bat', 'pistol', 'silenced', 'shotgun'];

export class Combat {
  constructor(game) { this.game = game; this.bloom = 0; this.cool = 0; }
  update(dt) { this.bloom = Math.max(0, this.bloom - dt * 0.18); this.cool -= dt; }

  meleeHit(att) {
    const g = this.game; const range = att.weapon === 'bat' ? 2.1 : 1.55; const fs = Math.sin(att.a), fc = Math.cos(att.a);
    let hitAny = false;
    const targets = [...g.peds, g.player].filter(p => p !== att && !p.vehicle && !p.dead && !p.fly);
    for (const t of targets) {
      const dx = t.x - att.x, dz = t.z - att.z, d = Math.hypot(dx, dz); if (d > range + 0.3) continue;
      if ((dx * fs + dz * fc) / (d || 1) < 0.35) continue;
      if (att.role === t.role && att.role !== 'civ' && !att.isPlayer) continue; // takım arkadaşı
      if (!att.isPlayer && !t.isPlayer && t !== att.target) continue;
      hitAny = true; this.damagePed(t, att, (att.weapon === 'bat' ? 26 : 11) * (att.isPlayer ? 1 : (att.dmgMul || 1)), dx / (d || 1), dz / (d || 1), att.weapon === 'bat' ? 'bat' : 'fist');
      if (att.weapon !== 'bat') break;
    }
    // araç yumruklama / sopayla vurma
    if (!hitAny) for (const v of g.vehicles) {
      const tx = att.x + fs * 1.4, tz = att.z + fc * 1.4; const o = v.obb();
      const { fx, fz, rx, rz } = axes(o.a); const lx = (tx - o.x) * rx + (tz - o.z) * rz, lz = (tx - o.x) * fx + (tz - o.z) * fz;
      if (Math.abs(lx) < o.hx + 0.3 && Math.abs(lz) < o.hz + 0.3) {
        v.impact(tx, tz, -fs, -fc, att.weapon === 'bat' ? 7.5 : 4.5, g.env, { mult: att.weapon === 'bat' ? 1.6 : 0.6 });
        g.fx.sparks(tx, 1, tz, 4); g.audio.punch(tx, tz, true); hitAny = true;
        if (att.isPlayer && v.driver && !v.driver.isPlayer && v.ai?.type === 'traffic') { v.ai.panic = 5; }
        if (att.isPlayer && v.isPolice) g.police.crime('hitCop', att.x, att.z);
        break;
      }
    }
    if (hitAny) { g.hitstop = 0.045; g.shake(att.weapon === 'bat' ? 0.35 : 0.18); }
  }

  damagePed(t, att, dmg, nx, nz, kind) {
    const g = this.game; if (t.dead) return;
    if (t.invuln) dmg = 0;
    if (t.isPlayer && g.godMode) dmg = 0;
    t.hp -= dmg; t.stagger = 0.3;
    g.fx.hitPuff(t.x, 1.4, t.z);
    if (kind === 'bullet') g.fx.bloodBurst(t.x, 1.2, t.z, nx, nz); else if (dmg > 20 && Math.random() < 0.5) g.fx.bloodDecal(t.x + nx * 0.5, t.z + nz * 0.5, 0.5);
    if (kind !== 'bullet') g.audio.punch(t.x, t.z, kind === 'bat');
    // geri itme
    t.x += nx * (kind === 'bat' ? 0.7 : 0.35); t.z += nz * (kind === 'bat' ? 0.7 : 0.35);
    if (t.hp <= 0) {
      if (t.nonLethal) { t.hp = 0; t.knock(nx * 4, nz * 4, 3.5); t.getUpT = 999; t.state = 'defeated'; }
      else { t.knock(nx * (kind === 'bullet' ? 3 : 5), nz * (kind === 'bullet' ? 3 : 5), 3); t.die(); }
      if (t.isPlayer) g.onPlayerDeath();
    } else if ((kind === 'bat' && Math.random() < 0.45) || (kind === 'fist' && t.hp < 25 && Math.random() < 0.35)) t.knock(nx * 4, nz * 4, 3);
    // tepki
    if (!t.isPlayer && att) this.react(t, att, kind);
    if (att?.isPlayer && !t.isPlayer) {
      if (t.role === 'police') g.police.crime(t.dead ? 'killCop' : 'hitCop', t.x, t.z);
      else if (t.role === 'civ') g.police.crime(t.dead ? 'murder' : 'assault', t.x, t.z);
      g.ui.hitMarker();
    }
    if (t.isPlayer) { g.ui.damageFlash(); }
  }
  react(t, att, kind) {
    if (t.dead || t.role === 'story' && !t.fighter) return;
    if (t.role === 'civ') {
      if (t.state !== 'fight' && (t.aggro > 0.5 || (kind !== 'bullet' && Math.random() < 0.35 && !t.female))) { t.state = 'fight'; t.target = att; t.aggro = 1; t.say(ANGRY[(Math.random() * ANGRY.length) | 0], 2); }
      else if (t.state !== 'fight') { t.state = 'flee'; t.stateT = 0; t.fleeFrom = { x: att.x, z: att.z }; t.say(FLEE[(Math.random() * FLEE.length) | 0], 2); }
    } else if (t.role === 'police') { if (t.state !== 'chase') t.state = 'chase'; }
    else if (t.role === 'gang') { t.target = att; }
  }
  // Atış: yön (dx,dz), ek yayılma
  fire(sh, dx, dz, extraSpread = 0) {
    const g = this.game; const W = sh.isPlayer ? g.WEAPONS[sh.weapon] : (sh.weapon === 'shotgun' ? g.WEAPONS.shotgun : g.WEAPONS.pistol);
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const base = Math.atan2(dx, dz);
    const moving = sh.speed > 0.5 ? 0.04 : 0;
    const spread = W.spread + (sh.isPlayer ? this.bloom : 0) + moving + extraSpread;
    if (sh.isPlayer) this.bloom = Math.min(0.22, this.bloom + W.bloom);
    sh.a = base; const rx = Math.cos(base), rz = -Math.sin(base);
    const mx = sh.x + dx * 0.75 - rx * 0.25, mz = sh.z + dz * 0.75 - rz * 0.25, my = 1.32 + sh.y;
    g.fx.muzzleFlash(mx, my, mz, dx, dz, W === g.WEAPONS.shotgun);
    g.fx.shell(sh.x - rx * 0.3, my, sh.z - rz * 0.3, -rx, -rz);
    g.audio.gun(sh.x, sh.z, sh.weapon);
    if (sh.isPlayer) { g.shake(W === g.WEAPONS.shotgun ? 0.45 : 0.15); g.recoil = 0.12; }
    const n = W.pellets || 1;
    for (let k = 0; k < n; k++) {
      const ang = base + (Math.random() - .5) * 2 * spread; const ux = Math.sin(ang), uz = Math.cos(ang);
      let best = W.pellets ? 32 : 70, hitP = null, hitV = null;
      const tS = g.world.statics.raycast(mx, mz, ux, uz, best); if (tS < best) best = tS;
      for (const v of g.vehicles) { if (v === sh.vehicle) continue; const t = rayObb(mx, mz, ux, uz, v.obb()); if (t !== null && t < best) { best = t; hitV = v; hitP = null; } }
      for (const p of [...g.peds, g.player]) { if (p === sh || p.dead || p.vehicle) continue; if (!sh.isPlayer && p.role === sh.role && p.role !== 'civ') continue; const t = rayCircle(mx, mz, ux, uz, p.x, p.z, p.down ? 0.7 : 0.45); if (t !== null && t < best) { best = t; hitP = p; hitV = null; } }
      const hx = mx + ux * best, hz = mz + uz * best;
      g.fx.tracer(mx, my, mz, hx, hitP ? 1.2 : 1.0, hz);
      if (hitP && hitP.isPlayer && hitP.cover && Math.random() < 0.72) { g.fx.sparks(hitP.x - ux * 0.8, 1, hitP.z - uz * 0.8, 5, -ux, -uz); hitP = null; }
      if (hitP) this.damagePed(hitP, sh, W.dmg * (sh.isPlayer ? 1 : 0.45), ux, uz, 'bullet');
      else if (hitV) { hitV.impact(hx, hz, -ux, -uz, 6, g.env, { mult: 0.7 }); g.fx.sparks(hx, 0.9, hz, 6, -ux, -uz); if (sh.isPlayer && hitV.isPolice) g.police.crime('hitCop', sh.x, sh.z); if (hitV.ai?.type === 'traffic') hitV.ai.panic = 6; }
      else if (best < 69) { g.fx.sparks(hx, 1.0, hz, 5, -ux, -uz, [1, 0.9, 0.6]); g.fx.dust(hx, hz, 2); }
    }
    // ses yarıçapı: siviller panikler
    const nr = W.noise || 60;
    for (const p of g.peds) if (!p.vehicle && p.role === 'civ' && !p.dead && p.state !== 'fight' && Math.hypot(p.x - sh.x, p.z - sh.z) < nr) {
      if (Math.random() < 0.3) { p.state = 'cower'; p.stateT = 0; } else { p.state = 'flee'; p.stateT = 0; p.fleeFrom = { x: sh.x, z: sh.z }; }
      if (Math.random() < 0.15) p.say(FLEE[(Math.random() * FLEE.length) | 0], 1.5);
    }
    for (const v of g.vehicles) if (v.ai?.type === 'traffic' && Math.hypot(v.x - sh.x, v.z - sh.z) < nr) v.ai.panic = 6;
    if (sh.isPlayer && sh.weapon !== 'silenced') g.police.crime('shooting', sh.x, sh.z);
  }
}
