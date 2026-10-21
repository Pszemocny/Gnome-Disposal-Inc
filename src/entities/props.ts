import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, drawPose, G, groups, savePose } from '../core/context';
import * as M from '../world/models';
import { tex } from '../world/textures';
import { outBack } from '../core/ease';
import { LETTER_SPOTS } from '../data/letters';

export interface Prop {
  kind: 'chair' | 'flamingo' | 'letter';
  letter?: string;
  pop: number; // seconds since the letter (re)appeared: 0.25 s scale-in
  stuck: number; // seconds a letter has rested high up out of reach (house or factory top)
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  home: THREE.Vector3;
  falling: boolean;
  respawn: number;
  prevPos: THREE.Vector3;
  prevRot: THREE.Quaternion;
}

const NORMAL = groups(G.PROP, 0xffff);
const NONE = groups(G.PROP, 0);
const GOLD = 0xffd23f;
const POP_TIME = 0.25;

export class Props {
  list: Prop[] = [];
  byCollider = new Map<number, Prop>();
  shovel: THREE.Mesh | null = null;
  private shovelPos = new THREE.Vector3(-20.4, 0.15, 20.6);

  constructor() {
    this.add('chair', this.randomSpot());
    this.add('flamingo', new THREE.Vector3(-17, 0.75, -6));
    this.add('flamingo', new THREE.Vector3(-18, 0.75, -4.5));
    this.add('flamingo', new THREE.Vector3(-16.2, 0.75, -3.8));
    // every letter not eaten yet, also on lands not bought: those lie beyond the fence until the land is bought
    for (const s of LETTER_SPOTS) if (!ctx.state.secrets.includes(`letter-${s.ch}`)) this.add('letter', new THREE.Vector3(s.x, 0.6, s.z), s.ch);
    if (!ctx.state.secrets.includes('shovel')) {
      this.shovel = new THREE.Mesh(M.shovelGeometry(), M.vcMat({ metalness: 0.8, roughness: 0.2, emissive: 0x332200 }));
      this.shovel.position.copy(this.shovelPos);
      this.shovel.rotation.set(0.3, 0.4, 1.35);
      // gold metal only, no glow: the shovel and the letters do not shine (PP 2026-10-21 "ma nie swiecic")
      ctx.scene.add(this.shovel);
    }
    const bush = new THREE.Mesh(M.bushGeometry(), M.vcMat({ map: tex('mottle') }));
    bush.position.set(-20.6, 0, 20.9);
    bush.scale.setScalar(1.1);
    bush.castShadow = true;
    ctx.scene.add(bush);
  }

  // Somewhere in the yard, away from the hole, the factory and the shop PC.
  private randomSpot(): THREE.Vector3 {
    const factory = new THREE.Vector3(-7.5, 0, -13);
    for (let i = 0; i < 50; i++) {
      const p = ctx.env.randomPoint(3, 0.5);
      if (ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius + 4) continue;
      if (Math.hypot(p.x - factory.x, p.z - factory.z) < 8) continue;
      if (Math.hypot(p.x - ctx.env.deskPos.x, p.z - ctx.env.deskPos.z) < 4) continue;
      return p;
    }
    return new THREE.Vector3(12, 0.5, 12);
  }

