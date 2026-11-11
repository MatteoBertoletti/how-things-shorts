// 2D overlay: HUD, captions, step stickers, hook title, end card. Pure functions of time.
import { W, H, clamp, E, lerp } from './core.js';

export const C = { cream: '#F3E9D2', ink: '#101418', navy: 'rgba(14,26,43,0.55)', accent: '#FF5A1F', green: '#2BD67B', red: '#FF3B3B', cyan: '#5EC8E5' };
// Shorts safe area (1080x1920 frame). iPhone crops ~50 px per side; the top bar covers ~230 px;
// the action icons cover x > 870 between y 900 and 1870; channel name + title sit below ~1600.
export const SAFE = { top: 250, left: 70, right: 870, bottom: 1560, cx: 470, maxW: 790 };
// per-episode accent (the fixed channel language stays, only the accent colour changes)
export function setAccent(c) { C.accent = c; }
const F = { mono: '"JBMono"', title: '"Anton"', cap: '"Archivo Black"' };

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

export function hud(g, { ep, step, nSteps, stepName, label, value, total, text, flag, progress, from, to, alpha = 1 }) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha;
  const x = SAFE.left, y = SAFE.top;
  g.fillStyle = C.navy; rr(g, x, y, 520, 214, 16); g.fill();
  g.strokeStyle = 'rgba(243,233,210,0.18)'; g.lineWidth = 2; g.stroke();
  g.textBaseline = 'top'; g.fillStyle = C.cream;
  g.font = `800 34px ${F.mono}`; g.fillText(ep, x + 24, y + 20);
  g.fillStyle = C.accent; g.beginPath(); g.arc(x + 494, y + 38, 8, 0, 7); g.fill();
  g.fillStyle = C.cream; g.font = `700 29px ${F.mono}`;
  g.fillText(step > 0 ? `STEP ${step}/${nSteps} · ${stepName}` : `STEP -/${nSteps} · ${stepName}`, x + 24, y + 68);
  g.font = `400 27px ${F.mono}`; const lab = `${label} `; g.fillText(lab, x + 24, y + 112);
  const lw = g.measureText(lab).width;
  if (text !== undefined) { g.font = `800 27px ${F.mono}`; g.fillStyle = C.accent; g.fillText(text, x + 24 + lw, y + 112); }
  else {
    g.font = `800 27px ${F.mono}`; g.fillStyle = C.accent;
    const vs = String(Math.round(value)).padStart(3, '0'); g.fillText(vs, x + 24 + lw, y + 112);
    const vw = g.measureText(vs).width; g.fillStyle = C.cream; g.font = `400 27px ${F.mono}`; g.fillText(`/${total}`, x + 24 + lw + vw, y + 112);
  }
  if (flag) {
    g.font = `800 22px ${F.mono}`; const fw = g.measureText(flag).width;
    g.fillStyle = C.accent; rr(g, x + 520 + 14, y + 104, fw + 24, 40, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = C.ink; g.fillText(flag, x + 520 + 26, y + 113);
  }
  // progress bar
  const bx = x + 24, by = y + 168, bw = 472;
  g.fillStyle = 'rgba(243,233,210,0.22)'; g.fillRect(bx, by, bw, 6);
  g.fillStyle = C.accent; g.fillRect(bx, by, bw * clamp(progress), 6);
  g.fillStyle = C.cream; g.fillRect(bx + bw * clamp(progress) - 2, by - 5, 4, 16);
  g.font = `700 18px ${F.mono}`; g.globalAlpha = alpha * 0.8; g.fillText(from, bx, by + 14);
  const tw = g.measureText(to).width; g.fillText(to, bx + bw - tw, by + 14);
  g.restore();
}

