# Changelog in the start menu (2026-10-20)

PP: "do menu startowego dodaj mi changelog z jakiegos pliku w ktorym dopiszesz co jest w danym buildzie dla mnie zebym wiedzial co testowac". Trivial change (orchestrator): one UI file plus its style. `CHANGELOG.md` was written by the orchestrator; its content is not changed here.

## Gotowe, gdy

1. Click "What's new" on the title card → panel visible, contains the first `##` date and "Up to 12 cleaning robots"; the escape function turns `<script>` in a bullet into text.
2. Back → title card again; Start still starts the game.
3. Screenshot at 640x360 checked by eye: no overflow.
4. `npx tsc --noEmit` → exit 0; `npx vite build --outDir <scratchpad>` succeeds.

## Problem

PP needs to see, inside each build, what changed and what to test.

## Summary

- `src/ui/menu.ts`: `CHANGELOG.md` imported with Vite `?raw` (bundled, so each build carries its own list). "What's new (<newest date>)" button on the title and pause cards opens a scrollable panel in the menu card; Back uses the existing `back` action. `changelogHtml()` escapes HTML first, then renders `## ` headings, `- ` bullets and `` `code` ``; the `# Changelog` title is skipped, other lines become paragraphs.
- `src/ui/style.css`: `.changelog` panel with `max-height` in `vh`, so it scrolls instead of the menu.
- Ladder: step 3/4. `?raw` is a Vite feature, typed by `vite/client` (no `declare module` needed); no Markdown dependency, the subset is a few lines.

## Work progress

Scenario: `scratchpad/smoke/scenario-changelog.js`, run `FULL=1 DPR=1 CDP_PORT=9383 MAXPOLL=300 node smoke.mjs <out> scenario-changelog.js`.

- [PASS] 1 — button text `What's new (2026-10-20 12:20)`; panel `visible: true`, `firstH3: "2026-10-20 12:20"`, `has12: true`, `codeTags: 1`; `changelogHtml('- a <script>alert(1)</script> ...')` → `<li>a &lt;script&gt;alert(1)&lt;/script&gt; ...`.
- [PASS] 2 — Back → `logo: "GNOMEBOOZED"`, `play: "START HUSTLING"`; Start → `menuHidden: true, paused: false, locked: true`.
- [PASS] 3 — 640x360: `menuOverflow: false`, card 304 px of 360, `panelScrolls: true`; screenshot `cl-02-panel.png` checked by eye (panel scrolls, Back visible).
- [PASS] 4 — `npx tsc --noEmit` → `tsc=0`; `npx vite build --outDir scratchpad/cl-build` → `✓ built in 247ms`, changelog text found in the bundle.

Self-check: only the button, the panel, the render function and styles; Back reuses the existing `back` action, Esc logic untouched. The title card itself still scrolls at 640x360, as before this change.

Rejected: none.

