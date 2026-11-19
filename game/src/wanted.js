// wanted.js — the Solmar PD response.
// Crimes add heat (0..100); stars are bands of heat. While any cop is near,
// heat holds; when the player is hidden and far from cops, heat decays and
// stars fall. On-foot cops chase and try to arrest; getting caught on foot
// at 1+ stars, or hitting 0 health, ends the run as BUSTED / WASTED.
import * as THREE from 'three';
import { clamp, dist2D, angleLerp } from './utils.js';
import { makePersonMesh, animateWalk } from './people.js';

export class WantedSystem {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.heat = 0;
    this.stars = 0;
    this.cops = []; // on-foot police
    this.bustTimer = 0; // counts up while a cop is touching the player
    this.hiddenTimer = 0;
  }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.stars = this.heat <= 0 ? 0 : this.heat < 20 ? 1 : this.heat < 40 ? 2 : this.heat < 60 ? 3 : this.heat < 80 ? 4 : 5;
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.bustTimer = 0;
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.cops = [];
  }

  wantCops() {
    return this.stars <= 0 ? 0 : this.stars <= 1 ? 1 : this.stars <= 2 ? 2 : this.stars <= 3 ? 3 : 4;
  }

  update(dt, playerPos, playerInCar, onBusted) {
    // spawn / despawn on-foot cops by wanted level
    const want = this.wantCops();
    while (this.cops.length < want) {
      const a = this.rng() * Math.PI * 2;
      const mesh = makePersonMesh(0x2a4a8a, 0xe8b88a, true);
      const x = clamp(playerPos.x + Math.sin(a) * 40, -190, 190);
      const z = clamp(playerPos.z + Math.cos(a) * 40, -190, 190);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.cops.push({ mesh, pos: mesh.position, heading: 0, speed: 5.5, walkPhase: 0 });
    }
    while (this.cops.length > want) {
      const c = this.cops.pop();
      this.scene.remove(c.mesh);
    }
    let nearestCop = 999;
    for (const c of this.cops) {
      const d = dist2D(c.pos.x, c.pos.z, playerPos.x, playerPos.z);
      nearestCop = Math.min(nearestCop, d);
      const wantHeading = Math.atan2(playerPos.x - c.pos.x, playerPos.z - c.pos.z);
      c.heading = angleLerp(c.heading, wantHeading, Math.min(1, dt * 5));
      const speed = d > 25 ? 7 : 5.5;
      c.pos.x += Math.sin(c.heading) * speed * dt;
      c.pos.z += Math.cos(c.heading) * speed * dt;
      c.walkPhase += dt * speed * 2;
      c.mesh.rotation.y = c.heading;
      animateWalk(c.mesh, c.walkPhase, 0.6);
    }
    // bust: a cop touching the player on foot
    if (!playerInCar && nearestCop < 1.6 && this.stars > 0) {
      this.bustTimer += dt;
      if (this.bustTimer > 1.2) { this.bustTimer = 0; onBusted('busted'); }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    // heat decay when hidden: no cop within 30 units
    if (nearestCop > 30 && this.stars > 0) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > 4) this.addHeat(-6 * dt);
    } else {
      this.hiddenTimer = 0;
    }
  }
}
