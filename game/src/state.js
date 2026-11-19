// state.js — DUSTLINE: the single shared game state. Plain data, no imports,
// so every system reads and writes the same truth without import cycles.

export const S = {
  // run / flow
  started: false,      // past the title screen
  paused: false,
  busted: false,
  wasted: false,
  over: false,         // busted or wasted, waiting for restart
  time: 0,             // seconds since the run started
  day: 1,
  hour: 8,             // in-game clock, 08:00 start
  minute: 0,
  seed: 1,

  // player
  health: 100,
  cash: 0,
  weapon: 'fists',     // 'fists' | 'pistol'
  ammo: 0,             // pistol reserve (magazine is infinite-ish: 12 per load)
  mag: 0,              // pistol rounds in the magazine
  onFoot: true,
  car: null,           // the vehicle object the player drives, or null
  px: 0, pz: 0,        // player position (feet) when on foot
  heading: 0,          // facing angle, radians
  walkSpeed: 0,
  punchCooldown: 0,
  shootCooldown: 0,

  // wanted
  wanted: 0,           // stars 0..5
  heat: 0,             // 0..100, drives star changes
  heatDecay: 0,        // timer for passive decay
  lastCrime: 0,        // game time of the last crime

  // missions
  mission: 0,          // index of the current mission
  missionState: 'idle',// 'idle' | 'active' | 'done' | 'failed'
  missionTimer: 0,     // seconds left for timed missions (0 = untimed)
  objective: 'Press ENTER to start',
  message: '',
  messageTimer: 0,

  // stats (shown on the end screen)
  stats: { crimes: 0, carsStolen: 0, pedsDown: 0, copsDown: 0, missionsDone: 0, distance: 0 },
};

export function resetState(seed) {
  S.started = false;
  S.paused = false;
  S.busted = false;
  S.wasted = false;
  S.over = false;
  S.time = 0;
  S.day = 1;
  S.hour = 8;
  S.minute = 0;
  S.seed = seed || 1;
  S.health = 100;
  S.cash = 0;
  S.weapon = 'fists';
  S.ammo = 0;
  S.mag = 0;
  S.onFoot = true;
  S.car = null;
  S.px = 0; S.pz = 0;
  S.heading = 0;
  S.walkSpeed = 0;
  S.punchCooldown = 0;
  S.shootCooldown = 0;
  S.wanted = 0;
  S.heat = 0;
  S.heatDecay = 0;
  S.lastCrime = 0;
  S.mission = 0;
  S.missionState = 'idle';
  S.missionTimer = 0;
  S.objective = 'Press ENTER to start';
  S.message = '';
  S.messageTimer = 0;
  S.stats = { crimes: 0, carsStolen: 0, pedsDown: 0, copsDown: 0, missionsDone: 0, distance: 0 };
}

export function showMessage(text, seconds) {
  S.message = text;
  S.messageTimer = seconds || 3;
}

export function setObjective(text) {
  S.objective = text;
}
