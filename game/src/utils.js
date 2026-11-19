// utils.js — DUSTLINE: seeded RNG + math helpers (no dependencies).
// Every random choice in the city and traffic uses a seeded generator so the
// world is identical on every load for a given seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
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

// Distance from a point (x,z) to a segment (ax,az)-(bx,bz).
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

// Circle (x,z,r) vs axis-aligned box {minX,maxX,minZ,maxZ}: true on overlap.
export function circleHitsBox(x, z, r, b) {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// Push a circle out of a box; returns the corrected {x,z}.
export function resolveCircleBox(x, z, r, b) {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  let dx = x - cx, dz = z - cz;
  let d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return { x, z };
  if (d2 < 1e-6) {
    // Centre inside the box: push out along the smallest penetration axis.
    const pl = x - (b.minX - r), pr = (b.maxX + r) - x;
    const pt = z - (b.minZ - r), pb = (b.maxZ + r) - z;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pl) return { x: b.minX - r, z };
    if (m === pr) return { x: b.maxX + r, z };
    if (m === pt) return { x, z: b.minZ - r };
    return { x, z: b.maxZ + r };
  }
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  return { x: x + dx * push, z: z + dz * push };
}

export function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function fmtClock(hour, minute) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor(minute) % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return hh + ':' + mm;
}
