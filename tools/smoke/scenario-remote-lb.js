// RemoteStore with a stubbed fetch (no network). Run: CDP_PORT=9391 MAXPOLL=2400 node smoke.mjs run-remote-lb scenario-remote-lb.js
// With URL_QUERY='?lowfx&daily=2026-10-20' only R6 (daily-over submit) runs.
// The form shows only in offer() (rebirth, daily end); the pause-menu board (open()) lists scores only.
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
  const mod = (re) => import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => re.test(n)));
  const M = await mod(/\/src\/ui\/leaderboard\.ts/);
  const LB = 'gnome-boozed-leaderboard';
  const bootStore = lb.store.constructor.name;
  // the dev server must never go online: stop before any submit when the game booted on another store
  if (bootStore !== 'LocalStore') {
    window.__done = JSON.stringify({ ABORT: 'boot store is ' + bootStore + ', not LocalStore' });
    return;
  }
  // fetch recorder: `next` answers each call; a deferred lets a test hold a reply
  const calls = [];
  let next = () => Promise.resolve(new Response('[]', { status: 200 }));
  const realFetch = window.fetch;
  window.fetch = (u, init = {}) => { const c = { url: String(u), method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : null, signal: init.signal }; calls.push(c); return next(c); };
  // toast recorder: the rebirth submit reports through a toast, the board is already closed
  const toasts = [];
  const realToast = g.hud.toast.bind(g.hud);
  g.hud.toast = (t, k) => { toasts.push({ t, k }); realToast(t, k); };
  const badToasts = (from) => toasts.slice(from).filter((x) => x.k === 'bad').map((x) => x.t);
  const json = (v, status = 200) => Promise.resolve(new Response(JSON.stringify(v), { status }));
  const empty = (status) => Promise.resolve(new Response(null, { status }));
  const deferred = () => { let resolve; const p = new Promise((r) => (resolve = r)); return { p, resolve }; };
  const rows = () => [...ov.querySelectorAll('.lb-rows .row')].map((r) => r.children[0].textContent);
  const rowsText = () => ov.querySelector('.lb-rows').textContent;
  const msg = () => ov.querySelector('.lb-msg').textContent;
  const local = () => JSON.parse(localStorage.getItem(LB) ?? '[]');
  const localRows = () => local().length;
  const runLine = () => ov.querySelector('.lb-run').textContent;
  const formHidden = () => ov.querySelector('.lb-form').classList.contains('hidden');
  const fill = (name) => { ov.querySelector('input[name="name"]').value = name; };
  const submit = (name) => { fill(name); ov.querySelector('button[type="submit"]').click(); };
  // the rebirth form: returns a counter of done() calls
  const offer = () => { const d = { n: 0 }; lb.offer(() => d.n++); return d; };
  const settle = async () => { await sleep(80); };
  const row = (name, score, board = 'main', level = 3) => ({ name, score, level, board, created_at: '2026-10-20T10:00:00Z' });
  const posts = (from) => calls.slice(from).filter((c) => c.method === 'POST');
  const today = new Date().toISOString().slice(0, 10);
  const W_SEND = 'Could not reach the online board: score saved on this computer only.';
  const W_REJECT = 'The online board rejected this score: saved on this computer only.';
  const W_MAYBE = 'The online board did not answer in time: the score is saved on this computer and might have reached the online board too.';
  const W_CLOCK = "The online board rejected this score: check your computer's date and time. Saved on this computer only.";
  const W_TIME = 'Your time was not saved online.';

  if (location.search.includes('daily=')) {
    await step('R6_daily_over', async () => {
      const store = new M.RemoteStore('https://example.supabase.co', 'sb_publishable_test', 'test-salt');
      Object.assign(lb, { store });
      next = (c) => (c.method === 'POST' ? empty(201) : json([]));
      g.input.locked = true;
      document.querySelector('.menu').classList.add('hidden');
      g.paused = false;
      const D = await mod(/\/src\/systems\/daily\.ts/);
      D.daily.left = 0.1;
      g.state.runMaxCombo = 7; // a daily run with a combo still posts to the daily board only
      g.state.maxLevelAt = 1800; // and so does a daily run that reached level 12: no speed row
      g.state.runTimeUnknown = undefined;
      await frames(8);
      const open = lb.isOpen;
      let done = 0;
      lb.done = () => done++; // stand-in for the redirect to the yard
      const form = !formHidden();
      submit('Daily Runner'); await settle();
      const post = calls.find((c) => c.method === 'POST');
      const postBoards = calls.filter((c) => c.method === 'POST').map((c) => c.body.board);
      const onlyDaily = JSON.stringify(postBoards) === JSON.stringify([D.daily.board]);
      return { bootStore, open, form, title: ov.querySelector('.lb-title').textContent, postBoard: post?.body.board, postBoards, onlyDaily, keyHex: /^[0-9a-f]{64}$/.test(post?.body.key ?? ''), done };
    });
    window.fetch = realFetch;
    window.__done = JSON.stringify(out, null, 1);
    return;
  }

  g.state.maxLevelAt = null;
  g.state.runMaxCombo = 0; // R21 checks the combo row; the steps before it expect no combo row

  await step('R1_boot_local', async () => {
    lb.open(); await settle();
    const r = { store: bootStore, calls: calls.length, foot: ov.querySelector('.shop-foot').textContent, formHidden: formHidden(), tabs: [...ov.querySelectorAll('[data-tab]')].map((b) => b.textContent) };
    lb.close();
    offer(); await settle();
    const inputs = [...ov.querySelectorAll('input')];
    Object.assign(r, { offerFormHidden: formHidden(), inputs: inputs.map((i) => i.name), placeholder: inputs[0].placeholder, autocomplete: inputs.map((i) => i.autocomplete), maxLength: inputs[0].maxLength });
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
    d.resolve(new Response(JSON.stringify([row('Alpha', 500), { level: 1, score: 9, board: 'main', created_at: '2026-10-20T10:00:00Z' }, row('Beta', 300)]), { status: 200 }));
    await settle();
    const c = calls[0];
    // the footer is chosen when the board is built: a second board over the online store, removed right away
    const L2 = new M.Leaderboard(store);
    const remoteFoot = L2.el.querySelector('.shop-foot').textContent;
    L2.el.remove();
    return { loading, in: 3, shown: rows().length, rows: rows(), oldLocalShown: rows().some((t) => t.includes('Old Local')), url: c.url, apikey: c.headers.apikey === 'sb_publishable_test', method: c.method, msg: msg(), remoteFoot };
  });

  await step('R3_daily_tab', async () => {
    next = () => json([row('Day', 100, 'daily-' + today)]);
    ov.querySelectorAll('[data-tab]')[1].click(); await settle();
    const r = { url: calls.at(-1).url, containsToday: calls.at(-1).url.includes('board=eq.daily-' + today), rows: rows() };
    lb.close();
    return r;
  });

  await step('R4_submit_main', async () => {
    const d = offer(); await settle();
    const n0 = calls.length;
    submit('<b>'); await settle();
    const invalid = { callsUnchanged: calls.length === n0, msg: msg() };
    next = (c) => (c.method === 'POST' ? empty(201) : json([row('Alpha', 500)]));
    const l0 = localRows();
    g.state.totalEarned = 123456.789;
    const run = runLine();
    submit('Anna'); await settle();
    const post = posts(n0)[0];
    return { invalid, runLine: run, runLineLacksTime: !run.includes('Lvl 12 in'), post: !!post, keys: Object.keys(post.body).join(','), board: post.body.board, keyHex: /^[0-9a-f]{64}$/.test(post.body.key), prefer: post.headers.Prefer, localRows: localRows() - l0, calls: calls.slice(n0).map((c) => c.method).join(','), done: d.n, open: lb.isOpen };
  });

  await step('R5_rebirth_post_fails', async () => {
    next = (c) => (c.method === 'POST' ? empty(500) : json([]));
    const t0 = toasts.length;
    const d = offer(); await settle();
    submit('Jan'); await settle();
    const bad = badToasts(t0);
    return { done: d.n, hidden: ov.classList.contains('hidden'), toast: bad.join(' | '), containsOnly: bad.some((t) => t.includes('this computer only')) };
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
    const t0 = toasts.length;
    const d = offer(); await settle();
    const l0 = localRows();
    submit('Ewa'); await settle();
    const r = { done: d.n, localRows: localRows() - l0, toast: badToasts(t0), lastCall: calls.at(-1).method };
    next = (c) => (c.method === 'POST' ? empty(201) : empty(503));
    const t1 = toasts.length;
    const d2 = offer(); await settle();
    submit('Ewa'); await settle();
    r.R8b = { done: d2.n, badToasts: badToasts(t1) };
    return r;
  });

  await step('R9_stale_tab', async () => {
    const a = deferred(), b = deferred();
    let n = 0;
    next = () => (n++ === 0 ? a.p : b.p);
    lb.open(); // MOST MONEY request pending
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
    const o = offer(); await settle();
    const n0 = calls.length, l0 = localRows();
    submit('Ola'); await sleep(20);
    const pending = { msg: msg(), disabled: ov.querySelector('button[type="submit"]').disabled };
    ov.querySelector('button[type="submit"]').click();
    ov.querySelector('.lb-form').dispatchEvent(new Event('submit', { cancelable: true })); // Enter bypasses the disabled button
    await settle();
    d.resolve(new Response(null, { status: 201 }));
    await settle();
    return { postCount: posts(n0).length, localRows: localRows() - l0, pending, disabledAfter: ov.querySelector('button[type="submit"]').disabled, done: o.n };
  });

  await step('R12_close_while_pending', async () => {
    const d = deferred();
    next = (c) => (c.method === 'POST' ? d.p : json([]));
    const o = offer(); await settle();
    submit('Iga'); await sleep(20);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
    ov.querySelector('.lb-form [data-close]').click();
    ov.querySelector('[data-close].x').click();
    await settle();
    const whilePending = { done: o.n, open: lb.isOpen };
    d.resolve(new Response(null, { status: 201 }));
    await settle();
    return { whilePending, doneAfter: o.n, hidden: ov.classList.contains('hidden') };
  });

  await step('R13_post_503', async () => {
    next = (c) => (c.method === 'POST' ? empty(503) : json([]));
    const t0 = toasts.length;
    const o = offer(); await settle();
    const l0 = localRows();
    submit('Ula'); await settle();
    return { done: o.n, localRows: localRows() - l0, toast: badToasts(t0) };
  });

  await step('R14_post_timeout', async () => {
    // POST hangs until the 6 s timeout aborts it; GET answers at once
    next = (c) => (c.method === 'POST' ? new Promise((_, rej) => c.signal.addEventListener('abort', () => rej(c.signal.reason))) : json([]));
    const t0 = toasts.length;
    const o = offer(); await settle();
    const l0 = localRows();
    const s0 = performance.now();
    submit('Tim');
    let ms = null;
    for (let i = 0; i < 80; i++) { await sleep(100); if (!lb.isOpen) { ms = Math.round(performance.now() - s0); break; } }
    const bad = badToasts(t0);
    return { toastIsMaybe: bad[0] === W_MAYBE, afterMs: ms, localRows: localRows() - l0, done: o.n };
  });

  await step('R15_post_400_bad_key', async () => {
    next = (c) => (c.method === 'POST' ? json({ code: 'P0001', message: 'bad key' }, 400) : json([]));
    let t0 = toasts.length;
    offer(); await settle();
    submit('Kla'); await settle();
    const badKey = { toastIsClock: badToasts(t0)[0] === W_CLOCK };
    next = (c) => (c.method === 'POST' ? json({ message: 'daily board must be today or yesterday (UTC)' }, 400) : json([]));
    t0 = toasts.length;
    offer(); await settle();
    submit('Kla'); await settle();
    const dailyDate = { toastIsClock: badToasts(t0)[0] === W_CLOCK };
    return { badKey, dailyDate };
  });

  await step('R16_name_rules', async () => {
    next = (c) => (c.method === 'POST' ? empty(201) : json([]));
    const tryName = async (name) => {
      const o = offer(); await settle();
      const n0 = calls.length;
      submit(name); await settle();
      const r = { msg: msg(), calls: calls.length - n0, done: o.n };
      lb.close();
      return r;
    };
    const html = await tryName('<b>');
    const long = await tryName('A'.repeat(21));
    const blank = await tryName('   ');
    const bang = await tryName('Ania!');
    const emoji = await tryName('Ania 🦄');
    const twenty = await tryName('A'.repeat(20));
    const n0 = calls.length;
    const o = offer(); await settle();
    submit('Ania_42'); await settle();
    const p = posts(n0);
    const ok = { callsPOST: p.length, bodyName: p[0]?.body.name, keys: Object.keys(p[0]?.body ?? {}).join(','), localName: local().some((e) => e.name === 'Ania_42'), done: o.n };
    // the old local row from before the change, alone on the local board
    localStorage.setItem(LB, JSON.stringify([{ first: 'Old', last: 'Local', score: 777, level: 2, at: 1, board: 'main' }]));
    lb.store = new M.LocalStore();
    lb.open(); await settle();
    const legacyRow = rows().find((t) => t.includes('Old')) ?? null;
    lb.close();
    offer(); await settle();
    submit('Lokal'); await settle();
    const old = local().find((e) => e.score === 777);
    lb.store = store;
    return { html, long, blank, bang, emoji, twenty: twenty.calls, ok, legacyRow, legacyStored: old ? { name: old.name, keys: Object.keys(old).join(',') } : null };
  });

  await step('R17_speed_submit', async () => {
    const speedReply = { v: () => empty(201) };
    next = (c) => (c.method === 'POST' ? (c.body.board === 'speed' ? speedReply.v() : empty(201)) : json([]));
    g.state.holeLevel = 12;
    g.state.maxLevelAt = 1234;
    const run = async (name) => {
      const n0 = calls.length, l0 = localRows(), t0 = toasts.length;
      const o = offer(); await settle();
      const line = runLine();
      submit(name); await settle();
      const p = posts(n0);
      return { line, p, posts: p.map((c) => c.body.board), localRows: localRows() - l0, done: o.n, bad: badToasts(t0) };
    };
    const first = await run('Speedy');
    const speed = first.p.find((c) => c.body.board === 'speed');
    const r = {
      runLine: first.line,
      runLineHasTime: first.line.includes('· Lvl 12 in 0:20:34'),
      posts: first.posts,
      speedBody: { score: speed?.body.score, level: speed?.body.level },
      keyHex: /^[0-9a-f]{64}$/.test(speed?.body.key ?? ''),
      localRows: first.localRows,
      done: first.done,
      bad: first.bad,
    };
    // the next run reaches 12 again: its time posts again
    r.secondRun = (await run('Speedy')).posts;
    speedReply.v = () => empty(503);
    const fail = await run('Speedy');
    // the money row went through: only the time row failed, so the toast names the time, not the score
    r.fail = { toast: fail.bad, toastIsTime: fail.bad[0] === W_TIME, localRows: fail.localRows, done: fail.done };
    speedReply.v = () => json({ message: 'new row for relation "scores" violates check constraint "scores_speed_check"' }, 400);
    const rej = await run('Speedy');
    r.reject = { toast: rej.bad, toastIsTime: rej.bad[0] === W_TIME, localRows: rej.localRows, done: rej.done };
    speedReply.v = () => json({ code: 'P0001', message: 'bad key' }, 400);
    const clk = await run('Speedy');
    r.clock = { toastIsTime: clk.bad[0] === W_TIME };
    // both rows refused: the score warning wins
    next = (c) => (c.method === 'POST' ? json({ message: 'violates check constraint' }, 400) : json([]));
    const both = await run('Speedy');
    r.bothRejected = { toastIsReject: both.bad[0] === W_REJECT };
    next = (c) => (c.method === 'POST' ? (c.body.board === 'speed' ? speedReply.v() : empty(201)) : json([]));
    speedReply.v = () => empty(201);
    g.state.maxLevelAt = null;
    r.noTime = { posts: (await run('Slowpoke')).posts, holeLevel: g.state.holeLevel };
    return r;
  });

  await step('R19_speed_tab_and_rebirth', async () => {
    next = () => json([{ name: 'Fast', score: 600, level: 12, board: 'speed', created_at: '2026-10-20T10:00:00Z' }]);
    lb.open(); await settle();
    const n0 = calls.length;
    ov.querySelectorAll('[data-tab]')[2].click(); await settle();
    const tab = { url: calls.slice(n0).at(-1).url, rows: rows(), cells: [...(ov.querySelector('.lb-rows .row')?.children ?? [])].slice(1, 3).map((c) => c.textContent), activeTab: ov.querySelector('.tab.on').textContent };
    lb.close();
    // rebirth with a time pending: both rows go before done(); the next run starts clean
    next = (c) => (c.method === 'POST' ? empty(201) : json([]));
    g.state.maxLevelAt = 900;
    const p0 = calls.length;
    const o = offer(); await settle();
    submit('Reborn'); await settle();
    const S = await mod(/\/src\/core\/state\.ts/);
    const f = S.freshState(g.state);
    const rebirth = { posts: posts(p0).length, done: o.n, fresh: { runTime: f.runTime, maxLevelAt: f.maxLevelAt } };
    // local speed board: 55 times, the 50 fastest kept in ascending order, other boards untouched
    const ls = new M.LocalStore();
    localStorage.setItem(LB, JSON.stringify([1, 2, 3].map((i) => ({ name: 'Main' + i, score: i * 100, level: 3, at: i, board: 'main' }))));
    for (let i = 0; i < 55; i++) await ls.submit({ name: 'S' + i, score: 1000 - i * 7, level: 12, at: i, board: 'speed' });
    const sp = await ls.list('speed');
    const scores = sp.map((e) => e.score);
    const main = await ls.list('main');
    const kept = { localSpeedKept: sp.length, ascending: scores.every((v, i) => i === 0 || scores[i - 1] <= v), fastestKept: scores[0] === 1000 - 54 * 7, mainKept: main.length };
    g.state.maxLevelAt = null;
    return { tab, rebirth, kept };
  });

  await step('R20_old_reborn_save', async () => {
    // a save from before the run clock, mid-run after 2 rebirths: playTime spans all runs, so its time is unknown
    const S = await mod(/\/src\/core\/state\.ts/);
    const SAVE = 'gnome-boozed-save-v1';
    const realRaw = localStorage.getItem(SAVE);
    const realState = g.state;
    const old = S.freshState();
    delete old.runTime;
    delete old.maxLevelAt;
    old.holeLevel = 11;
    old.totalEarned = 5e6;
    old.stats.rebirths = 2;
    old.stats.playTime = 36000;
    // goal fields the HUD reads every frame (freshState leaves them to the rebirth code)
    Object.assign(old, JSON.parse(JSON.stringify({ goalStart: realState.goalStart, goalsDone: realState.goalsDone })));
    localStorage.setItem(SAVE, JSON.stringify(old));
    // a first-run save of the same shape keeps playTime as its run time (exact on the first run)
    const first = JSON.parse(JSON.stringify(old));
    first.stats.rebirths = 0;
    localStorage.setItem(SAVE, JSON.stringify(first));
    const firstRunTime = S.loadState().runTime;
    localStorage.setItem(SAVE, JSON.stringify(old));
    g.state = S.loadState();
    next = (c) => (c.method === 'POST' ? empty(201) : json([]));
    let r;
    try {
      g.hole.levelUp();
      const level = g.state.holeLevel;
      const p0 = calls.length;
      const o = offer(); await settle();
      const line = runLine();
      submit('Oldie'); await settle();
      const f = S.freshState(g.state);
      r = { level, posts: posts(p0).map((c) => c.body.board), runLineLacksTime: !line.includes('Lvl 12 in'), done: o.n, firstRunTime, freshUnknown: f.runTimeUnknown ?? false };
    } finally {
      g.state = realState;
      if (realRaw === null) localStorage.removeItem(SAVE);
      else localStorage.setItem(SAVE, realRaw);
    }
    return r;
  });

  await step('R21_combo_board', async () => {
    const W_COMBO = 'Your combo was not saved online.';
    // the tab: best combo first, shown as a combo, never as money
    next = () => json([{ name: 'Comboist', score: 250, level: 9, board: 'combo', created_at: '2026-10-20T10:00:00Z' }]);
    lb.open(); await settle();
    const n0 = calls.length;
    ov.querySelector('[data-tab="combo"]').click(); await settle();
    const url = calls.slice(n0).at(-1).url;
    const tab = { label: ov.querySelector('[data-tab="combo"]').textContent, url, desc: url.includes('board=eq.combo&order=score.desc'), cell: ov.querySelector('.lb-rows .row')?.children[1].textContent, activeTab: ov.querySelector('.tab.on').textContent };
    lb.close();
    // the value: a real eat raises the run's best combo, the submit posts it as a second row
    const V3 = g.camera.position.constructor;
    g.state.runMaxCombo = 0;
    g.hole.combo = 41;
    const x = g.gnomes.spawn('classic', new V3(0, -10, 0), { tier: 'normal' });
    if (x) g.hole.consume(x);
    const afterEat = g.state.runMaxCombo;
    const comboReply = { v: () => empty(201) };
    next = (c) => (c.method === 'POST' ? (c.body.board === 'combo' ? comboReply.v() : empty(201)) : json([]));
    const run = async (name, board) => {
      const p0 = calls.length, t0 = toasts.length;
      const o = { n: 0 };
      board ? lb.offer(() => o.n++, board) : lb.offer(() => o.n++);
      await settle();
      submit(name); await settle();
      const p = posts(p0);
      return { boards: p.map((c) => c.body.board), combo: p.find((c) => c.body.board === 'combo')?.body, bad: badToasts(t0), done: o.n };
    };
    const sent = await run('Combi');
    const value = { afterEat, boards: sent.boards, score: sent.combo?.score, scoreIsRunMax: sent.combo?.score === afterEat, level: sent.combo?.level === g.state.holeLevel, keyHex: /^[0-9a-f]{64}$/.test(sent.combo?.key ?? ''), bad: sent.bad, done: sent.done };
    comboReply.v = () => empty(503);
    const fail = await run('Combi');
    const failed = { toastIsCombo: fail.bad[0] === W_COMBO, done: fail.done };
    comboReply.v = () => empty(201);
    // a daily run posts to the daily board only, combo or not
    const daily = (await run('Daily', 'daily-' + today)).boards;
    // no combo this run: no combo row
    g.state.runMaxCombo = 0;
    const zero = (await run('Zero')).boards;
    // rebirth resets the run's combo, the lifetime best stays; an old mid-run save without the field loads as 0
    const S = await mod(/\/src\/core\/state\.ts/);
    g.state.runMaxCombo = 42;
    const f = S.freshState(g.state);
    const SAVE = 'gnome-boozed-save-v1';
    const realRaw = localStorage.getItem(SAVE);
    const old = S.freshState();
    delete old.runMaxCombo;
    localStorage.setItem(SAVE, JSON.stringify(old));
    const oldSave = S.loadState().runMaxCombo;
    if (realRaw === null) localStorage.removeItem(SAVE);
    else localStorage.setItem(SAVE, realRaw);
    const rebirth = { freshRunMaxCombo: f.runMaxCombo, lifetimeKept: f.stats.maxCombo === g.state.stats.maxCombo && f.stats.maxCombo >= 42, oldSave };
    // the local store keeps the combo board, best first
    const ls = new M.LocalStore();
    localStorage.setItem(LB, '[]');
    for (const score of [5, 90, 30]) await ls.submit({ name: 'C' + score, score, level: 4, at: score, board: 'combo' });
    await ls.submit({ name: 'M', score: 1, level: 1, at: 1, board: 'main' });
    const kept = (await ls.list('combo')).map((e) => e.score);
    g.state.runMaxCombo = 0;
    return { tab, value, failed, daily, zero, rebirth, localCombo: kept };
  });

  await step('R18_run_timer', async () => {
    const F = await mod(/\/src\/core\/format\.ts/);
    g.input.locked = true;
    document.querySelector('.menu').classList.add('hidden');
    g.paused = false;
    const a = g.state.runTime;
    await frames(30);
    const unpausedDelta = g.state.runTime - a;
    g.paused = true;
    const b = g.state.runTime;
    await frames(30);
    const pausedDelta = g.state.runTime - b;
    g.paused = false;
    g.state.maxLevelAt = null;
    g.state.holeLevel = 11;
    g.hole.levelUp();
    const at = g.state.maxLevelAt;
    const diff = Math.abs(at - g.state.runTime);
    await frames(30);
    const frozen = g.state.maxLevelAt === at && g.state.runTime > at;
    g.paused = true;
    return { unpausedDelta: +unpausedDelta.toFixed(3), pausedDelta, level: g.state.holeLevel, maxLevelAtSet: typeof at === 'number', diff: +diff.toFixed(3), frozen, clock: F.clock(3725), clockDay: F.clock(90061) };
  });

  window.fetch = realFetch;
  g.hud.toast = realToast;
  window.__done = JSON.stringify(out, null, 1);
})();
