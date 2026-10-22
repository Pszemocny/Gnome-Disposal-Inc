import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ctx } from '../core/context';
import { inOutSine, inQuad, outBack, outCubic } from '../core/ease';
import { lowfx, prefs } from '../core/settings';
import { GNOME_TYPES } from '../data/gnomeTypes';
import { glowTexture } from '../entities/mushrooms';
import * as M from '../world/models';
import { tex } from '../world/textures';

// The Deep (PP 2026-10-22): a second scene drawn instead of the yard after the jump at hole level 12.
// From the bottom of the shaft looking up: walls of gnomes facing the player, only their eyes glow, a few fall past.
// Then the camera goes down to the heap of everything the hole ate and stays there until the King eats the player.
const R = 6; // hole level 12 radius
const H = 40;
const FALLERS = 8;
const PER_ROW = 70;
const ROW = 0.95;
const EYE = [0.045, 0.13, 0.15]; // gnome space, 2.5 cm in front of the face so the depth test keeps it
const EYE_COLORS: [number, number][] = [[0x9fe6ff, 0.88], [0xffd23f, 0.08], [0xc08aff, 0.04]];
const EYE_GLOW = 0.4; // PP 2026-10-22 "tylko lekko swiecace oczy mniej niz jest"
const BEARD_DIM = 0.2; // linear: lit white beards read as glowing arcs in the dark (PP "bez swiecacych wasow")
const FOG = 0.08;
const FAR_FADE = 14; // m: far eyes dim as exp(-distance / FAR_FADE), so the crowd sinks into the dark with depth
const SPIN = 0.04; // rad/s
const ROLL = 0.02; // rad
const BLINK = 0.12; // s
const UP = Math.PI / 2;
// the heap scene, in s after the camera starts down to the heap: the King rises, walks to the camera, bites
export const DEVOUR = { rise: 3.5, walk: 4.8, walkT: 3.6, bite: 9, done: 10.1 };
const KING = 3.2; // the King who eats you, 2.9 m tall
const KING_Z = 0.4; // where he comes out of the heap
const STOP_Z = 3.6; // where he stops in front of the camera
const VIEW_Z = 5.3;
const MOUTH: [number, number, number] = [0, 0.035, 0.165]; // on top of the beard, under the nose

export type Pile = { chairs: number; flamingos: number; letters: string[]; gnomes: number; ufos: number; kings: number };
type Faller = { angle: number; radius: number; y: number; vy: number; spin: THREE.Vector3; q: THREE.Quaternion; landed: number };
type Eyes = { points: THREE.Points; pos: Float32Array; col: Float32Array; timers: Float32Array };

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpMouth = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const tmpE = new THREE.Euler();
const ONE = new THREE.Vector3(1, 1, 1);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

