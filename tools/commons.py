"""Wikimedia Commons helper (no API: plain pages, polite UA).
usage: python tools/commons.py search "query" [n]        -> file titles from Special:MediaSearch
       python tools/commons.py info "File:Name.jpg"        -> author / source / date / license templates from the wikitext
       python tools/commons.py get "File:Name.jpg" out_dir [width]  -> downloads (thumbnail if width) + writes out_dir/<name>.json"""
import sys, re, json, os, urllib.parse, urllib.request, html, time
UA = 'RawToRealBot/1.0 (https://github.com/MatteoBertoletti/how-things-shorts)'
def get(url):
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as f: return f.read()
        except Exception as e:
            if k == 3: raise
            time.sleep(3 * (k + 1))
def search(q, n=12):
    s = get('https://commons.wikimedia.org/w/index.php?' + urllib.parse.urlencode({'search': q, 'title': 'Special:MediaSearch', 'type': 'image'})).decode()
    out = []
    for m in re.findall(r'File:[^"&\\<>]+', s):
        m = urllib.parse.unquote(m).replace('_', ' ')
        if m not in out: out.append(m)
    return out[:n]
LIC = re.compile(r'\{\{\s*((?:PD|CC|Cc|cc|self|LOC|Public domain|FAL|GFDL|Attribution|PD-)[^{}|]*)', re.I)
def info(title):
    t = title.replace(' ', '_')
    raw = get('https://commons.wikimedia.org/w/index.php?' + urllib.parse.urlencode({'title': t, 'action': 'raw'})).decode()
    field = lambda k: (re.search(r'\|\s*' + k + r'\s*=\s*(.*?)\n\s*\|', raw, re.S | re.I) or [None, ''])[1].strip()
    lic = sorted(set(x.strip() for x in LIC.findall(raw)))
    page = get('https://commons.wikimedia.org/wiki/' + urllib.parse.quote(t)).decode()
    url = re.search(r'https://upload\.wikimedia\.org/wikipedia/commons/[0-9a-f]/[0-9a-f]{2}/[^"?#]+', page)
    return {'title': title, 'page': 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(t), 'author': field('author')[:300], 'source': field('source')[:300],
            'date': field('date')[:120], 'description': field('description')[:300], 'license_templates': lic, 'original': url.group(0) if url else None}
if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'search': print('\n'.join(search(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 12)))
    elif cmd == 'info': print(json.dumps(info(sys.argv[2]), indent=1, ensure_ascii=False))
    elif cmd == 'get':
        I = info(sys.argv[2]); d = sys.argv[3]; os.makedirs(d, exist_ok=True); url = I['original']
        if len(sys.argv) > 4 and url:
            w = sys.argv[4]; p = url.split('/wikipedia/commons/')[1]; name = p.split('/')[-1]
            url = f'https://upload.wikimedia.org/wikipedia/commons/thumb/{p}/{w}px-{name}' + ('.jpg' if name.lower().endswith(('.tif', '.tiff', '.pdf')) else '')
        name = re.sub(r'[^A-Za-z0-9._-]', '_', sys.argv[2].split(':', 1)[1])
        data = get(url); open(f'{d}/{name}', 'wb').write(data); I['downloaded'] = url; I['file'] = name
        json.dump(I, open(f'{d}/{name}.json', 'w'), indent=1, ensure_ascii=False); print(json.dumps(I, indent=1, ensure_ascii=False))
