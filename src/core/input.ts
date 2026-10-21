import { prefs } from './settings';

// px in one mouse report or frame event: logged as a jump, never dropped (measurement for "mysz przeskakuje przy fabryce", PP 2026-10-20)
const SPIKE = 250;

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
  // ask for pointer lock with raw mouse input (no OS acceleration); off after the browser refused the option
  private raw = true;
  // the current lock was granted with raw input
  private rawOk = false;
  // a raw request or its plain retry is out: the raw refusal's pointerlockerror is not the player's
  private retrying = false;
  // mouse jumps for main to send once per frame; per page load at most 5 locked ones (the measurement target) and 5
  // others (free cursor, re-entry skip), so the others cannot use up the locked budget
  jumps: { ex: number; ey: number; n: number; max: number; locked: boolean; raw: boolean; skip: boolean }[] = [];
  private jumpCount = 0;
  private freeJumpCount = 0;
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
    // read-only: the largest single report of this event; pointer events fire before the compat mousemove, so skip
    // still holds the re-entry flag
    window.addEventListener('pointermove', (e) => {
      const list = e.getCoalescedEvents?.() ?? [];
      let max = 0;
      for (const c of list) max = Math.max(max, Math.abs(c.movementX), Math.abs(c.movementY));
      const real = this.locked && !this.skipMove;
      if (Math.max(max, Math.abs(e.movementX), Math.abs(e.movementY)) > SPIKE && (real ? this.jumpCount : this.freeJumpCount) < 5) {
        if (real) this.jumpCount++;
        else this.freeJumpCount++;
        this.jumps.push({ ex: e.movementX, ey: e.movementY, n: list.length, max, locked: this.locked, raw: this.rawOk, skip: this.skipMove });
      }
    });
    window.addEventListener('wheel', (e) => {
      this.mouse.wheel += Math.sign(e.deltaY);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.keys.clear();
        this.rawOk = false;
      }
      this.onLockChange(this.locked);
    });
    // Browsers refuse pointer lock without a user gesture (e.g. right after Esc).
    document.addEventListener('pointerlockerror', () => {
      if (!this.retrying) this.onLockError();
    });
  }

  lock(): void {
    this.wanted = true;
    this.request();
  }

  private request(): void {
    if (this.raw) this.retrying = true;
    try {
      const p = this.canvas.requestPointerLock(this.raw ? { unadjustedMovement: true } : undefined) as unknown as Promise<void> | undefined;
      if (!p?.then) {
        this.retrying = false;
        return;
      }
      p.then(
        () => {
          this.rawOk = this.raw;
          this.retrying = false;
        },
        (e: unknown) => {
          // the browser cannot give raw input: every later lock is plain, and one plain retry now, only while the
          // player still wants the lock (an Esc meanwhile cleared `wanted`)
          if (this.raw && (e as { name?: string })?.name === 'NotSupportedError') {
            this.raw = false;
            if (this.wanted && !this.locked) return this.request();
            this.retrying = false;
          } else {
            this.retrying = false;
            this.onLockError();
          }
        },
      );
    } catch {
      this.retrying = false;
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
