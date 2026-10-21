// Gameplay progress log (online build only): one row per hole level-up and one at the end of a run in public.progress
// (supabase/progress.sql), with the purchases and achievements since the previous row. Rows wait in localStorage until sent.
import { ctx } from '../core/context';
import { daily } from './daily';
import { online, restCall } from '../ui/leaderboard';
import { BUILD } from '../ui/crash';

const KEY = 'gnome-boozed-player';
const QUEUE_MAX = 30;
const BUY_MAX = 120; // the last entry counts the dropped ones: { id: 'more', lvl: 0, cost: n }
const UA_MAX = 300;

type Kind = 'level' | 'rebirth' | 'daily' | 'reset';
type Buy = { id: string; lvl: number; cost: number };
type Ach = { id: string; run_time: number; level: number };
type Buffers = { buy: Buy[]; ach: Ach[] };
type Row = {
  rid: string;
  player: string;
  name: string | null;
  seq: number;
  kind: Kind;
  daily: boolean;
  level: number;
  run: number;
  run_time: number;
  play_time: number;
  money: number;
  earned: number;
  gnomes: number;
  gnomes_total: number;
  land: number;
  purchases: Buy[];
  achievements: Ach[];
  build: string;
  ua: string;
};
type Store = Buffers & { id: string; name: string | null; seq: number; queue: Row[] };

let sink: ((row: Row, keepalive: boolean) => Promise<unknown>) | null = null;
let mem: Store | null = null; // set when localStorage cannot be written: this page load only
let sending = false;
let ended = false; // one end row per page load (the daily end and its "Back to your yard" share the page)
// a daily run never saves and every page load is a new one: its buffers live in memory, so yard purchases never mix in
const dailyBuf: Buffers = { buy: [], ach: [] };

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v : []);

function load(): Store {
  if (mem) return mem;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.id === 'string' && /^[0-9a-f-]{36}$/.test(v.id)) {
      return { id: v.id, name: typeof v.name === 'string' ? v.name : null, seq: Number(v.seq) || 0, buy: list(v.buy), ach: list(v.ach), queue: list(v.queue) };
    }
  } catch {
    // junk or blocked storage reads as a new player
  }
  return { id: crypto.randomUUID(), name: null, seq: 0, buy: [], ach: [], queue: [] };
}

// read, change, write in one synchronous step: a second tab's queue and buffers are re-read, not overwritten
function edit(fn: (p: Store) => void): Store {
  const p = load();
  fn(p);
  if (!mem) {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      mem = p;
    }
  }
  return p;
}

function remember(fn: (b: Buffers) => void): void {
  if (daily.active) fn(dailyBuf);
  else edit(fn);
}

// true: the row is done (sent, or refused for good); false: keep it for the next try
async function send(row: Row, keepalive: boolean): Promise<boolean> {
  try {
    await sink!(row, keepalive);
  } catch (e) {
    const status = (e as { status?: number }).status;
    // network, timeout, 5xx and a missing table (404) keep the row; other 4xx (cap, check, 409 = this rid already arrived) drop it
    if (status === undefined || status >= 500 || status === 404) return false;
  }
  edit((p) => (p.queue = p.queue.filter((r) => r.rid !== row.rid)));
  return true;
}

async function flush(): Promise<void> {
  if (sending || !sink) return;
  sending = true;
  try {
    for (let row = load().queue[0]; row && (await send(row, false)); row = load().queue[0]);
  } catch {
    // the log must never raise
  } finally {
    sending = false;
  }
}

function push(kind: Kind, keepalive: boolean): void {
  try {
    if (!sink) return;
    const s = ctx.state;
    let row: Row | undefined;
    edit((p) => {
      const b = daily.active ? dailyBuf : p;
      row = {
        rid: crypto.randomUUID(),
        player: p.id,
        name: p.name,
        seq: ++p.seq,
        kind,
        daily: daily.active,
        level: s.holeLevel,
        run: s.stats.rebirths,
        run_time: Math.round(s.runTime),
        play_time: Math.round(s.stats.playTime),
        money: s.money,
        earned: s.totalEarned,
        gnomes: s.stats.gnomesEaten - (s.runEatenStart ?? 0),
        gnomes_total: s.stats.gnomesEaten,
        land: s.land,
        purchases: b.buy,
        achievements: b.ach,
        build: BUILD,
        ua: navigator.userAgent.slice(0, UA_MAX),
      };
      b.buy = [];
      b.ach = [];
      p.queue = [...p.queue, row].slice(-QUEUE_MAX);
    });
    // an end row leaves the page right after: send it at once with keepalive; a copy sent again at the next boot gets 409
    if (keepalive && row) void send(row, true).catch(() => {});
    else void flush();
  } catch {
    // the log must never raise
  }
}

export function installProgressSink(url: string, key: string): void {
  try {
    if (typeof crypto.randomUUID !== 'function') return; // plain http / old browser: no log
    sink = (row, keepalive) =>
      restCall(url, key, 'progress', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row), keepalive });
    void flush();
  } catch {
    // no log
  }
}

// main.ts after the leaderboard: `online` is read here, never at module top (leaderboard.ts imports this module)
export function init(): void {
  if (online) installProgressSink(online.url, online.key);
}

export function bought(id: string, lvl: number, cost: number): void {
  try {
    if (!sink) return;
    remember((b) => {
      if (b.buy.length < BUY_MAX - 1) b.buy.push({ id, lvl, cost });
      else if (b.buy[b.buy.length - 1].id === 'more') b.buy[b.buy.length - 1].cost++;
      else b.buy.push({ id: 'more', lvl: 0, cost: 1 });
    });
  } catch {
    // the log must never raise
  }
}

export function achieved(id: string): void {
  try {
    if (!sink) return;
    const s = ctx.state;
    remember((b) => b.ach.push({ id, run_time: Math.round(s.runTime), level: s.holeLevel }));
  } catch {
    // the log must never raise
  }
}

// "Reset save" deletes everything: after the reset end row is queued, the player gets a new id and no nickname
export function forget(): void {
  try {
    edit((p) => {
      p.id = crypto.randomUUID();
      p.name = null;
      p.seq = 0;
      p.buy = [];
      p.ach = [];
    });
  } catch {
    // the log must never raise
  }
}

export function setName(name: string): void {
  try {
    if (sink) edit((p) => (p.name = name));
  } catch {
    // the log must never raise
  }
}

export function level(): void {
  push('level', false);
}

export function end(kind: Exclude<Kind, 'level'>): void {
  if (ended) return;
  ended = true;
  push(kind, true);
}
