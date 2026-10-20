# Plan: arcade rework (magnet gun, gnome weight, trick shots)

Spec: PP 2026-10-19 (`docs/ai-work/2026-10-19-arcade-rework.md`): "make it more of a skill/arcade game; add weight to gnomes; remove carrying more than one gnome, replace with a magnet that obeys physics, upgrades make it wider/stronger; weight differs by level; add variety".
Context decisions (all dated 2026-10-19, none older than 60 days): fans stay a gentle push, no full automation; crate is a gnome container (playtest round 1); thrown gnomes cannot be re-grabbed for 1.5 s; hole mult x1..x10, ~11k gnomes to max.
Trivial check: touches player controller, gnome entity, spawn path, hole scoring, machines, HUD, goals, shop data, saves. Not trivial.

## Plan v0 (plan-author)

### Goal
The player disposes of gnomes one at a time with a force-based magnet beam; gnome mass (type x weight tier rolled from the hole level) decides what the magnet can lift, how far a throw flies and how much the hole pays; trick shots pay extra, machine disposal pays less.

### Design pillars (arcade)
1. Skill expression: aim (cone target), timing (charge throw, bullseye ring), physics (impulse throws: heavy = short lob, light = rocket).
2. Risk/reward: heavy tiers pay x1.6/x2.5 but drag on the ground until the magnet is upgraded; long/air shots pay more but miss more.
3. Short feedback loops: every eaten gnome shows its multiplier label; combo timer freezes while a gnome hangs on the beam, so heavy hauls do not kill a combo.

### Mechanics with numbers

**Magnet beam (hold LMB).** One body at a time: the gnome closest to the crosshair inside a cone (`coneTarget`, existing) or the prop/crate under the crosshair. Every frame while held (before `physics.step`, as the loop already orders it):
- hold point `H = eye + dir * 2.2 + (0, -0.3, 0)`; `Δ = H - p`; `v_rel = v_gnome - player.vel`.
- `F = k*Δ - c*v_rel`, `k = 2*P`, `c = 2*sqrt(k*m)` (critically damped for any mass), then `|F|` clamped to `P`; apply `body.applyImpulse(F*dt, true)`; gravity scale stays 1 (today `hold()` sets it to 0: remove). Angular velocity x0.9 per frame (existing line).
- `P = 45 * (1 + 0.2 * lvl('magPower'))` (gravity is 20, so max liftable mass = P/20: 2.25 at level 0, 6.75 at level 10).
- Range `7 + 1.2 * lvl('magRange')` m, cone `minDot = 0.94 - 0.02 * lvl('magRange')` (about 20° to 33°).
- Too heavy (`m*20 > P`): the beam still pulls, the body slides along the ground toward the player and stalls near the feet (friction 0.7). HUD shows `TOO HEAVY (mass x3.5)`. No special code: it is the same force.
- Auto release: hold point farther than 6 m (existing rule), body gone, or state changed by someone else.
- Collision: held gnome keeps group `HELD` (no PLAYER bit), so it never pushes the kinematic capsule. The player gets `vel` (position delta / dt) in `move()` for the damping term.
- Stability: `|F| <= P` bounds energy; impulse is applied once per render frame (dt <= 0.05) with critical damping, stable for `dt*sqrt(k/m) < 2` (worst case light dwarf m = 0.3: 0.05*17 = 0.87).

**Throw (RMB).** Press starts a charge, release throws: impulse `J = 15 * (1 + 0.15*lvl('throw')) * (1 + 0.8*min(1, chargeTime/0.6))` along `dir` plus `0.17*J` up, `noGrabUntil = time + 1.5` (kept). Velocity = J/m: normal classic 15 m/s, heavy (x2) 7.5 m/s, massive (x3.5) 4.3 m/s, light (x0.6) charged 45 m/s (UFO ammo). Release LMB = drop with no impulse (keeps current velocity).

**Weight tiers** (rolled in `gnomes.spawn` for every spawn source; king always normal):

| tier | mass x | scale x | value x | id |
|---|---|---|---|---|
| light | 0.6 | 0.90 | 0.8 | `light` |
| normal | 1 | 1 | 1 | `normal` |
| heavy | 2 | 1.15 | 1.6 | `heavy` |
| massive | 3.5 | 1.30 | 2.5 | `massive` |

Probabilities by hole level L: `light = max(0.05, 0.30 - 0.025*(L-1))`, `heavy = min(0.40, 0.05 + 0.035*(L-1))`, `massive = max(0, 0.03*(L-4))`, normal = rest.

