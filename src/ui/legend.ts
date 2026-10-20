import { ctx, deep, lvl } from '../core/context';
import { money } from '../core/format';
import { BOOM, BOOM_CHANCE, GNOME_TYPES, WEIGHT_TIERS } from '../data/gnomeTypes';
import { HOLE_LEVELS, MAX_HOLE_LEVEL } from '../data/holeLevels';
import { LAND } from '../data/land';
import { UPGRADE_BY_ID, UPGRADES, upgradeCost, type Upgrade } from '../data/upgrades';
import { album } from '../systems/album';
import { MUSHROOMS } from '../systems/buffs';
import * as eventsModule from '../systems/events';

type LegendTab = 'Gnomes' | 'Mushrooms' | 'Tools' | 'Mechanics';
const TABS: LegendTab[] = ['Gnomes', 'Mushrooms', 'Tools', 'Mechanics'];

// every key binding the legend lists; the code reads them from player.ts, wheel.ts, audio.ts, hud.ts and the overlays
const KEYS: [string, string][] = [
  ['WASD / Shift / Space', 'move, sprint, jump'],
  ['hold LMB', 'magnet: grab gnomes and things (many with the Magnet Gun)'],
  ['RMB', 'throw what you hold'],
  ['F', 'kick'],
  ['E', 'use: shop desk, fix a tool / swap a fuse, factory lever, hold at the factory'],
  ['C', 'hands ↔ current tool (the last one taken from the wheel)'],
  ['hold Tab', 'tool wheel: hands, Magnet Gun, tractor, blower, tools past the 10th'],
  ['1-0', 'pick a tool to place'],
  ['X', 'pick up a placed tool'],
  ['G', 'move a placed tool'],
  ['R / T / V', 'placing: turn, tilt, reset rotation'],
  ['Q', 'cancel placing'],
  ['K', 'blueprints'],
  ['Z', 'undo the last placed tool'],
  ['B', 'shop (with the Laptop)'],
  ['M', 'mute'],
  ['H', 'controls'],
  ['L', 'this legend'],
  ['I', 'instant replay of the last 10 s'],
  ['J', 'ground pound while in the air (wider with Gnome Boots)'],
  ['Esc', 'menu'],
];

// words with no data source, keyed by gnome type id or mechanic id; a missing id gets GENERIC
const TEXT: Record<string, string> = {
  classic: 'Wanders around the yard. The bread and butter of the hole.',
  blue: 'Same as the classic gnome, only blue.',
  golden: 'Runs away from you, fast. Very valuable. Comes with Gold Fever, the Golden Hour event and late hole levels.',
  greedy: 'Steals coins lying on the ground and runs for the fence. Eat it before it escapes to get the coins back.',
  boom: 'Looks normal but has a burning fuse. Explodes when the hole eats it and throws nearby gnomes off the rim.',
  angry: 'Charges you and knocks you back. When bored it kicks other gnomes around.',
  dwarf: 'Small, light and fast. Runs away from you.',
  saboteur: 'Walks to your working tools and blows a fuse per hit; with no fuse left the tool breaks. Press E on the tool to fix it and swap fuses.',
  shadow: 'Appears at night. Stares at you and vanishes when you come close. Left alone too long, it takes some of your money.',
  wizard: 'Casts a spell that throws gnomes away from the hole and teleports around the yard.',
  fat: 'Big and heavy, slow. Hard to throw far.',
  king: 'Arrives with an event at a high hole level. Too heavy for any magnet: only machines (tractor, cannon, vacuum...) can move him. He stomps the ground.',
  mushrooms: 'Mushrooms sometimes pop out of the hole when it eats a gnome, and the Mushroom Bloom event sprouts them everywhere. Walk over one to eat it. Effects of the same kind add up their time.',
  combo: 'Feed gnomes one after another to grow the combo. Each gnome raises the money multiplier up to the cap. Holding a gnome keeps the combo alive.',
  tricks: 'Thrown gnomes pay more: LONG SHOT and SNIPER from far away, AIR when the gnome never touched the ground, TRICK after a bounce off a tool, BULLSEYE through the golden hoop. Tricks multiply each other up to a cap, and each one also pays a flat bonus times the hole multiplier.',
  strike: 'STRIKE: a fast thrown gnome that knocks other gnomes into the hole pays a bonus per gnome. A long chain is a TURKEY.',
  events: 'Once the hole grows a bit, random events start from time to time. Four-leaf Clover makes them more frequent.',
  contracts: 'A timed task shows up under the GOAL panel. Finish it in time for a money reward; hard ones pay more. A failed one is replaced after a short wait.',
  moods: 'Once the hole grows a bit, it sometimes craves one gnome type. Those gnomes pay extra while the craving lasts. The hole also comments on your throws.',
  rain: 'Later in the game it rains every few minutes. Wet grass and wet gnomes are slippery: thrown gnomes slide much further.',
  slowmo: 'A very big combo or an eaten King freezes the game for a moment and plays it in slow motion.',
  rebirth: 'At the last hole level THE DEEP opens: jump into the hole to start over. You keep shards, achievements and Deep upgrades; shards buy permanent bonuses.',
};
const GENERIC = 'A gnome. Feed it to the hole.';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;

