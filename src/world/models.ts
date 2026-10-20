import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GnomeType } from '../data/gnomeTypes';

// Moving parts of a gnome (drawn by the gnome BatchedMesh); an untagged primitive belongs to the torso.
export type PartName = 'torso' | 'hat' | 'beard' | 'armL' | 'armR' | 'legL' | 'legR';
export const PART_ORDER: PartName[] = ['torso', 'hat', 'beard', 'armL', 'armR', 'legL', 'legR'];
// joint of each part in gnome space: hat brim, base of the beard cone, top end of each arm, hip at the top of the pants
export const PART_PIVOT: Record<PartName, [number, number, number]> = {
  torso: [0, 0, 0],
  hat: [0, 0.155, 0],
  beard: [0, 0.096, 0.11],
  armL: [-0.17, 0.029, 0.061],
  armR: [0.17, 0.029, 0.061],
  legL: [-0.075, -0.24, 0.02],
  legR: [0.075, -0.24, 0.02],
};

// Every model is a merge of coloured primitives, so one mesh = one draw call.
type Part = { g: THREE.BufferGeometry; c: number; p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number]; glow?: boolean; part?: PartName };

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

// a 'glow' mask (1 on glowing parts) only when asked: mergeGeometries and BatchedMesh need the same attributes on every part
export function build(parts: Part[], anyGlow = parts.some((part) => part.glow)): THREE.BufferGeometry {
  const list = parts.map(({ g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], glow }) => {
    const geo = (g.index ? g.toNonIndexed() : g.clone()) as THREE.BufferGeometry;
    tmpE.set(r[0], r[1], r[2]);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(new THREE.Vector3(...p), tmpQ, new THREE.Vector3(...s));
    geo.applyMatrix4(tmpM);
    const col = new THREE.Color(c);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (anyGlow) geo.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(glow ? 1 : 0), 1));
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'uv' && k !== 'glow') geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    return geo;
  });
  const merged = mergeGeometries(list, false)!;
  merged.computeBoundingSphere();
  return merged;
}

