// LONG 01: the 2D layer (16:9). Animated diagrams drawn in code, archival stills with a slow push, type backgrounds,
// and the shared grade (vignette + grain) so 3D, 2D and archival shots match. Everything is a pure function of time.
import { W, H, clamp, lerp, E, hash, noise1 } from '../../js/core.js';

export const P = { bg: '#14181F', bg2: '#1B212B', cedar: '#E39A52', cedarD: '#A8642F', cold: '#7FB3D9', acc: '#FFD23A', paper: '#F2E8D5',
  ink: '#101418', cream: '#F3E9D2', graphite: '#4A505C', graphD: '#2A2E36', clay: '#9AA1AA', red: '#FF5A4A', lead: '#8E98A6', wax: '#F6E7B8' };
export const FONT = { mono: '"JBMono"', title: '"Anton"', cap: '"Archivo Black"' };
const TAU = Math.PI * 2;
export const ease = { o: E.o, io: E.io, i: E.i, back: E.back };
const sp = (u) => clamp(u);   // shorthand

// ---------------- grade: identical look on every non-3D plate (the 3D plate gets the same from the lens pass) ----------------
let _grain = null;
function grainTiles() {
  if (_grain) return _grain;
  _grain = [0, 1, 2, 3].map(k => { const c = new OffscreenCanvas(512, 512), x = c.getContext('2d'), im = x.createImageData(512, 512);
    for (let i = 0; i < 512 * 512; i++) { const v = 128 + (hash(i * 1.37 + k * 911.3) - 0.5) * 120; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); return c; });
  return _grain;
}
export function grade(g, t, { vig = 0.32, grain = 0.10 } = {}) {
  g.save();
  const r = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 1.05);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${vig * 0.9})`); g.fillStyle = r; g.fillRect(0, 0, W, H);
  const tiles = grainTiles(), f = Math.floor(t * 30), tile = tiles[f % 4], ox = Math.floor(hash(f * 3.1) * 512), oy = Math.floor(hash(f * 7.7) * 512);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = grain; g.translate(-ox, -oy);
  for (let x = 0; x < W + 512; x += 512) for (let y = 0; y < H + 512; y += 512) g.drawImage(tile, x, y);
  g.restore();
}

// ---------------- backgrounds ----------------
export function bgGraphite(g, t, { tone = 0, grid = 1 } = {}) {
  const r = g.createRadialGradient(W * 0.5, H * 0.45, 50, W * 0.5, H * 0.5, W * 0.75);
  r.addColorStop(0, tone ? '#5a6476' : '#536072'); r.addColorStop(0.6, '#3a4352'); r.addColorStop(1, '#262c37'); g.fillStyle = r; g.fillRect(0, 0, W, H);
  if (grid) { g.save(); g.globalAlpha = 0.05 * grid; g.strokeStyle = P.cold; g.lineWidth = 1; const off = (t * 12) % 60;
    for (let x = -60 + off; x < W; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = -60 + off * 0.5; y < H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.restore(); }
  g.save(); for (let i = 0; i < 70; i++) { const x = (hash(i * 3.3) * W + t * (8 + 14 * hash(i))) % W, y = (hash(i * 5.1) * H - t * (5 + 9 * hash(i * 2))) % H;
    g.globalAlpha = 0.08 + 0.12 * hash(i * 7); g.fillStyle = i % 5 ? P.cold : P.acc; g.beginPath(); g.arc(x, (y + H) % H, 1 + 2 * hash(i * 9), 0, TAU); g.fill(); } g.restore();
}
let _fib = null;
function fibres() {
  if (_fib) return _fib; const c = new OffscreenCanvas(1024, 1024), x = c.getContext('2d'); x.fillStyle = P.paper; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { const px = hash(i * 1.3) * 1024, py = hash(i * 2.7) * 1024, a = hash(i * 4.1) * TAU, l = 4 + hash(i * 5.9) * 14;
    x.strokeStyle = `rgba(${130 + hash(i) * 70},${110 + hash(i * 2) * 60},${80 + hash(i * 3) * 50},0.13)`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  _fib = c; return c;
}
export function bgPaper(g, t, { dx = 0, dy = 0, dark = 0.36 } = {}) {
  const f = fibres(); g.save(); g.translate(-((dx % 1024) + 1024) % 1024, -((dy % 1024) + 1024) % 1024);
  for (let x = 0; x < W + 1024; x += 1024) for (let y = 0; y < H + 1024; y += 1024) g.drawImage(f, x, y); g.restore();
  if (dark) { g.fillStyle = `rgba(20,24,31,${dark})`; g.fillRect(0, 0, W, H); }
}

// ---------------- primitives ----------------
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
export function path(g, pts, prog = 1, { w = 8, col = P.cream, close = false, dash = null, cap = 'round', glow = 0, alpha = 1 } = {}) {
  if (prog <= 0 || pts.length < 2) return null;
  const P2 = close ? [...pts, pts[0]] : pts, L = plen(P2), lim = L * clamp(prog); let acc = 0, head = P2[0];
  g.save(); g.globalAlpha *= alpha; g.lineCap = cap; g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = col; if (dash) g.setLineDash(dash);
  if (glow) { g.shadowColor = col; g.shadowBlur = glow; }
  g.beginPath(); g.moveTo(P2[0][0], P2[0][1]);
  for (let i = 1; i < P2.length; i++) { const s = Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1]);
    if (acc + s >= lim) { const u = (lim - acc) / Math.max(1e-6, s); head = [lerp(P2[i - 1][0], P2[i][0], u), lerp(P2[i - 1][1], P2[i][1], u)]; g.lineTo(head[0], head[1]); break; }
    g.lineTo(P2[i][0], P2[i][1]); acc += s; head = P2[i]; }
  g.stroke(); g.restore(); return head;
}
export function fillPoly(g, pts, col, a = 1) { g.save(); g.globalAlpha *= a; g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.restore(); }
export function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// pop-in scale with overshoot (0..1 over ~0.35 s)
export const pop = (a) => a <= 0 ? 0 : a >= 0.5 ? 1 : 1 + 0.18 * Math.sin(a / 0.5 * Math.PI) * (1 - a / 0.5) - (1 - E.o(clamp(a / 0.16))) ;
export function label(g, txt, x, y, a, { size = 40, col = P.cream, font = FONT.cap, align = 'center', plate = true, ink = true, drift = 0.03, out = 1 } = {}) {
  if (a <= 0 || out <= 0) return; const s = pop(a) * (1 + drift * clamp(a / 2)) * lerp(0.86, 1, out);
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha *= clamp(a / 0.08) * out; g.font = `400 ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
  const w = g.measureText(txt).width, x0 = align === 'center' ? -w / 2 : align === 'left' ? 0 : -w;
  if (plate) { g.fillStyle = 'rgba(16,20,24,0.55)'; rr(g, x0 - size * 0.4, -size * 0.75, w + size * 0.8, size * 1.5, size * 0.3); g.fill(); }
  if (ink) { g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = P.ink; g.strokeText(txt, 0, size * 0.04); }
  g.fillStyle = col; g.fillText(txt, 0, size * 0.04); g.restore();
}
// typed label (mono) for callouts on diagrams
export function typed(g, txt, x, y, a, { size = 30, col = P.cream, align = 'left', speed = 0.035 } = {}) {
  if (a <= 0) return; const n = Math.min(txt.length, Math.floor(a / speed)); g.save(); g.font = `800 ${size}px ${FONT.mono}`; g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = size * 0.22; g.strokeStyle = P.ink; g.lineJoin = 'round'; g.strokeText(txt.slice(0, n), x, y); g.fillStyle = col; g.fillText(txt.slice(0, n), x, y);
  if (n < txt.length || (a % 0.8) < 0.4) { const w = g.measureText(txt.slice(0, n)).width; g.fillRect(x + (align === 'left' ? w : align === 'center' ? w / 2 : 0) + 4, y - size * 0.45, size * 0.12, size * 0.9); }
  g.restore();
}
export function arrow(g, x0, y0, x1, y1, prog, { col = P.acc, w = 8, head = 22, bend = 0 } = {}) {
  if (prog <= 0) return; const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend;
  const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([(1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1]); }
  const hd = path(g, pts, prog, { w, col }); if (!hd || prog < 0.98) return;
  const a = Math.atan2(y1 - my, x1 - mx); g.save(); g.fillStyle = col; g.beginPath(); g.moveTo(x1 + Math.cos(a) * 4, y1 + Math.sin(a) * 4);
  g.lineTo(x1 - Math.cos(a - 0.5) * head, y1 - Math.sin(a - 0.5) * head); g.lineTo(x1 - Math.cos(a + 0.5) * head, y1 - Math.sin(a + 0.5) * head); g.closePath(); g.fill(); g.restore();
}
export function chip(g, txt, x, y, a, { col = P.acc, fg = P.ink, size = 34, out = 1 } = {}) {
  if (a <= 0 || out <= 0) return; const s = pop(a) * lerp(0.85, 1, out); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha *= out;
  g.font = `400 ${size}px ${FONT.cap}`; const w = g.measureText(txt).width; g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -w / 2 - 22 + 6, -size * 0.8 + 8, w + 44, size * 1.6, size * 0.4); g.fill();
  g.fillStyle = col; rr(g, -w / 2 - 22, -size * 0.8, w + 44, size * 1.6, size * 0.4); g.fill(); g.lineWidth = 5; g.strokeStyle = P.ink; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, size * 0.06); g.restore();
}
function dot(g, x, y, r, col, glow = 0) { g.save(); if (glow) { g.shadowColor = col; g.shadowBlur = glow; } g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore(); }