interface EventLike { name: string; sub: string }
interface ContractLike { title: (n: number) => string; target: () => number; time: number; hard: boolean; ok: () => boolean }

const CSS = `
.legend .shop-win { width: min(980px, 96vw); }
.legend .shop-rows { display: block; }
.legend h3 { margin: 14px 4px 6px; color: var(--accent); font-size: 17px; letter-spacing: 2px; text-transform: uppercase; }
.legend p { margin: 4px 4px 8px; font-size: 14px; line-height: 1.4; opacity: .9; }
.legend .lg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
.legend .lg-card { background: rgba(255,255,255,.05); border: 1px solid #3a3f46; border-radius: 6px; padding: 8px 10px; font-size: 13px; line-height: 1.4; }
.legend .lg-card b { color: #fff; font-size: 15px; }
.legend .lg-card .st { color: var(--accent); }
.legend .lg-card .dim { opacity: .65; }
.legend .sw { display: inline-block; width: 16px; height: 16px; border-radius: 50%; vertical-align: -3px; margin-right: 6px; border: 1px solid rgba(255,255,255,.4); }
.legend table { width: 100%; border-collapse: collapse; font-size: 13px; }
.legend td, .legend th { padding: 3px 6px; text-align: left; border-bottom: 1px solid #33383f; }
.legend th { opacity: .7; font-weight: 600; }
.legend td:first-child { white-space: nowrap; }
.legend tr.on td { color: var(--accent); }
.legend .key { display: inline-block; min-width: 18px; padding: 0 5px; border: 1px solid #6a7078; border-radius: 4px; color: var(--accent); font-weight: 700; }
`;