export class Outro {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 80);
  active = false;
  t = 0;
  heapT = 0;
  devoured = false;
  readonly counts = { bodies: 0, fallers: 0, farEyes: 0, chairs: 0, flamingos: 0, letters: 0, gnomes: 0, ufos: 0, kings: 0, moundR: 0 };
  drum = new THREE.Group();
  fallers: Faller[] = [];
  fallerMesh: THREE.InstancedMesh | null = null;
  near: Eyes | null = null;
  far: Eyes | null = null;
  heap: {
    group: THREE.Group;
    mound: THREE.Mesh | null;
    gnomes: THREE.InstancedMesh | null;
    chairs: THREE.InstancedMesh | null;
    flamingos: THREE.InstancedMesh | null;
    letters: THREE.Mesh | null;
    ufos: THREE.InstancedMesh | null;
    kings: THREE.InstancedMesh | null; // instance 0 is the King who eats you
  } = { group: new THREE.Group(), mound: null, gnomes: null, chairs: null, flamingos: null, letters: null, ufos: null, kings: null };
  black: THREE.Mesh | null = null;
  private seed = 1;
  private spin = 0;
  private pitch = UP;
  private heapOn = false;
  private lamp: THREE.PointLight | null = null;
  private moundR = 0;
  private moundH = 0;
  private step = 0;
  private stepN = 0;
  private kingZ = KING_Z;
  private biteFrom = new THREE.Vector3();
  private noise = new SimplexNoise();
  private geos = new Map<string, THREE.BufferGeometry>();

  get drumAngle(): number {
    return this.drum.rotation.y;
  }

  // a seeded LCG: the same shaft every time, so screenshots repeat
  private rand(a = 0, b = 1): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return a + (this.seed / 4294967296) * (b - a);
  }

  // the shaft's own gnome models: dim beards and dark eye spheres, so only the eye points glow
  private geo(id: string): THREE.BufferGeometry {
    let g = this.geos.get(id);
    if (!g) {
      const t = GNOME_TYPES.find((x) => x.id === id)!;
      g = M.gnomeGeometry({ ...t, beard: new THREE.Color(t.beard).multiplyScalar(BEARD_DIM).getHex(), emissiveEyes: false });
      this.geos.set(id, g);
    }
    return g;
  }

  // height of the heap's surface d m from its centre (the mound mesh has the same profile)
  private surf(d: number): number {
    return this.moundH * Math.max(0, 1 - (d / this.moundR) ** 2) ** 1.5;
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
      const c = this.eyeColor().multiplyScalar(EYE_GLOW);
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
  start(pile: Pile): void {
    if (this.active) return;
    const low = lowfx || prefs.quality === 'low';
    const wall = low ? 300 : 900;
    const farEyes = low ? 3000 : 6000;
    const cap = low ? { chairs: 60, flamingos: 120, gnomes: 100 } : { chairs: 150, flamingos: 300, gnomes: 250 };
    const scene = this.scene;
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, FOG);
    this.camera.position.set(0, 0.6, 0);
    this.camera.rotation.set(UP, 0, 0);

    const dirt = new THREE.MeshStandardMaterial({ map: tex('dirt_diff', 4, 8), color: 0x3a2e28, roughness: 1, side: THREE.BackSide });
    // wall and floor in one draw call; BackSide: the floor circle is flipped so its back faces up
    const shaft = mergeGeometries([new THREE.CylinderGeometry(R, R, H, 48, 1, true).translate(0, H / 2, 0), new THREE.CircleGeometry(R, 48).rotateX(Math.PI / 2)])!;
    scene.add(new THREE.Mesh(shaft, dirt));
    // dim on purpose: the bodies are shapes in the dark, only the eyes glow; the lamp at the camera reaches the heap
    scene.add(new THREE.HemisphereLight(0x223a4a, 0x05070a, 0.2));
    // a faint cold light from the void above: a rim on hats and shoulders, so the near gnomes read as gnomes
    const rim = new THREE.DirectionalLight(0x9fc8e0, 0.5);
    rim.position.set(0, H, 0);
    scene.add(rim);
    this.lamp = new THREE.PointLight(0x9fe6ff, 2.4, 10, 1.2);
    this.lamp.position.copy(this.camera.position);
    scene.add(this.lamp);
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
    this.near = this.eyes(wall + FALLERS, 0.06);
    let pair = 0;
    for (const t of GNOME_TYPES) {
      const mine = slots.filter((s) => s.type === t.id);
      if (!mine.length) continue;
      const mesh = new THREE.InstancedMesh(this.geo(t.id), mat, mine.length);
      mesh.frustumCulled = false;
      mine.forEach((s, k) => {
        mesh.setMatrixAt(k, s.m);
        this.writeEyes(this.near!, pair++, s.m);
      });
      this.drum.add(mesh);
    }

    // far eyes over the whole wall, behind and above the bodies, dimmer with distance; bigger points so a pair
    // still reads from 30 m
    this.far = this.eyes(farEyes, 0.17);
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

    this.fallerMesh = new THREE.InstancedMesh(this.geo('classic'), mat, FALLERS);
    this.fallerMesh.frustumCulled = false;
    this.fallerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drum.add(this.fallerMesh);
    for (let i = 0; i < FALLERS; i++) {
      this.fallers.push({ angle: 0, radius: 0, y: this.rand(2, H - 5), vy: -this.rand(0.6, 1.2), spin: new THREE.Vector3(this.rand(-1, 1), this.rand(-1, 1), this.rand(-1, 1)), q: new THREE.Quaternion(), landed: -1 });
      this.respawn(this.fallers[i]);
    }

    // black in front of the camera for the bite
    this.black = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    this.black.position.z = -0.2;
    this.black.renderOrder = 999;
    this.camera.add(this.black);
    scene.add(this.camera);

    Object.assign(this.counts, { bodies: wall, fallers: FALLERS, farEyes });
    if (pile.gnomes + pile.chairs + pile.flamingos + pile.letters.length > 0) this.buildHeap(pile, cap, mat);
    // the heap and the black are compiled now and hidden until they are needed (compile only visits visible objects)
    void ctx.renderer.compileAsync(scene, this.camera);
    this.heap.group.visible = false;
    this.black.visible = false;
    this.active = true;
  }

  // the heap: a dirt mound that grows with the gnomes eaten, gnome bodies on it, the armchairs, flamingos, downed
  // UFOs, eaten kings and the GNOME letters, and the King who eats the player (PP 2026-10-22 "aby to wygladalo jak kupa")
  private buildHeap(pile: Pile, cap: { chairs: number; flamingos: number; gnomes: number }, mat: THREE.Material): void {
    const group = this.heap.group;
    this.scene.add(group);
    const r = (this.moundR = Math.min(4, 1 + 0.75 * Math.log10(1 + pile.gnomes)));
    this.moundH = 0.45 * r;
    // unit mound: a hemisphere pressed to the heap profile, lumpy
    const geo = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const u = Math.min(1, Math.hypot(x, z));
      p.setY(i, (1 - u * u) ** 1.5 * (1 + 0.12 * this.noise.noise(x * 3, z * 3)));
    }
    geo.computeVertexNormals();
    const mound = (this.heap.mound = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex('dirt_diff', 3, 3), color: 0x5a4636, roughness: 1 })));
    mound.scale.set(r, this.moundH, r);
    group.add(mound);

    // a random spot on the heap, d in [d0, d1] x radius; front = on the camera's side (+z)
    const put = (mesh: THREE.InstancedMesh, i: number, d0: number, d1: number, lift: number, scale: number, front = false, tilt = 0.4) => {
      const d = r * (d0 + (d1 - d0) * Math.sqrt(this.rand()));
      const a = front ? Math.PI / 2 + this.rand(-1.1, 1.1) : this.rand(0, Math.PI * 2);
      tmpV.set(Math.cos(a) * d, this.surf(d) + lift * scale, Math.sin(a) * d);
      tmpQ.setFromEuler(tmpE.set(this.rand(-tilt, tilt), this.rand(0, Math.PI * 2), this.rand(-tilt, tilt)));
      mesh.setMatrixAt(i, tmpM.compose(tmpV, tmpQ, tmpS.setScalar(scale)));
    };
    const add = (mesh: THREE.InstancedMesh) => {
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    };

    // gnome bodies lying all over it, each a little different in the dark
    const ng = Math.min(cap.gnomes, Math.round(5 * Math.sqrt(pile.gnomes)));
    if (ng) {
      const g = (this.heap.gnomes = add(new THREE.InstancedMesh(this.geo('classic'), mat, ng)));
      const c = new THREE.Color();
      for (let i = 0; i < ng; i++) {
        put(g, i, 0, 0.95, 0.1, 1, false, Math.PI / 2);
        g.setColorAt(i, c.setHSL(this.rand(0, 1), 0.3, this.rand(0.25, 0.6)));
      }
    }
    const nf = Math.min(pile.flamingos, cap.flamingos);
    const nc = Math.min(pile.chairs, cap.chairs);
    if (nf) {
      const f = (this.heap.flamingos = add(new THREE.InstancedMesh(M.flamingoGeometry(), mat, nf)));
      for (let i = 0; i < nf; i++) put(f, i, 0, 0.9, 0.3, 1);
    }
    if (nc) {
      const ch = (this.heap.chairs = add(new THREE.InstancedMesh(M.armchairGeometry(), mat, nc)));
      for (let i = 0; i < nc; i++) put(ch, i, 0.4, 0.95, 0.2, 1);
    }
    // the downed UFOs stuck in the heap on the camera's side, shrunk to 2 m
    const nu = Math.min(4, pile.ufos);
    if (nu) {
      const u = (this.heap.ufos = add(new THREE.InstancedMesh(M.ufoGeometry(), M.vcMat({ metalness: 0.6, roughness: 0.35 }), nu)));
      for (let i = 0; i < nu; i++) put(u, i, 0.3, 0.75, 0.15, 0.33, true, 0.7);
    }
    // the eaten kings lie on the heap; instance 0 is the King who climbs out of it, hidden until then
    const nk = Math.min(6, pile.kings);
    const mouth = M.build([{ g: new THREE.SphereGeometry(0.05, 10, 8), c: 0x140404, p: MOUTH, s: [1.6, 0.9, 0.5] }], true);
    const k = (this.heap.kings = add(new THREE.InstancedMesh(mergeGeometries([this.geo('king'), mouth])!, mat, 1 + nk)));
    k.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    k.setMatrixAt(0, tmpM.makeScale(0, 0, 0));
    for (let i = 1; i <= nk; i++) put(k, i, 0.35, 0.85, 0.12, 1.25, true, Math.PI / 2);
    // the letters stand in a row behind the King's spot on top, facing the camera; one merged mesh, one draw call
    if (pile.letters.length) {
      const y = this.surf(0.5) + 0.55;
      const geos = pile.letters.map((ch, j) => {
        tmpV.set((j - (pile.letters.length - 1) / 2) * 0.85, y, -0.5);
        tmpQ.setFromEuler(tmpE.set(this.rand(-0.2, 0.2), this.rand(-0.3, 0.3), this.rand(-0.25, 0.25)));
        return M.letterGeometry(ch).applyMatrix4(tmpM.compose(tmpV, tmpQ, ONE));
      });
      this.heap.letters = new THREE.Mesh(mergeGeometries(geos)!, M.vcMat({ metalness: 0.8, roughness: 0.2, emissive: 0x221500 }));
      group.add(this.heap.letters);
    }
    Object.assign(this.counts, { chairs: nc, flamingos: nf, letters: pile.letters.length, gnomes: ng, ufos: nu, kings: nk, moundR: r });
  }

  get hasHeap(): boolean {
    return !!this.heap.mound;
  }

  // the camera goes down to the heap and stays: from here the scene plays to the bite without a cut
  showHeap(): void {
    if (!this.hasHeap || this.heapOn) return;
    this.heapOn = true;
    this.heap.group.visible = true;
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

  // the King who eats you: rises out of the heap (pop + squash), walks to the camera (bob, roll, lean from his
  // speed), stops, pulls back, lunges with an overshoot. Writes instance 0 and returns his mouth in world space
  private king(t: number, dt: number, out: THREE.Vector3): boolean {
    const k = this.heap.kings!;
    if (t < DEVOUR.rise) return false;
    const lift = 0.45 * KING; // centre above the feet
    const rise = (t - DEVOUR.rise) / 1;
    let s = KING * outBack(clamp01((t - DEVOUR.rise) / 0.25));
    if (rise < 1 && rise - dt < 0) ctx.audio.rumble(1.2);
    let sy = 1;
    // lands on top of the heap after the rise
    const land = (t - DEVOUR.rise - 1) / 0.18;
    if (land >= 0 && land < 1) sy = 1 - 0.2 * (1 - outCubic(land));
    const w = clamp01((t - DEVOUR.walk) / DEVOUR.walkT);
    const z = KING_Z + (STOP_Z - KING_Z) * inOutSine(w);
    const v = dt > 0 ? (z - this.kingZ) / dt : 0;
    this.kingZ = z;
    const pace = Math.min(1, v / 1.5);
    this.step += v * dt * 2.4;
    if (Math.floor(this.step / Math.PI) > this.stepN) {
      this.stepN = Math.floor(this.step / Math.PI);
      ctx.audio.impact(0.6, 3);
    }
    const y = this.surf(z) + lift - (rise < 1 ? (1 - outBack(clamp01(rise))) * 0.9 * KING : 0) + Math.abs(Math.sin(this.step)) * 0.05 * KING * pace;
    let off = 0;
    let lean = 0.12 * pace;
    const roll = Math.sin(this.step) * 0.07 * pace;
    const b = t - DEVOUR.bite;
    if (b >= 0 && b < 0.1) {
      // anticipation: pulls back
      off = -0.35 * outCubic(b / 0.1);
      lean = -0.25 * outCubic(b / 0.1);
    } else if (b >= 0.1) {
      // the lunge overshoots and settles
      const kb = clamp01((b - 0.1) / 0.45);
      off = -0.35 + 1.25 * outBack(kb);
      lean = -0.25 + 0.6 * outBack(kb);
      sy = 1 + 0.15 * (1 - outCubic(kb));
      if (b - dt < 0.4 && b >= 0.4) ctx.audio.slurp();
    }
    if (s < 0) s = 0;
    const sxz = 1 / Math.sqrt(sy);
    tmpV.set(0, y, z + off);
    tmpQ.setFromEuler(tmpE.set(lean, 0, roll));
    tmpM.compose(tmpV, tmpQ, tmpS.set(s * sxz, s * sy, s * sxz));
    k.setMatrixAt(0, tmpM);
    k.instanceMatrix.needsUpdate = true;
    out.set(...MOUTH).applyMatrix4(tmpM);
    return true;
  }

  // camera, King and black for the heap scene
  private heapScene(dt: number): void {
    const t = (this.heapT += dt);
    const cam = this.camera.position;
    const mouth = tmpMouth;
    const up = this.king(t, dt, mouth);
    const bite = t - DEVOUR.bite - 0.1;
    let lambda = 2;
    if (bite < 0) {
      // fly to the view: up fast so the camera clears the heap, back more slowly
      const viewY = Math.max(2.1, 1.1 + this.moundH);
      cam.y = THREE.MathUtils.damp(cam.y, viewY, 4, dt);
      cam.z = THREE.MathUtils.damp(cam.z, VIEW_Z, 1.2, dt);
      this.biteFrom.copy(cam);
    } else {
      // into the mouth
      cam.lerpVectors(this.biteFrom, mouth, inQuad(clamp01(bite / 0.3)));
      lambda = 10;
    }
    // look over the heap (it fills the lower half, under the text), then above the King's face so it stays
    // under the text, and into his mouth for the bite
    const look = up ? tmpV.copy(mouth).setY(mouth.y + (bite < 0 ? 0.5 : 0)) : tmpV.set(0, this.moundH * 0.8 + 0.3, 0);
    const ahead = cam.z - look.z;
    if (ahead > 0.25) this.pitch = THREE.MathUtils.damp(this.pitch, Math.atan2(look.y - cam.y, ahead), lambda, dt);
    const fade = outCubic(clamp01((t - DEVOUR.bite - 0.2) / 0.25));
    const black = this.black!;
    (black.material as THREE.MeshBasicMaterial).opacity = fade;
    black.visible = fade > 0;
    if (t >= DEVOUR.done) this.devoured = true;
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
    if (this.heapOn) this.heapScene(dt);
    else this.pitch = THREE.MathUtils.damp(this.pitch, UP, 2.5, dt);
    cam.rotation.set(this.pitch, 0, this.noise.noise(this.t * 0.08, 0) * ROLL);
    this.lamp!.position.copy(cam.position);

    const near = this.near!;
    const wall = this.counts.bodies;
    const drumY = this.drum.rotation.y;
    const unspin = tmpQ2.setFromAxisAngle(Y_AXIS, -drumY);
    this.fallers.forEach((f, i) => {
      let sy = 1;
      if (f.landed < 0) {
        const floor = this.heapOn ? this.surf(f.radius) + 0.15 : -Infinity;
        const was = f.y;
        f.y += f.vy * dt;
        f.q.multiply(tmpQ.setFromEuler(tmpE.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt)));
        // a faller that reaches the heap lands and stays on it: from now on angle and q are in world space,
        // so the drum's spin does not drag it over the static heap
        if (was >= floor && f.y < floor) {
          f.y = floor;
          f.landed = 0;
          f.angle -= drumY;
          f.q.premultiply(tmpQ.setFromAxisAngle(Y_AXIS, drumY));
        }
        // the top of the shaft is in full fog: the wrap needs no transition
        if (f.y < -1) {
          f.y = 30;
          this.respawn(f);
        }
      } else if (f.landed < 0.15) {
        f.landed += dt;
        sy = 1 - 0.3 * (1 - outCubic(clamp01(f.landed / 0.15)));
      }
      // the mesh lives in the drum: a landed faller's world pose is turned back into drum space
      const a = f.landed < 0 ? f.angle : f.angle + drumY;
      const q = f.landed < 0 ? f.q : tmpQ.multiplyQuaternions(unspin, f.q);
      tmpV.set(Math.cos(a) * f.radius, f.y, Math.sin(a) * f.radius);
      tmpM.compose(tmpV, q, tmpS.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy)));
      this.fallerMesh!.setMatrixAt(i, tmpM);
      this.writeEyes(near, wall + i, tmpM);
    });
    this.fallerMesh!.instanceMatrix.needsUpdate = true;
    near.points.geometry.attributes.position.needsUpdate = true;
    this.blink(near, dt);
    this.blink(this.far!, dt);
  }
}
