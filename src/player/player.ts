import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, G, groups, lvl, rand } from '../core/context';
import { MAX_HOLE_LEVEL } from '../data/holeLevels';
import { WEIGHT_TIERS } from '../data/gnomeTypes';
import { TOOL_IDS, UPGRADE_BY_ID } from '../data/upgrades';
import { isFree, type Gnome } from '../entities/gnomes';
import type { Prop } from '../entities/props';
import { footprintOverHole, machineBox, machineVisual, needsRepair, type Machine } from '../entities/machines';
import { Sweeper, type Gear } from './sweeper';
import { ToolWheel } from './wheel';
import { Pound } from './pound';
import { inQuad, outBack, outCubic } from '../core/ease';
import { Hole, TRICK_CAP, VOLLEY_CAP } from '../systems/hole';
import { magnetGunCoilGeometry, magnetGunGeometry, vcMat } from '../world/models';
import { glowTexture } from '../entities/mushrooms';

const GRAVITY = 20;
// Trick Scope: path samples (3 sub-steps of 0.015 s each, so up to 2.7 s of flight), ribbon width at the hand
// and at the landing, fade time, a ball about the size of a gnome for the landing test, trick colours
const ARC_PTS = 60;
const ARC_W0 = 0.16;
const ARC_W1 = 0.06;
const SCOPE_FADE = 0.2;
const ARC_BALL = 0.25;
const SCOPE_WHITE = 0xffffff;
const SCOPE_GREEN = 0x3aff8a;
const SCOPE_GOLD = 0xffd23f;
// placement on a top face: the ghost may step up this much onto the highest part of the thing you aim at
const STEP_UP = 1;
const EYE = 0.75;
// kick leg phases, seconds: pull back, strike (contact at KICK_BACK + KICK_HIT, the impulse lands then), return with overshoot
const KICK_BACK = 0.02;
const KICK_HIT = 0.04;
const KICK_TIME = 0.3;
// throw camera kick: seconds, FOV degrees, pitch radians (1.5°)
const THROW_KICK = 0.15;
const THROW_FOV = 3;
const THROW_PITCH = 0.026;
// Magnet Gun view model: rest position in camera space,
// throw recoil phases in seconds (nudge forward, kick back, settle with overshoot), slide in/out time
const GUN_POS = new THREE.Vector3(0.24, -0.22, -0.42);
const RECOIL_BACK = 0.04;
const RECOIL_HIT = 0.05;
const RECOIL_TIME = 0.35;
const GUN_SHOW = 0.2;
// spark ball: points in a unit ball (scaled to ballR), fade time, peak opacity
const SPARKS = 60;
const SPARK_FADE = 0.2;
const SPARK_ALPHA = 0.6;
const tmpV = new THREE.Vector3();
const tmpE = new THREE.Euler();

export class Player {
  position = new THREE.Vector3(0, 1.2, 9);
  yaw = 0;
  pitch = -0.15;
  // the one thing carried by hand: a gnome, a prop (armchair, flamingo) or a crate
  held: { body: RAPIER.RigidBody; gnome?: Gnome; prop?: Prop; crate?: Machine } | null = null;
  // gnomes on the Magnet Gun; `caught` once a gnome has been inside the ball, `out` = seconds stuck outside it
  swarm: { g: Gnome; caught: boolean; inBall: boolean; out: number }[] = [];
  private ballGroup: { n: number } | null = null; // XP group of the current Magnet Gun hold
  // Trick Scope label for the HUD: tricks the predicted throw scores, where it lands, fade 0..1
  aimText = '';
  aimPos = new THREE.Vector3();
  aimAlpha = 0;
  // Trick Scope glass (Lvl 3): the path ends in the hole, distance from the release point, the predicted multiplier
  aimInHole = false;
  aimDist = 0;
  aimMult = 1;
  vel = new THREE.Vector3();
  placing: string | null = null;
  lookAt: { gnome?: Gnome; machine?: Machine; prop?: Prop; desk?: boolean; switch?: boolean } = {};
  sweeper: Sweeper;
  wheel = new ToolWheel();
  pound = new Pound();

  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  private vy = 0;
  private knock = new THREE.Vector3();
  private grounded = false;
  private jumps = 0;
  private grabCd = 0;
  private throwCd = 0;
  private kickCd = 0;
  private bob = 0;
  private ghost: THREE.Group | null = null;
  private ghostQuat = new THREE.Quaternion();
  private ghostDist = 7;
  private ghostPos = new THREE.Vector3();
  ghostBlocked = false;
  private kickLeg: THREE.Mesh;
  private kickAnim = 0;
  private kickPending = false; // the kick's impulse waits for the leg's contact frame
  private throwKick = 0; // seconds left of the throw camera kick
  private fov = 75; // camera FOV before the throw kick is added
  private prevLeft = false;
  private lmbBlocked = false; // after a gear switch LMB does nothing until released
  private gun = new THREE.Group();
  private gunCoil = vcMat({ emissive: 0x6ae0ff, emissiveIntensity: 0 });
  private gunShow = 0; // 0..1, slides the gun in from below
  private gunPull = 0; // 0..1, coil glow and tremble while pulling
  private gunRecoil = RECOIL_TIME; // seconds since the last throw recoil started
  private sparks: THREE.Points;
  private sparkPhase: Float32Array; // per-point flicker phase
  private sparkT = 0; // 0..1 fade of the spark ball
  private sparkSpin = 0;
  private prevCentre: THREE.Vector3 | null = null;
  private arc: THREE.Mesh; // Trick Scope ribbon along the predicted path
  private land: THREE.Mesh; // pulsing ring where the path ends
  private arcColor = SCOPE_WHITE;
  scopeT = 0; // 0..1 fade of the preview
  private landed = false; // the predicted path ends on a surface or in the hole
  private arcBall: RAPIER.Ball;
  private frameDt = 0;
  private shakeE = new THREE.Euler();
  private inDeep = false;

