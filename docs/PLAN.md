# Gnome Disposal Inc. — implementation plan

Goal: a first-person browser game about feeding gnomes to a hole, with many gnome types, tools, events, secrets and a prestige layer.

## Tech

- **Three.js** renderer, **Rapier 3D** (WASM) physics, **Vite** dev server/bundler, **TypeScript**.
- No downloaded assets except CC0 textures in `public/textures` (see `CREDITS.md`). All models are built from primitives in code (merged, vertex-coloured geometry). All sounds are synthesised with WebAudio.
- Gnomes and coins use `InstancedMesh` (one draw call per gnome type, one for all coins).
- Save in `localStorage` (autosave every 10 s and on tab close).
- Run: `npm install`, `npm run dev`, open the printed URL. Build: `npm run build` → `dist/` (static files, any host).

## Core loop

1. Gnome houses spawn gnome statues. Some wake up and misbehave.
2. Player grabs gnomes (sack, upgradable capacity), throws or kicks them into the hole.
3. Each gnome eaten: coins fly out of the hole (`value × hole multiplier × combo × upgrades × prestige`) and fill the hole XP bar.
4. Player collects coins, spends them in the shop (PC in the garage, or anywhere with the Laptop upgrade).
5. Tools and machines automate disposal. The hole levels up: bigger radius, higher multiplier, new gnome types, new land, events.
6. Hole level 12 opens **The Deep**: the player jumps in, sees the ending and is reborn with **Hole Shards** (permanent bonuses).

## Controls

| Key | Action |
|---|---|
| WASD / Shift / Space | move / sprint / jump (double jump with Gnome Boots) |
| Mouse | look (pointer lock, click canvas) |
| LMB (hold) | hands: carry ONE gnome, prop or crate; any weight lifts (the pull is an acceleration). The Magnet Gun is a hand tool taken with C or the Tab wheel (in hand after buying it and after a page load); bare hands with the gun owned keep the hand reach and narrow cone. With the Magnet Gun in hand: keeps pulling gnomes in a cone into a ball (radius 0.8 m + 0.2 m per Magnet Coil) and holds as many as fit; the ones pushed out drop after 0.4 s, heavier gnomes slip off more easily. The gun is held bottom right (a red horseshoe magnet at the muzzle, the coil glows while pulling, recoil on a throw); the ball shows as a faint cloud of sparks, sized by the Coil. Release drops everything |
| RMB | throw everything held, same impulse per gnome, so heavier gnomes fly slower; always instant (Wind-up removed 2026-10-20, owners got $300 back). With the Trick Scope the predicted path shows while something is held: white = miss, green = into the hole, gold = a trick (BULLSEYE, LONG SHOT, SNIPER). Lvl 1: the crosshair turns into a ring in the same colour, the trick label sits by the landing ring. Lvl 2: a reflex glass around the crosshair names the trick (or IN THE HOLE), the label by the landing ring goes away. Lvl 3: the glass adds the distance and the multiplier (capped x20, x8 for a gun volley) |
| F | kick |
| C | current tool ↔ hands (PP 2026-10-20): with a tool in hand (Magnet Gun, Plow Tractor, Leaf Blower) C puts it away; on hands C takes back the last tool (none yet: the Magnet Gun if owned, else a toast). Tab is the only way to change which tool; the line above the hotbar shows the tool and what C gives. Every switch drops what is held and cancels placement. Leaf Blower ($150): hold LMB to blow every gnome (not the King) in a 25° cone away, range 6 m + 1.5 m per Long Nozzle, push +25% per Turbo Fan, weaker towards the end of the range, same push for every weight; blown gnomes pay no trick shot. Tractor: x1.25 speed, no sprint, the blade (2.6 m + 0.8 m per Wider Plow) pushes every gnome in front while driving; it sets the gnome speed, so every weight is pushed the same; the King is never pushed. LMB does not grab while driving. The Push Broom was removed (PP 2026-10-20, owners got $60 back) |
| E | interact: PC shop, repair machine (one E fixes it and swaps one blown fuse; each further E swaps one more), the lever beside the factory (Auto Crank on/off, saved, ON after a rebirth), pick up secret item |
| 1-9, 0 | select a tool to place; LMB place, R rotate, T tilt, RMB/Esc cancel. Tools stack: the ghost rests on the ground or on top of another tool, the crate, the house or the desk (not on gnomes or loose props); a tool whose footprint reaches into the hole is blocked at any height |
| Tab (hold) | tool wheel: hand tools (hands, Magnet Gun, tractor, blower, owned ones) then the placeables past the tenth on a ring; the game runs at quarter speed while it is open, the mouse picks a slice, releasing Tab takes it. The only way to place tools past the tenth (Cleaning Robot) |
| X | pick up the placed tool you look at (returns to inventory) |
| B | shop (needs Laptop, otherwise walk to the PC); Tab no longer opens it |
| Esc | pause menu |

