// Esc resumes at once (pause menu, shop, overlays) and the game runs with a free cursor when the lock is refused.
// Run: FULL=1 DPR=1 CDP_PORT=9372 MAXPOLL=1600 node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-esc.js
// Headless delivers Esc to the page even while locked (no browser UI to eat it); `browserEsc` mimics Chrome/Brave instead:
// the browser drops the lock and the page never sees the key. `refuse(n)` mimics the browser refusing the next n
// requests (reject + pointerlockerror). `holdNext()` keeps the next request pending until `grant()` sends it for real.
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const cdp = async (...cmds) => { const want = (window.__cdpDone ?? 0) + cmds.length; (window.__cdp ||= []).push(...cmds); for (let i = 0; i < 200 && (window.__cdpDone ?? 0) < want; i++) await sleep(50); };
const kd = (k, code, vk, autoRepeat = false) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, autoRepeat } });
const ku = (k, code, vk) => ({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk } });
const key = (k, code, vk) => cdp(kd(k, code, vk), ku(k, code, vk));
const esc = () => key('Escape', 'Escape', 27);
const clickAt = (x, y) => cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 } });
const rightClickAt = (x, y) => cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 } }, { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 } });
// the pause card is taller than the 360 px viewport: scroll the button into view first
const clickEl = (sel) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return clickAt(r.x + r.width / 2, r.y + r.height / 2); };
const mouseTo = (x, y) => cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y } });

// every beacon the game sends (crash reports and measurement lines), instead of the network
const beacons = [];
navigator.sendBeacon = (u, b) => (beacons.push(String(b)), true);
const notes = (kind) => beacons.map((b) => JSON.parse(b).message).filter((m) => m.startsWith(kind));
// one frame that takes 150 ms of real time
const slowFrame = () => new Promise((r) => requestAnimationFrame(() => { const t = performance.now(); while (performance.now() - t < 150); r(); }));

const ev = [];
const t0 = performance.now();
const T = () => Math.round(performance.now() - t0);
document.addEventListener('pointerlockchange', () => ev.push(`${T()} lockchange locked=${!!document.pointerLockElement}`));
document.addEventListener('pointerlockerror', () => ev.push(`${T()} lockerror`));
const orig = HTMLCanvasElement.prototype.requestPointerLock;
let refuseN = 0;
let held = null;
let hold = false;
HTMLCanvasElement.prototype.requestPointerLock = function (...a) {
  if (refuseN > 0) {
    refuseN--;
    ev.push(`${T()} rPL refused (simulated)`);
    setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
    return Promise.reject(new DOMException('simulated refusal', 'NotAllowedError'));
  }
  if (hold) {
    hold = false;
    held = this;
    ev.push(`${T()} rPL held`);
    return new Promise(() => {});
  }
  ev.push(`${T()} rPL called`);
  const p = orig.apply(this, a);
  p?.then?.(() => ev.push(`${T()} rPL resolved`), (e) => ev.push(`${T()} rPL rejected ${e?.name}`));
  return p;
};
const refuse = (n = 1) => { refuseN = n; };
const holdNext = () => { hold = true; };
// the held request is sent from a trusted keydown (F9), so the browser treats it like the original gesture
window.addEventListener('keydown', (e) => {
  if (e.code === 'F9' && held) { const c = held; held = null; orig.call(c)?.catch?.(() => ev.push(`${T()} late rejected`)); }
}, true);
const grant = () => key('F9', 'F9', 120);
const browserEsc = () => document.exitPointerLock();

