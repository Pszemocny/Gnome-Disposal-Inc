import * as THREE from 'three';
import { ctx, lvl } from '../core/context';
import { outCubic } from '../core/ease';
import type { Gnome } from '../entities/gnomes';
import { blowerGeometry, plowBladeGeometry, tractorGeometry, tractorWheelGeometry, vcMat } from '../world/models';
import type { Player } from './player';

// gear id = upgrade id, so lvl(gear) and the first-use hint work for every gear
export type Gear = 'hands' | 'magGun' | 'tractor' | 'blower';
export const GEARS: { id: Gear; label: string; icon: string }[] = [
  { id: 'hands', label: 'Hands', icon: '✋' },
  { id: 'magGun', label: 'Magnet Gun', icon: '🧲' },
  { id: 'tractor', label: 'Plow Tractor', icon: '🚜' },
  { id: 'blower', label: 'Leaf Blower', icon: '🍃' },
];
const ORDER = GEARS.map((g) => g.id);
const FEET = 0.9; // player capsule centre to its bottom (half height 0.55 + radius 0.35)
// Leaf Blower: view model rest position in camera space, slide in/out time, cone (cos 25°), push in m/s² at the nozzle
const BLOW_POS = new THREE.Vector3(0.2, -0.2, -0.38);
const BLOW_SHOW = 0.2;
const BLOW_CONE = 0.9;
// 60 m/s² falling to 24 at the end of the range: the tail still beats grass friction (about 14 m/s²)
const BLOW_ACC = 60;
const BLOW_FALL = 0.6;
const fwd = new THREE.Vector3();
const tmpV = new THREE.Vector3();

// Plow Tractor: steers the gnomes in front of the player along the view direction.
// It sets the velocity instead of applying an impulse, so every weight class is pushed the same.
// Leaf Blower: a hand tool that blows gnomes away in a cone, weaker with distance.
// (The Push Broom was removed, PP 2026-10-20.)
export class Sweeper {
  gear: Gear = 'hands';
  lastGear: Gear | null = null; // the last tool other than hands: C brings it back
  private tractor = new THREE.Group();
  private blade: THREE.Mesh;
  private wheels: { mesh: THREE.Mesh; r: number }[] = [];
  private blower = new THREE.Group();
  private blowShow = 0; // 0..1, slides the blower in from below
  private blowing = 0; // 0..1, tremble while LMB is held
  private whooshT = 0;
  private plowT = 0;

  constructor() {
    const mat = vcMat();
    this.blower.add(new THREE.Mesh(blowerGeometry(), mat));
    this.blower.scale.setScalar(0.5); // view model size next to the Magnet Gun
    this.blower.visible = false;
    ctx.camera.add(this.blower);
    this.blade = new THREE.Mesh(plowBladeGeometry(), mat);
    this.blade.position.set(0, 0.45, -1.85);
    this.tractor.add(new THREE.Mesh(tractorGeometry(), mat), this.blade);
    for (const [x, z, r, w] of [[0.72, 0.4, 0.5, 0.3], [-0.72, 0.4, 0.5, 0.3], [0.6, -0.85, 0.32, 0.2], [-0.6, -0.85, 0.32, 0.2]]) {
      const mesh = new THREE.Mesh(tractorWheelGeometry(r, w), mat);
      mesh.position.set(x, r, z);
      this.tractor.add(mesh);
      this.wheels.push({ mesh, r });
    }
    this.tractor.traverse((o) => (o.castShadow = true));
    this.tractor.visible = false;
    ctx.scene.add(this.tractor);
  }

  // the driver sits higher on the tractor (camera and aiming ray)
  get lift(): number {
    return this.gear === 'tractor' ? 0.4 : 0;
  }

  get plowWidth(): number {
    return 2.6 + 0.8 * lvl('plowWidth');
  }

  get blowRange(): number {
    return 6 + 1.5 * lvl('blowRange');
  }

  owned(): Gear[] {
    return ORDER.filter((g) => g === 'hands' || lvl(g));
  }

  // LMB grabs with this gear (hands carry one thing, the gun pulls a ball)
  get grabs(): boolean {
    return this.gear === 'hands' || this.gear === 'magGun';
  }

  // C (PP 2026-10-20): current tool → hands; hands → the last tool (none yet: the gun if owned).
  // null = nothing to switch to; Tab is the only way to change which tool.
  next(): Gear | null {
    if (this.gear !== 'hands') return 'hands';
    if (this.lastGear && lvl(this.lastGear)) return this.lastGear;
    return lvl('magGun') ? 'magGun' : null;
  }

  // `active`: input locked and not paused, the only time anything is pushed.
  update(dt: number, pl: Player, active: boolean): void {
    fwd.set(-Math.sin(pl.yaw), 0, -Math.cos(pl.yaw));
    const fs = pl.vel.x * fwd.x + pl.vel.z * fwd.z;
    const hs = Math.hypot(pl.vel.x, pl.vel.z);
    const feet = pl.position.y - FEET;
    this.tractor.visible = this.gear === 'tractor';

    if (this.gear === 'tractor') {
      this.tractor.position.set(pl.position.x, feet, pl.position.z);
      this.tractor.rotation.y = pl.yaw;
      this.blade.scale.x = this.plowWidth;
      for (const w of this.wheels) w.mesh.rotation.x -= (fs * dt) / w.r;
      // from the front of the capsule to the front of the blade
      if (active && hs > 0.5) this.push(pl, feet, 0.35, 2.05, this.plowWidth / 2, 0.9, Math.max(0, fs) + 1, dt);
    }

    const blow = this.gear === 'blower' && active && ctx.input.mouse.left;
    this.updateBlower(dt, hs, blow);
    if (blow) this.blow(pl, dt);
  }

