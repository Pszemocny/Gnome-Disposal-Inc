# Plan: intro on a new game + "Press F to pay respects" on The Deep

Spec: BOARD.md "Plan na noc" N1 (intro) and N6 (Press F); PP 2026-10-20 (terminal): "dopisz do planu na noc jakies intro" and "byl taki znany trend pres f to pay respects czy cos takiego poszukaj i dodaj o tym komunikat podczas reborn i niech to otwiera karte w przegladarce do buy me coffie podepne konto jutro".
Trivial check: two UI paths (title Play, The Deep screen), a save field (`seenIntro`) with two writers, a key that already has a meaning in play (F = kick), pointer-lock flow in `main.ts`; not a one-file change.

## Plan v0 (plan-author)

### Goal
A fresh save gets a skippable 3-card intro between START HUSTLING and the first pointer lock; The Deep screen shows "Press F to pay respects" once a Buy Me a Coffee link exists, and F opens it in a new tab.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | fresh save (`playTime <= 1`, `seenIntro` false), normal mode | click START HUSTLING | menu hides, intro card 1 shows over the frozen title frame; game stays paused | N1; `main.ts:111-115` |
| 2 | intro card 1..3 shown | click, any key (incl. Esc, Space, Enter) | next card, 0.3 s fade-in | N1 "skippable" |
| 3 | intro card 1..3 shown, no input | 5 s pass (real time) | next card by itself | N1 "must not delay the tutorial" |
| 4 | intro card 4 (last, "Click to start hustling") | no input | stays (never auto-advances: pointer lock needs a gesture) | `main.ts:120-121` (lock refusal path) |
| 5 | intro card 4 | click or any key | intro removed, `seenIntro = true`, `ctx.input.lock()`; lock grant → game runs, GOAL panel "Make gnomes" visible; no extra "Follow the GOAL panel" toast (card 4 says it) | N1; `main.ts:144-150` |
| 6 | intro card 4, lock refused by the browser | key press | intro removed, mouse hint "Click or press W to capture the mouse" shows, a canvas click locks (today's title path) | `main.ts:162-164, 188-190` |
| 7 | save with `playTime > 1` (CONTINUE) | click CONTINUE | no intro, lock at once (today) | N1 "never on Continue" |
| 8 | `?daily` (fresh state, `seenIntro` false) | click START HUSTLING | no intro, lock at once; `seenIntro` untouched | N1 "never in the daily challenge"; `daily.ts:36` |
| 9 | after rebirth (`freshState(old)` keeps `seenIntro` true, playTime kept) | title Play | no intro (`spec silent`) | `state.ts:111`, `hole.ts:512` |
| 10 | after Reset save (wipe + reload) | START HUSTLING | intro again (`spec silent`) | `menu.ts:61-62` |
| 11 | legacy save, `seenIntro` false, `playTime > 1` | CONTINUE | no intro; today's toast "Follow the GOAL panel…" on first lock, unchanged (`spec silent`) | `main.ts:146-149` |
| 12 | reload during the intro | boot | intro again (flag is set only on finish; the game was paused so no autosave; `beforeunload` saves `seenIntro` false) | `main.ts:192-197` |
| 13 | window blur during the intro | - | cards stay, no pause menu (`started` false) | `main.ts:183-185` |
| 14 | `LINKS.coffee === ''` (repo today) | fall in at MAX level → The Deep | no "Press F" line; F does nothing | N6 "bez adresu napis się nie pokazuje" |
| 15 | `LINKS.coffee` set | The Deep opens | line "Press F to pay respects" at the bottom from the first whispered line through the final "Be reborn" screen | N6 |
| 16 | line visible | press F | `window.open(LINKS.coffee, '_blank', 'noopener')`, line becomes "Respects paid. Thank you ♥", `ctx.audio.toast()` | N6 "otwiera kartę" |
| 17 | after one F | press F again, or F held (`e.repeat`) | nothing (one tab per screen) | N6; cost: no tab spam |
| 18 | "Be reborn" clicked → leaderboard open | type F in the name field | no tab (listener removed on the click; the leaderboard's capture listener also stops keys) | `leaderboard.ts:242-252` |
| 19 | daily run, fall in at MAX level | The Deep | same line and F behaviour as 15-17 (`spec silent`) | `player.ts:473-478`, `daily.md` D9 |
| 20 | fall in below MAX level (coin fountain, no Deep) | - | no line, F = kick as today | `player.ts:479-488` |
| 21 | normal play, unpaused | press F | kick, unchanged | `player.ts:571` |

### Reach
- `menu.ts:34` `onPlay` callback, defined `main.ts:111-115` (only caller of Play): the intro hooks here (`else if (intro.wanted()) intro.show(() => ctx.input.lock())`).
- `state.seenIntro`: readers `main.ts:146`; writers `main.ts:147` (first lock), `state.ts:111` (`freshState(keep)` at rebirth), new: `intro.ts` finish. Loaded via spread in `loadState` (`state.ts:148-156`), so a missing key reads false.
- `hud.deep(shards, done)` `hud.ts:343-369`: caller `player.ts:477`. `.deep` DOM readers: `main.ts:139` (lock grant released while the Deep is up), `:153` (no pause menu), `:176` (Esc ignored). The intro uses class `intro`, never `deep`, so these guards stay as they are.
- `ctx.leaderboard.offer` `leaderboard.ts:276-279`: runs from the "Be reborn" click; its window keydown capture listener (`:242-252`) stops every key while open.
- `daily.active` `daily.ts:36`: readers `main.ts:45`, `menu.ts` (title variants); new reader: `intro.wanted()`.
- `Input` keydown `input.ts:27-32` keeps collecting `pressed` during the Deep and the intro; `player.update` does not run while `ctx.paused` (`main.ts:233`), `endFrame` clears it each frame: F cannot kick on either screen.
- Front contract: none (no backend). Save shape: unchanged (`seenIntro` exists).

### Data
- `localStorage` key `gnome-boozed-save-v1`, field `seenIntro: boolean` (exists). No new field, no index, no network. Cost: one `window.open` per Deep screen at most.

### Steps (edit order)
1. `src/ui/hud.ts` top, next to the constants: `export const LINKS = { coffee: '' }; // Buy Me a Coffee page (PP adds it); empty = no "Press F" line on The Deep`. An object, not a bare `const` string, so a scenario can set it (`import('/src/ui/hud.ts').LINKS.coffee = …`).
2. `src/ui/hud.ts` `deep()`: write the whispered lines into a child `lineEl = h('div', 'deep-lines', el)` instead of `el.innerHTML` (so a sibling survives the final screen). When `LINKS.coffee` is non-empty: `const f = h('div', 'deep-f', el); f.textContent = 'Press F to pay respects';` and `const onF = (e: KeyboardEvent) => { if (e.code !== 'KeyF' || e.repeat || paid) return; paid = true; window.open(LINKS.coffee, '_blank', 'noopener'); f.textContent = 'Respects paid. Thank you ♥'; ctx.audio.toast(); }; window.addEventListener('keydown', onF);` The "Be reborn" click handler runs `window.removeEventListener('keydown', onF)` before `done()`. Final screen keeps `lineEl` content `THE DEEP` + button as today.
3. `src/ui/style.css` after `.deep-line`: `.deep-f { position: absolute; bottom: 28px; font: 700 18px var(--font); color: #b0f0ff; opacity: .8; letter-spacing: 1px; animation: fadein 1.2s; }`.
4. `src/ui/intro.ts` (new, ~45 lines): `export class Intro { wanted(): boolean; show(done: () => void): void }`.
   - `wanted()` = `!daily.active && !ctx.state.seenIntro && ctx.state.stats.playTime <= 1` (same `playTime` test as the START HUSTLING label, `menu.ts:119`).
   - Cards (const, exact text): 1 `GNOME DISPOSAL INC.` / `Welcome aboard, new hire.`; 2 `The factory makes gnomes.` / `Nobody wants them.`; 3 `The hole in the backyard eats them.` / `It pays cash. Feed it, it grows.`; 4 `Your first job is in the GOAL panel, top left.` / `Click to start hustling`. First line of each card in `.logo.small`, second in `.subtitle` (classes from `style.css:256-257`).
   - DOM: `<div class="menu intro"><div class="menu-card">…</div></div>` (reuses `.menu` z-index 30 and `.menu-card`), appended to `document.body`, built on `show()`, removed on finish.
   - Advance: `window` keydown (any code, `!e.repeat`) and `mousedown` on the overlay; cards 1-3 also advance on a 5 s `setTimeout` (cleared on manual advance); card 4 never auto-advances. Finish: clear timer, remove listeners and element, `ctx.state.seenIntro = true`, `done()`.
   - Card swap: replace the card's innerHTML and restart `animation: fadein .3s` by `el.classList.remove('show'); void el.offsetWidth; el.classList.add('show')` (same trick as `hud.ts:321-322`). CSS: `.intro .menu-card.show { animation: fadein .3s; }`.
5. `src/main.ts:111-115`: `const intro = new Intro();` before the menu; Play callback: `if (started) resume(); else if (intro.wanted()) intro.show(() => ctx.input.lock()); else ctx.input.lock();`. Lines 146-149 (first-lock toast) stay as they are: after the intro `seenIntro` is already true, so the toast does not fire (row 5); the legacy path (row 11) keeps it. Edit last and only these lines: the factory-bugs and performance agents have uncommitted lines in `main.ts`.
6. `CHANGELOG.md`: one bullet under the newest `##` section (add it, do not rename the heading; the factory agent edits the same file): intro on a new game (click or any key to skip) and "Press F to pay respects" on The Deep once the link is in. Test lines for PP: start a new game from Reset save; reach The Deep with the link set.
7. `docs/SPEC.md`: menu section line 220: the intro (4 cards, skip with click/key, once per save, not after rebirth, not in daily; why: PP asked for an intro, the cards stay short so the GOAL panel starts within 20 s); rebirth section line 262: the Press F line, the link constant `LINKS.coffee` in `src/ui/hud.ts`, hidden while empty (why: PP adds the account later; the meme fits the funeral tone of The Deep).
8. Note `docs/ai-work/2026-10-21-intro-pressf.md` (Problem / Summary / Work progress with the Done-when PASS lines).

### Tests
Scenario `smoke/scenario-intro-pressf.js` in the session scratchpad, run with `FULL=1` (pointer lock), dev server on 5199; rows map 1:1 to Done when below. Shape: like `tools/smoke/scenario-tutorial-goals.js` (`frames()`, `ok()`, `blockSaves()`, crafted `freshState()` saves, iframe for `?daily`). `window.open` stubbed to record `[url, target, features]` and return null. F sent as `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))`. The Deep reached by `g.hud.deep(5, () => (window.__reborn = true))` with `LINKS.coffee` set/unset. Animation check (rule 3/12): sample `getComputedStyle(card).opacity` for 10 frames after a card swap, at least one value strictly between 0 and 1, one screenshot of card 1.

### Done when
1. fresh state, click `[data-a="play"]` → `document.querySelector('.intro .logo')?.textContent === 'GNOME DISPOSAL INC.'`, `g.paused === true`, `.menu:not(.intro)` hidden.
2. dispatch keydown `Space` → card text contains `Nobody wants them.`; opacity samples over 10 frames include a value in (0, 1).
3. wait 5.3 s real time with no input on card 2 → card text contains `It pays cash`.
4. on card 4 wait 6 s → card text still contains `Click to start hustling`.
5. dispatch `mousedown` on `.intro` → `.intro` gone, `g.state.seenIntro === true`, after lock `g.paused === false`, `.hud-goal` text contains `Make gnomes`, toasts contain no `Follow the GOAL panel`.
6. with `canvas.requestPointerLock` stubbed to dispatch `pointerlockerror`, finish card 4 by key → `.intro` gone, `.click-to-play` not hidden, `g.paused === true`.
7. state `stats.playTime = 30` → click play → no `.intro`, `g.input.wanted === true`.
8. iframe `?daily` → click play → no `.intro` in the iframe, `gnome.state.seenIntro === false`.
9. `freshState(oldWithSeenIntroTrue)` → `intro.wanted() === false`.
10. `localStorage.removeItem(KEY)` + reload (iframe `/`) → click play → `.intro` present.
11. state `{ seenIntro: false, stats.playTime: 30 }` → click play → no `.intro`; after lock, toasts contain `Follow the GOAL panel`.
12. on card 2, `g.state.seenIntro === false` (flag only at finish) and `localStorage` save (after `saveState(g.state)`) has `"seenIntro":false`.
13. on card 2 dispatch `blur` on window → `.intro` present, `.menu:not(.intro)` still hidden.
14. `LINKS.coffee = ''`, `g.hud.deep(5, …)` → no `.deep-f`; keydown F → `openCalls.length === 0`.
15. `LINKS.coffee = 'https://example.test/x'`, `g.hud.deep(5, …)` → `.deep-f` text `Press F to pay respects` on frame 1 and still present after the final `Be reborn` button appears (`MAXPOLL` long enough for 9 × 2.6 s).
16. keydown F → `openCalls[0]` equals `['https://example.test/x', '_blank', 'noopener']`, `.deep-f` text `Respects paid. Thank you ♥`.
17. keydown F twice more (one with `repeat: true`) → `openCalls.length === 1`.
18. click `Be reborn` → `window.__reborn === true`; keydown F → `openCalls.length` unchanged.
19. iframe `?daily` with `LINKS.coffee` set in the iframe module, `gnome.hud.deep(5, …)` → `.deep-f` present; keydown F in the iframe → one open call.
20. normal state, `g.hud.deep` not called, `g.player.fellIn` path below MAX (`holeLevel 3`, set `y = -5`) → no `.deep`, no `.deep-f`.
21. `rg -n "inp.hit\('KeyF'\)" src/player/player.ts` → 1 hit, unchanged line; unpaused frame with `pressed` containing `KeyF` → `g.state.stats.kicked` +1.
Plus `npx tsc --noEmit` → no output; `LOGS:` of the scenario empty.

### Assumptions (numbered)
1. "Intro" = a few text cards, not a cinematic (PP said "jakies intro"; the title card already has the long "how" box, so the intro is tone, not a manual).
2. The intro replaces today's one-line first-lock toast for players who see it (card 4 says the same); the toast stays for legacy saves.
3. The Press F line belongs to the whole Deep screen, not only the final button screen: the whispered lines last 23 s and that is when the player reads.
4. One tab per Deep screen; a second F does nothing.
5. Headless shell has no pointer lock: the scenario runs with `FULL=1` as the changelog and esc scenarios did.

### Alternatives rejected
- (b) 3D camera fly-by factory → hole with captions: the camera is written from `player.yaw/pitch` every frame (`player.ts:1034-1044`), so a fly-by needs a camera override in `Player`, dt-driven easing and a sampled-curve scenario (animation rules 1, 2, 9, 12); ~150 lines in the file two other agents edit; a cinematic at 5 fps headless is hard to verify. Rejected for the night; offered to PP as option.
- (c) "Letter from the boss" as an in-game HUD card after the first lock: competes with the GOAL panel and the first toast in the left column (`hud.ts` cards, max 4), and a letter long enough to read would have to pause the game, which is what the cards before the lock already do. Rejected.
- Generalising `hud.deep()` into a shared line sequencer for both screens: the Deep carries `.deep` guards in `main.ts` (Esc, lock, pause) and black-screen whispers; sharing it would make the intro trip those guards. Rejected.
- `VITE_COFFEE_URL` env var like Supabase: the link is public anyway and PP said "podepne konto jutro"; one constant is the brief. Rejected.
- Opening the link via an `<a target="_blank">` instead of `window.open`: a keyboard "F" has no anchor to click; `window.open` inside the keydown handler is a user gesture, so it is not popup-blocked. Rejected.

### Ladder
- `src/ui/intro.ts` (new file): rung 6; needed by N1 "krótkie wprowadzenie na start nowej gry"; nothing on disk sequences cards before pointer lock (`deep()` is the ending screen, rung-2 reuse rejected above). Styling reuses `.menu`/`.menu-card`/`.logo.small`/`.subtitle` (rung 2).
- `LINKS.coffee` constant in `hud.ts`: rung 5; N6 "adres w jednej stałej, a bez adresu napis się nie pokazuje".
- `.deep-f` CSS rule and `deep-lines` child: rung 5; N6 "na ekranie odrodzenia napis".
- `onF` listener with `paid` flag: rung 5; one tab per screen (assumption 4).
- `intro.wanted()` branch in the Play callback: rung 5; N1 "once per save, never on Continue, never in the daily challenge".
- 5 s auto-advance timer: rung 5; N1 "must not delay the tutorial" (worst case 15 s + one click).
- No new dependency, no new save field, no fallback when `window.open` returns null (rung 1: nothing asked for).

### Open decisions (for PP)
1. Intro form: a) 4 short text cards in the menu style, skip with click or any key, worst case 15 s before the game starts (recommendation: a, ships tonight, no camera code, cannot delay the tutorial); b) 3D fly-by factory → hole with captions (8-10 s, more code in `player.ts` while two agents edit it, risk of a slow first impression on weak machines); c) "letter from the boss" card inside the game after the first click (competes with the GOAL panel). Plan assumes a; b or c changes steps 4-5.
2. [spec silent] Zakładam: after a rebirth there is no intro (the save keeps `seenIntro` true) | Dowód: `state.ts:111`, `hole.ts:512` | Jeśli źle: a reborn player sees the "new hire" cards again every run | Pewność: Confident | rekomendacja: a) no intro after rebirth.
3. [spec silent] Zakładam: Reset save shows the intro again (wipe + reload = fresh state) | Dowód: `menu.ts:61-62`, `state.ts:68` | Jeśli źle: PP testing from Reset save sees it each time; that is the intended test path | Pewność: Confident | rekomendacja: a) show it again.
4. [spec silent] Zakładam: a save from before this change with `seenIntro` false and play time > 1 s gets no intro and keeps today's one-line toast | Dowód: `main.ts:146-149`, `state.ts:148-156` | Jeśli źle: an old player sees the intro once on CONTINUE | Pewność: Likely | rekomendacja: a) no intro on any CONTINUE.
5. [spec silent] Zakładam: the "Press F" line also shows on a Deep reached inside a daily run | Dowód: `player.ts:473-478` calls `hud.deep` in every mode, `daily.md` D9 | Jeśli źle: daily players miss the link, nothing breaks | Pewność: Likely | rekomendacja: a) same screen, same line.
6. Text after pressing F: a) "Respects paid. Thank you ♥" (recommendation: a); b) keep "Press F to pay respects" and allow a new tab per press (tab spam on a held key).
7. Decision age: none; every decision this plan rests on is from 2026-10-19/20.

