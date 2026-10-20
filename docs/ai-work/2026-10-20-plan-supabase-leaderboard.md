# Plan: shared online leaderboard on Supabase

Spec: PP (Slack, verbatim): "tak superbase ale czy to zadziala na github actions"; BOARD "Pytania do PP na rano" question 1 (option a, Supabase); brief of 2026-10-20 (plain fetch preferred, SQL file in the repo, honest cheating limits, DAILY tab, local fallback + toast, headless test with mocked fetch, step-by-step for PP).
Trivial check: a new data path (browser → Supabase REST), a swapped store behind three submit entry points, a workflow change and a SQL file; not a single-file change.

Verified against current Supabase docs (fetched 2026-10-20, `supabase.com/docs/guides/api/api-keys`, `.../platform/project-pausing`, `.../database/postgres/row-level-security`, `.../api/creating-routes`):
- The browser calls `https://<ref>.supabase.co/rest/v1/<table>` directly; the key goes in the `apikey` header. GitHub Pages only serves files, Actions only builds, so nothing server-side is needed: yes, it works on Pages.
- The key to ship is the **publishable key** (`sb_publishable_...`, "safe to expose online: web page, GitHub actions, source code"). The long `eyJ...` anon JWT is the legacy form and still works the same way. Both map to the Postgres role `anon`, which is what the RLS policies and grants bind to.
- Free plan: a project with "low activity over a 7-day period" is paused (warning e-mail one week before). While paused every request fails → the game shows the local board with a warning. PP restores it in the dashboard with "Resume project" (1-year restore window). "A few user requests to the database each day over the previous week" keeps it alive.

## Plan v0 (plan-author)

### Goal
When the Pages build has `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, every player sees and submits to one shared board (ALL-TIME and DAILY), and when the service is missing or down the game keeps working on the local board with a visible notice.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | no env vars (local dev, Pages repo without variables) | game boots | `LocalStore` as today, zero `fetch` calls | brief "without them the game falls back" |
| 2 | env set | open overlay, ALL-TIME | rows "Loading…", then `GET scores?select=…&board=eq.main&order=score.desc&limit=10` with `apikey`; top 10 shown | PP "wspólna tablica" |
| 3 | env set | click DAILY tab | same GET with `board=eq.daily-<UTC date>` | brief "DAILY tab query" |
| 4 | env set, pause-menu overlay | SUBMIT valid names | `LocalStore.submit` then `POST scores` body `{first_name,last_name,score,level,board}` (no `id`, no `created_at`); msg "Score saved."; list re-fetched | SPEC.md:211 |
| 5 | env set, rebirth offer (`player.ts:477`) | SUBMIT | POST, overlay closes, rebirth runs once; on POST failure a HUD toast (bad) "Could not reach the online board: score saved on this computer only." | SPEC.md:211 "przy odrodzeniu" |
| 6 | env set, daily over (`daily.ts:57`) | SUBMIT | POST with `board: 'daily-<date>'`, then back to the yard | `spec silent` (SPEC names pause menu + rebirth only) |
| 7 | env set, service down (network error, HTTP 5xx, paused project, 6 s timeout) | open overlay | `.lb-msg` warning "Online board unreachable: showing scores saved on this computer." + local rows; no exception | brief "never break the game" |
| 8 | env set, POST rejected (4xx from a check constraint or flood guard, 5xx, offline) | SUBMIT in overlay | local row kept, `.lb-msg` warning, overlay stays open | brief "offline/error behaviour" |
| 9 | env set | click ALL-TIME then DAILY before the first GET returns | rows of the last clicked tab (stale response ignored) | derived from 2/3 |
| 10 | env set, a row with a missing/odd field comes back | render | row dropped by `isEntry`, others shown | existing rule (leaderboard.ts:28) |
| 11 | env set, invalid name | SUBMIT | rejected client-side as today, zero `fetch` calls | leaderboard.ts:66 |
| 12 | anyone with the key, hand-made POST: 30-char name, score -1, board `x`, or an `id` | POST | HTTP 4xx, no row | brief "column checks" |
| 13 | anyone with the key | PATCH / DELETE a row | HTTP 4xx, row unchanged | brief "insert + select only" |
| 14 | `?daily=2099-01-01` (any date in `YYYY-MM-DD`) | SUBMIT | accepted on board `daily-2099-01-01` (regex only, no "today" check) | `spec silent` |
| 15 | same run submitted twice | SUBMIT twice | two rows online, as locally | `spec silent` (leaderboard note: "Rejected: limit of one submission per run") |
| 16 | local entries from before this change | open overlay online | not uploaded; online board shows only scores sent after the change; local ones visible only in the offline fallback | `spec silent` |
| 17 | repo variables missing | Actions build | build passes, bundle has no `supabase.co`, local board | brief |
| 18 | repo variables set | Actions build | bundle contains the URL and key (public by design) | brief |

### Reach
- `src/ui/leaderboard.ts:22` `LeaderboardStore`: implemented by `LocalStore:34`; consumed by `Leaderboard.render:222` (`list`) and `Leaderboard.send:212` (`submit`). Constructor default `new LocalStore()` at `:99`; the only `new Leaderboard()` is `src/main.ts:117` (no argument), so the store choice can stay inside `leaderboard.ts` and `main.ts` needs no edit.
- Submit entry points (all go through `send()`): pause-menu button `leaderboard.ts:167` → `open()`; rebirth `src/player/player.ts:477` → `offer(done)` (board = `HOME`); daily end `src/systems/daily.ts:57` → `offer(done, daily.board, title)`. `done` runs in `close()`; a failed POST must not stop it.
- `Entry.board` writers: `send()` only (`this.board`, set by `show()` from `HOME` or the daily board). Readers: `LocalStore.list/submit`, `render()` tabs. Board values in code: `'main'` and `` `daily-${date}` `` with `date` = `YYYY-MM-DD` from the URL or today UTC (`daily.ts:45`).
- Score fields: `state.totalEarned` (`src/core/state.ts:20`, JS number, can exceed 2^31: the existing test stored 5e9), `state.holeLevel` (`:22`, 1..`MAX_HOLE_LEVEL`).
- Env reads in the repo: `import.meta.env.DEV` (`main.ts:195`), `BASE_URL` (`crash.ts:15`, `textures.ts:12`, `shot.ts:36`); `tsconfig` has `types: ["vite/client"]`, so `import.meta.env.VITE_*` type-checks without a new `.d.ts`.
- Front contract: none beyond this module; the response shape from PostgREST is mapped to `Entry` inside `RemoteStore`.
- Toast: `ctx.hud.toast(text, 'bad')` (`src/ui/hud.ts:227`); `.hud-left` z-index 35 vs `.leaderboard` z-index 60, so a toast is only readable after the overlay closes → used only on the `offer()` path (row 5); the open overlay uses `.lb-msg`.
- `.gitignore` has no `.env*` line; a local `.env.local` with PP's real URL/key would be committed. Add it.

### Data
- Remote table `public.scores` (new): `id identity`, `first_name text`, `last_name text`, `score double precision`, `level smallint`, `board text default 'main'`, `created_at timestamptz default now()`. Index `(board, score desc)`: the only read is "top 10 of one board" → index scan, 10 rows. Flood guard (open decision 1) adds an index on `created_at`.
- Query shapes: `GET /rest/v1/scores?select=first_name,last_name,score,level,board,created_at&board=eq.<board>&order=score.desc&limit=10` (≈1 KB); `POST /rest/v1/scores` with `Prefer: return=minimal` (204, no body).
- Volume: local board today ≤ 50 rows per board, 8 boards max (`KEEP`, `DAILY_BOARDS`). Online: PP and friends; assume < 10k rows/year, < 1 MB. Cost per overlay open: 1 GET; per submit: 1 POST + 1 GET; per tab click: 1 GET. Free plan 500 MB DB / 5 GB egress: 1 KB × 1,000,000 opens = 1 GB, far from the limit.
- Pause risk (verified): 7 days without "a few requests a day" → paused → rows 7/8 behaviour until PP clicks "Resume project".

### Steps (edit order)
1. `supabase/leaderboard.sql` (new; PP pastes it into SQL Editor once):
   ```sql
   create table public.scores (
     id bigint generated always as identity primary key,
     first_name text not null check (char_length(first_name) between 1 and 24 and btrim(first_name) <> '' and first_name !~ '[<>[:cntrl:]]'),
     last_name  text not null check (char_length(last_name)  between 1 and 24 and btrim(last_name)  <> '' and last_name  !~ '[<>[:cntrl:]]'),
     score double precision not null check (score >= 0 and score < 1e18),
     level smallint not null check (level between 1 and 99),
     board text not null default 'main' check (board ~ '^(main|daily-\d{4}-\d{2}-\d{2})$'),
     created_at timestamptz not null default now()
   );
   create index scores_board_score on public.scores (board, score desc);
   alter table public.scores enable row level security;
   revoke all on table public.scores from anon, authenticated;
   grant select (first_name, last_name, score, level, board, created_at), insert (first_name, last_name, score, level, board) on public.scores to anon;
   create policy "anyone can read scores" on public.scores for select to anon using (true);
   create policy "anyone can add a score" on public.scores for insert to anon with check (true);
   ```
   Column-level grants are what make row 12 (`id` in the body) and row 13 (no update/delete grant, no policy) fail. Charset is not checked in SQL (Postgres has no `\p{L}`; `[[:alpha:]]` depends on the DB locale); the UI validates it and renders with `textContent`, so a hand-made name is harmless. If open decision 1 = b, append the 9-line trigger from that item.
2. `src/ui/leaderboard.ts`:
   - `LeaderboardStore` gets `readonly warning?: string | null;` (set by the remote store after each call; `LocalStore` leaves it undefined).
   - `export class RemoteStore implements LeaderboardStore` (next to `LocalStore`, ~40 lines): `constructor(private url: string, private key: string)`, `private local = new LocalStore()`, `warning: string | null = null`. `private async call(path: string, init: RequestInit = {}): Promise<Response>` → `fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, 'Content-Type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(6000) })`, throws on `!r.ok`. `list(board = 'main')`: GET as in Data, map rows `{first_name,last_name,score,level,board,created_at}` → `Entry` (`at: Date.parse(created_at)`), filter `isEntry`, `warning = null`; on any error `warning = 'Online board unreachable: showing scores saved on this computer.'` and `return this.local.list(board)`. `submit(e)`: `await this.local.submit(e)` first, then POST `{ first_name: e.first, last_name: e.last, score: e.score, level: e.level, board: e.board ?? 'main' }` with `Prefer: return=minimal`; on error `warning = 'Could not reach the online board: score saved on this computer only.'`, else `warning = null`. Never rethrows.
   - `export function pickStore(): LeaderboardStore`: `const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env; return url && key ? new RemoteStore(String(url).replace(/\/$/, ''), String(key)) : new LocalStore();`. Constructor default becomes `store: LeaderboardStore = pickStore()`.
   - `render()`: `const n = ++this.renderN;` before the await, `this.rows.textContent = 'Loading…'` for the remote case (one line, harmless for local), after the await `if (n !== this.renderN) return;` (row 9); after rendering rows, `if (this.store.warning) { this.msg.classList.remove('ok'); this.msg.textContent = this.store.warning; }` (rows 7/8).
   - `send()`: after `await this.store.submit(...)`: `const w = this.store.warning; if (this.done) { if (w) ctx.hud.toast(w, 'bad'); return this.close(); }` (row 5); the "Score saved." line stays and `render()` overwrites it with the warning when there is one (row 8). `ctx.audio.buy()` only when `!w`, else `ctx.audio.deny()`.
   - Also `Entry.at` doc comment: "Date.now() locally, created_at online".
