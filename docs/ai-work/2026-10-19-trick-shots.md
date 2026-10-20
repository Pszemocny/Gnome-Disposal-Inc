# Trick shots pay more and celebrate

Plan: `docs/ai-work/2026-10-19-plan-trick-shots.md`, "## Plan (orchestrator, final)".

## Problem

PP: trick shots (LONG SHOT, BULLSEYE, AIR...) should pay clearly more (x2 to x5) and show a celebration, so the player sees that they pay off.

## Summary

- `src/systems/hole.ts` `consume`: AIR x2, LONG SHOT x2.5, TRICK x3, SNIPER x4, BULLSEYE x5, multiplied, total capped at x20 (`TRICK_CAP`). Labels carry their multiplier. Thresholds (8 m / 14 m) and "player throw only" unchanged; HEAVY HAUL stays a label without a multiplier.
- Celebration when the total is above x1, scaled by `f = (total - 2) / 18`: big text `SNIPER x4 + AIR x2 = x8` (single trick: just `BULLSEYE x5`; capped: `= x20 MAX`) with a gold `+$` line under it, pop scale `1 + 0.3 f`; money counter pulse strength `0.4 + 0.6 f` (gold glow); `audio.fanfare(2|3|4 notes)` instead of `tier()`; two `fx.burst` calls at the hole (gold + blue, pink for bullseye), 12-40 sparks total, each call <= 20 (Animation rule 6 says 6-30 per event); shake `0.1 + 0.2 f`.
- HEAVY HAUL alone (total x1) keeps the old plain big text and `tier()` sound.
- `src/ui/hud.ts`: `bigText(text, color, sub = '', size = 1)`; the big text and the money pulse are now animated in `Hud.update` with `outBack` pop (0.3 s), `inQuad` fade (last 0.4 s, total 1.5 s) and `outCubic` pulse decay, instead of CSS keyframes. `moneyPulse(strength = 0)`: a plain coin pulse does not cut a running stronger trick pulse.
- `src/ui/style.css`: `.hud-big` font `clamp(20px, 3.6vw, 60px)`, wraps at 90 vw (divided by the pop scale), `z-index: 5` (it was hidden behind the controls panel), `paint-order: stroke fill` for readability; `.big-sub` gold line; old `big`/`pulse` keyframes removed.
- `src/core/audio.ts`: `fanfare(notes)`, a rising arpeggio C-E-G-C (last 2-4 notes), the last one held.
- Texts: menu help line, `docs/PLAN.md` trick line, `machines.ts` trampoline comment (x3), hoop comment in `hole.ts` (x5).

Decisions taken here:
- The trick big text is shown after the combo tier / king / jackpot texts of the same gnome, so it is the one the player reads (the combo tier still plays its sound, shake and rays).
- Drill-down rung: everything reuses existing APIs (`hud.bigText`, `moneyPulse`, `fx.burst`, `fx.shake`, `audio.tone`, `src/core/ease.ts`); new code is one audio method and two optional parameters.

Rejected:
- Gold pulse timed to when the coins are actually collected: needs `coins.ts` (not in my files) and the plan says to pulse on the trick; the pulse fires when the gnome is eaten.

## Work progress

Gotowe, gdy (from the plan, run headless at the end):
1. Player throw from 15 m into the hole without ground contact pays x8 (SNIPER x4 x AIR x2) against the same gnome dropped in.
2. BULLSEYE alone pays x5; SNIPER + AIR + BULLSEYE is capped at x20.
3. The big text has every trick label with its multiplier, the total and the `+$` amount (DOM).
4. The fanfare plays for a trick and not for a plain drop; the extra spark count grows with the multiplier.
5. Big text opacity/scale over >= 10 frames: pops past 1 (overshoot), then fades to 0.
6. One screenshot at the celebration peak, checked by eye.
7. `scenario15-wait.js` passes, no exceptions, `npx tsc --noEmit` clean.

