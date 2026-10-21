import { ctx, deep, lvl } from '../core/context';
import { money } from '../core/format';
import { saveState } from '../core/state';
import { massiveOdds } from '../data/gnomeTypes';
import { changeCost, FUSE_TOOLS, TOOL_IDS, UPGRADE_BY_ID, UPGRADES, type Tab, type Upgrade } from '../data/upgrades';
import { FALLBACK_ICON, ICONS, MODELS, TAB_ICONS, thumbnail, warmThumbnails } from './icons';

const TABS: Tab[] = ['Plow', 'Magnet', 'Factory', 'Movement', 'Tools', 'Combos', 'Bonuses', 'Deep'];
// tree cell (px): a node is 120 x 90, the rest is the gap the edges run through
const CW = 150;
const CH = 94;
// shop-only styles (style.css is shared with other UI)
const CSS = `
.shop-tree { position: relative; margin: 0; transform-origin: 0 0; }
.tree-lines { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.tree-lines path { fill: none; stroke: #4a5058; stroke-width: 3; stroke-dasharray: 6 5; }
.tree-lines path.on { stroke: #5fd0ff; stroke-dasharray: none; }
.badge.needs { background: var(--bad); color: #fff; }
/* nine tabs (with Deep) in one line, so the tree keeps its height */
.shop:not(.legend) .tab { padding: 8px 10px; }
@media (max-width: 700px) { .shop:not(.legend) .tab { font-size: 12px; padding: 6px 6px; letter-spacing: 0; } }
/* dark monitor window: title bar, taskbar tabs, status bar, monospace chrome, faint scanlines */
.shop.skill { --mono: ui-monospace, Menlo, Consolas, 'Courier New', monospace; }
.shop.skill .shop-win { position: relative; width: min(1600px, 96vw); height: 92vh; max-height: none; overflow: hidden; background: #10151c; border: 4px solid #3b434d; border-radius: 10px; box-shadow: 0 0 0 2px #0a0d12, 0 24px 80px rgba(0,0,0,.7), inset 0 0 60px rgba(0,0,0,.55); transform-origin: 50% 50%; }
.shop.skill .shop-win::after { content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px); }
.shop.skill .shop-head { padding: 4px 14px; font: 700 18px/24px var(--mono); letter-spacing: 2px; background: linear-gradient(#2d3540, #1c222a); border-bottom: 2px solid #3b434d; gap: 14px; }
.shop.skill .shop-head .shop-money { margin-left: auto; }
.shop.skill .shop-avail { padding: 0 10px; border-radius: 12px; font: 700 15px/24px var(--mono); letter-spacing: 1px; background: #1b222b; color: #6d7a88; border: 2px solid #3b434d; }
.shop.skill .shop-avail.on { background: var(--good); color: #10301a; border-color: var(--good); }
.shop.skill .x { width: 28px; height: 24px; border: 2px solid #3b434d; border-radius: 4px; background: #1b222b; font: 700 14px/20px var(--mono); }
.shop.skill .shop-tabs { padding: 4px 10px 0; gap: 4px; background: #151b23; border-bottom: 2px solid #3b434d; }
.shop.skill .tab { position: relative; font: 700 14px/18px var(--mono); letter-spacing: 0; padding: 7px 10px; border: 2px solid #3b434d; border-bottom: 0; border-radius: 6px 6px 0 0; background: #1b222b; color: #9fb3c8; }
.shop.skill .tab.on { background: #10151c; color: #fff; border-color: #5fd0ff; }
.shop.skill .tab .ti { margin-right: 5px; }
/* icon only where nine labelled tabs would wrap to a second line (measured: they wrap at 950 px and below) */
@media (max-width: 950px) { .shop.skill .tab .tl { display: none; } .shop.skill .tab .ti { margin: 0; font-size: 17px; } }
/* green count of affordable items on a tab */
.tab-n { position: absolute; top: -2px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--good); color: #10301a; font: 700 11px/16px var(--font); text-align: center; }
/* the tree sits in the middle of the screen; the 11 Tools rows scroll at 1280x720 and fit from about 1920x1080 */
.shop.skill .shop-rows { padding: 8px 12px; display: flex; }
.shop.skill .tree-fit { margin: auto; overflow: hidden; }
.shop.skill .node { position: absolute; width: 120px; height: 90px; display: flex; flex-direction: column; align-items: center; cursor: pointer; }
.shop.skill .node .ico { position: relative; width: 60px; height: 60px; flex: none; box-sizing: border-box; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; line-height: 1; background: radial-gradient(#3a4048, #23272e); border: 3px solid #4a5058; box-shadow: 0 3px 0 #15181c; transition: filter .15s; }
.shop.skill .node .ico img { width: 54px; height: 54px; border-radius: 50%; }
.shop.skill .node:hover .ico { filter: brightness(1.25); }
.shop.skill .node .cost { position: absolute; top: 48px; left: 50%; transform: translateX(-50%); padding: 0 6px; border-radius: 8px; background: #4a5058; font-size: 12px; font-weight: 700; line-height: 15px; white-space: nowrap; }
.shop.skill .node .cost:empty { display: none; }
.shop.skill .node .pips { margin-top: 7px; height: 7px; display: flex; gap: 2px; font-size: 9px; line-height: 7px; opacity: .85; }
.shop.skill .node .pips i { width: 7px; height: 7px; border-radius: 50%; background: #4a5058; }
.shop.skill .node .pips i.on { background: var(--accent); }
.shop.skill .node .name { width: 136px; margin-top: 1px; font-size: 13px; font-weight: 600; line-height: 14px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shop.skill .node .tags { position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: 1; width: 136px; display: flex; flex-wrap: wrap; justify-content: center; gap: 2px; white-space: nowrap; }
.shop.skill .node .tags .badge { margin: 0; padding: 0 4px; font-size: 10px; letter-spacing: .3px; }
.shop.skill .node.afford .ico { border-color: var(--good); box-shadow: 0 3px 0 #15181c, 0 0 14px rgba(58,223,106,.6); animation: skillpulse 2s ease-in-out infinite; }
.shop.skill .node.afford .cost { background: var(--good); color: #10301a; }
.shop.skill .node.owned .ico { border-color: #5fd0ff; }
.shop.skill .node.maxed .ico { border-color: var(--accent); background: radial-gradient(#6a5418, #2e2408); }
.shop.skill .node.maxed .cost { background: var(--accent); color: #3a2a00; }
.shop.skill .node.locked, .shop.skill .node.needs { cursor: default; }
.shop.skill .node.locked .ico { filter: grayscale(1); opacity: .5; }
.shop.skill .node.locked .ico::after { content: '🔒'; position: absolute; right: -6px; bottom: -4px; font-size: 16px; }
.shop.skill .node.locked .name, .shop.skill .node.needs .name { opacity: .6; }
.shop.skill .node.needs .ico { border-style: dashed; opacity: .55; }
@keyframes skillpulse { 50% { box-shadow: 0 3px 0 #15181c, 0 0 22px rgba(58,223,106,.95); } }
/* fixed height: the tree is fitted before the panel is filled, so a long description must not grow it */
.shop.skill .shop-desc { flex: none; height: 64px; overflow: hidden; padding: 8px 12px; display: flex; align-items: center; gap: 12px; background: #0d1218; border-top: 2px solid #3b434d; font-size: 14px; line-height: 16px; }
.shop.skill .shop-foot { display: flex; gap: 16px; padding: 4px 14px; font: 12px/20px var(--mono); opacity: 1; color: #9fb3c8; background: linear-gradient(#1c222a, #2d3540); border-top: 2px solid #3b434d; }
.shop.skill .shop-msg { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--good); }
@media (max-width: 700px) { .shop.skill .shop-desc { font-size: 12px; padding: 6px 12px; } }
.shop.skill .shop-desc .ico { width: 40px; height: 40px; flex: none; box-sizing: border-box; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; background: radial-gradient(#3a4048, #23272e); border: 2px solid #4a5058; }
.shop.skill .shop-desc .ico img { width: 36px; height: 36px; border-radius: 50%; }
`;