  constructor() {
    const { R, physics, camera, scene } = ctx;
    this.body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.position.x, this.position.y, this.position.z));
    this.collider = physics.createCollider(R.ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(groups(G.PLAYER, G.GROUND | G.STATIC | G.PROP | G.GNOME)), this.body);
    this.kcc = physics.createCharacterController(0.03);
    this.kcc.enableAutostep(0.45, 0.2, true);
    this.kcc.enableSnapToGround(0.35);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.kcc.setCharacterMass(3);
    this.kcc.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    scene.add(camera);
    this.sweeper = new Sweeper();
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a52 });
    this.kickLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.9), legMat);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.36), new THREE.MeshStandardMaterial({ color: 0x6a3a1a }));
    shoe.position.set(0, -0.05, -0.5);
    this.kickLeg.add(shoe);
    this.kickLeg.visible = false;
    camera.add(this.kickLeg);

    // ribbon: two vertices per path sample, alpha per vertex fades towards the landing
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_PTS * 2 * 3), 3));
    arcGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ARC_PTS * 2 * 4).fill(1), 4));
    const idx: number[] = [];
    for (let i = 0; i < ARC_PTS - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    arcGeo.setIndex(idx);
    this.arc = new THREE.Mesh(arcGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.arc.visible = false;
    this.arc.frustumCulled = false;
    this.land = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 40),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    this.land.visible = false;
    this.arcBall = new ctx.R.Ball(ARC_BALL);
    this.gun.add(new THREE.Mesh(magnetGunGeometry(), vcMat()), new THREE.Mesh(magnetGunCoilGeometry(), this.gunCoil));
    this.gun.visible = false;
    camera.add(this.gun);

    // Magnet Gun spark ball: 2/3 of the points near the surface, the rest inside; every point has a mirror
    // twin, so the cloud is centred exactly on the ball centre.
    const pos = new Float32Array(SPARKS * 3);
    const col = new Float32Array(SPARKS * 4);
    this.sparkPhase = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i += 2) {
      tmpV.randomDirection().multiplyScalar(i < (SPARKS * 2) / 3 ? rand(0.85, 1) : rand(0.25, 0.85));
      pos.set([tmpV.x, tmpV.y, tmpV.z, -tmpV.x, -tmpV.y, -tmpV.z], i * 3);
    }
    for (let i = 0; i < SPARKS; i++) {
      const w = rand(0, 1); // pale cyan to white
      col.set([0.75 + 0.25 * w, 0.95 + 0.05 * w, 1, 1], i * 4);
      this.sparkPhase[i] = rand(0, Math.PI * 2);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    this.sparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ size: 0.09, map: glowTexture(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.sparks.visible = false;
    this.sparks.frustumCulled = false;
    scene.add(this.arc,this.land, this.sparks);
  }

  // LMB pulls with the Magnet Gun (nothing carried by hand)
  private get gunPulling(): boolean {
    const inp = ctx.input;
    return this.sweeper.gear === 'magGun' && !this.held && inp.mouse.left && inp.locked && !this.placing && !this.lmbBlocked;
  }

  // Gun in hand: slides in while it is the gear and nothing is being placed, sways with the walk, trembles and glows while pulling,
  // recoils on a throw (anticipation forward, kick back, settle with overshoot).
  private updateGun(dt: number): void {
    const show = this.sweeper.gear === 'magGun' && !this.placing;
    this.gunShow = THREE.MathUtils.clamp(this.gunShow + (show ? dt : -dt) / GUN_SHOW, 0, 1);
    this.gun.visible = this.gunShow > 0;
    this.gunPull = THREE.MathUtils.damp(this.gunPull, this.gunPulling ? 1 : 0, 8, dt);
    this.gunRecoil = Math.min(RECOIL_TIME, this.gunRecoil + dt);
    if (!this.gun.visible) return;
    const t = this.gunRecoil;
    const s =
      t < RECOIL_BACK ? -0.3 * inQuad(t / RECOIL_BACK)
      : t < RECOIL_BACK + RECOIL_HIT ? -0.3 + 1.3 * outCubic((t - RECOIL_BACK) / RECOIL_HIT)
      : 1 - outBack((t - RECOIL_BACK - RECOIL_HIT) / (RECOIL_TIME - RECOIL_BACK - RECOIL_HIT));
    const tr = this.gunPull * 0.003;
    this.gun.position.set(
      GUN_POS.x + Math.sin(this.bob * 0.5) * 0.012 + Math.sin(ctx.time * 53) * tr,
      GUN_POS.y + Math.sin(this.bob) * 0.008 + Math.sin(ctx.time * 41 + 1) * tr - (1 - outCubic(this.gunShow)) * 0.3,
      GUN_POS.z + s * 0.07,
    );
    this.gun.rotation.set(s * 0.35, 0.06, 0);
    this.gunCoil.emissiveIntensity = this.gunPull * (0.6 + 0.4 * Math.sin(ctx.time * 9));
  }

  // Spark ball on the Magnet Gun ball: fades in while pulling and out on release, follows ballR.
  private updateSparks(dt: number): void {
    const pulling = this.gunPulling;
    this.sparkT = THREE.MathUtils.clamp(this.sparkT + (pulling ? dt : -dt) / SPARK_FADE, 0, 1);
    const mat = this.sparks.material as THREE.PointsMaterial;
    mat.opacity = SPARK_ALPHA * outCubic(this.sparkT);
    this.sparks.visible = this.sparkT > 0;
    if (!this.sparks.visible) return;
    this.sparks.position.copy(this.ballCentre);
    this.sparks.scale.setScalar(this.ballR);
    this.sparkSpin = THREE.MathUtils.damp(this.sparkSpin, pulling ? 0.9 : 0.3, 3, dt);
    this.sparks.rotation.y += this.sparkSpin * dt;
    this.sparks.rotation.x += this.sparkSpin * 0.4 * dt;
    const col = this.sparks.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < SPARKS; i++) col.setW(i, 0.8 + 0.2 * Math.sin(ctx.time * 7 + this.sparkPhase[i]));
    col.needsUpdate = true;
  }

  // Aiming aid: the predicted path of a throw (green when it ends in the hole).
  private updateAids(): void {
    const h = this.held;
    const sw = this.swarm;
    let end: THREE.Vector3 | null = null;
    // swarm: the arc starts at the swarm's mean position, as for a 1.2 kg gnome flying with the ball's mean velocity
    const bv = new THREE.Vector3();
    let m = 1.2;
    if (h) {
      const p = h.body.translation();
      end = new THREE.Vector3(p.x, p.y, p.z);
      const v = h.body.linvel();
      bv.set(v.x, v.y, v.z);
      m = h.body.mass();
    } else if (sw.length) {
      end = new THREE.Vector3();
      for (const s of sw) {
        const p = s.g.body.translation();
        const v = s.g.body.linvel();
        end.add(tmpV.set(p.x, p.y, p.z));
        bv.add(tmpV.set(v.x, v.y, v.z));
        m = Math.max(m, s.g.body.mass()); // the ball flies at the heaviest member's speed
      }
      end.divideScalar(sw.length);
      bv.divideScalar(sw.length);
    }
    if (this.ignoreWeight && (h?.gnome || sw.length)) m = WEIGHT_TIERS.normal.mass; // as throwHeld's mRef (Q1 a)

    // Trick Scope (shop): the predicted path while something is held; fades in and out over 0.2 s
    const holding = !!h || sw.length > 0;
    const show = holding && !this.placing && !!lvl('scope');
    this.scopeT = THREE.MathUtils.clamp(this.scopeT + (show ? this.frameDt : -this.frameDt) / SCOPE_FADE, 0, 1);
    const fade = outCubic(this.scopeT);
    this.aimAlpha = fade;
    if (show) this.predict(end!, bv, m, !!h?.gnome || sw.length > 0);
    this.arc.visible = this.scopeT > 0;
    this.land.visible = this.arc.visible && this.landed;
    if (!this.arc.visible) return;
    const am = this.arc.material as THREE.MeshBasicMaterial;
    am.color.setHex(this.arcColor);
    am.opacity = fade;
    const lm = this.land.material as THREE.MeshBasicMaterial;
    lm.color.setHex(this.arcColor);
    lm.opacity = 0.85 * fade;
    this.land.scale.setScalar(1 + 0.12 * Math.sin(ctx.time * 5)); // gentle continuous pulse
  }

  // Simulates the throw as throwHeld does it (impulse / mass + the current velocity, gravity, the gnome's damping),
  // sweeps a gnome-sized ball along it, builds the ribbon, places the landing ring and names the tricks it scores.
  private predict(start: THREE.Vector3, bv: THREE.Vector3, m: number, gnomes: boolean): void {
    const env = ctx.env;
    const d = this.dir;
    const J = this.throwJ;
    const v = new THREE.Vector3((d.x * J) / m + bv.x, ((d.y + 0.17) * J) / m + bv.y, (d.z * J) / m + bv.z);
    const p = start.clone();
    const prev = new THREE.Vector3();
    const seg = new THREE.Vector3();
    // the hoop disc, tested the way hole.ts tests a real gnome
    const hc = ctx.hole.ring?.position;
    const hn = hc && new THREE.Vector3(env.hole.x - hc.x, 0, env.hole.z - hc.z).normalize();
    const solid = (col: RAPIER.Collider) => !ctx.gnomes.byCollider.has(col.handle) && !this.isHeldBody(col.parent());
    const hitGroups = groups(G.GNOME, G.GROUND | G.STATIC | G.PROP);
    const pts = [p.clone()];
    const landAt = new THREE.Vector3();
    const landN = new THREE.Vector3(0, 1, 0);
    let inHole = false;
    let hoop = false;
    this.landed = false;
    while (pts.length < ARC_PTS && !this.landed) {
      prev.copy(p);
      for (let s = 0; s < 3; s++) {
        v.y -= GRAVITY * 0.015;
        v.multiplyScalar(1 - 0.15 * 0.015);
        p.addScaledVector(v, 0.015);
      }
      if (hc && hn && !hoop) {
        const a = tmpV.copy(prev).sub(hc).dot(hn);
        const b = tmpV.copy(p).sub(hc).dot(hn);
        if (a * b <= 0 && tmpV.copy(prev).lerp(p, a / (a - b || 1)).distanceTo(hc) < Hole.RING_RADIUS) hoop = true;
      }
      if (env.holeDist(p.x, p.z) < env.holeRadius && p.y < 0.8) {
        inHole = this.landed = true;
        landAt.set(p.x, 0.03, p.z);
      } else {
        seg.copy(p).sub(prev);
        const hit = ctx.physics.castShape(prev, { x: 0, y: 0, z: 0, w: 1 }, seg, this.arcBall, 0, 1, true, undefined, hitGroups, undefined, undefined, solid);
        if (hit) {
          this.landed = true;
          p.copy(prev).addScaledVector(seg, hit.time_of_impact);
          landAt.set(hit.witness1.x, hit.witness1.y, hit.witness1.z);
          landN.set(hit.normal1.x, hit.normal1.y, hit.normal1.z);
        }
      }
      pts.push(p.clone());
    }

    const tricks: string[] = [];
    // same thresholds as Hole.consume: distance from where the gnome leaves the hand to the hole centre
    const dist = env.holeDist(start.x, start.z);
    if (inHole && gnomes) {
      if (dist >= 14) tricks.push('SNIPER');
      else if (dist >= 8) tricks.push('LONG SHOT');
      if (hoop) tricks.push('BULLSEYE');
    }
    this.aimText = tricks.join(' + ');
    this.aimInHole = inHole;
    this.aimDist = dist;
    // a straight throw into the hole always scores AIR x2; a ball of more than one gnome is a volley (lower cap)
    this.aimMult = inHole && gnomes ? Math.min(this.heldGnomes().length > 1 ? VOLLEY_CAP : TRICK_CAP, (dist >= 14 ? 4 : dist >= 8 ? 2.5 : 1) * 2 * (hoop ? 5 : 1)) : 1;
    this.arcColor = tricks.length ? SCOPE_GOLD : inHole ? SCOPE_GREEN : SCOPE_WHITE;
    this.aimPos.copy(landAt).y += 0.3;
    if (this.landed) {
      this.land.position.copy(landAt).addScaledVector(landN, 0.03);
      this.land.quaternion.setFromUnitVectors(tmpV.set(0, 0, 1), landN);
    }

    // camera-facing ribbon, tapering and fading towards the landing; spare vertices collapse on the last point
    const pos = this.arc.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.arc.geometry.attributes.color as THREE.BufferAttribute;
    const cam = ctx.camera.position;
    const n = pts.length;
    const side = new THREE.Vector3();
    for (let i = 0; i < ARC_PTS; i++) {
      const k = Math.min(i, n - 1);
      const u = k / Math.max(1, n - 1);
      side.copy(pts[Math.min(n - 1, k + 1)]).sub(pts[Math.max(0, k - 1)]).cross(tmpV.copy(cam).sub(pts[k]));
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.setLength((ARC_W0 + (ARC_W1 - ARC_W0) * u) / 2);
      const q = pts[k];
      pos.setXYZ(2 * i, q.x + side.x, q.y + side.y, q.z + side.z);
      pos.setXYZ(2 * i + 1, q.x - side.x, q.y - side.y, q.z - side.z);
      // soft start next to the hand, then fading out towards the end
      const alpha = i < n ? 0.75 * (1 - 0.7 * u) * Math.min(1, k / 3) : 0;
      col.setW(2 * i, alpha);
      col.setW(2 * i + 1, alpha);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private get throwJ(): number {
    return 15 * (1 + 0.15 * lvl('throw'));
  }

  // every gnome flies as a 1.2 kg one: Feeding Frenzy (2026-10-25, Q1 a) or max Strong Arm (PP 2026-10-21)
  private get ignoreWeight(): boolean {
    return !!lvl('frenzy') || lvl('throw') >= UPGRADE_BY_ID.throw.max;
  }

  get dir(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  get eye(): THREE.Vector3 {
    return this.position.clone().setY(this.position.y + EYE + this.sweeper.lift);
  }


  // A tool grew around the player (Wide Belt): move the capsule (radius 0.35, 0.9 tall each way) out of the
  // tool's box along the shortest way, sideways or up, so the character controller does not start inside it.
  // The camera reads `position` directly (no interpolated pose), so the move shows in the same frame.
  pushOutOf(centre: THREE.Vector3, half: THREE.Vector3, q: THREE.Quaternion): void {
    const l = this.body.translation();
    const p = new THREE.Vector3(l.x, l.y, l.z).sub(centre).applyQuaternion(q.clone().invert());
    const pen = [half.x + 0.35 - Math.abs(p.x), half.y + 0.9 - p.y, half.z + 0.35 - Math.abs(p.z)];
    if (pen.some((v) => v <= 0) || Math.abs(p.y) > half.y + 0.9) return;
    const i = pen.indexOf(Math.min(...pen));
    if (i === 0) p.x += Math.sign(p.x || 1) * (pen[0] + 0.02);
    else if (i === 1) p.y += pen[1] + 0.02;
    else p.z += Math.sign(p.z || 1) * (pen[2] + 0.02);
    p.applyQuaternion(q).add(centre);
    this.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    this.position.copy(p);
  }

  hitBy(dir: THREE.Vector3, power: number): void {
    this.knock.addScaledVector(dir.clone().setY(0).normalize(), power);
    this.vy = Math.max(this.vy, power * 0.5);
    ctx.fx.shake(0.35);
  }

  update(dt: number): void {
    const inp = ctx.input;
    this.frameDt = dt;
    // while placing, RMB + mouse rotates the tool instead of the camera; the open tool wheel takes the mouse
    if (!ctx.paused && !(this.placing && inp.mouse.right) && !this.wheel.open) {
      // the sensitivity slider is applied to the mouse deltas in input.ts (settings cookie)
      const sens = 0.0022;
      this.yaw -= inp.mouse.dx * sens;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - inp.mouse.dy * sens));
    }
    // rebirth or a reset took the tool away
    const gear = this.sweeper.gear;
    if (gear !== 'hands' && !lvl(gear)) this.setGear('hands');
    this.move(dt);
    this.updateLook();
    const active = !ctx.paused;
    if (active) {
      this.wheel.update(this);
      if (this.placing) this.updatePlacement();
      else this.actions(dt);
      this.hotkeys();
    }
    this.sweeper.update(dt, this, active);
    this.updateCamera(dt);
    this.updateKickLeg(dt);
    this.updateGun(dt);
    this.updateSparks(dt);
    this.updateAids();
  }

  private move(dt: number): void {
    const inp = ctx.input;
    const zoom = ctx.buffs.active('zoom');
    let speed = 6.2 * (1 + lvl('speed') * 0.12) * (zoom ? 1.6 : 1);
    // the tractor drives a bit faster but has no sprint
    if (this.sweeper.gear === 'tractor') speed *= 1.25;
    else if (inp.down('ShiftLeft') || inp.down('ShiftRight')) speed *= 1.5;
    const f = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    const s = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    if (ctx.paused) wish.set(0, 0, 0);

    if (this.grounded) this.jumps = 0;
    if (inp.hit('Space') && !ctx.paused) {
      const jumpV = 7.8 * (1 + lvl('jump') * 0.15) * (zoom ? 1.35 : 1);
      if (this.grounded) {
        this.vy = jumpV;
        this.jumps = 1;
      } else if (lvl('boots') && this.jumps < 2) {
        this.vy = jumpV;
        this.jumps = 2;
        ctx.fx.burst(this.position.clone().setY(this.position.y - 0.9), 0xffffff, 12);
      }
    }
    this.vy = this.pound.update(dt, this.position, this.grounded, this.vy, this.sweeper.gear === 'tractor');
    this.vy -= GRAVITY * dt;
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
    const delta = new THREE.Vector3((wish.x + this.knock.x) * dt, this.vy * dt, (wish.z + this.knock.z) * dt);
    this.kcc.computeColliderMovement(this.collider, delta, ctx.R.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.kcc.computedMovement();
    const t = this.body.translation();
    const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    this.body.setNextKinematicTranslation(next);
    this.grounded = this.kcc.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = -1;
    if (mv.y > delta.y + 0.001 && this.vy > 0 && !this.grounded) this.vy = Math.min(this.vy, 0);
    if (dt > 0) this.vel.set(mv.x / dt, mv.y / dt, mv.z / dt);
    this.position.set(next.x, next.y, next.z);
    // no footsteps and no head bob on the tractor seat
    if (this.grounded && wish.lengthSq() > 0 && this.sweeper.gear !== 'tractor') {
      this.bob += dt * speed * 1.6;
      ctx.audio.step();
    }

    // fell into the hole
    if (next.y < -4 && !this.inDeep) this.fellIn();
  }

  private fellIn(): void {
    if (ctx.state.holeLevel >= MAX_HOLE_LEVEL) {
      this.inDeep = true;
      // offer the leaderboard before the run's money is reset
      ctx.hud.deep(ctx.hole.shardsForRebirth(), () => ctx.leaderboard.offer(() => ctx.hole.rebirth()));
      return;
    }
    ctx.achievements.unlock('fall');
    // the coin fountain pays once per hole level and run (secrets survive a rebirth, hence the run number)
    const s = ctx.state;
    const flag = `fall${s.holeLevel}-run${s.stats.rebirths}`;
    const pay = !s.secrets.includes(flag);
    if (pay) s.secrets.push(flag);
    ctx.hud.toast(pay ? 'The hole did not like the taste of you. BLEH!' : 'The hole already paid you for this level.', 'secret');
    ctx.audio.slurp();
    ctx.audio.rumble(0.6);
    const a = rand(0, Math.PI * 2);
    const h = ctx.env.hole;
    this.body.setTranslation({ x: h.x, y: 1, z: h.z }, true);
    this.position.set(h.x, 1, h.z);
    this.vy = 16;
    this.knock.set(Math.cos(a) * 9, 0, Math.sin(a) * 9);
    if (pay) ctx.coins.burst(ctx.hole.valueScale * 15, h.clone().setY(0.5), 1.5);
    ctx.fx.shake(0.8);
  }

  private raycast(maxD: number): RAPIER.RayColliderHit | null {
    const e = this.eye;
    const d = this.dir;
    const ray = new ctx.R.Ray({ x: e.x, y: e.y, z: e.z }, { x: d.x, y: d.y, z: d.z });
    // look through whatever the magnet is holding
    const skip = (col: RAPIER.Collider) => !this.isHeldBody(col.parent());
    return ctx.physics.castRay(ray, maxD, true, undefined, undefined, this.collider, undefined, skip);
  }

  private updateLook(): void {
    this.lookAt = {};
    const hit = this.raycast(6);
    if (hit) {
      const h = hit.collider.handle;
      const g = ctx.gnomes.byCollider.get(h);
      if (g && hit.timeOfImpact < 4.5) this.lookAt.gnome = g;
      const m = ctx.machines.byCollider.get(h);
      if (m) this.lookAt.machine = m;
      const p = ctx.props.byCollider.get(h);
      if (p && hit.timeOfImpact < 4.5) this.lookAt.prop = p;
      if (h === ctx.factory.switchHandle && hit.timeOfImpact < 4.5) this.lookAt.switch = true;
    }
    if (this.position.distanceTo(ctx.env.deskPos) < 3.2) this.lookAt.desk = true;
  }

  private actions(dt: number): void {
    const inp = ctx.input;
    this.grabCd -= dt;
    this.throwCd -= dt;
    this.kickCd -= dt;

    // LMB held: hands carry ONE thing; the Magnet Gun pulls every gnome in the cone at once. LMB released: let go.
    // on the tractor or with the blower LMB does not grab
    if (!inp.mouse.left) this.lmbBlocked = false;
    const left = inp.mouse.left && this.sweeper.grabs && !this.lmbBlocked;
    if (left && inp.mouse.leftPressed && this.sweeper.gear === 'magGun') ctx.hud.firstUse('magGun');
    if (left) {
      if (!this.held && !this.swarm.length && this.grabCd <= 0 && inp.mouse.leftPressed) {
        const crate = this.lookAt.machine?.type === 'box' ? this.lookAt.machine : undefined;
        if (crate) this.held = { body: crate.body, crate };
        else if (this.lookAt.prop) this.held = { body: this.lookAt.prop.body, prop: this.lookAt.prop };
      }
      if (!this.held && this.grabCd <= 0) {
        if (this.sweeper.gear === 'hands') {
          const g = this.gnomeTarget();
          if (g) {
            ctx.audio.whoosh();
            this.grab(g);
            this.held = { body: g.body, gnome: g };
          }
        } else {
          const picked = this.coneTargets();
          const look = this.lookAt.gnome;
          if (look && this.grabbable(look) && !picked.includes(look)) picked.unshift(look);
          const batch = picked.slice(0, Math.max(0, this.ballCap - this.swarm.length));
          if (batch.length) {
            if (!this.swarm.length) this.ballGroup = { n: 0 };
            if (!this.holdsGnome) ctx.audio.whoosh();
            // the whole batch joins the swarm before hold(), so a big ball stays quiet from frame 1
            for (const g of batch) this.swarm.push({ g, caught: false, inBall: false, out: 0 });
            // after grab: hold() clears the group; a gnome that slipped off and comes back is counted once
            for (const g of batch) {
              const member = g.xpGroup === this.ballGroup;
              this.grab(g);
              g.xpGroup = this.ballGroup;
              if (!member) this.ballGroup!.n++;
            }
          }
        }
      }
    } else if (this.prevLeft) this.release();
    this.prevLeft = left;

    this.updateHeld();
    this.updateSwarm();

    // RMB throws everything held at once
    if ((this.held || this.swarm.length) && this.throwCd <= 0 && inp.mouse.rightPressed) this.throwHeld();

    if (inp.hit('KeyF') && this.kickCd <= 0) this.kick();

    if (inp.hit('KeyE')) {
      const m = this.lookAt.machine;
      // a broken tool wins over the desk (today's rule); a preventive fuse swap yields to it
      if (this.lookAt.switch) ctx.factory.toggle();
      else if (m && m.broken > 0) ctx.machines.repair(m);
      else if (this.lookAt.desk) ctx.shop.open();
      else if (m && m.blown > 0) ctx.machines.repair(m);
    }
    if (inp.hit('KeyX') && this.lookAt.machine) {
      const m = this.lookAt.machine;
      ctx.machines.remove(m);
      ctx.hud.toast(`${UPGRADE_BY_ID[m.type].name} back in your inventory.`, 'info');
      ctx.audio.buy();
    }
    // G: pick up a placed tool and move it, keeping its rotation
    if (inp.hit('KeyG') && this.lookAt.machine && this.lookAt.machine.type !== 'box') {
      const m = this.lookAt.machine;
      const rot = m.quat.clone();
      ctx.machines.remove(m);
      this.selectTool(m.type, rot);
    }
  }

  // Magnet Gun ball radius: 0.8 m, +0.2 m per Magnet Coil; it holds as many gnomes as fit
  get ballR(): number {
    return 0.8 + 0.2 * lvl('magPower');
  }

  // gnomes the ball fits: 20 measured at R 0.8, 71 at R 1.8 (2026-10-19-magnet-ball.md); the pull never feeds more than this
  get ballCap(): number {
    return Math.ceil(22 * Math.pow(this.ballR / 0.8, 1.5));
  }

  // magnet reach: +1.2 m per Magnet Dish; the Magnet Gun also +0.6 m per Magnet Coil (PP 2026-10-20)
  get magReach(): number {
    return 7 + 1.2 * lvl('magRange') + (this.sweeper.gear === 'magGun' ? 0.6 * lvl('magPower') : 0);
  }

  // the ball moves away from the camera as it grows, so a big ball does not fill the view
  get ballCentre(): THREE.Vector3 {
    return this.eye.addScaledVector(this.dir, 1.2 + this.ballR);
  }

  // gnomes inside the ball right now (the rest of the swarm is still flying in or pushed out)
  get ballGnomes(): Gnome[] {
    return this.swarm.filter((s) => s.inBall).map((s) => s.g);
  }

  // a gnome is held by hand or on the Magnet Gun (keeps the combo alive)
  get holdsGnome(): boolean {
    return !!this.held?.gnome || this.swarm.length > 0;
  }

  private isHeldBody(b: RAPIER.RigidBody | null): boolean {
    return !!b && (this.held?.body === b || this.swarm.some((s) => s.g.body === b));
  }

  private heldGnomes(): Gnome[] {
    const all = this.held?.gnome ? [this.held.gnome] : this.swarm.map((s) => s.g);
    return all.filter((g) => g.state === 'held');
  }

  private grab(g: Gnome): void {
    ctx.gnomes.hold(g);
    ctx.state.stats.grabbed++;
  }

  private release(): void {
    // a gnome already falling into the hole stays falling
    for (const g of this.heldGnomes()) ctx.gnomes.drop(g);
    this.held = null;
    this.swarm = [];
  }

  // The ball flies as one body: every gnome gets J scaled by its mass over the heaviest member's, so all leave at
  // J / m_max (PP 2026-10-24); one gnome in hand is J / m as before.
  private throwHeld(): void {
    ctx.hud.hideHint();
    const h = this.held;
    const d = this.dir;
    const J = this.throwJ;
    const thrown = this.heldGnomes();
    const spread = thrown.length > 1 ? 0.06 : 0;
    const mMax = thrown.reduce((a, g) => Math.max(a, g.body.mass()), 0);
    const mRef = this.ignoreWeight ? WEIGHT_TIERS.normal.mass : mMax; // the arm compensates the weight, J / 1.2
    for (const g of thrown) {
      const impulse = new THREE.Vector3(d.x + rand(-spread, spread), d.y + 0.17 + rand(-spread, spread), d.z + rand(-spread, spread)).multiplyScalar((J * g.body.mass()) / mRef);
      ctx.gnomes.drop(g, impulse);
      ctx.state.stats.thrown++;
    }
    if (thrown.length && Math.random() < 0.4) ctx.audio.voice('scream', 1.4 / thrown[0].scale);
    if (h && !h.gnome) h.body.applyImpulse({ x: d.x * J, y: d.y * J + 0.17 * J, z: d.z * J }, true);
    this.held = null;
    this.swarm = [];
    this.throwCd = 0.25;
    this.grabCd = 0.4;
    this.throwKick = THROW_KICK;
    this.gunRecoil = 0;
    ctx.audio.whoosh();
  }

  // Critically damped spring as an acceleration (force = mass x acceleration): every weight class lifts the same.
  // Returns the distance to the target.
  private pull(body: RAPIER.RigidBody, target: THREE.Vector3, dt: number): number {
    const A = 45 * (1 + 0.15 * lvl('magPower'));
    const k = 2 * A;
    const c = 2 * Math.sqrt(k);
    const p = body.translation();
    const v = body.linvel();
    const m = body.mass();
    const a = new THREE.Vector3(
      k * (target.x - p.x) - c * (v.x - this.vel.x),
      k * (target.y - p.y) - c * (v.y - this.vel.y),
      k * (target.z - p.z) - c * (v.z - this.vel.z),
    );
    if (a.length() > A) a.setLength(A);
    body.applyImpulse({ x: a.x * m * dt, y: a.y * m * dt, z: a.z * m * dt }, true);
    const av = body.angvel();
    body.setAngvel({ x: av.x * 0.9, y: av.y * 0.9, z: av.z * 0.9 }, true);
    return Math.hypot(target.x - p.x, target.y - p.y, target.z - p.z);
  }

  private get holdPoint(): THREE.Vector3 {
    return this.eye.addScaledVector(this.dir, 2.2).add(tmpV.set(0, -0.3, 0));
  }

  private updateHeld(): void {
    const h = this.held;
    if (!h) return;
    if ((h.gnome && h.gnome.state !== 'held') || (h.prop && (h.prop.falling || h.prop.respawn > 0))) {
      this.held = null;
      return;
    }
    const dist = this.pull(h.body, this.holdPoint, Math.min(0.05, this.frameDt));
    if (h.crate) {
      // keep the crate upright so the gnomes stay inside
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      h.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      h.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (dist > 6) this.release();
  }

  // Magnet Gun: every gnome is pulled to the centre of a ball in front of the camera, so they pack physically;
  // the ones that do not fit stay outside, pushed out by the others, and drop after 0.4 s.
  // Heavier gnomes slip off more easily: a shorter grip distance and a random slip chance growing with mass.
  private updateSwarm(): void {
    const sw = this.swarm;
    // dropped over the hole or taken by something else
    for (let i = sw.length - 1; i >= 0; i--) if (sw[i].g.state !== 'held') sw.splice(i, 1);
    const dt = Math.min(0.05, this.frameDt);
    const centre = this.ballCentre;
    const prev = this.prevCentre;
    this.prevCentre = sw.length ? centre : null;
    if (!sw.length) return;
    // ball velocity: a gnome moving with the ball but outside it is stuck, one racing after it is only lagging
    const bv = prev && this.frameDt > 0 ? centre.clone().sub(prev).divideScalar(this.frameDt) : new THREE.Vector3();
    const R = this.ballR;
    const range = this.magReach;
    const grip = 1.6 * (1 + 0.15 * lvl('magPower')) * (R / 0.8);
    for (let i = sw.length - 1; i >= 0; i--) {
      const s = sw[i];
      this.pull(s.g.body, centre, dt);
      const p = s.g.body.translation();
      const v = s.g.body.linvel();
      const d = Math.hypot(p.x - centre.x, p.y - centre.y, p.z - centre.z);
      s.inBall = d <= R + 0.3;
      if (s.inBall) {
        s.caught = true;
        s.out = 0;
      } else if (Math.hypot(v.x - bv.x, v.y - bv.y, v.z - bv.z) < 1.5) s.out += dt;
      const lag = Math.max(0, d - R);
      const m = s.g.body.mass();
      const limit = grip / Math.pow(m, 0.7);
      let slip = s.out > 0.4;
      if (!s.caught) slip ||= lag > range + 1.5;
      else slip ||= lag > limit || Math.random() < 0.03 * m * m * dt;
      if (slip) {
        ctx.gnomes.drop(s.g);
        // a slipped gnome falls instead of flying straight back into the ball
        s.g.noGrabUntil = ctx.time + 1;
        sw.splice(i, 1);
      }
    }
  }

  private grabbable(g: Gnome): boolean {
    return isFree(g) && ctx.time >= g.noGrabUntil && g.type.id !== 'king';
  }

  private gnomeTarget(): Gnome | null {
    return this.lookAt.gnome && this.grabbable(this.lookAt.gnome) ? this.lookAt.gnome : this.coneTarget();
  }

  // Aim assist: the gnome closest to the crosshair inside the magnet cone (the Magnet Gun cone is wider).
  private coneTarget(): Gnome | null {
    return this.coneTargets()[0] ?? null;
  }

  // every grabbable gnome inside the magnet cone, closest to the crosshair first
  private coneTargets(): Gnome[] {
    const e = this.eye;
    const d = this.dir;
    const minDot = this.sweeper.gear === 'magGun' ? Math.cos(((25 + 3 * lvl('magRange')) * Math.PI) / 180) : 0.94 - 0.02 * lvl('magRange');
    const hits: { g: Gnome; dot: number }[] = [];
    ctx.gnomes.forEachNear(e, this.magReach, (g, _dist, p) => {
      if (!this.grabbable(g)) return;
      tmpV.set(p.x - e.x, p.y - e.y, p.z - e.z).normalize();
      const dot = tmpV.dot(d);
      if (dot > minDot) hits.push({ g, dot });
    });
    return hits.sort((a, b) => b.dot - a.dot).map((h) => h.g);
  }

  private kick(): void {
    this.kickCd = 0.45;
    this.kickAnim = KICK_TIME;
    this.kickPending = true;
  }

  // The kick's effect, called by updateKickLeg when the leg reaches the strike pose.
  private kickHit(): void {
    const k = 1 + lvl('kick') * 0.2;
    const d = this.dir.setY(0).normalize();
    const centre = this.position.clone().addScaledVector(d, 1.3).setY(this.position.y - 0.3);
    const radius = 1.5 * k;
    let hitAny = false;
    // Collect first: Rapier forbids changing bodies inside a query callback.
    const handles: number[] = [];
    ctx.physics.intersectionsWithShape({ x: centre.x, y: centre.y, z: centre.z }, { x: 0, y: 0, z: 0, w: 1 }, new ctx.R.Ball(radius), (col) => {
      handles.push(col.handle);
      return true;
    });
    const kicked = new Set<RAPIER.RigidBody>();
    for (const h of handles) {
      const g = ctx.gnomes.byCollider.get(h);
      const p = ctx.props.byCollider.get(h);
      const m = ctx.machines.byCollider.get(h);
      const body = g?.body ?? p?.body ?? (m?.type === 'box' ? m.body : null);
      // the crate has five colliders: kick each body only once
      if (!body || kicked.has(body)) continue;
      kicked.add(body);
      if (g) {
        if (!isFree(g)) continue;
        ctx.gnomes.ragdoll(g, 3, 'kick');
        if (Math.random() < 0.3) ctx.gnomes.say(g, ['OOF!', 'MY SPINE!', 'Not cool!', 'Yeeeet!'][Math.floor(Math.random() * 4)]);
      }
      // gnomes: base type mass, so heavy tiers fly shorter; the crate gets a softer kick
      // gnomes: one fixed kick (as for a 1.2 kg gnome), so heavier classes fly shorter; the crate gets a softer kick
      const mass = g ? 1.2 * (g.type.id === 'king' ? 0 : 1) : m ? body.mass() * 0.6 : body.mass();
      body.applyImpulse({ x: d.x * 11 * k * mass, y: 5.5 * mass, z: d.z * 11 * k * mass }, true);
      body.setAngvel({ x: rand(-8, 8), y: rand(-8, 8), z: rand(-8, 8) }, true);
      hitAny = true;
    }
    ctx.audio.kick();
    if (hitAny) {
      ctx.state.stats.kicked++;
      ctx.fx.shake(0.12);
      ctx.fx.burst(centre, 0xffffff, 8);
    }
  }

  private hotkeys(): void {
    const inp = ctx.input;
    // ten digit keys; later tools are placed from the tool wheel (Tab)
    for (let i = 0; i < Math.min(10, TOOL_IDS.length); i++) {
      const code = i === 9 ? 'Digit0' : `Digit${i + 1}`;
      if (inp.hit(code)) this.selectTool(TOOL_IDS[i]);
    }
    if (inp.hit('KeyC')) {
      const next = this.sweeper.next();
      if (next) this.setGear(next);
      else {
        ctx.hud.toast('Take a tool from the Tab wheel first (buy the Magnet Gun, the Plow Tractor or the Leaf Blower in the shop). C then switches it with your hands.', 'info');
        ctx.audio.deny();
      }
    }
    if (inp.hit('KeyB')) {
      if (lvl('laptop')) ctx.shop.open();
      else ctx.hud.toast('Walk to the PC desk next to the house (or buy the Laptop).', 'info');
    }
  }

  selectTool(type: string, rotation?: THREE.Quaternion): void {
    if (this.placing === type) {
      this.cancelPlacement();
      return;
    }
    if (ctx.machines.available(type) <= 0) {
      ctx.hud.toast(lvl(type) ? `All your ${UPGRADE_BY_ID[type].name}s are placed. X picks one up.` : `Buy a ${UPGRADE_BY_ID[type].name} in the shop first.`, 'info');
      ctx.audio.deny();
      return;
    }
    this.cancelPlacement();
    this.dropAll();
    // the gun stays in hand (it slides out while placing); the tractor and the blower are put away
    if (!this.sweeper.grabs) this.setGear('hands');
    this.placing = type;
    const { root } = machineVisual(type);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.45, depthWrite: false });
        mesh.castShadow = false;
      }
    });
    this.ghost = root;
    // by default the tool faces where you look (fans blow, belts carry and trampolines throw that way)
    if (rotation) this.ghostQuat.copy(rotation);
    else this.ghostQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw + Math.PI);
    ctx.scene.add(root);
    ctx.hud.firstUse(type);
  }

  // Any switch drops what is held and cancels placement; LMB waits for a release.
  setGear(gear: Gear): void {
    if (gear === this.sweeper.gear) return;
    this.dropAll();
    this.cancelPlacement();
    this.lmbBlocked = true;
    this.sweeper.gear = gear;
    if (gear !== 'hands') this.sweeper.lastGear = gear;
    ctx.hud.hideHint();
    if (gear !== 'hands') ctx.hud.firstUse(gear);
  }

  cancelPlacement(): void {
    ctx.hud.hideHint();
    if (this.ghost) ctx.scene.remove(this.ghost);
    this.ghost = null;
    this.placing = null;
  }

  // Free placement: the tool floats where you look; RMB + mouse turns it any way you like.
  // It rests against whatever surface the crosshair touches and turns red when it overlaps something.
  private updatePlacement(): void {
    const inp = ctx.input;
    const type = this.placing!;
    const box = machineBox(type);
    const camRight = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (inp.mouse.right) {
      const k = 0.006;
      this.ghostQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), inp.mouse.dx * k));
      this.ghostQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(camRight, inp.mouse.dy * k));
    }
    if (inp.hit('KeyR')) this.ghostQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4));
    if (inp.hit('KeyT')) this.ghostQuat.premultiply(new THREE.Quaternion().setFromAxisAngle(camRight, Math.PI / 12));
    if (inp.hit('KeyV')) this.ghostQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw + Math.PI);
    if (inp.mouse.wheel) this.ghostDist = Math.max(2.5, Math.min(14, this.ghostDist - inp.mouse.wheel * 0.5));

    const q = this.ghostQuat;
    const half = new THREE.Vector3(...box.half);
    const centreOffset = new THREE.Vector3(...box.center).applyQuaternion(q);
    const e = this.eye;
    const d = this.dir;
    const ray = new ctx.R.Ray({ x: e.x, y: e.y, z: e.z }, { x: d.x, y: d.y, z: d.z });
    // only solid things stop the tool: not gnomes, coins or what the magnet holds
    const solid = (col: RAPIER.Collider) => !ctx.gnomes.byCollider.has(col.handle) && !this.isHeldBody(col.parent());
    // tools stack on the ground, other tools, the crate, the house and the desk, never on a loose prop (chair, flamingo)
    const surface = (col: RAPIER.Collider) => solid(col) && !ctx.props.byCollider.has(col.handle);
    const hit = ctx.physics.castRayAndGetNormal(ray, this.ghostDist, true, undefined, undefined, this.collider, undefined, surface);
    const centre = new THREE.Vector3();
    const rot = { x: q.x, y: q.y, z: q.z, w: q.w };
    if (hit) {
      // push the box out of the surface along its normal by its extent in that direction (base on the hit point)
      const n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
      const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((a) => a.applyQuaternion(q));
      const extent = Math.abs(axes[0].dot(n)) * half.x + Math.abs(axes[1].dot(n)) * half.y + Math.abs(axes[2].dot(n)) * half.z;
      centre.copy(e).addScaledVector(d, hit.timeOfImpact).addScaledVector(n, extent + 0.02);
      // on a top face, drop the box from a little higher onto the thing you aim at, so it rests on its highest
      // part under the box (the belt rails, not the belt between them); something in the way above: stay put
      if (n.y > 0.7) {
        const support = hit.collider;
        const body = support.parent();
        const same = (col: RAPIER.Collider) => col.handle === support.handle || (!!body && col.parent()?.handle === body.handle);
        const from = { x: centre.x, y: centre.y + STEP_UP, z: centre.z };
        const drop = ctx.physics.castShape(from, rot, { x: 0, y: -1, z: 0 }, new ctx.R.Cuboid(half.x, half.y, half.z), 0.02, STEP_UP, true, undefined, undefined, undefined, undefined, same);
        if (drop && drop.time_of_impact > 0) centre.y = from.y - drop.time_of_impact;
      }
    } else {
      centre.copy(e).addScaledVector(d, this.ghostDist);
    }
    this.ghostPos.copy(centre).sub(centreOffset);

    // blocked when the (slightly shrunk) box overlaps anything solid, its footprint touches the hole or it leaves the yard;
    // resting on a surface leaves a 0.02 m gap, so touching from above never counts as an overlap
    let blocked = false;
    ctx.physics.intersectionsWithShape(
      { x: centre.x, y: centre.y, z: centre.z }, rot,
      new ctx.R.Cuboid(half.x * 0.92, half.y * 0.92, half.z * 0.92),
      (col) => {
        if (solid(col)) blocked = true;
        return !blocked;
      },
    );
    if (footprintOverHole(centre, half, q)) blocked = true;
    if (Math.abs(centre.x) > ctx.env.half - 0.5 || Math.abs(centre.z) > ctx.env.half - 0.5) blocked = true;
    this.ghostBlocked = blocked;

    const g = this.ghost!;
    g.position.copy(this.ghostPos);
    g.quaternion.copy(q);
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.MeshBasicMaterial).color.setHex(blocked ? 0xff5555 : 0x66ff88);
    });

    if (inp.mouse.leftPressed) {
      if (blocked) {
        ctx.audio.deny();
        return;
      }
      ctx.machines.place(type, this.ghostPos.clone(), q);
      ctx.hud.hideHint();
      ctx.audio.buy();
      ctx.fx.burst(centre, 0xffffff, 15);
      if (ctx.machines.available(type) <= 0) this.cancelPlacement();
    }
    if (inp.hit('KeyQ')) this.cancelPlacement();
    // the ghost stays out while more of the tool are left: E must still repair the tool under the crosshair
    if (inp.hit('KeyE')) {
      const m = this.lookAt.machine;
      if (this.lookAt.switch) ctx.factory.toggle();
      else if (m && needsRepair(m)) ctx.machines.repair(m);
    }
  }

  private updateCamera(dt: number): void {
    const cam = ctx.camera;
    const booze = ctx.buffs.active('booze');
    const bobY = this.grounded ? Math.sin(this.bob) * 0.05 : 0;
    cam.position.copy(this.eye).y += bobY;
    ctx.fx.shakeOffset(this.shakeE);
    const wob = booze ? Math.sin(ctx.time * 1.7) * 0.12 : 0;
    // throw: the view kicks up and the FOV widens, both settle with outCubic
    const kick = 1 - outCubic(1 - this.throwKick / THROW_KICK);
    this.throwKick = Math.max(0, this.throwKick - dt);
    const aim = kick * THROW_PITCH;
    tmpE.set(this.pitch + aim + this.shakeE.x + (booze ? Math.sin(ctx.time * 1.1) * 0.05 : 0), this.yaw + this.shakeE.y, this.shakeE.z + wob, 'YXZ');
    cam.quaternion.setFromEuler(tmpE);
    const comboFov = Math.min(10, ctx.hole.combo * 0.12);
    const targetFov = 75 + comboFov + (booze ? Math.sin(ctx.time * 2.3) * 8 : 0) + (ctx.buffs.active('zoom') ? 6 : 0);
    this.fov = THREE.MathUtils.damp(this.fov, targetFov, 4, dt);
    cam.fov = this.fov + kick * THROW_FOV;
    cam.updateProjectionMatrix();
  }

  private updateKickLeg(dt: number): void {
    this.kickAnim -= dt;
    if (this.kickPending && KICK_TIME - this.kickAnim >= KICK_BACK + KICK_HIT) {
      this.kickPending = false;
      this.kickHit();
    }
    this.kickLeg.visible = this.kickAnim > 0;
    if (this.kickAnim > 0) {
      // swing: 0 = rest, 1 = full kick; pull back below 0, strike, return overshooting past rest
      const t = KICK_TIME - this.kickAnim;
      const s =
        t < KICK_BACK ? -0.25 * inQuad(t / KICK_BACK)
        : t < KICK_BACK + KICK_HIT ? -0.25 + 1.25 * inQuad((t - KICK_BACK) / KICK_HIT)
        : 1 - outBack((t - KICK_BACK - KICK_HIT) / (KICK_TIME - KICK_BACK - KICK_HIT));
      this.kickLeg.position.set(0.15, -0.9 + s * 0.35, -0.4 - s * 0.5);
      this.kickLeg.rotation.x = -0.8 + s * 0.6;
    }
  }

  dropAll(): void {
    this.release();
  }
}
