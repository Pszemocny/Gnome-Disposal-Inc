// A resting mushroom never stays inside the hole's opening: it hops out to the rim (docs/ai-work/2026-10-24-mushroom-rim.md).
// h1-h3: the hole has no magnet or pull on gnomes (docs/ai-work/2026-10-22-hole-no-pull.md).
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
      // a level-up without a land change: start on the Garden (land 1) at level 3
      g.state.holeLevel = 3; g.state.land = 1; g.env.rebuildHole(); g.env.rebuildLand();
      const R0 = g.env.holeRadius; const c = g.env.hole.clone();
      const dir = g.env.constructor.holeCenterFor(4, 1).sub(c).setY(0).normalize(); // place it where the hole will move
      if (dir.lengthSq() === 0) dir.set(1, 0, 0);
      const m = put(c.x + dir.x * (R0 + 0.5), c.z + dir.z * (R0 + 0.5));
      step(0.5);
      const stay = dist(m) < R0 + 0.6; // must not hop while it lies outside
      g.hole.levelUp(); // 3 → 4 on the Garden: radius 2.4 → 2.8, centre moves 1.2 m
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

    // h1-h3: the hole has no magnet or pull (docs/ai-work/2026-10-22-hole-no-pull.md); gnomes and physics stepped at 60 Hz
    {
      g.env.rebuildHole(); // d moved the centre without the ground slabs
      const c = g.env.hole.clone(); const R = g.env.holeRadius;
      const clear = () => { for (const x of [...g.gnomes.list]) if (x.state !== 'gone') g.gnomes.remove(x); };
      const hd = (x) => { const p = x.body.translation(); return g.env.holeDist(p.x, p.z); };
      const run = (x, sec, each) => { for (let i = 0; i < Math.round(sec * 60) && g.gnomes.list.includes(x); i++) { g.gnomes.update(1 / 60); if (!g.gnomes.list.includes(x)) break; each?.(); g.gnomes.savePoses(); g.physics.step(); } };
      const fling = (pos, vel) => { clear(); const x = g.gnomes.spawn('classic', pos, { tier: 'normal', awake: false }); g.gnomes.ragdoll(x); x.body.setLinvel(vel, true); return x; };

      // h1: flying 1.0 m over the centre, fast enough to leave the circle before it sinks to 0.6 x scale
      {
        const x = fling(new V(c.x, 1.0, c.z), new V(16, 0, 0));
        let fell = false; let minY = 9;
        run(x, 0.4, () => { if (x.state === 'falling') fell = true; minY = Math.min(minY, x.body.translation().y); });
        ok('h1', !fell && x.state !== 'falling' && hd(x) > R, `fell=${fell} d=${hd(x).toFixed(2)} R=${R} minY=${minY.toFixed(2)} scale=${x.scale}`);
      }

      // h2: dropped onto the hole: swallowed, keeps 0.3 x its horizontal speed (no inward part), never past r while falling
      {
        const x = fling(new V(c.x - 1.0, 1.5, c.z), new V(3, 0, 0));
        let vBefore = null; let vAfter = null; let maxD = 0; let fellAt = -1; let n = 0;
        run(x, 3, () => {
          n++;
          if (x.state !== 'falling') { vBefore = x.body.linvel(); return; }
          if (fellAt < 0) { fellAt = n; vAfter = x.body.linvel(); }
          maxD = Math.max(maxD, hd(x));
        });
        const gone = !g.gnomes.list.includes(x);
        const noPull = vBefore && vAfter && Math.abs(vAfter.x - vBefore.x * 0.3) < 0.05 && Math.abs(vAfter.z - vBefore.z * 0.3) < 0.05;
        ok('h2', fellAt > 0 && gone && noPull && maxD <= R, `fellAt=${fellAt} gone=${gone} vBefore=${vBefore?.x.toFixed(2)},${vBefore?.z.toFixed(2)} vAfter=${vAfter?.x.toFixed(2)},${vAfter?.z.toFixed(2)} maxD=${maxD.toFixed(2)} R=${R}`);
      }

      // h4: a fast gnome skimming into the opening keeps 7.5 m/s sideways after the catch: the tube wall holds it inside r
      {
        const x = fling(new V(c.x, 0.5, c.z), new V(25, 0, 0));
        let maxD = 0; let fell = false; let walled = 0;
        run(x, 3, () => { if (x.state !== 'falling') return; fell = true; const d = hd(x); maxD = Math.max(maxD, d); if (d > R - 0.25) walled++; });
        ok('h4', fell && !g.gnomes.list.includes(x) && maxD <= R && walled > 0, `fell=${fell} maxD=${maxD.toFixed(2)} wall=${(R - 0.2 * x.scale).toFixed(2)} framesAtWall=${walled} R=${R}`);
      }

      // h3: resting on the corner strip (a ground slab inside the circle, outside the square gap) is still swallowed
      {
        clear();
        const x = g.gnomes.spawn('classic', new V(c.x + R * 0.85, 0.6, c.z), { tier: 'normal', awake: false });
        let fell = false;
        run(x, 1, () => { if (x.state === 'falling') fell = true; });
        ok('h3', fell, `fell=${fell} start d=${(R * 0.85).toFixed(2)} square half=${(R * 0.7071).toFixed(2)} R=${R}`);
      }
      clear();
    }
  } catch (e) {
    out.push('ERROR ' + (e.stack || e));
  }
  window.__done = out.join('\n');
})();
