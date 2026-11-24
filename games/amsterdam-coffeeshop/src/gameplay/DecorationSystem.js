// House Flipper-style interior placement with grid snap, rotation, collision & undo/redo
export class DecorationSystem {
  constructor(bounds = { minX: -4.2, maxX: 4.2, minZ: -11.4, maxZ: -1.6 }) {
    this.bounds = bounds;
    this.gridSnap = true;
    this.gridSize = 0.5;
    this.placed = [];
    this.undoStack = [];
    this.redoStack = [];
    this.nextId = 1;
    this.catalog = [
      { type: 'sofa', name: 'Velvet Lounge Sofa', style: 'Luxury', cost: 280, w: 1.8, d: 0.85, ambiance: 12, seats: 2 },
      { type: 'table', name: 'Dutch Oak Table', style: 'Rustic', cost: 160, w: 1.1, d: 0.75, ambiance: 7, seats: 2 },
      { type: 'lamp', name: 'Warm Brass Pendant', style: 'Retro', cost: 120, w: 0.5, d: 0.5, ambiance: 10, seats: 0, isLight: true },
      { type: 'plant', name: 'Canal Monstera', style: 'Nature', cost: 90, w: 0.6, d: 0.6, ambiance: 9, seats: 0 },
      { type: 'neon', name: 'Cyber Emerald Sign', style: 'Cyberpunk', cost: 220, w: 1.2, d: 0.25, ambiance: 14, seats: 0, isLight: true }
    ];
  }

  snap(val) {
    return this.gridSnap ? Math.round(val / this.gridSize) * this.gridSize : val;
  }

  canPlace(type, x, z, rotationRad = 0) {
    const def = this.catalog.find(c => c.type === type);
    if (!def) return { ok: false, reason: 'UNKNOWN_TYPE' };
    const sx = this.snap(x);
    const sz = this.snap(z);
    const cos = Math.abs(Math.cos(rotationRad));
    const sin = Math.abs(Math.sin(rotationRad));
    const hw = (def.w * cos + def.d * sin) / 2;
    const hd = (def.w * sin + def.d * cos) / 2;

    if (sx - hw < this.bounds.minX || sx + hw > this.bounds.maxX ||
        sz - hd < this.bounds.minZ || sz + hd > this.bounds.maxZ) {
      return { ok: false, reason: 'OUT_OF_BOUNDS' };
    }
    for (const p of this.placed) {
      if (Math.abs(sx - p.x) < (hw + p.hw - 0.05) && Math.abs(sz - p.z) < (hd + p.hd - 0.05)) {
        return { ok: false, reason: 'COLLISION' };
      }
    }
    return { ok: true, x: sx, z: sz, hw, hd, def };
  }

  place(type, x, z, rotationRad, economy) {
    const check = this.canPlace(type, x, z, rotationRad);
    if (!check.ok) return check;
    if (economy && economy.cash < check.def.cost) return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
    if (economy) {
      economy.cash = +(economy.cash - check.def.cost).toFixed(2);
      economy.ambianceScore = Math.min(100, economy.ambianceScore + check.def.ambiance);
      economy.seatCapacity += check.def.seats;
    }
    const item = {
      id: `decor_${this.nextId++}`,
      type,
      name: check.def.name,
      cost: check.def.cost,
      x: check.x,
      z: check.z,
      rotationRad,
      hw: check.hw,
      hd: check.hd,
      ambiance: check.def.ambiance,
      seats: check.def.seats
    };
    this.placed.push(item);
    this.undoStack.push({ action: 'place', item });
    this.redoStack = [];
    return { ok: true, item };
  }

  undo(economy) {
    const last = this.undoStack.pop();
    if (!last) return { ok: false, reason: 'EMPTY_UNDO' };
    if (last.action === 'place') {
      this.placed = this.placed.filter(p => p.id !== last.item.id);
      if (economy) {
        economy.cash = +(economy.cash + last.item.cost).toFixed(2);
        economy.ambianceScore = Math.max(0, economy.ambianceScore - last.item.ambiance);
        economy.seatCapacity = Math.max(2, economy.seatCapacity - last.item.seats);
      }
      this.redoStack.push(last);
      return { ok: true, undone: last.item };
    }
    return { ok: false };
  }
}
