# Eclipse Cap: slower day/night swing

Gotowe, gdy:
1. `smoke scenario-small-batch.js` → `F2` PASS: shade ~0 for the first 5 s, a value strictly between 0 and 1 during 5-10 s, ~1 during 10-15 s, sampled over >= 10 frames.
2. `smoke scenario-small-batch.js` → `F3` and `F5` PASS (buff end returns to the clock smoothly; Low quality stays day), no other F line FAIL.
3. `npx tsc --noEmit -p .` → no output, exit 0.

## Problem

PP: "dzien noc po grzybku musi sie zmieniac wolniej np co 5 sekund z 5 sekundowym fadem". Under the Eclipse Cap the sky swung with a cosine every 1.5 s.

Interpretation: from the buff start, a 20 s cycle driven by a timer that starts at 0: day 5 s, fade to night 5 s, night 5 s, fade to day 5 s, repeat while the buff lasts. On end the sky damps back to the clock as before. Low quality stays day.

## Summary

- `src/world/environment.ts`: `eclipseT` counts seconds while `daynight` is active (reset to 0 when it is not); the target is 0 / `inOutSine` up / 1 / `inOutSine` down over the 20 s cycle; the existing damp (lambda 6) still smooths pickup and end. `FLIP_T` (1.5 s) replaced by `ECLIPSE_HOLD` and `ECLIPSE_FADE` (5 s each).
- Ladder: rung 2, reuses `inOutSine` from `src/core/ease.ts` (already imported for the hole slide) and the existing damp; one timer field, no new helper.
- Scenario F checks rewritten for the slow cycle; SPEC and CHANGELOG updated.

## Work progress

Scenario changes (`tools/smoke/scenario-small-batch.js`, block F):
- F2 samples `env.nightShade` against `env.eclipseT` for 16 s: day hold (0.5-5 s) max < 0.05, fade (5.5-9.5 s) at least 10 frames strictly between 0.05 and 0.95, night hold (11-15 s) min > 0.95, each window >= 10 frames, timer starts under 1 s.
- F9: exactly one direction change, at >= 14.5 s (end of the night hold).
- F4: level 1 with the timer skipped to 8.5 s reaches night.
- F11: pickup during the clock's night restarts the timer at 0 and the damp fades the sky to the day hold (max step < 0.3 per frame, >= 3 intermediate frames).

Runs:
- `npx tsc --noEmit -p .` → no output, exit 0.
- First smoke run with the given command (default `?lowfx`): every F shade check read 0, because `?lowfx` forces Low quality (sky stays day). The earlier small-batch note runs this scenario with `URL_QUERY=''`.
- `URL_QUERY='' FAKELOCK=1 MAXPOLL=2400 CDP_PORT=9379 DEV_PORT=5177 node tools/smoke/smoke.mjs <scratchpad>/eclipse-out tools/smoke/scenario-small-batch.js` → 59 PASS, 0 FAIL, `errors: []`, `LOGS:` empty. Sampled curve: 0 until 5.25 s, 0.32 at 7.08 s, 0.85 at 8.92 s, 1 from 10.08 s to 15.25 s, 0.94 at 15.92 s.

Gotowe, gdy:
- [PASS] 1 — `PASS F2 start 0.07 s; day hold max 0 (270 frames), fade strictly between 216/240 frames, night hold min 1 (240 frames)`.
- [PASS] 2 — `PASS F3 shade≈night after end: day 0 night 0 (night 1)`, `PASS F5 low shade 0 mult 2`, 59 PASS / 0 FAIL.
- [PASS] 3 — `npx tsc --noEmit -p .` → exit 0.

Self-check: only the timer, the cycle target and the two constants are new in `environment.ts`; `inOutSine` and the damp were already there. No new helper, no new dependency. Animation rule 1 check: no `Math.min(1, dt` added.

Odrzucone: screenshot at the peak frame (animation rule 12) not taken; the sky shade is a colour lerp checked by the sampled curve and the brief did not ask for it.
