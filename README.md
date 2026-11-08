# how-things-shorts

Vertical 3D shorts about how everyday objects are made and how they work inside. Everything is built in code:
three.js scenes + cannon-es physics, rendered frame by frame with Playwright, cut and mixed with ffmpeg.
Simplified 3D visualization, not real footage.

- `SERIES_BIBLE.md` — episode list, palettes, sticker / caption / end-card style
- `episodes/<ep>/script.json` — narration lines
- `.github/workflows/voice.yml` — ElevenLabs narration (secret `ELEVENLABS_API_KEY`), output on branch `voice-out`

## Pipeline (per episode)
1. `npm i` (three, cannon-es, three-bvh-csg, fonts) and serve the folder: `python3 -m http.server 8765`
2. Narration: edit `episodes/<ep>/voice_request.json`, push -> branch `voice-out`; then `python tools/voice_align.py episodes/<ep> audio/voice`
3. Stills: `python tools/stills.py out 1.0 15.0 ...`  ·  full render: `python tools/render.py render` (one file per shot, resumable)
4. Click track + mix: `python tools/dump_ticks.py audio/events.json` then `python tools/mix.py audio/events.json audio/mix.wav` (Mixkit SFX in `audio/sfx/<id>.mp3`)
5. `python tools/motion_check.py` for glitches at full frame rate, then concat + mux with ffmpeg.
