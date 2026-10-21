import type * as THREE from 'three';
import { ctx } from '../core/context';
import { inQuad, outBack } from '../core/ease';
import type { PlacedMachine } from '../core/state';
import { UPGRADE_BY_ID } from '../data/upgrades';
import type { Machine } from '../entities/machines';
import { daily } from '../systems/daily';

const KEY = 'gnome-boozed-blueprints';
const SLOTS = 3;
const UNDO_WINDOW = 10; // seconds after a placement in which Z takes it back
const POP_TIME = 0.25; // a loaded tool grows in, a removed one shrinks out

// positions are relative to the hole centre, so a layout follows the hole when it moves
interface Blueprint {
  at: number;
  items: PlacedMachine[];
}

const CSS = `
.blueprints .shop-win { width: min(560px, 94vw); }
.blueprints .row { grid-template-columns: 1fr 90px 90px 90px; gap: 6px; }
.blueprints .row small { opacity: .6; margin-left: 8px; }
.blueprints .bp-load:not(.poor) { background: #3a6ad8; }
.blueprints .bp-clear:not(.poor) { background: #a04848; }
`;

export class Blueprints {
  isOpen = false;
  private el: HTMLDivElement;
  private slots: (Blueprint | null)[] = Blueprints.read();
  private seen = new WeakSet<Machine>(); // tools that already existed or were loaded: not a placement
  private booted = false;
  private last: Machine | null = null; // the player's last placed tool, for Z
  private lastAge = 0;
  private anims: { root: THREE.Object3D; t: number; out: boolean }[] = [];

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'shop blueprints hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-close]')) return this.close();
      const b = t.closest<HTMLElement>('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === 'save') this.save(i);
      else if (b.dataset.act === 'load') this.load(i);
      else this.clear(i);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || (e.code !== 'Escape' && e.code !== 'KeyK')) return;
      e.preventDefault();
      ctx.input.pressed.delete(e.code); // the closing K must not reopen the panel on the next frame
      this.close();
    });
  }

  private static read(): (Blueprint | null)[] {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (Array.isArray(v)) return Array.from({ length: SLOTS }, (_, i) => (v[i] && Array.isArray(v[i].items) ? v[i] : null));
    } catch {
      // a broken entry reads as empty slots
    }
    return Array(SLOTS).fill(null);
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    ctx.paused = true;
    ctx.input.unlock();
    this.el.classList.remove('hidden');
    ctx.player.cancelPlacement();
    this.render();
    ctx.audio.toast();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    ctx.paused = false;
    ctx.input.lock();
  }

  // runs only while the game is not paused (main.ts loop)
  update(dt: number): void {
    for (const m of ctx.machines.list) {
      if (this.seen.has(m)) continue;
      this.seen.add(m);
      if (this.booted) {
        this.last = m;
        this.lastAge = 0;
      }
    }
    this.booted = true;
    this.lastAge += dt;
    if (ctx.input.hit('KeyK')) this.open();
    if (ctx.input.hit('KeyZ')) this.undo();
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / POP_TIME);
      a.root.scale.setScalar(a.out ? 1 - inQuad(k) : outBack(k));
      if (k < 1) continue;
      if (a.out) ctx.scene.remove(a.root);
      this.anims.splice(i, 1);
    }
  }

  private undo(): void {
    const m = this.last;
    this.last = null;
    // X or a reload may have removed it already
    if (!m || this.lastAge > UNDO_WINDOW || !ctx.machines.list.includes(m)) return ctx.audio.deny();
    this.vanish(m);
    ctx.hud.toast(`${UPGRADE_BY_ID[m.type].name} back in your inventory.`, 'info');
    ctx.audio.buy();
  }

  // removes the tool now and lets its model shrink out where it stood
  private vanish(m: Machine): void {
    ctx.machines.remove(m);
    this.anims = this.anims.filter((a) => a.root !== m.root);
    ctx.scene.add(m.root);
    this.anims.push({ root: m.root, t: 0, out: true });
    ctx.fx.burst(m.root.position, 0xffffff, 8);
  }

  private save(i: number): void {
    const h = ctx.env.hole;
    const items = ctx.machines.serialize().map((p) => ({ ...p, x: p.x - h.x, y: p.y - h.y, z: p.z - h.z }));
    if (!items.length) {
      ctx.hud.toast('Place some tools first.', 'info');
      return ctx.audio.deny();
    }
    this.slots[i] = { at: Date.now(), items };
    this.write();
    ctx.audio.buy();
  }

  private load(i: number): void {
    const bp = this.slots[i];
    if (!bp) return ctx.audio.deny();
    const { hole, holeRadius } = ctx.env;
    const abs = bp.items.map((p) => ({ ...p, x: p.x + hole.x, y: p.y + hole.y, z: p.z + hole.z }));
    const fits = abs.filter((p) => !(ctx.env.holeDist(p.x, p.z) < holeRadius + 0.6 && p.y < 1.5));
    for (const m of [...ctx.machines.list]) this.vanish(m);
    // saved order: a tool stacked on another comes after its support
    const inFactory = ctx.machines.restore(fits);
    for (const m of ctx.machines.list) {
      this.seen.add(m);
      m.root.scale.setScalar(0);
      this.anims.push({ root: m.root, t: 0, out: false });
      ctx.fx.burst(m.pos, 0xffffff, 8);
    }
    this.last = null;
    const skipped = abs.length - fits.length + inFactory;
    if (skipped) ctx.hud.toast(skipped === 1 ? '1 tool skipped: no room there (hole or factory)' : `${skipped} tools skipped: no room there (hole or factory)`, 'bad');
    ctx.hud.toast(`Blueprint ${i + 1} loaded: ${ctx.machines.list.length} tools.`, 'good');
    ctx.audio.buy();
    this.close();
  }

  private clear(i: number): void {
    if (!this.slots[i]) return ctx.audio.deny();
    this.slots[i] = null;
    this.write();
    ctx.audio.thud();
  }

  private write(): void {
    // a daily challenge run keeps its blueprints in memory only, so it never overwrites the yard's slots
    if (!daily.active) localStorage.setItem(KEY, JSON.stringify(this.slots));
    this.render();
  }

  private render(): void {
    const rows = this.slots
      .map((bp, i) => {
        const info = bp ? `${bp.items.length} tools, ${new Date(bp.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'empty';
        const off = bp ? '' : ' poor';
        return `<div class="row"><span>Slot ${i + 1}<small>${info}</small></span>
          <button class="buy" data-act="save" data-i="${i}">SAVE</button>
          <button class="buy bp-load${off}" data-act="load" data-i="${i}">LOAD</button>
          <button class="buy bp-clear${off}" data-act="clear" data-i="${i}">CLEAR</button></div>`;
      })
      .join('');
    this.el.innerHTML = `<div class="shop-win">
      <div class="shop-head"><span>BLUEPRINTS</span><button class="x" data-close>✕</button></div>
      <div class="shop-rows">${rows}</div>
      <div class="shop-foot">Layouts are saved around the hole: LOAD rebuilds them around the hole wherever it is now. Z takes back the tool you placed in the last 10 s. K or Esc closes.</div>
    </div>`;
  }
}
