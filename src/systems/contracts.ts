import { ctx, lvl, pick } from '../core/context';
import { inQuad, outBack } from '../core/ease';
import { money, num } from '../core/format';
import { crateCap, type Machine } from '../entities/machines';

// Round contracts: one timed task at a time in a panel under the GOAL panel (left column). Not saved: a reload rolls a new one.
interface Def {
  id: string;
  title: (n: number) => string;
  target: () => number;
  time: number; // seconds
  hard: boolean; // reward x1.5
  ok: () => boolean; // offered only while possible; an active contract that stops being possible fails at once
  offer?: () => boolean; // checked only when rolling a new contract: a running one keeps running when it turns false
  value: () => number; // counter read each frame; progress = increase since the start
  peak?: boolean; // progress = highest value seen (combo), not the increase
}

const st = () => ctx.state.stats;
const L = () => ctx.state.holeLevel;
const always = () => true;

const FIRST_AFTER = 120; // s of game time, if the first goal is not done by then
const NEXT_AFTER_DONE = 0.6;
const NEXT_AFTER_FAIL = 10;
const POP_IN = 0.3;
const POP_OUT = 0.2;

export class Contracts {
  // counters the game does not keep: full crate dumps and kings eaten while the player drives the tractor
  private fullDumps = 0;
  private plowKings = 0;
  private lastDumps = st().crateDumps;
  private lastKings = st().typesEaten.king ?? 0;
  private queues = new WeakMap<Machine, number>();

  private readonly defs: Def[] = [
    { id: 'feed', title: (n) => `Feed ${n} gnomes to the hole`, target: () => Math.min(50, 10 + 4 * L()), time: 60, hard: false, ok: always, value: () => st().gnomesEaten },
    { id: 'long', title: (n) => `${n} LONG SHOTs (throw from 8 m+)`, target: () => 3, time: 90, hard: false, ok: always, value: () => st().longShots },
    { id: 'air', title: (n) => `${n} AIR shots (into the hole, no bounce)`, target: () => 5, time: 90, hard: false, ok: always, value: () => st().airShots },
    { id: 'bullseye', title: () => 'BULLSEYE: throw through the golden hoop', target: () => 1, time: 120, hard: true, ok: () => !!ctx.hole.ring, value: () => st().bullseyes },
    { id: 'crate', title: () => 'Dump a FULL crate into the hole', target: () => 1, time: 120, hard: true, ok: () => ctx.machines.list.some((m) => m.type === 'box'), value: () => this.fullDumps },
    { id: 'king', title: () => 'Push the KING into the hole with the plow tractor', target: () => 1, time: 180, hard: true, ok: () => lvl('tractor') > 0 && ctx.gnomes.list.some((g) => g.type.id === 'king'), value: () => this.plowKings },
    { id: 'combo', title: (n) => `Reach a x${n} combo`, target: () => (L() >= 8 ? 60 : L() >= 4 ? 30 : 15), time: 60, hard: true, ok: () => this.current?.id === 'combo' || ctx.hole.combo === 0, value: () => ctx.hole.combo, peak: true }, // offered only with no running combo, or it could complete at once
    // massive gnomes roll from hole level 4 (3 %), the odds grow with the level;
    // with Feeding Frenzy every gnome is a haul: not offered, but one running when Frenzy is bought keeps running (2026-10-25)
    { id: 'haul', title: (n) => `${n} HEAVY HAUL (feed massive gnomes)`, target: () => (L() >= 7 ? 3 : 1), time: 90, hard: true, ok: () => L() >= 4, offer: () => !lvl('frenzy'), value: () => st().hauls },
  ];

  current: Def | null = null;
  target = 0;
  reward = 0;
  timeLeft = 0;
  have = 0;
  private base = 0;
  private wait = 0; // seconds until the next contract (after the first one)
  private started = false;
  private lastId = '';
  private popT = 0; // time since the panel popped in or started to pop out
  private leaving = false;

  private el: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private rewardEl: HTMLSpanElement;
  private numEl: HTMLDivElement;
  private timeEl: HTMLSpanElement;
  private fill: HTMLDivElement;
  private key = '';

