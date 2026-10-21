# Small batch: crate XP, ball weight, mushroom drops, Feeding Frenzy, Midas look, Eclipse Cap, Coin Magnet 10

## Problem

Seven PP requests from 2026-10-24 (BOARD "Kolejka po drzewku"), planned in `2026-10-25-plan-small-batch.md` (`## Plan (plan-senior, final)`). PP answered the open decisions on Slack 2026-10-21 11:46: "Tak wszystko się zgadza" → 1a (Piggy Bank removed, $800 refund), 2a (Feeding Frenzy $2000 x2.2, 5 levels, hole 4).

Interpretation: build the senior plan as written. The plan's Q1 (Frenzy owners: XP tier factor 1 and throws at the 1.2 kg speed) has no PP answer yet; built as option a (the plan default), as two isolated one-line pieces:
- `src/systems/hole.ts`, line `const tierXp = lvl('frenzy') ? 1 : g.tier.value;` → option b/c: replace `tierXp` by `g.tier.value` (one line).
- `src/player/player.ts`, `throwHeld`: `const mRef = lvl('frenzy') ? WEIGHT_TIERS.normal.mass : mMax;` and `updateAids`: `if (lvl('frenzy') && …) m = WEIGHT_TIERS.normal.mass;` → option b/c: delete those two lines (and use `mMax`).

## Summary

- Crate dump: `consume(g, at, 'crate')` pays full XP (feed x1); tipped crate, vacuum, black hole, robot stay x0.25.
- Magnet Gun ball: impulse `J * m_i / m_max`, so every gnome leaves at J / m_max; Trick Scope predicts with the heaviest member's mass.
- Mushroom drop bonus: golden x4 removed, wizard keeps x6.
- Feeding Frenzy (`frenzy`, Factory, hole 4, $2000 x2.2, 5 levels): `massiveOdds(hole, frenzy)`, Heavy stays first in `rollTier` and is capped at `1 - massive` (daily seed gives identical draws at Frenzy 0). HEAVY HAUL text and contract off while owned; Q1 a compensations above.
- Midas look: one shared `gold` uniform in the gnome shader (body tint and emissive, hats excluded via `1 - vGlow`; roughness/metalness on the whole gnome), damped (λ 12) toward `midasLeft > 0`. Golden type material metalness 0.6 / roughness 0.35 / emissive 0x332200.
- Eclipse Cap (`daynight`): x2 money, `env.shade` damps (λ 6) toward `0.5 - 0.5 cos(π t / 1.5)`; `night` and `isNight` untouched; sun colour lerps instead of a threshold.
- Piggy Bank removed; Coin Magnet max 10, growth 2.2, level 10 = auto-collect (`coins.autoCollect`); old saves: key deleted, $800 refund, load note.
- Texts: legend XP rule, SPEC (mechanics and decisions), PLAN, CHANGELOG `## 2026-10-25 16:00`, BOARD status.

Ladder: `massiveOdds` and the `rollTier` parameter rung 6 (shop line and roll need the same number); `'crate'` literal, mass ratio, `tierXp`, `mRef`, `autoCollect`, `haul` gate rung 5 (one expression each); `GOLD` uniform, golden `vcMat` options, `daynight` row, sun lerp, Piggy migration rung 2 (copies `NIGHT`, `booze`, the sky lerps and the Wind-up block). No new dependency.

D1 recorded sequence: instead of a stored list, the scenario keeps a verbatim copy of the pre-change `rollTier` (`oldRollTier`) and compares 10,000 draws per case (hole 4/8/12, min tier normal and heavy, plus the daily stream `mulberry32(seed ^ 0x9e3779b9)`).

## Work progress

Taken by recommendation (no PP answer yet): Q1 a (see Problem). Assumptions as the plan's "Decisions for PP" 4-8 (tipped crate x0.25, one roll for rain/parade/Shadow, HEAVY HAUL text and contract off with Frenzy, greedy theft until Coin Magnet 10, Midas look on the counter, hats untinted).

