# Plan: secret letters (the typed BOOZE code becomes physical letters to feed the hole) + shiny shovel

Spec: PP, verbatim: "to slowo zamien na literki (o fizyce jak gnomy) porozrzucane po landach (najwiecej w najwiekszym landzie) ktore trzeba wrzucic ale nazwe gry albo skrot jakis np gnome a nie booze". Addendum (PP via hub): "ta lopata niech tez bedzie obiektem blyszczacym".
Trivial check: new rigid bodies, a new save field, a hole-consume path, the land purchase hook, the HUD, a removed input path; 8 production files.

Base: `main` plus the uncommitted small batch of another session (`src/core/state.ts`, `src/systems/hole.ts`, `src/ui/shop.ts`, `src/world/environment.ts` are dirty). Implement after that batch is committed; anchor edits by text, never by line number.

## Plan v0 (plan-author)

### Goal
Five gold letters G N O M E lie around the yard (one per land, two on Dark Forest); feeding all five to the hole gives the Green Grog (BOOZED) buff and the achievement, the typed code `BOOZE` no longer does anything, and the golden shovel glints like the letters.

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | new game (`land` 0, `letters` []) | boot | one letter `G` at its Backyard spot: dynamic body, gold mesh + glow sprite; mesh scale pops 0 → 1 over 0.25 s (`outBack`) with one `fx.burst` at the spot | spec "porozrzucane po landach"; CLAUDE.md animation rule 3 |
| 2 | buy Garden (`shop.buyLand`) | after `env.rebuildLand()` | `N` pops in at its Garden spot; `state.letters` unchanged | Q4 a) (bought lands only) |
| 3 | buy Neighbour's Lawn / Dark Forest | same | `O` appears; `M` and `E` appear (two on the largest land) | spec "najwiecej w najwiekszym landzie" |
| 4 | letter carried, thrown or kicked into the hole (`holeDist < r && y < 1.5`, then `y < -2.6`) | `Props.update` | body and mesh removed for good; `state.letters` += `ch`; toast `secret` with progress `G N _ M E`; `audio.slurp()`; `fx.burst` at the hole; no money | Q5 a) |
| 5 | fifth letter eaten (`letters.length === WORD.length`) | `Hole.consumeLetter` | `buffs.apply('booze')` (15 s, x2, wobble), `achievements.unlock('booze')`, `coins.burst(250 * valueScale, holeOrigin, 1.5)`, toast "GNOME! The hole is properly boozed." | spec "trzeba wrzucic"; today `main.ts:282-286` |
| 6 | word completed again in a later run (player already has the achievement) | same | buff + coins + toast again; no achievement toast (`unlock` returns early) | `achievements.ts:13` |
| 7 | reload with `letters` = [G, N, O] on land 2 | boot | nothing spawns for G, N, O; nothing for M, E (land 3 not owned); zero letters in the yard | Q3 a) saved across reloads |
| 8 | rebirth | `freshState(old)` | `letters` = [] (not copied from `keep`), `land` 0 → only `G` spawns after the reload; `secrets` and achievements kept as today | Q3 a) per run; `hole.ts rebirth` |
| 9 | letter falls off the map (`y < -10` or `|x| > 300`) | `Props.update` | teleported back to its home spot (existing branch, `savePose`) | `props.ts:118-122` |
| 10 | letters eaten in any order (E first) | consume | counted; no "wrong letter" exists | Q2 a) |
| 11 | typing `BOOZE` / typing `GNOMERAIN` | key input | `BOOZE`: nothing (no buff, no achievement); `GNOMERAIN`: rain event as today with the 120 s `codeCd` | spec "to slowo zamien"; Q7 a) |
| 12 | old save with `achievements` containing `booze` and no `letters` field | load | loads as `letters` = []; letters spawn; the achievement stays; no refund, no note | `state.ts loadState` spread |
| 13 | `spec silent` daily challenge (`freshState()`, 5 min) | boot | same code path: `G` on Backyard, lands as reached in the run | `main.ts:46` |
| 14 | `spec silent` placed tools: magnet, vacuum, black hole, belt, fan, robot, crate, player Magnet Gun cone, blower | run | they do nothing to letters (all target gnomes only); tractor/plow, the robot truck, gnomes and kicks push letters physically; hands and the Magnet Gun carry one letter via `lookAt.prop` as the chair | `machines.ts:831-1023`, `robots.ts:376`, `player.ts:558, 804, 835` |
| 15 | `spec silent` gnome crowd walks into a letter | physics | the letter gets pushed (dominance 0, mass 1, like a gnome); the chair keeps dominance 1 | spec "o fizyce jak gnomy"; Q8 a) |
| 16 | `spec silent` hole level-up or land slide reaches a letter | `Props.update` | spots are >= 6.8 m from every land's hole path, so it never happens at a home spot; a letter the player left on the path falls in and counts (row 4) | `environment.ts:153-155` |
| 17 | golden shovel not yet taken | boot + every frame | the shovel mesh has a glow sprite child (gold, additive, `glowTexture()`), scale pulsing `2.0 + sin(time * 6) * 0.3`; taking the shovel removes it with the mesh | addendum; `mushrooms.ts:85-87, 146` |
| 18 | looking at a letter with hands or the Magnet Gun | HUD | the MAGNET line says `Letter G` instead of `Garden prop`; the prompt stays `hold LMB magnet · RMB throw` | `hud.ts:488, 543` |
| 19 | `spec silent` `Hole.carry` (tools glide with a moving hole) | level-up | props, letters included, never glide (unchanged) | `hole.ts:264` |
| 20 | achievements list in the menu | render | 26 entries; `booze` still `secret: true`, name "Properly Boozed", desc "Feed the hole the word GNOME." | Q6 a); `SPEC.md:225` "26 osiągnięć" |

### Reach
- `main.ts:282-286` BOOZE block: deleted; `codeCd` and the GNOMERAIN block (`:287-290`) stay. `consumeTyped` callers after: `main.ts` GNOMERAIN only.
- `buffs.apply('booze')` callers after: mushroom pickup (`mushrooms.ts` via `def.id`), `Hole.consumeLetter`. `achievements.unlock('booze')`: `Hole.consumeLetter` only. `buffs.active('booze')` readers unchanged: `player.ts:1028-1040`, `main.ts:298`, `buffs.ts:50`.
- `Props.list` / `byCollider` readers (all get letters for free): `player.ts:536` (lookAt), `:558` (grab), `:728` (held drops when falling), `:835` (kick), `:958` (surface filter); `hud.ts:488, 543`; `coins.ts:117` and `gnomes.ts:107-109` collide with `G.PROP`.
- `consumeProp` callers: `props.ts:118` only; signature unchanged, letters get their own `Hole.consumeLetter(ch)`.
- `state.letters` writers: `freshState` (`[]`), `Hole.consumeLetter`. Readers: `Props.spawnLetters`, `Hole.consumeLetter`. Not in `rebirth`'s keep list on purpose (row 8).
- `rebuildLand` callers: `environment.ts:180` (constructor, before `Props` exists, `main.ts:84` vs `:92`), `shop.ts:273` (`buyLand`) → the spawn call goes into `buyLand` after `rebuildLand()`.
- Response shape to the front: none (browser game, no API).

### Data
- No database. Save: one new array `letters` (max 5 chars) in `localStorage['gnome-boozed-save-v1']`; old saves lack it → `[]` via the `freshState` spread.
- Runtime: +5 dynamic bodies, +5 meshes (castShadow), +5 sprites, `Props.list` 4 → 9. The kick query (`intersectionsWithShape`, Ball) and `updateLook` raycast already see props; cost +5 handle lookups. The yard holds hundreds of instanced gnomes, so five bodies are noise.

