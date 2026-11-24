// Deterministic Grid A* Pathfinder for Amsterdam street, bridge, and shop interior
export class NavigationAStar {
  constructor(width, height, cellSize = 1.0, originX = -30, originZ = -15) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.originX = originX;
    this.originZ = originZ;
    this.blocked = new Uint8Array(width * height);
  }

  worldToGrid(wx, wz) {
    return {
      gx: Math.max(0, Math.min(this.width - 1, Math.floor((wx - this.originX) / this.cellSize))),
      gz: Math.max(0, Math.min(this.height - 1, Math.floor((wz - this.originZ) / this.cellSize)))
    };
  }

  gridToWorld(gx, gz) {
    return {
      x: this.originX + (gx + 0.5) * this.cellSize,
      z: this.originZ + (gz + 0.5) * this.cellSize
    };
  }

  setBlockedRect(minX, maxX, minZ, maxZ, val = 1) {
    const a = this.worldToGrid(minX, minZ);
    const b = this.worldToGrid(maxX, maxZ);
    for (let z = a.gz; z <= b.gz; z++) {
      for (let x = a.gx; x <= b.gx; x++) {
        this.blocked[z * this.width + x] = val;
      }
    }
  }

  findPath(startX, startZ, goalX, goalZ) {
    const s = this.worldToGrid(startX, startZ);
    const g = this.worldToGrid(goalX, goalZ);
    const key = (x, z) => z * this.width + x;
    const startK = key(s.gx, s.gz);
    const goalK = key(g.gx, g.gz);

    const open = new Set([startK]);
    const cameFrom = new Map();
    const gScore = new Map([[startK, 0]]);
    const fScore = new Map([[startK, Math.hypot(g.gx - s.gx, g.gz - s.gz)]]);

    const dirs = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]];

    while (open.size > 0) {
      let current = null;
      let bestF = Infinity;
      for (const k of open) {
        const f = fScore.get(k) ?? Infinity;
        if (f < bestF) { bestF = f; current = k; }
      }
      if (current === goalK) {
        const path = [];
        let c = current;
        while (c !== undefined) {
          const cx = c % this.width;
          const cz = Math.floor(c / this.width);
          path.push(this.gridToWorld(cx, cz));
          c = cameFrom.get(c);
        }
        return path.reverse();
      }
      open.delete(current);
      const cx = current % this.width;
      const cz = Math.floor(current / this.width);

      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= this.width || nz < 0 || nz >= this.height) continue;
        const nk = key(nx, nz);
        if (this.blocked[nk] && nk !== goalK) continue;
        const tentative = (gScore.get(current) ?? Infinity) + cost;
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          cameFrom.set(nk, current);
          gScore.set(nk, tentative);
          fScore.set(nk, tentative + Math.hypot(g.gx - nx, g.gz - nz));
          open.add(nk);
        }
      }
    }
    return [];
  }
}
