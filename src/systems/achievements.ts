import { ctx } from '../core/context';
import { ACHIEVEMENTS } from '../data/achievements';
import { LAND } from '../data/land';

export class Achievements {
  private t = 0;

  has(id: string): boolean {
    return ctx.state.achievements.includes(id);
  }

  unlock(id: string): void {
    if (this.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    ctx.state.achievements.push(id);
    ctx.hud.achievement(a.name, a.desc);
    ctx.audio.toast();
  }

  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    const s = ctx.state;
    const st = s.stats;
    const checks: [string, boolean][] = [
      ['first', st.gnomesEaten >= 1],
      ['g100', st.gnomesEaten >= 100],
      ['g1000', st.gnomesEaten >= 1000],
      ['g10000', st.gnomesEaten >= 10000],
      ['combo15', st.maxCombo >= 15],
      ['combo60', st.maxCombo >= 60],
      ['combo100', st.maxCombo >= 100],
      ['m1k', s.lifetimeEarned >= 1e3],
      ['m1m', s.lifetimeEarned >= 1e6],
      ['m1b', s.lifetimeEarned >= 1e8], // "Gnome Baron": $100m, $1b was out of reach (night balance F13)
      ['hole5', s.holeLevel >= 5],
      ['hole10', s.holeLevel >= 10],
      ['land', s.land >= LAND.length - 1],
    ];
    for (const [id, ok] of checks) if (ok) this.unlock(id);
  }
}
