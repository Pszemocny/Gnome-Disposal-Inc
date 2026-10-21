import * as THREE from 'three';
import { ctx, deep, lvl, rand } from '../core/context';
import { BOOM } from '../data/gnomeTypes';
import { blockSaves, freshState, saveState } from '../core/state';
import { money } from '../core/format';
import { HOLE_LEVELS, MAX_HOLE_LEVEL, holeLevel } from '../data/holeLevels';
import { KEEP_TOOL_IDS } from '../data/upgrades';
import { LAND } from '../data/land';
import type { Gnome } from '../entities/gnomes';
import { machineBox, type Machine } from '../entities/machines';
import { glowTexture } from '../entities/mushrooms';
import { inOutSine, inQuad } from '../core/ease';

declare module '../core/state' {
  interface GameState {
    runEatenStart?: number; // stats.gnomesEaten when this run began (shards count this run's gnomes); missing in older saves
  }
}

const TIERS: [number, string][] = [
  [5, 'Nice!'],
  [15, 'Gnomazing!'],
  [30, 'Gnomenal!!'],
  [60, 'GNOMEGEDDON!!!'],
  [100, 'HOLE-Y MOLY!!!!'],
  [200, 'THE HOLE IS PLEASED'],
];
const WAVE_TIME = 0.8;
const RAY_TIME = 0.6;
const RAY_COUNT = 10;
export const TRICK_CAP = 20;
// a Magnet Gun volley (n > 1 gnomes in one throw): the trick product is capped lower and the flat bonus is paid
// once per throw, otherwise every gnome of a 70-gnome ball scored the full trick (night plan F2)
export const VOLLEY_CAP = 8; // PP 2026-10-20: raised from 4 so AIR still pays on a SNIPER volley
// XP for a gnome a machine, crate, robot, plow, blower or kick fed (PP 2026-10-20 10a); a hand throw pays x1,
// a Magnet Gun ball x1/sqrt(n); the King always pays his full XP
export const FEED_XP = 0.25;
const RIM_CARRY = 1.5; // tools within this distance of the rim move with the hole (night plan F7)
const MACHINE_GLIDE = 0.25; // seconds a carried tool takes to follow a level-up
const MACHINE_GONE = 0.2; // seconds a swallowed tool shrinks before it goes back to the inventory
const DEFAULT_BOX = { half: [1, 1, 1], center: [0, 1, 0] };
// flat $ per trick on top of the multiplier (the armchair pays $250 once)
const TRICK_BONUS = { air: 10, long: 20, trick: 25, sniper: 40, bullseye: 60 };

export class Hole {
  combo = 0;
  comboTimer = 0;
  // where coins and effects come out of the hole
  get holeOrigin(): THREE.Vector3 {
    return ctx.env.hole.clone().setY(0.3);
  }

  get comboWindow(): number {
    return 2.5 + lvl('comboWindow') * 0.4;
  }

  get comboCap(): number {
    // every Land tier adds +0.5, so land is a money upgrade too (night plan F14)
    return 2 + lvl('comboCap') * 0.5 + deep('dCombo') * 0.5 + ctx.state.land * 0.5 + (ctx.buffs.active('combo') ? 1 : 0);
  }

  get comboMult(): number {
    return Math.min(1 + this.combo * 0.05, this.comboCap);
  }

  get mult(): number {
    return holeLevel(ctx.state.holeLevel).mult;
  }

  // Everything that scales money besides the gnome itself and the combo.
  get valueScale(): number {
    const shovel = ctx.state.secrets.includes('shovel') ? 1.1 : 1;
    return this.mult * (1 + lvl('value') * 0.1) * (1 + deep('dValue') * 0.2) * shovel;
  }

  get xpNeeded(): number {
    return HOLE_LEVELS[ctx.state.holeLevel - 1].xp;
  }