## Hole levels

Rebalanced 2026-10-19 after playtest ("5 fans and 2 panels = full automation, $119m, feels like an idle clicker"). Target: about 2-3 hours to The Deep, about 11 000 ordinary gnomes in total. Money multipliers grow linearly, prices grow x1.25-x2.5 per level with low caps (x1.3 extra per level above the 5th since 2026-10-20; crates, placeable tools and Deep exempt), automation (Auto Crank) from hole level 4, fans are a gentle push.

| Lvl | XP to next | Radius | Multiplier | Unlocks |
|---|---|---|---|---|
| 1 | 25 | 1.6 | x1 | classic gnomes, golden (rare) |
| 2 | 60 | 2.0 | x1.5 | greedy gnome, random events |
| 3 | 120 | 2.4 | x2 | angry gnome, land: Garden ($1.5k) |
| 4 | 220 | 2.8 | x2.5 | dwarf gnome, Auto Crank |
| 5 | 380 | 3.2 | x3 | saboteur gnome, land: Neighbour's lawn ($8k) |
| 6 | 600 | 3.6 | x4 | day/night cycle, shadow gnome |
| 7 | 900 | 4.0 | x5 | wizard gnome |
| 8 | 1300 | 4.4 | x6 | fat gnome, land: Dark forest ($40k) |
| 9 | 1800 | 4.8 | x7 | more golden gnomes |
| 10 | 2500 | 5.2 | x8 | King Gnome boss event |
| 11 | 3400 | 5.6 | x9 | — |
| 12 | MAX | 6.0 | x10 | The Deep (ending + rebirth) |

Combo: +5% per gnome, cap x2 (+0.5 per Combo Cap level, 18 levels since 2026-10-21; 13th-18th $712k-$37.6m). Premium Gnomes: +10% per level, max 10.

## Gnome types

| Type | Behaviour | Value | From lvl |
|---|---|---|---|
| Classic | statue; awake ones wander and curse | 1 | 1 |
| Golden | rare, flees from the player | 100 | 1 |
| Greedy | steals coins from the ground and runs home with them; eating it returns the loot x1.5 | 3 | 2 |
| Angry | charges the player, spits (green screen splat), knocks the player back | 4 | 3 |
| Dwarf | small and fast, runs away | 8 | 4 |
| Saboteur | walks to machines; each hit blows one fuse (Fuses upgrade), the hit after the last fuse breaks the machine (smoke, stops working) until repaired with E | 6 | 5 |
| Shadow | only at night, stares at you from the forest edge, steals money if ignored | 66 | 6 |
| Wizard | casts spells: levitates gnomes away from the hole, teleports | 25 | 7 |
| Fat | heavy (6x mass), needs kicks or machines | 20 | 8 |
| King | boss, huge and very heavy, push him in with machines | 5000 | 10 |

## Shop (a skill tree on every tab)

The shop is a dark monitor window ("GNOME-OS SHOP") that fills 96 % x 92 % of the screen: title bar with `AVAILABLE: n` (green when n > 0, n = the sum of the tab badges), taskbar tabs, monospace chrome, faint scanlines, a status bar with the last buy message, and a short power-on each time it opens. Details: `docs/ai-work/2026-10-20-shop-computer.md`.

Tab order: PLOW, MAGNET, FACTORY, MOVEMENT, TOOLS (default), COMBOS, BONUSES, LAND, DEEP (after the first shard); each tab has an icon, at 950 px and below only the icon. Every tab, Land and Deep included, is a skill tree: the column is the hole level that unlocks the node (pushed right of its parent), rows are packed, lines run along `requires` and light up blue once the parent is owned (a child cannot be bought before its parent has level 1; old saves keep their levels). Land is a chain of four tiers, only the next one can be bought. Nodes are round badges: placeable tools and gear (crate, trampoline, tractor, blower, Magnet Gun...) show a picture of their own 3D model, rendered once per session; stat upgrades and land tiers show an emoji. Green ring and pulse = affordable, blue = owned, gold = maxed, grey with a lock = hole level too low, dashed = parent missing; a purchase pops the badge. Same ids, prices and save format as before. Details: `docs/ai-work/2026-10-20-upgrade-tree.md`, `docs/ai-work/2026-10-20-shop-skill-tree.md`.

