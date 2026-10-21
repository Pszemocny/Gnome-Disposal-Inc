# Performance: hitches near the factory and the hole (2026-10-21)

## Problem

PP (Slack via hub): "Popraw tą wydajność aby usunąć skoki nawet kosztem wyglądu". The hub: keep today's look as High, make a lighter default, put fps before/after into BOARD.md. PP (terminal): moving gnome parts on every type are cancelled ("bo to zabije wydajnosc"), so this task does not touch gnome parts.

Interpretation: execute `## Plan (plan-senior, final)` of `2026-10-21-plan-performance.md`. The Decisions for PP had no answer, so the defaults were taken by recommendation:
1. OD 1 a): the `?stats` readout ships.
2. OD 2 a): High = today's Medium look (ratio up to 1.5, shadows 1024² to 40 m); the 2048²/ratio-2 variant goes away.
3. OD 3 a): Medium = 512² shadows to 25 m from the player, edge softness kept (radius 1.6).
4. OD 4 a): Medium stays at ratio 1 on a DPR-1 screen; the next cut waits for PP's `?stats` line.
5. Spec-silent items 5-9 a): Low unchanged, `?lowfx` unchanged, old "Shadows off" save becomes Low once, Medium keeps the night look, the house is a measured spot.

Done when: the 38 lines of `### Done when` in the plan; results in "Done when: results" below.

## Summary

- Medium (the default) is lighter: pixel ratio 1 at any DPR, sun shadow map 512² covering ±25 m around the player, radius 1.6 (same edge width in metres as before). High is the old Medium (ratio up to 1.5, 1024², ±40 m, radius 2). Low unchanged. Cookie names unchanged, so PP's `medium` cookie gets the lighter look without touching the menu.
- `renderer.compileAsync(scene, camera)` right after `machines.restore`: materials of everything in the yard at boot link on the title screen.
- HUD: shards, hole label, hole bar width and hole XP line are written only when their text changes; the combo box uses `classList.toggle('on', false)` instead of `remove('on')`. DOM mutations on a still title screen: 180 per 60 frames → 0.
- `?stats` overlay (`src/ui/stats.ts`, class `perf-stats`): line 1 `fps · p95 · max (last 5 s) · prog <programs>`, line 2 `<quality> · <buffer>@<DPR> · <GPU>`. Intervals over 1 s (hidden tab) are dropped. Without `?stats` no element exists.
- Conditional steps 5a-5d: all skipped, the `perf-before` numbers did not trigger any of them (details below).
- New permanent scenario `tools/smoke/scenario-perf.js` (regimes small, proxy, quality, boot, stats).
- Main finding: the Mac (M3 Max, Metal) does not reproduce PP's hitches at all. At 640x360 every spot on every quality, before and after, holds 60 fps with p95 16.7-16.8 ms and no frame over 25 ms. The GPU cut is real (fewer pixels, smaller shadow pass) but the Mac GPU is not fill-bound, so the proxy gate "Medium ≤ 0.6 x High" fails (0.76-0.97). PP's `?stats` line is the next measurement.

## Measurements

All runs on head `542ef82` (the error-report agent committed between my first `perf-before` on `eff7a5e` and the code change, so `perf-before` was re-run on `542ef82` with my source edits stashed by path; `head.txt` in each out dir). Headless Chromium, Metal, Apple M3 Max.

Small regime, 640x360 @ DPR 1, Medium, 30 s per spot after compile + 2 s warm-up (frame interval ms):

| spot | before p50 / p95 / max | after p50 / p95 / max | frames > 25 ms before / after | physics.step p95 after | render (CPU) p95 before / after |
|---|---|---|---|---|---|
| factory (Auto Crank 3, OVERTIME, ~213 gnomes) | 16.7 / 16.7 / 16.8 | 16.7 / 16.7 / 16.8 | 0 / 0 | 2.1 | 1.7 / 2.2 |
| house | 16.7 / 16.7 / 16.8 | 16.7 / 16.7 / 16.8 | 0 / 0 | 0.3 | 2.5 / 2.4 |
| hole (80 gnomes, cannon) | 16.7 / 16.7 / 16.8 | 16.7 / 16.8 / 16.8 | 0 / 0 | 1.4 | 2.5 / 2.4 |
| busy (hole 10, Dark Forest, night, rain, 12 robots, 10 tools, 300 gnomes) | 16.7 / 16.7 / 16.8 | 16.7 / 16.8 / 16.8 | 0 / 0 | 2.5 | 1.5 / 1.5 |

High and Low lines are in the out files: same 16.7-16.8 ms everywhere.

