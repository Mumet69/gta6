// main.js — SOLMAR HEAT bootstrap, game loop and wiring.
// Builds the renderer, the city, the player, traffic, police and missions,
// then runs the loop: drive, fight, chase, and complete the story jobs.
// A ?shot=title|drive|chase|mission&seed=N query sets up a deterministic
// photo scene and raises window.__shotReady when it has settled.
import * as THREE from 'three';
import { G, resetRunState } from './state.js';
import { clamp, lerp, damp, angleLerp, angleDiff, dist2D, makeRng, pick, randRange, fmtCash } from './utils.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { buildCity, CITY_HALF } from './city.js';
import { Car, TrafficManager, PoliceManager, CAR_COLORS } from './vehicles.js';
import { Player, PedestrianManager } from './people.js';
import { WantedSystem } from './wanted.js';
import { Combat, tagCombat } from './combat.js';
import { MissionManager, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';

const params = new URLSearchParams(location.search);
G.seed = Number(params.get('seed') || 7);
const shotParam = params.get('shot');
if (shotParam) G.photoMode = { shot: shotParam, seed: G.seed };

const canvas = document.getElementById('game-canvas');
const sound = new SoundBank();
const input = new Input(canvas);
const hud = new HUD();
let traffic, police, wantedSys, combat, missions, peds;
let missionStartTimer = 6;
let autoSaveTimer = 0;
let regenTimer = 0;
let shotFrames = 0;
let allCars = [];
let parkedCars = [];

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.Fog(0x87b8d8, 220, 520);
  G.scene = scene;

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
  G.camera = camera;

  // sun-soaked late-afternoon light
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0a8, 2.0);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(sun.target);
  G.sun = sun;

  // world
  G.city = buildCity(scene, G.seed);
  const rng = makeRng(G.seed * 31 + 5);
  traffic = new TrafficManager(scene, rng, G.city.colliders, G.city.roadLines);
  traffic.spawn(10);
  allCars = [...traffic.cars];
  police = new PoliceManager(scene, rng, G.city.colliders);
  peds = new PedestrianManager(scene, rng, G.city.colliders);
  peds.spawn(28);
  wantedSys = new WantedSystem(scene, rng);
  combat = new Combat(scene);
  missions = new MissionManager(scene, G.city.landmarks);

  // parked cars on road lanes near the spawn so the first steal is close
  // and every car faces a clear stretch of road (not a building).
  const parkedSpots = [
    { x: 30, z: 91, h: Math.PI / 2 },
    { x: 3, z: 100, h: 0 },
    { x: -3, z: 66, h: Math.PI },
    { x: 100, z: -3, h: -Math.PI / 2 },
  ];
  for (const s of parkedSpots) {
    const car = new Car(scene, s.x, s.z, s.h, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], false);
    parkedCars.push(car);
    allCars.push(car);
  }

  // player at the safehouse street
  G.player = new Player(scene, G.city.spawn.x, G.city.spawn.z, G.city.spawn.heading);
  G.cameraYaw = Math.PI;
  G.cameraPitch = 0.32;

  spawnPickups(rng);
  wireUI();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  document.getElementById('loading').style.display = 'none';
  if (G.photoMode) setupPhotoScene();
  else setMode('title');
  renderer.setAnimationLoop(tick);
}

// --- pickups: cash bags, health kits, ammo boxes scattered on sidewalks ---
function spawnPickups(rng) {
  const defs = [];
  for (let i = 0; i < 10; i++) defs.push('cash');
  for (let i = 0; i < 4; i++) defs.push('health');
  for (let i = 0; i < 4; i++) defs.push('ammo');
  for (const kind of defs) {
    const x = (rng() * 2 - 1) * 180;
    const z = (rng() * 2 - 1) * 180;
    let mesh;
    if (kind === 'cash') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x2a8a3a, emissive: 0x0a3310 }));
    } else if (kind === 'health') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshLambertMaterial({ color: 0xf0f0f0, emissive: 0x331111 }));
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.1),
        new THREE.MeshLambertMaterial({ color: 0xd82020, emissive: 0x550000 }));
      cross.position.z = 0.32;
      mesh.add(cross);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xe8c860, emissive: 0x443300 }));
    }
    mesh.position.set(x, 0.8, z);
    mesh.castShadow = true;
    G.scene.add(mesh);
    G.pickups.push({ mesh, kind, pos: mesh.position, taken: false, phase: rng() * 6 });
  }
}


