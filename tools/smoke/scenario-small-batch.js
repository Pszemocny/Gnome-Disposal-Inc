// Small batch (plan 2026-10-25-plan-small-batch.md, "Done when"): crate XP, Magnet Gun ball as one body, mushroom drops,
// Feeding Frenzy, Midas gold look, Eclipse Cap, Coin Magnet 10. One RESULT JSON with `checks` (PASS/FAIL lines).
// Run (about 4 min, URL_QUERY='' so the night look is on): URL_QUERY='' DEV_PORT=5199 CDP_PORT=9423 MAXPOLL=2400 node tools/smoke/smoke.mjs sb-out tools/smoke/scenario-small-batch.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const g = window.gnome;
const R = {};
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps;
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
// money of the C8 crate dump (two gnomes thrown in from 15 m, hole level 11) on the code before this batch,
// docs/ai-work/2026-10-21-balance-batch.md
const CRATE2_MONEY_BEFORE = 55.35;

// the tier roll before this batch, verbatim, for D1
function oldRollTier(holeLevel, minId = 'normal', rnd = Math.random) {
  const L = holeLevel - 1;
  const odds = [['heavy', Math.min(0.3, 0.05 + 0.025 * L)], ['massive', Math.max(0, Math.min(0.25, 0.03 * (holeLevel - 3)))]];
  const order = ['normal', 'heavy', 'massive'];
  const allowed = (id) => order.indexOf(id) >= order.indexOf(minId);
  let r = rnd();
  for (const [id, p] of odds) {
    if (!allowed(id)) continue;
    if (r < p) return id;
    r -= p;
  }
  return allowed('normal') ? 'normal' : minId;
}

