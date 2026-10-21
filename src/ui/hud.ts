import * as THREE from 'three';
import { ctx, lvl } from '../core/context';
import { money, num } from '../core/format';
import { holeLevel, MAX_HOLE_LEVEL } from '../data/holeLevels';
import { TOOL_IDS, UPGRADE_BY_ID } from '../data/upgrades';
import type { Gnome } from '../entities/gnomes';
import { crateCap, fuseCount } from '../entities/machines';
import { inQuad, outBack, outCubic } from '../core/ease';
import { loadNotes } from '../core/state';
import { GEARS, type Gear } from '../player/sweeper';

const BIG_T = 1.5;
const BIG_POP = 0.3;
const BIG_FADE = 0.4;
const HINT_T = 4;
const HINT_POP = 0.25;
const HINT_FADE = 0.3;
const READ_POP = 0.2; // Trick Scope glass readout pops when its text changes
// cards in the left column (messages, achievements, the effects panel): grow in, hold, collapse out
const CARD_IN = 0.3;
const CARD_OUT = 0.35;
const TOAST_T = 4.2;
const ACH_T = 5;
const MAX_TOASTS = 4;
export const LINKS = { coffee: '' }; // Buy Me a Coffee page (PP adds it); empty = no "Press F" line on The Deep

// first-use hint: one line of what to do, keyed by tool / gear id; missing ids show the shop description
const HINTS: Record<string, string> = {
  box: 'Drop or throw gnomes in, then drag the crate into the hole with the magnet.',
  trampoline: 'Bounces gnomes the way it faces.',
  panel: 'Build covers, ramps and tunnels that guide gnomes to the hole.',
  fan: 'Blows gnomes away in a cone the way it faces.',
  conveyor: 'Carries gnomes the way it faces. Tilt it to make a ramp.',
  wheel: 'Kicks everything in front of it.',
  magnet: 'Pulls gnomes in a big radius. Place it next to the hole.',
  cannon: 'Loads gnomes that walk in and fires them the way it faces.',
  vacuum: 'Sucks nearby gnomes straight into the hole.',
  blackhole: 'Eats gnomes on the spot at full value.',
  robot: 'Place its home post: it collects gnomes around it and tips them into the hole.',
  tractor: 'Drive into gnomes: the plow pushes everything in front of it.',
  blower: 'Blows gnomes away in a cone, the way you look.',
  magGun: 'Pull many gnomes into a ball, then throw them all at once.',
  boots: 'Slam down next to a pile: the gnomes fly up and toward the hole.',
};
const PLACE_KEYS = '<b>LMB</b> place · <b>R</b> turn · <b>T</b> tilt · <b>hold RMB</b> + mouse rotate · <b>Q</b> cancel';
const GEAR_KEYS: Record<string, string> = {
  tractor: 'hold <b>Tab</b> · <b>WASD</b> drive · <b>C</b> back to hands',
  blower: 'hold <b>Tab</b> · <b>hold LMB</b> blow · <b>C</b> back to hands',
  magGun: '<b>C</b> or hold <b>Tab</b> · <b>hold LMB</b> pull · release <b>LMB</b> drop · <b>RMB</b> throw',
  boots: '<b>Space</b> in the air double jump · <b>J</b> in the air ground pound',
};

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  el.className = cls;
  el.innerHTML = html;
  parent.appendChild(el);
  return el;
};

export const TOOL_ICONS: Record<string, string> = {
  box: '📦', trampoline: '🤸', fan: '🌀', panel: '▭', conveyor: '⏩', wheel: '🥾', magnet: '🧲', cannon: '💣', vacuum: '🌪️', blackhole: '🕳️', robot: '🤖',
};

interface Card {
  el: HTMLDivElement;
  t: number; // seconds since it started to enter
  leaveAt: number; // t at which it starts to leave; Infinity = stays
  h: number; // full height (px), read when it enters
  pad: number; // its CSS vertical padding and bottom margin, collapsed with it
  gap: number;
  key: string; // kind|text: a repeat while it shows bumps its ×N instead of a new card
  n: number;
}

interface Bubble {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  t: number;
}