// one drawn node; the description panel is rebuilt from it, so it shows the current level and price
interface NodeView {
  sel: string; // the node's selector
  name: string;
  head: string; // "LVL 2/10 · $53"
  desc: string;
  locked: boolean;
}

// a node before layout
interface Item {
  key: string; // upgrade id
  attr: string; // data-buy="id"
  hole: number;
  parent?: string;
  parentOn: boolean; // the parent is owned: its edge lights up
  cls: string;
  tags: string;
  ico: string;
  pips: string;
  name: string;
  cost: string;
  view: NodeView;
}

// effect at a given level for the description line; mirrors player.ts, coins.ts, hole.ts, factory.ts and machines.ts
const EFFECT: Record<string, (L: number) => string> = {
  speed: (L) => `${(6.2 * (1 + L * 0.12)).toFixed(1)} m/s`,
  magPower: (L) => `${(0.8 + 0.2 * L).toFixed(1)} m ball, ${(7 + 1.2 * lvl('magRange') + 0.6 * L).toFixed(1)} m reach`,
  throw: (L) => `x${(1 + 0.15 * L).toFixed(2)} throw`,
  scope: (L) => ['no sight', 'colour crosshair', 'reflex glass', 'glass + distance and multiplier'][L] ?? '',
  magnetRange: (L) => `${(2 + L * 1.2).toFixed(1)} m pickup${L >= UPGRADE_BY_ID.magnetRange.max ? ', coins fly to the bank' : ''}`,
  frenzy: (L) => `${Math.round(100 * massiveOdds(ctx.state.holeLevel, L))}% massive`,
  value: (L) => `x${(1 + L * 0.1).toFixed(1)} money`,
  factorySpeed: (L) => `x${(1 + L * 0.15).toFixed(2)} speed`,
  comboCap: (L) => `x${2 + L * 0.5 + deep('dCombo') * 0.5} cap`,
  crateSize: (L) => `${12 + 6 * L} gnomes`,
  plowWidth: (L) => `${(2.6 + 0.8 * L).toFixed(1)} m blade`,
  blowPower: (L) => `+${25 * L}% power`,
  blowRange: (L) => `${(6 + 1.5 * L).toFixed(1)} m`,
  robotBed: (L) => `${5 + 3 * L} gnomes`,
  robotSpeed: (L) => `${(2.5 + 0.6 * L).toFixed(1)} m/s`,
  robotArea: (L) => `${6 + 2 * L} m area`,
  fanPower: (L) => `x${(1 + 0.25 * L).toFixed(2)} push`,
  beltWidth: (L) => `${(1.3 + 0.6 * L).toFixed(1)} m wide`,
};
const fuseEffect = (L: number) => `${L} fuse${L === 1 ? '' : 's'}, ${L + 1} hits to break`;
for (const id of FUSE_TOOLS) EFFECT[`${id}Fuses`] = fuseEffect;

