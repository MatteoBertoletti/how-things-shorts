// LONG 02: the 3D layer. EP. 01 zipper parts (js/zipper.js) re-staged for 16:9 on a slate studio floor, plus 5 new set-ups:
// x-ray slider (glass body + glowing Y path), coil chain, molded-plastic chain, the tab lock pin, the worn slider.
// Units mm, y up (world). Chains lie on the floor: chain local x across, y along, z out of the tape.
import * as THREE from 'three';
import { clamp, lerp, smooth, E, hash } from '../../js/core.js';
import { M, fabricMat, dimLine, shadowed } from '../../js/parts.js';
import { Chain, Slider, CoilChain, sliderGap, toothGeometry, moldedToothGeometry, P, BX, T } from '../../js/zipper.js';
import { simPop, sample } from '../../js/physics.js';

export function buildZ(ctx) {
  const { scene } = ctx;
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---------------- lights: warm key, cold fill, rim, one accent ----------------
  const key = new THREE.DirectionalLight(0xFFC777, 2.4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const keyDir = v3(-0.55, 1, 0.42).normalize();
  const fill = new THREE.DirectionalLight(0x7FB3D9, 1.2); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xBFD9EE, 1.0); scene.add(rim, rim.target);
  const hemi = new THREE.HemisphereLight(0x7FB3D9, 0x262c37, 0.6); scene.add(hemi);
  const xl = new THREE.PointLight(0xBFE6FF, 0, 0, 1.6); scene.add(xl);           // light inside the x-ray slider
  const acc = new THREE.PointLight(0xFFD23A, 0, 0, 1.6); scene.add(acc);
  function rig(tgt, size, k = 2.4) {
    key.intensity = k; key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(v3(0.85, 0.5, -0.4).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(v3(0.25, 0.6, -1).multiplyScalar(size * 3));
  }
  // ---------------- studio: slate floor + soft backdrop (keeps the luma gate 60-140) ----------------
  const floorM = M.std(0x4a5466, { roughness: 0.82, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const back = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), new THREE.MeshBasicMaterial({ color: 0x3a4352, side: THREE.BackSide })); scene.add(back);

  // ---------------- materials ----------------
  const brass = M.metal(0xD9A441, 0.3), nickel = M.metal(0xA9AFB8, 0.48);
  const tapeMat = fabricMat('#3B4E6E', [2, 2]);
  const coilMat = M.std(0xEDE3CE, { roughness: 0.45 }), moldMat = M.std(0x7FB3D9, { roughness: 0.55 });
  const glowY = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.9, 1.0).multiplyScalar(1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const pinMat = M.metal(0xFFD23A, 0.3, { emissive: new THREE.Color(0xFFD23A), emissiveIntensity: 0 });

  // ================= HERO: long brass chain + slider (x-ray capable) =================
  const heroG = new THREE.Group(); heroG.position.set(0, 1.3, 0); heroG.rotation.x = -Math.PI / 2; scene.add(heroG);
  const runG = new THREE.Group(); heroG.add(runG);                                  // the chain can slide under a fixed slider (loops)
  const NH = 80, hero = new Chain({ N: NH, toothMat: brass, tapeMat }); runG.add(hero.group);
  const hs = new Slider({ mat: nickel.clone(), capColor: 0xFFD23A }); heroG.add(hs.group);
  // the glowing Y: two arms + the stem, drawn additively inside the slider
  const yPath = new THREE.Group(); hs.group.add(yPath);
  const tube = (pts, r = 0.5) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => v3(...p))), 40, r, 8, false), glowY); m.userData.noXray = true; m.renderOrder = 6; return m; };
  for (const s of [-1, 1]) yPath.add(tube([[s * 6.6, 14.5, 0.25], [s * 5.4, 11, 0.25], [s * 3.2, 5.5, 0.25], [s * 1.95, 1.0, 0.25], [s * 0.6, -1.5, 0.25]]));
  yPath.add(tube([[0, -0.5, 0.25], [0, -5, 0.25], [0, -12, 0.25]], 0.6));
  // lock pin (CH. 4): drops between two teeth of the left row when the tab lies flat
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 3.0, 20), pinMat); pin.renderOrder = 5; pin.userData.noXray = true; pin.rotation.x = Math.PI / 2; pin.position.set(-2.7, 2.2, 3.0); hs.group.add(pin);
  const popTooth = new THREE.Mesh(toothGeometry().full, brass); popTooth.castShadow = true; scene.add(popTooth);
  const dim5 = dimLine(5.2, 0xFFD23A, 0.14); dim5.rotation.x = Math.PI / 2; runG.add(dim5);
  hs.updatePlane();
  const HL = (x, y, z) => v3(x, y, z).applyMatrix4(heroG.matrixWorld);
  const _qfix = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), 0);
  const POP = { side: 0, i: 34 };
  const popSim = simPop({ x: 0, y: 1.6, z: 0 });
  const C_TOP = (NH - 1) * P + P / 2 - 5.6;

  // state: c = slider position along the chain (chain coords); run = chain shift (slider fixed in heroG)
  const HS = { c: 60, run: 0, gap: null, xray: 0, wedge: 0, glow: 0, pin: 0, tab: 0.1, worn: 0, hidePop: false, dim: 0, lift: null };
  const reset = () => Object.assign(HS, { c: 60, run: 0, gap: null, xray: 0, wedge: 0, glow: 0, pin: 0, tab: 0.1, worn: 0, hidePop: false, dim: 0, lift: null });
  const wornGap = (s, y, c) => { const d = y - c; if (d > 0) return sliderGap(d * 0.92); const g = Math.min(6.5, 1.1 + 0.16 * -d) * smooth(-1.5, -4, d) * smooth(4, 26, y); return [g, 0]; };
  function heroSet() {
    heroG.visible = true;
    const c = HS.c; runG.position.y = -HS.run; hs.group.position.y = c - HS.run;
    hero.hidden.clear(); if (HS.hidePop) hero.hidden.add(POP.side * 1000 + POP.i);
    const gap = HS.gap ? HS.gap : HS.worn > 0 ? ((s, y) => { const a = sliderGap(y - c), b = wornGap(s, y, c); return [lerp(a[0], b[0], HS.worn), lerp(a[1], b[1], HS.worn)]; }) : ((s, y) => sliderGap(y - c));
    hero.layout(gap, HS.lift);
    hs.group.scale.set(1 + 0.16 * HS.worn, 1, 1);
    hs.setCut(10); hs.setXray(HS.xray); hs.setWedge(HS.wedge);
    glowY.opacity = HS.glow; yPath.visible = HS.glow > 0.01;
    hero.glow(HS.glow > 0.01 ? ((s, y) => HS.glow * smooth(-3, 0.5, y - c) * smooth(15, 11, y - c)) : (() => 0));
    pin.visible = HS.pin > 0.001; pin.position.z = lerp(3.4, 0.35, HS.pin); pinMat.emissiveIntensity = 0.6 + 1.6 * HS.pin;
    if (hs.tab) { hs.tab.rotation.x = HS.tab; }
    dim5.visible = HS.dim > 0.01; dim5.position.set(0, c - 40, 1.4); dim5.scale.set(Math.max(0.001, E.back(clamp(HS.dim))), 1, 1);
    xl.intensity = HS.xray * 5; xl.distance = 60; xl.position.copy(HL(0, c + 6 - HS.run, 3));
    heroG.updateMatrixWorld(true); hs.updatePlane();
  }
  const sliderW = (dy = 6, dz = 0) => HL(0, HS.c - HS.run + dy, dz);           // world point on the slider
  function popSet(tp) {  // tooth pops out at tp (seconds after the pop), physics sampled
    const vis = tp >= 0; popTooth.visible = vis; HS.hidePop = vis; if (!vis) return;
    const base = HL(-BX, hero.toothY(-1, POP.i) - HS.run, 0); const s = sample(popSim, tp, 0);
    popTooth.position.set(base.x + s[0], s[1], base.z + s[2]); popTooth.quaternion.set(s[3], s[4], s[5], s[6]);
  }
  // after the pop the chain opens around the gap, tooth after tooth
  const burst = (dt) => (s, y) => { if (dt <= 0) return [0, 0]; const BY = hero.toothY(-1, POP.i); const R = 70 * E.o(clamp(dt / 1.6)), dist = Math.abs(y - BY);
    const open = E.o(clamp((R - dist) / 10)), env = smooth(-2, 12, y) * smooth(C_TOP + 2, C_TOP - 12, y); return [5.5 * open * env, 0]; };

  // ================= TOOTH: single hero tooth (macro) =================
  const toothG = new THREE.Group(); toothG.position.set(300, 20, 0); scene.add(toothG);
  const tg = toothGeometry(); const nibMat = brass.clone(); nibMat.emissive = new THREE.Color(0xFFD23A); nibMat.emissiveIntensity = 0;
  const tBase = new THREE.Mesh(tg.base, brass), tNib = new THREE.Mesh(tg.nib, nibMat); tBase.castShadow = tNib.castShadow = true;
  const tPivot = new THREE.Group(); tPivot.add(tBase, tNib); tBase.position.x = tNib.position.x = -1.175; toothG.add(tPivot);
  const ringM = M.glow(0xFFD23A, 2.5); ringM.transparent = true;
  const scoopRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 40), ringM); scoopRing.rotation.x = Math.PI / 2; scoopRing.position.set(1.85 - 1.175, -T / 2 - 0.01, 0); tPivot.add(scoopRing);
  const toothSet = (rx, ry, nib, ring) => { toothG.visible = true; tPivot.rotation.set(rx, ry, 0); nibMat.emissiveIntensity = nib; ringM.opacity = ring; scoopRing.visible = ring > 0.01; };

  // ================= ROWS: short open rows for the offset / the jam =================
  const rowsG = new THREE.Group(); rowsG.position.set(-300, 1.3, 0); rowsG.rotation.x = -Math.PI / 2; scene.add(rowsG);
  const rows = new Chain({ N: 9, toothMat: brass, tapeMat, stops: false, pad: 6 }); rowsG.add(rows.group);
  const guideM = M.glow(0x7FB3D9, 2.2); guideM.transparent = true;
  const guides = []; for (let i = 0; i < 9; i++) { const g = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 0.08), guideM); g.position.set(0, i * P, 0.8); rowsG.add(g); guides.push(g); }
  const halfDim = dimLine(P / 2, 0xFFD23A, 0.12); halfDim.rotation.z = Math.PI / 2; halfDim.position.set(6.2, 4 * P + P / 4, 0.9); rowsG.add(halfDim);
  const RL = (x, y, z) => v3(x, y, z).applyMatrix4(rowsG.matrixWorld);
  function rowsSet(G, gOn = 0, hd = 0) {
    rowsG.visible = true; rows.layout(() => [G, 0]);
    guides.forEach((g, i) => { const a = clamp((gOn - i * 0.06) / 0.2); g.scale.x = Math.max(0.001, E.o(a)); g.visible = a > 0; });
    halfDim.visible = hd > 0; halfDim.scale.setScalar(Math.max(0.001, E.back(clamp(hd))));
  }

  // ================= KINDS: coil / molded / metal side by side =================
  const kindsG = new THREE.Group(); kindsG.position.set(0, 1.3, 600); scene.add(kindsG);
  const KX = [-24, 0, 24], KN = 30;
  const mk = (x) => { const g = new THREE.Group(); g.position.x = x; g.rotation.x = -Math.PI / 2; kindsG.add(g); return g; };
  const kCoilG = mk(KX[0]), kMoldG = mk(KX[1]), kMetG = mk(KX[2]);
  const coil = new CoilChain({ N: KN, mat: coilMat, tapeMat: fabricMat('#4E5F7A', [2, 2]) }); kCoilG.add(coil.group);
  const mold = new Chain({ N: KN, toothMat: moldMat, tapeMat: fabricMat('#2F3B52', [2, 2]), stops: false, pad: 6, geo: moldedToothGeometry() }); kMoldG.add(mold.group);
  const met = new Chain({ N: KN, toothMat: brass, tapeMat, stops: false, pad: 6 }); kMetG.add(met.group);
  const kSl = [kCoilG, kMoldG, kMetG].map((g, k) => { const s = new Slider({ mat: k === 1 ? M.std(0x2F3B52, { roughness: 0.5 }) : nickel.clone(), tab: true }); g.add(s.group); return s; });
  const KL = (k, x, y, z) => v3(x, y, z).applyMatrix4([kCoilG, kMoldG, kMetG][k].matrixWorld);
  function kindsSet({ c = 70, build = 1, moldN = KN, metN = KN, metDrop = 0 } = {}) {
    kindsG.visible = true; kindsG.updateMatrixWorld(true);
    const gap = (s, y) => sliderGap(y - c);
    coil.layout((s, y) => [0, 0]); coil.build(build);
    mold.hidden.clear(); for (let i = Math.max(0, Math.floor(moldN)); i < KN; i++) { mold.hidden.add(i); mold.hidden.add(1000 + i); }
    mold.layout(gap);
    met.hidden.clear(); for (let i = Math.max(0, Math.floor(metN)); i < KN; i++) { met.hidden.add(i); met.hidden.add(1000 + i); }
    const fi = metN % 1, nI = Math.floor(metN);
    met.layout(gap, (s, y) => { const i = Math.round((y - (s > 0 ? P / 2 : 0)) / P); return i === nI - 1 ? 6 * (1 - E.o(clamp(fi * 3 + metDrop))) : 0; });
    kSl.forEach((s, k) => { s.group.position.y = k === 0 ? KN * P + 2 : c; s.setCut(10); s.updatePlane(); });
  }

  // ---------------- per-frame reset ----------------
  const all = [heroG, toothG, rowsG, kindsG, popTooth];
  function hideAll() { all.forEach(o => o.visible = false); xl.intensity = 0; acc.intensity = 0; reset(); popTooth.visible = false; }
  return { v3, rig, key, acc, xl, hero, hs, HS, heroSet, sliderW, HL, RL, KL, popSet, burst, POP, C_TOP, toothSet, toothG, rowsSet, rows, kindsSet, coil, KX, hideAll, floorM };
}
