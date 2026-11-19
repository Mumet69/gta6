// utils.js — seeded RNG and small math helpers for NEON HARBOR.
// Every random choice in the city and traffic uses the seeded RNG, so the
// same seed always builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    rand,
    int(min, max) { return min + Math.floor(rand() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(rand() * arr.length)]; },
    range(min, max) { return min + rand() * (max - min); },
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function dist2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// Format seconds of game clock (starting 08:00) as HH:MM.
export function clockString(playSeconds) {
  const total = 8 * 3600 + playSeconds;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function moneyString(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
