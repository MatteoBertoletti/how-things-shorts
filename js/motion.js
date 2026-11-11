// v3 motion grammar (EP 03+): "RAW TO REAL" opening title, kinetic captions by word type, odometer numbers,
// strike-through, 3D callouts, step sticker + progress dock, ink swipe, number -> label morph, temporal motion blur.
// Every helper is a pure function of time (particles are hashed), so frames can be rendered in any order.
import { W, H, clamp, lerp, E, hash } from './core.js';
import { C, SAFE } from './overlay.js';

const F = { mono: '"JBMono"', title: '"Anton"', cap: '"Archivo Black"' };
export const MO = { par: { x: 0, y: 0 }, cyan: '#8FD3F4', deep: '#9A6A00', hi: '#FFF0A8' };
export function setParallax(x, y) { MO.par.x = x; MO.par.y = y; }

// ---------- easing: springs with their own stiffness per property ----------
// step response of an under-damped spring. a = seconds since start, f = Hz, d = decay 1/s. Exactly 1 once settled.
export function spring(a, f = 3.6, d = 14) {
  if (a <= 0) return 0;
  const e = Math.exp(-d * a); if (e < 0.002) return 1;
  const w = 2 * Math.PI * f; return 1 - e * (Math.cos(w * a) + (d / w) * Math.sin(w * a));
}
const SP = { pos: [3.0, 13], scl: [4.2, 15], rot: [2.4, 9], bounce: [3.2, 6.5] };
const sp = (a, k) => spring(a, SP[k][0], SP[k][1]);
// decaying wobble that starts at 1 (for punches, shakes)
const ring = (a, f, d) => (a < 0 ? 0 : Math.exp(-d * a) * Math.cos(2 * Math.PI * f * a));
const shake2 = (a, amp = 12) => { if (a < 0 || a >= 2 / 30) return [0, 0]; return a < 1 / 30 ? [amp, -amp * 0.5] : [-amp * 0.8, amp * 0.6]; };
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mixCol(a, b, u) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(u)))).join(',')})`; }
function rr(g, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fit(g, txt, size, font, maxW, min = 40) { let fs = size; g.font = `400 ${fs}px ${font}`; while (g.measureText(txt).width > maxW && fs > min) { fs -= 2; g.font = `400 ${fs}px ${font}`; } return fs; }
function glyphs(g, txt) { const out = []; for (let i = 0; i < txt.length; i++) { const x0 = g.measureText(txt.slice(0, i)).width, x1 = g.measureText(txt.slice(0, i + 1)).width; out.push({ ch: txt[i], x: x0, w: x1 - x0 }); } return out; }
function inkText(g, txt, x, y, fill, fs, ow = 0.2, glow = 0) {
  g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = fs * ow; g.strokeStyle = C.ink; g.strokeText(txt, x, y);
  if (glow > 0) { g.save(); g.shadowColor = fill; g.shadowBlur = glow; g.fillStyle = fill; g.fillText(txt, x, y); g.restore(); }
  g.fillStyle = fill; g.fillText(txt, x, y);
}
// soft shadow plate behind a text block; it slides opposite to the camera (parallax)
export function softPlate(g, cx, cy, w, h, alpha = 0.34) {
  if (alpha <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.shadowColor = `rgba(4,6,10,${alpha})`; g.shadowBlur = 70; g.shadowOffsetX = 4000 - MO.par.x * 14; g.shadowOffsetY = 12 - MO.par.y * 14;
  g.fillStyle = '#000'; rr(g, cx - w / 2 - 4000, cy - h / 2, w, h, h / 2); g.fill(); g.restore();
}
// particles only on hits. kind: spark | graphite | wood. Deterministic.
export function specks(g, t, { at, x, y, n = 14, kind = 'graphite', dir = -Math.PI / 2, spread = Math.PI, speed = 520, seed = 1, life = 0.45, grav = 1500 }) {
  const a = t - at; if (a < 0 || a > life + 0.1) return;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed * 31.7 + i * 7.13), h2 = hash(seed * 11.3 + i * 3.71), h3 = hash(seed * 5.9 + i * 1.37);
    const L = life * (0.55 + 0.45 * h3); if (a > L) continue;
    const an = dir + (h1 - 0.5) * spread, v = speed * (0.35 + 0.65 * h2);
    const px = x + Math.cos(an) * v * a, py = y + Math.sin(an) * v * a + 0.5 * grav * a * a;
    const vx = Math.cos(an) * v, vy = Math.sin(an) * v + grav * a, sl = Math.hypot(vx, vy) || 1;
    const k = 1 - a / L, sz = (kind === 'wood' ? 7 : 4.5) * (0.5 + h3);
    g.globalAlpha = clamp(k * 1.6);
    if (kind === 'wood') { g.fillStyle = h1 > 0.5 ? '#E3B77A' : '#C48A4A'; g.save(); g.translate(px, py); g.rotate(a * 14 * (h2 - 0.5) + h1 * 6); g.fillRect(-sz, -sz * 0.35, sz * 2, sz * 0.7); g.restore(); continue; }
    g.strokeStyle = kind === 'spark' ? (h1 > 0.4 ? MO.hi : '#FFFFFF') : (h1 > 0.5 ? '#9BA3B1' : '#5B6270');
    if (kind === 'spark') { g.shadowColor = C.accent; g.shadowBlur = 12; }
    g.lineWidth = sz; const tl = Math.min(26, sl * 0.022);
    g.beginPath(); g.moveTo(px, py); g.lineTo(px - (vx / sl) * tl, py - (vy / sl) * tl); g.stroke();
  }
  g.restore();
}
// tiny pencil used as the "hand" that draws scribbles. (x, y) = the graphite point.
function miniPencil(g, x, y, ang, s = 1, alpha = 1) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(ang); g.scale(s, s); g.lineJoin = 'round';
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(16, -4, 96, 22);
  g.fillStyle = C.accent; g.strokeStyle = C.ink; g.lineWidth = 4; g.beginPath(); g.rect(26, -11, 76, 22); g.fill(); g.stroke();
  g.fillStyle = '#F2A900'; g.fillRect(26, 2, 76, 7);
  g.fillStyle = '#E8C89A'; g.beginPath(); g.moveTo(26, -11); g.lineTo(0, 0); g.lineTo(26, 11); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2B2F36'; g.beginPath(); g.moveTo(9, -4); g.lineTo(0, 0); g.lineTo(9, 4); g.closePath(); g.fill();
  g.fillStyle = '#C9CED6'; g.beginPath(); g.rect(102, -11, 12, 22); g.fill(); g.stroke();
  g.fillStyle = '#F29AA8'; g.beginPath(); g.rect(114, -10, 14, 20); g.fill(); g.stroke();
  g.restore();
}
// hand-drawn stroke from (x0, y0) to (x1, y1), drawn up to progress p; returns the head point
function scribble(g, x0, y0, x1, y1, p, { color, lw = 9, wav = 5, passes = 1, seed = 3, outline = true }) {
  const N = 26 * passes, pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, pass = Math.min(passes - 1, Math.floor(u * passes)), v = u * passes - pass, vv = pass % 2 ? 1 - v : v;
    const x = lerp(x0, x1, vv), y = lerp(y0, y1, vv) + Math.sin(vv * 9 + pass * 2 + seed) * wav + (pass - (passes - 1) / 2) * lw * 1.5 + (hash(seed + i) - 0.5) * wav * 0.7;
    pts.push([x, y]);
  }
  const n = clamp(p) * N, ni = Math.floor(n), fr = n - ni;
  const head = ni >= N ? pts[N] : [lerp(pts[ni][0], pts[ni + 1][0], fr), lerp(pts[ni][1], pts[ni + 1][1], fr)];
  if (p > 0) {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= ni; i++) g.lineTo(pts[i][0], pts[i][1]); g.lineTo(head[0], head[1]); };
    if (outline) { path(); g.strokeStyle = C.ink; g.lineWidth = lw + 8; g.stroke(); }
    path(); g.strokeStyle = color; g.lineWidth = lw; g.stroke(); g.restore();
  }
  return head;
}
let _hatch = null;
function hatch(g) {
  if (_hatch) return _hatch;
  const c = new OffscreenCanvas(18, 18), x = c.getContext('2d');
  x.strokeStyle = 'rgba(143,211,244,0.62)'; x.lineWidth = 3; x.lineCap = 'square';
  for (const o of [-18, 0, 18]) { x.beginPath(); x.moveTo(o - 2, 20); x.lineTo(o + 20, -2); x.stroke(); }
  _hatch = g.createPattern(c, 'repeat'); return _hatch;
}

// ======================= PART 1: the opening title "RAW TO REAL" =======================
// o: { l1, l2, y, words: [times, one per l1 word], rawWord, scan: [t0, t1], punchAt, until, loopAt, end, push(t) 0..1 }
// Frame 0 = RAW blueprint (readable, standalone). The scan line turns it REAL. On the loop frames the blueprint
// builds itself again and settles exactly on the frame-0 look.
export function titleRawReal(g, t, o) {
  const { l1, l2, y = 400, words = [], rawWord, scan = [0.15, 0.85], punchAt = 1.4, until = 2.4, loopAt = 1e9, end = 1e9 } = o;
  const loop = t >= loopAt;
  if (!loop && t > until) return;
  const lt = loop ? t - loopAt : 0;                 // loop build-in clock
  g.save(); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
  const f2 = fit(g, l2, 300, F.title, SAFE.maxW - 44, 80);
  g.font = `400 ${f2}px ${F.title}`; const G2 = glyphs(g, l2), w2 = g.measureText(l2).width;
  const capH = g.measureText('E').actualBoundingBoxAscent;
  const f1 = fit(g, l1, 78, F.cap, SAFE.maxW - 30, 36);
  const cx = SAFE.cx - 10, by = y + 34 + capH + f1 * 0.2;   // baseline of the big word
  const exitA = loop ? 1e9 : until - t, ex = clamp(1 - exitA / 0.13);
  softPlate(g, cx, by - capH * 0.5, w2 + 120, capH + 150, 0.32 * (1 - ex) * (loop ? clamp(lt / 0.3) : 1));

  // ---- small line: ghost (blueprint) words, each one drops in solid on its narration time ----
  g.font = `400 ${f1}px ${F.cap}`;
  const parts = l1.split(' '), spw = g.measureText(' ').width, w1 = g.measureText(l1).width;
  let x = cx - w1 / 2; const y1 = by - capH - f1 * 0.62 - 34;
  parts.forEach((p, i) => {
    const pw = g.measureText(p).width, wt = loop ? 1e9 : (words[i] ?? 0.1 + 0.09 * i), a = t - wt;
    const isRaw = p === rawWord;
    g.save(); g.translate(x + pw / 2, y1 - (loop ? 0 : E.i(ex) * 150)); g.globalAlpha = 1 - ex;
    // ghost
    const gh = loop ? sp(lt - 0.12 - 0.05 * i, 'scl') : 1 - clamp(a / 0.07);
    if (gh > 0) {
      g.save(); g.globalAlpha *= clamp(gh); if (loop) { g.translate(0, (1 - gh) * -26); }
      g.lineWidth = f1 * 0.2; g.strokeStyle = C.ink; g.strokeText(p, -pw / 2, 0);
      g.fillStyle = '#1B2B40'; g.fillText(p, -pw / 2, 0);
      g.lineWidth = 2.6; g.strokeStyle = C.cream; g.strokeText(p, -pw / 2, 0); g.restore();
    }
    if (a >= 0) {                                    // solid word drops in with overshoot + a 1-frame RGB split
      const d = sp(a, 'pos'), s = lerp(1.25, 1, sp(a, 'scl'));
      g.translate(0, (1 - d) * -64); g.scale(s, s); g.globalAlpha *= clamp(a / 0.04);
      if (a < 1.4 / 30) { g.save(); g.globalAlpha *= 0.85; g.fillStyle = '#FF3B5C'; g.fillText(p, -pw / 2 - 9, 0); g.fillStyle = '#3BE0FF'; g.fillText(p, -pw / 2 + 9, 0); g.restore(); }
      const hot = isRaw ? clamp((a - 0.05) / 0.12) : 0;
      const ps = isRaw ? 1 + 0.1 * ring(a - 0.05, 3.5, 9) * (a > 0.05 ? 1 : 0) : 1; g.scale(ps, ps);
      inkText(g, p, -pw / 2, 0, hot > 0 ? mixCol(C.cream, C.accent, hot) : C.cream, f1, 0.22, hot * (10 + 6 * Math.sin(t * 9)));
      if (isRaw) {                                   // hand-drawn underline with a pencil tip following the stroke
        const u = clamp((a - 0.1) / 0.3), pu = E.io2(u);
        const hd = scribble(g, -pw / 2 - 6, f1 * 0.24, pw / 2 + 8, f1 * 0.17, pu, { color: C.accent, lw: 8, wav: 3.5, seed: 4 });
        if (a > 0.1) { const lift = clamp((a - 0.42) / 0.16); miniPencil(g, hd[0] + lift * 22, hd[1] + lift * 10, 0.5 + lift * 0.3, 0.62, 1 - lift); }
        specks(g, a, { at: 0.12, x: hd[0], y: hd[1], n: 7, kind: 'graphite', dir: Math.PI * 0.6, spread: 1.2, speed: 240, seed: 9, life: 0.3 });
      }
    }
    g.restore(); x += pw + spw;
  });

  // ---- big word ----
  const xs = lerp(-w2 / 2 - 40, w2 / 2 + 60, clamp((t - scan[0]) / (scan[1] - scan[0])));   // scan line (linear on purpose)
  const scanning = !loop && t >= scan[0] && t < scan[1], real = !loop && t >= scan[1];
  const pa = loop ? -1 : t - punchAt;
  // punch: squash and stretch (1.14 wide, 0.92 tall), then a spring settle; depth pulse; 2-frame shake
  let q = 0; if (pa >= 0) q = pa < 0.06 ? E.o(pa / 0.06) : ring(pa - 0.06, 4.6, 15);
  const [shx, shy] = shake2(pa, 13);
  const push = o.push ? o.push(t) : clamp(t / until);
  const exS = 1 + 0.2 * E.i(ex);
  g.save(); g.translate(cx + shx, by + shy - capH * 0.5); g.scale((1 + 0.14 * q) * exS, (1 - 0.08 * q) * exS); g.translate(0, capH * 0.5); g.globalAlpha = 1 - E.o(ex);
  g.font = `400 ${f2}px ${F.title}`;
  // shockwave ring of light behind the letters
  if (pa >= 0 && pa < 0.45) {
    const u = pa / 0.45, r = lerp(0.25, 1.25, E.o(u)) * w2 * 0.62;
    g.save(); g.globalAlpha *= (1 - u) * 0.95; g.strokeStyle = MO.hi; g.shadowColor = C.accent; g.shadowBlur = 50; g.lineWidth = lerp(34, 3, u);
    g.beginPath(); g.ellipse(0, -capH * 0.5, r, r * 0.56, 0, 0, 7); g.stroke(); g.restore();
    g.save(); g.globalAlpha *= (1 - u) * 0.3; const rg = g.createRadialGradient(0, -capH * 0.5, 10, 0, -capH * 0.5, w2 * 0.7); rg.addColorStop(0, MO.hi); rg.addColorStop(1, 'rgba(255,210,58,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, -capH * 0.5, w2 * 0.7, 0, 7); g.fill(); g.restore();
  }
  // per-letter transform: idle breathing wave (40 ms offset per letter) once the word is real
  const idle = real ? clamp((t - scan[1]) / 0.25) : 0;
  const LT = (i) => {
    const ph = (t - 0.04 * i) * 2 * Math.PI / 0.8;
    let s = 1 + 0.022 * idle * Math.sin(ph), dy = -5 * idle * Math.sin(ph), al = 1;
    if (loop) { const a = lt - 0.2 - 0.05 * i; const ant = a < 0.05 ? lerp(0.9, 0.86, clamp(a / 0.05)) : lerp(0.86, 1, sp(a - 0.05, 'scl')); s = ant; al = clamp(a / 0.05); }
    return { s, dy, al };
  };
  const each = (fn) => G2.forEach((L, i) => { const T = LT(i); if (T.al <= 0) return; g.save(); g.globalAlpha *= T.al; g.translate(-w2 / 2 + L.x + L.w / 2, T.dy - capH * 0.45); g.scale(T.s, T.s); g.translate(0, capH * 0.45); fn(L, -L.w / 2, i); g.restore(); });
  const drawRaw = () => {
    each((L, lx) => { g.lineWidth = f2 * 0.085; g.strokeStyle = C.ink; g.strokeText(L.ch, lx, 0); });
    each((L, lx) => { g.lineWidth = f2 * 0.05; g.strokeStyle = C.cream; g.strokeText(L.ch, lx, 0); g.fillStyle = '#16263A'; g.fillText(L.ch, lx, 0); g.fillStyle = hatch(g); g.globalAlpha *= loop ? clamp((lt - 0.55) / 0.2) : 1; g.fillText(L.ch, lx, 0); });
  };
  const drawReal = () => {
    const N = 7, th = (45 - 9 * push) * Math.PI / 180, step = (3.3 + 0.7 * push) * (1 + 0.9 * Math.max(0, q)) * (1 + 1.2 * E.i(ex));
    const ox = Math.cos(th) * step - MO.par.x * 0.5, oy = Math.sin(th) * step - MO.par.y * 0.5;
    each((L, lx) => { g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 26; g.shadowOffsetX = ox * (N + 3); g.shadowOffsetY = oy * (N + 3); g.lineWidth = f2 * 0.075; g.strokeStyle = C.ink; g.strokeText(L.ch, lx + ox * N, oy * N); g.restore(); });
    for (let k = N; k >= 1; k--) each((L, lx) => { g.lineWidth = f2 * 0.075; g.strokeStyle = C.ink; g.strokeText(L.ch, lx + ox * k, oy * k); });
    for (let k = N; k >= 1; k--) each((L, lx) => { g.fillStyle = mixCol('#6E4300', '#D08F0A', 1 - (k - 1) / (N - 1)); g.fillText(L.ch, lx + ox * k, oy * k); });
    each((L, lx) => { g.lineWidth = f2 * 0.075; g.strokeStyle = C.ink; g.strokeText(L.ch, lx, 0); });
    each((L, lx) => {
      const gr = g.createLinearGradient(0, -capH, 0, 0); gr.addColorStop(0, '#FFE77A'); gr.addColorStop(0.55, C.accent); gr.addColorStop(1, '#F0A400');
      g.fillStyle = gr; g.fillText(L.ch, lx, 0);
      const gl = g.createLinearGradient(0, -capH, 0, 0); gl.addColorStop(0, 'rgba(255,255,255,0.78)'); gl.addColorStop(0.36, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.fillText(L.ch, lx, 0);
    });
    // gloss band: once right behind the scan, then every 0.8 s
    const ga = t - scan[1] - 0.1, gp = ga >= 0 ? (ga % 0.8) / 0.34 : -1;
    if (gp >= 0 && gp < 1) each((L, lx) => {
      const bx = lerp(-w2 * 0.75, w2 * 0.75, E.io2(gp)) - (-w2 / 2 + L.x + L.w / 2);
      const gr = g.createLinearGradient(bx - 80, 40, bx + 80, -40); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,253,235,0.92)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillText(L.ch, lx, 0);
    });
  };
  const guides = (al) => {
    if (al <= 0) return; g.save(); g.globalAlpha *= al;
    const k = loop ? sp(lt, 'pos') : 1, xa = (-w2 / 2 - 34) * k, xb = (w2 / 2 + 34) * k;
    g.strokeStyle = MO.cyan; g.lineWidth = 3; g.beginPath(); g.moveTo(xa, 7); g.lineTo(xb, 7); g.stroke();
    g.setLineDash([16, 11]); g.beginPath(); g.moveTo(xa, -capH - 7); g.lineTo(xb, -capH - 7); g.stroke(); g.setLineDash([]);
    g.lineWidth = 2; G2.forEach(L => { const gx = (-w2 / 2 + L.x) * k; g.beginPath(); g.moveTo(gx, 7); g.lineTo(gx, 23); g.stroke(); });
    const tk = loop ? sp(lt - 0.25, 'scl') : 1, c = 26 * tk; g.lineWidth = 5;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = sx * (w2 / 2 + 34), py = sy > 0 ? 30 : -capH - 30; g.beginPath(); g.moveTo(px, py - sy * c); g.lineTo(px, py); g.lineTo(px - sx * c, py); g.stroke(); }
    g.font = `700 21px ${F.mono}`; g.fillStyle = MO.cyan; g.globalAlpha *= clamp(tk);
    g.fillText('CAP', w2 / 2 - 44, -capH - 18); g.fillText('BASE', w2 / 2 - 56, 44);
    g.restore();
  };
  const clipL = () => { g.beginPath(); g.rect(-4000, -4000, 4000 + xs, 8000); g.clip(); };
  const clipR = () => { g.beginPath(); g.rect(xs, -4000, 4000, 8000); g.clip(); };
  if (loop || t < scan[0]) { guides(1); drawRaw(); }
  else if (scanning) {
    g.save(); clipR(); guides(1); drawRaw(); g.restore();
    g.save(); clipL(); drawReal(); g.restore();
    // scan line + sparks / graphite specks flying off it
    g.save(); g.strokeStyle = '#FFFFFF'; g.shadowColor = C.accent; g.shadowBlur = 34; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(xs, -capH - 46); g.lineTo(xs, 52); g.stroke(); g.stroke();
    const tr = g.createLinearGradient(xs - 110, 0, xs, 0); tr.addColorStop(0, 'rgba(255,210,58,0)'); tr.addColorStop(1, 'rgba(255,240,168,0.42)');
    g.shadowBlur = 0; g.fillStyle = tr; g.fillRect(xs - 110, -capH - 40, 110, capH + 86); g.restore();
  } else drawReal();
  if (!loop && t >= scan[0] && t < scan[1] + 0.5) {
    const dur = scan[1] - scan[0];
    for (let i = 0; i < 54; i++) {
      const tb = scan[0] + dur * hash(i * 3.3 + 1), a = t - tb; if (a < 0) continue;
      const sx0 = lerp(-w2 / 2 - 40, w2 / 2 + 60, (tb - scan[0]) / dur);
      specks(g, a, { at: 0, x: sx0, y: -capH * hash(i * 1.7 + 5), n: 1, kind: i % 3 ? 'spark' : 'graphite', dir: Math.PI + (hash(i * 9.1) - 0.5) * 2.6, spread: 0.2, speed: 560, seed: i + 40, life: 0.42, grav: 1300 });
    }
  }
  g.restore(); g.restore();
}

// ======================= PART 2: kinetic captions, entrance by type of word =======================
// words: [{ t, a (accent), at, k: noun | verb | q | twist }]; dir: +1 / -1 (direction of the action, used by verbs and exits)
function wordKin(k, a, dir) {
  const T = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, skew: 0, al: clamp(a / 0.045), split: 0, slice: 0 };
  if (k === 'verb') { const p = sp(a, 'pos'); T.dx = -dir * 560 * (1 - p); T.skew = -dir * 0.55 * (1 - spring(a, 3.6, 11)); }
  else if (k === 'q') { T.dy = -150 * (1 - sp(a, 'bounce')); T.rot = 0.05 * ring(a, 2.6, 5); }
  else if (k === 'twist') { T.split = 16 * Math.exp(-a * 22); T.slice = a < 3 / 30 ? 1 : 0; const s = lerp(1.12, 1, sp(a, 'scl')); T.sx = T.sy = s; }
  else { const s = a < 0.045 ? lerp(0.9, 0.86, a / 0.045) : lerp(0.86, 1, sp(a - 0.045, 'scl')); T.sx = T.sy = s; T.rot = 0.03 * (1 - sp(a, 'rot')); }
  return T;
}
function drawWord(g, txt, fs, fill, glow, T, seed) {
  const w = g.measureText(txt).width;
  const base = (ox = 0, col = fill, ow = 0.2) => inkText(g, txt, -w / 2 + ox, 0, col, fs, ow, col === fill ? glow : 0);
  if (T.split > 0.6) { g.save(); g.globalAlpha *= 0.9; g.fillStyle = '#FF3B5C'; g.fillText(txt, -w / 2 - T.split, 0); g.fillStyle = '#3BE0FF'; g.fillText(txt, -w / 2 + T.split, 0); g.restore(); }
  if (T.slice) {
    const n = 6, h = fs * 1.3 / n, fr = Math.floor(seed * 30);
    for (let i = 0; i < n; i++) { g.save(); g.beginPath(); g.rect(-w, -fs * 0.65 + i * h, w * 2, h + 1); g.clip(); g.translate((hash(i * 3.1 + fr * 7.7) - 0.5) * 70, 0); base(); g.restore(); }
  } else base();
  return w;
}
export function kcap(g, t, o) {
  const { at, until, words, y = 520, size = 108, cx = SAFE.cx, maxW = SAFE.maxW, dir = 1, font = F.cap, plate = true, hit } = o;
  const a0 = t - at, r = until - t; if (a0 < 0 || r < 0) return;
  g.save(); g.textBaseline = 'middle'; g.textAlign = 'left';
  const full = words.map(w => w.t).join(' '); const fs = fit(g, full, size, font, maxW, 44);
  const spw = g.measureText(' ').width, ws = words.map(w => g.measureText(w.t).width), tot = ws.reduce((p, c) => p + c, 0) + spw * (words.length - 1);
  const xo = E.i(clamp(1 - r / 0.1)), drift = 1 + 0.04 * clamp(a0 / 1.5);        // exit: pop-out + slide in the direction of motion
  if (plate) softPlate(g, cx, y, tot + 90, fs * 1.25, 0.3 * clamp(a0 / 0.1) * clamp(r / 0.1));
  g.translate(cx + dir * 46 * xo, y); g.scale(drift * lerp(1, 0.86, xo), drift * lerp(1, 0.86, xo)); g.globalAlpha = clamp(r / 0.08);
  let xx = -tot / 2;
  words.forEach((w, i) => {
    const wa = t - (w.at ?? at);
    if (wa >= 0) {
      const T = wordKin(w.k || 'noun', wa, dir);
      g.save(); g.translate(xx + ws[i] / 2 + T.dx, T.dy); g.transform(1, 0, T.skew, 1, 0, 0); g.rotate(T.rot); g.scale(T.sx, T.sy); g.globalAlpha *= T.al;
      const fill = w.a ? C.accent : C.cream, glow = w.a ? 5 + 5 * (0.5 + 0.5 * Math.sin(t * 8)) : 0;
      if (w.k === 'q' && w.t.endsWith('?')) {       // the "?" wobbles on its own
        const body = w.t.slice(0, -1), bw = g.measureText(body).width, qw = g.measureText('?').width;
        g.save(); g.translate(-ws[i] / 2 + bw / 2, 0); drawWord(g, body, fs, fill, glow, T, wa); g.restore();
        g.save(); g.translate(-ws[i] / 2 + bw + qw / 2, fs * 0.3); g.rotate(0.5 * ring(wa - 0.08, 3.2, 3.2) * (wa > 0.08 ? 1 : 0) + 0.07 * Math.sin(wa * 6)); g.translate(0, -fs * 0.3); drawWord(g, '?', fs, C.accent, 10, T, wa); g.restore();
      } else drawWord(g, w.t, fs, fill, glow, T, wa);
      g.restore();
    }
    xx += ws[i] + spw;
  });
  g.restore();
  if (hit) specks(g, t, { at: hit.at ?? at + 0.05, x: cx + (hit.dx || 0), y: y + fs * 0.3, n: hit.n || 12, kind: hit.kind || 'graphite', dir: -Math.PI / 2, spread: 2.4, speed: 480, seed: Math.round(at * 10) });
}

// ---------- odometer number (digits roll separately, staggered stop, glow pulse) + optional morph into a tag ----------
// o: { at, until, value, unit, y, size, dur, color, morph: { at, to: {x, y} | fn(t), label } }
export function odometer(g, t, o) {
  const { at, until, value, unit = '', y = 640, size = 250, cx = SAFE.cx, dur = 0.8, color = C.accent, morph } = o;
  const a = t - at, r = until - t; if (a < 0 || r < 0) return;
  const txt = typeof value === 'string' ? value : Math.round(value).toLocaleString('en-US'), isD = (c) => c >= '0' && c <= '9';
  g.save(); g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.lineJoin = 'round';
  let fs = size; const uf = 0.46;
  const meas = () => { g.font = `400 ${fs}px ${F.title}`; const dw = g.measureText('0').width + fs * 0.02, cw = g.measureText(',').width; let w = 0; const xs = []; for (const ch of txt) { xs.push(w); w += isD(ch) ? dw : (ch === ',' ? cw : g.measureText(ch).width + fs * 0.02); } g.font = `400 ${fs * uf}px ${F.title}`; const uw = unit ? g.measureText(unit).width + fs * 0.06 : 0; return { dw, cw, xs, w, uw }; };
  let M = meas(); while (M.w + M.uw > SAFE.maxW - 40 && fs > 80) { fs -= 6; M = meas(); }
  const m = morph ? sp(t - morph.at, 'pos') : 0, mk = morph ? clamp((t - morph.at) / 0.3) : 0;
  const to = morph ? (typeof morph.to === 'function' ? morph.to(t) : morph.to) : { x: cx, y };
  // final tag layout (the number becomes the value chip inside the label)
  const fN = 64, kEnd = fN / fs; g.font = `400 46px ${F.cap}`; const lw = morph ? g.measureText(morph.label).width : 0;
  const UK = 1.45, numW = (M.w + M.uw * UK) * kEnd, tagW = 28 + lw + 24 + numW + 30, tagH = 92;
  const k = lerp(1, kEnd, m), totW = (M.w + M.uw) * k;
  const endCx = to.x + tagW / 2 - 30 - numW + (M.w + M.uw) / 2 * kEnd, endBy = to.y + fN * 0.36;
  const px = lerp(cx, endCx, m), py = lerp(y, endBy, m) - Math.sin(Math.PI * clamp(m)) * 70 * (1 - mk * 0.3);
  const xo = E.i(clamp(1 - r / 0.1)), landed = a - dur;
  const punch = landed >= 0 && !morph?.at || landed >= 0 ? 1 + 0.09 * ring(landed, 4, 13) : 1;
  g.globalAlpha = clamp(r / 0.08);
  if (!morph || m < 0.5) softPlate(g, cx, y - fs * 0.36, M.w + M.uw + 120, fs * 0.9, 0.3 * clamp(a / 0.1) * (1 - mk));
  // the tag grows around the travelling number and types its label
  if (morph && m > 0.02) {
    const gw = lerp(numW + 52, tagW, sp(t - morph.at - 0.12, 'pos')), bob = 5 * Math.sin((t - morph.at) * 4) * clamp((t - morph.at - 0.5) * 3);
    g.save(); g.translate(px - totW / 2 + (M.w + M.uw * lerp(1, UK, mk)) * k + 30 - gw, py - fN * 0.36 - tagH / 2 + bob); g.globalAlpha *= clamp(mk * 2);
    const tx = lerp(1, 0.9, xo); g.scale(tx, tx);
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, 8, 10, gw, tagH, 18); g.fill();
    g.fillStyle = C.accent; rr(g, 0, 0, gw, tagH, 18); g.fill(); g.lineWidth = 7; g.strokeStyle = C.ink; g.stroke();
    const nch = Math.floor(clamp((t - morph.at - 0.2) / 0.22) * morph.label.length);
    g.save(); g.beginPath(); g.rect(0, 0, gw, tagH); g.clip(); g.font = `400 46px ${F.cap}`; g.textBaseline = 'middle'; g.fillStyle = C.ink; g.fillText(morph.label.slice(0, nch), gw - tagW + 28, tagH / 2 + 3);
    if (nch >= morph.label.length) { g.globalAlpha *= 0.5; g.fillRect(gw - tagW + 28 + lw + 10, 20, 4, tagH - 40); }
    g.restore(); g.restore();
    py + bob; g.translate(0, bob);
  }
  const col = morph ? mixCol(color, C.ink, mk) : color, ow = 0.085 * (1 - mk);
  g.translate(px + (o.dir || 1) * 40 * xo, py); g.scale(k * punch * lerp(1, 0.88, xo), k * punch * lerp(1, 0.88, xo));
  const x0 = -(M.w + M.uw) / 2, nd = [...txt].filter(isD).length; let di = 0;
  const glow = (1 - mk) * (landed >= 0 ? 18 + 46 * Math.exp(-landed * 7) + 8 * Math.sin(a * 8) : 8);
  [...txt].forEach((ch, i) => {
    g.font = `400 ${fs}px ${F.title}`; const gx = x0 + M.xs[i];
    if (!isD(ch)) { const s = sp(a - 0.05, 'scl'); g.save(); g.translate(gx, 0); g.scale(s, s); if (ow > 0.01) { g.lineWidth = fs * ow; g.strokeStyle = C.ink; g.strokeText(ch, 0, 0); } if (glow > 1) { g.shadowColor = col; g.shadowBlur = glow; } g.fillStyle = col; g.fillText(ch, 0, 0); g.restore(); return; }
    const j = di++, stop = dur * (0.5 + 0.5 * (nd > 1 ? j / (nd - 1) : 1)), turns = 7 + 4 * j, u = clamp(a / stop);
    const v = +ch - turns * (1 - E.o(u)) + 0.16 * ring(a - stop, 5, 16) * (a > stop ? 1 : 0), fl = Math.floor(v), fr = v - fl, cell = fs * 0.92;
    const cwid = g.measureText(ch).width, pad = (M.dw - g.measureText('0').width) / 2;
    g.save(); g.beginPath(); g.rect(gx - fs * 0.06, -fs * 0.84, M.dw + fs * 0.12, fs * 0.9); g.clip();
    for (const [dgt, off] of [[fl, -fr * cell], [fl + 1, (1 - fr) * cell]]) {
      if (Math.abs(off) > cell * 0.985) continue;
      const d = String(((dgt % 10) + 10) % 10), w = g.measureText(d).width, dx = gx + pad + (g.measureText('0').width - w) / 2;
      if (ow > 0.01) { g.lineWidth = fs * ow; g.strokeStyle = C.ink; g.strokeText(d, dx, off); }
      g.save(); if (glow > 1) { g.shadowColor = col; g.shadowBlur = glow; } g.fillStyle = col; g.fillText(d, dx, off); g.restore();
    }
    g.restore();
  });
  if (unit) {                                        // the unit always travels with the number
    const s = sp(a - 0.02, 'scl'); g.font = `400 ${fs * uf}px ${F.title}`;
    g.save(); g.translate(x0 + M.w + fs * 0.06, lerp(-fs * 0.4, 0, mk)); g.scale(s * lerp(1, UK, mk), s * lerp(1, UK, mk));
    if (ow > 0.01) { g.lineWidth = fs * uf * ow * 1.5; g.strokeStyle = C.ink; g.strokeText(unit, 0, 0); }
    g.fillStyle = col; g.fillText(unit, 0, 0); g.restore();
  }
  if (o.pre) {                                       // qualifier above the number (UP TO, ABOUT), appears with it
    const pf = Math.round(fs * 0.24), s = sp(a - 0.03, 'scl');
    g.save(); g.translate(0, -fs * 0.9); g.scale(s, s); g.textAlign = 'center'; g.font = `400 ${pf}px ${F.cap}`; inkText(g, o.pre, 0, 0, C.cream, pf, 0.22); g.restore();
  }
  if (o.sub) {                                       // the unit as a line under the number (e.g. PENCILS PER SANDWICH)
    const sf = fit(g, o.sub, fs * 0.3, F.cap, (SAFE.maxW - 40) / Math.max(0.2, k), 30), s = sp(a - 0.06, 'scl');
    g.save(); g.translate(0, fs * 0.36); g.scale(s, s); g.textAlign = 'center'; g.font = `400 ${sf}px ${F.cap}`; inkText(g, o.sub, 0, 0, C.cream, sf, 0.22); g.restore();
  }
  g.restore();
}

// ---------- the strike-through: WORD is scribbled out, shakes, falls with gravity; REPL slides in ----------
// o: { at, strikeAt, until, word, repl, y, size, kind: 'graphite' }
export function strike(g, t, o) {
  const { at, strikeAt, until, word, repl, y = 600, size = 230, cx = SAFE.cx, font = F.title, kind = 'graphite', k = 'noun' } = o;
  const a = t - at, r = until - t; if (a < 0 || r < 0) return;
  g.save(); g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
  const fs = fit(g, word.length > repl.length ? word : repl, size, font, SAFE.maxW - 30, 60);
  g.font = `400 ${fs}px ${font}`; const G = glyphs(g, word), ww = g.measureText(word).width, rw = g.measureText(repl).width;
  const sa = t - strikeAt, fallAt = strikeAt + 0.3, fa = t - fallAt, xo = E.i(clamp(1 - r / 0.1));
  const vis = (t - (strikeAt + 0.3)) < 0.7 || t >= (o.replAt ?? strikeAt + 0.32) ? 1 : 0;   // no empty plate while waiting for a late replacement
  softPlate(g, cx, y, Math.max(ww, rw) + 110, fs * 1.2, 0.3 * clamp(a / 0.1) * clamp(r / 0.1) * vis);
  g.globalAlpha = clamp(r / 0.08);
  // the wrong word
  if (fa < 0.7) {
    const T = wordKin(k, a, 1), [sx, sy] = fa >= -3 / 30 && fa < 0 ? [[10, -9, 6][Math.floor((fa + 0.1) * 30)] || 0, [-4, 5, -3][Math.floor((fa + 0.1) * 30)] || 0] : [0, 0];
    const dim = clamp(sa / 0.25);
    g.save(); g.translate(cx + sx, y + sy + T.dy); g.rotate(T.rot); g.scale(T.sx, T.sy); g.globalAlpha *= T.al;
    G.forEach((L, i) => {
      const f = Math.max(0, fa - 0.035 * i), dy = 0.5 * 2600 * f * f, rot = f * (2.2 + i * 0.5) * (i % 2 ? 1 : -1);
      g.save(); g.translate(-ww / 2 + L.x + L.w / 2, dy); g.rotate(rot); g.globalAlpha *= clamp(1 - (f - 0.25) / 0.3);
      inkText(g, L.ch, -L.w / 2, 0, mixCol(C.cream, '#C2C8D0', dim), fs, 0.09); g.restore();
    });
    // graphite scribble across it (0.25 s) + dust
    if (sa >= 0) {
      const p = E.io2(clamp(sa / 0.25)), f = Math.max(0, fa), dy = 0.5 * 2600 * f * f;
      g.save(); g.translate(0, dy); g.rotate(f * -0.6); g.globalAlpha *= clamp(1 - (f - 0.2) / 0.3);
      const hd = scribble(g, -ww / 2 - 26, 8, ww / 2 + 28, -10, p, { color: kind === 'graphite' ? '#4A505C' : C.red, lw: fs * 0.085, wav: fs * 0.035, passes: 3, seed: 7 });
      if (sa < 0.25) miniPencil(g, hd[0], hd[1], -1.0, 1.15, 1);
      g.restore();
      specks(g, t, { at: strikeAt + 0.02, x: -ww * 0.3, y: 14, n: 7, kind: 'graphite', dir: Math.PI * 0.5, spread: 1.6, speed: 260, seed: 21, life: 0.4 });
      specks(g, t, { at: strikeAt + 0.1, x: 0, y: 4, n: 7, kind: 'graphite', dir: Math.PI * 0.5, spread: 1.6, speed: 260, seed: 22, life: 0.4 });
      specks(g, t, { at: strikeAt + 0.18, x: ww * 0.3, y: -6, n: 7, kind: 'graphite', dir: Math.PI * 0.5, spread: 1.6, speed: 260, seed: 23, life: 0.4 });
    }
    g.restore();
  }
  // the right word slides in below, then rises to take the place
  const ra = t - (o.replAt ?? fallAt + 0.02);
  if (ra >= 0) {
    const p = sp(ra, 'pos'), rise = sp(ra - 0.32, 'pos'), skew = -0.5 * (1 - spring(ra, 3.6, 11));
    const yy = y + fs * 0.98 * (1 - rise), drift = 1 + 0.04 * clamp(ra / 1.5);
    g.save(); g.translate(cx - 620 * (1 - p) + 46 * xo, yy); g.transform(1, 0, skew, 1, 0, 0); g.scale(drift * lerp(1, 0.86, xo), drift * lerp(1, 0.86, xo)); g.globalAlpha *= clamp(ra / 0.04);
    inkText(g, repl, -rw / 2, 0, C.accent, fs, 0.09, 8 + 4 * Math.sin(t * 8) + 22 * Math.exp(-ra * 7)); g.restore();
    specks(g, t, { at: fallAt + 0.2, x: cx, y: y + fs * 1.3, n: 12, kind, dir: -Math.PI / 2, spread: 2.6, speed: 420, seed: 31 });
  }
  g.restore();
}

// ---------- callout attached to a 3D point: a line draws out of the anchor, the label expands and types ----------
// o: { at, until, text, anchor(t) -> {x, y}, dx, dy (label offset from the anchor) }
export function callout(g, t, o) {
  const { at, until, text, anchor, dx = 170, dy = -150 } = o;
  const a = t - at, r = until - t; if (a < 0 || r < 0) return;
  const p = anchor(t); if (!p) return; const pl = anchor(t - 0.09) || p;       // the label lags behind the anchor (follow-through)
  const out = clamp(r / 0.14), grow = sp(a, 'pos') * E.o(out);
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  g.font = `800 44px ${F.mono}`; const tw = g.measureText(text).width, bw = tw + 60, bh = 80, sd = dx >= 0 ? 1 : -1;
  let ex = pl.x + dx, ey = pl.y + dy;
  ex = clamp(ex, SAFE.left + (sd < 0 ? bw : 0) + 4, SAFE.right - (sd > 0 ? bw : 0) - 4); ey = clamp(ey, SAFE.top + 100, SAFE.bottom - 50);
  const kx = p.x + (ex - p.x) * 0.55, ky = ey;                                   // elbow
  const seg1 = clamp(grow / 0.6), seg2 = clamp((grow - 0.6) / 0.4);
  const path = () => { g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(lerp(p.x, kx, seg1), lerp(p.y, ky, seg1)); if (seg2 > 0) g.lineTo(lerp(kx, ex, seg2), ky); };
  path(); g.strokeStyle = C.ink; g.lineWidth = 11; g.stroke(); path(); g.strokeStyle = C.accent; g.lineWidth = 5; g.stroke();
  const pr = 12 + 3 * Math.sin(a * 9), rp = (a % 0.9) / 0.9;
  g.strokeStyle = C.accent; g.globalAlpha = (1 - rp) * out; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y, pr + rp * 30, 0, 7); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = C.accent; g.beginPath(); g.arc(p.x, p.y, pr * sp(a, 'scl') * out, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = C.ink; g.stroke();
  const la = a - 0.1;
  if (la > 0 && out > 0) {
    const open = sp(la, 'pos') * E.o(out), w = bw * open;
    g.save(); g.translate(ex, ey - bh / 2);
    const x0 = sd > 0 ? 0 : -w;
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0 + 7, 9, w, bh, 12); g.fill();
    g.fillStyle = 'rgba(16,20,24,0.94)'; rr(g, x0, 0, w, bh, 12); g.fill(); g.lineWidth = 5; g.strokeStyle = C.accent; g.stroke();
    g.fillStyle = C.accent; g.fillRect(sd > 0 ? 0 : -10, 12, 10, bh - 24);
    if (o.pre) { g.save(); g.font = `700 26px ${F.mono}`; g.textBaseline = 'bottom'; g.fillStyle = C.cream; g.globalAlpha *= clamp((la - 0.05) / 0.12); g.lineWidth = 6; g.strokeStyle = C.ink; g.lineJoin = 'round'; const px = (sd > 0 ? 0 : -bw) + 30; g.strokeText(o.pre, px, -6); g.fillText(o.pre, px, -6); g.restore(); }   // small qualifier above the label (USUALLY)
    const n = Math.floor(clamp((la - 0.04) / (0.02 * text.length)) * text.length * clamp(r / 0.07 - 0.1, 0, 1) + 1e-6);
    g.beginPath(); g.rect(x0, 0, w, bh); g.clip(); g.textBaseline = 'middle'; g.fillStyle = C.cream;
    const tx = (sd > 0 ? 0 : -bw) + 30; g.fillText(text.slice(0, n), tx, bh / 2 + 2);
    if (n < text.length || Math.floor(la * 5) % 2 === 0) { g.fillStyle = C.accent; g.fillRect(tx + g.measureText(text.slice(0, n)).width + 5, 18, 14, bh - 36); }
    g.restore();
  }
  g.restore();
}

// ---------- step sticker (slaps down with a tape strip, then docks) + progress dock + ink swipe ----------
export const DOCK = { y: 296, gap: 62, total: 5 };
const dockX = (i, total) => SAFE.cx + (i - (total - 1) / 2) * DOCK.gap;
const ST = { ride: 0.2, dock: 0.34 };
export const stepDockTime = (at, hold = 1.0) => at + ST.ride + hold + ST.dock;
export function inkSwipe(g, t, { at, dur = 5 / 30, dir = 1 }) {
  const u = (t - at) / dur; if (u < 0 || u > 1) return;
  const front = -320 + (W + 1560) * E.o(u), tail = -640 + (W + 1100) * E.i(u), sl = 0.22;
  g.save(); if (dir < 0) { g.translate(W, 0); g.scale(-1, 1); }
  const band = (x0, x1, y0, y1, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x0 + (y0 - H / 2) * sl, y0); g.lineTo(x1 + (y0 - H / 2) * sl, y0); g.lineTo(x1 + (y1 - H / 2) * sl, y1); g.lineTo(x0 + (y1 - H / 2) * sl, y1); g.closePath(); g.fill(); };
  band(tail - 130, front + 70, 0, H, C.ink);
  const n = 9; for (let i = 0; i < n; i++) { const y0 = H * i / n, y1 = H * (i + 1) / n + 1; band(tail + hash(i * 5.3) * 260 * (0.3 + u), front - hash(i * 2.9) * 90, y0, y1, C.accent); }
  band(front - 210, front - 150, 0, H, MO.hi); band(tail - 60, tail - 30, 0, H, C.cream);
  g.restore();
}
export function stepSticker(g, t, { at, n, word, hold = 1.0, total = DOCK.total, swipe = true }) {
  const a = t - at, slapAt = ST.ride, la = a - slapAt, da = a - slapAt - hold;
  if (a < 0 || da > ST.dock) return;
  const p = swipe ? sp(a, 'pos') : 1, slap = la >= 0 ? sp(la, 'scl') : 0, [sx, sy] = shake2(la, 11);
  const d = clamp(da / ST.dock), de = d <= 0 ? 0 : (d < 0.2 ? -0.06 * Math.sin(d / 0.2 * Math.PI) : E.io((d - 0.2) / 0.8));   // tiny anticipation, then travel
  const X0 = SAFE.cx, Y0 = 720, X1 = dockX(n - 1, total), Y1 = DOCK.y;
  const x = lerp(lerp(-760, X0, p), X1, Math.max(0, de)) + sx, y = lerp(Y0, Y1, Math.max(0, de)) - Math.sin(Math.PI * clamp(de)) * 90 + sy + (swipe ? 0 : -900 * (1 - sp(a, 'pos')));
  const s = lerp(lerp(1.3, 1, slap), 0.07, Math.max(0, de)) * (1 - 0.04 * Math.min(0, de) * 10);
  const wob = la > 0 ? ring(la, 2.6, 2.4) * 2.5 : 0;
  g.save(); g.translate(x, y); g.rotate((-6 + (1 - p) * -14 + wob) * Math.PI / 180); g.scale(s, s); g.globalAlpha = clamp((1 - d) / 0.12);
  g.font = `400 168px ${F.title}`; const tw = g.measureText(word).width, w = Math.max(430, tw + 100), h = 250;
  const lift = 14 + 22 * (1 - slap);
  g.fillStyle = 'rgba(0,0,0,0.36)'; rr(g, -w / 2 + lift * 0.85, -h / 2 + lift, w, h, 22); g.fill();
  g.fillStyle = C.cream; rr(g, -w / 2, -h / 2, w, h, 22); g.fill(); g.lineWidth = 7; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.ink; g.textBaseline = 'top'; g.textAlign = 'left'; g.font = `800 32px ${F.mono}`; g.fillText(`STEP ${n}`, -w / 2 + 30, -h / 2 + 22);
  g.fillStyle = C.accent; g.fillRect(-w / 2 + 30 + g.measureText(`STEP ${n}`).width + 14, -h / 2 + 36, 46 * clamp(la / 0.2), 6);
  g.fillStyle = C.ink; g.textBaseline = 'alphabetic'; g.font = `400 168px ${F.title}`; g.fillText(word, -tw / 2, h / 2 - 34);
  if (la >= 0) {                                     // tape strip presses on with the slap
    const ts = sp(la, 'scl'); g.save(); g.translate(w / 2 - 110, -h / 2 + 4); g.rotate(0.3); g.scale(lerp(1.6, 1, ts), lerp(1.6, 1, ts)); g.globalAlpha *= clamp(la / 0.03);
    g.fillStyle = 'rgba(255,210,58,0.82)'; g.fillRect(-80, -24, 160, 48); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(-80, -24, 160, 12);
    g.strokeStyle = 'rgba(16,20,24,0.55)'; g.lineWidth = 3; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(-80, -24); g.lineTo(-80, 24); g.moveTo(80, -24); g.lineTo(80, 24); g.stroke(); g.restore();
  }
  g.restore();
  if (la >= 0) specks(g, t, { at: at + slapAt, x: X0, y: Y0 + 120, n: 10, kind: 'graphite', dir: -Math.PI / 2, spread: 3.0, speed: 520, seed: n * 13, life: 0.35 });
}
// steps: [{ at, word }] (same `at` as the stickers). The dock appears when the first sticker lands in it and stays.
export function dock(g, t, { steps, total = DOCK.total, until = 1e9, hold = 1.0 }) {
  const T = steps.map(s => stepDockTime(s.at, s.hold ?? hold)); if (t < T[0] - 0.12 || t > until) return;
  const a0 = t - (T[0] - 0.12), out = clamp((until - t) / 0.12);
  let cur = -1, ci = -1; T.forEach((x, i) => { if (t >= x) { ci = i; cur = (steps[i].n ?? i + 1) - 1; } });
  g.save(); g.globalAlpha = out; g.translate(0, (1 - E.o(out)) * -40);
  softPlate(g, SAFE.cx, DOCK.y + 14, DOCK.gap * (total - 1) + 150, 96, 0.3 * clamp(a0 / 0.2) * out);
  const lw = sp(a0, 'pos'); g.strokeStyle = 'rgba(243,233,210,0.3)'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(SAFE.cx - (dockX(total - 1, total) - SAFE.cx) * lw, DOCK.y); g.lineTo(SAFE.cx + (dockX(total - 1, total) - SAFE.cx) * lw, DOCK.y); g.stroke();
  if (cur >= 0) { g.strokeStyle = C.accent; g.beginPath(); g.moveTo(dockX(0, total), DOCK.y); g.lineTo(lerp(dockX(Math.max(0, cur - 1), total), dockX(cur, total), sp(t - T[ci], 'pos')), DOCK.y); g.stroke(); }
  for (let i = 0; i < total; i++) {
    const s = sp(a0 - 0.04 * i, 'scl'), x = dockX(i, total), done = i < cur, on = i === cur, la = on ? t - T[ci] : 0;
    g.save(); g.translate(x, DOCK.y); g.scale(s, s);
    if (on) {
      const pop = 1 + 0.9 * ring(la, 3.4, 9) * (la < 0.5 ? 1 : 0), pulse = 1 + 0.12 * Math.sin(la * 6.5);
      const rp = (la % 1.1) / 1.1; g.strokeStyle = C.accent; g.globalAlpha = out * (1 - rp) * 0.9; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 14 + rp * 20, 0, 7); g.stroke(); g.globalAlpha = out;
      g.fillStyle = C.accent; g.shadowColor = C.accent; g.shadowBlur = 16; g.beginPath(); g.arc(0, 0, 14 * pop * pulse, 0, 7); g.fill(); g.shadowBlur = 0; g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
    } else if (done) { g.fillStyle = C.accent; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke(); }
    else { g.fillStyle = 'rgba(16,20,24,0.8)'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.lineWidth = 3.5; g.strokeStyle = 'rgba(243,233,210,0.75)'; g.stroke(); }
    g.restore();
  }
  if (cur >= 0) {                                    // small label under the dots: STEP 2/5 · MIX (types on each change)
    const la = t - T[ci], txt = `STEP ${cur + 1}/${total} · ${steps[ci].word.replace('.', '')}`, n = Math.floor(clamp(la / 0.3) * txt.length);
    g.font = `800 26px ${F.mono}`; g.textAlign = 'center'; g.textBaseline = 'middle'; const full = g.measureText(txt).width;
    g.textAlign = 'left'; g.lineWidth = 7; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeText(txt.slice(0, n), SAFE.cx - full / 2, DOCK.y + 44); g.fillStyle = C.cream; g.fillText(txt.slice(0, n), SAFE.cx - full / 2, DOCK.y + 44);
  }
  g.restore();
  if (cur >= 0) specks(g, t, { at: T[ci], x: dockX(cur, total), y: DOCK.y, n: 8, kind: 'spark', dir: 0, spread: 6.3, speed: 260, seed: cur * 7 + 3, life: 0.3, grav: 300 });
}

// ======================= temporal motion blur for the overlay layer =======================
// Renders draw(g2, t) n times across a 180-degree shutter, averages them (premultiplied) and composites the result on g.
// Held text stays crisp (identical samples), only moving text blurs.
let _tmp = null, _out = null, _acc = null;
export function blurred(g, t, draw, { n = 6, shutter = 0.5, fps = 30 } = {}) {
  if (!_tmp) { _tmp = new OffscreenCanvas(W, H); _out = new OffscreenCanvas(W, H); _acc = new Float32Array(W * H * 4); }
  const x = _tmp.getContext('2d', { willReadFrequently: true }), acc = _acc; acc.fill(0);
  for (let k = 0; k < n; k++) {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.save(); draw(x, t + (k / n) * shutter / fps); x.restore();
    const d = x.getImageData(0, 0, W, H).data, u32 = new Uint32Array(d.buffer);
    for (let i = 0, j = 0; i < u32.length; i++, j += 4) { if (u32[i] === 0) continue; const al = d[j + 3]; acc[j] += d[j] * al; acc[j + 1] += d[j + 1] * al; acc[j + 2] += d[j + 2] * al; acc[j + 3] += al; }
  }
  const img = new ImageData(W, H), o = img.data;
  for (let j = 0; j < acc.length; j += 4) { const al = acc[j + 3]; if (al === 0) continue; o[j] = acc[j] / al + 0.5; o[j + 1] = acc[j + 1] / al + 0.5; o[j + 2] = acc[j + 2] / al + 0.5; o[j + 3] = al / n + 0.5; }
  _out.getContext('2d').putImageData(img, 0, 0); g.drawImage(_out, 0, 0);
}

// ---------- H <-> B mini-graphic: a hardness track, the knob slides to B (more graphite) then to H (more clay) ----------
export function hbSlider(g, t, { at, until, toB, soft, dark, toH, hard, light, y = 520 }) {
  const a = t - at, r = until - t; if (a < 0 || r < 0) return;
  const out = E.i(clamp(1 - r / 0.12)), wd = 640, x0 = SAFE.cx - wd / 2, grow = sp(a, 'pos');
  g.save(); g.globalAlpha = 1 - out; g.translate(0, -out * 30); g.lineJoin = 'round'; g.lineCap = 'round';
  softPlate(g, SAFE.cx, y + 40, wd + 140, 270, 0.32 * clamp(a / 0.1));
  // gradient track (light grey H -> black B), draws out from the centre
  const hw = wd / 2 * grow; const gr = g.createLinearGradient(x0, 0, x0 + wd, 0); gr.addColorStop(0, '#C9CDD3'); gr.addColorStop(0.5, '#6E737C'); gr.addColorStop(1, '#16181C');
  g.lineWidth = 34; g.strokeStyle = C.ink; g.beginPath(); g.moveTo(SAFE.cx - hw, y); g.lineTo(SAFE.cx + hw, y); g.stroke();
  g.lineWidth = 24; g.strokeStyle = gr; g.beginPath(); g.moveTo(SAFE.cx - hw, y); g.lineTo(SAFE.cx + hw, y); g.stroke();
  // grade labels
  const lab = (txt, x, i, col) => { const s = sp(a - 0.08 - 0.05 * i, 'scl'); g.save(); g.translate(x, y - 58); g.scale(s, s); g.font = `400 64px ${F.title}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; inkText(g, txt, 0, 0, col, 64, 0.16); g.restore(); };
  lab('H', x0, 0, '#D5D9DE'); lab('HB', SAFE.cx, 1, C.cream); lab('B', x0 + wd, 2, '#FFFFFF');
  // knob position: centre -> B -> H, springs with overshoot
  const pB = sp(t - toB, 'pos'), pH = sp(t - toH, 'pos'); const kx = SAFE.cx + (wd / 2) * (t < toB ? 0 : pB) - wd * (t < toH ? 0 : pH);
  const kk = sp(a - 0.15, 'scl'), squash = 1 + 0.25 * Math.abs(spring(t - toB, 3, 8) - pB) + 0.25 * Math.abs(spring(t - toH, 3, 8) - pH);
  g.save(); g.translate(kx, y); g.scale(kk * squash, kk / squash);
  g.fillStyle = C.accent; g.shadowColor = C.accent; g.shadowBlur = 20; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill(); g.shadowBlur = 0; g.lineWidth = 7; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.restore();
  if (t > toB) specks(g, t, { at: toB + 0.25, x: SAFE.cx + wd / 2, y, n: 9, kind: 'graphite', dir: -Math.PI / 2, spread: 2.4, speed: 360, seed: 51 });
  if (t > toH) specks(g, t, { at: toH + 0.25, x: x0, y, n: 9, kind: 'graphite', dir: -Math.PI / 2, spread: 2.4, speed: 360, seed: 53 });
  // two-line read-out under the track: MORE GRAPHITE -> SOFTER · DARKER, MORE CLAY -> HARDER · LIGHTER
  const side = t >= toH ? 'H' : 'B', t0 = side === 'H' ? toH : toB;
  if (t >= toB) {
    const words = side === 'B' ? [['MORE GRAPHITE', toB, C.cream], ['SOFTER', soft, C.accent], ['DARKER', dark, C.accent]] : [['MORE CLAY', toH, C.cream], ['HARDER', hard, C.accent], ['LIGHTER', light, C.accent]];
    const sw = t - t0 < 0.12 && side === 'H' ? 1 - (t - t0) / 0.12 : 1;
    g.font = `400 52px ${F.cap}`; g.textBaseline = 'middle'; g.textAlign = 'center';
    const [w1, a1, c1] = words[0], ax = side === 'B' ? 1 : -1;
    const k1 = t - a1; if (k1 >= 0) { const T = { p: sp(k1, 'pos') }; g.save(); g.translate(SAFE.cx - ax * 560 * (1 - T.p), y + 92); g.transform(1, 0, -ax * 0.5 * (1 - spring(k1, 3.6, 11)), 1, 0, 0); inkText(g, w1, 0, 0, c1, 52, 0.22); g.restore(); }
    const pair = [words[1], words[2]]; g.font = `400 58px ${F.cap}`;
    pair.forEach(([w, at2, col], i) => { const k2 = t - at2; if (k2 < 0) return; const s = k2 < 0.045 ? lerp(0.9, 0.86, k2 / 0.045) : lerp(0.86, 1, sp(k2 - 0.045, 'scl'));
      g.save(); g.translate(SAFE.cx + (i ? 1 : -1) * 170, y + 168); g.scale(s, s); inkText(g, w, 0, 0, col, 58, 0.22, 8); g.restore(); });
  }
  g.restore();
}