### Self-check
- Every acceptance criterion (N1: new game, skippable, once per save, not on Continue, not in daily, tutorial not delayed; N6: line on The Deep, F opens a tab, hidden while the constant is empty, no clash with kick) has a matrix row, a step and a Done-when line: yes.
- Every step names the file, signature, class names and exact texts: yes (card texts, `LINKS`, `.deep-f`, `onF`, `wanted()`).
- `seenIntro`: all writers (`main.ts:147`, `state.ts:111`, new `intro.ts`) and readers (`main.ts:146`, new `intro.ts`) listed: yes.
- Lists compared with code: ways a run starts (title fresh, Continue, daily, rebirth, Reset save, legacy save) vs brief's three → 3 `spec silent` rows (9, 10, 11); Deep entry points (normal, daily, below-MAX fall) vs brief's one → 1 `spec silent` row (19) plus row 20. Matrix 21 rows, 4 `spec silent`; Done when 21 lines.
- Decisions older than 60 days: none used.
- Plan shorter than the code it describes: intro.ts ~45 lines + hud/css/main ~25 lines + scenario ~150 lines; the plan body is comparable to the scenario, shorter than code plus scenario.

## Review: performance (plan-performance)

Verdict: APPROVE

No database here, so cost means boot time, first-frame and shader cost, DOM and layout work, listeners and bundle size. Measured by reading code: `src/main.ts:111-240` (play callback, lock flow, paused loop), `src/ui/hud.ts:341-368` (`deep()`), `src/core/input.ts:26-32`, `src/ui/style.css:285-287`.

