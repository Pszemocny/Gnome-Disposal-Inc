# Plan: small batch (crate XP, magnet mass, mushroom drops, Massive upgrade, Midas look, Day/Night mushroom, Coin Magnet 10)

Spec: PP, terminal 2026-10-24, verbatim (BOARD.md:74 "Kolejka po drzewku"):
1. "tak pelne xp dl skrzyni i tak malo kto bedzie jej uzywac"
2. "jak mamy magnes to wszystkie gnomy na magnesie traktujemy jakby mialy te sama wage (tak zeby lecialy tak samo) bierzemy wage najciezszego"
3. "jak wrzucam zlote gnomy to powstaje masa grzybkow ... powinno to zalezec od ilosci wrzuconych gnomow a nie od ich ceny"
4. "daj upgrade fat first albo cos milszego ktory pozwala zrownac np w 5 poziomow ta wage ze wszystkie wychodza jako massive czyli zwiekszamy ich procentowa szanse do 100%" + "nie" (no off switch)
5. "gold rush i midas powinny zmieniac krasnale w zlote blyszczace"
6. "Dodaj grzybek day'night ktory robi x2 ale miga noc dzien noc dzien" + "nie" (no reduce-flashing option)
7. "niech to automatyczne zbieranie bedzie ostatnim 10 upgradem magnesu do coinow ktory bedzie bardzo drogi np 100k"

Trivial check: seven items over 12 production files; the XP line, the tier roll (seeded daily RNG), the throw impulse, the gnome shader, the sky cycle, the coin pickup branch and a save migration are all data paths.
Base: `main` at 0d39829. In flight: robot stations (`machines.ts` `initRobot`/`fuseBase`/`update`/`remove`, `player.ts` placement ghost :876-983). This plan touches `machines.ts:811` (crate dump) and `player.ts:241-256` / `:671-692` (throw): same files, different functions, no shared lines; merge by hand.

## Plan v0 (plan-author)

