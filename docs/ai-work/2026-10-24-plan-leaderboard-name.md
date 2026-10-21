# Plan: leaderboard name and new boards

Spec: PP (terminal 2026-10-24): "do planu w superbase zapisujemy tylko imie albo nazwe gracza a nie oficjalnie imie i nazwisko" and "dodaj tez jeden to najwiecej zgromadzonych pieniedzy i tu liczymy te zgromadzone i wydane, ale tez najszybsze dojscie do lvl 12 (osobna tabela)". Decision log: `2026-10-20-supabase-leaderboard.md`, `2026-10-21-fix-plan-supabase-leaderboard-r1.md`.
Trivial check: touches the save model (`state.ts`), the game loop, the hole, the online table shape and its constraints, the local store and the form; two stores and one SQL guard share the data path.

## Plan v0 (plan-author)

### Goal
The board asks for one "Name or nickname", stores one `name` online and locally, keeps the money board as it is (it already counts spent money), and adds a third board "FASTEST LVL 12" with the unpaused run time at which the hole reached level 12.

### Plain facts the spec asked about
- "Most money, held and spent" is today's ALL-TIME board: `score = state.totalEarned` (`src/ui/leaderboard.ts:326`), written only by `Hole.earn` (`src/systems/hole.ts:83`) together with `money`; shop spending (`shop.ts:230,269`) lowers `money`, never `totalEarned`. No new board for money: only the tab label and the footer say it.
- "Osobna tabela" for the time is read as a separate board and tab, stored in the same `public.scores` table under `board = 'speed'` (assumption 1). A second Postgres table would need its own grants, trigger, caps and check.sh section for one more column of the same shape.
- The HMAC key covers `<score bytes>|<board>|<UTC date>` only (`leaderboard.ts:88`, `leaderboard.sql:27`): names are not in it, so the rename does not touch `scoreKey`, the trigger or `k()` in check.sh. The time row uses the same key over the seconds (a float8) and `speed`.
- Live `public.scores` has 0 rows (2026-10-24): the column change carries no data.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | board open (pause menu or rebirth) | look at the form | one input, placeholder "Name or nickname", `autocomplete="off"`, no last-name input | PP 2026-10-24 |
| 2 | name `Ania_42` | submit | accepted; local entry `{name:'Ania_42', …}`; online POST body keys `name,score,level,board,key` | PP; assumption 2 |
| 3 | name `<b>` | submit | "Name: no HTML, please.", no call | today's rule, `leaderboard.ts:169` |
| 4 | name of 25 chars, or empty / spaces only | submit | "Name: 1-24 characters.", no call | today's rule |
| 5 | name `Ania!` or an emoji | submit | "Name: letters, digits, spaces, . _ - ' only.", no call | assumption 2 |
| 6 | old local entry `{first:'Old', last:'Local'}` without `name` | open board (local fallback) | row "1. Old Local"; the next local write stores it as `{name:'Old Local'}` | assumption 3 |
| 7 | online rows | list | row text "1. Alpha" from `name`; a row without `name` is dropped | today's `isEntry` |
| 8 | online store | open board | footer "Score = money earned this run, spent or not. FASTEST = time to hole level 12. Your name or nickname is shown publicly online. Esc closes."; local store: the same without the public sentence | PP 2026-10-20 (3a), PP 2026-10-24 |
| 9 | live DB, POST with `first_name`/`last_name` | insert | 400; POST with `name` of 30 chars → 400; valid `name` → 201 | SQL checks |
| 10 | live DB, `select=name` / `select=id,key,*` | GET | 200 / 401 (column grants unchanged in kind) | `leaderboard.sql:23` |
| 11 | `spec silent` money: Deep start money (`dStart`, `hole.ts:526`) and refunds (`state.ts:126,132`) | play | not in the score (`totalEarned` unchanged) | open decision 4 |
| 12 | `spec silent` money: greedy gnome steals cash (`gnomes.ts:741`) | play | score does not drop | open decision 5 |
| 13 | game unpaused | frames pass | `state.runTime` grows by real seconds; paused, replay or hidden tab: no change | PP ("najszybsze dojście"), assumption 4 |
| 14 | hole reaches level 12 (`MAX_HOLE_LEVEL`) | level-up | `state.maxLevelAt = runTime` at that frame, saved, never changed later in the run | PP |
| 15 | `maxLevelAt` set | open board | run line "Your run: $X · Hole lvl 12 · Lvl 12 in h:mm:ss"; without it: today's line | PP |
| 16 | `maxLevelAt` set, `timeSent` false | submit | two rows: `{board: this.board, score: totalEarned, level: holeLevel}` then `{board:'speed', score: maxLevelAt, level: 12}`; both local; two POSTs; `timeSent` true when the store raised no warning | assumption 5, open decision 2 |
| 17 | `timeSent` true | submit again | one row / one POST (money board only) | assumption 5 |
| 18 | time POST fails (503 / timeout) | submit | `timeSent` stays false, warning shown, local has both rows | decision "honest double submits allowed" (2026-10-20) |
| 19 | `maxLevelAt` null | submit | one row, as today | PP |
| 20 | rebirth offer, time pending | submit | both rows, then `done()`; the new run has `runTime 0`, `maxLevelAt null`, `timeSent false` | `freshState` |
| 21 | tab FASTEST LVL 12 | click | GET `board=eq.speed&order=score.asc&limit=10`; rows "1. Name", `h:mm:ss`, "Lvl 12", date | PP ("najszybsze" = lower first) |
| 22 | local speed board, 55 entries | submit | ascending order, the 50 fastest kept, other boards untouched | `KEEP` |
| 23 | live DB, `board = 'speed'` | insert | `score 599` → 400, `level 11` → 400, `score 600, level 12` → 201; `board x` still 400; caps unchanged (30/min per board, 2000/day) | open decision 3 |
| 24 | `spec silent` old save without `runTime` | load | `runTime = stats.playTime` (first run exact; after a rebirth an overestimate, never a gain) | open decision 6 |
| 25 | `spec silent` old save already at level 12 without `maxLevelAt` | load, submit | no time row, run line without time | open decision 7 |
| 26 | `spec silent` daily run (`?daily`, 300 s) | play, submit | never a time row: `maxLevelAt` stays null (11 305 XP in 300 s is impossible) and the DB floor 600 s > 300 s | open decision 3 |
| 27 | docs | after code | SPEC 232 and decisions, README, CHANGELOG, BOARD.md say name-or-nickname, three boards, the time rule | CLAUDE.md "Task board as the game spec" |

### Reach
- `Entry` (`src/ui/leaderboard.ts:12`): read by `isEntry :38`, `LocalStore.all :45`, `RemoteStore.list :127`, `submit :140`, `render :364`, `send :326`; scratchpad scenarios `slb/scenario-daily.js:109-137`, `slb/scenario-leaderboard-app.js:18-104` build entries with `first/last` (not in the repo; the implementer updates the copies it runs). Repo scenario: `tools/smoke/scenario-remote-lb.js:31-34,78` (`fill`, `row`), `scenario-esc.js:182` (open/close only, unaffected).
- `nameError` (`:167`): one caller `send :316`. `Leaderboard.first/last` fields `:194-195,232-233,299,314-315`.
- Columns `first_name/last_name`: `leaderboard.sql:8-9,23`, `check.sh:6,17,20,35,45-46`, README:26 (delete line), `.github/workflows/keepalive.yml:20` uses `select=score` (unaffected), `crash.ts:4` imports `online, restCall` only (unaffected).
- `totalEarned`: writer `hole.ts:83`; readers `hole.ts:511` (shards), `leaderboard.ts:295,326`. Unchanged.
- `holeLevel === MAX_HOLE_LEVEL`: `hole.ts:262` (toast), `player.ts:475` (`fellIn` → `hud.deep` → `leaderboard.offer`). `levelUp` already calls `saveState` (`:263`).
- `stats.playTime` writer `main.ts:242` (inside `!replay.playing && !ctx.paused`); the new `runTime` line sits next to it. Readers of playTime unchanged (`intro.ts:15`, `menu.ts:54,122`, `hud.ts:662`, `shot.ts:74`).
- `freshState(keep)` (`state.ts:69`): callers `loadState :121,148`, `hole.rebirth :519`; new fields are never kept.
- In flight (uncommitted, other sessions): `state.ts` (+11), `main.ts` (+7/-1), `hole.ts` (+4/-2), `shop.ts`, `upgrades.ts`, `machines.ts`, `player.ts`, `legend.ts`, `smoke.mjs`, `CHANGELOG.md`, `SPEC.md`. The implementer edits on top of the working tree and does not touch those hunks; check `git diff -U0 src/core/state.ts src/main.ts src/systems/hole.ts | grep '^@@'` before editing so the new lines land outside them.
- Front contract: `GET scores?select=name,score,level,board,created_at`, `POST {name, score, level, board, key}`; consumed only by this game.

