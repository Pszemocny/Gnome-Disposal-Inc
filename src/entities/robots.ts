import * as THREE from 'three';
import { ctx, lvl, savePose } from '../core/context';
import { inQuad, outBack, outCubic } from '../core/ease';
import { build, robotBedGeometry, robotGeometry, vcMat } from '../world/models';
import { isFree, type Gnome } from './gnomes';
import { MACHINE_BOX, type Machine } from './machines';

// Cleaning robot: a little truck that drives to free gnomes around its home post, scoops them onto its bed
// (stashed, shown as hats), drives to the hole, tips the load in and drives back. It plans a way round placed
// tools on a coarse grid (A*, a few times per second), never comes closer to the hole than HOLE_GAP, backs
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
}

const HATS = 6;
const SCOOP = 0.9; // scoop point ahead of the truck centre
const REACH = 1.1;
const HOLE_GAP = 1.0; // the truck never gets closer than this to the hole edge
const ARRIVE_HOLE = 1.3;
const ARRIVE_HOME = 0.6;
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
const MARGIN = 6; // the grid reaches this far beyond the truck and its goal
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
  root.add(truck, bed, ring);
  return { root, bed };
}

// Called by Machines.place: state, the home post with its area ring, an upright body.
export function initRobot(m: Machine): void {
  const marker = new THREE.Group();
  marker.add(new THREE.Mesh(build([
    { g: new THREE.CylinderGeometry(0.05, 0.06, 1.1, 8), c: 0xd8dce0, p: [0, 0.55, 0] },
    { g: new THREE.SphereGeometry(0.11, 12, 8), c: 0x2fa8b8, p: [0, 1.15, 0] },
  ]), vcMat()));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2fa8b8, transparent: true, opacity: 0.35, depthWrite: false }));
  ring.position.y = 0.04;
  ring.scale.setScalar(robotArea());
  marker.add(ring);
  marker.position.copy(m.pos);
  ctx.scene.add(marker);
  m.marker = marker;
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(m.quat);
  const yaw = Math.atan2(fwd.x, fwd.z);
  tmpQ.setFromAxisAngle(UP, yaw);
  m.body.setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }, true);
  // same outer size as the cuboid from Machines.place, with rounded edges: a sharp bottom edge catches on the
  // seam between two ground slabs (z = hole ± 0.7 r) and the truck stops dead there
  m.body.collider(0).setShape(new ctx.R.RoundCuboid(0.45, 0.2, 0.7, 0.1));
  savePose(m, m.body);
  m.robot = {
    state: 'idle', yaw, speed: 0, wp: null, targetGnome: null, detour: null, detourT: 0, detours: 0, skip: new Set(),
    scan: 0, lonely: 0, stuckT: 0, lastPos: m.pos.clone(), anim: 0, stashed: false, bed: m.spin!, areaRing: ring,
    grid: null, path: [], reached: true, plan: 0, planKey: null, backT: 0, best: Infinity, noGain: 0,
  };
}

const hdist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function updateRobot(m: Machine, dt: number): void {
  const r = m.robot!;
  const body = m.body;
  const t = body.translation();
  const p = tmpP.set(t.x, t.y, t.z);
  const env = ctx.env;
  const half = env.half;
  const cap = robotCap();
  const area = robotArea();
  // m.pos is the home post (saved, and what Machines.move moves)
  const home = m.pos;
  // the hole grew or moved over the post (level-ups leave robots alone): the post steps out to where the truck can reach it
  const hh = env.holeDist(home.x, home.z);
  const keep = env.holeRadius + HOLE_GAP + ARRIVE_HOME;
  if (hh < keep) {
    const a = hh > 1e-3 ? Math.atan2(home.z - env.hole.z, home.x - env.hole.x) : 0;
    home.set(env.hole.x + Math.cos(a) * keep, Math.max(0, home.y), env.hole.z + Math.sin(a) * keep);
  }
  m.marker!.position.copy(home);
  r.areaRing.scale.setScalar(area);

  // fell into the hole or left the yard: back at the home post with its cargo
  if (t.y < -1 || Math.abs(t.x) > half + 0.5 || Math.abs(t.z) > half + 0.5) return toPost(m);

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
  // the post moved away from an idle truck (hole level-up)
  if (r.state === 'idle' && hdist(p, home) > 1) r.state = 'return';
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
      if (hdist(p, home) < ARRIVE_HOME) {
        r.state = 'idle';
        r.skip.clear();
      } else {
        wp = home.clone();
        near = HOME_NEAR;
      }
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
    const lim = half - 1.3;
    wp.x = THREE.MathUtils.clamp(wp.x, -lim, lim);
    wp.z = THREE.MathUtils.clamp(wp.z, -lim, lim);
    const diff = wrap(Math.atan2(wp.x - p.x, wp.z - p.z) - r.yaw);
    r.yaw = THREE.MathUtils.damp(r.yaw, r.yaw + diff, 6, dt);
    speed = Math.abs(diff) > TURN_LIMIT ? 0 : robotSpeed();
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
// Held gnomes and the Magnet Gun ball are not free, so forEachNear already skips them.
const onGround = (g: Gnome, gp: { y: number }) => gp.y < 1.2 * g.scale && Math.abs(g.body.linvel().y) < AIR_VY;

// Best free gnome (not the king) within the work area around the home post: most dangerous type, then the one
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
  const lim = env.half - 1.3;
  const side = Math.random() < 0.5 ? 1 : -1;
  const at = (s: number) => new THREE.Vector3(
    THREE.MathUtils.clamp(p.x + fwd.z * s * 3, -lim, lim), 0, THREE.MathUtils.clamp(p.z - fwd.x * s * 3, -lim, lim));
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

// Back at the home post with its cargo (fell into the hole, left the yard, or hopelessly stuck).
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
  }
  r.plan -= dt;
  if (r.plan <= 0 || !r.grid) {
    r.plan = REPLAN;
    r.grid = buildGrid(p, goal, MARGIN);
    if (clear(r.grid, p, goal, near)) {
      r.path = [];
      r.reached = true;
    } else {
      astar(r, r.grid, p, goal, near);
      // the way round may leave the stretch between truck and goal (a long wall): try the whole yard
      if (!r.reached) astar(r, (r.grid = buildGrid(p, goal, 2 * ctx.env.half)), p, goal, near);
      if (!r.reached) r.plan = 4 * REPLAN; // walled in: the yard-wide search is the expensive one, run it less often
    }
  }
  const gr = r.grid;
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

