import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, drawPose, G, groups, lvl, rand, savePose } from '../core/context';
import type { PlacedMachine } from '../core/state';
import { money } from '../core/format';
import { FUSE_TOOLS, UPGRADE_BY_ID } from '../data/upgrades';
import { build, crateGeometry, fuseBoxGeometry, fuseGeometry, vcMat } from '../world/models';
import { tex } from '../world/textures';
import { GNOME_DAMPING, isFree, type Gnome } from './gnomes';
import { glowTexture } from './mushrooms';
import { inQuad, outBack, outCubic, outElastic } from '../core/ease';
import { initRobot, robotVisual, stationLamp, stepOutPost, updateRobot, type Robot } from './robots';

const BARREL_TILT = 0.7; // cannon barrel elevation, radians
const CANNON_RECOIL = 0.3; // how far the barrel kicks back along its axis per shot
const RECOIL_TIME = 0.6; // seconds of the elastic return; a shot during it starts a new recoil

export interface Machine {
  type: string;
  root: THREE.Group;
  spin: THREE.Object3D | null;
  body: RAPIER.RigidBody;
  pos: THREE.Vector3;
  quat: THREE.Quaternion; // any orientation the player chose
  yaw: number; // heading of the local +Z axis, for the cannon barrel
  tilt: number;
  broken: number;
  spinRate: number; // rad/s of the spinning part, damped toward SPIN_RATE (0 while broken)
  t: number;
  queue: Gnome[];
  smoke: number;
  home: THREE.Vector3;
  fill: THREE.Object3D[];
  prevPos: THREE.Vector3; // render interpolation, used by the crate and the robot
  prevRot: THREE.Quaternion;
  robot?: Robot; // cleaning robot state; pos and home are its station centre, the truck is the body
  marker?: THREE.Object3D; // the robot's station with its area ring
  station?: RAPIER.RigidBody; // the robot's station pole and pad (fixed), E/G/X aim at it
  blown: number; // fuses blown by saboteurs (red), not saved
  fuseAnim?: { i: number; t: number; kind: 'blow' | 'swap' };
  fuseSlot: number; // first instance of this tool's fuses in fuseMesh this frame, -1 when it has none
  power: number; // fan push factor, FAN_POWERS (key N); 1 for every other tool
  windup?: number; // funnel: seconds into the outlet's pull-back before a shot, undefined while idle
  gulp?: number; // funnel: seconds since the mouth swallowed a gnome, drives its squash
}

// tools with a moving dynamic body (the rest are fixed where they were placed)
const moving = (m: Machine) => m.type === 'box' || m.type === 'robot';

// Fuses (PP 2026-10-20 "bezpieczniki", per tool since 2026-10-21): every tool but the crate and the panel
// carries the level of its own `<tool>Fuses` upgrade as slots.
const FUSE_ID: Record<string, string> = Object.fromEntries(FUSE_TOOLS.map((id) => [id, `${id}Fuses`]));
export const fuseCount = (m: Machine): number => (FUSE_ID[m.type] ? lvl(FUSE_ID[m.type]) : 0);
export const needsRepair = (m: Machine): boolean => m.broken > 0 || m.blown > 0;
// every fuse-able tool at its max with its Fuses at max, so a limit change keeps every fuse drawn (285 / 57)
const FUSE_CAP = FUSE_TOOLS.reduce((s, id) => s + UPGRADE_BY_ID[id].max * UPGRADE_BY_ID[FUSE_ID[id]].max, 0);
const BOX_CAP = FUSE_TOOLS.reduce((s, id) => s + UPGRADE_BY_ID[id].max, 0);
const FUSE_GAP = 0.07;
const FUSE_Z = 0.05; // fuses stand out of the box's front face
const FUSE_RED = new THREE.Color(0xff4040);
const FUSE_GREEN = new THREE.Color(0x3ddc5a);
// fuse box mount in the tool's frame: x, y, z, yaw (front face direction)
const FUSE_AT: Record<string, [number, number, number, number]> = {
  wheel: [1.25, 0.35, 0, Math.PI / 2],
  trampoline: [1.15, 0.25, 0, Math.PI / 2],
  blackhole: [1.2, 0.25, 0, Math.PI / 2],
  magnet: [0.7, 0.5, 0, Math.PI / 2],
  vacuum: [0.9, 1.0, 0, Math.PI / 2],
  robot: [0, 1.0, -1.08, 0], // on the station pole, facing the pad
  funnel: [0.6, 1.2, 0, Math.PI / 2],
};
const FUSE_LOCAL: Record<string, THREE.Matrix4> = {};
const beltFuse = new THREE.Matrix4();
function fuseLocal(type: string): THREE.Matrix4 {
  // the belt's box sits on its side rail, which moves out with Wide Belt
  if (type === 'conveyor') return beltFuse.makeRotationY(Math.PI / 2).setPosition(beltWidth() / 2 + 0.15, 0.6, 0);
  if (!FUSE_LOCAL[type]) {
    const [x, y, z, yaw] = FUSE_AT[type] ?? [0.8, 0.6, 0, Math.PI / 2];
    FUSE_LOCAL[type] = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  }
  return FUSE_LOCAL[type];
}
const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();
const tmpM3 = new THREE.Matrix4();

export const CRATE_HATS = 12;

export function crateCap(): number {
  return 12 + 6 * lvl('crateSize');
}