  earn(v: number): void {
    const s = ctx.state;
    s.money += v;
    s.totalEarned += v;
    s.lifetimeEarned += v;
    ctx.hud.moneyPulse();
  }

  // `machine`: a machine ate it on the spot or tipped it in (crate dump, vacuum, black hole, robot), whoever threw it
  consume(g: Gnome, at?: THREE.Vector3, machine = false): void {
    const s = ctx.state;
    const gain = ctx.buffs.active('combo') ? 2 : 1;
    const before = this.combo;
    this.combo += gain;
    this.comboTimer = this.comboWindow;
    // trick shots: only for gnomes the player threw (not dropped, not machine-fed)
    const tricks: string[] = [];
    let trick = 1;
    // a gnome is worth only $1 early on, so a multiplier alone pays almost nothing: every trick also pays
    // a flat bonus (x hole multiplier), so a few trick shots beat dumping the armchair (PP 2026-10-20)
    let bonus = 0;
    if (g.throwPos && g.thrownBy === 'player') {
      const dist = ctx.env.holeDist(g.throwPos.x, g.throwPos.z);
      if (dist >= 14) {
        trick *= 4;
        bonus += TRICK_BONUS.sniper;
        tricks.push('SNIPER x4');
        s.stats.longShots++;
        ctx.achievements.unlock('sniper');
      } else if (dist >= 8) {
        trick *= 2.5;
        bonus += TRICK_BONUS.long;
        tricks.push('LONG SHOT x2.5');
        s.stats.longShots++;
      }
      if (!g.touchedGround) {
        trick *= 2;
        bonus += TRICK_BONUS.air;
        tricks.push('AIR x2');
        s.stats.airShots++;
      }
      if (g.bounced) {
        trick *= 3;
        bonus += TRICK_BONUS.trick;
        tricks.push('TRICK x3');
        s.stats.trickShots++;
      }
    }
    if (g.bullseye) {
      trick *= 5;
      bonus += TRICK_BONUS.bullseye;
      tricks.push('BULLSEYE x5');
      s.stats.bullseyes++;
      this.combo += 3;
      ctx.achievements.unlock('bullseye');
    }
    if (g.tier.id === 'massive') {
      tricks.push('HEAVY HAUL');
      s.stats.hauls++;
    }
    if (g.tier.id !== 'normal') s.stats.heavies++;
    // a perfect shot must not break the economy
    const volley = g.throwPos && g.thrownBy === 'player' && g.volley && g.volley.n > 1 ? g.volley : null;
    const cap = volley ? VOLLEY_CAP : TRICK_CAP;
    const capped = trick > cap;
    trick = Math.min(trick, cap);
    if (volley) {
      if (volley.bonusPaid) bonus = 0;
      else if (bonus > 0) volley.bonusPaid = true;
    }
    const rush = ctx.factory.rush > 0 ? 1.5 : 1;
    // stolen loot comes back x1 straight to the counter, not as coins a greedy gnome could steal again (night plan F6)
    const value = g.type.value * g.tier.value * trick * rush * this.valueScale * this.comboMult * ctx.buffs.valueMult() * g.valueMult * (g.parade >= 0 ? 3 : 1) + bonus * this.valueScale;
    const feed = g.type.id === 'king' ? 1 : machine || g.thrownBy !== 'player' ? FEED_XP : 1 / Math.sqrt(g.xpGroup?.n ?? 1);
    const xp = g.type.xp * g.tier.value * feed * (1 + lvl('hunger') * 0.1) * (1 + deep('dXp') * 0.25);
    const origin = at ?? this.holeOrigin;
    ctx.gnomes.remove(g);

    ctx.coins.burst(value, origin, at ? 0.6 : 1 + Math.min(1, this.combo / 60));
    ctx.mushrooms.maybeDrop(origin.clone().setY(0.5), g.type.id === 'wizard' ? 6 : g.type.id === 'golden' ? 4 : 1);
    // the eat burst grows with the combo: 14 particles at combo 1, x2.5 from combo 30, in bursts of at most 30
    const n = Math.round(14 * (1 + 1.5 * Math.min(1, (this.combo - 1) / 29)));
    const parts = Math.ceil(n / 30);
    for (let k = 0; k < parts; k++) ctx.fx.burst(origin.clone().setY(0.4 + 0.3 * k), g.type.hat, Math.round(n / parts));
    if (g.type.id === 'boom') this.explode(origin, at ? 0 : ctx.env.holeRadius);
    ctx.fx.floatText(origin.clone().setY(1.5), '+' + money(value), g.type.value >= 20 || trick > 1 ? '#ffd23f' : '#ffffff');
    ctx.audio.slurp();
    ctx.audio.combo(this.combo);
    if (!at) ctx.env.holePulse();
    if (g.loot > 0) {
      this.earn(g.loot);
      ctx.hud.toast(`Stolen ${money(g.loot)} recovered!`, 'good');
    }

    s.stats.gnomesEaten++;
    s.stats.typesEaten[g.type.id] = (s.stats.typesEaten[g.type.id] ?? 0) + 1;
    s.stats.maxCombo = Math.max(s.stats.maxCombo, this.combo);
    const ach: Record<string, string> = { golden: 'golden', wizard: 'wizard', king: 'king', shadow: 'shadow' };
    if (ach[g.type.id]) ctx.achievements.unlock(ach[g.type.id]);
    if (g.type.id === 'king') {
      ctx.hud.bigText('THE KING HAS FALLEN', '#ffd23f');
      ctx.fx.shake(1);
      ctx.audio.rumble(0.3);
      ctx.coins.burst(value * 2, origin, 2);
    }

    for (const [n, name] of TIERS) {
      if (before < n && this.combo >= n) {
        const color = n >= 60 ? '#ff4a8a' : n >= 15 ? '#ffd23f' : '#ffffff';
        ctx.hud.bigText(name, color);
        ctx.audio.tier();
        if (n === 60 || n === 100) ctx.audio.rumble(0.3);
        ctx.fx.shake(Math.min(0.15 + n / 200, 0.6));
        this.startRays(color);
      }
    }
    if (lvl('jackpot') && Math.floor(before / 25) < Math.floor(this.combo / 25)) {
      ctx.hud.bigText('JACKPOT!', '#3adf6a');
      ctx.coins.burst(value * 10, this.holeOrigin, 2.2);
    }
    // after the combo texts so the trick payoff is the big text the player reads
    if (trick > 1) {
      // bigger multiplier = bigger party: 0 for the smallest trick (x2), 1 at the cap
      const f = Math.min(1, (trick - 2) / (TRICK_CAP - 2));
      const total = capped ? `x${cap} MAX` : `x${+trick.toFixed(1)}`;
      const names = tricks.length > 1 || capped ? `${tricks.join(' + ')} = ${total}` : tricks[0];
      const text = volley ? `VOLLEY · ${names} (${volley.n} gnomes)` : names;
      ctx.hud.bigText(text, g.bullseye ? '#ff4a8a' : '#5fd0ff', '+' + money(value), 1 + 0.3 * f);
      ctx.hud.moneyPulse(0.4 + 0.6 * f);
      ctx.audio.fanfare(trick >= 10 ? 4 : trick >= 4 ? 3 : 2);
      const n = Math.round(12 + 28 * f);
      ctx.fx.burst(origin.clone().setY(0.6), 0xffd23f, Math.ceil(n / 2));
      ctx.fx.burst(origin.clone().setY(0.6), g.bullseye ? 0xff4a8a : 0x5fd0ff, Math.floor(n / 2));
      ctx.fx.shake(0.1 + 0.2 * f);
    } else if (tricks.length) {
      ctx.hud.bigText(tricks[0], '#5fd0ff');
      ctx.audio.tier();
    }

    if (s.holeLevel < MAX_HOLE_LEVEL) {
      s.holeXp += xp;
      while (s.holeLevel < MAX_HOLE_LEVEL && s.holeXp >= this.xpNeeded) {
        s.holeXp -= this.xpNeeded;
        this.levelUp();
      }
    }
  }