  private add(kind: Prop['kind'], pos: THREE.Vector3, letter?: string): void {
    const { R, physics, scene } = ctx;
    let body: RAPIER.RigidBody;
    let collider: RAPIER.Collider;
    let mesh: THREE.Mesh;
    if (kind === 'letter') {
      mesh = new THREE.Mesh(M.letterGeometry(letter!), M.vcMat({ metalness: 0.8, roughness: 0.2, emissive: 0x332200 }));
      mesh.scale.setScalar(0);
      // physics like a gnome (PP): no dominance group, so gnomes push letters; the gnome's mass, damping, friction and bounce.
      // Upright and facing the middle of the yard, so it reads from inside the fence.
      body = physics.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(pos.x, pos.y, pos.z)
          .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(-pos.x, -pos.z), 0)))
          .setLinearDamping(0.15)
          .setAngularDamping(0.6),
      );
      collider = physics.createCollider(R.ColliderDesc.cuboid(0.35, 0.49, 0.08).setMass(1).setFriction(0.7).setRestitution(0.15).setCollisionGroups(NORMAL), body);
      ctx.fx.burst(pos, GOLD, 12);
    } else {
      mesh = new THREE.Mesh(kind === 'chair' ? M.armchairGeometry() : M.flamingoGeometry(), M.vcMat());
      // dominance 1: gnomes cannot push garden props around, only the player and kicks can
      body = physics.createRigidBody(R.RigidBodyDesc.dynamic().setDominanceGroup(1).setTranslation(pos.x, pos.y, pos.z).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, kind === 'chair' ? 0.6 : Math.random() * 6, 0))));
      const desc = kind === 'chair' ? R.ColliderDesc.cuboid(0.55, 0.45, 0.5).setMass(8) : R.ColliderDesc.cuboid(0.18, 0.5, 0.25).setMass(1.5);
      collider = physics.createCollider(desc.setCollisionGroups(NORMAL).setFriction(0.8), body);
    }
    mesh.castShadow = true;
    scene.add(mesh);
    const p: Prop = { kind, letter, pop: 0, stuck: 0, mesh, body, collider, home: pos.clone(), falling: false, respawn: 0, prevPos: new THREE.Vector3(), prevRot: new THREE.Quaternion() };
    savePose(p, body);
    this.list.push(p);
    this.byCollider.set(collider.handle, p);
  }

  savePoses(): void {
    for (const p of this.list) savePose(p, p.body);
  }

  update(dt: number): void {
    const r = ctx.env.holeRadius;
    for (const p of this.list) {
      if (p.respawn > 0) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          if (p.kind === 'chair') p.home = this.randomSpot();
          p.body.setEnabled(true);
          p.body.setTranslation({ x: p.home.x, y: p.home.y + 2, z: p.home.z }, true);
          savePose(p, p.body);
          p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          p.collider.setCollisionGroups(NORMAL);
          p.mesh.visible = true;
          p.falling = false;
        }
        continue;
      }
      const t = p.body.translation();
      drawPose(p, p.body, p.mesh.position, p.mesh.quaternion);
      if (!p.falling && ctx.env.holeDist(t.x, t.z) < r && t.y < 1.5) {
        p.falling = true;
        p.collider.setCollisionGroups(NONE);
      }
      if (p.falling && t.y < -2.6) {
        if (p.kind === 'letter') {
          ctx.hole.consumeLetter(p.letter!);
          p.respawn = Infinity; // an eaten letter never comes back (once per save); `falling` stays true
        } else {
          ctx.hole.consumeProp(p.kind);
          p.respawn = 45;
        }
        p.body.setEnabled(false);
        p.mesh.visible = false;
        continue;
      }
      // a letter must stay reachable (the word must always be completable, PP): thrown over the fence, or resting
      // on the factory top for 3 s, it goes home (the house stands beyond the back fence). A letter of a land not
      // reached yet lies beyond the fence at home.
      let lost = false;
      if (p.kind === 'letter') {
        p.pop += dt;
        p.mesh.scale.setScalar(outBack(Math.min(1, p.pop / POP_TIME)));
        const v = p.body.linvel();
        // nothing in the hands: a held crate can carry the letter, and a held letter is not resting
        const high = !p.falling && !ctx.player.held && t.y > 2.5 && Math.hypot(v.x, v.y, v.z) < 0.2;
        p.stuck = high ? p.stuck + dt : 0;
        const outside = !ctx.env.inside(t.x, t.z, -1) && Math.hypot(t.x - p.home.x, t.z - p.home.z) > 2;
        lost = outside || p.stuck > 3;
      }
      if (t.y < -10 || Math.abs(t.x) > 300 || lost) {
        // a gold burst where the letter vanishes, then it pops in at home
        if (p.kind === 'letter') ctx.fx.burst(new THREE.Vector3(t.x, t.y, t.z), GOLD, 12);
        p.body.setTranslation({ x: p.home.x, y: p.home.y + 2, z: p.home.z }, true);
        savePose(p, p.body);
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (p.kind === 'letter') {
          p.stuck = 0;
          p.pop = 0;
          p.mesh.scale.setScalar(0);
          ctx.fx.burst(p.home, GOLD, 12);
        }
      }
    }
    if (this.shovel) {
      this.shovel.position.y = 0.15 + Math.sin(ctx.time * 2) * 0.03;
      if (ctx.player.position.distanceTo(this.shovelPos) < 2.6 && ctx.input.hit('KeyE')) this.takeShovel();
    }
  }

  nearShovel(): boolean {
    return !!this.shovel && ctx.player.position.distanceTo(this.shovelPos) < 2.6;
  }

  private takeShovel(): void {
    if (!this.shovel) return;
    ctx.scene.remove(this.shovel);
    this.shovel = null;
    ctx.state.secrets.push('shovel');
    ctx.achievements.unlock('shovel');
    ctx.hud.toast('You found the GOLDEN SHOVEL! +10% value forever. The ground rumbles...', 'secret');
    ctx.events.start('rain');
  }
}
