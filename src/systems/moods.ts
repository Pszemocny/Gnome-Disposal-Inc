import { ctx, rand } from '../core/context';
import { GNOME_TYPES, TYPE_BY_ID } from '../data/gnomeTypes';

// Hole Moods: every 150-200 s (from hole level 2) the hole craves one gnome type, which pays x3 for 45 s.
// The hole also comments on the player's throws. Nothing is saved: a reload rolls a fresh wait.
const FIRST_LEVEL = 2;
const WAIT = [150, 200];
const CRAVE_TIME = 45;
const CRAVE_MULT = 3;
const NEVER = ['classic', 'blue', 'king'];
const TAUNT_EVERY = 10; // s between looks at the stats
const TAUNT_CD = 20; // at most one taunt per 20 s
const MISSES = 5;

export class Moods {
  craving: string | null = null;
  timeLeft = 0;
  private wait = rand(WAIT[0], WAIT[1]);
  private tauntT = 0;
  private tauntCd = 0;
  private misses = 0;
  private lastThrown = ctx.state.stats.thrown;
  private lastEaten = ctx.state.stats.gnomesEaten;
  private lastLong = ctx.state.stats.longShots;

  // types the hole may crave right now: unlocked, rolled by the factory (weight > 0), not the plain ones
  pool(): string[] {
    const hl = ctx.state.holeLevel;
    return GNOME_TYPES.filter((t) => t.weight > 0 && t.unlock <= hl && !NEVER.includes(t.id)).map((t) => t.id);
  }

  start(typeId: string, time = CRAVE_TIME): void {
    this.craving = typeId;
    this.timeLeft = time;
    const name = TYPE_BY_ID[typeId].name.toUpperCase() + 'S';
    ctx.hud.banner(`THE HOLE CRAVES: ${name}`, `They pay x${CRAVE_MULT} for ${time} s`);
    ctx.hud.toast(`The hole craves ${name}: x${CRAVE_MULT} for ${time} s`, 'secret');
    ctx.audio.whisper();
  }

  private end(): void {
    const name = TYPE_BY_ID[this.craving!].name.toUpperCase() + 'S';
    this.craving = null;
    for (const g of ctx.gnomes.list) g.valueMult = 1;
    ctx.hud.banner('THE HOLE IS SATED', `No more x${CRAVE_MULT} for ${name}`);
    this.wait = rand(WAIT[0], WAIT[1]);
  }

  update(dt: number): void {
    if (this.craving) {
      for (const g of ctx.gnomes.list) g.valueMult = g.type.id === this.craving ? CRAVE_MULT : 1;
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.end();
    } else if (ctx.state.holeLevel >= FIRST_LEVEL) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const pool = this.pool();
        if (pool.length) this.start(pool[Math.floor(Math.random() * pool.length)]);
        else this.wait = rand(WAIT[0], WAIT[1]);
      }
    }

    this.tauntCd -= dt;
    this.tauntT += dt;
    if (this.tauntT < TAUNT_EVERY) return;
    this.tauntT = 0;
    const st = ctx.state.stats;
    const thrown = st.thrown - this.lastThrown;
    const eaten = st.gnomesEaten - this.lastEaten;
    const long = st.longShots - this.lastLong;
    this.lastThrown = st.thrown;
    this.lastEaten = st.gnomesEaten;
    this.lastLong = st.longShots;
    this.misses = eaten > 0 ? 0 : this.misses + thrown;
    if (this.tauntCd > 0) return;
    if (long > 0) this.taunt('Ooh.');
    else if (this.misses >= MISSES) {
      this.misses = 0;
      this.taunt('Five misses. Pathetic.');
    }
  }

  private taunt(text: string): void {
    this.tauntCd = TAUNT_CD;
    ctx.hud.toast(text, 'secret');
    ctx.audio.whisper();
  }
}
