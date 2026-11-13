"""Sibilance ratio of a voice: energy 5-9 kHz / energy 0.3-3 kHz, on speech frames only (RMS gate -40 dBFS), Welch PSD.
usage: python tools/sibilance.py file.wav [file2 ...]   -> ratio and dB per file"""
import sys, subprocess, numpy as np
def ratio(f, sr=44100, n=4096):
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32)
    w = np.hanning(n); P = np.zeros(n // 2 + 1); k = 0
    for i in range(0, len(x) - n, n // 2):
        s = x[i:i + n]
        if np.sqrt((s ** 2).mean()) < 0.01: continue
        P += np.abs(np.fft.rfft(s * w)) ** 2; k += 1
    fr = np.fft.rfftfreq(n, 1 / sr); b = lambda a, c: P[(fr >= a) & (fr < c)].sum()
    return b(5000, 9000) / b(300, 3000)
if __name__ == '__main__':
    for f in sys.argv[1:]: r = ratio(f); print(f'{f}: {r:.4f} ({10 * np.log10(r):.1f} dB)')
