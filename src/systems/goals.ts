import type * as THREE from 'three';
import { ctx } from '../core/context';
import { money } from '../core/format';
import { MAX_HOLE_LEVEL } from '../data/holeLevels';

declare module '../core/state' {
  interface GameState {
    // old index model (night plan F8), read once to build goalsDone
    goal2?: number;
    goalBase2?: number;
    // ids of finished goals and lessons: each pays once, and the lists can be reordered without re-paying
    goalsDone?: string[];
    // start value of every running relative goal, by id
    goalStart?: Record<string, number>;
  }
}

type Where = 'factory' | 'hole' | 'shop' | 'crate' | null;

interface Goal {
  id: string;
  text: string;
  target: number;
  // relative goals count from the moment the goal starts, absolute ones read the value as is
  value: () => number;
  relative: boolean;
  reward: number;
  where: Where; // the HUD waypoint points here
}

// a lesson waits for the hole level where its mechanic can first appear
type Lesson = Goal & { from: number };

type Progress = { text: string; have: number; need: number };

const st = () => ctx.state.stats;
const typeEaten = (id: string) => () => st().typesEaten[id] ?? 0;
const rel = (id: string, text: string, target: number, value: () => number, reward: number, where: Where): Goal => ({ id, text, target, value, relative: true, reward, where });
const abs = (id: string, text: string, target: number, value: () => number, reward: number, where: Where): Goal => ({ id, text, target, value, relative: false, reward, where });
const lesson = (from: number, g: Goal): Lesson => ({ ...g, from });
const level = (n: number, reward: number): Goal => abs(`lvl${n}`, `Reach hole level ${n}`, n, () => ctx.state.holeLevel, reward, 'hole');

// Two tracks shown together, so a player who never throws still gets the level goals (night plan F8).
// Milestones: the tutorial, hole levels, land, The Deep. None of them needs a hand throw.
const MILESTONES: Goal[] = [
  rel('make', 'Make gnomes: stand at the GNOME FACTORY and hold E', 5, () => st().produced, 5, 'factory'),
  rel('grab', 'Use the magnet: hold LMB while looking at a gnome', 3, () => st().grabbed, 5, null),
  rel('feed', 'Feed the HOLE: release LMB over it, or throw with RMB', 5, () => st().gnomesEaten, 10, 'hole'),
  rel('coins', 'Collect coins: walk over them', 15, () => ctx.state.lifetimeEarned, 10, 'hole'),
  abs('combo5', 'Reach a 5 combo: feed gnomes one after another. Holding one pauses it', 5, () => st().maxCombo, 15, 'hole'),
  rel('buy', 'Buy an upgrade at the SHOP computer (E)', 1, () => st().bought, 20, 'shop'),
  abs('lvl2', 'Reach hole level 2: every level grows the hole and its multiplier', 2, () => ctx.state.holeLevel, 30, 'hole'),
  level(4, 150),
  // the Land goal
  abs('garden', 'Buy the Garden (Shop → Land)', 1, () => ctx.state.land, 300, 'shop'),
  level(6, 800),
  level(8, 2000),
  level(10, 5000),
  level(MAX_HOLE_LEVEL, 10000),
  abs('deep', 'Jump into the hole. See what is at the bottom.', 1, () => st().rebirths, 0, 'hole'),
];