| plan step | operation | shape / index | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 4, 5 | intro overlay over the title frame | DOM `.menu.intro` > `.menu-card`, 2 text nodes per card; no WebGL work | built once per fresh save, 4 innerHTML swaps | 4 cards (plan step 4) | while `ctx.paused` the loop skips systems and draws only on `redraw` (`main.ts:199-207`, `:233`), so the intro adds no render or physics cost; the opacity fade runs on the compositor | none |
| 4 | auto-advance `setTimeout(5000)` | one timer, cleared on manual advance | at most 3 per save | 3 cards | none | none |
| 4 | intro `keydown` + `mousedown` listeners | added on `show()`, removed on finish | 2 listeners, once per save | - | none; no leak because finish removes them | none |
| 4 | `wanted()` | 3 field reads | once per Play click | - | none; `playTime` does not grow while paused (`main.ts:236`), so the test stays stable during the intro | none |
| 2 | `deep()` lines into `deep-lines` child + `.deep-f` sibling | 1 extra div, 1 extra listener | 9 line swaps every 2.6 s, as today | 9 lines (`hud.ts:344-353`) | same as today; the listener is removed on "Be reborn", the only exit of the screen | none |
| 2 | `window.open` on F | `paid` flag + `e.repeat` guard | at most 1 per Deep screen | - | one tab; held F cannot spam tabs | none |
| 3, 4 | new CSS rules, `intro.ts` module | static import, no new asset, no new font (`.logo.small`/`.subtitle` and Creepster already load) | once at boot | ~45 + ~25 lines | about 1-2 KB in the bundle; no new texture, no new material, so no shader recompile | none |

