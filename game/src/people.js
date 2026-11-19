// people.js — the player on foot and the pedestrians of Solmar City.
// A person is a small articulated figure built from boxes (torso, head, legs,
// arms) with a walk-cycle swing. Pedestrians stroll the sidewalks, flee from
// gunfire and from the player's car, and sometimes scream (a toast + wanted).
import * as THREE from 'three';
import { clamp, angleLerp, dist2D, resolveAABBCollisions, pick, randRange } from './utils.js';

const SHIRT_COLORS = [0xd84a4a, 0x4a7ad8, 0xe8c860, 0x3aa86a, 0xd8d8d8, 0x8a4ad8, 0xe88a2a, 0x4ad8c8];
const SKIN_COLORS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

export function makePersonMesh(shirt, skin, police = false) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: police ? 0x2a4a8a : shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: police ? 0x1a2430 : 0x3a3a44 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skinMat);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  if (police) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x1a2430 }));
    cap.position.y = 1.82;
    g.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x2a1a10 }));
    hair.position.y = 1.8;
    g.add(hair);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pantsMat);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pantsMat);
  legR.position.set(0.14, 0.35, 0);
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirtMat);
  armL.position.set(-0.37, 1.05, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirtMat);
  armR.position.set(0.37, 1.05, 0);
  g.add(armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

// walk-cycle: swing limbs by phase; phase advances with speed.
export function animateWalk(mesh, phase, amount) {
  const u = mesh.userData;
  const s = Math.sin(phase) * amount;
  u.legL.rotation.x = s;
  u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.8;
  u.armR.rotation.x = s * 0.8;
}

// Player — on-foot movement, jump, and entering/exiting cars.
export class Player {
  constructor(scene, x, z, heading) {
    this.mesh = makePersonMesh(0xd84a4a, 0xe8b88a, false);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = heading;
    this.velY = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.speed = 0;
    this.inCar = false;
    this.punchTimer = 0;
  }

  update(dt, input, cameraYaw, colliders) {
    if (this.inCar) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const mx = input.moveX(), my = input.moveY();
    const sprint = input.sprint();
    const speed = sprint ? 9 : 5.2;
    // movement is relative to the camera yaw
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    let dx = (sin * my + cos * mx);
    let dz = (cos * my - sin * mx);
    const len = Math.hypot(dx, dz);
    if (len > 0.01) {
      dx /= len; dz /= len;
      this.heading = angleLerp(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 12));
      const nx = this.pos.x + dx * speed * dt;
      const nz = this.pos.z + dz * speed * dt;
      const res = resolveAABBCollisions(nx, nz, 0.5, colliders);
      this.pos.x = clamp(res.x, -196, 196);
      this.pos.z = clamp(res.z, -196, 196);
      this.speed = speed;
      this.walkPhase += dt * speed * 1.6;
    } else {
      this.speed = 0;
    }
    // jump (simple gravity)
    if (input.jump() && this.grounded) { this.velY = 6.5; this.grounded = false; }
    if (!this.grounded) {
      this.velY -= 18 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.grounded = true; }
    }
    this.mesh.rotation.y = this.heading;
    animateWalk(this.mesh, this.walkPhase, this.speed > 0.1 ? 0.7 : 0);
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      this.mesh.userData.armR.rotation.x = -1.4 * Math.max(0, this.punchTimer / 0.25);
    }
  }
}

// PedestrianManager — sidewalk walkers with panic behaviour.
export class PedestrianManager {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.peds = [];
  }

  spawn(count, centerX = 0, centerZ = 0) {
    for (let i = 0; i < count; i++) {
      const x = centerX + (this.rng() * 2 - 1) * 170;
      const z = centerZ + (this.rng() * 2 - 1) * 170;
      const mesh = makePersonMesh(
        SHIRT_COLORS[Math.floor(this.rng() * SHIRT_COLORS.length)],
        SKIN_COLORS[Math.floor(this.rng() * SKIN_COLORS.length)]);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.peds.push({
        mesh, pos: mesh.position,
        heading: this.rng() * Math.PI * 2,
        speed: 1 + this.rng() * 1.2,
        state: 'walk', // 'walk' | 'flee' | 'down'
        walkPhase: this.rng() * 6,
        downTimer: 0,
        targetX: x, targetZ: z,
      });
    }
  }

  update(dt, playerPos, dangerPos, dangerRadius) {
    for (const p of this.peds) {
      if (p.state === 'down') {
        p.downTimer -= dt;
        if (p.downTimer <= 0) { p.state = 'walk'; p.mesh.rotation.x = 0; p.mesh.position.y = 0; }
        continue;
      }
      const dDanger = dangerPos ? dist2D(p.pos.x, p.pos.z, dangerPos.x, dangerPos.z) : 999;
      if (dDanger < dangerRadius) p.state = 'flee';
      else if (p.state === 'flee' && dDanger > dangerRadius * 2.5) p.state = 'walk';
      const speed = p.state === 'flee' ? 6.5 : p.speed;
      if (p.state === 'walk' && dist2D(p.pos.x, p.pos.z, p.targetX, p.targetZ) < 2) {
        p.targetX = p.pos.x + (this.rng() * 2 - 1) * 60;
        p.targetZ = p.pos.z + (this.rng() * 2 - 1) * 60;
        p.targetX = clamp(p.targetX, -190, 190);
        p.targetZ = clamp(p.targetZ, -190, 190);
      }
      let tx, tz;
      if (p.state === 'flee' && dangerPos) {
        tx = p.pos.x + (p.pos.x - dangerPos.x);
        tz = p.pos.z + (p.pos.z - dangerPos.z);
      } else { tx = p.targetX; tz = p.targetZ; }
      const want = Math.atan2(tx - p.pos.x, tz - p.pos.z);
      p.heading = angleLerp(p.heading, want, Math.min(1, dt * 4));
      const nx = p.pos.x + Math.sin(p.heading) * speed * dt;
      const nz = p.pos.z + Math.cos(p.heading) * speed * dt;
      const res = resolveAABBCollisions(nx, nz, 0.4, this.colliders);
      p.pos.x = clamp(res.x, -196, 196);
      p.pos.z = clamp(res.z, -196, 196);
      p.walkPhase += dt * speed * 2.2;
      p.mesh.rotation.y = p.heading;
      animateWalk(p.mesh, p.walkPhase, speed > 0.1 ? 0.6 : 0);
    }
  }

  // knock a pedestrian down (car hit or punch): returns the ped
  knockDown(p) {
    p.state = 'down';
    p.downTimer = 6;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.35;
    return p;
  }

  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = dist2D(x, z, p.pos.x, p.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
