// Solid factory (chute, pedestal, gear), robots plan around it, raw mouse input and the mouse-jump / slow-frame lines.
// Run: FULL=1 DPR=1 CDP_PORT=9374 MAXPOLL=2400 node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-factory.js
// Local factory frame: +x = the factory's right, +z = out of the chute (towards the landing ring), metres from its centre.
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const kd = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk } });
const ku = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk } });
const key = (k, code, vk) => cdp(kd(k, code, vk), ku(k, code, vk));
const esc = () => key('Escape', 'Escape', 27);
const mouseTo = (x, y) => cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } });
const clickAt = (x, y) => cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 } });
const clickEl = (sel) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return clickAt(r.x + r.width / 2, r.y + r.height / 2); };

// every beacon the game sends (crash reports and measurement lines), instead of the network
const beacons = [];
navigator.sendBeacon = (u, b) => (beacons.push(String(b)), true);
// the same lines in the browser console (GitHub Pages has no log endpoint)
const consoleLines = [];
const info0 = console.info;
console.info = (...a) => (consoleLines.push(a.join(' ')), info0(...a));
const notes = (kind) => beacons.map((b) => JSON.parse(b).message).filter((m) => m.startsWith(kind));
// pointer lock calls: the first argument of each, plus simulated refusals
const calls = [];
const orig = HTMLCanvasElement.prototype.requestPointerLock;
let refuseN = 0;
let rejectRaw = false;
let rejectRawMs = 0;
let rawAskAt = 0;
HTMLCanvasElement.prototype.requestPointerLock = function (...a) {
  calls.push(a[0]);
  if (refuseN > 0) {
    refuseN--;
    setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
    return Promise.reject(new DOMException('simulated refusal', 'NotAllowedError'));
  }
  if (rejectRaw && a[0]?.unadjustedMovement) {
    setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
    return Promise.reject(new DOMException('simulated: no raw input', 'NotSupportedError'));
  }
  // a slow refusal (the player can press Esc before it arrives)
  if (rejectRawMs && a[0]?.unadjustedMovement) {
    const ms = rejectRawMs;
    rawAskAt = performance.now();
    return new Promise((_, rej) => setTimeout(() => { document.dispatchEvent(new Event('pointerlockerror')); rej(new DOMException('simulated: no raw input', 'NotSupportedError')); }, ms));
  }
  return orig.apply(this, a);
};
const gap = () => sleep(1300); // Chromium refuses a re-lock for about 1 s after an exit
const settle = async (ms = 400) => { await sleep(ms); await frames(3); };
const locked = () => !!document.pointerLockElement;
const vis = (sel) => { const el = document.querySelector(sel); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };

const g = window.gnome;
const fp = g.factory.pos;
const fy = Math.atan2(-fp.x, -fp.z);
const C = Math.cos(fy);
const S = Math.sin(fy);
const L = (x, z) => ({ x: fp.x + x * C + z * S, z: fp.z - x * S + z * C });
const loc = (p) => { const dx = p.x - fp.x; const dz = p.z - fp.z; return { x: dx * C - dz * S, z: dx * S + dz * C }; };
// inside the factory's obstacle rectangles (body, chute, pedestal, gear, lever)
const inside = (p) => g.factory.inside(p.x, p.z);
const V = (x, y, z) => fp.clone().set(x, y, z);
const Q = () => g.factory.lamp.quaternion.clone().set(0, 0, 0, 1);
const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// runs fn every frame for `sec` seconds of game time (stops early when fn returns true)
const during = async (sec, fn) => { const t0 = g.time; for (let i = 0; i < 6000 && g.time - t0 < sec; i++) { await frames(1); if (fn && fn(g.time - t0)) return g.time - t0; } return null; };
const teleport = (lx, lz, yaw) => { const w = L(lx, lz); g.player.body.setTranslation({ x: w.x, y: 1, z: w.z }, true); g.player.position.set(w.x, 1, w.z); g.player.yaw = yaw; g.player.pitch = 0; };
// player yaw that walks along the world direction (dx, dz): forward is (-sin yaw, -cos yaw)
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const walk = async (lx, lz, dirx, dirz, sec, read) => {
  const d = { x: dirx * C + dirz * S, z: -dirx * S + dirz * C };
  teleport(lx, lz, yawTo(d.x, d.z));
  await frames(3);
  let best = null;
  g.input.keys.add('KeyW');
  await during(sec, () => { const v = read(); best = best === null ? v : Math.min(best, v); g.player.yaw = yawTo(d.x, d.z); });
  g.input.keys.delete('KeyW');
  return best;
};
const clearYard = () => { for (const gn of [...g.gnomes.list]) g.gnomes.remove(gn); g.machines.clearAll(); };
const awayFromAll = () => teleport(10, 8, 0);