export class Shop {
  isOpen = false;
  private el: HTMLDivElement;
  private tab: Tab = 'Tools';
  private hover: string | undefined; // id of the hovered node
  private views = new Map<string, NodeView>();
  private seen: Set<string>; // ids unlocked at the last visit (this session only)
  private fresh = new Set<string>(); // unlocked since the last visit: NEW badge
  private counts = new Map<Tab, number>(); // affordable items per tab at the last render (pops a changed badge)
  private total = -1; // affordable items over all visible tabs at the last render (pops the title pill)
  private msg = ''; // last buy message, shown in the status bar

  constructor() {
    this.seen = new Set(this.unlockedIds());
    this.el = document.createElement('div');
    this.el.className = 'shop skill hidden';
    document.body.appendChild(this.el);
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab;
      if (tab) {
        this.tab = tab as Tab;
        this.el.querySelector('.shop-rows')?.scrollTo(0, 0);
        this.render();
        return;
      }
      const buy = t.closest<HTMLElement>('[data-buy]')?.dataset.buy;
      if (buy) this.buy(buy);
      if (t.closest('[data-close]')) this.close();
    });
    // right-click on a downgradable node (Strong Arm) pays for one level down
    this.el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]')?.dataset.buy;
      if (id) this.buy(id, -1);
    });
    this.el.addEventListener('mouseover', (e) => {
      const n = (e.target as HTMLElement).closest<HTMLElement>('[data-desc]');
      const id = n?.dataset.buy;
      if (id && id !== this.hover) {
        this.hover = id;
        this.showDesc();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape' || e.code === 'KeyB' || e.code === 'Tab' || e.code === 'KeyE') {
        e.preventDefault();
        this.close();
        // the game's input saw this keydown too: without this, B or E reopen the shop in the next frame
        queueMicrotask(() => ctx.input.pressed.delete(e.code));
      }
    });
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    ctx.paused = true;
    ctx.input.unlock();
    this.el.classList.remove('hidden');
    ctx.player.cancelPlacement();
    this.fresh = new Set(this.unlockedIds().filter((id) => !this.seen.has(id)));
    warmThumbnails(Object.keys(MODELS)); // once per session
    this.msg = '';
    this.render();
    // power-on once per open; render() recreates .shop-win, so a CSS animation there would replay on every buy
    this.el.querySelector('.shop-win')!.animate([{ transform: 'scaleY(.02)', filter: 'brightness(2.5)' }, { transform: 'scaleY(1.03)', filter: 'none', offset: 0.7 }, { transform: 'none' }], { id: 'crt', duration: 250, easing: 'cubic-bezier(.33,1,.68,1)' });
    ctx.audio.toast();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    for (const id of this.unlockedIds()) this.seen.add(id);
    this.el.classList.add('hidden');
    ctx.paused = false;
    ctx.input.lock();
    saveState(ctx.state);
  }

  private unlockedIds(): string[] {
    const hl = ctx.state.holeLevel;
    return UPGRADES.filter((u) => (u.hole ?? 1) <= hl).map((u) => u.id);
  }

  private badges(id: string, afford: boolean): string {
    return (this.fresh.has(id) ? '<span class="badge new">NEW</span>' : '') + (afford ? '<span class="badge afford">AFFORD</span>' : '');
  }

  private level(u: Upgrade): number {
    return u.currency === 'shards' ? deep(u.id) : lvl(u.id);
  }

  // the prerequisite this upgrade still waits for (e.g. Magnet Coil without the Magnet Gun)
  private missing(u: Upgrade): Upgrade | undefined {
    return u.requires && lvl(u.requires) < 1 ? UPGRADE_BY_ID[u.requires] : undefined;
  }

  // dir -1: one level down, only for a downgradable upgrade above level 0; it costs the same as the next level up
  private buy(id: string, dir: 1 | -1 = 1): void {
    const u = UPGRADES.find((x) => x.id === id)!;
    const L = this.level(u);
    if (dir < 0 ? !u.downgrade || L < 1 : L >= u.max || (u.hole ?? 1) > ctx.state.holeLevel || this.missing(u)) return;
    const s = ctx.state;
    const cost = changeCost(u, L, s.paidChanges);
    const next = L + dir;
    if (u.currency === 'shards') {
      if (s.shards < cost) return this.deny();
      s.shards -= cost;
      s.deep[id] = next;
    } else {
      if (s.money < cost) return this.deny();
      s.money -= cost;
      s.upgrades[id] = next;
    }
    if (u.downgrade) {
      const paid = (s.paidChanges ??= {});
      paid[id] = (paid[id] ?? L) + 1;
    }
    ctx.audio.buy();
    if (dir < 0) {
      this.msg = `${u.name} down to LVL ${next}/${u.max} for ${u.currency === 'shards' ? `💎 ${cost}` : money(cost)}`;
      this.render();
      this.pop(`[data-buy="${id}"] .ico`);
      return;
    }
    s.stats.bought++;
    this.msg = `${u.name} bought (LVL ${L + 1}/${u.max})`;
    if (id === 'magGun') {
      ctx.player.setGear('magGun');
      this.say('Magnet Gun bought! C or hold Tab switches between hands and the gun.');
    }
    const key = TOOL_IDS.indexOf(id);
    // only ten digit keys: later tools are placed from the tool wheel
    if (key >= 10) this.say(`${u.name} bought! Open the tool wheel (hold Tab) to place it.`);
    else if (key >= 0) this.say(`${u.name} bought! Press ${(key + 1) % 10} to place it.`);
    if (id === 'beltWidth') {
      // placed belts widen at once
      const back = ctx.machines.rebuild('conveyor');
      if (back) this.say(`Wide Belt: ${back} belt(s) had no room and went back to your inventory.`);
    }
    this.render();
    this.pop(`[data-buy="${id}"] .ico`);
  }

  // purchase pop (outBack); Web Animations run beside the CSS afford pulse instead of replacing it
  private pop(sel: string): void {
    const outBack = 'cubic-bezier(.34,1.56,.64,1)';
    this.el.querySelector(sel)?.animate([{ transform: 'scale(1)', easing: outBack }, { transform: 'scale(1.22)', offset: 0.5, easing: outBack }, { transform: 'scale(1)' }], { id: 'pop', duration: 300 });
  }

  // a buy message goes to the status bar only: a HUD toast would repeat it over the window
  private say(text: string): void {
    this.msg = text;
  }

  private deny(): void {
    ctx.audio.deny();
    this.el.querySelector('.shop-money')?.classList.add('shake');
    setTimeout(() => this.el.querySelector('.shop-money')?.classList.remove('shake'), 400);
  }

  // what a flat row and a tree node both show for one upgrade
  private rowData(u: Upgrade) {
    const s = ctx.state;
    const L = this.level(u);
    const locked = (u.hole ?? 1) > s.holeLevel;
    const maxed = L >= u.max;
    const cost = changeCost(u, L, s.paidChanges);
    const poor = (u.currency === 'shards' ? s.shards : s.money) < cost;
    const price = u.currency === 'shards' ? `💎 ${cost}` : money(cost);
    const need = maxed ? undefined : this.missing(u);
    const afford = !locked && !maxed && !need && !poor;
    const fx = EFFECT[u.id];
    const desc = locked ? 'Feed the hole to find out.' : fx ? `${u.desc} (now: ${fx(L)}${maxed ? '' : `, next: ${fx(L + 1)}`})` : u.desc;
    // the key hint and price of one level down (the same price as the next level up)
    // Feeding Frenzy also ignores weight, so going below the last Strong Arm level does not bring weight back (PP [G6] a)
    const frenzy = u.id === 'throw' && lvl('frenzy') ? ' · Feeding Frenzy also ignores weight' : '';
    const down = u.downgrade && L > 0 && !locked ? ` · right-click: down to LVL ${L - 1} for ${price}${frenzy}` : '';
    return { L, locked, need, maxed, poor, price, afford, desc, down };
  }

  private upgradeItem(u: Upgrade, list: Upgrade[]): Item {
    const { L, locked, need, maxed, price, afford, desc, down } = this.rowData(u);
    const thumb = thumbnail(u.id);
    // a parent from another tab is not drawn, so its child is a root here (the buy guard still applies)
    const parent = u.requires && list.some((p) => p.id === u.requires) ? u.requires : undefined;
    const pips = u.max <= 8 ? Array.from({ length: u.max }, (_, i) => `<i${i < L ? ' class="on"' : ''}></i>`).join('') : `${L}/${u.max}`;
    return {
      key: u.id,
      attr: `data-buy="${u.id}"`,
      hole: u.hole ?? 1,
      parent,
      parentOn: !!parent && lvl(parent) >= 1,
      cls: locked ? 'locked' : need ? 'needs' : maxed ? 'maxed' : afford ? 'afford' : L > 0 ? 'owned' : '',
      tags: locked ? '' : (need ? `<span class="badge needs">needs ${need.name}</span>` : '') + this.badges(u.id, afford),
      ico: thumb ? `<img src="${thumb}" alt="">` : (ICONS[u.id] ?? FALLBACK_ICON),
      pips: `<span class="pips" data-l="${L}" data-max="${u.max}">${pips}</span>`,
      name: locked ? '???' : u.name,
      cost: maxed ? 'MAX' : locked ? `HOLE LVL ${u.hole}` : need ? '' : price,
      view: { sel: `[data-buy="${u.id}"]`, name: u.name, head: `LVL ${L}/${u.max} · ${maxed ? 'MAX' : need ? `needs ${need.name}` : price}${down}`, desc, locked },
    };
  }

  // the items that pulse green on a tab right now
  private affordCount(t: Tab): number {
    return UPGRADES.filter((u) => u.tab === t && this.rowData(u).afford).length;
  }

  // skill tree: one row per root (an item without a parent on this tab), read left to right: the root, then its
  // descendants in data order (so a tool's Fuses come last); rows sorted by unlock level, then base price (PP 2026-10-24).
  // A line runs from the node's own parent: straight when the parent stands right before it, otherwise it forks off
  // the parent's line in the gap after the parent and runs under the row (below the labels) to the node.
  // A line lights up when the node's parent is owned.
  private tree(tab: Tab): string {
    const ups = UPGRADES.filter((u) => u.tab === tab);
    const list = ups.map((u) => this.upgradeItem(u, ups));
    this.views = new Map(list.map((it) => [it.key, it.view]));
    if (!list.length) return '';
    const price = (it: Item) => UPGRADE_BY_ID[it.key]?.cost ?? 0;
    const rows = list
      .filter((it) => !it.parent)
      .sort((a, b) => a.hole - b.hole || price(a) - price(b))
      .map((root) => {
        const row = [root];
        const add = (key: string) => list.filter((k) => k.parent === key).forEach((k) => (row.push(k), add(k.key)));
        add(root.key);
        return row;
      });
    const w = (Math.max(...rows.map((row) => row.length)) - 1) * CW + 120;
    const h = (rows.length - 1) * CH + 90;
    let lines = '';
    let nodes = '';
    rows.forEach((row, r) => row.forEach((it, c) => {
      const pc = row.findIndex((p) => p.key === it.parent);
      const y = r * CH + 30;
      const route = c === pc + 1 ? '' : `H${(pc + 1) * CW - 15}V${r * CH + 92}H${c * CW - 15}V${y}`;
      if (pc >= 0) lines += `<path class="${it.parentOn ? 'on' : ''}" d="M${pc * CW + 120} ${y}${route}H${c * CW}"/>`;
      nodes += `<div class="node ${it.cls}" style="left:${c * CW}px;top:${r * CH}px" ${it.attr} data-desc="${it.view.desc}"><span class="tags">${it.tags}</span><span class="ico">${it.ico}</span>${it.pips}<span class="name">${it.name}</span><span class="cost">${it.cost}</span></div>`;
    }));
    return `<div class="tree-fit"><div class="shop-tree" style="width:${w}px;height:${h}px"><svg class="tree-lines" width="${w}" height="${h}">${lines}</svg>${nodes}</div></div>`;
  }

  // the description panel for the hovered node, rebuilt from the current render (level and price stay fresh)
  private showDesc(): void {
    const d = this.el.querySelector('.shop-desc');
    if (!d) return;
    const v = this.hover ? this.views.get(this.hover) : undefined;
    if (!v || v.locked) {
      d.textContent = v ? v.desc : 'Hover an item to read about it.';
      return;
    }
    const text = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = v.name;
    text.append(b, ` · ${v.head}`, document.createElement('br'), v.desc);
    const ico = this.el.querySelector(`${v.sel} .ico`)?.cloneNode(true);
    d.replaceChildren(...(ico ? [ico] : []), text);
  }

  render(): void {
    const s = ctx.state;
    const showDeep = s.shards > 0 || s.stats.rebirths > 0;
    const tabs = TABS.filter((t) => t !== 'Deep' || showDeep);
    // a buy re-renders the rows: keep the scroll, or the next click lands on another node
    const scroll = this.el.querySelector('.shop-rows')?.scrollTop ?? 0;
    const counts = new Map(tabs.map((t) => [t, this.affordCount(t)] as const));
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    this.el.innerHTML = `
      <div class="shop-win">
        <div class="shop-head"><span>GNOME-OS SHOP</span><span class="shop-avail ${total ? 'on' : ''}">AVAILABLE: ${total}</span><span class="shop-money">${money(s.money)}${showDeep ? ` · 💎 ${s.shards}` : ''}</span><button class="x" data-close>✕</button></div>
        <div class="shop-tabs">${tabs.map((t) => {
          const n = counts.get(t)!;
          return `<button class="tab ${t === this.tab ? 'on' : ''}" data-tab="${t}"><span class="ti">${TAB_ICONS[t]}</span><span class="tl">${t.toUpperCase()}</span>${n ? `<span class="tab-n">${n}</span>` : ''}</button>`;
        }).join('')}</div>
        <div class="shop-rows">${this.tree(this.tab)}</div>
        <div class="shop-desc"></div>
        <div class="shop-foot"><span>Gnomes eaten: ${s.stats.gnomesEaten} · Best combo: ${s.stats.maxCombo}</span><span class="shop-msg">${this.msg}</span><span>Esc / B to close</span></div>
      </div>`;
    const rows = this.el.querySelector<HTMLElement>('.shop-rows')!;
    const tree = rows.querySelector<HTMLElement>('.shop-tree');
    if (tree) {
      // fit the widest tab into a small window (640x360) instead of scrolling sideways; a tree a little too
      // tall shrinks to fit too, a much taller one (640x360) scrolls instead of turning unreadable
      const kw = Math.min(1, (rows.clientWidth - 24) / tree.offsetWidth);
      const kh = (rows.clientHeight - 16) / tree.offsetHeight;
      const k = kh >= 0.75 ? Math.min(kw, kh) : kw;
      if (k < 1) tree.style.transform = `scale(${k})`;
      const fit = tree.parentElement!;
      fit.style.width = `${tree.offsetWidth * k}px`;
      fit.style.height = `${tree.offsetHeight * k}px`;
    }
    for (const t of tabs) {
      const n = counts.get(t)!;
      if (n && n !== this.counts.get(t)) this.pop(`.tab[data-tab="${t}"] .tab-n`);
      this.counts.set(t, n);
    }
    if (this.total >= 0 && total !== this.total) this.pop('.shop-avail');
    this.total = total;
    rows.scrollTop = scroll;
    this.showDesc();
  }
}