  consumeProp(kind: 'chair' | 'flamingo'): void {
    // full pay the first time (the achievement), then 10%: carrying props in was the best skill-free income (night plan F4)
    const first = !ctx.achievements.has(kind);
    const bonus = (kind === 'chair' ? 250 : 80) * (first ? 1 : 0.1) * this.valueScale;
    ctx.coins.burst(bonus, this.holeOrigin, 1.5);
    ctx.audio.slurp();
    if (kind === 'chair') {
      ctx.achievements.unlock('chair');
      ctx.hud.toast('The hole found the armchair very comfy.', 'secret');
    } else {
      ctx.achievements.unlock('flamingo');
      ctx.hud.toast('A pink sacrifice. The hole approves.', 'secret');
    }
  }

  private levelUp(): void {
    const s = ctx.state;
    // a level-up during a Land slide: finish the slide first, so the tools follow from the hole's real spot
    ctx.env.finishSlide();
    this.finishGlides();
    const oldC = ctx.env.hole.clone();
    const oldR = ctx.env.holeRadius;
    s.holeLevel++;
    const L = holeLevel(s.holeLevel);
    ctx.env.rebuildHole();
    ctx.audio.levelUp();
    ctx.fx.shake(0.8);
    ctx.fx.burst(ctx.env.hole.clone().setY(0.5), 0x5fd0ff, 80);
    this.shockwave();
    if (this.carry(oldC, oldR, ctx.env.hole, ctx.env.holeRadius, MACHINE_GLIDE)) {
      ctx.hud.toast('The hole moved under one of your machines. It is back in your inventory.', 'info');
    }
    ctx.hud.levelUp(s.holeLevel, L.mult, L.unlock, L.whisper);
    if (s.holeLevel === 10) setTimeout(() => ctx.events.start('king'), 6000);
    if (s.holeLevel === MAX_HOLE_LEVEL) ctx.hud.toast('THE DEEP is open. Jump into the hole when you are ready.', 'secret');
    saveState(s);
  }

