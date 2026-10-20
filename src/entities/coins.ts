import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, G, drawPose, groups, lvl, rand, savePose } from '../core/context';
import { coinGeometry } from '../world/models';
import { outCubic } from '../core/ease';

export interface Coin {
  body: RAPIER.RigidBody;
  value: number;
  pos: THREE.Vector3;
  age: number;
  flying: boolean;
  flyT: number;
  color: THREE.Color;
  prevPos: THREE.Vector3;
  prevRot: THREE.Quaternion;
}

// bronze, silver, gold, blue, purple, red, green, cyan, pink, white...
const PALETTE = [0xc8763a, 0xc9ccd4, 0xffcc33, 0x4a6cff, 0xa04aff, 0xff3a4a, 0x3adf6a, 0x3ae0ff, 0xff7ad8, 0xffffff];
const CAP = 320;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const GRAVITY = 20; // matches the physics world in main.ts
const PULL = 6; // coins this close slide towards the player
const PULL_SPEED = 10;
const FLY_T = 0.5; // seconds for a HUD coin to reach the money counter
const MAX_FLYERS = 24; // above this a collected coin pays at once

// a collected coin on its way to the money counter, in screen pixels
interface Flyer {
  el: HTMLDivElement;
  value: number;
  t: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
}

export class Coins {
  list: Coin[] = [];
  private flyers: Flyer[] = [];
  private spare: HTMLDivElement[] = [];
  private mesh: THREE.InstancedMesh;
  private chain = 0;
  private lastChime = -1;