### Steps (edit order)
1. `src/data/letters.ts` (new) — `export const WORD = 'GNOME';` and `export const LETTER_SPOTS: { ch: string; land: number; x: number; z: number }[] = [{ ch: 'G', land: 0, x: 15, z: -15 }, { ch: 'N', land: 1, x: -27, z: 24 }, { ch: 'O', land: 2, x: 38, z: 30 }, { ch: 'M', land: 3, x: -50, z: -20 }, { ch: 'E', land: 3, x: 30, z: -52 }];` with the comment "fixed spots like the shovel (PP 2026-10-20: fixed, so players can share hints); each >= 6.8 m from every land's hole path, >= 2 m inside its land's fence, outside the previous land's fence". Test: scenario check L0 computes these three distances for every spot (segment `holeCenterFor(1, t)`-`holeCenterFor(12, t)` for all 4 lands, `LAND[land].half - 2`, `LAND[land - 1].half + 1`).
2. `src/core/state.ts` — `GameState`: `letters: string[]; // letters of the secret word the hole ate this run (src/data/letters.ts)`; `freshState`: `letters: [],` (no `keep?.`). Test: L8 (`freshState(st).letters.length === 0` with `st.letters = ['G']`), L7.
3. `src/world/models.ts` — `export function letterGeometry(ch: string): THREE.BufferGeometry` built with `build()` from `box(0.14, 0.14, 0.16)` parts on a 5x7 bitmap (one `string[]` per letter of WORD, `#` = cube), colour `0xffd23f`, centred so the letter is 0.7 m wide, 0.98 m tall, 0.16 m deep, origin at its centre. Comment: "block letters from cubes: TextGeometry needs a font file (no asset downloads, CLAUDE.md)". Test: L1 reads `mesh.geometry.boundingSphere.radius` in 0.5..0.7.
4. `src/entities/props.ts` — `Prop.kind: 'chair' | 'flamingo' | 'letter'`, new fields `letter?: string; pop: number;` (pop: seconds since spawn, 0.25 s scale-in). `add(kind, pos, letter?)`: for `'letter'` geometry `M.letterGeometry(letter)`, material `M.vcMat({ metalness: 0.8, roughness: 0.2, emissive: 0x332200 })` (the shovel's), a glow sprite child (`glowTexture()`, color `0xffd23f`, `AdditiveBlending`, `depthWrite: false`, scale 2.0, y 0), body `dynamic()` with NO dominance group (gnomes push letters, row 15), collider `cuboid(0.35, 0.49, 0.08).setMass(1).setFriction(0.7).setRestitution(0.15)` (the gnome's values, `gnomes.ts:241-244`), `fx.burst(pos, 0xffd23f, 12)`. New `spawnLetters(): void`: for each spot with `land <= ctx.state.land`, `!ctx.state.letters.includes(ch)` and no live letter with that `ch`, `add('letter', new Vector3(x, 0.6, z), ch)`; constructor calls it after the flamingos. `update`: for letters, `p.pop` grows by `dt`, `mesh.scale.setScalar(outBack(min(1, p.pop / 0.25)))`; glow sprite scale `2.0 + Math.sin(ctx.time * 6) * 0.3`; when `falling && t.y < -2.6`: `ctx.hole.consumeLetter(p.letter!)`, collect into a local `gone: Prop[]`; after the loop remove each: `physics.removeRigidBody(body)`, `scene.remove(mesh)`, `byCollider.delete`, splice from `list` (Rapier rule: collect first, act after). Shovel: in the constructor add the same glow sprite to `this.shovel` (scale 2.0, y 0.1); in `update` pulse it the same way. Test: L1-L3, L9, L17.
5. `src/systems/hole.ts` — `consumeLetter(ch: string): void` next to `consumeProp`: push `ch` to `ctx.state.letters` (skip if present), `audio.slurp()`, `fx.burst(holeOrigin, 0xffd23f, 20)`, progress `const word = WORD.split('').map((c) => s.letters.includes(c) ? c : '_').join(' ')`, toast `The hole swallowed ${ch}: ${word}` (`secret`); when `s.letters.length === WORD.length`: `ctx.buffs.apply('booze')`, `ctx.achievements.unlock('booze')`, `ctx.coins.burst(250 * this.valueScale, this.holeOrigin, 1.5)`, toast `GNOME! The hole is properly boozed.` (`secret`), `saveState(s)`. Test: L4, L5, L6, L10.
6. `src/ui/shop.ts` `buyLand` — after `ctx.env.rebuildLand();` add `ctx.props.spawnLetters();`. Test: L2, L3.
7. `src/main.ts` — delete the `BOOZE` block (`consumeTyped('BOOZE')` … `unlock('booze')`); keep `codeCd` and GNOMERAIN. `src/entities/mushrooms.ts` comment at the lesson count: "the GNOME letters must not pass the mushroom lesson" (the buff is applied directly, the lesson counts pickups only, unchanged). Test: L11a, L11b.
8. `src/data/achievements.ts` — `booze` desc `'Feed the hole the word GNOME.'`, id, name and `secret` unchanged. `src/ui/hud.ts` MAGNET line: `h?.prop ? (h.prop.kind === 'letter' ? \`Letter ${h.prop.letter}\` : 'Garden prop')`. Test: L18, L20.
9. Texts — `docs/SPEC.md:225`: replace "kod BOOZE (tryb BOOZED)" with "pięć złotych liter G N O M E (jedna na Backyard, Garden i Neighbour's Lawn, dwie w Dark Forest; pojawiają się po kupnie ziemi, znikają po odrodzeniu); wrzucenie wszystkich do dziury daje Green Grog (tryb BOOZED) i osiągnięcie; łopata i litery błyszczą" plus two decision bullets (letters per run, bought lands only, with "why"); `docs/PLAN.md:109`: "Feed the five gold letters G N O M E to the hole: BOOZED mode."; `CHANGELOG.md`: new build section, two bullets (letters; shiny shovel), two sentences max each, no numbers. Test: `rg -n "BOOZE" docs/SPEC.md docs/PLAN.md` → only the "Green Grog = BOOZED" and "tryb BOOZED" mentions.
10. `tools/smoke/scenario-letters.js` (new, permanent) — the checks below; run `URL_QUERY='' DEV_PORT=5199 FAKELOCK=1 node tools/smoke/smoke.mjs lt-out tools/smoke/scenario-letters.js`.

### Tests
One headless scenario, `tools/smoke/scenario-letters.js`, `blockSaves()` first, state set through `g.state` like `scenario-small-batch.js`; a letter is fed by `p.body.setTranslation({ x: hole.x, y: 1, z: hole.z }, true)` then waiting frames until `g.state.letters` changes (headless 5 fps, wait on frames):
- L0 every `LETTER_SPOTS` entry: distance to all 4 hole-path segments >= 6.8, `max(|x|,|z|) <= LAND[land].half - 2`, `> LAND[land-1].half + 1` for land > 0.
- L1 land 0: `g.props.list.filter(p => p.kind === 'letter')` → 1, letter `G`, body `isDynamic()`, `dominanceGroup() === 0`, mass 1 +- 0.01; scale sampled over 10 frames from spawn: at least one value strictly between 0 and 1 and one above 1 (overshoot), last = 1 (rule 3, 12).
- L2 set `land` 1, call `g.props.spawnLetters()` → letters `G, N`; L3 land 3 → `G, N, O, M, E` (5); `M` and `E` both `land === 3`.
- L4 feed `E` → removed from `list` and `byCollider`, `g.state.letters` = `['E']`, toast text contains `G N O M _`... (`_ _ _ _ E`), no `buffs.active('booze')`, money unchanged.
- L5 feed the other four → `buffs.active('booze') === true`, `achievements.includes('booze')`, `coins.burst` spy called with `250 * valueScale`, toast "GNOME! The hole is properly boozed.".
- L6 state with `achievements` already `['booze']`, feed all five → buff active, `hud.achievement` spy not called.
- L7 state `land` 2, `letters` `['G','N','O']`, new `Props()` → 0 letters spawned.
- L8 `freshState(st)` with `st.letters = ['G']` → `letters.length === 0`; `secrets` kept.
- L9 letter `setTranslation({x: 0, y: -12, z: 0})`, frames → position back near its spot (`distance < 3`).
- L10 feed in order E, M, O, N, G → completes (any order).
- L11a `g.input.typed = 'BOOZE'`, 3 frames → `buffs.active('booze') === false`, `achievements` without `booze`; L11b `g.input.typed = 'GNOMERAIN'`, frames → `g.events.current?.id === 'rain'` (or the equivalent active-event field).
- L12 `loadState()` on a stored save JSON without `letters` → `letters` = `[]`, `achievements` kept.
- L13 `freshState()` (daily path) → `letters` = `[]`, no `keep`.
- L14 place a magnet tool next to a letter, 60 frames → letter displacement < 0.2 m; kick (`g.player` kick path or `applyImpulse` through `props.byCollider`) → displacement > 1 m.
- L15 spawn a gnome walking into the letter (`gnomes.spawn` at 1 m, set linvel toward it), 30 frames → letter moved > 0.1 m.
- L16 covered by L0 (geometry) and L4 (a letter on the path falls in).
- L17 `g.props.shovel.children[0]` is a Sprite; its scale over 10 frames has >= 3 distinct values; after `takeShovel` (set player position, `g.input.pressed.add('KeyE')`) the shovel and sprite are off the scene.
- L18 aim at a letter (teleport the player 2 m away, set yaw/pitch), one frame → HUD MAGNET text contains `Letter G`.
- L19 `g.hole.carry` ignores props: `rg -n "props" src/systems/hole.ts` → only the new `consumeLetter` lines.
- L20 `ACHIEVEMENTS.length === 26`, `booze` entry `secret === true`, desc as in step 8.
- Screenshot at the spawn pop peak frame (`shot('letters-pop')`) and one of the glinting shovel, checked by eye.

