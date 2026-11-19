// hud.js — the SOLMAR HEAT HUD: health, cash, wanted stars, clock, mission
// objective, speed, weapon, toasts, center messages, and the live minimap.
// The minimap is a top-down canvas: roads, blocks, landmarks, the mission
// beacon, police, traffic and the player arrow, all rotating with the player.
import { fmtCash, fmtClock } from './utils.js';

export class HUD {
  constructor() {
    this.el = {
      healthFill: document.getElementById('health-fill'),
      cash: document.getElementById('cash'),
      stars: document.getElementById('stars'),
      clock: document.getElementById('clock'),
      missionTitle: document.getElementById('mission-title'),
      missionDesc: document.getElementById('mission-desc'),
      missionDist: document.getElementById('mission-dist'),
      speed: document.getElementById('speed'),
      weapon: document.getElementById('weapon'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      vignette: document.getElementById('vignette'),
      centerMsg: document.getElementById('center-msg'),
      centerTitle: document.getElementById('center-title'),
      centerText: document.getElementById('center-text'),
      centerSub: document.getElementById('center-sub'),
      hint: document.getElementById('hint'),
      minimap: document.getElementById('minimap'),
    };
    this.minimapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.centerTimer = null;
  }

  update(G, missionStage, missionTarget, missionDist, speedMph) {
    const hp = Math.max(0, Math.min(100, G.health));
    this.el.healthFill.style.width = hp + '%';
    this.el.healthFill.style.background = hp > 50
      ? 'linear-gradient(90deg, #37d67a, #9be15d)'
      : hp > 25 ? 'linear-gradient(90deg, #e8a83a, #f5d76e)' : 'linear-gradient(90deg, #d83a3a, #f56e6e)';
    this.el.cash.textContent = fmtCash(G.cash);
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '<span class="dim">★</span>';
    this.el.stars.innerHTML = stars;
    this.el.clock.textContent = fmtClock(G.playTime);
    if (missionStage) {
      this.el.missionTitle.textContent = missionStage.title;
      let desc = missionStage.desc;
      if (missionStage.timer && G.mission) desc += ` — ${Math.ceil(G.mission.timer)}s left`;
      if (missionStage.hold && G.mission) desc += ` — ${Math.max(0, missionStage.hold - G.mission.holdProgress).toFixed(1)}s`;
      if (missionStage.kills && G.mission) desc = `Take out all ${missionStage.kills} Vipers. ${G.mission.kills} / ${missionStage.kills} down.`;
      this.el.missionDesc.textContent = desc;
      this.el.missionDist.textContent = missionTarget ? `OBJECTIVE ${Math.round(missionDist)}m — FOLLOW THE GOLD BEACON` : '';
    } else {
      this.el.missionTitle.textContent = G.missionIndex >= 4 ? 'LEGEND OF SOLMAR' : 'FREE ROAM';
      this.el.missionDesc.textContent = G.missionIndex >= 4
        ? 'All jobs done. Solmar City is yours, Rio.'
        : 'Explore Solmar City. Steal a car, earn cash, stay out of trouble. Next job starts soon…';
      this.el.missionDist.textContent = '';
    }
    this.el.speed.innerHTML = `${Math.round(Math.abs(speedMph))} <small>MPH</small>`;
    const weaponName = G.weapon === 'pistol' ? `PISTOL · ${G.ammo} / ${G.reserveAmmo}` : 'FISTS';
    this.el.weapon.textContent = weaponName;
    this.el.crosshair.style.display = G.weapon === 'pistol' && !G.player?.inCar ? 'block' : 'none';
    this.el.vignette.style.opacity = String(Math.max(0, (55 - G.health) / 55) * 0.9);
  }

  toast(text, ms = 4200) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
  }

  center(title, text, sub = '', ms = 2600) {
    this.el.centerTitle.textContent = title;
    this.el.centerText.textContent = text;
    this.el.centerSub.textContent = sub;
    this.el.centerMsg.style.display = 'block';
    clearTimeout(this.centerTimer);
    this.centerTimer = setTimeout(() => { this.el.centerMsg.style.display = 'none'; }, ms);
  }

  hideCenter() { this.el.centerMsg.style.display = 'none'; }

  drawMinimap(G, city, missionTarget) {
    const ctx = this.minimapCtx;
    const S = 196;
    const scale = S / 440; // city + margin
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    // water + land
    ctx.fillStyle = '#16283e';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2a2f38';
    ctx.fillRect(0, 0, S - 22, S);
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(S - 22, 0, 6, S);
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(S - 16, 0, 16, S);
    // roads
    ctx.strokeStyle = '#4a4f5a';
    ctx.lineWidth = 4;
    for (const p of city.roadLines) {
      const [x1, y1] = toMap(p, -198);
      const [x2, y2] = toMap(p, 198);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-198, p);
      const [x4, y4] = toMap(198, p);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // blocks
    ctx.fillStyle = '#3a3f4a';
    for (const b of city.blockCenters) {
      const [x, y] = toMap(b.x - 14, b.z - 14);
      ctx.fillRect(x, y, 28 * scale, 28 * scale);
    }
    // landmarks
    const lm = city.landmarks;
    const drawLm = (p, color, label) => {
      const [x, y] = toMap(p.x, p.z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    };
    drawLm(lm.bank, '#e8c860');
    drawLm(lm.station, '#4a6ab8');
    drawLm(lm.hospital, '#f0f0e8');
    drawLm(lm.safehouse, '#c96a4a');
    drawLm(lm.marina, '#3aa86a');
    // mission beacon
    if (missionTarget) {
      const [x, y] = toMap(missionTarget.x, missionTarget.z);
      const pulse = 6 + Math.sin(G.time * 4) * 2;
      ctx.fillStyle = '#ffb02e';
      ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // traffic + police dots
    ctx.fillStyle = '#cfd2dc';
    for (const c of G.trafficCars) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.fillStyle = '#5a8aff';
    for (const c of G.policeCars) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow (rotates with heading)
    const px = G.player ? G.player.pos.x : 0;
    const pz = G.player ? G.player.pos.z : 0;
    const [mx, my] = toMap(px, pz);
    const heading = G.player ? G.player.heading : 0;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    // north tick
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('N', S / 2 - 3, 12);
  }
}