### Data
- `public.scores`: `first_name` → `name` (rename keeps the column grant and the check, which follow the column), `last_name` dropped (its grant and check go with it), `scores_board_check` rewritten to `^(main|speed|daily-\d{4}-\d{2}-\d{2})$`, new `scores_speed_check check (board <> 'speed' or (level = 12 and score >= 600))`. Trigger `scores_guard` untouched (no salt handling in this change). Constraint names to confirm live first: `select conname from pg_constraint where conrelid = 'public.scores'::regclass`.
- Queries: speed list `board = 'speed' order by score asc limit 10` uses `scores_board_score (board, score desc)` scanned backwards; caps use `scores_board_created` and `scores_created` as before.
- Volume: live rows 0 (2026-10-24); cap 2000 rows/day. Cost: a submit goes from 1 POST to 2 POSTs once per run (the time row), then 1 again. Local: `all()` parses ≤ 50 entries per board (main, speed, 7 dailies) per list, same as today plus one board.
- Minimum plausible time 600 s: the factory mouth lets out at most 20 gnomes/s (`factory.ts:248`); 11 305 XP (sum of `HOLE_LEVELS[0..10].xp`) at a quarter XP per machine-fed gnome and ~1.5 XP average needs about 25 min; 10 min leaves room for Golden Hour (x10 XP gnomes for 25 s) and the King (200 XP). It also sits above the 300 s daily.

### Steps (edit order)
1. `src/core/state.ts` — `GameState` + `runTime: number` (unpaused real seconds this run), `maxLevelAt: number | null` (`runTime` when the hole reached `MAX_HOLE_LEVEL`), `timeSent: boolean` (the time row went online or local once). `freshState`: `0`, `null`, `false`, never from `keep`. `loadState`: `runTime: parsed.runTime ?? parsed.stats?.playTime ?? 0`, `maxLevelAt: parsed.maxLevelAt ?? null`, `timeSent: parsed.timeSent ?? false` (the spread of `base` already gives these when the save has them). Test: R19 (below) reads the three fields after `g.hole.rebirth`-like `freshState` via `window.gnome.state`.
2. `src/main.ts:242` — after `state.stats.playTime += realDt;` add `state.runTime += realDt;` (real time: the Tab wheel slow-motion must not stretch the clock). Test: R18 samples `runTime` over 30 unpaused and 30 paused frames.
3. `src/systems/hole.ts:262` — in `levelUp`, `if (s.holeLevel === MAX_HOLE_LEVEL) { s.maxLevelAt = s.runTime; toast… }` before the existing `saveState(s)`. Test: R18 sets `holeLevel = 11` and calls `g.hole.levelUp()` (private in TS, callable from the scenario).
4. `src/core/format.ts` — `export function clock(t: number): string` → `h:mm:ss` (hours unbounded; `Date.toISOString` wraps at 24 h, which a long run can exceed). Test: R18 asserts `clock(3725) === '1:02:05'` via the module import.
5. `src/ui/leaderboard.ts` —
   - `Entry { name: string; score; level; at; board? }`; `isEntry` checks `typeof e.name === 'string'`; `MAX_NAME = 24`; `NAME = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} ._'’-]+$/u`; `nameError(label, name)` messages: "no HTML", "1-24 characters", "letters, digits, spaces, . _ - ' only".
   - `const SPEED = 'speed'`; `rank = (e) => boardOf(e) === SPEED ? e.score : -e.score`; `byRank = (a, b) => rank(a) - rank(b)` replaces `byScore` in `all()` and `submit()` (lower time first, higher money first, trimming per board keeps the best 50).
   - `LocalStore.all()`: before `filter(isEntry)`, map a legacy row (`name` missing, `first` a string) to `{ ...e, name: [e.first, e.last].filter(Boolean).join(' ') }`.
   - `COLS = 'name,score,level,board,created_at'`; `RemoteStore.list`: `order=score.${board === SPEED ? 'asc' : 'desc'}`, map `name: x.name`; `submit` body `{ name: e.name, score, level, board, key }`.
   - Markup: tabs `MOST MONEY` (`data-tab="main"`), `DAILY <date>`, `FASTEST LVL 12` (`data-tab="speed"`); one `<input name="name" placeholder="Name or nickname" autocomplete="off" maxlength="24">`; field `private name: HTMLInputElement`; footer texts from matrix row 8.
   - `show()`: run line `Your run: ${money(totalEarned)} · Hole lvl ${holeLevel}` + (`maxLevelAt !== null` ? ` · Lvl 12 in ${clock(maxLevelAt)}` : '').
   - `send()`: validate once; `await submit({ name, score: totalEarned, level: holeLevel, at, board: this.board })`, `w1 = warning`; if `maxLevelAt !== null && !timeSent`: `await submit({ name, score: maxLevelAt, level: MAX_HOLE_LEVEL, at, board: SPEED })`, `w2 = warning`, `if (!w2) state.timeSent = true`; `w = w1 ?? w2`; the rest as today. Submitting from the speed tab still posts to `this.board` (tab is view only).
   - `render()`: speed rows use `clock(e.score)` instead of `money(e.score)`; name cell `${i + 1}. ${e.name}`.
   Tests: `tools/smoke/scenario-remote-lb.js` (step 8).
