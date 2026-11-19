// input.js — keyboard + mouse, with pointer lock for looking around.
// WASD move/drive, Shift sprint, Space jump, E enter/exit/steal car,
// F punch, 2 pistol / 1 fists, R reload, P pause, M mute, C camera,
// click to shoot, mouse to look.
export const keys = {};
let lookX = 0, lookY = 0;
let onMouseDown = null;
let onKey = null;

export function initInput(callbacks) {
  onMouseDown = callbacks.onMouseDown || null;
  onKey = callbacks.onKey || null;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (onKey) onKey(e.code, true);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
      lookX += e.movementX * 0.0028;
      lookY += e.movementY * 0.0022;
      lookY = Math.max(-0.9, Math.min(0.9, lookY));
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && onMouseDown) onMouseDown(e.clientX, e.clientY);
  });
}

export function getLook() { return { x: lookX, y: lookY }; }
// Consume the accumulated mouse delta (returns it and resets to zero).
export function consumeLook() {
  const d = { x: lookX, y: lookY };
  lookX = 0; lookY = 0;
  return d;
}
export function resetLook() { lookX = 0; lookY = 0; }

export function readMoveInput() {
  return {
    up: !!(keys['KeyW'] || keys['ArrowUp']),
    down: !!(keys['KeyS'] || keys['ArrowDown']),
    left: !!(keys['KeyA'] || keys['ArrowLeft']),
    right: !!(keys['KeyD'] || keys['ArrowRight']),
    sprint: !!(keys['ShiftLeft'] || keys['ShiftRight']),
    jump: !!keys['Space'],
  };
}

export function lockPointer(el) {
  if (el && el.requestPointerLock) el.requestPointerLock();
}
