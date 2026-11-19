// people.js — pedestrians and police officers on foot.
// Pedestrians stroll the sidewalks and flee from gunfire or speeding cars.
// Cops on foot close in on the player and try to arrest them (busted) when
// the wanted level is up; the player can fight them off.
import * as THREE from 'three';
import { G } from './state.js';
import { makeRng, clamp, dist2d, TAU } from './utils.js';
import { BLOCK, HALF } from './city.js';

const SHIRT = [0xc23a3a, 0x3a6ac2, 0xd8b83a, 0x3a9a5a, 0xe8e8e8, 0x8a5a3a, 0x5a3a8a, 0x2a2a2a];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x2a2a2a, 0x6a7a8a];

export function makePersonMesh(shirt, pants, isCop) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1a1a2a : pants });
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), legMat);
  leftLeg.position.set(-0.14, 0.4, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.14;
  const torsoMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1a2a4a : shirt });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), torsoMat);
  torso.position.y = 1.18;
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.78;
  const armMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1a2a4a : shirt });
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), armMat);
  leftArm.position.set(-0.42, 1.18, 0);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.42;
  if (isCop) {
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0x0a0a1a }));
    hat.position.y = 2.02;
    g.add(hat);
  }
  g.add(leftLeg, rightLeg, torso, head, leftArm, rightArm);
  g.userData.parts = { leftLeg, rightLeg, leftArm, rightArm };
  return g;
}

export function spawnPeds(scene, seed, count) {
  const rng = makeRng(seed + 31);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = rng.range(-HALF * BLOCK, HALF * BLOCK);
    const z = rng.range(-HALF * BLOCK, HALF * BLOCK);
    const mesh = makePersonMesh(rng.pick(SHIRT), rng.pick(PANTS), false);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rng.range(0, TAU);
    scene.add(mesh);
    peds.push({
      mesh, pos: mesh.position,
      heading: mesh.rotation.y,
      speed: rng.range(1.2, 2.4),
      walkPhase: rng.range(0, TAU),
      flee: 0, // seconds of fleeing left
      target: null,
    });
  }
  return peds;
}

export function spawnCop(scene, pos) {
  const mesh = makePersonMesh(0, 0, true);
  mesh.position.set(pos.x, 0, pos.z);
  scene.add(mesh);
  const cop = {
    mesh, pos: mesh.position,
    heading: 0, speed: 4.2, walkPhase: 0,
    state: 'chase',
  };
  return cop;
}

function pickPedTarget(ped, rng) {
  ped.target = {
    x: clamp(ped.pos.x + rng.range(-40, 40), -HALF * BLOCK, HALF * BLOCK),
    z: clamp(ped.pos.z + rng.range(-40, 40), -HALF * BLOCK, HALF * BLOCK),
  };
}

export function updatePeds(peds, rng, dt, dangerPos) {
  for (const ped of peds) {
    // Flee if danger (gunfire / speeding car) is near.
    if (dangerPos && dist2d(ped.pos.x, ped.pos.z, dangerPos.x, dangerPos.z) < 14) {
      ped.flee = 2.5;
    }
    let speed = ped.speed;
    let heading = ped.heading;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 5.5;
      if (dangerPos) heading = Math.atan2(ped.pos.x - dangerPos.x, ped.pos.z - dangerPos.z);
    } else {
      if (!ped.target || dist2d(ped.pos.x, ped.pos.z, ped.target.x, ped.target.z) < 2) {
        pickPedTarget(ped, rng);
      }
      heading = Math.atan2(ped.target.x - ped.pos.x, ped.target.z - ped.pos.z);
    }
    ped.heading = heading;
    ped.pos.x += Math.sin(heading) * speed * dt;
    ped.pos.z += Math.cos(heading) * speed * dt;
    ped.pos.x = clamp(ped.pos.x, -HALF * BLOCK - 6, HALF * BLOCK + 6);
    ped.pos.z = clamp(ped.pos.z, -HALF * BLOCK - 6, HALF * BLOCK + 6);
    ped.mesh.rotation.y = heading;
    ped.walkPhase += dt * speed * 3.2;
    const swing = Math.sin(ped.walkPhase) * 0.55;
    const p = ped.mesh.userData.parts;
    p.leftLeg.rotation.x = swing;
    p.rightLeg.rotation.x = -swing;
    p.leftArm.rotation.x = -swing * 0.7;
    p.rightArm.rotation.x = swing * 0.7;
  }
}

export function updateCops(cops, dt, playerPos, onBusted) {
  for (const cop of G.cops) {
    const d = dist2d(cop.pos.x, cop.pos.z, playerPos.x, playerPos.z);
    if (d < 1.6) {
      onBusted();
      return;
    }
    const heading = Math.atan2(playerPos.x - cop.pos.x, playerPos.z - cop.pos.z);
    cop.heading = heading;
    const speed = d > 12 ? 5.2 : 4.2;
    cop.pos.x += Math.sin(heading) * speed * dt;
    cop.pos.z += Math.cos(heading) * speed * dt;
    cop.mesh.rotation.y = heading;
    cop.walkPhase += dt * speed * 3;
    const swing = Math.sin(cop.walkPhase) * 0.6;
    const p = cop.mesh.userData.parts;
    p.leftLeg.rotation.x = swing;
    p.rightLeg.rotation.x = -swing;
    p.leftArm.rotation.x = -swing * 0.7;
    p.rightArm.rotation.x = swing * 0.7;
  }
}
