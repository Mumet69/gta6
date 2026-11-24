// hud.js — DOM HUD, minimap, toasts, mission cards, wanted stars.
import { clamp } from './util.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), wanted: $('wanted'), clock: $('clock-time'), cash: $('cash-val'),
    minimap: $('minimap'), mTitle: $('mission-title'), mText: $('mission-text'),
    mDist: $('mission-dist'), health: $('health-bar'), armor: $('armor-bar'),
    ammo: $('ammo'), speedo: $('speedo'), speed: $('speed-val'), carName: $('car-name'),
    toast: $('toast'), hint: $('hint'), crosshair: $('crosshair'),
    damage: $('damage'), station: $('station'), menu: $('menu'),
    menuStats: $('menu-stats'), card: $('card'),
  };
  const mm = els.minimap.getContext('2d');
  let toastTimer = 0;
  return {
    els,
    show() { els.hud.classList.remove('hidden'); },
    hide() { els.hud.classList.add('hidden'); },
    setWanted(n) {
      let s = '';
      for (let i = 0; i < 5; i++) s += i < n ? '★' : '<span class="off">★</span>';
      els.wanted.innerHTML = s;
    },
    setCash(v) { els.cash.textContent = v.toLocaleString('en-US'); },
    setHealth(h, a) {
      els.health.style.width = clamp(h, 0, 100) + '%';
      els.armor.style.width = clamp(a, 0, 100) + '%';
    },
    setClock(minutes) {
      const h = Math.floor(minutes / 60) % 24;
      const m = Math.floor(minutes % 60);
      els.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    },
    setMission(title, text, dist) {
      if (title) els.mTitle.textContent = title;
      if (text) els.mText.textContent = text;
      els.mDist.textContent = dist != null ? dist + ' m to marker' : '';
      els.mDist.style.display = dist != null ? '' : 'none';
    },
    setSpeed(kmh, carName) {
      els.speedo.classList.remove('hidden');
      els.speed.textContent = Math.round(kmh);
      els.carName.textContent = carName;
    },
    hideSpeed() { els.speedo.classList.add('hidden'); },
    setAmmo(s) { els.ammo.textContent = s; },
    setStation(name) { els.station.textContent = name; },
    toast(msg, ms = 2600) {
      els.toast.textContent = msg;
      els.toast.style.opacity = 1;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { els.toast.style.opacity = 0; }, ms);
    },
    damageFlash() {
      els.damage.classList.add('hit');
      setTimeout(() => els.damage.classList.remove('hit'), 180);
    },
    card(kicker, title, text, sub, ms = 3400) {
      const c = els.card;
      document.getElementById('card-kicker').textContent = kicker;
      document.getElementById('card-title').textContent = title;
      document.getElementById('card-text').textContent = text;
      document.getElementById('card-sub').textContent = sub || '';
      c.classList.remove('hidden');
      setTimeout(() => c.classList.add('hidden'), ms);
    },
    // Top-down minimap: roads, beach, player arrow, traffic, police, marker.
    drawMinimap(px, pz, heading, traffic, police, peds, marker, enemies) {
      const W = 220, S = W / 420; // world -210..210
      mm.clearRect(0, 0, W, W);
      mm.fillStyle = '#0e1a2e'; mm.fillRect(0, 0, W, W);
      const X = (x) => (x + 210) * S, Z = (z) => (z + 210) * S;
      // ocean + beach
      mm.fillStyle = '#1a6f8e'; mm.fillRect(X(150), 0, W - X(150), W);
      mm.fillStyle = '#e8cf9a'; mm.fillRect(X(140), 0, X(150) - X(140), W);
      // blocks
      mm.fillStyle = '#2c3a52';
      for (let bx = -3; bx < 3; bx++) for (let bz = -3; bz < 3; bz++) {
        mm.fillRect(X(bx * 42 + 8), Z(bz * 42 + 8), 26 * S, 26 * S);
      }
      // roads
      mm.strokeStyle = '#5a6b85'; mm.lineWidth = 5;
      for (let i = -3; i <= 3; i++) {
        mm.beginPath(); mm.moveTo(X(i * 42), 0); mm.lineTo(X(i * 42), W); mm.stroke();
        mm.beginPath(); mm.moveTo(0, Z(i * 42)); mm.lineTo(W, Z(i * 42)); mm.stroke();
      }
      // mission marker (pulsing)
      if (marker) {
        const pulse = 6 + Math.sin(performance.now() / 250) * 2;
        mm.fillStyle = '#ff5da2';
        mm.beginPath(); mm.arc(X(marker.x), Z(marker.z), pulse, 0, Math.PI * 2); mm.fill();
        mm.strokeStyle = '#fff'; mm.lineWidth = 2;
        mm.beginPath(); mm.arc(X(marker.x), Z(marker.z), pulse + 3, 0, Math.PI * 2); mm.stroke();
      }
      const dot = (x, z, color, r) => {
        mm.fillStyle = color; mm.beginPath(); mm.arc(X(x), Z(z), r, 0, Math.PI * 2); mm.fill();
      };
      for (const p of peds) dot(p.mesh.position.x, p.mesh.position.z, '#9fb4d8', 1.6);
      for (const t of traffic) dot(t.mesh.position.x, t.mesh.position.z, '#ffd23f', 2.2);
      for (const e of (enemies || [])) if (e.alive) dot(e.mesh.position.x, e.mesh.position.z, '#ff3355', 2.6);
      for (const c of police) dot(c.mesh.position.x, c.mesh.position.z, '#35f1ff', 3);
      // player arrow
      mm.save();
      mm.translate(X(px), Z(pz));
      mm.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
      mm.fillStyle = '#fff';
      mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
      mm.strokeStyle = '#000'; mm.lineWidth = 1; mm.stroke();
      mm.restore();
      // north + border ring label
      mm.fillStyle = 'rgba(255,255,255,0.8)';
      mm.font = 'bold 11px sans-serif'; mm.fillText('N', W / 2 - 3, 13);
    },
  };
}
