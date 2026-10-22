# UFO beam steals hits, BULLSEYE sticks to the gnome

Gotowe, gdy:
1. endgame-boost E24: thrown gnome caught by the UFO beam and lifted into the UFO → `PASS E24` (hits stay 0, gnome abducted).
2. endgame-boost E25: thrown gnome that hits the UFO without the beam → `PASS E25` (hits +1).
3. small-batch H1: hoop, then the hole within 1 s → `PASS H1` (BULLSEYE big text, `stats.bullseyes` +1).
4. small-batch H2: hoop, lands on the grass, eaten after 3 s → `PASS H2` (no BULLSEYE).
(plus `npx tsc --noEmit -p .` → no output)

## Problem

PP 2026-10-22: "2 blady rzucilem gnomy do ufo i promien ich zabral ale po dojsciu promieniem do gory zniszczyly ufo to nie moze tak dzialac jesli gnomy zostana przejete promieniem nie powinny niszczyc ufo. Dodatkowo jak rzucam przez krag i gnomy spadaja na ziemie i wrzucam je pozniej reka to i tak mam zaliczony bullseye. Powiedzmy ze bullseye powinien dzialac przez 2s po przejsciu przez krag nie dluzej".

- When a thrown gnome flies into the beam, the beam lifts it to the UFO, and on the way up it enters the hit zone (1.6 m under the UFO), so it counts as a hit, because it still carries `thrownBy = 'player'`.
- When a gnome passes the hoop, `g.bullseye` stays true until the next throw, so dropping it in by hand later still pays BULLSEYE.

## Summary

- Ladder: step 2 (reuse). UFO: the beam branch sets `g.thrownBy = null`, the same line the hit branch already uses to stop one gnome scoring twice. BULLSEYE: the hoop stores `g.bullseyeAt = ctx.time` next to the existing flag; `consume` drops the flag when more than 2 s passed. One new field, no new helper.
- Side effect, accepted: a thrown gnome the beam takes is no longer a player throw. If the UFO moves on and the gnome falls into the hole, it pays like a dropped gnome (no trick shot). PP: "jesli gnomy zostana przejete promieniem" = the throw is over.
- Test fixtures that set `bullseye = true` by hand (balance B4, small-batch G12) now also set `bullseyeAt = g.time`.

## Work progress

Dev server: private, `npx vite --port 5229 --host 127.0.0.1 --strictPort --config <scratchpad>/slb/vite.nohmr.config.mjs`, stopped after the runs. Runs: `URL_QUERY='' FAKELOCK=1 MAXPOLL=4000 CDP_PORT=9871 DEV_PORT=5229 node tools/smoke/smoke.mjs <out> tools/smoke/<scenario>.js`.

Red, before the fix (the UFO checks were named E20/E21 in this run, then renamed to E24/E25 because E20-E23 already existed):
- endgame-boost: `FAIL E20 {"hits":1,"abducted":true,"lifted":10.76,"ufoY":12}`: the beamed gnome scored a hit on its way up.
- endgame-boost: `PASS E21 {"before":1,...}`: a direct hit counted.
- small-batch: `PASS H1 {"flag":true,"sinceHoop":0.33,"fallT":0.33,"eaten":true,"bull":true,"stat":1}`.
- small-batch: `FAIL H2 {"flag":true,"sinceHoop":3.35,"fallT":0.33,"eaten":true,"bull":true,"stat":1}`: BULLSEYE paid 3.35 s after the hoop.

Fix:
- `src/systems/events.ts`: the beam branch sets `g.thrownBy = null`, so the hit check (`thrownBy === 'player'`) skips it.
- `src/entities/gnomes.ts`: new field `bullseyeAt`, set to 0 at spawn, copied on a type swap.
- `src/systems/hole.ts`: the hoop sets `bullseyeAt = ctx.time`; `consume` clears `bullseye` when more than 2 s passed, before the trick math, so the text colour and the stats follow it too.

Green, after the fix:
- `npx tsc --noEmit -p .` → exit 0, no output.
- endgame-boost: `PASS E24 {"hits":0,"abducted":true,"lifted":10.77,"ufoY":12}`, `PASS E25 {"before":0,"after":1,"toast":true}`; 25 PASS, 0 FAIL, errors [].
- small-batch: `PASS H1 {... "bull":true,"stat":1}`, `PASS H2 {"flag":true,"sinceHoop":3.35,... "bull":false,"stat":0}`, `PASS G12`; 69 PASS, 0 FAIL, errors [].
- balance (fixture B4 touched): `PASS B4 {"ratioMin":1,"ratioMax":1,"frames":30}`; 42 PASS, 0 FAIL.

Kompletność:
- [PASS] 1. E24 — endgame-boost run → `PASS E24 {"hits":0,"abducted":true,...}`
- [PASS] 2. E25 — endgame-boost run → `PASS E25 {"before":0,"after":1,"toast":true}`
- [PASS] 3. H1 — small-batch run → `PASS H1 {... "sinceHoop":0.33,... "bull":true,"stat":1}`
- [PASS] 4. H2 — small-batch run → `PASS H2 {... "sinceHoop":3.35,... "bull":false,"stat":0}`

Self-check: only the two asked rules changed; one field and three lines in game code; ladder step 2 (reuse `thrownBy = null` from the hit branch and the existing `bullseye` flag). No new helper, no dependency. SPEC (two rule texts, two PP decisions), CHANGELOG `## 2026-10-28 20:00`, BOARD status updated.

Rejected: none.