  constructor() {
    const style = document.createElement('style');
    style.textContent = `
.hud-contract { flex-shrink: 0; background: var(--panel); border: 2px solid #ffd23f; border-radius: 10px; padding: 8px 12px; transform-origin: top left; display: none; }
.ct-head { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 2px; color: #ffd23f; font-weight: 700; }
.ct-reward { letter-spacing: 0; font-size: 14px; color: #3adf6a; }
.ct-text { font-size: 15px; margin: 2px 0 6px; }
.ct-bar { height: 8px; background: rgba(0,0,0,.45); border-radius: 4px; overflow: hidden; }
.ct-fill { height: 100%; background: linear-gradient(90deg, #ff5a5a, #ffd23f); }
.ct-num { display: flex; justify-content: space-between; font-size: 12px; opacity: .85; margin-top: 2px; }`;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'hud-contract';
    this.el.innerHTML = '<div class="ct-head"><span>CONTRACT</span><span class="ct-reward"></span></div><div class="ct-text"></div><div class="ct-bar"><div class="ct-fill"></div></div><div class="ct-num"><span class="ct-have"></span><span class="ct-time"></span></div>';
    // second in the left column: under GOAL, above the effects panel and the messages
    ctx.hud.left.insertBefore(this.el, ctx.hud.left.children[1]);
    this.titleEl = this.el.querySelector('.ct-text')!;
    this.rewardEl = this.el.querySelector('.ct-reward')!;
    this.numEl = this.el.querySelector('.ct-have')!;
    this.timeEl = this.el.querySelector('.ct-time')!;
    this.fill = this.el.querySelector('.ct-fill')!;
  }

  // about 45 s of normal play at this hole level (25 gnomes at $1 x everything that scales money), x1.5 for hard ones
  private rewardFor(d: Def): number {
    return Math.round(25 * (1 + lvl('batch')) * ctx.hole.valueScale * (d.hard ? 1.5 : 1));
  }

  private roll(): void {
    const pool = this.defs.filter((d) => d.ok() && (d.offer?.() ?? true));
    const fresh = pool.filter((d) => d.id !== this.lastId);
    const d = pick(fresh.length ? fresh : pool);
    this.current = d;
    this.lastId = d.id;
    this.target = d.target();
    this.reward = this.rewardFor(d);
    this.timeLeft = d.time;
    this.base = d.value();
    this.have = 0;
    this.popT = 0;
    this.leaving = false;
    this.key = '';
    this.el.style.display = 'block';
    ctx.audio.toast();
  }

  private end(done: boolean): void {
    if (done) {
      ctx.coins.burst(this.reward, ctx.hole.holeOrigin, 2);
      ctx.hud.bigText('CONTRACT DONE', '#3adf6a', '+' + money(this.reward), 1.2);
      ctx.hud.moneyPulse(1);
      ctx.audio.fanfare(4);
      ctx.fx.burst(ctx.hole.holeOrigin.setY(0.8), 0x3adf6a, 24);
    } else {
      ctx.hud.toast('Contract failed', 'bad');
      ctx.audio.deny();
    }
    this.current = null;
    this.wait = done ? NEXT_AFTER_DONE : NEXT_AFTER_FAIL;
    this.leaving = true;
    this.popT = 0;
  }

  private track(): void {
    const s = st();
    if (s.crateDumps > this.lastDumps) {
      for (const m of ctx.machines.list) {
        if (m.type === 'box' && m.queue.length === 0 && (this.queues.get(m) ?? 0) >= crateCap()) this.fullDumps++;
      }
    }
    this.lastDumps = s.crateDumps;
    for (const m of ctx.machines.list) if (m.type === 'box') this.queues.set(m, m.queue.length);
    const kings = s.typesEaten.king ?? 0;
    if (kings > this.lastKings && ctx.player.sweeper.gear === 'tractor') this.plowKings += kings - this.lastKings;
    this.lastKings = kings;
  }

  update(dt: number): void {
    this.track();
    if (!this.started) {
      if (!ctx.goals.firstDone && ctx.time < FIRST_AFTER) return;
      this.started = true;
      this.roll();
    }
    const d = this.current;
    if (d) {
      const v = d.value();
      this.have = Math.min(this.target, d.peak ? Math.max(this.have, v) : Math.max(0, v - this.base));
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.have >= this.target) this.end(true);
      else if (this.timeLeft <= 0 || !d.ok()) this.end(false);
    } else {
      this.wait -= dt;
      if (this.wait <= 0) this.roll();
    }
    this.draw(dt);
  }

  private draw(dt: number): void {
    this.popT += dt;
    if (this.leaving) {
      const k = Math.min(1, this.popT / POP_OUT);
      this.el.style.transform = `scale(${1 - inQuad(k)})`;
      if (k >= 1) this.el.style.display = 'none';
      return;
    }
    this.el.style.transform = `scale(${outBack(Math.min(1, this.popT / POP_IN))})`;
    const d = this.current;
    if (!d) return;
    const key = `${d.id}|${Math.floor(this.have)}|${Math.ceil(this.timeLeft)}`;
    if (key !== this.key) {
      this.key = key;
      this.titleEl.textContent = d.title(this.target);
      this.rewardEl.textContent = '+' + money(this.reward);
      this.numEl.textContent = `${num(this.have)} / ${num(this.target)}`;
      this.timeEl.textContent = `${Math.ceil(this.timeLeft)} s`;
    }
    this.fill.style.width = `${(this.timeLeft / d.time) * 100}%`;
  }
}