// --- UI wiring: title buttons, pause menu, edge-triggered keys ---
function wireUI() {
  const startScreen = document.getElementById('start-screen');
  const pauseMenu = document.getElementById('pause-menu');
  const btnContinue = document.getElementById('btn-continue');
  if (hasSave()) btnContinue.style.display = '';
  document.getElementById('btn-new').onclick = () => {
    sound.init(); sound.resume(); sound.startMusic();
    clearSave();
    resetRunState();
    respawnAt(G.city.spawn.x, G.city.spawn.z, G.city.spawn.heading);
    startScreen.style.display = 'none';
    setMode('playing');
    hud.toast('Welcome to Solmar City, Rio. Mara has a job for you — wait for the call.');
    missionStartTimer = 6;
  };
  btnContinue.onclick = () => {
    sound.init(); sound.resume(); sound.startMusic();
    const s = loadSave();
    if (s) {
      resetRunState();
      G.cash = s.cash; G.health = s.health; G.missionIndex = s.missionIndex;
      G.missionsDone = s.missionsDone; G.kills = s.kills; G.carsStolen = s.carsStolen;
      G.playTime = s.playTime; G.ammo = s.ammo; G.reserveAmmo = s.reserveAmmo;
      respawnAt(s.px, s.pz, s.heading);
    }
    startScreen.style.display = 'none';
    setMode('playing');
    hud.toast('Welcome back, Rio. The city missed you.');
    missionStartTimer = 4;
  };
  document.getElementById('btn-resume').onclick = () => setMode('playing');
  document.getElementById('btn-save').onclick = () => {
    hud.toast(saveGame(G) ? 'Game saved.' : 'Save failed — storage unavailable.');
  };
  document.getElementById('btn-quit').onclick = () => {
    saveGame(G);
    setMode('title');
  };
  input.onKey = (code) => {
    if (G.mode !== 'playing') {
      if (code === 'KeyP' && G.mode === 'paused') setMode('playing');
      return;
    }
    if (code === 'KeyE') tryEnterExitCar();
    else if (code === 'KeyF') doPunch();
    else if (code === 'KeyR') reload();
    else if (code === 'KeyP') setMode('paused');
    else if (code === 'KeyM') { G.muted = !G.muted; sound.setMuted(G.muted); hud.toast(G.muted ? 'Sound muted.' : 'Sound on.'); }
    else if (code === 'KeyC') { G.cameraMode = (G.cameraMode + 1) % 3; }
    else if (code === 'Digit1') { G.weapon = 'fists'; }
    else if (code === 'Digit2') { G.weapon = 'pistol'; hud.toast('Pistol ready.'); }
  };
}

function setMode(mode) {
  G.mode = mode;
  document.getElementById('start-screen').style.display = mode === 'title' ? 'flex' : 'none';
  document.getElementById('pause-menu').style.display = mode === 'paused' ? 'flex' : 'none';
  if (mode === 'paused') {
    document.getElementById('pause-stats').innerHTML =
      `CASH $${fmtCash(G.cash)} · MISSIONS ${G.missionsDone} / 4 · KILLS ${G.kills}<br>` +
      `CARS STOLEN ${G.carsStolen} · WANTED ${'★'.repeat(G.wanted) || 'clean'} · TIME ${Math.floor(G.playTime / 60)}m`;
  }
  if (mode === 'title') {
    document.getElementById('btn-continue').style.display = hasSave() ? '' : 'none';
  }
}

function respawnAt(x, z, heading) {
  wantedSys.clear();
  police.cars.length = 0;
  for (const c of [...allCars]) if (c.police) { G.scene.remove(c.mesh); allCars.splice(allCars.indexOf(c), 1); }
  if (G.playerCar) { G.playerCar.isPlayer = false; G.playerCar = null; }
  G.player.inCar = false;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.mesh.rotation.y = heading;
  G.health = 100;
  G.cameraYaw = heading;
}