### Goal
A crate dump pays full XP, a Magnet Gun ball flies as one body, mushroom drops do not favour golden gnomes, a 5-level Factory upgrade makes every factory gnome Massive, Midas gnomes shine gold, a new mushroom doubles money while the sky flips day/night slowly, and Coin Magnet 10 (about $90k) replaces the Piggy Bank.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| A1 | crate with 2 hand-thrown gnomes (hunger 0) | crate dumped into the hole | XP +1 per gnome (feed x1); money as today; no trick multipliers (as today) | spec 1; `hole.ts:153` |
| A2 | crate holding gnomes that a fan blew in or a Magnet Gun ball threw in (`thrownBy 'machine'` / `xpGroup.n` 20) | dump | XP x1 each too: the crate flag wins over `thrownBy` and `xpGroup` | spec 1 ("pelne xp dla skrzyni") |
| A3 `spec silent` | crate tipped over next to the rim, gnomes roll in | eaten by the hole | stays x0.25 (`release()` marks them machine-fed, as 2026-10-21 decision 12) | `gnomes.ts:363`, balance-batch note |
| A4 | vacuum / black hole / robot tip | eaten | stays x0.25 (`machine === true`) | `machines.ts:1016`, `robots.ts:669` |
| B1 | Magnet Gun ball of 1.2 / 2 / 3 kg gnomes | RMB throw | every gnome gets impulse `J * m_i / m_max`, so launch speed = J / 3 for all (within the 0.06 spread); the ball lands as one clump | spec 2 |
| B2 | ball of only 1.2 kg gnomes | RMB | unchanged: speed J / 1.2 (m_i / m_max = 1) | spec 2 |
| B3 | one gnome in hand (no gun) | RMB | unchanged: J / m (one member, ratio 1) | `player.ts:671` |
| B4 | Trick Scope on a mixed ball | aim | the predicted arc uses m_max (today 1.2), so the landing ring matches B1 | `player.ts:241` |
| B5 | King | magnet | never on the magnet (`grabbable` excludes king) and never in a ball: no handling needed; a King is never the "heaviest member" | `player.ts:781` |
| B6 | Fat gnome in the ball (type mass 6, tier mass 2 or 3) | RMB | m_max reads `body.mass()` (tier mass), so 3 kg at most | `gnomes.ts:214` |
| B7 | ball, LMB released (no throw) | drop | unchanged: no impulse | `player.ts:663` |
| B8 `spec silent` | ball held, player turns fast | slip rule | unchanged: heavy gnomes still slip by their own mass (spec talks about flight only) | `player.ts:765-769` |
| C1 | golden gnome eaten | mushroom roll | bonus x1 (was x4): same chance as a classic | spec 3; `hole.ts:159` |
| C2 | wizard eaten | mushroom roll | x6 unchanged (casting is his trait, not his price; orchestrator decision in BOARD) | BOARD.md:74 |
| C3 | Golden Hour: 50 retyped golden gnomes eaten | mushroom rolls | each x1, so about 2.5 % per gnome (x Spore Bag) | spec 3 |
| D1 | upgrade `frenzy` level 0 | factory spawn | `rollTier` odds exactly as today at every hole level; one `rnd()` call per roll (daily seed unchanged) | `gnomeTypes.ts:121`, `factory.ts:207` |
| D2 | level L = 1..4 | factory spawn | massive chance `pm + (1 - pm) * L / 5` (pm = today's massive odds); heavy odds unchanged unless they no longer fit, then `1 - massive` | spec 4 |
| D3 | level 5 | factory spawn (crank, Auto Crank, Bigger Batches, Chaos burst: all through `Factory.spawnNow`) | every gnome Massive: 3 kg, scale x1.25, value x2.3 | spec 4 |
| D4 | level 5, Fat gnome (min tier heavy) | spawn | Massive | spec 4 |
| D5 | King | spawn | never tiered (unchanged) | `gnomes.ts:213` |
| D6 `spec silent` | rain / parade gnome (`gnomes.spawn` default roll) at level 5 | spawn | Massive too (same `rollTier`, one function) | `gnomes.ts:213`, `events.ts:79` |
| D7 | Golden Hour retype | swap | keeps the gnome's tier (unchanged) | `gnomes.ts:274` |
| D8 | shop, Factory tab | render | node "Feeding Frenzy" (working name), hole 4, no parent, 5 levels, prices $2,000 / 4,400 / 9,681 / 21,297 / 46,852 (cost 2000, growth 2.2, no late surcharge below the 6th level), effect line "N % massive, next: M %" from the real odds at the current hole level | spec 4; `upgrades.ts` |
| D9 | old save without the key | boot | level 0, no migration, no note | `context.ts:103` |
| D10 `spec silent` | level >= 1, any Massive gnome eaten | HEAVY HAUL | `hauls` stat and the contract keep counting; the big "HEAVY HAUL" text and its sound are skipped while `lvl('frenzy') > 0` (at level 5 it would fire on every gnome) | `hole.ts:134`, `:208` |
| E1 | Midas eaten (`midasLeft` 15) | next frames | every drawn gnome shines gold: one shared uniform `gold` ramps 0 -> 1 in about 0.25 s (damp 12): diffuse mixed 70 % toward gold, emissive +gold, roughness -> 0.3, metalness -> 0.6; 0 extra draw calls | spec 5 |
| E2 | `midasLeft` reaches 0 | next frames | uniform ramps back to 0 in about 0.25 s | rule 3 |
| E3 | Rainbow (`midasLeft += 15`) | same as E1 | `buffs.ts:41` |
| E4 `spec silent` | Low quality | Midas | gold look applies on every quality (a uniform costs nothing; the Low rule exists for the night look only) | `environment.ts:463` |
| E5 `spec silent` | golden-type gnome (natural, Gold Fever, Golden Hour) | always | its material is shiny for good: `vcMat({ metalness: 0.6, roughness: 0.35, emissive: 0x332200 })`; "gold rush" read as Golden Hour (already turns gnomes golden, `events.ts:146`) | spec 5 |
| E6 | Midas during Golden Hour | draw | golden type already shiny; the uniform adds its tint on top; no error, no second material | E1 + E5 |
| F1 | new mushroom `daynight` ("Eclipse Cap", cap 0x1c1c4a, spots 0xfff3b0, duration 20 s, weight 10) walked over | apply | toast, `valueMult` x2 while active, EFFECTS row with seconds (automatic via `buffs.list()`), legend card automatic | spec 6 |
| F2 | `daynight` active | sky | `nightShade` target flips 0 <-> 1 every `FLIP_T = 1.5` s of game time (`Math.floor(ctx.time / 1.5) % 2`), damped with lambda 6 (95 % in 0.5 s); stars, fog, sun, lamp, fireflies and hat glow follow as today | spec 6; WCAG < 3 flashes/s |
| F3 | effect ends | sky | the shade damps back to the clock's night value (same lambda 6), the 240 s clock never stopped | `environment.ts:456` |
| F4 `spec silent` | hole level < 6 (no cycle yet) | `daynight` | the sky flips anyway (override is independent of the clock) | spec 6 "miga noc dzien" |
| F5 `spec silent` | Low quality | `daynight` | money x2, sky stays day (`nightShade` 0 on Low, SPEC:210 rule kept) | `environment.ts:463` |
| F6 `spec silent` | level >= 6, `daynight` active, clock says day | visitors | no Shadow visitor and no `visitor` event from the flicker: `isNight` keeps reading the clock value `night`, the flicker lives in the new `shade` field | `environment.ts:491`, `events.ts:28,65` |
| F7 `spec silent` | Rainbow active | `daynight` | included (`active()` returns true for every id under rainbow): x2 and the flicker, no code | `buffs.ts:29` |
| F8 | mushroom picked twice | timer | durations add (existing `timers` rule), flicker continues | `buffs.ts:35` |
| F9 | 10 s of the effect sampled every frame | sign changes of `nightShade` velocity | at most 7 direction changes in 10 s (one per 1.5 s, plus the start); never two within 1.4 s | photosensitivity |
| G1 | Coin Magnet row | shop | max 10, cost 20, growth 2.2: $20, 44, 97, 213, 469, 1,340, 3,833, 10,961, 31,347, 89,651 (late surcharge from the 6th); desc "+1.2 m coin pickup radius. Level 10: coins fly into your bank by themselves and greedy gnomes cannot steal them." | spec 7 |
| G2 | Coin Magnet 10 owned | coins | a coin flies to the bank after 1.6 s on the grass (today's `piggy` branch), `nearestFree` returns null (greedy cannot steal) | `coins.ts:124,155,192` |
| G3 | Coin Magnet < 10 | coins | radius 2 + 1.2 L (level 9: 12.8 m), greedy can steal; no auto-collect | `coins.ts:70` |
| G4 | Piggy Bank | shop, icons, legend | row removed from `UPGRADES` and `ICONS`; no node in Bonuses; legend table without it | spec 7 |
| G5 | old save `upgrades.piggy = 1` | boot | key deleted, $800 refunded, note "The Piggy Bank was removed: $800 refunded. Coin Magnet level 10 now collects coins by itself." (default a, Open decision 1) | `state.ts:124-135` pattern |
| G6 | old save `magnetRange = 6` | boot | stays 6 (no clamp: 6 <= 10), next price $3,833, no auto-collect until 10 | `main.ts:50` |
| G7 | shop hover Coin Magnet at 9 / 10 | effect line | "12.8 m pickup, next: coins fly to the bank" / "coins fly to the bank" | `shop.ts:105` |

### Reach
- `Hole.consume(g, at?, machine)` `hole.ts:89`: callers `gnomes.ts:506` (walk-in, no flag), `machines.ts:811` (crate dump, true -> `'crate'`), `machines.ts:1016` (vacuum / black hole, true), `robots.ts:669` (true). `FEED_XP` readers: `hole.ts:153` only. Texts naming the crate quarter: `legend.ts:235`, SPEC:11, SPEC:20, CHANGELOG:21, `tools/smoke/scenario-balance.js:548` (C8 expects 0.5 -> 2) and `:555` (C15 stays 0.5).
- `mushrooms.maybeDrop(pos, bonus)` `mushrooms.ts:46`: one caller `hole.ts:159`.
- `rollTier(holeLevel, minId, rnd)` `gnomeTypes.ts:121`: callers `gnomes.ts:213` (spawn default: rain `events.ts:79`, shadow :261, retype passes tier), `factory.ts:207` (seeded `rng.spawn`, daily challenge and replay). `WEIGHT_TIERS` readers unchanged. `heavies`/`hauls` stats: `hole.ts:134-137`; HEAVY HAUL contract `contracts.ts`.
- `throwHeld` `player.ts:671`: impulse per gnome; `predict(start, bv, m)` `player.ts:281` gets `m` from `updateAids` `:241-256`. `g.body.mass()` readers unchanged (`pull` :702, slip :765, kick :842 fixed 1.2, fan :902, shockwave `hole.ts:371`).
- Gnome materials `gnomes.ts:148-161`: `NIGHT` uniform pattern; `vcMat` `models.ts:54`; `customProgramCacheKey 'gnome-hatglow'` shared by all gnome materials (new uniform goes into the same program). `midasLeft` writers `buffs.ts:41,51`; readers `hud.ts:431`, `coins.ts:154` (x1.5 reach), new `gnomes.update`.
- `MUSHROOMS` `buffs.ts:12`: readers `mushrooms.ts:41` (geometry per def), `pickDef` :73 (weights total 100 -> 110), `legend.ts:182` (cards + shares), `hud` via `buffs.list()`. `valueMult` `buffs.ts:47`: one caller `hole.ts:152`.
- `Environment.update` `environment.ts:455-464`: writers of `night`/`nightShade`: this block only. Readers: `isNight` :491 (`events.ts:28,65`), `gnomes.ts:823` (hat glow uniform), sky/fog/sun/lamp/stars/fireflies :465-486.
- `lvl('piggy')` readers: `coins.ts:124,155`; `ICONS.piggy` `icons.ts:17`; row `upgrades.ts:102`; texts SPEC:12,180, PLAN.md:89. `lvl('magnetRange')` readers: `coins.ts:70`, `shop.ts:105`. Writers of `state.upgrades`: `shop.ts:231` (buy), `state.ts:124-143` (migrations), `hole.ts:534` (rebirth keeps `KEEP_TOOL_IDS` only: neither row is kept, as today), `main.ts:49-50` (clamp to `max`).
- Front contract: none (single-page game, `localStorage` save). Save keys touched: `upgrades.piggy` (removed), `upgrades.magnetRange` (max 6 -> 10), `upgrades.frenzy` (new, absent = 0).

### Data
- No database. Save: `localStorage` key `gnome-boozed-save-v1`, three upgrade keys above; one migration branch (`state.ts`).
- Volume: yard <= 320 gnomes (`permit` 5), Magnet Gun ball <= 145 gnomes (SPEC:74), coins <= 320 (`CAP`). Cost: B1 one extra `reduce` over the thrown list per throw (<= 145 reads of `mass()`); E1 one float uniform per frame, 0 draw calls (no new material, no light); F2 one `damp` per frame; D1-D3 same single `rnd()` per roll; G2 same branch as today. Nothing per gnome per frame is added.

### Steps (edit order)
1. `src/data/gnomeTypes.ts` — `export function massiveOdds(holeLevel: number, frenzy = 0): number { const pm = Math.max(0, Math.min(0.25, 0.03 * (holeLevel - 3))); return pm + (1 - pm) * frenzy / 5; }`; `rollTier(holeLevel, minId = 'normal', rnd = Math.random, frenzy = 0)`: odds list becomes `[['massive', massiveOdds(holeLevel, frenzy)], ['heavy', Math.min(0.3, 0.05 + 0.025 * L)]]` (massive first so 100 % wins; marginals unchanged at frenzy 0 because `r -= p` keeps the same shares); comment "5 levels close the gap to 100 % Massive by a fifth each (PP 2026-10-24)". Test: D1, D2, D3, D4.
2. `src/data/upgrades.ts` — Factory: `U('frenzy', 'Factory', 'Feeding Frenzy', 'Every level makes the factory turn out more Massive gnomes (3 kg, x2.3 money); level 5: all of them.', 5, 2000, 2.2, 4)` after `glue`; Movement: `U('magnetRange', 'Movement', 'Coin Magnet', '+1.2 m coin pickup radius. Level 10: coins fly into your bank by themselves and greedy gnomes cannot steal them.', 10, 20, 2.2)`; delete the `piggy` row; comment on the Coin Magnet row: "level 10 is the old Piggy Bank, about $90k (PP 2026-10-24 'bardzo drogi np 100k')". Test: D8, G1, G4.
3. `src/entities/factory.ts:207` and `src/entities/gnomes.ts:213` — pass `lvl('frenzy')` as the 4th argument (`gnomes.ts` already imports `lvl`; `factory.ts` imports it from `../core/context`). Test: D3, D6.
4. `src/systems/hole.ts` — `consume(g, at?, machine: boolean | 'crate' = false)`; comment line 88: "`'crate'`: a crate dump pays full XP (PP 2026-10-24), `true`: vacuum, black hole, robot"; line 153: `const feed = g.type.id === 'king' || machine === 'crate' ? 1 : machine || g.thrownBy !== 'player' ? FEED_XP : 1 / Math.sqrt(g.xpGroup?.n ?? 1);`; line 159: `g.type.id === 'wizard' ? 6 : 1` (drop the golden x4; comment: "drops follow the count of gnomes, not their price (PP 2026-10-24)"); line 134: `if (g.tier.id === 'massive') { s.stats.hauls++; if (!lvl('frenzy')) tricks.push('HEAVY HAUL'); }` (stat first; today `hauls++` sits after the push). `FEED_XP` comment: remove "crate". Test: A1-A4, C1-C3, D10.
5. `src/entities/machines.ts:811` — `ctx.hole.consume(g, undefined, 'crate');` comment above: "full XP for a crate dump (PP 2026-10-24)". Test: A1, A2.
6. `src/player/player.ts` — `throwHeld` (:671): `const mMax = thrown.reduce((a, g) => Math.max(a, g.body.mass()), 0);` and inside the loop `.multiplyScalar(J * g.body.mass() / mMax)`; comment replaces line 670: "The ball flies as one body: every gnome gets J scaled by its mass over the heaviest member's, so all leave at J / m_max (PP 2026-10-24); one gnome in hand is J / m as before." `updateAids` (:241): `let m = 1.2;` -> in the swarm branch `m = sw.reduce((a, s) => Math.max(a, s.g.body.mass()), 0);` (keep 1.2 only as the initial value). Test: B1-B4, B6.
7. `src/systems/buffs.ts` — row after `booze`: `{ id: 'daynight', name: 'Eclipse Cap', cap: 0x1c1c4a, spots: 0xfff3b0, duration: 20, desc: 'x2 money, the sky flips day and night', weight: 10 }` (before `rainbow`, so the legend keeps rainbow last); `valueMult`: `if (this.active('daynight')) m *= 2;`. Test: F1, F7, F8.
8. `src/world/environment.ts` — new field `shade = 0; // the night the sky shows: the clock, or the Eclipse Cap flicker` and `const FLIP_T = 1.5; // s between sky flips under the Eclipse Cap: slow enough for photosensitive players (WCAG: under 3 flashes per second), PP 2026-10-24 "nie" to a reduce-flashing option`; in `update` after `this.night = damp(...)`: `const flip = ctx.buffs.active('daynight'); this.shade = THREE.MathUtils.damp(this.shade, flip ? Math.floor(ctx.time / FLIP_T) % 2 : this.night, 6, dt); this.nightShade = lowfx || prefs.quality === 'low' ? 0 : this.shade;`. `isNight` untouched. Test: F2-F6, F9.
9. `src/entities/gnomes.ts` — `const GOLD = { value: 0 }; // Midas: every gnome shines gold (PP 2026-10-24)`; constructor: `const mat = vcMat(t.id === 'golden' ? { metalness: 0.6, roughness: 0.35, emissive: 0x332200 } : t.emissiveEyes ? { emissive: 0x111111 } : {});`; `onBeforeCompile`: `s.uniforms.gold = GOLD;`, fragment `uniform float gold;` next to `night`, after `#include <color_fragment>`: `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.25), 0.7 * gold);`, after `#include <roughnessmap_fragment>`: `roughnessFactor = mix(roughnessFactor, 0.3, gold);`, after `#include <metalnessmap_fragment>`: `metalnessFactor = mix(metalnessFactor, 0.6, gold);`, emissive line: `totalEmissiveRadiance += hatGlow * (vGlow * night) + vec3(0.45, 0.3, 0.06) * gold;`; `customProgramCacheKey` -> `'gnome-hatglow-gold'`; in `update(dt)`: `GOLD.value = THREE.MathUtils.damp(GOLD.value, ctx.buffs.midasLeft > 0 ? 1 : 0, 12, dt);`. Test: E1-E6.
10. `src/entities/coins.ts` — `get autoCollect(): boolean { return lvl('magnetRange') >= UPGRADE_BY_ID.magnetRange.max; } // the last Coin Magnet level is the old Piggy Bank (PP 2026-10-24)`; `:124` `if (this.autoCollect) return null;`; `:155` `const piggy = this.autoCollect;` (rename the local to `auto`); import `UPGRADE_BY_ID` from `../data/upgrades`. Test: G2, G3.
11. `src/core/state.ts` — after the broom block: `if (parsed.upgrades?.piggy) { delete parsed.upgrades.piggy; parsed.money = (parsed.money ?? 0) + 800; loadNotes.push('The Piggy Bank was removed: $800 refunded. Coin Magnet level 10 now collects coins by itself.'); }` comment "the Piggy Bank became Coin Magnet level 10 (PP 2026-10-24)". Test: G5.
12. `src/ui/shop.ts:105` — `magnetRange: (L) => (L >= UPGRADE_BY_ID.magnetRange.max ? 'coins fly to the bank' : \`${(2 + L * 1.2).toFixed(1)} m pickup\`)`; add `frenzy: (L) => \`${Math.round(100 * massiveOdds(ctx.state.holeLevel, L))}% massive\`` (import `massiveOdds`). `src/ui/icons.ts:17`: remove `piggy: '🐷'`, add `frenzy: '🍖'`. Test: D8, G7.
13. Texts — `src/ui/legend.ts:235` ("a machine, robot, plow, blower or kick pays a quarter; a crate dump pays in full"); `docs/SPEC.md` lines 11, 12, 20 (crate), 52 (Feeding Frenzy sentence), 54/51 (golden shine), 74 (ball flies as one body), 178 (Coin Magnet 10), 180 (Piggy Bank gone), 211 (Eclipse Cap, Midas look), plus one decision line per item with "why" (CLAUDE.md "Task board as the game spec"); `docs/PLAN.md:84,89,95`; `CHANGELOG.md` new top section (memory rule); BOARD.md status (local). `docs/ai-work/2026-10-25-small-batch.md` (Problem / Summary / Work progress).
14. Tests — new `tools/smoke/scenario-small-batch.js` (sections A-G below); `tools/smoke/scenario-balance.js:548` C8 expected `near(x.crate2, 2)` (two gnomes x1; one-line reason in the note), C15 unchanged (0.5).

### Tests
Headless, dev server `npx vite --port 5199 --host 127.0.0.1`, `node tools/smoke/smoke.mjs <out> tools/smoke/scenario-small-batch.js`; every section sets state through `window.gnome` and reads back DB-like state (`state.holeXp`, `state.money`, `state.upgrades`, body velocities, uniforms).
- A1/A2: 2 classic normal gnomes (one hand-thrown from 15 m, one with `thrownBy = 'machine'` and `xpGroup = { n: 20 }`) stashed into a crate, crate moved over the hole; assert `holeXp` +2.0, money equals the pre-change value for the same dump (today's C8 money), no SNIPER text. A3: crate tipped at the rim with 2 gnomes, assert +0.5. A4: vacuum eats a gnome, assert +0.25.
- B1: ball of 3 gnomes (1.2 / 2 / 3 kg) via the batch grab, RMB; read `linvel` lengths next frame: all within 10 % of each other and of J / 3. B2: three 1.2 kg: speed J / 1.2 as today (compare with `scenario-balance` C2 setup). B3: hand throw of a 3 kg gnome: J / 3 as today. B4: Trick Scope 3 with the mixed ball: `player.landed` ring position within 1 m of where the slowest-gnome sim lands (read `aim` end vs real landing). B6: fat gnome tier massive in the ball: m_max 3. B7: release: velocities unchanged frame to frame (no impulse). B8: slip counts at Coil 2 after a 180° turn: 3 kg still slip more than 1.2 kg (as magnet-ball note line 4).
- C1-C3: stub `Math.random` to a fixed sequence, eat 200 golden and 200 classic: drop counts equal (±0); wizard 6x the classic count.
- D1: `rollTier(12, 'normal', seq, 0)` on a 10,000-draw fixed sequence gives the same tier histogram as the old function (record the old histogram in the note before editing). D2: level 3 at hole 4: massive share within 1 % of `0.03 + 0.97 * 0.6`. D3: level 5, 50 factory gnomes (crank, Auto Crank, Bigger Batches 2, Chaos burst): 50 massive. D4: fat at level 5: massive. D5: King: normal tier, mass 40. D6: rain at level 5: every rain gnome massive. D7: Golden Hour retype of a heavy gnome: heavy. D8: shop DOM: node present, hole 4, prices list, effect text at hole 4 L0 "3% massive". D9: load a save JSON without `frenzy`: `lvl('frenzy')` 0, no load note. D10: level 1, eat a massive gnome: `hauls` +1, no bigText "HEAVY HAUL"; level 0: text shown.
- E1: eat Midas, sample `GOLD.value` (expose via `ctx.gnomes.goldShade` getter) over 20 frames: strictly rising, 0.95 by 0.3 s; screenshot at the peak checked by eye. E2: set `midasLeft = 0`, value falls below 0.05 within 0.4 s. E3: rainbow: value rises. E4: `?quality=low`: value rises too. E5: golden mesh material `metalness 0.6`. E6: Midas during Golden Hour: `LOGS:` empty, frame renders.
- F1: walk over an Eclipse Cap: `buffs.active('daynight')`, `valueMult()` 2, EFFECTS row text "Eclipse Cap", legend card present with the share `pct(10/110)` = 9 %. F2/F9: sample `env.nightShade` every frame for 10 s: at least 6 full swings (min < 0.1, max > 0.9), direction changes <= 7, no two changes within 1.4 s. F3: after the timer ends: shade within 0.05 of `env.night` after 1 s. F4: hole level 1: swings happen. F5: Low: `nightShade` stays 0, money x2. F6: level 6, clock day, 20 s of flicker with `Math.random` stubbed to 0: no shadow gnome spawned, `isNight` false. F7: rainbow: `active('daynight')` true. F8: two caps: `timers.get('daynight')` about 40.
- G1: shop DOM: Coin Magnet prices for levels 1-10 equal the list; no Piggy Bank node. G2: level 10, coin on grass 2 s: `coins.list` empty, money +value; greedy `nearestFree` null. G3: level 9: coin 20 m away stays 10 s; greedy steals. G4: `UPGRADE_BY_ID.piggy` undefined, `ICONS.piggy` undefined. G5: iframe boot with `upgrades.piggy = 1`, money 100: money 900, `upgrades.piggy` undefined, load note text. G6: boot with `magnetRange = 6`: stays 6, next price $3,833. G7: hover text at 9 and 10.
- All: `npx tsc --noEmit` exit 0; `scenario-balance.js` 42/42 with C8 at 2.

### Done when
- A1 `node tools/smoke/smoke.mjs <out> tools/smoke/scenario-small-batch.js` → `PASS A1 xp 2 money <same as before>`
- A2 → `PASS A2 xp 2` (machine-marked and xpGroup 20 gnomes in the crate)
- A3 → `PASS A3 xp 0.5`
- A4 → `PASS A4 xp 0.25`
- B1 → `PASS B1 speeds [v1,v2,v3] spread <10% of J/3`
- B2 → `PASS B2 J/1.2`
- B3 → `PASS B3 J/3 hand`
- B4 → `PASS B4 ring within 1 m`
- B5 `rg -n "g.type.id !== 'king'" src/player/player.ts` → line in `grabbable` present (no change)
- B6 → `PASS B6 mMax 3`
- B7 → `PASS B7 release no impulse`
- B8 → `PASS B8 slip 3kg > 1.2kg`
- C1 → `PASS C1 golden drops == classic drops`
- C2 → `PASS C2 wizard 6x`
- C3 → `PASS C3 goldenHour per-gnome 0.025`
- D1 → `PASS D1 histogram equal` (and `rg -c "rnd()" src/data/gnomeTypes.ts` → 1)
- D2 → `PASS D2 massive 0.612 ±0.01`
- D3 → `PASS D3 50/50 massive`
- D4 → `PASS D4 fat massive`
- D5 → `PASS D5 king normal 40kg`
- D6 → `PASS D6 rain massive`
- D7 → `PASS D7 retype keeps heavy`
- D8 → `PASS D8 prices 2000,4400,9681,21297,46852 hole 4 effect "3% massive"`
- D9 → `PASS D9 frenzy 0 notes 0`
- D10 → `PASS D10 hauls+1 noText(L1) text(L0)`
- E1 → `PASS E1 gold 0→0.95 in 0.3 s` + screenshot `<out>/midas-peak.png` checked by eye
- E2 → `PASS E2 gold <0.05 in 0.4 s`
- E3 → `PASS E3 rainbow gold rises`
- E4 → `PASS E4 low quality gold rises`
- E5 → `PASS E5 golden metalness 0.6`
- E6 → `PASS E6 LOGS empty`
- F1 → `PASS F1 active valueMult 2 row "Eclipse Cap" legend 9%`
- F2 → `PASS F2 swings >=6`
- F3 → `PASS F3 shade≈night after end`
- F4 → `PASS F4 level 1 swings`
- F5 → `PASS F5 low shade 0 mult 2`
- F6 → `PASS F6 no visitor isNight false`
- F7 → `PASS F7 rainbow includes`
- F8 → `PASS F8 timer ≈40`
- F9 → `PASS F9 changes<=7 minGap>=1.4`
- G1 → `PASS G1 prices 20,44,97,213,469,1340,3833,10961,31347,89651 noPiggyNode`
- G2 → `PASS G2 auto-collect, nearestFree null`
- G3 → `PASS G3 level 9 no auto, steal ok`
- G4 `rg -n "piggy" src` → 0 lines
- G5 → `PASS G5 money 900 note "Piggy Bank was removed"`
- G6 → `PASS G6 magnetRange 6 next $3,833`
- G7 → `PASS G7 "12.8 m pickup" / "coins fly to the bank"`
- All: `npx tsc --noEmit` → exit 0; `scenario-balance.js` → `PASS C8 2 ...`, 42/42

### Assumptions (numbered)
1. "gold rush" = Golden Hour (no event, mushroom or upgrade named Gold Rush exists; `events.ts:18`, `buffs.ts:17`, `upgrades.ts:101`).
2. "Shiny" = material shine (metalness/roughness/emissive through one uniform), not particles per gnome: a sparkle burst on 300 gnomes would cost draw time for nothing visible from far.
3. Midas marks every gnome in the yard while `midasLeft > 0`: the next 15 eaten cannot be known in advance.
4. Coin Magnet 10 at $89,651 counts as "np 100k"; cost 20 keeps level 1 at today's $20; levels 2-5 get steeper (today $30-$102, now $44-$469).
5. Feeding Frenzy: hole 4 (Massive exists from level 4, SPEC:52), no parent, $2,000 x2.2 (total $84k, between Auto Crank's first 5 levels $7.9k and Coin Magnet 10). Name is a working name.
6. Eclipse Cap weight 10 of 110 (9 %), 20 s like Chaos; cap colours midnight blue with moon-white spots.
7. The flicker anchors on `ctx.time`, so every flip is exactly 1.5 s apart; the pickup itself can add one change (worst case two changes in 1.5 s = 1.3 per second, still under the WCAG 3 per second).
8. No decision in `docs/ai-work` older than 60 days exists (oldest file 2026-10-19), so no "[decision age]" entry.

### Alternatives rejected
- (a) Magnet: set every ball member's Rapier mass to m_max while held (`setAdditionalMass`), rejected: it changes the pull spring, slip rule and landings, and needs a reset on every drop path (slip, release, throw, hole).
- (b) Crate XP: set `thrownBy = 'player'` on dumped gnomes, rejected: `thrownBy` also gates tricks (`hole.ts:97`) and the volley cap.
- (c) Coin Magnet: keep growth 1.5 and a flat special price for level 10, rejected: `Upgrade` has one cost/growth pair; a special case is a new branch in `upgradeCost` for one row.
- (d) Feeding Frenzy as a chance only in `factory.ts` (rain stays random), rejected: two roll paths with different odds, and the player cannot tell a rain gnome from a factory one; one function keeps the seeded `rnd()` count.
- (e) Day/night flicker by switching the 240 s clock, rejected: it would move the clock and spawn visitors; a separate `shade` leaves the clock and `isNight` alone.
- (f) Midas: retype gnomes to the golden type for the look, rejected: `retype` replaces bodies (320 gnomes), changes value x100 and needs turn-back bookkeeping like Golden Hour.

### Ladder
- `massiveOdds` (new function, rung 6): the shop "now / next" line (SPEC:176) and `rollTier` need the same number.
- `rollTier` 4th parameter (rung 6): spec 4, "zwiekszamy ich procentowa szanse do 100%".
- `consume` `'crate'` value (rung 5, one literal widening of an existing parameter): spec 1.
- `throwHeld` mass ratio (rung 5, one expression): spec 2.
- `GOLD` uniform (rung 2, copies the `NIGHT` pattern): spec 5; golden material options (rung 2, `vcMat` options): spec 5 "blyszczace".
- `daynight` row and `valueMult` line (rung 2, copies `booze`): spec 6; `shade` field and `FLIP_T` (rung 6): spec 6 flicker plus the photosensitivity limit (not cut: accessibility).
- `autoCollect` getter (rung 5): spec 7; `piggy` migration (rung 2, copies the Wind-up block): old saves.
- Cut (rung 1): a per-gnome sparkle, a "reduce flashing" option (PP "nie"), an off switch for the Massive upgrade (PP "nie"), a HUD line for the ball's shared mass, a new mushroom model.

### Open decisions (for PP)
PP (Slack #gnome 2026-10-21 11:46, via hub, verbatim): "Tak wszystko się zgadza" → 1a (Piggy Bank removed with an 800 refund, coins fly by themselves only with Coin Magnet 10), 2a (Feeding Frenzy 2000 x2.2, 5 levels, from hole 4), and the "accepted without asking" items. The Frenzy throw-range / XP x2.3 consequence was found after this answer and still goes to PP as one question.
1. Old saves that own the Piggy Bank ($800): a) delete it and refund $800, the player buys Coin Magnet up to 10 later (coins stop flying by themselves until then); b) grant Coin Magnet level 10 for free (keeps today's behaviour, but gives the ~$90k upgrade for $800). (recommendation: a, same as the Wind-up and Push Broom removals; b hands out the most expensive Movement upgrade.)
2. Feeding Frenzy price and name: a) $2,000 x2.2 (5 levels total $84k), name "Feeding Frenzy"; b) cheaper $1,500 x2 (total $46k); c) another name ("Heavy Diet", "Second Breakfast"). (recommendation: a; Massive pays x2.3 on every gnome, so level 5 is worth more than Premium Gnomes 13.)
3. [spec silent] Zakładam: crate tipped over at the rim stays x0.25, only a dump into the hole pays full | Dowód: `gnomes.ts:363` (`release` marks machine-fed), balance-batch decision 12 (2026-10-21) | Jeśli źle: PP wants any gnome that came out of a crate to pay x1 | Pewność: Likely | rekomendacja: a) keep x0.25 for a tip
4. [spec silent] Zakładam: at Feeding Frenzy 5 rain and parade gnomes come out Massive too, not only factory ones | Dowód: `gnomes.ts:213` (default roll shared by rain `events.ts:79`) | Jeśli źle: rain gnomes stay light, the player sees mixed sizes after buying "all Massive" | Pewność: Likely | rekomendacja: a) one roll for all
5. [spec silent] Zakładam: with Feeding Frenzy >= 1 the big "HEAVY HAUL" text stops (stat and contract keep counting) | Dowód: `hole.ts:134,208` (text on every massive gnome) | Jeśli źle: PP wants the text on every gnome at level 5 (hundreds per minute) | Pewność: Likely | rekomendacja: a) hide the text while the upgrade is owned
6. [spec silent] Zakładam: Midas turns every gnome in the yard gold while it has gnomes left; the slip rule, Low quality night rule and Shadow visitors are untouched by items 2, 5 and 6; the Rainbow mushroom includes the Eclipse Cap | Dowód: `buffs.ts:50` (Midas counts at eat time), `player.ts:765`, `environment.ts:463,491`, `buffs.ts:29` | Jeśli źle: PP wanted only the 15 next gnomes marked (not knowable), or visitors during the flicker | Pewność: Confident | rekomendacja: a) as planned

