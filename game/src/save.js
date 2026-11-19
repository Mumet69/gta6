// save.js — save / load through localStorage.
// Stores cash, health, ammo, mission progress, player position, day and
// wanted level. Autosaves when a mission completes; the pause menu saves
// on demand. A save is only a snapshot of the run, not of the whole city.
import { G } from './state.js';

export const SAVE_KEY = 'neon-harbor-save-v1';

export function saveGame() {
  try {
    const data = {
      version: 1,
      cash: G.cash,
      health: G.health,
      ammo: G.ammo,
      reserveAmmo: G.reserveAmmo,
      weapon: G.weapon,
      missionIndex: G.missionIndex,
      missionsDone: G.missionsDone,
      day: G.day,
      playTime: G.playTime,
      wanted: G.wanted,
      heat: G.heat,
      carsStolen: G.carsStolen,
      px: G.player.pos.x,
      pz: G.player.pos.z,
      heading: G.player.heading,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(data) {
  G.cash = data.cash || 0;
  G.health = data.health ?? 100;
  G.ammo = data.ammo ?? 12;
  G.reserveAmmo = data.reserveAmmo ?? 48;
  G.weapon = data.weapon || 'fists';
  G.missionIndex = data.missionIndex || 0;
  G.missionsDone = data.missionsDone || 0;
  G.day = data.day || 1;
  G.playTime = data.playTime || 0;
  G.wanted = data.wanted || 0;
  G.heat = data.heat || 0;
  G.carsStolen = data.carsStolen || 0;
  if (G.player && data.px !== undefined) {
    G.player.pos.set(data.px, 0, data.pz);
    G.player.heading = data.heading || 0;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
