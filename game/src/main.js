// main.js — Velvet Bay bootstrap and game loop.
// Wires every system together: third-person on-foot and driving controls,
// camera, crime + wanted + police, missions, combat, HUD, save and sound.
// Also exposes window.VB debug hooks used by the playtest and screenshots,
// and honours ?shot=title|drive|chase|mission for staged screenshots.

import * as THREE from 'three';
import { clamp, lerp, angleLerp, dist2d, rand } from './utils.js';
import { createState, addMoney, addHeat } from './state.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity, CITY } from './city.js';
import { makeCar, drivePlayerCar, TrafficSystem } from './vehicles.js';
import { PedSystem, makePersonMesh } from './people.js';
import { Combat } from './combat.js';
import { MissionManager, MISSIONS } from './missions.js';
import { WantedSystem } from './wanted.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || null;

const state = createState();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const city = buildCity(scene);
const input = new Input(renderer.domElement);
const audio = new AudioSys();
const hud = new HUD();
const traffic = new TrafficSystem(scene, city);
const peds = new PedSystem(scene, city);
const combat = new Combat(scene, audio, city);
const wanted = new WantedSystem(scene, city, traffic, peds, audio, state);

// ---- player ----
const player = {
  mesh: makePersonMesh(0x2e8a8a, 0xe8b88a),
  pos: new THREE.Vector3(0, 0, 30),
  heading: Math.PI,
  speed: 0,
  vy: 0,
  grounded: true,
  onFoot: true,
  car: null,
  walkPhase: 0,
  punchTimer: 0,
  shootCooldown: 0,
  reloadTimer: 0,
  lastDamage: -100,
  camYaw: Math.PI,
  camPitch: 0.32,
  shake: 0,
};
// A small pistol in Mara's hand.
const gun = new THREE.Mesh(
  new THREE.BoxGeometry(0.09, 0.14, 0.42),
  new THREE.MeshLambertMaterial({ color: 0x14161a }),
);
gun.position.set(0, 1.05, 0.48);
player.mesh.add(gun);
player.mesh.position.copy(player.pos);
scene.add(player.mesh);

traffic.spawnInitial(14);
peds.spawnInitial(24);

// Mission beacon: a light pillar + ground ring at the current objective.
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0xffd34d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
});
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beaconMat);
beacon.position.y = 30;
scene.add(beacon);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 3.0, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.25;
scene.add(ring);

const G = {
  state, player, city, traffic, peds, combat, wanted, hud, audio, input, scene, camera, renderer,
};
const world = {
  banner: (t, s) => hud.banner(t, s),
  addMoney: (n) => { addMoney(state, n); hud.toast('+$' + n); },
  setWanted: (n) => wanted.setWanted(n),
  spawnGang: (x, z, n) => combat.spawnGang(x, z, n),
  playSound: (name) => { if (audio[name]) audio[name](); },
  nextMissionIn: (t) => { G.nextMissionAt = state.time + t; },
  onDebtPaid: () => {
    state.mode = 'win';
    audio.winJingle();
    saveGame(state, player);
    showOverlay('win');
  },
};
const missions = new MissionManager(state, world);
G.missions = missions;
G.nextMissionAt = 0;

// ---- UI overlays ----
const overlays = {
  menu: document.getElementById('menu-screen'),
  pause: document.getElementById('pause-screen'),
  busted: document.getElementById('busted-screen'),
  wasted: document.getElementById('wasted-screen'),
  win: document.getElementById('win-screen'),
};
function showOverlay(name) {
  for (const [k, el] of Object.entries(overlays)) {
    if (el) el.classList.toggle('hidden', k !== name);
  }
  const hudEl = document.getElementById('hud');
  if (hudEl) hudEl.classList.toggle('hidden', name === 'menu');
}
function hideOverlays() {
  for (const el of Object.values(overlays)) if (el) el.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
}

document.getElementById('btn-start').addEventListener('click', () => startGame(false));
const btnContinue = document.getElementById('btn-continue');
if (hasSave()) {
  btnContinue.classList.remove('hidden');
  btnContinue.addEventListener('click', () => startGame(true));
}
document.getElementById('btn-resume').addEventListener('click', () => {
  state.mode = 'playing';
  hideOverlays();
  audio.click();
});
document.getElementById('btn-save').addEventListener('click', () => {
  saveGame(state, player);
  hud.toast('Game saved');
  audio.blip();
});
document.getElementById('btn-restart').addEventListener('click', () => {
  clearSave();
  location.reload();
});
document.getElementById('btn-mute').addEventListener('click', (e) => {
  audio.setMuted(!audio.muted);
  e.target.textContent = audio.muted ? 'Sound: OFF' : 'Sound: ON';
});
document.getElementById('btn-busted').addEventListener('click', () => {
  state.mode = 'playing';
  hideOverlays();
});
document.getElementById('btn-wasted').addEventListener('click', () => {
  state.mode = 'playing';
  hideOverlays();
});
document.getElementById('btn-win').addEventListener('click', () => {
  state.mode = 'playing';
  hideOverlays();
  hud.banner('FREE ROAM', 'Velvet Bay is yours, Mara.');
});