const GRAVITY = 20;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (a: number, b: number, h: number, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
// the hanging magnet's head (mouth of the horseshoe) in the tool's own frame
const MAGNET_HEAD = new THREE.Vector3(0, 2.45, 3.5);
const MAGNET_RANGE = 13;
const MAGNET_PULL = 30; // m/s², beats grass friction (0.7 x gravity 20)
const MAGNET_LIFT = 8; // m/s² up while on the ground, less than gravity: they slide and hop, never float
const MAGNET_STOP = 1.2; // no pull this close to the head's vertical line, so gnomes drop there
// Gnome Funnel: catch zone in the tool's frame (inside the cone mouth), outlet tilted down, one shot per FUNNEL_RATE
const FUNNEL_MOUTH = { r: 1.3, y0: 2.3, y1: 4.0 };
const FUNNEL_DROP = 0.35; // outlet pipe points 20° below horizontal
const FUNNEL_CAP = 20; // gnomes waiting inside, as the cannon
const FUNNEL_RATE = 0.35; // s between shots
const FUNNEL_WINDUP = 0.08; // s the outlet pulls back before the gnome leaves (anticipation, rule 4)
const FUNNEL_RECOIL = 0.3;
const FUNNEL_GULP = 0.2; // s of the mouth's squash when it swallows a gnome (rule 5)

// Visual for each tool. Shared by the placement ghost and real machines.
export function machineVisual(type: string): { root: THREE.Group; spin: THREE.Object3D | null } {
  const root = new THREE.Group();
  let spin: THREE.Object3D | null = null;
  const mat = vcMat();
  const add = (geo: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  switch (type) {
    case 'box': {
      const crate = new THREE.Mesh(crateGeometry(), vcMat({ map: tex('wood_diff') }));
      crate.castShadow = crate.receiveShadow = true;
      root.add(crate);
      // little gnome hats show how full the crate is
      const hatGeo = new THREE.ConeGeometry(0.13, 0.32, 16);
      const hatMats = [new THREE.MeshStandardMaterial({ color: 0xd8352a }), new THREE.MeshStandardMaterial({ color: 0x2f6fd0 })];
      for (let i = 0; i < CRATE_HATS; i++) {
        const hat = new THREE.Mesh(hatGeo, hatMats[i % 2]);
        hat.position.set(((i % 4) - 1.5) * 0.32, 0.25 + Math.floor(i / 4) * 0.12, (Math.floor(i / 4) - 1) * 0.36 + ((i % 2) - 0.5) * 0.1);
        hat.visible = false;
        hat.name = 'fill';
        root.add(hat);
      }
      break;
    }
    case 'panel':
      add(build([
        { g: box(3, 2, 0.1), c: 0x9aa4ae },
        ...[-1.35, 1.35].flatMap((x) => [-0.85, 0.85].map((y) => ({ g: new THREE.SphereGeometry(0.05, 6, 4), c: 0x6a7480, p: [x, y, 0.06] as [number, number, number] }))),
      ]));
      break;
    case 'trampoline':
      add(build([
        { g: cyl(1.05, 1.05, 0.12, 20), c: 0x2a6fd8, p: [0, 0.32, 0] },
        { g: cyl(0.92, 0.92, 0.14, 20), c: 0x1a1a1a, p: [0, 0.33, 0] },
        { g: box(0.2, 0.02, 0.6), c: 0xffe066, p: [0, 0.41, 0.1] },
        { g: new THREE.ConeGeometry(0.25, 0.3, 3), c: 0xffe066, p: [0, 0.41, 0.5], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.2] },
        ...[0, 1, 2, 3].map((i) => ({ g: cyl(0.04, 0.04, 0.32, 6), c: 0x888888, p: [Math.cos(i * 1.57 + 0.78) * 0.9, 0.16, Math.sin(i * 1.57 + 0.78) * 0.9] as [number, number, number] })),
      ]));
      break;
    case 'fan': {
      add(build([
        { g: box(0.8, 0.15, 0.8), c: 0x4a5560, p: [0, 0.075, 0] },
        { g: cyl(0.06, 0.06, 1.2, 8), c: 0x8a96a0, p: [0, 0.7, 0] },
        { g: new THREE.TorusGeometry(0.75, 0.05, 6, 24), c: 0xd8e0e8, p: [0, 1.4, 0.05] },
        { g: cyl(0.15, 0.15, 0.3, 10), c: 0x4a5560, p: [0, 1.4, -0.15], r: [Math.PI / 2, 0, 0] },
      ]));
      const blades = new THREE.Mesh(build([0, 1, 2, 3].map((i) => ({ g: box(0.22, 0.65, 0.03), c: 0x6ac0ff, p: [Math.sin(i * 1.57) * 0.35, Math.cos(i * 1.57) * 0.35, 0] as [number, number, number], r: [0, 0.3, -i * 1.57] as [number, number, number] }))), mat);
      blades.position.set(0, 1.4, 0.05);
      root.add(blades);
      spin = blades;
      break;
    }
    case 'conveyor': {
      // frame, side rails that keep gnomes on the belt (open ends) and yellow arrows pointing along local +Z
      // width grows with Wide Belt (1.3 m + 0.6 m per level); the rails stand 0.05 m outside the belt
      const W = beltWidth();
      const rx = W / 2 + 0.05;
      const arrow = (x: number, z: number) => ({ g: new THREE.ConeGeometry(0.08, 0.22, 3), c: 0xffcc22, p: [x, 0.78, z] as [number, number, number], r: [Math.PI / 2, 0, 0] as [number, number, number] });
      add(build([
        { g: box(W, 0.22, 3.0), c: 0x5a5f66, p: [0, 0.11, 0] },
        { g: box(0.1, 0.48, 3.2), c: 0x3a3f46, p: [-rx, 0.46, 0] },
        { g: box(0.1, 0.48, 3.2), c: 0x3a3f46, p: [rx, 0.46, 0] },
        ...[-0.8, 0.8].flatMap((z) => [arrow(-rx, z), arrow(rx, z)]),
      ]));
      // rollers spin with the belt; the yellow stripe makes the spin visible
      const rollerGeo = build([
        { g: cyl(0.13, 0.13, W - 0.02, 10), c: 0x9aa0a8, r: [0, 0, Math.PI / 2] },
        { g: box(W - 0.01, 0.04, 0.05), c: 0xffcc22, p: [0, 0.115, 0] },
      ]);
      for (const z of [-1.47, 0, 1.47]) {
        const roller = add(rollerGeo);
        roller.name = 'roller';
        roller.position.set(0, 0.22, z);
      }
      // own texture copy: every belt scrolls its own offset
      const map = stripeTexture().clone();
      map.repeat.x = Math.max(1, Math.round(W / 1.3)); // chevrons tile across a wide belt instead of stretching
      const belt = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, BELT_LEN), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
      belt.position.y = 0.335;
      belt.receiveShadow = true;
      root.add(belt);
      spin = belt;
      break;
    }
    case 'wheel': {
      add(build([
        { g: box(0.2, 2.6, 0.3), c: 0xc9a77a, p: [-0.75, 1.3, 0], r: [0, 0, 0.12] },
        { g: box(0.2, 2.6, 0.3), c: 0xc9a77a, p: [0.75, 1.3, 0], r: [0, 0, -0.12] },
        { g: box(2.2, 0.2, 0.9), c: 0xb8966a, p: [0, 0.1, 0] },
      ]));
      const wheel = new THREE.Mesh(build([
        { g: cyl(0.12, 0.12, 1.5, 10), c: 0x8a6a4a, r: [0, 0, Math.PI / 2] },
        { g: cyl(0.4, 0.4, 0.25, 12), c: 0xb8966a, r: [0, 0, Math.PI / 2] },
        ...[0, 1, 2, 3].flatMap((i) => {
          const a = i * (Math.PI / 2);
          const y = Math.cos(a);
          const z = Math.sin(a);
          return [
            { g: box(0.14, 1.2, 0.14), c: 0xc9a77a, p: [0, y * 0.6, z * 0.6] as [number, number, number], r: [a, 0, 0] as [number, number, number] },
            { g: box(0.3, 0.35, 0.55), c: 0x6a3a1a, p: [0, y * 1.25, z * 1.25] as [number, number, number], r: [a, 0, 0] as [number, number, number] },
          ];
        }),
      ]), mat);
      wheel.position.y = 1.5;
      wheel.castShadow = true;
      root.add(wheel);
      spin = wheel;
      break;
    }
    case 'magnet': {
      // upside-down L: heavy base, post, arm along local +Z, horseshoe hanging at the arm's end, opening down
      const h = MAGNET_HEAD;
      add(build([
        { g: box(1.2, 0.3, 1.2), c: 0x444a50, p: [0, 0.15, 0] },
        { g: cyl(0.12, 0.14, 3.2, 8), c: 0x8a96a0, p: [0, 1.75, 0] },
        { g: box(0.22, 0.22, 3.7), c: 0x8a96a0, p: [0, 3.3, h.z / 2 - 0.05] },
        { g: cyl(0.05, 0.05, 0.3, 6), c: 0x55595e, p: [0, 3.05, h.z] },
        { g: new THREE.TorusGeometry(0.4, 0.14, 8, 16, Math.PI), c: 0xd8352a, p: [0, h.y + 0.05, h.z] },
        { g: box(0.3, 0.25, 0.3), c: 0xd8dce0, p: [-0.4, h.y - 0.03, h.z] },
        { g: box(0.3, 0.25, 0.3), c: 0xd8dce0, p: [0.4, h.y - 0.03, h.z] },
      ]));
      // placement hint: a ring on the ground under the head, green when gnomes would drop into the hole.
      // Kept in world space at render time, so it stays on the ground however the ghost is turned.
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffcc33 }));
      ring.name = 'drop';
      ring.frustumCulled = false;
      ring.onBeforeRender = (_r, _s, _c, _g, material) => {
        const p = tmpV.copy(MAGNET_HEAD).applyMatrix4(root.matrixWorld);
        ring.matrixWorld.makeTranslation(p.x, 0.04, p.z);
        (material as THREE.MeshBasicMaterial).color.setHex(ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius ? 0x66ff88 : 0xffcc33);
      };
      root.add(ring);
      break;
    }
    case 'cannon': {
      add(build([
        { g: box(1.4, 0.4, 1.8), c: 0x5a3a20, p: [0, 0.4, 0] },
        { g: cyl(0.5, 0.5, 0.15, 12), c: 0x3a2414, p: [-0.8, 0.5, 0.4], r: [0, 0, Math.PI / 2] },
        { g: cyl(0.5, 0.5, 0.15, 12), c: 0x3a2414, p: [0.8, 0.5, 0.4], r: [0, 0, Math.PI / 2] },
        { g: cyl(0.75, 0.35, 0.8, 12), c: 0x777777, p: [0, 1.0, -1.1] },
      ]));
      const barrel = new THREE.Group();
      const b = new THREE.Mesh(build([
        { g: cyl(0.35, 0.45, 2.2, 14), c: 0x2a2a30, p: [0, 1.0, 0] },
        { g: new THREE.TorusGeometry(0.38, 0.08, 6, 14), c: 0xc9a227, p: [0, 2.05, 0], r: [Math.PI / 2, 0, 0] },
      ]), mat);
      b.rotation.x = BARREL_TILT;
      b.castShadow = true;
      barrel.add(b);
      barrel.position.y = 0.8;
      root.add(barrel);
      spin = barrel;
      break;
    }
    case 'vacuum': {
      add(build([
        { g: cyl(0.9, 1.1, 0.4, 16), c: 0x3a4a5a, p: [0, 0.2, 0] },
        { g: cyl(0.55, 0.7, 3.2, 16), c: 0xd8dce4, p: [0, 2, 0] },
        { g: cyl(1.4, 0.55, 1.0, 16), c: 0xff8a2a, p: [0, 4.1, 0] },
        { g: cyl(0.6, 0.6, 0.15, 16), c: 0x222222, p: [0, 4.62, 0] },
      ]));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 24), new THREE.MeshStandardMaterial({ color: 0x6ae0ff, emissive: 0x2a90c0 }));
      ring.position.y = 1.8;
      ring.rotation.x = Math.PI / 2;
      root.add(ring);
      spin = ring;
      break;
    }
    case 'blackhole': {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      core.position.y = 1.4;
      root.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 8, 40), new THREE.MeshStandardMaterial({ color: 0xb07aff, emissive: 0x8a3ad8, emissiveIntensity: 2 }));
      ring.position.y = 1.4;
      ring.rotation.x = 1.2;
      root.add(ring);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xb07aff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.scale.setScalar(4);
      glow.position.y = 1.4;
      root.add(glow);
      add(build([{ g: cyl(1.0, 1.2, 0.3, 16), c: 0x2a1a3a, p: [0, 0.15, 0] }]));
      spin = ring;
      break;
    }
    case 'robot': {
      const v = robotVisual();
      root.add(...v.root.children);
      spin = v.bed;
      break;
    }
    case 'funnel': {
      // vertical tube on an elbow; the cone mouth on top and the outlet are their own meshes (gulp squash, aim and recoil)
      add(build([
        { g: cyl(0.45, 0.45, 2.0, 14), c: 0x8a96a0, p: [0, 1.5, 0] },
        { g: new THREE.SphereGeometry(0.5, 12, 8), c: 0x8a96a0, p: [0, 0.5, 0] },
      ]));
      // pivot at the cone's narrow end, so the squash keeps it on the tube
      const mouth = new THREE.Mesh(build([{ g: new THREE.CylinderGeometry(1.3, 0.45, 0.8, 16, 1, true), c: 0xff8a2a, p: [0, 0.4, 0] }]), vcMat({ side: THREE.DoubleSide, emissive: 0xff8a2a, emissiveIntensity: 0.35 }));
      // a little glow in its own orange: the outer wall faces down into shadow and read dark brown (review round)
      mouth.position.y = 2.5;
      mouth.name = 'mouth';
      mouth.castShadow = true;
      root.add(mouth);
      const out = new THREE.Group();
      const pipe = new THREE.Mesh(build([{ g: cyl(0.4, 0.45, 1.2, 14), c: 0x8a96a0, p: [0, 0.6, 0] }]), mat);
      pipe.rotation.x = Math.PI / 2 + FUNNEL_DROP; // local +Y of the pipe → forward and 20° down
      pipe.castShadow = true;
      out.add(pipe);
      out.position.y = 0.5;
      root.add(out);
      spin = out;
      break;
    }
  }
  return { root, spin };
}

