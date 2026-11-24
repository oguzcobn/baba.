// Abstract Supply Facility & Logistics (Fictional botanical/cafe blends; no real-world cultivation instructions)
export class FacilitySystem {
  constructor() {
    this.level = 1;
    this.capacityPerBatch = 12;
    this.qualityScore = 84;
    this.batchDurationSec = 18;
    this.progressSec = 0;
    this.activeProductId = 'canal_haze';
    this.running = true;
    this.completedBatches = 0;
  }

  tick(dt, economy) {
    if (!this.running) return null;
    this.progressSec += dt;
    if (this.progressSec >= this.batchDurationSec) {
      this.progressSec -= this.batchDurationSec;
      this.completedBatches += 1;
      const item = economy.catalog.find(c => c.id === this.activeProductId);
      if (item) {
        item.stock += this.capacityPerBatch;
        item.quality = Math.min(99, Math.round((item.quality + this.qualityScore) / 2));
      }
      return { delivered: this.capacityPerBatch, productId: this.activeProductId, quality: this.qualityScore };
    }
    return null;
  }

  upgrade(economy) {
    const cost = 450 * this.level;
    if (economy.cash < cost) return { ok: false, reason: 'INSUFFICIENT_FUNDS', cost };
    economy.cash = +(economy.cash - cost).toFixed(2);
    this.level += 1;
    this.capacityPerBatch += 6;
    this.qualityScore = Math.min(98, this.qualityScore + 4);
    return { ok: true, level: this.level, cost };
  }
}
