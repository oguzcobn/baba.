// Fictional Canal Tour & Boat Booking System
export class CanalTourSystem {
  constructor() {
    this.ownedBoats = 1;
    this.ticketPrice = 32;
    this.capacity = 8;
    this.activeTour = null;
    this.completedTours = 0;
    this.cancelledTours = 0;
  }

  bookTour(routeType, weather, economy) {
    if (weather === 'Rain') {
      this.cancelledTours += 1;
      return { ok: false, reason: 'WEATHER_CANCELLED' };
    }
    if (this.activeTour) return { ok: false, reason: 'TOUR_IN_PROGRESS' };
    const passengers = Math.max(3, Math.min(this.capacity, Math.round(4 + (economy.reputation / 25))));
    const multiplier = routeType === 'Sunset' ? 1.35 : routeType === 'Night' ? 1.45 : 1.0;
    const revenue = +(passengers * this.ticketPrice * multiplier).toFixed(2);
    const fuelMaint = 35;
    this.activeTour = { routeType, passengers, revenue, fuelMaint, progress: 0, duration: 24 };
    return { ok: true, tour: this.activeTour };
  }

  tick(dt, weather, economy) {
    if (!this.activeTour) return null;
    if (weather === 'Rain') {
      this.activeTour = null;
      this.cancelledTours += 1;
      return { status: 'CANCELLED_WEATHER' };
    }
    this.activeTour.progress += dt;
    if (this.activeTour.progress >= this.activeTour.duration) {
      const finished = this.activeTour;
      this.activeTour = null;
      this.completedTours += 1;
      const net = +(finished.revenue - finished.fuelMaint).toFixed(2);
      economy.cash = +(economy.cash + net).toFixed(2);
      economy.dailyLedger.revenue = +(economy.dailyLedger.revenue + finished.revenue).toFixed(2);
      economy.dailyLedger.maintenance = +(economy.dailyLedger.maintenance + finished.fuelMaint).toFixed(2);
      economy.recomputeProfit();
      return { status: 'COMPLETED', revenue: finished.revenue, net, passengers: finished.passengers };
    }
    return null;
  }
}