| L | light | normal | heavy | massive | mean mass | mean value |
|---|---|---|---|---|---|---|
| 1 | .30 | .65 | .05 | 0 | 0.93 | 0.97 |
| 2 | .275 | .64 | .085 | 0 | 0.98 | 1.00 |
| 3 | .25 | .63 | .12 | 0 | 1.02 | 1.02 |
| 4 | .225 | .62 | .155 | 0 | 1.07 | 1.05 |
| 5 | .20 | .58 | .19 | .03 | 1.19 | 1.12 |
| 6 | .175 | .54 | .225 | .06 | 1.30 | 1.19 |
| 7 | .15 | .50 | .26 | .09 | 1.43 | 1.26 |
| 8 | .125 | .46 | .295 | .12 | 1.55 | 1.33 |
| 9 | .10 | .42 | .33 | .15 | 1.67 | 1.41 |
| 10 | .075 | .38 | .365 | .18 | 1.79 | 1.48 |
| 11 | .05 | .34 | .40 | .21 | 1.90 | 1.55 |
| 12 | .05 | .31 | .40 | .24 | 1.98 | 1.59 |

Collider mass = `type.mass * tier.mass`; `g.scale *= tier.scale` (size is the visual tell, instanced meshes need no per-instance colour); XP unchanged (the ~11k gnome curve stays). Magnet milestones: heavy classic (2.0) lifts at level 0 slowly, massive classic (3.5) needs magPower 3 (P=72), massive angry (4.55) magPower 6, fat normal (6) magPower 9, king never.
Kicks and every machine/NPC force keep multiplying by `g.type.mass` (code unchanged), so a heavy-tier gnome gets 1/2 or 1/3.5 of the usual acceleration from fans, wheels, cannons, vacuums, quakes and kicks: automation handles light stuff, the upgraded magnet handles the heavy money. Player kick switches from `body.mass()` to `g.type.mass` for the same reason.

**Trick scoring** (in `hole.consume`, labels via existing `fx.floatText`/`hud.bigText`): `value *= tier.value * long * air * trick * bullseye * machine`.
- LONG SHOT x1.5: `thrownBy === 'player'` and `throwPos` to hole centre >= 8 m; SNIPER x2 at >= 14 m (replaces LONG).
- AIR x1.3: thrown by player and never below `0.5*scale + 0.05` since the throw (`touchedGround` flag set in the existing ragdoll branch of `gnomes.update`).
- TRICK x1.5: a player-thrown gnome bounced on a trampoline before the hole (`bounced` flag; trampoline keeps `thrownBy = 'player'`).
- BULLSEYE x3 and combo +3: passed through the ring (below).
- HEAVY HAUL label for massive tier (x2.5 comes from the tier table).
- Machine-fed x0.5: `thrownBy === 'machine'` or consumed by vacuum/black hole/crate dump (open decision 2).
- Combo timer does not tick while `player.held?.gnome` exists.

**Variety ideas ranked (fun / effort)**
1. Bullseye ring (high / medium): torus r=0.6 floating 2.5 m above the hole, drifting on a circle of radius `holeRadius*0.6` at 0.4 rad/s; a player-thrown ragdoll gnome whose centre crosses the ring disc (within 0.6 of ring centre, |dy| < 0.3) gets `bullseye = true`. In this session.
2. OVERTIME rush event (high / low): factory runs at 2 gnomes/s for 20 s without E; gnomes eaten during it x1.5. In this session.
3. Skill goals (medium / low): LONG SHOT, AIR, BULLSEYE, HEAVY HAUL goals after "Reach a 15 combo". In this session.
4. Trampoline trick (high / low): part of trick scoring above. In this session.
5. Wind event (medium / low): 30 s side wind, 6 N on airborne player-thrown gnomes; aim compensation. Open decision 5.
6. Magnet slingshot (emergent, zero effort): flicking the view while holding adds velocity through the PD force; document, do not code.
7. Juggle (re-catch in air): rejected, conflicts with the 1.5 s no-regrab decision of 2026-10-19.
8. Hole wobble / moving hole: rejected, `rebuildHole` rebuilds four ground bodies and the ground mesh; the ring is the moving target.
9. Chain strike (thrown gnome hits another): rejected this round, needs Rapier contact events in the main loop.
10. Hazards (grog puddle, ice): low fun for the effort; not planned.

**Removed or nerfed**: upgrades `arms` (Strong Arms) and `vac` (Gnome Vac) removed, replaced by `magPower` and `magRange`; multi-carry removed; crate stays as a container but is a 5 kg body under the same beam (drags at level 0, lifts at magPower 7); machine-fed gnomes x0.5 (decision 2). Machine caps unchanged (cannon 2, vacuum 2, black hole 1).