// Lessons: one mechanic each. The track opens after "Collect coins" (PP 2026-10-20: "od pierwszej minuty");
// every unlocked lesson counts at once, the panel shows the first one not done (gnome types before trick shots).
// No trampoline TRICK lesson: the bounce shot was too hard to pull off on purpose (PP 2026-10-21 "trudno sie robi").
const LESSONS_AFTER = 'coins';
const LESSONS: Lesson[] = [
  lesson(1, rel('mushroom', 'Eat a MUSHROOM: the hole spits one out now and then. Walk over it', 1, () => st().mushrooms, 40, 'hole')),
  lesson(2, abs('greedy', 'Feed a GREEDY GNOME (green hat): it steals coins, runs for the fence', 1, typeEaten('greedy'), 40, null)),
  lesson(1, rel('heavy', 'Feed a HEAVY gnome (bigger): worth more, flies shorter', 1, () => st().heavies, 50, 'hole')),
  lesson(3, abs('angry', 'Feed an ANGRY GNOME (dark red): it charges you and kicks gnomes', 1, typeEaten('angry'), 60, null)),
  lesson(4, abs('dwarf', 'Feed a DWARF GNOME (small, brown hat): fast runner, worth x8', 1, typeEaten('dwarf'), 80, null)),
  lesson(4, abs('haul', 'HEAVY HAUL: feed a MASSIVE 3 kg gnome, worth x2.3', 1, () => st().hauls, 300, 'hole')),
  lesson(2, abs('boom', 'Feed a BOOM GNOME (burning fuse): it blasts gnomes off the rim', 1, typeEaten('boom'), 60, null)),
  lesson(5, abs('saboteur', 'Feed a SABOTEUR (goggles): it breaks your machines. Fuses soak hits', 1, typeEaten('saboteur'), 100, null)),
  lesson(1, abs('golden', 'Feed a GOLDEN GNOME: rare, runs away, worth x100', 1, typeEaten('golden'), 300, null)),
  lesson(7, abs('wizard', 'Feed a GNOME WIZARD (purple): it hurls gnomes away and teleports', 1, typeEaten('wizard'), 200, null)),
  lesson(8, abs('fat', 'Feed a FAT GNOME: six times the weight, always heavy or massive', 1, typeEaten('fat'), 200, null)),
  lesson(10, abs('king', 'Feed the KING GNOME: an event from hole level 10. 40 kg, use machines', 1, typeEaten('king'), 2000, null)),
  lesson(1, rel('crate', 'Buy a Wooden Crate (Shop → Tools), place it (1), drop 5 gnomes in', 5, () => st().crated, 40, 'crate')),
  lesson(1, rel('dump', 'Drag the crate into the hole with the magnet (LMB)', 1, () => st().crateDumps, 60, 'crate')),
  lesson(1, abs('combo15', 'Reach a 15 combo (Gnomazing!)', 15, () => st().maxCombo, 80, 'hole')),
  lesson(1, rel('long', 'LONG SHOT x2.5: throw (RMB) into the hole from 8 m or more', 1, () => st().longShots, 100, 'hole')),
  lesson(1, rel('air', 'AIR x2: 3 throws that fly into the hole without touching grass', 3, () => st().airShots, 60, 'hole')),
  lesson(4, rel('bullseye', 'BULLSEYE x5: throw through the golden hoop into the hole', 1, () => st().bullseyes, 200, 'hole')),
];
const MUSHROOM_LESSON = LESSONS.find((l) => l.id === 'mushroom')!;

// the old index lists, only to read saves from before goalsDone
const OLD_MILESTONES = ['make', 'grab', 'feed', 'coins', 'buy', 'lvl2', 'lvl4', 'garden', 'lvl6', 'lvl8', 'lvl10', `lvl${MAX_HOLE_LEVEL}`, 'deep'];
const OLD_SKILLS = ['crate', 'dump', 'combo15', 'long', 'air', 'bullseye', 'haul'];
const SKILLS_FROM = 6;

export class Goals {
  private done: Set<string>;

  constructor() {
    const s = ctx.state;
    if (s.goalsDone === undefined) {
      // before F8 there was one list: the 6 tutorial goals, the 7 skills, then the rest of the milestones
      if (s.goal2 === undefined) {
        const old = s.goal;
        const end = SKILLS_FROM + OLD_SKILLS.length;
        s.goal = Math.min(old, SKILLS_FROM) + Math.max(0, old - end);
        s.goal2 = Math.max(0, Math.min(old, end) - SKILLS_FROM);
        if (old >= SKILLS_FROM && old < end) s.goalBase2 = s.goalBase;
      }
      // every new milestone before the old current one counts as done (combo5 too, unpaid), the running goals keep their base
      const cur = OLD_MILESTONES[s.goal];
      const cut = cur ? MILESTONES.findIndex((m) => m.id === cur) : MILESTONES.length;
      const skills = s.goal >= SKILLS_FROM ? (s.goal2 ?? 0) : 0;
      s.goalsDone = [...MILESTONES.slice(0, cut).map((m) => m.id), ...OLD_SKILLS.slice(0, skills)];
      s.goalStart = {};
      if (MILESTONES[cut]?.relative) s.goalStart[cur] = s.goalBase;
      const skill = s.goal >= SKILLS_FROM ? OLD_SKILLS[skills] : undefined;
      if (skill && s.goalBase2 !== undefined && LESSONS.find((l) => l.id === skill)?.relative) s.goalStart[skill] = s.goalBase2;
    }
    s.goalStart ??= {};
    this.done = new Set(s.goalsDone);
  }

