// combat.js — DUSTLINE: fists and the pistol. Hitscan shooting with a visible
// tracer, melee punches, damage to peds, cops and cars, and the heat every
// violent act adds. Tracers are short-lived line meshes.

import * as THREE from '../vendor/three.module.min.js';
import { S, showMessage } from './state.js';
import { makeRng, clamp } from './utils.js';
import { people, footCops, panicNear } from './people.js';
import { traffic, parked } from './vehicles.js';
import { addHeat } from './wanted.js';
import { playShot, playPunch, playHit } from './audio.js';

const tracers = [];
let sceneRef = null;

export function initCombat(scene) {
  sceneRef = scene;
}

export function addTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
  sceneRef.add(line);
  tracers.push({ line, life: 0.12 });
}

export function updateTracers(dt) {
  for (const t of [...tracers]) {
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.12) * 0.9;
    if (t.life <= 0) {
      sceneRef.remove(t.line);
      t.line.geometry.dispose();
      tracers.splice(tracers.indexOf(t), 1);
    }
  }
}

function nearestTarget(px, pz, heading, maxDist, maxAngle) {
  // The closest living person roughly in the aim direction.
  let best = null, bestD = maxDist;
  const all = [...people, ...footCops];
  for (const p of all) {
    if (p.down) continue;
    const dx = p.x - px, dz = p.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const ang = Math.atan2(dx, dz);
    let diff = Math.abs(ang - heading);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > maxAngle) continue;
    bestD = d; best = p;
  }
  return best;
}

export function tryPunch() {
  if (S.punchCooldown > 0 || !S.onFoot || S.over) return false;
  S.punchCooldown = 0.45;
  playPunch();
  const px = S.px, pz = S.pz;
  const target = nearestTarget(px, pz, S.heading, 2.2, 0.9);
  if (target) {
    target.down = true;
    target.state = 'down';
    target.mesh.rotation.x = -Math.PI / 2;
    target.mesh.position.y = 0.3;
    playHit();
    if (target.kind === 'cop') {
      S.stats.copsDown++;
      addHeat(18, 'Cop down');
    } else {
      S.stats.pedsDown++;
      addHeat(10, 'Pedestrian down');
    }
    return true;
  }
  return false;
}

export function tryShoot() {
  if (S.weapon !== 'pistol' || S.mag <= 0 || S.shootCooldown > 0 || S.over) return false;
  S.shootCooldown = 0.22;
  S.mag--;
  playShot();
  panicNear(S.px, S.pz, 40);
  const from = { x: S.px, y: 1.5, z: S.pz };
  const range = 60;
  const target = nearestTarget(S.px, S.pz, S.heading, range, 0.35);
  let end;
  if (target) {
    end = { x: target.x, y: 1.4, z: target.z };
    target.down = true;
    target.state = 'down';
    target.mesh.rotation.x = -Math.PI / 2;
    target.mesh.position.y = 0.3;
    playHit();
    if (target.kind === 'cop') {
      S.stats.copsDown++;
      addHeat(20, 'Cop shot');
    } else {
      S.stats.pedsDown++;
      addHeat(12, 'Pedestrian shot');
    }
  } else {
    // Miss: the tracer just flies out to range.
    end = { x: S.px + Math.sin(S.heading) * range, y: 1.2, z: S.pz + Math.cos(S.heading) * range };
    addHeat(2, 'Shots fired');
  }
  addTracer(from, end);
  if (S.mag === 0 && S.ammo > 0) {
    const load = Math.min(12, S.ammo);
    S.ammo -= load;
    S.mag = load;
    showMessage('Reloaded (' + S.mag + ' in the mag)', 1.5);
  }
  return true;
}

export function givePistol(ammo) {
  S.weapon = 'pistol';
  S.ammo += ammo;
  if (S.mag === 0) {
    const load = Math.min(12, S.ammo);
    S.ammo -= load;
    S.mag = load;
  }
}

// Damage the player's car from a crash; returns true if the car is wrecked.
export function damagePlayerCar(amount) {
  S.health = Math.max(0, S.health - amount);
  if (S.health <= 0) S.wasted = true;
  return S.health <= 0;
}

export function tickCombat(dt) {
  S.punchCooldown = Math.max(0, S.punchCooldown - dt);
  S.shootCooldown = Math.max(0, S.shootCooldown - dt);
  updateTracers(dt);
}
