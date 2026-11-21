// vehicles.js — cars for Velvet Bay: mesh factory, arcade driving physics
// for the player car, and the traffic system (commuters + police pursuit).

import * as THREE from 'three';
import { clamp, rand, choice, angleDiff, angleLerp, dist2d } from './utils.js';
import { CITY } from './city.js';

const TRAFFIC_COLORS = [0xc23b2e, 0x2e5fc2, 0xd8b13a, 0x3a9a4a, 0xd86a1e, 0x7a4a9a, 0xe8e8e8, 0x9aa0a6, 0x2a9a9a, 0x8a2f4d];

// Seven cars, seven personalities: the sedan is the everyday steal, the
// sportscar is the fastest thing on the bay, the taxi pays its own way in
// traffic, and the truck is slow, heavy and hard to push around. New in v3:
// a muscle car with a hood scoop and a thirst for straight lines, a boxy
// delivery van that shrugs off bumps, and a long limo that turns like a boat.
export const CAR_MODELS = {
  sedan: { topSpeed: 36, accel: 15, label: 'Sedan' },
  sport: { topSpeed: 46, accel: 20, label: 'Sportscar' },
  taxi: { topSpeed: 34, accel: 14, label: 'Taxi' },
  truck: { topSpeed: 26, accel: 10, label: 'Truck' },
  muscle: { topSpeed: 40, accel: 18, label: 'Muscle car' },
  van: { topSpeed: 28, accel: 11, label: 'Delivery van' },
  limo: { topSpeed: 38, accel: 13, label: 'Limo' },
};

// Garage upgrades, bought at Cash's Garage (key G in the car). Engine tiers
// add top speed, armour softens crash slowdown, a nitro tank boosts the
// Shift boost, and paint is paint — the bay notices a fresh coat.
export const GARAGE_UPGRADES = {
  engine1: { price: 800, label: 'Engine tune +4 top speed' },
  engine2: { price: 1800, label: 'Race engine +8 top speed' },
  armor: { price: 600, label: 'Armour plating — softer crashes' },
  nitro: { price: 900, label: 'Nitro tank — bigger Shift boost' },
  paint: { price: 150, label: 'Fresh paint job' },
};

export function upgradeCost(key, state) {
  const up = GARAGE_UPGRADES[key];
  if (!up) return 0;
  if (key === 'engine2' && (state.garage.engine || 0) < 1) return -1; // needs tune first
  if (key === 'engine1' && (state.garage.engine || 0) >= 1) return -1;
  if (key === 'engine2' && (state.garage.engine || 0) >= 2) return -1;
  if (key === 'armor' && (state.garage.armor || 0) >= 1) return -1;
  if (key === 'nitro' && (state.garage.nitro || 0) >= 1) return -1;
  return up.price;
}

export function applyGarageUpgrade(car, key, state) {
  const cost = upgradeCost(key, state);
  if (cost <= 0 || state.money < cost) return false;
  state.money -= cost;
  if (key === 'engine1') { state.garage.engine = 1; car.topSpeed += 4; car.accel += 2; }
  if (key === 'engine2') { state.garage.engine = 2; car.topSpeed += 4; car.accel += 2; }
  if (key === 'armor') { state.garage.armor = 1; car.armor = true; }
  if (key === 'nitro') { state.garage.nitro = 1; car.nitroBoost = 14; }
  if (key === 'paint') {
    state.garage.paint = (state.garage.paint + 0x2a4a7a) % 0xffffff;
    paintCar(car, state.garage.paint);
  }
  return true;
}

// Recolour only the body-coloured parts (the meshes whose material matches
// the car's old colour), so a paint job never dyes the windows, tyres or
// headlights along with the bodywork.
export function paintCar(car, color) {
  const old = car.color;
  car.color = color;
  car.mesh.children.forEach((m) => {
    if (m.material && m.material.color && m.material.color.getHex() === old) {
      m.material.color.setHex(color);
    }
  });
}

