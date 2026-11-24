// main.js — VELVET BAY bootstrap, player controller, driving, camera,
// wanted + police, combat, missions wiring and the render loop.
import { buildCity, setTimeOfDay, clampToCity, groundHeight } from './city.js';
import { buildCar, createTraffic, updateTraffic, spawnPoliceCar, updatePoliceCar, CAR_MODELS } from './vehicles.js';
import { buildPerson, createPedestrians, updatePedestrians, spawnEnemy, updateEnemy } from './people.js';
import { createMissionManager, MISSIONS } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { applyShot } from './shots.js';
import { clamp, dist2d, lerp, pick, rand } from './util.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') ? parseInt(params.get('shot'), 10) : 0;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
const city = buildCity(scene);
const hud = createHud();
const audio = createAudio();

const G = {
  scene, camera, city, hud, audio,
  cash: 250, health: 100, armor: 0, wanted: 0,
  missionIndex: 0, completedMissions: 0,
  inCar: false, car: null, carSpeed: 0, carHealth: 100,
  clockMin: 18 * 60 + 42, paused: false, over: false, started: false,
  camYaw: Math.PI, camPitch: 0.32, keys: {},
  player: null, playerVelY: 0, playerGrounded: true,
  traffic: [], peds: [], police: [], enemies: [],
  wantedTimer: 0, crimeTimer: 0, bustTimer: 0, sirenTimer: 0,
  missions: null, heading: 0, shotMode: SHOT,
};
window.VB = G; // playtest handle

// ---------- player avatar ----------
function buildPlayerAvatar() {
  const g = buildPerson(0xff5da2, 0x22242c);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd23f }));
  cap.position.y = 1.95; g.add(cap);
  return g;
}
G.player = buildPlayerAvatar();
G.player.position.set(city.spawns.start.x, 0, city.spawns.start.z);
scene.add(G.player);

// ---------- world population ----------
G.traffic = createTraffic(scene, city.nodes, 16);
G.peds = createPedestrians(scene, 26);
const startCar = buildCar(CAR_MODELS[0]);
startCar.position.set(3, 0, 30); startCar.rotation.y = Math.PI;
scene.add(startCar);
G.traffic.push({ mesh: startCar, model: CAR_MODELS[0], speed: 0, dir: Math.PI, node: { x: 0, z: 42 }, target: null, kind: 'parked', userData: {} });
G.parked = G.traffic[G.traffic.length - 1];

// ---------- missions ----------
function onMissionEvent(kind, data) {
  if (kind === 'mission-start') {
    hud.card('MISSION ' + data.id + ' · ' + data.giver, data.title, data.brief, 'Reward $' + data.reward);
    hud.setMission(data.title, data.brief, null);
  } else if (kind === 'collect') {
    audio.pickup();
    hud.toast(`Package ${data.progress}/${data.count} collected`);
    removeCrateVisual();
  } else if (kind === 'mission-complete') {
    G.cash += data.reward;
    G.completedMissions++;
    G.missionIndex++;
    audio.pickup();
    hud.card('MISSION COMPLETE', data.title, data.complete, '+$' + data.reward + '  ·  Total $' + G.cash);
    hud.toast('+$' + data.reward + ' — mission complete!');
    writeSave(G);
    setTimeout(() => {
      if (G.missionIndex < MISSIONS.length) {
        G.missions.start(G.missionIndex);
        if (G.missionIndex === 2) spawnMissionEnemies();
        if (G.missionIndex === 3) spawnCrates();
      } else {
        document.getElementById('win-text').textContent =
          `All 5 missions done. $${G.cash} in your pocket, and the whole bay knows your name.`;
        document.getElementById('win').classList.remove('hidden');
        G.paused = true;
      }
    }, 3800);
  }
}
G.missions = createMissionManager(scene, onMissionEvent);

