# Hand-tool wheel: Hands / Magnet Gun / Tractor / Blower, C = current tool ↔ hands

Interpretation: execute `## Plan (plan-senior, final)` of `docs/ai-work/2026-10-20-plan-gear-wheel.md` with PP's decisions: 1 = b (the Tab wheel keeps the placeables past the tenth, the Cleaning Robot stays on the wheel, no `-`/`=` keys), 2-5 = a. PP's final C rule ("klawisz c -> obecne narzedzie rece i tyle tab do zmiany narzedzia") replaces R2: holding any gear other than hands, C gives hands and the game remembers that gear as `lastGear`; on hands C gives `lastGear` (if none yet or no longer owned: the Magnet Gun if owned, else nothing). Tab is the only way to change which tool. The HUD gear line shows the C target from the same rule. Extra item from the brief: held gnomes say nothing while the Trick Scope glass (Lvl 2+) is shown.

## Gotowe, gdy

Lines from the plan's `### Done when`, rewritten where PP's C rule changes them (G5, G6, G14, H1, T1). All run locally: dev server 5199, headless scenario `scenario-gear-wheel.js` in the session scratchpad, grep. Never prod.

- G1: scenario → `C: gear=hands, gun y samples strictly between rest and rest-0.3, visible=false at frame<=15, swarm=0, held=null while LMB held`.
- G2: scenario → `hands+LMB: held.gnome set, swarm=0, panel "MAGNET · ..."`.
- G3: scenario → `hands reach=7+1.2*dish, grabbed<=1 of 10`.
- G4: scenario → `magGun+LMB: swarm>=2, gun.visible=true`.
- G5: scenario → `gun+tractor+blower: C from hands = magGun, C = hands; wheel tractor, C = hands, C = tractor; wheel blower, C = hands, C = blower`.
- G6: scenario → `nothing owned: C → gear=hands, toast "Take a tool from the Tab wheel first (buy the Magnet Gun, the Plow Tractor or the Leaf Blower in the shop). C then switches it with your hands."`.
- G7: scenario → `gun only: hands,magGun,hands`.
- G8: scenario → `setGear(tractor) with swarm 5: swarm=0, all !held, tractor visible`.
- G8b: scenario → `setGear(blower) LMB held, swarm 5: swarm=0 same frame and +10 frames, ragdolled>=1`.
- G9: scenario → `magGun + key 2: placing=trampoline gear=magGun gun.visible=false; Q: gun.visible=true within 15 frames`.
- G10: scenario → `tractor + key 2: gear=hands placing=trampoline`.
- G11: scenario → `magGun=0 with gear magGun: gear=hands next frame`.
- G12: scenario (reload) → `boot with magGun=1: gear=magGun, seenHints without magGun`; `tractor=1 magGun=0: gear=hands`.
- G13: scenario → `shop open, buy magGun: gear=magGun, toast "Magnet Gun bought! C or hold Tab switches between hands and the gun.", seenHints without magGun; close + LMB: hint title "Magnet Gun" opacity>0`.
- G14: scenario → `tractor only: C from hands → toast, gear=hands; wheel tractor, C = hands, C = tractor`.
- H1: scenario → `gear line: only hands owned = hidden; gun owned on hands "HANDS · C: Magnet Gun"; gun "MAGNET GUN · C: Hands"; tractor "PLOW TRACTOR · plow 2.6 m · C: Hands"; after that, hands "HANDS · C: Plow Tractor"; blower "LEAF BLOWER · 6.0 m · C: Hands"; tractor owned, no gun, fresh hands "HANDS · hold Tab"; sack display hands/gun "" tractor/blower "none"`.
- W1: scenario → `wheel items=hands,magGun,tractor,blower,robot, .wslice=5, robot .c="1/1"`.
- W2: scenario → `nothing owned: items=hands icon ✋; with the gun: hands ✋, magGun 🧲`.
- W3: scenario → `gear tractor, release on magGun: gear=magGun open=false timeScale=1`.
- W4: scenario → `placing fan, release on hands: placing=null gear=hands`.
- W5: scenario → `placing fan, gear magGun, release on magGun: placing=null gear=magGun`.
- W6: scenario → `.wslice.on index = items.indexOf(gear); placing robot: .on = robot index`.
- W7: scenario → `Tab tap placing fan: index=-1, placing=fan, gear=magGun; Tab tap placing robot: placing=robot`.
- W8: scenario → `gear magGun, release on robot: placing=robot gear=magGun gun.visible=false`.
- K1: scenario → `Digit1..Digit0: placing=TOOL_IDS[i] x10; hotbar k=1..0`.
- K2: scenario → `robot slot .k=""; buy robot toast "Cleaning Robot bought! Open the tool wheel (hold Tab) to place it."; Minus: placing unchanged`.
- K3: `grep -rn "TOOL_KEYS\|more placeable tools than hotbar keys" src` → 0 lines.
- K4: `grep -rn "'Minus'\|'Equal'" src` → 0 lines.
- T1: `grep -c "hands ↔ current tool" src/ui/hud.ts src/ui/legend.ts` → 1 each; `grep -n "C</b> switches between hands and your tool" src/ui/menu.ts` → 1 line; `grep -c "back to hands" src/ui/hud.ts` → 2; `grep -n "current tool ↔ hands" docs/PLAN.md` → 1 line; `grep -c "tool wheel (hold Tab)" src/ui/shop.ts` → 1; `npx tsc --noEmit` → exit 0.
- Q1 (scope glass): scenario → `scope=2, hands hold 1 gnome 8 s: speech calls for it = 0; scope=1, same: >= 1`.
- Regression: scenario-gun-pull.js (with `setGear('magGun')` added), scenario-magnet-gun.js (same), scenario-scope-levels.js, zz-scenario15-scope.js, scenario-fuses.js, shot.js → no new failures, no exceptions.