  // Blower in hand: slides in while it is the gear, sways with the walk, trembles and tips up while blowing.
  private updateBlower(dt: number, hs: number, blow: boolean): void {
    this.blowShow = THREE.MathUtils.clamp(this.blowShow + (this.gear === 'blower' ? dt : -dt) / BLOW_SHOW, 0, 1);
    this.blower.visible = this.blowShow > 0;
    this.blowing = THREE.MathUtils.damp(this.blowing, blow ? 1 : 0, 10, dt);
    if (!this.blower.visible) return;
    const t = ctx.time;
    const sway = Math.min(1, hs / 6) * 0.012;
    const tr = this.blowing * 0.006;
    this.blower.position.set(
      BLOW_POS.x + Math.sin(t * 5) * sway + Math.sin(t * 57) * tr,
      BLOW_POS.y + Math.abs(Math.sin(t * 5)) * sway + Math.sin(t * 43 + 1) * tr - (1 - outCubic(this.blowShow)) * 0.3,
      BLOW_POS.z,
    );
    this.blower.rotation.set(0.06 * this.blowing, 0.05, 0);
  }

  // Every free gnome (not the king) in the cone along the view is knocked down and pushed away; same
  // acceleration for every weight class (fan rule), weaker towards the end of the range.
  private blow(pl: Player, dt: number): void {
    const eye = pl.eye;
    const dir = pl.dir;
    const range = this.blowRange;
    const acc = BLOW_ACC * (1 + 0.25 * lvl('blowPower'));
    // collect first, change bodies after
    const hit: [Gnome, number][] = [];
    ctx.gnomes.forEachNear(eye.clone().addScaledVector(dir, range / 2), range * 0.6 + 1, (g, _d, p) => {
      if (g.type.id === 'king') return;
      tmpV.set(p.x - eye.x, p.y - eye.y, p.z - eye.z);
      const d = tmpV.length();
      if (d > range || d < 1e-3 || tmpV.dot(dir) / d < BLOW_CONE) return;
      hit.push([g, d]);
    });
    for (const [g, d] of hit) {
      ctx.gnomes.ragdoll(g, 2);
      // blown, not thrown: no trick-shot pay
      g.thrownBy = null;
      g.throwPos = null;
      g.bounced = false;
      g.bullseye = false;
      // aiming down never presses a gnome into the grass; a little lift makes it tumble along
      const k = acc * (1 - (BLOW_FALL * d) / range) * g.body.mass() * dt;
      g.body.applyImpulse({ x: dir.x * k, y: (Math.max(0, dir.y) + 0.3) * k, z: dir.z * k }, true);
    }
    this.whooshT -= dt;
    if (this.whooshT <= 0) {
      this.whooshT = 0.35;
      ctx.audio.whoosh();
    }
    if (Math.random() < dt * 8) ctx.fx.wind(eye.addScaledVector(dir, 1), dir);
  }

  // Every free gnome in the box in front of the player (except the king) is knocked down and steered forward.
  private push(pl: Player, feet: number, near: number, far: number, halfW: number, height: number, speed: number, dt: number): void {
    const rx = -fwd.z;
    const rz = fwd.x;
    const mid = (near + far) / 2;
    const centre = pl.position.clone().addScaledVector(fwd, mid);
    // collect first, change bodies after
    const hit: Gnome[] = [];
    ctx.gnomes.forEachNear(centre, Math.hypot(far - mid, halfW, height + 1), (g, _d, p) => {
      if (g.type.id === 'king') return;
      const dx = p.x - pl.position.x;
      const dz = p.z - pl.position.z;
      const f = dx * fwd.x + dz * fwd.z;
      const s = dx * rx + dz * rz;
      if (f >= near && f <= far && Math.abs(s) <= halfW && p.y >= feet - 0.3 && p.y <= feet + height) hit.push(g);
    });
    const k = 1 - Math.exp(-12 * dt);
    for (const g of hit) {
      ctx.gnomes.ragdoll(g, 3);
      // pushed, not thrown: no trick-shot pay, no UFO hit
      g.thrownBy = null;
      g.throwPos = null;
      g.bounced = false;
      g.bullseye = false;
      const v = g.body.linvel();
      const onGround = g.body.translation().y < feet + 0.5 * g.scale + 0.1;
      g.body.setLinvel({ x: v.x + (fwd.x * speed - v.x) * k, y: onGround ? Math.max(v.y, 0.5) : v.y, z: v.z + (fwd.z * speed - v.z) * k }, true);
    }
    // a scraping thud while the blade is pushing something (hub item 2: plow sound)
    this.plowT -= dt;
    if (hit.length && this.plowT <= 0) {
      this.plowT = 0.3;
      ctx.audio.impact(Math.min(1, 0.3 + hit.length * 0.1), 2);
    }
  }
}
