// hud.js — DUSTLINE: the heads-up display. DOM bars and text for health,
// cash, wanted stars, clock and the current objective, plus a live circular
// minimap drawn on a 2D canvas: roads, buildings, the player, police, traffic
// and the mission marker.

import { S } from './state.js';
import { fmtCash, fmtClock, clamp } from './utils.js';
import { City, HALF } from './city.js';
import { traffic, parked } from './vehicles.js';
import { footCops } from './people.js';

let els = {};
let mapCanvas = null;
let mapCtx = null;

export function initHUD() {
  els = {
    health: document.getElementById('hud-health'),
    healthFill: document.getElementById('hud-health-fill'),
    cash: document.getElementById('hud-cash'),
    stars: document.getElementById('hud-stars'),
    clock: document.getElementById('hud-clock'),
    objective: document.getElementById('hud-objective'),
    message: document.getElementById('hud-message'),
    speed: document.getElementById('hud-speed'),
    weapon: document.getElementById('hud-weapon'),
    mission: document.getElementById('hud-mission'),
  };
  mapCanvas = document.getElementById('minimap');
  if (mapCanvas) mapCtx = mapCanvas.getContext('2d');
}

export function updateHUD() {
  if (!els.health) return;
  els.healthFill.style.width = clamp(S.health, 0, 100) + '%';
  els.healthFill.style.background = S.health > 50 ? '#37c24a' : S.health > 25 ? '#e8b93a' : '#d93a2e';
  els.cash.textContent = fmtCash(S.cash);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  els.stars.textContent = stars;
  els.stars.style.color = S.wanted > 0 ? '#ffd23a' : '#888888';
  els.clock.textContent = 'DAY ' + S.day + '  ' + fmtClock(S.hour, S.minute);
  els.objective.textContent = S.objective;
  if (S.missionTimer > 0) {
    els.objective.textContent += '  —  ' + Math.ceil(S.missionTimer) + 's';
  }
  if (S.messageTimer > 0) {
    els.message.textContent = S.message;
    els.message.style.opacity = '1';
  } else {
    els.message.style.opacity = '0';
  }
  const speed = S.car ? Math.abs(S.car.speed) * 2.2 : Math.abs(S.walkSpeed) * 2.2;
  els.speed.textContent = S.car ? Math.round(speed) + ' MPH' : '';
  els.weapon.textContent = S.weapon === 'pistol'
    ? 'PISTOL  ' + S.mag + '/' + S.ammo
    : 'FISTS';
  els.mission.textContent = S.missionState === 'active'
    ? (S.mission + 1) + '/4  ' + (['FIRST GEAR', 'DESERT RUN', 'DUST BRAWL', 'THE BIG SCORE'][S.mission] || '')
    : '';
  drawMinimap();
}

function drawMinimap() {
  if (!mapCtx) return;
  const size = mapCanvas.width;
  const scale = size / (HALF * 2 + 60);
  const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
  const ctx = mapCtx;
  ctx.clearRect(0, 0, size, size);
  // Circular mask.
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.clip();
  // Desert background.
  ctx.fillStyle = '#c9a06a';
  ctx.fillRect(0, 0, size, size);
  // City slab.
  ctx.fillStyle = '#8a7f70';
  const [sx, sy] = toMap(-HALF - 12, -HALF - 12);
  ctx.fillRect(sx, sy, (HALF * 2 + 24) * scale, (HALF * 2 + 24) * scale);
  // Buildings.
  ctx.fillStyle = '#5a5148';
  for (const b of City.colliders) {
    const [bx, by] = toMap(b.minX, b.minZ);
    ctx.fillRect(bx, by, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
  }
  // Roads.
  ctx.strokeStyle = '#2e3138';
  ctx.lineWidth = Math.max(2, 10 * scale);
  for (let idx = 0; idx < City.nodes.length; idx++) {
    const n = City.nodes[idx];
    for (const nb of City.edges.get(idx) || []) {
      if (nb <= idx) continue;
      const m = City.nodes[nb];
      const [x1, y1] = toMap(n.x, n.z);
      const [x2, y2] = toMap(m.x, m.z);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  // Parked cars (grey dots), traffic (white dots).
  ctx.fillStyle = '#bbbbbb';
  for (const c of parked) {
    const [x, y] = toMap(c.x, c.z);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.fillStyle = '#ffffff';
  for (const c of traffic) {
    if (c.kind === 'police') continue;
    const [x, y] = toMap(c.x, c.z);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  // Police (red dots) and foot cops (red squares).
  ctx.fillStyle = '#ff2e2e';
  for (const c of traffic) {
    if (c.kind !== 'police') continue;
    const [x, y] = toMap(c.x, c.z);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const cop of footCops) {
    if (cop.down) continue;
    const [x, y] = toMap(cop.x, cop.z);
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  // Mission marker (yellow star).
  if (S.missionState === 'active') {
    const lm = currentMarkerTarget();
    if (lm) {
      const [x, y] = toMap(lm.x, lm.z);
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23a';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 7 + Math.sin(S.time * 4) * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Player arrow (rotates with heading).
  const [px, py] = toMap(S.px, S.pz);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-S.heading);
  ctx.fillStyle = '#37c24a';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', size / 2, 11);
  ctx.restore();
  // Rim.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); ctx.stroke();
}

function currentMarkerTarget() {
  const lm = City.landmarks;
  if (S.mission === 0) return lm.safehouse;
  if (S.mission === 1) return lm.tower;
  if (S.mission === 2) return lm.motel;
  if (S.mission === 3) return S.missionState === 'active' ? lm.bank : lm.safehouse;
  return null;
}
