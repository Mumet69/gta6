// save.js — DUSTLINE: localStorage save/load. Keeps the run's cash, mission
// progress and best haul between sessions. A save is only written when the
// player has started a run.

import { S } from './state.js';

const KEY = 'dustline-save-v1';

export function saveGame() {
  if (!S.started) return false;
  try {
    const data = {
      cash: S.cash,
      mission: S.mission,
      missionsDone: S.stats.missionsDone,
      day: S.day,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* no storage */ }
}

export function hasSave() {
  return loadGame() !== null;
}
