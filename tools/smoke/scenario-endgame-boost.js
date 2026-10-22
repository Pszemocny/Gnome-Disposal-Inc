// Endgame boost (plan docs/ai-work/2026-10-21-plan-endgame-boost.md, "Tests" E1-E17): Combo Cap 13-18, the three
// hole-8 rows, King 1000 XP, UFO XP, Shadow Gnome spawn behind the player, its 20 s grace and its clicking sound, the "..." event name.
// One RESULT JSON with `checks` (PASS/FAIL lines).
// Run (dev server on 5199): URL_QUERY='' FAKELOCK=1 DEV_PORT=5199 CDP_PORT=9424 MAXPOLL=2400 node tools/smoke/smoke.mjs eb-out tools/smoke/scenario-endgame-boost.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const g = window.gnome;
const R = {};
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps;
const inR = (v, a, b) => typeof v === 'number' && v >= a && v <= b;
// the fence spawn line (env.edgePoint): 1.5 m inside any side of the yard rectangle, which runs from the fixed corner (-22, -22)
const onFenceLine = (p) => {
  const { min, max } = window.gnome.env;
  return near(p.x, min.x + 1.5, 1e-3) || near(p.x, max.x - 1.5, 1e-3) || near(p.z, min.z + 1.5, 1e-3) || near(p.z, max.z - 1.5, 1e-3);
};
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));

