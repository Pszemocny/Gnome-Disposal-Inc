// P saves the whole screen (3D frame + HUD, toasts, shop, menus) as PNG plus a JSON of the game state to logs/shots on the dev machine (vite.config.ts), so PP can show what went right or wrong.
import { ctx } from '../core/context';

// in the release build this is assets/index-<hash>.js, which names the build
const BUILD = new URL(import.meta.url).pathname;
const stamps: number[] = [];
// web font CSS inlined once on the first press; '' = fonts could not be fetched, the UI falls back to system fonts
let fontCss: string | null = null;

// The DOM layer (HUD, shop, menus) drawn by html-to-image, loaded on the first press only so the main bundle does not grow.
async function drawUi(frame: HTMLCanvasElement): Promise<void> {
  const { toCanvas, getFontEmbedCSS } = await import('html-to-image');
  const gl = ctx.renderer.domElement;
  if (fontCss === null) fontCss = await getFontEmbedCSS(document.body).catch(() => '');
  const ui = await toCanvas(document.body, {
    filter: (n) => n !== gl,
    style: { background: 'transparent' },
    width: innerWidth,
    height: innerHeight,
    canvasWidth: frame.width,
    canvasHeight: frame.height,
    pixelRatio: frame.width / innerWidth,
    skipAutoScale: true,
    ...(fontCss ? { fontEmbedCSS: fontCss } : { skipFonts: true }),
  });
  frame.getContext('2d')!.drawImage(ui, 0, 0, frame.width, frame.height);
}

async function send(id: string, frame: HTMLCanvasElement, state: Record<string, unknown>): Promise<void> {
  try {
    // a failed UI layer must not lose the 3D frame: save it alone and say why in the JSON
    await drawUi(frame).catch((e: unknown) => (state.uiError = String(e)));
    const blob = await new Promise<Blob | null>((r) => frame.toBlob(r));
    if (!blob) throw new Error('no blob');
    for (const [name, body] of [[`${id}.png`, blob], [`${id}.json`, JSON.stringify(state)]] as const) {
      const r = await fetch(`${import.meta.env.BASE_URL}__shots/${name}`, { method: 'POST', body });
      if (!r.ok) return ctx.hud.toast(`📸 not saved (${name} HTTP ${r.status})`, 'bad');
    }
    ctx.hud.toast(`📸 saved ${id}`, 'good');
  } catch {
    ctx.hud.toast('📸 not saved (no dev server)', 'bad');
  }
}

export const shot = {
  // call after renderer.render and before input.endFrame: the WebGL buffer still holds this frame
  update(now: number): void {
    stamps.push(now);
    if (stamps.length > 61) stamps.shift();
    if (!ctx.input.hit('KeyP')) return;
    // no frame is drawn while paused, and a menu resize may have cleared the buffer
    if (ctx.paused) ctx.renderer.render(ctx.scene, ctx.camera);
    const gl = ctx.renderer.domElement;
    const frame = document.createElement('canvas');
    frame.width = gl.width;
    frame.height = gl.height;
    const c2 = frame.getContext('2d')!;
    // the booze look is a CSS filter on the canvas, not in the WebGL buffer
    c2.filter = gl.style.filter || 'none';
    c2.drawImage(gl, 0, 0);
    const fps = stamps.length > 1 ? Math.round(((stamps.length - 1) * 1000) / (stamps[stamps.length - 1] - stamps[0])) : 0;
    const id = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
    const state: Record<string, unknown> = {
      time: new Date().toISOString(),
      build: BUILD,
      url: location.href,
      fps,
      money: ctx.state.money,
      holeLevel: ctx.state.holeLevel,
      land: ctx.state.land,
      gear: ctx.player.sweeper.gear,
      tool: ctx.player.placing,
      paused: ctx.paused,
      playTime: ctx.state.stats.playTime,
      buffs: ctx.buffs.list().map((b) => b.def.id),
      hud: document.body.innerText.slice(0, 4000),
    };
    void send(id, frame, state);
  },
};
