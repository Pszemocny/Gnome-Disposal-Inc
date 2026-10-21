import { ctx } from '../core/context';
import { clock, money } from '../core/format';
import { MAX_HOLE_LEVEL } from '../data/holeLevels';
import { daily } from '../systems/daily';

const KEY = 'gnome-boozed-leaderboard';
const KEEP = 50; // entries kept in storage
const SHOW = 10; // rows on the board
const MAX_NAME = 20; // PP 2026-10-24: a first name or nickname, at most 20 characters
// letters of any alphabet (Polish diacritics too), digits, spaces, . _ - '; at least one letter or digit
const NAME = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} ._'’-]+$/u;
const SPEED = 'speed'; // FASTEST LVL 12: score = runTime in seconds, lower is better
// this run's level-12 time, or null when the run has none or its clock started before the update (runTimeUnknown)
const runLvl12 = (): number | null => (ctx.state.runTimeUnknown ? null : ctx.state.maxLevelAt);
const COMBO = 'combo'; // BIGGEST COMBO: score = the highest combo in this run, higher is better

export interface Entry {
  name: string; // a first name or nickname, never a full official name (PP 2026-10-24)
  score: number; // money earned in the run (state.totalEarned); seconds to hole level 12 on the speed board; the run's best combo on the combo board
  level: number; // hole level
  at: number; // Date.now() locally, created_at online
  board?: string; // 'main' (missing in old entries), 'speed', 'combo' or 'daily-YYYY-MM-DD'
}

// swap point for a shared board (PP's decision: BOARD "Pytania do PP na rano", question 1)
export interface LeaderboardStore {
  list(board?: string): Promise<Entry[]>; // best first, one board (default 'main')
  submit(e: Entry): Promise<void>;
  readonly warning?: string | null; // set by the online store after each call
}

const W_DOWN = 'Online board unreachable: showing scores saved on this computer.';
const W_SEND = 'Could not reach the online board: score saved on this computer only.';
const W_REJECT = 'The online board rejected this score: saved on this computer only.';
// a resend after this may store a second row: accepted, honest double submits are allowed
const W_MAYBE = 'The online board did not answer in time: the score is saved on this computer and might have reached the online board too.';
const W_CLOCK = "The online board rejected this score: check your computer's date and time. Saved on this computer only.";
const W_TIME = 'Your time was not saved online.'; // the money row went through, only the FASTEST row failed
const W_COMBO = 'Your combo was not saved online.'; // the same for the BIGGEST COMBO row
const TIMEOUT_MS = 6000;
const COLS = 'name,score,level,board,created_at';

const isEntry = (e: Entry) => !!e && typeof e.name === 'string' && Number.isFinite(e.score) && Number.isFinite(e.level) && Number.isFinite(e.at);
const boardOf = (e: Entry) => e.board ?? 'main';
const rank = (e: Entry) => (boardOf(e) === SPEED ? e.score : -e.score);
const byRank = (a: Entry, b: Entry) => rank(a) - rank(b);
// entries saved before 2026-10-24 have first and last instead of name: shown as typed, rewritten on the next submit
const legacy = (e: Entry & { first?: unknown; last?: unknown }): Entry => {
  if (!e || e.name !== undefined || typeof e.first !== 'string') return e;
  const { first, last, ...rest } = e;
  return { ...rest, name: [first, last].filter(Boolean).join(' ') };
};
const DAILY_BOARDS = 7; // daily boards kept: the newest dates
const HOME = daily.active ? daily.board : 'main'; // this page's board

export class LocalStore implements LeaderboardStore {
  private all(): Entry[] {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(v)) return v.map(legacy).filter(isEntry).sort(byRank);
    } catch {
      // a broken entry reads as an empty board
    }
    return [];
  }

  async list(board = 'main'): Promise<Entry[]> {
    return this.all().filter((e) => boardOf(e) === board);
  }

  async submit(e: Entry): Promise<void> {
    const all = [...this.all(), e].sort(byRank);
    // 'daily-YYYY-MM-DD' sorts by date
    const daily = [...new Set(all.map(boardOf).filter((b) => b.startsWith('daily-')))].sort().reverse();
    const keep = new Set(['main', SPEED, COMBO, ...daily.slice(0, DAILY_BOARDS)]);
    const count = new Map<string, number>();
    const kept = all.filter((x) => {
      const b = boardOf(x);
      const n = count.get(b) ?? 0;
      count.set(b, n + 1);
      return keep.has(b) && n < KEEP;
    });
    localStorage.setItem(KEY, JSON.stringify(kept));
  }
}

