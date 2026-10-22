// Robot stations (plan 2026-10-24-plan-robot-stations.md, rows A0-A7, B1-B4, C1-C7, D1-D4, E1-E5, F1, F3).
// Run: URL_QUERY='' FAKELOCK=1 MAXPOLL=2400 CDP_PORT=9385 DEV_PORT=5185 node tools/smoke/smoke.mjs rs-out tools/smoke/scenario-robot-stations.js
// One RESULT JSON with `checks` (PASS/FAIL). Placement, G, X, E and Z go through real keys and LMB (CDP), so the
// station lands where updatePlacement puts it, not where a test call would.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const kd = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk } });
const ku = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk } });
const key = async (k, code, vk) => { await cdp(kd(k, code, vk), ku(k, code, vk)); await frames(3); };
const KEYS = { g: ['g', 'KeyG', 71], x: ['x', 'KeyX', 88], e: ['e', 'KeyE', 69], z: ['z', 'KeyZ', 90], q: ['q', 'KeyQ', 81] };
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
const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hex = (c) => c.getHexString();
const KEY = 'gnome-boozed-save-v1';
// world teleport; forward is (-sin yaw, -cos yaw), pitch in radians (negative = down)
const teleport = async (x, z, yaw, pitch = 0) => {
  g.player.body.setTranslation({ x, y: 1, z }, true); g.player.position.set(x, 1, z); g.player.yaw = yaw; g.player.pitch = pitch;
  await frames(4);
  g.player.yaw = yaw; g.player.pitch = pitch;
  await frames(2);
};
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const robot = () => g.machines.list.find((m) => m.type === 'robot');
const robots = () => g.machines.list.filter((m) => m.type === 'robot');
// area-ring markers in the scene: groups holding the teal ring
const markers = () => g.scene.children.filter((o) => o.children?.some((c) => c.geometry?.type === 'RingGeometry' && c.material?.color?.getHex?.() === 0x2fa8b8));
const stations = () => markers().filter((o) => o.getObjectByName('station'));
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
// stand `dist` m from `p` along (dx, dz) and look at it (eye height read after the teleport)
const aimAt = async (p, dx, dz, dist) => {
  const l = Math.hypot(dx, dz);
  const sx = p.x + (dx / l) * dist; const sz = p.z + (dz / l) * dist;
  await teleport(sx, sz, yawTo(-dx, -dz), 0);
  const eye = g.player.eye.y;
  await teleport(sx, sz, yawTo(-dx, -dz), -Math.atan2(eye - p.y, dist));
  await frames(2);
};
// look at the truck from 2 m in front and press a key (G or X); the player ends up looking at the machine
const aimAtTruck = async (m) => {
  const t = m.body.translation();
  await teleport(t.x, t.z + 2.2, yawTo(0, -2.2), -0.45);
  return g.player.lookAt.machine === m;
};
// the pole at its fuse box height, aimed at from behind the station (the truck stands in front of it)
const aimAtPole = async (m) => {
  const p = polePoint(m, 1.0);
  const back = m.marker.localToWorld(new V3(0, 0, -3.2));
  await aimAt(p, back.x - p.x, back.z - p.z, 2.0);
  return g.player.lookAt.machine === m;
};
// the pad beside the truck (local x 0.75), aimed at from the side
const aimAtPad = async (m) => {
  const p = m.marker.localToWorld(new V3(0.75, 0.3, 0.4));
  const side = m.marker.localToWorld(new V3(3, 0, 0.4));
  await aimAt(p, side.x - p.x, side.z - p.z, 2.2);
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
// ghost blocked state when the crosshair hits the ground at (tx, tz), player 4.5 m towards +z (side -1: towards -z)
const ghostAt = async (tx, tz, quat, side = 1) => {
  const eye = 1.65;
  await teleport(tx, tz + side * 4.5, yawTo(0, -side * 4.5), -Math.atan2(eye, 4.5));
  if (quat) g.player.ghostQuat.copy(quat);
  await frames(4);
  return { blocked: g.player.ghostBlocked, at: [r2(g.player.ghostPos.x), r2(g.player.ghostPos.z)] };
};
// ring probes from a spot `dist` m from the post looking down 35 degrees at it
const ringProbe = async (m, dist = 9) => {
  const p = m.pos;
  await teleport(p.x, p.z + dist, yawTo(0, -dist), -0.61);
  await frames(3);
  const ring = m.robot.areaRing;
  const wp = ring.getWorldPosition(new V3());
  g.camera.updateMatrixWorld();
  const M = new g.camera.projectionMatrix.constructor().multiplyMatrices(g.camera.projectionMatrix, g.camera.matrixWorldInverse);
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
let V3; let Qt;
const polePoint = (m, y = 0.75) => m.marker.localToWorld(new V3(0, y, -1.2));
const qy = (a) => new Qt().setFromAxisAngle(new V3(0, 1, 0), a);
const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); };
const reset = async () => { if (g.shop.isOpen) { R.shopWasOpen = (R.shopWasOpen ?? 0) + 1; g.shop.close(); } g.player.cancelPlacement(); clearGnomes(); g.machines.clearAll(); await frames(3); };
// more than 3.2 m from the shop desk (7.5, -13) from every aim spot: E there opens the shop instead of repairing
const P0 = { x: 16, z: -16 };
const placeRobot = (x = P0.x, z = P0.z, yaw = 0) => g.machines.place('robot', new V3(x, 0, z), qy(yaw));
const walk = async (code, sec) => { g.input.keys.add(code); await sleep(sec * 1000); g.input.keys.delete(code); await frames(2); };
const prompt = () => document.querySelector('.hud-prompt')?.innerText ?? '';
const stash = (m, n) => { const out = []; for (let i = 0; i < n; i++) { const x = g.gnomes.spawn('classic', new V3(m.pos.x + 20, 0.5, m.pos.z + i), { tier: 'normal' }); g.gnomes.stash(x); m.queue.push(x); out.push(x); } return out; };
const bursts = []; const puffs = [];