export class Hud {
  root: HTMLDivElement;
  private moneyEl: HTMLDivElement;
  private shardsEl: HTMLDivElement;
  private holeLabel: HTMLDivElement;
  private holeFill: HTMLDivElement;
  private holeMult: HTMLDivElement;
  private comboBox: HTMLDivElement;
  private comboNum: HTMLDivElement;
  private comboMult: HTMLDivElement;
  private comboCapEl: HTMLDivElement;
  private comboRing: SVGCircleElement;
  private wpArrow: HTMLDivElement;
  private wpMark: HTMLDivElement;
  private aimEl: HTMLDivElement; // Trick Scope Lvl 1: the tricks the predicted throw would score, next to its landing ring
  // Trick Scope: crosshair colour (Lvl 1+), reflex glass with the readout around it (Lvl 2+)
  private cross: HTMLDivElement;
  private crossState = '';
  private crossOn = false;
  private crossPop: Animation | null = null;
  private glass: HTMLDivElement;
  private glassRead: HTMLDivElement;
  private readT = READ_POP;
  private helpEl: HTMLDivElement;
  private helpManual: boolean | null = null; // null = auto: shown for the first 20 s of a new game
  // left column: GOAL, contract (inserted by Contracts), effects, messages; nothing in it overlaps
  left: HTMLDivElement;
  private fx: Card;
  private fxHtml = '';
  private cards: Card[] = [];
  private hotbar: HTMLDivElement;
  private sackEl: HTMLDivElement;
  private gearEl: HTMLDivElement;
  private goalEl: HTMLDivElement;
  private factoryEl: HTMLDivElement;
  private factoryFill: HTMLDivElement;
  private factoryLabel: HTMLDivElement;
  private sackKey = '';
  private goalKey = '';
  private prompt: HTMLDivElement;
  private toasts: HTMLDivElement;
  private big: HTMLDivElement;
  private bannerEl: HTMLDivElement;
  private splatEl: HTMLDivElement;
  private levelEl: HTMLDivElement;
  private bubbles: Bubble[] = [];
  private tmp = new THREE.Vector3();
  private lastMoney = -1;
  private shardsText = '';
  private holeLabelText = '';
  private holeFillText = '';
  private holeMultText = '';
  private bigT = BIG_T;
  private bigSize = 1;
  private pulseT = 1;
  private pulseLen = 0.25;
  private pulseS = 0;
  private hotbarKey = '';
  private wheelEl: HTMLDivElement; // tool wheel (hold Tab)
  private wheelKey = '';
  private hintEl: HTMLDivElement;
  private hintT = HINT_T;

  constructor() {
    this.root = h('div', 'hud', document.body);
    const tr = h('div', 'hud-money', this.root);
    this.moneyEl = h('div', 'money', tr);
    this.shardsEl = h('div', 'shards', tr);

    const hole = h('div', 'hud-hole', this.root);
    this.holeLabel = h('div', 'hole-label', hole);
    const bar = h('div', 'hole-bar', hole);
    this.holeFill = h('div', 'hole-fill', bar);
    this.holeMult = h('div', 'hole-mult', hole);

    this.comboBox = h('div', 'hud-combo', this.root);
    this.comboNum = h('div', 'combo-num', this.comboBox);
    const ring = h('div', 'combo-ring', this.comboBox, '<svg viewBox="0 0 64 64"><circle class="cr-bg" cx="32" cy="32" r="28"/><circle class="cr-fill" cx="32" cy="32" r="28" pathLength="100"/></svg>');
    this.comboRing = ring.querySelector('.cr-fill')!;
    this.comboMult = h('div', 'combo-mult', ring);
    this.comboCapEl = h('div', 'combo-cap', this.comboBox);

    // on body, not in .hud: .hud is its own stacking context below the shop and menus, and messages stay readable over them
    this.left = h('div', 'hud-left', document.body);
    this.goalEl = h('div', 'hud-goal', this.left);
    const fxEl = h('div', 'hud-effects', this.left);
    fxEl.style.display = 'none';
    this.fx = { el: fxEl, t: 0, leaveAt: Infinity, h: 0, pad: 0, gap: 0, key: '', n: 1 };
    this.toasts = h('div', 'hud-toasts', this.left);
    this.hotbar = h('div', 'hud-hotbar', this.root);
    this.sackEl = h('div', 'hud-sack', this.root);
    this.gearEl = h('div', 'hud-gear', this.root);
    this.gearEl.style.display = 'none';
    this.factoryEl = h('div', 'hud-factory', this.root, '<div class="f-label">GNOME FACTORY</div>');
    this.factoryFill = h('div', 'f-fill', h('div', 'f-bar', this.factoryEl));
    this.factoryLabel = this.factoryEl.querySelector('.f-label') as HTMLDivElement;
    this.cross = h('div', 'crosshair', this.root);
    this.glass = h('div', 'hud-glass', this.root, '<div class="glass-read"></div>');
    this.glassRead = this.glass.firstElementChild as HTMLDivElement;
    this.prompt = h('div', 'hud-prompt', this.root);
    this.big = h('div', 'hud-big', this.root);
    this.bannerEl = h('div', 'hud-banner', this.root);
    this.splatEl = h('div', 'hud-splat', this.root);
    this.levelEl = h('div', 'hud-level', this.root);
    this.helpEl = h(
      'div',
      'hud-helpbox hidden',
      this.root,
      '<div class="hb-head">CONTROLS <span>H to hide</span></div>' +
        '<div class="hb-sec">Moving</div><div><b>WASD</b> move · <b>Shift</b> sprint · <b>Space</b> jump · <b>J</b> (in the air) ground pound · <b>F</b> kick · <b>E</b> use · <b>B</b> shop · <b>C</b> hands ↔ current tool · <b>hold Tab</b> tool wheel (hands, Magnet Gun, tractor, blower, tools past the 10th) · <b>K</b> blueprints · <b>Z</b> undo a tool · <b>L</b> legend · <b>I</b> replay · <b>M</b> mute · <b>Esc</b> menu</div>' +
        '<div class="hb-sec">Magnet</div><div><b>hold LMB</b> grab one thing (many with the Magnet Gun) · release <b>LMB</b> drop · <b>RMB</b> throw · <b>X</b> pick up a tool · <b>G</b> move a tool</div>' +
        '<div class="hb-sec">Placing tools</div><div><b>1-0</b> pick a tool · <b>LMB</b> place · <b>hold RMB</b> + mouse rotate · <b>R</b> turn · <b>T</b> tilt · <b>V</b> reset · wheel distance · <b>Q</b> cancel</div>',
    );
    h('div', 'hud-help', this.root, '<b>H</b> controls · <b>L</b> legend');
    // after the help panel so the edge arrow stays on top of it
    this.wpArrow = h('div', 'wp-arrow hidden', this.root, '➤');
    this.wpMark = h('div', 'wp-mark hidden', this.root);
    this.aimEl = h('div', 'aim-label', this.root);
    this.wheelEl = h('div', 'hud-wheel', this.root);
    this.hintEl = h('div', 'hud-hint', this.root);
  }

