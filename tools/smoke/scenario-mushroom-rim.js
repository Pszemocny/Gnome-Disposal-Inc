// A resting mushroom never stays inside the hole's opening: it hops out to the rim (docs/ai-work/2026-10-24-mushroom-rim.md).
// Run: DEV_PORT=5173 CDP_PORT=9391 node tools/smoke/smoke.mjs <outDir> <this file>
const g = window.gnome;
const out = [];
const ok = (n, cond, info = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${n} ${info}`);
setTimeout(() => { if (!window.__done) window.__done = out.join('\n') + '\nTIMEOUT'; }, 60000);
(async () => {
  try {
    const V = g.camera.position.constructor;
    g.paused = true; // the scenario steps the mushrooms itself at 60 Hz
    g.player.position.y = 50; // far above: the player must not pick anything up
    const step = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { g.mushrooms.update(1 / 60); each?.(); } };
    const dist = (m) => g.env.holeDist(m.mesh.position.x, m.mesh.position.z);
    const put = (x, z) => { g.mushrooms.clearAll(); g.mushrooms.spawn(g.mushrooms.pickDef(), new V(x, 0, z), false); return g.mushrooms.list[0]; };

    // a + c: spawned at the hole centre, sampled over the hop
    {
      const m = put(g.env.hole.x, g.env.hole.z);
      const d0 = dist(m); const ds = []; let peak = m.mesh.scale.clone();
      step(0.5, () => { ds.push(dist(m)); if (m.mesh.scale.y < peak.y) peak = m.mesh.scale.clone(); });
      const d1 = dist(m); const R = g.env.holeRadius;
      ok('a', g.mushrooms.list.includes(m) && d1 > R + 0.3 && m.mesh.position.y === 0, `d=${d1.toFixed(2)} R=${R} y=${m.mesh.position.y.toFixed(2)}`);
      const mid = ds.filter((d) => d > d0 + 0.05 && d < d1 - 0.05).length;
      const vol = (peak.y * peak.x * peak.z) / 1.4 ** 3; // rule 5: landing squash keeps the volume
      ok('c', mid >= 1 && Math.abs(d1 - (R + 1)) < 0.3 && peak.y < 1.3 && vol > 0.8 && vol < 1.2 && m.mesh.scale.y === 1.4, `between=${mid}/${ds.length} end=${d1.toFixed(2)} want~${(R + 1).toFixed(2)} squashY=${peak.y.toFixed(2)} vol=${vol.toFixed(2)}`);
    }

    // b: 0.5 m past the rim, then a level-up grows the radius past it
    {
      const R0 = g.env.holeRadius; const c = g.env.hole.clone();
      const dir = g.env.constructor.holeCenterFor(4).sub(c).setY(0).normalize(); // place it where the hole will move
      if (dir.lengthSq() === 0) dir.set(1, 0, 0);
      const m = put(c.x + dir.x * (R0 + 0.5), c.z + dir.z * (R0 + 0.5));
      step(0.5);
      const stay = dist(m) < R0 + 0.6; // must not hop while it lies outside
      g.state.holeLevel = 3; g.hole.levelUp(); // 3 → 4: radius 2.4 → 2.8, centre moves 1.2 m
      const covered = dist(m) < g.env.holeRadius;
      step(0.6);
      ok('b', stay && covered && g.mushrooms.list.includes(m) && dist(m) > g.env.holeRadius + 0.3, `stay=${stay} covered=${covered} d=${dist(m).toFixed(2)} R=${g.env.holeRadius}`);
    }

    // d: the hole slides onto a resting mushroom (Land move)
    {
      const m = put(g.env.hole.x + 6, g.env.hole.z);
      step(0.2);
      g.env.hole.x += 6; // the slide moves the centre frame by frame; the end state is what matters
      step(0.6);
      ok('d', g.mushrooms.list.includes(m) && dist(m) > g.env.holeRadius + 0.3, `d=${dist(m).toFixed(2)} R=${g.env.holeRadius}`);
    }
  } catch (e) {
    out.push('ERROR ' + (e.stack || e));
  }
  window.__done = out.join('\n');
})();