### Done when
1. `node tools/smoke/smoke.mjs lt-out tools/smoke/scenario-letters.js` → `PASS L1` (1 letter G on a new game, pop-in sampled)
2. → `PASS L2` (Garden bought → G, N)
3. → `PASS L3` (Dark Forest → 5 letters, M and E on land 3)
4. → `PASS L4` (E eaten: removed, `letters` = ['E'], toast with `_`, money unchanged)
5. → `PASS L5` (fifth letter: buff, achievement, 250 x valueScale)
6. → `PASS L6` (second completion: buff, no achievement toast)
7. → `PASS L7` (reload with 3 eaten on land 2: 0 letters)
8. → `PASS L8` (`freshState` drops `letters`, keeps `secrets`)
9. → `PASS L9` (fallen letter returns home)
10. → `PASS L10` (reverse order completes)
11. → `PASS L11a` and `PASS L11b` (BOOZE dead, GNOMERAIN alive); `rg -n "consumeTyped" src` → one line, `GNOMERAIN`
12. → `PASS L12` (old save without `letters` loads with `[]`, achievement kept)
13. → `PASS L13` (daily fresh state has `letters` [])
14. → `PASS L14` (magnet tool ignores a letter, kick moves it)
15. → `PASS L15` (a gnome pushes a letter); `rg -n "setDominanceGroup" src/entities/props.ts` → 1 line (the chair/flamingo `add`), not on the letter branch
16. → `PASS L0` (spots clear of every hole path and inside their fence ring)
17. → `PASS L17` (shovel glow sprite pulses, gone after pickup); screenshot `lt-out/shovel.png` shows the glint by eye
18. → `PASS L18` (HUD says `Letter G`)
19. → `PASS L19` (`hole.ts` touches props only in `consumeLetter`)
20. → `PASS L20` (26 achievements, `booze` secret with the new desc); `rg -n "BOOZE" src` → 0 lines

### Assumptions (numbered)
1. Lands stay a shop purchase for now; the pending "automatyczne Landy" item (BOARD, hub decision 11 of 2026-10-20) is not implemented (`land.ts` still has `cost`, `shop.ts:266 buyLand`). When it lands, the `spawnLetters()` call moves next to the new `state.land` writer (`Hole.levelUp`), nothing else changes.
2. `WORD` has five distinct letters, so `state.letters` as an array of chars and `includes` are enough; a word with a repeated letter needs spot ids instead (Q1 c would).
3. Letters on a bought land spawn at fixed spots inside that land's ring, so they never meet the forest trees (trees exist only outside the current fence, `environment.ts:394`), the house (`z` -27.5, half 7x4.5), the desk or the factory; spot numbers in step 1 are chosen by hand and proven by L0 at test time.
4. A letter lying flat is still readable thanks to the 2 m glow sprite and the gold emissive; no upright constraint (it would fight "physics like a gnome").
5. The `booze` buff id, the Green Grog mushroom and the canvas filter stay as they are; only the way to trigger it by code changes.

### Alternatives rejected
- (a) Separate `Letters` entity class: rejected, `Props` already has the fall-in, respawn, kick, grab, throw and hold paths (`props.ts`, `player.ts:536-558`), a second class duplicates all of them.
- (b) `TextGeometry` from `three/addons`: rejected, needs a typeface JSON file, CLAUDE.md forbids asset downloads beyond CC0 textures.
- (c) Letters as a gnome type (instanced, AI): rejected, they would walk, get eaten for money by every machine and be counted in `gnomesEaten`.
- (d) Keeping the typed `BOOZE` code next to the letters: rejected, PP said "zamien" (replace).
- (e) Storing eaten letters in `state.secrets`: rejected, `secrets` survives rebirth (`freshState` keeps it) and Q3 recommends per run.

### Ladder
- `src/data/letters.ts` (new file): rung 6; spec "porozrzucane po landach (najwiecej w najwiekszym landzie)" needs a spot table; `src/data` is where balance numbers live (CLAUDE.md code map).
- `letterGeometry` in `models.ts`: rung 6 after rung 3 failed (TextGeometry needs a font asset); "Models are built from primitives in `src/world/models.ts`".
- Glow sprite on letters and the shovel: rung 2, the mushroom pattern (`mushrooms.ts:85`) and CLAUDE.md "use glow sprites instead" of lights.
- `state.letters`: rung 6; spec implies progress that survives a reload (letters are gone from the yard), rung 2 (`secrets`) rejected above.
- `Prop.kind 'letter'`, `spawnLetters`, `consumeLetter`: rung 2, the chair/flamingo pattern.
- Shop hook (one line): rung 5.
- Scenario file: rung 2, the `tools/smoke` pattern. No new dependency.

### Open decisions (for PP)
1. Which word? a) `GNOME`, 5 letters, 5 bodies, one per land plus two on Dark Forest; b) `GDI`, 3 letters, only three lands get one; c) `DISPOSAL`, 8 letters with a repeated letter, needs spot ids and 8 bodies. (recommendation: a, the game name's key word and exactly "jedna na land, najwiecej w najwiekszym" fits 1+1+1+2.)
2. Does order matter? a) any order, the toast shows which letters are still missing; b) strict order, a wrong letter is spat out and teleports back home. (recommendation: a, letters sit on different lands, strict order forces walking back and forth; with a there is no "wrong letter" at all.)
3. Per run or forever? a) per run: letters come back after a rebirth (new field `letters`, reset like `land`), saved across reloads, achievement forever; b) forever like the shovel (in `secrets`), one-time secret. (recommendation: a, a rebirth resets the land to Backyard anyway, so the letters on the bigger lands are a reason to buy them again; the buff is only 15 s, so a repeat is harmless.)
4. Only bought lands or also locked ones? a) only bought lands, the letter pops in when the land is bought; b) also locked lands, visible through the fence among the trees as a teaser. (recommendation: a, b risks a letter inside a random tree and needs spots hugging the fence; a also gives the purchase a small reveal.)
5. What does a letter pay? a) nothing per letter, a progress toast and sparks; the complete word pays Green Grog + the achievement + a $250 x value-scale coin fountain (the armchair's first-time amount); b) $50 x value-scale per letter too. (recommendation: a, the reward is the secret mode, money would turn letters into another armchair-style income.)
6. Achievement? a) keep id `booze` and name "Properly Boozed", new desc "Feed the hole the word GNOME."; players who already have it keep it, no migration; b) rename to "Spell It Out". (recommendation: a, the name matches the BOOZED mode it unlocks and old saves need nothing.)
7. Typed `GNOMERAIN`? a) stays; b) removed with BOOZE. (recommendation: a, PP named only the word for BOOZED.)
8. Physics like a gnome means gnomes can push letters? a) yes, dominance 0 like a gnome (a crowd can nudge a letter into the hole); b) like the chair, dominance 1, only the player, kicks and machines move it. (recommendation: a, "o fizyce jak gnomy" verbatim.)
9. [spec silent] Zakładam: placed tools (magnet, vacuum, black hole, belt, fan, robot, crate) and the Magnet Gun cone ignore letters; only hands/gun carry, kicks, the plow, the robot truck and gnomes move them | Dowód: `machines.ts:831, 902, 926, 968, 988, 1023` and `robots.ts:376` iterate `ctx.gnomes` only; `player.ts:558` carries `lookAt.prop` | Jeśli źle: a player expects a belt or robot to deliver a letter and it just lies there | Pewność: Confident | rekomendacja: a) keep as is, say it in SPEC ("litery nosisz sam").
10. [spec silent] Zakładam: the daily challenge gets letters like a new game (fresh state, same path) | Dowód: `main.ts:46` `daily.active ? freshState() : loadState()` | Jeśli źle: a 5-minute daily shows a letter nobody can use | Pewność: Likely | rekomendacja: a) same path, no special case.
11. [decision age] none: every decision this plan leans on is from 2026-10-19 or later.