  // The first time a tool or gear is selected in this save: its name, keys and what to do, for HINT_T seconds.
  firstUse(id: string): void {
    const seen = ctx.state.seenHints;
    // behind an overlay (shop, menu, boot) the hint is neither shown nor used up
    if (ctx.paused || seen.includes(id)) return;
    seen.push(id);
    const u = UPGRADE_BY_ID[id];
    const i = TOOL_IDS.indexOf(id);
    const key = i < 0 ? '' : i < 10 ? `<b>${(i + 1) % 10}</b> or hold <b>Tab</b>` : 'hold <b>Tab</b>';
    const keys = i < 0 ? GEAR_KEYS[id] ?? '' : `${key} · ${PLACE_KEYS}`;
    this.hintEl.innerHTML = `<div class="h-title">${u.name}</div><div class="h-keys">${keys}</div><div class="h-what">${HINTS[id] ?? u.desc}</div>`;
    this.hintT = 0;
  }

  // the next action closes the hint early (fade out from where it is)
  hideHint(): void {
    this.hintT = Math.max(this.hintT, HINT_T - HINT_FADE);
  }

  // strength 0 = a coin landing, up to 1 = a capped trick shot (bigger, longer, gold glow)
  moneyPulse(strength = 0): void {
    // a coin pulse does not cut short a running trick pulse
    if (this.pulseT < this.pulseLen && strength < this.pulseS) return;
    this.pulseS = strength;
    this.pulseT = 0;
    this.pulseLen = 0.25 + 0.35 * strength;
  }

  toast(text: string, kind: 'good' | 'bad' | 'info' | 'secret' = 'info'): void {
    const key = `${kind}|${text}`;
    const same = this.cards.find((c) => c.key === key && c.t < c.leaveAt);
    if (same) {
      same.n++;
      same.el.textContent = text;
      h('span', 'n', same.el).textContent = `×${same.n}`;
      same.t = Math.min(same.t, CARD_IN); // the hold starts again
      return;
    }
    this.card(`toast ${kind}`, TOAST_T, key).textContent = text;
  }

  // a new card at the top of the message list; past MAX_TOASTS the oldest starts to leave (animated)
  private card(cls: string, life: number, key: string): HTMLDivElement {
    const el = h('div', cls, this.toasts);
    this.cards.push({ el, t: 0, leaveAt: life, h: 0, pad: 0, gap: 0, key, n: 1 });
    const live = this.cards.filter((c) => c.t < c.leaveAt);
    for (let i = 0; i < live.length - MAX_TOASTS; i++) live[i].leaveAt = live[i].t;
    return el;
  }

