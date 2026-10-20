import { adoptSaveShadows, adoptSaveVolume, prefs } from './settings';

export interface PlacedMachine {
  type: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tilt: number;
  // full orientation (free rotation); missing in older saves
  qx?: number;
  qy?: number;
  qz?: number;
  qw?: number;
}

export interface GameState {
  version: number;
  money: number;
  totalEarned: number; // this run
  lifetimeEarned: number;
  holeLevel: number;
  holeXp: number;
  upgrades: Record<string, number>;
  deep: Record<string, number>;
  shards: number;
  land: number;
  placed: PlacedMachine[];
  achievements: string[];
  secrets: string[];
  stats: {
    gnomesEaten: number;
    maxCombo: number;
    thrown: number;
    kicked: number;
    events: number;
    rebirths: number;
    playTime: number;
    stolen: number;
    mushrooms: number;
    typesEaten: Record<string, number>;
    produced: number;
    grabbed: number;
    bought: number;
    crated: number;
    crateDumps: number;
    longShots: number;
    airShots: number;
    bullseyes: number;
    hauls: number;
  };
  goal: number;
  goalBase: number;
  settings: { sensitivity: number; volume: number };
  seenIntro: boolean;
  seenHints: string[]; // tool / gear ids whose first-use hint was shown
  factoryAuto: boolean; // the lever beside the factory: false switches Auto Crank off
}

// keeps the game's old slug on purpose: a new key would wipe existing saves (same for the other storage keys)
const KEY = 'gnome-boozed-save-v1';

// messages from loading the save, shown as toasts once the game runs
export const loadNotes: string[] = [];

export function freshState(keep?: GameState): GameState {
  return {
    version: 1,
    money: 0,
    totalEarned: 0,
    lifetimeEarned: keep?.lifetimeEarned ?? 0,
    holeLevel: 1,
    holeXp: 0,
    upgrades: {},
    deep: keep?.deep ?? {},
    shards: keep?.shards ?? 0,
    land: 0,
    placed: [],
    achievements: keep?.achievements ?? [],
    secrets: keep?.secrets ?? [],
    stats: keep?.stats ?? {
      gnomesEaten: 0,
      maxCombo: 0,
      thrown: 0,
      kicked: 0,
      events: 0,
      rebirths: 0,
      playTime: 0,
      stolen: 0,
      mushrooms: 0,
      typesEaten: {},
      produced: 0,
      grabbed: 0,
      bought: 0,
      crated: 0,
      crateDumps: 0,
      longShots: 0,
      airShots: 0,
      bullseyes: 0,
      hauls: 0,
    },
    goal: keep?.goal ?? 0,
    goalBase: keep?.goalBase ?? 0,
    // volume and sensitivity come from the settings cookie (settings.ts); sensitivity is applied in input.ts,
    // so this copy stays 1 for the code that still multiplies by it
    settings: { volume: prefs.volume, sensitivity: 1 },
    seenIntro: keep?.seenIntro ?? false,
    seenHints: keep?.seenHints ?? [],
    factoryAuto: true,
  };
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // Wind-up was removed (PP 2026-10-20): give its price back once, the key goes away with the next save
    if (parsed.upgrades?.charge) {
      delete parsed.upgrades.charge;
      parsed.money = (parsed.money ?? 0) + 300;
      loadNotes.push('Wind-up was removed: $300 refunded.');
    }
    // the Push Broom was removed too (PP 2026-10-20)
    if (parsed.upgrades?.broom) {
      delete parsed.upgrades.broom;
      parsed.money = (parsed.money ?? 0) + 60;
      loadNotes.push('The Push Broom was removed: $60 refunded.');
    }
    adoptSaveVolume(parsed.settings?.volume);
    // older saves keep the Shadows checkbox here; the next save drops it
    adoptSaveShadows((parsed.settings as { shadows?: unknown } | undefined)?.shadows);
    const base = freshState();
    return {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      settings: base.settings,
    };
  } catch {
    return freshState();
  }
}

let blocked = false;

// Stops autosave from overwriting a save written just before a page reload.
export function blockSaves(): void {
  blocked = true;
}

export function saveState(s: GameState): void {
  if (blocked) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage blocked (private mode); the game keeps running without saves
  }
}

export function wipeSave(): void {
  blocked = true;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
