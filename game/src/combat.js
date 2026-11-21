// combat.js — pistol, punch and gang enemies for Velvet Bay.
// Shooting is a 2D ray test (no physics engine): the bullet travels until
// it meets a building collider, an enemy, a pedestrian or a car. Enemies
// shoot back with inaccuracy; the player can also punch up close.

import * as THREE from 'three';
import { clamp, rand, choice, dist2d } from './utils.js';
import { makePersonMesh } from './people.js';

const GANG_SHIRTS = [0x8a1f1f, 0x5a1f6e, 0x1f3a5a];

// v3 weapon locker: the pistol is Mara's starter; a shotgun (five pellets,
// huge close-range damage, slow) and an SMG (fast, light hits, 30-round
// mag) are found in weapon crates around the city. Damage per pellet/hit.
export const WEAPONS = {
  pistol: { damage: 34, cooldown: 0.18, mag: 12, pellets: 1, spread: 0, label: 'Pistol' },
  shotgun: { damage: 18, cooldown: 0.75, mag: 6, pellets: 5, spread: 0.09, label: 'Shotgun' },
  smg: { damage: 16, cooldown: 0.07, mag: 30, pellets: 1, spread: 0.03, label: 'SMG' },
};

export const WEAPON_CRATES = [
  { x: -116, z: 174, weapon: 'shotgun', ammo: 12 },
  { x: 174, z: 58, weapon: 'smg', ammo: 60 },
  { x: -29, z: 232, weapon: 'shotgun', ammo: 12 },
];

