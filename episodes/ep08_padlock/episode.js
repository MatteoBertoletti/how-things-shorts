// EP. 08 — the padlock. Experiment E3: NO voice (on-screen text + sound only), and the first frame is the finished object, not the question.
// Story: a closed padlock turns x-ray, five pin stacks straddle the gap and block the plug; a wrong key lifts them to wrong heights (stuck);
// the right key lifts every pin to exactly the gap (the shear line) and the plug turns. The answer comes only in the last third.
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M, pedestal, gummyBear } from '../../js/parts.js';
import { crayon } from '../../js/pen.js';
import { setAccent, titleRawReal, kcap, blurred, setParallax, endCard2 } from '../../js/overlay.js';

export const EP = 'EP. 08';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB52E');
  ctx.bloom.threshold = 0.7; ctx.bloom.strength = 0.36; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.85;
  const lines = timing.lines, Ls = i => lines[i - 1].s;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  const Wd = (i, w, n = 0) => { const Lx = lines[i - 1]; const hits = Lx.words.filter(x => norm(x.w).startsWith(norm(w))); return hits.length ? hits[Math.min(n, hits.length - 1)].s : Lx.s; };
  const LOOP = 0.9;
  // timeline
  const tXray0 = 1.3, tXray1 = 2.6, tPin = 3.2;
  const tW0 = 5.4, tW1 = 7.5, tJam0 = 7.7, tJam1 = 8.7, tWo0 = 8.8, tWo1 = 9.3;
  const tR0 = 9.4, tR1 = 12.6, tAns = 15.4, tTurn0 = 16.5, tTurn1 = 17.4, tSolid0 = 17.6, tSolid1 = 18.1, tOpen0 = 18.1, tOpen1 = 18.8;
  const tEC = 19.5, END = +(tEC + 2.5 + LOOP).toFixed(3);
  const tSnap = 1.0;

  // lights
  const key = new THREE.DirectionalLight(0xFFC27A, 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.5, 1, 0.9).normalize();
  const fill = new THREE.DirectionalLight(0x7FB0FF, 1.2); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xD6E4FF, 1.0); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0x7FB0FF, 0x231c16, 0.5));
  const spotG = new THREE.SpotLight(0x2BD67B, 0, 0, 0.42, 0.6, 0), spotB = new THREE.SpotLight(0xFF7A3D, 0, 0, 0.42, 0.6, 0); scene.add(spotG, spotG.target, spotB, spotB.target);
  let expo = 0.78;
  function rig(tgt, size, k = 2.2) {
    key.intensity = k; key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.85, 0.45, 0.4).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.2, 0.6, -1).multiplyScalar(size * 3));
  }
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const station = (x, y = 760) => { const g = new THREE.Group(); g.position.set(x, y, 0); scene.add(g); return g; };
  const box = (sx, sy, sz, x, y, z, m, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const steelDark = () => M.metal(0x4b5563, 0.34, { envMapIntensity: 1.1 });

  // ===== LOCK station =====
  const LK = station(0);
  box(260, 340, 3, 10, 18, -26, M.std(0x1b2330, { roughness: 0.6, metalness: 0.4 }), LK);
  const lockG = new THREE.Group(); LK.add(lockG);
  // padlock body (opaque -> x-ray -> opaque) and its outline
  const bodyM = new THREE.MeshStandardMaterial({ color: 0x5a6676, roughness: 0.32, metalness: 0.75, transparent: true, opacity: 1, envMapIntensity: 1.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(54, 50, 26), bodyM); body.position.set(10, 15, 0); body.castShadow = true; lockG.add(body);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0 })); edges.position.copy(body.position); lockG.add(edges);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(44, 40, 1.2), M.metal(0x7d8896, 0.28, { transparent: true, opacity: 1 })); plate.position.set(10, 15, 13.4); lockG.add(plate);
  { const dk = M.std(0x0b0e14, { roughness: 0.6 }); const kh = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), dk); kh.position.set(10, 6, 14.1); lockG.add(kh); const ks = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 7), dk); ks.position.set(10, 2.6, 14.1); lockG.add(ks); lockG.userData.kh = [kh, ks]; }
  const shackle = new THREE.Group(); shackle.position.set(24, 40, 0); lockG.add(shackle);
  { const sm = M.metal(0xc9d0d8, 0.22, {}); const arc = new THREE.Mesh(new THREE.TorusGeometry(14, 3.2, 20, 48, Math.PI), sm); arc.position.set(-14, 10, 0); arc.castShadow = true; shackle.add(arc);
    const l1 = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 12, 24), sm); l1.position.set(0, 4, 0); shackle.add(l1); const l2 = l1.clone(); l2.position.set(-28, 4, 0); shackle.add(l2); }
  // cylinder inside: plug (turns), housing channel marks, pins, springs
  const plugG = new THREE.Group(); lockG.add(plugG);
  const plugM = new THREE.MeshStandardMaterial({ color: 0x9fb4cf, roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.0, depthWrite: false });
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 46, 48, 1, true), plugM); plug.position.set(0, 14, 0); plug.visible = true; plugG.add(plug);
  const PY = [2, 8.5, 15, 21.5, 28], XR = 0.6, SHEAR = 11, DRV = 7, WALL = 31;
  const brass = M.metal(0xD9A441, 0.3, {}), steelL = M.metal(0xB4BCC8, 0.3, {}), springM = M.metal(0x6b7686, 0.4, {});
  const pinGeo = new THREE.CylinderGeometry(1.9, 1.9, 1, 24); pinGeo.translate(0, 0.5, 0);
  const helix = (() => { const pts = []; const N = 120, turns = 6; for (let i = 0; i <= N; i++) { const a = i / N * turns * Math.PI * 2; pts.push(v3(2.3 * Math.cos(a), i / N, 2.3 * Math.sin(a))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.38, 8, false); })();
  const kp = [], dp = [], sp = [];
  PY.forEach((y, i) => {
    const a = new THREE.Mesh(pinGeo, brass); a.castShadow = true; const ga = new THREE.Group(); a.rotation.z = -Math.PI / 2; ga.add(a); ga.position.set(0, y, 0); plugG.add(ga); kp.push({ g: ga, m: a });
    const b = new THREE.Mesh(pinGeo, steelL); b.castShadow = true; const gb = new THREE.Group(); b.rotation.z = -Math.PI / 2; gb.add(b); gb.position.set(0, y, 0); lockG.add(gb); dp.push({ g: gb, m: b });
    const c = new THREE.Mesh(helix, springM); const gc = new THREE.Group(); c.rotation.z = -Math.PI / 2; gc.add(c); gc.position.set(0, y, 0); lockG.add(gc); sp.push({ g: gc, m: c });
  });
  // shear line + markers
  const shearM = new THREE.MeshBasicMaterial({ color: 0xFF7A3D, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const shear = new THREE.Mesh(new THREE.BoxGeometry(0.7, 44, 14), shearM); shear.position.set(SHEAR, 14, 0); lockG.add(shear);
  const markers = PY.map(y => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFF7A3D, transparent: true, opacity: 0, depthTest: false })); m.renderOrder = 9; m.position.set(SHEAR, y, 0); lockG.add(m); return m; });
  // keys: profile edge (x of the cut) as a function of k = distance behind the tip
  const KC = [29.5, 23, 16.5, 10, 3.5];                      // key positions of pins 0..4 when fully inserted (tip at y = 31.5)
  const YE = 31.5;
  const mkEdge = (lv) => { const pts = [[-5, XR], [0, XR]]; [4, 3, 2, 1, 0].forEach(i => { pts.push([KC[i] - 1.6, lv[i]], [KC[i] + 1.6, lv[i]]); }); pts.push([34, lv[0]], [36, 3]); return pts; };
  const LV_OK = [4.5, 2.5, 6, 3.5, 5], LV_BAD = [7.2, 0.6, 6, 6.8, 2.4];
  const edgeOK = mkEdge(LV_OK), edgeBAD = mkEdge(LV_BAD);
  const edgeAt = (pts, k) => { if (k <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (k <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return lerp(a[1], b[1], (k - a[0]) / (b[0] - a[0] || 1)); } return pts[pts.length - 1][1]; };
  const LEN = LV_OK.map(x => SHEAR - x);                       // key-pin lengths (cut so the right key puts every pin top exactly on the shear line)
  const mkKey = (pts, color) => {
    const g = new THREE.Group(); const sh = new THREE.Shape(); sh.moveTo(-5, 0); sh.lineTo(pts[1][1], 0); for (let i = 2; i < pts.length; i++) sh.lineTo(pts[i][1], -pts[i][0]);
    sh.lineTo(3, -42); sh.lineTo(-5, -42); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }); geo.translate(0, 0, -1.5);
    const km = M.metal(color, 0.25, {}); const blade = new THREE.Mesh(geo, km); blade.castShadow = true; g.add(blade);
    const bow = new THREE.Shape(); bow.absarc(-1, -52, 9.5, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(-1, -52, 5.2, 0, Math.PI * 2, true); bow.holes.push(hole);
    const bg = new THREE.ExtrudeGeometry(bow, { depth: 3, bevelEnabled: false, curveSegments: 40 }); bg.translate(0, 0, -1.5); const b2 = new THREE.Mesh(bg, km); b2.castShadow = true; g.add(b2);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 3), km); neck.position.set(-1, -43, 0); g.add(neck);
    plugG.add(g); return g;
  };
  const keyOK = mkKey(edgeOK, 0xF0B94A), keyBAD = mkKey(edgeBAD, 0x9fb4cf);

  // ===== CHOICE =====
  const chG = station(20000, 0);
  const floorC = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M.std(0x121823, { roughness: 0.6, metalness: 0.2 })); floorC.rotation.x = -Math.PI / 2; floorC.position.y = 2; floorC.receiveShadow = true; chG.add(floorC);
  const pedG = pedestal(78, 130, 0x2BD67B), pedB = pedestal(78, 130, 0xFF7A3D); pedG.position.x = -105; pedB.position.x = 105; chG.add(pedG, pedB);
  const cray = crayon(0x1E9E55); cray.scale.setScalar(2.8); chG.add(cray);
  const bear = gummyBear(0xFF7A3D); bear.scale.setScalar(1.25); chG.add(bear);
  scene.updateMatrixWorld(true);

  // ---------------- state ----------------
  const ytW = t => t < tW0 ? -48 : t < tW1 ? lerp(-48, YE, E.io((t - tW0) / (tW1 - tW0))) : t < tWo0 ? YE : t < tWo1 ? lerp(YE, -48, E.io((t - tWo0) / (tWo1 - tWo0))) : -48;
  const ytR = t => t < tR0 ? -48 : t < tR1 ? lerp(-48, YE, E.io((t - tR0) / (tR1 - tR0))) : YE;
  const passT = (i, t0, t1, from = -48) => { const u = (PY[i] - from) / (YE - from); let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (E.io(m) < u) lo = m; else hi = m; } return lerp(t0, t1, lo); };
  function lockSet(t) {
    const wrong = t < tR0 - 0.15; const yt = wrong ? ytW(t) : ytR(t); const edge = wrong ? edgeBAD : edgeOK;
    keyBAD.visible = wrong && yt > -47.5; keyOK.visible = !wrong; (wrong ? keyBAD : keyOK).position.set(0, yt, 0); (wrong ? keyOK : keyBAD).position.set(0, -48, 0);
    // x-ray
    const xr = E.io(clamp((t - tXray0) / (tXray1 - tXray0))) * (1 - E.io(clamp((t - tSolid0) / (tSolid1 - tSolid0))));
    bodyM.opacity = lerp(1, 0.07, xr); bodyM.depthWrite = xr < 0.05; plate.material.opacity = lerp(1, 0, Math.min(1, xr * 1.6)); plate.visible = xr < 0.62; lockG.userData.kh.forEach(o => o.visible = xr < 0.62); edges.material.opacity = 0.7 * xr; plugM.opacity = 0.2 * xr;
    lockG.rotation.y = 0.3 * Math.cos(t * 1.3) * (1 - E.io(clamp((t - 1.0) / 1.4))) * (t < tSolid0 ? 1 : 0);
    const reveal = xr > 0.05;
    // pins
    const tops = []; PY.forEach((y, i) => {
      const b = edgeAt(edge, yt - y), top = b + LEN[i];
      kp[i].g.position.x = b; kp[i].m.scale.y = LEN[i]; dp[i].g.position.x = top; dp[i].m.scale.y = DRV; sp[i].g.position.x = top + DRV; sp[i].m.scale.y = WALL - top - DRV;
      [kp[i].g, dp[i].g, sp[i].g].forEach(o => o.visible = reveal); tops.push(top);
    });
    // plug turn / jam wiggle (the key and the key pins ride with it)
    let th = 0;
    if (t >= tJam0 && t < tJam1) th = 0.085 * Math.sin((t - tJam0) * 22) * Math.exp(-(t - tJam0) * 1.2);
    if (t >= tTurn0) th = 1.15 * E.io(clamp((t - tTurn0) / (tTurn1 - tTurn0)));
    plugG.rotation.y = th; plug.visible = reveal;
    // shear line + markers
    const full = yt > YE - 0.6; const aligned = tops.map(x => Math.abs(x - SHEAR) < 0.25);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    shearM.opacity = (t >= tPin - 0.1 ? 0.22 + 0.08 * pulse : 0) * (reveal ? 1 : 0) * (t > tOpen0 - 0.2 ? 0 : 1) + (t >= tAns && t < tOpen0 ? 0.3 : 0);
    markers.forEach((m, i) => { const on = reveal && full && t < tOpen0 - 0.2 && (t < tR0 ? t > tW1 + 0.15 : t > tR1 - 0.1); m.material.opacity = on ? 0.95 : 0; m.material.color.setHex(aligned[i] ? 0xFF7A3D : 0xFF3B3B); m.position.x = tops[i]; m.position.y = PY[i];
      m.scale.setScalar(aligned[i] && t >= tAns ? 1.2 + 0.25 * pulse : 1); });
    // driver pins: orange rim in the "pins block the way" beat
    // shackle opens once the plug has turned
    const so = E.io(clamp((t - tOpen0) / (tOpen1 - tOpen0)));
    shackle.position.y = 40 + 8 * so; shackle.rotation.y = 2.4 * so;
  }
  // ---------------- camera ----------------
  let shake = 0, TT = 0;
  function cam(pos, subj, fov = 36, low = 0.12) {
    const p = pos.clone(); if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; }
    camera.position.copy(p); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = p.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const c0 = (x, y) => v3(x, y + 760, 0);
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));
  const shots = []; const S = (t0, t1, fn, par = 1) => shots.push({ t0, t1, fn, par });
  const all = [LK, chG];
  const wide = (c, size, k = 2.0, e = 0.85, bl = 0.25) => { rig(c, size, k); expo = e; ctx.bloom.strength = bl; };
  const hookPlate = (t) => { LK.visible = true; lockSet(t); const c = c0(10, 16); cam(orbit(c, lerp(235, 215, E.o(clamp(t / 1.2))), 0, 0.04), c, 36, 0.1); wide(c, 90, 2.0, 0.78, 0.25); };
  S(0, tSnap, (u, t) => hookPlate(t), 0);
  S(tSnap, tXray1 + 0.5, (u, t) => { LK.visible = true; lockSet(t); const c = c0(12, 16); cam(orbit(c, lerp(215, 190, E.io(u)), lerp(0, 0.3, E.io(u)), 0.06), c, 36, 0.1); wide(c, 90, 2.0, 0.78, 0.25); });
  S(tXray1 + 0.5, tW0, (u, t) => { LK.visible = true; lockSet(t); const c = c0(15, 15); cam(orbit(c, lerp(185, 150, E.io(u)), lerp(0.3, 0.1, u), 0.04), c, 36, 0.1); wide(c, 70, 2.0, 0.78, 0.3); });
  S(tW0, tJam0 - 0.2, (u, t) => { LK.visible = true; lockSet(t); const c = c0(10, 6); cam(orbit(c, lerp(210, 190, u), 0.05, 0.04), c, 36, 0.1); wide(c, 90, 2.0, 0.78, 0.25); });
  S(tJam0 - 0.2, tWo0, (u, t) => { LK.visible = true; lockSet(t); const c = c0(15, 16); cam(orbit(c, lerp(135, 118, u), lerp(0.15, -0.1, u), 0.03), c, 36, 0.1); wide(c, 60, 2.0, 0.78, 0.3); });
  S(tWo0, tR0 + 1.2, (u, t) => { LK.visible = true; lockSet(t); const c = c0(10, 4); cam(orbit(c, 215, lerp(0.1, 0.0, u), 0.05), c, 36, 0.1); wide(c, 90, 2.0, 0.78, 0.25); });
  S(tR0 + 1.2, tR1 + 0.2, (u, t) => { LK.visible = true; lockSet(t); const c = c0(15, 17); cam(orbit(c, lerp(150, 122, E.io(u)), lerp(-0.2, 0.1, u), 0.03), c, 36, 0.1); wide(c, 60, 2.0, 0.78, 0.3); });
  S(tR1 + 0.2, tAns, (u, t) => { LK.visible = true; lockSet(t); const c = c0(14, 16); cam(orbit(c, lerp(122, 105, u), lerp(0.1, 0.0, u), 0.03), c, 36, 0.1); wide(c, 60, 2.0, 0.78, 0.3); });
  S(tAns, tTurn0, (u, t) => { LK.visible = true; lockSet(t); const c = c0(14, 16); cam(orbit(c, lerp(105, 92, E.io(u)), 0.0, 0.0), c, 36, 0.1); wide(c, 55, 2.0, 0.78, 0.35); });
  S(tTurn0, tSolid0, (u, t) => { LK.visible = true; lockSet(t); const c = c0(8, 16); cam(orbit(c, lerp(150, 175, E.io(u)), lerp(0.7, 0.45, u), lerp(0.2, 0.3, u)), c, 36, 0.1); wide(c, 70, 2.0, 0.78, 0.3); });
  S(tSolid0, tEC, (u, t) => { LK.visible = true; lockSet(t); const c = c0(10, 20); cam(orbit(c, lerp(215, 200, E.o(u)), lerp(0.3, 0.0, E.io(u)), 0.04), c, 36, 0.1); wide(c, 90, 2.0, 0.78, 0.3); });
  const tE3 = tEC + (END - LOOP - tEC) / 2;
  const choiceSet = t => { chG.visible = true; const lt = t - tEC; cray.position.set(-95, 150, 0); cray.rotation.set(0.0, lt * 0.6, 0.3);
    bear.position.set(105, 148, 0); bear.rotation.set(0, 0.5 * Math.sin(lt * 1.6) + 0.3, 0.05 * Math.sin(lt * 2));
    spotG.intensity = 3 * E.o(clamp(lt / 0.3)); spotB.intensity = 7 * E.o(clamp((lt - 0.15) / 0.3));
    spotG.position.copy(chG.position).add(v3(-260, 520, 260)); spotG.target.position.copy(chG.position).add(v3(-105, 150, 0));
    spotB.position.copy(chG.position).add(v3(260, 520, 260)); spotB.target.position.copy(chG.position).add(v3(105, 150, 0)); };
  S(tEC, tE3, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 215, 0)); cam(chG.position.clone().add(v3(0, lerp(250, 236, E.io(u)), lerp(1080, 1010, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); expo = 1.1; });
  S(tE3, END - LOOP, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 220, 0)); cam(chG.position.clone().add(v3(lerp(-60, -20, E.io(u)), 160, lerp(950, 900, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); expo = 1.1; });
  S(END - LOOP, END + 1, (u, t) => hookPlate(t - (END - 1 / 30)), 0);
  const shotAt = (t) => shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  function stateAt(t) {
    TT = t; shake = 0; expo = 0.78; ctx.bloom.strength = 0.36; spotG.intensity = spotB.intensity = 0;
    all.forEach(o => o.visible = false);
    const sh = shotAt(t); sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    ctx.renderer.toneMappingExposure = expo * 1.22;
    spotG.visible = spotG.intensity > 0; spotB.visible = spotB.intensity > 0;
    scene.updateMatrixWorld(true); return sh;
  }
  // ---------------- text ----------------
  const TEXT = []; const T_ = (o) => { TEXT.push(o); return o; };
  const Y = 440;
  const titleO = { l1: 'HOW DOES A LOCK', l2: 'KNOW YOUR KEY?', y: 400, words: [Wd(1, 'How'), Wd(1, 'does'), Wd(1, 'a'), Wd(1, 'lock')], rawWord: 'LOCK', scan: [0.15, 0.85], punchAt: Wd(1, 'key'), until: 3.0, push: (tt) => clamp(tt / 2) };
  T_({ k: 'title', at: -1, until: 3.0, label: 'HOW DOES A LOCK / KNOW YOUR KEY?', fx: 'RAW TO REAL title' });
  T_({ k: 'cap', at: 3.2, until: tW0 - 0.1, words: [{ t: 'PINS', a: true, k: 'twist' }, { t: 'BLOCK', k: 'verb', at: 3.55 }, { t: 'THE WAY.', k: 'noun', at: 3.9 }], size: 116, y: Y + 30 });
  T_({ k: 'cap', at: 5.6, until: tWo1, words: [{ t: 'WRONG KEY:', k: 'verb' }, { t: 'STUCK.', a: true, k: 'twist', at: 6.9 }], size: 118, y: Y + 30 });
  T_({ k: 'cap', at: 9.2, until: 11.5, words: [{ t: 'RIGHT', k: 'verb' }, { t: 'KEY.', a: true, k: 'twist', at: 9.7 }], size: 150, y: Y + 30 });
  T_({ k: 'cap', at: 11.6, until: 13.45, words: [{ t: 'EACH', k: 'verb' }, { t: 'PIN', k: 'noun', at: 12.0 }, { t: 'LIFTS.', a: true, k: 'twist', at: 12.4 }], size: 130, y: Y + 30 });
  T_({ k: 'cap', at: 13.5, until: tAns - 0.05, words: [{ t: 'WATCH', k: 'verb' }, { t: 'THE', k: 'noun', at: 13.85 }, { t: 'GAPS.', a: true, k: 'twist', at: 14.2 }], dir: -1, size: 130, y: Y + 30 });
  T_({ k: 'cap', at: tAns, until: tTurn0 - 0.05, words: [{ t: 'GAPS', a: true, k: 'twist' }, { t: 'LINE UP.', k: 'noun', at: 15.9 }], size: 130, y: Y + 30 });
  T_({ k: 'cap', at: tTurn0, until: 17.95, words: [{ t: 'IT', k: 'noun' }, { t: 'TURNS.', a: true, k: 'twist', at: 16.8 }], size: 150, y: Y + 30 });
  T_({ k: 'cap', at: 18.0, until: tEC - 0.05, words: [{ t: 'FIVE PINS.', k: 'verb' }, { t: 'ONE LINE.', a: true, k: 'twist', at: 18.7 }], size: 112, y: Y + 30 });
  T_({ k: 'end', at: tEC, until: END - LOOP, fx: 'NEXT EPISODE? crayon (green) / gummy bear (orange), COMMENT BELOW, FOLLOW: NEW ONE EVERY DAY' });
  T_({ k: 'title-loop', at: END - LOOP, until: END + 1, label: 'HOW DOES A LOCK / KNOW YOUR KEY?', fx: 'blueprint rebuilds, last frame = frame 0' });
  function drawText(g, t) {
    const sh = shotAt(t); setParallax(((clamp((t - sh.t0) / (sh.t1 - sh.t0)) - 0.5) * 2) * sh.par, 0);
    for (const o of TEXT) {
      if (t < o.at - 0.01 || t > o.until + 0.01) continue;
      if (o.k === 'title') titleRawReal(g, t, titleO);
      else if (o.k === 'title-loop' && t >= END - 1 / 30 - 1e-4) titleRawReal(g, 0, { ...titleO, push: () => 0 });
      else if (o.k === 'title-loop') titleRawReal(g, t, { ...titleO, words: [], loopAt: END - LOOP, push: () => 0 });
      else if (o.k === 'cap') kcap(g, t, { y: o.y || Y, ...o });
      else if (o.k === 'end') endCard2(g, t, { at: o.at, comment: Wd(8, 'Comment'), commentW2: Wd(8, 'below'), follow: Wd(8, 'below') + 0.15, until: o.until, left: 'CRAYON', right: 'GUMMY BEAR', next: 'EP. 09', followText: 'FOLLOW: NEW ONE EVERY DAY', rightColor: '#FF7A3D' });
    }
  }
  // ---------------- sound ----------------
  const sfx = [{ t: 0.0, n: 'pen_scratch' }, { t: 0.15, n: 'ui_tick' }, { t: tSnap, n: 'whoosh_soft' }, { t: tXray0 + 0.2, n: 'swell' }, { t: tPin, n: 'ui_tick' }, { t: tPin + 0.5, n: 'metal_tink' },
    { t: tW0, n: 'whoosh_soft' }, ...PY.map((_, i) => ({ t: passT(i, tW0, tW1), n: i % 2 ? 'ui_tick' : 'metal_tink' })), { t: tJam0, n: 'press_thud' }, { t: tJam0 + 0.35, n: 'press_thud' }, { t: tWo0, n: 'whoosh_soft' },
    { t: tR0, n: 'whoosh_soft' }, ...PY.map((_, i) => ({ t: passT(i, tR0, tR1), n: i % 2 ? 'metal_click' : 'ui_tick' })),
    { t: tAns - 0.1, n: 'low_whoosh' }, { t: tAns, n: 'swell' }, ...PY.map((_, i) => ({ t: tAns + 0.1 + i * 0.1, n: 'click_ui' })),
    { t: tTurn0 + 0.1, n: 'metal_click' }, { t: tTurn1 - 0.2, n: 'press_thud' }, { t: tOpen0 + 0.3, n: 'plastic_click' }, { t: tOpen0 + 0.55, n: 'metal_tink' },
    { t: tEC, n: 'whoosh' }, { t: tEC + 0.25, n: 'click_ui' }, { t: tEC + 0.4, n: 'click_ui' }, { t: END - LOOP, n: 'whoosh_soft' }];
  function seek(t, g, opts = {}) {
    const plate_ = opts.plate !== false, over = opts.over !== false;
    stateAt(t);
    lens.uniforms.uSeed.value = (t >= END - 1 / 30 - 1e-4 || t < 1 / 30) ? 0 : Math.floor(t * 30) % 1000;
    if (plate_) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
    if (!over) return;
    blurred(g, t, drawText);
    stateAt(t);
  }
  return { seek, END, sfx, lines, shots: shots.map(s => [s.t0, s.t1]), caps: TEXT.map(o => [o.at, o.until, o.label || (o.words ? o.words.map(w => w.t).join(' ') : o.k), o.k, o.fx || '']), lockTicks: () => [] };
}
