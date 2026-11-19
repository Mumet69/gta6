// wanted.js — DUSTLINE: the wanted system. Crimes add heat; heat crosses
// thresholds into stars (0-5). Police cars spawn and chase the player, foot
// cops join at 2+ stars, and the heat decays when the player stays clean and
// out of sight. Getting caught on foot or wrecked at high wanted = busted.

import { S, showMessage } from './state.js';
import { makeRng, clamp, angleLerp } from './utils.js';
import { City } from './city.js';
import { traffic, spawnPoliceCar, removeCar } from './vehicles.js';
import { footCops, spawnFootCop } from './people.js';

const STAR_THRESHOLDS = [0, 15, 35, 55, 75, 92]; // heat needed for each star
const MAX_POLICE_CARS = [0, 1, 2, 3, 4, 5];
const MAX_FOOT_COPS = [0, 0, 1, 2, 3, 4];

let rng = makeRng(99);
let carSpawnTimer = 0;
let copSpawnTimer = 0;

export function initWanted(seed) {
  rng = makeRng(seed * 17 + 11);
  carSpawnTimer = 0;
  copSpawnTimer = 0;
}

export function addHeat(amount, crimeName) {
  if (S.over) return;
  S.heat = clamp(S.heat + amount, 0, 100);
  S.lastCrime = S.time;
  S.stats.crimes++;
  const newStars = starsForHeat(S.heat);
  if (newStars > S.wanted) {
    S.wanted = newStars;
    showMessage(crimeName + ' — wanted level ' + newStars + '!', 2.5);
  }
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i <= 5; i++) if (heat >= STAR_THRESHOLDS[i]) stars = i;
  return stars;
}

function policeCars() {
  return traffic.filter(c => c.kind === 'police');
}

function spawnPointNear(px, pz, dist) {
  // Pick a road node roughly `dist` away from the player.
  let best = null, bestScore = Infinity;
  for (const n of City.nodes) {
    const d = Math.hypot(n.x - px, n.z - pz);
    const score = Math.abs(d - dist) + rng.next() * 30;
    if (score < bestScore) { bestScore = score; best = n; }
  }
  return best || { x: px + dist, z: pz };
}

export function updateWanted(dt, scene) {
  if (!S.started || S.over) return;
  // Passive decay: no crime for a while and the heat cools off.
  if (S.time - S.lastCrime > 12 && S.wanted > 0) {
    S.heat = Math.max(0, S.heat - dt * 1.6);
    const stars = starsForHeat(S.heat);
    if (stars < S.wanted) {
      S.wanted = stars;
      if (stars === 0) showMessage('You lost the heat.', 2);
    }
  }
  if (S.wanted === 0) return;

  // Keep the right number of police cars on the road (timer-based, so the
  // spawn is reliable even at low frame rates).
  const wantCars = MAX_POLICE_CARS[S.wanted];
  const cars = policeCars();
  if (cars.length < wantCars) {
    carSpawnTimer -= dt;
    if (carSpawnTimer <= 0) {
      carSpawnTimer = 1.2;
      const p = spawnPointNear(S.px, S.pz, 70 + rng.range(0, 40));
      spawnPoliceCar(scene, p.x, p.z);
    }
  } else {
    carSpawnTimer = 0;
  }
  // Foot cops join from 2 stars.
  const wantCops = MAX_FOOT_COPS[S.wanted];
  if (footCops.filter(c => !c.down).length < wantCops) {
    copSpawnTimer -= dt;
    if (copSpawnTimer <= 0) {
      copSpawnTimer = 2;
      const p = spawnPointNear(S.px, S.pz, 25 + rng.range(0, 15));
      spawnFootCop(scene, p.x, p.z);
    }
  } else {
    copSpawnTimer = 0;
  }
  // Drop police cars that fell far behind.
  for (const car of [...cars]) {
    const d = Math.hypot(car.x - S.px, car.z - S.pz);
    if (d > 260) removeCar(scene, car);
  }

  // Chase: police cars steer toward the player and ram.
  for (const car of policeCars()) {
    car.sirenPhase += dt * 6;
    const dx = S.px - car.x, dz = S.pz - car.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    car.heading = angleLerp(car.heading, want, clamp(2.2 * dt, 0, 1));
    const targetSpeed = dist > 12 ? 17 + S.wanted * 1.2 : 10;
    car.speed = lerp(car.speed, targetSpeed, clamp(1.2 * dt, 0, 1));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Flash the light bar.
    if (car.mesh.userData.lights) {
      const [r, b] = car.mesh.userData.lights;
      const on = Math.sin(car.sirenPhase) > 0;
      r.material.emissiveIntensity = on ? 2 : 0.2;
      b.material.emissiveIntensity = on ? 0.2 : 2;
    }
    // Ram the player's car.
    if (dist < 3.2) {
      if (S.car) {
        S.car.speed *= 0.55;
        S.health = Math.max(0, S.health - 6 * dt);
      } else if (S.onFoot) {
        S.health = Math.max(0, S.health - 14 * dt);
      }
      if (S.health <= 0) S.wasted = true;
    }
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Clear all police (used when a mission ends or the player escapes).
export function clearPolice(scene) {
  for (const car of [...policeCars()]) removeCar(scene, car);
  for (const cop of [...footCops]) {
    scene.remove(cop.mesh);
    const i = footCops.indexOf(cop);
    if (i >= 0) footCops.splice(i, 1);
  }
  S.wanted = 0;
  S.heat = 0;
}