let stripeTex: THREE.CanvasTexture | null = null;
function stripeTexture(): THREE.CanvasTexture {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#222';
  g.fillRect(0, 0, 32, 64);
  g.fillStyle = '#ffcc22';
  // chevron tip at the bottom of the canvas: on the box top face that is local +Z, the carrying direction
  g.beginPath();
  g.moveTo(4, 24);
  g.lineTo(16, 44);
  g.lineTo(28, 24);
  g.lineTo(22, 24);
  g.lineTo(16, 34);
  g.lineTo(10, 24);
  g.fill();
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.repeat.set(1, BELT_REPEAT);
  return stripeTex;
}

const BELT_LEN = 2.94;
// Wide Belt (PP 2026-10-21 "pasy transportowe moga miec szerokosc"): 1.3 m + 0.6 m per level, every belt at once
export const beltWidth = (): number => 1.3 + 0.6 * lvl('beltWidth');
const BELT_REPEAT = 4;
const BELT_SPEED = 4.5;
// Spinning parts wind up and down instead of starting and stopping in one frame (animation rule 7).
// Visual only: the push, pull and belt carry still start and stop at once.
const SPIN_RATE: Record<string, number> = { fan: 25, wheel: 7, vacuum: 6, blackhole: 3, conveyor: BELT_SPEED / 0.13 };
const SPIN_AXIS: Record<string, 'x' | 'z'> = { fan: 'z', wheel: 'x', vacuum: 'z', blackhole: 'z' };
const SPIN_LAMBDA = 4;
const FAN_RANGE = 10; // metres in front of the fan
const FAN_TRIP = 9; // walking and sleeping gnomes get knocked over only this close
// Big Blades (PP 2026-10-21 "wiatraki moga miec sile nadmuchu"): +25% push along the fan axis per level
export const fanPush = (): number => 1 + 0.25 * lvl('fanPower');
// per-fan power, key N cycles down and wraps (PP 2026-10-25 "musi byc opcja zmiany mocy")
export const FAN_POWERS = [1, 0.75, 0.5, 0.25];

// Local bounding box of each tool (half extents and the box centre relative to the model origin).
// Placement rests this box on the surface you look at and refuses spots where it overlaps anything.
export const MACHINE_BOX: Record<string, { half: [number, number, number]; center: [number, number, number] }> = {
  box: { half: [0.8, 0.5, 0.8], center: [0, 0, 0] },
  panel: { half: [1.5, 1, 0.05], center: [0, 0, 0] },
  trampoline: { half: [1.05, 0.22, 1.05], center: [0, 0.22, 0] },
  fan: { half: [0.75, 1.1, 0.4], center: [0, 1.1, 0] },
  conveyor: { half: [0.75, 0.43, 1.6], center: [0, 0.43, 0] },
  wheel: { half: [1.1, 1.5, 1.3], center: [0, 1.5, 0] },
  magnet: { half: [0.6, 1.7, 0.6], center: [0, 1.7, 0] }, // base + post only: the arm may hang over the hole
  cannon: { half: [1.0, 1.0, 1.3], center: [0, 1.0, 0] },
  vacuum: { half: [1.4, 2.4, 1.4], center: [0, 2.4, 0] },
  blackhole: { half: [1.3, 1.5, 1.3], center: [0, 1.4, 0] },
  // truck, pad and pole; the pad rests on the ground. The back reaches 1.42 m so the 8 % shrunk placement box still
  // covers the pole as far as poleBlocked tests it (1.31 m): a green preview never loads back into the inventory
  robot: { half: [1.0, 0.86, 1.36], center: [0, 0.86, -0.06] },
  funnel: { half: [0.55, 1.75, 0.55], center: [0, 1.75, 0] }, // tube and elbow only: the mouth may overhang the hole, like the magnet's arm
};
// the robot station's pole, for old saves whose pole would stand inside a tool (restore)
const POLE_BOX: { half: [number, number, number]; center: [number, number, number] } = { half: [0.2, 0.8, 0.16], center: [0, 0.8, -1.16] };

// the box of a tool type now: the belt's grows with Wide Belt (rails 0.05 m outside, 0.05 m thick)
export function machineBox(type: string): { half: [number, number, number]; center: [number, number, number] } {
  return type === 'conveyor' ? { half: [beltWidth() / 2 + 0.1, 0.43, 1.6], center: [0, 0.43, 0] } : MACHINE_BOX[type];
}

// lowest world height of a tool's box at pos / q (placement reach, saboteur reach, the funnel's release floor)
const tmpB = new THREE.Vector3();
export function boxBottom(type: string, pos: THREE.Vector3, q: THREE.Quaternion): number {
  const b = machineBox(type);
  let ext = 0;
  for (let i = 0; i < 3; i++) ext += Math.abs(tmpB.set(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0).applyQuaternion(q).y) * b.half[i];
  return pos.y + tmpB.set(...b.center).applyQuaternion(q).y - ext;
}
const SABOTEUR_REACH = 2.5; // m between a saboteur and a tool's lowest point: higher or lower, it cannot hit the tool

// a tool base may overhang the hole edge by this much (the L-magnet stands right at the rim)
const HOLE_EDGE = 0.15;

// The tool's box seen from above, at any height: does it reach into the hole by more than HOLE_EDGE?
// The footprint is centre ± the box's three half axes projected on the ground (a convex polygon).
// Placement and the Wide Belt rebuild both use it.
export function footprintOverHole(centre: THREE.Vector3, half: THREE.Vector3, q: THREE.Quaternion): boolean {
  const hole = ctx.env.hole;
  const r = ctx.env.holeRadius - HOLE_EDGE;
  const gen = [new THREE.Vector3(half.x, 0, 0), new THREE.Vector3(0, half.y, 0), new THREE.Vector3(0, 0, half.z)].map((a) => a.applyQuaternion(q));
  const px = hole.x - centre.x;
  const pz = hole.z - centre.z;
  // hole centre inside: within the footprint's reach across every edge direction
  let inside = true;
  for (const g of gen) {
    const nx = -g.z;
    const nz = g.x;
    if (nx * nx + nz * nz < 1e-9) continue;
    const reach = gen.reduce((s, a) => s + Math.abs(a.x * nx + a.z * nz), 0);
    if (Math.abs(px * nx + pz * nz) > reach) inside = false;
  }
  if (inside) return true;
  // otherwise the closest of the 12 projected box edges decides
  const cx = (i: number) => gen.reduce((s, a, k) => s + ((i >> k) & 1 ? a.x : -a.x), 0);
  const cz = (i: number) => gen.reduce((s, a, k) => s + ((i >> k) & 1 ? a.z : -a.z), 0);
  for (let i = 0; i < 8; i++) {
    for (let b = 1; b < 8; b <<= 1) {
      if (i & b) continue;
      const ax = cx(i);
      const az = cz(i);
      const dx = cx(i | b) - ax;
      const dz = cz(i | b) - az;
      const len = dx * dx + dz * dz;
      const t = len ? THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / len, 0, 1) : 0;
      if (Math.hypot(px - ax - t * dx, pz - az - t * dz) < r) return true;
    }
  }
  return false;
}

