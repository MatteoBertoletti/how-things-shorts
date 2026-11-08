// EP. 02 — the glass bottle, from sand to bottle. Every state is a pure function of t.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { clamp, lerp, smooth, track, E, noise1, hash, W, H } from '../../js/core.js';
import { M, shadowed, conveyor, pedestal, factoryFloor, hopper, furnaceMouth, forehearth, shearBlades, mould, invertArm, lehrBelt, hand, gummyBear, pencil } from '../../js/parts.js';
import { glassMat, GlassBody, gobProfile, parisonProfile, bottleProfile, lerpProfile, bottleGeometry, moltenMat, rampJS } from '../../js/glass.js';
import { hud, caption, sticker, endCard, flash, stamp, setAccent, C } from '../../js/overlay.js';
import { simBodies, sample } from '../../js/physics.js';

export const EP = 'EP. 02';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#FFB62E');
  ctx.bloom.threshold = 0.6; ctx.bloom.strength = 0.5;
  scene.background = new THREE.Color(0x0F1A21);
  scene.environmentIntensity = 0.55;

  // ---------------- timing ----------------
  const lines = timing.lines;
  const Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const Wd = (i, w, n = 0) => { const L = lines[i - 1]; const hits = L.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return L.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const END = Le(12) + (script.tail || 2.2);
  const LOOP = 0.34;

  // ---------------- lights ----------------
  const key = new THREE.DirectionalLight(0xFF9A4A, 2.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.5, 1, 0.45).normalize();
  const fill = new THREE.DirectionalLight(0x6FD0E6, 1.25); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xa8e6f2, 0.7); scene.add(rim, rim.target);
  const hemi = new THREE.HemisphereLight(0x6FD0E6, 0x1b2228, 0.4); scene.add(hemi);
  const glow = new THREE.PointLight(0xFF8A2B, 0, 0, 1.0); scene.add(glow);
  const spotG = new THREE.SpotLight(0x2BD67B, 0, 0, 0.42, 0.6, 0), spotR = new THREE.SpotLight(0xFF3B3B, 0, 0, 0.42, 0.6, 0);
  scene.add(spotG, spotG.target, spotR, spotR.target);
  function rig(tgt, size) {
    key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.8, 0.55, -0.5).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.2, 0.5, -1).multiplyScalar(size * 3));
  }
  const glowAt = (p, k, dist) => { glow.position.copy(p); glow.intensity = k; glow.distance = dist; };

  // ---------------- world ----------------
  scene.add(factoryFloor());
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const steelM = M.std(0x3a4652, { roughness: 0.55, metalness: 0.4 });
  const box = (sx, sy, sz, x, y, z, m = steelM, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };

  // ---- glass helpers ----
  const BG = bottleGeometry();
  function bottleRow(n) {
    const aT = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(20), 1);
    const g = BG.clone(); g.setAttribute('aT', aT);
    const back = new THREE.InstancedMesh(g, glassMat({ side: THREE.BackSide, instanced: true }), n); back.renderOrder = 1;
    const front = new THREE.InstancedMesh(g, glassMat({ side: THREE.FrontSide, instanced: true }), n); front.renderOrder = 2;
    for (const m of [back, front]) { m.frustumCulled = false; m.castShadow = false; }
    const grp = new THREE.Group(); grp.add(back, front);
    const o = new THREE.Object3D();
    return { grp, n, aT, set(i, x, y, z, T = 20, s = 1, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(0, ry, rz); o.scale.setScalar(s); o.updateMatrix(); back.setMatrixAt(i, o.matrix); front.setMatrixAt(i, o.matrix); aT.array[i] = T; },
      done(count = n) { back.count = front.count = count; back.instanceMatrix.needsUpdate = front.instanceMatrix.needsUpdate = true; aT.needsUpdate = true; } };
  }
  // shard geometry (cullet)
  const shardGeo = (() => { const p = []; for (let i = 0; i < 9; i++) p.push(new THREE.Vector3((hash(i) - 0.5) * 2, (hash(i + 20) - 0.5) * 0.6, (hash(i + 40) - 0.5) * 1.6)); return new ConvexGeometry(p); })();
  function shardSet(n, tint = 0x9ADBC0, alpha = 0.5) {
    const aT = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(20), 1);
    const g = shardGeo.clone(); g.setAttribute('aT', aT);
    const mk = (side, ro) => { const m = new THREE.InstancedMesh(g, glassMat({ side, instanced: true, tint, alpha }), n); m.renderOrder = ro; m.frustumCulled = false; return m; };
    const back = mk(THREE.BackSide, 1), front = mk(THREE.FrontSide, 2); const grp = new THREE.Group(); grp.add(back, front);
    const o = new THREE.Object3D();
    return { grp, set(i, p, q, sc) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); o.updateMatrix(); back.setMatrixAt(i, o.matrix); front.setMatrixAt(i, o.matrix); },
      done() { back.instanceMatrix.needsUpdate = front.instanceMatrix.needsUpdate = true; } };
  }

  // ================= STATION A: batch hopper (x = -14000) =================
  const HOP = new THREE.Group(); HOP.position.set(-14000, 300, 0); scene.add(HOP);
  const hop = hopper(900, 420, 560, 160); HOP.add(hop);
  const HT = hop.userData.funTop; // pile base height (local)
  box(1200, 300, 1200, 0, -150, 0, steelM, HOP);
  const pileM = M.std(0xd9c39a, { roughness: 0.95 });
  const pile = new THREE.Mesh(new THREE.ConeGeometry(420, 1, 40, 1), pileM); pile.receiveShadow = pile.castShadow = true; HOP.add(pile);
  // chutes above the hopper (sand, soda ash, limestone) + a cullet chute
  const chutes = [{ p: v3(-230, 1700, -120), c: 0xD8B98A }, { p: v3(160, 1760, -200), c: 0xF2F0EA }, { p: v3(20, 1680, 230), c: 0xA9A49A }];
  const chuteM = M.metal(0x7d8791, 0.45);
  for (const ch of chutes) { const tube = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 900, 20, 1, true), chuteM); tube.material.side = THREE.DoubleSide; tube.position.copy(ch.p).add(v3(0, 450, 0)); HOP.add(tube); }
  const cul = new THREE.Mesh(new THREE.BoxGeometry(900, 20, 260), chuteM); cul.position.set(780, 1440, 0); cul.rotation.z = 0.32; cul.castShadow = true; HOP.add(cul);
  const NP = 420, gs = new THREE.SphereGeometry(1, 6, 4);
  const streams = chutes.map(ch => { const m = new THREE.InstancedMesh(gs, M.std(ch.c, { roughness: 0.9 }), NP); m.frustumCulled = false; m.castShadow = true; HOP.add(m); return m; });
  const pileTop = t => HT + 10 + 200 * E.o(clamp((t - Ls(2)) / 4.4));
  // cullet physics (pre-simulated once)
  const NS = 46;
  const culSim = simBodies({
    bodies: Array.from({ length: NS }, (_, i) => ({ half: [10 + hash(i) * 12, 3 + hash(i + 3) * 3, 8 + hash(i + 5) * 10], pos: [330 + hash(i + 9) * 40, 1290 + hash(i + 11) * 30, (hash(i + 13) - 0.5) * 180], vel: [-320 - hash(i + 15) * 300, 120, (hash(i + 17) - 0.5) * 200], spin: [(hash(i + 19) - 0.5) * 20, (hash(i + 21) - 0.5) * 20, (hash(i + 23) - 0.5) * 20], at: i * 0.035, rot: [hash(i + 25) * 6, hash(i + 27) * 6, hash(i + 29) * 6] })),
    statics: [{ half: [460, 20, 460], pos: [0, HT + 196, 0] }, { half: [10, 400, 460], pos: [-450, HT + 400, 0] }, { half: [10, 400, 460], pos: [450, HT + 400, 0] }, { half: [460, 400, 10], pos: [0, HT + 400, -450] }, { half: [460, 400, 10], pos: [0, HT + 400, 450] }],
    dur: 3.2, restitution: 0.25,
  });
  const culShards = shardSet(NS, 0x2f8f63, 0.8); HOP.add(culShards.grp);
  const culScale = Array.from({ length: NS }, (_, i) => v3(10 + hash(i) * 12, 3 + hash(i + 3) * 3, 8 + hash(i + 5) * 10));

  // ================= STATION B: furnace (x = -9000) =================
  const FUR = new THREE.Group(); FUR.position.set(-9000, 0, 0); scene.add(FUR);
  const melt = moltenMat({ T: 1560, scale: 0.0024, speed: [0, -0.18], bright: 0.75 });
  const fur = furnaceMouth({ meltMat: melt }); FUR.add(fur);
  const MZ = fur.userData.mouthZ, MY = fur.userData.meltY;
  const fbelt = conveyor(1800, 640); fbelt.position.set(0, MY + 30, MZ + 900); FUR.add(fbelt);
  const batchM = M.std(0xcdb48a, { roughness: 0.95 });
  const NB = 14; const batchIM = new THREE.InstancedMesh(new THREE.ConeGeometry(120, 90, 7), batchM, NB); batchIM.castShadow = true; batchIM.frustumCulled = false; FUR.add(batchIM);
  const islandIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 9), M.std(0xd8c39c, { roughness: 0.95 }), 16); islandIM.frustumCulled = false; FUR.add(islandIM);
  const charger = box(600, 160, 60, 0, MY + 110, MZ + 200, M.std(0x2c343c, { metalness: 0.5, roughness: 0.4 }), FUR);

  // ================= STATION C: forehearth + feeder + shears (x = -4000) =================
  const FH = new THREE.Group(); FH.position.set(-4000, 1500, 0); scene.add(FH);
  const fstream = moltenMat({ T: 1180, scale: 0.006, speed: [0.35, 0], bright: 0.75 });
  const fh = forehearth({ streamMat: fstream }); FH.add(fh);
  const OY = fh.userData.orificeY;
  const shears = shearBlades(130); shears.position.set(0, OY - 70, 0); FH.add(shears);
  const BLADE_Y = OY - 70;
  const hotRod = new THREE.Mesh(new THREE.CylinderGeometry(19, 22, 1, 24), glassMat({ side: THREE.FrontSide })); hotRod.material.userData.u.uT.value = 1100; hotRod.renderOrder = 2; FH.add(hotRod);
  const trough = new THREE.Group(); FH.add(trough); trough.position.set(0, BLADE_Y - 520, 0); trough.rotation.z = -0.5;
  { const tm = M.metal(0x6f7882, 0.5, { side: THREE.DoubleSide, envMapIntensity: 0.6 }); const t = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 1400, 20, 1, true, Math.PI / 2, Math.PI), tm); t.rotation.z = Math.PI / 2; t.position.x = 500; trough.add(t); shadowed(trough); }
  const scoop = box(90, 700, 90, -260, BLADE_Y - 800, -260, steelM, FH);

  // ================= STATION D: IS machine section (x = 0) =================
  const IS = new THREE.Group(); scene.add(IS);
  const YA = 1100, D = 220;
  box(1200, 760, 900, 0, 380, 0, M.std(0x2c3742, { roughness: 0.5, metalness: 0.4 }), IS);
  box(1200, 40, 900, 0, 780, 0, M.std(0x3a4652, { roughness: 0.5, metalness: 0.4 }), IS); box(1200, 44, 24, 0, 780, 452, M.std(0xFFB62E, { roughness: 0.5 }), IS);
  for (const x of [-560, 560]) box(80, 1800, 80, x, 900 + 300, -380, steelM, IS);
  box(1200, 80, 120, 0, 2100, -380, steelM, IS);
  const PO = parisonProfile(1).outer, BO = bottleProfile().outer;
  const blank = mould(PO, { y0: 72, y1: 222, w: 120, d: 120, color: 0x4a5058 }); blank.position.set(-D, YA + 240, 0); blank.rotation.z = Math.PI; IS.add(blank);
  const blow = mould(BO, { y0: 0, y1: 222, w: 150, d: 150, color: 0x4a5058 }); blow.position.set(D, YA - 240, 0); IS.add(blow);
  box(170, 30, 170, D, YA - 255, 0, M.std(0x3c434b, { metalness: 0.4, roughness: 0.5 }), IS);
  box(60, YA - 255 - 780, 60, D, 780 + (YA - 255 - 780) / 2, 0, steelM, IS);
  box(60, 1268 - 780 - 160, 60, -D - 110, 780 + (1268 - 780 - 160) / 2, 0, steelM, IS);
  const baffle = box(120, 24, 120, -D, 1600, 0, M.metal(0x6a727b, 0.4), IS);
  const blowhead = new THREE.Group(); IS.add(blowhead); { const c = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 50, 24), M.metal(0x6a727b, 0.4)); c.position.y = 25; blowhead.add(c); const r = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 600, 12), steelM); r.position.y = 330; blowhead.add(r); shadowed(blowhead); }
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(60, 34, 120, 24, 1, true), M.metal(0x6a727b, 0.4, { side: THREE.DoubleSide })); funnel.position.set(-D, 1330, 0); IS.add(funnel);
  const arm = invertArm(D); arm.position.set(0, YA, 0); IS.add(arm);
  const carrier = arm.userData.carrier;
  const hero = new GlassBody(); // the one object: gob -> parison -> bottle
  const isConv = conveyor(2600, 300); isConv.rotation.y = Math.PI / 2; isConv.position.set(400, 800 + 6, 520); IS.add(isConv);
  const isRow = bottleRow(10); IS.add(isRow.grp);
  // air puff streaks
  const puffM = new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const puff = new THREE.Mesh(new THREE.ConeGeometry(16, 120, 16, 1, true), puffM); IS.add(puff);

  // ================= STATION E: lehr (x = 6000) =================
  const LE = new THREE.Group(); LE.position.set(6000, 700, 0); scene.add(LE);
  const lehr = lehrBelt({ len: 7000, w: 1300, h: 650 }); LE.add(lehr);
  box(7000, 700, 1100, 3500, -350 - 45, 0, M.std(0x2c3742, { roughness: 0.6, metalness: 0.3 }), LE);
  const LROWS = 26, LCOLS = 5, lrow = bottleRow(LROWS * LCOLS); LE.add(lrow.grp);
  const LV = 160; // mm/s, one constant speed

  // ================= STATION F: cold end inspection (x = 13000) =================
  const IN = new THREE.Group(); IN.position.set(13000, 0, 0); scene.add(IN);
  const iconv = conveyor(4200, 240); iconv.position.set(0, 800, 0); IN.add(iconv);
  box(300, 800, 4200, 0, 400 - 40, 0, M.std(0x2c3742, { roughness: 0.6, metalness: 0.3 }), IN);
  const gate = new THREE.Group(); IN.add(gate); gate.position.set(0, 800, 0);
  for (const s of [-1, 1]) box(60, 520, 60, s * 220, 260, 0, M.std(0x2c343c, { metalness: 0.5, roughness: 0.4 }), gate);
  box(500, 60, 80, 0, 540, 0, M.std(0x2c343c, { metalness: 0.5, roughness: 0.4 }), gate);
  const laserM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6FD0E6).multiplyScalar(4), toneMapped: false, transparent: true, opacity: 0.9 });
  const laser = new THREE.Mesh(new THREE.BoxGeometry(420, 2.5, 3), laserM); gate.add(laser);
  const laserSheet = new THREE.Mesh(new THREE.PlaneGeometry(420, 1), new THREE.MeshBasicMaterial({ color: 0x6FD0E6, transparent: true, opacity: 0.12, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); gate.add(laserSheet);
  const IV = 300; const irow = bottleRow(16); IN.add(irow.grp);
  const rej = new GlassBody({ clip: false }); rej.update(bottleProfile()); IN.add(rej.group); rej.setT(20);
  const kicker = new THREE.Group(); IN.add(kicker); box(180, 120, 90, 0, 0, 0, M.std(0xFFB62E, { roughness: 0.5 }), kicker); box(400, 30, 30, 290, 0, 0, M.metal(0xb8c0c8, 0.3), kicker);
  const tCheck0 = Wd(10, 'checked'), tKick0 = Wd(10, 'Rejects') + 0.15; const BIN = v3(-430, 0, 300 * (tKick0 - tCheck0)); const binM = M.std(0x2c3742, { roughness: 0.6, metalness: 0.3 });
  box(520, 30, 520, BIN.x, 15, BIN.z, binM, IN); for (const [sx, sz, w, d] of [[-1, 0, 30, 520], [1, 0, 30, 520], [0, -1, 520, 30], [0, 1, 520, 30]]) box(w, 520, d, BIN.x + sx * 245, 260, BIN.z + sz * 245, binM, IN);
  const NSH = 40, IMPACT = { p: v3(BIN.x, 60, BIN.z) };
  const shSim = simBodies({
    bodies: Array.from({ length: NSH }, (_, i) => { const a = hash(i + 70) * Math.PI * 2, y = 40 + hash(i + 71) * 200; return { half: [8 + hash(i) * 14, 2.5 + hash(i + 2) * 2, 6 + hash(i + 4) * 12], pos: [BIN.x + Math.cos(a) * 28, y, BIN.z + Math.sin(a) * 28], vel: [Math.cos(a) * (300 + hash(i + 72) * 500), 200 + hash(i + 73) * 600, Math.sin(a) * (300 + hash(i + 72) * 500)], spin: [(hash(i + 74) - 0.5) * 40, (hash(i + 75) - 0.5) * 40, (hash(i + 76) - 0.5) * 40], at: 0, rot: [hash(i + 77) * 6, hash(i + 78) * 6, 0] }; }),
    statics: [{ half: [260, 15, 260], pos: [BIN.x, 15, BIN.z] }, { half: [15, 300, 260], pos: [BIN.x - 245, 260, BIN.z] }, { half: [15, 300, 260], pos: [BIN.x + 245, 260, BIN.z] }, { half: [260, 300, 15], pos: [BIN.x, 260, BIN.z - 245] }, { half: [260, 300, 15], pos: [BIN.x, 260, BIN.z + 245] }],
    dur: 2.4, restitution: 0.3,
  });
  const shScale = Array.from({ length: NSH }, (_, i) => v3(8 + hash(i) * 14, 2.5 + hash(i + 2) * 2, 6 + hash(i + 4) * 12));
  const binShards = shardSet(NSH); IN.add(binShards.grp);
  const retConv = conveyor(4000, 360); retConv.position.set(2400, 500, 0); IN.add(retConv);
  box(400, 500, 4000, 2400, 250 - 30, 0, M.std(0x2c3742, { roughness: 0.6, metalness: 0.3 }), IN);
  const NR = 120, retShards = shardSet(NR); IN.add(retShards.grp);

  // ================= STATION G: payoff floor (x = 22000) =================
  const PAY = new THREE.Group(); PAY.position.set(22000, 0, 0); scene.add(PAY);
  const NPL = 7, PER = 90, prow = bottleRow(NPL * PER); PAY.add(prow.grp);
  const pconvs = []; for (let k = 0; k < NPL; k++) { const c = conveyor(9000, 200); c.rotation.y = Math.PI / 2; c.position.set(0, 800, -3200 + k * 650); PAY.add(c); pconvs.push(c); box(9000, 800, 160, 0, 400 - 30, -3200 + k * 650, M.std(0x2c3742, { roughness: 0.6, metalness: 0.3 }), PAY); }
  const handBottle = new GlassBody({ clip: false }); handBottle.update(bottleProfile()); handBottle.setT(20);
  const HB = new THREE.Group(); HB.position.set(0, 1150, 1900); HB.rotation.set(0.08, 0.5, -0.06); PAY.add(HB); HB.add(handBottle.group);
  const hnd = hand(30.5); hnd.position.y = 95; HB.add(hnd);
  HB.updateMatrixWorld(true);

  // ================= STATION H: choice (x = -22000) =================
  const chG = new THREE.Group(); chG.position.set(-22000, 0, 0); scene.add(chG);
  const floorC = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M.std(0x101a22, { roughness: 0.6, metalness: 0.2 })); floorC.rotation.x = -Math.PI / 2; floorC.position.y = 2; floorC.receiveShadow = true; chG.add(floorC);
  const pedG = pedestal(78, 130, 0x2BD67B), pedR = pedestal(78, 130, 0xFF3B3B); pedG.position.x = -105; pedR.position.x = 105; chG.add(pedG, pedR);
  const bear = gummyBear(0x2BD67B); bear.scale.setScalar(1.25); bear.position.set(-105, 140, 0); chG.add(bear);
  const pen = pencil(); pen.scale.setScalar(1.2); pen.position.set(105, 150, 0); chG.add(pen);

  // ---------------- camera ----------------
  let shake = 0, TT = 0;
  function cam(pos, tgt, fov = 40, up = [0, 1, 0]) {
    const p = pos.clone(), q = tgt.clone();
    if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; p.z += noise1(TT * 40 + 21) * shake; }
    camera.position.copy(p); camera.up.set(...up); camera.lookAt(q); camera.fov = fov;
    const d = p.distanceTo(q); camera.near = Math.max(1, d * 0.03); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix();
  }
  const logDolly = (a, b, u) => { const da = a.length(), db = b.length(); const dir = a.clone().normalize().lerp(b.clone().normalize(), u).normalize(); return dir.multiplyScalar(Math.exp(lerp(Math.log(da), Math.log(db), u))); };
  const L = (grp, x, y, z) => v3(x, y, z).applyMatrix4(grp.matrixWorld);
  scene.updateMatrixWorld(true);

  // ---------------- schedule ----------------
  const steps = [
    { at: Ls(2), n: 1, word: 'MIX.' }, { at: Ls(3), n: 2, word: 'MELT.' }, { at: Ls(5), n: 3, word: 'CUT.' },
    { at: Ls(6), n: 4, word: 'BLOW.' }, { at: Ls(8), n: 5, word: 'ANNEAL.' }, { at: Ls(10), n: 6, word: 'CHECK.' },
  ];
  const W_ = (t, a, at) => ({ t, a, at });
  const tCut1 = Wd(5, 'cut') - 0.05, tCut2 = Wd(5, 'lumps') + 0.05;
  const tCheck = Wd(10, 'checked'), tKick = Wd(10, 'Rejects') + 0.15, tSmash = tKick + 0.55;
  const caps = [
    { at: Wd(1, 'sand'), until: Ls(2) - 0.04, words: [W_('SAND.'), W_('1,550 °C.', false, Wd(1, 'become')), W_('BOTTLE.', true, Wd(1, 'bottle'))], size: 112, y: 1200 },
    { at: Wd(2, 'crushed'), until: Ls(3) - 0.04, words: [W_('4', true), W_('INGREDIENTS')] },
    { at: Wd(3, 'Fifteen'), until: Ls(4) - 0.04, words: [W_('1,550 °C', true)] },
    { at: Wd(4, 'river'), until: Ls(5) - 0.04, words: [W_('RIVER OF'), W_('FIRE', true)] },
    { at: Wd(5, 'eleven'), until: Wd(5, 'One') - 0.04, words: [W_('1,100 °C', true)] },
    { at: Wd(5, 'One'), until: Ls(6) - 0.04, words: [W_('1 GOB'), W_('='), W_('1 BOTTLE', true)] },
    { at: Wd(6, 'puff'), until: Ls(7) - 0.04, words: [W_('PUFF', true)] },
    { at: Wd(7, 'flips'), until: Wd(7, 'second') - 0.04, words: [W_('FLIP', true)] },
    { at: Wd(7, 'blast'), until: Ls(8) - 0.04, words: [W_('BLOW', true)] },
    { at: Wd(8, 'No'), until: Ls(9) - 0.04, words: [W_('ON'), W_('PURPOSE', true)] },
    { at: Wd(9, 'Five'), until: Wd(9, 'so') - 0.04, words: [W_('580 °C', true)] },
    { at: Wd(9, 'so'), until: Ls(10) - 0.04, words: [W_('NO'), W_('CRACKS', true)] },
    { at: Wd(11, 'six'), until: Ls(12) - 0.04, words: [W_('600+', true), W_('A MINUTE')] },
  ];

  // ---------------- state per station ----------------
  const _o = new THREE.Object3D(), _q = new THREE.Quaternion(), _p = v3(0, 0, 0);
  function hopperSet(t) {
    const top = pileTop(t); pile.scale.y = Math.max(1, top - HT); pile.position.y = HT + pile.scale.y / 2;
    pile.scale.x = pile.scale.z = 0.7 + 0.3 * clamp((top - HT) / 200);
    const starts = [Wd(2, 'Sand'), Wd(2, 'soda'), Wd(2, 'limestone')].map(x => x - 0.35);
    streams.forEach((m, k) => {
      const P0 = chutes[k].p;
      for (let i = 0; i < NP; i++) {
        const tb = starts[k] + i * 0.008, a = t - tb;
        let vis = a > 0 && t < Ls(3) + 1;
        const x = P0.x + (hash(i + k * 999) - 0.5) * 50 + (hash(i + 7) - 0.5) * 30 * a, z = P0.z + (hash(i + k * 777) - 0.5) * 50;
        let y = P0.y - 500 * a - 0.5 * 9810 * a * a * 0.35;
        if (y < top + 10) vis = false;
        const vy = 500 + 9810 * 0.35 * a; _o.position.set(x, y, z); const sc = vis ? 4 + hash(i + 3) * 3 : 0; _o.scale.set(sc, sc * (1 + vy / 700), sc); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    });
    const ct = t - (Wd(2, 'crushed') - 0.55);
    for (let i = 0; i < NS; i++) {
      if (ct < culSim.spawn[i]) { culShards.set(i, v3(0, -9999, 0), _q.identity(), culScale[i]); continue; }
      const s = sample(culSim, ct, i); culShards.set(i, _p.set(s[0], s[1], s[2]), _q.set(s[3], s[4], s[5], s[6]), culScale[i]);
    }
    culShards.done();
  }
  function furnaceSet(t) {
    melt.uniforms.uTime.value = t;
    const sp = 260, Lb = 1800;
    for (let i = 0; i < NB; i++) { const z = MZ + 1800 - ((i * 130 + sp * t) % Lb); _o.position.set((hash(i) - 0.5) * 360, MY + 75, z); _o.rotation.set(0, hash(i + 5) * 6, 0); _o.scale.set(1, 0.7 + hash(i + 2) * 0.6, 1); if (z < MZ - 200) _o.scale.setScalar(0); _o.updateMatrix(); batchIM.setMatrixAt(i, _o.matrix); }
    batchIM.instanceMatrix.needsUpdate = true;
    fbelt.userData.uOff.value = sp * t;
    for (let i = 0; i < 16; i++) { const z = MZ - 300 - ((i * 240 + 180 * t) % 3600); const r = Math.max(0, 260 * (1 - (MZ - 300 - z) / 3200)) * (0.6 + hash(i) * 0.6); _o.position.set((hash(i + 40) - 0.5) * 2000, MY + 4, z); _o.rotation.set(0, 0, 0); _o.scale.set(r + 0.01, 10, r * 0.7 + 0.01); _o.updateMatrix(); islandIM.setMatrixAt(i, _o.matrix); }
    islandIM.instanceMatrix.needsUpdate = true;
    charger.position.z = MZ + 200 + 120 * Math.sin(t * 2.6);
  }
  // feeder: rod grows under the orifice, shears cut it
  const cutTimes = [tCut1, tCut2];
  function feederSet(t) {
    fstream.uniforms.uTime.value = t; fh.userData.plunger.position.y = fh.userData.surfY + 300 + 70 * Math.sin(t * 6);
    let last = -1; for (const c of cutTimes) if (t >= c) last = c;
    const since = last < 0 ? t - (tCut1 - 1.1) : t - last;
    const len = clamp(20 + 95 * since / 0.75, 2, 115);
    hotRod.scale.y = len; hotRod.position.set(0, OY - len / 2, 0);
    const near = cutTimes.map(c => t - c).filter(d => d > -0.1 && d < 0.25)[0];
    shears.userData.set(near === undefined ? 0 : (near < 0 ? E.o(clamp((near + 0.1) / 0.1)) : 1 - E.io(clamp(near / 0.25))));
    return last;
  }
  // the hero glass: state machine through the IS section
  const SET = parisonProfile(0), PAR = parisonProfile(1), BOT = bottleProfile(), GOB = gobProfile(100, 19, 240);
  const tLand = Ls(6) + 0.3, tDrop = tLand - Math.sqrt(2 * 900 / 9810), tSettle = Wd(6, 'puff') - 0.05, tCounter = Wd(6, 'small') - 0.1, tParison = Wd(6, 'preform') + 0.2;
  const tOpen = Ls(7) - 0.05, tFlip0 = Wd(7, 'flips') - 0.05, tFlip1 = Wd(7, 'down') + 0.15, tBlowClose = tFlip1 + 0.1, tBlast = Wd(7, 'blast') - 0.05, tBlown = Wd(7, 'full') + 0.1, tOpen2 = Le(7) + 0.05;
  function isSet(t) {
    // profile
    let P = GOB, T = 1100;
    if (t >= tSettle) P = lerpProfile(GOB, SET, E.io(clamp((t - tSettle) / 0.3)));
    if (t >= tCounter) P = lerpProfile(SET, PAR, E.io(clamp((t - tCounter) / (tParison - tCounter))));
    if (t >= tBlast) P = lerpProfile(PAR, BOT, E.io(clamp((t - tBlast) / (tBlown - tBlast))));
    T = t < tCounter ? 1100 : (t < tBlast ? lerp(1100, 1000, clamp((t - tCounter) / 1.5)) : lerp(1000, 760, clamp((t - tBlast) / 2)));
    hero.update(P); hero.setT(T);
    carrier.add(hero.group);
    const drop = t < tLand ? Math.max(0, 900 - 0.5 * 9810 * Math.max(0, t - tDrop) ** 2) : 0;
    hero.group.position.set(0, -240 - drop, 0); hero.group.rotation.set(0, 0, 0);
    const flip = E.io(clamp((t - tFlip0) / (tFlip1 - tFlip0)));
    arm.rotation.z = -Math.PI * flip;
    blank.userData.set(t < tOpen ? 0 : E.o(clamp((t - tOpen) / 0.3)) * 1.4);
    blow.userData.set(t < tBlowClose ? 1.6 : (t < tOpen2 ? 1.6 * (1 - E.io(clamp((t - tBlowClose) / 0.25))) : 1.6 * E.o(clamp((t - tOpen2) / 0.3))));
    baffle.position.y = (t > tLand - 0.05 && t < tOpen) ? 1280 : 1600; if (t > tLand - 0.05 && t < tLand + 0.2) baffle.position.y = lerp(1600, 1280, E.o(clamp((t - tLand + 0.05) / 0.25)));
    blowhead.position.set(D, (t > tBlast - 0.15 && t < tOpen2) ? YA + 4 : YA + 300, 0);
    // air puffs
    const pf = [[tSettle, -1], [tCounter, 1], [tBlast, 2]].map(([a, k]) => [t - a, k]).filter(([d]) => d > 0 && d < 0.35)[0];
    puffM.opacity = 0; if (pf) { const [d, k] = pf; puffM.opacity = 0.55 * (1 - d / 0.35); if (k === -1) { puff.position.set(-D, 1330 - 80 * d / 0.35, 0); puff.rotation.set(0, 0, Math.PI); } else if (k === 1) { puff.position.set(-D, YA - 40 + 60 * d / 0.35, 0); puff.rotation.set(0, 0, 0); } else { puff.position.set(D, YA + 60 - 80 * d / 0.35, 0); puff.rotation.set(0, 0, Math.PI); } }
    const blowing = !!pf;
    return { T, blowing };
  }

  const steps2 = steps;
  // ---------------- shots ----------------
  const shots = []; const S = (t0, t1, fn) => shots.push({ t0, t1, fn });
  const show = (...objs) => objs.forEach(o => o.visible = true);
  const all = [HOP, FUR, FH, IS, LE, IN, PAY, chG];
  // HOOK = the bottle in a hand (also the loop frame)
  const hookTgt = () => L(HB, 0, 135, 0);
  const hookPos = u => L(HB, 0, 0, 0).add(v3(-150 + 20 * u, 250 - 10 * u, 470 - 50 * u).applyAxisAngle(v3(0, 1, 0), 0.5));
  const hookShot = (u, t) => { show(PAY); prowSet(t); cam(hookPos(u), hookTgt(), 36); rig(hookTgt(), 300); };
  function prowSet(t) {
    const V = 600;
    for (let k = 0; k < NPL; k++) for (let i = 0; i < PER; i++) { const x = ((i * 100 + V * t + k * 37) % 9000) - 4500; prow.set(k * PER + i, x, 806, -3200 + k * 650, 20); }
    prow.done(); pconvs.forEach(c => c.userData.uOff.value = -V * t);
  }
  S(0, Ls(2), (u, t) => hookShot(E.lin(clamp(t / Ls(2))), t));
  // STEP 1 MIX
  const HL = (x, y, z) => L(HOP, x, y, z);
  S(Ls(2), Wd(2, 'ash') + 0.05, (u, t) => { show(HOP); hopperSet(t); cam(HL(-500, 1500, 1500).lerp(HL(-460, 1460, 1380), u), HL(-200, 1250, -100), 40); rig(HL(0, 900, 0), 1200); });
  S(Wd(2, 'ash') + 0.05, Wd(2, 'limestone') + 0.25, (u, t) => { show(HOP); hopperSet(t); cam(HL(700, 1350, 1100).lerp(HL(640, 1330, 1000), u), HL(150, 1300, -200), 40); rig(HL(0, 900, 0), 1200); });
  S(Wd(2, 'limestone') + 0.25, Wd(2, 'crushed') - 0.1, (u, t) => { show(HOP); hopperSet(t); cam(HL(-300, 2100, 2300).lerp(HL(-280, 2050, 2150), u), HL(0, 1150, 0), 40); rig(HL(0, 900, 0), 1200); });
  S(Wd(2, 'crushed') - 0.1, Ls(3), (u, t) => { show(HOP); hopperSet(t); cam(HL(200, 1240, 330).lerp(HL(185, 1200, 300), u), HL(60, 905, 0), 40); rig(HL(100, 900, 0), 700); });
  // STEP 2 MELT
  const FL = (x, y, z) => L(FUR, x, y, z);
  S(Ls(3), Wd(3, 'Fifteen') - 0.08, (u, t) => { show(FUR); furnaceSet(t); glowAt(FL(0, MY + 260, MZ - 150), 2200, 5000); cam(FL(700, MY + 900, MZ + 1700).lerp(FL(620, MY + 820, MZ + 1450), E.io(u)), FL(0, MY + 120, MZ - 300), 42); rig(FL(0, MY, MZ + 600), 1500); });
  S(Wd(3, 'Fifteen') - 0.08, Ls(4), (u, t) => { show(FUR); furnaceSet(t); key.intensity = 0.5; glowAt(FL(0, 1000, 0), 260, 5000); cam(FL(500, 1100, 1700).lerp(FL(380, 1020, 1300), E.io(u)), FL(-200, MY, -900), 48); rig(FL(0, 0, 0), 2200); });
  S(Ls(4), Wd(4, 'river') - 0.1, (u, t) => { show(FUR); furnaceSet(t); key.intensity = 0.5; glowAt(FL(0, 900, 0), 260, 5000); cam(FL(-500, MY + 260, 1300).lerp(FL(-300, MY + 200, 300), E.io(u)), FL(-200, MY + 40, -1400), 46); rig(FL(0, 0, 0), 2200); });
  const FHL = (x, y, z) => L(FH, x, y, z);
  S(Wd(4, 'river') - 0.1, Ls(5), (u, t) => { show(FH); feederSet(t); fh.userData.lids.forEach(l => l.visible = false); glowAt(FHL(-900, 400, 0), 900, 3000); cam(FHL(-1900, 700, 520).lerp(FHL(-1700, 640, 460), u), FHL(-700, 120, 0), 42); rig(FHL(-1000, 0, 0), 1400); });
  // STEP 3 CUT
  S(Ls(5), Wd(5, 'shears') - 0.08, (u, t) => { show(FH); feederSet(t); fh.userData.lids.forEach(l => l.visible = true); glowAt(FHL(0, OY - 100, 200), 500, 1500); cam(FHL(320, OY + 120, 900).lerp(FHL(280, OY + 80, 760), u), FHL(0, OY - 60, 0), 40); rig(FHL(0, OY, 0), 600); });
  const TA = -0.5, TD = v3(Math.cos(TA), Math.sin(TA), 0), TR = 1.07, TOP = v3(0, BLADE_Y - 520 + 40, 0);
  const gobFall = (t, last) => { // the cut gob drops, lands in the trough and slides toward the machine
    if (last < 0) return false; const a = t - last; if (a < 0 || a > 2.6) return false;
    FH.add(hero.group); hero.update(GOB); hero.setT(1100); hero.setCut(false);
    const tf = Math.sqrt(2 * 380 / 9810); // free fall to the trough mouth
    if (a < tf) { hero.group.position.set(0, BLADE_Y - 240 - 0.5 * 9810 * a * a, 0); hero.group.rotation.set(0, 0, TR * E.i(a / tf) * 0.6); return true; }
    const b = a - tf, sl = Math.min(1250, 0.5 * 9810 * Math.sin(-TA) * 0.12 * b * b + 180 * b);
    const c = TOP.clone().addScaledVector(TD, sl); const rot = TR * (0.6 + 0.4 * E.o(clamp(b / 0.15)));
    hero.group.rotation.set(0, 0, rot); const off = v3(0, 190, 0).applyAxisAngle(v3(0, 0, 1), rot);
    hero.group.position.copy(c.sub(off)); return true;
  };
  S(Wd(5, 'shears') - 0.08, Wd(5, 'One') - 0.05, (u, t) => { show(FH); const last = feederSet(t); hero.group.visible = gobFall(t, last); glowAt(FHL(0, OY - 120, 150), 400, 900);
    const sp = cutTimes.some(c => t > c && t < c + 0.08); flashA = sp ? 0.18 : 0; shake = cutTimes.some(c => t > c && t < c + 0.15) ? 2.5 : 0;
    cam(FHL(110, BLADE_Y - 10, 330), FHL(0, BLADE_Y + 10, 0), 36); rig(FHL(0, BLADE_Y, 0), 300); });
  S(Wd(5, 'One') - 0.05, Ls(6), (u, t) => { show(FH); const last = feederSet(t); hero.group.visible = gobFall(t, last); const gp = v3(0, 190, 0).applyAxisAngle(v3(0, 0, 1), hero.group.rotation.z).add(hero.group.position); glowAt(L(FH, gp.x, gp.y + 120, 150), 500, 900); cam(L(FH, gp.x + 120, gp.y + 260, 620), L(FH, gp.x + 40, gp.y - 20, 0), 38); rig(L(FH, gp.x, gp.y, 0), 500); });
  // STEP 4 BLOW
  const IL = (x, y, z) => L(IS, x, y, z);
  S(Ls(6), Wd(6, 'air') - 0.02, (u, t) => { show(IS); hero.group.visible = true; hero.setCut(false); const s = isSet(t); hero.updatePlane(); blank.userData.front.visible = true; blow.userData.front.visible = true; glowAt(IL(-D, YA + 150, 300), 500, 1200); cam(IL(-D + 300, YA + 520, 620).lerp(IL(-D + 260, YA + 480, 560), u), IL(-D, YA + 160, 0), 40); rig(IL(0, YA, 0), 600); });
  S(Wd(6, 'air') - 0.02, Ls(7), (u, t) => { show(IS); hero.group.visible = true; hero.setCut(true); const s = isSet(t); hero.updatePlane(); blank.userData.front.visible = false; blow.userData.front.visible = true; glowAt(IL(-D, YA + 150, 250), 500, 1000); air = s.blowing; cam(IL(-D + 40, YA + 160, 520).lerp(IL(-D + 30, YA + 150, 470), u), IL(-D, YA + 140, 0), 40); rig(IL(-D, YA + 150, 0), 400); });
  S(Ls(7), Wd(7, 'second') - 0.08, (u, t) => { show(IS); hero.group.visible = true; hero.setCut(false); const s = isSet(t); hero.updatePlane(); blank.userData.front.visible = true; blow.userData.front.visible = true; glowAt(IL(0, YA + 100, 400), 500, 1400); cam(IL(0, YA + 160, 1500), IL(0, YA + 40, 0), 42); rig(IL(0, YA, 0), 800); });
  S(Wd(7, 'second') - 0.08, Ls(8), (u, t) => { show(IS); hero.group.visible = true; hero.setCut(true); const s = isSet(t); hero.updatePlane(); blank.userData.front.visible = true; blow.userData.front.visible = false; glowAt(IL(D, YA - 100, 250), 500, 1000); air = s.blowing; cam(IL(D + 30, YA - 110, 560).lerp(IL(D + 25, YA - 105, 520), u), IL(D, YA - 120, 0), 40); rig(IL(D, YA - 120, 0), 400); });
  // STEP 5 ANNEAL (twist)
  const tPush = Ls(8) + 0.2;
  function isRowSet(t) {
    for (let i = 0; i < 10; i++) { const z = 520, x = 400 + 1300 - ((i * 260 + 300 * (t - tPush)) % 2600) * -1; isRow.set(i, 400 - 1300 + ((i * 260 + 300 * (t - tPush)) % 2600), 806, 520, 520 - i * 8); }
    isRow.done(); isConv.userData.uOff.value = -300 * t;
  }
  S(Ls(8), Wd(8, 'No') - 0.05, (u, t) => { show(IS); hero.group.visible = false; isRowSet(t); blank.userData.front.visible = blow.userData.front.visible = true; arm.rotation.z = 0; glowAt(IL(400, 1000, 700), 300, 1200); cam(IL(-300, 1050, 1300).lerp(IL(-260, 1020, 1200), u), IL(400, 860, 520), 40); rig(IL(400, 800, 520), 800); });
  function lehrSet(t, Thero) {
    lehr.userData.uOff.value = LV * t; lehr.userData.roof.visible = false;
    for (const h of lehr.userData.heaters) { const k = h.x < 1500 ? 1 : h.x < 3000 ? 0.7 : Math.max(0.05, 1 - (h.x - 3000) / 3000); h.m.color.setRGB(1.0 * 2.2 * k, 0.45 * 2.2 * k, 0.12 * 2.2 * k); }
    let i = 0;
    for (let r = 0; r < LROWS; r++) for (let c = 0; c < LCOLS; c++) {
      const x = ((r * 260 + LV * t) % (LROWS * 260)) - 400; const z = (c - (LCOLS - 1) / 2) * 230;
      lrow.set(i++, x, 0, z, Math.max(20, Thero - (x - 1800) * 0.04), 1, hash(r * 7 + c) * 6);
    }
    lrow.done();
  }
  const ThL = t => track([[Ls(9) - 0.3, 520], [Wd(9, 'Five'), 580], [Wd(9, 'then'), 580], [Wd(9, 'so') + 0.3, 38, 'io']], t);
  const LL = (x, y, z) => L(LE, x, y, z);
  S(Wd(8, 'No') - 0.05, Wd(8, 'goes') - 0.05, (u, t) => { show(LE); lehrSet(t, 540); lehr.userData.roof.visible = true; glowAt(LL(600, 350, 0), 900, 2500); cam(LL(-1500, 700, 1500).lerp(LL(-1300, 650, 1300), E.io(u)), LL(600, 250, 0), 40); rig(LL(500, 0, 0), 1600); });
  S(Wd(8, 'goes') - 0.05, Ls(9), (u, t) => { show(LE); lehrSet(t, 560); lehr.userData.roof.visible = true; glowAt(LL(900, 350, 0), 900, 2500); cam(LL(300 + 300 * E.io(u), 330, 420), LL(900 + 300 * E.io(u), 160, 0), 40); rig(LL(900, 0, 0), 1000); });
  S(Ls(9), Wd(9, 'then') - 0.05, (u, t) => { show(LE); lehrSet(t, ThL(t)); glowAt(LL(1900, 500, 0), 800, 2500); cam(LL(1300, 900, 600).lerp(LL(1380, 860, 560), u), LL(1900, 120, 0), 40); rig(LL(1900, 0, 0), 1200); });
  S(Wd(9, 'then') - 0.05, Wd(9, 'so') - 0.05, (u, t) => { show(LE); lehrSet(t, ThL(t)); glowAt(LL(2500, 500, 0), 400 * clamp((ThL(t) - 100) / 480), 2500); cam(LL(1850 + 200 * u, 520, 470), LL(2250 + 200 * u, 120, 0), 38); rig(LL(2200, 0, 0), 900); });
  S(Wd(9, 'so') - 0.05, Ls(10), (u, t) => { show(LE); lehrSet(t, ThL(t)); cam(LL(1950, 200, 330), LL(2150, 140, 0), 36); rig(LL(2150, 0, 0), 600); });
  // STEP 6 CHECK
  const INL = (x, y, z) => L(IN, x, y, z);
  const rejZ = t => IV * (t - tCheck);
  function inspectSet(t) {
    iconv.userData.uOff.value = -IV * t;
    const zr = Math.min(rejZ(t), rejZ(tKick)); let ni = 0; for (let i = 0; i < 16; i++) { const z = ((i * 280 + IV * t) % (16 * 280)) - 2100; if (Math.abs(z - zr) < 150 && t < tSmash) continue; irow.set(ni++, 0, 806, z, 20, 1, hash(i) * 6); } irow.done(ni);
    // the reject: rides like the others until the kick (irow already flushed above)
    const z0 = Math.min(rejZ(t), rejZ(tKick));
    let rp = v3(0, 806, z0), rr = new THREE.Euler(0, 0, 0);
    if (t > tKick) { const a = clamp((t - tKick) / (tSmash - tKick)); rp = v3(lerp(0, BIN.x, E.i(a)), lerp(806, 60, E.i(a * a)), lerp(z0, BIN.z, a)); rr = new THREE.Euler(0, 0, a * 1.4); }
    rej.group.position.copy(rp); rej.group.rotation.copy(rr); rej.group.visible = t < tSmash;
    const red = t > tCheck ? 0.5 + 0.5 * Math.sin((t - tCheck) * 20) : 0;
    rej.mats.forEach(m => m.userData.u.uRim.value.setRGB(t > tCheck ? 2.6 + 1.2 * red : 0.85, t > tCheck ? 0.2 : 1, t > tCheck ? 0.15 : 0.94));
    kicker.position.set(lerp(520, 150, t > tKick - 0.1 && t < tKick + 0.4 ? E.o(clamp((t - tKick + 0.1) / 0.15)) : 0), 870, z0);
    laser.position.y = 260 + 230 * Math.sin(t * 7); laserSheet.position.y = laser.position.y; laserSheet.scale.y = 1;
    const st = t - tSmash;
    for (let i = 0; i < NSH; i++) { if (st < 0) { binShards.set(i, v3(0, -9999, 0), _q.identity(), shScale[i]); continue; } const s = sample(shSim, st, i); binShards.set(i, _p.set(s[0], s[1], s[2]), _q.set(s[3], s[4], s[5], s[6]), shScale[i]); }
    binShards.done();
    retConv.userData.uOff.value = -400 * t;
    for (let i = 0; i < NR; i++) { const z = ((i * 33 + 400 * t) % 3960) - 1980; _q.setFromEuler(new THREE.Euler(hash(i) * 6, hash(i + 1) * 6, hash(i + 2) * 6)); retShards.set(i, _p.set(2400 + (hash(i + 3) - 0.5) * 280, 506 + hash(i + 4) * 6, z), _q, v3(10 + hash(i + 5) * 14, 4, 8 + hash(i + 6) * 12)); }
    retShards.done();
  }
  S(Ls(10), Wd(10, 'Rejects') - 0.05, (u, t) => { show(IN); inspectSet(t); cam(INL(620, 1250, -900).lerp(INL(580, 1220, -820), u), INL(0, 980, 0), 40); rig(INL(0, 800, 0), 900); });
  S(Wd(10, 'Rejects') - 0.05, Wd(10, 'melted') - 0.05, (u, t) => { show(IN); inspectSet(t); shake = t > tSmash && t < tSmash + 0.3 ? 4 : 0; cam(INL(700, 1500, BIN.z + 900), INL(BIN.x + 200, 500, BIN.z), 40); rig(INL(BIN.x, 300, BIN.z), 900); });
  S(Wd(10, 'melted') - 0.05, Ls(11), (u, t) => { show(IN); inspectSet(t); cam(INL(2400 + 260, 760, -900 - 120 * u), INL(2400, 520, 400), 40); rig(INL(2400, 500, 0), 900); });
  // PAYOFF: from the hand to the floor
  S(Ls(11), Ls(12), (u, t) => { show(PAY); prowSet(t); const k = E.io(u);
    const q0 = hookTgt(), p0 = hookPos(1); const q1 = L(PAY, 0, 700, -600), p1 = L(PAY, -1400, 3000, 5600);
    const q = q0.clone().lerp(q1, E.io2(u)); const off = logDolly(p0.clone().sub(q0), p1.clone().sub(q1), k); cam(q.clone().add(off), q, lerp(36, 44, k)); rig(q, lerp(300, 5000, k)); });
  // END CARD
  const choiceSet = t => { show(chG); const lt = t - Ls(12);
    bear.rotation.y = 0.4 + lt * 0.6; pen.rotation.set(0.2, lt * 0.8, 0.15); pen.position.y = 150 + Math.sin(lt * 2.2) * 4;
    spotG.intensity = 9 * E.o(clamp(lt / 0.3)); spotR.intensity = 9 * E.o(clamp((lt - 0.15) / 0.3));
    spotG.position.copy(chG.position).add(v3(-260, 520, 260)); spotG.target.position.copy(chG.position).add(v3(-105, 150, 0));
    spotR.position.copy(chG.position).add(v3(260, 520, 260)); spotR.target.position.copy(chG.position).add(v3(105, 150, 0)); };
  const tCm = Wd(12, 'Comment') - 0.1;
  S(Ls(12), tCm, (u, t) => { choiceSet(t); const tgt = chG.position.clone().add(v3(0, 175, 0)); cam(chG.position.clone().add(v3(0, lerp(240, 228, E.io(u)), lerp(1080, 1020, E.io(u)))), tgt, 40); rig(tgt, 400); });
  S(tCm, END - LOOP, (u, t) => { choiceSet(t); const tgt = chG.position.clone().add(v3(0, 180, 0)); cam(chG.position.clone().add(v3(lerp(-60, -20, E.io(u)), 150, lerp(940, 900, E.io(u)))), tgt, 40); rig(tgt, 400); });
  S(END - LOOP, END + 1, (u, t) => hookShot(0, 0));

  // ---------------- HUD readout ----------------
  const fmt = n => Math.round(n).toLocaleString('en-US');
  function readout(t) {
    if (t < Ls(3)) { const n = t < Wd(2, 'Sand') ? 0 : t < Wd(2, 'soda') ? 1 : t < Wd(2, 'limestone') ? 2 : t < Wd(2, 'crushed') ? 3 : 4; return { label: 'BATCH', text: `${n}/4 INGREDIENTS` }; }
    if (t < Ls(5)) { const T = track([[Ls(3), 20], [Wd(3, 'Celsius'), 1550, 'o']], t); return { label: 'FURNACE', text: `${fmt(T).padStart(5, '0')} °C` }; }
    if (t < Ls(6)) return { label: 'GOB', text: '1,100 °C' };
    if (t < Ls(8)) return { label: 'AIR', text: air ? '~3 BAR' : '0 BAR' };
    if (t < Ls(10)) { if (t < Wd(8, 'oven')) return { label: 'LEHR', text: '--- °C', flag: t > Wd(8, 'No') ? 'ON PURPOSE' : null }; const T = t < Ls(9) ? 580 : ThL(t); return { label: 'LEHR', text: `${String(Math.round(T)).padStart(3, '0')} °C`, flag: 'ON PURPOSE' }; }
    if (t < Ls(11)) return { label: 'REJECTS', text: t > tCheck ? '001' : '000' };
    return { label: 'OUTPUT', text: t > Wd(11, 'six') ? '600+ / MIN' : '--- / MIN' };
  }

  // ---------------- sound events (one per event) ----------------
  const sfx = [
    { t: 0.0, n: 'whoosh_soft' }, { t: Wd(1, 'sand'), n: 'tick' }, { t: Wd(1, 'become'), n: 'tick' }, { t: Wd(1, 'bottle'), n: 'glass_ding' },
    { t: Ls(2), n: 'cut_whoosh' }, { t: Wd(2, 'Sand') - 0.3, n: 'sand_pour' }, { t: Wd(2, 'soda') - 0.3, n: 'sand_pour2' }, { t: Wd(2, 'limestone') - 0.3, n: 'gravel' }, { t: Wd(2, 'crushed') - 0.2, n: 'glass_pour' },
    { t: Ls(3), n: 'whoosh' }, { t: Ls(3) + 0.1, n: 'fire_roar' }, { t: Wd(3, 'Fifteen') - 0.08, n: 'fire_whoosh' },
    { t: Ls(4) - 0.25, n: 'dip' }, { t: Wd(4, 'river') - 0.1, n: 'low_whoosh' },
    { t: Ls(5), n: 'whoosh' }, { t: tCut1, n: 'shear' }, { t: tCut2, n: 'shear' }, { t: tCut1 + 0.55, n: 'thud' }, { t: tCut2 + 0.5, n: 'thud' },
    { t: Ls(6), n: 'whoosh' }, { t: tLand, n: 'clank' }, { t: tSettle, n: 'air_puff' }, { t: tCounter, n: 'air_hiss' },
    { t: tOpen, n: 'clank' }, { t: tFlip0, n: 'mech_move' }, { t: tBlowClose, n: 'clank' }, { t: tBlast, n: 'air_blast' }, { t: tOpen2, n: 'clank2' },
    { t: Ls(8), n: 'glass_clink' }, { t: Wd(8, 'No') - 0.3, n: 'dip' }, { t: Wd(8, 'No'), n: 'bass_hit' }, { t: Ls(9), n: 'oven_hum' },
    { t: Ls(10), n: 'whoosh' }, { t: Ls(10) + 0.2, n: 'scan_beep' }, { t: tCheck, n: 'buzzer' }, { t: tKick, n: 'pneumatic' }, { t: tSmash, n: 'glass_break' }, { t: Wd(10, 'melted') - 0.05, n: 'gravel' },
    { t: Ls(11) - 0.35, n: 'dip' }, { t: Ls(11), n: 'swell' }, { t: Wd(11, 'six'), n: 'bottles' },
    { t: Ls(12), n: 'whoosh' }, { t: Ls(12) + 0.25, n: 'click_ui' }, { t: Ls(12) + 0.4, n: 'click_ui' }, { t: END - LOOP, n: 'whoosh_soft' },
  ];
  { let lastVy = 0; for (let f = 1; f < shSim.frames.length; f++) { const vy = shSim.frames[f][0][1] - shSim.frames[f - 1][0][1]; if (lastVy < -0.4 && vy > -0.05) { sfx.push({ t: tSmash + f / 30, n: 'tink' }); } lastVy = vy; } }

  // ---------------- seek ----------------
  let flashA = 0, air = false;
  function seek(t, g, opts = {}) {
    const plate = opts.plate !== false, over = opts.over !== false;
    TT = t; key.intensity = 2.2; shake = 0; flashA = 0; air = false; glow.intensity = 0; spotG.intensity = spotR.intensity = 0;
    all.forEach(o => o.visible = false); hero.group.visible = false; hero.setCut(false);
    const sh = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
    sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    hero.updatePlane();
    glow.visible = glow.intensity > 0; spotG.visible = spotG.intensity > 0; spotR.visible = spotR.intensity > 0;
    lens.uniforms.uSeed.value = Math.floor(t * 30) % 1000; lens.uniforms.uFlash.value.set(1, 0.92, 0.75, flashA);
    if (plate) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
    if (!over) return;
    const cur = steps.filter(s => t >= s.at).pop();
    const hudA = smooth(0.08, 0.3, t) * (1 - smooth(Ls(12), Ls(12) + 0.25, t));
    const r = readout(t);
    hud(g, { ep: EP, step: cur ? cur.n : 0, nSteps: 6, stepName: cur ? cur.word.replace('.', '') : 'SAND', label: r.label, text: r.text, flag: r.flag, progress: t / (END - LOOP), from: 'SAND', to: 'BOTTLE', alpha: hudA });
    for (const s of steps) sticker(g, t, s);
    for (const c of caps) caption(g, t, c);
    stamp(g, t, { at: tCheck, until: tKick + 0.5, x: 560, y: 1010, text: 'REJECT' });
    endCard(g, t, { at: Ls(12), comment: Wd(12, 'Comment'), follow: Le(12) + 0.25, until: END - LOOP, left: 'GUMMY BEAR', right: 'PENCIL', next: 'EP. 03' });
  }
  return { seek, END, sfx, lines, shots: shots.map(s => [s.t0, s.t1]), caps: caps.map(c => [c.at, c.until, c.words.map(w => w.t).join(' ')]), lockTicks: () => [] };
}
