// people.js — DUSTLINE: pedestrians and foot police. Peds stroll the sidewalks,
// panic and run when shots ring out, and foot cops chase the player when the
// wanted level is up. A person is {mesh, x, z, heading, speed, kind, state}.

import * as THREE from '../vendor/three.module.min.js';
import { makeRng, clamp, angleLerp, circleHitsBox, resolveCircleBox } from './utils.js';
import { S } from './state.js';
import { City, roadCentres } from './city.js';

export const people = [];   // pedestrians
export const footCops = []; // on-foot police

const SKINS = [0xc9a06a, 0x8a5a3b, 0xe8c39a, 0x6b4a2f];
const SHIRTS = [0x3a6ea5, 0xa53a3a, 0x3aa655, 0xd8b13a, 0x7a4a9e, 0xdddddd, 0x222831];

export function makePersonMesh(kind) {
  const g = new THREE.Group();
  const rng = makeRng((Math.random() * 1e9) | 0);
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(rng.next() * SKINS.length)], roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: kind === 'cop' ? 0x1c2f4a : SHIRTS[Math.floor(rng.next() * SHIRTS.length)], roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: kind === 'cop' ? 0x141c26 : 0x3a3a44, roughness: 0.9 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.3), pants);
  legs.position.y = 0.42; legs.castShadow = true;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.2; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.85; head.castShadow = true;
  g.add(head);
  if (kind === 'cop') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x0f1a28 }));
    hat.position.y = 2.05;
    g.add(hat);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3 }));
    badge.position.set(0.18, 1.35, 0.18);
    g.add(badge);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 }));
    hair.position.y = 1.88;
    g.add(hair);
  }
  g.userData.legL = legs;
  return g;
}

function sidewalkPoint(rng) {
  const centres = roadCentres();
  const c = centres[Math.floor(rng.next() * centres.length)];
  const along = rng.range(-160, 160);
  const side = rng.chance(0.5) ? 1 : -1;
  if (rng.chance(0.5)) return { x: c + side * 6.5, z: along, alongRoad: 'z' };
  return { x: along, z: c + side * 6.5, alongRoad: 'x' };
}

export function spawnPedestrians(scene, count, seed) {
  const rng = makeRng(seed * 11 + 7);
  for (let i = 0; i < count; i++) {
    const p = sidewalkPoint(rng);
    const person = {
      kind: 'ped',
      x: p.x, z: p.z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(0.8, 1.6),
      state: 'walk',       // 'walk' | 'flee' | 'down'
      stateTimer: 0,
      dir: rng.chance(0.5) ? 1 : -1,
      axis: p.alongRoad,
      mesh: makePersonMesh('ped'),
      down: false,
    };
    person.mesh.position.set(person.x, 0, person.z);
    person.mesh.rotation.y = person.heading;
    scene.add(person.mesh);
    people.push(person);
  }
}

export function spawnFootCop(scene, x, z) {
  const cop = {
    kind: 'cop',
    x, z,
    heading: 0,
    speed: 3.4,
    state: 'chase',
    stateTimer: 0,
    mesh: makePersonMesh('cop'),
    down: false,
  };
  cop.mesh.position.set(x, 0, z);
  scene.add(cop.mesh);
  footCops.push(cop);
  return cop;
}

// Everyone near a gunshot panics.
export function panicNear(x, z, radius) {
  for (const p of people) {
    if (p.down) continue;
    if (Math.hypot(p.x - x, p.z - z) < radius) {
      p.state = 'flee';
      p.stateTimer = 4 + Math.random() * 3;
    }
  }
}

function collidePerson(p, radius) {
  for (const b of City.colliders) {
    if (circleHitsBox(p.x, p.z, radius, b)) {
      const fixed = resolveCircleBox(p.x, p.z, radius, b);
      p.x = fixed.x; p.z = fixed.z;
    }
  }
}

export function updatePeople(dt) {
  for (const p of people) {
    if (p.down) continue;
    p.stateTimer -= dt;
    if (p.state === 'flee') {
      if (p.stateTimer <= 0) { p.state = 'walk'; }
      const away = Math.atan2(p.x - S.px, p.z - S.pz);
      p.heading = angleLerp(p.heading, away, clamp(6 * dt, 0, 1));
      p.x += Math.sin(p.heading) * 4.2 * dt;
      p.z += Math.cos(p.heading) * 4.2 * dt;
    } else {
      // Stroll along the sidewalk, turning around at block ends.
      const step = p.speed * p.dir * dt;
      if (p.axis === 'z') p.z += step;
      else p.x += step;
      if (p.axis === 'z' && Math.abs(p.z) > 165) p.dir *= -1;
      if (p.axis === 'x' && Math.abs(p.x) > 165) p.dir *= -1;
      const want = p.axis === 'z' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      p.heading = angleLerp(p.heading, want, clamp(4 * dt, 0, 1));
    }
    collidePerson(p, 0.5);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // Walk bob.
    const bob = Math.sin(S.time * 8 + p.x) * 0.05;
    p.mesh.position.y = Math.abs(bob);
  }
}

export function updateFootCops(dt) {
  for (const cop of footCops) {
    if (cop.down) continue;
    const dx = S.px - cop.x, dz = S.pz - cop.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.2 && S.onFoot) {
      // Caught on foot: busted.
      if (S.wanted > 0) S.busted = true;
      continue;
    }
    const want = Math.atan2(dx, dz);
    cop.heading = angleLerp(cop.heading, want, clamp(5 * dt, 0, 1));
    const spd = dist > 30 ? 4.6 : 3.4;
    cop.x += Math.sin(cop.heading) * spd * dt;
    cop.z += Math.cos(cop.heading) * spd * dt;
    collidePerson(cop, 0.5);
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
  }
}

export function removePerson(scene, person) {
  scene.remove(person.mesh);
  const i = people.indexOf(person);
  if (i >= 0) people.splice(i, 1);
  const j = footCops.indexOf(person);
  if (j >= 0) footCops.splice(j, 1);
}
