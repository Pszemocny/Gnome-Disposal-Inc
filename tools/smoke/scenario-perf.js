// Frame time per spot and quality level, GPU time on a large backing store, and the quality / ?stats checks
// (docs/ai-work/2026-10-21-plan-performance.md). One mode per run, chosen by ?regime= in URL_QUERY:
//   small    a fresh-boot block (factory, 120 frames, no quality switch; &freshonly stops after it), then spots
//            factory, house, hole, busy x medium/high/low, 30 s each at 640x360; HUD mutations; gnome shadow A/B
//   proxy    spots factory + busy at 2560x1440 @ DPR 2, game paused, 60 x (render + 1-pixel readPixels) per quality
//   quality  ratio / shadow map / box / radius / night per quality, then the menu switch medium → high → low → medium;
//            run once more with DPR=0.8 (browser zoom below 100 %) for prCheck
//   boot     a second game in an iframe after a cookie (&cookie=<q>) or an old save (&save=noshadows); add &lowfx to
//            boot the iframe with ?lowfx
//   stats    the ?stats overlay text (add &stats to the URL; without it the overlay must not exist)
// Run (dev server restarted first, so the dynamic imports below return the live module instances):
//   git rev-parse HEAD > <out>/head.txt; git status --short >> <out>/head.txt
//   URL_QUERY='?regime=small' DPR=1 DEV_PORT=5183 CDP_PORT=9401 MAXPOLL=2400 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-perf.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const P = new URLSearchParams(location.search);
const regime = P.get('regime') ?? 'small';
const g = window.gnome;
const out = [];
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
const r1 = (v) => Math.round(v * 10) / 10;
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const V = g.camera.position.constructor;
const sun = g.env.sun;
const look = (r = g.renderer, s = sun) => ({ pr: r.getPixelRatio(), shadows: r.shadowMap.enabled, map: s.shadow.mapSize.x, right: s.shadow.camera.right, radius: r1(s.shadow.radius) });
const buf = () => { const gl = g.renderer.getContext(); return `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`; };

