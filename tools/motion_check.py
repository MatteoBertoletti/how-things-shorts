"""Frame-to-frame difference on the rendered segments: flags jumps inside a shot (glitches) at full frame rate."""
import subprocess, numpy as np, json, glob, sys
segs = json.load(open('render/segs.json'))['segs']
for k, (f0, f1) in enumerate(segs):
    fn = f'render/seg_{k:03d}.mp4'
    try: raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', fn, '-vf', 'scale=108:192', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    except Exception: continue
    a = np.frombuffer(raw, np.uint8).reshape(-1, 192, 108).astype(np.float32)
    if len(a) != f1 - f0: print(f'seg {k}: frame count {len(a)} != {f1 - f0}')
    d = np.abs(np.diff(a, axis=0)).mean((1, 2))
    med = np.median(d) if len(d) else 0
    spikes = [(f0 + i + 1, round(float(v), 1)) for i, v in enumerate(d) if v > max(6, 4 * med)]
    print(f'seg {k:2d} {f0:4d}-{f1:4d} median diff {med:4.1f} max {d.max() if len(d) else 0:5.1f} spikes {spikes[:6]}')