// Smooth shading by default; vertex colours tint an optional texture map.
export const vcMat = (opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, ...opts });

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, Math.max(seg, 16));
const sph = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, Math.max(w, 16), Math.max(h, 12));
const cone = (r: number, h: number, seg = 20) => new THREE.ConeGeometry(r, h, Math.max(seg, 16));
const lathe = (pts: [number, number][], seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// Gnome: 0.9 m tall, centred on its collider, facing +Z.
export function gnomeGeometry(t: GnomeType): THREE.BufferGeometry {
  return build(gnomePartList(t));
}

// One geometry per moving part, each moved so its joint (PART_PIVOT) sits at the origin.
export function gnomeParts(t: GnomeType): THREE.BufferGeometry[] {
  const list = gnomePartList(t);
  return PART_ORDER.map((name) => {
    const [x, y, z] = PART_PIVOT[name];
    return build(list.filter((p) => (p.part ?? 'torso') === name), true).translate(-x, -y, -z);
  });
}

function gnomePartList(t: GnomeType): Part[] {
  const parts: Part[] = [
    { g: box(0.1, 0.08, 0.17), c: 0x3a2414, p: [-0.075, -0.41, 0.02], part: 'legL' },
    { g: box(0.1, 0.08, 0.17), c: 0x3a2414, p: [0.075, -0.41, 0.02], part: 'legR' },
    { g: cyl(0.15, 0.17, 0.14), c: t.pants, p: [0, -0.31, 0] },
    { g: lathe([[0, -0.15], [0.165, -0.15], [0.185, -0.06], [0.175, 0.04], [0.14, 0.12], [0.0, 0.15]]), c: t.shirt, p: [0, -0.1, 0] },
    { g: cyl(0.158, 0.168, 0.035), c: 0x2a1a0a, p: [0, -0.2, 0] },
    { g: box(0.05, 0.04, 0.02), c: 0xe0c040, p: [0, -0.2, 0.165] },
    // small parts skip the >= 16 segment clamp: a 4 cm hand does not need 352 triangles
    // arms hang 0.3 rad outward from the shoulder S = PART_PIVOT.armL/R so the hands stick out of the body seen from behind:
    // arm centre = S + Rz(-+0.3)·(0, -0.13, 0), hand = S + Rz(-+0.3)·(0, -0.26, 0)
    { g: new THREE.CylinderGeometry(0.05, 0.055, 0.26, 10), c: t.shirt, p: [-0.2084, -0.0952, 0.061], r: [0, 0, -0.3], part: 'armL' },
    { g: new THREE.CylinderGeometry(0.05, 0.055, 0.26, 10), c: t.shirt, p: [0.2084, -0.0952, 0.061], r: [0, 0, 0.3], part: 'armR' },
    { g: new THREE.SphereGeometry(0.055, 8, 6), c: t.skin, p: [-0.2468, -0.2194, 0.061], part: 'armL' },
    { g: new THREE.SphereGeometry(0.055, 8, 6), c: t.skin, p: [0.2468, -0.2194, 0.061], part: 'armR' },
    { g: sph(0.125), c: t.skin, p: [0, 0.1, 0] },
    { g: new THREE.SphereGeometry(0.045, 8, 6), c: t.skin === 0x0a0a0c ? 0x0a0a0c : 0xe8907a, p: [0, 0.085, 0.125] },
    { g: cone(0.13, 0.28), c: t.beard, p: [0, -0.04, 0.075], r: [Math.PI + 0.25, 0, 0], part: 'beard' },
    { g: cone(0.14, 0.34, 24), c: t.hat, p: [0, 0.31, -0.01], r: [-0.12, 0, 0], glow: true, part: 'hat' },
    { g: cyl(0.142, 0.142, 0.04, 24), c: t.hat, p: [0, 0.155, 0], glow: true, part: 'hat' },
  ];
  const eye = t.emissiveEyes ? 0xffffff : 0x111111;
  parts.push({ g: new THREE.SphereGeometry(t.emissiveEyes ? 0.03 : 0.016, 6, 5), c: eye, p: [-0.045, 0.13, 0.11] });
  parts.push({ g: new THREE.SphereGeometry(t.emissiveEyes ? 0.03 : 0.016, 6, 5), c: eye, p: [0.045, 0.13, 0.11] });
  if (t.goggles) {
    parts.push({ g: cyl(0.035, 0.035, 0.04, 8), c: 0x9fd8ff, p: [-0.05, 0.14, 0.11], r: [Math.PI / 2, 0, 0] });
    parts.push({ g: cyl(0.035, 0.035, 0.04, 8), c: 0x9fd8ff, p: [0.05, 0.14, 0.11], r: [Math.PI / 2, 0, 0] });
    parts.push({ g: box(0.27, 0.025, 0.25), c: 0x222222, p: [0, 0.14, 0] });
    // wrench centred on the right hand
    parts.push({ g: box(0.04, 0.16, 0.03), c: 0x888888, p: [0.2468, -0.2194, 0.061], r: [0, 0, 0.3] });
  }
  if (t.staff) {
    // staff through the right hand (x/z of the hand), carried rigid by the torso
    parts.push({ g: cyl(0.018, 0.018, 0.95, 6), c: 0x6a4020, p: [0.2468, 0, 0.061] });
    parts.push({ g: sph(0.06, 8, 6), c: 0x7fe0ff, p: [0.2468, 0.5, 0.061] });
    parts.push({ g: cone(0.14, 0.3, 24), c: 0xffe066, p: [0, 0.31, -0.01], r: [-0.12, 0, 0], s: [0.3, 0.3, 0.3] });
  }
  if (t.fuse) {
    // along the hat axis (hat centre [0, 0.31, -0.01], tilted -0.12 rad): two black bands, a fuse and its spark
    const at = (y: number): [number, number, number] => [0, 0.31 + y * Math.cos(0.12), -0.01 - y * Math.sin(0.12)];
    const hatR = (y: number) => 0.15 * (0.17 - y) / 0.34; // a bit wider than the hat cone at local height y
    for (const y of [-0.1, 0.02]) parts.push({ g: cyl(hatR(y + 0.02), hatR(y - 0.02), 0.04, 12), c: 0x141414, p: at(y), r: [-0.12, 0, 0] });
    parts.push({ g: cyl(0.012, 0.012, 0.08, 6), c: 0x8a6a3a, p: at(0.2), r: [-0.12, 0, 0] });
    parts.push({ g: sph(0.028, 8, 6), c: 0xffb020, p: at(0.25) });
  }
  if (t.crown) {
    parts.push({ g: cyl(0.16, 0.15, 0.08, 10), c: 0xffcc22, p: [0, 0.2, 0] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push({ g: cone(0.03, 0.08, 4), c: 0xffcc22, p: [Math.sin(a) * 0.14, 0.27, Math.cos(a) * 0.14] });
    }
    parts.push({ g: box(0.36, 0.3, 0.03), c: 0xb01030, p: [0, -0.1, -0.18] });
  }
  return parts;
}

export function coinGeometry(): THREE.BufferGeometry {
  return build([
    { g: cyl(0.17, 0.17, 0.045, 14), c: 0xffffff },
    { g: box(0.04, 0.05, 0.16), c: 0xdddddd, p: [0, 0.01, 0] },
  ]);
}

export function treeGeometry(): THREE.BufferGeometry {
  return build([
    { g: cyl(0.25, 0.35, 2.4), c: 0x6b4423, p: [0, 1.2, 0] },
    { g: cone(2.2, 3.2), c: 0x2f7a32, p: [0, 3.2, 0] },
    { g: cone(1.75, 2.8), c: 0x3a8c3a, p: [0, 4.6, 0] },
    { g: cone(1.25, 2.4), c: 0x4a9e42, p: [0, 5.9, 0] },
  ]);
}

export function bushGeometry(): THREE.BufferGeometry {
  return build([
    { g: new THREE.IcosahedronGeometry(0.9, 1), c: 0x2d5e2a, p: [0, 0.6, 0] },
    { g: new THREE.IcosahedronGeometry(0.7, 1), c: 0x386e30, p: [0.6, 0.5, 0.2] },
    { g: new THREE.IcosahedronGeometry(0.6, 1), c: 0x2a5527, p: [-0.5, 0.45, -0.2] },
  ]);
}

export function grassTuftGeometry(): THREE.BufferGeometry {
  // thin blades stay low-poly on purpose: there are thousands of them
  const blade = (r: number, h: number) => new THREE.ConeGeometry(r, h, 4);
  return build([
    { g: blade(0.05, 0.4), c: 0x5fb83a, p: [0, 0.2, 0] },
    { g: blade(0.04, 0.32), c: 0x6cc444, p: [0.07, 0.16, 0.03], r: [0, 0, -0.35] },
    { g: blade(0.04, 0.3), c: 0x52a832, p: [-0.06, 0.15, -0.02], r: [0, 0, 0.35] },
  ]);
}

// Open-top wooden crate, 1.6 x 1.0 x 1.6, origin at the centre.
export function crateGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(1.6, 0.12, 1.6), c: 0xffe0b0, p: [0, -0.44, 0] },
    { g: box(1.6, 1.0, 0.12), c: 0xfff0d0, p: [0, 0, 0.74] },
    { g: box(1.6, 1.0, 0.12), c: 0xfff0d0, p: [0, 0, -0.74] },
    { g: box(0.12, 1.0, 1.36), c: 0xfff0d0, p: [0.74, 0, 0] },
    { g: box(0.12, 1.0, 1.36), c: 0xfff0d0, p: [-0.74, 0, 0] },
    { g: box(1.64, 0.1, 0.16), c: 0xc89060, p: [0, 0.45, 0.74] },
    { g: box(1.64, 0.1, 0.16), c: 0xc89060, p: [0, 0.45, -0.74] },
    { g: box(0.16, 0.1, 1.64), c: 0xc89060, p: [0.74, 0.45, 0] },
    { g: box(0.16, 0.1, 1.64), c: 0xc89060, p: [-0.74, 0.45, 0] },
  ]);
}

