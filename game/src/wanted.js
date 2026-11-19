// wanted.js — the Velvet Bay wanted system.
// Heat (0..100) maps to 0..5 stars. Police cars pursue the player, foot
// officers chase on foot, and getting cornered means BUSTED. Heat decays
// when the player lays low and no police are near.

import { clamp, dist2d } from './utils.js';
import { starsFromHeat } from './state.js';

const STAR_HEAT = [0, 1, 30, 50, 70, 90];

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
  }

  setWanted(stars) {
    const s = clamp(Math.round(stars), 0, 5);
    this.state.heat = STAR_HEAT[s];
    this.state.wanted = s;
    if (s > 0) this.lastCrime = this.state.time;
    this._syncPolice();
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
  }

  policeCount() {
    return this.policeCars.length + this.peds.officers.length;
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
    // Foot officers only matter while the player is on foot; main.js syncs
    // them through syncOfficers().
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

    // Heat decay: lay low for 25s with no police near.
    if (want > 0) {
      const sinceCrime = this.state.time - this.lastCrime;
      let nearest = 1e9;
      for (const car of this.policeCars) {
        nearest = Math.min(nearest, dist2d(car.x, car.z, ctx.playerPos.x, ctx.playerPos.z));
      }
      for (const o of this.peds.officers) {
        nearest = Math.min(nearest, dist2d(o.x, o.z, ctx.playerPos.x, ctx.playerPos.z));
      }
      if (sinceCrime > 25 && nearest > 45) {
        this.decayTimer += dt;
        if (this.decayTimer > 1) {
          this.decayTimer = 0;
          this.state.heat = Math.max(0, this.state.heat - 6);
          this.state.wanted = starsFromHeat(this.state.heat);
          this._syncPolice();
        }
      } else {
        this.decayTimer = 0;
      }
    }
  }
}
