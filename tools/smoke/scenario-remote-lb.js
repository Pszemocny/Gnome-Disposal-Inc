// RemoteStore with a stubbed fetch (no network). Run: CDP_PORT=9391 MAXPOLL=2400 node smoke.mjs run-remote-lb scenario-remote-lb.js
// With URL_QUERY='?lowfx&daily=2026-10-20' only R6 (daily-over submit) runs.
const out = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const step = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = 'ERR ' + String((e && e.stack) || e).slice(0, 300); } };
(async () => {
  for (let i = 0; i < 120 && !window.gnome; i++) await sleep(500);
  await frames(3);
  const g = window.gnome;
  g.input.lock = () => {};
  g.input.unlock = () => {};
  const lb = g.leaderboard;
  const ov = document.querySelector('.leaderboard');
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/ui\/leaderboard\.ts/.test(n));
  const M = await import(url);
  const LB = 'gnome-boozed-leaderboard';
  const bootStore = lb.store.constructor.name;
  // fetch recorder: `next` answers each call; a deferred lets a test hold a reply
  const calls = [];
  let next = () => Promise.resolve(new Response('[]', { status: 200 }));
  const realFetch = window.fetch;
  window.fetch = (u, init = {}) => { const c = { url: String(u), method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : null, signal: init.signal }; calls.push(c); return next(c); };
  const json = (v, status = 200) => Promise.resolve(new Response(JSON.stringify(v), { status }));
  const empty = (status) => Promise.resolve(new Response(null, { status }));
  const deferred = () => { let resolve; const p = new Promise((r) => (resolve = r)); return { p, resolve }; };
  const rows = () => [...ov.querySelectorAll('.lb-rows .row')].map((r) => r.children[0].textContent);
  const rowsText = () => ov.querySelector('.lb-rows').textContent;
  const msg = () => ov.querySelector('.lb-msg').textContent;
  const localRows = () => JSON.parse(localStorage.getItem(LB) ?? '[]').length;
  const fill = (f, l) => { ov.querySelector('input[name="first"]').value = f; ov.querySelector('input[name="last"]').value = l; };
  const submit = (f, l) => { fill(f, l); ov.querySelector('button[type="submit"]').click(); };
  const settle = async () => { await sleep(80); };
  const row = (first, score, board = 'main') => ({ first_name: first, last_name: 'Remote', score, level: 3, board, created_at: '2026-10-20T10:00:00Z' });
  const today = new Date().toISOString().slice(0, 10);

  if (location.search.includes('daily=')) {
    await step('R6_daily_over', async () => {
      lb.store.constructor.name; // the app booted with LocalStore
      const store = new M.RemoteStore('https://example.supabase.co', 'sb_publishable_test', 'test-salt');
      Object.assign(lb, { store });
      next = (c) => (c.method === 'POST' ? empty(201) : json([]));
      g.input.locked = true;
      document.querySelector('.menu').classList.add('hidden');
      g.paused = false;
      const D = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/systems\/daily\.ts/.test(n)));
      D.daily.left = 0.1;
      await frames(8);
      const open = lb.isOpen;
      let done = 0;
      lb.done = () => done++; // stand-in for the redirect to the yard
      submit('Daily', 'Runner'); await settle();
      const post = calls.find((c) => c.method === 'POST');
      return { bootStore, open, title: ov.querySelector('.lb-title').textContent, postBoard: post?.body.board, keyHex: /^[0-9a-f]{64}$/.test(post?.body.key ?? ''), done };
    });
    window.fetch = realFetch;
    window.__done = JSON.stringify(out, null, 1);
    return;
  }

  await step('R1_boot_local', async () => {
    lb.open(); await settle();
    const r = { store: bootStore, calls: calls.length, foot: ov.querySelector('.shop-foot').textContent, autocomplete: [...ov.querySelectorAll('input')].map((i) => i.autocomplete) };
    lb.close();
    return r;
  });

  // one old local row from before the change: never on the online board, visible only in the fallback
  localStorage.setItem(LB, JSON.stringify([{ first: 'Old', last: 'Local', score: 777, level: 2, at: 1, board: 'main' }]));
  const store = new M.RemoteStore('https://example.supabase.co', 'sb_publishable_test', 'test-salt');
  Object.assign(lb, { store });

  await step('R2_list_main', async () => {
    const d = deferred();
    next = () => d.p;
    lb.open();
    const loading = rowsText() === 'Loading…';
    d.resolve(new Response(JSON.stringify([row('Alpha', 500), { first_name: 'Broken', last_name: 'Row', level: 1, board: 'main', created_at: '2026-10-20T10:00:00Z' }, row('Beta', 300)]), { status: 200 }));
    await settle();
    const c = calls[0];
    return { loading, in: 3, shown: rows().length, rows: rows(), oldLocalShown: rows().some((t) => t.includes('Old Local')), url: c.url, apikey: c.headers.apikey === 'sb_publishable_test', method: c.method, msg: msg() };
  });

  await step('R3_daily_tab', async () => {
    next = () => json([row('Day', 100, 'daily-' + today)]);
    ov.querySelectorAll('[data-tab]')[1].click(); await settle();
    return { url: calls.at(-1).url, containsToday: calls.at(-1).url.includes('board=eq.daily-' + today), rows: rows() };
  });

  await step('R4_submit_main', async () => {
    ov.querySelectorAll('[data-tab]')[0].click(); await settle();
    const n0 = calls.length;
    submit('<b>', 'Nowak'); await settle();
    const invalid = { callsUnchanged: calls.length === n0, msg: msg() };
    next = (c) => (c.method === 'POST' ? empty(201) : json([row('Alpha', 500)]));
    const l0 = localRows();
    g.state.totalEarned = 123456.789;
    submit('Anna', 'Nowak'); await settle();
    const post = calls.slice(n0).find((c) => c.method === 'POST');
    const after = calls.slice(n0).map((c) => c.method);
    const r = { invalid, post: !!post, keys: Object.keys(post.body).join(','), board: post.body.board, keyHex: /^[0-9a-f]{64}$/.test(post.body.key), prefer: post.headers.Prefer, localRows: localRows() - l0, msg: msg(), msgOk: ov.querySelector('.lb-msg').classList.contains('ok'), calls: after.join(',') };
    // R15: a second deliberate submit after the first settled
    submit('Anna', 'Nowak'); await settle();
    r.postCount = calls.slice(n0).filter((c) => c.method === 'POST').length;
    return r;
  });

  await step('R5_rebirth_post_fails', async () => {
    next = (c) => (c.method === 'POST' ? empty(500) : json([]));
    let done = 0;
    lb.offer(() => done++); await settle();
    submit('Jan', 'Kowalski'); await settle();
    const toast = [...document.querySelectorAll('.toast.bad')].map((t) => t.textContent).join(' | ');
    return { done, hidden: ov.classList.contains('hidden'), toast, containsOnly: toast.includes('this computer only') };
  });

  await step('R7_service_down', async () => {
    next = () => Promise.reject(new TypeError('Failed to fetch'));
    lb.open(); await settle();
    const typeError = { msg: msg(), rows: rows(), oldLocalShown: rows().some((t) => t.includes('Old Local')) };
    lb.close();
    next = () => empty(503);
    lb.open(); await settle();
    const s503 = { msg: msg(), rows: rows().length };
    lb.close();
    // a hung request: only the 6 s timeout ends it
    next = (c) => new Promise((_, rej) => c.signal.addEventListener('abort', () => rej(c.signal.reason)));
    const t0 = performance.now();
    lb.open();
    let ms = null;
    for (let i = 0; i < 100; i++) { await sleep(100); if (msg().startsWith('Online board unreachable')) { ms = Math.round(performance.now() - t0); break; } }
    const hung = { warningAfterMs: ms, rowsText: rowsText().slice(0, 40) };
    lb.close();
    return { typeError, s503, hung };
  });

  await step('R8_post_400_get_200', async () => {
    next = (c) => (c.method === 'POST' ? json({ message: 'new row for relation "scores" violates check constraint' }, 400) : json([row('Alpha', 500)]));
    lb.open(); await settle();
    const l0 = localRows();
    submit('Ewa', 'Lis'); await settle();
    const r = { open: lb.isOpen, localRows: localRows() - l0, msg: msg(), lastCall: calls.at(-1).method };
    lb.close();
    next = (c) => (c.method === 'POST' ? empty(201) : empty(503));
    lb.open(); await settle();
    submit('Ewa', 'Lis'); await settle();
    r.R8b = { msg: msg(), ok: ov.querySelector('.lb-msg').classList.contains('ok') };
    lb.close();
    return r;
  });

  await step('R9_stale_tab', async () => {
    const a = deferred(), b = deferred();
    let n = 0;
    next = () => (n++ === 0 ? a.p : b.p);
    lb.open(); // ALL-TIME request pending
    ov.querySelectorAll('[data-tab]')[1].click(); // DAILY request pending
    b.resolve(new Response(JSON.stringify([row('DailyRow', 1, 'daily-' + today)]), { status: 200 }));
    await settle();
    a.resolve(new Response(JSON.stringify([row('MainRow', 9)]), { status: 200 }));
    await settle();
    const r = { rows: rows(), activeTab: ov.querySelector('.tab.on').textContent };
    lb.close();
    return r;
  });

  await step('R10_keyRole', async () => {
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = (role) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', ref: 'abc', role, iat: 1 })}.sig`;
    // reference from Node (Buffer.writeDoubleBE + createHmac), the form the real project accepted for 7 awkward scores
    const ref = '52d50de5ad9ba9d8eef75e176543bd6025f4de8a744fb8614d738b1d37c0c6e4';
    return { scoreKeyMatchesNode: (await M.scoreKey('test-salt', 123456.789, 'main', '2026-10-20')) === ref, pub: M.keyRole('sb_publishable_x'), anon: M.keyRole(jwt('anon')), service: M.keyRole(jwt('service_role')), garbage: M.keyRole('garbage'), secret: M.keyRole('sb_secret_x') };
  });

  await step('R11_double_submit', async () => {
    const d = deferred();
    next = (c) => (c.method === 'POST' ? d.p : json([]));
    lb.open(); await settle();
    const n0 = calls.length, l0 = localRows();
    submit('Ola', 'Kot'); await sleep(20);
    const pending = { msg: msg(), disabled: ov.querySelector('button[type="submit"]').disabled };
    ov.querySelector('button[type="submit"]').click();
    ov.querySelector('.lb-form').dispatchEvent(new Event('submit', { cancelable: true })); // Enter bypasses the disabled button
    await settle();
    d.resolve(new Response(null, { status: 201 }));
    await settle();
    const r = { postCount: calls.slice(n0).filter((c) => c.method === 'POST').length, localRows: localRows() - l0, pending, disabledAfter: ov.querySelector('button[type="submit"]').disabled, msg: msg() };
    lb.close();
    return r;
  });

  await step('R12_close_while_pending', async () => {
    const d = deferred();
    next = (c) => (c.method === 'POST' ? d.p : json([]));
    let done = 0;
    lb.offer(() => done++); await settle();
    submit('Iga', 'Mak'); await sleep(20);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
    ov.querySelector('[data-skip]').click();
    ov.querySelector('[data-close].x').click();
    await settle();
    const whilePending = { done, open: lb.isOpen };
    d.resolve(new Response(null, { status: 201 }));
    await settle();
    return { whilePending, doneAfter: done, hidden: ov.classList.contains('hidden') };
  });

  await step('R13_post_503', async () => {
    next = (c) => (c.method === 'POST' ? empty(503) : json([]));
    lb.open(); await settle();
    const l0 = localRows();
    submit('Ula', 'Sowa'); await settle();
    const r = { open: lb.isOpen, localRows: localRows() - l0, msg: msg() };
    lb.close();
    return r;
  });

  const W_MAYBE = 'The online board did not answer in time: the score is saved on this computer and might have reached the online board too.';
  const W_CLOCK = "The online board rejected this score: check your computer's date and time. Saved on this computer only.";

  await step('R14_post_timeout', async () => {
    // POST hangs until the 6 s timeout aborts it; GET answers at once
    next = (c) => (c.method === 'POST' ? new Promise((_, rej) => c.signal.addEventListener('abort', () => rej(c.signal.reason))) : json([]));
    lb.open(); await settle();
    const l0 = localRows();
    const t0 = performance.now();
    submit('Tim', 'Out');
    let ms = null;
    for (let i = 0; i < 80; i++) { await sleep(100); if (msg() !== 'Sending…') { ms = Math.round(performance.now() - t0); break; } }
    await settle();
    const r = { msgIsMaybe: msg() === W_MAYBE, msg: msg(), afterMs: ms, localRows: localRows() - l0, open: lb.isOpen };
    lb.close();
    return r;
  });

  await step('R15_post_400_bad_key', async () => {
    next = (c) => (c.method === 'POST' ? json({ code: 'P0001', message: 'bad key' }, 400) : json([]));
    lb.open(); await settle();
    submit('Kla', 'Ock'); await settle();
    const badKey = { msgIsClock: msg() === W_CLOCK, msg: msg() };
    lb.close();
    next = (c) => (c.method === 'POST' ? json({ message: 'daily board must be today or yesterday (UTC)' }, 400) : json([]));
    lb.open(); await settle();
    submit('Kla', 'Ock'); await settle();
    const dailyDate = { msgIsClock: msg() === W_CLOCK, msg: msg() };
    lb.close();
    return { badKey, dailyDate };
  });

  window.fetch = realFetch;
  window.__done = JSON.stringify(out, null, 1);
})();
