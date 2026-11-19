// vehicles.js — DUSTLINE: cars. Arcade physics for the player, a road-graph
// AI for traffic, parked cars to steal, and the police cars the wanted system
// spawns. A car is {mesh, x, z, heading, speed, color, kind, ...}.

import * as THREE from '../vendor/three.module.min.js';
import { makeRng, clamp, angleLerp, angleDiff, circleHitsBox, resolveCircleBox } from './utils.js';
import { S } from './state.js';
import { City, roadCentres } from './city.js';

// Snap a heading to the direction of the nearest road: along a vertical road
// (heading 0 or PI) when the car sits on one, along a horizontal road
// (heading PI/2 or -PI/2) when it sits on one. This keeps a stolen car
// driving down a road instead of into the nearest building.
function snapHeadingToRoad(x, z, heading) {
  const centres = roadCentres();
  let dx = Infinity, dz = Infinity;
  for (const c of centres) {
    dx = Math.min(dx, Math.abs(x - c));
    dz = Math.min(dz, Math.abs(z - c));
  }
  const TAU = Math.PI * 2;
  const norm = (a) => {
    let n = a % TAU;
    if (n > Math.PI) n -= TAU;
    if (n < -Math.PI) n += TAU;
    return n;
  };
  const options = dx <= dz ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2];
  let best = options[0], bestD = Infinity;
  for (const o of options) {
    const d = Math.abs(norm(heading - o));
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

export const traffic = [];   // AI cars (kind 'traffic' | 'police' | 'parked')
export const parked = [];    // stealable parked cars

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8b93a, 0x3aa655, 0x8e44ad, 0xd8d8d8, 0x222222, 0x2eb8c2];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2733, roughness: 0.1, metalness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x888888 }));
    bar.position.set(0, 1.75, -0.2);
    g.add(bar);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.45), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 }));
    lightR.position.set(-0.3, 1.78, -0.2);
    g.add(lightR);
    const lightB = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.45), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x0000ff, emissiveIntensity: 1 }));
    lightB.position.set(0.3, 1.78, -0.2);
    g.add(lightB);
    g.userData.lights = [lightR, lightB];
  }
  return g;
}

export function addCarToScene(scene, car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  scene.add(car.mesh);
}

export function spawnTraffic(scene, count, seed) {
  const rng = makeRng(seed * 7 + 3);
  for (let i = 0; i < count; i++) {
    const node = City.nodes[Math.floor(rng.next() * City.nodes.length)];
    const car = {
      kind: 'traffic',
      x: node.x + rng.range(-2, 2), z: node.z + rng.range(-2, 2),
      heading: rng.range(0, Math.PI * 2),
      speed: 0,
      cruise: rng.range(7, 12),
      targetNode: Math.floor(rng.next() * City.nodes.length),
      color: CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)],
      stuck: 0,
      mesh: null,
    };
    car.mesh = makeCarMesh(car.color, 'traffic');
    addCarToScene(scene, car);
    traffic.push(car);
  }
}

export function spawnParked(scene, seed) {
  const rng = makeRng(seed * 13 + 5);
  const spots = [
    { x: -115, z: 30 }, { x: 23, z: -100 }, { x: 69, z: 120 },
    { x: -69, z: -60 }, { x: 115, z: -20 }, { x: -23, z: 80 },
    { x: 161, z: 60 }, { x: -161, z: -100 },
  ];
  for (const s of spots) {
    if (rng.chance(0.25)) continue;
    const car = {
      kind: 'parked',
      x: s.x + rng.range(-2, 2), z: s.z + rng.range(-2, 2),
      // Parked along the road (axis-aligned) so a stolen car drives straight.
      heading: rng.chance(0.5) ? 0 : Math.PI,
      speed: 0,
      color: CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)],
      mesh: null,
    };
    car.mesh = makeCarMesh(car.color, 'parked');
    addCarToScene(scene, car);
    parked.push(car);
  }
}

export function spawnPoliceCar(scene, x, z) {
  const car = {
    kind: 'police',
    x, z,
    heading: 0,
    speed: 0,
    cruise: 16,
    color: 0xeeeeee,
    mesh: null,
    sirenPhase: 0,
  };
  car.mesh = makeCarMesh(0xf2f2f2, 'police');
  addCarToScene(scene, car);
  traffic.push(car);
  return car;
}