3. `.github/workflows/deploy.yml`, under `- run: npm run build` → `env:` add `VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}` and `VITE_SUPABASE_KEY: ${{ vars.VITE_SUPABASE_KEY }}` (repository variables; missing → empty string → `pickStore()` picks local).
4. `.gitignore`: add `.env.local` (Vite reads it for local tests with a real project; it must never be committed).
5. Docs: `README.md` section "Online leaderboard (Supabase)" with the PP steps below; `docs/SPEC.md:211` replace "Tylko lokalnie." with "Wspólna tablica online (Supabase) gdy build ma `VITE_SUPABASE_URL` i `VITE_SUPABASE_KEY`; bez nich albo gdy serwis nie odpowiada, tablica lokalna z komunikatem."; `CHANGELOG.md` entry; this note's "Work progress"; BOARD.md line 213 mirrors SPEC (local file).
6. Headless scenario `smoke/scenario-remote-lb.js` (scratchpad, dev server 5199): stubs `window.fetch` with a recorder (`calls[]`, scripted responses), builds `new RemoteStore('https://example.supabase.co', 'sb_publishable_test')` from the app's module URL (trick from `2026-10-20-daily.md`), swaps it in with `Object.assign(g.leaderboard, { store })`, then runs the tests below. Keep it in the scratchpad; copy to `tools/smoke/` only if it becomes permanent (CLAUDE.md).

PP steps (go to README in English; the handback has them in Polish):
1. supabase.com → New project (name `gnome-boozed`, region Frankfurt, any strong DB password; the game never uses it).
2. SQL Editor → paste `supabase/leaderboard.sql` → Run (once).
3. Settings → API Keys: copy **Project URL** and the **publishable** key (`sb_publishable_...`); the legacy anon `eyJ...` key also works.
4. GitHub repo → Settings → Secrets and variables → Actions → **Variables** tab → New repository variable: `VITE_SUPABASE_URL` = Project URL, `VITE_SUPABASE_KEY` = publishable key.
5. Actions → "Deploy to GitHub Pages" → Run workflow (or push to `main`). Open the game, pause, Leaderboard → "No scores yet." without the warning line = online.
6. Keep it alive: play once a week, or the Free project pauses after 7 quiet days (dashboard → Resume project).

### Tests
Scenario `scenario-remote-lb.js` (one run, `CDP_PORT=93xx MAXPOLL=2400 node smoke.mjs run-remote-lb scenario-remote-lb.js`), each step prints a one-line result:
- R1 (row 1): on boot `g.leaderboard.store.constructor.name === 'LocalStore'`, open overlay, `calls.length === 0`.
- R2 (rows 2, 10): fetch → 200 `[3 rows, one without score]`; `open()` → first frame rows text "Loading…", then 2 rows in score order; `calls[0].url` ends with `board=eq.main&order=score.desc&limit=10`, `calls[0].headers.apikey === 'sb_publishable_test'`, method GET.
- R3 (row 3): click DAILY → `calls[1].url` contains `board=eq.daily-<today UTC>`.
- R4 (rows 4, 11): type `<b>` → `calls` unchanged; type valid names, submit → `calls[n].method === 'POST'`, body keys exactly `first_name,last_name,score,level,board`, `board === 'main'`, `Prefer: return=minimal`; `localStorage` has the row; `.lb-msg` "Score saved." then GET again.
- R5 (row 5): POST → 500; `offer(done)`, submit → `done` called once, overlay hidden, `.toast.bad` text contains "this computer only".
- R6 (row 6): page load with `URL_QUERY='?daily=2026-10-20'`, `daily.left = 0.1`, 5 frames, submit → POST body `board === 'daily-2026-10-20'`.
- R7 (row 7): fetch rejects (`TypeError`) → `.lb-msg` "Online board unreachable…", rows = local rows, `LOGS` empty. Then fetch that only rejects on `signal` abort → warning appears after ~6 s, never "Loading…" forever.
- R8 (row 8): POST → 400 → overlay open, local row present, `.lb-msg` "Could not reach the online board…".
- R9 (row 9): two pending GETs, resolve the ALL-TIME one after the DAILY one → rows show the DAILY payload.
- Rows 12-13: curl against PP's project after his step 2 (the only non-local lines; until then `[PENDING-PP]`, see Done when).
- Rows 14-16: covered by R6 with `?daily=2099-01-01`, R4 run twice (2 POSTs), and R7 (old local rows appear only in the fallback).
- Rows 17-18: two local Vite builds (see Done when) + YAML parse of `deploy.yml` as in `2026-10-20-leaderboard-pages.md`.
- `npx tsc --noEmit` clean; the existing `scenario-leaderboard-app.js` still 8/8 (local store path untouched).

### Done when
1. `run-remote-lb` R1 → `store LocalStore, calls 0`
2. R2 → `loading true, shown 2, url …board=eq.main&order=score.desc&limit=10, apikey true, method GET`
3. R3 → `url contains board=eq.daily-<today>`
4. R4 → `post true, keys first_name,last_name,score,level,board, board main, prefer return=minimal, localRows +1, msg "Score saved."`
5. R5 → `done 1, hidden true, toast contains "this computer only"`
6. R6 → `post board daily-2026-10-20`
7. R7 → `msg "Online board unreachable…", rows = local, LOGS empty; timeout warning after ≤ 7 s`
8. R8 → `open true, localRows +1, msg "Could not reach the online board…"`
9. R9 → `rows from last clicked tab (DAILY)`
10. R2 → `malformed row dropped (3 in, 2 shown)`
11. R4 → `invalid name: calls unchanged`
12. `[PENDING-PP until step 2]` `curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/rest/v1/scores" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"first_name":"x","last_name":"y","score":-1,"level":1}'` → `4xx` (also with a 30-char name, `"board":"x"`, `"id":1`)
13. `[PENDING-PP until step 2]` `curl … -X DELETE "$URL/rest/v1/scores?id=eq.1" -H "apikey: $KEY"` and `-X PATCH … -d '{"score":1}'` → `4xx`; GET afterwards still returns the row
14. R6 with `?daily=2099-01-01` → `post board daily-2099-01-01`
15. R4 run twice → `POST count 2`
16. R7 → `fallback rows include the pre-existing local row; R2 rows do not`
17. `npx vite build --outDir <scratchpad>/noenv-dist --emptyOutDir && rg -l "supabase.co" <scratchpad>/noenv-dist/assets` → no file
18. `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_KEY=sb_publishable_test npx vite build --outDir <scratchpad>/env-dist --emptyOutDir && rg -l "example.supabase.co" <scratchpad>/env-dist/assets` → one `index-*.js`; `rg -c "vars.VITE_SUPABASE" .github/workflows/deploy.yml` → `2`

### Assumptions (numbered)
1. Plain `fetch` + two headers is the whole client (~40 lines); `@supabase/supabase-js` would be a new dependency for the same two requests.
2. Variable name `VITE_SUPABASE_KEY` (not `…_ANON_KEY`): the current key is the publishable key; the legacy anon JWT is accepted in the same header, so either value works.
3. Online, the overlay shows only the shared board; the local board stays on disk and is shown only in the fallback (row 16). Merging the two lists would show a player's own local rows as if they were global.
4. `AbortSignal.timeout(6000)`: a hung request must not leave "Loading…" forever; 6 s is longer than any normal Supabase reply.
5. Cheating, stated honestly: the key is in the bundle, so anyone can POST any score within the checks (0 ≤ score < 1e18, level 1-99, names 1-24 chars) under any name, any number of times, and can read the whole table (names included; that is what a public board is). The key cannot change or delete rows. Cleanup is PP in the dashboard (Table Editor → delete row). No per-player or per-IP limit exists without a server (Edge Function / Worker); the optional flood guard (open decision 1) only caps the whole board at 30 inserts per minute.
6. All submit paths keep writing locally first, so a player never loses a score to a network error.
7. `vars.*` in Actions: repository variables are plain text (right for a public key); a secret would work too but would be masked in logs for no gain.

### Alternatives rejected
- (a) `@supabase/supabase-js`: new dependency (~100 KB) for one GET and one POST; rejected (ladder rung 3 wins).
- (b) Cloudflare Worker / Edge Function with per-IP rate limit and score plausibility checks: real anti-cheat, but a second service and PP chose Supabase; rejected for now, named in Assumption 5.
- (c) Uploading the existing local scores on first online boot: they are unverifiable and would duplicate on every device; rejected (row 16).
- (d) One submission per run: the leaderboard note already rejected it locally; keeping parity (row 15).
- (e) Reading env at runtime (a `config.json` on Pages): would avoid a rebuild when keys change, but adds a request per boot and a file to keep in sync; build-time env is what the brief asks.