// ---------------- maps (simplified outlines, lon/lat) ----------------
const GB = [[1.4,51.1],[0.9,50.9],[0.2,50.75],[-1.1,50.75],[-2.0,50.6],[-3.4,50.6],[-4.2,50.35],[-5.7,50.05],[-5.0,50.6],[-4.2,51.2],[-3.0,51.2],[-3.2,51.45],[-4.3,51.65],[-5.2,51.75],[-4.4,52.2],[-4.1,52.8],[-4.7,52.8],[-4.6,53.3],[-3.1,53.35],[-3.0,53.9],[-3.5,54.4],[-3.4,54.9],[-4.4,54.7],[-5.0,54.8],[-4.9,55.6],[-5.6,55.4],[-5.7,56.3],[-6.2,56.8],[-5.7,57.5],[-5.1,58.3],[-5.0,58.6],[-3.1,58.6],[-3.0,58.3],[-3.8,57.6],[-1.8,57.6],[-2.1,57.1],[-2.5,56.6],[-2.6,56.3],[-3.0,56.0],[-2.2,55.95],[-1.6,55.6],[-1.4,55.0],[-1.2,54.6],[-0.4,54.3],[0.1,53.6],[0.35,53.1],[1.7,52.7],[1.75,52.0],[0.9,51.6],[1.4,51.35]];
const IE = [[-6.0,52.2],[-6.3,53.3],[-6.2,54.0],[-5.6,54.6],[-6.1,55.2],[-7.4,55.3],[-8.4,55.1],[-8.6,54.3],[-10.0,54.2],[-9.8,53.4],[-10.3,52.2],[-9.6,51.6],[-8.0,51.7],[-6.4,52.2]];
const FR = [[1.6,50.95],[2.5,51.1],[4.0,50.0],[5.8,49.5],[8.2,49.0],[7.6,47.6],[6.8,46.3],[7.0,44.2],[7.5,43.8],[4.8,43.4],[3.1,42.5],[1.6,42.5],[-1.8,43.4],[-1.3,44.5],[-1.2,46.2],[-2.2,47.1],[-4.5,47.9],[-4.7,48.4],[-3.0,48.8],[-1.6,48.7],[-1.9,49.7],[-1.2,49.6],[0.1,49.5],[1.5,50.2]];
const proj = (cx, cy, lon0, lat0, sc) => ([lon, lat]) => [cx + (lon - lon0) * sc * Math.cos(lat0 * Math.PI / 180), cy - (lat - lat0) * sc];
function land(g, poly, pr, prog, { fill = '#2B3340', edge = P.cold, w = 5 } = {}) {
  const pts = poly.map(pr); if (prog >= 0.999) fillPoly(g, pts, fill, 1); else fillPoly(g, pts, fill, clamp((prog - 0.6) / 0.4));
  path(g, pts, prog, { w, col: edge, close: true });
}
export function mapBritain(g, t, a, { zoom = 0 } = {}) {
  bgGraphite(g, t, { grid: 0.6 });
  const sc = lerp(105, 170, E.io(clamp(zoom))), cx = lerp(980, 1080, zoom), cy = lerp(560, 720, zoom);
  const pr = proj(cx, cy, -3.2, 54.5, sc);
  // sea ripples
  g.save(); g.globalAlpha = 0.08; g.strokeStyle = P.cold; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const r = 240 + i * 70 + (t * 30) % 70; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); } g.restore();
  land(g, IE, pr, E.io(clamp(a / 1.2)), { fill: '#222a35', edge: 'rgba(127,179,217,0.5)', w: 3 });
  land(g, GB, pr, E.io(clamp(a / 1.4)));
  // the pin on Borrowdale
  const [bx, by] = pr([-3.17, 54.5]), pa = a - 1.3;
  if (pa > 0) { const drop = E.back(clamp(pa / 0.4)), py = by - 90 * (1 - drop);
    for (let k = 0; k < 3; k++) { const ra = ((pa * 0.9 + k / 3) % 1); g.save(); g.globalAlpha = (1 - ra) * 0.6 * clamp(pa / 0.4); g.strokeStyle = P.acc; g.lineWidth = 4; g.beginPath(); g.arc(bx, by, 10 + ra * 70, 0, TAU); g.stroke(); g.restore(); }
    g.save(); g.translate(bx, py); g.fillStyle = P.acc; g.shadowColor = P.acc; g.shadowBlur = 20; g.beginPath(); g.arc(0, -34, 20, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-14, -24); g.lineTo(0, 0); g.lineTo(14, -24); g.fill(); g.shadowBlur = 0; g.fillStyle = P.ink; g.beginPath(); g.arc(0, -34, 8, 0, TAU); g.fill(); g.restore();
    typed(g, 'BORROWDALE', bx + 44, by - 40, pa - 0.25, { size: 34 });
    chip(g, '1500s', bx + 150, by + 30, pa - 0.6, { size: 36 });
  }
  return pr;
}
export function blockade(g, t, a) {
  bgGraphite(g, t, { grid: 0.6 });
  const pr = proj(930, 520, -1.5, 50.0, 118);
  land(g, GB, pr, E.io(clamp(a / 0.8)));
  land(g, FR, pr, E.io(clamp((a - 0.2) / 0.9)), { fill: '#2a3140', edge: P.cedar });
  label(g, 'ENGLAND', ...pr([-1.6, 52.6]), a - 0.5, { size: 30, plate: false });
  label(g, 'FRANCE', ...pr([2.2, 47.2]), a - 0.7, { size: 30, plate: false });
  // graphite route from Borrowdale to France, then cut
  const p0 = pr([-3.17, 54.5]), p1 = pr([0.3, 50.6]), p2 = pr([2.0, 48.6]);
  dot(g, p0[0], p0[1], 10, P.acc, 18);
  const ra = clamp((a - 0.6) / 0.9), pts = [p0, [p0[0] + 120, p0[1] + 160], p1, p2];
  path(g, pts, ra, { w: 9, col: P.graphite, dash: [22, 14] });
  // moving graphite blocks along the route until the cut
  const cutAt = 1.6, cut = a - cutAt;
  if (ra > 0.3) for (let k = 0; k < 3; k++) { const u = ((a * 0.35 + k / 3) % 1) * (cut > 0 ? 0.55 : 1); const q = pointOn(pts, u); g.save(); g.translate(q[0], q[1]); g.rotate(0.3); g.fillStyle = '#2a2e36'; g.strokeStyle = P.cold; g.lineWidth = 2; g.fillRect(-14, -9, 28, 18); g.strokeRect(-14, -9, 28, 18); g.restore(); }
  if (cut > 0) { const c = pointOn(pts, 0.62), s = E.back(clamp(cut / 0.3)) * 46; g.save(); g.translate(c[0], c[1]); g.rotate(Math.PI / 4); g.strokeStyle = P.red; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.moveTo(0, -s); g.lineTo(0, s); g.stroke(); g.restore();
    chip(g, 'CUT OFF', c[0] + 140, c[1] - 70, cut - 0.15, { col: P.red, fg: P.cream, size: 32 }); }
}
function pointOn(pts, u) { const L = plen(pts); let s = clamp(u) * L; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (s <= d) { const k = s / d; return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; } s -= d; } return pts[pts.length - 1]; }

