"""Thumbnail 1280x720 from a plate frame + up to 3 words (Anton, thick outline). Rendered by Chrome via the local server.
usage: python tools/thumb.py frame.png out.png '<json spec>'
spec: {"lines": [["NO", "#F3E9D2"], ["LEAD?", "#FFD23A"]], "strike": 1, "x": 60, "y": 330, "size": 210, "focus": [0.6, 0.5], "zoom": 1.15}"""
import sys, json, asyncio, base64, shutil, os
from playwright.async_api import async_playwright
src, out, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shutil.copy(src, f'{root}/_thumb_bg.png')
lines = ''.join(f'<div class="l" style="color:{c}">{t}{"<span class=s></span>" if spec.get("strike") == i else ""}</div>' for i, (t, c) in enumerate(spec['lines']))
fx, fy = spec.get('focus', [0.5, 0.5]); z = spec.get('zoom', 1.0)
html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Anton; src: url(./node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2); }}
html,body{{margin:0;width:1280px;height:720px;overflow:hidden;background:#14181F}}
.bg{{position:absolute;inset:0;background:url(_thumb_bg.png) {fx*100}% {fy*100}%/{z*100}% no-repeat;filter:contrast(1.12) saturate(1.15)}}
.v{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(14,17,23,.82) 0%,rgba(14,17,23,.35) 45%,rgba(14,17,23,0) 70%),radial-gradient(ellipse at 60% 50%,rgba(0,0,0,0) 50%,rgba(0,0,0,.45) 100%)}}
.t{{position:absolute;left:{spec.get('x',60)}px;top:{spec.get('y',150)}px;font-family:Anton;font-size:{spec.get('size',190)}px;line-height:.98;letter-spacing:1px}}
.l{{position:relative;-webkit-text-stroke:14px #101418;paint-order:stroke fill;text-shadow:0 10px 0 rgba(0,0,0,.35)}}
.s{{position:absolute;left:-10px;right:-10px;top:52%;height:22px;background:#FF5A4A;border:6px solid #101418;transform:rotate(-6deg);border-radius:8px}}
.bar{{position:absolute;left:{spec.get('x',60)}px;top:{spec.get('y',150)-38}px;width:120px;height:16px;background:#FFD23A;border:5px solid #101418;border-radius:6px}}
</style></head><body><div class="bg"></div><div class="v"></div><div class="bar"></div><div class="t">{lines}</div></body></html>"""
open(f'{root}/_thumb.html', 'w', encoding='utf-8').write(html)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        await pg.goto('http://localhost:8765/_thumb.html'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=out); await b.close()
asyncio.run(main()); os.remove(f'{root}/_thumb.html'); os.remove(f'{root}/_thumb_bg.png'); print('thumb', out)
