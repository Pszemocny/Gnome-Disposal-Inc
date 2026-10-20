# Wind-up out, Trick Scope in, stacking, no placement over the hole (PP, 2026-10-20)

Plan: `docs/ai-work/2026-10-20-plan-scope-and-placement.md`, section "Plan (orchestrator, final)", items 1-5.

## Gotowe, gdy (from the plan)

1. shop Movement tab: no "Wind-up", "Trick Scope" present; buying sets `upgrades.scope = 1` and takes $300
2. a save with `charge: 1` loads without errors, gets $300 back once (second load: no extra money), and RMB throws instantly
3. without `scope`: holding a gnome shows no trajectory mesh; with `scope`: visible
4. aiming so the path ends in the hole → green; through the hoop into the hole → gold + label contains "BULLSEYE"; from 9 m into the hole → label contains "LONG SHOT"; aiming away → white, no label
5. the predicted landing point is within 0.6 m of where a real throw lands (one throw at Strong Arm 0)
6. placement: a vacuum/cannon ghost held 2 m above the hole centre → BLOCKED; the L-magnet with its base 0.5 m outside the hole edge and the arm over the hole → placeable
7. stacking: a panel aimed at the top of a placed conveyor → ghost rests on the conveyor top (ghost bottom within 0.05 m of the conveyor's top), not BLOCKED, placed; a trampoline on that panel → placed; a gnome dropped on the top trampoline bounces; a ghost pushed into the side of a tool → BLOCKED; aiming at a gnome → the ghost goes to the ground behind it
8. screenshot of the preview in each colour, checked by eye; regression `scenario15-wait.js`, `scenario-magnet-gun.js`, `scenario-trick.js` pass; no exceptions; `npx tsc --noEmit` clean

Scope addition (coordinator, PP on Slack 2026-10-20: "Wywal miotłę, bo nie jest przyjemna w użyciu"): remove the Push Broom.

9. no broom anywhere in the shop, the HUD and the code paths (`grep -rni broom src` → only nothing or comments about its removal); C toggles hands ↔ tractor, without the tractor C shows a toast
10. the tractor is buyable at hole level 3 and works (tractor lines of `scenario-broom.js`, broom lines dropped)
11. a save with `broom: 1` loads without errors and gets $60 back once, with a toast

## Problem

PP: "wind up nie działa poprawnie, trzeba albo to usunąć, albo zmienić, aby zamiast tego kupować ten sniper, czyli pokazywanie trajektorii lotu, ale to powinno lepiej wyglądać niż teraz" and "trzeba zmienić, aby rzeczy można było kłaść na sobie, a nie tylko na ziemi, aby można było tworzyć dziwne contraption". Also: a tool ghost held in the air over the hole was not blocked.

## Summary

Ladder: step 2 (repo) for everything. Rapier `castShape` / `castRayAndGetNormal` / `intersectionsWithShape`, the existing hoop test from `hole.ts`, the existing HUD projection pattern (`wpMark`, bubbles), `outCubic`. No new dependency, no new file in `src`.

- **Wind-up removed** (`upgrades.ts`, `player.ts`, `hud.ts`, `style.css`, `PLAN.md`): no `charge` upgrade, RMB always throws on the press, no charge bar, no wind-up camera dip. `state.ts` `loadState`: a save with `charge` gets $300 once, the key is deleted (gone with the next save), and a toast "Wind-up was removed: $300 refunded." is queued in `loadNotes`; `Hud.update` shows queued notes once the game is unpaused.
- **Push Broom removed** (scope addition): `broom` upgrade, `sweeper.ts` broom branch and view model, `broomGeometry` in `models.ts`, HUD gear line and help text. `Gear` is `'hands' | 'tractor'`; C toggles hands ↔ tractor, without the tractor it toasts "Buy the Plow Tractor in the shop (Movement, hole level 3).". Tractor description no longer says "Upgrade for the broom". A save with `broom` gets $60 once with a toast, same pattern as Wind-up.
- **Trick Scope** (`scope`, Movement, $300, max 1, hole level 1). Without it no path preview at all (beam unchanged). With it, while something is held:
  - a camera-facing ribbon along the predicted path (60 samples of 0.045 s, same physics as before: impulse / mass + current velocity, gravity 20, damping 0.15), 0.16 m wide at the hand tapering to 0.06 m, per-vertex alpha 0.75 fading to about 0.2 at the end and softly starting next to the hand;
  - the path is swept with a 0.25 m ball (about a gnome) against what a gnome collides with (ground, tools, props; not gnomes, not the held bodies), so the landing point is where the gnome first touches something;
  - a flat ring (0.3-0.42 m) on the hit surface, oriented to its normal, pulsing gently (scale 1 ± 0.12);
  - colours: white = miss, green `3aff8a` = into the hole, gold `ffd23f` = into the hole with a trick. Tricks (only for gnomes): SNIPER (≥ 14 m) or LONG SHOT (≥ 8 m) from where the gnome leaves the hand to the hole centre, BULLSEYE when the path crosses the hoop disc (same test as `hole.ts`). Label (DOM `.aim-label`, gold, projected next to the ring) shows them, e.g. "LONG SHOT", "BULLSEYE".
  - fade in/out 0.2 s with `outCubic` on the ribbon, ring and label. No lights.
- **Placement over the hole** (`player.ts`): the old "centre within radius + 0.5 and below 1.2 m" rule is replaced by `footprintOverHole`: the tool's `MACHINE_BOX` projected on the ground (convex polygon, any height) may not reach into the hole by more than `HOLE_EDGE` = 0.15 m. The L-magnet's box is base + post only, so its arm may hang over the hole.
- **Stacking** (`player.ts`): the aim ray ignores gnomes, loose props (chairs, flamingos) and held bodies, so the ghost lands on the ground, a tool, the crate, the house or the desk. The ghost base sits on the hit point (pushed out along the normal as before). On a top face (normal y > 0.7) the box is then dropped from 1 m higher (`STEP_UP`) onto the same object only, so it rests on the highest part under it (the belt rails, not the belt between them); if the drop starts inside something, the ghost stays on the hit point. Overlap test unchanged (shrunk box, 0.02 m gap), so resting on top is allowed and pushing into a side is BLOCKED. Placed tools stay fixed bodies; nothing cascades when a lower tool is removed or moved.
- `machines.ts` needed no change.

Decisions taken here:
- `HOLE_EDGE` 0.15 m: the magnet-arm note places the magnet origin at hole radius + 0.5, so its 0.6 m base reaches 0.1 m into the hole; the plan wants that placement to stay valid. A strict "no overlap" rule would block it.
- "Conveyor top" = the top of its highest collider (rails, 0.70 m); the visual box (`MACHINE_BOX`) goes to 0.86 m but nothing physical is there.
- The trick thresholds 8 m / 14 m are repeated as numbers in `player.ts` (with a comment), because `hole.ts` keeps them inline and is not my file.

Rejected:
- AIR and TRICK in the label: rejected, the plan names only BULLSEYE, LONG SHOT, SNIPER; AIR would make almost every green path gold.
- A dashed line: rejected, the plan allows "ribbon or dashed line"; a ribbon reads at 640x360, dashes on 0.5-1 m segments would flicker.
- `Math.min(1, dt * 12)` in the tractor push (`sweeper.ts`): rejected, older code, not part of this change.

Known limit (not a shortcut, geometry): the throw always goes where you look, so in first person the path lies in the view plane and shows as a short vertical streak above the held gnome. The landing ring, its colour and the trick label carry the information; the old dots had the same limit.

## Work progress

Scenarios in `<scratchpad>/smoke/`: `scenario-scope.js` (runs `run-scope`, `run-scope2`, `run-scope3` with a step filter), `scenario-scope-look.js` (`run-look`), `scenario-tractor.js` (= `scenario-broom.js` without the broom lines), regression `scenario15-wait.js` (now sets `upgrades.scope = 1` before its arc lines), `scenario-magnet-gun.js`, `scenario-trick.js`. Ports 9381-9387, one browser at a time.

- [PASS] 1 shop — `run-scope2` → `"shop":{"hasWind":false,"hasScope":true,"scopeLvl":1,"paid":300}`; screenshot `01-shop-movement.png`.
- [PASS] 2 Wind-up save — real boot in an iframe from localStorage with `charge: 1, broom: 1`, money 50 → `"first":{"money":410,"charge":null,"toasts":["Wind-up was removed: $300 refunded.","The Push Broom was removed: $60 refunded."]}`, RMB: `"heldBefore":"held","afterOneFrame":{"state":"ragdoll","thrown":1,"rightStillDown":true}` (thrown on the press frame, RMB still down), saved by the game's own `beforeunload` → second boot `"second":{"money":410,"toasts":[]}`, `errs1: [], errs2: []`.
- [PASS] 3 visibility — without scope `"arc":false,"land":false` while holding; with scope `"arc":true,"land":true`; fade in over frames 0.58 → 0.88 → 0.93 → 0.96 → 1; fade out after release 1 → 0.98 → 0.88 → 0.58 → hidden (0.2 s at about 0.05 s per frame).
- [PASS] 4 colours — green `3aff8a` at pitch 0.05, thrown → eaten 1; BULLSEYE: gold `ffd23f`, label and DOM "BULLSEYE", thrown → real `bullseyes +1`, eaten 1; LONG SHOT from 9.02 m: gold, label "LONG SHOT", thrown → real `longShots +1`, eaten 1; away: `ffffff`, label "". Screenshots `run-scope2/04-scope-green.png`, `05-scope-gold-bullseye.png`, `06-scope-gold-longshot.png`, `run-scope/07-scope-white-away.png`, `run-look/20-fp-pitch-*.png`, checked by eye: ring on the ground in the right colour, gold label next to it, readable.
- [PASS] 5 accuracy — Strong Arm 0, pitch 0.3: ring at (-8.00, -5.33), gnome centre at the first impact (physics step by step) at (-8.01, -5.62) → 0.29 m (limit 0.6).
- [PASS] 6 hole — vacuum and cannon ghost straight over the hole centre, base 1.83 m up: `blocked: true` (same ghost on open ground: `false`); old rule would not block (centre above 1.2 m). L-magnet origin at R + 0.5 (base 0.1 m over the edge) and base edge 0.5 m outside: both `blocked: false`, drop ring green, placed 1. Screenshots `08-vacuum-over-hole.png` (red ghost), `09-magnet-ghost-at-rim.png`.
- [PASS] 7 stacking — fan aimed at the ground next to the conveyor: `blocked: true`, 2 m further `false`; flat panel aimed at the belt: ghost bottom 0.72, conveyor top (rails) 0.70, gap 0.02, not blocked, placed; trampoline on the panel: base 0.84 (panel top 0.82), not blocked, placed; gnome dropped from 3 m: `boing 1`, up speed 11.9 m/s, rose to 6.05 m; aiming at a gnome 5 m away: ghost on the ground (base 0.02) 5.96 m away, not on the gnome. Screenshots `run-scope3/11-panel-ghost-on-conveyor.png`, `12-stack-conveyor-panel-trampoline.png`, `13-aim-at-gnome.png`.
- [PASS] 8 regression — `scenario15-wait.js` (`run-sp-scenario15-wait`): fan ratio 0.99, arc green at 0.05 and eaten 1, crate 10 inside, hoop bullseye true, parade 16/16, `LOGS:` empty. `scenario-magnet-gun.js` (`run-sp-mg2`): all lines as before, `LOGS:` empty (first run `run-sp-scenario-magnet-gun` hung on `this.flushFlyers is not a function` from a hot reload of `coins.ts` by another session; rerun unchanged passed). `scenario-trick.js`: x8 $58.4, BULLSEYE $66, cap x20 $134, `LOGS:` empty. `npx tsc --noEmit` → exit 0.
- [PASS] 9 no broom — `grep -rni broom src` → only the refund in `state.ts` and one comment in `sweeper.ts`; shop has no `data-buy="broom"`; C without tractor: gear stays `hands`, toast "Buy the Plow Tractor in the shop (Movement, hole level 3)."; with tractor C gives tractor, then hands.
- [PASS] 10 tractor — `scenario-tractor.js`: shop at hole level 3 has Plow Tractor, no broom text, bought for $1500; C cycle `tractor, hands, tractor`; plow 2.6 m pushes the 3 middle gnomes 21.7 m and not the ±1.6 m ones; Wider Plow 3.4 m pushes all 5; normal vs massive 17.15 / 17.25 m; King not moved; back to hands grabs a gnome; a tool hotkey puts the tractor away. (The strafe control line moved a normal gnome 0.04 m, the broom note had 0.66 m; the tractor code is unchanged except the removed broom branch, and the drive tests push as before.)
- [PASS] 11 broom save — see line 2: $60 back once with its toast, second boot no money and no toast.

Self-check: only my files changed (`player.ts`, `sweeper.ts`, `upgrades.ts`, `state.ts`, `hud.ts`, `style.css`, `models.ts` broom model only, `PLAN.md`, this note). No new `Math.min(1, dt`. Fades use `outCubic`; the ring pulse is a continuous gentle sine. No runtime light. No Rapier body changed inside a query callback.
