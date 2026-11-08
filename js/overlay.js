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

export function sticker(g, t, { at, n, word, hold = 1.7 }) {
  const age = t - at; if (age < 0 || age > hold + 0.25) return;
  const inU = E.back(clamp(age / 0.26)), outU = E.i(clamp((age - hold) / 0.22));
  g.save();
  g.translate(lerp(-700, SAFE.cx, inU) + outU * 30, 650 - outU * 900);
  g.rotate((-6 + (1 - inU) * -10) * Math.PI / 180);
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

export function hookTitle(g, t, { at, until, l1, l2 }) {
  if (t < at || t > until) return;
  const u = E.back(clamp((t - at) / 0.18)), o = clamp((until - t) / 0.08);
  g.save(); g.translate(SAFE.cx, 1080); g.scale(lerp(0.8, 1, u) * o, lerp(0.8, 1, u) * o);
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
