import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import './ui/style.css';
import { ctx, lvl } from './core/context';
import { freshState, loadState, saveState } from './core/state';
import { applyQuality } from './core/settings';
import { UPGRADES } from './data/upgrades';
import { Input } from './core/input';
import { Audio } from './core/audio';
import { Environment } from './world/environment';
import { Gnomes } from './entities/gnomes';
import { Coins } from './entities/coins';
import { Mushrooms } from './entities/mushrooms';
import { Machines } from './entities/machines';
import { Props } from './entities/props';
import { Factory } from './entities/factory';
import { Goals } from './systems/goals';
import { Contracts } from './systems/contracts';
import { Player } from './player/player';
import { Hole } from './systems/hole';
import { Buffs } from './systems/buffs';
import { Events } from './systems/events';
import { Achievements } from './systems/achievements';
import { Fx } from './systems/fx';
import { Hud } from './ui/hud';
import { Shop } from './ui/shop';
import { Menu } from './ui/menu';
import { Moods } from './systems/moods';
import { Slowmo } from './systems/slowmo';
import { Weather } from './systems/weather';
import { Strike } from './systems/strike';
import { Blueprints } from './ui/blueprints';
import { Legend } from './ui/legend';
import { Leaderboard } from './ui/leaderboard';
import { daily } from './systems/daily';
import { replay } from './systems/replay';
import { installCrashReport, note, watchCanvas } from './ui/crash';
import { shot } from './ui/shot';

installCrashReport();