export function makeCarMesh(color, kind = 'traffic', model = 'sedan') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x15181c });
  const isTruck = model === 'truck';
  const isSport = model === 'sport';
  const body = new THREE.Mesh(new THREE.BoxGeometry(isTruck ? 5.2 : 4.4, isTruck ? 1.5 : 1.0, 2.0), bodyMat);
  body.position.y = isTruck ? 1.1 : isSport ? 0.62 : 0.75;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.9), bodyMat);
  nose.position.set(2.4, isTruck ? 0.9 : 0.55, 0);
  g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(isTruck ? 1.6 : 2.1, isTruck ? 1.1 : 0.85, 1.75), darkMat);
  cabin.position.set(isTruck ? 1.2 : -0.3, isTruck ? 2.3 : 1.55, 0);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.7), bodyMat);
  roof.position.set(-0.3, isSport ? 1.85 : 2.0, 0);
  g.add(roof);
  // Sportscar spoiler; taxi roof sign; truck cargo box.
  if (isSport) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 1.9), darkMat);
    wing.position.set(-2.2, 1.25, 0);
    g.add(wing);
  }
  if (model === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x664400 }));
    sign.position.set(-0.3, 2.2, 0);
    g.add(sign);
  }
  if (isTruck) {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.1),
      new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
    cargo.position.set(-1.2, 1.9, 0);
    g.add(cargo);
  }
  // Muscle car: a long hood scoop and fat rear tyres read. Limo: a stretched
  // body with a divider window. Van: a tall box body with a sliding door.
  if (model === 'muscle') {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.9), darkMat);
    scoop.position.set(1.2, 1.25, 0);
    g.add(scoop);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x14181c }));
    stripe.position.set(0, 1.18, 0);
    g.add(stripe);
  }
  if (model === 'limo') {
    const stretch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.9), bodyMat);
    stretch.position.set(-0.6, 0.72, 0);
    g.add(stretch);
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 1.7), darkMat);
    divider.position.set(-0.6, 1.5, 0);
    g.add(divider);
  }
  if (model === 'van') {
    const boxBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 2.05),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    boxBody.position.set(-0.8, 1.7, 0);
    g.add(boxBody);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xaaa044 });
  for (const hz of [0.6, -0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.4), hl);
    h.position.set(2.86, 0.7, hz);
    g.add(h);
  }
  const tl = new THREE.MeshLambertMaterial({ color: 0xff2a22, emissive: 0x881111 });
  for (const hz of [0.6, -0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.4), tl);
    t.position.set(-2.26, 0.7, hz);
    g.add(t);
  }
  let lightBar = null;
  if (kind === 'police') {
    const red = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 });
    const blue = new THREE.MeshLambertMaterial({ color: 0x2222ff, emissive: 0x0000ff, emissiveIntensity: 1 });
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.7), red);
    r.position.set(-0.3, 2.15, 0.45);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.7), blue);
    b.position.set(-0.3, 2.15, -0.45);
    g.add(r); g.add(b);
    lightBar = { red, blue, phase: 0 };
  }
  g.userData = { wheels, lightBar, kind, model };
  return g;
}

export function makeCar(color, kind, x, z, heading, model = 'sedan') {
  const spec = CAR_MODELS[model] || CAR_MODELS.sedan;
  return {
    kind,
    model,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    mesh: makeCarMesh(color, kind, model),
    x, z, heading,
    speed: 0,
    steer: 0,
    color,
    stolen: false,
    routeTarget: null,
    stuck: 0,
    siren: kind === 'police',
    removeMe: false,
  };
}