function startGame(fromSave) {
  audio.init();
  audio.startMusic();
  if (fromSave) {
    const d = loadGame();
    if (d) {
      state.money = d.money;
      state.debt = d.debt;
      state.health = d.health;
      state.ammo = d.ammo;
      state.reserveAmmo = d.reserveAmmo;
      state.missionsDone = d.missionsDone;
      state.stats = d.stats || state.stats;
      if (d.player) {
        player.pos.set(d.player.x, 0, d.player.z);
        player.heading = d.player.heading;
        player.camYaw = d.player.heading;
      }
      if (state.missionsDone > 0 && state.missionsDone < MISSIONS.length) {
        G.nextMissionAt = state.time + 1.5;
      }
    }
  }
  state.mode = 'playing';
  hideOverlays();
  if (!fromSave) G.nextMissionAt = state.time + 1.2;
  hud.banner('VELVET BAY', 'Mara Voss owes Cash $8,000. Time to work.');
}

// ---- crime / damage helpers ----
function damagePlayer(n) {
  state.health = Math.max(0, state.health - n);
  player.lastDamage = state.time;
  player.shake = Math.min(0.6, player.shake + 0.25);
  if (state.health <= 0) onWasted();
}

function onBusted() {
  if (state.mode !== 'playing') return;
  state.mode = 'busted';
  state.stats.bustedCount++;
  state.money = Math.max(0, state.money - 200);
  state.health = 100;
  wanted.clear();
  for (const o of [...peds.officers]) peds.removeOfficer(o);
  exitCar(true);
  player.pos.set(0, 0, -203);
  player.heading = 0;
  audio.busted();
  audio.setSiren(false);
  document.getElementById('busted-lose').textContent = 'You lost $200 in fines. The cops let you walk — this time.';
  showOverlay('busted');
  saveGame(state, player);
}

function onWasted() {
  if (state.mode !== 'playing') return;
  state.mode = 'wasted';
  state.stats.wastedCount++;
  state.money = Math.max(0, state.money - 200);
  state.health = 100;
  wanted.clear();
  for (const o of [...peds.officers]) peds.removeOfficer(o);
  exitCar(true);
  player.pos.set(203, 0, 203);
  player.heading = Math.PI;
  audio.wasted();
  audio.setSiren(false);
  showOverlay('wasted');
  saveGame(state, player);
}

function enterCar(car) {
  if (car.kind === 'police') {
    hud.banner("CAN'T STEAL THAT", 'That is a cop car, Mara.');
    return false;
  }
  player.car = car;
  player.onFoot = false;
  car.isPlayer = true;
  car.parked = false;
  if (!car.stolen && car.kind === 'traffic') {
    car.stolen = true;
    state.stats.carsStolen++;
    addHeat(state, 8);
    hud.toast('Car stolen — the heat is on');
  }
  player.mesh.visible = false;
  return true;
}

function exitCar(silent) {
  if (!player.car) return;
  const car = player.car;
  car.isPlayer = false;
  car.parked = true;
  car.speed = 0;
  const side = car.heading + Math.PI / 2;
  player.pos.set(car.x + Math.sin(side) * 3, 0, car.z + Math.cos(side) * 3);
  player.heading = car.heading;
  player.camYaw = car.heading;
  player.car = null;
  player.onFoot = true;
  player.mesh.visible = true;
  if (!silent) audio.blip();
}