const out = [];
const step = async (name, fn) => { refuseN = 0; rejectRaw = false; rejectRawMs = 0; try { out.push(`${name} ${await fn()}`); } catch (e) { out.push(`${name} ERR ${String((e && e.stack) || e).slice(0, 300)}`); } };
const sens = () => { const c = document.cookie.match(/gnome_settings=([^;]*)/); return c ? JSON.parse(decodeURIComponent(c[1])).sensitivity : 1; };

(async () => {
  await step('15_lock_option', async () => {
    await clickEl('.menu [data-a="play"]'); await settle(600);
    return `first=${JSON.stringify(calls[0])} locked=${locked()} raw=${g.input.rawOk}`;
  });
  g.state.factoryAuto = false;

  await step('01_player_chute', async () => {
    const dist = await walk(0, 7, 0, -1, 3, () => Math.hypot(g.player.position.x - fp.x, g.player.position.z - fp.z));
    await shot('factory-01-chute');
    return `dist=${dist.toFixed(2)}`;
  });
  await step('04_crank_at_chute', async () => {
    const n0 = g.state.stats.produced;
    const d = Math.hypot(g.player.position.x - fp.x, g.player.position.z - fp.z);
    g.input.keys.add('KeyE');
    await during(2.5);
    g.input.keys.delete('KeyE');
    return `produced=+${g.state.stats.produced - n0} at=${d.toFixed(2)}`;
  });
  await step('02_player_side', async () => `lx=${(await walk(4, 2.0, -1, 0, 3, () => loc(g.player.position).x)).toFixed(2)}`);
  await step('03_player_pedestal', async () => `lx=${(await walk(4, 0.9, -1, 0, 3, () => loc(g.player.position).x)).toFixed(2)}`);

  // gnomes walking straight at a target on the far side; the player far away so nobody flees
  const gnomeWalk = async (from, to, sec, read) => {
    clearYard(); awayFromAll(); await frames(3);
    const a = L(from[0], from[1]);
    const b = L(to[0], to[1]);
    const gn = g.gnomes.spawn('classic', V(a.x, 0.5, a.z), { awake: true, tier: 'normal', yaw: Math.atan2(b.x - a.x, b.z - a.z) });
    const target = V(b.x, 0, b.z);
    let best = null;
    await during(sec, () => {
      if (!g.gnomes.list.includes(gn)) return true;
      gn.think = 99; gn.scared = 0; gn.target = target;
      const v = read(loc(gn.body.translation()));
      best = best === null ? v : Math.min(best, v);
    });
    return `${best?.toFixed(2)} state=${gn.state}`;
  };
  await step('05_gnome_chute', async () => `minLx=${await gnomeWalk([3.5, 2.0], [-3.5, 2.0], 4, (l) => l.x)}`);
  await step('06_gnome_gear', async () => `maxLx=${(await gnomeWalk([-4, 0.2], [4, 0.2], 4, (l) => -l.x)).replace(/^(-?[\d.]+)/, (m) => (-Number(m)).toFixed(2))}`);
  await step('07_gnome_front', async () => `minLz=${await gnomeWalk([0, 5], [0, -3], 4, (l) => l.z)}`);

  await step('08_spawn_clear', async () => {
    clearYard();
    const lvl0 = g.state.holeLevel;
    g.state.holeLevel = 8;
    teleport(5, 7, 0);
    const m = L(0, 2.6);
    const lp = loc(g.player.position);
    g.player.yaw = yawTo(m.x - g.player.position.x, m.z - g.player.position.z); g.player.pitch = -0.25;
    // the king after the burst (one gnome every 0.05 s = 2 s): made within the same 0.05 s as another gnome it starts
    // inside it, and gnomes landing on a king lying on the ring bounce back into the chute top (see the ai-work note)
    g.factory.burst(40);
    let stuck = 0; let worst = 0; let f = 0; let kingAsked = false;
    await during(6, (t) => {
      // produce() only queues, so ask once
      if (t > 2.2 && !kingAsked) { kingAsked = true; g.factory.produce('king'); }
      if (++f < 30) return;
      let n = 0;
      for (const gn of g.gnomes.list) {
        const p = gn.body.translation(); const v = gn.body.linvel();
        if (hd(p, m) < 2 && Math.hypot(v.x, v.y, v.z) < 0.2) { const lift = p.y - 0.44 * gn.scale; worst = Math.max(worst, lift); if (lift > 0.3) n++; }
      }
      stuck = Math.max(stuck, n);
    });
    await shot('factory-08-chute');
    const king = g.gnomes.list.find((gn) => gn.type.id === 'king');
    g.state.holeLevel = lvl0;
    return `stuck=${stuck} worst=${worst.toFixed(2)} gnomes=${g.gnomes.list.length} kingY=${king ? king.body.translation().y.toFixed(2) : 'none'} player=${lp.x.toFixed(1)},${lp.z.toFixed(1)}`;
  });

  // every gnome out of the mouth, with its game time: a burst with the king in the middle, then a parade
  await step('28_release_gaps', async () => {
    clearYard(); awayFromAll(); await frames(3);
    const mouth = L(0, 2.6);
    const sp0 = g.gnomes.spawn;
    let made = [];
    g.gnomes.spawn = function (id, pos, o) { const r = sp0.call(this, id, pos, o); if (r && hd(pos, mouth) < 0.3 && pos.y > 2) made.push({ t: g.time, id, gn: r }); return r; };
    try {
      let king = false;
      g.factory.burst(30);
      // the queue is FIFO: the king comes after the burst, and 5 more after it measure the gap behind it
      await during(4, (t) => { if (!king && t >= 0.3) { king = true; g.factory.produce('king'); g.factory.burst(5); } });
      const gaps = made.slice(1).map((e, i) => e.t - made[i].t);
      const ki = made.findIndex((e) => e.id === 'king');
      const kb = ki > 0 ? gaps[ki - 1] : NaN;
      const ka = ki >= 0 && ki < gaps.length ? gaps[ki] : NaN;
      const burstMin = Math.min(...gaps);
      const burstN = made.length;
      clearYard(); await frames(3);
      made = [];
      g.events.start('parade');
      await during(2);
      const pg = made.slice(1).map((e, i) => e.t - made[i].t);
      const joined = made.filter((e) => e.gn.parade >= 0).length;
      const ok = burstN === 36 && burstMin >= 0.049 && kb >= 0.399 && ka >= 0.399 && made.length === 16 && joined === 16 && Math.min(...pg) >= 0.049;
      return `${ok ? 'PASS' : 'FAIL'} burst=${burstN} minGap=${burstMin.toFixed(3)} kingBefore=${kb.toFixed(3)} kingAfter=${ka.toFixed(3)} parade=${made.length} joined=${joined} paradeMinGap=${Math.min(...pg).toFixed(3)}`;
    } finally { g.gnomes.spawn = sp0; }
  });

  // Chaos (its burst of 15) + OVERTIME + Bigger Batches 5 for 10 s, yard cap lowered to 40: the release queue stays
  // short, the factory stops within one cycle after Chaos ends and the yard stays within cap + the burst
  await step('34_release_backlog', async () => {
    clearYard(); awayFromAll(); await frames(3);
    const f = g.factory;
    const batch0 = g.state.upgrades.batch ?? 0;
    g.state.upgrades.batch = 5;
    const cycle = 6;
    const cap = 40;
    Object.defineProperty(g.gnomes, 'maxGnomes', { get: () => cap, configurable: true });
    try {
      g.buffs.apply('chaos');
      g.buffs.timers.set('chaos', 10);
      f.rush = 10;
      let maxQ = 0; let yard = 0;
      const look = () => { maxQ = Math.max(maxQ, f.queue.length); yard = Math.max(yard, g.gnomes.list.length); };
      await during(10, look);
      g.buffs.timers.set('chaos', 0); f.rush = 0;
      const q0 = f.queue.length;
      const n0 = g.state.stats.produced;
      await during(5, look);
      const after = g.state.stats.produced - n0;
      const ok = maxQ <= 15 + 2 * cycle && after <= 2 * cycle && yard <= cap + 15;
      return `${ok ? 'PASS' : 'FAIL'} maxQueue=${maxQ} queueAtEnd=${q0} after5s=${after} yardMax=${yard} cap=${cap}`;
    } finally {
      delete g.gnomes.maxGnomes;
      g.state.upgrades.batch = batch0; g.buffs.timers.set('chaos', 0); f.rush = 0; f.queue.length = 0;
      clearYard();
    }
  });

  // E aimed at the lever knob from front-left of the pedestal; then a gnome dropped on the pedestal top
  await step('29_lever_from_pedestal', async () => {
    clearYard();
    g.state.factoryAuto = false;
    teleport(1.4, 2.4, 0); await frames(3);
    const a = g.factory.leverAngle;
    const right = { x: C, z: -S }; const fwd = { x: S, z: C };
    const kx = g.factory.leverPos.x + right.x * (-0.32 * Math.sin(a)) + fwd.x * 0.09;
    const kz = g.factory.leverPos.z + right.z * (-0.32 * Math.sin(a)) + fwd.z * 0.09;
    const ky = 1.05 + 0.32 * Math.cos(a);
    const e = g.player.eye;
    g.player.yaw = yawTo(kx - e.x, kz - e.z);
    g.player.pitch = Math.atan2(ky - e.y, Math.hypot(kx - e.x, kz - e.z));
    await frames(3);
    const look = Object.keys(g.player.lookAt).join('+') || 'none';
    const n0 = g.state.stats.produced; const auto0 = g.state.factoryAuto;
    await key('e', 'KeyE', 69); await frames(5);
    const flipped = g.state.factoryAuto !== auto0;
    const made = g.state.stats.produced - n0;
    g.state.factoryAuto = false;
    awayFromAll(); await frames(3);
    const w = L(2.2, 0.9);
    const gn = g.gnomes.spawn('classic', V(w.x, 2.6, w.z), { awake: false, tier: 'normal' });
    await during(3);
    const y = gn.body.translation().y;
    const ok = look.includes('switch') && flipped && made === 0 && y < 1.82;
    return `${ok ? 'PASS' : 'FAIL'} lookAt=${look} flipped=${flipped} produced=+${made} restY=${y.toFixed(2)} want~${(1.2 + 0.44 * gn.scale).toFixed(2)}`;
  });

  // a gnome dropped over the corner of the gear's old square collider, outside the disc
  await step('30_gear_corner', async () => {
    clearYard(); awayFromAll(); await frames(3);
    const w = L(-1.75, 1.25);
    const gn = g.gnomes.spawn('classic', V(w.x, 3.5, w.z), { awake: false, tier: 'normal' });
    g.gnomes.ragdoll(gn, 999);
    await during(3);
    const p = gn.body.translation(); const l = loc(p);
    const ok = !(p.y > 1.9 && hd(p, w) < 0.3);
    return `${ok ? 'PASS' : 'FAIL'} restY=${p.y.toFixed(2)} at=${l.x.toFixed(2)},${l.z.toFixed(2)}`;
  });

  // a robot at a post fetching one still gnome; truck centre sampled every frame
  g.state.upgrades.robot = 4; g.state.upgrades.robotArea = 1;
  const puffs = [];
  const puff0 = g.fx.puff.bind(g.fx);
  // toPost's puff: white, at the home post (the pick puff is white too, but at the gnome)
  let home = null;
  g.fx.puff = (p, c) => { if (c === 0xffffff && home && hd(p, home) < 0.5) puffs.push({ x: p.x, z: p.z }); return puff0(p, c); };
  const robotRun = async (post, gnomeAt, sec, doneWhen) => {
    clearYard(); awayFromAll(); await frames(3);
    const pw = L(post[0], post[1]);
    const m = g.machines.place('robot', V(pw.x, 0, pw.z), Q());
    home = m.pos;
    const gw = L(gnomeAt[0], gnomeAt[1]);
    const gn = g.gnomes.spawn('classic', V(gw.x, 0.5, gw.z), { awake: false, tier: 'normal' });
    puffs.length = 0;
    let ins = 0; let picked = false; let stall = 0; let lastMove = g.time; let lastPos = m.body.translation();
    const t = await during(sec, (el) => {
      const p = m.body.translation();
      if (inside(p)) ins++;
      if (m.robot.state === 'pick' || gn.state === 'stashed') picked = true;
      if (hd(p, lastPos) > 0.3 || !['seek', 'drive', 'return'].includes(m.robot.state)) { lastMove = g.time; lastPos = p; }
      stall = Math.max(stall, g.time - lastMove);
      return doneWhen(m, gn, picked, el);
    });
    return { m, gn, ins, picked, stall, t };
  };
  await step('09_robot_route', async () => {
    const r = await robotRun([4.5, 4.5], [-2.6, 2.6], 30, (m, gn, picked) => picked);
    return `inside=${r.ins} picked=${r.picked} t=${r.t?.toFixed(1)} stall=${r.stall.toFixed(1)}`;
  });
  await step('10_robot_leaning', async () => {
    const r = await robotRun([4.5, 4.5], [0.95, 2.0], 30, (m, gn, picked) => picked || m.robot.skip.has(gn));
    return `inside=${r.ins} resolved=${r.picked ? 'picked' : r.m.robot.skip.has(r.gn) ? 'skipped' : 'no'} t=${r.t?.toFixed(1)} stall=${r.stall.toFixed(1)} gnomeAt=${(({ x, z }) => `${x.toFixed(2)},${z.toFixed(2)}`)(loc(r.gn.body.translation()))}`;
  });
  await step('11_post_band', async () => {
    let left = false;
    const r = await robotRun([0, 3.3], [-2.6, 2.6], 40, (m, gn, picked) => { if (m.robot.state !== 'idle') left = true; return left && picked && m.robot.state === 'idle'; });
    return `inside=${r.ins} idleAt=${r.t?.toFixed(1)} puffs=${puffs.length} picked=${r.picked} state=${r.m.robot.state} fromPost=${hd(r.m.body.translation(), r.m.pos).toFixed(2)} stall=${r.stall.toFixed(1)}`;
  });
  // a heavy fat gnome lying on the chute top (out of reach of the shovel) and, 6 s later, a gnome on the grass
  await step('27_robot_chute_gnome', async () => {
    clearYard(); awayFromAll(); await frames(3);
    const lvl0 = g.state.holeLevel;
    g.state.holeLevel = 8;
    const pw = L(3.5, 5);
    const m = g.machines.place('robot', V(pw.x, 0, pw.z), Q());
    const cw = L(0, 1.9);
    const cg = g.gnomes.spawn('fat', V(cw.x, 1.7, cw.z), { awake: false, tier: 'heavy' });
    g.gnomes.ragdoll(cg, 999);
    let skips = 0;
    const add0 = m.robot.skip.add.bind(m.robot.skip);
    m.robot.skip.add = (x) => { if (x === cg) skips++; return add0(x); };
    let targeted = 0; let grass = null; let grassAt = 0; let wait = null;
    await during(60, (t) => {
      if (m.robot.targetGnome === cg) targeted++;
      if (!grass && t >= 6) { const w = L(6.5, 5); grass = g.gnomes.spawn('classic', V(w.x, 0.5, w.z), { awake: false, tier: 'normal' }); grassAt = t; }
      if (grass && wait === null && ((m.robot.state === 'pick' && m.robot.targetGnome === grass) || grass.state === 'stashed')) wait = t - grassAt;
    });
    const cy = cg.body.translation().y;
    g.state.holeLevel = lvl0;
    const ok = targeted === 0 && skips === 0 && wait !== null && wait <= 3;
    return `${ok ? 'PASS' : 'FAIL'} targetedFrames=${targeted} skips=${skips} grassWait=${wait === null ? 'never' : wait.toFixed(1)} chuteY=${cy.toFixed(2)} scale=${cg.scale.toFixed(2)}`;
  });
  await step('12_restore_skip', async () => {
    clearYard();
    g.state.upgrades.robot = 1; g.state.upgrades.trampoline = 2;
    const e = (type, lx, lz, y) => { const w = L(lx, lz); return { type, x: w.x, y, z: w.z, yaw: 0, tilt: 0 }; };
    g.machines.restore([e('robot', 0, 2.0, 0), e('trampoline', 1.2, 2.0, 0), e('trampoline', 0, 1.9, 1.5)]);
    return `list=${g.machines.list.length} robotAvailable=${g.machines.available('robot')} placed=${g.machines.list.map((m) => m.type.slice(0, 5)).join(',')}`;
  });
  // a blueprint with one tool buried under the chute and one in the open
  await step('33_blueprint_factory_skip', async () => {
    clearYard();
    g.state.upgrades.trampoline = 2;
    const h = g.env.hole;
    const e = (lx, lz, y) => { const w = L(lx, lz); return { type: 'trampoline', x: w.x - h.x, y: y - h.y, z: w.z - h.z, yaw: 0, tilt: 0 }; };
    g.blueprints.slots[0] = { at: Date.now(), items: [e(0, 1.9, 0.2), e(5, 6, 0)] };
    const toasts = [];
    const t0 = g.hud.toast;
    g.hud.toast = function (text, kind) { toasts.push(text); return t0.call(this, text, kind); };
    try { g.blueprints.load(0); } finally { g.hud.toast = t0; }
    const skip = toasts.find((s) => /skipped/.test(s));
    const ok = !!skip && skip.startsWith('1 tool skipped') && g.machines.list.length === 1;
    return `${ok ? 'PASS' : 'FAIL'} placed=${g.machines.list.length} toasts=${JSON.stringify(toasts)}`;
  });
  await step('26_perf', async () => {
    clearYard(); awayFromAll(); await frames(3);
    g.state.upgrades.robot = 4;
    for (const [px, pz] of [[4.5, 4.5], [-4.5, 4.5], [0, 4], [4, -2]]) { const w = L(px, pz); g.machines.place('robot', V(w.x, 0, w.z), Q()); }
    for (const [x, z] of [[-2.6, 2.6], [2.6, 2.6], [0.95, 2.0], [-3, -2], [3, -2.5], [1, 5]]) { const w = L(x, z); g.gnomes.spawn('classic', V(w.x, 0.5, w.z), { awake: false, tier: 'normal' }); }
    const u0 = g.machines.update.bind(g.machines);
    const ts = [];
    g.machines.update = (dt) => { const t = performance.now(); u0(dt); ts.push(performance.now() - t); };
    await during(10);
    g.machines.update = u0;
    ts.sort((a, b) => a - b);
    const ins = g.machines.list.filter((m) => inside(m.body.translation())).length;
    return `p95=${ts[Math.floor(ts.length * 0.95)].toFixed(3)}ms frames=${ts.length} insideNow=${ins}`;
  });
  clearYard(); awayFromAll();

  // mouse: yaw per px = 0.0022 x sensitivity
  const k = 0.0022 * sens();
  const yawAfter = async (fn) => { g.input.skipMove = false; await frames(2); const y0 = g.player.yaw; fn(); await frames(3); return g.player.yaw - y0; };
  const mm = (x, y = 0) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: x, movementY: y }));
  const pm = (x, y = 0) => window.dispatchEvent(new PointerEvent('pointermove', { movementX: x, movementY: y, coalescedEvents: [new PointerEvent('pointermove', { movementX: x, movementY: y })] }));
  await step('17_locked_600', async () => { const v = await yawAfter(() => mm(600)); return `dYaw=${v.toFixed(4)} want=${(-600 * k).toFixed(4)} locked=${locked()}`; });
  await step('18_jump_logged', async () => {
    const b0 = notes('mouse-jump').length;
    const v = await yawAfter(() => pm(900));
    await frames(2);
    const l = notes('mouse-jump').slice(b0);
    return `beacons=${l.length} line=${l[0]} dYaw=${v.toFixed(3)} console=${consoleLines.filter((s) => s === `[gnome] ${l[0]}`).length}`;
  });
  await step('19_normal_moves', async () => {
    const b0 = notes('mouse-jump').length;
    const v = await yawAfter(() => { for (let i = 0; i < 20; i++) { pm(40); mm(40); } });
    await frames(2);
    return `dYaw=${v.toFixed(4)} want=${(-800 * k).toFixed(4)} beacons=${notes('mouse-jump').length - b0}`;
  });
  await step('20_cdp_look', async () => {
    await mouseTo(100, 180); await frames(2); const y0 = g.player.yaw; // the first move jumps from the last click spot
    for (let x = 120; x <= 300; x += 20) { await mouseTo(x, 180); await frames(1); }
    await frames(3);
    return `dYaw=${(g.player.yaw - y0).toFixed(3)} locked=${locked()}`;
  });
  await step('16_lock_fallback', async () => {
    await gap(); await esc(); await settle(); // locked → pause menu
    g.input.raw = true; rejectRaw = true; const c0 = calls.length;
    await gap(); await clickEl('.menu [data-a="play"]'); await settle(600);
    const first = `locked=${locked()} hintHidden=${!vis('.click-to-play')} rawAfter=${g.input.raw}`;
    await gap(); await esc(); await settle();
    await gap(); await clickEl('.menu [data-a="play"]'); await settle(600);
    return `calls=[${calls.slice(c0).map((a) => JSON.stringify(a) ?? 'undefined').join(',')}] ${first} lockedAgain=${locked()}`;
  });
  await step('21_free_cursor', async () => {
    await gap(); await esc(); await settle(); // pause
    await gap(); refuseN = 1; await esc(); await settle(); // running with a free cursor
    const state = `paused=${g.paused} locked=${locked()}`;
    const b0 = notes('mouse-jump').length;
    await frames(2);
    const y0 = g.player.yaw;
    document.documentElement.dispatchEvent(new MouseEvent('mouseenter'));
    pm(900); mm(900);
    await frames(3);
    const d900 = g.player.yaw - y0;
    const y1 = g.player.yaw;
    mm(40); await frames(3);
    const l = notes('mouse-jump').slice(b0).map((s) => JSON.parse(s.slice(11)));
    return `beacon.locked=${l[0]?.locked} beacon.skip=${l[0]?.skip} dYaw900=${d900.toFixed(3)} dYaw40=${(g.player.yaw - y1).toFixed(4)} want=${(-40 * k).toFixed(4)} (${state})`;
  });
  await step('23_slow_frame', async () => {
    teleport(0, 4, 0); await frames(3);
    for (let i = 0; i < 7; i++) { await new Promise((r) => requestAnimationFrame(() => { const t = performance.now(); while (performance.now() - t < 150); r(); })); await frames(2); }
    for (let i = 0; i < 6; i++) { pm(900); await frames(1); }
    await frames(3);
    const js = notes('mouse-jump').map((s) => JSON.parse(s.slice(11)));
    const real = js.filter((j) => j.locked && !j.skip).length;
    return `beacons=${notes('slow-frame').length} maxSlow<=5:${notes('slow-frame').length <= 5} maxJump<=5:${real <= 5} lockedJumps=${real} otherJumps=${js.length - real} line=${notes('slow-frame')[0]}`;
  });
  // raw lock refused 300 ms after the request: A without Esc (hint per frame), B with Esc before the refusal
  await step('31_esc_during_raw_reject', async () => {
    await gap(); await esc(); await settle(); // free cursor → pause
    let hint = 0; let sampling = true;
    const sample = () => { if (!sampling) return; if (vis('.click-to-play')) hint++; requestAnimationFrame(sample); };
    g.input.raw = true; rejectRawMs = 300;
    await gap(); requestAnimationFrame(sample);
    await clickEl('.menu [data-a="play"]'); await settle(900);
    const a = { locked: locked(), hint };
    await gap(); await esc(); await settle(); // locked → pause
    g.input.raw = true; hint = 0; rejectRawMs = 600;
    await gap();
    let escAt = null;
    const onEsc = (e) => { if (e.code === 'Escape' && escAt === null) escAt = performance.now() - rawAskAt; };
    window.addEventListener('keydown', onEsc, true);
    await clickEl('.menu [data-a="play"]'); await esc();
    window.removeEventListener('keydown', onEsc, true);
    await settle(1200);
    sampling = false;
    const b = { paused: g.paused, locked: locked(), hint };
    const ok = a.locked && a.hint === 0 && b.paused && !b.locked && b.hint === 0 && escAt !== null && escAt < 600;
    return `${ok ? 'PASS' : 'FAIL'} A.locked=${a.locked} A.hintFrames=${a.hint} B.escAfterRequestMs=${escAt?.toFixed(0)} B.paused=${b.paused} B.locked=${b.locked} B.hintFrames=${b.hint}`;
  });
  // fresh jump counts: 5 skip jumps while locked use their own budget, so the real locked jump after them is logged
  await step('32_jump_cap_locked', async () => {
    if (!locked()) { await gap(); if (vis('.menu')) await clickEl('.menu [data-a="play"]'); else await clickAt(320, 180); await settle(600); }
    g.input.jumpCount = 0; g.input.freeJumpCount = 0;
    const b0 = notes('mouse-jump').length;
    g.input.skipMove = true;
    for (let i = 0; i < 5; i++) pm(900);
    await frames(2);
    g.input.skipMove = false;
    pm(900);
    await frames(3);
    const l = notes('mouse-jump').slice(b0).map((s) => JSON.parse(s.slice(11)));
    const real = l.filter((j) => j.locked && !j.skip).length;
    const ok = locked() && real === 1;
    return `${ok ? 'PASS' : 'FAIL'} locked=${locked()} lines=${l.length} skipLines=${l.filter((j) => j.skip).length} realLocked=${real}`;
  });
  window.__done = '\n' + out.join('\n') + '\nsens=' + sens() + ' beacons=' + beacons.length;
})();