### Ladder
- `supabase/leaderboard.sql` (rung 6): brief "SQL migration file for the table + RLS policies + check constraints in the repo".
- `RemoteStore` in the existing file (rung 6, ~40 lines): PP "superbase"; the interface at `leaderboard.ts:22` was built as the swap point.
- `fetch`, `AbortSignal.timeout` (rung 3, platform): brief "prefer no new dependency"; "never break the game".
- `warning` field + 3 lines in `render()`/`send()` (rung 6): brief "local board + toast".
- `renderN` counter (rung 5, two lines): row 9; without it a slow ALL-TIME reply overwrites the DAILY tab.
- Two `env:` lines in `deploy.yml` (rung 2, same block as `VITE_BASE`): brief "build-time env from GitHub Actions repository variables".
- `.env.local` in `.gitignore` (rung 5): brief "never put real keys anywhere".
- Not added (rung 1): retries, caching, pagination, name uniqueness, score signing, per-IP limit, supabase-js, a new `.d.ts` for env types.

### Open decisions (for PP)
1. **Pytanie do PP (po polsku):** Czy dodać prostą blokadę zalewu wyników? a) bez blokady: wtedy ktoś ze skryptem może wgrać tysiące wpisów i zapchać darmowy limit bazy, a Ty kasujesz je ręcznie w panelu. b) blokada 30 wpisów na minutę dla całej tablicy (9 linii SQL, zero zmian w grze): wtedy skrypt dostaje błąd po 30 wpisach, a uczciwy gracz w tym czasie widzi „zapisano tylko na tym komputerze"; żadna opcja nie zatrzyma jednego fałszywego wyniku. Rekomendacja: b). SQL for b): `create function public.scores_flood_guard() returns trigger language plpgsql as $$ begin if (select count(*) from public.scores where created_at > now() - interval '1 minute') >= 30 then raise exception 'too many scores right now, try again in a minute'; end if; return new; end $$; create trigger scores_flood_guard before insert on public.scores for each row execute function public.scores_flood_guard(); create index scores_created_at on public.scores (created_at);` (then Done-when 12 also covers it: the 31st POST within a minute → 4xx).
2. **Pytanie do PP (po polsku):** Tablice dzienne pod dowolną datą. Gra przyjmuje `?daily=RRRR-MM-DD` z każdą datą, więc ktoś może wysłać wynik na jutrzejszą albo zeszłoroczną tablicę. a) przyjmujemy każdą datę (jak dziś lokalnie, zero dodatkowego kodu): wtedy zakładka DAILY pokazuje tylko dzisiejszą, a cudze wpisy na inne daty nikomu nie przeszkadzają. b) tylko dzisiejsza data UTC (jeden warunek w bazie): wtedy gracz, który zacznie daily tuż przed północą UTC i skończy po niej, dostanie „zapisano tylko na tym komputerze". Rekomendacja: a). [spec silent] Zakładam: a) | Dowód: `src/systems/daily.ts:45` accepts any `YYYY-MM-DD`; the SQL check mirrors it | Jeśli źle: a score can land on a board nobody opens | Pewność: Likely.
3. [spec silent, assumed, no question] Zakładam: the daily-over submit (`src/systems/daily.ts:57`) goes online to `daily-<date>` like the two named paths | Dowód: it calls the same `offer()` → `send()` → `store.submit` | Jeśli źle: daily scores would stay local only | Pewność: Confident | rekomendacja: a) handle it like the named paths.
4. [spec silent, assumed, no question] Zakładam: the same run may be submitted twice online (two rows) | Dowód: `2026-10-20-leaderboard-pages.md` "Rejected: limit of one submission per run" (today's decision, not older than 60 days) | Jeśli źle: PP sees duplicate rows from one player | Pewność: Confident | rekomendacja: a) keep parity.
5. [spec silent, assumed, no question] Zakładam: pre-existing local scores are not uploaded | Dowód: `LocalStore` rows have no server id; `RemoteStore.list` reads only the server | Jeśli źle: PP expects his own old scores on the shared board and sees "No scores yet." | Pewność: Likely | rekomendacja: a) not uploaded, PP re-submits a run.
6. [decision age] none: every decision this plan relies on is dated 2026-10-20.

### Self-check
- Every acceptance criterion from the brief has a step and a test: works on Pages (steps 3, Done 17-18), no new dependency (step 2, Assumption 1), SQL file (step 1, Done 12-13), honest cheating limits (Assumption 5), DAILY query (row 3, Done 3), offline/error (rows 7-8, Done 7-8), mocked-fetch headless test (step 6), PP steps (step 5).
- Each step names the file, the signature or the exact value; the SQL is complete.
- `Entry.board` and the store: all writers (`send()`) and readers (`LocalStore`, `RemoteStore`, `render()`) listed in Reach; the three submit entry points listed.
- Lists compared with code: tabs (2 named, 2 kinds in code: 0 silent); submit paths (SPEC names 2, code has 3: 1 silent = row 6); boards accept any date (row 14). `spec silent` rows: 4 (6, 14, 15, 16). Done when: 18 lines = 18 matrix rows.
- Decisions older than 60 days: none (all ai-work files are from 2026-10-19/20).
- Plan length vs code: the code is ~40 lines TS + ~15 lines SQL + 2 YAML lines; this plan is longer because the matrix, the verified Supabase facts and the PP steps are the deliverable; the step text itself is shorter than the code it describes.

## Review: performance (plan-performance)

Verdict: CONCERNS

| plan step | operation | shape / index | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 2 `list` | `GET scores?board=eq.X&order=score.desc&limit=10` | `scores_board_score (board, score desc)`: equality + order + limit match the index exactly (PostgREST `score.desc` = `DESC NULLS FIRST`, same as the index default; `score` is `not null` anyway) | 1 per overlay open (`show()`), 1 per tab click, 1 after each submit; never in the game loop (only `isOpen` is read per frame, `main.ts:120`) | table empty today; plan assumes < 10k rows/year; prod: not measured | 10 index entries, ~1 KB response | none |
| 2 `submit` | `POST scores`, `Prefer: return=minimal` | insert + 1 index write (+1 with guard) | 1 per SUBMIT click; no in-flight guard in `send()` (`leaderboard.ts:203`) | n/a | 1 round trip, 100 ms to 6 s | Medium (finding 1) |
| 2 `offer()` path | `await store.submit` before `close()` → `done()` | n/a | 1 per rebirth / daily end | n/a | rebirth or yard redirect waits for the POST: up to 6 s on a hung connection | Low (finding 2) |
| Open decision 1 (b) | trigger `count(*) where created_at > now() - 1 min` | `scores_created_at`: range scan, at most ~30 rows by construction | 1 per insert | ≤ 30 rows in window | trivial | none |
| 5 / PP step 6 | keep-alive | n/a | requests happen only on overlay open / submit; boot and play send 0 | n/a | "play once a week" does not prevent the pause | Low (finding 3) |
| 1 | storage under flood, decision 1 (a) vs (b) | ~120-150 B per row incl. PK and board index (estimated) | unbounded (a) / 43,200 rows/day (b) | 500 MB Free | (a) a script at 100 inserts/s fills 500 MB in ~10 h; (b) the same script needs ~80 days of non-stop flooding | supports rec. (b), no finding |

Findings:
- [Medium] Double submit while the POST is pending: when a player clicks SUBMIT (or presses Enter) twice while the online POST is still running, then two local rows and two online rows appear and the overlay re-renders twice, because `send()` has no busy flag and the online POST now takes 100 ms to 6 s instead of ~0 ms locally. With the flood guard this also eats 2 of the 30 inserts per minute shared by everyone. Fix: disable the SUBMIT button (or a `sending` flag that returns early) from the name check until `submit` resolves, and show "Sending…" in `.lb-msg`; add one step to R4 (two clicks before the POST resolves → `POST count 1`). Row 15 (two deliberate submits) stays valid. Measured: no (estimated from `leaderboard.ts:203-218`).
- [Low] Rebirth and daily end wait for the network: when the connection hangs, then the rebirth (`player.ts:477`) or the redirect to the yard (`daily.ts:57`) starts only after the 6 s timeout, with no visible feedback, because `send()` awaits `store.submit` before `close()`. Fix: the same "Sending…" text from finding 1 covers it; keep the await for the daily path (the redirect would abort the fetch), and keep 6 s. Measured: no (timeout value from the plan).
- [Low] Keep-alive advice is wrong for this design: when PP "plays once a week" without opening the leaderboard, then the project still pauses after 7 days, because the plan sends zero requests on boot and during play; only an overlay open or a submit reaches Supabase. Fix: README / PP step 6 text "open the Leaderboard once a week (one page load of the board is enough)", no code change; a boot-time GET is not justified (it would add 1 request per player per session only to fight the pause). Measured: yes (code read: the only `store` calls are `render()` and `send()`, no caller outside `leaderboard.ts`).