setTimeout(() => { if (!window.__done) window.__done = J({ ...R, checks, timeout: true }); }, 590000);
(async () => {
  try {
    g.state.seenIntro = true;
    await clickEl('.menu [data-a="play"]');
    await sleep(800); await frames(5);
    g.state.factoryAuto = false;
    // props are solid for the placement ghost: the letter G lies at (15, -15), 1.4 m from P0, and the chair is random;
    // they wait far from the test spots (their home too, so a letter does not walk back)
    g.props.list.forEach((p, i) => { if (p.kind === 'flamingo') return; p.home.set(-15 + i * 1.5, 0.6, 15); p.body.setTranslation(p.home, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); });
    g.props.savePoses();
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '.hud-helpbox{display:none!important}' }));
    g.moods.update = () => {}; g.contracts.update = () => {}; g.events.spawnVisitor = () => {}; g.events.next = 1e9;
    clearGnomes();
    g.machines.clearAll();
    g.state.upgrades.robot = 1;
    V3 = g.camera.position.constructor;
    Qt = g.camera.quaternion.constructor;
    R.locked = g.input.locked;
    const ob = g.fx.burst.bind(g.fx); g.fx.burst = (p, c, n) => { bursts.push({ p: p.clone(), c }); return ob(p, c, n); };
    const op = g.fx.puff.bind(g.fx); g.fx.puff = (p, c) => { puffs.push({ p: p.clone(), c }); return op(p, c); };

    // ---- A0: robot on the grass, G on the truck, LMB 10 m away with a level aim (pitch 0 and -5 deg)
    {
      const A0 = {};
      for (const [name, pitch] of [['pitch0', 0], ['pitch5', -5 * Math.PI / 180]]) {
        await reset();
        const m0 = placeRobot(10, -16);
        await frames(20);
        const looked = await aimAtTruck(m0);
        await press('g');
        const placing = g.player.placing;
        const res = await placeAt(10, -8, 10, pitch);
        await frames(10);
        const m = robot();
        A0[name] = { looked, placing, ...res, posY: m ? r2(m.pos.y) : null, moved: m ? r2(hd(m.pos, { x: 10, z: -16 })) : null };
        if (m) {
          const pr = await ringProbe(m);
          Object.assign(A0[name], { ringWorldY: pr.ringWorldY, ringPixels: pr.ringPixels });
          if (name === 'pitch0') await shot('rs-A0-ring-after-move');
        }
      }
      A0.ringOnGrass = A0.pitch0?.ringWorldY < 0.1 && A0.pitch5?.ringWorldY < 0.1;
      R.A0 = A0;
    }
    // ---- A1: G on the truck, place 8 m away aiming down
    {
      await reset();
      const m0 = placeRobot(10, -16);
      await frames(20);
      const old = m0.pos.clone();
      const looked = await aimAtTruck(m0);
      await press('g');
      const res = await placeAt(10, -8, 4.5, -0.35);
      await frames(10);
      const m = robot();
      const pr = await ringProbe(m);
      const oldMarkers = markers().filter((o) => hd(o.position, old) < 1);
      await teleport(old.x, old.z + 9, 0, -0.61);
      R.A1 = { looked, ...res, posY: r2(m.pos.y), moved: r2(hd(m.pos, old)), ...pr, oldPostMarkers: oldMarkers.length, oldPostPixels: changedPixels(oldMarkers) };
    }
    // ---- A2: X, then place from the tool wheel / hotbar
    {
      const m0 = robot();
      const looked = await aimAtTruck(m0);
      await press('x');
      const afterX = { markers: markers().length, robots: g.machines.placedCount('robot') };
      g.player.selectTool('robot');
      const res = await placeAt(10, -16, 4.5, -0.35);
      await frames(10);
      const m = robot();
      const pr = m ? await ringProbe(m) : {};
      R.A2 = { looked, afterX, afterPlace: { markers: markers().length, ...res, posY: m ? r2(m.pos.y) : null, ringPixels: pr.ringPixels } };
    }
    // ---- A3 / E2: a save with 2 robots (serialize -> restore) and a blueprint with 2 robots
    {
      await reset();
      g.state.upgrades.robot = 2;
      placeRobot(10, -16);
      placeRobot(16, -16);
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
      await frames(30);
      R.A3 = { reloadMarkers, blueprintMarkers: markers().length, robots: g.machines.placedCount('robot') };
      R.E2 = { blueprintRobots: g.machines.placedCount('robot'), stations: stations().length, stationBodies: robots().filter((m) => m.station && g.physics.bodies.contains(m.station.handle)).length };
    }
    // ---- A4 / A5 / A6 / E4: post inside the next hole radius, level-up: the station steps out
    {
      const Env = g.env.constructor;
      const { holeLevel } = await import('/src/data/holeLevels.ts');
      const { landFor } = await import('/src/data/land.ts');
      // a level-up without a land change: each case starts on the Garden at level 3 (3 -> 4 stays on the Garden)
      const stepCase = async (broken, poleToHole) => {
        await reset();
        g.state.upgrades.robot = 1;
        const lv = 3;
        g.state.holeLevel = lv;
        const newLand = g.state.land !== landFor(lv);
        g.state.land = landFor(lv);
        g.env.rebuildHole();
        if (newLand) g.env.rebuildLand();
        const r0 = g.env.holeRadius;
        const r1 = holeLevel(lv + 1).radius;
        const c1 = Env.holeCenterFor(lv + 1, landFor(lv + 1));
        const d = Math.max(r1 - 1, r0 + 0.4);
        // the side of the hole facing +x; yaw PI/2: local +z = world +x, so the pole (local -z) points at the hole
        const m = placeRobot(c1.x + d, c1.z, poleToHole ? Math.PI / 2 : 0);
        await frames(10);
        if (broken) m.broken = 30;
        const posBefore = m.pos.clone();
        g.hole.levelUp();
        await frames(2);
        const moved2 = hd(m.pos, posBefore) > 0.1;
        await frames(8);
        const st = m.station.translation();
        const pole = polePoint(m, 0);
        const out = {
          level: g.state.holeLevel, r1: r2(g.env.holeRadius), startDist: r2(d), postDist: r2(hd(m.pos, g.env.hole)), keep: r2(g.env.holeRadius + 2.9),
          postMoved: hd(m.pos, g.env.hole) > d + 0.1, postMovedSameFrame: moved2,
          markerAtHome: hd(m.marker.position, m.pos) < 0.01 && Math.abs(m.marker.position.y - m.pos.y) < 0.01,
          stationBodyDistToHome: r2(hd(st, m.pos)), stationAtHome: hd(st, m.pos) < 0.01,
          poleDistFromCentre: r2(hd(pole, g.env.hole)), poleTowardsHole: hd(pole, g.env.hole) < hd(m.pos, g.env.hole) - 1, brokenAtLevelUp: m.broken > 0,
        };
        return out;
      };
      R.A4 = await stepCase(false, false);
      R.A5 = await stepCase(true, false);
      R.A6 = await stepCase(false, true);
      // A7: the player stands where a step-out puts the pole, the post steps out of the hole, then the player walks
      // 1 s one way (a fresh step-out per direction: once clear, the pole lands and a teleport back would be inside it)
      {
        const res = {}; const heldBack = {}; const followed = {};
        for (const [dir, code] of [['w', 'KeyW'], ['s', 'KeyS'], ['a', 'KeyA'], ['d', 'KeyD']]) {
          await reset();
          const m = placeRobot();
          await frames(10);
          // broken: the truck stays at P0 and does not drive at the player
          m.broken = 1e9;
          const h = g.env.hole; const keep = g.env.holeRadius + 2.9;
          // yaw 0: the pole stands 1.2 m towards -z of the post the step-out picks on the +x side of the hole
          const p = { x: h.x + keep, z: h.z - 1.2 };
          // no key left down and no knock-back left over: the player must stand on the pole spot, inside the 0.8 m guard
          g.input.keys.clear(); g.player.knock.set(0, 0, 0);
          await teleport(p.x, p.z, 0, 0);
          m.pos.set(h.x + g.env.holeRadius + 1, m.pos.y, h.z);
          await frames(3);
          const held = { bodyToPost: r2(hd(m.station.translation(), m.pos)), poleErr: r2(hd(polePoint(m, 0), p)), playerToPole: r2(hd(g.player.position, p)) };
          heldBack[dir] = held.bodyToPost > 0.1 && held.poleErr < 0.05 ? true : held;
          const a = g.player.position.clone();
          await walk(code, 1);
          res[dir] = r2(hd(g.player.position, a));
          // clearly beyond the 0.8 m guard before "followed" is read (2 m from the pole, towards +x)
          if (hd(g.player.position, p) < 1.2) await teleport(p.x + 2, p.z, 0, 0);
          await frames(3);
          followed[dir] = hd(m.station.translation(), m.pos) < 0.01;
        }
        R.A7 = { moved: res, heldBack, followed, playerFreed: Object.values(res).every((v) => v >= 0.5) };
      }
    }
    // ---- B1: station on the marker, rotated with the placement, truck parks at the post
    {
      await reset();
      const yaw = 0.7;
      const m = placeRobot(P0.x, P0.z, yaw);
      await sleep(3000);
      const pole = polePoint(m, 0.75);
      const exp = { x: m.pos.x - Math.sin(yaw) * 1.2, z: m.pos.z - Math.cos(yaw) * 1.2 };
      R.B1 = {
        stationChildOfMarker: m.marker.getObjectByName('station')?.parent === m.marker, onTruck: !!m.root.getObjectByName('station'),
        markerYaw: r2(m.marker.rotation.y), placementYaw: yaw, poleErr: r2(hd(pole, exp)), truckDistToPost: r2(hd(m.body.translation(), m.pos)),
      };
      await aimAtPole(m);
      await teleport(m.pos.x + 4, m.pos.z + 4, yawTo(-4, -4), -0.35);
      await shot('rs-B1-station');
    }
    // ---- B2: robot ghost: pole would stand in a fan -> red; open grass -> green; ghost shows the station, lamp hidden
    {
      await reset();
      g.state.upgrades.fan = 1;
      g.player.selectTool('robot');
      const ghost = g.player.ghost;
      // ghostQuat = player yaw: the ghost's +z faces the player, so its pole stands 1.2 m beyond the aim point
      const yaw = yawTo(0, -4.5);
      const open = await ghostAt(P0.x, P0.z, qy(yaw));
      g.player.cancelPlacement();
      g.machines.place('fan', new V3(P0.x, 0, P0.z - 1.25), qy(0));
      await frames(3);
      g.player.selectTool('robot');
      const inFan = await ghostAt(P0.x, P0.z, qy(yaw));
      R.B2 = { blockedPoleInFan: inFan.blocked, blockedOpen: open.blocked, inFan, open, ghostHasStation: !!ghost.getObjectByName('station'), ghostLampHidden: ghost.getObjectByName('lamp')?.visible === false };
      g.player.cancelPlacement();
    }
    // ---- B3 / B3b: fan ghost over the pole and over the pad red; Wide Belt sends a belt flush with the pad back
    {
      await reset();
      g.state.upgrades.fan = 1;
      const m = placeRobot();
      await frames(10);
      g.player.selectTool('fan');
      // fan turned 90 deg: its 0.4 m half depth lies along x, clear of the truck
      // over the pole: aimed from behind the station (from the front the truck catches the ray)
      const overPole = await ghostAt(P0.x + 0.3, P0.z - 1.25, qy(Math.PI / 2), -1);
      const overPad = await ghostAt(P0.x + 0.8, P0.z + 0.5, qy(Math.PI / 2));
      const beside = await ghostAt(P0.x + 1.9, P0.z + 0.5, qy(Math.PI / 2));
      g.player.cancelPlacement();
      R.B3 = { fanOverPole: overPole.blocked, fanOverPad: overPad.blocked, besidePad: beside.blocked, overPole, overPad, beside };
      g.state.upgrades.conveyor = 1;
      const bw = g.state.upgrades.beltWidth;
      g.state.upgrades.beltWidth = 0;
      // belt box half width 0.75 at Wide Belt 0: its edge at the pad edge (x + 1.0)
      g.machines.place('conveyor', new V3(m.pos.x + 1.76, 0, m.pos.z), qy(0));
      await frames(3);
      g.state.upgrades.beltWidth = 1;
      const back = g.machines.rebuild('conveyor');
      R.B3b = { beltBackAfterWideBelt: back, beltsLeft: g.machines.placedCount('conveyor'), via: 'shop.ts says "Wide Belt: N belt(s) had no room" when rebuild returns N' };
      g.state.upgrades.beltWidth = bw ?? 0;
      delete g.state.upgrades.conveyor;
    }
    // ---- B4: player stops at the pole, walks over the pad; truck and gnome pass through the pole
    {
      await reset();
      const m = placeRobot();
      await frames(10);
      const pole = polePoint(m, 0);
      // from 1.5 m behind the pole, walk towards it (+z) for 1 s
      await teleport(pole.x, pole.z - 1.5, yawTo(0, 1), 0);
      const z0 = g.player.position.z;
      await walk('KeyW', 1);
      const z1 = g.player.position.z;
      // along x = pad edge - 0.1 (clear of the truck), from in front of the pad to behind it
      await teleport(m.pos.x + 0.9, m.pos.z + 2.2, yawTo(0, -1), 0);
      await walk('KeyW', 1.2);
      const crossedZ = g.player.position.z;
      // truck put 3 m behind the pole, drives home through it
      m.robot.scan = 1e9;
      m.body.setTranslation({ x: pole.x, y: 0.4, z: pole.z - 3 }, true);
      g.machines.savePoses();
      m.robot.state = 'return';
      await teleport(m.pos.x + 8, m.pos.z + 8, 0, 0);
      await sleep(4000);
      const truckD = hd(m.body.translation(), m.pos);
      // a ragdoll gnome thrown through the pole (about 1 m high when it reaches it; on the grass friction would stop it first)
      const gn = g.gnomes.spawn('classic', new V3(pole.x, 0.6, pole.z - 1.2), { tier: 'normal' });
      g.gnomes.ragdoll(gn, 3, 'machine');
      gn.body.setLinvel({ x: 0, y: 4, z: 5 }, true);
      await sleep(700);
      const gz = gn.body.translation().z;
      R.B4 = { walkAdvance: r2(z1 - z0), playerStoppedAtPole: z1 < pole.z - 0.16, playerCrossedPad: crossedZ < m.pos.z - 1.3, crossedZ: r2(crossedZ - m.pos.z), truckReachedHome: truckD < 0.6, truckD: r2(truckD), gnomeCrossedPole: gz > pole.z + 0.3, gnomeDz: r2(gz - pole.z) };
    }
    // ---- C1: Robot Fuses L2: 2 fuses + 1 box at the pole, none on the truck; totals as a fan with L2 + 2
    {
      await reset();
      g.state.upgrades.robotFuses = 2;
      const m = placeRobot();
      await frames(10);
      const M4 = new g.camera.matrixWorld.constructor();
      const at = (im, i) => { im.getMatrixAt(i, M4); return new V3().setFromMatrixPosition(M4); };
      const box = at(g.machines.boxMesh, 0);
      const fuses = Array.from({ length: g.machines.fuseMesh.count }, (_, i) => at(g.machines.fuseMesh, i));
      const t = m.body.translation();
      const robotOnly = g.machines.fuseMesh.count;
      g.state.upgrades.fan = 1; g.state.upgrades.fanFuses = 2;
      g.machines.place('fan', new V3(20, 0, -16), qy(0));
      await frames(3);
      R.C1 = {
        fusesAtStation: fuses.filter((p) => p.distanceTo(box) < 0.3).length, fusesOnTruck: fuses.filter((p) => p.distanceTo(new V3(t.x, t.y + 0.4, t.z)) < 0.8).length,
        boxDistToPole: r2(box.distanceTo(polePoint(m, 1.0))), robotOnly, withFan: g.machines.fuseMesh.count, boxes: g.machines.boxMesh.count,
      };
      delete g.state.upgrades.fan; delete g.state.upgrades.fanFuses;
    }
    // ---- C2: saboteur on the pad blows a fuse, burst at the station box; C7 lamp colours
    {
      await reset();
      g.state.upgrades.robotFuses = 2;
      const m = placeRobot();
      await frames(10);
      const lamp = () => hex(m.robot.lamp.material.color);
      const fine = lamp();
      m.robot.scan = 1e9; // the truck must not scoop the saboteur
      bursts.length = 0;
      const s = g.gnomes.spawn('saboteur', new V3(m.pos.x + 0.6, 0.5, m.pos.z + 0.9), { tier: 'normal', awake: true });
      let i = 0; for (; i < 60 && m.blown === 0; i++) { if (s) s.cooldown = 0; await sleep(100); }
      await frames(3);
      const red = bursts.find((b) => b.c === 0xff4040);
      const blownLamp = lamp();
      R.C2 = { blown: m.blown, burstNearPole: !!red && red.p.distanceTo(polePoint(m, 1.0)) < 0.3, burstDist: red ? r2(red.p.distanceTo(polePoint(m, 1.0))) : null, sabDist: s ? r2(hd(s.body.translation(), m.pos)) : null };
      g.gnomes.remove(s);
      await frames(2);
      // C4: all fuses red, one more hit breaks it
      g.machines.breakMachine(m); g.machines.breakMachine(m);
      puffs.length = 0;
      await sleep(600);
      const v = m.body.linvel();
      const C4 = { broken: Math.round(m.broken + 0.6), truckSpeed: r2(Math.hypot(v.x, v.z)), lamp: lamp(), smokeAtPost: puffs.some((p) => p.c === 0x333333 && hd(p.p, m.pos) < 0.05 && Math.abs(p.p.y - m.pos.y - 1.5) < 0.05) };
      const brokenLamp = lamp();
      // C6 prompts at the pole: broken first
      await aimAtPole(m);
      const pBroken = prompt();
      await press('e');
      const afterE = { broken: m.broken, blown: m.blown };
      await aimAtPole(m);
      const pBlown = prompt();
      // repaired fully
      m.blown = 0; await frames(3);
      await aimAtPole(m);
      const pFine = prompt();
      await aimAtPad(m);
      const pPad = prompt();
      const healed = lamp();
      // the truck drives again: put it 3 m away, it returns
      m.robot.scan = 0;
      m.body.setTranslation({ x: m.pos.x + 3, y: 0.4, z: m.pos.z + 3 }, true);
      g.machines.savePoses();
      await teleport(m.pos.x - 8, m.pos.z - 8, 0, 0);
      let maxSpeed = 0; for (let k = 0; k < 20; k++) { await sleep(100); maxSpeed = Math.max(maxSpeed, m.robot.speed); }
      R.C4 = { ...C4, afterE, drivesAfterE: maxSpeed > 0.5 };
      R.C6 = { prompts: [pBlown, pBroken, pFine], promptAtPad: pPad };
      R.C7 = { fine, blown: blownLamp, broken: brokenLamp, healed };
      // seen from the pad side, where the fuse box faces: 1 red fuse of 2, red lamp
      m.blown = 1;
      const front = m.marker.localToWorld(new V3(1.2, 0, 0.3));
      await aimAt(polePoint(m, 1.2), front.x - polePoint(m).x, front.z - polePoint(m).z, 1.8);
      await shot('rs-C2-station-red-fuse');
    }
    // ---- C3: truck 10 m from its post, saboteur next to the truck walks to the station
    {
      await reset();
      g.state.upgrades.robotFuses = 2;
      const m = placeRobot();
      await frames(10);
      m.robot.scan = 1e9;
      m.body.setTranslation({ x: m.pos.x + 10, y: 0.4, z: m.pos.z }, true);
      g.machines.savePoses();
      const s = g.gnomes.spawn('saboteur', new V3(m.pos.x + 11.5, 0.5, m.pos.z), { tier: 'normal', awake: true });
      await sleep(3000);
      R.C3 = { blownAfter3s: m.blown, saboteurTargetDistToPost: s?.target ? r2(hd(s.target, m.pos)) : null, sabToTruck: r2(hd(s.body.translation(), m.body.translation())) };
      g.gnomes.remove(s);
    }
    // ---- C5: E at the pole and E at the truck both swap a fuse
    {
      await reset();
      g.state.upgrades.robotFuses = 2;
      const m = placeRobot();
      await frames(10);
      m.robot.scan = 1e9;
      m.blown = 1; await frames(2);
      const lp = await aimAtPole(m);
      await press('e');
      const fromPole = m.blown;
      m.blown = 1; await frames(2);
      const lt = await aimAtTruck(m);
      await press('e');
      R.C5 = { lookedPole: lp, lookedTruck: lt, repairFromPole: fromPole === 0, repairFromTruck: m.blown === 0 };
    }
    // ---- D1 / D4: G at the pole: ghost keeps the rotation, cargo spills at the old station, the new truck is empty
    {
      await reset();
      const m = placeRobot(P0.x, P0.z, 0.4);
      await frames(10);
      const old = m.pos.clone();
      const oldQ = m.quat.clone();
      const cargo = stash(m, 2);
      const looked = await aimAtPole(m);
      await press('g');
      const placing = g.player.placing;
      const ghostQuatEqualsOld = g.player.ghostQuat.angleTo(oldQ) < 1e-3;
      await frames(5);
      const cargoReleasedAtOld = cargo.filter((x) => x.state !== 'gone' && hd(x.body.translation(), old) < 2.5).length;
      const res = await placeAt(P0.x - 6, P0.z, 4.5, -0.35);
      await frames(10);
      const n = robot();
      R.D1 = { looked, placing, ghostQuatEqualsOld, afterPlace: { ...res, robots: g.machines.placedCount('robot'), stationAtNew: hd(n.station.translation(), n.pos) < 0.01 && hd(n.pos, old) > 4, truckAtNew: hd(n.body.translation(), n.pos) < 0.6, cargoReleasedAtOld } };
      // D4: the truck far from its post with 3 gnomes, G at the pole
      n.robot.scan = 1e9;
      const old2 = n.pos.clone();
      n.body.setTranslation({ x: n.pos.x - 6, y: 0.4, z: n.pos.z }, true);
      g.machines.savePoses();
      const c2 = stash(n, 3);
      await aimAtPole(n);
      await press('g');
      await frames(5);
      const oldPostGnomes = c2.filter((x) => x.state !== 'gone' && hd(x.body.translation(), old2) < 2.5).length;
      await placeAt(P0.x + 4, P0.z, 4.5, -0.35);
      await frames(5);
      R.D4 = { oldPostGnomes, newTruckQueue: robot()?.queue.length ?? null };
    }
    // ---- D2: X at the pole: inventory +1, cargo at the post, bodies and handles gone
    {
      await reset();
      const m = placeRobot();
      await frames(10);
      m.robot.scan = 1e9;
      const cargo = stash(m, 2);
      const before = g.machines.available('robot');
      const sh = m.station.handle; const bh = m.body.handle;
      const looked = await aimAtPole(m);
      await press('x');
      await frames(5);
      let stale = 0; for (const v of g.machines.byCollider.values()) if (v === m) stale++;
      R.D2 = { looked, available: g.machines.available('robot') - before, cargoAtPost: cargo.filter((x) => x.state !== 'gone' && hd(x.body.translation(), m.pos) < 2.5).length, staleHandles: stale, bodiesRemoved: !g.physics.bodies.contains(sh) && !g.physics.bodies.contains(bh), markerGone: m.marker.parent === null };
    }
    // ---- D3: G and X aimed at the truck
    {
      await reset();
      let m = placeRobot();
      await frames(10);
      await aimAtTruck(m);
      await press('g');
      const gFromTruck = g.player.placing === 'robot' && g.machines.placedCount('robot') === 0;
      await placeAt(P0.x, P0.z, 4.5, -0.35);
      await frames(10);
      m = robot();
      await aimAtTruck(m);
      await press('x');
      R.D3 = { gFromTruck, xFromTruck: g.machines.placedCount('robot') === 0 };
    }
    // ---- E1: old save entry with a hovering y; E1b: a fan where the pole appears (blueprint and game load)
    {
      await reset();
      const m0 = placeRobot(P0.x, P0.z, 0.9);
      await frames(3);
      const entry = { ...g.machines.serialize()[0], y: 0.8 };
      const placedKeys = Object.keys(entry);
      g.machines.clearAll(); await frames(2);
      g.machines.restore([entry]);
      await frames(3);
      const m = robot();
      R.E1 = { xzSame: hd(m.pos, entry) < 1e-6, yawSame: Math.abs(m.marker.rotation.y - 0.9) < 1e-3, hoveringYGrounded: m.pos.y < 0.05, posY: r2(m.pos.y), placedKeys };
      // E1b: the fan stands where the pole appears, saved after the robot
      g.state.upgrades.fan = 1;
      const pole = polePoint(m, 0);
      g.machines.clearAll(); await frames(2);
      const items = [{ ...entry, y: 0 }, { type: 'fan', x: pole.x, y: 0, z: pole.z, yaw: 0, tilt: 0, qx: 0, qy: 0, qz: 0, qw: 1 }];
      const back = g.machines.restore(items);
      await frames(3);
      const afterRestore = { robots: g.machines.placedCount('robot'), fans: g.machines.placedCount('fan'), back };
      const h = g.env.hole;
      g.blueprints.slots[0] = { at: Date.now(), items: items.map((p) => ({ ...p, x: p.x - h.x, y: p.y - h.y, z: p.z - h.z })) };
      g.blueprints.load(0);
      g.blueprints.slots[0] = null;
      await frames(10);
      const toast = document.body.innerText.includes('1 tool skipped: no room there (hole or factory)') ? '1 tool skipped: no room there (hole or factory)' : null;
      R.E1b = { robotsAfterLoad: g.machines.placedCount('robot'), fansAfterLoad: g.machines.placedCount('fan'), toast, afterRestore };
      // game load in a fresh page: same save, the note on the start
      const save = JSON.parse(JSON.stringify(g.state));
      save.placed = items;
      const old = localStorage.getItem(KEY);
      localStorage.setItem(KEY, J(save));
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0.01;pointer-events:none';
      f.src = '/';
      document.body.appendChild(f);
      let ig = null;
      for (let i = 0; i < 300 && !(ig = f.contentWindow?.gnome)?.shop; i++) await sleep(100);
      await sleep(400);
      const gameNote = f.contentDocument?.body?.innerText?.includes('1 tool is back in your inventory: no room there.') ?? false;
      R.E1b.gameLoad = { robots: ig?.machines.placedCount('robot'), fans: ig?.machines.placedCount('fan'), note: gameNote || ((await f.contentWindow.eval("import('/src/core/state.ts')")).loadNotes ?? []).includes('1 tool is back in your inventory: no room there.') };
      // E3: rebirth with Keep Tools reloads the page with the placed list: 2 robots come back with stations
      // (a new frame: a reload would autosave the first frame's yard over this save on unload)
      f.remove();
      await sleep(500);
      save.placed = [{ ...entry, y: 0 }, { ...entry, x: entry.x - 6, y: 0 }];
      save.upgrades.robot = 2;
      localStorage.setItem(KEY, J(save));
      const f2 = document.createElement('iframe');
      f2.style.cssText = f.style.cssText;
      f2.src = '/';
      document.body.appendChild(f2);
      for (let i = 0; i < 300 && !(ig = f2.contentWindow?.gnome)?.shop; i++) await sleep(100);
      await sleep(400);
      const il = ig?.machines.list.filter((x) => x.type === 'robot') ?? [];
      R.E3 = { afterRebirthRobots: il.length, stations: il.filter((x) => x.marker?.getObjectByName('station') && x.station).length };
      f2.remove();
      if (old) localStorage.setItem(KEY, old);
      delete g.state.upgrades.fan;
    }
    // ---- E2b: blueprint pop-in scales the station marker and the fuse box with it; E5: Z undo shrinks it out
    {
      await reset();
      g.state.upgrades.robotFuses = 1;
      placeRobot();
      await frames(3);
      const saved = g.machines.serialize();
      const h = g.env.hole;
      g.blueprints.slots[0] = { at: Date.now(), items: saved.map((p) => ({ ...p, x: p.x - h.x, y: p.y - h.y, z: p.z - h.z })) };
      g.machines.clearAll(); await frames(2);
      g.blueprints.load(0);
      g.blueprints.slots[0] = null;
      const m = robot();
      const M4 = new g.camera.matrixWorld.constructor(); const sc = new V3();
      const samples = [];
      for (let i = 0; i < 20; i++) { await frames(1); g.machines.boxMesh.getMatrixAt(0, M4); M4.decompose(new V3(), new Qt(), sc); samples.push([r2(m.marker.scale.x), r2(sc.x)]); }
      R.E2b = { samples, markerScaleMid: samples.some(([s]) => s > 0 && s < 1), boxScaleFollows: samples.every(([s, b]) => Math.abs(s - b) < 0.02) };
      // E5: a robot placed by the player, then Z
      await reset();
      g.player.selectTool('robot');
      await placeAt(P0.x, P0.z, 4.5, -0.35);
      await frames(3);
      const n = robot();
      const mk = n.marker;
      await cdp(kd(...KEYS.z), ku(...KEYS.z));
      const shrink = [];
      for (let i = 0; i < 20; i++) { await frames(1); shrink.push(r2(mk.scale.x)); }
      R.E5 = { shrink, markerShrinkMid: shrink.some((s) => s > 0 && s < 1), markerInSceneAfter: mk.parent !== null, robots: g.machines.placedCount('robot') };
    }
    // ---- R1 (review round): a fan face 1.25 m behind the station centre (the pole reaches 1.32 m): the preview and the
    // next load agree; at 1.40 m the preview is green and the load keeps the robot
    {
      await reset();
      g.state.upgrades.fan = 1;
      g.state.upgrades.robot = 2;
      const quat = qy(0);
      g.player.selectTool('robot');
      const open = await ghostAt(P0.x, P0.z, quat);
      g.player.cancelPlacement();
      const out = {};
      for (const [name, gap] of [['near', 1.25], ['far', 1.4]]) {
        await reset();
        // the fan collider's +z face is 0.2 m in front of the fan origin (half depth 0.3 at local z -0.1)
        g.machines.place('fan', new V3(open.at[0], 0, open.at[1] - gap - 0.2), qy(0));
        await frames(3);
        g.player.selectTool('robot');
        const gh = await ghostAt(P0.x, P0.z, quat);
        const pos = g.player.ghostPos.clone();
        g.player.cancelPlacement();
        g.machines.place('robot', pos, quat);
        await frames(3);
        const saved = g.machines.serialize();
        g.machines.clearAll(); await frames(2);
        const back = g.machines.restore(saved);
        await frames(2);
        out[name] = { previewBlocked: gh.blocked, at: gh.at, back, robots: g.machines.placedCount('robot') };
      }
      R.R1 = { open: open.at, ...out };
      delete g.state.upgrades.fan;
    }
    // ---- R2 (review round): a crate moving every frame (carried) leaves the yard map alone: the truck still plans round a belt
    {
      await reset();
      g.state.upgrades.conveyor = 1; g.state.upgrades.box = 1;
      const h = g.env.hole; const rr = g.env.holeRadius;
      const m = g.machines.place('robot', new V3(h.x, 0, h.z + rr + 11), qy(0));
      const r = m.robot;
      r.scan = 1e9;
      g.machines.place('conveyor', new V3(h.x, 0, h.z + rr + 5), qy(Math.PI / 2));
      const crate = g.machines.place('box', new V3(h.x + 8, 0.6, h.z + rr + 8), qy(0));
      await frames(3);
      let i = 0;
      const wiggle = () => { i++; crate.body.setTranslation({ x: h.x + 8 + (i % 2) * 0.4, y: 0.6, z: h.z + rr + 8 }, true); crate.body.setLinvel({ x: 0, y: 0, z: 0 }, true); };
      r.state = 'drive'; r.plan = 0;
      let maxPath = 0;
      for (let k = 0; k < 12; k++) { wiggle(); await frames(1); maxPath = Math.max(maxPath, r.path.length); }
      let arrived = false;
      const t0 = g.time;
      for (let k = 0; k < 3000 && !arrived && g.time - t0 < 20; k++) { wiggle(); await frames(1); arrived = r.state === 'tip' || r.state === 'return'; }
      R.R2 = { maxPath, arrived };
      delete g.state.upgrades.conveyor; delete g.state.upgrades.box;
    }
    // ---- R3 (review round): the hole pushes a station out onto a fan: the pole ends clear of it, or the robot goes back now
    {
      await reset();
      g.state.upgrades.robot = 1; g.state.upgrades.fan = 1;
      const m = placeRobot();
      await frames(10);
      m.broken = 1e9; // the truck stays at P0
      const h = g.env.hole; const keep = g.env.holeRadius + 2.9;
      // yaw 0: the pole stands 1.2 m towards -z of the spot the step-out picks on the +x side of the hole (as A7)
      g.machines.place('fan', new V3(h.x + keep, 0, h.z - 1.2), qy(0));
      await frames(3);
      const toasts = [];
      const ot = g.hud.toast.bind(g.hud); g.hud.toast = (t, k) => { toasts.push(t); return ot(t, k); };
      await teleport(h.x - keep - 4, h.z, 0, 0);
      m.pos.set(h.x + g.env.holeRadius + 1, m.pos.y, h.z);
      await frames(10);
      g.hud.toast = ot;
      const left = g.machines.list.includes(m);
      const poleInFan = left ? g.machines.poleBlocked(m) : null;
      const postDist = left ? r2(hd(m.pos, g.env.hole)) : null;
      const saved = g.machines.serialize();
      g.machines.clearAll(); await frames(2);
      const back = g.machines.restore(saved);
      await frames(2);
      R.R3 = { left, poleInFan, postDist, keep: r2(keep), back, fans: g.machines.placedCount('fan'), toast: toasts.includes('The hole moved under one of your machines. It is back in your inventory.') };
      delete g.state.upgrades.fan;
    }
    // ---- P1 / P1b / P2 (PP 2026-10-22 "jak robot nie ma nic do roboty to jest kolo tyczki"): an idle truck parks on
    // its pad facing the pad direction, leaves for a new gnome; a broken one stays put and parks after the repair.
    // Waits run on game time (headless is ~5 fps, dt is capped at 0.05 s).
    {
      const gameWait = async (sec, until) => { const t0 = g.time; while (g.time - t0 < sec) { await frames(1); if (until && until()) return true; } return false; };
      const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      const h = g.env.hole; const hr = g.env.holeRadius;
      // a side of the hole with open grass for the station (hole + 7 m) and a gnome 3 m beyond it
      const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => [7, 10].every((k) => g.env.inside(h.x + dx * (hr + k), h.z + dz * (hr + k), 2) && !g.factory.inside(h.x + dx * (hr + k), h.z + dz * (hr + k)))) ?? [1, 0];
      const at = (k) => new V3(h.x + dir[0] * (hr + k), 0, h.z + dir[1] * (hr + k));
      const parkState = (m) => { const v = m.body.linvel(); const q = m.body.rotation(); const bodyYaw = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
        return { state: m.robot.state, dist: r2(hd(m.body.translation(), m.pos)), speed: r2(Math.hypot(v.x, v.z)), yawErr: r2(Math.abs(wrapA(bodyYaw - m.marker.rotation.y))) }; };
      await reset();
      g.state.upgrades.robot = 1;
      const s = at(7);
      const m = g.machines.place('robot', s, qy(0));
      await frames(10);
      await teleport(s.x + dir[1] * 10, s.z + dir[0] * 10, 0, 0); // off to the side, never in front of the truck
      // P1: the truck at the rim facing the hole with 2 gnomes: it tips, then has nothing to do
      const rim = at(1.2);
      m.body.setTranslation({ x: rim.x, y: 0.4, z: rim.z }, true);
      m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      m.robot.yaw = Math.atan2(-dir[0], -dir[1]);
      g.machines.savePoses();
      stash(m, 2);
      m.robot.state = 'drive';
      let tipped = false; const slow = []; const curve = [];
      const parked = await gameWait(12, () => {
        const d = hd(m.body.translation(), m.pos);
        if (m.robot.state === 'tip') tipped = true;
        if (tipped) curve.push([r2(d), r2(m.robot.speed)]);
        if (tipped && m.robot.state === 'return' && d < 0.4) slow.push(m.robot.speed);
        return tipped && m.robot.state === 'idle';
      });
      const atIdle = parkState(m);
      await gameWait(1.5);
      await shot('rs-P1-parked');
      R.P1 = { dir, tipped, parked, queue: m.queue.length, atIdle, after: parkState(m), slowFrames: slow.length, slowMax: r2(Math.max(0, ...slow)), curveTail: curve.slice(-12) };
      // P1b: a gnome lands in its area: it leaves the pad
      const gp = at(10);
      const gn = g.gnomes.spawn('classic', new V3(gp.x + dir[1] * 1, 0.5, gp.z + dir[0] * 1), { tier: 'normal' });
      m.robot.scan = 0;
      const left = await gameWait(6, () => m.robot.state !== 'idle' && hd(m.body.translation(), m.pos) > 0.5);
      R.P1b = { left, state: m.robot.state, target: m.robot.targetGnome === gn, dist: r2(hd(m.body.translation(), m.pos)) };
      // P2: broken 5 m from the post: stays; repaired: parks
      clearGnomes();
      m.queue = [];
      m.robot.targetGnome = null;
      const off = new V3(s.x + dir[1] * 5, 0.4, s.z + dir[0] * 5);
      m.body.setTranslation(off, true);
      m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      g.machines.savePoses();
      m.robot.state = 'return';
      m.broken = 30;
      await gameWait(2);
      const brokenMoved = r2(hd(m.body.translation(), off));
      m.broken = 0;
      const back = await gameWait(12, () => m.robot.state === 'idle');
      await gameWait(1);
      R.P2 = { brokenMoved, back, after: parkState(m) };
    }
    // ---- F1: 12 robots, 300 gnomes, 60 s: machines.update p95, station bodies, station draw calls
    {
      await reset();
      g.state.upgrades.robot = 12;
      const bodies0 = g.physics.bodies.len();
      for (let i = 0; i < 12; i++) placeRobot(-18 + (i % 4) * 6, -20 + Math.floor(i / 4) * 6);
      await frames(5);
      const bodiesDelta = g.physics.bodies.len() - bodies0 - 12; // minus the 12 trucks
      for (let i = 0; i < 300; i++) g.gnomes.spawn('classic', new V3(-20 + Math.random() * 40, 1, -24 + Math.random() * 20), { tier: 'normal' });
      await teleport(0, 10, 0, -0.3);
      const times = [];
      const ou = g.machines.update.bind(g.machines);
      g.machines.update = (dt) => { const t0 = performance.now(); ou(dt); times.push(performance.now() - t0); };
      await sleep(60000);
      g.machines.update = ou;
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      // draw calls the 12 stations add (pad + lamp each), measured by hiding them
      await teleport(-9, -4, 0, -0.5);
      const r = g.renderer;
      const calls = () => { r.render(g.scene, g.camera); return r.info.render.calls; };
      const st = robots().map((m) => m.marker.getObjectByName('station'));
      const withSt = calls(); st.forEach((o) => { o.visible = false; }); const without = calls(); st.forEach((o) => { o.visible = true; });
      R.F1 = { frames: times.length, updateP95: r2(p95), bodiesDelta, stationCalls: withSt - without, callsDelta: withSt - without - 12 };
      clearGnomes();
    }
    // ---- F3: the shop badge hides the station
    {
      const { MODELS } = await import('/src/ui/icons.ts');
      const obj = MODELS.robot();
      obj.traverse((o) => { if (o.name === 'drop' || o.name === 'station') o.visible = false; });
      const url = (await (await fetch('/src/entities/robots.ts')).text()).match(/from "([^"]*three\.js[^"]*)"/)[1];
      const { Box3 } = await import(url);
      const box = new Box3(); obj.updateWorldMatrix(true, true);
      obj.traverseVisible((o) => { if (o.isMesh) box.expandByObject(o); });
      R.F3 = { thumbWidth: r2(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)) };
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
  ok('A4', R.A4?.postMoved && R.A4?.markerAtHome && R.A4?.stationAtHome && Math.abs(R.A4?.postDist - R.A4?.keep) < 0.05, J(R.A4));
  ok('A5', R.A5?.brokenAtLevelUp && R.A5?.postMovedSameFrame && R.A5?.stationAtHome, J(R.A5));
  ok('A6', R.A6?.poleTowardsHole && R.A6?.poleDistFromCentre >= R.A6?.r1 + 1.0, J(R.A6));
  ok('A7', R.A7?.playerFreed && Object.values(R.A7?.heldBack ?? {}).every((v) => v === true) && Object.values(R.A7?.followed ?? {}).every(Boolean) && Object.keys(R.A7?.followed ?? {}).length === 4, J(R.A7));
  ok('B1', R.B1?.stationChildOfMarker && !R.B1?.onTruck && Math.abs(R.B1?.markerYaw - 0.7) < 0.01 && R.B1?.poleErr < 0.05 && R.B1?.truckDistToPost < 0.6, J(R.B1));
  ok('B2', R.B2?.blockedPoleInFan === true && R.B2?.blockedOpen === false && R.B2?.ghostHasStation && R.B2?.ghostLampHidden, J(R.B2));
  ok('B3', R.B3?.fanOverPole === true && R.B3?.fanOverPad === true && R.B3?.besidePad === false, J(R.B3));
  ok('B3b', R.B3b?.beltBackAfterWideBelt === 1, J(R.B3b));
  ok('B4', R.B4?.playerStoppedAtPole && R.B4?.walkAdvance > 0.3 && R.B4?.playerCrossedPad && R.B4?.truckReachedHome && R.B4?.gnomeCrossedPole, J(R.B4));
  ok('C1', R.C1?.fusesAtStation === 2 && R.C1?.fusesOnTruck === 0 && R.C1?.boxDistToPole < 0.2 && R.C1?.robotOnly === 2 && R.C1?.withFan === 4, J(R.C1));
  ok('C2', R.C2?.blown === 1 && R.C2?.burstNearPole, J(R.C2));
  ok('C3', R.C3?.blownAfter3s === 0 && R.C3?.saboteurTargetDistToPost < 2.5, J(R.C3));
  ok('C4', R.C4?.broken === 30 && R.C4?.truckSpeed < 0.05 && R.C4?.lamp === 'ff3b3b' && R.C4?.smokeAtPost && R.C4?.afterE?.broken === 0 && R.C4?.drivesAfterE, J(R.C4));
  ok('C5', R.C5?.repairFromPole && R.C5?.repairFromTruck, J(R.C5));
  const pr = R.C6?.prompts || [];
  ok('C6', pr[0] === 'E replace fuse (1/2 blown)' && pr[1] === 'E repair Cleaning Robot' && pr[2] === 'G move · X pick up Cleaning Robot' && R.C6?.promptAtPad === 'G move · X pick up Cleaning Robot', J(R.C6));
  ok('C7', R.C7?.fine === '2bd44a' && R.C7?.blown === 'ff3b3b' && R.C7?.broken === 'ff3b3b' && R.C7?.healed === '2bd44a', J(R.C7));
  ok('D1', R.D1?.placing === 'robot' && R.D1?.ghostQuatEqualsOld && R.D1?.afterPlace?.robots === 1 && R.D1?.afterPlace?.stationAtNew && R.D1?.afterPlace?.truckAtNew && R.D1?.afterPlace?.cargoReleasedAtOld === 2, J(R.D1));
  ok('D2', R.D2?.available === 1 && R.D2?.cargoAtPost === 2 && R.D2?.staleHandles === 0 && R.D2?.bodiesRemoved, J(R.D2));
  ok('D3', R.D3?.gFromTruck && R.D3?.xFromTruck, J(R.D3));
  ok('D4', R.D4?.oldPostGnomes === 3 && R.D4?.newTruckQueue === 0, J(R.D4));
  ok('E1', R.E1?.xzSame && R.E1?.yawSame && R.E1?.hoveringYGrounded && J(R.E1?.placedKeys) === J(['type', 'x', 'y', 'z', 'yaw', 'tilt', 'qx', 'qy', 'qz', 'qw']), J(R.E1));
  ok('E1b', R.E1b?.robotsAfterLoad === 0 && R.E1b?.fansAfterLoad === 1 && R.E1b?.toast?.startsWith('1 tool skipped: no room there (hole or factory)') && R.E1b?.afterRestore?.back === 1 && R.E1b?.gameLoad?.robots === 0 && R.E1b?.gameLoad?.fans === 1 && R.E1b?.gameLoad?.note, J(R.E1b));
  ok('E2', R.E2?.blueprintRobots === 2 && R.E2?.stations === 2 && R.E2?.stationBodies === 2, J(R.E2));
  ok('E2b', R.E2b?.markerScaleMid && R.E2b?.boxScaleFollows, J(R.E2b));
  ok('E3', R.E3?.afterRebirthRobots === 2 && R.E3?.stations === 2, J(R.E3));
  ok('E4', R.A4?.stationBodyDistToHome < 0.01, J({ stationBodyDistToHome: R.A4?.stationBodyDistToHome }));
  ok('E5', R.E5?.markerShrinkMid && R.E5?.markerInSceneAfter === false && R.E5?.robots === 0, J(R.E5));
  const R1n = R.R1?.near || {}; const R1f = R.R1?.far || {};
  ok('R1', R1n.previewBlocked === (R1n.back === 1) && R1f.previewBlocked === false && R1f.back === 0 && R1f.robots === 1, J(R.R1));
  ok('R2', R.R2?.maxPath > 0 && R.R2?.arrived, J(R.R2));
  ok('R3', R.R3?.fans === 1 && (R.R3?.left ? R.R3.poleInFan === false && R.R3.back === 0 && Math.abs(R.R3.postDist - R.R3.keep) < 0.05 : R.R3?.toast === true), J(R.R3));
  const pk = (s) => s?.state === 'idle' && s.dist < 0.6 && s.speed < 0.05;
  ok('P1', R.P1?.tipped && R.P1?.parked && R.P1?.queue === 0 && pk(R.P1?.after) && R.P1?.after?.yawErr < 0.2 && R.P1?.slowFrames >= 2 && R.P1?.slowMax < 1.0, J(R.P1));
  ok('P1b', R.P1b?.left && R.P1b?.state === 'seek', J(R.P1b));
  ok('P2', R.P2?.brokenMoved < 0.1 && R.P2?.back && pk(R.P2?.after), J(R.P2));
  ok('F1', R.F1?.updateP95 <= 1.0 && R.F1?.bodiesDelta === 12 && R.F1?.callsDelta <= 12, J(R.F1));
  // truck + bed are 1.8 m long; a badge that still drew the station would be at least its 2.6 m pad
  ok('F3', R.F3?.thumbWidth < 2.0, J(R.F3));
  window.__done = J({ locked: R.locked, error: R.error, checks });
})();
