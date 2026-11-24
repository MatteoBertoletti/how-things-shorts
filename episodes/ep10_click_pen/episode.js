// EP. 10 (v2) — click pen, 10 s silent loop (music only). Glossy pen -> x-ray -> ratchet close-up -> glossy pen again.
// Two identical click cycles in 10 s on an 8-beat grid (96 BPM, 0.625 s/beat): press lands on beat 1 and beat 5 of each cycle.
// The cam turns 60 deg per cycle, so the picture repeats every 2 cycles = the loop (6-fold symmetry: 120 deg = 0 deg).
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M } from '../../js/parts.js';
import { setAccent } from '../../js/overlay.js';

export const EP = 'EP. 10';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB52E');
  ctx.bloom.threshold = 0.72; ctx.bloom.strength = 0.34; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.95;
  const P = 10, END = P, CP = 5;
  // lights (same rig as the padlock loop)
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

  // ---- backdrop: soft radial glow, no shadows ----
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 10, 256, 256, 256); gr.addColorStop(0, '#30426a'); gr.addColorStop(0.45, '#1a2640'); gr.addColorStop(1, '#0a0e17');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); bg.position.set(0, 20, -60); PN.add(bg);
  }

  const penG = new THREE.Group(); PN.add(penG);
  const RB = 9.2, YT = 46, YN = -8, YTIP = -21;
  const shellMats = [];
  const sh = m => { m.transparent = true; shellMats.push(m); return m; };
  // outer shell: pearl barrel, chrome nose / rim / clip -> fade to x-ray
  const pearl = sh(new THREE.MeshPhysicalMaterial({ color: 0xA8B4CA, roughness: 0.3, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.18, envMapIntensity: 0.8 }));
  const chrome = sh(M.metal(0xD5DBE4, 0.16, {}));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry([[RB, YT], [RB, YN]].map(p => new THREE.Vector2(p[0], p[1])), 72), pearl); pearl.side = THREE.DoubleSide; penG.add(barrel);
  const nose = new THREE.Mesh(new THREE.LatheGeometry([[RB, YN], [RB - 0.2, YN - 0.6], [2.6, YTIP + 1.2], [1.5, YTIP]].map(p => new THREE.Vector2(p[0], p[1])), 72), chrome); chrome.side = THREE.DoubleSide; penG.add(nose);
  const topRing = new THREE.Mesh(new THREE.RingGeometry(4.9, RB, 72), pearl); topRing.rotation.x = -Math.PI / 2; topRing.position.y = YT; penG.add(topRing);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(RB, 0.5, 12, 72), chrome); rimT.rotation.x = Math.PI / 2; rimT.position.y = YT; penG.add(rimT);
  const lipT = new THREE.Mesh(new THREE.TorusGeometry(4.95, 0.4, 10, 48), chrome); lipT.rotation.x = Math.PI / 2; lipT.position.y = YT; penG.add(lipT);
  const bandT = new THREE.Mesh(new THREE.TorusGeometry(RB + 0.05, 0.45, 10, 72), chrome); bandT.rotation.x = Math.PI / 2; bandT.position.y = YN + 0.2; penG.add(bandT);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 34, 2.8), chrome); clip.position.set(RB + 0.6, YT - 18, 0); penG.add(clip);
  const clipHd = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), chrome); clipHd.position.set(RB + 0.6, YT - 35, 0); penG.add(clipHd);
  // x-ray outline lines
  const lineM = new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0 });
  const seg = (a, b, r = 0.16) => { const d = b.clone().sub(a), L = d.length(); const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), lineM); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize()); penG.add(o); return o; };
  [-1, 1].forEach(sg => { seg(v3(sg * RB, YN, 0), v3(sg * RB, YT, 0)); seg(v3(sg * RB, YN, 0), v3(sg * 1.5, YTIP, 0)); });
  // spring seat inside the nose
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(RB - 0.4, 4.4, 1.2, 48), M.metal(0x7d8896, 0.3, {})); seat.position.y = YN + 0.6; penG.add(seat);

  // ---- fixed stop ribs on the barrel wall: thin plates with a wedge tip at y = 20.5 ----
  const TIP = 20.5;
  const stopM = new THREE.MeshStandardMaterial({ color: 0xC9D2DE, roughness: 0.3, metalness: 0.7, emissive: 0xFF6A2A, emissiveIntensity: 0, transparent: true, opacity: 0.8, depthWrite: false, envMapIntensity: 1.1 });
  const rs = new THREE.Shape(); rs.moveTo(-0.8, 2.2); rs.lineTo(0, 0); rs.lineTo(0.8, 2.2); rs.lineTo(0.8, 19); rs.lineTo(-0.8, 19); rs.closePath();
  const ribGeo = new THREE.ExtrudeGeometry(rs, { depth: 2.4, bevelEnabled: false }); ribGeo.translate(0, 0, 0);
  for (let k = 0; k < 6; k++) { const a = (30 + 60 * k) * Math.PI / 180; const g = new THREE.Group(); g.rotation.y = a + Math.PI / 2; g.position.y = TIP; const o = new THREE.Mesh(ribGeo, stopM); o.position.z = 4.9; g.add(o); penG.add(g); }

  // ---- plunger (button + stem), blue lacquer ----
  const plG = new THREE.Group(); penG.add(plG);
  const blue = new THREE.MeshPhysicalMaterial({ color: 0x2F6BFF, roughness: 0.22, metalness: 0.15, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.2 });
  { const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 7, 48), blue); cap.position.y = 56; cap.castShadow = true; plG.add(cap);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), blue); dome.position.y = 59.5; plG.add(dome);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 25, 32), blue); stem.position.y = 40.5; stem.castShadow = true; plG.add(stem); }

  // ---- ratchet cam (brass): body, 3 lugs, marker stripe ----
  const camG = new THREE.Group(); penG.add(camG);
  const brass = M.metal(0xE0AE48, 0.24, {});
  const polar = (o, r, a) => { o.position.x = r * Math.cos(a); o.position.z = -r * Math.sin(a); o.rotation.y = a; };
  { const body = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 17, 48), brass); body.position.y = 20.5; body.castShadow = true; camG.add(body);
    for (let k = 0; k < 3; k++) { const o = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.9, 2.1), brass); o.position.y = 28.05; polar(o, 4.0, k * 2 * Math.PI / 3); o.castShadow = true; camG.add(o); }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 0.7), new THREE.MeshBasicMaterial({ color: 0xFFB52E })); stripe.position.y = 20.5; polar(stripe, 3.15, Math.PI / 6); camG.add(stripe);
    const topC = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.1, 1.0, 48), brass); topC.position.y = 29.3; camG.add(topC); }

  // ---- refill: tube, ink, tip, collar; return spring ----
  const rfG = new THREE.Group(); penG.add(rfG);
  const tubeM = new THREE.MeshStandardMaterial({ color: 0xBFD7F5, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.5, depthWrite: false });
  { const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 28, 24), tubeM); tube.position.y = -2; rfG.add(tube);
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 20, 16), M.std(0x1b3fd0, { roughness: 0.35 })); ink.position.y = 1; rfG.add(ink);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.6, 3.2, 20), M.metal(0xc9d0d8, 0.2, {})); cone.position.y = -17.6; rfG.add(cone);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), M.metal(0xf0f4f8, 0.12, {})); ball.position.y = -19.3; rfG.add(ball);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 1.3, 32), M.metal(0x9aa5b4, 0.25, {})); collar.position.y = 8.65; collar.castShadow = true; rfG.add(collar); }
  const helix = (() => { const pts = []; const N = 90, turns = 6; for (let i = 0; i <= N; i++) { const a = i / N * turns * Math.PI * 2; pts.push(v3(3.6 * Math.cos(a), i / N, 3.6 * Math.sin(a))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.32, 8, false); })();
  const spring = new THREE.Mesh(helix, M.metal(0xC4CCD8, 0.25, {})); spring.castShadow = true; penG.add(spring);
  const SY0 = YN + 1.2, COL0 = 8;

  // ---- contact glow where the lugs rest on the rib tips ----
  const glowM = new THREE.MeshBasicMaterial({ color: 0xFF7A3D, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glows = [30, 150, 270].map(d => { const a = d * Math.PI / 180; const m = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), glowM); m.position.set(4.9 * Math.cos(a), TIP - 0.3, -4.9 * Math.sin(a)); penG.add(m); return m; });
  scene.updateMatrixWorld(true);

  // ---------------- one click cycle (CP = 5 s = 8 beats) ----------------
  const BEAT = 0.625, TR = 11, LATCH = 8.5;
  const CC = tc => tc < 0.12 ? 0 : tc < BEAT ? TR * E.io((tc - 0.12) / (BEAT - 0.12)) : tc < 2 * BEAT ? lerp(TR, LATCH, E.io((tc - BEAT) / BEAT)) : tc < 4 * BEAT + 0.25 ? LATCH : tc < 5 * BEAT ? lerp(LATCH, TR, E.io((tc - 4 * BEAT - 0.25) / (BEAT - 0.25))) : tc < 5 * BEAT + 1.0 ? lerp(TR, 0, E.io((tc - 5 * BEAT) / 1.0)) : 0;
  const AA = tc => tc < 0.38 ? 0 : tc < BEAT ? 30 * E.io((tc - 0.38) / (BEAT - 0.38)) : tc < 2.95 ? 30 : tc < 5 * BEAT ? 30 + 30 * E.io((tc - 2.95) / (5 * BEAT - 2.95)) : 60;
  // x-ray amount: 0 (glossy pen) -> 1 -> 0
  const xrAt = t => t < 0.9 ? 0 : t < 1.8 ? E.io((t - 0.9) / 0.9) : t < 8.6 ? 1 : t < 9.6 ? 1 - E.io((t - 8.6) / 1.0) : 0;
  function penSet(t) {
    const ci = Math.floor(t / CP), tc = t - ci * CP, c = CC(tc), ang = (ci * 60 + AA(tc)) * Math.PI / 180;
    plG.position.y = -c; camG.position.y = -c; camG.rotation.y = ang; rfG.position.y = -c;
    const L = (COL0 - c) - SY0; spring.position.y = SY0; spring.scale.y = L;
    const latchGlow = clamp((tc - 1.15) / 0.2) * (1 - clamp((tc - 4 * BEAT) / 0.25));
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    stopM.emissiveIntensity = latchGlow * (0.18 + 0.12 * pulse); glowM.opacity = latchGlow * (0.4 + 0.3 * pulse);
    const xr = xrAt(t), op = lerp(1, 0.07, xr);
    shellMats.forEach(m => { m.opacity = op; m.depthWrite = op > 0.9; }); pearl.envMapIntensity = lerp(0.8, 0, xr); pearl.clearcoat = 0.7 * (1 - xr); chrome.envMapIntensity = lerp(1.2, 0.1, xr);
    lineM.opacity = 0.8 * xr; clip.visible = clipHd.visible = xr < 0.5;
  }
  // ---------------- camera: whole pen -> ratchet close-up -> whole pen (period P) ----------------
  const wAt = t => t < 1.0 ? 0 : t < 2.4 ? E.io((t - 1.0) / 1.4) : t < 8.2 ? 1 : t < 9.6 ? 1 - E.io((t - 8.2) / 1.4) : 0;
  function cam(pos, subj, fov = 36, low = 0.1) {
    camera.position.copy(pos); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = pos.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));
  const TW = 2 * Math.PI / P;
  function stateAt(t) {
    penSet(t);
    const w = wAt(t);
    const cy = lerp(16, 25, w), r = lerp(168, 64 + 4 * Math.sin(t * TW + 0.6), w);
    const c = v3(0, cy + 760, 0);
    cam(orbit(c, r, lerp(0.22, 0.42, w) * Math.sin(t * TW), lerp(0.06, 0.2, w) + 0.04 * Math.sin(t * TW + 1.0)), c, 36, 0.02);
    rig(c, lerp(70, 26, w), 2.1);
    ctx.renderer.toneMappingExposure = 0.8 * lerp(1.45, 1.05, w);
    scene.updateMatrixWorld(true);
  }
  const shots = [[0, 2.5], [2.5, 5], [5, 7.5], [7.5, 10]];
  const ev = [];
  for (let ci = 0; ci < 2; ci++) { const o = ci * CP; ev.push({ t: o + BEAT, n: 'pen_click' }, { t: o + BEAT + 0.01, n: 'ui_tick' }, { t: o + 2 * BEAT, n: 'plastic_click' }, { t: o + 5 * BEAT, n: 'pen_click' }, { t: o + 5 * BEAT + 0.01, n: 'ui_tick' }, { t: o + 6 * BEAT, n: 'metal_tink' }, { t: o + 5 * BEAT + 0.25, n: 'whoosh_soft' }); }
  const sfx = ev.filter(x => x.t < END - 0.05);
  function seek(t, g, opts = {}) {
    const plate_ = opts.plate !== false;
    stateAt(t);
    lens.uniforms.uSeed.value = (t < 1 / 30) ? 0 : Math.floor(t * 30) % 1000;
    if (plate_) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
  }
  return { seek, END, sfx, lines: [], shots, caps: [], lockTicks: () => [] };
}