function collideCar(car, radius) {
  for (const b of City.colliders) {
    if (circleHitsBox(car.x, car.z, radius, b)) {
      const fixed = resolveCircleBox(car.x, car.z, radius, b);
      car.x = fixed.x; car.z = fixed.z;
      car.speed *= 0.4;
    }
  }
}

// Player driving: W/S accelerate/brake, A/D steer, Space handbrake.
export function updatePlayerCar(dt, input) {
  const car = S.car;
  if (!car) return;
  const maxSpeed = 34;
  const accel = input.up ? 22 : 0;
  const brake = input.down ? 30 : 0;
  if (input.up) car.speed = Math.min(car.speed + accel * dt, maxSpeed);
  else if (input.down) car.speed = Math.max(car.speed - brake * dt, -9);
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerAuthority = clamp(Math.abs(car.speed) / 10, 0, 1);
  car.heading += steer * 1.9 * steerAuthority * dt * Math.sign(car.speed || 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // World bounds: the desert is wide, the city is the playground.
  const m = 560;
  car.x = clamp(car.x, -m, m);
  car.z = clamp(car.z, -m, m);
  collideCar(car, 1.4);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Slight body roll on steering for feel.
  car.mesh.rotation.z = -steer * 0.04 * steerAuthority;
  S.px = car.x; S.pz = car.z;
  S.heading = car.heading;
  S.stats.distance += Math.abs(car.speed) * dt;
}

function pickNextNode(car, rng) {
  const near = City.nodes.reduce((best, n, i) => {
    const d = (n.x - car.x) ** 2 + (n.z - car.z) ** 2;
    return d < best.d ? { i, d } : best;
  }, { i: 0, d: Infinity });
  const options = City.edges.get(near.i) || [];
  if (options.length) return options[Math.floor(rng.next() * options.length)];
  return near.i;
}

export function updateTraffic(dt, scene, rng) {
  for (const car of traffic) {
    if (car.kind === 'police') continue; // police are driven by wanted.js
    const target = City.nodes[car.targetNode];
    if (!target) continue;
    const dx = target.x - car.x, dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      car.targetNode = pickNextNode(car, rng);
      continue;
    }
    const want = Math.atan2(dx, dz);
    car.heading = angleLerp(car.heading, want, clamp(3 * dt, 0, 1));
    car.speed = lerp(car.speed, car.cruise, clamp(1.5 * dt, 0, 1));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    collideCar(car, 1.4);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

// Find the nearest stealable car within reach of the player.
export function nearestStealable(px, pz, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of [...parked, ...traffic]) {
    if (car.kind === 'police') continue;
    if (car === S.car) continue;
    const d = Math.hypot(car.x - px, car.z - pz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Steal (or enter) a car: removes it from parked/traffic and makes it the player's.
// The heading snaps to the nearest road direction so the car drives straight.
export function enterCar(car) {
  const pi = parked.indexOf(car);
  if (pi >= 0) parked.splice(pi, 1);
  const ti = traffic.indexOf(car);
  if (ti >= 0) traffic.splice(ti, 1);
  car.heading = snapHeadingToRoad(car.x, car.z, car.heading);
  car.speed = 0;
  S.car = car;
  S.onFoot = false;
  S.stats.carsStolen++;
  return car;
}

// Leave the car where it stands; it becomes a parked car again.
export function exitCar(scene) {
  const car = S.car;
  if (!car) return;
  car.speed = 0;
  car.kind = 'parked';
  parked.push(car);
  S.car = null;
  S.onFoot = true;
  // Step out to the side of the car.
  S.px = car.x + Math.cos(car.heading) * 2.2;
  S.pz = car.z - Math.sin(car.heading) * 2.2;
  S.heading = car.heading;
}

export function removeCar(scene, car) {
  scene.remove(car.mesh);
  const ti = traffic.indexOf(car);
  if (ti >= 0) traffic.splice(ti, 1);
  const pi = parked.indexOf(car);
  if (pi >= 0) parked.splice(pi, 1);
  if (S.car === car) { S.car = null; S.onFoot = true; }
}

// lerp helper (used by updateTraffic).
function lerp(a, b, t) { return a + (b - a) * t; }
