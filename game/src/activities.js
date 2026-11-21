// activities.js — Velvet Bay side jobs: taxi fares, hidden Sunset Coins and
// the downtown street race. Story missions pay off Mara's debt; side jobs pay
// cash and respect, and keep the city worth driving after the story ends.
// Nothing here touches the network; everything is local and deterministic
// except the fare destinations, which are drawn from the road grid.

import * as THREE from 'three';
import { dist2d, rand, choice } from './utils.js';
import { CITY } from './city.js';
import { makePersonMesh } from './people.js';

// Twelve golden Sunset Coins hidden around the city: beach, pier, docks,
// rooftops' edge streets and quiet corners. Worth $150 each.
export const COIN_SPOTS = [
  { x: 0, z: 30 }, { x: 58, z: -58 }, { x: -58, z: 116 }, { x: 116, z: 58 },
  { x: -116, z: -116 }, { x: 203, z: 60 }, { x: -203, z: 252 }, { x: 0, z: 258 },
  { x: 145, z: -145 }, { x: -145, z: 203 }, { x: 232, z: -232 }, { x: 87, z: -203 },
];

// The street race starts at the downtown gate and loops the four avenues.
export const RACE_GATE = { x: 58, z: -58 };
export const RACE_CHECKPOINTS = [
  { x: 58, z: 58 }, { x: -58, z: 58 }, { x: -58, z: -58 },
  { x: 58, z: -58 }, { x: 0, z: 0 },
];
export const RACE_TIME_LIMIT = 150;
export const RACE_REWARD = 500;

// Taxi stands: a fare customer waits at one stand at a time.
const TAXI_STANDS = [
  { x: 7, z: 58 }, { x: -51, z: 116 }, { x: 123, z: -58 },
];
const FARE_TIME_LIMIT = 90;

// v3 delivery runs: pick up a parcel at the Docks warehouse, drop it at
// three addresses across the bay before the timer runs out. Each drop pays
// $120, the full run pays a $150 bonus. VIP fares (after 21:00) pay double.
export const DELIVERY_PICKUP = { x: 262, z: 60 };
export const DELIVERY_DROPS = [
  { x: -145, z: -145, name: 'Sunset Motel drop' },
  { x: 116, z: -174, name: 'Heights villa drop' },
  { x: -58, z: 232, name: 'Beachfront drop' },
];
export const DELIVERY_TIME_LIMIT = 180;
export const DELIVERY_DROP_PAY = 120;
export const DELIVERY_BONUS = 150;

export class SideActivities {
  constructor(scene, city, state, world) {
    this.scene = scene;
    this.city = city;
    this.state = state;
    this.world = world; // { banner, addMoney, addRespect, playSound }
    this.coins = [];
    this.fareCustomer = null;
    this.fare = null; // { dest, timeLeft, payout }
    this.fareTimer = 0;
    this.race = null; // { checkpoint, timeLeft }
    this.delivery = null; // { drop, timeLeft, dropsDone }
    this.deliveryMarker = null;
    this._buildCoins();
    this._spawnFareCustomer();
  }

