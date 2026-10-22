import * as THREE from 'three';
import { ctx, G, groups, lvl, savePose } from '../core/context';
import { inQuad, outBack, outCubic } from '../core/ease';
import { robotBedGeometry, robotGeometry, robotStationGeometry, vcMat } from '../world/models';
import { isFree, type Gnome } from './gnomes';
import { boxBottom, machineBox, needsRepair, type Machine } from './machines';
import { glowTexture } from './mushrooms';

// Cleaning robot: a little truck that drives to free gnomes around its station, scoops them onto its bed
// (stashed, shown as hats), drives to the hole, tips the load in and drives back. It plans a way round placed
// tools on a coarse grid of the whole yard, shared by all trucks and rebuilt only when the tools, the factory or the
// hole change (the hole and each post get a distance field, a gnome an A* search), never comes closer to the hole than HOLE_GAP, backs
// off and sidesteps when something it cannot see (a prop, another truck) blocks it.
export type RobotState = 'idle' | 'seek' | 'pick' | 'drive' | 'tip' | 'return';

interface Grid { x0: number; z0: number; nx: number; nz: number; cells: Uint8Array } // cells: 1 = blocked

export interface Robot {
  state: RobotState;
  yaw: number; // heading of the truck's +z
  speed: number; // ground speed set this frame, m/s
  wp: THREE.Vector3 | null; // where it drives this frame
  targetGnome: Gnome | null;
  detour: THREE.Vector3 | null;
  detourT: number;
  detours: number; // detours caused by the current target
  skip: Set<Gnome>; // targets given up for this trip
  scan: number; // seconds to the next look for gnomes
  lonely: number; // seconds with cargo and nothing to pick
  stuckT: number;
  lastPos: THREE.Vector3;
  grid: Grid | null; // tools and the hole around the truck and its goal, from the last plan
  path: THREE.Vector3[]; // cell centres to the goal; empty = straight there
  reached: boolean; // the plan gets to the goal (false: it ends as close as the tools allow)
  plan: number; // seconds to the next plan
  planKey: unknown; // what the plan was made for (the target gnome, 'drive', 'return')
  backT: number; // seconds left backing away after getting stuck
  best: number; // closest the truck has been to its goal
  noGain: number; // seconds without getting 0.5 m closer than best
  anim: number; // seconds into the pick or the tip
  stashed: boolean; // the pick's contact frame has happened
  bed: THREE.Object3D;
  areaRing: THREE.Object3D;
  lamp: THREE.Sprite; // on the station pole: green working, red needs E
}

const HATS = 6;
const SCOOP = 0.9; // scoop point ahead of the truck centre
const REACH = 1.1;
const HOLE_GAP = 1.0; // the truck never gets closer than this to the hole edge
const ARRIVE_HOLE = 1.3;
const ARRIVE_HOME = 0.6;
const PARK = 0.15; // m from the station centre: parked (then it turns to face the pad)
const PARK_SLOW = 1.5; // 1/s: the last metres home the speed falls with the distance, so it rolls in without a jolt
// the pole stands 1.2 m from the post; the step-out keeps it out of the rim whichever way the station faces
const STATION_REACH = 1.3;
const STATION_SPACE = 3.3; // m between two station centres: the 2 x 2.6 m pads never overlap, at any heading
const POLE_R = 0.26; // the pole's 0.4 x 0.32 m box seen from above, as a circle
const TURN_LIMIT = 1.2; // above this heading error it turns in place
const LONELY = 4;
const STUCK_T = 1.5;
const STUCK_D = 0.3;
const DETOUR = 3;
const PLAYER_GAP = 2.5;
const BACK_T = 0.6;
const GIVE_UP = 8; // seconds without progress: a target gnome is dropped for this trip
const RESCUE = 15; // seconds without progress driving or returning: back to the post with a puff
// planning grid: tool footprints grow by CLEAR, so only gaps wider than 2 x CLEAR (the truck is 1.1 m wide) stay open
const CELL = 0.5;
const CLEAR = 0.7;
const REPLAN = 0.5;
const LOOK = 12; // path nodes ahead tried for a straight line
const ESCAPE = 0.8; // cells this close to the truck are free, so a truck already near a tool can leave
const SEEK_NEAR = 1.8; // within this of a gnome the scoop takes over (scoop point 0.9 ahead + reach 1.1)
const HOME_NEAR = 1.0;
// pick swing and tip phases, seconds; the bed is hinged at its front edge
const PICK_DIP = 0.05;
const PICK_HIT = 0.15;
const PICK_TIME = 0.35;
const TIP_DIP = 0.05;
const TIP_RISE = 0.3;
const TIP_BACK = 0.4;
const TIP_ANGLE = 1.05;
const UP = new THREE.Vector3(0, 1, 0);
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const gridV = new THREE.Vector3();
const gridQ = new THREE.Quaternion();
const hatGeo = new THREE.ConeGeometry(0.13, 0.32, 16);
const hatMats = [new THREE.MeshStandardMaterial({ color: 0xd8352a }), new THREE.MeshStandardMaterial({ color: 0x2f6fd0 })];

export const robotCap = (): number => 5 + 3 * lvl('robotBed');
export const robotSpeed = (): number => 2.5 + 0.6 * lvl('robotSpeed');
export const robotArea = (): number => 6 + 2 * lvl('robotArea');

// Truck with its bed (hats inside show the load); the area ring is a placement hint only.
export function robotVisual(): { root: THREE.Group; bed: THREE.Object3D } {
  const root = new THREE.Group();
  const mat = vcMat();
  const truck = new THREE.Mesh(robotGeometry(), mat);
  const bed = new THREE.Mesh(robotBedGeometry(), mat);
  bed.name = 'bed';
  bed.position.set(0, 0.32, 0.85);
  for (const m of [truck, bed]) m.castShadow = m.receiveShadow = true;
  for (let i = 0; i < HATS; i++) {
    const hat = new THREE.Mesh(hatGeo, hatMats[i % 2]);
    hat.position.set(((i % 3) - 1) * 0.3, 0.2, -0.3 - Math.floor(i / 3) * 0.4);
    hat.visible = false;
    hat.name = 'fill';
    bed.add(hat);
  }
  const area = robotArea();
  const ring = new THREE.Mesh(new THREE.RingGeometry(area - 0.08, area, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffcc33 }));
  ring.name = 'drop';
  ring.position.y = 0.05;
  // the station (pad, pole with the fuse box, lamp); initRobot moves it onto the marker, the ghost shows it as is
  const station = new THREE.Group();
  station.name = 'station';
  const pad = new THREE.Mesh(robotStationGeometry(), mat);
  pad.receiveShadow = true;
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x2bd44a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  lamp.name = 'lamp';
  lamp.scale.setScalar(0.35);
  lamp.position.set(0, 1.82, -1.2);
  station.add(pad, lamp);
  root.add(truck, bed, ring, station);
  return { root, bed };
}

