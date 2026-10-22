// Auto-lands (docs/ai-work/2026-10-20-plan-auto-lands.md, "Done when"; work note docs/ai-work/2026-10-21-auto-lands.md):
// the yard grows by itself at hole levels 3 / 5 / 8, toward +x / +z, and the hole changes side with every land (L6).
// One RESULT JSON with `checks` (PASS/FAIL lines, one per step). Run (several minutes; URL_QUERY='' so fireflies draw):
// FAKELOCK=1 URL_QUERY='' DEV_PORT=5199 CDP_PORT=9373 MAXPOLL=4000 node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-auto-lands.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const g = window.gnome;
const checks = [];
const R = {};
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
const KEY = 'gnome-boozed-save-v1';
setTimeout(() => { if (!window.__done) window.__done = JSON.stringify({ ...R, checks, errors, timeout: true }); }, 1500000);
(async () => {
  try {
    const { freshState, blockSaves } = await import('/src/core/state.ts');
    const { Props } = await import('/src/entities/props.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    const { LAND, LAND_STEP, landFor } = await import('/src/data/land.ts');
    const { LETTER_SPOTS } = await import('/src/data/letters.ts');
    const { HOLE_LEVELS, holeLevel } = await import('/src/data/holeLevels.ts');
    // the main page never writes the save: the iframes in 06 own it
    blockSaves();
    g.moods.update = () => {};
    g.contracts.update = () => {};
    g.events.spawnVisitor = () => {};
    g.events.next = 1e9;
    for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';
    g.paused = false;
    const V3 = g.camera.position.constructor;
    const Qt = g.camera.quaternion.constructor;
    const Q = () => new Qt();
    const Env = g.env.constructor;
    const holeAt = (level, land) => Env.holeCenterFor(level, land);
    const DIR = new V3(7.5, 0, 13).normalize();
    const FACTORY = new V3(-7.5, 0, -13);
    const maxOf = (land) => 2 * LAND[land].half - 22;
    const near = (a, b, eps) => Math.abs(a - b) <= eps;
    const xz = (v) => `(${v.x.toFixed(2)},${v.z.toFixed(2)})`;
    const gameWait = async (sec) => { const t0 = g.time; for (let i = 0; i < 20000 && g.time - t0 < sec; i++) await frames(1); };
    const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
    const placePlayer = (x, z, yaw = 0) => {
      g.player.body.setTranslation({ x, y: 1.2, z }, true);
      g.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.player.position.set(x, 1.2, z);
      g.player.yaw = yaw;
    };
    // a new state as after a reload with that save: env, props and goals rebuilt, no tools, no gnomes
    const setState = async (st) => {
      clearGnomes();
      g.machines.clearAll();
      for (const p of g.props.list) { g.physics.removeRigidBody(p.body); g.scene.remove(p.mesh); }
      if (g.props.shovel) g.scene.remove(g.props.shovel);
      g.state = st;
      g.goals = new Goals();
      g.goals.update = () => {};
      g.env.rebuildHole();
      g.env.rebuildLand();
      g.props = new Props();
      await gameWait(0.5);
    };
    // the land a save at that level holds (loadState derives it the same way)
    const fresh = (patch = {}) => { const st = Object.assign(freshState(), { money: 1e9 }, patch); st.land = landFor(st.holeLevel); return st; };
    // a level-up through Hole.addXp, the same loop a feed or a crate dump runs (any positive XP crosses the bar)
    const levelBy = (n = 1) => {
      const s = g.state;
      let need = 0;
      for (let i = 0; i < n; i++) need += HOLE_LEVELS[s.holeLevel - 1 + i].xp;
      s.holeXp = need - 0.01;
      g.hole.addXp(0.02);
    };
    const toastTexts = () => [...document.querySelectorAll('.hud-toasts > *')].map((e) => e.textContent);
    placePlayer(-15, -5);
    await frames(5);

    // ---- 01_formula: every hole spot on its land's line from the factory (the Backyard line turned by LAND[L].turn),
    // at 15 + 4 L + 1.2 (n - 1) m, inside its land
    const landDir = (L) => DIR.clone().applyAxisAngle(new V3(0, 1, 0), -LAND[L].turn * Math.PI / 180);
    {
      let rows = 0, offline = 0, minMargin = Infinity, minFar = Infinity;
      const bad = [];
      const spots = [new V3(7.5, 0, -13), new V3(0, 0, -27.5), new V3(-20.4, 0, 20.6)]; // desk, house, shovel
      for (let L = 0; L < LAND.length; L++) {
        const u = landDir(L);
        for (let n = 1; n <= 12; n++) {
          rows++;
          const c = holeAt(n, L);
          const f = c.clone().sub(FACTORY);
          if (Math.abs(f.x * u.z - f.z * u.x) >= 0.05 || f.dot(u) <= 0) offline++;
          const want = 15 + LAND_STEP * L + 1.2 * (n - 1);
          if (!near(f.length(), want, 0.05)) bad.push(`L${L}n${n} dist ${f.length().toFixed(2)} want ${want}`);
          const r = holeLevel(n).radius;
          const margin = Math.min(c.x + 22, c.z + 22, maxOf(L) - c.x, maxOf(L) - c.z) - r;
          minMargin = Math.min(minMargin, margin);
          minFar = Math.min(minFar, ...spots.map((s) => s.distanceTo(c) - r));
        }
      }
      const l12 = holeAt(12, 3);
      const d1 = LAND.map((_, L) => holeAt(1, L).distanceTo(FACTORY).toFixed(0)).join(',');
      R.formula = { rows, offline, minMargin: +minMargin.toFixed(2), minFar: +minFar.toFixed(2), l12: xz(l12), d1, bad };
      ok('01_formula', rows === 48 && offline === 0 && minMargin >= 2 && minFar >= 8 && !bad.length, JSON.stringify(R.formula));
      ok('01_formula_L12', near(l12.x, 30.28, 0.05) && near(l12.z, 0.77, 0.05), xz(l12));
      ok('01_formula_dist', d1 === '15,19,23,27', d1);
      // L6 (PP 2026-10-21 "Dziura musi zmieniać stronę"): the first spot of each new land lies off the Backyard line,
      // on the other side than the land before
      const lateral = LAND.slice(1).map((t, i) => { const f = holeAt(t.hole, i + 1).clone().sub(FACTORY); return f.x * DIR.z - f.z * DIR.x; });
      const sides = lateral.every((s, i) => Math.abs(s) >= 5 && (i === 0 || Math.sign(s) !== Math.sign(lateral[i - 1])));
      ok('01_formula_side', sides, `lateral m ${lateral.map((s) => s.toFixed(1))}`);
    }

    // ---- 02_levelup_garden: a crate dump at the level-2 rim brings the Garden; the hole slides, tools follow or go
    {
      await setState(fresh({ holeLevel: 2, upgrades: { box: 1, fan: 2 } }));
      placePlayer(-15, -5);
      const c0 = g.env.hole.clone();
      const r0 = g.env.holeRadius;
      const perp = new V3(-DIR.z, 0, DIR.x);
      const crate = g.machines.place('box', DIR.clone().multiplyScalar(4.2), Q());
      const fanA = g.machines.place('fan', holeAt(3, 1), Q());
      // on the other side of the path than the crate's new home (carry puts it beside the path, on the +perp side here)
      const fanB = g.machines.place('fan', c0.clone().addScaledVector(perp, -(r0 + 1.0)), Q());
      await frames(3);
      const gn = g.gnomes.spawn('classic', crate.pos.clone().setY(1.5), { tier: 'normal', awake: false });
      g.gnomes.stash(gn);
      crate.queue.push(gn);
      g.state.holeXp = g.hole.xpNeeded - 0.01;
      crate.body.setTranslation({ x: c0.x, y: 0.6, z: c0.z }, true);
      crate.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      // sample the slide, the fence growing and the crate's teleports (a jump > 2 m in one frame = a respawn)
      const dists = [];
      const fence = [];
      let jumps = 0;
      let last = crate.body.translation();
      let t0 = null;
      let arrived = null;
      let midShot = false;
      for (let i = 0; i < 400; i++) {
        await frames(1);
        const t = crate.body.translation();
        if (Math.hypot(t.x - last.x, t.z - last.z) > 2) jumps++;
        last = t;
        if (g.state.holeLevel < 3) continue;
        t0 ??= g.time;
        fence.push(g.env.fenceGroup.scale.y);
        if (g.env.sliding) {
          dists.push(g.env.hole.distanceTo(c0));
          if (!midShot && g.time - t0 > 0.4) { midShot = true; await shot('auto-lands-slide-mid'); }
        } else if (arrived === null) arrived = g.time - t0;
        if (arrived !== null && g.time - t0 > 3.5) break;
      }
      const increasing = dists.length >= 3 && dists.every((d, i) => i === 0 || d >= dists[i - 1]);
      const at = g.env.hole.distanceTo(holeAt(3, 1));
      const rimB = fanB.pos.distanceTo(g.env.hole) - g.env.holeRadius;
      const crateHome = Math.hypot(crate.home.x - g.env.hole.x, crate.home.z - g.env.hole.z);
      const ct = crate.body.translation();
      const fenceMid = fence.some((v) => v > 0.05 && v < 0.95);
      const fenceOver = fence.some((v) => v > 1.01);
      const toast = toastTexts().some((t) => t.includes('The hole moved! Tools in its way went back to your inventory.'));
      R.garden = { land: g.state.land, level: g.state.holeLevel, max: g.env.max.z, min: g.env.min.z, arrived, samples: dists.length, increasing, at: +at.toFixed(3), fanA: g.machines.list.includes(fanA) ? 'there' : 'gone', rimB: +rimB.toFixed(2), crateHome: +crateHome.toFixed(2), jumps, crateY: +ct.y.toFixed(2), crateInList: g.machines.list.includes(crate), fenceMid, fenceOver, toast, cards: toastTexts().map((t) => t.slice(0, 40)) };
      ok('02_levelup_garden', g.state.land === 1 && g.env.max.z === 42 && g.env.max.x === 42 && g.env.min.z === -22 && arrived !== null && arrived <= 1.5 && increasing && at < 0.05 && !g.machines.list.includes(fanA) && near(rimB, 1.0, 0.3) && toast, JSON.stringify(R.garden));
      ok('02_crate', crateHome >= 3.4 - 1e-3 && jumps === 1 && ct.y > 0 && g.machines.list.includes(crate), `home ${crateHome.toFixed(2)} respawns ${jumps} y ${ct.y.toFixed(2)}`);
      ok('02_fence_rise', fenceMid && fenceOver, `fence scale samples ${fence.slice(0, 8).map((v) => v.toFixed(2))}`);
    }

    // ---- 03_levelup_plain: 3 -> 4 on the Garden: no land change, the hole moves 1.2 m, no slide
    {
      const c0 = g.env.hole.clone();
      levelBy();
      const sliding = g.env.sliding;
      await frames(2);
      const moved = g.env.hole.distanceTo(c0);
      R.plain = { level: g.state.holeLevel, land: g.state.land, moved: +moved.toFixed(3), sliding };
      ok('03_levelup_plain', g.state.holeLevel === 4 && g.state.land === 1 && near(moved, 1.2, 0.05) && !sliding, JSON.stringify(R.plain));
    }

    // ---- 04_slide_posts: the Garden -> Lawn slide with four robots: A and B beside the new spot on the same side,
    // C behind the old hole (where stepOutPost keeps a post), D on a belt in the middle of the path (post 0.9 m up)
    {
      g.machines.clearAll();
      g.state.upgrades.robot = 4;
      g.state.upgrades.conveyor = 1;
      const from = g.env.hole.clone();
      const to = holeAt(5, 2);
      const u = to.clone().sub(from).setY(0).normalize();
      const side = new V3(-u.z, 0, u.x);
      const rA = g.machines.place('robot', to.clone().addScaledVector(side, 1.0), Q());
      const rB = g.machines.place('robot', to.clone().addScaledVector(side, 2.5), Q());
      const rC = g.machines.place('robot', from.clone().addScaledVector(u, -(g.env.holeRadius + 3.0)), Q());
      const mid = from.clone().lerp(to, 0.5);
      g.machines.place('conveyor', mid, Q());
      await frames(3);
      const rD = g.machines.place('robot', mid.clone().setY(3), Q());
      await frames(3);
      const c0 = rC.pos.clone();
      const dY0 = rD.pos.y;
      levelBy();
      await gameWait(4);
      const robots = [rA, rB, rC, rD];
      let minGap = Infinity;
      for (let i = 0; i < robots.length; i++) for (let j = i + 1; j < robots.length; j++) minGap = Math.min(minGap, Math.hypot(robots[i].pos.x - robots[j].pos.x, robots[i].pos.z - robots[j].pos.z));
      const blocked = robots.filter((m) => g.machines.poleBlocked(m)).length;
      const placed = robots.filter((m) => g.machines.list.includes(m)).length;
      const cMoved = rC.pos.distanceTo(c0);
      R.slidePosts = { land: g.state.land, placed, minGap: +minGap.toFixed(2), blocked, cMoved: +cMoved.toFixed(2), dY0: +dY0.toFixed(2), dY: +rD.pos.y.toFixed(2), posts: robots.map((m) => xz(m.pos)) };
      ok('04_slide_spread', g.state.land === 2 && placed === 4 && minGap >= 3.2 && blocked === 0, JSON.stringify(R.slidePosts));
      ok('04_slide_behind', cMoved < 0.05, `post behind the old hole moved ${cMoved.toFixed(2)} m`);
      ok('04_slide_ground', dY0 > 0.3 && Math.abs(rD.pos.y) < 0.05 && Math.abs(rD.marker.position.y) < 0.05, `post on the belt y ${dY0.toFixed(2)} -> ${rD.pos.y.toFixed(2)}, marker ${rD.marker.position.y.toFixed(2)}`);
      await setState(fresh({ holeLevel: 4, upgrades: { box: 1, fan: 2 } }));
      placePlayer(-15, -5);
    }

    // ---- 04_slide_fan: the Garden -> Lawn slide with a fan at the old rim that the hole carries beside the new spot,
    // and a robot post on the path whose first spot beside the new hole has its pole where the fan glides to
    {
      g.machines.clearAll();
      g.state.upgrades.robot = 1;
      const from = g.env.hole.clone();
      const to = holeAt(5, 2);
      const oldR = g.env.holeRadius;
      const u = to.clone().sub(from).setY(0).normalize();
      const side = new V3(-u.z, 0, u.x);
      const fan = g.machines.place('fan', from.clone().addScaledVector(side, oldR + 1.4), Q());
      // the pole (1.2 m behind the post) faces the new hole once the post stands beside it
      const robot = g.machines.place('robot', to.clone().addScaledVector(side, 1.0), new Qt().setFromAxisAngle(new V3(0, 1, 0), Math.atan2(side.x, side.z)));
      await frames(3);
      levelBy();
      await gameWait(4);
      const yaw = robot.marker.rotation.y;
      const pole = { x: robot.pos.x - Math.sin(yaw) * 1.2, z: robot.pos.z - Math.cos(yaw) * 1.2 };
      const poleFan = Math.hypot(pole.x - fan.pos.x, pole.z - fan.pos.z);
      R.slideFan = { land: g.state.land, fan: g.machines.list.includes(fan) ? xz(fan.pos) : 'gone', post: xz(robot.pos), poleFan: +poleFan.toFixed(2), blocked: g.machines.poleBlocked(robot) };
      ok('04_slide_fan', g.state.land === 2 && g.machines.list.includes(fan) && g.machines.list.includes(robot) && !R.slideFan.blocked && poleFan >= 1.1, JSON.stringify(R.slideFan));
      await setState(fresh({ holeLevel: 4, upgrades: { box: 1, fan: 2 } }));
      placePlayer(-15, -5);
    }

    // ---- 04_lawn_forest: 4 -> 5 (a robot station where the new hole arrives), 7 -> 8, then a two-level chain
    {
      g.machines.clearAll();
      g.state.upgrades.robot = 1;
      const robot = g.machines.place('robot', holeAt(5, 2), Q());
      await frames(3);
      levelBy();
      let fell = 0;
      let postOut = false;
      const t0 = g.time;
      for (let i = 0; i < 20000 && g.time - t0 < 20; i++) {
        await frames(1);
        if (!g.machines.list.includes(robot)) break;
        if (robot.body.translation().y < -1) fell++;
        if (g.time - t0 < 2 && robot.pos.distanceTo(g.env.hole) >= g.env.holeRadius + 1) postOut = true;
      }
      const lawnHole = g.env.hole.distanceTo(holeAt(5, 2));
      R.lawn = { land: g.state.land, max: g.env.max.x, hole: xz(g.env.hole), err: +lawnHole.toFixed(3), robotPlaced: g.machines.list.includes(robot), postOut, fell };
      ok('04_lawn', g.state.land === 2 && g.env.max.x === 66 && g.env.max.z === 66 && lawnHole < 0.05, JSON.stringify(R.lawn));
      ok('04_robot', g.machines.list.includes(robot) && postOut && fell === 0, `post out of the hole within 2 s ${postOut}, frames in the hole ${fell}`);

      g.machines.clearAll();
      g.state.holeLevel = 7;
      g.env.rebuildHole();
      levelBy();
      // the 35.5 m slide runs at about 12 m/s: about 3 s, never the old 1 s dash
      const tf0 = g.time;
      for (let i = 0; i < 20000 && g.env.sliding && g.time - tf0 < 6; i++) await frames(1);
      const slideTime = g.time - tf0;
      await gameWait(0.5);
      const forestHole = g.env.hole.distanceTo(holeAt(8, 3));
      const ach = g.state.achievements.includes('land');
      R.forest = { land: g.state.land, max: g.env.max.x, hole: xz(g.env.hole), err: +forestHole.toFixed(3), ach, slideTime: +slideTime.toFixed(2) };
      ok('04_forest', g.state.land === 3 && g.env.max.x === 94 && forestHole < 0.05 && ach && slideTime >= 2.5 && slideTime <= 3.5, JSON.stringify(R.forest));

      // a dump worth two levels that crosses a land switch: the second level-up runs during the slide
      await setState(fresh({ holeLevel: 4 }));
      const e0 = errors.length;
      levelBy(2);
      await gameWait(1.5);
      const chainHole = g.env.hole.distanceTo(holeAt(6, 2));
      R.chain = { level: g.state.holeLevel, land: g.state.land, err: +chainHole.toFixed(3), sliding: g.env.sliding, exceptions: errors.length - e0 };
      ok('04_chain', g.state.holeLevel === 6 && g.state.land === 2 && chainHole < 0.05 && !g.env.sliding && errors.length === e0, JSON.stringify(R.chain));
    }

    // ---- 05_bounds: on the Garden every yard reader uses the rectangle (-22..42)
    {
      await setState(fresh({ holeLevel: 3, upgrades: { box: 1, robot: 1 } }));
      placePlayer(-15, -5);
      // the placement rule the ghost uses (player.ts): blocked unless 0.5 m inside the fence
      const placeIn = g.env.inside(0, 30, 0.5);
      const placeBehind = g.env.inside(0, -23, 0.5);
      // a gnome teleported into the new strip walks to a target inside the fence
      // (awake: a classic gnome spawns as a statue, which never picks a target; every target it picks in 2 s counts)
      const gn = g.gnomes.spawn('classic', new V3(0, 0.6, 40), { tier: 'normal', awake: true });
      const targets = [];
      const tw = g.time;
      for (let i = 0; i < 20000 && g.time - tw < 2; i++) {
        await frames(1);
        if (gn?.target && !targets.includes(gn.target)) targets.push(gn.target);
      }
      const tg = targets[targets.length - 1];
      const targetIn = targets.length > 0 && targets.every((t) => g.env.inside(t.x, t.z, 1.4));
      if (gn && gn.state !== 'gone') g.gnomes.remove(gn);
      // a crate kicked out behind the back fence comes back by the desk
      const crate = g.machines.place('box', new V3(10, 0, 30), Q());
      await frames(3);
      crate.body.setTranslation({ x: 0, y: 1, z: -25 }, true);
      await gameWait(1);
      const ct = crate.body.translation();
      const byDesk = Math.hypot(ct.x - g.env.deskPos.x, ct.z - g.env.deskPos.z) < 3;
      g.machines.clearAll();
      // a robot station in the new strip picks up a gnome there and feeds the hole
      const robot = g.machines.place('robot', new V3(0, 0, 30), Q());
      await frames(3);
      const eaten0 = g.state.stats.gnomesEaten;
      // 4 m from the station (robot area 6 m), in the strip the Backyard did not have
      g.gnomes.spawn('classic', new V3(0, 0.6, 34), { tier: 'normal', awake: false });
      const tr = g.time;
      for (let i = 0; i < 40000 && g.state.stats.gnomesEaten === eaten0 && g.time - tr < 40; i++) await frames(1);
      const eaten = g.state.stats.gnomesEaten - eaten0;
      const robotPlaced = g.machines.list.includes(robot);
      g.machines.clearAll();
      clearGnomes();
      // the tornado path stays inside the rectangle
      g.events.tornado.start();
      let tornadoOut = 0;
      for (let i = 0; i < 60; i++) {
        await frames(1);
        const p = g.events.tornado.pos;
        if (!g.env.inside(p.x, p.z, 0.99)) tornadoOut++;
      }
      R.bounds = { placeIn, placeBehind, targetIn, target: tg && xz(tg), byDesk, crate: xz(ct), eaten, robotPlaced, tornadoOut };
      ok('05_bounds', placeIn && !placeBehind && targetIn && byDesk && eaten >= 1 && tornadoOut === 0, JSON.stringify(R.bounds));
    }

    // ---- 06_old_saves: a real boot in an iframe with that save in localStorage
    {
      const bootFrame = async (save, query = '?lowfx') => {
        if (save) localStorage.setItem(KEY, JSON.stringify(save));
        const f = document.createElement('iframe');
        f.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0.01;pointer-events:none';
        f.src = '/' + query;
        document.body.appendChild(f);
        for (let i = 0; i < 300 && !f.contentWindow?.gnome?.shop; i++) await sleep(100);
        await sleep(400);
        const ig = f.contentWindow.gnome;
        const stMod = await f.contentWindow.eval("import('/src/core/state.ts')");
        // notes still queued (the menu pauses the game) plus the ones already shown as toasts
        const notes = [...stMod.loadNotes, ...[...f.contentDocument.querySelectorAll('.hud-toasts > *')].map((e) => e.textContent)];
        return { f, ig, stMod, notes };
      };
      const placed = (type, x, z) => ({ type, x, y: 0, z, yaw: 0, tilt: 0 });
      const lv5 = holeAt(5, 2);
      // (a) level 5 on the Backyard, one fan behind the house and one in the hole
      {
        const { f, ig, notes } = await bootFrame({ version: 1, holeLevel: 5, land: 0, money: 100, upgrades: { fan: 2 }, placed: [placed('fan', -24, -30), placed('fan', lv5.x, lv5.z)] });
        R.oldA = { land: ig.state.land, money: ig.state.money, machines: ig.machines.list.length, notes };
        ok('06_old_saves_a', ig.state.land === 2 && ig.state.money === 100 && ig.machines.list.length === 0 && notes.some((t) => t.includes('2 tools are back in your inventory: no room there.')), JSON.stringify(R.oldA));
        f.remove();
      }
      // (b) a Forest bought on an old save: refund once, every tool beyond the new fence back to the inventory
      {
        const one = await bootFrame({ version: 1, holeLevel: 8, land: 3, money: 0, upgrades: { fan: 1 }, placed: [placed('fan', -24, -34)] });
        const first = { money: one.ig.state.money, version: one.ig.state.version, machines: one.ig.machines.list.length, notes: one.notes };
        one.stMod.saveState(one.ig.state);
        one.f.remove();
        const saved = JSON.parse(localStorage.getItem(KEY));
        const two = await bootFrame(null);
        R.oldB = { first, savedVersion: saved.version, second: two.ig.state.money };
        ok('06_old_saves_b', first.money === 49500 && first.machines === 0 && first.notes.some((t) => t.includes('Lands now come with the hole level')) && saved.version === 2 && two.ig.state.money === 49500, JSON.stringify(R.oldB));
        two.f.remove();
      }
      // (c) a version 2 save: no refund
      {
        const { f, ig } = await bootFrame({ version: 2, holeLevel: 8, land: 3, money: 0 });
        ok('06_old_saves_c', ig.state.money === 0, `money ${ig.state.money}`);
        f.remove();
      }
      // (d) saved right at a land boundary: the hole is already at its spot, no second slide
      {
        const { f, ig } = await bootFrame({ version: 2, holeLevel: 3, land: 1 });
        const err = ig.env.hole.distanceTo(holeAt(3, 1));
        ok('06_old_saves_d', !ig.env.sliding && err < 0.05, `sliding ${ig.env.sliding} hole ${xz(ig.env.hole)}`);
        f.remove();
      }
      // (e) a robot station behind the house on an old Forest save
      {
        const { f, ig, notes } = await bootFrame({ version: 1, holeLevel: 8, land: 3, upgrades: { robot: 1 }, placed: [placed('robot', -30, -30)] });
        const robots = ig.machines.placedCount('robot');
        ok('06_old_saves_e', robots === 0 && notes.some((t) => t.includes('1 tool is back in your inventory: no room there.')), JSON.stringify({ robots, notes }));
        f.remove();
      }
      localStorage.removeItem(KEY);

      // ---- 07_fresh_daily: the daily challenge starts on the Backyard
      {
        const { f, ig } = await bootFrame(null, '?lowfx&daily');
        const h = ig.env.hole;
        ok('07_fresh_daily', ig.state.land === 0 && ig.env.max.x === 22 && ig.env.max.z === 22 && Math.hypot(h.x, h.z) < 0.01, `land ${ig.state.land} max ${ig.env.max.x} hole ${xz(h)}`);
        f.remove();
      }
    }

    // ---- 08_shop_legend_goal
    {
      await setState(fresh({ holeLevel: 4 }));
      g.shop.tab = 'Plow';
      g.shop.render();
      const landTab = document.querySelectorAll('.shop [data-tab="Land"]').length;
      const avail = Number(document.querySelector('.shop .shop-avail')?.textContent.replace(/\D+/g, '') ?? -1);
      const sum = [...document.querySelectorAll('.shop .tab-n')].reduce((a, e) => a + Number(e.textContent), 0);
      ok('08_shop', landTab === 0 && avail === sum, `land tab ${landTab} available ${avail} sum ${sum}`);
      const mech = g.legend.mechanics();
      const landPart = mech.slice(mech.indexOf('<h3>Land</h3>'));
      const header = landPart.slice(0, landPart.indexOf('</tr>'));
      const cols = (header.match(/<th>/g) ?? []).length;
      const text = landPart.includes('Comes by itself at hole level 3 / 5 / 8');
      ok('08_legend', cols === 3 && text, `legend cols ${cols} text ${text}`);
      g.state.goalsDone = ['make', 'grab', 'feed', 'coins', 'combo5', 'buy', 'lvl2', 'lvl4'];
      g.goals = new Goals();
      const cur = g.goals.current;
      g.goals.update();
      const early = g.state.goalsDone.includes('garden');
      // lessons may pay in the same update: record every payment, the goal's is one of them
      const pays = [];
      const earn0 = g.hole.earn.bind(g.hole);
      g.hole.earn = (v) => { pays.push(v); return earn0(v); };
      g.state.holeLevel = 5;
      g.goals.update();
      g.hole.earn = earn0;
      const done = g.state.goalsDone.includes('garden');
      g.goals.update = () => {};
      ok('08_goal', cur?.id === 'garden' && cur.text === 'Reach hole level 5: the yard grows into the Neighbour\'s Lawn' && cur.where === 'hole' && !early && done && pays.includes(300), JSON.stringify({ id: cur?.id, text: cur?.text, where: cur?.where, early, done, pays }));
    }

    // ---- 09_blueprint_tramp
    {
      // a layout saved and loaded on the Garden places every tool again
      await setState(fresh({ holeLevel: 3, upgrades: { fan: 3, trampoline: 1 } }));
      placePlayer(-15, -5);
      const h = g.env.hole;
      for (const [dx, dz] of [[5, 0], [0, 5], [-5, 0]]) g.machines.place('fan', new V3(h.x + dx, 0, h.z + dz), Q());
      await frames(3);
      g.blueprints.save(0);
      g.blueprints.load(0);
      await gameWait(1);
      const same = g.machines.list.length === 3;
      // a Lawn layout with a fan 40 m past the hole along +x loaded on the Garden: that fan would stand beyond the fence
      // (Lawn x 34.9 inside its 66 m fence; Garden x 50.0 past its 42 m fence)
      await setState(fresh({ holeLevel: 5, upgrades: { fan: 2 } }));
      const h5 = g.env.hole;
      const farLawn = new V3(h5.x + 40, 0, h5.z);
      g.machines.place('fan', new V3(h5.x + 4, 0, h5.z), Q());
      g.machines.place('fan', farLawn, Q());
      await frames(3);
      const lawnPlaced = g.machines.list.length === 2;
      g.blueprints.save(0);
      await setState(fresh({ holeLevel: 3, upgrades: { fan: 2 } }));
      const farGarden = g.env.hole.clone().add(new V3(40, 0, 0));
      g.blueprints.load(0);
      await gameWait(1);
      const outsideSkipped = lawnPlaced && g.machines.list.length === 1;
      g.machines.clearAll();
      // the trampoline launches at 13 m/s x 0.6 x 1.25^land straight up: 9.75 m/s on the Garden
      const tp = new V3(-12, 0, 15);
      g.machines.place('trampoline', tp, Q());
      await frames(3);
      const gn = g.gnomes.spawn('classic', new V3(tp.x, 1.2, tp.z), { tier: 'normal', awake: false });
      // the launch speed as the pad sets it: linvel() read after a frame has already lost one physics step to gravity
      let vy = 0;
      const setLinvel0 = gn.body.setLinvel.bind(gn.body);
      gn.body.setLinvel = (v, wake) => { vy = Math.max(vy, v.y); return setLinvel0(v, wake); };
      for (let i = 0; i < 120; i++) await frames(1);
      const tramp = vy / 13;
      const cap = g.hole.comboCap;
      R.bp = { same, outsideSkipped, farLawn: xz(farLawn), farGarden: xz(farGarden), vy: +vy.toFixed(2), tramp: +tramp.toFixed(3), cap };
      ok('09_blueprint_tramp', same && outsideSkipped && near(tramp, 0.75, 0.03) && cap === 2.5, JSON.stringify(R.bp));
      g.machines.clearAll();
      clearGnomes();
    }

    // ---- 10_scenery: Dark Forest: grass in the far strip, fireflies over the yard, UFO from outside, far gnome removed
    {
      await setState(fresh({ holeLevel: 10 }));
      let tufts = null, shrooms = null;
      g.scene.traverse((o) => { if (o.isInstancedMesh && o.count === 8000) tufts = o; else if (o.isInstancedMesh && o.count === 240) shrooms = o; });
      let far = 0;
      if (tufts) {
        const a = tufts.instanceMatrix.array;
        for (let i = 0; i < tufts.count; i++) { const x = a[i * 16 + 12], z = a[i * 16 + 14]; if ((x >= 70 && x <= 94) || (z >= 70 && z <= 94)) far++; }
      }
      // none on any stretch the hole can cover (every land's line and every slide)
      const segD = (x, z, a, b) => { const ab = b.clone().sub(a), p = new V3(x, 0, z); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1))); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
      const path = Env.holePath();
      let onPath = 0;
      for (const im of [tufts, shrooms]) {
        if (!im) continue;
        const a = im.instanceMatrix.array;
        for (let i = 0; i < im.count; i++) if (path.some(([p, q]) => segD(a[i * 16 + 12], a[i * 16 + 14], p, q) < 6.8 - 1e-3)) onPath++;
      }
      ok('10_scenery_grass', !!tufts && !!shrooms && far > 0 && path.length === 7 && onPath === 0, `tufts ${tufts?.count} shrooms ${shrooms?.count} in 70..94 ${far} segments ${path.length} on the hole path ${onPath}`);
      // night: the fireflies draw; the box around them is centred on the yard
      g.env.dayClock = 200;
      g.env.night = 1;
      await gameWait(2);
      const pos = g.env.fireflies.geometry.attributes.position;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < pos.count; i++) { x0 = Math.min(x0, pos.getX(i)); x1 = Math.max(x1, pos.getX(i)); z0 = Math.min(z0, pos.getZ(i)); z1 = Math.max(z1, pos.getZ(i)); }
      const cx = (g.env.min.x + g.env.max.x) / 2, cz = (g.env.min.z + g.env.max.z) / 2;
      const ffErr = Math.hypot((x0 + x1) / 2 - cx, (z0 + z1) / 2 - cz);
      // never frustum-culled: the bounding sphere is computed once from zero positions, the yard origin may be off screen
      ok('10_scenery_fireflies', ffErr <= 3 && g.env.nightShade > 0.05 && g.env.fireflies.frustumCulled === false, `culled ${g.env.fireflies.frustumCulled} centre err ${ffErr.toFixed(2)} box x ${x0.toFixed(1)}..${x1.toFixed(1)} z ${z0.toFixed(1)}..${z1.toFixed(1)} shade ${g.env.nightShade.toFixed(2)}`);
      g.env.dayClock = 0;
      g.env.night = 0;
      g.events.spawnUfo();
      const ux = g.events.ufo?.mesh.position.x;
      ok('10_scenery_ufo', ux >= g.env.max.x + 20, `ufo entry x ${ux} fence ${g.env.max.x}`);
      if (g.events.ufo) { g.scene.remove(g.events.ufo.mesh); g.events.ufo = null; }
      const gn = g.gnomes.spawn('classic', new V3(g.env.max.x + 35, 1, 0), { tier: 'normal', awake: false });
      await gameWait(2);
      ok('10_scenery_far_gnome', !!gn && !g.gnomes.list.includes(gn), `removed ${!!gn && !g.gnomes.list.includes(gn)}`);
    }

    // ---- 11_letters_reach: every letter comes inside the fence with its land, at its spot
    {
      await setState(fresh());
      await gameWait(1);
      const letters = () => g.props.list.filter((p) => p.kind === 'letter');
      const L = (ch) => letters().find((p) => p.letter === ch);
      const xzHome = (p) => { const t = p.body.translation(); return Math.hypot(t.x - p.home.x, t.z - p.home.z); };
      const inside = (p) => { const t = p.body.translation(); return g.env.inside(t.x, t.z, -1); };
      const ins = () => letters().filter(inside).map((p) => p.letter).sort().join('');
      const atStart = ins();
      const outStart = ['N', 'O', 'M', 'E'].every((c) => !inside(L(c)));
      g.state.holeLevel = 2;
      levelBy();
      await gameWait(2);
      const after3 = ins();
      const moved3 = letters().filter((p) => xzHome(p) >= 1.5).map((p) => p.letter).join('');
      g.state.holeLevel = 4;
      levelBy();
      await gameWait(2);
      const after5 = ins();
      g.state.holeLevel = 7;
      levelBy();
      await gameWait(2);
      const after8 = ins();
      const homeErr = Math.max(...letters().map(xzHome));
      const spots = LETTER_SPOTS.every((s) => { const p = L(s.ch); return p && near(p.home.x, s.x, 1e-6) && near(p.home.z, s.z, 1e-6); });
      R.letters = { atStart, outStart, after3, moved3, after5, after8, homeErr: +homeErr.toFixed(2), spots };
      ok('11_letters_reach', atStart === 'G' && outStart && after3 === 'GN' && moved3 === '' && after5 === 'GNO' && after8 === 'EGMNO' && homeErr < 1.5 && spots, JSON.stringify(R.letters));
    }

    // ---- 12_crate_home_tool: a fan stands where the slide would put the crate's new home; the home goes elsewhere
    // (review round: a crate respawning inside a tool)
    {
      await setState(fresh({ holeLevel: 2, upgrades: { box: 1, fan: 1 } }));
      placePlayer(-15, -5);
      const c0 = g.env.hole.clone();
      const newC = holeAt(3, 1);
      const newR = holeLevel(3).radius;
      // the home 0.8 m off the path line (still swept by the slide), so its side of the path is clear
      const move = newC.clone().sub(c0).setY(0);
      const side = new V3(-move.z, 0, move.x).normalize();
      const crate = g.machines.place('box', DIR.clone().multiplyScalar(4.2).addScaledVector(side, 0.8), Q());
      // the spot the first rule picks: beside the path, on the home's side, newR + 1 from the new centre
      const fan = g.machines.place('fan', newC.clone().addScaledVector(side, newR + 1).setY(0), Q());
      await frames(3);
      levelBy();
      await gameWait(2);
      const home = crate.home.clone();
      const fromFan = Math.hypot(home.x - fan.pos.x, home.z - fan.pos.z);
      const fromHole = Math.hypot(home.x - g.env.hole.x, home.z - g.env.hole.z);
      // into the hole: the crate respawns at its home and rests off the fan
      crate.body.setTranslation({ x: g.env.hole.x, y: 0.6, z: g.env.hole.z }, true);
      crate.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      await gameWait(2);
      const ct = crate.body.translation();
      const restFromFan = Math.hypot(ct.x - fan.pos.x, ct.z - fan.pos.z);
      R.crateTool = { level: g.state.holeLevel, fanThere: g.machines.list.includes(fan), home: xz(home), fromFan: +fromFan.toFixed(2), fromHole: +fromHole.toFixed(2), newR, inside: g.env.inside(home.x, home.z, 1), restFromFan: +restFromFan.toFixed(2), crateY: +ct.y.toFixed(2) };
      ok('12_crate_home_tool', g.state.holeLevel === 3 && g.machines.list.includes(fan) && fromFan >= 1.9 && fromHole >= newR + 1 - 1e-3 && g.env.inside(home.x, home.z, 1) && restFromFan >= 1.9 && ct.y > 0, JSON.stringify(R.crateTool));
    }

    // ---- 13_hole_shots (L6): the hole on each land, seen from beside the factory, for a check by eye
    for (let L = 0; L < LAND.length; L++) {
      await setState(fresh({ holeLevel: LAND[L].hole }));
      const h = g.env.hole;
      placePlayer(-10, -16, Math.atan2(-(h.x + 10), -(h.z + 16)));
      g.player.pitch = -0.25;
      await gameWait(0.5);
      await shot(`l6-land-${L}`);
    }

    window.__done = JSON.stringify({ ...R, checks, errors });
  } catch (e) {
    window.__done = JSON.stringify({ ...R, checks, errors, crash: String((e && e.stack) || e).slice(0, 800) });
  }
})();