// Gnome factory: furnace body, big gear, chimney, red button, output chute towards +Z.
export function factoryGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(3.2, 2.6, 2.6), c: 0x8a6ad0, p: [0, 1.3, 0] },
    { g: box(3.4, 0.25, 2.8), c: 0x5a4a8a, p: [0, 2.7, 0] },
    { g: cyl(0.45, 0.55, 3.2), c: 0xc0c4cc, p: [-0.9, 4.2, -0.5] },
    { g: cyl(0.6, 0.45, 0.4), c: 0x6a6e76, p: [-0.9, 5.9, -0.5] },
    { g: box(1.5, 1.0, 1.6), c: 0xd8dde4, p: [0, 1.0, 1.9], r: [-0.35, 0, 0] },
    { g: box(1.2, 0.08, 1.4), c: 0x4a4e56, p: [0, 1.48, 1.9], r: [-0.35, 0, 0] },
    { g: cyl(0.22, 0.22, 0.6), c: 0xb0b0b0, p: [1.75, 1.6, 0.6], r: [0, 0, Math.PI / 2] },
    { g: box(0.7, 1.2, 0.7), c: 0x5a4a8a, p: [2.2, 0.6, 0.9] },
    { g: cyl(0.25, 0.25, 0.18), c: 0xe03030, p: [2.2, 1.29, 0.9] },
    { g: box(0.9, 0.5, 0.05), c: 0xffcc22, p: [0, 2.0, 1.31] },
    { g: cyl(0.35, 0.35, 0.1), c: 0xff8a2a, p: [0.9, 1.6, 1.31], r: [Math.PI / 2, 0, 0] },
  ]);
}

