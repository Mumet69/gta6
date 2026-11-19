// main.js — DUSTLINE: the game loop and wiring. Builds the scene, moves the
// player on foot and by car, runs the camera, pickups, busted/wasted flow,
// the title screen, and the ?shot= modes the screenshots use. Exposes a
// window.__game API the playtest drives.

import * as THREE from '../vendor/three.module.min.js';
import { S, resetState, showMessage, setObjective } from './state.js';
import { makeRng, clamp, angleLerp, circleHitsBox, resolveCircleBox } from './utils.js';
import { buildCity, City, HALF } from './city.js';
import { traffic, parked, spawnTraffic, spawnParked, spawnPoliceCar, updatePlayerCar, updateTraffic, nearestStealable, enterCar, exitCar } from './vehicles.js';
import { people, footCops, spawnPedestrians, updatePeople, updateFootCops, makePersonMesh, panicNear } from './people.js';
import { initWanted, updateWanted, addHeat, clearPolice } from './wanted.js';
import { initCombat, tryPunch, tryShoot, givePistol, tickCombat } from './combat.js';
import { MISSIONS, initMissions, startMission, updateMissions, hitRivalAt, rivalsAlive } from './missions.js';
import { initHUD, updateHUD } from './hud.js';
import { initAudio, resumeAudio, setEngine, setSiren, playBusted, toggleMute } from './audio.js';
import { input, initInput, consumePress, endFrameInput } from './input.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '1', 10);
const SHOT = params.get('shot') || '';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

// --- renderer / scene / camera --------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 40, 80);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- world -----------------------------------------------------------------
buildCity(scene, SEED);
initWanted(SEED);
initCombat(scene);
initMissions(scene);
initHUD();
initInput(canvas);
const rng = makeRng(SEED * 31 + 2);

spawnTraffic(scene, 14, SEED);
spawnParked(scene, SEED);
spawnPedestrians(scene, 26, SEED);

// --- player mesh (on foot): red jacket, easy to spot ------------------------
const playerMesh = new THREE.Group();
{
  const jacket = new THREE.MeshStandardMaterial({ color: 0xa32e22, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.8 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), jeans);
  legs.position.y = 0.45; legs.castShadow = true;
  playerMesh.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.36), jacket);
  torso.position.y = 1.25; torso.castShadow = true;
  playerMesh.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.9; head.castShadow = true;
  playerMesh.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cap.position.y = 2.08;
  playerMesh.add(cap);
  // A simple gun in hand when the pistol is out (toggled by visibility).
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 1.15, 0.3);
  gun.name = 'gun';
  playerMesh.add(gun);
}
playerMesh.visible = false;
scene.add(playerMesh);

// --- pickups: health, ammo, cash -------------------------------------------
const pickups = [];
function makePickup(kind, x, z) {
  const g = new THREE.Group();
  let mesh;
  if (kind === 'health') {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2ecc40, emissiveIntensity: 0.9 }));
  } else if (kind === 'ammo') {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xaa8800, emissiveIntensity: 0.7 }));
  } else {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: 0x2ecc40, emissive: 0x1a7a2a, emissiveIntensity: 0.8 }));
  }
  mesh.castShadow = true;
  g.add(mesh);
  g.position.set(x, 1, z);
  scene.add(g);
  pickups.push({ kind, x, z, mesh: g, taken: false, timer: 0 });
}
{
  const spots = [
    ['health', City.landmarks.safehouse.x + 6, City.landmarks.safehouse.z - 6],
    ['ammo', City.landmarks.bank.x - 10, City.landmarks.bank.z + 4],
    ['cash', City.landmarks.diner.x + 8, City.landmarks.diner.z - 4],
    ['health', City.landmarks.tower.x - 8, City.landmarks.tower.z - 8],
    ['ammo', City.landmarks.gas.x + 6, City.landmarks.gas.z + 8],
    ['cash', -115, 60],
    ['health', 69, -100],
    ['ammo', -23, 120],
  ];
  for (const [kind, x, z] of spots) makePickup(kind, x, z);
}

