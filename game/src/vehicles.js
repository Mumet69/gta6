// vehicles.js — cars of Solmar City: mesh factory, arcade driving physics,
// traffic that cruises the road grid, and police pursuit cars.
// All cars share one simple physics model: heading + speed, AABB building
// collision, circle-vs-circle car collision, and visual wheel spin/steer.
import * as THREE from 'three';
import { clamp, angleLerp, angleDiff, dist2D, resolveAABBCollisions, pick } from './utils.js';

const CAR_COLORS = [0xd84a4a, 0x4a7ad8, 0xe8c860, 0x3aa86a, 0xd8d8d8, 0x8a4ad8, 0x2a2a30, 0xe88a2a];
const CAR_NAMES = ['Vento', 'Cometa', 'Brisa', 'Toro', 'Falco', 'Marlin', 'Duna', 'Corsa'];

// makeCarMesh builds one car from boxes: body, cabin, wheels, lights.
// police=true adds a white body and a red/blue light bar.
export function makeCarMesh(color, police = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0f0 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1a2430 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), cabinMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x16161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x887733 });
  for (const sx of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    hl.position.set(sx, 0.6, 2.22);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xd82020, emissive: 0x551111 }));
    tl.position.set(sx, 0.6, -2.22);
    g.add(tl);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2244aa, emissive: 0x1133cc }));
    bar.position.set(0, 1.45, -0.2);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xdd2222, emissive: 0xcc1111 }));
    bar2.position.set(-0.6, 1.45, -0.2);
    g.add(bar2);
  }
  g.userData.wheels = wheels;
  return g;
}

// Car — one drivable / AI vehicle. pos is a THREE.Vector3 (y stays 0).
export class Car {
  constructor(scene, x, z, heading, color, police = false) {
    this.mesh = makeCarMesh(color, police);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.color = color;
    this.police = police;
    this.name = police ? 'PD Interceptor' : pickCarName(color);
    this.health = 100;
    this.isPlayer = false;
    this.isTraffic = false;
    this.driver = null; // pedestrian driving this car (traffic)
    this.stuckTimer = 0;
  }

  // arcade drive: throttle -1..1, steer -1..1, dt seconds.
  drive(throttle, steerInput, dt, colliders, otherCars) {
    const maxSpeed = this.police ? 34 : 30;
    const accel = throttle > 0 ? 16 : 22;
    this.speed += throttle * accel * dt;
    if (throttle === 0) this.speed = dampToZero(this.speed, 6 * dt);
    this.speed = clamp(this.speed, -10, maxSpeed);
    const steerTarget = steerInput * 0.55 * clamp(Math.abs(this.speed) / 8, 0.25, 1);
    this.steer = angleLerp(this.steer, steerTarget, Math.min(1, dt * 6));
    if (Math.abs(this.speed) > 0.3) {
      this.heading += (this.steer * this.speed * dt) / 2.6 * (this.speed >= 0 ? 1 : -1);
    }
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const res = resolveAABBCollisions(nx, nz, 1.6, colliders);
    if (res.hit && Math.abs(this.speed) > 4) this.onCrash(Math.abs(this.speed));
    if (res.hit) this.speed *= 0.4;
    this.pos.x = clamp(res.x, -196, 196);
    this.pos.z = clamp(res.z, -196, 196);
    // car-vs-car: push apart, trade a little speed
    for (const o of otherCars) {
      if (o === this) continue;
      const d = dist2D(this.pos.x, this.pos.z, o.pos.x, o.pos.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const ux = (this.pos.x - o.pos.x) / d, uz = (this.pos.z - o.pos.z) / d;
        this.pos.x += ux * push; this.pos.z += uz * push;
        o.pos.x -= ux * push; o.pos.z -= uz * push;
        const s = this.speed; this.speed = o.speed * 0.5; o.speed = s * 0.5;
        if (Math.abs(s) > 6) this.onCrash(Math.abs(s));
      }
    }
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels;
    for (let i = 0; i < wheels.length; i++) {
      wheels[i].rotation.x += this.speed * dt / 0.38;
      if (i < 2) wheels[i].rotation.y = this.steer * 0.9;
    }
  }

  onCrash(speed) { /* overridden by main.js via hook */ }
}

function dampToZero(v, amount) {
  if (v > 0) return Math.max(0, v - amount);
  if (v < 0) return Math.min(0, v + amount);
  return 0;
}

function pickCarName(color) {
  return CAR_NAMES[CAR_COLORS.indexOf(color) % CAR_NAMES.length] || 'Vento';
}
export { CAR_COLORS };


