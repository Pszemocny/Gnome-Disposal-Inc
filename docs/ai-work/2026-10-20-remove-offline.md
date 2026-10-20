# Remove offline earnings ("While you slept")

## Gotowe, gdy

1. Headless: a save with the "last seen" key 8 h in the past, Auto Crank and a placed cannon loads → no `.offline-card`, money equals the saved money, no "slept" text on the page, no exceptions in LOGS.
2. `grep -rni -E "slept|offline" src` → nothing.
3. `npx tsc --noEmit` → exit 0.

## Problem

PP saw the "While you slept — Your machines ate 1.6k gnomes while you slept: +$271k" card over the start menu and decided: "wylacz to zupelnie" (turn offline earnings off completely).

## Summary

- Ladder step 1 (it does not need to exist): the whole module goes. `src/systems/offline.ts` deleted; its wiring removed from `src/main.ts` (boot and the 10 s "last seen" refresh) and `src/core/context.ts`; the "While you slept" section removed from the legend.
- Nothing else used the "last seen" key `gnome-boozed-seen` (grep: only `offline.ts`), so no timestamp is kept. Daily challenge and autosave do not read it.
- Old saves: the save object never held offline fields; the separate `gnome-boozed-seen` key in localStorage is simply never read again. No migration.
- Docs: `docs/SPEC.md` (mechanic, lever line, legend list, section title, decisions) and `CHANGELOG.md` (new bullet; the old lever entry no longer says "no offline pay while OFF", because the changelog is shown in the start menu).

## Rejected

- Clearing the leftover `gnome-boozed-seen` key from players' localStorage: one dead number, never read; a cleanup line would be code kept only for that.

## Work progress

Scenario `zz-rmoff.js` (session scratchpad `smoke/`): the page writes a save (money 12345, Auto Crank 4, lever ON, one cannon) and sets `gnome-boozed-seen` to 8 h ago, then boots a second copy of the game in a same-origin iframe, which reads the same localStorage like a fresh page load.

- Red, before the change: `CDP_PORT=9384 node smoke.mjs rmoff-red zz-rmoff.js` → `{"booted":true,"cards":1,"slept":true,"money":18970.75104,"placed":1,"autocrank":4}`.
- [PASS] 1 — same command after the change → `{"booted":true,"cards":0,"slept":false,"money":12345,"placed":1,"autocrank":4}`, `LOGS:` empty (exceptions and console errors are logged by the harness).
- [PASS] 2 — `grep -rni -E "slept|offline" src` → no output, exit 1. In docs only the new decision (SPEC) and the new changelog bullet name it.
- [PASS] 3 — `npx tsc --noEmit` → exit 0, no output.

Self-check: the diff only deletes (module, wiring, legend section, doc lines) plus the decision and the changelog bullet. `daily` and `realDt` in `main.ts` are still used elsewhere (tsc clean).
