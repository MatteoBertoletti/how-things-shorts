// LONG 02: zipper diagrams on the LONG 01 2D layer (episodes/long01_pencil/d2.js primitives, palette and grade).
// Top-down plan view: tapes left / right, teeth reach across to the centre line; every diagram moves (L2).
import { W, H, clamp, lerp, E, hash } from '../../js/core.js';
import { P, FONT, path, fillPoly, rr, pop, label, typed, arrow, chip, bgGraphite, bgPaper } from '../long01_pencil/d2.js';
const TAU = Math.PI * 2;
export const Z = { brass: '#D9A441', brassD: '#8A6420', brassL: '#F1CF7A', tape: '#3B4E6E', tapeD: '#22304A', glow: '#BFE6FF', red: '#FF5A4A' };

// one tooth seen from above: stem from the tape edge, head (wider) at the tip. side -1 = left row (points right)
export function tooth(g, x, y, side, { p = 46, reach = 120, col = Z.brass, a = 1, glow = 0, tilt = 0 } = {}) {
  const neck = p * 0.36, head = p * 0.6, hl = p * 0.62;
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(tilt); g.scale(side, 1);
  if (glow) { g.shadowColor = Z.glow; g.shadowBlur = 30 * glow; }
  const pts = [[0, -neck / 2], [-(reach - hl), -neck / 2], [-(reach - hl) - 8, -head / 2], [-reach, -head / 2 + 6], [-reach, head / 2 - 6], [-(reach - hl) - 8, head / 2], [-(reach - hl), neck / 2], [0, neck / 2]];
  const gr = g.createLinearGradient(0, -head / 2, 0, head / 2); gr.addColorStop(0, Z.brassL); gr.addColorStop(0.5, col); gr.addColorStop(1, Z.brassD);
  g.fillStyle = gr; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill();
  g.lineWidth = 3; g.strokeStyle = 'rgba(16,20,24,0.8)'; g.stroke();
  // the bump (nib) seen from above: a small dome on the head
  g.fillStyle = 'rgba(255,240,200,0.55)'; g.beginPath(); g.arc(-(reach - hl / 2) + 4, 0, head * 0.18, 0, TAU); g.fill();
  g.restore();
}
function tape(g, x0, x1, y0, y1, col = Z.tape) { g.save(); g.fillStyle = col; g.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
  g.globalAlpha = 0.18; g.strokeStyle = '#9fb3d0'; g.lineWidth = 1; for (let y = y0; y < y1; y += 7) { g.beginPath(); g.moveTo(Math.min(x0, x1), y); g.lineTo(Math.max(x0, x1), y); g.stroke(); } g.restore(); }
// a pair of rows (plan view). open = distance each row is pulled away from the centre; shift = offset of the right row in pitches (0.5 = interleaved)
export function rows(g, cx, y0, n, { p = 46, open = 0, shift = 0.5, reach = 120, glowAt = null, scroll = 0, tilt = null, col = Z.brass } = {}) {
  const tw = 120, hl = p * 0.62, xbL = cx + hl / 2 - reach - open, xbR = cx - hl / 2 + reach + open;   // tooth bases (tape edges)
  tape(g, xbL - tw, xbL + 14, y0 - p, y0 + n * p + p); tape(g, xbR - 14, xbR + tw, y0 - p, y0 + n * p + p);
  for (let i = -1; i <= n; i++) {
    const yl = y0 + i * p + (scroll % p), yr = yl + shift * p;
    if (yl > y0 - p * 0.5 && yl < y0 + n * p + p * 0.5) tooth(g, xbL, yl, -1, { p, reach, col, glow: glowAt ? glowAt(-1, yl) : 0, tilt: tilt ? tilt(-1, yl) : 0 });
    if (yr > y0 - p * 0.5 && yr < y0 + n * p + p * 0.5) tooth(g, xbR, yr, 1, { p, reach, col, glow: glowAt ? glowAt(1, yr) : 0, tilt: tilt ? tilt(1, yr) : 0 });
  }
}
const bg = (g, t, o) => bgGraphite(g, t, o);