6. `supabase/leaderboard.sql` — `create table`: `name text not null check (char_length(name) between 1 and 24 and btrim(name) <> '' and name !~ '[<>[:cntrl:]]')` replaces both name columns; board check with `speed`; add `constraint scores_speed_check check (board <> 'speed' or (level = 12 and score >= 600))` with the one-line reason from Data; grants `select (name, score, level, board, created_at), insert (name, score, level, board, key)`; header: "name = a first name or nickname only (PP 2026-10-24), never a full official name; board speed = unpaused seconds to hole level 12". Trigger body unchanged. The DB keeps today's loose check (no HTML, no control chars, 1-24) on purpose: the client regex is the player's rule, the DB only guards size and markup.
7. `supabase/check.sh` — `row()` → `{"name":"Check-%s",…}`, `count()` → `select=name&name=eq.Check-$1`, the "no key" literal, PATCH/DELETE filters `name=eq.Check-Script`, header delete line `delete from public.scores where name like 'Check-%';`. New cases: `say "speed 599 s" … 4xx`, `say "speed level 11" … 4xx`, `say "speed 600 s lvl 12" … 2xx` (key `k speed "$T"` over score 600 → the IEEE hex of 600 is `4082c00000000000`, so `k()` takes the hex as a parameter or a second helper computes it), `say "old columns" "$(post '{"first_name":"Check","last_name":"Old",…}')" 4xx`.
8. `tools/smoke/scenario-remote-lb.js` — `fill(name)`, `submit(name)`, `row(name, score, board)` with `name`, expectations "1. Alpha" etc.; R2 broken row without `name`; new steps: `R16_name_rules` (rows 2-6: `Ania_42` ok, `Ania!` message, 25 chars message, legacy local `{first:'Old', last:'Local'}` shows "Old Local" and is rewritten with `name` after a submit); `R17_speed_submit` (rows 15-19: `g.state.maxLevelAt = 1234; g.state.holeLevel = 12; g.state.timeSent = false` → submit → POST bodies `[main, speed]`, speed `score 1234, level 12, key hex`, run line contains `Lvl 12 in 0:20:34`, `timeSent true`; second submit → one POST; then with POST 503 on speed → `timeSent false`, warning); `R18_run_timer` (rows 13-14: unpaused 30 frames `runTime` grows, paused 30 frames unchanged, `holeLevel = 11` + `g.hole.levelUp()` → `maxLevelAt` within 0.1 s of `runTime`, unchanged 30 frames later; `clock(3725) === '1:02:05'`); `R19_speed_tab_and_rebirth` (rows 20-22: tab click → URL `board=eq.speed&order=score.asc`, rows `1. Fast` with `0:10:00`; `lb.offer(done)` with time pending → 2 POSTs then `done 1`; local 55 speed entries → 50 kept ascending). Run: dev server `npx vite --port 5199 --host 127.0.0.1`, `CDP_PORT=9391 MAXPOLL=2400 node tools/smoke/smoke.mjs run-remote-lb tools/smoke/scenario-remote-lb.js`. Never `FULL=1`.
9. Live apply (only after PP's word, open decision 8) — scratchpad `slb/m.sql`: `alter table public.scores drop column last_name; alter table public.scores rename column first_name to name; alter table public.scores rename constraint scores_first_name_check to scores_name_check; alter table public.scores drop constraint scores_board_check; alter table public.scores add constraint scores_board_check check (board ~ '^(main|speed|daily-\d{4}-\d{2}-\d{2})$'); alter table public.scores add constraint scores_speed_check check (board <> 'speed' or (level = 12 and score >= 600));` run with the existing scratchpad `slb/q.sh` (token from Keychain `supabase-access-token` inline, never printed; entry present on 2026-10-24). No salt needed: the trigger is not re-created. Then `sh supabase/check.sh <url> <key> <salt>` (url/key from `gh api …/actions/variables`, salt from Keychain `gnome-supabase-salt` inline) → `failed: 0`; cleanup `delete from public.scores where name like 'Check-%'` and count → 0.
10. Docs — `docs/SPEC.md:232`: "imię albo nazwa gracza (1-24 znaki: litery, cyfry, spacje, . _ - '), nigdy imię i nazwisko", tabs MOST MONEY / DAILY / FASTEST LVL 12, the time rule (czas gry bez pauzy od startu biegu do poziomu 12, raz na bieg, najmniej 10 minut przyjmuje baza); new decision lines "(PP, 2026-10-24) …" for the name (replaces the 2026-10-20 "imię i nazwisko" word in :248, which stays as history with "(zastąpione 2026-10-24)") and for the two boards, each with one sentence of why. README: 2b delete line, step 5 footer sentence, "Cheating, honestly" (names 1-24 → "a name or nickname (1-24 characters)", speed rows need level 12 and at least 600 s). CHANGELOG: bullets in the top unreleased section (new `## 2026-10-24 …` heading if the top one is already served on 5300), "Test:" lines. `BOARD.md` status line. ai-work note `2026-10-24-leaderboard-name.md`.

### Tests
- Rows 1-8, 13-22: `tools/smoke/scenario-remote-lb.js` R1-R19 (stubbed fetch, LocalStore boot asserted first), run as in step 8.
- Rows 9-10, 23: `sh supabase/check.sh …` against the live project after step 9 (curl only, no browser), then cleanup.
- Rows 11-12, 24-26: code-unchanged facts, checked by grep and by R16/R18 fixtures (old save shapes set through `localStorage` before reload are not needed: `loadState` mapping is one expression, covered by `npx tsc --noEmit` plus R19 reading the fields).
- Row 27: grep lines below.
- Whole-suite guard: `scenario-esc.js` step 17 (board opens/closes from pause) still passes.

### Done when
1. R1 → `inputs ["name"], placeholder "Name or nickname", autocomplete ["off"]`
2. R16 → `ok: callsPOST 1, body.name "Ania_42", keys "name,score,level,board,key", localName "Ania_42"`
3. R16 → `html: msg "Name: no HTML, please.", calls 0`
4. R16 → `long: msg "Name: 1-24 characters."`, `blank: msg "Name: 1-24 characters."`
5. R16 → `bang: msg "Name: letters, digits, spaces, . _ - ' only."`
6. R16 → `legacyRow "1. Old Local", legacyStored {"name":"Old Local"}`
7. R2 → `rows ["1. Alpha","2. Beta"], shown 2, in 3`
8. R1 (local) → `foot "Score = money earned this run, spent or not. FASTEST = time to hole level 12. Esc closes."`; R2 (remote) → foot contains `Your name or nickname is shown publicly online`
9. check.sh → `old columns: got 400 want 4xx ok`, `30-char name: got 400 want 4xx ok`, `valid row: got 201 want 2xx ok`
10. check.sh → `select=id 401`, `select=key 401`, `select=* 401`, `valid row stored: got 1 want 1 ok` (reads `select=name`)
11. `rg -n "totalEarned \+=" src` → exactly `src/systems/hole.ts:83`
12. `rg -n "totalEarned -=" src` → no output
13. R18 → `unpausedDelta > 0.3, pausedDelta 0`
14. R18 → `level 12, maxLevelAtSet true, diff < 0.1, frozen true`
15. R17 → `runLine contains "· Lvl 12 in 0:20:34"`; R4 → `runLine lacks "Lvl 12 in"`
16. R17 → `posts ["main","speed"], speedBody {score:1234, level:12}, keyHex true, localRows 2, timeSent true`
17. R17 → `secondPosts ["main"]`
18. R17 → `fail: timeSent false, msg "Could not reach the online board: score saved on this computer only.", localRows 2`
19. R4 → `calls "POST,GET"` (one POST without a time)
20. R19 → `rebirth: posts 2, done 1, fresh {runTime:0, maxLevelAt:null, timeSent:false}`
21. R19 → `url contains "board=eq.speed&order=score.asc&limit=10", rows ["1. Fast"], cells ["0:10:00","Lvl 12"]`
22. R19 → `localSpeedKept 50, ascending true, mainKept unchanged`
23. check.sh → `speed 599 s: got 400`, `speed level 11: got 400`, `speed 600 s lvl 12: got 201`, `board x: got 400`, `40 parallel POSTs on daily-…: accepted: got 30`
24. `rg -n "runTime: parsed.runTime \?\? parsed.stats\?.playTime" src/core/state.ts` → 1 line
25. R17 → `noTime: posts ["main"]` with `maxLevelAt null, holeLevel 12`
26. `rg -n "score >= 600" supabase/leaderboard.sql` → 1 line, and R18 fixture `daily` not needed: `rg -n "daily" src/ui/leaderboard.ts` shows no speed condition (none required)
27. `rg -n "nazwa gracza|FASTEST LVL 12" docs/SPEC.md` → ≥ 2 lines; `rg -n "name like 'Check-%'" README.md` → 1; `rg -n "Name or nickname|nickname" CHANGELOG.md` → ≥ 1; `rg -n "first_name|last_name" src supabase tools README.md docs/SPEC.md` → no output

### Assumptions (numbered)
1. "Osobna tabela" = a separate board and tab in the game, stored as `board = 'speed'` in `public.scores`.
2. Name rule: letters of any alphabet, digits, spaces, `. _ - '`, 1-24 characters after trim and NFC, at least one letter or digit; DB keeps its loose check.
3. Old local entries show "first last" (what the player typed, on the player's own computer only) and get rewritten to `name` on the next local write.
4. The run clock is real time without pause, replay or hidden tab (same branch as `playTime`), starts at the first unpaused frame of a run (new game, after rebirth), and is not scaled by the Tab wheel slow-motion.
5. The time row goes with the first submit after level 12 from either form (pause menu or rebirth), once per run; a failed send leaves it pending, a timeout may duplicate (today's policy).
6. The money tab is renamed MOST MONEY (it is the all-time board of `totalEarned`).
7. The old decisions used (2026-10-20, 2026-10-21) are 3-4 days old: nothing older than 60 days is relied on.

### Alternatives rejected
- (a) Separate table `public.times`: second trigger, grants, caps and check section for one more float column; rejected (assumption 1).
- (b) Keep `last_name` nullable: two columns to validate, an empty string to display, and the README delete line stays two-field; rejected, 0 rows to carry.
- (c) Time row only from the rebirth form (no `timeSent` field): loses the time of a player who reaches 12 and never jumps in; rejected, one boolean is cheaper.
- (d) One POST with an array of two rows (atomic): needs `submit(entries[])` and breaks the scratchpad scenarios' `submit(e)` calls; rejected, two sequential calls reuse the interface.
- (e) `new Date(t * 1000).toISOString().slice(11, 19)` for the clock: wraps at 24 h; rejected for a 4-line helper.
- (f) Plausibility check inside the trigger: would need the salt to re-create the function; a table check does the same without touching the secret.
- (g) Old save after a rebirth gets no time (`null`): a second null state and a message; rejected for the one-line `playTime` fallback (open decision 6).

### Ladder
- `runTime`, `maxLevelAt`, `timeSent` (rung 6): "najszybsze dojście do lvl 12" needs a per-run clock, its stop value and "once per run".
- `clock()` in `format.ts` (rung 6): no helper on disk formats hours; `secs()` rounds up whole seconds.
- `NAME` regex change (rung 5, one line): "imię albo nazwa gracza" allows nicknames with digits.
- `SPEED` board, `rank` sort (rung 5): lower-is-better ordering.
- SQL constraints (rung 3, platform checks): the DB is the trust boundary for the floor and the level.
- No new dependency, no new file in `src`; one scratchpad SQL file for the live run.

### Open decisions (for PP)
1. Which characters may a name or nickname contain? a) letters, digits, spaces and `. _ - '` (recommended: nicknames like `Ania_42` or `Mr. T` work, and the DB still blocks HTML) b) letters, spaces, `-` and `'` only, as today.
2. When does the level-12 time go to the board? a) with the first submit after level 12, from the pause-menu Leaderboard or the SUBMIT YOUR RUN screen, once per run (recommended: a player who never jumps into the hole still gets listed) b) only on the SUBMIT YOUR RUN screen at rebirth.
3. Minimum time the online board accepts for level 12? a) 10 minutes (recommended: the factory cannot feed 11 305 XP faster even with every gnome machine-fed; a daily run of 5 minutes can never post) b) 5 minutes c) no floor (a curl with the key could post 1 second).
4. [spec silent] Zakładam: start money from the Deep upgrade and old-upgrade refunds do not count as "earned" | Dowód: `src/systems/hole.ts:526`, `src/core/state.ts:126,132` write `money` only, `totalEarned` only at `hole.ts:83` | Jeśli źle: a reborn player with `dStart` starts the board $100-$2700 lower than PP expects | Pewność: Likely | rekomendacja: a) keep as is.
5. [spec silent] Zakładam: money stolen by greedy gnomes does not lower the score | Dowód: `src/entities/gnomes.ts:741` lowers `money` only | Jeśli źle: "zgromadzone" would mean the cash on hand, a different number | Pewność: Confident | rekomendacja: a) keep as is (PP said "zgromadzone i wydane").
6. [spec silent] Zakładam: a save from before this change uses its total play time as the run clock, also after a rebirth (an overestimate) | Dowód: `src/core/state.ts:39` `stats.playTime` survives rebirth (`:84`), no per-run clock exists | Jeśli źle: an old reborn save posts a slow time instead of none | Pewność: Likely | rekomendacja: a) accept the overestimate.
7. [spec silent] Zakładam: a save already at level 12 today gets no time row for this run | Dowód: `hole.ts:262` runs once per run, the moment is gone | Jeśli źle: the player expects a time after the update | Pewność: Confident | rekomendacja: a) no time, the next run counts.
8. Who runs the six `alter table` lines on the live project? a) the session through the Management API (token already in Keychain, table has 0 rows, same path as the two earlier changes; recommended) b) PP pastes them in the SQL Editor. CLAUDE.md keeps live migrations with PP, so the session waits for the word.
9. Tab label for the money board: a) MOST MONEY (recommended, says what it counts) b) ALL-TIME as today.

