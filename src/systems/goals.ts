import type * as THREE from 'three';
import { ctx } from '../core/context';
import { money } from '../core/format';
import { MAX_HOLE_LEVEL } from '../data/holeLevels';

declare module '../core/state' {
  interface GameState {
    // Skills track (night plan F8); missing in older saves, derived from the old single list on load
    goal2?: number;
    goalBase2?: number;
  }
}

type Where = 'factory' | 'hole' | 'shop' | 'crate' | null;

interface Goal {
  text: string;
  target: number;
  // relative goals count from the moment the goal starts, absolute ones read the value as is
  value: () => number;
  relative: boolean;
  reward: number;
  where: Where; // the HUD waypoint points here
}

const st = () => ctx.state.stats;
const rel = (text: string, target: number, value: () => number, reward: number, where: Where): Goal => ({ text, target, value, relative: true, reward, where });
const abs = (text: string, target: number, value: () => number, reward: number, where: Where): Goal => ({ text, target, value, relative: false, reward, where });

// Two tracks shown together, so a player who never throws still gets the level goals (night plan F8).
// Milestones: the tutorial, hole levels, land, The Deep.
const MILESTONES: Goal[] = [
  rel('Make gnomes: stand at the GNOME FACTORY and hold E', 5, () => st().produced, 5, 'factory'),
  rel('Use the magnet: hold LMB while looking at a gnome', 3, () => st().grabbed, 5, null),
  rel('Feed the HOLE: release LMB over it, or throw with RMB', 5, () => st().gnomesEaten, 10, 'hole'),
  rel('Collect coins: walk over them', 15, () => ctx.state.lifetimeEarned, 10, 'hole'),
  rel('Buy an upgrade at the SHOP computer (E)', 1, () => st().bought, 20, 'shop'),
  abs('Reach hole level 2', 2, () => ctx.state.holeLevel, 30, 'hole'),
  abs('Reach hole level 4', 4, () => ctx.state.holeLevel, 150, 'hole'),
  abs('Buy the Garden (Shop → Land)', 1, () => ctx.state.land, 300, 'shop'),
  abs('Reach hole level 6', 6, () => ctx.state.holeLevel, 800, 'hole'),
  abs('Reach hole level 8', 8, () => ctx.state.holeLevel, 2000, 'hole'),
  abs('Reach hole level 10', 10, () => ctx.state.holeLevel, 5000, 'hole'),
  abs(`Reach hole level ${MAX_HOLE_LEVEL}`, MAX_HOLE_LEVEL, () => ctx.state.holeLevel, 10000, 'hole'),
  abs('Jump into the hole. See what is at the bottom.', 1, () => st().rebirths, 0, 'hole'),
];
// Skills: the crate and the trick shots; the track opens after "Reach hole level 2"
const SKILLS_FROM = 6;
const SKILLS: Goal[] = [
  rel('Buy a Wooden Crate (Shop → Tools), place it (1) and drop 5 gnomes in', 5, () => st().crated, 40, 'crate'),
  rel('Drag the crate into the hole with the magnet (LMB)', 1, () => st().crateDumps, 60, 'crate'),
  abs('Reach a 15 combo', 15, () => st().maxCombo, 80, 'hole'),
  rel('LONG SHOT: throw a gnome into the hole from 8 m or more', 1, () => st().longShots, 100, 'hole'),
  rel('AIR shots: 5 gnomes straight into the hole without a bounce', 5, () => st().airShots, 150, 'hole'),
  rel('BULLSEYE: throw a gnome through the golden hoop next to the hole, into the hole', 1, () => st().bullseyes, 200, 'hole'),
  rel('HEAVY HAUL: feed a massive 3 kg gnome (from hole level 4)', 1, () => st().hauls, 300, 'hole'),
];
// the old single list was the 6 tutorial goals, these 7 skills, then the rest of the milestones
const OLD_SKILLS_END = SKILLS_FROM + SKILLS.length;

export class Goals {
  constructor() {
    const s = ctx.state;
    if (s.goal2 !== undefined) return;
    const old = s.goal;
    s.goal = Math.min(old, SKILLS_FROM) + Math.max(0, old - OLD_SKILLS_END);
    s.goal2 = Math.max(0, Math.min(old, OLD_SKILLS_END) - SKILLS_FROM);
    // the skill goal that was running keeps its start value
    if (old >= SKILLS_FROM && old < OLD_SKILLS_END) s.goalBase2 = s.goalBase;
  }

  get current(): Goal | null {
    return MILESTONES[ctx.state.goal] ?? null;
  }

  get current2(): Goal | null {
    return ctx.state.goal >= SKILLS_FROM ? (SKILLS[ctx.state.goal2 ?? 0] ?? null) : null;
  }

  // world position of the goal's target (the milestone first); a crate goal points to the shop until a crate is placed
  targetPos(): THREE.Vector3 | null {
    const w = this.current?.where ?? this.current2?.where;
    if (w === 'factory') return ctx.factory.pos;
    if (w === 'hole') return ctx.env.hole;
    if (w === 'shop') return ctx.env.deskPos;
    if (w === 'crate') return ctx.machines.list.find((m) => m.type === 'box')?.pos ?? ctx.env.deskPos;
    return null;
  }

  progress(): { text: string; have: number; need: number } | null {
    return this.measure(this.current, ctx.state.goalBase);
  }

  progress2(): { text: string; have: number; need: number } | null {
    return this.measure(this.current2, ctx.state.goalBase2 ?? 0);
  }

  private measure(g: Goal | null, base: number): { text: string; have: number; need: number } | null {
    if (!g) return null;
    const have = Math.max(0, g.value() - (g.relative ? base : 0));
    return { text: g.text, have: Math.min(have, g.target), need: g.target };
  }

  start(): void {
    const g = this.current;
    if (g) ctx.state.goalBase = g.value();
  }

  update(): void {
    const s = ctx.state;
    // the skills track starts counting when it opens
    if (s.goalBase2 === undefined && this.current2) s.goalBase2 = this.current2.value();
    if (this.done(this.current, this.progress())) {
      s.goal++;
      this.start();
    }
    if (this.done(this.current2, this.progress2())) {
      s.goal2 = (s.goal2 ?? 0) + 1;
      s.goalBase2 = this.current2?.value();
    }
  }

  private done(g: Goal | null, p: { have: number; need: number } | null): boolean {
    if (!g || !p || p.have < p.need) return false;
    if (g.reward > 0) {
      ctx.hole.earn(g.reward);
      ctx.hud.toast(`Goal done! +${money(g.reward)}`, 'good');
    } else ctx.hud.toast('Goal done!', 'good');
    ctx.audio.toast();
    return true;
  }
}