Runs (private dev server `npx vite --port 5164 --host 127.0.0.1 --strictPort --config <scratchpad>/slb/vite.nohmr.config.mjs`, headless shell, no FAKELOCK, never FULL):
- `npx tsc --noEmit` → exit 0.
- `URL_QUERY='' DEV_PORT=5164 CDP_PORT=9433 MAXPOLL=2400 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-small-batch.js` → 58/58 PASS, `LOGS:` empty (last run; the run before had B4 FAIL "n 2": one gnome landed on another and never set `touchedGround`; the landing test now also counts a low, slow gnome).
- `scenario-balance.js` with `window.MONEY_BEFORE = {"crate2":55.35,"vacuumThrown":525.6,"regrabBall20":1458,"plain":9.45}` prepended (values from `2026-10-21-balance-batch.md`) → 42/42 PASS, C8 at xp 2 (expected value changed from 0.5 to 2: two gnomes now pay x1 each).
- `scenario-tutorial-goals.js` (URL_QUERY='') → 31 PASS, 0 FAIL.
- `scenario-tree-expansion.js` (URL_QUERY='') → 51/52; F3 FAIL (`updateMax 13.7` vs gate 8 ms), the robot-search frame spike the orchestrator accepted on 2026-10-24 (`2026-10-24-tree-and-endgame.md`), unrelated to this batch.
- `URL_QUERY='?regime=small&frenzy' DPR=1 … scenario-perf.js` → busy medium `physics.step p95 2.4, max 3.5`, `over25n 0`; `errors []`. The perf probe `nightOn` set `env.night` and called `update(0)`; with the damped `shade` it now sets `shade` too (fixture change, same check).
- Screenshots checked by eye: `midas-peak.png` and `midas-hats.png` show gold bodies with red hats (the second at night).