### Self-check
- Every acceptance criterion has a step and a test: rows 1-27 map to steps 1-10 and to R1-R19, check.sh or a grep.
- Every step names a file, a signature or a value: regex, messages, field names, SQL constraints, URL order, tab labels, the 600 s floor.
- Every written field lists its writers and readers: `runTime` (main.ts, state.ts; leaderboard.ts, hole.ts), `maxLevelAt` (hole.ts, state.ts; leaderboard.ts), `timeSent` (leaderboard.ts, state.ts), `name` (form, both stores, SQL, check.sh).
- Lists compared with the code: boards in the code = `main`, `daily-*` (SQL regex `leaderboard.sql:12`, tabs `leaderboard.ts:214`); PP named two more boards; money sources in the code = `earn`, `dStart`, refunds, theft (rows 11-12); save-age variants (rows 24-25); daily (row 26). `spec silent` rows: 5. Done-when lines: 27 = matrix rows 27.
- Decisions older than 60 days: none used.
- Shorter than the code: no; the matrix and the live SQL are the parts the implementer cannot decide alone, the rest is one line per edit.

## Review: performance (plan-performance)

Verdict: APPROVE

| plan step | operation | shape / index | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 5, 21 | `GET scores?board=eq.speed&order=score.asc&limit=10` | equality on `board` + order on `score`; `scores_board_score (board, score desc)` is `desc nulls first`, a backward scan gives `asc nulls last` = PostgREST's `score.asc` default; `score` is `not null` anyway | 1 per tab click / board open (unchanged pattern) | live 0 rows (plan, 2026-10-24); hard ceiling 2000 inserts/24 h | ≤ 10 index entries + 10 heap rows | none |
| 5 | `POST scores` for the speed row | trigger: HMAC + advisory lock + `count(*)` over `scores_created` (24 h) + `count(*)` over `scores_board_created` (board, 1 min) | +1 per run, once (`timeSent`), sequential after the money POST | ≤ 2000 rows/24 h by the trigger | 24 h count walks ≤ 2000 index keys, same as today; lock held for one insert | none |
| 6, 9 | `scores_speed_check`, rewritten `scores_board_check` | row-level check, regex on a ≤ 21-char string | per insert | n/a | O(1) per row; `alter ... add constraint` validates 0 rows | none |
| 2 | `state.runTime += realDt` | one float add in the existing `!replay.playing && !ctx.paused` branch | per frame (60 Hz) | n/a | negligible | none |
| 3 | `maxLevelAt = runTime` before the existing `saveState` | no new save call | once per run | n/a | none | none |
| 1 | save shape + `runTime`, `maxLevelAt`, `timeSent` | `localStorage` JSON, autosave every 10 s (`main.ts:201`) unchanged | per autosave | ~50 bytes added | negligible | none |
| 5 | `LocalStore.all()` parse + sort, `submit` parse + stringify | in-memory array, `KEEP 50` per board | list: 1 per open; submit: 2 per run with a time (money, then speed) | ≤ 50 × (main + speed + 7 dailies) = 450 entries | < 1 ms; the legacy `first/last` map is one pass over the same array | none |

Findings: none.

No findings on: speed list query and index direction, trigger counts with the extra POST (the daily cap now spends 2 slots per run that reached level 12, still inside the existing 2000/24 h guard), the two new checks and the live `alter` on 0 rows, the per-frame clock, the save size and cadence, the local store with one more board. Not measured: no local Postgres in this repo for `explain`; prod: not measured (live row count taken from the plan, not read by this review).

## Review: roast (plan-roaster)

Verdict: BLOCK

Steel-man: The plan keeps one table, one key and one trigger, and adds the time as a third board with a DB floor instead of a second table with its own grants and caps. The rename is safe because live has 0 rows and the HMAC does not cover names. Strong points: per-run clock on the same branch as `playTime` (pause, replay and hidden tab excluded; frame time clamped to 0.05 s, so a slow or throttled machine slows the game and the clock equally), `maxLevelAt` frozen at the level-up frame and saved by the existing `saveState`, `timeSent` so a player who never jumps still gets a time, legacy local rows mapped instead of dropped, no new file or dependency.

Findings:
- [Major] Every `speed` POST is rejected by the existing trigger, and the player is told to fix the computer clock.
  Assumption: "Trigger `scores_guard` untouched" (Data), "No salt needed: the trigger is not re-created" (step 9), alternative (f).
  Scenario: player reaches level 12 in 0:30:00, submits; POST `{board:'speed', score:1800, level:12}` passes the new table checks, then the trigger runs `if new.board <> 'main' and new.board not in ('daily-'||today, 'daily-'||yday) then raise exception 'daily board must be today or yesterday (UTC)'`.
  Checked: `supabase/leaderboard.sql:36-38` (the board branch treats every non-`main` board as a daily); `src/ui/leaderboard.ts:146` maps a 400 whose body matches `daily board must be today or yesterday` to `W_CLOCK` ("check your computer's date and time").
  Impact: the FASTEST board stays empty online forever; every player with a time sees a false clock warning on every submit; `timeSent` never turns true, so each later submit retries and adds one more local speed row (local write happens first, `leaderboard.ts:139`). Done-when 23 (`speed 600 s lvl 12: got 201`) fails at step 9.
  Recommendation: change the condition to `new.board like 'daily-%' and new.board not in (...)` and re-create the function in step 9 with the salt from Keychain `gnome-supabase-salt` (inline, never printed); drop alternative (f)'s "no salt" claim; add `say "speed row trigger"` to check.sh.
- [Major] The 600 s floor is derived from the slowest feeding path, not the fastest, and ignores Deep upgrades; strong honest runs get rejected, and the rejection repeats on every submit.
  Assumption: "11 305 XP at a quarter XP per machine-fed gnome ... about 25 min" (Data) bounds the fastest legal run.
  Scenario: a reborn player with Deep Hunger 9 (x3.25 XP) and Hole Hunger 5 (x1.5), Keep Tools and Head Start 7 ($218,700 at start) throws by hand (feed x1, not x0.25) and feeds machines; XP per gnome is up to x4.875 the base, so the endgame model's 21-25 min no-Deep run (`2026-10-21-plan-endgame.md:19`) shrinks to roughly 5-8 min. POST with `score 480` → 400 from `scores_speed_check` → `W_REJECT`; `timeSent` stays false (step 5: `if (!w2) timeSent = true`), so the pause-menu submit retries the same rejected row every time and duplicates it locally.
  Checked: `src/systems/hole.ts:153-154` (hand throw `feed = 1`, machines `FEED_XP = 0.25` at `:37`, factor `(1 + lvl('hunger') * 0.1) * (1 + deep('dXp') * 0.25)`), `src/data/upgrades.ts:103,108,111`, `src/systems/hole.ts:525-534` (dStart money and dTools on rebirth). The real minimum time is not measured (inference).
  Impact: the best players, the ones the board is for, never appear; the board's top is the floor value, which only a curl with the bundle key can hit.
  Recommendation: either measure the fastest run with max Deep in the econ model before fixing the number, or set `timeSent = true` on a 4xx (`W_REJECT`) so a permanent rejection is not retried; PP decides the floor with the measured number (open decision 3 needs it).
