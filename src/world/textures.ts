import * as THREE from 'three';

// CC0 textures (see public/textures/CREDITS.md).
const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function tex(name: string, repeatX = 1, repeatY = repeatX, srgb = true): THREE.Texture {
  const key = `${name}:${repeatX}:${repeatY}`;
  let t = cache.get(key);
  if (t) return t;
  // one texture per repeat setting; the browser caches the file itself
  t = loader.load(`${import.meta.env.BASE_URL}textures/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