// TrafficManager — ambient cars that cruise the road grid. Each car owns a
// lane (a road line + a direction along it); at intersections it may turn
// onto the crossing road. Cars slow for the car ahead of them.
export class TrafficManager {
  constructor(scene, rng, colliders, roadLines) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.roadLines = roadLines;
    this.cars = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i++) this.spawnOne();
  }

  spawnOne() {
    const rng = this.rng;
    const line = this.roadLines[Math.floor(rng() * this.roadLines.length)];
    const horiz = rng() < 0.5;
    const dir = rng() < 0.5 ? 1 : -1;
    const along = (rng() * 2 - 1) * 170;
    const x = horiz ? along : line + (dir > 0 ? 3 : -3);
    const z = horiz ? line + (dir > 0 ? 3 : -3) : along;
    const heading = horiz ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const car = new Car(this.scene, x, z, heading, color, false);
    car.isTraffic = true;
    car.speed = 8 + rng() * 4;
    car.lane = { horiz, line, dir };
    car.cruise = car.speed;
    this.cars.push(car);
    return car;
  }

  update(dt, playerPos, allCars) {
    for (const car of this.cars) {
      if (car.isPlayer) continue;
      // slow for a car ahead in the same lane
      let target = car.cruise;
      for (const o of allCars) {
        if (o === car) continue;
        const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
        const ahead = car.lane.horiz ? dx * car.lane.dir : dz * car.lane.dir;
        const side = car.lane.horiz ? Math.abs(dz) : Math.abs(dx);
        if (ahead > 0 && ahead < 12 && side < 3) { target = 0; break; }
      }
      // flee the player a little if the player is ramming through
      const pd = dist2D(car.pos.x, car.pos.z, playerPos.x, playerPos.z);
      if (pd < 6 && car.speed > 2) target = Math.max(target, car.cruise);
      car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
      // advance along the lane
      const step = car.speed * dt;
      if (car.lane.horiz) car.pos.x += car.lane.dir * step;
      else car.pos.z += car.lane.dir * step;
      // at an intersection, maybe turn onto the crossing road
      const along = car.lane.horiz ? car.pos.x : car.pos.z;
      const nearLine = Math.abs(((along % 44) + 44) % 44 - 22) < 1.2;
      if (nearLine && this.rng() < 0.02) {
        const cross = this.roadLines[Math.floor(this.rng() * this.roadLines.length)];
        const ndir = this.rng() < 0.5 ? 1 : -1;
        const wasHoriz = car.lane.horiz;
        car.lane = { horiz: !wasHoriz, line: cross, dir: ndir };
        if (wasHoriz) { car.pos.z = cross + (ndir > 0 ? 3 : -3); car.heading = ndir > 0 ? 0 : Math.PI; }
        else { car.pos.x = cross + (ndir > 0 ? 3 : -3); car.heading = ndir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      }
      // wrap around the city edge
      if (car.pos.x > 196) car.pos.x = -196;
      if (car.pos.x < -196) car.pos.x = 196;
      if (car.pos.z > 196) car.pos.z = -196;
      if (car.pos.z < -196) car.pos.z = 196;
      car.mesh.rotation.y = car.heading;
      const wheels = car.mesh.userData.wheels;
      for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x += car.speed * dt / 0.38;
    }
  }
}

// PoliceManager — pursuit cars that spawn at the city edge and ram/chase
// the player. Count scales with the wanted level.
export class PoliceManager {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.cars = [];
  }

  wantCount(wanted) {
    return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : 4;
  }

  update(dt, playerPos, playerCar, wanted, allCars) {
    const want = this.wantCount(wanted);
    while (this.cars.length < want) {
      const a = this.rng() * Math.PI * 2;
      const x = clamp(playerPos.x + Math.sin(a) * 90, -190, 190);
      const z = clamp(playerPos.z + Math.cos(a) * 90, -190, 190);
      const car = new Car(this.scene, x, z, 0, 0xf0f0f0, true);
      this.cars.push(car);
      allCars.push(car);
    }
    while (this.cars.length > want) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
      const idx = allCars.indexOf(car);
      if (idx >= 0) allCars.splice(idx, 1);
    }
    for (const car of this.cars) {
      // pursuit steering: aim at the player, with a little wobble
      const wantHeading = Math.atan2(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
      const dh = angleDiff(car.heading, wantHeading);
      const steer = clamp(dh * 1.6, -1, 1);
      const dist = dist2D(car.pos.x, car.pos.z, playerPos.x, playerPos.z);
      const throttle = dist > 4 ? 1 : 0.3;
      car.drive(throttle, steer, dt, this.colliders, allCars);
      // ramming the player's car damages it; touching the player on foot busts
      if (playerCar && dist < 3.2 && Math.abs(car.speed) > 5) {
        playerCar.health -= 7 * dt;
        car.speed *= 0.5;
      }
    }
  }
}
