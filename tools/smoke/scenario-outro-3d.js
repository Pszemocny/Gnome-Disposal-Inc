// 3D outro (The Deep) with the pile of fed armchairs, flamingos and GNOME letters (plan 2026-10-22-plan-outro-3d.md,
// Done when 1-26 with PP's answers of 2026-10-22: no skipping, the heap line always, letters on the pile).
// Run: URL_QUERY='' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=9811 DEV_PORT=<private> node tools/smoke/smoke.mjs <outDir> <this file>
// The top page is Medium (no ?lowfx); Low, daily and the pile variants run in iframes.
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const clickAt = (x, y) => cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 } });
const clickEl = (sel, doc = document) => { const el = doc.querySelector(sel); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return clickAt(r.x + r.width / 2, r.y + r.height / 2); };
// synthetic keydown on a window (untrusted)
const skd = (w, code, k, extra = {}) => w.dispatchEvent(new w.KeyboardEvent('keydown', { code, key: k, ...extra }));

const KEY = 'gnome-boozed-save-v1';
const FED = 'It kept everything you gave.';
const NONE = 'It kept nothing else.';
const g = window.gnome;
const out = [];
const ok = (n, cond, info = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${n} ${info}`);
const line = (doc = document) => doc.querySelector('.deep .deep-line')?.textContent ?? '';
// every .deep-line text in order (THE DEEP included), recorded by an observer from the first frame of the outro
const watchLines = (doc) => {
  const seen = [];
  const mo = new doc.defaultView.MutationObserver(() => { const t = line(doc); if (t && seen[seen.length - 1] !== t) seen.push(t); });
  mo.observe(doc.body, { childList: true, subtree: true });
  return seen;
};
// the lines move on by themselves every 2.6 s: wait for one (40 s covers the whole outro)
const waitLine = async (D, pred, ms = 40000) => { for (let i = 0; i < ms / 100 && !pred(line(D)); i++) await sleep(100); return pred(line(D)); };
const iframe = async (q, top = 99999) => {
  const f = document.createElement('iframe');
  f.style.cssText = `position:fixed;left:0;top:0;width:640px;height:360px;border:0;z-index:${top}`;
  f.src = '/' + q;
  document.body.appendChild(f);
  for (let i = 0; i < 300 && !f.contentWindow?.gnome?.goals; i++) await sleep(100);
  await sleep(800);
  return f;
};
const craft = async (patch) => {
  const { freshState } = await import('/src/core/state.ts');
  const s = freshState();
  for (const [k, v] of Object.entries(patch)) { if (k === 'stats') Object.assign(s.stats, v); else s[k] = v; }
  localStorage.setItem(KEY, JSON.stringify(s));
};
const fallIn = (G) => {
  const h = G.env.hole;
  G.player.body.setTranslation({ x: h.x, y: -5, z: h.z }, true);
  G.player.position.set(h.x, -5, h.z);
};

setTimeout(() => { if (!window.__done) window.__done = out.join('\n') + '\nTIMEOUT'; }, 700000);
(async () => {
  try {
    const { LINKS } = await import('/src/ui/hud.ts');
    const { blockSaves, freshState, loadState, loadNotes } = await import('/src/core/state.ts');
    const store = g.leaderboard.store.constructor.name;
    if (store !== 'LocalStore') throw new Error(`store=${store}: the scenario must never go online`);
    const opens = [];
    window.open = (...a) => (opens.push(a), null);

    // 6 old save without the two counters: both 0, no load note
    {
      const s = freshState();
      delete s.stats.chairs;
      delete s.stats.flamingos;
      const keep = localStorage.getItem(KEY);
      localStorage.setItem(KEY, JSON.stringify(s));
      const n0 = loadNotes.length;
      const l = loadState();
      if (keep === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, keep);
      ok(6, l.stats.chairs === 0 && l.stats.flamingos === 0 && loadNotes.length === n0, `chairs=${l.stats.chairs} flamingos=${l.stats.flamingos} notes=${loadNotes.length - n0}`);
    }
    // 7 rebirth keeps the counters
    {
      const old = freshState();
      old.stats.chairs = 7;
      ok(7, freshState(old).stats.chairs === 7, `kept=${freshState(old).stats.chairs}`);
    }

    // play on the top page (Medium): no intro, FAKELOCK grants the lock
    g.state.seenIntro = true;
    g.state.stats.playTime = 30;
    await clickEl('.menu [data-a="play"]');
    for (let i = 0; i < 100 && g.paused; i++) await frames(1);
    await frames(30);

    // 9 armchair into the hole twice (the second after its respawn), 10 flamingo once, 11 a letter counts nothing
    // (it lands in secrets, which is what puts it on the pile)
    const props = g.props.list;
    const h = g.env.hole;
    const into = async (p) => { p.body.setTranslation({ x: h.x, y: -3, z: h.z }, true); await frames(5); };
    const chair = props.find((p) => p.kind === 'chair');
    await into(chair);
    chair.respawn = 0.01; await frames(2);
    await into(chair);
    ok(9, g.state.stats.chairs === 2, `chairs=${g.state.stats.chairs} paused=${g.paused}`);
    await into(props.find((p) => p.kind === 'flamingo'));
    ok(10, g.state.stats.flamingos === 1, `flamingos=${g.state.stats.flamingos}`);
    const letter = props.find((p) => p.kind === 'letter');
    await into(letter);
    ok(11, g.state.stats.chairs === 2 && g.state.stats.flamingos === 1 && g.state.secrets.includes(`letter-${letter.letter}`), `chairs=${g.state.stats.chairs} flamingos=${g.state.stats.flamingos} secretsHasLetter=${g.state.secrets.includes(`letter-${letter.letter}`)}`);

    // ---- the outro on the top page: level 12, 3 armchairs, 12 flamingos and the letter fed, a coffee link
    g.state.holeLevel = 12;
    g.state.stats.chairs = 3;
    g.state.stats.flamingos = 12;
    LINKS.coffee = 'https://example.invalid';
    const seen = watchLines(document);
    fallIn(g);
    for (let i = 0; i < 60 && !document.querySelector('.deep'); i++) await frames(1);
    const t0 = performance.now();
    await frames(3);
    const c = g.outro.counts;
    const a1 = `active=${g.outro.active} paused=${g.paused} deep=${document.querySelectorAll('.deep').length} bodies=${c.bodies} fallers=${c.fallers} farEyes=${c.farEyes} letters=${c.letters}`;
    const pass1 = g.outro.active && g.paused && document.querySelectorAll('.deep').length === 1 && c.bodies === 900 && c.fallers === 8 && c.farEyes === 6000 && c.letters === 1;

    // 25a black at the start
    await sleep(Math.max(0, 200 - (performance.now() - t0)));
    const fade0 = +getComputedStyle(document.querySelector('.deep-fade')).opacity;
    // 24 the whole frame is the outro: draw calls and triangles
    const info = g.renderer.info.render;
    ok(24, info.calls <= 20 && info.triangles <= 1700000, `calls=${info.calls} triangles=${info.triangles}`);

    // 12 a key after 1 s does not skip; 13 neither does a click (PP: "bez pomijania")
    await sleep(Math.max(0, 1000 - (performance.now() - t0)));
    skd(window, 'KeyX', 'x'); skd(window, 'Space', ' '); await frames(3);
    const afterKey = line();
    ok(12, afterKey === 'You fall.', `afterKey="${afterKey}"`);
    document.querySelector('.deep').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await clickAt(320, 300); await frames(3);
    ok(13, line() === 'You fall.', `afterClick="${line()}"`);
    // 15 F on line 2 pays respects, never advances
    await waitLine(document, (t) => t.startsWith('Past the dirt'), 4000);
    const l2 = line();
    skd(window, 'KeyF', 'f'); await frames(2);
    ok(15, line() === l2 && l2.startsWith('Past the dirt') && document.querySelector('.deep-f')?.textContent === 'Respects paid. Thank you ♥' && opens.length === 1, `lineUnchanged=${line() === l2} respects="${document.querySelector('.deep-f')?.textContent}" opens=${opens.length}`);
    // 14 Esc: no pause menu, the outro stays
    skd(window, 'Escape', 'Escape'); await frames(5);
    const menuHidden = document.querySelector('.menu:not(.intro)').classList.contains('hidden');
    ok(14, document.querySelectorAll('.deep').length === 1 && g.paused && menuHidden && line() === l2, `deep=${document.querySelectorAll('.deep').length} paused=${g.paused} menuHidden=${menuHidden}`);

    // 20 one render per frame, never the yard on top
    {
      const fr = [], calls = [];
      for (let i = 0; i < 10; i++) { await frames(1); fr.push(g.renderer.info.render.frame); calls.push(g.renderer.info.render.calls); }
      const d = fr.slice(1).map((v, i) => v - fr[i]);
      ok(20, d.every((x) => x <= 1) && d.some((x) => x === 1) && calls.every((x) => x <= 20), `calls=[${calls}] dFrame=[${d}]`);
    }
    // 21 drum spins (damped up), roll not constant; 22 faller falls and wraps to the top
    {
      const ang = [], roll = [], fy = [];
      for (let i = 0; i < 10; i++) { await frames(3); ang.push(g.outro.drumAngle); roll.push(g.outro.camera.rotation.z); fy.push(g.outro.fallers[0].y); }
      const up = ang.slice(1).every((v, i) => v > ang[i]);
      const rollMoves = new Set(roll.map((r) => r.toFixed(6))).size > 1;
      ok(21, up && rollMoves, `angle=${ang[0].toFixed(4)}..${ang[9].toFixed(4)} roll=${roll[0].toFixed(5)}..${roll[9].toFixed(5)}`);
      const down = fy.slice(1).every((v, i) => v < fy[i]);
      g.outro.fallers[0].y = -1.5;
      await frames(3);
      const wrapped = g.outro.fallers[0].y;
      ok(22, down && wrapped >= 29, `y=${fy[0].toFixed(2)}..${fy[9].toFixed(2)} wrapped=${wrapped.toFixed(2)}`);
    }
    // 23 eyes blink: alpha 0 somewhere, pair 0 open at least once; far eyes dim with distance (low pair brighter)
    {
      let blinks = 0, open0 = false;
      for (let i = 0; i < 20; i++) {
        await frames(10);
        const col = g.outro.near.col;
        for (let p = 3; p < col.length; p += 8) if (col[p] === 0) blinks++;
        if (col[3] === 1 && col[7] === 1) open0 = true;
      }
      const fp = g.outro.far.pos, fc = g.outro.far.col;
      let lo = -1, hi = -1;
      for (let i = 0; i < fp.length / 3; i += 2) { if (lo < 0 && fp[i * 3 + 1] < 5) lo = i; if (hi < 0 && fp[i * 3 + 1] > 30) hi = i; }
      const bright = (i) => fc[i * 4] + fc[i * 4 + 1] + fc[i * 4 + 2];
      ok(23, blinks > 0 && open0 && lo >= 0 && hi >= 0, `blinks=${blinks} pair0Open=${open0} farLow=${bright(lo).toFixed(2)} farHigh=${bright(hi).toFixed(2)}`);
    }
    // 25b the fade is gone by 4.5 s
    await sleep(Math.max(0, 4500 - (performance.now() - t0)));
    const fade45 = +getComputedStyle(document.querySelector('.deep-fade')).opacity;
    ok(25, fade0 > 0.9 && fade45 < 0.05, `at0.2=${fade0.toFixed(2)} at4.5=${fade45.toFixed(2)}`);
    await sleep(Math.max(0, 6500 - (performance.now() - t0)));
    await shot('outro-eyes');

    // 16 the camera aspect follows a resize
    await cdp({ method: 'Emulation.setDeviceMetricsOverride', params: { width: 800, height: 360, deviceScaleFactor: 1, mobile: false } });
    await frames(3);
    const aspect = g.outro.camera.aspect;
    await cdp({ method: 'Emulation.clearDeviceMetricsOverride', params: {} });
    await frames(3);
    ok(16, Math.abs(aspect - 800 / 360) < 0.01, `aspect=${aspect.toFixed(3)}`);

    // 17 the heap line comes by itself after "It was lonely."; the camera turns down to the pile and back up
    await waitLine(document, (t) => t === FED);
    const prev17 = seen[seen.length - 2];
    await sleep(2000);
    const downPitch = g.outro.camera.rotation.x;
    await shot('outro-heap');
    await waitLine(document, (t) => t.startsWith('You gained'));
    await sleep(2000);
    const upPitch = g.outro.camera.rotation.x;
    ok(17, line().startsWith('You gained') && prev17 === 'It was lonely.' && downPitch < 0 && upPitch > 1.3, `heap="${FED}" before="${prev17}" down=${downPitch.toFixed(3)} up=${upPitch.toFixed(3)} pile=${c.chairs}/${c.flamingos}/${c.letters}`);

    // 1 every frame of text played by itself, heap line included
    await waitLine(document, () => !!document.querySelector('.deep button'));
    await sleep(1300);
    ok(1, pass1 && seen.length === 11 && seen[7] === FED && seen[seen.length - 1] === 'THE DEEP', `${a1} lines=${seen.length}`);
    await shot('outro-final');

    // 18 Be reborn: the leaderboard opens over the running outro (no submit: the rebirth would reload the page)
    document.querySelector('.deep button').click();
    await frames(5);
    const lbOpen = g.leaderboard.isOpen && !document.querySelector('.leaderboard').classList.contains('hidden');
    ok(18, lbOpen && g.outro.active && store === 'LocalStore', `lbOpen=${lbOpen} outroActive=${g.outro.active} store=${store}`);

    // ---- iframes (the top page stops saving)
    blockSaves();

    // 2 Low: fewer bodies and eyes, the lower pile caps, triangle budget; screenshot at about 6 s
    {
      await craft({ seenIntro: true, holeLevel: 12, stats: { playTime: 30, chairs: 100, flamingos: 400 } });
      const f = await iframe('?lowfx'); const D = f.contentDocument; const G = f.contentWindow.gnome;
      D.querySelector('.menu [data-a="play"]').click();
      for (let i = 0; i < 100 && G.paused; i++) await frames(1);
      await frames(10);
      fallIn(G);
      for (let i = 0; i < 60 && !D.querySelector('.deep'); i++) await frames(1);
      await frames(5);
      const k = G.outro.counts;
      const tri = G.renderer.info.render.triangles;
      ok(2, k.bodies === 300 && k.farEyes === 3000 && k.chairs === 60 && k.flamingos === 120 && tri <= 700000, `bodies=${k.bodies} farEyes=${k.farEyes} capChairs=${k.chairs} capFlamingos=${k.flamingos} triangles=${tri} calls=${G.renderer.info.render.calls}`);
      await sleep(6000);
      await shot('outro-low');
      f.remove();
    }

    // 3 + 8 daily: nothing fed, "It kept nothing else.", camera stays up; Be reborn offers the daily board
    {
      localStorage.removeItem(KEY);
      const f = await iframe('?daily'); const W = f.contentWindow; const D = f.contentDocument; const G = W.gnome;
      D.querySelector('.menu [data-a="play"]').click();
      for (let i = 0; i < 100 && G.paused; i++) await frames(1);
      await frames(10);
      G.state.holeLevel = 12;
      const dseen = watchLines(D);
      fallIn(G);
      for (let i = 0; i < 60 && !D.querySelector('.deep'); i++) await frames(1);
      await waitLine(D, (t) => t === NONE);
      await sleep(2000);
      const pitchHeap = G.outro.camera.rotation.x;
      await waitLine(D, () => !!D.querySelector('.deep button'));
      const heapMeshes = (G.outro.heap.chairs ? 1 : 0) + (G.outro.heap.flamingos ? 1 : 0) + (G.outro.heap.letters ? 1 : 0);
      ok(3, dseen.length === 11 && dseen[7] === NONE && heapMeshes === 0 && pitchHeap > 1.4, `lines=${dseen.length} heapLine="${dseen[7]}" heapMeshes=${heapMeshes} pitchOnHeapLine=${pitchHeap.toFixed(3)} daily=${G.state.stats.chairs}/${G.state.stats.flamingos}`);
      const deepF = !!D.querySelector('.deep-f');
      D.querySelector('.deep button').click();
      await frames(5);
      const tab = D.querySelector('.leaderboard .tab.on')?.dataset.tab ?? '';
      const title = D.querySelector('.leaderboard .lb-title')?.textContent;
      ok(8, !deepF && tab.startsWith('daily-') && title === 'SUBMIT YOUR RUN' && G.leaderboard.store.constructor.name === 'LocalStore', `deepF=${deepF} board=${tab} title=${title} store=${G.leaderboard.store.constructor.name}`);
      f.remove();
    }

    // 4 armchairs only, 5 above the cap (Medium), 26 letters only: three iframes side by side, the letters one on top
    {
      const open = async (q, patch, z) => {
        await craft({ seenIntro: true, holeLevel: 12, ...patch });
        const f = await iframe(q, z);
        f.contentWindow.gnome.hud.deep(5, () => {});
        return f;
      };
      // each page reaches its heap line 18.2 s after its own start: wait on all three at once
      const f4 = await open('?lowfx', { stats: { playTime: 30, chairs: 3, flamingos: 0 } }, 99990);
      const w4 = waitLine(f4.contentDocument, (t) => t === FED);
      const f5 = await open('', { stats: { playTime: 30, chairs: 1, flamingos: 400 } }, 99991);
      const w5 = waitLine(f5.contentDocument, (t) => t === FED);
      const f26 = await open('?lowfx', { stats: { playTime: 30, chairs: 0, flamingos: 0 }, secrets: ['letter-G', 'letter-N', 'letter-O'] }, 99999);
      const [D4, D5, D26] = [f4, f5, f26].map((f) => f.contentDocument);
      const [G4, G5, G26] = [f4, f5, f26].map((f) => f.contentWindow.gnome);
      const r4 = await w4.then((hit) => ({ hit, line: line(D4) }));
      ok(4, r4.hit && G4.outro.heap.flamingos === null && G4.outro.counts.chairs === 3, `heapLine="${r4.line}" flamingoMesh=${G4.outro.heap.flamingos} chairs=${G4.outro.counts.chairs}`);
      const r5 = await w5.then((hit) => ({ hit, line: line(D5) }));
      ok(5, r5.hit && G5.outro.counts.flamingos === 300 && G5.outro.heap.flamingos?.count === 300, `flamingoInstances=${G5.outro.heap.flamingos?.count} line="${r5.line}"`);
      f4.remove(); f5.remove();
      const hit26 = await waitLine(D26, (t) => t === FED);
      await sleep(2000);
      const pitch26 = G26.outro.camera.rotation.x;
      await shot('outro-letters');
      ok(26, hit26 && G26.outro.counts.letters === 3 && !!G26.outro.heap.letters && G26.outro.heap.chairs === null && G26.outro.heap.flamingos === null && pitch26 < 0, `letters=${G26.outro.counts.letters} letterMesh=${!!G26.outro.heap.letters} pitchOnHeapLine=${pitch26.toFixed(3)} calls=${G26.renderer.info.render.calls}`);
      f26.remove();
    }
  } catch (e) {
    out.push('ERR ' + String((e && e.stack) || e).slice(0, 400));
  }
  window.__done = out.join('\n');
})();