  // grow in (height, padding, gap with outCubic, slide with outBack), hold, collapse out with inQuad; true when gone
  private animCard(c: Card, dt: number): boolean {
    const s = c.el.style;
    if (!c.h) {
      s.maxHeight = s.paddingTop = s.paddingBottom = s.marginBottom = '';
      const cs = getComputedStyle(c.el);
      c.pad = parseFloat(cs.paddingTop);
      c.gap = parseFloat(cs.marginBottom);
      c.h = c.el.offsetHeight;
    }
    c.t += dt;
    const kin = Math.min(1, c.t / CARD_IN);
    const kout = c.t < c.leaveAt ? 0 : Math.min(1, (c.t - c.leaveAt) / CARD_OUT);
    const grow = outCubic(kin) * (1 - inQuad(kout));
    const hold = kin >= 1 && kout === 0;
    s.opacity = hold ? '' : String(grow);
    s.transform = hold ? '' : `translateX(${-30 * (1 - outBack(kin)) - 30 * inQuad(kout)}px)`;
    s.maxHeight = hold ? '' : `${c.h * grow}px`;
    s.paddingTop = s.paddingBottom = hold ? '' : `${c.pad * grow}px`;
    s.marginBottom = hold ? '' : `${c.gap * grow}px`;
    return kout >= 1;
  }

  // sub: a second, gold line (the money a trick shot paid); size scales the pop
  bigText(text: string, color: string, sub = '', size = 1): void {
    this.big.textContent = text;
    this.big.style.color = color;
    if (sub) h('div', 'big-sub', this.big).textContent = sub;
    this.bigSize = size;
    // wrap before the pop scale so a long trick line stays inside the screen
    this.big.style.maxWidth = `${90 / size}vw`;
    this.bigT = 0;
  }

  banner(title: string, sub: string): void {
    this.bannerEl.innerHTML = `<div class="b-title">${title}</div><div class="b-sub">${sub}</div>`;
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
  }

  achievement(name: string, desc: string): void {
    this.card('toast ach', ACH_T, '').innerHTML = `<div class="a-head">🏆 Achievement</div><div class="a-name">${name}</div><div class="a-desc">${desc}</div>`;
  }

  // the effects panel enters with the first effect and leaves after the last; its rows stay while it collapses
  private effects(html: string, dt: number): void {
    const c = this.fx;
    const shown = c.el.style.display !== 'none';
    if (html && html !== this.fxHtml) c.el.innerHTML = this.fxHtml = html;
    if (html && !shown) {
      c.el.style.display = '';
      c.t = 0;
      c.h = 0;
      c.leaveAt = Infinity;
    } else if (html && c.leaveAt !== Infinity) {
      // an effect started during the leave: grow back from about where it is, with the new height
      c.t = CARD_IN * (1 - Math.min(1, (c.t - c.leaveAt) / CARD_OUT));
      c.h = 0;
      c.leaveAt = Infinity;
    } else if (!html && shown && c.leaveAt === Infinity) {
      c.h = 0; // re-read: rows came and went since it entered
      c.leaveAt = c.t;
    }
    if (c.el.style.display !== 'none' && this.animCard(c, dt)) {
      c.el.style.display = 'none';
      c.el.innerHTML = this.fxHtml = '';
    }
  }

  splat(): void {
    this.splatEl.classList.remove('show');
    void this.splatEl.offsetWidth;
    this.splatEl.classList.add('show');
  }

  levelUp(level: number, mult: number, unlock: string, whisper: string): void {
    this.levelEl.innerHTML = `<div class="l-title">HOLE LEVEL ${level}</div><div class="l-mult">x${mult} money</div>${unlock ? `<div class="l-unlock">Unlocked: ${unlock}</div>` : ''}${whisper ? `<div class="l-whisper">“${whisper}”</div>` : ''}`;
    this.levelEl.classList.remove('show');
    void this.levelEl.offsetWidth;
    this.levelEl.classList.add('show');
  }

  speech(pos: THREE.Vector3, text: string): void {
    if (this.bubbles.length > 6) {
      this.bubbles.shift()!.el.remove();
    }
    const el = h('div', 'bubble', this.root);
    el.textContent = text;
    this.bubbles.push({ el, pos, t: 0 });
  }