Proxy regime, 2560x1440 @ DPR 2, game paused, 60 x (render + 1-pixel readPixels) after 30 warm-up renders, p50 ms:

| spot | Medium before (ratio 1.5, 1024², 8.3 MP) | Medium after (ratio 1, 512², 3.7 MP) | High after (ratio 1.5, 1024², 8.3 MP) | Low after |
|---|---|---|---|---|
| factory | 3.2 | 2.9 | 3.0 | 1.7 |
| busy | 4.0 | 2.9 | 3.8 | 2.2 |

Heavier diagnostic at 3840x2160 @ DPR 2 (`&w=3840&h=2160`): factory Medium 3.0 vs High 5.3 (0.57), busy 4.0 vs 6.1 (0.66). The bigger the buffer, the closer the ratio gets to the pixel ratio: the Mac pays a fixed per-frame cost (CPU submit, 200 draw calls in busy) that hides the pixel cut at 2560x1440.

Pixels per frame on a 1920x1080 window at DPR 1.5: Medium before 4.67 MP + 1.05 MP shadow map, Medium after 2.07 MP + 0.26 MP. At DPR 1 only the shadow map shrinks (1.05 → 0.26 MP).

Programs: 30 on the title before, 31 after (`compileAsync` linked one more); 0 new programs inside any 30 s block before and after, because each block starts with its own `compileAsync` (plan R2). No frame with `programsDelta > 0`, so no `links` names to copy.

Conditional steps:
- 5a skipped: `perf-before` has no frame over 25 ms, so no texture upload hitch (`texturesDelta`).
- 5b skipped: setItem p95 = 0 ms (max 0.2 ms) over all before blocks.
- 5c skipped: no busy frame over 25 ms, so no GC hitch from `machines.update`.
- 5d skipped: 18.5 % (gnome shadows on 2.7 ms vs off 2.2 ms GPU, busy, 300 gnomes, Medium, before). The first `perf-before` run (5 warm-up renders) read 29 % and 5d was built; with 30 warm-up renders the same A/B read 18.5 % before and 19.2 % after, so 5d was taken out again. The A/B sits on the threshold: 18.5 % (before), 19.2 %, 19.2 %, 22.2 % (after runs); PP's GPU decides, the `?stats` line is the input.

## Accepted side effects

- Shop thumbnails keep the pixel ratio of their first render: open the shop on Medium, switch to High, and the thumbnails stay at ratio 1 until reload (plan R11, no code).
- The P screenshot on 5300 draws `document.body`, so with `?stats` the overlay is in every PNG; GitHub Pages never saves the PNG (plan R17, no code).
- The shadow box edge 25 m from the player is visible far away: `scenario-grass.js` sees up to 37 pixels change at the top of the 640x360 frame (the far edge moves in whole 9.8 cm texels while walking); the grass patch by the hole stays still (`patch_lum_spread=0.00`). The house screenshot (`house-medium.png`) faces the wall and shows no edge.

## Work progress

