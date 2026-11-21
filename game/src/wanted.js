// wanted.js — the Velvet Bay wanted system.
// Heat (0..100) maps to 0..5 stars. Police cars pursue the player, foot
// officers chase on foot, and at 3 stars and up a police helicopter circles
// overhead with a spotlight. Getting cornered means BUSTED. Heat decays
// when the player lays low and no police are near.

import * as THREE from 'three';
import { clamp, dist2d } from './utils.js';
import { starsFromHeat } from './state.js';

const STAR_HEAT = [0, 1, 30, 50, 70, 90];

function makeHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2.2), bodyMat);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 0.7), bodyMat);
  tail.position.set(-3.4, 0.3, 0);
  g.add(tail);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 2.0),
    new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
  glass.position.set(2.0, 0.3, 0);
  g.add(glass);
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5), rotorMat);
  rotor.position.y = 1.1;
  g.add(rotor);
  const rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 9), rotorMat);
  rotor2.position.y = 1.1;
  g.add(rotor2);
  // Spotlight cone pointing down at the street.
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(6, 38, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -19;
  spot.rotation.x = Math.PI;
  g.add(spot);
  g.userData = { rotor, rotor2 };
  return g;
}

export class WantedSystem {
  constructor(scene, city, traffic, peds, audio, state) {
    this.scene = scene;
    this.city = city;
    this.traffic = traffic;
    this.peds = peds;
    this.audio = audio;
    this.state = state;
    this.lastCrime = -100;
    this.bustedTimer = 0;
    this.decayTimer = 0;
    this.policeCars = [];
    this.heli = null; // police helicopter mesh, live at 3+ stars
    this.heliAngle = 0;
    // v3: roadblocks at 4+ stars, a detective interceptor at 5, witnesses
    // who phone the cops, and a bribe (key B) that buys a star down.
    this.roadblocks = [];
    this.witnessTimer = 0;
    this.witnessPending = 0;
    this.detective = null;
  }

  // A witness saw the crime and is calling it in: a few seconds later the
  // heat jumps. Laying low near the safehouse halves the call-in.
  reportWitness() {
    this.witnessPending += 10;
    this.witnessTimer = 6;
  }

  // Pay $300 to drop a star. Returns false when broke or already clean.
  payBribe() {
    if (this.state.money < 300 || this.state.wanted <= 0) return false;
    this.state.money -= 300;
    this.state.stats.bribesPaid = (this.state.stats.bribesPaid || 0) + 1;
    this.state.heat = Math.max(0, this.state.heat - 25);
    this.state.wanted = starsFromHeat(this.state.heat);
    this._syncPolice();
    this._syncRoadblocks();
    return true;
  }

  setWanted(stars) {
    const s = clamp(Math.round(stars), 0, 5);
    this.state.heat = STAR_HEAT[s];
    this.state.wanted = s;
    if (s > 0) this.lastCrime = this.state.time;
    this._syncPolice();
    this._syncHeli();
  }

  addHeat(n) {
    this.state.heat = clamp(this.state.heat + n, 0, 100);
    this.state.wanted = starsFromHeat(this.state.heat);
    if (n > 0) this.lastCrime = this.state.time;
    this._syncPolice();
  }

  clear() {
    this.state.heat = 0;
    this.state.wanted = 0;
    this.bustedTimer = 0;
    this._syncPolice();
    this._syncHeli();
  }

  policeCount() {
    return this.policeCars.length + this.peds.officers.length + (this.heli ? 1 : 0);
  }

  // The helicopter arrives at 3 stars and leaves when the heat drops.
  _syncHeli() {
    const want = this.state.wanted;
    if (want >= 3 && !this.heli) {
      this.heli = makeHeliMesh();
      this.heli.position.set((this._px || 0) + 30, 38, (this._pz || 0) - 20);
      this.scene.add(this.heli);
    } else if (want < 3 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }
  }

  _syncPolice() {
    const want = this.state.wanted;
    // Police cars: one per star, up to 5.
    while (this.policeCars.length < want) {
      const p = this._spawnPoint(90, 130);
      const car = this.traffic.spawnPolice(p.x, p.z);
      this.policeCars.push(car);
    }
    while (this.policeCars.length > want) {
      const car = this.policeCars.pop();
      this.traffic.removeCar(car);
    }
    this._syncRoadblocks();
    this._syncDetective();
    // Foot officers only matter while the player is on foot; main.js syncs
    // them through syncOfficers().
  }

  // At 4+ stars two police cars park across the road ahead of the player,
  // forcing a detour or a ram. They clear when the heat drops.
  _syncRoadblocks() {
    const want = this.state.wanted;
    const target = want >= 4 ? 2 : 0;
    while (this.roadblocks.length < target) {
      const p = this._spawnPoint(45, 70);
      const car = this.traffic.spawnPolice(p.x, p.z);
      car.parked = true;
      car.speed = 0;
      car.heading = Math.atan2((this._px || 0) - p.x, (this._pz || 0) - p.z) + Math.PI / 2;
      car.mesh.rotation.y = car.heading;
      this.roadblocks.push(car);
    }
    while (this.roadblocks.length > target) {
      const car = this.roadblocks.pop();
      this.traffic.removeCar(car);
    }
  }