// Called by Machines.place: state, the station with its area ring, an upright body.
export function initRobot(m: Machine): void {
  // a post placed from the air (far G move, no surface under the crosshair) lands on the ground or on the tool
  // under it; old saves with a hovering y get grounded here too (not on another station's pad sensor)
  const from = { x: m.pos.x, y: m.pos.y + 0.3, z: m.pos.z };
  const hit = ctx.physics.castRay(new ctx.R.Ray(from, { x: 0, y: -1, z: 0 }), 30, true, ctx.R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, m.body,
    (col) => ((col.collisionGroups() >>> 16) & (G.GROUND | G.STATIC)) !== 0);
  if (hit) {
    m.pos.y = from.y - hit.timeOfImpact;
    m.body.setTranslation({ x: m.pos.x, y: m.pos.y + 0.02, z: m.pos.z }, true);
  }
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(m.quat);
  const yaw = Math.atan2(fwd.x, fwd.z);
  tmpQ.setFromAxisAngle(UP, yaw);
  const marker = new THREE.Group();
  marker.add(m.root.getObjectByName('station')!); // add() reparents it out of the truck
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2fa8b8, transparent: true, opacity: 0.35, depthWrite: false }));
  ring.position.y = 0.04;
  ring.scale.setScalar(robotArea());
  marker.add(ring);
  marker.position.copy(m.pos);
  marker.rotation.y = yaw;
  ctx.scene.add(marker);
  m.marker = marker;
  // the station body: a solid pole and a sensor pad, both in byCollider so E/G/X work when aiming at them.
  // The sensor pad: the placement ghost and the look ray see it (nothing is built on the pad); the character
  // controller skips sensors, so the player walks across. The pole stops the player because the controller stops
  // at every non-sensor collider; the PLAYER filter keeps trucks, gnomes, coins and props out of both.
  m.station = ctx.physics.createRigidBody(ctx.R.RigidBodyDesc.fixed().setTranslation(m.pos.x, m.pos.y, m.pos.z).setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }));
  const grp = groups(G.STATIC, G.PLAYER);
  ctx.machines.byCollider.set(ctx.physics.createCollider(ctx.R.ColliderDesc.cuboid(0.2, 0.8, 0.16).setTranslation(0, 0.8, -1.16).setCollisionGroups(grp), m.station).handle, m);
  // 0.3 m tall: the placement ghost box is shrunk by 8 %, so a 3 cm pad would slip under a tall tool's box
  ctx.machines.byCollider.set(ctx.physics.createCollider(ctx.R.ColliderDesc.cuboid(1.0, 0.15, 1.3).setTranslation(0, 0.15, 0).setSensor(true).setCollisionGroups(grp), m.station).handle, m);
  m.body.setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }, true);
  // same outer size as the cuboid from Machines.place, with rounded edges: a sharp bottom edge catches on the
  // seam between two ground slabs (z = hole ± 0.7 r) and the truck stops dead there
  m.body.collider(0).setShape(new ctx.R.RoundCuboid(0.45, 0.2, 0.7, 0.1));
  savePose(m, m.body);
  m.robot = {
    state: 'idle', yaw, speed: 0, wp: null, targetGnome: null, detour: null, detourT: 0, detours: 0, skip: new Set(),
    scan: 0, lonely: 0, stuckT: 0, lastPos: m.pos.clone(), anim: 0, stashed: false, bed: m.spin!, areaRing: ring,
    lamp: marker.getObjectByName('lamp') as THREE.Sprite,
    grid: null, path: [], reached: true, plan: 0, planKey: null, backT: 0, best: Infinity, noGain: 0,
  };
}

// The hole grew or moved over the post (level-ups leave robots alone): the post, the station and its ring step out
// to where the truck can reach them. Runs every frame, also while the robot is broken.
// The pole must not land in a tool, the fence or the house (poleBlocked, the same test as a load): the post tries
// other spots at the same distance from the hole, 0.25 rad apart. Returns false when none has room: the caller
// sends the robot back to the inventory.
export function stepOutPost(m: Machine): boolean {
  const env = ctx.env;
  const home = m.pos;
  const hh = env.holeDist(home.x, home.z);
  const keep = env.holeRadius + HOLE_GAP + ARRIVE_HOME + STATION_REACH;
  if (hh < keep) {
    const a = hh > 1e-3 ? Math.atan2(home.z - env.hole.z, home.x - env.hole.x) : 0;
    if (!aroundHole(m, env.hole, keep, a)) return false;
  }
  // the body follows once the player is 0.8 m clear of the new pole: the character controller cannot walk out of a
  // pole that appears inside it towards its far side (A7, plan R7)
  const st = m.station!.translation();
  if (hdist(st, home) > 1e-3 || Math.abs(st.y - home.y) > 1e-3) {
    const yaw = m.marker!.rotation.y;
    const pole = { x: home.x - Math.sin(yaw) * 1.2, z: home.z - Math.cos(yaw) * 1.2 };
    if (hdist(ctx.player.position, pole) > 0.8) m.station!.setTranslation({ x: home.x, y: home.y, z: home.z }, true);
  }
  m.marker!.position.copy(home);
  m.robot!.areaRing.scale.setScalar(robotArea());
  return true;
}

// Puts the post `keep` from c, trying angles from a outwards, 0.25 rad apart; false when the pole has room nowhere.
function aroundHole(m: Machine, c: THREE.Vector3, keep: number, a: number): boolean {
  const y = Math.max(0, m.pos.y);
  for (let k = 0; k <= 24; k++) {
    const b = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25;
    m.pos.set(c.x + Math.cos(b) * keep, y, c.z + Math.sin(b) * keep);
    if (!ctx.machines.poleBlocked(m)) return true;
  }
  return false;
}

