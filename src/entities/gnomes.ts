import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, G, drawPose, groups, lvl, pick, rand, savePose } from '../core/context';
import { BOOM_CHANCE, FLEE, GNOME_TYPES, TYPE_BY_ID, WEIGHT_TIERS, rollTiers, type GnomeType, type WeightTier } from '../data/gnomeTypes';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { PART_ORDER, PART_PIVOT, gnomeGeometry, gnomeParts, vcMat } from '../world/models';
import { money } from '../core/format';
import { inQuad, outBack, outCubic } from '../core/ease';

// held = floating in the player's arms; stashed = hidden inside a crate or cannon; gone = removed, its body is freed
export type GnomeState = 'statue' | 'walk' | 'ragdoll' | 'held' | 'stashed' | 'falling' | 'gone';

export interface Gnome {
  id: number;
  type: GnomeType;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  slot: number;
  state: GnomeState;
  awake: boolean;
  timer: number;
  think: number;
  target: THREE.Vector3 | null;
  yaw: number;
  scale: number;
  loot: number;
  valueMult: number;
  cooldown: number;
  angryOverride: boolean;
  parade: number; // -1 = not in a parade
  life: number;
  thrownBy: 'player' | 'machine' | 'kick' | null;
  noGrabUntil: number; // thrown gnomes cannot be caught again right away
  tier: WeightTier;
  xpTier: WeightTier; // pays hole XP: the tier without Feeding Frenzy's upgrade (money and mass use `tier`)
  // trick-shot tracking for a player throw
  throwPos: THREE.Vector3 | null;
  touchedGround: boolean;
  bounced: boolean;
  bullseye: boolean;
  bullseyeAt: number; // ctx.time of the hoop pass: BULLSEYE pays only within 2 s of it (PP 2026-10-22)
  volley: Volley | null; // shared by every gnome of one throw (a Magnet Gun ball throws many at once)
  xpGroup: { n: number } | null; // one Magnet Gun hold: every gnome of the ball shares it, XP x1/sqrt(n) (PP 2026-10-20 10a); null = hands
  fullXp: boolean; // shot by a funnel the player fed it into: the player's XP (PP F3 b), but no trick shot
  // impact feel: last frame's vertical speed, landing squash timer, one scream per throw
  prevVy: number;
  squash: number;
  screamed: boolean;
  pop: number; // seconds left of the grow-in after a type swap
  goldFrom: string | null; // Golden Hour: the type this gnome turns back into when the event ends
  scared: number; // seconds until a walker calms down after the player came close
  fleeing: boolean; // the current walk target leads away from the player
  prevPos: THREE.Vector3;
  prevRot: THREE.Quaternion;
  ph: number; // step phase, advanced by the distance walked (two steps per 2π)
  lag: PartLag | null; // null = drawn as one piece
  seeT: number; // 0..1 fade to see-through while held at Trick Scope Lvl 3
}

// Offsets of the moving parts, damped every frame in every state (targets are 0 outside 'walk').
export interface PartLag {
  yaw: number; // the body yaw this lag last saw
  swing: number; // limb swing amplitude 0..1
  hatP: number;
  hatY: number;
  beardP: number;
  beardY: number;
  beardVP: number;
  beardVY: number;
  roll: number; // the walk roll this lag last saw
  hatR: number; // hat roll lagging behind the body roll
}

export interface Volley {
  n: number; // gnomes thrown together
  bonusPaid: boolean; // the flat trick bonus is paid once per throw
}

const SQUASH_TIME = 0.15;
export const POP_TIME = 0.25;
export const GNOME_DAMPING = 0.15; // linear damping of every gnome body; the cannon and funnel arcs count it
const SWALLOW_TIME = 0.5; // an eaten gnome shrinks to 0 in this time
const SWALLOW_SPIN = Math.PI * 3; // radians around the hole axis over the swallow
// Gnome built from moving parts (demo on classic, PP 2026-10-20 "gnom z ruchomych czesci").
const PARTS_TYPES = new Set(['classic']);
const NPARTS = PART_ORDER.length;
const LEG_SWING = 0.8; // rad at full speed
// arms, sway and roll sized to read from behind at 6-10 m (PP 2026-10-20 "skup sie na bujaniu i ruchu rak")
const ARM_SWING = 0.6;
const FLAP = 0.3; // rad, each arm swings outward on its back swing
const ROLL = 0.2; // rad, body roll per step
const SWAY = 0.06; // m, body shift per step toward the side the roll tips the hat
// phase per metre that keeps the planted foot still: a step moves the body 2 · 0.17 m (leg) · sin(LEG_SWING)
const STRIDE = Math.PI / (2 * 0.17 * Math.sin(LEG_SWING));
const LEAN = 0.12; // rad into the move at full speed
// Ground friction keeps a walker at about 0.8 of its type speed, so the legs take full steps from a quarter of it:
// the step length stays 2 · 0.17 · sin(LEG_SWING) and only the cadence follows the speed (no sliding feet).
const SWING_FULL_AT = 0.25;
const SWING_LAMBDA = 7; // eases a stop in about 0.4 s without a jump of more than 0.1 rad per frame
const LAG_LAMBDA = 8; // hat follows the torso
const BEARD_K = 180; // beard spring: overshoots once
const BEARD_C = 12;
const BREATH = 0.03; // standing torso scale y amplitude
const HAT_NOISE = 0.08; // rad, standing hat wobble
const noise = new SimplexNoise();
const STRUGGLE_LINES = ['Let go!', 'Nooo!', 'I can see my house!', 'Put me DOWN!'];
// held gnomes stay quiet when their bubbles would cover the crosshair: a full Magnet Gun ball,
// or the Trick Scope glass (Lvl 2+, shown while something is held)
const heldQuiet = (): boolean => ctx.player.swarm.length > 3 || lvl('scope') >= 2;
// Trick Scope Lvl 3: held gnomes turn 90 % see-through so the player sees the target (PP 2026-10-22)
const SEE_TIME = 0.15;
const SEE_ALPHA = 0.1;