function spawnMissionEnemies() {
  const spots = [[200, 70], [216, 90], [224, 76], [206, 96]];
  for (const [x, z] of spots) G.enemies.push(spawnEnemy(scene, x, z));
  G.missions.setEnemies(G.enemies);
  hud.toast('Hostiles on the pier — take them all down!');
}
const crateMeshes = [];
function spawnCrates() {
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xaa7700, emissiveIntensity: 0.5 }));
    c.position.set(-146 + i * 8, 1.1, 132 + (i % 2) * 5);
    c.castShadow = true; scene.add(c); crateMeshes.push(c);
  }
}
function removeCrateVisual() {
  const c = crateMeshes.pop();
  if (c) scene.remove(c);
}

// ---------- wanted / police ----------
G.addWanted = function (n, why) {
  if (G.over) return;
  const before = G.wanted;
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.crimeTimer = 0;
  if (G.wanted > before) {
    hud.toast(why + '  ·  Wanted level ' + G.wanted + '★');
    audio.siren();
  }
  hud.setWanted(G.wanted);
};
function syncPolice(dt) {
  const want = G.wanted; // one cruiser per star, max 5
  while (G.police.length < want) {
    const a = rand(0, Math.PI * 2);
    const p = spawnPoliceCar(scene,
      clamp(G.player.position.x + Math.cos(a) * 55, -160, 160),
      clamp(G.player.position.z + Math.sin(a) * 55, -160, 160));
    G.police.push(p);
  }
  while (G.police.length > want) {
    const p = G.police.pop();
    scene.remove(p.mesh);
  }
  const target = G.inCar ? G.car.position : G.player.position;
  for (const c of G.police) {
    const d = updatePoliceCar(c, { x: target.x, z: target.z }, dt, city.colliders);
    // ram damage
    if (d < 4.5) {
      if (G.inCar) {
        G.carHealth -= 14 * dt;
        if (G.carHealth <= 0) explodeCar();
      } else {
        G.bustTimer += dt;
        if (G.bustTimer > 2.2) return busted();
      }
      damagePlayer(6 * dt, false);
    }
  }
  if (G.wanted > 0) {
    G.sirenTimer -= dt;
    if (G.sirenTimer <= 0) { audio.siren(); G.sirenTimer = 4; }
  }
  // wanted decays when quiet
  G.crimeTimer += dt;
  if (G.wanted > 0 && G.crimeTimer > 25) {
    G.wantedTimer += dt;
    if (G.wantedTimer > 12) { G.wanted--; G.wantedTimer = 0; hud.setWanted(G.wanted); }
  } else G.wantedTimer = 0;
}
function explodeCar() {
  if (!G.car) return;
  audio.crash();
  hud.toast('Your ride is wrecked!');
  const boom = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.9 }));
  boom.position.copy(G.car.position); boom.position.y = 1.5; scene.add(boom);
  setTimeout(() => scene.remove(boom), 500);
  scene.remove(G.car);
  G.traffic = G.traffic.filter((t) => t.mesh !== G.car);
  exitCar(true);
  damagePlayer(25, true);
}
function damagePlayer(amount, flash) {
  if (G.over) return;
  G.health -= amount;
  if (flash) hud.damageFlash();
  if (G.health <= 0) { G.health = 0; wasted(); }
}
function busted() {
  if (G.over) return;
  G.over = true; audio.busted();
  G.cash = Math.max(0, G.cash - 200);
  document.getElementById('end-title').textContent = 'BUSTED';
  document.getElementById('end-text').textContent =
    'The VBPD caught up with you. $200 bail, and the heat is off — for now.';
  document.getElementById('end').classList.remove('hidden');
  writeSave(G);
}
function wasted() {
  if (G.over) return;
  G.over = true; audio.busted();
  G.cash = Math.max(0, G.cash - 150);
  document.getElementById('end-title').textContent = 'WASTED';
  document.getElementById('end-text').textContent =
    'You flatlined on the streets of Velvet Bay. The hospital patched you up — $150.';
  document.getElementById('end').classList.remove('hidden');
  writeSave(G);
}
function respawn() {
  G.over = false; G.health = 100; G.armor = 0; G.wanted = 0; G.bustTimer = 0;
  hud.setWanted(0);
  if (G.inCar) exitCar(true);
  G.player.position.set(-20, 0, -34);
  document.getElementById('end').classList.add('hidden');
  hud.toast('Back on your feet. Stay sharp.');
}

