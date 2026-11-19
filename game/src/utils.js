// utils.js — small math + RNG helpers shared by every SOLMAR HEAT system.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

// mulberry32 — deterministic seeded RNG so the city is identical every load
// for the same seed (screenshots and replays stay consistent).
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function randRange(rng, a, b) { return a + rng() * (b - a); }
export function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

// AABB collision: point (with radius) against a list of {minX,maxX,minZ,maxZ}.
// Returns the corrected position, or null when there is no overlap.
export function resolveAABBCollisions(x, z, radius, colliders) {
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
      const dxl = x + radius - c.minX; // push left
      const dxr = c.maxX - (x - radius); // push right
      const dzl = z + radius - c.minZ; // push up (toward -z)
      const dzr = c.maxZ - (z - radius); // push down (toward +z)
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = c.minX - radius;
      else if (m === dxr) x = c.maxX + radius;
      else if (m === dzl) z = c.minZ - radius;
      else z = c.maxZ + radius;
      hit = true;
    }
  }
  return { x, z, hit };
}

export function pointInAABB(x, z, c) {
  return x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;
}

// format helpers for the HUD
export function fmtCash(n) { return Math.floor(n).toLocaleString('en-US'); }
export function fmtClock(playSeconds) {
  const mins = 8 * 60 + Math.floor(playSeconds / 10); // 1 real sec = 6 game-min
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `DAY 1 · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
