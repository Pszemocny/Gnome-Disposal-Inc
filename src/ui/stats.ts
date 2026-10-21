import * as THREE from 'three';
import { ctx } from '../core/context';
import { lowfx, prefs } from '../core/settings';

// `?stats` in the address: frame times from the player's own machine (PP 2026-10-21), two lines top-left.
// Line 2 says which cut applies there: quality, drawing buffer @ device pixel ratio, GPU.
const on = new URLSearchParams(location.search).has('stats');
const WINDOW = 5000; // ms of frames behind the numbers
const ms: number[] = [];
const at: number[] = [];
const size = new THREE.Vector2();
let el: HTMLDivElement | null = null;
let renderer: THREE.WebGLRenderer;
let gpu = '';
let last = 0;
let shown = 0;

export const stats = {
  init(r: THREE.WebGLRenderer): void {
    if (!on) return;
    renderer = r;
    const gl = r.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    el = document.createElement('div');
    el.className = 'perf-stats';
    document.body.appendChild(el);
  },

  frame(now: number): void {
    if (!el) return;
    // pause menu and overlays: their frames are not the game's, so the line keeps the last numbers from play;
    // `last` follows along, so the first frame after resuming is not counted as one long hitch
    if (ctx.paused) {
      last = now;
      return;
    }
    const dt = now - last;
    last = now;
    // the loop stops while the tab is hidden: the first interval after it is not a hitch
    if (dt <= 1000) {
      ms.push(dt);
      at.push(now);
    }
    while (at.length && now - at[0] > WINDOW) {
      at.shift();
      ms.shift();
    }
    if (now - shown < 500 || !ms.length) return;
    shown = now;
    const sorted = [...ms].sort((a, b) => a - b);
    const fps = Math.round((1000 * ms.length) / ms.reduce((s, v) => s + v, 0));
    const p95 = Math.round(sorted[Math.floor(0.95 * (sorted.length - 1))]);
    renderer.getDrawingBufferSize(size);
    el.textContent =
      `fps ${fps} · p95 ${p95} ms · max ${Math.round(sorted[sorted.length - 1])} ms · prog ${renderer.info.programs?.length ?? 0}\n` +
      `${lowfx ? 'low' : prefs.quality} · ${size.x}x${size.y}@${window.devicePixelRatio} · ${gpu}`;
  },
};
