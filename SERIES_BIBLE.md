# HOW THINGS — series bible

Vertical 3D shorts (1080x1920, 30 fps), built entirely in code (three.js + cannon-es + Playwright + ffmpeg).
Every episode stands alone. On-screen text and narration in English. Always "Simplified 3D visualization, not real footage".

## Episode list

| EP | Object | Angle | Material family | Length | Audio | Palette | Next-episode choice (green / red) |
|----|--------|-------|-----------------|--------|-------|---------|------------------------------------|
| 01 | Zipper (#5 metal, generic) | How it works inside | Metal + textile | ~49 s | ElevenLabs narrator (EN) | Brass & Blueprint | Glass bottle / Ballpoint pen |
| 02 | Glass bottle (generic long-neck) | How it's made (sand → bottle) | Glass | ~45 s | ElevenLabs "Brian" (EN) | Ember & Slate | Gummy bear / Pencil |
| 03 | Pencil (hexagonal, yellow, HB, no brand) | How it's made (tree → pencil); twist: no lead, two halves glued | Wood + mineral | ~38 s | ElevenLabs "Brian" (EN) | Cedar & Graphite | Gummy bear / Toy brick |
| 04 | Toy brick 2x4 (red hero, yellow + blue support, no brand, no logo) | Why it sticks (interference fit), then how it's made; twist: no glue, no click, the stud is slightly too big | Plastic | ~32 s | ElevenLabs "Brian" (EN) | Signal red on graphite-blue | Gummy bear / Ballpoint pen |
| 05 | Ballpoint pen (click pen, round white barrel, blue button and grip ring, no brand) | Why it has a ball, then how it's made; twist: the ball is the cap and the roller in one; callback to EP 04 (injection molding) | Plastic + metal | ~29 s | ElevenLabs "Brian" (EN) | Ink blue & brass on night navy | Crayon / Paper clip |
| LONG 01 | Pencil (long form 16:9, 4:45) | How pencils are made: no lead, history, graphite layers, core, wood, sandwich, paint/ferrule/eraser | Graphite + wood | 4:44.8 | ElevenLabs "Brian" (EN), stretched 10 % | Graphite / cedar / pencil yellow on slate | — (end screen: next = ballpoint pen) |

Material rotation: food, plastic, metal, glass, paper, textile, electronics, rubber, ceramics, everyday gadgets.
EP 04 should not be wood, glass or metal (gummy bear = food, toy brick = plastic; decided by comments).
EP 06 is decided by comments between a crayon (wax) and a paper clip (metal wire).

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

## Motion grammar (since EP 03, js/motion.js — re-exported by js/overlay.js; EP 01-02 helpers unchanged)
- OPENING TITLE "RAW TO REAL" (`titleRawReal`): frame 0 = the big word as a RAW blueprint (cream outline, cyan hatching, baseline / cap-height guides, corner ticks), readable on its own. 0.15-0.85 s a linear scan line turns it REAL behind it (accent gradient fill, gloss, ink outline, 7-copy extrusion down-right, sparks / graphite specks, guides fade). The small line drops word by word on the narration (spring overshoot + 1-frame RGB split); the raw-material word turns accent and gets a hand-drawn underline with a tiny pencil following it. On the object reveal: squash-and-stretch punch (1.14 x 0.92), extrusion pulse, 2-frame shake, light shockwave ring. Idle: per-letter breathing wave (40 ms offset), gloss band every 0.8 s, extrusion parallax. Exit: top line slides up, big word scales to 1.2 with blur. Loop frames rebuild the blueprint letter by letter and settle exactly on frame 0. Cover frame ≈ 1.0 s.
- ENTRANCES BY WORD TYPE (`kcap` words[].k): noun = scale pop with 4 % anticipation; verb = whip slide from the side with skew that snaps straight; q = drop with bounce, the "?" wobbles; twist = glitch hit (RGB split + 3 frames of slice jitter) then clean.
- NUMBERS (`odometer`): every digit rolls on its own with a staggered stop and blur, glow pulse on landing; the unit (or a `sub` line) always appears with the number. Shared-element morph: the number shrinks into its tag (1,100 °C -> BAKED).
- STRIKE-THROUGH (`strike`): wrong word, graphite scribble across it (0.25 s, dust), shake, letters fall with gravity, the right word whips in below in accent and rises into place (LEAD -> GRAPHITE, ONE PIECE? -> TWO HALVES.).
- CALLOUTS (`callout`): a line draws out of a 3D anchor (re-projected every sub-sample, lags for follow-through), the dark label expands and types its text with a cursor.
- STEPS: an ink swipe (`inkSwipe`, 5 frames, accent bars) carries the sticker in only on step changes; `stepSticker` slaps down with a tape strip, shakes, holds 1.0 s, then shrinks and docks into the progress `dock` (5 dots at the top of the safe area, current one filled and pulsing, `STEP n/5 · WORD` types underneath). The dock stays until the end card.
- EXITS: 0.1 s pop-out + small slide in the direction of motion. DEPTH: soft shadow plate behind every block, moving against the camera (`setParallax`). PARTICLES only on hits (graphite specks, wood chips).
- MOTION BLUR: the overlay is drawn with 6 temporal sub-samples (180° shutter) and averaged (`blurred`); held text stays crisp.
- EASING: springs with their own stiffness per property (position / scale / rotation), staggered parts, follow-through; linear only for scan lines.
- SOUND: soft tick/whoosh only on the title, the stickers (swipe) and the strike-throughs.
- Test bench: episodes/ep03_pencil/typo_test/ (render any page with tools/page.py).

## Retention rules (since EP 04, from the Studio data of EP 01-03; tightened in EP 05)
About half of the viewers swipe in the first seconds (49-53 %), the average viewer watches 23-31 s. EP 01 held above 100 % for 4 s, then lost ~40 points between 4 and 12 s while the narration listed static facts before showing the mechanism; once the mechanism appeared the curve stayed flat; it dropped again in the last 5 s (a stat, then the comment question).
Studio data read for EP 05: EP 01 and EP 02 both hold above 100 % for the first 4 s, then lose 30-45 points between 4 and 12 s, exactly where the narration listed nouns and numbers right after the opening question; both lose about 30 more points in the last 6 s (a last stat, then the comment question). Viewed vs swiped away: 47 % (EP 01), 59 % (EP 02), 49 % (EP 03).
- R1. The first mechanism shot starts at 1.2 s at the latest; the first twist is said before 5.5 s (6 s until EP 04).
- R2. No standalone fact, number or size before the first twist. A number only appears together with the image that explains it.
- R3. Frame 0 is already in motion (mid-fall, mid-press, mid-swing), never a settled pose, and the title is readable on it. The loop frames replay the motion so the last frame lands exactly on frame 0.
- R4. Payoff in the last 4 s, end card at most 2.5 s, last spoken sentence at most 7 words, no extra stat before the comment question.
- R5. Nothing between 4 and 12 s is a list; something visually new every 1.2-2.0 s there.
- R6 (since EP 05). One idea per line of narration, and every line shows a cause or an action on screen (something moves or changes), never only a label.
- Length now 28-32 s (EP 05; hard max 36 s). If the voice comes out short, stretch the pauses between lines (script.json `gaps`), never pay for a second take.

## Callback tag (since EP 05)
When a process repeats one from an earlier episode, say it in a few words of narration ("like the toy brick") and show a small pill tag "SAME TRICK AS EP. NN" with a tiny icon of that episode's hero object, and put the old hero object in the 3D scene next to the new part (EP 05: the red toy brick on the tray beside the freshly molded pen barrel). It costs no extra explanation time and rewards returning viewers. At most one callback per episode, never in the hook.

## Hands
No cartoon hands. Use the leather work glove `hand()` in js/parts.js (four 3-phalanx fingers with knuckles, 2-segment thumb, smooth palm, stitched cuff, work-jacket sleeve, leather grain bump, no outline shell), lit by the scene (warm light from hot objects). `pose(grip)` tightens the fist; give it an idle sway. Fallback if a pose cannot be made to read: a mechanical gripper from the factory set.
EP 03: no hands at all (owner's call: "la mano iniziale è brutta"). The hook shows the raw material alone (a floating cedar log section shedding sawdust) and snap-cuts to the finished object in the same spot. Prefer hand-free hooks from now on.

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
  Since EP 04 the hook follows the Retention rules R1-R5 (R6 since EP 05): frame 0 already in motion with the title readable, the first mechanism shot by 1.2 s, the first twist spoken before 6 s (5.5 s since EP 05), no fact or number before the twist, no lists between 4 and 12 s, end card at most 2.5 s.
- **End card**: "NEXT EPISODE?" title, two pedestals with real 3D objects, green rim light (left) vs red rim light (right),
  "COMMENT BELOW", then "FOLLOW FOR EP. N+1" (EP 04+: "FOLLOW: NEW ONE EVERY DAY"), at most 2.5 s. Last frame = first frame (clean hook plate) for a seamless loop.
- **Lens**: light vignette, fine grain, slight chromatic fringe at the edges. Bloom only on hot / emissive accents.
- **Light**: one warm key, one cold fill, one strong accent.
- **No** characters (stickman only on request, for scale), no emojis, no brands/logos, no vocal music.

## Per-episode palette log

| EP | Background | Warm key | Cold fill | Accent | Hero material |
|----|------------|----------|-----------|--------|---------------|
| 01 | Navy `#0E1A2B` | Brass lamp `#FFC777` | Cyan `#5EC8E5` | Safety orange `#FF5A1F` | Brass teeth `#D9A441`, nickel slider `#C9CED6`, denim tape `#2E4A6B` |
| 04 | Graphite-blue `#10151D` | `#FFB26B` | `#6FA8FF` | Signal red `#FF4B3E` | Glossy ABS (red `#E8261C`, yellow, blue `#2F6BFF`), x-ray = opaque horizontal section with bright cut faces + translucent ghost of the removed half + cyan edges, stress glow where it bends; brushed steel mould (CSG cavity); melt = `hotMat` |
| 05 | Night navy `#0F1420` | `#FFC27A` | `#7FB0FF` | Ink blue `#2F7BFF` | Textured carbide-grey ball `#8E9AA8`, brass socket `#C9A24B` with pale cut faces, glossy blue oil paste with a stringy stretch, cream paper `#F2E8D5` with a wet line that dulls as it dries; x-ray = section in the plane of motion through tip, barrel and refill + translucent brass ghost + cyan outline; ENLARGED tag while the tip is enlarged |
| 03 | Graphite `#14181F` | Cedar amber `#E39A52` | `#7FB3D9` | Pencil yellow `#FFD23A` | Cedar with growth rings, graphite (matte black, metallic sheen), clay grey, cream glue, yellow lacquer, brushed ferrule, pink eraser; kiln = furnaceMouth with a redder `hotMat` |
| 02 | Slate `#0F1A21` | Furnace ember `#FF8A2B` | Cyan `#6FD0E6` | Molten gold `#FFB62E` | Soda-lime glass `#9ADBC0`; hot ramp `#FFE9A8` (1,550 °C) → `#FF8A2B` (1,100 °C) → `#B8330F` (~580 °C) → clear |

## Reusable parts library (js/parts.js)

workbench, cutting mat (mm grid), tray, conveyor + rollers, pedestal, desk lamp, pegboard wall, shelf + bins, generic coin, dimension line, gauge.
EP 02 added: brick/refractory material, factory floor, hopper, furnace mouth, forehearth channel (+ feeder, plunger), shear blades, CSG moulds (blank / blow), invert arm, lehr belt + tunnel, stylised hand, gummy bear, pencil.
js/glass.js: glass material (fresnel rim + temperature glow), morphing lathe gob → parison → bottle with capped cutaway, molten-glass shader.
The HUD readout can be a value/total (EP 01) or label + text with an optional flag pill (EP 02). Accent colour is per episode (setAccent).
EP 03 added (js/pencil.js): procedural cedar side/end grain + bark, graphite/clay/paste/glue/lacquer materials, `hotMat` (emissive gradient + fresnel), pencil geometry (+ HB stamp decal), unpainted stick, instanced pencil field, grooved slat, slat -> hexagon section morph, generic toy brick, stroke font for handwriting. parts.js `hand(R, {curl, len, thumbJoint})`.
EP 05 added (js/pen.js): textured ball, brass socket lathe with an open/crimped lip (`setOpen`) and x-ray clip, ink film band, transparent refill with ink level, spring, click pen parts (front barrel with grip ring, rear with clip, button) and `makePen().setClick`, crayon and paper clip for end cards. motion.js callout `pre` (small qualifier like USUALLY); overlay.js endCard2 `leftColor` / `rightColor`.
Episode-specific: js/zipper.js (tooth via CSG, chain layout from a gap function, slider with cutaway caps, tape sweep).

## Long form (since LONG 01, "How Pencils Are Made")
Format profile 16:9: 1920x1080, 30 fps, 4:15-4:45 (hard max 5:00). `script.json` "format": "16x9" switches the renderer, page and tools (js/core.js `FMT`, film.html, tools/*.py viewport). Text safe box x 90-1830, y 90-960; nothing readable in the bottom 120 px (player controls). Type at 70 % of the vertical sizes: the motion helpers are drawn on a virtual canvas (W/0.7 x H/0.7) under `g.scale(0.7)`, with `SAFE` set in virtual units. Compact title card (2.5 s, top-left) instead of the big opening title; chapter lower-thirds (x 90-900, y 820-950, 3.4 s, animated, then gone). Motion blur 3 sub-samples. Render one file per shot (resumable), concat per chapter, then the film.
Hybrid shot mix (target 35/35/15/15; LONG 01 actual over the 4:25 body, end screen excluded): 3D 40.4 %, 2D 32.4 %, kinetic type 15.6 %, archival 11.6 %. 66 shots, 14.7 shots/min, mean 4.1 s, longest body shot 7.5 s (L2 cap 8 s: a long diagram is cut in two, the second half a punch-in on the same drawing, `punch()` in episode.js, with text kept in the safe area). 2D/archival/type plates are drawn in canvas (episodes/long01_pencil/d2.js) and get the same grade as 3D (vignette + grain), so the layers match; 2D frames cost ~0.1 s vs 1.5-2 s for 3D.
Archival rules: only public domain, CC0 or CC BY (never BY-SA); no faces, no people, no logos, no coins; license read from the Commons wikitext (tools/commons.py) and logged in credits.md + the description; credit line bottom-left on screen.
Look: the luma gate 60-140 per second rules out the #14181F graphite background for full-frame 2D; long form uses a slate gradient (#536072 centre, #262c37 edge) and paper darkened 36 %; 3D stations get slate floors/backdrops. Bloom threshold 0.82 / strength 0.25 so yellow lacquer does not turn into neon.
Voice: ~665 words for 4:25 of narration. Brian reads ~190 wpm inside sentences even at speed 0.95: slow him with a pitch-preserving rubberband stretch (`tempo` in script.json, 0.9 = ~10 %) and pauses (`min_gap` 0.55, chapter breaks +0.85) instead of paying for a new take. Music bed: synthesised in code (tools/ambient.py), 21 dB under the voice, ducked 5 dB more while he speaks. Captions: tools/srt.py from the word timestamps.
Pipeline: `tools/render.py <dir> plate a b` (one MP4 per shot, resumable) + `over` (overlay PNGs) -> `tools/compose_long.py` (per-chapter files chap_NN.mp4 with the overlay, cached, then joined with -c copy + the mix) -> `tools/qa_long.py` (all quality gates with numbers -> qa_report.md). Per-shot luma fixes go in the episode's `grade.json` (gain per shot index, baked into the plate before the overlay), not in the scene. Archival paper scans are multiplied to ~90 % white (no clipping). Delivery: master at CRF 15, then a 2-pass H.264 file under 95 MB (GitHub's 100 MB limit) for the direct link.
End screen: last 20 s, quiet factory loop, text only in y 120-330, two video slots (150-870 / 1050-1770 x 380-785) and the subscribe circle (960, 880) kept clean and slightly darkened.

## Long-form retention rules L1-L7 (since LONG 01)
- L1. Motion from frame 0 and the twist spoken before 8 s; the first 30 s contain no list (a promise is split into beats, one image each).
- L2. A visual change at least every 4-6 s, a new shot at least every 8 s; no static slide: every diagram draws itself, moves or counts.
- L3. Each chapter opens with a question or a surprising visual; one idea per sentence.
- L4. A re-hook about every 60-70 s (a question or a teaser for what is coming).
- L5. Numbers appear with their unit and with the image that explains them.
- L6. No text static for more than 2 s; callouts anchored to the object; captions never cover the subject.
- L7. Under 4 s of pure silence in the narration, no filler, "subscribe" said once, at the end.
