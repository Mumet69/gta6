// utils.js — small math and random helpers shared by every Velvet Bay module.
// No imports. Everything here is pure and deterministic when given a seed.

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed difference between two angles (radians).
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * clamp(t, 0, 1);
}

export function rand(a = 1, b) {
  if (b === undefined) { b = a; a = 0; }
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Deterministic RNG (mulberry32) so the city layout is identical every load.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function moneyStr(n) {
  const v = Math.round(n);
  return '$' + v.toLocaleString('en-US');
}

export function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return pad2(m) + ':' + pad2(s);
}
