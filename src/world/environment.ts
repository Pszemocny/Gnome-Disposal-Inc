import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ctx, G, groups, rand } from '../core/context';
import { LAND } from '../data/land';
import { holeLevel } from '../data/holeLevels';
import * as M from './models';
import { tex } from './textures';
import { inOutSine } from '../core/ease';
import { lowfx, prefs } from '../core/settings';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DAY_TOP = new THREE.Color(0x4f9ee8);
const DAY_BOTTOM = new THREE.Color(0xcfe8ff);
const NIGHT_TOP = new THREE.Color(0x05061a);
const NIGHT_BOTTOM = new THREE.Color(0x1a1f3a);
const WHITE = new THREE.Color(0xffffff);
const PURPLE = new THREE.Color(0xc77aff);
const GOLD = new THREE.Color(0xffd23f);
const tmpC = new THREE.Color();
// the sun sits at this offset from the player; its shadow camera axes (three's lookAt with up = +Y) never change
const SUN_OFFSET = new THREE.Vector3(22, 32, 14);
const SUN_Z = SUN_OFFSET.clone().normalize();
const SUN_X = new THREE.Vector3(0, 1, 0).cross(SUN_Z).normalize();
const SUN_Y = SUN_Z.clone().cross(SUN_X);
const tmpV = new THREE.Vector3();
export const HOLE_SLIDE_TIME = 1; // seconds the hole takes to move to a new Land's spot

export class Environment {
  holeRadius = 1.6;
  hole = new THREE.Vector3(); // centre of the hole on the ground
  half = 22;
  deskPos = new THREE.Vector3(7.5, 0, -13);
  night = 0; // 0 day .. 1 night
  nightShade = 0; // the night the player sees: 0 on Low quality, where the look stays day
  dayClock = 0;

  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private groundMesh: THREE.Mesh | null = null;
  private holeGroup = new THREE.Group();
  private swirl!: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private spinBoost = 0; // seconds left of the fast swirl
  private groundBodies: RAPIER.RigidBody[] = [];
  private wallBodies: RAPIER.RigidBody[] = [];
  private fenceGroup = new THREE.Group();
  private trees: THREE.InstancedMesh;
  private bushes: THREE.InstancedMesh;
  private signs: THREE.Sprite[] = [];
  private stars: THREE.Points;
  private fireflies: THREE.Points;
  private lamp: THREE.PointLight;

  constructor() {
    const { scene } = ctx;
    this.hemi = new THREE.HemisphereLight(0xdff0ff, 0x4a6a2a, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -40;
    sc.right = sc.top = 40;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: DAY_TOP.clone() }, bottom: { value: DAY_BOTTOM.clone() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.2,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), this.skyMat);
    sky.renderOrder = -1;
    scene.add(sky);
    scene.fog = new THREE.Fog(0xcfe8ff, 60, 220);

