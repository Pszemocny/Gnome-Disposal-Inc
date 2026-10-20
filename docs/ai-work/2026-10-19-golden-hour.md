# Golden Hour turns every gnome golden (2026-10-19)

Plan: `docs/ai-work/2026-10-19-plan-golden-hour.md`, "## Plan (orchestrator, final)". Treated as a bug: red scenario first.

## Problem

PP: "golden hour chyba nie działa, niech zamienia wszystkie gnomy w złote i niech złote będą drogie".
When Golden Hour started, gnomes already in the yard stayed as they were and only the golden roll for new gnomes went up to 10 %, so the player saw almost no golden gnome.

## Summary

- `Gnomes.retype(g, typeId)` (`src/entities/gnomes.ts`): spawns the new type at the same place, rotation, velocity, angular velocity and weight class, copies the throw flags (`thrownBy`, `throwPos`, `touchedGround`, `bounced`, `bullseye`, `screamed`), parade, anger, loot, value multiplier and the interpolation pose, then removes the old gnome. The new gnome grows in over 0.25 s (`pop`, `outBack`, small overshoot).
- `Gnomes.spawn`: while `goldenHour > 0`, every new gnome except the king, the shadow visitor and golden ones comes out golden and remembers its own type in `goldFrom`. This covers the factory, the rain and the parade (all go through `spawn`). Weight class and statue/awake default come from the original type. If the golden slots are full, the gnome keeps its own type. The old x25 golden roll is gone (it is replaced by this).
- `Events` (`src/systems/events.ts`): at the start, every free gnome (`walk`, `statue`, `ragdoll`; not king, not already golden) is queued for a swap; the queue is collected first and swapped later, nearest to the player first, spread over 0.5 s. Cue per gnome: gold burst (16 particles) and a coin chime. When the event ends, every gnome with `goldFrom` is queued back the same way, with a grey puff. Held or stashed ones turn back as soon as they are free again; eaten ones drop out of the queue. A new Golden Hour clears the pending turn-back, those gnomes turn back at its end.
- Value: unchanged code, golden type value 100 x the normal gnome, times weight class and hole multipliers, `flee` behaviour kept.
- Subtitle: "Every gnome turns to gold for 25 s! Catch them!". HUD buff line unchanged.
- `src/data/gnomeTypes.ts`: golden instanced mesh capacity 40 → 320 (the biggest yard: 120 + 5 permits x 40). Without it a yard of more than 40 gnomes would stay partly normal.

Drabina: shelf 2, reuse `spawn`/`remove`/`ragdoll`, `isFree`, `ctx.fx.burst/puff`, `ctx.audio.coin`, `outBack` from `src/core/ease.ts`; minimum code for the swap itself.

Odstępstwa:
- `src/data/gnomeTypes.ts` was not on the owned list; one number (golden capacity) changed, reason above. No other agent owns that file.
- Golden statues stay statues (the plan keeps the state); they wake up by the normal wake chance.

Odrzucone:
- Converting the shadow visitor spawned during the event: the plan lists factory, rain and parade only; a shadow already in the yard is converted like any free gnome.
- A separate pop on factory gnomes made golden: the factory already gives them a puff and a boing.

## Work progress

Scenario `<scratchpad>/smoke/scenario-golden.js`: 50 gnomes (classic, blue, greedy; statues, walkers, flying ragdolls; normal and heavy), one natural golden, a king, one held and one stashed gnome; start the event, check after 2 s, make 4 factory gnomes, eat a heavy golden, end the event (`goldenHour = 0.05`), check 1.2 s later, eat a heavy classic.

Red (before the fix, 30 gnomes, `CDP_PORT=9373 MAXPOLL=2400 node smoke.mjs run-golden-red scenario-golden.js`):
`"freeNonKing":31,"goldenFree":1` (only the natural one), factory during event `["blue","blue","blue","classic"]` (0 of 4 golden).

Green (after the fix, 50 gnomes, `run-golden-green`):
`"two_s_after_start":{"total":54,"totalBefore":54,"freeNonKing":51,"goldenFree":51,"heldType":"classic","heldState":"held","stashedType":"blue","stashedState":"stashed","kingType":"king","naturalSame":true,"goldFrom":{"blue":17,"classic":27,"greedy":6},"popScale":[0,0,0,0,0,0.71,0,0.71,1.03,1.1,1.05,1,1,1]}`,
`"factory_during_event":["golden<classic","golden<classic","golden<blue","golden<blue"]`,
`"value_100x":{"golden":168}`, `"value_normal":{"classic":1.68}`,
`"one_s_after_end":{"expectBack":{"blue":19,"classic":29,"greedy":6},"nowNonGolden":{"blue":19,"classic":29,"greedy":6},"leftWithGoldFrom":0,"goldenLeft":1,"naturalStillGolden":true,"total":58,"totalBefore":58}`, `LOGS:` empty.

Gotowe, gdy:
- [PASS] red before the fix — 1 golden of 31 free gnomes 2 s after the start (only the natural one), 0 of 4 factory gnomes golden.
- [PASS] 2 s after the start every free non-king gnome is golden — 51 of 51; held stays classic/held, stashed stays blue/stashed, king stays king; 54 gnomes before and after.
- [PASS] a factory gnome made during the event is golden — 4 of 4 (`golden<classic`, `golden<blue`).
- [PASS] 1 s after the end event-made golden gnomes are back — 19 blue, 29 classic, 6 greedy, exactly the remembered types (incl. the 4 factory ones); 0 gnomes left with `goldFrom`; the natural golden is still golden; 58 before and after.
- [PASS] a golden gnome eaten pays 100x — heavy golden 168, heavy classic 1.68, combo reset before each.
- [PASS] regression and type check — `scenario15-wait.js` (`run-golden-reg15`): all 8 steps returned values, no `ERR`, `LOGS:` empty; `npx tsc --noEmit` → exit 0.
- Animation rule 3: drawn scale of a swapped gnome sampled over 14 frames: 0 → 0.71 → 1.03 → 1.1 → 1.05 → 1 (values between the end states, outBack overshoot).

Self-check: the swap queue is collected before any swap and each entry is checked against `ctx.gnomes.list` before use, so a removed gnome's body is never touched; `retype` reads the old body before `remove`; no Rapier change inside a query callback; held/stashed/falling gnomes are never swapped. Not checked: a screenshot by eye at the pop peak (headless camera did not face the converted gnomes).