Findings: none.

No findings on: intro DOM and timers, Play-callback branch, `deep()` rewrite and its F listener, `window.open` guard, CSS and bundle growth, first-frame and shader cost (no lights, materials or textures added), memory (no arrays kept after the screens close). The 23 s wait in Done-when 15 is test runtime, not game cost.

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: The plan hangs the intro on the one place a run starts from zero (the Play callback before the first lock), keys it on two fields that already exist (`seenIntro`, `playTime`), and keeps it out of the `.deep` guards, so Esc, blur and lock logic stay untouched. The Press F line is passive text, hidden while the link is empty, opens at most one tab per screen (`paid` + `e.repeat`), and the listener dies on the only exit of the Deep. Strong points: no new save field, the daily and Continue paths are excluded by construction, the leaderboard's capture listener already stops F while the name field is open, and the open happens inside a real keydown, so browsers count it as a user gesture.

Findings:
- [Major] A fresh F press in the first second of The Deep opens the coffee tab before the player has seen the line.
  Assumption: the `e.repeat` filter is enough to stop an accidental F carried over from gameplay.
  Scenario: the player kicks gnomes at the hole edge (F = kick, `player.ts:571`), slips in at MAX level, and taps F again 200 ms later out of habit. `deep()` has just run `ctx.input.unlock()` (`hud.ts:365`); the tap is a new keydown with `repeat: false`, so `onF` opens the tab at once. A held F is filtered, a re-tap is not.
  Checked: `player.ts:470-477` (fall triggers the Deep inside the play frame, no delay), `input.ts:82-86` (unlock clears `keys`, so even the game's own state forgets F was down), plan step 2 (listener added in `deep()` with no arming delay).
  Impact: a new tab takes focus in the middle of the ending scene; the whispered lines play to an empty tab; this is exactly the pushy ad PP does not want ("nienachalne").
  Recommendation: arm `onF` only once the "Press F" line has been on screen for about 1.5 s (or show the line from the second whispered line on); add a Done-when line "keydown F 0.2 s after `deep()` → `openCalls.length === 0`".
- [Major] Step 5 never hides the title menu, so a refused lock after the intro shows no mouse hint and a canvas click does nothing.
  Assumption: row 1 says "menu hides", but no step does it; today only the lock grant hides it (`main.ts:140`).
  Scenario: fresh save, START HUSTLING, cards 1-4, the player finishes card 4 with Esc (Esc is not a user-activation key, the browser refuses the lock) or the browser refuses for another reason. `onLockError` checks `!menu.visible` (`main.ts:166-168`), the title menu is still `visible = true` under the removed intro, so no hint; the canvas mousedown handler also requires `!menu.visible` (`main.ts:187-189`).
  Checked: `menu.ts:31,87-88,152-153` (`visible` flips only in `show`/`hide`), `main.ts:111-115` (Play callback does not call `menu.hide()`), plan step 5 text.
  Impact: the player lands back on the title card he just left and must click START HUSTLING a second time; Done-when 1 (`.menu:not(.intro)` hidden) and 6 (hint visible) fail as written.
  Recommendation: in the Play callback call `menu.hide()` before `intro.show(...)`; with the menu hidden and `ctx.paused` true the Esc handler (`main.ts:176-179`) and blur handler (`:183`) still do nothing, which is what rows 6 and 13 want.
- [Minor] The two committed scenarios that click Play on a fresh headless profile will hit the intro and stop.
  Scenario: `tools/smoke/scenario-esc.js:78` and `tools/smoke/scenario-factory.js:84` click `[data-a="play"]` on a fresh state and expect a lock; now they get card 1. Recommendation: set `g.state.seenIntro = true` at the top of both and rerun them as part of Done when.
- [Minor] "Respects paid. Thank you ♥" shows even when the tab did not open. With `noopener` `window.open` returns null in every case, so a blocked popup (Safari settings, an extension) is invisible to the code. The synthetic `dispatchEvent` in the scenario is untrusted and the stub hides blocking, so no test covers it. Acceptable for a tip line; PP checks once by hand in the browsers he cares about.
- [Minor] The empty `LINKS.coffee` can ship forever: nothing in the game or the build reminds anyone. Recommendation: one pending line in `BOARD.md` ("N6 waits for PP's Buy Me a Coffee URL in `LINKS.coffee`") so it shows up in the next night plan.
- [Minor] Text-card fatigue: a new player reads the title card with its "how" box, then four more text cards, card 4 repeating the GOAL hint. This is Open decision 1 (PP's call), not reopened here; if PP keeps option a, three cards (drop card 4's second sentence into card 3) cut one more click.

Scenarios checked explicitly:
- State changes during the step: blur or Esc during the cards → no break, `started` false and `ctx.paused` true keep `main.ts:176-185` quiet. Deep shown while a lock grant is in flight → no break, `main.ts:139` releases it on `.deep`.
- Old timer after a state change: the 5 s auto-advance after a manual advance → no break if the plan's "cleared on manual advance" is implemented; the timer must also be cleared on finish (plan says so).
- F twice / held F: no second tab (`paid`, `e.repeat`). Re-tap at Deep start: breaks, finding 1.
- Pointer lock held when the tab opens: no break, `deep()` unlocks first, and a tab switch drops the lock anyway; `onLockChange(false)` sees `.deep` and skips the pause menu (`main.ts:153`).
- Returning players and the daily: no break, `playTime > 1` and `daily.active` gate `wanted()`; `playTime` only grows while unpaused (`main.ts:236`), so the intro cannot trigger itself.
- Reload mid-intro: intro again (row 12), harmless.
- F after "Be reborn" while the leaderboard is open: no tab, capture listener stops it (`leaderboard.ts:242-252`) and `onF` is removed on the click.
- Stale listener after rebirth: no break, the Be reborn click is the only way out of the Deep (no other code removes `.deep`, grep in `src`).
- Pushy on every rebirth: no break, the line is passive and rebirth needs MAX hole level, so it shows a few times per player; finding 1 is the only path to an unasked tab.

Pre-mortem: A week later PP writes "kliknąłem F i od razu wyskoczyła karta, zanim cokolwiek przeczytałem" or "po intro zostałem na ekranie tytułowym". The first is the re-tapped kick at the hole edge (finding 1); the second is the missing `menu.hide()` when the lock is refused (finding 2). The signal missed is that every scenario dispatches F long after `deep()` and stubs pointer lock grants, so neither the habit tap nor a real refusal ever runs.
Inversion worth considering: show the Press F line only on the final "Be reborn" screen instead of the whole Deep; it removes finding 1 entirely (by then 23 s have passed and no kick is in flight), at the cost of assumption 3 (players read during the whispers).
Investigate first: does Safari on PP's Mac open a `window.open` from a keydown F without a popup prompt? Only a manual try with a real link answers it.

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [High] `src/main.ts:109-115` (the title `Menu`): no step says who hides it when the intro opens, and `intro.show(done)` gets no handle to `menu`. Today the Play click never calls `menu.hide()`; only `onLockChange` (`:141`) and `resume()` (`:129`) do. If the title menu stays up under the intro, `menu.visible` stays true, so after a refused lock `onLockError` (`:166`, `!menu.visible`) shows no hint and the canvas mousedown (`:188`, `!menu.visible`) never locks. Row 6 and Done-when 1 (`.menu:not(.intro)` hidden) then fail, and the player sees the title menu again. Fix: step 5 calls `menu.hide()` before `intro.show(...)` in the Play callback. Both outcomes of a refused lock must be written in row 6: hidden menu + hint, or the title menu back.
- [Medium] Row 6 says "today's title path" and "Click or press W". Today a refused lock at the title keeps the menu visible and shows no hint. With the menu hidden, `ctx.paused` is still true (the title never unpaused). The walk-key lock in `main.ts:174` needs `!ctx.paused`, so W does nothing while the hint says "press W". Only a click works. Fix: write that only a click locks in row 6 and Done-when 6. The other option is a paused-aware hint text. Do not change the walk-key rule from `2026-10-20-esc-resume.md`.
- [Medium] Row 2 and row 5 accept Esc as "any key". On card 4, Esc finishes the intro and calls `ctx.input.lock()` from the Esc keydown. Browsers do not count Esc as a user gesture (`2026-10-20-esc-resume.md:7`: "Esc does not count as a user gesture"). So on card 4, Esc always takes the row 6 refusal path. Fix: on card 4 ignore Esc, or let only click/Enter/Space finish. Add a matrix row for it.
- [Medium] `tools/smoke/scenario-esc.js` (committed) and `tools/smoke/scenario-factory.js` (uncommitted, factory agent, `:84` `clickEl('.menu [data-a="play"]')` then expects `calls[0]` from the lock at once) click Play on a fresh headless profile with `playTime 0`. After this change they land on intro card 1 instead of a lock, so their first steps break. Fix: add a step that sets `g.state.seenIntro = true` (or `stats.playTime = 2`) before Play in both scenarios. Tell the factory agent, because its file is in flight.
- [Low] The intro's "any key" listener sits next to the other global keydown handlers that still act on the title frame. M toggles mute (`audio.ts:18`, not gated on paused) and P takes a screenshot (`shot.update` at `main.ts:304`, every frame). So skipping a card with M also mutes the game. Fix: write it down as accepted, or skip on any key except M/P.
- [Low] Step 2 moves the final "THE DEEP" line and the "Be reborn" button into the `deep-lines` child. `.deep` (`style.css:285`) spaces its children with `gap: 24px`. Inside the new child the button sits flush under the title. Fix: give `.deep-lines` the same flex column + gap, or keep the button as a direct child of `el`.

Neighbours checked: draft/live: not affected (no such concept in this game) | profiles / ladder: not affected | serve-cache: not affected | auto-regeneration jobs: not affected | polling/imports: not affected (no backend) | find_best/cohorts: not affected | dimensions/formulas: not affected | text index / search: not affected | prompt context: not affected | widget: not affected | pointer-lock flow (`onLockChange`, `onLockError`, canvas mousedown, Esc/walk-key/blur listeners in `main.ts:136-190`): affected, see the first three findings | rebirth: affected only through the F listener. `hole.ts:531` does `location.reload()`, so a leftover `pressed` F or listener cannot kick after the rebirth. Before that, `endFrame` (`main.ts:312`) clears `pressed` every frame, paused too, so F never kicks on the Deep | leaderboard: not affected. Its capture listener (`leaderboard.ts:242-252`) only runs while open, and `onF` is removed on the "Be reborn" click before `offer`. The `MutationObserver` reads the first `.menu` (`:255`), which is the `Menu` built before any intro | daily: `main.ts:45` starts a daily on `freshState()` and the daily never saves, so `seenIntro` cannot leak into the real save. `intro.wanted()` excludes daily, as rows 8 and 19 say. The daily's own end (`daily.ts:52-55`) opens the leaderboard, not the Deep | tutorial goals: not affected. Goals and lessons tick inside the unpaused block (`main.ts:236-271`) and nothing runs on real time while the intro is up, so the 5 s timers do not eat lesson time | shop/legend/blueprints hotkeys: not affected. `legend.update` and `blueprints.update` run only when unpaused, and the close handlers need `isOpen` | What's new / changelog: `menu.ts:43-46` renders `CHANGELOG.md`, and step 6 adds a bullet to the factory agent's uncommitted top section. This is consistent with the memory rule "every 5300 build gets a CHANGELOG.md section first" | screenshots (P): see the Low finding | save/migration: `seenIntro` has three writers (`main.ts:147`, `state.ts:111`, new `intro.ts`). The plan lists them all and adds no migration. Correct.
FE/BE: none (no backend; `window.open` target only).
Decisions: consistent with `docs/ai-work/2026-10-20-esc-resume.md` (walk keys and click capture the mouse, blur pauses only after `started`), except the Esc-on-card-4 case above | consistent with `docs/ai-work/2026-10-20-tool-hints-fall.md:22` (`seenIntro` kept through a rebirth) | consistent with `docs/ai-work/2026-10-20-daily.md` (a daily never saves).
Decisions older than 60 days: none (every note in `docs/ai-work` is from 2026-10-19 or later).
Regression vs current behaviour: the first-lock toast "Follow the GOAL panel…" goes away for new players. The plan does this on purpose (assumption 2, row 5) | the two smoke scenarios that click Play on a fresh profile (Medium finding above).

## Plan (plan-senior, final)

Status: needs-decision (only PP question 1, intro form; the plan builds option a tonight, b/c would replace steps 4-5)

### Resolutions
- R1: roaster [Major] habit F re-tap in the first second of The Deep vs v0 assumption 3 (line from the first whisper) vs roaster's inversion (line only on the final screen): Decision: the "Press F" line and its listener are created together when `deep()` writes the SECOND whispered line (2.6 s in), inside the existing `next()` timer; before that F does nothing and no line exists. Rationale: the inversion kills the re-tap but also 20 s of reading time (assumption 3 holds: the whispers are when the player reads); a separate 1.5 s arming timer is a new timer for the same effect that the existing 2.6 s line timer already gives (rung 2 over rung 6). Checked: `hud.ts:342-367` (`next()` runs every 2.6 s, `i` counts lines), `input.ts:82-86` (unlock clears `keys`, so the game cannot tell a re-tap from a first tap).
- R2: roaster [Major] + impact [High] nobody hides the title menu under the intro: Decision: accepted; the Play callback calls `menu.hide()` before `intro.show(...)`. Rationale: both reviewers are right that `onLockError` (`main.ts:166`) and the canvas mousedown (`:188`) need `!menu.visible`; without it a refused lock drops the player back on the title card. Checked: `menu.ts:152-155` (`visible` flips only in `show`/`hide`), `main.ts:109-113` (Play callback never hides).
- R3: impact [Medium] Esc on card 4 can never grant the lock (not a user gesture) vs v0 "any key": Decision: Esc is ignored on EVERY card (`e.code === 'Escape'` returns early); every other key and a mousedown advance; card 4 finishes on the same set. Rationale: per the HTML spec every keydown except Esc is a user activation, so "any key but Esc" keeps N1 "skippable" with one rule for all four cards; "Esc skips cards 1-3 but not card 4" would make the same key do two things 5 s apart. Esc on cards 1-3 would also hit the `main.ts:176-179` handler, which does nothing while paused with the menu hidden. Checked: `2026-10-20-esc-resume.md:7`, `main.ts:174-179`.
- R4: impact [Medium] row 6 "Click or press W" while `ctx.paused` is true: Decision: row 6 reads "only a click locks; the hint pill shows today's text". Rationale: W is gated on `!ctx.paused` (`main.ts:174`) on purpose (decision 1a of `2026-10-20-esc-resume.md`, not reopened); with R3 the refusal path is only a genuine browser refusal after a real key, rare enough that a second hint text is rung 1 (nothing asked for). Checked: `main.ts:174`.
- R5: impact [Medium] + roaster [Minor] `tools/smoke/scenario-esc.js` and `tools/smoke/scenario-factory.js` land on card 1: Decision: accepted; step 6 sets `g.state.seenIntro = true` before the first Play click in both and the final run reruns both. This plan runs after the factory fixes (brief sequencing), so the factory file is on disk by then; the implementer edits it, anchored by text, no message to the factory agent. Checked: `scenario-esc.js:78`, `scenario-factory.js:84`.
- R6: impact [Low] M (mute) and P (screenshot) during the intro: Decision: accepted as is; M toggles mute AND advances the card, P takes a screenshot of the frozen title AND advances. Rationale: both keys do the same on the title card today; an exclusion list for two keys is rung 1. Written as matrix row 23.
- R7: impact [Low] button flush under "THE DEEP" inside the new `deep-lines` child: Decision: `.deep-lines { display: contents; }`, so its children stay in `.deep`'s flex column with the 24 px gap. Rationale: one platform CSS rule (rung 3) beats duplicating the flex rules or keeping the button outside the child (then `innerHTML` on `el` would still wipe `.deep-f`). Checked: `style.css:285`.
- R8: roaster [Minor] "Respects paid" shows even when the popup was blocked: Decision: accepted, no detection. Rationale: with `noopener` `window.open` returns null in every case, so there is nothing to test; the roaster's "investigate first" (Safari on PP's Mac) goes into the ai-work note as a playtest question for PP, like the browser table of `2026-10-20-esc-resume.md`.
- R9: roaster [Minor] empty `LINKS.coffee` can ship forever: Decision: accepted; step 9 adds one pending line under N6 in `BOARD.md` (local, gitignored).
- R10: v0 open decision 6 (text after F) moved out of the PP block: Decision: a) "Respects paid. Thank you ♥", one tab per Deep screen. Rationale: b) is tab spam on a held key; this is copy in one string, PP changes it in one place if he wants another line.
- Rejected: roaster [Minor] three cards instead of four, because card 4 is the gesture gate ("Click to start hustling" never auto-advances) and the one instruction the player must act on; merging it into an auto-advancing card 3 puts "click to start" on a card that moves on by itself. Cost of keeping it: one click, at most 5 s.