### Behaviour matrix
| # | state / input | action | expected outcome | source |
|---|---|---|---|---|
| 1 | normal classic (m=1) in cone, magPower 0 | hold LMB | state `held`, reaches y > 1.0 within 60 frames | spec: magnet obeys physics |
| 2 | heavy classic (m=2) in cone, magPower 0 | hold LMB | lifts slowly: y > 1.0 within 120 frames | tier table |
| 3 | massive classic (m=3.5), magPower 0 | hold LMB 120 frames | y < 0.8, horizontal distance to player shrinks, HUD contains `TOO HEAVY` | spec: too heavy drags |
| 4 | massive classic, magPower 3 | hold LMB | y > 1.0 within 120 frames | upgrade makes it stronger |
| 5 | two gnomes in cone | hold LMB 60 frames | exactly one gnome in state `held` | spec: one at a time |
| 6 | holding, LMB released | release | state `ragdoll`, no impulse added, gravity 1 | spec |
| 7 | holding normal classic | RMB press+release same frame | linvel 13.5-16.5 m/s | throw impulse |
| 8 | holding heavy classic | RMB tap | linvel 6.5-8.5 m/s | J/m |
| 9 | holding normal classic | RMB held 40 frames then released | linvel 24-30 m/s | charge |
| 10 | thrown from >= 8 m, no ground contact, lands in hole | consume | value x1.5 x1.3, `stats.longShots` +1, `stats.airShots` +1 | trick scoring |
| 11 | thrown, touched ground first | consume | no AIR factor | trick scoring |
| 12 | thrown, bounced on trampoline, then hole | consume | TRICK x1.5, `thrownBy` still `player` | variety 4 |
| 13 | thrown through the bullseye ring | consume | x3, combo +3, `stats.bullseyes` +1 | variety 1 |
| 14 | massive gnome eaten | consume | value x2.5, label HEAVY HAUL, `stats.hauls` +1 | tier table |
| 15 | spawn 300 at L1 / 300 at L12 (`spawn` without tier) | count tiers | L1: massive 0, light 60-120; L12: massive 45-100 | tier table |
| 16 | held gnome dragged into the hole radius (too heavy to lift) | drag | consumed with x2.5 (not silently removed at y < -8) | bug found: `update` skips `held` |
| 17 | kick massive classic vs kick normal classic | F | massive linvel about 1/3.5 of normal | weight vs kick |
| 18 | fan vs massive classic (machines unchanged, `g.type.mass`) | fan running | massive accelerates 1/3.5 of normal | spec silent: machines |
| 19 | gnome fired by cannon / eaten by vacuum / black hole / crate dump | consume | value x0.5, label AUTO | spec silent: machine disposal (decision 2) |
| 20 | crate (5 kg) under beam, magPower 0 / 7 | hold LMB | 0: y < 0.9 after 120 frames; 7: y > 1.2 | spec silent: crate carry |
| 21 | flamingo (1.5) / chair (8) under beam | hold LMB | flamingo lifts; chair slides, y < 1.0 | spec silent: props carry |
| 22 | king in cone | hold LMB | not targeted, prompt says too heavy, king AI keeps running | boss exploit guard |
| 23 | holding a gnome, combo 5 | wait 200 frames | `hole.combo` still 5 | combo freeze |
| 24 | OVERTIME event started | 20 s | `stats.produced` +35..45 with E never held; eaten during it x1.5 | variety 2 |
| 25 | old save `upgrades.arms=5, vac=1` | boot | game loads, shop Movement tab has no Strong Arms/Gnome Vac, `lvl('magPower')=0` | removal |
| 26 | parade / rain / night visitor spawns | spawn | tier rolled (not always normal) | spec silent: spawn sources |
| 27 | held gnome, hold point > 6 m away (player sprints away behind a fence) | frames | auto released, `player.held === null` | existing rule kept |
| 28 | stashed gnome (crate/cannon queue) | beam | never targeted (`isFree`) | spec silent: states |

Rows marked spec silent: 18, 19, 20, 21, 26, 28 (6).