function updatePickups(dt) {
  for (const p of pickups) {
    if (p.taken) {
      p.timer -= dt;
      if (p.timer <= 0) { p.taken = false; p.mesh.visible = true; }
      continue;
    }
    p.mesh.rotation.y += dt * 2;
    p.mesh.position.y = 1 + Math.sin(S.time * 3 + p.x) * 0.15;
    if (Math.hypot(S.px - p.x, S.pz - p.z) < 2.2) {
      p.taken = true;
      p.timer = 30;
      p.mesh.visible = false;
      if (p.kind === 'health') { S.health = Math.min(100, S.health + 30); showMessage('Health +30', 2); }
      if (p.kind === 'ammo') { S.ammo += 24; if (S.weapon === 'pistol' && S.mag === 0) { S.mag = Math.min(12, S.ammo); S.ammo -= S.mag; } showMessage('Ammo +24', 2); }
      if (p.kind === 'cash') { S.cash += 100; showMessage('Found $100', 2); }
    }
  }
}

// --- flow: start / restart / busted ----------------------------------------
const titleEl = document.getElementById('title');
const overEl = document.getElementById('gameover');
const overTitle = document.getElementById('over-title');
const overStats = document.getElementById('over-stats');

function placePlayerAtSpawn() {
  S.px = City.spawn.x;
  S.pz = City.spawn.z;
  S.heading = Math.PI;
  playerMesh.position.set(S.px, 0, S.pz);
  playerMesh.rotation.y = S.heading;
}

function startRun() {
  resetState(SEED);
  clearPolice(scene);
  placePlayerAtSpawn();
  playerMesh.visible = true;
  S.started = true;
  titleEl.style.display = 'none';
  overEl.style.display = 'none';
  initAudio();
  resumeAudio();
  showMessage('Rook Calloway — you owe Vera Kaine $5,000. Get to work.', 5);
  startMission(0);
  saveGame();
}

function restartRun() {
  const keptCash = Math.floor(S.cash * 0.9);
  const keptMission = S.mission;
  const keptDone = S.stats.missionsDone;
  resetState(SEED);
  S.cash = keptCash;
  S.stats.missionsDone = keptDone;
  clearPolice(scene);
  placePlayerAtSpawn();
  playerMesh.visible = true;
  S.started = true;
  overEl.style.display = 'none';
  showMessage('Back on your feet. The debt is still there.', 3);
  startMission(keptMission);
}

function showGameOver(kind) {
  S.over = true;
  playBusted();
  saveGame();
  overTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  overStats.textContent = 'Cash $' + S.cash.toLocaleString('en-US') +
    '  •  Missions ' + S.stats.missionsDone + '/4' +
    '  •  Cars stolen ' + S.stats.carsStolen +
    '  •  Cops down ' + S.stats.copsDown;
  overEl.style.display = 'flex';
}

// --- on-foot movement -------------------------------------------------------
function updateOnFoot(dt) {
  const speed = 6.2;
  let mx = 0, mz = 0;
  // Movement relative to the camera yaw.
  const yaw = camYaw();
  if (input.up) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
  if (input.down) { mx -= Math.sin(yaw); mz -= Math.cos(yaw); }
  if (input.left) { mx += Math.sin(yaw - Math.PI / 2); mz += Math.cos(yaw - Math.PI / 2); }
  if (input.right) { mx += Math.sin(yaw + Math.PI / 2); mz += Math.cos(yaw + Math.PI / 2); }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    S.px += mx * speed * dt;
    S.pz += mz * speed * dt;
    S.heading = Math.atan2(mx, mz);
    S.walkSpeed = speed;
    S.stats.distance += speed * dt;
  } else {
    S.walkSpeed = 0;
  }
  for (const b of City.colliders) {
    if (circleHitsBox(S.px, S.pz, 0.6, b)) {
      const fixed = resolveCircleBox(S.px, S.pz, 0.6, b);
      S.px = fixed.x; S.pz = fixed.z;
    }
  }
  const m = 560;
  S.px = clamp(S.px, -m, m);
  S.pz = clamp(S.pz, -m, m);
  playerMesh.position.set(S.px, 0, S.pz);
  playerMesh.rotation.y = S.heading;
  // Walk bob.
  const bob = S.walkSpeed > 0 ? Math.abs(Math.sin(S.time * 10)) * 0.06 : 0;
  playerMesh.position.y = bob;
  playerMesh.getObjectByName('gun').visible = S.weapon === 'pistol';
}

