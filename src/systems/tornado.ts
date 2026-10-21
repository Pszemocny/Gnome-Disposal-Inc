import * as THREE from 'three';
import { ctx, rand } from '../core/context';
import { inQuad, outBack } from '../core/ease';
import { isFree, type Gnome } from '../entities/gnomes';

const LIFE = 20; // seconds the tornado walks
const FADE = 0.3; // grow / shrink time
const GRAB_R = 3.5; // lift radius around the axis
const TOP = 9; // funnel height
const MAX_RIDES = 12;
const GRAVITY = 20; // physics world gravity (main.ts)

interface Ride {
  g: Gnome;
  a: number; // angle around the axis
  r: number; // orbit radius
  h: number; // orbit height
  since: number;
  drop: number;
}

// Pale vertical-ish streaks with soft alpha; scrolled and spun they read as swirling air.
function streakTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = `rgba(255,255,255,${rand(0.15, 0.7).toFixed(2)})`;
    x.lineWidth = rand(1, 5);
    const sx = rand(0, 64);
    x.beginPath();
    x.moveTo(sx, 128);
    x.lineTo(sx + rand(20, 40), 0);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function funnel(rTop: number, rBottom: number, h: number, seg: number, color: number, repeat: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, seg, 4, true);
  geo.translate(0, h / 2, 0);
  const map = streakTexture();
  map.repeat.set(repeat, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true }));
  m.castShadow = m.receiveShadow = false;
  return m;
}

export class Tornado {
  readonly pos = new THREE.Vector3();
  private age = -1; // < 0 = idle
  private group: THREE.Group | null = null;
  private outer!: THREE.Mesh;
  private inner!: THREE.Mesh;
  private spin = 0;
  private rides: Ride[] = [];
  private riding = new Set<Gnome>();
  // just dropped: not caught again right away, or the hole throw would never land
  private dropped = new WeakMap<Gnome, number>();
  private p0 = new THREE.Vector3();
  private p1 = new THREE.Vector3();
  private p2 = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  get active(): boolean {
    return this.age >= 0 && this.age < LIFE;
  }

  get mesh(): THREE.Group | null {
    return this.group;
  }

  start(): void {
    if (!this.group) {
      this.group = new THREE.Group();
      this.outer = funnel(3.8, 0.7, TOP, 24, 0xc9c2b4, 3);
      this.inner = funnel(2.3, 0.35, TOP - 1, 16, 0x9c9486, 2);
      this.group.add(this.outer, this.inner);
      ctx.scene.add(this.group);
    }
    // quadratic curve whose midpoint is next to the hole: p0 and p2 bent to one side, p1 to the other
    const hole = ctx.env.hole;
    const { min, max } = ctx.env;
    const L = Math.min(max.x - min.x, max.z - min.z) / 2 - 2;
    const a = rand(0, Math.PI * 2);
    const dir = this.tmp.set(Math.cos(a), 0, Math.sin(a));
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const bend = rand(3, 5) * (Math.random() < 0.5 ? -1 : 1);
    const c = hole.clone().setY(0).addScaledVector(perp, rand(0.5, 2));
    this.p0.copy(c).addScaledVector(dir, -L).addScaledVector(perp, bend);
    this.p1.copy(c).addScaledVector(perp, -bend);
    this.p2.copy(c).addScaledVector(dir, L).addScaledVector(perp, bend);
    this.age = 0;
    this.place();
    this.group.visible = true;
    ctx.fx.dust(this.pos, 1);
    ctx.audio.rumble(3);
  }

  update(dt: number): void {
    if (this.age < 0 || !this.group) return;
    this.age += dt;
    const live = this.age < LIFE;
    if (live) this.place();

    // look: grow in, shrink out, spin speed damped toward its target, a little sway
    const k = this.age < FADE ? outBack(this.age / FADE) : live ? 1 : 1 - inQuad(Math.min(1, (this.age - LIFE) / FADE));
    this.group.scale.setScalar(Math.max(0.001, k));
    this.spin = THREE.MathUtils.damp(this.spin, live ? 7 : 0, 3, dt);
    this.outer.rotation.y += this.spin * dt;
    this.inner.rotation.y -= this.spin * 1.4 * dt;
    (this.outer.material as THREE.MeshBasicMaterial).map!.offset.y -= this.spin * 0.05 * dt;
    (this.inner.material as THREE.MeshBasicMaterial).map!.offset.y -= this.spin * 0.08 * dt;
    this.group.rotation.z = Math.sin(ctx.time * 1.3) * 0.05;
    this.group.rotation.x = Math.sin(ctx.time * 0.9) * 0.04;

    if (live) {
      this.grab();
      if (Math.random() < dt * 5) ctx.fx.dust(this.tmp.copy(this.pos).setY(0.1), 0.4);
      const pd = Math.hypot(ctx.player.position.x - this.pos.x, ctx.player.position.z - this.pos.z);
      if (pd < 20 && Math.random() < dt * 4) ctx.audio.whoosh();
      // soft pulses: the shake decays in 0.6 s on its own
      if (pd < 6 && Math.random() < dt * 3) ctx.fx.shake(0.3 * (1 - pd / 6));
    }
    this.carry(dt, live);

    if (!live && this.age >= LIFE + FADE) {
      this.group.visible = false;
      this.age = -1;
      ctx.fx.puff(this.pos.clone().setY(0.5), 0xd8d0c0);
    }
  }

