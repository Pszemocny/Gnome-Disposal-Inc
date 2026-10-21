import type RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';
import type { GameState } from './state';
import type { Input } from './input';
import type { Audio } from './audio';
import type { Environment } from '../world/environment';
import type { Gnomes } from '../entities/gnomes';
import type { Coins } from '../entities/coins';
import type { Mushrooms } from '../entities/mushrooms';
import type { Machines } from '../entities/machines';
import type { Props } from '../entities/props';
import type { Factory } from '../entities/factory';
import type { Goals } from '../systems/goals';
import type { Contracts } from '../systems/contracts';
import type { Player } from '../player/player';
import type { Hole } from '../systems/hole';
import type { Buffs } from '../systems/buffs';
import type { Events } from '../systems/events';
import type { Achievements } from '../systems/achievements';
import type { Fx } from '../systems/fx';
import type { Hud } from '../ui/hud';
import type { Shop } from '../ui/shop';
import type { Moods } from '../systems/moods';
import type { Weather } from '../systems/weather';
import type { Strike } from '../systems/strike';
import type { Blueprints } from '../ui/blueprints';
import type { Legend } from '../ui/legend';
import type { Leaderboard } from '../ui/leaderboard';

export interface Ctx {
  R: typeof RAPIER;
  physics: RAPIER.World;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  state: GameState;
  input: Input;
  audio: Audio;
  env: Environment;
  gnomes: Gnomes;
  coins: Coins;
  mushrooms: Mushrooms;
  machines: Machines;
  props: Props;
  factory: Factory;
  goals: Goals;
  contracts: Contracts;
  player: Player;
  hole: Hole;
  buffs: Buffs;
  events: Events;
  achievements: Achievements;
  fx: Fx;
  hud: Hud;
  shop: Shop;
  moods: Moods;
  weather: Weather;
  strike: Strike;
  blueprints: Blueprints;
  legend: Legend;
  leaderboard: Leaderboard;
  time: number;
  renderAlpha: number; // how far render time is between the previous and the current physics step, 0..1
  paused: boolean;
}

export const ctx = {} as Ctx;

// Render interpolation (Gaffer "Fix Your Timestep"): an entity keeps its body pose from before the last physics step.
export interface Pose {
  prevPos: THREE.Vector3;
  prevRot: THREE.Quaternion;
}

// Before each physics step; also right after a teleport, so the next frame does not streak from the old place.
export function savePose(o: Pose, body: RAPIER.RigidBody): void {
  o.prevPos.copy(body.translation());
  o.prevRot.copy(body.rotation());
}

// The pose to draw: between prev and the body, by ctx.renderAlpha. Game logic keeps reading the body.
export function drawPose(o: Pose, body: RAPIER.RigidBody, pos: THREE.Vector3, rot: THREE.Quaternion): void {
  const k = 1 - ctx.renderAlpha;
  pos.copy(body.translation()).lerp(o.prevPos, k);
  rot.copy(body.rotation()).slerp(o.prevRot, k);
}

// Collision groups: membership in the high 16 bits, filter in the low 16 bits.
export const G = {
  GROUND: 0x0001,
  GNOME: 0x0002,
  PLAYER: 0x0004,
  STATIC: 0x0008,
  COIN: 0x0010,
  PROP: 0x0020,
};

export function groups(member: number, filter: number): number {
  return (member << 16) | filter;
}

export function lvl(id: string): number {
  return ctx.state.upgrades[id] ?? 0;
}

export function deep(id: string): number {
  return ctx.state.deep[id] ?? 0;
}

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

// The factory's random stream: the daily challenge swaps it for a date-seeded one, so everybody gets the same gnomes.
export const rng = { spawn: Math.random as () => number };

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