- Ladder: the scenario and the overlay are rung 6 (new files, the plan asks for both); quality values are rung 5 (numbers in existing lines and the existing traverse); `compileAsync` is rung 3 (three's own function); HUD guards are rung 2 (the `lastMoney` pattern next to them).
- Scenario fix during the first run: clearing gnomes between blocks while robots held some in their bed crashed Rapier on the next tip (`recursive use of an object`, freed body). The scenario now empties every machine queue first. Not checked: whether any game path can remove a gnome that sits in a robot bed (same crash in play); rejected here as outside this task → separate order if it ever shows in the error log.
- Deviations from the plan: `.perf-stats` line 2 has no `prog` (step 4 puts `prog` on line 1; done-when 28 wrote it on line 2), checked with the step-4 regex; the combo box `classList.remove` was a fifth per-frame write that kept done-when 10 at 60, fixed in the same function; `busy` spawns 300 gnomes directly in a ring instead of `factory.burst(300)`, because the chute lets out 20/s and every block needs the same count; the gnome shadow A/B runs right after the 300 spawn, before the block (after the block robots had eaten most of them).

### Commands

- `URL_QUERY='?regime=small' DPR=1 DEV_PORT=5183 CDP_PORT=9401 MAXPOLL=2400 node tools/smoke/smoke.mjs <out> tools/smoke/scenario-perf.js` (also `?regime=proxy`, `?regime=quality` with DPR 1 and 2, `?regime=boot&cookie=medium`, `?regime=boot&cookie=high&lowfx`, `?regime=boot&save=noshadows`, `?regime=stats&stats`, `?regime=stats`).
- `URL_QUERY= DPR=1 ... scenario-grass.js`, `FULL=1 DPR=1 ... MAXPOLL=1600 ... scenario-esc.js`, `FULL=1 DPR=1 ... MAXPOLL=2400 ... scenario-factory.js`, `npx tsc --noEmit`.

### Done when: results

Out dirs under the session scratchpad `perf/`; `perf-after` = final code, `perf-after-repeat` = the one allowed repeat.

- [PASS] 1 — `after-quality-dpr1` boot → `{"pr":1,"shadows":true,"map":512,"right":25,"radius":1.6}`.
- [PASS] 2 — `perf-cookie` (iframe boot after cookie medium) → `"prefsQuality":"medium","pr":1,"map":512,"right":25`.
- [PASS] 3 — `after-quality-dpr2` high → `{"pr":1.5,"shadows":true,"map":1024,"right":40,"radius":2}`.
- [PASS] 4 — low → `"pr":1,"shadows":false,"nightShade":0` with `env.night = 1`.
- [PASS] 5 — `perf-lowfx` (cookie high, iframe `?lowfx`) → `"pr":1,"shadows":false,"selectDisabled":true,"cookie":"{\"quality\":\"high\"}"`.
- [PASS] 6 — `perf-migrate` → `"prefsQuality":"low"`, after 11 s of play `"savedSettings":{"volume":0.7,"sensitivity":1},"savedHasShadows":false`.
- [PASS] 7 — switch medium → high → low → medium → `"errors":0`, `pausedDraw` 1 at each step, map/right/pr/radius 512/25/1/1.6, 1024/40/1(1.5 at DPR 2)/2, 512/25/1/1.6, 512/25/1/1.6.
- [PASS] 8 — medium → `"nightShade":1`.
- [NOT SHOWN HEADLESS] 9 — review round 1: every block compiled before measuring, so this could never fail. New fresh-boot block (no setQ/compileAsync): `titlePrograms 31, programsDelta 0, max 49.9`; probe with the boot compile stripped: `titlePrograms 30, programsDelta 0, max 50`. Headless links nothing new on first sight either way, so the boot compile's value is unproven here; PP's `?stats` `prog` number on his laptop settles it. Old text: `perf-after` factory + house Medium → `progΔ=0`. The bracket "perf-before shows the growth" did not hold: before is also 0, because each block starts with its own `compileAsync` (R2); the boot effect shows as programs on the title 30 → 31.
- [PASS] 10 — `perf-after` → `{"regime":"small","hudMutations":0}` (`perf-before` 180).
- [PASS] 11 — `factory medium p95=16.7 max=16.8 over25=0`.
- [PASS] 12 — `hole medium p95=16.8 max=16.8 over25=0`.
- [PASS] 13 — `house medium p95=16.7 max=16.8 over25=0`.
- [PASS] 14 — `busy medium p95=16.8 max=16.8 over25=0`, `physics.step` p95 2.5 ms.
- [FAIL] 15 — lines present for all 4 spots x high/low; `low.p95 ≤ medium.p95` fails by 0.1 ms in one spot per run: `perf-after` factory low 16.8 vs medium 16.7; `perf-after-repeat` busy low 16.8 vs medium 16.7 (the other three spots pass in each run). Every value sits on the 60 fps cap; 0.1 ms is rAF jitter, not cost (proxy GPU time: Low 1.7-2.2 ms vs Medium 2.9 ms).
- [FAIL] 16 — `perf-after-proxy` → factory Medium 2.9 vs High 3.0 (0.97), busy 2.9 vs 3.8 (0.76); gate ≤ 0.6. `perf-before-proxy` Medium p50: factory 3.2, busy 4.0 (in BOARD). The Mac GPU is not fill-bound at 2560x1440 (heavier 3840x2160 run: 0.57 and 0.66).
- [PASS] 17 — `perf-before` setItem p95 0 (max 0.2) → `rg -n requestIdleCallback src/main.ts` → 0 hits; "5b skipped: setItem p95 = 0 ms".
- [PASS] 18 — `perf-before` over25 = 0 everywhere → `git diff --stat src/world/textures.ts` empty; "5a skipped".
- [PASS] 19 — no busy over25 entry → `git diff --stat src/entities/robots.ts` empty; "5c skipped".
- [PASS] 20 — `perf-before` `gnomeShadowAB {"on":2.7,"off":2.2,"pct":18.5}` → `rg shadowOnHigh src` → 0 hits; "5d skipped: 18.5 %".
- [PASS] 21 — `perf-stats` text `fps 60 · p95 17 ms · max 33 ms · prog 31\n…` matches; `perf-nostats` → `{"text":null}`.
- [PASS] 22 — `rg -n "hue-rotate" src/main.ts` → 1 hit (line 301), not in `git diff src/main.ts`.
- [PASS] 23 — the regex gives 6 hits, not 5 (`ParticlePool\(300` matches both `darkSparks` and `puffs`); none of the 6 lines is in the diff (`environment.ts`, `fx.ts` untouched).
- [PASS] 24 — `git diff --stat -- src/core/input.ts src/world/environment.ts src/entities/factory.ts src/player/player.ts src/ui/leaderboard.ts` → empty.
- [PASS] 25 — grass `shadows=true map=512 … follow=ok offset=0.0180 texel=0.0977`; esc: every line equal to the previous run and to `2026-10-20-esc-resume.md` except the timing-based `05b_walk_free moved=6.62` (7.65 before), `LOGS:` empty; factory: every `PASS` line, 0 `FAIL`, `LOGS:` empty; `npx tsc --noEmit` exit 0.
- [NOT SHOWN HEADLESS] 26 — same limit as 9. Review round 1 also fixed: Medium/Low pixel ratio follows browser zoom (DPR 0.8 → 0.8/0.8/0.8, was 1/1/0.8) and `?stats` freezes on the last play numbers while paused (200 ms hitch still shown after 6 s paused, was 17). Old text: no frame with `programsDelta > 0` in hole/busy (any quality), so no `links` entries; nothing to copy.
- [PASS] 27 — `over25` of Medium blocks empty; the only over25 entries in all after runs are index 105 (busy low, run 2 of the 5d variant) and 536 (busy high, repeat), both with `programsDelta 0` and game work ≤ 3.3 ms (outside stall).
- [PASS] 28 — line 2 `medium · 640x360@1 · ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max, Unspecified Version)` matches `/^(low|medium|high) · \d+x\d+@[\d.]+ · .+$/` (deviation: `prog` is on line 1 as step 4 says).
- [PASS] 29 — hidden 1.5 s then back → `maxAfterHidden: 33` (< 1000).
- [PASS] 30 — n/a (5b skipped).
- [PASS] 31 — `perf-before/head.txt` and `perf-after/head.txt` both `542ef826aff05f3751aafa21dcc28f554646177e`; the after status lists only this task's files.
- [PASS] 32 — proxy header `"pr":{"high":1.5,"medium":1,"low":1}`.
- [PASS] 33 — "thumbnails" sentence under Accepted side effects.
- [PASS] 34 — "overlay" P screenshot sentence under Accepted side effects.
- [PASS] 35 — `rg -n 'class="stats"' src/ui/menu.ts` → line 131, not in the diff; `rg -n perf-stats src` → `src/ui/stats.ts:25`, `src/ui/style.css:286`.
- [PASS] 36 — `git diff src/main.ts` → 4 added lines (import, `stats.init`, `compileAsync`, `stats.frame`), 0 removed.
- [PASS] 37 — `sed -n 1,20p CHANGELOG.md` → the 08:00 section has "High is now the old Medium look", "shadows end closer", "`?stats`".
- [PASS] 38 — every `perf-after*` run printed `RESULT` (none hit MAXPOLL).

Robot-bed crash seen by the scenario: REFUTED for the game (review-debugger, 2026-10-21). Every real removal path skips stashed gnomes (`gnomes.ts:475`, `isFree` filters in events/tornado/forEachNear, `grabbable`), taking a robot back releases its bed, rebirth and daily end reload the page; 6 targeted scenarios + 60 s natural run with 3 robots and 33 events: 0 bad frames, 0 exceptions. Only a direct `gnomes.remove` on a bed gnome (the old scenario) crashes. Rejected: a defensive "skip missing gnomes" guard in `tip()`, because no path reaches it and the rule in CLAUDE.md already forbids touching a removed gnome.
Orchestrator decision (2026-10-21): checks 15 and 16 are rejected as gates, not as results. 15 compares two runs both pinned at the 60 fps cap, so a 0.1 ms difference that moves between spots is clock jitter; the GPU-only timing shows Low 1.7-2.2 ms < Medium 2.9 ms. 16 assumed a fill-bound GPU; the Mac's is not (0.57-0.66 at 3840x2160). The real check is PP's `?stats` line on his laptop; a deeper Medium cut (OD 4 b) waits for that number instead of being guessed now.
Result: 36/38 PASS; FAIL 15 (60 fps cap jitter) and 16 (Mac GPU not fill-bound). Both need a decision, not code: accept the gates as measured, or order the deeper Medium cut of OD 4 b) / rejected variant (c).

Odrzucone: deeper cuts to make gate 16 pass (ratio 0.75, MSAA off, point lights off), because the plan rejected them for tonight and OD 4 leaves them to PP.
