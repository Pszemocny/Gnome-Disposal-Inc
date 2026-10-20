import { ctx } from '../core/context';
import { GNOME_TYPES } from '../data/gnomeTypes';

// Gnome album: a type unlocks on its first swallow; the count is stats.typesEaten (written by hole.consume).
export class Album {
  private seen = new Set<string>();
  private booted = false;

  count(id: string): number {
    return ctx.state.stats.typesEaten[id] ?? 0;
  }

  unlocked(id: string): boolean {
    return this.count(id) > 0;
  }

  get discovered(): number {
    return GNOME_TYPES.filter((t) => this.unlocked(t.id)).length;
  }

  // the first frame only records what is known, so a loaded save does not toast
  update(): void {
    for (const t of GNOME_TYPES) {
      if (this.seen.has(t.id) || !this.unlocked(t.id)) continue;
      this.seen.add(t.id);
      if (!this.booted) continue;
      ctx.hud.toast(`New gnome discovered: ${t.name}. Press L to read about it.`, 'secret');
      ctx.audio.tier();
    }
    this.booted = true;
  }
}

export const album = new Album();
