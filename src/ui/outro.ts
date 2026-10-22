import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ctx } from '../core/context';
import { lowfx, prefs } from '../core/settings';
import { GNOME_TYPES } from '../data/gnomeTypes';
import { glowTexture } from '../entities/mushrooms';
import * as M from '../world/models';
import { tex } from '../world/textures';

// The Deep (PP 2026-10-22): a second scene drawn instead of the yard after the jump at hole level 12.
// From the bottom of the shaft looking up: walls of gnomes facing the player, only their eyes glow, a few fall past.
const R = 6; // hole level 12 radius
const H = 40;
const FALLERS = 8;
const PER_ROW = 70;
const ROW = 0.95;
const EYE = [0.045, 0.13, 0.15]; // gnome space, 2.5 cm in front of the face so the depth test keeps it
const EYE_COLORS: [number, number][] = [[0x9fe6ff, 0.88], [0xffd23f, 0.08], [0xc08aff, 0.04]];
const FOG = 0.08;
const FAR_FADE = 14; // m: far eyes dim as exp(-distance / FAR_FADE), so the crowd sinks into the dark with depth
const SPIN = 0.04; // rad/s
const ROLL = 0.02; // rad
const BLINK = 0.12; // s
const UP = Math.PI / 2;
const HEAP_PITCH = -0.35;
const HEAP = new THREE.Vector3(0, 0, -4);

type Faller = { angle: number; radius: number; y: number; vy: number; spin: THREE.Vector3; q: THREE.Quaternion };
type Eyes = { points: THREE.Points; pos: Float32Array; col: Float32Array; timers: Float32Array };

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const ONE = new THREE.Vector3(1, 1, 1);

