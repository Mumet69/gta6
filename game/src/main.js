// main.js — NEON HARBOR: game loop, player controller, camera, pickups,
// rivals, busted/wasted, and the screenshot scene setups.
// The player is Jax Moreno, a getaway driver in Neon Harbor who owes Vera
// Kaine's crew $5,000. Run jobs, steal cars, dodge the Harbor PD.
import * as THREE from 'three';
import { G, resetRunState } from './state.js';
import { makeRng, clamp, dist2d, angleLerp, TAU } from './utils.js';
import { buildCity, BLOCK, HALF, BEACH_X } from './city.js';
import { spawnTraffic, driveCar, updateTraffic, nearestCar, makeCarMesh } from './vehicles.js';
import { spawnPeds, updatePeds, updateCops, makePersonMesh, spawnCop } from './people.js';
import { addHeat, setWanted, updateWanted, updatePoliceChase } from './wanted.js';
import { firePistol, punch, reload, updateBullets, hurtPlayer, spawnBurst } from './combat.js';
import { MISSIONS, startMission, updateMissions, missionMarkerPos } from './missions.js';
import { bindHud, updateHud, showMessage, showScreen } from './hud.js';
import * as audio from './audio.js';
import { initInput, readMoveInput, consumeLook, resetLook, lockPointer, keys } from './input.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 1);
const SHOT = params.get('shot') || '';

let rng = makeRng(SEED);
let playerMesh = null;
let playerVy = 0;
let onGround = true;
let camYaw = 0;
let camMode = 0; // 0 close follow, 1 far follow
let sirenTimer = 0;
let missionChainTimer = 0;
let bustedTimer = 0;
let hurtCooldown = 0;
let markerMesh = null;
let dangerPos = null;

function makePlayer() {
  const mesh = makePersonMesh(0x2a5a8a, 0x2a2a2a, false);
  mesh.position.set(BLOCK / 2, 0, BLOCK / 2 + 30);
  return {
    mesh,
    pos: mesh.position,
    heading: 0,
    speed: 0,
    inCar: false,
    vy: 0,
  };
}

function makePickupMesh(kind) {
  const color = kind === 'health' ? 0x3aff6a : kind === 'ammo' ? 0xd8b83a : 0x3ac2ff;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
  );
  return m;
}

function spawnPickups(scene, seed) {
  const r = makeRng(seed + 55);
  const kinds = ['health', 'ammo', 'cash', 'health', 'ammo', 'cash', 'health', 'ammo'];
  for (const kind of kinds) {
    const x = r.range(-HALF * BLOCK, HALF * BLOCK);
    const z = r.range(-HALF * BLOCK, HALF * BLOCK);
    const mesh = makePickupMesh(kind);
    mesh.position.set(x, 1, z);
    scene.add(mesh);
    G.pickups.push({ mesh, pos: mesh.position, kind, spin: r.range(0, TAU) });
  }
}

function makeMarker() {
  const geo = new THREE.CylinderGeometry(3.2, 3.2, 0.3, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe93a, transparent: true, opacity: 0.55 });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.2;
  m.visible = false;
  G.scene.add(m);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 2.2, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe93a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  );
  beam.position.y = 20;
  m.add(beam);
  return m;
}

