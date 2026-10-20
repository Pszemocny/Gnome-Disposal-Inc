import { ctx } from '../core/context';
import { GNOME_TYPES } from '../data/gnomeTypes';

const FRAMES = 600; // 10 s at the 60 fps cap
const MAX = 320; // the permit cap; rain can briefly exceed it, the rest is clamped away in the replay
const KEY = 'KeyI';
const TYPES = GNOME_TYPES.length;

// Instant replay: a ring of the last FRAMES drawn gnome matrices and camera poses. Playback writes only
// the instance buffers and the camera; bodies, timers and state are never read or written.
export class Replay {
  playing = false;
  private buf = new Float32Array(FRAMES * MAX * 16);
  private cam = new Float32Array(FRAMES * 8);
  private counts = new Uint16Array(FRAMES * TYPES);
  private head = 0; // the next frame to write
  private size = 0;
  private pos = 0;

  get bytes(): number {
    return this.buf.byteLength + this.cam.byteLength + this.counts.byteLength;
  }

  // After writeInstances(): copies every gnome's body matrix of this frame. Part-drawn gnomes replay as one piece;
  // the rollout of moving parts to all types records the pose too.
  record(): void {
    const f = this.head;
    let used = 0;
    for (let t = 0; t < TYPES; t++) {
      const id = GNOME_TYPES[t].id;
      const n = Math.min(ctx.gnomes.slots.get(id)!.length, MAX - used);
      this.buf.set(ctx.gnomes.bodies.get(id)!.subarray(0, n * 16), (f * MAX + used) * 16);
      this.counts[f * TYPES + t] = n;
      used += n;
    }
    const c = ctx.camera;
    c.position.toArray(this.cam, f * 8);
    c.quaternion.toArray(this.cam, f * 8 + 3);
    this.cam[f * 8 + 7] = c.fov;
    this.head = (f + 1) % FRAMES;
    this.size = Math.min(this.size + 1, FRAMES);
  }

  update(realDt: number): void {
    if (ctx.paused) {
      if (this.playing) this.stop();
      return;
    }
    if (!this.playing) {
      // nothing recorded yet (first live frame): the key does nothing; later it plays what there is, up to 10 s
      if (!ctx.input.hit(KEY) || this.size === 0) return;
      this.pos = 0;
      this.playing = true;
      for (const bm of ctx.gnomes.parts.values()) bm.visible = false;
      ctx.hud.bigText('INSTANT REPLAY', '#5fd0ff', 'I to skip');
    } else {
      this.pos += realDt * 60;
      if (this.pos >= this.size || ctx.input.hit(KEY)) {
        this.stop();
        return;
      }
    }
    this.show(Math.floor(this.pos));
  }

  private stop(): void {
    this.playing = false;
    for (const bm of ctx.gnomes.parts.values()) bm.visible = true;
    // rewrites every mesh and its count from the live gnomes
    ctx.gnomes.writeInstances();
  }

  // k = 0 is the oldest recorded frame
  private show(k: number): void {
    const f = (this.head - this.size + k + FRAMES) % FRAMES;
    let used = 0;
    for (let t = 0; t < TYPES; t++) {
      const mesh = ctx.gnomes.meshes.get(GNOME_TYPES[t].id)!;
      const n = this.counts[f * TYPES + t];
      const at = (f * MAX + used) * 16;
      mesh.instanceMatrix.array.set(this.buf.subarray(at, at + n * 16));
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      used += n;
    }
    const c = ctx.camera;
    c.position.fromArray(this.cam, f * 8);
    c.quaternion.fromArray(this.cam, f * 8 + 3);
    c.fov = this.cam[f * 8 + 7];
    c.updateProjectionMatrix();
  }
}

export const replay = new Replay();
