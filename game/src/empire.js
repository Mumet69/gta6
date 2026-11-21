// empire.js — Velvet Bay v3: the empire layer.
// Mara stops working for Cash and starts owning the bay herself. Three
// buyable fronts pay passive income, five districts flip between the
// Vipers gang and Mara through turf wars, and a three-step heist plan
// unlocks the final job. Nothing here touches the network; every number
// below is local game state, saved by save.js.

import * as THREE from 'three';
import { dist2d, choice } from './utils.js';

// Fronts for sale. Price once, income forever (one payout per tick).
// Each front sits on its own block, clear of the turf flags and the
// delivery pickup, so one E press can only ever mean one thing there.
export const BUSINESSES = [
  { id: 'motel', name: 'Sunset Motel', x: -145, z: 232, price: 1200, income: 45, color: 0xff9d5c },
  { id: 'warehouse', name: 'Docks Warehouse', x: 203, z: 87, price: 2500, income: 95, color: 0x7a9a5a },
  { id: 'palms', name: 'Neon Palms Club', x: 116, z: 174, price: 4000, income: 170, color: 0xd84ad8 },
];

// Five turf districts. Gang-held at the start; Mara flips one by winning
// its turf war (press E at its flag, beat the muscle that shows up).
export const TURF_DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x: 0, z: 0, r: 85 },
  { id: 'strip', name: 'The Strip', x: 64, z: 122, r: 70 },
  { id: 'docks', name: 'Docks 7', x: 262, z: 60, r: 70 },
  { id: 'beach', name: 'Beachfront', x: 0, z: 232, r: 80 },
  { id: 'heights', name: 'The Heights', x: -203, z: -203, r: 80 },
];

// Heist prep for the final job: scout the bank, steal a getaway sportscar,
// recruit a crew at the motel. Each step is an E press at its marker.
export const HEIST_PREP = [
  { id: 'scout', name: 'Scout Meridian Bank', x: -29, z: -29, text: 'Scout the bank — press E to case the vault' },
  { id: 'getaway', name: 'Steal a getaway car', x: 87, z: -87, text: 'Steal a getaway sportscar — press E at the car' },
  { id: 'crew', name: 'Recruit a crew', x: -145, z: 232, text: 'Recruit the crew — press E at the motel' },
];

const INCOME_TICK = 45; // seconds of play per payout, per owned front

export class EmpireSystem {
  constructor(scene, city, state, world) {
    this.scene = scene;
    this.city = city;
    this.state = state;
    this.world = world; // { banner, addMoney, addRespect, playSound, spawnGang }
    this.incomeTimer = 0;
    this.turfWar = null; // { district, startedAt }
    this.markers = [];
    this._buildMarkers();
  }

  get ownedCount() {
    return (this.state.empire.businesses || []).length;
  }

  get maraTurf() {
    return TURF_DISTRICTS.filter((d) => (this.state.empire.turf[d.id] || 'vipers') === 'mara').length;
  }

  get incomePerTick() {
    return BUSINESSES.filter((b) => (this.state.empire.businesses || []).includes(b.id))
      .reduce((sum, b) => sum + b.income, 0);
  }

  get prepDoneCount() {
    return HEIST_PREP.filter((p) => this.state.empire.prep[p.id]).length;
  }

  owns(id) {
    return (this.state.empire.businesses || []).includes(id);
  }