const NORMAL = groups(G.GNOME, G.GROUND | G.GNOME | G.PLAYER | G.STATIC | G.PROP);
const NONE = groups(G.GNOME, 0);
const HELD = groups(G.GNOME, G.GROUND | G.GNOME | G.STATIC | G.PROP);

export function isFree(g: Gnome): boolean {
  return g.state !== 'held' && g.state !== 'stashed' && g.state !== 'falling' && g.state !== 'gone';
}
export const SHADOW_GRACE = 20; // s a new Shadow Gnome stares before robots and tools may take it (PP 2026-10-21)
export const lurking = (g: Gnome): boolean => g.type.id === 'shadow' && g.life < SHADOW_GRACE;
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpM2 = new THREE.Matrix4();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
// Hats glow at night: one uniform shared by every gnome material, an emissive term masked by the 'glow' vertex attribute.
const NIGHT = { value: 0 };
const HAT_GLOW = 0.5;
const GOLD = { value: 0 }; // Midas: every gnome shines gold (PP 2026-10-24), one uniform shared like NIGHT

export class Gnomes {
  list: Gnome[] = [];
  byCollider = new Map<number, Gnome>();
  readonly meshes = new Map<string, THREE.InstancedMesh>();
  readonly seeMeshes = new Map<string, THREE.InstancedMesh>(); // gnomes fading to see-through (Trick Scope Lvl 3)
  // without multi-draw every part would be its own draw call: such a browser keeps one-piece gnomes
  readonly partsOn = ctx.renderer.extensions.has('WEBGL_multi_draw') && !new URLSearchParams(location.search).has('noparts');
  readonly parts = new Map<string, THREE.BatchedMesh>(); // part gnomes, NPARTS instances per slot
  readonly bodies = new Map<string, Float32Array>(); // every gnome's body matrix by slot (HIDDEN when stashed): replay, scenarios
  private partsDrawn = new Map<string, number>(); // slots written last frame, to hide the ones vacated since
  private fallbackTold = false;
  readonly slots = new Map<string, Gnome[]>();
  private nextId = 1;
  private volley: Volley | null = null; // the throw being dropped this frame
  private volleyAt = -1;
  private speechCd = 0;
  private wakeCheck = 0;

  constructor() {
    for (const t of GNOME_TYPES) {
      const mat = gnomeMat(t, false);
      const geo = gnomeGeometry(t);
      const mesh = new THREE.InstancedMesh(geo, mat, t.capacity);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      ctx.scene.add(mesh);
      this.meshes.set(t.id, mesh);
      // see-through pass for Trick Scope Lvl 3: same geometry, per-instance alpha, no shadow from a faded gnome
      geo.setAttribute('see', new THREE.InstancedBufferAttribute(new Float32Array(t.capacity), 1).setUsage(THREE.DynamicDrawUsage));
      const see = new THREE.InstancedMesh(geo, gnomeMat(t, true), t.capacity);
      see.count = 0;
      see.receiveShadow = true;
      see.frustumCulled = false;
      see.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      ctx.scene.add(see);
      this.seeMeshes.set(t.id, see);
      this.slots.set(t.id, []);
      this.bodies.set(t.id, new Float32Array(t.capacity * 16));
      if (this.partsOn && PARTS_TYPES.has(t.id)) {
        const geos = gnomeParts(t);
        const bm = new THREE.BatchedMesh(t.capacity * NPARTS, geos.reduce((n, g) => n + g.attributes.position.count, 0), undefined, mat);
        const ids = geos.map((g) => bm.addGeometry(g));
        // instance id = slot * NPARTS + part, all created hidden up front: spawn and remove never reallocate
        for (let s = 0; s < t.capacity; s++) for (let k = 0; k < NPARTS; k++) bm.setVisibleAt(bm.addInstance(ids[k]), false);
        bm.castShadow = true;
        bm.receiveShadow = true;
        bm.frustumCulled = false;
        // either flag on makes three walk and cull every instance on both passes each frame
        bm.perObjectFrustumCulled = false;
        bm.sortObjects = false;
        ctx.scene.add(bm);
        this.parts.set(t.id, bm);
      }
    }
    if (!this.partsOn) console.info('[gnomes] one-piece gnomes: WEBGL_multi_draw missing or ?noparts');
  }

  get hatGlow(): number {
    return NIGHT.value;
  }

  get goldShade(): number {
    return GOLD.value;
  }

  get maxGnomes(): number {
    return 120 + lvl('permit') * 40;
  }

