// LONG 02 — How Zippers Work (16:9, ~4:20). Mechanism video: mostly 3D (EP. 01 zipper parts + 5 new set-ups in z3d.js),
// 2D diagrams (d2z.js on the LONG 01 2D layer), two public-domain patent drawings, kinetic type. Every state is a pure function of t.
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { P as PITCH, BX, sliderGap } from '../../js/zipper.js';
import { setAccent, SAFE, kcap, odometer, strike, callout, blurred, setParallax } from '../../js/overlay.js';
import * as D from '../long01_pencil/d2.js';
import * as Z from './d2z.js';
import { buildZ } from './z3d.js';

export const EP = 'LONG 02';
const TS = 0.7;

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFD23A');
  ctx.bloom.threshold = 0.82; ctx.bloom.strength = 0.3; ctx.bloom.radius = 0.45;
  scene.background = new THREE.Color(0x3a4352); scene.environmentIntensity = 0.75;
  Object.assign(SAFE, { top: 90 / TS, left: 90 / TS, right: 1830 / TS, bottom: 960 / TS, cx: 960 / TS, maxW: 1500 / TS });
  const ZZ = buildZ(ctx); const { v3, rig, HS, heroSet, HL, RL, KL, sliderW } = ZZ;
  await D.loadImages({ judson: './episodes/long02_zipper/archival/Judson_clasp_locker_patent_1893.png', sundback: './episodes/long02_zipper/archival/001_Sundback_zipper_1917_patent.jpg' });

  // ---------------- timing ----------------
  const lines = timing.lines, Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const Wd = (i, w, n = 0) => { const Lq = lines[i - 1]; const hits = Lq.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return Lq.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const payEnd = +(Ls(52) - 0.3).toFixed(3), END = +(payEnd + 20).toFixed(3), LOOPF = 4.0;     // end screen 20 s; the chain loop repeats every 4 s (4 teeth)
  const CH = [{ n: 1, at: Ls(7), title: 'TWO ROWS, HALF A TOOTH APART' }, { n: 2, at: Ls(13), title: 'THE BUMP AND THE HOLLOW' }, { n: 3, at: Ls(21), title: 'INSIDE THE SLIDER' },
    { n: 4, at: Ls(30), title: 'GOING THE OTHER WAY' }, { n: 5, at: Ls(36), title: 'THREE KINDS OF TEETH' }, { n: 6, at: Ls(44), title: 'WHEN A ZIPPER FAILS' }];

  // ---------------- camera ----------------
  let shake = 0, TT = 0, expo = 1.2;
  function cam(pos, subj, fov = 32, side = 0, low = 0, up = null) {
    const p = pos.clone(); if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; p.z += noise1(TT * 40 + 21) * shake; }
    camera.position.copy(p); if (up) camera.up.copy(up); else camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = p.distanceTo(subj), th = Math.tan(fov * Math.PI / 360) * d, upv = v3(0, 1, 0).applyQuaternion(camera.quaternion), rv = v3(1, 0, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * th).addScaledVector(rv, -side * th * W / H));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(20000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const UP_CH = v3(0, 0, -1);          // chain +y (open side) points up on screen in top-down views

  // ---------------- 3D set-ups ----------------
  // the run: the slider stays put, the chain slides under it (slider closing). tau = 0 at frame 0 and at the payoff's last frame.
  const C0 = 120, V = 5.0;
  const run = (tau, v = V, c0 = C0) => { HS.c = c0 + v * tau; HS.run = v * tau; };
  const macroCam = (tau, k = 0) => { const c = sliderW(4, 0.8); const a = lerp(0.0, 0.25, k);
    cam(c.clone().add(v3(lerp(16, 22, k) + 4 * Math.sin(tau * 0.2), lerp(9, 12, k), lerp(26, 34, k))), c, 30, 0.22 + a * 0.2, 0.05); rig(c, 40); expo = 1.25; };
  const hookPlate = (tau) => { run(tau); heroSet(); macroCam(tau); };

  const shots = []; const S = (t0, t1, type, fn, par = 1) => shots.push({ t0, t1, type, fn, par });
  // ---------- HOOK ----------
  S(0, Ls(2) - 0.05, '3D', (u, t) => hookPlate(t), 0);
  S(Ls(2) - 0.05, Ls(3) - 0.1, '3D', (u, t) => { run(t); heroSet(); const c = sliderW(-6, 0.5); cam(c.clone().add(v3(lerp(-30, -24, u), 6, lerp(-10, -6, u))), c, 30, -0.2, 0.05); rig(c, 50); expo = 1.25; });
  const xrIn = (t, t0, d = 0.9) => E.io(clamp((t - t0) / d));
  S(Ls(3) - 0.1, Ls(4) - 0.1, '3D', (u, t) => { run(t); HS.xray = xrIn(t, Wd(3, 'inside') - 0.2); HS.glow = HS.xray; heroSet(); const c = sliderW(5, 0.5);
    cam(c.clone().add(v3(lerp(10, 4, u), lerp(34, 40, E.io(u)), lerp(14, 6, u))), c, 30, 0.2, 0, UP_CH); rig(c, 40, 1.6); expo = lerp(1.15, 0.72, HS.xray); });
  S(Ls(4) - 0.1, Ls(5) - 0.1, 'TYPE', (u, t, g) => Z.promiseRows(g, t, t - Ls(4) + 0.1));
  const tY = Wd(5, 'Y');
  S(Ls(5) - 0.1, Ls(6) - 0.1, '3D', (u, t) => { run(t); HS.xray = 1; HS.glow = 0.8 + 0.8 * Math.exp(-Math.max(0, t - Wd(5, 'lock')) * 5) * (t > Wd(5, 'lock') ? 1 : 0); heroSet(); const c = sliderW(6, 0);
    cam(c.clone().add(v3(0, lerp(80, 26, E.io(u)), 0.01)), c, 34, 0, 0, UP_CH); rig(c, 40, 1.6); expo = 0.72; });
  S(Ls(6) - 0.1, Ls(7) - 0.15, 'TYPE', (u, t, g) => Z.miniChain(g, t, t - Ls(6)));
  // ---------- CH. 1 ----------
  S(Ls(7) - 0.15, Ls(8) - 0.1, '3D', (u, t) => { HS.c = 22; HS.gap = (s, y) => { const g = sliderGap(y - 22)[0]; return [g * 1.6, 0]; };
    HS.lift = (s, y) => 8 * Math.max(0, y - 60) / 200 * (1 + 0.15 * Math.sin(t * 1.5 + y * 0.03)); heroSet(); const c = HL(0, lerp(70, 130, E.io(u)), 6);
    cam(c.clone().add(v3(lerp(70, 50, u), 46, lerp(40, 20, u))), c, 34, 0.15); rig(c, 120); expo = 1.25; });
  S(Ls(8) - 0.1, Ls(9) - 0.1, '3D', (u, t) => { ZZ.rowsSet(3.0, (t - Wd(8, 'closely')) / 0.6, (t - Wd(8, 'half')) / 0.3); const c = RL(0, 4 * PITCH, 0);
    cam(c.clone().add(v3(0, lerp(70, 58, E.io(u)), 0.01)), c, 34, 0.18, 0, UP_CH); rig(c, 50); expo = 1.25; });
  S(Ls(9) - 0.1, Ls(10) - 0.1, '2D', (u, t, g) => Z.offsetRows(g, t, t - Ls(9) + 0.1));
  S(Ls(10) - 0.1, Ls(11) - 0.1, '2D', (u, t, g) => Z.headOn(g, t, t - Ls(10) + 0.1, { shiftAt: Wd(10, 'Shifted') - Ls(10) + 0.1 }));
  S(Ls(11) - 0.1, Ls(12) - 0.1, '3D', (u, t) => { HS.c = 230; HS.dim = (t - Wd(11, 'five') + 0.1) / 0.3; heroSet(); const c = HL(0, 190, 0);
    cam(c.clone().add(v3(0, lerp(52, 44, E.io(u)), 0.01)), c, 34, -0.2, 0, UP_CH); rig(c, 40, 1.8); expo = 1.0; });
  S(Ls(12) - 0.1, Ls(13) - 0.15, 'TYPE', (u, t, g) => Z.miniChain(g, t, t - Ls(12), { scroll: 25 }));
  // ---------- CH. 2 ----------
  S(Ls(13) - 0.15, Ls(14) - 0.1, '3D', (u, t) => { ZZ.toothSet(0.35 + 0.3 * Math.sin(t * 0.8), lerp(-1.4, 0.4, E.io(u)), 0, 0); const c = ZZ.toothG.position.clone();
    cam(c.clone().add(v3(3, 6, 13).multiplyScalar(lerp(1.3, 1.0, E.io(u)))), c, 32, 0.22); rig(c, 12); expo = 1.2; });
  S(Ls(14) - 0.1, Ls(15) - 0.1, '3D', (u, t) => { const fl = E.back(clamp((t - Wd(14, 'Underneath') + 0.15) / 0.5));
    const nib = 1.6 * clamp((t - Wd(14, 'bump')) / 0.15) * (1 - fl), ring = clamp((t - Wd(14, 'hollow')) / 0.15);
    ZZ.toothSet(0.35 + Math.PI * fl, 0.4 + 0.2 * u, nib, ring); const c = ZZ.toothG.position.clone(); cam(c.clone().add(v3(3, 6, 13).multiplyScalar(lerp(0.95, 0.85, u))), c, 32, -0.2); rig(c, 12); expo = 1.2; });
  S(Ls(15) - 0.1, Ls(16) - 0.1, '3D', (u, t) => { HS.c = 230; const k = E.io(clamp((t - Ls(15) - 0.6) / 2.6)); HS.gap = (s, y) => [lerp(1.6, 0, k) * (y > 120 && y < 175 ? 1 : 0), 0]; heroSet();
    const c = HL(0, 148, 0.4); cam(c.clone().add(v3(lerp(-15, -11, u), 4.5, lerp(-2, 0, u))), c, 30, 0.1); rig(c, 20); expo = 1.25; });
  S(Ls(16) - 0.1, Ls(17) - 0.1, '2D', (u, t, g) => Z.holdSideways(g, t, t - Ls(16) + 0.1));
  S(Ls(17) - 0.1, Ls(18) - 0.1, '2D', (u, t, g) => Z.pushStraight(g, t, t - Wd(17, 'Push') + 0.6));
  const tJam = Wd(18, 'jam');
  S(Ls(18) - 0.1, Ls(19) - 0.1, '3D', (u, t) => { const k = clamp((t - Ls(18) + 0.1) / Math.max(0.2, tJam - Ls(18) + 0.1));
    const G = t < tJam ? lerp(5, 0.85, E.i(k)) : 0.85 + 0.25 * Math.exp(-(t - tJam) * 6) * Math.abs(Math.sin((t - tJam) * 30));
    ZZ.rowsSet(G, 0, 0); ZZ.rows.layout(() => [G, 0]); shake = t > tJam ? 0.5 * Math.exp(-(t - tJam) * 8) : 0;
    cam(RL(10, -6, 20), RL(0, 12, 0), 36); rig(RL(0, 12, 0), 30); expo = 1.25; });
  S(Ls(19) - 0.1, Ls(20) - 0.1, 'TYPE', (u, t, g) => Z.miniChain(g, t, t - Ls(19), { scroll: 12 }));
  S(Ls(20) - 0.1, Ls(21) - 0.15, '3D', (u, t) => { run(t - Ls(20), 2.5, 160); heroSet(); const c = sliderW(6, 1);
    cam(c.clone().add(v3(lerp(-40, -28, E.io(u)), 10, lerp(-24, -14, u))), c, 30, 0.15, 0.05); rig(c, 40, 1.6); ZZ.acc.intensity = 0; expo = 0.95; });
  // ---------- CH. 3 ----------
  const xTop = (t, u, z0 = 46, z1 = 34, side = 0.2) => { const c = sliderW(5, 0); cam(c.clone().add(v3(0, lerp(z0, z1, E.io(u)), 0.01)), c, 34, side, 0, UP_CH); rig(c, 40, 1.6); expo = 0.72; };
  S(Ls(21) - 0.15, Ls(22) - 0.1, '3D', (u, t) => { run(t - Ls(21), 1.2, 140); HS.xray = xrIn(t, Ls(21) + 0.1, 1.0); HS.glow = xrIn(t, Wd(21, 'transparent') + 0.3, 0.8); heroSet(); xTop(t, u); });
  S(Ls(22) - 0.1, Ls(23) - 0.1, '2D', (u, t, g) => Z.ySection(g, t, t - Ls(22) + 0.1));
  S(Ls(23) - 0.1, Ls(24) - 0.1, '3D', (u, t) => { run(t - Ls(23), 3.2, 150); HS.xray = 1; HS.glow = 1; heroSet(); const c = sliderW(9, 0);
    cam(c.clone().add(v3(lerp(-14, -8, u), lerp(42, 38, u), lerp(-16, -10, u))), c, 32, 0.15); rig(c, 40, 1.6); expo = 0.72; });
  S(Ls(24) - 0.1, Ls(25) - 0.1, '3D', (u, t) => { run(t - Ls(24), 1.6, 165); HS.xray = 1; HS.glow = 1; heroSet(); const c = sliderW(3, 0.3);
    cam(c.clone().add(v3(lerp(-34, -30, u), 12, lerp(-6, 0, u))), c, 30, -0.1); rig(c, 30, 1.6); expo = 0.75; });
  S(Ls(25) - 0.1, Ls(26) - 0.1, '2D', (u, t, g) => Z.tiltDiagram(g, t, t - Ls(25) + 0.1));
  const tClick = Wd(26, 'Click');
  S(Ls(26) - 0.1, Ls(27) - 0.1, '3D', (u, t) => { run(t - Ls(26), 0.8, 180); HS.xray = 0.85; HS.glow = 0.8 + 1.2 * Math.exp(-Math.max(0, t - tClick) * 5) * (t > tClick ? 1 : 0); heroSet();
    const c = sliderW(1.2, 0.2); cam(c.clone().add(v3(lerp(16, 13, u), 18, lerp(8, 6, u))), c, 30, 0.2); rig(c, 20, 1.6); shake = t > tClick ? 0.08 * Math.exp(-(t - tClick) * 10) : 0; expo = 0.75; });
  S(Ls(27) - 0.1, Ls(28) - 0.1, 'TYPE', (u, t, g) => Z.miniChain(g, t, t - Ls(27), { scroll: 120 }));
  S(Ls(28) - 0.1, Ls(29) - 0.1, '2D', (u, t, g) => Z.yForces(g, t, t - Ls(28) + 0.1));
  S(Ls(29) - 0.1, Ls(30) - 0.15, 'TYPE', (u, t, g) => Z.miniChain(g, t, t - Ls(29), { scroll: 60 }));
  // ---------- CH. 4 ----------
  S(Ls(30) - 0.15, Ls(31) - 0.1, '3D', (u, t) => { run(-(t - Ls(30)) * 0.4, 1, 200); HS.xray = 1; HS.glow = 0.6; HS.wedge = 1.6 * (0.75 + 0.25 * Math.sin(t * 9)); heroSet(); const c = sliderW(9, 0);
    cam(c.clone().add(v3(lerp(-10, -4, u), lerp(34, 28, u), lerp(-8, -4, u))), c, 32, 0.2, 0, UP_CH); rig(c, 30); ZZ.acc.intensity = 30; ZZ.acc.distance = 40; ZZ.acc.position.copy(sliderW(9, 2)); expo = 0.95; });
  const cDown = (t) => lerp(200, 150, E.io(clamp((t - Ls(31)) / (Ls(32) - Ls(31)))));
  S(Ls(31) - 0.1, Ls(32) - 0.1, '3D', (u, t) => { HS.c = cDown(t); HS.xray = 0.9; HS.glow = 0.5; HS.wedge = 2.0; heroSet(); const c = sliderW(12, 0);
    cam(c.clone().add(v3(14, 40, 10)), c, 32, -0.15, 0, UP_CH); rig(c, 40); ZZ.acc.intensity = 30; ZZ.acc.distance = 40; ZZ.acc.position.copy(sliderW(9, 2)); expo = 0.95; });
  S(Ls(32) - 0.1, Ls(33) - 0.1, '2D', (u, t, g) => Z.wedgeStays(g, t, t - Ls(32) + 0.1));
  S(Ls(33) - 0.1, Ls(34) - 0.1, '3D', (u, t) => { HS.c = lerp(ZZ.C_TOP - 14, ZZ.C_TOP, E.o(clamp((t - Ls(33)) / 1.2))); heroSet(); const c = HL(0, ZZ.C_TOP + 6, 0);
    cam(c.clone().add(v3(lerp(18, 14, u), 22, lerp(-26, -20, u))), c, 32, 0.2); rig(c, 40); expo = 1.25; });
  const tPin = Wd(34, 'On') - 0.1;
  const C_LOCK = 41 * PITCH - 0.6;
  S(Ls(34) - 0.1, tPin, '3D', (u, t) => { HS.c = C_LOCK; HS.tab = lerp(0.1, -0.9, E.io(clamp((t - Wd(34, 'handle') + 0.2) / 0.6))); heroSet(); const c = sliderW(-2, 2);
    cam(c.clone().add(v3(lerp(26, 22, u), 18, lerp(-6, -2, u))), c, 32, -0.2); rig(c, 40); expo = 1.25; });
  S(tPin, Ls(35) - 0.1, '3D', (u, t) => { HS.c = C_LOCK; const flat = E.io(clamp((t - Wd(34, 'flat') + 0.1) / 0.5)), lift = E.io(clamp((t - Wd(34, 'holds') - 0.4) / 0.5));
    HS.tab = lerp(-0.9, 0.1, flat) + lerp(0, -0.9, lift) * 0; HS.xray = 0.55; HS.pin = Math.max(0.02, flat); heroSet(); const c = sliderW(2.2, 0.5);
    cam(c.clone().add(v3(lerp(-30, -24, u), lerp(30, 26, u), lerp(18, 14, u))), c, 30, 0.2); rig(c, 30); expo = 1.0; });
  S(Ls(35) - 0.1, Ls(36) - 0.15, 'TYPE', (u, t, g) => Z.upDown(g, t, t - Ls(35) + 0.1, { downAt: Wd(35, 'Down') - Ls(35) + 0.1 }));
  // ---------- CH. 5 ----------
  const kc = (k) => ZZ.KL(k, 0, 40, 0);
  S(Ls(36) - 0.15, Ls(37) - 0.1, '3D', (u, t) => { ZZ.kindsSet({ c: 70 }); const c = ZZ.KL(1, 0, 40, 0);
    cam(c.clone().add(v3(lerp(-8, 8, u), lerp(96, 88, E.io(u)), lerp(70, 62, u))), c, 34, 0.12); rig(c, 90); expo = 1.0; });
  S(Ls(37) - 0.1, Ls(38) - 0.1, '3D', (u, t) => { ZZ.kindsSet({ c: 70, build: E.io(clamp((t - Wd(37, 'wound') + 0.2) / 2.4)) * 0.85 + 0.15 }); const c = ZZ.KL(0, 0, lerp(30, 55, E.io(u)), 0);
    cam(c.clone().add(v3(-34, 42, 34)), c, 32, -0.15); rig(c, 60); expo = 1.1; });
  S(Ls(38) - 0.1, Ls(39) - 0.1, '3D', (u, t) => { const n = 4 + 26 * E.io(clamp((t - Wd(38, 'formed') + 0.3) / 2.2)); ZZ.kindsSet({ c: 300, moldN: n }); const c = ZZ.KL(1, 0, Math.max(20, n * PITCH - 10), 0);
    cam(c.clone().add(v3(26, 36, 30)), c, 32, 0.15); rig(c, 50); expo = 1.1; });
  S(Ls(39) - 0.1, Ls(40) - 0.1, '3D', (u, t) => { const n = 6 + 22 * clamp((t - Wd(39, 'clamped')) / 2.4); ZZ.kindsSet({ c: 300, metN: n }); const c = ZZ.KL(2, 0, Math.max(20, n * PITCH - 8), 0);
    cam(c.clone().add(v3(30, 36, 28)), c, 32, -0.15); rig(c, 50); expo = 1.1; });
  S(Ls(40) - 0.1, Ls(41) - 0.1, '2D', (u, t, g) => Z.howMade(g, t, t - Ls(40) + 0.1));
  S(Ls(41) - 0.1, Ls(42) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(41), Ls(42) - Ls(41), { img: 'judson', mode: 'card', cardH: 640, cardX: 700, from: [0.5, 0.45, 1.0], to: [0.5, 0.4, 1.08],
    credit: 'Clasp locker, US patent 504,038 (1893) · public domain', notes: [{ px: 0.25, py: 0.3, lx: 1400, ly: 330, text: 'HOOKS, FOR SHOES', at: Wd(41, 'hooks') - Ls(41), bend: -0.15 }] }));
  S(Ls(42) - 0.1, Ls(43) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(42), Ls(43) - Ls(42), { img: 'sundback', mode: 'card', cardH: 860, cardX: 1240, from: [0.5, 0.5, 1.0], to: [0.5, 0.5, 1.12],
    credit: 'Separable fastener, US patent 1,219,881 (1917) · public domain', notes: [{ px: 0.21, py: 0.2, lx: 420, ly: 300, text: 'TEETH + A Y', at: Wd(42, 'teeth') - Ls(42), circle: 90, bend: 0.2 }] }));
  S(Ls(43) - 0.1, Ls(44) - 0.15, '2D', (u, t, g) => Z.timeline(g, t, t - Ls(43) + 0.1, { marks: [
    { year: '1893', u: 0.1, at: 0.3, txt: 'HOOKS' }, { year: '1913', u: 0.4, at: 0.6, txt: 'TEETH' }, { year: '1917', u: 0.62, at: 0.9, txt: 'PATENT' }, { year: '1923', u: 0.9, at: Wd(43, 'nineteen') - Ls(43) + 0.1, txt: '"ZIPPER"', col: D.P.acc }] }));
  // ---------- CH. 6 ----------
  const tPop = Wd(45, 'tooth');
  S(Ls(44) - 0.15, Ls(45) - 0.1, '3D', (u, t) => { HS.c = ZZ.C_TOP; heroSet(); const c = HL(0, 110, 0); cam(c.clone().add(v3(lerp(-40, -34, u), 30, lerp(36, 30, u))), c, 32, 0.1); rig(c, 60); expo = 1.2; });
  const popShot = (t) => { HS.c = ZZ.C_TOP; ZZ.popSet(t - tPop); HS.gap = ZZ.burst(t - tPop - 0.6); heroSet(); ZZ.popSet(t - tPop); };
  S(Ls(45) - 0.1, Ls(46) - 0.1, '3D', (u, t) => { popShot(t); const BY = ZZ.hero.toothY(-1, ZZ.POP.i); const c = HL(-3, BY, 1); cam(c.clone().add(v3(-20, 14, 16)), c, 32, 0.15); rig(c, 40); shake = t > tPop ? 0.4 * Math.exp(-(t - tPop) * 10) : 0; expo = 1.25; });
  S(Ls(46) - 0.1, Ls(47) - 0.1, '2D', (u, t, g) => Z.cascade(g, t, t - Ls(46) + 0.1));
  S(Ls(47) - 0.1, Ls(48) - 0.1, '3D', (u, t) => { HS.c = lerp(120, 150, u); HS.worn = E.io(clamp((t - Wd(47, 'mouth') + 0.2) / 1.0)); heroSet(); const c = sliderW(-4, 0);
    cam(c.clone().add(v3(lerp(-22, -16, u), lerp(34, 30, u), lerp(46, 40, u))), c, 32, 0.2, 0.1); rig(c, 50, 1.6); expo = 1.0; });
  S(Ls(48) - 0.1, Ls(49) - 0.1, '2D', (u, t, g) => Z.squeeze(g, t, t - Ls(48) + 0.1));
  S(Ls(49) - 0.1, Ls(50) - 0.15, 'TYPE', (u, t, g) => Z.pencilRub(g, t, t - Ls(49) + 0.1));
  // ---------- PAYOFF: the slider closes the chain once more; the last payoff frame = frame 0 ----------
  const tPay2 = Ls(51) - 0.1;
  S(Ls(50) - 0.15, tPay2, '3D', (u, t) => { const tau = t - payEnd + 1 / 30; run(tau); heroSet(); const c = sliderW(4, 0.8);
    cam(c.clone().add(v3(lerp(-50, -34, E.io(u)), lerp(34, 22, u), lerp(60, 44, u))), c, 30, 0.2); rig(c, 60); expo = 1.25; });
  S(tPay2, payEnd, '3D', (u, t) => { const tau = t - payEnd + 1 / 30; run(tau); heroSet(); const k = E.io(u);
    const c = sliderW(4, 0.8), p0 = c.clone().add(v3(-30, 18, 38)); macroCam(tau); const p1 = camera.position.clone(); cam(p0.lerp(p1, k), c, 30, lerp(0.15, 0.22, k), lerp(0, 0.05, k)); rig(c, 40); expo = 1.25; });
  // ---------- END SCREEN: quiet loop (4 teeth = 4 s, rendered once and repeated) ----------
  const endPlate = (t) => { const lt0 = ((t - payEnd) % LOOPF + LOOPF) % LOOPF; HS.c = 100 + PITCH * lt0; HS.run = PITCH * lt0; heroSet(); const c = sliderW(4, 0);
    cam(c.clone().add(v3(-70, 46, 60)), c, 30, 0, -0.2); rig(c, 80, 1.8); expo = 1.0; };
  S(payEnd, END + 1, '3D', (u, t) => endPlate(t), 0);

  const shotAt = (t) => shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  function stateAt(t) {
    TT = t; shake = 0; expo = 1.2; ZZ.hideAll();
    const sh = shotAt(t); if (sh.type === '3D') sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    ctx.renderer.toneMappingExposure = expo; ZZ.acc.visible = ZZ.acc.intensity > 0; ZZ.xl.visible = ZZ.xl.intensity > 0;
    scene.updateMatrixWorld(true); return sh;
  }
  const proj = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W / TS, y: (1 - p.y) / 2 * H / TS }; };
  const anchorOf = (fn) => (tt) => { stateAt(tt); return proj(fn(tt)); };

  // ---------------- overlay text (virtual coords, drawn at TS) ----------------
  const TEXT = []; const T_ = (o) => { TEXT.push(o); return o; };
  const VX = (x) => x / TS, VY = (y) => y / TS;
  T_({ k: 'titlecard', at: -1, until: 2.5 });
  T_({ k: 'strike', at: Wd(1, 'lock'), strikeAt: Wd(2, 'holds') - 0.32, until: Ls(3) + 0.6, word: 'LOCK? HOOK? GLUE?', repl: 'IT HOLDS.', y: VY(200), size: 120, cx: VX(1300), ek: 'twist' });
  T_({ k: 'callout', at: Wd(3, 'slider') - 0.1, until: Ls(4) - 0.2, text: 'THE SLIDER', anchor: anchorOf(() => sliderW(8, 1.5)), dx: 240, dy: -160 });
  T_({ k: 'cap', at: Wd(4, 'two'), until: Wd(4, 'never') - 0.05, words: [{ t: 'TWO ROWS', k: 'noun' }], y: VY(240), cx: VX(560), size: 120 });
  T_({ k: 'cap', at: Wd(4, 'never'), until: Ls(5) - 0.2, words: [{ t: 'NEVER', k: 'noun' }, { t: 'LINE UP', a: true, k: 'twist', at: Wd(4, 'line') }], y: VY(240), cx: VX(560), size: 120 });
  T_({ k: 'cap', at: Wd(5, 'one'), until: Ls(6) - 0.2, words: [{ t: 'ONE TINY', k: 'noun' }, { t: 'Y', a: true, k: 'twist', at: tY }], y: VY(170), cx: VX(1420), size: 120 });
  T_({ k: 'cap', at: Ls(6), until: Ls(7) - 0.2, words: [{ t: 'FIRST:', k: 'noun' }, { t: 'THE TEETH', a: true, k: 'noun', at: Wd(6, 'teeth') }], y: VY(500), size: 160 });
  for (const c of CH) T_({ k: 'lower', at: c.at + 0.2, until: c.at + 3.6, n: c.n, title: c.title });
  // CH. 1
  T_({ k: 'cap', at: Wd(8, 'half'), until: Ls(9) - 0.15, words: [{ t: 'HALF', a: true, k: 'twist' }, { t: 'A TOOTH', k: 'noun', at: Wd(8, 'tooth') }], y: VY(160), cx: VX(560), size: 110 });
  T_({ k: 'cap', at: Wd(9, 'gap'), until: Ls(10) - 0.15, words: [{ t: 'FACES', k: 'verb' }, { t: 'A GAP', a: true, k: 'noun', at: Wd(9, 'gap') + 0.1 }], y: VY(130), cx: VX(1560), size: 100, dir: 1 });
  T_({ k: 'odo', at: Wd(11, 'five'), until: Ls(12) - 0.15, value: 5, unit: 'MM', pre: 'ABOUT', y: VY(330), cx: VX(1450), size: 230 });
  T_({ k: 'cap', at: Wd(12, 'Every'), until: Wd(12, 'But') - 0.05, words: [{ t: 'EVERY TOOTH', k: 'noun' }, { t: 'BETWEEN TWO', a: true, k: 'noun', at: Wd(12, 'between') }], y: VY(420), size: 140 });
  T_({ k: 'cap', at: Wd(12, 'But'), until: Ls(13) - 0.2, words: [{ t: 'BUT IT', k: 'noun' }, { t: 'HOLDS NOTHING', a: true, k: 'twist', at: Wd(12, 'holds') }], y: VY(420), size: 140 });
  // CH. 2
  T_({ k: 'cap', at: Wd(13, 'one'), until: Ls(14) - 0.15, words: [{ t: 'ONE', k: 'q' }, { t: 'TOOTH?', a: true, k: 'q', at: Wd(13, 'tooth') }], y: VY(170), cx: VX(1350), size: 120 });
  const TT0 = ZZ.toothG.position;
  T_({ k: 'callout', at: Wd(14, 'bump'), until: Wd(14, 'Underneath') - 0.05, text: 'BUMP', anchor: anchorOf(() => TT0.clone().add(v3(0.7, 1.0, 0))), dx: 230, dy: -170 });
  T_({ k: 'callout', at: Wd(14, 'hollow'), until: Ls(15) - 0.15, text: 'HOLLOW', anchor: anchorOf(() => TT0.clone().add(v3(0.7, 0.2, 0))), dx: -250, dy: -170 });
  T_({ k: 'cap', at: Wd(15, 'nested'), until: Ls(16) - 0.15, words: [{ t: 'LIKE NESTED', k: 'noun' }, { t: 'SPOONS', a: true, k: 'noun', at: Wd(15, 'spoons') }], y: VY(160), cx: VX(1300), size: 100 });
  T_({ k: 'cap', at: Wd(17, 'problem') - 0.1, until: Wd(17, 'Push') - 0.05, words: [{ t: 'A PROBLEM', a: true, k: 'twist' }], y: VY(170), size: 110 });
  T_({ k: 'cap', at: tJam, until: Ls(19) - 0.15, words: [{ t: 'JAMMED.', a: true, k: 'twist' }], y: VY(170), cx: VX(1350), size: 120 });
  T_({ k: 'cap', at: Ls(19), until: Ls(20) - 0.15, words: [{ t: 'HOW DOES A SLIDER', k: 'q' }, { t: 'DO IT?', a: true, k: 'q', at: Wd(19, 'do', 1) }], y: VY(440), size: 140 });
  T_({ k: 'cap', at: Wd(20, 'inside') - 0.1, until: Ls(21) - 0.2, words: [{ t: 'INSIDE', a: true, k: 'verb' }], y: VY(170), cx: VX(1400), size: 120, dir: 1 });
  // CH. 3
  T_({ k: 'callout', at: Wd(21, 'Y', 1), until: Ls(22) - 0.15, text: 'Y CHANNEL', anchor: anchorOf(() => sliderW(9, 0.3)), dx: 300, dy: -140 });
  T_({ k: 'cap', at: Wd(23, 'one'), until: Ls(24) - 0.15, words: [{ t: 'ONE ROW', k: 'noun' }, { t: 'PER ARM', a: true, k: 'noun', at: Wd(23, 'arm') }], y: VY(160), cx: VX(1350), size: 100 });
  T_({ k: 'cap', at: Wd(24, 'tilt'), until: Ls(25) - 0.15, words: [{ t: 'THE TEETH', k: 'noun' }, { t: 'TILT', a: true, k: 'twist', at: Wd(24, 'tilt') + 0.05 }], y: VY(160), cx: VX(1350), size: 110 });
  T_({ k: 'cap', at: tClick - 0.05, until: Ls(27) - 0.15, words: [{ t: 'CLICK.', a: true, k: 'twist' }], y: VY(170), cx: VX(1450), size: 140 });
  T_({ k: 'cap', at: Ls(27), until: Wd(27, 'Again') - 0.05, words: [{ t: 'THE NEXT.', k: 'noun' }, { t: 'THE NEXT.', a: true, k: 'noun', at: Wd(27, 'next', 1) }], y: VY(460), size: 150 });
  T_({ k: 'cap', at: Wd(27, 'Again'), until: Ls(28) - 0.15, words: [{ t: 'ALL THE WAY', k: 'noun' }, { t: 'UP', a: true, k: 'verb', at: Wd(27, 'up') }], y: VY(460), size: 150 });
  T_({ k: 'cap', at: Ls(29), until: Wd(29, 'slider') - 0.1, words: [{ t: "YOUR FINGERS", k: 'noun' }, { t: "CAN'T", a: true, k: 'twist', at: Wd(29, "can't") }], y: VY(460), size: 150 });
  T_({ k: 'cap', at: Wd(29, 'slider') - 0.1, until: Ls(30) - 0.2, words: [{ t: 'THE SLIDER', k: 'noun' }, { t: 'DOES IT', a: true, k: 'verb', at: Wd(29, 'does') }], y: VY(460), size: 150 });
  // CH. 4
  T_({ k: 'cap', at: Wd(30, 'down') - 0.2, until: Ls(31) - 0.15, words: [{ t: 'PULL IT', k: 'q' }, { t: 'DOWN?', a: true, k: 'q', at: Wd(30, 'down') }], y: VY(170), cx: VX(1380), size: 110 });
  T_({ k: 'callout', at: Wd(31, 'wedge'), until: Ls(32) - 0.15, text: 'WEDGE', anchor: anchorOf(() => sliderW(9, 0)), dx: 260, dy: -150 });
  T_({ k: 'callout', at: Wd(33, 'Stops'), until: Ls(34) - 0.15, text: 'STOPS', anchor: anchorOf(() => HL(-3, ZZ.C_TOP + 9, 1)), dx: -260, dy: -150 });
  T_({ k: 'callout', at: Wd(34, 'pull'), until: tPin - 0.05, text: 'PULL TAB', anchor: anchorOf(() => sliderW(-6, 3)), dx: 260, dy: -150 });
  T_({ k: 'callout', at: Wd(34, 'pin'), until: Ls(35) - 0.15, text: 'LOCK PIN', anchor: anchorOf(() => sliderW(2.2, 1)), dx: -260, dy: -160 });
  T_({ k: 'cap', at: Ls(35), until: Wd(35, 'Down') - 0.05, words: [{ t: 'UP:', k: 'noun' }, { t: 'THE Y LOCKS', a: true, k: 'verb', at: Wd(35, 'Y') }], y: VY(300), cx: VX(780), size: 130 });
  T_({ k: 'cap', at: Wd(35, 'Down'), until: Ls(36) - 0.2, words: [{ t: 'DOWN:', k: 'noun' }, { t: 'THE WEDGE OPENS', a: true, k: 'verb', at: Wd(35, 'wedge') }], y: VY(700), cx: VX(780), size: 130 });
  // CH. 5
  T_({ k: 'cap', at: Wd(36, 'separate'), until: Ls(37) - 0.15, words: [{ t: 'SEPARATE', k: 'q' }, { t: 'TEETH?', a: true, k: 'q', at: Wd(36, 'teeth') }], y: VY(150), size: 110 });
  T_({ k: 'cap', at: Wd(37, 'Coil'), until: Ls(38) - 0.15, words: [{ t: 'COIL', a: true, k: 'noun' }, { t: 'MOST COMMON', k: 'noun', at: Wd(37, 'most') }], y: VY(160), cx: VX(1350), size: 100 });
  T_({ k: 'cap', at: Wd(38, 'Molded'), until: Ls(39) - 0.15, words: [{ t: 'MOLDED', a: true, k: 'noun' }, { t: 'PLASTIC', k: 'noun', at: Wd(38, 'plastic') }], y: VY(160), cx: VX(560), size: 100 });
  T_({ k: 'cap', at: Wd(39, 'metal'), until: Ls(40) - 0.15, words: [{ t: 'METAL', a: true, k: 'noun' }, { t: 'ONE BY ONE', k: 'noun', at: Wd(39, 'one') }], y: VY(160), cx: VX(1350), size: 100 });
  T_({ k: 'cap', at: Wd(40, 'One'), until: Ls(41) - 0.15, words: [{ t: 'ONE SLIDER', a: true, k: 'noun' }], y: VY(940), cx: VX(1240), size: 80 });
  T_({ k: 'chip', at: Wd(41, 'eighteen'), until: Ls(42) - 0.15, text: '1893', x: 1400, y: 760 });
  T_({ k: 'chip', at: Wd(42, 'nineteen'), until: Ls(43) - 0.15, text: '1917', x: 420, y: 760 });
  T_({ k: 'cap', at: Wd(43, 'Zip') - 0.05, until: Ls(44) - 0.2, words: [{ t: 'ZIP.', a: true, k: 'twist' }], y: VY(880), cx: VX(1500), size: 150 });
  // CH. 6
  T_({ k: 'cap', at: Wd(44, 'why'), until: Ls(45) - 0.15, words: [{ t: 'WHY DO THEY', k: 'q' }, { t: 'FAIL?', a: true, k: 'q', at: Wd(44, 'fail') }], y: VY(170), cx: VX(1350), size: 110 });
  T_({ k: 'cap', at: Wd(45, 'single'), until: Ls(46) - 0.15, words: [{ t: 'ONE TOOTH', a: true, k: 'twist' }], y: VY(170), cx: VX(1400), size: 110 });
  T_({ k: 'callout', at: Wd(47, 'mouth'), until: Ls(48) - 0.15, text: 'WORN MOUTH', anchor: anchorOf(() => sliderW(11, 0.5)), dx: 260, dy: -150 });
  T_({ k: 'cap', at: Wd(48, 'fix'), until: Wd(48, 'squeeze') + 0.6, words: [{ t: 'THE FIX', a: true, k: 'noun' }], y: VY(150), cx: VX(560), size: 100 });
  T_({ k: 'cap', at: Ls(49), until: Wd(49, 'Graphite') - 0.05, words: [{ t: 'STUCK?', a: true, k: 'q' }, { t: 'A PENCIL', k: 'noun', at: Wd(49, 'pencil') }], y: VY(170), cx: VX(1350), size: 120 });
  T_({ k: 'cap', at: Wd(49, 'Graphite'), until: Ls(50) - 0.2, words: [{ t: 'GRAPHITE', a: true, k: 'noun' }, { t: 'DRY LUBRICANT', k: 'noun', at: Wd(49, 'dry') }], y: VY(170), cx: VX(1350), size: 100 });
  T_({ k: 'chip', at: Wd(49, 'Graphite') + 0.2, until: Ls(50) - 0.2, text: 'GRAPHITE · SEE LONG 01', x: 560, y: 900, small: true });
  // payoff + end
  T_({ k: 'cap', at: Ls(50), until: Ls(51) - 0.15, words: [{ t: 'TWO ROWS', k: 'noun' }, { t: 'HALF A TOOTH APART', a: true, k: 'noun', at: Wd(50, 'half') }], y: VY(170), cx: VX(1250), size: 100 });
  T_({ k: 'cap', at: Ls(51), until: payEnd - 0.6, words: [{ t: 'ONE TINY Y.', a: true, k: 'twist' }, { t: 'IT HOLDS.', k: 'noun', at: Wd(51, 'holds') }], y: VY(170), cx: VX(1250), size: 110 });
  T_({ k: 'titlecard', at: payEnd - 0.55, until: payEnd + 0.4, bookend: true });
  T_({ k: 'end', at: payEnd + 0.3, until: END + 1 });

  function titleCard(g, t, o) {
    const a = t - o.at, r = o.until - t; if (r < 0) return; const ina = o.at < 0 ? 1 : E.o(clamp(a / 0.4)), out = clamp(r / 0.3);
    const ph = o.bookend ? t - (payEnd - 1 / 30) : t;
    g.save(); g.globalAlpha = out; const x = 90 + 6 * ph, y = 90 + 20 * (1 - ina);
    g.fillStyle = D.P.acc; g.fillRect(x, y, 10 * ina, 112); g.font = `400 26px ${D.FONT.mono}`; g.fillStyle = D.P.cream; g.textBaseline = 'top';
    g.fillText('RAW TO REAL', x + 30, y + 4); g.font = `400 70px ${D.FONT.title}`; g.lineWidth = 9; g.strokeStyle = D.P.ink; g.lineJoin = 'round';
    const txt = 'HOW ZIPPERS WORK', n = o.at < 0 ? txt.length : Math.floor(clamp(a / 0.5) * txt.length); g.strokeText(txt.slice(0, n), x + 28, y + 36); g.fillStyle = D.P.cream; g.fillText(txt.slice(0, n), x + 28, y + 36);
    g.restore();
  }
  function lowerThird(g, t, o) {
    const a = t - o.at, r = o.until - t; if (a < 0 || r < 0) return;
    const ina = E.o(clamp(a / 0.45)), out = E.i(clamp(1 - r / 0.35)), x = 90, y = 830;
    g.save(); g.font = `400 64px ${D.FONT.title}`; const tw = g.measureText(o.title).width, bw = Math.max(tw, 360) + 70;
    const wipe = bw * ina * (1 - out); g.beginPath(); g.rect(x - 10, y - 20, wipe + 20, 150); g.clip();
    g.fillStyle = 'rgba(14,17,23,0.78)'; D.rr(g, x, y, bw, 120, 16); g.fill(); g.fillStyle = D.P.acc; g.fillRect(x, y, 12, 120); g.fillStyle = 'rgba(255,210,58,0.5)'; g.fillRect(x + 12, y + 116, (bw - 12) * clamp(a / 3.4), 4);
    g.font = `800 24px ${D.FONT.mono}`; g.fillStyle = D.P.acc; g.textBaseline = 'top'; const lab = `CHAPTER ${o.n}`; const n = Math.floor(clamp((a - 0.15) / 0.3) * lab.length); g.fillText(lab.slice(0, n), x + 34, y + 14);
    g.font = `400 64px ${D.FONT.title}`; g.fillStyle = D.P.cream; const dy = 30 * (1 - E.back(clamp((a - 0.2) / 0.4))); g.globalAlpha = clamp((a - 0.2) / 0.15); g.fillText(o.title, x + 34 + 16 * E.io(clamp(a / 3.4)), y + 42 + dy);
    g.restore();
  }
  function endScreen(g, t, o) {
    const a = t - o.at; if (a < 0) return;
    const fl = (k) => 5 * Math.sin(t * 1.1 + k), br = 1 + 0.015 * Math.sin(t * 0.9);
    g.save(); g.translate(960, 225); g.scale(br, br); g.translate(-960, -225);
    D.label(g, 'NEXT: HOW A GLASS BOTTLE IS MADE', 960, 170 + fl(0), a, { size: 52, col: D.P.cream, drift: 0 });
    D.label(g, 'SUBSCRIBE: NEW ONE EVERY WEEK', 960, 280 + fl(1.7), a - 0.4, { size: 40, col: D.P.acc, drift: 0 }); g.restore();
    const k = clamp((a - 0.8) / 0.8) * 0.42; g.save(); g.globalAlpha = k; g.fillStyle = '#0B0E13'; D.rr(g, 150, 380, 720, 405, 18); g.fill(); D.rr(g, 1050, 380, 720, 405, 18); g.fill(); g.beginPath(); g.arc(960, 880, 92, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawText(g, t) {
    const sh = shotAt(t); setParallax(((clamp((t - sh.t0) / (sh.t1 - sh.t0)) - 0.5) * 2) * sh.par, 0);
    for (const o of TEXT) {
      if (t < o.at - 0.01 || t > o.until + 0.01) continue;
      if (o.k === 'titlecard') titleCard(g, t, o);
      else if (o.k === 'lower') lowerThird(g, t, o);
      else if (o.k === 'end') endScreen(g, t, o);
      else if (o.k === 'chip') D.chip(g, o.text, o.x + 4 * Math.sin((t - o.at) * 1.1), o.y + 7 * Math.sin((t - o.at) * 1.6), t - o.at, { size: o.small ? 30 : 44, out: clamp((o.until - t) / 0.12) });   // chips float: no text frozen > 2 s
      else { g.save(); g.scale(TS, TS);
        if (o.k === 'callout') callout(g, t, o);
        else if (o.k === 'cap') kcap(g, t, { y: VY(150), ...o });
        else if (o.k === 'strike') strike(g, t, { ...o, k: o.ek });
        else if (o.k === 'odo') odometer(g, t, o);
        g.restore(); }
    }
  }

  // ---------------- sound events (names mapped to Mixkit ids in sound.json) ----------------
  const sfx = [
    { t: 0.0, n: 'zip_long' }, { t: Wd(2, 'holds') - 0.32, n: 'scribble' }, { t: Wd(3, 'inside') - 0.2, n: 'xray_hit' }, { t: Wd(4, 'two'), n: 'pop' }, { t: Wd(5, 'lock'), n: 'click' },
    ...CH.map(c => ({ t: c.at + 0.2, n: 'swipe' })),
    { t: Ls(7), n: 'zip_open' }, { t: Wd(8, 'half'), n: 'ui_tick' }, { t: Wd(10, 'head') + 0.2, n: 'hit' }, { t: Wd(11, 'five'), n: 'ui_tick' },
    { t: Wd(14, 'bump'), n: 'ui_tick' }, { t: Wd(14, 'hollow'), n: 'whoosh_soft' }, { t: tJam, n: 'metal_jam' }, { t: Ls(19), n: 'swell' },
    { t: Ls(21) + 0.3, n: 'xray_hit' }, { t: tClick, n: 'click' }, { t: Wd(27, 'next'), n: 'click' }, { t: Wd(27, 'next', 1), n: 'click' }, { t: Wd(27, 'Again'), n: 'zip_short' },
    { t: Ls(31), n: 'zip_open' }, { t: Wd(33, 'Stops') + 0.6, n: 'metal_tap' }, { t: Wd(34, 'flat'), n: 'click' }, { t: Wd(35, 'Down'), n: 'whoosh_soft' },
    { t: Wd(37, 'wound'), n: 'whoosh_soft' }, { t: Wd(38, 'formed'), n: 'pop' }, { t: Wd(39, 'clamped'), n: 'metal_tap' }, { t: Wd(43, 'Zip'), n: 'zip_short' },
    { t: tPop, n: 'metal_ping' }, { t: tPop + 0.6, n: 'zip_open' }, { t: Wd(48, 'squeeze'), n: 'crimp' }, { t: Ls(49) + 0.3, n: 'pencil_scribble' },
    { t: Ls(50), n: 'zip_long' }, { t: payEnd, n: 'whoosh' },
  ];

  function seek(t, g, opts = {}) {
    const plate = opts.plate !== false, over = opts.over !== false;
    const sh = stateAt(t);
    lens.uniforms.uSeed.value = (t < 1 / 30 || Math.abs(t - (payEnd - 1 / 30)) < 1e-3) ? 0 : Math.floor(t * 30) % 1000;
    if (plate) {
      if (sh.type === '3D') { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
      else { g.save(); sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t, g); g.restore(); D.grade(g, t); }
    }
    if (!over) return;
    blurred(g, t, drawText, { n: 3 });
    stateAt(t);
  }
  return { seek, END, sfx, lines, shots: shots.map(s => [s.t0, s.t1]), shotTypes: shots.map(s => s.type), chapters: CH.map(c => [c.n, c.at, c.title]), endLoop: [payEnd, LOOPF],
    caps: TEXT.map(o => [o.at, o.until, o.text || o.title || (o.words ? o.words.map(w => w.t).join(' ') : o.word ? o.word + ' -> ' + o.repl : o.value !== undefined ? `${o.pre ? o.pre + ' ' : ''}${o.value} ${o.unit}` : o.k), o.k, '']), lockTicks: () => [] };
}