### Self-check
- Every acceptance criterion has a step and a test: rows 1-20 map to steps 1-9 and checks L0-L20.
- Every step names file, function, signature and value; no "handle edge cases" lines.
- `state.letters`: writers `freshState`, `Hole.consumeLetter`; readers `Props.spawnLetters`, `Hole.consumeLetter` (Reach). `Props.list` readers listed with lines.
- Lists compared with the code: lands (4 in `land.ts`, letters cover all 4), things the hole eats (gnomes, chair, flamingo, the player, now letters), prop movers (player, kick, machines that target gnomes only, gnomes, events quake/tornado gnome-only) → 5 `spec silent` rows (13, 14, 15, 16, 19). Done-when lines: 20 = matrix rows: 20.
- Decisions older than 60 days: none (oldest note 2026-10-19).
- Plan length vs code: about 150 lines of code and a 150-line scenario; the plan is comparable because of the matrix and the questions, the steps themselves are shorter than the code.

## Review: performance (plan-performance)

Verdict: APPROVE

| plan step | operation | shape / reuse | multiplicity | volume (where measured) | cost | severity |
|---|---|---|---|---|---|---|
| 3 | `letterGeometry(ch)` via `build()` + `mergeGeometries` | one merged geometry per letter, 1 draw call | once per spawn (boot, `buyLand`) | 5x7 bitmap, at most ~25 cubes x 36 verts = ~900 verts per letter (read from plan) | one-off, sub-ms | none |
| 4 | letter material `vcMat({metalness, roughness, emissive})` | same shader features as the shovel and chair/flamingo `vcMat()` (vertexColors, no map), so three.js reuses the compiled program; values do not change the program key | 1 per letter | 5 materials | 0 new programs expected | Low (no check, see finding) |
| 4, 17 | glow `Sprite` per letter + 1 on the shovel | `glowTexture()` is cached (`mushrooms.ts:21-35`), SpriteMaterial program already exists (factory lamp `factory.ts:52`, always on scene) | 1 per letter | 6 sprites | +6 transparent draw calls, 0 new textures | none |
| 4 | letter mesh `castShadow` | shares the depth material of other props | 1 per letter | 5 meshes | +5 main + up to +5 shadow-pass draw calls | none |
| 4 | `dynamic()` body + cuboid collider, dominance 0 | same pattern as props; sleeps at rest | 5 bodies max | `Props.list` 4 -> 9 (read from plan, `props.ts:29-32`) | negligible next to the gnome crowd already in the same broadphase | none |
| 4 | `Props.update` per frame: `drawPose`, pop `setScalar(outBack)`, sprite pulse `sin` | O(list), no allocation in the loop (the `gone` array only when a letter is eaten) | per frame | 9 props | ~9 x a few flops | none |
| 4 | removal: `removeRigidBody`, `scene.remove`, `byCollider.delete`, splice | after the loop (Rapier rule kept) | once per eaten letter | 5 per run | geometry/material not disposed: 5 small geometries leaked per run, freed on reload | none |
| 4, 6 | `spawnLetters()` | 5 spots x `includes` on <= 5 chars + scan of 9 props | boot + each `buyLand` | 4 calls per run | trivial | none |
| 5 | `consumeLetter`: toast, `fx.burst(20)`, `saveState` on completion | event path, not per frame | 5 per run | - | trivial | none |
| 8 | HUD MAGNET line `kind === 'letter'` branch | per frame, string template only when aiming at a prop | per frame | 1 | trivial | none |
| 10 | headless scenario | 5 fps headless; L14 60 frames + L15 30 frames + 5 feeds of ~1 s fall each + pop sampling | one run | estimated ~1-2 min wall time | acceptable for a smoke run | none |