// ---------------- CH. 1: lead vs graphite, the same grey mark ----------------
export function leadVsGraphite(g, t, a) {
  bgPaper(g, t, { dx: t * 6 });
  const row = (y, kind, delay) => {
    const la = a - delay, prog = E.io(clamp((la - 0.3) / 1.4)), x0 = 520, x1 = 1480;
    // the mark
    g.save(); g.lineCap = 'round'; g.strokeStyle = kind === 'lead' ? 'rgba(98,106,120,0.85)' : 'rgba(58,62,72,0.92)'; g.lineWidth = 26; g.beginPath();
    for (let i = 0; i <= 80 * prog; i++) { const u = i / 80, x = lerp(x0, x1, u), yy = y + Math.sin(u * 9 + delay) * 16; i ? g.lineTo(x, yy) : g.moveTo(x, yy); } if (prog > 0) g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.25; for (let i = 0; i < 500; i++) g.fillRect(x0 + hash(i * 3.1 + delay) * (x1 - x0) * prog, y - 30 + hash(i * 7.3 + delay) * 60, 3, 3); g.restore();
    // the stick doing it
    const hx = lerp(x0, x1, prog), hy = y + Math.sin(prog * 9 + delay) * 16 - 4;
    if (la > 0) { g.save(); g.translate(hx, hy); g.rotate(-0.9); const cw = 46, ch = 200;
      if (kind === 'lead') { const gr = g.createLinearGradient(-cw / 2, 0, cw / 2, 0); gr.addColorStop(0, '#6f7886'); gr.addColorStop(0.5, '#B9C2CF'); gr.addColorStop(1, '#5d6673'); g.fillStyle = gr; rr(g, -cw / 2, -ch, cw, ch, 8); g.fill(); }
      else { g.fillStyle = '#23262c'; g.beginPath(); g.moveTo(-cw / 2, -ch); g.lineTo(cw / 2 + 6, -ch + 10); g.lineTo(cw / 2, -10); g.lineTo(4, 0); g.lineTo(-cw / 2 + 2, -16); g.closePath(); g.fill(); g.strokeStyle = 'rgba(160,170,185,0.6)'; g.lineWidth = 3; g.stroke(); }
      g.restore(); }
    label(g, kind === 'lead' ? 'LEAD (Pb)' : 'BLACK LEAD?', 330, y, la - 0.1, { size: 34, col: kind === 'lead' ? P.cream : P.acc });
  };
  row(380, 'lead', 0); row(640, 'graphite', 0.5);
  label(g, 'SAME GREY MARK', 960, 880, a - 2.2, { size: 46, col: P.acc });
}