// words: [{t:'BUMP', a:false, at: time}], one line, auto-fit
export function caption(g, t, { at, until, words, y = 1290, size = 104, cx = SAFE.cx, maxW = SAFE.maxW }) {
  if (t < at || t > until) return;
  const age = t - at, left = until - t;
  const s = lerp(0.82, 1, E.back(clamp(age / 0.14))) * (left < 0.08 ? lerp(0.9, 1, left / 0.08) : 1);
  const vis = words.filter(w => w.at === undefined || t >= w.at);
  if (!vis.length) return;
  g.save(); g.textBaseline = 'middle';
  let fs = size; g.font = `400 ${fs}px ${F.cap}`;
  const full = words.map(w => w.t).join(' ');
  while (g.measureText(full).width > maxW && fs > 44) { fs -= 4; g.font = `400 ${fs}px ${F.cap}`; }
  const sp = g.measureText(' ').width, widths = words.map(w => g.measureText(w.t).width);
  const tot = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  g.translate(cx, y); g.scale(s, s);
  let xx = -tot / 2;
  g.lineJoin = 'round'; g.miterLimit = 2;
  words.forEach((w, i) => {
    const shown = w.at === undefined || t >= w.at;
    if (shown) {
      const pa = w.at === undefined ? 1 : E.back(clamp((t - w.at) / 0.12));
      g.save(); g.translate(xx + widths[i] / 2, 0); g.scale(lerp(0.7, 1, pa), lerp(0.7, 1, pa));
      g.lineWidth = fs * 0.2; g.strokeStyle = C.ink; g.strokeText(w.t, -widths[i] / 2, 0);
      g.fillStyle = w.a ? C.accent : C.cream; g.fillText(w.t, -widths[i] / 2, 0);
      g.restore();
    }
    xx += widths[i] + sp;
  });
  g.restore();
}

export function sticker(g, t, { at, n, word, hold = 1.7, wobble = false }) {
  const age = t - at; if (age < 0 || age > hold + 0.25) return;
  const inU = E.back(clamp(age / 0.26)), outU = E.i(clamp((age - hold) / 0.22));
  const wob = wobble ? Math.sin(age * 9) * Math.exp(-age * 1.2) : 0;
  g.save();
  g.translate(lerp(-700, SAFE.cx, inU) + outU * 30, 650 - outU * 900);
  g.rotate((-6 + (1 - inU) * -10 + wob * 3) * Math.PI / 180); if (wobble) { const ss = 1 + 0.03 * Math.sin(age * 6); g.scale(ss, ss); }
  g.font = `400 168px ${F.title}`; const tw = g.measureText(word).width;
  const w = Math.max(430, tw + 100), h = 250;
  g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -w / 2 + 12, -h / 2 + 14, w, h, 22); g.fill();
  g.fillStyle = C.cream; rr(g, -w / 2, -h / 2, w, h, 22); g.fill();
  g.lineWidth = 7; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.ink; g.textBaseline = 'top'; g.font = `800 32px ${F.mono}`; g.fillText(`STEP ${n}`, -w / 2 + 30, -h / 2 + 22);
  g.fillStyle = C.accent; g.fillRect(-w / 2 + 30 + g.measureText(`STEP ${n}`).width + 14, -h / 2 + 36, 46, 6);
  g.fillStyle = C.ink; g.textBaseline = 'alphabetic'; g.font = `400 168px ${F.title}`; g.fillText(word, -tw / 2, h / 2 - 34);
  g.restore();
}

export function hookTitle(g, t, { at, until, l1, l2, from = -1e9, y = 1080 }) {
  if (t < at || t > until || t < from) return;
  const u = E.back(clamp((t - at) / 0.18)), o = clamp((until - t) / 0.08);
  g.save(); g.translate(SAFE.cx, y); g.scale(lerp(0.8, 1, u) * o, lerp(0.8, 1, u) * o);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  let f1 = 96; g.font = `400 ${f1}px ${F.cap}`; while (g.measureText(l1).width > SAFE.maxW && f1 > 40) { f1 -= 4; g.font = `400 ${f1}px ${F.cap}`; }
  g.lineWidth = f1 * 0.23; g.strokeStyle = C.ink; g.strokeText(l1, 0, 0); g.fillStyle = C.cream; g.fillText(l1, 0, 0);
  let f2 = 300; g.font = `400 ${f2}px ${F.title}`; while (g.measureText(l2).width > SAFE.maxW && f2 > 80) { f2 -= 6; g.font = `400 ${f2}px ${F.title}`; }
  g.lineWidth = f2 * 0.1; g.strokeText(l2, 0, f2 * 0.97); g.fillStyle = C.accent; g.fillText(l2, 0, f2 * 0.97);
  g.restore();
}