### Chosen variant
(a) Four text cards in the menu style between START HUSTLING and the first lock (any key but Esc, or a click, advances; cards 1-3 auto-advance after 5 s), the title menu hidden under them; on The Deep the "Press F to pay respects" line appears with the second whispered line and F opens one tab. Pros: no camera code, no new save field, excluded from Continue/daily/rebirth by two existing fields, the F listener cannot fire on a habit tap. Cons: text after the title card's "how" box (fatigue), worst case 15 s + one click before play, stale "press W" hint on the rare refusal path. Cost: none at runtime (paused loop draws only on `redraw`), ~1-2 KB bundle, at most one `window.open` per Deep (plan-performance). Risk: the two pre-mortem failures (tab before reading, title card back after the intro) are closed by R1 and R2 and each has a Done-when line. Ladder: rung 6 only for `intro.ts`; the rest rung 2-5 as in v0.
### Rejected variant(s)
- (b) 3D fly-by factory → hole: pros: a real intro; cons: ~150 lines in `player.ts` while two other agents edit it, four animation rules to prove at 5 fps headless; rejected for tonight, offered to PP as question 1.
- (c) "Press F" only on the final "Be reborn" screen: pros: removes the re-tap by construction; cons: the player reads during the 23 s of whispers, not on the button screen; rejected because R1 closes the re-tap at a cost of one `if` in the existing timer.
- (d) three cards: rejected above.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | fresh save (`playTime <= 1`, `seenIntro` false), normal mode | click START HUSTLING | title menu hidden (`menu.hide()`), intro card 1 over the frozen title frame; `paused` stays true | v0 + R2 |
| 2 | card 1..3 | click, or any key except Escape (`!e.repeat`) | next card, 0.3 s fade-in; the 5 s timer of the old card is cleared | v0 + R3 |
| 3 | card 1..3, no input | 5 s real time | next card by itself | v0 |
| 4 | card 4 | no input | stays forever | v0 |
| 5 | card 4 | click or any key except Escape | intro removed, `seenIntro = true`, `ctx.input.lock()`; grant → game runs, GOAL panel "Make gnomes", no "Follow the GOAL panel" toast | v0 |
| 6 | card 4, lock refused by the browser | key press | intro removed, menu stays hidden, hint pill "Click or press W to capture the mouse" shows, `paused` true; only a canvas click locks (W needs `!paused`) | R2, R4 |
| 7 | `playTime > 1` (CONTINUE) | click | no intro, lock at once | v0 |
| 8 | `?daily`, fresh state | click START HUSTLING | no intro, lock at once, `seenIntro` untouched | v0 |
| 9 | after rebirth (`freshState(old)` keeps `seenIntro`) | title Play | no intro [spec silent, PP 2] | v0 |
| 10 | after Reset save | START HUSTLING | intro again [spec silent, PP 3] | v0 |
| 11 | legacy save, `seenIntro` false, `playTime > 1` | CONTINUE | no intro; today's toast on first lock [spec silent, PP 4] | v0 |
| 12 | reload during the intro | boot | intro again (`seenIntro` set only on finish) | v0 |
| 13 | window blur during the intro | - | cards stay, no pause menu | v0 |
| 14 | `LINKS.coffee === ''` | The Deep | no `.deep-f` ever; F does nothing | v0 |
| 15 | `LINKS.coffee` set | The Deep | `.deep-f` "Press F to pay respects" appears with the second whispered line (2.6 s) and stays through the final "Be reborn" screen | R1 |
| 16 | line visible | press F | `window.open(LINKS.coffee, '_blank', 'noopener')`, text "Respects paid. Thank you ♥", `ctx.audio.toast()` | v0, R10 |
| 17 | after one F | F again, or `e.repeat` | nothing | v0 |
| 18 | "Be reborn" clicked, leaderboard open | F in the name field | no tab (listener removed on the click) | v0 |
| 19 | daily run, Deep | - | same as 15-17 [spec silent, PP 5] | v0 |
| 20 | fall in below MAX level | - | no `.deep`, no `.deep-f` | v0 |
| 21 | normal play, unpaused | F | kick, unchanged | v0 |
| 22 | any intro card | Escape | ignored: same card, menu hidden, no pause menu | R3 |
| 23 | any intro card | M or P | mute toggles / screenshot taken AND the card advances (accepted) | R6 |
| 24 | `LINKS.coffee` set, Deep younger than 2.6 s | F (new keydown, `repeat: false`) | nothing: no tab, no `.deep-f` yet | R1 |
| 25 | final Deep screen | - | "THE DEEP" and the "Be reborn" button are spaced by the 24 px flex gap (button top − title bottom >= 20 px) | R7 |

