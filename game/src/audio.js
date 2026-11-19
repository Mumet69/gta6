// audio.js — all sound in SOLMAR HEAT is synthesized with WebAudio.
// No audio files: every effect is built from oscillators and filtered noise,
// and the music is a small looping bassline + hats sequencer.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.ready = false;
  }

  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      // continuous engine hum (pitch follows speed)
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 40;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // police siren (two-tone, only while wanted >= 2)
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.ready = true;
    } catch (e) { /* audio unavailable — game stays silent */ }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : 0.5; }

  setEngine(speed01, on) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(38 + speed01 * 90, t, 0.1);
  }

  setSiren(on, wanted) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.3);
    if (on) this.sirenOsc.frequency.setTargetAtTime(wanted >= 3 ? 880 : 700, t, 0.2);
  }

  blip(freq, dur, type, vol, when = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noise(0.14, 0.5, 2800); this.blip(160, 0.08, 'square', 0.25); }
  punch() { this.noise(0.1, 0.35, 500); this.blip(90, 0.1, 'sine', 0.3); }
  pickup() { this.blip(880, 0.08, 'sine', 0.22); this.blip(1320, 0.12, 'sine', 0.22, 0.07); }
  cash() { this.blip(660, 0.07, 'triangle', 0.22); this.blip(880, 0.07, 'triangle', 0.22, 0.06); this.blip(1320, 0.14, 'triangle', 0.22, 0.12); }
  crash() { this.noise(0.35, 0.5, 700); }
  sirenBlip() { this.blip(950, 0.12, 'triangle', 0.15); this.blip(700, 0.12, 'triangle', 0.15, 0.12); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.25, i * 0.11));
  }
  missionStart() { this.blip(392, 0.15, 'triangle', 0.22); this.blip(523, 0.2, 'triangle', 0.22, 0.12); }
  busted() { [330, 262, 196].forEach((f, i) => this.blip(f, 0.3, 'sawtooth', 0.18, i * 0.18)); }

  startMusic() {
    if (!this.ready || this.musicTimer) return;
    // A minor-key bassline groove at 112 BPM, 16 steps a bar.
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
    const stepMs = 60000 / 112 / 4;
    this.musicTimer = setInterval(() => {
      if (this.musicStep % 2 === 0) {
        const f = bass[this.musicStep % 16];
        if (f) this.blip(f, 0.22, 'sawtooth', 0.10);
      }
      if (this.musicStep % 4 === 2) this.noise(0.03, 0.05, 6000); // hat
      this.musicStep++;
    }, stepMs);
  }
}