  _buildMarkers() {
    const geo = new THREE.OctahedronGeometry(0.8);
    for (const b of BUSINESSES) {
      const mat = new THREE.MeshLambertMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x, 2.2, b.z);
      this.scene.add(mesh);
      this.markers.push({ kind: 'business', id: b.id, mesh, phase: Math.random() * 6 });
    }
    for (const d of TURF_DISTRICTS) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
      );
      pole.position.set(d.x, 3.5, d.z);
      this.scene.add(pole);
      const flagMat = new THREE.MeshLambertMaterial({ color: 0x8a1f1f, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), flagMat);
      flag.position.set(d.x + 1.6, 6, d.z);
      this.scene.add(flag);
      this.markers.push({ kind: 'turf', id: d.id, mesh: flag, flagMat, phase: Math.random() * 6 });
    }
    for (const p of HEIST_PREP) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), mat);
      mesh.position.set(p.x, 2.6, p.z);
      this.scene.add(mesh);
      this.markers.push({ kind: 'prep', id: p.id, mesh, phase: Math.random() * 6 });
    }
  }

  // The player pressed E. Returns true when an empire marker took it.
  tryInteract(playerPos) {
    // Markers sit at block centres, where a building may stand: the player
    // is pushed to the building's edge, so the press reaches 10 m out.
    for (const b of BUSINESSES) {
      if (dist2d(playerPos.x, playerPos.z, b.x, b.z) <= 10 && !this.owns(b.id)) {
        if (this.state.money < b.price) {
          this.world.banner('NOT ENOUGH CASH', b.name + ' costs $' + b.price + ' — you have $' + this.state.money);
          return true;
        }
        this.state.money -= b.price;
        this.state.empire.businesses.push(b.id);
        this.state.stats.businessesBought = (this.state.stats.businessesBought || 0) + 1;
        this.world.addRespect(3);
        this.world.playSound('register');
        this.world.banner('FRONT BOUGHT — ' + b.name.toUpperCase(), 'Pays $' + b.income + ' every ' + INCOME_TICK + 's. The bay is yours.');
        return true;
      }
    }
    for (const d of TURF_DISTRICTS) {
      if (dist2d(playerPos.x, playerPos.z, d.x, d.z) <= 10 && (this.state.empire.turf[d.id] || 'vipers') !== 'mara' && !this.turfWar) {
        this.turfWar = { district: d.id, name: d.name };
        this.world.spawnGang(d.x, d.z, 3);
        this.world.banner('TURF WAR — ' + d.name.toUpperCase(), 'Clear the Vipers muscle to take this district!');
        this.world.playSound('alarm');
        return true;
      }
    }
    for (const p of HEIST_PREP) {
      if (dist2d(playerPos.x, playerPos.z, p.x, p.z) <= 10 && !this.state.empire.prep[p.id]) {
        this.state.empire.prep[p.id] = true;
        this.state.stats.prepDone = (this.state.stats.prepDone || 0) + 1;
        this.world.addRespect(1);
        this.world.playSound('blip');
        this.world.banner('HEIST PREP ' + this.prepDoneCount + '/3', p.name + ' — done.');
        return true;
      }
    }
    return false;
  }

  // Passive income, turf-war resolution and marker animation.
  update(dt, ctx) {
    if (this.ownedCount > 0) {
      this.incomeTimer += dt;
      if (this.incomeTimer >= INCOME_TICK) {
        this.incomeTimer = 0;
        const pay = this.incomePerTick;
        this.state.money += pay;
        this.state.empire.incomeEarned = (this.state.empire.incomeEarned || 0) + pay;
        this.world.playSound('register');
        this.world.banner('FRONT INCOME', '+$' + pay + ' from your businesses.');
      }
    }
    if (this.turfWar && ctx.enemiesAlive === 0) {
      const d = TURF_DISTRICTS.find((t) => t.id === this.turfWar.district);
      this.state.empire.turf[d.id] = 'mara';
      this.state.stats.turfTaken = (this.state.stats.turfTaken || 0) + 1;
      this.state.money += 300;
      this.world.addRespect(4);
      this.world.playSound('missionDone');
      this.world.banner(d.name.toUpperCase() + ' IS YOURS', '+$300 turf payout  •  Districts held: ' + this.maraTurf + '/5');
      const marker = this.markers.find((m) => m.kind === 'turf' && m.id === d.id);
      if (marker) marker.flagMat.color.setHex(0x37d67a);
      this.turfWar = null;
    }
    for (const m of this.markers) {
      if (m.kind === 'turf') continue;
      m.mesh.rotation.y += dt * 2;
      m.mesh.position.y = (m.kind === 'prep' ? 2.6 : 2.2) + Math.sin(performance.now() / 350 + m.phase) * 0.25;
    }
  }

  // Objective fallback for the beacon/HUD when no story step has a marker.
  objective() {
    if (this.turfWar) {
      const d = TURF_DISTRICTS.find((t) => t.id === this.turfWar.district);
      return { text: 'Turf war: clear the Vipers in ' + d.name, marker: d, dist: 0, timeLeft: 0 };
    }
    const next = BUSINESSES.find((b) => !this.owns(b.id));
    if (next && this.state.money >= next.price) {
      return { text: 'Buy ' + next.name + ' — $' + next.price, marker: next, dist: 0, timeLeft: 0 };
    }
    return { text: 'Free roam — fronts, turf flags and heist prep pay', marker: null, dist: 0, timeLeft: 0 };
  }
}
