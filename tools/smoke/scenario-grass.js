// Static grass by the hole must not change while the player walks: the sun's shadow camera follows the player,
// and a sub-texel move of that camera makes shadow edges crawl ("swimming").
// Run: URL_QUERY= DPR=1 node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-grass.js
// The camera stays fixed; only the player position (which the sun follows) moves 1 cm per frame for 20 frames.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const g = window.gnome;
const gl = g.renderer.getContext();
const W = gl.drawingBufferWidth;
const H = gl.drawingBufferHeight;
const hole = g.env.hole.clone();
const eye = hole.clone().add(new g.camera.position.constructor(0, 1.7, 3));
const look = hole.clone().add(new g.camera.position.constructor(0, 0, 1));
const base = { x: eye.x, y: 1, z: eye.z };
const px = new Uint8Array(W * H * 4);
// one synchronous step: move the player, let the sun follow, render with a fixed camera, read the frame back
const frame = (dx) => {
  g.player.position.set(base.x + dx, base.y, base.z);
  g.env.update(0);
  g.camera.position.copy(eye);
  g.camera.lookAt(look);
  g.renderer.render(g.scene, g.camera);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px.slice();
};
// 50x50 patch of grass between the camera and the hole, lower middle of the screen
const P = { x0: Math.round(W / 2 - 25), y0: Math.round(H * 0.15), n: 50 };
const patch = (f) => {
  let r = 0, gg = 0, b = 0;
  for (let y = P.y0; y < P.y0 + P.n; y++) for (let x = P.x0; x < P.x0 + P.n; x++) { const i = (y * W + x) * 4; r += f[i]; gg += f[i + 1]; b += f[i + 2]; }
  const k = P.n * P.n;
  return [r / k, gg / k, b / k].map((v) => Math.round(v * 100) / 100);
};
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };

(async () => {
  const out = [];
  try {
    out.push(`shadows=${g.renderer.shadowMap.enabled} map=${g.env.sun.shadow.mapSize.x} canvas=${W}x${H}`);
    frame(0);
    const f0 = frame(0);
    out.push(`same_pose_rerender_changed_px=${diff(f0, frame(0))}`);
    const samples = [];
    let maxChanged = 0;
    const perFrame = [];
    let prev = f0;
    for (let i = 1; i <= 20; i++) {
      const f = frame(i * 0.01);
      samples.push(patch(f).join('/'));
      maxChanged = Math.max(maxChanged, diff(f0, f));
      perFrame.push(diff(prev, f));
      prev = f;
    }
    out.push(`changed_px_vs_previous_frame=${perFrame.join(',')}`);
    const lum = samples.map((s) => s.split('/').map(Number).reduce((a, v) => a + v, 0) / 3);
    out.push(`patch0=${patch(f0).join('/')}`);
    out.push(`patch_lum_spread=${(Math.max(...lum) - Math.min(...lum)).toFixed(2)} distinct_patch_values=${new Set(samples).size}`);
    out.push(`max_changed_px_vs_frame0=${maxChanged} of ${W * H}`);
    out.push(`samples=${samples.join(' ')}`);
    // where the change sits: changed pixels per 50x50 cell (y counted from the bottom), top 5 cells
    const cells = new Map();
    const fN = frame(0.2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (f0[i] !== fN[i] || f0[i + 1] !== fN[i + 1] || f0[i + 2] !== fN[i + 2]) { const c = `${Math.floor(x / 50) * 50},${Math.floor(y / 50) * 50}`; cells.set(c, (cells.get(c) ?? 0) + 1); }
    }
    out.push(`changed_cells_after_20cm=${[...cells].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `${c}:${n}`).join(' ')}`);
    // the shadow still follows the player: after a 10 m walk the sun target is within one texel of the player
    frame(10.003);
    const sc = g.env.sun.shadow.camera;
    const texel = (sc.right - sc.left) / g.env.sun.shadow.mapSize.x;
    const t = g.env.sun.target.position;
    const off = Math.hypot(t.x - (base.x + 10.003), t.z - base.z);
    out.push(`follow=${off <= texel ? 'ok' : 'FAIL'} offset=${off.toFixed(4)} texel=${texel.toFixed(4)}`);
    for (const el of document.querySelectorAll('.menu, .hud')) el.style.visibility = 'hidden';
    frame(0);
    await shot('grass-hole');
  } catch (e) {
    out.push('ERR ' + String((e && e.stack) || e).slice(0, 400));
  }
  window.__done = out.join(' | ');
})();