### Reach
- `src/player/player.ts:19` `held: Gnome[]` readers: `src/ui/hud.ts:224-227` (sack panel), player internals (`updateHeld` 269-321, `actions` 196-266, `dropAll` 502, `raycast` skip 174). Becomes `held: { body; gnome?; prop?; crate? } | null`.
- `player.capacity` (`player.ts:75`): `hud.ts:224,227`, `player.ts:210`. Removed.
- `player.carrying` (`player.ts:21`): `src/entities/machines.ts:366` (crate respawn clears it), `hud.ts:248`, player. Merged into `held`.
- `lvl('arms')`: `player.ts:76,324`; `lvl('vac')`: `player.ts:213,331`; definitions `src/data/upgrades.ts:24,27`. `main.ts:31-34` clamps saved levels to `u.max`, removed ids are simply ignored by `lvl()`.
- `gnomes.hold` (`gnomes.ts:147`): `player.ts:214`. `gnomes.drop` (`gnomes.ts:155`): `player.ts:225,244,317,503`. State `'held'` checks: `gnomes.ts:39,269`, `player.ts:175,292`.
- `gnomes.spawn` (`gnomes.ts:76`) callers: `src/entities/factory.ts:61`, `src/systems/events.ts:63,120,168`, `gnomes.ts:221`. Tier roll lives in `spawn`, so all five get it.
- `hole.consume` (`hole.ts:57`) callers: `gnomes.ts:274` (falling), `machines.ts:377` (crate dump), `machines.ts:523` (vacuum/black hole).
- `thrownBy` writers: `gnomes.ts:137,165,177,345`, `machines.ts:418 (trampoline via ragdoll by='machine'),506`; readers: `events.ts:240` (UFO hit), new trick scoring.
- `g.type.mass` users left unchanged: `machines.ts:431,475,476,495,529,530`, `gnomes.ts:391,502`, `events.ts:81,82`. `body.mass()` user changed: `player.ts:373` (kick).
- Texts that mention arms/sack/carry: `hud.ts:90,220,227,248,252-254`, `player.ts:220,404`, `src/systems/goals.ts:20,21,26`, `machines.ts:398`, `src/ui/menu.ts:66,69`, `upgrades.ts:24,27,30`, `docs/PLAN.md` controls and shop tables.
- Stats (`src/core/state.ts:24-40`): `grabbed` stays (counts beam grabs, goal 2), `thrown` stays; new `longShots, airShots, bullseyes, hauls`. `loadState` merges `base.stats`, so old saves get zeros.
- Front/HUD contract: `hud.update` reads `player.held`, `player.charge` (0..1), `player.lookAt`; prompt strings change.
- Smoke scenarios in the session scratchpad (`smoke/scenario1-9.js`) drive `P.held` as an array and `inp.mouse.left`; they need rewriting to the new shape (they are not in the repo).