### Steps (edit order)
1. `src/ui/hud.ts` top, next to the constants: `export const LINKS = { coffee: '' }; // Buy Me a Coffee page (PP adds it); empty = no "Press F" line on The Deep`.
2. `src/ui/hud.ts` `deep()`: `const lineEl = h('div', 'deep-lines', el);` and every `el.innerHTML = …` becomes `lineEl.innerHTML = …`. Inside `next()`, before writing a line: `if (i === 1 && LINKS.coffee && !f) { f = h('div', 'deep-f', el); f.textContent = 'Press F to pay respects'; window.addEventListener('keydown', onF); }` with `let f: HTMLDivElement | undefined; let paid = false; const onF = (e: KeyboardEvent) => { if (e.code !== 'KeyF' || e.repeat || paid) return; paid = true; window.open(LINKS.coffee, '_blank', 'noopener'); f!.textContent = 'Respects paid. Thank you ♥'; ctx.audio.toast(); };` declared above `next`. The "Be reborn" click handler: `() => { window.removeEventListener('keydown', onF); done(); }`. Red test: scenario rows 14-19, 24, 25.
3. `src/ui/style.css` after `.deep-line`: `.deep-lines { display: contents; }` and `.deep-f { position: absolute; bottom: 28px; font: 700 18px var(--font); color: #b0f0ff; opacity: .8; letter-spacing: 1px; animation: fadein 1.2s; }`.
4. `src/ui/intro.ts` (new): `export class Intro { wanted(): boolean; show(done: () => void): void }` exactly as v0 step 4 (cards, DOM, 5 s timer, fade restart), with one change in the advance rule: `window` keydown advances when `e.code !== 'Escape' && !e.repeat`; `mousedown` on the overlay advances; card 4 finishes on the same inputs. Finish: clear timer, remove both listeners and the element, `ctx.state.seenIntro = true`, `done()`. Red test: rows 1-5, 12, 13, 22, 23.
5. `src/main.ts`, anchor by text `else ctx.input.lock();` inside `new Menu(() => { … })`: `import { Intro } from './ui/intro';`, `const intro = new Intro();` right above `const menu = new Menu(`, callback `if (started) resume(); else if (intro.wanted()) { menu.hide(); intro.show(() => ctx.input.lock()); } else ctx.input.lock();`. Lines `if (!state.seenIntro) { … toast … }` in `onLockChange` stay. Only these lines; other agents hold uncommitted lines in this file. Red test: rows 6-11.
6. `tools/smoke/scenario-esc.js` (line with `g.state.upgrades.laptop = 1;`) and `tools/smoke/scenario-factory.js` (line before `await step('15_lock_option'`): add `g.state.seenIntro = true;`. Red test: both scenarios rerun green (Done when, last two lines).
7. `CHANGELOG.md`: one bullet under the newest `##` section (do not rename it): intro on a new game (click or any key skips) and "Press F to pay respects" on The Deep once the link is in.
8. `docs/SPEC.md`: menu section (line 220 area): the intro (4 cards, click or any key except Esc, once per save, not after rebirth, not in daily; why: PP asked for an intro, cards stay short so the GOAL panel starts within 20 s); rebirth section (line 262 area): the Press F line from the second whisper, F opens Buy Me a Coffee once, hidden while `LINKS.coffee` in `src/ui/hud.ts` is empty (why: PP adds the account later; the line waits 2.6 s so a kick-F tap carried over from play cannot open it).
9. `BOARD.md` under N6: `- pending: PP's Buy Me a Coffee URL goes into LINKS.coffee (src/ui/hud.ts); until then the line stays hidden.`
10. `docs/ai-work/2026-10-21-intro-pressf.md`: Problem / Summary / Work progress with all Done-when PASS lines, the rejected items from Resolutions, and one playtest question for PP: does Safari on his Mac open the F tab without a popup prompt (R8).

