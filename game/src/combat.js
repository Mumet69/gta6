// combat.js — fists, pistol, bullets and damage.
// Left click (or J) swings a fist / fires the pistol; R reloads; 1/2 switch
// weapons. Bullets are tracers that hit peds, cops and police cars. Hitting a
// pedestrian is a crime (heat). Getting shot or rammed hurts the player.
import * as THREE from 'three';
import { G } from './state.js';
import { clamp, dist2d } from './utils.js';
import { addHeat } from './wanted.js';

export function makeBullet(origin, dir) {
  const geo = new THREE.BoxGeometry(0.08, 0.08, 1.4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  mesh.lookAt(origin.clone().add(dir));
  G.scene.add(mesh);
  return { mesh, pos: mesh.position, dir: dir.clone(), travelled: 0, life: 1.2 };
}

export function firePistol(origin, dir) {
  if (G.ammo <= 0) {
    if (G.onEmptyClick) G.onEmptyClick();
    return false;
  }
  G.ammo -= 1;
  G.shotsFired += 1;
  G.bullets.push(makeBullet(origin, dir));
  addHeat(2, 'gunfire');
  if (G.onShoot) G.onShoot();
  return true;
}

export function punch(origin, dir) {
  // A short-range swing: hurts the nearest ped/cop in front within 2.2m.
  let hit = null, bestD = 2.2;
  for (const ped of G.peds) {
    const d = dist2d(origin.x, origin.z, ped.pos.x, ped.pos.z);
    if (d < bestD) { bestD = d; hit = { kind: 'ped', obj: ped }; }
  }
  for (const cop of G.cops) {
    const d = dist2d(origin.x, origin.z, cop.pos.x, cop.pos.z);
    if (d < bestD) { bestD = d; hit = { kind: 'cop', obj: cop }; }
  }
  if (hit) {
    if (hit.kind === 'ped') {
      removePed(hit.obj);
      addHeat(14, 'assault');
      if (G.onPunchHit) G.onPunchHit('ped');
    } else {
      removeCop(hit.obj);
      addHeat(18, 'assaulting an officer');
      if (G.onPunchHit) G.onPunchHit('cop');
    }
    return true;
  }
  if (G.onPunchMiss) G.onPunchMiss();
  return false;
}

function removePed(ped) {
  const i = G.peds.indexOf(ped);
  if (i >= 0) G.peds.splice(i, 1);
  G.scene.remove(ped.mesh);
  spawnBurst(ped.pos, 0xc23a3a);
}

function removeCop(cop) {
  const i = G.cops.indexOf(cop);
  if (i >= 0) G.cops.splice(i, 1);
  G.scene.remove(cop.mesh);
  spawnBurst(cop.pos, 0x2a4a8a);
}

export function spawnBurst(pos, color) {
  const parts = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshBasicMaterial({ color }),
    );
    m.position.set(pos.x, 1 + Math.random() * 0.8, pos.z);
    G.scene.add(m);
    parts.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7), life: 0.6 });
  }
  G.particles.push(...parts);
}

export function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.pos.addScaledVector(b.dir, 90 * dt);
    b.travelled += 90 * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.travelled > 120;
    if (!dead) {
      // Hit a pedestrian?
      for (const ped of [...G.peds]) {
        if (dist2d(b.pos.x, b.pos.z, ped.pos.x, ped.pos.z) < 1.1 && b.pos.y < 2.4) {
          removePed(ped);
          addHeat(14, 'shooting a pedestrian');
          dead = true;
          break;
        }
      }
      // Hit a cop?
      if (!dead) {
        for (const cop of [...G.cops]) {
          if (dist2d(b.pos.x, b.pos.z, cop.pos.x, cop.pos.z) < 1.1 && b.pos.y < 2.4) {
            removeCop(cop);
            addHeat(18, 'shooting an officer');
            dead = true;
            break;
          }
        }
      }
      // Hit a police car? (disable it — it stops and smokes)
      if (!dead) {
        for (const car of [...G.policeCars]) {
          if (dist2d(b.pos.x, b.pos.z, car.pos.x, car.pos.z) < 2.4) {
            car.speed = 0;
            car.disabled = true;
            spawnBurst(car.pos, 0x888888);
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) {
      G.scene.remove(b.mesh);
      G.bullets.splice(i, 1);
    }
  }
  // Particles fall and fade.
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.life <= 0 || p.mesh.position.y < 0) {
      G.scene.remove(p.mesh);
      G.particles.splice(i, 1);
    }
  }
}

export function hurtPlayer(n, cause) {
  G.health = clamp(G.health - n, 0, G.maxHealth);
  if (G.onHurt) G.onHurt(n, cause);
  if (G.health <= 0 && G.mode === 'playing') {
    G.mode = 'wasted';
    if (G.onWasted) G.onWasted();
  }
}

export function reload() {
  if (G.weapon !== 'pistol') return;
  const need = 12 - G.ammo;
  const take = Math.min(need, G.reserveAmmo);
  if (take > 0) {
    G.ammo += take;
    G.reserveAmmo -= take;
    if (G.onReload) G.onReload();
  }
}