### Self-check
- Every PP item has steps (1-14) and Done-when lines (A-G, 47 lines = 47 matrix rows, 10 marked `spec silent`).
- Every step names the file, the signature or literal and the spec value; no "handle edge cases" lines.
- Fields written: `upgrades.piggy` (writers: shop buy gone with the row, migration deletes; readers listed in Reach, all replaced), `upgrades.magnetRange` (shop buy, clamp; readers coins/shop), `upgrades.frenzy` (shop buy; readers factory/gnomes/hole/shop), `GOLD.value` (gnomes.update; reader: shader), `env.shade` (environment.update; reader: `nightShade`).
- Lists compared with the code: `consume` callers (4) vs spec "crate" → A3/A4; `rollTier` callers (2) vs "factory" → D6; `active('daynight')` readers vs rainbow rule → F7; `night` readers (6) vs "sky flips" → F6; `piggy` readers (6) → G2-G5; event/mushroom/upgrade names vs "gold rush" → assumption 1.
- Decisions older than 60 days: none in the repo (oldest note 2026-10-19).
- Plan length: 205 lines for roughly 80 changed production lines plus one scenario file; the matrix and tests carry the length, the steps are shorter than the code they describe.

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: Seven small asks, each routed through the one existing choke point (`consume` XP line, `rollTier`, `throwHeld`, the `NIGHT` uniform pattern, `valueMult`, the coin `piggy` branch), so no item adds a second code path or per-gnome per-frame cost. Strong points: the flicker lives in a separate `shade` field, so `isNight`, the 240 s clock and Shadow visitors stay untouched (verified: the only `isNight` readers are `events.ts:28,65`, Shadows never despawn by daylight); Massive odds go through one function, so rain and factory agree; Midas look is one uniform with 0 draw calls (parts `BatchedMesh` shares the same `mat`, `gnomes.ts:172`, so arms and hats turn gold too); the Piggy migration copies an existing, idempotent pattern; the crate tip vs crate dump split respects decision 12.