// A Land slide (Environment.rebuildLand) sweeps the hole from `from` to `to` faster than a truck drives, and
// stepOutPost would only push a post on the path ahead of it. A post the hole passes on its way (ahead of the old
// spot: the hole keeps the old radius until it arrives, then has the new one) goes `keep` beside the new spot,
// across the path, own side first, then the other side, then further around the new rim on both sides (beside, not
// behind: the hole sweeps the ground behind it, as Hole.moveCrateHomes). It stands on the ground there, and at least
// STATION_SPACE from every other post: the pole bodies follow only next frame (stepOutPost), so poleBlocked does not
// see a post moved earlier in this loop. The pole also keeps off the spots the carried tools glide to (`glides`,
// Hole.glideTargets): poleBlocked sees those tools where they stand now. A truck on the path goes to its post with a
// puff (toPost). No room anywhere: the post stays and stepOutPost decides during the slide.
export function clearSlide(from: THREE.Vector3, to: THREE.Vector3, oldR: number, newR: number, glides: readonly { m: Machine; to: THREE.Vector3 }[]): void {
  const mx = to.x - from.x;
  const mz = to.z - from.z;
  const len = Math.hypot(mx, mz);
  if (len < 0.01) return;
  const sx = -mz / len;
  const sz = mx / len;
  const band = HOLE_GAP + ARRIVE_HOME + STATION_REACH;
  const keep = newR + band;
  // (x, z) is ahead of the old spot and within `extra` of the hole somewhere on its way
  const onPath = (x: number, z: number, extra: number) => {
    const t = ((x - from.x) * mx + (z - from.z) * mz) / (len * len);
    if (t <= 0) return false;
    const c = Math.min(t, 1);
    return Math.hypot(x - from.x - mx * c, z - from.z - mz * c) < oldR + extra || Math.hypot(x - to.x, z - to.z) < newR + extra;
  };
  for (const m of ctx.machines.list) {
    if (!m.robot) continue;
    if (onPath(m.pos.x, m.pos.z, band)) {
      const old = m.pos.clone();
      const a = Math.atan2(sz, sx) + ((m.pos.x - to.x) * sx + (m.pos.z - to.z) * sz < 0 ? Math.PI : 0);
      const yaw = m.marker!.rotation.y;
      // the pole stands 1.2 m behind the post; a tool gliding in above its top (1.6 m) is no obstacle
      const offGlides = () => glides.every((gl) => {
        const half = machineBox(gl.m.type)?.half ?? [1, 1, 1];
        return boxBottom(gl.m.type, gl.to, gl.m.quat) > 1.6
          || Math.hypot(gl.to.x - (m.pos.x - Math.sin(yaw) * 1.2), gl.to.z - (m.pos.z - Math.cos(yaw) * 1.2)) >= Math.hypot(half[0], half[2]) + POLE_R;
      });
      const free = () => ctx.env.inside(m.pos.x, m.pos.z, 1) && !ctx.machines.poleBlocked(m) && offGlides()
        && ctx.machines.list.every((o) => o === m || !o.robot || Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z) >= STATION_SPACE);
      let room = false;
      for (let k = 0; k <= 14 && !room; k++) {
        for (const base of [a, a + Math.PI]) {
          const b = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25;
          m.pos.set(to.x + Math.cos(b) * keep, 0, to.z + Math.sin(b) * keep);
          if ((room = free())) break;
        }
      }
      if (!room) m.pos.copy(old);
    }
    const t = m.body.translation();
    if (onPath(t.x, t.z, HOLE_GAP + 0.6)) toPost(m);
  }
}

export function stationLamp(m: Machine): void {
  m.robot!.lamp.material.color.setHex(needsRepair(m) ? 0xff3b3b : 0x2bd44a);
}