Findings:
- [Low] step 4 / step 10: when a letter pops in after `buyLand` mid-game, the plan relies on three.js reusing an existing shader program, but no check proves it; if a later edit adds `map` or `flatShading` to the letter material, the purchase frame recompiles a program and stutters (the hazard behind the CLAUDE.md lights rule) → fix: in L2/L3 read `g.renderer.info.programs.length` before and after `spawnLetters()` (plus 2 rendered frames) and assert delta 0, same pattern as `tools/smoke/scenario-perf.js:166-173`. Measured: estimated (program key read from `vcMat` and the plan's material options; not run).

No findings on: rigid body count (5), per-frame `Props.update` loop (9 props), glow texture (cached singleton), sprite program (already compiled by the factory lamp), draw calls (+~16 max), letter geometry size, removal order vs Rapier queries, `spawnLetters` frequency, save size (+5 chars).
Measured on: plan text and source read (`props.ts`, `mushrooms.ts:21-35, 85`, `models.ts:27-55`, `factory.ts:52`, `scenario-perf.js`); draw calls and frame time not measured (no headless run by this reviewer).

## Review: impact (plan-impact)

Verdict: CONCERNS

Missing from the plan:
- [High] `docs/ai-work/2026-10-20-plan-auto-lands.md` (final plan, queued in `BOARD.md:76, 79`) turns every land into a rectangle `[-22, 2·half − 22]` growing toward `DIR (7.5, 0, 13)` and moves the hole path to `holeCenterFor = DIR · (LAND_STEP·land + 1.2·(level−1))` (its step 2). When auto-lands ships after this plan, then `N (-27, 24)`, `M (-50, -20)` and `E (30, -52)` lie outside their fence (Garden becomes x,z ∈ [-22, 42], Forest [-22, 94]) and `O (38, 30)` lies inside Garden instead of Lawn, so three letters spawn among the forest trees or behind the wall and the word can never be completed, because the spots are fixed against today's centred square. Assumption 1 says "nothing else changes", which is false. L0 does not catch it: it checks `max(|x|,|z|) <= LAND[land].half - 2`, the centred-square rule, which auto-lands removes. Fix: write L0 against the live bounds (`env` fence of each tier, and `Environment.holeCenterFor` as it exists at run time), and add one line to the auto-lands plan's Reach: "`LETTER_SPOTS` in `src/data/letters.ts` must be re-picked for the rectangle; L0 proves it".
- [Medium] `docs/SPEC.md:224` (goals paragraph) also says "liczy się tylko grzybek podniesiony nogami (kod BOOZE nie)"; step 9 edits only `:225`, so its own check `rg -n "BOOZE" docs/SPEC.md` keeps a stale line that names a code which no longer exists. `docs/PLAN.md:144` ("secret word `BOOZE`") is also missed next to `:109`.
- [Medium] Done-when 20 `rg -n "BOOZE" src → 0 lines` cannot pass: `src/systems/buffs.ts:18` desc `'BOOZED! Everything x2, the world wobbles'` matches case-sensitively and the plan keeps it (assumption 5). Fix: `rg -n "BOOZE\b" src` or `rg -n "'BOOZE'" src`.
- [Low] L19 `rg -n "props" src/systems/hole.ts → only consumeLetter lines` fails on the existing comment `hole.ts:233` ("carrying props in was the best skill-free income"). Fix: assert on `ctx.props` instead.
- [Low] Line anchors in the plan point at the pre-commit tree: the fall-off branch is `props.ts:113-117` and `consumeProp` caller `props.ts:103` (plan says 118-122 / 118); `rebuildLand` caller `shop.ts:273` matches. Edits are text-anchored, so no harm; noted for the implementer.

Checked and covered by the plan (no change needed): `consumeTyped` callers (`main.ts:282, 287` only); `buffs.apply('booze')` mushroom path and lesson counter (`mushrooms.ts:151-153`, the counter sits outside `buffs.apply`, so `consumeLetter` cannot pass the lesson); `achievements.unlock` early return; `freshState` / `loadState` spread (`state.ts:72, 162`) and rebirth (`hole.ts:529-551` builds `freshState(old)` then `location.reload()`, so `Props` is rebuilt with `letters` = []); held-prop release on `falling` (`player.ts:728`) runs before the body is removed, and the falling collider is `NONE`, so `lookAt`/kick/grab never see a removed body; `player.ts:986` tool placement treats a letter as solid like the chair; `robots.ts:117` post ray filters `GROUND | STATIC`, letters ignored; `weather.ts:106` wets `GROUND | GNOME` only; `tornado.ts`, `strike.ts`, `machines.ts` and `robots.ts` never read `ctx.props`; menu achievement count `menu.ts:114, 135` reads `ACHIEVEMENTS.length` (26 today, unchanged).

Neighbours checked: save state: affected, covered (rows 7, 8, 12, 13) | rebirth: affected, covered (row 8, page reload) | daily challenge: affected, covered (row 13, `blockSaves`, fresh state) | hole consume path: affected, covered (new `consumeLetter`, `consumeProp` untouched) | tools / robots / magnet / vacuum / crate / fans / tornado / weather: not affected, none reads `ctx.props` or `G.PROP` bodies | goals / tutorial: not affected in code (lesson counts pickups only), SPEC text affected (finding 2) | achievements: affected, covered (desc only, id kept) | auto-lands: affected (finding 1; `buyLand` hook moves to `Hole.levelUp`, already in assumption 1) | replay: not affected, records gnome matrices only (`replay.ts:24`) | leaderboard: not affected, posts `totalEarned`/`holeLevel` | HUD: covered (row 18) | draft/live, profiles, serve-cache, polling/imports, find_best, dimensions, text index, prompt context, MeiliSearch: not applicable (browser game, no backend except the Supabase board).
FE/BE: not applicable (no API; save shape gains `letters`, read only by `Props` and `Hole`).
Decisions: consistent with `docs/ai-work/2026-10-20-plan-auto-lands.md` on the `buyLand` → `levelUp` move, conflicts with its geometry (finding 1); consistent with the fixed-spot shovel decision quoted in step 1 (PP 2026-10-20).
Decisions older than 60 days: none (oldest note in `docs/ai-work` is 2026-10-19).
Regression vs current behaviour: none. Typed `BOOZE` is removed on purpose (spec "zamien"); the 120 s `codeCd` still guards `GNOMERAIN`.

## Review: roast (plan-roaster)

Verdict: CONCERNS

Steel-man: the plan makes the letters props, so they get the hole fall-in, kick, grab, throw, hold-drop and HUD paths for free instead of a second entity class. Progress lives in one per-run array, which is reset by `freshState` and saved by the existing autosave and `beforeunload`. Removal is collected after the loop, which respects the Rapier rule. Strong points: fixed spots proven by a test (L0), rebirth safe by construction (`blockSaves()` before `location.reload()`), any-order completion with no "wrong letter" state, and old saves load with `[]` through the spread.

Findings:
- [Major] When the player throws a letter toward the fence, it flies over the wall and lies in the forest for the rest of the run, so the word can no longer be completed until a rebirth.
  Assumption: "falls off the map" (row 9) is the only way a letter leaves the play area.
  Scenario: Backyard, base Strong Arm (`throwJ` = 15), aim about 45 degrees up from 5 m inside the fence, RMB. A 1 kg letter gets about 15 m/s and peaks near 11 m, above the 8.5 m wall top; it lands on the ground slab outside the fence. With Strong Arm 15 (`J` = 48.75) it happens from anywhere. A kick does not do it (vertical 5.5 m/s, about 1.5 m).
  Checked: `player.ts:375-377` (`15 * (1 + 0.15 * lvl('throw'))`), `player.ts:690` (prop impulse `J` regardless of mass, letter mass 1 per step 4); walls `environment.ts:353-360` (`fixedCuboid(x, 4, z, hx, 4.5, hz)`, top at 8.5 m); ground slabs `environment.ts:226-231` are 200 m half-size, so the letter lands, never reaches `y < -10`; the only recovery `props.ts:108` is `y < -10 || |x| > 300` and checks neither `|z|` nor the fence. Gnomes have their own fence rule (`gnomes.ts:532`, `half + 30`), props do not. Today this only loses a flamingo or the chair (decorative, both also come back through the hole only), for a letter it blocks the feature.
  Impact: the player sees the progress toast stuck at e.g. `G N _ M E` with the `O` visible through the fence among the trees, and cannot reach it, because the walls block the player too.
  Recommendation: for letters, add the fence to the recovery branch: `Math.max(|t.x|, |t.z|) > ctx.env.half + 1` → teleport home + `savePose` + zero linvel (same three calls as `props.ts:109-111`), and add a matrix row and a check ("letter set to `half + 5`, frames → back near home").
- [Minor] L0 checks every land's own hole path (level 1 → 12) but not the straight slide line a `buyLand` makes from the current land's hole to the new land's anchor at the current level (radius up to 6). A letter on that line gets eaten during the slide. Checked: `environment.ts:413-421` (`slide = { from, to }`). My rough distances for the five spots to the three slide segments are all over 10 m, so this is a missing check, not a known bug; add the three segments to L0.
- [Minor] Step 5 says "push `ch` (skip if present)" but does not say the completion block sits inside the push branch. If it sits after it, a duplicate `consumeLetter('E')` on a full word pays the buff and the 250 x coins again. No duplicate can happen today (`spawnLetters` guards live letters), so only the wording needs a fix: "return early if present".
- [Minor] A letter eaten while held: checked safe. `updateHeld` runs before the body access and drops the prop when `falling` is true (`player.ts:728-730`), and `falling` stays true on a removed letter, so no code touches the removed body. Recorded so the implementer does not reset `falling` on removal.

Scenarios checked explicitly:
- State changes during the step (land bought while a letter lies near the new hole path): breaks the plan no, L0 spots are far from the paths; slide segment missing from L0 (Minor above).
- Fell off the map (`y < -10`): no, existing branch teleports home with `savePose` (`props.ts:108-112`).
- Thrown over the fence: yes (Major above).
- Stuck in a tree: no, trees are visual instances outside the fence only (`environment.ts:389-404`), the fence case is the Major.
- Under the factory or the house: no evidence of a gap; letter spots are far from both (factory `(-7.5, -13)`, house `z -27.5`). Roof: see Investigate.
- Thrown into the hole during rebirth: no, `rebirth()` saves the new state, then `blockSaves()`, then `location.reload()` (`hole.ts:548-550`); a letter eaten in the frames before unload mutates the old state and its `saveState` and the `beforeunload` save are both blocked (`state.ts:182-183`).
- Two letters eaten in one frame: no, both are consumed in the same loop, removed after it; the fifth push completes once.
- Reload mid-word: no, `beforeunload` saves (`main.ts:192-196`) plus the 10 s autosave; a letter eaten and lost by a crash just spawns again and can be eaten again, harmless.
- Rapier rules: no change to bodies inside a query callback (removal after the loop, kick query already collects first, `player.ts:830-835`); `savePose` after the teleport kept (`props.ts:110`). No collision event queue exists, so a removed collider cannot show up later.
- Letter picked up, then land reset: land is reset only by rebirth (`shop.ts:272` is the only `land` writer besides `freshState`), which reloads the page, so no live letter survives it.
- Old worker / new data shape: not applicable (one page, one process).

Pre-mortem: a week after the release PP writes "I have four letters and the O is in the forest". The unstated belief behind row 9 cracked first: "a letter that leaves the play area falls off the map". The missed signal was that props already have no fence rule while gnomes do (`gnomes.ts:532`); nobody noticed because a lost flamingo does not block anything.
Inversion worth considering: instead of removing an eaten letter (new `removeRigidBody` + splice path), reuse the existing hide path (`setEnabled(false)`, `visible = false`) with a respawn that never fires; it keeps `Props.list` stable for every reader and drops the only new Rapier removal code, at the cost of five idle disabled bodies.
Investigate first: can a thrown letter come to rest on the house roof (`z -27.5`, Garden and later) or the factory roof where the player cannot reach it? Recovery for the fence does not cover that case; a scripted throw onto the roof in the headless scenario answers it.

## Plan (plan-senior, final)

Status: needs-decision

Base: `main` at `80c3b4f`, working tree clean (`git status`: only `.idea/` and this file). The "uncommitted small batch" from v0 is already in that commit, so implement directly on `main`; anchor every edit by text.

### Resolutions
- R1: impact [High] fixed spots break under auto-lands vs v0 assumption 1 "nothing else changes": Decision: spots stay absolute in `src/data/letters.ts` (today's centred square), L0 reads the live bounds (`g.state.land = t; g.env.rebuildLand(); g.env.half` and `g.env.constructor.holeCenterFor(level, t)`) instead of `LAND[t].half`, assumption 1 is rewritten ("auto-lands must re-pick `LETTER_SPOTS` and L0's bound rule; its Reach gets that line"), and step 9 adds one line to the Reach of `docs/ai-work/2026-10-20-plan-auto-lands.md`. Rationale: auto-lands is queued behind tree expansion (`BOARD.md:79`) and changes the yard shape to a rectangle, so a relative formula written today would guess its geometry; the cheap fix is a test that reads what the yard says at run time plus a note where the other plan will trip. Checked: `BOARD.md:76-79`, `environment.ts:344` (`this.half = tier.half`), `environment.ts:195` (`static holeCenterFor(level, land)`).
- R2: roast [Major] letter thrown over the fence is lost for the run: Decision: accepted; step 4 adds a letter-only recovery `Math.max(Math.abs(t.x), Math.abs(t.z)) > ctx.env.half + 1` → the three home calls (`setTranslation`, `savePose`, `setLinvel 0`) plus `fx.burst`; new matrix row 21. Rationale: the ground slabs are 200 m, so `y < -10 || |x| > 300` never fires for a letter that lands behind the wall; gnomes already have a fence rule, props do not. Checked: `props.ts:108`, `environment.ts:226-231, 354`, `gnomes.ts:532`.
- R3: roast "Investigate first" (roof): Decision: resolved by code, no scripted throw needed; step 4 adds a second letter-only rule: a letter that is not held (`ctx.player.held?.prop !== p`), not falling, with `t.y > 2.5` and `linvel` length `< 0.2` for 3 s goes home the same way; new matrix row 22. Rationale: the house is a physics box with its top at y 6 (`fixedCuboid(0, 3, -27.5, 7, 3, 4.5)`), hidden inside the visual roof (`roof.position.y = 6`, peak 9.6), so a letter thrown onto the house rests on an invisible shelf nobody can reach; the factory top is the same kind of shelf. The 2.5 m / 3 s rule also covers a letter parked on a tall tool, which the player can still pick up at its home spot. Checked: `environment.ts:121`, `models.ts:230-234`, `factory.ts:78`.
- R4: roast inversion (hide instead of remove) vs v0 step 4 (`removeRigidBody` + splice): Decision: hide. An eaten letter takes the existing path (`setEnabled(false)`, `mesh.visible = false`) with `p.respawn = Infinity` ("eaten letters never come back this run"); `spawnLetters` guards with `!ctx.state.letters.includes(ch) && !this.list.some((q) => q.letter === ch)`. Rationale: rung 2 (the chair path) beats rung 6 (a new Rapier removal path with its own ordering rule); `Props.list` stays stable for all seven readers; the performance note about undisposed geometry becomes moot. Cost: five idle disabled bodies per run, nothing per frame (the `respawn > 0` branch `continue`s). Checked: `props.ts:82-95, 102-107`; `Infinity - dt === Infinity`.
- R5: impact [Medium] stale texts `docs/SPEC.md:224` ("kod BOOZE nie") and `docs/PLAN.md:144`: Decision: accepted, both in step 9.
- R6: impact [Medium] `rg -n "BOOZE" src → 0` cannot pass (`buffs.ts:18` "BOOZED!"): Decision: the check becomes `rg -n "BOOZE\b" src` → 0 lines; the `mushrooms.ts:151` comment ("the BOOZE code must not pass the mushroom lesson") is rewritten in step 7 so it stops matching. Rationale: `BOOZED` keeps the buff name on purpose (assumption 5).
- R7: impact [Low] L19 `rg "props"` matches the comment `hole.ts:233`: Decision: the check becomes `rg -n "ctx\.props" src/systems/hole.ts` → 0 lines (`consumeLetter` never touches `ctx.props`). Checked: `hole.ts:233, 261`.
- R8: impact [Low] line anchors from the pre-commit tree: Decision: accepted as a note; all anchors below are text (`props.ts` fall-off branch is the `t.y < -10` line, `consumeProp` call is in `update`).
- R9: roast [Minor] slide segments missing from L0: Decision: accepted; L0 also checks, for `t` in 1..3 and `level` in `LAND[t].hole..12`, the segment `holeCenterFor(level, t - 1)` → `holeCenterFor(level, t)` at >= 6.8 m. Checked: `environment.ts:415-420` (`slide = { from, to }` at the current level).
- R10: roast [Minor] duplicate `consumeLetter` on a full word: Decision: accepted; step 5 says "return early if `ch` is already in `letters`".
- R11: roast [Minor] `falling` must stay `true` on a hidden letter: Decision: accepted as a step 4 note; the hide path never resets it until a respawn, and `respawn = Infinity` never fires. Checked: `player.ts:728` releases the held prop on `falling || respawn > 0`.
- R12: performance [Low] no proof that the pop-in after `buyLand` compiles no shader: Decision: accepted; L2 reads `g.renderer.info.programs.length` before `spawnLetters()` and after two rendered frames, delta 0 (pattern `tools/smoke/scenario-perf.js:166-173`); new matrix row 23.
- v0 open decisions 6, 7, 8 (achievement name, GNOMERAIN, gnomes push letters): Decision: taken as assumptions, not sent to PP. Rationale: PP's words answer them: "to slowo zamien" names one code, so GNOMERAIN stays; "o fizyce jak gnomy" means dominance 0; the achievement keeps id and name "Properly Boozed" because it unlocks the BOOZED mode and old saves need nothing. Each stands in the matrix (rows 11, 15, 20) so PP can object.
- Rejected: none. The performance note "5 geometries leaked per run" is moot under R4 (no removal).

### Chosen variant
Letters are `Props` of kind `'letter'` (v0) with the chair's hide path for an eaten letter (R4) and two letter-only recovery rules: outside the fence and resting high (R2, R3). Pros: every grab, throw, kick, hold-drop, HUD and fall-in path comes free; `Props.list` never shrinks; the only new per-frame work is a pop scale, a sprite pulse and two cheap comparisons per letter. Cons: five disabled bodies linger per run; the 2.5 m / 3 s rule can send home a letter the player parked on a tall tool on purpose. Cost: +5 bodies, +5 meshes, +6 sprites, +~16 draw calls, 0 new shader programs (performance table, estimated, L2 proves it). Risk: the roast's "O in the forest" pre-mortem is closed by R2 and the roof case by R3; the auto-lands collision is a test plus a note (R1), not code. Ladder: rung 2 for the prop kind, hide path, glow sprite and scenario; rung 6 only for the spot table, `letterGeometry` and `state.letters` (reasons as in v0 Ladder).
### Rejected variant(s)
- (b) v0 as written (remove the body on eat, fence recovery only): pros: no idle bodies; cons: a new Rapier removal path with its own ordering rule, `Props.list` shrinks under seven readers, undisposed geometry per eat, and a letter on the house shelf (y 6) stays lost; rejected because it does not handle the roof scenario and costs more code than the hide path.
- (c) separate `Letters` entity class: rejected as in v0 (duplicates every prop path).
- (d) spots relative to the land ring, future-proof for auto-lands: rejected because auto-lands turns the square into a rectangle growing in one direction; any formula written today guesses that geometry and L0 would prove the wrong thing.

### Behaviour matrix (final)
| # | state / input | action | expected outcome | decided by |
|---|---|---|---|---|
| 1 | new game (`land` 0, `letters` []) | boot | one letter `G` at its Backyard spot: dynamic body, gold mesh + glow sprite; scale pops 0 → 1 over 0.25 s (`outBack`), one `fx.burst` at the spot | v0 row 1 |
| 2 | buy Garden (`shop.buyLand`) | after `env.rebuildLand()` | `N` pops in at its Garden spot; `state.letters` unchanged | Q4 a) |
| 3 | buy Neighbour's Lawn / Dark Forest | same | `O`; then `M` and `E` (two on the largest land) | spec |
| 4 | letter falls into the hole (`holeDist < r && y < 1.5`, then `y < -2.6`) | `Props.update` | `ctx.hole.consumeLetter(ch)`; body `setEnabled(false)`, mesh invisible, `respawn = Infinity`, `falling` stays `true`; `state.letters` += `ch`; toast with progress `_ _ _ _ E`; `audio.slurp()`; `fx.burst` at the hole; no money | Q5 a), R4, R11 |
| 5 | fifth letter eaten | `Hole.consumeLetter` | `buffs.apply('booze')`, `achievements.unlock('booze')`, `coins.burst(250 * valueScale, holeOrigin, 1.5)`, toast "GNOME! The hole is properly boozed.", `saveState`; a second call with a letter already in `letters` returns before any of it | spec, R10 |
| 6 | word completed again in a later run | same | buff + coins + toast; no achievement toast | `achievements.ts:13` |
| 7 | reload with `letters` = [G, N, O] on land 2 | boot | zero letters in the yard (G, N, O eaten; M, E not owned) | Q3 a) |
| 8 | rebirth | `freshState(old)` | `letters` = [], `land` 0 → only `G` after the reload; `secrets`, achievements kept | Q3 a) |
| 9 | letter at `y < -10` or `|x| > 300` | `Props.update` | teleported home (existing branch) | `props.ts` |
| 10 | letters eaten in any order | consume | counted; no "wrong letter" | Q2 a) |
| 11 | typing `BOOZE` / `GNOMERAIN` | key input | `BOOZE`: nothing; `GNOMERAIN`: rain with the 120 s `codeCd` | spec "zamien"; assumption |
| 12 | old save without `letters`, achievements with `booze` | load | `letters` = []; letters spawn; achievement stays | `state.ts` spread |
| 13 | `spec silent` daily challenge | boot | same path: `G` on Backyard, lands as reached | `main.ts:46` |
| 14 | `spec silent` placed tools, Magnet Gun cone, blower | run | ignore letters; hands and the Magnet Gun carry one via `lookAt.prop`; kicks, plow, robot truck and gnomes push them | `machines.ts`, `player.ts:558` |
| 15 | `spec silent` gnome crowd walks into a letter | physics | letter pushed (dominance 0, mass 1); chair keeps dominance 1 | spec "jak gnomy" |
| 16 | `spec silent` hole level-up or land slide | `Props.update` | spots >= 6.8 m from every land's hole path AND from every `buyLand` slide segment; a letter the player left on the path falls in and counts | `environment.ts:155, 415`, R9 |
| 17 | golden shovel not yet taken | boot + frame | glow sprite child on the shovel (gold, additive), scale `2.0 + sin(time * 6) * 0.3`; gone with the mesh on pickup | addendum |
| 18 | looking at a letter | HUD | MAGNET line `Letter G`; prompt unchanged | `hud.ts:488, 543` |
| 19 | `spec silent` `Hole.carry` on level-up | level-up | props never glide; `hole.ts` has no `ctx.props` reference | R7 |
| 20 | achievements list | render | 26 entries; `booze` secret, name "Properly Boozed", desc "Feed the hole the word GNOME." | assumption (v0 Q6 a) |
| 21 | letter thrown over the fence (`max(|x|,|z|) > env.half + 1`) | `Props.update` | teleported home at once, `savePose`, linvel 0, `fx.burst`; chair/flamingo unchanged | R2 |
| 22 | letter resting on the house/factory shelf (not held, not falling, `y > 2.5`, speed < 0.2 for 3 s) | `Props.update` | teleported home the same way; a thrown letter in flight (speed >= 0.2) or a held letter never triggers it | R3 |
| 23 | `N` pops in after `buyLand` mid-game | render | `renderer.info.programs.length` unchanged after two frames (no shader compile, no stutter) | R12 |