function init() {
  G.seed = SEED;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('game').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  G.renderer = renderer; G.scene = scene; G.camera = camera;

  buildCity(scene, SEED);
  G.player = makePlayer();
  scene.add(G.player.mesh);
  G.cars = spawnTraffic(scene, SEED, 26);
  G.peds = spawnPeds(scene, SEED, 30);
  spawnPickups(scene, SEED);
  markerMesh = makeMarker();

  bindHud();
  audio.initAudio();
  initInput({
    onMouseDown: (x, y) => {
      if (G.mode !== 'playing') return;
      lockPointer(renderer.domElement);
      if (G.weapon === 'pistol') shootFromCamera();
      else doPunch();
    },
    onKey: (code, down) => {
      if (!down) return;
      if (code === 'KeyE' && G.mode === 'playing') toggleCar();
      if (code === 'KeyF' && G.mode === 'playing') doPunch();
      if (code === 'Digit1' && G.mode === 'playing') { G.weapon = 'fists'; }
      if (code === 'Digit2' && G.mode === 'playing') { G.weapon = 'pistol'; }
      if (code === 'KeyR' && G.mode === 'playing') { reload(); audio.playReload(); }
      if (code === 'KeyM') {
        if (G.mode === 'playing' && !G.mission && G.missionIndex < MISSIONS.length) {
          startMission(G.missionIndex);
        } else { G.muted = !G.muted; }
      }
      if (code === 'KeyC' && G.mode === 'playing') camMode = (camMode + 1) % 2;
      if (code === 'KeyP') togglePause();
    },
  });

  // Buttons.
  document.getElementById('btn-new').addEventListener('click', () => newGame(false));
  document.getElementById('btn-continue').addEventListener('click', () => newGame(true));
  document.getElementById('btn-resume').addEventListener('click', () => togglePause());
  document.getElementById('btn-save').addEventListener('click', () => {
    if (saveGame()) showMessage('Game saved.');
  });
  document.getElementById('btn-quit').addEventListener('click', () => { saveGame(); toTitle(); });
  document.getElementById('btn-retry-busted').addEventListener('click', () => respawnAfterBusted());
  document.getElementById('btn-retry-wasted').addEventListener('click', () => respawnAfterWasted());
  if (!hasSave()) document.getElementById('btn-continue').style.display = 'none';

  // Wire the cross-module callbacks.
  G.onWantedUp = (stars) => {
    showMessage(stars >= 3 ? 'The whole Harbor PD is after you!' : 'Wanted level up!');
    audio.playSirenBlip();
  };
  G.onRam = (car) => {
    if (hurtCooldown > 0) return;
    hurtCooldown = 1;
    hurtPlayer(8, 'rammed by police');
    audio.playHurt();
    showMessage('Police rammed you!');
  };
  G.onShoot = () => audio.playShoot();
  G.onEmptyClick = () => audio.playEmpty();
  G.onReload = () => audio.playReload();
  G.onPunchHit = () => { audio.playPunch(); };
  G.onPunchMiss = () => { audio.playPunch(); };
  G.onHurt = () => audio.playHurt();
  G.onWasted = () => { showScreen('screen-wasted'); audio.playBusted(); };
  G.onCash = (n) => { audio.playCash(); showMessage(`+$${n}`); };
  G.onMissionStart = (def) => { audio.playMission(); showMessage(`${def.title}: ${def.brief}`, 5); };
  G.onMissionStep = (text) => { showMessage(text, 4); };
  G.onMissionComplete = (def, reward) => {
    audio.playCash();
    showMessage(`${def.title} complete! +$${reward}`, 4);
    saveGame();
    missionChainTimer = 4;
  };
  G.onMissionFail = (def, why) => { showMessage(`${def.title} failed — ${why} Try again (M).`, 5); };
  G.onMissionChain = () => { missionChainTimer = 4; };
  G.setWantedExternal = (n) => setWanted(n);
  G.spawnRivalsExternal = (n) => spawnRivals(n);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Screenshot scene setups (deterministic, driven by ?shot=).
  if (SHOT === 'title') {
    showScreen('screen-title');
    G.mode = 'title';
  } else if (SHOT === 'drive' || SHOT === 'chase' || SHOT === 'mission') {
    newGame(false);
    setupShot(SHOT);
  } else {
    showScreen('screen-title');
    G.mode = 'title';
  }

  // Debug / playtest hook.
  window.__game = {
    G,
    teleport(x, z) { G.player.pos.set(x, 0, z); if (G.playerCar) { G.playerCar.pos.set(x, 0, z); } },
    startMission(i) { return startMission(i); },
    setWanted(n) { setWanted(n); },
    spawnRivals(n) { spawnRivals(n); },
    newGame,
  };

  renderer.setAnimationLoop(tick);
  audio.startMusic();
}

