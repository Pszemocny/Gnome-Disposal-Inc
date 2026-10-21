import * as THREE from 'three';
import { ctx, G, groups, lvl, rng } from '../core/context';
import { TYPE_BY_ID, rollTier } from '../data/gnomeTypes';
import type { Gnome } from './gnomes';
import { factoryGeometry, gearGeometry, labelSprite, leverArmGeometry, leverBaseGeometry, vcMat } from '../world/models';
import { tex } from '../world/textures';
import { outBack, outCubic } from '../core/ease';
import { glowTexture } from './mushrooms';

const BURST_GAP = 0.05;
// before and after a king (scale 3): within 0.05 s the next gnome still starts inside it
const KING_GAP = 0.4;

// Parts with a collider, sized like the meshes in models.ts, in the body's frame (body origin at y 1.3, so local y =
// part y - 1.3). box half = (x, y, z); cyl half = (half height, radius), axis along y before `rot` (Euler x, y, z).
// `foot` parts are also obstacle rectangles for the robot planner and Machines.restore.
const PARTS: { shape: 'box' | 'cyl'; at: [number, number, number]; half: number[]; rot?: [number, number, number]; foot: boolean }[] = [
  { shape: 'box', at: [0, 0, 0], half: [1.6, 1.3, 1.3], foot: true }, // body
  { shape: 'box', at: [0, -0.3, 1.9], half: [0.75, 0.5, 0.8], rot: [-0.35, 0, 0], foot: true }, // chute, full length, same tilt
  { shape: 'box', at: [2.2, -0.7, 0.9], half: [0.35, 0.6, 0.35], foot: true }, // pedestal
  { shape: 'cyl', at: [2.2, -0.01, 0.9], half: [0.09, 0.25], foot: false }, // red button, lies on the pedestal
  { shape: 'box', at: [1.75, 0.3, 0.6], half: [0.3, 0.22, 0.22], foot: false }, // pipe, lies over body and pedestal
  { shape: 'cyl', at: [-1.75, 0.2, 0.2], half: [0.14, 1.15], rot: [0, 0, Math.PI / 2], foot: true }, // gear, axis along x
];
// half sizes in x and z on the ground: the tilt about x lengthens a box in z; the only cylinder with a footprint (the
// gear) lies with its axis along x
const footHalf = (p: (typeof PARTS)[number]): [number, number] => {
  if (p.shape === 'cyl') return [p.half[0], p.half[1]];
  const rx = p.rot?.[0] ?? 0;
  return [p.half[0], p.half[2] * Math.cos(rx) + p.half[1] * Math.abs(Math.sin(rx))];
};
// the lever's hit box: covers the arm and knob in both states (knob at x +-0.18, y 1.31 over the post's foot)
const LEVER_HALF = [0.26, 0.65, 0.12];
const LEVER_X = 2.6; // along the factory's right

// The only source of new gnomes: hold E next to it (or buy Auto Crank).
export class Factory {
  pos = new THREE.Vector3(-7.5, 0, -13);
  progress = 0;
  near = false;
  running = false;
  jammed = false;
  rush = 0; // OVERTIME event: seconds of free production left
  private yaw: number;
  private gear: THREE.Mesh;
  private gearRate = 0; // rad/s, winds up and down with production
  private smoke = 0;
  private jamNotice = 0;
  switchHandle = -1; // collider of the Auto Crank lever, matched by the player's look ray
  leverPos: THREE.Vector3;
  leverAngle = 0; // arm rotation in radians: -0.6 ON, 0.6 OFF
  lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x2bd44a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  private pivot = new THREE.Group();
  private flip: { from: number; to: number; t: number } | null = null;
  footprints: { x: number; z: number; yaw: number; hx: number; hz: number }[];
  // gnomes still to come out of the mouth, in order (FIFO keeps the daily challenge's draw order)
  private queue: { typeId?: string; then?: (g: Gnome) => void }[] = [];
  private sinceOut = KING_GAP; // s since the last gnome left the mouth
  private lastKing = false;

