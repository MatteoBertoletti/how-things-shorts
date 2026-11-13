"""Trim each narration line in real silence, transcribe with faster-whisper (word timestamps), match to the script,
lay the lines on one timeline, write episodes/<ep>/timing.json + audio/voice/voice.wav.
usage: python tools/voice_align.py episodes/ep01_zipper audio/voice"""
import json, sys, subprocess, re, difflib, os
import numpy as np, soundfile as sf
from faster_whisper import WhisperModel
EP, AD = sys.argv[1], sys.argv[2]; SR = 48000
S = json.load(open(f'{EP}/script.json'))
GAPS = S.get('gaps', {})             # extra pause BEFORE a line id, seconds (on top of the natural one)
MIN_GAP = S.get('min_gap', 0.28)     # minimum silence between lines
TEMPO = S.get('tempo')               # LONG 01 only (old): rubberband time-stretch. Since LONG 02: no stretch, "voice_chain": "new"
sys.path.insert(0, os.path.dirname(__file__)); from voice_chain import NEW as CHAIN_NEW
def load(fn):
    af = ['-af', f'rubberband=tempo={TEMPO}:pitch=1:formant=preserved:pitchq=quality:window=standard'] if TEMPO else []
    if S.get('voice_chain') == 'new': af = ['-af', CHAIN_NEW]
    x = subprocess.run(['ffmpeg', '-v', 'error', '-i', fn, *af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(x, np.float32).copy()
def trim(x, thr=-46):
    w = int(SR * 0.01); n = len(x) // w
    db = 20 * np.log10(np.sqrt(np.mean(x[:n * w].reshape(n, w) ** 2, 1)) + 1e-12)
    on = np.where(db > max(thr, db.max() - 42))[0]
    a, b = max(0, on[0] * w - int(0.02 * SR)), min(len(x), (on[-1] + 1) * w + int(0.06 * SR))
    y = x[a:b].copy(); f = int(0.008 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y, a / SR
NUM = {'5': 'five', '7': 'seven'}
def norm(w): w = w.lower().replace('millimeters', 'millimetres'); w = re.sub(r"[^a-z0-9']", '', w); return NUM.get(w, w)
model = WhisperModel('small.en', device='cpu', compute_type='int8')
out, t, report = [], 0.25, []
wav = np.zeros(int(SR * S.get("max_len", 80)), np.float32)
TAG = re.compile(r'\s*<[^>]+>\s*')
for L in S['lines']: L['say_tts'] = L['say']; L['say'] = TAG.sub(' ', L['say']).strip()   # break tags only matter to the TTS
for k, L in enumerate(S['lines']):
    x = load(f'{AD}/raw/{L["id"]:02d}.mp3'); y, off = trim(x)
    MP = S.get('max_pause')
    if MP:  # shorten long pauses inside the line, cutting only where it is really silent
        w = int(SR * 0.01); n = len(y) // w; db = 20 * np.log10(np.sqrt((y[:n * w].reshape(n, w) ** 2).mean(1)) + 1e-12)
        quiet = db < max(-50, db.max() - 40); cuts = []; i = 0
        while i < n:
            if quiet[i]:
                j = i
                while j < n and quiet[j]: j += 1
                L_ = (j - i) * 0.01
                if L_ > MP + 0.05 and i > 0 and j < n:
                    keep = MP; a = int((i * 0.01 + keep / 2) * SR); b = int((j * 0.01 - keep / 2) * SR); cuts.append((a, b))
                i = j
            else: i += 1
        for a, b in reversed(cuts):
            f = int(0.01 * SR); y = np.concatenate([y[:a], y[b:]]); y[a - f:a + f] *= np.concatenate([np.linspace(1, 0.5, f), np.linspace(0.5, 1, f)]) if a > f else 1
        if cuts: print('line', L['id'], 'pauses cut', [round((b - a) / SR, 2) for a, b in cuts])
    sf.write(f'{AD}/line_{L["id"]:02d}.wav', y, SR)
    a16 = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{AD}/line_{L["id"]:02d}.wav', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).copy()
    segs, _ = model.transcribe(a16, word_timestamps=True, language='en', beam_size=5,
                               initial_prompt=L['say'])
    hw = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
    sw = [w for w in re.split(r'\s+', L['say'].replace('...', ' ').replace('Y-shaped', 'Y-shaped')) if w]
    a = [norm(w) for w in sw]; b = [norm(w[0]) for w in hw]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False); mp = {}
    for blk in sm.get_matching_blocks():
        for j in range(blk.size): mp[blk.a + j] = blk.b + j
    ratio = sm.ratio()
    if ratio < 0.8:   # the prompt can make whisper skip a sentence: try again without it and keep the better match
        segs2, _ = model.transcribe(a16, word_timestamps=True, language='en', beam_size=5)
        hw2 = [(w.word.strip(), w.start, w.end) for s in segs2 for w in s.words]; b2 = [norm(w[0]) for w in hw2]
        sm2 = difflib.SequenceMatcher(None, a, b2, autojunk=False)
        if sm2.ratio() > ratio:
            hw, b, sm, ratio = hw2, b2, sm2, sm2.ratio(); mp = {}
            for blk in sm.get_matching_blocks():
                for j in range(blk.size): mp[blk.a + j] = blk.b + j
    words = []
    for i, w in enumerate(sw):
        if i in mp: s0, e0 = hw[mp[i]][1], hw[mp[i]][2]
        else: s0 = e0 = None
        words.append([w, s0, e0])
    # interpolate unmatched words
    dur = len(y) / SR
    for i, wd in enumerate(words):
        if wd[1] is None:
            p = next((words[j][2] for j in range(i - 1, -1, -1) if words[j][2] is not None), 0.0)
            n = next((words[j][1] for j in range(i + 1, len(words)) if words[j][1] is not None), dur)
            wd[1], wd[2] = p + 0.02, max(p + 0.05, n - 0.02)
    gap = GAPS.get(str(L['id']), 0)
    if k: t += max(MIN_GAP, 0) + gap
    i0 = int(t * SR); wav[i0:i0 + len(y)] += y
    out.append({'id': L['id'], 's': round(t, 3), 'e': round(t + dur, 3), 'say': L['say'],
                'words': [{'w': w, 's': round(t + s0, 3), 'e': round(t + e0, 3)} for w, s0, e0 in words]})
    report.append(f'{L["id"]:2d} {t:6.2f}-{t+dur:6.2f} match={ratio:.2f} heard="{" ".join(b)}"')
    t += dur
wav = wav[:int((t + 3) * SR)]
sf.write(f'{AD}/voice.wav', wav, SR, subtype='PCM_24')
json.dump({'lines': out, 'voice_end': round(t, 3)}, open(f'{EP}/timing.json', 'w'), indent=1)
print('\n'.join(report)); print('voice end', round(t, 2))
