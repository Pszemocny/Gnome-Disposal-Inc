# Leaderboard + GitHub Pages deploy (PP-G)

Interpretation: build BOARD item PP-G from the orchestrator's final plan (the night task envelope is the plan). PP (Slack, verbatim): "Trzeba też dodać jakąś tablicę wyników, imię i nazwisko, do GitHub Actions, bo tam chcę to uruchomić na razie". A local leaderboard (top 10, first + last name) in a new standalone module, wired into `main.ts` and `player.ts` by the orchestrator later; a GitHub Pages workflow with the base path from `VITE_BASE`; local `git init` only, no commit, no remote, no push.

Gotowe, gdy:
1. store: 12 entries submitted → `list()` sorted by score descending, the overlay shows 10 rows in that order; `<b>x</b>` as a name → rejected with a message, store unchanged; a 30-char name → rejected; "Łukasz" / "Żółć" → accepted and stored.
2. `VITE_BASE=/gnome-boozed/ npx vite build --outDir <scratchpad>/pages-dist --emptyOutDir` → passes; that folder served under `/gnome-boozed/` on port 5310 → game loads, every texture request 200, no 404 in the logs.
3. `npx vite build --outDir <scratchpad>/root-dist --emptyOutDir` (no `VITE_BASE`) → passes, `index.html` references `/assets/...`.
4. `.github/workflows/deploy.yml` parses as YAML with node.
5. `git status` works, `git log` has no commits.
6. no exceptions in the page logs; `npx tsc --noEmit` clean.

## Problem

PP wants to put the game on GitHub Pages and see a leaderboard with first and last names. Pages serves the site under `/<repo>/`, so every absolute asset URL breaks there.

## Summary

Ladder:
- `textures.ts` already builds its URLs with `import.meta.env.BASE_URL` (step 2, nothing to change). Grep for `/textures/`, `.jpg`, `.png`, `fetch(`, `url(` found no other runtime asset URL: `index.html` has `/src/main.ts` (Vite rewrites it), the favicon is a data URL, the font comes from Google Fonts.
- `vite.config.ts`: one line, `base: process.env.VITE_BASE ?? '/'` (step 5).
- Leaderboard: new file `src/ui/leaderboard.ts`, the overlay reuses the shop CSS classes like blueprints (step 2); validation is one Unicode regex (`\p{L}`, step 3).

What the player gets:
- Pause menu: a "Leaderboard" button next to "Achievements" (the module adds it itself whenever the pause card is drawn). No hotkey: the pause menu is where the pointer is free and the form can be typed into; a key while playing would need its own guards in `main.ts`.
- The overlay shows the top 10 (rank, first + last name, money earned this run, hole level, date) and a form: first name, last name, Submit. Score = `state.totalEarned`, plus `state.holeLevel` and the date.
- Names: trimmed, 1-24 characters, letters (any alphabet, so Polish diacritics too), spaces, hyphen, apostrophe. `<` or `>` → "No HTML, please."; other symbols → "Letters, spaces, - and ' only."; empty or longer than 24 → "First name: 1-24 characters." All user text is rendered with `textContent`.
- Rebirth: when the player clicks "Be reborn", the same overlay opens with the title "SUBMIT YOUR RUN" and a "Skip" button; Submit or Skip (or Esc) then runs the rebirth. The score is read before the rebirth resets the run.
- While the overlay is open it swallows every key (capture listener), so typing "M" in a name does not mute the game and letters do not reach the game's input; Esc closes it.
- Storage: `LeaderboardStore { list(); submit(e) }`, only `LocalStore` (localStorage `gnome-boozed-leaderboard`, best 50 kept). A broken or hand-edited entry is dropped on read.

Rejected:
- a remote store (Supabase / Cloudflare): PP's decision, question 1 in BOARD "Pytania do PP na rano"; the interface is the swap point.
- limit of one submission per run: not asked; a player can submit the same run twice and get two rows.
- hotkey for the leaderboard: see above, the pause-menu button is enough.

## Wiring for the orchestrator (exact lines)

`src/core/context.ts` (next to the `shop` field):
```ts
import type { Leaderboard } from '../ui/leaderboard';
  leaderboard: Leaderboard;
```

`src/main.ts`:
```ts
import { Leaderboard } from './ui/leaderboard';
```
right after `menu.show('title');` (it needs the `.menu` element to exist, and its Esc handler is a capture listener, so the order against the main Esc listener does not matter):
```ts
  ctx.leaderboard = new Leaderboard();
```
No pause guards are needed: the overlay only opens from the pause menu (pointer already free, `ctx.paused` already true) or from the Deep screen (already guarded by `document.querySelector('.deep')`), and it eats Esc before `main.ts` sees it.

