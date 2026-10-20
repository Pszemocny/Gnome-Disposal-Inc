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

// Pixel ratio, shadows on/off and the sun's shadow map size; all of it takes effect on the next frame.
export function applyQuality(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const q = lowfx ? 'low' : prefs.quality;
  renderer.setPixelRatio(q === 'low' ? 1 : Math.min(q === 'high' ? 2 : 1.5, window.devicePixelRatio));
  renderer.shadowMap.enabled = q !== 'low';
  // three r186 removed PCFSoftShadowMap (it falls back to PCF with a warning); softness comes from shadow.radius
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.needsUpdate = true;
  const size = q === 'high' ? 2048 : 1024;
  scene.traverse((o) => {
    if (o instanceof THREE.DirectionalLight && o.castShadow) {
      // the blur radius is in texels: double it with the doubled map so High is not sharper than Medium
      o.userData.baseShadowRadius ??= o.shadow.radius;
      o.shadow.radius = o.userData.baseShadowRadius * (size / 1024);
      if (o.shadow.mapSize.x !== size) {
        o.shadow.mapSize.set(size, size);
        o.shadow.map?.dispose(); // three makes a new map at the new size on the next shadow pass
        o.shadow.map = null;
      }
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
