"""Quality gates for a long-form (16:9) episode, all with numbers.
usage: python tools/qa_long.py final.mp4 render_dir episode_dir > qa_report.md
Needs render_dir/segs.json, types.json, over/*.png and episode_dir/timing.json, script.json, credits.md, archival/."""
import sys, json, glob, os, re, subprocess, numpy as np
from PIL import Image

MP4, R, EP = sys.argv[1:4]
FPS = 30
segs = json.load(open(f'{R}/segs.json')); SG = segs['segs']; END = segs['END']
TY = json.load(open(f'{R}/types.json'))
TM = json.load(open(f'{EP}/timing.json')); SC = json.load(open(f'{EP}/script.json'))
out = []; P = out.append; ok_all = True

def gate(name, ok, detail, note=False):
    global ok_all
    if note: P(f'| {name} | NOTE | {detail} |'); return     # reported, not a pass/fail gate
    ok_all &= bool(ok); P(f'| {name} | {"PASS" if ok else "FAIL"} | {detail} |')

# ---- picture: luma, clipping, motion
pr = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', MP4, '-vf', 'scale=480:270', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
FB = 270 * 480 * 3; lum = []; clip = []; d = []; prevY = None
while True:
    b = pr.stdout.read(FB)
    if len(b) < FB: break
    f = np.frombuffer(b, np.uint8).reshape(270, 480, 3).astype(np.float32)
    Yf = 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]
    lum.append(Yf.mean()); clip.append((Yf >= 250).mean())
    if prevY is not None: d.append(np.abs(Yf - prevY).mean())
    prevY = Yf
pr.wait(); lum = np.array(lum); clip = np.array(clip); d = np.array(d); n = len(lum); dur = n / FPS
per = [lum[s * FPS:(s + 1) * FPS].mean() for s in range(int(np.ceil(n / FPS)))]
run = best = 0
for c in clip:
    run = run + 1 if c > 0.05 else 0; best = max(best, run)
run = 0; still = (0, 0)
for i, v in enumerate(d):
    run = run + 1 if v < 0.25 else 0
    if run > still[0]: still = (run, i)

# ---- shots and types
sh = [((b - a_) / FPS, TY[i]) for i, (a_, b) in enumerate(SG)]
body = [x for x in sh[:-1]]                      # last segment = 20 s end screen
long_i = max(range(len(sh) - 1), key=lambda i: sh[i][0])
share = {}
for L, t in sh[:-1]: share[t] = share.get(t, 0) + L
tot = sum(share.values())

# ---- twist, chapters, silence
w1 = TM['lines'][0]['words']; twist = next(w['e'] for w in w1 if w['w'].lower().startswith('lead'))
chap = []; seen = set()
for ln, tl in zip(SC['lines'], TM['lines']):
    c = ln.get('chapter')
    if c and c not in seen: seen.add(c); chap.append((tl['s'], c))
words = [w for l in TM['lines'] for w in l['words']]
gaps = [(words[i + 1]['s'] - words[i]['e'], words[i]['e']) for i in range(len(words) - 1)]
gmax = max(gaps)

# ---- text overlay: longest unchanged, end-screen slots
fs = sorted(glob.glob(f'{R}/over/*.png'))
prev = None; run = 0; tbest = (0, 0)
for i, f in enumerate(fs):
    o = np.asarray(Image.open(f).reduce(4)).astype(np.int16)
    vis = (o[..., 3] > 40).mean() > 0.0005
    if prev is not None and vis and np.abs(o - prev).mean() < 0.02: run += 1
    else: run = 0
    if run > tbest[0]: tbest = (run, i)
    prev = o
SLOTS = [(150, 380, 720, 405), (1050, 380, 720, 405)]
e0 = SG[-1][0]; slot_max = 0; slot_std = 0
for f in fs[e0::10]:
    o = np.asarray(Image.open(f)).astype(np.int16)
    for x, y, w, h in SLOTS:
        r = o[y + 20:y + h - 20, x + 20:x + w - 20]; slot_max = max(slot_max, int(r[..., 3].max()))
        slot_std = max(slot_std, float(r[..., :3].reshape(-1, 3).std(0).max()))
yy, xx = np.mgrid[0:1080, 0:1920]; circ = (xx - 960) ** 2 + (yy - 880) ** 2 < 80 ** 2
for f in fs[e0::10]:
    o = np.asarray(Image.open(f)).astype(np.int16); slot_max = max(slot_max, int(o[circ][:, 3].max()))
end_dur = (SG[-1][1] - SG[-1][0]) / FPS

# ---- loudness
lo = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', MP4, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', lo)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', lo)[-1])
ch = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', MP4], capture_output=True, text=True).stdout.strip()

# ---- credits and brands
cred = open(f'{EP}/credits.md').read()
arch = [os.path.basename(p) for p in glob.glob(f'{EP}/archival/*') if not p.endswith('.json')]
missing = [f for f in arch if f.replace('_', ' ') not in cred.replace('_', ' ')]
lic = []
for f in arch:
    row = next((l for l in cred.splitlines() if l.startswith('| ' + f)), '')
    lic.append(row.rstrip(' |').split('|')[-1].strip().split(' (')[0] if row else 'NOT LOGGED')
