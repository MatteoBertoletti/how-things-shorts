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
- **Hook**: tight on the finished object, giant 2-line caption, snap cut at ~2 s.
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
