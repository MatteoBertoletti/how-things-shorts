"""Synthesise a quiet ambient music bed (no samples, no licence): slow pad chords + sparse soft bells + air, reverb.
usage: python tools/ambient.py out.wav seconds [seed]"""
import sys, numpy as np, soundfile as sf
SR = 48000; OUT = sys.argv[1]; DUR = float(sys.argv[2]); rng = np.random.default_rng(int(sys.argv[3]) if len(sys.argv) > 3 else 7)
N = int(DUR * SR); t = np.arange(N) / SR
midi = lambda m: 440.0 * 2 ** ((m - 69) / 12)
CH = [[53, 57, 60, 64], [52, 55, 60, 67], [57, 60, 64, 67], [55, 59, 62, 69]]          # Fmaj7, C/E, Am7, G(add9)
BAR = 8.0
pad = np.zeros(N); bells = np.zeros(N)
def tone(f, n, det=0.0):
    ph = 2 * np.pi * f * (1 + det) * np.arange(n) / SR
    return np.sin(ph) + 0.28 * np.sin(2 * ph + 0.3) + 0.08 * np.sin(3 * ph + 1.1)
nb = int(np.ceil(DUR / BAR)) + 1
for b in range(nb):
    a = int(b * BAR * SR); L = int((BAR + 3.5) * SR); e = min(N, a + L)
    if a >= N: break
    n = e - a; env = np.minimum(1, np.arange(n) / (2.2 * SR)) * np.clip((L - np.arange(n)) / (3.5 * SR), 0, 1)
    for m in CH[b % 4]:
        for det in (-0.0025, 0.0025): pad[a:e] += 0.06 * env * tone(midi(m), n, det)
    pad[a:e] += 0.05 * env * np.sin(2 * np.pi * midi(CH[b % 4][0] - 12) * np.arange(n) / SR)
    # sparse bells: 3 notes per bar from the chord, an octave up
    for k in range(3):
        if rng.random() < 0.35: continue
        s = a + int((0.6 + k * 2.4 + rng.random() * 0.6) * SR); m = CH[b % 4][rng.integers(0, 4)] + 12
        if s >= N: continue
        L2 = min(N - s, int(3.0 * SR)); x = np.arange(L2) / SR
        bells[s:s + L2] += 0.05 * np.exp(-x * 1.8) * (np.sin(2 * np.pi * midi(m) * x) + 0.2 * np.sin(2 * np.pi * midi(m) * 3.01 * x))
air = np.convolve(rng.standard_normal(N), np.ones(64) / 64, mode='same') * 0.01
dry = pad + bells + air
# reverb: convolution with a 3.2 s exponentially decaying noise tail (FFT)
L = int(3.2 * SR); ir = rng.standard_normal(L) * np.exp(-np.arange(L) / SR * 2.2); ir[0] = 0; ir /= np.sqrt((ir ** 2).sum())
M = 1 << int(np.ceil(np.log2(N + L))); wet = np.fft.irfft(np.fft.rfft(dry, M) * np.fft.rfft(ir, M), M)[:N]
y = 0.65 * dry + 0.55 * wet
# gentle low-pass (one-pole) and stereo width by a short delay on the right channel
a = np.exp(-2 * np.pi * 3200 / SR); lp = np.zeros(N); acc = 0.0
yl = np.empty(N)
from scipy.signal import lfilter
yl = lfilter([1 - a], [1, -a], y)
d = int(0.012 * SR); yr = np.concatenate([np.zeros(d), yl[:-d]])
st = np.stack([yl, 0.85 * yr + 0.15 * yl], 1); st /= np.abs(st).max() + 1e-9; st *= 0.5
f = int(2.0 * SR); st[:f] *= np.linspace(0, 1, f)[:, None]; st[-f:] *= np.linspace(1, 0, f)[:, None]
sf.write(OUT, st.astype(np.float32), SR, subtype='FLOAT'); print('bed', OUT, DUR, 's')
