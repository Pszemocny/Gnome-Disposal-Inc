import { ctx } from '../core/context';
import { outCubic } from '../core/ease';

const FREEZE = 0.08; // hit-stop at scale 0
const SLOW = 0.6; // at LOW
const EASE = 0.4; // LOW back to 1
const LOW = 0.25;
const COOLDOWN = 5;
const COMBO_MARKS = [60, 100];

// Slow-mo moments: the combo crossing 60 / 100 or an eaten King freezes the game for a moment, then plays it at quarter speed.
export class Slowmo {
  private t = Infinity; // real seconds since the current slow-mo started
  private cd = 0;
  private seen = false;
  private kings = 0;
  private combo = 0;

  // multiplies the game dt in main.ts; 1 outside a slow-mo
  get scale(): number {
    const t = this.t;
    if (t < FREEZE) return 0;
    if (t < FREEZE + SLOW) return LOW;
    if (t < FREEZE + SLOW + EASE) return LOW + (1 - LOW) * outCubic((t - FREEZE - SLOW) / EASE);
    return 1;
  }

  // dt must be real time: a scaled dt would never end the freeze
  update(dt: number): void {
    this.t += dt;
    this.cd -= dt;
    const s = ctx.state.stats;
    const kings = s.typesEaten.king ?? 0;
    const combo = ctx.hole.combo;
    // the first frame only records the counters, so a loaded save does not trigger
    if (this.seen && this.cd <= 0 && (kings > this.kings || COMBO_MARKS.some((m) => this.combo < m && combo >= m))) {
      this.t = 0;
      this.cd = COOLDOWN;
      ctx.audio.rumble(0.3);
    }
    this.seen = true;
    this.kings = kings;
    this.combo = combo;
  }
}
