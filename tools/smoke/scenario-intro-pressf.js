// Intro cards on a new game + "Press F to pay respects" on The Deep (plan 2026-10-21-plan-intro-pressf.md, Done when 1-25).
// Run: FAKELOCK=1 DPR=1 CDP_PORT=9381 DEV_PORT=5177 MAXPOLL=1400 node tools/smoke/smoke.mjs <outDir> <this file>
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const kd = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk } });
const ku = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk } });
const key = (k, code, vk) => cdp(kd(k, code, vk), ku(k, code, vk));
const clickAt = (x, y) => cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 } });
const clickEl = (sel, doc = document) => { const el = doc.querySelector(sel); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return clickAt(r.x + r.width / 2, r.y + r.height / 2); };
const mouse = (type, x, y, clickCount) => ({ method: 'Input.dispatchMouseEvent', params: { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount } });
const dblClickEl = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); const x = r.x + r.width / 2; const y = r.y + r.height / 2; return cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } }, mouse('mousePressed', x, y, 1), mouse('mouseReleased', x, y, 1), mouse('mousePressed', x, y, 2), mouse('mouseReleased', x, y, 2)); };
// synthetic keydown on a window (untrusted: advances cards, cannot grant a lock)
const skd = (w, code, k, extra = {}) => w.dispatchEvent(new w.KeyboardEvent('keydown', { code, key: k, ...extra }));

