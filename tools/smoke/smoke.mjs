// Headless smoke test over Chrome DevTools Protocol, against the dev server on 5199 (never 5300).
// Usage: node tools/smoke/smoke.mjs <outDir> <scenarioFile>
// Env: FAKELOCK=1 pointer lock emulated in the page on the headless shell (use this for lock scenarios),
// FULL=1 full Chromium in --headless=new with a real lock (it grabs and moves the real macOS cursor: not while PP works),
// DPR=<n> device scale factor, CDP_PORT, DEV_PORT (dev server, default 5199), MAXPOLL (polls of 250 ms), SW=1 software GL,
// URL_QUERY (default '?lowfx').
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';

const OUT = process.argv[2];
const SCENARIO = readFileSync(process.argv[3], 'utf8');
mkdirSync(OUT, { recursive: true });
const BIN = process.env.FULL
  ? process.env.HOME + '/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  : process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const PORT = Number(process.env.CDP_PORT ?? 9333);
// GPU (Metal) by default: 60 fps instead of about 7 with software rendering; SW=1 falls back to SwiftShader
const GL = process.env.SW ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const chrome = spawn(BIN, [...(process.env.FULL ? ['--headless=new'] : []), `--remote-debugging-port=${PORT}`, ...GL, '--window-size=640,360', '--no-first-run', `--user-data-dir=${OUT}/profile`, 'about:blank'], { stdio: 'ignore' });
// never leave Chromium or its 40 MB profile behind, also when the run is interrupted or times out
const cleanup = () => {
  try { chrome.kill('SIGKILL'); } catch {}
  try { rmSync(`${OUT}/profile`, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(1));
process.on('uncaughtException', (e) => { console.error(e); process.exit(1); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pages;
for (let i = 0; i < 50; i++) {
  try {
    pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (pages.length) break;
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    logs.push('EXCEPTION: ' + (d.exception?.description || d.text));
  } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'log'].includes(msg.params.type)) {
    logs.push(msg.params.type.toUpperCase() + ': ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    logs.push('LOG: ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
// DPR=1 also fixes the viewport: without the override --headless=new gave a 640x217 window
if (process.env.DPR) await send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: Number(process.env.DPR), mobile: false });
// FAKELOCK: runs in every frame (iframes too) before the game's scripts, one lock per document. Scenario hooks:
// __fakeLock.refuse(n) rejects the next n requests + pointerlockerror; __fakeLock.escExits = true makes a trusted Esc
// keydown drop the lock and never reach the page (Chrome/Brave); by default Esc reaches the page, as in headless.
// Mouse moves still come from CDP Input.dispatchMouseEvent: Chromium fills movementX/Y without a real lock.
const FAKE_LOCK = `(() => {
  let el = null; let refuseN = 0;
  const fire = (type) => document.dispatchEvent(new Event(type));
  const fl = window.__fakeLock = { escExits: false, refuse: (n = 1) => { refuseN = n; } };
  Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => el });
  Element.prototype.requestPointerLock = function () { // the options ({unadjustedMovement}) are accepted and ignored
    if (refuseN > 0) { refuseN--; setTimeout(() => fire('pointerlockerror')); return Promise.reject(new DOMException('fake lock: refused', 'NotAllowedError')); }
    return new Promise((ok) => setTimeout(() => { if (el !== this) { el = this; fire('pointerlockchange'); } ok(); }));
  };
  Document.prototype.exitPointerLock = function () { setTimeout(() => { if (el) { el = null; fire('pointerlockchange'); } }); };
  window.addEventListener('keydown', (e) => {
    if (fl.escExits && el && e.isTrusted && e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); el = null; fire('pointerlockchange'); }
  }, true);
})();`;
if (process.env.FAKELOCK) await send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE_LOCK });
// pointer lock needs a focused page; --headless=new starts unfocused
if (process.env.FULL || process.env.FAKELOCK) {
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
}
await send('Page.navigate', { url: `http://localhost:${process.env.DEV_PORT ?? 5199}/` +(process.env.URL_QUERY ?? '?lowfx') });
await sleep(7000);

const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};
await shot('00-title');

// The scenario runs in the page. It may push a screenshot name to window.__shots (we answer with window.__shotDone)
// and trusted input as {method, params} to window.__cdp (we send them in order and bump window.__cdpDone).
const res = await send('Runtime.evaluate', { expression: `(async () => { ${SCENARIO} })()`, awaitPromise: false, returnByValue: true });
if (res.result?.exceptionDetails) logs.push('SCENARIO START ERROR: ' + JSON.stringify(res.result.exceptionDetails));
for (let i = 0; i < Number(process.env.MAXPOLL ?? 400); i++) {
  await sleep(250);
  const q = await send('Runtime.evaluate', { expression: 'JSON.stringify({s: window.__shots?.shift?.() ?? null, done: window.__done ?? null, cdp: window.__cdp?.splice?.(0) ?? []})', returnByValue: true });
  const v = JSON.parse(q.result.result.value);
  if (v.cdp.length) {
    for (const c of v.cdp) await send(c.method, c.params ?? {});
    await send('Runtime.evaluate', { expression: `window.__cdpDone = (window.__cdpDone ?? 0) + ${v.cdp.length}` });
  }
  if (v.s) {
    await shot(v.s);
    await send('Runtime.evaluate', { expression: 'window.__shotDone = true' });
  }
  if (v.done) {
    console.log('RESULT', v.done);
    break;
  }
}
console.log('LOGS:\n' + logs.slice(0, 80).join('\n'));
ws.close();
process.exit(0);