### Tests
Scenario `smoke/scenario-intro-pressf.js` in the session scratchpad, `FULL=1`, dev server on 5199, shape as v0 (`frames()`, `ok()`, `blockSaves()`, crafted saves, `?daily` iframe, `window.open` stub recording `[url, target, features]`, F via `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))`, Deep via `g.hud.deep(5, () => (window.__reborn = true))`). Rows map 1:1 to Done when. Animation check (rules 3/12): 10 opacity samples after a card swap, one value strictly in (0, 1), screenshot of card 1.

### Review focus
1. Habit F tap 200 ms after falling in at MAX level (roast Major 1) → pinned by step 2's row 24 "F before the second whisper → no open call, no `.deep-f`".
2. Browser refuses the lock after card 4 (roast Major 2 / impact High) → pinned by step 5's row 6 "menu hidden, pill visible, paused; canvas click locks".
3. Esc pressed on card 4 (impact Medium) → pinned by step 4's row 22 "Escape on card 4 → still card 4, `.intro` present, no pause menu".
4. Old 5 s timer firing after a manual advance (roast "old timer after a state change") → pinned by step 4's row 3 "4.5 s after a manual advance still card 2, 0.8 s later card 3".
5. "Be reborn" button flush under the title after the `deep-lines` child (impact Low) → pinned by step 2's row 25 gap measurement.

