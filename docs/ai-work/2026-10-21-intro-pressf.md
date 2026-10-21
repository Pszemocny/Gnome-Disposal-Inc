# Intro cards on a new game + "Press F to pay respects" on The Deep

Plan: `docs/ai-work/2026-10-21-plan-intro-pressf.md`, section `## Plan (plan-senior, final)`.

## Problem

PP (2026-10-20): "dopisz do planu na noc jakies intro" and "pres f to pay respects ... dodaj o tym komunikat podczas reborn i niech to otwiera karte w przegladarce do buy me coffie podepne konto jutro". BOARD.md N1 and N6.

Interpretation: four text cards between START HUSTLING and the first pointer lock on a fresh save; on The Deep a "Press F to pay respects" line that opens the Buy Me a Coffee page once. The link is empty today, so the line stays hidden until PP fills `LINKS.coffee`.

Decisions for PP had no answer; taken by recommendation (brief: "take the defaults"):
1. Decision 1a: four text cards in the menu style (no 3D fly-by, no in-game letter).
2. Decision 2a: no intro after a rebirth.
3. Decision 3a: Reset save shows the intro again.
4. Decision 4a: no intro on any CONTINUE; legacy saves keep the old "Follow the GOAL panel" toast.
5. Decision 5a: the Press F line also shows on a Deep inside a daily run.

## Summary

- `src/ui/intro.ts` (new): `Intro.wanted()` (not daily, `seenIntro` false, `playTime <= 1`) and `Intro.show(done)`. Click or any key except Esc advances; cards 1-3 move on after 5 s; card 4 waits. Finish sets `seenIntro = true` and calls `done` (the lock).
- `src/main.ts`: the Play callback hides the title menu and shows the intro when `intro.wanted()`, otherwise locks as before.
- `src/ui/hud.ts`: `LINKS.coffee` constant (empty). `deep()` writes lines into a `deep-lines` child; with a link, the `.deep-f` line and its F listener are born with the second whispered line (2.6 s). F opens one tab (`window.open(url, '_blank', 'noopener')`), text becomes "Respects paid. Thank you ♥". The "Be reborn" click removes the listener.
- `src/ui/style.css`: `.deep-lines { display: contents }`, `.deep-f`, `.intro .menu-card.show` fade-in 0.3 s.
- `tools/smoke/scenario-esc.js`, `tools/smoke/scenario-factory.js`: `g.state.seenIntro = true` before the first Play click (fresh profile would land on card 1).
- `CHANGELOG.md` new section `## 2026-10-21 15:00`, `docs/SPEC.md` (intro line in Interfejs, Press F line in Zapis/Odrodzenie), `BOARD.md` N6 pending line.

Ladder: `intro.ts` is rung 6 (nothing on disk sequences cards before the lock); styling reuses `.menu`, `.menu-card`, `.logo.small`, `.subtitle` (rung 2); `.deep-lines { display: contents }` is rung 3; the F gate reuses the existing 2.6 s line timer (rung 2) instead of a new arming timer.