// Tools standing at the truck's level (footprint grown by CLEAR), the hole and the fence, around the truck and its goal.
function buildGrid(p: THREE.Vector3, goal: THREE.Vector3, margin: number): Grid {
  const env = ctx.env;
  const lim = env.half - 1.3;
  const x0 = Math.max(-env.half, Math.min(p.x, goal.x) - margin);
  const z0 = Math.max(-env.half, Math.min(p.z, goal.z) - margin);
  const nx = Math.ceil((Math.min(env.half, Math.max(p.x, goal.x) + margin) - x0) / CELL) + 1;
  const nz = Math.ceil((Math.min(env.half, Math.max(p.z, goal.z) + margin) - z0) / CELL) + 1;
  const cells = new Uint8Array(nx * nz);
  const holeR = env.holeRadius + HOLE_GAP + 0.1;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * CELL;
      const z = z0 + iz * CELL;
      if (Math.abs(x) > lim || Math.abs(z) > lim || env.holeDist(x, z) < holeR) cells[iz * nx + ix] = 1;
    }
  }
  for (const o of ctx.machines.list) {
    const b = MACHINE_BOX[o.type];
    if (o.type === 'robot' || !b) continue;
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
    const hx = (upright ? b.half[0] : radius) + CLEAR;
    const hz = (upright ? b.half[2] : radius) + CLEAR;
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
  }
  // the truck may already stand close to a tool: let it leave
  const r = Math.ceil(ESCAPE / CELL);
  const px = Math.round((p.x - x0) / CELL);
  const pz = Math.round((p.z - z0) / CELL);
  for (let iz = Math.max(0, pz - r); iz <= Math.min(nz - 1, pz + r); iz++) {
    for (let ix = Math.max(0, px - r); ix <= Math.min(nx - 1, px + r); ix++) {
      if (Math.hypot(x0 + ix * CELL - p.x, z0 + iz * CELL - p.z) <= ESCAPE) cells[iz * nx + ix] = 0;
    }
  }
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
function astar(r: Robot, gr: Grid, p: THREE.Vector3, goal: THREE.Vector3, near: number): void {
  const { x0, z0, nx, nz, cells } = gr;
  const cost = new Float32Array(nx * nz).fill(Infinity);
  const from = new Int32Array(nx * nz).fill(-1);
  const done = new Uint8Array(nx * nz);
  const h = (i: number) => Math.max(0, Math.hypot(x0 + (i % nx) * CELL - goal.x, z0 + Math.floor(i / nx) * CELL - goal.z) - near) / CELL;
  // binary heap of cells by cost + h
  const heap: number[] = [];
  const key: number[] = [];
  const push = (i: number, f: number) => {
    let k = heap.length;
    heap.push(i);
    key.push(f);
    while (k > 0) {
      const up = (k - 1) >> 1;
      if (key[up] <= f) break;
      heap[k] = heap[up];
      key[k] = key[up];
      k = up;
    }
    heap[k] = i;
    key[k] = f;
  };
  const pop = (): number => {
    const top = heap[0];
    const i = heap.pop()!;
    const f = key.pop()!;
    if (heap.length) {
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && key[c + 1] < key[c]) c++;
        if (key[c] >= f) break;
        heap[k] = heap[c];
        key[k] = key[c];
        k = c;
      }
      heap[k] = i;
      key[k] = f;
    }
    return top;
  };
  const sx = THREE.MathUtils.clamp(Math.round((p.x - x0) / CELL), 0, nx - 1);
  const sz = THREE.MathUtils.clamp(Math.round((p.z - z0) / CELL), 0, nz - 1);
  const start = sz * nx + sx;
  cost[start] = 0;
  push(start, h(start));
  let end = start;
  let endH = h(start);
  r.reached = false;
  while (heap.length) {
    const i = pop();
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
          push(j, c + h(j));
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
    for (const g of load) ctx.hole.consume(g);
  }
  if (t >= up + TIP_BACK) {
    r.bed.rotation.x = 0;
    r.state = 'return';
    r.skip.clear();
    r.scan = 0;
  }
}
