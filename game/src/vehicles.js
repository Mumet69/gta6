// vehicles.js — cars: arcade physics, traffic AI, stealing.
// A car is a box body + cabin + 4 cylinder wheels. Traffic cars pick a road
// intersection and drive toward it, turning at crossings. Parked cars sit at
// the kerb waiting to be stolen (E). The player's car is the one G.playerCar
// points at.
import * as THREE from 'three';
import { G } from './state.js';
import { makeRng, clamp, angleLerp, angleDiff, dist2d, TAU } from './utils.js';
import { BLOCK, HALF, nearestRoadPoint } from './city.js';

const CAR_COLORS = [0xc23a3a, 0x3a6ac2, 0xd8b83a, 0x3a9a5a, 0x8a8a8a, 0xc27a2a, 0x5a3a8a, 0x2a9a9a, 0xe8e8e8, 0x222222];
const CAR_NAMES = ['Comet', 'Stallion', 'Bison', 'Falcon', 'Voyager', 'Raptor', 'Civic', 'Mustang', 'Courier', 'Sultan'];

export function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a1a : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.65;
  g.add(body);
  const cabinMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xffffff : 0x1a2530 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), cabinMat);
  cabin.position.set(0, 1.25, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.7, -0.2);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(0, 1.7, 0.2);
    g.add(bar2);
  }
  return g;
}

export function spawnCar(scene, rng, opts = {}) {
  const isPolice = !!opts.police;
  const color = isPolice ? 0x111111 : rng.pick(CAR_COLORS);
  const mesh = makeCarMesh(color, isPolice);
  const pos = opts.pos || { x: 0, z: 0 };
  mesh.position.set(pos.x, 0, pos.z);
  mesh.rotation.y = opts.heading ?? rng.range(0, TAU);
  scene.add(mesh);
  const car = {
    mesh,
    color,
    name: isPolice ? 'Interceptor' : rng.pick(CAR_NAMES),
    pos: mesh.position,
    heading: mesh.rotation.y,
    speed: 0,
    maxSpeed: isPolice ? 34 : rng.range(13, 20),
    accel: isPolice ? 16 : 9,
    police: isPolice,
    parked: !!opts.parked,
    target: null,
    stuck: 0,
    siren: 0,
  };
  if (!opts.parked) pickTrafficTarget(car, rng);
  return car;
}

function pickTrafficTarget(car, rng) {
  const nodes = G.nav.nodes;
  const n = nodes[Math.floor(rng.rand() * nodes.length)];
  car.target = { x: n.x, z: n.z };
}

export function spawnTraffic(scene, seed, count) {
  const rng = makeRng(seed + 77);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const n = G.nav.nodes[Math.floor(rng.rand() * G.nav.nodes.length)];
    // Park a few cars at the kerb; the rest drive.
    const parked = i < 10;
    const px = parked ? n.x + (rng.rand() < 0.5 ? 7.5 : -7.5) : n.x;
    const pz = parked ? n.z + rng.range(-14, 14) : n.z;
    const car = spawnCar(scene, rng, {
      parked,
      pos: { x: px, z: pz },
      heading: parked ? (rng.rand() < 0.5 ? 0 : Math.PI) : rng.range(0, TAU),
    });
    car.speed = parked ? 0 : rng.range(6, 14);
    cars.push(car);
  }
  return cars;
}

// Arcade car physics: accelerate/brake, steer harder at low speed, drag.
export function driveCar(car, input, dt) {
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const throttle = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
  const speedFactor = clamp(Math.abs(car.speed) / 12, 0, 1);
  car.heading += steer * (1.9 - speedFactor * 0.9) * (car.speed >= 0 ? 1 : -1) * dt * clamp(Math.abs(car.speed) / 4, 0, 1);
  car.speed += throttle * car.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // drag
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 4 * dt;
  car.speed = clamp(car.speed, -9, car.maxSpeed);
  if (Math.abs(car.speed) < 0.15 && !input.up) car.speed = 0;
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.rotation.y = car.heading;
}

// Traffic AI: drive toward the target intersection, turn at crossings.
export function updateTraffic(car, rng, dt) {
  if (car.parked) return;
  const t = car.target;
  if (!t) { pickTrafficTarget(car, rng); return; }
  const dx = t.x - car.pos.x, dz = t.z - car.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 3) { pickTrafficTarget(car, rng); return; }
  const want = Math.atan2(dx, dz);
  const diff = angleDiff(car.heading, want);
  car.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
  const targetSpeed = Math.abs(diff) > 0.6 ? car.maxSpeed * 0.45 : car.maxSpeed;
  car.speed += clamp(targetSpeed - car.speed, -8 * dt, 6 * dt);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.rotation.y = car.heading;
  // Keep traffic inside the city.
  car.pos.x = clamp(car.pos.x, -HALF * BLOCK - 8, HALF * BLOCK + 8);
  car.pos.z = clamp(car.pos.z, -HALF * BLOCK - 8, HALF * BLOCK + 8);
}

export function nearestCar(pos, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    const d = dist2d(pos.x, pos.z, car.pos.x, car.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
