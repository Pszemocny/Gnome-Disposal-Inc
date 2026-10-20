// Tutorial goals + lessons (plan-tutorial-goals, Done when 1-33).
// Run: DEV_PORT=5195 CDP_PORT=9381 MAXPOLL=800 node tools/smoke/smoke.mjs <outDir> <this file>
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const g = window.gnome;
const out = [];
const ok = (n, cond, info = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${n} ${info}`);
const KEY = 'gnome-boozed-save-v1';
const MS = ['make', 'grab', 'feed', 'coins', 'combo5', 'buy', 'lvl2', 'lvl4', 'garden', 'lvl6', 'lvl8', 'lvl10', 'lvl12', 'deep'];
const LS = ['mushroom', 'greedy', 'heavy', 'angry', 'dwarf', 'haul', 'boom', 'saboteur', 'golden', 'wizard', 'fat', 'king', 'crate', 'dump', 'combo15', 'long', 'air', 'trick', 'bullseye'];
const thru = (list, id) => list.slice(0, list.indexOf(id) + 1);
const goalText = (doc = document) => doc.querySelector('.hud-goal')?.textContent ?? '';
const heads = (doc = document) => [...doc.querySelectorAll('.hud-goal .g-head')].map((e) => e.textContent);
const toastTexts = (doc = document) => [...doc.querySelectorAll('.hud-toasts > *')].map((e) => e.textContent);

const iframe = async (q) => {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0.01;pointer-events:none';
  f.src = '/' + q;
  document.body.appendChild(f);
  for (let i = 0; i < 300 && !f.contentWindow?.gnome?.goals; i++) await sleep(100);
  await sleep(500);
  return f;
};

setTimeout(() => { if (!window.__done) window.__done = out.join('\n') + '\nTIMEOUT'; }, Number(window.__limit ?? 170000));
(async () => {
  try {
    const { Goals } = await import('/src/systems/goals.ts');
    const { freshState, blockSaves } = await import('/src/core/state.ts');
    blockSaves(); // the outer page must not overwrite the crafted saves
    g.paused = true;
    const reset = (patch = {}) => {
      const s = freshState();
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'stats') Object.assign(s.stats, v);
        else s[k] = v;
      }
      g.state = s;
      g.goals = new Goals();
      g.mushrooms.clearAll();
      g.hole.combo = 0;
      return s;
    };
    const st = () => g.state.stats;
    const upd = (n = 1) => { for (let i = 0; i < n; i++) g.goals.update(); };
    const gnomeAt = (opts = {}) => g.gnomes.spawn(opts.type ?? 'classic', g.env.hole.clone().setY(3).add(new g.camera.position.constructor(8, 0, 0)), { tier: opts.tier ?? 'normal' });
    const eat = (set = {}) => { const n = gnomeAt(set); Object.assign(n, set.fields ?? {}); g.hole.consume(n); };

    // 1 fresh boot
    reset();
    upd(); await frames(3);
    ok(1, goalText().includes('GOAL') && goalText().includes('Make gnomes') && !goalText().includes('LESSON'), JSON.stringify(goalText().slice(0, 60)));

    // 16 contracts wait for the first goal
    reset(); g.time = 5;
    g.contracts.update(0.016);
    const c0 = g.contracts.current;
    st().produced += 5; upd(); g.contracts.update(0.016);
    ok(16, c0 === null && g.contracts.current !== null, `before=${c0} after=${g.contracts.current?.id}`);

    // 2 tutorial chain
    {
      const s = reset(); const m0 = s.money; const texts = [];
      upd(); st().produced += 5; upd();
      st().grabbed += 3; upd();
      st().gnomesEaten += 5; upd();
      s.lifetimeEarned += 15; upd();
      const d4 = [...s.goalsDone];
      texts.push(g.goals.progress().text);
      st().maxCombo = 5; upd(); texts.push(g.goals.progress().text);
      st().bought += 1; upd(); texts.push(g.goals.progress().text);
      ok(2, JSON.stringify(d4) === '["make","grab","feed","coins"]' && texts[0].startsWith('Reach a 5 combo') && texts[1].startsWith('Buy an upgrade') && texts[2].startsWith('Reach hole level 2') && s.money - m0 === 65, `done=${d4} texts=${texts.map((t) => t.slice(0, 18))} money=${s.money - m0}`);
    }

    // 3 combo5 already reached
    {
      const s = reset({ goalsDone: thru(MS, 'coins'), stats: { maxCombo: 9 } }); const m0 = s.money;
      upd(3);
      ok(3, s.goalsDone.includes('combo5') && s.money - m0 === 15 && g.goals.progress().text.startsWith('Buy an upgrade'), `money=${s.money - m0}`);
    }

    // 4 + 17 lessons open after coins (adapted: from the first minute)
    reset({ goalsDone: thru(MS, 'coins') }); upd(); await frames(3);
    ok(4, goalText().includes('LESSON') && goalText().includes('Eat a MUSHROOM'), JSON.stringify(goalText().slice(0, 120)));
    ok(17, JSON.stringify(heads()) === '["GOAL","LESSON"]', JSON.stringify(heads()));

    // 5 guaranteed mushroom, no forced second
    {
      reset({ goalsDone: thru(MS, 'coins') }); upd();
      const want = g.goals.wantsMushroom;
      eat(); const l1 = g.mushrooms.list.length;
      const rnd = Math.random; Math.random = () => 0.5;
      for (let i = 0; i < 20; i++) eat();
      Math.random = rnd;
      const l2 = g.mushrooms.list.length;
      ok(5, want && l1 === 1 && l2 <= 2, `wants=${want} after1=${l1} after21=${l2}`);
    }

    // 6 lesson done: normal chance
    {
      reset({ goalsDone: [...thru(MS, 'coins'), 'mushroom'] }); upd();
      const rnd = Math.random; Math.random = () => 0.5;
      for (let i = 0; i < 200; i++) eat();
      Math.random = rnd;
      ok(6, g.mushrooms.list.length === 0 && !g.goals.wantsMushroom, `len=${g.mushrooms.list.length}`);
    }

    // 7 walk over a mushroom (level 2 so the next lesson is greedy)
    {
      const s = reset({ goalsDone: thru(MS, 'coins'), holeLevel: 2 }); upd(); const m0 = s.money;
      const pp = g.player.position;
      g.mushrooms.spawn(g.mushrooms.pickDef(), new g.camera.position.constructor(pp.x, pp.y - 1, pp.z), false);
      g.mushrooms.update(0.016); upd(); await frames(3);
      ok(7, s.money - m0 === 40 && goalText().includes('GREEDY GNOME'), `money=${s.money - m0} mush=${st().mushrooms}`);
    }

    // 25 BOOZE does not count
    {
      reset({ goalsDone: thru(MS, 'coins') }); upd();
      const m0 = st().mushrooms;
      g.buffs.apply('booze'); upd(2);
      ok(25, st().mushrooms === m0 && !g.state.goalsDone.includes('mushroom'), `mushrooms=${st().mushrooms}`);
      g.buffs.timers.clear();
    }

    // 8 greedy fed before it unlocks
    {
      const s = reset({ goalsDone: thru(MS, 'coins'), stats: { typesEaten: { greedy: 1 } } }); upd(2);
      const before = s.goalsDone.includes('greedy'); const m0 = s.money;
      s.holeLevel = 2; upd(3);
      ok(8, !before && s.goalsDone.includes('greedy') && s.money - m0 === 40, `before=${before} money=${s.money - m0}`);
    }

    // 34 boom and golden lessons open at the level where they first spawn (boom 2, golden 1)
    {
      const s = reset({ goalsDone: thru(MS, 'coins'), holeLevel: 2, stats: { typesEaten: { boom: 1 } } }); upd(2);
      const boom = s.goalsDone.includes('boom');
      const s2 = reset({ goalsDone: thru(MS, 'coins'), holeLevel: 1, stats: { typesEaten: { golden: 1 } } }); upd(2);
      const golden = s2.goalsDone.includes('golden');
      ok(34, boom && golden, `boom@2=${boom} golden@1=${golden}`);
    }

    // 35 the forced lesson mushroom does not land inside a tool placed next to the hole
    {
      reset({ goalsDone: thru(MS, 'coins') }); upd();
      const V = g.camera.position.constructor; const h = g.env.hole;
      const tool = g.machines.place('vacuum', h.clone().add(new V(3.8, 0, 0)), new g.camera.quaternion.constructor());
      // every random 0 (three.js uuids use Math.random too): direction +x, speed 4, so without a retry it lands 3.8 m out, inside the vacuum
      const rnd = Math.random; Math.random = () => 0;
      g.mushrooms.maybeDrop(h.clone().setY(0.5));
      Math.random = rnd;
      const m = g.mushrooms.list[0];
      for (let i = 0; i < 300 && m && m.vel.lengthSq() > 0; i++) g.mushrooms.update(1 / 60);
      const d = m ? Math.hypot(m.mesh.position.x - tool.pos.x, m.mesh.position.z - tool.pos.z) : -1;
      const landed = !!m && m.vel.lengthSq() === 0;
      g.machines.remove(tool); g.mushrooms.clearAll();
      ok(35, landed && d > 1.4, `d=${d.toFixed(2)} landed=${landed}`);
    }

    // 36 screenshot 640x360, first minute: GOAL combo5, LESSON, contract, EFFECTS and "Lesson done!" right after the first mushroom
    {
      reset({ goalsDone: thru(MS, 'coins') }); upd(); g.time = 200; g.contracts.update(0.016);
      const pp = g.player.position;
      g.mushrooms.spawn(g.mushrooms.pickDef(), new g.camera.position.constructor(pp.x, pp.y - 1, pp.z), false);
      g.mushrooms.update(0.016); upd();
      for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';
      await frames(30);
      const box = (e) => { const b = e.getBoundingClientRect(); return `${e.className}:${Math.round(b.top)}-${Math.round(b.bottom)}`; };
      const parts = [...document.querySelector('.hud-left').children].filter((e) => e.offsetHeight > 0).map(box);
      const card = document.querySelector('.hud-contract, .contract');
      const tt = toastTexts();
      await shot('36-first-minute-640');
      ok(36, goalText().includes('Reach a 5 combo') && tt.some((t) => t.includes('Lesson done')) && !!g.contracts.current, `${parts.join(' ')} contract=${card ? box(card) : 'none'} innerH=${innerHeight} (overflow checked by eye)`);
      for (const el of document.querySelectorAll('.menu')) el.style.display = '';
      g.buffs.timers.clear();
    }

    // 9 every lesson up to level 2 done -> wait text; bullseye base read at level 4
    {
      const from2 = ['mushroom', 'greedy', 'heavy', 'boom', 'golden', 'crate', 'dump', 'combo15', 'long', 'air', 'trick'];
      const s = reset({ goalsDone: [...thru(MS, 'lvl2'), ...from2], holeLevel: 2 }); upd(); await frames(3);
      const p2 = g.goals.progress2(); const nums = [...document.querySelectorAll('.hud-goal .g-num')].map((e) => e.textContent);
      const tp = g.goals.targetPos();
      s.holeLevel = 4; st().bullseyes = 7; upd();
      ok(9, p2.text === 'Next lesson at hole level 3' && nums[1] === '2 / 3' && tp === g.env.hole && s.goalStart.bullseye === 7, `p2=${p2.text} nums=${nums} tpHole=${tp === g.env.hole} base=${s.goalStart.bullseye}`);
    }

    // 10 heavies
    {
      reset();
      const a = st().heavies; eat({ tier: 'heavy' }); const b = st().heavies; eat({ tier: 'normal' });
      ok(10, a === 0 && b === 1 && st().heavies === 1, `${a}->${b}->${st().heavies}`);
    }

    // 11 trickShots player only
    {
      reset();
      const a = st().trickShots;
      eat({ fields: { thrownBy: 'player', bounced: true, touchedGround: true, throwPos: g.env.hole.clone() } });
      const b = st().trickShots;
      eat({ fields: { thrownBy: 'machine', bounced: true, touchedGround: true, throwPos: g.env.hole.clone() } });
      ok(11, a === 0 && b === 1 && st().trickShots === 1, `${a}->${b}->${st().trickShots}`);
    }

    // 18 trampoline waypoint
    {
      reset({ goalsDone: [...thru(MS, 'lvl2'), 'mushroom', 'greedy', 'heavy', 'boom', 'golden', 'crate', 'dump', 'combo15', 'long', 'air'], holeLevel: 2 }); upd();
      const shown = g.goals.progress2().text;
      const t1 = g.goals.targetPos();
      const m = g.machines.place('trampoline', g.env.hole.clone().add(new g.camera.position.constructor(6, 0, 6)), new g.camera.quaternion.constructor());
      const t2 = g.goals.targetPos();
      ok(18, shown.startsWith('TRICK') && t1 === g.env.deskPos && t2 === m.pos, `shown=${shown.slice(0, 10)} desk=${t1 === g.env.deskPos} tramp=${t2 === m.pos}`);
    }

    // 26 lesson waypoint wins after lvl2; factory on a fresh save
    {
      reset({ goalsDone: [...thru(MS, 'lvl2'), 'mushroom', 'greedy', 'heavy', 'boom', 'golden'], holeLevel: 2 }); upd();
      const cur = g.goals.current.id, cur2 = g.goals.current2.id, t1 = g.goals.targetPos();
      reset(); upd();
      const t2 = g.goals.targetPos();
      ok(26, cur === 'lvl4' && cur2 === 'crate' && t1 === g.env.deskPos && t2 === g.factory.pos, `cur=${cur} cur2=${cur2} desk=${t1 === g.env.deskPos} factory=${t2 === g.factory.pos}`);
    }

    // 19 king
    {
      const s = reset({ goalsDone: [...MS, ...thru(LS, 'fat')], holeLevel: 10, stats: { typesEaten: { king: 1 } } }); const m0 = s.money;
      upd(2);
      ok(19, s.goalsDone.includes('king') && s.money - m0 === 2000, `money=${s.money - m0}`);
    }

    // 22 + 23 type lesson shown before AIR; AIR completes in the background with one toast
    {
      const s = reset({ goalsDone: [...thru(MS, 'lvl2'), 'mushroom', 'greedy', 'heavy', 'crate', 'dump', 'combo15'], holeLevel: 3 }); upd(); await frames(2);
      const shown = g.goals.progress2().text;
      ok(22, shown.includes('ANGRY GNOME') && !shown.includes('AIR'), shown.slice(0, 30));
      for (let i = 0; i < 3; i++) eat({ fields: { thrownBy: 'player', touchedGround: false, throwPos: g.env.hole.clone() } });
      const m0 = s.money; const t0 = toastTexts().filter((t) => t.includes('Lesson done! +$60')).length;
      upd(); await frames(2);
      const t1 = toastTexts().filter((t) => t.includes('Lesson done! +$60')).length;
      ok(23, s.goalsDone.includes('air') && s.money - m0 === 60 && g.goals.progress2().text.includes('ANGRY GNOME') && t1 - t0 === 1, `money=${s.money - m0} toasts=${t1 - t0} shown=${g.goals.progress2().text.slice(0, 20)}`);
    }

    // 32 lesson bases read the frame the track opens (adapted: coins done)
    {
      const s = reset({ goalsDone: thru(MS, 'feed') }); upd();
      st().crated = 3; st().longShots = 2; s.lifetimeEarned += 15; upd();
      ok(32, s.goalsDone.includes('coins') && s.goalStart.crate === 3 && s.goalStart.long === 2 && s.goalStart.combo15 === undefined, JSON.stringify(s.goalStart));
    }

    // 28 screenshot 640x360: GOAL lvl2 + LESSON trick + a running contract
    {
      reset({ goalsDone: [...thru(MS, 'buy'), 'mushroom', 'greedy', 'heavy', 'golden', 'crate', 'dump', 'combo15', 'long', 'air'], holeLevel: 1 });
      upd(); g.time = 200; g.contracts.update(0.016);
      for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';
      await frames(30);
      const goal = document.querySelector('.hud-goal').getBoundingClientRect();
      const card = document.querySelector('.hud-contract, .contract');
      const cr = card?.getBoundingClientRect();
      await shot('28-goal-lesson-640');
      ok(28, goalText().includes('Reach hole level 2') && goalText().includes('TRICK x3') && !!g.contracts.current, `goal=${Math.round(goal.top)}-${Math.round(goal.bottom)} card=${cr ? Math.round(cr.top) + '-' + Math.round(cr.bottom) : 'none'} innerH=${innerHeight} (overlap checked by eye)`);
      for (const el of document.querySelectorAll('.menu')) el.style.display = '';
    }

    // 12 F8 save
    {
      localStorage.setItem(KEY, JSON.stringify({ goal: 8, goal2: 3, goalBase2: 4, stats: { longShots: 4 } }));
      const f = await iframe('?lowfx'); const G = f.contentWindow.gnome; const s = G.state; const m0 = s.money;
      G.goals.update();
      const want = '["make","grab","feed","coins","combo5","buy","lvl2","lvl4","garden","crate","dump","combo15"]';
      ok(12, JSON.stringify(s.goalsDone) === want && G.goals.progress().text === 'Reach hole level 6' && G.goals.progress2().text.startsWith('Eat a MUSHROOM') && s.goalStart.long === 4 && s.money === m0, `done=${s.goalsDone} start=${JSON.stringify(s.goalStart)} money=${s.money - m0}`);
      f.remove();
    }

    // 13 pre-F8 save goal 9 (= old skill "long" running)
    {
      localStorage.setItem(KEY, JSON.stringify({ goal: 9, goalBase: 2 }));
      const f = await iframe('?lowfx'); const s = f.contentWindow.gnome.state; const G = f.contentWindow.gnome;
      const want = '["make","grab","feed","coins","combo5","buy","lvl2","crate","dump","combo15"]';
      ok(13, JSON.stringify(s.goalsDone) === want && G.goals.progress().text === 'Reach hole level 4' && s.goalStart.long === 2, `done=${s.goalsDone} goal=${G.goals.progress().text} start=${JSON.stringify(s.goalStart)}`);
      f.remove();
    }

    // 30 old save goal 4
    {
      localStorage.setItem(KEY, JSON.stringify({ goal: 4, money: 7 }));
      const f = await iframe('?lowfx'); const G = f.contentWindow.gnome; const s = G.state;
      G.goals.update();
      ok(30, JSON.stringify(s.goalsDone) === '["make","grab","feed","coins","combo5"]' && G.goals.progress().text.startsWith('Buy an upgrade') && s.money === 7, `done=${s.goalsDone} money=${s.money}`);
      f.remove();
    }

    // 24 cascade: one payment, one toast
    {
      localStorage.setItem(KEY, JSON.stringify({ goalsDone: thru(MS, 'lvl8'), holeLevel: 8, money: 0, stats: { typesEaten: { angry: 1, dwarf: 1, boom: 1, saboteur: 1, wizard: 1, fat: 1 } } }));
      const f = await iframe('?lowfx'); const G = f.contentWindow.gnome; const s = G.state;
      const n0 = s.goalsDone.length; const m0 = s.money; const t0 = toastTexts(f.contentDocument).length;
      G.goals.update(); await sleep(300);
      const added = s.goalsDone.slice(n0); const tt = toastTexts(f.contentDocument).slice(t0);
      ok(24, added.length === 6 && s.money - m0 === 700 && tt.filter((t) => t.includes('lessons done')).length === 1 && tt.some((t) => t.includes('6 lessons done! +$700')), `added=${added} money=${s.money - m0} toasts=${JSON.stringify(tt)}`);
      f.remove();
    }

    // 14 rebirth keeps goalsDone and goalStart
    {
      const done = [...MS, ...LS.filter((id) => !['greedy', 'angry', 'dwarf', 'haul', 'boom', 'saboteur', 'wizard', 'fat', 'king', 'bullseye'].includes(id))];
      localStorage.setItem(KEY, JSON.stringify({ goalsDone: done, goalStart: { x: 1 }, holeLevel: 12 }));
      const f = await iframe('?lowfx');
      const G1 = f.contentWindow.gnome;
      const before = JSON.stringify([G1.state.goalsDone, G1.state.goalStart]);
      G1.hole.rebirth();
      await sleep(1500);
      for (let i = 0; i < 300 && !(f.contentWindow?.gnome?.goals && f.contentWindow.gnome !== G1); i++) await sleep(100);
      await sleep(800);
      const saved = JSON.parse(localStorage.getItem(KEY));
      const G2 = f.contentWindow.gnome;
      const txt = goalText(f.contentDocument); const hd = heads(f.contentDocument);
      ok(14, JSON.stringify([saved.goalsDone, saved.goalStart]) === before && !hd.includes('GOAL') && txt.includes('Next lesson at hole level 2') && G2.state.holeLevel === 1, `heads=${hd} txt=${txt.slice(0, 60)} same=${JSON.stringify([saved.goalsDone, saved.goalStart]) === before}`);
      f.remove();
    }

    // 15 daily: fresh tutorial, nothing saved
    {
      localStorage.setItem(KEY, JSON.stringify({ goal: 4, money: 7 }));
      const before = localStorage.getItem(KEY);
      const f = await iframe('?daily&lowfx');
      await sleep(15000);
      ok(15, goalText(f.contentDocument).includes('Make gnomes') && localStorage.getItem(KEY) === before, JSON.stringify(goalText(f.contentDocument).slice(0, 40)));
      f.remove();
    }

    // 29 crate counters (physics: unpaused)
    {
      reset();
      const box = g.machines.place('box', g.env.hole.clone().add(new g.camera.position.constructor(7, 0, -7)).setY(0.5), new g.camera.quaternion.constructor());
      g.paused = false;
      await frames(20);
      const c0 = st().crated;
      const bp = box.body.translation();
      g.gnomes.spawn('classic', new g.camera.position.constructor(bp.x, bp.y + 1.0, bp.z), { tier: 'normal' });
      for (let i = 0; i < 120 && st().crated === c0; i++) await frames(1);
      const c1 = st().crated; const d0 = st().crateDumps;
      const h = g.env.hole;
      box.body.setTranslation({ x: h.x, y: 0.5, z: h.z }, true);
      for (let i = 0; i < 60 && st().crateDumps === d0; i++) await frames(1);
      const d1 = st().crateDumps;
      await frames(20);
      box.body.setTranslation({ x: h.x, y: 0.5, z: h.z }, true);
      await frames(30);
      const d2 = st().crateDumps;
      g.paused = true;
      ok(29, c1 === c0 + 1 && d1 === d0 + 1 && d2 === d1, `crated ${c0}->${c1} dumps ${d0}->${d1}->${d2}`);
    }
  } catch (e) {
    out.push('ERROR ' + e.message + ' ' + e.stack);
  }
  window.__done = out.join('\n');
})();