// 'anon' only for the publishable key or an anon JWT: a service_role key in the bundle would open the whole database
export function keyRole(key: string): 'anon' | null {
  if (key.startsWith('sb_publishable_')) return 'anon';
  try {
    return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon' ? 'anon' : null;
  } catch {
    return null;
  }
}

// hex HMAC-SHA256 over `<score as IEEE-754 hex>|<board>|<UTC date>`; the database trigger recomputes it (supabase/leaderboard.sql)
export async function scoreKey(salt: string, score: number, board: string, date: string): Promise<string> {
  const raw = new DataView(new ArrayBuffer(8));
  raw.setFloat64(0, score); // big-endian, the same bytes as Postgres float8send()
  const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(`${hex(raw.buffer)}|${board}|${date}`)));
}

// one Supabase REST call; also used by the error table (crash.ts)
export async function restCall(url: string, key: string, path: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status, body: await r.text().catch(() => '') });
  return r;
}

// shared board over Supabase REST; every score is written locally first, so the network can only add, never lose one
export class RemoteStore implements LeaderboardStore {
  warning: string | null = null;
  private local = new LocalStore();

  constructor(
    private url: string,
    private key: string,
    private salt: string,
  ) {}

  private call(path: string, init: RequestInit = {}): Promise<Response> {
    return restCall(this.url, this.key, path, init);
  }

  async list(board = 'main'): Promise<Entry[]> {
    try {
      const order = board === SPEED ? 'asc' : 'desc';
      const r = await this.call(`scores?select=${COLS}&board=eq.${encodeURIComponent(board)}&order=score.${order}&limit=${SHOW}`);
      const rows: Record<string, unknown>[] = await r.json();
      this.warning = null;
      return rows
        .map((x) => ({ name: x.name, score: x.score, level: x.level, board: x.board, at: Date.parse(String(x.created_at)) }) as Entry)
        .filter(isEntry);
    } catch {
      this.warning = W_DOWN;
      return this.local.list(board);
    }
  }

  async submit(e: Entry): Promise<void> {
    await this.local.submit(e);
    const board = boardOf(e);
    try {
      const key = await scoreKey(this.salt, e.score, board, new Date().toISOString().slice(0, 10));
      const body = { name: e.name, score: e.score, level: e.level, board, key };
      await this.call('scores', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
      this.warning = null;
    } catch (err) {
      const { status, body = '' } = err as { status?: number; body?: string };
      // both checks use the browser clock (key date, daily board name)
      if ((err as Error).name === 'TimeoutError') this.warning = W_MAYBE;
      else if (status === 400 && /bad key|daily board must be today or yesterday/.test(body)) this.warning = W_CLOCK;
      else this.warning = status !== undefined && status < 500 ? W_REJECT : W_SEND;
    }
  }
}

// online only in a production build with all three variables and the publishable key; the dev server never goes online
export const online: { url: string; key: string; salt: string } | null = (() => {
  const { DEV, VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key, VITE_SUPABASE_SALT: salt } = import.meta.env;
  if (DEV || !url || !key || !salt) return null;
  if (keyRole(String(key)) !== 'anon') {
    console.warn('VITE_SUPABASE_KEY is not the publishable key: online board off');
    return null;
  }
  return { url: String(url).replace(/\/$/, ''), key: String(key), salt: String(salt) };
})();

export function pickStore(): LeaderboardStore {
  return online ? new RemoteStore(online.url, online.key, online.salt) : new LocalStore();
}

// null when the name is fine, otherwise the message for the player
export function nameError(label: string, name: string): string | null {
  if (/[<>]/.test(name)) return `${label}: no HTML, please.`;
  if (name.length < 1 || name.length > MAX_NAME) return `${label}: 1-${MAX_NAME} characters.`;
  if (!NAME.test(name)) return `${label}: letters, digits, spaces, . _ - ' only.`;
  return null;
}

const CSS = `
.leaderboard { z-index: 60; }
.leaderboard .shop-win { width: min(620px, 94vw); }
.leaderboard .row { grid-template-columns: 1fr 110px 70px 110px; }
.leaderboard .lb-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 18px; border-top: 2px solid #3a3f46; }
.leaderboard .lb-run { width: 100%; opacity: .8; }
.leaderboard input { flex: 1; min-width: 120px; font: 16px var(--font); padding: 8px 10px; border-radius: 4px; border: 2px solid #4a5058; background: #1b1e22; color: #fff; }
.leaderboard .lb-msg { min-height: 20px; padding: 0 18px 8px; color: var(--bad); }
.leaderboard .lb-msg.ok { color: var(--accent); }
`;

export class Leaderboard {
  isOpen = false;
  private el: HTMLDivElement;
  private title: HTMLElement;
  private rows: HTMLElement;
  private run: HTMLElement;
  private msg: HTMLElement;
  private name: HTMLInputElement;
  private form: HTMLElement;
  private done: (() => void) | null = null; // set by offer(): the rebirth waits for submit or skip
  private tabs: HTMLElement;
  private board = 'main'; // where a submit goes
  private tab = 'main'; // which board the rows show
  private sending = false; // a POST is in flight: no second submit, no close
  private renderN = 0; // drops a slow reply for a tab the player already left
  private submitBtn: HTMLButtonElement;

