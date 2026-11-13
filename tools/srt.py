"""SRT captions from the aligned word timestamps (timing.json). One sentence per cue when it fits,
otherwise split at ~42 characters per line, max 2 lines, max ~5.5 s per cue.
usage: python tools/srt.py episodes/<ep>/timing.json out.srt"""
import sys, json
T = json.load(open(sys.argv[1]))
def ts(x): h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60; return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)) % 1000:03d}'
cues = []
for L in T['lines']:
    words = L['words']; say = L['say'].split()
    # use the script spelling (punctuation) with the aligned times
    if len(say) == len(words): words = [dict(w, w=s) for w, s in zip(words, say)]
    cur = []
    for w in words:
        cand = ' '.join(x['w'] for x in cur + [w])
        if cur and (len(cand) > 84 or w['s'] - cur[0]['s'] > 5.5): cues.append(cur); cur = []
        cur.append(w)
    if cur: cues.append(cur)
out = []
for i, c in enumerate(cues):
    txt = ' '.join(x['w'] for x in c)
    if len(txt) > 42:   # two balanced lines
        best = min(range(1, len(c)), key=lambda k: abs(len(' '.join(x['w'] for x in c[:k])) - len(' '.join(x['w'] for x in c[k:]))))
        txt = ' '.join(x['w'] for x in c[:best]) + '\n' + ' '.join(x['w'] for x in c[best:])
    s = c[0]['s']; e = max(c[-1]['e'], s + 0.8)
    if i + 1 < len(cues): e = min(e + 0.25, cues[i + 1][0]['s'] - 0.02)
    out.append(f'{i + 1}\n{ts(s)} --> {ts(e)}\n{txt}\n')
open(sys.argv[2], 'w').write('\n'.join(out)); print(len(out), 'cues')