function setupShot(shot) {
  if (shot === 'drive') {
    // Put Jax in a car on a main road, mid-drive.
    const car = nearestCar({ x: BLOCK / 2, z: BLOCK / 2 }, 200) || G.cars[0];
    enterCar(car, true);
    G.playerCar.pos.set(0, 0, 88);
    G.playerCar.heading = Math.PI;
    G.playerCar.speed = 18;
    camYaw = Math.PI;
  } else if (shot === 'chase') {
    const car = nearestCar({ x: BLOCK / 2, z: BLOCK / 2 }, 200) || G.cars[0];
    enterCar(car, true);
    G.playerCar.pos.set(-44, 0, 44);
    G.playerCar.heading = Math.PI / 2;
    G.playerCar.speed = 22;
    setWanted(3);
    updateWanted(0.01, rng);
    for (const pc of G.policeCars) {
      pc.pos.set(G.player.pos.x - 18, 0, G.player.pos.z + 12);
      pc.heading = Math.PI / 2;
      pc.speed = 24;
    }
    startMission(3);
    camYaw = Math.PI / 2;
  } else if (shot === 'mission') {
    // On foot on the road south of the bank, pistol drawn, mission 4 active —
    // the player, the Harbor Bank and the mission objective all in frame.
    startMission(3);
    G.player.pos.set(22, 0, -88);
    G.player.heading = 0;
    G.weapon = 'pistol';
    camYaw = 0;
  }
}

function newGame(fromSave) {
  resetRunState();
  // Clear police/cops/pickups left from a previous run.
  for (const car of [...G.policeCars]) {
    const i = G.cars.indexOf(car);
    if (i >= 0) G.cars.splice(i, 1);
    G.scene.remove(car.mesh);
  }
  G.policeCars.length = 0;
  for (const cop of [...G.cops]) G.scene.remove(cop.mesh);
  G.cops.length = 0;
  G.player.inCar = false;
  G.playerCar = null;
  G.player.pos.set(BLOCK / 2, 0, BLOCK / 2 + 30);
  G.player.heading = 0;
  camYaw = 0;
  resetLook();
  if (fromSave) {
    const data = loadSave();
    if (data) applySave(data);
  }
  G.mode = 'playing';
  showScreen(null);
  if (G.missionIndex < MISSIONS.length) startMission(G.missionIndex);
  else showMessage('Welcome back to Neon Harbor. Free roam — the city is yours.');
  audio.initAudio();
}

function toTitle() {
  G.mode = 'title';
  showScreen('screen-title');
  document.getElementById('btn-continue').style.display = hasSave() ? 'inline-block' : 'none';
}

function togglePause() {
  if (G.mode === 'playing') { G.mode = 'paused'; showScreen('screen-pause'); }
  else if (G.mode === 'paused') { G.mode = 'playing'; showScreen(null); }
}

function respawnAfterBusted() {
  const lost = Math.min(G.cash, 200);
  G.cash -= lost;
  G.wanted = 0; G.heat = 0;
  G.player.inCar = false; G.playerCar = null;
  const lm = G.city.landmarks.safehouse;
  G.player.pos.set(lm.pos.x + 14, 0, lm.pos.z);
  G.health = G.maxHealth;
  G.mode = 'playing';
  showScreen(null);
  showMessage(`Busted! The PD took $${lost}. Lay low.`, 4);
}

function respawnAfterWasted() {
  const lost = Math.min(G.cash, 300);
  G.cash -= lost;
  G.wanted = 0; G.heat = 0;
  G.player.inCar = false; G.playerCar = null;
  const lm = G.city.landmarks.hospital;
  G.player.pos.set(lm.pos.x + 14, 0, lm.pos.z);
  G.health = G.maxHealth;
  G.mode = 'playing';
  showScreen(null);
  showMessage(`You woke up at the hospital. -$${lost}.`, 4);
}

