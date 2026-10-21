import * as THREE from 'three';
import { ctx } from '../core/context';
import { FUSE_TOOLS, TOOL_IDS, type Tab } from '../data/upgrades';
import { machineVisual } from '../entities/machines';
import { blowerGeometry, magnetGunCoilGeometry, magnetGunGeometry, plowBladeGeometry, tractorGeometry, tractorWheelGeometry, vcMat } from '../world/models';
import { TOOL_ICONS } from './hud';

// shop badges: emoji for stat upgrades, a picture of the model for things you place or hold
export const ICONS: Record<string, string> = {
  ...TOOL_ICONS,
  kick: '🦶', tractor: '🚜', plowWidth: '📏', blower: '🍃', blowPower: '💨', blowRange: '🎯',
  magGun: '🧲', magPower: '🔋', magRange: '📡', throw: '💪', scope: '🔭',
  factorySpeed: '⚙️', batch: '👥', autocrank: '🔁', value: '💰', permit: '📜', glue: '🧴', frenzy: '🍖',
  speed: '👟', jump: '🧦', boots: '👢', magnetRange: '🪙', laptop: '💻',
  crateSize: '📐', robotBed: '🛏️', robotSpeed: '⚡', robotArea: '🗺️', fanPower: '🌀', beltWidth: '↔️',
  comboWindow: '⏱️', comboCap: '🔥', comboInsurance: '🛡️', jackpot: '🎰',
  mushChance: '🍄', mushTime: '⏳', goldChance: '✨', hunger: '🍴', lucky: '🍀',
  dValue: '💎', dStart: '🎁', dTools: '🧰', dCombo: '🔥', dXp: '🕳️',
};
for (const id of FUSE_TOOLS) ICONS[`${id}Fuses`] = '🔌';
export const FALLBACK_ICON = '🔧';
export const TAB_ICONS: Record<Tab, string> = { Plow: '🚜', Magnet: '🧲', Factory: '🏭', Movement: '👟', Tools: '🧰', Combos: '🔥', Bonuses: '🍀', Land: '🌳', Deep: '💎' };
export const LAND_ICONS = ['🏡', '🌷', '🌳', '🌲'];

// the same assembly as the player's tractor (sweeper.ts) and the Magnet Gun view model (player.ts)
function tractor(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = vcMat();
  const blade = new THREE.Mesh(plowBladeGeometry(), mat);
  blade.position.set(0, 0.45, -1.85);
  g.add(new THREE.Mesh(tractorGeometry(), mat), blade);
  for (const [x, z, r, w] of [[0.72, 0.4, 0.5, 0.3], [-0.72, 0.4, 0.5, 0.3], [0.6, -0.85, 0.32, 0.2], [-0.6, -0.85, 0.32, 0.2]]) {
    const wheel = new THREE.Mesh(tractorWheelGeometry(r, w), mat);
    wheel.position.set(x, r, z);
    g.add(wheel);
  }
  return g;
}

// exported so a scenario can add a builder that fails
export const MODELS: Record<string, () => THREE.Object3D> = {
  ...Object.fromEntries(TOOL_IDS.map((id) => [id, () => machineVisual(id).root])),
  tractor,
  blower: () => new THREE.Mesh(blowerGeometry(), vcMat()),
  magGun: () => new THREE.Group().add(new THREE.Mesh(magnetGunGeometry(), vcMat()), new THREE.Mesh(magnetGunCoilGeometry(), vcMat())),
};

const cache = new Map<string, string | null>();
let warmed = false;

export function thumbnail(id: string): string | undefined {
  return cache.get(id) ?? undefined;
}

// Renders every model once per session on its own short-lived renderer, so the game renderer's state
// (viewport, exposure changed by the weather) is never touched. A builder that fails leaves its emoji.
export function warmThumbnails(ids: string[]): void {
  if (warmed) return;
  warmed = true;
  const S = 60;
  let r: THREE.WebGLRenderer;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return;
  }
  try {
    r.setPixelRatio(ctx.renderer.getPixelRatio());
    r.setSize(S, S, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2), sun, sun.target);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const dir = new THREE.Vector3(1, 0.8, 1.2).normalize();
    for (const id of ids) {
      try {
        const obj = MODELS[id]();
        // placement hint rings (magnet drop ring, robot work area) are not part of the model
        // and the robot station: the badge shows the truck
        obj.traverse((o) => { if (o.name === 'drop' || o.name === 'station') o.visible = false; });
        // Box3 counts hidden children too, so measure only what is drawn
        const box = new THREE.Box3();
        obj.updateWorldMatrix(true, true);
        obj.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) box.expandByObject(o); });
        if (box.isEmpty()) {
          cache.set(id, null);
          continue;
        }
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        cam.position.copy(sphere.center).addScaledVector(dir, (sphere.radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.05);
        cam.lookAt(sphere.center);
        sun.position.copy(sphere.center).add(new THREE.Vector3(3, 5, 4));
        sun.target.position.copy(sphere.center);
        scene.add(obj);
        r.render(scene, cam);
        cache.set(id, r.domElement.toDataURL('image/png'));
        scene.remove(obj);
        // only what was drawn was uploaded; hidden parts may be shared with the world (robot hats)
        obj.traverseVisible((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          for (const mat of [m.material].flat()) mat.dispose();
        });
      } catch {
        cache.set(id, null);
      }
    }
  } finally {
    r.dispose();
    r.forceContextLoss();
  }
}