const hdist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function updateRobot(m: Machine, dt: number): void {
  const r = m.robot!;
  const body = m.body;
  const t = body.translation();
  const p = tmpP.set(t.x, t.y, t.z);
  const env = ctx.env;
  const cap = robotCap();
  const area = robotArea();
  // m.pos is the station centre, where the truck parks (saved; stepOutPost moves it out of the hole)
  const home = m.pos;

  // fell into the hole or left the yard: back at the station with its cargo
  if (t.y < -1 || !env.inside(t.x, t.z, -0.5)) return toPost(m);

  // the target is gone (eaten, held, stashed elsewhere), walked out of the area or left the ground (it is picked
  // again by a scan once it lies on the ground; chasing it in the air makes the truck circle under it)
  let tg = r.targetGnome;
  // (isFree first: a gone gnome's body is freed)
  if (tg && (!isFree(tg) || r.skip.has(tg) || hdist(tg.body.translation(), home) > area + 0.5 || !onGround(tg, tg.body.translation()))) {
    tg = r.targetGnome = null;
  }
  if (r.state === 'seek' && !tg) {
    r.state = 'return';
    r.scan = 0;
  }
  // a truck after a harmless gnome keeps looking out for dangerous ones and switches to them
  const guarding = r.state === 'seek' && danger(tg!) > 0;
  if ((r.state === 'idle' || r.state === 'return' || guarding) && m.queue.length < cap) {
    r.scan -= dt;
    if (r.scan <= 0) {
      r.scan = 0.5;
      const found = findGnome(m, p, area);
      if (found && found !== tg && (!guarding || danger(found) < danger(tg!))) {
        tg = r.targetGnome = found;
        r.state = 'seek';
        r.detours = 0;
      }
    }
  }
  // an idle truck off its spot (pushed, repaired where it broke, the post moved by a level-up) parks again
  if (r.state === 'idle' && hdist(p, home) > ARRIVE_HOME) r.state = 'return';
  // a partial load goes to the hole when nothing was found for a while
  if (m.queue.length && (r.state === 'idle' || r.state === 'return')) {
    r.lonely += dt;
    if (r.lonely >= LONELY) r.state = 'drive';
  } else r.lonely = 0;

  const fwd = new THREE.Vector3(Math.sin(r.yaw), 0, Math.cos(r.yaw));
  let wp: THREE.Vector3 | null = null;
  let near = SEEK_NEAR; // how close the plan has to get to wp
  switch (r.state) {
    case 'seek': {
      const gp = tg!.body.translation();
      const sx = p.x + fwd.x * SCOOP;
      const sz = p.z + fwd.z * SCOOP;
      if (Math.hypot(gp.x - sx, gp.z - sz) < REACH && gp.y > p.y - 0.1 && gp.y < p.y + 1.3) {
        r.state = 'pick';
        r.anim = 0;
        r.stashed = false;
      } else wp = new THREE.Vector3(gp.x, 0, gp.z);
      break;
    }
    case 'drive':
      if (env.holeDist(p.x, p.z) <= env.holeRadius + ARRIVE_HOLE) {
        // face the hole, then tip
        const diff = wrap(Math.atan2(env.hole.x - p.x, env.hole.z - p.z) - r.yaw);
        r.yaw = THREE.MathUtils.damp(r.yaw, r.yaw + diff, 6, dt);
        if (Math.abs(diff) < 0.2) {
          r.state = 'tip';
          r.anim = 0;
        }
      } else {
        wp = env.hole.clone();
        near = env.holeRadius + ARRIVE_HOLE + 0.4;
      }
      break;
    case 'return':
      if (hdist(p, home) < PARK) {
        r.state = 'idle';
        r.skip.clear();
      } else {
        wp = home.clone();
        near = HOME_NEAR;
      }
      break;
    case 'idle':
      // parked beside the pole: face the pad's direction (the pole behind the truck)
      r.yaw = THREE.MathUtils.damp(r.yaw, r.yaw + wrap(m.marker!.rotation.y - r.yaw), 6, dt);
      break;
    case 'pick':
      pick(m, r, dt);
      break;
    case 'tip':
      tip(m, r, dt);
      break;
  }

  const goal = wp;
  if (wp) {
    // the way round placed tools
    wp = route(r, p, wp, near, tg ?? r.state, dt);
    // a gnome the plan cannot get to, or did not get closer to for a long time, is dropped for this trip;
    // driving or returning without progress for longer still: back to the post as a last resort
    if (tg && (!r.reached || r.noGain > GIVE_UP)) {
      r.skip.add(tg);
      tg = r.targetGnome = null;
      wp = null;
    } else if (!tg && wp && r.noGain > RESCUE) return toPost(m);
  }

  // a sidestep after getting stuck overrides the waypoint for a while
  if (wp && r.detour) {
    r.detourT += dt;
    if (hdist(p, r.detour) < 0.6 || r.detourT > DETOUR) r.detour = null;
    else wp = r.detour;
  }
  r.wp = wp;

  let speed = 0;
  let waiting = false;
  if (wp) {
    // waypoints stay inside the fence
    env.clampTo(wp, 1.3);
    const diff = wrap(Math.atan2(wp.x - p.x, wp.z - p.z) - r.yaw);
    r.yaw = THREE.MathUtils.damp(r.yaw, r.yaw + diff, 6, dt);
    speed = Math.abs(diff) > TURN_LIMIT ? 0 : robotSpeed();
    if (r.state === 'return') speed = Math.min(speed, 0.3 + PARK_SLOW * hdist(p, home));
    // the player standing in front: wait
    const pp = ctx.player.position;
    const d = hdist(pp, p);
    if (d < PLAYER_GAP && (pp.x - p.x) * fwd.x + (pp.z - p.z) * fwd.z > 0.5 * d) {
      speed = 0;
      waiting = true;
    }
    // backing away from whatever stopped it
    if (r.backT > 0 && !waiting) {
      r.backT -= dt;
      speed = -0.5 * robotSpeed();
    }
  }
  fwd.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
  let vx = fwd.x * speed;
  let vz = fwd.z * speed;
  // hole guard: no velocity towards the hole once the next step would come closer than HOLE_GAP to its edge
  const hx = p.x - env.hole.x;
  const hz = p.z - env.hole.z;
  const hd = Math.hypot(hx, hz);
  if (hd > 1e-3 && Math.hypot(hx + vx * dt, hz + vz * dt) < env.holeRadius + HOLE_GAP + 0.05) {
    const vn = (vx * hx + vz * hz) / hd;
    if (vn < 0) {
      vx -= (vn * hx) / hd;
      vz -= (vn * hz) / hd;
    }
  }
  const v = body.linvel();
  body.setLinvel({ x: vx, y: v.y, z: vz }, true);
  tmpQ.setFromAxisAngle(UP, r.yaw);
  body.setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }, true);
  r.speed = Math.hypot(vx, vz);
  // progress towards the goal (waiting for the player does not count against it)
  if (goal && wp && !waiting) {
    const d = hdist(p, goal);
    if (d < r.best - 0.5) {
      r.best = d;
      r.noGain = 0;
    } else r.noGain += dt;
  }

  // stuck against something while trying to drive: back off if there is room behind, sidestep 3 m to a free side, plan again
  if (speed > 0 && !waiting) {
    r.stuckT += dt;
    if (r.stuckT >= STUCK_T) {
      if (hdist(p, r.lastPos) < STUCK_D) {
        if (r.grid && !blocked(r.grid, p.x - fwd.x * 1.3, p.z - fwd.z * 1.3)) r.backT = BACK_T;
        detour(r, p, fwd, tg);
        r.plan = 0;
      }
      r.stuckT = 0;
      r.lastPos.copy(p);
    }
  } else {
    r.stuckT = 0;
    r.lastPos.copy(p);
  }

  const shown = Math.round((m.queue.length / cap) * m.fill.length);
  for (let i = 0; i < m.fill.length; i++) m.fill[i].visible = i < shown;
}

// Target order: 0 saboteur (breaks tools), 1 other gnomes that cost money or hurt the player, 2 the rest.
// Not the boom gnome: it only harms when the hole eats it, a robot cannot prevent that.
const DANGER: Record<string, number> = { saboteur: 0, greedy: 1, shadow: 1, wizard: 1, angry: 1 };
const danger = (g: Gnome) => DANGER[g.type.id] ?? 2;
// where each gnome last came to rest and since when (sampled by the robots' scans, every 0.5 s)
const rest = new WeakMap<Gnome, { x: number; z: number; since: number }>();
const MOVED = 0.5; // m away from its resting spot: it is moving again
const STILL_STEP = 5; // s; lying still longer by a whole step wins, within a step the nearer gnome wins
// m/s; faster up or down: flying (thrown, launched, bouncing). A gnome settling after a drop under 0.45 m stays a target.
const AIR_VY = 3;
// Walking or lying on the ground: low (the height a ragdoll stands up from, gnomes.ts) and not moving up or down.
// Not resting on the factory (chute, pedestal): the shovel cannot reach up there and the truck would retry it every
// trip. Higher than a gnome standing on the grass first, so `inside` runs only for raised gnomes.
// Held gnomes and the Magnet Gun ball are not free, so forEachNear already skips them.
const onGround = (g: Gnome, gp: { x: number; y: number; z: number }) =>
  gp.y < 1.2 * g.scale && Math.abs(g.body.linvel().y) < AIR_VY && !(gp.y > 0.44 * g.scale + 0.25 && ctx.factory.inside(gp.x, gp.z));