const g = window.gnome;
const vis = (sel) => { const el = document.querySelector(sel); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };
const menuName = () => (!vis('.menu') ? 'hidden' : document.querySelector('.menu .menu-card.title') ? 'title' : document.querySelector('.menu .logo')?.textContent);
const locked = () => !!document.pointerLockElement;
const hint = () => (vis('.click-to-play') ? 'visible' : 'hidden');
const dim = () => g.hud.root.classList.contains('dim');
const out = [];
// every step starts with no simulated refusal or held request left over from the previous one
const step = async (name, fn) => { ev.push(`${T()} --- ${name}`); refuseN = 0; hold = false; held = null; try { out.push(`${name} ${await fn()}`); } catch (e) { out.push(`${name} ERR ${String((e && e.stack) || e).slice(0, 300)}`); } };
const settle = async (ms = 400) => { await sleep(ms); await frames(3); };
const gap = () => sleep(1300); // Chromium refuses a re-lock for about 1 s after an exit
// from any running state to "running with a free cursor + hint"
const toFree = async () => {
  if (locked()) { await gap(); await esc(); await settle(); }
  if (!g.paused) { await esc(); await settle(); } // free cursor → pause
  await gap(); refuse(1); await esc(); await settle();
};
const toLocked = async () => { if (!locked()) { if (g.paused) await toFree(); await gap(); await clickAt(320, 180); await settle(); } };