export class Outro {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 80);
  active = false;
  t = 0;
  readonly counts = { bodies: 0, fallers: 0, farEyes: 0, chairs: 0, flamingos: 0, letters: 0 };
  drum = new THREE.Group();
  fallers: Faller[] = [];
  fallerMesh: THREE.InstancedMesh | null = null;
  near: Eyes | null = null;
  far: Eyes | null = null;
  heap: { chairs: THREE.InstancedMesh | null; flamingos: THREE.InstancedMesh | null; letters: THREE.Mesh | null } = { chairs: null, flamingos: null, letters: null };
  private seed = 1;
  private spin = 0;
  private pitch = UP;
  private pitchTarget = UP;
  private noise = new SimplexNoise();

  get drumAngle(): number {
    return this.drum.rotation.y;
  }

  // a seeded LCG: the same shaft every time, so screenshots repeat
  private rand(a = 0, b = 1): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return a + (this.seed / 4294967296) * (b - a);
  }

  private eyeColor(): THREE.Color {
    let r = this.rand();
    for (const [c, w] of EYE_COLORS) if ((r -= w) < 0) return new THREE.Color(c);
    return new THREE.Color(EYE_COLORS[0][0]);
  }

  // a pair of points per gnome, both eyes the same colour; alpha is the blink
  private eyes(pairs: number, size: number): Eyes {
    const pos = new Float32Array(pairs * 6);
    const col = new Float32Array(pairs * 8);
    const timers = new Float32Array(pairs);
    for (let i = 0; i < pairs; i++) {
      const c = this.eyeColor();
      for (let k = 0; k < 2; k++) col.set([c.r, c.g, c.b, 1], (i * 2 + k) * 4);
      timers[i] = this.rand(BLINK, 9);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }); // tone mapping turned the icy blue white
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.drum.add(points);
    return { points, pos, col, timers };
  }

  // both eye positions of instance matrix m into pair i
  private writeEyes(e: Eyes, i: number, m: THREE.Matrix4): void {
    for (let k = 0; k < 2; k++) {
      tmpV.set(k ? EYE[0] : -EYE[0], EYE[1], EYE[2]).applyMatrix4(m);
      e.pos.set([tmpV.x, tmpV.y, tmpV.z], (i * 2 + k) * 3);
    }
  }

  // letters: the golden GNOME letters the hole ate (PP 2026-10-22, O3 b: they lie on the pile too)
  start(chairs: number, flamingos: number, letters: string[]): void {
    if (this.active) return;
    const low = lowfx || prefs.quality === 'low';
    const wall = low ? 300 : 900;
    const farEyes = low ? 3000 : 6000;
    const cap = low ? { chairs: 60, flamingos: 120 } : { chairs: 150, flamingos: 300 };
    const scene = this.scene;
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, FOG);
    this.camera.position.set(0, 0.6, 0);
    this.camera.rotation.set(UP, 0, 0);

    const dirt = new THREE.MeshStandardMaterial({ map: tex('dirt_diff', 4, 8), color: 0x3a2e28, roughness: 1, side: THREE.BackSide });
    // wall and floor in one draw call; BackSide: the floor circle is flipped so its back faces up
    const shaft = mergeGeometries([new THREE.CylinderGeometry(R, R, H, 48, 1, true).translate(0, H / 2, 0), new THREE.CircleGeometry(R, 48).rotateX(Math.PI / 2)])!;
    scene.add(new THREE.Mesh(shaft, dirt));
    // dim on purpose: the bodies are shapes in the dark, only the eyes glow; the lamp reaches the pile
    scene.add(new THREE.HemisphereLight(0x223a4a, 0x05070a, 0.35));
    // a faint cold light from the void above: a rim on hats and shoulders, so the near gnomes read as gnomes
    const rim = new THREE.DirectionalLight(0x9fc8e0, 1.0);
    rim.position.set(0, H, 0);
    scene.add(rim);
    const lamp = new THREE.PointLight(0x9fe6ff, 3, 10, 1.2);
    lamp.position.copy(this.camera.position);
    scene.add(lamp);
    scene.add(this.drum);
    const mat = M.vcMat();

    // wall: ~36 % classic, 24 % blue, the rest shared by the other types, exactly 2 kings in the first rows on opposite sides
    const others = GNOME_TYPES.filter((t) => t.id !== 'classic' && t.id !== 'blue' && t.id !== 'king');
    const slots: { type: string; m: THREE.Matrix4 }[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < wall; i++) {
      const row = Math.floor(i / PER_ROW);
      const a = ((i % PER_ROW) / PER_ROW) * Math.PI * 2 + row * 0.37 + this.rand(-0.15, 0.15);
      const y = 0.8 + row * ROW + this.rand(-0.2, 0.2);
      const r = this.rand();
      const t = r < 0.36 ? GNOME_TYPES[0] : r < 0.6 ? GNOME_TYPES[1] : others[Math.floor(this.rand(0, others.length))];
      // the kings stand in the 5th row (y about 4.6): the lowest one the camera sees at the edges
      const king = row === 4 && (i % PER_ROW === 0 || i % PER_ROW === PER_ROW / 2);
      const type = king ? GNOME_TYPES.find((g) => g.id === 'king')! : t;
      const s = type.scale * this.rand(0.9, 1.15);
      dummy.position.set(Math.cos(a) * (R - 0.45), y, Math.sin(a) * (R - 0.45));
      dummy.lookAt(this.camera.position);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      slots.push({ type: type.id, m: dummy.matrix.clone() });
    }
    this.near = this.eyes(wall + FALLERS, 0.07);
    let pair = 0;
    for (const t of GNOME_TYPES) {
      const mine = slots.filter((s) => s.type === t.id);
      if (!mine.length) continue;
      const mesh = new THREE.InstancedMesh(ctx.gnomes.meshes.get(t.id)!.geometry, mat, mine.length);
      mesh.frustumCulled = false;
      mine.forEach((s, k) => {
        mesh.setMatrixAt(k, s.m);
        this.writeEyes(this.near!, pair++, s.m);
      });
      this.drum.add(mesh);
    }

    // far eyes over the whole wall, behind and above the bodies, dimmer with distance; bigger points so a pair
    // still reads from 30 m
    this.far = this.eyes(farEyes, 0.2);
    for (let i = 0; i < farEyes; i++) {
      const a = this.rand(0, Math.PI * 2);
      const r = this.rand(R - 0.3, R - 0.1);
      const y = this.rand(1, H - 2);
      const dim = Math.exp(-Math.hypot(r, y - this.camera.position.y) / FAR_FADE);
      for (let k = 0; k < 2; k++) {
        for (let c = 0; c < 3; c++) this.far.col[(i * 2 + k) * 4 + c] *= dim;
        const b = a + ((k ? 0.15 : -0.15) / r);
        this.far.pos.set([Math.cos(b) * r, y, Math.sin(b) * r], (i * 2 + k) * 3);
      }
    }

    this.fallerMesh = new THREE.InstancedMesh(ctx.gnomes.meshes.get('classic')!.geometry, mat, FALLERS);
    this.fallerMesh.frustumCulled = false;
    this.fallerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drum.add(this.fallerMesh);
    for (let i = 0; i < FALLERS; i++) {
      this.fallers.push({ angle: 0, radius: 0, y: this.rand(2, H - 5), vy: -this.rand(0.6, 1.2), spin: new THREE.Vector3(this.rand(-1, 1), this.rand(-1, 1), this.rand(-1, 1)), q: new THREE.Quaternion() });
      this.respawn(this.fallers[i]);
    }

    // the pile: a low mound on a golden-angle spiral, flamingos in the middle on top, armchairs round the foot.
    // Height and width are capped, so a big pile never grows into a tower that hides the shaft
    const nc = Math.min(chairs, cap.chairs);
    const nf = Math.min(flamingos, cap.flamingos);
    const n = nc + nf;
    const rMax = Math.min(1.9, 0.35 * Math.sqrt(n) + 0.6);
    const peak = Math.min(3, 0.3 * Math.sqrt(n));
    const place = (mesh: THREE.InstancedMesh, count: number, first: number, base: number) => {
      for (let i = 0; i < count; i++) {
        const k = first + i;
        const r = rMax * Math.sqrt((k + 0.5) / n);
        const a = k * 2.39996 + this.rand(-0.2, 0.2);
        tmpV.set(HEAP.x + Math.cos(a) * r, base + peak * (1 - r / rMax), HEAP.z + Math.sin(a) * r);
        tmpQ.setFromEuler(tmpE.set(this.rand(-0.3, 0.3), this.rand(0, Math.PI * 2), this.rand(-0.3, 0.3)));
        mesh.setMatrixAt(i, tmpM.compose(tmpV, tmpQ, ONE));
      }
      mesh.frustumCulled = false;
      scene.add(mesh);
    };
    if (nf) place((this.heap.flamingos = new THREE.InstancedMesh(M.flamingoGeometry(), mat, nf)), nf, 0, 0.5);
    if (nc) place((this.heap.chairs = new THREE.InstancedMesh(M.armchairGeometry(), mat, nc)), nc, nf, 0.45);
    // the letters stand in a row on top of the pile, facing the camera; one merged mesh, one draw call
    if (letters.length) {
      const y = (n ? peak + 0.6 : 0) + 0.25;
      const geos = letters.map((ch, j) => {
        tmpV.set(HEAP.x + (j - (letters.length - 1) / 2) * 0.85, y, HEAP.z + 0.3);
        tmpQ.setFromEuler(tmpE.set(this.rand(-0.2, 0.2), this.rand(-0.3, 0.3), this.rand(-0.25, 0.25)));
        return M.letterGeometry(ch).applyMatrix4(tmpM.compose(tmpV, tmpQ, ONE));
      });
      this.heap.letters = new THREE.Mesh(mergeGeometries(geos)!, M.vcMat({ metalness: 0.8, roughness: 0.2, emissive: 0x332200 }));
      scene.add(this.heap.letters);
    }

    Object.assign(this.counts, { bodies: wall, fallers: FALLERS, farEyes, chairs: nc, flamingos: nf, letters: letters.length });
    void ctx.renderer.compileAsync(scene, this.camera);
    this.active = true;
  }

  // the camera turns down to the pile for the heap line and back up after it
  lookAtHeap(on: boolean): void {
    this.pitchTarget = on ? HEAP_PITCH : UP;
  }

  private respawn(f: Faller): void {
    f.angle = this.rand(0, Math.PI * 2);
    f.radius = this.rand(1, 3);
  }

  private blink(e: Eyes, dt: number): void {
    for (let i = 0; i < e.timers.length; i++) {
      let t = (e.timers[i] -= dt);
      if (t <= 0) t = e.timers[i] = this.rand(3, 9);
      const a = t < BLINK ? 0 : 1;
      e.col[i * 8 + 3] = a;
      e.col[i * 8 + 7] = a;
    }
    e.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.t += dt;
    const cam = this.camera;
    const aspect = window.innerWidth / window.innerHeight;
    if (cam.aspect !== aspect) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
    this.spin = THREE.MathUtils.damp(this.spin, SPIN, 1, dt);
    this.drum.rotation.y += this.spin * dt;
    this.pitch = THREE.MathUtils.damp(this.pitch, this.pitchTarget, 2.5, dt);
    cam.rotation.set(this.pitch, 0, this.noise.noise(this.t * 0.08, 0) * ROLL);

    const near = this.near!;
    const wall = this.counts.bodies;
    this.fallers.forEach((f, i) => {
      f.y += f.vy * dt;
      // the top of the shaft is in full fog: the wrap needs no transition
      if (f.y < -1) {
        f.y = 30;
        this.respawn(f);
      }
      f.q.multiply(tmpQ.setFromEuler(tmpE.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt)));
      tmpV.set(Math.cos(f.angle) * f.radius, f.y, Math.sin(f.angle) * f.radius);
      tmpM.compose(tmpV, f.q, ONE);
      this.fallerMesh!.setMatrixAt(i, tmpM);
      this.writeEyes(near, wall + i, tmpM);
    });
    this.fallerMesh!.instanceMatrix.needsUpdate = true;
    near.points.geometry.attributes.position.needsUpdate = true;
    this.blink(near, dt);
    this.blink(this.far!, dt);
  }
}
