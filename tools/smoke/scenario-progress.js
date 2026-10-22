// Progress log in src/systems/progress.ts with a stubbed fetch (no network). DEV never goes online, so the scenario installs the
// sink itself after P0. Two runs, the yard page and the daily page:
//   DEV_PORT=5199 CDP_PORT=<free> MAXPOLL=2400 FAKELOCK=1 node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-progress.js
//   DEV_PORT=5199 CDP_PORT=<free> MAXPOLL=2400 FAKELOCK=1 URL_QUERY='?lowfx&daily=' node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-progress.js
// smoke.mjs deletes the profile after each run, so the daily run seeds the yard's entry itself (D2) instead of reading the yard run's.
// Prints one RESULT JSON with the raw values plus `checks` (PASS/FAIL per line).
const out = {};
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const step = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = 'ERR ' + String((e && e.stack) || e).slice(0, 300); } };
const KEY = 'gnome-boozed-player';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GRANT = 'rid,player,name,seq,kind,daily,level,run,run_time,play_time,money,earned,gnomes,gnomes_total,land,purchases,achievements,build,ua';
(async () => {
  for (let i = 0; i < 120 && !window.gnome; i++) await sleep(500);
  await frames(3);
  const g = window.gnome;
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/systems\/progress\.ts/.test(n));
  const M = await import(url);
  const fresh = (tag) => import(url + (url.includes('?') ? '&' : '?') + tag); // own module state, the same localStorage
  const calls = [];
  const empty = (status) => Promise.resolve(new Response(null, { status }));
  let next = () => empty(201);
  const realFetch = window.fetch;
  window.fetch = (u, init = {}) => {
    const c = { url: String(u), method: init.method ?? 'GET', headers: init.headers ?? {}, keepalive: init.keepalive === true, body: init.body ? JSON.parse(init.body) : null };
    if (c.url.includes('/rest/v1/progress')) calls.push(c);
    return next(c);
  };
  const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');
  const lvl = () => g.hole.levelUp();
  const buy = (id, dir = 1) => g.shop.buy(id, dir);
  const install = (m = M) => m.installProgressSink('https://example.supabase.co', 'sb_publishable_test');
  const isDaily = location.search.includes('daily');
  g.state.money = 1e12;

  if (!isDaily) {
    // rows 1, 2, 21: DEV sends nothing, writes nothing, shows no menu line
    await step('P0', async () => {
      lvl();
      buy('kick');
      await sleep(1000);
      const menuLine = /anonymous gameplay statistics/.test(document.querySelector('.settings')?.textContent ?? '');
      return { store: g.leaderboard.store.constructor.name, calls: calls.length, key: localStorage.getItem(KEY) !== null, menuLine };
    });

    install();

    // rows 3, 4, 5, 8: one level row with the buffers since the previous row
    await step('P2', async () => {
      buy('kick');
      const afterKick = { hole: g.state.holeLevel, money: Math.round(g.state.money) };
      buy('speed');
      const afterSpeed = { hole: g.state.holeLevel, money: Math.round(g.state.money) };
      buy('fan');
      g.machines.place('fan', g.camera.position.clone().setY(0).add(new g.camera.position.constructor(3, 0, 3)), new g.camera.quaternion.constructor());
      g.achievements.unlock('booze');
      lvl();
      await sleep(1000);
      const c = calls[0];
      const b = c?.body ?? {};
      out.P2_id = stored()?.id;
      // what the player owns when the row is written: every non-zero shop and Deep level, placed machines per type
      const ownNow = Object.fromEntries(Object.entries({ ...g.state.upgrades, ...g.state.deep }).filter(([, v]) => v > 0));
      const placedNow = {};
      for (const m of g.machines.list) placedNow[m.type] = (placedNow[m.type] ?? 0) + 1;
      const snap = (b.purchases ?? [])[0] ?? {};
      const buys = (b.purchases ?? []).slice(1);
      out.P2_fields = {
        kick: buys.find((p) => p.id === 'kick'), speed: buys.find((p) => p.id === 'speed'), afterKick, afterSpeed,
      };
      out.P2_owned = {
        id: snap.id, lvl: snap.lvl, cost: snap.cost, owned: snap.owned, ownNow, placed: snap.placed, placedNow,
        sameOwned: JSON.stringify(snap.owned) === JSON.stringify(ownNow), samePlaced: JSON.stringify(snap.placed) === JSON.stringify(placedNow),
        noZero: Object.values(snap.owned ?? {}).every((v) => v > 0), hasKick: (snap.owned ?? {}).kick === g.state.upgrades.kick,
      };
      return {
        posts: calls.length, url: c?.url.endsWith('/rest/v1/progress'), method: c?.method, prefer: c?.headers.Prefer, keepalive: c?.keepalive,
        keys: Object.keys(b).join(','), keysOk: Object.keys(b).join(',') === GRANT, kind: b.kind, seq: b.seq, daily: b.daily,
        ridOk: UUID.test(b.rid ?? ''), playerOk: b.player === stored()?.id && UUID.test(b.player ?? ''), name: b.name,
        levelOk: b.level === g.state.holeLevel, gnomesOk: b.gnomes === g.state.stats.gnomesEaten - (g.state.runEatenStart ?? 0),
        moneyOk: b.money === g.state.money, landOk: b.land === g.state.land,
        purchases: (b.purchases ?? []).map((p) => [p.id, p.lvl, typeof p.cost]),
        achievements: (b.achievements ?? []).map((a) => [a.id, typeof a.run_time, a.level]),
        buffersEmpty: stored()?.buy.length === 0 && stored()?.ach.length === 0, queue: stored()?.queue.length,
      };
    });

    // rows 6, 7: shard buy and Strong Arm up and down, nothing from P2 repeated
    await step('P3', async () => {
      const n0 = calls.length;
      g.state.shards = 1000;
      buy('dStart');
      buy('throw', 1);
      buy('throw', -1);
      const afterDown = { hole: g.state.holeLevel, money: Math.round(g.state.money) };
      lvl();
      await sleep(1000);
      const p = calls.slice(n0)[0]?.body.purchases ?? [];
      const down = p.filter((x) => x.id === 'throw')[1];
      const deepBuy = p.find((x) => x.id === 'dStart');
      return {
        deepBuy, shardsLeft: g.state.shards,
        dStart: p.some((x) => x.id === 'dStart' && x.lvl === 1), throw: p.filter((x) => x.id === 'throw').map((x) => x.lvl), repeated: p.slice(1).some((x) => x.id === 'kick' || x.id === 'speed'),
        down, afterDown, ownedDeep: p[0]?.owned?.dStart, ownedThrow: p[0]?.owned?.throw,
      };
    });

    // row 12: the nickname from the leaderboard goes into every later row
    await step('P4', async () => {
      const n0 = calls.length;
      const earlierNull = calls.every((c) => c.body.name === null);
      g.leaderboard.offer(() => {});
      document.querySelector('.leaderboard input[name="name"]').value = 'Tester';
      await g.leaderboard.send();
      lvl();
      await sleep(1000);
      return { store: g.leaderboard.store.constructor.name, stored: stored()?.name, rowName: calls.slice(n0)[0]?.body.name, earlierNull };
    });

    // rows 13, 15: network down keeps the row and the game runs; the next row sends both in seq order
    await step('P5', async () => {
      document.querySelector('.menu')?.classList.add('hidden');
      g.paused = false;
      await frames(3);
      const t0 = g.time;
      const n0 = calls.length;
      next = () => Promise.reject(new TypeError('net'));
      lvl();
      await sleep(1000);
      const queuedAfterNet = stored()?.queue.length;
      next = () => empty(201);
      const n1 = calls.length;
      lvl();
      await sleep(1000);
      const sent = calls.slice(n1);
      return { attempts: n1 - n0, queuedAfterNet, timeAdvanced: g.time > t0, sentAfter: sent.length, seqOrder: sent.length === 2 && sent[0].body.seq < sent[1].body.seq, queueAfter: stored()?.queue.length };
    });

    // row 14: 400 drops the row; 404 (table not created yet) keeps it like 5xx
    await step('P6', async () => {
      const n0 = calls.length;
      next = () => empty(400);
      lvl();
      await sleep(1000);
      const r = { posts: calls.length - n0, queueAfter400: stored()?.queue.length };
      next = () => empty(404);
      lvl();
      await sleep(1000);
      r.queueAfter404 = stored()?.queue.length;
      next = () => empty(201);
      lvl();
      await sleep(1000);
      r.queueAfterRetry = stored()?.queue.length;
      return r;
    });

    // mini-roast 2: every row has its own rid; a resend after a timeout carries the same rid (the table's unique rid answers 409)
    await step('P8', async () => {
      const rids = calls.map((c) => c.body.rid);
      const n0 = calls.length;
      next = () => Promise.reject(new DOMException('timeout', 'TimeoutError'));
      lvl();
      await sleep(1000);
      next = () => empty(201);
      lvl();
      await sleep(1000);
      const mine = calls.slice(n0);
      const first = mine[0]?.body;
      const again = mine.filter((c) => c.body.seq === first?.seq);
      const bySeq = new Map();
      for (const c of calls) bySeq.set(c.body.seq, c.body.rid);
      return { rows: bySeq.size, distinctRids: new Set(bySeq.values()).size, allUuid: rids.every((r) => UUID.test(r)), sameSeqTwice: again.length === 2, sameRid: again.length === 2 && again[0].body.rid === again[1].body.rid, queue: stored()?.queue.length };
    });

    // row 9: the rebirth row goes at once with keepalive; one end row per page load
    await step('P7', async () => {
      const n0 = calls.length;
      M.end('rebirth');
      M.end('reset');
      await sleep(1000);
      const c = calls.slice(n0);
      const b = c[0]?.body ?? {};
      return { posts: c.length, kind: b.kind, keepalive: c[0]?.keepalive, runOk: b.run === g.state.stats.rebirths, owned: b.purchases?.[0]?.id === 'owned' && b.purchases[0].owned?.kick === g.state.upgrades.kick };
    });

    // row 11 on a fresh module instance (the main one already ended its page)
    await step('P7b', async () => {
      const R = await fresh('p7b');
      install(R);
      const n0 = calls.length;
      R.end('reset');
      await sleep(1000);
      const b = calls.slice(n0).find((c) => c.body.kind === 'reset');
      return { kind: b?.body.kind, keepalive: b?.keepalive, name: b?.body.name };
    });

    // rows 3, 20: a new instance reads the same id; blocked storage still sends and never throws
    await step('P9', async () => {
      const id = stored()?.id;
      const A = await fresh('p9a');
      install(A);
      let n0 = calls.length;
      A.level();
      await sleep(1000);
      const sameId = calls.slice(n0)[0]?.body.player === id && id === out.P2_id;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('blocked'); };
      let threw = false;
      try {
        const B = await fresh('p9b');
        install(B);
        n0 = calls.length;
        B.bought('kick', 9, 1);
        B.level();
        await sleep(1000);
      } catch { threw = true; } finally { Storage.prototype.setItem = setItem; }
      const blocked = calls.slice(n0);
      return { sameId, blockedPost: blocked.length, blockedPurchases: blocked[0]?.body.purchases.length, threw };
    });

    // D1: a yard purchase stays in the persisted yard buffer
    await step('D1', async () => {
      buy('speed');
      return { yardBuy: stored()?.buy.map((x) => x.id) };
    });

    // a 120-entry buffer from a build before the 'owned' entry: the row stays within 120 and still ends with the 'more' counter
    await step('P10', async () => {
      const legacy = Array.from({ length: 120 }, (_, i) => ({ id: 'kick', lvl: i, cost: 1 }));
      localStorage.setItem(KEY, JSON.stringify({ ...stored(), buy: legacy, queue: [] }));
      const n0 = calls.length;
      M.level();
      await sleep(1000);
      const p = calls.slice(n0)[0]?.body.purchases ?? [];
      const last = p[p.length - 1] ?? {};
      const real = p.slice(1).filter((x) => x.id !== 'more').length;
      return { length: p.length, first: p[0]?.id, last, total: real + (last.id === 'more' ? last.cost : 0) };
    });
  } else {
    // the yard's entry as the yard page leaves it: a known player and one purchase waiting for the next yard row
    const d1 = { id: '11111111-2222-4333-8444-555555555555', buy: [{ id: 'speed', lvl: 3, cost: 99 }] };
    localStorage.setItem(KEY, JSON.stringify({ id: d1.id, name: null, seq: 7, buy: d1.buy, ach: [], queue: [] }));
    install();
    // D2 (mini-roast 1): the daily page keeps its own buffers; the yard buffer survives untouched
    await step('D2', async () => {
      const before = JSON.stringify(stored()?.buy);
      buy('kick');
      lvl();
      await sleep(1000);
      const row = calls[0]?.body ?? {};
      M.end('daily');
      await sleep(1000);
      const endRow = calls.find((c) => c.body.kind === 'daily');
      return {
        yardBuyFromD1: d1?.buy.map((x) => x.id), yardBufferUntouched: JSON.stringify(stored()?.buy) === before && before === JSON.stringify(d1?.buy),
        levelDaily: row.daily, levelPurchases: (row.purchases ?? []).map((x) => x.id), samePlayer: row.player === d1?.id,
        end: { kind: endRow?.body.kind, daily: endRow?.body.daily, keepalive: endRow?.keepalive },
      };
    });
  }

  window.fetch = realFetch;
  const o = (k) => (typeof out[k] === 'object' && out[k]) || {};
  const j = (k) => JSON.stringify(out[k]);
  if (!isDaily) {
    // DEV: no POST, no localStorage entry (the log is off, so it writes nothing) and no menu line (online only)
    ok('P0', o('P0').store === 'LocalStore' && o('P0').calls === 0 && o('P0').key === false && o('P0').menuLine === false, j('P0'));
    const p2 = o('P2');
    ok('P2_shape', p2.posts === 1 && p2.url && p2.method === 'POST' && p2.prefer === 'return=minimal' && p2.keepalive === false && p2.keysOk && p2.kind === 'level' && p2.seq === 1 && p2.daily === false, p2.keys);
    ok('P2_values', p2.ridOk && p2.playerOk && p2.name === null && p2.levelOk && p2.gnomesOk && p2.moneyOk && p2.landOk && p2.buffersEmpty && p2.queue === 0, j('P2'));
    ok('P2_purchases', JSON.stringify((p2.purchases ?? []).map((x) => x[0])) === '["owned","kick","speed","fan"]' && (p2.purchases ?? []).every((x) => x[2] === 'number'), JSON.stringify(p2.purchases));
    const f = o('P2_fields');
    ok('P2_buy_fields', f.kick?.hole === f.afterKick?.hole && f.kick?.money === f.afterKick?.money && f.speed?.hole === f.afterSpeed?.hole && f.speed?.money === f.afterSpeed?.money && f.kick?.money > f.speed?.money, j('P2_fields'));
    const w = o('P2_owned');
    ok('P2_owned', w.id === 'owned' && w.lvl === 0 && w.cost === 0 && w.sameOwned && w.noZero && w.hasKick && w.samePlaced && (w.placed ?? {}).fan >= 1, j('P2_owned'));
    ok('P2_achievements', (p2.achievements ?? []).length === 1 && p2.achievements[0][0] === 'booze' && p2.achievements[0][1] === 'number' && typeof p2.achievements[0][2] === 'number', JSON.stringify(p2.achievements));
    ok('P3', o('P3').dStart === true && JSON.stringify(o('P3').throw) === '[1,0]' && o('P3').repeated === false, j('P3'));
    const d = o('P3');
    ok('P3_downgrade', d.down?.lvl === 0 && d.down?.hole === d.afterDown?.hole && d.down?.money === d.afterDown?.money && typeof d.down?.cost === 'number' && d.ownedDeep === 1 && d.ownedThrow === undefined, j('P3'));
    ok('P4', o('P4').stored === 'Tester' && o('P4').rowName === 'Tester' && o('P4').earlierNull === true, j('P4'));
    ok('P5', o('P5').queuedAfterNet === 1 && o('P5').timeAdvanced && o('P5').sentAfter === 2 && o('P5').seqOrder && o('P5').queueAfter === 0, j('P5'));
    ok('P6', o('P6').posts === 1 && o('P6').queueAfter400 === 0 && o('P6').queueAfter404 === 1 && o('P6').queueAfterRetry === 0, j('P6'));
    ok('P7', o('P7').posts === 1 && o('P7').kind === 'rebirth' && o('P7').keepalive === true && o('P7').runOk, j('P7'));
    ok('P7_owned', o('P7').owned === true, j('P7'));
    ok('P7b', o('P7b').kind === 'reset' && o('P7b').keepalive === true && o('P7b').name === 'Tester', j('P7b'));
    ok('P8', o('P8').rows > 1 && o('P8').rows === o('P8').distinctRids && o('P8').allUuid && o('P8').sameSeqTwice && o('P8').sameRid && o('P8').queue === 0, j('P8'));
    ok('P9', o('P9').sameId && o('P9').blockedPost === 1 && o('P9').blockedPurchases === 2 && o('P9').threw === false, j('P9'));
    ok('D1', JSON.stringify(o('D1').yardBuy) === '["speed"]', j('D1'));
    ok('P3_deep_shards', d.deepBuy?.shards === d.shardsLeft && !('money' in (d.deepBuy ?? {})), j('P3'));
    const t = o('P10');
    ok('P10_legacy_cap', t.length <= 120 && t.first === 'owned' && t.last?.id === 'more' && t.total === 120, j('P10'));
  } else {
    const d2 = o('D2');
    ok('D2_yard_untouched', d2.yardBufferUntouched === true, j('D2'));
    ok('D2_daily_row', d2.levelDaily === true && JSON.stringify(d2.levelPurchases) === '["owned","kick"]' && d2.samePlayer === true, j('D2'));
    ok('D2_end', d2.end?.kind === 'daily' && d2.end?.daily === true && d2.end?.keepalive === true, JSON.stringify(d2.end));
  }
  window.__done = JSON.stringify({ ...out, checks }, null, 1);
})();