## Problem

With the Magnet Gun owned the player could never go back to bare hands: hands were the gun. PP (2026-10-20): placeables on 1-0, hand tools incl. Hands on Tab, the robot stays on the wheel, and C toggles the current tool with bare hands; Tab is the only way to change which tool.

## Summary

- `src/player/sweeper.ts`: `Gear` gains `magGun` (id = upgrade id); `GEARS` table (label, icon) feeds the wheel and the HUD gear line; `owned()`, `grabs` getter, `lastGear`; `next()` = PP's C rule.
- `src/player/player.ts`: every gun decision reads `gear === 'magGun'` instead of ownership (pull, view model, cone, reach, grab branch, LMB hint); `setGear` always drops, cancels placement, blocks LMB until release and stores `lastGear`; `selectTool` keeps the gun (puts away only the tractor and the blower); new C toast.
- `src/player/wheel.ts`: slices = owned gears from `GEARS`, then placeables from the 11th on (the robot); picking a gear always cancels placement.
- `src/ui/hud.ts`: `firstUse` does nothing while paused (shop, menu, boot), so the hint is not used up behind an overlay; gear line on every gear when a second one is owned (`<TOOL>[ · detail] · C: <target>` or `· hold Tab`); sack panel for hands and gun; gun panel only with the gun in hand; key texts.
- `src/ui/shop.ts`: buying the gun puts it in hand plus a toast. `src/main.ts`: boot with the gun owned starts with it.
- `src/ui/legend.ts`, `src/ui/menu.ts`, `docs/PLAN.md`, `CHANGELOG.md`: texts.
- `src/entities/gnomes.ts`: `heldQuiet()` = the batch 1 quiet-swarm guard plus `lvl('scope') >= 2`; used by the grab line and the struggle line.

### Ladder

- `GEARS`, `owned()`, `grabs`, `lastGear`: rung 5 (one line each), reusing `ORDER`/`next()`; one table so C, Tab and the HUD line cannot disagree.
- Wheel, hotbar, shop toasts for the robot: rung 2 (existing code kept, only the gear slices change).
- Scope quiet: rung 2 (batch 1 guard extended, not duplicated).

### Odstępstwa (deviations from the plan)

