// save.js — localStorage save: cash, missions cleared, best getaway time.
const KEY = 'velvet-bay-save-v4';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number' || typeof s.mission !== 'number') return null;
    return s;
  } catch (e) { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash, mission: state.missionIndex,
      completed: state.completedMissions, savedAt: Date.now(),
    }));
  } catch (e) { /* storage unavailable (private mode) — game still plays */ }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