No findings on: top-10 read shape and index (exact match, 10 rows), DAILY tab query (same index), payload (~1 KB per GET, 204 empty on POST), tab-click spam (no request quota on Free, stale replies dropped by `renderN`), 6 s `AbortSignal.timeout` with no retries, no work in the game loop, egress (5 GB vs ~1 KB per open), unbounded daily boards online (reads stay index scans), flood-guard trigger cost, Actions build (two env lines, zero runtime cost).

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [High] The new `warning` field has two writers (`list` and `submit`) and the plan reads it after both, so the second write wins. When a POST is rejected (row 8, e.g. HTTP 400 from a check) and the re-fetch GET in `send()` (`leaderboard.ts:217` → `render()`) succeeds, then `list` sets `warning = null`, `render()` shows nothing and `.lb-msg` keeps the green "Score saved.", because the plan writes "Score saved." before `render()` and only `render()` shows the warning. Row 8 and Done-when 8 fail as written; R8 only passes if the stub also fails the GET. Fix: in `send()` keep `const w = this.store.warning` right after `submit` and write `.lb-msg` from `w` after `render()` (or have `submit` return the warning instead of a shared field); add to R8 "GET 200 after POST 400 → msg still the warning".
- [Medium] Close paths during the pending POST: `[data-close]` (✕ and SKIP, `leaderboard.ts:132`) and Esc (`:149`) still call `close()` while `send()` awaits up to 6 s. On the daily path (`daily.ts:57`), when the player presses Esc or SKIP after SUBMIT, then `done` sets `location.href` and the page unload aborts the POST, so the score stays local only with no message. On the rebirth path (`player.ts:477`), `done` runs the rebirth, then `send()` resumes with `this.done === null` and takes the overlay branch: no toast, `render()` runs on a hidden overlay. Today this window does not exist (`LocalStore.submit` is synchronous inside a Promise). Fix: the busy flag from plan-performance finding 1 must also make `close()` a no-op while sending (or `send()` captures `done` before the await and decides from the captured value); add to R5 "Esc during a pending POST → done not called until the POST settles".
- [Medium] `.env.local` (step 4) is read by every local Vite run in this folder, not only PP's manual check: the agents' dev server on 5199 and PP's playtest build (`npx vite build --outDir release`, CLAUDE.md "Run"). When `.env.local` exists, then `scenario-daily.js` (scratchpad `smoke/scenario-daily.js:110-137`, 55+ `lb.store.submit` calls, asserts 50 kept and 7 daily boards) and `scenario-leaderboard-app.js` (`:33`, 12 submits) POST test rows to PP's real board, and their assertions fail because `list` now returns at most 10 server rows with no pruning. The plan's regression line names only `scenario-leaderboard-app.js` 8/8. Fix: README tells PP to delete `.env.local` after the manual check (or name it `.env.production.local`, which `vite build` reads and the dev server does not); add `scenario-daily.js` to the "still passes" line and assert `store LocalStore` at its start.
- [Low] `docs/SPEC.md:212` (Daily challenge: "własna lista wyników (7 dni trzymane)") also becomes false online (server keeps every daily board); step 5 edits only `:211`. Fix: one clause on line 212, "online: wszystkie dni".
- [Low] Score check `score < 1e18` vs the game's own range: `money()` (`src/core/format.ts:1`) formats up to the `dc` suffix (1e33), and nothing caps `state.totalEarned` (`hole.ts:80`). When a long run passes 1e18, then every POST of that player returns 4xx and they see "saved on this computer only" forever. Fix: confirm the late-game ceiling in `docs/PLAN.md` balance tables, or drop the upper bound to `score < 1e300` (still blocks Infinity/NaN, which `double precision` would otherwise accept as `'Infinity'`).
- [Low] `CHANGELOG.md` is bundled into the game (`src/ui/menu.ts:7`, `?raw`; `latestBuild` = first `## ` heading, shown in the title menu "What's new"). Step 5's entry is player-visible: it must follow the existing heading format and say what to test, and must not contain the project URL or key.

Neighbours checked: draft/live: not affected (no draft concept in this game) | profiles/LEVEL 2/3: not affected (no accounts) | serve-cache: not affected (no cache added; plan rejects caching) | polling/imports: not affected (old local rows are not uploaded, row 16) | find_best/cohorts: not affected (none in this repo) | dimensions/formulas: not affected | text index/search: not affected | prompt context: not affected | widget/serving: affected, the Pages bundle now carries the URL and key (rows 17-18, public by design) | daily (`?daily`): affected, covered by row 6 and finding 2 above | rebirth (`player.ts:477`, `hole.rebirth`): affected, finding 2 | pause menu (`addMenuButton`, `leaderboard.ts:160`): not affected | key capture (`leaderboard.ts:144`): not affected, typing still swallowed | crash report (`crash.ts:55-59`): not affected, `RemoteStore` never rethrows and `render()`/`send()` are `void`-called with all fetch errors caught; network failures do not reach `unhandledrejection` | shot.ts: not affected (own `fetch` to `__shots`; the test stub replaces `window.fetch` globally, harmless while R-scenarios do not press P) | CSP: none in `index.html` or `vite.config.ts`, nothing blocks `*.supabase.co` | vite env typing: not affected, `tsconfig` `types: ["vite/client"]` covers `VITE_*` | `.gitignore`: affected, step 4 (see finding 3) | deploy.yml: affected, step 3; empty `vars.*` → `''` → `pickStore()` local, consistent with row 17.
FE/BE: PostgREST row `{first_name,last_name,score,level,board,created_at}` → mapped to `Entry` only inside `RemoteStore.list`; the only readers of `Entry` are `render()` (`leaderboard.ts:231`: `first`, `last`, `score`, `level`, `at`) and `isEntry` (`:28`), all five fields produced by the mapping → match.
Decisions: consistent with `docs/ai-work/2026-10-20-leaderboard-pages.md` ("Rejected: a remote store (Supabase / Cloudflare): PP's decision, question 1 in BOARD"; "the interface is the swap point"; "limit of one submission per run: not asked" → row 15) | consistent with `docs/ai-work/2026-10-20-daily.md` (board name `daily-<date>`, any `YYYY-MM-DD` accepted, row 14) | consistent with `docs/ai-work/2026-10-20-crash-report.md` (a failed send must never become a reported error).
Decisions older than 60 days: none (every note in `docs/ai-work` is dated 2026-10-19 or 2026-10-20).
Regression vs current behaviour: none for the local path (`LocalStore` untouched, pruning to 50 rows / 7 daily boards still runs on every submit); online, the closing window during a pending submit is new (finding 2).

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: The plan keeps the game static: the browser talks to Supabase REST directly, so GitHub Pages and Actions only build and serve, which answers PP's question with "yes". Security lives in the database, not in the bundle: RLS on, `revoke all`, column grants for select and insert only, and check constraints on every column. The local store stays the source of truth on every path, so the network can only add a score, never lose one.
Strengths: no new dependency; `revoke all` also removes the TRUNCATE/UPDATE/DELETE that Supabase grants `anon` by default; `id` and `created_at` cannot be forged (identity "always" + no column grant); every fetch error is caught and degrades to the local board with a message; `AbortSignal.timeout` stops an endless "Loading…"; the stale-tab counter (row 9); rendering stays `textContent`, so a hand-made name cannot inject HTML; the cheating limits are written down honestly (Assumption 5).

Already raised by the other reviews, confirmed by me in `leaderboard.ts` (I do not repeat them): the shared `warning` field is overwritten by the GET (plan-impact High; I would grade it Major, because row 8 cannot work as written); the double SUBMIT while the POST is pending (plan-performance finding 1); close/Esc during a pending POST (plan-impact Medium); `score < 1e18` vs uncapped `totalEarned` (plan-impact Low); `.env.local` read by the agents' dev server (plan-impact Medium).

Scenarios checked explicitly:
- State changes during the step (tab click while the GET is pending): breaks plan: no, because `renderN` drops the stale reply (row 9).
- Step N fails after step N-1 succeeded (local write ok, POST fails): breaks plan: no, the score stays local and is never retried; the player gets a message; accepted by Assumption 6. The message is wrong when the GET succeeds (plan-impact High).
- Same event twice (double click, Enter held): breaks plan: yes, two online rows (plan-performance finding 1).
- Process dies mid-way (tab closed or `location.href` during the POST): breaks plan: no data damage, the score stays local only (plan-impact Medium).
- Empty or edge state (empty table, project paused, offline): breaks plan: no; "No scores yet." or the local fallback.
- Error swallowed lower down: breaks plan: no. `RemoteStore` swallows every error on purpose, and nothing above it expects a throw.
- Old client after deploy: breaks plan: no. Pages serves one bundle, and an old cached tab keeps using `LocalStore`.
- Bulk insert (one POST with a JSON array of rows): breaks plan: no for the checks, because they run per row. The plan does not test it (Minor below).

Findings:
- [Major] The wrong key in the bundle opens the whole database.
  Assumption: PP copies the publishable key in PP step 3.
  Scenario: PP opens Settings → API Keys and switches to the "Legacy API keys" tab, because the plan says "the legacy anon `eyJ...` key also works" (plan lines 8, 89, Assumption 2). There, `anon` and `service_role` sit next to each other and both start with `eyJ`. PP pastes `service_role` into `VITE_SUPABASE_KEY`. `pickStore()` accepts any non-empty string, and the next Pages build embeds that key in `index-*.js`.
  Checked: plan step 2 `pickStore()` (`url && key ? new RemoteStore(...)`), plan line 89. The repo has no key-shape check anywhere (`leaderboard.ts` has no env read today). `service_role` skips RLS and every grant: that is how Supabase defines it, and the same docs page the plan cites says so. I did not test this against a live project.
  Impact: anyone who opens the page can delete or overwrite every score and use the Auth admin API. Rotating the key needs the JWT secret changed, and the old bundle stays in browser caches and in Pages artifacts.
  Recommendation: in `pickStore()`, accept a key only when it starts with `sb_publishable_`, or when it is a JWT whose decoded payload has `role === 'anon'`. Otherwise use `LocalStore` plus one `console.warn`. Add the same check as a failing step in `deploy.yml`, so the wrong key never reaches Pages. Drop "the legacy anon key also works" from the PP steps, so PP never opens the tab with `service_role`. Add one R1 variant with a fake `service_role`-shaped JWT → `store LocalStore`.
- [Major] Open decision 1 (b) is described to PP more mildly than it behaves.
  Assumption: the guard only slows a script down for a minute.
  Scenario: a script sends 30 inserts at the start of every minute, and keeps doing it. The trigger counts all rows from the last minute, for the whole table. Every honest POST in that minute gets "too many scores", so honest players never reach the online board again until PP stops the script, while the script still adds 43,200 rows a day. Parallel inserts can also go past 30, because each transaction counts without seeing the other's uncommitted rows. That only matters for the exact cap.
  Checked: trigger SQL in Open decision 1 (`count(*) ... where created_at > now() - interval '1 minute'`, no `board` or name filter); option (b) text: "skrypt dostaje błąd po 30 wpisach, a uczciwy gracz w tym czasie widzi…".
  Impact: PP picks (b) believing it protects the board. In fact (b) turns a flood into a lock-out of all players, which is easier to cause and lasts until PP intervenes.
  Recommendation: rewrite option (b) for PP: "b) the cap stops the database filling up (at most 43,200 rows a day instead of millions), but someone who sends 30 entries a minute non-stop blocks saving for all players until you delete his rows and change the key". The recommendation can stay (b): a full database is worse than a closed board, because a full Free database goes read-only.
