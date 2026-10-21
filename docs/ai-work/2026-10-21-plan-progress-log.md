# Plan: gameplay progress log in Supabase

Spec: PP (Slack 2026-10-21 23:30): "Jak dasz radę to dysk logo przebiegu gry co kto kupił na każdym poziomie ile miał kasy i wrzuconych gnomów przy każdym poziomie aż do końca. Jeśli się da to odczytaj z przeglądarki jakieś dane super byłoby nazwę kompa a jak nie to coś wymyśl np user agent I IP albo cookie zapisane po wpisaniu nicku żeby ten progress śledzić" + (23:32) "O archivements zobacz" + the hub's decisions (new insert-only table like `errors`; one row per hole level-up and at the end of a run; random `player_id` in localStorage; nickname attached once entered; trimmed user agent; no computer name, no IP; a privacy line in the menu; trigger rate limits; the game keeps working when Supabase is down; DEV never sends; a ready SQL query for PP).
Trivial check: a new data path (browser → new Supabase table with RLS and a trigger), hooks in four game systems (hole, shop, achievements, leaderboard), a new localStorage key, a menu line, SQL, check script, scenario.

## Plan v0 (plan-author)

### Goal
On the GitHub Pages build every hole level-up and every end of a run writes one row to `public.progress` (level, time, money, gnomes, purchases and achievements since the previous row, player id, nickname once known), readable only from the dashboard, and PP can list one player's run level by level with one query.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | `npm run dev` (DEV) | level-up, rebirth | zero POSTs to `/rest/v1/progress`; `store.constructor.name === 'LocalStore'` | CLAUDE.md "DEV never sends"; `leaderboard.ts:169` `online` null in DEV |
| 2 | production build without the three `VITE_SUPABASE_*` variables (5300 playtest) | level-up | zero POSTs, no localStorage queue growth | `leaderboard.ts:169` |
| 3 | online, first page load ever | boot | `localStorage['gnome-boozed-player']` = `{ id: <uuid>, name: null, seq: 0, buy: [], ach: [], queue: [] }`; the same `id` after a reload | hub: random player_id, kept |
| 4 | online, hole level-up (the only writer: `hole.ts:291`) | `levelUp()` | one row `kind='level'`, `level` = new level, `run` = `stats.rebirths`, `run_time`, `play_time`, `money`, `earned`, `gnomes` (this run), `gnomes_total`, `land`, `purchases` and `achievements` since the previous row, `seq` = previous + 1, `build`, `ua`; the buffers are emptied | PP "co kupił na każdym poziomie ile miał kasy i wrzuconych gnomów" |
| 5 | online, shop purchase with money (`shop.ts:237`) | `buy(id, 1)` | `{ id, lvl: next, cost }` appended to the purchase buffer and persisted; no POST now | PP "co kupił" |
| 6 | online, Deep purchase with shards (`shop.ts:233`) | `buy(id, 1)` on a `currency: 'shards'` row | appended like row 5 (`cost` in shards; Deep ids start with `d`) | `spec silent` |
| 7 | online, downgrade (`shop.ts` `dir = -1`, Strong Arm) | `buy(id, -1)` | appended like row 5 with `lvl` one lower than before and the price paid | `spec silent` |
| 8 | online, achievement unlocked (`achievements.ts:16`) | `unlock(id)` | `{ id, run_time, level }` appended to the achievement buffer; sent with the next row | PP "O archivements zobacz" |
| 9 | online, jump into the hole | `Hole.rebirth()` after the leaderboard offer, before `freshState(old)` | one row `kind='rebirth'` from the old state (values as row 4), POST with `keepalive: true` before `location.reload()`; buffers emptied; the next run's rows carry `run + 1` | hub: end of a run (jump / rebirth) |
| 10 | online, daily run over (`daily.ts:57`) | `daily.update()` sets `over` | one row `kind='daily'`, `daily=true`, keepalive, before the leaderboard offer; level rows of a daily run carry `daily=true` | `spec silent` (second end-of-run path) |
| 11 | online, "Reset save" (`menu.ts:61`) | second click | one row `kind='reset'` keepalive before `location.reload()`; `gnome-boozed-player` survives (`wipeSave` removes only the save key) | `spec silent` (third end-of-run path) |
| 12 | online, player types a nickname on the leaderboard (`leaderboard.ts:328`) | `send()` after `nameError` passes | `name` stored in `gnome-boozed-player`; every later row carries it; earlier rows keep `name = null` | PP "cookie zapisane po wpisaniu nicku żeby ten progress śledzić" |
| 13 | online, Supabase unreachable / timeout / 5xx | any row | the row stays in `queue` (at most 30 rows, oldest dropped), the game runs on, no box, no console error, no `unhandledrejection` | hub: keep working when Supabase is down |
| 14 | online, 4xx (cap hit, constraint) | any row | the row is dropped, not retried | like `crash.ts:48` (no retry on reject) |
| 15 | online, rows waiting in `queue` | boot or the next row | sent one by one in `seq` order, each removed after 2xx | client offline behaviour |
| 16 | online, timeout then the same row resent | next event | a second copy may exist; PP's query orders by `seq` and `distinct on (seq)` hides it | `leaderboard.ts:35` precedent (honest double submits allowed) |
| 17 | server, 200 rows with one `player` in 24 h | the 201st insert | 400 `progress log full for this player today` | hub: rate limits like errors |
| 18 | server, 3000 rows in 24 h | the next insert | 400 `progress log full for today` | hub: rate limits like errors |
| 19 | server, publishable key | GET, PATCH, DELETE, POST with `id`, `kind='x'`, `purchases` not an array, `purchases` text > 8000 chars, `player='abc'`, `name` 21 chars | all 4xx | hub: insert-only, size bounds |
| 20 | online, localStorage blocked (private mode) | boot | a fresh random `id` this page load, rows still sent, no exception | `state.ts:202` precedent |
| 21 | menu (pause and title) | open | online build: a dim line "The game sends anonymous gameplay statistics (hole level, money, purchases, achievements; no names unless you enter one on the leaderboard)."; DEV / no variables: no line | hub: privacy line |