function toggleCar() {
  if (G.player.inCar) { exitCar(); return; }
  const car = nearestCar(G.player.pos, 4.5);
  if (car) enterCar(car, false);
}

function enterCar(car, quiet) {
  car.parked = false;
  G.player.inCar = true;
  G.playerCar = car;
  G.player.mesh.visible = false;
  if (!quiet) {
    G.carsStolen += 1;
    addHeat(8, 'car theft');
    showMessage(`Stole a ${car.name}.`);
  }
}

function exitCar() {
  const car = G.playerCar;
  if (!car) return;
  car.speed = 0;
  G.player.inCar = false;
  G.playerCar = null;
  G.player.mesh.visible = true;
  G.player.pos.set(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 2.4, 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.4);
  G.player.heading = car.heading;
}

function shootFromCamera() {
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const origin = G.player.pos.clone();
  origin.y = 1.5;
  firePistol(origin, dir);
}

function doPunch() {
  G.punchQueued = true; // rivals check this in updateRivals
  const dir = new THREE.Vector3(Math.sin(G.player.heading), 0, Math.cos(G.player.heading));
  punch(G.player.pos, dir);
}

function spawnRivals(n) {
  const lm = G.city.landmarks.marina;
  for (let i = 0; i < n; i++) {
    const mesh = makePersonMesh(0x8a2a2a, 0x1a1a1a, false);
    const x = lm.pos.x + (i - 1.5) * 5;
    const z = lm.pos.z + (i % 2 === 0 ? 6 : -6);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const rival = { mesh, pos: mesh.position, heading: 0, speed: 3.4, walkPhase: 0, hp: 2, punchCd: 0 };
    if (!G.mission.rivals) G.mission.rivals = [];
    G.mission.rivals.push(rival);
  }
  showMessage('Rivals! Take them down.');
}

function updateRivals(dt) {
  if (!G.mission || !G.mission.rivals) return;
  for (let i = G.mission.rivals.length - 1; i >= 0; i--) {
    const r = G.mission.rivals[i];
    const d = dist2d(r.pos.x, r.pos.z, G.player.pos.x, G.player.pos.z);
    const heading = Math.atan2(G.player.pos.x - r.pos.x, G.player.pos.z - r.pos.z);
    r.heading = heading;
    if (d > 1.8) {
      r.pos.x += Math.sin(heading) * r.speed * dt;
      r.pos.z += Math.cos(heading) * r.speed * dt;
    } else {
      r.punchCd -= dt;
      if (r.punchCd <= 0) {
        r.punchCd = 1.1;
        hurtPlayer(6, 'rival punch');
      }
    }
    r.mesh.rotation.y = heading;
    r.walkPhase += dt * r.speed * 3;
    const swing = Math.sin(r.walkPhase) * 0.5;
    const p = r.mesh.userData.parts;
    p.leftLeg.rotation.x = swing; p.rightLeg.rotation.x = -swing;
    // Rival hit by a bullet or a punch: handled in combat via proximity checks.
    for (const b of [...G.bullets]) {
      if (dist2d(b.pos.x, b.pos.z, r.pos.x, r.pos.z) < 1.2 && b.pos.y < 2.4) {
        r.hp -= 1;
        G.scene.remove(b.mesh);
        G.bullets.splice(G.bullets.indexOf(b), 1);
        spawnBurst(r.pos, 0xc23a3a);
        if (r.hp <= 0) {
          G.mission.rivalsDown = (G.mission.rivalsDown || 0) + 1;
          G.scene.remove(r.mesh);
          G.mission.rivals.splice(i, 1);
        }
        break;
      }
    }
  }
  // Rival knocked out by a punch (player presses F near one).
  if (G.punchQueued) {
    G.punchQueued = false;
    for (let i = G.mission.rivals.length - 1; i >= 0; i--) {
      const r = G.mission.rivals[i];
      if (dist2d(r.pos.x, r.pos.z, G.player.pos.x, G.player.pos.z) < 2.4) {
        r.hp -= 1;
        spawnBurst(r.pos, 0xc23a3a);
        if (r.hp <= 0) {
          G.mission.rivalsDown = (G.mission.rivalsDown || 0) + 1;
          G.scene.remove(r.mesh);
          G.mission.rivals.splice(i, 1);
        }
        break;
      }
    }
  }
}