export function gearGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [
    { g: cyl(0.9, 0.9, 0.25), c: 0xc9a227, r: [0, 0, Math.PI / 2] },
    { g: cyl(0.25, 0.25, 0.35), c: 0x6a5a20, r: [0, 0, Math.PI / 2] },
  ];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push({ g: box(0.22, 0.3, 0.3), c: 0xc9a227, p: [0, Math.cos(a) * 1.0, Math.sin(a) * 1.0], r: [a, 0, 0] });
  }
  return build(parts);
}

export function wildMushroomGeometry(): THREE.BufferGeometry {
  return build([
    { g: cyl(0.04, 0.05, 0.16, 6), c: 0xe8dcc0, p: [0, 0.08, 0] },
    { g: sph(0.11, 8, 6), c: 0xb07a4a, p: [0, 0.17, 0], s: [1, 0.55, 1] },
  ]);
}

export function postGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(0.14, 1.2, 0.14), c: 0xf0e6d2, p: [0, 0.6, 0] },
    { g: cone(0.1, 0.15, 4), c: 0xf0e6d2, p: [0, 1.27, 0], r: [0, Math.PI / 4, 0] },
  ]);
}

// The player's house: textured walls and roof as separate meshes.
export function houseGroup(wallMap: THREE.Texture, roofMap: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 9), new THREE.MeshStandardMaterial({ map: wallMap, color: 0xf4efe6, roughness: 0.9 }));
  walls.position.y = 3;
  const roofShape = new THREE.Shape([new THREE.Vector2(-7.6, 0), new THREE.Vector2(7.6, 0), new THREE.Vector2(0, 3.6)]);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 9.8, bevelEnabled: false });
  roofGeo.translate(0, 0, -4.9);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ map: roofMap, color: 0xd88a70, roughness: 0.85 }));
  roof.position.y = 6;
  const trim = new THREE.Mesh(
    build([
      { g: box(1.2, 3, 1.2), c: 0x8a5a4a, p: [4, 8.5, -1] },
      { g: box(1.4, 2.6, 0.2), c: 0x6a4a3a, p: [-3, 1.3, 4.55] },
      { g: box(5, 3.6, 0.3), c: 0x2a2a30, p: [3.6, 1.8, 4.45] },
      { g: box(16, 0.3, 11), c: 0x9a9a9a, p: [0, 0.15, 0] },
      ...[-5.5, -1, 1.5, 5.5].map((x): Part => ({ g: box(1.4, 1.5, 0.15), c: 0x6a8aaa, p: [x, 4.5, 4.55] })),
      { g: box(1.4, 1.5, 0.15), c: 0x6a8aaa, p: [-5.5, 1.8, 4.55] },
    ]),
    vcMat(),
  );
  for (const m of [walls, roof, trim]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// Floating text sign that always faces the camera.
export function labelSprite(title: string, sub: string, color = '#ffd23f'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20,24,32,0.85)';
  g.beginPath();
  g.roundRect(8, 8, 496, 176, 36);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 8;
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = color;
  g.font = 'bold 72px Fredoka, system-ui, sans-serif';
  g.fillText(title, 256, 98, 470);
  g.fillStyle = '#ffffff';
  g.font = '600 40px Fredoka, system-ui, sans-serif';
  g.fillText(sub, 256, 152);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false }));
  s.scale.set(5.3, 2, 1);
  return s;
}