Gotowe, gdy (plan `### Done when`, every line run now):
- [PASS] A1 — `PASS A1 xp 2 money 55.35 before 55.35`
- [PASS] A2 — `PASS A2 xp 2`
- [PASS] A3 — `PASS A3 xp 0.5 releasedBy machine`
- [PASS] A4 — `PASS A4 xp 0.25`
- [PASS] B1 — `PASS B1 speeds [5,4.96,4.89] J/3 5`
- [PASS] B2 — `PASS B2 speeds [12.52,12.87,12.57] J/1.2 12.5`
- [PASS] B3 — `PASS B3 speed 5 J/3 5 hand`
- [PASS] B4 — `PASS B4 ring within 0.14 m landed true n 3`
- [PASS] B5 — `rg -n "g.type.id !== 'king'" src/player/player.ts` → `786: … g.type.id !== 'king';` (grabbable)
- [PASS] B6 — `PASS B6 mMax 3 speeds [4.91,5.26]`
- [PASS] B7 — `PASS B7 dv [0,0] release no impulse`
- [PASS] B8 — `PASS B8 slip 3kg 0.43 > 1.2kg 0` (two trials, 180° in 0.5 s, Coil 2)
- [PASS] C1 — `PASS C1 golden 5 == classic 5 drops, bonus 1`
- [PASS] C2 — `PASS C2 wizard 30 = 6x 5`
- [PASS] C3 — `PASS C3 goldenHour per-gnome 0.025 n 10`
- [PASS] D1 — `PASS D1 sequence identical hole 4/8/12 + daily seed: true, rnd() calls 1`
- [PASS] D2 — `PASS D2 massive 0.606 want 0.612 ±0.01`
- [PASS] D3 — `PASS D3 50/50 massive`
- [PASS] D4 — `PASS D4 fat massive`
- [PASS] D5 — `PASS D5 king normal 40kg`
- [PASS] D6 — `PASS D6 rain 45/45 massive`
- [PASS] D7 — `PASS D7 retype keeps heavy`
- [PASS] D8 — `PASS D8 prices 2000,4400,9681,21297,46852 hole 4 node true effect "(now: 3% massive, next: 22% massive)"`
- [PASS] D9 — `PASS D9 frenzy 0 notes 0`
- [PASS] D10 — `PASS D10 hauls+1 text(L1) false text(L0) true`
- [PASS] D11 — `PASS D11 frenzy1 xp massive 0.25 == normal 0.25; frenzy0 0.58 = 2.3 x 0.25`
- [PASS] D12 — `PASS D12 frenzy5 3kg hand 12.5, frenzy1 mixed ball [13.18,12.29,13.07], J/1.2 12.5`
- [PASS] D13 — `PASS D13 shadow massive at frenzy 5`
- [PASS] D14 — `PASS D14 haul offered frenzy1 false frenzy0 true`
- [PASS] D15 — `PASS D15 lesson haul completes 1x at frenzy 5`
- [PASS] D16 — perf `&frenzy` → busy medium `physics.step p95 2.4`, `over25n 0`
- [PASS] D17 — `PASS D17 frenzy5 masses 3 slip 0.55 (B8 3kg 0.43, 1.2kg 0)`
- [PASS] E1 — `PASS E1 gold 0→0.95 in 0.25 s, frames 25, peak 0.99` + `midas-peak.png` by eye
- [PASS] E2 — `PASS E2 gold <0.05 in 0.25 s`
- [PASS] E3 — `PASS E3 rainbow gold rises 0.18 → 0.98`
- [PASS] E4 — `PASS E4 low quality gold rises to 0.99`
- [PASS] E5 — `PASS E5 golden metalness 0.6 roughness 0.35`
- [PASS] E6 — `PASS E6 errors 0, golden 8 during Midas`, `LOGS:` empty
- [PASS] E7 — `PASS E7 midasLeft 0 timer 27.02 gold 0`
- [PASS] E8 — `PASS E8 timer ended, midasLeft 15: gold 0.99`
- [PASS] E9 — `PASS E9 shader has "(1.0 - vGlow)" on tint and emissive: true` + `midas-hats.png` by eye
- [PASS] F1 — `PASS F1 active true valueMult 2 row "Eclipse Cap" true legend 9.1% true`
- [PASS] F2 — `PASS F2 swings 6 min 0.03 max 0.97`
- [PASS] F3 — `PASS F3 shade≈night after end: day 0 night 0 (night 1)`
- [PASS] F4 — `PASS F4 level 1 swings min 0.02 max 0.97`
- [PASS] F5 — `PASS F5 low shade 0 mult 2`
- [PASS] F6 — `PASS F6 no visitor 0 isNight false (sky shade max 0.97)`
- [PASS] F7 — `PASS F7 rainbow includes true`
- [PASS] F8 — `PASS F8 timer 40`
- [PASS] F9 — `PASS F9 changes 7 minGap steady 1.47 with pickup 1.47`
- [PASS] F10 — `PASS F10 sun.r tracks n ±0.0000 over 10 s, max shade step per frame 0.06`
- [PASS] F11 — `PASS F11 pickup: intermediate shade seen` (two pickup phases, first step 0.05 / 0.07)
- [PASS] G1 — `PASS G1 prices 20,44,97,213,469,1340,3833,10961,31347,89651 noPiggyNode true`
- [PASS] G2 — `PASS G2 auto-collect left 0 money +50, nearestFree null`
- [PASS] G3 — `PASS G3 level 9 no auto (3 coins on the grass), steal ok true`
- [PASS] G4 — `PASS G4 upgrade undefined icon undefined`; `rg -n "piggy" src` → only `src/core/state.ts:151-152`, the migration itself (see deviations)
- [PASS] G5 — `PASS G5 money 900 piggy undefined magnetRange 6 note "The Piggy Bank was removed: …"`
- [PASS] G6 — `PASS G6 magnetRange 6 next 3833 head "LVL 6/10 · $3.83k"`
- [PASS] G7 — `PASS G7 "(now: 12.8 m pickup, next: 14.0 m pickup, coins fly to the bank)" / "(now: 14.0 m pickup, coins fly to the bank)"`
- [PASS] G8 — `PASS G8 rebirth magnetRange 0 frenzy 0 steal ok true haul offered true text shown true`
- [PASS] All — `npx tsc --noEmit` exit 0; `scenario-balance.js` 42/42 with C8 at 2; leaderboard work was committed (8333c4c) before the first edit.