    const cloudGeo = M.cloudGeometry();
    const cloudMat = M.vcMat({ roughness: 1, emissive: 0x666666 });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat);
      const a = rand(0, Math.PI * 2);
      const d = rand(80, 170);
      c.position.set(Math.cos(a) * d, rand(45, 70), Math.sin(a) * d);
      c.scale.setScalar(rand(0.8, 2));
      c.rotation.y = rand(0, 6);
      scene.add(c);
    }

    // stars and fireflies for the night
    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(0.15, 1), rand(-1, 1)).normalize().multiplyScalar(380);
      sp.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(this.stars);
    const ffGeo = new THREE.BufferGeometry();
    ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(120 * 3), 3));
    this.fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xd8ff6a, size: 0.18, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(this.fireflies);

    // the player's house and the PC desk
    const house = M.houseGroup(tex('plaster_diff', 3, 1.5), tex('roof_diff', 0.3, 0.3));
    house.position.set(0, 0, -27.5);
    scene.add(house);
    this.fixedCuboid(0, 3, -27.5, 7, 3, 4.5);

    // PC desk facing the hole, with a glowing screen and a SHOP sign
    const deskYaw = Math.atan2(-this.deskPos.x, -this.deskPos.z);
    const desk = new THREE.Group();
    const deskMesh = new THREE.Mesh(M.deskGeometry(), M.vcMat());
    deskMesh.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.6), new THREE.MeshBasicMaterial({ color: 0x3aff8a }));
    screen.position.set(0, 1.38, 0.26);
    desk.add(deskMesh, screen);
    desk.position.copy(this.deskPos);
    desk.rotation.y = deskYaw;
    scene.add(desk);
    this.fixedCuboid(this.deskPos.x, 0.6, this.deskPos.z, 0.9, 0.6, 0.9);
    const shopSign = M.labelSprite('SHOP', 'press E here', '#3aff8a');
    shopSign.position.set(this.deskPos.x, 4.8, this.deskPos.z);
    scene.add(shopSign);
    this.signs.push(shopSign);
    this.lamp = new THREE.PointLight(0xffd29a, 0, 25, 1.5);
    this.lamp.position.set(this.deskPos.x, 3, this.deskPos.z + 1);
    scene.add(this.lamp);

    this.trees = new THREE.InstancedMesh(M.treeGeometry(), M.vcMat({ map: tex('mottle') }), 700);
    this.trees.count = 0;
    scene.add(this.trees);
    this.bushes = new THREE.InstancedMesh(M.bushGeometry(), M.vcMat({ map: tex('mottle') }), 300);
    this.bushes.count = 0;
    scene.add(this.bushes);

    const tufts = new THREE.InstancedMesh(M.grassTuftGeometry(), M.vcMat(), 4000);
    const shrooms = new THREE.InstancedMesh(M.wildMushroomGeometry(), M.vcMat(), 120);
    const m = new THREE.Matrix4();
    // no grass tufts or mushrooms anywhere the hole will ever be, on any land
    const onHolePath = (x: number, z: number) =>
      LAND.some((_, t) => distToSegment(new THREE.Vector3(x, 0, z), Environment.holeCenterFor(1, t), Environment.holeCenterFor(12, t)) < 6.8);
    for (let i = 0; i < 4000; i++) {
      const x = rand(-70, 70);
      const z = rand(-70, 70);
      if (onHolePath(x, z)) {
        i--;
        continue;
      }
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(0, 6), 0)), new THREE.Vector3().setScalar(rand(0.45, 1.0)));
      tufts.setMatrixAt(i, m);
    }
    for (let i = 0; i < 120; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(10, 70);
      if (onHolePath(Math.cos(a) * d, Math.sin(a) * d)) {
        i--;
        continue;
      }
      m.compose(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3().setScalar(rand(0.6, 1.6)));
      shrooms.setMatrixAt(i, m);
    }
    scene.add(tufts, shrooms);

    scene.add(this.holeGroup, this.fenceGroup);
    this.rebuildHole();
    this.rebuildLand();
  }

  private fixedCuboid(x: number, y: number, z: number, hx: number, hy: number, hz: number, member = G.STATIC, keep = true): RAPIER.RigidBody {
    const { R, physics } = ctx;
    const body = physics.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
    physics.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setCollisionGroups(groups(member, 0xffff)).setFriction(0.9), body);
    if (!keep) {
      body.userData = new THREE.Vector3(x, y, z); // built position, the Land slide offsets it
      this.groundBodies.push(body);
    }
    return body;
  }

  // Hole centre for a level on a land tier: the land's anchor, then 1.2 m per level further from the gnome factory.
  static holeCenterFor(level: number, land = ctx.state.land): THREE.Vector3 {
    const [x, z] = LAND[land].anchor;
    const anchor = new THREE.Vector3(x, 0, z);
    const away = new THREE.Vector3(x + 7.5, 0, z + 13).normalize();
    return anchor.addScaledVector(away, (level - 1) * 1.2);
  }

  get sliding(): boolean {
    return this.slide !== null;
  }

  // Jump to the end of a running Land slide (a level-up during the slide rebuilds the hole at once).
  finishSlide(): void {
    if (this.slide) this.rebuildHole();
  }

  holeDist(x: number, z: number): number {
    return Math.hypot(x - this.hole.x, z - this.hole.z);
  }

  rebuildHole(): void {
    const r = holeLevel(ctx.state.holeLevel).radius;
    this.holeRadius = r;
    this.slide = null;
    this.hole.copy(Environment.holeCenterFor(ctx.state.holeLevel));
    this.built.copy(this.hole);
    const { x: cx, z: cz } = this.hole;
    const { physics } = ctx;
    for (const b of this.groundBodies) physics.removeRigidBody(b);
    this.groundBodies = [];
    // Four ground slabs leave a square gap inscribed in the visible circle.
    const s = r * 0.7071;
    const big = 200;
    this.fixedCuboid(cx, -0.5, cz - s - big, big, 0.5, big, G.GROUND, false);
    this.fixedCuboid(cx, -0.5, cz + s + big, big, 0.5, big, G.GROUND, false);
    this.fixedCuboid(cx - s - big, -0.5, cz, big, 0.5, s, G.GROUND, false);
    this.fixedCuboid(cx + s + big, -0.5, cz, big, 0.5, s, G.GROUND, false);

    if (this.groundMesh) {
      ctx.scene.remove(this.groundMesh);
      this.groundMesh.geometry.dispose();
    }
    const shape = new THREE.Shape();
    shape.moveTo(-300, -300).lineTo(300, -300).lineTo(300, 300).lineTo(-300, 300).lineTo(-300, -300);
    const holePath = new THREE.Path();
    // shape space (x, y) becomes world (x, -z) after rotateX(-90°)
    holePath.absarc(cx, -cz, r, 0, Math.PI * 2, true);
    shape.holes.push(holePath);
    const geo = new THREE.ShapeGeometry(shape, 48);
    geo.rotateX(-Math.PI / 2);
    // the grass dries out towards late summer as the hole grows
    const grass = new THREE.Color(0xc8f0a0).lerp(new THREE.Color(0xe8d890), (ctx.state.holeLevel - 1) / 11);
    this.groundMesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: tex('grass_diff', 1 / 6), color: grass, roughness: 1 }),
    );
    this.groundMesh.receiveShadow = true;
    ctx.scene.add(this.groundMesh);

    // tube and swirl get a new geometry and material every level; the worn ground frees its own (its material is shared)
    for (const o of this.holeGroup.children) {
      if (o instanceof THREE.Mesh && o !== this.wear) {
        o.geometry.dispose();
        o.material.dispose();
      }
    }
    this.holeGroup.clear();
    const depth = 4.5;
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.92, depth, 48, 6, true),
      new THREE.MeshStandardMaterial({ map: tex('dirt_diff', 4, 1), color: 0x8a7060, side: THREE.BackSide, roughness: 1 }),
    );
    tube.position.y = -depth / 2;
    this.swirl = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.99, 48),
      new THREE.MeshBasicMaterial({ map: (swirlTex ??= makeSwirlTexture()), fog: false }),
    );
    this.swirl.rotation.x = -Math.PI / 2;
    // the glowing blue vortex sits just below the ground
    this.swirl.position.y = -0.9;
    const glow = new THREE.PointLight(0x5fd0ff, 8, r * 4, 1.6);
    glow.position.y = -0.3;
    this.holeGroup.add(tube, this.swirl, glow, this.wornGround(r));
    this.holeGroup.position.copy(this.hole);
  }

  // A bought Land moves the hole to the new land's anchor: it slides there, ground slabs and grass gap with it.
  private slide: { from: THREE.Vector3; to: THREE.Vector3; t: number; dust: number } | null = null;
  private built = new THREE.Vector3(); // the centre the ground slabs and the grass mesh were built around

  private updateSlide(dt: number): void {
    const s = this.slide;
    if (!s) return;
    s.t += dt;
    const k = Math.min(1, s.t / HOLE_SLIDE_TIME);
    this.hole.lerpVectors(s.from, s.to, inOutSine(k));
    const dx = this.hole.x - this.built.x;
    const dz = this.hole.z - this.built.z;
    this.holeGroup.position.copy(this.hole);
    this.groundMesh?.position.set(dx, 0, dz);
    for (const b of this.groundBodies) {
      const base = b.userData as THREE.Vector3;
      b.setTranslation({ x: base.x + dx, y: base.y, z: base.z + dz }, true);
    }
    s.dust -= dt;
    if (s.dust <= 0) {
      s.dust = 0.15;
      ctx.fx.dust(this.hole.clone().setY(0.1), 0.8);
    }
    if (k >= 1) {
      this.rebuildHole();
      ctx.fx.dust(this.hole.clone().setY(0.1), 1);
      ctx.fx.shake(0.3);
    }
  }

  // Trampled dirt around the hole and a trail from the factory's landing spot: soft patches in one mesh, local to the hole.
  private wear: THREE.Mesh | null = null;

  private wornGround(r: number): THREE.Mesh {
    this.wear?.geometry.dispose();
    const patches: THREE.BufferGeometry[] = [];
    const patch = (x: number, z: number, size: number) =>
      patches.push(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).rotateY(rand(0, Math.PI * 2)).translate(x, 0, z));
    // ring: a patch's soft edge ends at size/2, so its centre stays at least that far outside the hole
    const ring = 16;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + rand(-0.15, 0.15);
      const size = rand(2, 3.5);
      const d = r + size / 2 + rand(0.1, 1.2);
      patch(Math.cos(a) * d, Math.sin(a) * d, size);
    }
    const landing = new THREE.Vector3(-7.5, 0, -13).add(new THREE.Vector3(7.5, 0, 13).normalize().multiplyScalar(6.5)).sub(this.hole);
    // trail patches stop where they would reach over the hole
    for (let k = 0; k < 8; k++) {
      const size = rand(2, 2.8);
      const p = landing.clone().multiplyScalar(1 - k / 8);
      if (p.length() - size / 2 < r + 0.45) break;
      patch(p.x + rand(-0.3, 0.3), p.z + rand(-0.3, 0.3), size);
    }
    wearMat ??= new THREE.MeshStandardMaterial({ map: tex('dirt_diff'), alphaMap: makeWearAlpha(), color: 0xfff0d8, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.wear = new THREE.Mesh(mergeGeometries(patches, false)!, wearMat);
    this.wear.position.y = 0.02;
    this.wear.receiveShadow = true;
    return this.wear;
  }

  rebuildLand(): void {
    const tier = LAND[ctx.state.land];
    this.half = tier.half;
    const h = this.half;
    // fog starts just past the fence, so the forest ring fades with distance on every land
    const fog = ctx.scene.fog as THREE.Fog;
    fog.near = h + 15;
    fog.far = h + 180;
    const { physics } = ctx;
    for (const b of this.wallBodies) physics.removeRigidBody(b);
    this.wallBodies = [];
    const wall = (x: number, z: number, hx: number, hz: number) => {
      const b = this.fixedCuboid(x, 4, z, hx, 4.5, hz);
      this.wallBodies.push(b);
    };
    wall(0, -h - 0.5, h + 1, 0.5);
    wall(0, h + 0.5, h + 1, 0.5);
    wall(-h - 0.5, 0, 0.5, h + 1);
    wall(h + 0.5, 0, 0.5, h + 1);

    this.fenceGroup.clear();
    const postsPerSide = Math.ceil((h * 2) / 2);
    const posts = new THREE.InstancedMesh(M.postGeometry(), M.vcMat({ map: tex('wood_diff') }), postsPerSide * 4 + 4);
    posts.castShadow = true;
    const m = new THREE.Matrix4();
    let i = 0;
    for (let s = 0; s < 4; s++) {
      for (let k = 0; k <= postsPerSide; k++) {
        if (k === postsPerSide && s % 2 === 1) continue;
        const t = -h + (k / postsPerSide) * 2 * h;
        const [x, z] = s === 0 ? [t, -h] : s === 1 ? [t, h] : s === 2 ? [-h, t] : [h, t];
        m.makeTranslation(x, 0, z);
        if (i < posts.count) posts.setMatrixAt(i++, m);
      }
    }
    posts.count = i;
    const railMat = new THREE.MeshStandardMaterial({ map: tex('wood_diff', h / 2, 0.1), color: 0xf0e6d2, roughness: 0.9 });
    for (const y of [0.4, 0.9]) {
      for (const [x, z, w, d] of [[0, -h, 2 * h, 0.06], [0, h, 2 * h, 0.06], [-h, 0, 0.06, 2 * h], [h, 0, 0.06, 2 * h]] as const) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), railMat);
        rail.position.set(x, y, z);
        rail.castShadow = true;
        this.fenceGroup.add(rail);
      }
    }
    this.fenceGroup.add(posts);

    // forest ring outside the fence
    let n = 0;
    let nb = 0;
    const q = new THREE.Quaternion();
    for (let t = 0; t < 1400 && n < 700; t++) {
      const x = rand(-h - 40, h + 40);
      const z = rand(-h - 40, h + 40);
      const out = Math.max(Math.abs(x), Math.abs(z));
      if (out < h + 3) continue;
      if (Math.abs(x) < 10 && z < -h && z > -h - 12) continue;
      q.setFromEuler(new THREE.Euler(0, rand(0, 6), 0));
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3().setScalar(rand(0.8, 1.9)));
      this.trees.setMatrixAt(n++, m);
      if (nb < 300 && Math.random() < 0.4) {
        m.compose(new THREE.Vector3(x + rand(-3, 3), 0, z + rand(-3, 3)), q, new THREE.Vector3().setScalar(rand(0.6, 1.4)));
        this.bushes.setMatrixAt(nb++, m);
      }
    }
    this.trees.count = n;
    this.bushes.count = nb;
    this.trees.instanceMatrix.needsUpdate = true;
    this.bushes.instanceMatrix.needsUpdate = true;
    this.trees.computeBoundingSphere();
    this.bushes.computeBoundingSphere();

    // the hole runs away to this land's spot (no-op when loading a save: rebuildHole already put it there)
    const to = Environment.holeCenterFor(ctx.state.holeLevel);
    if (to.distanceTo(this.hole) > 0.01) {
      const from = this.hole.clone();
      ctx.fx.dust(from.clone().setY(0.1), 1);
      ctx.audio.rumble(HOLE_SLIDE_TIME);
      this.slide = { from, to, t: 0, dust: 0.15 };
      if (ctx.hole.carry(from, this.holeRadius, to, this.holeRadius, HOLE_SLIDE_TIME)) {
        ctx.hud.toast('The hole moved! Tools in its way went back to your inventory.', 'info');
      }
    }
  }

  addSign(s: THREE.Sprite): void {
    this.signs.push(s);
    ctx.scene.add(s);
  }

  // A random point on the fence line, for gnomes that run away or sneak in.
  edgePoint(): THREE.Vector3 {
    const h = this.half - 1.5;
    const t = rand(-h, h);
    const side = Math.floor(Math.random() * 4);
    return side === 0 ? new THREE.Vector3(t, 0.7, -h) : side === 1 ? new THREE.Vector3(t, 0.7, h) : side === 2 ? new THREE.Vector3(-h, 0.7, t) : new THREE.Vector3(h, 0.7, t);
  }

  update(dt: number): void {
    this.updateSlide(dt);
    const p = ctx.player.position;
    // move the shadow camera in whole shadow-map texels (also along its view axis, which shifts the stored depths):
    // a sub-texel move makes still shadow edges crawl
    const sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const snap = (x: number) => Math.round(x / texel) * texel - x;
    const t = tmpV.set(p.x, 0, p.z);
    t.addScaledVector(SUN_X, snap(t.dot(SUN_X))).addScaledVector(SUN_Y, snap(t.dot(SUN_Y))).addScaledVector(SUN_Z, snap(t.dot(SUN_Z)));
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).add(SUN_OFFSET);
    this.spinBoost = Math.max(0, this.spinBoost - dt);
    this.swirl.rotation.z -= dt * (0.6 + ctx.state.holeLevel * 0.12 + this.spinBoost * 5);
    // from combo 10 the vortex tints blue -> purple -> gold (white keeps the texture's own blue)
    const combo = ctx.hole.combo;
    const k = combo >= 10 ? Math.min(1, combo / 60) : 0;
    const tint = k < 0.5 ? tmpC.copy(WHITE).lerp(PURPLE, k * 2) : tmpC.copy(PURPLE).lerp(GOLD, k * 2 - 1);
    this.swirl.material.color.lerp(tint, 1 - Math.exp(-4 * dt));
    for (const [i, s] of this.signs.entries()) s.position.y = (s.userData.baseY ??= s.position.y) + Math.sin(ctx.time * 2 + i) * 0.12;

    // day/night cycle from hole level 6
    let target = 0;
    if (ctx.state.holeLevel >= 6) {
      this.dayClock = (this.dayClock + dt) % 240;
      const t = this.dayClock / 240;
      target = t > 0.6 ? Math.min(1, (t - 0.6) * 10, (1 - t) * 10) : 0;
    }
    this.night = THREE.MathUtils.damp(this.night, target, 0.8, dt);
    this.nightShade = lowfx || prefs.quality === 'low' ? 0 : this.night;
    const n = this.nightShade;
    (this.skyMat.uniforms.top.value as THREE.Color).copy(DAY_TOP).lerp(NIGHT_TOP, n);
    (this.skyMat.uniforms.bottom.value as THREE.Color).copy(DAY_BOTTOM).lerp(NIGHT_BOTTOM, n);
    (ctx.scene.fog as THREE.Fog).color.copy(DAY_BOTTOM).lerp(NIGHT_BOTTOM, n);
    this.sun.intensity = 2.6 * (1 - n) + 0.25 * n;
    this.sun.color.setHex(n > 0.5 ? 0x9ab0ff : 0xfff2d8);
    this.hemi.intensity = 0.9 * (1 - n) + 0.35 * n;
    this.lamp.intensity = 25 * n;
    (this.stars.material as THREE.PointsMaterial).opacity = n;
    const ffm = this.fireflies.material as THREE.PointsMaterial;
    ffm.opacity = n;
    if (n > 0.05) {
      const pos = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
      const tt = ctx.time;
      for (let i = 0; i < pos.count; i++) {
        const a = i * 12.9898;
        pos.setXYZ(i, Math.sin(a) * this.half * 0.9 + Math.sin(tt * 0.3 + a) * 2, 1 + Math.sin(tt * 0.7 + a * 3) * 0.6 + (i % 3), Math.cos(a * 1.7) * this.half * 0.9 + Math.cos(tt * 0.4 + a) * 2);
      }
      pos.needsUpdate = true;
    }
  }

  // An eaten gnome: the swirl spins faster for a second (no rim, PP 2026-10-20).
  holePulse(): void {
    this.spinBoost = 1;
  }

  get isNight(): boolean {
    return this.night > 0.6;
  }
}

function distToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

// one swirl texture for every hole level; a new one per rebuild stayed on the GPU
let swirlTex: THREE.CanvasTexture | undefined;
let wearMat: THREE.MeshStandardMaterial | undefined;

// Round soft-edged alpha for the worn-ground patches (alphaMap reads the green channel).
function makeWearAlpha(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  rg.addColorStop(0, '#999999');
  rg.addColorStop(0.5, '#666666');
  rg.addColorStop(1, '#000000');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeSwirlTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(128, 128, 5, 128, 128, 128);
  rg.addColorStop(0, '#e8fbff');
  rg.addColorStop(0.35, '#5fd0ff');
  rg.addColorStop(0.8, '#1a5aa8');
  rg.addColorStop(1, '#0a2a60');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 4;
  for (let arm = 0; arm < 4; arm++) {
    g.beginPath();
    for (let k = 0; k < 120; k++) {
      const a = arm * (Math.PI / 2) + k * 0.06;
      const r = k * 1.0;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