### Steps (edit order)
1. `src/data/letters.ts` (new) — `export const WORD = 'GNOME';` `export const LETTER_SPOTS: { ch: string; land: number; x: number; z: number }[] = [{ ch: 'G', land: 0, x: 15, z: -15 }, { ch: 'N', land: 1, x: -27, z: 24 }, { ch: 'O', land: 2, x: 38, z: 30 }, { ch: 'M', land: 3, x: -50, z: -20 }, { ch: 'E', land: 3, x: 30, z: -52 }];` with the comment from v0 step 1 plus "auto-lands (2026-10-20 plan) must re-pick these for the rectangle; L0 in scenario-letters.js is the proof". Red test: L0 (live bounds, hole paths and slide segments, R1/R9); the implementer may move a spot if L0 fails, keeping the per-land counts.
2. `src/core/state.ts` — `GameState.letters: string[]; // letters of the secret word the hole ate this run (src/data/letters.ts)`; `freshState`: `letters: [],` without `keep?.`. Red test: L8, L12, L13.
3. `src/world/models.ts` — `export function letterGeometry(ch: string): THREE.BufferGeometry`: `build()` of `box(0.14, 0.14, 0.16)` parts from a 5x7 bitmap (`string[]` per letter of WORD, `#` = cube), colour `0xffd23f`, centred, 0.7 m wide, 0.98 m tall, 0.16 m deep; comment "block letters from cubes: TextGeometry needs a font file (no asset downloads, CLAUDE.md)". Red test: L1 `boundingSphere.radius` in 0.5..0.7.
4. `src/entities/props.ts` — `Prop.kind: 'chair' | 'flamingo' | 'letter'`; new fields `letter?: string; pop: number; stuck: number;`. `add(kind, pos, letter?)`: for `'letter'` geometry `M.letterGeometry(letter)`, material `M.vcMat({ metalness: 0.8, roughness: 0.2, emissive: 0x332200 })`, glow sprite child (`glowTexture()` from `../entities/mushrooms`, color `0xffd23f`, `AdditiveBlending`, `depthWrite: false`, scale 2.0), body `dynamic()` WITHOUT `setDominanceGroup`, collider `cuboid(0.35, 0.49, 0.08).setMass(1).setFriction(0.7).setRestitution(0.15)` + `NORMAL` groups, `ctx.fx.burst(pos, 0xffd23f, 12)`; chair/flamingo branch untouched. New `spawnLetters(): void`: for each spot with `land <= ctx.state.land && !ctx.state.letters.includes(ch) && !this.list.some((q) => q.letter === ch)` → `add('letter', new THREE.Vector3(x, 0.6, z), ch)`; the constructor calls it after the flamingos; also add the same glow sprite to `this.shovel` (y 0.1). `update`, letter branch only: `p.pop += dt; mesh.scale.setScalar(outBack(Math.min(1, p.pop / 0.25)))`; sprite scale `2.0 + Math.sin(ctx.time * 6) * 0.3` (shovel sprite too, outside the loop); in the `falling && t.y < -2.6` block: `if (p.kind === 'letter') { ctx.hole.consumeLetter(p.letter!); p.respawn = Infinity; /* eaten letters never come back this run */ } else { ctx.hole.consumeProp(p.kind); p.respawn = 45; }` with the two hide calls shared; `falling` is not reset. After the existing fall-off `if`, letter-only recovery: `const out = Math.max(Math.abs(t.x), Math.abs(t.z)) > ctx.env.half + 1; const v = p.body.linvel(); const idle = !p.falling && ctx.player.held?.prop !== p && t.y > 2.5 && Math.hypot(v.x, v.y, v.z) < 0.2; p.stuck = idle ? p.stuck + dt : 0; if (p.kind === 'letter' && (out || p.stuck > 3))` → the three home calls + `ctx.fx.burst(p.home, 0xffd23f, 12)` + `p.stuck = 0`. Red tests: L1-L4, L9, L14, L15, L17, L21, L22.
5. `src/systems/hole.ts` — `consumeLetter(ch: string): void` next to `consumeProp`: `const s = ctx.state; if (s.letters.includes(ch)) return; s.letters.push(ch); ctx.audio.slurp(); ctx.fx.burst(this.holeOrigin, 0xffd23f, 20); const word = WORD.split('').map((c) => (s.letters.includes(c) ? c : '_')).join(' '); ctx.hud.toast(\`The hole swallowed ${ch}: ${word}\`, 'secret'); if (s.letters.length === WORD.length) { ctx.buffs.apply('booze'); ctx.achievements.unlock('booze'); ctx.coins.burst(250 * this.valueScale, this.holeOrigin, 1.5); ctx.hud.toast('GNOME! The hole is properly boozed.', 'secret'); saveState(s); }`. No `ctx.props` reference. Red tests: L4, L5, L6, L10, L19.
6. `src/ui/shop.ts` `buyLand` — after `ctx.env.rebuildLand();` add `ctx.props.spawnLetters();`. Red tests: L2 (with the programs delta), L3.
7. `src/main.ts` — delete the `consumeTyped('BOOZE')` block; keep `codeCd` and GNOMERAIN. `src/entities/mushrooms.ts` comment → "counted here, not in buffs.apply: the GNOME letters must not pass the mushroom lesson". Red tests: L11a, L11b.
8. `src/data/achievements.ts` — `booze` desc `'Feed the hole the word GNOME.'`. `src/ui/hud.ts` MAGNET line: `h?.prop ? (h.prop.kind === 'letter' ? \`Letter ${h.prop.letter}\` : 'Garden prop') : …`. Red tests: L18, L20.
9. Texts — `docs/SPEC.md:224`: "(kod BOOZE nie)" → "(litery GNOME nie)"; `docs/SPEC.md:225`: v0 text plus "litera wyrzucona za płot albo zostawiona na dachu wraca na swoje miejsce" and two decision bullets (per run; bought lands only; why); `docs/PLAN.md:109` and `:144` as v0 with `:144` → "the five GNOME letters"; `CHANGELOG.md` new section, two bullets, no numbers; `docs/ai-work/2026-10-20-plan-auto-lands.md` Reach: one line "`LETTER_SPOTS` in `src/data/letters.ts` must be re-picked for the rectangle; `scenario-letters.js` L0 proves it". Check: `rg -n "BOOZE\b" docs/SPEC.md docs/PLAN.md src` → 0 lines.
10. `tools/smoke/scenario-letters.js` (new, permanent) — checks L0-L22 as in v0 Tests with these changes: L0 live bounds + slide segments (R1, R9); L2 programs delta 0 (R12); L4 asserts `p.body.isEnabled() === false`, `mesh.visible === false`, `p.respawn === Infinity`, `p` still in `list` and `byCollider` (R4); L19 `rg -n "ctx\.props" src/systems/hole.ts` → 0; new L21 (`setTranslation({x: half + 5, y: 1, z: 0})`, frames → within 3 m of home); new L22 (`setTranslation({x: 0, y: 6.5, z: -27.5})` onto the house box, 20 frames at 5 fps ≈ 4 s → within 3 m of home; a letter at y 6.5 with linvel `(0, 0, 8)` sampled after 3 frames is still above the house, not home). Run: `URL_QUERY='' DEV_PORT=5199 FAKELOCK=1 node tools/smoke/smoke.mjs lt-out tools/smoke/scenario-letters.js`.

