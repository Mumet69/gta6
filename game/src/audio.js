// audio.js — all sound in Velvet Bay is synthesised with WebAudio.
// No audio files, no network. Engine hum, sirens, gunshots, UI blips and a
// small bassline loop are built from oscillators and filtered noise.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Engine: two detuned saws through a lowpass, gain follows speed.
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.4;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(g2);
    g2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Siren: one triangle osc, pitch flipped by a slow LFO-ish timer.
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 750;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    setInterval(() => {
      if (!this.ctx || !this.sirenOn) return;
      this.sirenOsc.frequency.value = this.sirenOsc.frequency.value > 800 ? 700 : 950;
    }, 320);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  engine(speed01, inCar) {
    if (!this.ctx) return;
    const target = inCar ? 0.05 + speed01 * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    const f = 50 + speed01 * 165;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.06);
    this.engineFilter.frequency.setTargetAtTime(320 + speed01 * 1400, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    this.sirenOn = on;
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.1);
  }

  _noiseBurst(dur, filterFreq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start();
  }

  _tone(freq, dur, gain, type = 'sine', when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  shot() { this._noiseBurst(0.14, 1800, 0.5, 'bandpass'); this._tone(160, 0.1, 0.35, 'sine'); }
  enemyShot() { this._noiseBurst(0.1, 1200, 0.16, 'bandpass'); }
  punch() { this._noiseBurst(0.08, 500, 0.4); }
  horn() { this._tone(220, 0.28, 0.22, 'square'); this._tone(277, 0.28, 0.18, 'square'); }
  coin() { this._tone(988, 0.09, 0.2, 'sine'); this._tone(1319, 0.14, 0.2, 'sine', 0.07); }
  taxiBell() { this._tone(1175, 0.1, 0.2, 'triangle'); this._tone(1175, 0.1, 0.2, 'triangle', 0.16); }
  raceBeep() { this._tone(880, 0.09, 0.2, 'square'); }
  blip() { this._tone(880, 0.07, 0.18, 'sine'); }
  click() { this._tone(660, 0.05, 0.12, 'square'); }
  pickup() { this._tone(660, 0.09, 0.2, 'sine'); this._tone(990, 0.12, 0.2, 'sine', 0.08); }
  reload() { this._tone(440, 0.06, 0.15, 'square'); this._tone(550, 0.06, 0.15, 'square', 0.09); }
  crash() { this._noiseBurst(0.3, 300, 0.5); }
  busted() { this._tone(392, 0.25, 0.25, 'sawtooth'); this._tone(311, 0.4, 0.25, 'sawtooth', 0.22); }
  wasted() { this._tone(330, 0.3, 0.25, 'sawtooth'); this._tone(247, 0.5, 0.25, 'sawtooth', 0.25); }
  // v3 sounds: a cash register for front income, a wrench for the garage,
  // an alarm for turf wars and heist prep, and a heavier blast for the shotgun.
  register() { this._tone(1320, 0.08, 0.2, 'square'); this._tone(1760, 0.16, 0.2, 'square', 0.08); }
  wrench() { this._tone(300, 0.06, 0.2, 'square'); this._tone(420, 0.06, 0.2, 'square', 0.07); this._tone(300, 0.06, 0.2, 'square', 0.14); }
  alarm() { this._tone(740, 0.18, 0.25, 'sawtooth'); this._tone(740, 0.18, 0.25, 'sawtooth', 0.22); this._tone(988, 0.18, 0.25, 'sawtooth', 0.44); }
  shotgun() { this._noiseBurst(0.3, 900, 0.7, 'bandpass'); this._tone(110, 0.18, 0.4, 'sine'); }
  thunder() { this._noiseBurst(0.8, 120, 0.4); }

  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.16, 0.22, 'triangle', i * 0.11));
  }
  winJingle() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.22, 0.22, 'triangle', i * 0.13));
  }

  // Simple 100 BPM bassline loop (square wave + hat ticks).
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const bass = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) { this.musicStep++; return; }
      const step = this.musicStep % 8;
      const f = bass[step];
      if (f) this._tone(f, 0.22, 0.12, 'square');
      if (step % 2 === 0) this._noiseBurst(0.03, 6000, 0.05, 'highpass');
      this.musicStep++;
    }, 300);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
