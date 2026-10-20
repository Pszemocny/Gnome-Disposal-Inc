import * as THREE from 'three';
import { ctx } from '../core/context';
import { money } from '../core/format';
import type { Gnome } from '../entities/gnomes';

// STRIKE: a fast player-thrown gnome that knocks 2+ other gnomes into the hole within 2 s pays a bonus.
// Positions of marked gnomes are cached each frame, so a gnome that already left the list is never read.
const MIN_SPEED = 6; // m/s
const HIT_RADIUS = 1.6;
const WINDOW = 2; // s: from mark to eaten, and from the first to the last count of a chain
const SETTLE = 0.5; // s without a new count before a chain pays, so x3 shows once instead of x2 then x3
const RIM = 0.5; // m outside the hole radius that still counts as "went into the hole"
const PAY = 25; // $ per gnome, times valueScale
const TURKEY = 5;
const tmp = new THREE.Vector3();

interface Mark { t: number; by: Gnome; pos: THREE.Vector3 }
interface Chain { count: number; first: number; last: number }

export class Strike {
  private time = 0;
  private marks = new Map<Gnome, Mark>();
  private chains = new Map<Gnome, Chain>();
  private hits: Gnome[] = [];

  update(dt: number): void {
    this.time += dt;
    const now = this.time;
    const list = ctx.gnomes.list;

    // 1. fast player throws mark the free gnomes they pass through (collect inside forEachNear, act after)
    for (const g of list) {
      if (g.thrownBy !== 'player' || g.state !== 'ragdoll') continue;
      const v = g.body.linvel();
      if (v.x * v.x + v.y * v.y + v.z * v.z < MIN_SPEED * MIN_SPEED) continue;
      const p = g.body.translation();
      this.hits.length = 0;
      ctx.gnomes.forEachNear(tmp.set(p.x, p.y, p.z), HIT_RADIUS, (o) => {
        if (o !== g && !(o.thrownBy === 'player' && o.state === 'ragdoll')) this.hits.push(o);
      });
      for (const o of this.hits) {
        const m = this.marks.get(o);
        if (m) { m.t = now; m.by = g; } else this.marks.set(o, { t: now, by: g, pos: new THREE.Vector3() });
      }
    }

    // 2. marked gnomes: cache the position while in the list; count the ones that left it near the hole
    const env = ctx.env;
    for (const [o, m] of this.marks) {
      if (list.includes(o)) {
        if (now - m.t > WINDOW) { this.marks.delete(o); continue; }
        const p = o.body.translation();
        m.pos.set(p.x, p.y, p.z);
        continue;
      }
      this.marks.delete(o);
      if (now - m.t > WINDOW || env.holeDist(m.pos.x, m.pos.z) > env.holeRadius + RIM) continue;
      const c = this.chains.get(m.by);
      if (c && now - c.first <= WINDOW) { c.count++; c.last = now; } else this.chains.set(m.by, { count: 1, first: now, last: now });
    }

    // 3. a chain pays once it is quiet for SETTLE s or its window closed
    for (const [by, c] of this.chains) {
      if (now - c.last < SETTLE && now - c.first < WINDOW) continue;
      this.chains.delete(by);
      if (c.count >= 2) this.pay(c.count);
    }
  }

  private pay(count: number): void {
    const value = PAY * count * ctx.hole.valueScale;
    ctx.hole.earn(value);
    const text = count >= TURKEY ? `TURKEY! STRIKE x${count}` : `STRIKE x${count}`;
    ctx.hud.bigText(text, '#ffd23f', '+' + money(value), count >= TURKEY ? 1.3 : 1.15);
    ctx.audio.fanfare(3);
    ctx.fx.burst(ctx.env.hole.clone().setY(0.6), 0xffd23f, Math.min(30, 8 + 4 * count));
  }
}
