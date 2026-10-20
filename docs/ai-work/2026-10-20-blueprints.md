# Blueprints: save and load contraptions (package P4)

Interpretation: build P4 from `2026-10-20-plan-night-features.md` (2.3 P4, card D, review focus 2.4). The plan is final (orchestrator). Only the new file `src/ui/blueprints.ts`; the orchestrator adds the wiring to `main.ts` and `context.ts` later (lines below).

Gotowe, gdy:
1. 3 tools placed, SAVE slot 1, `machines.clearAll()`, LOAD slot 1 → 3 tools at the same positions (±0.01 m) and the same rotations.
2. `state.holeLevel++` + `env.rebuildHole()`, LOAD → every tool moved by exactly the hole delta (±0.01 m), saved order kept (a tool stacked on another loads after its support).
3. a tool saved at the rim that the new hole covers → skipped, `.toast` contains "1 tool skipped: it would be in the hole".
4. K (scenario calls `update(dt)` like main.ts would) → panel visible, `ctx.paused === true`; Esc → panel hidden, `ctx.paused === false`, the Esc event is `defaultPrevented` (main.ts's Esc listener ignores it), pause menu stays hidden; the K that closes the panel does not reopen it on the next frame.
5. Z within 10 s of a placement → that tool removed (back in the inventory); Z on a tool placed more than 10 s ago → nothing removed; Z after LOAD → nothing removed (loaded tools are not "a placement").
6. Animation rule 3: a loaded tool's root scale sampled over ≥ 10 frames has a value strictly between 0 and 1 and ends at 1; an undone tool shrinks (value strictly between 1 and 0) and leaves the scene.
7. no exceptions in the page log; `npx tsc --noEmit` clean.

## Problem

The hole moves 1.2 m with every level (and soon to a new anchor with every Land). A contraption of 10-15 tools has to be rebuilt by hand each time. PP will hit this chore first.

## Summary

Ladder: step 2 (reuse). LOAD feeds the saved list to the existing `machines.restore` (it already checks owned and available tools and old saves without a quaternion), SAVE uses `machines.serialize`, the panel reuses the shop's CSS classes (`.shop`, `.shop-win`, `.shop-head`, `.row`, `.buy`, `.x`, `.shop-foot`); the `<style>` element only adds the narrow window and two button colours. Open/close copy `shop.open/close` (pause, unlock/lock, cancel placement, own Esc handler with `preventDefault`).

What the player gets:
- K opens a panel with 3 slots. Each slot has SAVE, LOAD and CLEAR. LOAD and CLEAR are grey on an empty slot.
- SAVE stores every placed tool (type, full 3D position minus the hole centre, full rotation) in `localStorage['gnome-boozed-blueprints']`, in placement order.
- LOAD removes all placed tools, then rebuilds the saved ones around the hole where it is now. A tool whose base would sit inside the hole (`holeDist < holeRadius + 0.6 && y < 1.5`) is skipped, with one toast "N tools skipped: they would be in the hole". Tools the player no longer owns are skipped by `machines.restore`. The panel closes after LOAD, so the player sees the tools pop in.
- Order is kept, so a tool stacked on another loads after its support. A tool whose support was skipped floats (accepted for stacking in `2026-10-20-plan-scope-and-placement.md`).
- Z takes back the tool placed last, only within 10 s of placing it. Tools that existed at boot or came from LOAD are not "a placement". X, G or a LOAD in between make Z do nothing (the tool is checked in `machines.list` first; the module never reads a removed body, only the cached `root`/`pos`).
- Animation rule 3: loaded tools grow from 0 with `outBack` over 0.25 s, removed ones (LOAD clearing, Z) shrink with `1 - inQuad` and then leave the scene; each gets an 8-spark `fx.burst` at its spot.
- Esc or K closes the panel (`preventDefault`, and the closing K is taken out of `input.pressed`, so it does not reopen the panel on the next frame). While open: `ctx.paused`, pointer unlocked, placement ghost cancelled, like the shop.

Rejected:
- a toast for tools skipped because they are not owned: not in the plan; the "loaded: N tools" toast shows the count.
- confirm dialog before LOAD replaces the current layout: not in the plan; Z does not undo a LOAD (plan says Z undoes a placement).

## Wiring for the orchestrator (exact lines)

`src/core/context.ts` (next to the `shop` field, same style as the other fields):
```ts
import type { Blueprints } from '../ui/blueprints';
  blueprints: Blueprints;
```

`src/main.ts`:
```ts
import { Blueprints } from './ui/blueprints';
```
right after `ctx.shop = new Shop();` (before the Esc listener is registered, so the panel's own Esc handler runs first):
```ts
  ctx.blueprints = new Blueprints();
```
in the `if (!ctx.paused) {` block, after `ctx.contracts.update(dt);` (handles K to open, Z to undo and the pop animations):
```ts
      ctx.blueprints.update(dt);
```
the four guards that already test `ctx.shop.isOpen` (replace each line):
```ts
    } else if (!ctx.shop.isOpen && !ctx.blueprints.isOpen && !document.querySelector('.deep')) showPause();
```
```ts
    if (!ctx.shop.isOpen && !ctx.blueprints.isOpen && !ctx.input.locked && !menu.visible) showClickToPlay();
```
```ts
    if (e.code !== 'Escape' || e.defaultPrevented || ctx.shop.isOpen || ctx.blueprints.isOpen || document.querySelector('.deep')) return;
```
```ts
    if (!ctx.input.locked && !menu.visible && !ctx.shop.isOpen && !ctx.blueprints.isOpen) ctx.input.lock();
```
Without the first guard, opening the panel (it unlocks the pointer) would also open the pause menu on top through `onLockChange(false)`.

## Work progress

Scenario: `scratchpad/smoke/scenario-blueprints.js` imports the module (`new Blueprints()`) and calls `update(dt)` itself, like main.ts will.

Commands:
- `CDP_PORT=9354 MAXPOLL=2400 node smoke.mjs run-bp scenario-blueprints.js` → RESULT below, LOGS empty (run 3 times, same values)
- `npx tsc --noEmit` → no output, exit 0
- `grep -n "Math.min(1, dt" src/ui/blueprints.ts` → nothing

Checks:
- [PASS] 1 save/clear/load — `afterClear 0, loaded 3, order conveyor,trampoline,fan, maxPosErr 0, maxQuatErr 0`
- [PASS] 2 level up — hole delta (0.6, 1.039), `loaded 3, order conveyor,trampoline,fan` (trampoline stacked on the conveyor still after it), `maxErr 0`
- [PASS] 3 rim tool — panel saved at r + 0.62 with r = 2.0: same level loads 2 of 2; after the level up (r 2.4) only `fan` loads, toast `["1 tool skipped: it would be in the hole"]`
- [PASS] 4 K/Esc — K: `visible true, paused true`; Esc: `visible false, paused false, defaultPrevented true, pauseMenu false`; K closes: `closedByK true, stillClosedNextFrame true`
- [PASS] 5 Z — within 10 s `undone true`; after 11 s `after10sKept true`; after LOAD `afterLoadKept true`
- [PASS] 6 animation — pop-in `[0, 0.477, 0.797, 0.989, 1.08, 1.099, 1.074, 1.032, 1.003, 1, ...]` (between and overshoot, ends at 1); undo shrink `[0.966, 0.908, ..., 0.183, 0]`, `leftScene true`
- [PASS] 7 no exceptions (LOGS empty), tsc clean

Screenshot `run-bp/blueprints-panel.png` checked by eye: 3 rows, empty slot 3 has grey LOAD/CLEAR (first run showed them coloured: my CSS beat `.buy.poor`; fixed with `:not(.poor)`).

Self-check: one new file, no other `src` file touched; no new dependency; CSS reuses the shop classes, the `<style>` adds 5 rules; no per-frame allocation (the anim list changes only on SAVE/LOAD/Z); no Rapier query callbacks; a save without the key or with broken JSON reads as 3 empty slots; rebirth (`location.reload`) keeps blueprints (own key, by design: they are layouts, not progress).
