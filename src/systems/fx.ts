import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { ctx, rand } from '../core/context';
import { glowTexture } from '../entities/mushrooms';

class ParticlePool {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private next = 0;

  constructor(private n: number, size: number, private gravity: number, opacity: number, blending: THREE.Blending) {
    this.pos = new Float32Array(n * 3).fill(-999);
    // RGBA: three switches PointsMaterial to per-vertex alpha when the colour attribute has 4 components
    this.col = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending });
    mat.onBeforeCompile = (s) => {
      s.vertexShader = 'attribute float aSize;\n' + s.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
    };
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    ctx.scene.add(this.points);
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, life: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b, 1], i * 4);
    this.size[i] = rand(0.6, 1.4);
    this.life[i] = life;
    this.maxLife[i] = life;
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.pos[k + 1] = -999;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      // alpha follows the remaining life; additive blending uses SRC_ALPHA, so sparks fade to nothing too
      this.col[i * 4 + 3] = this.life[i] / this.maxLife[i];
      this.vel[k + 1] -= this.gravity * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true;
    a.color.needsUpdate = true;
    a.aSize.needsUpdate = true;
  }
}

interface FloatText {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  t: number;
}

export class Fx {
  private sparks = new ParticlePool(1500, 0.14, 12, 1, THREE.AdditiveBlending);
  // additive black is invisible, so dark bursts (stalker vanish, shadow hats) blend normally
  private darkSparks = new ParticlePool(300, 0.14, 12, 1, THREE.NormalBlending);
  private puffs = new ParticlePool(300, 0.7, -1.5, 0.9, THREE.NormalBlending);
  private texts: FloatText[] = [];
  stats = { dust: 0 };
  private trauma = 0;
  private noise = new SimplexNoise();
  private layer: HTMLDivElement;
  private tmp = new THREE.Vector3();
  private col = new THREE.Color();

  constructor() {
    this.layer = document.createElement('div');
    this.layer.className = 'float-layer';
    document.body.appendChild(this.layer);
  }

  burst(p: THREE.Vector3, color: number, n: number): void {
    this.col.setHex(color);
    const pool = this.col.r * 0.3 + this.col.g * 0.59 + this.col.b * 0.11 < 0.05 ? this.darkSparks : this.sparks;
    for (let i = 0; i < n; i++) {
      pool.emit(p, this.tmp.set(rand(-4, 4), rand(2, 8), rand(-4, 4)), this.col, rand(0.5, 1.1));
    }
  }

  puff(p: THREE.Vector3, color: number): void {
    this.col.setHex(color);
    this.puffs.emit(p, this.tmp.set(rand(-0.4, 0.4), rand(0.8, 1.6), rand(-0.4, 0.4)), this.col, rand(1, 1.8));
  }

  // Landing dust: brownish puffs spreading sideways along the ground.
  dust(p: THREE.Vector3, strength: number): void {
    this.stats.dust++;
    const n = 6 + Math.round(Math.min(1, strength) * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      const s = rand(1.5, 3) * (0.6 + strength);
      // light dusty beige: the darker brown blended into the grass texture and was barely visible
      this.col.setRGB(rand(0.8, 0.88), rand(0.72, 0.78), rand(0.56, 0.62));
      this.puffs.emit(p, this.tmp.set(Math.cos(a) * s, rand(0.2, 0.8), Math.sin(a) * s), this.col, rand(0.5, 0.9));
    }
  }

  wind(p: THREE.Vector3, dir: THREE.Vector3): void {
    this.col.setHex(0xe8f6ff);
    this.puffs.emit(p.clone().add(this.tmp.set(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5))), dir.clone().multiplyScalar(8), this.col, 0.6);
  }

  floatText(p: THREE.Vector3, text: string, color = '#fff'): void {
    if (this.texts.length > 30) {
      const old = this.texts.shift()!;
      old.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color;
    this.layer.appendChild(el);
    this.texts.push({ el, pos: p.clone().add(this.tmp.set(rand(-0.6, 0.6), 0, rand(-0.6, 0.6))), t: 0 });
  }

  /** Camera shake level 0..1, for the measurement lines. */
  get shakeLevel(): number {
    return this.trauma;
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  shakeOffset(out: THREE.Euler): void {
    // noise in [-1, 1] per axis: vector magnitude stays <= 0.028 * sqrt(3) < 0.05 rad
    const s = this.trauma * this.trauma * 0.028;
    const t = ctx.time * 15;
    out.set(this.noise.noise(t, 0) * s, this.noise.noise(t, 10) * s, this.noise.noise(t, 20) * s);
  }

  update(dt: number): void {
    this.sparks.update(dt);
    this.darkSparks.update(dt);
    this.puffs.update(dt);
    this.trauma = Math.max(0, this.trauma - dt / 0.6);
    const cam = ctx.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const f = this.texts[i];
      f.t += dt;
      f.pos.y += dt * 1.2;
      if (f.t > 1.3) {
        f.el.remove();
        this.texts.splice(i, 1);
        continue;
      }
      this.tmp.copy(f.pos).project(cam);
      if (this.tmp.z > 1) {
        f.el.style.display = 'none';
        continue;
      }
      f.el.style.display = '';
      f.el.style.transform = `translate(${((this.tmp.x + 1) / 2) * w}px, ${((1 - this.tmp.y) / 2) * h}px) translate(-50%, -50%) scale(${1 + Math.min(f.t * 3, 0.3)})`;
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.8) * 2);
    }
  }
}
