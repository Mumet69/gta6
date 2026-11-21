// state.js — the single game-state record for Velvet Bay.
// Plain data plus tiny helpers. main.js owns one instance and hands it to
// every subsystem; save.js serialises it.

export function createState() {
  return {
    mode: 'menu', // menu | playing | paused | busted | wasted | win
    money: 250,
    debt: 10000,
    health: 100,
    maxHealth: 100,
    ammo: 12,
    magSize: 12,
    reserveAmmo: 60,
    wanted: 0, // 0..5 stars shown
    heat: 0, // 0..100, drives the star count
    respect: 0, // 0..100 street reputation, earned from jobs and side work
    missionIndex: 0,
    missionActive: false,
    missionsDone: 0,
    // v3 empire: fronts Mara owns, turf held per district, heist prep,
    // garage upgrades on her current car and her weapon locker.
    empire: {
      businesses: [],
      turf: { downtown: 'vipers', strip: 'vipers', docks: 'vipers', beach: 'vipers', heights: 'vipers' },
      prep: { scout: false, getaway: false, crew: false },
      incomeEarned: 0,
    },
    garage: { engine: 0, armor: 0, nitro: 0, paint: 0x2e8a8a },
    weapon: 'pistol', // pistol | shotgun | smg
    weaponAmmo: { shotgun: 12, smg: 60 },
    deliveriesDone: 0,
    time: 0, // seconds played this session
    clock: 8 * 60, // in-game minutes, starts 08:00
    stats: {
      carsStolen: 0,
      pedsHit: 0,
      shotsFired: 0,
      hits: 0,
      missionsDone: 0,
      bustedCount: 0,
      wastedCount: 0,
      taxiFares: 0,
      coinsCollected: 0,
      racesWon: 0,
      businessesBought: 0,
      turfTaken: 0,
      prepDone: 0,
      deliveriesDone: 0,
      bribesPaid: 0,
      witnessesDodged: 0,
    },
    flags: { coinsTaken: [] },
  };
}

export function addMoney(state, n) {
  state.money = Math.max(0, state.money + n);
  return state.money;
}

// Convert 0..100 heat into 0..5 wanted stars.
export function starsFromHeat(heat) {
  if (heat >= 90) return 5;
  if (heat >= 70) return 4;
  if (heat >= 50) return 3;
  if (heat >= 30) return 2;
  if (heat > 0) return 1;
  return 0;
}

export function addHeat(state, n) {
  state.heat = Math.max(0, Math.min(100, state.heat + n));
  state.wanted = starsFromHeat(state.heat);
  return state.wanted;
}

// Street reputation: jobs and side work raise it; it never falls.
export function addRespect(state, n) {
  state.respect = Math.max(0, Math.min(100, state.respect + n));
  return state.respect;
}

// The name the street knows Mara by at her current reputation.
export function respectRank(respect) {
  if (respect >= 60) return 'Bay Legend';
  if (respect >= 30) return 'Wheelman';
  if (respect >= 10) return 'Hustler';
  return 'Rookie';
}

export function debtLeft(state) {
  return Math.max(0, state.debt);
}

// Empire helpers: how much of the bay Mara owns, and her current weapon.
export function empireWorth(state) {
  const values = { motel: 1200, warehouse: 2500, palms: 4000 };
  return (state.empire.businesses || []).reduce((s, id) => s + (values[id] || 0), 0);
}

export function turfHeld(state) {
  return Object.values(state.empire.turf || {}).filter((o) => o === 'mara').length;
}

export function setWeapon(state, name) {
  if (['pistol', 'shotgun', 'smg'].includes(name)) state.weapon = name;
  return state.weapon;
}

// A bribe costs cash and drops one wanted star; false when broke.
export function payBribe(state, cost = 300) {
  if (state.money < cost || state.wanted <= 0) return false;
  state.money -= cost;
  state.stats.bribesPaid = (state.stats.bribesPaid || 0) + 1;
  addHeat(state, -25);
  return true;
}
