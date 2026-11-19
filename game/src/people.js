// people.js — pedestrians and foot police for Velvet Bay.
// Peds wander the sidewalks, flee gunfire and speeding cars, and get knocked
// down by reckless driving. Officers chase the player on foot when wanted.

import * as THREE from 'three';
import { rand, choice, dist2d, angleLerp } from './utils.js';
import { CITY } from './city.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8b13a, 0x9a4ad8, 0xe8e8e8, 0x333333, 0xd87a2e, 0x2e9a9a];
const SKINS = [0xe8b88a, 0xc98d5f, 0x8a5a3a, 0xf0c8a0, 0x6e4426];

export function makePersonMesh(shirt, skin, police = false) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: police ? 0x1a2a4a : shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: police ? 0x14181f : 0x2a2f38 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.34), shirtMat);
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skinMat);
  head.position.y = 1.62;
  g.add(head);
  if (police) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 8),
      new THREE.MeshLambertMaterial({ color: 0x0d1420 }));
    cap.position.y = 1.8;
    g.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: choice([0x1a1a1a, 0x4a2e14, 0x6a6a6a, 0x8a5a2a]) }));
    hair.position.y = 1.66;
    g.add(hair);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), pantsMat);
    leg.position.set(0, 0.32, s * 0.14);
    g.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirtMat);
    arm.position.set(0, 1.05, s * 0.38);
    g.add(arm);
    arms.push(arm);
  }
  g.userData = { legs, arms };
  return g;
}

export class PedSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
    this.officers = [];
    this.danger = null; // {x, z} flee-from point, set by gunfire
    this.dangerTimer = 0;
  }

  spawnInitial(n) {
    for (let i = 0; i < n; i++) this.spawnPed();
  }

  spawnPed(x, z) {
    const p = x === undefined ? this.city.randomRoadPoint(Math.random) : { x, z };
    // Nudge onto the sidewalk.
    const onXRoad = Math.abs(p.x - Math.round(p.x / CITY.pitch) * CITY.pitch) < 1;
    if (onXRoad) p.x += (Math.random() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + 2.5);
    else p.z += (Math.random() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + 2.5);
    const ped = {
      mesh: makePersonMesh(choice(SHIRTS), choice(SKINS)),
      x: p.x, z: p.z,
      heading: rand(0, Math.PI * 2),
      speed: rand(1.1, 1.9),
      state: 'walk', // walk | flee | down
      target: null,
      walkPhase: rand(0, 6),
      downTimer: 0,
      vx: 0, vz: 0,
    };
    ped.mesh.position.set(ped.x, 0, ped.z);
    this.scene.add(ped.mesh);
    this.peds.push(ped);
    return ped;
  }

  spawnOfficer(x, z) {
    const o = {
      mesh: makePersonMesh(0x1a2a4a, choice(SKINS), true),
      x, z,
      heading: 0,
      speed: 5.2,
      walkPhase: 0,
      catchTimer: 0,
    };
    o.mesh.position.set(x, 0, z);
    this.scene.add(o.mesh);
    this.officers.push(o);
    return o;
  }

  removeOfficer(o) {
    this.scene.remove(o.mesh);
    this.officers = this.officers.filter((x) => x !== o);
  }

  setDanger(x, z) {
    this.danger = { x, z };
    this.dangerTimer = 4;
  }

  nearestPed(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = dist2d(x, z, p.x, p.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  count() {
    return this.peds.length;
  }

  update(dt, playerPos, playerSpeed) {
    if (this.dangerTimer > 0) this.dangerTimer -= dt;
    const danger = this.dangerTimer > 0 ? this.danger : null;

    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        // Slide from the impact, then lie still, then get up and walk off.
        ped.x += ped.vx * dt;
        ped.z += ped.vz * dt;
        ped.vx *= 0.9; ped.vz *= 0.9;
        ped.mesh.rotation.x = -Math.PI / 2 + 0.15;
        ped.mesh.position.y = 0.35;
        if (ped.downTimer <= 0) {
          ped.state = 'walk';
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          ped.target = null;
        }
        continue;
      }
      // Decide: flee danger or a fast car, else wander.
      let flee = false;
      let fx = 0, fz = 0;
      if (danger && dist2d(ped.x, ped.z, danger.x, danger.z) < 30) {
        flee = true;
        fx = ped.x - danger.x; fz = ped.z - danger.z;
      } else if (playerPos && playerSpeed > 8 && dist2d(ped.x, ped.z, playerPos.x, playerPos.z) < 9) {
        flee = true;
        fx = ped.x - playerPos.x; fz = ped.z - playerPos.z;
      }
      if (flee) {
        ped.state = 'flee';
        const len = Math.hypot(fx, fz) || 1;
        const want = Math.atan2(fx / len, fz / len);
        ped.heading = angleLerp(ped.heading, want, Math.min(1, dt * 5));
        ped.x += Math.sin(ped.heading) * 4.6 * dt;
        ped.z += Math.cos(ped.heading) * 4.6 * dt;
      } else {
        ped.state = 'walk';
        if (!ped.target || dist2d(ped.x, ped.z, ped.target.x, ped.target.z) < 3) {
          ped.target = this.city.randomRoadPoint(Math.random);
        }
        const want = Math.atan2(ped.target.x - ped.x, ped.target.z - ped.z);
        ped.heading = angleLerp(ped.heading, want, Math.min(1, dt * 2));
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
      }
      const res = this.city.collideCircle(ped.x, ped.z, 0.5);
      ped.x = res.x; ped.z = res.z;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      ped.walkPhase += dt * (ped.state === 'flee' ? 11 : 6);
      const swing = Math.sin(ped.walkPhase) * 0.55;
      ped.mesh.userData.legs[0].rotation.x = swing;
      ped.mesh.userData.legs[1].rotation.x = -swing;
      ped.mesh.userData.arms[0].rotation.x = -swing * 0.8;
      ped.mesh.userData.arms[1].rotation.x = swing * 0.8;
    }

    // Respawn peds that wandered too far from the player.
    if (playerPos) {
      for (const ped of [...this.peds]) {
        if (dist2d(ped.x, ped.z, playerPos.x, playerPos.z) > 300) {
          this.scene.remove(ped.mesh);
          this.peds = this.peds.filter((p) => p !== ped);
          this.spawnPed();
        }
      }
      while (this.peds.length < 24) this.spawnPed();
    }
  }

  // Officers run at the player; returns true while any officer is grabbing.
  updateOfficers(dt, playerPos) {
    let grabbing = false;
    for (const o of [...this.officers]) {
      const d = dist2d(o.x, o.z, playerPos.x, playerPos.z);
      if (d > 260) {
        this.removeOfficer(o);
        continue;
      }
      const want = Math.atan2(playerPos.x - o.x, playerPos.z - o.z);
      o.heading = angleLerp(o.heading, want, Math.min(1, dt * 6));
      o.x += Math.sin(o.heading) * o.speed * dt;
      o.z += Math.cos(o.heading) * o.speed * dt;
      const res = this.city.collideCircle(o.x, o.z, 0.5);
      o.x = res.x; o.z = res.z;
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.heading;
      o.walkPhase += dt * 12;
      const swing = Math.sin(o.walkPhase) * 0.6;
      o.mesh.userData.legs[0].rotation.x = swing;
      o.mesh.userData.legs[1].rotation.x = -swing;
      if (d < 2.4) {
        o.catchTimer += dt;
        grabbing = true;
      } else {
        o.catchTimer = Math.max(0, o.catchTimer - dt);
      }
      o.catchTime = o.catchTimer;
    }
    return grabbing;
  }
}