Scenario: `<scratchpad>/smoke/scenario-trick.js` (spies on `coins.burst`, `fx.burst`, `fx.shake`, `audio.fanfare`, `audio.tier` while `hole.consume` runs; the 15 m throw goes through `Gnomes.drop`, the real player throw path, from the side away from the hoop). Runs `run-trick` and `run-trick2` (after the CSS fix) gave identical numbers.

Check (run 2026-10-19, after the code, locally on the dev server 5199):
- [PASS] 1. x8 — `CDP_PORT=9392 MAXPOLL=2400 node smoke.mjs run-trick2 scenario-trick.js` → `"dropValue":1.05,"throwValue":8.4,"ratio":8,"big":"SNIPER x4 + AIR x2 = x8+$8.4"`
- [PASS] 2. BULLSEYE x5, cap x20 — same run → bullseye alone `"ratio":5.71` = 6 / 1.05; the bullseye also gives combo +3 (existing rule), so comboMult is 1.2 instead of 1.05: 6 / 1.2 = x5.0. Cap: `"ratio":22.86` = 24 / 1.05 → 24 / 1.2 = x20.0, text `SNIPER x4 + AIR x2 + BULLSEYE x5 = x20 MAX`.
- [PASS] 3. DOM — `.hud-big` text `SNIPER x4 + AIR x2 = x8`, `.big-sub` `+$8.4`; `BULLSEYE x5` / `+$6`; capped `... = x20 MAX` / `+$24`.
- [PASS] 4. fanfare and sparks — plain drop `"fanfare":0,"tier":0`; AIR x2 → `fanfare 2`, sparks 6+6 = 12; x8 → `fanfare 3`, 11+10 = 21; x20 → `fanfare 4`, 20+20 = 40; shake 0.1 / 0.17 / 0.3.
- [PASS] 5. big text over 40 frames (opacity, scale): `[0.62,0.8],[0.96,1.24],[1,1.41],[1,1.42],[1,1.35],[1,1.3] ... [0.94,1.3],[0.75,1.3],[0.44,1.3],[0.23,1.3],[0,1.3]` → pops past its size 1.3 (1.42), settles, fades to 0.
- [PASS] 6. screenshot `run-trick2/trick-peak.png`: at 640x360 the capped line wraps (`MAX` on its own line), plus the gold `+$24`, all in the upper 40 % of the screen, readable, crosshair free. First run showed the text behind the controls panel → fixed with `z-index: 5` and wrap width.
- [PASS] 7. `CDP_PORT=9393 MAXPOLL=2400 node smoke.mjs run-trick-reg15 scenario15-wait.js` → all steps return expected values (`ratio 0.99`, `eatenAfterGreenThrow 1`, `bullseye true`, `parading 16`), `LOGS:` empty (no exceptions); `npx tsc --noEmit` → exit 0.

## Follow-up 2026-10-20: flat trick bonus

PP after playtest (verbatim): "nadal combo za bullseye nie działa dobrze, wrzuciłem armchair, mam 300, zrobiłem kilka long shot bullseye 5 gnomów i mam 20, tak nie może być, musi być to sensowne na początku, później nikt tego nie będzie robił".
Cause: a gnome is worth $1 at hole level 1, so even x20 pays $20, while the armchair pays $250 once.
Fix (`src/systems/hole.ts`, `TRICK_BONUS`): every trick also pays a flat bonus times `valueScale` (hole multiplier, Premium Gnomes, Deep Value): AIR $10, LONG SHOT $20, TRICK $25, SNIPER $40, BULLSEYE $60. The multipliers and the x20 cap stay.
Measured (`scenario-trick.js`, hole level 1): SNIPER + AIR $58.4 (was $8.4), BULLSEYE alone $66 (was $6), SNIPER + AIR + BULLSEYE $134 (was $24), AIR alone $12. Five LONG SHOT + AIR + BULLSEYE shots now pay about $450, more than the armchair. `LOGS:` empty, `tsc` clean. Published on 5300 in `index-DDiGEOQw.js`.

Self-check: only the plan items were built; `grep -n "Math.min(1, dt"` finds nothing in touched files; every timed value goes through `outBack`/`inQuad`/`outCubic`; nothing outside my files edited.