export function deskGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(2.2, 0.1, 1.1), c: 0xb08a5a, p: [0, 0.85, 0] },
    { g: box(0.1, 0.85, 0.1), c: 0x5a4a3a, p: [-1, 0.42, -0.45] },
    { g: box(0.1, 0.85, 0.1), c: 0x5a4a3a, p: [1, 0.42, -0.45] },
    { g: box(0.1, 0.85, 0.1), c: 0x5a4a3a, p: [-1, 0.42, 0.45] },
    { g: box(0.1, 0.85, 0.1), c: 0x5a4a3a, p: [1, 0.42, 0.45] },
    { g: box(1.1, 0.85, 0.8), c: 0xe0d8c0, p: [0, 1.35, -0.15] },
    { g: box(1.1, 0.08, 0.4), c: 0xd8d0b8, p: [0, 0.94, 0.35] },
    { g: cyl(1.2, 1.2, 0.06), c: 0xe05050, p: [0, 3.0, 0] },
    { g: cyl(0.04, 0.04, 2.1), c: 0x888888, p: [1.15, 1.95, 0] },
  ]);
}

export function armchairGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(1.0, 0.45, 0.9), c: 0x8a6e58, p: [0, -0.2, 0] },
    { g: box(1.0, 0.75, 0.25), c: 0x7a604c, p: [0, 0.38, -0.33] },
    { g: box(0.22, 0.4, 0.9), c: 0x7a604c, p: [-0.45, 0.2, 0] },
    { g: box(0.22, 0.4, 0.9), c: 0x7a604c, p: [0.45, 0.2, 0] },
    { g: box(0.6, 0.12, 0.6), c: 0x9a7e68, p: [0, 0.06, 0.05] },
  ]);
}

export function flamingoGeometry(): THREE.BufferGeometry {
  return build([
    { g: sph(0.22, 10, 8), c: 0xf07aa0, p: [0, 0.25, 0], s: [0.8, 0.7, 1.3] },
    { g: cyl(0.04, 0.05, 0.5, 6), c: 0xf07aa0, p: [0, 0.6, 0.2], r: [-0.3, 0, 0] },
    { g: sph(0.08, 8, 6), c: 0xf07aa0, p: [0, 0.85, 0.27] },
    { g: cone(0.03, 0.15, 6), c: 0x222222, p: [0, 0.8, 0.39], r: [Math.PI / 2 + 0.6, 0, 0] },
    { g: cyl(0.015, 0.015, 0.55, 4), c: 0x444444, p: [0.05, -0.2, 0] },
    { g: cyl(0.015, 0.015, 0.55, 4), c: 0x444444, p: [-0.05, -0.2, 0] },
  ]);
}