  constructor() {
    const style = document.createElement('style');
    style.textContent =
      '.coin-flyer { position: fixed; left: 0; top: 0; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; pointer-events: none; z-index: 6; will-change: transform; box-shadow: inset 0 0 0 2px rgba(0,0,0,.28), inset 3px 3px 4px rgba(255,255,255,.55); }';
    document.head.appendChild(style);
    // a reload must not lose the money still flying (main.ts saves on its own beforeunload, registered after this one)
    window.addEventListener('beforeunload', () => this.flushFlyers());
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6, vertexColors: true, emissive: 0x222222 });
    this.mesh = new THREE.InstancedMesh(coinGeometry(), mat, CAP);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    ctx.scene.add(this.mesh);
  }

  get pickupRadius(): number {
    return 2 + lvl('magnetRange') * 1.2;
  }

  burst(total: number, origin: THREE.Vector3, power = 1): void {
    if (total <= 0) return;
    const n = Math.max(1, Math.min(6, Math.ceil(Math.log10(total + 1) * 1.6)));
    if (this.list.length + n > CAP) {
      ctx.hole.earn(total);
      return;
    }
    const each = total / n;
    const tier = Math.max(0, Math.min(PALETTE.length - 1, Math.floor(Math.log10(Math.max(1, each)))));
    const color = new THREE.Color(PALETTE[tier]);
    const { R, physics } = ctx;
    const env = ctx.env;
    const fromHole = env.holeDist(origin.x, origin.z) < env.holeRadius;
    const a0 = rand(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      // fountain: evenly spread around 360° with a little jitter
      const a = a0 + (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      const x = origin.x + rand(-0.3, 0.3);
      const y = origin.y + rand(0, 0.5);
      const z = origin.z + rand(-0.3, 0.3);
      const vy = rand(9, 13) * Math.sqrt(power);
      let sp = rand(2, 5) * Math.sqrt(power);
      if (fromHole) {
        // make sure it lands at least holeRadius + 1 from the centre (flight time to the ground, 10% for damping)
        const t = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * y)) / GRAVITY;
        const need = (env.holeRadius + 1.3 + env.holeDist(x, z)) / (t * 0.9); // worst case: start offset points inwards
        sp = Math.max(sp, need);
      }
      const body = physics.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(x, y, z)
          .setLinvel(Math.cos(a) * sp, vy, Math.sin(a) * sp)
          .setAngvel({ x: rand(-10, 10), y: rand(-10, 10), z: rand(-10, 10) })
          .setLinearDamping(0.1)
          // without it coins kept rolling on their edge for many seconds
          .setAngularDamping(2.5),
      );
      physics.createCollider(
        R.ColliderDesc.cylinder(0.025, 0.17).setMass(0.05).setRestitution(0.35).setCollisionGroups(groups(G.COIN, G.GROUND | G.STATIC | G.PROP)),
        body,
      );
      this.list.push({ body, value: each, pos: origin.clone(), age: 0, flying: false, flyT: 0, color, prevPos: new THREE.Vector3(x, y, z), prevRot: new THREE.Quaternion() });
    }
  }

  savePoses(): void {
    // a flying coin has no body any more
    for (const c of this.list) if (!c.flying) savePose(c, c.body);
  }

  nearestFree(pos: THREE.Vector3, maxD: number): Coin | null {
    if (lvl('piggy')) return null;
    let best: Coin | null = null;
    let bd = maxD;
    for (const c of this.list) {
      if (c.flying || c.age < 0.8) continue;
      const d = c.pos.distanceTo(pos);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  steal(c: Coin): number {
    this.removeCoin(c);
    return c.value;
  }

  private removeCoin(c: Coin): void {
    if (!c.flying) ctx.physics.removeRigidBody(c.body);
    const i = this.list.indexOf(c);
    if (i >= 0) {
      this.list[i] = this.list[this.list.length - 1];
      this.list.pop();
    }
  }

  update(dt: number): void {
    const pp = ctx.player.position;
    const reach = this.pickupRadius * (ctx.buffs.active('midas') ? 1.5 : 1);
    const piggy = lvl('piggy') > 0;
    const env = ctx.env;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.age += dt;
      if (c.flying) {
        c.flyT += dt * 3;
        const target = tmpTarget.set(pp.x, pp.y - 0.4, pp.z);
        c.pos.lerp(target, Math.min(1, c.flyT * 0.6 + dt * 6));
        if (c.pos.distanceTo(target) < 0.6 || c.flyT > 2) {
          this.launch(c);
          this.removeCoin(c);
        }
        continue;
      }
      const p = c.body.translation();
      c.pos.set(p.x, p.y, p.z);
      if (p.y < -5) {
        // fell back into the hole: give it back
        ctx.hole.earn(c.value);
        this.removeCoin(c);
        continue;
      }
      const v = c.body.linvel();
      const hd = env.holeDist(p.x, p.z);
      if (hd < env.holeRadius + 0.2 && p.y > -0.3 && p.y < 1.5 && v.y <= 0) {
        if (c.age < 3) {
          // a fountain coin about to land inside the hole: kick it out over the rim
          const k = 4 / (hd || 1);
          c.body.setLinvel({ x: (p.x - env.hole.x) * k, y: 4, z: (p.z - env.hole.z) * k }, true);
        } else if (hd < env.holeRadius) {
          // a coin that rolled onto the hidden ground under the vortex: let the hole take it (refunded below)
          const k = -3 / (hd || 1);
          c.body.setLinvel({ x: (p.x - env.hole.x) * k, y: v.y, z: (p.z - env.hole.z) * k }, true);
        }
      }
      const d = c.pos.distanceTo(pp);
      if ((d < reach && c.age > 0.35) || (piggy && c.age > 1.6) || c.age > 40) {
        c.flying = true;
        c.flyT = 0;
        ctx.physics.removeRigidBody(c.body);
      } else if (d < PULL && c.age > 0.8) {
        // slide towards the player, faster the closer it gets (steering to a target speed beats ground friction)
        const sp = (PULL_SPEED * (1 - d / PULL) + 3) / d;
        const k = 1 - Math.exp(-4 * dt);
        c.body.setLinvel({ x: v.x + ((pp.x - p.x) * sp - v.x) * k, y: v.y, z: v.z + ((pp.z - p.z) * sp - v.z) * k }, true);
      }
    }
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      const k = Math.min(1, f.t / FLY_T);
      if (k >= 1) {
        this.pay(f.value);
        f.el.style.display = 'none';
        this.spare.push(f.el);
        this.flyers[i] = this.flyers[this.flyers.length - 1];
        this.flyers.pop();
        continue;
      }
      // quadratic Bezier through a control point beside the straight line: a slight arc
      const u = outCubic(k);
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      f.el.style.transform = `translate(${a * f.x0 + b * f.cx + c * f.x1}px, ${a * f.y0 + b * f.cy + c * f.y1}px) scale(${1 - 0.4 * u})`;
    }
    // instances
    this.mesh.count = this.list.length;
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (c.flying) {
        tmpV.copy(c.pos);
        tmpQ.setFromAxisAngle(Y, ctx.time * 12);
      } else {
        drawPose(c, c.body, tmpV, tmpQ);
      }
      tmpM.compose(tmpV, tmpQ, ONE);
      this.mesh.setMatrixAt(i, tmpM);
      this.mesh.setColorAt(i, c.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  // A collected coin becomes a HUD coin at its screen position; the money is paid when it reaches the counter.
  private launch(c: Coin): void {
    const r = document.querySelector('.hud-money .money')?.getBoundingClientRect();
    if (!r || r.width === 0 || this.flyers.length >= MAX_FLYERS) {
      this.pay(c.value);
      return;
    }
    const W = window.innerWidth, H = window.innerHeight;
    const v = tmpV.copy(c.pos).project(ctx.camera);
    // behind the camera the projection mirrors: start from the bottom centre instead
    const x0 = v.z > 1 ? W / 2 : THREE.MathUtils.clamp((v.x + 1) * 0.5 * W, 0, W);
    const y0 = v.z > 1 ? H : THREE.MathUtils.clamp((1 - v.y) * 0.5 * H, 0, H);
    const x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
    // control point: the midpoint pushed sideways by 20 % of the distance, so the distance to the counter still only shrinks
    const cx = (x0 + x1) / 2 + (y1 - y0) * 0.2, cy = (y0 + y1) / 2 - (x1 - x0) * 0.2;
    let el = this.spare.pop();
    if (!el) {
      el = document.createElement('div');
      el.className = 'coin-flyer';
      document.body.appendChild(el);
    }
    el.style.background = `#${c.color.getHexString()}`;
    el.style.transform = `translate(${x0}px, ${y0}px)`;
    el.style.display = '';
    this.flyers.push({ el, value: c.value, t: 0, x0, y0, cx, cy, x1, y1 });
  }

  private pay(value: number): void {
    ctx.hole.earn(value);
    // coins picked up in a quick row chime higher and higher
    this.chain = ctx.time - this.lastChime < 0.35 ? Math.min(this.chain + 1, 12) : 0;
    this.lastChime = ctx.time;
    ctx.audio.coin((1 + Math.min(1, Math.log10(value + 1) / 8)) * Math.pow(2, this.chain / 12));
  }

  private flushFlyers(): void {
    for (const f of this.flyers) {
      ctx.hole.earn(f.value);
      f.el.style.display = 'none';
      this.spare.push(f.el);
    }
    this.flyers = [];
  }

  clearAll(): void {
    for (const c of [...this.list]) {
      if (!c.flying) ctx.physics.removeRigidBody(c.body);
    }
    this.list = [];
  }
}

const Y = new THREE.Vector3(0, 1, 0);
const tmpTarget = new THREE.Vector3();