Deviations from the plan:
1. G4 says `rg -n "piggy" src` → 0 lines, but step 11 (the refund migration) has to read the old key; the check is "only the migration in `state.ts`", plus `UPGRADE_BY_ID.piggy` and `ICONS.piggy` undefined.
2. F9 "never two direction changes within 1.4 s": the steady swing is checked from 0.5 s after pickup; the pickup itself may add one change (plan assumption 7). The scenario also checks every gap ≥ 1/3 s (WCAG 3 per second). Last run: 1.47 s either way.
3. F10: the plan wrote `r = 1 - 0.396 n` (sRGB); three.js keeps colours linear, so the check uses the two sun colours as three stores them. Error 0.0000.
4. D1: the pre-change sequence is a verbatim copy of the old `rollTier` inside the scenario, not a stored list (same comparison, 10,000 draws per case).
5. `scenario-perf.js` probe `nightOn` also sets `env.shade` (it relied on `update(0)` showing the night at once).
6. SPEC line on Gold Midas said "x5"; the code pays x3 (`buffs.ts`), corrected to x3 in SPEC and PLAN since the lines were edited anyway.

Rejected: none.

Measurement for the FASTEST LVL 12 floor (orchestrator request, 2026-10-25; econ model, not a headless run). Model: XP to hole 12 = 11,305 (sum of `HOLE_LEVELS`); all XP upgrades = Hole Hunger 5 (x1.5) and Deep Hunger 9 (x3.25) = x4.875; crate dumps at x1; production capped by the factory mouth at 20 gnomes/s from hole 2 (Head Start 7 = $218,700 buys Batches and Gears at once), 3.1/s at hole 1 (crank with Gears 16); no time for dragging crates or level-up pauses, no rain or Chaos bonus gnomes.
- With Frenzy 5 (Q1 a, tier XP x1): 2,319 gnomes, about 117 s.
- Without Frenzy (natural heavy/massive XP x1.6/x2.3 still count): about 86 s.
- Same build without Deep Hunger: about 381 s. Old rule (crate x0.25) with Deep Hunger: about 342 s.
So the 120 s floor in `supabase/leaderboard.sql:18` sits above the production-bound minimum after this batch; real runs need extra time to fill and drag about 39 crates of 60, so the real best is likely higher (inference, not measured). SQL not changed.

Shared tree: another session edited `src/ui/shop.ts` (tree rows), `tools/smoke/scenario-tree-expansion.js`, `docs/ai-work/2026-10-25-tools-tree-layout.md` and moved its CHANGELOG bullet into the `2026-10-25 16:00` section during this task; those are not part of this batch.

## Review fix round (2026-10-21)

Code review of the small batch and the Tools tree layout found six issues; one fix-finding package fixed all of them. This section supersedes the `tierXp` line (line 8), the `rollTier` mentions and the golden material numbers above.

- HEAVY HAUL: buying Feeding Frenzy while the contract runs no longer fails it. The Frenzy check moved to offer time (`offer` filter in `Contracts.roll`); the contract is still not offered while Frenzy is owned.
- Frenzy XP: `rollTiers` returns the real tier and the tier without Frenzy from one draw; the gnome keeps the second one as `xpTier` and hole XP uses it. A naturally heavy or massive gnome pays its full XP; only the weight Frenzy adds pays x1. The daily seed still gives the same gnomes (one `rnd()` call).
- Golden gnome material: metalness 0.3, emissive 0x553800 (was 0.6 / 0x332200, which looked ochre by day and brown at night).
- Shop tree lines start at the real parent: straight for chains, a fork under the row for siblings.
- SPEC: Purple Chaos x1.5, Green Grog x2. upgrades.ts header comment fixed.
- Rejected: wider row gap in the tree, because the Tools tab at 1920x1080 would no longer fit without scrolling; the fork line touching the next row's badge still reads clearly.

Tests: small-batch 59/0 (D11 rewritten, D18 new, D14 200 real rolls, E5 expects metalness 0.3), tree-expansion 52/1 (U19 new and green; F3 is the accepted yard perf gate from 2026-10-24), balance 42/0, tutorial-goals 30/0, `tsc --noEmit` clean.