// colliders of a tool in its own frame (place() and the Wide Belt rebuild)
function colliderDescs(type: string): RAPIER.ColliderDesc[] {
  const { R } = ctx;
  const colliders: RAPIER.ColliderDesc[] = [];
  switch (type) {
    case 'box':
      // open-top crate: floor + four walls, 1.5 kg in total so the base magnet (lift 2.25) can carry it
      colliders.push(R.ColliderDesc.cuboid(0.8, 0.06, 0.8).setTranslation(0, -0.44, 0).setMass(0.7).setFriction(0.9));
      colliders.push(R.ColliderDesc.cuboid(0.8, 0.5, 0.06).setTranslation(0, 0, 0.74).setMass(0.2));
      colliders.push(R.ColliderDesc.cuboid(0.8, 0.5, 0.06).setTranslation(0, 0, -0.74).setMass(0.2));
      colliders.push(R.ColliderDesc.cuboid(0.06, 0.5, 0.68).setTranslation(0.74, 0, 0).setMass(0.2));
      colliders.push(R.ColliderDesc.cuboid(0.06, 0.5, 0.68).setTranslation(-0.74, 0, 0).setMass(0.2));
      break;
    case 'panel': colliders.push(R.ColliderDesc.cuboid(1.5, 1, 0.05).setFriction(0.2)); break;
    case 'trampoline': colliders.push(R.ColliderDesc.cylinder(0.2, 1.05).setTranslation(0, 0.2, 0)); break;
    case 'fan': colliders.push(R.ColliderDesc.cuboid(0.4, 0.8, 0.3).setTranslation(0, 0.8, -0.1)); break;
    case 'conveyor': {
      // low friction: the belt sets the gnome's speed itself, friction would only tumble it
      const hw = beltWidth() / 2;
      colliders.push(R.ColliderDesc.cuboid(hw + 0.1, 0.175, 1.6).setTranslation(0, 0.175, 0).setFriction(0.3));
      colliders.push(R.ColliderDesc.cuboid(0.05, 0.24, 1.6).setTranslation(-(hw + 0.05), 0.46, 0));
      colliders.push(R.ColliderDesc.cuboid(0.05, 0.24, 1.6).setTranslation(hw + 0.05, 0.46, 0));
      break;
    }
    case 'wheel': colliders.push(R.ColliderDesc.cuboid(1.1, 0.1, 0.45).setTranslation(0, 0.1, 0)); break;
    case 'magnet':
      // base, post and a thin arm up high; nothing under the head, so gnomes fall through
      colliders.push(R.ColliderDesc.cuboid(0.6, 0.15, 0.6).setTranslation(0, 0.15, 0));
      colliders.push(R.ColliderDesc.cuboid(0.13, 1.6, 0.13).setTranslation(0, 1.75, 0));
      colliders.push(R.ColliderDesc.cuboid(0.11, 0.11, 1.85).setTranslation(0, 3.3, MAGNET_HEAD.z / 2 - 0.05));
      break;
    case 'cannon': colliders.push(R.ColliderDesc.cuboid(0.7, 0.6, 0.9).setTranslation(0, 0.6, 0.2)); break;
    case 'vacuum': colliders.push(R.ColliderDesc.cylinder(2.3, 0.8).setTranslation(0, 2.3, 0)); break;
    case 'blackhole': colliders.push(R.ColliderDesc.cylinder(0.15, 1.1).setTranslation(0, 0.15, 0)); break;
    // the tube only: nothing over it, so gnomes fall into the mouth
    case 'funnel': colliders.push(R.ColliderDesc.cylinder(1.0, 0.5).setTranslation(0, 1.5, 0)); break;
    // heavy, and no friction: the robot sets its own velocity every frame, the ground must not brake it
    case 'robot':
      colliders.push(R.ColliderDesc.cuboid(0.55, 0.3, 0.8).setTranslation(0, 0.3, 0).setMass(150).setFriction(0).setFrictionCombineRule(R.CoefficientCombineRule.Min));
      break;
  }
  return colliders;
}

export function machineRotation(yaw: number, tilt: number): THREE.Quaternion {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
}

export class Machines {
  list: Machine[] = [];
  byCollider = new Map<number, Machine>();
  fuseMesh = new THREE.InstancedMesh(fuseGeometry(), vcMat({ roughness: 0.4, emissive: 0x111111 }), FUSE_CAP);
  boxMesh = new THREE.InstancedMesh(fuseBoxGeometry(), vcMat(), BOX_CAP);