(async () => {
  try {
    const S = await import('/src/core/settings.ts');
    // the env reads prefs.quality for the night look: a second module instance would leave nightShade at 1 on Low
    const nightOn = (q) => { S.prefs.quality = q; const n0 = g.env.night; g.env.night = 1; g.env.update(0); const n = g.env.nightShade; g.env.night = n0; g.env.update(0); return n; };
    const q0 = S.prefs.quality;
    if (!S.lowfx && (nightOn('low') !== 0 || nightOn('medium') !== 1)) throw new Error('settings module instance');
    S.prefs.quality = q0;
    const setQ = async (q) => { S.prefs.quality = q; S.applyQuality(g.renderer, g.scene); await g.renderer.compileAsync(g.scene, g.camera); };
    for (const el of document.querySelectorAll('.menu')) el.style.display = 'none';

    // ---- timing: wrappers add their time to acc; the sampler closes one record per game frame
    const acc = {};
    const wrap = (obj, name, label = name) => {
      const f = obj[name];
      obj[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { acc[label] = (acc[label] ?? 0) + performance.now() - t; } };
    };
    wrap(g.physics, 'step', 'physics.step');
    for (const [o, n] of [['gnomes', 'update'], ['gnomes', 'writeInstances'], ['machines', 'update'], ['player', 'update'], ['hud', 'update'], ['env', 'update'], ['fx', 'update'], ['hole', 'update'], ['events', 'update']]) wrap(g[o], n, `${o}.${n}`);
    wrap(g.renderer, 'render', 'renderer.render');
    wrap(Storage.prototype, 'setItem', 'setItem');
    const longtasks = [];
    try { new PerformanceObserver((l) => longtasks.push(...l.getEntries().map((e) => ({ t: e.startTime, ms: e.duration })))).observe({ type: 'longtask', buffered: true }); } catch {}
    let rec = null;
    let lastGame = performance.now();
    let prev = null;
    const sampler = (now) => {
      requestAnimationFrame(sampler);
      // hud.update runs once in every game frame, paused or not; ticks skipped by the 60 fps cap carry no work
      if (acc['hud.update'] === undefined) return;
      const info = g.renderer.info;
      const cur = { progs: info.programs.length, tex: info.memory.textures, heap: performance.memory?.usedJSHeapSize ?? 0 };
      if (rec && prev) {
        const d = cur.progs - prev.progs;
        rec.push({ ms: now - lastGame, sys: { ...acc }, dProg: d, dTex: cur.tex - prev.tex, dHeap: (cur.heap - prev.heap) / 1048576, links: d > 0 ? info.programs.slice(-d).map((p) => p.name) : null, tri: info.render.triangles, calls: info.render.calls });
      }
      prev = cur;
      lastGame = now;
      for (const k in acc) delete acc[k];
    };
    requestAnimationFrame(sampler);
    const gpuTime = (n) => {
      const gl = g.renderer.getContext();
      const px = new Uint8Array(4);
      const t = [];
      // 30 renders of warm-up: with 5 the first quality measured after the pause read 20-30 % slow (new shadow map,
      // GPU still finishing the game frames)
      for (let i = 0; i < n + 30; i++) {
        const t0 = performance.now();
        g.renderer.render(g.scene, g.camera);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (i >= 30) t.push(performance.now() - t0);
      }
      return { p50: r1(pct(t, 0.5)), p95: r1(pct(t, 0.95)) };
    };
    // one (spot, quality) block: quality + compile + 2 s warm-up outside the stats, then `secs` of play
    const block = async (spot, q, secs) => {
      await setQ(q);
      await sleep(2000);
      const lt0 = performance.now();
      rec = [];
      await sleep(secs * 1000);
      const fr = rec;
      rec = null;
      const ms = fr.map((f) => f.ms);
      const names = [...new Set(fr.flatMap((f) => Object.keys(f.sys)))];
      const sys = Object.fromEntries(names.map((n) => { const v = fr.map((f) => f.sys[n] ?? 0); return [n, { p95: r1(pct(v, 0.95)), max: r1(Math.max(...v)) }]; }));
      const over25 = fr.map((f, i) => ({ i, ...f })).filter((f) => f.ms > 25).map((f) => {
        const top = Object.entries(f.sys).sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
        return { i: f.i, ms: r1(f.ms), top: `${top[0]} ${r1(top[1])}`, programsDelta: f.dProg, texturesDelta: f.dTex, heapDeltaMB: r1(f.dHeap), setItemMs: r1(f.sys.setItem ?? 0) };
      });
      const lt = longtasks.filter((l) => l.t >= lt0);
      const last = fr[fr.length - 1] ?? {};
      return {
        regime: 'small', spot, q, n: fr.length, p50: r1(pct(ms, 0.5)), p95: r1(pct(ms, 0.95)), max: r1(Math.max(0, ...ms)),
        over25: over25.slice(0, 15), over25n: over25.length, programsDelta: fr.reduce((s, f) => s + f.dProg, 0),
        links: fr.filter((f) => f.links).map((f, i) => ({ i, names: f.links })), sys, longtasks: { n: lt.length, max: r1(Math.max(0, ...lt.map((l) => l.ms))) },
        tri: last.tri, calls: last.calls, pixels: buf(), shadowMap: g.renderer.shadowMap.enabled ? sun.shadow.mapSize.x : 0, gnomes: g.gnomes.list.length,
      };
    };

    // ---- spots
    const tp = (x, z, lx, lz, pitch = -0.1) => {
      g.player.position.set(x, 1.2, z);
      g.player.body.setTranslation({ x, y: 1.2, z }, true);
      g.player.yaw = Math.atan2(-(lx - x), -(lz - z));
      g.player.pitch = pitch;
    };
    // robots and crates hold stashed gnomes in their queue: empty it first, or the robot's next tip frees a freed body
    const clearGnomes = () => { for (const m of g.machines.list) m.queue.length = 0; for (const x of [...g.gnomes.list]) g.gnomes.remove(x); g.factory.queue.length = 0; };
    const clearMachines = () => { for (const m of [...g.machines.list]) g.machines.remove(m); };
    const ring = (n, r0, r1_) => {
      const h = g.env.hole;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = r0 + Math.random() * (r1_ - r0);
        g.gnomes.spawn(g.gnomes.pickSpawnType(), new V(h.x + Math.cos(a) * r, 1, h.z + Math.sin(a) * r), { awake: true });
      }
    };
    const Q = new g.camera.quaternion.constructor();
    const U = g.state.upgrades;
    const spots = {
      factory: { setup: () => { U.permit = 5; U.autocrank = 3; U.batch = 2; g.state.factoryAuto = true; }, reset: () => { clearGnomes(); g.factory.rush = 40; tp(-2.9, -5, -7.5, -13); } },
      house: { setup: () => { U.autocrank = 0; g.factory.rush = 0; }, reset: () => { clearGnomes(); g.factory.rush = 0; tp(0, -18, 0, -40); } },
      hole: {
        setup: () => { U.cannon = 1; const h = g.env.hole; g.machines.place('cannon', new V(h.x + 4, 0, h.z), Q.clone()); },
        reset: () => { clearGnomes(); ring(80, 4, 6); const h = g.env.hole; tp(h.x, h.z + 3, h.x, h.z, -0.3); },
      },
      busy: {
        setup: () => {
          clearMachines();
          g.state.holeLevel = 10; g.env.rebuildHole();
          g.state.land = 3; g.env.rebuildLand();
          Object.assign(U, { permit: 5, robot: 12, fan: 3, trampoline: 3, conveyor: 2, magnet: 1, vacuum: 1 });
          const h = g.env.hole;
          for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.machines.place('robot', new V(h.x + Math.cos(a) * 10, 0, h.z + Math.sin(a) * 10), Q.clone()); }
          const tools = ['fan', 'fan', 'fan', 'trampoline', 'trampoline', 'trampoline', 'conveyor', 'conveyor', 'magnet', 'vacuum'];
          tools.forEach((t, i) => { const a = (i / tools.length) * Math.PI * 2 + 0.3; g.machines.place(t, new V(h.x + Math.cos(a) * 6.5, 0, h.z + Math.sin(a) * 6.5), Q.clone()); });
        },
        reset: () => { clearGnomes(); ring(300, 3, 16); g.env.dayClock = 170; g.env.night = 1; g.weather.start(); const h = g.env.hole; tp(h.x, h.z + 6, h.x, h.z, -0.25); },
      },
    };

    if (regime === 'small') {
      // HUD on the title screen: state unchanged, the loop still runs hud.update every frame
      let hudMutations = 0;
      const mo = new MutationObserver((l) => (hudMutations += l.length));
      mo.observe(g.hud.root, { childList: true, characterData: true, attributes: true, subtree: true });
      await frames(60);
      mo.disconnect();
      out.push(JSON.stringify({ regime, hudMutations }));
      // check 9 from a fresh boot: only the title frame and the boot compileAsync (main.ts) ran before this block, no
      // setQ and no compileAsync here, so a material that links on first sight in play shows as programsDelta > 0
      const pBoot = g.renderer.info.programs.length;
      spots.factory.reset();
      g.paused = false;
      rec = [];
      for (let i = 0; i < 600 && rec.length < 120; i++) await frames(1);
      const fresh = rec;
      rec = null;
      const freshDelta = g.renderer.info.programs.length - pBoot;
      out.push(JSON.stringify({
        regime, block: 'fresh', spot: 'factory', q: S.prefs.quality, n: fresh.length, titlePrograms: pBoot, programsDelta: freshDelta,
        links: fresh.flatMap((f) => f.links ?? []), max: r1(Math.max(0, ...fresh.map((f) => f.ms))),
        // probe 2026-10-21 (dev server serving main.ts without the boot compileAsync): the title frame links 30 programs
        // and this view adds 0 in 120 frames either way, so a 0 here cannot prove the boot compile works
        check9: freshDelta > 0 ? 'FAIL' : 'NOT SHOWN: headless factory view links nothing new without the boot compile either',
      }));
      // &freshonly: only the fresh block (the check-9 probe), no spot blocks
      for (const spot of P.has('freshonly') ? [] : ['factory', 'house', 'hole', 'busy']) {
        spots[spot].setup();
        for (const q of ['medium', 'high', 'low']) {
          spots[spot].reset();
          let ab = null;
          if (spot === 'busy' && q === 'medium') {
            // gnome shadows with all 300 gnomes out: GPU time with every gnome mesh casting, then with none
            await setQ(q);
            g.paused = true;
            await frames(5);
            const casters = [...g.gnomes.meshes.values(), ...g.gnomes.parts.values()];
            const was = casters.map((m) => m.castShadow);
            for (const m of casters) m.castShadow = true;
            const on = gpuTime(60);
            for (const m of casters) m.castShadow = false;
            const off = gpuTime(60);
            casters.forEach((m, i) => (m.castShadow = was[i]));
            ab = { on: on.p50, off: off.p50, pct: r1(((on.p50 - off.p50) / on.p50) * 100), gnomes: g.gnomes.list.length };
            g.paused = false;
          }
          const line = await block(spot, q, 30);
          if (ab) line.gnomeShadowAB = ab;
          if (q === 'medium') await shot(`${spot}-medium`);
          out.push(JSON.stringify(line));
        }
      }
      out.push(JSON.stringify({ regime, programsBoot: pBoot, programsEnd: g.renderer.info.programs.length, errors }));
    } else if (regime === 'proxy') {
      // a 33 MP backing store makes the GPU the bottleneck; set the size first, then the quality reads the new DPR
      // &w=&h= override the window for a heavier run (the Mac GPU is not fill-bound at 2560x1440)
      await cdp({ method: 'Emulation.setDeviceMetricsOverride', params: { width: Number(P.get('w') ?? 2560), height: Number(P.get('h') ?? 1440), deviceScaleFactor: 2, mobile: false } });
      await frames(10);
      const header = {};
      for (const q of ['high', 'medium', 'low']) { await setQ(q); header[q] = g.renderer.getPixelRatio(); }
      out.push(JSON.stringify({ regime, dpr: devicePixelRatio, pr: header }));
      for (const spot of ['factory', 'busy']) {
        spots[spot].setup();
        spots[spot].reset();
        await setQ('medium');
        g.paused = false;
        await sleep(3000);
        g.paused = true;
        await frames(5);
        for (const q of ['medium', 'high', 'low']) {
          await setQ(q);
          const gpu = gpuTime(60);
          out.push(JSON.stringify({ regime, spot, q, gpu, ...look(), pixels: buf(), gnomes: g.gnomes.list.length }));
        }
      }
      await cdp({ method: 'Emulation.setDeviceMetricsOverride', params: { width: 640, height: 360, deviceScaleFactor: 1, mobile: false } });
    } else if (regime === 'quality') {
      const res = { boot: look(), dpr: devicePixelRatio };
      for (const q of ['low', 'medium', 'high']) {
        await setQ(q);
        res[q] = { ...look(), nightShade: nightOn(q), gnomeShadow: g.gnomes.meshes.get('classic').castShadow };
      }
      // browser zoom below 100 % (run with DPR=0.8): no quality may draw more pixels than the screen has
      res.prCheck = ['low', 'medium', 'high'].every((q) => res[q].pr === Math.min(q === 'high' ? 1.5 : 1, devicePixelRatio)) ? 'PASS' : 'FAIL';
      // the pause-menu select (title card) right after boot: each step redraws the frozen frame behind the menu
      for (const el of document.querySelectorAll('.menu')) el.style.display = '';
      const sel = document.querySelector('select[name=quality]');
      let draws = 0;
      const r0 = g.renderer.render;
      g.renderer.render = function (...a) { if (g.paused) draws++; return r0.apply(this, a); };
      res.switch = [];
      for (const q of ['medium', 'high', 'low', 'medium']) {
        draws = 0;
        sel.value = q;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        await frames(10);
        res.switch.push({ q, pausedDraw: draws, ...look() });
      }
      res.errors = errors.length;
      out.push(JSON.stringify(res));
    } else if (regime === 'boot') {
      const St = await import('/src/core/state.ts');
      if (P.get('cookie')) document.cookie = `gnome_settings=${encodeURIComponent(JSON.stringify({ quality: P.get('cookie') }))}; path=/`;
      if (P.get('save') === 'noshadows') {
        document.cookie = 'gnome_settings=; max-age=0; path=/';
        St.blockSaves(); // this page must not overwrite the old save
        localStorage.setItem('gnome-boozed-save-v1', JSON.stringify({ ...St.freshState(), settings: { volume: 0.7, shadows: false } }));
      }
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;border:0;z-index:99999';
      f.src = '/' + (P.has('lowfx') ? '?lowfx' : '');
      document.body.appendChild(f);
      for (let i = 0; i < 200 && !f.contentWindow?.gnome; i++) await sleep(100);
      await sleep(1000);
      const w = f.contentWindow;
      const G = w.gnome;
      const FS = await w.eval("import('/src/core/settings.ts')");
      const res = { prefsQuality: FS.prefs.quality, lowfx: FS.lowfx, ...look(G.renderer, G.env.sun), selectDisabled: w.document.querySelector('select[name=quality]')?.disabled ?? null, cookie: decodeURIComponent(document.cookie.match(/gnome_settings=([^;]*)/)?.[1] ?? '') };
      if (P.get('save') === 'noshadows') {
        G.paused = false; // autosave runs every 10 s while playing
        await sleep(11000);
        const saved = JSON.parse(localStorage.getItem('gnome-boozed-save-v1'));
        res.savedSettings = saved.settings;
        res.savedHasShadows = 'shadows' in saved.settings;
      }
      out.push(JSON.stringify(res));
    } else if (regime === 'stats') {
      g.paused = false;
      await sleep(2500);
      const el = () => document.querySelector('.perf-stats');
      const res = { text: el()?.textContent ?? null };
      if (el()) {
        // a hidden tab stops the loop; the first interval after it must not show as a hitch
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        await sleep(1500);
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
        await sleep(1200);
        res.afterHidden = el().textContent;
        res.maxAfterHidden = Number(res.afterHidden.match(/max (\d+) ms/)?.[1]);
        // a 200 ms hitch in play, then 6 s in the pause menu: the line keeps the game's numbers, not the menu's
        await new Promise((r) => requestAnimationFrame(() => { const t = performance.now(); while (performance.now() - t < 200); r(); }));
        await sleep(1200);
        const maxOf = () => Number(el().textContent.match(/max (\d+) ms/)?.[1]);
        res.maxBeforePause = maxOf();
        g.paused = true;
        await sleep(6000);
        res.maxAfterPause = maxOf();
        res.pauseCheck = res.maxBeforePause >= 200 && res.maxAfterPause === res.maxBeforePause ? 'PASS' : 'FAIL';
        g.paused = false;
      }
      out.push(JSON.stringify(res));
    }
  } catch (e) {
    out.push('ERR ' + String((e && e.stack) || e).slice(0, 600));
  }
  window.__done = out.join('\n');
})();
