"""Voice chains (since LONG 02). NEW: no time-stretch; highpass 70 Hz, gentle de-esser, -3 dB around 7 kHz, light compression.
OLD (LONG 01): rubberband stretch 0.9 + 8 dB into a hard limiter (kept only to rebuild the A/B comparison).
usage: python tools/voice_chain.py new|old lines_dir out.wav [gaps_json] [lufs]
Lines NN.mp3 are trimmed of leading/trailing silence, processed, and joined with gaps (default 0.5 s; json {"id": seconds} after that line)."""
import sys, os, json, glob, subprocess, numpy as np, re
SR = 44100
NEW = 'highpass=f=70,deesser=i=0.4:m=0.5:f=0.5:s=o,equalizer=f=7000:t=o:w=1:g=-3,acompressor=threshold=-20dB:ratio=2:attack=15:release=200:knee=4'
OLD = 'rubberband=tempo=0.9:pitch=1:formant=preserved:pitchq=quality:window=standard'
TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse'
def dec(f, af):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-af', af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32)
def lufs(x):
    import tempfile, soundfile as sf
    with tempfile.NamedTemporaryFile(suffix='.wav') as t:
        sf.write(t.name, x, SR, subtype='FLOAT')
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', t.name, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])
def build(mode, d, gaps={}, target=-16.0, ids=None):
    parts = []
    files = sorted(glob.glob(f'{d}/*.mp3'))
    for f in files:
        i = int(os.path.basename(f)[:2])
        if ids and i not in ids: continue
        x = dec(f, TRIM + ',' + (NEW if mode == 'new' else OLD))
        if mode == 'old':                                   # LONG 01 premix: +8 dB into a hard limiter
            x = np.clip(x * 10 ** (8 / 20), -1, 1); x = dec_limit(x)
        parts += [x, np.zeros(int(gaps.get(str(i), 0.5) * SR), np.float32)]
    y = np.concatenate(parts[:-1])
    I, tp = lufs(y); y = y * 10 ** ((target - I) / 20)
    return y
def dec_limit(x):
    import tempfile, soundfile as sf
    with tempfile.NamedTemporaryFile(suffix='.wav') as t:
        sf.write(t.name, x, SR, subtype='FLOAT')
        return dec(t.name, 'alimiter=limit=0.55:attack=3:release=60:level=disabled')
if __name__ == '__main__':
    import soundfile as sf
    mode, d, out = sys.argv[1:4]; gaps = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}; tgt = float(sys.argv[5]) if len(sys.argv) > 5 else -16
    y = build(mode, d, gaps, tgt); sf.write(out, y, SR, subtype='PCM_24'); I, tp = lufs(y); print(out, f'{len(y) / SR:.2f} s, {I:.1f} LUFS, peak {tp:.1f} dBFS')
