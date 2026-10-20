import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, drawPose, G, groups, rand, savePose } from '../core/context';
import * as M from '../world/models';
import { tex } from '../world/textures';

export interface Prop {
  kind: 'chair' | 'flamingo';
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
    if (!ctx.state.secrets.includes('shovel')) {
      this.shovel = new THREE.Mesh(M.shovelGeometry(), M.vcMat({ metalness: 0.8, roughness: 0.2, emissive: 0x332200 }));
      this.shovel.position.copy(this.shovelPos);
      this.shovel.rotation.set(0.3, 0.4, 1.35);
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
    const h = ctx.env.half - 3;
    const factory = new THREE.Vector3(-7.5, 0, -13);
    for (let i = 0; i < 50; i++) {
      const p = new THREE.Vector3(rand(-h, h), 0.5, rand(-h, h));
      if (ctx.env.holeDist(p.x, p.z) < ctx.env.holeRadius + 4) continue;
      if (Math.hypot(p.x - factory.x, p.z - factory.z) < 8) continue;
      if (Math.hypot(p.x - ctx.env.deskPos.x, p.z - ctx.env.deskPos.z) < 4) continue;
      return p;
    }
    return new THREE.Vector3(12, 0.5, 12);
  }

  private add(kind: Prop['kind'], pos: THREE.Vector3): void {
    const { R, physics, scene } = ctx;
    const mesh = new THREE.Mesh(kind === 'chair' ? M.armchairGeometry() : M.flamingoGeometry(), M.vcMat());
    mesh.castShadow = true;
    scene.add(mesh);
    // dominance 1: gnomes cannot push garden props around, only the player and kicks can
    const body = physics.createRigidBody(R.RigidBodyDesc.dynamic().setDominanceGroup(1).setTranslation(pos.x, pos.y, pos.z).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, kind === 'chair' ? 0.6 : Math.random() * 6, 0))));
    const desc = kind === 'chair' ? R.ColliderDesc.cuboid(0.55, 0.45, 0.5).setMass(8) : R.ColliderDesc.cuboid(0.18, 0.5, 0.25).setMass(1.5);
    const collider = physics.createCollider(desc.setCollisionGroups(NORMAL).setFriction(0.8), body);
    const p: Prop = { kind, mesh, body, collider, home: pos.clone(), falling: false, respawn: 0, prevPos: new THREE.Vector3(), prevRot: new THREE.Quaternion() };
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
        ctx.hole.consumeProp(p.kind);
        p.body.setEnabled(false);
        p.mesh.visible = false;
        p.respawn = 45;
      }
      if (t.y < -10 || Math.abs(t.x) > 300) {
        p.body.setTranslation({ x: p.home.x, y: p.home.y + 2, z: p.home.z }, true);
        savePose(p, p.body);
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
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
