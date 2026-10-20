import * as THREE from 'three';
import { ctx, lvl } from '../core/context';
import { TOOL_IDS, UPGRADE_BY_ID } from '../data/upgrades';
import { TOOL_ICONS } from '../ui/hud';
import { GEARS, type Gear } from './sweeper';
import type { Player } from './player';

export interface WheelItem {
  id: string;
  kind: 'gear' | 'tool';
  label: string;
  icon: string;
  count?: string;
  enabled: boolean;
}

const SLOW = 0.25; // game speed while the wheel is open
const REACH = 140; // px the virtual cursor can move from the centre
const DEAD = 24; // px around the centre that keep the current slice

// GTA-style tool wheel: hand tools (hands, Magnet Gun, tractor, blower) and the placeables past the tenth.
// Hold Tab, move the mouse towards a slice, release to take it. The game slows down while open.
export class ToolWheel {
  open = false;
  items: WheelItem[] = [];
  cursor = new THREE.Vector2();
  index = -1;
  timeScale = 1;

  // Game speed for this frame; `real` is the unscaled frame time, so the slow-down does not slow itself.
  // Also closes the wheel (no selection) when the game pauses.
  slow(real: number): number {
    if (this.open && ctx.paused) this.close();
    // full speed again about 0.3 s after release
    this.timeScale = THREE.MathUtils.damp(this.timeScale, this.open ? SLOW : 1, 16, real);
    if (!this.open && this.timeScale > 0.99) this.timeScale = 1;
    return this.timeScale;
  }

  close(): void {
    this.open = false;
    this.index = -1;
    this.timeScale = 1;
  }

  // While playing (not paused; the mouse may be free): Tab opens, the mouse picks, releasing Tab takes the slice.
  update(pl: Player): void {
    const inp = ctx.input;
    if (!this.open) {
      if (!inp.hit('Tab')) return;
      this.open = true;
      this.items = this.build();
      this.cursor.set(0, 0);
      const cur = pl.placing ?? pl.sweeper.gear;
      this.index = this.items.findIndex((it) => it.id === cur);
      return;
    }
    this.cursor.x += inp.mouse.dx;
    this.cursor.y += inp.mouse.dy;
    if (this.cursor.length() > REACH) this.cursor.setLength(REACH);
    const n = this.items.length;
    if (this.cursor.length() > DEAD) {
      // slice 0 at the top, clockwise; each slice is centred on its icon
      const a = (Math.atan2(this.cursor.y, this.cursor.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      this.index = Math.round(a / ((Math.PI * 2) / n)) % n;
    }
    if (inp.down('Tab')) return;
    const it = this.items[this.index];
    this.open = false;
    this.index = -1;
    if (!it) return;
    if (it.kind === 'tool') {
      if (pl.placing !== it.id) pl.selectTool(it.id);
    } else {
      pl.cancelPlacement();
      pl.setGear(it.id as Gear);
    }
  }

  private build(): WheelItem[] {
    const items: WheelItem[] = GEARS.filter((g) => g.id === 'hands' || lvl(g.id)).map((g) => ({ id: g.id, kind: 'gear', label: g.label, icon: g.icon, enabled: true }));
    // hand tools first, then the placeables past the tenth (no digit key)
    for (const id of TOOL_IDS.slice(10)) {
      if (!lvl(id)) continue;
      const free = ctx.machines.available(id);
      items.push({ id, kind: 'tool', label: UPGRADE_BY_ID[id].name, icon: TOOL_ICONS[id], count: `${free}/${lvl(id)}`, enabled: free > 0 });
    }
    return items;
  }
}
