// audio.js — DUSTLINE: all sound is synthesized with WebAudio, no audio files.
// Engine hum, sirens, gunshots, punches, pickups and a lazy desert bass loop.
// Audio starts on the first user gesture (browsers require it).

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let musicTimer = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Engine: a low sawtooth whose pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Siren: a sine that wails between two notes.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    startMusic();
  } catch (e) {
    ctx = null;
  }
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function startMusic() {
  // Lazy desert bass: a slow minor groove, one note per beat.
  const notes = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
  let step = 0;
  musicTimer = setInterval(() => {
    if (!ctx || muted || document.hidden) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = notes[step % notes.length];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.6);
    // A soft hat tick on the off-beat.
    if (step % 2 === 1) {
      const n = noiseBurst(0.03, 0.05, 6000);
      n.connect(master);
    }
    step++;
  }, 500);
}

function noiseBurst(duration, volume, filterFreq) {
  const len = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 3000;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(filter); filter.connect(g);
  src.start();
  return g;
}

function blip(freq, duration, volume, type) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + duration + 0.02);
}

export function setEngine(speed, inCar) {
  if (!ctx) return;
  const target = inCar ? 0.05 + Math.min(Math.abs(speed) / 34, 1) * 0.06 : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 4.5, ctx.currentTime, 0.08);
}

export function setSiren(on) {
  if (!ctx) return;
  sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
  if (on) {
    const t = ctx.currentTime;
    sirenOsc.frequency.cancelScheduledValues(t);
    sirenOsc.frequency.setValueAtTime(700, t);
    sirenOsc.frequency.linearRampToValueAtTime(950, t + 0.4);
    sirenOsc.frequency.linearRampToValueAtTime(700, t + 0.8);
  }
}

export function playShot() {
  if (!ctx) return;
  noiseBurst(0.14, 0.5, 2400);
  blip(160, 0.08, 0.3, 'square');
}

export function playPunch() {
  if (!ctx) return;
  noiseBurst(0.09, 0.35, 500);
}

export function playHit() {
  if (!ctx) return;
  blip(220, 0.12, 0.25, 'triangle');
  blip(110, 0.15, 0.2, 'triangle');
}

export function playPickup() {
  if (!ctx) return;
  blip(660, 0.1, 0.25);
  setTimeout(() => blip(880, 0.14, 0.25), 90);
  setTimeout(() => blip(1320, 0.2, 0.22), 180);
}

export function playMission() {
  if (!ctx) return;
  [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.18, 0.25), i * 110));
}

export function playBusted() {
  if (!ctx) return;
  [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 0.25, 'sawtooth'), i * 160));
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
