// EP. 06 — the paper clip. Experiment E1 (structure A): one wire, built in front of the viewer step by step
// (coil -> pulled straight -> cut -> bend -> bend -> bend -> clip). The answer (one wire, three bends, no glue; the
// steel springs back = the grip) comes only in the last third. No jargon before the answer, no numbers before it.
// Hand-free hook, in motion at frame 0 (wire sliding off its coil); the loop frames replay the slide.
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M, shadowed, pedestal } from '../../js/parts.js';
import { crayon } from '../../js/pen.js';
import { setAccent, C, SAFE, titleRawReal, kcap, blurred, setParallax, endCard2 } from '../../js/overlay.js';

export const EP = 'EP. 06';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FF7A3D');
  ctx.bloom.threshold = 0.7; ctx.bloom.strength = 0.36; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.85;
  ctx.renderer.localClippingEnabled = true;

  // ---------------- timing ----------------
  const lines = timing.lines, Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  const Wd = (i, w, n = 0) => { const L = lines[i - 1]; const hits = L.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return L.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const LOOP = 0.9;
  const tEC = +Math.max(Ls(9) - 0.05, Le(9) - 2.5 + 0.04).toFixed(3);
  const END = +(Le(9) + 0.04 + LOOP).toFixed(3);
  const tSnap = 1.2;                                   // R1: the first mechanism shot (the rollers) starts at 1.2 s

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
  const WR = 0.5;                                       // wire radius, mm (1 mm wire: not enlarged)
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

  // galvanized wire: fine spangle texture + a dark tick band every so often (so the motion along the wire reads)
  const wireTexBase = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#c3ccd6'; g.fillRect(0, 0, 512, 64);
    for (let i = 0; i < 900; i++) { const v = 150 + hash(i * 1.7) * 90; g.fillStyle = `rgba(${v},${v + 6},${v + 14},0.55)`; g.fillRect(hash(i * 3.1) * 512, hash(i * 5.3) * 64, 4 + hash(i * 7.7) * 16, 2 + hash(i * 9.1) * 6); }
    g.fillStyle = 'rgba(40,48,60,0.55)'; g.fillRect(0, 0, 9, 64); g.fillRect(256, 0, 5, 64);
    const gl = g.createLinearGradient(0, 0, 0, 64); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, 512, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  })();
  const glowTexBase = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 4; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 4); const gr = g.createLinearGradient(96, 0, 160, 0); gr.addColorStop(0, '#000'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(96, 0, 64, 4); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; return t; })();
  function wireMat(rep) {
    const t = wireTexBase.clone(); t.needsUpdate = true; t.repeat.set(rep, 1);
    const gt = glowTexBase.clone(); gt.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: 0xdfe5ec, map: t, metalness: 0.92, roughness: 0.26, envMapIntensity: 1.5, emissive: 0xFF7A3D, emissiveMap: gt, emissiveIntensity: 0 });
  }
  function tubeFrom(pts, mat, seg) {
    const cv = pts.length === 2 ? new THREE.LineCurve3(pts[0], pts[1]) : new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const m = new THREE.Mesh(new THREE.TubeGeometry(cv, seg, WR, 10, false), mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function retube(mesh, pts, seg) { mesh.geometry.dispose(); mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, WR, 10, false); }

  // ================= STR: coil -> rollers -> straight wire =================
  const STR = station(0); box(220, 300, 3, 0, 40, -6, M.std(0x1b2330, { roughness: 0.6, metalness: 0.4 }), STR);
  const R0 = 34, S_TOT = 240, VW = 46;                       // coil radius, path length, wire speed (mm/s)
  const rollS0 = 92, rollS1 = 150, LAM = 16;
  const kappa = s => (1 / R0) * (1 - sstep(58, 130, s)) + 0.2 * Math.sin(2 * Math.PI * (s - rollS0) / LAM) * (1 - sstep(rollS0, rollS1, s)) * sstep(rollS0 - 6, rollS0 + 4, s);
  function integ(h0) { const p = []; let x = 0, y = 0, h = h0; p.push([x, y, h, 0]); for (let s = 0; s < S_TOT; s += 0.5) { const hm = h + kappa(s + 0.25) * 0.25; x += Math.cos(hm) * 0.5; y += Math.sin(hm) * 0.5; h += kappa(s + 0.25) * 0.5; p.push([x, y, h, s + 0.5]); } return p; }
  const h0 = Math.PI / 2 - (integ(0).at(-1)[2]);
  let PATH = integ(h0); { const e = PATH.findIndex(q => q[3] >= rollS1); const ox = PATH[e][0], oy = PATH[e][1] - 52; PATH = PATH.map(([x, y, h, s]) => [x - ox, y - oy, h, s]); }
  const wireS = tubeFrom(PATH.map(([x, y]) => v3(x, y, 0)), wireMat(S_TOT / 14), 520); STR.add(wireS);
  const coilC = (() => { const [x, y, h] = PATH[0]; return v3(x - Math.sin(h) * R0, y + Math.cos(h) * R0, 0); })();
  const coilG = new THREE.Group(); coilG.position.copy(coilC); STR.add(coilG);
  { const coilM = M.metal(0xaab4bf, 0.35, { envMapIntensity: 1.2 });
    for (let i = 1; i <= 11; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(R0 + (i % 3 - 1) * 0.9, WR, 8, 160), coilM); r.position.z = -i * 1.02; r.castShadow = r.receiveShadow = true; coilG.add(r); }
    const tieM = M.std(0xFF7A3D, { roughness: 0.5 }); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.5; const tie = box(3.2, 5.0, 12.5, Math.cos(a) * (R0 - 0.2), Math.sin(a) * (R0 - 0.2), -5.5, tieM, coilG); tie.rotation.z = a; }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R0 - 8, R0 - 8, 12, 48, 1, true), M.std(0x222a35, { roughness: 0.7, metalness: 0.5, side: THREE.DoubleSide })); hub.rotation.x = Math.PI / 2; hub.position.z = -6; coilG.add(hub); }
  // rollers: two staggered rows, the wire weaves between them
  const rollers = []; { const Rr = 5.2, rm = M.metal(0x6b7686, 0.3, {});
    const kn = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#7b8696'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#3a424e'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 5, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    rm.map = kn;
    const capT = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#9aa5b4'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill(); g.strokeStyle = '#4a5463'; g.lineWidth = 9; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(128 + Math.cos(a) * 36, 128 + Math.sin(a) * 36); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke(); } g.fillStyle = '#d9dee6'; g.beginPath(); g.arc(128, 128, 30, 0, 7); g.fill(); g.strokeStyle = '#2e3641'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const capM = M.metal(0xb8c0cc, 0.3, { map: capT });
    for (let i = 0; i < 6; i++) { const s = rollS0 + LAM / 4 + i * LAM / 2; const k = PATH.findIndex(q => q[3] >= s); const [x, y, h] = PATH[k]; const side = i % 2 ? 1 : -1;
      const nx = -Math.sin(h), ny = Math.cos(h); const amp = 1.9 * (1 - sstep(rollS0, rollS1 + 10, s)) + 0.15;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(Rr, Rr, 7, 40), [rm, capM, capM]); c.rotation.x = Math.PI / 2; c.position.set(x + nx * side * (Rr + WR + amp * 0.2), y + ny * side * (Rr + WR + amp * 0.2), 0); c.castShadow = c.receiveShadow = true; c.userData.dir = side; STR.add(c); rollers.push(c); } }
  // a thin cyan line that shows how straight the wire is once it has left the rollers
  const refM = new THREE.MeshBasicMaterial({ color: 0x7FE3FF, transparent: true, opacity: 0, depthTest: false });
  const refLine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 70, 0.1), refM); refLine.position.set(0, 52 + 35 + 6, 1); refLine.renderOrder = 12; STR.add(refLine);
  function strSet(t, { ref = 0 } = {}) {
    const mat = wireS.material; mat.map.offset.x = -VW * t / 14; mat.emissiveIntensity = 0;
    coilG.rotation.z = -VW * t / R0 * 1; rollers.forEach(r => { r.rotation.y = r.userData.dir * VW * t / 5.2 * -1; });
    refM.opacity = ref;
  }
  const strP = (s) => { const k = PATH.findIndex(q => q[3] >= s); return v3(PATH[k][0], PATH[k][1], 0); };

  // ================= CUT: guide block, blade, the piece falls =================
  const CUT = station(1500); box(200, 300, 3, 0, 0, -6, M.std(0x1b2330, { roughness: 0.6, metalness: 0.4 }), CUT);
  const PIECE_LEN = 118.7;
  const cutUp = tubeFrom([v3(0, 0, 0), v3(0, 140, 0)], wireMat(10), 20); CUT.add(cutUp);
  const cutDn = tubeFrom([v3(0, 0, 0), v3(0, -PIECE_LEN, 0)], wireMat(8), 60); CUT.add(cutDn);
  { const bm = M.metal(0x353d4a, 0.45, { envMapIntensity: 0.8 }); box(24, 11, 5, 0, 6.8, -4.2, bm, CUT); box(24, 11, 5, 0, -6.8, -4.2, bm, CUT);
    const gm = M.metal(0x2c333e, 0.45, {}); box(50, 2.6, 5, 25, 0, -4.2, gm, CUT);
    for (const yy of [-9, 9]) box(4, 4, 6.5, -2.6, yy, 0.2, bm, CUT); }
  const blade = box(36, 1.2, 6, 40, 0, 0, M.metal(0xe3e8ee, 0.18), CUT);
  const tCut = Ls(3) + 0.5;
  function cutSet(t) {
    const fed = t < tCut; const feedS = t * VW * 0.0;                       // the wire is held still while the blade comes in
    cutUp.material.map.offset.y = 0; cutUp.material.map.offset.x = -(Math.min(t, tCut) * VW) / 10 * 0.0;
    const bu = E.io(clamp((t - (tCut - 0.34)) / 0.24)), br = E.io(clamp((t - tCut - 0.18) / 0.3));
    blade.position.x = lerp(40, 8, bu) + br * 34;                           // the blade edge passes the wire at x ~ -10 + ...
    const fa = Math.max(0, t - tCut - 0.04);
    cutDn.position.set(0, -fa * fa * 380 * 1.0, 0); cutDn.rotation.z = fa * 0.9 * (fa > 0 ? 1 : 0); cutDn.visible = fa < 1.2; cutDn.position.y = fa > 0 ? -(fa * fa * 260 + fa * 30) : 0;
    cutUp.visible = true;
  }

  // ================= BED: the wire is bent around three pins =================
  const BED = station(3000); BED.rotation.z = -0.3;
  box(190, 300, 5, 0, 55, -3.0, M.std(0x2b3646, { roughness: 0.42, metalness: 0.7, envMapIntensity: 0.9 }), BED);
  for (let i = 0; i < 5; i++) box(190, 0.9, 0.3, 0, 8 + i * 28, -0.45, M.std(0x333c4a, { roughness: 0.5, metalness: 0.6 }), BED);
  const AA = 28, R1 = 5, BB = 26, R2 = 3.6, CC = 20, R3 = 1.8, DD = 12;
  const SEG = [['s', AA], ['a', R1, 0, 0], ['s', BB], ['a', R2, 1, 1], ['s', CC], ['a', R3, 2, 2], ['s', DD]];
  const GRP = [0, 0, 0, 1, 2, 2, 2];
  const TOTAL = AA + BB + CC + DD + Math.PI * (R1 + R2 + R3);
  // turtle: clockwise turns, held end at (0,0) heading up. th = fraction (0..1) of each 180 deg bend that is done
  function clipPath(th, step = 0.55) {
    let x = 0, y = 0, h = Math.PI / 2, s = 0; const pts = [{ x, y, h, s, g: 0, f: 0 }], cen = [], fing = [];
    const adv = (len, kap, g, f0, f1) => { const n = Math.max(1, Math.ceil(len / step)), d = len / n; for (let i = 0; i < n; i++) { const hm = h - kap * d / 2; x += Math.cos(hm) * d; y += Math.sin(hm) * d; h -= kap * d; s += d; pts.push({ x, y, h, s, g, f: lerp(f0, f1, (i + 1) / n) }); } };
    SEG.forEach((sg, i) => {
      if (sg[0] === 's') { adv(sg[1], 0, GRP[i], 0, 0); return; }
      const r = sg[1], k = sg[2], bent = th[k] * Math.PI * r, rest = Math.PI * r - bent;
      cen[k] = { x: x + Math.sin(h) * r, y: y - Math.cos(h) * r, r, h0: h };
      const s0 = s; if (bent > 1e-4) adv(bent, 1 / r, GRP[i], 0, th[k]); if (rest > 1e-4) adv(rest, 0, GRP[i], th[k], 1);
      cen[k].sEnd = s0 + bent;
    });
    cen.forEach((c, k) => { const P = pts.find(p => p.s >= c.sEnd + 7) || pts.at(-1); fing[k] = { x: P.x, y: P.y, h: P.h }; });
    return { pts, cen, fing };
  }
  const liftRot = (pts, alpha, hingeY = 2) => pts.map(p => { const w = p.g === 2 ? 1 : p.g === 1 ? sstep(0, 1, p.f) : 0, a = alpha * w, dy = p.y - hingeY; return v3(p.x, hingeY + dy * Math.cos(a), dy * Math.sin(a)); });
  const bendWire = tubeFrom([v3(0, 0, 0), v3(0, 1, 0)], wireMat(TOTAL / 14), 20); BED.add(bendWire);
  const tools = [0, 1, 2].map(k => { const g = new THREE.Group(); BED.add(g); const sm = steelDark();
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.4, 32), sm); pin.rotation.x = Math.PI / 2; pin.castShadow = true; g.add(pin);
    const fing = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 24), M.metal(0xc9d0d8, 0.25)); fing.rotation.x = Math.PI / 2; fing.castShadow = true; g.add(fing);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.9), sm); arm.castShadow = true; g.add(arm);
    g.userData = { pin, fing, arm }; g.visible = false; return g; });
  const clampB = box(9, 8, 4.5, -5.1, 0.5, 0.2, M.metal(0x59636f, 0.34, {}), BED);
  const mkM = () => new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M.glow(0xFF7A3D, 3.2));
  const marks = [mkM(), mkM(), mkM()]; marks.forEach(m => { m.visible = false; BED.add(m); });
  // bend timeline (physical order: the end bend first, the outer loop last)
  const BT = [{ k: 2, t0: Ls(4) + 0.02, d: 1.4 }, { k: 1, t0: Ls(5) + 0.02, d: 1.4 }, { k: 0, t0: Ls(6) + 0.02, d: 1.5 }];
  const tAnswer = Ls(7);
  const thAt = t => { const th = [0, 0, 0]; BT.forEach(b => { const u = clamp((t - b.t0) / b.d); th[b.k] = E.io2(u) + 0.02 * Math.sin(u * Math.PI) * (u < 1 ? 1 : 0); if (u >= 1) th[b.k] = 1; }); return th; };
  const bedAnchor = {};   // filled per frame: world-space helpers for the camera
  function bedSet(t, { lift = 0, glow = -1, markers = 0, force = null } = {}) {
    const th = force || thAt(t); const cp = clipPath(th);
    const pts = lift ? liftRot(cp.pts, lift) : cp.pts.map(p => v3(p.x, p.y, 0));
    // the whole piece lands on the bed first (slides in from the right, drops a little)
    const lu = E.o(clamp((t - (Ls(4) - 1.15)) / 0.55)); const ox = lerp(46, 0, lu), oz = lerp(7, 0, lu * lu);
    const q = pts.map(p => v3(p.x + ox, p.y, p.z + oz));
    retube(bendWire, q, 480);
    bendWire.material.emissiveIntensity = glow >= 0 ? 1.25 * clamp(Math.sin(Math.min(1, glow) * Math.PI) * 2) : 0; bendWire.material.emissiveMap.offset.x = -(glow < 0 ? 0 : glow) + 0.5 - 0.5;
    bendWire.material.map.offset.x = 0;
    clampB.position.x = -5.1 - 18 * E.io(clamp((t - (BT[2].t0 + BT[2].d)) / 0.4)) + ox; clampB.visible = lu >= 0.5;
    BT.forEach(b => { const g = tools[b.k], u = (t - b.t0) / b.d; const on = u > -0.35 && u < 1.28; g.visible = on && lu >= 1;
      if (!g.visible) return; const pop = E.o(clamp((u + 0.35) / 0.3)) * E.o(clamp((1.28 - u) / 0.28));
      const c = cp.cen[b.k], f = cp.fing[b.k], lx = -Math.sin(f.h), ly = Math.cos(f.h), fx = f.x + lx * (WR + 1.1), fy = f.y + ly * (WR + 1.1);
      g.userData.pin.position.set(c.x, c.y, 0.85); g.userData.pin.scale.set(Math.max(0.3, c.r - WR - 0.02) * pop, 1, Math.max(0.3, c.r - WR - 0.02) * pop);
      g.userData.fing.position.set(fx, fy, 0.85); g.userData.fing.scale.setScalar(pop);
      const dx = fx - c.x, dy = fy - c.y, len = Math.hypot(dx, dy); g.userData.arm.position.set((c.x + fx) / 2, (c.y + fy) / 2, 1.95); g.userData.arm.scale.set(len, 1, 1); g.userData.arm.rotation.set(0, 0, Math.atan2(dy, dx)); g.userData.arm.visible = pop > 0.02; });
    const apex = [v3(5 + ox, 33, oz), v3(6.4 + ox, -1.6, oz), v3(4.6 + ox, 23.8, oz)];
    marks.forEach((m, i) => { const u = markers ? E.back(clamp((t - markers[i]) / 0.3)) : 0; m.visible = u > 0.01; m.position.copy(apex[i]).setZ(0.2); m.scale.setScalar(1.25 * u * (1 + 0.12 * Math.sin(t * 9 + i))); });
    bedAnchor.cp = cp; bedAnchor.ox = ox; bedAnchor.oz = oz;
    return cp;
  }
  // ================= GRIP: the clip slides onto three sheets, the loops spring open and push back =================
  const GRIPS = station(4800); GRIPS.rotation.z = -0.3;
  box(220, 260, 5, 0, 20, -3.0, M.std(0x222a36, { roughness: 0.42, metalness: 0.7, envMapIntensity: 0.9 }), GRIPS);
  const clipG = tubeFrom([v3(0, 0, 0), v3(0, 1, 0)], wireMat(TOTAL / 14), 20); GRIPS.add(clipG);
  const sheetM = M.std(0x8d8576, { roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }); const sheets = [0, 1, 2].map(i => { const s = box(30, 40, 0.12, 5, 30, 0.9, sheetM, GRIPS); return s; });
  const gArrM = new THREE.MeshBasicMaterial({ color: 0x7FE3FF, transparent: true, opacity: 0, depthTest: false });
  const mkArr = () => { const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.7, 8), gArrM); sh.position.y = 0.85; const h = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 12), gArrM); h.position.y = 2.1; g.add(sh, h); g.renderOrder = sh.renderOrder = h.renderOrder = 12; return g; };
  const arrs = [mkArr(), mkArr(), mkArr(), mkArr()]; arrs.forEach(a => GRIPS.add(a));
  const AMAX = 0.125;                                                         // ~7 degrees at the hinge
  const tG0 = Ls(8) - 0.5, tG1 = Wd(8, 'springs') + 0.1;
  const gripState = t => { const slide = E.io(clamp((t - tG0) / 1.1)); const yEdge = lerp(52, 3.5, slide);
    const open = AMAX * sstep(27, 17, yEdge); const back = clamp((t - tG1) / 0.9); const osc = back > 0 ? Math.exp(-back * 5) * Math.sin(back * 20) * 0.03 : 0;
    return { yEdge, alpha: open * (1 - 0.0 * back) + osc, back }; };
  function gripSet(t) {
    const st = gripState(t); const cp = clipPath([1, 1, 1]); const pts = liftRot(cp.pts, st.alpha); retube(clipG, pts, 420);
    sheets.forEach((s, i) => { s.position.set(5, st.yEdge + 20 + i * 0.4, 0.62 + i * 0.15); s.scale.set(1, 1, 1); });
    const a = clamp((t - tG1 + 0.1) / 0.2); gArrM.opacity = 0.95 * a * clamp((Le(8) - t + 0.1) / 0.2);
    const pulse = 0.5 + 0.5 * Math.sin(t * 14), dz = 0.35 * pulse;
    // inner loop pushes the sheets down, the outer loop pushes them up
    arrs[0].position.set(4.6, 20, 3.4 + dz); arrs[0].quaternion.setFromUnitVectors(v3(0, 1, 0), v3(0, 0, -1));
    arrs[1].position.set(4.6, 20, -2.6 - dz); arrs[1].quaternion.setFromUnitVectors(v3(0, 1, 0), v3(0, 0, 1));
    arrs[2].position.set(5, 8, 3.4 + dz); arrs[2].quaternion.setFromUnitVectors(v3(0, 1, 0), v3(0, 0, -1));
    arrs[3].position.set(5, 8, -2.6 - dz); arrs[3].quaternion.setFromUnitVectors(v3(0, 1, 0), v3(0, 0, 1));
    arrs.forEach(x => x.visible = gArrM.opacity > 0.02);
  }

  // ================= CHOICE =================
  const chG = station(20000, 0);
  const floorC = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M.std(0x121823, { roughness: 0.6, metalness: 0.2 })); floorC.rotation.x = -Math.PI / 2; floorC.position.y = 2; floorC.receiveShadow = true; chG.add(floorC);
  const pedG = pedestal(78, 130, 0x2BD67B), pedB = pedestal(78, 130, 0xFF7A3D); pedG.position.x = -105; pedB.position.x = 105; chG.add(pedG, pedB);
  const cray = crayon(0x1E9E55); cray.scale.setScalar(2.8); chG.add(cray);
  const band = (() => { const g = new THREE.Group(); const mk = (R, w, col) => { const sh = new THREE.Shape(); sh.absarc(0, 0, R, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, R - 1.5, 0, Math.PI * 2, true); sh.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2, curveSegments: 64 }), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.42, clearcoat: 0.3 })); m.castShadow = m.receiveShadow = true; m.position.z = -w / 2; return m; };
    const a = mk(30, 7, 0xE9B44C), b = mk(22, 7, 0xD9892B); b.position.set(-9, -4, 0); b.rotation.set(0, 0.0, 0); g.add(a); g.add(b); return g; })();
  band.scale.setScalar(1.7); chG.add(band);
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
  const all = [STR, CUT, BED, GRIPS, chG];
  const show = (...o) => o.forEach(x => x.visible = true);
  const wide = (pos, c, size, k = 1.8, e = 0.95, bl = 0.25) => { rig(c, size, k); expo = e; ctx.bloom.strength = bl; };
  // HOOK: frame 0 already in motion; the wire slides off its coil (loop frames replay it)
  const hookPlate = (t) => { show(STR); strSet(t); const k = E.o(clamp(t / 1.2)); const c = L(STR, -9, 22, 0); cam(c.clone().add(v3(lerp(8, 0, k), lerp(-6, 0, k), lerp(135, 112, k))), c, 36, 0.3); wide(0, c, 70, 2.0, 0.98, 0.25); };
  S(0, tSnap, (u, t) => hookPlate(t), 0);
  // STEP 1: pulled straight by the rollers
  const tS2 = Ls(2) - 0.05, tS3 = Ls(2) + 1.2, tRef = Wd(2, 'straight') - 0.05;
  S(tSnap, tS2, (u, t) => { show(STR); strSet(t); const c = L(STR, 0, 40, 0); cam(orbit(c, lerp(62, 52, u), lerp(-0.55, -0.2, u), lerp(0.1, 0.05, u)), c, 36, 0.28); wide(0, c, 50, 1.9, 0.95, 0.22); });
  S(tS2, tS3, (u, t) => { show(STR); strSet(t, { ref: clamp((t - tRef) / 0.3) }); const c = L(STR, 0, 44, 0); cam(orbit(c, lerp(34, 28, u), lerp(0.5, 0.2, u), 0.05), c, 36, 0.25); wide(0, c, 40, 1.9, 0.95, 0.2); });
  const tCutS = Ls(3) - 0.05;
  S(tS3, tCutS, (u, t) => { show(STR); strSet(t, { ref: clamp((t - tRef) / 0.3) * (1 - clamp((t - (tCutS - 0.25)) / 0.2)) }); const c = L(STR, 0, 74, 0); cam(orbit(c, lerp(56, 46, u), 0.1, 0.06), c, 36, 0.25); wide(0, c, 60, 1.9, 0.95, 0.2); });
  // STEP 2: cut
  const tCutE = Ls(4) - 1.2;
  S(tCutS, tCutE, (u, t) => { show(CUT); cutSet(t); if (t > tCut - 0.02 && t < tCut + 0.14) shake = 0.9; const c = L(CUT, 0, -2, 0); cam(orbit(c, lerp(54, 40, E.o(u)), lerp(-0.25, 0.1, u), 0.05), c, 36, 0.2); wide(0, c, 40, 1.9, 0.95, 0.2); });
  // the piece lands on the bed (slides in) and the first bend starts
  const tB1 = BT[0].t0 + 1.5, tB2 = BT[1].t0 + 1.5, tB3 = BT[2].t0 + 1.55;
  const cenW = (k) => ({ 2: [R3, 101.02 - 0.0], 1: [R2, 69.708], 0: [R1, 28] })[k];
  const focus = (k, dx = 0, dy = 0) => { const [cx, cy] = cenW(k); return L(BED, cx + dx, cy + dy, 0); };
  S(tCutE, BT[0].t0 + 0.55, (u, t) => { show(BED); bedSet(t); const c = focus(2, 0, -2); cam(orbit(c, lerp(150, 128, u), lerp(0.25, 0.1, u), lerp(0.45, 0.3, u)), c, 34, 0.2); wide(0, c, 80, 1.9, 0.92, 0.2); });
  S(BT[0].t0 + 0.55, tB1, (u, t) => { show(BED); bedSet(t); const c = focus(2, 0, -2); cam(orbit(c, lerp(96, 70, u), lerp(0.2, -0.05, u), lerp(0.4, 0.55, u)), c, 34, 0.2); wide(0, c, 50, 1.9, 0.92, 0.2); });
  // STEP 4: again
  S(tB1, tB2, (u, t) => { show(BED); bedSet(t); const c = focus(1, 0, 2); cam(orbit(c, lerp(130, 108, u), lerp(-0.3, 0.1, u), 0.38), c, 34, 0.2); wide(0, c, 70, 1.9, 0.92, 0.2); });
  S(tB2, tB3, (u, t) => { show(BED); bedSet(t); const c = focus(0, 2, 6); cam(orbit(c, lerp(120, 100, u), lerp(0.3, -0.1, u), 0.4), c, 34, 0.2); wide(0, c, 70, 1.9, 0.92, 0.2); });
  // ANSWER: the finished clip with the three bends marked
  const tAns2 = Wd(7, 'bends') - 0.1;
  const mk0 = Wd(7, 'three') - 0.0, mk1 = (Wd(7, 'three') + Wd(7, 'bends')) / 2 + 0.05, mk2 = Wd(7, 'bends') + 0.1;
  const clipC = () => L(BED, 4.5 + bedAnchor.ox * 0, 15, 0);
  S(tB3, tAnswer + 1.0, (u, t) => { show(BED); bedSet(t, { force: [1, 1, 1], glow: clamp((t - tAnswer) / 0.95) }); const c = L(BED, 5, 15, 0); cam(orbit(c, lerp(170, 118, E.o(u)), lerp(-0.3, 0.12, u), lerp(0.25, 0.3, u)), c, 36, 0.3); wide(0, c, 40, 1.9, 0.92, 0.3); });
  S(tAnswer + 1.0, Ls(8) - 0.05, (u, t) => { show(BED); bedSet(t, { force: [1, 1, 1], markers: [mk0, mk1, mk2] }); const c = L(BED, 5, 15, 0); cam(orbit(c, lerp(118, 104, u), lerp(0.12, 0.45, u), 0.32), c, 36, 0.3); wide(0, c, 40, 1.9, 0.92, 0.3); });
  // GRIP
  const tGm = Ls(8) + 1.15;
  S(Ls(8) - 0.05, tGm, (u, t) => { show(GRIPS); gripSet(t); const c = L(GRIPS, 5, 14, 0.8); cam(orbit(c, lerp(125, 102, u), lerp(0.35, 0.75, u), lerp(0.95, 0.75, u)), c, 36, 0.14); wide(0, c, 50, 1.9, 0.92, 0.2); });
  S(tGm, tEC, (u, t) => { show(GRIPS); gripSet(t); const c = L(GRIPS, 5, 16, 0.8); cam(orbit(c, lerp(92, 70, E.io(u)), lerp(0.8, 1.15, E.io(u)), lerp(0.7, 0.42, u)), c, 36, 0.14); wide(0, c, 40, 1.9, 0.92, 0.25); });
  // END CARD
  const tE3 = tEC + (END - LOOP - tEC) / 2;
  const choiceSet = t => { show(chG); const lt = t - tEC; cray.position.set(-95, 150, 0); cray.rotation.set(0.0, lt * 0.6, 0.3);
    band.position.set(105, 232 + Math.sin(lt * 2.2) * 5, 0); band.rotation.set(0.1, 0.5 * Math.sin(lt * 1.6) + 0.3, 0.05);
    spotG.intensity = 3 * E.o(clamp(lt / 0.3)); spotB.intensity = 7 * E.o(clamp((lt - 0.15) / 0.3));
    spotG.position.copy(chG.position).add(v3(-260, 520, 260)); spotG.target.position.copy(chG.position).add(v3(-105, 150, 0));
    spotB.position.copy(chG.position).add(v3(260, 520, 260)); spotB.target.position.copy(chG.position).add(v3(105, 150, 0)); };
  S(tEC, tE3, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 215, 0)); cam(chG.position.clone().add(v3(0, lerp(250, 236, E.io(u)), lerp(1080, 1010, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  S(tE3, END - LOOP, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 220, 0)); cam(chG.position.clone().add(v3(lerp(-60, -20, E.io(u)), 160, lerp(950, 900, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  S(END - LOOP, END + 1, (u, t) => hookPlate(t - (END - 1 / 30)), 0);
  const shotAt = (t) => shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  function stateAt(t) {
    TT = t; shake = 0; expo = 1.1; ctx.bloom.strength = 0.36; spotG.intensity = spotB.intensity = 0; refM.opacity = 0; gArrM.opacity = 0;
    all.forEach(o => o.visible = false);
    const sh = shotAt(t); sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    ctx.renderer.toneMappingExposure = expo * 1.22;
    spotG.visible = spotG.intensity > 0; spotB.visible = spotB.intensity > 0;
    scene.updateMatrixWorld(true); return sh;
  }

  // ---------------- text events ----------------
  const TEXT = []; const T_ = (o) => { TEXT.push(o); return o; };
  const Y = 440;
  const titleO = { l1: 'HOW DOES ONE WIRE BECOME', l2: 'A PAPER CLIP?', y: 400, words: [Wd(1, 'How'), Wd(1, 'does'), Wd(1, 'one'), Wd(1, 'wire'), Wd(1, 'become')], rawWord: 'WIRE', scan: [0.15, 0.85], punchAt: Wd(1, 'paper'), until: Ls(2) - 0.1, push: (tt) => clamp(tt / 2) };
  T_({ k: 'title', at: -1, until: Ls(2) - 0.1, label: 'HOW DOES ONE WIRE BECOME / A PAPER CLIP?', fx: 'RAW TO REAL title' });
  T_({ k: 'cap', at: Wd(2, 'pull'), until: Wd(2, 'pull') + 1.5, words: [{ t: 'PULL IT', k: 'verb' }, { t: 'STRAIGHT.', a: true, k: 'twist', at: Wd(2, 'straight') }], size: 118, y: Y + 30 });
  T_({ k: 'cap', at: Wd(3, 'cut'), until: Wd(3, 'cut') + 1.45, words: [{ t: 'CUT.', a: true, k: 'twist' }], size: 170, y: Y + 30 });
  T_({ k: 'cap', at: Wd(4, 'bend'), until: Wd(4, 'bend') + 1.5, words: [{ t: 'BEND.', a: true, k: 'verb' }], dir: 1, size: 160, y: Y + 30 });
  T_({ k: 'cap', at: Wd(5, 'bend'), until: Wd(5, 'bend') + 1.5, words: [{ t: 'BEND', k: 'verb' }, { t: 'AGAIN.', a: true, k: 'twist', at: Wd(5, 'again') }], dir: -1, size: 130, y: Y + 30 });
  T_({ k: 'cap', at: Wd(6, 'once'), until: Wd(6, 'once') + 1.6, words: [{ t: 'ONCE', k: 'noun' }, { t: 'MORE.', a: true, k: 'twist', at: Wd(6, 'more') }], dir: 1, size: 140, y: Y + 30 });
  T_({ k: 'cap', at: Wd(7, 'one'), until: Wd(7, 'three') - 0.05, words: [{ t: 'ONE', k: 'noun' }, { t: 'WIRE.', a: true, k: 'twist', at: Wd(7, 'wire') }], size: 150, y: Y + 30 });
  T_({ k: 'cap', at: Wd(7, 'three'), until: Wd(7, 'no') - 0.05, words: [{ t: 'THREE', a: true, k: 'twist' }, { t: 'BENDS.', k: 'noun', at: Wd(7, 'bends') }], size: 130, y: Y + 30 });
  T_({ k: 'cap', at: Wd(7, 'no'), until: Ls(8) - 0.1, words: [{ t: 'NO', k: 'noun' }, { t: 'GLUE.', a: true, k: 'twist', at: Wd(7, 'glue') }], size: 150, y: Y + 30 });
  T_({ k: 'cap', at: Wd(8, 'steel'), until: Wd(8, "that's") - 0.05, words: [{ t: 'SPRINGS', a: true, k: 'verb', at: Wd(8, 'springs') }, { t: 'BACK.', k: 'twist', at: Wd(8, 'back') }], size: 130, y: Y + 30 });
  T_({ k: 'cap', at: Wd(8, "that's"), until: tEC - 0.05, words: [{ t: "THAT'S", k: 'noun' }, { t: 'THE', k: 'noun', at: Wd(8, 'the', 1) }, { t: 'GRIP.', a: true, k: 'twist', at: Wd(8, 'grip') }], size: 120, y: Y + 30 });
  T_({ k: 'end', at: tEC, until: END - LOOP, fx: 'NEXT EPISODE? crayon (green) / rubber band (orange), COMMENT BELOW, FOLLOW: NEW ONE EVERY DAY' });
  T_({ k: 'title-loop', at: END - LOOP, until: END + 1, label: 'HOW DOES ONE WIRE BECOME / A PAPER CLIP?', fx: 'blueprint rebuilds, last frame = frame 0' });
  function drawText(g, t) {
    const sh = shotAt(t); setParallax(((clamp((t - sh.t0) / (sh.t1 - sh.t0)) - 0.5) * 2) * sh.par, 0);
    for (const o of TEXT) {
      if (t < o.at - 0.01 || t > o.until + 0.01) continue;
      if (o.k === 'title') titleRawReal(g, t, titleO);
      else if (o.k === 'title-loop' && t >= END - 1 / 30 - 1e-4) titleRawReal(g, 0, { ...titleO, push: () => 0 });
      else if (o.k === 'title-loop') titleRawReal(g, t, { ...titleO, words: [], loopAt: END - LOOP, push: () => 0 });
      else if (o.k === 'cap') kcap(g, t, { y: o.y || Y, ...o });
      else if (o.k === 'end') endCard2(g, t, { at: o.at, comment: Wd(9, 'Comment'), commentW2: Wd(9, 'below'), follow: Wd(9, 'below') + 0.15, until: o.until, left: 'CRAYON', right: 'RUBBER BAND', next: 'EP. 07', followText: 'FOLLOW: NEW ONE EVERY DAY', rightColor: '#FF7A3D' });
    }
  }

  // ---------------- sound events ----------------
  const sfx = [
    { t: 0.0, n: 'pen_scratch' }, { t: 0.15, n: 'ui_tick' }, { t: tSnap, n: 'whoosh_soft' },
    { t: Wd(2, 'pull'), n: 'ui_tick' }, { t: Wd(2, 'straight'), n: 'metal_click' },
    { t: Wd(3, 'cut'), n: 'ui_tick' }, { t: tCut, n: 'press_thud' }, { t: tCut + 0.02, n: 'metal_tink' }, { t: tCut + 0.55, n: 'plastic_drop' },
    ...BT.map(b => ({ t: b.t0 + 0.05, n: 'ui_tick' })), ...BT.map(b => ({ t: b.t0 + 0.35, n: 'crimp' })), ...BT.map(b => ({ t: b.t0 + b.d - 0.1, n: 'metal_tink' })),
    { t: Ls(7) - 0.1, n: 'low_whoosh' }, { t: Wd(7, 'one'), n: 'glitch' }, { t: mk0, n: 'click_ui' }, { t: mk1, n: 'click_ui' }, { t: mk2, n: 'click_ui' }, { t: Wd(7, 'glue'), n: 'swell' },
    { t: tG0 + 0.1, n: 'plastic_click' }, { t: tGm + 0.05, n: 'metal_click' }, { t: Wd(8, 'grip'), n: 'ui_tick' },
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