// Best free gnome (not the king) within the work area around the station: most dangerous type, then the one
// lying still the longest (in STILL_STEP steps), then the nearest. Gnomes other robots already chase come last
// (saboteurs excepted).
function findGnome(m: Machine, p: THREE.Vector3, area: number): Gnome | null {
  const r = m.robot!;
  const taken = new Set<Gnome>();
  for (const o of ctx.machines.list) if (o.robot && o !== m && o.robot.targetGnome) taken.add(o.robot.targetGnome);
  let best: Gnome | null = null;
  let bk = Infinity;
  const now = ctx.time;
  ctx.gnomes.forEachNear(m.pos, area, (g, _d, gp) => {
    let s = rest.get(g);
    if (!s) rest.set(g, (s = { x: gp.x, z: gp.z, since: now }));
    else if (Math.hypot(gp.x - s.x, gp.z - s.z) > MOVED) {
      s.x = gp.x;
      s.z = gp.z;
      s.since = now;
    }
    if (g.type.id === 'king' || r.skip.has(g) || !onGround(g, gp)) return;
    const still = Math.floor((now - s.since) / STILL_STEP);
    // one number: taken, danger, stillness, distance (no yard is 1000 m across, so distance never outweighs a step);
    // every robot may go for a saboteur: the one already chasing it can be far away while it reaches this post
    const k = (taken.has(g) && danger(g) > 0 ? 1e8 : 0) + danger(g) * 1e6 - Math.min(still, 99) * 1000 + hdist(gp, p);
    if (k < bk) {
      bk = k;
      best = g;
    }
  });
  return best;
}

function detour(r: Robot, p: THREE.Vector3, fwd: THREE.Vector3, tg: Gnome | null): void {
  const env = ctx.env;
  const side = Math.random() < 0.5 ? 1 : -1;
  const at = (s: number) => env.clampTo(new THREE.Vector3(p.x + fwd.z * s * 3, 0, p.z - fwd.x * s * 3), 1.3);
  // a side is usable when the way there is clear of tools and of the hole
  const ok = (d: THREE.Vector3) => env.holeDist(d.x, d.z) >= env.holeRadius + HOLE_GAP + 0.5 && (!r.grid || clear(r.grid, p, d, 0));
  let d = at(side);
  if (!ok(d)) d = at(-side);
  r.detour = ok(d) ? d : null;
  r.detourT = 0;
  if (r.state === 'seek' && tg && ++r.detours >= 2) {
    r.skip.add(tg);
    r.targetGnome = null;
  }
}

// Back at the station with its cargo (fell into the hole, left the yard, or hopelessly stuck).
function toPost(m: Machine): void {
  const r = m.robot!;
  const home = m.pos;
  m.body.setTranslation({ x: home.x, y: home.y + 0.02, z: home.z }, true);
  m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  savePose(m, m.body);
  ctx.fx.puff(home.clone().setY(home.y + 0.6), 0xffffff);
  r.state = m.queue.length ? 'drive' : 'idle';
  r.detour = null;
  r.bed.rotation.x = 0;
  r.backT = 0;
  r.planKey = null;
}

// Next point to drive at on the way to goal; null = no way (wait there, plans again every REPLAN).
function route(r: Robot, p: THREE.Vector3, goal: THREE.Vector3, near: number, key: unknown, dt: number): THREE.Vector3 | null {
  if (key !== r.planKey) {
    r.planKey = key;
    r.plan = 0;
    r.best = Infinity;
    r.noGain = 0;
    // the old way led elsewhere: straight at the new goal until the plan below (or a deferred field) gives one
    r.path = [];
    r.reached = true;
  }
  r.plan -= dt;
  if (r.plan <= 0 || !r.grid) {
    r.plan = REPLAN;
    const map = yardMap(p);
    if (!map) r.plan = 0; // another heavy route job ran this frame: the map is built next frame, the old way holds
    else {
      r.grid = truckGrid(r.grid, map.grid, p);
      if (clear(r.grid, p, goal, near)) {
        r.path = [];
        r.reached = true;
      } else if (typeof key === 'string') {
        // to the hole or home: follow the goal's distance field (built once per yard change, a slice per frame)
        const f = field(map, goal, near);
        if (f) descend(r, map, f, p, goal);
        else r.plan = 0; // the field is not finished, or another job ran this frame: keep the old way a frame longer
      } else if (!map.label) r.plan = 0; // the yard's parts are labelled next frame: keep the old way a frame longer
      else if (reachable(map, p, goal, near)) {
        if (searchTime === ctx.time) r.plan = 0; // another search ran this frame: keep the old way one frame longer
        else {
          searchTime = ctx.time;
          astar(r, r.grid, p, goal, near);
        }
      } else {
        // walled off from the gnome: no search (it is dropped for this trip)
        r.path = [];
        r.reached = false;
      }
      if (!r.reached && r.plan > 0) r.plan = 4 * REPLAN;
    }
  }
  const gr = r.grid;
  if (!gr) return goal; // no map yet: straight at the goal for a frame
  if (r.reached && clear(gr, p, goal, near)) return goal;
  while (r.path.length && hdist(p, r.path[0]) < 0.5) r.path.shift();
  // cut corners: the farthest of the next LOOK nodes in a straight line
  for (let i = Math.min(r.path.length, LOOK) - 1; i > 0; i--) {
    if (clear(gr, p, r.path[i], 0)) {
      r.path.splice(0, i);
      break;
    }
  }
  if (r.path.length) return r.path[0].clone();
  return r.reached ? goal : null;
}

// The yard map shared by all trucks (F3, PP 2026-10-21): one grid per truck height, a 4-neighbour component label
// per free cell (an unreachable gnome costs no search) and a distance field per goal (the hole, each post). It is
// thrown away when the tools, the factory, the hole or the yard change, checked once per frame by yardSig.
// The grid, the labels and each field are heavy jobs (2-5 ms each on the Dark Forest): the grid and the labels take
// a frame each, a field takes FIELD_STEP cells per frame, and a frame runs at most one of them (searchTime).
interface YardMap { grid: Grid; label: Int32Array | null; fields: Map<string, Float32Array> }
const maps = new Map<number, YardMap>(); // by truck height, 0.25 m steps
const GROUND_Y = 0.3; // the truck body's height on the ground (round cuboid, 0.3 m half height)
let mapSig = NaN;
let sigTime = NaN;
// the frame that built the map, a field or ran a yard A*: one per frame, so trucks that plan in the same frame
// (placed together, one scan finds gnomes for all) do not cost every search at once (F3)
let searchTime = NaN;