// --- camera -----------------------------------------------------------------
let camYawOffset = 0;
let camPitchOffset = 0;
const camPos = new THREE.Vector3(0, 40, 80);
const camLook = new THREE.Vector3();

function camYaw() {
  return S.heading + camYawOffset;
}

function updateCamera(dt) {
  // Mouse drag orbits the camera.
  camYawOffset -= input.mouseDX * 0.004;
  camPitchOffset = clamp(camPitchOffset + input.mouseDY * 0.003, -0.25, 0.5);
  const dist = S.car ? 11 : 7.5;
  const height = S.car ? 4.6 : 3.4;
  const yaw = camYaw();
  const tx = S.px, tz = S.pz;
  const wantX = tx - Math.sin(yaw) * dist;
  const wantZ = tz - Math.cos(yaw) * dist;
  const wantY = height + camPitchOffset * 8;
  const k = 1 - Math.exp(-8 * dt);
  camPos.x += (wantX - camPos.x) * k;
  camPos.y += (wantY - camPos.y) * k;
  camPos.z += (wantZ - camPos.z) * k;
  camLook.set(tx + Math.sin(yaw) * 4, 1.6, tz + Math.cos(yaw) * 4);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// --- main loop ---------------------------------------------------------------
let last = performance.now();
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (S.paused) { renderer.render(scene, camera); return; }
  S.time += dt;
  S.minute += dt;
  if (S.minute >= 60) { S.minute = 0; S.hour++; if (S.hour >= 24) { S.hour = 0; S.day++; } }
  if (S.messageTimer > 0) S.messageTimer -= dt;

  // Global keys.
  if (consumePress('Enter')) {
    if (!S.started) startRun();
    else if (S.over) restartRun();
  }
  if (consumePress('KeyP')) {
    if (S.started && !S.over) {
      S.paused = !S.paused;
      document.getElementById('paused').style.display = S.paused ? 'flex' : 'none';
    }
  }
  if (consumePress('KeyM')) toggleMute();
  if (consumePress('KeyR') && S.over) restartRun();
  if (consumePress('Digit1')) { S.weapon = 'fists'; }
  if (consumePress('Digit2') && S.mag + S.ammo > 0) { S.weapon = 'pistol'; }

  if (S.started && !S.over) {
    // Enter / steal a car.
    if (consumePress('KeyE')) {
      if (S.onFoot) {
        const car = nearestStealable(S.px, S.pz, 4);
        if (car) {
          const wasParked = parked.includes(car);
          enterCar(car);
          if (wasParked || traffic.includes(car)) addHeat(8, 'Car stolen');
          showMessage('Car stolen — watch the heat.', 2);
          playerMesh.visible = false;
        }
      }
    }
    // Exit the car.
    if (consumePress('KeyF') && S.car) {
      exitCar(scene);
      playerMesh.visible = true;
      playerMesh.position.set(S.px, 0, S.pz);
      playerMesh.rotation.y = S.heading;
    }
    // Punch on foot (Space), shoot on click (pistol).
    if (S.onFoot && consumePress('Space')) {
      tryPunch();
      hitRivalAt(S.px, S.pz, S.heading, 2.4, 1);
    }
    if (input.mouseDown && S.onFoot && S.weapon === 'pistol') {
      if (tryShoot()) hitRivalAt(S.px, S.pz, S.heading, 60, 1);
      input.mouseDown = false; // one shot per click
    }

    if (S.car) updatePlayerCar(dt, input);
    else updateOnFoot(dt);
    updateTraffic(dt, scene, rng);
    updatePeople(dt);
    updateFootCops(dt);
    updateWanted(dt, scene);
    updateMissions(dt);
    updatePickups(dt);
    tickCombat(dt);
    setEngine(S.car ? S.car.speed : 0, !!S.car);
    setSiren(S.wanted > 0);

    if (S.busted) { showGameOver('busted'); S.busted = false; }
    if (S.wasted) { showGameOver('wasted'); S.wasted = false; }
  } else if (!S.started) {
    // Title-screen orbit: slow cinematic pan over the city.
    const t = S.time * 0.05;
    camera.position.set(Math.sin(t) * 130, 55, Math.cos(t) * 130);
    camera.lookAt(0, 10, 0);
    updateTraffic(dt, scene, rng);
    updatePeople(dt);
  }

  updateCamera(dt);
  updateHUD();
  renderer.render(scene, camera);
  frames++;
  if (frames === 5) window.__shotReady = true;
  endFrameInput();
}

