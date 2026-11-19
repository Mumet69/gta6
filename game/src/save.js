// save.js — localStorage save / load for Velvet Bay.
// Stores money, debt, mission progress, player position and health.
// Nothing here touches the network.

export const SAVE_KEY = 'velvet-bay-save-v1';

export function saveGame(state, player) {
  try {
    const data = {
      v: 1,
      savedAt: Date.now(),
      money: state.money,
      debt: state.debt,
      health: state.health,
      ammo: state.ammo,
      reserveAmmo: state.reserveAmmo,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
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
    if (!data || data.v !== 1) return null;
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
