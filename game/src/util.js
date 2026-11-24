// Shared helpers for VELVET BAY: math, random, procedural canvas textures.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function randi(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Seeded random so the city layout is the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Canvas texture of lit windows on a facade, tinted per building.
export function facadeTexture(base, lit, seed) {
  const r = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 128, 2);
  for (let y = 8; y < 256; y += 16) for (let x = 8; x < 128; x += 16) {
    const on = r() < 0.42;
    g.fillStyle = on ? (r() < 0.7 ? lit : '#ffe9a8') : 'rgba(10,14,28,0.85)';
    g.fillRect(x, y, 10, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Asphalt with lane dashes, used on road strips.
export function roadTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#23262e'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 200; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#ffd23f'; g.fillRect(62, 8, 4, 34); g.fillRect(62, 86, 4, 34);
  g.fillStyle = '#e8ecff'; g.fillRect(4, 0, 3, 128); g.fillRect(121, 0, 3, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Soft radial glow sprite (neon signs, beacons, headlights).
export function glowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
