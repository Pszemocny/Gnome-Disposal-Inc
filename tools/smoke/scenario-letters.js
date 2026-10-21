// Secret letters GNOME + shiny shovel (docs/ai-work/2026-10-21-secret-letters.md, "Gotowe, gdy"). One RESULT JSON
// with `checks` (PASS/FAIL lines). Run (about 3 min, URL_QUERY='' so the night look is on):
// FAKELOCK=1 URL_QUERY='' DEV_PORT=5199 MAXPOLL=1600 node tools/smoke/smoke.mjs lt-out tools/smoke/scenario-letters.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
// the HUD is hidden for the screenshot (its panels cover the middle of a 640x360 shot)
const shot = async (n) => {
  const hud = document.querySelector('.hud');
  if (hud) hud.style.visibility = 'hidden';
  window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100);
  if (hud) hud.style.visibility = '';
};
const g = window.gnome;
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
setTimeout(() => { if (!window.__done) window.__done = JSON.stringify({ checks, errors, timeout: true }); }, 560000);
(async () => {
  try {
    const { freshState, loadState, blockSaves } = await import('/src/core/state.ts');
    const { Props } = await import('/src/entities/props.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    const { LAND } = await import('/src/data/land.ts');
    const { WORD, LETTER_SPOTS } = await import('/src/data/letters.ts');
    const { ACHIEVEMENTS } = await import('/src/data/achievements.ts');
    blockSaves();
    g.moods.update = () => {};
    g.contracts.update = () => {};
    g.events.spawnVisitor = () => {};
    g.events.next = 1e9;
    for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';
    let paid = 0;
    const burst0 = g.coins.burst.bind(g.coins);
    g.coins.burst = (v, o, p) => { paid += v; return burst0(v, o, p); };
    let achToasts = 0;
    const ach0 = g.hud.achievement.bind(g.hud);
    g.hud.achievement = (...a) => { achToasts++; return ach0(...a); };
    const toastTexts = () => [...document.querySelectorAll('.hud-toasts > *')].map((e) => e.textContent);
    const V3 = g.camera.position.constructor;
    const holeAt = (level, land) => g.env.constructor.holeCenterFor(level, land);
    const clearGnomes = () => { g.player.swarm = []; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
    g.paused = false;
    const gameWait = async (sec) => { const t0 = g.time; for (let i = 0; i < 5000 && g.time - t0 < sec; i++) await frames(1); };
    const placePlayer = (x, z, yaw, pitch = -0.38) => {
      g.player.body.setTranslation({ x, y: 1.2, z }, true);
      g.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.player.position.set(x, 1.2, z);
      g.player.yaw = yaw;
      g.player.pitch = pitch;
    };
    // a new state and a new Props, as after a reload with that save
    const reload = (st) => {
      g.player.held = null;
      for (const p of g.props.list) { g.physics.removeRigidBody(p.body); g.scene.remove(p.mesh); }
      if (g.props.shovel) g.scene.remove(g.props.shovel);
      g.state = st;
      g.goals = new Goals();
      g.goals.update = () => {};
      g.props = new Props();
    };
    const letters = () => g.props.list.filter((p) => p.kind === 'letter');
    const L = (ch) => letters().find((p) => p.letter === ch);
    const xzHome = (p) => { const t = p.body.translation(); return Math.hypot(t.x - p.home.x, t.z - p.home.z); };
    // the yard runs from (-22, -22) to maxOf(land) on x and z
    const maxOf = (land) => 2 * LAND[land].half - 22;
    const outside = (p, max) => {
      const t = p.body.translation();
      if (max === undefined) return !g.env.inside(t.x, t.z, -1);
      return t.x < -23 || t.z < -23 || t.x > max + 1 || t.z > max + 1;
    };
    // the land change comes with the level-up (3 / 5 / 8)
    const reachLand = (i) => { g.state.holeLevel = LAND[i].hole - 1; g.hole.levelUp(); };
    const goHome = async (p) => { p.body.setTranslation({ x: p.home.x, y: p.home.y, z: p.home.z }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); await gameWait(1); };
    const feed = async (ch) => {
      const p = L(ch);
      const h = g.env.hole;
      p.body.setTranslation({ x: h.x, y: 1, z: h.z }, true);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      for (let i = 0; i < 300 && p.respawn === 0; i++) await frames(1);
      return p;
    };
    const segDist = (p, a, b) => {
      const ab = b.clone().sub(a);
      const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
      return p.distanceTo(a.clone().addScaledVector(ab, t));
    };
    placePlayer(0, 9, 0);
    await frames(5);

    // ---- L0: spots clear of the hole's one line, inside their land, 5 m beyond the previous land's +x or +z fence
    {
      const bad = [];
      for (const s of LETTER_SPOTS) {
        const p = new V3(s.x, 0, s.z);
        const dmin = segDist(p, holeAt(1, 0), holeAt(12, LAND.length - 1));
        const inside = s.x >= -20 && s.z >= -20 && s.x <= maxOf(s.land) - 2 && s.z <= maxOf(s.land) - 2;
        const beyond = s.land === 0 || s.x >= maxOf(s.land - 1) + 5 || s.z >= maxOf(s.land - 1) + 5;
        if (dmin < 6.8 || !inside || !beyond) bad.push(`${s.ch} d ${dmin.toFixed(1)} at ${s.x},${s.z}`);
      }
      const perLand = LAND.map((_, t) => LETTER_SPOTS.filter((s) => s.land === t).length).join(',');
      ok('L0', !bad.length && perLand === '1,1,1,2' && LETTER_SPOTS.map((s) => s.ch).join('') === WORD, `bad [${bad}] per land ${perLand}`);
    }

    // ---- L13 / L12 / boot: the boot state is a fresh save (empty profile), same path as the daily
    {
      const daily = freshState();
      ok('L13', !daily.secrets.some((x) => x.startsWith('letter-')) && letters().length === 5, `daily secrets [${daily.secrets}] boot letters ${letters().length}`);
      const KEY = 'gnome-boozed-save-v1';
      const old = freshState(); old.achievements = ['booze']; old.secrets = ['shovel'];
      localStorage.setItem(KEY, JSON.stringify(old));
      const st = loadState(); localStorage.removeItem(KEY);
      reload(st);
      ok('L12', letters().length === 5 && g.state.achievements.includes('booze'), `letters ${letters().length} achievements [${g.state.achievements}]`);
    }

    // ---- L11: typed BOOZE does nothing, GNOMERAIN still rains
    reload(freshState());
    {
      g.input.typed = 'BOOZE';
      await frames(3);
      const boozeOff = !g.buffs.active('booze') && !g.state.achievements.includes('booze');
      ok('L11a', boozeOff, `buff ${g.buffs.active('booze')} achievements [${g.state.achievements}]`);
      g.input.typed = 'GNOMERAIN';
      await frames(3);
      ok('L11b', g.events.rain > 0, `rain ${g.events.rain}`);
      await gameWait(5);
      clearGnomes();
    }

    // ---- L1: fresh save, pop-in sampled
    reload(freshState());
    {
      const G = L('G');
      const sc = [];
      for (let i = 0; i < 40 && G.mesh.scale.x !== 1; i++) { await frames(1); sc.push(+G.mesh.scale.x.toFixed(3)); }
      const mid = sc.some((v) => v > 0 && v < 1);
      const over = sc.some((v) => v > 1.001);
      const r = G.mesh.geometry.boundingSphere.radius;
      const inside = !outside(G);
      ok('L1', letters().length === 5 && inside && mid && over && sc[sc.length - 1] === 1 && r > 0.5 && r < 0.7 && G.body.isDynamic() && G.body.dominanceGroup() === 0 && Math.abs(G.body.mass() - 1) < 0.01,
        `letters ${letters().length} G inside ${inside} scale [${sc}] radius ${r.toFixed(3)} dominance ${G.body.dominanceGroup()} mass ${G.body.mass().toFixed(2)}`);
      // the gnome's damping (gnomes.ts spawn): physics like a gnome
      ok('L1damp', Math.abs(G.body.linearDamping() - 0.15) < 1e-6 && Math.abs(G.body.angularDamping() - 0.6) < 1e-6,
        `linear ${G.body.linearDamping()} angular ${G.body.angularDamping()}`);
      // screenshot: G on the grass, then N beyond the fence
      placePlayer(15, -11.5, 0, -0.2);
      await frames(3);
      reload(freshState());
      for (let i = 0; i < 40 && L('G').mesh.scale.x < 1.09; i++) await frames(1);
      // pause on the overshoot frame: the canvas keeps it while the screenshot is taken
      g.paused = true;
      await shot('letters-pop');
      const popShot = L('G').mesh.scale.x;
      g.paused = false;
      ok('L1shot', popShot > 1, `letters-pop.png at scale ${popShot.toFixed(3)}`);
      await gameWait(1.5);
      placePlayer(-21, 23.5, Math.atan2(6, -0.5), -0.1);
      await gameWait(1);
      await shot('letter-beyond-fence');
    }

    // ---- L2 / L3: land changes (with the hole level) keep every letter at its spot; N, then all of them, inside the fence
    {
      const st = freshState(); st.money = 1e9;
      reload(st);
      g.env.rebuildHole();
      g.env.rebuildLand();
      await gameWait(1.5);
      const beyond = ['N', 'O', 'M', 'E'].every((c) => outside(L(c)) && xzHome(L(c)) < 1);
      const tr = g.env.trees;
      let nearTree = Infinity;
      for (let i = 0; i < tr.count; i++) {
        const a = tr.instanceMatrix.array;
        for (const s of LETTER_SPOTS) nearTree = Math.min(nearTree, Math.hypot(a[i * 16 + 12] - s.x, a[i * 16 + 14] - s.z));
      }
      reachLand(1);
      await gameWait(2);
      const all = letters().length === 5 && letters().every((p) => p.mesh.visible && p.respawn === 0 && xzHome(p) < 1.5);
      const nIn = !outside(L('N')) && g.env.max.x === maxOf(1);
      ok('L2', beyond && nearTree >= 5 && all && nIn, `beyond fence on Backyard ${beyond} nearest tree ${nearTree.toFixed(1)} m, after Garden all at home ${all} N inside ${nIn}`);
      reachLand(2);
      await gameWait(2);
      reachLand(3);
      await gameWait(2);
      const allIn = letters().length === 5 && letters().every((p) => !outside(p) && xzHome(p) < 1.5);
      ok('L3', allIn && g.state.land === 3 && g.env.max.x === maxOf(3) && L('M').home.x === 86 && L('E').home.z === 88, `land ${g.state.land} all inside at home ${allIn} [${letters().map((p) => `${p.letter} ${xzHome(p).toFixed(2)}`)}]`);
    }

    // back to a fresh Backyard for the physics checks
    {
      reload(freshState());
      g.env.rebuildHole();
      g.env.rebuildLand();
      await gameWait(1.5);
    }
    const G = L('G');

    // ---- L18: holding G by hand, the MAGNET panel names it
    {
      placePlayer(15, -12, 0);
      g.player.held = { body: G.body, prop: G };
      await frames(3);
      const txt = document.querySelector('.sack-label')?.textContent ?? '';
      g.player.held = null;
      ok('L18', txt.includes('Letter G'), `"${txt}"`);
      await goHome(G);
    }

    // ---- L14: a placed magnet tool leaves the letter alone, a kick moves it
    {
      const Q = g.camera.quaternion.clone().set(0, 0, 0, 1);
      placePlayer(5, 5, 0);
      const t0 = G.body.translation();
      const m = g.machines.place('magnet', new V3(G.home.x + 2.5, 0, G.home.z), Q);
      await gameWait(3);
      const t1 = G.body.translation();
      const still = Math.hypot(t1.x - t0.x, t1.z - t0.z);
      g.machines.clearAll();
      await frames(2);
      placePlayer(G.home.x, G.home.z + 1.4, 0);
      await frames(2);
      const k0 = G.body.translation();
      g.player.kickHit();
      await gameWait(1);
      const k1 = G.body.translation();
      const kicked = Math.hypot(k1.x - k0.x, k1.z - k0.z);
      ok('L14', !!m && still < 0.2 && kicked > 1, `magnet moved it ${still.toFixed(3)} m, kick ${kicked.toFixed(2)} m`);
      placePlayer(5, 5, 0);
      await goHome(G);
    }

    // ---- L15: a gnome pushes a standing letter (a letter lying flat is 0.16 m high: gnomes step over it)
    {
      G.body.setRotation({ x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, true);
      G.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      await frames(3);
      const t0 = G.body.translation();
      const n = g.gnomes.spawn('classic', new V3(G.home.x - 1.5, 0.7, G.home.z), { tier: 'normal' });
      // the gnome walks into the letter (its AI would pick its own target)
      for (let i = 0; i < 60; i++) { n?.body.setLinvel({ x: 3, y: n.body.linvel().y, z: 0 }, true); await frames(1); }
      const t1 = G.body.translation();
      const moved = Math.hypot(t1.x - t0.x, t1.z - t0.z);
      const gp = n?.body.translation();
      const info = `gnome ${!!n} ${n?.state} at ${gp ? `${gp.x.toFixed(1)},${gp.z.toFixed(1)}` : '-'} letter ${t0.x.toFixed(1)},${t0.z.toFixed(1)}`;
      if (n && n.state !== 'gone') g.gnomes.remove(n);
      ok('L15', !!n && moved > 0.1, `moved ${moved.toFixed(2)} m, ${info}`);
      await goHome(G);
    }

    // ---- L9: fallen off the map
    {
      // away from the hole: a letter below the hole's rim counts as eaten
      G.body.setTranslation({ x: 10, y: -12, z: 10 }, true);
      await gameWait(1.5);
      ok('L9', xzHome(G) < 3, `from home ${xzHome(G).toFixed(2)} m`);
      await goHome(G);
    }

    // ---- L21: over the fence: own-land letter goes home, the chair stays out, a locked-land letter rests at its spot
    {
      const h = g.env.max.x;
      let bursts = 0;
      const at = [];
      const fb0 = g.fx.burst.bind(g.fx);
      g.fx.burst = (...a) => { bursts++; at.push({ x: a[0].x, z: a[0].z, c: a[1], n: a[2] }); return fb0(...a); };
      G.body.setTranslation({ x: h + 5, y: 1, z: 0 }, true);
      const chair = g.props.list.find((p) => p.kind === 'chair');
      chair.body.setTranslation({ x: 0, y: 1, z: h + 5 }, true);
      chair.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      const N = L('N');
      const n0 = xzHome(N);
      await gameWait(1.5);
      g.fx.burst = fb0;
      const chairOut = outside(chair);
      ok('L21', xzHome(G) < 3 && bursts > 0 && chairOut && xzHome(N) < 1 && outside(N), `G from home ${xzHome(G).toFixed(2)} bursts ${bursts} chair outside ${chairOut} N from home ${n0.toFixed(2)} -> ${xzHome(N).toFixed(2)}`);
      // animation rule 3: a gold burst where the letter vanished, beyond the fence, not only at home
      const old = at.find((b) => Math.hypot(b.x - (h + 5), b.z) < 1.5 && b.c === 0xffd23f && b.n === 12);
      ok('L21burst', !!old, `bursts at [${at.map((b) => `${b.x.toFixed(1)},${b.z.toFixed(1)} n ${b.n}`)}]`);
      chair.body.setTranslation({ x: chair.home.x, y: chair.home.y + 1, z: chair.home.z }, true);
      await goHome(G);
    }

    // ---- L22: the house stands beyond the back fence on every land, so a letter on its roof goes home at once (fence
    // rule); resting on the factory top (inside the fence) it goes home after 3 s; flying over it, it does not. On Garden.
    {
      const st = freshState(); st.land = 1; st.holeLevel = 3;
      reload(st);
      g.env.rebuildHole();
      g.env.rebuildLand();
      await gameWait(1.5);
      const G = L('G');
      G.body.setTranslation({ x: 0, y: 6.6, z: -27.5 }, true);
      G.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      await gameWait(1);
      const houseHome = xzHome(G) < 3;
      const top = { x: -7.5, y: 3.4, z: -13 };
      G.body.setTranslation(top, true);
      G.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      await gameWait(0.6);
      const y0 = G.body.translation().y;
      const early = xzHome(G) < 3;
      await gameWait(4);
      const rested = xzHome(G) < 3;
      G.body.setTranslation(top, true);
      G.body.setLinvel({ x: 0, y: 0, z: 8 }, true);
      await frames(3);
      const fy = G.body.translation().y;
      const flyingHome = xzHome(G) < 3;
      ok('L22', houseHome && y0 > 2.5 && !early && rested && fy > 2.5 && !flyingHome, `house roof home within 1 s ${houseHome}; on the factory at y ${y0.toFixed(2)}, home at 0.6 s ${early}, after 4 s ${rested}; flying y ${fy.toFixed(2)} home ${flyingHome}`);
      // while the player holds something (here a crate, which may carry the letter) the 3 s rule waits
      placePlayer(5, -15, 0);
      const chair = g.props.list.find((p) => p.kind === 'chair');
      chair.body.setTranslation({ x: 5, y: 1.5, z: -16.5 }, true);
      chair.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.player.held = { body: chair.body, crate: { queue: [] } };
      G.body.setTranslation(top, true);
      G.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      await gameWait(4);
      const stillHeld = !!g.player.held?.crate;
      const hy = G.body.translation().y;
      const heldHome = xzHome(G) < 3;
      g.player.held = null;
      ok('L22held', stillHeld && hy > 2.5 && !heldHome, `held crate ${stillHeld} letter y ${hy.toFixed(2)} home ${heldHome}`);
      reload(freshState());
      g.env.rebuildHole();
      g.env.rebuildLand();
      await gameWait(1.5);
    }

    // ---- L4 / L5: E fed from the hand, then the rest; a second E changes nothing
    {
      const E = L('E');
      const money0 = g.state.money;
      paid = 0;
      placePlayer(0, 3, 0, -0.6);
      E.body.setTranslation({ x: 0, y: 1, z: 0.8 }, true);
      g.player.held = { body: E.body, prop: E };
      for (let i = 0; i < 300 && E.respawn === 0; i++) await frames(1);
      await frames(2);
      const tt = toastTexts().join(' | ');
      ok('L4', !E.body.isEnabled() && !E.mesh.visible && E.respawn === Infinity && g.props.list.includes(E) && g.props.byCollider.get(E.collider.handle) === E
        && g.state.secrets.includes('letter-E') && tt.includes('_ _ _ _ E') && g.state.money === money0 && paid === 0 && g.player.held === null && !g.buffs.active('booze'),
        `enabled ${E.body.isEnabled()} visible ${E.mesh.visible} respawn ${E.respawn} secrets [${g.state.secrets}] paid ${paid} held ${g.player.held} toasts "${tt}"`);
      placePlayer(5, 5, 0);
      for (const c of ['G', 'N', 'O', 'M']) await feed(c);
      await frames(2);
      const want = 250 * g.hole.valueScale;
      const tt2 = toastTexts().join(' | ');
      const full = g.buffs.active('booze') && g.state.achievements.includes('booze') && Math.abs(paid - want) < 1e-6 && tt2.includes('GNOME! The hole is properly boozed.');
      const paid1 = paid;
      const n1 = g.state.secrets.length;
      g.hole.consumeLetter('E');
      ok('L5', full && paid === paid1 && g.state.secrets.length === n1, `buff ${g.buffs.active('booze')} paid ${paid.toFixed(2)} want ${want.toFixed(2)} toasts "${tt2}"`);

      // ---- L6: once per save: the next load and the next run (rebirth keeps secrets) have no letters
      const st = g.state;
      reload(JSON.parse(JSON.stringify(st)));
      const afterReload = letters().length;
      const reborn = freshState(st);
      reload(reborn);
      ok('L6', afterReload === 0 && letters().length === 0 && WORD.split('').every((c) => reborn.secrets.includes(`letter-${c}`)), `after reload ${afterReload}, after rebirth ${letters().length}`);
    }

    // ---- L8: freshState keeps the shovel and letter secrets
    {
      const st = freshState(); st.secrets = ['shovel', 'letter-G'];
      const nx = freshState(st);
      ok('L8', nx.secrets.includes('shovel') && nx.secrets.includes('letter-G'), `[${nx.secrets}]`);
    }

    // ---- L7: reload with G N O eaten on land 2: only M and E, beyond the fence
    {
      const st = freshState(); st.land = 2; st.holeLevel = 5; st.secrets = ['letter-G', 'letter-N', 'letter-O'];
      reload(st);
      const chs = letters().map((p) => p.letter).join('');
      ok('L7', chs === 'ME' && letters().every((p) => outside(p, maxOf(2))), `letters ${chs}`);
    }

    // ---- L10: any order completes
    {
      reload(freshState());
      g.env.rebuildHole();
      g.env.rebuildLand();
      await gameWait(1.5);
      achToasts = 0;
      for (const c of ['E', 'M', 'O', 'N', 'G']) await feed(c);
      await frames(2);
      ok('L10', g.buffs.active('booze') && g.state.achievements.includes('booze') && achToasts === 1, `buff ${g.buffs.active('booze')} achievement toasts ${achToasts}`);
    }

    // ---- L20
    {
      const b = ACHIEVEMENTS.find((a) => a.id === 'booze');
      ok('L20', ACHIEVEMENTS.length === 26 && b.secret === true && b.name === 'Properly Boozed' && b.desc === 'Feed the hole the word GNOME.', `${ACHIEVEMENTS.length} "${b.desc}"`);
    }

    // ---- L17: the shovel and the letters are gold without a glow; the shovel goes when taken
    {
      g.buffs.timers.clear(); // no Green Grog wobble from L10 on the screenshots
      const st = freshState(); st.holeLevel = 6;
      reload(st);
      g.env.rebuildHole();
      g.env.rebuildLand();
      g.env.dayClock = 0;
      await gameWait(1.5);
      const sh = g.props.shovel;
      // gold metal, no glow sprite near the shovel or on any letter (PP 2026-10-21 "lopata ma nie swiecic [...] litery tez nie")
      const sprites = [];
      g.scene.traverse((o) => { if (o.type === 'Sprite' && o.position.distanceTo(sh.position) < 2) sprites.push(o); });
      const letterSprites = g.props.list.filter((p) => p.kind === 'letter').reduce((n, p) => n + p.mesh.children.filter((c) => c.type === 'Sprite').length, 0);
      placePlayer(-17.5, 17.8, Math.atan2(2.9, -2.8), -0.35);
      await gameWait(1);
      g.paused = true;
      await shot('shovel');
      g.paused = false;
      g.env.dayClock = 0.82 * 240;
      await gameWait(7);
      await shot('shovel-night');
      const night = g.env.nightShade;
      placePlayer(-19.5, 19.6, 0);
      await frames(1);
      g.input.pressed.add('KeyE');
      await frames(3);
      const gold = sh.material.metalness >= 0.8;
      ok('L17', sprites.length === 0 && letterSprites === 0 && gold && g.props.shovel === null && !sh.parent && g.state.secrets.includes('shovel'), `sprites near shovel ${sprites.length} on letters ${letterSprites} gold ${gold} shovel gone ${g.props.shovel === null} night shade ${night.toFixed(2)}`);
    }

    window.__done = JSON.stringify({ checks, errors });
  } catch (e) {
    window.__done = JSON.stringify({ checks, errors, crash: String(e?.stack ?? e) });
  }
})();
