// input.js — keyboard + mouse for SOLMAR HEAT.
// WASD move/drive, Shift sprint, E enter/exit car, Space jump, mouse look
// (pointer lock on canvas click, drag fallback), click shoot, F punch, R reload.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    this.onKey = null; // callback(code) for edge-triggered keys (E, F, R, P, M, C)

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (this.onKey) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      if (!this.locked) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
      else if (this.mouseDown) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; }
    });
    // prevent the context menu from popping over the game
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return !!this.keys[code]; }

  // axes in [-1, 1]
  moveX() {
    let x = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return x;
  }
  moveY() {
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return y;
  }
  sprint() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  jump() { return this.down('Space'); }

  // consume the accumulated mouse delta for this frame
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }
}
