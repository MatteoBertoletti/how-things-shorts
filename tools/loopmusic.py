"""Warm 10 s seamless music loop (96 BPM, 16 beats): soft electric-piano chords, kalimba notes, sub bass, brushed hats, wrap-around reverb.
usage: python tools/loopmusic.py out.wav"""
import sys, numpy as np, soundfile as sf
from scipy.signal import lfilter, butter, sosfilt
SR = 48000; N = 10 * SR; BEAT = 0.625; rng = np.random.default_rng(3)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
out = np.zeros(N)
def add(x, t):  # circular add so tails wrap around the loop point
    i = int(t * SR) % N; n = len(x); idx = (np.arange(n) + i) % N; np.add.at(out, idx, x)
def rhodes(m, dur, a):
    n = int(dur * SR); x = np.arange(n) / SR; f = mid(m)
    env = np.minimum(1, x / 0.006) * np.exp(-x * 1.5)
    y = np.sin(2 * np.pi * f * x) + 0.45 * np.sin(2 * np.pi * 2 * f * x) * np.exp(-x * 2.5) + 0.12 * np.sin(2 * np.pi * 3 * f * x) + 0.1 * np.sin(2 * np.pi * 7.1 * f * x) * np.exp(-x * 14)
    return a * env * y * (1 + 0.12 * np.sin(2 * np.pi * 4.5 * x))
def kal(m, a):
    n = int(1.6 * SR); x = np.arange(n) / SR; f = mid(m)
    env = np.minimum(1, x / 0.003) * np.exp(-x * 3.2)
    return a * env * (np.sin(2 * np.pi * f * x) + 0.18 * np.sin(2 * np.pi * 2 * f * x) + 0.25 * np.sin(2 * np.pi * 5.4 * f * x) * np.exp(-x * 25))
def bass(m, dur, a):
    n = int(dur * SR); x = np.arange(n) / SR; env = np.minimum(1, x / 0.02) * np.exp(-x * 1.1)
    return a * env * (np.sin(2 * np.pi * mid(m) * x) + 0.2 * np.sin(2 * np.pi * 2 * mid(m) * x))
CH = [([52, 55, 59, 62], 36), ([52, 55, 59, 60], 33), ([57, 60, 64, 67], 29), ([59, 62, 64, 69], 31)]   # Cmaj9, Am9, Fmaj9, G6/9
for b, (notes, root) in enumerate(CH):
    t0 = b * 4 * BEAT
    for k, m in enumerate(notes): add(rhodes(m, 2.4, 0.11), t0 + k * 0.035)
    for k, m in enumerate(notes[1:]): add(rhodes(m, 1.2, 0.06), t0 + 2.5 * BEAT + k * 0.03)
    add(bass(root + 12, 2.4, 0.42), t0)
    add(bass(root + 12, 1.0, 0.25), t0 + 2.5 * BEAT)
MEL = [(0.5, 76), (2.0, 79), (3.5, 74), (4.5, 72), (6.0, 76), (7.5, 71), (8.5, 81), (10.0, 76), (11.5, 72), (12.5, 74), (14.0, 79), (15.0, 81)]
for bt, m in MEL: add(kal(m, 0.1), bt * BEAT)
for i in range(32):   # brushed hats on 8ths
    n = int(0.07 * SR); x = np.arange(n) / SR; h = rng.standard_normal(n) * np.exp(-x * 60)
    add(sosfilt(butter(2, [5000, 9500], 'bp', fs=SR, output='sos'), h) * (0.05 if i % 2 else 0.028), i * BEAT / 2)
dry = out
L = N; ir = rng.standard_normal(int(1.9 * SR)) * np.exp(-np.arange(int(1.9 * SR)) / SR * 2.6); ir[:int(0.02 * SR)] *= 0.2; ir /= np.sqrt((ir ** 2).sum())
irp = np.zeros(N); irp[:len(ir)] = ir
wet = np.fft.irfft(np.fft.rfft(dry) * np.fft.rfft(irp), N)
y = 0.8 * dry + 0.5 * wet
y = sosfilt(butter(2, 4800, 'lp', fs=SR, output='sos'), y); y = sosfilt(butter(2, 40, 'hp', fs=SR, output='sos'), y)
y = np.tanh(1.4 * y) / 1.4
y = y / np.abs(y).max() * 0.6
sf.write(sys.argv[1], y, SR, subtype='FLOAT')
print('rms', np.sqrt((y ** 2).mean()), 'wrap diff', abs(y[0] - y[-1]), 'step', np.abs(np.diff(y)).mean())
