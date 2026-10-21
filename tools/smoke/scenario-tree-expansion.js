// Tree expansion (plan 2026-10-21-plan-tree-expansion.md, "Done when"): 20 fans at x1.4, Big Blades, per-tool Fuses,
// Wide Belt, shop row packing. One RESULT JSON with the keys of "Done when" plus `checks` (PASS/FAIL).
// Run (about 3 min): URL_QUERY='' DEV_PORT=5199 CDP_PORT=9422 MAXPOLL=2800 node tools/smoke/smoke.mjs te-out tools/smoke/scenario-tree-expansion.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const seconds = async (s) => { const t0 = performance.now(); while (performance.now() - t0 < s * 1000) await frames(1); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const g = window.gnome;
const R = {};
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const KEY = 'gnome-boozed-save-v1';
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps;

setTimeout(() => { if (!window.__done) window.__done = JSON.stringify({ ...R, checks, timeout: true }); }, 680000);
(async () => {
  try {
    const { freshState, loadState, saveState, blockSaves, loadNotes } = await import('/src/core/state.ts');
    const { UPGRADE_BY_ID, UPGRADES, TOOL_IDS, FUSE_TOOLS, upgradeCost } = await import('/src/data/upgrades.ts');
    const { fuseCount, beltWidth } = await import('/src/entities/machines.ts');
    const { money } = await import('/src/core/format.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    if (UPGRADE_BY_ID.fan.max < 10) { window.__done = `FAIL: balance batch not landed (fan max ${UPGRADE_BY_ID.fan.max})`; return; }
    blockSaves();
    const setState = (st) => { g.state = st; g.goals = new Goals(); g.goals.update = () => {}; };
    g.moods.update = () => {}; g.contracts.update = () => {}; g.events.spawnVisitor = () => {}; g.events.next = 1e9;
    const s0 = freshState(); s0.money = 1e9; s0.holeLevel = 11; setState(s0);
    const S = () => g.state;
    g.paused = false;
    for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';
    const V3 = g.camera.position.constructor;
    const Qt = g.camera.quaternion.constructor;
    const Q = () => new Qt();
    const qy = (a) => new Qt().setFromAxisAngle(new V3(0, 1, 0), a);
    const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
    const reset = async () => { clearGnomes(); g.machines.clearAll(); await frames(2); };
    const spawnAt = (type, pos, opts = {}) => g.gnomes.spawn(type, pos, { tier: 'normal', ...opts });
    const node = (id) => document.querySelector(`.shop [data-buy="${id}"]`);
    const cost = (id) => node(id)?.querySelector('.cost')?.textContent ?? null;
    const showTab = (t) => { g.shop.tab = t; g.shop.render(); };
    const bootFrame = async (save) => {
      localStorage.setItem(KEY, JSON.stringify(save));
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0.01;pointer-events:none';
      f.src = '/?lowfx';
      document.body.appendChild(f);
      let ig = null;
      for (let i = 0; i < 300 && !(ig = f.contentWindow?.gnome)?.shop; i++) await sleep(100);
      await sleep(400);
      return f;
    };
    // a test spot far from the hole and the factory
    const hole = g.env.hole;
    R.hole = [+hole.x.toFixed(1), +hole.z.toFixed(1)];
    await reset();

    // ---- F1 fans: 20 at x1.4, no surcharge
    {
      const s = S(); s.upgrades.fan = 4;
      const prices = []; for (let i = 0; i < 16; i++) { const m0 = s.money; g.shop.buy('fan'); prices.push(Math.round(m0 - s.money)); }
      let total = 0; for (let L = 0; L < 20; L++) total += upgradeCost(UPGRADE_BY_ID.fan, L);
      for (let i = 0; i < 20; i++) g.machines.place('fan', new V3(-18 + (i % 10) * 3.8, 0, 17 + Math.floor(i / 10) * 2.5), Q());
      await frames(3);
      const slot = [...document.querySelectorAll('.hud-hotbar .slot')].find((e) => e.textContent.includes('Cooling Fan'));
      R.F1 = { max: UPGRADE_BY_ID.fan.max, prices5to10: prices.slice(0, 6), price11: prices[6], price20: prices[15], total20: total, hotbar: slot?.querySelector('.c')?.textContent ?? null, placed: g.machines.placedCount('fan'), free: g.machines.available('fan') };
      await reset();
    }
    // ---- F2 old saves and a blueprint with 10 fans
    {
      const a = freshState(); a.upgrades.fan = 10; localStorage.setItem(KEY, JSON.stringify(a)); const La = loadState();
      const b = freshState(); b.upgrades.fan = 4; localStorage.setItem(KEY, JSON.stringify(b)); const Lb = loadState();
      localStorage.removeItem(KEY);
      const s = S(); s.upgrades.fan = 10;
      g.blueprints.slots[0] = { at: Date.now(), items: Array.from({ length: 10 }, (_, k) => ({ type: 'fan', x: -18 + k * 3.6 - hole.x, y: 0 - hole.y, z: 17 - hole.z, yaw: 0, tilt: 0, qx: 0, qy: 0, qz: 0, qw: 1 })) };
      g.blueprints.load(0);
      R.F2 = { oldSaveFan: La.upgrades.fan, oldSave4: Lb.upgrades.fan, blueprintFans: g.machines.placedCount('fan') };
      g.blueprints.slots[0] = null;
      await reset();
    }
    // ---- F4 every fuse drawn
    {
      const s = S();
      let i = 0;
      for (const id of TOOL_IDS) { s.upgrades[id] = UPGRADE_BY_ID[id].max; for (let k = 0; k < UPGRADE_BY_ID[id].max; k++, i++) g.machines.place(id, new V3(-20 + (i % 14) * 3, 0, -20 + Math.floor(i / 14) * 3.2), Q()); }
      for (const id of FUSE_TOOLS) s.upgrades[`${id}Fuses`] = 5;
      g.machines.drawFuses();
      R.F4 = { fuses: g.machines.fuseMesh.count, boxes: g.machines.boxMesh.count, skipped: g.machines.list.filter((m) => fuseCount(m) > 0 && m.fuseSlot < 0).length, tools: g.machines.list.filter((m) => fuseCount(m) > 0).length };
      await reset();
      for (const id of [...TOOL_IDS, ...FUSE_TOOLS.map((t) => `${t}Fuses`)]) delete s.upgrades[id];
    }
    // ---- F5 key order
    R.F5 = { toolIds: TOOL_IDS };
    // ---- F6 prices with the late surcharge: Tools exempt
    {
      const s = S(); Object.assign(s.upgrades, { fan: 5, conveyor: 6, robot: 5, value: 5 });
      showTab('Tools'); const fan6 = cost('fan'), belt7 = cost('conveyor'), robot6 = cost('robot');
      showTab('Factory'); R.F6 = { fan6, belt7, robot6, premium6: cost('value') };
      for (const id of ['fan', 'conveyor', 'robot', 'value']) delete s.upgrades[id];
    }

    // ---- P fan power
    const fanAt = (pos, q) => { S().upgrades.fan = Math.max(S().upgrades.fan ?? 0, 1); return g.machines.place('fan', pos, q); };
    const FP = new V3(-14, 0, -20); // fan base, facing +Z (local axis): about 40 m of free lawn in front
    {
      // P1/P2: the impulse of the first frame against today's formula 55 x (1 - d/10) x mass x dt, lift 0.35 of it
      const probe = async (L, d) => {
        await reset(); S().upgrades.fanPower = L;
        const m = fanAt(FP.clone(), Q());
        const n = spawnAt('classic', new V3(FP.x, 1.4, FP.z + d), { awake: false });
        let dtSeen = 0; const up0 = g.machines.update.bind(g.machines); g.machines.update = (dt) => { dtSeen = dt; up0(dt); };
        const imps = []; const ai = n.body.applyImpulse.bind(n.body); n.body.applyImpulse = (v, w) => { imps.push({ ...v, dt: dtSeen, d: Math.hypot(n.body.translation().x - FP.x, n.body.translation().y - 1.4, n.body.translation().z - FP.z) }); return ai(v, w); };
        const z0 = n.body.translation().z;
        // 0.6 s: while both gnomes are still inside the 10 m stream (after it, both only roll out on friction)
        await seconds(0.6);
        g.machines.update = up0;
        const first = imps[0];
        const mass = n.body.mass();
        return { first, mass, flown: n.body.translation().z - z0, m };
      };
      const a = await probe(0, 2.5);
      const exp = (r) => 55 * (1 - r.first.d / 10) * r.mass * r.first.dt;
      R.P1 = { relErr: a.first ? Math.abs(a.first.z / exp(a) - 1) : null, liftRatio: a.first ? +(a.first.y / a.first.z).toFixed(6) : null, flownL0: +a.flown.toFixed(2) };
      const b = await probe(4, 2.5);
      R.P2 = { pushRatio: b.first ? +((b.first.z / exp(b))).toFixed(4) : null, liftL4: b.first ? +(b.first.y / exp(b)).toFixed(4) : null, flownL4: +b.flown.toFixed(2), ratio: +(b.flown / a.flown).toFixed(2) };
      // a gnome at 10.5 m is out of range
      await reset(); S().upgrades.fanPower = 4; fanAt(FP.clone(), Q());
      const far = spawnAt('classic', new V3(FP.x, 0.5, FP.z + 10.5 + 0.2), { awake: false });
      await seconds(1);
      const v = far.body.linvel(); R.P2.farGnomeMoved = Math.hypot(v.x, v.y, v.z) < 0.1 ? 0 : 1;
    }
    {
      // P3 puffs and blade spin
      await reset(); S().upgrades.fanPower = 0;
      const m = fanAt(FP.clone(), Q());
      await seconds(2);
      const ks = []; const w0 = g.fx.wind.bind(g.fx); g.fx.wind = (p, dir, k = 1) => { ks.push(8 * k); return w0(p, dir, k); };
      S().upgrades.fanPower = 4;
      const s0r = m.spinRate;
      await frames(1); const after1 = m.spinRate;
      await seconds(0.5); const after05 = m.spinRate;
      await seconds(1.5);
      g.fx.wind = w0;
      R.P3 = { spinBefore: +s0r.toFixed(2), puffSpeed: ks.length ? ks[ks.length - 1] : null, spinTarget: 25 * (1 + 0.25 * 4), spinAfter1Frame: +after1.toFixed(2), spinAfter0_5s: +after05.toFixed(2), spinSettled: +m.spinRate.toFixed(2) };
      await shot('te-P3-fan-L4');
    }
    {
      // P5 level L4 fan along the yard, 20 gnomes in front, 10 s
      await reset(); S().upgrades.fanPower = 4;
      fanAt(new V3(-18, 0, -18), qy(Math.PI / 4));
      const list = []; for (let i = 0; i < 20; i++) list.push(spawnAt('classic', new V3(-16 + (i % 5) * 0.6, 0.5, -16 + Math.floor(i / 5) * 0.6), { awake: false }));
      const before = list.filter((x) => x && x.state !== 'gone').length;
      await seconds(10);
      R.P5 = { gnomesBefore: before, gnomesAfter: list.filter((x) => x && x.state !== 'gone').length };
    }
    {
      // P5b fan tilted 45 degrees up, 3 m from the fence, gnomes dropped through the stream
      const half = g.env.half;
      const run = async (L) => {
        await reset(); S().upgrades.fanPower = L;
        const q = qy(Math.PI / 2).multiply(new Qt().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 4));
        const base = new V3(half - 3, 0, -6);
        const m = fanAt(base, q);
        const fwd = new V3(0, 0, 1).applyQuaternion(q);
        const o = base.clone().add(new V3(0, 1.4, 0));
        const list = []; for (let i = 0; i < 20; i++) list.push(spawnAt('classic', o.clone().addScaledVector(fwd, 1 + (i % 5) * 0.8).add(new V3(0, 0.5, (Math.floor(i / 5) - 1.5) * 0.6)), { awake: false }));
        let maxX = -1e9;
        const t0 = performance.now();
        while (performance.now() - t0 < 10000) { await frames(1); for (const x of list) if (x.state !== 'gone') maxX = Math.max(maxX, x.body.translation().x); }
        return { outside: list.filter((x) => x.state === 'gone' || Math.abs(x.body.translation().x) > half || Math.abs(x.body.translation().z) > half).length, maxX: +maxX.toFixed(1) };
      };
      const l0 = await run(0); const l4 = await run(4);
      R.P5b = { half, outsideL0: l0.outside, outsideL4: l4.outside, maxXL0: l0.maxX, maxXL4: l4.maxX };
    }
    {
      // P5c level L4 fan, walker at 2 m: tumbles, never hovers
      await reset(); S().upgrades.fanPower = 4;
      fanAt(FP.clone(), Q());
      const n = spawnAt('classic', new V3(FP.x, 0.5, FP.z + 2));
      let maxY = 0; const t0 = performance.now();
      while (performance.now() - t0 < 3000) { await frames(1); maxY = Math.max(maxY, n.body.translation().y); }
      R.P5c = { maxY: +maxY.toFixed(2) };
      await reset();
    }
    {
      // P6 Big Blades node; P4 the blower does not read fanPower (static: only machines.ts reads it)
      const s = S(); delete s.upgrades.fan; s.upgrades.fanPower = 0;
      showTab('Tools');
      const n = node('fanPower');
      R.P6 = { parent: UPGRADE_BY_ID.fanPower.requires, cls: n?.classList.contains('needs') ? 'needs' : n?.className, effect: (n?.dataset.desc ?? '').match(/now: (.*)\)/)?.[1] ?? null };
      s.upgrades.fan = 1; showTab('Tools'); R.P6.price = cost('fanPower');
      delete s.upgrades.fanPower;
    }

    // ---- U per-tool fuses
    {
      const s = S();
      for (const id of FUSE_TOOLS) s.upgrades[id] = 1;
      showTab('Tools');
      const fnodes = [...document.querySelectorAll('.shop [data-buy$="Fuses"]')];
      R.U1 = { fuseNodes: fnodes.length, names: fnodes.map((e) => e.querySelector('.name').textContent), globalFusesNode: document.querySelectorAll('.shop [data-buy="fuses"]').length, parents: FUSE_TOOLS.every((id) => UPGRADE_BY_ID[`${id}Fuses`].requires === id), holes: Object.fromEntries(['fanFuses', 'cannonFuses', 'vacuumFuses', 'blackholeFuses'].map((id) => [id, UPGRADE_BY_ID[id].hole])) };
      const u = (id) => ({ id, name: UPGRADE_BY_ID[id].name, hole: UPGRADE_BY_ID[id].hole, price: cost(id), growth: UPGRADE_BY_ID[id].growth });
      R.U8 = u('conveyorFuses'); R.U9 = u('wheelFuses'); R.U10 = u('magnetFuses'); R.U11 = u('cannonFuses'); R.U12 = u('vacuumFuses'); R.U13 = u('blackholeFuses');
      R.U7 = { boxFuses: 0, panelFuses: 0, nodes: document.querySelectorAll('.shop [data-buy="boxFuses"], .shop [data-buy="panelFuses"]').length };
      for (const id of FUSE_TOOLS) delete s.upgrades[id];
    }
    {
      await reset(); const s = S();
      s.upgrades.fan = 1; s.upgrades.trampoline = 1; s.upgrades.fanFuses = 3; s.upgrades.box = 1; s.upgrades.panel = 1;
      const f = g.machines.place('fan', new V3(10, 0, -16), Q());
      const t = g.machines.place('trampoline', new V3(14, 0, -16), Q());
      const b = g.machines.place('box', new V3(17, 0.5, -16), Q());
      const p = g.machines.place('panel', new V3(19, 0, -16), Q());
      R.U7.boxFuses = fuseCount(b); R.U7.panelFuses = fuseCount(p);
      g.machines.breakMachine(f); g.machines.breakMachine(f); g.machines.breakMachine(f);
      const blown3 = f.blown, broken3 = f.broken;
      g.machines.breakMachine(f);
      g.machines.breakMachine(t);
      R.U2 = { fanBlownAfter3: blown3, fanBrokenAfter3: broken3, fanBrokenAfter4: f.broken, trampBrokenAfter1: t.broken };
      // U6 the saboteur's target ignores fuses: the trampoline is nearer
      f.broken = 0; f.blown = 0; t.broken = 0;
      R.U6 = { target: g.machines.nearestWorking(new V3(13, 0, -16))?.type ?? null };
      // U16 blown above a lowered level is clamped
      f.blown = 9; s.upgrades.fanFuses = 5; await frames(2);
      R.U16 = { blownAfterClamp: f.blown };
      await reset();
      s.upgrades.robot = 1; s.upgrades.robotFuses = 2;
      const r = g.machines.place('robot', new V3(10, 0, -16), Q());
      g.machines.breakMachine(r);
      R.U3 = { robotFuses: fuseCount(r), blownAfterHit: r.blown };
      await reset();
      for (const id of ['fan', 'trampoline', 'fanFuses', 'box', 'panel', 'robot', 'robotFuses']) delete s.upgrades[id];
    }
    {
      // U4 / U17 / U18 migration of the global Fuses
      const load = (up) => { const o = freshState(); o.upgrades = up; localStorage.setItem(KEY, JSON.stringify(o)); loadNotes.length = 0; const L = loadState(); return { L, notes: [...loadNotes] }; };
      const a = load({ fuses: 4 });
      R.U4 = { perTool: FUSE_TOOLS.map((id) => a.L.upgrades[`${id}Fuses`]), fusesKey: a.L.upgrades.fuses, note: a.notes[0] ?? null, savedHasFuses: JSON.stringify(a.L).includes('"fuses"') };
      const b = load({ fuses: 2, fanFuses: 4 });
      R.U17 = { fanFuses: b.L.upgrades.fanFuses, trampolineFuses: b.L.upgrades.trampolineFuses, robotFuses: b.L.upgrades.robotFuses };
      const c = load({ fuses: 0 });
      R.U18 = { fusesKey: c.L.upgrades.fuses, hasKey: 'fuses' in c.L.upgrades, notes: c.notes.length };
      localStorage.removeItem(KEY);
      loadNotes.length = 0;
    }
    {
      // U14 legend rows
      const doc = new DOMParser().parseFromString(`<div>${g.legend.tools()}</div>`, 'text/html');
      const rows = [...doc.querySelectorAll('tr.lg-up')];
      R.U14 = { legendRows: rows.length, upgrades: UPGRADES.length, fuseRows: rows.filter((tr) => / Fuses$/.test(tr.children[0].textContent)).length };
    }
    {
      // U15 / U15b layout at 1280x720
      await cdp({ method: 'Emulation.setDeviceMetricsOverride', params: { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false } });
      await sleep(300);
      const s = S(); for (const id of TOOL_IDS) s.upgrades[id] = 1;
      g.shop.open(); await frames(2);
      const layout = (t) => { document.querySelector(`.shop [data-tab="${t}"]`).click(); const ns = [...document.querySelectorAll('.shop .node')]; return { rows: new Set(ns.map((n) => n.style.top)).size, cols: new Set(ns.map((n) => n.style.left)).size }; };
      const tl = layout('Tools');
      const tree = document.querySelector('.shop-tree'); const rowsEl = document.querySelector('.shop-rows');
      const sc = +(tree.style.transform.match(/scale\(([\d.]+)\)/)?.[1] ?? 1);
      const cut = [...document.querySelectorAll('.shop .node .name')].filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent);
      R.U15 = { ...tl, scale: sc, scrollMax: rowsEl.scrollHeight - rowsEl.clientHeight, cutNames: cut.length, cut };
      await shot('Tools-1280');
      R.U15b = Object.fromEntries(['Plow', 'Magnet', 'Factory', 'Movement', 'Combos', 'Bonuses'].map((t) => [t.toLowerCase(), layout(t).rows]));
      g.shop.close();
      for (const id of TOOL_IDS) delete s.upgrades[id];
      await cdp({ method: 'Emulation.clearDeviceMetricsOverride', params: {} });
      await sleep(300);
      g.paused = false;
    }

    // ---- B belt width
    const belt = (m) => ({ width: m.spin.geometry.parameters.width, body: m.body });
    const local = (m, p) => new V3(p.x - m.pos.x, p.y - m.pos.y, p.z - m.pos.z).applyQuaternion(m.quat.clone().invert());
    {
      await reset(); const s = S(); s.upgrades.conveyor = 3; s.upgrades.beltWidth = 0;
      const m = g.machines.place('conveyor', new V3(-14, 0, 8), Q());
      const cols = [0, 1, 2].map((i) => m.body.collider(i));
      const railX = Math.abs(cols[2].translation().x - m.pos.x);
      const bodyHalfX = cols[0].halfExtents().x;
      // a gnome at lx 0.68 (inside the 0.7 rail test) is carried; centring is -2 x lx at the 1.3 m belt
      const a = spawnAt('classic', new V3(-14 + 0.68, 0.9, 8 - 1.2), { awake: false });
      const b = spawnAt('classic', new V3(-14 - 0.4, 0.9, 8 - 1.2), { awake: false });
      const lv = []; const sl = b.body.setLinvel.bind(b.body); b.body.setLinvel = (v, w) => { const l = local(m, b.body.translation()); lv.push({ c: v.x, lx: l.x }); return sl(v, w); };
      let vzA = 0; const t0 = performance.now();
      while (performance.now() - t0 < 500) { await frames(1); vzA = Math.max(vzA, a.body.linvel().z); }
      const c0 = lv.find((x) => Math.abs(x.lx) > 0.05);
      R.B1 = { width: belt(m).width, railX: +railX.toFixed(3), bodyHalfX: +bodyHalfX.toFixed(3), carriedAt0_68: vzA >= 3, centringRatio: c0 ? +(c0.c / c0.lx).toFixed(4) : null, lxAfter0_5s: +local(m, b.body.translation()).x.toFixed(3) };
    }
    {
      // B2 / B2b: three belts rebuilt in place
      await reset(); const s = S(); s.upgrades.conveyor = 3; s.upgrades.beltWidth = 0; s.upgrades.conveyorFuses = 1;
      const ms = [new V3(-14, 0, 8), new V3(-8, 0, 8), new V3(-2, 0, 8)].map((p) => g.machines.place('conveyor', p, Q()));
      await frames(3);
      const last0 = g.blueprints.last;
      ms[0].blown = 1;
      const spin0 = ms.map((m) => m.spinRate);
      const pos0 = ms.map((m) => m.pos.clone());
      g.shop.buy('beltWidth');
      const spin1 = ms.map((m) => m.spinRate);
      const after = g.machines.list.filter((m) => m.type === 'conveyor');
      const samples = []; for (let i = 0; i < 12; i++) { samples.push(+ms[0].root.scale.x.toFixed(3)); await frames(1); }
      await seconds(0.3);
      g.machines.drawFuses();
      const bm = new g.camera.matrix.constructor(); g.machines.boxMesh.getMatrixAt(0, bm);
      const bp = new V3().setFromMatrixPosition(bm);
      R.B2 = { sameObjects: ms.every((m) => after.includes(m)) && after.length === 3, widths: after.map((m) => +belt(m).width.toFixed(2)), placed: g.machines.placedCount('conveyor'), posKept: ms.every((m, i) => m.pos.distanceTo(pos0[i]) < 1e-6), blownKept: ms[0].blown, spinKept: ms.every((m, i) => spin1[i] === spin0[i]), fuseBoxX: +local(ms[0], bp).x.toFixed(3), lastUnchanged: g.blueprints.last === last0 };
      R.B2b = { scaleSamples: samples, between: samples.some((v) => v > 0.684 && v < 1), scaleAfter0_3s: +ms[0].root.scale.x.toFixed(4) };
      delete s.upgrades.conveyorFuses;
    }
    {
      // B2c two belts 1.38 m apart and a lone one; B2d a gnome standing beside a belt
      await reset(); const s = S(); s.upgrades.conveyor = 3; s.upgrades.beltWidth = 0;
      g.machines.place('conveyor', new V3(-14, 0, 8), Q()); g.machines.place('conveyor', new V3(-12.62, 0, 8), Q());
      const lone = g.machines.place('conveyor', new V3(-4, 0, 8), Q());
      const gn = spawnAt('classic', new V3(-4 + 0.65 + 0.5, 0.5, 8));
      await frames(10);
      const av0 = g.machines.available('conveyor');
      g.shop.buy('beltWidth');
      R.B2c = { pairAfter: g.machines.list.filter((m) => m.type === 'conveyor' && m !== lone).length, available: g.machines.available('conveyor') - av0, msg: g.shop.msg, loneBeltKept: g.machines.list.includes(lone) };
      await frames(1);
      const v = gn.body.linvel();
      R.B2d = { gnomeSpeedNextFrame: +Math.hypot(v.x, v.y, v.z).toFixed(2) };
    }
    {
      // B3: 6 gnomes across a 3.1 m belt
      await reset(); const s = S(); s.upgrades.conveyor = 1; s.upgrades.beltWidth = 3;
      const m = g.machines.place('conveyor', new V3(-10, 0, 8), Q());
      const list = []; for (let i = 0; i < 6; i++) list.push(spawnAt('classic', new V3(-10 - 1.25 + i * 0.5, 0.9, 8 - 1.3), { awake: false }));
      let vz = 0; let spread = 0; const t0 = performance.now();
      while (performance.now() - t0 < 600) {
        await frames(1);
        const on = list.filter((x) => Math.abs(local(m, x.body.translation()).z) < 1.3);
        for (const x of on) vz = Math.max(vz, x.body.linvel().z);
        if (on.length === 6) { const lx = on.map((x) => local(m, x.body.translation()).x); spread = Math.max(...lx) - Math.min(...lx); }
      }
      await seconds(1);
      R.B3 = { carried: list.filter((x) => local(m, x.body.translation()).z > 1.3).length, spread: +spread.toFixed(2), vz: +vz.toFixed(2), tossed: list.every((x) => x.thrownBy === 'machine') };
      await shot('te-B3-wide-belt');
    }
    {
      // B4: the real placement ghost in a 3 m gap between two panels
      const ghostIn = async (L) => {
        await reset(); const s = S(); s.upgrades.conveyor = 1; s.upgrades.panel = 2; s.upgrades.beltWidth = L;
        g.player.body.setTranslation({ x: -10, y: 1.2, z: 0 }, true); g.player.position.set(-10, 1.2, 0); g.player.yaw = 0; g.player.pitch = -0.5;
        await frames(3);
        g.player.selectTool('conveyor');
        await frames(4);
        const c = g.player.ghostPos.clone();
        const right = new V3(1, 0, 0).applyQuaternion(g.player.ghostQuat);
        const pq = g.player.ghostQuat.clone().multiply(qy(Math.PI / 2));
        g.machines.place('panel', c.clone().addScaledVector(right, 1.55).setY(1), pq);
        g.machines.place('panel', c.clone().addScaledVector(right, -1.55).setY(1), pq);
        await frames(6);
        const blocked = g.player.ghostBlocked;
        g.player.cancelPlacement();
        return blocked;
      };
      R.B4 = { blockedL3: await ghostIn(3), blockedL0: await ghostIn(0) };
    }
    {
      // B5: the robot's planning grid around a belt
      const cells = async (L) => {
        await reset(); const s = S(); s.upgrades.conveyor = 1; s.upgrades.robot = 1; s.upgrades.beltWidth = L;
        g.machines.place('conveyor', new V3(-8.5, 0, 8), qy(Math.PI / 2));
        const r = g.machines.place('robot', new V3(-11, 0, 8), Q());
        const t = spawnAt('classic', new V3(-6.5, 0.5, 8));
        g.gnomes.ragdoll(t, 5, 'machine');
        for (let i = 0; i < 120 && !r.robot.grid; i++) await frames(1);
        const gr = r.robot.grid;
        return gr ? gr.cells.reduce((a, b) => a + b, 0) : null;
      };
      R.B5 = { blockedCellsL0: await cells(0), blockedCellsL3: await cells(3) };
    }
    {
      // B6 stripe tiling and scroll; B8 Wide Belt node; B9 box readers
      await reset(); const s = S(); s.upgrades.conveyor = 1; s.upgrades.beltWidth = 3;
      const m = g.machines.place('conveyor', new V3(-10, 0, 8), Q());
      await seconds(1);
      const map = m.spin.material.map;
      let dtSeen = 0; const up0 = g.machines.update.bind(g.machines); g.machines.update = (dt) => { dtSeen = dt; up0(dt); };
      const o0 = map.offset.y; await frames(1); const o1 = map.offset.y;
      g.machines.update = up0;
      const expect = (dtSeen * m.spinRate * 0.13 * 4) / 2.94;
      R.B6 = { repeatX: map.repeat.x, offsetDelta: +(((o1 - o0) + 1) % 1).toFixed(6), expected: +expect.toFixed(6) };
      const { machineBox } = await import('/src/entities/machines.ts');
      const b = machineBox('conveyor');
      R.B9 = { half: b.half[0], mushroomAvoidRadius: +(Math.max(b.half[0], b.half[2]) + 0.3).toFixed(2), stackReach: +(Math.max(b.half[0], b.half[2]) + 0.3).toFixed(2) };
      s.upgrades.beltWidth = 0; delete s.upgrades.conveyor;
      showTab('Tools'); const n0 = node('beltWidth');
      s.upgrades.conveyor = 1; showTab('Tools'); const n1 = node('beltWidth');
      R.B8 = { parent: UPGRADE_BY_ID.beltWidth.requires, clsWithoutBelt: n0?.classList.contains('needs') ? 'needs' : n0?.className, effect: (n1?.dataset.desc ?? '').match(/now: (.*)\)/)?.[1] ?? null, price: n1?.querySelector('.cost')?.textContent };
      await reset();
    }
    {
      // B7: a save with 4 belts at beltWidth 2 (plus one too close) boots at 2.5 m; a blueprint too
      await reset();
      const o = freshState(); o.upgrades = { conveyor: 5, beltWidth: 2 };
      o.placed = [[-14, 8], [-8, 8], [-2, 8], [4, 8], [5.4, 8]].map(([x, z]) => ({ type: 'conveyor', x, y: 0, z, yaw: 0, tilt: 0, qx: 0, qy: 0, qz: 0, qw: 1 }));
      const f = await bootFrame(o);
      const ig = f.contentWindow.gnome;
      const bw = ig.machines.list.filter((m) => m.type === 'conveyor').map((m) => +m.spin.geometry.parameters.width.toFixed(2));
      R.B7 = { bootWidths: bw, noRoomAtBoot: 5 - bw.length };
      f.remove(); localStorage.removeItem(KEY);
      const s = S(); s.upgrades.conveyor = 1; s.upgrades.beltWidth = 2;
      g.blueprints.slots[0] = { at: Date.now(), items: [{ type: 'conveyor', x: -14 - hole.x, y: 0 - hole.y, z: 8 - hole.z, yaw: 0, tilt: 0, qx: 0, qy: 0, qz: 0, qw: 1 }] };
      g.blueprints.load(0);
      const bm = g.machines.list.find((m) => m.type === 'conveyor');
      R.B7.blueprintWidth = bm ? +bm.spin.geometry.parameters.width.toFixed(2) : null;
      g.blueprints.slots[0] = null;
      await reset(); delete s.upgrades.conveyor; s.upgrades.beltWidth = 0;
    }
    {
      // B10-B14 (review 2026-10-24): only fixed things beside the new strip of the belt block Wide Belt, the hole does too
      const s = S();
      // B10 a panel laid flat on the rails
      await reset(); Object.assign(s.upgrades, { conveyor: 1, panel: 1, beltWidth: 0 });
      let belt = g.machines.place('conveyor', new V3(-10, 0, 8), Q());
      const panel = g.machines.place('panel', new V3(-10, 0.77, 8), new Qt().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2));
      await frames(3);
      g.shop.buy('beltWidth');
      R.B10 = { beltKept: g.machines.list.includes(belt), panelKept: g.machines.list.includes(panel), msg: g.shop.msg };
      // B11 a crate resting on the belt
      await reset(); Object.assign(s.upgrades, { conveyor: 1, box: 1, beltWidth: 0 });
      belt = g.machines.place('conveyor', new V3(-10, 0, 8), Q());
      const crate = g.machines.place('box', new V3(-10, 1.6, 8.5), Q());
      await frames(40);
      const crateY = +crate.body.translation().y.toFixed(2);
      g.shop.buy('beltWidth');
      R.B11 = { crateY, beltKept: g.machines.list.includes(belt) };
      // B12 a robot driving 0.2 m beside the rail
      await reset(); Object.assign(s.upgrades, { conveyor: 1, robot: 1, beltWidth: 0 });
      belt = g.machines.place('conveyor', new V3(-10, 0, 8), Q());
      g.machines.place('robot', new V3(-10 + 0.75 + 0.2 + 0.55, 0.02, 8), Q());
      await frames(2);
      g.shop.buy('beltWidth');
      R.B12 = { beltKept: g.machines.list.includes(belt) };
      // B13 a save with the crate listed before the belt it rests on
      await reset(); Object.assign(s.upgrades, { conveyor: 1, box: 1, beltWidth: 1 });
      const back = g.machines.restore([
        { type: 'box', x: -10, y: 0.86, z: 8, yaw: 0, tilt: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        { type: 'conveyor', x: -10, y: 0, z: 8, yaw: 0, tilt: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
      ]);
      R.B13 = { back, types: g.machines.list.map((m) => m.type) };
      // B14 a belt 0.1 m from the hole rim, its long side facing the hole
      await reset(); Object.assign(s.upgrades, { conveyor: 1, beltWidth: 0 });
      belt = g.machines.place('conveyor', new V3(hole.x + g.env.holeRadius + 0.75 + 0.1, 0, hole.z), Q());
      await frames(2);
      g.shop.buy('beltWidth'); g.shop.buy('beltWidth'); g.shop.buy('beltWidth');
      R.B14 = { level: s.upgrades.beltWidth, beltKept: g.machines.list.includes(belt) };
      // B15 the player standing 0.2 m beside a belt can still walk away after Wide Belt 2
      await reset(); Object.assign(s.upgrades, { conveyor: 1, beltWidth: 0 });
      belt = g.machines.place('conveyor', new V3(-10, 0, 8), Q());
      const px = -10 + 0.75 + 0.2 + 0.35;
      g.player.body.setTranslation({ x: px, y: 0.95, z: 8 }, true); g.player.position.set(px, 0.95, 8);
      await frames(5);
      g.shop.buy('beltWidth'); g.shop.buy('beltWidth');
      await frames(20);
      g.player.kcc.computeColliderMovement(g.player.collider, { x: 1, y: 0, z: 0 });
      R.B15 = { beltKept: g.machines.list.includes(belt), awayMove: +g.player.kcc.computedMovement().x.toFixed(2) };
      // B16 a belt the hole is swallowing keeps its old model through Wide Belt, then leaves
      await reset(); Object.assign(s.upgrades, { conveyor: 1, beltWidth: 0 });
      belt = g.machines.place('conveyor', new V3(-10, 0, 8), Q());
      const goneN = g.hole.carry(new V3(40, 0, 40), 1, new V3(-10, 0, 8), 2, 0.5);
      g.shop.buy('beltWidth');
      const widthDuring = +belt.spin.geometry.parameters.width.toFixed(2);
      for (let i = 0; i < 300 && g.machines.list.includes(belt); i++) await frames(1);
      R.B16 = { goneN, widthDuring, removedAfter: !g.machines.list.includes(belt) };
      await reset(); delete s.upgrades.conveyor; delete s.upgrades.panel; delete s.upgrades.box; delete s.upgrades.robot; s.upgrades.beltWidth = 0;
    }
    {
      // P7 + U5 + U16: an old save (global Fuses 5, a level 9 fan fuse) boots, rebirths with Keep Tools, boots again
      const o = freshState(); o.upgrades = { fan: 2, robot: 1, fanPower: 4, beltWidth: 3, fuses: 5 }; o.deep = { dTools: 1 }; o.holeLevel = 12;
      const f = await bootFrame(o);
      let ig = f.contentWindow.gnome;
      R.U5 = { boot: { fanFuses: ig.state.upgrades.fanFuses, fusesKey: ig.state.upgrades.fuses } };
      ig.hole.rebirth();
      for (let i = 0; i < 300 && !(f.contentWindow?.gnome?.shop && f.contentWindow.gnome.state.stats.rebirths === 1); i++) await sleep(100);
      ig = f.contentWindow.gnome;
      const up = ig.state.upgrades;
      R.P7 = { kept: { fanPower: up.fanPower, beltWidth: up.beltWidth, fanFuses: up.fanFuses }, rebirths: ig.state.stats.rebirths };
      R.U5.afterRebirth = { fanFuses: up.fanFuses, robotFuses: up.robotFuses, all: FUSE_TOOLS.every((id) => up[`${id}Fuses`] === 5) };
      f.remove(); localStorage.removeItem(KEY);
      const o2 = freshState(); o2.upgrades = { fanFuses: 9 };
      const f2 = await bootFrame(o2);
      R.U16.fanFusesAfterBoot = f2.contentWindow.gnome.state.upgrades.fanFuses;
      f2.remove(); localStorage.removeItem(KEY);
    }
    {
      // F3 worst yard: Dark Forest, 20 fans L4, 10 belts L3 in a row, 12 robots, 300 gnomes, 30 s
      await reset(); const s = S();
      s.land = 3; g.env.rebuildLand(); await frames(10);
      Object.assign(s.upgrades, { fan: 20, fanPower: 4, conveyor: 10, beltWidth: 3, robot: 12, permit: 5 });
      await frames(3);
      const calls0 = g.renderer.info.render.calls;
      const h = g.env.hole;
      for (let i = 0; i < 20; i++) g.machines.place('fan', new V3(h.x - 40 + i * 4, 0, h.z + 22), Q());
      for (let i = 0; i < 10; i++) g.machines.place('conveyor', new V3(h.x - 22 + i * 4.5, 0, h.z + 14), Q());
      for (let i = 0; i < 12; i++) g.machines.place('robot', new V3(h.x - 30 + i * 5, 0, h.z + 18), Q());
      await frames(3);
      const calls30 = g.renderer.info.render.calls;
      const types = ['classic', 'classic', 'classic', 'dwarf', 'angry', 'greedy'];
      for (let i = 0; g.gnomes.list.length < 300 && i < 3000; i++) spawnAt(types[i % types.length], new V3(h.x - 40 + (i % 40) * 2, 0.6, h.z + 10 + Math.floor(i / 40) * 2));
      const gnomes = g.gnomes.list.length;
      const times = []; const steps = [];
      const up0 = g.machines.update.bind(g.machines); g.machines.update = (dt) => { const t = performance.now(); up0(dt); times.push(performance.now() - t); };
      const st0 = g.physics.step.bind(g.physics); g.physics.step = (...a) => { const t = performance.now(); const r = st0(...a); steps.push(performance.now() - t); return r; };
      await seconds(30);
      g.machines.update = up0; g.physics.step = st0;
      const p95 = (a) => { const b = [...a].sort((x, y) => x - y); return +b[Math.floor(b.length * 0.95)].toFixed(3); };
      R.F3 = { land: s.land, beltWidth: s.upgrades.beltWidth, fanPower: s.upgrades.fanPower, robots: g.machines.placedCount('robot'), gnomes, frames: times.length, updateP95: p95(times), updateMax: +Math.max(...times).toFixed(3), worst: times.map((t, i) => [i, +t.toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 6), stepP95: p95(steps), calls0, calls30 };
      await reset();
    }
  } catch (e) {
    R.error = String((e && e.stack) || e);
  }
  const J = JSON.stringify;
  ok('F1', R.F1?.max === 20 && J(R.F1?.prices5to10) === '[769,1076,1506,2109,2952,4133]' && R.F1?.price11 === 5786 && R.F1?.price20 === 119527 && R.F1?.total20 === 417851 && R.F1?.hotbar === '0/20' && R.F1?.placed === 20 && R.F1?.free === 0, J(R.F1));
  ok('F2', R.F2?.oldSaveFan === 10 && R.F2?.oldSave4 === 4 && R.F2?.blueprintFans === 10, J(R.F2));
  ok('F3', R.F3?.updateP95 <= 2.0 && R.F3?.updateMax <= 8 && R.F3?.robots === 12 && R.F3?.gnomes >= 300, J(R.F3));
  ok('F4', R.F4?.fuses === 270 && R.F4?.boxes === 54 && R.F4?.skipped === 0 && R.F4?.tools === 54, J(R.F4));
  ok('F5', J(R.F5?.toolIds) === J(['box', 'trampoline', 'panel', 'fan', 'conveyor', 'wheel', 'magnet', 'cannon', 'vacuum', 'blackhole', 'robot']), J(R.F5));
  ok('F6', R.F6?.fan6 === '$1.08k' && R.F6?.belt7 === '$2.85k' && R.F6?.robot6 === '$1.49k' && R.F6?.premium6 === '$494', J(R.F6));
  ok('P1', R.P1?.relErr < 1e-6 && near(R.P1?.liftRatio, 0.35), J(R.P1));
  ok('P2', near(R.P2?.pushRatio, 2, 1e-3) && near(R.P2?.liftL4, 0.35, 1e-3) && R.P2?.ratio >= 1.5 && R.P2?.farGnomeMoved === 0, J(R.P2));
  ok('P3', R.P3?.puffSpeed === 16 && R.P3?.spinTarget === 50 && R.P3?.spinAfter1Frame < 40 && R.P3?.spinAfter0_5s > 45, J(R.P3));
  ok('P5', R.P5?.gnomesBefore === 20 && R.P5?.gnomesAfter === 20, J(R.P5));
  ok('P5b', R.P5b?.outsideL0 === 0 && R.P5b?.outsideL4 === 0, J(R.P5b));
  ok('P5c', R.P5c?.maxY < 1.0, J(R.P5c));
  ok('P6', R.P6?.parent === 'fan' && R.P6?.cls === 'needs' && R.P6?.effect === 'x1.00 push, next: x1.25 push' && R.P6?.price === '$150', J(R.P6));
  ok('P7', R.P7?.kept?.fanPower === 4 && R.P7?.kept?.beltWidth === 3 && R.P7?.kept?.fanFuses === 5, J(R.P7));
  ok('U1', R.U1?.fuseNodes === 9 && J(R.U1?.names) === J(['Trampoline Fuses', 'Fan Fuses', 'Belt Fuses', 'Wheel Fuses', 'Magnet Fuses', 'Cannon Fuses', 'Vacuum Fuses', 'Black Hole Fuses', 'Robot Fuses']) && R.U1?.globalFusesNode === 0 && R.U1?.parents && J(R.U1?.holes) === J({ fanFuses: 5, cannonFuses: 6, vacuumFuses: 8, blackholeFuses: 10 }), J(R.U1));
  ok('U2', R.U2?.fanBlownAfter3 === 3 && R.U2?.fanBrokenAfter3 === 0 && R.U2?.fanBrokenAfter4 === 30 && R.U2?.trampBrokenAfter1 === 30, J(R.U2));
  ok('U3', R.U3?.robotFuses === 2 && R.U3?.blownAfterHit === 1, J(R.U3));
  ok('U4', J(R.U4?.perTool) === '[4,4,4,4,4,4,4,4,4]' && R.U4?.fusesKey === undefined && R.U4?.note === 'Fuses are now per tool: every tool got your old level.' && R.U4?.savedHasFuses === false, J(R.U4));
  ok('U5', R.U5?.afterRebirth?.fanFuses === 5 && R.U5?.afterRebirth?.robotFuses === 5 && R.U5?.afterRebirth?.all, J(R.U5));
  ok('U6', R.U6?.target === 'trampoline', J(R.U6));
  ok('U7', R.U7?.boxFuses === 0 && R.U7?.panelFuses === 0 && R.U7?.nodes === 0, J(R.U7));
  ok('U8', R.U8?.id === 'conveyorFuses' && R.U8?.name === 'Belt Fuses' && R.U8?.hole === 5 && R.U8?.price === '$100' && R.U8?.growth === 1.8, J(R.U8));
  ok('U9', R.U9?.hole === 5 && R.U9?.price === '$125', J(R.U9));
  ok('U10', R.U10?.hole === 5 && R.U10?.price === '$500', J(R.U10));
  ok('U11', R.U11?.hole === 6 && R.U11?.price === '$1k', J(R.U11));
  ok('U12', R.U12?.hole === 8 && R.U12?.price === '$2k', J(R.U12));
  ok('U13', R.U13?.hole === 10 && R.U13?.price === '$12.5k', J(R.U13));
  ok('U14', R.U14?.legendRows === 63 && R.U14?.upgrades === 63 && R.U14?.fuseRows === 9, J(R.U14));
  ok('U15', R.U15?.rows === 6 && R.U15?.cols === 8 && R.U15?.scale >= 0.75 && R.U15?.scrollMax <= 0 && R.U15?.cutNames === 0, J(R.U15));
  ok('U15b', J(R.U15b) === J({ plow: 3, magnet: 3, factory: 2, movement: 4, combos: 2, bonuses: 4 }), J(R.U15b));
  ok('U16', R.U16?.fanFusesAfterBoot === 5 && R.U16?.blownAfterClamp <= 5, J(R.U16));
  ok('U17', R.U17?.fanFuses === 4 && R.U17?.trampolineFuses === 2 && R.U17?.robotFuses === 2, J(R.U17));
  ok('U18', R.U18?.hasKey === false && R.U18?.notes === 0, J(R.U18));
  ok('B1', R.B1?.width === 1.3 && near(R.B1?.railX, 0.7, 1e-3) && near(R.B1?.bodyHalfX, 0.75, 1e-3) && R.B1?.carriedAt0_68 && near(R.B1?.centringRatio, -2, 1e-3), J(R.B1));
  ok('B2', R.B2?.sameObjects && J(R.B2?.widths) === '[1.9,1.9,1.9]' && R.B2?.placed === 3 && R.B2?.posKept && R.B2?.blownKept === 1 && R.B2?.spinKept && near(R.B2?.fuseBoxX, 1.1, 1e-3) && R.B2?.lastUnchanged, J(R.B2));
  ok('B2b', R.B2b?.between && R.B2b?.scaleAfter0_3s > 0.99, J(R.B2b));
  ok('B2c', R.B2c?.pairAfter === 1 && R.B2c?.available === 1 && R.B2c?.msg === 'Wide Belt: 1 belt(s) had no room and went back to your inventory.' && R.B2c?.loneBeltKept, J(R.B2c));
  ok('B2d', R.B2d?.gnomeSpeedNextFrame < 5, J(R.B2d));
  ok('B3', R.B3?.carried === 6 && R.B3?.spread >= 1.5 && R.B3?.vz >= 3 && R.B3?.tossed, J(R.B3));
  ok('B4', R.B4?.blockedL3 === true && R.B4?.blockedL0 === false, J(R.B4));
  ok('B5', R.B5?.blockedCellsL3 > R.B5?.blockedCellsL0, J(R.B5));
  ok('B6', R.B6?.repeatX === 2 && near(R.B6?.offsetDelta, R.B6?.expected, 1e-5), J(R.B6));
  ok('B7', J(R.B7?.bootWidths) === '[2.5,2.5,2.5,2.5]' && R.B7?.noRoomAtBoot === 1 && R.B7?.blueprintWidth === 2.5, J(R.B7));
  ok('B8', R.B8?.parent === 'conveyor' && R.B8?.clsWithoutBelt === 'needs' && R.B8?.effect === '1.3 m wide, next: 1.9 m wide' && R.B8?.price === '$400', J(R.B8));
  ok('B10', R.B10?.beltKept && R.B10?.panelKept, J(R.B10));
  ok('B11', R.B11?.crateY < 1.5 && R.B11?.beltKept, J(R.B11));
  ok('B12', R.B12?.beltKept, J(R.B12));
  ok('B13', R.B13?.back === 0 && J(R.B13?.types) === '["box","conveyor"]', J(R.B13));
  ok('B14', R.B14?.level === 3 && R.B14?.beltKept === false, J(R.B14));
  ok('B15', R.B15?.awayMove >= 0.9, J(R.B15));
  ok('B16', R.B16?.goneN === 1 && R.B16?.widthDuring === 1.3 && R.B16?.removedAfter, J(R.B16));
  ok('B9', near(R.B9?.mushroomAvoidRadius, 1.95, 1e-6) && near(R.B9?.stackReach, 1.95, 1e-6), J(R.B9));
  window.__done = JSON.stringify({ ...R, checks });
})();
