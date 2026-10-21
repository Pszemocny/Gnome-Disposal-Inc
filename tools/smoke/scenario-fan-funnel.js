// Fan power (key N) and the Gnome Funnel (plan docs/ai-work/2026-10-21-plan-fan-power-funnel.md, rows A1-A11, B1-B18).
// Run (dev server on 5199): FAKELOCK=1 MAXPOLL=2400 node tools/smoke/smoke.mjs ff-out tools/smoke/scenario-fan-funnel.js
// Static rows (A12, B13) are rg commands in the ai-work note. One RESULT JSON with `checks` (PASS/FAIL).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const kd = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk } });
const ku = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk } });
const key = async (k, code, vk) => { await cdp(kd(k, code, vk), ku(k, code, vk)); await frames(3); };
const KEYS = { g: ['g', 'KeyG', 71], x: ['x', 'KeyX', 88], e: ['e', 'KeyE', 69], n: ['n', 'KeyN', 78], q: ['q', 'KeyQ', 81] };
const press = (c) => key(...KEYS[c]);
const click = async () => {
  await cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x: 320, y: 180, button: 'left', buttons: 1, clickCount: 1 } },
    { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x: 320, y: 180, button: 'left', buttons: 0, clickCount: 1 } });
  await frames(4);
};
const clickEl = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); const x = r.x + r.width / 2; const y = r.y + r.height / 2;
  return cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 } }); };

const g = window.gnome;
const R = {};
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const J = (o) => JSON.stringify(o);
const r2 = (v) => Math.round(v * 100) / 100;
const near = (a, b, e) => Math.abs(a - b) <= e;
const teleport = async (x, z, yaw, pitch = 0) => {
  g.player.body.setTranslation({ x, y: 1, z }, true); g.player.position.set(x, 1, z); g.player.yaw = yaw; g.player.pitch = pitch;
  await frames(4);
  g.player.yaw = yaw; g.player.pitch = pitch;
  await frames(2);
};
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
let V3; let Qt;
const qy = (a) => new Qt().setFromAxisAngle(new V3(0, 1, 0), a);
const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
const reset = async () => { if (g.shop.isOpen) g.shop.close(); g.player.cancelPlacement(); clearGnomes(); g.machines.clearAll(); await frames(3); };
const prompt = () => document.querySelector('.hud-prompt')?.innerText ?? '';
const spawn = (type, p, opts = {}) => g.gnomes.spawn(type, p, { tier: 'normal', ...opts });
const floats = []; const toasts = []; const bigs = [];

// Fan push measured on the fan's own impulses: the gnome is pinned at `dist` m in front (same d every frame),
// impulses along the axis summed over `n` frames and divided by the game time they cover.
const pushRate = async (fan, dist, n = 10) => {
  const fwd = new V3(0, 0, 1).applyQuaternion(fan.quat);
  const at = fan.pos.clone().add(new V3(0, 1.4, 0)).addScaledVector(fwd, dist);
  const x = spawn('classic', at);
  g.gnomes.ragdoll(x, 30);
  const orig = x.body.applyImpulse.bind(x.body);
  let sum = 0;
  x.body.applyImpulse = (imp, w) => { sum += imp.x * fwd.x + imp.y * fwd.y + imp.z * fwd.z; return orig(imp, w); };
  const t0 = g.time;
  for (let i = 0; i < n; i++) {
    x.body.setTranslation(at, true); x.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    await frames(1);
  }
  const rate = sum / Math.max(1e-6, g.time - t0) / x.body.mass();
  g.gnomes.remove(x);
  return rate;
};