// Arcade driving for the player car. Returns { crashed, hitPed } flags.
export function drivePlayerCar(car, input, dt, city, trafficCars, peds, onCrash) {
  const mv = input.moveVector();
  const nitro = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const handbrake = input.isDown('Space');
  // A nitro tank from the garage doubles the Shift boost; armour halves the
  // speed lost when a crash clips a wall (handled where res.hit lands).
  const boost = nitro ? (car.nitroBoost || 8) : 0;
  const maxSpeed = (car.topSpeed || 36) + boost;
  const accel = car.accel || 15;
  if (mv.y > 0) car.speed += (nitro ? accel + 5 : accel) * dt;
  else if (mv.y < 0) car.speed -= car.speed > 0.5 ? 26 * dt : 10 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
  car.speed = clamp(car.speed, -12, maxSpeed);
  const steerTarget = -mv.x * (handbrake ? 1.5 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const spd = Math.abs(car.speed);
  const grip = handbrake ? 0.35 : 1;
  car.heading += car.steer * (car.speed / 8) * dt * 1.9 * grip * (car.speed >= 0 ? 1 : -1);
  let nx = car.x + Math.sin(car.heading) * car.speed * dt;
  let nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Stay out of the water and the far docks.
  if (nz > CITY.waterZ - 3) { nz = CITY.waterZ - 3; car.speed *= 0.6; }
  if (nx > CITY.docksX + 38) { nx = CITY.docksX + 38; car.speed *= 0.6; }
  nx = clamp(nx, -CITY.half - 20, CITY.half + 45);
  nz = clamp(nz, -CITY.half - 20, CITY.waterZ - 3);
  const res = city.collideCircle(nx, nz, 2.3);
  if (res.hit && spd > 4) {
    car.speed *= car.armor ? 0.7 : 0.45;
    if (onCrash) onCrash(Math.min(1, spd / 30) * (car.armor ? 0.6 : 1));
  }
  car.x = res.x; car.z = res.z;
  // Bump into traffic cars.
  for (const other of trafficCars) {
    if (other === car || other.removeMe) continue;
    const d = dist2d(car.x, car.z, other.x, other.z);
    if (d < 4.6 && d > 0.01) {
      const push = (4.6 - d) / 2;
      const ux = (car.x - other.x) / d, uz = (car.z - other.z) / d;
      car.x += ux * push; car.z += uz * push;
      other.x -= ux * push; other.z -= uz * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 3 && onCrash) onCrash(Math.min(1, rel / 25));
      other.speed *= 0.6;
      car.speed *= 0.85;
    }
  }
  // Hit pedestrians.
  let hitPed = null;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    if (dist2d(car.x, car.z, ped.x, ped.z) < 2.4 && spd > 3) {
      hitPed = ped;
      ped.state = 'down';
      ped.downTimer = 6;
      ped.vx = Math.sin(car.heading) * 8;
      ped.vz = Math.cos(car.heading) * 8;
    }
  }
  // Mesh pose.
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const tilt = clamp(-car.steer * spd * 0.006, -0.09, 0.09);
  car.mesh.rotation.z = tilt;
  car.mesh.rotation.x = clamp(-(car.speed - (car.prevSpeed || 0)) * 0.02, -0.05, 0.05);
  car.prevSpeed = car.speed;
  for (const w of car.mesh.userData.wheels) w.rotation.y = car.steer * 0.4;
  return { hitPed, crashed: res.hit && spd > 4 };
}

