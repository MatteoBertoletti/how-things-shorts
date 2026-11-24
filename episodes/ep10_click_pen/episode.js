// EP. 10 — click pen, 10 s silent loop. Experiment A2: same loop formula as EP.09 (silent, no text, seamless), different mechanism.
// Two identical click cycles in 10 s: press -> ratchet cam turns 30 deg and latches (refill out) -> press again -> cam clears the stops, spring pulls the refill back.
// The cam turns 60 deg per cycle, so the picture repeats every 2 cycles = the loop. Camera: wide -> close on the ratchet -> wide (period 10 s).
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M } from '../../js/parts.js';
import { setAccent } from '../../js/overlay.js';

export const EP = 'EP. 10';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB52E');
  ctx.bloom.threshold = 0.7; ctx.bloom.strength = 0.3; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.85;
  const P = 10, END = P, CP = 5;
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

  // ===== PEN station =====
  const PN = station(0);
  box(260, 340, 3, 8, 22, -26, M.std(0x1b2330, { roughness: 0.6, metalness: 0.4 }), PN);
  const penG = new THREE.Group(); PN.add(penG);
  const RB = 6.5, YT = 64, YN = -12, YTIP = -26;
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fb6e8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  const shell = new THREE.Mesh(new THREE.LatheGeometry([[RB, YT], [RB, YN], [1.9, YTIP], [1.3, YTIP]].map(p => new THREE.Vector2(p[0], p[1])), 64), glass); penG.add(shell);
  const lineM = new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.75 });
  const seg = (a, b, r = 0.14, m = lineM) => { const d = b.clone().sub(a), L = d.length(); const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), m); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize()); penG.add(o); return o; };
  [-1, 1].forEach(sg => { seg(v3(sg * RB, YN, 0), v3(sg * RB, YT, 0)); seg(v3(sg * RB, YN, 0), v3(sg * 1.9, YTIP, 0)); });
  [YT, YN].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(RB, 0.14, 6, 64), lineM); r.rotation.x = Math.PI / 2; r.position.y = y; penG.add(r); });
  // shoulder inside the nose (spring seat)
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(RB - 0.3, 4.2, 1.2, 48), M.metal(0x7d8896, 0.3, {})); seat.position.y = YN + 0.6; penG.add(seat);
  // stop members: 6 ribs hanging from above, tips at y = 19
  const stopM = new THREE.MeshStandardMaterial({ color: 0xFF7A3D, roughness: 0.4, metalness: 0.4, emissive: 0xFF5A1F, emissiveIntensity: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
  const polar = (o, r, a) => { o.position.x = r * Math.cos(a); o.position.z = -r * Math.sin(a); o.rotation.y = a; };
  for (let k = 0; k < 6; k++) { const o = new THREE.Mesh(new THREE.BoxGeometry(2.4, 19, 1.5), stopM); o.position.y = 28.5; polar(o, 5.1, (30 + 60 * k) * Math.PI / 180); o.castShadow = true; penG.add(o); }
  // plunger (button + stem)
  const plG = new THREE.Group(); penG.add(plG);
  const blue = M.metal(0x2F6BFF, 0.28, {});
  { const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 7, 40), blue); cap.position.y = 74; cap.castShadow = true; plG.add(cap);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), blue); dome.position.y = 77.5; plG.add(dome);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 38, 32), blue); stem.position.y = 50.2; stem.castShadow = true; plG.add(stem); }
  // cam body (rotating ratchet) : cylinder + 6 sawtooth teeth on top + 3 lugs
  const camG = new THREE.Group(); penG.add(camG);
  const brass = M.metal(0xD9A441, 0.3, {});
  { const body = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 17, 40), brass); body.position.y = 20.5; body.castShadow = true; camG.add(body);
    const ts = new THREE.Shape(); ts.moveTo(0, 0); ts.lineTo(2.4, 0); ts.lineTo(0, 2.2); ts.closePath();
    const tg = new THREE.ExtrudeGeometry(ts, { depth: 1.5, bevelEnabled: false });
    for (let k = 0; k < 6; k++) { const o = new THREE.Mesh(tg, brass); o.rotation.set(0, 0, 0); const a = k * Math.PI / 3; o.position.set(2.1 * Math.cos(a), 29, -2.1 * Math.sin(a)); o.rotation.y = a + Math.PI / 2; camG.add(o); }
    for (let k = 0; k < 3; k++) { const o = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 2.3), brass); o.position.y = 28.1; polar(o, 4.2, k * 2 * Math.PI / 3); o.castShadow = true; camG.add(o); } }
  // refill (ink tube, tip, collar) + return spring
  const rfG = new THREE.Group(); penG.add(rfG);
  const tubeM = new THREE.MeshStandardMaterial({ color: 0xBFD7F5, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false });
  { const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 34, 24), tubeM); tube.position.y = -5; rfG.add(tube);
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 26, 16), M.std(0x1b3fd0, { roughness: 0.35 })); ink.position.y = -1; rfG.add(ink);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 0.55, 3.2, 20), M.metal(0xc9d0d8, 0.22, {})); cone.position.y = -23.6; rfG.add(cone);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 12), M.metal(0xeef2f7, 0.15, {})); ball.position.y = -25.3; rfG.add(ball);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 1.3, 32), M.metal(0x7d8896, 0.3, {})); collar.position.y = 8.65; collar.castShadow = true; rfG.add(collar); }
  const helix = (() => { const pts = []; const N = 90, turns = 6; for (let i = 0; i <= N; i++) { const a = i / N * turns * Math.PI * 2; pts.push(v3(3.3 * Math.cos(a), i / N, 3.3 * Math.sin(a))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.3, 8, false); })();
  const springM = M.metal(0xB4BCC8, 0.3, {});
  const spring = new THREE.Mesh(helix, springM); spring.castShadow = true; penG.add(spring);
  const SY0 = YN + 1.2, COL0 = 8;                         // spring seat top, collar rest height
  scene.updateMatrixWorld(true);

  // ---------------- one click cycle (period CP = 5 s); the cam turns 60 deg per cycle, so 2 cycles = the loop ----------------
  const CC = tc => tc < 0.25 ? 0 : tc < 0.65 ? 13 * E.io((tc - 0.25) / 0.4) : tc < 1.15 ? lerp(13, 10, E.io((tc - 0.65) / 0.5)) : tc < 3.0 ? 10 : tc < 3.4 ? lerp(10, 13, E.io((tc - 3.0) / 0.4)) : tc < 4.1 ? lerp(13, 0, E.io((tc - 3.4) / 0.7)) : 0;
  const AA = tc => tc < 0.4 ? 0 : tc < 0.65 ? 30 * E.io((tc - 0.4) / 0.25) : tc < 3.15 ? 30 : tc < 3.4 ? 30 + 30 * E.io((tc - 3.15) / 0.25) : 60;
  let latchGlow = 0;
  function penSet(t) {
    const ci = Math.floor(t / CP), tc = t - ci * CP, c = CC(tc), ang = (ci * 60 + AA(tc)) * Math.PI / 180;
    plG.position.y = -c; camG.position.y = -c; camG.rotation.y = ang; rfG.position.y = -c;
    const L = (COL0 - c) - SY0; spring.position.y = SY0; spring.scale.y = L;
    latchGlow = clamp((tc - 0.9) / 0.25) * (1 - clamp((tc - 3.0) / 0.2));
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    stopM.emissiveIntensity = 0.05 + latchGlow * (0.7 + 0.4 * pulse); stopM.opacity = 0.55 + 0.3 * latchGlow;
  }
  // ---------------- camera: wide -> close on the ratchet -> wide (period P) ----------------
  const wAt = t => t < 5.3 ? 0 : t < 6.2 ? E.io((t - 5.3) / 0.9) : t < 8.9 ? 1 : t < 9.9 ? 1 - E.io((t - 8.9) / 1.0) : 0;
  function cam(pos, subj, fov = 36, low = 0.1) {
    camera.position.copy(pos); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = pos.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));
  const TW = 2 * Math.PI / P;
  function stateAt(t) {
    penSet(t); PN.visible = true;
    const w = wAt(t);
    const cy = lerp(22, 22.5, w), r = lerp(172, 62, w);
    const c = v3(0, cy + 760, 0);
    cam(orbit(c, r, 0.32 * Math.sin(t * TW), 0.08 + 0.05 * Math.sin(t * TW + 1.0)), c, 36, 0.05);
    rig(c, lerp(62, 26, w), 2.0); expo = 0.8;
    ctx.renderer.toneMappingExposure = expo * 1.22;
    spotG.visible = false; spotB.visible = false;
    scene.updateMatrixWorld(true);
  }
  const shots = [[0, 2.5], [2.5, 5], [5, 7.5], [7.5, 10]];
  const ev = [];
  for (let ci = 0; ci < 2; ci++) { const o = ci * CP; ev.push({ t: o + 0.42, n: 'pen_click' }, { t: o + 0.5, n: 'ui_tick' }, { t: o + 0.78, n: 'plastic_click' }, { t: o + 3.15, n: 'pen_click' }, { t: o + 3.22, n: 'ui_tick' }, { t: o + 3.45, n: 'metal_tink' }, { t: o + 3.62, n: 'whoosh_soft' }); }
  const sfx = ev.filter(x => x.t < END - 0.05);
  function seek(t, g, opts = {}) {
    const plate_ = opts.plate !== false;
    stateAt(t);
    lens.uniforms.uSeed.value = (t < 1 / 30) ? 0 : Math.floor(t * 30) % 1000;
    if (plate_) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
  }
  return { seek, END, sfx, lines: [], shots, caps: [], lockTicks: () => [] };
}