setTimeout(() => { if (!window.__done) window.__done = JSON.stringify({ ...R, checks, timeout: true }); }, 580000);
(async () => {
  try {
    const { freshState, loadState, blockSaves, loadNotes } = await import('/src/core/state.ts');
    const { UPGRADE_BY_ID, upgradeCost } = await import('/src/data/upgrades.ts');
    const { rollTiers, massiveOdds, WEIGHT_TIERS } = await import('/src/data/gnomeTypes.ts');
    const rollTier = (...a) => rollTiers(...a).tier;
    const { MUSHROOM_BY_ID } = await import('/src/systems/buffs.ts');
    const { mulberry32 } = await import('/src/systems/daily.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    const { Events } = await import('/src/systems/events.ts');
    const { ICONS } = await import('/src/ui/icons.ts');
    const { prefs } = await import('/src/core/settings.ts');
    const { money } = await import('/src/core/format.ts');
    const { rng } = await import('/src/core/context.ts');
    const THREE = { Color: g.env.sun.color.constructor };
    blockSaves();
    const setState = (st) => { g.state = st; g.goals = new Goals(); g.goals.update = () => {}; };
    g.moods.update = () => {};
    g.contracts.update = () => {};
    const visitor0 = Events.prototype.spawnVisitor;
    g.events.spawnVisitor = () => {};
    g.events.next = 1e9;
    for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';
    let paid = 0;
    const burst0 = g.coins.burst.bind(g.coins);
    g.coins.burst = (v, o, p) => { paid += v; return burst0(v, o, p); };
    const bigTexts = [];
    const big0 = g.hud.bigText.bind(g.hud);
    g.hud.bigText = (t, ...a) => { bigTexts.push(t); return big0(t, ...a); };

    const s0 = freshState(); s0.money = 1e9; s0.holeLevel = 11; setState(s0);
    const S = () => g.state;
    const U = () => g.state.upgrades;
    g.paused = false;
    const V3 = g.camera.position.constructor;
    const Q = () => g.camera.quaternion.clone().set(0, 0, 0, 1);
    const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
    const gameWait = async (sec) => { const t0 = g.time; for (let i = 0; i < 5000 && g.time - t0 < sec; i++) await frames(1); };
    const spawnAt = (type, pos, opts = {}) => g.gnomes.spawn(type, pos, { tier: 'normal', ...opts });
    const placePlayer = (x, z, yaw = -Math.PI / 2, pitch = -0.38) => {
      g.player.body.setTranslation({ x, y: 1.2, z }, true);
      g.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.player.position.set(x, 1.2, z);
      g.player.yaw = yaw;
      g.player.pitch = pitch;
    };
    const fwd = () => new V3(-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw));
    const ahead = (dist, side = 0, y = 0.5) => { const f = fwd(); const r = new V3(-f.z, 0, f.x); return g.player.position.clone().addScaledVector(f, dist).addScaledVector(r, side).setY(y); };
    const waitGone = async (list, max = 600) => { for (let i = 0; i < max && list.some((x) => x.state !== 'gone'); i++) await frames(1); return list.every((x) => x.state === 'gone'); };
    const feed = async (fn) => {
      clearGnomes();
      const s = S(); s.holeXp = 0; g.hole.combo = 0; g.hole.comboTimer = 0; paid = 0;
      const list = await fn();
      const done = await waitGone(list);
      return { xp: +s.holeXp.toFixed(6), money: +paid.toFixed(4), done };
    };
    const fall = (list) => { for (const x of list) g.gnomes.startFalling(x); return list; };
    const J = () => 15 * (1 + 0.15 * (U().throw ?? 0));
    // hold gnomes as a Magnet Gun ball (no frame in between) and throw: velocity change per gnome
    const holdBall = (list) => { g.player.held = null; g.player.swarm = []; for (const x of list) { g.gnomes.hold(x); g.player.swarm.push({ g: x, caught: true, inBall: true, out: 0 }); } };
    const holdHand = (x) => { g.player.swarm = []; g.gnomes.hold(x); g.player.held = { body: x.body, gnome: x }; };
    const throwDv = (list) => {
      const v0 = list.map((x) => x.body.linvel());
      const d = g.player.dir;
      g.player.throwHeld();
      const dd = Math.hypot(d.x, d.y + 0.17, d.z);
      return list.map((x, i) => { const v = x.body.linvel(); return Math.hypot(v.x - v0[i].x, v.y - v0[i].y, v.z - v0[i].z) / dd; });
    };
    const within = (vals, want, tol) => vals.every((v) => Math.abs(v - want) <= tol * want);
    const r2 = (v) => +v.toFixed(2);

    placePlayer(14, 3);
    clearGnomes(); g.machines.clearAll();
    await frames(5);

    // ---- A: crate XP
    const intoCrate = (m, tweak) => {
      const n = spawnAt('classic', new V3(15, 1.5, 0));
      g.gnomes.hold(n); g.gnomes.drop(n, new V3(0, -0.1, 0));
      tweak?.(n);
      g.gnomes.stash(n); m.queue.push(n);
      return n;
    };
    const dumpCrate = (m) => { const h = g.env.hole; g.machines.updateCrate(m, { x: h.x, y: 0.5, z: h.z }, { x: 0, y: 0, z: 0, w: 1 }); };
    {
      let m = g.machines.place('box', new V3(10, 0.5, -6), Q());
      const a1 = await feed(() => { const l = [intoCrate(m), intoCrate(m)]; dumpCrate(m); return l; });
      ok('A1', near(a1.xp, 2) && near(a1.money, CRATE2_MONEY_BEFORE, 1e-3), `xp ${a1.xp} money ${a1.money} before ${CRATE2_MONEY_BEFORE}`);
      g.machines.clearAll();
      m = g.machines.place('box', new V3(10, 0.5, -6), Q());
      const a2 = await feed(() => {
        const l = [intoCrate(m, (n) => { n.thrownBy = 'machine'; }), intoCrate(m, (n) => { n.xpGroup = { n: 20 }; })];
        dumpCrate(m); return l;
      });
      ok('A2', near(a2.xp, 2), `xp ${a2.xp}`);
      g.machines.clearAll();
      // A3: the crate tipped next to the rim lets its gnomes out, they roll in: machine-fed
      const m2 = g.machines.place('box', new V3(10, 0.5, -6), Q());
      clearGnomes();
      S().holeXp = 0;
      const a = intoCrate(m2); const b = intoCrate(m2);
      g.machines.updateCrate(m2, { x: g.env.holeRadius + 2, y: 0.5, z: 0 }, { x: 1, y: 0, z: 0, w: 0 });
      fall([a, b]); await waitGone([a, b]);
      ok('A3', near(S().holeXp, 0.5), `xp ${r2(S().holeXp)} releasedBy ${a.thrownBy}`);
      g.machines.clearAll();
      const vm = g.machines.place('vacuum', new V3(10, 0, -8), Q());
      const a4 = await feed(() => {
        const n = spawnAt('classic', new V3(15, 1.5, 0));
        g.gnomes.hold(n); g.gnomes.drop(n, new V3(0, -0.1, 0));
        n.body.setTranslation({ x: vm.pos.x + 0.5, y: vm.pos.y + 1, z: vm.pos.z }, true);
        n.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        vm.t = 1; g.machines.effect(vm, 0.016);
        return [n];
      });
      ok('A4', near(a4.xp, 0.25), `xp ${a4.xp}`);
      g.machines.clearAll();
    }

    // ---- B: the Magnet Gun ball flies as one body
    U().magGun = 1; g.player.setGear('magGun'); g.input.mouse.left = false;
    placePlayer(14, 3, -Math.PI / 2, 0.2);
    await frames(3);
    const tiered = (tier, i = 0, type = 'classic') => spawnAt(type, ahead(2.5, (i - 1) * 0.4, 1.4), { tier, awake: false });
    {
      clearGnomes();
      const l = [tiered('normal', 0), tiered('heavy', 1), tiered('massive', 2)];
      const dv = throwDv((holdBall(l), l));
      ok('B1', within(dv, J() / 3, 0.1), `speeds [${dv.map(r2)}] J/3 ${r2(J() / 3)}`);
      clearGnomes();
      const l2 = [tiered('normal', 0), tiered('normal', 1), tiered('normal', 2)];
      holdBall(l2);
      const dv2 = throwDv(l2);
      ok('B2', within(dv2, J() / 1.2, 0.1), `speeds [${dv2.map(r2)}] J/1.2 ${r2(J() / 1.2)}`);
      clearGnomes();
      const h3 = tiered('massive', 1);
      holdHand(h3);
      const dv3 = throwDv([h3]);
      ok('B3', within(dv3, J() / 3, 0.01), `speed ${r2(dv3[0])} J/3 ${r2(J() / 3)} hand`);
      clearGnomes();
      // B6: a Fat gnome (type mass 6) of the massive class is 3 kg in the ball
      const fat = tiered('massive', 0, 'fat');
      const l6 = [fat, tiered('normal', 1)];
      holdBall(l6);
      const mMax = Math.max(...l6.map((x) => x.body.mass()));
      const dv6 = throwDv(l6);
      ok('B6', near(mMax, 3, 1e-3) && within(dv6, J() / 3, 0.1), `mMax ${r2(mMax)} speeds [${dv6.map(r2)}]`);
      clearGnomes();
      // B7: let go without a throw: no impulse
      const l7 = [tiered('normal', 0), tiered('massive', 2)];
      holdBall(l7);
      const v7 = l7.map((x) => x.body.linvel());
      g.player.release();
      const d7 = l7.map((x, i) => { const v = x.body.linvel(); return Math.hypot(v.x - v7[i].x, v.y - v7[i].y, v.z - v7[i].z); });
      ok('B7', d7.every((d) => d < 1e-6), `dv [${d7.map((d) => d.toExponential(1))}] release no impulse`);
      clearGnomes();
    }
    // B4: Trick Scope 3 on a mixed ball: the landing ring vs where the ball lands
    {
      U().scope = 3;
      clearGnomes();
      const l = [tiered('normal', 0), tiered('heavy', 1), tiered('massive', 2)];
      holdBall(l);
      g.input.mouse.left = true; g.player.prevLeft = true;
      await frames(12);
      const ring = g.player.land.position.clone();
      const landed = g.player.landed;
      g.input.mouse.left = false;
      g.player.throwHeld();
      g.player.prevLeft = false;
      const at = new Map();
      // landed = first ground contact; a gnome that lands on another one counts when it is low and slow
      for (let i = 0; i < 800 && at.size < l.length; i++) {
        await frames(1);
        for (const x of l) {
          if (at.has(x) || i < 3) continue;
          const p = x.body.translation(); const v = x.body.linvel();
          if (x.touchedGround || x.state === 'gone' || (p.y < 1 && Math.hypot(v.x, v.y, v.z) < 1)) at.set(x, new V3(p.x, 0, p.z));
        }
      }
      R.B4 = l.map((x) => ({ st: x.state, tg: x.touchedGround, y: r2(x.body.translation().y), at: at.has(x) ? [r2(at.get(x).x), r2(at.get(x).z)] : null }));
      R.B4ring = [r2(ring.x), r2(ring.z)];
      const mean = new V3(); for (const p of at.values()) mean.add(p); mean.divideScalar(at.size || 1);
      const dist = Math.hypot(mean.x - ring.x, mean.z - ring.z);
      ok('B4', landed && at.size === 3 && dist < 1, `ring within ${r2(dist)} m landed ${landed} n ${at.size}`);
      U().scope = 0;
      clearGnomes();
    }
    // B8 / D17: slip on a fast turn (Coil 2): 3 kg gnomes slip more than 1.2 kg ones; at Frenzy 5 every gnome is a 3 kg one
    const TURN = 0.5; // s for the 180° turn, as in the Magnet Gun note (2026-10-19, case 4)
    const slipRun = async (makeTier) => {
      clearGnomes();
      placePlayer(14, 3);
      await frames(2);
      const l = []; for (let i = 0; i < 12; i++) l.push(spawnAt('classic', ahead(3 + Math.floor(i / 4) * 0.4, ((i % 4) - 1.5) * 0.4, 0.5), { awake: false, tier: makeTier(i) }));
      g.player.grabCd = 0; g.input.mouse.left = true; g.input.mouse.leftPressed = true;
      for (let i = 0; i < 40 && l.some((x) => x.state !== 'held'); i++) await frames(1);
      await gameWait(0.8);
      const held = l.filter((x) => x.state === 'held');
      const y0 = g.player.yaw; const t0 = g.time;
      while (g.time - t0 < TURN) { await frames(1); g.player.yaw = y0 + Math.PI * Math.min(1, (g.time - t0) / TURN); }
      await gameWait(0.3);
      const by = (m) => { const h = held.filter((x) => Math.abs(x.body.mass() - m) < 0.01); return { held: h.length, slipped: h.filter((x) => x.state !== 'held').length }; };
      const out = { light: by(1.2), heavy: by(3), masses: [...new Set(l.map((x) => +x.body.mass().toFixed(2)))] };
      g.input.mouse.left = false; await frames(2);
      return out;
    };
    {
      U().magPower = 2;
      const trials = [await slipRun((i) => (i % 2 ? 'massive' : 'normal')), await slipRun((i) => (i % 2 ? 'massive' : 'normal'))];
      const lightRate = trials.reduce((a, t) => a + t.light.slipped, 0) / Math.max(1, trials.reduce((a, t) => a + t.light.held, 0));
      const heavyRate = trials.reduce((a, t) => a + t.heavy.slipped, 0) / Math.max(1, trials.reduce((a, t) => a + t.heavy.held, 0));
      ok('B8', heavyRate > lightRate, `slip 3kg ${r2(heavyRate)} > 1.2kg ${r2(lightRate)} ${JSON.stringify(trials)}`);
      U().frenzy = 5;
      const fr = await slipRun(() => undefined);
      const frRate = fr.heavy.slipped / Math.max(1, fr.heavy.held);
      ok('D17', fr.masses.length === 1 && fr.masses[0] === 3 && fr.light.held === 0 && frRate > lightRate, `frenzy5 masses ${fr.masses} slip ${r2(frRate)} (B8 3kg ${r2(heavyRate)}, 1.2kg ${r2(lightRate)})`);
      U().frenzy = 0; U().magPower = 0;
      clearGnomes();
    }

    // ---- C: mushroom drops follow the gnome count
    {
      const bonuses = [];
      const drop0 = g.mushrooms.maybeDrop.bind(g.mushrooms);
      const spawn0 = g.mushrooms.spawn.bind(g.mushrooms);
      let drops = 0;
      // a fixed sequence for the drop roll: (i + 0.5) / 200, one per eaten gnome
      let seqI = 0;
      g.mushrooms.spawn = () => { drops++; };
      g.mushrooms.maybeDrop = (pos, bonus) => {
        bonuses.push(bonus);
        const rnd = Math.random; const r = (seqI++ % 200 + 0.5) / 200;
        Math.random = () => r;
        try { drop0(pos, bonus); } finally { Math.random = rnd; }
      };
      // hand: thrownBy 'player' as a player throw sets it (no throwPos, so no trick bonus); otherwise the gnome counts
      // as fed (walk-in/robot/machine) and drops at 1/4 (PP 2026-10-22 "g8. a")
      const eatN = async (type, n, hand = true) => { seqI = 0; drops = 0; bonuses.length = 0; for (let i = 0; i < n; i++) { const x = spawnAt(type, new V3(0, -10, 0)); if (x) { if (hand) x.thrownBy = 'player'; g.hole.combo = 0; g.hole.consume(x); } } return { drops, bonuses: [...new Set(bonuses)] }; };
      clearGnomes();
      const classic = await eatN('classic', 200);
      const golden = await eatN('golden', 200);
      const wizard = await eatN('wizard', 200);
      const fedIn = await eatN('classic', 200, false);
      ok('C1', classic.bonuses.join() === '1' && golden.drops === classic.drops && golden.bonuses.join() === '1', `golden ${golden.drops} == classic ${classic.drops} drops, bonus ${golden.bonuses}`);
      ok('C2', classic.drops > 0 && wizard.drops === 6 * classic.drops, `wizard ${wizard.drops} = 6x ${classic.drops}`);
      ok('C4', fedIn.bonuses.join() === '0.25' && fedIn.drops < classic.drops, `fed-in bonus ${fedIn.bonuses} = 1/4 of hand ${classic.bonuses}, drops ${fedIn.drops} < ${classic.drops}`);
      // C3: Golden Hour retypes classic gnomes into golden ones: each pays the classic chance
      clearGnomes();
      const l = []; for (let i = 0; i < 10; i++) l.push(spawnAt('classic', ahead(4 + i * 0.3, 2, 0.5), { awake: false }));
      g.events.start('golden');
      await gameWait(0.8);
      const gold = g.gnomes.list.filter((x) => x.type.id === 'golden');
      bonuses.length = 0;
      for (const x of gold) { x.thrownBy = 'player'; g.hole.consume(x); }
      const per = bonuses.map((b) => 0.025 * (1 + (U().mushChance ?? 0) * 0.3) * b);
      g.events.goldenHour = 0.001; await frames(3);
      ok('C3', gold.length === 10 && per.every((p) => near(p, 0.025)), `goldenHour per-gnome ${[...new Set(per)]} n ${gold.length}`);
      g.mushrooms.maybeDrop = drop0; g.mushrooms.spawn = spawn0;
      clearGnomes();
    }

    // ---- D: Feeding Frenzy
    {
      // D1: the same tier for every draw at Frenzy 0 (hole 4, 8, 12 and the daily seed stream from hole 6)
      const same = (seed, hl, minId) => { const a = mulberry32(seed); const b = mulberry32(seed); for (let i = 0; i < 10000; i++) if (rollTier(hl, minId, b, 0).id !== oldRollTier(hl, minId, a)) return false; return true; };
      const seqOk = [4, 8, 12].every((hl) => same(12345, hl, 'normal') && same(777, hl, 'heavy')) && same(0x5eed ^ 0x9e3779b9, 6, 'normal');
      const src = await (await fetch('/src/data/gnomeTypes.ts?raw')).text();
      const rndCalls = (src.match(/rnd\(\)/g) ?? []).length;
      ok('D1', seqOk && rndCalls === 1, `sequence identical hole 4/8/12 + daily seed: ${seqOk}, rnd() calls ${rndCalls}`);
      const r = mulberry32(99); let mz = 0; for (let i = 0; i < 20000; i++) if (rollTier(4, 'normal', r, 3).id === 'massive') mz++;
      ok('D2', near(mz / 20000, 0.03 + 0.97 * 0.6, 0.01), `massive ${(mz / 20000).toFixed(3)} want 0.612 ±0.01`);

      // D3 / D4 / D5: Frenzy 5, factory gnomes
      S().holeLevel = 4; U().frenzy = 5; U().permit = 5;
      clearGnomes();
      await frames(2);
      const before = new Set(g.gnomes.list);
      g.factory.burst(50);
      for (let i = 0; i < 1500 && g.factory.queue.length; i++) await frames(1);
      await frames(2);
      const made = g.gnomes.list.filter((x) => !before.has(x) && x.type.id !== 'king');
      ok('D3', made.length >= 50 && made.every((x) => x.tier.id === 'massive'), `${made.filter((x) => x.tier.id === 'massive').length}/${made.length} massive`);
      clearGnomes();
      const fat = g.factory.spawnNow('fat');
      ok('D4', fat?.tier.id === 'massive', `fat ${fat?.tier.id}`);
      clearGnomes();
      S().holeLevel = 11;
      const king = g.factory.spawnNow('king');
      ok('D5', king?.tier.id === 'normal' && near(king?.body.mass(), 40, 1e-3), `king ${king?.tier.id} ${r2(king?.body.mass() ?? 0)}kg`);
      clearGnomes();
      // D6: rain gnomes at Frenzy 5
      const b6 = new Set(g.gnomes.list);
      g.events.start('rain');
      await gameWait(4.2);
      const rain = g.gnomes.list.filter((x) => !b6.has(x) && x.type.id !== 'king');
      ok('D6', rain.length > 5 && rain.every((x) => x.tier.id === 'massive'), `rain ${rain.filter((x) => x.tier.id === 'massive').length}/${rain.length} massive`);
      clearGnomes();
      // D13: the night Shadow visitor
      visitor0.call(g.events);
      const sh = g.gnomes.list.find((x) => x.type.id === 'shadow');
      ok('D13', sh?.tier.id === 'massive', `shadow ${sh?.tier.id} at frenzy 5`);
      clearGnomes();
      U().frenzy = 0;
      // D7: Golden Hour retype keeps a heavy gnome heavy
      const hv = spawnAt('classic', ahead(4, 0, 0.5), { tier: 'heavy', awake: false });
      const gv = g.gnomes.retype(hv, 'golden');
      ok('D7', gv?.tier.id === 'heavy', `retype keeps ${gv?.tier.id}`);
      clearGnomes();
      // D8: shop node, prices, effect line at hole 4
      S().holeLevel = 4;
      g.shop.tab = 'Factory'; g.shop.render();
      const node = document.querySelector('.shop [data-buy="frenzy"]');
      const desc0 = g.shop.rowData(UPGRADE_BY_ID.frenzy).desc;
      const prices = []; for (let i = 0; i < 5; i++) { const m0 = S().money; g.shop.buy('frenzy'); prices.push(Math.round(m0 - S().money)); }
      const frU = UPGRADE_BY_ID.frenzy;
      ok('D8', !!node && frU.hole === 4 && prices.join() === '2000,10000,45000,210000,1000000' && desc0.includes('now: 3% massive'), `prices ${prices} hole ${frU.hole} node ${!!node} effect "${desc0.match(/\(now:.*\)/)?.[0]}"`);
      U().frenzy = 0;
      // D9: an old save without the key
      const KEY = 'gnome-boozed-save-v1';
      const n0 = loadNotes.length;
      const old = freshState(); old.upgrades.permit = 2; localStorage.setItem(KEY, JSON.stringify(old));
      const L9 = loadState(); localStorage.removeItem(KEY);
      ok('D9', (L9.upgrades.frenzy ?? 0) === 0 && loadNotes.length === n0, `frenzy ${L9.upgrades.frenzy ?? 0} notes ${loadNotes.length - n0}`);
      // D10 / D11: HEAVY HAUL text and XP with Frenzy owned
      S().holeLevel = 11;
      const eat = (tier) => { const x = spawnAt('classic', ahead(3, 0, 0.5), { tier, awake: false }); const xp0 = S().holeXp; bigTexts.length = 0; g.hole.consume(x); return { xp: S().holeXp - xp0, text: bigTexts.some((t) => String(t).includes('HEAVY HAUL')) }; };
      U().frenzy = 1;
      const h0 = S().stats.hauls;
      const m1 = eat('massive'); const n1 = eat('normal');
      const h1 = S().stats.hauls;
      // D11: factory gnomes at Frenzy 1, hole 11 (heavy 0.3, massive 0.24 -> 0.392): the tier draw is the 3rd rng.spawn call
      // of spawnNow (two velocity jitters first). A natural tier pays its XP, only the share Frenzy adds pays x1.
      const factoryEat = (draw) => {
        const rs = rng.spawn; const seq = [0.5, 0.5, draw]; rng.spawn = () => (seq.length ? seq.shift() : 0.5);
        const x = g.factory.spawnNow('classic'); rng.spawn = rs;
        S().holeXp = 0; g.hole.consume(x); return { tier: x.tier.id, xp: S().holeXp };
      };
      const fh = factoryEat(0.01); const fm = factoryEat(0.4); const fu = factoryEat(0.6);
      U().frenzy = 0;
      const m0 = eat('massive'); const nn0 = eat('normal');
      ok('D10', h1 === h0 + 1 && !m1.text && m0.text, `hauls+${h1 - h0} text(L1) ${m1.text} text(L0) ${m0.text}`);
      ok('D11', fh.tier === 'heavy' && near(fh.xp, 1.6 * n1.xp) && fm.tier === 'massive' && near(fm.xp, 2.3 * n1.xp) && fu.tier === 'massive' && near(fu.xp, n1.xp) && near(m0.xp, 2.3 * nn0.xp, 1e-6),
        `frenzy1 natural heavy ${fh.tier} ${r2(fh.xp)} = 1.6 x ${r2(n1.xp)}, natural massive ${fm.tier} ${r2(fm.xp)} = 2.3x, frenzy-made ${fu.tier} ${r2(fu.xp)} = 1x; frenzy0 ${r2(m0.xp)} = 2.3 x ${r2(nn0.xp)}`);
      clearGnomes();
      // D12: Frenzy compensates the throw: J / 1.2 for a 3 kg hand throw and a mixed ball; Frenzy bought while the ball is held
      U().frenzy = 5;
      const hh = tiered('massive', 1); holdHand(hh);
      const d12a = throwDv([hh]);
      clearGnomes();
      U().frenzy = 0;
      const lb = [tiered('normal', 0), tiered('heavy', 1), tiered('massive', 2)];
      holdBall(lb);
      U().frenzy = 1;
      const d12b = throwDv(lb);
      U().frenzy = 0;
      ok('D12', within(d12a, J() / 1.2, 0.05) && within(d12b, J() / 1.2, 0.1), `frenzy5 3kg hand ${r2(d12a[0])}, frenzy1 mixed ball [${d12b.map(r2)}], J/1.2 ${r2(J() / 1.2)}`);
      clearGnomes();
      // D19: max Strong Arm ignores weight (PP 2026-10-21): a massive gnome by hand and in a ball flies as a normal one,
      // the Trick Scope preview uses the same mass; one level lower the massive one stays slower
      const armMax = UPGRADE_BY_ID.throw.max; const predict0 = g.player.predict; const preM = [];
      g.player.predict = function (s, v, m, gn) { preM.push(m); return predict0.call(this, s, v, m, gn); };
      U().scope = 1;
      const arm = (L) => {
        U().throw = L;
        const hn = tiered('normal', 1); holdHand(hn); const n = throwDv([hn])[0]; clearGnomes();
        const hm = tiered('massive', 1); holdHand(hm); g.player.updateAids(); const m = throwDv([hm])[0]; clearGnomes();
        const ball = [tiered('massive', 0), tiered('massive', 2)]; holdBall(ball); g.player.updateAids(); const b = throwDv(ball); clearGnomes();
        return { n, m, b, pre: preM.splice(0) };
      };
      const aMax = arm(armMax); const aLow = arm(armMax - 1);
      g.player.predict = predict0; U().throw = 0; U().scope = 0;
      // the ball's +-0.06 spread moves each speed by up to 10 %, as in B1
      ok('D19', within([aMax.m], aMax.n, 0.02) && within(aMax.b, aMax.n, 0.1) && aMax.pre.every((m) => near(m, 1.2, 1e-6)) && aLow.m < 0.5 * aLow.n && within(aLow.b, aLow.m, 0.1) && aLow.pre.every((m) => near(m, 3, 1e-3)),
        `L${armMax}: normal ${r2(aMax.n)} massive hand ${r2(aMax.m)} ball [${aMax.b.map(r2)}] preview m [${aMax.pre.map(r2)}]; L${armMax - 1}: normal ${r2(aLow.n)} massive hand ${r2(aLow.m)} ball [${aLow.b.map(r2)}] preview m [${aLow.pre.map(r2)}]`);
      // D14: the HEAVY HAUL contract is not offered with Frenzy owned
      const haul = g.contracts.defs.find((d) => d.id === 'haul');
      S().holeLevel = 6;
      const C = g.contracts; const cProto = Object.getPrototypeOf(C);
      const offered = () => { let n = 0; for (let i = 0; i < 200; i++) { cProto.roll.call(C); if (C.current?.id === 'haul') n++; } C.current = null; C.leaving = true; return n; };
      U().frenzy = 1; const off1 = offered(); U().frenzy = 0; const on0 = offered();
      ok('D14', off1 === 0 && on0 > 0, `haul offered in 200 rolls: frenzy1 ${off1} frenzy0 ${on0}`);
      // D18: buying Frenzy during a running HEAVY HAUL keeps the contract running
      const toasts = []; const toast0 = g.hud.toast; g.hud.toast = (t, ...a) => (toasts.push(t), toast0.call(g.hud, t, ...a));
      Object.assign(C, { started: true, current: haul, target: 1, timeLeft: 90, base: haul.value(), have: 0, leaving: false, popT: 0 });
      cProto.update.call(C, 0.02);
      const run0 = C.current?.id;
      g.shop.buy('frenzy');
      const lv18 = U().frenzy ?? 0;
      for (let i = 0; i < 5; i++) cProto.update.call(C, 0.02);
      const run1 = C.current?.id;
      g.hud.toast = toast0;
      Object.assign(C, { current: null, leaving: true, wait: 1e9 });
      U().frenzy = 0;
      ok('D18', run0 === 'haul' && lv18 === 1 && run1 === 'haul' && !toasts.includes('Contract failed'), `before ${run0} frenzy ${lv18} after ${run1} toasts ${JSON.stringify(toasts)}`);
      // D20: every big combo text (15, 30, 60, 100, 200) spits one mushroom, Nice! (5) does not (PP 2026-10-21 "C")
      {
        const sp = g.mushrooms.spawn.bind(g.mushrooms); const at = [];
        g.mushrooms.spawn = (def, pos, ...r) => { at.push(g.hole.combo); return sp(def, pos, ...r); };
        const md = g.mushrooms.maybeDrop; g.mushrooms.maybeDrop = () => {}; // no random or lesson drops
        for (const to of [5, 15, 30, 60, 100, 200]) {
          g.hole.combo = to - 1; g.hole.comboTimer = 5; g.buffs.timers.delete('combo');
          g.hole.consume(spawnAt('classic', ahead(3, 0, 0.5), { awake: false }));
        }
        g.mushrooms.maybeDrop = md; g.mushrooms.spawn = sp; g.hole.combo = 0;
        ok('D20', JSON.stringify(at) === '[15,30,60,100,200]', `mushrooms at combo ${JSON.stringify(at)}`);
      }
      // D15: lesson 4 completes once with Frenzy 5
      const st = S(); const gd0 = st.goalsDone; st.goalsDone = ['coins']; st.goalStart = {};
      const goals = new Goals(); g.goals = goals;
      U().frenzy = 5;
      const money15 = st.money;
      const mk = () => { const x = spawnAt('classic', ahead(3, 0, 0.5), { awake: false }); g.hole.consume(x); };
      mk(); goals.update(); mk(); goals.update();
      const haulDone = st.goalsDone.filter((id) => id === 'haul').length;
      U().frenzy = 0;
      ok('D15', haulDone === 1, `lesson haul completes ${haulDone}x at frenzy 5 (money +${Math.round(st.money - money15)})`);
      st.goalsDone = gd0; g.goals = new Goals(); g.goals.update = () => {};
      clearGnomes();
    }

    // ---- E: Midas gold look
    placePlayer(14, 3, -Math.PI / 2, -0.25);
    await frames(2);
    const sample = async (sec) => { const out = []; const t0 = g.time; for (let i = 0; i < 5000 && g.time - t0 < sec; i++) { await frames(1); out.push({ t: g.time - t0, v: g.gnomes.goldShade }); } return out; };
    const tAt = (sm, pred) => sm.find((p) => pred(p.v))?.t ?? Infinity;
    const rising = (sm) => { for (let i = 1; i < sm.length && sm[i - 1].v < 0.999; i++) if (!(sm[i].v > sm[i - 1].v)) return false; return true; };
    {
      clearGnomes();
      for (let i = 0; i < 8; i++) spawnAt(i % 2 ? 'boom' : 'classic', ahead(3 + Math.floor(i / 4), (i % 4) - 1.5, 0.5), { awake: false });
      g.buffs.timers.clear(); g.buffs.midasLeft = 0; await sample(0.5);
      g.buffs.apply('midas');
      const e1 = await sample(0.4);
      const t95 = tAt(e1, (v) => v >= 0.95);
      ok('E1', e1.length >= 10 && rising(e1) && t95 <= 0.3, `gold 0→0.95 in ${r2(t95)} s, frames ${e1.length}, peak ${r2(e1[e1.length - 1].v)}`);
      await shot('midas-peak');
      g.buffs.midasLeft = 0;
      const e2 = await sample(0.45);
      ok('E2', tAt(e2, (v) => v < 0.05) <= 0.4, `gold <0.05 in ${r2(tAt(e2, (v) => v < 0.05))} s`);
      g.buffs.timers.clear();
      g.buffs.apply('rainbow');
      const e3 = await sample(0.3);
      ok('E3', e3[e3.length - 1].v > 0.9 && e3[e3.length - 1].v > e3[0].v, `rainbow gold rises ${r2(e3[0].v)} → ${r2(e3[e3.length - 1].v)}`);
      g.buffs.timers.clear(); g.buffs.midasLeft = 0; g.events.rain = 0; await sample(0.5); clearGnomes();
      for (let i = 0; i < 8; i++) spawnAt(i % 2 ? 'boom' : 'classic', ahead(3 + Math.floor(i / 4), (i % 4) - 1.5, 0.5), { awake: false });
      const q0 = prefs.quality; prefs.quality = 'low';
      g.buffs.apply('midas');
      const e4 = await sample(0.35);
      prefs.quality = q0;
      ok('E4', e4[e4.length - 1].v > 0.95, `low quality gold rises to ${r2(e4[e4.length - 1].v)}`);
      const gm = g.gnomes.meshes.get('golden').material;
      ok('E5', near(gm.metalness, 0.3) && near(gm.roughness, 0.35), `golden metalness ${gm.metalness} roughness ${gm.roughness}`);
      // E6: Midas during Golden Hour
      const errs0 = errors.length;
      g.events.start('golden');
      await gameWait(1);
      const goldN = g.gnomes.list.filter((x) => x.type.id === 'golden').length;
      g.events.goldenHour = 0.001; await gameWait(0.8);
      ok('E6', errors.length === errs0 && goldN > 0, `errors ${errors.length - errs0}, golden ${goldN} during Midas (LOGS must be empty)`);
      // E7: 15 eaten fast: the counter is 0, the 30 s timer still runs
      g.buffs.midasLeft = 15; await sample(0.3);
      for (let i = 0; i < 15; i++) g.buffs.valueMult();
      const e7 = await sample(0.45);
      ok('E7', g.buffs.midasLeft === 0 && (g.buffs.timers.get('midas') ?? 0) > 0 && e7[e7.length - 1].v < 0.05, `midasLeft ${g.buffs.midasLeft} timer ${r2(g.buffs.timers.get('midas') ?? 0)} gold ${r2(e7[e7.length - 1].v)}`);
      // E8: timer over, counter left: still gold
      g.buffs.timers.set('midas', 0); g.buffs.midasLeft = 15;
      const e8 = await sample(0.4);
      ok('E8', !g.buffs.active('midas') && e8[e8.length - 1].v > 0.95, `timer ended, midasLeft ${g.buffs.midasLeft}: gold ${r2(e8[e8.length - 1].v)}`);
      // E9: the hat stays out of the tint; screenshot at night with hat glow on
      const fake = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <emissivemap_fragment>' };
      g.gnomes.meshes.get('classic').material.onBeforeCompile(fake);
      const hatFree = (fake.fragmentShader.match(/\(1\.0 - vGlow\)/g) ?? []).length === 2 && fake.uniforms.gold !== undefined;
      g.env.night = 1; S().holeLevel = 11; g.env.dayClock = 170;
      await gameWait(0.6);
      await shot('midas-hats');
      ok('E9', hatFree, `shader has "(1.0 - vGlow)" on tint and emissive: ${hatFree}; screenshot midas-hats.png (night ${r2(g.env.nightShade)})`);
      g.buffs.midasLeft = 0; g.env.night = 0; g.env.dayClock = 0;
      await sample(0.5);
      clearGnomes();
    }

    // ---- F: Eclipse Cap
    {
      g.buffs.timers.clear(); g.buffs.midasLeft = 0;
      S().holeLevel = 11; g.env.dayClock = 0; g.env.night = 0; g.env.shade = 0;
      await gameWait(0.3);
      // F1: walk over it
      g.mushrooms.spawn(MUSHROOM_BY_ID.daynight, g.player.position.clone().setY(0), false);
      for (let i = 0; i < 60 && !g.buffs.active('daynight'); i++) await frames(1);
      await frames(3);
      const row = g.hud.fx.el.textContent.includes('Eclipse Cap');
      const lg = g.legend.mushrooms();
      const card = lg.includes('Eclipse Cap') && lg.includes('8.5% of mushroom drops');
      ok('F1', g.buffs.active('daynight') && g.buffs.valueMult() === 2 && row && card, `active ${g.buffs.active('daynight')} valueMult ${g.buffs.valueMult()} row "Eclipse Cap" ${row} legend 8.5% ${card}`);
      // F2 / F9 / F10: 16 s of the cycle from the pickup (day 5 s, fade 5 s, night 5 s, fade back); the sun colour blends with the shade on every frame
      const SD = new THREE.Color(0xfff2d8); const SN = new THREE.Color(0x9ab0ff);
      const sm = []; let sunErr = 0;
      const eT0 = g.env.eclipseT;
      while (g.env.eclipseT < 16) {
        await frames(1);
        const n = g.env.nightShade;
        sm.push({ t: g.env.eclipseT, v: n });
        sunErr = Math.max(sunErr, Math.abs(g.env.sun.color.r - (SD.r + (SN.r - SD.r) * n)));
      }
      const win = (a, b) => sm.filter((p) => p.t >= a && p.t <= b).map((p) => p.v);
      const dayHold = win(0.5, 5); const fade = win(5.5, 9.5); const nightHold = win(11, 15);
      const fadeMid = fade.filter((v) => v > 0.05 && v < 0.95).length;
      ok('F2', eT0 < 1 && dayHold.length >= 10 && fade.length >= 10 && nightHold.length >= 10 && Math.max(...dayHold) < 0.05 && fadeMid >= 10 && Math.min(...nightHold) > 0.95,
        `start ${r2(eT0)} s; day hold max ${r2(Math.max(...dayHold))} (${dayHold.length} frames), fade strictly between ${fadeMid}/${fade.length} frames, night hold min ${r2(Math.min(...nightHold))} (${nightHold.length} frames)`);
      const turns = []; let dir = 0;
      for (let i = 1; i < sm.length; i++) { const d = sm[i].v - sm[i - 1].v; if (Math.abs(d) < 1e-4) continue; const s = Math.sign(d); if (dir && s !== dir) turns.push(sm[i - 1].t); dir = s; }
      ok('F9', turns.length === 1 && turns[0] >= 14.5, `direction changes ${turns.length} at ${turns.map(r2)} s (one, when the night hold ends at 15 s)`);
      const maxStep = Math.max(...sm.slice(1).map((p, i) => Math.abs(p.v - sm[i].v)));
      ok('F10', sunErr < 0.02 && maxStep < 0.1, `sun.r tracks n ±${sunErr.toFixed(4)} over 16 s, max shade step per frame ${r2(maxStep)}`);
      R.F = { turns: turns.map(r2), frames: sm.length, curve: sm.filter((_, i) => i % 10 === 0).map((p) => [r2(p.t), r2(p.v)]) };
      // F3: the effect ends during the clock's day, then during its night
      g.buffs.timers.set('daynight', 0);
      await gameWait(1);
      const dayEnd = Math.abs(g.env.shade - g.env.night);
      g.env.dayClock = 170; g.env.night = 1;
      g.buffs.timers.set('daynight', 3); await gameWait(3.2);
      await gameWait(1);
      const nightEnd = Math.abs(g.env.shade - g.env.night);
      ok('F3', dayEnd < 0.05 && nightEnd < 0.05, `shade≈night after end: day ${r2(dayEnd)} night ${r2(nightEnd)} (night ${r2(g.env.night)})`);
      g.env.dayClock = 0; g.env.night = 0; await gameWait(1);
      // F4: hole level 1 (no clock) reaches night too (cycle skipped ahead to the end of the day hold)
      S().holeLevel = 1; g.buffs.timers.set('daynight', 5);
      await frames(1); g.env.eclipseT = 8.5;
      const s4 = []; const t4 = g.time; while (g.time - t4 < 3) { await frames(1); s4.push(g.env.nightShade); }
      ok('F4', Math.max(...s4) > 0.9 && s4[0] < 0.9, `level 1 first ${r2(s4[0])} max ${r2(Math.max(...s4))}`);
      // F11: pickup during the clock's night: the timer starts at 0 and the sky fades to the day hold, no jump
      g.buffs.timers.set('daynight', 0);
      S().holeLevel = 11; g.env.dayClock = 170; g.env.night = 1; await gameWait(1.5);
      const b = g.env.nightShade;
      g.buffs.apply('daynight');
      const f = []; const tf = g.time; while (g.time - tf < 1) { await frames(1); f.push(g.env.nightShade); }
      const steps = Math.max(...f.map((v, i) => Math.abs(v - (i ? f[i - 1] : b))));
      const restart = g.env.eclipseT;
      // the existing damp (lambda 6) carries this one: about 0.3 s, at most 0.26 per 0.05 s frame
      ok('F11', b > 0.95 && steps < 0.3 && f.filter((v) => v > 0.05 && v < 0.95).length >= 3 && f[f.length - 1] < 0.05 && restart < 1.2,
        `before ${r2(b)} first ${r2(f[0])} last ${r2(f[f.length - 1])} max step ${r2(steps)} timer ${r2(restart)} s`);
      g.buffs.timers.set('daynight', 0); g.env.dayClock = 0; g.env.night = 0; await gameWait(1.2);
      // F5: Low quality: no swing, money x2
      S().holeLevel = 11;
      const q0 = prefs.quality; prefs.quality = 'low';
      g.buffs.apply('daynight');
      let low = 0; const t5 = g.time; while (g.time - t5 < 2) { await frames(1); low = Math.max(low, g.env.nightShade); }
      ok('F5', low === 0 && g.buffs.valueMult() === 2, `low shade ${low} mult ${g.buffs.valueMult()}`);
      prefs.quality = q0; g.buffs.timers.set('daynight', 0);
      // F6: level 6, clock day, 20 s of flicker, every visitor roll succeeds: no Shadow, isNight false
      clearGnomes();
      S().holeLevel = 6; g.env.dayClock = 0; g.env.night = 0;
      g.events.spawnVisitor = visitor0;
      const upd0 = g.events.update.bind(g.events);
      g.events.update = (dt) => { const rnd = Math.random; Math.random = () => 0; try { upd0(dt); } finally { Math.random = rnd; } };
      g.buffs.apply('daynight'); g.buffs.timers.set('daynight', 20);
      let nightSeen = false; let shadeMax = 0; const t6 = g.time;
      while (g.time - t6 < 20) { await frames(1); nightSeen ||= g.env.isNight; shadeMax = Math.max(shadeMax, g.env.nightShade); }
      const shadows = g.gnomes.list.filter((x) => x.type.id === 'shadow').length;
      g.events.update = upd0; g.events.spawnVisitor = () => {};
      ok('F6', shadows === 0 && !nightSeen && shadeMax > 0.9, `no visitor ${shadows} isNight ${nightSeen} (sky shade max ${r2(shadeMax)})`);
      g.buffs.timers.clear();
      // F7 / F8
      g.buffs.timers.set('rainbow', 5);
      ok('F7', g.buffs.active('daynight'), `rainbow includes ${g.buffs.active('daynight')}`);
      g.buffs.timers.clear();
      g.buffs.apply('daynight'); g.buffs.apply('daynight');
      ok('F8', near(g.buffs.timers.get('daynight'), 40, 0.1), `timer ${r2(g.buffs.timers.get('daynight'))}`);
      g.buffs.timers.clear(); g.events.rain = 0;
      S().holeLevel = 11;
      await gameWait(1);
    }

    // ---- G: Coin Magnet 10
    {
      clearGnomes(); g.coins.clearAll();
      S().holeLevel = 11;
      U().magnetRange = 0;
      const prices = []; for (let i = 0; i < 10; i++) { const m0 = S().money; g.shop.buy('magnetRange'); prices.push(Math.round(m0 - S().money)); }
      g.shop.tab = 'Bonuses'; g.shop.render();
      const piggyNode = document.querySelector('.shop [data-buy="piggy"]');
      ok('G1', prices.join() === '20,44,97,213,469,1340,3833,10961,31347,89651' && !piggyNode && U().magnetRange === 10, `prices ${prices} noPiggyNode ${!piggyNode}`);
      // G2: level 10, a coin far away flies to the bank by itself, greedy gnomes find nothing
      const far = g.player.position.clone().add(new V3(-20, 0.5, 8));
      const m2 = S().money;
      g.coins.burst(50, far, 0.3);
      await gameWait(1);
      const free = g.coins.nearestFree(far, 50);
      await gameWait(2.5);
      const left = g.coins.list.filter((c) => !c.flying).length;
      ok('G2', free === null && left === 0 && S().money > m2, `auto-collect left ${left} money +${Math.round(S().money - m2)}, nearestFree ${free}`);
      // G3: level 9: no auto-collect, greedy can steal
      U().magnetRange = 9;
      g.coins.burst(50, far, 0.3);
      await gameWait(4);
      const stays = g.coins.list.filter((c) => !c.flying).length;
      const steal = g.coins.nearestFree(far, 50);
      ok('G3', stays > 0 && !!steal, `level 9 no auto (${stays} coins on the grass), steal ok ${!!steal}`);
      g.coins.clearAll();
      ok('G4', UPGRADE_BY_ID.piggy === undefined && ICONS.piggy === undefined, `upgrade ${UPGRADE_BY_ID.piggy} icon ${ICONS.piggy}`);
      // G5 / G6: old save with the Piggy Bank and Coin Magnet 6
      const KEY = 'gnome-boozed-save-v1';
      const n0 = loadNotes.length;
      const old = freshState(); old.money = 100; old.upgrades.piggy = 1; old.upgrades.magnetRange = 6;
      localStorage.setItem(KEY, JSON.stringify(old));
      const L5 = loadState(); localStorage.removeItem(KEY);
      const note = loadNotes.slice(n0).join(' ');
      ok('G5', L5.money === 900 && L5.upgrades.piggy === undefined && L5.upgrades.magnetRange === 6 && note.includes('Piggy Bank was removed'), `money ${L5.money} piggy ${L5.upgrades.piggy} magnetRange ${L5.upgrades.magnetRange} note "${note}"`);
      U().magnetRange = 6;
      const head = g.shop.upgradeItem(UPGRADE_BY_ID.magnetRange, []).view.head;
      ok('G6', upgradeCost(UPGRADE_BY_ID.magnetRange, 6) === 3833 && head.includes(money(3833)), `magnetRange 6 next ${upgradeCost(UPGRADE_BY_ID.magnetRange, 6)} head "${head}"`);
      U().magnetRange = 9; const d9 = g.shop.rowData(UPGRADE_BY_ID.magnetRange).desc;
      U().magnetRange = 10; const d10 = g.shop.rowData(UPGRADE_BY_ID.magnetRange).desc;
      ok('G7', d9.includes('now: 12.8 m pickup, next: 14.0 m pickup, coins fly to the bank') && d10.includes('now: 14.0 m pickup, coins fly to the bank'), `"${d9.match(/\(now:.*\)/)?.[0]}" / "${d10.match(/\(now:.*\)/)?.[0]}"`);
      // G8: rebirth with Coin Magnet 10 and Frenzy 5
      U().frenzy = 5;
      const next = freshState(S());
      const keep = g.state;
      setState(next); next.money = 1e9; next.holeLevel = 4;
      const lv = [next.upgrades.magnetRange ?? 0, next.upgrades.frenzy ?? 0];
      g.coins.burst(50, far, 0.3);
      await gameWait(2);
      const steal8 = !!g.coins.nearestFree(far, 50);
      const haulOk = g.contracts.defs.find((d) => d.id === 'haul').ok();
      bigTexts.length = 0;
      g.hole.consume(spawnAt('classic', ahead(3, 0, 0.5), { tier: 'massive', awake: false }));
      const text8 = bigTexts.some((t) => String(t).includes('HEAVY HAUL'));
      ok('G8', lv.join() === '0,0' && steal8 && haulOk && text8, `rebirth magnetRange ${lv[0]} frenzy ${lv[1]} steal ok ${steal8} haul offered ${haulOk} text shown ${text8}`);

      // G9: no Gold Midas, Rainbow or Golden Hour below hole level 6 (PP 2026-10-21 "do 6 lvl dziury")
      {
        const lvl0 = S().holeLevel;
        const picks = (lv) => { S().holeLevel = lv; const c = {}; for (let i = 0; i < 3000; i++) { const id = g.mushrooms.pickDef().id; c[id] = (c[id] ?? 0) + 1; } return c; };
        const p5 = picks(5); const p6 = picks(6);
        const { EVENTS } = await import('/src/systems/events.ts');
        const gh = EVENTS.find((e) => e.id === 'golden');
        S().holeLevel = 12; const ghRandom = gh.ok(); S().holeLevel = lvl0;
        ok('G9', !p5.midas && !p5.rainbow && !p5.goldhour && p6.midas > 0 && p6.rainbow > 0 && p6.goldhour > 0 && !ghRandom, `lvl5 ${JSON.stringify(p5)} lvl6 midas ${p6.midas} goldhour ${p6.goldhour} rainbow ${p6.rainbow} goldenHour random event at lvl12 ${ghRandom}`);
        // G10: the Golden Hour mushroom starts the Golden Hour (PP 2026-10-21 "gold hour to tez byl grzybek nie event")
        g.events.goldenHour = 0; g.buffs.timers.clear(); g.buffs.apply('goldhour');
        const gh10 = g.events.goldenHour; g.buffs.timers.delete('goldhour'); g.events.goldenHour = 0.001; await frames(3);
        // the event lasts as long as the mushroom: Long Trip 4 (x1.8) and a second mushroom during the first add up
        const trip0 = U().mushTime; U().mushTime = 4;
        g.events.goldenHour = 0; g.buffs.apply('goldhour');
        const trip = { ev: g.events.goldenHour, buff: g.buffs.timers.get('goldhour') };
        g.buffs.timers.set('goldhour', 10); g.events.goldenHour = 10; g.buffs.apply('goldhour');
        const second = { ev: g.events.goldenHour, buff: g.buffs.timers.get('goldhour') };
        U().mushTime = trip0; g.buffs.timers.delete('goldhour'); g.events.goldenHour = 0.001; await frames(3);
        ok('G10', gh10 === 25 && Math.abs(trip.ev - 45) < 1e-6 && trip.ev === trip.buff && Math.abs(second.ev - 55) < 1e-6 && second.ev === second.buff, `goldenHour after mushroom ${gh10}, Long Trip 4 ${JSON.stringify(trip)}, second mushroom ${JSON.stringify(second)}`);
        // G11: the Rainbow ("All of the above") starts the Golden Hour too, for the Rainbow's time
        g.buffs.timers.clear(); g.events.goldenHour = 0; g.buffs.apply('rainbow');
        const rb = { ev: g.events.goldenHour, buff: g.buffs.timers.get('rainbow'), active: g.buffs.active('goldhour') };
        g.buffs.timers.clear(); g.buffs.midasLeft = 0; g.events.goldenHour = 0.001; await frames(3);
        ok('G11', rb.active && rb.ev > 0 && rb.ev === rb.buff, `Rainbow ${JSON.stringify(rb)}`);
        // G13: NO SCOPE for a SNIPER shot without the Trick Scope, not with it (PP 2026-10-21)
        {
          const sniper = (scope) => {
            S().achievements = S().achievements.filter((a) => a !== 'noscope' && a !== 'sniper'); U().scope = scope; g.hole.combo = 0;
            const x = spawnAt('classic', ahead(3, 0, 0.5), { awake: false });
            x.thrownBy = 'player'; x.touchedGround = true; x.throwPos = g.env.hole.clone().add(new V3(15, 0, 0));
            g.hole.consume(x);
            return S().achievements.includes('noscope');
          };
          const without = sniper(0); const withScope = sniper(1); U().scope = 0;
          ok('G13', without && !withScope && S().achievements.includes('sniper'), `noscope without scope ${without}, with scope ${withScope}`);
        }
        // G12: the flat trick bonus grows in, 1/4 at hole level 1, full from 4 (PP 2026-10-21 "b")
        {
          const lv0 = S().holeLevel; const shares = [];
          for (const lv of [1, 2, 4, 6]) {
            S().holeLevel = lv;
            const one = (bull) => { g.hole.combo = 0; paid = 0; const x = spawnAt('classic', ahead(3, 0, 0.5), { awake: false }); x.bullseye = bull; g.hole.consume(x); return paid; };
            const plain = one(false); const hoop = one(true);
            shares.push(+((hoop - 5 * plain) / (60 * g.hole.valueScale)).toFixed(3));
          }
          S().holeLevel = lv0; g.hole.combo = 0;
          // ±0.03: the base gnome value is rounded per coin burst, the share itself is what matters
          ok('G12', [0.25, 0.5, 1, 1].every((w, i) => Math.abs(shares[i] - w) < 0.03), `bonus share at hole 1/2/4/6 ${shares}`);
        }
      }
      g.coins.clearAll();
      setState(keep);
    }
  } catch (e) {
    checks.push('FAIL exception ' + (e?.stack ?? e));
  }
  window.__done = JSON.stringify({ ...R, errors, checks });
})();
