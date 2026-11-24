// audio.js — all sound is synthesized with WebAudio: engine hum, siren,
// gunshots, pickups and three tiny radio stations. No audio files.
const STATIONS = [
  { name: 'VELVET FM', bpm: 96, bass: [55, 0, 65.4, 0, 49, 0, 58.3, 0], lead: [220, 261.6, 329.6, 392, 329.6, 261.6] },
  { name: 'NEON NIGHTS', bpm: 122, bass: [41.2, 41.2, 49, 55], lead: [440, 523.3, 659.3, 523.3, 587.3, 440] },
  { name: 'PALM WAVES', bpm: 76, bass: [65.4, 82.4, 73.4, 98], lead: [329.6, 392, 440, 392, 329.6, 293.7] },
];
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let stationIdx = 0, musicTimer = null, step = 0, muted = false;
  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      startMusic();
      return true;
    } catch (e) { return false; }
  }
  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || muted || ctx.state !== 'running') return;
      const st = STATIONS[stationIdx];
      const beat = 60 / st.bpm / 2;
      const bass = st.bass[step % st.bass.length];
      if (bass) tone(bass, beat * 1.8, 'triangle', 0.16);
      if (step % 2 === 0) {
        const n = st.lead[Math.floor(step / 2) % st.lead.length];
        tone(n, beat * 1.4, 'square', 0.045);
        tone(n * 2, beat, 'sine', 0.03);
      }
      if (step % 4 === 2) noise(0.05, 0.05, 6000);
      step++;
    }, 60 / STATIONS[stationIdx].bpm * 500);
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEngine(speed01, on) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 45 + speed01 * 140;
      engineGain.gain.value = on ? 0.03 + speed01 * 0.05 : 0;
    },
    siren() { if (!ctx || muted) return; tone(700, 0.45, 'sine', 0.06, 0, 950); tone(950, 0.45, 'sine', 0.06, 0.45, 700); },
    shot() { noise(0.14, 0.4, 2500); tone(160, 0.08, 'square', 0.15); },
    punch() { noise(0.08, 0.25, 700); },
    pickup() { tone(660, 0.12, 'sine', 0.18); tone(990, 0.2, 'sine', 0.18, 0.1); },
    crash() { noise(0.3, 0.5, 500); },
    busted() { tone(440, 0.3, 'sawtooth', 0.12); tone(330, 0.5, 'sawtooth', 0.12, 0.25); },
    nextStation() {
      stationIdx = (stationIdx + 1) % STATIONS.length;
      step = 0;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; startMusic(); }
      return STATIONS[stationIdx].name;
    },
    stationName() { return STATIONS[stationIdx].name; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
  };
}
