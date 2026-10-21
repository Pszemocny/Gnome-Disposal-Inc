import * as THREE from 'three';
import { ctx, lvl, rand } from '../core/context';
import { outCubic } from '../core/ease';
import type { Gnome } from '../entities/gnomes';

// Ground pound (J in the air): a short hop up, a fast drop, and on landing every free gnome near the feet
// pops up and flies outwards, bent toward the hole when it is close. Gnome Boots make it wider and harder.
const WIND_T = 0.08; // anticipation: seconds of the hop up before the drop
const WIND_VY = 3;
const SLAM_VY = -25;
const COOLDOWN = 1;
const RADIUS = 4;
const BOOTS_RADIUS = 5.5;
const BOOTS_PUSH = 1.5;
const PUSH = 6; // m/s outwards at the impact point, 70 % of it at the edge of the radius
const HOLE_RANGE = 15;
const HOLE_BIAS = 0.8;
const FEET = 0.9; // capsule half height + radius: player position to the soles
const RING_T = 0.6;

export class Pound {
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private phase: 'idle' | 'wind' | 'slam' = 'idle';
  private t = 0;
  private cd = 0;
  private ringT = 0;
  private ringR = RADIUS;
  private hit: Gnome[] = [];

  constructor() {
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    ctx.scene.add(this.ring);
  }

  // Called by Player.move before gravity with last frame's grounded flag; returns the vertical speed to use.
  update(dt: number, pos: THREE.Vector3, grounded: boolean, vy: number, onTractor: boolean): number {
    this.cd -= dt;
    this.updateRing(dt);
    const inp = ctx.input;
    if (!grounded && lvl('boots')) ctx.hud.firstUse('boots');
    if (this.phase === 'wind') {
      this.t -= dt;
      if (this.t > 0) return WIND_VY;
      this.phase = 'slam';
    }
    if (this.phase === 'slam') {
      // fell into the hole: the hole throws the player back out, do not drag him down again
      if (pos.y < 0) this.phase = 'idle';
      else if (grounded) this.impact(pos);
      else return SLAM_VY;
      return vy;
    }
    // J, not Ctrl: Ctrl held while pressing W closes the browser tab (Ctrl+W), and a page cannot block that
    const ctrl = inp.hit('KeyJ');
    if (ctrl && !grounded && !onTractor && this.cd <= 0 && !ctx.paused) {
      this.phase = 'wind';
      this.t = WIND_T;
      ctx.audio.whoosh();
      return WIND_VY;
    }
    return vy;
  }

  private impact(pos: THREE.Vector3): void {
    this.phase = 'idle';
    this.cd = COOLDOWN;
    const boots = lvl('boots') > 0;
    const R = boots ? BOOTS_RADIUS : RADIUS;
    const k = boots ? BOOTS_PUSH : 1;
    const c = pos.clone().setY(pos.y - FEET);
    const hole = ctx.env.hole;
    const toHole = ctx.env.holeDist(c.x, c.z) < HOLE_RANGE;
    // collect first, push after (CLAUDE.md: no body changes inside a query)
    const hit = this.hit;
    hit.length = 0;
    ctx.gnomes.forEachNear(c, R, (g) => {
      if (g.type.id !== 'king') hit.push(g);
    });
    const dir = new THREE.Vector3();
    const bias = new THREE.Vector3();
    for (const g of hit) {
      const p = g.body.translation();
      dir.set(p.x - c.x, 0, p.z - c.z);
      const d = dir.length();
      if (d < 0.01) dir.set(rand(-1, 1), 0, rand(-1, 1));
      dir.normalize();
      if (toHole) dir.add(bias.set(hole.x - p.x, 0, hole.z - p.z).normalize().multiplyScalar(HOLE_BIAS)).normalize();
      const s = PUSH * k * (1 - (0.3 * d) / R);
      ctx.gnomes.ragdoll(g, rand(1.5, 2.5), 'kick');
      g.body.setLinvel({ x: dir.x * s, y: rand(6, 8), z: dir.z * s }, true);
      g.body.setAngvel({ x: rand(-6, 6), y: rand(-4, 4), z: rand(-6, 6) }, true);
    }
    hit.length = 0;
    this.ringR = R;
    this.ringT = RING_T;
    this.ring.position.copy(c).setY(c.y + 0.05);
    ctx.fx.dust(c, 1);
    ctx.fx.shake(0.25);
    ctx.audio.impact(1, 6);
  }

  // dust ring: grows to the pound radius and fades, both eased out
  private updateRing(dt: number): void {
    if (this.ringT <= 0) return;
    this.ringT = Math.max(0, this.ringT - dt);
    const k = 1 - this.ringT / RING_T;
    this.ring.scale.setScalar(0.2 + outCubic(k) * this.ringR);
    this.ring.material.opacity = 0.7 * (1 - outCubic(k));
    this.ring.visible = this.ringT > 0;
  }
}