// ---- per-frame updates ----
function updatePlayer(dt) {
  const mv = input.moveVector();
  if (player.onFoot) {
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? 7.6 : 4.4;
    // Mouse look.
    player.camYaw -= input.mouseDX * 0.0032;
    player.camPitch = clamp(player.camPitch + input.mouseDY * 0.0022, -0.05, 0.6);
    let mx = 0, mz = 0;
    if (mv.x !== 0 || mv.y !== 0) {
      const fwdX = Math.sin(player.camYaw), fwdZ = Math.cos(player.camYaw);
      const rightX = Math.sin(player.camYaw - Math.PI / 2), rightZ = Math.cos(player.camYaw - Math.PI / 2);
      mx = fwdX * mv.y + rightX * mv.x;
      mz = fwdZ * mv.y + rightZ * mv.x;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      player.heading = angleLerp(player.heading, Math.atan2(mx, mz), Math.min(1, dt * 10));
      player.speed = speed;
    } else {
      player.speed = 0;
    }
    let nx = player.pos.x + mx * player.speed * dt;
    let nz = player.pos.z + mz * player.speed * dt;
    if (nz > CITY.waterZ - 2) nz = CITY.waterZ - 2;
    if (nx > CITY.docksX + 38) nx = CITY.docksX + 38;
    nx = clamp(nx, -CITY.half - 20, CITY.half + 45);
    nz = clamp(nz, -CITY.half - 20, CITY.waterZ - 2);
    const res = city.collideCircle(nx, nz, 0.6);
    player.pos.x = res.x;
    player.pos.z = res.z;
    // Jump + gravity.
    if (input.wasPressed('Space') && player.grounded) {
      player.vy = 7.5;
      player.grounded = false;
    }
    if (!player.grounded) {
      player.vy -= 22 * dt;
      player.pos.y += player.vy * dt;
      if (player.pos.y <= 0) {
        player.pos.y = 0;
        player.vy = 0;
        player.grounded = true;
      }
    }
    // Walk animation.
    player.walkPhase += dt * (player.speed > 0 ? (sprint ? 13 : 9) : 0);
    const swing = Math.sin(player.walkPhase) * (player.speed > 0 ? 0.55 : 0);
    player.mesh.userData.legs[0].rotation.x = swing;
    player.mesh.userData.legs[1].rotation.x = -swing;
    player.mesh.userData.arms[0].rotation.x = -swing * 0.8;
    player.mesh.userData.arms[1].rotation.x = swing * 0.8;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;

    // Punch.
    player.punchTimer -= dt;
    if (input.wasPressed('KeyF') && player.punchTimer <= 0) {
      player.punchTimer = 0.45;
      const hit = combat.punch(player.pos, player.heading, { peds: peds.peds });
      if (hit) addHeat(state, 6);
    }
    // Shoot.
    player.shootCooldown -= dt;
    if (player.reloadTimer > 0) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        const need = 12 - state.ammo;
        const take = Math.min(need, state.reserveAmmo);
        state.ammo += take;
        state.reserveAmmo -= take;
      }
    }
    if ((input.mousePressed || input.mouseDown) && player.shootCooldown <= 0 && player.reloadTimer <= 0) {
      if (state.ammo > 0) {
        player.shootCooldown = 0.18;
        state.ammo--;
        state.stats.shotsFired++;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const origin = camera.position.clone();
        const res2 = combat.shoot(origin, dir, {
          peds: peds.peds, cars: traffic.cars, officers: peds.officers,
        });
        player.shake = Math.min(0.5, player.shake + 0.12);
        if (res2.hit === 'ped' || res2.hit === 'officer' || res2.hit === 'car') {
          addHeat(state, res2.hit === 'car' ? 4 : 10);
          if (res2.hit === 'ped') state.stats.pedsHit++;
          peds.setDanger(player.pos.x, player.pos.z);
        }
        if (res2.hit === 'enemy' && res2.killed) {
          addMoney(state, 50);
          hud.toast('+$50 dropped cash');
        }
        if (state.ammo === 0 && state.reserveAmmo > 0) {
          player.reloadTimer = 1.2;
          audio.reload();
        }
      } else if (state.reserveAmmo > 0) {
        player.reloadTimer = 1.2;
        audio.reload();
      }
    }
    if (input.wasPressed('KeyR') && state.ammo < 12 && state.reserveAmmo > 0 && player.reloadTimer <= 0) {
      player.reloadTimer = 1.2;
      audio.reload();
    }
  } else if (player.car) {
    // Driving.
    const car = player.car;
    const res = drivePlayerCar(car, input, dt, city, traffic.cars, peds.peds, (sev) => {
      audio.crash();
      player.shake = Math.min(0.7, player.shake + sev * 0.4);
      if (sev > 0.7) damagePlayer(8);
    });
    if (res.hitPed) {
      addHeat(state, 12);
      state.stats.pedsHit++;
      peds.setDanger(player.pos.x, player.pos.z);
      hud.toast('You hit a pedestrian!');
    }
    player.pos.set(car.x, 0, car.z);
    player.heading = car.heading;
    audio.engine(Math.abs(car.speed) / 46, true);
  }

  // Interact / enter-exit (E).
  if (input.wasPressed('KeyE')) {
    if (!player.onFoot) {
      exitCar(false);
    } else {
      const didMission = missions.tryInteract(player.pos);
      if (!didMission) {
        const car = traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
        if (car) enterCar(car);
      }
    }
  }

  // Health regen.
  if (state.time - player.lastDamage > 8 && state.health < state.maxHealth) {
    state.health = Math.min(state.maxHealth, state.health + 3 * dt);
  }
}