export function shovelGeometry(): THREE.BufferGeometry {
  return build([
    { g: cyl(0.03, 0.03, 1.1, 6), c: 0xc9a227, p: [0, 0, 0] },
    { g: box(0.28, 0.36, 0.04), c: 0xffd23f, p: [0, -0.68, 0] },
    { g: box(0.25, 0.05, 0.05), c: 0xffd23f, p: [0, 0.55, 0] },
  ]);
}

export function ufoGeometry(): THREE.BufferGeometry {
  return build([
    { g: sph(3, 20, 10), c: 0x9aa4b0, s: [1, 0.22, 1] },
    { g: sph(1.3, 14, 10), c: 0x8fe0ff, p: [0, 0.5, 0], s: [1, 0.8, 1] },
    ...Array.from({ length: 8 }, (_, i): Part => ({ g: sph(0.18, 6, 5), c: i % 2 ? 0xffe066 : 0xff5050, p: [Math.sin((i / 8) * Math.PI * 2) * 2.6, -0.05, Math.cos((i / 8) * Math.PI * 2) * 2.6] })),
  ]);
}

export function cloudGeometry(): THREE.BufferGeometry {
  return build([
    { g: new THREE.IcosahedronGeometry(4, 1), c: 0xffffff },
    { g: new THREE.IcosahedronGeometry(3, 1), c: 0xf4f4ff, p: [4, -0.5, 1] },
    { g: new THREE.IcosahedronGeometry(3.2, 1), c: 0xf8f8ff, p: [-4, -0.8, -0.5] },
  ]);
}

export function mushroomPickupGeometry(cap: number, spots = 0xffffff): THREE.BufferGeometry {
  return build([
    { g: cyl(0.08, 0.11, 0.3, 8), c: 0xf3ecdc, p: [0, 0.15, 0] },
    { g: sph(0.26, 12, 8), c: cap, p: [0, 0.33, 0], s: [1, 0.6, 1] },
    { g: sph(0.05, 6, 5), c: spots, p: [0.12, 0.43, 0.08] },
    { g: sph(0.04, 6, 5), c: spots, p: [-0.1, 0.42, -0.08] },
    { g: sph(0.04, 6, 5), c: spots, p: [0.0, 0.47, -0.02] },
  ]);
}

// Plow tractor body without wheels and blade: ground at y 0, front towards -z, the driver sits at the origin.
export function tractorGeometry(): THREE.BufferGeometry {
  const red = 0xd8352a;
  const dark = 0x2a2a2a;
  return build([
    { g: box(1.2, 0.35, 1.9), c: red, p: [0, 0.55, -0.2] },
    { g: box(0.9, 0.5, 0.8), c: red, p: [0, 0.95, -0.7] },
    { g: box(0.8, 0.35, 0.05), c: dark, p: [0, 0.92, -1.11] },
    { g: box(0.55, 0.12, 0.5), c: dark, p: [0, 1.0, 0.35] },
    { g: box(0.55, 0.5, 0.1), c: dark, p: [0, 1.25, 0.62] },
    { g: box(0.32, 0.08, 0.95), c: red, p: [0.72, 1.06, 0.4] },
    { g: box(0.32, 0.08, 0.95), c: red, p: [-0.72, 1.06, 0.4] },
    { g: cyl(0.03, 0.03, 0.4, 8), c: dark, p: [0, 1.2, -0.45], r: [-0.5, 0, 0] },
    { g: cyl(0.14, 0.14, 0.04, 16), c: dark, p: [0, 1.38, -0.55], r: [1.0, 0, 0] },
    { g: cyl(0.04, 0.04, 0.3, 8), c: dark, p: [0.52, 1.3, -1.0] },
    { g: box(0.08, 0.08, 0.75), c: dark, p: [0.45, 0.45, -1.45] },
    { g: box(0.08, 0.08, 0.75), c: dark, p: [-0.45, 0.45, -1.45] },
  ]);
}

