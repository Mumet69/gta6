// state.js — the single game-state record for Velvet Bay.
// Plain data plus tiny helpers. main.js owns one instance and hands it to
// every subsystem; save.js serialises it.

export function createState() {
  return {
    mode: 'menu', // menu | playing | paused | busted | wasted | win
    money: 250,
    debt: 8000,
    health: 100,
    maxHealth: 100,
    ammo: 12,
    magSize: 12,
    reserveAmmo: 60,
    wanted: 0, // 0..5 stars shown
    heat: 0, // 0..100, drives the star count
    missionIndex: 0,
    missionActive: false,
    missionsDone: 0,
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
    },
    flags: {},
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

export function debtLeft(state) {
  return Math.max(0, state.debt);
}