- **Plow** (pushing by foot and machine): Steel Toes (kick power, root); Plow Tractor ($1500, hole level 3, key C) → Wider Plow (+0.8 m blade, 5 levels, hole level 3); Leaf Blower ($150, key C) → Turbo Fan (+25% blow power, 4 levels, $80 x1.6) and Long Nozzle (+1.5 m blow range, 4 levels, $100 x1.6).
- **Magnet** (grabbing and throwing): Magnet Gun ($300, many gnomes at once) → Magnet Coil (+0.2 m gun ball radius, stronger grip, +0.6 m gun reach); Magnet Dish (range and cone, also for the hand magnet, root); Strong Arm (throw power, root); Trick Scope ($300 → $600 → $1.2k, 3 levels: colour crosshair, reflex glass with the trick, glass + distance and multiplier; root). Gun reach: 7 m + 1.2 m per Dish + 0.6 m per Coil.
- **Factory:** Factory Gears → Bigger Batches → Auto Crank; Premium Gnomes (value), Gnome Permit (max gnomes), Gnome Glue (fewer statues wake up), Feeding Frenzy (hole level 4, $2,000 x2.2, 5 levels: Massive share closes to 100 %; owners get XP x1 and throws at the 1.2 kg speed, pending PP) as roots.
- **Movement:** Running Shoes, Spring Socks, Gnome Boots (double jump), Coin Magnet (10 levels; level 10 auto-collects coins, safe from greedy gnomes, replaced the Piggy Bank 2026-10-24), Laptop.
- Weight tiers (normal / heavy / massive: 1.2 / 2 / 3 kg, money and XP x1/1.6/2.3), heavier gnomes appear more often at higher hole levels. No gnome under 1 kg (PP 2026-10-19: they flew too far). Trick shots (multiplied together, total capped at x20; PP 2026-10-19: "x2, x5, aby było warto"): AIR x2, LONG SHOT x2.5 (8 m), TRICK x3 (trampoline), SNIPER x4 (14 m, replaces LONG SHOT), BULLSEYE x5 (golden ring above the hole); each trick plays a celebration (big text with multipliers and the money, gold sparks, fanfare, shake, gold money pulse) scaled by the total. Details: `docs/ai-work/2026-10-19-plan-arcade.md`, `docs/ai-work/2026-10-19-trick-shots.md`.
- Hole XP by feeding style (PP 2026-10-20, 10a; money unchanged): a hand throw or drop pays the full XP, a Magnet Gun ball of n gnomes pays 1/sqrt(n) each (one group per hold, also when it is released or slips off over the hole), a crate dump pays x1 (PP 2026-10-24), anything a machine, robot, plow, blower, kick or event fed pays x0.25; the King always pays his full 200 XP.
- **Tools** (each level = +1 placeable): Wooden Box, Trampoline, Cooling Fan (max 20 at x1.4 since 2026-10-21, was 10 at x1.9; Big Blades $150 x1.6, 4 levels, +25% push along the fan axis), Metal Panel, Conveyor (Wide Belt $400 x1.8, 3 levels, +0.6 m width; max 10, was 6; PP 2026-10-20 "wiecej fanow np z 10 i raili"), Kicking Wheel, Magnet, Gnome Cannon, Vacuum Tower, Mini Black Hole, Cleaning Robot ($400 x1.3, max 12, hole level 2; placed from the tool wheel). A robot drives to free gnomes within its work area (order: Saboteur, then Greedy / Shadow / Wizard / Angry, then the gnome lying still longest in 5 s steps, then the nearest; it switches to a more dangerous gnome while chasing one, and skips gnomes another robot already chases when it can) around its station (6 m + 2 m per Wider Area; pad 2 x 2.6 m with a pole that carries the robot's fuse box and a green/red lamp), scoops them onto its bed (5 + 3 per Bigger Bed), drives to the hole when full or after 4 s without a gnome, tips the load in (combo, money, no trick shots) and drives back at 2.5 m/s + 0.6 per Faster Motor. It never gets closer than 1 m to the hole edge, waits when the player stands in front of it, sidesteps when stuck, skips the King. Bigger Bed $150, Faster Motor $120, Wider Area $150 (x1.6, 4 levels each, hole level 2). Fuses (one `<Tool> Fuses` upgrade per tool since 2026-10-21: 1/4 of the tool price, min $100, x1.8, max 5, hole level 5 or the tool's; not placeable): every tool except the crate and the panel gets L fuses in a small box (green / red); a saboteur hit blows one, the tool breaks on hit L + 1; blown fuses are not saved.
- **Combos:** Combo Window, Combo Cap, Combo Insurance, Jackpot.
- **Bonuses:** Mushroom Chance, Mushroom Duration, Golden Chance, Hole Hunger (+XP), Lucky Events. Endgame rows from hole level 8 (2026-10-21, PP: from level 8, prices doubled): Bottomless Hunger (+25% XP, $800k x2.5, 5), Spore Storm (+50% mushroom chance, $500k x2.5, 5), Midas Spores (+18% Gold Midas share, $2m x2.5, 5).
- **Land:** Garden, Neighbour's Lawn, Dark Forest (bigger yard, more houses, new scenery).
- **Deep** (Hole Shards, after rebirth): Deep Value, Deep Start money, Keep Tools, Deep Combo, Deep Spawn. Caps since 2026-10-21: Deep Value 15, Head Start 7, Deep Combo 6, Deep Hunger 9.