- [Minor] Names go public with no notice, and autofill fills in real names. Today the form asks for first and last name with `autocomplete="given-name"`/`"family-name"` (`leaderboard.ts:112-113`), so the browser offers the player's real name. Online, that name is visible to anyone with the key, with a date, and the player cannot delete it. First + last name is PP's settled spec (`2026-10-20-leaderboard-pages.md` line 3), so I do not reopen it. The change from "this computer" to "the whole internet" is new, though, and the form never says so. Question for PP below.
- [Minor] `.gitignore` gets only `.env.local`. When PP puts the variables into `.env` or `.env.production` (Vite reads both, and many tutorials use `.env`), the file gets committed. That is harmless for the publishable key, but it puts the `service_role` key into the repo for good after the Major above. Use `.env*` plus `!.env.example`.
- [Minor] Done-when 12-13 test single-row POSTs only. Add one JSON-array POST with a bad row in the middle (expect 4xx and zero rows from that request). Add `GET ?select=id` (expect 4xx, because `id` has no grant), `GET ?select=*` (expect 4xx for the same reason; this proves the client must always send explicit columns), and a `DELETE` without a filter. The SQL is the only real security in this design, and the mocked-fetch scenario never reaches it.
- [Minor] Rows 12-13 stay `[PENDING-PP]`, so the implementer reports `done` with the security layer unverified. Make "run these 6 curls and paste the codes" an explicit PP step 2b in the README, right after the SQL Editor step, so PP checks it before the variables go live, not "some day".
- [Minor] The trigger function in Open decision 1 has no `set search_path = ''` and uses unqualified `now()`. Supabase's Security Advisor flags this as "function_search_path_mutable". It is harmless here, because the table name is schema-qualified, but PP will get a warning e-mail or dashboard warning that looks alarming. Add `set search_path = ''`.
- [Minor] A 4xx from a check constraint shows "Could not reach the online board". With the 1e18 cap or the flood guard, the player reads "network problem" while the real reason is "rejected". The fix is one branch on `r.status < 500` with a different text. Optional.

Pre-mortem: A week after the deploy, PP writes "the board shows only my scores and a warning". Most likely cause: few people played, so 7 days passed without a single overlay open (plan-performance finding 3: play alone sends 0 requests), and the Free project paused. Every player then sees the local fallback, and their submits stay local, so the online board looks frozen even after "Resume". Signal missed: the pause warning e-mail goes to the Supabase account address, which PP may not read. Second most likely: one row at 9.99e17 posted by someone who read the bundle; Assumption 5 states this honestly, but PP may not remember that "Table Editor → delete row" is the fix.

Inversion worth considering: instead of PP "keeping it alive" by hand, add a weekly `schedule:` workflow in GitHub Actions that sends one `GET /rest/v1/scores?select=score&limit=1` with `vars.*`. That is about 10 YAML lines and zero game code. It removes the main pre-mortem cause, and it literally answers PP's "czy zadziala na github actions". Caveat: GitHub disables scheduled workflows after 60 days with no repo activity, so the pause risk moves to that limit. It does not disappear.

Investigate first:
- CORS preflight from the real origin, once the project exists: `curl -i -X OPTIONS "$URL/rest/v1/scores" -H "Origin: https://<user>.github.io" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: apikey,content-type,prefer"`. Expect `Access-Control-Allow-Origin` and the three headers allowed. This is unverified in the plan, and the mocked-fetch scenario cannot see it.
- What a paused project returns to the browser (an HTTP code with CORS headers, or a response without them, which `fetch` turns into a `TypeError`). Both end in the fallback, so this is only for the README text.
- PP: should the form say "Your name will be shown publicly online", and should autofill of real names be off (`autocomplete="off"` or `"nickname"`)? a) yes: players know before they submit; b) no: the form stays as today, and real names appear online by default. Recommendation: a).

## Plan (plan-senior, final)

Status: needs-decision

### Resolutions
- R1: roaster [Major] wrong key in the bundle: Decision: accepted, two guards. `keyRole(key)` in `leaderboard.ts` accepts only `sb_publishable_*` or a JWT whose payload has `role === 'anon'`; `pickStore()` falls back to `LocalStore` plus one `console.warn` otherwise; `deploy.yml` gets a step with the same rule that fails the build. PP steps mention only the publishable key; the sentence "the legacy anon key also works" leaves README and the PP steps (it stays true in code, so an old project still works). Rationale: the author's "either value works" is right for the anon JWT, but it sends PP to the tab where `service_role` sits next to it; the guard costs 8 lines and the build step is the only thing that keeps the key string out of `index-*.js` (the browser guard cannot remove a string Vite already inlined). Checked: `deploy.yml:28-30` (env block exists, no check), `leaderboard.ts` (no env read today).
- R2: roaster [Major] option (b) described too mildly + PP's "per-name or per-board, cheaply?": Decision: option (b) becomes a per-board cap (`where board = new.board`, index `(board, created_at)`), rewritten honestly in Decisions for PP; per-name cap rejected because a script rotates names and an honest "submit twice" (row 15) would hit it. Per-board only holds together with daily boards limited to today/yesterday UTC (PP question 2b); with any date allowed, a script invents dates and the per-board cap stops nothing, so 2a forces the global cap. Rationale: the roaster is right that a cap is a lock-out lever; per board confines the lock-out to the flooded board and tomorrow's DAILY is a fresh board, which the global cap cannot offer. Concurrency past 30 (roaster) accepted as is: the exact number does not matter. `set search_path = ''` added (roaster Minor).
- R3: impact [High] / roaster [Major] `warning` overwritten by the re-fetch GET: Decision: accepted. `send()` captures `const w = this.store.warning` right after `await submit`, calls `render()`, then writes `.lb-msg` from `w` (`w` wins; "Score saved." only when `w` is null and the GET did not set its own warning). R8 stub answers POST 400 then GET 200. Checked: `leaderboard.ts:212-217` (message written before `render()`).
- R4: performance [Medium] double SUBMIT vs impact [Medium] close/Esc during a pending POST: Decision: one `sending` flag closes both. `send()` returns early while sending, disables the SUBMIT button and shows "Sending…"; `close()` returns early while sending, so ✕, SKIP and Esc wait for the POST (max 6 s). Rejected the alternative "capture `done` before the await": on the daily path `done` sets `location.href` and the unload aborts the POST, so the score stays local with no message; blocking close is the only shape that handles it. Performance [Low] "rebirth waits up to 6 s": accepted as is, "Sending…" is the feedback, 6 s stays. Checked: `leaderboard.ts:132,149,194` (three close paths, no flag), `daily.ts:57`.
- R5: impact [Medium] `.env.local` read by the agents' dev server and PP's release build + roaster [Minor] `.env` committed: Decision: no `.env` file anywhere (README says the key lives only in GitHub Variables); `.gitignore` gets `.env*`; `pickStore()` returns `LocalStore` when `import.meta.env.DEV` (test-mode guard: the 5199 dev server can never reach PP's project); every existing scenario asserts `store.constructor.name === 'LocalStore'` in its first line. Rejected `.env.production.local` rename: `npx vite build --outDir release` (PP's playtest, CLAUDE.md "Run") is a production build and would still read it. Rejected `!.env.example`: nothing to put in it, README names the two variables.
- R6: performance [Low] keep-alive text vs roaster inversion (weekly Actions ping): Decision: `.github/workflows/keepalive.yml`, cron daily 09:00 UTC, one `curl --fail GET /rest/v1/scores?select=score&limit=1`, job skipped when `vars.VITE_SUPABASE_URL` is empty. Daily, not weekly: the pause rule the plan cites says "a few user requests to the database each day over the previous week". Rationale: the README note alone makes the pre-mortem ("board frozen after a quiet week") the default outcome; the workflow costs ~12 YAML lines and no game code, free on a public repo, and literally answers "czy to zadziała na GitHub Actions". Known limit, named in README: GitHub disables the schedule after 60 days without a commit (PP gets an e-mail and re-enables it in the Actions tab), and the Supabase pause e-mail still goes to PP's Supabase address. Boot-time GET rejected (performance): one request per player per session only to fight the pause.
- R7: impact [Low] `score < 1e18` vs uncapped `totalEarned`: Decision: `score < 1e300`. Checked: `src/core/format.ts:1` suffixes reach `dc` = 1e33, `src/systems/hole.ts:80` adds without a cap, `docs/PLAN.md` has no ceiling (grep `1e|ceiling|max money` empty). 1e300 still rejects `Infinity`/`NaN` (JSON carries them as `null` → `not null` fails).
- R8: roaster [Minor, optional] 4xx vs 5xx text: Decision: accepted, one branch in `submit`: `r.status < 500` → "The online board rejected this score: saved on this computer only.", everything else → "Could not reach the online board: score saved on this computer only." Rationale: with the flood cap (R2) the 4xx text is what honest players read during a flood; "could not reach" would send them to check their Wi-Fi.
- R9: roaster [Minor] curl list too short + `[PENDING-PP]` reported as done: Decision: `supabase/check.sh` (12 curls, prints `got <code> want 4xx` per line, including the CORS preflight from `https://<user>.github.io` and the flood/date cases when PP picks 1b/2b); README step 2b runs it right after the SQL step. Done-when lines 12-13, 14b, 27 stay `[PENDING-PP]`: the implementer reports them as pending, never as PASS.
- R10: impact [Low] SPEC.md:212 and CHANGELOG format: accepted (steps 9-10).
- R11: roaster "investigate first" (CORS, paused-project response): neither is possible before PP creates the project. CORS → `check.sh` line with the expected header; paused project → both response shapes (no CORS headers → `TypeError`; 5xx) end in `W_DOWN`, R7 runs both shapes, README says "the warning line means offline or paused: dashboard → Resume project".
- R12: roaster public-names question: a product rule (what the form says) → Decisions for PP 3.
- Rejected: performance [Low] README text "open the Leaderboard once a week" because R6 removes the manual chore; README keeps only "Resume project".
- Rejected: roaster bulk-insert as a code change because PostgREST checks run per row and the whole array fails as one transaction; it is a `check.sh` line only.

