// EP. 11 — combination lock, 10 s silent loop. Three number wheels spin and click into place, their notches line up at the bottom,
// the spring-loaded locking bar rises into the notches, a link pulls the latch pin out of the shackle, the shackle pops up,
// is pushed back down, the bar drops and the wheels scramble back to frame 0 (each wheel ends exactly one full turn later).
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M } from '../../js/parts.js';
import { setAccent } from '../../js/overlay.js';

export const EP = 'EP. 11';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB52E');
  ctx.bloom.threshold = 0.72; ctx.bloom.strength = 0.34; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.95;
  const P = 10, END = P;
  const key = new THREE.DirectionalLight(0xFFC27A, 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.5, 1, 0.9).normalize();
  const fill = new THREE.DirectionalLight(0x7FB0FF, 1.3); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xD6E4FF, 1.2); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0x7FB0FF, 0x231c16, 0.55));
  function rig(tgt, size, k = 2.2) {
    key.intensity = k; key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.85, 0.45, 0.4).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.2, 0.6, -1).multiplyScalar(size * 3));
  }
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const PN = new THREE.Group(); PN.position.set(0, 760, 0); scene.add(PN);
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 10, 256, 256, 256); gr.addColorStop(0, '#30426a'); gr.addColorStop(0.45, '#1a2640'); gr.addColorStop(1, '#0a0e17');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); bg.position.set(0, 10, -70); PN.add(bg);
  }
  const L = new THREE.Group(); PN.add(L);
  const steel = M.metal(0xC9D0D8, 0.22, {}), brass = M.metal(0xD9A441, 0.42, { envMapIntensity: 0.9 }), dark = M.metal(0x6b7686, 0.35, {});
  // ---- body: glass box + outline ----
  const BX0 = -33, BX1 = 33, BY0 = -16, BY1 = 10, BZ = 22;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(BX1 - BX0, BY1 - BY0, BZ), new THREE.MeshStandardMaterial({ color: 0x8fb6e8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.09, depthWrite: false, envMapIntensity: 0.4 }));
  glass.position.set((BX0 + BX1) / 2, (BY0 + BY1) / 2, 0); L.add(glass);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.8 })); edges.position.copy(glass.position); L.add(edges);
  // ---- number wheels ----
  const WR = 8.2, WT = 6.4, NR = 5.8, NH = 1.7, WX = [-9, 0, 9];
  const shape = (() => {
    const pts = []; const a0 = -90 + 12.3, a1 = -90 + 360 - 12.3;
    for (let a = a0; a <= a1; a += 1.5) { const m = ((a + 90) % 36 + 36) % 36; const r = WR + (m < 12 ? 0.5 : 0); const t = a * Math.PI / 180; pts.push(new THREE.Vector2(r * Math.cos(t), r * Math.sin(t))); }
    pts.push(new THREE.Vector2(-NH, -WR + 0.2), new THREE.Vector2(-NH, -NR), new THREE.Vector2(NH, -NR), new THREE.Vector2(NH, -WR + 0.2));
    return new THREE.Shape(pts);
  })();
  const wGeo = new THREE.ExtrudeGeometry(shape, { depth: WT, bevelEnabled: false }); wGeo.translate(0, 0, -WT / 2);
  const wheels = WX.map(cx => {
    const g = new THREE.Group(); g.position.set(cx, 0, 0); L.add(g);
    const m = new THREE.Mesh(wGeo, brass); m.rotation.y = Math.PI / 2; m.castShadow = true; g.add(m);
    const dotM = new THREE.MeshBasicMaterial({ color: 0xFF7A3D });
    [-1, 1].forEach(sg => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), dotM); d.position.set(sg * (WT / 2 + 0.1), -6.9, 0); g.add(d); });
    return g;
  });
  // axle through the wheels
  { const ax = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 40, 24), dark); ax.rotation.z = Math.PI / 2; ax.position.y = 0; L.add(ax); }
  // ---- locking bar (rises into the notches), riser, return spring ----
  const BAR_Y = -9.6, TR = 2.4;
  const barG = new THREE.Group(); barG.position.set(0, BAR_Y, 0); L.add(barG);
  { const s = new THREE.Mesh(new THREE.BoxGeometry(60.5, 2.6, 2.8), steel); s.position.x = 0.75; s.castShadow = true; barG.add(s);
    const r = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10.3, 2.8), steel); r.position.set(29, 6.5, 0); barG.add(r); }
  const glowM = new THREE.MeshBasicMaterial({ color: 0x2BD67B, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const barGlow = new THREE.Mesh(new THREE.BoxGeometry(27, 3.4, 3.6), glowM); barGlow.position.set(0, 0.4, 0); barG.add(barGlow);
  const helix = (() => { const pts = []; const N = 90, turns = 6; for (let i = 0; i <= N; i++) { const a = i / N * turns * Math.PI * 2; pts.push(v3(2.4 * Math.cos(a), i / N, 2.4 * Math.sin(a))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.34, 8, false); })();
  const spring = new THREE.Mesh(helix, dark); spring.position.set(-26, BY0 + 0.4, 0); L.add(spring);
  const spring2 = new THREE.Mesh(helix, dark); spring2.position.set(26, BY0 + 0.4, 0); L.add(spring2);
  // ---- shackle (right leg has a neck for the latch pin) ----
  const shG = new THREE.Group(); L.add(shG);
  { const arc = new THREE.Mesh(new THREE.TorusGeometry(16, 2.4, 20, 56, Math.PI), steel); arc.position.set(0, 12, 0); arc.castShadow = true; shG.add(arc);
    [-16, 16].forEach(x => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 14.4, 28), steel); leg.position.set(x, 4.8, 0); leg.castShadow = true; shG.add(leg);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 24), steel); neck.position.set(x, -3.7, 0); shG.add(neck);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.0, 28), steel); cap.position.set(x, -5.5, 0); shG.add(cap); }); }
  // ---- latch pin + link ----
  const PY = -3.8, XR = 29, LK = 10, PL = 3.4;
  const pinM = M.metal(0xFF7A3D, 0.3, { emissive: 0xFF5A1F, emissiveIntensity: 0.15 });
  const pin = new THREE.Mesh(new THREE.BoxGeometry(PL, 2.2, 2.6), pinM); pin.castShadow = true; L.add(pin);
  const linkM = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, LK, 8), dark); L.add(linkM);
  scene.updateMatrixWorld(true);

  // ---------------- timeline ----------------
  const TH0 = [70, 150, 240].map(d => d * Math.PI / 180), EXTRA = [1, 1, 0];
  const S1 = [0.0, 0.35, 0.7], TA = [2.1875, 3.125, 3.75], R1 = [8.1, 8.2, 8.3], R2 = [9.6, 9.75, 9.9];
  const wheelAng = (i, t) => {
    if (t < 7.9) { const u = clamp((t - S1[i]) / (TA[i] - S1[i])); return TH0[i] + (2 * Math.PI - TH0[i] + 2 * Math.PI * EXTRA[i]) * E.io(u); }
    const u = clamp((t - R1[i]) / (R2[i] - R1[i])); return 2 * Math.PI * (1 + EXTRA[i]) + (TH0[i] + 2 * Math.PI) * E.io(u) - 0;   // ends at 2pi(1+extra) + th0 + 2pi == th0 (mod 2pi)
  };
  const kBar = t => t < 4.4 ? 0 : t < 5.0 ? E.io((t - 4.4) / 0.6) : t < 7.6 ? 1 : t < 8.1 ? 1 - E.io((t - 7.6) / 0.5) : 0;
  const shUp = t => t < 5.0 ? 0 : t < 5.625 ? E.io((t - 5.0) / 0.625) : t < 6.875 ? 1 : t < 7.5 ? 1 - E.io((t - 6.875) / 0.625) : 0;
  function lockSet(t) {
    wheels.forEach((g, i) => { g.rotation.x = wheelAng(i, t); });
    const k = kBar(t); barG.position.y = BAR_Y + TR * k;
    glowM.opacity = clamp((k - 0.6) / 0.4) * (0.35 + 0.15 * Math.sin(t * 7)) * (1 - clamp((t - 7.6) / 0.3));
    shG.position.y = 7.2 * shUp(t);
    spring.scale.y = spring2.scale.y = (BAR_Y + TR * k - 1.3) - (BY0 + 0.4);
    const d = 5.8 + TR * k, pb = XR - Math.sqrt(LK * LK - d * d);
    pin.position.set(pb - PL / 2, PY, 0);
    const A = v3(pb, PY, 0), B = v3(XR, 2.05 + TR * k + BAR_Y - BAR_Y + 0.0, 0);   // riser top (world y = bar y + 11.65)
    B.y = BAR_Y + TR * k + 11.65; A.y = PY;
    const dd = B.clone().sub(A); linkM.position.copy(A).addScaledVector(dd, 0.5); linkM.quaternion.setFromUnitVectors(v3(0, 1, 0), dd.clone().normalize()); linkM.scale.y = dd.length() / LK;
  }
  // ---------------- camera ----------------
  const KF = [[0, v3(0, 9, 172)], [1.0, v3(0, 9, 172)], [2.6, v3(0, -2, 92)], [4.2, v3(0, -2, 92)], [5.3, v3(15, 2, 105)], [6.5, v3(15, 2, 105)], [8.3, v3(0, 9, 172)], [10, v3(0, 9, 172)]];
  const camAt = t => { for (let i = 0; i < KF.length - 1; i++) { const [t0, a] = KF[i], [t1, b] = KF[i + 1]; if (t <= t1) { const uu = t1 === t0 ? 1 : clamp((t - t0) / (t1 - t0)), u = uu * uu * (3 - 2 * uu); return v3(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u)); } } return KF[KF.length - 1][1].clone(); };
  function cam(pos, subj, fov = 36, low = 0.02) {
    camera.position.copy(pos); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = pos.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));
  const TW = 2 * Math.PI / P;
  function stateAt(t) {
    lockSet(t);
    const k = camAt(t), c = v3(k.x, k.y + 760, 0), wide = clamp((k.z - 92) / 80);
    cam(orbit(c, k.z, lerp(0.4, 0.28, wide) * Math.sin(t * TW), lerp(0.2, 0.1, wide) + 0.04 * Math.sin(t * TW + 1.0)), c, 36, 0.02);
    rig(c, lerp(34, 75, wide), 2.1);
    ctx.renderer.toneMappingExposure = 0.8 * lerp(0.85, 1.35, wide);
    scene.updateMatrixWorld(true);
  }
  const shots = [[0, 2.5], [2.5, 5], [5, 7.5], [7.5, 10]];
  // sfx: a tick per 36 deg of wheel travel, a click when each wheel settles, bar / pin / shackle events on the 96 BPM grid
  const ev = [];
  for (let i = 0; i < 3; i++) {
    for (const [a, b] of [[S1[i] - 0.001, TA[i]], [R1[i] - 0.001, R2[i]]]) { let last = wheelAng(i, a), lastT = -1; for (let t = a; t <= b; t += 0.004) { const x = wheelAng(i, t); if (Math.floor(x / (Math.PI / 5)) !== Math.floor(last / (Math.PI / 5)) && t - lastT > 0.06) { ev.push({ t, n: 'ui_tick' }); lastT = t; } last = x; } }
    ev.push({ t: TA[i], n: 'metal_click' });
  }
  ev.push({ t: 5.0, n: 'press_thud' }, { t: 4.85, n: 'metal_tink' }, { t: 5.1, n: 'whoosh_soft' }, { t: 5.625, n: 'plastic_click' }, { t: 7.5, n: 'metal_click' }, { t: 7.7, n: 'metal_tink' }, { t: 8.1, n: 'press_thud' });
  const sfx = ev.filter(x => x.t < END - 0.05);
  function seek(t, g, opts = {}) {
    const plate_ = opts.plate !== false;
    stateAt(t);
    lens.uniforms.uSeed.value = (t < 1 / 30) ? 0 : Math.floor(t * 30) % 1000;
    if (plate_) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
  }
  return { seek, END, sfx, lines: [], shots, caps: [], lockTicks: () => [] };
}
