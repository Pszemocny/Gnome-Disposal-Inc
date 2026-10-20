# Trick shots pay more and celebrate (PP, 2026-10-19)

## Problem

PP (verbatim): "te trickshoty jak long shot, bullseye, air niech dają coś więcej golda, np. x2, x5, aby było warto. Daj tam jakieś cieszynki po tym, aby było wiadomo, że to się opłaca".
Translation: trick shots should pay much more (around x2 to x5) so they are worth it, with a celebration afterwards so the player sees it pays off.

Today (`src/systems/hole.ts` `consume`): SNIPER x2 (from 14 m), LONG SHOT x1.5 (from 8 m), AIR x1.3 (no ground touch), TRICK x1.5 (trampoline bounce), BULLSEYE x3 (golden hoop); they multiply; the only feedback is a big text with the names and the usual `+$` float text.

## Plan (orchestrator, final)

1. **New multipliers** (still multiplied together, total capped at x20 so a perfect shot does not break the economy): AIR x2, LONG SHOT x2.5, TRICK x3, SNIPER x4, BULLSEYE x5. Keep the distance thresholds and the "player throw only" rule. HEAVY HAUL stays a label without a multiplier.
2. **Celebration, scaled by the total multiplier** (bigger trick = bigger party, but short, ≤ 1.5 s, and never covering the crosshair for long):
   - Big text shows each trick with its multiplier and the total, e.g. `SNIPER x4 + AIR x2 = x8`, and under it the money from this gnome, e.g. `+$48`, in gold. Pop-in with `outBack`, fade out (Animation rules 2-3).
   - A gold coin fountain: the existing `ctx.coins.burst` already carries the value; add a visual extra burst of gold sparks / confetti at the hole with `ctx.fx.burst` (count grows with the multiplier, 12-40), and a short camera shake (0.1-0.3 trauma).
   - A short rising fanfare in `src/core/audio.ts` (synthesised, 2-4 notes, more notes for bigger multipliers), played instead of the plain `tier()` sound for tricks.
   - The money counter in the HUD pulses gold (existing `moneyPulse`, stronger for tricks if it supports a strength, else add one).
3. Texts: shop/menu help (`src/ui/menu.ts` "Trick shots pay more: ..." line) lists the multipliers; `docs/PLAN.md` trick line updated; the machines.ts comment "earns TRICK x1.5" updated to x3 (comment only).
4. Follow the project `## Animation rules` in `CLAUDE.md`.

Gotowe, gdy (headless):
- a gnome thrown by the player from 15 m straight into the hole without touching the ground earns `type value x tier x 8 x (other multipliers)` (SNIPER x4 x AIR x2), measured against the same gnome dropped in (trick 1)
- BULLSEYE alone gives x5; SNIPER + AIR + BULLSEYE is capped at x20
- each trick label is present in the big text with its multiplier and the total, plus the `+$` amount (read the DOM)
- the fanfare is called for a trick and not for a plain drop; the extra spark burst count grows with the multiplier
- the big text opacity/scale sampled over ≥ 10 frames: pops (overshoot) then fades to 0
- one screenshot at the celebration peak, checked by eye (readable, not covering the whole screen)
- regression `scenario15-wait.js` passes; no exceptions; `npx tsc --noEmit` clean
