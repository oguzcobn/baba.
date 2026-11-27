// WebAudio ile sentezlenen sesler: motor, siren, çarpma, silah, yumruk, cam, yağmur ve huzurlu lo-fi radyo
export class Audio {
  constructor() { this.ctx = null; this.enabled = true; this.listener = { x: 0, z: 0 }; this.musicOn = true; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.22; this.musicBus.connect(this.master);
    // gürültü tamponu
    const len = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, len, ctx.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // motor
    this.eng = { o1: ctx.createOscillator(), o2: ctx.createOscillator(), f: ctx.createBiquadFilter(), g: ctx.createGain() };
    this.eng.o1.type = 'sawtooth'; this.eng.o2.type = 'square'; this.eng.f.type = 'lowpass'; this.eng.f.frequency.value = 500; this.eng.g.gain.value = 0;
    this.eng.o1.connect(this.eng.f); this.eng.o2.connect(this.eng.f); this.eng.f.connect(this.eng.g); this.eng.g.connect(this.sfx); this.eng.o1.start(); this.eng.o2.start();
    // lastik sesi
    this.skidSrc = ctx.createBufferSource(); this.skidSrc.buffer = this.noise; this.skidSrc.loop = true; this.skidF = ctx.createBiquadFilter(); this.skidF.type = 'bandpass'; this.skidF.frequency.value = 1800; this.skidF.Q.value = 3; this.skidG = ctx.createGain(); this.skidG.gain.value = 0;
    this.skidSrc.connect(this.skidF); this.skidF.connect(this.skidG); this.skidG.connect(this.sfx); this.skidSrc.start();
    // siren
    this.sir = { o: ctx.createOscillator(), lfo: ctx.createOscillator(), lg: ctx.createGain(), g: ctx.createGain() };
    this.sir.o.type = 'square'; this.sir.o.frequency.value = 750; this.sir.lfo.frequency.value = 0.9; this.sir.lg.gain.value = 220; this.sir.lfo.connect(this.sir.lg); this.sir.lg.connect(this.sir.o.frequency);
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1600; this.sir.o.connect(sf); sf.connect(this.sir.g); this.sir.g.gain.value = 0; this.sir.g.connect(this.sfx); this.sir.o.start(); this.sir.lfo.start();
    // yağmur/ortam
    this.amb = ctx.createBufferSource(); this.amb.buffer = this.noise; this.amb.loop = true; this.ambF = ctx.createBiquadFilter(); this.ambF.type = 'lowpass'; this.ambF.frequency.value = 900; this.ambG = ctx.createGain(); this.ambG.gain.value = 0.02;
    this.amb.connect(this.ambF); this.ambF.connect(this.ambG); this.ambG.connect(this.master); this.amb.start();
    this.startMusic();
  }
  vol(x, z, r = 90) { const d = Math.hypot(x - this.listener.x, z - this.listener.z); const v = Math.max(0, 1 - d / r); return Number.isFinite(v) ? v : 0; }
  burst({ dur = 0.2, freq = 1000, q = 1, type = 'lowpass', gain = 0.5, x, z, r, attack = 0.002, pitchDrop = 0 }) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime; const v = x === undefined ? 1 : this.vol(x, z, r); if (v <= 0) return;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; if (pitchDrop) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * pitchDrop), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * v, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone({ f0 = 200, f1 = 60, dur = 0.2, type = 'sine', gain = 0.5, x, z, r }) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime; const v = x === undefined ? 1 : this.vol(x, z, r); if (v <= 0) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  crash(x, z, power) { const p = Math.min(1, power / 15); this.burst({ dur: 0.35 + p * 0.4, freq: 600, gain: 0.35 + p * 0.6, x, z, r: 120, pitchDrop: 0.3 }); this.tone({ f0: 120, f1: 40, dur: 0.3, gain: 0.4 * p + 0.1, x, z }); if (p > 0.4) this.burst({ dur: 0.25, freq: 3500, type: 'highpass', gain: 0.18 * p, x, z }); }
  punch(x, z, heavy) { this.burst({ dur: 0.12, freq: heavy ? 500 : 900, gain: 0.6, x, z, r: 50 }); this.tone({ f0: heavy ? 140 : 200, f1: 60, dur: 0.12, gain: 0.5, x, z }); }
  whoosh() { this.burst({ dur: 0.18, freq: 1200, type: 'bandpass', q: 0.8, gain: 0.15, attack: 0.06 }); }
  gun(x, z, kind) {
    if (kind === 'silenced') { this.burst({ dur: 0.12, freq: 1800, type: 'bandpass', gain: 0.35, x, z, r: 40 }); this.tone({ f0: 300, f1: 80, dur: 0.06, gain: 0.2, x, z }); return; }
    const big = kind === 'shotgun';
    this.burst({ dur: big ? 0.6 : 0.35, freq: big ? 1400 : 2400, gain: big ? 1 : 0.8, x, z, r: 200, pitchDrop: 0.15, attack: 0.001 });
    this.tone({ f0: big ? 110 : 160, f1: 35, dur: big ? 0.35 : 0.2, gain: big ? 0.9 : 0.6, x, z, r: 200 });
  }
  tink(x, z) { this.tone({ f0: 3200 + Math.random() * 1200, f1: 2600, dur: 0.08, type: 'triangle', gain: 0.08, x, z, r: 25 }); }
  glass() { this.burst({ dur: 0.3, freq: 4500, type: 'highpass', gain: 0.25 }); for (let i = 0; i < 4; i++) setTimeout(() => this.tone({ f0: 3000 + Math.random() * 3000, f1: 2500, dur: 0.06, type: 'triangle', gain: 0.06 }), i * 40); }
  explosion(x, z) { this.burst({ dur: 1.8, freq: 400, gain: 1, x, z, r: 300, pitchDrop: 0.1, attack: 0.005 }); this.tone({ f0: 80, f1: 25, dur: 1.2, gain: 1, x, z, r: 300 }); }
  hit() { this.tone({ f0: 900, f1: 300, dur: 0.07, type: 'square', gain: 0.08 }); }
  pickup() { this.tone({ f0: 660, f1: 990, dur: 0.15, type: 'triangle', gain: 0.2 }); setTimeout(() => this.tone({ f0: 990, f1: 1320, dur: 0.2, type: 'triangle', gain: 0.15 }), 90); }
  horn() { this.tone({ f0: 420, f1: 400, dur: 0.35, type: 'square', gain: 0.12 }); this.tone({ f0: 520, f1: 500, dur: 0.35, type: 'square', gain: 0.1 }); }
  door() { this.tone({ f0: 180, f1: 90, dur: 0.12, gain: 0.3 }); this.burst({ dur: 0.08, freq: 1500, gain: 0.15 }); }
  phone() { for (let i = 0; i < 3; i++) setTimeout(() => { this.tone({ f0: 1400, f1: 1400, dur: 0.12, type: 'sine', gain: 0.12 }); setTimeout(() => this.tone({ f0: 1750, f1: 1750, dur: 0.12, type: 'sine', gain: 0.12 }), 130); }, i * 600); }
  setEngine(on, rpm, load) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const f = 34 + rpm * 70; this.eng.o1.frequency.setTargetAtTime(f, t, 0.05); this.eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.eng.f.frequency.setTargetAtTime(300 + rpm * 900 + load * 400, t, 0.05); this.eng.g.gain.setTargetAtTime(on ? 0.05 + load * 0.05 : 0, t, 0.08);
  }
  setSkid(v) { if (this.ctx) this.skidG.gain.setTargetAtTime(v * 0.18, this.ctx.currentTime, 0.04); }
  setSiren(v) { if (this.ctx) this.sir.g.gain.setTargetAtTime(v * 0.08, this.ctx.currentTime, 0.1); }
  setRain(v) { if (this.ctx) { this.ambG.gain.setTargetAtTime(0.02 + v * 0.16, this.ctx.currentTime, 0.5); this.ambF.frequency.setTargetAtTime(v ? 2500 : 700, this.ctx.currentTime, 0.5); } }
  // Huzurlu lo-fi radyo: yumuşak akorlar + bas + ara sıra piyano notası
  startMusic() {
    const ctx = this.ctx; const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]; let bar = 0;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const play = () => {
      if (!this.ctx) return; const t = ctx.currentTime + 0.05; const ch = chords[bar % 4]; const dur = 3.2;
      if (this.musicOn) {
        for (const n of ch) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = (Math.random() - .5) * 12;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; const g = ctx.createGain();
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
          o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.1);
        }
        const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = mtof(ch[0] - 12); const bg = ctx.createGain(); bg.gain.setValueAtTime(0.25, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 1.5); b.connect(bg); bg.connect(this.musicBus); b.start(t); b.stop(t + 1.6);
        for (let k = 0; k < 4; k++) if (Math.random() < 0.55) {
          const n = ch[(Math.random() * 4) | 0] + 12 + (Math.random() < 0.3 ? 2 : 0); const tt = t + k * 0.8 + (Math.random() < .5 ? 0.4 : 0);
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(n); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.12, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.2);
          o.connect(g); g.connect(this.musicBus); o.start(tt); o.stop(tt + 1.3);
        }
        // vinyl çıtırtısı
        this.burst({ dur: 0.04, freq: 5000, type: 'highpass', gain: 0.02 });
      }
      bar++; setTimeout(play, dur * 1000 - 50);
    };
    play();
  }
}