// --- car enter / exit ---
function nearestCar(maxDist) {
  let best = null, bd = maxDist;
  for (const c of allCars) {
    if (c.police) continue;
    const d = dist2D(G.player.pos.x, G.player.pos.z, c.pos.x, c.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function tryEnterExitCar() {
  if (G.player.inCar) {
    const car = G.playerCar;
    car.isPlayer = false;
    car.speed = 0;
    G.playerCar = null;
    G.player.inCar = false;
    const sx = Math.cos(car.heading), sz = -Math.sin(car.heading);
    G.player.pos.set(car.pos.x + sx * 2.2, 0, car.pos.z + sz * 2.2);
    G.player.heading = car.heading;
    sound.blip(300, 0.1, 'square', 0.15);
    return;
  }
  const car = nearestCar(4.5);
  if (!car) { hud.toast('No car close enough. Walk up to a car and press E.'); return; }
  if (car.isTraffic) {
    car.isTraffic = false;
    const idx = traffic.cars.indexOf(car);
    if (idx >= 0) traffic.cars.splice(idx, 1);
    // the driver bails out and flees
    const d = peds.nearest(car.pos.x, car.pos.z, 8);
    if (d) d.state = 'flee';
    const copNear = wantedSys.cops.some((c) => dist2D(c.pos.x, c.pos.z, car.pos.x, car.pos.z) < 40)
      || police.cars.some((c) => dist2D(c.pos.x, c.pos.z, car.pos.x, car.pos.z) < 40);
    if (copNear) { wantedSys.addHeat(12); hud.toast('The PD saw that! Wanted level up.'); sound.sirenBlip(); }
    else hud.toast(`You stole a ${car.name}. Nice wheels.`);
  } else {
    hud.toast(`You took the ${car.name}.`);
  }
  G.carsStolen++;
  car.isPlayer = true;
  G.playerCar = car;
  G.player.inCar = true;
  G.player.mesh.visible = false;
  sound.blip(220, 0.12, 'square', 0.2);
  sound.blip(330, 0.12, 'square', 0.2, 0.1);
}


// --- combat actions ---
let fireTimer = 0;
function tryShoot() {
  if (G.weapon !== 'pistol') return;
  if (fireTimer > 0) return;
  if (G.ammo <= 0) { reload(); return; }
  fireTimer = 0.22;
  G.ammo--;
  G.stats.shotsFired++;
  sound.shoot();
  G.flash = 0.05;
  const origin = G.camera.position.clone();
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  // raycast targets: people, gang, cops, cars, and the city itself
  const map = new Map();
  for (const p of peds.peds) map.set(p.mesh, { kind: 'ped', ref: p });
  for (const c of wantedSys.cops) map.set(c.mesh, { kind: 'cop', ref: c });
  for (const g of missions.gang) map.set(g.mesh, { kind: 'gang', ref: g });
  for (const c of allCars) map.set(c.mesh, { kind: 'car', ref: c });
  const list = [...map.keys(), G.city.group];
  const res = combat.shoot(origin, dir, list.map((m) => ({ mesh: m })));
  // identify what the ray hit by walking up from the hit object
  let hitKind = null, hitRef = null;
  if (res.hit) {
    // combat.shoot returns the first hit; re-raycast here to find the object
    const rc = new THREE.Raycaster(origin, dir);
    rc.far = 120;
    const hits = rc.intersectObjects(list, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !map.has(o)) o = o.parent;
      if (o) { const e = map.get(o); hitKind = e.kind; hitRef = e.ref; }
      else hitKind = 'world';
    }
  }
  if (hitKind === 'ped') {
    peds.knockDown(hitRef);
    G.kills++;
    G.stats.shotsHit++;
    wantedSys.addHeat(20);
    hud.toast('Pedestrian down! The PD will remember that.');
    spawnParticles(hitRef.pos, 0xd82020, 8, 4);
  } else if (hitKind === 'cop') {
    G.scene.remove(hitRef.mesh);
    wantedSys.cops.splice(wantedSys.cops.indexOf(hitRef), 1);
    G.kills++;
    G.stats.shotsHit++;
    wantedSys.addHeat(25);
    hud.toast('You shot a cop! Wanted level up.');
    spawnParticles(hitRef.pos, 0x2a4a8a, 10, 5);
  } else if (hitKind === 'gang') {
    G.stats.shotsHit++;
    const killed = missions.hitGang(hitRef, 1, missionCtx());
    if (killed) { G.kills++; wantedSys.addHeat(10); }
    spawnParticles(hitRef.pos, 0x8a1a2a, 8, 4);
  } else if (hitKind === 'car') {
    G.stats.shotsHit++;
    hitRef.health -= 34;
    spawnParticles(new THREE.Vector3(hitRef.pos.x, 1.2, hitRef.pos.z), 0xffb02e, 10, 6);
    if (hitRef.health <= 0) explodeCar(hitRef);
    else wantedSys.addHeat(5);
  } else if (hitKind === 'world') {
    spawnParticles(res.point, 0xcfd2dc, 4, 3);
  }
}

function doPunch() {
  if (G.player.inCar) return;
  G.player.punchTimer = 0.25;
  sound.punch();
  const hits = combat.punch(G.player.pos, G.player.heading, peds.peds, wantedSys.cops);
  for (const h of hits) {
    if (h.kind === 'ped') {
      peds.knockDown(h.target);
      wantedSys.addHeat(10);
      hud.toast('You punched a pedestrian. The PD is on its way.');
    } else if (h.kind === 'cop') {
      G.scene.remove(h.target.mesh);
      wantedSys.cops.splice(wantedSys.cops.indexOf(h.target), 1);
      wantedSys.addHeat(15);
      hud.toast('You knocked a cop out cold!');
    }
  }
  // punch gang members too
  for (const g of [...missions.gang]) {
    const d = dist2D(G.player.pos.x, G.player.pos.z, g.pos.x, g.pos.z);
    if (d < 2.2) missions.hitGang(g, 1, missionCtx());
  }
}

function reload() {
  if (G.weapon !== 'pistol' || G.ammo >= G.maxAmmo) return;
  const need = G.maxAmmo - G.ammo;
  const take = Math.min(need, G.reserveAmmo);
  if (take <= 0) { hud.toast('Out of ammo — find an ammo box (yellow).'); return; }
  G.ammo += take;
  G.reserveAmmo -= take;
  sound.blip(500, 0.08, 'square', 0.18);
}

function onDamage(amount, source) {
  if (G.mode !== 'playing') return;
  G.health -= amount;
  regenTimer = 0;
  G.shake = Math.max(G.shake, 0.35);
  if (G.health <= 0) {
    G.health = 0;
    G.stats.deaths++;
    endRun('wasted', 'WASTED', `${source} got you. The city moves on without you.`, 'You lose 10% of your cash.');
  }
}

function endRun(kind, title, text, sub) {
  setMode(kind);
  hud.center(title, text, sub, 3200);
  sound.busted();
  const loss = Math.floor(G.cash * (kind === 'busted' ? 0.2 : 0.1));
  G.cash -= loss;
  G.stats.busted += kind === 'busted' ? 1 : 0;
  G.respawnTimer = 3.2;
  G.respawnKind = kind;
}

// --- particles ---
function spawnParticles(pos, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(pos.x, (pos.y || 1) + 0.3, pos.z);
    G.scene.add(m);
    G.particles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.8 + 1, (Math.random() - 0.5) * speed),
      life: 0.6 + Math.random() * 0.3,
    });
  }
}

