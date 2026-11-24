// Deterministic Coffeeshop Business & Operations Mathematics Engine
// - Unit Economics: Gross Margin %, COGS %, Labor %, Prime Cost % (COGS + Labor), Break-Even Revenue (BEP)
// - Dutch VAT (BTW): 9% reduced for Cafe food/beverages (9/109), 21% standard for Botanical/retail (21/121)
// - Constant Price Elasticity: Q(P) = Q0 * (P / P0)^epsilon
// - Queueing Theory: Little's Law L = lambda * W, M/M/c utilization rho = lambda / (c * mu)
// - Inventory Optimization: EOQ = sqrt(2*D*S/H), ROP = leadTime * dailyUsage + safetyStock
// - Capacity Yield: RevPASH = Revenue / (Seats * OpenHours)
export class EconomyEngine {
  constructor(initialCash = 2500) {
    this.cash = initialCash;
    this.reputation = 62;
    this.hygiene = 96; // 0..100
    this.priceMultiplier = 1.0; // 0.80 .. 1.40
    this.autoReorderEOQ = false;
    this.licenseValid = true;
    this.idCheckStrict = true;
    this.staffCount = 1;
    this.ambianceScore = 50;
    this.seatCapacity = 6;
    this.openHoursPerDay = 14;
    this.processedTxIds = new Set();

    this.catalog = [
      { id: 'canal_haze', name: 'Canal Haze Blend', category: 'Botanical', btwRate: 0.21, elasticity: -0.85, price: 14, unitCost: 5, stock: 24, quality: 82, dailyDemand: 14, rop: 10, color: 0x4d7c4f },
      { id: 'jordaan_amber', name: 'Jordaan Amber', category: 'Botanical', btwRate: 0.21, elasticity: -0.90, price: 16, unitCost: 6, stock: 18, quality: 88, dailyDemand: 12, rop: 9, color: 0x8b6f3d },
      { id: 'tulip_reserve', name: 'Tulip Reserve', category: 'Botanical', btwRate: 0.21, elasticity: -0.78, price: 20, unitCost: 8, stock: 12, quality: 94, dailyDemand: 8, rop: 7, color: 0x6b4c7a },
      { id: 'mint_tea', name: 'Dutch Mint Tea', category: 'Cafe', btwRate: 0.09, elasticity: -1.35, price: 4.5, unitCost: 1.0, stock: 40, quality: 85, dailyDemand: 24, rop: 14, color: 0x3b8c6e },
      { id: 'stroop_espresso', name: 'Stroopwafel Espresso', category: 'Cafe', btwRate: 0.09, elasticity: -1.30, price: 5.5, unitCost: 1.5, stock: 35, quality: 90, dailyDemand: 22, rop: 14, color: 0x5c3a21 }
    ];

    this.dailyLedger = this.createEmptyLedger();
    this.history = [];
  }

  createEmptyLedger() {
    return { revenue: 0, netRevenue: 0, cogs: 0, stockCost: 0, staffCost: 0, rent: 0, energy: 0, tax: 0, maintenance: 0, profit: 0, salesCount: 0 };
  }

  // Constant Price Elasticity Q(P)/Q0 = (P/P0)^epsilon
  computeElasticityFactor(item) {
    return +Math.pow(this.priceMultiplier, item.elasticity).toFixed(4);
  }

  // M/M/c Queueing Metrics: rho = lambda / (c * mu), Little's Law L = lambda * W
  computeQueueMetrics(arrivalRatePerHr, serviceRatePerBarista = 12) {
    const c = Math.max(1, this.staffCount);
    const capacity = c * serviceRatePerBarista;
    const rho = arrivalRatePerHr / capacity;
    const stable = rho < 1.0;
    const clampedRho = Math.min(0.95, rho);
    const wqHours = stable
      ? (1 / capacity) * Math.pow(clampedRho, Math.sqrt(2 * (c + 1)) - 1) / (1 - clampedRho)
      : 0.5;
    const wTotalMin = (wqHours + 1 / serviceRatePerBarista) * 60;
    const L = arrivalRatePerHr * (wTotalMin / 60);
    return { rho: +rho.toFixed(3), stable, waitMinutes: +wTotalMin.toFixed(2), avgInSystemL: +L.toFixed(2) };
  }

  // EOQ = sqrt(2 * D * S / H) and ROP = leadTime * dailyUsage + safetyStock
  computeInventoryPolicy(item, orderCostS = 18, holdingCostH = 0.85, leadTimeDays = 0.5) {
    const eoq = Math.max(6, Math.round(Math.sqrt((2 * item.dailyDemand * 7 * orderCostS) / holdingCostH)));
    const rop = Math.max(4, Math.ceil(leadTimeDays * item.dailyDemand + Math.sqrt(item.dailyDemand)));
    return { eoq, rop };
  }

