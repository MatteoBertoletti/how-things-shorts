"""Mix: voice on top, one Mixkit effect per event (+ optional click per tick), ambient bed ~13 dB under the effects,
a short dip before the twist and the payoff, loudness -14 LUFS.
usage: python tools/mix.py audio/events.json episodes/<ep>/sound.json out.wav [voice.wav]   (sound.json: {map: {name: [mixkit_id, gain_dB, onset|peak, trim_s|null]}, bed: id, ticks: bool})"""
import json, sys, subprocess, numpy as np, soundfile as sf
SR = 48000
ev = json.load(open(sys.argv[1])); OUT = sys.argv[3]; END = ev['END']
def load(i, a=0, b=None):
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f'audio/sfx/{i}.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).copy()
    x = x[int(a * SR): int(b * SR) if b else None]
    f = int(0.004 * SR); x[:f] *= np.linspace(0, 1, f); f2 = min(len(x) // 3, int(0.05 * SR)); x[-f2:] *= np.linspace(1, 0, f2)
    return x / (np.abs(x).max() + 1e-9) * 0.5
def marks(x):
    w = 480; n = len(x) // w; db = 20 * np.log10(np.sqrt((x[:n * w].reshape(n, w) ** 2).mean(1)) + 1e-9)
    return np.argmax(db > db.max() - 30) * w / SR, np.argmax(db) * w / SR
# name -> (sample id, gain dB, align 'onset'|'peak', trim_end)
SND = json.load(open(sys.argv[2]))
MAP = {k: (tuple(v) if not isinstance(v[0], list) else [tuple(x) for x in v]) for k, v in SND['map'].items()}
N = int((END + 0.2) * SR); fx = np.zeros(N, np.float32); cache = {}
def place(buf, x, t, g):
    i = int(t * SR); a, b = max(0, i), min(len(buf), i + len(x))
    if b > a: buf[a:b] += x[a - i: b - i] * 10 ** (g / 20)
wcount = 0; log = []
for e in sorted(ev['sfx'], key=lambda e: e['t']):
    if e['n'] == 'dip': continue
    m = MAP[e['n']]
    if isinstance(m, list): m = m[wcount % len(m)]; wcount += 1
    i, g, al, tr = m
    key = (i, tr)
    if key not in cache: x = load(i, 0, tr); cache[key] = (x, *marks(x))
    x, on, pk = cache[key]; t = e['t'] - (pk if al == 'peak' else on)
    place(fx, x, t, g); log.append((round(e['t'], 2), e['n'], i))
    for k_, (dt_, dg_) in enumerate(SND.get('repeat', {}).get(e['n'], [])): place(fx, x, t + dt_, g + dg_)
# tooth clicks: one per lock / unlock (drop jumps at shot cuts)
ticks = ev.get('ticks', []) if SND.get('ticks') else []; steps = {}
for k in ticks: steps.setdefault(round(k['t'] * 240), []).append(k)
jumps = [s for s, v in steps.items() if len(v) >= 15]
good = [k for s, v in steps.items() if not any(abs(s - j) <= 3 for j in jumps) for k in v]
c1 = load(2857, 0, 0.16) if ticks else None; c2 = load(2577, 0, 0.09) if ticks else None; o1, _ = marks(c1) if ticks else (0, 0); o2, _ = marks(c2) if ticks else (0, 0)
for j, k in enumerate(sorted(good, key=lambda k: k['t'])):
    jit = ((j * 7919) % 13) / 13 * 3 - 1.5
    if k['d'] > 0: place(fx, c1 if j % 2 else c2, k['t'] - (o1 if j % 2 else o2), -17 + jit)
    else: place(fx, c2, k['t'] - o2, -19 + jit)
print('tooth clicks', len(good), 'of', len(ticks))
# voice
v, vsr = sf.read(sys.argv[4] if len(sys.argv) > 4 else 'audio/voice/voice.wav', dtype='float32'); v = v[:N] if len(v) >= N else np.pad(v, (0, N - len(v)))
# duck effects under the voice (-4 dB), smooth envelope
w = 480; n = N // w; ve = np.sqrt((v[:n * w].reshape(n, w) ** 2).mean(1)); act = (ve > 0.01).astype(np.float32)
env = np.zeros_like(act); a = 0
for i in range(len(act)): a = a + (act[i] - a) * (0.4 if act[i] > a else 0.04); env[i] = a
duck = np.repeat(1 - (1 - 10 ** (-4 / 20)) * env, w); duck = np.pad(duck, (0, N - len(duck)), constant_values=1)
fx *= duck
# bed: low, clean industrial hum, filtered, ~13 dB under the effects
BEDSRC = SND.get('bed_file') or f"audio/sfx/{SND.get('bed', 2504)}.mp3"
bed = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', BEDSRC, '-af', SND.get('bed_filter', 'highpass=f=45,lowpass=f=1600'), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).copy()
bed = np.tile(bed, 2)[:N]; fad = int(0.6 * SR); bed[:fad] *= np.linspace(0, 1, fad); bed[-fad:] *= np.linspace(1, 0, fad)
def rms_active(x):
    m = len(x) // 19200; r = np.sqrt((x[:m * 19200].reshape(m, 19200) ** 2).mean(1)); r = r[r > 1e-3]; return np.sqrt((r ** 2).mean())
if 'bed_db_voice' in SND:   # long form: the bed sits a fixed level under the voice and ducks a little more while it speaks
    bed *= (rms_active(v) * 10 ** (SND['bed_db_voice'] / 20)) / (np.sqrt((bed ** 2).mean()) + 1e-9); bed *= np.pad(np.repeat(1 - (1 - 10 ** (-5 / 20)) * env, w), (0, N - n * w), constant_values=1)
else: bed *= (rms_active(fx) * 10 ** (-13 / 20)) / (np.sqrt((bed ** 2).mean()) + 1e-9)
# dips: fx + bed fall away just before the twist and the payoff
gate = np.ones(N, np.float32)
for e in ev['sfx']:
    if e['n'] != 'dip': continue
    a = int(e['t'] * SR); b = int((e['t'] + 0.3) * SR); r = int(0.05 * SR)
    gate[a:a + r] = np.minimum(gate[a:a + r], np.linspace(1, 0.08, r)); gate[a + r:b] = 0.08; gate[b:b + r] = np.minimum(gate[b:b + r], np.linspace(0.08, 1, r))
mix = v * 1.0 + (fx + bed) * gate
# loop: fade the very end so the restart is clean
fe = int((SND.get('tail_fade', 0.12)) * SR); mix[-fe:] *= np.linspace(1, 0, fe)
sf.write('audio/premix.wav', mix, SR, subtype='FLOAT')
# loudness -14 LUFS, true peak -1.5 (two-pass)
r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'audio/premix.wav', '-af', 'volume=8dB,alimiter=limit=0.55:attack=3:release=60:level=disabled', '-c:a', 'pcm_f32le', 'audio/premix_l.wav'], check=True)
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', 'audio/premix_l.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
js = json.loads(r[r.rindex('{'): r.rindex('}') + 1])
af = f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true"
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'audio/premix_l.wav', '-af', af, '-ar', str(SR), '-ac', '2', '-c:a', 'pcm_s24le', OUT], check=True)
for t, nme, i in log: print(f'{t:6.2f} {nme:12s} {i}')