function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 5;
    if (p.life <= 0 || p.mesh.position.y < 0) {
      G.scene.remove(p.mesh);
      G.particles.splice(i, 1);
    }
  }
}

function explodeCar(car) {
  spawnParticles(new THREE.Vector3(car.pos.x, 1, car.pos.z), 0xff6a00, 26, 10);
  spawnParticles(new THREE.Vector3(car.pos.x, 1, car.pos.z), 0x333333, 14, 6);
  sound.crash();
  G.shake = 0.8;
  if (car === G.playerCar) {
    G.playerCar = null;
    G.player.inCar = false;
    G.player.pos.set(car.pos.x + 3, 0, car.pos.z + 3);
    onDamage(25, 'The explosion');
  }
  G.scene.remove(car.mesh);
  const idx = allCars.indexOf(car);
  if (idx >= 0) allCars.splice(idx, 1);
  const ti = traffic.cars.indexOf(car);
  if (ti >= 0) traffic.cars.splice(ti, 1);
  wantedSys.addHeat(20);
}


// --- mission context: the callbacks missions use to touch the world ---
function missionCtx() {
  return {
    time: G.time,
    playerPos: G.player.inCar && G.playerCar ? G.playerCar.pos : G.player.pos,
    inCar: G.player.inCar,
    carsStolen: G.carsStolen,
    onToast: (t) => hud.toast(t, 5200),
    onCash: (n) => { G.cash += n; sound.cash(); },
    onWanted: (n) => wantedSys.addHeat(n),
    onDamage: (n, src) => onDamage(n, src),
    onMissionStart: (def) => { sound.missionStart(); },
    onMissionComplete: (def) => {
      G.missionsDone++;
      G.missionIndex++;
      sound.missionDone();
      hud.center('JOB DONE', `${def.title} complete — $${def.reward} earned.`, G.missionIndex >= 4 ? 'All jobs done. You are a legend of Solmar.' : 'Mara will call with the next job.', 3400);
      saveGame(G);
      missionStartTimer = 8;
    },
    onMissionFailed: () => { missionStartTimer = 8; },
  };
}