## Mushrooms (drop from eaten gnomes)

Red Combo (+3 combo cap, double combo gain), Blue Zoomies (speed/jump), Purple Chaos (gnome burst, x2 value), Gold Midas (next 15 gnomes x3, every gnome shines gold), Green Grog = **BOOZED** (screen wobble, x3 value), Eclipse Cap (x2 money, the sky swings day and night once per 1.5 s), Rainbow (everything + gnome rain).

## Combo

Each gnome eaten within the combo window adds +1. Multiplier `1 + combo × 0.1`, capped by Combo Cap. Tiers with growing text, shake and sound pitch: Nice (5), Gnomazing (15), Gnomenal (30), GNOMEGEDDON (60), HOLE-Y MOLY (100).

## Events (random, every 70-140 s from hole lvl 2)

Gnome Rain, Golden Hour, Gnome Parade (conga line, x3 value), Hole Burp (coin fountain), Uprising (all angry), UFO (abducts gnomes, hit it 3x with thrown gnomes for a jackpot), Earthquake (everything slides to the hole), Mushroom Bloom, King Gnome (lvl 10+), Night Visitor (shadow, lvl 6+ at night).

## Secrets and surprises

- Throw the armchair or a flamingo into the hole.
- Golden shovel hidden at the forest edge: +10% value forever.
- Feed the five gold letters G N O M E to the hole (one per land, two on Dark Forest; once per save): BOOZED mode.
- Fall into the hole yourself: the hole spits you out with a coin fountain.
- Cryptic messages from the hole on each level up.
- 24 achievements with toasts.

## Code layout

```
src/main.ts              bootstrap, game loop
src/core/                context, state + save, input, audio, format
src/data/                gnome types, upgrades, hole levels, land, achievements
src/world/               procedural models, environment (ground, hole, fences, decor, houses, day/night)
src/entities/            gnomes (AI + instancing), coins, mushrooms, machines, props
src/player/              first-person controller, sack, throw, kick, placement
src/systems/             hole + combo, buffs, events, achievements, prestige
src/ui/                  HUD, shop, menus, CSS
```

## Milestones

1. World, player, gnomes, hole, coins, money. (playable core)
2. Shop + Movement/Products/Combos/Bonuses upgrades, save/load.
3. Tools and machines with placement.
4. Gnome types with AI, mushrooms, combo feedback.
5. Hole levels, land, day/night, events, secrets, achievements.
6. The Deep ending + prestige.
7. Balance pass, performance pass (gnome cap, sleeping bodies), smoke test in headless Chrome.

## Status (2026-10-19)

All milestones 1-7 are implemented. Verified in headless Chromium (software WebGL) with scripted scenarios:

- grab → throw → gnome eaten → coins → money; combo tiers; hole levels 1 → 12 (radius and multiplier grow)
- every gnome type spawns and behaves; all 10 events and all 6 mushrooms start without errors; night cycle
- tool placement from the hotbar, panel tilt and height, X pick-up, saboteur break + E repair, PC desk opens the shop, all shop tabs render
- kick, falling into the hole (spit out + achievement), the five GNOME letters
- game logic costs about 0.9 ms per frame with ~280 gnomes (rendering not measured: the test browser has no GPU)

Not verified by a human: game feel and balance (costs, spawn rates, throw power). Those need a play session.

## Known limits

- Desktop only (mouse + keyboard, pointer lock). No touch controls.
- Physics cap: about 450 gnomes on the field at once.
