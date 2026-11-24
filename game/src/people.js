// people.js — pedestrians strolling the sidewalks, and mission enemies.
import { groundHeight } from './city.js';
import { pick, rand } from './util.js';

const SHIRTS = [0xff8fa3, 0x7fe7ff, 0xffd23f, 0x7dff9a, 0xb45cff, 0xffffff, 0xff6b35, 0x35f1ff];
const PANTS = [0x2b2f38, 0x4a3220, 0x355070, 0x6b4a2f, 0x222222];

export function buildPerson(shirt, pants) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: pick([0xf2c89b, 0xc98d5e, 0x8a5a3b, 0xf7d7b0]), roughness: 0.8 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.24),
    new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 }));
  legs.position.y = 0.43; legs.castShadow = true; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 }));
  torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.72; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, 1.4),
    new THREE.MeshStandardMaterial({ color: pick([0x1a1a1a, 0x4a3220, 0x8a6b3b, 0x666666]), roughness: 1 }));
  hair.position.y = 1.76; g.add(hair);
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  const armL = new THREE.Mesh(armGeo, skin); armL.position.set(-0.35, 1.2, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, skin); armR.position.set(0.35, 1.2, 0); g.add(armR);
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export function createPedestrians(scene, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildPerson(pick(SHIRTS), pick(PANTS));
    // stroll on sidewalks beside roads
    const road = pick([-126, -84, -42, 0, 42, 84, 126]);
    const along = rand(-150, 150);
    const side = Math.random() < 0.5;
    mesh.position.set(side ? road + 8 : rand(-140, 140), 0, side ? along : road + 8);
    mesh.rotation.y = rand(0, Math.PI * 2);
    scene.add(mesh);
    peds.push({
      mesh, speed: rand(0.8, 1.8), dir: rand(0, Math.PI * 2),
      turnT: rand(2, 8), panic: 0, walkPhase: rand(0, 6), alive: true,
    });
  }
  return peds;
}
export function updatePedestrians(peds, dt, dangerPos, dangerR) {
  for (const p of peds) {
    if (!p.alive) continue;
    p.turnT -= dt;
    let flee = false;
    if (dangerPos) {
      const d = Math.hypot(p.mesh.position.x - dangerPos.x, p.mesh.position.z - dangerPos.z);
      if (d < dangerR) {
        flee = true;
        p.dir = Math.atan2(p.mesh.position.x - dangerPos.x, p.mesh.position.z - dangerPos.z);
      }
    }
    if (p.turnT <= 0 && !flee) { p.dir = rand(0, Math.PI * 2); p.turnT = rand(3, 9); }
    const sp = flee ? p.speed * 3.2 : p.speed;
    p.mesh.position.x += Math.sin(p.dir) * sp * dt;
    p.mesh.position.z += Math.cos(p.dir) * sp * dt;
    p.mesh.position.x = Math.max(-165, Math.min(185, p.mesh.position.x));
    p.mesh.position.z = Math.max(-165, Math.min(165, p.mesh.position.z));
    // turn smoothly toward heading, swing arms
    let diff = p.dir - p.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.mesh.rotation.y += diff * Math.min(1, dt * 6);
    p.walkPhase += dt * sp * 4;
    const sw = Math.sin(p.walkPhase) * 0.5;
    p.mesh.userData.armL.rotation.x = sw;
    p.mesh.userData.armR.rotation.x = -sw;
  }
}
// A mission enemy: armed, hostile, drops cash when down.
export function spawnEnemy(scene, x, z) {
  const mesh = buildPerson(0x1a1a1a, 0x1a1a1a);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x9b2226, roughness: 0.7 }));
  vest.position.y = 1.2; mesh.add(vest);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, hp: 60, shootT: rand(1, 2), alive: true, speed: 2.2 };
}
export function updateEnemy(e, playerPos, dt, onShoot) {
  if (!e.alive) return;
  e.mesh.position.y = groundHeight(e.mesh.position.x, e.mesh.position.z);
  const dx = playerPos.x - e.mesh.position.x;
  const dz = playerPos.z - e.mesh.position.z;
  const d = Math.hypot(dx, dz);
  if (d > 26) {
    const dir = Math.atan2(dx, dz);
    e.mesh.position.x += Math.sin(dir) * e.speed * dt;
    e.mesh.position.z += Math.cos(dir) * e.speed * dt;
    e.mesh.rotation.y = dir;
  } else {
    e.mesh.rotation.y = Math.atan2(dx, dz);
    e.shootT -= dt;
    if (e.shootT <= 0) { e.shootT = rand(1.4, 2.4); onShoot(e); }
  }
}