- C rule: PP's final rule (current tool ↔ hands, `lastGear`) instead of R2 ("back to the magnet"). Texts follow it: tractor/blower hints say "C back to hands", help/legend say "hands ↔ current tool", gear line `C: Hands` on any tool. G5/G14/H1/T1 lines rewritten accordingly.
- G6 toast: one text for "nothing to switch to", because with PP's rule it also fires when the tractor is owned but never taken: "Take a tool from the Tab wheel first (buy the Magnet Gun, the Plow Tractor or the Leaf Blower in the shop). C then switches it with your hands."
- Gear line labels come from `GEARS` (`PLOW TRACTOR`, `LEAF BLOWER`), not the plan's `TRACTOR`/`BLOWER`, matching PP's own example `LEAF BLOWER · C: Hands`.
- `src/entities/gnomes.ts` edited for the extra brief item (not in the plan's file set).

### Rejected

- Saving `gear`/`lastGear`: the save format stays unchanged (plan, decision 3 = a: boot re-arms the gun instead).
- Updating the other one-off probes in the scratchpad (`diag-mg.js`, `probe-*.js`, ...): plan R5, nobody reruns them.

## Work progress

Scenario: `<scratchpad>/smoke/scenario-gear-wheel.js`, run `CDP_PORT=9396 MAXPOLL=2400 node smoke.mjs out-gear-wheel-final scenario-gear-wheel.js` → `RESULT` with every pass flag true, 0 exceptions. Regression copies with `g.player.setGear('magGun')` after each gun upgrade line: `zz-gw-gun-pull.js`, `zz-gw-magnet-gun.js`, `zz-gw-scope-levels.js` (in `reset`).

### Gotowe, gdy: results

- [PASS] G1 — `G1: gear=hands, ys -0.222 … -0.24, -0.257, -0.28, -0.31, -0.347, -0.394, -0.452 (monotone down, several strictly between -0.22 and -0.52), invisibleAt=10, swarmAfterC=0, heldWhileLmb=null`.
- [PASS] G2 — `held=classic swarm=0 gunVisible=false panel="MAGNET · Garden Gnome normal"`.
- [PASS] G3 — `reach=9.4 (7+1.2*2), grabbed=1 of 10`.
- [PASS] G4 — `swarm=10 gunVisible=true`.
- [PASS] G5 — `a=[hands,magGun,hands] b=[tractor,hands,tractor] c=[blower,hands,blower]`.
- [PASS] G6 — `gear=hands toast="Take a tool from the Tab wheel first (...) C then switches it with your hands."`.
- [PASS] G7 — `[hands,magGun,hands]`.
- [PASS] G8 — `swarmAtSwitch=5 swarm=0 heldFlags=[false x5] tractorVisible=true`.
- [PASS] G8b — `inBall=5 same=0 later=0 pushed=5` (speed gain along the view > 2 m/s in 10 frames; they were flying towards the player when dropped).
- [PASS] G9 — `placing=trampoline gear=magGun gunVisible=false; Q: backAt=0`.
- [PASS] G10 — `gear=hands placing=trampoline`.
- [PASS] G11 — `gear=hands`.
- [PASS] G12 — same-origin iframe boot from the save: `magGun=1 → gear=magGun seenMagGun=false; tractor=1 → gear=hands`.
- [PASS] G13 — `gear=magGun toastHas=true seen=false; after close + LMB title="Magnet Gun" opacity 0.70`.
- [PASS] G14 — `gear0=hands toast "Take a tool…", seq=[tractor,hands,tractor]`.
- [PASS] H1 — `handsOnly=hidden; "HANDS · C: Magnet Gun"; "MAGNET GUN · C: Hands"; "PLOW TRACTOR · plow 2.6 m · C: Hands"; "HANDS · C: Plow Tractor"; "LEAF BLOWER · 6.0 m · C: Hands"; "HANDS · hold Tab"; sack ""/""/none/none`. Screenshot `out-gear-wheel-final/gear-line-gun.png` checked by eye: line centred above the hotbar, no overlap.
- [PASS] W1 — `items=hands,magGun,tractor,blower,robot slices=5 robotC="1/1"`. Screenshot `wheel-five.png` checked by eye: five slices, robot highlighted with 1/1.
- [PASS] W2 — `a="hands✋" b="hands✋,magGun🧲"`.
- [PASS] W3 — `gear=magGun open=false timeScale=1`.
- [PASS] W4 — `placing=null gear=hands`.
- [PASS] W5 — `gearBefore=magGun placing=null gear=magGun`.
- [PASS] W6 — `onIdx=0 (hands) off=0; placing robot onRobot=4`.
- [PASS] W7 — `fan: idx=-1 placing=fan gear=magGun; robot: placing=robot`.
- [PASS] W8 — `placing=robot gear=magGun gunVisible=false`.
- [PASS] K1 — `placed=box..blackhole (10) ks=1,2,3,4,5,6,7,8,9,0`.
- [PASS] K2 — `robotK="" toastOk=true; Minus: placing null → null`.
- [PASS] K3 — `grep -rn "TOOL_KEYS\|more placeable tools than hotbar keys" src | wc -l` → 0.
- [PASS] K4 — `grep -rn "'Minus'\|'Equal'" src | wc -l` → 0.
- [PASS] T1 — `grep -c "hands ↔ current tool"` → hud.ts 1, legend.ts 1; menu.ts:107 has "C</b> switches between hands and your tool"; `grep -c "back to hands" src/ui/hud.ts` → 2; PLAN.md:31 "current tool ↔ hands"; `grep -c "tool wheel (hold Tab)" src/ui/shop.ts` → 1; `npx tsc --noEmit` → exit 0.
- [PASS] Q1 — `scope2: held=true speech=0; scope1: held=true speech=4` (8 s game time each).
- [PASS] Regression — `zz-gw-gun-pull.js`: all D/B pass flags true; `zz-gw-magnet-gun.js`: steps 1-8 as before (no-gun hands lift one, gun ball sizes, shop buy), 0 exceptions; `zz-gw-scope-levels.js`: B1-B14 + B10 all `pass:true` (one earlier run had B6/B12-B14 false only because I started a second Chromium on port 9396 at the same time; the clean rerun passed everything); `zz-scenario15-scope.js`: hoop bullseye true, massive lifts, arc green, 0 exceptions; `scenario-fuses.js`: 31/31 `pass:true`; `shot.js`: rows 1-14 as designed (404/413/500 rows are its error-path rows), 0 exceptions.