// Everything buildYard reads, at 5 cm: a placed, moved, widened, knocked over or removed tool changes it.
function yardSig(): number {
  const env = ctx.env;
  let h = 0;
  const add = (v: number) => (h = (Math.imul(h, 31) + Math.round(v * 20)) | 0);
  add(env.max.x); // the corner env.min never moves
  add(env.max.z);
  add(env.hole.x);
  add(env.hole.z);
  add(env.holeRadius);
  for (const o of ctx.machines.list) {
    const b = machineBox(o.type);
    // the crate is a loose body (carried, riding home): it moves every frame and buildYard skips it too
    if (o.type === 'robot' || o.type === 'box' || !b) continue;
    const t = o.body.translation();
    const q = o.body.rotation();
    for (const v of [t.x, t.y, t.z, q.x, q.y, q.z, q.w, b.half[0], b.half[2]]) add(v);
  }
  for (const f of ctx.factory.footprints) for (const v of [f.x, f.z, f.yaw, f.hx, f.hz]) add(v);
  return h;
}

// null: the map has to be built, but this frame already ran a heavy job
function yardMap(p: THREE.Vector3): YardMap | null {
  if (sigTime !== ctx.time) {
    sigTime = ctx.time;
    const s = yardSig();
    if (s !== mapSig) {
      mapSig = s;
      maps.clear();
    }
  }
  // centred on a truck on the ground (body at 0.3 m), so a bump on a slab seam stays in the same band
  const band = Math.round((p.y - GROUND_Y) * 4);
  let map = maps.get(band);
  if (!map) {
    if (searchTime === ctx.time) return null;
    map = { grid: buildYard(GROUND_Y + band / 4), label: null, fields: new Map() };
    maps.set(band, map);
    searchTime = ctx.time; // the map build is this frame's share; the labels wait for the next frame
  } else if (!map.label && searchTime !== ctx.time) {
    map.label = labels(map.grid);
    searchTime = ctx.time; // the first field or A* waits for the next frame
  }
  return map;
}

// The truck's own copy of the yard grid with the cells around it freed, so a truck already near a tool can leave.
function truckGrid(old: Grid | null, yard: Grid, p: THREE.Vector3): Grid {
  const gr = old && old.cells.length === yard.cells.length ? old : { ...yard, cells: new Uint8Array(yard.cells.length) };
  gr.x0 = yard.x0;
  gr.z0 = yard.z0;
  gr.nx = yard.nx;
  gr.nz = yard.nz;
  gr.cells.set(yard.cells);
  const { x0, z0, nx, nz, cells } = gr;
  const r = Math.ceil(ESCAPE / CELL);
  const px = Math.round((p.x - x0) / CELL);
  const pz = Math.round((p.z - z0) / CELL);
  for (let iz = Math.max(0, pz - r); iz <= Math.min(nz - 1, pz + r); iz++) {
    for (let ix = Math.max(0, px - r); ix <= Math.min(nx - 1, px + r); ix++) {
      if (Math.hypot(x0 + ix * CELL - p.x, z0 + iz * CELL - p.z) <= ESCAPE) cells[iz * nx + ix] = 0;
    }
  }
  return gr;
}

// Free yard cells the truck can step onto: its freed circle plus one cell around it.
function startCells(map: YardMap, p: THREE.Vector3, each: (i: number, d: number) => void): void {
  const { x0, z0, nx, nz, cells } = map.grid;
  const reach = ESCAPE + CELL;
  const r = Math.ceil(reach / CELL);
  const px = Math.round((p.x - x0) / CELL);
  const pz = Math.round((p.z - z0) / CELL);
  for (let iz = Math.max(0, pz - r); iz <= Math.min(nz - 1, pz + r); iz++) {
    for (let ix = Math.max(0, px - r); ix <= Math.min(nx - 1, px + r); ix++) {
      const d = Math.hypot(x0 + ix * CELL - p.x, z0 + iz * CELL - p.z);
      if (d <= reach && !cells[iz * nx + ix]) each(iz * nx + ix, d);
    }
  }
}

// Free cells within near of goal (where A* and the fields stop).
function goalCells(gr: Grid, goal: THREE.Vector3, near: number, each: (i: number) => void): void {
  const { x0, z0, nx, nz, cells } = gr;
  for (let iz = Math.max(0, Math.floor((goal.z - near - z0) / CELL)); iz <= Math.min(nz - 1, Math.ceil((goal.z + near - z0) / CELL)); iz++) {
    for (let ix = Math.max(0, Math.floor((goal.x - near - x0) / CELL)); ix <= Math.min(nx - 1, Math.ceil((goal.x + near - x0) / CELL)); ix++) {
      if (!cells[iz * nx + ix] && Math.hypot(x0 + ix * CELL - goal.x, z0 + iz * CELL - goal.z) <= near) each(iz * nx + ix);
    }
  }
}

// Same component as the truck: A* moves diagonally only past two free sides, so 4-neighbour components are exact.
function labels(gr: Grid): Int32Array {
  const { nx, cells } = gr;
  const n = cells.length;
  const label = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  let next = 0;
  const visit = (j: number) => {
    if (!cells[j] && label[j] < 0) {
      label[j] = next;
      stack.push(j);
    }
  };
  for (let s = 0; s < n; s++) {
    if (cells[s] || label[s] >= 0) continue;
    visit(s);
    while (stack.length) {
      const i = stack.pop()!;
      const ix = i % nx;
      if (ix > 0) visit(i - 1);
      if (ix < nx - 1) visit(i + 1);
      if (i >= nx) visit(i - nx);
      if (i + nx < n) visit(i + nx);
    }
    next++;
  }
  return label;
}

function reachable(map: YardMap, p: THREE.Vector3, goal: THREE.Vector3, near: number): boolean {
  const mine = new Set<number>();
  const label = map.label!;
  startCells(map, p, (i) => mine.add(label[i]));
  let hit = false;
  goalCells(map.grid, goal, near, (i) => {
    if (mine.has(label[i])) hit = true;
  });
  return hit;
}

