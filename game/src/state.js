// state.js — the single shared game state for NEON HARBOR.
// Every module imports this one object (G) and reads/mutates its fields, so
// the game loop, the HUD, the missions and the police all agree on one truth.
// main.js fills it in at startup; save.js serialises the fields that persist.
export const G = {
  mode: 'title', // 'title' | 'playing' | 'paused' | 'busted' | 'wasted'
  seed: 1,
  playTime: 0,
  cash: 0,
  health: 100,
  maxHealth: 100,
  ammo: 12,
  reserveAmmo: 48,
  weapon: 'fists', // 'fists' | 'pistol'
  wanted: 0, // 0..5 stars
  heat: 0, // 0..100, feeds the wanted level
  day: 1,

  player: null, // { pos: THREE.Vector3, heading, speed, inCar, mesh, ... }
  playerCar: null, // the car object the player is driving, or null

  cars: [], // all traffic + parked cars
  peds: [], // pedestrians
  policeCars: [], // police cars actively chasing
  cops: [], // police officers on foot
  pickups: [], // health / ammo / cash pickups in the world
  bullets: [], // active tracer bullets
  particles: [], // simple particle bursts

  missionIndex: 0,
  missionsDone: 0,
  mission: null, // current mission runtime state
  missionTimer: 0,
  carsStolen: 0,
  pedsHit: 0,
  shotsFired: 0,

  // three.js handles, filled by main.js
  scene: null,
  camera: null,
  renderer: null,
  clock: null,

  // city data, filled by city.js
  city: null, // { roads, blocks, buildings, landmarks, bounds }
  nav: null, // road graph for traffic

  muted: false,
  message: '', // centre-screen toast text
  messageUntil: 0,
};

export function resetRunState() {
  G.mode = 'playing';
  G.playTime = 0;
  G.cash = 0;
  G.health = G.maxHealth;
  G.ammo = 12;
  G.reserveAmmo = 48;
  G.weapon = 'fists';
  G.wanted = 0;
  G.heat = 0;
  G.day = 1;
  G.missionIndex = 0;
  G.missionsDone = 0;
  G.mission = null;
  G.missionTimer = 0;
  G.carsStolen = 0;
  G.pedsHit = 0;
  G.shotsFired = 0;
  G.playerCar = null;
  G.policeCars.length = 0;
  G.cops.length = 0;
  G.pickups.length = 0;
  G.bullets.length = 0;
  G.particles.length = 0;
}
