// wanted.js — the wanted system: heat from crimes, stars, police response.
// Crimes add heat; heat maps to 0–5 stars. Police cars spawn up to a cap that
// grows with the wanted level and chase the player; foot cops join at 2+
// stars. Heat decays when the player lays low, and stars fall with it.
import { G } from './state.js';
import { clamp } from './utils.js';
import { spawnCar } from './vehicles.js';
import { spawnCop } from './people.js';
import { makeRng } from './utils.js';

const HEAT_PER_STAR = 20;
const POLICE_CAP = [0, 1, 2, 3, 4, 5];

export function addHeat(n, reason) {
  G.heat = clamp(G.heat + n, 0, 100);
  const stars = Math.min(5, Math.floor(G.heat / HEAT_PER_STAR));
  if (stars > G.wanted) {
    G.wanted = stars;
    if (G.onWantedUp) G.onWantedUp(stars, reason);
  }
}

export function setWanted(stars) {
  G.wanted = clamp(stars, 0, 5);
  G.heat = G.wanted * HEAT_PER_STAR + 5;
}

export function wantedLabel() {
  return '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
}

export function updateWanted(dt, rng) {
  // Decay: laying low (no new crimes) cools the heat down.
  if (G.heat > 0) {
    const hidden = G.playerCar ? 0.55 : 0.8; // harder to lose them in a car
    G.heat = Math.max(0, G.heat - dt * hidden * 1.4);
    const stars = Math.min(5, Math.floor(G.heat / HEAT_PER_STAR));
    if (stars < G.wanted) G.wanted = stars;
  }
  // Police cars: keep the chase force at the cap for the current stars.
  const cap = POLICE_CAP[G.wanted];
  while (G.policeCars.length < cap) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = 55 + rng.range(0, 30);
    const px = G.player.pos.x + Math.sin(angle) * dist;
    const pz = G.player.pos.z + Math.cos(angle) * dist;
    const car = spawnCar(G.scene, rng, { police: true, pos: { x: px, z: pz } });
    car.speed = 12;
    G.policeCars.push(car);
    G.cars.push(car);
  }
  // Foot cops join the hunt at 2+ stars (max 3).
  if (G.wanted >= 2 && G.cops.length < Math.min(3, G.wanted - 1)) {
    const angle = rng.range(0, Math.PI * 2);
    const cop = spawnCop(G.scene, {
      x: G.player.pos.x + Math.sin(angle) * 18,
      z: G.player.pos.z + Math.cos(angle) * 18,
    });
    G.cops.push(cop);
  }
  // When the wanted level falls, excess police give up and drive off.
  while (G.policeCars.length > cap) {
    const car = G.policeCars.pop();
    const ci = G.cars.indexOf(car);
    if (ci >= 0) G.cars.splice(ci, 1);
    G.scene.remove(car.mesh);
  }
  if (G.wanted < 2) {
    while (G.cops.length > 0) {
      const cop = G.cops.pop();
      G.scene.remove(cop.mesh);
    }
  }
}

// Police car chase: steer toward the player, ram speed, siren flash.
export function updatePoliceChase(dt) {
  for (const car of G.policeCars) {
    const dx = G.player.pos.x - car.pos.x;
    const dz = G.player.pos.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
    const targetSpeed = d > 30 ? car.maxSpeed : car.maxSpeed * 0.8;
    car.speed += clamp(targetSpeed - car.speed, -10 * dt, 12 * dt);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    car.siren += dt;
    // Ram the player: a hard hit hurts and adds a jolt.
    if (d < 3.2 && G.player.inCar) {
      if (G.onRam) G.onRam(car);
    } else if (d < 2.2 && !G.player.inCar) {
      if (G.onRam) G.onRam(car);
    }
  }
}
