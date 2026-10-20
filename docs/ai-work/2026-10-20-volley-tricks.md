# Volley shows its trick shots

Gotowe, gdy:
1. AIR volley (Magnet Gun ball thrown through the air into the hole) → every eaten gnome has trick > 1 and the big text contains `AIR` (`scenario-volley-tricks.js`, step `air_volley_5m`).
2. LONG volley → big text contains `LONG SHOT` on the gnomes that scored it (step `long_volley_10m`).
3. Single throw unchanged → `scenario-trick.js` big texts as before (`SNIPER x4 + AIR x2 = x8`, `AIR x2`, `... = x20 MAX`).
4. Volley without a trick → no big text, as before (`trick > 1` branch not taken).

## Problem

PP (2026-10-20): "volley powinien sie liczyc jako air jesli jest air teraz jak jest volley to nie liczy innych trickshotow". When a Magnet Gun volley also flies as AIR / LONG / SNIPER / BULLSEYE, the player does not see those tricks.

## Summary

Cause (fact about current code, measured headless): the tricks ARE counted. In `Hole.consume` every gnome of a volley keeps its own flags (`touchedGround` false, `throwPos` distance) and gets `AIR x2` / `LONG SHOT x2.5`, capped at `VOLLEY_CAP` x4; the first gnome also gets the flat bonus once. But the big text for a volley was only `VOLLEY x2 (7 gnomes)`, so the trick names never appeared. That is what PP saw.

Fix: the volley big text names the tricks like a single throw does, prefixed with `VOLLEY ·` and suffixed with the gnome count, e.g. `VOLLEY · AIR x2 (7 gnomes)`, `VOLLEY · LONG SHOT x2.5 + AIR x2 = x4 MAX (7 gnomes)`. Economy rule F2 (cap x4, bonus once per throw) unchanged.

Ladder: rung 2, reuses the single-throw text builder already in `consume`; one line changed.

## Work progress

Red (current code, `scenario-volley-tricks.js`): `air_volley_5m`: 7 eaten, 7 with air=true, values 2.2-2.7 at combo 1.05-1.3 (= x2), big text `VOLLEY x2 (7 gnomes)` (no `AIR`). `long_volley_10m`: 7 eaten, all air, value x2 or x4, big text `VOLLEY x2 (7 gnomes)` / `VOLLEY x4 (7 gnomes)` (no `AIR`, no `LONG SHOT`).

Green (after the fix, same scenario):
- [PASS] 1 — `air_volley_5m`: 8 eaten, 8 air, values 2.2-2.8 at combo 1.05-1.35 (x2), first 12.1 (x2 + $10 bonus once), big `VOLLEY · AIR x2 (8 gnomes)`.
- [PASS] 2 — `long_volley_10m`: 6 eaten, big `VOLLEY · LONG SHOT x2.5 (6 gnomes)`, `VOLLEY · LONG SHOT x2.5 + AIR x2 = x4 MAX (6 gnomes)`, `VOLLEY · AIR x2 (6 gnomes)`.
- [PASS] 3 — `scenario-trick.js`: `SNIPER x4 + AIR x2 = x8`, `BULLSEYE x5`, `SNIPER x4 + AIR x2 + BULLSEYE x5 = x20 MAX`, `AIR x2`, identical to `final-trick.txt`.
- [PASS] 4 — volley with trick = 1 never enters the `trick > 1` branch (code unchanged there); single-trick text path unchanged because a single throw never exceeds `TRICK_CAP` with one trick.
- `scenario-magnet-gun.js`: no exceptions, results equal to the latest earlier run (`reg-scenario-magnet-gun.txt`).
- `npx tsc --noEmit` → exit 0.

Self-check: one line in `hole.ts` became two; no new helper, no economy change. A volley capped with one trick (BULLSEYE x5 alone → x4) now shows `BULLSEYE x5 = x4 MAX` instead of a wrong `x5`.

Rejected: raising `VOLLEY_CAP` so AIR adds on top of SNIPER in a volley (SNIPER x4 already hits the x4 cap, so AIR adds no money there). That is the F2 economy rule; the order says keep it. → PP decision if wanted.

PP decision (2026-10-20): "podnosimy limit do x8". `VOLLEY_CAP` 4 → 8 (orchestrator). Rerun `scenario-volley-tricks.js` (`cap8`): AIR volley "VOLLEY · AIR x2 (10 gnomes)"; LONG + AIR volley now "VOLLEY · LONG SHOT x2.5 + AIR x2 = x5 (7 gnomes)" (was capped "x4 MAX"); flat bonus still once per throw ($35 first gnome, the rest x-only).