  computeKPIs() {
    const l = this.dailyLedger;
    const rev = Math.max(1e-6, l.revenue);
    const estFixed = 140 + this.staffCount * 95 + 35 + 25;
    const grossMarginPct = l.revenue > 0 ? ((l.netRevenue - l.cogs) / rev) * 100 : 68.0;
    const cogsPct = l.revenue > 0 ? (l.cogs / rev) * 100 : 0;
    const laborPct = l.revenue > 0 ? ((this.staffCount * 95) / rev) * 100 : 0;
    const primeCostPct = cogsPct + laborPct;
    const breakEvenRevenue = +(estFixed / Math.max(0.15, grossMarginPct / 100)).toFixed(2);
    const revPASH = +(l.revenue / Math.max(1, this.seatCapacity * this.openHoursPerDay)).toFixed(2);
    return {
      grossMarginPct: +grossMarginPct.toFixed(1),
      cogsPct: +cogsPct.toFixed(1),
      laborPct: +laborPct.toFixed(1),
      primeCostPct: +primeCostPct.toFixed(1),
      breakEvenRevenue,
      revPASH
    };
  }

  sellItem(itemId, qty = 1, txId = null) {
    if (qty <= 0 || !Number.isInteger(qty)) return { ok: false, reason: 'INVALID_QTY' };
    if (txId && this.processedTxIds.has(txId)) return { ok: false, reason: 'DUPLICATE_TX' };
    const item = this.catalog.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'UNKNOWN_ITEM' };
    if (item.stock < qty) return { ok: false, reason: 'INSUFFICIENT_STOCK' };

    const unitSell = +(item.price * this.priceMultiplier).toFixed(2);
    const gross = +(unitSell * qty).toFixed(2);
    // Dutch BTW inclusive extraction: rate / (1 + rate) -> 9/109 or 21/121
    const tax = +(gross * (item.btwRate / (1 + item.btwRate))).toFixed(2);
    const netRev = +(gross - tax).toFixed(2);
    const itemCogs = +(item.unitCost * qty).toFixed(2);

    item.stock -= qty;
    this.cash = +(this.cash + netRev).toFixed(2);
    this.dailyLedger.revenue = +(this.dailyLedger.revenue + gross).toFixed(2);
    this.dailyLedger.netRevenue = +(this.dailyLedger.netRevenue + netRev).toFixed(2);
    this.dailyLedger.cogs = +(this.dailyLedger.cogs + itemCogs).toFixed(2);
    this.dailyLedger.tax = +(this.dailyLedger.tax + tax).toFixed(2);
    this.dailyLedger.salesCount += qty;
    this.hygiene = Math.max(0, +(this.hygiene - 0.8 * qty).toFixed(1));
    this.reputation = Math.min(100, +(this.reputation + (this.hygiene > 60 ? 0.35 : -0.25)).toFixed(2));
    if (txId) this.processedTxIds.add(txId);
    this.recomputeProfit();

    if (this.autoReorderEOQ) {
      const pol = this.computeInventoryPolicy(item);
      if (item.stock <= pol.rop) this.restockItem(item.id, pol.eoq);
    }
    return { ok: true, gross, tax, netRev, remainingStock: item.stock };
  }

  restockItem(itemId, qty = 10) {
    if (qty <= 0 || !Number.isInteger(qty)) return { ok: false, reason: 'INVALID_QTY' };
    const item = this.catalog.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'UNKNOWN_ITEM' };
    const cost = +(item.unitCost * qty).toFixed(2);
    if (this.cash < cost) return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
    this.cash = +(this.cash - cost).toFixed(2);
    item.stock += qty;
    this.dailyLedger.stockCost = +(this.dailyLedger.stockCost + cost).toFixed(2);
    this.recomputeProfit();
    return { ok: true, cost, newStock: item.stock };
  }

  settleDailyFixedCosts(dayNumber) {
    const rent = 140, staffCost = this.staffCount * 95, energy = 35, maintenance = 25;
    this.cash = +(this.cash - (rent + staffCost + energy + maintenance)).toFixed(2);
    this.dailyLedger.rent += rent;
    this.dailyLedger.staffCost += staffCost;
    this.dailyLedger.energy += energy;
    this.dailyLedger.maintenance += maintenance;
    this.recomputeProfit();
    const snapshot = { day: dayNumber, ...this.dailyLedger, closingCash: this.cash };
    this.history.push(snapshot);
    this.dailyLedger = this.createEmptyLedger();
    return snapshot;
  }

  recomputeProfit() {
    const l = this.dailyLedger;
    l.profit = +(l.revenue - l.stockCost - l.staffCost - l.rent - l.energy - l.tax - l.maintenance).toFixed(2);
    return l.profit;
  }
}