### Chosen variant
(A) Plain `fetch` `RemoteStore` behind the existing `LeaderboardStore` interface, security only in SQL (RLS, column grants, checks, one trigger), a key-shape guard in the browser and in the build, a `sending` flag for the pending-POST window, and a daily keep-alive workflow. Pros: no dependency, no server, the local store stays the source of truth on every path, PP's whole setup is two repo variables. Cons: the key is public, so anyone can insert plausible rows; any cap doubles as a lock-out lever for the flooded board; the pause risk moves to GitHub's 60-day schedule limit instead of disappearing. Cost: 1 GET (~1 KB, 10-row index scan) per overlay open, tab click and submit; 1 POST (204) per submit, 100 ms-6 s; trigger ≤ 30-row range scan per insert; 1 GET per day from Actions; < 1 MB/year at the assumed volume. Risk: flood on ALL-TIME blocks online saves on that board until the script stops; wrong key closed by R1; pause closed by R6 up to the 60-day limit. Ladder: rung 6 (~80 lines TS, ~30 SQL, ~25 YAML) on top of rung 3 (`fetch`, `AbortSignal.timeout`, `atob`).

### Rejected variant(s)
- (b) `@supabase/supabase-js`: pros: typed client, retries; cons: ~100 KB new dependency for one GET and one POST; rejected because no scenario needs it (rung 3 wins).
- (c) Edge Function / Cloudflare Worker proxy with a per-IP limit: pros: the only variant where a flood does not lock honest players out of the board, plus score plausibility checks; cons: a second runtime (Deno code, its own secret, its own pause rules), PP chose Supabase direct; rejected now. Revisit criterion: PP sees "rejected: saved on this computer only" for honest players during a flood more than once, or deletes flood rows more than once a month.
- (d) Runtime `config.json` on Pages: pros: no rebuild on key change; cons: one more request per boot, a file to keep in sync; rejected, the brief asks for build-time env.
- (e) Weekly instead of daily keep-alive: pros: 7× fewer runs; cons: the cited pause rule counts requests per day over the week; rejected, daily costs nothing on a public repo.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | no env vars | boot | `LocalStore`, zero `fetch` | v0 |
| 2 | env set | open overlay, ALL-TIME | "Loading…", then `GET scores?select=first_name,last_name,score,level,board,created_at&board=eq.main&order=score.desc&limit=10` with `apikey`; top 10 | v0 |
| 3 | env set | DAILY tab | same GET, `board=eq.daily-<UTC date>` | v0 |
| 4 | env set, pause overlay | SUBMIT valid | `LocalStore.submit`, then `POST scores` body `{first_name,last_name,score,level,board}`, `Prefer: return=minimal`; "Score saved."; re-GET | v0 |
| 5 | env set, rebirth offer | SUBMIT | POST, overlay closes, rebirth once; POST failure → HUD toast (bad) with the warning text | v0 |
| 6 | env set, daily over | SUBMIT | POST `board: 'daily-<date>'`, then redirect to the yard | v0, spec silent |
| 7 | env set, service down (`TypeError`, 5xx, paused, 6 s timeout) | open overlay | `.lb-msg` `W_DOWN` "Online board unreachable: showing scores saved on this computer." + local rows; no exception | v0 + R11 |
| 8 | env set, POST 4xx, then GET 200 | SUBMIT | local row kept, `.lb-msg` `W_REJECT` "The online board rejected this score: saved on this computer only." still shown after the re-render, overlay open | R3 + R8 |
| 9 | env set | ALL-TIME then DAILY before the first GET returns | rows of the last clicked tab | v0 |
| 10 | env set, odd row in the response | render | dropped by `isEntry` | v0 |
| 11 | env set, invalid name | SUBMIT | rejected client-side, zero `fetch` | v0 |
| 12 | anyone with the key, hand-made POST: 30-char name, score -1, score `1e400`/`null`, board `x`, an `id`, a JSON array with one bad row | POST | HTTP 4xx, no row (array: zero rows) | v0 + R7 + R9 |
| 13 | anyone with the key | PATCH, DELETE by id, DELETE without filter, `GET ?select=id`, `GET ?select=*` | HTTP 4xx, rows unchanged | v0 + R9 |
| 14 | `?daily=2099-01-01` | SUBMIT | PP 2a: accepted on `daily-2099-01-01`; PP 2b: 4xx → `W_REJECT`, local only | PP 2 |
| 15 | same run, SUBMIT twice (second click after the first settles) | SUBMIT ×2 | two rows online, as locally | v0, spec silent |
| 16 | pre-existing local rows | open overlay online | not uploaded; visible only in the fallback | v0, spec silent |
| 17 | repo variables missing | Actions build | passes, bundle without `supabase.co`, local board | v0 |
| 18 | repo variables set | Actions build | bundle has URL and key; 2 `env:` lines | v0 |
| 19 | env set, key is `service_role`-shaped or garbage (production build) | boot | `keyRole` → `null`, `LocalStore`, one `console.warn` | R1 |
| 20 | `VITE_SUPABASE_KEY` with role `service_role` / `sb_publishable_x` / empty | deploy.yml key step | fails / passes / skipped | R1 |
| 21 | env set, POST pending | second SUBMIT click or Enter | ignored: 1 POST, 1 local row, "Sending…", button disabled until the POST settles | R4 |
| 22 | env set, POST pending, `offer(done)` | Esc, SKIP or ✕ | ignored until the POST settles; then `done` once (rebirth; on the daily path the redirect) | R4 |
| 23 | env set, POST 5xx or network error | SUBMIT in overlay | local row, `.lb-msg` `W_SEND` "Could not reach the online board: score saved on this computer only.", overlay open | R8 |
| 24 | dev server (`import.meta.env.DEV`) with env set | boot | `LocalStore` (test-mode guard) | R5 |
| 25 | `.env`, `.env.local`, `.env.production` in the folder | `git check-ignore` | all ignored | R5 |
| 26 | keepalive workflow | cron daily / vars empty | YAML parses, one GET with `apikey`; job skipped when the URL var is empty | R6 |
| 27 | PP 1b: 31st POST within a minute on one board | POST | 4xx; a POST on another board in the same minute → 201/204 | PP 1 |
| 28 | PP 3a: store is `RemoteStore` | open overlay | footer "Score = money earned this run. Names are shown publicly online. Esc closes."; inputs `autocomplete="off"` | PP 3 |
| 29 | existing scenarios | run | `scenario-daily.js` D1-D11 and `scenario-leaderboard-app.js` 8/8 still pass, each asserting `LocalStore` first | R5 |
| 30 | docs | read | SPEC.md 211-212 say online + fallback; CHANGELOG top entry player-facing, no `supabase.co`; README section with PP steps 1-6 and 2b | R10 |

### Steps (edit order)
1. `supabase/leaderboard.sql` (new): the v0 SQL with `score double precision not null check (score >= 0 and score < 1e300)`; keep `revoke all`, column grants, the two policies, index `scores_board_score`. Append the guard block according to PP's answers (the implementer pastes exactly one variant; until PP answers, write the recommended 1b+2b and mark the file header `-- guard: per board 30/min + today/yesterday (PP 1b, 2b)`):
   ```sql
   create function public.scores_guard() returns trigger language plpgsql set search_path = '' as $$
   declare
     today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
     yday  text := to_char((now() at time zone 'utc') - interval '1 day', 'YYYY-MM-DD');
   begin
     if new.board <> 'main' and new.board not in ('daily-' || today, 'daily-' || yday) then
       raise exception 'daily board must be today or yesterday (UTC)';
     end if;
     if (select count(*) from public.scores where board = new.board and created_at > now() - interval '1 minute') >= 30 then
       raise exception 'too many scores on this board right now, try again in a minute';
     end if;
     return new;
   end $$;
   create trigger scores_guard before insert on public.scores for each row execute function public.scores_guard();
   create index scores_board_created on public.scores (board, created_at);
   ```
   Variants: 1b+2a → drop the first `if`, drop `board = new.board and`, index `scores_created on public.scores (created_at)`. 1a+2b → keep only the date `if`, no index. 1a+2a → no guard block. Red test: Done-when 12-13, 27 (`check.sh`, `[PENDING-PP]`).
