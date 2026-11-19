// audio.js — all sound is synthesized with WebAudio: no audio files.
// Engine hum (oscillator pitched by speed), siren wail, gunshot noise,
// punch thud, cash chime, and a low-key bass music loop.
import { G } from './state.js';

let ctx = null;
let engineOsc = null, engineGain = null;
let musicTimer = null;
let musicStep = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Engine: a sawtooth through a low-pass, pitch follows the car.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filt).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
  } catch (e) {
    ctx = null;
  }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || G.muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

function noise(dur, vol, freq) {
  if (!ctx || G.muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = freq || 1200;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filt).connect(g).connect(ctx.destination);
  src.start();
}

export function playShoot() { noise(0.16, 0.5, 2600); tone(160, 0.1, 'square', 0.25, 60); }
export function playPunch() { noise(0.1, 0.4, 500); }
export function playEmpty() { tone(900, 0.05, 'square', 0.12); }
export function playReload() { tone(500, 0.06, 'square', 0.15); setTimeout(() => tone(700, 0.06, 'square', 0.15), 90); }
export function playCash() { tone(880, 0.12, 'sine', 0.25); setTimeout(() => tone(1318, 0.18, 'sine', 0.25), 110); }
export function playHurt() { tone(140, 0.25, 'sawtooth', 0.3, 70); }
export function playSirenBlip() { tone(750, 0.35, 'sine', 0.12, 1050); }
export function playMission() { tone(523, 0.15, 'sine', 0.25); setTimeout(() => tone(659, 0.15, 'sine', 0.25), 140); setTimeout(() => tone(784, 0.3, 'sine', 0.25), 280); }
export function playBusted() { tone(400, 0.4, 'sawtooth', 0.3, 180); }

export function updateEngine(speed, inCar) {
  if (!ctx || !engineOsc) return;
  const target = G.muted ? 0 : (inCar ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.003) : 0);
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 4.5, ctx.currentTime, 0.1);
}

// A slow bass loop: Am – F – C – G roots, one note per beat at 100 BPM.
const BASS = [55, 43.65, 65.41, 49];
export function startMusic() {
  if (!ctx || musicTimer) return;
  musicTimer = setInterval(() => {
    if (G.muted || G.mode !== 'playing') return;
    const f = BASS[musicStep % 4];
    tone(f, 0.55, 'triangle', 0.12);
    if (musicStep % 2 === 0) tone(f * 2, 0.2, 'sine', 0.05);
    musicStep += 1;
  }, 600);
}
