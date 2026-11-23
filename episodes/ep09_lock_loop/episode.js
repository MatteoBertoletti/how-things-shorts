// EP. 09 — padlock, 10 s silent loop. Experiment A (from the 23 Nov outlier research): short seamless mechanism loop, no voice, no text.
// One cycle: key slides in and lifts every pin to the shear line -> plug turns -> shackle pops open -> closes -> plug turns back -> key slides out = frame 0.
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M } from '../../js/parts.js';
import { setAccent } from '../../js/overlay.js';

export const EP = 'EP. 09';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB52E');
  ctx.bloom.threshold = 0.7; ctx.bloom.strength = 0.36; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.85;
  const P = 10, END = P;
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
  scene.updateMatrixWorld(true);

  // ---------------- one cycle (period P) ----------------
  const TW = 2 * Math.PI / P;
  const Y0 = -10, tIn1 = 2.4, tTurn0 = 3.0, tTurn1 = 4.0, tOpen0 = 4.05, tOpen1 = 5.15, tShut0 = 5.65, tShut1 = 6.65, tBack0 = 6.7, tBack1 = 7.6, tOut0 = 7.7, tOut1 = 9.9;
  const ytAt = t => t < tIn1 ? lerp(Y0, YE, E.io(t / tIn1)) : t < tOut0 ? YE : t < tOut1 ? lerp(YE, Y0, E.io((t - tOut0) / (tOut1 - tOut0))) : Y0;
  const passIn = i => { const u = (PY[i] - Y0) / (YE - Y0); let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (E.io(m) < u) lo = m; else hi = m; } return lerp(0, tIn1, lo); };
  const passOut = i => { const u = (YE - PY[i]) / (YE - Y0); let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (E.io(m) < u) lo = m; else hi = m; } return lerp(tOut0, tOut1, lo); };
  let soCur = 0;
  function lockSet(t) {
    const yt = ytAt(t);
    keyBAD.visible = false; keyOK.visible = true; keyOK.position.set(0, yt, 0); keyBAD.position.set(0, -48, 0);
    bodyM.opacity = 0.07; bodyM.depthWrite = false; plate.material.opacity = 0; plate.visible = false; lockG.userData.kh.forEach(o => o.visible = false);
    edges.material.opacity = 0.7; plugM.opacity = 0.2;
    lockG.rotation.y = 0;
    const tops = [];
    PY.forEach((y, i) => {
      const b = edgeAt(edgeOK, yt - y), top = b + LEN[i];
      kp[i].g.position.x = b; kp[i].m.scale.y = LEN[i]; dp[i].g.position.x = top; dp[i].m.scale.y = DRV; sp[i].g.position.x = top + DRV; sp[i].m.scale.y = WALL - top - DRV; tops.push(top);
    });
    let th = 0;
    if (t >= tTurn0 && t < tBack0) th = 1.15 * E.io(clamp((t - tTurn0) / (tTurn1 - tTurn0)));
    else if (t >= tBack0) th = 1.15 * (1 - E.io(clamp((t - tBack0) / (tBack1 - tBack0))));
    plugG.rotation.y = th; plug.visible = true;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    const lit = clamp((t - (tIn1 - 0.3)) / 0.3) * (1 - clamp((t - (tOpen0 + 0.2)) / 0.3));
    shearM.opacity = 0.22 + 0.1 * pulse + 0.2 * lit;
    markers.forEach((m, i) => { m.material.opacity = 0.95 * lit; m.material.color.setHex(0xFF7A3D); m.position.x = tops[i]; m.position.y = PY[i]; m.scale.setScalar(1 + 0.25 * pulse * lit); });
    const so = E.io(clamp((t - tOpen0) / (tOpen1 - tOpen0))) * (1 - E.io(clamp((t - tShut0) / (tShut1 - tShut0))));
    shackle.position.y = 40 + 8 * so; shackle.rotation.y = 2.0 * so; soCur = so;
  }
  // ---------------- camera: periodic sway + slow push (period P) ----------------
  function cam(pos, subj, fov = 36, low = 0.1) {
    camera.position.copy(pos); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = pos.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));
  function stateAt(t) {
    lockSet(t); LK.visible = true;
    const c = v3(8 + 4 * soCur, 25 + 17 * soCur + 760, 0);
    cam(orbit(c, 186 + 12 * Math.cos(t * TW) + 16 * soCur, 0.3 * Math.sin(t * TW), 0.1 + 0.05 * Math.sin(t * TW + 1.0)), c, 36, 0.1);
    rig(c, 60, 2.0); expo = 0.78; ctx.bloom.strength = 0.3;
    ctx.renderer.toneMappingExposure = expo * 1.22;
    spotG.visible = false; spotB.visible = false;
    scene.updateMatrixWorld(true);
  }
  const shots = [[0, 2.5], [2.5, 5], [5, 7.5], [7.5, 10]];
  // ---------------- sound ----------------
  const sfx = [{ t: 0.0, n: 'whoosh_soft' }, ...PY.map((_, i) => ({ t: passIn(i), n: i % 2 ? 'ui_tick' : 'metal_tink' })), { t: tIn1 - 0.1, n: 'swell' }, ...PY.map((_, i) => ({ t: tIn1 + 0.05 + i * 0.07, n: 'click_ui' })),
    { t: tTurn0 + 0.05, n: 'metal_click' }, { t: tTurn1 - 0.1, n: 'press_thud' }, { t: tOpen0 + 0.25, n: 'plastic_click' }, { t: tOpen0 + 0.5, n: 'metal_tink' },
    { t: tShut1 - 0.15, n: 'plastic_click' }, { t: tBack0 + 0.05, n: 'metal_click' }, { t: tBack1 - 0.15, n: 'press_thud' },
    { t: tOut0, n: 'whoosh_soft' }, ...PY.map((_, i) => ({ t: passOut(i), n: i % 2 ? 'metal_tink' : 'ui_tick' }))].filter(x => x.t < END - 0.05);
  function seek(t, g, opts = {}) {
    const plate_ = opts.plate !== false;
    stateAt(t);
    lens.uniforms.uSeed.value = (t < 1 / 30) ? 0 : Math.floor(t * 30) % 1000;
    if (plate_) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
  }
  return { seek, END, sfx, lines: [], shots, caps: [], lockTicks: () => [] };
}
