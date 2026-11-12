"""Full render, resumable. Layers: the 3D plate (one encoded file per shot) and the overlay (PNG with alpha per frame),
so captions / HUD can be moved later without re-rendering the 3D.
usage: python tools/render.py out_dir plate|over|all [first_shot last_shot]"""
import asyncio, sys, base64, json, os, subprocess, time, math
def _fmt_vp():
    import json as _j, os as _o
    root = _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__)))
    ep = open(f'{root}/episodes/CURRENT').read().strip()
    try: f = _j.load(open(f'{root}/episodes/{ep}/script.json')).get('format', '9x16')
    except Exception: f = '9x16'
    return {'width': 1920, 'height': 1080} if f == '16x9' else {'width': 1080, 'height': 1920}
from playwright.async_api import async_playwright

import socket, subprocess, os, time as _t
def ensure_server(port=8765):
    s = socket.socket()
    try: s.connect(('localhost', port)); s.close(); return
    except OSError: pass
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    subprocess.Popen(['python3', '-m', 'http.server', str(port)], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    _t.sleep(1.0)
ensure_server()
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
FPS = 30
async def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        pg = await b.new_page(viewport=_fmt_vp())
        pg.on('pageerror', lambda e: print('PAGEERROR:', e, flush=True))
        await pg.goto('http://localhost:8765/film.html'); await pg.wait_for_function('window.ready===true', timeout=180000)
        info = json.loads(await pg.evaluate('JSON.stringify(EPINFO)')); END = info['END']
        NF = math.ceil(END * FPS - 1e-6)
        # frame ranges per shot (by frame index, so every frame is rendered exactly once)
        bounds = sorted(set([0] + [min(NF, round(a * FPS)) for a, b_ in info['shots'] if a < END] + [NF]))
        segs = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1) if bounds[i + 1] > bounds[i]]
        json.dump({'END': END, 'NF': NF, 'segs': segs}, open(f'{out}/segs.json', 'w'))
        MODE = sys.argv[2] if len(sys.argv) > 2 else 'all'
        lo, hi = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, len(segs) - 1)
        if MODE == 'over':
            os.makedirs(f'{out}/over', exist_ok=True); t0 = time.time()
            for f in range(NF):
                fn = f'{out}/over/{f:05d}.png'
                if os.path.exists(fn): continue
                d = await pg.evaluate(f"frame({f / FPS:.6f}, 0.9, 'over')")
                open(fn + '.tmp', 'wb').write(base64.b64decode(d.split(',')[1])); os.rename(fn + '.tmp', fn)
            print(f'overlay {NF} frames in {time.time() - t0:.0f}s', flush=True); await b.close(); return
        t0 = time.time(); done = 0
        for k, (f0, f1) in enumerate(segs):
            if k < lo or k > hi: continue
            fn = f'{out}/seg_{k:03d}.mp4'
            if os.path.exists(fn): continue
            tmp = f'{out}/tmp_{k:03d}.mp4'
            ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                                   '-c:v', 'libx264', '-crf', '15', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-g', '30', tmp], stdin=subprocess.PIPE)
            for f in range(f0, f1):
                d = await pg.evaluate(f"frame({f / FPS:.6f}, 0.93, '{MODE}')")
                ff.stdin.write(base64.b64decode(d.split(',')[1])); done += 1
            ff.stdin.close(); rc = ff.wait()
            if rc == 0: os.rename(tmp, fn)
            el = time.time() - t0
            print(f'seg {k} frames {f0}-{f1} done ({done} frames, {el/done:.2f}s/frame, {el/60:.1f} min)', flush=True)
        await b.close()
asyncio.run(main())