export class Legend {
  isOpen = false;
  private el: HTMLDivElement;
  private tab: LegendTab = 'Gnomes';

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'shop legend hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-close]')) return this.close();
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab;
      if (!tab) return;
      this.tab = tab as LegendTab;
      this.render();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || (e.code !== 'Escape' && e.code !== 'KeyL')) return;
      e.preventDefault();
      ctx.input.pressed.delete(e.code); // the closing L must not reopen the legend on the next frame
      this.close();
    });
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
  update(): void {
    album.update();
    if (ctx.input.hit('KeyL')) this.open();
  }

  render(): void {
    const body = this.tab === 'Gnomes' ? this.gnomes() : this.tab === 'Mushrooms' ? this.mushrooms() : this.tab === 'Tools' ? this.tools() : this.mechanics();
    this.el.innerHTML = `
      <div class="shop-win">
        <div class="shop-head"><span>GNOME-PEDIA</span><button class="x" data-close>✕</button></div>
        <div class="shop-tabs">${TABS.map((t) => `<button class="tab ${t === this.tab ? 'on' : ''}" data-tab="${t}">${t.toUpperCase()}</button>`).join('')}</div>
        <div class="shop-rows">${body}</div>
        <div class="shop-foot">Esc / L to close · ??? = not discovered yet</div>
      </div>`;
  }

  private gnomes(): string {
    const cards = GNOME_TYPES.map((t) => {
      if (!album.unlocked(t.id)) {
        const when = t.unlock <= MAX_HOLE_LEVEL ? `Shows up from hole level ${t.unlock}.` : 'Shows up later.';
        return `<div class="lg-card lg-gnome lg-locked"><span class="sw" style="background:#555"></span><b>???</b><br>Not fed to the hole yet.<br><span class="dim">${when}</span></div>`;
      }
      const notes: string[] = [];
      if (t.unlock > MAX_HOLE_LEVEL) notes.push(`Weighs ${t.mass} kg.`);
      else notes.push(`From hole level ${t.unlock}.`);
      if (t.weight === 0 && t.fuse) notes.push(`${pct(BOOM_CHANCE)} of factory and rain gnomes. Blast reach ${BOOM.reach} m.`);
      else if (t.weight === 0) notes.push('Not made by the factory.');
      if (t.statue) notes.push('Can sleep as a statue and wake up.');
      return `<div class="lg-card lg-gnome">
        <span class="sw" style="background:linear-gradient(${hex(t.hat)} 50%, ${hex(t.shirt)} 50%)"></span><b>${t.name}</b>
        <span class="st"> x${t.value} money · ${t.xp} XP · Eaten: ${album.count(t.id)}</span><br>
        ${TEXT[t.id] ?? GENERIC}<br>
        <span class="dim">Walks ${t.speed} m/s · size x${t.scale}. ${notes.join(' ')}</span>
      </div>`;
    }).join('');
    const tiers = Object.values(WEIGHT_TIERS)
      .map((w) => `<tr><td>${w.id}</td><td>${w.mass} kg</td><td>x${w.scale}</td><td>x${w.value}</td><td>x${w.flee}</td></tr>`)
      .join('');
    return `<h3>Gnome types · ${album.discovered}/${GNOME_TYPES.length} discovered</h3><div class="lg-grid">${cards}</div>
      <h3>Weight classes</h3><p>Every gnome type comes in these classes. The deeper the hole, the more heavy ones the factory makes. Heavy gnomes slip off the magnet and fly shorter.</p>
      <table><tr><th>Class</th><th>Weight</th><th>Size</th><th>Money and XP</th><th>Run speed</th></tr>${tiers}</table>`;
  }

  private mushrooms(): string {
    const total = MUSHROOMS.reduce((s, m) => s + m.weight, 0);
    const cards = MUSHROOMS.map(
      (m) => `<div class="lg-card lg-mush">
        <span class="sw" style="background:${hex(m.cap)}"></span><b>${m.name}</b>${ctx.buffs.active(m.id) ? '<span class="st"> · ACTIVE</span>' : ''}<br>
        ${m.desc}<br>
        <span class="dim">Lasts ${m.duration} s · ${pct(m.weight / total)} of mushroom drops</span>
      </div>`,
    ).join('');
    const bag = UPGRADE_BY_ID.mushChance;
    const trip = UPGRADE_BY_ID.mushTime;
    const up = (u: Upgrade) => `<b>${u.name}</b> (level ${lvl(u.id)}/${u.max}): ${u.desc}`;
    return `<h3>Mushrooms</h3><p>${TEXT.mushrooms ?? GENERIC}</p><p>${up(bag)}<br>${up(trip)}</p><div class="lg-grid">${cards}</div>`;
  }

  private tools(): string {
    const tabs = [...new Set(UPGRADES.map((u) => u.tab))];
    const groups = tabs.map((tab) => {
      const rows = UPGRADES.filter((u) => u.tab === tab).map((u) => {
        const shards = u.currency === 'shards';
        const L = shards ? deep(u.id) : lvl(u.id);
        const price = L >= u.max ? 'MAX' : shards ? `💎 ${upgradeCost(u, L)}` : money(upgradeCost(u, L));
        if ((u.hole ?? 1) > ctx.state.holeLevel) return `<tr class="lg-up"><td>???</td><td class="dim">Hole level ${u.hole}.</td><td></td><td></td></tr>`;
        return `<tr class="lg-up"><td>${u.name}</td><td>${u.desc}</td><td>${L}/${u.max}</td><td>${price}</td></tr>`;
      });
      return `<h3>${tab}</h3><table><tr><th>Name</th><th>What it does</th><th>Level</th><th>Price now</th></tr>${rows.join('')}</table>`;
    });
    const keys = KEYS.map(([k, what]) => `<tr><td><span class="key">${k}</span></td><td>${what}</td></tr>`).join('');
    return `<h3>Keys</h3><table>${keys}</table>${groups.join('')}`;
  }

  private mechanics(): string {
    const s = ctx.state;
    const hl = s.holeLevel;
    const levels = HOLE_LEVELS.map(
      (h, i) => `<tr class="${i + 1 === hl ? 'on' : ''}"><td>${i + 1}</td><td>${isFinite(h.xp) ? h.xp : 'max'}</td><td>${h.radius} m</td><td>x${h.mult}</td><td>${i + 1 <= hl + 1 ? h.unlock : '???'}</td></tr>`,
    ).join('');
    const land = LAND.map(
      (t, i) => `<tr class="${i === s.land ? 'on' : ''}"><td>${i <= s.land + 1 || t.hole <= hl ? t.name : '???'}</td><td>${t.half * 2} m</td><td>${t.cost ? money(t.cost) : 'free'}</td><td>${t.hole}</td></tr>`,
    ).join('');
    const h = ctx.hole;
    const combos = UPGRADES.filter((u) => u.tab === 'Combos').map((u) => u.name).join(', ');

    // events.ts and contracts.ts keep their tables private: read them if present, else the plain text
    const events = (eventsModule as unknown as { EVENTS?: EventLike[] }).EVENTS;
    const eventList = events ? `<table>${events.map((e) => `<tr><td>${e.name}</td><td>${e.sub}</td></tr>`).join('')}</table>` : '';
    const defs = (ctx.contracts as unknown as { defs?: ContractLike[] } | undefined)?.defs;
    const contractList = defs
      ? `<table>${defs.map((d) => `<tr><td>${d.title(d.target())}</td><td>${d.time} s</td><td>${d.hard ? 'hard' : ''}</td><td>${d.ok() ? '' : '<span class="dim">not possible now</span>'}</td></tr>`).join('')}</table>`
      : '';

    const deepUps = UPGRADES.filter((u) => u.currency === 'shards').map((u) => `<tr><td>${u.name}</td><td>${u.desc}</td></tr>`).join('');
    const sec = (title: string, id: string, extra = '') => `<h3>${title}</h3><p>${TEXT[id] ?? GENERIC}</p>${extra}`;

    return `<h3>Hole levels</h3><p>Feed the hole to fill its XP bar. Every level makes the hole bigger and every gnome worth more.</p>
      <table><tr><th>Level</th><th>XP to next</th><th>Radius</th><th>Money</th><th>Unlocks</th></tr>${levels}</table>
      <h3>Land</h3><p>Bought in the shop (Land tab). A bigger yard holds more gnomes and machines.</p>
      <table><tr><th>Land</th><th>Size</th><th>Price</th><th>Hole level</th></tr>${land}</table>
      ${sec('Combo', 'combo', `<p class="dim">Now: ${h.comboWindow.toFixed(1)} s to keep it alive, cap x${h.comboCap}. Upgrades: ${combos}.</p>`)}
      ${sec('Trick shots', 'tricks')}
      ${sec('STRIKE', 'strike')}
      ${sec('Events', 'events', eventList)}
      ${sec('Contracts', 'contracts', contractList)}
      ${sec('Hole moods', 'moods')}
      ${sec('Rain', 'rain')}
      ${sec('Slow motion', 'slowmo')}
      ${sec('Rebirth and The Deep', 'rebirth', `<p class="dim">A rebirth now would give ${h.shardsForRebirth()} 💎. You have ${s.shards} 💎.</p><table>${deepUps}</table>`)}`;
  }
}
