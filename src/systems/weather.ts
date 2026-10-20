import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, G, rand } from '../core/context';
import { outCubic } from '../core/ease';

const FROM_LEVEL = 3;
const GAP_MIN = 240; // dry seconds between two rains
const GAP_MAX = 420;
const DURATION = 45;
// Rapier averages the two frictions; at 0.1/0.15 (avg 0.125) an 8 m/s gnome slid only 9.6 m, the plan asks for >= 15 m
const WET_GROUND = 0.04;
const WET_GNOME = 0.06;
const WET_EXPOSURE = 0.85;
const FADE = 1; // seconds for the sky to darken or clear
const DROPS = 300;
const AREA = 10; // half-size of the rain box around the camera
const TOP = 9; // drops start this high above the camera
const FALL = 22; // m/s
const STREAK = 1; // streak length, m
const TILT = 0.12; // sideways drift per metre of fall
const OPACITY = 0.65;

// Rain: from hole level 3 a 45 s shower every 4-7 minutes makes the grass and the gnomes slippery.
export class Weather {
  private wait = rand(GAP_MIN, GAP_MAX);
  private left = 0; // rain seconds left
  private pass = 0;
  private t = Infinity; // seconds since the rain started or stopped; drives the sky and streak fade
  private from = 0;
  private to = 0;
  private dry = 1;
  private saved = new Map<number, number>(); // collider handle -> friction before the rain
  private found: RAPIER.Collider[] = [];
  private drops = new Float32Array(DROPS * 3);
  private pos = new Float32Array(DROPS * 6);
  private lines: THREE.LineSegments;
  private mat = new THREE.LineBasicMaterial({ color: 0xc8dcf0, transparent: true, opacity: 0, depthWrite: false });

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    ctx.scene.add(this.lines);
  }

  get raining(): boolean {
    return this.left > 0;
  }

  start(): void {
    if (this.raining) return;
    this.left = DURATION;
    this.wait = rand(GAP_MIN, GAP_MAX);
    this.pass = 1;
    this.wetPass();
    // a rain that starts while the last one still clears keeps the real dry value
    if (this.t >= FADE) this.dry = ctx.renderer.toneMappingExposure;
    this.fade(WET_EXPOSURE);
    const c = ctx.camera.position;
    for (let i = 0; i < DROPS; i++) this.drops.set([c.x + rand(-AREA, AREA), c.y + rand(-1, TOP), c.z + rand(-AREA, AREA)], i * 3);
    this.lines.visible = true;
    // not "RAIN": the GNOME RAIN event already uses that word
    ctx.hud.banner('DOWNPOUR', 'Wet grass: everything slides for 45 s');
  }

  update(dt: number): void {
    if (this.raining) {
      this.left -= dt;
      this.pass -= dt;
      if (this.left <= 0) this.end();
      else if (this.pass <= 0) {
        this.pass = 1;
        this.wetPass(); // gnomes spawned and ground rebuilt during the rain
      }
    } else if (ctx.state.holeLevel >= FROM_LEVEL && (this.wait -= dt) <= 0) this.start();

    if (this.t < FADE) {
      this.t += dt;
      const k = outCubic(Math.min(1, this.t / FADE));
      ctx.renderer.toneMappingExposure = this.from + (this.to - this.from) * k;
      this.mat.opacity = OPACITY * (this.raining ? k : 1 - k);
      if (!this.raining && k === 1) this.lines.visible = false;
    }
    if (this.lines.visible) this.fall(dt);
  }

  private end(): void {
    this.left = 0;
    // every handle that still exists gets its own pre-rain value; removed colliders return null
    for (const [h, f] of this.saved) ctx.physics.getCollider(h)?.setFriction(f);
    this.saved.clear();
    this.fade(this.dry);
  }

  private fade(to: number): void {
    this.from = ctx.renderer.toneMappingExposure;
    this.to = to;
    this.t = 0;
  }

  // Wets every GROUND and GNOME collider not wet yet. Collect first, change after the iteration.
  private wetPass(): void {
    const found = this.found;
    ctx.physics.forEachCollider((c) => {
      if ((c.collisionGroups() >>> 16) & (G.GROUND | G.GNOME) && !this.saved.has(c.handle)) found.push(c);
    });
    for (const c of found) {
      this.saved.set(c.handle, c.friction());
      c.setFriction((c.collisionGroups() >>> 16) & G.GROUND ? WET_GROUND : WET_GNOME);
    }
    found.length = 0;
  }

  // Streaks fall in a box that follows the camera; a drop below the ground starts again at the top.
  private fall(dt: number): void {
    const c = ctx.camera.position;
    const d = this.drops;
    const p = this.pos;
    for (let i = 0; i < DROPS; i++) {
      const k = i * 3;
      let x = d[k] + FALL * TILT * dt;
      let y = d[k + 1] - FALL * dt;
      let z = d[k + 2];
      if (y < 0) {
        y += TOP + c.y;
        x = c.x + rand(-AREA, AREA);
        z = c.z + rand(-AREA, AREA);
      }
      // wrap around the camera, so walking does not leave the rain behind
      if (x - c.x > AREA) x -= 2 * AREA;
      else if (c.x - x > AREA) x += 2 * AREA;
      if (z - c.z > AREA) z -= 2 * AREA;
      else if (c.z - z > AREA) z += 2 * AREA;
      d[k] = x;
      d[k + 1] = y;
      d[k + 2] = z;
      const j = i * 6;
      p[j] = x;
      p[j + 1] = y;
      p[j + 2] = z;
      p[j + 3] = x - STREAK * TILT;
      p[j + 4] = y + STREAK;
      p[j + 5] = z;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}