  deep(shards: number, done: () => void): void {
    ctx.paused = true;
    const el = h('div', 'deep', document.body);
    const lines = [
      'You fall.',
      'Past the dirt. Past the roots. Past the gnomes.',
      'Thousands of little faces look up at you from the dark.',
      'They are not angry.',
      'They are waiting.',
      'The hole was never hungry.',
      'It was lonely.',
      `You gained ${shards} Hole Shard${shards === 1 ? '' : 's'}.`,
      'The garden begins again.',
    ];
    const lineEl = h('div', 'deep-lines', el);
    let f: HTMLDivElement | undefined;
    let paid = false;
    const onF = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.repeat || paid) return;
      paid = true;
      window.open(LINKS.coffee, '_blank', 'noopener');
      f!.textContent = 'Respects paid. Thank you ♥';
      ctx.audio.toast();
    };
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        lineEl.innerHTML = '<div class="deep-line">THE DEEP</div><button class="btn">Be reborn</button>';
        lineEl.querySelector('button')!.addEventListener('click', () => {
          window.removeEventListener('keydown', onF);
          done();
        });
        return;
      }
      // born with the second line: a kick-F tapped right after falling in cannot open the tab
      if (i === 1 && LINKS.coffee && !f) {
        f = h('div', 'deep-f', el);
        f.textContent = 'Press F to pay respects';
        window.addEventListener('keydown', onF);
      }
      lineEl.innerHTML = `<div class="deep-line">${lines[i++]}</div>`;
      ctx.audio.whisper();
      setTimeout(next, 2600);
    };
    ctx.input.unlock();
    next();
  }

  update(dt: number): void {
    const s = ctx.state;
    if (s.money !== this.lastMoney) {
      this.moneyEl.textContent = money(s.money);
      this.lastMoney = s.money;
    }
    // DOM writes only on change: 3 text writes per frame were 180 mutations a second on a still screen
    const shards = s.shards > 0 ? `💎 ${num(s.shards)} shards` : '';
    if (shards !== this.shardsText) this.shardsEl.textContent = this.shardsText = shards;

    const L = holeLevel(s.holeLevel);
    const max = s.holeLevel >= MAX_HOLE_LEVEL;
    const levelText = max ? `HOLE LVL ${s.holeLevel} · MAX · JUMP IN` : `HOLE LVL ${s.holeLevel}`;
    if (levelText !== this.holeLabelText) this.holeLabel.textContent = this.holeLabelText = levelText;
    const fill = max ? '100%' : `${Math.min(100, (s.holeXp / L.xp) * 100)}%`;
    if (fill !== this.holeFillText) this.holeFill.style.width = this.holeFillText = fill;
    const mult = max ? `x${L.mult} money` : `XP ${Math.floor(s.holeXp)} / ${L.xp} · money x${L.mult} → x${holeLevel(s.holeLevel + 1).mult}`;
    if (mult !== this.holeMultText) this.holeMult.textContent = this.holeMultText = mult;

    const hole = ctx.hole;
    if (hole.combo > 1) {
      this.comboBox.classList.add('on');
      this.comboNum.textContent = `${hole.combo} COMBO`;
      this.comboMult.textContent = `x${hole.comboMult.toFixed(1)}`;
      this.comboCapEl.textContent = `cap x${hole.comboCap}`;
      this.comboRing.style.strokeDashoffset = `${100 - (hole.comboTimer / hole.comboWindow) * 100}`;
      const sc = 1 + Math.min(0.6, hole.combo / 120);
      this.comboBox.style.transform = `translateY(-50%) scale(${sc}) rotate(${Math.sin(ctx.time * 20) * Math.min(4, hole.combo / 15)}deg)`;
      this.comboBox.style.color = hole.combo >= 60 ? '#ff4a8a' : hole.combo >= 15 ? '#ffd23f' : '#fff';
    } else this.comboBox.classList.toggle('on', false); // unlike remove(), no attribute write when already off

    // effects panel under the contract, in its style: one row per running effect
    const row = (color: string, label: string, right: string) => `<div class="ef-row" style="border-color:${color}"><span>${label}</span><b>${right}</b></div>`;
    let bh = ctx.buffs
      .list()
      .map((b) => row(`#${b.def.cap.toString(16).padStart(6, '0')}`, `🍄 ${b.def.name}`, `${Math.ceil(b.left)} s`))
      .join('');
    if (ctx.buffs.midasLeft > 0) bh += row('#ffcc22', '✨ Midas x3', `${ctx.buffs.midasLeft} gnomes`);
    if (ctx.events.goldenHour > 0) bh += row('#ffd23f', '🌅 Golden Hour', `${Math.ceil(ctx.events.goldenHour)} s`);
    if (ctx.factory.rush > 0) bh += row('#ff8a2a', '🏭 OVERTIME x1.5', `${Math.ceil(ctx.factory.rush)} s`);
    if (ctx.events.wind > 0) {
      // arrow relative to where the player looks: up = blowing away from you
      const pl = ctx.player;
      const fx = -Math.sin(pl.yaw);
      const fz = -Math.cos(pl.yaw);
      const w = ctx.events.windDir;
      const deg = Math.round((Math.atan2(w.x * -fz + w.z * fx, w.x * fx + w.z * fz) * 180) / Math.PI / 15) * 15;
      bh += row('#e8f6ff', `💨 Wind <span style="display:inline-block;transform:rotate(${deg}deg)">⬆</span>`, `${Math.ceil(ctx.events.wind)} s`);
    }
    this.effects(bh ? `<div class="ef-head">EFFECTS</div>${bh}` : '', dt);
    for (let i = this.cards.length - 1; i >= 0; i--) {
      if (!this.animCard(this.cards[i], dt)) continue;
      this.cards[i].el.remove();
      this.cards.splice(i, 1);
    }
    // the panels hide behind the shop and menus; the messages stay on top
    this.left.classList.toggle('paused', ctx.paused);

    // hotbar
    const p = ctx.player;
    const key = TOOL_IDS.map((id) => `${lvl(id)}-${ctx.machines.available(id)}`).join(',') + p.placing;
    if (key !== this.hotbarKey) {
      this.hotbarKey = key;
      this.hotbar.innerHTML = TOOL_IDS.filter((id) => lvl(id) > 0)
        .map((id) => {
          const i = TOOL_IDS.indexOf(id);
          // tools past the tenth have no digit key: the tool wheel places them
          return `<div class="slot ${p.placing === id ? 'sel' : ''} ${ctx.machines.available(id) ? '' : 'empty'}"><span class="k">${i < 10 ? (i + 1) % 10 : ''}</span><span class="i">${TOOL_ICONS[id]}</span><span class="c">${ctx.machines.available(id)}/${lvl(id)}</span><span class="n">${UPGRADE_BY_ID[id].name}</span></div>`;
        })
        .join('');
    }
    // tool wheel: slices on a ring, slice 0 at the top, clockwise (same order as ToolWheel.index)
    const wh = p.wheel;
    this.wheelEl.classList.toggle('on', wh.open);
    const wk = wh.open ? wh.items.map((it) => `${it.id}${it.enabled}${it.count}`).join() + `|${wh.index}` : this.wheelKey;
    if (wk !== this.wheelKey) {
      this.wheelKey = wk;
      const n = wh.items.length;
      const sel = wh.items[wh.index];
      this.wheelEl.innerHTML =
        wh.items
          .map((it, i) => {
            const a = (i / n) * Math.PI * 2;
            return `<div class="wslice${i === wh.index ? ' on' : ''}${it.enabled ? '' : ' off'}" style="left:${160 + Math.sin(a) * 112}px;top:${160 - Math.cos(a) * 112}px"><span class="i">${it.icon}</span>${it.count ? `<span class="c">${it.count}</span>` : ''}</div>`;
          })
          .join('') + `<div class="wcentre">${sel ? sel.label : ''}</div>`;
    }
    // magnet panel: what you hold and its weight
    const h = p.held;
    const g = h?.gnome;
    const gun = p.sweeper.gear === 'magGun' && !h;
    const sw = gun ? p.ballGnomes : [];
    const label = gun
      ? `MAGNET GUN ${sw.length} gnomes · ball ${p.ballR.toFixed(1)} m`
      : `MAGNET · ${g ? `${g.type.name} <b class="tier t-${g.tier.id}">${g.tier.id}</b>` : h?.crate ? `Crate ${h.crate.queue.length}/${crateCap()}` : h?.prop ? (h.prop.kind === 'letter' ? `Letter ${h.prop.letter}` : 'Garden prop') : 'nothing'}`;
    // what the hole would pay for it right now (no trick shot bonus)
    const gnomeWorth = (x: Gnome) => x.type.value * x.tier.value * hole.valueScale * hole.comboMult;
    const total = sw.length ? sw.reduce((s, x) => s + gnomeWorth(x), 0) : g ? gnomeWorth(g) : 0;
    const worth = total ? ` · worth <b class="worth">${money(total)}</b>` : '';
    const mass = h ? h.body.mass() : 0;
    const sk = `${label}|${worth}|${mass.toFixed(1)}`;
    if (sk !== this.sackKey) {
      this.sackKey = sk;
      this.sackEl.innerHTML =
        `<div class="sack-label">${label}</div>` +
        `<div class="mag-row">${gun ? (total ? `worth <b class="worth">${money(total)}</b>` : 'empty') : `weight ${mass ? mass.toFixed(1) : '-'} kg${worth}`}</div>` +
        `<div class="sack-hint">hold LMB magnet · release drop · RMB throw</div>`;
    }
    // the magnet panel only while LMB grabs; the gear line above the hotbar names the tool and what C gives
    // (hidden until a second gear is owned)
    const gear = p.sweeper.gear;
    const hands = p.sweeper.grabs;
    this.sackEl.style.display = hands ? '' : 'none';
    const nxt = p.sweeper.next();
    const gearName = (id: Gear) => GEARS.find((x) => x.id === id)!.label;
    const detail = gear === 'blower' ? ` · ${p.sweeper.blowRange.toFixed(1)} m` : gear === 'tractor' ? ` · plow ${p.sweeper.plowWidth.toFixed(1)} m` : '';
    const gl = p.sweeper.owned().length > 1 ? `${gearName(gear).toUpperCase()}${detail}${nxt ? ` · C: ${gearName(nxt)}` : ' · hold Tab'}` : '';
    if (this.gearEl.textContent !== gl) this.gearEl.textContent = gl;
    this.gearEl.style.display = gl ? '' : 'none';

    // two goal tracks shown together: milestones and lessons
    const tracks = [['GOAL', ctx.goals.progress()], ['LESSON', ctx.goals.progress2()]] as const;
    const gk = tracks.map(([, gp]) => (gp ? `${gp.text}|${Math.floor(gp.have)}|${gp.need}` : '')).join('#');
    if (gk !== this.goalKey) {
      this.goalKey = gk;
      this.goalEl.innerHTML = tracks
        .map(([head, gp]) => (gp ? `<div class="g-head">${head}</div><div class="g-text">${gp.text}</div><div class="g-bar"><div class="g-fill" style="width:${(gp.have / gp.need) * 100}%"></div></div><div class="g-num">${num(gp.have)} / ${num(gp.need)}</div>` : ''))
        .join('');
    }

    const f = ctx.factory;
    this.factoryEl.classList.toggle('on', f.near || f.running);
    this.factoryFill.style.width = `${f.progress * 100}%`;
    this.factoryFill.classList.toggle('jam', f.jammed);
    const fl = !ctx.state.factoryAuto && lvl('autocrank') > 0 ? 'GNOME FACTORY · AUTO OFF' : 'GNOME FACTORY';
    if (this.factoryLabel.textContent !== fl) this.factoryLabel.textContent = fl;

    // context prompt
    let pr = '';
    const lm = p.lookAt.machine;
    if (lm?.broken) pr = `<b>E</b> repair ${UPGRADE_BY_ID[lm.type].name}`;
    else if (lm && lm.blown > 0 && !p.lookAt.desk) pr = `<b>E</b> replace fuse (${lm.blown}/${fuseCount(lm)} blown)`;
    else if (p.lookAt.switch) pr = `<b>E</b> Auto Crank ${ctx.state.factoryAuto ? 'OFF' : 'ON'}`;
    else if (p.placing) pr = `${p.ghostBlocked ? '<b style="color:#ff5a5a">BLOCKED</b> · ' : ''}<b>LMB</b> place · <b>hold RMB</b> + mouse rotate · <b>R</b> turn · <b>T</b> tilt · <b>V</b> reset · wheel distance · <b>Q</b> cancel`;
    else if (p.held?.crate) pr = `Crate ${p.held.crate.queue.length}/${crateCap()} on the magnet · release <b>LMB</b> drop · <b>RMB</b> throw`;
    else if (p.lookAt.desk) pr = '<b>E</b> open the shop';
    else if (ctx.factory.near) pr = '<b>hold E</b> to make gnomes';
    else if (ctx.props.nearShovel()) pr = '<b>E</b> take the golden shovel';
    else if (p.lookAt.gnome && hands) pr = p.lookAt.gnome.type.id === 'king' ? 'The King is too heavy for any magnet. Use machines!' : `<b>hold LMB</b> magnet ${p.lookAt.gnome.type.name} (${p.lookAt.gnome.tier.id})`;
    else if (p.lookAt.prop && hands) pr = `<b>hold LMB</b> magnet · <b>RMB</b> throw`;
    else if (p.lookAt.machine?.type === 'box') pr = `Crate ${p.lookAt.machine.queue.length}/${crateCap()} · ${hands ? '<b>hold LMB</b> magnet · ' : ''}<b>X</b> pick up`;
    else if (p.lookAt.machine) pr = `<b>G</b> move · <b>X</b> pick up ${UPGRADE_BY_ID[p.lookAt.machine.type].name}`;
    if (this.prompt.innerHTML !== pr) this.prompt.innerHTML = pr;

    if (this.bigT < BIG_T) {
      this.bigT = Math.min(BIG_T, this.bigT + dt);
      const t = this.bigT;
      // pop in from 0 with an overshoot, hold, then fade out drifting up
      const pop = outBack(Math.min(1, t / BIG_POP));
      const out = inQuad(Math.max(0, t - (BIG_T - BIG_FADE)) / BIG_FADE);
      this.big.style.opacity = String(Math.min(1, pop) * (1 - out));
      this.big.style.transform = `translate(-50%, calc(-50% - ${out * 30}px)) scale(${this.bigSize * pop})`;
    }
    if (this.hintT < HINT_T) {
      this.hintT = Math.min(HINT_T, this.hintT + dt);
      // pop in with an overshoot, hold, then sink and fade out
      const pop = outBack(Math.min(1, this.hintT / HINT_POP));
      // written as 1 - time left so the last frame is exactly 1 (opacity exactly 0)
      const out = inQuad(Math.max(0, 1 - (HINT_T - this.hintT) / HINT_FADE));
      this.hintEl.style.opacity = String(outCubic(Math.min(1, this.hintT / HINT_POP)) * (1 - out));
      this.hintEl.style.transform = `translate(-50%, ${out * 20}px) scale(${0.8 + 0.2 * pop})`;
    }
    if (this.pulseT < this.pulseLen) {
      this.pulseT = Math.min(this.pulseLen, this.pulseT + dt);
      const e = 1 - outCubic(this.pulseT / this.pulseLen);
      this.moneyEl.style.transform = `scale(${1 + (0.15 + 0.35 * this.pulseS) * e})`;
      this.moneyEl.style.textShadow = this.pulseS > 0 ? `0 0 ${18 * e}px #ffd23f` : '';
    }

    // speech bubbles follow world positions
    const cam = ctx.camera;
    const w = window.innerWidth;
    const hh = window.innerHeight;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      if (b.t > 2.2) {
        b.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      this.tmp.copy(b.pos).project(cam);
      if (this.tmp.z > 1 || Math.abs(this.tmp.x) > 1.1) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      b.el.style.transform = `translate(${((this.tmp.x + 1) / 2) * w}px, ${((1 - this.tmp.y) / 2) * hh}px) translate(-50%, -100%)`;
    }

    // goal waypoint: a distance marker over the target when on screen, an edge arrow when not
    const tp = ctx.goals.targetPos();
    let mark = false;
    let arrow = false;
    if (tp) {
      const v = this.tmp.set(tp.x, tp.y + 2, tp.z).project(cam);
      if (v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) {
        mark = true;
        const d = Math.round(Math.hypot(tp.x - cam.position.x, tp.z - cam.position.z));
        const txt = `${d} m`;
        if (this.wpMark.textContent !== txt) this.wpMark.textContent = txt;
        this.wpMark.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * hh}px) translate(-50%, -100%)`;
      } else {
        arrow = true;
        let x = v.x;
        let y = v.y;
        if (v.z > 1) {
          // behind the camera the projection mirrors: flip it back and park the arrow on the side to turn to
          x = v.x > 0 ? -1 : 1;
          y = Math.max(-0.5, Math.min(0.5, -v.y));
        }
        const k = 1 / Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82);
        x *= k;
        y *= k;
        this.wpArrow.style.transform = `translate(${((x + 1) / 2) * w}px, ${((1 - y) / 2) * hh}px) translate(-50%, -50%) rotate(${Math.atan2(-y, x)}rad)`;
      }
    }
    this.wpMark.classList.toggle('hidden', !mark);
    this.wpArrow.classList.toggle('hidden', !arrow);

    // Trick Scope at the crosshair: green = the throw ends in the hole, gold = a trick, white = miss
    const sc = lvl('scope');
    const on = sc > 0 && p.aimAlpha > 0;
    const st = !on ? '' : p.aimText ? 'trick' : p.aimInHole ? 'hole' : '';
    if (st !== this.crossState || on !== this.crossOn) {
      this.crossState = st;
      this.crossOn = on;
      this.cross.className = `crosshair ${st}${on ? ' on' : ''}`;
      this.glass.className = `hud-glass ${st}`;
      // easing = outBack, as shop.pop(); a path on the hole edge flips state every few frames, so no restart mid-pop
      if (on && this.crossPop?.playState !== 'running') this.crossPop = this.cross.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 250, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    // Lvl 2+: reflex glass around the crosshair names the trick; Lvl 3 adds the distance and the multiplier
    this.glass.style.opacity = sc >= 2 ? String(p.aimAlpha) : '0';
    this.glass.style.transform = `translate(-50%, -50%) scale(${0.85 + 0.15 * outBack(p.scopeT)})`;
    const read = sc >= 2 && st ? (p.aimText || 'IN THE HOLE') + (sc >= 3 && p.aimInHole ? ` · ${p.aimDist.toFixed(1)} m · x${p.aimMult}` : '') : '';
    if (this.glassRead.textContent !== read) {
      this.glassRead.textContent = read;
      if (read && this.readT >= READ_POP) this.readT = 0;
    }
    this.readT = Math.min(READ_POP, this.readT + dt);
    this.glassRead.style.transform = `scale(${1 + 0.3 * (1 - outBack(this.readT / READ_POP))})`;

    // Trick Scope Lvl 1 label beside the landing ring, faded with the preview (Lvl 2+ shows it in the glass)
    let aim = sc === 1 && p.aimText && p.aimAlpha > 0 ? p.aimText : '';
    if (aim) {
      const v = this.tmp.copy(p.aimPos).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) aim = '';
      else {
        this.aimEl.style.transform = `translate(${((v.x + 1) / 2) * w + 14}px, ${((1 - v.y) / 2) * hh}px) translate(0, -100%)`;
        this.aimEl.style.opacity = String(p.aimAlpha);
      }
    }
    if (this.aimEl.textContent !== aim) this.aimEl.textContent = aim;

    if (loadNotes.length && !ctx.paused) for (const t of loadNotes.splice(0)) this.toast(t, 'good');

    if (ctx.input.hit('KeyH') && !ctx.paused) this.helpManual = this.helpEl.classList.contains('hidden');
    this.helpEl.classList.toggle('hidden', !(this.helpManual ?? s.stats.playTime < 20));
  }
}