Findings:
- [Major] The Eclipse Cap flicker is not smooth: the sun colour jumps in one frame on every flip.
  Assumption: everything in the sky block follows `nightShade` continuously.
  Scenario: Eclipse Cap active, `shade` crosses 0.5 every 1.5 s. `environment.ts:470` does `this.sun.color.setHex(n > 0.5 ? 0x9ab0ff : 0xfff2d8)`, a hard step from warm to blue while the sun still has intensity about 1.4 (`2.6 * 0.5 + 0.125`). Under the 240 s clock this step happens twice per cycle and nobody sees it; under the flicker it is a whole-screen hue jump every 1.5 s.
  Checked: `src/world/environment.ts:465-471` (every other line lerps by `n`, only the sun colour is a threshold).
  Impact: the photosensitivity requirement ("transitions smooth") fails exactly where it matters; F9 counts only the direction changes of `nightShade`, so it passes while the screen still snaps.
  Recommendation: step 8 also replaces the `setHex` with a lerp of the two colours by `n`; add a matrix row and a check (sample `sun.color` over the flip: no frame-to-frame jump above a small delta).
- [Major] Feeding Frenzy silently doubles hole XP for every route, not only money. No matrix row says so.
  Assumption: "value x2.3" (D3, Open decision 2) is a money effect.
  Scenario: Frenzy 5 at hole 4+. Every gnome is Massive, and `hole.ts:153` computes `xp = g.type.xp * g.tier.value * feed ...`, so each gnome pays x2.3 XP (today the tier average at hole 4-12 is about 1.05-1.3). Stacked with item 1, a crate-dumped gnome goes from 0.25 x ~1.1 to 1 x 2.3 XP, about 8-9x today.
  Checked: `src/systems/hole.ts:153-154` (XP uses `g.tier.value`), `src/data/gnomeTypes.ts:111-115` (`value` comment: "scales money and hole XP").
  Impact: time to hole 12 drops for everyone who buys it; the FASTEST LVL 12 board (planned in `2026-10-24-plan-leaderboard-name.md`, floor still to be measured with the old XP rules) and the lesson/goal pacing see different numbers than any recorded measurement. PP decides price and name in Open decision 2 without knowing this.
  Recommendation: add a `spec silent` row ("Frenzy 5: XP x2.3 per gnome, intended?") to Open decisions with the econ numbers, or make the tier multiply only the money line.
- [Major] With Feeding Frenzy, hand and Magnet Gun throws lose about 84 % of their range; LONG SHOT / SNIPER contracts and the sniper achievement become unreachable. No matrix row covers it.
  Assumption: Frenzy changes weight and value only; throws are B1-B8's concern.
  Scenario: Frenzy 5, Strong Arm 0..4. `throwJ = 15 * (1 + 0.15 * lvl('throw'))` (`player.ts:372-373`): a 3 kg gnome leaves at 5-8 m/s, range about 2.5-7 m, so the 8 m LONG SHOT and 14 m SNIPER (`hole.ts:101-112`) cannot happen; even Strong Arm 6 (max) gives 9.5 m/s, SNIPER still out of reach. The contract `long` has `ok: always` (`contracts.ts:38`), so it is still offered and expires. Frenzy 1-4 hits balls too: with B1 the whole ball flies at J / m_max, and a ball of 20 at Frenzy 2 (massive about 42 %) holds at least one Massive gnome with near certainty, so every ball flies at J / 3. PP ruled out an off switch ("nie"), so a player who bought it cannot get the trick game back until rebirth.
  Checked: `src/player/player.ts:372-373,670-679`, `src/systems/hole.ts:101-112`, `src/systems/contracts.ts:38`, `src/data/upgrades.ts:34` (Strong Arm max 6), `src/data/achievements.ts:26`.
  Impact: buying the "nice" upgrade quietly kills the skill-shot game, which is the main money source early on (TRICK_BONUS). Not reopening "no off switch": the point is that PP answered it without this consequence on the table.
  Recommendation: put one line to PP ("kiedy kupisz Frenzy 5, wtedy rzut ręką leci najwyżej ~9 m przy max Strong Arm, bo każdy gnom waży 3 kg; SNIPER znika"); add rows for the `long` contract (`ok` gated on reachable range, or accepted) and the sniper achievement.
- [Minor] B1 alone (no Frenzy) shortens most ball throws from hole 6: a ball of 20 at hole 6 (massive 9 %) holds a Massive in about 85 % of cases, so it flies at J / 3, 16 % of today's range for the light members. PP asked for "the heaviest", so this is the spec; the plan just should say it in the B1 row so PP sees the size of the change. Checked: `gnomeTypes.ts:122-125` odds, plan step 6.
- [Minor] Crate x1 plus A2 makes "throw the Magnet Gun ball into a crate, then dump the crate" the dominant XP route: a ball of 60 thrown at the hole pays 60/sqrt(60) = 7.7 XP, the same 60 via crate pay 60 XP (crate cap 12 + 6 x 8 = 60, `machines.ts:84-85`; the crate teleports home after a dump, `machines.ts:815`; belts and fans fill it with no player, `machines.ts:830-845` catches any free gnome). PP decided full XP ("malo kto bedzie jej uzywac"), so not reopened; the x1/sqrt(n) volley rule becomes moot, and that should appear in SPEC "why".
- [Minor] Piggy removal moves greedy-theft protection from hole 2 / $800 to about $136k cumulative (all 10 Coin Magnet levels), every run: Movement is not in `KEEP_TOOL_IDS` (`upgrades.ts:122`), so Coin Magnet resets on each rebirth, and greedy gnomes (weight 18 from hole 2, `gnomeTypes.ts:47`) that escape keep the loot (`gnomes.ts:688-695`). Coins also lie up to 40 s instead of 1.6 s (`coins.ts:192`). Open decision 1 talks only about old saves; it should state this for new runs too.
- [Minor] Midas gold hides real golden gnomes: `midasLeft` drops only when the hole eats (`buffs.ts:50-51`), so an idle player keeps a gold yard for minutes, and E5 gives the real golden type almost the same shine (metalness 0.6 / roughness 0.35 vs Midas 0.6 / 0.3, diffuse 70 % toward 0xffc740 vs hat 0xffd23f). The x100 gnome is only told apart by its flee behaviour. Option: skip the uniform on the golden type, or keep hats untinted.
- [Minor] Step 1 puts Massive before Heavy, which keeps the histogram (D1) but changes the per-draw result for the same `rnd()` value from hole 4 on. On the deploy day, two players of the same `daily-<date>` board get different tier streams from the same seed. Keeping Heavy first with `p = Math.min(ph, 1 - massiveOdds(...))` gives identical draws at Frenzy 0 and still 100 % Massive at Frenzy 5. Checked: `gnomeTypes.ts:122-134`, `daily.ts:86`, `factory.ts:196,207`.
- [Minor] The flip uses `damp` (lambda 6), which moves 45 % of the change in the first 0.1 s. That is a fixed-period change, so CLAUDE.md animation rule 2 asks for an easing; `shade = 0.5 - 0.5 * Math.cos(Math.PI * ctx.time / FLIP_T)` gives exactly one direction change per 1.5 s, has no jump at the flip, and makes F9 trivially true.
- [Minor] HEAVY HAUL contract (`contracts.ts:45`, `ok: L() >= 4`) becomes free money at Frenzy 5 (every eaten gnome counts); D10 hides the text but leaves the contract in the pool.