### Data
- No database. Save is `localStorage` JSON; new stats fields default through `loadState` merge (`state.ts:97`).
- Volume: gnomes on field <= `120 + 40*5 = 320` (`gnomes.ts:73`), physics cap about 450 (`docs/PLAN.md`). Magnet cone scan = `forEachNear` over the list once per frame while LMB is held (same cost as today's `coneTarget`). Bullseye check iterates only `thrownBy === 'player' && state === 'ragdoll'` gnomes (a handful). Ring mesh: one torus + one sprite, no new lights (CLAUDE.md rule).
- Logic budget today: 0.9 ms/frame at 280 gnomes; added work is O(held) + O(thrown), negligible.

### Steps (edit order)
1. `src/data/gnomeTypes.ts`: add `export interface WeightTier { id: 'light'|'normal'|'heavy'|'massive'; mass: number; scale: number; value: number }`, `WEIGHT_TIERS` (table above), `export function rollTier(holeLevel: number): WeightTier` (probabilities above, `Math.random`).
2. `src/data/upgrades.ts`: delete `arms`, `vac`; add `U('magPower', 'Movement', 'Magnet Coil', '+20% magnet pull. Lifts heavier gnomes.', 10, 25, 1.45)` and `U('magRange', 'Movement', 'Magnet Dish', '+1.2 m beam range, wider cone.', 5, 60, 1.6, 2)`; `throw` desc: '+15% throw power. Heavy gnomes still fly shorter.'; `box` desc: 'Drop or throw gnomes in (12 fit), drag it into the hole with the magnet.'
3. `src/core/state.ts`: stats `longShots`, `airShots`, `bullseyes`, `hauls` (type + `freshState` zeros).
4. `src/entities/gnomes.ts`: `Gnome` gets `tier: WeightTier`, `throwPos: THREE.Vector3 | null`, `touchedGround: boolean`, `bounced: boolean`, `bullseye: boolean`; `spawn(typeId, pos, opts: {..., tier?: WeightTier['id']})` rolls `opts.tier ?? rollTier(ctx.state.holeLevel)` (king forced normal), `setMass(type.mass * tier.mass)`, `scale *= tier.scale`; `hold(g)`: remove `setGravityScale(0)`; `drop(g, impulse?: THREE.Vector3)`: `applyImpulse` instead of `setLinvel`, when impulse given set `throwPos = translation`, `touchedGround = bounced = bullseye = false`; `update`: for `state === 'held'` run only the hole check (`dc < r && p.y < 1.4*scale` → `drop` then `startFalling`) and `continue`; in the ragdoll branch set `touchedGround = true` when `thrownBy === 'player' && p.y < 0.5*scale + 0.05`; `standUp` clears `throwPos`.
5. `src/player/player.ts`: `held: { body: RAPIER.RigidBody; gnome?: Gnome; prop?: Prop; crate?: Machine } | null`, `vel = new THREE.Vector3()`, `charge = 0`; delete `capacity`, `carrying`, `grabbable`'s fat/arms clause (keep `isFree`, `noGrabUntil`, `king` exclusion); `move()` sets `vel`; `actions()`: LMB pressed with no `held` → crate/prop under crosshair else `coneTarget()` with `range = 7 + 1.2*lvl('magRange')`, `minDot = 0.94 - 0.02*lvl('magRange')`; grab → `gnomes.hold`, `stats.grabbed++`; LMB up → `gnomes.drop(g)` / clear; RMB down → `charge += dt/0.6` (cap 1); RMB up while held → impulse `J = 15*(1+0.15*lvl('throw'))*(1+0.8*charge)` as `dir*J + (0,0.17J,0)`; gnome via `drop(g, impulse)` + `stats.thrown++`, prop/crate via `body.applyImpulse`; `updateHeld()` = the PD force above with `P = 45*(1+0.2*lvl('magPower'))`, crate keeps the upright rotation line; `kick()` uses `g ? g.type.mass : body.mass()`; `dropAll()` releases `held`.
6. `src/systems/hole.ts`: `consume(g, at?)` multiplies by `g.tier.value`, long/sniper, air, trick, bullseye (+3 combo), machine x0.5 (if decision 2 = yes: `g.thrownBy === 'machine' || at !== undefined || fromCrate`; add param `by: 'player'|'machine'` instead of guessing: callers `machines.ts:377,523` pass `'machine'`, `gnomes.ts:274` passes `g.thrownBy === 'machine' ? 'machine' : 'player'`); float labels joined with ' '; stats increments; `update(dt)`: skip combo countdown when `ctx.player.held?.gnome`; add `ring` (torus + sprite, built in constructor after `env`, repositioned on `levelUp`), `updateRing(dt)` drifts it and flags `bullseye` on crossing gnomes.
7. `src/entities/machines.ts`: crate respawn `if (ctx.player.held?.crate === m) ctx.player.held = null`; trampoline `gn.ragdoll(g, 2.5, g.thrownBy === 'player' ? 'player' : 'machine')` and `if (g.thrownBy === 'player') g.bounced = true`; toasts at 398 and `nearestWorking` unchanged.
8. `src/entities/factory.ts`: `rush = 0`; `update`: `rate += rush > 0 ? 2 : 0`, `rush -= dt`; HUD bar already shows `running`.
9. `src/systems/events.ts`: `{ id: 'rush', name: 'OVERTIME', sub: 'The factory goes wild for 20 s. Everything eaten now is worth x1.5.', weight: 2, ok: () => true }`, `start('rush')` sets `ctx.factory.rush = 20`; `hole.consume` multiplies x1.5 while `ctx.factory.rush > 0`.
10. `src/ui/hud.ts`: sack panel → `MAGNET` panel: holding `<type name> · <tier id> · mass x<m>` plus `TOO HEAVY` when `m*20 > P` (expose `player.magnetPower` getter), charge bar width = `charge*100%`; prompts: gnome → `hold LMB magnet <name> (<tier>)`, prop/crate → `hold LMB magnet`; help line 90 → `hold LMB magnet · release drop · hold RMB charge, release throw`.
11. `src/systems/goals.ts`: texts at 20, 21, 26 (magnet wording); after `Reach a 15 combo` insert `rel('Score a LONG SHOT: throw from 8 m or more', 1, () => st().longShots, 100)`, `rel('Score 5 AIR shots: no bounce before the hole', 5, () => st().airShots, 150)`, `rel('Hit the BULLSEYE ring above the hole', 1, () => st().bullseyes, 200)`, `rel('HEAVY HAUL: feed a massive gnome (hole level 5+)', 1, () => st().hauls, 300)` (hole-level goals shift by 4; `state.goal` index of old saves points at a different goal, accepted: assumption 7).
12. `src/ui/menu.ts:66,69` and `src/data/achievements.ts`: add `{ id: 'sniper', name: 'Gnome Sniper', desc: 'Score a SNIPER shot from 14 m.' }`, `{ id: 'bullseye', name: 'Dead Centre', desc: 'Hit the bullseye ring.' }`; `src/systems/achievements.ts` checks `st.bullseyes >= 1`; sniper unlocked in `consume`.
13. `docs/PLAN.md`: controls table (LMB magnet, RMB charge/throw), shop Movement list, weight tier table, trick table; `docs/ai-work/2026-10-19-arcade-rework.md` work progress.
14. Smoke scenarios: rewrite `smoke/scenario*.js` in the scratchpad for the lines below (not committed, per CLAUDE.md).

### Tests
No unit framework (CLAUDE.md): one headless CDP scenario per matrix row, run with `node <scratchpad>/smoke/smoke.mjs <out> <scenario.js>` against `npx vite --port 5199 --host 127.0.0.1`. Scenarios set `g.paused=false; g.input.locked=true`, spawn with `g.gnomes.spawn(type, pos, { awake: false, tier })`, drive `g.input.mouse.left/leftPressed/right/rightPressed`, wait on `requestAnimationFrame` frames (headless about 5 fps, dt clamps to 0.05, so 60 frames = 3 s of game time), then print `window.__done = JSON.stringify(out)`.

### Done when
1. spawn normal classic 3 m ahead, `mouse.left=true`, 60 frames → `P.held.gnome.state === 'held'` and `body.translation().y > 1.0`.
2. same with `tier:'heavy'`, 120 frames → `y > 1.0`.
3. same with `tier:'massive'`, 120 frames → `y < 0.8`, `hypot(dx,dz)` smaller than at frame 0, `.hud-sack` text contains `TOO HEAVY`.
4. `state.upgrades.magPower = 3`, massive, 120 frames → `y > 1.0`.
5. two normal classics in the cone, 60 frames → `gnomes.list.filter(g => g.state==='held').length === 1`.
6. row 1 then `mouse.left=false`, 2 frames → `P.held === null`, gnome `state === 'ragdoll'`, `|linvel| < 3`.
7. row 1 then `rightPressed=true` and `right=false` same frame, next frame → `|linvel|` in [13.5, 16.5].
8. row 2 (heavy, lifted) then RMB tap → `|linvel|` in [6.5, 8.5].
9. row 1 then `right=true` 40 frames, `right=false` → `|linvel|` in [24, 30].
10. place player at (0,1.2,10), magnet a classic, throw at the hole (pitch tuned by scenario), wait 120 frames → `stats.longShots === 1`, `stats.airShots === 1`, money gained >= `1.5*1.3*valueScale` (within 5%).
11. same throw aimed to land 2 m short on the ground and roll in → `stats.airShots === 0`.
12. trampoline placed between player and hole, throw onto it, gnome lands in hole → gnome `bounced === true` at consume and money includes x1.5.
13. `hole.ring.position` read, spawn classic ragdoll at ring position with `thrownBy='player'` and downward linvel → `stats.bullseyes === 1`, `hole.combo >= 4`.
14. spawn `tier:'massive'` at (0, 3, 0) → consumed, `stats.hauls === 1`, money = `2.5 * valueScale` (within 5%).
15. `state.holeLevel=1`, 300 spawns → `massive === 0`, `light` in [60,120]; `holeLevel=12`, 300 spawns → `massive` in [45,100].
16. massive classic under beam, player walks so the gnome slides over the hole rim → within 120 frames `stats.gnomesEaten` +1, gnome not in `gnomes.list`, money > 0.
17. kick normal classic then kick massive classic (same spot) → `|linvel_massive| / |linvel_normal|` in [0.2, 0.4].
18. fan placed, normal vs massive classic 2 m in front, 60 frames → massive horizontal displacement / normal displacement in [0.15, 0.45].
19. cannon with a queued classic fires into the hole → money = `0.5 * valueScale` (within 5%), float label contains `AUTO`. (If decision 2 = no: money = `valueScale`.)
20. crate placed, look at it, `mouse.left=true` 120 frames → `P.held.crate` set and `y < 0.9`; `magPower=7` → `y > 1.2`.
21. flamingo under beam 60 frames → `y > 1.0`; chair 120 frames → `y < 1.0`.
22. `factory.produce('king')`, aim at it, `mouse.left=true` 30 frames → `P.held === null`, prompt contains `too heavy`.
23. `hole.combo=5; hole.comboTimer=1` while holding a gnome, 200 frames → `hole.combo === 5`.
24. `events.start('rush')`, 400 frames with no E → `stats.produced` in [35,45] (before: 0); classic eaten during rush → money = `1.5*valueScale`.
25. `localStorage` save with `upgrades: {arms:5, vac:1}` then reload → no exception in logs, `[...document.querySelectorAll('.shop .name')]` has no `Strong Arms`/`Gnome Vac`, `lvl('magPower') === 0`.
26. `events.start('parade')` 16 gnomes → `new Set(gnomes.list.map(g=>g.tier.id)).size >= 2`.
27. row 1 then teleport player 10 m away (`P.position.set`), 5 frames → `P.held === null`.
28. crate with 1 stashed gnome, aim at the stashed gnome's last position, `mouse.left=true` 30 frames → `P.held?.gnome === undefined` (crate itself may be held).

### Assumptions (numbered)
1. "Weight differs by level" means the hole level drives the tier odds; gnome type keeps its own base mass on top.
2. Heavier pays more money (x1.6/x2.5), XP per gnome unchanged, so the ~11k gnome curve holds and money rises at most x1.59 by level 12.
3. The magnet uses one force budget `P` for gnomes, props and the crate; no per-kind special case.
4. Statues (asleep) can be magnetised exactly like awake gnomes (today they can be grabbed).
5. The 1.5 s no-regrab rule stays; juggling is out.
6. The held gnome keeps `state 'held'` (AI off); the king stays excluded so the beam cannot freeze the boss forever.
7. Inserting four skill goals shifts `state.goal` for existing saves by up to 4 (a mid-run player sees an earlier goal again); accepted, no migration.
8. Removing `arms`/`vac` gives no refund (total spend <= about $7.2k, trivial against level 4+ income).
9. Trampoline is the only "bank shot" surface; panels need contact events (rejected this round).
10. Headless timing: 60 frames = 3 s at dt 0.05; thresholds above include that clamp.

### Alternatives rejected
- (a) Keep the velocity spring (`setLinvel` toward a hold point) and add a mass cap: rejected because mass never changes the feel (the spring sets velocity directly), which is the opposite of "obeys physics".
- (b) Rapier spring/rope joint between the player's kinematic body and the gnome: rejected because a joint to a kinematic body behaves like a hard lock, fights the character controller and cannot express "too heavy, drags".
- (c) Moving hole at high levels: rejected, `rebuildHole` recreates four ground bodies and a ShapeGeometry; the bullseye ring is the moving target instead.
- (d) Contact events for bank shots and chain strikes: rejected this round, needs an `EventQueue` in the main loop and active-event flags per collider; the trampoline flag covers the fantasy in two lines.

### Ladder
- `WEIGHT_TIERS`/`rollTier` in `gnomeTypes.ts` (rung 2, balance lives in `src/data`): spec "weight differs by level".
- `magPower`, `magRange` upgrades (rung 2, `U()` helper): spec "upgrades make it stronger, wider".
- `Gnome.tier/throwPos/touchedGround/bounced/bullseye` fields (rung 6, minimum state): spec "add weight", "skill expression" (brief item 1).
- `spawn` option `tier` (rung 6): needed by the Done-when lines 2-4, 14, 16-18 for deterministic tiers.
- `player.vel`, `charge`, PD force in `updateHeld` (rung 6): spec "magnet obeys physics", "charge-up".
- `hole.consume(g, by)` parameter (rung 6): decision 2 needs to know who delivered the gnome; guessing from `at` is wrong for crate dumps.
- Bullseye ring inside `hole.ts` (rung 2, hole owns hole visuals and scoring): brief "bonus rings/targets".
- `rush` event and `factory.rush` (rung 2, existing event switch): brief "time-limited rush waves".
- No new dependency, no new file.

### Open decisions (for PP)
1. Crate: a) keep as a container that the magnet drags (5 kg, lifts at Magnet Coil 7); throwing gnomes into it from range becomes a skill shot; b) remove the crate, its goals and stats. (recommendation: a, it keeps today's "wooden box is a container" decision and the dump stays a reward for filling it by throws.)
2. Machine-fed gnomes (cannon, vacuum tower, black hole, crate dump, kicked in by wheel/fan/conveyor/trampoline without a player throw) pay a) x0.5 with an AUTO label, b) full value as today. (recommendation: a, it keeps "no full automation" while leaving machines useful for light gnomes.)
3. Charge throw (hold RMB up to 0.6 s for x1.8 impulse): a) base mechanic, b) a $600 Movement upgrade. (recommendation: a, timing is the cheapest skill lever and the UFO needs it for heavy ammo.)
4. Heavy tiers pay more: a) value x1.6/x2.5 and XP unchanged, b) value and XP both scaled (progression about 25% faster), c) no money bonus, weight is only a chore. (recommendation: a.)
5. Wind event (30 s side wind on airborne thrown gnomes): a) in this session, b) later. (recommendation: a only if the four core items land first; it is one event case and one impulse line.)
6. [spec silent] Zakładam: props (chair, flamingo) and the crate go under the same beam with the same force; chair (8 kg) can only be dragged, flamingo lifts | Dowód: `player.ts:204-207` (today LMB carries them), `props.ts:49` masses, `machines.ts:255-259` crate mass 5 | Jeśli źle: the armchair secret becomes a drag job and the chair never flies | Pewność: Likely | rekomendacja: a) handle it like gnomes.
7. [spec silent] Zakładam: every spawn source (factory, gnome rain, parade, night visitor, starting statues) rolls a tier from the current hole level | Dowód: `gnomes.ts:76` single `spawn`, callers listed in Reach | Jeśli źle: parade (x3) massive gnomes pay x7.5 at level 12 | Pewność: Likely | rekomendacja: a) all sources, king forced normal.
8. [spec silent] Zakładam: machines, angry/boss NPC pushes and the earthquake keep scaling by `type.mass` (ignore the tier), so heavy tiers resist automation | Dowód: `machines.ts:431,475,495,529`, `gnomes.ts:391,502`, `events.ts:81` | Jeśli źle: a vacuum tower eats massive gnomes as easily as light ones and the magnet upgrade has no purpose | Pewność: Confident | rekomendacja: a) leave them.
9. [spec silent] Zakładam: `Strong Arms` and `Gnome Vac` disappear from the shop with no refund; old saves keep the dead keys | Dowód: `main.ts:31-34` clamps only, `context.ts:68` `lvl` ignores unknown ids | Jeśli źle: a player who paid $2.5k for Gnome Vac loses it silently | Pewność: Likely | rekomendacja: a) no refund, mention it in the level-up toast once (`seenIntro`-style flag not needed: PLAN.md notes it).
10. [spec silent] Zakładam: a fat gnome (6) becomes liftable at Magnet Coil 9, the king never | Dowód: `gnomeTypes.ts:76,81` masses, P table | Jeśli źle: PLAN.md "needs kicks or machines" for fat is no longer true at max magnet | Pewność: Likely | rekomendacja: a) allow it, it is the end-game payoff of the upgrade.