// --- main update ---
function update(dt) {
  const mouse = input.consumeMouse();
  G.cameraYaw -= mouse.dx * 0.0032;
  G.cameraPitch = clamp(G.cameraPitch + mouse.dy * 0.0022, 0.06, 1.15);
  fireTimer = Math.max(0, fireTimer - dt);

  const ctx = missionCtx();
  // --- player: drive or walk ---
  let speedMph = 0;
  if (G.player.inCar && G.playerCar) {
    const car = G.playerCar;
    let throttle = 0, steer = 0;
    if (G.photoMode && G.photoDrive) { throttle = 1; steer = 0; }
    else { throttle = input.moveY(); steer = -input.moveX(); }
    const prevSpeed = car.speed;
    car.onCrash = (s) => {
      if (Math.abs(prevSpeed) > 6) {
        sound.crash();
        G.shake = Math.max(G.shake, 0.3);
        car.health -= Math.abs(prevSpeed) * 1.1;
        spawnParticles(new THREE.Vector3(car.pos.x, 1, car.pos.z), 0xffb02e, 6, 4);
        if (car.health <= 0) explodeCar(car);
      }
    };
    car.drive(throttle, steer, dt, G.city.colliders, allCars);
    G.player.pos.copy(car.pos);
    G.player.heading = car.heading;
    speedMph = Math.abs(car.speed) * 2.237;
    G.stats.distanceDriven += Math.abs(car.speed) * dt;
    // running over pedestrians in the car
    for (const p of [...peds.peds]) {
      if (p.state === 'down') continue;
      const d = dist2D(car.pos.x, car.pos.z, p.pos.x, p.pos.z);
      if (d < 2.2 && Math.abs(car.speed) > 6) {
        peds.knockDown(p);
        wantedSys.addHeat(18);
        sound.crash();
        G.shake = Math.max(G.shake, 0.4);
        hud.toast('You ran someone over! The PD is coming.');
      }
    }
    for (const g of [...missions.gang]) {
      const d = dist2D(car.pos.x, car.pos.z, g.pos.x, g.pos.z);
      if (d < 2.4 && Math.abs(car.speed) > 6) missions.hitGang(g, 3, ctx);
    }
    if (input.consumeClick()) tryShoot();
  } else {
    G.player.update(dt, input, G.cameraYaw, G.city.colliders);
    if (input.consumeClick()) tryShoot();
  }
  if (input.mouseDown && G.weapon === 'pistol') tryShoot();

  // --- world systems ---
  traffic.update(dt, G.player.pos, allCars);
  police.update(dt, G.player.inCar && G.playerCar ? G.playerCar.pos : G.player.pos, G.playerCar, wantedSys.stars, allCars);
  G.trafficCars = traffic.cars;
  G.policeCars = police.cars;
  G.cops = wantedSys.cops;
  const danger = G.player.inCar && G.playerCar ? G.playerCar.pos : G.player.pos;
  peds.update(dt, G.player.pos, danger, G.player.inCar ? 10 : 6);
  wantedSys.update(dt, G.player.pos, G.player.inCar, (kind) => {
    if (kind === 'busted') endRun('busted', 'BUSTED', 'The Solmar PD caught you.', 'You lose 20% of your cash.');
  });
  G.wanted = wantedSys.stars;

  // --- missions ---
  if (!missions.active && G.missionIndex < MISSIONS.length) {
    missionStartTimer -= dt;
    if (missionStartTimer <= 0) missions.start(G.missionIndex, ctx);
  }
  missions.update(dt, ctx);
  missions.updateGang(dt, ctx);

  // --- pickups ---
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt * 1.5;
    pk.mesh.position.y = 0.8 + Math.sin(G.time * 2 + pk.phase) * 0.15;
    const d = dist2D(G.player.pos.x, G.player.pos.z, pk.pos.x, pk.pos.z);
    if (d < 2.4) {
      pk.taken = true;
      pk.mesh.visible = false;
      if (pk.kind === 'cash') { G.cash += 150; sound.cash(); hud.toast('+$150 cash found.'); }
      else if (pk.kind === 'health') { G.health = Math.min(100, G.health + 30); sound.pickup(); hud.toast('+30 health.'); }
      else { G.reserveAmmo += 24; sound.pickup(); hud.toast('+24 pistol ammo.'); }
      spawnParticles(pk.pos, 0xffe9a8, 8, 3);
    }
  }

  // --- health regen, audio, autosave ---
  regenTimer += dt;
  if (regenTimer > 5 && G.health < 100) G.health = Math.min(100, G.health + 2 * dt);
  const driving = !!(G.player.inCar && G.playerCar);
  sound.setEngine(driving ? Math.abs(G.playerCar.speed) / 30 : 0, driving);
  sound.setSiren(wantedSys.stars >= 2, wantedSys.stars);
  autoSaveTimer += dt;
  if (autoSaveTimer > 60) { autoSaveTimer = 0; saveGame(G); }

  // --- HUD + minimap ---
  const stage = missions.currentStage();
  const tp = missions.targetPos();
  const md = tp ? dist2D(G.player.pos.x, G.player.pos.z, tp.x, tp.z) : 0;
  hud.update(G, stage, tp, md, speedMph);
  hud.drawMinimap(G, G.city, tp);

  // --- sun follows the player so shadows stay local ---
  G.sun.position.set(G.player.pos.x + 120, 180, G.player.pos.z + 60);
  G.sun.target.position.set(G.player.pos.x, 0, G.player.pos.z);
}