Pre-mortem: A week after the build PP writes "po kupieniu Feeding Frenzy nie da się już rzucać, a poziomy lecą dwa razy szybciej". The assumption that broke first: that tier value is a money number. It is also the XP and the mass, so one upgrade changed throws, levels and contracts at once, and none of the 47 Done-when lines measures hand-throw range or XP per gnome under Frenzy. Second most likely: a photosensitive player reports a flash every 1.5 s from the sun colour step, which F9 does not sample.
Inversion worth considering: make the Massive tier's x2.3 apply to money only under Frenzy (or cap Frenzy at Heavy-free 50 %) instead of 100 %; it shows the hidden constraint that weight, XP and throw range share one field.
Investigate first: econ sim (`<scratchpad>/econ/econ2.mjs` or equivalent) for time to hole 12 with crate x1 + Frenzy 5 vs today, before the FASTEST LVL 12 floor is fixed; real landing distance of a 3 kg hand throw at Strong Arm 0 and 6 in a headless run.

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [High] Working tree, not in "In flight": another session has uncommitted edits in `src/systems/hole.ts` (levelUp, `maxLevelAt`), `src/core/state.ts` (`runTime`, `maxLevelAt`, the `loadState` return block right after the migration blocks), `src/main.ts`, `src/ui/leaderboard.ts` (note `docs/ai-work/2026-10-25-leaderboard-name.md`). Steps 4 and 11 edit the same two files, step 11 right above the changed `loadState` lines → when the implementer starts on this tree, it either edits on top of someone else's work or must stash it (forbidden). Fix: add it to "In flight", start only after that work is committed. Also the base is `02dc799`, not `0d39829`: `robots.ts:669` is now `:678`.
- [Medium] `rollTier` reorder (step 1, massive first) is not byte-identical at frenzy 0: today `r < heavy` → heavy, then massive; reordered, the same `r` maps to other tiers. When two players run today's daily (`rng.spawn`, `daily.ts:86`) on the old and new build, they get different gnomes; and D1 "histogram equal (±0)" on a fixed sequence will not hold exactly. Fix: keep heavy first and cap it, `heavy = min(ph, 1 - massiveOdds)`, massive second; frenzy 0 maps every `r` exactly as today, frenzy 5 gives heavy 0, massive 1. Regression vs current behaviour.
- [Medium] XP, not only money: `hole.ts:153` XP is `g.type.xp * g.tier.value * feed`, so Feeding Frenzy 5 also makes every gnome pay x2.3 XP. Together with the crate at x1 this undoes much of the 10a decision ("automatyzacja i skrzynia kończyły grę w pół godziny", `2026-10-20-plan-balance-batch.md`, SPEC:20), and it speeds up the new FASTEST LVL 12 board (`state.runTime`/`maxLevelAt`, in-flight work). Matrix D3 names only "value x2.3". Fix: add a matrix row and an Open decision for PP (a) Massive pays x2.3 XP too, as today; b) the tier XP factor stays 1 for gnomes made Massive by the upgrade).
- [Medium] Frenzy 5 makes every gnome 3 kg, read by every physics path: hand throw J/3 (2.5x slower than J/1.2), magnet slip `player.ts:765` (more gnomes slip off the ball), Coin/fan/wheel/plow pushes that read `body.mass()`, flee 0.55, scale 1.25 (yard crowding at 320). The matrix covers only spawn and the HEAVY HAUL text. Fix: one matrix row "level 5: every tool and throw behaves as for a Massive gnome today (spec 4)", so PP sees it before buying the design.
- [Low] Midas has two clocks: the look follows `midasLeft` (15 gnomes, no time limit), while `active('midas')` (30 s timer) drives the coin reach x1.5 (`coins.ts:154`), the EFFECTS row "Gold Midas N s" (`hud.ts:428`) and legend ACTIVE (`legend.ts:185`). When 15 gnomes are eaten in 10 s, gnomes turn back while EFFECTS still shows Midas 20 s; when nothing is eaten, gnomes stay gold minutes after the timer row is gone. Reach line in the plan names `coins.ts:154` as a `midasLeft` reader, it reads the timer. Fix: state which clock in E1/E2 (recommend `midasLeft`, it matches the "Midas x3: N gnomes" row) and add a row for both edge cases.
- [Low] Shadow visitor `events.ts:261` spawns without a tier, so at frenzy 5 the night Shadow is Massive too (bigger, x2.3). D6 lists only rain and parade. Fix: extend D6 or pass `tier: 'normal'` there.
- [Low] Neighbours that become trivial at frenzy >= 1: contract `haul` (`contracts.ts:45`) and lesson 4 "HEAVY HAUL: feed a MASSIVE…" (`goals.ts:72`) complete on almost every gnome, and the lesson names a text the player no longer sees (D10). Fix: one matrix row, or gate `haul` with `!lvl('frenzy')`.
- [Low] `shop.ts:105` at level 10 shows only "coins fly to the bank": the 14 m pickup radius (`coins.ts:70`, still applies) disappears from the line. Daily run: $800 auto-collect is gone, Coin Magnet 10 ($90k) is out of reach in 5 min; scores across builds differ.

Neighbours checked: draft/live: not affected (no draft concept, single-page game) | profiles/ladder: not affected | serve-cache: not affected | polling/imports: not affected (save migration step 11 is the only import path; `main.ts:48` clamp runs after it, `piggy` not in `UPGRADES` so only the migration removes it) | find_best/cohorts: analogue = `rollTier` and `pickDef`: affected (daily seed mapping, above; `pickDef` weights 100 → 110 also feed Mushroom Bloom `events.ts:185` and UFO crash `events.ts:309`, fine) | dimensions/formulas: analogue = XP/money in `consume`: affected (XP x2.3, above) | text index/search: not affected | prompt context: not affected | widget/render path: affected, gold uniform reaches the `BatchedMesh` parts too because it shares `mat` (`gnomes.ts:173`), good; replay (`replay.ts`) writes matrices only, look keeps the live uniform, fine | rebirth/Keep Tools: not affected (`KEEP_TOOL_IDS` holds neither row, as today) | night features: hat glow reads `nightShade` (flickers, intended), Shadow visitors read `isNight` (unchanged, F6), robots have no night light code | tutorial mushroom lesson: `maybeDrop` lesson path unchanged; first mushroom can be an Eclipse Cap (9 %), fine.
FE/BE: none (no API; `localStorage` save keys `upgrades.piggy`, `magnetRange`, `frenzy` covered by steps 2 and 11).
Decisions: supersedes by PP 2026-10-24 wording `docs/ai-work/2026-10-19-magnet-gun.md` ("Each gnome gets the same impulse J … weight matters here and only here") and `2026-10-20-plan-balance-batch.md` 10a ("maszyny, skrzynia … x0,25"); plan updates SPEC:20/74 and the `throwHeld` comment, ok | consistent with `2026-10-20-coin-flight.md` (one shared flying branch kept) and `2026-10-20-daily.md` (one `rnd()` per roll kept).
Decisions older than 60 days: none (oldest note 2026-10-19).
Regression vs current behaviour: `rollTier` per-draw mapping at frenzy 0 (fix above); otherwise none.

## Review: performance (plan-performance)

Verdict: CONCERNS

No database in this repo: "volume" = gnomes, coins and mushrooms in the yard, "multiplicity" = per frame / per throw / per spawn. Baseline numbers come from `docs/ai-work/2026-10-21-performance.md` (headless Chromium, M3 Max). Nothing was run for this review; PP's laptop: not measured.

| plan step | operation | shape / cost driver | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 1, 3 | `rollTier(..., lvl('frenzy'))` | one `rnd()`, one `lvl()` map lookup | per spawn | chute 20 gnomes/s (perf note) | O(1) | none |
| 1-3 (D3/D6) | yard at Feeding Frenzy 5: every gnome Massive | collider `roundCuboid` x1.25 per axis: volume x1.95, footprint x1.56; mass 3 kg for all (uniform mass ratio, no solver penalty) | Rapier step, every physics tick | 300 gnomes, `busy` spot `physics.step` p95 2.5 ms with today's mix (about 21 % massive, 27 % heavy at hole 10) | contact pairs in the factory and hole piles grow with footprint; estimated up to x1.5 → about 4 ms p95, not measured | Medium |
| 4 | `consume` crate flag, mushroom bonus x1 | one comparison | per eaten gnome | - | O(1); Golden Hour now drops about 4x fewer mushrooms (fewer meshes + glow sprites, cap 25 unchanged) | none (cheaper) |
| 4 (D10) | HEAVY HAUL text skipped at `frenzy > 0` | removes a bigText + sound per massive gnome | per eaten gnome | at level 5 every eaten gnome is massive | without this step: one bigText per eat, hundreds per minute; the plan already cuts it | none |
| 6 | `throwHeld`: `reduce` over `mass()` | +1 WASM call per member | per throw | ball <= 145 gnomes | 145 calls once per throw | none |
| 6 | `updateAids` swarm: `m = max(mass())` | +1 WASM call per member next to the existing `translation()` + `linvel()` | per frame while a ball is held | <= 145 members | +145 calls/frame on top of today's 290 (+50 % of a loop that is a small part of the 2.2 ms render CPU) | none |
| 7 | `valueMult` `active('daynight')` | one Map lookup | per eaten gnome | - | O(1) | none |
| 7 | new `MUSHROOMS` row | `mushrooms.ts:42` builds one geometry per def at boot; shared `this.mat` | once at boot | 9 → 10 defs | 1 geometry, 0 new programs | none |
| 8 | `shade` damp + flip under Eclipse Cap | sky/fog colours, `sun.intensity`, `sun.color`, `hemi`, `lamp.intensity`, stars/fireflies opacity: all uniforms. The lamp `PointLight` is always in the scene (intensity 0 by day, `environment.ts:133`), so the light count never changes and nothing recompiles (CLAUDE.md "no runtime lights" rule holds); `sun.castShadow` stays on | per frame | 120 fireflies | the only new work: fireflies `setXYZ` loop (120 points + one `needsUpdate` upload) now runs while `n > 0.05`, i.e. about half the flicker time, also below hole level 6 | none |
| 9 | `GOLD` uniform in the gnome shader | same program as today (one shared `customProgramCacheKey`, metalness/roughness/emissive are uniforms, not defines); 3 extra `mix` per fragment always, also at gold 0 | per frame: one damp + one uniform; per fragment: 3 ALU ops | 8 gnome types x (InstancedMesh + BatchedMesh) materials | 0 draw calls, 0 extra programs; the key rename links once at boot, covered by `compileAsync` (perf note) | none |
| 9 (E5) | golden `vcMat` with metalness 0.6 / emissive | uniforms only | once at boot | 1 material | 0 programs | none |
| 10 | `autoCollect` getter (`lvl` + `UPGRADE_BY_ID` lookup) | O(1) | once per `coins.update`, once per `nearestFree` call (per greedy gnome scan) | coins <= 320 (`CAP`) | same branch as today's `piggy`; flying coins drop their Rapier body, so level 10 lowers physics load | none |
| 11 | save migration `piggy` | one key check | once at load | - | O(1) | none |
| 12 | shop effect line `massiveOdds` | arithmetic | per shop render | - | O(1) | none |

Findings:
- [Medium] step 1-3 (D3, D6): when a player owns Feeding Frenzy 5, every gnome in a 300-gnome yard is 1.25x larger, so the factory and hole piles get about 1.5x more contact pairs per physics tick, because collider footprint grows x1.56; today's `busy` measure (2.5 ms p95) was taken with roughly a fifth massive. Fix: add one Done-when line, `scenario-perf.js` `busy` block with `upgrades.frenzy = 5` (300 gnomes spawned through `gnomes.spawn`, which uses the same roll) → `physics.step p95 <= 4 ms` and `over25 = 0`; no code change unless it fails. Measured: estimated (scaling from the perf note, nothing run).

No findings on: tier roll per spawn, crate XP flag, mushroom bonus (cheaper), HEAVY HAUL text cut, throw and Trick Scope mass reads (<= 145 WASM calls), `valueMult`, the new mushroom geometry, the day/night flip (uniforms only, no light added or removed, no recompile, no shadow toggle), the Midas uniform (0 draw calls, 0 new programs), the golden material, coin auto-collect (same branch as Piggy Bank), the save migration and the shop line.

## Plan (plan-senior, final)

Status: needs-decision