`src/player/player.ts`, in `fellIn()` (replace the line):
```ts
      ctx.hud.deep(ctx.hole.shardsForRebirth(), () => ctx.leaderboard.offer(() => ctx.hole.rebirth()));
```

## What PP must do to publish

1. Create the GitHub repo (name `gnome-boozed`; if it is another name, change `VITE_BASE` in `.github/workflows/deploy.yml`).
2. Repo Settings → Pages → Source: "GitHub Actions".
3. Decide whether `BOARD.md` (night queue, questions to PP) belongs in the repo; it is not ignored now. Then `git add -A && git commit -m "..."`, `git remote add origin <url>`, `git push -u origin main` (the workflow runs on push to `main`, or by hand from the Actions tab).

## Work progress

Local git: there was no `.git`, so `git init -b main` ran in the project folder. `.gitignore` had node_modules, dist, release; added `.DS_Store` and `*.log`. Nothing committed, no remote.

Scripts (session scratchpad, `smoke/`): `scenario-leaderboard.js` (dev server 5199), `pages-server.mjs` (static server on 5310, serves a build under `/gnome-boozed/`, logs status per request), `pages-smoke.mjs` (copy of `smoke.mjs` with the URL from `BASE_URL`), `scenario-pages.js`. YAML check: `yaml@2` installed into the scratchpad only (`npm install --prefix <scratchpad>/yamlcheck`), not into the project.

Checks:
- [PASS] 1 store/overlay — `CDP_PORT=9360 MAXPOLL=2400 node smoke.mjs run-lb scenario-leaderboard.js` → `stored 12, sortedDesc true, shown 10, topMatches true`; `<b>x</b>` → "First name: no HTML, please." / "Last name: no HTML, please.", count stays 12; 30 chars → "First name: 1-24 characters.", 25 chars → "Last name: 1-24 characters.", "R2D2" → "letters, spaces, - and ' only."; "  Łukasz " + "Żółć" → "Score saved.", top entry `{first:"Łukasz", last:"Żółć", score:5000000000, level:7}`, row 1 "1. Łukasz Żółć"; also: pause-menu button present and opens the overlay; KeyM typed in the form never reaches `input.pressed`; Esc closes it with `defaultPrevented true`, pause menu stays; `offer()` → SKIP runs done once, bad name keeps it open, valid submit runs done and stores score 4242; a hand-edited `<img onerror>` name renders as text (0 `img`, no script run), broken entries dropped. LOGS empty.
- [PASS] 2 Pages build — `VITE_BASE=/gnome-boozed/ npx vite build --outDir <scratchpad>/pages-dist --emptyOutDir` → exit 0, `index.html` loads `/gnome-boozed/assets/index-*.js`; `BASE_URL=http://localhost:5310/gnome-boozed/ CDP_PORT=9360 node pages-smoke.mjs run-pages scenario-pages.js` → `canvas true`, 7 textures under `/gnome-boozed/textures/` all 200, `bad []`, LOGS empty; server log: 10 requests, all 200; screenshot shows the textured garden. Server stopped (`pkill -f pages-server.mjs` → 0).
- [PASS] 3 root build — `npx vite build --outDir <scratchpad>/root-dist --emptyOutDir` → exit 0, `src="/assets/index-*.js"`. Real `release/` and port 5300 untouched.
- [PASS] 4 YAML — `yaml.parse(deploy.yml, {strict:true})` → `jobs=build,deploy on=push,workflow_dispatch perms={"contents":"read","pages":"write","id-token":"write"} base=/gnome-boozed/`.
- [PASS] 5 git — `git status --short` lists the project as untracked, `git log` → "your current branch 'main' does not have any commits yet"; `git check-ignore` confirms node_modules, dist, release, .DS_Store, *.log.
- [PASS] 6 no exceptions (both LOGS empty); `npx tsc --noEmit` → 0 lines (a first run showed 6 errors in `src/systems/hole.ts` from the agent working there; gone on the re-run).

Self-check: `src/world/textures.ts` needed no edit (already on `BASE_URL`); no other `src` file touched except the new `src/ui/leaderboard.ts`; no project dependency added; the overlay reuses the shop CSS classes; user text only through `textContent` (the one `innerHTML` is static markup).
