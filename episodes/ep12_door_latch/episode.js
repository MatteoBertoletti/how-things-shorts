// EP. 12 — door latch, 10 s silent loop. Full-frame wooden door with a lever handle -> x-ray -> lever turns the spindle,
// a cam arm pulls the latch bolt back against its spring, lever returns and the bolt snaps out. 4 identical cycles of 2.5 s (4 beats at 96 BPM).
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M } from '../../js/parts.js';
import { setAccent } from '../../js/overlay.js';

export const EP = 'EP. 12';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB52E');
  ctx.bloom.threshold = 0.75; ctx.bloom.strength = 0.3; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.95;
  const P = 10, END = P, CP = 2.5, BEAT = 0.625;
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
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); bg.position.set(0, 0, -60); PN.add(bg);
  }
  const L = new THREE.Group(); PN.add(L);
  const shellMats = []; const sh = m => { m.transparent = true; shellMats.push(m); return m; };
  const steel = M.metal(0xC9D0D8, 0.22, {}), brass = M.metal(0xE0AE48, 0.26, {}), dark = M.metal(0x6b7686, 0.35, {});
  const chrome = sh(M.metal(0xDDE3EA, 0.14, {}));
  // wood texture
  const woodTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = '#a8713f'; g.fillRect(0, 0, 256, 512);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 160; i++) { const x = rnd() * 256, w = 0.5 + rnd() * 2.2, a = 0.05 + rnd() * 0.18; g.strokeStyle = (rnd() > 0.5 ? 'rgba(92,56,26,' : 'rgba(206,150,92,') + a + ')'; g.lineWidth = w; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 512; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * 3, y); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const doorM = sh(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.6 }));
  const paintM = sh(new THREE.MeshStandardMaterial({ color: 0xE3DED2, roughness: 0.5, envMapIntensity: 0.5 }));
  const door = new THREE.Mesh(new THREE.BoxGeometry(60, 120, 20), doorM); door.position.set(30, 0, 0); L.add(door);
  const jamb = new THREE.Mesh(new THREE.BoxGeometry(24, 120, 20), paintM); jamb.position.set(-14, 0, 0); L.add(jamb);
  const strike = new THREE.Mesh(new THREE.BoxGeometry(0.8, 26, 8), chrome); strike.position.set(-2.4, 0, 0); L.add(strike);
  const lineM = new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0 });
  [door, jamb].forEach(m => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), lineM); e.position.copy(m.position); L.add(e); });
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 9, 32), new THREE.MeshStandardMaterial({ color: 0x07090f, roughness: 0.9 })); hole.rotation.z = Math.PI / 2; hole.position.set(-6.4, 0, 0); L.add(hole);
  // latch case (always visible glass) + faceplate
  const caseM = new THREE.Mesh(new THREE.BoxGeometry(44, 26, 12), new THREE.MeshStandardMaterial({ color: 0x8fb6e8, roughness: 0.15, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 0.4 })); caseM.position.set(22, 0, 0); L.add(caseM);
  const caseE = new THREE.LineSegments(new THREE.EdgesGeometry(caseM.geometry), new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.55 })); caseE.position.copy(caseM.position); L.add(caseE);
  const face = new THREE.Mesh(new THREE.BoxGeometry(1.2, 30, 11), steel); face.position.set(0.6, 0, 0); L.add(face);
  // bolt, rod, seat, spring
  const boltG = new THREE.Group(); L.add(boltG);
  const head = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [3.4, 0], [3.4, 9.5], [1.8, 14], [0, 14]].map(p => new THREE.Vector2(p[0], p[1])), 40), M.metal(0xE9C46A, 0.2, {})); head.rotation.z = Math.PI / 2; head.castShadow = true; boltG.add(head);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 12.5, 20), steel); rod.rotation.z = Math.PI / 2; rod.position.x = 6.25 + 0; boltG.add(rod);   // from back of head (x=0 local) to plate
  const plateG = new THREE.Group(); L.add(plateG);
  { const mk = (x0, x1, y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 3), brass); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); m.castShadow = true; plateG.add(m); };
    mk(20.5, 22.5, -11, 5); mk(33.5, 35.5, -11, 5); mk(20.5, 35.5, 3, 5); }
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.0, 36), dark); seat.rotation.z = Math.PI / 2; seat.position.set(15.5, 0, 0); L.add(seat);
  const helix = (() => { const pts = []; const N = 90, turns = 7; for (let i = 0; i <= N; i++) { const a = i / N * turns * Math.PI * 2; pts.push(v3(2.9 * Math.cos(a), i / N, 2.9 * Math.sin(a))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.32, 8, false); })();
  const spring = new THREE.Mesh(helix, M.metal(0xC4CCD8, 0.25, {})); spring.rotation.z = -Math.PI / 2; spring.castShadow = true; L.add(spring);
  // spindle + cam arm + lever + rose
  const spG = new THREE.Group(); spG.position.set(30, 0, 0); L.add(spG);
  { const sp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 26), steel); sp.castShadow = true; spG.add(sp);
    const lobeG = new THREE.BoxGeometry(2.4, 12, 3); lobeG.translate(0, -6, 0); const lobe = new THREE.Mesh(lobeG, brass); lobe.castShadow = true; spG.add(lobe);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3, 16), brass); tip.rotation.x = Math.PI / 2; tip.position.y = -12; spG.add(tip);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3, 28), chrome); hub.rotation.x = Math.PI / 2; hub.position.z = 12.5; spG.add(hub);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 4.2, 3.4), chrome); arm.position.set(-13, 0, 12.5); arm.castShadow = true; spG.add(arm);
    const grip = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), chrome); grip.scale.set(1, 0.85, 0.8); grip.position.set(-26, 0, 12.5); spG.add(grip); }
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 1.6, 40), chrome); rose.rotation.x = Math.PI / 2; rose.position.set(30, 0, 10.8); L.add(rose);
  scene.updateMatrixWorld(true);

  // ---------------- one latch cycle (CP = 2.5 s = 4 beats) ----------------
  const THM = 48 * Math.PI / 180;
  const TH = tc => tc < 0.08 ? 0 : tc < BEAT ? THM * E.io((tc - 0.08) / (BEAT - 0.08)) : tc < 2 * BEAT + 0.05 ? THM : tc < 3 * BEAT ? THM * (1 - E.io((tc - 2 * BEAT - 0.05) / (3 * BEAT - 2 * BEAT - 0.05))) : 0;
  const xrAt = t => t < 1.0 ? 0 : t < 1.9 ? E.io((t - 1.0) / 0.9) : t < 8.4 ? 1 : t < 9.4 ? 1 - E.io((t - 8.4) / 1.0) : 0;
  function latchSet(t) {
    const ci = Math.floor(t / CP), tc = t - ci * CP, th = TH(tc);
    spG.rotation.z = th;
    const d = Math.max(0, 12 * Math.sin(th) - 3.5);
    boltG.position.set(8 + d, 0, 0); plateG.position.x = d;
    spring.position.set(8 + d, 0, 0); spring.scale.y = Math.max(0.2, 7.5 - d);
    const xr = xrAt(t), op = lerp(1, 0.07, xr);
    shellMats.forEach(m => { m.opacity = op; m.depthWrite = op > 0.9; });
    chrome.opacity = lerp(1, 0.3, xr); chrome.depthWrite = chrome.opacity > 0.9;
    lineM.opacity = 0.75 * xr; hole.visible = xr > 0.02;
  }
  // ---------------- camera ----------------
  const KF = [[0, v3(17, 0, 180)], [1.2, v3(17, 0, 180)], [2.5, v3(30, -3, 75)], [4.0, v3(30, -3, 75)], [5.0, v3(8, 0, 75)], [6.8, v3(8, 0, 75)], [8.8, v3(17, 0, 180)], [10, v3(17, 0, 180)]];
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
    latchSet(t);
    const k = camAt(t), c = v3(k.x, k.y + 760, 0), wide = clamp((k.z - 75) / 105);
    cam(orbit(c, k.z, lerp(0.3, 0.12, wide) * Math.sin(t * TW), lerp(0.14, 0.06, wide) + 0.03 * Math.sin(t * TW + 1.0)), c, 36, 0.02);
    rig(c, lerp(30, 80, wide), 2.1);
    ctx.renderer.toneMappingExposure = 0.8 * lerp(1.0, 0.92, wide);
    scene.updateMatrixWorld(true);
  }
  const shots = [[0, 2.5], [2.5, 5], [5, 7.5], [7.5, 10]];
  const ev = [];
  for (let c = 0; c < 4; c++) { const o = c * CP; ev.push({ t: o + BEAT, n: 'metal_tink' }, { t: o + BEAT - 0.02, n: 'ui_tick' }, { t: o + 3 * BEAT, n: 'metal_click' }, { t: o + 3 * BEAT + 0.01, n: 'plastic_click' }, { t: o + 0.1, n: 'whoosh_soft' }); }
  const sfx = ev.filter(x => x.t < END - 0.05);
  function seek(t, g, opts = {}) {
    const plate_ = opts.plate !== false;
    stateAt(t);
    lens.uniforms.uSeed.value = (t < 1 / 30) ? 0 : Math.floor(t * 30) % 1000;
    if (plate_) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
  }
  return { seek, END, sfx, lines: [], shots, caps: [], lockTicks: () => [] };
}