// ---------------- CH. 1: graphite + clay -> kiln (Conté 1795) ----------------
export function recipeKiln(g, t, a, { name = 'N.-J. CONTÉ', year = '1795' } = {}) {
  bgGraphite(g, t);
  const pile = (x, col, lab, d) => { const pa = a - d, s = E.back(clamp(pa / 0.45)); if (pa <= 0) return; g.save(); g.translate(x, 600); g.scale(s, s);
    g.fillStyle = col; g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(-60, -170, 0, -175); g.quadraticCurveTo(60, -170, 150, 0); g.closePath(); g.fill();
    for (let i = 0; i < 40; i++) dot(g, (hash(i * 2.1 + d) - 0.5) * 220, -hash(i * 5.3 + d) * 140, 3 + 3 * hash(i), col === P.clay ? '#c4cad1' : '#5b6170'); g.restore();
    label(g, lab, x, 660, pa - 0.15, { size: 34 }); };
  pile(430, P.graphD, 'GRAPHITE', 0.0); pile(830, P.clay, 'CLAY', 0.35);
  label(g, '+', 630, 520, a - 0.3, { size: 80, plate: false, col: P.acc });
  arrow(g, 1000, 520, 1220, 520, clamp((a - 0.9) / 0.4), { col: P.acc, w: 10 });
  // kiln icon with flicker
  const ka = a - 1.2; if (ka > 0) { const s = E.back(clamp(ka / 0.45)); g.save(); g.translate(1460, 600); g.scale(s, s);
    g.fillStyle = '#3a3f48'; rr(g, -190, -300, 380, 300, 30); g.fill(); g.fillStyle = '#1a1d22'; g.beginPath(); g.moveTo(-110, 0); g.lineTo(-110, -150); g.arc(0, -150, 110, Math.PI, 0); g.lineTo(110, 0); g.closePath(); g.fill();
    for (let i = 0; i < 7; i++) { const fx = -80 + i * 27, fh = 70 + 40 * Math.abs(noise1(t * 4 + i * 1.7)); const gr = g.createLinearGradient(0, 0, 0, -fh); gr.addColorStop(0, '#FF7A2B'); gr.addColorStop(1, 'rgba(255,210,58,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(fx - 14, -4); g.quadraticCurveTo(fx, -fh * 1.2, fx + 14, -4); g.fill(); }
    g.restore(); label(g, 'BAKED', 1460, 660, ka - 0.4, { size: 34, col: P.acc }); }
  // a baked core slides out of the kiln and becomes the core of a pencil outline
  const oa = a - 3.0; if (oa > 0) { const u = E.io(clamp(oa / 1.2)), x0 = 1650, x1 = lerp(1650, 1840, u); g.save(); g.fillStyle = '#2a2e36'; g.fillRect(x0, 570, x1 - x0, 18);
    if (oa > 1.3) { const pu = E.o(clamp((oa - 1.3) / 0.6)); g.globalAlpha = pu; g.strokeStyle = P.acc; g.lineWidth = 6; rr(g, 1590, 548, 300, 62, 12); g.stroke(); } g.restore(); }
  chip(g, `${name} · ${year}`, 960, 230, a - 0.2, { size: 38 });
  if (a > 2.6) label(g, 'STILL HOW IT\'S DONE', 960, 860, a - 2.6, { size: 44, col: P.cream });
}

// ---------------- CH. 2: carbon sheet (2D), stacked sheets sliding, flakes in fibres ----------------
function hexSheet(g, ox, oy, s, cols, rows, a, { atom = P.cream, bond = P.cold, pulse = 0, t = 0, alpha = 1, skewY = 0, sy = 1 } = {}) {
  // pointy-top hex lattice: atoms at hex vertices
  const pts = [], bonds = []; const dx = s * Math.sqrt(3), dy = s * 1.5;
  const key = (x, y) => Math.round(x * 10) + ',' + Math.round(y * 10); const idx = new Map();
  const add = (x, y) => { const k = key(x, y); if (!idx.has(k)) { idx.set(k, pts.length); pts.push([x, y]); } return idx.get(k); };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const cx = c * dx + (r % 2) * dx / 2, cy = r * dy; const vs = [];
    for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3; vs.push(add(cx + s * Math.cos(an), cy + s * Math.sin(an))); }
    for (let k = 0; k < 6; k++) bonds.push([vs[k], vs[(k + 1) % 6]]); }
  const seen = new Set(), B = bonds.filter(([p, q]) => { const k = p < q ? p + '-' + q : q + '-' + p; if (seen.has(k)) return false; seen.add(k); return true; });
  const T = (p) => [ox + p[0] + p[1] * skewY, oy + p[1] * sy];
  g.save(); g.globalAlpha *= alpha; g.lineCap = 'round';
  B.forEach(([p, q], i) => { const d = hash(i * 1.7) * 0.6, u = clamp((a - d) / 0.5); if (u <= 0) return; const P0 = T(pts[p]), P1 = T(pts[q]);
    g.strokeStyle = bond; g.lineWidth = s * 0.16 * (1 + pulse * 0.5 * (0.5 + 0.5 * Math.sin(t * 6 + i))); g.globalAlpha = alpha * (0.6 + 0.4 * pulse);
    g.beginPath(); g.moveTo(P0[0], P0[1]); g.lineTo(lerp(P0[0], P1[0], u), lerp(P0[1], P1[1], u)); g.stroke(); });
  g.globalAlpha = alpha; pts.forEach((p, i) => { const u = clamp((a - hash(i * 3.1) * 0.6) / 0.3); if (u <= 0) return; const q = T(p); dot(g, q[0], q[1], s * 0.24 * E.back(u), atom); });
  g.restore(); return { pts: pts.map(T) };
}
export function carbonSheet(g, t, a) {
  bgGraphite(g, t);
  hexSheet(g, 420, 250, 62, 9, 6, a * 0.9, { t, pulse: clamp((a - 1.6) / 0.4) });
  // one atom highlighted with its three neighbours
  const ha = a - 1.8; if (ha > 0) { const s = 62, cx = 420 + 4 * s * Math.sqrt(3) + s * Math.sqrt(3) / 2 * 0, cy = 250 + 3 * s * 1.5;
    const c0 = [cx + s * Math.cos(Math.PI / 6), cy + s * Math.sin(Math.PI / 6)];
    dot(g, c0[0], c0[1], 22 + 3 * Math.sin(t * 8), P.acc, 30); }
  label(g, 'C', 1600, 300, a - 0.2, { size: 120, col: P.acc, font: FONT.title, plate: false });
  label(g, 'CARBON', 1600, 400, a - 0.4, { size: 40 });
  label(g, 'HEXAGONS', 1600, 470, a - 1.0, { size: 34, col: P.cold });
}
export function carbonBonds(g, t, a) {
  bgGraphite(g, t);
  const s = 120, cx = 960, cy = 540;
  hexSheet(g, cx - 3 * s * Math.sqrt(3), cy - 2.3 * s * 1.5, s, 6, 4, 2, { t, alpha: 0.35 });
  // centre atom + 3 bonds that tighten (spring)
  const c = [cx, cy], nb = [0, 1, 2].map(k => { const an = -Math.PI / 2 + k * TAU / 3; return [cx + Math.cos(an) * s, cy + Math.sin(an) * s]; });
  nb.forEach((p, k) => { const u = clamp((a - 0.2 - k * 0.25) / 0.4), pull = 1 - 0.08 * Math.sin(t * 9) * clamp(a - 1);
    const q = [lerp(c[0], p[0], u * pull), lerp(c[1], p[1], u * pull)];
    g.save(); g.strokeStyle = P.acc; g.lineWidth = 22; g.lineCap = 'round'; g.shadowColor = P.acc; g.shadowBlur = 18; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(q[0], q[1]); g.stroke(); g.restore();
    if (u > 0.9) dot(g, q[0], q[1], 30, P.cream); });
  dot(g, c[0], c[1], 36, P.acc, 30);
  label(g, '3 STRONG BONDS', 960, 900, a - 1.2, { size: 44, col: P.acc });
}
export function layersSlide(g, t, a, { slide = 0 } = {}) {
  bgGraphite(g, t);
  const n = 5, s = 34;
  for (let i = n - 1; i >= 0; i--) { const top = i === 0, sl = top ? slide * 520 : i === 1 ? slide * 140 : 0;
    const y = 300 + i * 110, x = 330 + sl;
    // plate under the sheet
    g.save(); g.globalAlpha = 0.5; g.fillStyle = top ? 'rgba(255,210,58,0.10)' : 'rgba(127,179,217,0.08)';
    g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 1150, y - 20); g.lineTo(x + 1150 + 150, y + 90); g.lineTo(x + 150, y + 90); g.closePath(); g.fill(); g.restore();
    hexSheet(g, x, y, s, 15, 3, a * 1.2 - i * 0.12, { atom: top ? P.acc : P.cream, bond: top ? P.acc : P.cold, alpha: 0.95, skewY: 1.3, sy: 0.45 });
    // weak forces between sheets: dashed wiggles
    if (i < n - 1 && a > 1) { g.save(); g.globalAlpha = 0.45 * clamp(a - 1); g.strokeStyle = P.cold; g.setLineDash([6, 10]); g.lineWidth = 2;
      for (let k = 0; k < 10; k++) { const xx = 430 + k * 110 + (i === 0 ? sl * 0.5 : 0); g.beginPath(); g.moveTo(xx, y + 70); g.lineTo(xx + 20 + 8 * Math.sin(t * 6 + k), y + 108); g.stroke(); } g.restore(); }
  }
  label(g, slide > 0.05 ? 'THEY SLIDE' : 'LOOSELY STACKED', 1500, 210, a - 0.6, { size: 42, col: slide > 0.05 ? P.acc : P.cream });
}
export function flakesOnFibres(g, t, a) {
  bgPaper(g, t, { dark: 0.08 });
  // macro fibres
  g.save(); for (let i = 0; i < 26; i++) { const y = 140 + hash(i * 2.2) * 800, x0 = -100, x1 = W + 100, w = 18 + hash(i * 3.3) * 22;
    g.strokeStyle = `rgba(${200 + hash(i) * 30},${185 + hash(i * 2) * 30},${150 + hash(i * 3) * 30},0.9)`; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
    g.moveTo(x0, y); g.bezierCurveTo(600, y + (hash(i * 5) - 0.5) * 260, 1300, y + (hash(i * 7) - 0.5) * 260, x1, y + (hash(i * 9) - 0.5) * 120); g.stroke(); } g.restore();
  // the tip passes and leaves flakes behind it
  const tipX = lerp(-200, 2100, clamp(a / 2.6));
  for (let i = 0; i < 160; i++) { const x = 100 + hash(i * 1.9) * 1720; if (x > tipX - 60) continue; const y = 480 + (hash(i * 4.4) - 0.5) * 300, r = 10 + 16 * hash(i * 6.1), ro = hash(i * 8.3) * 3;
    g.save(); g.translate(x, y); g.rotate(ro); g.fillStyle = `rgba(${40 + hash(i) * 30},${44 + hash(i) * 30},${54 + hash(i) * 30},0.95)`; g.beginPath();
    for (let k = 0; k < 6; k++) { const an = k * TAU / 6; g.lineTo(Math.cos(an) * r, Math.sin(an) * r * 0.6); } g.closePath(); g.fill(); g.strokeStyle = 'rgba(190,200,215,0.6)'; g.lineWidth = 2; g.stroke(); g.restore(); }
  g.save(); g.translate(tipX, 470); g.rotate(-0.7); g.fillStyle = '#2a2e36'; g.beginPath(); g.moveTo(0, 0); g.lineTo(120, -320); g.lineTo(-120, -320); g.closePath(); g.fill(); g.restore();
}
export function diamondVsGraphite(g, t, a) {
  bgGraphite(g, t, { tone: 1 });
  // diamond: 3D-ish tetrahedral lattice in perspective (cream), graphite: stacked sheets (grey)
  const da = a - 0.2; if (da > 0) { g.save(); g.translate(560, 560); g.rotate(t * 0.15); const s = E.back(clamp(da / 0.5));
    g.scale(s, s); for (let i = 0; i < 26; i++) { const p = [(hash(i * 2.3) - 0.5) * 340, (hash(i * 4.1) - 0.5) * 340]; dot(g, p[0], p[1], 14, P.cream);
      for (let j = 0; j < i; j++) { const q = [(hash(j * 2.3) - 0.5) * 340, (hash(j * 4.1) - 0.5) * 340]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 110) { g.strokeStyle = 'rgba(243,233,210,0.6)'; g.lineWidth = 6; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); } } }
    g.restore(); }
  const ga = a - 0.5; if (ga > 0) for (let i = 0; i < 4; i++) hexSheet(g, 1180 + 30 * Math.sin(t + i), 380 + i * 70, 26, 8, 2, ga * 1.5 - i * 0.1, { atom: '#8b93a0', bond: '#5d6573', skewY: 1.3, sy: 0.45 });
}
export function crumble(g, t, a) {
  bgGraphite(g, t);
  // a pure graphite stick tries to write, crumbles into flakes
  const ca = a - 0.6;
  g.save(); g.translate(960, 520); g.rotate(-0.25);
  for (let i = 0; i < 14; i++) { const bx = -260 + i * 40, f = ca > 0 && i > 8 ? ca - (13 - i) * 0.05 : -1;
    const dy = f > 0 ? 0.5 * 1800 * f * f : 0, rot = f > 0 ? f * (2 + i * 0.3) : 0; if (dy > 900) continue;
    g.save(); g.translate(bx + (f > 0 ? f * 90 : 0), dy); g.rotate(rot); g.fillStyle = '#2a2e36'; g.fillRect(-20, -40, 40, 80); g.strokeStyle = 'rgba(160,170,185,0.5)'; g.lineWidth = 2; g.strokeRect(-20, -40, 40, 80); g.restore(); }
  g.restore();
  label(g, 'TOO SOFT', 960, 260, a - 0.9, { size: 54, col: P.acc });
  if (a > 1.8) { chip(g, '+ CLAY', 960, 840, a - 1.8, { col: P.clay, fg: P.ink, size: 44 }); }
}