export class Combat {
  constructor(scene, audio, city) {
    this.scene = scene;
    this.audio = audio;
    this.city = city;
    this.enemies = [];
    this.tracers = [];
    this.flash = null;
    this.flashTimer = 0;
    this.spark = null;
    this.sparkTimer = 0;
    this.pickups = []; // health + ammo crates scattered around the city
    this.weapon = 'pistol';
    this.weaponAmmo = { shotgun: 0, smg: 0 };
    this.weaponCrates = [];
    this._buildWeaponCrates();
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.9 });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), flashMat);
    this.flash.visible = false;
    this.scene.add(this.flash);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
    this.spark = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), sparkMat);
    this.spark.visible = false;
    this.scene.add(this.spark);
  }

  // Health (+40 HP, green cross) and ammo (+24 reserve, orange box) crates.
  // They respawn 45 seconds after being picked up, so the city restocks.
  spawnPickups() {
    const spots = [
      { x: 0, z: 87, kind: 'health' }, { x: -58, z: -29, kind: 'ammo' },
      { x: 116, z: 116, kind: 'health' }, { x: -174, z: 58, kind: 'ammo' },
      { x: 58, z: 203, kind: 'health' }, { x: -203, z: -87, kind: 'ammo' },
      { x: 174, z: -174, kind: 'health' }, { x: -29, z: -145, kind: 'ammo' },
    ];
    for (const s of spots) this._addPickup(s.x, s.z, s.kind);
  }

  _addPickup(x, z, kind) {
    const color = kind === 'health' ? 0x37d67a : 0xff9d2e;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
    );
    mesh.position.set(x, 1.0, z);
    this.scene.add(mesh);
    this.pickups.push({ x, z, kind, mesh, respawn: 0, phase: Math.random() * 6 });
  }

  updatePickups(dt, playerPos, state, onPickup) {
    for (const p of this.pickups) {
      if (p.respawn > 0) {
        p.respawn -= dt;
        if (p.respawn <= 0) p.mesh.visible = true;
        continue;
      }
      p.mesh.rotation.y += dt * 1.8;
      p.mesh.position.y = 1.0 + Math.sin(performance.now() / 400 + p.phase) * 0.2;
      if (dist2d(playerPos.x, playerPos.z, p.x, p.z) <= 3) {
        if (p.kind === 'health') state.health = Math.min(state.maxHealth, state.health + 40);
        else state.reserveAmmo += 24;
        p.mesh.visible = false;
        p.respawn = 45;
        if (onPickup) onPickup(p.kind);
      }
    }
  }

  spawnGang(x, z, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const e = {
        mesh: makePersonMesh(choice(GANG_SHIRTS), choice([0xe8b88a, 0xc98d5f, 0x8a5a3a])),
        x: x + rand(-4, 4), z: z + rand(-4, 4),
        heading: rand(0, Math.PI * 2),
        health: 100,
        state: 'alive',
        shootTimer: rand(0.6, 1.6),
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        strafeTimer: rand(1, 2.5),
        deadTimer: 0,
        walkPhase: rand(0, 6),
      };
      e.mesh.position.set(e.x, 0, e.z);
      this.scene.add(e.mesh);
      this.enemies.push(e);
      out.push(e);
    }
    return out;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  // Switch weapons (keys 1/2/3). Shotgun and SMG need ammo in the locker;
  // the pistol always works.
  setWeapon(name, state) {
    if (!WEAPONS[name]) return false;
    if (name !== 'pistol' && (this.weaponAmmo[name] || 0) <= 0) return false;
    this.weapon = name;
    if (state) state.weapon = name;
    return true;
  }

  // A gang shootout: muscle plus a banner, for turf wars and heist holdouts.
  spawnShootout(x, z, n) {
    const gang = this.spawnGang(x, z, n);
    for (const e of gang) e.shootTimer = Math.min(e.shootTimer, 0.5);
    return gang;
  }

  _buildWeaponCrates() {
    for (const c of WEAPON_CRATES) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.9, 1.3),
        new THREE.MeshLambertMaterial({ color: 0x2a5aff, emissive: 0x2a5aff, emissiveIntensity: 0.3 }),
      );
      mesh.position.set(c.x, 1.0, c.z);
      this.scene.add(mesh);
      this.weaponCrates.push({ ...c, mesh, taken: false, phase: Math.random() * 6 });
    }
  }

  // Walk over a crate to unlock its weapon and stock its ammo.
  updateWeaponCrates(dt, playerPos, state, onPickup) {
    for (const c of this.weaponCrates) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 1.5;
      c.mesh.position.y = 1.0 + Math.sin(performance.now() / 400 + c.phase) * 0.2;
      if (dist2d(playerPos.x, playerPos.z, c.x, c.z) <= 3) {
        c.taken = true;
        c.mesh.visible = false;
        this.weaponAmmo[c.weapon] = (this.weaponAmmo[c.weapon] || 0) + c.ammo;
        if (state) state.weaponAmmo[c.weapon] = this.weaponAmmo[c.weapon];
        if (onPickup) onPickup(WEAPONS[c.weapon].label + ' unlocked — +' + c.ammo + ' ammo');
      }
    }
  }

  // 2D ray: returns { hit: 'enemy'|'ped'|'car'|'wall'|null, point, ref, dist }.
  _ray(origin, dir, ctx) {
    const maxDist = 120;
    let bestDist = maxDist;
    let best = { hit: null, point: null, ref: null, dist: maxDist };
    // Buildings block: step along the ray.
    for (let d = 2; d < maxDist; d += 2) {
      const sx = origin.x + dir.x * d, sz = origin.z + dir.z * d;
      for (const c of this.city.colliders) {
        if (sx > c.minX - 0.3 && sx < c.maxX + 0.3 && sz > c.minZ - 0.3 && sz < c.maxZ + 0.3) {
          bestDist = d;
          best = { hit: 'wall', point: { x: sx, y: origin.y + dir.y * d, z: sz }, ref: null, dist: d };
          d = maxDist;
          break;
        }
      }
    }
    const testTarget = (tx, tz, radius, type, ref) => {
      const dx = tx - origin.x, dz = tz - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 0.5 || along > bestDist) return;
      const px = origin.x + dir.x * along, pz = origin.z + dir.z * along;
      const perp = dist2d(tx, tz, px, pz);
      if (perp < radius) {
        bestDist = along;
        best = { hit: type, point: { x: px, y: origin.y + dir.y * along, z: pz }, ref, dist: along };
      }
    };
    for (const e of this.enemies) {
      if (e.state !== 'alive') continue;
      testTarget(e.x, e.z, 1.1, 'enemy', e);
    }
    if (ctx.peds) {
      for (const p of ctx.peds) {
        if (p.state === 'down') continue;
        testTarget(p.x, p.z, 0.9, 'ped', p);
      }
    }
    if (ctx.cars) {
      for (const c of ctx.cars) {
        testTarget(c.x, c.z, 2.2, 'car', c);
      }
    }
    if (ctx.officers) {
      for (const o of ctx.officers) {
        testTarget(o.x, o.z, 0.9, 'officer', o);
      }
    }
    if (!best.hit) {
      best.point = { x: origin.x + dir.x * maxDist, y: Math.max(0.5, origin.y + dir.y * maxDist), z: origin.z + dir.z * maxDist };
    }
    return best;
  }

  shoot(origin, dir, ctx) {
    const spec = WEAPONS[this.weapon] || WEAPONS.pistol;
    // A shotgun fires five pellets with a spread; other guns fire one ray.
    let best = null;
    for (let i = 0; i < spec.pellets; i++) {
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * spec.spread * 2,
        (Math.random() - 0.5) * spec.spread,
        (Math.random() - 0.5) * spec.spread * 2,
      );
      const d = dir.clone().add(jitter).normalize();
      const res = this._ray(origin, d, ctx);
      if (!best || res.dist < best.dist) best = res;
      const mat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(origin.x, origin.y, origin.z),
        new THREE.Vector3(res.point.x, res.point.y, res.point.z),
      ]);
      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      this.tracers.push({ line, life: 0.09 });
    }
    const res = best;
    this.spark.position.set(res.point.x, res.point.y, res.point.z);
    this.spark.visible = true;
    this.sparkTimer = 0.08;
    this.audio.shot();
    if (res.hit === 'enemy' && res.ref) {
      // Each pellet lands: a point-blank shotgun burst is five hits.
      res.ref.health -= spec.damage * spec.pellets;
      if (res.ref.health <= 0) this._killEnemy(res.ref);
      return { ...res, killed: res.ref.health <= 0 };
    }
    if (res.hit === 'ped' && res.ref) {
      res.ref.state = 'down';
      res.ref.downTimer = 8;
      res.ref.vx = dir.x * 6; res.ref.vz = dir.z * 6;
      return res;
    }
    return res;
  }

  _killEnemy(e) {
    e.state = 'dead';
    e.deadTimer = 5;
    e.mesh.rotation.x = -Math.PI / 2 + 0.1;
    e.mesh.position.y = 0.3;
  }

  punch(playerPos, heading, ctx) {
    this.audio.punch();
    let hitAny = false;
    const tryHit = (tx, tz, ref, onHit) => {
      const d = dist2d(playerPos.x, playerPos.z, tx, tz);
      if (d > 2.4) return;
      const ang = Math.atan2(tx - playerPos.x, tz - playerPos.z);
      let diff = ang - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 1.1) return;
      onHit(ref);
      hitAny = true;
    };
    for (const e of this.enemies) {
      if (e.state !== 'alive') continue;
      tryHit(e.x, e.z, e, (ref) => {
        ref.health -= 30;
        ref.x += Math.sin(heading) * 1.6;
        ref.z += Math.cos(heading) * 1.6;
        if (ref.health <= 0) this._killEnemy(ref);
      });
    }
    if (ctx.peds) {
      for (const p of ctx.peds) {
        if (p.state === 'down') continue;
        tryHit(p.x, p.z, p, (ref) => {
          ref.state = 'down';
          ref.downTimer = 6;
          ref.vx = Math.sin(heading) * 5;
          ref.vz = Math.cos(heading) * 5;
        });
      }
    }
    return hitAny;
  }

  update(dt, playerPos, onPlayerHit) {
    // Enemy behaviour: strafe and shoot at the player.
    for (const e of [...this.enemies]) {
      if (e.state === 'dead') {
        e.deadTimer -= dt;
        if (e.deadTimer <= 0) {
          this.scene.remove(e.mesh);
          this.enemies = this.enemies.filter((x) => x !== e);
        }
        continue;
      }
      const d = dist2d(e.x, e.z, playerPos.x, playerPos.z);
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeDir *= -1;
        e.strafeTimer = rand(1, 2.5);
      }
      if (d > 26) {
        // Walk toward the player.
        const want = Math.atan2(playerPos.x - e.x, playerPos.z - e.z);
        e.heading = want;
        e.x += Math.sin(want) * 3.2 * dt;
        e.z += Math.cos(want) * 3.2 * dt;
      } else if (d > 6) {
        // Strafe.
        const want = Math.atan2(playerPos.x - e.x, playerPos.z - e.z) + Math.PI / 2 * e.strafeDir;
        e.x += Math.sin(want) * 1.6 * dt;
        e.z += Math.cos(want) * 1.6 * dt;
        e.heading = Math.atan2(playerPos.x - e.x, playerPos.z - e.z);
      } else {
        e.heading = Math.atan2(playerPos.x - e.x, playerPos.z - e.z);
      }
      const res = this.city.collideCircle(e.x, e.z, 0.5);
      e.x = res.x; e.z = res.z;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
      e.walkPhase += dt * 7;
      const swing = Math.sin(e.walkPhase) * 0.5;
      e.mesh.userData.legs[0].rotation.x = swing;
      e.mesh.userData.legs[1].rotation.x = -swing;
      // Shoot.
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 34 && d > 2) {
        e.shootTimer = rand(1.1, 2.1);
        this.audio.enemyShot();
        // Muzzle flash at the enemy.
        this.flash.position.set(e.x, 1.4, e.z);
        this.flash.visible = true;
        this.flashTimer = 0.06;
        // Hit chance falls with distance.
        const hitP = clamp(0.42 - d * 0.008, 0.08, 0.42);
        if (Math.random() < hitP && onPlayerHit) onPlayerHit(rand(6, 12));
      }
    }
    // Fade tracers and flashes.
    for (const t of [...this.tracers]) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers = this.tracers.filter((x) => x !== t);
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    if (this.sparkTimer > 0) {
      this.sparkTimer -= dt;
      if (this.sparkTimer <= 0) this.spark.visible = false;
    }
  }
}