// ---------- collision ----------
function resolveCircle(pos, radius) {
  for (const c of city.colliders) {
    const nx = clamp(pos.x, c.x0, c.x1), nz = clamp(pos.z, c.z0, c.z1);
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius; pos.z = nz + (dz / d) * radius;
        return true;
      }
      pos.x = c.x1 + radius; // inside: push out east
      return true;
    }
  }
  return false;
}

// ---------- enter / exit cars ----------
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const t of G.traffic) {
    const d = dist2d(G.player.position.x, G.player.position.z, t.mesh.position.x, t.mesh.position.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function enterCar(t) {
  G.inCar = true; G.car = t.mesh; G.carSpeed = 0; G.carHealth = 100;
  G.traffic = G.traffic.filter((x) => x !== t);
  G.player.visible = false;
  G.camYaw = t.mesh.rotation.y;
  audio.unlock();
  if (t.kind === 'traffic') {
    G.addWanted(1, 'Car stolen!');
    hud.toast('You jacked a ' + t.model.name + '!');
  } else {
    hud.toast('Your ' + t.model.name + ' — let\'s roll.');
  }
  hud.setSpeed(0, t.model.name);
}
function exitCar(force) {
  if (!G.car) return;
  G.inCar = false;
  const m = G.car.userData.model;
  G.player.visible = true;
  G.player.position.set(G.car.position.x + 2.5, 0, G.car.position.z);
  G.player.rotation.y = G.car.rotation.y;
  // leave the car parked in the world as traffic
  const node = { x: Math.round(G.car.position.x / 42) * 42, z: Math.round(G.car.position.z / 42) * 42 };
  G.traffic.push({ mesh: G.car, model: m, speed: 0, dir: G.car.rotation.y, node, target: null, kind: 'parked', userData: {} });
  G.car = null; G.carSpeed = 0;
  hud.hideSpeed();
  audio.setEngine(0, false);
}

// ---------- combat ----------
const raycaster = new THREE.Raycaster();
function shoot() {
  if (G.paused || G.over || !G.started) return;
  audio.shot();
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const targets = [];
  for (const p of G.peds) if (p.alive) targets.push({ mesh: p.mesh, kind: 'ped', ref: p });
  for (const e of G.enemies) if (e.alive) targets.push({ mesh: e.mesh, kind: 'enemy', ref: e });
  for (const c of G.police) targets.push({ mesh: c.mesh, kind: 'police', ref: c });
  const hits = raycaster.intersectObjects(targets.map((t) => t.mesh), true);
  // tracer
  const end = hits.length ? hits[0].point : raycaster.ray.at(60, new THREE.Vector3());
  const start = camera.position.clone();
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([start, end]),
    new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  scene.add(line);
  setTimeout(() => scene.remove(line), 70);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj.parent && obj.parent !== scene) obj = obj.parent;
  const t = targets.find((x) => x.mesh === obj);
  if (!t) return;
  if (t.kind === 'ped') {
    t.ref.alive = false;
    t.ref.mesh.rotation.x = -Math.PI / 2; t.ref.mesh.position.y = 0.3;
    G.addWanted(1, 'Pedestrian down!');
  } else if (t.kind === 'enemy') {
    t.ref.hp -= 34;
    hud.damageFlash();
    if (t.ref.hp <= 0) {
      t.ref.alive = false;
      t.ref.mesh.rotation.x = -Math.PI / 2; t.ref.mesh.position.y = 0.3;
      G.cash += 50; hud.toast('+$50 — hostile down');
    }
  } else if (t.kind === 'police') {
    G.addWanted(1, 'You shot a cop!');
  }
}
function punch() {
  if (G.paused || G.over || !G.started || G.inCar) return;
  audio.punch();
  const reach = 2.4;
  for (const p of G.peds) {
    if (!p.alive) continue;
    if (dist2d(G.player.position.x, G.player.position.z, p.mesh.position.x, p.mesh.position.z) < reach) {
      p.alive = false; p.mesh.rotation.x = -Math.PI / 2; p.mesh.position.y = 0.3;
      G.addWanted(1, 'Assault!');
      return;
    }
  }
  for (const e of G.enemies) {
    if (!e.alive) continue;
    if (dist2d(G.player.position.x, G.player.position.z, e.mesh.position.x, e.mesh.position.z) < reach) {
      e.hp -= 30;
      if (e.hp <= 0) { e.alive = false; e.mesh.rotation.x = -Math.PI / 2; G.cash += 50; }
      return;
    }
  }
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (e.code === 'KeyE' && G.started && !G.paused && !G.over) {
    if (G.inCar) exitCar();
    else { const t = nearestCar(4.5); if (t) enterCar(t); }
  }
  if (e.code === 'KeyF') punch();
  if (e.code === 'KeyR' && G.started) hud.setStation(audio.nextStation());
  if (e.code === 'KeyM') audio.setMuted(!audio.muted);
  if (e.code === 'KeyP' && G.started && !G.over) togglePause();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { G.keys[e.code] = false; });
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; audio.unlock(); });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  G.camYaw -= (e.clientX - lastX) * 0.005;
  G.camPitch = clamp(G.camPitch + (e.clientY - lastY) * 0.004, -0.15, 0.9);
  lastX = e.clientX; lastY = e.clientY;
});
renderer.domElement.addEventListener('click', () => { if (G.started && !G.inCar) shoot(); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- menu / pause ----------
function togglePause() {
  G.paused = !G.paused;
  document.getElementById('pause').classList.toggle('hidden', !G.paused);
}
document.getElementById('play-btn').addEventListener('click', () => startGame(false));
document.getElementById('continue-btn').addEventListener('click', () => startGame(true));
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('restart-btn').addEventListener('click', () => {
  clearSave(); location.reload();
});
document.getElementById('end-btn').addEventListener('click', respawn);
document.getElementById('win-btn').addEventListener('click', () => {
  document.getElementById('win').classList.add('hidden');
  G.paused = false;
  hud.toast('Free roam — the bay is yours.');
});
function startGame(continued) {
  audio.unlock();
  const save = continued ? loadSave() : null;
  if (save) {
    G.cash = save.cash; G.missionIndex = save.mission;
    G.completedMissions = save.completed || 0;
  }
  G.started = true;
  hud.show();
  document.getElementById('menu').classList.add('hidden');
  hud.setCash(G.cash); hud.setHealth(G.health, G.armor); hud.setWanted(0);
  hud.setStation(audio.stationName());
  G.missions.start(G.missionIndex);
  if (G.missionIndex === 2) spawnMissionEnemies();
  if (G.missionIndex === 3) spawnCrates();
  hud.toast(continued ? 'Welcome back to Velvet Bay.' : 'Welcome to Velvet Bay. Mission 1 is live.');
}

// ---------- per-frame updates ----------
function updatePlayer(dt) {
  const k = G.keys;
  const sprint = k.ShiftLeft || k.ShiftRight;
  const speed = sprint ? 9 : 5.2;
  let mx = 0, mz = 0;
  if (k.KeyW || k.ArrowUp) mz += 1;
  if (k.KeyS || k.ArrowDown) mz -= 1;
  if (k.KeyA || k.ArrowLeft) mx -= 1;
  if (k.KeyD || k.ArrowRight) mx += 1;
  const len = Math.hypot(mx, mz) || 1;
  mx /= len; mz /= len;
  const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
  const vx = (mx * cos + mz * sin) * speed;
  const vz = (-mx * sin + mz * cos) * speed;
  G.player.position.x += vx * dt;
  G.player.position.z += vz * dt;
  if (mx || mz) {
    const targetYaw = Math.atan2(vx, vz);
    let diff = targetYaw - G.player.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.player.rotation.y += diff * Math.min(1, dt * 10);
    G.heading = G.player.rotation.y;
    // walk bob
    G.player.position.y = groundHeight(G.player.position.x, G.player.position.z) + Math.abs(Math.sin(performance.now() / 130)) * 0.06;
  }
  // jump (ground level follows the pier deck)
  const gy = groundHeight(G.player.position.x, G.player.position.z);
  if (k.Space && G.playerGrounded) { G.playerVelY = 6.5; G.playerGrounded = false; }
  if (!G.playerGrounded) {
    G.playerVelY -= 20 * dt;
    G.player.position.y += G.playerVelY * dt;
    if (G.player.position.y <= gy) { G.player.position.y = gy; G.playerGrounded = true; }
  } else if (G.player.position.y < gy) {
    G.player.position.y = gy; // stepped up onto the pier
  } else if (G.player.position.y > gy + 0.05 && !mx && !mz) {
    G.playerGrounded = false; G.playerVelY = 0; // stepped off the pier: fall
  }
  resolveCircle(G.player.position, 0.7);
  const c = clampToCity(G.player.position.x, G.player.position.z);
  G.player.position.x = c.x; G.player.position.z = c.z;
}
function updateCar(dt) {
  const k = G.keys;
  const model = G.car.userData.model;
  const maxSpeed = model.top;
  let throttle = 0;
  if (k.KeyW || k.ArrowUp) throttle = 1;
  if (k.KeyS || k.ArrowDown) throttle = -0.7;
  G.carSpeed += throttle * model.accel * dt;
  G.carSpeed -= G.carSpeed * 0.55 * dt; // drag
  if (!throttle) G.carSpeed -= Math.sign(G.carSpeed) * 6 * dt;
  if (Math.abs(G.carSpeed) < 0.2 && !throttle) G.carSpeed = 0;
  G.carSpeed = clamp(G.carSpeed, -14, maxSpeed);
  const steer = ((k.KeyA || k.ArrowLeft) ? 1 : 0) - ((k.KeyD || k.ArrowRight) ? 1 : 0);
  const steerAmt = steer * model.grip * clamp(Math.abs(G.carSpeed) / 12, 0, 1) * Math.sign(G.carSpeed || 1);
  G.car.rotation.y += steerAmt * dt * 0.9;
  const before = { x: G.car.position.x, z: G.car.position.z };
  G.car.position.x += Math.sin(G.car.rotation.y) * G.carSpeed * dt;
  G.car.position.z += Math.cos(G.car.rotation.y) * G.carSpeed * dt;
  if (resolveCircle(G.car.position, 2.1)) {
    if (Math.abs(G.carSpeed) > 8) { audio.crash(); hud.damageFlash(); damagePlayer(4, false); }
    G.carSpeed *= -0.25;
  }
  // hit pedestrians?
  for (const p of G.peds) {
    if (!p.alive) continue;
    if (dist2d(G.car.position.x, G.car.position.z, p.mesh.position.x, p.mesh.position.z) < 2.2 && Math.abs(G.carSpeed) > 6) {
      p.alive = false; p.mesh.rotation.x = -Math.PI / 2; p.mesh.position.y = 0.3;
      G.addWanted(1, 'You ran someone over!');
      audio.crash();
    }
  }
  // ram traffic
  for (const t of G.traffic) {
    if (dist2d(G.car.position.x, G.car.position.z, t.mesh.position.x, t.mesh.position.z) < 4.4) {
      G.carSpeed *= 0.6;
      t.mesh.position.x += Math.sin(G.car.rotation.y) * 2;
      t.mesh.position.z += Math.cos(G.car.rotation.y) * 2;
    }
  }
  const c = clampToCity(G.car.position.x, G.car.position.z);
  G.car.position.x = c.x; G.car.position.z = c.z;
  for (const w of G.car.userData.wheels) w.rotation.x += G.carSpeed * dt * 2;
  G.heading = G.car.rotation.y;
  hud.setSpeed(Math.abs(G.carSpeed) * 3.2, model.name);
  audio.setEngine(Math.abs(G.carSpeed) / maxSpeed, true);
}
function updateCamera(dt) {
  const target = G.inCar ? G.car.position : G.player.position;
  const dist = G.inCar ? 11 : 8;
  const height = 3.2 + G.camPitch * 5;
  const yaw = G.inCar ? G.car.rotation.y : G.camYaw;
  const tx = target.x - Math.sin(yaw) * dist;
  const tz = target.z - Math.cos(yaw) * dist;
  camera.position.x = lerp(camera.position.x, tx, Math.min(1, dt * 6));
  camera.position.z = lerp(camera.position.z, tz, Math.min(1, dt * 6));
  camera.position.y = lerp(camera.position.y, target.y + height, Math.min(1, dt * 6));
  camera.lookAt(target.x, target.y + 1.6, target.z);
}
// Snap the chase camera into place at once (screenshot staging: the
// software renderer runs few frames, so the lerp would not converge).
G.snapCamera = function () {
  const target = G.inCar ? G.car.position : G.player.position;
  const dist = G.inCar ? 11 : 8;
  const height = 3.2 + G.camPitch * 5;
  const yaw = G.inCar ? G.car.rotation.y : G.camYaw;
  camera.position.set(
    target.x - Math.sin(yaw) * dist,
    target.y + height,
    target.z - Math.cos(yaw) * dist);
  camera.lookAt(target.x, target.y + 1.6, target.z);
};

// ---------- main loop ----------
const clock = new THREE.Clock();
let hudTimer = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!G.paused) {
    G.clockMin += dt * 0.6; // a game day in ~40 min
    if (G.started && !G.over) {
      if (G.inCar) updateCar(dt); else updatePlayer(dt);
      const danger = (G.inCar && Math.abs(G.carSpeed) > 5) ? G.car.position : null;
      updatePedestrians(G.peds, dt, danger, 12);
      updateTraffic(G.traffic, city.nodes, dt, G.inCar ? G.car.position : G.player.position, G.traffic);
      for (const e of G.enemies) updateEnemy(e, G.player.position, dt, (en) => {
        if (Math.random() < 0.6) { damagePlayer(7, true); }
      });
      syncPolice(dt);
      G.missions.update(dt, G.inCar ? G.car.position : G.player.position, G.inCar, G.wanted);
      updateCamera(dt);
    }
    // ambient animation: ferris wheel + waves
    scene.traverse((o) => {
      if (o.userData.ferris) o.rotation.z += dt * 0.25;
      if (o.userData.wave !== undefined) o.position.x = 230 + o.userData.wave * 9 + Math.sin(performance.now() / 900 + o.userData.wave) * 2;
    });
    hudTimer += dt;
    if (hudTimer > 0.25 && G.started) {
      hudTimer = 0;
      hud.setCash(G.cash);
      hud.setHealth(G.health, G.armor);
      hud.setClock(G.clockMin);
      const m = G.missions.active;
      if (m) {
        hud.setMission(m.title, m.brief, G.missions.distanceTo(G.inCar ? G.car.position : G.player.position));
      } else if (G.missions.done || G.missionIndex >= MISSIONS.length) {
        hud.setMission('FREE ROAM', 'Velvet Bay is yours. Steal cars, dodge the law, live large.', null);
      }
      const pos = G.inCar ? G.car.position : G.player.position;
      hud.drawMinimap(pos.x, pos.z, G.heading, G.traffic, G.police, G.peds, G.missions.target(), G.enemies);
    }
  }
  renderer.render(scene, camera);
}

// ---------- boot ----------
(function boot() {
  const save = loadSave();
  if (save && save.mission > 0) {
    const btn = document.getElementById('continue-btn');
    btn.classList.remove('hidden');
    document.getElementById('continue-label').textContent =
      `MISSION ${save.mission + 1} · $${save.cash}`;
    document.getElementById('menu-stats').textContent =
      `SAVE FOUND · MISSION ${save.mission + 1} OF 5 · $${save.cash}`;
  }
  camera.position.set(6, 6, 44);
  if (SHOT) {
    // screenshot staging: skip the menu, auto-start, stage the scene
    startGame(false);
    applyShot(G, SHOT);
    window.__shotReady = false;
    setTimeout(() => { window.__shotReady = true; }, 1200);
  }
  loop();
})();
