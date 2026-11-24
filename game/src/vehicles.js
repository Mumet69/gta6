// vehicles.js — car factory, traffic AI that follows the road grid, police cars.
import { clamp, pick, rand } from './util.js';

export const CAR_MODELS = [
  { name: 'VELOCE GT', color: 0xd92038, top: 46, accel: 22, grip: 2.6 },
  { name: 'CORTEZ SEDAN', color: 0x2a6f9e, top: 34, accel: 16, grip: 2.2 },
  { name: 'PALM TAXI', color: 0xffc93c, top: 32, accel: 15, grip: 2.1 },
  { name: 'SURF VAN', color: 0x3fae8a, top: 28, accel: 12, grip: 1.9 },
  { name: 'NEON COUPE', color: 0xb45cff, top: 42, accel: 20, grip: 2.5 },
  { name: 'DUST PICKUP', color: 0x8a5a3b, top: 30, accel: 14, grip: 2.0 },
];
export const POLICE_MODEL = { name: 'VBPD CRUISER', color: 0xf2f2f2, top: 40, accel: 20, grip: 2.7 };

export function buildCar(model, police = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: model.color, roughness: 0.3, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.1, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.25); cabin.castShadow = true; g.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.5), paint);
  nose.position.set(0, 0.45, 2.35); g.add(nose);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  g.userData.wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z);
    g.add(w); g.userData.wheels.push(w);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c4, emissive: 0xffedb0, emissiveIntensity: 1.2 });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    h.position.set(x, 0.6, 2.62); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x880000, emissive: 0xff2222, emissiveIntensity: 0.9 }));
    t.position.set(x, 0.6, -2.22); g.add(t);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.5, -0.25); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    red.position.set(-0.3, 1.5, -0.25); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 2 }));
    blue.position.set(0.3, 1.5, -0.25); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshStandardMaterial({ color: 0x1a4fd6, roughness: 0.4 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  g.userData.model = model;
  return g;
}

// --- traffic: cars that cruise the grid, stop at nothing, turn at intersections ---
export function createTraffic(scene, nodes, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = pick(CAR_MODELS);
    const mesh = buildCar(model);
    const node = pick(nodes);
    const dir = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    mesh.position.set(node.x + rand(-4, 4), 0, node.z + rand(-4, 4));
    mesh.rotation.y = dir;
    scene.add(mesh);
    cars.push({
      mesh, model, speed: rand(6, 11), dir, node,
      target: null, color: model.color, kind: 'traffic', userData: {},
    });
    pickNextTarget(cars[cars.length - 1], nodes);
  }
  return cars;
}
function pickNextTarget(car, nodes) {
  const step = 42;
  const dx = Math.round(Math.sin(car.dir)), dz = Math.round(Math.cos(car.dir));
  let nx = car.node.x + dx * step, nz = car.node.z + dz * step;
  if (Math.abs(nx) > 126 || Math.abs(nz) > 126 || Math.random() < 0.35) {
    // turn at the intersection: pick a new heading that stays in the city
    const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((d) => {
      const tx = car.node.x + Math.round(Math.sin(d)) * step;
      const tz = car.node.z + Math.round(Math.cos(d)) * step;
      return Math.abs(tx) <= 126 && Math.abs(tz) <= 126;
    });
    car.dir = pick(options);
    nx = car.node.x + Math.round(Math.sin(car.dir)) * step;
    nz = car.node.z + Math.round(Math.cos(car.dir)) * step;
  }
  car.target = { x: nx, z: nz };
}
export function updateTraffic(cars, nodes, dt, playerPos, avoid) {
  for (const car of cars) {
    if (car.kind === 'parked') continue; // parked cars stay put until stolen
    if (!car.target) pickNextTarget(car, nodes);
    const dx = car.target.x - car.mesh.position.x;
    const dz = car.target.z - car.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) {
      car.node = { x: car.target.x, z: car.target.z };
      pickNextTarget(car, nodes);
      continue;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - car.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.mesh.rotation.y += clamp(diff, -2.2 * dt, 2.2 * dt);
    // slow down for the player / a car ahead
    let targetSpeed = car.speed;
    if (playerPos && Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z) < 7) targetSpeed = 0;
    for (const other of avoid) {
      if (other === car) continue;
      if (Math.hypot(car.mesh.position.x - other.mesh.position.x, car.mesh.position.z - other.mesh.position.z) < 6) {
        targetSpeed = 0; break;
      }
    }
    const cur = car.userData.v || 0;
    car.userData.v = lerp(cur, targetSpeed, dt * 1.5);
    car.mesh.position.x += Math.sin(car.mesh.rotation.y) * car.userData.v * dt;
    car.mesh.position.z += Math.cos(car.mesh.rotation.y) * car.userData.v * dt;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.userData.v * dt * 2;
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }

// --- police cruisers: spawn, chase, ram, flash ---
export function spawnPoliceCar(scene, x, z) {
  const mesh = buildCar(POLICE_MODEL, true);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, model: POLICE_MODEL, speed: 0, kind: 'police', flash: Math.random() * 10 };
}
export function updatePoliceCar(car, target, dt, colliders) {
  const dx = target.x - car.mesh.position.x;
  const dz = target.z - car.mesh.position.z;
  const d = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - car.mesh.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.mesh.rotation.y += clamp(diff, -3.2 * dt, 3.2 * dt);
  const goal = d > 60 ? 38 : d > 12 ? 30 : 16;
  car.speed = lerp(car.speed, goal, dt * 0.8);
  car.mesh.position.x += Math.sin(car.mesh.rotation.y) * car.speed * dt;
  car.mesh.position.z += Math.cos(car.mesh.rotation.y) * car.speed * dt;
  // keep out of buildings
  for (const c of colliders) {
    const p = car.mesh.position;
    if (p.x > c.x0 - 1.5 && p.x < c.x1 + 1.5 && p.z > c.z0 - 1.5 && p.z < c.z1 + 1.5) {
      p.x -= Math.sin(car.mesh.rotation.y) * car.speed * dt * 2;
      p.z -= Math.cos(car.mesh.rotation.y) * car.speed * dt * 2;
      car.speed *= 0.5;
    }
  }
  car.flash += dt * 9;
  const on = Math.sin(car.flash) > 0;
  if (car.mesh.userData.lightRed) {
    car.mesh.userData.lightRed.material.emissiveIntensity = on ? 3 : 0.2;
    car.mesh.userData.lightBlue.material.emissiveIntensity = on ? 0.2 : 3;
  }
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  return d;
}