function updatePickups(dt) {
  for (const pk of G.pickups) {
    pk.spin += dt * 2;
    pk.mesh.rotation.y = pk.spin;
    pk.mesh.position.y = 1 + Math.sin(pk.spin) * 0.2;
    if (dist2d(G.player.pos.x, G.player.pos.z, pk.pos.x, pk.pos.z) < 2.2) {
      if (pk.kind === 'health') { G.health = Math.min(G.maxHealth, G.health + 30); showMessage('+30 health'); }
      else if (pk.kind === 'ammo') { G.reserveAmmo += 24; showMessage('+24 ammo'); }
      else { G.cash += 100; showMessage('+$100 found'); audio.playCash(); }
      // Respawn elsewhere.
      pk.pos.set((rng.rand() - 0.5) * HALF * BLOCK * 2, 0, (rng.rand() - 0.5) * HALF * BLOCK * 2);
      pk.mesh.position.copy(pk.pos);
    }
  }
}

function updatePlayerOnFoot(dt) {
  const input = readMoveInput();
  const camForward = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
  const camRight = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
  let mx = 0, mz = 0;
  if (input.up) { mx += camForward.x; mz += camForward.z; }
  if (input.down) { mx -= camForward.x; mz -= camForward.z; }
  if (input.left) { mx -= camRight.x; mz -= camRight.z; }
  if (input.right) { mx += camRight.x; mz += camRight.z; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    const speed = input.sprint ? 9.5 : 5.2;
    G.player.pos.x += mx * speed * dt;
    G.player.pos.z += mz * speed * dt;
    G.player.heading = Math.atan2(mx, mz);
    G.player.speed = speed;
    const p = G.player.mesh.userData.parts;
    const ph = (G.playTime * speed * 1.6) % TAU;
    const swing = Math.sin(ph) * 0.6;
    p.leftLeg.rotation.x = swing; p.rightLeg.rotation.x = -swing;
    p.leftArm.rotation.x = -swing * 0.7; p.rightArm.rotation.x = swing * 0.7;
  } else {
    G.player.speed = 0;
    const p = G.player.mesh.userData.parts;
    p.leftLeg.rotation.x *= 0.8; p.rightLeg.rotation.x *= 0.8;
    p.leftArm.rotation.x *= 0.8; p.rightArm.rotation.x *= 0.8;
  }
  // Jump (simple gravity).
  if (input.jump && onGround) { playerVy = 6.5; onGround = false; }
  if (!onGround) {
    playerVy -= 18 * dt;
    G.player.pos.y += playerVy * dt;
    if (G.player.pos.y <= 0) { G.player.pos.y = 0; onGround = true; playerVy = 0; }
  }
  G.player.mesh.rotation.y = G.player.heading;
  G.player.mesh.position.copy(G.player.pos);
  // Keep the player inside the city + beach.
  G.player.pos.x = clamp(G.player.pos.x, -HALF * BLOCK - 10, BEACH_X + 60);
  G.player.pos.z = clamp(G.player.pos.z, -HALF * BLOCK - 10, HALF * BLOCK + 10);
}

function updateCamera(dt) {
  const look = consumeLook();
  camYaw -= look.x * 0.12;
  const target = G.player.inCar && G.playerCar ? G.playerCar.pos : G.player.pos;
  const heading = G.player.inCar && G.playerCar ? G.playerCar.heading : G.player.heading;
  const camHeading = G.player.inCar ? heading + Math.PI : camYaw + Math.PI;
  const dist = camMode === 0 ? 11 : 17;
  const height = camMode === 0 ? 5.2 : 8.5;
  const tx = target.x + Math.sin(camHeading) * dist;
  const tz = target.z + Math.cos(camHeading) * dist;
  G.camera.position.x = tx;
  G.camera.position.y = height + look.y * 2;
  G.camera.position.z = tz;
  G.camera.lookAt(target.x, 1.6, target.z);
}