// Tractor wheel with its axle along x; the light spoke makes the spin visible.
export function tractorWheelGeometry(r: number, w: number): THREE.BufferGeometry {
  return build([
    { g: cyl(r, r, w, 18), c: 0x1e1e1e, r: [0, 0, Math.PI / 2] },
    { g: cyl(r * 0.45, r * 0.45, w + 0.02, 12), c: 0xffd23f, r: [0, 0, Math.PI / 2] },
    { g: box(w + 0.04, r * 1.7, 0.08), c: 0xfff0c0 },
  ]);
}

// Plow blade 1 m wide (scaled to the plow width along x), 0.9 m high, centred on its middle.
export function plowBladeGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(1, 0.9, 0.08), c: 0xffd23f },
    { g: box(1, 0.08, 0.16), c: 0x6a6a6a, p: [0, -0.41, -0.04] },
  ]);
}

// Magnet Gun held in the hand: the grip top is the origin, the barrel points along -z,
// a red horseshoe magnet with silver tips sits at the muzzle (tip faces at z -0.485).
export function magnetGunGeometry(): THREE.BufferGeometry {
  const red = 0xd8352a;
  const silver = 0xd8dde4;
  return build([
    { g: box(0.07, 0.08, 0.26), c: 0x3a3f4a, p: [0, 0, -0.1] },
    { g: box(0.03, 0.02, 0.2), c: 0x6a7380, p: [0, 0.05, -0.1] },
    { g: box(0.05, 0.15, 0.07), c: 0x2a2a2a, p: [0, -0.1, 0.01], r: [-0.3, 0, 0] },
    { g: cyl(0.025, 0.025, 0.12, 12), c: 0x8a9099, p: [0, 0, -0.29], r: [Math.PI / 2, 0, 0] },
    // half ring closing the horseshoe behind the prongs, opening towards -z
    { g: new THREE.TorusGeometry(0.04, 0.018, 10, 16, Math.PI), c: red, p: [0, 0, -0.39], r: [Math.PI / 2, 0, 0] },
    { g: box(0.036, 0.036, 0.07), c: red, p: [0.04, 0, -0.425] },
    { g: box(0.036, 0.036, 0.07), c: red, p: [-0.04, 0, -0.425] },
    { g: box(0.038, 0.038, 0.025), c: silver, p: [0.04, 0, -0.4725] },
    { g: box(0.038, 0.038, 0.025), c: silver, p: [-0.04, 0, -0.4725] },
  ]);
}

// Two copper coil rings around the gun body; their material glows while the gun pulls.
export function magnetGunCoilGeometry(): THREE.BufferGeometry {
  return build([
    { g: new THREE.TorusGeometry(0.05, 0.013, 10, 24), c: 0xc8743a, p: [0, 0, -0.13] },
    { g: new THREE.TorusGeometry(0.05, 0.013, 10, 24), c: 0xc8743a, p: [0, 0, -0.19] },
  ]);
}