export class TrafficSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
  }

  spawnInitial(n) {
    for (let i = 0; i < n; i++) this.spawnTraffic();
  }

  spawnTraffic() {
    const p = this.city.randomRoadPoint(Math.random);
    const alongX = Math.abs(p.x - Math.round(p.x / CITY.pitch) * CITY.pitch) < 1;
    const heading = alongX ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    // Traffic is a mix: mostly sedans, with taxis, trucks, the odd sportscar
    // and, since v3, muscle cars, vans and the occasional limo cruising the Strip.
    const roll = Math.random();
    const model = roll < 0.13 ? 'taxi' : roll < 0.24 ? 'truck' : roll < 0.33 ? 'sport'
      : roll < 0.43 ? 'muscle' : roll < 0.52 ? 'van' : roll < 0.57 ? 'limo' : 'sedan';
    const color = model === 'taxi' ? 0xffd34d : choice(TRAFFIC_COLORS);
    const car = makeCar(color, 'traffic', p.x, p.z, heading, model);
    car.speed = rand(7, 12);
    car.mesh.position.set(p.x, 0, p.z);
    car.mesh.rotation.y = heading;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  // A parked prize car for a mission (the gold sportscar on the Strip).
  spawnParked(color, x, z, heading, model = 'sport') {
    const car = makeCar(color, 'traffic', x, z, heading, model);
    car.speed = 0;
    car.parked = true;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  spawnPolice(x, z) {
    const car = makeCar(0x14181c, 'police', x, z, 0);
    car.speed = 0;
    car.mesh.position.set(x, 0, z);
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  removeCar(car) {
    car.removeMe = true;
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
  }

  nearestCar(x, z, maxDist, exclude = null) {
    let best = null, bestD = maxDist;
    for (const c of this.cars) {
      if (c === exclude || c.removeMe) continue;
      const d = dist2d(x, z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  count(kind) {
    return this.cars.filter((c) => !kind || c.kind === kind).length;
  }

  // Traffic AI: follow the road grid, turn at intersections, slow for the
  // car ahead. Police cars instead pursue a target position.
  update(dt, playerPos, pursuitTarget) {
    for (const car of this.cars) {
      if (car.removeMe) continue;
      if (car.isPlayer || car.parked) continue;
      if (car.kind === 'police' && pursuitTarget) {
        this._pursue(car, pursuitTarget, dt);
        continue;
      }
      if (car.kind === 'police') {
        car.speed = Math.max(0, car.speed - 10 * dt);
        continue;
      }
      // Pick a route target: the next intersection along the current heading.
      if (!car.routeTarget) {
        car.routeTarget = this._nextIntersection(car);
      }
      const t = car.routeTarget;
      const d = dist2d(car.x, car.z, t.x, t.z);
      if (d < 4) {
        car.routeTarget = this._nextIntersection(car);
      }
      const wantHeading = Math.atan2(t.x - car.x, t.z - car.z);
      car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * 2.2));
      // Slow for the car ahead.
      let targetSpeed = rand(7, 12);
      const ahead = this._carAhead(car, 13);
      if (ahead) targetSpeed = Math.min(targetSpeed, ahead.speed * 0.7);
      if (playerPos && dist2d(car.x, car.z, playerPos.x, playerPos.z) < 10) {
        const pd = Math.atan2(playerPos.x - car.x, playerPos.z - car.z);
        if (Math.abs(angleDiff(car.heading, pd)) < 0.6) targetSpeed = Math.min(targetSpeed, 2);
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const res = this.city.collideCircle(car.x, car.z, 2.2);
      car.x = res.x; car.z = res.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    // Flash police light bars.
    for (const car of this.cars) {
      const lb = car.mesh.userData.lightBar;
      if (!lb) continue;
      lb.phase += dt * 6;
      const on = Math.sin(lb.phase) > 0;
      lb.red.emissiveIntensity = on ? 1.6 : 0.15;
      lb.blue.emissiveIntensity = on ? 0.15 : 1.6;
    }
    // Respawn traffic that drifted too far from the player.
    if (playerPos) {
      for (const car of [...this.cars]) {
        if (car.kind === 'traffic' && !car.isPlayer && !car.parked && dist2d(car.x, car.z, playerPos.x, playerPos.z) > 320) {
          this.removeCar(car);
          this.spawnTraffic();
        }
      }
      while (this.count('traffic') < 14) this.spawnTraffic();
    }
  }

  _nextIntersection(car) {
    const step = CITY.pitch;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    // Nearest grid line ahead in the heading direction.
    const aheadX = car.x + fx * step;
    const aheadZ = car.z + fz * step;
    const gx = Math.round(aheadX / step) * step;
    const gz = Math.round(aheadZ / step) * step;
    // At the intersection choose: straight, left or right.
    const r = Math.random();
    const turn = r < 0.55 ? 0 : r < 0.78 ? Math.PI / 2 : -Math.PI / 2;
    const nh = car.heading + turn;
    return { x: gx + Math.sin(nh) * 4, z: gz + Math.cos(nh) * 4 };
  }

  _carAhead(car, maxDist) {
    let best = null, bestD = maxDist;
    for (const o of this.cars) {
      if (o === car || o.removeMe) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > bestD || d < 0.1) continue;
      const ang = Math.atan2(dx, dz);
      if (Math.abs(angleDiff(car.heading, ang)) < 0.5 && d < bestD) {
        bestD = d; best = o;
      }
    }
    return best;
  }

  _pursue(car, target, dt) {
    const wantHeading = Math.atan2(target.x - car.x, target.z - car.z);
    car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * 3.2));
    const d = dist2d(car.x, car.z, target.x, target.z);
    const targetSpeed = d > 12 ? 30 : d > 5 ? 14 : 0;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const res = this.city.collideCircle(car.x, car.z, 2.2);
    car.x = res.x; car.z = res.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}