const KEY = 'gnome-boozed-save-v1';
const g = window.gnome;
const out = [];
const ok = (n, cond, info = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${n} ${info}`);
const card = (doc = document) => doc.querySelector('.intro .menu-card');
const cardText = (doc = document) => card(doc)?.textContent ?? '';
const titleHidden = (doc = document) => doc.querySelector('.menu:not(.intro)').classList.contains('hidden');
const toasts = (doc = document) => [...doc.querySelectorAll('.hud-toasts > *')].map((e) => e.textContent).join('|');
const goal = (doc = document) => doc.querySelector('.hud-goal')?.textContent ?? '';
const locked = (doc = document) => !!doc.pointerLockElement;

// pointer lock: count requests, refuse the next n like the browser does
const lockCalls = [];
const orig = HTMLCanvasElement.prototype.requestPointerLock;
let refuseN = 0;
HTMLCanvasElement.prototype.requestPointerLock = function (...a) {
  lockCalls.push(refuseN > 0 ? 'refused' : 'called');
  if (refuseN > 0) {
    refuseN--;
    setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
    return Promise.reject(new DOMException('simulated refusal', 'NotAllowedError'));
  }
  return orig.apply(this, a);
};
const openCalls = [];
window.open = (...a) => (openCalls.push(a), null);

const iframe = async (q) => {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;border:0;z-index:99999';
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

setTimeout(() => { if (!window.__done) window.__done = out.join('\n') + '\nTIMEOUT'; }, 330000);
(async () => {
  try {
    const { LINKS } = await import('/src/ui/hud.ts');
    const { saveState, blockSaves, freshState } = await import('/src/core/state.ts');
    const { prefs } = await import('/src/core/settings.ts');
    const { Intro } = await import('/src/ui/intro.ts');

    // every card change plays one whisper
    let whispers = 0;
    const whisper0 = g.audio.whisper;
    g.audio.whisper = function (...a) { whispers++; return whisper0.apply(this, a); };

    // 1 + 27 fresh state, START HUSTLING double-clicked: the second press lands on the intro and must not skip card 1
    await dblClickEl('.menu [data-a="play"]'); await sleep(400); await frames(3);
    ok(1, document.querySelector('.intro .logo')?.textContent === 'GNOME DISPOSAL INC.' && g.paused === true && titleHidden(), `logo=${document.querySelector('.intro .logo')?.textContent} paused=${g.paused} titleHidden=${titleHidden()} locks=${lockCalls.length}`);
    ok(27, cardText().includes('Welcome aboard'), `card=${cardText().slice(0, 40)}`);
    await shot('intro-card1');

    // 28 window blurred for 16 s on card 1: the 5 s timer waits, card 1 is still shown on return
    window.dispatchEvent(new Event('blur'));
    await sleep(16000);
    const card28 = cardText();
    window.dispatchEvent(new Event('focus'));
    ok(28, card28.includes('Welcome aboard'), `card=${card28.slice(0, 40)}`);

    // 2 Space on card 1 → card 2, fade-in sampled
    const whispers0 = whispers;
    skd(window, 'Space', ' ');
    const tAdv = performance.now();
    const op = [];
    for (let i = 0; i < 10; i++) { await frames(1); op.push(+getComputedStyle(card()).opacity); }
    ok(2, cardText().includes('Nobody wants them.') && op.some((o) => o > 0 && o < 1), `op=${op.map((o) => o.toFixed(2)).join(',')}`);

    // 12 card 2: flag only at finish, a save keeps false
    saveState(g.state);
    ok(12, g.state.seenIntro === false && localStorage.getItem(KEY).includes('"seenIntro":false'), `seenIntro=${g.state.seenIntro}`);
    // 13 blur on card 2 (focus comes back at once, so the 5 s timer of line 3 restarts right away)
    window.dispatchEvent(new Event('blur')); await frames(3);
    const blur13 = !!document.querySelector('.intro');
    window.dispatchEvent(new Event('focus'));
    ok(13, blur13 && !!document.querySelector('.intro') && titleHidden() && !document.querySelector('.menu:not(.intro) .menu-card.pause'), `intro=${!!document.querySelector('.intro')} titleHidden=${titleHidden()}`);

    // 3 the 5 s timer counts from the manual advance
    await sleep(4500 - (performance.now() - tAdv));
    const at45 = cardText();
    await sleep(800);
    ok(3, at45.includes('Nobody wants them.') && cardText().includes('It pays cash'), `at4.5=${at45.slice(0, 30)} at5.3=${cardText().slice(0, 40)}`);

    // 23 M on a card: the card advances AND mute toggles (mute lands 400 ms later)
    const m0 = prefs.muted;
    await sleep(300); // past the 300 ms input guard of card 3
    skd(window, 'KeyM', 'm');
    await sleep(600);
    ok(23, cardText().includes('Click to start hustling') && prefs.muted !== m0, `card=${cardText().slice(0, 30)} muted ${m0}->${prefs.muted}`);
    g.audio.setMuted(m0);
    // 30 three card changes (Space, timer, M) → three whispers
    ok(30, whispers - whispers0 === 3, `whispers=${whispers - whispers0}`);

    // 4 last card never auto-advances
    await sleep(6000);
    ok(4, cardText().includes('Click to start hustling'), cardText().slice(0, 50));

    // 22 Esc on the last card is ignored
    skd(window, 'Escape', 'Escape'); await frames(5);
    ok(22, !!document.querySelector('.intro') && cardText().includes('Click to start hustling') && titleHidden() && g.paused === true, `intro=${!!document.querySelector('.intro')} paused=${g.paused}`);

    // 26 modifier keys on the last card (Shift, Ctrl, Alt, Cmd, also from Cmd/Alt+Tab) are ignored like Esc
    for (const [code, k] of [['ShiftLeft', 'Shift'], ['ControlLeft', 'Control'], ['AltLeft', 'Alt'], ['MetaLeft', 'Meta']]) skd(window, code, k);
    await frames(5);
    ok(26, !!document.querySelector('.intro') && cardText().includes('Click to start hustling') && g.paused === true, `intro=${!!document.querySelector('.intro')} paused=${g.paused} locks=${lockCalls.length}`);

    // 6 refused lock after the last card: menu stays hidden, paused; W does nothing; a click locks
    refuseN = 1;
    const n0 = lockCalls.length;
    await key('w', 'KeyW', 87); await sleep(400); await frames(3);
    const a6 = `intro=${!!document.querySelector('.intro')} titleHidden=${titleHidden()} paused=${g.paused} calls=${lockCalls.slice(n0)}`;
    const w0 = g.input.wanted; const n1 = lockCalls.length;
    await key('w', 'KeyW', 87); await sleep(300);
    const b6 = `wanted ${w0}->${g.input.wanted} newCalls=${lockCalls.length - n1}`;
    await clickAt(320, 180); await sleep(600); await frames(3);
    ok(6, !document.querySelector('.intro') && titleHidden() && lockCalls[n0] === 'refused' && g.input.wanted === w0 && lockCalls.length - n1 === 1 && locked() && g.paused === false, `${a6} | ${b6} | locked=${locked()} paused=${g.paused}`);
    // 5 (post-conditions on the top page; the mousedown finish runs in an iframe below)
    await sleep(1200);
    const top5 = `seenIntro=${g.state.seenIntro} goal=${goal().includes('Make gnomes')} followToast=${toasts().includes('Follow the GOAL panel')}`;

    // ---- The Deep
    // 14 no link → no line, F does nothing
    LINKS.coffee = '';
    g.hud.deep(5, () => (window.__reborn = true));
    await sleep(3000);
    skd(window, 'KeyF', 'f');
    ok(14, !document.querySelector('.deep-f') && openCalls.length === 0, `deepF=${!!document.querySelector('.deep-f')} opens=${openCalls.length}`);
    document.querySelector('.deep').remove();

    // 24 + 15 with a link: nothing before the second line, the line from 2.6 s on
    LINKS.coffee = 'https://example.test/x';
    g.hud.deep(5, () => (window.__reborn = true));
    await frames(1);
    const f1 = !!document.querySelector('.deep-f');
    await sleep(200);
    skd(window, 'KeyF', 'f');
    ok(24, openCalls.length === 0 && !document.querySelector('.deep-f'), `opens=${openCalls.length} deepF=${!!document.querySelector('.deep-f')}`);
    await sleep(2800);
    const t15 = document.querySelector('.deep-f')?.textContent;
    await shot('deep-press-f');
    // 16 F opens once
    skd(window, 'KeyF', 'f'); await frames(2);
    ok(16, JSON.stringify(openCalls[0]) === JSON.stringify(['https://example.test/x', '_blank', 'noopener']) && document.querySelector('.deep-f')?.textContent === 'Respects paid. Thank you ♥', `${JSON.stringify(openCalls[0])} text=${document.querySelector('.deep-f')?.textContent}`);
    // 17 again and held
    skd(window, 'KeyF', 'f'); skd(window, 'KeyF', 'f', { repeat: true });
    ok(17, openCalls.length === 1, `opens=${openCalls.length}`);
    for (let i = 0; i < 120 && !document.querySelector('.deep button'); i++) await sleep(250);
    ok(15, !f1 && t15 === 'Press F to pay respects' && !!document.querySelector('.deep-f') && !!document.querySelector('.deep button'), `frame1=${f1} at3s=${t15} final=${!!document.querySelector('.deep-f')}`);
    // 25 gap between "THE DEEP" and the button
    await sleep(1300);
    const btn = document.querySelector('.deep button'); const title = document.querySelector('.deep .deep-line');
    const gap = btn.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
    ok(25, gap >= 20, `gap=${gap.toFixed(1)}`);
    await shot('deep-final');
    // 18 Be reborn removes the listener
    btn.click();
    skd(window, 'KeyF', 'f');
    ok(18, window.__reborn === true && openCalls.length === 1, `reborn=${window.__reborn} opens=${openCalls.length}`);
    document.querySelector('.deep').remove();

    // 20 fall in below MAX: coin fountain, no Deep
    g.paused = false;
    g.state.holeLevel = 3;
    const p = g.player.position;
    g.player.body.setTranslation({ x: p.x, y: -5, z: p.z }, true); g.player.position.set(p.x, -5, p.z);
    let deepSeen = false;
    for (let i = 0; i < 60; i++) { await frames(1); if (document.querySelector('.deep, .deep-f')) deepSeen = true; }
    ok(20, !deepSeen && g.player.position.y > -4, `deep=${deepSeen} y=${g.player.position.y.toFixed(1)}`);

    // 21 F still kicks in play
    // stand on open grass away from the hole, then wait until the player is on the ground
    const hp = g.env.hole;
    g.player.body.setTranslation({ x: hp.x + 9, y: 1, z: hp.z + 9 }, true); g.player.position.set(hp.x + 9, 1, hp.z + 9);
    for (let i = 0, y = -99; i < 200; i++) { await frames(5); if (Math.abs(g.player.position.y - y) < 0.01) break; y = g.player.position.y; }
    const d = g.player.dir.clone().setY(0).normalize();
    const at = g.player.position.clone().addScaledVector(d, 1.3);
    const gn = g.gnomes.spawn('classic', at, { tier: 'normal' });
    await frames(90);
    const gInfo = `gnomeAlive=${g.gnomes.list.includes(gn)} state=${gn?.state}`;
    const k0 = g.state.stats.kicked;
    // the synthetic F presses above had no keyup, so Input still holds F down
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', key: 'f' }));
    skd(window, 'KeyF', 'f');
    for (let i = 0; i < 60 && g.state.stats.kicked === k0; i++) await frames(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', key: 'f' }));
    ok(21, g.state.stats.kicked === k0 + 1, `kicked ${k0}->${g.state.stats.kicked} kickCd=${g.player.kickCd?.toFixed(2)} y=${g.player.position.y.toFixed(2)} paused=${g.paused} ${gInfo}`);

    // 9 rebirth keeps seenIntro → no intro
    {
      const keep = g.state;
      g.state = freshState({ ...keep, seenIntro: true });
      const w = new Intro().wanted();
      g.state = keep;
      ok(9, w === false, `wanted=${w}`);
    }

    // ---- iframes (the outer page stops saving)
    blockSaves();
    if (locked()) document.exitPointerLock();
    await sleep(500);

    // 10 + 5 Reset save → intro again; finish by a mousedown on the overlay
    {
      localStorage.removeItem(KEY);
      const f = await iframe('?lowfx'); const W = f.contentWindow; const D = f.contentDocument; const G = W.gnome;
      D.querySelector('.menu [data-a="play"]').click(); await sleep(300);
      ok(10, !!D.querySelector('.intro'), `intro=${!!D.querySelector('.intro')}`);
      // input in the first 300 ms of a card is ignored (double-click guard), so the presses are 350 ms apart
      for (let i = 0; i < 3; i++) { await sleep(350); skd(W, 'Enter', 'Enter'); }
      await sleep(350);
      const last = cardText(D);
      // 29 the intro fades out (opacity sampled every frame) before it is removed
      const fadeOp = []; let sampling = true;
      const sample = () => { const e = D.querySelector('.intro'); fadeOp.push(e ? +W.getComputedStyle(e).opacity : -1); if (sampling) requestAnimationFrame(sample); };
      requestAnimationFrame(sample);
      await clickAt(320, 180); await sleep(800);
      sampling = false;
      ok(29, fadeOp.some((o) => o > 0 && o < 1) && fadeOp[fadeOp.length - 1] === -1, `op=${fadeOp.map((o) => o.toFixed(2)).join(',')}`);
      await sleep(1200);
      ok(5, last.includes('Click to start hustling') && !D.querySelector('.intro') && G.state.seenIntro === true && locked(D) && G.paused === false && goal(D).includes('Make gnomes') && !toasts(D).includes('Follow the GOAL panel'), `last=${last.slice(0, 20)} intro=${!!D.querySelector('.intro')} seen=${G.state.seenIntro} locked=${locked(D)} paused=${G.paused} goal=${goal(D).slice(0, 20)} toasts=${toasts(D)} | top: ${top5}`);
      if (locked(D)) D.exitPointerLock();
      await sleep(300);
      f.remove();
    }

    // 7 CONTINUE: no intro, lock asked at once
    {
      await craft({ seenIntro: true, stats: { playTime: 30 } });
      const f = await iframe('?lowfx'); const D = f.contentDocument; const G = f.contentWindow.gnome;
      D.querySelector('.menu [data-a="play"]').click(); await sleep(300);
      ok(7, !D.querySelector('.intro') && G.input.wanted === true, `intro=${!!D.querySelector('.intro')} wanted=${G.input.wanted}`);
      f.remove();
    }

    // 11 legacy save: no intro, old toast after the lock
    {
      await craft({ seenIntro: false, stats: { playTime: 30 } });
      const f = await iframe('?lowfx'); const D = f.contentDocument; const G = f.contentWindow.gnome;
      await clickEl('.menu [data-a="play"]', D); await sleep(300);
      const noIntro = !D.querySelector('.intro');
      await sleep(1500);
      ok(11, noIntro && locked(D) && toasts(D).includes('Follow the GOAL panel'), `intro=${!noIntro} locked=${locked(D)} toasts=${toasts(D)}`);
      if (locked(D)) D.exitPointerLock();
      await sleep(300);
      f.remove();
    }

    // 8 + 19 daily: no intro, seenIntro untouched; the Deep line works the same
    {
      localStorage.removeItem(KEY);
      const f = await iframe('?daily&lowfx'); const W = f.contentWindow; const D = f.contentDocument; const G = W.gnome;
      D.querySelector('.menu [data-a="play"]').click();
      const seen0 = G.state.seenIntro; const intro0 = !!D.querySelector('.intro');
      await sleep(300);
      ok(8, !intro0 && seen0 === false, `intro=${intro0} seenAtClick=${seen0} later: seen=${G.state.seenIntro} locked=${locked(D)} toasts=${toasts(D)}`);
      const opens = [];
      W.open = (...a) => (opens.push(a), null);
      const L = await W.Function('return import("/src/ui/hud.ts")')();
      L.LINKS.coffee = 'https://example.test/daily';
      G.hud.deep(5, () => {});
      await sleep(3000);
      const has = !!D.querySelector('.deep-f');
      skd(W, 'KeyF', 'f');
      ok(19, has && opens.length === 1 && opens[0][0] === 'https://example.test/daily', `deepF=${has} opens=${JSON.stringify(opens)}`);
      f.remove();
    }
  } catch (e) {
    out.push('ERR ' + String((e && e.stack) || e).slice(0, 400));
  }
  window.__done = out.join('\n');
})();