function updateTrafficCollisions() {
  // Player car vs traffic: push apart, small speed loss. Player on foot hit
  // by a fast car takes damage (with a cooldown).
  const pp = G.player.pos;
  for (const car of G.cars) {
    if (car === G.playerCar || car.parked) continue;
    const d = dist2d(car.pos.x, car.pos.z, pp.x, pp.z);
    if (G.player.inCar) {
      if (d < 3.4) {
        const push = (3.4 - d) * 0.5;
        const nx = (car.pos.x - pp.x) / (d || 1), nz = (car.pos.z - pp.z) / (d || 1);
        car.pos.x += nx * push; car.pos.z += nz * push;
        car.speed *= 0.7;
        if (G.playerCar) G.playerCar.speed *= 0.92;
      }
    } else if (d < 1.6 && Math.abs(car.speed) > 5 && hurtCooldown <= 0) {
      hurtCooldown = 1;
      hurtPlayer(10, 'hit by traffic');
      addHeat(4, 'traffic accident');
      showMessage('Hit by a car!');
    }
  }
  // Running over pedestrians in a car.
  if (G.player.inCar && G.playerCar && Math.abs(G.playerCar.speed) > 4) {
    for (const ped of [...G.peds]) {
      if (dist2d(ped.pos.x, ped.pos.z, pp.x, pp.z) < 2.2) {
        const i = G.peds.indexOf(ped);
        if (i >= 0) G.peds.splice(i, 1);
        G.scene.remove(ped.mesh);
        spawnBurst(ped.pos, 0xc23a3a);
        G.pedsHit += 1;
        addHeat(12, 'running over a pedestrian');
        showMessage('You ran someone over!');
      }
    }
  }
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (G.mode === 'playing') {
    G.playTime += dt;
    if (G.playTime > 300) { G.day += 1; G.playTime = 0; }
    hurtCooldown = Math.max(0, hurtCooldown - dt);
    sirenTimer -= dt;
    if (G.wanted > 0 && sirenTimer <= 0) { sirenTimer = 1.6; audio.playSirenBlip(); }

    const input = readMoveInput();
    if (G.player.inCar && G.playerCar) {
      driveCar(G.playerCar, input, dt);
      G.player.pos.copy(G.playerCar.pos);
      G.player.heading = G.playerCar.heading;
    } else {
      updatePlayerOnFoot(dt);
    }
    // Punch key queues a rival check.
    if (keys['KeyF']) { /* handled by onKey */ }

    for (const car of G.cars) {
      if (car === G.playerCar || car.police) continue;
      updateTraffic(car, rng, dt);
    }
    updatePeds(G.peds, rng, dt, dangerPos);
    dangerPos = null;
    updateWanted(dt, rng);
    updatePoliceChase(dt);
    updateCops(G.cops, dt, G.player.pos, () => {
      if (G.mode === 'playing') {
        G.mode = 'busted';
        showScreen('screen-busted');
        audio.playBusted();
      }
    });
    updateBullets(dt);
    updateMissions(dt);
    updateRivals(dt);
    updatePickups(dt);
    updateTrafficCollisions();
    audio.updateEngine(G.playerCar ? G.playerCar.speed : 0, !!G.playerCar);

    // Mission chain: start the next job a few seconds after one completes.
    if (missionChainTimer > 0) {
      missionChainTimer -= dt;
      if (missionChainTimer <= 0 && G.missionIndex < MISSIONS.length && !G.mission) {
        startMission(G.missionIndex);
      }
    }
    // Mission marker.
    const mp = missionMarkerPos();
    if (mp) {
      markerMesh.visible = true;
      markerMesh.position.set(mp.x, 0.2, mp.z);
    } else {
      markerMesh.visible = false;
    }
    updateHud();
  }
  updateCamera(dt);
  G.renderer.render(G.scene, G.camera);
}

init();