(async () => {
  g.state.upgrades.laptop = 1;
  await step('01_title_esc', async () => { await esc(); await settle(); return `menu=${menuName()} paused=${g.paused}`; });
  await step('00_title_play', async () => { await clickEl('.menu [data-a="play"]'); await settle(); return `locked=${locked()} paused=${g.paused}`; });
  await step('02_esc_keydown_locked', async () => { await gap(); await esc(); await settle(); return `paused=${g.paused} menu=${menuName()}`; });
  await step('03_esc_pause_granted', async () => { await gap(); await esc(); await settle(); return `paused=${g.paused} locked=${locked()} menu=${menuName()} hint=${hint()} dim=${dim()}`; });
  await step('04_browser_exit', async () => { await gap(); browserEsc(); await settle(); return `paused=${g.paused} menu=${menuName()}`; });
  await step('05_esc_pause_refused', async () => {
    await gap(); refuse(1); await esc(); await frames(1);
    const first = `menuNextFrame=${menuName()}`;
    await settle(); await shot('esc-05-free-cursor-pill');
    return `paused=${g.paused} locked=${locked()} menu=${menuName()} hint=${hint()} dim=${dim()} ${first} cursor=${g.renderer.domElement.style.cursor}`;
  });
  await step('05b_walk_free', async () => {
    refuse(1000); // stay free while W is held
    const p0 = g.player.position.clone();
    await cdp(kd('w', 'KeyW', 87)); await sleep(800); await frames(20); await cdp(ku('w', 'KeyW', 87)); await settle();
    const moved = Math.hypot(g.player.position.x - p0.x, g.player.position.z - p0.z);
    return `moved=${moved.toFixed(2)} locked=${locked()} paused=${g.paused}`;
  });
  await step('05c_look_free', async () => {
    await mouseTo(200, 180); await frames(2);
    const y0 = g.player.yaw;
    for (let x = 220; x <= 400; x += 20) { await mouseTo(x, 180); await frames(1); }
    await frames(2);
    const yawDelta = g.player.yaw - y0;
    await esc(); await settle(); // free cursor → pause menu
    const menuAt = menuName();
    const y1 = g.player.yaw;
    const d0 = g.player.ghostDist;
    for (let x = 400; x >= 200; x -= 20) { await mouseTo(x, 180); await frames(1); }
    await cdp({ method: 'Input.dispatchMouseEvent', params: { type: 'mouseWheel', x: 320, y: 180, deltaX: 0, deltaY: 300 } });
    await frames(3);
    const yawDeltaPaused = g.player.yaw - y1;
    refuse(0);
    await gap(); refuse(1); await esc(); await settle(); // back to free cursor
    return `yawDelta=${yawDelta.toFixed(3)} yawDeltaPaused=${yawDeltaPaused} menuWhilePaused=${menuAt} ghostDistPaused=${d0}->${g.player.ghostDist}`;
  });
  await step('06_esc_free', async () => { await esc(); await settle(); return `paused=${g.paused} menu=${menuName()}`; });
  await step('08_click_free', async () => {
    await gap(); refuse(1); await esc(); await settle(); // free cursor again
    const free = `before: paused=${g.paused} locked=${locked()} hint=${hint()}`;
    await gap(); await clickAt(320, 180); await frames(1);
    const lp = g.input.mouse.leftPressed;
    await settle();
    return `locked=${locked()} hint=${hint()} held=${g.player.held ?? 'none'} leftPressed=${lp || g.input.mouse.leftPressed} (${free})`;
  });
  await step('06b_walk_key_locks', async () => {
    await toFree();
    const free = `before: paused=${g.paused} locked=${locked()} hint=${hint()}`;
    await gap(); refuse(3);
    await cdp(kd('w', 'KeyW', 87), kd('w', 'KeyW', 87, true), kd('w', 'KeyW', 87, true), kd('w', 'KeyW', 87, true)); await settle(); await cdp(ku('w', 'KeyW', 87)); await settle();
    return `locked=${locked()} hint=${hint()} refusalsLeft=${refuseN} (${free})`;
  });
  await step('06c_blur_free', async () => {
    await toFree();
    window.dispatchEvent(new Event('blur')); await settle();
    return `paused=${g.paused} menu=${menuName()}`;
  });
  await step('10_shop_esc', async () => {
    await toLocked();
    await gap(); await key('b', 'KeyB', 66); await settle();
    const opened = vis('.shop.skill');
    await gap(); await esc(); await settle();
    const granted = `granted: opened=${opened} shop=${vis('.shop.skill')} paused=${g.paused} menu=${menuName()} locked=${locked()}`;
    await gap(); await key('b', 'KeyB', 66); await settle();
    refuse(1); await esc(); await settle();
    return `shop=${vis('.shop.skill')} paused=${g.paused} menu=${menuName()} hint=${hint()} | ${granted}`;
  });
  await step('10b_shop_b', async () => {
    await key('b', 'KeyB', 66); await settle();
    const opened = vis('.shop.skill');
    refuse(1); await key('b', 'KeyB', 66); await settle(); await frames(5);
    return `shop=${vis('.shop.skill')} paused=${g.paused} reopened=${vis('.shop.skill')} opened=${opened} hint=${hint()}`;
  });
  await step('10c_shop_close_btn', async () => {
    await key('b', 'KeyB', 66); await settle();
    await gap(); await clickEl('.shop.skill [data-close]'); await settle();
    return `locked=${locked()} shop=${vis('.shop.skill')} paused=${g.paused}`;
  });
  await step('15_blueprints_esc', async () => {
    g.blueprints.open(); await settle();
    const opened = g.blueprints.isOpen;
    refuse(1); await esc(); await settle();
    return `open=${g.blueprints.isOpen} paused=${g.paused} hint=${hint()} opened=${opened}`;
  });
  await step('16_legend_esc', async () => {
    g.legend.open(); await settle();
    const opened = g.legend.isOpen;
    refuse(1); await esc(); await settle();
    return `open=${g.legend.isOpen} paused=${g.paused} hint=${hint()} opened=${opened}`;
  });
  await step('23_hint_under_shop', async () => {
    const before = hint();
    await key('b', 'KeyB', 66); await settle();
    const hintHiddenWhileShop = vis('.shop.skill') && hint() === 'hidden';
    refuse(1); await esc(); await settle();
    return `hintHiddenWhileShop=${hintHiddenWhileShop} hintAfterEsc=${hint()} hintBefore=${before}`;
  });
  await step('17_leaderboard_esc', async () => {
    await esc(); await settle(); // free cursor → pause menu
    await clickEl('.menu [data-lb]'); await settle();
    const opened = g.leaderboard.isOpen;
    await esc(); await settle();
    return `lb=${g.leaderboard.isOpen} menu=${vis('.menu') ? 'visible' : 'hidden'} paused=${g.paused} opened=${opened}`;
  });
  await step('18_ach_esc', async () => {
    await clickEl('.menu [data-a="ach"]'); await settle();
    const page = menuName();
    refuse(1); await esc(); await settle();
    return `paused=${g.paused} page=${page} menu=${menuName()}`;
  });
  await step('21_wheel_free', async () => {
    const free = `before: paused=${g.paused} locked=${locked()}`;
    await cdp(kd('Tab', 'Tab', 9)); await sleep(500); await frames(5);
    const r = `wheel=${g.player.wheel.open} timeScale=${g.player.wheel.timeScale.toFixed(2)}`;
    await cdp(ku('Tab', 'Tab', 9)); await settle();
    return `${r} (${free})`;
  });
  await step('20_overlay_race', async () => {
    holdNext(); g.input.lock(); g.shop.open(); await frames(1);
    await gap(); await grant(); await settle(); await settle();
    const r = `shop=${vis('.shop.skill')} paused=${g.paused} locked=${locked()}`;
    refuse(1); await esc(); await settle();
    return `${r} | after Esc: shop=${vis('.shop.skill')} paused=${g.paused}`;
  });
  await step('24_late_grant', async () => {
    const free = `before: paused=${g.paused} locked=${locked()}`;
    holdNext(); await cdp(kd('w', 'KeyW', 87), ku('w', 'KeyW', 87)); await frames(1);
    await esc(); await settle();
    await gap(); await grant(); await settle(); await settle();
    return `menu=${vis('.menu') ? 'visible' : 'hidden'} paused=${g.paused} locked=${locked()} (${free})`;
  });
  await step('22_esc_held', async () => {
    await toLocked();
    await gap(); await key('b', 'KeyB', 66); await settle();
    const opened = vis('.shop.skill');
    await gap();
    await cdp(kd('Escape', 'Escape', 27), ...[1, 2, 3, 4, 5].map(() => kd('Escape', 'Escape', 27, true)), ku('Escape', 'Escape', 27)); await settle();
    return `shop=${vis('.shop.skill')} menu=${menuName()} paused=${g.paused} opened=${opened} locked=${locked()}`;
  });
  await step('25_esc_after_exit_200ms', async () => {
    await toLocked();
    const wasLocked = locked();
    // Firefox-like: the exiting Esc arrives right after pointerlockchange(false)
    document.addEventListener('pointerlockchange', () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })), { once: true });
    await gap(); browserEsc(); await settle();
    return `menu=${menuName()} paused=${g.paused} wasLocked=${wasLocked}`;
  });
  await step('26_resume_btn_refused', async () => {
    await toFree();
    await esc(); await settle(); // free cursor → pause menu
    await gap(); refuse(1); await clickEl('.menu [data-a="play"]'); await settle();
    const refused = `paused=${g.paused} menu=${menuName()} hint=${hint()} dim=${dim()}`;
    await gap(); await esc(); await settle();
    await gap(); await clickEl('.menu [data-a="play"]'); await settle();
    return `${refused} | granted: locked=${locked()} menu=${menuName()} hint=${hint()}`;
  });
  await step('27_pill_clear', async () => {
    g.state.upgrades.magGun = 1; // a second gear: the gear line shows (sweeper.owned() > 1)
    await toFree();
    for (let i = 0; i < 50 && getComputedStyle(document.querySelector('.hud-gear')).display === 'none'; i++) await frames(1);
    g.state.seenHints = g.state.seenHints.filter((id) => id !== 'magGun');
    g.hud.firstUse('magGun');
    await frames(3);
    const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const measure = (label) => {
      const p = document.querySelector('.click-to-play').getBoundingClientRect();
      const parts = ['.hud-gear', '.hud-hint', '.hud-hole', '.hud-left', '.hud-money', '.hud-hotbar'].map((s) => `${s.slice(5)}=${Math.round(area(p, document.querySelector(s).getBoundingClientRect()))}`);
      const h = document.querySelector('.hud-hole').getBoundingClientRect();
      return `${label}: ${parts.join(' ')} pill=${Math.round(p.left)},${Math.round(p.top)},${Math.round(p.width)}x${Math.round(p.height)} holeBottom=${Math.round(h.bottom)} gearShown=${getComputedStyle(document.querySelector('.hud-gear')).display !== 'none'} hint=${hint()}`;
    };
    const small = measure('640');
    await shot('esc-27-pill');
    await cdp({ method: 'Emulation.setDeviceMetricsOverride', params: { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false } });
    await settle();
    const big = measure('1280');
    await shot('esc-27-pill-1280');
    await cdp({ method: 'Emulation.setDeviceMetricsOverride', params: { width: 640, height: 360, deviceScaleFactor: 1, mobile: false } });
    await settle();
    return `${small} | ${big}`;
  });
  await step('28_reenter_delta', async () => {
    await toFree();
    await mouseTo(320, 180); await frames(2);
    const y0 = g.player.yaw;
    await mouseTo(-2, 180); await frames(1);
    await mouseTo(630, 180); await frames(2);
    const jump = g.player.yaw - y0;
    const y1 = g.player.yaw;
    await mouseTo(610, 180); await frames(2);
    return `jump=${jump.toFixed(3)} after=${(g.player.yaw - y1).toFixed(3)} paused=${g.paused} locked=${locked()}`;
  });
  await step('29_right_btn_free', async () => {
    await toFree();
    await gap(); await rightClickAt(320, 180); await frames(1);
    const rp = g.input.mouse.rightPressed;
    await settle();
    return `locked=${locked()} hint=${hint()} held=${g.player.held ?? 'none'} rightPressed=${rp || g.input.mouse.rightPressed}`;
  });
  // stand 4 m in front of the chute, inside the factory's `near` radius (4.5 m)
  const nearFactory = () => {
    const fp = g.factory.pos;
    const fy = Math.atan2(-fp.x, -fp.z);
    const w = { x: fp.x + 4 * Math.sin(fy), z: fp.z + 4 * Math.cos(fy) };
    g.player.body.setTranslation({ x: w.x, y: 1, z: w.z }, true);
    g.player.position.set(w.x, 1, w.z);
  };
  await step('30_slow_frame_paused', async () => {
    if (g.paused) { await gap(); await clickEl('.menu [data-a="play"]'); await settle(); }
    nearFactory(); await frames(3);
    const nearRunning = g.factory.near;
    for (let i = 0; i < 3 && !g.paused; i++) { await gap(); await esc(); await settle(); }
    const n0 = notes('slow-frame').length;
    for (let i = 0; i < 3; i++) { await slowFrame(); await frames(1); }
    return `slowWhilePaused=${notes('slow-frame').length - n0} paused=${g.paused} near=${nearRunning}`;
  });
  await step('31_shake_in_lines', async () => {
    if (g.paused) { await gap(); await clickEl('.menu [data-a="play"]'); await settle(); }
    nearFactory(); await frames(3);
    const n0 = notes('slow-frame').length;
    g.fx.shake(0.7); await slowFrame(); await frames(1);
    const l = notes('slow-frame').slice(n0).map((s) => JSON.parse(s.slice(11)));
    return `shake=${l.at(-1)?.shake} lines=${l.length} paused=${g.paused} near=${g.factory.near}`;
  });
  // the deep pauses the game for good: keep it last
  await step('19_deep_esc', async () => {
    g.hud.deep(1, () => {}); await settle();
    await esc(); await settle();
    return `deep=${!!document.querySelector('.deep')} paused=${g.paused}`;
  });
  window.__done = '\n' + out.join('\n') + '\nEV:\n' + ev.join('\n');
})();
