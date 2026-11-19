// save.js — SOLMAR HEAT save games in localStorage.
// Stores cash, mission progress, health, player position and play time so a
// run can continue from the title screen. Versioned key, guarded parse.
const SAVE_KEY = 'solmar-heat-save-v1';

export function saveGame(G) {
  try {
    const data = {
      v: 1,
      cash: G.cash,
      health: G.health,
      missionIndex: G.missionIndex,
      missionsDone: G.missionsDone,
      kills: G.kills,
      carsStolen: G.carsStolen,
      playTime: G.playTime,
      px: G.player ? G.player.pos.x : 0,
      pz: G.player ? G.player.pos.z : 0,
      heading: G.player ? G.player.heading : 0,
      ammo: G.ammo,
      reserveAmmo: G.reserveAmmo,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (e) { return null; }
}

export function hasSave() { return loadSave() !== null; }

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
