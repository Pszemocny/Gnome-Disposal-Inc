# Magnet Gun: a ball that takes as many as fit (2026-10-19)

Plan: `docs/ai-work/2026-10-19-plan-magnet-ball.md`, section "Plan (orchestrator, final)".

## Gotowe, gdy (from the plan)

1. Coil 0, 40 gnomes in front, hold LMB 4 s → held count between 15 and 25 (was 5-15, see the decision below), every held gnome inside R + 0.3 m of the ball centre
2. Coil 5 (R 1.8 m) → held count at least 3x the Coil 0 count
3. a ball of only 3 kg gnomes holds fewer than a ball of only 0.5 kg gnomes
4. turning 180° in 0.5 s still drops more 3 kg than 0.5 kg gnomes
5. RMB throws all held, speed J/mass as today
6. the ball mesh is visible while holding and hidden otherwise; no exceptions; `npx tsc --noEmit` clean; regression `scenario-magnet-gun.js` (capacity lines updated), `scenario15.js` (plus `scenario-broom.js`, asked by the orchestrator)

## Problem

PP: "magnes trzeba przerobić, niech łapie ile wlezie, ale w jakimś tam okręgu czy działa, i upgrade zwiększają tę kulę, tak bardziej rzeczywiście będzie". The gun should hold as many gnomes as fit inside a ball, and upgrades make the ball bigger. Until now it held a fixed count (6 + 3 per Magnet Coil).

## Summary

- `src/player/player.ts` (Magnet Gun parts only):
  - `gunCap` removed. New getters `ballR` (0.8 + 0.2 x Magnet Coil), `ballCentre` (eye + view direction x (1.2 + R)), `ballGnomes` (swarm gnomes inside the ball now).
  - The gun keeps collecting gnomes from its cone every 0.08 s, with no count limit.
  - Every swarm gnome is pulled to the ball centre with the existing `pull()` spring, so they pack physically.
  - A gnome is in the ball while its centre is within R + 0.3 m. A gnome outside the ball that moves with the ball (speed relative to the ball centre under 1.5 m/s) is stuck outside; after 0.4 s stuck it drops (ragdoll, no grab for 1 s).
  - Slip rule as before, measured from the ball, grip distance x R / 0.8.
  - Ball mesh: a faint additive sphere (opacity 0.08, no depthWrite, no light), visible while LMB pulls with the gun (hands, no single item carried, not placing).
  - The Fibonacci layout and `GOLDEN` are gone.
- `src/ui/hud.ts`: panel `MAGNET GUN n gnomes · ball 0.8 m`, second row `worth $x` (or `empty`) for gnomes in the ball.
- `src/ui/shop.ts`: Magnet Coil preview `0.8 m ball` → `1.0 m ball`.
- `src/data/upgrades.ts`: Magnet Coil "+0.2 m magnet ball radius (fits more gnomes) and a stronger grip (needs the Magnet Gun)."
- `docs/PLAN.md`: LMB row and Movement shop line.

Ladder: shelf 2. Reuses `pull()`, `gnomes.hold/drop`, `coneTarget`, the slip rule. New code: the ball check, the stuck timer, the mesh.

Deviations from the plan:
- "Stuck outside" needs a definition the plan did not give. A plain "outside for 0.4 s" would also drop light gnomes that only lag behind during a fast turn. So the timer runs only while the gnome moves with the ball (relative speed under 1.5 m/s).

Rejected: none.

Decision (orchestrator, 2026-10-19, option a): the ball stays at R = 0.8 + 0.2 x Coil. At Coil 0 the 0.8 m ball physically fits 18-21 normal gnomes, not the 5-15 from the plan. Reason: PP asked for "mnóstwo gnomów na raz" and "ile wlezie"; the 5-15 range was the orchestrator's guess in the plan, not PP's number. Line 1 now expects 15-25. Rejected alternative: base radius 0.6 m (probe: 12 at Coil 0, 64 at Coil 5).

Observation, not caused by this change: in `scenario15.js` the crate lifted with 9 gnomes inside instead of 10. That step has no Magnet Gun, so the swarm code does not run; the 10 massive gnomes are dropped from a height onto the crate, and one bounced out.

## Work progress

Scenario `<scratchpad>/smoke/scenario-magnet-gun.js`: step 3 replaced by the ball tests. Gnomes are fed into the beam 5-6.5 m ahead during the first 60% of the hold, so the supply does not limit the ball (with a static field in front only 23-30 gnomes ever entered the cone). Run `CDP_PORT=9383 MAXPOLL=2400 node smoke.mjs run-ball2 scenario-magnet-gun.js`, `LOGS:` empty.

- [PASS] 1 — Coil 0, 40 normal gnomes, LMB 4 s: held 18, `in15to25: true`, max distance 1.04 m ≤ 1.10, `allInside: true` (rerun after the decision: `CDP_PORT=9386 MAXPOLL=1200 node smoke.mjs run-line1 line1-ball.js`, `LOGS:` empty). Earlier runs: 20, 20, 21; there the max distance read 1.10-1.11 m, measured one physics step after the check (up to 0.01 m drift).
- [PASS] 2 — Coil 5 (R 1.8), 120 fed: held 71 ≥ 3 x 20 = 60. Probe run: 70 vs 21. With only 60 fed it was 53 (supply-limited).
- [PASS] 3 — Coil 0: only 3 kg → 8 held, only 0.5 kg → 28 held.
- [PASS] 4 — Coil 2, 3 trials, 180° in 0.5 s: 0.5 kg slipped 0 of 14, 3 kg slipped 9 of 13.
- [PASS] 5 — RMB: all thrown `ragdoll`, swarm 0; 0.5 kg 29.5-31.8 m/s (J/m 30.4), 3 kg 4.3-6.6 m/s (J/m 5.07).
- [PASS] 6 — ball mesh: hidden before LMB, visible while holding (scale = R: 0.8 / 1.8), hidden after release. `LOGS:` empty in all runs. `npx tsc --noEmit` → exit 0. Regression: `scenario15.js` (fan 0.94, massive lifts y 1.25, arc green → eaten 1, crate lifts with 9 inside, rain only specials, bullseye true, parade 16), `scenario-broom.js` (all 9 lines as in the broom note: king 0 m, plow 2.6 m ±1.6 not moved, 3.4 m moved, weights 0.52 m apart), steps 1-2 and 6-8 of `scenario-magnet-gun.js` unchanged.

Render interpolation (orchestrator note): the magnet code moves gnomes only with impulses, no `setTranslation`, so no `savePose` is needed.