  private place(): void {
    const s = Math.min(1, this.age / LIFE);
    const u = 1 - s;
    this.pos.set(0, 0, 0).addScaledVector(this.p0, u * u).addScaledVector(this.p1, 2 * u * s).addScaledVector(this.p2, s * s);
    ctx.env.clampTo(this.pos, 1);
    this.pos.y = 0;
    this.group!.position.copy(this.pos);
  }

  // collect first, change bodies after
  private grab(): void {
    if (this.rides.length >= MAX_RIDES) return;
    const caught: Gnome[] = [];
    for (const g of ctx.gnomes.list) {
      if (caught.length + this.rides.length >= MAX_RIDES) break;
      if (!isFree(g) || g.type.id === 'king' || this.riding.has(g) || (this.dropped.get(g) ?? -9) > ctx.time - 2) continue;
      const p = g.body.translation();
      if (p.y < TOP && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < GRAB_R) caught.push(g);
    }
    for (const g of caught) {
      const p = g.body.translation();
      // ragdoll without `by`: a player throw keeps thrownBy, throwPos and touchedGround (AIR still counts)
      ctx.gnomes.ragdoll(g, 3);
      this.riding.add(g);
      this.rides.push({ g, a: Math.atan2(p.z - this.pos.z, p.x - this.pos.x), r: rand(1.2, 2.6), h: rand(4, 7), since: ctx.time, drop: ctx.time + rand(2, 3.5) });
      if (Math.random() < 0.5) ctx.audio.voice('scream', rand(0.9, 1.3));
    }
  }

  private carry(dt: number, live: boolean): void {
    if (!this.rides.length) return;
    const hole = ctx.env.hole;
    const nearHole = ctx.env.holeDist(this.pos.x, this.pos.z) < ctx.env.holeRadius + 5;
    const keep: Ride[] = [];
    for (const ride of this.rides) {
      const g = ride.g;
      // grabbed by the player, stashed, falling into the hole or gone: no longer ours
      if (!isFree(g) || !ctx.gnomes.list.includes(g)) {
        this.riding.delete(g);
        continue;
      }
      const p = g.body.translation();
      const release = !live || ctx.time >= ride.drop || (nearHole && ctx.time - ride.since > 1 && Math.random() < dt * 2);
      if (release) {
        this.riding.delete(g);
        this.dropped.set(g, ctx.time);
        g.timer = rand(2.5, 4);
        if (nearHole) {
          // ballistic drop onto the hole centre (x1.06 makes up for linear damping, as the factory does)
          const t = Math.sqrt((2 * Math.max(0.5, p.y)) / GRAVITY);
          g.body.setLinvel({ x: ((hole.x - p.x) / t) * 1.06, y: 0, z: ((hole.z - p.z) / t) * 1.06 }, true);
        } else {
          const s = rand(2, 4);
          g.body.setLinvel({ x: Math.cos(ride.a) * s, y: rand(0, 2), z: Math.sin(ride.a) * s }, true);
        }
        continue;
      }
      ride.a += dt * 3.2;
      const tx = this.pos.x + Math.cos(ride.a) * ride.r;
      const tz = this.pos.z + Math.sin(ride.a) * ride.r;
      // steer toward the orbit point; climb capped so the lift reads as a spiral, not a jump
      const vy = THREE.MathUtils.clamp((ride.h - p.y) * 2.5, -4, 6) + GRAVITY * dt;
      g.body.setLinvel({ x: (tx - p.x) * 4, y: vy, z: (tz - p.z) * 4 }, true);
      g.body.setAngvel({ x: 2, y: 6, z: 1 }, true);
      g.timer = Math.max(g.timer, 1);
      keep.push(ride);
    }
    this.rides = keep;
  }
}
