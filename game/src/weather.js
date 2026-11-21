// weather.js — Velvet Bay day/night cycle and drifting clouds.
// The in-game clock drives the sun across the sky: pale morning, hard
// midday, golden hour, dusk, then night with the streetlights on. Clouds
// drift over the bay. Everything is computed from the clock, so the look is
// deterministic for a given time of day.

import * as THREE from 'three';
import { clamp, lerp } from './utils.js';

// Keyframes across the 24h clock: sky colour, fog colour, sun colour,
// sun elevation factor and hemisphere light level.
const SKY_KEYS = [
  { t: 0.0, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8899bb, hemi: 0.25 },
  { t: 0.25, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8899bb, hemi: 0.25 }, // 06:00 night
  { t: 0.30, sky: 0xffb37a, fog: 0xe8a06a, sun: 0xffc98a, hemi: 0.6 },  // 07:12 dawn
  { t: 0.36, sky: 0x8ec3e8, fog: 0x9fc6e2, sun: 0xfff1cf, hemi: 0.95 }, // 08:38 morning
  { t: 0.70, sky: 0x8ec3e8, fog: 0x9fc6e2, sun: 0xfff1cf, hemi: 0.95 }, // 16:48 midday
  { t: 0.76, sky: 0xff9d5c, fog: 0xe89a5a, sun: 0xffb35c, hemi: 0.7 },  // 18:14 golden hour
  { t: 0.82, sky: 0x2a2a55, fog: 0x2a2a55, sun: 0xcc8866, hemi: 0.4 },  // 19:40 dusk
  { t: 0.88, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8899bb, hemi: 0.25 }, // 21:07 night
  { t: 1.0, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8899bb, hemi: 0.25 },
];

function sampleSky(frac) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (frac >= SKY_KEYS[i].t && frac <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const span = Math.max(1e-6, b.t - a.t);
  const k = clamp((frac - a.t) / span, 0, 1);
  const mix = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), k);
  return {
    sky: mix(a.sky, b.sky),
    fog: mix(a.fog, b.fog),
    sun: mix(a.sun, b.sun),
    hemi: lerp(a.hemi, b.hemi, k),
    sunUp: frac > 0.27 && frac < 0.84,
  };
}

export function phaseName(clockMinutes) {
  const h = clockMinutes / 60;
  if (h < 6 || h >= 21) return 'Night';
  if (h < 8) return 'Dawn';
  if (h < 17) return 'Day';
  if (h < 19) return 'Golden hour';
  return 'Dusk';
}

// v3 weather: passing rain squalls off the bay. Rain is 0 (dry) to 1
// (storm); it dims the sun, slickens the roads (cars slide a little more)
// and makes the night crowd pay double for taxi rides home.
export function rainLabel(rain) {
  if (rain > 0.7) return 'Storm';
  if (rain > 0.3) return 'Rain';
  if (rain > 0.05) return 'Drizzle';
  return 'Clear';
}

export class DayNightCycle {
  constructor(scene, refs) {
    this.scene = scene;
    this.sun = refs.sun;   // directional light, owned by city.js
    this.hemi = refs.hemi; // hemisphere light, owned by city.js
    this.rain = 0; // 0 dry .. 1 storm
    this.rainTimer = 90 + Math.random() * 60; // seconds until the next squall
    this.stormTimer = 0;
    this.lightning = 0;
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) {
        const puff = new THREE.Mesh(new THREE.BoxGeometry(18 + k * 8, 4, 12 + k * 3), cloudMat);
        puff.position.set(k * 12 - n * 6, (k % 2) * 1.5, (k % 3) * 4 - 4);
        g.add(puff);
      }
      g.position.set(-280 + i * 85, 120 + (i % 3) * 18, -260 + ((i * 97) % 480));
      this.scene.add(g);
      this.clouds.push({ group: g, speed: 1.2 + (i % 3) * 0.7 });
    }
  }

  // clockMinutes: in-game minutes since midnight (state.clock).
  update(dt, clockMinutes) {
    const frac = ((clockMinutes % 1440) + 1440) % 1440 / 1440;
    const s = sampleSky(frac);
    // Sun arcs east to west while it is up; at night it parks below the city.
    const dayFrac = clamp((frac - 0.27) / (0.84 - 0.27), 0, 1);
    const ang = Math.PI * dayFrac;
    const elev = s.sunUp ? Math.sin(ang) : -0.2;
    this.sun.position.set(Math.cos(ang) * 220, Math.max(30, elev * 280), 120);
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunUp ? 1.5 : 0.25;
    this.hemi.intensity = s.hemi;
    this.scene.background = s.sky;
    if (this.scene.fog) this.scene.fog.color.copy(s.fog);
    // Clouds drift with the sea breeze and wrap around the map.
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 340) c.group.position.x = -340;
    }
    // Rain squalls: a dry spell, then 30-50 seconds of rain, then dry again.
    // Storms flash lightning (a brief sky brightening) every few seconds.
    if (this.stormTimer > 0) {
      this.stormTimer -= dt;
      this.rain = Math.min(1, this.rain + dt * 0.4);
      if (Math.random() < dt * 0.25) this.lightning = 0.18;
      if (this.stormTimer <= 0) this.rainTimer = 120 + Math.random() * 120;
    } else {
      this.rainTimer -= dt;
      this.rain = Math.max(0, this.rain - dt * 0.15);
      if (this.rainTimer <= 0) this.stormTimer = 30 + Math.random() * 20;
    }
    if (this.lightning > 0) {
      this.lightning -= dt;
      this.sun.intensity = s.sunUp ? 2.6 : 0.9;
    } else if (this.rain > 0.05) {
      // Rain dims the sun a little and greys the sky.
      this.sun.intensity *= (1 - this.rain * 0.35);
      this.scene.background.lerp(new THREE.Color(0x5a6a7a), this.rain * 0.25);
    }
  }
}