Base: `main` at 02dc799 **plus the uncommitted leaderboard work of another session** (`src/core/state.ts`, `src/systems/hole.ts`, `src/main.ts`, `src/ui/leaderboard.ts`, `src/core/format.ts`, `supabase/*`, `tools/smoke/scenario-remote-lb.js`; note `2026-10-25-leaderboard-name.md`). This plan ships AFTER that commit: the implementer starts only when `git status --short` no longer lists those files, and anchors every edit by text, never by line number (line numbers below are today's, `robots.ts:669` is now `:678`). Decisions sent to PP on Slack and still open: Piggy refund (default a), Frenzy price (default a). New question Q1 below is the only one that changes code.

### Resolutions
- R1: impact [High] uncommitted leaderboard work in `state.ts` / `hole.ts` vs plan steps 4 and 11: Decision: accepted, ship after that commit, no stash, edits anchored by text. Rationale: cudzych zmian nie wolno stashować; step 11 lands right above the in-flight `runTime` line in `loadState`, so a line-number edit would hit the wrong block. Checked: `git diff src/core/state.ts` (hunks at :58, :112, :155), `src/systems/hole.ts:262`.
- R2: roaster [Minor] + impact [Medium] `rollTier` order (v0 step 1 puts Massive first): Decision: Heavy stays first, capped: `heavy = min(ph, 1 - massiveOdds)`, Massive second. Rationale: v0's "marginals unchanged" is true for the histogram but not per draw; `factory.ts:196` rolls from the daily seed, so two players of the same `daily-<date>` board would get different gnomes on the deploy day; the capped order gives byte-identical draws at Frenzy 0 and 100 % Massive at 5 (ph becomes 0 when pm is 1). D1 changes from "histogram equal" to "sequence identical". Checked: `src/data/gnomeTypes.ts:123-134`, `src/entities/factory.ts:196`.
- R3: roaster [Major] sun colour snaps at every flip: Decision: accepted, step 8 replaces `setHex(n > 0.5 ? …)` with `copy(SUN_DAY).lerp(SUN_NIGHT, n)`; new row F10. Rationale: `environment.ts:469` is the only threshold in the sky block; under the 240 s clock it crosses twice per cycle, under a 1.5 s flicker it is a whole-screen hue jump F9 does not sample. Checked: `src/world/environment.ts:465-472`.
- R4: roaster [Minor] flicker shape (damp with lambda 6 vs cosine): Decision: damp toward a cosine target: `target = flip ? 0.5 - 0.5 * cos(π · ctx.time / FLIP_T) : this.night`, `shade = damp(shade, target, 6, dt)`. Rationale: the roaster is right that a plain damp moves 45 % in 0.1 s (animation rule 2 asks for a curve on a fixed-period change), but a bare cosine jumps at pickup when the phase is mid-swing (shade 0 → 0.8 in one frame: the flash we are avoiding) and needs a second rule for the return to the clock value; damp-to-cosine has no jump at pickup or end, one direction change per 1.5 s after the first 0.3 s, amplitude 0.03-0.97 (first-order gain 0.94 at ω = 2.09 rad/s, λ = 6). F2/F9 thresholds hold; new row F11 pins the pickup.
- R5: roaster [Major] + impact [Medium] Feeding Frenzy multiplies XP x2.3 (one finding, two reviewers): Decision: product rule, goes to PP as Q1; the plan is written for the recommendation (a: with Frenzy owned the tier factor in the XP line is 1). Rationale: `hole.ts:154` multiplies XP by `g.tier.value`; PP decided "nie" to an off switch and price (Q2) without knowing a $84k upgrade also halves time to hole 12 and reaches the FASTEST LVL 12 board being built in the in-flight work. Not decided here because it changes what the game rewards. Checked: `src/systems/hole.ts:153-154`, `src/data/gnomeTypes.ts:110`.
- R6: roaster [Major] + impact [Medium] Frenzy 5 makes every gnome 3 kg, hand and ball throws lose about 84 % of range, SNIPER and LONG SHOT unreachable: Decision: same Q1 to PP (one Slack question, one answer); plan default (a): with Frenzy owned the throw divides by `WEIGHT_TIERS.normal.mass` instead of the gnome's (or the ball's heaviest) mass, so every gnome leaves at today's 1.2 kg speed; slip, fan, plow, flee, scale stay as for a Massive gnome today (row D17, no code). Rationale: the roaster's "scale throw strength" idea as a per-level factor (J x(1 + 0.3 L)) was rejected: at Frenzy 2 a 1.2 kg gnome would fly 2.5x farther than today; dividing by the normal mass compensates exactly and only the weight. The tool throw (`player.ts:684`) keeps plain J. Checked: `src/player/player.ts:372-373,679,684`, `:281-285` (`predict` has the `gnomes` flag), `src/systems/hole.ts:103-112`, `src/systems/contracts.ts:38`.
- R7: roaster [Minor] + impact [Low] HEAVY HAUL contract and lesson 4 become free at Frenzy >= 1: Decision: contract `haul` gated with `!lvl('frenzy')` (step 13); lesson 4 stays. Rationale: the contract repeats every run and would pay on every gnome; the lesson pays 300 once and is meant to be finished, completing it on the first gnome is harmless. Checked: `src/systems/contracts.ts:45`, `src/systems/goals.ts:72`.
- R8: impact [Low] Shadow visitor rolls a tier (`spawn('shadow', p, { awake: true })`, no `tier`): Decision: accepted as row D13, no code: at Frenzy 5 the Shadow is Massive (x2.3, bigger), same as rain and parade (assumption 4 "one roll for all"). Rationale: passing `tier: 'normal'` would be the only gnome that ignores the upgrade. Checked: `src/systems/events.ts:261`, `src/entities/gnomes.ts:213`.
- R9: impact [Low] Midas has two clocks: Decision: the look follows `midasLeft` (as v0 E1), rows E7/E8 pin both edge cases; the v0 Reach line is wrong: `coins.ts:154` reads the 30 s timer `active('midas')`, not `midasLeft`. Rationale: gold means "the next N gnomes pay x3", which is the `midasLeft` counter (HUD "Midas x3: N gnomes"); the timer only drives coin reach. Checked: `src/entities/coins.ts:154`, `src/systems/buffs.ts:41,50-51`, `src/ui/hud.ts:431`.
- R10: roaster [Minor] Midas gold hides the real golden gnome: Decision: accepted in a different shape: the tint and the gold emissive skip the hat (`* (1.0 - vGlow)`, the hat vertices already carry `glow = 1` for the night glow); roughness and metalness still mix on the whole gnome. Rationale: the roaster's "skip the uniform on the golden type" does not help (a golden gnome is gold either way); the hat is the type tell for every type, so a Boom or Greedy gnome stays recognisable during 15 gold gnomes, which is the scenario that costs money (eating a Boom blasts the pile). Checked: `src/entities/gnomes.ts:152-158` (`hatGlow * (vGlow * night)`).
- R11: roaster [Minor] B1 alone makes most balls from hole 6 fly at J / 3: Decision: accepted as text: the B1 row and the SPEC line name the size of the change; no code (PP said "bierzemy wage najciezszego"). Under Q1 a the ball of a Frenzy owner flies at J / 1.2 again.
- R12: roaster [Minor] crate x1 + ball makes "ball into crate, dump" the top XP route: Decision: no code; SPEC "why" line records that PP accepted it ("malo kto bedzie jej uzywac") and that the volley 1/sqrt(n) rule stays for direct throws. Rationale: reopening PP's decision is not the reviewer's or mine to do; the consequence must be visible in the spec.
- R13: roaster [Minor] greedy-theft protection moves from $800 at hole 2 to about $136k cumulative every run: Decision: row G8 plus [spec silent] #5 to PP; no code. Rationale: Movement is not in `KEEP_TOOL_IDS`, so this follows PP's own "ostatni 10 upgrade, bardzo drogi"; PP should see the number before the build.
- R14: performance [Medium] Frenzy 5 yard = 1.56x collider footprint, physics p95 estimated 2.5 → about 4 ms: Decision: Done-when line D16 on `scenario-perf.js` `busy` with `frenzy 5` behind a flag; no code unless it fails. Rationale: estimate, nothing measured; the flag keeps the baseline run comparable.
- R15: impact [Low] shop line at Coin Magnet 10 drops the 14 m radius: Decision: accepted, text "14.0 m pickup, coins fly to the bank" (row G7 updated).
- Rejected: impact [Low] daily-run scores differ across builds (no $800 auto-collect in 5 min) because the daily board is per date, so old and new builds overlap for one day only, as with every balance change shipped so far (10a shipped without a board reset).
- Rejected: roaster "investigate first: econ sim for time to hole 12" because under Q1 a Frenzy does not touch XP at all; if PP picks b, the FASTEST LVL 12 floor measurement already pending in `2026-10-24-plan-leaderboard-name.md` is done with Frenzy 5 owned (one line there, no new work here).
- Rejected: roaster "cap Frenzy at 50 % / Massive x2.3 money-only for everyone" because PP asked for 100 % and the money-only variant restricted to Frenzy owners (Q1 a) covers the hidden-constraint point without changing today's heavy/massive XP for players who never buy it.

### Chosen variant
v0 routed through the existing choke points (`consume` XP line, `rollTier`, `throwHeld`, the `NIGHT` uniform pattern, `valueMult`, the coin `piggy` branch), with four corrections from the round: Heavy-first capped roll (daily seed stream unchanged), sun colour lerp plus damp-to-cosine flicker (no frame jump anywhere), Midas tint that leaves hats alone, and two one-line compensations for Frenzy owners pending Q1 a (XP tier factor 1, throw divided by the normal mass) plus the `haul` contract gate. Pros: no new code path per gnome per frame, every PP item one literal or one expression, the skill-shot game and level pacing survive the Massive upgrade, the daily board stays deterministic across the deploy. Cons: Frenzy owners lose the x1.6/x2.3 XP they get today from natural heavy and massive gnomes (about 5-25 % XP at hole 4-12), and weight stops mattering for their throws; one more `lvl()` read in the XP line and in `throwHeld`. Cost: everything O(1) per event (performance table); the only volume effect is the Frenzy 5 yard (physics p95 2.5 → about 4 ms estimated, pinned by D16). Risk: the roast pre-mortem ("nie da się rzucać, poziomy lecą 2x szybciej") is answered by Q1 a and rows D11/D12; the second risk (a flash every 1.5 s from the sun colour) by F10. Ladder: rungs as v0 (`massiveOdds` and the `rollTier` parameter rung 6, `'crate'` and the mass ratio rung 5, uniform/mushroom/migration rung 2) plus: `tierXp` and `mRef` one expression each (rung 5), `SUN_DAY`/`SUN_NIGHT` lerp (rung 2, copies the sky lerps), `(1.0 - vGlow)` (rung 2, reuses the hat varying), `haul` gate (rung 5).
### Rejected variant(s)
- (b) v0 as written (Frenzy = roll change only): pros: four fewer lines; cons: at Frenzy 5 hand throws reach 2.5-7 m (SNIPER 14 m, LONG SHOT 8 m gone for the run, no off switch), XP x2.3 per gnome stacks with crate x1 to about 8x today's XP per dumped gnome and undoes decision 10a; rejected because no Done-when line in v0 measures either and PP's "nie" was given without these numbers (stays available as Q1 b).
- (c) v0 step 1 Massive-first roll: pros: reads as "100 % wins"; cons: per-draw mapping changes at Frenzy 0 for the same seed, so the daily board gives different gnomes to two builds on the same day; rejected because the capped Heavy-first order gives the same 100 % at level 5 with identical draws today.
- (d) bare cosine flicker (no damp): pros: one direction change per 1.5 s by construction; cons: a jump at pickup when the phase is mid-swing and a second rule for the return to the clock; rejected because the pickup jump is itself a flash.
- (e) Frenzy adds arm strength per level (J x(1 + 0.3 L)): pros: one factor in `throwJ`; cons: at Frenzy 1-4 light gnomes fly up to 2.5x farther than today and thrown tools fly farther too; rejected because dividing by the normal mass compensates only the weight and only for gnomes.

