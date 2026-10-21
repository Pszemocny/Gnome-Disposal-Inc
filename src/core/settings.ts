import * as THREE from 'three';

// Sound, mouse and graphics settings live in a cookie, apart from the game save, so "Reset save" keeps them.
export type Quality = 'low' | 'medium' | 'high';
const QUALITIES: readonly unknown[] = ['low', 'medium', 'high'];

export interface Settings {
  volume: number; // 0..1
  muted: boolean;
  sensitivity: number; // 0.25..3
  invertY: boolean;
  quality: Quality;
}

const COOKIE = 'gnome_settings';
const YEAR = 31536000;

const num = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

// null = no cookie yet; a broken cookie reads as {} so every field falls back to its default
function readCookie(): Record<string, unknown> | null {
  const m = document.cookie.match(/(?:^|;\s*)gnome_settings=([^;]*)/);
  if (!m) return null;
  try {
    const v: unknown = JSON.parse(decodeURIComponent(m[1]));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const stored = readCookie();

export const prefs: Settings = {
  volume: num(stored?.volume, 0, 1, 0.7),
  muted: bool(stored?.muted, false),
  sensitivity: num(stored?.sensitivity, 0.25, 3, 1),
  invertY: bool(stored?.invertY, false),
  quality: QUALITIES.includes(stored?.quality) ? (stored?.quality as Quality) : 'medium',
};

// ?lowfx (headless tests, slow machines): Low for this page load only, the cookie keeps the saved choice
export const lowfx = new URLSearchParams(location.search).has('lowfx');

// Pixel ratio, shadows on/off, the sun's shadow map size and reach; all of it takes effect on the next frame.
// High is the look from before 2026-10-21 (ratio 1.5, 1024², ±40 m); Medium is the lighter default PP asked for
// (ratio 1, 512², ±25 m).
export function applyQuality(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const q = lowfx ? 'low' : prefs.quality;
  // never above the screen's own ratio: with browser zoom below 100 % (DPR 0.8) Medium must not draw more than High
  renderer.setPixelRatio(Math.min(q === 'high' ? 1.5 : 1, window.devicePixelRatio));
  renderer.shadowMap.enabled = q !== 'low';
  // three r186 removed PCFSoftShadowMap (it falls back to PCF with a warning); softness comes from shadow.radius
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.needsUpdate = true;
  const size = q === 'high' ? 1024 : 512;
  const half = q === 'high' ? 40 : 25;
  scene.traverse((o) => {
    if (o instanceof THREE.DirectionalLight && o.castShadow) {
      // same edge width in metres: 2 x 7.8 cm on High, 1.6 x 9.8 cm on Medium (PCF takes 5 taps at any radius)
      o.userData.baseShadowRadius ??= o.shadow.radius;
      o.shadow.radius = o.userData.baseShadowRadius * (q === 'high' ? 1 : 0.8);
      if (o.shadow.mapSize.x !== size) {
        o.shadow.mapSize.set(size, size);
        o.shadow.map?.dispose(); // three makes a new map at the new size on the next shadow pass
        o.shadow.map = null;
      }
      const sc = o.shadow.camera;
      sc.left = sc.bottom = -half;
      sc.right = sc.top = half;
      sc.updateProjectionMatrix();
    }
    // shaders are compiled with or without shadow code
    const m = (o as { material?: { needsUpdate: boolean } }).material;
    if (m) m.needsUpdate = true;
  });
}

export function saveSettings(): void {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; max-age=${YEAR}; path=/; SameSite=Lax`;
}

// One-time move of the volume from older saves, only when there is no cookie yet.
export function adoptSaveVolume(v: unknown): void {
  if (stored !== null || typeof v !== 'number') return;
  prefs.volume = num(v, 0, 1, prefs.volume);
  saveSettings();
}

// One-time move of the old "Shadows" checkbox from the save: shadows off becomes Low.
export function adoptSaveShadows(v: unknown): void {
  if (QUALITIES.includes(stored?.quality) || v !== false) return;
  prefs.quality = 'low';
  saveSettings();
}