- [Major] "Dodaj też jeden" asks for a new money board; the plan only relabels the existing per-run board and never mentions `lifetimeEarned`.
  Assumption: "most money, held and spent" = today's `totalEarned` (Plain facts, assumption 6).
  Scenario: PP reborns 5 times, $2m per run; MOST MONEY shows his best run $2m, not $10m; PP reads "najwięcej zgromadzonych" as the total and reports the board as wrong.
  Checked: `src/core/state.ts:21-22,74` (`totalEarned` "this run", `lifetimeEarned` kept across rebirth via `keep`), `src/systems/hole.ts:83-84` (both grow together, spending lowers neither), `src/ui/leaderboard.ts:214` (one money tab today). The money-source list in the Self-check (`earn`, `dStart`, refunds, theft) omits this second counter.
  Impact: the plan ships two boards where PP asked for three, or a board measuring a different number than he meant.
  Recommendation: add an open decision: a) MOST MONEY = best single run (`totalEarned`, as now), b) a new board LIFETIME = `lifetimeEarned` (held + spent over all runs), c) replace ALL-TIME with lifetime. Note for b/c: the score grows each submit, so one player fills the board with his own growing rows unless the board keeps one row per name.
- [Minor] Fastest times compare first runs with max-Deep runs; after the endgame caps (XP x3.25, $218,700 start, tools kept) the board ranks rebirth count more than skill. Checked: `hole.ts:154,525-534`. Product question for PP, not a bug.
- [Minor] A curl with the bundle key posts `score 600, level 12` (exactly the floor) under any name; on an ascending board that row can never be beaten by an honest run slower than 600 s, while the money board's fake rows at least need a big number. Accepted policy ("Cheating, honestly", SPEC:232); only worth one README line.
- [Minor] Nicknames widen the name rule (digits, `_`, `.`) with no word filter on a public board; `Admin`, `Moderator` or an insult pass both the client regex and the DB check. Checked: plan step 5 regex, `leaderboard.sql:8`. Question for PP (accept, or a short deny list); no code fact breaks.
- [Minor] Two real duplicate paths remain by design: timeout (`W_MAYBE`) on the speed POST leaves `timeSent` false and the next submit can store a second online time; closing the tab within 10 s of a successful submit is covered by `beforeunload` save (`main.ts:200`), so only a crash duplicates. Accepted (2026-10-20 "honest double submits").

Scenarios checked explicitly:
- State changes during the step (level-up while the form is open): `maxLevelAt` is read at submit, so a level 12 reached with the pause-menu board open is impossible (game paused). Breaks: no.
- Step N fails after N-1: main row 201, speed row fails → main stored, `timeSent` false, retry posts main again plus speed. Breaks: no (accepted double), but see Major 2 for the permanent-4xx loop.
- Same event twice (double click): `sending` guard (`leaderboard.ts:310`). Breaks: no.
- Process dies mid-loop (rebirth path): both POSTs are awaited before `done()` → reload. Breaks: no.
- Hidden tab, pause, replay, slow-motion wheel: `main.ts:228` returns while hidden, `:240` excludes pause and replay; wheel slow-motion slows the game while `runTime` counts real time, so using the wheel costs time. Breaks: no (slightly penalises the wheel; fine). No offline earnings exist (`rg offline src` empty). Breaks: no.
- Old save at level 12 / old save after rebirth: open decisions 6-7 cover them. Breaks: no.
- 30/min cap per board: `speed` gets its own counter in the trigger, not shared with `main`. Breaks: no (once Major 1 is fixed).

Pre-mortem: A week after release PP writes "FASTEST is empty and players say the game tells them to fix their clock". The trigger's board branch, left "untouched" on purpose, rejects every `speed` row with the daily message; the signal was step 9 claiming no salt is needed, plus Done-when 23 being run only after the client had shipped. Second most likely: PP reports that MOST MONEY shows one run while he meant everything earned, because "dodaj" was read as "rename".
Inversion worth considering: do not post the time as a separate row at all; add the time to the main row (one POST, one column `lvl12_at`), which removes the second POST, the `timeSent` state and the partial-failure paths, at the cost of a column and a nullable check.
Investigate first: fastest legal run to level 12 with Deep Hunger 9, Hole Hunger 5, Keep Tools and Head Start 7 in `<scratchpad>/econ/econ2.mjs` (sets the floor); which money number PP means (per run or lifetime).

## Review: impact (plan-impact)

Verdict: BLOCK

Missing from the plan:
- [High] `src/ui/leaderboard.ts:63` `LocalStore.submit` keeps only `new Set(['main', ...daily.slice(0, 7)])`; every other board is filtered out on write. When a player submits a level-12 time, then the local `speed` row is written and dropped in the same call, so the local FASTEST tab is always empty, the online fallback (`RemoteStore.list` → `this.local.list('speed')`, `:131`) shows nothing, and matrix row 22 / Done-when 22 (`localSpeedKept 50`) cannot pass. Step 5 changes the sort of `submit()` but not this set. Fix: step 5 adds `SPEED` to `keep`.
- [High] `supabase/leaderboard.sql:36` the trigger `scores_guard` treats every board other than `main` as a daily and raises `daily board must be today or yesterday (UTC)`; `src/ui/leaderboard.ts:147` maps that body to `W_CLOCK`. When a player posts a time, then the DB refuses it and the game tells him to fix his computer clock. Same finding as roaster Major 1; from the impact side it means the trigger is a reader of `board` the plan does not list (Reach, Data "Trigger untouched", step 9 "No salt needed", alternative (f)). Fix: step 6 rewrites the board branch (`new.board like 'daily-%' and ...`), step 9 re-creates the function with the salt from Keychain `gnome-supabase-salt` inline.
- [Medium] `src/systems/hole.ts:154` XP is multiplied by `lvl('hunger')` and `deep('dXp')` (Deep Hunger, max 9 = x3.25, `src/data/upgrades.ts:111`); `hole.ts:525-534` gives Head Start money and Keep Tools on rebirth. The Data paragraph derives the 600 s floor without these neighbours. When a reborn player with Deep upgrades reaches level 12 under 600 s, then `scores_speed_check` rejects the row with `W_REJECT` and `timeSent` stays false, so every later submit repeats the reject. Same root as roaster Major 2; impact adds: step 5 must also decide what `timeSent` does on a 4xx (`W_REJECT`, `W_CLOCK`), today only "no warning" sets it.
- [Medium] Deploy order, not in step 9 or the steps list. The Pages build deploys on every push to `main` (`.github/workflows/deploy.yml`); the live `alter table` runs separately. When the SQL runs before the new build is live, then the served game sends `first_name,last_name` and selects them, so every POST gets 400 (`W_REJECT`) and every GET falls back to local (`W_DOWN`) for all players; when the build goes first, the new game gets the same errors until the SQL runs. A tab left open across the deploy keeps the old code until reload. Fix: step 9 states the order (SQL right before the push that ships the client, both in one sitting) and accepts the short window in one line (0 rows, few players).
- [Low] `supabase/check.sh:16-17` `k()` hardcodes the IEEE hex of score 1 and `row()` hardcodes `"score":1,"level":1`. The speed cases need score 600 / 599 and level 12 / 11 with a key over that score; step 7 names the hex for 600 only. Fix: `row()` and `k()` take score, level and hex as parameters (599 = `4082b80000000000`), or the speed cases build their own body.
- [Low] `README.md:26` the delete line removes test rows from `public.scores` AND `public.errors` (`where build = 'check.sh'`). Step 10 says "2b delete line"; the implementer must keep the errors half and only change the scores half to `name like 'Check-%'`.
- [Low] `src/ui/leaderboard.ts:336` the pause-menu submit does not save the game; `timeSent = true` reaches `localStorage` only at the next 10 s autosave (skipped while paused, `src/main.ts:202`) or on `beforeunload` (`:200`). When the browser crashes after a pause-menu submit, then the next submit posts the time again. Fix: `saveState(ctx.state)` after setting `timeSent`, or accept with the 2026-10-20 "honest double submits" policy in one line.