// --- title screen buttons ----------------------------------------------------
document.getElementById('btn-start').addEventListener('click', () => { initAudio(); resumeAudio(); startRun(); });
document.getElementById('btn-continue')?.addEventListener('click', () => {
  const save = loadGame();
  initAudio(); resumeAudio(); startRun();
  if (save) { S.cash = save.cash || 0; }
});
if (!hasSave()) {
  const b = document.getElementById('btn-continue');
  if (b) b.style.display = 'none';
}
document.getElementById('btn-restart')?.addEventListener('click', () => restartRun());

// --- ?shot= modes: deterministic staged scenes for screenshots ---------------
function setupShot() {
  if (!SHOT) return;
  initAudio();
  if (SHOT === 'start') {
    // Title screen over the city; do not start the run.
    return;
  }
  startRun();
  if (SHOT === 'drive') {
    // In a car, cruising down the main avenue.
    const car = nearestStealable(City.spawn.x, City.spawn.z, 400) || parked[0];
    if (car) {
      enterCar(car);
      playerMesh.visible = false;
      car.x = -23; car.z = -100; car.heading = 0; car.speed = 18;
      S.px = car.x; S.pz = car.z; S.heading = 0;
    }
    setObjective('Drive to the safehouse motel');
  } else if (SHOT === 'chase') {
    const car = parked[0];
    if (car) {
      enterCar(car);
      playerMesh.visible = false;
      car.x = 23; car.z = 40; car.heading = Math.PI; car.speed = 20;
      S.px = car.x; S.pz = car.z; S.heading = Math.PI;
    }
    S.heat = 58; S.wanted = 3; S.lastCrime = S.time;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const pc = spawnPoliceCar(scene, S.px + Math.sin(a) * 18, S.pz + Math.cos(a) * 18);
      pc.speed = 12;
    }
    S.mission = 3;
    setObjective('Lose the heat, then reach the safehouse');
  } else if (SHOT === 'mission') {
    // On foot at the bank, pistol out, mission 3 staged.
    givePistol(36);
    S.weapon = 'pistol';
    S.px = City.landmarks.bank.x;
    S.pz = City.landmarks.bank.z - 4;
    S.heading = Math.PI;
    playerMesh.position.set(S.px, 0, S.pz);
    playerMesh.rotation.y = S.heading;
    S.mission = 3;
    S.missionState = 'active';
    setObjective('Go to the Dustline Bank');
    // A couple of peds nearby for life.
    panicNear(S.px, S.pz, 0);
  }
}

// --- test / screenshot API ---------------------------------------------------
window.__game = {
  S, MISSIONS,
  start: startRun,
  restart: restartRun,
  teleport(x, z) { S.px = x; S.pz = z; if (S.car) { S.car.x = x; S.car.z = z; } playerMesh.position.set(x, 0, z); },
  enterNearestCar() {
    const car = nearestStealable(S.px, S.pz, 400);
    if (car) { enterCar(car); playerMesh.visible = false; return true; }
    return false;
  },
  givePistol(n) { givePistol(n || 24); },
  setWanted(n) { S.heat = [0, 15, 35, 55, 75, 92][n] || 0; S.wanted = n; S.lastCrime = S.time; },
  startMission(i) { startMission(i); },
  shoot() { const ok = tryShoot(); hitRivalAt(S.px, S.pz, S.heading, 60, 1); return ok; },
  punch() { const ok = tryPunch(); hitRivalAt(S.px, S.pz, S.heading, 2.4, 1); return ok; },
  get trafficCount() { return traffic.length; },
  get pedCount() { return people.length; },
  get policeCount() { return traffic.filter(c => c.kind === 'police').length; },
  get rivalsAlive() { return rivalsAlive(); },
};

setupShot();
requestAnimationFrame(frame);
