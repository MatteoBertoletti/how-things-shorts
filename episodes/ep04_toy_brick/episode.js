// EP. 04 — the toy brick. Why it sticks (interference fit: the stud is slightly too big, the plastic bends and squeezes
// back), then how it's made (grains -> melt -> mould -> drop). Hand-free hook in motion at frame 0; the loop frames
// replay the fall so the last frame equals the first. Every state is a pure function of t.
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M, shadowed, factoryFloor, pedestal, gummyBear, hopper } from '../../js/parts.js';
import { hotMat } from '../../js/pencil.js';
import { BR, STUDS, TUBES, COL, plasticMat, setXray, makeBrick, ghostOf, granules, ballpointPen, mouldBlock } from '../../js/brick.js';
import { setAccent, C, SAFE, titleRawReal, kcap, odometer, strike, callout, stepSticker, dock, inkSwipe, blurred, setParallax, endCard2, specks } from '../../js/overlay.js';

export const EP = 'EP. 04';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FF4B3E');
  ctx.bloom.threshold = 0.66; ctx.bloom.strength = 0.4; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x10151D); scene.environmentIntensity = 0.75;
  ctx.renderer.localClippingEnabled = true;

  // ---------------- timing ----------------
  const lines = timing.lines, Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const Wd = (i, w, n = 0) => { const L = lines[i - 1]; const hits = L.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return L.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const LOOP = 0.9, ENDCARD = 2.5;
  const tEC = +(Le(9) - ENDCARD + 0.04).toFixed(3);            // end card: exactly 2.5 s, ends just after the last word
  const END = +(tEC + ENDCARD + LOOP).toFixed(3);
  const tSnap = Math.min(1.2, Wd(1, 'stick') - 0.05);       // R1: the first mechanism shot starts at 1.2 s at the latest

  // ---------------- lights ----------------
  const key = new THREE.DirectionalLight(0xFFB26B, 2.3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.55, 1, 0.55).normalize();
  const fill = new THREE.DirectionalLight(0x6FA8FF, 1.2); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xCFE0FF, 1.0); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0x6FA8FF, 0x241a14, 0.5));
  const glow = new THREE.PointLight(0xFF7A2B, 0, 0, 1.3); scene.add(glow);
  const spotG = new THREE.SpotLight(0x2BD67B, 0, 0, 0.42, 0.6, 0), spotR = new THREE.SpotLight(0xFF3B3B, 0, 0, 0.42, 0.6, 0); scene.add(spotG, spotG.target, spotR, spotR.target);
  let expo = 1.2;
  function rig(tgt, size, k = 2.3) {
    key.intensity = k; key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.85, 0.45, -0.4).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.2, 0.6, -1).multiplyScalar(size * 3));
  }
  const pt = (Lt, p, k, dist, col) => { Lt.position.copy(p); Lt.intensity = k; Lt.distance = dist; if (col !== undefined) Lt.color.set(col); };

  // ---------------- world ----------------
  scene.add(factoryFloor());
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const L = (grp, x, y, z) => v3(x, y, z).applyMatrix4(grp.matrixWorld);
  const station = (x, y = 760) => { const g = new THREE.Group(); g.position.set(x, y, 0); scene.add(g); return g; };
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a5462, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.2 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2a313b, metalness: 0.7, roughness: 0.45 });
  const box = (sx, sy, sz, x, y, z, m, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const plinth = (parent, w, d, col = 0x1b222c) => { const o = box(w, 30, d, 0, -15, 0, M.std(col, { roughness: 0.55, metalness: 0.3 }), parent); return o; };
  const { H: BH, studH } = BR;
  const DMAX = 0.55;                                // bending shown (exaggerated) in mm

  // ================= X: the two bricks (hook, x-ray mechanism, payoff) =================
  const X = station(0); plinth(X, 260, 180);
  const LB = makeBrick(COL.yellow, { outline: true }), UB = makeBrick(COL.red, { outline: true }); X.add(LB, UB);
  const PB = makeBrick(COL.blue, { outline: true }); X.add(PB);   // payoff: blue onto red
  const clipX = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), clipG = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);   // horizontal section just above the cut brick's bottom, seen from above
  const CUTH = 1.15;
  const setCut = (b) => { const y = b.getWorldPosition(new THREE.Vector3()).y + CUTH; clipX.constant = y; clipG.constant = -y; };
  const xb = [LB, UB, PB];
  const ghosts = new Map([[UB, ghostOf(UB, COL.red, clipG)], [PB, ghostOf(PB, COL.blue, clipG)]]); ghosts.forEach(g => X.add(g));
  const xrayOn = (u, which = xb) => { xb.forEach(b => { const on = (which.includes(b) && b !== LB && !(b === UB && which.includes(PB))) ? u : 0; b.userData.mat.clippingPlanes = on > 0.5 ? [clipX] : []; b.userData.lineMat.opacity = (b === LB && which.includes(LB) ? u : on) * 0.9; b.userData.lineMat.clippingPlanes = on > 0.5 ? [clipX] : [];
    const gh = ghosts.get(b); if (gh) { gh.visible = on > 0.5 && b.visible; gh.position.copy(b.position); gh.rotation.copy(b.rotation); } if (on > 0.5) { b.updateMatrixWorld(); setCut(b); } }); };
  // spring arrows (plastic pushes back): 3D arrows in the section plane
  const arrowM = new THREE.MeshBasicMaterial({ color: 0xFF4B3E, transparent: true, opacity: 0, depthTest: false });
  const mkArrow = () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 8), arrowM); s.position.y = 0.7; const h = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 12), arrowM); h.position.y = 1.8; g.add(s, h); g.renderOrder = 10; s.renderOrder = h.renderOrder = 10; return g; };
  const arrows = []; for (const sx of [-4, 4]) for (const sz of [-4, 4]) { const ad = (p, d) => { const g = mkArrow(); X.add(g); arrows.push({ g, p, d: d.normalize() }); };
    ad(v3(sx, 0, sz + Math.sign(sz) * 3.6), v3(0, 0, -Math.sign(sz)));                       // wall pushes back
    for (const tx of [sx - 4, sx + 4]) { const dir = v3(sx - tx, 0, sz).normalize(); ad(v3(tx, 0, 0).addScaledVector(dir, BR.tubeRo - 1.9), dir); } }   // tubes push back
  function arrowsSet(k, t, b = UB) { arrowM.opacity = k; const y = b.position.y + CUTH + 0.3; arrows.forEach(({ g, p, d }) => { g.visible = k > 0.01; const s = 1 + 0.15 * Math.sin(t * 9); g.position.set(p.x, y, p.z).addScaledVector(d, 0.25 * Math.sin(t * 9)); g.quaternion.setFromUnitVectors(v3(0, 1, 0), d); g.scale.setScalar(s * 0.9); }); }
  // the press: `yoff` = height of the upper brick above its seat; pen = stud penetration
  const seat = (b, yoff, ry = 0, rz = 0) => { b.position.set(0, BH + yoff, 0); b.rotation.set(0, ry, rz); const pen = clamp(studH - yoff, 0, studH) / studH; const d = DMAX * E.io(pen); b.userData.setDeform(d, d / DMAX); return pen; };
  const hookY = (t) => t < tSnap ? lerp(42, studH, clamp((t + LOOP + 0.2) / (tSnap + LOOP + 0.2))) : studH * (1 - E.io(clamp((t - tSnap) / 1.5)));
  function hookSet(t, xray = 0) {
    LB.visible = UB.visible = true; PB.visible = false; LB.position.set(0, 0, 0); LB.rotation.set(0, 0, 0); LB.userData.setDeform(0, 0);
    const y = hookY(t), wob = clamp((y - studH) / 40); seat(UB, y, 0.12 * wob * Math.sin(t * 2.2), 0.05 * wob * Math.sin(t * 3.1));
    xrayOn(xray, [UB, LB]); arrowsSet(0, t);
  }
  // mechanism replay (40 % slow-motion around the moment the stud enters)
  const pressY = (tau) => tau < 0 ? 7 : tau < 0.5 ? lerp(7, studH, E.i(tau / 0.5)) : studH * (1 - E.io(clamp((tau - 0.5) / 1.1)));
  function mechSet(t, t0, { slow = 0.4, xray = 1, arrowsK = 0 } = {}) {
    const k0 = t0 + 0.25, tau = t < k0 ? t - t0 : (k0 - t0) + (t - k0) * slow;
    LB.visible = UB.visible = true; PB.visible = false; LB.position.set(0, 0, 0); LB.rotation.set(0, 0, 0); LB.userData.setDeform(0, 0);
    const pen = seat(UB, pressY(tau)); xrayOn(xray, [UB, LB]); arrowsSet(arrowsK * clamp(pen * 2.5), t); return pen;
  }
  const exagK = { v: 0 };   // drives the EXAGGERATED tag (1 while the bent section is on screen)

  // ================= G: gauge on a stud + mould block (precision) =================
  const G = station(2400); plinth(G, 300, 200);
  const GB = makeBrick(COL.red); G.add(GB);
  const jaws = new THREE.Group(); G.add(jaws);
  const jawM = M.metal(0xC9CED6, 0.22); const beam = box(3.5, 2.4, 40, 0, 0, 0, jawM, jaws); const jA = box(3.5, 10, 1.0, 0, 0, 0, jawM, jaws), jB = box(3.5, 10, 1.0, 0, 0, 0, jawM, jaws);
  const scale = new THREE.Mesh(new THREE.PlaneGeometry(80, 3.4), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 44; const g = c.getContext('2d'); g.fillStyle = '#c9ced6'; g.fillRect(0, 0, 1024, 44); g.fillStyle = '#1b1e24'; for (let i = 0; i <= 100; i++) { const x = 12 + i * 10; g.fillRect(x, 0, 2, i % 10 ? 14 : (i % 5 ? 22 : 30)); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
  jaws.add(scale);
  const MB = mouldBlock([54, 30, 40], new THREE.MeshStandardMaterial({ color: 0x5a6574, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.3 })); MB.position.set(70, 0, -10); G.add(MB);
  const tGauge = Ls(4) - 0.1;
  function gaugeSet(t) {
    GB.position.set(0, 0, 0); GB.rotation.set(0, 0, 0); GB.userData.setDeform(0, 0);
    const u = E.io(clamp((t - tGauge) / 1.1)), gap = lerp(14, BR.studR * 2, u);
    jaws.position.set(-12, BH, -4); jaws.rotation.set(0, 0, 0);
    beam.position.set(0, studH + 8.5, -6); jA.position.set(0, studH + 2, -gap / 2 - 0.8); jB.position.set(0, studH + 2, gap / 2 + 0.8);
    scale.position.set(2.6, studH + 8.5, -6); scale.rotation.set(0, Math.PI / 2, Math.PI / 2); scale.scale.set(0.55, 0.9, 1);
  }

  // ================= MELT: silo, grains into the hopper, barrel with screw + heaters =================
  const MLT = station(5200);
  const floorM = M.std(0x1b222c, { roughness: 0.6, metalness: 0.3 });
  box(1400, 30, 700, 0, -15, 0, floorM, MLT);
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 520, 48), new THREE.MeshStandardMaterial({ color: 0x8c96a3, metalness: 0.8, roughness: 0.35 })); silo.position.set(-330, 620, -120); MLT.add(silo);
  const siloCone = new THREE.Mesh(new THREE.CylinderGeometry(150, 20, 160, 48), silo.material); siloCone.position.set(-330, 280, -120); MLT.add(siloCone);
  const chute = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 200, 16), steel); chute.position.set(-240, 230, -60); chute.rotation.z = -0.9; MLT.add(chute);
  const hop = hopper(220, 110, 140, 46); hop.position.set(-60, 220, 0); MLT.add(hop);
  const barrel = new THREE.Group(); barrel.position.set(-60, 120, 0); MLT.add(barrel);
  const barrelM = new THREE.MeshStandardMaterial({ color: 0x6b7480, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
  const bclip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const barrelMC = barrelM.clone(); barrelMC.clippingPlanes = [bclip];
  const bTube = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 520, 40, 1, true), barrelMC); bTube.rotation.z = Math.PI / 2; bTube.position.x = 240; barrel.add(bTube);
  const heaters = []; const heatM = hotMat(0x3a2a24); heatM.clippingPlanes = [bclip];
  for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 46, 40, 1, true), heatM); h.rotation.z = Math.PI / 2; h.position.x = 60 + i * 90; barrel.add(h); heaters.push(h); }
  const screw = new THREE.Group(); barrel.add(screw);
  { const sh = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 520, 24), steel); sh.rotation.z = Math.PI / 2; sh.position.x = 240; screw.add(sh);
    const pts = []; for (let i = 0; i <= 600; i++) { const u = i / 600, a = u * Math.PI * 2 * 11; pts.push(v3(-20 + u * 520, Math.cos(a) * 24, Math.sin(a) * 24)); }
    const flight = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 4.5, 6), steel); screw.add(flight); }
  const meltM = hotMat(0x7a1a10); meltM.clippingPlanes = [bclip];
  const melt = new THREE.Mesh(new THREE.CylinderGeometry(31, 31, 330, 32, 1, false), meltM); melt.rotation.z = Math.PI / 2; melt.position.x = 360; barrel.add(melt);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(10, 30, 50, 24), steel); nozzle.rotation.z = Math.PI / 2; nozzle.position.x = 525; barrel.add(nozzle);
  shadowed(MLT);
  const GN = 260; const grR = granules(GN, COL.red); MLT.add(grR.im);
  // pigment colours: three small heaps of grains on a tray in front
  const heaps = [[COL.red, -60], [COL.yellow, 30], [COL.blue, 120]].map(([c, x]) => { const gg = granules(150, c); MLT.add(gg.im); for (let i = 0; i < 150; i++) { const a = hash(i * 2.3 + x) * 6.28, r = Math.sqrt(hash(i * 3.7 + x)) * 34, h = (1 - r / 34) * 22 * hash(i * 1.1 + x) + 2; gg.set(i, x + Math.cos(a) * r, h, 210 + Math.sin(a) * r, hash(i) * 6, 2.4 + hash(i * 5.5) * 0.8); } gg.done(); return gg; });
  box(300, 6, 110, 30, -1, 210, M.std(0x2a313b, { roughness: 0.4, metalness: 0.6 }), MLT);
  const tMelt0 = Ls(5);
  function meltSet(t) {
    screw.rotation.x = t * 4;
    const heat = clamp((t - (Wd(5, 'melted') - 0.4)) / 1.2); heatM.userData.u.uK.value = 0.35 + 0.55 * heat; meltM.userData.u.uK.value = 0.55 + 0.35 * heat;
    let k = 0; const top = v3(-250, 300, -70), bot = v3(-60, 285, 0);
    for (let i = 0; i < GN; i++) { const per = 0.9, a = ((t + hash(i * 1.9) * per) % per) / per; const p = top.clone().lerp(bot, a); p.y -= 40 * Math.sin(Math.PI * a) - 0; p.x += (hash(i * 3.3) - 0.5) * 18; p.z += (hash(i * 4.4) - 0.5) * 18; grR.set(k++, p.x, p.y, p.z, a * 9 + i, 2.6 + hash(i) * 0.8); }
    grR.done(k);
  }

  // ================= MOULD: two halves, cavity fill (cutaway), clamp, open + drop =================
  const MO = station(9000);
  box(900, 30, 700, 0, -15, 0, floorM, MO);
  const cavM = plasticMat(0x5d6878, { roughness: 0.3, metalness: 0.85, clearcoat: 0.2, cut: 0x3b4450 });
  const cav = mouldBlock([60, 34, 44], cavM); cav.position.set(0, 120, 0); MO.add(cav);
  const coreHalf = box(60, 22, 44, 0, 0, 0, plasticMat(0x5d6878, { roughness: 0.3, metalness: 0.85, clearcoat: 0.2, cut: 0x3b4450 }), MO);
  const sprue = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 26, 16), hotMat(0x7a1a10)); MO.add(sprue);
  const zclip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), fillClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  cavM.clippingPlanes = [zclip]; coreHalf.material.clippingPlanes = [zclip];
  const fillMat = plasticMat(COL.red, { cut: 0xff6a3a }); fillMat.clippingPlanes = [zclip, fillClip];
  const FB = makeBrick(COL.red, { mat: fillMat }); FB.rotation.x = Math.PI; MO.add(FB);
  const tClose = Wd(6, 'steel') - 0.5, tFill = Wd(6, 'mold') + 0.15, tFillEnd = tFill + 1.6;
  const fillSlow = (t) => { const k0 = tFill + 0.15; return t < k0 ? t : k0 + (t - k0) * 0.4; };
  function mouldSet(t, { cut = true, open = 0 } = {}) {
    const cu = E.io(clamp((t - tClose) / 0.7));
    const cy = 120 - 0; cav.position.set(0, cy - lerp(0, 0, cu), 0);
    coreHalf.position.set(0, cy + lerp(46, 11, cu) + open * 40, 0);
    zclip.constant = cut ? MO.position.z : 1e5;   // keep z <= 0 in mould space (world z)
    cavM.clippingPlanes = cut ? [zclip] : []; coreHalf.material.clippingPlanes = cut ? [zclip] : [];
    // fill: the plastic rises from the studs (bottom of the cavity) to the open face, slowed at the key moment
    const fu = clamp((fillSlow(t) - tFill) / 1.0), lvl = lerp(-BH - studH - 0.5, 0.2, E.io(fu));
    FB.position.set(0, cy, 0); FB.visible = fu > 0; fillClip.set(v3(0, -1, 0), MO.position.y + cy + lvl);
    fillMat.clippingPlanes = cut ? [zclip, fillClip] : [fillClip];
    const cool = clamp((t - tFillEnd) / 2.2); fillMat.userData.u.uHot.value = fu > 0 ? 0.85 * (1 - cool) : 0;
    sprue.position.set(0, cy + 22, 0); sprue.visible = fu > 0 && fu < 1 && cu > 0.9; sprue.material.userData.u.uK.value = 0.9;
    glow.intensity = 0; if (fu > 0 && cool < 1) pt(glow, L(MO, 30, cy + 10, 60), 900 * (1 - cool), 400, 0xFF7A2B);
  }
  // the production mould: two big halves parting along z, eight bricks ejected and falling in a fan onto a belt
  const DR = station(12500);
  box(1200, 30, 800, 0, -15, 0, floorM, DR);
  const halfA = box(200, 150, 50, 0, 160, -40, steel, DR), halfB = box(200, 150, 50, 0, 160, 40, steel, DR);
  const pins = []; for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 30, 12), M.metal(0xC9CED6, 0.25)); p.rotation.x = Math.PI / 2; DR.add(p); pins.push(p); }
  const dropMat = plasticMat(COL.red); const drops = []; for (let i = 0; i < 8; i++) { const b = makeBrick(COL.red, { mat: dropMat }); DR.add(b); drops.push(b); }
  const belt = new THREE.Group(); DR.add(belt);
  const beltM = new THREE.MeshStandardMaterial({ color: 0x23282f, roughness: 0.8, map: (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#23282f'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#2f353e'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 4); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
  const beltTop = new THREE.Mesh(new THREE.BoxGeometry(260, 6, 900), beltM); beltTop.position.set(0, 0, 160); beltTop.receiveShadow = true; belt.add(beltTop);
  for (const x of [-136, 136]) box(12, 30, 900, x, -10, 160, steel, belt);
  const tOpen = Ls(7) - 0.05, dropSlow = (t) => { const k0 = tOpen + 0.45; return t < k0 ? t : k0 + (t - k0) * 0.4; };
  const homes = Array.from({ length: 8 }, (_, i) => v3(((i % 4) - 1.5) * 42, 200 - Math.floor(i / 4) * 52, -8));
  function dropSet(t) {
    const tau = dropSlow(t), ou = E.io(clamp((tau - tOpen) / 0.4));
    halfA.position.set(0, 160, -40); halfB.position.set(0, 160, 40 + ou * 90);
    beltM.map.offset.y = -t * 0.6;
    drops.forEach((b, i) => {
      const h = homes[i], ej = clamp((tau - tOpen - 0.35 - i * 0.03) / 0.12), fa = Math.max(0, tau - tOpen - 0.45 - i * 0.05);
      const fanA = ((i % 4) - 1.5) * 0.35, g = 0.5 * 1800 * fa * fa, y = h.y - g, floorY = 8 + (i % 3) * 3;
      const land = y <= floorY, ta = land ? Math.sqrt(2 * (h.y - floorY) / 1800) : fa;
      const vx = 90 + 40 * (i % 3), vz = 60 + fanA * 120;
      b.position.set(h.x + Math.sin(fanA) * 30 * ta + vx * ta * 0.5, Math.max(y, floorY), h.z + 10 * ej + vz * ta);
      if (land) { b.position.x += (fa - ta) * 40; b.position.z += (fa - ta) * 30; }
      const spin = land ? ta : fa; b.rotation.set(Math.PI / 2 * (land ? 0 : 1) + spin * (2.2 + i * 0.3) * (land ? 0 : 1), fanA + spin * 1.3, land ? 0 : spin * (i % 2 ? 1.4 : -1.1));
      const pin = pins[i]; pin.position.set(h.x, h.y + 4, 40 + ou * 90 - 22 + 8 * ej); pin.visible = ou > 0.5;
      b.userData.setDeform(0, 0);
    });
  }

  // ================= PAY: tower of fresh bricks =================
  const TW = station(16000); plinth(TW, 260, 200);
  const towerCols = [COL.red, COL.blue, COL.yellow, COL.red, COL.blue, COL.yellow];
  const tower = towerCols.map((c, i) => { const b = makeBrick(c); TW.add(b); return b; });
  const tTower = Wd(8, 'Squeeze') - 0.1;
  function towerSet(t) { tower.forEach((b, i) => { const a = t - tTower - i * 0.16; const yy = i * BH + Math.max(0, (1 - E.o(clamp(a / 0.22)))) * 60; b.visible = a > -0.25; b.position.set((i % 2 ? 4 : -4) * (i % 3 === 2 ? 0 : 1), yy, (i % 2) * 0); b.rotation.set(0, (i % 2) * Math.PI / 2 * 0 + (i % 3 === 1 ? Math.PI : 0), 0); b.userData.setDeform(0, 0); }); }

  // ================= CHOICE =================
  const chG = station(20000, 0);
  const floorC = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M.std(0x141a22, { roughness: 0.6, metalness: 0.2 })); floorC.rotation.x = -Math.PI / 2; floorC.position.y = 2; floorC.receiveShadow = true; chG.add(floorC);
  const pedG = pedestal(78, 130, 0x2BD67B), pedR = pedestal(78, 130, 0xFF3B3B); pedG.position.x = -105; pedR.position.x = 105; chG.add(pedG, pedR);
  const bear = gummyBear(0x2BD67B); bear.scale.setScalar(1.2); bear.position.set(-105, 140, 0); chG.add(bear);
  const pen = ballpointPen(0xE33A2F); pen.scale.setScalar(0.95); chG.add(pen);
  scene.updateMatrixWorld(true);

  // ---------------- camera ----------------
  let shake = 0, TT = 0;
  function cam(pos, subj, fov = 40, low = 0.3) {
    const p = pos.clone(); if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; p.z += noise1(TT * 40 + 21) * shake; }
    camera.position.copy(p); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = p.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.3, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));

  // ---------------- shots ----------------
  const shots = []; const S = (t0, t1, fn, par = 1) => shots.push({ t0, t1, fn, par });
  const all = [X, G, MLT, MO, DR, TW, chG];
  const show = (...o) => o.forEach(x => x.visible = true);
  const xc = () => L(X, 0, BH + 2, 0);
  const hookPlate = (t) => { show(X); hookSet(t, 0); const c = L(X, 0, BH + 8, 0); cam(orbit(c, 175, 0.62 + 0.03 * t, 0.2), c, 38, 0.3); rig(c, 140, 2.0); expo = 1.05; };
  S(0, tSnap, (u, t) => hookPlate(t), 0);
  // R1: the cutaway arrives at tSnap (<= 1.2 s): x-ray section through both bricks, stud entering the gap
  const xcam = (t, el, r, tg = v3(0, BH + 1, 0), az = -Math.PI / 2) => { const c = L(X, tg.x, tg.y, tg.z); cam(orbit(c, r, az, el), c, 34, 0.5); rig(c, 80, 1.8); expo = 0.92; };
  const tSnap2 = Wd(1, "There's") + 0.1;
  S(tSnap, tSnap2, (u, t) => { show(X); hookSet(t, 1); exagK.v = 1; xcam(t, lerp(1.0, 1.12, u), lerp(125, 110, u)); });
  S(tSnap2, Ls(2), (u, t) => { show(X); hookSet(t, 1); exagK.v = 1; xcam(t, lerp(1.2, 1.28, u), lerp(70, 62, u), v3(-4, BH + 1, 0), -Math.PI / 2 - 0.35); });
  // MECHANISM (no lists: one new thing per shot)
  const tM1 = Ls(2), tM2 = Wd(2, 'big') - 0.12, tM3 = Wd(3, 'So') - 0.02, tM4 = Wd(3, 'and') - 0.05;
  S(tM1, tM2, (u, t) => { show(X); mechSet(t, tM1); exagK.v = 1; xcam(t, 1.25, lerp(52, 44, u), v3(4, BH + 1, 2.4)); });
  S(tM2, tM3, (u, t) => { show(X); mechSet(t, tM2 - 1.0); exagK.v = 1; xcam(t, lerp(1.0, 1.1, u), lerp(46, 40, u), v3(-4, BH + 1, -2.4), -Math.PI / 2 + 0.5); });
  S(tM3, tM4, (u, t) => { show(X); mechSet(t, tM3 - 0.2); exagK.v = 1; xcam(t, 1.3, lerp(112, 100, u)); });
  S(tM4, Ls(4), (u, t) => { show(X); mechSet(t, tM4 - 3, { arrowsK: 1, slow: 1 }); exagK.v = 1; xcam(t, 1.22, lerp(54, 46, u), v3(4, BH + 1, 0)); });
  // PRECISION
  const tP2 = Wd(4, 'millimetre') - 0.25;
  S(Ls(4), tP2, (u, t) => { show(G); gaugeSet(t); const c = L(G, -12, BH + 2, -4); cam(c.clone().add(v3(lerp(-34, -28, u), lerp(16, 12, u), lerp(-30, -24, u))), c, 38, 0.3); rig(c, 80, 1.9); });
  S(tP2, Ls(5), (u, t) => { show(G); gaugeSet(t); const c = L(G, 70, -6, -10); cam(c.clone().add(v3(lerp(-50, -30, u), 70, lerp(80, 70, u))), c, 38, 0.25); rig(c, 120, 2.0); });
  // STEP 1 MELT
  const tB1 = Wd(5, 'melted') - 0.2, tB2 = Wd(5, 'degrees') - 0.05;
  S(Ls(5), tB1, (u, t) => { show(MLT); meltSet(t); const c = L(MLT, lerp(-160, -120, u), 230, 40); cam(c.clone().add(v3(140, 60, 330)), c, 40, 0.25); rig(c, 400, 2.0); });
  S(tB1, tB2, (u, t) => { show(MLT); meltSet(t); hop.visible = false; silo.visible = siloCone.visible = chute.visible = false; const c = L(MLT, lerp(40, 200, E.io(u)), 140, 0); cam(c.clone().add(v3(-40, 170, 520)), c, 40, 0.25); rig(c, 400, 1.4); });
  S(tB2, Ls(6), (u, t) => { show(MLT); meltSet(t); hop.visible = false; silo.visible = siloCone.visible = chute.visible = false; const c = L(MLT, lerp(240, 340, E.io(u)), 120, 0); cam(c.clone().add(v3(40, 60, 170)), c, 40, 0.25); rig(c, 220, 1.1); expo = 1.0; });
  // STEP 2 INJECT
  const tI2 = tFill - 0.2, tI3 = Wd(6, 'hundred') - 0.1, tI4 = Wd(6, 'pressure') - 0.05;
  S(Ls(6), tI2, (u, t) => { show(MO); mouldSet(t, { cut: false }); const c = L(MO, 0, 130, 0); cam(c.clone().add(v3(lerp(140, 110, u), 70, 160)), c, 40, 0.25); rig(c, 160, 2.0); });
  S(tI2, tI3, (u, t) => { show(MO); mouldSet(t, { cut: true }); const c = L(MO, 0, 118, 0); cam(c.clone().add(v3(lerp(-40, -20, u), 30, lerp(120, 105, u))), c, 38, 0.3); rig(c, 100, 1.6); expo = 1.0; });
  S(tI3, tI4, (u, t) => { show(MO); mouldSet(t, { cut: false }); const c = L(MO, 0, 140, 0); cam(c.clone().add(v3(lerp(-120, -90, u), 110, 150)), c, 40, 0.25); rig(c, 160, 2.0); shake = Math.abs(t - tI3 - 0.3) < 0.08 ? 1.5 : 0; });
  S(tI4, Ls(7), (u, t) => { show(MO); mouldSet(t, { cut: true }); fillMat.userData.u.uHot.value *= 0.6; const c = L(MO, 0, 112, 0); cam(c.clone().add(v3(lerp(20, 0, u), 30, lerp(80, 70, u))), c, 38, 0.22); rig(c, 100, 1.8); expo = 0.8; });
  // STEP 3 DROP
  const tD2 = Wd(7, 'brick') - 0.25;
  S(Ls(7), tD2, (u, t) => { show(DR); dropSet(t); const c = L(DR, 0, 130, 30); cam(c.clone().add(v3(lerp(330, 300, u), lerp(60, 30, u), lerp(140, 120, u))), c, 40, 0.2); rig(c, 300, 2.1); });
  S(tD2, Ls(8), (u, t) => { show(DR); dropSet(t); const c = L(DR, 0, 10, 180); cam(c.clone().add(v3(lerp(-200, -160, u), 170, 190)), c, 40, 0.25); rig(c, 300, 2.1); });
  // PAYOFF: blue onto red in slow motion, the squeeze once more in x-ray, then a small tower
  const tPay = Ls(8), tPay2 = Wd(8, 'Squeeze') - 0.15;
  const paySet = (t, xray) => { show(X); LB.visible = false; UB.visible = true; PB.visible = true; UB.position.set(0, 0, 0); UB.rotation.set(0, 0, 0); UB.userData.setDeform(0, 0);
    const tau = (t - tPay) * 0.55, y = tau < 0.6 ? lerp(26, studH, E.i(tau / 0.6)) : studH * (1 - E.io(clamp((tau - 0.6) / 0.5)));
    PB.position.set(0, BH + y, 0); PB.rotation.set(0, 0, 0); const pen = clamp(studH - y, 0, studH) / studH, d = DMAX * E.io(pen); PB.userData.setDeform(d, d / DMAX); xrayOn(xray, [PB, UB]); arrowsSet(xray * pen, t, PB); };
  S(tPay, tPay2, (u, t) => { const xr = clamp((t - (tPay2 - 0.55)) / 0.15); paySet(t, xr); exagK.v = xr; const c = L(X, 0, BH + 2, 0); const k = E.io(clamp((t - tPay) / (tPay2 - tPay - 0.5))); cam(orbit(c, lerp(170, 110, k), lerp(0.7, -Math.PI / 2, k), lerp(0.35, 1.15, k)), c, 36, 0.32); rig(c, 120, 1.9); expo = 1.05; });
  const tTw2 = tPay2 + 1.15;
  S(tPay2, tTw2, (u, t) => { show(TW); towerSet(t); const c = L(TW, 0, 26, 0); cam(orbit(c, lerp(170, 190, u), 0.5 + 0.15 * u, 0.22), c, 40, 0.42); rig(c, 160, 2.1); });
  S(tTw2, tEC, (u, t) => { show(TW); towerSet(t); const c = L(TW, 0, 26, 0); cam(orbit(c, lerp(230, 280, u), -0.4 + 0.2 * u, 0.32), c, 40, 0.45); rig(c, 180, 2.1); });
  // END CARD (2.5 s)
  const tE2 = tEC + 1.25;
  const choiceSet = t => { show(chG); const lt = t - tEC; bear.rotation.y = 0.4 + lt * 0.6; pen.position.set(105, 150 + Math.sin(lt * 2.2) * 4, 0); pen.rotation.set(0, lt * 0.8, 0.95);
    spotG.intensity = 9 * E.o(clamp(lt / 0.3)); spotR.intensity = 9 * E.o(clamp((lt - 0.15) / 0.3));
    spotG.position.copy(chG.position).add(v3(-260, 520, 260)); spotG.target.position.copy(chG.position).add(v3(-105, 150, 0));
    spotR.position.copy(chG.position).add(v3(260, 520, 260)); spotR.target.position.copy(chG.position).add(v3(105, 150, 0)); };
  S(tEC, tE2, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 175, 0)); cam(chG.position.clone().add(v3(0, lerp(250, 236, E.io(u)), lerp(1080, 1010, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  S(tE2, END - LOOP, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 180, 0)); cam(chG.position.clone().add(v3(lerp(-60, -20, E.io(u)), 160, lerp(950, 900, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  // LOOP: the fall replays and lands exactly on frame 0
  S(END - LOOP, END + 1, (u, t) => hookPlate(t - (END - 1 / 30)), 0);
  const shotAt = (t) => shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  function stateAt(t) {
    ghosts.forEach(g => g.visible = false);
    TT = t; shake = 0; expo = 1.2; hop.visible = silo.visible = siloCone.visible = chute.visible = true; exagK.v = 0; glow.intensity = 0; spotG.intensity = spotR.intensity = 0; arrowM.opacity = 0;
    all.forEach(o => o.visible = false);
    const sh = shotAt(t); sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    ghosts.forEach((g, b) => { g.position.copy(b.position); g.rotation.copy(b.rotation); });
    ctx.renderer.toneMappingExposure = expo;
    glow.visible = glow.intensity > 0; spotG.visible = spotG.intensity > 0; spotR.visible = spotR.intensity > 0;
    scene.updateMatrixWorld(true); return sh;
  }
  const proj = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; };
  const anchorOf = (fn) => (tt) => { stateAt(tt); return proj(fn(tt)); };

  // ---------------- text events ----------------
  const steps = [{ at: Ls(5), n: 1, word: 'MELT.' }, { at: Ls(6), n: 2, word: 'INJECT.' }, { at: Ls(7), n: 3, word: 'DROP.' }];
  const TEXT = []; const T_ = (o) => { TEXT.push(o); return o; };
  const Y = 440;
  const titleWords = [Wd(1, 'Why'), Wd(1, 'do'), Wd(1, 'toy'), Wd(1, 'bricks')];
  T_({ k: 'title', at: -1, until: Wd(1, "There's") - 0.05, label: 'WHY DO TOY BRICKS / STICK?', fx: 'RAW TO REAL title, punch on the x-ray snap' });
  T_({ k: 'strike', at: Wd(1, 'glue'), strikeAt: Wd(1, 'glue') + 0.28, replAt: Wd(3, 'squeezes'), until: Le(3) + 0.1, word: 'GLUE', repl: 'SQUEEZE', y: 600, ek: 'twist' });
  T_({ k: 'callout', at: Wd(2, 'stud'), until: tM2 - 0.05, text: 'STUD', anchor: anchorOf(() => L(X, 4, BH + studH, 4)), dx: -150, dy: -230 });
  T_({ k: 'cap', at: Wd(2, 'slightly'), until: tM3 - 0.05, words: [{ t: 'SLIGHTLY', k: 'twist' }, { t: 'TOO BIG', a: true, k: 'twist', at: Wd(2, 'too') }], size: 104 });
  T_({ k: 'callout', at: tM2 + 0.05, until: tM3 - 0.05, text: 'WALL', anchor: anchorOf(() => L(X, -4, UB.position.y + 1.2, -7.2)), dx: 130, dy: -200 });
  T_({ k: 'callout', at: Wd(2, 'gap'), until: tM3 - 0.05, text: 'TUBE', anchor: anchorOf(() => L(X, 0, UB.position.y + 1.2, 2.2)), dx: -150, dy: -150 });
  T_({ k: 'cap', at: Wd(3, 'bends'), until: tM4 - 0.04, words: [{ t: 'BENDS', a: true, k: 'verb' }], dir: 1, size: 120 });
  T_({ k: 'exag', at: tSnap + 0.2, until: Ls(4) - 0.05, fx: 'small tag EXAGGERATED while the bent section is on screen' });
  T_({ k: 'odo', at: Wd(4, 'hundredth'), until: Ls(5) - 0.08, value: '0.01', unit: 'MM', y: 640, morph: { at: tP2 + 0.35, label: 'MOLD' } });
  for (const s of steps) T_({ k: 'sticker', at: s.at, until: s.at + 1.54, label: 'sticker ' + s.word, s });
  T_({ k: 'callout', at: Wd(5, 'grains'), until: tB1 - 0.05, text: 'ABS GRAINS', anchor: anchorOf(() => L(MLT, -160, 268, -36)), dx: 140, dy: -230 });
  T_({ k: 'odo', at: Wd(5, 'two'), until: Ls(6) - 0.05, value: 230, unit: '°C', pre: 'ABOUT', y: 660, morph: { at: Wd(5, 'Celsius') + 0.35, label: 'MELTED' } });
  T_({ k: 'callout', at: Wd(6, 'steel'), until: tI2 - 0.05, text: 'STEEL MOLD', anchor: anchorOf(() => L(MO, 30, 128, 22)), dx: 140, dy: -240 });
  T_({ k: 'odo', at: Wd(6, 'hundred'), until: Ls(7) - 0.05, value: 150, unit: 'TONS', pre: 'UP TO', y: 620 });
  T_({ k: 'odo', at: Wd(7, 'seven'), until: Ls(8) - 0.05, value: 7, unit: 'SECONDS', pre: 'ABOUT', y: 620 });
  T_({ k: 'cap', at: Wd(8, 'Press'), until: tPay2 - 0.04, words: [{ t: 'PRESS', a: true, k: 'verb' }, { t: 'TWO', k: 'noun', at: Wd(8, 'two') }], dir: 1, size: 120 });
  T_({ k: 'cap', at: Wd(8, 'Squeeze'), until: tEC - 0.05, words: [{ t: 'SQUEEZE,', a: true, k: 'twist' }, { t: 'NOT GLUE.', k: 'twist', at: Wd(8, 'not') }], size: 110 });
  T_({ k: 'end', at: tEC, until: END - LOOP, fx: 'NEXT EPISODE? gummy bear / ballpoint pen, COMMENT BELOW, FOLLOW: NEW ONE EVERY DAY' });
  T_({ k: 'title-loop', at: END - LOOP, until: END + 1, label: 'WHY DO TOY BRICKS / STICK?', fx: 'blueprint rebuilds, last frame = frame 0' });
  const titleO = { l1: 'WHY DO TOY BRICKS', l2: 'STICK?', y: 400, words: titleWords, rawWord: 'BRICKS', scan: [0.15, 0.85], punchAt: tSnap, until: Wd(1, "There's") - 0.05, push: (tt) => clamp(tt / 2) };
  function exagTag(g, t, o) {
    const a = t - o.at, r = o.until - t; if (a < 0 || r < 0 || exagK.v < 0.5) return;
    const s = clamp(a / 0.15) * clamp(r / 0.1); g.save(); g.globalAlpha = s; g.font = '800 30px "JBMono"'; const txt = 'EXAGGERATED'; const tw = g.measureText(txt).width, w = tw + 70, x = SAFE.cx - w / 2, y = t > Ls(5) ? 360 : 300;
    g.fillStyle = 'rgba(16,20,24,0.82)'; g.beginPath(); g.roundRect(x, y, w, 52, 26); g.fill(); g.lineWidth = 3; g.strokeStyle = '#7FE3FF'; g.stroke();
    g.fillStyle = '#FF4B3E'; g.globalAlpha = s * (0.6 + 0.4 * Math.sin(t * 8)); g.beginPath(); g.arc(x + 26, y + 26, 8, 0, 7); g.fill(); g.globalAlpha = s;
    g.fillStyle = '#7FE3FF'; g.textBaseline = 'middle'; g.fillText(txt, x + 46, y + 28); g.restore();
  }
  function drawText(g, t) {
    const sh = shotAt(t); stateAt(t); setParallax(((clamp((t - sh.t0) / (sh.t1 - sh.t0)) - 0.5) * 2) * sh.par, 0);
    for (const o of TEXT) {
      if (t < o.at - 0.01 || t > o.until + 0.01) continue;
      if (o.k === 'title') titleRawReal(g, t, titleO);
      else if (o.k === 'title-loop' && t >= END - 1 / 30 - 1e-4) titleRawReal(g, 0, { ...titleO, push: () => 0 });   // last frame = frame 0
      else if (o.k === 'title-loop') titleRawReal(g, t, { ...titleO, words: [], loopAt: END - LOOP, push: () => 0 });
      else if (o.k === 'sticker') { inkSwipe(g, t, { at: o.at }); stepSticker(g, t, { at: o.at, n: o.s.n, word: o.s.word }); }
      else if (o.k === 'callout') callout(g, t, o);
      else if (o.k === 'cap') kcap(g, t, { y: Y, ...o });
      else if (o.k === 'strike') strike(g, t, { ...o, k: o.ek });
      else if (o.k === 'odo') odometer(g, t, { ...o, morph: o.morph ? { ...o.morph, to: { x: SAFE.cx, y: 560 } } : null });
      else if (o.k === 'exag') exagTag(g, t, o);
      else if (o.k === 'end') endCard2(g, t, { at: o.at, comment: Wd(9, 'Comment'), commentW2: Wd(9, 'below'), follow: Wd(9, 'below') + 0.2, until: o.until, left: 'GUMMY BEAR', right: 'BALLPOINT PEN', next: 'EP. 05', followText: 'FOLLOW: NEW ONE EVERY DAY' });
    }
    dock(g, t, { steps: steps.map(s => ({ at: s.at, word: s.word })), total: 3, until: Ls(8) - 0.02 });
  }

  // ---------------- sound events ----------------
  const sfx = [
    { t: 0.0, n: 'whoosh_soft' }, { t: 0.15, n: 'ui_tick' }, { t: tSnap, n: 'xray_hit' }, { t: tSnap + 0.4, n: 'plastic_creak' },
    { t: Wd(1, 'glue') + 0.28, n: 'pencil_scribble' }, { t: Wd(1, 'glue') + 0.55, n: 'ui_tick' },
    { t: tM1 + 0.35, n: 'plastic_click' }, { t: tM2, n: 'plastic_creak' }, { t: tM3 + 0.3, n: 'plastic_click' }, { t: tM4, n: 'swell' }, { t: Wd(3, 'squeezes'), n: 'ui_tick' },
    { t: tGauge + 1.05, n: 'metal_click' }, { t: tP2, n: 'low_whoosh' },
    ...steps.map(s => ({ t: s.at, n: 'swipe' })), ...steps.map(s => ({ t: s.at + 0.2, n: 'ui_tick' })),
    { t: Ls(5) + 0.05, n: 'granules' }, { t: tB1, n: 'machine_hum' }, { t: Wd(5, 'melted'), n: 'fire_whoosh' },
    { t: tClose + 0.6, n: 'press_thud' }, { t: tFill, n: 'inject_hiss' }, { t: tI3 + 0.3, n: 'hydraulic' },
    { t: tOpen + 0.1, n: 'mold_open' }, { t: tOpen + 0.5, n: 'plastic_drop' }, { t: tD2 + 0.2, n: 'plastic_clatter' },
    { t: tPay + 0.9, n: 'plastic_click' }, { t: tTower, n: 'plastic_stack' },
    { t: tEC, n: 'whoosh' }, { t: tEC + 0.25, n: 'click_ui' }, { t: tEC + 0.4, n: 'click_ui' }, { t: END - LOOP, n: 'whoosh_soft' },
  ];

  function seek(t, g, opts = {}) {
    const plate = opts.plate !== false, over = opts.over !== false;
    stateAt(t);
    lens.uniforms.uSeed.value = (t >= END - 1 / 30 - 1e-4 || t < 1 / 30) ? 0 : Math.floor(t * 30) % 1000;
    if (plate) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
    if (!over) return;
    blurred(g, t, drawText);
    stateAt(t);
  }
  return { seek, END, sfx, lines, shots: shots.map(s => [s.t0, s.t1]), caps: TEXT.map(o => [o.at, o.until, o.text || o.label || (o.words ? o.words.map(w => w.t).join(' ') : o.word ? o.word + ' -> ' + o.repl : o.value !== undefined ? `${o.pre ? o.pre + ' ' : ''}${o.value} ${o.unit}` : o.k), o.k, o.fx || '']), lockTicks: () => [] };
}
