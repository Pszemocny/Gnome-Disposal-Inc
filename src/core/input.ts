import { prefs } from './settings';

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>(); // keys pressed this frame
  mouse = { left: false, right: false, leftPressed: false, rightPressed: false, dx: 0, dy: 0, wheel: 0 };
  locked = false;
  // set by lock(), cleared by main's showPause(); a grant that arrives after the player paused again is released
  wanted = false;
  typed = '';
  // Blink reports the whole outside jump as movementX on the first move after re-entry
  private skipMove = false;
  onLockChange: (locked: boolean) => void = () => {};
  onLockError: () => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.key.length === 1) this.typed = (this.typed + e.key.toUpperCase()).slice(-12);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.leftPressed = true;
      }
      if (e.button === 2) {
        this.mouse.right = true;
        this.mouse.rightPressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // movementX works without the lock; the player gates on `ctx.paused`
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) this.skipMove = true;
    });
    document.documentElement.addEventListener('mouseenter', () => (this.skipMove = true));
    window.addEventListener('mousemove', (e) => {
      if (this.skipMove) {
        this.skipMove = false;
        return;
      }
      this.mouse.dx += e.movementX * prefs.sensitivity;
      this.mouse.dy += e.movementY * prefs.sensitivity * (prefs.invertY ? -1 : 1);
    });
    window.addEventListener('wheel', (e) => {
      this.mouse.wheel += Math.sign(e.deltaY);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.keys.clear();
      this.onLockChange(this.locked);
    });
    // Browsers refuse pointer lock without a user gesture (e.g. right after Esc).
    document.addEventListener('pointerlockerror', () => this.onLockError());
  }

  lock(): void {
    this.wanted = true;
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => this.onLockError());
    } catch {
      this.onLockError();
    }
  }

  unlock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  hit(code: string): boolean {
    return this.pressed.has(code);
  }

  consumeTyped(word: string): boolean {
    if (this.typed.endsWith(word)) {
      this.typed = '';
      return true;
    }
    return false;
  }

  endFrame(): void {
    this.pressed.clear();
    this.mouse.leftPressed = this.mouse.rightPressed = false;
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }
}
