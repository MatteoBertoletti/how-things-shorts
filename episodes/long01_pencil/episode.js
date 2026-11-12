// LONG 01 — How Pencils Are Made (16:9, ~4:45). Hybrid: 3D (EP. 03 stations + 4 new scenes), 2D diagrams, archival stills,
// kinetic type. Every state is a pure function of t. Overlay = motion grammar of js/motion.js drawn at 70 % (virtual canvas).
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { PEN, SLAT, grooveX } from '../../js/pencil.js';
import { setAccent, C, SAFE, kcap, odometer, strike, callout, inkSwipe, blurred, setParallax } from '../../js/overlay.js';
import { buildStations } from './stations.js';
import { buildNew } from './new3d.js';
import * as D from './d2.js';

export const EP = 'LONG 01';
const TS = 0.7, VW = W / TS, VH = H / TS;                     // overlay type scale (16:9 = 70 % of the vertical sizes)

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFD23A');
  ctx.bloom.threshold = 0.62; ctx.bloom.strength = 0.4; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x14181F); scene.environmentIntensity = 0.7;
  Object.assign(SAFE, { top: 90 / TS, left: 90 / TS, right: 1830 / TS, bottom: 960 / TS, cx: 960 / TS, maxW: 1500 / TS });
  const ST = buildStations(ctx), N = buildNew(ctx, ST);
  const { v3, L, rig, pt, glow, acc, spotG, spotR, mt } = ST;
  const A = 'archival/';
  await D.loadImages({ graphite: `./episodes/long01_pencil/${A}GraphiteUSGOV.jpg`, clay: `./episodes/long01_pencil/${A}KaoliniteUSGOV.jpg`, cedar: `./episodes/long01_pencil/${A}Incensecedar_sanjacintomts.JPG`,
    borrowdale: `./episodes/long01_pencil/${A}John_Constable_-_Borrowdale-_Evening_after_a_Fine_Day__1_October_1806_-_Google_Art_Project.jpg`, patent: `./episodes/long01_pencil/${A}LipmanPencilEraserPatent.jpg` });

  // ---------------- timing ----------------
  const lines = timing.lines, Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const Wd = (i, w, n = 0) => { const Lq = lines[i - 1]; const hits = Lq.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return Lq.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const tEnd0 = +(Ls(67) - 0.3).toFixed(3), END = +(tEnd0 + 20).toFixed(3), LOOPF = 13 / 3;     // end screen 20 s; the factory loop repeats every 4.333 s
  const CH = [{ n: 1, at: Ls(8), title: "WHY IT'S CALLED LEAD" }, { n: 2, at: Ls(17), title: 'WHAT GRAPHITE REALLY IS' }, { n: 3, at: Ls(26), title: 'BUILDING THE CORE' },
    { n: 4, at: Ls(39), title: 'THE WOOD' }, { n: 5, at: Ls(47), title: 'THE SANDWICH' }, { n: 6, at: Ls(57), title: 'COLOR, METAL, RUBBER' }];
  // action anchors for the EP. 03 stations
  const tPB = Wd(35, 'graphite') + 0.4, tPH = Wd(36, 'clay') + 0.4;
  ST.setAnchors({ sawT0: Ls(41) - 0.2, tSawHit: Wd(41, 'cut') + 0.1, tWater: Wd(27, 'water') - 0.2, tSqueeze: Wd(28, 'squeezed') - 0.15, tKiln: Ls(30) + 0.3,
    tB0: tPB, tH0: tPH, tGlue: Ls(47) - 0.05, tCores: Wd(47, 'core') - 0.1, tTop: Wd(48, 'second') - 0.1, tLand: Wd(48, 'top') + 0.02, tPress: Wd(48, 'press') + 0.05,
    tCut: Ls(54) - 0.4, tSec: -5, tFan: Wd(54, 'pencils') - 0.4, tDip: Ls(57) - 0.1, tFer: Wd(62, 'ferrule') - 0.25, tEr: Wd(62, 'eraser') - 0.2, tStamp: Wd(63, 'stamp') - 0.04 });

  // ---------------- camera ----------------
  let shake = 0, TT = 0, expo = 1.2;
  function cam(pos, subj, fov = 34, side = 0, low = 0) {
    const p = pos.clone(); if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; p.z += noise1(TT * 40 + 21) * shake; }
    camera.position.copy(p); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = p.distanceTo(subj), th = Math.tan(fov * Math.PI / 360) * d, upv = v3(0, 1, 0).applyQuaternion(camera.quaternion), rv = v3(1, 0, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * th).addScaledVector(rv, -side * th * W / H));   // side > 0 puts the subject right of centre
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));

  // ---------------- shots ----------------
  const shots = []; const S = (t0, t1, type, fn, par = 1) => shots.push({ t0, t1, type, fn, par });
  const all3 = [ST.PAY, ST.SAW, ST.MIXG, ST.SAN, ST.SHP, ST.FIN, ...N.all];
  const show = (...o) => o.forEach(x => x.visible = true);
  const lt = (t, t0) => t - t0;
  // macro writing (hook frame 0 = payoff last frame)
  const macro = (tau, r, az, el, fov = 30, side = 0.25) => { show(N.MAC); N.macroSet(tau); const c = N.macTip(tau).add(v3(4, 3, 0)); cam(orbit(c, r, az, el), c, fov, side); rig(c, 120, 1.6); expo = 0.82; };
  const HOOK0 = { r: 72, az: 0.55, el: 0.36 };
  const hookPlate = (tau) => macro(tau, lerp(HOOK0.r, 62, clamp(tau / 2.9)), HOOK0.az + 0.05 * clamp(tau / 2.9), HOOK0.el);
  S(0, Ls(2) - 0.05, '3D', (u, t) => hookPlate(t), 0);
  // x-ray: the same pencil, cut open along its length
  const xr = (t, t0, opts) => { show(N.XR); N.xraySet(t, opts); const k = E.io(clamp((t - t0) / 4)); const c = L(N.XR, lerp(88, 100, k), 0, 0); cam(orbit(c, lerp(250, 225, k), lerp(-0.2, -0.05, k), 0.95), c, 30, 0.05, -0.18); rig(c, 200, 1.5); expo = 0.8; };
  S(Ls(2) - 0.05, Ls(4) - 0.15, '3D', (u, t) => xr(t, Ls(2), { scan: E.io(clamp((t - Ls(2)) / 1.4)), glow: clamp((t - Wd(3, 'graphite')) / 0.3) }));
  // promise beats (type)
  S(Ls(4) - 0.15, Ls(5) - 0.15, 'TYPE', (u, t, g) => { D.bgGraphite(g, t); promiseIcons(g, t - Ls(4)); });
  S(Ls(5) - 0.15, Ls(6) - 0.15, 'TYPE', (u, t, g) => { heatBg(g, t, t - Ls(5)); });
  // seam teaser: end-on macro of a finished hexagon, the glue line glints
  S(Ls(6) - 0.15, Ls(7) - 0.2, '3D', (u, t) => { show(ST.SHP); ST.secSet(t); ST.seam.material.emissive = new THREE.Color(0xFFD23A); ST.seam.material.emissiveIntensity = 0.6 + 0.6 * Math.max(0, Math.sin((t - Ls(6)) * 3.2));
    const c = L(ST.SEC, 0, 0, 0); cam(c.clone().add(v3(lerp(-14, 6, u), lerp(5, 2, u), lerp(44, 34, E.io(u)))), c, 30, 0.22); rig(c, 160, 2.0); expo = 1.05; });
  S(Ls(7) - 0.2, Ls(8) - 0.1, 'TYPE', (u, t, g) => { D.bgGraphite(g, t, { tone: 1 }); });
  // ---------- CH. 1 ----------
  const tBorr = Wd(9, 'Borrowdale') + 0.6;
  S(Ls(8) - 0.1, tBorr, '2D', (u, t, g) => { D.mapBritain(g, t, t - (Ls(8) - 0.1) - 0.2, { zoom: E.io(clamp((t - Wd(9, 'Borrowdale') + 1.2) / 1.6)) }); });
  S(tBorr, Ls(10) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - tBorr, Ls(10) - tBorr, { img: 'borrowdale', mode: 'full', from: [0.55, 0.52, 1.02], to: [0.6, 0.55, 1.16], credit: 'John Constable, Borrowdale, 1806 · public domain',
    notes: [{ x: 1180, y: 520, lx: 1500, ly: 300, text: 'BORROWDALE', at: 0.4, bend: -0.15 }] }));
  S(Ls(10) - 0.1, Ls(11) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(10), Ls(11) - Ls(10), { img: 'graphite', mode: 'card', cardH: 600, cardX: 640, from: [0.5, 0.5, 1.0], to: [0.5, 0.5, 1.08], credit: 'Graphite · U.S. Geological Survey · public domain',
    notes: [{ px: 0.62, py: 0.35, lx: 1430, ly: 300, text: 'PURE GRAPHITE', at: 0.5, cuts: 3 }] }));
  S(Ls(11) - 0.1, Ls(12) - 0.1, '2D', (u, t, g) => D.leadVsGraphite(g, t, t - Ls(11) + 0.1));
  S(Ls(12) - 0.1, Ls(13) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(12), Ls(13) - Ls(12), { img: 'graphite', mode: 'card', cardH: 640, cardX: 1240, from: [0.45, 0.5, 1.06], to: [0.55, 0.5, 1.0], credit: 'Graphite · U.S. Geological Survey · public domain',
    notes: [{ px: 0.4, py: 0.5, lx: 480, ly: 330, text: '1779: CARBON', at: Wd(12, 'carbon') - Ls(12), circle: 120, col: '#FFD23A', bend: 0.2 }] }));
  S(Ls(13) - 0.1, Ls(14) - 0.1, 'TYPE', (u, t, g) => { D.bgGraphite(g, t, { tone: 1 }); greek(g, t, t - Ls(13)); });
  S(Ls(14) - 0.1, Ls(15) - 0.1, '2D', (u, t, g) => D.blockade(g, t, t - Ls(14) + 0.1));
  S(Ls(15) - 0.1, Ls(16) - 0.1, '2D', (u, t, g) => D.recipeKiln(g, t, t - Ls(15) - 0.1));
  S(Ls(16) - 0.1, Ls(17) - 0.15, '3D', (u, t) => { show(ST.MIXG); const c = L(ST.CUT, lerp(40, 110, E.io(u)), PEN.R * 0.87, 0); cam(c.clone().add(v3(-60, 46, 52)), c, 30, 0.2); rig(c, 200, 2.0); expo = 1.15; });
  // ---------- CH. 2 ----------
  const tDive = Ls(17) + 2.0;
  S(Ls(17) - 0.15, tDive, '3D', (u, t) => { const k = E.i(u); macro(t - Ls(17) + 6, lerp(110, 9, k), 0.4, lerp(0.5, 1.1, k), 30, lerp(0.2, 0, k)); });
  S(tDive, Ls(18) - 0.1, '3D', (u, t) => { show(N.CB); N.carbonSet(t, { build: clamp((t - tDive) / 1.4) }); const c = L(N.LAY, 0, -6, 0); cam(orbit(c, lerp(40, 58, E.io(u)), 0.5, lerp(1.0, 0.55, E.io(u))), c, 34, 0.1); rig(c, 60, 1.8); expo = 1.0; });
  S(Ls(18) - 0.1, Ls(19) - 0.1, '2D', (u, t, g) => D.carbonSheet(g, t, t - Ls(18) + 0.1));
  S(Ls(19) - 0.1, Ls(20) - 0.1, '2D', (u, t, g) => D.carbonBonds(g, t, t - Ls(19) + 0.1));
  S(Ls(20) - 0.1, Ls(21) - 0.1, '2D', (u, t, g) => D.layersSlide(g, t, t - Ls(20) + 0.1, { slide: 0 }));
  S(Ls(21) - 0.1, Ls(22) - 0.1, '3D', (u, t) => { show(N.CB); N.carbonSet(t, { build: 1, slide: E.io(clamp((t - Wd(21, 'slide')) / 1.4)) }); const c = L(N.LAY, 8, -4, 0); cam(orbit(c, lerp(52, 46, u), 0.35, 0.42), c, 34, -0.1); rig(c, 60, 1.8); expo = 1.0; });
  S(Ls(22) - 0.1, Ls(23) - 0.15, '3D', (u, t) => { show(N.CB); N.carbonSet(t, { build: 0 }); const c = L(N.FIB, lerp(-40, 30, u), 4, 0); cam(orbit(c, 70, lerp(0.3, 0.1, u), 0.5), c, 34, 0.1); rig(c, 120, 1.6); expo = 1.0; });
  S(Ls(23) - 0.15, Ls(25) - 0.15, 'TYPE', (u, t, g) => D.diamondVsGraphite(g, t, t - Ls(23)));
  S(Ls(25) - 0.15, Ls(26) - 0.1, '2D', (u, t, g) => D.crumble(g, t, t - Ls(25)));
  // ---------- CH. 3 ----------
  S(Ls(26) - 0.1, Ls(27) - 0.1, 'ARCH', (u, t, g) => { const a = t - Ls(26), d = Ls(27) - Ls(26);
    D.archival(g, t, a, d, { img: 'graphite', mode: 'card', cardH: 420, cardX: 600, cardY: -20, from: [0.5, 0.5, 1.0], to: [0.5, 0.5, 1.06] });
    D.archival(g, t, a - 0.5, d, { img: 'clay', mode: 'card', cardH: 420, cardX: 1320, cardY: -20, nobg: true, from: [0.5, 0.5, 1.0], to: [0.5, 0.5, 1.06], credit: 'Graphite, kaolinite clay · U.S. Geological Survey · public domain' }); });
  S(Ls(27) - 0.1, Ls(28) - 0.1, '3D', (u, t) => { show(ST.MIXG); ST.mixerSet(t); const c = L(ST.MXR, 0, 160, 0); cam(c.clone().add(v3(lerp(-300, -240, u), lerp(420, 380, u), lerp(560, 500, u))), c, 34, -0.25); rig(c, 500, 2.3); expo = 1.2; });
  S(Ls(28) - 0.1, Ls(29) - 0.1, '3D', (u, t) => { show(ST.MIXG); ST.extSet(t); const c = L(ST.EXT, lerp(80, 220, E.io(u)), 100, 0); cam(c.clone().add(v3(lerp(260, 220, u), 130, 340)), c, 34, 0.2); rig(c, 400, 2.0); expo = 1.2; });
  S(Ls(29) - 0.1, Ls(30) - 0.1, '2D', (u, t, g) => D.stringsDry(g, t, t - Ls(29) + 0.1));
  S(Ls(30) - 0.1, Ls(31) - 0.1, '3D', (u, t) => { show(ST.MIXG); ST.kilnSet(t); const c = L(ST.KIL, 0, 300, 450); cam(c.clone().add(v3(lerp(-560, -420, u), 300, lerp(1400, 1250, u))), c, 34, 0.25); rig(c, 900, 1.2); pt(glow, L(ST.KIL, 0, 450, 0), 1600, 3000, 0xFF5A2B); expo = 0.85; });
  S(Ls(31) - 0.1, Ls(32) - 0.1, '3D', (u, t) => { show(ST.MIXG); ST.kilnSet(t); const c = L(ST.KIL, 0, 285, 200); cam(c.clone().add(v3(lerp(220, 150, u), 100, lerp(320, 270, u))), c, 34, -0.2); rig(c, 500, 0.5); pt(glow, L(ST.KIL, 0, 420, 100), 800, 2000, 0xFF5A2B); expo = 0.5; });
  S(Ls(32) - 0.1, Ls(33) - 0.2, '2D', (u, t, g) => D.waxPores(g, t, t - Ls(32) + 0.1));
  S(Ls(33) - 0.2, Ls(34) - 0.1, 'TYPE', (u, t, g) => { D.bgPaper(g, t, { dark: 0.1 }); twoLines(g, t, t - Ls(33)); });
  const coreShot = (t, ratio, side) => { show(N.CR); N.coreSet(t, ratio); const c = L(N.CR, 0, 0, 0); cam(orbit(c, 260, 0.3, 0.2), c, 34, side); rig(c, 200, 1.8); expo = 1.1; };
  const rB = (t) => lerp(0.5, 0.88, E.io(clamp((t - Wd(35, 'graphite')) / 0.8))), rH = (t) => lerp(0.88, 0.18, E.io(clamp((t - Wd(36, 'clay')) / 0.8)));
  S(Ls(34) - 0.1, tPB, '3D', (u, t) => coreShot(t, rB(t), 0.25));
  S(tPB, Ls(36) - 0.1, '3D', (u, t) => { show(ST.MIXG); ST.hbSet(t); const c = L(ST.PAP, lerp(-40, 40, E.io(u)), 0, -10); cam(c.clone().add(v3(-40, 260, 230)), c, 34, -0.2); rig(c, 300, 1.4); expo = 1.05; });
  S(Ls(36) - 0.1, tPH, '3D', (u, t) => coreShot(t, rH(t), -0.25));
  S(tPH, Ls(37) - 0.1, '3D', (u, t) => { show(ST.MIXG); ST.hbSet(t); const c = L(ST.PAP, lerp(-60, 60, E.io(u)), 0, 25); cam(c.clone().add(v3(60, 220, 210)), c, 34, 0.2); rig(c, 300, 1.4); expo = 1.05; });
  S(Ls(37) - 0.1, Ls(39) - 0.2, '2D', (u, t, g) => D.hbScale(g, t, t - Ls(37) + 0.1, { focusHB: clamp((t - Wd(38, 'middle')) / 0.5) }));
  // ---------- CH. 4 ----------
  S(Ls(39) - 0.2, Ls(40) - 0.1, 'TYPE', (u, t, g) => { D.bgGraphite(g, t); ringsBg(g, t, t - Ls(39)); });
  S(Ls(40) - 0.1, Ls(41) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(40), Ls(41) - Ls(40), { img: 'cedar', mode: 'full', from: [0.5, 0.75, 1.0], to: [0.5, 0.42, 1.18], credit: 'Incense cedar · Geographer (en.wikipedia) · CC BY 1.0',
    notes: [{ x: 960, y: 640, lx: 1450, ly: 330, text: 'INCENSE CEDAR', at: 0.5, bend: -0.2 }] }));
  S(Ls(41) - 0.1, Ls(42) - 0.1, '3D', (u, t) => { show(ST.SAW); ST.sawSet(t); const c = L(ST.SAW, -40, ST.BH + ST.logR * 1.2, 60); cam(c.clone().add(v3(lerp(-520, -460, u), lerp(300, 260, u), lerp(700, 620, u))), c, 34, 0.15); rig(c, 600, 2.4); shake = Math.abs(t - Wd(41, 'cut') - 0.1) < 0.12 ? 2 : 0; expo = 1.2; });
  S(Ls(42) - 0.1, Ls(43) - 0.1, '2D', (u, t, g) => D.slatRuler(g, t, t - Ls(42) + 0.1));
  S(Ls(43) - 0.1, Ls(44) - 0.1, '3D', (u, t) => { show(ST.SAW); ST.planerSet(t, Ls(43) - 0.4); const c = L(ST.PL, lerp(-260, -60, E.io(u)), ST.BH, 0); cam(c.clone().add(v3(-180, 230, 330)), c, 34, 0.15); rig(c, 400, 2.4); expo = 1.2; });
  S(Ls(44) - 0.1, Ls(45) - 0.1, '3D', (u, t) => { show(ST.SAW); ST.planerSet(t, Ls(44) - 0.9); const c = L(ST.PL, lerp(120, 260, E.io(u)), ST.BH, 0); cam(c.clone().add(v3(-120, 170, 230)), c, 34, -0.15); rig(c, 400, 2.4); expo = 1.2; });
  S(Ls(45) - 0.1, Ls(47) - 0.15, '2D', (u, t, g) => D.grooveHalf(g, t, t - Ls(45) + 0.1));
  // ---------- CH. 5 ----------
  S(Ls(47) - 0.15, Ls(48) - 0.1, '3D', (u, t) => { show(ST.SAN); ST.sandwichSet(t, { press: false }); const c = L(ST.SW, lerp(-30, 30, u), 6, 0); cam(c.clone().add(v3(-170, 200, 250)), c, 34, 0.2); rig(c, 300, 2.3); expo = 1.2; });
  S(Ls(48) - 0.1, Ls(49) - 0.1, '3D', (u, t) => { show(ST.SAN); ST.sandwichSet(t, { press: t > Wd(48, 'press') - 0.3 }); const c = L(ST.SW, 0, 12, 0); cam(c.clone().add(v3(lerp(260, 220, u), 140, lerp(320, 280, u))), c, 34, -0.2); rig(c, 300, 2.3); expo = 1.2; });
  S(Ls(49) - 0.1, Ls(50) - 0.15, '3D', (u, t) => { show(ST.SAN); ST.sandwichSet(t, { press: true }); const c = L(ST.SW, 0, 30, 0); cam(c.clone().add(v3(-70, 80, 380)), c, 34, 0.2); rig(c, 400, 2.3); const pa = ST.pressSlow(t) - (Wd(48, 'press') + 0.05) - 0.45; shake = pa > 0 && pa < 0.1 ? 3 : 0; expo = 1.2; });
  S(Ls(50) - 0.15, Ls(52) - 0.1, 'TYPE', (u, t, g) => D.cutaway2(g, t, t - Ls(50), { open: E.io(clamp((t - Wd(51, 'two') + 0.1) / 0.6)) }));
  S(Ls(52) - 0.1, Ls(53) - 0.1, '2D', (u, t, g) => D.glueRuns(g, t, t - Ls(52) + 0.1));
  S(Ls(53) - 0.1, Ls(54) - 0.1, '2D', (u, t, g) => D.hexCut(g, t, t - Ls(53) + 0.1));
  S(Ls(54) - 0.1, Ls(55) - 0.1, '3D', (u, t) => { const k = clamp((t - ST_fan0) / 1.0); if (t < ST_fan0) { show(ST.SHP); ST.cutterSet(t); const c = L(ST.CUTR, 0, SLAT.T, 0); cam(c.clone().add(v3(-170, 110, 230)), c, 34, 0.2); rig(c, 300, 2.3); }
    else { show(ST.SHP); ST.fanSet(t); const c = L(ST.FANG, 30, 0, 0); cam(c.clone().add(v3(lerp(-90, -50, k), lerp(280, 300, k), lerp(200, 170, k))), c, 34, 0.25); rig(c, 260, 2.3); } expo = 1.2; });
  const ST_fan0 = Wd(54, 'pencils') - 0.45;
  S(Ls(55) - 0.1, Ls(56) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(55), Ls(56) - Ls(55), { img: 'patent', mode: 'card', cardH: 470, cardX: 860, from: [0.42, 0.62, 1.0], to: [0.5, 0.62, 1.1], credit: 'US Patent 19,783 (1858), H. L. Lipman · public domain',
    notes: [{ px: 0.45, py: 0.86, lx: 1500, ly: 860, text: 'WOOD AROUND A CORE', at: 0.6, bend: 0.15 }] }));
  S(Ls(56) - 0.1, Ls(57) - 0.15, '3D', (u, t) => { show(N.FAC); N.factorySet(t); const c = L(N.FAC, lerp(-200, 200, u), 760, 0); cam(c.clone().add(v3(-900, 620, 1500)), c, 34, 0.1, 0.1); rig(c, 2500, 2.0); expo = 1.2; });
  // ---------- CH. 6 ----------
  S(Ls(57) - 0.15, Ls(58) - 0.1, '3D', (u, t) => { show(ST.FIN); ST.dipSet(t); const c = L(ST.TANK, 0, 150, 0); cam(c.clone().add(v3(-140, 110, 260)), c, 34, 0.2); rig(c, 300, 1.5); expo = 0.9; });
  S(Ls(58) - 0.1, Ls(59) - 0.1, '2D', (u, t, g) => D.coats(g, t, t - Ls(58) + 0.1));
  S(Ls(59) - 0.1, Ls(60) - 0.1, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(59), Ls(60) - Ls(59), { img: 'patent', mode: 'card', cardH: 520, cardX: 960, from: [0.3, 0.6, 1.25], to: [0.24, 0.62, 1.4], credit: 'US Patent 19,783 (1858), H. L. Lipman · public domain' }));
  S(Ls(60) - 0.1, Ls(61) - 0.15, 'ARCH', (u, t, g) => D.archival(g, t, t - Ls(60), Ls(61) - Ls(60), { img: 'patent', mode: 'card', cardH: 470, cardX: 860, from: [0.5, 0.5, 1.0], to: [0.5, 0.45, 1.06], credit: 'US Patent 19,783 (1858), H. L. Lipman · public domain',
    notes: [{ px: 0.9, py: 0.86, lx: 1560, ly: 860, text: 'ERASER', at: 1.2, circle: 70 }, { px: 0.72, py: 0.28, lx: 1560, ly: 250, text: '1858', at: Wd(60, 'eighteen') - Ls(60) + 0.1 }] }));
  S(Ls(61) - 0.15, Ls(62) - 0.1, 'TYPE', (u, t, g) => { D.archival(g, t, t - Ls(60), 8, { img: 'patent', mode: 'card', cardH: 470, cardX: 860, from: [0.5, 0.45, 1.06], to: [0.5, 0.45, 1.1] }); g.fillStyle = 'rgba(14,17,23,0.55)'; g.fillRect(0, 0, W, H); });
  S(Ls(62) - 0.1, Wd(62, 'eraser') + 0.3, '3D', (u, t) => { show(ST.FIN); ST.asmSet(t); const c = L(ST.ASM, ST.xFerC, 0, 0); cam(c.clone().add(v3(lerp(-40, -16, u), 50, 110)), c, 32, 0.2); rig(c, 120, 1.1); expo = 0.95; });
  S(Wd(62, 'eraser') + 0.3, Ls(64) - 0.1, '3D', (u, t) => { show(ST.FIN); ST.asmSet(t); const c = L(ST.ASM, lerp(PEN.L - 20, PEN.cone + PEN.body - 40, E.io(clamp((t - Wd(63, 'stamp') + 0.5) / 0.4))), 0, 0); cam(c.clone().add(v3(-36, 42, 120)), c, 32, -0.2); rig(c, 140, 1.1); expo = 0.95; });
  S(Ls(64) - 0.1, Ls(65) - 0.2, '2D', (u, t, g) => D.fullSection(g, t, t - Ls(64) + 0.1));
  // ---------- PAYOFF: the pencil writes the first line again; the last payoff frame = frame 0 ----------
  const tPay2 = Ls(66) - 0.1, payEnd = tEnd0;
  S(Ls(65) - 0.2, tPay2, '3D', (u, t) => { const tau = (t - payEnd) + 1 / 30 - 0; macro(tau + 0, lerp(160, 110, E.io(u)), lerp(-0.4, 0.1, u), lerp(0.7, 0.45, u), 30, 0.25); });
  S(tPay2, payEnd, '3D', (u, t) => { const tau = t - payEnd + 1 / 30; const k = E.io(u); macro(tau, lerp(110, HOOK0.r, k), lerp(0.1, HOOK0.az, k), lerp(0.45, HOOK0.el, k), 30, 0.25); });
  // ---------- END SCREEN: quiet factory loop (rendered once: 4.333 s, repeated) ----------
  const endPlate = (t) => { const lt0 = ((t - payEnd) % LOOPF + LOOPF) % LOOPF; show(N.FAC); N.factorySet(lt0 + 20); const c = L(N.FAC, 0, 760, 0); cam(c.clone().add(v3(-700, 520, 1300)), c, 34, 0, -0.15); rig(c, 2500, 1.6); expo = 0.75; };
  S(payEnd, END + 1, '3D', (u, t) => endPlate(t), 0);
  const shotAt = (t) => shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  function stateAt(t) {
    TT = t; shake = 0; expo = 1.2; glow.intensity = 0; acc.intensity = 0; spotG.intensity = spotR.intensity = 0;
    all3.forEach(o => o.visible = false); ST.HK.visible = false; ST.seam.material.emissiveIntensity = 0;
    const sh = shotAt(t); if (sh.type === '3D') sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    ctx.renderer.toneMappingExposure = expo;
    glow.visible = glow.intensity > 0; acc.visible = acc.intensity > 0; spotG.visible = spotG.intensity > 0; spotR.visible = spotR.intensity > 0;
    scene.updateMatrixWorld(true); return sh;
  }
  const proj = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W / TS, y: (1 - p.y) / 2 * H / TS }; };
  const anchorOf = (fn) => (tt) => { stateAt(tt); return proj(fn(tt)); };

  // ---------------- 2D helpers used by type shots (plate side) ----------------
  function promiseIcons(g, t, ) { const a = t;
    // a log (left) and a graphite rock (right), each popping in on its word
    const la = a - (Wd(4, 'tree') - Ls(4)), ra = a - (Wd(4, 'rock') - Ls(4));
    if (la > 0) { const s = D.pop(la); g.save(); g.translate(560, 640); g.scale(s, s); g.rotate(-0.08); g.fillStyle = '#6b4a33'; D.rr(g, -230, -90, 420, 180, 90); g.fill(); g.fillStyle = D.P.cedar; g.beginPath(); g.ellipse(190, 0, 60, 90, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = D.P.cedarD; g.lineWidth = 5; for (let r = 15; r < 60; r += 15) { g.beginPath(); g.ellipse(190, 0, r, r * 1.5, 0, 0, Math.PI * 2); g.stroke(); } g.restore(); }
    if (ra > 0) { const s = D.pop(ra); g.save(); g.translate(1360, 640); g.scale(s, s); g.fillStyle = '#23262c'; g.beginPath(); [[-170, 40], [-120, -90], [-10, -140], [130, -100], [180, 10], [110, 100], [-60, 110]].forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(190,200,215,0.55)'; g.lineWidth = 4; g.stroke(); for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(220,228,240,0.5)'; g.fillRect(-120 + hash(i) * 240, -90 + hash(i * 3) * 160, 26, 4); } g.restore(); }
    const pa = a - (Wd(4, 'pencil') - Ls(4)); if (pa > 0) { const s = D.pop(pa); g.save(); g.translate(960, 860); g.scale(s, s); g.fillStyle = D.P.acc; g.fillRect(-300, -26, 560, 52); g.fillStyle = D.P.cedar; g.beginPath(); g.moveTo(-300, -26); g.lineTo(-380, 0); g.lineTo(-300, 26); g.fill(); g.fillStyle = '#2a2e36'; g.beginPath(); g.moveTo(-352, -9); g.lineTo(-380, 0); g.lineTo(-352, 9); g.fill(); g.fillStyle = '#C9CED6'; g.fillRect(260, -28, 40, 56); g.fillStyle = '#F29AA8'; D.rr(g, 300, -24, 40, 48, 10); g.fill(); g.restore(); }
  }
  function heatBg(g, t, a) {
    const r = g.createRadialGradient(W / 2, H * 0.9, 50, W / 2, H * 0.6, W * 0.7); const k = clamp(a / 1.2);
    r.addColorStop(0, `rgba(255,120,40,${0.75 * k})`); r.addColorStop(0.45, `rgba(140,40,10,${0.6 * k})`); r.addColorStop(1, '#0E1117'); g.fillStyle = '#0E1117'; g.fillRect(0, 0, W, H); g.fillStyle = r; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { const ph = (t * (0.25 + 0.3 * hash(i)) + hash(i * 3)) % 1, x = hash(i * 7) * W + 40 * Math.sin(t * 2 + i), y = H - ph * H * 1.1; g.fillStyle = `rgba(255,${150 + 80 * hash(i)},60,${(1 - ph) * 0.8 * k})`; g.beginPath(); g.arc(x, y, 2 + 3 * hash(i * 5), 0, Math.PI * 2); g.fill(); }
  }
  function greek(g, t, a) { g.save(); g.globalAlpha = 0.16 * clamp(a / 0.6); g.fillStyle = D.P.cold; g.font = `400 300px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('γράφειν', 960 + 30 * Math.sin(t * 0.4), 560); g.restore(); }
  function twoLines(g, t, a) { const draw = (y, col, w, d) => { const p = E.io(clamp((a - d) / 1.2)); g.save(); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i <= 100 * p; i++) { const u = i / 100, x = lerp(300, 1620, u), yy = y + Math.sin(u * 10) * 18; i ? g.lineTo(x, yy) : g.moveTo(x, yy); } if (p > 0) g.stroke(); g.restore(); };
    draw(620, 'rgba(20,22,26,0.95)', 34, 0.2); draw(820, 'rgba(120,126,136,0.7)', 12, 0.6); }
  function ringsBg(g, t, a) { g.save(); g.translate(1450, 600); g.rotate(t * 0.05); for (let r = 30; r < 520; r += 26 + 10 * hash(r)) { g.strokeStyle = `rgba(227,154,82,${0.12 + 0.12 * hash(r * 3)})`; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, r * clamp(a / 1.2 + 0.2), r * 0.92 * clamp(a / 1.2 + 0.2), 0, 0, Math.PI * 2); g.stroke(); } g.restore(); }

  // ---------------- overlay: text events (virtual coords, drawn at TS) ----------------
  const TEXT = []; const T_ = (o) => { TEXT.push(o); return o; };
  const VX = (x) => x / TS, VY = (y) => y / TS;
  // hook
  T_({ k: 'titlecard', at: -1, until: 2.5 });
  T_({ k: 'strike', at: Ls(2) + 0.1, strikeAt: Wd(3, 'graphite') - 0.32, until: Ls(4) - 0.2, word: 'LEAD', repl: 'GRAPHITE', y: VY(200), size: 190, cx: VX(1380), ek: 'twist' });
  T_({ k: 'cap', at: Wd(4, 'tree'), until: Ls(5) - 0.2, words: [{ t: 'A TREE', k: 'noun' }, { t: '+', k: 'noun', at: Wd(4, 'and') }, { t: 'A ROCK', a: true, k: 'noun', at: Wd(4, 'rock') }], y: VY(260), size: 120 });
  T_({ k: 'odo', at: Wd(5, 'eleven'), until: Ls(6) - 0.2, value: 1100, unit: '°C', pre: 'ABOUT', y: VY(640), size: 300 });
  T_({ k: 'cap', at: Wd(5, 'oven'), until: Wd(5, 'eleven') - 0.04, words: [{ t: 'AN OVEN', a: true, k: 'noun' }], y: VY(300), size: 120 });
  T_({ k: 'cap', at: Wd(6, 'glued'), until: Ls(7) - 0.25, words: [{ t: 'ONE', k: 'noun' }, { t: 'GLUED SEAM', a: true, k: 'twist', at: Wd(6, 'seam') - 0.2 }], y: VY(180), cx: VX(620), size: 110 });
  T_({ k: 'cap', at: Ls(7) - 0.1, until: Ls(8) - 0.15, words: [{ t: 'WHY', k: 'q' }, { t: '"LEAD"?', a: true, k: 'q', at: Wd(7, 'name') }], y: VY(540), size: 170 });
  // lower-thirds
  for (const c of CH) T_({ k: 'lower', at: c.at + 0.2, until: c.at + 3.6, n: c.n, title: c.title });
  // CH. 1
  T_({ k: 'cap', at: Wd(8, 'why'), until: Wd(9, 'Borrowdale') - 0.6, words: [{ t: 'WHY', k: 'q' }, { t: 'LEAD?', a: true, k: 'q', at: Wd(8, 'lead') }], y: VY(150), cx: VX(1500), size: 120 });
  T_({ k: 'cap', at: Wd(10, 'sawn'), until: Ls(11) - 0.15, words: [{ t: 'SAWN', k: 'verb' }, { t: 'INTO STICKS', a: true, k: 'verb', at: Wd(10, 'sticks') - 0.2 }], y: VY(860), cx: VX(1420), size: 90, dir: 1 });
  T_({ k: 'cap', at: Wd(11, 'black'), until: Ls(12) - 0.15, words: [{ t: '"BLACK LEAD"', a: true, k: 'noun' }], y: VY(150), size: 110 });
  T_({ k: 'cap', at: Ls(13), until: Wd(13, 'graphite') - 0.05, words: [{ t: 'GRAPHEIN', k: 'noun' }, { t: '= TO WRITE', a: true, k: 'verb', at: Wd(13, 'Greek') }], y: VY(520), size: 150 });
  T_({ k: 'cap', at: Wd(13, 'graphite'), until: Ls(14) - 0.15, words: [{ t: 'GRAPHITE', a: true, k: 'twist' }], y: VY(520), size: 220, hit: { kind: 'graphite' } });
  T_({ k: 'chip', at: Ls(13) + 0.2, until: Ls(14) - 0.15, text: '1789', x: 960, y: 820 });
  // CH. 2
  T_({ k: 'cap', at: Wd(17, 'strange'), until: Ls(18) - 0.2, words: [{ t: 'SOMETHING', k: 'noun' }, { t: 'STRANGE', a: true, k: 'twist', at: Wd(17, 'strange') + 0.1 }], y: VY(160), size: 100 });
  T_({ k: 'cap', at: Wd(21, 'cards'), until: Ls(22) - 0.15, words: [{ t: 'LIKE CARDS', a: true, k: 'verb' }], y: VY(160), cx: VX(1350), size: 100, dir: 1 });
  T_({ k: 'callout', at: Wd(22, 'fibres') - 0.1, until: Ls(23) - 0.2, text: 'PAPER FIBRES', anchor: anchorOf(() => L(N.FIB, -30, 10, 30)), dx: -220, dy: -200 });
  T_({ k: 'callout', at: Wd(22, 'flakes') - 0.05, until: Ls(23) - 0.2, text: 'GRAPHITE FLAKES', anchor: anchorOf(() => L(N.FIB, 30, 8, 0)), dx: 220, dy: -260 });
  T_({ k: 'cap', at: Wd(23, 'diamond'), until: Ls(24) - 0.1, words: [{ t: 'DIAMOND', k: 'noun' }, { t: '= SAME ATOMS', a: true, k: 'twist', at: Wd(23, 'same') }], y: VY(150), size: 110 });
  T_({ k: 'cap', at: Wd(24, 'hardest'), until: Wd(24, 'softest') - 0.05, words: [{ t: 'HARDEST', a: true, k: 'noun' }], y: VY(900), cx: VX(560), size: 110 });
  T_({ k: 'cap', at: Wd(24, 'softest'), until: Ls(25) - 0.2, words: [{ t: 'SOFTEST', a: true, k: 'noun' }], y: VY(900), cx: VX(1360), size: 110 });
  // CH. 3
  T_({ k: 'cap', at: Wd(26, 'graphite'), until: Ls(27) - 0.15, words: [{ t: 'GRAPHITE', k: 'noun' }, { t: '+ CLAY', a: true, k: 'noun', at: Wd(26, 'clay') }], y: VY(150), size: 110 });
  T_({ k: 'callout', at: Wd(27, 'water'), until: Ls(28) - 0.15, text: 'WATER', anchor: anchorOf(() => L(ST.MXR, 70, 330, 0)), dx: 220, dy: -120 });
  T_({ k: 'cap', at: Wd(28, 'squeezed'), until: Ls(29) - 0.15, words: [{ t: 'SQUEEZED', a: true, k: 'verb' }, { t: 'INTO STRINGS', k: 'noun', at: Wd(28, 'strings') }], y: VY(150), cx: VX(1300), size: 96, dir: 1 });
  T_({ k: 'odo', at: Wd(30, 'eleven'), until: Ls(32) - 0.15, value: 1100, unit: '°C', pre: 'ABOUT', y: VY(330), cx: VX(430), size: 230, morph: { at: Wd(31, 'bakes') - 0.1, label: 'BAKED', to: { x: VX(1150), y: VY(180) } } });
  T_({ k: 'cap', at: Ls(33), until: Ls(34) - 0.15, words: [{ t: 'WHY', k: 'q' }, { t: 'DARKER?', a: true, k: 'q', at: Wd(33, 'darker') }], y: VY(300), size: 160 });
  T_({ k: 'cap', at: Wd(34, 'recipe'), until: Ls(35) - 0.1, words: [{ t: 'THE RECIPE', a: true, k: 'noun' }], y: VY(150), cx: VX(620), size: 100 });
  T_({ k: 'ratio', at: Ls(35) - 0.1, until: Ls(37) - 0.15 });
  T_({ k: 'cap', at: Wd(35, 'softer'), until: Ls(36) - 0.15, words: [{ t: 'SOFTER', k: 'noun' }, { t: 'DARKER', a: true, k: 'noun', at: Wd(35, 'darker') }], y: VY(150), cx: VX(1300), size: 96 });
  T_({ k: 'cap', at: Wd(36, 'harder'), until: Ls(37) - 0.15, words: [{ t: 'HARDER', k: 'noun' }, { t: 'LIGHTER', a: true, k: 'noun', at: Wd(36, 'lighter') }], y: VY(150), cx: VX(620), size: 96 });
  // CH. 4
  T_({ k: 'cap', at: Ls(39) + 0.1, until: Wd(39, 'core') - 0.05, words: [{ t: 'NOW,', k: 'noun' }, { t: 'THE WOOD.', a: true, k: 'noun', at: Wd(39, 'wood') }], y: VY(420), cx: VX(700), size: 150 });
  T_({ k: 'cap', at: Wd(39, 'core'), until: Ls(40) - 0.15, words: [{ t: 'CORE', k: 'noun' }, { t: 'INSIDE?', a: true, k: 'q', at: Wd(39, 'inside') }], y: VY(420), cx: VX(700), size: 150 });
  T_({ k: 'cap', at: Wd(41, 'blocks'), until: Ls(42) - 0.15, words: [{ t: 'BLOCKS', k: 'noun' }, { t: 'THIN SLATS', a: true, k: 'noun', at: Wd(41, 'slats') }], y: VY(150), cx: VX(1350), size: 96 });
  T_({ k: 'odo', at: Wd(42, 'eighteen'), until: Wd(42, 'half') - 0.1, value: 18, unit: 'CM', pre: 'ABOUT', y: VY(330), size: 170 });
  T_({ k: 'odo', at: Wd(42, 'half'), until: Ls(43) - 0.15, value: '0.6', unit: 'CM', pre: 'THICK', y: VY(900), cx: VX(1650), size: 150 });
  T_({ k: 'cap', at: Ls(43), until: Ls(44) - 0.15, words: [{ t: 'DRIED', k: 'verb' }, { t: 'STAINED', k: 'verb', at: Wd(43, 'stained') }, { t: 'WAXED', a: true, k: 'verb', at: Wd(43, 'waxed') }], y: VY(150), size: 96, dir: 1 });
  T_({ k: 'cap', at: Wd(44, 'grooves') - 0.1, until: Ls(45) - 0.15, words: [{ t: 'PARALLEL', k: 'noun' }, { t: 'GROOVES', a: true, k: 'noun', at: Wd(44, 'grooves') }], y: VY(150), cx: VX(620), size: 96 });
  T_({ k: 'cap', at: Ls(46), until: Wd(46, 'Because') - 0.05, words: [{ t: 'WHY', k: 'q' }, { t: 'HALF?', a: true, k: 'q', at: Wd(46, 'half') }], y: VY(160), size: 130 });
  T_({ k: 'cap', at: Wd(46, 'two'), until: Ls(47) - 0.2, words: [{ t: 'TWO SLATS', a: true, k: 'twist' }], y: VY(160), size: 130 });
  // CH. 5
  T_({ k: 'callout', at: Wd(47, 'Glue') + 0.05, until: Wd(47, 'core') + 0.4, text: 'GLUE', anchor: anchorOf((tt) => L(ST.SW, lerp(-SLAT.L / 2, SLAT.L / 2, clamp((tt - Ls(47) + 0.05) / 0.7)) - 10, SLAT.T + 2, -grooveX(0))), dx: -220, dy: -160 });
  T_({ k: 'callout', at: Wd(47, 'core') + 0.45, until: Ls(48) - 0.15, text: 'CORES', anchor: anchorOf(() => L(ST.SW, 40, SLAT.T + 1, -grooveX(6))), dx: 220, dy: -180 });
  T_({ k: 'cap', at: Wd(48, 'second'), until: Ls(49) - 0.15, words: [{ t: 'SECOND', k: 'noun' }, { t: 'SLAT', a: true, k: 'noun', at: Wd(48, 'slat') }], y: VY(150), size: 100, hit: { kind: 'wood' } });
  T_({ k: 'cap', at: Wd(49, 'glue'), until: Ls(50) - 0.2, words: [{ t: 'UNTIL', k: 'noun' }, { t: 'THE GLUE SETS', a: true, k: 'verb', at: Wd(49, 'sets') - 0.2 }], y: VY(150), size: 96 });
  T_({ k: 'strike', at: Ls(50), strikeAt: Wd(51, 'two') - 0.32, until: Ls(52) - 0.15, word: 'ONE PIECE?', repl: 'TWO HALVES.', y: VY(500), cx: VX(620), size: 170, ek: 'q' });
  T_({ k: 'cap', at: Wd(53, 'hexagons'), until: Ls(54) - 0.15, words: [{ t: 'HEXAGONS', a: true, k: 'noun' }], y: VY(860), size: 110 });
  T_({ k: 'odo', at: Wd(54, 'Six'), until: Ls(55) - 0.15, value: '6–9', unit: '', sub: 'PENCILS PER SANDWICH', y: VY(260), cx: VX(1350), size: 200 });
  T_({ k: 'cap', at: Wd(55, 'old'), until: Wd(55, 'still') - 0.05, words: [{ t: 'AN OLD IDEA', a: true, k: 'noun' }], y: VY(150), cx: VX(1350), size: 96 });
  T_({ k: 'cap', at: Wd(55, 'still'), until: Ls(56) - 0.15, words: [{ t: 'STILL', k: 'noun' }, { t: 'HOW IT\'S DONE', a: true, k: 'noun', at: Wd(55, 'how') }], y: VY(150), cx: VX(1350), size: 96 });
  T_({ k: 'cap', at: Wd(56, 'colour'), until: Ls(57) - 0.2, words: [{ t: 'THEY NEED', k: 'noun' }, { t: 'COLOUR', a: true, k: 'twist', at: Wd(56, 'colour') }], y: VY(160), size: 120 });
  // CH. 6
  T_({ k: 'cap', at: Wd(57, 'coat'), until: Ls(58) - 0.15, words: [{ t: 'COAT', k: 'noun' }, { t: 'AFTER', k: 'noun', at: Wd(57, 'after') }, { t: 'COAT', a: true, k: 'noun', at: Wd(57, 'coat', 1) }], y: VY(150), size: 110 });
  T_({ k: 'cap', at: Wd(59, 'eraser'), until: Ls(60) - 0.15, words: [{ t: 'THE ERASER', a: true, k: 'noun' }], y: VY(150), cx: VX(1350), size: 100 });
  T_({ k: 'stamp', at: Wd(61, 'invalid') - 0.1, until: Ls(62) - 0.15 });
  T_({ k: 'cap', at: Ls(61), until: Ls(62) - 0.15, words: [{ t: '1875', k: 'noun' }, { t: 'US SUPREME COURT', a: true, k: 'noun', at: Wd(61, 'Supreme') }], y: VY(180), size: 100 });
  T_({ k: 'callout', at: Wd(62, 'ferrule') - 0.05, until: Wd(62, 'eraser') + 0.25, text: 'FERRULE', anchor: anchorOf(() => L(ST.ASM, ST.xFerC, PEN.R + 1, 0)), dx: 200, dy: -200 });
  T_({ k: 'callout', at: Wd(62, 'eraser'), until: Ls(63) + 0.6, text: 'ERASER', anchor: anchorOf(() => L(ST.ASM, PEN.L - 4, PEN.R, 0)), dx: -220, dy: -200 });
  T_({ k: 'callout', at: Wd(63, 'grade'), until: Ls(64) - 0.15, text: 'GRADE: HB', anchor: anchorOf(() => L(ST.ASM, PEN.cone + PEN.body - 26, PEN.R + 0.5, 0)), dx: 220, dy: -200 });
  // payoff + end
  T_({ k: 'cap', at: Wd(66, 'graphite'), until: Wd(66, 'Never') - 0.05, words: [{ t: 'GRAPHITE.', a: true, k: 'twist' }], y: VY(180), cx: VX(1300), size: 130, hit: { kind: 'graphite' } });
  T_({ k: 'cap', at: Wd(66, 'Never'), until: payEnd - 0.6, words: [{ t: 'NEVER', k: 'noun' }, { t: 'LEAD.', a: true, k: 'twist', at: Wd(66, 'lead') }], y: VY(180), cx: VX(1300), size: 130 });
  T_({ k: 'titlecard', at: payEnd - 0.55, until: payEnd + 0.4, bookend: true });
  T_({ k: 'end', at: payEnd + 0.3, until: END + 1 });

  // ---------- real-coordinate overlay pieces ----------
  function titleCard(g, t, o) {
    const a = t - o.at, r = o.until - t; if (r < 0) return; const ina = o.at < 0 ? 1 : E.o(clamp(a / 0.4)), out = clamp(r / 0.3);
    g.save(); g.globalAlpha = out; const x = 90, y = 90 + 20 * (1 - ina);
    g.fillStyle = D.P.acc; g.fillRect(x, y, 10 * ina, 112); g.font = `400 26px ${D.FONT.mono}`; g.fillStyle = D.P.cream; g.textBaseline = 'top';
    g.fillText('RAW TO REAL', x + 30, y + 4); g.font = `400 70px ${D.FONT.title}`; g.lineWidth = 9; g.strokeStyle = D.P.ink; g.lineJoin = 'round';
    const txt = 'HOW PENCILS ARE MADE', n = o.at < 0 ? txt.length : Math.floor(clamp(a / 0.5) * txt.length); g.strokeText(txt.slice(0, n), x + 28, y + 36); g.fillStyle = D.P.cream; g.fillText(txt.slice(0, n), x + 28, y + 36);
    g.restore();
  }
  function lowerThird(g, t, o) {
    const a = t - o.at, r = o.until - t; if (a < 0 || r < 0) return;
    const ina = E.o(clamp(a / 0.45)), out = E.i(clamp(1 - r / 0.35)), x = 90, y = 830;
    g.save(); g.font = `400 64px ${D.FONT.title}`; const tw = g.measureText(o.title).width, bw = Math.max(tw, 360) + 70;
    const wipe = bw * ina * (1 - out); g.beginPath(); g.rect(x - 10, y - 20, wipe + 20, 150); g.clip();
    g.fillStyle = 'rgba(14,17,23,0.78)'; D.rr(g, x, y, bw, 120, 16); g.fill(); g.fillStyle = D.P.acc; g.fillRect(x, y, 12, 120);
    g.font = `800 24px ${D.FONT.mono}`; g.fillStyle = D.P.acc; g.textBaseline = 'top'; const lab = `CHAPTER ${o.n}`; const n = Math.floor(clamp((a - 0.15) / 0.3) * lab.length); g.fillText(lab.slice(0, n), x + 34, y + 14);
    g.font = `400 64px ${D.FONT.title}`; g.fillStyle = D.P.cream; const dy = 30 * (1 - E.back(clamp((a - 0.2) / 0.4))); g.globalAlpha = clamp((a - 0.2) / 0.15); g.fillText(o.title, x + 34 + 3 * clamp(a / 3), y + 42 + dy);
    g.restore();
  }
  function endScreen(g, t, o) {
    const a = t - o.at; if (a < 0) return;
    D.label(g, 'NEXT: HOW A BALLPOINT PEN WORKS', 960, 170, a, { size: 52, col: D.P.cream, drift: 0.02 });
    D.label(g, 'SUBSCRIBE: NEW ONE EVERY WEEK', 960, 280, a - 0.4, { size: 40, col: D.P.acc, drift: 0.02 });
    // soft frames where the YouTube elements will sit (only a faint outline, so the areas stay clean)
    const k = clamp((a - 0.8) / 0.8) * 0.42; g.save(); g.globalAlpha = k; g.fillStyle = '#0B0E13'; D.rr(g, 150, 380, 720, 405, 18); g.fill(); D.rr(g, 1050, 380, 720, 405, 18); g.fill(); g.beginPath(); g.arc(960, 880, 92, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function ratioMeter(g, t, o) {     // a small graphite / clay bar that follows the core recipe (real coords, top-left)
    const a = t - o.at, r = o.until - t; if (a < 0 || r < 0) return; const al = clamp(a / 0.3) * clamp(r / 0.2);
    const ratio = t < Ls(36) ? rB(t) : rH(t), x = 120, y = 900, w = 520, h = 34;
    g.save(); g.globalAlpha = al; g.fillStyle = 'rgba(14,17,23,0.7)'; D.rr(g, x - 20, y - 64, w + 40, h + 92, 14); g.fill();
    g.fillStyle = '#2a2e36'; g.fillRect(x, y, w * ratio, h); g.fillStyle = '#A7AEB7'; g.fillRect(x + w * ratio, y, w * (1 - ratio), h);
    g.font = `800 24px ${D.FONT.mono}`; g.textBaseline = 'alphabetic'; g.fillStyle = D.P.cream; g.fillText(`GRAPHITE ${Math.round(ratio * 100)}%`, x, y - 16); g.textAlign = 'right'; g.fillText(`CLAY ${100 - Math.round(ratio * 100)}%`, x + w, y - 16); g.restore();
  }
  function invalidStamp(g, t, o) {
    const a = t - o.at, r = o.until - t; if (a < 0 || r < 0) return; const s = a < 0.12 ? lerp(2.2, 1, E.i(a / 0.12)) : 1 + 0.02 * Math.sin(a * 6), al = clamp(r / 0.15);
    g.save(); g.globalAlpha = al; g.translate(960, 640); g.rotate(-0.12); g.scale(s, s); g.strokeStyle = D.P.red; g.lineWidth = 14; D.rr(g, -330, -90, 660, 180, 20); g.stroke();
    g.font = `400 130px ${D.FONT.title}`; g.fillStyle = D.P.red; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('INVALID', 0, 8); g.restore();
  }
  function drawText(g, t) {
    const sh = shotAt(t); setParallax(((clamp((t - sh.t0) / (sh.t1 - sh.t0)) - 0.5) * 2) * sh.par, 0);
    for (const o of TEXT) {
      if (t < o.at - 0.01 || t > o.until + 0.01) continue;
      if (o.k === 'titlecard') titleCard(g, t, o);
      else if (o.k === 'lower') lowerThird(g, t, o);
      else if (o.k === 'end') endScreen(g, t, o);
      else if (o.k === 'ratio') ratioMeter(g, t, o);
      else if (o.k === 'stamp') invalidStamp(g, t, o);
      else if (o.k === 'chip') D.chip(g, o.text, o.x, o.y, t - o.at, { size: 44, out: clamp((o.until - t) / 0.12) });
      else { g.save(); g.scale(TS, TS);
        if (o.k === 'callout') callout(g, t, o);
        else if (o.k === 'cap') kcap(g, t, { y: VY(150), ...o });
        else if (o.k === 'strike') strike(g, t, { ...o, k: o.ek });
        else if (o.k === 'odo') odometer(g, t, o);
        g.restore(); }
    }
  }

  // ---------------- sound events ----------------
  const sfx = [
    { t: 0.0, n: 'pencil_write' }, { t: Ls(2) - 0.05, n: 'xray_hit' }, { t: Wd(3, 'graphite') - 0.32, n: 'pencil_scribble' }, { t: Wd(3, 'graphite'), n: 'ui_tick' },
    { t: Wd(4, 'tree'), n: 'pop' }, { t: Wd(4, 'rock'), n: 'pop' }, { t: Ls(5) - 0.15, n: 'fire_whoosh' }, { t: Wd(5, 'eleven'), n: 'ui_tick' }, { t: Ls(6) - 0.15, n: 'low_whoosh' }, { t: Wd(6, 'seam'), n: 'sparkle' },
    ...CH.map(c => ({ t: c.at + 0.2, n: 'swipe' })),
    { t: Wd(9, 'Borrowdale'), n: 'pop' }, { t: Ls(11), n: 'pencil_write2' }, { t: Wd(13, 'graphite'), n: 'ui_tick' }, { t: Ls(14) + 1.6, n: 'hit' },
    { t: Ls(17), n: 'swell' }, { t: Wd(21, 'slide'), n: 'whoosh_soft' }, { t: Wd(23, 'diamond'), n: 'sparkle' },
    { t: Wd(27, 'water') - 0.2, n: 'water_pour' }, { t: Ls(27), n: 'mixer' }, { t: Wd(28, 'squeezed') - 0.15, n: 'squish' }, { t: Ls(30) + 0.2, n: 'fire_whoosh' }, { t: Ls(31), n: 'kiln_hum' },
    { t: tPB, n: 'pencil_write' }, { t: tPH, n: 'pencil_write2' },
    { t: Ls(41), n: 'saw' }, { t: Ls(43), n: 'planer' }, { t: Ls(47), n: 'glue_squirt' }, { t: Wd(48, 'top') + 0.02, n: 'wood_tap' }, { t: Wd(48, 'press') + 0.5, n: 'press_thud' },
    { t: Wd(51, 'two') - 0.32, n: 'pencil_scribble' }, { t: Ls(54) - 0.3, n: 'cutter' }, { t: Wd(54, 'pencils') - 0.4, n: 'wood_clatter' }, { t: Ls(56), n: 'factory' },
    { t: Ls(57), n: 'paint_dip' }, { t: Wd(61, 'invalid') - 0.1, n: 'stamp' }, { t: Wd(62, 'ferrule') + 0.1, n: 'crimp' }, { t: Wd(62, 'eraser') + 0.1, n: 'rubber_push' }, { t: Wd(63, 'stamp'), n: 'stamp' },
    { t: Ls(65) - 0.2, n: 'pencil_write3' }, { t: payEnd, n: 'whoosh' },
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