// ---------- HOOK promise beat: two short rows slide in, shifted ----------
export function promiseRows(g, t, a) {
  bg(g, t); const k = E.o(clamp(a / 0.9)), sh = 0.5 * E.io(clamp((a - 0.9) / 0.8));
  rows(g, 1300, 300, 8, { open: lerp(400, 60, k), shift: sh, scroll: a * 10 });
}
// ---------- CH. 1 offset diagram: the right row slides by half a step until every tooth faces a gap ----------
export function offsetRows(g, t, a) {
  bg(g, t); const sh = 0.5 * E.io(clamp((a - 0.6) / 1.2));
  const p = 82, y0 = 210; rows(g, 960, y0, 9, { p, open: lerp(80, 0, E.io(clamp((a - 1.9) / 0.8))), shift: sh, reach: 180 });
  // guides from each left tooth across: they end in a gap once shifted
  for (let i = 0; i < 9; i++) { const y = y0 + i * p; path(g, [[620, y], [1300, y]], clamp((a - 0.2 - i * 0.04) / 0.4), { w: 3, col: P.cold, dash: [12, 9], alpha: 0.75 }); }
  if (a > 1.9) { const y = y0 + 4 * p; path(g, [[1340, y], [1340, y + p / 2]], clamp((a - 1.9) / 0.3), { w: 8, col: P.acc }); typed(g, 'HALF A TOOTH', 1370, y + p / 4, a - 2.1, { size: 34, col: P.acc }); }
}
// ---------- CH. 1 head-on vs shifted ----------
export function headOn(g, t, a, { shiftAt = 2.4 } = {}) {
  bg(g, t); const sh = a < shiftAt ? 0 : 0.5 * E.io(clamp((a - shiftAt) / 0.6));
  const close = a < shiftAt ? E.i(clamp((a - 0.3) / 1.2)) : 1, hit = a > 1.5 && a < shiftAt;
  const open = lerp(160, sh > 0.25 ? -100 * E.o(clamp((a - shiftAt - 0.5) / 0.6)) + 0 : 0, close);
  g.save(); if (hit) g.translate(4 * Math.sin(a * 80) * Math.exp(-(a - 1.5) * 6), 0);
  rows(g, 960, 300, 9, { p: 52, open: Math.max(-110, open), shift: sh, reach: 130 }); g.restore();
  if (hit) { g.save(); g.globalAlpha = 0.5 * Math.exp(-(a - 1.5) * 3); g.fillStyle = Z.red; g.fillRect(0, 0, W, H); g.restore(); label(g, 'HEAD-ON', 960, 160, a - 1.5, { size: 54, col: Z.red }); }
  if (sh > 0.2) label(g, 'SHIFTED: EACH ONE FITS', 960, 160, a - shiftAt - 0.4, { size: 54, col: P.acc });
}
// ---------- TYPE background: a slow mini chain under a kinetic line ----------
export function miniChain(g, t, a, { y = 760, scroll = 40 } = {}) {
  bg(g, t, { tone: 1 }); g.save(); g.translate(960, y); g.rotate(-Math.PI / 2); g.translate(-960, -y); g.globalAlpha = 0.85;
  rows(g, 960, y - 900, 40, { p: 44, open: 0, shift: 0.5, reach: 110, scroll: t * scroll }); g.restore();
  g.fillStyle = 'rgba(30,36,46,0.45)'; g.fillRect(0, 0, W, H);
}
// ---------- CH. 2 why it holds: the head is wider than the gap it sits in; sideways pull, nothing moves ----------
export function holdSideways(g, t, a) {
  bg(g, t); const pull = a > 2.6 ? Math.sin((a - 2.6) * 6) * 3 * Math.exp(-(a - 2.6)) : 0;
  g.save(); g.translate(0, 0); rows(g, 960, 270, 10, { p: 56, open: pull, shift: 0.5, reach: 140 }); g.restore();
  // dimension: head vs gap
  if (a > 0.5) { const y = 270 + 4 * 56 + 28, x = 960 + 30; const k = clamp((a - 0.5) / 0.4);
    path(g, [[x + 18, y - 17], [x + 18, y + 17]], k, { w: 5, col: P.acc }); typed(g, 'HEAD', x + 34, y, a - 0.7, { size: 26, col: P.acc });
    path(g, [[x - 70, y - 28 + 12], [x - 70, y + 28 - 12]], clamp((a - 1.0) / 0.4), { w: 5, col: P.cold }); typed(g, 'GAP', x - 160, y, a - 1.2, { size: 26, col: P.cold }); }
  if (a > 2.4) { const k = clamp((a - 2.4) / 0.5); arrow(g, 640, 540, 360, 540, k, { col: Z.red, w: 12, head: 34 }); arrow(g, 1280, 540, 1560, 540, k, { col: Z.red, w: 12, head: 34 });
    label(g, 'NOTHING SLIDES OUT', 960, 930, a - 3.0, { size: 46, col: P.cream }); }
}
// ---------- CH. 2 push straight together: heads hit heads, jam ----------
export function pushStraight(g, t, a) {
  bg(g, t); const k = E.i(clamp((a - 0.4) / 1.4)), jam = a > 1.8;
  const open = jam ? 22 + 6 * Math.abs(Math.sin((a - 1.8) * 30)) * Math.exp(-(a - 1.8) * 5) : lerp(220, 22, k);
  // shifted rows, but pushed flat: the wide heads meet the narrow necks on the way in
  rows(g, 960, 300, 9, { p: 52, open: open + 90, shift: 0.5, reach: 130 });
  arrow(g, 260, 540, 520 - (jam ? 0 : 0), 540, clamp((a - 0.2) / 0.5), { col: P.acc, w: 12, head: 34 }); arrow(g, 1660, 540, 1400, 540, clamp((a - 0.2) / 0.5), { col: P.acc, w: 12, head: 34 });
  if (jam) { g.save(); g.globalAlpha = 0.45 * Math.exp(-(a - 1.8) * 3); g.fillStyle = Z.red; g.fillRect(0, 0, W, H); g.restore(); label(g, 'JAM', 960, 170, a - 1.8, { size: 90, col: Z.red }); }
}
// ---------- CH. 3 the Y, top-down section ----------
function yOutline(g, cx, cy, s, prog, { w = 10, col = P.cold, glow = 18 } = {}) {
  const L = [[cx - 360 * s, cy - 330 * s], [cx - 150 * s, cy + 40 * s], [cx - 70 * s, cy + 330 * s]], R = L.map(([x, y]) => [2 * cx - x, y]);
  path(g, L, prog, { w, col, glow }); path(g, R, prog, { w, col, glow });
  const D = [[cx, cy - 330 * s], [cx - 50 * s, cy - 120 * s], [cx, cy - 20 * s], [cx + 50 * s, cy - 120 * s]];
  path(g, D, clamp(prog * 1.3 - 0.3), { w, col: P.acc, close: true, glow });
  return { L, R, D };
}
export function ySection(g, t, a) {
  bg(g, t); const cx = 960, cy = 520;
  yOutline(g, cx, cy, 1, clamp(a / 1.2));
  // teeth streaming down the two arms and meeting at the bottom
  if (a > 1.0) for (let i = 0; i < 14; i++) { const u = ((a - 1.0) * 0.32 + i / 14) % 1; for (const sd of [-1, 1]) {
    const x = cx + sd * lerp(300, 26, Math.pow(u, 0.8)), y = lerp(cy - 280, cy + 360, u);
    tooth(g, x + sd * 40, y + (sd > 0 ? 18 : 0), sd, { p: 36, reach: 90, a: clamp((a - 1.0) * 2) * (u < 0.92 ? 1 : (1 - u) / 0.08), glow: u > 0.55 ? 0.6 : 0 }); } }
  typed(g, 'IN', cx - 470, cy - 300, a - 1.4, { size: 34, col: P.cold }); typed(g, 'IN', cx + 420, cy - 300, a - 1.6, { size: 34, col: P.cold });
  typed(g, 'OUT', cx + 120, cy + 380, a - 2.4, { size: 34, col: P.cold }); typed(g, 'DIVIDER', cx + 90, cy - 230, a - 3.2, { size: 34, col: P.acc });
}
// ---------- CH. 3 tilt: a tilted tooth clears the head ahead, then straightens ----------
export function tiltDiagram(g, t, a, { clickAt = 99 } = {}) {
  bg(g, t); const cy = 540, x0 = 960;
  // side view: the row ahead (fixed) and the incoming tooth rotating in
  for (let i = 0; i < 3; i++) tooth(g, x0 - 60 + 0, cy - 220 + i * 120, -1, { p: 70, reach: 260, a: 0.55 });
  const u = clamp((a - 0.6) / Math.min(2.6, clickAt - 0.7)), ang = u < 0.6 ? lerp(-0.5, -0.28, u / 0.6) : lerp(-0.28, 0, E.o((u - 0.6) / 0.4));
  const y = lerp(cy - 160, cy - 160 + 60, E.io(u)), click = a > clickAt;
  tooth(g, x0 + 260, y, 1, { p: 70, reach: 260, tilt: ang, glow: click ? 1 : 0.3 });
  if (a > 0.8 && !click) { g.save(); g.strokeStyle = P.acc; g.lineWidth = 5; g.setLineDash([8, 8]); g.beginPath(); g.arc(x0 + 260, y, 120, Math.PI - 0.1, Math.PI - 0.1 + ang * -1.6, ang < 0); g.stroke(); g.restore(); typed(g, 'TILT', x0 + 120, y - 150, a - 1.0, { size: 34, col: P.acc }); }
  if (u > 0.2 && u < 0.7) typed(g, 'CLEARS THE HEAD', 1180, 280, a - 1.4, { size: 30, col: P.cold });
  if (click) { const k = a - clickAt; g.save(); g.globalAlpha = 0.6 * Math.exp(-k * 4); g.strokeStyle = Z.glow; g.lineWidth = 8; g.beginPath(); g.arc(x0 + 30, y, 40 + 200 * k, 0, TAU); g.stroke(); g.restore(); label(g, 'CLICK', 1400, 760, k, { size: 70, col: P.acc }); }
}
// ---------- CH. 3 the walls push: arrows on the converging walls ----------
export function yForces(g, t, a) {
  bg(g, t); const cx = 960, cy = 520; const { L, R } = yOutline(g, cx, cy, 1, 1, { glow: 10 });
  rows(g, cx, cy + 120, 5, { p: 40, open: 0, shift: 0.5, reach: 100, scroll: a * 30 });
  for (let i = 0; i < 3; i++) { const u = 0.25 + i * 0.22, k = clamp((a - 0.4 - i * 0.35) / 0.5);
    const lx = lerp(L[0][0], L[1][0], u), ly = lerp(L[0][1], L[1][1], u), rx = 2 * cx - lx;
    arrow(g, lx - 120, ly - 10, lx + 30, ly + 30, k, { col: P.acc, w: 10, head: 28 }); arrow(g, rx + 120, ly - 10, rx - 30, ly + 30, k, { col: P.acc, w: 10, head: 28 }); }
  label(g, 'SAME ANGLE, EVERY TIME', 960, 940, a - 2.2, { size: 42, col: P.cream });
}
// ---------- CH. 4 the wedge stays between the last two teeth ----------
export function wedgeStays(g, t, a) {
  bg(g, t); const cx = 960, cy = 560;
  rows(g, cx, cy, 6, { p: 50, open: 0, shift: 0.5, reach: 120 });
  // top: the last two teeth open around the wedge, the slider outline
  const k = clamp((a - 0.4) / 0.8); fillPoly(g, [[cx, cy - 210], [cx - 46, cy - 60], [cx, cy - 20], [cx + 46, cy - 60]], P.acc, k);
  tooth(g, cx - 90, cy - 70, -1, { p: 50, reach: 120, tilt: -0.18 }); tooth(g, cx + 90, cy - 45, 1, { p: 50, reach: 120, tilt: 0.18 });
  path(g, [[cx - 330, cy - 330], [cx - 150, cy - 10], [cx - 80, cy + 60]], k, { w: 8, col: P.cold }); path(g, [[cx + 330, cy - 330], [cx + 150, cy - 10], [cx + 80, cy + 60]], k, { w: 8, col: P.cold });
  if (a > 1.4) { g.save(); g.strokeStyle = P.acc; g.lineWidth = 6; g.beginPath(); g.ellipse(cx, cy - 70, 160 + 6 * Math.sin(a * 4), 90, 0, 0, TAU * clamp((a - 1.4) / 0.5)); g.stroke(); g.restore(); }
  label(g, 'NEVER COMPLETELY CLOSED', 960, 940, a - 3.0, { size: 48, col: P.acc });
}
// ---------- TYPE background: up / down ----------
export function upDown(g, t, a, { downAt = 2.0 } = {}) {
  bg(g, t, { tone: 1 }); const cx = 960, cy = 560;
  yOutline(g, cx, cy, 0.7, 1, { w: 8 });
  const up = a < downAt; const k = up ? clamp(a / 0.5) : clamp((a - downAt) / 0.5);
  arrow(g, 1500, up ? 760 : 320, 1500, up ? 320 : 760, k, { col: up ? P.cold : P.acc, w: 16, head: 44 });
}
// ---------- CH. 5 how each kind is made: three icon lines ----------
export function howMade(g, t, a) {
  bg(g, t);
  const row = (y, d, txt, icon) => { const k = clamp((a - d) / 0.4); if (k <= 0) return; g.save(); g.globalAlpha = k; g.translate(lerp(-60, 0, E.o(k)), 0); icon(y, a - d); g.restore(); label(g, txt, 1240, y, a - d - 0.1, { size: 44, align: 'left' }); };
  row(300, 0.2, 'WOUND + SEWN ON', (y, b) => { g.strokeStyle = '#EDE3CE'; g.lineWidth = 9; g.beginPath(); for (let i = 0; i <= 200; i++) { const u = i / 200 * clamp(b / 1.2), x = 420 + u * 640, yy = y + 34 * Math.sin(u * 40); i ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); });
  row(540, 0.9, 'MOLDED ONTO THE TAPE', (y, b) => { tape(g, 420, 1060, y + 30, y + 60, Z.tapeD); for (let i = 0; i < 8; i++) { const k = clamp((b - i * 0.12) / 0.2); if (k <= 0) continue; g.fillStyle = '#7FB3D9'; rr(g, 440 + i * 78, y - 40 + 40 * (1 - E.back(k)), 52, 70, 12); g.fill(); } });
  row(780, 1.6, 'CUT, STAMPED, CLAMPED', (y, b) => { g.strokeStyle = Z.brass; g.lineWidth = 16; g.beginPath(); g.moveTo(420, y); g.lineTo(620, y); g.stroke(); for (let i = 0; i < 5; i++) { const k = clamp((b - i * 0.18) / 0.25); if (k <= 0) continue; tooth(g, 700 + i * 80, y, -1, { p: 50, reach: 70 }); } });
}
// ---------- CH. 5 timeline ----------
export function timeline(g, t, a, { marks }) {
  bg(g, t); const y = 560, x0 = 260, x1 = 1660; path(g, [[x0, y], [x1, y]], clamp(a / 0.8), { w: 8, col: P.cold });
  marks.forEach((m, i) => { const ma = a - m.at; if (ma <= 0) return; const x = lerp(x0, x1, m.u); chip(g, m.year, x, y, ma, { size: 40 }); label(g, m.txt, x, i % 2 ? y + 130 : y - 130, ma - 0.2, { size: 38, col: m.col || P.cream }); });
}
// ---------- CH. 6 cascade: each tooth loses its neighbour and lets go ----------
export function cascade(g, t, a) {
  bg(g, t); const y0 = 200, n = 12, p = 52, miss = 6, cx = 960;
  const R = 52 * 1.2 * Math.max(0, a - 0.5);
  const openAt = (yy) => { const d = Math.abs(yy - (y0 + miss * p)); return clamp((R - d) / 60) * 120; };
  tape(g, cx - 330, cx - 175, y0 - p, y0 + n * p); tape(g, cx + 175, cx + 330, y0 - p, y0 + n * p);
  for (let i = 0; i < n; i++) { const yl = y0 + i * p, yr = yl + p / 2;
    if (i !== miss) tooth(g, cx - 65 - openAt(yl), yl, -1, { p, reach: 130 }); else if (a < 0.4) tooth(g, cx - 65, yl, -1, { p, reach: 130, a: 1 - a / 0.4 });
    tooth(g, cx + 65 + openAt(yr), yr, 1, { p, reach: 130 }); }
  if (a > 0.3) { g.save(); g.strokeStyle = Z.red; g.lineWidth = 6; g.setLineDash([10, 8]); rr(g, cx - 140, y0 + miss * p - 30, 150, 60, 12); g.stroke(); g.restore(); typed(g, 'MISSING', cx - 520, y0 + miss * p, a - 0.5, { size: 32, col: Z.red }); }
}
// ---------- CH. 6 the fix: squeeze the slider plates, gently ----------
export function squeeze(g, t, a) {
  bg(g, t); const cx = 960, cy = 520; const k = E.io(clamp((a - 1.0) / 1.6)), gap = lerp(70, 34, k);
  // side view of the slider: two plates with the chain between
  g.save(); g.fillStyle = '#C9CED6'; rr(g, cx - 330, cy - gap - 60, 660, 60, 20); g.fill(); rr(g, cx - 330, cy + gap, 660, 60, 20); g.fill();
  g.fillStyle = '#8E98A6'; rr(g, cx + 240, cy - gap - 4, 60, gap * 2 + 8, 10); g.fill(); g.restore();
  for (let i = 0; i < 9; i++) { g.fillStyle = Z.brass; rr(g, cx - 300 + i * 66, cy - 16, 46, 32, 8); g.fill(); }
  const ak = clamp((a - 0.6) / 0.5); arrow(g, cx - 100, cy - 300, cx - 100, cy - gap - 70, ak, { col: P.acc, w: 12, head: 32 }); arrow(g, cx - 100, cy + 300, cx - 100, cy + gap + 70, ak, { col: P.acc, w: 12, head: 32 });
  label(g, 'GENTLY', cx + 420, cy - 260, a - 1.6, { size: 54, col: P.acc });
  if (a > 2.8) label(g, 'TEETH LOCK AGAIN', cx, 940, a - 2.8, { size: 46, col: P.cream });
}
// ---------- TYPE background: pencil on the teeth (callback) ----------
export function pencilRub(g, t, a) {
  bg(g, t, { tone: 1 }); g.save(); g.translate(960, 640); g.rotate(-0.2); rows(g, 0, -240, 9, { p: 52, open: 0, shift: 0.5, reach: 120 }); g.restore();
  const u = (a * 0.8) % 1, x = lerp(700, 1220, Math.abs(u * 2 - 1)), y = 520 + 40 * Math.sin(a * 5);
  g.save(); g.translate(x, y); g.rotate(-0.9); g.fillStyle = '#FFD23A'; g.fillRect(-20, -300, 40, 260); g.fillStyle = '#E39A52'; g.beginPath(); g.moveTo(-20, -40); g.lineTo(0, 10); g.lineTo(20, -40); g.fill(); g.fillStyle = '#2A2E36'; g.beginPath(); g.moveTo(-6, -4); g.lineTo(0, 10); g.lineTo(6, -4); g.fill(); g.restore();
  for (let i = 0; i < 40; i++) { const px = 700 + hash(i * 3.7) * 520, py = 480 + hash(i * 1.3) * 140, k = clamp((a - hash(i * 5) * 2) / 0.3); if (k <= 0) continue; g.fillStyle = `rgba(60,64,72,${0.6 * k})`; g.beginPath(); g.arc(px, py, 3 + 3 * hash(i), 0, TAU); g.fill(); }
}
export { bgGraphite, bgPaper };
