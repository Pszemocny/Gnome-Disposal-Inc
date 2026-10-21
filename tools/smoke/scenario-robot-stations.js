// Robot area ring after a move (plan 2026-10-24-plan-robot-stations.md, steps 1-2, rows A0-A4).
// Run: FAKELOCK=1 DPR=1 DEV_PORT=5199 CDP_PORT=9431 MAXPOLL=1200 node tools/smoke/smoke.mjs rs-out tools/smoke/scenario-robot-stations.js
// One RESULT JSON with A0-A4 plus `checks` (PASS/FAIL). Placement goes through the real G/X keys and LMB (CDP),
// so the post lands where updatePlacement puts it, not where a test call would.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const kd = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk } });
const ku = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk } });
const key = async (k, code, vk) => { await cdp(kd(k, code, vk), ku(k, code, vk)); await frames(3); };
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
const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// world teleport; forward is (-sin yaw, -cos yaw), pitch in radians (negative = down)
const teleport = async (x, z, yaw, pitch = 0) => {
  g.player.body.setTranslation({ x, y: 1, z }, true); g.player.position.set(x, 1, z); g.player.yaw = yaw; g.player.pitch = pitch;
  await frames(4);
  g.player.yaw = yaw; g.player.pitch = pitch;
  await frames(2);
};
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const robot = () => g.machines.list.find((m) => m.type === 'robot');
// area-ring markers in the scene: groups holding the teal ring
const markers = () => g.scene.children.filter((o) => o.children?.some((c) => c.geometry?.type === 'RingGeometry' && c.material?.color?.getHex?.() === 0x2fa8b8));
// pixels that change when `objs` are hidden, rendered from the player's camera (same task, so the buffer is still readable)
const changedPixels = (objs) => {
  const r = g.renderer; const gl = r.getContext(); const w = gl.drawingBufferWidth; const h = gl.drawingBufferHeight;
  const read = () => { r.render(g.scene, g.camera); const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const a = read();
  const vis = objs.map((o) => o.visible); objs.forEach((o) => { o.visible = false; });
  const b = read();
  objs.forEach((o, i) => { o.visible = vis[i]; });
  let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++;
  return n;
};
// look at the truck from 2 m in front and press a key (G or X); the player ends up looking at the machine
const aimAtTruck = async (m) => {
  const t = m.body.translation();
  await teleport(t.x, t.z + 2.2, yawTo(0, -2.2), -0.45);
  return g.player.lookAt.machine === m;
};
// stand `back` m in front of `target` (towards +z) looking at it with `pitch`, then LMB
const placeAt = async (tx, tz, back, pitch) => {
  await teleport(tx, tz + back, yawTo(0, -back), pitch);
  await frames(3);
  const ghostY = g.player.ghostPos?.y ?? null;
  const blocked = g.player.ghostBlocked;
  await click();
  return { ghostY: ghostY === null ? null : r2(ghostY), blocked };
};
// ring probes from a spot `dist` m from the post looking down 35 degrees at it
const ringProbe = async (m, dist = 9) => {
  const p = m.pos;
  await teleport(p.x, p.z + dist, yawTo(0, -dist), -0.61);
  await frames(3);
  const ring = m.robot.areaRing;
  const wp = ring.getWorldPosition(new g.camera.position.constructor());
  g.camera.updateMatrixWorld();
  const M = new g.camera.projectionMatrix.constructor().multiplyMatrices(g.camera.projectionMatrix, g.camera.matrixWorldInverse);
  // the game's own three instance (the URL carries Vite's version query)
  const url = (await (await fetch('/src/entities/robots.ts')).text()).match(/from "([^"]*three\.js[^"]*)"/)[1];
  const { Frustum } = await import(url);
  return {
    markerInScene: m.marker.parent === g.scene,
    ringScale: r2(ring.scale.x),
    ringWorldDist: r2(wp.distanceTo(p.clone().setY(p.y + 0.04))),
    ringWorldY: r2(wp.y),
    inFrustum: new Frustum().setFromProjectionMatrix(M).intersectsObject(ring),
    ringPixels: changedPixels([ring]),
  };
};

setTimeout(() => { if (!window.__done) window.__done = J({ ...R, checks, timeout: true }); }, 280000);
(async () => {
  try {
    g.state.seenIntro = true;
    await clickEl('.menu [data-a="play"]');
    await sleep(800); await frames(5);
    g.state.factoryAuto = false;
    // the screenshots show the yard, not the controls card
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '.hud-helpbox{display:none!important}' }));
    g.moods.update = () => {}; g.contracts.update = () => {}; g.events.spawnVisitor = () => {}; g.events.next = 1e9;
    for (const x of [...g.gnomes.list]) g.gnomes.remove(x);
    g.machines.clearAll();
    // one robot owned: a placement ends the ghost, as for a player with one robot
    g.state.upgrades.robot = 1;
    const V3 = g.camera.position.constructor;
    const Q = () => g.camera.quaternion.clone().set(0, 0, 0, 1);
    R.locked = g.input.locked;

    // ---- A0: robot on the grass, G on the truck, LMB 10 m away with a level aim (pitch 0 and -5 deg)
    {
      const A0 = {};
      for (const [name, pitch] of [['pitch0', 0], ['pitch5', -5 * Math.PI / 180]]) {
        g.machines.clearAll(); await frames(2);
        const m0 = g.machines.place('robot', new V3(10, 0, -16), Q());
        await frames(20);
        const looked = await aimAtTruck(m0);
        await key('g', 'KeyG', 71);
        const placing = g.player.placing;
        // target 8-12 m away: the player stands 10 m behind (+z) a point 8 m from the old post, ghostDist 7 does not reach the ground
        const res = await placeAt(10, -8, 10, pitch);
        await frames(10);
        const m = robot();
        A0[name] = { looked, placing, ...res, posY: m ? r2(m.pos.y) : null, moved: m ? r2(hd(m.pos, { x: 10, z: -16 })) : null };
        if (m) {
          const pr = await ringProbe(m);
          Object.assign(A0[name], { ringWorldY: pr.ringWorldY, ringPixels: pr.ringPixels });
          await shot(`rs-A0-${name}`);
        }
      }
      A0.ringOnGrass = A0.pitch0?.ringWorldY < 0.1 && A0.pitch5?.ringWorldY < 0.1;
      R.A0 = A0;
    }
    // ---- A1: G on the truck, place 8 m away aiming down
    {
      g.machines.clearAll(); await frames(2);
      const m0 = g.machines.place('robot', new V3(10, 0, -16), Q());
      await frames(20);
      const old = m0.pos.clone();
      const looked = await aimAtTruck(m0);
      await key('g', 'KeyG', 71);
      // pitch -0.35: the placement ray hits the ground about 4.5 m ahead, 8 m from the old post
      const res = await placeAt(10, -8, 4.5, -0.35);
      await frames(10);
      const m = robot();
      const pr = await ringProbe(m);
      await shot('rs-A1-new-post');
      // the old post: no marker within 1 m of it, and nothing drawn there that a marker would add
      const oldMarkers = markers().filter((o) => hd(o.position, old) < 1);
      await teleport(old.x, old.z + 9, 0, -0.61);
      R.A1 = { looked, ...res, posY: r2(m.pos.y), moved: r2(hd(m.pos, old)), ...pr, oldPostMarkers: oldMarkers.length, oldPostPixels: changedPixels(oldMarkers) };
    }
    // ---- A2: X, then place from the tool wheel / hotbar
    {
      const m0 = robot();
      const looked = await aimAtTruck(m0);
      await key('x', 'KeyX', 88);
      const afterX = { markers: markers().length, robots: g.machines.placedCount('robot') };
      g.player.selectTool('robot');
      const res = await placeAt(10, -16, 4.5, -0.35);
      await frames(10);
      const m = robot();
      const pr = m ? await ringProbe(m) : {};
      R.A2 = { looked, afterX, afterPlace: { markers: markers().length, ...res, posY: m ? r2(m.pos.y) : null, ringPixels: pr.ringPixels } };
    }
    // ---- A3: a save with 2 robots (serialize -> restore) and a blueprint with 2 robots
    {
      g.machines.clearAll(); await frames(2);
      g.state.upgrades.robot = 2;
      g.machines.place('robot', new V3(10, 0, -16), Q());
      g.machines.place('robot', new V3(16, 0, -16), Q());
      await frames(5);
      const saved = g.machines.serialize();
      g.machines.clearAll(); await frames(2);
      g.machines.restore(saved);
      await frames(5);
      const reloadMarkers = markers().length;
      const h = g.env.hole;
      g.blueprints.slots[0] = { at: Date.now(), items: saved.map((p) => ({ ...p, x: p.x - h.x, y: p.y - h.y, z: p.z - h.z })) };
      g.blueprints.load(0);
      g.blueprints.slots[0] = null;
      await frames(20);
      R.A3 = { reloadMarkers, blueprintMarkers: markers().length, robots: g.machines.placedCount('robot') };
    }
    // ---- A4: post inside the next hole radius, level-up: the post steps out and the ring follows
    {
      g.machines.clearAll(); await frames(2);
      const Env = g.env.constructor;
      const { holeLevel } = await import('/src/data/holeLevels.ts');
      const lv = g.state.holeLevel;
      const r0 = g.env.holeRadius;
      const r1 = holeLevel(lv + 1).radius;
      const c1 = Env.holeCenterFor(lv + 1);
      const c0 = g.env.hole;
      // away from the factory: the side of the hole facing +x
      const d = Math.max(r1 - 1, r0 + 0.4);
      const m = g.machines.place('robot', new V3(c1.x + d, 0, c1.z), Q());
      const startInsideOld = hd(m.pos, c0) < r0;
      await frames(10);
      g.hole.levelUp();
      await frames(10);
      const keep = g.env.holeRadius + 1.0 + 0.6;
      R.A4 = { level: lv + 1, r0: r2(r0), r1: r2(g.env.holeRadius), startDist: r2(d), startInsideOld, postDist: r2(hd(m.pos, g.env.hole)), keep: r2(keep), postMoved: hd(m.pos, g.env.hole) > d + 0.1, markerAtHome: hd(m.marker.position, m.pos) < 0.01 && Math.abs(m.marker.position.y - m.pos.y) < 0.01, posY: r2(m.pos.y) };
    }
  } catch (e) {
    R.error = String((e && e.stack) || e).slice(0, 500);
  }
  const A0 = R.A0 || {};
  ok('A0', A0.pitch0?.posY < 0.05 && A0.pitch5?.posY < 0.05 && A0.ringOnGrass === true && A0.pitch0?.moved > 7, J(A0));
  const A1 = R.A1 || {};
  ok('A1', A1.markerInScene && A1.ringScale === 6 && A1.ringWorldDist < 0.05 && A1.inFrustum && A1.ringPixels >= 40 && A1.oldPostPixels === 0 && A1.oldPostMarkers === 0, J(A1));
  const A2 = R.A2 || {};
  ok('A2', A2.afterX?.markers === 0 && A2.afterPlace?.markers === 1 && A2.afterPlace?.ringPixels >= 40, J(A2));
  ok('A3', R.A3?.reloadMarkers === 2 && R.A3?.blueprintMarkers === 2, J(R.A3));
  ok('A4', R.A4?.postMoved && R.A4?.markerAtHome && Math.abs(R.A4?.postDist - R.A4?.keep) < 0.05, J(R.A4));
  window.__done = J({ locked: R.locked, error: R.error, checks });
})();
