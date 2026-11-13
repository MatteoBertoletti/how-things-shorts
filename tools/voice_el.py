"""ElevenLabs narration, run inside GitHub Actions (the key lives only in the repo secret).
usage: python tools/voice_el.py episodes/ep01_zipper out_dir cache_dir
- always writes out_dir/voices.json (voice library summary, no secrets)
- if episodes/<ep>/voice_request.json has a voice_id: one TTS request per line (neighbour lines as context),
  cached by text+voice+model+settings so a re-run never pays twice -> out_dir/<ep>/lines/NN.mp3
"""
import json, os, sys, hashlib, shutil, urllib.request, urllib.error
EP, OUT, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]
KEY = os.environ['ELEVENLABS_API_KEY'].strip()
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
def api(path, body=None):
    r = urllib.request.Request('https://api.elevenlabs.io' + path, method='POST' if body else 'GET',
        headers={'xi-api-key': KEY, 'Content-Type': 'application/json'}, data=json.dumps(body).encode() if body else None)
    with urllib.request.urlopen(r, timeout=180) as f: return f.read()
vs = json.loads(api('/v1/voices'))['voices']
json.dump([{'id': v['voice_id'], 'name': v['name'], 'category': v.get('category'), 'labels': v.get('labels'),
            'description': (v.get('description') or '')[:160]} for v in vs], open(f'{OUT}/voices.json', 'w'), indent=1)
try: print('subscription', json.loads(api('/v1/user/subscription')).get('character_count'), '/', json.loads(api('/v1/user/subscription')).get('character_limit'))
except Exception as e: print('subscription n/a', e)
REQ = f'{EP}/voice_request.json'
if not os.path.exists(REQ): sys.exit(0)
R = json.load(open(REQ))
S = json.load(open(f'{EP}/script.json')); lines = S['lines']
NAME = os.path.basename(EP)

def narrate(vid, models, st, d, only=(), takes={}):
    """one TTS request per line (neighbour lines as context, always taken from the full script so a later full run hits the cache)"""
    os.makedirs(d, exist_ok=True)
    for k, L in enumerate(lines):
        if only and L['id'] not in only: continue
        text = L['say']; prev = ' '.join(x['say'] for x in lines[max(0, k-2):k]); nxt = lines[k+1]['say'] if k+1 < len(lines) else ''
        take = takes.get(str(L['id']), 0)
        done = False
        for model in models:
            body = {'text': text, 'model_id': model, 'voice_settings': st, 'previous_text': prev, 'next_text': nxt}
            if take: body['seed'] = 1000 + take
            h = hashlib.sha1(json.dumps([text, vid, model, st, prev, nxt, take]).encode()).hexdigest()[:16]
            fn = f'{CACHE}/{h}.mp3'
            if not os.path.exists(fn):
                try: open(fn, 'wb').write(api(f'/v1/text-to-speech/{vid}?output_format=mp3_44100_192', body)); print('tts', L['id'], model, len(text), 'chars')
                except urllib.error.HTTPError as e: print('tts error', L['id'], model, e.code, e.read().decode()[:300]); continue
            else: print('cached', L['id'])
            shutil.copy(fn, f"{d}/{L['id']:02d}.mp3"); done = True; break
        if not done: sys.exit(f'TTS failed for line {L["id"]}')

# voice test: several voices / settings on a few lines -> out/<ep>/samples/<key>/NN.mp3
for smp in R.get('samples', []):
    narrate(smp['voice_id'], smp.get('models', ['eleven_multilingual_v2']), smp['settings'], f"{OUT}/{NAME}/samples/{smp['key']}", set(smp['lines']))
vid = R.get('voice_id')
if not vid: sys.exit(0)
models = R.get('models', ['eleven_multilingual_v2']); st = R.get('settings', {})
narrate(vid, models, st, f"{OUT}/{NAME}/lines", set(R.get('only', [])), R.get('take', {}))
json.dump({'voice_id': vid, 'models': models, 'settings': st}, open(f"{OUT}/{NAME}/voice_used.json", 'w'))