async function boot(): Promise<void> {
  await RAPIER.init();
  // a daily run starts fresh and never saves (daily.ts blocks saves)
  const state = daily.active ? freshState() : loadState();
  // saves from before a rebalance may hold levels above today's caps
  for (const u of UPGRADES) {
    const bag = u.currency === 'shards' ? state.deep : state.upgrades;
    if (bag[u.id] > u.max) bag[u.id] = u.max;
  }

  // pixel ratio and shadows come from the quality setting (applyQuality, once the sun exists)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('app')!.appendChild(renderer.domElement);
  watchCanvas(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 900);
  const physics = new RAPIER.World({ x: 0, y: -20, z: 0 });
  physics.timestep = 1 / 60;

  Object.assign(ctx, {
    R: RAPIER,
    physics,
    scene: new THREE.Scene(),
    camera,
    renderer,
    state,
    input: new Input(renderer.domElement),
    audio: new Audio(),
    time: 0,
    renderAlpha: 0,
    paused: true,
  });
  ctx.audio.volume = state.settings.volume;
  ctx.fx = new Fx();
  ctx.hud = new Hud();
  ctx.buffs = new Buffs();
  ctx.events = new Events();
  ctx.achievements = new Achievements();
  ctx.hole = new Hole();
  ctx.env = new Environment();
  applyQuality(renderer, ctx.scene);
  ctx.gnomes = new Gnomes();
  ctx.coins = new Coins();
  ctx.mushrooms = new Mushrooms();
  ctx.machines = new Machines();
  ctx.props = new Props();
  ctx.factory = new Factory();
  ctx.goals = new Goals();
  ctx.player = new Player();
  ctx.shop = new Shop();
  // overlays with their own Esc handler come before main.ts registers its Esc listener
  ctx.blueprints = new Blueprints();
  ctx.legend = new Legend();
  ctx.contracts = new Contracts();
  ctx.moods = new Moods();
  ctx.slowmo = new Slowmo();
  ctx.weather = new Weather();
  ctx.strike = new Strike();

  ctx.machines.restore(state.placed);
  // the gun is the default gear once owned (gear itself is not saved)
  if (lvl('magGun')) ctx.player.setGear('magGun');

  // RESUME in the pause menu works like Esc there: a refused lock still resumes with a free cursor
  const menu = new Menu(() => {
    ctx.audio.ensure();
    if (started) resume();
    else ctx.input.lock();
  });
  menu.show('title');
  ctx.leaderboard = new Leaderboard();
  let started = false;
  // the shop, the blueprints panel and the legend pause the game and free the pointer themselves
  const overlayOpen = () => ctx.shop.isOpen || ctx.blueprints.isOpen || ctx.legend.isOpen || ctx.leaderboard.isOpen;

  let lastExit = 0;
  // the browser refuses pointer lock without a click after an Esc exit: the game runs with a free cursor and this hint
  // until a press of any mouse button or a walk key captures it
  const mouseHint = document.createElement('div');
  mouseHint.className = 'click-to-play hidden';
  mouseHint.textContent = 'Click or press W to capture the mouse';
  document.body.appendChild(mouseHint);
  const showMouseHint = () => mouseHint.classList.remove('hidden');
  const resume = () => {
    menu.hide();
    mouseHint.classList.add('hidden');
    ctx.paused = false;
    ctx.hud.root.classList.remove('dim');
    ctx.input.lock();
  };

  // a grant that lands after an overlay opened or after the player paused again is released, the game stays paused
  ctx.input.onLockChange = (locked) => {
    if (locked) {
      if (overlayOpen() || !ctx.input.wanted || document.querySelector('.deep')) return ctx.input.unlock();
      menu.hide();
      mouseHint.classList.add('hidden');
      ctx.paused = false;
      ctx.hud.root.classList.remove('dim');
      if (!started) {
        started = true;
        if (!state.seenIntro) {
          state.seenIntro = true;
          setTimeout(() => ctx.hud.toast('Follow the GOAL panel in the top left corner.', 'info'), 800);
        }
      }
    } else {
      lastExit = performance.now();
      if (!overlayOpen() && !document.querySelector('.deep')) showPause();
    }
  };

  const showPause = () => {
    ctx.input.wanted = false;
    ctx.paused = true;
    ctx.hud.root.classList.add('dim');
    mouseHint.classList.add('hidden');
    menu.show(started ? 'pause' : 'title');
  };
  // a refused lock outside the menus (Esc in the pause menu, closing an overlay) keeps the game running with a free
  // cursor and shows the hint, never the pause menu
  ctx.input.onLockError = () => {
    if (!overlayOpen() && !ctx.input.locked && !menu.visible) showMouseHint();
  };
  const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight']);
  // Esc: locked → unlock (pause via onLockChange); pause menu → resume at once; free cursor → pause. Repeats ignored
  // (held Esc must not toggle). The 200 ms guard skips the exiting Esc when a browser delivers it after
  // pointerlockchange. Overlays handle their own Esc (preventDefault).
  window.addEventListener('keydown', (e) => {
    // repeats on purpose: a held W retries across the browser's short refusal window after an Esc exit
    if (!ctx.paused && !ctx.input.locked && !menu.visible && !overlayOpen() && WALK_KEYS.has(e.code)) ctx.input.lock();
    if (e.code !== 'Escape' || e.repeat || e.defaultPrevented || overlayOpen() || document.querySelector('.deep')) return;
    if (ctx.input.locked) ctx.input.unlock();
    else if (menu.visible && started && performance.now() - lastExit > 200) resume();
    else if (!ctx.paused) showPause();
  });
  // while locked the browser drops the lock itself on blur and onLockChange pauses
  window.addEventListener('blur', () => {
    if (started && !ctx.paused && !ctx.input.locked) showPause();
  });
  // any mouse button captures a free cursor; Input's own mousedown (registered first) ignores it while unlocked
  renderer.domElement.addEventListener('mousedown', () => {
    if (!ctx.input.locked && !menu.visible && !overlayOpen()) ctx.input.lock();
  });

  const save = () => {
    state.placed = ctx.machines.serialize();
    saveState(state);
  };
  window.addEventListener('beforeunload', save);
  setInterval(() => {
    if (!ctx.paused) save();
  }, 10000);

  // while paused only one frame is drawn; anything that changes that frame asks for another
  let redraw = true;
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    redraw = true;
  });
  THREE.DefaultLoadingManager.onLoad = () => (redraw = true); // textures arrive after the title frame

  if (import.meta.env.DEV) (window as unknown as { gnome: typeof ctx }).gnome = ctx;

  const timer = new THREE.Timer();
  timer.connect(document); // resets the clock when the tab comes back, so dt does not jump
  let acc = 0;
  let codeCd = 0;
  let lastFrame = -Infinity;
  let slowNotes = 0;
  const FRAME_MS = 1000 / 60;
  const canvas = renderer.domElement;

  const frame = (now = performance.now()) => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    // 60 fps cap; 15.5 ms so a 60 Hz display with jitter keeps every frame
    if (now - lastFrame < 15.5) return;
    // step on a 60 Hz grid so 75-144 Hz displays still get 60 fps, not every second frame
    lastFrame = Math.min(now, Math.max(lastFrame + FRAME_MS, now - FRAME_MS));
    timer.update(now);
    const rawDt = timer.getDelta();
    const realDt = Math.max(0, Math.min(0.05, rawDt));
    // the open tool wheel slows the game; it damps on real time
    // slow-mo moments scale it too; both damp on real time
    const dt = realDt * ctx.player.wheel.slow(realDt) * ctx.slowmo.scale;
    // during the instant replay the live game is frozen: no system, no physics step, no recording
    replay.update(realDt);
    if (!replay.playing && !ctx.paused) {
      ctx.time += dt;
      state.stats.playTime += realDt;
      ctx.player.update(dt);
      ctx.machines.update(dt);
      ctx.factory.update(dt);
      ctx.gnomes.update(dt);
      ctx.strike.update(dt);
      acc += dt;
      let steps = 0;
      while (acc >= physics.timestep && steps < 3) {
        ctx.gnomes.savePoses();
        ctx.coins.savePoses();
        ctx.props.savePoses();
        ctx.machines.savePoses();
        physics.step();
        acc -= physics.timestep;
        steps++;
      }
      // drop the backlog past 3 steps (no spiral of death), but keep alpha in 0..1
      acc = Math.min(acc, physics.timestep);
      ctx.renderAlpha = acc / physics.timestep;
      ctx.props.update(dt);
      ctx.coins.update(dt);
      ctx.mushrooms.update(dt);
      ctx.hole.update(dt);
      ctx.buffs.update(dt);
      ctx.events.update(dt);
      ctx.weather.update(dt);
      ctx.achievements.update(dt);
      ctx.goals.update();
      ctx.contracts.update(dt);
      // must get real time: during the freeze (scale 0) a scaled dt would never end it
      ctx.slowmo.update(realDt);
      ctx.moods.update(dt);
      ctx.blueprints.update(dt);
      ctx.legend.update();
      daily.update(dt);
      ctx.env.update(dt);
      ctx.fx.update(dt);
      // drawn after every system that can move, spawn or remove a body this frame
      ctx.gnomes.writeInstances();
      ctx.machines.drawCrates();
      ctx.machines.drawFuses();
      replay.record();

      codeCd -= realDt;
      if (ctx.input.consumeTyped('BOOZE') && codeCd <= 0) {
        codeCd = 120;
        ctx.buffs.apply('booze');
        ctx.achievements.unlock('booze');
      }
      if (ctx.input.consumeTyped('GNOMERAIN') && codeCd <= 0) {
        codeCd = 120;
        ctx.events.start('rain');
      }
    } else if (ctx.paused && redraw) {
      // place the camera for the one frame drawn behind the menu
      ctx.player.update(0);
    }
    ctx.hud.update(realDt);
    // a free cursor while playing (refused lock after Esc) must not sit over the crosshair; menus and overlays pause
    canvas.style.cursor = ctx.paused ? '' : 'none';
    canvas.style.filter = ctx.buffs.active('booze') ? `hue-rotate(${Math.sin(ctx.time * 0.8) * 40}deg) saturate(1.5) blur(${0.6 + Math.sin(ctx.time * 2) * 0.4}px)` : '';
    // menus are DOM over the canvas: one frozen frame is enough while paused
    if (!ctx.paused || redraw) {
      renderer.render(ctx.scene, camera);
      redraw = !ctx.paused;
    }
    shot.update(now);
    // measurement for the factory mouse jump (PP 2026-10-20): `tail logs/errors.log` after a 5300 session, or the
    // browser console ("[gnome] mouse-jump", "[gnome] slow-frame") on GitHub Pages
    const shake = +ctx.fx.shakeLevel.toFixed(2);
    for (const j of ctx.input.jumps.splice(0)) note(`mouse-jump ${JSON.stringify({ ...j, dt: +rawDt.toFixed(3), near: ctx.factory.near, paused: ctx.paused, shake })}`);
    // a paused frame says nothing about a jump in play, and `near` is not updated while paused
    if (!ctx.paused && ctx.factory.near && rawDt > 0.1 && slowNotes < 5) {
      slowNotes++;
      note(`slow-frame ${JSON.stringify({ dt: +rawDt.toFixed(3), gnomes: ctx.gnomes.list.length, shake })}`);
    }
    ctx.input.endFrame();
  };
  frame();
}

boot().catch((e) => {
  document.body.innerHTML = `<pre style="color:#fff;padding:20px">Failed to start: ${String(e)}</pre>`;
  throw e;
});