setTimeout(() => { if (!window.__done) window.__done = JSON.stringify({ ...R, checks, timeout: true }); }, 580000);
(async () => {
  try {
    const { freshState, loadState, blockSaves, loadNotes } = await import('/src/core/state.ts');
    const { UPGRADE_BY_ID } = await import('/src/data/upgrades.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    const { Events } = await import('/src/systems/events.ts');
    blockSaves();
    const setState = (st) => { g.state = st; g.goals = new Goals(); g.goals.update = () => {}; };
    g.moods.update = () => {};
    g.contracts.update = () => {};
    const visitor0 = Events.prototype.spawnVisitor;
    g.events.spawnVisitor = () => {};
    g.events.next = 1e9;
    for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';
    const bigs = [];
    const big0 = g.hud.bigText.bind(g.hud);
    g.hud.bigText = (t, c, sub = '', ...a) => { bigs.push({ t, sub }); return big0(t, c, sub, ...a); };
    const toasts = [];
    const toast0 = g.hud.toast.bind(g.hud);
    g.hud.toast = (t, ...a) => { toasts.push(t); return toast0(t, ...a); };
    const speech = [];
    const speech0 = g.hud.speech.bind(g.hud);
    g.hud.speech = (p, t) => { speech.push(t); return speech0(p, t); };

    const s0 = freshState(); s0.money = 1e9; s0.holeLevel = 10; setState(s0);
    const S = () => g.state;
    const U = () => g.state.upgrades;
    g.paused = false;
    const V3 = g.camera.position.constructor;
    const Q = () => g.camera.quaternion.clone().set(0, 0, 0, 1);
    const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
    const spawnAt = (type, pos, opts = {}) => g.gnomes.spawn(type, pos, { tier: 'normal', ...opts });
    const placePlayer = (x, z, yaw = 0, pitch = 0) => {
      g.player.body.setTranslation({ x, y: 1.2, z }, true);
      g.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.player.position.set(x, 1.2, z);
      g.player.yaw = yaw;
      g.player.pitch = pitch;
    };
    const head = (id) => g.shop.upgradeItem(UPGRADE_BY_ID[id], []).view.head;
    const cls = (id) => g.shop.upgradeItem(UPGRADE_BY_ID[id], []).cls;
    const priceOf = (id, L) => { const k = U()[id]; U()[id] = L; const h = head(id).split(' · ')[1]; U()[id] = k; return h; };
    clearGnomes();
    await frames(5);

    // E1: Combo Cap 12 → 13 in the shop, prices of the 14th-18th
    {
      U().comboCap = 12; S().money = 1e9;
      const h12 = head('comboCap');
      const m0 = S().money;
      g.shop.buy('comboCap');
      const paid = m0 - S().money;
      const fx = g.shop.rowData(UPGRADE_BY_ID.comboCap).desc;
      const later = [14, 15, 16, 17, 18].map((n) => priceOf('comboCap', n - 1)).join(' ');
      R.E1 = { h12, lvl: U().comboCap, paid, fx, later, cls12: (U().comboCap = 12, cls('comboCap')) };
      ok('E1', h12 === 'LVL 12/18 · $712k' && R.E1.lvl === 13 && paid === 712895 && fx.includes('x8.5 cap') && later === '$1.58m $3.48m $7.69m $17m $37.6m' && R.E1.cls12 === 'afford', JSON.stringify(R.E1));
    }
    // E2: the cap of x11 only pays above combo 120
    {
      U().comboCap = 18; S().land = 0; S().deep = {};
      g.hole.combo = 200; const cap = g.hole.comboCap, m200 = g.hole.comboMult;
      g.hole.combo = 120; const m120 = g.hole.comboMult;
      g.hole.combo = 0; U().comboCap = 0;
      R.E2 = { cap, m200, m120 };
      ok('E2', near(cap, 11) && near(m200, 11) && near(m120, 7), JSON.stringify(R.E2));
    }
    // E3: the three new rows: locked below hole 8, need their parent, doubled prices (PP 2026-10-21 "od 8 poziomu ceny podwójne")
    {
      const ids = ['xpBoost', 'mushStorm', 'goldSpores'];
      S().holeLevel = 7;
      const locked7 = ids.map(cls);
      g.shop.buy('xpBoost');
      const boughtAt7 = U().xpBoost ?? 0;
      S().holeLevel = 8; U().hunger = 0;
      const needs8 = cls('xpBoost');
      U().hunger = 1;
      const afford8 = cls('xpBoost');
      // parents owned, else the head reads "needs <parent>" instead of the price
      const parents0 = [U().mushChance, U().mushStorm];
      U().mushChance = 1; U().mushStorm = 1;
      const prices = Object.fromEntries(ids.map((id) => [id, [0, 1, 2, 3, 4].map((L) => priceOf(id, L)).join(' ')]));
      [U().mushChance, U().mushStorm] = parents0;
      U().hunger = 0; S().holeLevel = 10;
      R.E3 = { locked7, boughtAt7, needs8, afford8, prices };
      ok('E3a', locked7.every((c) => c === 'locked') && boughtAt7 === 0, JSON.stringify(R.E3));
      ok('E3b', needs8 === 'needs' && afford8 === 'afford' && prices.xpBoost === '$800k $2m $5m $12.5m $31.3m' && prices.mushStorm === '$500k $1.25m $3.13m $7.81m $19.5m' && prices.goldSpores === '$2m $6m $12.5m $31.3m $78.1m', JSON.stringify(R.E3));
    }
    // E4: Bottomless Hunger multiplies hole XP
    {
      const xpOf = (boost) => {
        U().hunger = 5; U().xpBoost = boost; S().deep = {}; S().holeXp = 0;
        const n = spawnAt('classic', g.env.hole.clone().setY(1));
        n.thrownBy = 'player'; n.throwPos = g.env.hole.clone().add(new V3(2, 1, 0));
        g.hole.consume(n);
        return S().holeXp;
      };
      R.E4 = { xpBoost5: xpOf(5), xpBoost0: xpOf(0) };
      U().hunger = 0; U().xpBoost = 0; S().holeXp = 0;
      ok('E4', near(R.E4.xpBoost5, 3.375) && near(R.E4.xpBoost0, 1.5), JSON.stringify(R.E4));
    }
    // E5: the King gives 1000 XP by hand-free feeding (consume) and by a machine
    {
      S().holeLevel = 11; S().holeXp = 0;
      const k = spawnAt('king', g.env.hole.clone().setY(1));
      g.hole.consume(k, undefined, true);
      R.E5 = { kingXp: S().holeXp };
      S().holeXp = 0; S().holeLevel = 10;
      ok('E5', near(R.E5.kingXp, 1000), JSON.stringify(R.E5));
    }
    // E6, E7: a downed UFO fills 40 % of the bar, nothing at level 12 or when it flies away
    {
      const downUfo = async () => {
        g.events.start('ufo');
        const u = g.events.ufo;
        u.crashing = true; u.vy = -1; u.mesh.position.y = 0.4;
        await frames(2);
        return !g.events.ufo;
      };
      bigs.length = 0;
      S().holeLevel = 10; S().holeXp = 0;
      const gone1 = await downUfo();
      const a = { gone: gone1, xp: S().holeXp, level: S().holeLevel, big: bigs.find((b) => b.t === 'UFO DOWN!'), ach: g.achievements.has('ufo') };
      S().holeLevel = 10; S().holeXp = 2000;
      await downUfo();
      const b = { level: S().holeLevel, xp: S().holeXp };
      bigs.length = 0;
      S().holeLevel = 12; S().holeXp = 0;
      await downUfo();
      const c = { xp: S().holeXp, finite: Number.isFinite(S().holeXp), big: bigs.find((x) => x.t === 'UFO DOWN!') };
      S().holeLevel = 10; S().holeXp = 0;
      g.events.start('ufo');
      g.events.ufo.t = 46;
      for (let i = 0; i < 400 && g.events.ufo; i++) await frames(1);
      const d = { xp: S().holeXp, left: !g.events.ufo };
      R.E6 = { a, b }; R.E7 = { c, d };
      ok('E6', a.gone && near(a.xp, 1000) && a.level === 10 && a.big?.sub === '+1000 XP' && a.ach && b.level === 11 && near(b.xp, 500), JSON.stringify(R.E6));
      ok('E7', near(c.xp, 0) && c.finite && c.big && c.big.sub === '' && d.left && near(d.xp, 0), JSON.stringify(R.E7));
    }
    // E24, E25: a thrown gnome the beam takes never counts as a hit, a direct throw does (PP 2026-10-22)
    {
      clearGnomes();
      g.events.start('ufo');
      const u = g.events.ufo;
      const spot = u.target.clone();
      u.mesh.position.copy(spot);
      const thrown = (dx, dy) => {
        const m = u.mesh.position;
        const x = spawnAt('classic', new V3(m.x + dx, m.y + dy, m.z));
        g.gnomes.ragdoll(x, 10, 'player');
        x.throwPos = new V3(m.x + 10, 1, m.z);
        return x;
      };
      const beamed = thrown(0.5, -3);
      let lifted = 0;
      for (let i = 0; i < 300 && beamed.state !== 'gone' && g.events.ufo; i++) {
        u.target.copy(spot); u.mesh.position.copy(spot);
        await frames(1);
        lifted = Math.max(lifted, beamed.state === 'gone' ? 0 : beamed.body.translation().y);
      }
      const e20 = { hits: u.hits, abducted: beamed.state === 'gone', lifted: +lifted.toFixed(2), ufoY: spot.y };
      const direct = thrown(2, 0);
      const hits0 = u.hits;
      for (let i = 0; i < 60 && u.hits === hits0; i++) { u.target.copy(spot); u.mesh.position.copy(spot); await frames(1); }
      const e21 = { before: hits0, after: u.hits, toast: toasts.includes(`UFO hit! ${hits0 + 1}/3`) };
      if (direct.state !== 'gone') g.gnomes.remove(direct);
      g.events.removeUfo();
      R.E24 = e20; R.E25 = e21;
      ok('E24', e20.hits === 0 && e20.abducted, JSON.stringify(e20));
      ok('E25', e21.after === e21.before + 1 && e21.toast, JSON.stringify(e21));
    }
    // E8: Spore Storm raises the drop chance of every eaten gnome
    {
      const spawn0 = g.mushrooms.spawn;
      let drops = 0;
      g.mushrooms.spawn = () => { drops++; };
      g.goals.wantsMushroom = false;
      const rate = (storm) => { U().mushChance = 5; U().mushStorm = storm; drops = 0; for (let i = 0; i < 2000; i++) g.mushrooms.maybeDrop(new V3(0, 0, 0)); return drops / 2000; };
      R.E8 = { storm5: rate(5), storm0: rate(0) };
      g.mushrooms.spawn = spawn0; U().mushChance = 0; U().mushStorm = 0;
      // Spore Storm +15 % per level (PP 2026-10-22 "mniej procentow"): 0.025 x 2.5 x 1.75 = 0.109 at Spore Bag 5 + Storm 5
      ok('E8', inR(R.E8.storm5, 0.09, 0.13) && inR(R.E8.storm0, 0.045, 0.08), JSON.stringify(R.E8));
    }
    // E9, E17: Midas Spores share, every source through pickDef, never below the gold level
    {
      const share = (hole, spores) => {
        S().holeLevel = hole; U().goldSpores = spores;
        const n = { midas: 0, rainbow: 0, other: 0 };
        for (let i = 0; i < 1000; i++) { const id = g.mushrooms.pickDef().id; n[id === 'midas' || id === 'rainbow' ? id : 'other']++; }
        return n;
      };
      const h10s5 = share(10, 5), h10s0 = share(10, 0), h3s5 = share(3, 5), h6s5 = share(6, 5);
      // the combo text at 15 spits a mushroom drawn by pickDef
      S().holeLevel = 10; U().goldSpores = 5;
      const spawn0 = g.mushrooms.spawn;
      let comboMidas = 0;
      g.mushrooms.spawn = (def) => { if (def.id === 'midas') comboMidas++; };
      for (let i = 0; i < 50; i++) {
        g.hole.combo = 14; g.hole.comboTimer = 1e9;
        const n = spawnAt('classic', g.env.hole.clone().setY(1));
        n.thrownBy = 'player'; n.throwPos = g.env.hole.clone().add(new V3(2, 1, 0));
        g.hole.consume(n);
      }
      g.mushrooms.spawn = spawn0; g.hole.combo = 0; g.hole.comboTimer = 0; U().goldSpores = 0;
      R.E9 = { h10s5, h10s0, comboMidas }; R.E17 = { h3s5, h6s5 };
      // Midas Spores +5 % per level: 25 % forced + 75 % x the natural Midas share (~0.11) = ~0.33 at level 5;
      // the 50 combo-text mushrooms: ~16.5 Midas, ±3 sigma about 6-27
      ok('E9', inR(h10s5.midas / 1000, 0.28, 0.38) && h10s5.other + h10s5.rainbow >= 1 && inR(h10s0.midas / 1000, 0.08, 0.14) && inR(comboMidas, 6, 30), JSON.stringify(R.E9));
      ok('E17', h3s5.midas === 0 && h3s5.rainbow === 0 && inR(h6s5.midas / 1000, 0.28, 0.38), JSON.stringify(R.E17));
    }
    // E21: a gnome the Golden Hour turned gold pays x10 and 5 XP, a natural golden x100 and 10 XP (PP 2026-10-22 "g7 b, xp 5")
    {
      clearGnomes(); S().holeLevel = 10; U().hunger = 0; U().xpBoost = 0;
      const burst0 = g.coins.burst;
      let paid = 0;
      g.coins.burst = (v, ...a) => { paid = v; return burst0.call(g.coins, v, ...a); };
      const eat = (n) => {
        g.hole.combo = 0; g.hole.comboTimer = 0; S().holeXp = 0; paid = 0;
        // touched the ground: no AIR trick, whose flat bonus does not follow the gnome's price
        n.thrownBy = 'player'; n.throwPos = g.env.hole.clone().add(new V3(2, 1, 0)); n.touchedGround = true;
        g.hole.consume(n);
        return { paid, xp: S().holeXp };
      };
      const natural = eat(spawnAt('golden', g.env.hole.clone().setY(1)));
      // the real swap wave: a free classic far from the hole turns gold
      spawnAt('classic', new V3(-12, 0.7, -12), { awake: true });
      g.events.start('golden');
      let gold = null;
      for (let i = 0; i < 40 && !gold; i++) { await frames(1); gold = g.gnomes.list.find((x) => x.type.id === 'golden' && x.goldFrom); }
      // the Golden Hour ends now so nothing else turns gold; the eaten gnome is the marked one
      g.events.goldenHour = 0; g.events.swaps = [];
      const retyped = gold ? (gold.body.setTranslation(g.env.hole.clone().setY(1), true), eat(gold)) : null;
      g.coins.burst = burst0; clearGnomes(); g.hole.combo = 0; S().holeXp = 0;
      R.E21 = { natural, retyped, from: gold?.goldFrom ?? null };
      ok('E21', !!retyped && R.E21.from === 'classic' && near(retyped.paid / natural.paid, 0.1, 1e-9) && near(natural.xp, 10) && near(retyped.xp, 5), JSON.stringify(R.E21));
    }
    // E22: a gnome fed at FEED_XP (machine, robot, kick...) drops mushrooms at 1/4; hand throw, crate, King keep x1; the lesson stays
    {
      clearGnomes(); S().holeLevel = 10;
      const drop0 = g.mushrooms.maybeDrop;
      const spawn0 = g.mushrooms.spawn;
      let bonus = null; let spawned = 0;
      g.mushrooms.maybeDrop = function (p, b) { bonus = b; return drop0.call(this, p, b); };
      g.mushrooms.spawn = () => { spawned++; };
      const eat = (type, machine, hand) => {
        g.hole.combo = 0; g.hole.comboTimer = 0; bonus = null;
        const n = spawnAt(type, g.env.hole.clone().setY(1));
        if (hand) { n.thrownBy = 'player'; n.throwPos = g.env.hole.clone().add(new V3(2, 1, 0)); }
        g.hole.consume(n, undefined, machine);
        return bonus;
      };
      // wantsMushroom is a getter: pin it on the instance
      const want = (v) => Object.defineProperty(g.goals, 'wantsMushroom', { value: v, configurable: true });
      want(false);
      const b = { hand: eat('classic', false, true), machine: eat('classic', true), crate: eat('classic', 'crate'), walkIn: eat('classic', false), king: eat('king', true), wizardMachine: eat('wizard', true) };
      // the lesson: no mushroom on the grass, a machine eat still drops one
      for (const m of [...g.mushrooms.list]) g.mushrooms.list.splice(g.mushrooms.list.indexOf(m), 1);
      want(true); spawned = 0;
      eat('classic', true);
      const lesson = spawned;
      delete g.goals.wantsMushroom;
      g.mushrooms.maybeDrop = drop0; g.mushrooms.spawn = spawn0; clearGnomes(); g.hole.combo = 0; S().holeXp = 0;
      R.E22 = { ...b, lesson };
      ok('E22', b.hand === 1 && b.machine === 0.25 && b.crate === 1 && b.walkIn === 0.25 && b.king === 1 && b.wizardMachine === 1.5 && lesson === 1, JSON.stringify(R.E22));
    }
    // night for the Shadow checks
    S().holeLevel = 11; S().money = 1e6; g.env.dayClock = 170; g.env.night = 1;
    clearGnomes(); g.machines.clearAll();
    // E10, E11: robots and tools leave a fresh Shadow alone for 20 s, the Magnet Gun still sees it
    {
      const spot = new V3(-12, 0.7, -12);
      placePlayer(-12, -6, 0, 0); // 6 m away, looking -z at the shadow (vanish radius is 4 m)
      g.machines.place('robot', spot.clone().add(new V3(3, -0.7, 0)), Q());
      g.machines.place('vacuum', spot.clone().add(new V3(-3, -0.7, 0)), Q());
      g.machines.place('fan', spot.clone().add(new V3(0, -0.7, 3)), Q());
      const sh = g.gnomes.spawn('shadow', spot, { awake: true });
      sh.life = 0;
      const robots = () => g.machines.list.filter((m) => m.robot).map((m) => m.robot);
      let robotTargets = 0;
      for (let i = 0; i < 60; i++) { await frames(1); if (robots().some((r) => r.targetGnome === sh)) robotTargets++; g.player.position.set(-12, 1.2, -6); }
      const alive = g.gnomes.list.includes(sh) && sh.state !== 'gone';
      const state = sh.state;
      const cone = g.player.coneTargets().includes(sh);
      sh.life = 21;
      const eaten0 = S().gnomesEaten ?? 0;
      let after = 'alive';
      for (let i = 0; i < 40; i++) {
        await frames(1); g.player.position.set(-12, 1.2, -6);
        if (!g.gnomes.list.includes(sh) || sh.state === 'gone') { after = 'eaten'; break; }
        if (sh.state === 'ragdoll' || sh.state === 'held' || robots().some((r) => r.targetGnome === sh)) { after = 'ragdoll'; break; }
      }
      R.E10 = { alive, state, robotTargets, cone }; R.E11 = { after, eatenDelta: (S().gnomesEaten ?? 0) - eaten0 };
      ok('E10', alive && state === 'walk' && robotTargets === 0 && cone, JSON.stringify(R.E10));
      ok('E11', after === 'eaten' || after === 'ragdoll', JSON.stringify(R.E11));
      clearGnomes(); g.machines.clearAll();
    }
    // E23: a robot never picks up the King (PP 2026-10-22 "g9 nie ruszaja go roboty"); a classic next to him it does take
    {
      const spot = new V3(-12, 0.7, -12);
      placePlayer(-12, 4, 0, 0);
      g.machines.place('robot', spot.clone().add(new V3(3, -0.7, 0)), Q());
      const king = spawnAt('king', spot, { awake: true });
      const robot = () => g.machines.list.find((m) => m.robot)?.robot;
      let kingTargets = 0;
      for (let i = 0; i < 60; i++) { await frames(1); if (robot()?.targetGnome === king) kingTargets++; }
      const kingFree = g.gnomes.list.includes(king) && king.state !== 'stashed' && king.state !== 'gone';
      const c = spawnAt('classic', spot.clone().add(new V3(1.5, 0, 1.5)));
      let classicTaken = false;
      for (let i = 0; i < 60 && !classicTaken; i++) { await frames(1); if (robot()?.targetGnome === c || c.state === 'stashed') classicTaken = true; }
      R.E23 = { kingTargets, kingFree, classicTaken };
      ok('E23', kingTargets === 0 && kingFree && classicTaken, JSON.stringify(R.E23));
      clearGnomes(); g.machines.clearAll();
    }
    // E12: 20 spawns 7-10 m behind the player, inside the fence, clear of the hole; pop, cue, screenshot
    {
      g.events.spawnVisitor = visitor0;
      const pts = [];
      speech.length = 0;
      let popSeen = false;
      // player on the far side from the hole: at hole level 10+ the hole sits about (5, 9), so a player at z = 9 has it behind him
      const PZ = -9;
      for (let i = 0; i < 20; i++) {
        clearGnomes();
        placePlayer(0, PZ, 0, 0);
        g.events.spawnVisitor();
        const sh = g.gnomes.list.find((x) => x.type.id === 'shadow');
        if (!sh) { pts.push(null); continue; }
        const p = sh.body.translation();
        const dx = p.x - 0, dz = p.z - PZ, d = Math.hypot(dx, dz);
        pts.push({ d: +d.toFixed(2), dot: +(dz / d).toFixed(3), inside: g.env.inside(p.x, p.z, 1.5 - 1e-6), holeGap: g.env.holeDist(p.x, p.z) >= g.env.holeRadius + 2 - 1e-6 });
        if (i === 0) {
          const M4 = new g.camera.matrix.constructor();
          const mesh = g.gnomes.meshes.get('shadow');
          for (let f = 0; f < 10; f++) {
            await frames(1);
            const idx = g.gnomes.slots.get('shadow').indexOf(sh);
            if (idx < 0) break;
            mesh.getMatrixAt(idx, M4);
            const sc = new V3().setFromMatrixScale(M4).y / sh.scale;
            if (sc > 0.3 && sc < 1 - 1e-3) { popSeen = true; await shot('shadow-behind.png'); break; }
          }
        }
      }
      const good = pts.filter((q) => q && inR(q.d, 7, 10) && q.dot >= 0.5 && q.inside && q.holeGap).length;
      R.E12 = { good, pts, popSeen, say: speech.filter((t) => t === 'we see you').length };
      ok('E12', good === 20 && popSeen && R.E12.say >= 1, JSON.stringify({ good, popSeen, say: R.E12.say, bad: pts.filter((q) => !q || !(inR(q.d, 7, 10) && q.dot >= 0.5 && q.inside && q.holeGap)) }));
    }
    // E13: nothing fits behind the player at the fence corner with the hole behind → fence spawn
    {
      clearGnomes();
      const h = g.env.max.x - 1.5; // the +x +z corner of the yard rectangle
      const hole0 = g.env.hole.clone(), r0 = g.env.holeRadius;
      const hd0 = g.env.holeDist;
      // behind the player (corner +x +z, looking at the corner) is the yard interior; make every behind spot fail the hole gap
      g.env.holeDist = () => 0;
      placePlayer(h - 0.1, h - 0.1, Math.PI / 4 + Math.PI, 0);
      g.events.spawnVisitor();
      const sh = g.gnomes.list.find((x) => x.type.id === 'shadow');
      const p = sh?.body.translation();
      g.env.holeDist = hd0; g.env.hole.copy(hole0); g.env.holeRadius = r0;
      const onFence = !!p && onFenceLine(p);
      R.E13 = { p: p && { x: p.x, z: p.z }, onFence };
      ok('E13', onFence, JSON.stringify(R.E13));
    }
    // E20: the shadow never appears in front of the player or inside the factory (plan row 13: within 60° of straight behind)
    {
      const h = g.env.max.x - 1.5; // the +z fence line (max.z === max.x)
      const spawnOnce = (x, z) => {
        clearGnomes(); placePlayer(x, z, 0, 0); g.events.spawnVisitor();
        const p = g.gnomes.list.find((q) => q.type.id === 'shadow')?.body.translation();
        if (!p) return null;
        const d = Math.hypot(p.x - x, p.z - z);
        const onFence = onFenceLine(p);
        return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), behind: (p.z - z) / d >= 0.5 - 1e-6, onFence, inFactory: g.factory.inside(p.x, p.z) };
      };
      // back to the +z fence (looking -z): no spot behind fits, so the shadow must come from the fence, never from the front
      const wall = [];
      for (let i = 0; i < 20; i++) wall.push(spawnOnce(-8, h - 1));
      // factory body straight behind the player at 8.5 m
      const f = g.factory.footprints[0];
      const fz = Math.max(-h + 0.5, f.z - 8.5);
      const fac = [];
      for (let i = 0; i < 40; i++) fac.push(spawnOnce(f.x, fz));
      clearGnomes();
      const badWall = wall.filter((q) => !q || !(q.behind || q.onFence));
      const badFac = fac.filter((q) => !q || q.inFactory || !(q.behind || q.onFence));
      R.E20 = { badWall, badFac, factory: { x: f.x, z: f.z, hx: f.hx, hz: f.hz }, playerZ: fz };
      ok('E20', badWall.length === 0 && badFac.length === 0, JSON.stringify(R.E20));
    }
    // E14: the stare rules stay: vanishes at 3.5 m, steals 5 % after 45 s
    {
      clearGnomes(); placePlayer(0, 9, 0, 0);
      const a = g.gnomes.spawn('shadow', new V3(0, 0.7, 17), { awake: true });
      await frames(3);
      placePlayer(0, 13.5, 0, 0);
      for (let i = 0; i < 30 && g.gnomes.list.includes(a); i++) { await frames(1); g.player.position.set(0, 1.2, 13.5); }
      const vanished = !g.gnomes.list.includes(a) || a.state === 'gone';
      placePlayer(0, 0, 0, 0);
      S().money = 1e6; g.coins.clearAll(); toasts.length = 0;
      // (10, 10) is inside the level-10 hole (centre about (5.4, 9.4), radius 5.2): the shadow fell in instead of staring
      const b = g.gnomes.spawn('shadow', new V3(-10, 0.7, -10), { awake: true });
      b.life = 46;
      // money read right before each frame, so coins or gnomes paid on other frames do not move the 5 % check
      let before = S().money;
      for (let i = 0; i < 30 && g.gnomes.list.includes(b); i++) { before = S().money; await frames(1); }
      R.E14 = { vanished, before, money: S().money, toast: toasts.find((t) => t.startsWith('Something took')) };
      // 0.1 % slack: a coin or gnome paid in the steal frame itself moves the counter by a few hundred
      ok('E14', vanished && near(before - R.E14.money, Math.floor(before * 0.05), before * 0.001) && !!R.E14.toast, JSON.stringify(R.E14));
    }
    // E19: the shadow clicks when it appears and while it stares (20 s grace), then goes quiet
    {
      const clicks0 = g.audio.clicks;
      const calls = [];
      g.audio.clicks = (x, z) => calls.push({ x, z });
      clearGnomes(); placePlayer(0, 9, 0, 0);
      g.events.spawnVisitor = visitor0;
      g.events.spawnVisitor();
      const sh = g.gnomes.list.find((x) => x.type.id === 'shadow');
      const onSpawn = calls.length;
      const p = sh?.body.translation();
      const atShadow = !!p && calls.length > 0 && near(calls[0].x, p.x, 1e-3) && near(calls[0].z, p.z, 1e-3);
      calls.length = 0;
      // the stare clicks with a 25 % chance per AI tick: the roll is forced under 0.25 for this window, so the check tests
      // "a staring shadow clicks", not the dice (it was red in 1 of 3 runs)
      const rnd0 = Math.random; Math.random = () => 0.1;
      for (let i = 0; i < 240 && sh && g.gnomes.list.includes(sh) && calls.length < 1; i++) { await frames(1); g.player.position.set(0, 1.2, 9); sh.life = Math.min(sh.life, 5); }
      Math.random = rnd0;
      const staring = calls.length;
      calls.length = 0;
      for (let i = 0; i < 60 && sh && g.gnomes.list.includes(sh); i++) { await frames(1); g.player.position.set(0, 1.2, 9); sh.life = Math.max(sh.life, 25); }
      const after = calls.length;
      g.audio.clicks = clicks0; g.events.spawnVisitor = () => {}; clearGnomes();
      R.E19 = { onSpawn, atShadow, staring, after };
      ok('E19', onSpawn === 1 && atShadow && staring >= 1 && after === 0, JSON.stringify(R.E19));
    }
    // E15: legend row and banner keep the "..." name (PP 2026-10-21 asked "co to jest", the rename waits for PP)
    {
      g.legend.tab = 'Mechanics';
      const html = g.legend.mechanics();
      const row = /<tr><td>\.\.\.<\/td><td>Something is watching you from the dark\.<\/td><\/tr>/.test(html);
      g.events.spawnVisitor = () => {};
      g.events.start('visitor');
      await frames(2);
      const title = document.querySelector('.b-title')?.textContent;
      // the album shows a card only after the first swallow; no shadow is eaten in this scenario
      const eaten0 = S().stats.typesEaten.shadow;
      S().stats.typesEaten.shadow = 1;
      const shadowCard = g.legend.gnomes().includes('Comes out of the dark behind you');
      S().stats.typesEaten.shadow = eaten0;
      R.E15 = { row, title, shadowCard };
      ok('E15', row && title === '...' && R.E15.shadowCard, JSON.stringify(R.E15));
    }
    // E16: an old save with Combo Cap 12 and no new keys
    {
      const KEY = 'gnome-boozed-save-v1';
      const n0 = loadNotes.length;
      const old = freshState(); old.upgrades.comboCap = 12; old.upgrades.hunger = 5; old.holeLevel = 10;
      localStorage.setItem(KEY, JSON.stringify(old));
      const L = loadState(); localStorage.removeItem(KEY);
      setState(L);
      R.E16 = { comboCap: L.upgrades.comboCap, head: head('comboCap'), xpMult: g.hole.xpMult, notes: loadNotes.length - n0, caps: [UPGRADE_BY_ID.hunger.max, UPGRADE_BY_ID.mushChance.max, UPGRADE_BY_ID.comboWindow.max, UPGRADE_BY_ID.mushTime.max] };
      ok('E16', R.E16.comboCap === 12 && R.E16.head === 'LVL 12/18 · $712k' && near(R.E16.xpMult, 1.5) && R.E16.notes === 0 && R.E16.caps.join() === '5,5,10,4', JSON.stringify(R.E16));
    }
  } catch (e) {
    R.error = String(e && e.stack || e);
  }
  window.__done = JSON.stringify({ ...R, errors, checks });
})();
