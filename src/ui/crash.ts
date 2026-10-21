// Shows runtime errors on screen and keeps the last 5 in localStorage and sends them to logs/errors.log on the dev machine
// and, in the online build, to the Supabase `errors` table, so a crash on a playtest build or on GitHub Pages leaves a trace.
import { ctx } from '../core/context';
import { online, restCall } from './leaderboard';

const KEY = 'gnome-boozed-errors';
// in the release build this is assets/index-<hash>.js, which names the build; on GitHub Pages also @<commit>
const commit = String(import.meta.env.VITE_COMMIT ?? '');
export const BUILD = new URL(import.meta.url).pathname + (commit ? '@' + commit.slice(0, 7) : '');

const MSG_MAX = 1000;
const STACK_MAX = 3000;
const UA_MAX = 300;
const ROWS_MAX = 20; // rows per page load, the same as the beacon
const NOTES_MAX = 10; // measurement notes inside ROWS_MAX, so real errors always keep at least 10 rows
const WINDOW_MS = 3000; // repeats of one message within this window go into its count

type Source = 'error' | 'unhandledrejection' | 'webglcontextlost' | 'note';
type Row = { session: string; build: string; source: Source; message: string; stack: string; ua: string; level: number | null; land: number | null; count: number };

let box: HTMLDivElement | null = null;
let more = 0;
let sent = 0;
let sink: ((row: Row) => void) | null = null;
let session = '';
const seen = new Set<string>();
const pending = new Map<string, { row: Row; timer: number }>();
let notes = 0;

// Fire-and-forget to the dev/preview server (vite.config.ts). On GitHub Pages the endpoint is missing: the beacon just fails, no event;
// there the Supabase table (installErrorSink) takes the error instead.
function send(message: string, stack: string, url: string): void {
  if (sent >= 20) return;
  sent++;
  try {
    navigator.sendBeacon(`${import.meta.env.BASE_URL}__errors`, JSON.stringify({ message, stack: stack.slice(0, 8000), url, build: BUILD }));
  } catch {
    // a failed send must never become a new reported error
  }
}

// Online build only: POSTs each distinct message once per page load to public.errors (supabase/errors.sql).
export function installErrorSink(url: string, key: string): void {
  try {
    session = crypto.randomUUID();
    // keepalive on every row: a reload right after the 3 s window must not cancel the POST (one row is far below the 64 KB budget)
    sink = (row) => {
      restCall(url, key, 'errors', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row), keepalive: true }).catch(() => {});
    };
    window.addEventListener('pagehide', flushAll);
  } catch {
    // no secure context or no crypto: the box and the beacon still work
  }
}

function flush(message: string): void {
  const p = pending.get(message);
  if (!p) return;
  pending.delete(message);
  clearTimeout(p.timer);
  sink?.(p.row);
}

// the page is going away: send what waits in its window now (keepalive survives the unload)
function flushAll(): void {
  for (const m of [...pending.keys()]) flush(m);
}

function queue(source: Source, message: string, stack: string): void {
  try {
    if (!sink) return;
    const p = pending.get(message);
    if (p) {
      p.row.count++;
      return;
    }
    if (seen.has(message) || seen.size >= ROWS_MAX || (source === 'note' && notes >= NOTES_MAX)) return;
    if (source === 'note') notes++;
    seen.add(message);
    const state = (ctx as Partial<typeof ctx>).state;
    const row: Row = {
      session,
      build: BUILD,
      source,
      message: message.slice(0, MSG_MAX),
      stack: stack.slice(0, STACK_MAX),
      ua: navigator.userAgent.slice(0, UA_MAX),
      level: state?.holeLevel ?? null,
      land: state?.land ?? null,
      count: 1,
    };
    pending.set(message, { row, timer: window.setTimeout(() => flush(message), WINDOW_MS) });
  } catch {
    // the error table must never raise a new error
  }
}

// A measurement line: logs/errors.log on the dev machine, the error table in the online build, the browser console everywhere;
// no box on screen.
export function note(message: string): void {
  queue('note', message, '');
  send(message, '', location.href);
  console.info(`[gnome] ${message}`);
}

function report(source: Source, message: string, stack = ''): void {
  queue(source, message, stack);
  const entry = { message, stack, time: new Date().toISOString(), url: location.href };
  send(message.slice(0, 2000), stack, entry.url);
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-5)));
  } catch {
    // storage full, blocked or holding junk: the box still shows
  }
  if (box) {
    more++;
    box.querySelector('.crash-more')!.textContent = `+${more} more`;
    return;
  }
  const full = `${message}\n${stack}\nbuild: ${BUILD}\ntime: ${entry.time}\nurl: ${entry.url}`;
  box = document.createElement('div');
  box.className = 'crash';
  box.innerHTML = '<div class="crash-head"><b>The game hit an error</b><span class="crash-more"></span><button class="crash-copy">Copy</button><button class="crash-close">×</button></div><pre></pre>';
  const pre = box.querySelector('pre')!;
  pre.textContent = `${message}\n${stack.split('\n').slice(0, 8).join('\n')}\nbuild: ${BUILD}\ntime: ${entry.time}`;
  box.querySelector('.crash-copy')!.addEventListener('click', () => {
    const select = () => {
      pre.textContent = full;
      getSelection()?.selectAllChildren(pre);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(full).catch(select);
    else select();
  });
  box.querySelector('.crash-close')!.addEventListener('click', () => box!.classList.add('hidden'));
  document.body.appendChild(box);
}

export function installCrashReport(): void {
  window.addEventListener('error', (e) => report('error', e.message || String(e.error), e.error?.stack ?? ''));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    report('unhandledrejection', r instanceof Error ? r.message : `Unhandled rejection: ${String(r)}`, r instanceof Error ? (r.stack ?? '') : '');
  });
  if (online) installErrorSink(online.url, online.key);
}

export function watchCanvas(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('webglcontextlost', () => report('webglcontextlost', 'The graphics context was lost (WebGL context lost). Reload the page.'));
}
