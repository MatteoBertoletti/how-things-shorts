"""Preview stills under an approximate YouTube Shorts UI on an iPhone (crop + top bar + right icons + bottom text).
usage: python tools/safe_preview.py out.jpg still1.jpg still2.jpg ..."""
import sys
from PIL import Image, ImageDraw
out, ims = sys.argv[1], sys.argv[2:]
tiles = []
for fn in ims:
    im = Image.open(fn).convert('RGBA'); W, H = im.size
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.rectangle((0, 0, W, 230), fill=(0, 0, 0, 110))                    # top bar
    for i in range(6): d.ellipse((925, 1030 + i * 140, 1035, 1140 + i * 140), outline=(255, 255, 255, 230), width=7)  # icons
    d.rectangle((0, 1600, W, H), fill=(0, 0, 0, 120))                   # channel + title
    d.rounded_rectangle((60, 1640, 560, 1700), 20, fill=(255, 255, 255, 200)); d.rectangle((60, 1740, 820, 1780), fill=(255, 255, 255, 170))
    d.rectangle((0, 0, 50, H), fill=(255, 0, 0, 90)); d.rectangle((W - 50, 0, W, H), fill=(255, 0, 0, 90))   # iPhone crop
    tiles.append(Image.alpha_composite(im, ov).convert('RGB').resize((432, 768)))
c = Image.new('RGB', (432 * len(tiles) + 10 * (len(tiles) - 1), 768), (20, 20, 20))
for i, t in enumerate(tiles): c.paste(t, (i * 442, 0))
c.save(out, quality=88)
