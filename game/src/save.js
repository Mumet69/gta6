// save.js — localStorage save / load for Velvet Bay.
// Stores money, debt, mission progress, player position and health.
// Nothing here touches the network.

// The storage key stays v1 on purpose: the payload carries its own
// version (v: 2), so an old save is still found under the same key and
// migrates in loadGame instead of being orphaned under a new key.
export const SAVE_KEY = 'velvet-bay-save-v1';

export function saveGame(state, player) {
  try {
    const data = {
      v: 2,
      savedAt: Date.now(),
      money: state.money,
      debt: state.debt,
      health: state.health,
      ammo: state.ammo,
      reserveAmmo: state.reserveAmmo,
      respect: state.respect,
      coinsTaken: state.flags.coinsTaken || [],
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      // v3 empire: fronts, turf, heist prep, garage and weapons survive.
      empire: state.empire || null,
      garage: state.garage || null,
      weapon: state.weapon || 'pistol',
      weaponAmmo: state.weaponAmmo || null,
      deliveriesDone: state.deliveriesDone || 0,
      stats: state.stats,
      player: player ? {
        x: player.pos.x,
        z: player.pos.z,
        heading: player.heading,
      } : null,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (data.v !== 1 && data.v !== 2)) return null;
    // v1 saves predate the empire: fill the new fields with fresh defaults
    // instead of rejecting a save the player earned.
    if (data.v === 1) {
      data.empire = { businesses: [], turf: {}, prep: {}, incomeEarned: 0 };
      data.garage = { engine: 0, armor: 0, nitro: 0, paint: 0x2e8a8a };
      data.weapon = 'pistol';
      data.weaponAmmo = { shotgun: 12, smg: 60 };
      data.deliveriesDone = 0;
    }
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

export function hasSave() {
  return loadGame() !== null;
}