function updateCamera(dt) {
  const shakeX = (Math.random() - 0.5) * player.shake;
  const shakeY = (Math.random() - 0.5) * player.shake;
  player.shake = Math.max(0, player.shake - dt * 1.4);
  if (player.onFoot) {
    const fwdX = Math.sin(player.camYaw), fwdZ = Math.cos(player.camYaw);
    const dist = 8.5, height = 3.2 + player.camPitch * 6;
    const tx = player.pos.x - fwdX * dist;
    const tz = player.pos.z - fwdZ * dist;
    camera.position.x = lerp(camera.position.x, tx + shakeX, Math.min(1, dt * 8));
    camera.position.y = lerp(camera.position.y, height + shakeY, Math.min(1, dt * 8));
    camera.position.z = lerp(camera.position.z, tz, Math.min(1, dt * 8));
    camera.lookAt(player.pos.x + fwdX * 3 + shakeX, 1.6 + shakeY, player.pos.z + fwdZ * 3);
  } else if (player.car) {
    const car = player.car;
    // Chase cam eases toward the car's heading.
    player.camYaw = angleLerp(player.camYaw, car.heading, Math.min(1, dt * 2.2));
    const fwdX = Math.sin(player.camYaw), fwdZ = Math.cos(player.camYaw);
    const tx = car.x - fwdX * 12;
    const tz = car.z - fwdZ * 12;
    camera.position.x = lerp(camera.position.x, tx + shakeX, Math.min(1, dt * 6));
    camera.position.y = lerp(camera.position.y, 5.2 + shakeY, Math.min(1, dt * 6));
    camera.position.z = lerp(camera.position.z, tz, Math.min(1, dt * 6));
    camera.lookAt(car.x + fwdX * 8, 1.4, car.z + fwdZ * 8);
  }
}

function updateBeacon() {
  const obj = missions.objective();
  if (obj.marker && state.mode === 'playing') {
    beacon.visible = true;
    ring.visible = true;
    beacon.position.set(obj.marker.x, 30, obj.marker.z);
    ring.position.set(obj.marker.x, 0.25, obj.marker.z);
    const pulse = 0.2 + Math.sin(performance.now() / 300) * 0.1;
    beaconMat.opacity = pulse;
    const s = 1 + Math.sin(performance.now() / 300) * 0.12;
    ring.scale.set(s, s, 1);
  } else {
    beacon.visible = false;
    ring.visible = false;
  }
}

function updatePrompt() {
  if (state.mode !== 'playing' || !player.onFoot) {
    hud.prompt(null);
    return;
  }
  const s = missions.step;
  if (s && (s.type === 'interact' || s.type === 'collect') && s.marker) {
    const d = dist2d(player.pos.x, player.pos.z, s.marker.x, s.marker.z);
    if (d <= s.radius + 2) {
      hud.prompt(s.prompt || 'Press E');
      return;
    }
  }
  const car = traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
  if (car) {
    hud.prompt(car.kind === 'police' ? 'Police car — keep walking' : 'Press E to steal the car');
    return;
  }
  hud.prompt(null);
}

