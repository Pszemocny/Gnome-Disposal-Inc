# Gnome Disposal Inc.

A browser game: a first-person physics sandbox where you feed garden gnomes to a hungry hole for money, then automate it with machines. Built with Three.js + Rapier, no downloaded assets.

## Run

```bash
npm install
npm run dev        # open the printed URL (http://localhost:5173)
npm run build      # static build in dist/, host anywhere
npm run typecheck
```

Desktop browser with mouse and keyboard. Click "Start hustling" to lock the mouse.

## Controls

WASD move · Shift sprint · Space jump · LMB (hold) grab · RMB (hold) throw · F kick · E use (PC desk, repair) · 1-0 place tools (R rotate, T tilt, wheel height, RMB/Q cancel) · X pick up a placed tool · B shop (Laptop upgrade) · Esc menu

## Online leaderboard (Supabase)

The Pages build talks to Supabase REST straight from the browser for the leaderboard and the error log; GitHub Pages and Actions only build and serve. Without the three repository variables below (and always on `npm run dev`) the game keeps the local leaderboard.

1. supabase.com → New project (any name, region Frankfurt, any strong DB password; the game never uses it).
2. Generate the score secret once: `openssl rand -hex 32`. Paste `supabase/leaderboard.sql` into SQL Editor, replace `__SALT__` there with that value, then Run (once). Never put the value into the file in the repo: the repo is public.
   - 2b. Run `sh supabase/check.sh <Project URL> <publishable key> <secret>` and check that every line ends with `ok` and the last line says `failed: 0`. Then remove its test rows in SQL Editor: `delete from public.scores where name like 'Check-%'; delete from public.errors where build = 'check.sh';`. `ONLY=errors sh supabase/check.sh <url> <key>` checks only the error table and needs no secret.
   - 2c. Paste `supabase/errors.sql` into SQL Editor, Run once.
3. Settings → API Keys (the default tab): copy the **Project URL** and the **publishable** key (`sb_publishable_…`). Never use any other key: the build refuses it.
4. GitHub repo → Settings → Secrets and variables → Actions → **Variables** tab → New repository variable: `VITE_SUPABASE_URL` = Project URL, `VITE_SUPABASE_KEY` = publishable key, `VITE_SUPABASE_SALT` = the secret from step 2.
5. Actions → "Deploy to GitHub Pages" → Run workflow (or push to `main`). Open the game, pause, Leaderboard: no warning line under the board and the footer says "Your name or nickname is shown publicly online" = online.
6. A daily GitHub Action ("Keep the Supabase project awake") keeps the Free project from pausing. If the online board shows the warning line, open the Supabase dashboard → Resume project. After 60 days without a commit GitHub disables the action (you get an e-mail): Actions → Keep the Supabase project awake → Enable.

Do not create `.env` files: the key goes only into GitHub Variables; to test the online board locally use a production build (`vite build` + `vite preview`), not `npm run dev`.

Cheating, honestly: the key and the score secret ship inside the game's JavaScript. The database refuses rows without a matching `key` (an HMAC of the score, the board and today's or yesterday's UTC date), so a casual `curl` with junk fails, but someone who reads the bundle can still send any score within the checks (0 ≤ score < 1e300, hole level 1-99, a name or nickname of 1-20 characters, daily boards only for today or yesterday UTC, FASTEST LVL 12 rows only at level 12 and at least 120 s) under any name. Each board takes at most 30 new scores a minute: a script flooding one board blocks online saves on that board while it runs, and honest players then see "rejected: saved on this computer only". All boards together take at most 2000 new scores per 24 hours, so a flood cannot fill the database, but it can stop online saves for everyone for up to a day; clean up by deleting the flood rows in the dashboard. Nobody can change or delete rows with the public key; clean up in the dashboard (Table Editor → delete row). The error table takes at most 20 rows per game session and 2000 errors plus 2000 measurement lines per 24 hours; the per-session cap only bounds an honest game with a bug, a script with the key can fill a day's budget in a minute and silence error reports for that day; clean up by deleting its rows.

Reading errors: Table Editor → errors, or in SQL Editor one line per distinct bug:

```sql
select message, source, count(*) as sessions, sum(count) as hits, max(created_at) as last, (array_agg(build order by created_at desc))[1] as last_build from public.errors where source <> 'note' group by message, source order by last desc;
```

and the measurement lines (`mouse-jump`, `slow-frame`):

```sql
select created_at, message, level, land, build from public.errors where source = 'note' order by created_at desc limit 50;
```

The `build` column ends with `@<commit>`, so the stack can be read against that commit. Rows have no names and no addresses: message, stack, browser string, hole level, land and a random id per page load.

## Docs

- `docs/RESEARCH.md`: why this tech stack.
- `docs/PLAN.md`: game design (hole levels, gnome types, shop, events, secrets) and code layout.