// --- camera ---
function updateCamera(dt) {
  const cam = G.camera;
  const p = G.player;
  if (G.mode === 'title') {
    const t = G.time * 0.05;
    cam.position.set(Math.sin(t) * 150, 70, Math.cos(t) * 150);
    cam.lookAt(0, 8, 0);
    return;
  }
  const target = p.inCar && G.playerCar ? G.playerCar.pos : p.pos;
  const heading = p.inCar && G.playerCar ? G.playerCar.heading : G.cameraYaw;
  if (G.cameraMode === 2) {
    cam.position.set(target.x, 46, target.z + 0.01);
    cam.lookAt(target.x, 0, target.z);
    return;
  }
  const dist = G.cameraMode === 1 ? 15 : 9;
  const height = G.cameraMode === 1 ? 7 : 3.6 + G.cameraPitch * 2;
  const cx = target.x - Math.sin(heading) * dist;
  const cz = target.z - Math.cos(heading) * dist;
  const desired = new THREE.Vector3(cx, height, cz);
  cam.position.lerp(desired, 1 - Math.exp(-dt * 7));
  if (G.shake > 0) {
    cam.position.x += (Math.random() - 0.5) * G.shake;
    cam.position.y += (Math.random() - 0.5) * G.shake;
    G.shake = Math.max(0, G.shake - dt * 1.6);
  }
  const look = new THREE.Vector3(
    target.x + Math.sin(heading) * 5,
    p.inCar ? 1.6 : 1.7,
    target.z + Math.cos(heading) * 5);
  cam.lookAt(look);
}


