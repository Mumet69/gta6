// input.js — keyboard + mouse state for Velvet Bay (desktop Chrome).
// Tracks held keys, edge-triggered presses (cleared once per frame by the
// game loop), pointer-lock mouse look and mouse clicks.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mousePressed = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.anyKey = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });

    canvas.addEventListener('click', () => {
      if (!this.locked && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (e) { /* headless: ignore */ }
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Call once per frame after the game has read the input.
  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  // WASD / arrow movement vector, x = strafe right, y = forward.
  moveVector() {
    let x = 0, y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    return { x, y };
  }
}