Neighbours checked: draft/live: not affected (no draft state in this game) | profiles / LEVEL 2/3: not affected (no accounts) | serve-cache: not affected (static Pages build, no cache layer) | auto-regeneration / delete-then-rebuild: affected, `hole.rebirth` (`hole.ts:519`) builds the next run with `freshState(old)`; the new fields are top-level, not in `stats`, so they reset (matrix row 20 is right) | polling / imports: old save load affected, `loadState` spread at `state.ts:149` plus the plan's explicit `runTime` line; the in-flight Fuses hunk (`state.ts:135-144`) sits above the return, so the new line goes inside the returned object, outside that hunk | find_best / cohort: not affected | dimensions / formulas: affected, Deep Hunger and Hole Hunger change the time-to-12 (finding 3); `totalEarned` writer is only `hole.ts:83`, readers `hole.ts:511` (shards) and the leaderboard, unchanged | text index / search: not affected | prompt context: not affected | widget / serving path: affected, deploy window (finding 4) | daily: `daily.ts:56` calls `offer(..., this.board, ...)`; daily state is `freshState()` and never reaches level 12 in 300 s, so no time row; the FASTEST tab on the daily page shows the global speed board, fine | error-report sink: not affected, `crash.ts` imports `online, restCall` only and writes `public.errors`; `restCall` signature unchanged | intro (in flight, `src/ui/intro.ts:20`): reads `stats.playTime`, not `runTime`; the intro runs before the first lock, while the game is paused, so `runTime` does not count it | auto-Lands (`hole.ts:243-264`): `levelUp` already finishes the slide first; the new `maxLevelAt` line sits next to the Deep toast at `:262`, no conflict with the in-flight `machineBox` hunk at `:278` | screenshot meta `shot.ts:69-74`, menu stats `menu.ts:131`: not affected | keepalive `select=score`: not affected.
FE/BE: the game is the only client. `GET scores?select=name,score,level,board,created_at` is read at `leaderboard.ts:123-127` (mapped to `Entry.name`) and `POST` body at `:140`; both are in step 5. The 400 body regex `bad key|daily board must be today or yesterday` (`:147`) reads the trigger message; if step 6 rewords that message, the regex must follow. Smoke scenarios click tabs by index (`scenario-remote-lb.js:86,91,156-157`): the plan keeps MOST MONEY at 0 and DAILY at 1, FASTEST third, so the indexes stay valid.
Decisions: consistent with `docs/ai-work/2026-10-20-supabase-leaderboard.md` (every submit writes locally first; 2b daily only today/yesterday, which the trigger change must keep for `daily-*`) and `docs/ai-work/2026-10-21-fix-plan-supabase-leaderboard-r1.md` (F4 clock message tied to the trigger text; F1 advisory lock stays in the re-created function). SPEC:248 "(PP, 2026-10-20) ... tablica wyników z imieniem i nazwiskiem" is superseded by PP's 2026-10-24 words; step 10 marks it, consistent.
Decisions older than 60 days: none (all relied-on notes are from 2026-10-20 and 2026-10-21).
Regression vs current behaviour: `check.sh` today checks `count(Script)` by `last_name`; the rename to `name=eq.Check-Script` keeps the same check, none lost. The local store loses no entries for `main` and `daily-*`; the only loss is the new `speed` board itself (finding 1).

## Plan (plan-senior, final)

Status: needs-decision