  // At 5 stars a detective interceptor joins the chase: faster than a
  // patrol car, and it never gives up until the heat breaks.
  _syncDetective() {
    const want = this.state.wanted;
    if (want >= 5 && !this.detective) {
      const p = this._spawnPoint(100, 140);
      const car = this.traffic.spawnPolice(p.x, p.z);
      car.topSpeed = 42;
      this.detective = car;
      this.policeCars.push(car);
    } else if (want < 5 && this.detective) {
      this.traffic.removeCar(this.detective);
      this.policeCars = this.policeCars.filter((c) => c !== this.detective);
      this.detective = null;
    }
  }

  _spawnPoint(minD, maxD) {
    for (let i = 0; i < 20; i++) {
      const p = this.city.randomRoadPoint(Math.random);
      const d = dist2d(p.x, p.z, this._px || 0, this._pz || 0);
      if (d >= minD && d <= maxD) return p;
    }
    return this.city.randomRoadPoint(Math.random);
  }

  syncOfficers(playerPos, inCar) {
    const want = this.state.wanted;
    const target = !inCar && want >= 1 ? (want >= 3 ? 2 : 1) : 0;
    while (this.peds.officers.length < target) {
      const p = this._spawnPoint(35, 60);
      this.peds.spawnOfficer(p.x, p.z);
    }
    while (this.peds.officers.length > target) {
      this.peds.removeOfficer(this.peds.officers[0]);
    }
  }

  update(dt, ctx) {
    // ctx: { playerPos, inCar, playerSpeed, onBusted }
    this._px = ctx.playerPos.x;
    this._pz = ctx.playerPos.z;
    const want = this.state.wanted;
    this.audio.setSiren(want > 0 && this.policeCars.length > 0);
    this._syncHeli();

    // Helicopter circles the player, rotor spinning, spotlight on the street.
    if (this.heli) {
      this.heliAngle += dt * 0.45;
      const r = 32;
      this.heli.position.set(
        ctx.playerPos.x + Math.cos(this.heliAngle) * r,
        38 + Math.sin(this.heliAngle * 0.7) * 2,
        ctx.playerPos.z + Math.sin(this.heliAngle) * r,
      );
      this.heli.rotation.y = -this.heliAngle;
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.userData.rotor2.rotation.y += dt * 22;
    }

    // Reposition police cars that fell behind.
    for (const car of [...this.policeCars]) {
      if (dist2d(car.x, car.z, ctx.playerPos.x, ctx.playerPos.z) > 240) {
        const p = this._spawnPoint(80, 120);
        car.x = p.x; car.z = p.z;
        car.speed = 10;
      }
    }

    // Busted: cornered by a police car at low speed, or grabbed by an officer.
    let cornered = false;
    if (want > 0) {
      if (ctx.inCar) {
        for (const car of this.policeCars) {
          if (dist2d(car.x, car.z, ctx.playerPos.x, ctx.playerPos.z) < 7 && ctx.playerSpeed < 3) {
            cornered = true;
            break;
          }
        }
      } else {
        for (const o of this.peds.officers) {
          if ((o.catchTime || 0) > 2.2) {
            cornered = true;
            break;
          }
        }
      }
    }
    if (cornered) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.5) {
        this.bustedTimer = 0;
        if (ctx.onBusted) ctx.onBusted();
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }

    // A witness finishes their call: the heat jumps a little, later.
    if (this.witnessPending > 0) {
      this.witnessTimer -= dt;
      if (this.witnessTimer <= 0) {
        this.addHeat(this.witnessPending);
        this.witnessPending = 0;
      }
    }

    // Heat decay: lay low for 25s with no police near. The safehouse
    // (-203, -203) is a dead zone for the law: heat falls twice as fast
    // within 40m of it, and the safehouse counts as laying low sooner.
    if (want > 0) {
      const nearSafehouse = dist2d(ctx.playerPos.x, ctx.playerPos.z, -203, -203) < 40;
      const sinceCrime = this.state.time - this.lastCrime - (nearSafehouse ? 10 : 0);
      let nearest = 1e9;
      for (const car of this.policeCars) {
        nearest = Math.min(nearest, dist2d(car.x, car.z, ctx.playerPos.x, ctx.playerPos.z));
      }
      for (const o of this.peds.officers) {
        nearest = Math.min(nearest, dist2d(o.x, o.z, ctx.playerPos.x, ctx.playerPos.z));
      }
      // The helicopter counts as police overhead: no laying low under it.
      if (this.heli) nearest = Math.min(nearest, 30);
      if (sinceCrime > 25 && nearest > 45) {
        this.decayTimer += dt;
        if (this.decayTimer > 1) {
          this.decayTimer = 0;
          const nearSafehouse = dist2d(ctx.playerPos.x, ctx.playerPos.z, -203, -203) < 40;
          this.state.heat = Math.max(0, this.state.heat - (nearSafehouse ? 12 : 6));
          this.state.wanted = starsFromHeat(this.state.heat);
          this._syncPolice();
        }
      } else {
        this.decayTimer = 0;
      }
    }
  }
}
