# HOW THINGS — series bible

Vertical 3D shorts (1080x1920, 30 fps), built entirely in code (three.js + cannon-es + Playwright + ffmpeg).
Every episode stands alone. On-screen text and narration in English. Always "Simplified 3D visualization, not real footage".

## Episode list

| EP | Object | Angle | Material family | Length | Audio | Palette | Next-episode choice (green / red) |
|----|--------|-------|-----------------|--------|-------|---------|------------------------------------|
| 01 | Zipper (#5 metal, generic) | How it works inside | Metal + textile | ~49 s | ElevenLabs narrator (EN) | Brass & Blueprint | Glass bottle / Ballpoint pen |
| 02 | Glass bottle (generic long-neck) | How it's made (sand → bottle) | Glass | ~45 s | ElevenLabs "Brian" (EN) | Ember & Slate | Gummy bear / Pencil |

Material rotation: food, plastic, metal, glass, paper, textile, electronics, rubber, ceramics, everyday gadgets.
EP 03 should not be glass or metal (gummy bear = food, pencil = wood/graphite; decided by comments).

## Shorts safe area (since EP 02)
iPhone crops ~50 px per side; the top bar covers ~230 px; the action icons cover x > 870 between y ≈ 900 and 1870;
channel name + title sit below ~1600. Everything that must be read lives in x 70–870, y 250–1560 (`SAFE` in js/overlay.js).
The 3D camera is shifted 70 px left (`setViewOffset`) so the subject sits in the safe centre (x ≈ 470).
Check with `python tools/safe_preview.py out.jpg still1.jpg ...` before rendering.
Render in two layers: `tools/render.py render plate`, `tools/render.py render over`, then `tools/composite.sh`.

## On-screen text rules (since EP 02 v2, js/overlay.js v2 helpers)
- NEVER STATIC: after the pop-in every text keeps moving (scale drift 1.00 → 1.06, ±1.5° sway, accent glow/colour pulse, or word-by-word reveal). No hold longer than 1.6 s; split long lines into 2–3 beats.
- TIMING: each text starts on the real start of its word (voice alignment, within 80 ms) or on its sound-effect hit, and ends with a pop-out (scale 1.0 → 0.85 + fade, 0.1 s), never a plain cut.
- RHYTHM: a new text change every 1.0–1.5 s from 2 s to the end card; about 26–32 text events per episode (stickers included).
- PLACEMENT: text never covers the subject; if the subject fills the lower half, use the top band (y ≈ 400–600). Check with tools/safe_preview.py.
- NUMBERS: Anton, big, accent/heat colour with glow, and they COUNT (`counter()`): up to the value in 0.5–0.7 s, then a glow beat; temperatures use the hot-glass colour ramp.
- MOTION MIRRORS ACTION (`captionFx` fx): flip rotates with the mechanism, inflate follows a blow, shake (3 frames) + white flash on hits, stamps slam in with a shake.
- 3D labels: `tag()` = small accent label with a leader line from a projected 3D point (used for ingredients).
- Stickers: hold 1.2 s with a small wobble (`sticker(..., { hold: 1.2, wobble: true })`).
- Hook title (`hookTitle2`): full and readable on frame 0 (it is the thumbnail); from frame 1 a gloss band sweeps the big word once, the big word breathes on a 0.5 s beat, the raw-material word turns accent for 0.4 s when spoken, the big word punches (1.12 + 2-frame shake) when the object appears, exits by scaling up into the cut; on the loop frames it re-enters with the same punch and settles on the frame-0 look (same grain seed), so the first and last frames match.

## Hands
No cartoon hands. Use the leather work glove `hand()` in js/parts.js (four 3-phalanx fingers with knuckles, 2-segment thumb, smooth palm, stitched cuff, work-jacket sleeve, leather grain bump, no outline shell), lit by the scene (warm light from hot objects). `pose(grip)` tightens the fist; give it an idle sway. Fallback if a pose cannot be made to read: a mechanical gripper from the factory set.

## Fixed channel language (never changes)

- **HUD** (optional since EP 02: `"hud": false` in the episode's script.json hides it): JetBrains Mono, top-left at (70, 250), cream text `#F3E9D2` at 90% on a 40% navy plate.
  - line 1: `EP. 01`
  - line 2: `STEP 3/6 · TILT`
  - line 3: one live readout (EP 01: `TEETH LOCKED 042/104`)
  - progress bar: thin 6 px, `PARTS ▸ ZIPPER` labels (adapt the two words: raw ▸ finished)
- **Step sticker**: cream `#F3E9D2` card, 6 px near-black outline `#101418`, tilted −6°, hard offset shadow (10 px, 35% black).
  Small mono label `STEP 3` + huge Anton title with full stop: `TILT.` Slides in with overshoot, holds ~1.6 s.
- **Captions**: Archivo Black, 1–3 words, uppercase, cream with 10 px dark outline; key word in the episode accent colour.
  Pop-in scale 0.85 → 1.0 in 0.12 s. Centred on x = 470, max 790 px wide, y ≈ 1290. Min 0.6 s on screen.
- **Hook** (rule since EP 02): the question title is readable from frame 0 (it is also the feed thumbnail), set high (y ≈ 400) so the subject stays visible;
  in the first second show the raw material turning into the object (EP 02: a fistful of sand pouring → snap cut → the same hand holding a glowing bottle that cools to clear).
  The loop frames repeat frame 0 with the title.
- **End card**: "NEXT EPISODE?" title, two pedestals with real 3D objects, green rim light (left) vs red rim light (right),
  "COMMENT BELOW", then "FOLLOW FOR EP. N+1". Last frame = first frame (clean hook plate) for a seamless loop.
- **Lens**: light vignette, fine grain, slight chromatic fringe at the edges. Bloom only on hot / emissive accents.
- **Light**: one warm key, one cold fill, one strong accent.
- **No** characters (stickman only on request, for scale), no emojis, no brands/logos, no vocal music.

## Per-episode palette log

| EP | Background | Warm key | Cold fill | Accent | Hero material |
|----|------------|----------|-----------|--------|---------------|
| 01 | Navy `#0E1A2B` | Brass lamp `#FFC777` | Cyan `#5EC8E5` | Safety orange `#FF5A1F` | Brass teeth `#D9A441`, nickel slider `#C9CED6`, denim tape `#2E4A6B` |
| 02 | Slate `#0F1A21` | Furnace ember `#FF8A2B` | Cyan `#6FD0E6` | Molten gold `#FFB62E` | Soda-lime glass `#9ADBC0`; hot ramp `#FFE9A8` (1,550 °C) → `#FF8A2B` (1,100 °C) → `#B8330F` (~580 °C) → clear |

## Reusable parts library (js/parts.js)

workbench, cutting mat (mm grid), tray, conveyor + rollers, pedestal, desk lamp, pegboard wall, shelf + bins, generic coin, dimension line, gauge.
EP 02 added: brick/refractory material, factory floor, hopper, furnace mouth, forehearth channel (+ feeder, plunger), shear blades, CSG moulds (blank / blow), invert arm, lehr belt + tunnel, stylised hand, gummy bear, pencil.
js/glass.js: glass material (fresnel rim + temperature glow), morphing lathe gob → parison → bottle with capped cutaway, molten-glass shader.
The HUD readout can be a value/total (EP 01) or label + text with an optional flag pill (EP 02). Accent colour is per episode (setAccent).
Episode-specific: js/zipper.js (tooth via CSG, chain layout from a gap function, slider with cutaway caps, tape sweep).