2. `supabase/check.sh` (new, `sh check.sh "$URL" "$KEY"`): 12 `curl -s -o /dev/null -w '%{http_code}'` lines, each printed as `<case>: got <code> want <4xx|2xx|header>`: score -1; 30-char name; score `1e400`; board `x`; body with `id`; JSON array `[good, bad]` then `GET …&limit=1000` count unchanged; PATCH `score=1`; DELETE `?id=eq.1`; DELETE without filter; `GET ?select=id`; `GET ?select=*`; `OPTIONS` with `Origin: https://<user>.github.io`, `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: apikey,content-type,prefer` → `access-control-allow-origin` present. When 1b: 31 POSTs of a valid row on `main` → the 31st `4xx`, then one on `daily-<today>` → `2xx`. When 2b: `board: 'daily-2099-01-01'` → `4xx`. Red test: Done-when 12-13, 27.
3. `src/ui/leaderboard.ts`:
   - constants: `const W_DOWN = 'Online board unreachable: showing scores saved on this computer.'`, `W_SEND = 'Could not reach the online board: score saved on this computer only.'`, `W_REJECT = 'The online board rejected this score: saved on this computer only.'`, `TIMEOUT_MS = 6000`.
   - `export function keyRole(key: string): 'anon' | null`: `sb_publishable_` prefix → `'anon'`; else `JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon' ? 'anon' : null`, `try/catch` → `null`.
   - `LeaderboardStore` gets `readonly warning?: string | null`.
   - `export class RemoteStore implements LeaderboardStore` with `constructor(private url: string, private key: string)`, `private local = new LocalStore()`, `warning: string | null = null`, `private async call(path: string, init: RequestInit = {}): Promise<Response>` (`fetch(\`${this.url}/rest/v1/${path}\`, { ...init, headers: { apikey: this.key, 'Content-Type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) })`, throws `Object.assign(new Error(...), { status: r.status })` on `!r.ok`). `list(board = 'main')`: GET as in row 2, map `{first_name,last_name,score,level,board,created_at}` → `Entry` (`at: Date.parse(created_at)`), filter `isEntry`, `warning = null`; any error → `warning = W_DOWN`, `return this.local.list(board)`. `submit(e)`: `await this.local.submit(e)`, then POST `{ first_name: e.first, last_name: e.last, score: e.score, level: e.level, board: e.board ?? 'main' }` with `Prefer: return=minimal`; error with `status < 500` → `warning = W_REJECT`, other errors → `W_SEND`, success → `null`. Never rethrows.
   - `export function pickStore(): LeaderboardStore`: `const { DEV, VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env; if (DEV || !url || !key) return new LocalStore(); if (keyRole(String(key)) !== 'anon') { console.warn('VITE_SUPABASE_KEY is not the publishable key: online board off'); return new LocalStore(); } return new RemoteStore(String(url).replace(/\/$/, ''), String(key));`. Constructor default `store: LeaderboardStore = pickStore()`.
   - fields `private sending = false; private renderN = 0; private submitBtn: HTMLButtonElement` (`q('button[type="submit"]')`).
   - `close()`: `if (!this.isOpen || this.sending) return;` (rest unchanged).
   - `send()`: `if (this.sending) return;` first; after the name check: `this.sending = true; this.submitBtn.disabled = true; this.msg.textContent = 'Sending…'; try { await this.store.submit({...}); } finally { this.sending = false; this.submitBtn.disabled = false; }`, then `const w = this.store.warning ?? null; w ? ctx.audio.deny() : ctx.audio.buy(); if (this.done) { if (w) ctx.hud.toast(w, 'bad'); return this.close(); } this.tab = this.board; await this.render(); this.msg.classList.toggle('ok', !w); if (w) this.msg.textContent = w; else if (!this.store.warning) this.msg.textContent = 'Score saved.';`.
   - `render()`: `const n = ++this.renderN;` then `this.rows.textContent = 'Loading…';` before the await; after it `if (n !== this.renderN) return;`; after the rows: `if (this.store.warning) { this.msg.classList.remove('ok'); this.msg.textContent = this.store.warning; }`.
   - `Entry.at` comment → `// Date.now() locally, created_at online`.
   - PP 3a only: footer text set in the constructor from `this.store instanceof RemoteStore` (`'Score = money earned this run. Names are shown publicly online. Esc closes.'`), both inputs `autocomplete="off"`.
   - Red tests: scratchpad `smoke/scenario-remote-lb.js` R1-R13 (step 11).
4. `.github/workflows/deploy.yml`: before `- run: npm run build` add
   ```yaml
         - name: Refuse any Supabase key other than the publishable (anon) one
           if: vars.VITE_SUPABASE_KEY != ''
           env:
             KEY: ${{ vars.VITE_SUPABASE_KEY }}
           run: |
             case "$KEY" in sb_publishable_*) exit 0;; esac
             node -e 'const r=JSON.parse(Buffer.from(process.env.KEY.split(".")[1]??"","base64url")).role;if(r!=="anon"){console.error("VITE_SUPABASE_KEY has role "+r+": paste the publishable key");process.exit(1)}'
   ```
   and under the build `env:` add `VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}` and `VITE_SUPABASE_KEY: ${{ vars.VITE_SUPABASE_KEY }}`. Red test: Done-when 18, 20 (the `run:` block executed locally with `KEY=` set to a fake service_role JWT, a fake anon JWT, `sb_publishable_x`).
5. `.github/workflows/keepalive.yml` (new): `name: Keep the Supabase project awake`, `on: { schedule: [{ cron: '0 9 * * *' }], workflow_dispatch: }`, `permissions: {}`, job `ping` with `if: vars.VITE_SUPABASE_URL != ''`, `runs-on: ubuntu-latest`, one step `run: curl --fail -sS -o /dev/null "$URL/rest/v1/scores?select=score&limit=1" -H "apikey: $KEY"` with `env: { URL: ${{ vars.VITE_SUPABASE_URL }}, KEY: ${{ vars.VITE_SUPABASE_KEY }} }`. Red test: Done-when 26.
6. `.gitignore`: add `.env*` with the comment `# the Supabase key lives only in GitHub repository variables`. Red test: Done-when 25.
7. `CLAUDE.md` "Tests" paragraph, one sentence: "Every leaderboard scenario asserts `store.constructor.name === 'LocalStore'` first; the dev server never goes online (`pickStore()` returns `LocalStore` in DEV) and no `.env` file may exist in this folder." Red test: Done-when 24, 29.
8. `README.md` section "Online leaderboard (Supabase)" (English): steps 1-6 from v0 with these changes: step 3 names only the publishable key (`sb_publishable_…`, Settings → API Keys, the default tab); new step 2b "run `sh supabase/check.sh <Project URL> <publishable key>` and check every line says `ok`" right after the SQL step; step 6 becomes "A daily GitHub Action keeps the project awake. If the online board shows the warning line, open the Supabase dashboard → Resume project. After 60 days without a commit GitHub disables the action (you get an e-mail): Actions → Keep the Supabase project awake → Enable."; a line "Do not create `.env` files: the key goes only into GitHub Variables; to test the online board locally use the Pages build, not `npm run dev`."; an honest "Cheating" paragraph from Assumption 5 plus the flood-cap sentence from PP's answer.
9. `docs/SPEC.md:211` → "Wspólna tablica online (Supabase) gdy build ma `VITE_SUPABASE_URL` i `VITE_SUPABASE_KEY`; bez nich albo gdy serwis nie odpowiada, tablica lokalna z komunikatem. Klucz jest publiczny: każdy może wysłać dowolny wynik w granicach sprawdzeń bazy; blokada zalewu wg decyzji PP." and `:212` "własna lista wyników (lokalnie 7 dni trzymane; online wszystkie dni)". `BOARD.md` line 213 mirrors it (local file).
10. `CHANGELOG.md`: new top entry `## 2026-10-20 <hh:mm>` with one player-facing bullet ("Leaderboard: shared online board when the build has the Supabase keys; without them or offline you see your local scores and a notice. Test: open the Leaderboard, submit a run, switch tabs, turn Wi-Fi off and submit again."), no URL or key. This note gets "Work progress".
11. Scratchpad `smoke/scenario-remote-lb.js` (dev server 5199; `CDP_PORT=93xx MAXPOLL=2400 node smoke.mjs run-remote-lb scenario-remote-lb.js`): v0 R1-R9 plus R10 `keyRole` (three keys), R11 double SUBMIT during a pending POST, R12 Esc/SKIP during a pending POST with `offer(done)`, R13 POST 503 → `W_SEND`; R7 runs both shapes (`TypeError`, 503) and the abort-only fetch; R8 stub = POST 400 then GET 200. First lines of `scenario-daily.js` and `scenario-leaderboard-app.js` assert `LocalStore`.

### Review focus
1. CORS preflight from the real `github.io` origin (nothing local can see it) → pinned by step 2 `check.sh` OPTIONS line, run by PP in step 2b.
2. Paused project: response without CORS headers (`TypeError`) vs 5xx → pinned by step 11 R7 (both shapes → `W_DOWN`, `LOGS` empty).
3. Legacy anon JWT accepted while a `service_role` JWT is refused in both guards → pinned by step 11 R10 and Done-when 20 (deploy.yml `run:` block executed locally with three keys).
4. POST OK but the re-fetch GET fails: `.lb-msg` must show `W_DOWN`, not "Score saved." → pinned by step 11 R8b (POST 204, GET 503).
5. Daily path: Esc during the pending POST, then the redirect runs exactly once after the POST settles → pinned by step 11 R12 (`offer(done)`, Esc, resolve → `done 1`, no `done` before).