  constructor() {
    const { scene, R, physics } = ctx;
    this.yaw = Math.atan2(-this.pos.x, -this.pos.z);
    const root = new THREE.Group();
    // light grey plates, so the purple vertex colour stays purple
    const body = new THREE.Mesh(factoryGeometry(), vcMat({ metalness: 0.1, roughness: 0.55, map: tex('metal_diff') }));
    body.castShadow = body.receiveShadow = true;
    this.gear = new THREE.Mesh(gearGeometry(), vcMat({ metalness: 0.6, roughness: 0.35 }));
    this.gear.position.set(-1.75, 1.5, 0.2);
    this.gear.castShadow = true;
    root.add(body, this.gear);
    root.position.copy(this.pos);
    root.rotation.y = this.yaw;
    scene.add(root);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const rb = physics.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(this.pos.x, 1.3, this.pos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    for (const p of PARTS) {
      const cd = p.shape === 'box' ? R.ColliderDesc.cuboid(p.half[0], p.half[1], p.half[2]) : R.ColliderDesc.cylinder(p.half[0], p.half[1]);
      const pq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0])));
      cd.setTranslation(...p.at).setRotation({ x: pq.x, y: pq.y, z: pq.z, w: pq.w });
      physics.createCollider(cd.setCollisionGroups(groups(G.STATIC, 0xffff)), rb);
    }
    const sign = labelSprite('GNOME FACTORY', 'hold E here', '#ff8a2a');
    sign.position.set(this.pos.x, 7.2, this.pos.z);
    ctx.env.addSign(sign);
    // landing marker on the grass
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.copy(this.landing).setY(0.03);
    scene.add(mark);

    // Auto Crank lever beside the factory: a post, an arm on a pivot and a glow lamp
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // static obstacle rectangles for the robot planner and for Machines.restore: the `foot` parts and the lever
    const fwd = this.forward();
    const rects = [...PARTS.filter((p) => p.foot).map((p) => [p.at[0], p.at[2], ...footHalf(p)]), [LEVER_X, 0, LEVER_HALF[0], LEVER_HALF[2]]];
    this.footprints = rects.map(([cx, cz, hx, hz]) => (
      { x: this.pos.x + right.x * cx + fwd.x * cz, z: this.pos.z + right.z * cx + fwd.z * cz, yaw: this.yaw, hx, hz }));
    this.leverPos = this.pos.clone().addScaledVector(right, LEVER_X);
    const lever = new THREE.Group();
    const post = new THREE.Mesh(leverBaseGeometry(), vcMat({ metalness: 0.3, roughness: 0.5 }));
    post.castShadow = true;
    this.pivot.position.set(0, 1.05, 0.09);
    const arm = new THREE.Mesh(leverArmGeometry(), vcMat({ metalness: 0.4, roughness: 0.4 }));
    arm.castShadow = true;
    this.pivot.add(arm);
    this.lamp.scale.setScalar(0.35);
    this.lamp.position.set(0, 1.32, -0.04);
    lever.add(post, this.pivot, this.lamp);
    lever.position.copy(this.leverPos);
    lever.rotation.y = this.yaw;
    scene.add(lever);
    this.setLever();
    this.leverAngle = this.pivot.rotation.z;
    const lb = physics.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(this.leverPos.x, 0.75, this.leverPos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    this.switchHandle = physics.createCollider(R.ColliderDesc.cuboid(LEVER_HALF[0], LEVER_HALF[1], LEVER_HALF[2]).setCollisionGroups(groups(G.STATIC, 0xffff)), lb).handle;
  }

  // lamp colour and resting arm angle for the current lever state
  private setLever(): void {
    const on = ctx.state.factoryAuto;
    this.lamp.material.color.setHex(on ? 0x2bd44a : 0xff3b3b);
    // the arm swings sideways, so the player in front of the lever sees ON and OFF
    if (!this.flip) this.pivot.rotation.z = on ? -0.6 : 0.6;
  }

  toggle(): void {
    const on = (ctx.state.factoryAuto = !ctx.state.factoryAuto);
    this.flip = { from: this.leverAngle, to: on ? -0.6 : 0.6, t: 0 };
    this.setLever();
    const lampPos = this.lamp.getWorldPosition(new THREE.Vector3());
    ctx.fx.burst(lampPos, on ? 0x2bd44a : 0xff3b3b, 8);
    ctx.audio.buy();
    const hint = lvl('autocrank') === 0 ? ' (buy Auto Crank in the shop, Factory)' : '';
    ctx.hud.toast(`Auto Crank ${on ? 'ON' : 'OFF'}${hint}`, on ? 'good' : 'bad');
  }

  // anticipation against the direction for 0.08 s, then an outBack swing to the end (0.35 s in total)
  private animLever(dt: number): void {
    const f = this.flip;
    if (!f) return;
    f.t += dt;
    const back = f.from - Math.sign(f.to - f.from) * 0.12;
    if (f.t < 0.08) this.leverAngle = f.from + (back - f.from) * outCubic(f.t / 0.08);
    else this.leverAngle = back + (f.to - back) * outBack(Math.min(1, (f.t - 0.08) / 0.27));
    if (f.t >= 0.35) {
      this.leverAngle = f.to;
      this.flip = null;
    }
    this.pivot.rotation.z = this.leverAngle;
  }

  private get crankRate(): number {
    return (1 / 1.1) * (1 + lvl('factorySpeed') * 0.15);
  }

  private get autoRate(): number {
    return ctx.state.factoryAuto ? lvl('autocrank') * 0.08 : 0;
  }

  private forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  // (x, z) lies in the body, chute, pedestal or gear footprint (same rotation as the tool footprints in robots.ts)
  inside(x: number, z: number): boolean {
    return this.footprints.some((f) => {
      const dx = x - f.x;
      const dz = z - f.z;
      const c = Math.cos(f.yaw);
      const s = Math.sin(f.yaw);
      return Math.abs(dx * c - dz * s) < f.hx && Math.abs(dx * s + dz * c) < f.hz;
    });
  }

  // Every gnome lands on the same marked spot, so a crate placed there catches them.
  get landing(): THREE.Vector3 {
    return this.pos.clone().addScaledVector(this.forward(), 6.5).setY(0);
  }

  // The only way out of the mouth: one gnome every BURST_GAP s (KING_GAP before and after a king), because gnomes made
  // in the same frame start inside each other and get knocked back onto the chute. `then` runs on the gnome once it is
  // out (not when the yard is full).
  produce(typeId?: string, then?: (g: Gnome) => void): void {
    this.queue.push({ typeId, then });
  }

  burst(n: number): void {
    for (let i = 0; i < n; i++) this.queue.push({});
  }

  private spawnNow(typeId?: string): Gnome | null {
    const fwd = this.forward();
    const mouth = this.pos.clone().addScaledVector(fwd, 2.6);
    // every random draw of a factory gnome comes from one stream (seeded in the daily challenge)
    const rnd = rng.spawn;
    const r = (a: number, b: number) => a + rnd() * (b - a);
    const id = typeId ?? ctx.gnomes.pickSpawnType(rnd);
    const type = TYPE_BY_ID[id];
    // the box bottom (half-height 0.44 x type scale x tier scale <= 1.25) stays above the chute collider's top edge
    // (1.744) for every type and tier; the landing is unchanged because vel is computed from here
    const start = mouth.setY(1.8 + 0.56 * type.scale);
    const end = this.landing.setY(0.6);
    const t = 0.9;
    // ballistic shot with gravity 20; x1.06 makes up for the gnome's linear damping
    const vel = new THREE.Vector3(((end.x - start.x) / t) * 1.06 + r(-0.15, 0.15), (end.y - start.y) / t + 0.5 * 20 * t, ((end.z - start.z) / t) * 1.06 + r(-0.15, 0.15));
    const tier = id === 'king' ? undefined : rollTier(ctx.state.holeLevel, id === 'fat' ? 'heavy' : 'normal', rnd).id;
    const g = ctx.gnomes.spawn(id, start, { vel, yaw: r(0, Math.PI * 2), tier });
    if (!g) return null;
    // tumble out of the chute, statues stay where they land
    ctx.gnomes.ragdoll(g, r(1, 2));
    g.body.setAngvel({ x: r(-5, 5), y: r(-5, 5), z: r(-5, 5) }, true);
    ctx.state.stats.produced++;
    ctx.fx.puff(mouth, 0xdddddd);
    ctx.audio.boing();
    return g;
  }

  update(dt: number): void {
    const p = ctx.player.position;
    this.near = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 4.5;
    // E on the lever flips it and must not crank
    const holding = this.near && !ctx.paused && ctx.input.down('KeyE') && !ctx.player.lookAt.switch;
    this.animLever(dt);
    this.sinceOut += dt;
    const next = this.queue[0];
    if (next && this.sinceOut >= (next.typeId === 'king' || this.lastKing ? KING_GAP : BURST_GAP)) {
      this.queue.shift();
      this.sinceOut = 0;
      this.lastKing = next.typeId === 'king';
      const g = this.spawnNow(next.typeId);
      if (g) next.then?.(g);
    }
    // queued gnomes are already on their way into the yard
    this.jammed = ctx.gnomes.list.length + this.queue.length >= ctx.gnomes.maxGnomes;
    this.rush = Math.max(0, this.rush - dt);
    let rate = (holding ? this.crankRate : 0) + this.autoRate + (this.rush > 0 ? 2 : 0);
    if (ctx.buffs.active('chaos')) rate *= 3;
    this.running = rate > 0 && !this.jammed;
    this.gearRate = THREE.MathUtils.damp(this.gearRate, this.running ? rate * 6 : 0, 4, dt);
    this.gear.rotation.x += this.gearRate * dt;
    this.jamNotice -= dt;
    if (rate > 0 && this.jammed && this.jamNotice <= 0 && holding) {
      this.jamNotice = 4;
      ctx.hud.toast('The factory is jammed: too many gnomes in the yard. Feed the hole or buy a Gnome Permit.', 'bad');
    }
    if (this.running) {
      // the mouth lets out at most 20 gnomes/s: the crank waits while a whole batch is still queued, so the queue stays
      // short and production stops when Chaos or OVERTIME ends (bursts from events still queue in full)
      const batch = 1 + lvl('batch');
      if (this.queue.length < batch) this.progress += dt * rate;
      while (this.progress >= 1 && this.queue.length < batch) {
        this.progress -= 1;
        for (let i = 0; i < batch; i++) this.produce();
      }
      this.progress = Math.min(this.progress, 1);
      this.smoke -= dt;
      if (this.smoke <= 0) {
        this.smoke = 0.12;
        const chimney = new THREE.Vector3(-0.9, 6.2, -0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).add(this.pos);
        ctx.fx.puff(chimney, 0x555555);
      }
    }
  }
}