### Review focus
1. Letter over the wall with Strong Arm 15 (roast scenario) → pinned by step 4's test L21.
2. Letter resting on the invisible house shelf at y 6 (roast "Investigate", R3) → pinned by step 4's test L22, including the in-flight negative case.
3. Held letter eaten (release before body access, `falling` never reset) → pinned by step 4's test L4 asserting `g.player.held === null` after feeding a letter held by hand (add to L4).
4. Land bought mid-game recompiles a shader (performance) → pinned by step 6's test L2 programs delta.
5. Auto-lands moves the fence and the hole line (impact High) → pinned by step 1's test L0 reading live `env.half` and `holeCenterFor`, plus the Reach line in the auto-lands plan (step 9).

### Done when
1. `node tools/smoke/smoke.mjs lt-out tools/smoke/scenario-letters.js` → `PASS L1` (1 letter G on a new game, pop-in sampled with overshoot, radius 0.5..0.7)
2. → `PASS L2` (Garden bought → G, N; `programs.length` delta 0)
3. → `PASS L3` (Dark Forest → 5 letters, M and E on land 3)
4. → `PASS L4` (E eaten: body disabled, mesh hidden, `respawn === Infinity`, still in `list`; `letters` = ['E']; toast `_ _ _ _ E`; money unchanged; `held === null` when fed from the hand)
5. → `PASS L5` (fifth letter: buff, achievement, 250 x valueScale, final toast; `consumeLetter('E')` again → no second buff/coins)
6. → `PASS L6` (second completion: buff, no achievement toast)
7. → `PASS L7` (reload with 3 eaten on land 2: 0 letters)
8. → `PASS L8` (`freshState` drops `letters`, keeps `secrets`)
9. → `PASS L9` (letter at y -12 returns home)
10. → `PASS L10` (reverse order completes)
11. → `PASS L11a` and `PASS L11b` (BOOZE dead, GNOMERAIN alive); `rg -n "consumeTyped" src` → one line, `GNOMERAIN`
12. → `PASS L12` (old save without `letters` loads with `[]`, achievement kept)
13. → `PASS L13` (daily fresh state has `letters` [])
14. → `PASS L14` (magnet tool ignores a letter, kick moves it)
15. → `PASS L15` (a gnome pushes a letter); `rg -n "setDominanceGroup" src/entities/props.ts` → 1 line, not on the letter branch
16. → `PASS L0` (every spot >= 6.8 m from all 4 hole paths and all slide segments, inside live `env.half - 2`, outside the previous land's `half + 1`)
17. → `PASS L17` (shovel glow sprite pulses, gone after pickup); `lt-out/shovel.png` shows the glint by eye
18. → `PASS L18` (HUD says `Letter G`)
19. → `PASS L19` (`rg -n "ctx\.props" src/systems/hole.ts` → 0 lines)
20. → `PASS L20` (26 achievements, `booze` secret with the new desc); `rg -n "BOOZE\b" src docs/SPEC.md docs/PLAN.md` → 0 lines
21. → `PASS L21` (letter at `half + 5` → home within 3 m, burst fired; chair at `half + 5` stays there)
22. → `PASS L22` (letter resting on the house box at y 6.5 for ~4 s → home; letter flying over the house after 3 frames → not home)
23. → `PASS L2` programs line printed as `programs 0` (row 23); `lt-out/letters-pop.png` shows the pop by eye

### Decisions for PP
1. Jakie słowo zbierają gracze? a) GNOME: pięć liter, po jednej na Backyard, Garden i Neighbour's Lawn, dwie w Dark Forest; b) GDI: trzy litery, Dark Forest bez litery; c) DISPOSAL: osiem liter, po dwie-trzy na land, dłuższe szukanie. (rekomendacja: a, bo to słowo z nazwy gry i pasuje do „najwięcej w największym landzie")
2. Czy kolejność liter ma znaczenie? a) dowolna: komunikat po każdej literze pokazuje, których brakuje; b) ścisła: zła litera wraca na swoje miejsce i trzeba iść po właściwą. (rekomendacja: a, bo litery leżą na różnych landach i ścisła kolejność to bieganie tam i z powrotem)
3. Litery na jedno życie czy na zawsze? a) po odrodzeniu litery wracają i Green Grog można zdobyć znowu, osiągnięcie raz; b) jak łopata: raz na zawsze. (rekomendacja: a, bo odrodzenie i tak cofa landy, więc litery dają powód, żeby kupić je znowu)
4. Gdzie leżą litery z niekupionych landów? a) litera pojawia się w chwili kupna ziemi, kupno ma małą niespodziankę; b) widać ją za płotem między drzewami jako zachętę. (rekomendacja: a, bo b ryzykuje literę w drzewie i wymusza miejsca tuż przy płocie)
5. Czy pojedyncza litera płaci? a) nic; komplet daje Green Grog, osiągnięcie i fontannę $250 razy mnożnik; b) dodatkowo $50 razy mnożnik za każdą literę. (rekomendacja: a, bo nagrodą jest tryb BOOZED, a kasa zrobiłaby z liter drugi fotel)
6. [spec silent] Zakładam: postawione narzędzia (magnes, odkurzacz, czarna dziura, taśma, wiatrak, robot, skrzynia) i stożek Magnet Guna nie ruszają liter; literę nosisz ręką albo Magnet Gunem, kopiesz, pcha ją pług, ciężarówka robota i gnomy | Dowód: `machines.ts:831-1023` i `robots.ts:376` iterują tylko `ctx.gnomes`; `player.ts:558` nosi `lookAt.prop` | Jeśli źle: gracz położy literę na taśmie albo zostawi robotowi i ona nie dojedzie | rekomendacja: a) zostaje tak, SPEC mówi „litery nosisz sam"
7. [spec silent] Zakładam: 5-minutowy daily challenge dostaje literę G jak nowa gra | Dowód: `main.ts:46` `daily.active ? freshState() : loadState()` | Jeśli źle: w daily leży litera, której nikt nie zdąży użyć | rekomendacja: a) bez wyjątku, ta sama ścieżka

