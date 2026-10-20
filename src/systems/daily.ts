import { ctx, rng } from '../core/context';
import { blockSaves } from '../core/state';

const DAILY_SECONDS = 300;

const CSS = `.daily-tag { position: absolute; right: 16px; bottom: 30px; z-index: 4; background: var(--panel); border: 2px solid #ffd23f; border-radius: 10px; padding: 6px 12px; font: 700 16px var(--font); color: #fff; pointer-events: none; }`;

// 32-bit FNV-1a: the date string becomes the seed
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// small seeded generator with the Math.random contract (0 <= x < 1)
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Daily challenge: `?daily` (or `?daily=YYYY-MM-DD`) plays a fresh 5-minute run on a date-seeded map and spawn stream.
export class Daily {
  readonly active: boolean;
  readonly date: string;
  readonly seed: number;
  readonly board: string;
  left = DAILY_SECONDS;
  private tag: HTMLDivElement | null = null;
  private shown = -1;
  private over = false;

  constructor() {
    const q = new URLSearchParams(location.search);
    const asked = q.get('daily') ?? '';
    this.active = q.has('daily');
    // UTC, so every player gets the same seed on the same calendar day
    this.date = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : new Date().toISOString().slice(0, 10);
    this.seed = fnv1a(this.date);
    this.board = `daily-${this.date}`;
  }

  // game time only (main.ts calls it inside the unpaused block)
  update(dt: number): void {
    if (!this.active || this.over) return;
    this.left = Math.max(0, this.left - dt);
    this.drawTag();
    if (this.left > 0) return;
    this.over = true;
    ctx.paused = true;
    ctx.input.unlock();
    ctx.leaderboard.offer(() => (location.href = yardUrl()), this.board, `DAILY ${this.date} OVER`);
  }

  private drawTag(): void {
    const s = Math.ceil(this.left);
    if (s === this.shown) return;
    this.shown = s;
    if (!this.tag) {
      document.head.appendChild(document.createElement('style')).textContent = CSS;
      this.tag = document.body.appendChild(document.createElement('div'));
      this.tag.className = 'daily-tag';
    }
    this.tag.textContent = `DAILY ${this.date} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}

export const daily = new Daily();

// back to the yard: the same URL without `daily`, so other flags such as ?lowfx stay
export function yardUrl(): string {
  const q = new URLSearchParams(location.search);
  q.delete('daily');
  const s = q.toString();
  return location.pathname + (s ? `?${s}` : '');
}

// at import time, before boot() builds the map: the whole run draws from the date's streams and never saves
if (daily.active) {
  Math.random = mulberry32(daily.seed);
  rng.spawn = mulberry32(daily.seed ^ 0x9e3779b9);
  blockSaves();
}
