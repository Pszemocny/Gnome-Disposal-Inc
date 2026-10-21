import * as THREE from 'three';
import { ctx, lvl, rand } from '../core/context';
import { outCubic } from '../core/ease';
import { GOLD_LEVEL, MUSHROOMS, MUSHROOM_BY_ID, mushroomWeight, type MushroomDef } from '../systems/buffs';
import { mushroomPickupGeometry, vcMat } from '../world/models';
import { machineBox } from './machines';

const HOP_TIME = 0.3; // s, the arc out of the hole
const SQUASH_TIME = 0.15; // s, the landing squash after it

interface Pickup {
  def: MushroomDef;
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  glow: THREE.Sprite;
  spin: number; // rad/s, winds up from 0 after the spawn
  hop: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null;
}

let glowTex: THREE.CanvasTexture | null = null;
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export class Mushrooms {
  list: Pickup[] = [];
  private geos = new Map<string, THREE.BufferGeometry>();
  private mat = vcMat({ emissive: 0x333333, flatShading: false });

  constructor() {
    for (const m of MUSHROOMS) this.geos.set(m.id, mushroomPickupGeometry(m.cap, m.spots));
  }

  maybeDrop(pos: THREE.Vector3, bonus = 1): void {
    // the mushroom lesson is guaranteed (PP 2026-10-20): the next eaten gnome drops one when none lies on the grass
    const lesson = ctx.goals.wantsMushroom && this.list.length === 0;
    const chance = lesson ? 1 : 0.025 * (1 + lvl('mushChance') * 0.3) * (1 + lvl('mushStorm') * 0.5) * bonus;
    if (Math.random() < chance) this.spawn(this.pickDef(), pos, true, lesson);
  }

  // true when a mushroom thrown from pos at angle a and speed sp lands inside a placed tool, out of the player's reach
  private landsInTool(pos: THREE.Vector3, a: number, sp: number): boolean {
    const t = (9 + Math.sqrt(81 + 40 * pos.y)) / 20; // flight time: up at 9 m/s, gravity 20, down to y 0
    const x = pos.x + Math.cos(a) * sp * t;
    const z = pos.z + Math.sin(a) * sp * t;
    return this.inTool(x, z);
  }

  inTool(x: number, z: number): boolean {
    return ctx.machines.list.some((m) => {
      const b = machineBox(m.type);
      return !!b && Math.hypot(m.pos.x - x, m.pos.z - z) < Math.max(b.half[0], b.half[2]) + 0.3;
    });
  }

  pickDef(): MushroomDef {
    // Midas Spores: a flat share of Gold Midas on top of the weights (PP 2026-10-21 "same zlote"), never below the gold level
    if (ctx.state.holeLevel >= GOLD_LEVEL && Math.random() < lvl('goldSpores') * 0.18) return MUSHROOM_BY_ID.midas;
    const total = MUSHROOMS.reduce((s, m) => s + mushroomWeight(m), 0);
    let r = Math.random() * total;
    for (const m of MUSHROOMS) {
      const w = mushroomWeight(m);
      r -= w;
      if (w > 0 && r <= 0) return m;
    }
    return MUSHROOMS[0];
  }

  spawn(def: MushroomDef, pos: THREE.Vector3, fromHole: boolean, clearOfTools = false): void {
    if (this.list.length > 25) return;
    const mesh = new THREE.Mesh(this.geos.get(def.id)!, this.mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(1.4);
    mesh.castShadow = true;
    // a glow sprite instead of a point light: adding lights at runtime recompiles every material
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: def.cap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.6);
    glow.position.y = 0.3;
    mesh.add(glow);
    ctx.scene.add(mesh);
    let a = rand(0, Math.PI * 2);
    const sp = fromHole ? rand(4, 7) : 0;
    // the lesson mushroom turns by 45 degrees until it lands clear of the tools (8 tries cover the circle)
    for (let i = 0; clearOfTools && i < 8 && this.landsInTool(pos, a, sp); i++) a += Math.PI / 4;
    this.list.push({ def, mesh, vel: new THREE.Vector3(Math.cos(a) * sp, fromHole ? 9 : 0, Math.sin(a) * sp), age: 0, glow, spin: 0, hop: null });
  }

  // A resting mushroom the hole spawned on, grew over or slid onto hops 1 m past the rim, clear of the tools,
  // so the player never has to walk into the hole for it (PP 2026-10-24).
  private hopOut(m: Pickup): void {
    const h = ctx.env.hole;
    const r = ctx.env.holeRadius + 1;
    let a = rand(0, Math.PI * 2);
    for (let i = 0; i < 8 && this.inTool(h.x + Math.cos(a) * r, h.z + Math.sin(a) * r); i++) a += Math.PI / 4;
    m.hop = { from: m.mesh.position.clone(), to: new THREE.Vector3(h.x + Math.cos(a) * r, 0, h.z + Math.sin(a) * r), t: 0 };
    ctx.fx.burst(m.mesh.position.clone().setY(0.3), m.def.cap, 8);
  }

  private updateHop(m: Pickup, dt: number): void {
    const hop = m.hop!;
    hop.t += dt;
    const k = Math.min(1, hop.t / HOP_TIME);
    m.mesh.position.lerpVectors(hop.from, hop.to, outCubic(k));
    m.mesh.position.y = 4 * k * (1 - k) * 1.2; // a 1.2 m high arc, on the ground at both ends
    if (hop.t < HOP_TIME) return;
    // landing squash, volume kept: sy * sxz * sxz = 1
    const q = Math.min(1, (hop.t - HOP_TIME) / SQUASH_TIME);
    const sy = 1 - 0.3 * (1 - outCubic(q));
    const sxz = 1 / Math.sqrt(sy);
    m.mesh.scale.set(1.4 * sxz, 1.4 * sy, 1.4 * sxz);
    if (q === 1) m.hop = null;
  }

  update(dt: number): void {
    const pp = ctx.player.position;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.age += dt;
      if (m.hop) {
        this.updateHop(m, dt);
      } else if (m.vel.lengthSq() > 0) {
        m.vel.y -= 20 * dt;
        m.mesh.position.addScaledVector(m.vel, dt);
        if (m.mesh.position.y <= 0 && ctx.env.holeDist(m.mesh.position.x, m.mesh.position.z) > ctx.env.holeRadius + 0.3) {
          m.mesh.position.y = 0;
          m.vel.set(0, 0, 0);
        } else if (m.mesh.position.y < -3) {
          // fell back into the hole, try again
          m.mesh.position.copy(ctx.env.hole).setY(0.5);
          m.vel.set(rand(-6, 6), 9, rand(-6, 6));
        }
      } else if (ctx.env.holeDist(m.mesh.position.x, m.mesh.position.z) < ctx.env.holeRadius + 0.3) {
        this.hopOut(m);
      }
      m.spin = THREE.MathUtils.damp(m.spin, 2, 4, dt);
      m.mesh.rotation.y += m.spin * dt;
      m.glow.scale.setScalar(1.4 + Math.sin(m.age * 6) * 0.3);
      const blink = m.age > 25 ? Math.sin(m.age * 20) > 0 : true;
      m.mesh.visible = blink;
      const d = Math.hypot(m.mesh.position.x - pp.x, m.mesh.position.z - pp.z);
      if (d < 1.6 && Math.abs(m.mesh.position.y - (pp.y - 1)) < 1.8) {
        // counted here, not in buffs.apply: the GNOME letters must not pass the mushroom lesson
        ctx.state.stats.mushrooms++;
        ctx.buffs.apply(m.def.id);
        ctx.fx.burst(m.mesh.position.clone().setY(0.5), m.def.cap, 30);
        this.removeAt(i);
      } else if (m.age > 30) {
        this.removeAt(i);
      }
    }
  }

  private removeAt(i: number): void {
    const m = this.list[i];
    ctx.scene.remove(m.mesh);
    this.list.splice(i, 1);
  }

  clearAll(): void {
    while (this.list.length) this.removeAt(this.list.length - 1);
  }
}
