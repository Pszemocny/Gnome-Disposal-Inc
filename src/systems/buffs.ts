import { ctx, lvl } from '../core/context';

export interface MushroomDef {
  id: string;
  name: string;
  cap: number;
  spots: number;
  duration: number;
  desc: string;
  weight: number;
}

export const MUSHROOMS: MushroomDef[] = [
  { id: 'combo', name: 'Red Combo Cap', cap: 0xd8352a, spots: 0xffffff, duration: 20, desc: '+1x combo cap, double combo gain', weight: 30 },
  { id: 'zoom', name: 'Blue Zoomies', cap: 0x2f8fff, spots: 0xc0e8ff, duration: 20, desc: 'Run and jump much faster', weight: 30 },
  { id: 'chaos', name: 'Purple Chaos', cap: 0x8a3ad8, spots: 0xffb0ff, duration: 20, desc: 'Gnome burst! Gnomes worth x1.5', weight: 18 },
  { id: 'midas', name: 'Gold Midas', cap: 0xffcc22, spots: 0xfff2a0, duration: 30, desc: 'Next 15 gnomes worth x3', weight: 12 },
  { id: 'booze', name: 'Green Grog', cap: 0x3ab84a, spots: 0xe0ffb0, duration: 15, desc: 'BOOZED! Everything x2, the world wobbles', weight: 8 },
  { id: 'daynight', name: 'Eclipse Cap', cap: 0x1c1c4a, spots: 0xfff3b0, duration: 20, desc: 'x2 money, the sky flips day and night', weight: 10 },
  { id: 'rainbow', name: 'Rainbow Shroom', cap: 0xff66cc, spots: 0x66ffee, duration: 15, desc: 'All of the above + gnome rain', weight: 2 },
];

export const MUSHROOM_BY_ID: Record<string, MushroomDef> = Object.fromEntries(MUSHROOMS.map((m) => [m.id, m]));

export class Buffs {
  timers = new Map<string, number>();
  midasLeft = 0;

  active(id: string): boolean {
    return (this.timers.get(id) ?? 0) > 0 || (this.timers.get('rainbow') ?? 0) > 0;
  }

  apply(id: string): void {
    const def = MUSHROOM_BY_ID[id];
    const dur = def.duration * (1 + lvl('mushTime') * 0.2);
    this.timers.set(id, Math.max(this.timers.get(id) ?? 0, 0) + dur);
    ctx.hud.toast(`${def.name}: ${def.desc}`, 'good');
    ctx.audio.magic();
    if (id === 'chaos' || id === 'rainbow') {
      ctx.factory.burst(15);
    }
    if (id === 'midas' || id === 'rainbow') this.midasLeft += 15;
    if (id === 'rainbow') ctx.events.start('rain');
  }

  // Money multiplier from active buffs for one eaten gnome.
  valueMult(): number {
    let m = 1;
    if (this.active('chaos')) m *= 1.5;
    if (this.active('booze')) m *= 2;
    if (this.active('daynight')) m *= 2;
    if (this.midasLeft > 0) {
      this.midasLeft--;
      m *= 3;
    }
    return m;
  }

  update(dt: number): void {
    for (const [k, v] of this.timers) if (v > 0) this.timers.set(k, v - dt);
  }

  list(): { def: MushroomDef; left: number }[] {
    const out: { def: MushroomDef; left: number }[] = [];
    for (const [k, v] of this.timers) if (v > 0) out.push({ def: MUSHROOM_BY_ID[k], left: v });
    return out;
  }
}
