// The hole's swirl may turn only inside the hole: grass just outside the rim must stay still while the swirl spins.
// Run: DEV_PORT=5197 URL_QUERY= DPR=1 node tools/smoke/smoke.mjs <outDir> tools/smoke/scenario-swirl.js
// Fixed camera and player 3 m from the rim, looking into the hole; only the swirl turns, 20 frames, on hole level 2 and 12.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { window.__shotDone = false; (window.__shots ||= []).push(n); for (let i = 0; i < 100 && !window.__shotDone; i++) await sleep(100); };
const g = window.gnome;
const gl = g.renderer.getContext();
const W = gl.drawingBufferWidth;
const H = gl.drawingBufferHeight;
const V3 = g.camera.position.constructor;
const px = new Uint8Array(W * H * 4);

const render = (eye, look) => {
  g.camera.position.copy(eye);
  g.camera.lookAt(look);
  g.camera.updateMatrixWorld();
  g.renderer.render(g.scene, g.camera);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px.slice();
};
// screen pixels of ground points on a ring of radius k*r around the hole (y = 0, the opening plane)
const ring = (hole, r, ks, eye, look) => {
  g.camera.position.copy(eye);
  g.camera.lookAt(look);
  g.camera.updateMatrixWorld();
  const out = [];
  for (const k of ks) for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const p = new V3(hole.x + Math.cos(a) * r * k, 0, hole.z + Math.sin(a) * r * k).project(g.camera);
    if (p.z > 1 || Math.abs(p.x) > 0.98 || Math.abs(p.y) > 0.98) continue;
    out.push(Math.round((p.x + 1) / 2 * (W - 1)) + Math.round((p.y + 1) / 2 * (H - 1)) * W);
  }
  return [...new Set(out)];
};
const changed = (a, b, idx) => idx.filter((j) => { const i = j * 4; return a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]; }).length;

(async () => {
  const out = [];
  try {
    for (const el of document.querySelectorAll('.menu, .hud')) el.style.visibility = 'hidden';
    // 3 m from the rim looking into the hole, and 0.5 m from the rim looking down at the rim itself
    for (const level of [2, 12]) for (const [dist, lookAt] of [[3, 0.4], [0.5, 1]]) {
      g.state.holeLevel = level;
      g.env.rebuildHole();
      const hole = g.env.hole.clone();
      const r = g.env.holeRadius;
      const eye = hole.clone().add(new V3(0, 1.7, r + dist));
      const look = hole.clone().add(new V3(0, -0.6, r * lookAt));
      g.player.position.set(eye.x, 1, eye.z);
      g.env.update(0);
      const outside = ring(hole, r, [1.02, 1.05, 1.1, 1.2, 1.4], eye, look);
      const inside = ring(hole, r, [0.3, 0.5, 0.7, 0.9], eye, look);
      const f0 = render(eye, look);
      let maxOut = 0, maxIn = 0, total = 0;
      const perFrame = [];
      for (let i = 1; i <= 20; i++) {
        g.env.swirl.rotation.z -= 0.15;
        const f = render(eye, look);
        const o = changed(f0, f, outside);
        perFrame.push(o);
        maxOut = Math.max(maxOut, o);
        maxIn = Math.max(maxIn, changed(f0, f, inside));
        // every changed pixel of the frame: where does its view ray cross the ground plane?
        let n = 0;
        for (let j = 0; j < f.length; j += 4) {
          if (f0[j] === f[j] && f0[j + 1] === f[j + 1] && f0[j + 2] === f[j + 2]) continue;
          const q = j / 4;
          const d = new V3(((q % W) / (W - 1)) * 2 - 1, (Math.floor(q / W) / (H - 1)) * 2 - 1, 0.5).unproject(g.camera).sub(eye);
          const t = -eye.y / d.y;
          if (!(t > 0) || Math.hypot(eye.x + d.x * t - hole.x, eye.z + d.z * t - hole.z) > r * 1.01) n++;
        }
        total = Math.max(total, n);
      }
      out.push(`lvl${level} r=${r} from_rim=${dist}m outside=${maxOut} of ${outside.length} per_frame=${perFrame.join(',')} inside=${maxIn} of ${inside.length} changed_px_outside_rim=${total}`);
      render(eye, look);
      await shot(`swirl-lvl${level}-${dist}m`);
    }
  } catch (e) {
    out.push('ERR ' + String((e && e.stack) || e).slice(0, 400));
  }
  window.__done = out.join(' | ');
})();