// Cleaning robot without its bed: ground at y 0, front towards +z. A round body with a glass dome and
// an antenna at the back, a low deck in front that carries the bed.
export function robotGeometry(): THREE.BufferGeometry {
  const teal = 0x2fa8b8;
  const dark = 0x23272e;
  return build([
    { g: cyl(0.6, 0.6, 0.26, 24), c: teal, p: [0, 0.2, -0.3] },
    { g: cyl(0.63, 0.63, 0.08, 24), c: dark, p: [0, 0.08, -0.3] },
    { g: box(1.0, 0.2, 0.8), c: teal, p: [0, 0.2, 0.45] },
    { g: box(1.04, 0.08, 0.84), c: dark, p: [0, 0.08, 0.45] },
    { g: new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c: 0x9fd8ff, p: [0, 0.33, -0.5] },
    { g: sph(0.05, 8, 6), c: 0x111111, p: [-0.11, 0.5, -0.24] },
    { g: sph(0.05, 8, 6), c: 0x111111, p: [0.11, 0.5, -0.24] },
    { g: new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), c: dark, p: [0.2, 0.75, -0.6] },
    { g: sph(0.05, 8, 6), c: 0xff4a3a, p: [0.2, 0.99, -0.6] },
  ]);
}

// Open-top robot bed 1.1 x 0.25 x 1.0; the origin is its front bottom edge (the tipping hinge), the bed lies along -z.
export function robotBedGeometry(): THREE.BufferGeometry {
  const orange = 0xff8a2a;
  return build([
    { g: box(1.1, 0.04, 1.0), c: 0xd86a1a, p: [0, 0.02, -0.5] },
    { g: box(1.1, 0.25, 0.04), c: orange, p: [0, 0.125, -0.98] },
    { g: box(0.04, 0.25, 1.0), c: orange, p: [-0.53, 0.125, -0.5] },
    { g: box(0.04, 0.25, 1.0), c: orange, p: [0.53, 0.125, -0.5] },
    { g: box(1.1, 0.12, 0.04), c: orange, p: [0, 0.06, -0.02] },
  ]);
}

// Fuse box mounted on a tool: front face towards +z, origin at its centre.
export function fuseBoxGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(0.36, 0.22, 0.08), c: 0x1e2126 },
    { g: box(0.38, 0.03, 0.1), c: 0x2f333a, p: [0, 0.125, 0] },
  ]);
}

// One blade fuse, white so the instance colour tints it red or green; origin at the body centre.
export function fuseGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(0.06, 0.1, 0.025), c: 0xffffff },
    { g: box(0.012, 0.03, 0.01), c: 0xd0d0d0, p: [-0.018, -0.06, 0] },
    { g: box(0.012, 0.03, 0.01), c: 0xd0d0d0, p: [0.018, -0.06, 0] },
  ]);
}

// Factory lever, fixed part: a post with a housing on top (pivot at y 1.05).
export function leverBaseGeometry(): THREE.BufferGeometry {
  const dark = 0x2a2d33;
  return build([
    { g: cyl(0.06, 0.06, 1.0), c: dark, p: [0, 0.5, 0] },
    { g: box(0.3, 0.36, 0.14), c: dark, p: [0, 1.05, 0] },
  ]);
}

// Factory lever, moving part: the arm and its knob, origin at the pivot.
export function leverArmGeometry(): THREE.BufferGeometry {
  return build([
    { g: box(0.05, 0.3, 0.05), c: 0x8a9099, p: [0, 0.15, 0] },
    { g: cyl(0.05, 0.05, 0.06), c: 0xffd23f, p: [0, 0.32, 0] },
  ]);
}

// Leaf blower held in the hand: the grip is the origin, the tube points along -z.
export function blowerGeometry(): THREE.BufferGeometry {
  const orange = 0xff8a2a;
  const dark = 0x2a2d33;
  return build([
    { g: box(0.18, 0.2, 0.24), c: orange, p: [0, -0.02, 0.06] },
    { g: box(0.04, 0.12, 0.04), c: dark, p: [0, 0.13, 0.03] },
    { g: box(0.04, 0.04, 0.16), c: dark, p: [0, 0.2, 0.03] },
    { g: new THREE.CylinderGeometry(0.045, 0.06, 0.8, 12), c: 0x8a9099, p: [0, -0.04, -0.45], r: [Math.PI / 2, 0, 0] },
    { g: new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), c: dark, p: [0, -0.04, -0.86], r: [Math.PI / 2, 0, 0] },
  ]);
}