  // true once the player finished any goal (contracts wait for it)
  get firstDone(): boolean {
    return this.done.size > 0;
  }

  // the mushroom lesson is running: the next eaten gnome drops a mushroom when none lies on the grass
  get wantsMushroom(): boolean {
    return !this.done.has(MUSHROOM_LESSON.id) && this.unlocked(MUSHROOM_LESSON);
  }

  get current(): Goal | null {
    return MILESTONES.find((g) => !this.done.has(g.id)) ?? null;
  }

  get current2(): Lesson | null {
    return LESSONS.find((g) => !this.done.has(g.id) && this.unlocked(g)) ?? null;
  }

  // the lowest hole level a waiting lesson needs, when no lesson can run now
  private get nextFrom(): number | null {
    if (!this.done.has(LESSONS_AFTER) || this.current2) return null;
    const waiting = LESSONS.filter((g) => !this.done.has(g.id)).map((g) => g.from);
    return waiting.length ? Math.min(...waiting) : null;
  }

  private unlocked(g: Lesson): boolean {
    return this.done.has(LESSONS_AFTER) && g.from <= ctx.state.holeLevel;
  }

  // world position of the goal's target; after "Reach hole level 2" the lesson's target wins, because the milestones
  // left are level goals at the hole; a crate goal points to the shop until one is placed
  targetPos(): THREE.Vector3 | null {
    const w = (this.done.has('lvl2') ? (this.current2?.where ?? this.current?.where) : this.current?.where) ?? null;
    if (w === 'factory') return ctx.factory.pos;
    if (w === 'hole') return ctx.env.hole;
    if (w === 'shop') return ctx.env.deskPos;
    if (w === 'crate') return ctx.machines.list.find((m) => m.type === 'box')?.pos ?? ctx.env.deskPos;
    return null;
  }

  progress(): Progress | null {
    return this.measure(this.current);
  }

  progress2(): Progress | null {
    const g = this.current2;
    if (g) return this.measure(g);
    const n = this.nextFrom;
    return n ? { text: `Next lesson at hole level ${n}`, have: ctx.state.holeLevel, need: n } : null;
  }

  private measure(g: Goal | null): Progress | null {
    if (!g) return null;
    const base = g.relative ? (ctx.state.goalStart![g.id] ?? g.value()) : 0;
    const have = Math.max(0, g.value() - base);
    return { text: g.text, have: Math.min(have, g.target), need: g.target };
  }

  private reached(g: Goal): boolean {
    const p = this.measure(g);
    return !!p && p.have >= p.need;
  }

  private finish(g: Goal): void {
    ctx.state.goalsDone!.push(g.id);
    this.done.add(g.id);
    delete ctx.state.goalStart![g.id];
  }

  // records the start value of the current milestone
  start(): void {
    const g = this.current;
    const start = ctx.state.goalStart!;
    if (g?.relative && start[g.id] === undefined) start[g.id] = g.value();
  }

  update(): void {
    this.start();
    const g = this.current;
    if (g && this.reached(g)) {
      this.finish(g);
      if (g.reward > 0) {
        ctx.hole.earn(g.reward);
        ctx.hud.toast(`Goal done! +${money(g.reward)}`, 'good');
      } else ctx.hud.toast('Goal done!', 'good');
      ctx.audio.toast();
      this.start();
    }
    // every unlocked lesson counts from the frame it unlocks; lessons finished together pay with one toast
    const start = ctx.state.goalStart!;
    const finished: Goal[] = [];
    for (const l of LESSONS) {
      if (this.done.has(l.id) || !this.unlocked(l)) continue;
      if (l.relative && start[l.id] === undefined) start[l.id] = l.value();
      if (this.reached(l)) finished.push(l);
    }
    if (!finished.length) return;
    let total = 0;
    for (const l of finished) {
      this.finish(l);
      total += l.reward;
    }
    ctx.hole.earn(total);
    ctx.hud.toast(finished.length === 1 ? `Lesson done! +${money(total)}` : `${finished.length} lessons done! +${money(total)}`, 'good');
    ctx.audio.toast();
  }
}