setTimeout(() => { if (!window.__done) window.__done = J({ ...R, checks, timeout: true }); }, 590000);
(async () => {
  try {
    g.state.seenIntro = true;
    await clickEl('.menu [data-a="play"]');
    await sleep(800); await frames(5);
    g.state.factoryAuto = false;
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '.hud-helpbox{display:none!important}' }));
    g.moods.update = () => {}; g.contracts.update = () => {}; g.events.spawnVisitor = () => {}; g.events.next = 1e9;
    V3 = g.camera.position.constructor;
    Qt = g.camera.quaternion.constructor;
    R.locked = g.input.locked;
    const of = g.fx.floatText.bind(g.fx); g.fx.floatText = (p, t, c) => { floats.push(t); return of(p, t, c); };
    const ot = g.hud.toast.bind(g.hud); g.hud.toast = (t, k) => { toasts.push(t); return ot(t, k); };
    const ob = g.hud.bigText.bind(g.hud); g.hud.bigText = (...a) => { bigs.push(a[0]); return ob(...a); };
    const { UPGRADE_BY_ID, KEEP_TOOL_IDS } = await import('/src/data/upgrades.ts');
    const U = g.state.upgrades;
    U.fan = 4; U.fanPower = 0;
    const hole = g.env.hole;
    // fans stand 14 m east of the hole, blowing east (away from it), far from the desk (E there opens the shop)
    const F0 = new V3(hole.x + g.env.holeRadius + 6, 0, hole.z + 6);
    const east = qy(Math.PI / 2);

    // ---- A1 default power, push as today
    await reset();
    let fan = g.machines.place('fan', F0.clone(), east);
    await frames(3);
    const rate1 = await pushRate(fan, 3);
    R.A1 = { power: fan.power, rate: r2(rate1), today: r2(55 * (1 - 3 / 10)) };

    // ---- A2 / A3 key N while aiming at the fan (player 4 m west of it, level aim at the hub)
    await teleport(F0.x + 4, F0.z, yawTo(-1, 0), -Math.atan2(g.player.eye.y - 1.4, 4));
    await frames(2);
    const lookedAtFan = g.player.lookAt.machine === fan;
    floats.length = 0;
    await press('n');
    await frames(2);
    R.A2 = { looked: lookedAtFan, power: fan.power, prompt: prompt(), float: floats[0] ?? null };
    const seq = [];
    for (let i = 0; i < 3; i++) { await press('n'); seq.push(fan.power); }
    R.A3 = { seq };

    // ---- A4 power 0.25: a quarter of the push; the blades damp down, not in one frame
    fan.power = 0.25;
    const spins = [];
    for (let i = 0; i < 10; i++) { await frames(1); spins.push(r2(fan.spinRate)); }
    const rateQ = await pushRate(fan, 3);
    const mono = spins.every((s, i) => i === 0 || s <= spins[i - 1] + 1e-6);
    R.A4 = { ratio: r2(rateQ / rate1), spins, distinct: new Set(spins).size, monotone: mono };

    // ---- A5 walking gnomes at 0.25: 3 m stays walking (trip 2.25 m), 1.5 m trips
    {
      const fwd = new V3(1, 0, 0);
      const w3 = spawn('classic', F0.clone().addScaledVector(fwd, 3).setY(0.5), { awake: true, yaw: 0 });
      await frames(20);
      const at3 = w3.state;
      g.gnomes.remove(w3);
      const w15 = spawn('classic', F0.clone().addScaledVector(fwd, 1.5).setY(0.5), { awake: true, yaw: 0 });
      await frames(20);
      R.A5 = { at3m: at3, at1_5m: w15.state };
      g.gnomes.remove(w15);
    }

    // ---- A6 save / reload, old save without `power`
    {
      const saved = g.machines.serialize();
      g.machines.clearAll(); await frames(2);
      g.machines.restore(saved);
      await frames(2);
      const reload = g.machines.list.find((m) => m.type === 'fan')?.power;
      const legacy = { ...saved[0], x: saved[0].x, z: saved[0].z + 4 };
      delete legacy.power;
      g.machines.clearAll(); await frames(2);
      g.machines.restore([legacy]);
      await frames(2);
      R.A6 = { savedPower: saved[0].power, reload, legacy: g.machines.list.find((m) => m.type === 'fan')?.power };
    }

    // ---- A7 G keeps the power for one placement, the next fan from the same ghost is 1
    {
      await reset();
      fan = g.machines.place('fan', F0.clone(), east);
      fan.power = 0.5;
      g.machines.place('fan', F0.clone().add(new V3(0, 0, 6)), east);
      await frames(3);
      await teleport(F0.x + 4, F0.z, yawTo(-1, 0), -Math.atan2(g.player.eye.y - 1.4, 4));
      await press('g');
      const placing = g.player.placing;
      // put the ghost down on the ground 5 m north, then a second one 3 m further
      await teleport(F0.x, F0.z - 10, yawTo(0, 1), -0.35);
      const before = new Set(g.machines.list);
      await click();
      const moved = g.machines.list.find((m) => !before.has(m));
      await teleport(F0.x + 3, F0.z - 10, yawTo(0, 1), -0.35);
      const before2 = new Set(g.machines.list);
      await click();
      const next = g.machines.list.find((m) => !before2.has(m));
      R.A7 = { placing, moved: moved?.power ?? null, next: next?.power ?? null };
      g.player.cancelPlacement();
    }

    // ---- A8 blueprint SAVE / LOAD keeps 0.5
    {
      await reset();
      fan = g.machines.place('fan', F0.clone(), east);
      fan.power = 0.5;
      g.blueprints.save(0);
      g.machines.clearAll(); await frames(2);
      g.blueprints.load(0);
      await frames(20);
      R.A8 = { blueprint: g.machines.list.find((m) => m.type === 'fan')?.power ?? null };
      g.blueprints.slots[0] = null;
    }

    // ---- A9 N on a belt and on nothing: no change, no toast, no float
    {
      await reset();
      U.conveyor = 1;
      const belt = g.machines.place('conveyor', F0.clone(), east);
      await frames(3);
      await teleport(F0.x + 4, F0.z, yawTo(-1, 0), -Math.atan2(g.player.eye.y - 0.3, 4));
      const looked = g.player.lookAt.machine === belt;
      const t0 = toasts.length; const f0 = floats.length;
      await press('n');
      await teleport(F0.x + 4, F0.z, yawTo(1, 0), 0.5); // the sky
      await press('n');
      R.A9 = { looked, beltPower: belt.power, toasts: toasts.length - t0, floats: floats.length - f0 };
    }

    // ---- A10 Big Blades 4 at 0.5 = Big Blades 0 at 1 (axis push)
    {
      await reset();
      U.fanPower = 4;
      fan = g.machines.place('fan', F0.clone(), east);
      fan.power = 0.5;
      await frames(3);
      const r = await pushRate(fan, 3);
      U.fanPower = 0;
      R.A10 = { L4at05: r2(r), L0at1: r2(rate1), relErr: r2(Math.abs(r - rate1) / rate1) };
    }

    // ---- A11 broken and repaired with E keeps the power
    {
      fan.power = 0.25;
      g.machines.breakMachine(fan);
      const broken = fan.broken > 0;
      await teleport(F0.x + 4, F0.z, yawTo(-1, 0), -Math.atan2(g.player.eye.y - 1.4, 4));
      await press('e');
      R.A11 = { broken, repaired: fan.broken === 0, afterRepair: fan.power };
    }

    // ================= Part B: the Gnome Funnel
    // ---- B1 shop row locked at hole level 3, open at 4 with its Fuses child
    {
      await reset();
      const showTab = (t) => { g.shop.tab = t; g.shop.render(); };
      g.state.holeLevel = 3;
      // frames after open and close: the shop's unlock must land while it is open, or it pauses the game (B2, B3)
      g.shop.open(); await frames(3); showTab('Tools');
      const name = () => document.querySelector('.shop [data-buy="funnel"] .name')?.textContent ?? null;
      const fuseName = () => document.querySelector('.shop [data-buy="funnelFuses"] .name')?.textContent ?? null;
      const locked3 = name();
      g.state.holeLevel = 4; showTab('Tools');
      const funnel4 = name(); const fuses4 = fuseName();
      // Funnel Fuses opens at hole level 5, like the other late fuse rows
      g.state.holeLevel = 5; showTab('Tools');
      const fuses5 = fuseName();
      g.state.holeLevel = 4;
      g.shop.close(); await frames(3);
      const u = UPGRADE_BY_ID.funnel; const f = UPGRADE_BY_ID.funnelFuses;
      R.B1 = { locked3, funnel4, fuses4, fuses5, paused: g.paused, funnel: [u.cost, u.growth, u.max, u.hole], fuses: [f.cost, f.growth, f.max, f.hole, f.requires] };
    }

    // ---- B2 bought: hotbar slot without a digit, wheel slice, first-use hint
    U.funnel = 3; U.funnelFuses = 1;
    {
      await frames(3);
      const slots = [...document.querySelectorAll('.slot')];
      const slot = slots.find((s) => s.querySelector('.n')?.textContent === 'Gnome Funnel');
      const wheelIds = g.player.wheel.build().map((it) => it.id);
      g.state.seenHints = g.state.seenHints.filter((h) => h !== 'funnel');
      g.player.selectTool('funnel');
      await frames(2);
      const hint = document.querySelector('.hud-hint')?.innerText ?? '';
      R.B2 = { wheelHas: wheelIds.includes('funnel'), hotbarKey: slot?.querySelector('.k')?.textContent ?? null, hint: hint.includes('Gnome Funnel') && hint.includes('Tab') };
      g.player.cancelPlacement();
    }

    // ---- B3 placed in the air: ghost at wheel distance 6, looking up 0.6 rad
    let fun;
    {
      await reset();
      const P = new V3(hole.x - g.env.holeRadius - 10, 0, hole.z - 6);
      await teleport(P.x, P.z, yawTo(0, -1), 0.6);
      g.player.selectTool('funnel');
      g.player.ghostDist = 6;
      await frames(4);
      await click();
      fun = g.machines.list.find((m) => m.type === 'funnel');
      const y0 = fun?.body.translation();
      await frames(60);
      const y1 = fun?.body.translation();
      R.B3 = { placed: g.machines.placedCount('funnel'), y: fun ? r2(fun.pos.y) : null, fixed: fun?.body.isFixed() ?? null, drift: y0 && y1 ? r2(Math.hypot(y1.x - y0.x, y1.y - y0.y, y1.z - y0.z)) : null };
      g.player.cancelPlacement();
    }

    // ---- B4 ghost over the hole is blocked; the tube 0.6 m outside the rim is not (the mouth may overhang)
    {
      const Rr = g.env.holeRadius;
      const pitch = 0.3;
      const ghostAt = async (centreFromHole, back) => {
        await teleport(hole.x + centreFromHole + back, hole.z, yawTo(-1, 0), pitch);
        g.player.selectTool('funnel');
        g.player.ghostDist = back / Math.cos(pitch);
        await frames(4);
        const b = g.player.ghostBlocked;
        g.player.cancelPlacement();
        return b;
      };
      R.B4 = { overHole: await ghostAt(0, Rr + 3), rim0_6: await ghostAt(Rr + 0.55 + 0.6, 4) };
    }

    // a funnel on the ground 8 m east of the hole edge, upright, for the catch rows
    const FP = new V3(hole.x + g.env.holeRadius + 8, 0, hole.z);
    // the player stands 8 m south, facing the funnel: out of the shot's line to the hole (B5) and framing it (B9 screenshot)
    const putFunnel = async () => { await reset(); await teleport(FP.x, FP.z + 8, yawTo(0, -1), 0); fun = g.machines.place('funnel', FP.clone(), qy(0)); await frames(3); return fun; };
    const mouthPoint = (dy = 0) => fun.pos.clone().add(new V3(0, 3.15 + dy, 0));

    // ---- B5 a gnome dropped into the mouth: stashed, then launched at the hole, eaten at x0.25 XP, no trick
    {
      await putFunnel();
      const xpLog = [];
      const oc = g.hole.consume.bind(g.hole);
      const oa = g.hole.addXp.bind(g.hole);
      let inConsume = null;
      g.hole.addXp = (n) => { if (inConsume) xpLog.push({ n, expect: inConsume }); return oa(n); };
      g.hole.consume = (x, at, m) => { inConsume = x.type.xp * x.xpTier.value * 0.25 * g.hole.xpMult; const b0 = bigs.length; try { return oc(x, at, m); } finally { inConsume = null; xpLog[xpLog.length - 1] && (xpLog[xpLog.length - 1].bigs = bigs.length - b0); } };
      const x = spawn('classic', mouthPoint(1.5));
      g.gnomes.ragdoll(x, 5);
      let stashed = false; let qlen = 0;
      for (let i = 0; i < 20 && !stashed; i++) { await frames(1); stashed = x.state === 'stashed'; qlen = fun.queue.length; }
      let released = false; let aim = null; let thrownBy = null;
      for (let i = 0; i < 30 && !released; i++) {
        await frames(1);
        if (x.state === 'ragdoll' && !fun.queue.length) {
          released = true;
          const v = x.body.linvel(); const p = x.body.translation();
          const a1 = Math.atan2(v.x, v.z); const a2 = Math.atan2(hole.x - p.x, hole.z - p.z);
          aim = r2(Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))));
          thrownBy = x.thrownBy;
        }
      }
      const eaten0 = g.state.stats.gnomesEaten;
      for (let i = 0; i < 60 && g.state.stats.gnomesEaten === eaten0; i++) await frames(2);
      g.hole.consume = oc; g.hole.addXp = oa;
      const e = xpLog[0];
      R.B5 = { stashed, queue: qlen, released, aim, thrownBy, eaten: g.state.stats.gnomesEaten - eaten0, xp: e ? r2(e.n) : null, xpExpect: e ? r2(e.expect) : null, trick: e ? e.bigs > 0 : null };
    }

    // ---- B6 a walking gnome under / beside the tube stays free; B7 the King in the mouth zone stays free
    {
      await putFunnel();
      const w = spawn('classic', fun.pos.clone().add(new V3(0.9, 0.5, 0)), { awake: true, yaw: 0 });
      await frames(30);
      R.B6 = { under: w.state };
      g.gnomes.remove(w);
      const k = spawn('king', mouthPoint(0.3));
      await frames(10);
      R.B7 = { king: k && k.state !== 'stashed' ? 'free' : 'caught', queue: fun.queue.length };
      if (k) g.gnomes.remove(k);
    }

    // ---- B8 outlet turns to the hole; a hole carry moves it at the same height
    {
      await putFunnel();
      await frames(60);
      const yawErr = () => { const want = Math.atan2(hole.x - fun.pos.x, hole.z - fun.pos.z) - fun.yaw; const d = want - fun.spin.rotation.y; return r2(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))); };
      const e0 = yawErr();
      const y0 = fun.pos.y;
      const old = hole.clone(); const Rr = g.env.holeRadius;
      // the hole grows 1 m in place: a tool within the rim band (< 1.5 m past the rim, hole.ts RIM_CARRY) glides out with the rim
      fun = g.machines.place('funnel', hole.clone().add(new V3(Rr + 1, 0, 0)), qy(0));
      await frames(3);
      const fy = fun.pos.y; const fx = fun.pos.x;
      g.hole.carry(old, Rr, old, Rr + 1, 0.5);
      await frames(40);
      R.B8 = { yawErr: e0, y: r2(y0), carriedOut: r2(fun.pos.x - fx), carriedY: r2(fun.pos.y - fy), afterCarry: yawErr() };
    }

    // ---- B9 shot curve: pull-back before the shot, fully back on the shot frame, overshoot, settle (12+ samples)
    {
      await putFunnel();
      await frames(30);
      const x = spawn('classic', mouthPoint(0.2));
      g.gnomes.ragdoll(x, 5);
      const zs = []; let shotAt = -1;
      for (let i = 0; i < 80; i++) {
        await frames(1);
        const z = fun.spin.children[0].position.z;
        zs.push({ z: r2(z), t: r2(g.time), w: fun.windup !== undefined });
        // the game is paused for the screenshot: it takes longer than the follow-through, which would run unsampled
        if (shotAt < 0 && x.state === 'ragdoll' && fun.queue.length === 0 && zs.length > 1) { shotAt = i; g.paused = true; await shot('ff-B9-shot'); g.paused = false; }
        if (shotAt >= 0 && g.time - zs[shotAt].t > 1.2) break;
      }
      const after = shotAt >= 0 ? zs.slice(shotAt) : [];
      const pre = shotAt > 0 ? zs.slice(0, shotAt) : [];
      R.B9 = { samples: zs.length, preMin: pre.length ? Math.min(...pre.map((s) => s.z)) : null, shotZ: after[0]?.z ?? null, overshoot: after.length ? Math.max(...after.map((s) => s.z)) : null, settle: after.length ? Math.abs(after[after.length - 1].z) : null };
    }

    // ---- B10 saboteur hits: fuse, then broken (no catch while broken); E from 5 m repairs (reach 6 m, PP F2)
    {
      await reset();
      fun = g.machines.place('funnel', FP.clone().setY(3), qy(0));
      await frames(3);
      g.machines.breakMachine(fun); g.machines.breakMachine(fun);
      const broken = fun.broken > 0;
      const x = spawn('classic', mouthPoint(0.3));
      g.gnomes.ragdoll(x, 5);
      await frames(8);
      const caughtWhileBroken = fun.queue.length;
      g.gnomes.remove(x);
      // stand 5 m away and aim at the tube's middle (about 5.8 m from the eye)
      const tube = fun.pos.clone().add(new V3(0, 1.5, 0));
      await teleport(tube.x + 5, tube.z, yawTo(-1, 0), 0);
      g.player.pitch = Math.atan2(tube.y - g.player.eye.y, 5); await frames(3);
      const looked = g.player.lookAt.machine === fun;
      await press('e');
      R.B10 = { broken, caughtWhileBroken, looked, repairedFrom5m: fun.broken === 0 };
    }

    // ---- B11 removed with a queue: the gnome comes out again
    {
      await putFunnel();
      const x = spawn('classic', new V3(FP.x + 20, 0.5, FP.z));
      g.gnomes.stash(x); fun.queue.push(x);
      fun.t = -10; // hold the shot
      g.machines.remove(fun);
      await frames(2);
      R.B11 = { queueReleased: x.state === 'ragdoll' };
    }

    // ---- B12 save / blueprint at y 4
    {
      await reset();
      fun = g.machines.place('funnel', FP.clone().setY(4), qy(0.7));
      const ref = { x: r2(fun.pos.x), y: r2(fun.pos.y), z: r2(fun.pos.z), qy: r2(fun.quat.y) };
      const saved = g.machines.serialize();
      g.machines.clearAll(); await frames(2);
      g.machines.restore(saved); await frames(2);
      const a = g.machines.list.find((m) => m.type === 'funnel');
      const reload = a ? { x: r2(a.pos.x), y: r2(a.pos.y), z: r2(a.pos.z), qy: r2(a.quat.y) } : null;
      g.blueprints.save(0);
      g.machines.clearAll(); await frames(2);
      g.blueprints.load(0); await frames(20);
      const b = g.machines.list.find((m) => m.type === 'funnel');
      const bp = b ? { x: r2(b.pos.x), y: r2(b.pos.y), z: r2(b.pos.z), qy: r2(b.quat.y) } : null;
      g.blueprints.slots[0] = null;
      R.B12 = { ref, reload, blueprint: bp };
    }

    // ---- B14 queue cap 20
    {
      await putFunnel();
      fun.t = -100; // no shot during the test
      for (let i = 0; i < 20; i++) { const x = spawn('classic', new V3(FP.x + 20, 0.5, FP.z + i * 0.1)); g.gnomes.stash(x); fun.queue.push(x); }
      const extra = spawn('classic', mouthPoint(0));
      g.gnomes.ragdoll(extra, 5);
      await frames(4);
      R.B14 = { queue: fun.queue.length, extraFree: extra.state !== 'stashed' };
    }

    // ---- B15 a gnome the player drops into the mouth (as the Magnet Gun lets go there): full XP (PP F3 b), but no trick
    // through the funnel: the drop point is the mouth 8 m past the rim, which would read as LONG SHOT + AIR every time
    {
      await putFunnel();
      const x = spawn('classic', mouthPoint(1.2));
      g.gnomes.drop(x, new V3(0, -0.1, 0)); // a throw: thrownBy player, throwPos set
      const oc = g.hole.consume.bind(g.hole); const oa = g.hole.addXp.bind(g.hole);
      let got = null; let expect = null; let b0 = 0;
      const st0 = { long: g.state.stats.longShots, air: g.state.stats.airShots, bull: g.state.stats.bullseyes };
      g.hole.consume = (y, at, m) => { expect = y.type.xp * y.xpTier.value * (1 / Math.sqrt(y.xpGroup?.n ?? 1)) * g.hole.xpMult; b0 = bigs.length; return oc(y, at, m); };
      g.hole.addXp = (n) => { if (expect !== null && got === null) got = n; return oa(n); };
      for (let i = 0; i < 90 && got === null; i++) await frames(2);
      g.hole.consume = oc; g.hole.addXp = oa;
      const st = g.state.stats;
      R.B15 = { handThrowXp: got === null ? null : r2(got), expect: expect === null ? null : r2(expect), trick: bigs.length - b0 > 0, stats: [st.longShots - st0.long, st.airShots - st0.air, st.bullseyes - st0.bull] };
    }

    // ---- B16 tools keep the 6 m reach (PP F2): a fan 5 m away answers to the crosshair, at 10 m it does not;
    // a gnome 5 m away does not (4.5 m)
    {
      await reset();
      fan = g.machines.place('fan', F0.clone(), east);
      await frames(3);
      await teleport(F0.x + 10, F0.z, yawTo(-1, 0), -Math.atan2(g.player.eye.y - 1.4, 10));
      const atFan10 = g.player.lookAt.machine === fan;
      await teleport(F0.x + 5, F0.z, yawTo(-1, 0), -Math.atan2(g.player.eye.y - 1.4, 5));
      const atFan = g.player.lookAt.machine === fan;
      g.machines.clearAll(); await frames(2);
      const x = spawn('classic', new V3(F0.x + 5, 0.5, F0.z), { awake: false });
      await teleport(F0.x + 10, F0.z, yawTo(-1, 0), -Math.atan2(g.player.eye.y - 0.4, 5));
      R.B16 = { lookAtFanAt5m: atFan, lookAtFanAt10m: atFan10, gnomeAt5m: g.player.lookAt.gnome === x ? 'seen' : undefined };
      g.gnomes.remove(x);
    }

    // ---- B17 Keep Tools carries the funnel rows (KEEP_TOOL_IDS = every Tools row)
    R.B17 = { kept: { funnel: KEEP_TOOL_IDS.includes('funnel'), funnelFuses: KEEP_TOOL_IDS.includes('funnelFuses') } };

    // ---- B18 fuse instancing capacity grows with the rows (3 funnels x 5 fuses, 3 boxes)
    R.B18 = { fuseCap: g.machines.fuseMesh.instanceMatrix.count, boxCap: g.machines.boxMesh.instanceMatrix.count };

    // ================= Review round
    // ---- RV2 the ghost is red when the funnel's bottom is out of reach: eye 1.65 m + jump + 6 m look ray (tube from +0.5 m);
    // Spring Socks 3 + Gnome Boots jump higher, so the same spot is green with them
    {
      await reset();
      U.jump = 0; U.boots = 0;
      await teleport(hole.x - g.env.holeRadius - 10, hole.z - 6, yawTo(0, 1), 0);
      await frames(10);
      const eyeY = g.player.eye.y;
      const at = async (bottom) => {
        const pitch = Math.asin((bottom + 1.75 - eyeY) / 14);
        g.player.pitch = pitch;
        g.player.selectTool('funnel'); g.player.ghostDist = 14;
        await frames(4); g.player.pitch = pitch; await frames(2);
        const r = { blocked: g.player.ghostBlocked, y: r2(g.player.ghostPos.y) };
        g.player.cancelPlacement();
        return r;
      };
      const low = await at(7);
      const high = await at(10.5);
      U.jump = 3; U.boots = 1;
      const highBoots = await at(10.5);
      const tooHigh = await at(13.8); // limit with them: 1.65 + 2 x 3.2 + 6 - 0.5 = 13.55

      U.jump = 0; U.boots = 0;
      R.RV2 = { eyeY: r2(eyeY), low, high, highBoots, tooHigh };
    }

    // ---- RV3 a saboteur on the ground skips a funnel hanging 8 m up and walks to the fan 12 m away
    {
      await reset();
      fun = g.machines.place('funnel', FP.clone().setY(8), qy(0));
      const fanS = g.machines.place('fan', FP.clone().add(new V3(0, 0, 12)), east);
      await frames(3);
      const pick = g.machines.nearestWorking(new V3(FP.x + 0.5, 0.5, FP.z));
      const s = g.gnomes.spawn('saboteur', new V3(FP.x + 0.5, 0.5, FP.z), { tier: 'normal', awake: true });
      await frames(40);
      R.RV3 = { pick: pick?.type ?? null, funnelBlown: fun.blown, funnelBroken: fun.broken > 0, targetToFan: s?.target ? r2(Math.hypot(s.target.x - fanS.pos.x, s.target.z - fanS.pos.z)) : null };
      if (s && g.gnomes.list.includes(s)) g.gnomes.remove(s);
    }

    // ---- RV4 a funnel standing on the ground lets the gnome out at least 0.6 m above its base, not inside the ground
    {
      await putFunnel();
      const rel0 = g.gnomes.release.bind(g.gnomes);
      let relY = null;
      g.gnomes.release = (x, p, v) => { if (relY === null) relY = p.y; return rel0(x, p, v); };
      const x = spawn('classic', mouthPoint(0.2));
      g.gnomes.ragdoll(x, 5);
      for (let i = 0; i < 40 && relY === null; i++) await frames(1);
      g.gnomes.release = rel0;
      R.RV4 = { aboveBase: relY === null ? null : r2(relY - fun.pos.y) };
    }

    // ---- RV6 the mouth glows a little in its own orange, so its shaded outer wall does not read brown (screenshot, day)
    {
      await putFunnel();
      await frames(5);
      const mouth = fun.root.getObjectByName('mouth');
      g.paused = true; await shot('ff-RV6-mouth-day'); g.paused = false;
      R.RV6 = { emissive: mouth?.material.emissive.getHexString() ?? null, intensity: mouth?.material.emissiveIntensity ?? null, night: r2(g.env.night) };
    }

    // ---- RV5 a funnel 25 m from the hole at hole level 5 lands the gnome inside the hole (the arc counts the gnome's damping)
    // (last: the level-ups move the hole and grow the yard)
    {
      await reset();
      const { HOLE_LEVELS } = await import('/src/data/holeLevels.ts');
      while (g.state.holeLevel < 5) { g.state.holeXp = HOLE_LEVELS[g.state.holeLevel - 1].xp - 0.01; g.hole.addXp(0.02); }
      for (let i = 0; i < 300 && g.env.sliding; i++) await frames(1);
      await frames(5);
      const h = g.env.hole.clone(); const Rr = g.env.holeRadius;
      let spot = null;
      for (let a = 0; a < 64 && !spot; a++) {
        const ang = (a / 64) * Math.PI * 2;
        const p = new V3(h.x + Math.cos(ang) * 25, 0, h.z + Math.sin(ang) * 25);
        if (g.env.inside(p.x, p.z, 3) && !g.factory.inside(p.x, p.z)) spot = p;
      }
      fun = g.machines.place('funnel', spot, qy(0));
      await teleport(spot.x + 6, spot.z, yawTo(-1, 0), 0);
      await frames(30);
      const x = spawn('classic', mouthPoint(0.2));
      g.gnomes.ragdoll(x, 5);
      let out = false; let land = null; let last = null;
      for (let i = 0; i < 300 && land === null; i++) {
        await frames(1);
        if (!g.gnomes.list.includes(x)) break;
        if (x.state === 'ragdoll' && !fun.queue.length) out = true;
        if (!out) continue;
        const p = x.body.translation(); const v = x.body.linvel();
        last = r2(Math.hypot(p.x - h.x, p.z - h.z));
        if (v.y < 0 && p.y < 0.6) land = last;
      }
      R.RV5 = { level: g.state.holeLevel, radius: Rr, from: spot ? r2(Math.hypot(spot.x - h.x, spot.z - h.z)) : null, out, land: land ?? last, eaten: !g.gnomes.list.includes(x) };
    }
  } catch (e) {
    R.error = String(e && e.stack || e);
  }

  ok('A1', R.A1?.power === 1 && near(R.A1?.rate, R.A1?.today, R.A1?.today * 0.05), J(R.A1));
  ok('A2', R.A2?.looked && R.A2?.power === 0.75 && R.A2?.prompt.includes('N power 75%') && R.A2?.float === '75%', J(R.A2));
  ok('A3', J(R.A3?.seq) === '[0.5,0.25,1]', J(R.A3));
  ok('A4', R.A4?.ratio >= 0.2 && R.A4?.ratio <= 0.3 && R.A4?.distinct >= 3 && R.A4?.monotone, J(R.A4));
  ok('A5', R.A5?.at3m === 'walk' && R.A5?.at1_5m === 'ragdoll', J(R.A5));
  ok('A6', R.A6?.savedPower === 0.25 && R.A6?.reload === 0.25 && R.A6?.legacy === 1, J(R.A6));
  ok('A7', R.A7?.placing === 'fan' && R.A7?.moved === 0.5 && R.A7?.next === 1, J(R.A7));
  ok('A8', R.A8?.blueprint === 0.5, J(R.A8));
  ok('A9', R.A9?.looked && R.A9?.beltPower === 1 && R.A9?.toasts === 0 && R.A9?.floats === 0, J(R.A9));
  ok('A10', R.A10?.relErr <= 0.05, J(R.A10));
  ok('A11', R.A11?.broken && R.A11?.repaired && R.A11?.afterRepair === 0.25, J(R.A11));
  ok('B1', R.B1?.locked3 === '???' && R.B1?.funnel4 === 'Gnome Funnel' && R.B1?.fuses4 === '???' && R.B1?.fuses5 === 'Funnel Fuses' && R.B1?.paused === false &&J(R.B1?.funnel) === '[1500,1.8,3,4]' && J(R.B1?.fuses) === '[1000,1.8,5,5,"funnel"]', J(R.B1));
  ok('B2', R.B2?.wheelHas && R.B2?.hotbarKey === '' && R.B2?.hint, J(R.B2));
  ok('B3', R.B3?.placed === 1 && R.B3?.y > 2 && R.B3?.fixed === true && R.B3?.drift < 0.01, J(R.B3));
  ok('B4', R.B4?.overHole === true && R.B4?.rim0_6 === false, J(R.B4));
  ok('B5', R.B5?.stashed && R.B5?.queue === 1 && R.B5?.released && R.B5?.aim < 0.2 && R.B5?.thrownBy === 'machine' && R.B5?.eaten === 1 && near(R.B5?.xp, R.B5?.xpExpect, 0.011) && R.B5?.trick === false, J(R.B5));
  ok('B6', R.B6?.under === 'walk' || R.B6?.under === 'ragdoll', J(R.B6)); // free, not stashed
  ok('B7', R.B7?.king === 'free' && R.B7?.queue === 0, J(R.B7));
  ok('B8', R.B8?.yawErr < 0.1 && R.B8?.carriedOut > 0.5 && Math.abs(R.B8?.carriedY) < 0.01 && R.B8?.afterCarry < 0.1, J(R.B8));
  // the 0.08 s pull-back gets about 5 frames, so the last sampled frame before the shot reaches ~70 %: at least half back
  ok('B9', R.B9?.preMin < -0.14 && R.B9?.shotZ < -0.2 && R.B9?.overshoot > 0 && R.B9?.settle < 0.03, J(R.B9));
  ok('B10', R.B10?.broken && R.B10?.caughtWhileBroken === 0 && R.B10?.looked && R.B10?.repairedFrom5m, J(R.B10));
  ok('B11', R.B11?.queueReleased, J(R.B11));
  ok('B12', J(R.B12?.reload) === J(R.B12?.ref) && J(R.B12?.blueprint) === J(R.B12?.ref), J(R.B12));
  ok('B14', R.B14?.queue === 20 && R.B14?.extraFree, J(R.B14));
  ok('B15', R.B15?.handThrowXp !== null && near(R.B15?.handThrowXp, R.B15?.expect, 0.011) && R.B15?.trick === false && J(R.B15?.stats) === '[0,0,0]', J(R.B15));
  ok('B16', R.B16?.lookAtFanAt5m && R.B16?.lookAtFanAt10m === false && R.B16?.gnomeAt5m === undefined, J(R.B16));
  ok('B17', R.B17?.kept?.funnel && R.B17?.kept?.funnelFuses, J(R.B17));
  ok('B18', R.B18?.fuseCap === 285 && R.B18?.boxCap === 57, J(R.B18));
  ok('RV2', R.RV2?.low?.blocked === false && R.RV2?.high?.blocked === true && R.RV2?.highBoots?.blocked === false && R.RV2?.tooHigh?.blocked === true, J(R.RV2));
  ok('RV3', R.RV3?.pick === 'fan' && R.RV3?.funnelBlown === 0 && R.RV3?.funnelBroken === false, J(R.RV3));
  ok('RV4', R.RV4?.aboveBase >= 0.6, J(R.RV4));
  ok('RV5', R.RV5?.from >= 24.5 && R.RV5?.out && R.RV5?.land !== null && R.RV5?.land < R.RV5?.radius, J(R.RV5));
  ok('RV6', R.RV6?.emissive === 'ff8a2a' && R.RV6?.intensity >= 0.3 && R.RV6?.intensity <= 0.5 && R.RV6?.night === 0, J(R.RV6));
  window.__done = J({ locked: R.locked, error: R.error, checks });
})();