export function pill(g, x, y, text, color, u) {
  if (u <= 0) return;
  g.save(); g.translate(x, y); const s = lerp(0.6, 1, E.back(clamp(u))); g.scale(s, s); g.globalAlpha = clamp(u * 3);
  g.font = `400 44px ${F.cap}`; const tw = g.measureText(text).width; const w = tw + 56, h = 84;
  g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -w / 2 + 8, -h / 2 + 10, w, h, 48); g.fill();
  g.fillStyle = color; rr(g, -w / 2, -h / 2, w, h, 48); g.fill(); g.lineWidth = 6; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.ink; g.textBaseline = 'middle'; g.fillText(text, -tw / 2, 4);
  g.restore();
}

export function endCard(g, t, { at, comment, follow, until, left, right, next }) {
  if (t < at || t > until) return;
  const fade = clamp((until - t) / 0.15);
  g.save(); g.globalAlpha = fade;
  const u = E.back(clamp((t - at) / 0.25));
  g.textAlign = 'center'; g.lineJoin = 'round';
  g.save(); g.translate(540, 470); g.scale(lerp(0.7, 1, u), lerp(0.7, 1, u));
  let ft = 170; g.font = `400 ${ft}px ${F.title}`; while (g.measureText('NEXT EPISODE?').width > 860) { ft -= 4; g.font = `400 ${ft}px ${F.title}`; } g.lineWidth = 24; g.strokeStyle = C.ink; g.strokeText('NEXT EPISODE?', 0, 0); g.fillStyle = C.cream; g.fillText('NEXT EPISODE?', 0, 0);
  g.restore();
  g.textAlign = 'left';
  pill(g, 255, 1235, left, C.green, (t - at - 0.25) / 0.2);
  pill(g, 690, 1235, right, C.red, (t - at - 0.4) / 0.2);
  g.textAlign = 'left';
  if (t >= comment) caption(g, t, { at: comment, until: until + 1, words: [{ t: 'COMMENT' }, { t: 'BELOW', a: true }], y: 1375, size: 90 });
  if (t >= follow) {
    const v = E.back(clamp((t - follow) / 0.2));
    g.save(); g.translate(SAFE.cx, 1490); g.scale(lerp(0.7, 1, v), lerp(0.7, 1, v)); g.textAlign = 'center';
    g.font = `800 50px ${F.mono}`; const txt = `FOLLOW FOR ${next}`; const tw = g.measureText(txt).width;
    g.fillStyle = C.accent; rr(g, -tw / 2 - 34, -50, tw + 68, 88, 16); g.fill(); g.lineWidth = 6; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = C.ink; g.textBaseline = 'middle'; g.fillText(txt, 0, -4);
    g.restore();
  }
  g.restore();
}

export function flash(g, a, color = 'rgba(255,59,59,') { if (a <= 0) return; g.fillStyle = color + a + ')'; g.fillRect(0, 0, W, H); }

// rubber stamp (e.g. REJECT) at a screen point, slams in
export function stamp(g, t, { at, x, y, text, color = '#FF3B3B', until }) {
  if (t < at || t > until) return;
  const u = clamp((t - at) / 0.12); const s = lerp(2.2, 1, E.o(u));
  g.save(); g.translate(x, y); g.rotate(-0.16); g.scale(s, s); g.globalAlpha = clamp(u * 2) * clamp((until - t) / 0.1);
  g.font = `400 92px ${F.title}`; const tw = g.measureText(text).width;
  g.lineWidth = 9; g.strokeStyle = color; rr(g, -tw / 2 - 26, -62, tw + 52, 116, 12); g.stroke();
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, -tw / 2, 4);
  g.restore();
}