  // The hole moved (level-up or a new Land). Tools within RIM_CARRY of the old rim keep their spot relative to the
  // rim and glide there over T seconds; a stack moves as one, so an upper tool never stays floating over the hole.
  // Tools the new hole covers shrink away and go back to the inventory when the hole arrives (after T).
  // Returns how many tools went back.
  carry(oldC: THREE.Vector3, oldR: number, newC: THREE.Vector3, newR: number, T: number): number {
    // the cleaning robot drives itself and its post is not a footprint on the ground; a crate is a loose object
    // that dumps itself and goes home when it falls in (it may be the very crate whose dump caused this level-up)
    const list = ctx.machines.list.filter((m) => m.type !== 'robot' && m.type !== 'box');
    // stacks: a tool resting on top of another's footprint belongs to the same group
    const group = list.map((_, i) => i);
    const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i])));
    for (const [i, lo] of list.entries()) {
      const b = machineBox(lo.type) ?? DEFAULT_BOX;
      const top = lo.pos.y + b.center[1] + b.half[1];
      const reach = Math.max(b.half[0], b.half[2]) + 0.3;
      for (const [j, up] of list.entries()) {
        if (i !== j && up.pos.y >= top - 0.3 && Math.hypot(up.pos.x - lo.pos.x, up.pos.z - lo.pos.z) < reach) group[root(j)] = root(i);
      }
    }
    const groups = new Map<number, Machine[]>();
    for (const [i, m] of list.entries()) groups.set(root(i), [...(groups.get(root(i)) ?? []), m]);

    let gone = 0;
    for (const members of groups.values()) {
      const rim = members.some((m) => Math.hypot(m.pos.x - oldC.x, m.pos.z - oldC.z) < oldR + RIM_CARRY);
      if (rim) {
        // the lowest tool decides the move; everything on it moves by the same offset
        const base = members.reduce((a, m) => (m.pos.y < a.pos.y ? m : a));
        const off = new THREE.Vector3(base.pos.x - oldC.x, 0, base.pos.z - oldC.z);
        const d = off.length();
        if (d > 0.01) off.multiplyScalar((d + newR - oldR) / d);
        const delta = off.add(newC).sub(base.pos).setY(0);
        for (const m of members) this.glides.push({ m, from: m.pos.clone(), to: m.pos.clone().add(delta), t: 0, delay: 0, T, gone: false });
      } else if (members.some((m) => Math.hypot(m.pos.x - newC.x, m.pos.z - newC.z) < newR + 0.6 && m.pos.y < 1.5)) {
        for (const m of members) this.glides.push({ m, from: m.pos.clone(), to: m.pos.clone(), t: 0, delay: T, T: MACHINE_GONE, gone: true });
        gone += members.length;
      }
    }
    return gone;
  }

  // true while the hole is about to swallow this tool (it goes back to the inventory when the glide ends)
  goingAway(m: Machine): boolean {
    return this.glides.some((gl) => gl.gone && gl.m === m);
  }

  private glides: { m: Machine; from: THREE.Vector3; to: THREE.Vector3; t: number; delay: number; T: number; gone: boolean }[] = [];

  private updateGlides(dt: number): void {
    for (let i = this.glides.length - 1; i >= 0; i--) {
      const gl = this.glides[i];
      gl.t += dt;
      const k = Math.max(0, Math.min(1, (gl.t - gl.delay) / gl.T));
      if (!ctx.machines.list.includes(gl.m)) this.glides.splice(i, 1); // picked up or removed meanwhile
      else if (gl.gone) {
        gl.m.root.scale.setScalar(Math.max(0.001, 1 - inQuad(k)));
        if (k >= 1) this.endGlide(i);
      } else {
        ctx.machines.move(gl.m, new THREE.Vector3().lerpVectors(gl.from, gl.to, inOutSine(k)));
        if (k >= 1) this.endGlide(i);
      }
    }
  }

  private endGlide(i: number): void {
    const gl = this.glides[i];
    this.glides.splice(i, 1);
    if (!ctx.machines.list.includes(gl.m)) return;
    if (gl.gone) {
      ctx.fx.puff(gl.m.pos.clone().setY(gl.m.pos.y + 0.5), 0xdddddd);
      ctx.machines.remove(gl.m);
    } else ctx.machines.move(gl.m, gl.to);
  }

  // A level-up during a running glide: put every tool where it is going right away.
  private finishGlides(): void {
    while (this.glides.length) this.endGlide(this.glides.length - 1);
  }

  // Level-up shockwave: a ring sweeping over the ground and free gnomes blown away from the hole.
  private wave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  private waveT = 0;
  private pushed: Gnome[] = [];

  private shockwave(): void {
    if (!this.wave) {
      this.wave = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1, 64),
        new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      this.wave.rotation.x = -Math.PI / 2;
      ctx.scene.add(this.wave);
    }
    this.wave.position.copy(ctx.env.hole).setY(0.06);
    this.waveT = WAVE_TIME;
    // collect first, push after
    const h = ctx.env.hole;
    this.pushed.length = 0;
    ctx.gnomes.forEachNear(h, 10, (g) => this.pushed.push(g));
    for (const g of this.pushed) {
      const p = g.body.translation();
      const dx = p.x - h.x;
      const dz = p.z - h.z;
      const d = Math.hypot(dx, dz);
      const a = d > 0.01 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
      const k = (0.6 + 0.4 * (1 - d / 10)) * g.body.mass();
      ctx.gnomes.ragdoll(g, 1.5);
      g.body.applyImpulse({ x: Math.cos(a) * 8 * k, y: 5 * k, z: Math.sin(a) * 8 * k }, true);
    }
    this.pushed.length = 0;
  }

  // Boom Gnome eaten: a bang, and every free gnome within BOOM.reach m of the edge flies outwards and up.
  private explode(c: THREE.Vector3, edge: number): void {
    ctx.audio.impact(1, 6);
    ctx.audio.rumble(0.6);
    ctx.fx.shake(BOOM.shake);
    ctx.fx.burst(c.clone().setY(0.6), 0xff7a1a, 30);
    ctx.fx.burst(c.clone().setY(1), 0xffd23f, 24);
    ctx.fx.burst(c.clone().setY(0.6), 0x1a1a1a, 20);
    // collect first, push after
    this.pushed.length = 0;
    ctx.gnomes.forEachNear(c, edge + BOOM.reach, (g) => {
      if (g.type.id !== 'king') this.pushed.push(g);
    });
    for (const g of this.pushed) {
      const p = g.body.translation();
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const a = Math.hypot(dx, dz) > 0.01 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
      ctx.gnomes.ragdoll(g, rand(2, 3));
      g.body.setLinvel({ x: Math.cos(a) * BOOM.out, y: BOOM.up, z: Math.sin(a) * BOOM.out }, true);
      g.body.setAngvel({ x: rand(-6, 6), y: rand(-4, 4), z: rand(-6, 6) }, true);
    }
    this.pushed.length = 0;
  }

  // Combo tier: a star of coloured light rays above the hole (sprites, no lights).
  private rays: THREE.Group | null = null;
  private raysT = 0;

  private startRays(color: string): void {
    if (!this.rays) {
      this.rays = new THREE.Group();
      for (let i = 0; i < RAY_COUNT; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        s.material.rotation = (i / RAY_COUNT) * Math.PI; // each sprite is a full line through the centre
        this.rays.add(s);
      }
      ctx.scene.add(this.rays);
    }
    for (const s of this.rays.children as THREE.Sprite[]) s.material.color.set(color);
    this.rays.position.copy(ctx.env.hole).setY(2.5);
    this.rays.visible = true;
    this.raysT = RAY_TIME;
  }

  private updateSpectacle(dt: number): void {
    if (this.wave && this.waveT > 0) {
      this.waveT = Math.max(0, this.waveT - dt);
      const k = 1 - this.waveT / WAVE_TIME;
      this.wave.scale.setScalar(0.01 + k * 12);
      this.wave.material.opacity = 0.8 * (1 - k);
      this.wave.visible = this.waveT > 0;
    }
    if (this.rays && this.raysT > 0) {
      this.raysT = Math.max(0, this.raysT - dt);
      const k = 1 - this.raysT / RAY_TIME;
      for (const s of this.rays.children as THREE.Sprite[]) {
        s.scale.set(0.5, 0.5 + Math.sin(k * Math.PI) * 7, 1);
        s.material.opacity = 1 - k;
        s.material.rotation += dt * 0.8;
      }
      this.rays.visible = this.raysT > 0;
    }
  }

  // Bullseye ring: drifts above the hole, a thrown gnome flying through it scores BULLSEYE x5.
  ring: THREE.Group | null = null;
  private ringAngle = 0;

  // Vertical hoop standing a little off the hole edge, facing the hole: throw through it into the hole.
  private ringPrev = new Map<Gnome, THREE.Vector3>();
  static readonly RING_RADIUS = 0.8;

  private updateRing(dt: number): void {
    if (!this.ring) {
      this.ring = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(Hole.RING_RADIUS, 0.08, 12, 48),
        new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xff8a2a, emissiveIntensity: 1.5 }),
      );
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd23f, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      glow.scale.setScalar(2.6);
      this.ring.add(torus, glow);
      ctx.scene.add(this.ring);
    }
    this.ringAngle += dt * 0.25;
    const h = ctx.env.hole;
    const r = ctx.env.holeRadius + 2.5;
    const c = this.ring.position.set(h.x + Math.cos(this.ringAngle) * r, 1.5 + Math.sin(ctx.time * 1.3) * 0.15, h.z + Math.sin(this.ringAngle) * r);
    this.ring.lookAt(h.x, c.y, h.z); // the torus' flat side (local Z) faces the hole
    const normal = new THREE.Vector3(h.x - c.x, 0, h.z - c.z).normalize();

    // a thrown gnome counts when its path between two frames crosses the hoop's disc
    for (const g of ctx.gnomes.list) {
      if (g.state !== 'ragdoll' || g.thrownBy !== 'player' || !g.throwPos || g.bullseye) {
        this.ringPrev.delete(g);
        continue;
      }
      const t = g.body.translation();
      const p = new THREE.Vector3(t.x, t.y, t.z);
      const prev = this.ringPrev.get(g);
      this.ringPrev.set(g, p);
      if (!prev) continue;
      const a = prev.clone().sub(c).dot(normal);
      const b = p.clone().sub(c).dot(normal);
      if (a * b > 0) continue;
      const hit = prev.clone().lerp(p, a / (a - b || 1));
      if (hit.distanceTo(c) < Hole.RING_RADIUS) {
        g.bullseye = true;
        ctx.fx.burst(c.clone(), 0xffd23f, 30);
        ctx.audio.magic();
      }
    }
    if (this.ringPrev.size > 200) this.ringPrev.clear();
  }

  update(dt: number): void {
    this.updateGlides(dt);
    this.updateRing(dt);
    this.updateSpectacle(dt);
    // a gnome in hand or on the Magnet Gun keeps the combo alive
    if (this.combo > 0 && !ctx.player.holdsGnome) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        if (lvl('comboInsurance') && this.combo >= 4) {
          this.combo = Math.floor(this.combo / 2);
          this.comboTimer = this.comboWindow;
        } else {
          this.combo = 0;
        }
      }
    }
  }

  shardsForRebirth(): number {
    // money alone gave the crate and automation players 4-8 shards a run; gnomes eaten this run count too (night plan F10)
    const s = ctx.state;
    const eaten = s.stats.gnomesEaten - (s.runEatenStart ?? 0);
    return 5 + Math.floor(Math.sqrt(s.totalEarned / 20000)) + Math.floor(eaten / 2000);
  }

  // The ending: reset the run, keep shards, achievements and Deep upgrades.
  rebirth(): void {
    const old = ctx.state;
    old.placed = ctx.machines.serialize();
    const shards = this.shardsForRebirth();
    const next = freshState(old);
    next.shards = old.shards + shards;
    next.stats.rebirths++;
    next.runEatenStart = next.stats.gnomesEaten;
    next.goalsDone = old.goalsDone;
    next.goalStart = old.goalStart;
    const startLvl = deep('dStart');
    next.money = startLvl > 0 ? 100 * Math.pow(3, startLvl) : 0;
    if (deep('dTools')) {
      // every tool and tool upgrade, not only the placeable ones (night plan F10: Bigger Crate was lost)
      for (const id of KEEP_TOOL_IDS) if (old.upgrades[id]) next.upgrades[id] = old.upgrades[id];
      // the new run starts on the Backyard again: tools placed on a bigger land would stand outside its fence,
      // so those go back to the inventory (owned but not placed)
      const half = LAND[0].half - 1;
      next.placed = old.placed.filter((p) => Math.abs(p.x) < half && Math.abs(p.z) < half);
    }
    if (!next.achievements.includes('rebirth')) next.achievements.push('rebirth');
    saveState(next);
    blockSaves();
    location.reload();
  }
}