// Dijkstra from the goal cells over the yard grid (A*'s moves) with whole costs, 5 a side step and 7 a diagonal, in
// FIELD_B rotating buckets (no heap): cost from every cell to the goal, Infinity = no way. One field is built at a
// time, FIELD_STEP queued cells per frame (a whole Dark Forest field measured 4-5.5 ms in one frame, F3); a truck that
// asks for another goal meanwhile pushes the running field on and waits for its own.
const FIELD_B = 8;
const FIELD_STEP = 12000;
const buckets: number[][] = Array.from({ length: FIELD_B }, () => []);
let job: { map: YardMap; k: string; f: Float32Array; cur: number; left: number } | null = null;
function field(map: YardMap, goal: THREE.Vector3, near: number): Float32Array | null {
  const k = `${Math.round(goal.x / CELL)},${Math.round(goal.z / CELL)},${near.toFixed(2)}`;
  const known = map.fields.get(k);
  if (known) return known;
  if (!map.label || searchTime === ctx.time) return null;
  searchTime = ctx.time;
  const { nx, nz, cells } = map.grid;
  // a field of a thrown-away map is dropped with its queue
  if (!job || job.map !== map) {
    for (const q of buckets) q.length = 0;
    const f = new Float32Array(nx * nz).fill(Infinity);
    let left = 0;
    goalCells(map.grid, goal, near, (i) => {
      f[i] = 0;
      buckets[0].push(i);
      left++;
    });
    job = { map, k, f, cur: 0, left };
  }
  const { f } = job;
  for (let n = 0; job.left && n < FIELD_STEP; ) {
    const q: number[] = buckets[job.cur % FIELD_B];
    if (!q.length) {
      job.cur++;
      continue;
    }
    const i = q.pop()!;
    job.left--;
    n++;
    const cur = job.cur;
    if (f[i] !== cur) continue; // reached cheaper since it was queued
    const ix = i % nx;
    const iz = (i - ix) / nx;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const jx = ix + dx;
        const jz = iz + dz;
        if ((!dx && !dz) || jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const j = jz * nx + jx;
        if (cells[j] || (dx && dz && (cells[iz * nx + jx] || cells[jz * nx + ix]))) continue;
        const c = cur + (dx && dz ? 7 : 5);
        if (c < f[j]) {
          f[j] = c;
          buckets[c % FIELD_B].push(j);
          job.left++;
        }
      }
    }
  }
  if (job.left) return null;
  map.fields.set(job.k, f);
  const mine = job.k === k;
  job = null;
  return mine ? f : null;
}

// The way down a goal's field from the truck. No way: one waypoint, the cell of the truck's part of the yard
// nearest the goal (it waits there, as close as the tools allow).
function descend(r: Robot, map: YardMap, f: Float32Array, p: THREE.Vector3, goal: THREE.Vector3): void {
  const { x0, z0, nx, nz, cells } = map.grid;
  const at = (i: number) => new THREE.Vector3(x0 + (i % nx) * CELL, 0, z0 + Math.floor(i / nx) * CELL);
  let s = -1;
  let best = Infinity;
  startCells(map, p, (i, d) => {
    if (f[i] + (5 * d) / CELL < best) {
      best = f[i] + (5 * d) / CELL;
      s = i;
    }
  });
  if (s < 0) {
    // (a field exists only on a labelled map)
    const label = map.label!;
    const mine = new Set<number>();
    startCells(map, p, (i) => mine.add(label[i]));
    let near = Infinity;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] || !mine.has(label[i])) continue;
      const d = Math.hypot(x0 + (i % nx) * CELL - goal.x, z0 + Math.floor(i / nx) * CELL - goal.z);
      if (d < near) {
        near = d;
        s = i;
      }
    }
    r.path = s < 0 ? [] : [at(s)];
    r.reached = false;
    return;
  }
  const path: THREE.Vector3[] = [];
  for (let i = s, n = 0; n < nx * nz; n++) {
    path.push(at(i));
    if (f[i] === 0) break;
    const ix = i % nx;
    const iz = (i - ix) / nx;
    let next = -1;
    let low = f[i];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const jx = ix + dx;
        const jz = iz + dz;
        if ((!dx && !dz) || jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const j = jz * nx + jx;
        if (cells[j] || (dx && dz && (cells[iz * nx + jx] || cells[jz * nx + ix]))) continue;
        if (f[j] < low) {
          low = f[j];
          next = j;
        }
      }
    }
    if (next < 0) break;
    i = next;
  }
  r.path = path;
  r.reached = true;
}

// Tools standing at the truck's level (y: the truck body's height) and the factory (footprints grown by CLEAR),
// the hole and the fence, over the whole yard.
function buildYard(y: number): Grid {
  const env = ctx.env;
  const x0 = env.min.x;
  const z0 = env.min.z;
  const nx = Math.ceil((env.max.x - env.min.x) / CELL) + 1;
  const nz = Math.ceil((env.max.z - env.min.z) / CELL) + 1;
  const p = { y };
  const cells = new Uint8Array(nx * nz);
  const holeR = env.holeRadius + HOLE_GAP + 0.1;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * CELL;
      const z = z0 + iz * CELL;
      if (!env.inside(x, z, 1.3) || env.holeDist(x, z) < holeR) cells[iz * nx + ix] = 1;
    }
  }
  // marks every cell inside the rectangle (centre, yaw, half sizes)
  const block = (cx: number, cz: number, yaw: number, hx: number, hz: number): void => {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const reach = Math.hypot(hx, hz);
    for (let iz = Math.max(0, Math.floor((cz - reach - z0) / CELL)); iz <= Math.min(nz - 1, Math.ceil((cz + reach - z0) / CELL)); iz++) {
      for (let ix = Math.max(0, Math.floor((cx - reach - x0) / CELL)); ix <= Math.min(nx - 1, Math.ceil((cx + reach - x0) / CELL)); ix++) {
        const dx = x0 + ix * CELL - cx;
        const dz = z0 + iz * CELL - cz;
        if (Math.abs(dx * cos - dz * sin) < hx && Math.abs(dx * sin + dz * cos) < hz) cells[iz * nx + ix] = 1;
      }
    }
  };
  for (const o of ctx.machines.list) {
    const b = machineBox(o.type);
    if (o.type === 'robot' || o.type === 'box' || !b) continue;
    const t = o.body.translation();
    const q = o.body.rotation();
    const c = gridV.set(b.center[0], b.center[1], b.center[2]).applyQuaternion(gridQ.set(q.x, q.y, q.z, q.w));
    const cx = t.x + c.x;
    const cz = t.z + c.z;
    // upright tools keep their oriented footprint; a tilted one blocks the square around its bounding sphere
    const upright = 1 - 2 * (q.x * q.x + q.z * q.z) > 0.95;
    const radius = Math.hypot(b.half[0], b.half[1], b.half[2]);
    const tall = upright ? b.half[1] : radius;
    if (t.y + c.y - tall > p.y + 0.7 || t.y + c.y + tall < p.y + 0.03) continue; // above the truck (stacked) or flat in the ground
    const yaw = upright ? Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y)) : 0;
    block(cx, cz, yaw, (upright ? b.half[0] : radius) + CLEAR, (upright ? b.half[2] : radius) + CLEAR);
  }
  for (const f of ctx.factory.footprints) block(f.x, f.z, f.yaw, f.hx + CLEAR, f.hz + CLEAR);
  return { x0, z0, nx, nz, cells };
}