// ======================= v2 text system (EP 02 v2+): text is never static =======================
// common life curve: pop-in (0.14 s), live phase, pop-out (scale 1 -> 0.85 + fade in 0.1 s)
function life(t, at, until) {
  const a = t - at, r = until - t;
  if (a < 0 || r < 0) return null;
  const pin = E.back(clamp(a / 0.14)), pout = clamp(r / 0.1);
  return { a, r, s: lerp(0.8, 1, pin) * lerp(0.85, 1, pout), alpha: clamp(a / 0.06) * pout };
}
const GOLD = '#FFB62E';
function glowText(g, txt, x, y, fill, blur, stroke = 0.2, fs = 100) {
  g.lineJoin = 'round'; g.miterLimit = 2;
  g.lineWidth = fs * stroke; g.strokeStyle = C.ink; g.strokeText(txt, x, y);
  if (blur > 0) { g.save(); g.shadowColor = fill; g.shadowBlur = blur; g.fillStyle = fill; g.fillText(txt, x, y); g.restore(); }
  g.fillStyle = fill; g.fillText(txt, x, y);
}
// captionFx: words [{t, a (accent), at (reveal time)}]; fx: drift | sway | flip | inflate | shake
// opts: rot(t) -> radians (flip), sy(t) -> y scale (inflate), flicker: [c1, c2], shakeAt: [times]
export function captionFx(g, t, o) {
  const { at, until, words, fx = 'drift', y = 1290, size = 104, cx = SAFE.cx, maxW = SAFE.maxW, font = F.cap } = o;
  const L = life(t, at, until); if (!L) return;
  g.save(); g.textBaseline = 'middle';
  let fs = size; g.font = `400 ${fs}px ${font}`;
  const full = words.map(w => w.t).join(' ');
  while (g.measureText(full).width > maxW && fs > 44) { fs -= 4; g.font = `400 ${fs}px ${font}`; }
  const sp = g.measureText(' ').width, widths = words.map(w => g.measureText(w.t).width);
  const tot = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let sx = 1, sy = 1, rot = 0, dx = 0, dy = 0;
  const drift = 1 + 0.06 * clamp(L.a / 1.4);
  if (fx === 'drift') { sx = sy = drift; rot = 0.008 * Math.sin(L.a * 2.2); }
  if (fx === 'sway') { sx = sy = 1 + 0.03 * clamp(L.a / 1.2); rot = (1.5 * Math.PI / 180) * Math.sin(L.a * 4.5); }
  if (fx === 'flip') { rot = o.rot ? o.rot(t) : 0; sx = sy = 1 + 0.04 * clamp(L.a / 1.2); }
  if (fx === 'inflate') { const k = o.sy ? o.sy(t) : 1; sy = k; sx = 1 + (k - 1) * 0.35; }
  if (fx === 'shake' || o.shakeAt) {
    const hits = o.shakeAt || [at];
    for (const h of hits) { const d = t - h; if (d >= 0 && d < 3 / 30) { const f = Math.floor(d * 30); dx += [14, -12, 7][f]; dy += [-6, 8, -4][f]; } }
    if (fx === 'shake') { sx = sy = drift; }
  }
  g.globalAlpha = L.alpha;
  g.translate(cx + dx, y + dy); g.rotate(rot); g.scale(L.s * sx, L.s * sy);
  let xx = -tot / 2;
  words.forEach((w, i) => {
    const wa = w.at === undefined ? at : w.at;
    if (t >= wa) {
      const pa = E.back(clamp((t - wa) / 0.12));
      let fill = w.a ? (C.accent) : C.cream, blur = 0;
      if (w.a) { blur = 14 + 10 * (0.5 + 0.5 * Math.sin(t * 9)); if (o.flicker) fill = (Math.floor(t * 12) % 2) ? o.flicker[0] : o.flicker[1]; }
      g.save(); g.translate(xx + widths[i] / 2, 0); g.scale(lerp(0.6, 1, pa), lerp(0.6, 1, pa));
      glowText(g, w.t, -widths[i] / 2, 0, fill, blur, 0.2, fs);
      g.restore();
    }
    xx += widths[i] + sp;
  });
  g.restore();
}
// counter: big Anton number that counts; value(t) overrides the from/to/dur ramp; colorFn(v) -> css colour
export function counter(g, t, o) {
  const { at, until, from = 0, to, dur = 0.6, suffix = ' °C', y = 760, size = 230, cx = SAFE.cx, label, labelAt, colorFn, value, dec = 0 } = o;
  const L = life(t, at, until); if (!L) return;
  const v = value ? value(t) : lerp(from, to, E.o(clamp(L.a / dur)));
  const txt = (Math.round(v)).toLocaleString('en-US').padStart(o.pad || 0, '0') + (o.plus && Math.round(v) >= to ? '+' : '');
  const col = colorFn ? colorFn(v) : C.accent;
  const landed = L.a > dur;
  const beat = landed ? 1 + 0.035 * Math.sin((L.a - dur) * Math.PI * 4) : 1;
  const punch = landed ? 1 + 0.12 * Math.exp(-(L.a - dur) * 14) : 1;
  g.save(); g.globalAlpha = L.alpha; g.translate(cx, y); g.scale(L.s * beat * punch, L.s * beat * punch); g.rotate(0.012 * Math.sin(L.a * 2));
  g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  let fs = size; g.font = `400 ${fs}px ${F.title}`;
  const sfx = suffix; let w = g.measureText(txt).width; g.font = `400 ${fs * 0.5}px ${F.title}`; let ws = g.measureText(sfx).width;
  while (w + ws > SAFE.maxW && fs > 80) { fs -= 6; g.font = `400 ${fs}px ${F.title}`; w = g.measureText(txt).width; g.font = `400 ${fs * 0.5}px ${F.title}`; ws = g.measureText(sfx).width; }
  const x0 = -(w + ws) / 2;
  g.textAlign = 'left'; g.font = `400 ${fs}px ${F.title}`;
  glowText(g, txt, x0, 0, col, 26 + 14 * (0.5 + 0.5 * Math.sin(L.a * 8)), 0.09, fs);
  g.font = `400 ${fs * 0.5}px ${F.title}`; glowText(g, sfx, x0 + w + 6, -fs * 0.42, col, 10, 0.12, fs * 0.5);
  if (label && t >= (labelAt ?? at)) {
    const la = E.back(clamp((t - (labelAt ?? at)) / 0.14));
    g.save(); g.translate(0, fs * 0.42); g.scale(la, la); g.textAlign = 'center'; g.font = `400 ${Math.round(fs * 0.3)}px ${F.cap}`;
    glowText(g, label, 0, 0, C.cream, 0, 0.2, fs * 0.3); g.restore();
  }
  g.restore();
}
// tag: small label with a thin leader line from a projected 3D point (anchor(t) -> {x, y, vis} in screen px)
export function tag(g, t, o) {
  const { at, until, text, anchor, side = -1, color = C.accent } = o;
  const L = life(t, at, until); if (!L) return;
  const p = anchor(t); if (!p) return;
  const ax = clamp(p.x, SAFE.left + 10, SAFE.right - 10), ay = clamp(p.y, SAFE.top + 40, SAFE.bottom - 40);
  g.save(); g.globalAlpha = L.alpha;
  g.font = `400 54px ${F.cap}`; const tw = g.measureText(text).width, bw = tw + 44, bh = 82;
  let lx = ax + side * 150 - (side < 0 ? bw : 0), ly = ay - 170 + 6 * Math.sin(L.a * 5);
  lx = clamp(lx, SAFE.left, SAFE.right - bw); ly = clamp(ly, SAFE.top, SAFE.bottom - bh);
  const grow = E.o(clamp(L.a / 0.18));
  const ex = lx + (side < 0 ? bw : 0), ey = ly + bh / 2;
  g.strokeStyle = color; g.lineWidth = 5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(lerp(ax, ex, grow), lerp(ay, ey, grow)); g.stroke();
  g.fillStyle = color; g.beginPath(); g.arc(ax, ay, 11 + 3 * Math.sin(L.a * 10), 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
  if (grow > 0.6) {
    const s = L.s * E.back(clamp((L.a - 0.1) / 0.14)) * (1 + 0.04 * clamp(L.a / 0.6));
    g.save(); g.translate(lx + bw / 2, ly + bh / 2); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -bw / 2 + 6, -bh / 2 + 8, bw, bh, 14); g.fill();
    g.fillStyle = color; rr(g, -bw / 2, -bh / 2, bw, bh, 14); g.fill(); g.lineWidth = 6; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = C.ink; g.textBaseline = 'middle'; g.fillText(text, -tw / 2, 3);
    g.restore();
  }
  g.restore();
}
// hook title v2: full and readable on frame 0 (thumbnail), alive from frame 1, punches on events, exits by scaling up
export function hookTitle2(g, t, o) {
  const { at = -1, until, l1, l2, y = 400, accentWord, accentAt, punches = [], gloss = [0.3, 0.9], loopFrom = null, exitScale = true } = o;
  if (t > until || t < at) return;
  const a = t - Math.max(0, at);
  let s = 1, alpha = 1;
  if (exitScale) { const r = until - t; if (r < 0.12) { s *= lerp(1.15, 1, r / 0.12); alpha = r / 0.12; } }
  g.save(); g.globalAlpha = alpha; g.translate(SAFE.cx, y); g.scale(s, s);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  // line 1 with one word turning accent
  let f1 = 96; g.font = `400 ${f1}px ${F.cap}`; while (g.measureText(l1).width > SAFE.maxW && f1 > 40) { f1 -= 4; g.font = `400 ${f1}px ${F.cap}`; }
  const parts = l1.split(' '), spw = g.measureText(' ').width, w1 = g.measureText(l1).width; let x = -w1 / 2;
  const sway1 = 0.006 * Math.sin(a * 3);
  g.save(); g.rotate(sway1);
  for (const p of parts) {
    const pw = g.measureText(p).width; const hot = accentWord && p === accentWord && accentAt !== undefined && t >= accentAt && t < accentAt + 0.4;
    const ps = hot ? 1 + 0.08 * Math.sin(clamp((t - accentAt) / 0.4) * Math.PI) : 1;
    g.save(); g.translate(x + pw / 2, 0); g.scale(ps, ps); glowText(g, p, -pw / 2, 0, hot ? C.accent : C.cream, hot ? 18 : 0, 0.23, f1); g.restore();
    x += pw + spw;
  }
  g.restore();
  // line 2: breathes on a 0.5 s beat, punches, gloss sweep
  let f2 = 300; g.font = `400 ${f2}px ${F.title}`; while (g.measureText(l2).width > SAFE.maxW && f2 > 80) { f2 -= 6; g.font = `400 ${f2}px ${F.title}`; }
  const w2 = g.measureText(l2).width;
  let k = t <= 0 ? 1 : 1 + 0.025 * (1 - Math.cos(a * Math.PI * 4));
  let dx = 0;
  for (const p of punches) { const d = t - p; if (d >= 0 && d < 0.2) { k *= lerp(1.12, 1, E.o(d / 0.2)); if (d < 2 / 30) dx = d < 1 / 30 ? 10 : -8; } }
  g.save(); g.translate(dx, f2 * 0.97 - f2 * 0.36); g.scale(k, k); g.translate(0, f2 * 0.36);
  glowText(g, l2, -w2 / 2, 0, C.accent, t <= 0 ? 0 : 12, 0.1, f2);
  // gloss band (clipped to the glyphs)
  const gu = (t - gloss[0]) / (gloss[1] - gloss[0]);
  if (gu > 0 && gu < 1) {
    g.save(); g.globalCompositeOperation = 'source-atop';
    const bx = lerp(-w2 * 0.8, w2 * 0.8, gu);
    const gr = g.createLinearGradient(bx - 90, 0, bx + 90, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,250,225,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.restore();
    // draw the band as text filled with the gradient (keeps it inside the letters)
    g.save(); g.fillStyle = gr; g.fillText(l2, -w2 / 2, 0); g.restore();
  }
  g.restore();
  g.restore();
}
// end card v2: NEXT EPISODE? bounces in, pills pulse alternately, COMMENT BELOW word by word, FOLLOW slides in
export function endCard2(g, t, { at, comment, commentW2, follow, until, left, right, next, followText, leftColor, rightColor }) {
  if (t < at || t > until) return;
  const fade = clamp((until - t) / 0.12);
  g.save(); g.globalAlpha = fade;
  const a = t - at;
  const bounce = a < 0.5 ? E.back(clamp(a / 0.3)) * (1 + 0.06 * Math.sin(clamp((a - 0.3) / 0.2) * Math.PI)) : 1 + 0.025 * Math.sin((a - 0.5) * 6);
  g.textAlign = 'center'; g.lineJoin = 'round';
  g.save(); g.translate(540, 470 - (1 - E.o(clamp(a / 0.3))) * 120); g.scale(bounce, bounce); g.rotate(0.02 * Math.sin(a * 3));
  let ft = 170; g.font = `400 ${ft}px ${F.title}`; while (g.measureText('NEXT EPISODE?').width > 860) { ft -= 4; g.font = `400 ${ft}px ${F.title}`; }
  g.lineWidth = 24; g.strokeStyle = C.ink; g.strokeText('NEXT EPISODE?', 0, 0); g.fillStyle = C.cream; g.fillText('NEXT EPISODE?', 0, 0);
  g.restore();
  g.textAlign = 'left';
  const pulse = (ph) => 1 + 0.07 * Math.max(0, Math.sin((a - 0.6) * Math.PI * 1.6 + ph));
  const pl = (t - at - 0.25) / 0.2, pr = (t - at - 0.4) / 0.2;
  g.save(); g.translate(255, 1235); const s1 = a > 0.6 ? pulse(0) : 1; g.scale(s1, s1); pill(g, 0, 0, left, leftColor || C.green, pl); g.restore();
  g.save(); g.translate(690, 1235); const s2 = a > 0.6 ? pulse(Math.PI) : 1; g.scale(s2, s2); pill(g, 0, 0, right, rightColor || C.red, pr); g.restore();
  captionFx(g, t, { at: comment, until: until + 1, fx: 'drift', words: [{ t: 'COMMENT', at: comment }, { t: 'BELOW', a: true, at: commentW2 }], y: 1375, size: 90 });
  if (t >= follow) {
    const v = E.o(clamp((t - follow) / 0.25));
    g.save(); g.translate(lerp(-500, SAFE.cx, v), 1490); g.rotate(0.015 * Math.sin((t - follow) * 4)); g.textAlign = 'center';
    g.font = `800 50px ${F.mono}`; const txt = followText || `FOLLOW FOR ${next}`; const tw = g.measureText(txt).width;
    g.fillStyle = C.accent; rr(g, -tw / 2 - 34, -50, tw + 68, 88, 16); g.fill(); g.lineWidth = 6; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = C.ink; g.textBaseline = 'middle'; g.fillText(txt, 0, -4);
    g.restore();
  }
  g.restore();
}
export * from './motion.js';
