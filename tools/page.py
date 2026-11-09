"""Render any page that exposes window.END and window.frame(t) -> JPEG data URL.
usage: python tools/page.py <page path> reel <out.mp4> [t0 t1]   |   python tools/page.py <page path> still <out_dir> t1 t2 ..."""
import asyncio, sys, base64, os, subprocess, time, math, socket
from playwright.async_api import async_playwright
def ensure_server(port=8765):
    s = socket.socket()
    try: s.connect(('localhost', port)); s.close(); return
    except OSError: pass
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    subprocess.Popen(['python3', '-m', 'http.server', str(port)], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True); time.sleep(1.0)
ensure_server()
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']; FPS = 30
async def main():
    page, mode, out = sys.argv[1:4]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        pg = await b.new_page(viewport={'width': 1080, 'height': 1920})
        pg.on('pageerror', lambda e: print('PAGEERROR:', e, flush=True))
        pg.on('console', lambda m: print('console:', m.text, flush=True) if m.type == 'error' else None)
        await pg.goto(f'http://localhost:8765/{page}'); await pg.wait_for_function('window.ready===true', timeout=180000)
        END = await pg.evaluate('window.END')
        if mode == 'still':
            os.makedirs(out, exist_ok=True)
            for a in sys.argv[4:]:
                t = float(a); d = await pg.evaluate(f'frame({t}, 0.93)'); open(f'{out}/s_{t:06.3f}.jpg', 'wb').write(base64.b64decode(d.split(',')[1]))
        else:
            t0, t1 = (float(sys.argv[4]), float(sys.argv[5])) if len(sys.argv) > 5 else (0, END)
            f0, f1 = round(t0 * FPS), math.ceil(t1 * FPS - 1e-6); tmp = out + '.tmp.mp4'; st = time.time()
            ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp], stdin=subprocess.PIPE)
            for f in range(f0, f1):
                d = await pg.evaluate(f'frame({f / FPS:.6f}, 0.92)'); ff.stdin.write(base64.b64decode(d.split(',')[1]))
            ff.stdin.close()
            if ff.wait() == 0: os.rename(tmp, out)
            print(f'{f1 - f0} frames in {time.time() - st:.0f}s')
        await b.close()
asyncio.run(main())
