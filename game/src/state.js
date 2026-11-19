// state.js — the single shared game state for SOLMAR HEAT.
// Every module imports G and reads/mutates it; main.js builds the world into it.
// Keeping one plain object avoids circular imports between game systems.
export const G = {
  // --- lifecycle ---
  mode: 'loading', // 'loading' | 'title' | 'playing' | 'paused' | 'busted' | 'wasted'
  time: 0, // seconds since load
  playTime: 0, // seconds of active play (drives the in-game clock)
  paused: false,
  muted: false,
  photoMode: null, // null or { shot: 'title'|'drive'|'chase'|'mission', seed: number }
  seed: 7,

  // --- three.js handles (filled by main.js) ---
  scene: null,
  camera: null,
  renderer: null,
  sun: null,

  // --- world ---
  city: null, // { colliders, roads, blocks, spawn, safehouse, bank, marina, docks, hospital }
  groundY: 0,

  // --- player ---
  player: null, // { mesh, pos, vel, heading, health, onFoot, inCar, speed, ... }
  cameraYaw: 0,
  cameraPitch: 0.32,
  cameraMode: 0, // 0 near chase, 1 far chase, 2 top-down

  // --- vehicles ---
  cars: [], // all cars: { mesh, pos, heading, speed, color, isPlayer, isPolice, isTraffic, driver, health }
  playerCar: null,
  policeCars: [],
  trafficCars: [],

  // --- people ---
  peds: [], // { mesh, pos, heading, speed, state, target, color }
  cops: [], // on-foot police { mesh, pos, heading, speed, state }

  // --- systems ---
  wanted: 0, // 0..5 stars
  wantedHeat: 0, // 0..100, decays when hidden; stars derive from it
  cash: 0,
  health: 100,
  maxHealth: 100,
  ammo: 12,
  maxAmmo: 12,
  reserveAmmo: 48,
  weapon: 'fists', // 'fists' | 'pistol'
  kills: 0,
  carsStolen: 0,
  missionsDone: 0,

  // --- missions ---
  mission: null, // active mission object { id, title, desc, stage, target, ... }
  missionIndex: 0, // next mission to start (0..3), 4 = all done
  missionMarker: null, // THREE.Mesh beacon at the current objective

  // --- pickups / collectibles ---
  pickups: [], // { mesh, kind: 'cash'|'health'|'ammo', pos, taken }

  // --- effects ---
  shake: 0, // screen shake amount
  flash: 0, // muzzle / damage flash timer
  particles: [], // { mesh, vel, life }

  // --- stats for save / pause screen ---
  stats: { deaths: 0, busted: 0, shotsFired: 0, shotsHit: 0, distanceDriven: 0 },
};

// resetRunState restores the mutable run state for a fresh New Game
// (keeps scene/camera/city handles, which main.js rebuilds separately).
export function resetRunState() {
  G.mode = 'playing';
  G.playTime = 0;
  G.wanted = 0;
  G.wantedHeat = 0;
  G.cash = 0;
  G.health = 100;
  G.ammo = 12;
  G.reserveAmmo = 48;
  G.weapon = 'fists';
  G.kills = 0;
  G.carsStolen = 0;
  G.missionsDone = 0;
  G.mission = null;
  G.missionIndex = 0;
  G.playerCar = null;
  G.shake = 0;
  G.flash = 0;
  G.stats = { deaths: 0, busted: 0, shotsFired: 0, shotsHit: 0, distanceDriven: 0 };
}
