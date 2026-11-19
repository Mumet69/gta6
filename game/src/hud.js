// hud.js — the HUD: health, cash, wanted stars, clock, objectives, minimap.
// The minimap is a 2D canvas: roads, the player, police, rivals and the
// mission marker. Menus (title, pause, busted, wasted) are DOM overlays.
import { G } from './state.js';
import { clockString, moneyString } from './utils.js';
import { wantedLabel } from './wanted.js';
import { missionProgressText, missionMarkerPos } from './missions.js';
import { BLOCK, HALF, BEACH_X } from './city.js';

let els = {};
let mapCtx = null;

export function bindHud() {
  els = {
    health: document.getElementById('hud-health-fill'),
    healthText: document.getElementById('hud-health-text'),
    cash: document.getElementById('hud-cash'),
    stars: document.getElementById('hud-stars'),
    clock: document.getElementById('hud-clock'),
    day: document.getElementById('hud-day'),
    objective: document.getElementById('hud-objective'),
    objectiveTitle: document.getElementById('hud-objective-title'),
    speed: document.getElementById('hud-speed'),
    weapon: document.getElementById('hud-weapon'),
    ammo: document.getElementById('hud-ammo'),
    message: document.getElementById('hud-message'),
    timer: document.getElementById('hud-timer'),
    map: document.getElementById('minimap'),
  };
  if (els.map) mapCtx = els.map.getContext('2d');
}

export function updateHud() {
  if (!els.health) return;
  els.health.style.width = `${G.health}%`;
  els.health.style.background = G.health > 50 ? '#3a9a5a' : G.health > 25 ? '#d8a03a' : '#c23a3a';
  els.healthText.textContent = `${Math.ceil(G.health)}`;
  els.cash.textContent = moneyString(G.cash);
  els.stars.textContent = wantedLabel();
  els.stars.style.color = G.wanted > 0 ? '#ffd83a' : '#888888';
  els.clock.textContent = clockString(G.playTime);
  els.day.textContent = `DAY ${G.day}`;
  const m = G.mission;
  if (m) {
    els.objectiveTitle.textContent = m.def.title;
    els.objective.textContent = missionProgressText();
  } else if (G.missionIndex < 4) {
    els.objectiveTitle.textContent = 'FREE ROAM';
    els.objective.textContent = 'Explore Neon Harbor. Press M for the next job.';
  } else {
    els.objectiveTitle.textContent = 'FREE ROAM';
    els.objective.textContent = 'All jobs done. The city is yours.';
  }
  els.speed.textContent = G.playerCar ? `${Math.round(Math.abs(G.playerCar.speed) * 2.2)} MPH` : '';
  els.weapon.textContent = G.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
  els.ammo.textContent = G.weapon === 'pistol' ? `${G.ammo}/${G.reserveAmmo}` : '—';
  els.timer.textContent = G.missionTimer > 0 ? `${Math.ceil(G.missionTimer)}s` : '';
  if (G.message && G.playTime < G.messageUntil) {
    els.message.textContent = G.message;
    els.message.style.opacity = '1';
  } else {
    els.message.style.opacity = '0';
  }
  drawMinimap();
}

function drawMinimap() {
  if (!mapCtx || !G.city) return;
  const S = 150, C = S / 2;
  const scale = S / 560;
  const ctx = mapCtx;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#12202a';
  ctx.fillRect(0, 0, S, S);
  // Ocean + beach.
  ctx.fillStyle = '#1e6f9e';
  ctx.fillRect(C + BEACH_X * scale, 0, S, S);
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(C + (BEACH_X - 30) * scale, 0, 30 * scale, S);
  // Roads.
  ctx.strokeStyle = '#4a4a55';
  ctx.lineWidth = 3;
  for (let i = -HALF; i <= HALF; i++) {
    const c = C + i * BLOCK * scale;
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(S, c); ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = '#d8b83a';
  for (const lm of Object.values(G.city.landmarks)) {
    ctx.fillRect(C + lm.pos.x * scale - 2, C + lm.pos.z * scale - 2, 4, 4);
  }
  // Mission marker (pulsing yellow diamond).
  const mp = missionMarkerPos();
  if (mp) {
    const pulse = 4 + Math.sin(G.playTime * 5) * 2;
    ctx.fillStyle = '#ffe93a';
    ctx.beginPath();
    ctx.moveTo(C + mp.x * scale, C + mp.z * scale - pulse);
    ctx.lineTo(C + mp.x * scale + pulse, C + mp.z * scale);
    ctx.lineTo(C + mp.x * scale, C + mp.z * scale + pulse);
    ctx.lineTo(C + mp.x * scale - pulse, C + mp.z * scale);
    ctx.fill();
  }
  // Police (red dots), rivals (orange), player (green, with heading tick).
  ctx.fillStyle = '#ff3a3a';
  for (const car of G.policeCars) {
    ctx.fillRect(C + car.pos.x * scale - 2, C + car.pos.z * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#ff8a2a';
  if (G.mission && G.mission.rivals) {
    for (const r of G.mission.rivals) {
      ctx.fillRect(C + r.pos.x * scale - 2, C + r.pos.z * scale - 2, 4, 4);
    }
  }
  const px = C + G.player.pos.x * scale, pz = C + G.player.pos.z * scale;
  ctx.fillStyle = '#3aff6a';
  ctx.beginPath(); ctx.arc(px, pz, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3aff6a';
  ctx.beginPath();
  ctx.moveTo(px, pz);
  ctx.lineTo(px + Math.sin(G.player.heading) * 8, pz + Math.cos(G.player.heading) * 8);
  ctx.stroke();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N', C - 3, 10);
}

export function showMessage(text, seconds = 3) {
  G.message = text;
  G.messageUntil = G.playTime + seconds;
}

export function showScreen(id) {
  for (const s of ['screen-title', 'screen-pause', 'screen-busted', 'screen-wasted']) {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? 'flex' : 'none';
  }
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = id ? 'none' : 'block';
}