  // ---- Delivery runs ----
  _startDelivery() {
    this.delivery = { drop: 0, timeLeft: DELIVERY_TIME_LIMIT, dropsDone: 0 };
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.8),
      new THREE.MeshLambertMaterial({ color: 0x37d67a, emissive: 0x37d67a, emissiveIntensity: 0.4 }),
    );
    const first = DELIVERY_DROPS[0];
    mesh.position.set(first.x, 2.2, first.z);
    this.scene.add(mesh);
    this.deliveryMarker = mesh;
    this.world.banner('DELIVERY RUN', 'Three drops in 180 seconds — $120 each, $150 bonus for all three');
    this.world.playSound('taxiBell');
  }

  _finishDelivery() {
    const bonus = DELIVERY_BONUS;
    this.delivery = null;
    if (this.deliveryMarker) { this.scene.remove(this.deliveryMarker); this.deliveryMarker = null; }
    this.state.deliveriesDone = (this.state.deliveriesDone || 0) + 1;
    this.state.stats.deliveriesDone = (this.state.stats.deliveriesDone || 0) + 1;
    this.world.addMoney(bonus);
    this.world.addRespect(2);
    this.world.playSound('missionDone');
    this.world.banner('DELIVERY DONE', '+$' + bonus + ' bonus  •  Runs done: ' + this.state.deliveriesDone);
  }

  // ---- Sunset Coins ----
  _buildCoins() {
    const taken = this.state.flags.coinsTaken || [];
    const geo = new THREE.OctahedronGeometry(0.9);
    COIN_SPOTS.forEach((spot, i) => {
      if (taken.includes(i)) return;
      const mat = new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x7a5a00 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, 1.2, spot.z);
      this.scene.add(mesh);
      this.coins.push({ x: spot.x, z: spot.z, index: i, mesh, phase: Math.random() * 6 });
    });
  }

  _collectCoin(coin) {
    this.scene.remove(coin.mesh);
    this.coins = this.coins.filter((c) => c !== coin);
    if (!this.state.flags.coinsTaken) this.state.flags.coinsTaken = [];
    this.state.flags.coinsTaken.push(coin.index);
    this.state.stats.coinsCollected++;
    this.world.addMoney(150);
    this.world.addRespect(1);
    this.world.playSound('coin');
    this.world.banner('SUNSET COIN', 'Found ' + this.state.stats.coinsCollected + ' of 12 — +$150');
  }

  // After loading a save, remove the coins the player already collected
  // (the constructor built them from a fresh state, before the save loaded).
  syncCoinsFromSave() {
    const taken = this.state.flags.coinsTaken || [];
    for (const coin of [...this.coins]) {
      if (taken.includes(coin.index)) {
        this.scene.remove(coin.mesh);
        this.coins = this.coins.filter((c) => c !== coin);
      }
    }
  }

  // ---- Taxi fares ----
  _spawnFareCustomer() {
    const stand = choice(TAXI_STANDS);
    const mesh = makePersonMesh(0xffd34d, choice([0xe8b88a, 0xc98d5f, 0x8a5a3a]));
    mesh.position.set(stand.x, 0, stand.z);
    // Floating diamond marks the waiting customer.
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd34d }),
    );
    marker.position.set(stand.x, 2.6, stand.z);
    this.scene.add(mesh);
    this.scene.add(marker);
    this.fareCustomer = { x: stand.x, z: stand.z, mesh, marker };
  }

  _removeFareCustomer() {
    if (!this.fareCustomer) return;
    this.scene.remove(this.fareCustomer.mesh);
    this.scene.remove(this.fareCustomer.marker);
    this.fareCustomer = null;
  }

  _startFare() {
    let dest = this.city.randomRoadPoint(Math.random);
    let guard = 0;
    while (dist2d(dest.x, dest.z, this.fareCustomer.x, this.fareCustomer.z) < 120 && guard++ < 20) {
      dest = this.city.randomRoadPoint(Math.random);
    }
    const d = Math.round(dist2d(dest.x, dest.z, this.fareCustomer.x, this.fareCustomer.z));
    // VIP hours: after 21:00 the night crowd pays double for a ride home.
    const hour = (this.state.clock / 60) % 24;
    const vip = hour >= 21 || hour < 2;
    const payout = Math.min(350, 100 + d) * (vip ? 2 : 1);
    this.fare = { dest, timeLeft: FARE_TIME_LIMIT, payout, dist: d };
    this._removeFareCustomer();
    this.world.banner('TAXI FARE', 'Drop them off ' + d + 'm away in 90 seconds — $' + payout);
    this.world.playSound('taxiBell');
  }

  _finishFare() {
    const payout = this.fare.payout;
    this.fare = null;
    this.state.stats.taxiFares++;
    this.world.addMoney(payout);
    this.world.addRespect(1);
    this.world.playSound('pickup');
    this.world.banner('FARE PAID', '+$' + payout + '  •  Fares run: ' + this.state.stats.taxiFares);
    this.fareTimer = 20; // next customer arrives shortly
  }

  // ---- Street race ----
  _startRace() {
    this.race = { checkpoint: 0, timeLeft: RACE_TIME_LIMIT };
    this.world.banner('STREET RACE', 'Hit all 5 checkpoints in 150 seconds — $500');
    this.world.playSound('raceBeep');
  }

  _finishRace() {
    this.race = null;
    this.state.stats.racesWon++;
    this.world.addMoney(RACE_REWARD);
    this.world.addRespect(2);
    this.world.playSound('missionDone');
    this.world.banner('RACE WON', '+$500  •  Races won: ' + this.state.stats.racesWon);
  }

  // The player pressed E on foot. Returns true when a side job took the press.
  tryInteract(playerPos) {
    if (!this.delivery && dist2d(playerPos.x, playerPos.z, DELIVERY_PICKUP.x, DELIVERY_PICKUP.z) <= 6) {
      this._startDelivery();
      return true;
    }
    if (this.fareCustomer && !this.fare && dist2d(playerPos.x, playerPos.z, this.fareCustomer.x, this.fareCustomer.z) <= 4.5) {
      this._startFare();
      return true;
    }
    if (!this.race && dist2d(playerPos.x, playerPos.z, RACE_GATE.x, RACE_GATE.z) <= 6) {
      this._startRace();
      return true;
    }
    return false;
  }

  // The objective marker the beacon and minimap fall back to when no story
  // mission is active: fare destination, next race checkpoint, or nothing.
  objective() {
    if (this.delivery) {
      const drop = DELIVERY_DROPS[this.delivery.drop];
      return {
        text: 'Delivery drop ' + (this.delivery.drop + 1) + ' of 3 — ' + Math.ceil(this.delivery.timeLeft) + 's left',
        marker: drop, dist: 0, timeLeft: this.delivery.timeLeft,
      };
    }
    if (this.fare) {
      return {
        text: 'Drop the fare off — ' + Math.ceil(this.fare.timeLeft) + 's left',
        marker: this.fare.dest, dist: 0, timeLeft: this.fare.timeLeft,
      };
    }
    if (this.race) {
      const cp = RACE_CHECKPOINTS[this.race.checkpoint];
      return {
        text: 'Race checkpoint ' + (this.race.checkpoint + 1) + ' of 5 — ' + Math.ceil(this.race.timeLeft) + 's left',
        marker: cp, dist: 0, timeLeft: this.race.timeLeft,
      };
    }
    if (this.fareCustomer) {
      return { text: 'A fare is waiting at the taxi stand — press E', marker: this.fareCustomer, dist: 0, timeLeft: 0 };
    }
    return { text: 'Free roam — find Sunset Coins, fares and the race gate', marker: null, dist: 0, timeLeft: 0 };
  }

  update(dt, ctx) {
    const p = ctx.playerPos;
    // Coins: spin, bob, collect on proximity (on foot or in a car).
    for (const coin of [...this.coins]) {
      coin.mesh.rotation.y += dt * 2.4;
      coin.mesh.position.y = 1.2 + Math.sin(performance.now() / 350 + coin.phase) * 0.25;
      if (dist2d(p.x, p.z, coin.x, coin.z) <= 3.5) this._collectCoin(coin);
    }
    // Fare customer marker bobs; a new one arrives after a fare or a wait.
    if (this.fareCustomer) {
      this.fareCustomer.marker.position.y = 2.6 + Math.sin(performance.now() / 300) * 0.2;
      this.fareCustomer.marker.rotation.y += dt * 2;
    } else if (!this.fare) {
      this.fareTimer -= dt;
      if (this.fareTimer <= 0) this._spawnFareCustomer();
    }
    // Active fare: timer + arrival.
    if (this.fare) {
      this.fare.timeLeft -= dt;
      if (dist2d(p.x, p.z, this.fare.dest.x, this.fare.dest.z) <= 9) {
        this._finishFare();
      } else if (this.fare.timeLeft <= 0) {
        this.fare = null;
        this.fareTimer = 20;
        this.world.banner('FARE LOST', 'Too slow — the customer walked away.');
      }
    }
    // Active delivery: drops in order, then the bonus.
    if (this.delivery) {
      this.delivery.timeLeft -= dt;
      const drop = DELIVERY_DROPS[this.delivery.drop];
      if (this.deliveryMarker) {
        this.deliveryMarker.rotation.y += dt * 2;
        this.deliveryMarker.position.y = 2.2 + Math.sin(performance.now() / 350) * 0.25;
      }
      if (dist2d(p.x, p.z, drop.x, drop.z) <= 9) {
        this.delivery.drop++;
        this.delivery.dropsDone++;
        this.world.addMoney(DELIVERY_DROP_PAY);
        this.world.addRespect(1);
        this.world.playSound('pickup');
        if (this.delivery.drop >= DELIVERY_DROPS.length) {
          this._finishDelivery();
        } else {
          const next = DELIVERY_DROPS[this.delivery.drop];
          this.deliveryMarker.position.set(next.x, 2.2, next.z);
          this.world.banner('DROP ' + this.delivery.dropsDone + '/3 DONE', '+$' + DELIVERY_DROP_PAY + ' — next: ' + next.name);
        }
      } else if (this.delivery.timeLeft <= 0) {
        this.delivery = null;
        if (this.deliveryMarker) { this.scene.remove(this.deliveryMarker); this.deliveryMarker = null; }
        this.world.banner('DELIVERY LOST', 'Out of time — the warehouse has more parcels.');
      }
    }
    // Active race: checkpoints in order, then the purse.
    if (this.race) {
      this.race.timeLeft -= dt;
      const cp = RACE_CHECKPOINTS[this.race.checkpoint];
      if (dist2d(p.x, p.z, cp.x, cp.z) <= 9) {
        this.race.checkpoint++;
        this.world.playSound('raceBeep');
        if (this.race.checkpoint >= RACE_CHECKPOINTS.length) this._finishRace();
      } else if (this.race.timeLeft <= 0) {
        this.race = null;
        this.world.banner('RACE LOST', 'Out of time — the gate is still there when you are ready.');
      }
    }
  }
}
