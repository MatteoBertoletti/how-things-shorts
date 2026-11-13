"""Chapter-by-chapter composite for a long-form episode (resumable, cached).
For each chapter: join its plate segments, lay the overlay PNGs on top -> render_dir/chap_NN.mp4.
Then join the chapter files with -c copy and add the mix -> out.
usage: python tools/compose_long.py render_dir episode_dir mix.wav out.mp4"""
import sys, json, os, subprocess

R, EP, MIX, OUT = sys.argv[1:5]
FPS = 30
SG = json.load(open(f'{R}/segs.json'))['segs']
GR = {int(k): v for k, v in json.load(open(f'{EP}/grade.json')).items() if not k.startswith('_')} if os.path.exists(f'{EP}/grade.json') else {}
os.makedirs(f'{R}/graded', exist_ok=True)
def plate(i):          # the plate segment, with its luma grade (gain) baked in when grade.json asks for one
    src = f'{R}/seg_{i:03d}.mp4'
    if i not in GR: return src
    out = f'{R}/graded/seg_{i:03d}_{GR[i]:.3f}.mp4'
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
        g = GR[i]; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f'format=rgb24,lutrgb=r=val*{g}:g=val*{g}:b=val*{g},format=yuv420p',
                                   '-c:v', 'libx264', '-crf', '15', '-preset', 'veryfast', '-r', str(FPS), '-g', '30', out[:-4] + '.tmp.mp4'], check=True)
        os.replace(out[:-4] + '.tmp.mp4', out)
    return out
SC = json.load(open(f'{EP}/script.json')); TM = json.load(open(f'{EP}/timing.json'))
starts = []; seen = set()
for ln, tl in zip(SC['lines'], TM['lines']):
    c = ln.get('chapter')
    if c not in seen: seen.add(c); starts.append((0.0 if not starts else tl['s'], c))
# a segment belongs to the chapter in which most of it plays
groups = [[] for _ in starts]
for i, (a, b) in enumerate(SG):
    mid = (a + b) / 2 / FPS
    k = max(j for j, (t, _) in enumerate(starts) if t <= mid or j == 0); groups[k].append(i)
files = []
for k, g in enumerate(groups):
    if not g: continue
    f0, f1 = SG[g[0]][0], SG[g[-1]][1]; out = f'{R}/chap_{k:02d}.mp4'; files.append(out)
    src = [plate(i) for i in g]
    if os.path.exists(out) and os.path.getmtime(out) > max(os.path.getmtime(s) for s in src):
        print(f'chapter {k} {starts[k][1]}: cached'); continue
    lst = f'{R}/chap_{k:02d}.txt'
    open(lst, 'w').write(''.join(f"file '{os.path.relpath(s, R)}'\n" for s in src))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', f'{R}/chap_plate.mp4'], check=True)
    tmp = out[:-4] + '.tmp.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{R}/chap_plate.mp4', '-framerate', str(FPS), '-start_number', str(f0), '-i', f'{R}/over/%05d.png',
                    '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto:shortest=1,format=yuv420p[v]', '-map', '[v]', '-frames:v', str(f1 - f0),
                    '-c:v', 'libx264', '-crf', '15', '-preset', 'veryfast', '-r', str(FPS), '-g', '60', tmp], check=True)
    os.replace(tmp, out)
    print(f'chapter {k} {starts[k][1]}: frames {f0}-{f1} ({(f1 - f0) / FPS:.2f} s, shots {g[0]}-{g[-1]}) -> {out}')
open(f'{R}/chapters.txt', 'w').write(''.join(f"file '{os.path.basename(f)}'\n" for f in files))
tmp = OUT[:-4] + '.tmp.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{R}/chapters.txt', '-i', MIX, '-map', '0:v', '-map', '1:a',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp], check=True)
os.replace(tmp, OUT); print('master', OUT)
