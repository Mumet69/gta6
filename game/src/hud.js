// hud.js — Velvet Bay HUD: money, debt, health, wanted stars, mission
// objective, speed, ammo, clock, banners, prompts and the minimap canvas.
// The minimap is player-centred, north-up, and shows roads, buildings,
// water, cars, police and the mission marker.

import { moneyStr, formatClock, clamp } from './utils.js';
import { CITY } from './city.js';
import { respectRank } from './state.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.money = this.el('hud-money');
    this.debt = this.el('hud-debt');
    this.side = this.el('hud-side');
    this.healthFill = this.el('hud-health-fill');
    this.healthText = this.el('hud-health-text');
    this.stars = this.el('hud-stars');
    this.objective = this.el('hud-objective');
    this.objDist = this.el('hud-objective-dist');
    this.speed = this.el('hud-speed');
    this.ammo = this.el('hud-ammo');
    this.clockEl = this.el('hud-clock');
    this.bannerEl = this.el('hud-banner');
    this.bannerSub = this.el('hud-banner-sub');
    this.promptEl = this.el('hud-prompt');
    this.toastEl = this.el('hud-toast');
    this.map = this.el('minimap');
    // The minimap is drawn on this canvas but shown through an <img>:
    // a live 2D canvas layer leaves a stale black tile in headless
    // SwiftShader full-viewport captures. The <img> is plain DOM content.
    this.mapCtx = this.map ? this.map.getContext('2d', { willReadFrequently: true }) : null;
    this.mapImg = this.el('minimap-img');
    this.mapSyncTimer = 0;
    this.bannerTimer = 0;
    this.toastTimer = 0;
    this.frame = 0;
  }

  banner(text, sub = '') {
    if (!this.bannerEl) return;
    this.bannerEl.textContent = text;
    this.bannerSub.textContent = sub;
    this.bannerEl.parentElement.classList.add('show');
    this.bannerTimer = 3.6;
  }

  toast(text) {
    if (!this.toastEl) return;
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = 2.2;
  }

  prompt(text) {
    if (!this.promptEl) return;
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.classList.add('show');
    } else {
      this.promptEl.classList.remove('show');
    }
  }

  update(G, dt) {
    this.frame++;
    const s = G.state;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.parentElement.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
    // Text updates every few frames.
    if (this.frame % 4 === 0) {
      if (this.money) this.money.textContent = moneyStr(s.money);
      if (this.debt) this.debt.textContent = 'DEBT ' + moneyStr(s.debt);
      // Street reputation + side-job progress, one line under the debt.
      if (this.side) {
        this.side.textContent = respectRank(s.respect) + ' ★' + s.respect
          + '  •  COINS ' + s.stats.coinsCollected + '/12'
          + '  •  TAXI ' + s.stats.taxiFares
          + '  •  RACES ' + s.stats.racesWon
          + '  •  FRONTS ' + (s.empire.businesses || []).length + '/3'
          + '  •  TURF ' + Object.values(s.empire.turf || {}).filter((o) => o === 'mara').length + '/5';
      }
      // Empire + weapon line, under the side line when the element exists.
      const empireEl = this.el('hud-empire');
      if (empireEl) {
        const prep = Object.values(s.empire.prep || {}).filter(Boolean).length;
        empireEl.textContent = 'FRONTS $' + (G.empire ? G.empire.incomePerTick : 0) + '/45s'
          + '  •  DELIVERIES ' + (s.deliveriesDone || 0)
          + '  •  HEIST PREP ' + prep + '/3'
          + '  •  ' + (s.weapon || 'pistol').toUpperCase();
      }
      if (this.healthFill) this.healthFill.style.width = clamp(s.health, 0, 100) + '%';
      if (this.healthText) this.healthText.textContent = Math.ceil(s.health) + ' HP';
      if (this.stars) {
        let str = '';
        for (let i = 0; i < 5; i++) str += i < s.wanted ? '★' : '☆';
        this.stars.textContent = str;
        this.stars.classList.toggle('hot', s.wanted > 0);
      }
      if (this.clockEl) this.clockEl.textContent = formatClock(s.clock);
      if (this.ammo) {
        const w = s.weapon || 'pistol';
        const wAmmo = w === 'pistol' ? s.ammo + ' / ' + s.reserveAmmo
          : (s.weaponAmmo[w] || 0) + ' ' + w.toUpperCase();
        this.ammo.textContent = wAmmo;
      }
      if (this.speed) {
        this.speed.textContent = !G.player.onFoot && G.player.car
          ? Math.round(Math.abs(G.player.car.speed) * 3.6) + ' km/h'
          : '';
      }
      const mObj = G.missions.objective();
      // When no story mission has a marker, the beacon falls back to the
      // active side job (fare, race checkpoint, waiting customer), then to
      // the empire (turf war or a front Mara can afford).
      let obj = mObj;
      if (!mObj.marker && G.activities) {
        const aObj = G.activities.objective();
        if (aObj.marker) obj = aObj;
      }
      if (!obj.marker && G.empire) {
        const eObj = G.empire.objective();
        if (eObj.marker) obj = eObj;
      }
      if (this.objective) this.objective.textContent = obj.text;
      if (this.objDist) {
        this.objDist.textContent = obj.marker
          ? (obj.dist + 'm' + (obj.timeLeft > 0 ? '  •  ' + Math.ceil(obj.timeLeft) + 's' : ''))
          : '';
      }
    }
    this.drawMinimap(G);
    // Mirror the canvas into the <img> a few times a second.
    this.mapSyncTimer += dt;
    if (this.mapSyncTimer > 0.25 && this.mapImg && this.map) {
      this.mapSyncTimer = 0;
      try { this.mapImg.src = this.map.toDataURL(); } catch (e) { /* ignore */ }
    }
  }

  drawMinimap(G) {
    if (!this.mapCtx) return;
    const ctx = this.mapCtx;
    const W = this.map.width, H = this.map.height;
    const px = G.player.pos.x, pz = G.player.pos.z;
    const range = 230; // metres shown across the map
    const scale = W / (range * 2);
    const toMap = (x, z) => [(x - px) * scale + W / 2, (z - pz) * scale + H / 2];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1622';
    ctx.fillRect(0, 0, W, H);
    // Water (south) and beach.
    ctx.fillStyle = '#1d5f80';
    const [wx0, wy0] = toMap(px - range, CITY.waterZ);
    ctx.fillRect(0, wy0, W, H - wy0);
    ctx.fillStyle = '#c9b078';
    const [, by0] = toMap(px, CITY.beachZ);
    ctx.fillRect(0, by0, W, wy0 - by0);
    // Docks (east).
    ctx.fillStyle = '#5a564e';
    const [dx0] = toMap(CITY.docksX, pz);
    ctx.fillRect(dx0, 0, W - dx0, H);
    // Roads.
    ctx.strokeStyle = '#4a4f57';
    ctx.lineWidth = Math.max(2, CITY.roadWidth * scale);
    for (const line of CITY.lines) {
      const [x1, y1] = toMap(line, pz - range);
      const [x2, y2] = toMap(line, pz + range);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(px - range, line);
      const [x4, y4] = toMap(px + range, line);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#232a33';
    for (const c of G.city.colliders) {
      const [bx, by] = toMap(c.minX, c.minZ);
      ctx.fillRect(bx, by, (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
    }
    // Mission marker.
    const mObj = G.missions.objective();
    let obj = mObj;
    if (!mObj.marker && G.activities) {
      const aObj = G.activities.objective();
      if (aObj.marker) obj = aObj;
    }
    if (!obj.marker && G.empire) {
      const eObj = G.empire.objective();
      if (eObj.marker) obj = eObj;
    }
    // Empire markers on the map: fronts green, turf flags purple (green
    // once Mara holds them), heist prep blue.
    if (G.empire) {
      for (const b of G.empire.markers || []) {
        if (b.kind !== 'business' && b.kind !== 'turf') continue;
        const [mx, my] = toMap(b.mesh.position.x, b.mesh.position.z);
        if (mx < 0 || mx > W || my < 0 || my > H) continue;
        ctx.fillStyle = b.kind === 'business' ? '#37d67a' : (G.state.empire.turf[b.id] === 'mara' ? '#37d67a' : '#b44ad8');
        ctx.fillRect(mx - 3, my - 3, 6, 6);
      }
    }
    if (obj.marker) {
      const [mx, my] = toMap(obj.marker.x, obj.marker.z);
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(clamp(mx, 8, W - 8), clamp(my, 8, H - 8), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#101418';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Cars (yellow) and police (flashing red/blue).
    for (const car of G.traffic.cars) {
      const [cx, cy] = toMap(car.x, car.z);
      if (cx < -4 || cx > W + 4 || cy < -4 || cy > H + 4) continue;
      if (car.kind === 'police') {
        ctx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#ff2a22' : '#2a5aff';
      } else {
        ctx.fillStyle = '#ffd34d';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sunset Coins (gold dots), waiting fare customer (yellow square) and
    // race gate (white square) — the side jobs are on the map too.
    if (G.activities) {
      ctx.fillStyle = '#ffd34d';
      for (const coin of G.activities.coins) {
        const [cx, cy] = toMap(coin.x, coin.z);
        if (cx < 0 || cx > W || cy < 0 || cy > H) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (G.activities.fareCustomer) {
        const [fx, fy] = toMap(G.activities.fareCustomer.x, G.activities.fareCustomer.z);
        ctx.fillRect(fx - 3, fy - 3, 6, 6);
      }
      const [rx, ry] = toMap(58, -58);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx - 3, ry - 3, 6, 6);
    }
    // Police helicopter overhead (red ring) when it is up.
    if (G.wanted && G.wanted.heli) {
      const [hx, hy] = toMap(G.wanted.heli.position.x, G.wanted.heli.position.z);
      ctx.strokeStyle = '#ff2a22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.PI - G.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#101418';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // Border.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }
}