### v0 → final
- added: fence recovery for letters (row 21), roof/shelf recovery (row 22), shader-program check on pop-in (row 23), slide segments in L0, early return in `consumeLetter`, stale texts `SPEC.md:224` and `PLAN.md:144`, Reach line for the auto-lands plan.
- changed: eaten letters are hidden with `respawn = Infinity` instead of removed (rung 2, `Props.list` stable); L0 reads live bounds; three done-when checks fixed so they can pass (`BOOZE\b`, `ctx\.props`, L4 shape).
- dropped: the `removeRigidBody` + splice path and the `gone` array.
- moved to PP: 5 product questions (word, order, per run, bought lands only, pay) and 2 spec-silent assumptions; v0 questions 6-8 became assumptions answered by PP's own words.

### Decisions for PP (answers)

PP (2026-10-21, Slack 13:01), verbatim: "1. a. tak ale po zmianie landu litery nie znikaja jesli sa przykryte krzakami to krzaki zostaja. musi sie dac zlozyc slowo. niech to bedzie jak lopata raz na save. 2. a. 3. b. 4. b. 5. a."

- Q1 = a: the word is GNOME. When the player buys a new land, letters already lying on earlier lands do not disappear and stay collectible. A letter hidden in bushes keeps its bushes; it must still be reachable, so the word can always be completed.
- Q2 = a: any order; the toast after each letter shows the missing ones.
- Q3 = b: once per save, like the Golden Shovel; letters do not come back after a rebirth, and eaten letters stay eaten.
- Q4 = b: a letter of a land not bought yet is visible beyond the fence as a teaser and becomes reachable when that land is bought. Its spot must be clear of trees, inside the future land, and visible from the current yard.
- Q5 = a: a single letter pays nothing; the full word gives Green Grog (BOOZED), the achievement and the coin fountain.
- Q6, Q7: the senior's assumptions stand (letters are carried by the player only; the daily challenge gets letters like a new game).
