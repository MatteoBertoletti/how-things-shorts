import asyncio, json, sys
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
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1080, 'height': 1920}); pg.on('pageerror', lambda e: print('ERR', e))
        await pg.goto('http://localhost:8765/film.html'); await pg.wait_for_function('window.ready===true', timeout=180000)
        info = json.loads(await pg.evaluate('JSON.stringify(EPINFO)'))
        info['ticks'] = json.loads(await pg.evaluate('JSON.stringify(lockTicks())'))
        json.dump(info, open(sys.argv[1], 'w'))
        print(len(info['ticks']), 'ticks', len(info['sfx']), 'sfx', info['END'])
        await b.close()
asyncio.run(main())