### Behaviour matrix (final)
Rows A1-A4, B2-B8, C1-C3, D2-D9, E2-E6, F1-F8, G1-G6 as v0, unchanged. Changed and added rows:
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| B1 | Magnet Gun ball of 1.2 / 2 / 3 kg gnomes, Frenzy 0 | RMB | impulse `J * m_i / m_max`: all leave at J / 3 (within the 0.06 spread), one clump. Size of the change: from hole 6 a ball of 20 holds a Massive in about 85 % of throws, so most balls fly at J / 3 (16 % of today's range for light members); SPEC says so | spec 2; R11 |
| D1 | Frenzy 0, any hole level | `rollTier` on a fixed `rnd` sequence | the SAME tier for every draw as today (Heavy first, then Massive, then normal), one `rnd()` per roll | R2 |
| D10 | Frenzy >= 1, Massive eaten | HEAVY HAUL | `hauls++` and the lesson keep counting; the big text and sound skipped | v0; R7 |
| D11 `pending Q1` | Frenzy >= 1 owned, any gnome eaten (natural heavy too) | XP | `xp = g.type.xp * 1 * feed * …`: the tier factor is 1 while `lvl('frenzy') > 0`; money keeps x2.3 / x1.6 | Q1 a (R5) |
| D12 `pending Q1` | Frenzy >= 1 owned | hand throw or ball throw | impulse divides by `WEIGHT_TIERS.normal.mass` (1.2) instead of `m` / `m_max`: a 3 kg gnome leaves at 12.5 m/s at Strong Arm 0, same as a 1.2 kg one today; Trick Scope predicts with 1.2; thrown tools unchanged | Q1 a (R6) |
| D13 | Frenzy 5, night, Shadow visitor spawns | spawn | Massive (x2.3, scale 1.25): one roll for all | R8 |
| D14 | Frenzy >= 1 | contract pool | `haul` never offered (`ok` false); a running `haul` contract keeps counting to its end | R7 |
| D15 | Frenzy 5, lesson 4 open | first gnome eaten | lesson "HEAVY HAUL" completes once, $300, as any lesson | R7 |
| D16 | 300-gnome yard, Frenzy 5, `busy` spot, medium | 30 s | `physics.step` p95 <= 4 ms, `over25n` 0 | R14 |
| D17 | Frenzy 5 | slip on a Coil turn, fan push, flee, plow | as for a Massive gnome today (every `body.mass()` reader unchanged; flee 0.55; scale 1.25) | spec 4; R6 |
| E1 | Midas eaten (`midasLeft` 15) | next frames | shared uniform `gold` ramps 0 → 1 in about 0.25 s; body diffuse 70 % toward gold and gold emissive on body only (`1 - vGlow`), roughness → 0.3 and metalness → 0.6 everywhere; hats keep the type colour | spec 5; R10 |
| E7 | 15 gnomes eaten within 10 s of Midas | `midasLeft` 0, timer 20 s left | gold ramps off; the EFFECTS timer row and the x1.5 coin reach keep running | R9 |
| E8 | Midas eaten, nothing eaten for 31 s | timer ended, `midasLeft` 15 | gnomes stay gold (the look follows the counter) | R9 |
| E9 | Midas, a Boom gnome in the yard | look | its hat keeps the Boom colour; screenshot shows gold bodies, coloured hats | R10 |
| F2 | `daynight` active | sky | `shade` damps (λ 6) toward `0.5 - 0.5·cos(π·t / 1.5)`: a smooth swing, min < 0.1, max > 0.9, one direction change per 1.5 s | R4 |
| F10 | `daynight` active, every frame | sun colour | `sun.color = SUN_DAY.lerp(SUN_NIGHT, n)`: red channel within 0.02 of `1 - 0.396·n` on every sampled frame, never a step | R3 |
| F11 | Eclipse Cap picked at any phase | first frames | `nightShade` passes through at least one value strictly between its value before pickup and the first swing's extreme (no jump) | R4 |
| G7 | shop hover Coin Magnet 9 / 10 | effect line | "12.8 m pickup, next: 14.0 m pickup, coins fly to the bank" / "14.0 m pickup, coins fly to the bank" | R15 |
| G8 | rebirth with Coin Magnet 10 and Frenzy 5 | new run | both back to 0 (neither in `KEEP_TOOL_IDS`): coins lie up to 40 s and greedy gnomes steal until level 10 is bought again (about $136k cumulative); HEAVY HAUL text and contract are back | R13; [spec silent] 5 |

Final matrix: 47 v0 rows + 13 added (D11-D17, E7-E9, F10, F11, G8) = 60 rows.

### Steps (edit order)
Every anchor is text; `npx tsc --noEmit` after step 13.
1. `src/data/gnomeTypes.ts` — add `export function massiveOdds(holeLevel: number, frenzy = 0): number { const pm = Math.max(0, Math.min(0.25, 0.03 * (holeLevel - 3))); return pm + (1 - pm) * frenzy / 5; }` above `rollTier`; signature `rollTier(holeLevel: number, minId: WeightTier['id'] = 'normal', rnd: () => number = Math.random, frenzy = 0)`; body: `const pm = massiveOdds(holeLevel, frenzy); const odds: [WeightTier['id'], number][] = [['heavy', Math.min(0.3, 0.05 + 0.025 * L, 1 - pm)], ['massive', pm]];` (Heavy stays first: same draw as today at frenzy 0; at 5 pm is 1 and heavy 0); comment "Feeding Frenzy closes the gap to 100 % Massive by a fifth per level (PP 2026-10-24); Heavy stays first so the daily seed gives the same gnomes as before". Red test: `scenario-small-batch.js` "D1 sequence identical" → 10,000 draws on a fixed sequence at hole 4, 8, 12 equal the recorded pre-change sequence (record it in the note before editing); "D2", "D3", "D4".
2. `src/data/upgrades.ts` — as v0 step 2 (`U('frenzy', 'Factory', 'Feeding Frenzy', …, 5, 2000, 2.2, 4)` after `glue`; `U('magnetRange', 'Movement', 'Coin Magnet', '+1.2 m coin pickup radius. Level 10: coins fly into your bank by themselves and greedy gnomes cannot steal them.', 10, 20, 2.2)`; delete the `piggy` row; comments as v0). Red test: "D8", "G1", "G4".
3. `src/entities/factory.ts` (the `rollTier(` call next to `const rnd = rng.spawn`) and `src/entities/gnomes.ts` (the `rollTier(ctx.state.holeLevel, base.id === 'fat' ? 'heavy' : 'normal')` call in `spawn`) — pass `lvl('frenzy')` as the 4th argument. Red test: "D3", "D6", "D13".
4. `src/systems/hole.ts` — `consume(g: Gnome, at?: THREE.Vector3, machine: boolean | 'crate' = false)`; comment above: "`'crate'`: a crate dump pays full XP (PP 2026-10-24); `true`: vacuum, black hole, robot"; the `feed` line: `const feed = g.type.id === 'king' || machine === 'crate' ? 1 : machine || g.thrownBy !== 'player' ? FEED_XP : 1 / Math.sqrt(g.xpGroup?.n ?? 1);`; new line before `xp`: `const tierXp = lvl('frenzy') ? 1 : g.tier.value; // Feeding Frenzy pays money, not XP: weight is forced, levels are not (PP 2026-10-25, Q1 a)`; `const xp = g.type.xp * tierXp * feed * (1 + lvl('hunger') * 0.1) * (1 + deep('dXp') * 0.25);`; mushroom line `g.type.id === 'wizard' ? 6 : 1` with comment "drops follow the count of gnomes, not their price (PP 2026-10-24)"; the massive block: `if (g.tier.id === 'massive') { s.stats.hauls++; if (!lvl('frenzy')) tricks.push('HEAVY HAUL'); }`; `FEED_XP` comment without "crate". Red test: "A1"-"A4", "C1"-"C3", "D10", "D11" (Frenzy 1, eat a natural massive gnome and a normal one: XP equal).
5. `src/entities/machines.ts` — crate dump branch (`ctx.hole.consume(g, undefined, true)` after the "empties into the hole" comment, today :811): `ctx.hole.consume(g, undefined, 'crate'); // full XP for a crate dump (PP 2026-10-24)`. Red test: "A1", "A2".
6. `src/player/player.ts` — import `WEIGHT_TIERS` from `../data/gnomeTypes` if missing. `throwHeld`: replace the comment at :670 with "The ball flies as one body: every gnome gets J scaled by its mass over the heaviest member's, so all leave at J / m_max (PP 2026-10-24); one gnome in hand is J / m as before. With Feeding Frenzy the arm compensates the weight: J / 1.2 for every gnome (PP 2026-10-25, Q1 a)."; after `const thrown = this.heldGnomes();`: `const mMax = thrown.reduce((a, g) => Math.max(a, g.body.mass()), 0); const mRef = lvl('frenzy') ? WEIGHT_TIERS.normal.mass : mMax;`; in the loop `.multiplyScalar((J * g.body.mass()) / mRef)`; the tool impulse at `h && !h.gnome` untouched. `updateAids`: in the swarm branch `m = Math.max(m, s.g.body.mass())` inside the loop (keep `let m = 1.2`), then right before the `predict(` call: `if (lvl('frenzy') && (h?.gnome || sw.length)) m = WEIGHT_TIERS.normal.mass;` (the same condition that sets `predict`'s `gnomes` flag). Red test: "B1"-"B4", "B6", "D12" (Frenzy 5, hand throw of a 3 kg gnome: speed within 5 % of J / 1.2; mixed ball at Frenzy 1: all at J / 1.2).
7. `src/systems/buffs.ts` — as v0 step 7 (`daynight` row "Eclipse Cap", cap 0x1c1c4a, spots 0xfff3b0, duration 20, weight 10, before `rainbow`; `valueMult`: `if (this.active('daynight')) m *= 2;`). Red test: "F1", "F7", "F8".
8. `src/world/environment.ts` — next to `DAY_TOP`: `const SUN_DAY = new THREE.Color(0xfff2d8); const SUN_NIGHT = new THREE.Color(0x9ab0ff);`; `const FLIP_T = 1.5; // s per sky flip under the Eclipse Cap: one swing every 1.5 s stays under the WCAG 3 flashes/s; PP 2026-10-24 "nie" to a reduce-flashing option`; field `shade = 0; // the night the sky shows: the clock, or the Eclipse Cap swing`; in `update` after `this.night = THREE.MathUtils.damp(this.night, target, 0.8, dt);`: `const flip = ctx.buffs.active('daynight'); const want = flip ? 0.5 - 0.5 * Math.cos((Math.PI * ctx.time) / FLIP_T) : this.night; this.shade = THREE.MathUtils.damp(this.shade, want, 6, dt); this.nightShade = lowfx || prefs.quality === 'low' ? 0 : this.shade;`; replace `this.sun.color.setHex(n > 0.5 ? 0x9ab0ff : 0xfff2d8);` with `this.sun.color.copy(SUN_DAY).lerp(SUN_NIGHT, n);`. `isNight` untouched. Red test: "F2"-"F6", "F9", "F10" (sample `env.sun.color.r` and `env.nightShade` every frame for 10 s: `|r - (1 - 0.396 * n)| < 0.02`), "F11".
9. `src/entities/gnomes.ts` — as v0 step 9 with two changes: diffuse line `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.25), 0.7 * gold * (1.0 - vGlow));` and emissive line `totalEmissiveRadiance += hatGlow * (vGlow * night) + vec3(0.45, 0.3, 0.06) * gold * (1.0 - vGlow);` (comment: "the hat keeps its colour so the type stays readable under Midas"); roughness/metalness mixes as v0; `GOLD` constant, `s.uniforms.gold = GOLD`, `customProgramCacheKey 'gnome-hatglow-gold'`, golden `vcMat({ metalness: 0.6, roughness: 0.35, emissive: 0x332200 })`, `update(dt)`: `GOLD.value = THREE.MathUtils.damp(GOLD.value, ctx.buffs.midasLeft > 0 ? 1 : 0, 12, dt);`, getter `get goldShade(): number { return GOLD.value; }`. Red test: "E1"-"E9".
10. `src/entities/coins.ts` — as v0 step 10 (`get autoCollect()`, `nearestFree` guard, local `auto` in `update`, import `UPGRADE_BY_ID`). Red test: "G2", "G3".
11. `src/core/state.ts` — after the Fuses block (`if (fuses !== undefined) { … }`) and before `adoptSaveVolume(`: `// the Piggy Bank became Coin Magnet level 10 (PP 2026-10-24): refund once, the key goes away with the next save` + `if (parsed.upgrades?.piggy) { delete parsed.upgrades.piggy; parsed.money = (parsed.money ?? 0) + 800; loadNotes.push('The Piggy Bank was removed: $800 refunded. Coin Magnet level 10 now collects coins by itself.'); }`. Do not touch the return block (in-flight `runTime`). Red test: "G5", "G6".
12. `src/ui/shop.ts` — `magnetRange: (L) => \`${(2 + L * 1.2).toFixed(1)} m pickup${L >= UPGRADE_BY_ID.magnetRange.max ? ', coins fly to the bank' : ''}\``; `frenzy: (L) => \`${Math.round(100 * massiveOdds(ctx.state.holeLevel, L))}% massive\`` (import `massiveOdds`). `src/ui/icons.ts`: remove `piggy: '🐷'`, add `frenzy: '🍖'`. Red test: "D8", "G7".
13. `src/systems/contracts.ts` — `haul` row: `ok: () => L() >= 4 && !lvl('frenzy')` with comment "with Feeding Frenzy every gnome is a haul: no contract (2026-10-25)". Red test: "D14", "D15".
14. Texts — as v0 step 13 plus: SPEC "why" lines for crate x1 ("the ball-into-crate route pays the most XP; PP accepted it, the 1/sqrt(n) volley rule stays for direct throws"), B1 ("from hole 6 most balls fly at the 3 kg speed"), Feeding Frenzy ("money and weight only: XP x1 and the arm compensates the weight for owners; HEAVY HAUL text and contract off while owned", per PP's Q1 answer), Coin Magnet 10 ("greedy gnomes steal until level 10, every run"), Midas ("hats keep their colour"), Eclipse Cap ("one swing per 1.5 s, sun colour blended"); plan header "In flight" gets the leaderboard work. `docs/ai-work/2026-10-25-small-batch.md` records the pre-change D1 sequence and the Q1 answer.
15. Tests — `tools/smoke/scenario-small-batch.js` sections A-G as v0 plus D11-D15, D17, E7-E9, F10, F11, G8 (G8: Coin Magnet 10 + Frenzy 5, `hole.rebirth`-like `freshState(keep)` → both 0, greedy steals, `haul` contract offered again, HEAVY HAUL text shown); `tools/smoke/scenario-balance.js` C8 expected `near(x.crate2, 2)`; `tools/smoke/scenario-perf.js` `spots.busy.setup`: after the `Object.assign(U, { permit: 5, … })` line add `if (P.has('frenzy')) U.frenzy = 5;` (same flag mechanism as `freshonly`; the baseline run stays unchanged).

### Review focus
1. Eclipse Cap ends during the clock's night (hole >= 6, `night` 1): `shade` must return to 1, not 0 → pinned by step 8's test "F3" run twice (clock day and `env.night = 1`).
2. Old save with both `piggy = 1` and `magnetRange = 6`: refund and no clamp in one boot → pinned by step 11's test "G5" (set both keys, assert money +800 and `magnetRange` 6).
3. Midas during the clock's night with hat glow on: gold emissive on bodies plus hat glow on hats, no washed-out frame → pinned by step 9's test "E9" screenshot taken with `env.night = 1`.
4. Frenzy bought while a mixed ball is held: the very next throw already uses `mRef` 1.2 (no cached mass) → pinned by step 6's test "D12" (buy with `state.upgrades.frenzy = 1` after the batch grab, then RMB).
5. Daily replay at Frenzy 0 after the roll edit: `rng.spawn` with today's seed gives the same first 50 tiers as before → pinned by step 1's test "D1" (third sequence: the daily seed via `factory.ts` `rng.spawn`).

### Done when
Local only: dev server `npx vite --port 5199 --host 127.0.0.1`, `node tools/smoke/smoke.mjs <out> tools/smoke/scenario-small-batch.js`; every line below is one `PASS` line of that run unless it names another command. 60 lines = 60 matrix rows, plus "All".
- A1 → `PASS A1 xp 2 money <same as before>`
- A2 → `PASS A2 xp 2` (machine-marked and xpGroup 20 gnomes in the crate)
- A3 → `PASS A3 xp 0.5`
- A4 → `PASS A4 xp 0.25`
- B1 → `PASS B1 speeds [v1,v2,v3] spread <10% of J/3`
- B2 → `PASS B2 J/1.2`
- B3 → `PASS B3 J/3 hand`
- B4 → `PASS B4 ring within 1 m`
- B5 `rg -n "g.type.id !== 'king'" src/player/player.ts` → line in `grabbable` present (no change)
- B6 → `PASS B6 mMax 3`
- B7 → `PASS B7 release no impulse`
- B8 → `PASS B8 slip 3kg > 1.2kg`
- C1 → `PASS C1 golden drops == classic drops`
- C2 → `PASS C2 wizard 6x`
- C3 → `PASS C3 goldenHour per-gnome 0.025`
- D1 → `PASS D1 sequence identical hole 4/8/12 + daily seed` (and `rg -c "rnd()" src/data/gnomeTypes.ts` → 1)
- D2 → `PASS D2 massive 0.612 ±0.01`
- D3 → `PASS D3 50/50 massive`
- D4 → `PASS D4 fat massive`
- D5 → `PASS D5 king normal 40kg`
- D6 → `PASS D6 rain massive`
- D7 → `PASS D7 retype keeps heavy`
- D8 → `PASS D8 prices 2000,4400,9681,21297,46852 hole 4 effect "3% massive"`
- D9 → `PASS D9 frenzy 0 notes 0`
- D10 → `PASS D10 hauls+1 noText(L1) text(L0)`
- D11 → `PASS D11 frenzy1 xp massive == xp normal` (pending Q1; under b this line reads `xp massive == 2.3 x normal`)
- D12 → `PASS D12 frenzy5 3kg hand speed J/1.2 ±5%, frenzy1 mixed ball all J/1.2` (pending Q1; under b or c: `J/3`)
- D13 → `PASS D13 shadow massive at frenzy 5`
- D14 → `PASS D14 haul contract not offered at frenzy 1, offered at 0`
- D15 → `PASS D15 lesson haul completes once at frenzy 5`
- D16 `node tools/smoke/smoke.mjs <out> tools/smoke/scenario-perf.js` with the `frenzy` flag → `busy medium physics.step p95 <= 4, over25n 0`
- D17 → `PASS D17 frenzy5 slip count == 3kg slip count (B8)`
- E1 → `PASS E1 gold 0→0.95 in 0.3 s` + screenshot `<out>/midas-peak.png` checked by eye
- E2 → `PASS E2 gold <0.05 in 0.4 s`
- E3 → `PASS E3 rainbow gold rises`
- E4 → `PASS E4 low quality gold rises`
- E5 → `PASS E5 golden metalness 0.6`
- E6 → `PASS E6 LOGS empty`
- E7 → `PASS E7 midasLeft 0: gold <0.05 while timers.get('midas') > 0`
- E8 → `PASS E8 timer ended, midasLeft 15: gold >0.95`
- E9 → `PASS E9 shader has "(1.0 - vGlow)"` + screenshot `<out>/midas-hats.png`: gold bodies, coloured hats, checked by eye
- F1 → `PASS F1 active valueMult 2 row "Eclipse Cap" legend 9%`
- F2 → `PASS F2 swings >=6 min<0.1 max>0.9`
- F3 → `PASS F3 shade≈night after end (day and night runs)`
- F4 → `PASS F4 level 1 swings`
- F5 → `PASS F5 low shade 0 mult 2`
- F6 → `PASS F6 no visitor isNight false`
- F7 → `PASS F7 rainbow includes`
- F8 → `PASS F8 timer ≈40`
- F9 → `PASS F9 changes<=7 minGap>=1.4`
- F10 → `PASS F10 sun.r tracks n ±0.02 over 10 s`
- F11 → `PASS F11 pickup: intermediate shade seen`
- G1 → `PASS G1 prices 20,44,97,213,469,1340,3833,10961,31347,89651 noPiggyNode`
- G2 → `PASS G2 auto-collect, nearestFree null`
- G3 → `PASS G3 level 9 no auto, steal ok`
- G4 `rg -n "piggy" src` → 0 lines
- G5 → `PASS G5 money 900 note "Piggy Bank was removed" (with magnetRange 6 in the same save)`
- G6 → `PASS G6 magnetRange 6 next $3,833`
- G7 → `PASS G7 "12.8 m pickup" / "14.0 m pickup, coins fly to the bank"`
- G8 → `PASS G8 rebirth magnetRange 0 frenzy 0 steal ok haul offered text shown`
- All: `npx tsc --noEmit` → exit 0; `scenario-balance.js` → `PASS C8 2 ...`, 42/42; `git status --short` shows no leaderboard files dirty before the first edit.

### Decisions for PP
1. Feeding Frenzy, skutki, o których nie było mowy, gdy padło „nie" dla wyłącznika: kiedy gracz kupi Frenzy 5, wtedy każdy gnom waży 3 kg i jest wart x2,3, więc (1) rzut ręką leci 2,5-7 m zamiast 8-20 m, LONG SHOT (8 m) i SNIPER (14 m) znikają do końca biegu, także dla kuli z Magnet Guna, a kontrakt LONG SHOT dalej się losuje i przepada; (2) każdy gnom daje x2,3 XP, poziomy lecą ok. 2x szybciej, skrzynia z pełnym XP daje ok. 8x dzisiejszego XP za gnoma i tablica FASTEST LVL 12 nagradza kupno Frenzy. Co wybierasz? a) Frenzy zmienia tylko kasę i wagę: z Frenzy w ręku XP liczy się jak za zwykłego gnoma (x1, także za naturalne heavy i massive, czyli ok. 5-25 % XP mniej niż dziś dla właściciela), a ręka wyrównuje wagę (każdy gnom leci jak 1,2 kg), SNIPER zostaje, poziomy bez zmian; b) zostawić jak jest: x2,3 XP i krótkie rzuty, bez wyłącznika; c) tylko kasa (XP x1), rzuty zostają krótkie. (rekomendacja: a, bo chroni grę na triki i tablicę czasu, a upgrade dalej daje to, o co prosiłeś: wszystkie massive i x2,3 kasy)
2. Sent on Slack, no answer: old saves with the Piggy Bank ($800): a) delete and refund $800; b) grant Coin Magnet 10 for free. (rekomendacja: a; plan built for a)
3. Sent on Slack, no answer: Feeding Frenzy price and name: a) $2,000 x2.2 (total $84k), "Feeding Frenzy"; b) $1,500 x2 (total $46k); c) another name. (rekomendacja: a; plan built for a)
4. [spec silent] Zakładam: crate tipped over at the rim stays x0.25, only a dump into the hole pays full | Dowód: `gnomes.ts:363` (`release` marks machine-fed), balance-batch decision 12 (2026-10-21) | Jeśli źle: PP wants any gnome that came out of a crate to pay x1 | rekomendacja: a) keep x0.25 for a tip
5. [spec silent] Zakładam: with Coin Magnet 10 as the only auto-collect, a new run (and every run after rebirth, Movement is not kept) has greedy gnomes stealing coins from hole 2 until the player spends about $136k on all ten levels; today the Piggy Bank stopped that for $800 | Dowód: `coins.ts:124,192`, `upgrades.ts` `KEEP_TOOL_IDS` | Jeśli źle: PP wants the greedy guard earlier (e.g. from Coin Magnet 5) or Coin Magnet kept through rebirth | rekomendacja: a) as planned, it is the price PP asked for
6. [spec silent] Zakładam: at Feeding Frenzy 5 rain, parade and the night Shadow come out Massive too, not only factory gnomes | Dowód: `gnomes.ts:213` (one default roll shared by `events.ts:79,261`) | Jeśli źle: rain and Shadow stay light, the player sees mixed sizes after buying "all Massive" | rekomendacja: a) one roll for all
7. [spec silent] Zakładam: with Feeding Frenzy >= 1 the big "HEAVY HAUL" text stops and the HEAVY HAUL contract is not offered (stat and lesson keep counting) | Dowód: `hole.ts:136-139`, `contracts.ts:45` (every gnome would qualify) | Jeśli źle: PP wants the text on every gnome at level 5 (hundreds per minute) or the contract as free money | rekomendacja: a) hide the text, skip the contract while owned
8. [spec silent] Zakładam: Midas turns every gnome in the yard gold (bodies, hats keep their colour) for as long as it has gnomes left, even after the 30 s timer row is gone; the slip rule, Low quality night rule and Shadow visitors are untouched by items 2, 5 and 6; the Rainbow mushroom includes the Eclipse Cap | Dowód: `buffs.ts:50` (Midas counts at eat time), `player.ts:765`, `environment.ts:463,491`, `buffs.ts:29` | Jeśli źle: PP wanted only the 15 next gnomes marked (not knowable), hats gold too, or visitors during the flicker | rekomendacja: a) as planned
(no [decision age] items: oldest note 2026-10-19)

### v0 → final
- added: step 13 (`haul` contract gate), sun colour lerp and damp-to-cosine flicker in step 8, hat-free Midas tint in step 9, Frenzy compensations `tierXp` (step 4) and `mRef` (step 6) pending Q1 a, perf flag in `scenario-perf.js`, 13 matrix rows (D11-D17, E7-E9, F10, F11, G8) with Done-when lines (47 → 60).
- changed: step 1 keeps Heavy first (daily seed stream unchanged), D1 checks the sequence not the histogram; G7 keeps the radius; Reach line on `coins.ts:154` corrected (timer, not `midasLeft`); base is 02dc799 plus the uncommitted leaderboard work, ship after that commit.
- dropped: nothing from v0's seven items; Massive-first roll and the bare cosine flicker rejected.
- moved to PP: Q1 (Frenzy XP and throw range, one Slack question, recommendation a); Q2/Q3 already on Slack stay at default a; four [spec silent] items from v0 plus one new (greedy guard after Piggy).