function blocked(gr: Grid, x: number, z: number): boolean {
  const ix = Math.round((x - gr.x0) / CELL);
  const iz = Math.round((z - gr.z0) / CELL);
  return ix < 0 || iz < 0 || ix >= gr.nx || iz >= gr.nz || gr.cells[iz * gr.nx + ix] === 1;
}

// a straight drive from a to b crosses no blocked cell before it comes within near of b
function clear(gr: Grid, a: THREE.Vector3, b: THREE.Vector3, near: number): boolean {
  const len = hdist(a, b);
  const n = Math.ceil(len / (CELL / 2));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    if (len * (1 - k) <= near) return true;
    if (blocked(gr, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k)) return false;
  }
  return true;
}

// A* over the grid (8 neighbours, no squeezing diagonally past a corner) to any cell within near of goal.
// No way there: the path ends at the cell closest to the goal and r.reached is false.
// A*'s binary heap of cells by cost + h, reused between searches
const heap: number[] = [];
const hkey: number[] = [];
function hpush(i: number, f: number): void {
  let k = heap.length;
  heap.push(i);
  hkey.push(f);
  while (k > 0) {
    const up = (k - 1) >> 1;
    if (hkey[up] <= f) break;
    heap[k] = heap[up];
    hkey[k] = hkey[up];
    k = up;
  }
  heap[k] = i;
  hkey[k] = f;
}
function hpop(): number {
  const top = heap[0];
  const i = heap.pop()!;
  const f = hkey.pop()!;
  if (heap.length) {
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= heap.length) break;
      if (c + 1 < heap.length && hkey[c + 1] < hkey[c]) c++;
      if (hkey[c] >= f) break;
      heap[k] = heap[c];
      hkey[k] = hkey[c];
      k = c;
    }
    heap[k] = i;
    hkey[k] = f;
  }
  return top;
}
// A* scratch, reused: a yard-wide search allocates nothing
let cost = new Float32Array(0);
let from = new Int32Array(0);
let done = new Uint8Array(0);

function astar(r: Robot, gr: Grid, p: THREE.Vector3, goal: THREE.Vector3, near: number): void {
  const { x0, z0, nx, nz, cells } = gr;
  if (cost.length !== nx * nz) {
    cost = new Float32Array(nx * nz);
    from = new Int32Array(nx * nz);
    done = new Uint8Array(nx * nz);
  }
  cost.fill(Infinity);
  from.fill(-1);
  done.fill(0);
  const h = (i: number) => Math.max(0, Math.hypot(x0 + (i % nx) * CELL - goal.x, z0 + Math.floor(i / nx) * CELL - goal.z) - near) / CELL;
  heap.length = hkey.length = 0;
  const sx = THREE.MathUtils.clamp(Math.round((p.x - x0) / CELL), 0, nx - 1);
  const sz = THREE.MathUtils.clamp(Math.round((p.z - z0) / CELL), 0, nz - 1);
  const start = sz * nx + sx;
  cost[start] = 0;
  hpush(start, h(start));
  let end = start;
  let endH = h(start);
  r.reached = false;
  while (heap.length) {
    const i = hpop();
    if (done[i]) continue;
    done[i] = 1;
    const hi = h(i);
    if (hi < endH) {
      end = i;
      endH = hi;
    }
    if (hi === 0) {
      end = i;
      r.reached = true;
      break;
    }
    const ix = i % nx;
    const iz = (i - ix) / nx;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const jx = ix + dx;
        const jz = iz + dz;
        if ((!dx && !dz) || jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const j = jz * nx + jx;
        if (cells[j] || done[j] || (dx && dz && (cells[iz * nx + jx] || cells[jz * nx + ix]))) continue;
        const c = cost[i] + (dx && dz ? Math.SQRT2 : 1);
        if (c < cost[j]) {
          cost[j] = c;
          from[j] = i;
          hpush(j, c + h(j));
        }
      }
    }
  }
  const path: THREE.Vector3[] = [];
  for (let i = end; i !== start && i >= 0; i = from[i]) path.push(new THREE.Vector3(x0 + (i % nx) * CELL, 0, z0 + Math.floor(i / nx) * CELL));
  r.path = path.reverse();
}

// Scoop: the bed dips, flicks up (the gnome is stashed on that frame) and settles back with an overshoot.
function pick(m: Machine, r: Robot, dt: number): void {
  r.anim += dt;
  const t = r.anim;
  r.bed.rotation.x =
    t < PICK_DIP ? -0.1 * inQuad(t / PICK_DIP)
    : t < PICK_HIT ? -0.1 + 0.4 * outCubic((t - PICK_DIP) / (PICK_HIT - PICK_DIP))
    : 0.3 * (1 - outBack(Math.min(1, (t - PICK_HIT) / (PICK_TIME - PICK_HIT))));
  const g = r.targetGnome;
  if (t >= PICK_HIT && !r.stashed) {
    r.stashed = true;
    if (g && isFree(g) && m.queue.length < robotCap()) {
      const gp = g.body.translation();
      ctx.fx.puff(new THREE.Vector3(gp.x, gp.y, gp.z), 0xffffff);
      ctx.audio.thud();
      ctx.gnomes.stash(g);
      // picked up by a machine: a player throw that landed here pays no trick shot
      g.thrownBy = 'machine';
      g.throwPos = null;
      g.bounced = false;
      g.bullseye = false;
      m.queue.push(g);
    }
    r.targetGnome = null;
  }
  if (t >= PICK_TIME) {
    r.bed.rotation.x = 0;
    r.state = m.queue.length >= robotCap() ? 'drive' : 'return';
    r.scan = 0;
  }
}

// Tip at the hole: the bed dips, swings up to TIP_ANGLE (the load is eaten on that frame) and drops back with an overshoot.
function tip(m: Machine, r: Robot, dt: number): void {
  r.anim += dt;
  const t = r.anim;
  const up = TIP_DIP + TIP_RISE;
  r.bed.rotation.x =
    t < TIP_DIP ? -0.08 * inQuad(t / TIP_DIP)
    : t < up ? -0.08 + (TIP_ANGLE + 0.08) * outCubic((t - TIP_DIP) / TIP_RISE)
    : TIP_ANGLE * (1 - outBack(Math.min(1, (t - up) / TIP_BACK)));
  if (t >= up && m.queue.length) {
    const load = m.queue;
    m.queue = [];
    ctx.audio.thud();
    for (const g of load) ctx.hole.consume(g, undefined, true);
  }
  if (t >= up + TIP_BACK) {
    r.bed.rotation.x = 0;
    r.state = 'return';
    r.skip.clear();
    r.scan = 0;
  }
}
