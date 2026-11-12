"""Render stills: python tools/stills.py out_dir t1 t2 ...  (or 'info' to print EPINFO)"""
import asyncio, sys, base64, json, time, os
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
async def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        pg = await b.new_page(viewport=_fmt_vp())
        pg.on('console', lambda m: print('console:', m.text) if 'GPU stall' not in m.text else None)
        pg.on('pageerror', lambda e: print('PAGEERROR:', e))
        t0 = time.time()
        await pg.goto('http://localhost:8765/film.html'); await pg.wait_for_function('window.ready===true', timeout=180000)
        print('load %.1fs' % (time.time() - t0))
        info = await pg.evaluate('JSON.stringify(EPINFO)'); json.dump(json.loads(info), open(f'{out}/info.json', 'w'), indent=1)
        for a in sys.argv[2:]:
            t = float(a); t1 = time.time()
            d = await pg.evaluate(f'frame({t})')
            open(f'{out}/s_{t:06.2f}.jpg', 'wb').write(base64.b64decode(d.split(',')[1]))
            print('t=%.2f %.1fs' % (t, time.time() - t1))
        await b.close()
asyncio.run(main())
