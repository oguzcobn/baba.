// Fixed-timestep SI physics engine (dt = 1/60s)
// Covers AABB collision, player kinematics, and Archimedes canal boat buoyancy + hydrodynamic drag.
export const FIXED_DT = 1 / 60;
export const GRAVITY = 9.81; // m/s^2
export const WATER_DENSITY = 1000.0; // kg/m^3

export class PhysicsEngine {
  constructor() {
    this.colliders = []; // { id, minX, maxX, minZ, maxZ, tag }
    this.accumulator = 0;
  }

  addCollider(id, minX, maxX, minZ, maxZ, tag = 'static') {
    this.colliders.push({ id, minX, maxX, minZ, maxZ, tag });
  }

  removeCollider(id) {
    this.colliders = this.colliders.filter(c => c.id !== id);
  }

  resolveCircleAABB(x, z, radius, ignoreTags = []) {
    let rx = x;
    let rz = z;
    let collided = false;
    for (const c of this.colliders) {
      if (ignoreTags.includes(c.tag)) continue;
      const closestX = Math.max(c.minX, Math.min(rx, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(rz, c.maxZ));
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        collided = true;
        const dist = Math.sqrt(distSq);
        if (dist > 1e-6) {
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          // Inside box: push out along smallest overlap axis
          const penLeft = Math.abs(rx - c.minX);
          const penRight = Math.abs(c.maxX - rx);
          const penBack = Math.abs(rz - c.minZ);
          const penFront = Math.abs(c.maxZ - rz);
          const m = Math.min(penLeft, penRight, penBack, penFront);
          if (m === penLeft) rx = c.minX - radius;
          else if (m === penRight) rx = c.maxX + radius;
          else if (m === penBack) rz = c.minZ - radius;
          else rz = c.maxZ + radius;
        }
      }
    }
    return { x: rx, z: rz, collided };
  }

  // Archimedes Buoyancy: F_b = rho * g * V_displaced
  // Hydrodynamic Drag: F_d = 0.5 * rho * C_d * A * v^2
  stepBoat(boat, waveHeightFn, dt = FIXED_DT) {
    const waterY = waveHeightFn(boat.x, boat.z);
    const hullBottomY = boat.y - boat.draftOffset;
    const submergence = Math.max(0, Math.min(boat.hullHeight, waterY - hullBottomY));
    const displacedVolume = submergence * boat.waterplaneArea; // m^3

    const F_buoyancy = WATER_DENSITY * GRAVITY * displacedVolume;
    const F_gravity = boat.mass * GRAVITY;
    const F_vertDrag = -boat.verticalDamping * boat.vy;

    const ay = (F_buoyancy - F_gravity + F_vertDrag) / boat.mass;
    boat.vy += ay * dt;
    boat.y += boat.vy * dt;

    // Horizontal propulsion & quadratic hydrodynamic drag
    const speed = Math.hypot(boat.vx, boat.vz);
    const F_dragMag = 0.5 * WATER_DENSITY * boat.dragCoeff * boat.frontalArea * speed * speed;
    const fxThrust = Math.cos(boat.heading) * boat.thrust;
    const fzThrust = Math.sin(boat.heading) * boat.thrust;
    const fxDrag = speed > 1e-5 ? -(boat.vx / speed) * F_dragMag : 0;
    const fzDrag = speed > 1e-5 ? -(boat.vz / speed) * F_dragMag : 0;

    boat.vx += ((fxThrust + fxDrag) / boat.mass) * dt;
    boat.vz += ((fzThrust + fzDrag) / boat.mass) * dt;
    boat.x += boat.vx * dt;
    boat.z += boat.vz * dt;

    // Roll & pitch from local wave slope
    const eps = 0.6;
    const hL = waveHeightFn(boat.x - eps, boat.z);
    const hR = waveHeightFn(boat.x + eps, boat.z);
    const hB = waveHeightFn(boat.x, boat.z - eps);
    const hF = waveHeightFn(boat.x, boat.z + eps);
    boat.roll = Math.atan2(hR - hL, 2 * eps) * 0.65;
    boat.pitch = Math.atan2(hF - hB, 2 * eps) * 0.65;

    return { F_buoyancy, F_gravity, F_dragMag, displacedVolume, submergence };
  }
}