`spec silent`: 4 rows (6, 7, 10, 11).

### Reach
- `src/systems/hole.ts:284` `levelUp()` (private, the only `holeLevel++` in `src`): add `progress.level()` after `s.maxLevelAt = s.runTime` block, before `saveState(s)`. `hole.ts:606` `rebirth()`: add `progress.end('rebirth')` before `const next = freshState(old)`. Callers of `rebirth`: `player.ts:508` (through `leaderboard.offer`).
- `src/ui/shop.ts:224` `buy(id, dir)`: after the `if (u.currency === 'shards') … else …` block add `progress.bought(id, next, cost)`. Other money writers: `hole.ts:98` (income), `gnomes.ts:771` (shadow theft); neither is a purchase, both show up in `money` of the next row. Other upgrade writers: `hole.ts:620` (Keep Tools carries levels through a rebirth, not a purchase). `main.ts:48` clamps levels above caps (not a purchase).
- `src/systems/achievements.ts:12` `unlock(id)`: add `progress.achieved(id)` after `ctx.state.achievements.push(id)`. Callers: `achievements.ts:42` (checks), `hole.ts:277` (`booze`), `rebirth()` pushes `'rebirth'` straight into `next.achievements` (`hole.ts:626`) without `unlock()`: that one is not logged (it is implied by the `rebirth` row).
- `src/ui/leaderboard.ts:326` `send()`: after `if (err) …` add `progress.setName(name)`. Name is already validated (`nameError`, ≤ 20 chars).
- `src/systems/daily.ts:52` `update()`: add `progress.end('daily')` after `this.over = true`, before `ctx.leaderboard.offer(...)`.
- `src/ui/menu.ts:61`: `progress.end('reset')` before `wipeSave()`. `menu.ts:91` settings block: the privacy line.
- `src/main.ts`: `progress.init()` right after `ctx.leaderboard = new Leaderboard()` (`main.ts:123`), so `ctx.state` exists and the boot flush of `queue` runs once.
- Read-only state fields: `holeLevel`, `land`, `money`, `totalEarned`, `runTime`, `stats.playTime`, `stats.gnomesEaten`, `runEatenStart` (`hole.ts:17`, missing in older saves → 0), `stats.rebirths`, `daily.active`.
- Reused: `online`, `restCall` (`leaderboard.ts:108,167`), `BUILD` (move `commit`/`BUILD` from `crash.ts:8-9` into an export, imported by both), `UA_MAX` pattern (`crash.ts:13`).
- Response shape: none (`Prefer: return=minimal`, no select grant). Consumer: PP in SQL Editor (query in README).
- Import graph: `progress.ts` imports `ctx` (type-only module), `online`/`restCall` from `ui/leaderboard`, `BUILD` from `ui/crash`; `leaderboard.ts` and `crash.ts` import `progress.ts` → cycle `leaderboard ↔ progress`. Resolution: `progress.ts` imports from `leaderboard.ts` at module level, `leaderboard.ts` imports `progress` only inside `send()` body via a static import of a function (ESM live bindings make this safe because neither side uses the other at module-evaluation time; `online` is computed in `leaderboard.ts` at load, which `progress.ts` reads only inside `init()`).