// ---- main loop ----
const clock = new THREE.Clock();
let frames = 0;
let saveTimer = 0;
let menuAngle = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames++;

  if (state.mode === 'menu') {
    // Slow orbit over downtown behind the title screen.
    menuAngle += dt * 0.05;
    camera.position.set(Math.sin(menuAngle) * 190, 85, Math.cos(menuAngle) * 190);
    camera.lookAt(0, 10, 0);
    city.update(dt);
  } else if (state.mode === 'playing') {
    state.time += dt;
    state.clock = (state.clock + dt * 0.5) % (24 * 60);
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      state.mode = 'paused';
      showOverlay('pause');
      audio.setSiren(false);
      audio.engine(0, false);
    } else {
      updatePlayer(dt);
      missions.setPlayerPos(player.pos.x, player.pos.z);
      missions.update(dt, {
        playerPos: player.pos,
        inCar: !player.onFoot,
        car: player.car,
      });
      traffic.update(dt, player.pos, state.wanted > 0 ? player.pos : null);
      peds.update(dt, player.pos, player.onFoot ? player.speed : (player.car ? Math.abs(player.car.speed) : 0));
      const grabbing = peds.updateOfficers(dt, player.pos);
      wanted.syncOfficers(player.pos, !player.onFoot);
      wanted.update(dt, {
        playerPos: player.pos,
        inCar: !player.onFoot,
        playerSpeed: player.onFoot ? player.speed : Math.abs(player.car ? player.car.speed : 0),
        onBusted,
      });
      combat.update(dt, player.pos, (dmg) => damagePlayer(dmg));
      city.update(dt);
      updateCamera(dt);
      updateBeacon();
      updatePrompt();
      hud.update(G, dt);
      if (!player.onFoot) audio.engine(Math.abs(player.car.speed) / 46, true);
      else audio.engine(0, false);
      // Auto-start the next job.
      if (!state.missionActive && !missions.allDone && state.missionsDone < MISSIONS.length && state.time >= G.nextMissionAt && G.nextMissionAt > 0) {
        missions.startNext();
      }
      // Periodic autosave.
      saveTimer += dt;
      if (saveTimer > 30) {
        saveTimer = 0;
        saveGame(state, player);
      }
    }
  } else {
    // Paused / busted / wasted / win: frozen scene, still render.
    city.update(0);
  }

  renderer.render(scene, camera);
  input.endFrame();

  // Screenshot staging hook.
  if (SHOT && !window.__shotReady && frames > 90) {
    window.__shotReady = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- debug hooks for playtest + screenshots ----
window.VB = {
  G, state, player, missions, wanted, traffic, peds, combat,
  start: () => startGame(false),
  teleport: (x, z) => {
    if (player.car) exitCar(true);
    player.pos.set(x, 0, z);
    player.mesh.position.copy(player.pos);
  },
  giveCar: () => {
    const car = makeCar(0xc23b2e, 'traffic', player.pos.x + 4, player.pos.z + 2, player.heading);
    car.speed = 0;
    traffic.scene.add(car.mesh);
    traffic.cars.push(car);
    enterCar(car);
    return car;
  },
  startMission: (i) => missions.start(i),
  completeStep: () => missions.completeStep(),
  setWanted: (n) => wanted.setWanted(n),
  setHealth: (n) => { state.health = n; },
  spawnGang: (x, z, n) => combat.spawnGang(x, z, n),
  save: () => saveGame(state, player),
  autoDrive: (on) => { G.debugAuto = on; },
};

// Auto-drive injection for staged screenshots (feeds W into the car).
const origMoveVector = input.moveVector.bind(input);
input.moveVector = () => {
  if (G.debugAuto) return { x: 0, y: 1 };
  return origMoveVector();
};

// ---- staged screenshot setups (?shot=...) ----
function applyShotSetup() {
  if (!SHOT) return;
  startGame(false);
  if (SHOT === 'drive') {
    player.pos.set(0, 0, -116);
    player.heading = 0;
    player.camYaw = 0;
    window.VB.giveCar();
    G.debugAuto = true;
  } else if (SHOT === 'chase') {
    player.pos.set(0, 0, -58);
    player.heading = Math.PI;
    player.camYaw = Math.PI;
    window.VB.giveCar();
    G.debugAuto = true;
    wanted.setWanted(3);
    // Stage two police cars ahead and to the sides so the chase reads on
    // camera (the chase cam looks forward; pursuit cars behind it are unseen).
    const cops = traffic.cars.filter((c) => c.kind === 'police');
    const spots = [[-12, -22], [12, -38], [0, -55]];
    cops.forEach((pc, i) => {
      const s = spots[i % spots.length];
      pc.x = player.pos.x + s[0];
      pc.z = player.pos.z + s[1];
      pc.heading = 0;
      pc.speed = 12;
    });
  } else if (SHOT === 'mission') {
    missions.start(4);
    // On the road west of the bank, facing due east so the bank + beacon
    // are centred in frame (player on a road, not inside a block).
    player.pos.set(-58, 0, -29);
    player.heading = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    combat.spawnGang(-45, -29, 2);
  }
  // title: stay on the menu; nothing to do.
}

if (SHOT === 'title') {
  showOverlay('menu');
} else {
  applyShotSetup();
}
animate();