// ---------------- CH. 3 diagrams ----------------
const STEPS = ['GRIND', 'MIX', 'PRESS', 'CUT', 'DRY', 'BAKE', 'WAX'];
export function processStrip(g, t, a, { cursor = 1 } = {}) {
  bgGraphite(g, t);
  const x0 = 180, x1 = 1740, y = 540, n = STEPS.length;
  path(g, [[x0, y], [x1, y]], E.io(clamp(a / 0.8)), { w: 10, col: '#39424e' });
  STEPS.forEach((s, i) => { const x = lerp(x0, x1, i / (n - 1)), pa = a - 0.2 - i * 0.12;
    if (pa <= 0) return; const on = clamp((a * cursor - 0.9 - i * 0.28) / 0.2);
    g.save(); g.translate(x, y); const sc = pop(pa); g.scale(sc, sc); g.fillStyle = on > 0.5 ? P.acc : '#2B3340'; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = on > 0.5 ? P.ink : P.cold; g.stroke();
    g.fillStyle = on > 0.5 ? P.ink : P.cream; g.font = `400 34px ${FONT.title}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 0, 2); g.restore();
    label(g, s, x, y + 110, pa - 0.05, { size: 30, col: on > 0.5 ? P.acc : P.cream, plate: false });
  });
  const cu = clamp((a * cursor - 0.9) / (0.28 * (n - 1) + 0.2)), cx = lerp(x0, x1, cu);
  if (a > 0.9) { g.save(); g.translate(cx, y - 100 + 8 * Math.sin(t * 6)); g.fillStyle = P.acc; g.beginPath(); g.moveTo(-20, -30); g.lineTo(20, -30); g.lineTo(0, 0); g.closePath(); g.fill(); g.restore(); }
}
export function stringsDry(g, t, a) {
  bgGraphite(g, t);
  // long strings get cut to length by a blade, then laid on a rack with drying waves
  const cut = clamp((a - 0.5) / 0.9);
  for (let i = 0; i < 7; i++) { const y = 300 + i * 70; g.save(); g.strokeStyle = '#3a3f48'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(200, y); g.lineTo(1720, y); g.stroke();
    g.strokeStyle = 'rgba(160,170,185,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(200, y - 6); g.lineTo(1720, y - 6); g.stroke(); g.restore(); }
  for (let k = 1; k < 6; k++) { const x = 200 + k * 253, u = clamp(cut * 5 - (k - 1)); if (u <= 0) continue;
    g.save(); g.fillStyle = P.bg; g.fillRect(x - 5, 270, 10, 480 * u); g.strokeStyle = P.acc; g.lineWidth = 6; g.beginPath(); g.moveTo(x, 260); g.lineTo(x, 260 + 500 * u); g.stroke(); g.restore(); }
  if (a > 1.6) { const wa = a - 1.6; for (let i = 0; i < 12; i++) { const x = 260 + i * 130, ph = (wa * 0.8 + hash(i)) % 1; g.save(); g.globalAlpha = (1 - ph) * 0.7; g.strokeStyle = P.cold; g.lineWidth = 4; g.beginPath();
      for (let k = 0; k <= 20; k++) { const yy = 260 - ph * 160 - k * 6; g.lineTo(x + Math.sin(k * 0.8 + t * 4) * 10, yy); } g.stroke(); g.restore(); }
    label(g, 'DRY', 960, 860, wa, { size: 50, col: P.cold }); }
  label(g, 'CUT TO LENGTH', 960, 180, a - 0.5, { size: 40 });
}
export function waxPores(g, t, a) {
  bgGraphite(g, t);
  // magnified core section: grey grains with gaps, hot wax flows into the gaps
  const cx = 960, cy = 520, R = 330, fill = clamp((a - 0.8) / 1.6);
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
  g.fillStyle = '#0d0f13'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  // wax rising from the bottom
  const wy = cy + R - fill * 2 * R; const wg = g.createLinearGradient(0, wy - 30, 0, wy + 60); wg.addColorStop(0, 'rgba(246,231,184,0)'); wg.addColorStop(0.4, 'rgba(246,231,184,0.9)'); wg.addColorStop(1, 'rgba(230,200,130,0.95)');
  g.fillStyle = wg; g.beginPath(); g.moveTo(cx - R, cy + R); for (let x = -R; x <= R; x += 20) g.lineTo(cx + x, wy + 10 * Math.sin(x * 0.04 + t * 5)); g.lineTo(cx + R, cy + R); g.closePath(); g.fill();
  for (let i = 0; i < 150; i++) { const x = cx + (hash(i * 2.1) - 0.5) * 2 * R, y = cy + (hash(i * 3.7) - 0.5) * 2 * R, r = 18 + 22 * hash(i * 5.3);
    g.fillStyle = i % 3 ? '#3b4049' : '#7d848e'; g.beginPath(); for (let k = 0; k < 7; k++) { const an = k / 7 * TAU, rr2 = r * (0.75 + 0.35 * hash(i * 11 + k)); g.lineTo(x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); } g.closePath(); g.fill(); }
  g.restore();
  g.save(); g.strokeStyle = P.cold; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.restore();
  label(g, 'HOT WAX', 1530, 720, a - 0.9, { size: 42, col: P.wax });
  arrow(g, 1440, 720, 1210, 700, clamp((a - 1.1) / 0.4), { col: P.wax, w: 8 });
  label(g, 'PORES', 400, 300, a - 0.3, { size: 38 });
  label(g, 'GLIDES', 960, 950 - 30, a - 2.6, { size: 46, col: P.acc });
}
export const GRADES = ['9H', '8H', '7H', '6H', '5H', '4H', '3H', '2H', 'H', 'F', 'HB', 'B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B'];
export function hbScale(g, t, a, { focusHB = 0 } = {}) {
  bgGraphite(g, t);
  const x0 = 170, x1 = 1750, y = 470, n = GRADES.length, dx = (x1 - x0) / (n - 1);
  GRADES.forEach((gr, i) => { const pa = a - 0.15 - i * 0.05; if (pa <= 0) return; const x = x0 + i * dx, k = i / (n - 1);
    const col = `rgb(${Math.round(lerp(196, 26, k))},${Math.round(lerp(200, 28, k))},${Math.round(lerp(206, 34, k))})`;
    const h = lerp(40, 200, k), sc = pop(pa); g.save(); g.translate(x, y + 150); g.scale(1, sc); g.fillStyle = col; rr(g, -dx * 0.36, -h, dx * 0.72, h, 8); g.fill(); g.restore();
    const isHB = gr === 'HB', big = isHB ? 1 + 0.4 * focusHB : 1;
    label(g, gr, x, y - 40 - (isHB ? 40 * focusHB : 0), pa, { size: 30 * big, col: isHB && focusHB > 0 ? P.acc : P.cream, plate: false, drift: 0 }); });
  label(g, 'HARDER · LIGHTER', 420, 760, a - 1.4, { size: 34, col: '#C4C8CE' });
  label(g, 'SOFTER · DARKER', 1500, 760, a - 1.8, { size: 34, col: P.acc });
  arrow(g, 760, 820, 300, 820, clamp((a - 1.5) / 0.4), { col: '#C4C8CE', w: 6, head: 18 }); arrow(g, 1160, 820, 1620, 820, clamp((a - 1.9) / 0.4), { col: P.acc, w: 6, head: 18 });
  if (focusHB > 0) { const x = x0 + 10 * dx; chip(g, '#2 = HB', x, 250, focusHB * 2, { size: 44 }); g.save(); g.globalAlpha = 0.6 * focusHB; g.strokeStyle = P.acc; g.lineWidth = 6; g.setLineDash([10, 10]); g.beginPath(); g.moveTo(x, 300); g.lineTo(x, 640); g.stroke(); g.restore(); }
}

// ---------------- CH. 4 diagrams ----------------
export function slatRuler(g, t, a) {
  bgGraphite(g, t);
  // log -> blocks -> slat, then a ruler slides under the slat
  const la = clamp(a / 0.8); const slatY = 520, sx0 = 330, L = 1260, th = 42;
  g.save(); g.globalAlpha = 1 - clamp((a - 0.8) / 0.3);
  g.fillStyle = '#6b4a33'; rr(g, 330, 360, 1260, 320, 140); g.fill(); g.fillStyle = P.cedar; g.beginPath(); g.ellipse(330 + 1260, 520, 70, 160, 0, 0, TAU); g.fill(); g.restore();
  if (a > 0.6) { const ga = clamp((a - 0.6) / 0.6);
    // the slat with grain
    g.save(); g.translate(0, (1 - E.o(ga)) * 40); g.globalAlpha = ga; const gr = g.createLinearGradient(0, slatY, 0, slatY + th); gr.addColorStop(0, '#E9A866'); gr.addColorStop(1, '#B9733C'); g.fillStyle = gr; rr(g, sx0, slatY, L, th, 6); g.fill();
    g.strokeStyle = 'rgba(120,64,30,0.45)'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(sx0, slatY + 4 + k * 4.2); for (let x = 0; x <= L; x += 40) g.lineTo(sx0 + x, slatY + 4 + k * 4.2 + 2 * Math.sin(x * 0.01 + k)); g.stroke(); } g.restore(); }
  // dimension lines
  const d1 = clamp((a - 1.4) / 0.6);
  if (d1 > 0) { path(g, [[sx0, slatY - 70], [sx0 + L * d1, slatY - 70]], 1, { w: 5, col: P.acc }); [sx0, sx0 + L * d1].forEach(x => path(g, [[x, slatY - 92], [x, slatY - 48]], 1, { w: 5, col: P.acc })); }
  const d2 = clamp((a - 2.6) / 0.5);
  if (d2 > 0) { const x = sx0 + L + 70; path(g, [[x, slatY], [x, slatY + th * d2]], 1, { w: 5, col: P.cold }); [slatY, slatY + th * d2].forEach(y => path(g, [[x - 18, y], [x + 18, y]], 1, { w: 5, col: P.cold })); }
  // ruler
  const ra = clamp((a - 1.2) / 0.5); if (ra > 0) { g.save(); g.translate(0, (1 - E.o(ra)) * 120); g.globalAlpha = ra; g.fillStyle = '#d8dde3'; g.fillRect(sx0 - 20, 640, L + 40, 80); g.fillStyle = P.ink;
    for (let mm = 0; mm <= 180; mm += 2) { const x = sx0 + mm / 180 * L, h = mm % 10 === 0 ? 34 : 16; g.fillRect(x - 1.5, 640, 3, h); if (mm % 20 === 0) { g.font = `700 22px ${FONT.mono}`; g.textAlign = 'center'; g.fillText(String(mm / 10), x, 700); } } g.restore(); }
}
export function grooveHalf(g, t, a) {
  bgGraphite(g, t);
  // end view of one grooved slat: groove depth = half of the core
  const cx = 960, y0 = 600, sw = 900, th = 140, r = 70;
  const sl = (yy, flip, al) => { g.save(); g.globalAlpha = al; g.fillStyle = P.cedar; g.beginPath(); g.moveTo(cx - sw / 2, yy); g.lineTo(cx - sw / 2, yy + th * flip); g.lineTo(cx + sw / 2, yy + th * flip); g.lineTo(cx + sw / 2, yy);
    g.lineTo(cx + r, yy); g.arc(cx, yy, r, 0, Math.PI, flip < 0); g.lineTo(cx - sw / 2, yy); g.closePath(); g.fill(); g.restore(); };
  sl(y0, 1, clamp(a / 0.4));
  // the core drops in, half sticks out
  const ca = clamp((a - 0.6) / 0.5), cy = lerp(y0 - 300, y0, E.back(ca)); if (ca > 0) dot(g, cx, cy, r, '#2a2e36');
  if (a > 1.2) { const da = clamp((a - 1.2) / 0.5); path(g, [[cx + r + 70, y0], [cx + r + 70, y0 + r * da]], 1, { w: 6, col: P.acc }); path(g, [[cx + r + 70, y0], [cx + r + 70, y0 - r * da]], 1, { w: 6, col: P.cold });
    label(g, 'HALF', cx + r + 190, y0 + 40, da, { size: 36, col: P.acc, plate: false }); label(g, 'HALF', cx + r + 190, y0 - 40, da - 0.2, { size: 36, col: P.cold, plate: false }); }
  if (a > 1.9) sl(y0, -1, clamp((a - 1.9) / 0.4) * 0.5);
}

// ---------------- CH. 5 diagrams ----------------
export function cutaway2(g, t, a, { open = 0 } = {}) {
  bgGraphite(g, t);
  // end view of a finished pencil: the two halves part along the glue line (behind the ONE PIECE -> TWO HALVES strike)
  const cx = 1380, cy = 560, R = 230, gap = open * 60;
  const hh = R * Math.sin(Math.PI / 3);
  for (const s of [-1, 1]) { g.save(); g.translate(0, s * gap); g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx - R / 2, cy + s * hh); g.lineTo(cx + R / 2, cy + s * hh); g.lineTo(cx + R, cy); g.closePath();
    g.fillStyle = P.cedar; g.fill(); g.lineWidth = 16; g.lineJoin = 'round'; g.strokeStyle = P.acc; g.stroke();
    g.fillStyle = '#2a2e36'; g.beginPath(); g.arc(cx, cy, 62, s < 0 ? Math.PI : 0, s < 0 ? Math.PI * 2 : Math.PI); g.closePath(); g.fill(); g.restore(); }
  g.save(); g.globalAlpha = 0.9 * clamp(a / 0.4); g.strokeStyle = P.wax; g.lineWidth = 6; g.setLineDash([16, 10]); g.beginPath(); g.moveTo(cx - R - 60, cy); g.lineTo(cx + R + 60, cy); g.stroke(); g.restore();
}
export function glueRuns(g, t, a) {
  bgGraphite(g, t);
  // side view of a pencil body, the glue line lights up from tip to end
  const x0 = 220, x1 = 1700, y = 540, h = 150;
  g.fillStyle = P.cedar; rr(g, x0, y - h / 2, x1 - x0, h, 20); g.fill(); g.fillStyle = '#2a2e36'; g.fillRect(x0, y - 16, x1 - x0, 32);
  g.fillStyle = 'rgba(255,210,58,0.85)'; g.fillRect(x0, y - h / 2, x1 - x0, 14); g.fillRect(x0, y + h / 2 - 14, x1 - x0, 14);
  const u = E.io(clamp((a - 0.3) / 1.6));
  path(g, [[x0, y], [lerp(x0, x1, u), y]], 1, { w: 8, col: P.wax, glow: 24 });
  if (u > 0 && u < 1) dot(g, lerp(x0, x1, u), y, 14, '#fff', 30);
  label(g, 'GLUE LINE', 960, 330, a - 0.4, { size: 44, col: P.wax });
  label(g, 'FULL LENGTH', 960, 770, a - 1.9, { size: 40, col: P.acc });
}
export function hexCut(g, t, a) {
  bgGraphite(g, t);
  // sandwich end view: square block with 8 cores, cutter outlines become hexagons
  const n = 8, cx = 960, cy = 520, pitch = 190, w = pitch * n, h = 220, R = 92, x0 = cx - w / 2;
  const cut = E.io(clamp((a - 0.4) / 1.4));
  g.save(); g.globalAlpha = 1 - cut * 0.85; g.fillStyle = P.cedarD; g.fillRect(x0, cy - h / 2, w, h); g.restore();
  for (let i = 0; i < n; i++) { const x = x0 + pitch / 2 + i * pitch, rr2 = lerp(R * 1.25, R, cut);
    g.save(); g.translate(x, cy); g.beginPath(); for (let k = 0; k < 6; k++) { const an = Math.PI / 2 + k * TAU / 6; g.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); } g.closePath();
    g.fillStyle = cut > 0.5 ? P.cedar : 'rgba(227,154,82,0)'; g.globalAlpha = clamp(cut * 2); g.fill(); g.globalAlpha = 1; path(g, [], 0); g.lineWidth = 5; g.strokeStyle = P.acc; g.setLineDash(cut < 1 ? [12, 8] : []); g.stroke(); g.restore();
    dot(g, x, cy, 30, '#2a2e36'); }
}
export function coats(g, t, a) {
  bgGraphite(g, t);
  const cx = 960, cy = 540, R = 200, n = 6, k = clamp(a / 2.2) * n;
  for (let i = Math.ceil(k); i >= 1; i--) { const rr2 = R + i * 14, al = clamp(k - i + 1); g.save(); g.globalAlpha = al; g.beginPath(); for (let j = 0; j < 6; j++) { const an = Math.PI / 2 + j * TAU / 6; g.lineTo(cx + Math.cos(an) * rr2, cy + Math.sin(an) * rr2); } g.closePath();
    g.fillStyle = i === Math.ceil(k) ? P.acc : `hsl(46, 95%, ${48 + i * 2}%)`; g.fill(); g.restore(); }
  g.beginPath(); for (let j = 0; j < 6; j++) { const an = Math.PI / 2 + j * TAU / 6; g.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R); } g.closePath(); g.fillStyle = P.cedar; g.fill();
  dot(g, cx, cy, 52, '#2a2e36');
  // gloss sweep
  g.save(); g.globalAlpha = 0.25; g.fillStyle = '#fff'; const gx = cx - 400 + ((t * 300) % 800); g.beginPath(); g.moveTo(gx, cy - 320); g.lineTo(gx + 60, cy - 320); g.lineTo(gx - 40, cy + 320); g.lineTo(gx - 100, cy + 320); g.closePath(); g.fill(); g.restore();
  label(g, 'COAT ' + Math.max(1, Math.ceil(k)), 1460, 540, a - 0.2, { size: 46, col: P.acc, drift: 0 });
}
export function fullSection(g, t, a) {
  bgGraphite(g, t);
  // long section of a finished pencil, parts light up in sequence
  const y = 520, x0 = 170, xt = 330, xb = 1440, xf = 1560, xe = 1700, h = 170;
  const tip = () => { g.beginPath(); g.moveTo(x0, y); g.lineTo(xt, y - h / 2); g.lineTo(xt, y + h / 2); g.closePath(); };
  g.fillStyle = P.cedar; tip(); g.fill(); g.fillRect(xt, y - h / 2, xb - xt, h);
  g.fillStyle = P.acc; g.fillRect(xt, y - h / 2, xb - xt, 16); g.fillRect(xt, y + h / 2 - 16, xb - xt, 16);
  g.fillStyle = '#2a2e36'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 70, y - 22); g.lineTo(xb, y - 22); g.lineTo(xb, y + 22); g.lineTo(x0 + 70, y + 22); g.closePath(); g.fill();
  const fg = g.createLinearGradient(0, y - h / 2, 0, y + h / 2); fg.addColorStop(0, '#9aa3ad'); fg.addColorStop(0.5, '#e6eaef'); fg.addColorStop(1, '#8a939d'); g.fillStyle = fg; g.fillRect(xb, y - h / 2 - 6, xf - xb, h + 12);
  g.fillStyle = '#F29AA8'; rr(g, xf, y - h / 2 + 4, xe - xf, h - 8, 26); g.fill();
  const parts = [['CEDAR HALVES', 700, y - 170, 0.3], ['BAKED CORE', 900, y + 170, 0.9], ['GLUE LINE', 1150, y - 170, 1.5], ['PAINT', 520, y + 170, 2.2], ['METAL', xb + 60, y - 170, 2.9], ['RUBBER', xe - 20, y + 170, 3.4]];
  parts.forEach(([s, x, yy, d]) => { const pa = a - d; if (pa <= 0) return; label(g, s, x, yy, pa, { size: 32, col: s === 'GLUE LINE' ? P.wax : P.cream }); path(g, [[x, yy + (yy < y ? 40 : -40)], [x, yy < y ? y - h / 2 + 10 : y + h / 2 - 10]], clamp(pa / 0.3), { w: 4, col: P.acc }); });
  if (a > 1.5) path(g, [[xt, y], [xb, y]], clamp((a - 1.5) / 0.6), { w: 5, col: P.wax, glow: 18, dash: [14, 8] });
}

// ---------------- archival still: full-bleed push or a card on paper, with annotations and a credit line ----------------
const IMG = {};
export async function loadImages(map) { await Promise.all(Object.entries(map).map(([k, url]) => new Promise((res) => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => { console.log('img fail', url); res(); }; im.src = url; }))); return IMG; }
export function archival(g, t, a, D, { img, mode = 'full', from = [0.5, 0.5, 1.0], to = [0.5, 0.5, 1.12], credit = '', notes = [], tint = 0.12, cardH = 640, cardX = 700, nobg = false, cardY = 0 }) {
  const im = IMG[img]; if (!im) { bgGraphite(g, t); return; }
  const u = clamp(a / D), k = E.io(u), fx = lerp(from[0], to[0], k), fy = lerp(from[1], to[1], k), z = lerp(from[2], to[2], k);
  if (mode === 'full') {
    const s = Math.max(W / im.width, H / im.height) * z, dw = im.width * s, dh = im.height * s;
    const cfx = clamp(fx, (W / 2) / dw, 1 - (W / 2) / dw), cfy = clamp(fy, (H / 2) / dh, 1 - (H / 2) / dh);
    g.drawImage(im, W / 2 - cfx * dw, H / 2 - cfy * dh, dw, dh);
    g.fillStyle = `rgba(20,24,31,${tint})`; g.fillRect(0, 0, W, H);
  } else {
    if (!nobg) bgPaper(g, t, { dark: 0.55, dx: t * 10 });
    const s = cardH / im.height * z, dw = im.width * s, dh = im.height * s, x = cardX - dw / 2 + (fx - 0.5) * 80, y = H / 2 - dh / 2 - 30 + (fy - 0.5) * 60 + cardY;
    g.save(); g.translate(x + dw / 2, y + dh / 2); g.rotate(-0.012 + 0.006 * Math.sin(t * 0.7)); g.translate(-(x + dw / 2), -(y + dh / 2));
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x - 18 + 14, y - 18 + 18, dw + 36, dh + 36); g.fillStyle = '#F7F1E4'; g.fillRect(x - 18, y - 18, dw + 36, dh + 36);
    g.imageSmoothingQuality = 'high'; g.drawImage(im, x, y, dw, dh); g.restore();
    notes.forEach(n => n.card = { x, y, dw, dh });
  }
  // annotation arrows + labels: positions in image fractions (card) or screen px (full)
  notes.forEach((n) => { const na = a - (n.at || 0.6); if (na <= 0) return;
    const P0 = n.card ? [n.card.x + n.px * n.card.dw, n.card.y + n.py * n.card.dh] : [n.x, n.y];
    const L0 = [n.lx, n.ly]; arrow(g, L0[0], L0[1] + (n.ly < P0[1] ? 30 : -30), P0[0], P0[1], clamp(na / 0.45), { col: n.col || P.acc, w: 7, head: 20, bend: n.bend ?? 0.15 });
    if (n.circle) { g.save(); g.strokeStyle = n.col || P.acc; g.lineWidth = 6; g.beginPath(); g.ellipse(P0[0], P0[1], n.circle, n.circle * 0.7, -0.2, 0, TAU * clamp((na - 0.3) / 0.4)); g.stroke(); g.restore(); }
    if (n.text) label(g, n.text, L0[0], L0[1], na - 0.1, { size: n.size || 38, col: n.col || P.acc });
    if (n.cuts) for (let i = 0; i < n.cuts; i++) { const cu = clamp((na - 0.3 - i * 0.15) / 0.3); if (cu <= 0) continue; const cxp = n.card.x + n.card.dw * (0.25 + i * 0.5 / Math.max(1, n.cuts - 1));
      path(g, [[cxp, n.card.y - 10], [cxp, n.card.y + n.card.dh + 10]], cu, { w: 5, col: P.acc, dash: [14, 10] }); }
  });
  if (credit) { g.save(); g.font = `400 17px ${FONT.mono}`; g.textBaseline = 'alphabetic'; const w = g.measureText(credit).width; g.fillStyle = 'rgba(14,17,23,0.55)'; g.fillRect(84, 930, w + 24, 30); g.fillStyle = 'rgba(243,233,210,0.85)'; g.fillText(credit, 96, 951); g.restore(); }
}
