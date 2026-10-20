# Magnet Gun: many gnomes at once, weight only for throwing (PP, 2026-10-19)

## Problem

PP (verbatim): "magnes musi być do kupienia i ściągać mnóstwo gnomów na raz, waga ma być tylko do rzucania, podnosić można każde (magnes olewa wagę, ale te cięższe łatwiej z niego spadają)".
Translation: the magnet must be a shop purchase and pull lots of gnomes at once; weight only matters for throwing; any gnome can be lifted (the magnet ignores weight), but heavier ones slip off it more easily.

Then: "uruchom na to wszystko workerów na opusie bo potrzebuję tutaj compact zrobić" — the orchestrator hands the whole task (implementation, regression, release build) to an implementer.

Context (read first): `CLAUDE.md`, `docs/ai-work/2026-10-19-arcade-rework.md`, `docs/ai-work/2026-10-19-physics-feel-and-spawn.md`, `docs/ai-work/2026-10-19-plan-polish-round.md` and the three `2026-10-19-polish-*.md` notes. Today the player's LMB "magnet" holds ONE body (`player.held: { body, gnome?, prop?, crate? } | null`) with a critically damped spring force capped at `magnetPower` (90 N x (1 + 0.15 x Magnet Coil)); weight classes are 0.5 / 0.8 / 1.2 / 2 / 3 kg (`WEIGHT_TIERS`).

## Plan (plan-senior, final)

Written by the orchestrator at PP's explicit request (PP wants the work delegated so the main session can compact). Scope: `src/player/player.ts`, `src/data/upgrades.ts`, `src/ui/hud.ts`, `src/ui/shop.ts` (only if the upgrade preview table needs the new ids), `src/systems/goals.ts` (texts), `src/systems/hole.ts` (combo freeze reads), `src/entities/machines.ts` (crate respawn reads `player.held`), `src/entities/gnomes.ts` (only if needed for the slip-off), `docs/PLAN.md`, a new note `docs/ai-work/2026-10-19-magnet-gun.md`.

1. **Hands (no purchase):** LMB keeps today's single-object carry: one gnome, the crate or a prop. Weight no longer limits lifting: the spring acts as an acceleration (force = mass x acceleration, acceleration capped at ~45 m/s²), so every weight class lifts the same. The king stays excluded. `tooHeavy` and the "TOO HEAVY" HUD text go away (or only for the king).
2. **Magnet Gun (shop, Movement tab):** new upgrade id `magGun`, max 1, about $300, hole level 1. Once owned, holding LMB pulls every free gnome in a cone (range `7 + 1.2 x Magnet Dish`, cone ~25° widening with Magnet Dish) towards a hold point 2.2 m in front of the camera, where they form a jostling ball (physical bodies, spring acceleration towards per-gnome offsets on a small sphere, mass-independent). Capacity: `6 + 3 x Magnet Coil` gnomes. Gnomes keep being collected while LMB is held (one every ~0.08 s) until full. Crate and props still go to the single carry when you look at them and the swarm is empty.
3. **Heavier slip off more easily:** each held gnome has a grip limit that shrinks with weight, e.g. it drops when it lags its target point by more than `1.6 / mass^0.7` metres (0.5 kg ≈ 2.6 m, 3 kg ≈ 0.7 m), so fast turns, sprinting and bumping into things shake the heavy ones off first; plus a small random slip chance per second growing with mass (e.g. `0.03 x mass²` per s). Slipped gnomes become `ragdoll` (normal drop, they can be grabbed again).
4. **Throwing:** RMB throws everything held (single carry or the whole swarm). Impulse per gnome `J = 15 x (1 + 0.15 x Strong Arm) x (1 + 0.8 x charge)` along the view with a little spread, so velocity = J / mass: weight matters here and only here. Wind-up charge keeps working. Releasing LMB drops everything without impulse. Keep `noGrabUntil` (1.5 s) on thrown gnomes and the `throwPos` trick tracking (`gnomes.drop(g, impulse)`).
5. **Upgrades:** rename/redescribe `magPower` → "Magnet Coil: +3 gnomes in the Magnet Gun, stronger grip" and `magRange` → "Magnet Dish: longer range, wider beam". Both require `magGun` to be useful; show them always but mention it in the description.
6. **Everything that reads `player.held` keeps working:** HUD magnet panel (shows `MAGNET GUN n/cap` or the single item with its weight class and value), beam (one beam per held gnome is too much: one beam to the swarm centre), trajectory preview (for the swarm: preview the path of a 1.2 kg gnome from the swarm centre), combo freeze while anything is held, crate respawn clearing the carry, raycast skipping held bodies, `dropAll()` on tool selection. Decide the data shape (e.g. keep `held` for the single carry and add `swarm: Gnome[]`) and update every reader.
7. Goals text "Use the magnet: hold LMB while looking at a gnome" stays valid; add nothing else.

Gotowe, gdy (each verified by a headless scenario, see Tests):
- without `magGun`: hold LMB on a 3 kg gnome → it rises above y 1.0 within 3 s (weight does not block lifting)
- without `magGun`: only one gnome is ever held
- with `magGun`: 10 gnomes in front of the player, hold LMB 3 s → at least 6 are held (capacity 6 at Magnet Coil 0), with Magnet Coil 2 → at least 10 (capacity 12)
- with `magGun`, swarm of 0.5 kg and 3 kg gnomes, player turns 180° in 0.5 s → more 3 kg than 0.5 kg gnomes slipped off
- RMB with a swarm → all held gnomes become `ragdoll` with speed ≈ J/mass (0.5 kg ≈ 30 m/s, 3 kg ≈ 5 m/s, ±20%)
- shop Movement tab shows "Magnet Gun"; buying it sets `upgrades.magGun = 1`
- crate: look at the crate, LMB → `held` crate, as before; HUD panel shows the crate
- no exceptions in the logs of any scenario

## Tests

Headless CDP harness `/private/tmp/claude-501/-Users-przemek-Documents-PHP-gnome-boozed/844ac005-e3c6-4341-b0ea-34b547159d26/scratchpad/smoke/smoke.mjs` (`CDP_PORT=<port> MAXPOLL=4000 node smoke.mjs <outDir> <scenario.js>`; use ports 9361-9369, kill any `chrome-headless-shell` you started if a run hangs). Dev server: `http://localhost:5199` (start it with `npx vite --port 5199 --host 127.0.0.1 --strictPort` in the background if it is not answering). Patterns: `scenario15.js`, `scenario10.js`, `scenario-polish-*.js` in the same folder. Old scenarios that read `P.held.gnome` / `P.held.crate` may need small updates for the new data shape: update the scenario, not the game, when the old expectation is about the replaced single-magnet behaviour (e.g. "massive drags" is now intentionally "lifts").

After the Magnet Gun lines pass, run the full regression in this order and fix anything red in the game code: `scenario-polish-A.js`, `scenario-polish-b.js`, `scenario-polish-c.js`, `scenario15.js`, `scenario13.js`, `scenario12.js`, `scenario10.js`, `scenario1.js`, `scenario8.js`.

Then publish the playtest build: `npx tsc --noEmit` clean, `npm run build`, `npx vite build --outDir release --emptyOutDir`; check that `http://192.168.0.38:5300/` serves the new `release/assets/index-*.js` (if nothing answers on 5300, start `npx vite preview --outDir release` in the background). Never serve unfinished code on 5300.