  constructor() {
    this.fuseMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FUSE_CAP * 3), 3);
    for (const im of [this.fuseMesh, this.boxMesh]) {
      im.count = 0;
      im.castShadow = false;
      im.frustumCulled = false;
      ctx.scene.add(im);
    }
  }

  placedCount(type: string): number {
    return this.list.filter((m) => m.type === type).length;
  }

  available(type: string): number {
    return lvl(type) - this.placedCount(type);
  }

  place(type: string, pos: THREE.Vector3, rotation: THREE.Quaternion, power = 1): Machine {
    const { R, physics, scene } = ctx;
    const { root, spin } = machineVisual(type);
    root.getObjectByName('drop')?.removeFromParent(); // the drop-point ring is a placement hint only
    const q = rotation.clone();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const yaw = Math.atan2(fwd.x, fwd.z);
    const tilt = 0;
    root.position.copy(pos);
    root.quaternion.copy(q);
    scene.add(root);
    const rot = { x: q.x, y: q.y, z: q.z, w: q.w };
    // higher dominance: gnomes bump into the crate but can never push it (PP 2026-10-19)
    // the robot truck too, and it stays upright (it sets its own heading)
    const desc = type === 'box' ? R.RigidBodyDesc.dynamic().setDominanceGroup(1)
      : type === 'robot' ? R.RigidBodyDesc.dynamic().setDominanceGroup(1).lockRotations()
      : R.RigidBodyDesc.fixed();
    const body = physics.createRigidBody(desc.setTranslation(pos.x, pos.y, pos.z).setRotation(rot));
    const colliders = colliderDescs(type);
    // the robot's hats sit inside its bed
    const fill = root.getObjectsByProperty('name', 'fill');
    const m: Machine = { type, root, spin, body, pos: pos.clone(), quat: q, yaw, tilt, broken: 0, spinRate: 0, t: type === 'cannon' || type === 'funnel' ? RECOIL_TIME : rand(0, 1), queue: [], smoke: 0, home: pos.clone(), fill, prevPos: pos.clone(), prevRot: q.clone(), blown: 0, fuseSlot: -1, power };
    const grp = moving(m) ? groups(G.PROP, 0xffff) : groups(G.STATIC, 0xffff);
    for (const cd of colliders) {
      const col = physics.createCollider(cd.setCollisionGroups(grp), body);
      this.byCollider.set(col.handle, m);
    }
    if (type === 'robot') initRobot(m);
    this.list.push(m);
    return m;
  }

  remove(m: Machine): void {
    // an eaten gnome has no body any more: touching it crashes Rapier
    for (const g of m.queue) if (ctx.gnomes.list.includes(g)) ctx.gnomes.release(g, m.pos.clone().setY(1.5), new THREE.Vector3(0, 3, 0));
    m.queue = [];
    ctx.scene.remove(m.root);
    if (m.marker) ctx.scene.remove(m.marker);
    for (const [h, v] of this.byCollider) if (v === m) this.byCollider.delete(h);
    ctx.physics.removeRigidBody(m.body);
    if (m.station) ctx.physics.removeRigidBody(m.station);
    this.list.splice(this.list.indexOf(m), 1);
  }

  clearAll(): void {
    while (this.list.length) this.remove(this.list[this.list.length - 1]);
  }

  // Put a placed tool somewhere else (the hole carries the tools at its rim when it moves).
  move(m: Machine, pos: THREE.Vector3): void {
    m.pos.copy(pos);
    m.root.position.copy(pos);
    m.body.setTranslation(pos, true);
  }

  // returns how many tools it left in the inventory: beyond the fence, in the hole or buried in the factory
  restore(placed: PlacedMachine[]): number {
    let inFactory = 0;
    for (const p of placed) {
      if (!UPGRADE_BY_ID[p.type] || this.available(p.type) <= 0) continue;
      // beyond the fence (the yard changed shape, rebirth) or in the hole: back to the inventory, counted with the factory skips
      if (!ctx.env.inside(p.x, p.z, 0.5) || (ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius + 0.6 && p.y < 1.5)) {
        inFactory++;
        continue;
      }
      // buried under the chute, pedestal or gear in an old save: back to the inventory, like the hole skip in blueprints
      if (p.y < 1.0 && ctx.factory.inside(p.x, p.z)) {
        inFactory++;
        continue;
      }
      // saves from before free rotation only have yaw and tilt
      const q = p.qw !== undefined ? new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw) : machineRotation(p.yaw, p.tilt);
      const n = this.place(p.type, new THREE.Vector3(p.x, p.y, p.z), q, p.power ?? 1);
      // a belt saved narrower may have no room at today's Wide Belt width: back to the inventory
      // (0.75: the half width of a belt without Wide Belt, the one placement checked)
      if (n.type === 'conveyor' && lvl('beltWidth') > 0 && this.overlaps(n, 0.75)) {
        this.remove(n);
        inFactory++;
      }
    }
    // a save from before stations: the pole may land inside a tool or the factory; the robot goes back like a belt
    // that lost its room (after the loop, so a tool saved after its robot counts too)
    for (const m of this.list.filter((x) => x.type === 'robot')) {
      if (this.poleBlocked(m)) {
        this.remove(m);
        inFactory++;
      }
    }
    return inFactory;
  }

  // The robot station's pole touches a fixed collider (a tool, the factory, the house) or stands in the factory.
  // A pair test over every collider, as in overlaps: restore() checks tools placed in the same frame.
  // Also used by stepOutPost when the hole pushes a station out.
  poleBlocked(m: Machine): boolean {
    const q = m.marker!.quaternion;
    const c = tmpV.set(...POLE_BOX.center).applyQuaternion(q).add(m.pos);
    if (ctx.factory.inside(c.x, c.z)) return true;
    const shape = new ctx.R.Cuboid(POLE_BOX.half[0] * 0.92, POLE_BOX.half[1] * 0.92, POLE_BOX.half[2] * 0.92);
    const at = { x: c.x, y: c.y, z: c.z };
    const rot = { x: q.x, y: q.y, z: q.z, w: q.w };
    let hit = false;
    ctx.physics.colliders.forEach((col) => {
      const parent = col.parent();
      if (hit || col.isSensor() || !parent?.isFixed() || parent.handle === m.station!.handle || (col.collisionGroups() >>> 16) & (G.GROUND | G.GNOME | G.COIN | G.PLAYER)) return;
      if (col.intersectsShape(shape, at, rot)) hit = true;
    });
    return hit;
  }

  // A widened belt has no room when its footprint reaches into the hole, or when the strip it gains on each side
  // (from oldHalfX out to the new box, slightly shrunk as the placement ghost) touches a fixed collider
  // (tool, wall, house) below the rail top. Loose things (crates, robots, props, gnomes, the player) never block,
  // and neither does anything lying on the rails.
  private overlaps(m: Machine, oldHalfX: number): boolean {
    const b = machineBox(m.type);
    const r = m.body.rotation();
    const q = tmpQ.set(r.x, r.y, r.z, r.w);
    if (footprintOverHole(tmpV.set(...b.center).applyQuaternion(q).add(m.pos), new THREE.Vector3(...b.half), q)) return true;
    const outX = b.half[0] * 0.92;
    if (outX <= oldHalfX) return false;
    // local y 0.02-0.68: from just above the belt's base to just under the rail top (0.70)
    const shape = new ctx.R.Cuboid((outX - oldHalfX) / 2, 0.33, b.half[2] * 0.92);
    // a pair test over every collider instead of the scene query: the query only knows colliders after the next
    // physics step, and restore() checks tools placed in the same frame (once per load or purchase, not per frame)
    let hit = false;
    for (const side of [-1, 1]) {
      const c = tmpV.set((side * (outX + oldHalfX)) / 2, 0.35, 0).applyQuaternion(q).add(m.pos);
      const at = { x: c.x, y: c.y, z: c.z };
      ctx.physics.colliders.forEach((col) => {
        const parent = col.parent();
        if (hit || parent?.handle === m.body.handle || (parent && !parent.isFixed()) || (col.collisionGroups() >>> 16) & (G.GNOME | G.COIN | G.PLAYER)) return;
        if (col.intersectsShape(shape, at, r)) hit = true;
      });
    }
    return hit;
  }

  // Wide Belt bought: every placed piece of `type` gets the new model and colliders on the same Machine and body
  // (blueprint undo, hole glides and fuse animations keep pointing at it); the model grows from its old width.
  // Pieces that now overlap something go back to the inventory; returns how many.
  rebuild(type: string): number {
    const { physics, scene } = ctx;
    const oldHalf = new Map<Machine, number>();
    // a piece the hole is swallowing keeps its old model: the shrink animation owns its scale and it leaves anyway
    const pieces = this.list.filter((x) => x.type === type && !ctx.hole.goingAway(x));
    for (const m of pieces) {
      const oldW = ((m.spin as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.width; // the belt surface
      oldHalf.set(m, oldW / 2 + 0.1); // its box half width, rails included (machineBox)
      scene.remove(m.root);
      const { root, spin } = machineVisual(type);
      root.getObjectByName('drop')?.removeFromParent();
      root.position.copy(m.pos);
      root.quaternion.copy(m.quat);
      root.scale.x = oldW / beltWidth();
      scene.add(root);
      m.root = root;
      m.spin = spin;
      m.fill = root.getObjectsByProperty('name', 'fill');
      const grp = moving(m) ? groups(G.PROP, 0xffff) : groups(G.STATIC, 0xffff);
      for (let i = m.body.numColliders() - 1; i >= 0; i--) {
        const col = m.body.collider(i);
        this.byCollider.delete(col.handle);
        physics.removeCollider(col, false);
      }
      for (const cd of colliderDescs(type)) this.byCollider.set(physics.createCollider(cd.setCollisionGroups(grp), m.body).handle, m);
    }
    // one piece at a time, so of two belts that overlap only one goes back; the query never changes bodies itself
    let back = 0;
    const b = machineBox(type);
    for (const m of pieces) {
      if (this.overlaps(m, oldHalf.get(m)!)) {
        this.remove(m);
        back++;
        continue;
      }
      // the player was standing where the belt grew
      ctx.player.pushOutOf(new THREE.Vector3(...b.center).applyQuaternion(m.quat).add(m.pos), new THREE.Vector3(...b.half), m.quat);
    }
    return back;
  }

  serialize(): PlacedMachine[] {
    return this.list.map((m) => {
      const p = m.type === 'box' ? m.body.translation() : m.pos;
      const q = m.type === 'box' ? m.body.rotation() : m.quat;
      return { type: m.type, x: p.x, y: p.y, z: p.z, yaw: m.yaw, tilt: m.tilt, qx: q.x, qy: q.y, qz: q.z, qw: q.w, ...(m.type === 'fan' ? { power: m.power } : {}) };
    });
  }

  // key N on a fan: 100 → 75 → 50 → 25 → 100 %
  cyclePower(m: Machine): void {
    m.power = FAN_POWERS[(FAN_POWERS.indexOf(m.power) + 1) % FAN_POWERS.length];
    ctx.fx.floatText(m.pos.clone().addScaledVector(this.up(m), 1.9), `${Math.round(m.power * 100)}%`, '#6ac0ff');
    ctx.audio.buy();
  }

  // the nearest working tool a saboteur at `pos` can reach: one hanging out of reach above or below is skipped
  nearestWorking(pos: THREE.Vector3): Machine | null {
    let best: Machine | null = null;
    let bd = 30;
    for (const m of this.list) {
      if (m.broken > 0 || m.type === 'box' || m.type === 'panel') continue;
      if (Math.abs(pos.y - boxBottom(m.type, m.pos, m.quat)) >= SABOTEUR_REACH) continue;
      const d = Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  breakMachine(m: Machine): void {
    const L = fuseCount(m);
    // a fuse takes the hit while any is green; the tool breaks on hit L + 1
    if (m.blown < L) {
      m.blown++;
      m.fuseAnim = { i: m.blown - 1, t: 0, kind: 'blow' };
      ctx.fx.burst(this.fuseWorldPos(m, m.blown - 1), 0xff4040, 10);
      ctx.audio.thud();
      ctx.hud.toast(`A saboteur blew a fuse on your ${UPGRADE_BY_ID[m.type].name} (${L - m.blown}/${L} left).`, 'bad');
      return;
    }
    m.broken = 30;
    ctx.hud.toast(`A saboteur broke your ${UPGRADE_BY_ID[m.type].name}! Look at it and press E to fix.`, 'bad');
    ctx.audio.thud();
  }

  // One E: a broken tool works again at once, and one blown fuse is swapped (PP 2026-10-20, Q1 a).
  repair(m: Machine): void {
    if (!needsRepair(m)) return;
    const L = fuseCount(m);
    const wasBroken = m.broken > 0;
    if (m.blown > 0) {
      m.blown--;
      m.fuseAnim = { i: m.blown, t: 0, kind: 'swap' };
      ctx.fx.burst(this.fuseWorldPos(m, m.blown), 0x3ddc5a, 8);
    }
    m.broken = 0;
    ctx.audio.buy();
    const name = UPGRADE_BY_ID[m.type].name;
    ctx.hud.toast(wasBroken ? `${name} repaired${L ? ` (${L - m.blown}/${L} fuses)` : ''}.` : `Fuse replaced (${L - m.blown}/${L}).`, 'good');
  }

  // Swap: dip (anticipation), the red fuse rises and shrinks out, a green one pops in with an overshoot.
  // Blow: an elastic punch in place. Derived from fuseAnim every frame, never accumulated.
  fusePose(m: Machine, i: number): { y: number; s: number } {
    const a = m.fuseAnim;
    if (!a || a.i !== i) return { y: 0, s: 1 };
    const t = a.t;
    if (a.kind === 'blow') return { y: 0, s: 1 + 0.35 * (1 - outElastic(Math.min(1, t / 0.3))) };
    if (t < 0.08) return { y: -0.02 * outCubic(t / 0.08), s: 1 };
    if (t < 0.2) return { y: (0.08 * (t - 0.08)) / 0.12, s: 1 - inQuad((t - 0.08) / 0.12) };
    return { y: 0, s: outBack(Math.min(1, (t - 0.2) / 0.15)) };
  }

  // the swapped fuse stays red until the old one has left (t 0.2 s), then the new one is green
  fuseColor(m: Machine, i: number): 'red' | 'green' {
    const a = m.fuseAnim;
    return i < m.blown || (a?.i === i && a.kind === 'swap' && a.t < 0.2) ? 'red' : 'green';
  }

  // tool pose x fuse box mount (FUSE_AT), with the tool's own scale so the box follows the placement pop;
  // a robot's box rides the station marker, which the blueprint pop scales too
  private fuseBase(m: Machine, out: THREE.Matrix4): THREE.Matrix4 {
    const o = m.marker ?? m.root;
    return out.compose(o.position, o.quaternion, o.scale).multiply(fuseLocal(m.type));
  }

  private fuseWorldPos(m: Machine, i: number): THREE.Vector3 {
    const L = fuseCount(m);
    return new THREE.Vector3((i - (L - 1) / 2) * FUSE_GAP, 0, FUSE_Z).applyMatrix4(this.fuseBase(m, tmpM));
  }

  // All fuses and boxes are two instanced meshes (2 draw calls), rewritten from state every frame.
  drawFuses(): void {
    let n = 0;
    let b = 0;
    for (const m of this.list) {
      const L = fuseCount(m);
      if (L <= 0 || b >= BOX_CAP || n + L > FUSE_CAP) continue;
      const base = this.fuseBase(m, tmpM);
      this.boxMesh.setMatrixAt(b++, base);
      m.fuseSlot = n;
      for (let i = 0; i < L; i++) {
        const pose = this.fusePose(m, i);
        tmpM2.makeTranslation((i - (L - 1) / 2) * FUSE_GAP, pose.y, FUSE_Z).scale(tmpV.setScalar(pose.s));
        this.fuseMesh.setMatrixAt(n, tmpM3.multiplyMatrices(base, tmpM2));
        this.fuseMesh.setColorAt(n, this.fuseColor(m, i) === 'red' ? FUSE_RED : FUSE_GREEN);
        n++;
      }
    }
    this.fuseMesh.count = n;
    this.boxMesh.count = b;
    this.fuseMesh.instanceMatrix.needsUpdate = true;
    this.boxMesh.instanceMatrix.needsUpdate = true;
    if (this.fuseMesh.instanceColor) this.fuseMesh.instanceColor.needsUpdate = true;
  }

  savePoses(): void {
    for (const m of this.list) if (moving(m)) savePose(m, m.body);
  }

  // Called by the game loop after the physics steps, with ctx.renderAlpha set.
  drawCrates(): void {
    for (const m of this.list) if (moving(m)) drawPose(m, m.body, m.root.position, m.root.quaternion);
  }

  update(dt: number): void {
    // robots the hole pushed out with no room for the pole: removed after the loop, not while it walks the list
    const noRoom: Machine[] = [];
    for (const m of this.list) {
      m.t += dt;
      if (m.type === 'box') {
        const p = m.body.translation();
        const q = m.body.rotation();
        m.pos.set(p.x, p.y, p.z);
        this.updateCrate(m, p, q);
        continue;
      }
      // fuses: a lower Fuses level drops slots, the blow / swap animation runs even while broken
      if (m.blown > fuseCount(m)) m.blown = fuseCount(m);
      if (m.fuseAnim) {
        m.fuseAnim.t += dt;
        if (m.fuseAnim.t >= (m.fuseAnim.kind === 'blow' ? 0.3 : 0.35)) m.fuseAnim = undefined;
      }
      // a belt widened by Wide Belt grows to its new width in about 0.25 s (animation rule 3)
      // (only x: a tool sinking into a new hole shrinks all three axes, hole.ts)
      if (m.root.scale.x !== 1 && m.root.scale.y === 1) m.root.scale.x = Math.abs(1 - m.root.scale.x) < 1e-3 ? 1 : THREE.MathUtils.damp(m.root.scale.x, 1, 12, dt);
      // Big Blades spin the blades faster, through the same damp (animation rule 7)
      const target = m.type === 'fan' ? SPIN_RATE.fan * fanPush() * m.power : SPIN_RATE[m.type];
      if (target !== undefined) {
        m.spinRate = THREE.MathUtils.damp(m.spinRate, m.broken > 0 ? 0 : target, SPIN_LAMBDA, dt);
        const axis = SPIN_AXIS[m.type];
        if (axis && m.spin) m.spin.rotation[axis] += m.spinRate * dt;
        if (m.type === 'conveyor') {
          // a growing offset moves the texture towards lower v, which is local +Z on the box top face
          const mat = (m.spin as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat.map) mat.map.offset.y = (mat.map.offset.y + (dt * m.spinRate * 0.13 * BELT_REPEAT) / BELT_LEN) % 1;
          for (const c of m.root.children) if (c.name === 'roller') c.rotation.x += m.spinRate * dt;
        }
      }
      // before the broken check: a broken robot's station also steps out of the hole and shows the red lamp
      if (m.robot) {
        if (!stepOutPost(m)) {
          noRoom.push(m);
          continue;
        }
        stationLamp(m);
      }
      if (m.broken > 0) {
        m.broken -= dt;
        m.smoke -= dt;
        if (m.type === 'robot') m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (m.smoke <= 0) {
          m.smoke = 0.15;
          ctx.fx.puff(m.pos.clone().setY(m.pos.y + 1.5), 0x333333);
        }
        continue;
      }
      this.effect(m, dt);
    }
    for (const m of noRoom) {
      ctx.fx.burst(m.pos.clone().setY(m.pos.y + 0.5), 0xffffff, 8);
      this.remove(m);
      ctx.hud.toast('The hole moved under one of your machines. It is back in your inventory.', 'info');
    }
  }

  // Crate: swallows gnomes that land inside, spills them when tipped over, empties into the hole.
  private updateCrate(m: Machine, p: RAPIER.Vector, q: RAPIER.Rotation): void {
    const rot = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    const upY = new THREE.Vector3(0, 1, 0).applyQuaternion(rot).y;
    const cap = crateCap();
    const respawn = (at: THREE.Vector3) => {
      if (ctx.player.held?.crate === m) ctx.player.held = null;
      m.body.setTranslation({ x: at.x, y: at.y + 1.5, z: at.z }, true);
      m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      m.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      m.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      savePose(m, m.body);
    };
    if (ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius + 0.3 && p.y < 1.3) {
      if (m.queue.length) {
        ctx.state.stats.crateDumps++;
        // a dump pays a flat bonus too, or one trick throw out-earned a whole crate (night plan F3)
        // empty the crate before eating: a level-up inside consume must not find the eaten gnomes in it
        const dumped = m.queue;
        m.queue = [];
        const bonus = 2 * dumped.length * ctx.hole.valueScale;
        // gnomes thrown into the crate are dumped, not thrown: no trick shot for them
        for (const g of dumped) {
          g.throwPos = null;
          g.bullseye = false;
          ctx.hole.consume(g, undefined, 'crate'); // full XP for a crate dump (PP 2026-10-24)
        }
        ctx.coins.burst(bonus, ctx.hole.holeOrigin, 1.5);
        // after the gnomes, so this is the big text the player reads (not a combo tier)
        ctx.hud.bigText(`CRATE DUMP x${dumped.length}!`, '#ffd23f', '+' + money(bonus));
      }
      respawn(m.home);
    } else if (p.y < -6 || !ctx.env.inside(p.x, p.z, -0.5)) {
      // kicked out of the yard: it comes back next to the shop PC
      const desk = ctx.env.deskPos;
      const toHole = new THREE.Vector3(-desk.x, 0, -desk.z).normalize();
      respawn(desk.clone().addScaledVector(toHole, 2.5).setY(0.5));
      ctx.hud.toast('Your crate flew out of the yard. It is back next to the shop PC.', 'info');
    } else if (upY < 0.3 && m.queue.length) {
      for (const g of m.queue) ctx.gnomes.release(g, new THREE.Vector3(p.x + rand(-0.5, 0.5), p.y + 0.5, p.z + rand(-0.5, 0.5)), new THREE.Vector3(rand(-3, 3), 3, rand(-3, 3)));
      m.queue = [];
      ctx.audio.thud();
    } else if (upY > 0.6 && m.queue.length < cap) {
      const inv = rot.clone().invert();
      const centre = new THREE.Vector3(p.x, p.y, p.z);
      ctx.gnomes.forEachNear(centre, 1.6, (g, _d, gp) => {
        if (m.queue.length >= cap || g.type.id === 'king' || !isFree(g)) return;
        const local = tmpV.set(gp.x - p.x, gp.y - p.y, gp.z - p.z).applyQuaternion(inv);
        // generous catch zone above the rim: a gnome falling in counts before it can bounce off a wall
        if (Math.abs(local.x) < 0.75 && Math.abs(local.z) < 0.75 && local.y > -0.45 && local.y < 1.2) {
          ctx.gnomes.stash(g);
          m.queue.push(g);
          ctx.state.stats.crated++;
          ctx.audio.thud();
          if (m.queue.length === cap) ctx.fx.floatText(new THREE.Vector3(p.x, p.y + 1.2, p.z), 'Crate full!', '#3adf6a');
        }
      });
    }
    const shown = Math.round((m.queue.length / cap) * m.fill.length);
    for (let i = 0; i < m.fill.length; i++) m.fill[i].visible = i < shown;
  }

  // local axes in world space: machines can be rotated any way the player likes
  private forward(m: Machine): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(m.quat);
  }

  private up(m: Machine): THREE.Vector3 {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(m.quat);
  }

  // a world point in the machine's own frame
  private local(m: Machine, p: RAPIER.Vector): THREE.Vector3 {
    return tmpV.set(p.x - m.pos.x, p.y - m.pos.y, p.z - m.pos.z).applyQuaternion(m.quat.clone().invert());
  }

  // the turning part (cannon barrel, funnel outlet) turns towards the hole along the shortest way
  private aimAtHole(m: Machine, dt: number): void {
    const s = m.spin!;
    const turn = Math.atan2(ctx.env.hole.x - m.pos.x, ctx.env.hole.z - m.pos.z) - m.yaw - s.rotation.y;
    s.rotation.y = THREE.MathUtils.damp(s.rotation.y, s.rotation.y + Math.atan2(Math.sin(turn), Math.cos(turn)), 6, dt);
  }

  // the next waiting gnome leaves the muzzle on an arc that lands in the hole (cannon, funnel)
  // playerFed (funnel): a gnome the player threw or dropped in pays full XP (PP 2026-10-21, F3 b) but no trick shot:
  // the drop point is the mouth, so LONG / SNIPER / AIR would be free on every shot (review round)
  // floor (funnel): the gnome leaves at least 0.6 m above the tool's base, never inside the ground
  private launch(m: Machine, muzzle: THREE.Vector3, playerFed = false, floor?: number): void {
    const g = m.queue.shift()!;
    const full = playerFed && g.thrownBy === 'player';
    if (floor !== undefined) muzzle.y = Math.max(muzzle.y, floor + Math.max(0.6, 0.5 * g.scale));
    const to = ctx.env.hole.clone().sub(muzzle);
    const T = Math.max(0.9, to.length() / 14);
    // the body's linear damping c: v' = -gravity - c v, so x(T) = v0 (1 - e^-cT) / c and
    // y(T) = (v0 + gravity / c)(1 - e^-cT) / c - gravity T / c; solved for v0 the arc lands in the hole at any range
    const c = GNOME_DAMPING;
    const k = c / (1 - Math.exp(-c * T));
    const vel = new THREE.Vector3(to.x * k, (to.y + (GRAVITY * T) / c) * k - GRAVITY / c, to.z * k);
    ctx.gnomes.release(g, muzzle, vel);
    g.fullXp = full;
    ctx.fx.puff(muzzle, 0xdddddd);
    ctx.fx.shake(0.05);
  }

  private effect(m: Machine, dt: number): void {
    const gn = ctx.gnomes;
    const fwd = this.forward(m);
    switch (m.type) {
      case 'robot':
        updateRobot(m, dt);
        break;
      case 'trampoline':
      {
        // the pad pushes along its own normal, so a tilted trampoline launches sideways
        const up = this.up(m);
        gn.forEachNear(m.pos, 1.8, (g, _d, p) => {
          const l = this.local(m, p);
          if (l.y > 1.4 || l.y < -0.3 || Math.hypot(l.x, l.z) > 1.05) return;
          const v = g.body.linvel();
          if (v.x * up.x + v.y * up.y + v.z * up.z > 4) return;
          // a player throw that bounces here stays the player's shot and earns TRICK x3
          const byPlayer = g.thrownBy === 'player' && !!g.throwPos;
          gn.ragdoll(g, 2.5, byPlayer ? 'player' : 'machine');
          if (byPlayer) g.bounced = true;
          // weak on the Backyard, stronger with every Land (PP 2026-10-20): x0.6, 0.75, 0.94, 1.17
          const k = 0.6 * Math.pow(1.25, ctx.state.land);
          g.body.setLinvel({ x: (up.x * 13 + fwd.x * 6.5) * k, y: (up.y * 13 + fwd.y * 6.5) * k, z: (up.z * 13 + fwd.z * 6.5) * k }, true);
          ctx.audio.boing();
        });
        break;
      }
      case 'fan': {
        const origin = m.pos.clone().addScaledVector(this.up(m), 1.4);
        // Big Blades scale only the push along the axis: the lift stays 0.35 x 55 (under gravity 20), so a level fan
        // still tumbles gnomes instead of making them hover
        const k = fanPush();
        // a gentle push along the fan's own axis (a fan aimed upwards lifts gnomes)
        gn.forEachNear(origin, FAN_RANGE, (g, d, p) => {
          tmpV.set(p.x - origin.x, p.y - origin.y, p.z - origin.z);
          const len = tmpV.length() || 1;
          if (tmpV.dot(fwd) / len < 0.8) return;
          // weight does not matter to the fan (PP 2026-10-19): same acceleration for every gnome.
          // 55 m/s² near the fan easily beats grass friction (0.7 x gravity 20); a little lift makes them tumble along.
          // Doubled after playtest (PP: "fany niech działają mocniej, bo teraz niewiele dają").
          // the fan's own power (key N) scales the whole push, lift included: never more lift than at 100 %
          const strength = 55 * m.power * (1 - d / FAN_RANGE) * g.body.mass();
          if (g.state === 'walk' || g.state === 'statue') {
            // a tripped gnome rolls out to about 9.9 m; tripping it again there would pin it as a ragdoll for ever
            // (a weaker fan trips only as far as its push still moves a gnome)
            if (d > FAN_TRIP * m.power) return;
            gn.ragdoll(g, 2, 'machine');
          }
          g.body.applyImpulse({ x: fwd.x * k * strength * dt, y: (fwd.y * k + 0.35) * strength * dt, z: fwd.z * k * strength * dt }, true);
        });
        if (Math.random() < dt * 8 * m.power) ctx.fx.wind(origin.clone().addScaledVector(fwd, 0.5), fwd, k * m.power);
        break;
      }
      case 'conveyor': {
        // works at any angle: a tilted belt is a ramp
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(m.quat);
        const up = this.up(m);
        const hw = beltWidth() / 2;
        // the scan covers the box between the rails (2.4 m at the 1.3 m belt)
        gn.forEachNear(m.pos, Math.max(2.4, Math.hypot(1.6, hw + 0.05, 1.65)), (g, _d, p) => {
          const l = this.local(m, p);
          // between the rails, along the belt, up to ~1.3 m above its surface (0.35)
          if (Math.abs(l.z) > 1.6 || Math.abs(l.x) > hw + 0.05 || l.y < 0.1 || l.y > 1.65) return;
          const lx = l.x;
          const toss = l.z > 1.3;
          if (g.state === 'walk' || g.state === 'statue') gn.ragdoll(g, 1.5, 'machine');
          const v = g.body.linvel();
          if (toss) {
            // the end of the belt flings the gnome forward; a player throw keeps its trick bonus
            if (!(g.thrownBy === 'player' && g.throwPos)) g.thrownBy = 'machine';
            g.timer = Math.max(g.timer, 1.5);
            g.body.setLinvel({ x: fwd.x * 6 + up.x * 3, y: fwd.y * 6 + up.y * 3, z: fwd.z * 6 + up.z * 3 }, true);
            return;
          }
          // along the belt, gently back to the middle, keep falling onto the belt but never lift off it
          const vn = Math.min(0, v.x * up.x + v.y * up.y + v.z * up.z);
          const c = -lx * 2 * (0.65 / hw); // weaker on a wide belt, so gnomes ride side by side
          g.body.setLinvel({ x: fwd.x * BELT_SPEED + right.x * c + up.x * vn, y: fwd.y * BELT_SPEED + right.y * c + up.y * vn, z: fwd.z * BELT_SPEED + right.z * c + up.z * vn }, true);
          g.timer = Math.max(g.timer, 0.8);
        });
        break;
      }
      case 'wheel': {
        if (m.t > 0.45) {
          m.t = 0;
          const up = this.up(m);
          const front = m.pos.clone().addScaledVector(fwd, 1.1).addScaledVector(up, 0.5);
          gn.forEachNear(front, 1.5, (g) => {
            gn.ragdoll(g, 3, 'machine');
            // 20 m/s at the same 28°, about 18 m: the long-range tool before the cannon (night balance F11)
            g.body.setLinvel({ x: fwd.x * 17.6 + up.x * 9.5, y: fwd.y * 17.6 + up.y * 9.5, z: fwd.z * 17.6 + up.z * 9.5 }, true);
            ctx.audio.kick();
          });
        }
        break;
      }
      case 'magnet': {
        // pull towards the point under the head, never up to it: gnomes drop off the head's vertical line
        // (into the hole when the arm hangs over it, into a heap otherwise)
        const head = tmpV2.copy(MAGNET_HEAD).applyQuaternion(m.quat).add(m.pos);
        gn.forEachNear(head, MAGNET_RANGE, (g, _d, p) => {
          const dx = head.x - p.x;
          const dz = head.z - p.z;
          const h = Math.hypot(dx, dz);
          if (h < MAGNET_STOP) return;
          if (g.state === 'walk' || g.state === 'statue') gn.ragdoll(g, 2, 'machine');
          g.timer = Math.max(g.timer, 1);
          // same acceleration for every gnome, like the fan
          const k = g.body.mass() * dt;
          const lift = p.y < m.pos.y + 0.6 * g.scale ? MAGNET_LIFT : 0;
          g.body.applyImpulse({ x: (dx / h) * MAGNET_PULL * k, y: lift * k, z: (dz / h) * MAGNET_PULL * k }, true);
        });
        break;
      }
      case 'cannon': {
        const barrel = m.spin!;
        this.aimAtHole(m, dt);
        const intake = m.pos.clone().setY(m.pos.y + 0.6);
        gn.forEachNear(intake, 5, (g, d, p) => {
          if (d < 1.7 && m.queue.length < 20) {
            gn.stash(g);
            m.queue.push(g);
            return;
          }
          const pull = 6 * g.type.mass * dt;
          tmpV.set(intake.x - p.x, 0, intake.z - p.z).normalize();
          g.body.applyImpulse({ x: tmpV.x * pull, y: 0, z: tmpV.z * pull }, true);
        });
        if (m.queue.length && m.t > 0.35) {
          m.t = 0;
          this.launch(m, m.pos.clone().setY(m.pos.y + 2.4));
          ctx.audio.kick();
        }
        // recoil: the shot frame shows the barrel fully back, then it springs forward along its axis
        const recoil = -CANNON_RECOIL * (1 - outElastic(Math.min(1, m.t / RECOIL_TIME)));
        barrel.children[0].position.set(0, recoil * Math.cos(BARREL_TILT), recoil * Math.sin(BARREL_TILT));
        break;
      }
      case 'funnel': {
        const out = m.spin!;
        this.aimAtHole(m, dt);
        const up = this.up(m);
        const mouthAt = m.pos.clone().addScaledVector(up, (FUNNEL_MOUTH.y0 + FUNNEL_MOUTH.y1) / 2);
        // only what falls or flies into the cone: no pull, walking gnomes under it stay free
        gn.forEachNear(mouthAt, 1.8, (g, _d, p) => {
          if (m.queue.length >= FUNNEL_CAP || g.type.id === 'king') return;
          const l = this.local(m, p);
          if (Math.hypot(l.x, l.z) > FUNNEL_MOUTH.r || l.y < FUNNEL_MOUTH.y0 || l.y > FUNNEL_MOUTH.y1) return;
          gn.stash(g);
          m.queue.push(g);
          m.gulp = 0;
          ctx.fx.burst(new THREE.Vector3(p.x, p.y, p.z), 0xff8a2a, 8);
          ctx.audio.slurp();
        });
        // the mouth widens and flattens on a gulp, then springs back (volume kept: sy = 1 / sxz²)
        const mouth = m.root.getObjectByName('mouth');
        if (m.gulp !== undefined && mouth) {
          m.gulp += dt;
          const k = Math.min(1, m.gulp / FUNNEL_GULP);
          const sxz = 1 + 0.2 * (1 - outElastic(k));
          mouth.scale.set(sxz, 1 / (sxz * sxz), sxz);
          if (k >= 1) m.gulp = undefined;
        }
        // shot: the outlet pulls back into the elbow (anticipation), the gnome leaves on the frame it is fully back,
        // then the pipe springs out past its rest and settles (follow-through)
        if (m.windup === undefined && m.queue.length && m.t > FUNNEL_RATE - FUNNEL_WINDUP) m.windup = 0;
        if (m.windup !== undefined) {
          m.windup += dt;
          if (m.windup >= FUNNEL_WINDUP) {
            m.windup = undefined;
            m.t = 0;
            if (m.queue.length) {
              const dir = tmpV2.set(0, -Math.sin(FUNNEL_DROP), Math.cos(FUNNEL_DROP)).applyAxisAngle(UP, out.rotation.y).applyQuaternion(m.quat);
              this.launch(m, m.pos.clone().addScaledVector(up, 0.5).addScaledVector(dir, 1.3), true, boxBottom(m.type, m.pos, m.quat));
              ctx.audio.whoosh();
            }
          }
        }
        const recoil = m.windup !== undefined ? -FUNNEL_RECOIL * inQuad(Math.min(1, m.windup / FUNNEL_WINDUP)) : -FUNNEL_RECOIL * (1 - outElastic(Math.min(1, m.t / RECOIL_TIME)));
        out.children[0].position.set(0, -recoil * Math.sin(FUNNEL_DROP), recoil * Math.cos(FUNNEL_DROP));
        break;
      }
      case 'vacuum':
      case 'blackhole': {
        const centre = m.pos.clone().setY(m.pos.y + (m.type === 'vacuum' ? 1 : 1.4));
        const range = m.type === 'vacuum' ? 11 : 8;
        gn.forEachNear(centre, range, (g, d, p) => {
          if (g.type.id === 'king' && m.type === 'vacuum') return;
          if (d < 1.7 && m.t > (m.type === 'vacuum' ? 0.2 : 0.08)) {
            m.t = 0;
            ctx.fx.burst(new THREE.Vector3(p.x, p.y, p.z), m.type === 'vacuum' ? 0x6ae0ff : 0xb07aff, 10);
            ctx.hole.consume(g, m.type === 'blackhole' ? centre : undefined, true);
            return;
          }
          tmpV.set(centre.x - p.x, centre.y - p.y, centre.z - p.z).normalize();
          if (g.state === 'walk' || g.state === 'statue') gn.ragdoll(g, 2, 'machine');
          g.timer = Math.max(g.timer, 1);
          const pull = (m.type === 'vacuum' ? 16 : 24) * g.type.mass * dt;
          g.body.applyImpulse({ x: tmpV.x * pull, y: tmpV.y * pull + 6 * g.type.mass * dt, z: tmpV.z * pull }, true);
        });
        break;
      }
    }
  }
}