  spawn(typeId: string, pos: THREE.Vector3, opts: { awake?: boolean; vel?: THREE.Vector3; yaw?: number; tier?: WeightTier['id']; xpTier?: WeightTier['id'] } = {}): Gnome | null {
    const base = TYPE_BY_ID[typeId];
    let goldFrom: string | null = null;
    // Golden Hour: every new gnome comes out golden and turns back into its own type when the event ends
    if (ctx.events.goldenHour > 0 && typeId !== 'golden' && typeId !== 'king' && typeId !== 'shadow' && this.slots.get('golden')!.length < TYPE_BY_ID.golden.capacity) {
      goldFrom = typeId;
      typeId = 'golden';
    }
    const type = TYPE_BY_ID[typeId];
    const slots = this.slots.get(typeId)!;
    if (slots.length >= type.capacity) return null;
    const { R, physics } = ctx;
    const yaw = opts.yaw ?? rand(0, Math.PI * 2);
    tmpQ.setFromAxisAngle(UP, yaw);
    // the king is a boss (type mass 40); a fat gnome is always heavy or massive
    const rolled = type.id === 'king' || opts.tier ? null : rollTiers(ctx.state.holeLevel, base.id === 'fat' ? 'heavy' : 'normal', Math.random, lvl('frenzy'));
    const tier = type.id === 'king' ? WEIGHT_TIERS.normal : opts.tier ? WEIGHT_TIERS[opts.tier] : rolled!.tier;
    const xpTier = rolled?.xpTier ?? (opts.xpTier ? WEIGHT_TIERS[opts.xpTier] : tier);
    const mass = type.id === 'king' ? type.mass : tier.mass;
    // size follows the weight class exactly, so the player can read the weight at a glance
    const scale = type.scale * tier.scale;
    const body = physics.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w })
        .setLinearDamping(GNOME_DAMPING)
        .setAngularDamping(0.6)
        .setCcdEnabled(false),
    );
    const collider = physics.createCollider(
      R.ColliderDesc.roundCuboid(0.15 * scale, 0.4 * scale, 0.15 * scale, 0.04 * scale)
        .setMass(mass)
        .setFriction(0.7)
        .setRestitution(0.15)
        .setCollisionGroups(NORMAL),
      body,
    );
    if (opts.vel) body.setLinvel(opts.vel, true);
    const awake = opts.awake ?? !base.statue;
    const g: Gnome = {
      id: this.nextId++, type, body, collider, slot: slots.length, state: awake ? 'walk' : 'statue', awake,
      timer: 0, think: rand(0, 0.5), target: null, yaw, scale, loot: 0, valueMult: 1, cooldown: 0, angryOverride: false,
      parade: -1, life: 0, thrownBy: null, noGrabUntil: 0, tier, xpTier,
      throwPos: null, touchedGround: false, bounced: false, bullseye: false, bullseyeAt: 0, volley: null, xpGroup: null, fullXp: false,
      prevVy: 0, squash: 0, screamed: false, pop: 0, goldFrom, scared: 0, fleeing: false,
      prevPos: new THREE.Vector3(pos.x, pos.y, pos.z), prevRot: tmpQ.clone(), ph: 0,
      lag: this.parts.has(typeId) ? { yaw, swing: 0, hatP: 0, hatY: 0, beardP: 0, beardY: 0, beardVP: 0, beardVY: 0, roll: 0, hatR: 0 } : null,
      seeT: 0,
    };
    if (awake) body.lockRotations(true, true);
    slots.push(g);
    this.list.push(g);
    this.byCollider.set(collider.handle, g);
    return g;
  }

  remove(g: Gnome): void {
    const slots = this.slots.get(g.type.id)!;
    const last = slots.pop()!;
    if (last !== g) {
      slots[g.slot] = last;
      last.slot = g.slot;
    }
    this.byCollider.delete(g.collider.handle);
    ctx.physics.removeRigidBody(g.body);
    // whoever still holds this gnome (a robot's target) sees it is not free and never reads the freed body
    g.state = 'gone';
    const i = this.list.indexOf(g);
    if (i >= 0) {
      this.list[i] = this.list[this.list.length - 1];
      this.list.pop();
    }
  }

  // Swap a free gnome for one of another type at the same spot, pose, motion and weight class.
  // The old gnome is removed: callers must not touch it afterwards.
  retype(g: Gnome, typeId: string): Gnome | null {
    const p = g.body.translation();
    const v = g.body.linvel();
    const n = this.spawn(typeId, new THREE.Vector3(p.x, p.y, p.z), { awake: g.awake, yaw: g.yaw, tier: g.tier.id, xpTier: g.xpTier.id, vel: new THREE.Vector3(v.x, v.y, v.z) });
    if (!n) return null;
    if (g.state === 'ragdoll') {
      this.ragdoll(n, g.timer, g.thrownBy);
      n.body.setAngvel(g.body.angvel(), true);
    }
    if (g.state !== 'walk') n.body.setRotation(g.body.rotation(), true);
    n.prevPos.copy(g.prevPos);
    n.prevRot.copy(g.prevRot);
    n.thrownBy = g.thrownBy;
    n.throwPos = g.throwPos;
    n.touchedGround = g.touchedGround;
    n.bounced = g.bounced;
    n.bullseye = g.bullseye;
    n.bullseyeAt = g.bullseyeAt;
    n.volley = g.volley;
    n.fullXp = g.fullXp;
    n.xpGroup = g.xpGroup;
    n.screamed = g.screamed;
    n.noGrabUntil = g.noGrabUntil;
    n.prevVy = g.prevVy;
    n.parade = g.parade;
    n.angryOverride = g.angryOverride;
    n.loot = g.loot;
    n.valueMult = g.valueMult;
    n.life = g.life;
    n.ph = g.ph; // keeps the stride going instead of restarting the step
    if (g.lag && n.lag) Object.assign(n.lag, g.lag, { yaw: n.yaw });
    n.pop = POP_TIME;
    this.remove(g);
    return n;
  }

  ragdoll(g: Gnome, seconds = rand(2.5, 4.5), by: Gnome['thrownBy'] = null): void {
    if (!isFree(g)) return;
    if (g.state === 'walk' || g.state === 'statue') g.body.lockRotations(false, true);
    g.state = 'ragdoll';
    g.timer = seconds;
    if (by) g.thrownBy = by;
  }

  // Hide a gnome inside a crate or cannon.
  stash(g: Gnome): void {
    g.state = 'stashed';
    g.seeT = 0; // leaves the crate or cannon opaque
    g.body.setEnabled(false);
  }

  // The player's magnet takes hold of a gnome; gravity still acts, the magnet force fights it.
  hold(g: Gnome): void {
    if (g.state === 'walk' || g.state === 'statue') g.body.lockRotations(false, true);
    g.state = 'held';
    g.collider.setCollisionGroups(HELD);
    g.xpGroup = null; // hands hold one; a re-grabbed ball member starts a fresh group
    g.timer = rand(1.5, 3); // next struggle line
    if (!heldQuiet() && Math.random() < 0.4) this.say(g, pick(g.type.lines), true);
  }

  // Let go of a held gnome; with an impulse it is a throw (heavy gnomes fly shorter).
  drop(g: Gnome, impulse?: THREE.Vector3): void {
    g.collider.setCollisionGroups(NORMAL);
    if (impulse) {
      g.body.applyImpulse(impulse, true);
      g.body.setAngvel({ x: rand(-6, 6), y: rand(-4, 4), z: rand(-6, 6) }, true);
      g.noGrabUntil = ctx.time + 1.5;
      const p = g.body.translation();
      g.throwPos = new THREE.Vector3(p.x, p.y, p.z);
      g.touchedGround = g.bounced = g.bullseye = g.screamed = false;
      // every gnome a throw lets go of is dropped in the same frame: same game time = same throw
      if (this.volleyAt !== ctx.time || !this.volley) {
        this.volley = { n: 0, bonusPaid: false };
        this.volleyAt = ctx.time;
      }
      this.volley.n++;
      g.volley = this.volley;
    }
    g.state = 'ragdoll';
    g.timer = rand(2.5, 4);
    g.thrownBy = 'player';
  }

  // Let a stashed gnome out again.
  release(g: Gnome, pos: THREE.Vector3, vel: THREE.Vector3): void {
    g.body.setEnabled(true);
    g.body.lockRotations(false, true);
    g.body.setTranslation(pos, true);
    savePose(g, g.body);
    g.body.setLinvel(vel, true);
    g.body.setAngvel({ x: rand(-6, 6), y: rand(-4, 4), z: rand(-6, 6) }, true);
    g.state = 'ragdoll';
    g.timer = rand(2.5, 4);
    // let out by a machine (crate tipped over, tool taken back, cannon): not a throw, as the crate dump (machines.ts dump branch)
    g.thrownBy = 'machine';
    g.throwPos = null;
    g.fullXp = false;
    g.bounced = false;
    g.bullseye = false;
  }

  wake(g: Gnome): void {
    if (g.awake) return;
    g.awake = true;
    if (g.state === 'statue') {
      g.state = 'ragdoll';
      g.timer = 0.3;
      // a little hop out of the statue pose
      g.body.applyImpulse({ x: 0, y: 3 * g.body.mass(), z: 0 }, true);
      const p = g.body.translation();
      ctx.fx.puff(new THREE.Vector3(p.x, p.y, p.z), 0xd8d2c4);
    }
    if (Math.random() < 0.4) this.say(g, pick(['Huh?!', 'I LIVE!', 'Where am I?', 'Who threw me?', '*yawn*']));
  }

  say(g: Gnome, text: string, force = false): void {
    if (!force && this.speechCd > 0) return;
    const p = g.body.translation();
    const d = ctx.player.position.distanceTo(tmpV.set(p.x, p.y, p.z));
    if (d > 22) return;
    this.speechCd = 1.2;
    ctx.hud.speech(tmpV.clone().setY(p.y + 0.8 * g.scale), text);
    ctx.audio.voice(text.includes('!') ? 'hey' : 'curse', 1.4 / g.scale);
  }

  pickSpawnType(rnd: () => number = Math.random): string {
    const hl = ctx.state.holeLevel;
    if (hl >= TYPE_BY_ID.boom.unlock && rnd() < BOOM_CHANCE) return 'boom';
    // hole level 9 adds a flat 2.6 % (3 % total without Gold Fever): x3 was 1.2 %, nobody noticed (night balance F11)
    const goldChance = 0.004 + lvl('goldChance') * 0.004 + (hl >= 9 ? 0.026 : 0);
    if (rnd() < goldChance) return 'golden';
    let total = 0;
    const pool = GNOME_TYPES.filter((t) => t.weight > 0 && t.unlock <= hl);
    for (const t of pool) total += t.weight;
    let r = rnd() * total;
    for (const t of pool) {
      r -= t.weight;
      if (r <= 0) return t.id;
    }
    return 'classic';
  }

  // Anything but an ordinary garden gnome: those come only from the factory.
  pickSpecialType(): string {
    // the Boom Gnome keeps its own share of the rain instead of the bigger share among special types
    if (ctx.state.holeLevel >= TYPE_BY_ID.boom.unlock && Math.random() < BOOM_CHANCE) return 'boom';
    for (let i = 0; i < 20; i++) {
      const id = this.pickSpawnType();
      if (id !== 'classic' && id !== 'blue' && id !== 'boom') return id;
    }
    return Math.random() < 0.5 ? 'golden' : 'dwarf';
  }

  // Conga line circling the hole, kept inside the fence.
  paradePoint(i: number): THREE.Vector3 {
    const env = ctx.env;
    const t = ctx.time * 0.25 + i * 0.18;
    const R = env.holeRadius + 6;
    return env.clampTo(new THREE.Vector3(env.hole.x + Math.cos(t) * R, 0, env.hole.z + Math.sin(t) * R), 2);
  }

  forEachNear(pos: THREE.Vector3, r: number, cb: (g: Gnome, d: number, p: RAPIER.Vector) => void, all = false): void {
    const r2 = r * r;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      if (!isFree(g) || (!all && lurking(g))) continue;
      const p = g.body.translation();
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      const dz = p.z - pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2) cb(g, Math.sqrt(d2), p);
    }
  }

  startFalling(g: Gnome): void {
    if (!isFree(g)) return;
    if (g.state === 'walk' || g.state === 'statue') g.body.lockRotations(false, true);
    g.state = 'falling';
    g.timer = 0; // counts up: seconds since the fall started, drives the swallow animation
    g.collider.setCollisionGroups(NONE);
    ctx.env.holePulse();
    const p = g.body.translation();
    const v = g.body.linvel();
    const h = ctx.env.hole;
    g.body.setLinvel({ x: v.x * 0.3 + (h.x - p.x) * 1.5, y: Math.min(v.y, 0) - 2, z: v.z * 0.3 + (h.z - p.z) * 1.5 }, true);
    if (Math.random() < 0.35) ctx.audio.voice('scream', 1.3 / g.scale);
  }

  update(dt: number): void {
    // the look follows the "next N gnomes x3" counter, not the 30 s timer
    GOLD.value = THREE.MathUtils.damp(GOLD.value, ctx.buffs.midasLeft > 0 ? 1 : 0, 12, dt);
    if (!this.partsOn && !this.fallbackTold) {
      this.fallbackTold = true;
      ctx.hud.toast('Gnome parts off: no WEBGL_multi_draw', 'info');
    }
    this.speechCd -= dt;
    const env = ctx.env;
    const hl = ctx.state.holeLevel;

    // statues slowly wake up
    this.wakeCheck -= dt;
    if (this.wakeCheck <= 0) {
      this.wakeCheck = 4;
      const chance = (0.015 + hl * 0.01) * Math.pow(0.85, lvl('glue')) * (ctx.buffs.active('chaos') ? 3 : 1);
      for (const g of this.list) if (!g.awake && isFree(g) && Math.random() < chance) this.wake(g);
    }

    const pp = ctx.player.position;
    const r = env.holeRadius;
    const see = lvl('scope') >= 3;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      if (g.lag) this.updateLag(g, g.lag, dt);
      if (g.state === 'stashed') continue;
      g.seeT = THREE.MathUtils.clamp(g.seeT + (g.state === 'held' && see ? dt : -dt) / SEE_TIME, 0, 1);
      if (g.squash > 0) g.squash -= dt;
      if (g.pop > 0) g.pop -= dt;
      if (g.state === 'held') {
        g.prevVy = 0;
        // a gnome dragged low over the hole slips off the magnet and falls in
        const hp = g.body.translation();
        if (env.holeDist(hp.x, hp.z) < env.holeRadius && hp.y < 1.4 * g.scale) {
          this.drop(g);
          this.startFalling(g);
          continue;
        }
        g.timer -= dt;
        if (g.timer <= 0) {
          g.timer = rand(1.5, 3);
          if (!heldQuiet()) this.say(g, pick(STRUGGLE_LINES), true);
        }
        continue;
      }
      g.life += dt;
      const p = g.body.translation();

      if (g.state === 'falling') {
        g.timer += dt;
        if (p.y < -2.6) ctx.hole.consume(g);
        continue;
      }

      const dc = env.holeDist(p.x, p.z);
      if (dc < r && p.y < 1.4 * g.scale) {
        this.startFalling(g);
        continue;
      }
      if (p.y < -8 || !env.inside(p.x, p.z, -30)) {
        this.remove(g);
        continue;
      }

      g.cooldown -= dt;
      if (g.state === 'ragdoll') {
        g.timer -= dt;
        if (g.throwPos && p.y < 0.5 * g.scale + 0.05) g.touchedGround = true;
        const v = g.body.linvel();
        // landing: the fall speed vanished since last frame (ground or a machine stopped it)
        const dv = v.y - g.prevVy;
        g.prevVy = v.y;
        if (dv > 5) {
          const s = Math.min(1, (dv - 5) / 10);
          const m = g.body.mass();
          ctx.fx.dust(tmpV.set(p.x, p.y - 0.45 * g.scale, p.z), s);
          ctx.audio.impact(s, m);
          if (s > 0.3 && tmpV.distanceToSquared(ctx.player.position) < 36) ctx.fx.shake(0.15 * s);
          g.squash = SQUASH_TIME;
        }
        // a player throw that really flies makes the gnome scream once (lighter = higher)
        if (g.throwPos && !g.screamed && v.x * v.x + v.y * v.y + v.z * v.z > 100) {
          g.screamed = true;
          ctx.audio.voice('scream', Math.pow(1.2 / g.body.mass(), 0.35));
        }
        if (g.timer <= 0 && g.awake && v.x * v.x + v.y * v.y + v.z * v.z < 0.6 && p.y < 1.2 * g.scale) this.standUp(g, p);
        continue;
      }
      if (g.state === 'statue') {
        g.prevVy = 0;
        continue;
      }

      // walking: detect being hit hard
      const v = g.body.linvel();
      g.prevVy = v.y;
      const hs = Math.hypot(v.x, v.z);
      g.ph += (hs * dt * STRIDE) / g.scale;
      if (hs > g.type.speed * 1.6 + 3.5 || v.y > 3.5) {
        this.ragdoll(g);
        continue;
      }

      // scared while the player is close, calms down after FLEE.calm s with the player far away
      const dP = Math.hypot(pp.x - p.x, pp.z - p.z);
      if (dP < FLEE.near) g.scared = FLEE.calm;
      else if (dP > FLEE.far && g.scared > 0) g.scared -= dt;

      g.think -= dt;
      if (g.think <= 0) {
        g.think = rand(0.25, 0.45);
        this.decide(g, p, pp, r);
        // decide() may remove the gnome (escaped, vanished); its body is gone then
        if (this.list[i] !== g) continue;
      }

      let vx = 0;
      let vz = 0;
      if (g.target) {
        const dx = g.target.x - p.x;
        const dz = g.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.4) {
          let sp = g.type.speed * (g.parade >= 0 ? 1.6 : 1);
          if (g.angryOverride) sp *= 1.3;
          if (g.fleeing) sp *= FLEE.speed * (g.type.id === 'king' ? FLEE.king : g.tier.flee);
          vx = (dx / d) * sp;
          vz = (dz / d) * sp;
          // keep awake gnomes away from the hole (unless it is a parade)
          if (g.parade < 0 && dc < r + 2.2) {
            vx += ((p.x - env.hole.x) / dc) * 3;
            vz += ((p.z - env.hole.z) / dc) * 3;
          }
          const yaw = Math.atan2(vx, vz);
          g.yaw = THREE.MathUtils.damp(g.yaw, g.yaw + angleDiff(g.yaw, yaw), 8, dt);
        } else {
          g.target = null;
        }
      }
      g.body.setLinvel({ x: vx, y: Math.min(v.y, 2), z: vz }, true);
      tmpQ.setFromAxisAngle(UP, g.yaw);
      g.body.setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }, true);
    }
  }

  savePoses(): void {
    for (const g of this.list) savePose(g, g.body);
  }

  // Hat follows the torso (first order), beard is a spring, limb swing eases in and out; all from the real velocity,
  // so a walker stuck at a wall stands instead of marching. Outside 'walk' every target is 0.
  private updateLag(g: Gnome, l: PartLag, dt: number): void {
    const v = g.body.linvel();
    const a = g.state === 'walk' ? Math.min(1, Math.hypot(v.x, v.z) / g.type.speed) : 0;
    const lean = LEAN * a;
    const dYaw = angleDiff(l.yaw, g.yaw);
    l.yaw = g.yaw;
    const roll = walkRoll(g, a);
    l.hatR = THREE.MathUtils.damp(l.hatR - (roll - l.roll), 0, LAG_LAMBDA, dt);
    l.roll = roll;
    l.swing = THREE.MathUtils.damp(l.swing, Math.min(1, a / SWING_FULL_AT), SWING_LAMBDA, dt);
    l.hatY = THREE.MathUtils.damp(l.hatY - dYaw, 0, LAG_LAMBDA, dt);
    l.hatP = THREE.MathUtils.damp(l.hatP, lean, LAG_LAMBDA, dt);
    l.beardY -= dYaw;
    l.beardVY += (-l.beardY * BEARD_K - l.beardVY * BEARD_C) * dt;
    l.beardY += l.beardVY * dt;
    l.beardVP += ((lean - l.beardP) * BEARD_K - l.beardVP * BEARD_C) * dt;
    l.beardP += l.beardVP * dt;
  }

  private standUp(g: Gnome, p: RAPIER.Vector): void {
    g.state = 'walk';
    g.thrownBy = null;
    g.throwPos = null;
    g.fullXp = false;
    g.body.lockRotations(true, true);
    g.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    tmpQ.setFromAxisAngle(UP, g.yaw);
    g.body.setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }, true);
    g.body.setTranslation({ x: p.x, y: Math.max(p.y, 0.47 * g.scale + 0.05), z: p.z }, true);
    savePose(g, g.body);
    if (Math.random() < 0.25) this.say(g, pick(g.type.lines));
  }

  private decide(g: Gnome, p: RAPIER.Vector, pp: THREE.Vector3, r: number): void {
    const dx = pp.x - p.x;
    const dz = pp.z - p.z;
    const dPlayer = Math.hypot(dx, dz);
    const beh = g.angryOverride ? 'charge' : g.type.behaviour;
    g.fleeing = false;

    if (g.parade >= 0) {
      g.target = this.paradePoint(g.parade);
      return;
    }

    switch (beh) {
      case 'charge':
        if (dPlayer < 12 && g.cooldown <= 0) {
          g.target = pp.clone();
          if (dPlayer < 1.3) {
            g.cooldown = 3.5;
            ctx.player.hitBy(new THREE.Vector3(dx, 0, dz).normalize(), 7);
            this.say(g, pick(g.type.lines), true);
            ctx.audio.spit();
            ctx.hud.splat();
          }
          return;
        }
        if (g.cooldown > 0 && dPlayer < 6) {
          g.target = new THREE.Vector3(p.x - dx, 0, p.z - dz);
          return;
        }
        // bored angry gnomes kick other gnomes around
        if (Math.random() < 0.08) {
          let kicked = false;
          this.forEachNear(new THREE.Vector3(p.x, p.y, p.z), 1.4, (o) => {
            if (kicked || o === g) return;
            kicked = true;
            this.ragdoll(o);
            o.body.applyImpulse({ x: rand(-3, 3) * o.type.mass, y: 3 * o.type.mass, z: rand(-3, 3) * o.type.mass }, true);
          });
        }
        break;
      case 'flee':
        if (dPlayer < 10) {
          tmpV.set(-dx, 0, -dz).normalize().multiplyScalar(6);
          g.target = ctx.env.clampTo(new THREE.Vector3(p.x + tmpV.x, 0, p.z + tmpV.z), 1.5);
          if (Math.random() < 0.05) this.say(g, pick(g.type.lines));
          return;
        }
        break;
      case 'steal': {
        if (g.loot > 0) {
          // run to the nearest fence and escape over it
          // each candidate differs from p on one axis only, so |dx| + |dz| is its distance
          const { min, max } = ctx.env;
          const best = [
            new THREE.Vector3(min.x + 0.5, 0, p.z),
            new THREE.Vector3(max.x - 0.5, 0, p.z),
            new THREE.Vector3(p.x, 0, min.z + 0.5),
            new THREE.Vector3(p.x, 0, max.z - 0.5),
          ].reduce((a, b) => (Math.abs(b.x - p.x) + Math.abs(b.z - p.z) < Math.abs(a.x - p.x) + Math.abs(a.z - p.z) ? b : a));
          const bd = best.distanceTo(tmpV.set(p.x, 0, p.z));
          if (bd < 1.5) {
            ctx.state.stats.stolen += g.loot;
            ctx.hud.toast(`A greedy gnome got away with ${money(g.loot)}!`, 'bad');
            ctx.fx.burst(new THREE.Vector3(p.x, p.y, p.z), 0x2e9e4f, 20);
            this.remove(g);
            return;
          }
          g.target = best;
          return;
        }
        const coin = ctx.coins.nearestFree(new THREE.Vector3(p.x, p.y, p.z), 30);
        if (coin) {
          g.target = coin.pos.clone();
          if (coin.pos.distanceTo(tmpV.set(p.x, coin.pos.y, p.z)) < 0.9) {
            g.loot += ctx.coins.steal(coin);
            this.say(g, pick(g.type.lines));
          }
          return;
        }
        break;
      }
      case 'sabotage': {
        if (g.cooldown <= 0) {
          const m = ctx.machines.nearestWorking(new THREE.Vector3(p.x, p.y, p.z));
          if (m) {
            g.target = m.pos.clone();
            if (m.pos.distanceTo(tmpV.set(p.x, m.pos.y, p.z)) < 1.8) {
              ctx.machines.breakMachine(m);
              g.cooldown = 12;
              this.say(g, pick(g.type.lines), true);
              ctx.audio.voice('laugh');
            }
            return;
          }
        }
        break;
      }
      case 'stalk': {
        g.target = null;
        g.yaw = Math.atan2(dx, dz);
        if (dPlayer < 4) {
          ctx.fx.burst(new THREE.Vector3(p.x, p.y, p.z), 0x000000, 25);
          this.remove(g);
          ctx.audio.whisper();
          return;
        }
        // clicks now and then while it stares (the 20 s grace); a removed shadow stops them by itself
        if (lurking(g) && Math.random() < 0.25) ctx.audio.clicks(p.x, p.z);
        if (g.life > 45) {
          const take = Math.floor(ctx.state.money * 0.05);
          ctx.state.money -= take;
          ctx.hud.toast(`Something took ${money(take)} in the dark...`, 'bad');
          ctx.audio.whisper();
          this.remove(g);
        }
        return;
      }
      case 'cast':
        if (g.cooldown <= 0) {
          g.cooldown = rand(6, 10);
          let n = 0;
          const hc = ctx.env.hole;
          this.forEachNear(hc, r + 5, (o) => {
            if (n >= 8 || o === g) return;
            n++;
            this.ragdoll(o);
            const op = o.body.translation();
            const d = ctx.env.holeDist(op.x, op.z) || 1;
            o.body.setLinvel({ x: ((op.x - hc.x) / d) * 6, y: 7, z: ((op.z - hc.z) / d) * 6 }, true);
            ctx.fx.burst(new THREE.Vector3(op.x, op.y, op.z), 0xb07aff, 8);
          });
          if (n > 0 || Math.random() < 0.5) {
            this.say(g, pick(g.type.lines), true);
            ctx.audio.magic();
            ctx.fx.burst(new THREE.Vector3(p.x, p.y + 1, p.z), 0xb07aff, 30);
          }
          if (n === 0 && Math.random() < 0.5) {
            const np = ctx.env.randomPoint(3, 0.6);
            if (ctx.env.holeDist(np.x, np.z) > r + 4) {
              g.body.setTranslation(np, true);
              savePose(g, g.body);
              ctx.fx.burst(np, 0xb07aff, 25);
            }
          }
          return;
        }
        break;
      case 'boss':
        // a scared king backs off slowly but still stomps
        if (g.scared > 0) this.fleeFrom(g, p, dx, dz);
        else g.target = pp.clone();
        if (g.cooldown <= 0 && dPlayer < 9) {
          g.cooldown = 5;
          ctx.fx.shake(0.6);
          ctx.audio.rumble(0.8);
          this.say(g, pick(g.type.lines), true);
          this.forEachNear(new THREE.Vector3(p.x, p.y, p.z), 7, (o) => {
            if (o === g) return;
            this.ragdoll(o);
            o.body.applyImpulse({ x: 0, y: 5 * o.type.mass, z: 0 }, true);
          });
          if (dPlayer < 5) ctx.player.hitBy(new THREE.Vector3(dx, 0, dz).normalize(), 14);
        }
        return;
    }

    // default: back off from a close player (charging, stalking, fleeing and coin-chasing gnomes returned above), else wander
    if (g.scared > 0 && beh !== 'charge') {
      this.fleeFrom(g, p, dx, dz);
      return;
    }
    if (!g.target || Math.random() < 0.08) {
      for (let k = 0; k < 4; k++) {
        const t = ctx.env.clampTo(new THREE.Vector3(p.x + rand(-8, 8), 0, p.z + rand(-8, 8)), 2);
        if (ctx.env.holeDist(t.x, t.z) > r + 3) {
          g.target = t;
          break;
        }
      }
    }
    if (Math.random() < 0.012) this.say(g, pick(g.type.lines));
  }

  // Walk target 6 m straight away from the player, kept inside the fence (no pathfinding).
  private fleeFrom(g: Gnome, p: RAPIER.Vector, dx: number, dz: number): void {
    tmpV.set(-dx, 0, -dz).normalize().multiplyScalar(6);
    g.target = ctx.env.clampTo(new THREE.Vector3(p.x + tmpV.x, 0, p.z + tmpV.z), 1.5);
    g.fleeing = true;
  }

  // Called by the game loop after the physics steps, with ctx.renderAlpha set.
  writeInstances(): void {
    NIGHT.value = ctx.env.nightShade;
    for (const [id, slots] of this.slots) {
      const mesh = this.meshes.get(id)!;
      const bm = this.parts.get(id);
      const bodies = this.bodies.get(id)!;
      const seeMesh = this.seeMeshes.get(id)!;
      const seeA = seeMesh.geometry.getAttribute('see') as THREE.InstancedBufferAttribute;
      let m = 0; // see-through gnomes, packed like n
      let n = 0; // one-piece gnomes are packed at the front of the InstancedMesh
      for (let i = 0; i < slots.length; i++) {
        const g = slots[i];
        if (g.state === 'stashed') {
          HIDDEN.toArray(bodies, i * 16);
          if (bm) for (let k = 0; k < NPARTS; k++) bm.setVisibleAt(i * NPARTS + k, false);
          continue;
        }
        drawPose(g, g.body, tmpV, tmpQ);
        let sy = g.scale;
        let sxz = g.scale;
        let lean = 0; // the body's lean this frame, which hat and beard counter
        if (g.state === 'walk') {
          // pose from the velocity: bob per step, roll alternating with the steps, lean into the move
          const v = g.body.linvel();
          const hs = Math.hypot(v.x, v.z);
          const a = Math.min(1, hs / g.type.speed);
          if (a > 0.01) {
            const ph = g.ph;
            lean = LEAN * a;
            tmpA.set(v.z / hs, 0, -v.x / hs); // the gnome's local +X; a positive roll tips the hat toward -X
            tmpV.y += Math.abs(Math.sin(ph)) * 0.05 * a * g.scale;
            tmpV.addScaledVector(tmpA, -Math.sin(ph) * SWAY * a * g.scale);
            tmpQ.multiply(tmpQ2.setFromAxisAngle(FWD, walkRoll(g, a)));
            tmpQ.premultiply(tmpQ2.setFromAxisAngle(tmpA, lean));
          }
        } else if (g.state === 'falling') {
          // swallowed: shrink to nothing while swirling around the hole axis
          const e = inQuad(Math.min(1, g.timer / SWALLOW_TIME));
          sy *= 1 - e;
          sxz *= 1 - e;
          const h = ctx.env.hole;
          tmpQ2.setFromAxisAngle(UP, SWALLOW_SPIN * e);
          tmpV.sub(tmpA.set(h.x, tmpV.y, h.z)).applyQuaternion(tmpQ2).add(tmpA);
          tmpQ.premultiply(tmpQ2);
        }
        if (g.squash > 0) {
          // landing squash, eased back to normal
          const k = g.squash / SQUASH_TIME;
          const e = k * k * (3 - 2 * k);
          sy *= 1 - 0.3 * e;
          sxz *= 1 + 0.2 * e;
        }
        if (g.pop > 0) {
          // grows in after a type swap, with a small overshoot
          const e = outBack(1 - g.pop / POP_TIME);
          sy *= e;
          sxz *= e;
        }
        if (g.state === 'held') {
          // struggling on the magnet: wiggle around the gnome's own up axis
          tmpQ.multiply(tmpQ2.setFromAxisAngle(UP, Math.sin(ctx.time * Math.PI * 16) * 0.25));
        }
        tmpM.compose(tmpV, tmpQ, tmpS.set(sxz, sy, sxz));
        tmpM.toArray(bodies, i * 16);
        if (g.seeT > 0) {
          // a held gnome does not walk, so its parts are at rest and drawing it in one piece shows no jump
          if (bm) for (let k = 0; k < NPARTS; k++) bm.setVisibleAt(i * NPARTS + k, false);
          seeA.setX(m, 1 - (1 - SEE_ALPHA) * outCubic(g.seeT));
          seeMesh.setMatrixAt(m++, tmpM);
        } else if (g.lag && bm) {
          this.writeParts(bm, g, g.lag, i, tmpM, lean);
        } else {
          if (bm) for (let k = 0; k < NPARTS; k++) bm.setVisibleAt(i * NPARTS + k, false);
          mesh.setMatrixAt(n++, tmpM);
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      seeMesh.count = m;
      if (m) {
        seeMesh.instanceMatrix.needsUpdate = true;
        seeA.needsUpdate = true;
      }
      if (bm) {
        for (let k = slots.length * NPARTS; k < (this.partsDrawn.get(id) ?? 0) * NPARTS; k++) bm.setVisibleAt(k, false);
        this.partsDrawn.set(id, slots.length);
      }
    }
  }

  // The 7 parts of one gnome: each turns around its joint inside the body matrix.
  private writeParts(bm: THREE.BatchedMesh, g: Gnome, l: PartLag, slot: number, bodyM: THREE.Matrix4, lean: number): void {
    // breathing and hat wobble fade in as the limbs come to rest, so a stop has no jump
    const idle = g.state === 'walk' ? 1 - l.swing : 0;
    const s = Math.sin(g.ph) * l.swing;
    for (let k = 0; k < NPARTS; k++) {
      let p = 0;
      let y = 0;
      let r = 0;
      let sy = 1;
      switch (PART_ORDER[k]) {
        case 'torso':
          sy = 1 + idle * BREATH * Math.sin(Math.PI * (ctx.time + g.id * 0.37));
          break;
        case 'hat':
          p = l.hatP - lean + idle * HAT_NOISE * noise.noise(g.id * 3.1, ctx.time * 0.6);
          y = l.hatY;
          r = idle * HAT_NOISE * noise.noise(g.id * 3.1 + 7, ctx.time * 0.6) + l.hatR;
          break;
        case 'beard':
          p = l.beardP - lean;
          y = l.beardY;
          break;
        // a positive roll moves the hand toward +X: outward for armR on its back swing (s > 0), for armL on s < 0
        case 'armL': p = -ARM_SWING * s; r = FLAP * s; break;
        case 'armR': p = ARM_SWING * s; r = FLAP * s; break;
        case 'legL': p = LEG_SWING * s; break;
        case 'legR': p = -LEG_SWING * s; break;
      }
      tmpM2.compose(tmpP.fromArray(PART_PIVOT[PART_ORDER[k]]), tmpQ2.setFromEuler(tmpE.set(p, y, r)), tmpS.set(1, sy, 1));
      tmpM2.premultiply(bodyM);
      bm.setMatrixAt(slot * NPARTS + k, tmpM2);
      bm.setVisibleAt(slot * NPARTS + k, true);
    }
  }

  clearAll(): void {
    while (this.list.length) this.remove(this.list[this.list.length - 1]);
  }
}

// The gnome material: night hat glow and Midas gold; `see` adds the per-instance alpha of the see-through pass.
function gnomeMat(t: GnomeType, see: boolean): THREE.MeshStandardMaterial {
  // golden gnomes are shiny for good (PP 2026-10-24 "zlote blyszczace"); without an envMap metalness 0.6 read
  // brown at night, so less metal and more glow keep them brighter than a classic gnome (2026-10-25)
  const mat = vcMat(t.id === 'golden' ? { metalness: 0.3, roughness: 0.35, emissive: 0x553800 } : t.emissiveEyes ? { emissive: 0x111111 } : {});
  mat.transparent = see;
  // runs again on every recompile (the quality switch sets needsUpdate), so the shared uniform is attached here
  mat.onBeforeCompile = (s) => {
    s.uniforms.night = NIGHT;
    s.uniforms.gold = GOLD;
    s.uniforms.hatGlow = { value: new THREE.Color(t.hat).multiplyScalar(HAT_GLOW) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', 'attribute float glow;\nvarying float vGlow;\n#include <common>')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    // the hat keeps its colour (1.0 - vGlow) so the type stays readable under Midas
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', 'uniform float night;\nuniform float gold;\nuniform vec3 hatGlow;\nvarying float vGlow;\n#include <common>')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.25), 0.7 * gold * (1.0 - vGlow));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, gold);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.6, gold);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += hatGlow * (vGlow * night) + vec3(0.45, 0.3, 0.06) * gold * (1.0 - vGlow);');
    if (!see) return;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', 'attribute float see;\nvarying float vSee;\n#include <common>')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSee = see;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', 'varying float vSee;\n#include <common>')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vSee;');
  };
  mat.customProgramCacheKey = () => (see ? 'gnome-hatglow-gold-see' : 'gnome-hatglow-gold');
  return mat;
}

// body roll of a walker at speed fraction a, shared by the drawn body and the hat lag
function walkRoll(g: Gnome, a: number): number {
  return Math.sin(g.ph) * ROLL * a;
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
