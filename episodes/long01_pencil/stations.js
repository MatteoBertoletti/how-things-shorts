// LONG 01: the EP. 03 3D stations as a reusable library. Every action is anchored on a time set by the episode (setAnchors),
// all other state is a pure function of t. Units mm, y up.
import * as THREE from 'three';
import { clamp, lerp, smooth, E, noise1, hash, W, H } from '../../js/core.js';
import { M, shadowed, factoryFloor, furnaceMouth, pedestal } from '../../js/parts.js';
import { PEN, SLAT, mats, hotMat, makePencil, makeStick, pencilField, slatMesh, slatGeo, sectionGeo, sectionMorph, grooveX, wordStrokes, tex } from '../../js/pencil.js';

export function buildStations(ctx) {
  const { scene } = ctx; const mt = mats();
  let tHook = 1e9, sawT0 = 1e9, tSawHit = 1e9, tWater = 1e9, tSqueeze = 1e9, tKiln = 1e9, tB0 = 1e9, tH0 = 1e9, tGlue = 1e9, tCores = 1e9, tTop = 1e9, tLand = 1e9, tPress = 1e9, tCut = 1e9, tSec = 1e9, tFan = 1e9, tDip = 1e9, tFer = 1e9, tEr = 1e9, tStamp = 1e9;
  const setAnchors = (o) => { if (o.tHook !== undefined) tHook = o.tHook; if (o.sawT0 !== undefined) sawT0 = o.sawT0; if (o.tSawHit !== undefined) tSawHit = o.tSawHit; if (o.tWater !== undefined) tWater = o.tWater; if (o.tSqueeze !== undefined) tSqueeze = o.tSqueeze; if (o.tKiln !== undefined) tKiln = o.tKiln; if (o.tB0 !== undefined) tB0 = o.tB0; if (o.tH0 !== undefined) tH0 = o.tH0; if (o.tGlue !== undefined) tGlue = o.tGlue; if (o.tCores !== undefined) tCores = o.tCores; if (o.tTop !== undefined) tTop = o.tTop; if (o.tLand !== undefined) tLand = o.tLand; if (o.tPress !== undefined) tPress = o.tPress; if (o.tCut !== undefined) tCut = o.tCut; if (o.tSec !== undefined) tSec = o.tSec; if (o.tFan !== undefined) tFan = o.tFan; if (o.tDip !== undefined) tDip = o.tDip; if (o.tFer !== undefined) tFer = o.tFer; if (o.tEr !== undefined) tEr = o.tEr; if (o.tStamp !== undefined) tStamp = o.tStamp; };
  // ---------------- lights ----------------
  const key = new THREE.DirectionalLight(0xE39A52, 2.4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.55, 1, 0.5).normalize();
  const fill = new THREE.DirectionalLight(0x7FB3D9, 1.1); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xBFD9EE, 0.9); scene.add(rim, rim.target);
  const hemi = new THREE.HemisphereLight(0x7FB3D9, 0x2a2018, 0.55); scene.add(hemi);
  const glow = new THREE.PointLight(0xFF5A2B, 0, 0, 1.2); scene.add(glow);
  const acc = new THREE.PointLight(0xFFD23A, 0, 0, 1.4); scene.add(acc);
  const spotG = new THREE.SpotLight(0x2BD67B, 0, 0, 0.42, 0.6, 0), spotR = new THREE.SpotLight(0xFF3B3B, 0, 0, 0.42, 0.6, 0);
  scene.add(spotG, spotG.target, spotR, spotR.target);
  function rig(tgt, size, k = 2.4) {
    key.intensity = k; key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.85, 0.5, -0.4).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.25, 0.6, -1).multiplyScalar(size * 3));
  }
  const pt = (L, p, k, dist, col) => { L.position.copy(p); L.intensity = k; L.distance = dist; if (col !== undefined) L.color.set(col); };

  // ---------------- world ----------------
  const floor = factoryFloor(); scene.add(floor);
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const box = (sx, sy, sz, x, y, z, m = mt.steel, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const cyl = (rt, rb, h, seg, m, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const L = (grp, x, y, z) => v3(x, y, z).applyMatrix4(grp.matrixWorld);
  const station = (x) => { const g = new THREE.Group(); g.position.set(x, 0, 0); scene.add(g); return g; };
  const bench = (parent, w, d, h = 760, col = 0x2a313b) => { const top = box(w, 40, d, 0, h - 20, 0, M.std(col, { roughness: 0.6, metalness: 0.25 }), parent); box(w - 60, h - 40, d - 60, 0, (h - 40) / 2, 0, M.std(0x1a1f26, { roughness: 0.8 }), parent); return h; };
  // instanced particles (flakes / dust), positions set per frame
  function flakes(n, geo, m) { const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; im.castShadow = true; const o = new THREE.Object3D(); return { im, n, set(i, p, r, s) { o.position.copy(p); o.rotation.set(r, r * 1.7, r * 0.6); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }, done(c = n) { im.count = c; im.instanceMatrix.needsUpdate = true; } }; }
  const flakeGeo = new THREE.BoxGeometry(1, 0.25, 0.7);

  // ================= PAY / HOOK: field of pencils + desk paper (x = 12000) =================
  const PAY = station(12000);
  const FN = 34 * 22; const field = pencilField(FN); PAY.add(field.grp);
  { let k = 0; for (let i = 0; i < 34; i++) for (let j = 0; j < 22; j++) { const x = (i - 16.5) * 58 + (hash(k * 3.1) - 0.5) * 10, z = -220 - j * 62 + (hash(k * 1.7) - 0.5) * 10; const ry = hash(k * 5.3) * 6.28; field.set(k++, x, 0, z, ry, 1); } field.done(); }
  const fieldFloor = new THREE.Mesh(new THREE.PlaneGeometry(4200, 3200), M.std(0x1d232c, { roughness: 0.7, metalness: 0.15 })); fieldFloor.rotation.x = -Math.PI / 2; fieldFloor.position.set(0, 1, -700); fieldFloor.receiveShadow = true; PAY.add(fieldFloor);
  // paper sheet (canvas drawn per frame) for the payoff handwriting
  const paperC = document.createElement('canvas'); paperC.width = 2048; paperC.height = 1024; const pg = paperC.getContext('2d');
  const paperT = new THREE.CanvasTexture(paperC); paperT.anisotropy = 8; paperT.colorSpace = THREE.SRGBColorSpace;
  const paperM = new THREE.MeshStandardMaterial({ map: paperT, color: 0xa8a8a8, roughness: 0.92, envMapIntensity: 0.3 });
  const PW = 297, PH = 148.5; const paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), paperM); paper.rotation.x = -Math.PI / 2; paper.position.set(0, 2.5, 60); paper.receiveShadow = true; PAY.add(paper);
  const writer = makePencil(); PAY.add(writer);
  const WS = wordStrokes('GRAPHITE.');
  // stroke path flattened with cumulative length (pen-up moves included, flagged)
  const wPath = (() => { const pts = []; let prev = null; for (const st of WS.strokes) { if (prev) pts.push({ p: st[0], up: true }); st.forEach((q, i) => pts.push({ p: q, up: false, first: i === 0 })); prev = st[st.length - 1]; }
    let acc = 0; pts.forEach((q, i) => { if (i) acc += Math.hypot(q.p[0] - pts[i - 1].p[0], q.p[1] - pts[i - 1].p[1]) * (q.up ? 0.35 : 1); q.s = acc; }); return { pts, len: acc }; })();
  const capH = 38, wx0 = -WS.width * capH / 2, wy0 = -capH / 2;   // mm on the paper (paper local: x right, y = -z up the page)
  function paperDraw(prog, light = false) {
    pg.save(); pg.fillStyle = '#ECE4D3'; pg.fillRect(0, 0, 2048, 1024); pg.drawImage(tex().paper.image, 0, 0, 2048, 1024); pg.globalAlpha = 0.18; pg.strokeStyle = '#7FB3D9'; pg.lineWidth = 3;
    for (let y = 140; y < 1024; y += 120) { pg.beginPath(); pg.moveTo(0, y); pg.lineTo(2048, y); pg.stroke(); } pg.restore();
    const sx = 2048 / PW, sy = 1024 / PH, toC = ([x, y]) => [(wx0 + x * capH + PW / 2) * sx, (PH / 2 - (wy0 + y * capH)) * sy];
    const s = prog * wPath.len; pg.save(); pg.lineCap = 'round'; pg.lineJoin = 'round'; pg.strokeStyle = 'rgba(40,43,50,0.92)'; pg.lineWidth = 15;
    pg.beginPath(); let head = null;
    for (let i = 0; i < wPath.pts.length; i++) { const q = wPath.pts[i]; if (q.s > s) { const a = wPath.pts[i - 1]; const u = (s - a.s) / Math.max(1e-6, q.s - a.s); head = [lerp(a.p[0], q.p[0], u), lerp(a.p[1], q.p[1], u)]; if (!q.up) { const c = toC(head); pg.lineTo(c[0], c[1]); } head.up = q.up; break; }
      const c = toC(q.p); if (q.first || q.up) pg.moveTo(c[0], c[1]); else pg.lineTo(c[0], c[1]); head = q.p.slice(); head.up = false; }
    pg.stroke();
    // graphite grain on the line
    pg.globalCompositeOperation = 'destination-out'; pg.globalAlpha = 0.25; for (let i = 0; i < 900; i++) { pg.fillRect(hash(i * 3.3) * 2048, hash(i * 7.1) * 1024, 3, 3); } pg.restore();
    paperT.needsUpdate = true; return head;
  }
  // hook props: the glove + a cedar chunk (sawdust) / the finished pencil glowing
  const HK = new THREE.Group(); HK.position.set(-260, 470, 380); PAY.add(HK);
  // hero cedar log section (bark + growth rings) floating, then the finished pencil in the same spot (no hands)
  const LOGS = new THREE.Group(); HK.add(LOGS);
  { const r = 44, h = 86; const bk = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, h, 48, 1, true), mt.bark); LOGS.add(bk);
    const top = new THREE.Mesh(new THREE.CircleGeometry(r - 1.5, 48), mt.woodEnd); top.rotation.x = -Math.PI / 2; top.position.y = h / 2; LOGS.add(top);
    const bot = top.clone(); bot.rotation.x = Math.PI / 2; bot.position.y = -h / 2; LOGS.add(bot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 1, 2.2, 6, 48), mt.bark); ring.rotation.x = Math.PI / 2; ring.position.y = h / 2; LOGS.add(ring); shadowed(LOGS); }
  LOGS.position.y = -20;
  const hookPen = makePencil(); hookPen.scale.setScalar(1.12); HK.add(hookPen);
  hookPen.userData.lac.emissive = new THREE.Color(0xFFB000); hookPen.userData.lac.emissiveIntensity = 0;
  const dust = flakes(160, flakeGeo, mt.woodSide); PAY.add(dust.im);
  function hookSet(t) {
    const pen = t >= tHook; LOGS.visible = !pen; hookPen.visible = pen;
    HK.rotation.set(0, 0, 0);
    LOGS.rotation.set(0.38 + 0.03 * Math.sin(t * 1.3), 0.5 + t * 0.35, 0.12 + 0.02 * Math.sin(t * 1.9)); LOGS.position.y = -20 + 4 * Math.sin(t * 2.1);
    const pa = t - tHook, pop = pen ? 1 + 0.18 * Math.exp(-pa * 9) * Math.cos(pa * 30) : 1;
    hookPen.scale.setScalar(1.12 * pop); hookPen.rotation.set(0, 0, 0); hookPen.rotateZ(-0.36); hookPen.rotateY(0.6 + pa * 0.5);
    hookPen.position.copy(v3(0, -PEN.L * 1.12 / 2, 0).applyQuaternion(hookPen.quaternion)).add(v3(0, -18, 0));
    const gk = pen ? clamp(1 - pa / 1.6) : 0; hookPen.userData.lac.emissiveIntensity = 0.12 + 0.55 * gk;
    acc.color.set(0xFFD23A); if (pen) pt(acc, L(HK, 0, 10, 160), 200 + 700 * gk, 900);
    let k = 0;
    if (!pen) for (let i = 0; i < dust.n; i++) { const per = 0.9, ph = hash(i * 1.37) * per, a = ((t + ph) % per); const p0 = v3((hash(i * 2.1) - 0.5) * 50, -62 + (hash(i * 3.3) - 0.5) * 16, (hash(i * 4.7) - 0.5) * 60).add(HK.position);
      dust.set(k++, v3(p0.x + (hash(i * 5.1) - 0.5) * 30 * a, p0.y - 0.5 * 900 * a * a - 40 * a, p0.z + (hash(i * 6.1) - 0.5) * 30 * a), a * 9 + i, 4.5 + 5.0 * hash(i * 9.1)); }
    else if (pa < 0.6) for (let i = 0; i < dust.n; i++) { const th = hash(i * 2.9) * 6.28, ph = (hash(i * 3.7) - 0.4) * 2.2, v = 260 + 420 * hash(i * 1.9), d = v3(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph));
      const c = v3(0, -20, 0).add(HK.position); dust.set(k++, c.addScaledVector(d, v * pa).add(v3(0, -0.5 * 1200 * pa * pa, 0)), pa * 14 + i, (4.0 + 5.0 * hash(i * 9.1)) * (1 - pa / 0.6 * 0.5)); }
    dust.done(k);
  }
  scene.updateMatrixWorld(true);

  // ================= SAW (x = -24000): log, circular saw, slats, planer + groove cutter =================
  const SAW = station(-24000); const BH = bench(SAW, 1600, 700);
  const blade = new THREE.Group(); blade.position.set(0, BH + 30, 0); SAW.add(blade);
  { const disc = new THREE.Mesh(new THREE.CylinderGeometry(230, 230, 3, 64), M.metal(0xB9C1CB, 0.22)); disc.rotation.x = Math.PI / 2; blade.add(disc);
    const tm = M.metal(0x8E969F, 0.3); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; const tt = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 5), tm); tt.position.set(Math.cos(a) * 234, Math.sin(a) * 234, 0); tt.rotation.z = a + 0.4; blade.add(tt); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 12, 32), M.metal(0x4a5058, 0.4)); hub.rotation.x = Math.PI / 2; blade.add(hub); shadowed(blade); }
  box(40, 20, 760, 0, BH - 6, 0, mt.dark, SAW); // slot
  const logR = 120, logL = 900;
  const log = new THREE.Group(); SAW.add(log);
  const logBody = new THREE.Mesh(new THREE.CylinderGeometry(logR, logR * 1.04, logL, 40, 1, true), mt.bark); logBody.rotation.z = Math.PI / 2; log.add(logBody);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(logR - 2, 40), mt.woodEnd); cap.rotation.y = s * Math.PI / 2; cap.position.x = s * logL / 2; log.add(cap); }
  shadowed(log);
  // the slab that comes off (a flat-faced piece), revealed after the blade passes
  const slab = new THREE.Mesh(new THREE.BoxGeometry(logL, 10, logR * 1.5), [mt.woodEnd, mt.woodEnd, mt.woodSide, mt.woodSide, mt.woodEnd, mt.woodEnd]); slab.castShadow = true; SAW.add(slab);
  const sawDust = flakes(160, flakeGeo, mt.woodSide); SAW.add(sawDust.im);
  // the log runs along z into the blade (blade plane = x 0). Cut line at x = 0 through the log at z position
  const sawSlow = (t) => { const k0 = tSawHit - 0.25; return t < k0 ? t : k0 + (t - k0) * 0.4; };  // 40 % slow-motion around the hit
  function sawSet(t) {
    const tau = sawSlow(t), u = (tau - (sawT0 - 0.4)) / 2.0;            // log travel
    const z = lerp(700, -500, clamp(u));
    log.position.set(-(logR - 30), BH + logR, z); log.rotation.set(0, Math.PI / 2, 0);
    blade.rotation.z = -tau * 40;
    // slab: hidden until the blade has passed its front edge, then it tips off sideways
    const passed = clamp((700 - z) / 1200); slab.visible = passed > 0.02;
    slab.position.set(-logL / 2 + 20 - 0.0, BH + logR, z); slab.rotation.set(0, Math.PI / 2, 0); slab.scale.set(passed, 1, 1); slab.position.z = z + logL / 2 * (1 - passed) * 0;
    slab.visible = false;
    // sawdust jet at the contact point
    let k = 0; const cz = 0, contact = z > -logL / 2 - 200 && z < logL / 2 + 100;
    if (contact) for (let i = 0; i < sawDust.n; i++) { const per = 0.5, a = (tau + hash(i * 1.9) * per) % per; const vx = 40 + 260 * hash(i * 2.3), vy = 300 + 500 * hash(i * 3.7), vz = (hash(i * 4.1) - 0.5) * 300;
      sawDust.set(k++, L(SAW, vx * a * (hash(i) > 0.5 ? 1 : -1), BH + logR * 0.4 + vy * a - 0.5 * 1500 * a * a, cz + vz * a + 30), a * 12 + i, 1.6 + 2.6 * hash(i * 8.3)); }
    sawDust.done(k);
  }
  // planer + groove cutter line: the slat travels along +x under a planer roller then the groove cutter gang
  const PL = new THREE.Group(); PL.position.set(1400, 0, 0); SAW.add(PL);
  const PBH = BH; box(1200, 30, 220, 0, PBH - 15 + 0, 0, M.std(0x2a313b, { roughness: 0.6, metalness: 0.25 }), PL);
  const roller = new THREE.Group(); roller.position.set(-200, PBH + SLAT.T + 24, 0); PL.add(roller);
  { const r = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 120, 32), mt.steel); r.rotation.x = Math.PI / 2; roller.add(r); for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(3, 52, 118), M.metal(0xC9CED6, 0.25)); k.rotation.z = i * Math.PI / 4; roller.add(k); } shadowed(roller); }
  const gang = new THREE.Group(); gang.position.set(200, PBH + SLAT.T + 30, 0); PL.add(gang);
  { const ax = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 130, 16), mt.steel); ax.rotation.x = Math.PI / 2; gang.add(ax);
    for (let i = 0; i < SLAT.n; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, SLAT.r * 1.8, 40), M.metal(0xC9CED6, 0.25)); d.rotation.x = Math.PI / 2; d.position.z = -grooveX(i); gang.add(d); }
    for (const z of [-62, 62]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 6, 32), mt.dark); c.rotation.x = Math.PI / 2; c.position.z = z; gang.add(c); } shadowed(gang); }
  const hoodM = M.std(0x313945, { roughness: 0.55, metalness: 0.35 });
  box(70, 60, 150, -200, PBH + SLAT.T + 70, 0, hoodM, PL); box(80, 60, 150, 200, PBH + SLAT.T + 78, 0, hoodM, PL);
  const clipFlat = new THREE.Plane(), clipGroove = new THREE.Plane();
  const sFlat = new THREE.Mesh(slatGeo(false), [mt.woodEnd.clone(), mt.woodSide.clone()]), sGroove = new THREE.Mesh(slatGeo(true), [mt.woodEnd.clone(), mt.woodSide.clone()]);
  sFlat.material.forEach(m => m.clippingPlanes = [clipFlat]); sGroove.material.forEach(m => m.clippingPlanes = [clipGroove]);
  for (const s of [sFlat, sGroove]) { s.castShadow = s.receiveShadow = true; PL.add(s); }
  const chips = flakes(120, flakeGeo, mt.woodSide); PL.add(chips.im);
  function planerSet(t, t0) {
    const x = lerp(-420, 300, clamp((t - t0) / 1.55));
    sFlat.position.set(x, PBH, 0); sGroove.position.set(x, PBH, 0);
    roller.rotation.z = -t * 30; gang.rotation.z = -t * 34;
    PL.updateMatrixWorld(true); const cutX = L(PL, 200, 0, 0).x;
    clipFlat.set(v3(1, 0, 0), -cutX); clipGroove.set(v3(-1, 0, 0), cutX);
    let k = 0; for (let i = 0; i < chips.n; i++) { const per = 0.45, a = (t + hash(i * 1.3) * per) % per; const src = i % 2 ? 200 : -200; if (src === 200 && x + SLAT.L / 2 < 200) continue;
      chips.set(k++, v3(src + 30 + 300 * a * hash(i * 2.2), PBH + SLAT.T + 6 + 260 * a * hash(i * 3.1) - 700 * a * a, (hash(i * 4.4) - 0.5) * 140), a * 14 + i, 1.2 + 1.8 * hash(i * 5.5)); }
    chips.done(k);
  }

  // ================= MIX (x = -18000): core cutaway, piles, mixer, extruder, kiln, paper slider =================
  const MIXG = station(-18000); const MBH = bench(MIXG, 2200, 900, 760, 0x2b323c);
  // cutaway pencil (lying, cut face up) for "the black core?"
  const CUT = new THREE.Group(); CUT.position.set(-700, MBH, 250); MIXG.add(CUT);
  { const R = PEN.R, Lb = 150, rc = PEN.core, g2 = new THREE.Group(); CUT.add(g2);
    const halfHex = (k, notch) => { const s = new THREE.Shape(); s.moveTo(R * k, 0); for (const a of [-60, -120, -180]) s.lineTo(R * k * Math.cos(a * Math.PI / 180), R * k * Math.sin(a * Math.PI / 180));
      if (notch) { s.lineTo(-rc, 0); s.absarc(0, 0, rc, Math.PI, 0, false); } s.closePath(); return s; };
    const mk = (shape, m, y) => { const g = new THREE.ExtrudeGeometry(shape, { depth: Lb, bevelEnabled: false, curveSegments: 16 }); g.rotateY(Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.y = y; g2.add(o); return o; };
    mk(halfHex(1, true), [mt.woodSide, mt.woodSide], 0);
    mk(halfHex(1.045, false), [mt.lacquer, mt.lacquer], -0.06);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(rc, rc, Lb, 20, 1, false, Math.PI, Math.PI), mt.graphite); core.rotation.z = Math.PI / 2; core.position.set(Lb / 2, 0, 0); g2.add(core);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(Lb, rc * 2), mt.graphite); strip.rotation.x = -Math.PI / 2; strip.position.set(Lb / 2, 0.01, 0); g2.add(strip);
    g2.position.y = R * 0.87; shadowed(g2); CUT.userData.len = Lb; }
  // the two piles: graphite (black, metallic sheen) and clay (grey, matte)
  function pileGeo(r, h, seed) { const g = new THREE.LatheGeometry(Array.from({ length: 24 }, (_, i) => { const u = i / 23; return new THREE.Vector2(r * Math.sin(u * Math.PI / 2) * (1.0 + 0.06 * Math.sin(u * 9)), h * Math.pow(Math.cos(u * Math.PI / 2), 1.3)); }).reverse(), 64);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = (noise1(x * 0.05 + seed) + noise1(z * 0.05 - seed)) * 3 * (y / h) * (1 - y / h) * 4; p.setXYZ(i, x * (1 + n * 0.01), y + n, z * (1 + n * 0.01)); } g.computeVertexNormals(); return g; }
  const PILES = new THREE.Group(); PILES.position.set(200, MBH, 120); MIXG.add(PILES);
  const pGraph = new THREE.Mesh(pileGeo(150, 120, 1), mt.powder), pClay = new THREE.Mesh(pileGeo(150, 112, 7), mt.clay);
  pGraph.position.set(-170, 0, 0); pClay.position.set(170, 0, 0); for (const p of [pGraph, pClay]) { p.castShadow = p.receiveShadow = true; PILES.add(p); }
  const tray = new THREE.Mesh(new THREE.BoxGeometry(760, 8, 380), M.std(0x39424e, { roughness: 0.5, metalness: 0.5 })); tray.position.y = -4; tray.receiveShadow = true; PILES.add(tray);
  const grains = flakes(220, new THREE.SphereGeometry(1, 6, 4), mt.powder), grainsC = flakes(220, new THREE.SphereGeometry(1, 6, 4), mt.clay); PILES.add(grains.im, grainsC.im);
  function pilesSet(t) {
    let k = 0, kc = 0;
    for (let i = 0; i < 220; i++) { const per = 0.8, a = (t + hash(i * 1.1) * per) % per, x = (hash(i * 2.7) - 0.5) * 16, z = (hash(i * 3.9) - 0.5) * 16, y = 420 - 0.5 * 1600 * a * a;
      if (y > 112) { grains.set(k++, v3(-170 + x, y + 8, z), i, 1.2 + hash(i) * 1.4); grainsC.set(kc++, v3(170 + x, y, z), i, 1.4 + hash(i * 7) * 1.6); } }
    grains.done(k); grainsC.done(kc);
  }
  // mixer: drum + paste + paddles + water stream
  const MXR = new THREE.Group(); MXR.position.set(900, MBH, 60); MIXG.add(MXR);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(200, 190, 220, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a939e, metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide })); drum.position.y = 110; MXR.add(drum);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(200, 6, 8, 64), M.metal(0xA9B1BB, 0.3)); lip.rotation.x = Math.PI / 2; lip.position.y = 220; MXR.add(lip);
  const pasteM = mt.paste.clone(); const paste = new THREE.Mesh(new THREE.CircleGeometry(196, 64), pasteM); paste.rotation.x = -Math.PI / 2; paste.position.y = 150; MXR.add(paste);
  const paddles = new THREE.Group(); paddles.position.y = 150; MXR.add(paddles);
  for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(new THREE.BoxGeometry(180, 50, 10), mt.steel); a.position.x = 90; const h = new THREE.Group(); h.rotation.y = i * Math.PI * 2 / 3; h.add(a); paddles.add(h); }
  const shaft = cyl(10, 10, 240, 16, mt.steel, MXR, 0, 250, 0);
  const swirl = []; for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(40 + i * 30, 3.5, 6, 48, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: 0x5b5f68, metalness: 0.5, roughness: 0.35 })); r.rotation.x = -Math.PI / 2; r.position.y = 151; swirl.push(r); MXR.add(r); }
  const waterM = new THREE.MeshPhysicalMaterial({ color: 0x9fd0f0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2 });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 1, 20, 1, true), waterM); MXR.add(stream);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 260, 20), mt.steel); pipe.rotation.z = Math.PI / 2; pipe.position.set(-60, 520, 0); MXR.add(pipe); shadowed(MXR);
  const splash = flakes(60, new THREE.SphereGeometry(1, 8, 6), waterM); MXR.add(splash.im);
  function mixerSet(t) {
    paddles.rotation.y = t * 3.2; swirl.forEach((r, i) => r.rotation.z = t * (1.4 + i * 0.3) + i);
    const on = clamp((t - tWater) / 0.15); stream.visible = on > 0.01;
    const top = 520 - 16, bot = 150; const len = (top - bot) * on; stream.scale.set(1, len, 1); stream.position.set(70, top - len / 2, 0);
    let k = 0; if (on >= 1) for (let i = 0; i < 60; i++) { const per = 0.35, a = (t + hash(i * 2.2) * per) % per; const an = hash(i * 3.3) * 6.28, v = 120 + 160 * hash(i * 4.4);
      splash.set(k++, v3(70 + Math.cos(an) * v * a, bot + 5 + 300 * a - 0.5 * 2600 * a * a, Math.sin(an) * v * a), i, 2 + 2 * hash(i)); } splash.done(k);
    pasteM.color.setHex(0x45484f).lerp(new THREE.Color(0x5a5e66), on * 0.5 * (0.5 + 0.5 * Math.sin(t * 4)));
  }
  // extruder: die block + strands squeezed out along +x
  const EXT = new THREE.Group(); EXT.position.set(-1150, MBH, -200); MIXG.add(EXT);
  box(160, 180, 200, -80, 90, 0, M.std(0x4b5562, { roughness: 0.4, metalness: 0.6 }), EXT);
  const dieP = cyl(70, 70, 24, 40, M.metal(0xB5BDC7, 0.25), EXT, 12, 100, 0); dieP.rotation.z = Math.PI / 2;
  const NS = 6, strands = []; for (let i = 0; i < NS; i++) { const a = i / NS * Math.PI * 2, y = 100 + Math.sin(a) * 34, z = Math.cos(a) * 34;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1, 16), mt.graphite); s.rotation.z = Math.PI / 2; s.castShadow = true; EXT.add(s); strands.push({ s, y, z });
    const hole = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20), M.std(0x0b0c0e)); hole.rotation.y = Math.PI / 2; hole.position.set(24.2, y, z); EXT.add(hole); }
  const support = box(760, 6, 160, 420, 30, 0, M.std(0x39424e, { roughness: 0.5, metalness: 0.5 }), EXT);
  function extSet(t) { const len = clamp((t - tSqueeze + 0.4) / 1.8) * 740; strands.forEach(({ s, y, z }, i) => { const sag = Math.min(len, 220) / 220; s.scale.set(1, Math.max(0.01, len), 1); s.position.set(24 + len / 2, y - sag * (y - 40) * clamp(len / 740) * 0.0, z); s.visible = len > 1; }); }
  // kiln (furnaceMouth, small and redder) + tray of cores sliding in
  const KIL = new THREE.Group(); KIL.position.set(-2900, 0, -900); MIXG.add(KIL);
  const kilnFloor = hotMat(0x2a1a16); kilnFloor.userData.u.uK.value = 0.5;
  const kiln = furnaceMouth({ w: 1100, h: 760, d: 1300, mw: 620, mh: 300, meltY: 260, meltMat: kilnFloor }); KIL.add(kiln);
  const rodM = hotMat(0x2c3038); const rods = [];
  const KTRAY = new THREE.Group(); KIL.add(KTRAY);
  box(420, 8, 300, 0, 0, 0, M.std(0x3a3f47, { roughness: 0.5, metalness: 0.6 }), KTRAY);
  for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(PEN.core * 1.6, PEN.core * 1.6, 380, 12), rodM); r.rotation.z = Math.PI / 2; r.position.set(0, 7, -130 + i * 20); r.castShadow = true; KTRAY.add(r); rods.push(r); }
  function kilnSet(t) { const u = clamp((t - (tKiln - 0.5)) / 1.4); KTRAY.position.set(0, 272, lerp(1100, 200, E.io(u))); const heat = clamp((t - tKiln) / 1.6); rodM.userData.u.uK.value = 0.15 + 0.6 * heat; kilnFloor.userData.u.uK.value = 0.4 + 0.06 * Math.sin(t * 3); }
  // paper station for the H <-> B mini-graphic (two lines drawn by two pencils)
  const PAP = new THREE.Group(); PAP.position.set(1800, MBH + 1, 0); MIXG.add(PAP);
  const hbC = document.createElement('canvas'); hbC.width = 2048; hbC.height = 1024; const hg = hbC.getContext('2d'); const hbT = new THREE.CanvasTexture(hbC); hbT.colorSpace = THREE.SRGBColorSpace; hbT.anisotropy = 8;
  const hbPaper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: hbT, color: 0xa8a8a8, roughness: 0.92, envMapIntensity: 0.3 })); hbPaper.rotation.x = -Math.PI / 2; hbPaper.receiveShadow = true; PAP.add(hbPaper);
  const penB = makePencil(), penH = makePencil(); PAP.add(penB, penH);
  const lineY = { B: 22, H: -26 };   // paper local (mm from centre, towards the top of the page)
  function wave(u) { return Math.sin(u * 9) * 9 + Math.sin(u * 23) * 2; }
  function hbSet(t) {
    hg.fillStyle = '#ECE4D3'; hg.fillRect(0, 0, 2048, 1024); hg.drawImage(tex().paper.image, 0, 0, 2048, 1024);
    const toC = (x, y) => [(x + PW / 2) * 2048 / PW, (PH / 2 - y) * 1024 / PH];
    const draw = (prog, y0, col, w) => { hg.save(); hg.strokeStyle = col; hg.lineWidth = w; hg.lineCap = 'round'; hg.beginPath(); const n = 160; for (let i = 0; i <= n * prog; i++) { const u = i / n, x = -120 + 240 * u; const [cx, cy] = toC(x, y0 + wave(u)); i ? hg.lineTo(cx, cy) : hg.moveTo(cx, cy); } hg.stroke();
      hg.globalCompositeOperation = 'destination-out'; hg.globalAlpha = 0.3; for (let i = 0; i < 1400; i++) hg.fillRect(hash(i * 3.1 + w) * 2048, hash(i * 5.7 + w) * 1024, 3, 3); hg.restore(); };
    const pB = clamp((t - tB0) / 1.3), pH = clamp((t - tH0) / 1.3);
    draw(pB, lineY.B, 'rgba(20,22,26,0.96)', 30); draw(pH, lineY.H, 'rgba(120,126,136,0.75)', 11); hbT.needsUpdate = true;
    const place = (pen, prog, y0, side) => { const u = prog, x = -120 + 240 * u, y = y0 + wave(u); pen.position.set(x, 0, -y); pen.rotation.set(0, 0, 0); pen.rotateY(-0.5 * side); pen.rotateX(-0.75); pen.rotateZ(-0.35);
      pen.position.y += 0 + (prog <= 0 || prog >= 1 ? 6 : 0); };
    place(penB, pB, lineY.B, 1); place(penH, pH, lineY.H, 1);
  }

  // ================= SANDWICH (x = -9000): glue, cores, top slat, press, exploded cross-section =================
  const SAN = station(-9000); const SBH = bench(SAN, 900, 600, 760, 0x2b323c);
  const SW = new THREE.Group(); SW.position.set(0, SBH, 0); SAN.add(SW);
  const base = slatMesh(true); SW.add(base);
  const topS = slatMesh(true); topS.rotation.x = Math.PI; SW.add(topS);   // flipped: grooves face down
  const glueLines = [], coresM = [];
  for (let i = 0; i < SLAT.n; i++) {
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, SLAT.L, 10), mt.glue); gl.rotation.z = Math.PI / 2; gl.position.set(0, SLAT.T - SLAT.r * 0.6, -grooveX(i)); gl.castShadow = true; SW.add(gl); glueLines.push(gl);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(PEN.core, PEN.core, SLAT.L - 2, 16), mt.graphite); c.rotation.z = Math.PI / 2; c.castShadow = true; SW.add(c); coresM.push(c);
  }
  const nozzle = new THREE.Group(); SW.add(nozzle); { const n1 = cyl(14, 4, 40, 20, M.metal(0xC9CED6, 0.3), nozzle, 0, 20, 0); const n2 = cyl(22, 22, 70, 20, mt.dark, nozzle, 0, 75, 0); }
  const platenT = box(260, 40, 140, 0, 0, 0, M.metal(0x7a848f, 0.35), SW), platenB = box(260, 20, 140, 0, -10, 0, M.metal(0x7a848f, 0.35), SW);
  const ram = cyl(18, 18, 400, 20, mt.steel, SW, 0, 0, 0);
  const pressSlow = (t) => { const k0 = tPress - 0.05; return t < k0 ? t : k0 + (t - k0) * 0.4; };
  function sandwichSet(t, { explode = 0, press = true } = {}) {
    // glue: nozzle runs along the grooves, beads grow behind it
    const gu = clamp((t - tGlue) / 0.7); nozzle.visible = gu > 0 && gu < 1; const gx = lerp(-SLAT.L / 2, SLAT.L / 2, gu);
    nozzle.position.set(gx, SLAT.T + 6, 0);
    glueLines.forEach(gl => { gl.visible = gu > 0; gl.scale.set(1, Math.max(0.001, gu), 1); gl.position.x = -SLAT.L / 2 + SLAT.L * gu / 2; });
    // cores drop one by one into the grooves
    coresM.forEach((c, i) => { const td = tCores + i * 0.09, a = t - td; const y0 = SLAT.T + 70, y1 = SLAT.T; const fall = a <= 0 ? 0 : Math.min(1, 0.5 * 2600 * a * a / (y0 - y1));
      const bounce = a > 0 && fall >= 1 ? Math.abs(Math.sin((a - Math.sqrt(2 * (y0 - y1) / 2600)) * 18)) * 3 * Math.exp(-(a) * 9) : 0;
      c.visible = a > -0.4; c.position.set(0, lerp(y0, y1, fall) + bounce, -grooveX(i)); });
    // top slat lands
    const tu = clamp((t - tTop) / Math.max(0.2, tLand - tTop)); const ty = lerp(SLAT.T * 2 + 120, SLAT.T * 2, E.i(tu)) + explode * 14;
    topS.visible = t > tTop - 0.3; topS.position.set(0, ty, 0);
    base.position.set(0, 0, 0); 
    // press
    const pu = press ? clamp((pressSlow(t) - tPress) / 0.45) : 0, close = E.i(pu);
    platenT.visible = platenB.visible = ram.visible = press && t > tLand - 0.2;
    platenT.position.set(0, SLAT.T * 2 + 20 + lerp(160, 0, close), 0); ram.position.set(0, platenT.position.y + 220, 0);
    platenB.position.set(0, -10, 0);
    topS.position.y = Math.min(ty, platenT.position.y - 20 + 0);
  }

  // ================= SHAPE (x = -3000): cutter heads, square -> hexagon section, fan =================
  const SHP = station(-3000); const HBH = bench(SHP, 900, 600, 760, 0x2b323c);
  const CUTR = new THREE.Group(); CUTR.position.set(0, HBH, 0); SHP.add(CUTR);
  const block = new THREE.Group(); CUTR.add(block);
  { const b1 = slatMesh(false), b2 = slatMesh(false); b2.position.y = SLAT.T; block.add(b1, b2); }
  const clipB = new THREE.Plane(), clipS = new THREE.Plane();
  block.traverse(o => { if (o.isMesh) { o.material = o.material.map(m => { const c = m.clone(); c.clippingPlanes = [clipB]; return c; }); } });
  const sticks = []; for (let i = 0; i < SLAT.n; i++) { const s = makeStick(SLAT.L); s.rotation.z = Math.PI / 2; s.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = [clipS]; } }); CUTR.add(s); sticks.push(s); }
  const heads = []; for (const sgn of [1, -1]) { const h = new THREE.Group(); h.position.set(0, SLAT.T + sgn * (SLAT.T + 30), 0); CUTR.add(h); heads.push(h);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 90, 40), mt.steel); core.rotation.x = Math.PI / 2; h.add(core);
    for (let i = 0; i < SLAT.n; i++) for (let k = 0; k < 6; k++) { const tth = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 6), M.metal(0xD0D6DE, 0.2)); const a = k / 6 * Math.PI * 2; tth.position.set(Math.cos(a) * 28, Math.sin(a) * 28, -grooveX(i)); tth.rotation.z = a; h.add(tth); }
    shadowed(h); }
  const shpChips = flakes(160, flakeGeo, mt.woodSide); CUTR.add(shpChips.im);
  const cutSlow = (t) => { const k0 = tCut + 0.2; return t < k0 ? t : k0 + (t - k0) * 0.4; };
  function cutterSet(t) {
    const tau = cutSlow(t), x = lerp(-SLAT.L / 2 - 40, SLAT.L / 2 + 20, clamp((tau - tCut) / 1.1));   // the block passes the cutter at x = 0
    block.position.set(-x, 0, 0); heads.forEach((h, i) => h.rotation.z = (i ? 1 : -1) * tau * 26);
    CUTR.updateMatrixWorld(true); const cx = L(CUTR, 0, 0, 0).x;
    clipB.set(v3(1, 0, 0), -cx); clipS.set(v3(-1, 0, 0), cx);
    sticks.forEach((s, i) => { s.position.set(-x, SLAT.T, -grooveX(i) * 1.0); s.rotation.set(0, 0, Math.PI / 2); });
    let k = 0; for (let i = 0; i < shpChips.n; i++) { const per = 0.4, a = (tau + hash(i * 1.7) * per) % per, s = i % 2 ? 1 : -1;
      shpChips.set(k++, v3(-20 - 260 * a * hash(i * 2.9), SLAT.T + s * (34 + 300 * a * hash(i * 3.3)) - 900 * a * a, (hash(i * 4.9) - 0.5) * 120), a * 16 + i, 1.0 + 1.8 * hash(i * 6.1)); }
    shpChips.done(k);
  }
  // section morph (end view)
  const SEC = new THREE.Group(); SEC.position.set(900, HBH + 60, 0); SHP.add(SEC);
  const SM = sectionMorph(); const secMesh = new THREE.Mesh(SM.geo, [mt.woodEnd, mt.woodSide]); secMesh.castShadow = true; SEC.add(secMesh);
  const secCore = new THREE.Mesh(new THREE.CylinderGeometry(PEN.core, PEN.core, 8.2, 24), mt.graphite); secCore.rotation.x = Math.PI / 2; SEC.add(secCore);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 8.3), mt.glue); SEC.add(seam);
  const ghost = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + Math.PI / 2; return v3(Math.cos(a) * PEN.R, Math.sin(a) * PEN.R, 4.3); })), new THREE.LineBasicMaterial({ color: 0xFFD23A })); SEC.add(ghost);
  let secU = -1;
  function secSet(t) { const u = E.io(clamp((t - tSec - 0.12) / 0.85)); if (Math.abs(u - secU) > 1e-4) { SM.set(u); secU = u; }
    seam.scale.x = lerp(SLAT.pitch, PEN.R * 1.732, u); SEC.rotation.set(0.1 * Math.sin(t), -0.25 + 0.15 * Math.sin(t * 0.8), 0); ghost.material.opacity = 1; ghost.visible = u < 0.98; }
  // fan of 8 sticks
  const FANG = new THREE.Group(); FANG.position.set(1800, HBH, 0); SHP.add(FANG);
  const fan = []; for (let i = 0; i < SLAT.n; i++) { const s = makeStick(SLAT.L); FANG.add(s); fan.push(s); }
  function fanSet(t) { const u = E.o(clamp((t - tFan) / 0.9)); fan.forEach((s, i) => { const k = i - (SLAT.n - 1) / 2; const a = k * 0.16 * u; s.rotation.set(0, a, Math.PI / 2); s.position.set(SLAT.L / 2 * Math.cos(a) - 30, PEN.R * 0.87 + Math.max(0, 1 - u) * 0, -k * SLAT.pitch * (1 - u) + SLAT.L / 2 * Math.sin(a) * -1); }); }

  // ================= FINISH (x = 3000): paint dip, ferrule crimp, eraser, HB stamp =================
  const FIN = station(3000); const FBH = bench(FIN, 1300, 700, 760, 0x2b323c);
  const TANK = new THREE.Group(); TANK.position.set(-300, FBH, 0); FIN.add(TANK);
  { const tm = M.std(0x3d4652, { roughness: 0.4, metalness: 0.6 }); box(140, 160, 10, 0, 80, 65, tm, TANK); box(140, 160, 10, 0, 80, -65, tm, TANK); box(10, 160, 140, 65, 80, 0, tm, TANK); box(10, 160, 140, -65, 80, 0, tm, TANK); box(140, 6, 140, 0, 3, 0, tm, TANK); }
  const paintM = new THREE.MeshPhysicalMaterial({ color: 0xF2B814, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  const paintS = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 60, 60), paintM); paintS.rotation.x = -Math.PI / 2; paintS.position.y = 130; paintS.receiveShadow = true; TANK.add(paintS);
  const dipStick = makeStick(PEN.body); TANK.add(dipStick);
  const coatM = mt.lacquer.clone(); const coat = new THREE.Mesh(new THREE.CylinderGeometry(PEN.R + 0.12, PEN.R + 0.12, PEN.body, 6), coatM); coat.castShadow = true; dipStick.add(coat);
  const coatClip = new THREE.Plane(); coatM.clippingPlanes = [coatClip];
  const drip = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), paintM); TANK.add(drip);
  const dipSlow = (t) => { const k0 = tDip + 0.15; return t < k0 ? t : k0 + (t - k0) * 0.45; };
  function dipSet(t) {
    const tau = dipSlow(t), a = tau - tDip, dur = 1.0, u = clamp(a / dur);
    const depth = 120 * Math.sin(Math.PI * u);              // in and out
    const tipY = 130 + 30 - depth;                          // the lower end of the stick
    dipStick.position.set(0, tipY + PEN.body / 2, 0); dipStick.rotation.set(0, 0.4 + a * 0.5, 0);
    TANK.updateMatrixWorld(true);
    const maxD = 120 * (u < 0.5 ? Math.sin(Math.PI * u) : 1);   // coated up to the deepest point reached
    const coatTop = L(TANK, 0, 160 - maxD + 130 - 130 + maxD - maxD, 0).y;   // world y of (bottom + maxD)
    const bottomW = L(TANK, 0, tipY, 0).y; coatClip.set(v3(0, -1, 0), bottomW + maxD + 0.0001 + (u > 0 ? 0 : -1e4));
    coat.visible = maxD > 1;
    // ripples
    const p = paintS.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y); p.setZ(i, (u > 0 && u < 1 ? 1.4 : 0.4) * Math.sin(r * 0.28 - tau * 14) * Math.exp(-r * 0.03)); } p.needsUpdate = true; paintS.geometry.computeVertexNormals();
    const da = a - dur * 0.85; drip.visible = da > 0; drip.position.set(0, bottomW - 2 - 0.5 * 1500 * da * da - L(TANK, 0, 0, 0).y, 0); drip.scale.set(1, 1.5, 1);
  }
  // ferrule + eraser + stamp station: a finished-body pencil lying along x
  const ASM = new THREE.Group(); ASM.position.set(400, FBH + 40, 0); FIN.add(ASM);
  const asmPen = makePencil(); asmPen.rotation.z = -Math.PI / 2; ASM.add(asmPen);   // tip to -x... rotation: +y -> +x
  const { parts: AP } = asmPen.userData;
  const jawM = M.std(0x3f4750, { roughness: 0.5, metalness: 0.6 }); const jaws = [box(30, 20, 30, 0, 0, 0, jawM, ASM), box(30, 20, 30, 0, 0, 0, jawM, ASM)];
  const stampHead = new THREE.Group(); ASM.add(stampHead); box(24, 10, 12, 0, 5, 0, M.std(0x3a4350, { roughness: 0.4, metalness: 0.6 }), stampHead); box(12, 300, 8, 0, 160, 0, mt.steel, stampHead);
  const xFerC = PEN.cone + PEN.body + PEN.fer / 2;   // along the pencil (local y) -> world +x after rotation
  function asmSet(t) {
    const fu = E.io(clamp((t - tFer) / 0.35)), cr = clamp((t - tFer - 0.4) / 0.12), eu = E.io(clamp((t - tEr) / 0.35)), su = t - tStamp;
    AP.fer.position.y = lerp(60, 0, fu); AP.rings.forEach(r => { r.visible = cr > 0.5; r.position.x = 0; });
    AP.rings.forEach((r, i) => r.position.y = PEN.cone + PEN.body + PEN.fer / 2 + (i - 1) * 3.5 + lerp(60, 0, fu));
    AP.er.position.y = lerp(80, 0, eu); AP.erTop.position.y = AP.er.position.y; AP.er.visible = AP.erTop.visible = t > tEr - 0.3;
    const jx = xFerC; const jOpen = cr < 1 ? lerp(26, 6, Math.sin(Math.PI * clamp(cr * 1.0)) ) : 26;
    jaws[0].position.set(jx, jOpen, 0); jaws[1].position.set(jx, -jOpen, 0); jaws.forEach(j => j.visible = t < tEr);
    // stamp: head comes down onto the top face, HB appears
    const sp = su < 0 ? 0 : su < 0.08 ? su / 0.08 : su < 0.2 ? 1 : 1 - (su - 0.2) / 0.25;
    stampHead.position.set(PEN.cone + PEN.body - 26, PEN.R + lerp(45, 0, clamp(sp)), 0); stampHead.visible = t > tStamp - 0.2 && su < 0.5;
    asmPen.userData.setStamp(su > 0.06 ? 1 : 0);
    asmPen.rotation.set(0, 0, -Math.PI / 2); asmPen.rotateY(su > 0.06 ? 0 : 0);
  }

  scene.updateMatrixWorld(true);
  return { setAnchors, key, fill, rim, hemi, glow, acc, spotG, spotR, rig, pt, v3, L, box, cyl, station, bench, flakes, flakeGeo, mt, floor, PAY, field, fieldFloor, paper, paperM, paperDraw, writer, HK, LOGS, hookPen, dust, hookSet, SAW, BH, blade, log, logR, sawDust, sawSet, sawSlow, PL, roller, gang, planerSet, sFlat, sGroove, chips, MIXG, MBH, CUT, PILES, pGraph, pClay, pilesSet, MXR, mixerSet, EXT, extSet, strands, KIL, KTRAY, kilnSet, rodM, kilnFloor, PAP, hbSet, penB, penH, hbPaper, SAN, SW, sandwichSet, pressSlow, base, topS, coresM, glueLines, nozzle, platenT, platenB, ram, SHP, CUTR, cutterSet, cutSlow, block, sticks, SEC, secSet, secMesh, seam, FANG, fanSet, fan, heads, FIN, TANK, dipSet, dipSlow, dipStick, ASM, asmSet, asmPen, xFerC, AP, stampHead, jaws };
}
