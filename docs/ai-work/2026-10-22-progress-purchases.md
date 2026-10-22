# Progress log: purchases with progress

## Problem

PP 2026-10-22: "do statystyk ktore wysylamy dodaj sledzenie co ludzie kupuja wraz z postepami tj na tym levelu mial kupione to i to a na tym mial to i to przyda sie to aby balansowac gre".

Interpretation: the progress log (`public.progress`, `src/systems/progress.ts`) already sends the purchases since the previous row as `{ id, lvl, cost }`. Now every purchase and downgrade also carries the hole level and the money after it, and every row (level-up and end rows) carries a snapshot of everything the player owns at that moment. Orchestrator: no plan round (PP "zrob wszystko z boardu ... tak aby wszystko wypchnac szybciej"), no schema change preferred.

## Gotowe, gdy

1. `scenario-progress.js` yard run → `PASS P2_buy_fields` (each purchase has `hole` = hole level at the buy and `money` = money after, rounded) and `PASS P3_downgrade` (the Strong Arm downgrade entry has lvl 0, hole and money after) and every other check PASS.
2. `scenario-progress.js` yard run → `PASS P2_owned` (the level row's `purchases[0]` is `{ id: 'owned', lvl: 0, cost: 0, owned, placed }` with every non-zero upgrade and Deep level, no zeros, placed machines per type) and `PASS P7_owned` (the rebirth end row has it too).
3. `scenario-progress.js` daily run → all checks PASS; `npx tsc --noEmit -p .` → exit 0.

## Summary

- Every buy entry in `purchases` is now `{ id, lvl, cost, hole, money }`: hole level at the buy, money after it (rounded to a whole dollar). A downgrade is a buy with the lower `lvl` (as before). Shard buys carry the money too (unchanged by the buy).
- Every row (level, rebirth, daily, reset) starts its `purchases` with `{ id: 'owned', lvl: 0, cost: 0, owned: { <id>: <level> }, placed: { <type>: <count> } }`: every non-zero shop and Deep level and the placed machines per type, at the moment the row is written. End rows are written before the run resets (`hole.ts` calls `end('rebirth')` above `freshState`), so the rebirth row shows the finished run.
- Fits the existing column, no schema change, no SQL to run: `purchases` keeps at most 120 entries and 12000 chars (`supabase/progress.sql`). Purchases stay batched into the row as before (no extra rows, the guard limits are untouched). The buy buffer cap went from 120 to 100 (99 buys plus the `more` counter), so the snapshot and the two new fields fit: worst case about 99 x 91 chars + about 1500 chars of snapshot = about 10500 < 12000. A buffer of up to 120 left by an older build is cut to 120 entries with the snapshot (`slice(0, 120)`), so that row is not refused.
- `supabase/check.sh` logic: its progress rows send `[{id, lvl, cost}]`; the table checks only array type, length and text size, so every case still gives the same answer.
- Menu line (settings) already says "purchases": no player-visible change, so no CHANGELOG section.

Ladder: `progress.ts` rung 2 (existing `bought` and `push`, existing `purchases` column, `ctx.machines.list`); `Object.fromEntries` rung 3. README got one query for PP (owned per hole level), because the old text described the purchases column only.

Rejected:
- New `owned` column: an additive column would need the SQL before the deploy; a client sending the field earlier gets 400 and drops every row. The payload fits the existing column.
- Shards after a Deep buy: not asked; the snapshot shows the Deep levels.

Uncertain: no mini-roast ran; the change touches only the row payload, not the outbox queue mechanics, no job, cron, migration or cache.

## Work progress

- Test first: `tools/smoke/scenario-progress.js` extended (P2_buy_fields, P2_owned with one placed fan, P3_downgrade, P7_owned; P2_purchases, P9, D2 expect the `owned` entry first).
- Red (before the code): `DEV_PORT=5207 CDP_PORT=9337 MAXPOLL=2400 FAKELOCK=1 node tools/smoke/smoke.mjs <scratchpad>/prog-red tools/smoke/scenario-progress.js` → `FAIL P2_purchases [["kick",2,"number"],["speed",1,"number"],["fan",1,"number"]]`, FAIL P2_buy_fields, P2_owned, P3_downgrade, P7_owned, P9.
- Green: same command → 18/18 PASS (`P0 P2_shape P2_values P2_purchases P2_buy_fields P2_owned P2_achievements P3 P3_downgrade P4 P5 P6 P7 P7_owned P7b P8 P9 D1`). Daily run with `URL_QUERY='?lowfx&daily='` → `PASS D2_yard_untouched`, `PASS D2_daily_row`, `PASS D2_end`.
- `npx tsc --noEmit -p .` → exit 0, no output.

Self-check (Gotowe, gdy):
- [PASS] 1 — green run: `PASS P2_buy_fields`, `PASS P3_downgrade {"down":{"id":"throw","lvl":0,"cost":23,"hole":3,"money":999999999638},"afterDown":{"hole":3,"money":999999999638}}`, all 18 PASS.
- [PASS] 2 — green run: `PASS P2_owned {"id":"owned","lvl":0,"cost":0,"owned":{"kick":2,"speed":1,"fan":1},"placed":{"fan":1},...}`, `PASS P7_owned`.
- [PASS] 3 — daily run 3/3 PASS; `npx tsc --noEmit -p .` → exit 0.
- Discipline: only `progress.ts` changed in src; outro.ts untouched. Tests go through the shop (`g.shop.buy`) and the hole level-up, with a stubbed fetch, DEV `LocalStore`.

Review fix: an old 120-entry purchase buffer now keeps the trailing 'more' counter (118 buys + merged 'more', row <= 120); Deep purchases log shards left instead of money. Test: scenario-progress P3_deep_shards, P10_legacy_cap, 20/20 PASS.
