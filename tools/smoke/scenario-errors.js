// Error table sink in src/ui/crash.ts with a stubbed fetch (no network). DEV never goes online, so the scenario installs the
// sink itself after E1/E0. Run: DEV_PORT=<dev port> CDP_PORT=<free> MAXPOLL=2400 node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-errors.js
// Order matters: E6 fills the 20-row cap of the page load, so it runs last on the main instance; E11 uses a fresh one.
const out = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const step = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = 'ERR ' + String((e && e.stack) || e).slice(0, 300); } };
(async () => {
  for (let i = 0; i < 120 && !window.gnome; i++) await sleep(500);
  await frames(3);
  const g = window.gnome;
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/ui\/crash\.ts/.test(n));
  const M = await import(url);
  const calls = [];
  const empty = (status) => Promise.resolve(new Response(null, { status }));
  let next = () => empty(201);
  const realFetch = window.fetch;
  window.fetch = (u, init = {}) => {
    const c = { url: String(u), method: init.method ?? 'GET', headers: init.headers ?? {}, keepalive: init.keepalive === true, body: init.body ? JSON.parse(init.body) : null, at: performance.now() };
    if (c.url.includes('/rest/v1/errors')) calls.push(c);
    return next(c);
  };
  const boom = (m) => setTimeout(() => { throw new Error(m); });
  const box = () => !!document.querySelector('.crash');
  const moreText = () => document.querySelector('.crash-more')?.textContent ?? '';
  const install = () => M.installErrorSink('https://example.supabase.co', 'sb_publishable_test');

  await step('E1', async () => {
    boom('errors-e1');
    await sleep(4000);
    return { calls: calls.length, box: box() };
  });

  await step('E0', async () => {
    crypto.randomUUID = undefined; // plain http / old browser
    let threw = false;
    try { install(); } catch { threw = true; }
    boom('errors-e0');
    await sleep(4000);
    delete crypto.randomUUID;
    return { threw, calls: calls.length, box: box() };
  });

  install();

  await step('E2', async () => {
    boom('errors-e2');
    await sleep(3200);
    const c = calls[0];
    const b = c?.body ?? {};
    out.E2_session = b.session;
    out.E2_build = b.build;
    return {
      url: c?.url, method: c?.method, apikey: c?.headers.apikey, prefer: c?.headers.Prefer, keepalive: c?.keepalive,
      keys: Object.keys(b).join(','), source: b.source, count: b.count, sessionOk: /^[0-9a-f-]{36}$/.test(b.session ?? ''),
      levelOk: b.level === g.state.holeLevel, landOk: b.land === g.state.land, stackOk: (b.stack ?? '').length > 0, calls: calls.length,
    };
  });

  await step('E3', async () => {
    const n0 = calls.length;
    for (let i = 0; i < 10; i++) { boom('errors-e3'); await sleep(100); }
    await sleep(2300);
    const posts = calls.slice(n0);
    out.E3 = { posts: posts.length, count: posts[0]?.body.count };
    boom('errors-e3');
    await sleep(3200);
    out.E3_after = { postsAfter: calls.length - n0, more: moreText() };
    return out.E3;
  });

  await step('E4', async () => {
    const n0 = calls.length;
    Promise.reject(new Error('errors-e4'));
    await sleep(50); // the rejection event fires after the current task: keep the two rows in trigger order
    // three.js logs "Context Lost" on this event; mute console.log for the synthetic event so LOGS keep only errors-e*
    const log = console.log;
    console.log = () => {};
    document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost'));
    console.log = log;
    await sleep(3200);
    const posts = calls.slice(n0);
    return { sources: posts.map((c) => c.body.source), ctxlostStack: posts.find((c) => c.body.source === 'webglcontextlost')?.body.stack };
  });

  await step('E5', async () => {
    const n0 = calls.length;
    M.note('mouse-jump {"ex":900}');
    M.note('slow-frame {"dt":0.15}');
    await sleep(3200);
    const posts = calls.slice(n0);
    return { sources: posts.map((c) => c.body.source), first: posts[0]?.body.message, second: posts[1]?.body.message, counts: posts.map((c) => c.body.count) };
  });

  await step('E7', async () => {
    document.querySelector('.menu')?.classList.add('hidden');
    g.paused = false;
    await frames(3);
    const t0 = g.time;
    const n0 = calls.length;
    next = () => Promise.reject(new TypeError('net'));
    boom('errors-e7');
    await sleep(3200);
    next = () => empty(400);
    boom('errors-e7b');
    await sleep(3200);
    next = () => empty(201);
    const saved = JSON.parse(localStorage.getItem('gnome-boozed-errors') ?? '[]');
    return { attempts: calls.length - n0, savedMentioningNet: saved.filter((e) => /\bnet\b|HTTP 400/.test(JSON.stringify(e))).length, timeAdvanced: g.time > t0 };
  });

  await step('E8', async () => {
    const seenLogs = [];
    const onErr = (e) => seenLogs.push(String(e.message).replace(/^Uncaught Error: /, ''));
    const onRej = (e) => seenLogs.push(String(e.reason));
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    const n0 = calls.length;
    boom('errors-e8');
    await sleep(100);
    window.dispatchEvent(new Event('pagehide'));
    const at = calls.slice(n0);
    const r = { postedWithinMs: at.length === 1, count: at[0]?.body.count, keepalive: at[0]?.keepalive };
    await sleep(3500);
    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onRej);
    return { postedWithinMs: r.postedWithinMs, count: r.count, later: calls.length - n0 - at.length, keepalive: r.keepalive, logs: seenLogs };
  });

  await step('E9', async () => {
    const n0 = calls.length;
    const e = new Error('errors-e9 ' + 'x'.repeat(5000));
    e.stack = 'errors-e9 stack\n' + 'y'.repeat(10000);
    setTimeout(() => { throw e; });
    await sleep(3200);
    const b = calls.slice(n0)[0]?.body ?? {};
    return { stack: b.stack?.length, message: b.message?.length };
  });

  await step('E10', async () => {
    const n0 = calls.length;
    const s = g.state;
    g.state = undefined;
    try { M.note('errors-e10'); } finally { g.state = s; }
    await sleep(3200);
    const b = calls.slice(n0)[0]?.body ?? {};
    return { level: b.level, land: b.land, source: b.source };
  });

  await step('E6', async () => {
    const n0 = calls.length;
    const more0 = moreText();
    for (let i = 0; i < 25; i++) boom('errors-e6-' + i);
    await sleep(3500);
    return { totalPosts: calls.length, sentInE6: calls.length - n0, moreBefore: more0, moreAfter: moreText() };
  });

  // timer-flushed rows (E2..E10) must use keepalive too: a reload right after the 3 s window would cancel a plain fetch
  out.KEEPALIVE = { timerRows: calls.length, allKeepalive: calls.every((c) => c.keepalive) };

  // a fresh module instance (own session, own caps): 15 notes then 10 distinct errors → notes capped at 10, all 10 errors sent
  await step('E11', async () => {
    const M2 = await import(url + (url.includes('?') ? '&' : '?') + 'e11');
    M2.installErrorSink('https://example.supabase.co', 'sb_publishable_test');
    M2.installCrashReport();
    const n0 = calls.length;
    for (let i = 0; i < 15; i++) M2.note('errors-e11-note-' + i);
    for (let i = 0; i < 10; i++) boom('errors-e11-err-' + i);
    await sleep(3500);
    const mine = calls.slice(n0).filter((c) => /errors-e11-/.test(c.body.message)); // errors arrive as "Uncaught Error: errors-e11-…"
    const sessions = new Set(mine.map((c) => c.body.session));
    const ids = [...sessions].filter((s) => s !== out.E2_session);
    const own = mine.filter((c) => c.body.session === ids[0]);
    return { notes: own.filter((c) => c.body.source === 'note').length, errors: own.filter((c) => c.body.source === 'error').length, sessions: sessions.size };
  });

  window.fetch = realFetch;
  window.__done = JSON.stringify(out, null, 1);
})();