Rejected (from the plan's Resolutions, kept as decided): three cards instead of four (card 4 is the gesture gate); popup-blocked detection (with `noopener` `window.open` always returns null); a paused-aware "press W" hint on the rare refused-lock path; excluding M/P from "any key" (M mutes and advances, P screenshots and advances, accepted).

Playtest question for PP (R8): does Safari on your Mac open the F tab without a popup prompt? Only a manual try with a real link answers it.

## Work progress

Scenario: `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-disposal-inc/4c1ea029-d602-463e-ad53-1903c38602be/scratchpad/smoke/scenario-intro-pressf.js`, run `FULL=1 DPR=1 CDP_PORT=9381 DEV_PORT=5177 MAXPOLL=1400 node tools/smoke/smoke.mjs <scratchpad>/intro <scenario>` on a private dev server (port 5177, no HMR). Final run: 25 PASS lines, `LOGS:` empty. Screenshots: `intro-card1.png` (card 1 readable over the title frame), `deep-final.png` (button 30 px under THE DEEP, "Respects paid" at the bottom), checked by eye.

Scenario fixes during the runs (test side only): F kick test needed a keyup first (the earlier synthetic F presses left F "held" in Input, so no new press); the gnome for the kick is spawned on open grass away from the hole after the player lands; Done-when 8 reads `seenIntro` right at the Play click (see Odstępstwa).

Done when:
- [PASS] 1 — `PASS 1 logo=GNOME DISPOSAL INC. paused=true titleHidden=true locks=0`
- [PASS] 2 — `PASS 2 op=0.00,0.04,0.11,0.22,0.35,0.47,0.58,0.67,0.74,0.80`
- [PASS] 3 — `PASS 3 at4.5=The factory makes gnomes.Nobod at5.3=The hole in the backyard eats them.It pa`
- [PASS] 4 — `PASS 4 Your first job is in the GOAL panel, top left.Clic`
- [PASS] 5 — `PASS 5 ... intro=false seen=true locked=true paused=false goal=GOALMake gnomes ... toasts= | top: seenIntro=true goal=true followToast=false` (FULL=1, real lock in an iframe)
- [PASS] 6 — `PASS 6 intro=false titleHidden=true hint=true paused=true calls=refused | wanted true->true newCalls=0 | locked=true paused=false` (FULL=1)
- [PASS] 7 — `PASS 7 intro=false wanted=true`
- [PASS] 8 — `PASS 8 intro=false seenAtClick=false later: seen=true locked=true` (see Odstępstwa 2)
- [PASS] 9 — `PASS 9 wanted=false`
- [PASS] 10 — `PASS 10 intro=true`
- [PASS] 11 — `PASS 11 intro=false locked=true toasts=Follow the GOAL panel in the top left corner.` (FULL=1)
- [PASS] 12 — `PASS 12 seenIntro=false`
- [PASS] 13 — `PASS 13 intro=true titleHidden=true`
- [PASS] 14 — `PASS 14 deepF=false opens=0`
- [PASS] 15 — `PASS 15 frame1=false at3s=Press F to pay respects final=true`
- [PASS] 16 — `PASS 16 ["https://example.test/x","_blank","noopener"] text=Respects paid. Thank you ♥`
- [PASS] 17 — `PASS 17 opens=1`
- [PASS] 18 — `PASS 18 reborn=true opens=1`
- [PASS] 19 — `PASS 19 deepF=true opens=[["https://example.test/daily","_blank","noopener"]]`
- [PASS] 20 — `PASS 20 deep=false y=6.9` (respawned above ground after the coin fountain)
- [PASS] 21 — `rg -n "inp.hit\('KeyF'\)" src/player/player.ts` → `579:    if (inp.hit('KeyF') && this.kickCd <= 0) this.kick();`, `git diff --stat src/player/player.ts` empty; `PASS 21 kicked 0->1`
- [PASS] 22 — `PASS 22 intro=true paused=true`
- [PASS] 23 — `PASS 23 card=Your first job is in the GOAL  muted false->true` (see Odstępstwa 1)
- [PASS] 24 — `PASS 24 opens=0 deepF=false`
- [PASS] 25 — `PASS 25 gap=30.0`
- [PASS] 26 — `npx tsc --noEmit` → no output, exit 0; scenario `LOGS:` empty
- [PASS] 27 — `scenario-esc.js` (FULL=1, port 5177): `00_title_play locked=true paused=false`, `17_leaderboard_esc lb=false menu=visible paused=true opened=true`, `19_deep_esc deep=true paused=true`, `24_late_grant menu=visible paused=true locked=false (before: paused=false locked=false)` as in `2026-10-20-esc-resume.md`; `LOGS:` empty. Run before the coordinator's stop on FULL=1.
- [PENDING] 28 — `scenario-factory.js` not run: the coordinator stopped all FULL=1 runs (full Chromium's pointer lock moves PP's real cursor). The orchestrator runs it when PP is away.

Odstępstwa:
1. Done-when 23 says "on card 1" and `g.audio.muted`: the scenario presses M on card 3 (card 1 and 2 are used by lines 2 and 3) and reads `prefs.muted` from `src/core/settings.ts` (Audio has no `muted` field; mute lands 400 ms after M).
2. Done-when 8: `seenIntro` is false at the Play click and the intro never writes it in daily; the old first-lock writer in `main.ts` (`if (!state.seenIntro) { state.seenIntro = true; toast }`) sets it once the lock is granted, as before this change. The daily never saves, so the real save is untouched.
3. Done-when 27/28 ran on DEV_PORT=5177 (brief), not 5199.

Self-check: diff is only the planned lines (intro.ts, Play callback, deep(), 3 CSS rules, 2 scenario lines, docs). No player/state/upgrades/machines/shop edits. `docs/ai-work/2026-10-21-plan-endgame.md` and `2026-10-21-plan-tree-expansion.md` changes are not mine.