### Done when
1. fresh state, click `[data-a="play"]` → `document.querySelector('.intro .logo')?.textContent === 'GNOME DISPOSAL INC.'`, `g.paused === true`, `.menu:not(.intro)` has class `hidden`.
2. dispatch keydown `Space` on card 1 → card text contains `Nobody wants them.`; opacity samples over 10 frames include a value in (0, 1).
3. 4.5 s real time after that manual advance → card text still contains `Nobody wants them.`; 0.8 s later → contains `It pays cash`.
4. on card 4 wait 6 s → card text still contains `Click to start hustling`.
5. dispatch `mousedown` on `.intro` → `.intro` gone, `g.state.seenIntro === true`, after lock `g.paused === false`, `.hud-goal` text contains `Make gnomes`, toasts contain no `Follow the GOAL panel`.
6. with `canvas.requestPointerLock` stubbed to dispatch `pointerlockerror`, finish card 4 by keydown `KeyW` → `.intro` gone, `.menu:not(.intro)` still `hidden`, `.click-to-play` not hidden, `g.paused === true`; keydown `KeyW` → `g.input.wanted` unchanged; then unstub and `mousedown` on the canvas → lock requested, `g.paused === false`.
7. state `stats.playTime = 30` → click play → no `.intro`, `g.input.wanted === true`.
8. iframe `?daily` → click play → no `.intro` in the iframe, `gnome.state.seenIntro === false`.
9. `freshState(oldWithSeenIntroTrue)` → `intro.wanted() === false`.
10. `localStorage.removeItem(KEY)` + reload (iframe `/`) → click play → `.intro` present.
11. state `{ seenIntro: false, stats.playTime: 30 }` → click play → no `.intro`; after lock, toasts contain `Follow the GOAL panel`.
12. on card 2, `g.state.seenIntro === false` and the `localStorage` save after `saveState(g.state)` has `"seenIntro":false`.
13. on card 2 dispatch `blur` on window → `.intro` present, `.menu:not(.intro)` still hidden.
14. `LINKS.coffee = ''`, `g.hud.deep(5, …)`, wait 3 s → no `.deep-f`; keydown F → `openCalls.length === 0`.
15. `LINKS.coffee = 'https://example.test/x'`, `g.hud.deep(5, …)` → no `.deep-f` on frame 1; after 3 s `.deep-f` text `Press F to pay respects`; still present after the final `Be reborn` button appears (`MAXPOLL` long enough for 9 × 2.6 s).
16. keydown F (line visible) → `openCalls[0]` equals `['https://example.test/x', '_blank', 'noopener']`, `.deep-f` text `Respects paid. Thank you ♥`.
17. keydown F twice more (one with `repeat: true`) → `openCalls.length === 1`.
18. click `Be reborn` → `window.__reborn === true`; keydown F → `openCalls.length` unchanged.
19. iframe `?daily` with `LINKS.coffee` set in the iframe module, `gnome.hud.deep(5, …)`, wait 3 s → `.deep-f` present; keydown F in the iframe → one open call.
20. normal state, `holeLevel 3`, set player `y = -5` → no `.deep`, no `.deep-f`.
21. `rg -n "inp.hit\('KeyF'\)" src/player/player.ts` → 1 hit, unchanged line; unpaused frame with `pressed` containing `KeyF` → `g.state.stats.kicked` +1.
22. on card 4 dispatch keydown `Escape` → `.intro` present, card text still contains `Click to start hustling`, `.menu:not(.intro)` hidden, `g.paused === true`.
23. on card 1 dispatch keydown `KeyM` → card text contains `Nobody wants them.` and `g.audio.muted` flipped (accepted double effect).
24. `LINKS.coffee` set, `g.hud.deep(5, …)`, 0.2 s later keydown F (`repeat: false`) → `openCalls.length === 0`, no `.deep-f`.
25. on the final Deep screen: `button.getBoundingClientRect().top - titleLine.getBoundingClientRect().bottom >= 20`.
26. `npx tsc --noEmit` → no output; scenario `LOGS:` empty.
27. `FULL=1 DPR=1 CDP_PORT=9372 MAXPOLL=1600 node tools/smoke/smoke.mjs <scratchpad>/esc tools/smoke/scenario-esc.js` → `00_title_play locked=true`, all lines as in `2026-10-20-esc-resume.md`, `LOGS:` empty.
28. `FULL=1 DPR=1 CDP_PORT=9374 MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/factory tools/smoke/scenario-factory.js` → `15_lock_option` reports a lock call, no `ERR` lines.

### Decisions for PP
1. Intro form: a) 4 short text cards in the menu style, skip with click or any key but Esc, worst case 15 s + one click before the game starts (built tonight, safe default); b) 3D fly-by factory → hole with captions (more code in `player.ts` while two agents edit it, slow first impression on weak machines, replaces steps 4-5); c) "letter from the boss" card inside the game after the first click (competes with the GOAL panel). (recommendation: a, ships tonight and cannot delay the tutorial)
2. [spec silent] Zakładam: after a rebirth there is no intro (the save keeps `seenIntro` true) | Dowód: `state.ts:111`, `hole.ts:512` | Jeśli źle: a reborn player sees the "new hire" cards again every run | rekomendacja: a) no intro after rebirth.
3. [spec silent] Zakładam: Reset save shows the intro again (wipe + reload = fresh state) | Dowód: `menu.ts:61-62`, `state.ts:68` | Jeśli źle: PP testing from Reset save sees it each time; that is the intended test path | rekomendacja: a) show it again.
4. [spec silent] Zakładam: a save from before this change with `seenIntro` false and play time > 1 s gets no intro and keeps today's one-line toast | Dowód: `main.ts:146-149`, `state.ts:148-156` | Jeśli źle: an old player sees the intro once on CONTINUE | rekomendacja: a) no intro on any CONTINUE.
5. [spec silent] Zakładam: the "Press F" line also shows on a Deep reached inside a daily run | Dowód: `player.ts:473-478` calls `hud.deep` in every mode, `daily.md` D9 | Jeśli źle: daily players miss the link, nothing breaks | rekomendacja: a) same screen, same line.
(decision age: none; every decision used is from 2026-10-19/20)

### v0 → final
- added: `menu.hide()` before the intro (R2), "Press F" line and listener born with the second whisper (R1), Esc ignored on every card (R3), `seenIntro = true` in the two committed smoke scenarios (R5), `.deep-lines { display: contents }` (R7), BOARD.md pending line (R9), matrix rows 22-25 and Done-when 22-28.
- dropped: "any key" including Esc; "line from the first whisper"; "press W" as a working path after a refused lock (row 6 now says only a click).
- moved out of PP: v0 open decision 6 (text after F) decided here (R10); 3-card variant rejected.
- moved to PP: question 1 (intro form) and the four `[spec silent]` items, unchanged from v0.
