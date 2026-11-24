export class GameClock {
  constructor(startHour = 10.5, timeScale = 120) {
    this.timeOfDayHours = startHour; // 0..24
    this.day = 1;
    this.season = 'Spring'; // Spring, Summer, Autumn, Winter
    this.timeScale = timeScale; // game seconds per real second
    this.latitudeRad = 52.3676 * Math.PI / 180; // Amsterdam
  }

  advance(realDtSeconds) {
    const deltaHours = (realDtSeconds * this.timeScale) / 3600;
    this.timeOfDayHours += deltaHours;
    if (this.timeOfDayHours >= 24) {
      this.timeOfDayHours -= 24;
      this.day += 1;
      const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
      this.season = seasons[Math.floor((this.day - 1) / 30) % 4];
    }
  }

  // Astronomical solar elevation & azimuth for Amsterdam (52.3676 N)
  getSolarAngles() {
    const declBySeason = { Spring: 10, Summer: 23.44, Autumn: -5, Winter: -23.44 };
    const decl = (declBySeason[this.season] || 10) * Math.PI / 180;
    const hourAngle = ((this.timeOfDayHours - 12.5) * 15) * Math.PI / 180;
    const sinElev = Math.sin(this.latitudeRad) * Math.sin(decl) +
                    Math.cos(this.latitudeRad) * Math.cos(decl) * Math.cos(hourAngle);
    const elevation = Math.asin(Math.max(-1, Math.min(1, sinElev)));
    const cosAz = (Math.sin(decl) - Math.sin(this.latitudeRad) * sinElev) /
                  Math.max(1e-5, Math.cos(this.latitudeRad) * Math.cos(elevation));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth;
    return { elevation, azimuth, isNight: elevation < -0.05 };
  }
}