### Resolutions
- R1: roaster [Major 1] = impact [High 2] trigger rejects every `speed` row (deduplicated, one finding): Decision: accepted. Step 6 changes the trigger condition to `if new.board like 'daily-%' and new.board not in ('daily-' || today, 'daily-' || yday)`, exception text unchanged (the `W_CLOCK` regex at `leaderboard.ts:147` reads it); step 9 re-creates the function with the salt inline. Rationale: v0's "trigger untouched / no salt needed" was wrong: the board branch treats every non-`main` board as a daily. Checked: `supabase/leaderboard.sql:37`.
- R2: impact [High 1] local keep-list drops `speed` rows: Decision: accepted, step 5 adds `SPEED` to `keep`. Rationale: without it the local FASTEST tab and the offline fallback are always empty and Done-when 22 cannot pass. Checked: `src/ui/leaderboard.ts:63`.
- R3: roaster [Major 2] = impact [Medium 3] 600 s floor vs Deep upgrades, and the permanent-reject retry loop: Decision: floor lowered to 120 s (`score >= 120`), and `timeSent` becomes true on a `W_REJECT` 4xx as well as on success. Rationale: the floor is a guard against nonsense rows, not a skill rule; v0 derived 600 s from the slowest path. Upper bound on honest speed: the mouth lets out at most 20 gnomes/s (`factory.ts:248`), a machine-fed ordinary gnome pays `1 × 0.25 × 1.5 × 3.25 = 1.22 XP` with Hole Hunger 5 and Deep Hunger 9 (`hole.ts:153-154`, `upgrades.ts:103,111`), so 20/s gives about 24 XP/s and 11 305 XP takes about 470 s even at full rate from the first second; a hand throw pays x4 that per gnome but the player throws about one per second. 120 s would need 94 XP/s sustained (inference from these numbers, not measured in the econ model). Not asking PP: the floor only matters when it is too high, and 120 s leaves a 4x margin. `W_CLOCK`, `W_SEND`, `W_MAYBE` keep `timeSent` false (a clock fix or a network return should still post the time; timeout duplicates are the 2026-10-20 policy). Checked: `hole.ts:153-154`, `upgrades.ts:103,111`, `factory.ts:248`, `holeLevels.ts:11-21` (sum 11 305).
- R4: roaster [Major 3] "dodaj też jeden" money board: Decision: to PP (Decisions 1), default a) best single run = today's `totalEarned` board relabelled MOST MONEY. Rationale: the roaster is right that `lifetimeEarned` exists (`state.ts:22,74`) and PP's words can mean either; a lifetime board has no one-row-per-name rule in the DB, so one player would fill it with his own growing rows after every submit. That cost makes a) the safe default; b) needs a dedupe rule PP must pick. Checked: `state.ts:22,74`, `hole.ts:83-84`.
- R5: impact [Medium 4] deploy order: Decision: accepted, step 9 states the order: live SQL, then `check.sh` `failed: 0`, then commit+push in the same sitting. Rationale: either order has a window; SQL first keeps the window inside one sitting and `check.sh` proves the DB before the client ships. Accepted window: 0 rows, a tab open across the deploy sees `W_REJECT`/`W_DOWN` until reload.
- R6: impact [Low 5] `check.sh` hardcodes score 1: Decision: accepted, `k()` takes `hex board date`, `row()` takes `name score level board key`. Rationale: three speed cases need three different scores and keys.
- R7: impact [Low 6] README delete line: Decision: accepted, only the `scores` half changes to `name like 'Check-%'`, the `errors` half stays.
- R8: impact [Low 7] pause-menu submit does not save `timeSent`: Decision: accepted, step 5 calls `saveState(ctx.state)` right after setting `timeSent`. Rationale: one line removes a crash-duplicate path; cheaper than defending the policy line.
- R9: v0 open decision 8 live apply: Decision: a) the session runs it through the Management API (PP's word in the brief; same path as the two earlier changes). Closed, not re-asked.
- R10: v0 open decision 9 tab label: Decision: MOST MONEY. Rationale: says what it counts; cosmetic, no PP question. Becomes ALL-TIME again only if PP picks Decisions 1b.
- R11: roaster "inversion" (`lvl12_at` column on the main row instead of a second POST): Decision: rejected, see Rejected variant (b).
- Rejected: roaster [Minor] word filter / deny list for nicknames, because the board is anonymous by design ("Cheating, honestly", SPEC:232) and a deny list is a product feature PP did not ask for; PP sees the name rule in Decisions 2.
- Rejected: roaster [Minor] FASTEST ranks rebirth count more than skill, because Deep upgrades are part of the game and PP asked for "najszybsze dojście do lvl 12" without a split; step 10 writes one sentence in SPEC saying Deep runs count.
- Rejected: roaster [Minor] curl posts exactly the floor, because the key is public by accepted policy and the floor is a plausibility guard, not anti-cheat; step 10 keeps the README line.
- Rejected: roaster [Minor] timeout duplicates by design, because the 2026-10-20 "honest double submits" decision covers it; R8 closes the crash path.

### Chosen variant
v0's shape kept: one table, one key, one trigger, the time as a third board `speed` posted as a second row once per run, plus the four fixes from the reviews (trigger branch, local keep-list, 120 s floor with `timeSent` on reject, save after submit) and the SQL-then-push order. Pros: no new table, grants or caps; the time row reuses `submit(e)`, the HMAC and the 30/min counter per board; every failure path has one state (`timeSent`) and one message. Cons: two sequential POSTs on one submit; a timeout can still store a second online time (accepted policy); the trigger must be re-created with the salt once. Cost: +1 POST per run that reached level 12, then 0 (performance table); 120 s floor validates 0 live rows. Risk: the deploy window (R5, minutes, 0 rows); the floor being wrong only if an honest run beats 2 min (R3 margin 4x). Ladder: three state fields and `clock()` at rung 6 (no per-run clock or h:mm:ss helper on disk), `keep`, `rank`, regex at rung 5, SQL checks at rung 3.
### Rejected variant(s)
- (b) `lvl12_at` column on the main row (roaster's inversion): pros: one POST, no `timeSent`, no partial-failure path; cons: every later money submit of the same run carries the same time again, so the FASTEST tab shows one player N times and needs a dedupe the DB does not have; rejected because the one-time row is exactly what "once per run" needs and (b) cannot express it without a second mechanism.
- (c) separate `public.times` table (v0 alt a): pros: own grants; cons: second trigger, salt, caps and check.sh section for one float column; rejected, nothing the board check cannot do.
- (d) no DB floor (v0 decision 3c): pros: no honest run ever rejected; cons: a 0 s row from a curl sits on top of an ascending board forever; rejected because 120 s costs one check and blocks the only row a floor can block.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1-22 | as v0 rows 1-22 | | unchanged, except: row 8 footer "FASTEST = time to hole level 12" stays; row 16 `timeSent` true when the speed POST succeeded; row 22 local speed rows are kept (`keep` has `speed`) | v0, R2 |
| 23 | live DB, `board = 'speed'` | insert | `score 119` → 400, `level 11` → 400, `score 120, level 12` with a valid key → 201 (trigger passes), `board x` still 400, `daily-2099-01-01` still 400; caps unchanged | R1, R3 |
| 24-27 | as v0 rows 24-27 | | unchanged; row 26: the floor 120 s is still below the 300 s daily, but the daily never reaches level 12 anyway | v0 |
| 28 | speed POST gets a 400 that is not `bad key`/daily text (`W_REJECT`) | submit | `timeSent` true, warning `W_REJECT` shown, local keeps both rows; next submit → one POST | R3 |
| 29 | speed POST gets `W_CLOCK` (400 bad key) | submit | `timeSent` stays false; after the clock fix the next submit posts the time again | R3 |
| 30 | pause-menu submit finished (any outcome) | right after `send()` | `localStorage` save already carries the new `timeSent` value, before the next autosave | R8 |
| 31 | live trigger re-created | `check.sh` | `speed 120 s lvl 12: 2xx` and `daily-2099-01-01: 4xx` in the same run; the clock-warning text is unchanged | R1 |
| 32 | release | order | SQL applied and `check.sh` `failed: 0` BEFORE the push to `main`; an old tab sees `W_REJECT`/`W_DOWN` until reload (accepted) | R5 |

### Steps (edit order)
1. `src/core/state.ts` — as v0 step 1: `runTime: number`, `maxLevelAt: number | null`, `timeSent: boolean` in `GameState`; `freshState` sets `0`, `null`, `false`, never from `keep`; `loadState` returned object gets `runTime: parsed.runTime ?? parsed.stats?.playTime ?? 0`, `maxLevelAt: parsed.maxLevelAt ?? null`, `timeSent: parsed.timeSent ?? false` (the in-flight Fuses hunk is `:135-144`, above the return; the new lines go inside the returned object). Red test: `tools/smoke/scenario-remote-lb.js` "R19_speed_tab_and_rebirth" → `fresh {runTime:0, maxLevelAt:null, timeSent:false}`.
2. `src/main.ts:242` — `state.runTime += realDt;` after `state.stats.playTime += realDt;`. Red test: "R18_run_timer" → `unpausedDelta > 0.3, pausedDelta 0`.
3. `src/systems/hole.ts:262` — `if (s.holeLevel === MAX_HOLE_LEVEL) { s.maxLevelAt = s.runTime; ctx.hud.toast(…) }` before the existing `saveState(s)`. Red test: "R18_run_timer" → `maxLevelAtSet true, diff < 0.1, frozen true`.
4. `src/core/format.ts` — `export function clock(t: number): string` → `h:mm:ss`, hours unbounded. Red test: "R18_run_timer" → `clock(3725) === '1:02:05'`.
5. `src/ui/leaderboard.ts` — v0 step 5 in full (Entry `name`, `isEntry`, `NAME` regex per Decisions 2a, `nameError` messages, `SPEED`, `rank`/`byRank`, legacy map in `all()`, `COLS`, `list` order asc for speed, `submit` body `{ name, score, level, board, key }`, tabs `MOST MONEY` / `DAILY <date>` / `FASTEST LVL 12`, one `<input name="name" placeholder="Name or nickname" autocomplete="off" maxlength="24">`, footer texts from row 8, run line with `clock(maxLevelAt)`, speed rows render `clock(e.score)`), plus: (a) `const keep = new Set(['main', SPEED, ...daily.slice(0, DAILY_BOARDS)]);` (R2); (b) in `send()` after the speed submit: `ctx.state.timeSent = w2 === null || w2 === W_REJECT; saveState(ctx.state);` with `import { saveState } from '../core/state';` (R3, R8); `W_CLOCK`, `W_SEND`, `W_MAYBE` leave it false. Red tests: "R16_name_rules", "R17_speed_submit" (adds `reject`, `clock` and `saved` sub-cases), "R19_speed_tab_and_rebirth".
6. `supabase/leaderboard.sql` — v0 step 6 with the floor `score >= 120` and the one-line reason "a guard against nonsense rows, not a skill rule: 20 gnomes/s machine-fed with every XP upgrade is about 24 XP/s, 11 305 XP takes 470 s"; trigger line 37 → `if new.board like 'daily-%' and new.board not in ('daily-' || today, 'daily-' || yday) then`, exception text unchanged; header line 4 gains "re-creating the function needs the salt again". Red test: step 7's `speed 120 s lvl 12` (fails on live before step 9).
7. `supabase/check.sh` — `k() { printf '%s' "$1|$2|$3" | openssl dgst -sha256 -hmac "$SALT" | sed 's/.* //'; }` (hex, board, date), `row() { printf '{"name":"Check-%s","score":%s,"level":%s,"board":"%s","key":"%s"}' "$1" "$2" "$3" "$4" "$5"; }`; existing calls pass `3ff0000000000000`, `1`, `1`; `count()` → `select=name&name=eq.Check-$1`; "no key" literal and the PATCH/DELETE filters use `name=eq.Check-Script`; header delete line `delete from public.scores where name like 'Check-%';`. New cases: `say "speed 119 s" "$(post "$(row Speed 119 12 speed "$(k 405dc00000000000 speed "$T")")")" 4xx`, `say "speed level 11" "$(post "$(row Speed 120 11 speed "$(k 405e000000000000 speed "$T")")")" 4xx`, `say "speed 120 s lvl 12" "$(post "$(row Speed 120 12 speed "$(k 405e000000000000 speed "$T")")")" 2xx`, `say "old columns" "$(post '{"first_name":"Check","last_name":"Old","score":1,"level":1,"board":"main","key":"x"}')" 4xx`. Hex values verified: 119 = `405dc00000000000`, 120 = `405e000000000000`.
8. `tools/smoke/scenario-remote-lb.js` — v0 step 8 (R1-R19 with `name`), plus in `R17_speed_submit`: `reject` (speed POST stubbed 400 with body `violates check constraint` → `timeSent true`, msg = `W_REJECT`, next submit posts `["main"]`), `clock` (speed POST 400 with body `bad key` → `timeSent false`), `saved` (after a pause-menu submit `JSON.parse(localStorage.getItem(<state key>)).timeSent === true` before any autosave). Run: `npx vite --port 5199 --host 127.0.0.1`, then `CDP_PORT=9391 MAXPOLL=2400 node tools/smoke/smoke.mjs run-remote-lb tools/smoke/scenario-remote-lb.js`. Never `FULL=1`.
9. Live apply, in this order, one sitting: (1) scratchpad `slb/m.sql` = the six `alter table` lines from v0 step 9 with `score >= 120`, followed by the whole `create or replace function public.scores_guard() …` block from the updated `supabase/leaderboard.sql` with `__SALT__` replaced inline from Keychain `gnome-supabase-salt` (never printed, never written to a file in the repo), run with `slb/q.sh` (token from Keychain `supabase-access-token`); confirm constraint names first with `select conname from pg_constraint where conrelid = 'public.scores'::regclass`. (2) `sh supabase/check.sh <url> <key> <salt>` → `failed: 0`; cleanup `delete from public.scores where name like 'Check-%'`, count → 0. (3) Only then commit and push (the push ships the client).
10. Docs — v0 step 10, plus: README 2b delete line keeps `delete from public.errors where build = 'check.sh';`; SPEC adds "FASTEST liczy także biegi z ulepszeniami Deep (PP: najszybsze dojście, bez podziału)" and "baza odrzuca czas poniżej 2 minut (strażnik przed bzdurą, nie reguła umiejętności)"; CHANGELOG bullets for the three boards and the name rule.

### Review focus
1. Trigger accepts `speed` and still rejects a future daily → pinned by step 7 "speed 120 s lvl 12" (2xx) and "daily-2099-01-01" (4xx) in one `check.sh` run.
2. Permanent 4xx on the speed row is not retried on every submit → pinned by step 8 "R17_speed_submit" `reject`.
3. Local FASTEST survives `LocalStore.submit` trimming → pinned by step 8 "R19_speed_tab_and_rebirth" `localSpeedKept 50`.
4. `timeSent` reaches `localStorage` from the pause menu before an autosave → pinned by step 8 "R17_speed_submit" `saved`.
5. Old client against the new DB (deploy window) → no test; pinned by step 9's order line and `check.sh` before the push.

### Done when
1. R1 → `inputs ["name"], placeholder "Name or nickname", autocomplete ["off"]`
2. R16 → `ok: callsPOST 1, body.name "Ania_42", keys "name,score,level,board,key", localName "Ania_42"`
3. R16 → `html: msg "Name: no HTML, please.", calls 0`
4. R16 → `long: msg "Name: 1-24 characters."`, `blank: msg "Name: 1-24 characters."`
5. R16 → `bang: msg "Name: letters, digits, spaces, . _ - ' only."`
6. R16 → `legacyRow "1. Old Local", legacyStored {"name":"Old Local"}`
7. R2 → `rows ["1. Alpha","2. Beta"], shown 2, in 3`
8. R1 (local) → `foot "Score = money earned this run, spent or not. FASTEST = time to hole level 12. Esc closes."`; R2 (remote) → foot contains `Your name or nickname is shown publicly online`
9. check.sh → `old columns: got 400 want 4xx ok`, `30-char name: got 400 want 4xx ok`, `valid row: got 201 want 2xx ok`
10. check.sh → `select=id 401`, `select=key 401`, `select=* 401`, `valid row stored: got 1 want 1 ok` (reads `select=name`)
11. `rg -n "totalEarned \+=" src` → exactly `src/systems/hole.ts:83`
12. `rg -n "totalEarned -=" src` → no output
13. R18 → `unpausedDelta > 0.3, pausedDelta 0`
14. R18 → `level 12, maxLevelAtSet true, diff < 0.1, frozen true`
15. R17 → `runLine contains "· Lvl 12 in 0:20:34"`; R4 → `runLine lacks "Lvl 12 in"`
16. R17 → `posts ["main","speed"], speedBody {score:1234, level:12}, keyHex true, localRows 2, timeSent true`
17. R17 → `secondPosts ["main"]`
18. R17 → `fail: timeSent false, msg "Could not reach the online board: score saved on this computer only.", localRows 2`
19. R4 → `calls "POST,GET"` (one POST without a time)
20. R19 → `rebirth: posts 2, done 1, fresh {runTime:0, maxLevelAt:null, timeSent:false}`
21. R19 → `url contains "board=eq.speed&order=score.asc&limit=10", rows ["1. Fast"], cells ["0:10:00","Lvl 12"]`
22. R19 → `localSpeedKept 50, ascending true, mainKept unchanged`
23. check.sh → `speed 119 s: got 400`, `speed level 11: got 400`, `speed 120 s lvl 12: got 201`, `board x: got 400`, `40 parallel POSTs on daily-…: accepted: got 30`
24. `rg -n "runTime: parsed.runTime \?\? parsed.stats\?.playTime" src/core/state.ts` → 1 line
25. R17 → `noTime: posts ["main"]` with `maxLevelAt null, holeLevel 12`
26. `rg -n "score >= 120" supabase/leaderboard.sql` → 1 line; `rg -n "daily" src/ui/leaderboard.ts` shows no speed condition (none required)
27. `rg -n "nazwa gracza|FASTEST LVL 12" docs/SPEC.md` → ≥ 2 lines; `rg -n "name like 'Check-%'" README.md` → 1; `rg -n "build = 'check.sh'" README.md` → 1; `rg -n "Name or nickname|nickname" CHANGELOG.md` → ≥ 1; `rg -n "first_name|last_name" src supabase tools README.md docs/SPEC.md` → no output
28. R17 → `reject: timeSent true, msg "The online board rejected this score: saved on this computer only.", nextPosts ["main"], localRows 2`
29. R17 → `clock: timeSent false, msg contains "check your computer's date and time"`
30. R17 → `saved: storedTimeSent true` (read from `localStorage` right after `send()`, no autosave in between)
31. check.sh → `speed 120 s lvl 12: got 201` and `daily-2099-01-01: got 400` in the same run; `rg -n "new.board like 'daily-%'" supabase/leaderboard.sql` → 1 line; `rg -n "daily board must be today or yesterday" supabase/leaderboard.sql src/ui/leaderboard.ts` → 2 lines (text unchanged on both sides)
32. Release order: `sh supabase/check.sh … → failed: 0` printed in the session BEFORE `git -C … push origin main`; `git log -1 --format=%H` of the push is later than the check.sh run in the session transcript

### Decisions for PP
PP (2026-10-24, terminal, verbatim): "1. a. 2. a (ale ogranicz je do 20 znakow) 3. za kazdym razem gdy wskoczysz nie rozumiem pytania. kolejne razy beda szybsze wiadomo i tak ma byc" → 1a (best single run, MOST MONEY); 2a characters but max 20 (not 24); 3: every run that reaches hole level 12 posts its time (after each rebirth too — later runs are faster on purpose, no per-save limit); spec-silent items a.
PP (2026-10-24, terminal, verbatim): "wpisywanie sie do leaderboard dajemy tylko po wskoczeniu pod escape wyswietlamy sama liste bez formularza" → the submit form appears only after jumping into the hole (the rebirth "SUBMIT YOUR RUN" screen); the pause-menu Leaderboard (Esc) shows the boards only, no form. So the level-12 time is posted with that rebirth submit (once per run that reached 12). Orchestrator assumption, [spec silent]: the daily challenge's end screen keeps its form (it is the end of that run); if wrong, drop it there too.
1. „Najwięcej zgromadzonych pieniędzy": liczymy najlepszy jeden bieg czy sumę ze wszystkich biegów? a) najlepszy jeden bieg (dzisiejsza tablica, zarobione plus wydane w tym biegu, nazwa MOST MONEY): tablica jest gotowa, nic nie dochodzi. b) suma ze wszystkich biegów (zarobione plus wydane od początku gry, licznik `lifetimeEarned`): dochodzi czwarta tablica LIFETIME, a jeden gracz po każdym wysłaniu ląduje na niej jeszcze raz z większą kwotą, bo baza nie trzyma jednego wiersza na nazwę; trzeba by dopisać regułę „jeden wiersz na nazwę", której plan nie ma. (rekomendacja: a, bo odpowiada słowom „zgromadzone i wydane" bez nowej tablicy i bez problemu z powtórkami)
2. Jakie znaki może mieć imię albo nazwa gracza? a) litery, cyfry, spacje i `. _ - '`: nazwy jak `Ania_42` albo `Mr. T` przechodzą, baza dalej blokuje HTML. b) jak dziś: litery, spacje, `-` i `'`; `Ania_42` dostaje komunikat o błędzie. (rekomendacja: a)
3. Kiedy czas dojścia do poziomu 12 idzie na tablicę? a) przy pierwszym wysłaniu wyniku po poziomie 12, z menu pauzy albo z ekranu SUBMIT YOUR RUN, raz na bieg: gracz, który nigdy nie skoczy do dziury, też trafia na FASTEST. b) tylko na ekranie SUBMIT YOUR RUN przy odrodzeniu: kto nie skoczy, nie ma czasu. (rekomendacja: a)
4. [spec silent] Zakładam: start money from the Deep upgrade and old-upgrade refunds do not count as "earned" | Dowód: `src/systems/hole.ts:526`, `src/core/state.ts:126,132` write `money` only, `totalEarned` only at `hole.ts:83` | Jeśli źle: a reborn player with `dStart` starts the board $100-$218,700 lower than PP expects | Pewność: Likely | rekomendacja: a) keep as is.
5. [spec silent] Zakładam: money stolen by greedy gnomes does not lower the score | Dowód: `src/entities/gnomes.ts:741` lowers `money` only | Jeśli źle: "zgromadzone" would mean the cash on hand, a different number | Pewność: Confident | rekomendacja: a) keep as is (PP said "zgromadzone i wydane").
6. [spec silent] Zakładam: a save from before this change uses its total play time as the run clock, also after a rebirth (an overestimate) | Dowód: `src/core/state.ts:39` `stats.playTime` survives rebirth (`:84`), no per-run clock exists | Jeśli źle: an old reborn save posts a slow time instead of none | Pewność: Likely | rekomendacja: a) accept the overestimate.
7. [spec silent] Zakładam: a save already at level 12 today gets no time row for this run | Dowód: `hole.ts:262` runs once per run, the moment is gone | Jeśli źle: the player expects a time after the update | Pewność: Confident | rekomendacja: a) no time, the next run counts.
Resolved without PP (facts from the code, listed so PP sees them): floor 2 minutes instead of 10 (R3); tab label MOST MONEY (R10); live SQL through the Management API by the session (R9, PP's word in the brief); no word filter for nicknames; Deep runs count on FASTEST.

### v0 → final
- added: trigger branch fix and function re-create with the salt (step 6, 9); `SPEED` in the local keep-list (step 5a); floor 600 s → 120 s and `timeSent` true on a permanent 4xx (step 5b, 6); `saveState` after the pause-menu submit (step 5b); parametrised `k()`/`row()` and three speed cases in check.sh (step 7); release order SQL → check.sh → push (step 9); matrix rows 28-32 and Done-when 28-32.
- dropped: v0 claim "trigger untouched / no salt needed" and alternative (f)'s reasoning; v0 open decisions 3 (floor), 8 (who runs SQL), 9 (tab label) resolved by the senior.
- moved to PP: which money the MOST MONEY board counts (best run vs lifetime sum, default best run); v0 decisions 1 (name characters) and 2 (when the time posts) stay as PP questions with defaults; the four `[spec silent]` items stay in their format.