// --- frame loop ---
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  G.time += dt;
  if (G.mode === 'playing') {
    G.playTime += dt;
    update(dt);
  } else if (G.mode === 'busted' || G.mode === 'wasted') {
    G.respawnTimer -= dt;
    if (G.respawnTimer <= 0) {
      const lm = G.respawnKind === 'busted' ? G.city.landmarks.station : G.city.landmarks.hospital;
      respawnAt(lm.x, lm.z + 24, 0);
      hud.hideCenter();
      setMode('playing');
      hud.toast(G.respawnKind === 'busted' ? 'Released. The crew is waiting — get back to work.' : 'Patched up at Solmar General. Get back out there.');
      missionStartTimer = 6;
    }
  }
  updateCamera(dt);
  combat.update(dt);
  updateParticles(dt);
  G.renderer.render(G.scene, G.camera);
  if (G.photoMode) {
    shotFrames++;
    // 30 frames is enough for the camera to settle and the scene to come
    // alive (software rendering here runs ~2 fps, so frame-count, not wall
    // time, is the right measure of scene settle).
    if (shotFrames > 30 && !window.__shotReady) window.__shotReady = true;
  }
}

// --- photo mode: deterministic staged scenes for the 4 screenshots ---
function setupPhotoScene() {
  const shot = G.photoMode.shot;
  resetRunState();
  if (shot === 'title') {
    setMode('title');
    return;
  }
  setMode('playing');
  document.getElementById('start-screen').style.display = 'none';
  const ctx = missionCtx();
  if (shot === 'drive') {
    // Rio in a red Vento, cruising the beach road; package run active, 1 star
    respawnAt(3, -110, 0);
    const car = parkedCars[0];
    car.pos.set(3, 0, -110);
    car.heading = 0;
    car.mesh.position.set(3, 0, -110);
    car.mesh.rotation.y = 0;
    G.player.pos.set(3, 0, -110);
    G.player.inCar = true;
    G.playerCar = car;
    car.isPlayer = true;
    car.speed = 14;
    G.photoDrive = true;
    G.cash = 1250;
    missions.start(1, ctx);
    missions.active.stage = 1;
    missions.active.timer = 100;
    wantedSys.addHeat(12);
    for (const pc of police.cars) { /* none yet */ }
    police.update(0.016, car.pos, car, 1, allCars);
    police.cars[0].pos.set(-2, 0, -128);
    police.cars[0].heading = 0;
  } else if (shot === 'chase') {
    // The Solmar Job escape: 3 stars, two PD interceptors closing in
    respawnAt(3, -60, 0);
    const car = parkedCars[1];
    car.pos.set(3, 0, -60);
    car.heading = 0;
    car.mesh.position.set(3, 0, -60);
    car.mesh.rotation.y = 0;
    G.player.pos.set(3, 0, -60);
    G.player.inCar = true;
    G.playerCar = car;
    car.isPlayer = true;
    car.speed = 20;
    G.photoDrive = true;
    G.cash = 3250;
    G.weapon = 'pistol';
    missions.start(3, ctx);
    missions.active.stage = 2;
    wantedSys.addHeat(45);
    police.update(0.016, car.pos, car, 3, allCars);
    police.cars[0].pos.set(-4, 0, -84);
    police.cars[1].pos.set(9, 0, -88);
    police.cars[2].pos.set(3, 0, -104);
    for (const pc of police.cars) pc.heading = 0;
  } else if (shot === 'mission') {
    // Street Sweep at the docks: Rio on the road south of the pier, pistol
    // out, facing the Vipers on the waterfront so the camera sees them.
    missions.start(2, ctx);
    missions.active.stage = 1;
    missions.spawnGang(ctx);
    const gx = -181, gz = 153; // gang center on the pier
    const px = -176, pz = 182; // player on the road south of the docks
    respawnAt(px, pz, 0);
    const h = Math.atan2(gx - px, gz - pz);
    G.player.heading = h;
    G.player.mesh.rotation.y = h;
    G.cameraYaw = h;
    G.weapon = 'pistol';
    G.ammo = 12;
    G.cash = 2100;
    wantedSys.addHeat(28);
  }
}

// Developer hook for automated playtests (harmless in normal play).
window.__game = {
  G,
  teleport(x, z) { G.player.pos.set(x, 0, z); if (G.playerCar) { G.playerCar.pos.set(x, 0, z); } },
  enterNearestCar() { tryEnterExitCar(); return G.player.inCar; },
  startMission(i) { missions.start(i, missionCtx()); },
  setWanted(n) { wantedSys.heat = n; wantedSys.stars = n; },
};

init();
