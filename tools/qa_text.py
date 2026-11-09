"""QA for the overlay layer: longest time any on-screen text stays visually unchanged, plus event stats.
usage: python tools/qa_text.py render_dir info.json"""
import sys, json, glob, numpy as np
from PIL import Image
R, INFO = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(f'{R}/over/*.png'))
prev = None; run = 0; best = (0, 0); vis_frames = 0
for i, f in enumerate(fs):
    a = np.asarray(Image.open(f).reduce(4)).astype(np.int16)
    visible = (a[..., 3] > 40).mean() > 0.0005
    if visible: vis_frames += 1
    if prev is not None and visible:
        d = np.abs(a - prev).mean()
        if d < 0.02: run += 1
        else: run = 0
        if run > best[0]: best = (run, i)
    else: run = 0
    prev = a
info = json.load(open(INFO))
caps = sorted(info['caps'], key=lambda c: c[0])
ev = [c for c in caps if c[3] != 'title-loop']
st = sorted(max(0, c[0]) for c in ev)
win = [s for s in st if 2 <= s <= 40]
print(f'frames {len(fs)}, frames with text {vis_frames}')
print(f'longest unchanged text: {best[0]} frames = {best[0] / 30:.2f} s (ending at frame {best[1]})')
print(f'text events: {len(ev)}; largest gap between event starts in 2-40 s: {max(b - a for a, b in zip(win, win[1:])):.2f} s')
