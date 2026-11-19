// input.js — DUSTLINE: keyboard + mouse. WASD/arrows drive and walk, E enters
// and steals cars, F exits a car, Space punches (or handbrakes in a car),
// mouse click shoots the pistol, drag orbits the camera, P pauses, M mutes.

export const input = {
  up: false, down: false, left: false, right: false,
  handbrake: false,
  mouseDown: false,
  mouseDX: 0, mouseDY: 0,
  camYaw: 0, camPitch: 0,
  // Edge-triggered actions, consumed by main.js each frame.
  pressed: new Set(),
};

let dragging = false;
let lastX = 0, lastY = 0;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'handbrake',
};

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const mapped = KEYMAP[e.code];
    if (mapped) {
      input[mapped] = true;
      e.preventDefault();
    }
    input.pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = false;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    input.mouseDX += e.clientX - lastX;
    input.mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.handbrake = false;
    dragging = false;
  });
}

export function consumePress(code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

export function endFrameInput() {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
}
