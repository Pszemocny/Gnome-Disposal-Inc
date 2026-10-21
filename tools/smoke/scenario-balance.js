// Balance batch (plan 2026-10-20-plan-balance-batch.md, "Done when"): UFO/King weights, no slow-mo, XP by feeding style,
// 10 fans / 10 belts, per-tool fuses. Prints one RESULT JSON with the keys of "Done when" plus `checks` (PASS/FAIL).
// Run (about 3 min): URL_QUERY='' DEV_PORT=5199 CDP_PORT=9420 MAXPOLL=2400 node tools/smoke/smoke.mjs balance-out tools/smoke/scenario-balance.js
// Money cases (C8, C10, C18) compare with a run on the code before a balance change: prepend
// `window.MONEY_BEFORE = {"crate2":..,"vacuumThrown":..,"regrabBall20":..};` to a copy of this file (without it they only print).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const g = window.gnome;
const R = { xp: {}, money: {}, shop: {}, hotbar: {}, placed: {}, fuses: {}, perf: {}, oldSave: {}, blueprint: {}, saboteur: {}, strike: {}, load: {}, legend: {}, wheel: {} };
const checks = [];
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps;
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);

setTimeout(() => { if (!window.__done) window.__done = JSON.stringify({ ...R, checks, timeout: true }); }, 560000);
(async () => {
  try {
    const { EVENTS } = await import('/src/systems/events.ts');
    const { freshState, loadState, blockSaves } = await import('/src/core/state.ts');
    const { fuseCount } = await import('/src/entities/machines.ts');
    const { UPGRADES, TOOL_IDS, FUSE_TOOLS } = await import('/src/data/upgrades.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    blockSaves();
    // the goals keep their own copy of the save's progress: a swapped state needs fresh goals
    const setState = (st) => { g.state = st; g.goals = new Goals(); g.goals.update = () => {}; };
    const V3 = g.camera.position.constructor;
    const Q = () => g.camera.quaternion.clone().set(0, 0, 0, 1);
    // nothing random may change money between the before and the after run
    g.moods.update = () => {};
    g.contracts.update = () => {};
    g.events.spawnVisitor = () => {};
    g.events.next = 1e9;
    let paid = 0;
    const burst0 = g.coins.burst.bind(g.coins);
    g.coins.burst = (v, o, p) => { paid += v; return burst0(v, o, p); };

    const s0 = freshState();
    s0.money = 1e9;
    s0.holeLevel = 11;
    setState(s0);
    const S = () => g.state;
    g.paused = false;
    const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
    clearGnomes();
    g.machines.clearAll();
    await frames(5);

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
    const statues = (n, d0 = 3) => { const out = []; for (let i = 0; i < n; i++) out.push(spawnAt('classic', ahead(d0 + Math.floor(i / 5) * 0.35, ((i % 5) - 2) * 0.35, 0.5), { awake: false })); return out; };
    const waitGone = async (list, max = 600) => { for (let i = 0; i < max && list.some((x) => x.state !== 'gone'); i++) await frames(1); return list.every((x) => x.state === 'gone'); };
    // one feeding case: XP and money paid while its gnomes are eaten, at hole level 11 (no level-up), combo from 0
    const feed = async (fn, level = 11) => {
      clearGnomes();
      const s = S();
      s.holeLevel = level; s.holeXp = 0;
      g.hole.combo = 0; g.hole.comboTimer = 0;
      paid = 0;
      const list = await fn();
      const done = await waitGone(list);
      return { xp: +s.holeXp.toFixed(6), money: +paid.toFixed(4), n: list.length, done };
    };
    const hand = () => { const n = spawnAt('classic', ahead(2, 0, 1.5)); g.gnomes.hold(n); g.gnomes.drop(n, new V3(0, -0.1, 0)); return n; };
    const fall = (list) => { for (const x of list) g.gnomes.startFalling(x); return list; };
    // Magnet Gun ball through the real LMB batch path
    const gun = async () => { S().upgrades.magGun = 1; g.player.setGear('magGun'); g.input.mouse.left = false; await frames(3); };
    const grabBall = async (list) => {
      g.player.grabCd = 0;
      g.input.mouse.left = true;
      g.input.mouse.leftPressed = true;
      for (let i = 0; i < 30 && list.some((x) => x.state !== 'held'); i++) await frames(1);
      return list.every((x) => x.state === 'held');
    };
    const throwBall = async () => { g.player.throwCd = 0; g.input.mouse.rightPressed = true; await frames(1); g.input.mouse.left = false; await frames(1); };
    const rnd0 = Math.random;
    const steady = (on) => { Math.random = on ? () => 0.5 : rnd0; }; // no random slip off the ball while a case holds it

    placePlayer(14, 3);
    await frames(3);

    // ---- C: XP by feeding style
    const plain = await feed(() => fall([spawnAt('classic', ahead(2))]));
    R.money.plain = plain.money;
    R.xp.walkIn = plain.xp;
    const h1 = await feed(() => fall([hand()]));
    R.xp.hand = h1.xp;

    await gun();
    {
      const r = await feed(async () => { const l = statues(4); steady(true); await grabBall(l); await throwBall(); steady(false); return fall(l); });
      R.xp.volley4 = +(r.xp / 4).toFixed(6); R.xp.volley4sum = r.xp;
      const r16 = await feed(async () => { const l = statues(16); steady(true); await grabBall(l); await throwBall(); steady(false); return fall(l); });
      R.xp.volley16 = +(r16.xp / 16).toFixed(6);
      const rel = await feed(async () => { const l = statues(4); steady(true); await grabBall(l); g.input.mouse.left = false; await frames(1); steady(false); return fall(l); });
      R.xp.ballRelease4 = +(rel.xp / 4).toFixed(6);
    }
    R.xp.handDrop = (await feed(() => { const n = spawnAt('classic', ahead(2, 0, 1.5)); g.gnomes.hold(n); g.gnomes.drop(n); return fall([n]); })).xp;

    // C17: a ball of 4 lowered over the rim, one gnome slips per frame; one stays while 2 more join the same hold
    {
      clearGnomes();
      const s = S(); s.holeXp = 0; g.hole.combo = 0;
      const l = statues(4);
      steady(true);
      await grabBall(l);
      const first = l.slice(0, 3);
      for (const x of first) { g.gnomes.drop(x); g.gnomes.startFalling(x); await frames(1); }
      await waitGone(first);
      const xpFirst = s.holeXp;
      const late = statues(2);
      for (let i = 0; i < 30 && late.some((x) => x.state !== 'held'); i++) await frames(1);
      const rest = [l[3], ...late];
      const xp0 = s.holeXp;
      for (const x of rest) { g.gnomes.drop(x); g.gnomes.startFalling(x); await frames(1); }
      await waitGone(rest);
      steady(false);
      g.input.mouse.left = false;
      await frames(2);
      R.xp.ballLowered4 = +(xpFirst / 3).toFixed(6);
      R.xp.ballToppedUp6 = +((s.holeXp - xp0) / 3).toFixed(6);
      R.xp.ballToppedUpN = rest[0].xpGroup?.n ?? null;
    }
    // C18: ball of 20 thrown from > 14 m, re-grabbed at once (the player waited out the throw cooldown), lowered in
    {
      const r = await feed(async () => {
        const l = statues(20);
        steady(true);
        await grabBall(l);
        await throwBall();
        R.money.regrabThrowDist = +Math.min(...l.map((x) => g.env.holeDist(x.throwPos.x, x.throwPos.z))).toFixed(2);
        l.forEach((x, i) => { x.body.setTranslation(ahead(2.2 + Math.floor(i / 5) * 0.3, ((i % 5) - 2) * 0.3, 1.6), true); x.body.setLinvel({ x: 0, y: 0, z: 0 }, true); x.noGrabUntil = 0; });
        await grabBall(l);
        for (const x of l) { g.gnomes.drop(x); g.gnomes.startFalling(x); await frames(1); }
        steady(false);
        g.input.mouse.left = false;
        return l;
      });
      R.money.regrabBall20 = r.money;
      R.xp.regrabBall20 = +(r.xp / 20).toFixed(6);
    }
    // C20: a ball of 4, one gnome slips off (the updateSwarm slip path) and the held gun pulls it back into the same hold
    {
      const r = await feed(async () => {
        const l = statues(4);
        steady(true);
        await grabBall(l);
        const x = l[0];
        const sw = g.player.swarm;
        g.gnomes.drop(x); x.noGrabUntil = g.time + 1; sw.splice(sw.findIndex((s) => s.g === x), 1);
        for (let i = 0; i < 120 && x.state !== 'held'; i++) await frames(1);
        R.xp.slipRegrabHeld = x.state === 'held';
        R.xp.slipRegrabN = x.xpGroup?.n ?? null;
        for (const y of l) { g.gnomes.drop(y); g.gnomes.startFalling(y); await frames(1); }
        steady(false);
        g.input.mouse.left = false;
        return l;
      });
      R.xp.slipRegrab4 = +(r.xp / 4).toFixed(6);
    }
    g.player.setGear('hands');
    await frames(2);

    // C3: a hand throw bounced by a trampoline
    {
      const m = g.machines.place('trampoline', new V3(10, 0, 10), Q());
      const r = await feed(() => {
        const n = hand();
        n.body.setTranslation({ x: m.pos.x, y: m.pos.y + 0.6, z: m.pos.z }, true);
        n.body.setLinvel({ x: 0, y: -3, z: 0 }, true);
        g.machines.effect(m, 0.016);
        R.xp.trampolineBounced = n.bounced;
        return fall([n]);
      });
      R.xp.trampolineThrow = r.xp;
      g.machines.clearAll();
    }
    // C5 kick, C6 ground pound, STRIKE still counts a kicked gnome
    {
      placePlayer(14, 3); await frames(2);
      const r = await feed(async () => {
        const n = spawnAt('classic', ahead(1.3, 0, 0.5), { awake: false });
        await frames(2); // the physics query sees a new collider after one step
        g.player.kickHit();
        // spawned after the kick, so only the kicked gnome flies; STRIKE reads positions, not the physics query
        const o = spawnAt('classic', ahead(2.3, 0, 0.5), { awake: false });
        g.strike.update(0);
        R.strike.kickBallCounted = g.strike.marks.has(o) && g.strike.marks.get(o).by === n;
        R.strike.kickedBy = n.thrownBy;
        g.gnomes.remove(o);
        return fall([n]);
      });
      R.xp.kick = r.xp;
      R.xp.pound = (await feed(() => { const n = spawnAt('classic', g.player.position.clone().add(new V3(1, -0.7, 0))); g.player.pound.impact(g.player.position.clone()); R.xp.poundBy = n.thrownBy; return fall([n]); })).xp;
    }
    // C7 plow and leaf blower
    {
      R.xp.plow = (await feed(() => { const n = spawnAt('classic', ahead(1.2, 0, 0.5)); g.player.sweeper.push(g.player, g.player.position.y - 0.9, 0.35, 2.05, 1, 0.9, 3, 0.016); R.xp.plowHit = n.state === 'ragdoll'; return fall([n]); })).xp;
      R.xp.blower = (await feed(() => { const n = spawnAt('classic', g.player.eye.addScaledVector(g.player.dir, 2)); g.player.sweeper.blow(g.player, 0.016); R.xp.blowHit = n.state === 'ragdoll'; return fall([n]); })).xp;
    }
    // C8 crate dump of two gnomes thrown in from 15 m; C15 the same crate tipped next to the rim
    const sniperIntoCrate = (m) => {
      const n = spawnAt('classic', new V3(15, 1.5, 0));
      g.gnomes.hold(n); g.gnomes.drop(n, new V3(0, -0.1, 0));
      g.gnomes.stash(n); m.queue.push(n);
      return n;
    };
    {
      const m = g.machines.place('box', new V3(10, 0.5, -6), Q());
      const r = await feed(() => {
        const l = [sniperIntoCrate(m), sniperIntoCrate(m)];
        const h = g.env.hole;
        g.machines.updateCrate(m, { x: h.x, y: 0.5, z: h.z }, { x: 0, y: 0, z: 0, w: 1 });
        return l;
      });
      R.xp.crate2 = r.xp; R.money.crate2 = r.money;
      g.machines.clearAll();
      const m2 = g.machines.place('box', new V3(10, 0.5, -6), Q());
      clearGnomes();
      const s = S(); s.holeXp = 0;
      const a = sniperIntoCrate(m2);
      const b = sniperIntoCrate(m2);
      const rim = g.env.holeRadius + 2;
      g.machines.updateCrate(m2, { x: rim, y: 0.5, z: 0 }, { x: 1, y: 0, z: 0, w: 0 });
      R.xp.crateTipReleasedBy = a.thrownBy;
      g.hole.combo = 0; g.hole.comboTimer = 0; paid = 0;
      fall([a]); await waitGone([a]);
      R.money.crateTipSniper = +paid.toFixed(4);
      fall([b]); await waitGone([b]);
      R.xp.crateTip2 = +s.holeXp.toFixed(6);
      g.machines.clearAll();
    }
    // C16 cannon taken back with one gnome queued
    {
      const m = g.machines.place('cannon', new V3(10, 0, -6), Q());
      R.xp.toolRemoveSpill = (await feed(() => { const n = spawnAt('classic', new V3(10, 1, -6)); g.gnomes.stash(n); m.queue.push(n); g.machines.remove(m); return fall([n]); })).xp;
    }
    // C9 fan trips a walker, C12 the King pushed by a fan
    {
      const m = g.machines.place('fan', new V3(10, 0, -8), Q());
      const o = m.pos.clone().setY(1.4);
      R.xp.fanWalker = (await feed(() => { const n = spawnAt('classic', o.clone().add(new V3(0, -0.9, 2))); g.machines.effect(m, 0.016); R.xp.fanBy = n.thrownBy; return fall([n]); })).xp;
      const k = await feed(() => { const n = spawnAt('king', o.clone().add(new V3(0, -0.4, 3))); g.machines.effect(m, 0.016); R.xp.kingFanBy = n?.thrownBy; return n ? fall([n]) : []; });
      R.xp.kingByFan = k.xp;
      g.machines.clearAll();
    }
    // C10 vacuum eats a gnome the player threw from 15 m; robot tips its bed
    {
      const m = g.machines.place('vacuum', new V3(10, 0, -8), Q());
      const r = await feed(() => {
        const n = spawnAt('classic', new V3(15, 1.5, 0));
        g.gnomes.hold(n); g.gnomes.drop(n, new V3(0, -0.1, 0));
        n.body.setTranslation({ x: m.pos.x + 0.5, y: m.pos.y + 1, z: m.pos.z }, true);
        n.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        m.t = 1;
        g.machines.effect(m, 0.016);
        return [n];
      });
      R.xp.vacuumThrown = r.xp; R.money.vacuumThrown = r.money;
      g.machines.clearAll();
      S().upgrades.robot = 1;
      const rb = g.machines.place('robot', new V3(10, 0, -8), Q());
      const t = await feed(() => {
        const n = spawnAt('classic', new V3(10, 1, -8));
        g.gnomes.stash(n); n.thrownBy = 'machine'; n.throwPos = null; rb.queue.push(n);
        rb.robot.state = 'tip'; rb.robot.anim = 0;
        return [n];
      });
      R.xp.robotTip = t.xp; R.xp.robotTipDone = t.done;
      g.machines.clearAll();
    }
    // C13 Hole Hunger 5, Deep Hunger 2, hand throw
    S().upgrades.hunger = 5; S().deep.dXp = 2;
    R.xp.handHunger = (await feed(() => fall([hand()]))).xp;
    S().upgrades.hunger = 0; S().deep.dXp = 0;
    // C19 gnome thrown from about 9 m, kicked in mid-air
    {
      placePlayer(7, 3); await frames(2);
      const r = await feed(async () => {
        const n = spawnAt('classic', ahead(1.3, 0, 1.2));
        g.gnomes.hold(n); g.gnomes.drop(n, new V3(0, 0.1, 0));
        R.money.kickedMidAirDist = +g.env.holeDist(n.throwPos.x, n.throwPos.z).toFixed(2);
        await frames(2); // the physics query sees a new collider after one step
        R.money.kickedMidAirTouched = n.touchedGround;
        g.player.kickHit();
        R.money.kickedMidAirBy = n.thrownBy;
        return fall([n]);
      });
      R.xp.kickedMidAir = r.xp; R.money.kickedMidAir = r.money;
      placePlayer(14, 3); await frames(2);
    }

    // ---- B: no slow-mo (the game clock per frame equals the clamped real frame time)
    // the wheel gets the clamped real frame time each frame (main.ts): game dt of a frame / its clamped real dt
    let ratios = []; let lastT = null; let lastReal = 0;
    const slow0 = g.player.wheel.slow.bind(g.player.wheel);
    g.player.wheel.slow = (real) => { if (lastT !== null && lastReal > 0) ratios.push((g.time - lastT) / lastReal); lastT = g.time; lastReal = real; return slow0(real); };
    const sample = async (n = 30) => {
      ratios = []; lastT = null;
      await frames(n + 1);
      const r = ratios.slice(0, n);
      return { ratioMin: +Math.min(...r).toFixed(6), ratioMax: +Math.max(...r).toFixed(6), frames: r.length };
    };
    {
      // 5.5 s between the cases: the old slow-mo had a 5 s cooldown (the King of C12 started one), so each case could trigger it
      clearGnomes(); S().holeXp = 0;
      // the rumble of the old slow-mo stays at combo 60, combo 100 and an eaten King
      let rumbles = 0;
      const rumble0 = g.audio.rumble.bind(g.audio);
      g.audio.rumble = (v) => { if (v === 0.3) rumbles++; return rumble0(v); };
      await sleep(5500);
      g.hole.combo = 59; g.hole.comboTimer = 1e9;
      const a = fall([hand()]); await waitGone(a);
      R.combo60 = { ...(await sample()), combo: g.hole.combo };
      await sleep(5500);
      g.hole.combo = 99; g.hole.comboTimer = 1e9;
      const b = fall([hand()]); await waitGone(b);
      R.combo100 = { ...(await sample()), combo: g.hole.combo };
      await sleep(5500);
      g.hole.combo = 0; g.hole.comboTimer = 0;
      const xp0 = S().holeXp;
      const k = fall([spawnAt('king', ahead(3, 0, 1))]); await waitGone(k);
      R.kingEaten = { ...(await sample()), xp: +(S().holeXp - xp0).toFixed(6) };
      R.rumbleMoments = rumbles;
      g.audio.rumble = rumble0;
      await sleep(5500);
      const be = hand(); be.bullseye = true; fall([be]); await waitGone([be]);
      R.bullseye = await sample();
    }
    {
      await cdp({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 } });
      await frames(20);
      R.wheel.open = g.player.wheel.open;
      R.wheel.timeScale = +g.player.wheel.timeScale.toFixed(4);
      await cdp({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 } });
      const t0 = performance.now();
      R.wheel.trace = [];
      while (performance.now() - t0 < 300) { await frames(1); R.wheel.trace.push(`${g.player.wheel.open ? 'O' : 'c'}${g.input.keys.has('Tab') ? 'T' : ''}:${g.player.wheel.timeScale.toFixed(2)}`); }
      R.wheel.timeScaleAfter = g.player.wheel.timeScale;
      R.wheel.closed = !g.player.wheel.open;
      if (R.wheel.closed) R.wheel.trace = R.wheel.trace.slice(0, 3);
    }
    g.player.wheel.slow = slow0;
    R.legendHasSlowmo = /slow motion|slowmo/i.test(g.legend.mushrooms() + g.legend.gnomes() + g.legend.mechanics() + g.legend.tools());
    {
      const cards = g.legend.gnomes();
      const i = cards.indexOf('<b>King Gnome</b>');
      R.legend.kingCard = i >= 0 ? cards.slice(i, i + 160).replace(/<[^>]+>/g, '') : null;
      const m = g.legend.mechanics().match(/<h3>Hole levels<\/h3><p>(.*?)<\/p>/s);
      R.legend.xpRule = m ? m[1] : null;
    }

    // C14 old save: fractional XP, HUD floors it
    {
      const KEY = 'gnome-boozed-save-v1';
      const keep = g.state;
      const fx = freshState(); fx.holeLevel = 7; fx.holeXp = 123.4;
      localStorage.setItem(KEY, JSON.stringify(fx));
      const L = loadState();
      R.load.holeXp = L.holeXp;
      setState(L);
      await frames(4);
      const txt = g.hud.root.textContent;
      R.load.hud = (txt.match(/XP \d+ \/ \d+/) ?? [null])[0];
      // D5 old save with 4 fans and 6 belts
      const fo = freshState(); fo.upgrades.fan = 4; fo.upgrades.conveyor = 6;
      localStorage.setItem(KEY, JSON.stringify(fo));
      const L2 = loadState();
      R.oldSave.fan = L2.upgrades.fan; R.oldSave.conveyor = L2.upgrades.conveyor;
      localStorage.removeItem(KEY);
      setState(keep);
      await frames(2);
    }

    // ---- D: limits, fuses, cost
    {
      const s = S();
      s.money = 1e9; s.upgrades.fan = 4; s.upgrades.conveyor = 6;
      const buy = (id, n) => { const out = []; for (let i = 0; i < n; i++) { const m0 = s.money; g.shop.buy(id); out.push(Math.round(m0 - s.money)); } return out; };
      R.shop.fanPrices = buy('fan', 6);
      R.shop.fanExtra = buy('fan', 1)[0];
      R.shop.conveyorPrices = buy('conveyor', 4);
      g.machines.clearAll();
      await frames(3);
      const slot = [...document.querySelectorAll('.hud-hotbar .slot')].find((e) => e.textContent.includes('Cooling Fan'));
      R.hotbar.fan = slot?.querySelector('.c')?.textContent ?? null;
      for (let i = 0; i < 10; i++) g.machines.place('fan', new V3(-16 + i * 1.6, 0, 16), Q());
      for (let i = 0; i < 10; i++) g.machines.place('conveyor', new V3(-16 + i * 1.8, 0, 12), Q());
      R.placed.fan = g.machines.placedCount('fan'); R.placed.fanFree = g.machines.available('fan');
      R.placed.conveyor = g.machines.placedCount('conveyor'); R.placed.conveyorFree = g.machines.available('conveyor');
      g.machines.clearAll();
    }
    {
      const s = S();
      let i = 0;
      for (const id of TOOL_IDS) {
        const u = UPGRADES.find((x) => x.id === id);
        s.upgrades[id] = u.max;
        for (let k = 0; k < u.max; k++, i++) g.machines.place(id, new V3(-20 + (i % 14) * 3, 0, -20 + Math.floor(i / 14) * 3.2), Q());
      }
      for (const id of FUSE_TOOLS) s.upgrades[`${id}Fuses`] = 5;
      g.machines.drawFuses();
      R.fuses.count = g.machines.fuseMesh.count;
      R.fuses.boxes = g.machines.boxMesh.count;
      R.fuses.skipped = g.machines.list.filter((m) => fuseCount(m) > 0 && m.fuseSlot < 0).length;
      R.fuses.tools = g.machines.list.length;
      g.machines.clearAll();
      await frames(2);
    }
    {
      const s = S();
      s.upgrades.permit = 5;
      clearGnomes();
      await frames(3);
      R.perf.drawCalls0 = g.renderer.info.render.calls;
      for (let i = 0; i < 10; i++) g.machines.place('fan', new V3(-16 + i * 1.6, 0, 16), Q());
      for (let i = 0; i < 10; i++) g.machines.place('conveyor', new V3(-16 + i * 1.8, 0, 12), Q());
      await frames(3);
      R.perf.drawCalls20 = g.renderer.info.render.calls;
      const types = ['classic', 'classic', 'classic', 'dwarf', 'angry', 'greedy'];
      for (let i = 0; g.gnomes.list.length < 300 && i < 2000; i++) spawnAt(types[i % types.length], new V3(-18 + (i % 30) * 1.2, 0.6, -2 + Math.floor(i / 30) * 1.4));
      R.perf.gnomes = g.gnomes.list.length;
      const times = [];
      const up0 = g.machines.update.bind(g.machines);
      g.machines.update = (dt) => { const t = performance.now(); up0(dt); times.push(performance.now() - t); };
      await frames(80);
      g.machines.update = up0;
      times.sort((a, b) => a - b);
      R.perf.machinesP95 = +times[Math.floor(times.length * 0.95)].toFixed(3);
      R.perf.machinesMedian = +times[Math.floor(times.length / 2)].toFixed(3);
      g.machines.clearAll();
      clearGnomes();
      await frames(2);
    }
    {
      const s = S();
      s.upgrades.fan = 4;
      const h = g.env.hole;
      g.blueprints.slots[0] = { at: Date.now(), items: [0, 1, 2, 3].map((k) => ({ type: 'fan', x: 12 - h.x, y: 0 - h.y, z: -6 + k * 3 - h.z, yaw: 0, tilt: 0, qx: 0, qy: 0, qz: 0, qw: 1 })) };
      g.blueprints.load(0);
      R.blueprint.placedFans = g.machines.placedCount('fan');
      g.blueprints.slots[0] = null;
      g.machines.clearAll();
      await frames(2);
    }
    // ---- E: fuses per piece
    {
      const s = S();
      s.upgrades.fan = 2; s.upgrades.robot = 1;
      for (const id of FUSE_TOOLS) s.upgrades[`${id}Fuses`] = 5;
      const a = g.machines.place('fan', new V3(10, 0, -8), Q());
      const b = g.machines.place('fan', new V3(13, 0, -8), Q());
      g.machines.breakMachine(a); g.machines.breakMachine(a);
      g.machines.drawFuses();
      const reds = (m) => [0, 1, 2, 3, 4].filter((i) => g.machines.fuseColor(m, i) === 'red').length;
      await sleep(400); // let the blow animation end, so the red count is the steady state
      R.fuses.fanA = reds(a); R.fuses.fanB = reds(b);
      g.machines.clearAll();
      g.machines.place('box', new V3(10, 0.5, -8), Q());
      g.machines.place('panel', new V3(13, 0, -8), Q());
      R.saboteur.targetWithOnlyCrateAndPanel = g.machines.nearestWorking(new V3(11, 0, -8));
      g.machines.clearAll();
      const r = g.machines.place('robot', new V3(10, 0, -8), Q());
      g.machines.breakMachine(r);
      R.fuses.robotBlown = r.blown;
      g.machines.clearAll();
    }

    // ---- A: event draw and the level-10 King
    const pool = (level, night, kingAlive = false) => {
      S().holeLevel = level;
      Object.defineProperty(g.env, 'isNight', { get: () => night, configurable: true });
      clearGnomes();
      if (kingAlive) spawnAt('king', new V3(10, 1, -8));
      const p = EVENTS.filter((e) => e.ok());
      delete g.env.isNight;
      const total = p.reduce((a, e) => a + e.weight, 0);
      const w = (id) => p.find((e) => e.id === id)?.weight ?? 0;
      return { share: (id) => +(w(id) / total).toFixed(4), has: (id) => p.some((e) => e.id === id), w };
    };
    {
      const l6 = pool(6, false); R.ufoShareL6 = l6.share('ufo');
      const l10 = pool(10, false); R.kingShareL10 = l10.share('king'); R.ufoShareL10 = l10.share('ufo');
      const n10 = pool(10, true); R.kingShareL10night = n10.share('king'); R.ufoShareL10night = n10.share('ufo');
      const ka = pool(10, false, true); R.kingInPoolWhileAlive = ka.has('king'); R.ufoWeightWhileKingAlive = ka.w('ufo');
      R.ufoInPoolL3 = pool(3, false).has('ufo'); R.kingInPoolL9 = pool(9, false).has('king');
      clearGnomes();
    }
    {
      const kings = () => g.gnomes.list.filter((x) => x.type.id === 'king' && x.state !== 'gone').length + g.factory.queue.filter((q) => q.typeId === 'king').length;
      g.events.next = 1e9;
      const s = S();
      clearGnomes();
      s.holeLevel = 9; s.holeXp = g.hole.xpNeeded - 0.5;
      fall([hand()]);
      for (let i = 0; i < 600 && s.holeLevel < 10; i++) await frames(1);
      let t0 = performance.now();
      while (performance.now() - t0 < 7000) await frames(1);
      R.kingAfterLevel10 = kings();
      R.levelAfterHand = s.holeLevel;
      clearGnomes();
      await sleep(200);
      s.holeLevel = 9; s.holeXp = 1800 + 2500 - 0.1;
      const m = g.machines.place('box', new V3(10, 0.5, -6), Q());
      const n = spawnAt('classic', new V3(10, 1, -6)); g.gnomes.stash(n); m.queue.push(n);
      const h = g.env.hole;
      g.machines.updateCrate(m, { x: h.x, y: 0.5, z: h.z }, { x: 0, y: 0, z: 0, w: 1 });
      R.levelAfterDump = s.holeLevel;
      t0 = performance.now();
      while (performance.now() - t0 < 7000) await frames(1);
      R.kingAfter9to11 = kings();
      g.machines.clearAll();
    }
  } catch (e) {
    R.error = String(e && e.stack || e);
  }
  // ---- verdicts per Done-when line
  const x = R.xp, m = R.money, B = window.MONEY_BEFORE ?? null;
  const eq = (a, b) => B ? near(a, b, 1e-3) : null;
  // shares without GOLDEN HOUR: it is a mushroom now, not a random event (PP 2026-10-21); L6 day pool 22, L10 day 25, L10 night 28
  ok('A1', near(R.ufoShareL6, 0.227, 0.002), R.ufoShareL6);
  ok('A2', near(R.kingShareL10, 0.12, 0.001) && near(R.ufoShareL10, 0.2, 0.001), `${R.kingShareL10} ${R.ufoShareL10}`);
  ok('A3', near(R.kingShareL10night, 0.107, 0.001) && near(R.ufoShareL10night, 0.179, 0.001), `${R.kingShareL10night} ${R.ufoShareL10night}`);
  ok('A4', R.kingInPoolWhileAlive === false && R.ufoWeightWhileKingAlive === 5, `${R.kingInPoolWhileAlive} ${R.ufoWeightWhileKingAlive}`);
  ok('A5', R.kingAfterLevel10 === 1 && R.kingAfter9to11 === 1, `${R.kingAfterLevel10} ${R.kingAfter9to11} levels ${R.levelAfterHand}/${R.levelAfterDump}`);
  ok('A6', R.ufoInPoolL3 === false && R.kingInPoolL9 === false);
  const dt1 = (o) => o && o.frames >= 30 && near(o.ratioMin, 1) && near(o.ratioMax, 1);
  ok('B1', dt1(R.combo60) && R.combo60.combo >= 60, JSON.stringify(R.combo60));
  ok('B2', dt1(R.combo100) && R.combo100.combo >= 100, JSON.stringify(R.combo100));
  ok('B3', dt1(R.kingEaten) && near(R.kingEaten.xp, 1000), JSON.stringify(R.kingEaten));
  ok('B4', R.bullseye && R.bullseye.frames >= 30 && near(R.bullseye.ratioMin, 1), JSON.stringify(R.bullseye));
  ok('B5', near(R.wheel.timeScale, 0.25, 0.005) && R.wheel.timeScaleAfter === 1, JSON.stringify(R.wheel));
  ok('B6', R.legendHasSlowmo === false);
  ok('B7', R.rumbleMoments === 3, R.rumbleMoments);
  ok('C1', near(x.hand, 1), x.hand);
  ok('C2', near(x.volley4, 0.5) && near(x.volley4sum, 2) && near(x.volley16, 0.25), `${x.volley4} ${x.volley16}`);
  ok('C3', near(x.trampolineThrow, 1) && x.trampolineBounced === true, x.trampolineThrow);
  ok('C4', near(x.handDrop, 1) && near(x.ballRelease4, 0.5), `${x.handDrop} ${x.ballRelease4}`);
  ok('C5', near(x.kick, 0.25) && R.strike.kickBallCounted === true, `${x.kick} ${R.strike.kickBallCounted}`);
  ok('C6', near(x.pound, 0.25), x.pound);
  ok('C7', near(x.plow, 0.25) && near(x.blower, 0.25) && x.plowHit && x.blowHit, `${x.plow} ${x.blower}`);
  // a crate dump pays full XP since 2026-10-25 (PP 2026-10-24 "pelne xp dla skrzyni"): two gnomes x1
  ok('C8', near(x.crate2, 2) && eq(m.crate2, B?.crate2) !== false, `${x.crate2} money ${m.crate2} before ${B?.crate2}`);
  ok('C9', near(x.fanWalker, 0.25), x.fanWalker);
  ok('C10', near(x.vacuumThrown, 0.25) && near(x.robotTip, 0.25) && eq(m.vacuumThrown, B?.vacuumThrown) !== false, `${x.vacuumThrown} ${x.robotTip} money ${m.vacuumThrown} before ${B?.vacuumThrown}`);
  ok('C11', near(x.walkIn, 0.25), x.walkIn);
  ok('C12', near(x.kingByFan, 1000), x.kingByFan);
  ok('C13', near(x.handHunger, 2.25), x.handHunger);
  ok('C14', R.load.holeXp === 123.4 && R.load.hud === 'XP 123 / 900', `${R.load.holeXp} ${R.load.hud}`);
  ok('C15', near(x.crateTip2, 0.5) && near(m.crateTipSniper, m.plain, 1e-3), `${x.crateTip2} money ${m.crateTipSniper} plain ${m.plain}`);
  ok('C16', near(x.toolRemoveSpill, 0.25), x.toolRemoveSpill);
  ok('C17', near(x.ballLowered4, 0.5) && near(x.ballToppedUp6, 0.408, 0.002), `${x.ballLowered4} ${x.ballToppedUp6} n=${x.ballToppedUpN}`);
  ok('C18', eq(m.regrabBall20, B?.regrabBall20) !== false && near(x.regrabBall20, 0.224, 0.002), `${x.regrabBall20} money ${m.regrabBall20} before ${B?.regrabBall20} dist ${m.regrabThrowDist}`);
  ok('C20', x.slipRegrabHeld === true && x.slipRegrabN === 4 && near(x.slipRegrab4, 0.5), `${x.slipRegrab4} n=${x.slipRegrabN} held ${x.slipRegrabHeld}`);
  ok('C19',near(x.kickedMidAir, 0.25) && near(m.kickedMidAir, m.plain, 1e-3), `${x.kickedMidAir} money ${m.kickedMidAir} plain ${m.plain} dist ${m.kickedMidAirDist}`);
  // upgradeCost rounds up (Math.ceil): 200 x 1.4^4 = 768.3 costs $769; 20 fans since 2026-10-21, the 11th exists, Tools have no late surcharge
  ok('D1', JSON.stringify(R.shop.fanPrices) === '[769,1076,1506,2109,2952,4133]' && R.hotbar.fan === '11/11' && R.placed.fan === 10 && R.placed.fanFree === 1 && R.shop.fanExtra === 5786, `${R.shop.fanPrices} ${R.hotbar.fan} ${R.placed.fan} free ${R.placed.fanFree} extra ${R.shop.fanExtra}`);
  ok('D2', JSON.stringify(R.shop.conveyorPrices) === '[2848,4272,6408,9611]' && R.placed.conveyor === 10, `${R.shop.conveyorPrices} ${R.placed.conveyor}`);
  ok('D3', R.fuses.count === 270 && R.fuses.boxes === 54 && R.fuses.skipped === 0, `${R.fuses.count} ${R.fuses.boxes} ${R.fuses.skipped}`);
  ok('D4', R.perf.machinesP95 <= 1.5 && R.perf.drawCalls0 > 0 && R.perf.drawCalls20 > 0, JSON.stringify(R.perf));
  ok('D5', R.oldSave.fan === 4 && R.blueprint.placedFans === 4, `${R.oldSave.fan} ${R.blueprint.placedFans}`);
  ok('E1', R.fuses.fanA === 2 && R.fuses.fanB === 0, `${R.fuses.fanA} ${R.fuses.fanB}`);
  ok('E2', R.saboteur.targetWithOnlyCrateAndPanel === null);
  ok('E3', R.fuses.robotBlown === 1);
  ok('F1', (R.legend.kingCard ?? '').includes('1000 XP') && (R.legend.xpRule ?? '').includes('quarter'), `${R.legend.kingCard?.slice(0, 50)} | ${R.legend.xpRule}`);
  window.__done = JSON.stringify({ ...R, checks });
})();