### Done when
1. `run-remote-lb` R1 → `store LocalStore, calls 0`
2. R2 → `loading true, shown 2, url …select=first_name,last_name,score,level,board,created_at&board=eq.main&order=score.desc&limit=10, apikey true, method GET`
3. R3 → `url contains board=eq.daily-<today UTC>`
4. R4 → `post true, keys first_name,last_name,score,level,board, board main, prefer return=minimal, localRows +1, msg "Score saved."`
5. R5 → `done 1, hidden true, toast contains "this computer only"`
6. R6 → `post board daily-2026-10-20`
7. R7 → `TypeError: msg "Online board unreachable…", rows = local, LOGS empty; 503: same; abort-only fetch: warning after ≤ 7 s, never "Loading…" forever`
8. R8 (POST 400, GET 200) → `open true, localRows +1, msg "The online board rejected this score…" after the re-render`; R8b (POST 204, GET 503) → `msg "Online board unreachable…"`
9. R9 → `rows from last clicked tab (DAILY)`
10. R2 → `malformed row dropped (3 in, 2 shown)`
11. R4 → `invalid name: calls unchanged`
12. `[PENDING-PP until step 2b]` `sh supabase/check.sh "$URL" "$KEY"` → lines `score -1`, `30-char name`, `score 1e400`, `board x`, `id in body`, `array with bad row` all `got 4xx want 4xx`; `array: rows unchanged`
13. `[PENDING-PP until step 2b]` `check.sh` lines `PATCH`, `DELETE by id`, `DELETE no filter`, `select=id`, `select=*` all `got 4xx want 4xx`; `GET after` still returns the row; `OPTIONS` → `access-control-allow-origin present`
14. PP 2a: R6 with `?daily=2099-01-01` → `post board daily-2099-01-01`; PP 2b: `[PENDING-PP]` `check.sh` line `daily-2099-01-01` → `got 4xx want 4xx` and R8-style stub → `msg "The online board rejected…"`
15. R4 run twice (second click after the first settles) → `POST count 2`
16. R7 → `fallback rows include the pre-existing local row; R2 rows do not`
17. `npx vite build --outDir <scratchpad>/noenv-dist --emptyOutDir && rg -l "supabase.co" <scratchpad>/noenv-dist/assets` → no file
18. `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_KEY=sb_publishable_test npx vite build --outDir <scratchpad>/env-dist --emptyOutDir && rg -l "example.supabase.co" <scratchpad>/env-dist/assets` → one `index-*.js`; `rg -c "vars.VITE_SUPABASE" .github/workflows/deploy.yml` → `3`
19. R10 → `keyRole sb_publishable_x = anon, anon JWT = anon, service_role JWT = null, garbage = null`; `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_KEY=<fake service_role JWT> npx vite build --outDir <scratchpad>/badkey-dist --emptyOutDir` then `npx vite preview --outDir <scratchpad>/badkey-dist --port 5311` + headless open → `store LocalStore, console.warn contains "not the publishable key"`
20. the deploy.yml `run:` block copied to a shell with `KEY=<fake service_role JWT>` → `exit 1`, message `has role service_role`; `KEY=<fake anon JWT>` → `exit 0`; `KEY=sb_publishable_x` → `exit 0`; `yaml.parse(deploy.yml, {strict:true})` → `if: vars.VITE_SUPABASE_KEY != ''` on the check step
21. R11 → `POST count 1, localRows +1, msg "Sending…" while pending, submit.disabled true while pending, false after`
22. R12 → `done 0 while pending (Esc, SKIP, ✕ each tried), done 1 after resolve, hidden true`
23. R13 (POST 503) → `open true, localRows +1, msg "Could not reach the online board…"`
24. `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_KEY=sb_publishable_test npx vite --port 5199 --host 127.0.0.1` + R1 → `store LocalStore, calls 0`
25. `touch .env .env.local .env.production && git check-ignore .env .env.local .env.production` → three paths, then remove the three files
26. `yaml.parse(keepalive.yml, {strict:true})` → `on.schedule[0].cron = "0 9 * * *"`, `jobs.ping.if = "vars.VITE_SUPABASE_URL != ''"`, one step with `curl --fail`
27. PP 1b: `[PENDING-PP until step 2b]` `check.sh` lines `31st POST on main` → `got 4xx want 4xx`, `POST on daily-<today>` → `got 2xx want 2xx`; PP 1a: line absent, `rg -c "scores_guard" supabase/leaderboard.sql` → `0` when 2a too
28. PP 3a: R2 → `foot "Score = money earned this run. Names are shown publicly online. Esc closes.", autocomplete off ×2`; existing `scenario-leaderboard-app.js` with `LocalStore` → `foot unchanged`; PP 3b: no such lines
29. `CDP_PORT=9361 MAXPOLL=2400 node smoke.mjs run-daily scenario-daily.js` → `store LocalStore` first line, D1-D11 PASS; `scenario-leaderboard-app.js` → `store LocalStore`, 8/8
30. `rg -n "Supabase" docs/SPEC.md` → lines 211 and 212; `rg -c "supabase.co" CHANGELOG.md` → `0` and the first `## ` heading is the new build; `rg -n "check.sh|Resume project|Do not create" README.md` → three hits; `npx tsc --noEmit` → 0 lines

### Decisions for PP
1. Blokada zalewu wyników. a) bez blokady: kiedy ktoś uruchomi skrypt, wtedy wgra tysiące wpisów na minutę, aż darmowa baza (500 MB, około 10 godzin zalewu) się zapełni i przejdzie w tryb tylko do odczytu; wtedy nikt nie zapisze wyniku online, dopóki ręcznie nie skasujesz wpisów w panelu. b) limit 30 wpisów na minutę na jedną tablicę (ALL-TIME osobno, każdy dzień DAILY osobno; 15 linii SQL, zero zmian w grze): kiedy skrypt zalewa ALL-TIME, wtedy baza rośnie najwyżej o 43 tys. wierszy dziennie, ale przez cały czas zalewu nikt nie zapisze wyniku na ALL-TIME online (gracz widzi „the online board rejected this score: saved on this computer only"); DAILY działa dalej, a jutro ma czystą tablicę. Zalew kończy się dopiero, gdy skrypt przestanie: możesz skasować jego wiersze, ale nie zablokujesz go, bo klucz w grze jest publiczny i nowy klucz skrypt odczyta tak samo; prawdziwa blokada wymaga serwera (odrzucony wariant c). Żadna opcja nie zatrzyma pojedynczego fałszywego wyniku. Rekomendacja: b), bo pełna baza blokuje zapis wszystkim i na stałe, a limit tylko na czas zalewu i tylko na jednej tablicy. Uwaga: b) wymaga 2b), inaczej skrypt obchodzi limit, zmyślając daty.
2. Daty tablic DAILY. a) baza przyjmuje każdą datę z `?daily=RRRR-MM-DD` (jak dziś lokalnie, zero kodu): kiedy ktoś wyśle wynik na datę z przyszłości, wtedy ląduje na tablicy, której nikt nie ogląda; przy 1b) limit musi być wtedy wspólny dla całej bazy, więc jeden zalew blokuje też DAILY. b) tylko dzisiejsza i wczorajsza data UTC (3 linie w tej samej funkcji SQL): kiedy gracz zacznie daily o 23:58 UTC i skończy po północy, wtedy wynik i tak wchodzi (wczoraj dozwolone); kiedy ktoś wyśle na 2099-01-01, wtedy dostaje „rejected" i wynik zostaje tylko na jego komputerze. Rekomendacja: b).
3. Nazwiska publiczne. a) stopka formularza mówi „Names are shown publicly online", gdy tablica jest online, a przeglądarka nie podpowiada prawdziwego imienia i nazwiska (autouzupełnianie wyłączone w obu polach, także lokalnie): kiedy gracz wpisuje nazwisko, wtedy wie, że zobaczy je każdy, i wpisuje je sam. b) bez zmian: kiedy gracz kliknie w pole, wtedy przeglądarka podpowie jego prawdziwe dane i trafią one do publicznej tabeli bez ostrzeżenia, a gracz nie może ich sam skasować. Rekomendacja: a).
4. PP (2026-10-20, terminal): "dopisz tam jakis klucz md5 albo hmac z wyniku i dzisiejszej daty ktory bedziemy walidowac przy odczycie jakby komus sie nudzilo i probowal wpisac pierdoly tylko nazwij to key a nie jakos szczegolowo". Decision: new column `key text not null` in `public.scores` (plus its column grant for insert, no select grant). The game sends `key` = hex HMAC-SHA256 (`crypto.subtle`, no new dependency) over `<score>|<board>|<UTC date YYYY-MM-DD>` with a secret baked into the build (`VITE_SUPABASE_SALT`, Actions variable). A `before insert` trigger (`security definer`) recomputes the HMAC with `pgcrypto` (`hmac(..., 'sha256')`) for today's or yesterday's UTC date (a score sent just after midnight still passes) and raises an exception when `key` does not match, so the row is never stored and the game shows "rejected". The secret also lives in the database (in the trigger function body, not readable by `anon`). PP (2026-10-20, after the explanation that a trigger runs on every insert, REST included): "nie wiedzialem ze tam jest taka mozliwosc dasz rade to ustawic", so the check is on insert, not on read. The score must be hashed in one canonical text form on both sides (JS and Postgres format large doubles differently): the implementer picks the form and pins it with Done-when lines: a real game POST is stored, a POST with a wrong `key` gets 4xx and no row. Limit, said once to PP: the secret ships inside the game's JS, so it stops a casual `curl` with junk, not someone who reads the bundle.
Założenia bez pytania (spec silent, powiedz tylko, jeśli źle):
- [spec silent] Zakładam: koniec daily (`daily.ts:57`) wysyła wynik online na `daily-<data>` tak samo jak menu pauzy i odrodzenie | Dowód: ta sama ścieżka `offer()` → `send()` → `store.submit` | Jeśli źle: wyniki daily zostają tylko lokalnie | rekomendacja: a) jak pozostałe ścieżki.
- [spec silent] Zakładam: ten sam run można wysłać dwa razy (dwa wiersze online) | Dowód: `2026-10-20-leaderboard-pages.md` „Rejected: limit of one submission per run" (decyzja z dziś) | Jeśli źle: PP widzi podwójne wiersze jednego gracza | rekomendacja: a) zachować zgodność z lokalną tablicą.
- [spec silent] Zakładam: stare lokalne wyniki nie wjeżdżają na tablicę online | Dowód: nie da się ich zweryfikować, a każde urządzenie wysłałoby je osobno | Jeśli źle: PP spodziewa się swoich starych wyników online i widzi „No scores yet." | rekomendacja: a) nie wgrywać, PP wysyła nowy run.
- [decision age] brak: każda decyzja, na której plan się opiera, jest z 2026-10-20.

### v0 → final
- added: key guard in `pickStore()` and a failing deploy.yml step (R1); `sending` flag that also blocks ✕/SKIP/Esc during a POST (R4); `.lb-msg` written from the captured warning after `render()` (R3); 4xx "rejected" vs 5xx "could not reach" (R8); DEV test-mode guard, `.env*` ignore, `LocalStore` assertion in every scenario (R5); daily keep-alive workflow (R6); `supabase/check.sh` with 12 curls incl. CORS as PP step 2b (R9, R11); score cap 1e300 (R7); SPEC 212, CHANGELOG, README "no .env" (R10); matrix 18 → 30 rows, Done when 18 → 30 lines.
- dropped: "the legacy anon key also works" from README and PP steps; the manual "play once a week" advice; per-name cap (never added).
- moved to PP: flood cap rewritten as per-board with the honest lock-out effect and the 1b↔2b dependency (question 1); daily date window with the recommendation flipped to b) because of that dependency (question 2); public-names notice + autofill off (question 3).
