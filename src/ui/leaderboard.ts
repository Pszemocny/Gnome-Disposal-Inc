import { ctx } from '../core/context';
import { money } from '../core/format';
import { daily } from '../systems/daily';

const KEY = 'gnome-boozed-leaderboard';
const KEEP = 50; // entries kept in storage
const SHOW = 10; // rows on the board
const MAX_NAME = 24;
// letters of any alphabet (Polish diacritics too), spaces, hyphen, apostrophe; at least one letter
const NAME = /^(?=.*\p{L})[\p{L}\p{M} '’-]+$/u;

export interface Entry {
  first: string;
  last: string;
  score: number; // money earned in the run (state.totalEarned)
  level: number; // hole level
  at: number; // Date.now() locally, created_at online
  board?: string; // 'main' (missing in old entries) or 'daily-YYYY-MM-DD'
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
const TIMEOUT_MS = 6000;
const COLS = 'first_name,last_name,score,level,board,created_at';

const byScore = (a: Entry, b: Entry) => b.score - a.score;
const isEntry = (e: Entry) =>
  !!e && typeof e.first === 'string' && typeof e.last === 'string' && Number.isFinite(e.score) && Number.isFinite(e.level) && Number.isFinite(e.at);
const boardOf = (e: Entry) => e.board ?? 'main';
const DAILY_BOARDS = 7; // daily boards kept: the newest dates
const HOME = daily.active ? daily.board : 'main'; // this page's board

export class LocalStore implements LeaderboardStore {
  private all(): Entry[] {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(v)) return v.filter(isEntry).sort(byScore);
    } catch {
      // a broken entry reads as an empty board
    }
    return [];
  }

  async list(board = 'main'): Promise<Entry[]> {
    return this.all().filter((e) => boardOf(e) === board);
  }

  async submit(e: Entry): Promise<void> {
    const all = [...this.all(), e].sort(byScore);
    // 'daily-YYYY-MM-DD' sorts by date
    const daily = [...new Set(all.map(boardOf).filter((b) => b.startsWith('daily-')))].sort().reverse();
    const keep = new Set(['main', ...daily.slice(0, DAILY_BOARDS)]);
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
      const r = await this.call(`scores?select=${COLS}&board=eq.${encodeURIComponent(board)}&order=score.desc&limit=${SHOW}`);
      const rows: Record<string, unknown>[] = await r.json();
      this.warning = null;
      return rows
        .map((x) => ({ first: x.first_name, last: x.last_name, score: x.score, level: x.level, board: x.board, at: Date.parse(String(x.created_at)) }) as Entry)
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
      const body = { first_name: e.first, last_name: e.last, score: e.score, level: e.level, board, key };
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
  if (!NAME.test(name)) return `${label}: letters, spaces, - and ' only.`;
  return null;
}

const CSS = `
.leaderboard { z-index: 60; }
.leaderboard .shop-win { width: min(620px, 94vw); }
.leaderboard .row { grid-template-columns: 1fr 110px 70px 110px; }
.leaderboard .lb-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 18px; border-top: 2px solid #3a3f46; }
.leaderboard .lb-run { width: 100%; opacity: .8; }
.leaderboard input { flex: 1; min-width: 120px; font: 16px var(--font); padding: 8px 10px; border-radius: 4px; border: 2px solid #4a5058; background: #1b1e22; color: #fff; }
.leaderboard .lb-msg { width: 100%; min-height: 20px; color: var(--bad); }
.leaderboard .lb-msg.ok { color: var(--accent); }
`;

export class Leaderboard {
  isOpen = false;
  private el: HTMLDivElement;
  private title: HTMLElement;
  private rows: HTMLElement;
  private run: HTMLElement;
  private msg: HTMLElement;
  private first: HTMLInputElement;
  private last: HTMLInputElement;
  private skip: HTMLElement;
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
      <div class="shop-tabs"><button class="tab" type="button" data-tab="main">ALL-TIME</button><button class="tab" type="button" data-tab="${daily.board}">DAILY ${daily.date}</button></div>
      <div class="shop-rows lb-rows"></div>
      <form class="lb-form">
        <div class="lb-run"></div>
        <input name="first" placeholder="First name" autocomplete="off">
        <input name="last" placeholder="Last name" autocomplete="off">
        <button class="buy" type="submit">SUBMIT</button>
        <button class="buy poor" type="button" data-close data-skip>SKIP</button>
        <div class="lb-msg"></div>
      </form>
      <div class="shop-foot">Score = money earned this run. Esc closes.</div>
    </div>`;
    document.body.appendChild(this.el);
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    this.title = q('.lb-title');
    this.rows = q('.lb-rows');
    this.run = q('.lb-run');
    this.msg = q('.lb-msg');
    this.first = q<HTMLInputElement>('input[name="first"]');
    this.last = q<HTMLInputElement>('input[name="last"]');
    this.skip = q('[data-skip]');
    this.tabs = q('.shop-tabs');
    this.submitBtn = q<HTMLButtonElement>('button[type="submit"]');
    if (store instanceof RemoteStore) q('.shop-foot').textContent = 'Score = money earned this run. Names are shown publicly online. Esc closes.';
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-close]')) this.close();
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab;
      if (tab) {
        this.tab = tab;
        void this.render();
      }
    });
    q('.lb-form').addEventListener('submit', (e) => {
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

  open(): void {
    this.show('LEADERBOARD', false);
  }

  // at rebirth: submit or skip, then done() runs (the score is read before the run resets)
  // also at the end of a daily run: one board per mode, so a daily rebirth goes to the daily board too
  offer(done: () => void, board = HOME, title = 'SUBMIT YOUR RUN'): void {
    this.done = done;
    this.show(title, true, board);
  }

  private show(title: string, skip: boolean, board = HOME): void {
    this.isOpen = true;
    this.board = this.tab = board;
    this.title.textContent = title;
    this.skip.classList.toggle('hidden', !skip);
    this.run.textContent = `Your run: ${money(ctx.state.totalEarned)} · Hole lvl ${ctx.state.holeLevel}`;
    this.msg.textContent = '';
    this.el.classList.remove('hidden');
    void this.render();
    this.first.focus();
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
    const first = this.first.value.trim().normalize('NFC');
    const last = this.last.value.trim().normalize('NFC');
    const err = nameError('First name', first) ?? nameError('Last name', last);
    this.msg.classList.toggle('ok', !err);
    if (err) {
      this.msg.textContent = err;
      return ctx.audio.deny();
    }
    this.sending = true;
    this.submitBtn.disabled = true;
    this.msg.textContent = 'Sending…';
    try {
      await this.store.submit({ first, last, score: ctx.state.totalEarned, level: ctx.state.holeLevel, at: Date.now(), board: this.board });
    } finally {
      this.sending = false;
      this.submitBtn.disabled = false;
    }
    // read before render(): the re-fetch GET overwrites the store's warning
    const w = this.store.warning ?? null;
    if (w) ctx.audio.deny();
    else ctx.audio.buy();
    if (this.done) {
      if (w) ctx.hud.toast(w, 'bad');
      return this.close();
    }
    this.tab = this.board;
    await this.render();
    this.msg.classList.toggle('ok', !w && !this.store.warning);
    if (w) this.msg.textContent = w;
    else if (!this.store.warning) this.msg.textContent = 'Score saved.';
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
        for (const text of [`${i + 1}. ${e.first} ${e.last}`, money(e.score), `Lvl ${e.level}`, new Date(e.at).toLocaleDateString()]) {
          row.appendChild(document.createElement('span')).textContent = text;
        }
        return row;
      }),
    );
  }
}