### Data
- New table `public.progress` (`supabase/progress.sql`): `id bigint identity pk`, `created_at timestamptz default now()`, `player text` check `~ '^[0-9a-f-]{36}$'`, `name text null` check `char_length(name) between 1 and 20`, `seq integer` check `between 0 and 1000000`, `kind text` check `in ('level','rebirth','daily','reset')`, `daily boolean default false`, `level smallint` check `1..99`, `run integer` check `0..100000`, `run_time integer` check `>= 0` (seconds), `play_time integer` check `>= 0`, `money double precision` check `>= 0 and < 1e300`, `earned double precision` same, `gnomes integer` check `>= 0`, `gnomes_total integer` check `>= 0`, `land smallint` check `0..9`, `purchases jsonb default '[]'` check `jsonb_typeof(purchases) = 'array' and jsonb_array_length(purchases) <= 120 and char_length(purchases::text) <= 8000`, `achievements jsonb default '[]'` check `array, length <= 27 (ACHIEVEMENTS.length), char_length <= 2000`, `build text` check `<= 200`, `ua text default ''` check `<= 300`.
- Indexes: `progress_player (player, seq)` (the per-player daily count and PP's query), `progress_created (created_at)` (the daily count).
- RLS: `enable row level security`, `revoke all from anon, authenticated`, `grant insert (player, name, seq, kind, daily, level, run, run_time, play_time, money, earned, gnomes, gnomes_total, land, purchases, achievements, build, ua) to anon`, one insert policy `with check (true)`, no select. Trigger `progress_guard` before insert, `security definer`, `set search_path = ''`, `pg_advisory_xact_lock(hashtext('public.progress_guard'))`, then: `count(*) where created_at > now() - interval '24 hours' >= 3000` → `raise exception 'progress log full for today'`; `count(*) where player = new.player and created_at > now() - interval '24 hours' >= 200` → `raise exception 'progress log full for this player today'`.
- Idempotent: `create table if not exists`, `create index if not exists`, `drop policy if exists` + `create policy`, `create or replace function`, `drop trigger if exists` + `create trigger`; grants and `revoke` are idempotent by nature.
- Volume: `scores` 0 and `errors` 0 rows on 2026-10-21 after cleanup (`2026-10-21-error-reports.md:23`); players on Pages: PP's testers, tens per day at most. Per run: 11 level rows (levels 2..12) + 1 end row = 12 POSTs over a 30-60 min run; a daily run ≤ 12 too. Row size: fields ≈ 400 B + purchases (worst 120 × ~45 B = 5.4 KB, typical 5-30 entries ≈ 1 KB) + achievements (≤ 27 × ~40 B ≈ 1 KB) → typical 1.5 KB, max ≈ 10 KB. Flood at the caps: 3000 rows/day × 10 KB = 30 MB/day worst case, ≥ 16 days to fill the 500 MB Free database (errors: 9.2 MB/day). Trigger cost per insert: one lock + two index-range counts (≤ 3000 and ≤ 200 rows).
- Purchase buffer bound: 68 upgrades, 386 total levels (`npx tsx` count), so one level could in theory hold 386 purchases; the client keeps the first 120 and drops the rest (`purchases` ends with `{ id: 'more', lvl: 0, cost: n }` counting the dropped ones).

### Steps (edit order)
1. `src/ui/crash.ts:8-9`: `export const BUILD` (unchanged value). Test: `scenario-errors.js` E2_build unchanged.
2. `src/systems/progress.ts` (new, ~120 lines). Constants: `KEY = 'gnome-boozed-player'`, `QUEUE_MAX = 30`, `BUY_MAX = 120`, `UA_MAX = 300`. `type Kind = 'level' | 'rebirth' | 'daily' | 'reset'`; `type Row = { player: string; name: string | null; seq: number; kind: Kind; daily: boolean; level: number; run: number; run_time: number; play_time: number; money: number; earned: number; gnomes: number; gnomes_total: number; land: number; purchases: { id: string; lvl: number; cost: number }[]; achievements: { id: string; run_time: number; level: number }[]; build: string; ua: string }`. Module state `P = { id, name, seq, buy, ach, queue }` read from `KEY` (bad JSON or missing → fresh `{ id: crypto.randomUUID(), name: null, seq: 0, buy: [], ach: [], queue: [] }`), `save()` writes it back (try/catch, like `saveState`). `let sink: ((row: Row, keepalive: boolean) => Promise<void>) | null = null`. Exports: `init()` (reads `online`; when set: `installProgressSink(online.url, online.key)` then `void flush(false)`), `installProgressSink(url, key)` (sets `sink = (row, keepalive) => restCall(url, key, 'progress', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row), keepalive })`), `bought(id, lvl, cost)`, `achieved(id)` (both: push to the buffer, cap `BUY_MAX`, `save()`; no-op when `!online`), `setName(name)`, `level()` → `push('level', false)`, `end(kind)` → `push(kind, true)`. `push(kind, keepalive)`: `if (!sink) return;` build the row from `ctx.state` (`gnomes = stats.gnomesEaten - (runEatenStart ?? 0)`, `run_time = Math.round(runTime)`, `play_time = Math.round(stats.playTime)`, `daily: daily.active`), `seq = ++P.seq`, empty `buy`/`ach`, append to `queue` (drop oldest past `QUEUE_MAX`), `save()`, `void flush(keepalive)`. `flush(keepalive)`: guarded by a `sending` flag; for each row of `queue` in order: `await sink(row, keepalive)`; on 2xx remove it and `save()`; on a thrown error with `status < 500` remove it (row 14); on network/timeout/5xx stop (row 13). Every public function body in try/catch: the log must never raise. Test: `tools/smoke/scenario-progress.js` (step 8).
3. `src/systems/hole.ts`: `progress.level()` at the end of `levelUp()` before `saveState(s)` (line 313); `progress.end('rebirth')` at the top of `rebirth()` after `old.placed = ctx.machines.serialize()` (line 608).
4. `src/ui/shop.ts:239` (after the currency block): `progress.bought(id, next, cost)`. `src/systems/achievements.ts:16`: `progress.achieved(id)`. `src/systems/daily.ts:55`: `progress.end('daily')`. `src/ui/menu.ts:61`: `progress.end('reset')`. `src/ui/leaderboard.ts:334` (after the name check): `progress.setName(name)`. `src/main.ts:123`: `progress.init()`.
5. `src/ui/menu.ts:91` settings block: `${online ? '<p class="dim">The game sends anonymous gameplay statistics (hole level, money, purchases, achievements; no names unless you enter one on the leaderboard).</p>' : ''}` (import `online` from `../ui/leaderboard`; `.dim` exists in `legend.ts:248` style usage, reuse).
6. `supabase/progress.sql` (new): the table, indexes, grants, policy, trigger from "Data", idempotent forms, header comment like `errors.sql:1-4`. Exception texts word for word: `progress log full for today`, `progress log full for this player today`. Footer comment: PP's query (also in README):
   ```sql
   -- one player's run, level by level (replace the id; find it by name with the second query)
   select distinct on (seq) seq, kind, level, run, run_time, play_time, money, earned, gnomes, purchases, achievements, created_at
   from public.progress where player = '<player id>' order by seq, created_at;
   -- who is who: the last nickname seen per player
   select player, max(name) as name, max(created_at) as last_seen, count(*) as rows from public.progress group by player order by last_seen desc;
   ```
7. `supabase/check.sh`: `progress_checks()` reusing `code`/`say`: `prow()` printf of a valid row (`build: 'check.sh'`), `ppost()`; cases: valid row 2xx; GET `progress?select=level&limit=1` 4xx; PATCH 4xx; DELETE 4xx; `id` in body 4xx; `kind` `x` 4xx; `purchases` `{}` 4xx; `purchases` of 121 entries 4xx; `player abc` 4xx; `name` 21 chars 4xx; `ONLY=progress` added to the `case`. Header cleanup line `delete from public.progress where build = 'check.sh';`. Caps (rows 17, 18): rolled-back `do` blocks through the Management API like `2026-10-21-error-reports.md` Done-when 17/25.
8. `tools/smoke/scenario-progress.js` (new, pattern of `scenario-errors.js`: stub `window.fetch`, record `/rest/v1/progress` calls, dynamic import of `/src/systems/progress.ts`, `M.installProgressSink('https://example.supabase.co', 'sb_publishable_test')` after P1). Steps under "Tests".
9. Docs: `README.md` step "2d. Paste `supabase/progress.sql` into SQL Editor, Run once" + "Reading a player's run" with the two queries; `docs/SPEC.md` (online section): one paragraph on the progress log (what is sent, caps, the menu line, no names unless entered, no IP) + decision lines `(PP, 2026-10-21)` and `(rekomendacja, 2026-10-21)` for rows 6, 7, 10, 11; `CHANGELOG.md` top: one bullet ("The online version sends anonymous progress statistics: hole levels, purchases, achievements. No names unless you enter one on the leaderboard."); `BOARD.md` status line; ai-work note `docs/ai-work/2026-10-21-progress-log.md`.
10. Live apply of `progress.sql` (see Open decisions [P2]); then `ONLY=progress sh supabase/check.sh <url> <key>` → `failed: 0`; delete `build = 'check.sh'` rows → 0.

### Tests
Scenario `tools/smoke/scenario-progress.js`, dev 5199: `DEV_PORT=5199 CDP_PORT=<free> MAXPOLL=2400 node tools/smoke/smoke.mjs <scratchpad>/progress tools/smoke/scenario-progress.js`. `g = window.gnome`; `lvl = () => g.hole.levelUp()` (private in TS, callable in JS); `buy = (id) => g.shop.buy(id)` after `g.state.money = 1e9`.
- P1 (rows 1, 3): `g.leaderboard.store.constructor.name === 'LocalStore'`; `lvl()`; 1 s → `calls.length === 0`; `JSON.parse(localStorage['gnome-boozed-player']).id` matches uuid regex; reload later (P9) shows the same id.
- P2 (rows 4, 5, 8): install the stub sink; `buy('kick')`, `buy('speed')`, `g.achievements.unlock('first')`; `lvl()`; 1 s → one POST: url ends `/rest/v1/progress`, `Prefer return=minimal`, `keepalive false`, body keys exactly the grant list, `kind 'level'`, `level === g.state.holeLevel`, `seq === 1`, `purchases` = `[{id:'kick',lvl:1,cost:40},{id:'speed',lvl:1,cost:20}]`, `achievements[0].id === 'first'` with `level` and `run_time` numbers, `name null`, `gnomes === g.state.stats.gnomesEaten - (g.state.runEatenStart ?? 0)`.
- P3 (rows 6, 7): `g.state.shards = 100; buy('dStart')`; `g.shop.buy('throw', 1); g.shop.buy('throw', -1)`; `lvl()` → `purchases` has `dStart` (cost in shards), `throw lvl 1`, `throw lvl 0`; the previous `kick`/`speed` are not repeated (buffer emptied).
- P4 (row 12): set the leaderboard input to `Tester`, submit through `g.leaderboard.send()` with the store stubbed to `LocalStore` → `localStorage` name `'Tester'`; `lvl()` → body `name 'Tester'`.
- P5 (rows 13, 15): `next = () => Promise.reject(new TypeError('net'))`; `lvl()`; 1 s → `queue.length === 1` in localStorage, `g.time` advanced, `LOGS` has no new line; `next = () => empty(201)`; `lvl()` → two POSTs in `seq` order, `queue.length === 0`.
- P6 (row 14): `next = () => empty(400)`; `lvl()` → one POST, `queue.length === 0` (dropped).
- P7 (row 9): `M.end('rebirth')` directly (the real `rebirth()` reloads the page) → POST `kind 'rebirth'`, `keepalive true`, `run === g.state.stats.rebirths`; plus a static check that `hole.ts` calls it (Done-when 9).
- P8 (rows 10, 11): `M.end('daily')` with `daily.active` faked through `URL_QUERY='?lowfx&daily='` in a second page load → `kind 'daily'`, `daily true`; `M.end('reset')` → `kind 'reset'`; static checks that `daily.ts` and `menu.ts` call them.
- P9 (rows 3, 20): reload → the same `id`; then `Object.defineProperty(localStorage, 'setItem', { value: () => { throw new Error('blocked') } })`, reload → a different id, `lvl()` POST still recorded, no exception in `LOGS`.
- P10 (row 16): `next` = timeout (`AbortSignal` error with `name 'TimeoutError'`), `lvl()`, then `next = () => empty(201)`, `lvl()` → the first row is POSTed twice with the same `seq`; the README query with `distinct on (seq)` is what hides it (SQL checked in step 10 on the live table with two seeded rows, then deleted).
- Row 21: `scenario-progress.js` P0: `document.querySelector('.settings')?.textContent` does not contain `anonymous gameplay statistics` (DEV); a production build with the real URL/key + `vite preview` + FULL=1 → contains it.
- Rows 2, 17, 18, 19: production build without variables + preview + FULL=1 `lvl()` → `calls 0`; `check.sh` lines; rolled-back `do` blocks.

### Done when
1. `DEV_PORT=5199 … scenario-progress.js` → `P1 {"store":"LocalStore","calls":0,"idOk":true}`
2. `npx vite build --outDir <scratchpad>/noenv` + preview + FULL=1 `lvl()` → `RESULT {"calls":0,"queue":0}`
3. `P1 … "idOk":true` and `P9 {"sameId":true,…}`
4. `P2 {"kind":"level","seq":1,"keys":"player,name,seq,kind,daily,level,run,run_time,play_time,money,earned,gnomes,gnomes_total,land,purchases,achievements,build,ua","prefer":"return=minimal","keepalive":false,"levelOk":true,"gnomesOk":true}`
5. `P2 … "purchases":[{"id":"kick","lvl":1,"cost":40},{"id":"speed","lvl":1,"cost":20}]`
6. `P3 … "dStart":true`
7. `P3 … "throw":[1,0],"repeated":false`
8. `P2 … "achievements":[{"id":"first","level":1,"run_time":<n>}]` with `typeof run_time === 'number'`
9. `P7 {"kind":"rebirth","keepalive":true,"runOk":true}` and `rg -n "progress.end\('rebirth'\)" src/systems/hole.ts` → 1 line before `freshState(old)`
10. `P8 {"daily":{"kind":"daily","daily":true}}` and `rg -n "progress.end\('daily'\)" src/systems/daily.ts` → 1 line
11. `P8 {"reset":{"kind":"reset"}}` and `rg -n "progress.end\('reset'\)" src/ui/menu.ts` → 1 line before `wipeSave()`
12. `P4 {"stored":"Tester","rowName":"Tester","earlierNull":true}`
13. `P5 {"queuedAfterNet":1,"timeAdvanced":true}`; `LOGS:` has no line after the header
14. `P6 {"posts":1,"queueAfter400":0}`
15. `P5 … "sentAfter":2,"seqOrder":true,"queueAfter":0`
16. `P10 {"sameSeqTwice":true}` and the README query on two seeded rows with one `seq` → 1 row (then deleted)
17. rolled-back block A (201 rows one player) → `error: progress log full for this player today`; count before = count after
18. rolled-back block B (3000 rows) → `error: progress log full for today`; count before = count after
19. `ONLY=progress sh supabase/check.sh <url> <key>` → every `progress:` line `ok`, `failed: 0`
20. `P9 {"sameId":true,"blockedIdDiffers":true,"blockedPost":1}`; `LOGS:` empty
21. `P0 {"menuLine":false}` (DEV) and the production build preview → `RESULT {"menuLine":true}`

### Assumptions (numbered)
1. (hub) A new table `progress`, insert-only with the publishable key, read only in the dashboard; caps in the trigger: 200 rows per player and 3000 per 24 h.
2. (hub) One row per hole level-up and one at the end of a run; purchases and achievements are carried as JSON arrays "since the previous row", not as their own rows (12 POSTs per run instead of ~60).
3. (hub) Identity: random uuid in `localStorage['gnome-boozed-player']`; nickname copied there when entered on the leaderboard; `navigator.userAgent` cut to 300 chars. No computer name (impossible in a browser), no IP (not readable without a third party; personal data under GDPR, see [P1]).
4. The hub said "localStorage (and a cookie)"; the plan keeps localStorage only: "Reset save" already spares it (`wipeSave` removes one key), and "Clear site data" wipes cookies too, so a cookie would only add a second writer of the same id.
5. "Time since the save started" = `stats.playTime` (unpaused seconds over all runs of this save), "run time" = `runTime`; no new field in the save.
6. "Gnomes fed" is sent twice: this run (`gnomesEaten - runEatenStart`) and lifetime (`gnomesEaten`).
7. Ordering by `seq` (client counter, persisted) instead of client time: rows may be sent late (queue) and clocks are wrong on some machines (`W_CLOCK` precedent).
8. Decisions relied on: `2026-10-20-plan-supabase-leaderboard.md`, `2026-10-21-plan-error-reports.md`, `2026-10-20-settings-cookies.md`: all ≤ 2 days old, none older than 60 days.

### Alternatives rejected
- (a) One row per purchase and per achievement: ~5x the POSTs and trigger counts for the same information; the arrays are bounded and PP reads a run as one table anyway.
- (b) Buffer purchases in `GameState` (the save): the save is wiped on rebirth/reset and daily runs never save; a separate key survives both and keeps the save shape untouched.
- (c) Batch several rows into one PostgREST array insert: one bad row rejects the whole batch (`check.sh` "array with bad row" precedent), and a run produces one row every few minutes, so there is nothing to batch.
- (d) Hash of the user agent + screen as a "computer id": a fingerprint is personal data under GDPR and gives nothing the random id does not.
- (e) Sending the IP from a third-party service: PP named it, but it needs an extra network call to a stranger and is personal data; asked as [P1] instead.

### Ladder
- `src/systems/progress.ts` (new file, rung 6): no existing module keeps a persisted queue; `crash.ts` is per page load and dedupes by message. Spec: "jedna linia na poziom", "śledzić progress".
- `online`, `restCall`, `BUILD` reused (rung 2). `crypto.randomUUID`, `localStorage`, `fetch keepalive` platform (rung 3). No new dependency.
- `seq` column (rung 6): spec "aż do końca" needs an order that survives late sends.
- `kind` with four values (rung 6): the three end paths exist in the code (`rebirth`, `daily.ts:57`, `menu.ts:61`); one column instead of three booleans.
- `daily` column (rung 6): a daily run is a different game (60 s, fresh state); PP would otherwise read it as a 1-level run.
- `QUEUE_MAX = 30`, `BUY_MAX = 120` (rung 5): one line each; bounds for the size checks in SQL.
- Menu line (rung 2): the existing settings block and `.dim` style.
- Not built: a settings toggle to opt out (not asked; one line [P3] if PP wants it), a client daily cap (the trigger holds it), retries with backoff (next event and boot are enough).

### Open decisions (for PP)
1. [P1] IP address: a) not sent (recommended): the browser cannot read its own IP; it would need a call to a third-party service, and an IP is personal data under GDPR, so the game would need a consent dialog; the random player id plus the nickname already lets you follow one player across runs. b) sent via a third-party lookup: one extra request per page load, a consent line required.
2. [P2] Who runs `supabase/progress.sql` on the live database: a) the session, through the Management API, like `errors.sql` on 2026-10-21 (recommended: the same path, verified at once by `check.sh`); b) PP pastes it into SQL Editor (CLAUDE.md: "migracja na żywej bazie zostaje przy PP").
3. [P3] Opt-out: a) no toggle, only the information line in the menu (recommended: the data has no names unless the player enters one, which the leaderboard already announces as public); b) a checkbox "Send gameplay statistics" in the settings, default on.
4. [spec silent] Zakładam: Deep purchases (shards) and Strong Arm downgrades are logged like money purchases, same `{id, lvl, cost}` shape | Dowód: `src/ui/shop.ts:224-240` is the single purchase path for both currencies and both directions | Jeśli źle: PP sees shard spends and level-downs mixed into "what he bought" at that level | Pewność: Likely | rekomendacja: a) log them, the id tells them apart.
5. [spec silent] Zakładam: a daily run over and "Reset save" each write an end row (`kind 'daily'` / `'reset'`), and daily level rows carry `daily=true` | Dowód: `src/systems/daily.ts:57`, `src/ui/menu.ts:61` are two more ends of a run besides `hole.ts:606` | Jeśli źle: runs ended by a reset or a daily would stop at their last level row with no end marker, and daily rows would read like 1-level yard runs | Pewność: Confident | rekomendacja: a) log them.

### Self-check
- Every acceptance criterion (level rows with money/gnomes/purchases, achievements, identity, privacy line, caps, offline, DEV no-send, PP's query) has a step and a test: yes (steps 2-10, tests P0-P10, check.sh, do blocks).
- Every step names a file, a signature or a value: yes; no "handle edge cases" lines.
- Fields written: `gnome-boozed-player` has one writer (`progress.ts`); the game state is read only; `holeLevel` writers (1), money writers (3), upgrade writers (3) are listed in Reach.
- Lists compared with the code: level-up writers (1 = spec), end-of-run paths (3 in code vs 1 named → rows 10, 11), purchase paths (money / shards / downgrade → rows 6, 7). Done-when lines: 21 = matrix rows: 21.
- Decisions older than 60 days: none used.
- Plan length vs code: the code is ~120 lines (`progress.ts`) + ~60 (SQL) + ~40 (check.sh) + ~150 (scenario) + ~10 hooks; the plan is of the same order, mostly matrix and tests.
