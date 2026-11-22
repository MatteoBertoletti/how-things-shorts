// EP. 07 — the rubber band. Experiment E2 (structure A again, another object): rubber is pressed out as a tube, the tube is
// baked on a rod, then sliced into rings (the bands). The answer (one tube, hundreds of bands; no seam, it snaps back) comes
// only in the last third. No jargon before the answer, no numbers before it. Frame 0 already in motion (the tube coming out of
// the die); the loop frames replay it.
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M, pedestal, gummyBear, tray } from '../../js/parts.js';
import { crayon } from '../../js/pen.js';
import { setAccent, titleRawReal, kcap, blurred, setParallax, endCard2 } from '../../js/overlay.js';

export const EP = 'EP. 07';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB52E');
  ctx.bloom.threshold = 0.7; ctx.bloom.strength = 0.36; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.85;

  // ---------------- timing ----------------
  const lines = timing.lines, Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  const Wd = (i, w, n = 0) => { const L = lines[i - 1]; const hits = L.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return L.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const LOOP = 0.9;
  const tEC = +Math.max(Ls(9) - 0.05, Le(9) - 2.5 + 0.04).toFixed(3);
  const END = +(Le(9) + 0.04 + LOOP).toFixed(3);
  const tSnap = 1.2;

  // ---------------- lights ----------------
  const key = new THREE.DirectionalLight(0xFFC27A, 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.5, 1, 0.9).normalize();
  const fill = new THREE.DirectionalLight(0x7FB0FF, 1.2); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xD6E4FF, 1.0); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0x7FB0FF, 0x231c16, 0.5));
  const spotG = new THREE.SpotLight(0x2BD67B, 0, 0, 0.42, 0.6, 0), spotB = new THREE.SpotLight(0xFF7A3D, 0, 0, 0.42, 0.6, 0); scene.add(spotG, spotG.target, spotB, spotB.target);
  let expo = 1.1;
  function rig(tgt, size, k = 2.2) {
    key.intensity = k; key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.85, 0.45, 0.4).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.2, 0.6, -1).multiplyScalar(size * 3));
  }

  // ---------------- helpers ----------------
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const L = (grp, x, y, z) => v3(x, y, z).applyMatrix4(grp.matrixWorld);
  const station = (x, y = 760) => { const g = new THREE.Group(); g.position.set(x, y, 0); scene.add(g); return g; };
  const box = (sx, sy, sz, x, y, z, m, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const steelDark = () => M.metal(0x4b5563, 0.34, { envMapIntensity: 1.1 });
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

  // rubber: matte amber with fine speckle; faint bands so a moving tube reads
  const rubberTex = (bands) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#b8681c'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5000; i++) { const v = hash(i * 1.3); g.fillStyle = v > 0.5 ? `rgba(255,190,110,${0.06 + v * 0.1})` : `rgba(70,30,5,${0.1 + v * 0.18})`; g.fillRect(hash(i * 3.7) * 512, hash(i * 5.9) * 512, 1 + hash(i * 7.3) * 3, 1 + hash(i * 9.1) * 3); }
    if (bands) { g.fillStyle = 'rgba(255,200,120,0.28)'; for (let y = 0; y < 512; y += 128) g.fillRect(0, y, 512, 12); g.fillStyle = 'rgba(60,25,3,0.3)'; for (let y = 64; y < 512; y += 128) g.fillRect(0, y, 512, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  };
  const rubberMat = (tex, o = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.6, metalness: 0, emissive: 0xFF5A1F, emissiveIntensity: 0, ...o });

  // a flat band (rectangular section) following a stadium path around two pegs; d = distance between the pegs, d = 0 is a ring
  function fillRibbon(geo, R, d, Wb, Th, N, uRep) {
    const P = 2 * d + 2 * Math.PI * R;
    const samp = (s) => {
      let q = s;
      if (q < d) return [-d / 2 + q, R, 0, 1]; q -= d;
      if (q < Math.PI * R) { const a = Math.PI / 2 - q / R; return [d / 2 + R * Math.cos(a), R * Math.sin(a), Math.cos(a), Math.sin(a)]; } q -= Math.PI * R;
      if (q < d) return [d / 2 - q, -R, 0, -1]; q -= d;
      const a = -Math.PI / 2 - q / R; return [-d / 2 + R * Math.cos(a), R * Math.sin(a), Math.cos(a), Math.sin(a)];
    };
    const pos = [], nor = [], uv = [], idx = []; const h = Th / 2, hw = Wb / 2;
    const side = (fn, flip) => { const base = pos.length / 3;
      for (let i = 0; i <= N; i++) { const s = (i / N) * P, [x, y, nx, ny] = samp(s); const [a, b, nn] = fn(x, y, nx, ny); pos.push(...a, ...b); nor.push(...nn, ...nn); uv.push(i / N * uRep, 0, i / N * uRep, 1); }
      for (let i = 0; i < N; i++) { const a0 = base + 2 * i, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3; if (flip) idx.push(a0, b0, a1, b0, b1, a1); else idx.push(a0, a1, b0, b0, a1, b1); } };
    side((x, y, nx, ny) => [[x + nx * h, y + ny * h, -hw], [x + nx * h, y + ny * h, hw], [nx, ny, 0]], true);      // outer
    side((x, y, nx, ny) => [[x - nx * h, y - ny * h, -hw], [x - nx * h, y - ny * h, hw], [-nx, -ny, 0]], false);   // inner
    side((x, y, nx, ny) => [[x - nx * h, y - ny * h, hw], [x + nx * h, y + ny * h, hw], [0, 0, 1]], false);        // +z
    side((x, y, nx, ny) => [[x - nx * h, y - ny * h, -hw], [x + nx * h, y + ny * h, -hw], [0, 0, -1]], true);      // -z
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    geo.computeBoundingSphere(); return geo;
  }

  // dimensions (mm): a real tube about 29 mm across, band 5 mm wide
  const RM = 13.5, TH = 2.0, BW = 5.0;            // ring mid radius, wall, band width
  const spokeTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#9aa5b4'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill(); g.strokeStyle = '#4a5463'; g.lineWidth = 9; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(128 + Math.cos(a) * 36, 128 + Math.sin(a) * 36); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke(); } g.fillStyle = '#d9dee6'; g.beginPath(); g.arc(128, 128, 30, 0, 7); g.fill(); g.strokeStyle = '#2e3641'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const backPanel = (parent, w = 240, h = 340, y = 60) => box(w, h, 3, 0, y, -26, M.std(0x1b2330, { roughness: 0.6, metalness: 0.4 }), parent);

  // ================= EXT: raw rubber -> press -> a tube comes out of the die =================
  const EXT = station(0); backPanel(EXT, 260, 380, 20);
  const DIE_Y = 56, VW = 62;
  box(84, 50, 50, 0, 84, 0, steelDark(), EXT);
  box(86, 6, 52, 0, 70, 0.2, M.std(0xFFB52E, { roughness: 0.5, metalness: 0.2 }), EXT);                 // amber stripe
  { const dieM = M.metal(0x8b95a3, 0.3, {}); const die = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 9, 48), dieM); die.position.set(0, DIE_Y + 3, 0); die.castShadow = true; EXT.add(die);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(15.3, 1.4, 12, 64), M.metal(0xd5dbe3, 0.22, {})); ring.rotation.x = Math.PI / 2; ring.position.y = DIE_Y - 1.5; EXT.add(ring); }
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(36, 15, 40, 40, 1, true), M.metal(0x6b7686, 0.35, { side: THREE.DoubleSide })); hop.position.set(0, 129, 0); hop.castShadow = true; EXT.add(hop);
  const lumpM = M.std(0x8a5a2b, { roughness: 0.85 }); const lumps = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + hash(i * 2.3) * 4, 1), lumpM); m.castShadow = true; EXT.add(m); lumps.push(m); }
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 5, 40), [M.metal(0x6b7686, 0.3, {}), M.metal(0xb8c0cc, 0.3, { map: spokeTex }), M.metal(0xb8c0cc, 0.3, { map: spokeTex })]); wheel.rotation.x = Math.PI / 2; wheel.position.set(-20, 82, 27.5); wheel.castShadow = true; EXT.add(wheel);
  const tubeTex = rubberTex(true); tubeTex.repeat.set(3, 16);
  const tubeM = rubberMat(tubeTex);
  const tubeO = new THREE.Mesh(new THREE.CylinderGeometry(RM + TH / 2, RM + TH / 2, 520, 56, 1, true), tubeM); tubeO.position.y = DIE_Y - 260; tubeO.castShadow = tubeO.receiveShadow = true; EXT.add(tubeO);
  function extSet(t) {
    tubeTex.offset.y = VW * t / (520 / 16); wheel.rotation.y = t * 2.2;
    lumps.forEach((m, i) => { const per = 1.5 + hash(i * 3.1) * 0.5, ph = (t / per + hash(i * 5.7)) % 1; const a = hash(i * 9.9) * 6.28, r = (1 - ph) * 24 * hash(i * 1.9); m.position.set(Math.cos(a) * r, lerp(172, 118, E.i(ph)) , Math.sin(a) * r); m.rotation.set(t * 1.5 + i, t * 1.1, i); m.visible = ph < 0.96; });
  }

  // ================= ROD: the tube slides onto a rod, is baked, and a blade slices it into rings =================
  const ROD = station(1500); backPanel(ROD, 260, 420, 40);
  const rodParts = new THREE.Group(); ROD.add(rodParts);
  { const alu = M.metal(0x8d96a2, 0.3, {}); const rod = new THREE.Mesh(new THREE.CylinderGeometry(11.4, 11.4, 190, 40), alu); rod.position.y = 75; rod.castShadow = rod.receiveShadow = true; rodParts.add(rod);
    box(40, 14, 30, 0, 182, 0, steelDark(), rodParts); box(14, 40, 14, 0, 208, 0, steelDark(), rodParts); }
  const blade = new THREE.Group(); rodParts.add(blade);
  { const sm = M.metal(0xe3e8ee, 0.2, {}); const d = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 0.9, 72), [sm, M.metal(0xe3e8ee, 0.2, { map: spokeTex }), M.metal(0xe3e8ee, 0.2, { map: spokeTex })]); d.castShadow = true; blade.add(d);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3.4, 28), steelDark()); blade.add(hub); box(86, 5, 5, 42, 3.8, 0, steelDark(), blade); blade.userData.d = d; }
  const oven = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 132, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xFF6A2B, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); oven.position.y = 57; rodParts.add(oven);
  const TRAY_Y = -74; const trayG = tray(130, 130, 9, 3, M.std(0x2b3646, { roughness: 0.42, metalness: 0.6 })); trayG.position.y = TRAY_Y; ROD.add(trayG);
  const TRAY_TOP = TRAY_Y + 3;
  // rings: one pool; the first NS sit on the rod as the tube, all of them end up in the heap
  const NS = 24, NR = 100;
  const stackTex = rubberTex(false); { const cv = stackTex.image, g = cv.getContext('2d'); g.fillStyle = 'rgba(255,225,160,0.45)'; g.fillRect(0, 0, 26, 512); g.fillStyle = 'rgba(60,25,3,0.4)'; g.fillRect(170, 0, 12, 512); stackTex.needsUpdate = true; } stackTex.repeat.set(1, 1);
  const stackM = rubberMat(stackTex);
  const ringGeo = fillRibbon(new THREE.BufferGeometry(), RM, 0, BW, TH, 72, 3);
  const rings = []; for (let j = 0; j < NR; j++) { const g = new THREE.Group(); const m = new THREE.Mesh(ringGeo, stackM); m.rotation.x = Math.PI / 2; m.castShadow = m.receiveShadow = true; g.add(m); ROD.add(g); rings.push(g); }
  const slots = []; { let layer = 0, k = 0, cap = 8; for (let j = 0; j < NR; j++) { if (k >= cap) { k = 0; layer++; cap = Math.max(2, Math.round(8 * (1 - layer / 16))); }
    const a = k / cap * Math.PI * 2 + layer * 0.9 + hash(j * 3.3) * 0.4, r = (cap > 2 ? 22 * (1 - layer / 18) : 0) * (0.75 + 0.5 * hash(j * 7.1));
    slots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: TRAY_TOP + 1.3 + layer * 2.5, rx: (hash(j * 5.7) - 0.5) * 0.5, rz: (hash(j * 9.3) - 0.5) * 0.5, ry: hash(j * 2.9) * 6.28 }); k++; } }
  // timeline
  const tS0 = Ls(3) - 0.05, tSlideEnd = tS0 + 1.0;
  const tcs = [Wd(4, 'slice') + 0.12, Wd(5, 'slice') + 0.12]; { let tt = Ls(6) + 0.1; for (let i = 0; i < 11; i++) { tcs.push(tt); tt += 0.26; } }
  const NCUT = tcs.length, tLastCut = tcs[NCUT - 1];
  const tAns = Ls(7) - 0.05;
  const tB0 = tSlideEnd + 0.1, tB1 = Math.max(tB0 + 0.8, tcs[0] - 0.55);
  const feedAmt = (t, upTo) => { let s = 0; for (let k = 0; k < upTo; k++) s += E.io(clamp((t - tcs[k] - 0.04) / 0.18)); return s; };
  const spinA = t => Math.max(0, t - tSlideEnd + 0.2) * 4.0;
  function rodSet(t, { rodVisible = true } = {}) {
    rodParts.visible = rodVisible;
    const slide = 190 * (1 - E.io(clamp((t - tS0) / 1.0)));
    const g = Math.sin(Math.PI * clamp((t - tB0) / (tB1 - tB0)));
    stackM.emissiveIntensity = 1.05 * g; oven.material.opacity = 0.13 * Math.pow(g, 0.7);
    const ex = [0, 12, 0, 18, 0, 0]; void ex;
    // blade windows: slow cuts retract in between, the fast run stays in
    const win = [[tcs[0] - 0.32, tcs[0] + 0.36], [tcs[1] - 0.32, tcs[1] + 0.36], [tcs[2] - 0.32, tLastCut + 0.34]];
    let eng = 0; win.forEach(([a, b]) => { eng = Math.max(eng, E.io(clamp((t - a) / 0.26)) * (1 - E.io(clamp((t - (b - 0.26)) / 0.26)))); });
    eng = Math.max(eng, 0.3 * E.io(clamp((t - (tcs[0] - 1.3)) / 0.5)) * (t < tAns ? 1 : 0));
    blade.position.set(lerp(92, 35.2, eng), 0, 0); blade.userData.d.rotation.y = t * 30;
    const hide = t >= tAns - 0.02;
    rings.forEach((r, j) => {
      const sl = slots[j]; r.visible = true; r.rotation.set(0, 0, 0);
      if (j < NS && !(hide && j >= NCUT)) {
        const cutT = j < NCUT ? tcs[j] : 1e9;
        if (t < cutT + 0.02) {                                      // still part of the tube on the rod
          const sj = feedAmt(t, Math.min(j, NCUT));
          const sp = spinA(t); r.position.set(0, -2.5 + 5 * (j - sj) + slide, 0); r.rotation.set(0, sp, 0); return;
        }
        const tau = t - cutT - 0.02, T = 0.4, u = clamp(tau / T), e = u * u;
        const x = lerp(0, sl.x, E.o(u)), z = lerp(0, sl.z, E.o(u)), y = lerp(-2.5, sl.y, e);
        const bounce = u >= 1 ? Math.abs(Math.sin((tau - T) * 16)) * 1.6 * Math.exp(-(tau - T) * 7) : 0;
        r.position.set(x, y + bounce, z); r.rotation.set(sl.rx * E.o(u) + 0.12 * Math.sin(tau * 9) * (1 - u), lerp(spinA(cutT), sl.ry, E.o(u)), sl.rz * E.o(u)); return;
      }
      if (j >= NCUT && t >= tAns) {                                   // the rest of the tube: a stream of bands into the heap
        const t0 = tAns + 0.05 + (j - NCUT) * 0.0135, tau = t - t0; if (tau < 0) { r.visible = false; return; }
        const T = 0.55, u = clamp(tau / T), y0 = sl.y + 105;
        const bounce = u >= 1 ? Math.abs(Math.sin((tau - T) * 16)) * 1.6 * Math.exp(-(tau - T) * 7) : 0;
        r.position.set(lerp(sl.x * 0.3, sl.x, E.o(u)), lerp(y0, sl.y, u * u) + bounce, lerp(sl.z * 0.3, sl.z, E.o(u))); r.rotation.set(sl.rx * E.o(u), sl.ry + (1 - u) * 3, sl.rz * E.o(u)); return;
      }
      r.visible = false;
    });
  }

  // ================= SNAP: one band over two pegs, stretched and released =================
  const SNAP = station(3000); backPanel(SNAP, 260, 380, 0);
  const R0P = 2 * Math.PI * RM, PEG = 5;
  const snapRot = new THREE.Group(); snapRot.rotation.z = Math.PI / 2; SNAP.add(snapRot);   // stretch runs vertically: it fits the tall frame
  const snapM = rubberMat(rubberTex(false), { roughness: 0.5 }); const snapGeo = new THREE.BufferGeometry();
  const snapBand = new THREE.Mesh(snapGeo, snapM); snapBand.castShadow = true; snapBand.receiveShadow = true; snapRot.add(snapBand);
  const pegs = [0, 1].map(() => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(PEG, PEG, 16, 32), M.metal(0xc9d0d8, 0.22, {})); p.rotation.x = Math.PI / 2; p.castShadow = true; g.add(p);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(PEG + 2.2, PEG + 2.2, 2, 32), steelDark()); fl.rotation.x = Math.PI / 2; fl.position.z = -8; g.add(fl); snapRot.add(g); return g; });
  const d0 = (R0P - 2 * Math.PI * (PEG + TH / 2)) / 2, dMax = 70;
  const tStretch = Wd(8, 'no') + 0.02, tRelease = Wd(8, 'snaps') - 0.12;
  const dAt = t => { const up = E.io(clamp((t - tStretch) / 0.6)); const rel = clamp((t - tRelease) / 0.22);
    if (t < tRelease) return lerp(d0, dMax, up) + (up >= 1 ? 1.2 * Math.sin((t - tStretch) * 6) : 0);
    const o = 1 - E.o(rel); const wob = rel > 0 ? Math.exp(-(t - tRelease) * 9) * Math.sin((t - tRelease) * 40) * 3.2 : 0; return lerp(d0, dMax, o) + wob; };
  function snapSet(t) {
    const d = Math.max(d0 - 3, dAt(t)); const P = 2 * d + 2 * Math.PI * (PEG + TH / 2), sc = clamp(Math.sqrt(R0P / P), 0.45, 1); const th = TH * sc, wb = BW * sc;
    const strain = clamp((P / R0P - 1) / 1.1);
    fillRibbon(snapGeo, PEG + th / 2, d, wb, th, 150, P / 26);
    snapM.color.setRGB(1, lerp(1, 1.12, strain), lerp(1, 1.3, strain)); snapM.emissiveIntensity = 0.38 * strain; snapM.emissive.setHex(0xFFC060);
    pegs[0].position.set(-d / 2, 0, 0); pegs[1].position.set(d / 2, 0, 0);
    snapRot.rotation.y = 0.35 * Math.sin(t * 0.9) * (t < tStretch ? 1 : 0.3);
  }

  // ================= CHOICE =================
  const chG = station(20000, 0);
  const floorC = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M.std(0x121823, { roughness: 0.6, metalness: 0.2 })); floorC.rotation.x = -Math.PI / 2; floorC.position.y = 2; floorC.receiveShadow = true; chG.add(floorC);
  const pedG = pedestal(78, 130, 0x2BD67B), pedB = pedestal(78, 130, 0xFF7A3D); pedG.position.x = -105; pedB.position.x = 105; chG.add(pedG, pedB);
  const cray = crayon(0x1E9E55); cray.scale.setScalar(2.8); chG.add(cray);
  const bear = gummyBear(0xFF7A3D); bear.scale.setScalar(1.25); chG.add(bear);
  scene.updateMatrixWorld(true);

  // ---------------- camera ----------------
  let shake = 0, TT = 0;
  function cam(pos, subj, fov = 40, low = 0.3, roll = 0) {
    const p = pos.clone(); if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; p.z += noise1(TT * 40 + 21) * shake; }
    camera.position.copy(p); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.fov = fov; camera.lookAt(subj);
    const d = p.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));

  // ---------------- shots ----------------
  const shots = []; const S = (t0, t1, fn, par = 1) => shots.push({ t0, t1, fn, par });
  const all = [EXT, ROD, SNAP, chG];
  const show = (...o) => o.forEach(x => x.visible = true);
  const wide = (pos, c, size, k = 1.8, e = 0.95, bl = 0.25) => { rig(c, size, k); expo = e; ctx.bloom.strength = bl; };
  // HOOK: frame 0 already in motion (the tube comes out of the die); the loop frames replay it
  const hookPlate = (t) => { show(EXT); extSet(t); const k = E.o(clamp(t / 1.2)); const c = L(EXT, 0, 70, 0); cam(c.clone().add(v3(lerp(14, 0, k), lerp(-6, 0, k), lerp(250, 222, k))), c, 36, 0.12); wide(0, c, 110, 2.0, 0.8, 0.25); };
  S(0, tSnap, (u, t) => hookPlate(t), 0);
  // STEP 1: press the rubber out
  const tP1 = Ls(2) - 0.05, tP2 = Ls(2) + 1.35, tP3 = Ls(3) - 0.05;
  S(tSnap, tP1, (u, t) => { show(EXT); extSet(t); const c = L(EXT, 0, 92, 0); cam(orbit(c, lerp(290, 235, u), lerp(-0.5, -0.15, u), lerp(0.12, 0.05, u)), c, 36, 0.12); wide(0, c, 130, 1.9, 0.8, 0.22); });
  S(tP1, tP2, (u, t) => { show(EXT); extSet(t); const c = L(EXT, 0, 36, 0); cam(orbit(c, lerp(185, 150, u), lerp(0.35, 0.05, u), 0.06), c, 36, 0.12); wide(0, c, 90, 1.9, 0.8, 0.2); });
  S(tP2, tP3, (u, t) => { show(EXT); extSet(t); const c = L(EXT, 0, -30, 0); cam(orbit(c, lerp(175, 215, u), lerp(-0.35, 0.3, u), lerp(0.1, 0.25, u)), c, 36, 0.12); wide(0, c, 100, 1.9, 0.8, 0.2); });
  // STEP 2: bake it on a rod
  S(tP3, tSlideEnd + 0.15, (u, t) => { show(ROD); rodSet(t); const c = L(ROD, 0, 82, 0); cam(orbit(c, 235, lerp(-0.25, 0.1, u), 0.08), c, 36, 0.12); wide(0, c, 130, 1.9, 0.8, 0.2); });
  S(tSlideEnd + 0.15, tcs[0] - 0.9, (u, t) => { show(ROD); rodSet(t); const c = L(ROD, 0, 52, 0); cam(orbit(c, lerp(190, 150, E.o(u)), lerp(0.5, -0.15, u), lerp(0.25, 0.1, u)), c, 36, 0.12); wide(0, c, 100, 1.9, 0.8, 0.26); });
  // STEP 3: slice (blade side-on), slice again (3/4 from above), keep going (pulled back, the bands pile up)
  S(tcs[0] - 0.9, tcs[1] - 0.8, (u, t) => { show(ROD); rodSet(t); if (Math.abs(t - tcs[0]) < 0.07) shake = 0.8; const c = L(ROD, 0, -14, 0); cam(orbit(c, lerp(150, 122, E.o(u)), lerp(0.55, 0.05, u), lerp(0.28, 0.2, u)), c, 36, 0.12); wide(0, c, 80, 1.9, 0.8, 0.22); });
  S(tcs[1] - 0.8, Ls(6) - 0.05, (u, t) => { show(ROD); rodSet(t); if (Math.abs(t - tcs[1]) < 0.07) shake = 0.8; const c = L(ROD, 0, -14, 0); cam(orbit(c, lerp(125, 100, E.o(u)), lerp(-0.7, -0.25, u), lerp(0.55, 0.3, u)), c, 36, 0.12); wide(0, c, 80, 1.9, 0.8, 0.22); });
  S(Ls(6) - 0.05, tAns, (u, t) => { show(ROD); rodSet(t); const c = L(ROD, 0, -30, 0); cam(orbit(c, lerp(150, 170, u), lerp(0.4, 0.15, u), lerp(0.28, 0.22, u)), c, 36, 0.12); wide(0, c, 100, 1.9, 0.8, 0.22); });
  // ANSWER: one tube, hundreds of bands: the heap fills
  const tAnsB = Wd(7, 'hundreds') - 0.05;
  S(tAns, tAnsB, (u, t) => { show(ROD); rodSet(t); const c = L(ROD, 0, -52, 0); cam(orbit(c, lerp(210, 170, E.o(u)), lerp(0.3, -0.35, u), lerp(0.5, 0.42, u)), c, 36, 0.14); wide(0, c, 100, 1.9, 0.8, 0.3); });
  S(tAnsB, Ls(8) - 0.05, (u, t) => { show(ROD); rodSet(t); const c = L(ROD, 0, -48, 0); cam(orbit(c, lerp(165, 125, E.io(u)), lerp(-0.35, 0.5, u), lerp(0.42, 0.7, u)), c, 36, 0.14); wide(0, c, 80, 1.9, 0.8, 0.3); });
  // NO SEAM / SNAPS BACK
  const tSn2 = tRelease - 0.2;
  S(Ls(8) - 0.05, tSn2, (u, t) => { show(SNAP); snapSet(t); const c = L(SNAP, 0, 0, 0); cam(orbit(c, lerp(185, 205, E.io(u)), lerp(0.1, 0, u), 0.04), c, 36, 0.22); wide(0, c, 60, 1.9, 0.8, 0.3); });
  S(tSn2, tEC, (u, t) => { show(SNAP); snapSet(t); const c = L(SNAP, 0, 0, 0); cam(orbit(c, lerp(205, 160, E.o(u)), lerp(0.0, -0.2, u), 0.04), c, 36, 0.22); wide(0, c, 60, 1.9, 0.8, 0.3); });
  // END CARD
  const tE3 = tEC + (END - LOOP - tEC) / 2;
  const choiceSet = t => { show(chG); const lt = t - tEC; cray.position.set(-95, 150, 0); cray.rotation.set(0.0, lt * 0.6, 0.3);
    bear.position.set(105, 148, 0); bear.rotation.set(0, 0.5 * Math.sin(lt * 1.6) + 0.3, 0.05 * Math.sin(lt * 2));
    spotG.intensity = 3 * E.o(clamp(lt / 0.3)); spotB.intensity = 7 * E.o(clamp((lt - 0.15) / 0.3));
    spotG.position.copy(chG.position).add(v3(-260, 520, 260)); spotG.target.position.copy(chG.position).add(v3(-105, 150, 0));
    spotB.position.copy(chG.position).add(v3(260, 520, 260)); spotB.target.position.copy(chG.position).add(v3(105, 150, 0)); };
  S(tEC, tE3, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 215, 0)); cam(chG.position.clone().add(v3(0, lerp(250, 236, E.io(u)), lerp(1080, 1010, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  S(tE3, END - LOOP, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 220, 0)); cam(chG.position.clone().add(v3(lerp(-60, -20, E.io(u)), 160, lerp(950, 900, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  S(END - LOOP, END + 1, (u, t) => hookPlate(t - (END - 1 / 30)), 0);
  const shotAt = (t) => shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  function stateAt(t) {
    TT = t; shake = 0; expo = 1.1; ctx.bloom.strength = 0.36; spotG.intensity = spotB.intensity = 0;
    all.forEach(o => o.visible = false);
    const sh = shotAt(t); sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    ctx.renderer.toneMappingExposure = expo * 1.22;
    spotG.visible = spotG.intensity > 0; spotB.visible = spotB.intensity > 0;
    scene.updateMatrixWorld(true); return sh;
  }

  // ---------------- text events ----------------
  const TEXT = []; const T_ = (o) => { TEXT.push(o); return o; };
  const Y = 440;
  const titleO = { l1: 'HOW IS A RUBBER', l2: 'BAND MADE?', y: 400, words: [Wd(1, 'How'), Wd(1, 'is'), Wd(1, 'a'), Wd(1, 'rubber')], rawWord: 'RUBBER', scan: [0.15, 0.85], punchAt: Wd(1, 'band'), until: Ls(2) - 0.1, push: (tt) => clamp(tt / 2) };
  T_({ k: 'title', at: -1, until: Ls(2) - 0.1, label: 'HOW IS A RUBBER / BAND MADE?', fx: 'RAW TO REAL title' });
  T_({ k: 'cap', at: Wd(2, 'press'), until: Ls(3) - 0.1, words: [{ t: 'PRESS', k: 'verb' }, { t: 'THE', k: 'noun', at: Wd(2, 'the') }, { t: 'RUBBER', a: true, k: 'twist', at: Wd(2, 'rubber') }, { t: 'OUT.', k: 'noun', at: Wd(2, 'out') }], size: 96, y: Y + 30 });
  T_({ k: 'cap', at: Wd(3, 'bake'), until: tcs[0] - 0.05, words: [{ t: 'BAKE', a: true, k: 'verb' }, { t: 'IT', k: 'noun', at: Wd(3, 'it') }, { t: 'ON', k: 'noun', at: Wd(3, 'on') }, { t: 'A', k: 'noun', at: Wd(3, 'a') }, { t: 'ROD.', k: 'twist', at: Wd(3, 'rod') }], size: 104, y: Y + 30 });
  T_({ k: 'cap', at: Wd(4, 'slice'), until: Wd(4, 'slice') + 1.45, words: [{ t: 'SLICE.', a: true, k: 'twist' }], size: 170, y: Y + 30 });
  T_({ k: 'cap', at: Wd(5, 'slice'), until: Wd(5, 'slice') + 1.5, words: [{ t: 'SLICE', a: true, k: 'verb' }, { t: 'AGAIN.', k: 'twist', at: Wd(5, 'again') }], dir: -1, size: 130, y: Y + 30 });
  T_({ k: 'cap', at: Wd(6, 'keep'), until: tAns - 0.05, words: [{ t: 'KEEP', k: 'verb' }, { t: 'GOING.', a: true, k: 'twist', at: Wd(6, 'going') }], dir: 1, size: 140, y: Y + 30 });
  T_({ k: 'cap', at: Wd(7, 'one'), until: Wd(7, 'hundreds') - 0.05, words: [{ t: 'ONE', k: 'noun' }, { t: 'TUBE.', a: true, k: 'twist', at: Wd(7, 'tube') }], size: 150, y: Y + 30 });
  T_({ k: 'cap', at: Wd(7, 'hundreds'), until: Ls(8) - 0.1, words: [{ t: 'HUNDREDS', a: true, k: 'twist' }, { t: 'OF', k: 'noun', at: Wd(7, 'of') }, { t: 'BANDS.', k: 'noun', at: Wd(7, 'bands') }], size: 110, y: Y + 30 });
  T_({ k: 'cap', at: Wd(8, 'no'), until: Wd(8, 'it') - 0.05, words: [{ t: 'NO', k: 'noun' }, { t: 'SEAM.', a: true, k: 'twist', at: Wd(8, 'seam') }], size: 150, y: Y + 30 });
  T_({ k: 'cap', at: Wd(8, 'it'), until: tEC - 0.05, words: [{ t: 'IT', k: 'noun' }, { t: 'SNAPS', a: true, k: 'verb', at: Wd(8, 'snaps') }, { t: 'BACK.', k: 'twist', at: Wd(8, 'back') }], size: 120, y: Y + 30 });
  T_({ k: 'end', at: tEC, until: END - LOOP, fx: 'NEXT EPISODE? crayon (green) / gummy bear (orange), COMMENT BELOW, FOLLOW: NEW ONE EVERY DAY' });
  T_({ k: 'title-loop', at: END - LOOP, until: END + 1, label: 'HOW IS A RUBBER / BAND MADE?', fx: 'blueprint rebuilds, last frame = frame 0' });
  function drawText(g, t) {
    const sh = shotAt(t); setParallax(((clamp((t - sh.t0) / (sh.t1 - sh.t0)) - 0.5) * 2) * sh.par, 0);
    for (const o of TEXT) {
      if (t < o.at - 0.01 || t > o.until + 0.01) continue;
      if (o.k === 'title') titleRawReal(g, t, titleO);
      else if (o.k === 'title-loop' && t >= END - 1 / 30 - 1e-4) titleRawReal(g, 0, { ...titleO, push: () => 0 });
      else if (o.k === 'title-loop') titleRawReal(g, t, { ...titleO, words: [], loopAt: END - LOOP, push: () => 0 });
      else if (o.k === 'cap') kcap(g, t, { y: o.y || Y, ...o });
      else if (o.k === 'end') endCard2(g, t, { at: o.at, comment: Wd(9, 'Comment'), commentW2: Wd(9, 'below'), follow: Wd(9, 'below') + 0.15, until: o.until, left: 'CRAYON', right: 'GUMMY BEAR', next: 'EP. 08', followText: 'FOLLOW: NEW ONE EVERY DAY', rightColor: '#FF7A3D' });
    }
  }

  // ---------------- sound events ----------------
  const sfx = [
    { t: 0.0, n: 'pen_scratch' }, { t: 0.15, n: 'ui_tick' }, { t: tSnap, n: 'whoosh_soft' },
    { t: Wd(2, 'press'), n: 'ui_tick' }, { t: Wd(2, 'rubber'), n: 'press_thud' }, { t: Wd(2, 'out'), n: 'metal_click' },
    { t: Wd(3, 'bake'), n: 'ui_tick' }, { t: tSlideEnd - 0.05, n: 'metal_click' }, { t: tB0 + 0.1, n: 'low_whoosh' },
    { t: tcs[0] - 0.12, n: 'press_thud' }, { t: tcs[0], n: 'metal_tink' }, { t: tcs[0] + 0.3, n: 'plastic_drop' },
    { t: tcs[1] - 0.12, n: 'press_thud' }, { t: tcs[1], n: 'metal_tink' }, { t: tcs[1] + 0.3, n: 'plastic_drop' },
    ...tcs.slice(2).map((t, i) => ({ t, n: i % 2 ? 'ui_tick' : 'metal_tink' })), ...tcs.slice(2).filter((_, i) => i % 3 === 0).map(t => ({ t: t + 0.3, n: 'plastic_drop' })),
    { t: tAns, n: 'low_whoosh' }, { t: tAns + 0.2, n: 'glitch' }, { t: Wd(7, 'hundreds'), n: 'swell' }, { t: tAns + 0.6, n: 'plastic_drop' }, { t: tAns + 1.0, n: 'plastic_drop' },
    { t: Ls(8) - 0.05, n: 'whoosh_soft' }, { t: tStretch, n: 'plastic_click' }, { t: tRelease + 0.02, n: 'metal_tink' }, { t: Wd(8, 'back'), n: 'ui_tick' },
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
  return { seek, END, sfx, lines, shots: shots.map(s => [s.t0, s.t1]), caps: TEXT.map(o => [o.at, o.until, o.text || o.label || (o.words ? o.words.map(w => w.t).join(' ') : o.k), o.k, o.fx || '']), lockTicks: () => [] };
}
