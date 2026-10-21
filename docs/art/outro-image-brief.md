# The Deep: outro background image brief

Brief for generating the background art of the rebirth screen ("The Deep") with ChatGPT image generation. Sections 1-3 are context, section 4 is the copy-paste script, section 5 is how we use the result and how PP picks the winners.

## 1. The game

Gnome Disposal Inc. is a first-person browser game. A factory in your backyard makes garden gnomes nobody wants, and a hole in the lawn eats them and pays cash. The player grabs, throws, kicks, magnets and catapults gnomes into the hole, buys machines (fans, belts, cannons, robots) and bigger lands, and the hole grows through 12 levels while whispering ever hungrier lines ("they taste of soil and spite", "bring me the KING", "come down. see what you fed."). The tone is absurd dark humour: cheerful low-poly gnomes, bright coins, a cute garden, and underneath it a bottomless thing that is clearly not a normal hole. At level 12 the player jumps in, falls into The Deep, learns the hole was never hungry but lonely, and is reborn with Hole Shards that buy permanent bonuses.

## 2. The outro screen today

What the player sees after jumping into the hole at level 12:

- Layout: full-screen black (`#000`), fades in over 2 s. Lines appear one at a time in the centre of the screen, each replacing the previous, each with a 1.2 s fade-in and a whisper sound. A new line every 2.6 s. The whole sequence is about 23 s, then the title and the button.
- Font: Creepster (Google Fonts, dripping horror display face), 44 px, letter-spacing 2 px, colour `#b0f0ff` (pale icy cyan). Fallback is Fredoka, the game's rounded UI font.
- Lines, verbatim, in order (t = seconds after the screen opens, approx.):
  1. t=0 `You fall.`
  2. t=2.6 `Past the dirt. Past the roots. Past the gnomes.`
  3. t=5.2 `Thousands of little faces look up at you from the dark.`
  4. t=7.8 `They are not angry.`
  5. t=10.4 `They are waiting.`
  6. t=13.0 `The hole was never hungry.`
  7. t=15.6 `It was lonely.`
  8. t=18.2 `You gained N Hole Shards.` (N is the run's shard count; "Shard" when N = 1)
  9. t=20.8 `The garden begins again.`
  10. t=23.4 `THE DEEP` (same style) with a grey button `Be reborn` under it (`#3a4048` background, white Fredoka 16 px, rounded 10 px). Clicking it reloads the game as a new run.
- From line 2 onward, when the Buy Me a Coffee link is filled in: a small line at the bottom of the screen (28 px from the bottom edge), Fredoka bold 18 px, `#b0f0ff` at 80 % opacity: `Press F to pay respects`. After F it changes to `Respects paid. Thank you ♥`.
- Nothing else on screen: no HUD, no background, no particles. Pure black behind the text.

What is missing (PP's note): line 3 says thousands of little faces look up from the dark, but the screen shows nothing. There are no eyes. The player reads about being watched and sees a black rectangle. The picture should deliver the faces and the eyes that the text promises, without competing with it.

## 3. Art direction

Mood: you are inside the hole, falling or already at the bottom. Pitch dark. Something huge and patient is watching, and so are thousands of small things. Not scary-aggressive: lonely, waiting, a little sad, a little funny. The gnomes down here are the ones you fed; they are calm. Think "the void from a children's book that is secretly for adults": cute meets cosmic.

Palette (tied to the game):

- Base: true black `#000000` to near-black blue `#0b0f14` (the game's page background).
- Eyes and glow: pale icy cyan `#b0f0ff` and `#9fe6ff` (the Deep text colour and the hole's swirl). This is the main light in the picture.
- Accent, sparing: hole-level purple `#c08aff` (the game's "secret" colour, also the mid-combo swirl colour), and a hint of gold `#ffd23f` (coins, the game's accent) for one or two special eyes or a far glint.
- Gnome hints: classic red hat (`#d8352a`-ish), blue hat, white beard, only as faint silhouettes catching the eye glow. No full-colour gnomes.
- No warm orange, no fire, no green. No pure white larger than a glint.

Style: low-poly / flat-shaded look to match the game (models are built from primitives: cones, spheres, boxes), soft additive glow around lights, slight film grain or vignette is fine, no photoreal rendering, no painterly brush texture. Clean shapes, few polygons, chunky silhouettes.

Composition rules (16:9 full-screen background):

- The centre band (middle 40 % of the height, middle 70 % of the width) stays nearly black: luminance under about 15 % so pale cyan 44 px text reads at a glance. Eyes and shapes live in the outer ring and the lower third, fading to black toward the centre.
- Safe area for the bottom line ("Press F to pay respects"): the bottom 80 px across the full width, keep it dark.
- Safe area for the button: 120 px below the vertical centre, 300 px wide, keep it dark.
- Keep the composition readable at 1280x720 and when cropped a little on the sides (ultrawide and phone-ish windows): nothing important on the outer 5 %.
- The picture must work as a still. Subtle motion comes from layers (section 4, prompts 5 and 7), not from the image itself.

Deliverables:

- Sizes: 1920x1080 and 1280x720 (downscale from the 1920 master).
- Format: WebP (preferred) or PNG, under about 400 KB per full background, under about 150 KB per transparent layer. Dark images compress well; use lossy WebP at quality 80-85.
- Transparent layers: PNG or WebP with alpha, same 1920x1080 canvas, so they stack pixel-exact.
- No text, letters, logos or watermarks in the image. No real brands, no real characters. No gore, no blood, no teeth-and-tongue horror; the eyes are curious, not predatory.

## 4. ChatGPT script

Paste the context message first, in a new chat with image generation enabled. Then paste the prompts one at a time; ask for 2-4 variations of each. Every prompt repeats the key constraints because image models forget the chat context.

### Context message (paste first)

```
I am making background art for the ending screen of a small browser game called Gnome Disposal Inc. The player feeds garden gnomes to a bottomless hole in a backyard; at the end they jump in and fall into "The Deep", where thousands of gnomes they fed look up at them from the dark, calm and waiting, and the hole turns out to be lonely, not hungry. The art style of the game is low-poly, flat-shaded 3D built from simple primitives (cones, spheres, boxes), with soft additive glow for lights. Tone: absurd dark humour, cute meets cosmic, not gory.

Rules for every image I ask for, unless I say otherwise:
- 16:9, 1920x1080, full-bleed background.
- Almost entirely black (#000000 to #0b0f14). The centre of the image (middle 40% of height, middle 70% of width) must stay nearly black so I can put pale cyan text on top.
- Light comes only from small glowing eyes and faint glints. Eye and glow colour: pale icy cyan (#b0f0ff, #9fe6ff). Optional sparse accent: soft purple (#c08aff) and a rare gold (#ffd23f) glint.
- Low-poly shapes, soft glow, slight vignette. No photorealism, no painterly brushwork.
- Absolutely no text, letters, logos, watermarks, signatures or UI.
- No gore, blood, teeth, claws or aggressive monsters. The watchers are curious, patient, a little sad.
- No real brands or known characters.
Please confirm, then wait for the first prompt.
```

### Prompts

Negative list to append to every prompt (already included in each):

`Negative: text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, bright centre, grey fog filling the frame, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots, white background.`

1. Many small eyes in the dark (the core variant)

```
Full-bleed 16:9 background, 1920x1080. Pitch black void inside a bottomless hole seen from the bottom. Hundreds of pairs of small glowing eyes scattered through the darkness, pale icy cyan (#b0f0ff), tiny, round, slightly different sizes, denser toward the lower third and the left and right edges, almost none in the centre band. Each pair of eyes belongs to a barely visible low-poly garden gnome silhouette: a pointed hat, a round beard, only the edges catching a faint cyan rim light. The gnomes look upward, calm and patient. Soft additive glow around each eye, faint bokeh on the farthest ones. Strong vignette, the middle 40% of the height stays black. Low-poly flat-shaded style, soft glow, no photorealism. Negative: text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, bright centre, grey fog filling the frame, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots, white background.
```

2. One giant eye opening (3 frames for a subtle animation)

```
A set of 3 images, same framing, 16:9, 1920x1080 each. Pitch black void. In the lower half of the frame, filling about 60% of the width, one enormous eye of the hole itself, seen from below, low-poly and smooth, iris pale icy cyan (#9fe6ff) with a faint purple (#c08aff) ring, pupil black and bottomless, a tiny gold (#ffd23f) glint. Frame 1: the eye is closed, only a thin cyan seam and the faint low-poly eyelid edges visible. Frame 2: the eye is half open, the iris glow just starting to light the darkness around it. Frame 3: the eye is fully open, calm, looking straight up at the viewer, soft glow bleeding into the black but the top 60% of the frame still nearly black. Keep the top half of all three frames dark enough for text. Soft additive glow, strong vignette, low-poly flat-shaded style. Negative: text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, bright centre, grey fog filling the frame, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots, white background.
```

3. Eyes plus faint gnome hats falling

```
Full-bleed 16:9 background, 1920x1080. Pitch black void inside a hole, seen from the bottom looking up. Far below in the lower third: dozens of small pale cyan (#b0f0ff) glowing eyes of low-poly gnomes, waiting. Drifting slowly down through the middle and upper darkness: a few low-poly pointed gnome hats, classic red and blue, very dim, lit only by faint cyan rim light so they read as dark silhouettes with a thin edge glow, like leaves sinking in deep water. No more than 8 hats, none in the exact centre. The centre band stays nearly black. Soft additive glow, strong vignette, low-poly flat-shaded style, no photorealism. Negative: text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, bright centre, grey fog filling the frame, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots, white background.
```

4. The hole's swirl seen from below

```
Full-bleed 16:9 background, 1920x1080. View from deep inside a bottomless hole looking up: far above, a faint spiral swirl of pale icy cyan (#9fe6ff) light with a touch of purple (#c08aff), the hole's mouth, small and distant, placed in the upper third slightly off-centre. The swirl is thin and dim, made of a few low-poly ribbons and sparse glowing particles, not a bright tunnel. The rest of the frame is black. Along the bottom edge and corners, a thin row of tiny cyan gnome eyes looking up, barely visible. The middle 40% of the height stays nearly black. Soft additive glow, strong vignette, low-poly flat-shaded style. Negative: text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, bright centre, grey fog filling the frame, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots, white background.
```

5. Blinking eyes as layered PNGs for parallax (3-4 layers)

```
A set of 4 separate images, each 1920x1080, each with a fully TRANSPARENT background (PNG with alpha), nothing else in the frame except glowing eyes. Together they stack into one scene of gnome eyes in the dark. Layer A: about 30 pairs of large, near pale cyan (#b0f0ff) eyes with soft glow, only along the bottom 25% of the frame. Layer B: about 60 pairs of medium eyes, scattered along the left and right 20% of the frame and the bottom half, none in the centre. Layer C: about 120 pairs of tiny far eyes with faint bokeh glow, scattered everywhere except the middle 40% of the height and middle 70% of the width. Layer D: the same positions as layer B but with every eye closed, drawn as a thin dim cyan line, for a blink swap. Eyes are simple low-poly ovals or dots with additive glow, no faces, no bodies, no background, no vignette. Negative: background, black fill, text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, grey fog, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots.
```

If the model cannot output true transparency, ask for the same layers on pure black (#000000) and we will key the black out, or use additive blending in CSS (`mix-blend-mode: screen`), which treats black as transparent anyway.

6. Thousands of little faces, closer and friendlier

```
Full-bleed 16:9 background, 1920x1080. Pitch black. A crowd of low-poly garden gnomes fills the bottom 35% of the frame like an audience seen from the stage, packed shoulder to shoulder, dozens of rows receding into darkness. They are lit only by the pale icy cyan (#b0f0ff) glow of their own small round eyes, so hats, beards and noses show as faint flat-shaded planes with a thin rim light. All look up toward the viewer, calm, patient, slightly hopeful, mouths hidden by beards. A few hats catch a faint purple (#c08aff) tint, one single gnome far back has gold (#ffd23f) eyes. The top 60% of the frame is black with a few stray far eyes near the edges only. Soft additive glow, strong vignette, low-poly flat-shaded style, no photorealism. Negative: text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, bright centre, grey fog filling the frame, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots, white background.
```

7. Seamless tiling "eyes" layer with alpha

```
A seamless, tileable texture, square 1024x1024, fully TRANSPARENT background (PNG with alpha). Scattered small glowing gnome eyes in pairs, pale icy cyan (#b0f0ff) with soft additive glow, random sizes from 4 to 18 pixels, random spacing, no pattern visible, about 80 pairs. The texture must tile with no visible seam on all four edges: eyes that touch one edge continue on the opposite edge. A few pairs closed (thin dim line) so the tile reads as a crowd mid-blink. No faces, no bodies, no background, no vignette. Negative: background, black fill, grid, visible repeat, border, text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, grey fog, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots.
```

8. The lonely hole (the ending beat)

```
Full-bleed 16:9 background, 1920x1080. Pitch black void. In the lower third, one small low-poly garden gnome seen from behind, dark silhouette with a thin pale cyan (#b0f0ff) rim light, sitting alone at the edge of a faint cyan glow on the ground. Far away in the darkness around it, very dim, hundreds of tiny cyan eyes slowly gathering toward it, like fireflies, densest at the bottom corners. The feeling is lonely but gentle: the hole finally has company. The middle 40% of the height stays nearly black. Soft additive glow, strong vignette, low-poly flat-shaded style, no photorealism. Negative: text, letters, watermark, logo, signature, gore, blood, teeth, fangs, claws, fire, warm orange light, green light, bright centre, grey fog filling the frame, photorealistic, painterly, detailed textures, human faces, real people, cartoon mascots, white background.
```

Follow-up messages that usually help:

- `Make the centre darker; I need to read 44 px pale cyan text over the middle of the image.`
- `Fewer eyes, smaller, more spread out, keep the bottom third the densest.`
- `Same image, but the eyes should look up at the viewer, not at the camera's left.`
- `Give me the same composition in a 3-frame sequence: eyes closed, half open, open.`
- `Output as PNG with a transparent background; if you cannot, output on pure black #000000.`

## 5. How we will use the pictures

The winning background sits behind the whispered lines at full screen (`background-size: cover`, centred) and fades in from black over about 4 s, so the first line ("You fall.") still lands on a black screen and the eyes emerge while "Thousands of little faces look up at you from the dark." is on screen (t=5.2). The text keeps its current style; the image must stay under its contrast, so we will add a soft black radial gradient over the centre if any winner is too bright there. If PP picks the layered eyes (prompt 5) or the tile (prompt 7), we stack 2-3 layers with CSS, drift them a few pixels at different speeds for parallax, and blink by swapping the "closed" layer in for 120 ms every few seconds at random, with each layer on its own timer so the blinks never line up. The giant eye (prompt 2) opens by cross-fading its 3 frames across the last two lines, just before "THE DEEP". Everything stays well below the "Press F to pay respects" line and the "Be reborn" button, which keep their black safe areas.

Checklist for picking the winners (PP, one minute per image):

- [ ] Cover the middle of the image with your hand: does the rest still say "something is watching from below"?
- [ ] Put the line "Thousands of little faces look up at you from the dark." over the centre in your head: is the centre dark enough to read pale cyan text at a glance?
- [ ] Do the eyes look up at me, calm, not angry?
- [ ] Does it look like it belongs to the game (chunky low-poly shapes, soft glow), not like a stock horror wallpaper?
- [ ] Nothing in the bottom 80 px and nothing in the button area below centre?
- [ ] No text, letters, watermark or brand anywhere, including tiny ones in the corners?
- [ ] Would a 10-year-old find it spooky-funny rather than scary?
- [ ] Does it still work at 1280x720 and with the sides cropped by 5 %?

Pick one full background (prompt 1, 3, 4, 6 or 8) as the base, optionally one animated element (prompt 2 or 5/7) on top. Save the originals under `docs/art/outro/` with the prompt number in the file name; the exported WebP goes to `public/outro/`.
