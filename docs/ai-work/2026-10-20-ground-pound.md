# Ground pound (feature H)

## Problem

Jumping had no use and the $600 Gnome Boots were dead (finding F11 in `2026-10-20-plan-night-features.md`, card H in 2.2).
Task: Ctrl in the air slams the player down; gnomes around the landing pop up and fly outwards, biased toward the hole.

Gotowe, gdy (headless, from the orchestrator's task):
1. A pound next to 6 gnomes moves each one at least 1.5 m, and each goes up first.
2. With Gnome Boots the radius reaches a gnome at 5 m; the plain pound (4 m) does not.
3. A king does not move.
4. A pound 3 m from the hole edge with gnomes between player and hole puts at least 2 into the hole.
5. No pound on the ground; no pound on the tractor.
6. Cooldown 1 s.
7. Dust ring scale sampled over at least 10 frames eases out.
8. Regression: `zz-scenario15-scope.js` and `scenario-hints-fall.js` pass.
9. No exceptions; `npx tsc --noEmit` clean.

## Summary

Ladder: rung 2 (reuse). The push copies the pattern of `Hole.explode` (collect with `forEachNear`, then `ragdoll` + `setLinvel`),
the ring copies the level-up shockwave ring in `hole.ts`, particles are `fx.dust`, the hint is `hud.firstUse('boots')` with one
`HINTS` and one `GEAR_KEYS` entry. New code is only `src/player/pound.ts` plus a 2-line hook in `player.move`.

## Work progress
- `src/player/pound.ts` (new): class `Pound`. Ctrl (ControlLeft/ControlRight) in the air, not on the tractor, cooldown over:
  0.08 s hop up (vy +3, anticipation), then vy -25 until the player is grounded. On landing: every free gnome within 4 m of
  the feet (5.5 m with Gnome Boots) except kings gets `ragdoll(1.5-2.5 s, 'player')`, vy 6-8 and an outward push
  (6 m/s at the centre, 70 % at the edge, x1.5 with boots), bent toward the hole (weight 0.8) when the hole is within 15 m.
  Gnomes are collected in `forEachNear` first and changed after. Dust ring (outCubic scale and fade, 0.6 s),
  `fx.dust`, `fx.shake(0.25)`, `audio.impact(1, 6)`. Cooldown 1 s from the landing. A slam that ends in the hole
  (player y < 0) is cancelled, so the hole's throw-out is not overridden.
- `src/player/player.ts`: import, field `pound`, one line in `move()` before gravity.
- `src/ui/hud.ts`: help line "Ctrl (in the air) ground pound"; `HINTS.boots` and `GEAR_KEYS.boots`; the hint shows the
  first time the player is in the air with Gnome Boots (`hud.firstUse('boots')`, called from `Pound.update`).
- `src/data/upgrades.ts`: Gnome Boots description names the pound (5.5 m, 1.5x).

Tests (CDP_PORT=9381, scenario `scratchpad/smoke/scenario-pound.js`, last run `pound6.log`, 0 exceptions):
- [PASS] 1. six gnomes — `allUp: true` (vy after impact 5.55-6.88), moved 1.6-4.16 m, `allMoved15: true`.
  The three lowest values are gnomes pushed toward the yard fence 4 m away (test spot -18,-18).
- [PASS] 2. radius — gnome at 5 m: plain pound moved 0 m, with boots 5.61 m.
- [PASS] 3. king — state statue before and after, vy 0, moved 0 m.
- [PASS] 4. hole — player 3 m from the edge, 6 gnomes between: 5 eaten.
- [PASS] 5. ground and tractor — `grounded: true, phase: idle`; tractor in the air: `phase: idle`.
- [PASS] 6. cooldown — Ctrl 0.15 s after the landing: no pound; after 1.05 s: pound starts.
- [PASS] 7. ring — 12 frames sampled, scale 1.119 → 4.2, steps 0.766, 0.628, ... 0.002 (monotone, shrinking = ease out).
  Screenshot `pound3/pound-ring.png` checked by eye: ring visible on the grass, help line shows the new entry.
- [PASS] 8. regression — `zz-scenario15-scope.js` (`pound-reg15.log`) matches the earlier run `gn-s15.txt` apart from
  random counts; `scenario-hints-fall.js` (`pound-hints.log`) matches `final-hints.txt`; 0 exceptions in both.
  Both ran before the last constant change in `pound.ts` (push falloff 0.5 → 0.3), which they do not exercise.
- [PASS] 9. `npx tsc --noEmit` → exit 0; `grep -n "Math.min(1, dt" src/player/pound.ts` → nothing.

Self-check: only the four owned files changed (`events.ts` untouched). No new dependency. The push copies `Hole.explode`.

Rejected:
- Camera dip as follow-through of the slam (animation rule 4): needs another hook in `updateCamera`; the shake and the
  ring carry the landing; the task limits `player.ts` to the hook.

Uncertain:
- Ctrl is a browser modifier: when the player presses W, A, S or D while Ctrl is still down, the browser may run
  Ctrl+W (close tab) or Ctrl+D (bookmark), because the page cannot block Ctrl+W. Pressing Ctrl while already holding W
  does not trigger it. PP chose Ctrl; the fix would be another key (`input.ts` is not in this task).

## Orchestrator follow-up (2026-10-20 05:55)

Ctrl was the orchestrator's choice in the night plan, not PP's, and Ctrl+W can close the game tab mid-play. The pound now uses **J** (`pound.ts`; texts in `hud.ts`, `upgrades.ts`, the legend key table). `scenario-pound.js` rerun with `KeyJ`: six gnomes all up (vy 5.5-6.6) and moved 1.7-4.7 m; ring eases out over 12 frames; boots reach 5 m (plain 0, boots 4.57 m); king stays; 5 of 6 into the hole; `LOGS:` empty; `tsc` clean.
