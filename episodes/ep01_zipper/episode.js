// EP. 01 — the zipper, how it works inside. Every state is a pure function of t.
import * as THREE from 'three';
import { clamp, lerp, smooth, track, E, noise1, W, H } from '../../js/core.js';
import { M, fabricMat, cuttingMat, workbench, room, deskLamp, tray, conveyor, pedestal, coin, dimLine, shadowed, RoundedBoxGeometry } from '../../js/parts.js';
import { Chain, Slider, sliderGap, toothGeometry, P, BX, T } from '../../js/zipper.js';
import { hud, caption, sticker, hookTitle, endCard, flash, C } from '../../js/overlay.js';
import { simPour, simPop, sample } from '../../js/physics.js';

export const EP = 'EP. 01';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  scene.background = new THREE.Color(0x0E1A2B);
  scene.environmentIntensity = 0.5;

  // ---------------- timing ----------------
  let _s = 0.25;
  const lines = timing ? timing.lines : script.lines.map((l, k) => {
    const s = _s; const words = l.say.split(/\s+/); const e = s + words.length / 2.9; _s = e + 0.3;
    return { id: l.id, s, e, words: words.map((w, j) => ({ w, s: s + (e - s) * j / words.length, e: s + (e - s) * (j + 1) / words.length })) };
  });
  const Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const Wd = (i, w, n = 0) => { const L = lines[i - 1]; const hits = L.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return L.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const END = Le(14) + (script.tail || 2.4);
  const LOOP = 0.34; // last frames return to the hook plate

  // ---------------- lights ----------------
  const key = new THREE.DirectionalLight(0xFFC777, 2.3); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.55, 1, 0.42).normalize();
  const fill = new THREE.DirectionalLight(0x5EC8E5, 1.1); fill.position.set(0.8, 0.55, -0.5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 0.6); rim.position.set(0.2, 0.4, -1); scene.add(rim);
  const hemi = new THREE.HemisphereLight(0x5EC8E5, 0x1b2433, 0.35); scene.add(hemi);
  const accent = new THREE.PointLight(0xFF5A1F, 0, 60, 1.2); scene.add(accent);
  const spotG = new THREE.SpotLight(0x2BD67B, 0, 0, 0.42, 0.6, 0), spotR = new THREE.SpotLight(0xFF3B3B, 0, 0, 0.42, 0.6, 0);
  scene.add(spotG, spotG.target, spotR, spotR.target);
  function rig(tgt, size) {
    key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.8, 0.55, -0.5).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.2, 0.5, -1).multiplyScalar(size * 3));
    scene.add(fill.target, rim.target);
  }

  // ---------------- materials ----------------
  const brass = M.metal(0xD9A441, 0.28), nickel = M.metal(0x9ea4ac, 0.42, { envMapIntensity: 0.7 }), blackM = M.metal(0x2a2d33, 0.35);
  const tapeMat = fabricMat('#2E4A6B');

  // ---------------- sets ----------------
  const bench = new THREE.Group(); scene.add(bench);
  bench.add(workbench(), room());
  const mat = cuttingMat(640, 420); bench.add(mat);
  const lamp = deskLamp(); lamp.position.set(-600, 0, -260); lamp.rotation.y = -0.35; bench.add(lamp);

  // hero zipper strip lying on the mat
  const heroG = new THREE.Group(); heroG.position.set(-80, 1.25, 100); heroG.rotation.x = -Math.PI / 2; scene.add(heroG);
  const hero = new Chain({ N: 52, toothMat: brass, tapeMat }); heroG.add(hero.group);
  const hs = new Slider({ mat: nickel }); heroG.add(hs.group);
  heroG.updateMatrixWorld(true);
  const HL = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(heroG.matrixWorld);
  const C_TOP = 159.6;
  const coinM = coin(); coinM.position.copy(HL(-17.5, 62, 0)); coinM.position.y = 1.1; scene.add(coinM);
  const dim = dimLine(2 * BX + 1.4 * 2 + 0.6, 0xFF5A1F, 0.16); dim.rotation.x = Math.PI / 2; heroG.add(dim);
  // clamps for the break test
  const clampM = M.metal(0x6b737d, 0.45);
  const clamps = [-1, 1].map(s => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.BoxGeometry(7, 22, 2.6), clampM); a.position.z = 1.6; const b = a.clone(); b.position.z = -1.6; const c = new THREE.Mesh(new THREE.BoxGeometry(2.6, 22, 5.8), clampM); c.position.x = s * 3.5; g.add(a, b, c); shadowed(g); heroG.add(g); return g; });
  const popTooth = new THREE.Mesh(toothGeometry().full, brass); popTooth.castShadow = true; scene.add(popTooth);
  const POP = { side: 0, i: 24 };
  const popPos = HL(-BX, hero.toothY(-1, POP.i), 0);
  const popSim = simPop({ x: popPos.x, y: popPos.y, z: popPos.z });

  // the hero tooth (macro) + jam / offset rows
  const toothG = new THREE.Group(); toothG.position.set(70, 26, 150); scene.add(toothG);
  const tg = toothGeometry();
  const nibMat = brass.clone(); nibMat.emissive = new THREE.Color(0xFF5A1F); nibMat.emissiveIntensity = 0;
  const tBase = new THREE.Mesh(tg.base, brass), tNib = new THREE.Mesh(tg.nib, nibMat); tBase.castShadow = tNib.castShadow = true;
  const tPivot = new THREE.Group(); tPivot.add(tBase, tNib); tBase.position.x = tNib.position.x = -1.175; toothG.add(tPivot);
  const ringM = M.glow(0xFF5A1F, 2.5); ringM.transparent = true;
  const scoopRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 40), ringM); scoopRing.rotation.x = Math.PI / 2; scoopRing.position.set(1.85 - 1.175, -T / 2 - 0.01, 0); tPivot.add(scoopRing);
  const rowsG = new THREE.Group(); rowsG.position.set(70, 1.25, 150); rowsG.rotation.x = -Math.PI / 2; scene.add(rowsG);
  const rows = new Chain({ N: 7, toothMat: brass, tapeMat, stops: false, pad: 5 }); rowsG.add(rows.group);
  rowsG.updateMatrixWorld(true);
  const RL = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(rowsG.matrixWorld);
  const guideM = M.glow(0x5EC8E5, 2.2); guideM.transparent = true;
  const guides = []; for (let i = 0; i < 7; i++) { const g = new THREE.Mesh(new THREE.BoxGeometry(16, 0.07, 0.07), guideM); g.position.set(0, i * P, 0.75); rowsG.add(g); guides.push(g); }
  const halfDim = dimLine(P / 2, 0xFF5A1F, 0.1); halfDim.rotation.z = Math.PI / 2; halfDim.position.set(5.2, 3 * P + P / 4, 0.8); rowsG.add(halfDim);

  // parts stage: tray + pouring teeth + loose tapes + loose slider
  const partsG = new THREE.Group(); partsG.position.set(-230, 0, -95); scene.add(partsG);
  partsG.add(tray(64, 44, 12, 2.5));
  const pour = simPour({ n: 90, w: 64, d: 44, h: 12, t: 2.5 });
  const pourIM = new THREE.InstancedMesh(toothGeometry().full, brass, 90); pourIM.castShadow = pourIM.receiveShadow = true; pourIM.frustumCulled = false; partsG.add(pourIM);
  const looseTapes = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 70), tapeMat); m.castShadow = m.receiveShadow = true; partsG.add(m); return m; });
  const looseS = new Slider({ mat: nickel }); looseS.group.rotation.x = -Math.PI / 2; partsG.add(looseS.group);

  // pouch (finished object) with its own closed zipper
  const pouchFab = fabricMat('#1f3552', [3, 3]);
  const pouch = new THREE.Mesh(new RoundedBoxGeometry(236, 60, 96, 5, 24), pouchFab); pouch.position.set(180, 30, -60); pouch.castShadow = pouch.receiveShadow = true; scene.add(pouch);
  const pOuter = new THREE.Group(); pOuter.position.set(180 - 94, 61.1, -60); pOuter.rotation.y = -Math.PI / 2; scene.add(pOuter);
  const pInner = new THREE.Group(); pInner.rotation.x = -Math.PI / 2; pOuter.add(pInner);
  const pz = new Chain({ N: 58, toothMat: brass, tapeMat }); pInner.add(pz.group);
  const ps = new Slider({ mat: nickel }); pInner.add(ps.group);
  const PC = 58 * P - 7.6; ps.group.position.y = PC; pz.layout((s, y) => sliderGap(y - PC)); ps.setCut(10); ps.updatePlane();
  pOuter.updateMatrixWorld(true);
  const PL = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(pInner.matrixWorld);

  // montage stage: conveyor of zipper variants
  const monG = new THREE.Group(); monG.position.set(6000, 0, 0); scene.add(monG);
  const belt = conveyor(1400, 300); monG.add(belt);
  const cols = ['#FF5A1F', '#5EC8E5', '#C9B98F', '#2BD67B', '#E0B23A', '#C2263C', '#7A4DD8', '#8E98A3', '#2E4A6B'];
  const toothMs = [brass, nickel, blackM];
  const items = [];
  for (let k = 0; k < 18; k++) {
    const g = new THREE.Group(); g.rotation.x = -Math.PI / 2;
    const ch = new Chain({ N: 14, toothMat: toothMs[(k * 2) % 3], tapeMat: fabricMat(cols[k % cols.length]), pad: 6 });
    const sl = new Slider({ mat: k % 3 === 2 ? blackM : nickel });
    const c = 14 * P - 7.6; sl.group.position.y = c; ch.layout((s, y) => sliderGap(y - c)); sl.setCut(10); sl.updatePlane();
    g.add(ch.group, sl.group); monG.add(g); items.push(g);
  }

  // choice stage
  const chG = new THREE.Group(); chG.position.set(-6000, 0, 0); scene.add(chG);
  const floorC = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M.std(0x101a2a, { roughness: 0.6, metalness: 0.2 })); floorC.rotation.x = -Math.PI / 2; floorC.receiveShadow = true; chG.add(floorC);
  const pedG = pedestal(78, 130, 0x2BD67B), pedR = pedestal(78, 130, 0xFF3B3B); pedG.position.x = -105; pedR.position.x = 105; chG.add(pedG, pedR);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xe6fff0, metalness: 0, roughness: 0.04, transmission: 1, thickness: 4, ior: 1.5, attenuationColor: new THREE.Color(0x7fdca6), attenuationDistance: 260, envMapIntensity: 1.6, specularIntensity: 1, clearcoat: 1 });
  const bp = [[0, 0], [33, 0], [35, 3], [35.5, 120], [34, 140], [20, 172], [14, 190], [13.5, 206], [15.2, 209], [15.2, 214], [12, 216], [11, 214]].map(([x, y]) => new THREE.Vector2(x, y));
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(bp, 64), glass); bottle.position.set(-105, 130, 0); bottle.castShadow = true; chG.add(bottle);
  const pen = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 118, 6), M.plastic(0xF3E9D2)); barrel.position.y = 59; pen.add(barrel);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 4.4, 14, 24), M.plastic(0xF3E9D2)); cone.position.y = -7; pen.add(cone);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.5, 5, 16), M.metal(0xC9CED6, 0.25)); tip.position.y = -16.5; pen.add(tip);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), M.metal(0xC9CED6, 0.15)); ball.position.y = -19; pen.add(ball);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 46, 24), M.plastic(0xFF5A1F)); cap.position.y = 121; pen.add(cap);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 38, 1.4), M.metal(0xC9CED6, 0.25)); clip.position.set(0, 118, 6); pen.add(clip);
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 4, 24), M.plastic(0xFF5A1F)); plug.position.y = 146; pen.add(plug);
  shadowed(pen); pen.scale.setScalar(1.45); pen.position.set(105, 175, 0); chG.add(pen);

  // ---------------- helpers ----------------
  const v3 = a => new THREE.Vector3(...a);
  let shake = 0;
  function cam(pos, tgt, fov = 40, up = [0, 1, 0]) {
    const p = pos.clone(), q = tgt.clone();
    if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; p.z += noise1(TT * 40 + 21) * shake; }
    camera.position.copy(p); camera.up.set(...up); camera.lookAt(q); camera.fov = fov;
    const d = p.distanceTo(q); camera.near = Math.max(0.05, d * 0.04); camera.far = Math.max(4000, d * 60); camera.updateProjectionMatrix();
    return d;
  }
  // log-distance dolly between two camera positions around a target
  const logDolly = (a, b, u) => { const da = a.length(), db = b.length(); const dir = a.clone().normalize().lerp(b.clone().normalize(), u).normalize(); return dir.multiplyScalar(Math.exp(lerp(Math.log(da), Math.log(db), u))); };
  const UPH = [0, 0, -1]; // world direction of chain +y (open end) -> screen up in top-downs
  let TT = 0;
  const closed = () => [0, 0];
  const atC = c => (s, y) => sliderGap(y - c);
  const numD = f => (s, y) => { const g = f(s, y); return [g, (f(s, y + 0.15) - f(s, y - 0.15)) / 0.3]; };

  // ---------------- step + caption schedule ----------------
  const steps = [
    { at: Ls(3), n: 1, word: 'OFFSET.' }, { at: Ls(5), n: 2, word: 'HOOK.' }, { at: Ls(7), n: 3, word: 'TILT.' },
    { at: Ls(9), n: 4, word: 'LOCK.' }, { at: Ls(11), n: 5, word: 'SPLIT.' }, { at: Ls(12), n: 6, word: 'BREAK.' },
  ];
  const W_ = (t, a) => ({ t, a });
  const caps = [
    { at: Wd(2, 'Two'), until: Ls(3) - 0.05, words: [W_('3'), W_('PARTS', true)] },
    { at: Wd(3, 'shifted'), until: Ls(4) - 0.05, words: [{ t: '½', a: true }, W_('TOOTH'), W_('OFF')] },
    { at: Wd(4, 'Five'), until: Wd(4, 'So') - 0.02, words: [{ t: '5 mm', a: true }] },
    { at: Wd(5, 'bump'), until: Ls(6) - 0.05, words: [W_('BUMP'), { t: '+', at: Wd(5, 'hollow') }, { t: 'HOLLOW', a: true, at: Wd(5, 'hollow') }] },
    { at: Wd(6, 'jam'), until: Ls(7) - 0.05, words: [{ t: 'JAMMED', a: true }] },
    { at: Wd(7, 'Y-shaped'), until: Ls(8) - 0.05, words: [{ t: 'Y', a: true }, W_('CHANNEL')] },
    { at: Wd(8, 'just'), until: Ls(9) - 0.05, words: [W_('JUST'), { t: 'ENOUGH', a: true }] },
    { at: Wd(9, 'Click'), until: Ls(10) - 0.05, words: [{ t: 'CLICK.' }, { t: 'CLICK.', at: Wd(9, 'Click') + 0.3 }, { t: 'CLICK.', a: true, at: Wd(9, 'Click') + 0.6 }] },
    { at: Wd(10, 'no'), until: Wd(10, 'wedge') - 0.05, words: [W_('NEVER'), W_('FULLY'), W_('CLOSED', true)] },
    { at: Wd(10, 'wedge'), until: Ls(11) - 0.05, words: [W_('THE'), W_('WEDGE', true), W_('STAYS')] },
    { at: Wd(11, 'apart'), until: Ls(12) - 0.05, words: [{ t: 'SPLIT.', a: true }] },
    { at: Wd(12, 'whole'), until: Ls(13) - 0.05, words: [W_('ONE TOOTH'), W_('='), W_('ALL', true)] },
    { at: Wd(13, 'seven'), until: Ls(14) - 0.05, words: [{ t: '7 BILLION+', a: true }, W_('/ YEAR')] },
  ];

  // ---------------- shots ----------------
  const tPour = Wd(2, 'Hundreds') - 0.35, tSlDrop = Wd(2, 'slider') - 0.28, tTapes = Wd(2, 'tapes') - 0.25;
  const tJam = Wd(6, 'jam');
  const tPop = Wd(12, 'tooth'), tBurst = Wd(12, 'whole');
  const BY = hero.toothY(-1, POP.i);
  const burstGap = (t) => numD((s, y) => {
    const dt = t - tBurst; if (dt <= 0) return 0;
    const R = 260 * E.o(clamp(dt / 0.9)) * 1.0, dist = Math.abs(y - BY);
    const open = E.o(clamp((R - dist) / 14));
    const env = smooth(-2, 14, y) * smooth(C_TOP + 2, C_TOP - 14, y);
    return 7.5 * open * env * (0.85 + 0.15 * E.o(clamp(dt / 1.2)));
  });
  const H0 = { c: 30, gap: null, cut: 10, ghost: 0, wedgeGlow: 0, clamps: 0, hidePop: false };
  const heroState = { ...H0 };

  const shots = [];
  const S = (t0, t1, fn) => shots.push({ t0, t1, fn });

  // HOOK: tight on the finished pouch zipper
  const hookCam = u => { const tgt = PL(0, PC + 3.5, 2.2); const pos = PL(24, PC - 52 + 6 * u, 44 - 4 * u); return [pos, tgt]; };
  const hookShot = (u) => { show('pouch'); const [p, q] = hookCam(u); cam(p, q, 36); rig(q, 60); };
  S(0, Ls(2), (u, t) => hookShot(E.lin(clamp(t / Ls(2)))));
  // PARTS
  const partsSet = (t) => {
    show('parts');
    const pt = t - tPour;
    for (let i = 0; i < 90; i++) {
      const o = _o; const st = pour.spawn[i];
      if (pt < st) { o.position.set(0, -500, 0); o.scale.setScalar(0); }
      else { const s = sample(pour, pt, i); o.position.set(s[0], s[1], s[2]); o.quaternion.set(s[3], s[4], s[5], s[6]).multiply(_qfix); o.scale.setScalar(1); }
      o.updateMatrix(); pourIM.setMatrixAt(i, o.matrix);
    }
    pourIM.instanceMatrix.needsUpdate = true;
    const tu = E.o(clamp((t - tTapes) / 0.45));
    looseTapes[0].position.set(lerp(-150, -6, tu), 0.25, 32); looseTapes[1].position.set(lerp(150, 6, tu), 0.25, 45);
    looseTapes[0].rotation.y = Math.PI / 2 + lerp(0.3, 0.04, tu); looseTapes[1].rotation.y = Math.PI / 2 + lerp(-0.3, -0.04, tu);
    const du = clamp((t - tSlDrop) / 0.28);
    const sy = t < tSlDrop ? 400 : (du < 1 ? lerp(160, 1.5, E.i(du)) : 1.5 + 10 * Math.abs(Math.sin((t - tSlDrop - 0.28) * 14)) * Math.exp(-(t - tSlDrop - 0.28) * 9));
    looseS.group.position.set(30, sy, 62); looseS.group.rotation.z = 0.5 + (t < tSlDrop + 0.28 ? (1 - du) * 1.2 : 0);
  };
  const PG = (x, y, z) => new THREE.Vector3(x, y, z).add(partsG.position);
  S(Ls(2), Wd(2, 'One') - 0.05, (u, t) => { partsSet(t); const p = PG(10, 118, 150).lerp(PG(8, 104, 136), E.io(u)); cam(p, PG(0, 0, 24), 40); rig(PG(0, 0, 20), 100); });
  S(Wd(2, 'One') - 0.05, Ls(3), (u, t) => { partsSet(t); cam(PG(-14, 36, 116).lerp(PG(-11, 32, 108), u), PG(24, 2, 58), 38); rig(PG(0, 0, 40), 90); });
  // STEP 1 OFFSET: two open rows, guides sweep across
  const rowsSet = (G, t, gOn = 0, hd = 0) => {
    show('rows'); rows.layout(() => [G, 0]);
    guides.forEach((g, i) => { const a = clamp((gOn - i * 0.06) / 0.2); g.scale.x = Math.max(0.001, E.o(a)); g.visible = a > 0; g.position.x = 0; });
    guideM.opacity = 1; halfDim.visible = hd > 0; halfDim.scale.setScalar(Math.max(0.001, E.back(clamp(hd))));
  };
  S(Ls(3), Wd(3, 'half') - 0.1, (u, t) => { rowsSet(2.6, t, (t - Wd(3, 'never')) / 0.5); const d = lerp(58, 48, E.io(u)); cam(RL(0, 10, d), RL(0, 10, 0), 40, UPH); rig(RL(0, 10, 0), 40); });
  S(Wd(3, 'half') - 0.1, Ls(4), (u, t) => { rowsSet(2.6, t, 3, (t - Wd(3, 'half')) / 0.3); cam(RL(14, 4 - 3 * u, 14), RL(2, 3 * P + 1, 0), 36, [0, 1, 0]); rig(RL(0, 10, 0), 30); });
  // coin + 5 mm
  const heroSet = () => {
    show('hero');
    hero.hidden.clear(); if (heroState.hidePop) hero.hidden.add(POP.side * 1000 + POP.i);
    const loc = hero.layout(heroState.gap || atC(heroState.c));
    hs.group.position.y = heroState.c; hs.setCut(heroState.cut, heroState.ghost); hs.updatePlane();
    hs.wedgeMat.emissiveIntensity = heroState.wedgeGlow;
    clamps.forEach((c, k) => { const s = k ? 1 : -1; const g = heroState.gap ? heroState.gap(s, 122)[0] : 0; c.visible = heroState.clamps > 0; c.position.set(s * (BX + 6.0 + g + (1 - heroState.clamps) * 30), 122, 0); });
    counter = loc;
  };
  S(Ls(4), Wd(4, 'So') - 0.05, (u, t) => {
    Object.assign(heroState, { c: C_TOP, gap: closed, cut: 10, ghost: 0, wedgeGlow: 0, clamps: 0, hidePop: false }); heroSet();
    show('coin', true);
    dim.visible = t > Wd(4, 'Five') - 0.1; dim.position.set(0, 60, 1.0); dim.scale.set(Math.max(0.001, E.back(clamp((t - Wd(4, 'Five') + 0.1) / 0.25))), 1, 1);
    const d = lerp(90, 80, E.io(u)); cam(HL(-11, 61, d), HL(-11, 61, 0), 40, UPH); rig(HL(-8, 60, 0), 50);
  });
  S(Wd(4, 'So') - 0.05, Ls(5), (u, t) => {
    Object.assign(heroState, { c: C_TOP, gap: closed, cut: 10 }); heroSet(); show('coin', true); dim.visible = false;
    const tgt = HL(0, 70, 0); cam(HL(9, 58 + 4 * E.io(u), 9 - 2 * E.io(u)), tgt, 36); rig(tgt, 25);
  });
  // STEP 2 HOOK: hero tooth macro
  const toothSet = (rotY, nibG, ringG, rx = 0.35) => { show('tooth'); tPivot.rotation.set(rx, rotY, 0); nibMat.emissiveIntensity = nibG; ringM.opacity = ringG; scoopRing.visible = ringG > 0.01; };
  S(Ls(5), Wd(5, 'hollow') - 0.15, (u, t) => {
    const g = 1.6 * clamp((t - Wd(5, 'bump')) / 0.15) * (0.75 + 0.25 * Math.sin(t * 18));
    toothSet(lerp(-0.6, 0.15, E.io(u)), g, 0);
    const tgt = toothG.position.clone(); cam(tgt.clone().add(v3([2, 7, 13]).multiplyScalar(lerp(1.05, 0.92, u))), tgt, 34); rig(tgt, 12);
  });
  S(Wd(5, 'hollow') - 0.15, Ls(6), (u, t) => {
    const g = clamp((t - Wd(5, 'hollow')) / 0.15) * (0.8 + 0.2 * Math.sin(t * 18));
    const fl = E.back(clamp((t - (Wd(5, 'hollow') - 0.15)) / 0.4));
    toothSet(lerp(0.15, 0.35, E.io(u)), 0, g, 0.35 + Math.PI * fl);
    const tgt = toothG.position.clone(); cam(tgt.clone().add(v3([2, 7, 13]).multiplyScalar(lerp(0.92, 0.85, u))), tgt, 34); rig(tgt, 12);
  });
  // JAM
  S(Ls(6), Ls(7), (u, t) => {
    const k = clamp((t - Ls(6)) / (tJam - Ls(6))); const G = t < tJam ? lerp(6, 0.85, E.i(k)) : 0.85 + 0.25 * Math.exp(-(t - tJam) * 6) * Math.abs(Math.sin((t - tJam) * 30));
    rowsSet(G, t, 0, 0); shake = t > tJam ? 0.6 * Math.exp(-(t - tJam) * 8) : 0;
    flashA = t > tJam ? 0.32 * Math.exp(-(t - tJam) * 7) : 0;
    cam(RL(10, -6, 20), RL(0, 9, 0), 38, [0, 1, 0]); rig(RL(0, 10, 0), 30);
  });
  // STEP 3 TILT: the cutaway
  S(Ls(7), Wd(7, 'Y-shaped') - 0.1, (u, t) => {
    shake = 0;
    const cu = E.io(clamp((t - Wd(7, 'slider') + 0.05) / 0.55));
    Object.assign(heroState, { c: 80, gap: null, cut: lerp(3.8, 0.68, cu), ghost: 0.85 * cu, wedgeGlow: 0, clamps: 0, hidePop: false }); heroSet();
    accentAt(HL(0, 86, 4), 0.8 * cu, 40);
    const tgt = HL(0, 86, 0); cam(HL(-20, 66 + 4 * u, 22), tgt, 36); rig(tgt, 30);
  });
  S(Wd(7, 'Y-shaped') - 0.1, Ls(8), (u, t) => {
    Object.assign(heroState, { c: 80, gap: null, cut: 0.68, ghost: 0.85 }); heroSet();
    accentAt(HL(0, 88, 5), 1.0, 40);
    const tgt = HL(0, 87, 0); cam(HL(0, 86.6, lerp(34, 30, E.io(u))), tgt, 40, UPH); rig(tgt, 25);
  });
  S(Ls(8), Wd(8, 'clear') - 0.1, (u, t) => {
    const c = lerp(80, 86, E.io(u)); Object.assign(heroState, { c, gap: null, cut: 0.68, ghost: 0.6 }); heroSet();
    accentAt(HL(0, c + 5, 5), 0.9, 40);
    const tgt = HL(0, c + 3.5, 0); cam(HL(0, c + 3.3, 17), tgt, 40, UPH); rig(tgt, 18);
  });
  S(Wd(8, 'clear') - 0.1, Ls(9), (u, t) => {
    const c = lerp(86, 89, u); Object.assign(heroState, { c, gap: null, cut: 0.68, ghost: 0.5 }); heroSet();
    accentAt(HL(0, c + 5, 5), 0.9, 40);
    const tgt = HL(0, c + 4, 0); cam(HL(-9, c - 6, 9), tgt, 36); rig(tgt, 18);
  });
  // STEP 4 LOCK: the run up
  const lockC = t => track([[Ls(9), 20], [Wd(9, 'Click') - 0.1, 50, 'i'], [Wd(9, 'Over') - 0.1, 80, 'lin'], [Ls(10) - 0.05, C_TOP, 'o']], t);
  S(Ls(9), Wd(9, 'Click') - 0.1, (u, t) => {
    const c = lockC(t); Object.assign(heroState, { c, gap: null, cut: 10, ghost: 0, wedgeGlow: 0 }); heroSet();
    const tgt = HL(0, c + 2, 0); cam(HL(0, c - 4, 52), tgt, 40, UPH); rig(tgt, 40);
  });
  S(Wd(9, 'Click') - 0.1, Wd(9, 'Over') - 0.1, (u, t) => {
    const c = lockC(t); Object.assign(heroState, { c, gap: null, cut: 0.68, ghost: 0.6 }); heroSet(); accentAt(HL(0, c + 5, 5), 0.8, 40);
    const tgt = HL(0, c + 1, 0); cam(HL(12, c - 9, 8), tgt, 34); rig(tgt, 20);
  });
  S(Wd(9, 'Over') - 0.1, Ls(10), (u, t) => {
    const c = lockC(t); Object.assign(heroState, { c, gap: null, cut: 10, ghost: 0 }); heroSet();
    const tgt = HL(0, 92, 0); cam(HL(-4, 92, 230), tgt, 40, UPH); rig(tgt, 110);
  });
  // TWIST: never fully closed
  const twistSet = t => {
    const k = E.io(clamp((t - Wd(10, 'no') + 0.2) / 0.5));
    Object.assign(heroState, { c: C_TOP, gap: null, cut: lerp(10, 0.68, k), ghost: 0.9 * k, wedgeGlow: 0 }); heroSet();
    accentAt(HL(0, C_TOP + 8, 5), 1.2 * k, 40);
    whiteA = t > Wd(10, 'no') ? 0.22 * Math.exp(-(t - Wd(10, 'no')) * 9) : 0;
  };
  S(Ls(10), Wd(10, 'no') - 0.12, (u, t) => {
    twistSet(t); const tgt = HL(0, C_TOP + 2, 1); cam(HL(14, lerp(C_TOP - 34, C_TOP - 28, E.io(u)), 10), tgt, 36); rig(tgt, 30);
  });
  S(Wd(10, 'no') - 0.12, Wd(10, 'wedge') - 0.1, (u, t) => {
    twistSet(t); const tgt = HL(0, lerp(146, C_TOP + 6, E.io(u)), 0); cam(HL(-16, lerp(122, C_TOP - 14, E.io(u)), lerp(36, 26, E.io(u))), tgt, 38); rig(tgt, 40);
  });
  S(Wd(10, 'wedge') - 0.1, Ls(11), (u, t) => {
    whiteA = 0; const pulse = 2.2 * (0.7 + 0.3 * Math.sin(t * 12));
    Object.assign(heroState, { c: C_TOP, gap: null, cut: 0.68, ghost: 0.9, wedgeGlow: pulse }); heroSet();
    accentAt(HL(0, C_TOP + 8, 4), 1.4, 30);
    const tgt = HL(0, C_TOP + 7.5, 0); cam(HL(0, C_TOP + 7.2, lerp(22, 17, E.io(u))), tgt, 40, UPH); rig(tgt, 18);
  });
  // STEP 5 SPLIT
  const splitC = t => track([[Ls(11), C_TOP], [Le(11), 110, 'io'], [Ls(12), 104, 'o']], t);
  S(Ls(11), Wd(11, 'pries') - 0.12, (u, t) => {
    const c = splitC(t); Object.assign(heroState, { c, gap: null, cut: 0.68, ghost: 0.8, wedgeGlow: 1.6 }); heroSet(); accentAt(HL(0, c + 8, 4), 1.2, 40);
    const tgt = HL(0, c + 4, 0); cam(HL(0, c + 2, 60), tgt, 40, UPH); rig(tgt, 45);
  });
  S(Wd(11, 'pries') - 0.12, Ls(12), (u, t) => {
    const c = splitC(t); Object.assign(heroState, { c, gap: null, cut: 0.68, ghost: 0.8, wedgeGlow: 2.2 }); heroSet(); accentAt(HL(0, c + 8, 4), 1.4, 30);
    const tgt = HL(0, c + 9, 0); cam(HL(10, c + 22, 10), tgt, 36); rig(tgt, 20);
  });
  // STEP 6 BREAK
  const breakSet = t => {
    const cl = E.o(clamp((t - Ls(12)) / 0.4));
    const gap = t < tBurst ? closed : burstGap(t);
    Object.assign(heroState, { c: C_TOP, gap, cut: 10, ghost: 0, wedgeGlow: 0, clamps: cl, hidePop: t >= tPop }); heroSet();
    show('pop', t >= tPop);
    if (t >= tPop) { const s = sample(popSim, t - tPop, 0); popTooth.position.set(s[0], s[1], s[2]); popTooth.quaternion.set(s[3], s[4], s[5], s[6]).multiply(_qfix); }
    shake = t > tPop ? 0.4 * Math.exp(-(t - tPop) * 10) : 0;
    if (t > tBurst) shake += 2.0 * Math.exp(-(t - tBurst) * 5);
  };
  S(Ls(12), tBurst - 0.05, (u, t) => { breakSet(t); const tgt = HL(-3, BY, 2); cam(HL(-22, BY - 16, 14), tgt, 36); rig(tgt, 30); });
  S(tBurst - 0.05, Ls(13), (u, t) => { breakSet(t); const tgt = HL(-2, 82, 0); cam(HL(-2, 82, lerp(205, 225, u)), tgt, 40, UPH); rig(tgt, 110); });
  // PAYOFF: pull out from the pouch to the room
  S(Ls(13), Wd(13, 'seven') - 0.08, (u, t) => {
    shake = 0; show('pouch'); const [p0, q0] = hookCam(1);
    const k = E.io(u); const wideP = v3([620, 380, 900]), wideQ = v3([60, 60, -120]);
    const q = q0.clone().lerp(wideQ, E.io2(u)); const off = logDolly(p0.clone().sub(q0), wideP.clone().sub(wideQ), k);
    cam(q.clone().add(off), q, lerp(36, 46, k)); rig(q, lerp(60, 900, k));
  });
  // MONTAGE: variants on a conveyor
  S(Wd(13, 'seven') - 0.08, Ls(14), (u, t) => {
    show('mont'); const v = 260; key.intensity = 1.5;
    items.forEach((g, k) => { const col = k % 3, row = Math.floor(k / 3); const z = ((row * 80 + v * t) % 480) - 240; g.position.set((col - 1) * 74 - 22, 1.4, z + col * 26); g.rotation.z = 0; });
    belt.userData.uOff.value = -v * t;
    const tgt = monG.position.clone(); cam(tgt.clone().add(v3([0, 470, 1])), tgt, 40, [0, 0, -1]); rig(tgt, 300);
  });
  // CHOICE
  const choiceSet = t => {
    show('choice'); const lt = t - Ls(14);
    bottle.rotation.y = lt * 0.6; pen.rotation.set(0.25, lt * 0.8, 0.18); pen.position.y = 160 + Math.sin(lt * 2.2) * 4;
    spotG.intensity = 9 * E.o(clamp(lt / 0.3)); spotR.intensity = 9 * E.o(clamp((lt - 0.15) / 0.3));
    spotG.position.copy(chG.position).add(v3([-260, 520, 260])); spotG.target.position.copy(chG.position).add(v3([-105, 150, 0]));
    spotR.position.copy(chG.position).add(v3([260, 520, 260])); spotR.target.position.copy(chG.position).add(v3([105, 150, 0]));
  };
  const tCm = Wd(14, 'Comment') - 0.1;
  S(Ls(14), tCm, (u, t) => { choiceSet(t); const tgt = chG.position.clone().add(v3([0, 175, 0])); cam(chG.position.clone().add(v3([0, lerp(240, 228, E.io(u)), lerp(1080, 1020, E.io(u))])), tgt, 40); rig(tgt, 400); });
  S(tCm, END - LOOP, (u, t) => { choiceSet(t); const tgt = chG.position.clone().add(v3([0, 180, 0])); cam(chG.position.clone().add(v3([lerp(-60, -20, E.io(u)), 150, lerp(940, 900, E.io(u))])), tgt, 40); rig(tgt, 400); });
  S(END - LOOP, END + 1, () => hookShot(0));

  // ---------------- set visibility ----------------
  const sets = { bench, hero: heroG, coin: coinM, tooth: toothG, rows: rowsG, parts: partsG, pouch: [pouch, pOuter], mont: monG, choice: chG, pop: popTooth };
  const bigSets = ['hero', 'coin', 'tooth', 'rows', 'parts', 'pouch', 'mont', 'choice', 'pop'];
  function show(name, on = true) { const s = sets[name]; (Array.isArray(s) ? s : [s]).forEach(o => o.visible = on); }
  function hideAll() { bigSets.forEach(n => show(n, false)); bench.visible = true; dim.visible = false; Object.assign(heroState, H0); }
  function accentAt(p, k, dist) { accent.position.copy(p); accent.intensity = k * 6; accent.distance = dist; }
  const _o = new THREE.Object3D(); const _qfix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  let counter = 0, flashA = 0, whiteA = 0;

  // ---------------- sound events (one per event) ----------------
  const sfx = [
    { t: 0.0, n: 'whoosh_soft' }, { t: Ls(2), n: 'cut_whoosh' },
    { t: tTapes + 0.3, n: 'fabric_slide' }, { t: tPour, n: 'metal_pour' }, { t: tSlDrop + 0.28, n: 'metal_clank' },
    { t: Ls(3), n: 'whoosh' }, { t: Wd(3, 'shifted'), n: 'scan_beep' }, { t: Wd(3, 'half'), n: 'tick' },
    { t: Ls(4), n: 'whoosh' }, { t: Wd(4, 'Five'), n: 'tick' },
    { t: Ls(5), n: 'whoosh' }, { t: Wd(5, 'bump'), n: 'ding' }, { t: Wd(5, 'hollow'), n: 'ding2' },
    { t: tJam, n: 'clonk' },
    { t: Ls(7), n: 'whoosh' }, { t: Wd(7, 'slider'), n: 'laser_cut' }, { t: Wd(7, 'Y-shaped'), n: 'low_whoosh' },
    { t: Wd(8, 'clear'), n: 'click_soft' },
    { t: Ls(9), n: 'whoosh' }, { t: Wd(9, 'Click'), n: 'zip_close' },
    { t: Wd(10, 'no') - 0.3, n: 'dip' }, { t: Wd(10, 'no'), n: 'bass_hit' }, { t: Wd(10, 'wedge'), n: 'hum' },
    { t: Ls(11), n: 'zip_open' },
    { t: Ls(12), n: 'clamp' }, { t: tPop, n: 'pop' }, { t: tBurst, n: 'burst' },
    { t: Ls(13) - 0.35, n: 'dip' }, { t: Ls(13), n: 'swell' }, { t: Wd(13, 'seven'), n: 'conveyor' },
    { t: Ls(14), n: 'whoosh' }, { t: Ls(14) + 0.25, n: 'click_ui' }, { t: Ls(14) + 0.4, n: 'click_ui' }, { t: END - LOOP, n: 'whoosh_soft' },
  ];
  // bounces of the popped tooth (from the physics record)
  { let lastVy = 0; for (let f = 1; f < popSim.frames.length; f++) { const vy = popSim.frames[f][0][1] - popSim.frames[f - 1][0][1]; if (lastVy < -0.3 && vy > -0.05) sfx.push({ t: tPop + f / 30, n: 'tink' }); lastVy = vy; } }

  // ---------------- seek ----------------
  function seek(t, g, opts = {}) {
    const plate = opts.plate !== false, over = opts.over !== false;
    TT = t; shake = 0; key.intensity = 2.3; flashA = 0; whiteA = 0; accent.intensity = 0; spotG.intensity = spotR.intensity = 0;
    hideAll();
    const sh = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
    sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    accent.visible = accent.intensity > 0; spotG.visible = spotG.intensity > 0; spotR.visible = spotR.intensity > 0;
    lens.uniforms.uSeed.value = Math.floor(t * 30) % 1000;
    lens.uniforms.uFlash.value.set(1, 0.92, 0.85, whiteA);
    if (plate) { ctx.composer.render(); g.drawImage(ctx.canvas3d, 0, 0, W, H); }
    if (!over) return;
    // overlay
    flash(g, flashA);
    const cur = steps.filter(s => t >= s.at).pop();
    const inChoice = t >= Ls(14);
    let cval = (t < Ls(7)) ? 0 : counter; if (t >= Ls(13)) cval = 102; if (t >= Ls(12) && t < Ls(13)) cval = counter;
    const hudA = smooth(0.08, 0.3, t) * (1 - smooth(Ls(14), Ls(14) + 0.25, t));
    hud(g, { ep: EP, step: cur ? cur.n : 0, nSteps: 6, stepName: cur ? cur.word.replace('.', '') : 'PARTS', label: 'TEETH LOCKED', value: cval, total: 104, progress: t / (END - LOOP), from: 'PARTS', to: 'ZIPPER', alpha: hudA });
    hookTitle(g, t, { at: 0.12, until: Ls(2) - 0.02, l1: "WHAT'S INSIDE A", l2: 'ZIPPER?' });
    for (const s of steps) sticker(g, t, s);
    for (const c of caps) caption(g, t, c);
    endCard(g, t, { at: Ls(14), comment: Wd(14, 'Comment'), follow: Le(14) + 0.25, until: END - LOOP, left: 'GLASS BOTTLE', right: 'BALLPOINT PEN', next: 'EP. 02' });
  }
  // tooth lock / unlock events (for the click track): run the shot logic without rendering
  function lockTicks(dt = 1 / 240) {
    const ev = []; let prev = null;
    for (let t = Ls(8); t < Ls(13); t += dt) {
      hideAll(); counter = null; const sh = shots.find(x => t >= x.t0 && t < x.t1); sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
      if (counter === null || !heroG.visible) { prev = null; continue; }
      if (prev !== null && counter !== prev) { const n = Math.abs(counter - prev); for (let k = 0; k < n; k++) ev.push({ t: t + k * dt / n, d: Math.sign(counter - prev) }); }
      prev = counter;
    }
    return ev;
  }
  return { lockTicks, seek, END, sfx, lines, shots: shots.map(s => [s.t0, s.t1]), caps: caps.map(c => [c.at, c.until, c.words.map(w => w.t).join(' ')]) };
}