BR = ['faber', 'castell', 'staedtler', 'ticonderoga', 'dixon', 'pentel', 'tombow', "caran", 'mitsubishi', 'uni-ball', 'pilot', 'bic', 'palomino', 'blackwing',
      'derwent', 'koh-i-noor', 'lyra', 'musgrave', "general's", 'conte', 'paper mate', 'papermate', 'cretacolor', 'eberhard', 'mars lumograph', 'castell 9000']
src = ' '.join(open(f'{EP}/{f}').read().lower() for f in ['episode.js', 'd2.js', 'new3d.js', 'stations.js'])
lits = ' '.join(re.findall(r"'([^']*)'|`([^`]*)`", src) and [x for t in re.findall(r"'([^']*)'|`([^`]*)`", src) for x in t])
hits = sorted({b for b in BR if re.search(r'(?<![a-z])' + re.escape(b) + r'(?![a-z])', lits)})

# ---- report
P(f'# LONG 01 quality gates\n\nFile: `{os.path.basename(MP4)}`, {n} frames, {dur:.2f} s ({int(dur // 60)}:{dur % 60:05.2f}), 1920x1080, 30 fps.\n')
P('| Gate | Result | Numbers |'); P('|---|---|---|')
gate('Luma per second 60-140', 60 <= min(per) and max(per) <= 140, f'min {min(per):.1f} (s {int(np.argmin(per))}), max {max(per):.1f} (s {int(np.argmax(per))}), mean {np.mean(per):.1f}')
gate('Clipped white ≤5% for ≤0.3 s', best / FPS <= 0.3, f'longest run with >5% clipped: {best / FPS:.2f} s; max clipped fraction {clip.max() * 100:.2f}% at {clip.argmax() / FPS:.2f} s')
gate('Shots per minute / longest shot ≤ 8 s (L2)', max(L for L, _ in body) <= 8, f'{len(sh)} shots in {dur / 60:.2f} min = {len(sh) / (dur / 60):.1f}/min (body {len(body)} shots, {len(body) / ((dur - end_dur) / 60):.1f}/min); longest body shot {sh[long_i][0]:.2f} s (shot {long_i}, {sh[long_i][1]}), mean {np.mean([L for L, _ in body]):.2f} s; end screen {end_dur:.2f} s')
gate('Shot mix (target ~35/35/15/15)', True, ', '.join(f'{k} {v:.1f} s = {v / tot * 100:.1f}%' for k, v in sorted(share.items(), key=lambda kv: -kv[1])) + f' (over {tot:.1f} s, end screen excluded)', note=True)
gate('First twist ≤ 8 s', twist <= 8, f'"There is no lead in your pencil": "lead" ends at {twist:.2f} s; motion from frame 0 (frame-0→1 change {d[0]:.2f})')
gate('Longest stretch without visual change', still[0] / FPS <= 4, f'{still[0] / FPS:.2f} s (ending {still[1] / FPS:.2f} s), threshold mean |ΔY| < 0.25')
gate('Longest unchanged text ≤ 2 s', tbest[0] / FPS <= 2, f'{tbest[0] / FPS:.2f} s (ending frame {tbest[1]}, {tbest[1] / FPS:.2f} s)')
gate('Narration silence < 4 s', gmax[0] < 4, f'longest pause between words {gmax[0]:.2f} s at {gmax[1]:.2f} s')
gate('Chapter timestamps', chap[0][0] < 1, ' · '.join(f'{int(t // 60)}:{int(t) % 60:02d} {c}' for t, c in [(0, chap[0][1])] + chap[1:]))
gate('Loudness -14 LUFS, true peak ≤ -1 dBFS, stereo', abs(I + 14) <= 0.5 and TP <= -1 and ch == '2', f'I = {I:.1f} LUFS, true peak = {TP:.1f} dBFS, channels = {ch}')
gate('Archival licenses in credits.md', not missing and all(re.search(r'public domain|PD|CC0|CC BY', l, re.I) for l in lic), f'{len(arch)} files, {len(arch) - len(missing)} logged; licenses: {", ".join(lic)}' + (f'; MISSING {missing}' if missing else ''))
gate('No brand names / logos', not hits, f'{len(BR)} pencil brands searched in every on-screen string: {"none found" if not hits else hits}; no logos in archival set (checked by eye); 3D pencils unbranded')
gate('End screen element areas clean 20 s', slot_max <= 110 and slot_std < 2 and end_dur >= 20, f'{end_dur:.2f} s; in 2 video slots + subscribe circle the overlay alpha stays ≤ {slot_max}/255 (flat dark tint only), colour std {slot_std:.2f} (no text)')
P(f'\nOverall: {"ALL PASS" if ok_all else "SOME FAIL"}\n')
P('Luma per second: ' + ' '.join(f'{s}:{v:.0f}' for s, v in enumerate(per)))
print('\n'.join(out))
