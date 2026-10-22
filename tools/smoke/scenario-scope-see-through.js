// Trick Scope Lvl 3 see-through held gnomes (docs/ai-work/2026-10-22-scope-see-through.md, "Gotowe, gdy").
// One RESULT JSON with `checks` (PASS/FAIL lines) and the sampled alpha curves; screenshots 01-scope3-held, 02-scope2-held.
// Run: URL_QUERY='' FAKELOCK=1 DEV_PORT=5199 CDP_PORT=9423 MAXPOLL=4000 node tools/smoke/smoke.mjs sst-out tools/smoke/scenario-scope-see-through.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const g = window.gnome;
const R = {};
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));

setTimeout(() => { if (!window.__done) window.__done = JSON.stringify({ ...R, checks, timeout: true }); }, 580000);
(async () => {
  try {
    const { freshState, blockSaves } = await import('/src/core/state.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    blockSaves();
    const st = freshState(); st.money = 1e6; st.holeLevel = 5; st.upgrades.scope = 3;
    g.state = st;
    g.goals = new Goals(); g.goals.update = () => {};
    g.moods.update = () => {};
    g.contracts.update = () => {};
    g.events.spawnVisitor = () => {};
    g.events.next = 1e9;
    for (const el of document.querySelectorAll('.menu, .hud-helpbox')) el.style.display = 'none';
    g.paused = false;
    const V3 = g.camera.position.constructor;
    const clearGnomes = () => { g.player.swarm = []; g.player.held = null; for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); g.factory.queue.length = 0; };
    const h = g.env.hole;
    // 7 m from the hole, looking at it
    const px = h.x + 7, pz = h.z;
    g.player.body.setTranslation({ x: px, y: 1.2, z: pz }, true);
    g.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    g.player.position.set(px, 1.2, pz);
    g.player.yaw = Math.atan2(-(h.x - px), -(h.z - pz));
    g.player.pitch = -0.25;
    const fwd = () => new V3(-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw));
    const ahead = (d, side = 0) => { const f = fwd(); return g.player.position.clone().addScaledVector(f, d).addScaledVector(new V3(-f.z, 0, f.x), side).setY(1.2); };
    clearGnomes();
    await frames(5);

    // the alpha this gnome is drawn with: its place among the see-through instances of its type, 1 when not there
    const alphaOf = (x) => {
      const mesh = g.gnomes.seeMeshes.get(x.type.id);
      const idx = g.gnomes.slots.get(x.type.id).filter((s) => s.state !== 'stashed' && s.seeT > 0).indexOf(x);
      return idx < 0 || idx >= mesh.count ? 1 : mesh.geometry.getAttribute('see').getX(idx);
    };
    const sample = async (list, n) => { const out = list.map(() => []); for (let i = 0; i < n; i++) { await frames(1); list.forEach((x, k) => out[k].push(+alphaOf(x).toFixed(3))); } return out; };
    const holdHand = (x) => { g.player.swarm = []; g.gnomes.hold(x); g.player.held = { body: x.body, gnome: x }; };
    const holdBall = (list) => { g.player.held = null; g.player.swarm = []; for (const x of list) { g.gnomes.hold(x); g.player.swarm.push({ g: x, caught: true, inBall: true, out: 0 }); } };
    const between = (c) => c.some((a) => a > 0.12 && a < 0.999);

    // S1/S3: scope 3, in hand: a classic gnome (moving parts) and a one-piece fat gnome, one after the other
    for (const type of ['classic', 'fat']) {
      clearGnomes();
      const x = g.gnomes.spawn(type, ahead(1.5), { tier: 'normal', awake: false });
      await frames(2);
      holdHand(x);
      const [inC] = await sample([x], 15);
      R[`hold_${type}`] = inC;
      ok(`S1 ${type}`, Math.min(...inC) <= 0.12 && between(inC) && x.state === 'held', `alpha in hand ${inC.join(',')}`);
      if (type === 'classic') {
        const p = x.body.translation();
        R.heldOnScreen = new V3(p.x, p.y, p.z).project(g.camera).toArray().map((v) => +v.toFixed(2));
        await shot('01-scope3-held');
      }
      g.player.throwHeld();
      const [outC] = await sample([x], 15);
      R[`throw_${type}`] = outC;
      ok(`S3 ${type}`, outC[outC.length - 1] === 1 && between(outC) && x.state !== 'held', `alpha after the throw ${outC.join(',')}`);
    }

    // S2: scope 3, Magnet Gun ball of 4
    clearGnomes();
    const ball = [0, 1, 2, 3].map((i) => g.gnomes.spawn(i % 2 ? 'blue' : 'classic', ahead(1.6, (i - 1.5) * 0.3), { tier: 'normal', awake: false }));
    await frames(2);
    holdBall(ball);
    const ballC = await sample(ball, 15);
    R.ball = ballC.map((c) => c[c.length - 1]);
    ok('S2', ballC.every((c) => c[c.length - 1] <= 0.12), `last alpha per ball gnome ${R.ball.join(',')}`);
    g.player.throwHeld();
    await frames(10);

    // S4: scope 2, in hand: stays opaque, nothing in the see-through pass
    st.upgrades.scope = 2;
    clearGnomes();
    const y = g.gnomes.spawn('classic', ahead(1.5), { tier: 'normal', awake: false });
    await frames(2);
    holdHand(y);
    const [c2] = await sample([y], 20);
    const seeCount = [...g.gnomes.seeMeshes.values()].reduce((a, m) => a + m.count, 0);
    ok('S4', c2.every((a) => a === 1) && seeCount === 0 && y.state === 'held', `alpha at scope 2 ${c2.join(',')} see-through instances ${seeCount}`);
    await shot('02-scope2-held');
    g.player.throwHeld();
    await frames(5);
    clearGnomes();
  } catch (e) {
    checks.push('FAIL exception ' + (e?.stack ?? e));
  }
  window.__done = JSON.stringify({ ...R, errors, checks });
})();