### Self-check
- Every acceptance criterion (magnet, one at a time, physics, upgrades, weight by level, variety, removal of multi-carry) has a step and a Done-when line: yes.
- Every step names file, signature or value: yes (no "handle edge cases" lines).
- Fields written by the plan list all writers/readers: `held` (hud, machines crate respawn, player), `thrownBy` (gnomes x4, machines x2, events reader), `tier`/`throwPos`/`touchedGround`/`bounced`/`bullseye` (gnomes writes, hole reads, trampoline writes `bounced`), stats (hole writes, goals/achievements read).
- Lists compared with code: 10 tools = `TOOL_IDS` 10; 11 gnome types = `GNOME_TYPES` 11; 6 gnome states covered (held, stashed rows); 5 spawn callers; 3 consume callers; 2 removed upgrades; 7 `type.mass` sites. Matrix 28 rows = Done-when 28 lines; spec silent rows 6.
- Decisions older than 60 days: none (all 2026-10-19). Two same-day decisions touched (crate container, no-regrab 1.5 s) are in Open decisions 1 and assumption 5.
- Plan shorter than the code it describes: the change touches about 450-550 lines across 13 files; this plan is about 230 lines.

## PP decisions (2026-10-19, terminal)
1. Crate stays as a container under the magnet. NEW: an upgrade must increase its capacity. A crate kicked out of the map must come back next to the PC desk.
2. Machine-fed gnomes pay FULL value (no x0.5, no AUTO label).
3. Charge throw is an upgrade, $300 (not a base mechanic).
4. Heavy tiers scale BOTH value and XP (progression about 25% faster).
5-10. Planner recommendations accepted by the orchestrator (wind event only after the core lands; props and crate under the same beam; tier rolled for every spawn source, king normal; machines keep scaling by type.mass; no refund for removed upgrades; fat liftable at Magnet Coil 9, king never).