  constructor(readonly store: LeaderboardStore = pickStore()) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'shop leaderboard hidden';
    // static markup only; user text goes in through textContent
    this.el.innerHTML = `<div class="shop-win">
      <div class="shop-head"><span class="lb-title"></span><button class="x" data-close>✕</button></div>
      <div class="shop-tabs"><button class="tab" type="button" data-tab="main">MOST MONEY</button><button class="tab" type="button" data-tab="${daily.board}">DAILY ${daily.date}</button><button class="tab" type="button" data-tab="${SPEED}">FASTEST LVL 12</button><button class="tab" type="button" data-tab="${COMBO}">BIGGEST COMBO</button></div>
      <div class="shop-rows lb-rows"></div>
      <form class="lb-form">
        <div class="lb-run"></div>
        <input name="name" placeholder="Name or nickname" autocomplete="off" maxlength="${MAX_NAME}">
        <button class="buy" type="submit">SUBMIT</button>
        <button class="buy poor" type="button" data-close>SKIP</button>
      </form>
      <div class="lb-msg"></div>
      <div class="shop-foot">Score = money earned this run, spent or not. FASTEST = time to hole level 12. COMBO = the biggest combo this run. Esc closes.</div>
    </div>`;
    document.body.appendChild(this.el);
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    this.title = q('.lb-title');
    this.rows = q('.lb-rows');
    this.run = q('.lb-run');
    this.msg = q('.lb-msg');
    this.name = q<HTMLInputElement>('input[name="name"]');
    this.form = q('.lb-form');
    this.tabs = q('.shop-tabs');
    this.submitBtn = q<HTMLButtonElement>('button[type="submit"]');
    if (store instanceof RemoteStore)
      q('.shop-foot').textContent = 'Score = money earned this run, spent or not. FASTEST = time to hole level 12. COMBO = the biggest combo this run. Your name or nickname is shown publicly online. Esc closes.';
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-close]')) this.close();
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab;
      if (tab) {
        this.tab = tab;
        void this.render();
      }
    });
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send();
    });
    // capture: while open, no key reaches the game (typing "M" in a name must not mute it); Esc closes
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.isOpen) return;
        e.stopPropagation();
        if (e.code !== 'Escape') return;
        e.preventDefault();
        this.close();
      },
      true,
    );
    // the pause menu redraws its card on every show: add the button each time
    const menu = document.querySelector('.menu');
    if (menu) new MutationObserver(() => this.addMenuButton(menu)).observe(menu, { childList: true });
  }

  private addMenuButton(menu: Element): void {
    const row = menu.querySelector('.menu-card:not(.title) .row-btns');
    if (!row || row.querySelector('[data-lb]')) return;
    const b = document.createElement('button');
    b.className = 'btn';
    b.dataset.lb = '';
    b.textContent = 'Leaderboard';
    b.addEventListener('click', () => this.open());
    row.appendChild(b);
  }

  // the pause menu shows the boards only: a score is entered only after jumping into the hole (PP 2026-10-24)
  open(): void {
    this.show('LEADERBOARD', false);
  }

  // at rebirth: submit or skip, then done() runs (the score is read before the run resets)
  // also at the end of a daily run: one board per mode, so a daily rebirth goes to the daily board too
  offer(done: () => void, board = HOME, title = 'SUBMIT YOUR RUN'): void {
    this.done = done;
    this.show(title, true, board);
  }

  private show(title: string, form: boolean, board = HOME): void {
    const s = ctx.state;
    this.isOpen = true;
    this.board = this.tab = board;
    this.title.textContent = title;
    this.form.classList.toggle('hidden', !form);
    const t = runLvl12();
    this.run.textContent = `Your run: ${money(s.totalEarned)} · Hole lvl ${s.holeLevel}` + (t !== null ? ` · Lvl 12 in ${clock(t)}` : '');
    this.msg.textContent = '';
    this.el.classList.remove('hidden');
    void this.render();
    if (form) this.name.focus();
  }

  close(): void {
    // while sending, ✕/SKIP/Esc wait: on the daily path done() leaves the page and would abort the POST
    if (!this.isOpen || this.sending) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    const done = this.done;
    this.done = null;
    done?.();
  }

  private async send(): Promise<void> {
    if (this.sending) return;
    const name = this.name.value.trim().normalize('NFC');
    const err = nameError('Name', name);
    this.msg.classList.toggle('ok', !err);
    if (err) {
      this.msg.textContent = err;
      return ctx.audio.deny();
    }
    this.sending = true;
    this.submitBtn.disabled = true;
    this.msg.textContent = 'Sending…';
    const s = ctx.state;
    const at = Date.now();
    let w: string | null;
    try {
      await this.store.submit({ name, score: s.totalEarned, level: s.holeLevel, at, board: this.board });
      w = this.store.warning ?? null;
      // every main-board run that reached level 12 posts its time with this submit (PP 2026-10-24: "za każdym razem gdy wskoczysz")
      // main board only, like the combo row: a daily run goes to the daily board alone
      const t = runLvl12();
      if (t !== null && this.board === 'main') {
        await this.store.submit({ name, score: t, level: MAX_HOLE_LEVEL, at, board: SPEED });
        if (this.store.warning) w ??= W_TIME;
      }
      // main board only: a daily run goes to the daily board alone; a run without a combo has nothing to post
      if (this.board === 'main' && s.runMaxCombo > 0) {
        // the database takes whole numbers up to 100 000 (scores_combo_check); an endless machine combo posts the cap
        await this.store.submit({ name, score: Math.min(s.runMaxCombo, 100000), level: s.holeLevel, at, board: COMBO });
        if (this.store.warning) w ??= W_COMBO;
      }
    } finally {
      this.sending = false;
      this.submitBtn.disabled = false;
    }
    // the form is shown only by offer(): the board closes after the submit and done() runs
    if (w) {
      ctx.audio.deny();
      ctx.hud.toast(w, 'bad');
    } else ctx.audio.buy();
    this.close();
  }

  private async render(): Promise<void> {
    for (const b of this.tabs.querySelectorAll<HTMLElement>('[data-tab]')) b.classList.toggle('on', b.dataset.tab === this.tab);
    const n = ++this.renderN;
    this.rows.textContent = 'Loading…';
    const top = (await this.store.list(this.tab)).slice(0, SHOW);
    if (n !== this.renderN) return;
    if (this.store.warning) {
      this.msg.classList.remove('ok');
      this.msg.textContent = this.store.warning;
    } else if (this.msg.textContent === W_DOWN) this.msg.textContent = '';
    if (!top.length) {
      this.rows.textContent = 'No scores yet.';
      return;
    }
    this.rows.replaceChildren(
      ...top.map((e, i) => {
        const row = document.createElement('div');
        row.className = 'row';
        const b = boardOf(e);
        const score = b === SPEED ? clock(e.score) : b === COMBO ? `${e.score} COMBO` : money(e.score);
        for (const text of [`${i + 1}. ${e.name}`, score, `Lvl ${e.level}`, new Date(e.at).toLocaleDateString()]) {
          row.appendChild(document.createElement('span')).textContent = text;
        }
        return row;
      }),
    );
  }
}
