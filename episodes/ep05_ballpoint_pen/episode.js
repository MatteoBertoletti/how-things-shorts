// EP. 05 — the ballpoint pen. Why it has a ball (the ball is the cap and the roller in one), then how it's made
// (barrel injection molded like the toy brick, tip closed around the ball, ink injected, assembled).
// Hand-free hook in motion at frame 0 (the ball mid-roll leaving a wet line); the loop frames replay the roll.
import * as THREE from 'three';
import { clamp, lerp, E, noise1, hash, W, H } from '../../js/core.js';
import { M, shadowed, factoryFloor, pedestal } from '../../js/parts.js';
import { hotMat } from '../../js/pencil.js';
import { plasticMat, makeBrick, COL } from '../../js/brick.js';
import { TIP, PC, makeTip, makeBall, inkFilm, makeRefill, spring, penParts, makePen, crayon, paperClip } from '../../js/pen.js';
import { setAccent, C, SAFE, titleRawReal, kcap, odometer, callout, stepSticker, dock, inkSwipe, blurred, setParallax, endCard2 } from '../../js/overlay.js';

export const EP = 'EP. 05';

export async function build(ctx, script, timing) {
  const { scene, camera, lens } = ctx;
  setAccent('#2F7BFF');
  ctx.bloom.threshold = 0.68; ctx.bloom.strength = 0.38; ctx.bloom.radius = 0.5;
  scene.background = new THREE.Color(0x0F1420); scene.environmentIntensity = 0.8;
  ctx.renderer.localClippingEnabled = true;

  // ---------------- timing ----------------
  const lines = timing.lines, Ls = i => lines[i - 1].s, Le = i => lines[i - 1].e;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const Wd = (i, w, n = 0) => { const L = lines[i - 1]; const hits = L.words.filter(x => norm(x.w).startsWith(norm(w))); if (!hits.length) { console.log('missing word', i, w); return L.s; } return hits[Math.min(n, hits.length - 1)].s; };
  const LOOP = 0.9;
  const tEC = +Math.max(Ls(9) - 0.05, Le(9) - 2.5 + 0.04).toFixed(3);   // end card <= 2.5 s, ends just after the last word
  const END = +(Le(9) + 0.04 + LOOP).toFixed(3);
  const tSnap = Math.min(1.2, Wd(1, 'pen') - 0.06);

  // ---------------- lights ----------------
  const key = new THREE.DirectionalLight(0xFFC27A, 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const keyDir = new THREE.Vector3(-0.5, 1, 0.6).normalize();
  const fill = new THREE.DirectionalLight(0x7FB0FF, 1.2); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xD6E4FF, 1.1); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0x7FB0FF, 0x231c16, 0.5));
  const glow = new THREE.PointLight(0xFF7A2B, 0, 0, 1.3); scene.add(glow);
  const spotG = new THREE.SpotLight(0x2BD67B, 0, 0, 0.42, 0.6, 0), spotB = new THREE.SpotLight(0x2F7BFF, 0, 0, 0.42, 0.6, 0); scene.add(spotG, spotG.target, spotB, spotB.target);
  let expo = 1.15;
  function rig(tgt, size, k = 2.2) {
    key.intensity = k; key.target.position.copy(tgt); key.position.copy(tgt).addScaledVector(keyDir, size * 3);
    const c = key.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = size * 0.2; c.far = size * 6; c.updateProjectionMatrix();
    fill.target.position.copy(tgt); fill.position.copy(tgt).add(new THREE.Vector3(0.85, 0.45, -0.4).multiplyScalar(size * 3));
    rim.target.position.copy(tgt); rim.position.copy(tgt).add(new THREE.Vector3(0.2, 0.6, -1).multiplyScalar(size * 3));
  }
  const pt = (Lt, p, k, dist, col) => { Lt.position.copy(p); Lt.intensity = k; Lt.distance = dist; if (col !== undefined) Lt.color.set(col); };

  // ---------------- world ----------------
  scene.add(factoryFloor());
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const L = (grp, x, y, z) => v3(x, y, z).applyMatrix4(grp.matrixWorld);
  const station = (x, y = 760) => { const g = new THREE.Group(); g.position.set(x, y, 0); scene.add(g); return g; };
  const steelC = () => plasticMat(0x5d6878, { roughness: 0.3, metalness: 0.85, clearcoat: 0.2, cut: 0x3b4450 });
  const box = (sx, sy, sz, x, y, z, m, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const plinth = (parent, w, d, col = 0x1b222c, h = 30) => box(w, h, d, 0, -h / 2, 0, M.std(col, { roughness: 0.55, metalness: 0.3 }), parent);
  const arrowM = new THREE.MeshBasicMaterial({ color: 0x7FE3FF, transparent: true, opacity: 0, depthTest: false });
  const mkArrow = (s = 1) => { const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.5 * s, 8), arrowM); sh.position.y = 0.25 * s; const h = new THREE.Mesh(new THREE.ConeGeometry(0.13 * s, 0.28 * s, 12), arrowM); h.position.y = 0.62 * s; g.add(sh, h); g.renderOrder = sh.renderOrder = h.renderOrder = 12; return g; };
  const enl = { v: 0 };                      // drives the ENLARGED tag

  // ================= X: macro of the tip on paper (hook, x-ray, mechanism, payoff dive) =================
  const X = station(0); plinth(X, 120, 80, 0x1d232c, 6);
  const PW = 40, PH = 40;                                                               // a paper window that follows the tip
  const paperC = document.createElement('canvas'); paperC.width = 2048; paperC.height = 2048; const pg = paperC.getContext('2d');
  const paperT = new THREE.CanvasTexture(paperC); paperT.colorSpace = THREE.SRGBColorSpace; paperT.anisotropy = 8;
  const fib = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 615; const g = c.getContext('2d'); g.fillStyle = '#F2E8D5'; g.fillRect(0, 0, 1024, 615);
    for (let i = 0; i < 9000; i++) { const x = hash(i * 1.3) * 1024, y = hash(i * 2.7) * 615, a = hash(i * 4.1) * 6.28, l = 3 + hash(i * 5.9) * 10; g.strokeStyle = `rgba(${150 + hash(i) * 60},${130 + hash(i * 2) * 50},${100 + hash(i * 3) * 40},0.16)`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } return c; })();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: paperT, roughness: 0.9, envMapIntensity: 0.3, color: 0xa9a397 })); paper.rotation.x = -Math.PI / 2; paper.position.y = 0.02; paper.receiveShadow = true; X.add(paper);
  const fibPat = pg.createPattern(fib, 'repeat');
  const pathZ = (x) => 0.9 * Math.sin(x * 0.22) + 0.35 * Math.sin(x * 0.61);       // the written line wanders a little
  const SLA = 2.44, SLB = 5.2, SLK = 0.4;                                              // 40 % slow-motion window on the first x-ray turns
  const tauX = (t) => t < SLA ? t : t < SLB ? SLA + (t - SLA) * SLK : SLA + (SLB - SLA) * SLK + (t - SLB);
  const tipX = (t) => -4 + 2.4 * tauX(t);                                                    // mm, continuous (negative t = loop frames)
  const LINE_W = 0.62;
  function paperDraw(x1) {
    const x0 = x1 - PW * 0.3; paper.position.x = x0;                                  // window centre, the tip sits right of centre
    const sx = 2048 / PW, sz = 2048 / PH, toC = (x, z) => [(x - x0 + PW / 2) * sx, (z + PH / 2) * sz];
    pg.save(); pg.setTransform(1, 0, 0, 1, -((x0 * sx) % 1024), 0); pg.fillStyle = fibPat; pg.fillRect(-2048, 0, 6144, 2048); pg.restore();
    pg.save(); pg.lineCap = 'round'; pg.lineJoin = 'round'; pg.strokeStyle = '#1E4FC4'; pg.lineWidth = LINE_W * sx; pg.beginPath();
    let first = true; for (let x = Math.max(-30, x0 - PW / 2 - 1); x <= x1; x += 0.1) { const [cx, cz] = toC(x, pathZ(x)); first ? pg.moveTo(cx, cz) : pg.lineTo(cx, cz); first = false; }
    pg.stroke(); pg.globalCompositeOperation = 'destination-out'; pg.globalAlpha = 0.18; const ox = (x0 * sx) % 2048; for (let i = 0; i < 1500; i++) { let px = hash(i * 3.3) * 2048 - ox; px = ((px % 2048) + 2048) % 2048; pg.fillRect(px, hash(i * 7.7) * 2048, 3, 3); } pg.restore();
    paperT.needsUpdate = true;
  }
  // wet ribbon just behind the ball (shine that dulls as it dries)
  const wetA = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 8; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 8); const t = new THREE.CanvasTexture(c); return t; })();
  const wetM = new THREE.MeshPhysicalMaterial({ color: 0x2F7BFF, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, alphaMap: wetA, envMapIntensity: 2.0, depthWrite: false });
  const WSEG = 40, wet = new THREE.Mesh(new THREE.PlaneGeometry(1, LINE_W * 1.05, WSEG, 1), wetM); wet.rotation.x = -Math.PI / 2; X.add(wet);
  function wetSet(x1) { const p = wet.geometry.attributes.position, len = 6; for (let i = 0; i < p.count; i++) { const u = (i % (WSEG + 1)) / WSEG, side = i < WSEG + 1 ? 1 : -1, x = x1 - len * (1 - u), z = pathZ(x); p.setXYZ(i, x, -(z + side * LINE_W * 0.52), 0.035 + 0.04 * u); } p.needsUpdate = true; wet.geometry.computeVertexNormals(); wet.geometry.computeBoundingSphere(); }
  // the tip
  const TG = new THREE.Group(); X.add(TG);
  const clipT = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);                       // section in the plane of motion, camera on +z
  const tip = makeTip(); TG.add(tip);
  const ghostM = new THREE.MeshPhysicalMaterial({ color: PC.brass, metalness: 0.6, roughness: 0.2, transparent: true, opacity: 0.12, depthWrite: false, clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)] });
  const ghost = new THREE.Mesh(tip.userData.socket.geometry, ghostM); ghost.renderOrder = 6; tip.add(ghost);
  const outline = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7FE3FF, transparent: true, opacity: 0 })); tip.add(outline);
  const film = inkFilm(); TG.add(film);
  // the rest of the pen around the tip: white barrel nose and the refill (tube + ink), all cut by the same x-ray plane
  const xP = penParts(), xBar = xP.front; xP.mats.white.color.set(0xB9BCC0); xP.mats.white.userData.u.uCut.value.set(0xC9CDD3); xBar.position.y = 3; TG.add(xBar);
  const xRef = makeRefill(60); xRef.remove(xRef.userData.tip); TG.add(xRef);
  xRef.userData.ink.material = plasticMat(PC.ink, { roughness: 0.12, clearcoat: 1, cut: 0x5C9BFF }); xRef.userData.setInk(0.95);
  const xClipMats = [xP.mats.white, xP.mats.blue, xRef.userData.ink.material, xRef.userData.tube.material];
  const strM = new THREE.MeshPhysicalMaterial({ color: PC.ink, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.6 });
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 1, 10), strM); X.add(string);
  const TILT = 0.75;
  // arrows: friction at the contact, the ball turning, the paste dragged out
  const arrF = mkArrow(1.2), arrR1 = mkArrow(0.9), arrR2 = mkArrow(0.9), arrI = mkArrow(0.9); X.add(arrF, arrR1, arrR2, arrI);
  function tipSet(t, { xray = 0, roll = 1, tau = t, arrows = 0, openLip = 0 } = {}) {
    const x = tipX(tau), z = pathZ(x);
    TG.position.set(x, TIP.r, z); TG.rotation.set(0, Math.atan2(-(pathZ(x + 0.1) - z), 0.1) * 0.6, -TILT);
    tip.userData.ball.rotation.set(0, 0, TILT - x / TIP.r * roll);
    tip.userData.setOpen(openLip); ghost.geometry = tip.userData.socket.geometry;
    const wz = X.position.z + z; clipT.constant = wz; ghostM.clippingPlanes[0].constant = -wz;
    tip.userData.setClip(xray > 0.5 ? clipT : null); xClipMats.forEach(m => m.clippingPlanes = xray > 0.5 ? [clipT] : []); ghost.visible = xray > 0.5; outline.material.opacity = xray * 0.9;
    // film: from the reservoir side (up the tip axis) forward and down to the paper contact
    film.userData.setArc(1.15, 1.15 + 3.1); film.userData.setFlow(x / TIP.r * roll * 0.16); film.visible = true;
    paperDraw(x); wetSet(x);
    // the stringy stretch where the paste leaves the ball, just behind the contact
    const s = 0.22 + 0.08 * Math.sin(tau * 11);
    string.position.set(x - 0.22, s / 2 + 0.02, z); string.scale.set(1, s, 1); string.rotation.set(0, 0, 0.5);
    arrowM.opacity = arrows; [arrF, arrR1, arrR2, arrI].forEach(a => a.visible = arrows > 0.01);
    arrF.position.set(x - 0.15, 0.06, z + 0.0); arrF.quaternion.setFromUnitVectors(v3(0, 1, 0), v3(-1, 0, 0)); arrF.position.x += 0.1 * Math.sin(tau * 8);
    const ra = -tau * 3; [arrR1, arrR2].forEach((a, i) => { const an = ra + i * Math.PI; const p = v3(Math.cos(an) * 0.78, Math.sin(an) * 0.78, 0); a.position.set(x + p.x, TIP.r + p.y, z + 0.4); a.quaternion.setFromUnitVectors(v3(0, 1, 0), v3(Math.sin(an), -Math.cos(an), 0)); });
    const ia = TILT + 0.4; arrI.position.set(x + Math.sin(ia) * 0.95, TIP.r + Math.cos(ia) * 0.95, z + 0.4); arrI.quaternion.setFromUnitVectors(v3(0, 1, 0), v3(Math.cos(ia), -Math.sin(ia), 0));
  }
  { const pts = []; const P = [[0.36, 6.0], [0.36, 0.62]]; for (let i = 0; i <= 18; i++) { const a = lerp(44, 119, i / 18) * Math.PI / 180; P.push([Math.sin(a) * TIP.seat, Math.cos(a) * TIP.seat]); } P.push([0.64, -0.02], [1.2, 3.4], [1.22, 6.0]);
    P.forEach(([r, y]) => pts.push(v3(r, y, 0.002))); P.slice().reverse().forEach(([r, y]) => pts.push(v3(-r, y, 0.002))); outline.geometry.setFromPoints(pts); }

  // ================= EXP: exploded view (ball, brass socket, refill with ink) =================
  const EXP = station(1500); plinth(EXP, 160, 120);
  const eTip = makeTip(), eBall = eTip.userData.ball; eTip.remove(eBall); const eRef = makeRefill(60); eRef.remove(eRef.userData.tip);
  const EG = new THREE.Group(); EG.position.y = 28; EXP.add(EG); EG.add(eTip, eBall, eRef);
  function expSet(t) { const u = E.io(clamp((t - Ls(4) + 0.1) / 0.8)); EG.rotation.set(0.12, 0.4 + t * 0.35, -0.1);
    eBall.position.set(0, -0.2 - 3.6 * u, 0); eTip.position.set(0, 0, 0); eRef.position.set(0, 4 * u, 0); eBall.rotation.set(t * 1.5, 0, t * 0.8); }

  // ================= MOLD: barrel injection molded (same trick as the toy brick) =================
  // standing mold, two halves parting along x, cut along z so the cavity shows; white plastic fills from the gate down
  const MO = station(3200); plinth(MO, 300, 220);
  const BPROF = [[1.7, 0], [2.2, 0.4], [4.6, 18], [4.8, 22], [4.8, 70]];
  const zc = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), fc = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const mA = plasticMat(0x6b7686, { roughness: 0.3, metalness: 0.8, clearcoat: 0.2, cut: 0xA9B3C1 }), mB = plasticMat(0x6b7686, { roughness: 0.3, metalness: 0.8, clearcoat: 0.2, cut: 0xA9B3C1 }); mA.clippingPlanes = mB.clippingPlanes = [zc];
  const MY = 18;                                                                       // barrel nose height in the mold
  const halfA = box(34, 96, 44, -17, MY + 35, 0, mA, MO), halfB = box(34, 96, 44, 17, MY + 35, 0, mB, MO);
  const cavM = new THREE.MeshStandardMaterial({ color: 0x272d36, roughness: 0.45, metalness: 0.6, side: THREE.BackSide, clippingPlanes: [zc] });
  const lathe = (pr, m, sc = 1) => { const o = new THREE.Mesh(new THREE.LatheGeometry([[0, pr[0][1]], ...pr, [0, pr[pr.length - 1][1]]].map(([r, y]) => new THREE.Vector2(r * sc, y)), 64), m); o.castShadow = true; return o; };
  const cavL = lathe(BPROF, cavM, 1.02), cavR = cavL.clone(); cavL.position.y = MY; MO.add(cavL);
  const fillM = plasticMat(PC.white, { roughness: 0.35, clearcoat: 0.4, cut: 0xffffff }); fillM.clippingPlanes = [zc, fc];
  const fillB = lathe(BPROF, fillM); fillB.position.y = MY; MO.add(fillB);
  const sprue = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 30, 16), hotMat(0x7a1a10)); sprue.position.y = MY + 70 + 15; MO.add(sprue);
  const P0 = penParts(); const barrel = P0.front; MO.add(barrel);
  const tray = box(120, 4, 70, 0, 2, 40, M.std(0x2a3039, { roughness: 0.6, metalness: 0.4 }), MO);
  const exBrick = makeBrick(COL.red); exBrick.scale.setScalar(0.9); exBrick.position.set(-25, 4, 30); exBrick.rotation.y = 0.5; MO.add(exBrick);   // callback to EP 04
  const tMoldClose = Ls(5) - 0.25, tFillS = Wd(5, 'injection') - 0.05, tMoldOpen = Wd(5, 'like') - 0.3;
  function moldSet(t) {
    const cu = E.io(clamp((t - tMoldClose) / 0.35)), ou = E.io(clamp((t - tMoldOpen) / 0.4));
    halfA.position.x = -17 - lerp(14, 0, cu) - ou * 40; halfB.position.x = 17 + lerp(14, 0, cu) + ou * 40;
    const cut = ou < 0.01; zc.constant = cut ? MO.position.z : 1e5; cavL.visible = cut;
    const fu = clamp((t - tFillS) / 0.9), lvl = lerp(71, -1, E.io(fu));
    fc.set(v3(0, 1, 0), -(MO.position.y + MY + lvl)); fillB.visible = cut && fu > 0;
    const cool = clamp((t - tFillS - 0.9) / 0.8); fillM.userData.u.uHot.value = fu > 0 ? 0.7 * (1 - cool) : 0;
    sprue.visible = fu > 0 && fu < 1; sprue.material.userData.u.uK.value = 0.6;
    // open: the finished barrel is pushed out toward the camera and drops onto the tray, next to the toy brick
    const fa = Math.max(0, t - tMoldOpen - 0.25), k = E.o(clamp(fa / 0.5));
    barrel.visible = !cut; const r2 = E.io(clamp(fa / 0.55)); barrel.position.set(lerp(0, 35, k), MY + lerp(0, -MY + 9, clamp(fa / 0.5) ** 2), lerp(0, 46, k));
    barrel.rotation.set(0, 0, lerp(0, Math.PI / 2, r2));
    if (fu > 0 && cool < 1) pt(glow, L(MO, 0, MY + 40, 40), 250 * (1 - cool), 200, 0xFF7A2B);
  }

  // ================= TIPF: the ball drops into the open socket, the lip closes, ink goes in =================
  const TF = station(5200); plinth(TF, 160, 120);
  const fTip = makeTip(); fTip.rotation.z = Math.PI; fTip.position.set(0, 9, 0); TF.add(fTip);          // tip up: the cavity faces the sky
  const fBall = fTip.userData.ball; fTip.remove(fBall); TF.add(fBall);
  const holder = box(6, 3, 6, 0, 1.5, 0, steelC(), TF);
  const clipF = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const tDrop = Ls(6) - 0.2, tCrimp = Wd(6, 'closes') + 0.15;
  const dropSlow = (t) => t < tDrop ? t : tDrop + (t - tDrop) * 0.4;
  fTip.userData.ink.visible = fTip.userData.meniscus.visible = false;
  const crimpM = M.std(0x4a525e, { roughness: 0.35, metalness: 0.9 }); const crimpers = [0, 1, 2].map(i => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.16, 1.2, 12), crimpM); TF.add(c); return c; });
  function tipFSet(t, xray = 1) {
    const tau = dropSlow(t), fa = Math.max(0, tau - tDrop), seatY = 9, yf = seatY + 6 - 150 * fa * fa, y = yf > seatY ? yf : seatY + Math.max(0, 0.5 * Math.sin(Math.min(Math.PI, (fa - 0.2) * 14)) * Math.exp(-(fa - 0.2) * 6));
    fBall.position.set(0, y, 0); fBall.rotation.set(fa * 3, 0, fa * 2);
    const cr = E.io(clamp((t - tCrimp) / 0.35)); fTip.userData.setOpen(1 - cr);
    fTip.userData.setClip(xray > 0.5 ? clipF : null);
    crimpers.forEach((c, i) => { const a = i / 3 * Math.PI * 2 + 0.3, r = lerp(1.6, 0.95, cr); c.position.set(Math.cos(a) * r, seatY + 0.9, Math.sin(a) * r); c.rotation.set(0, 0, 0); c.lookAt(L(TF, 0, seatY + 0.3, 0)); c.rotateX(-Math.PI / 2); c.visible = t > tCrimp - 0.5; });
  }
  // refill being filled through the tip (tip up), x-ray tube
  const RF = station(6400); plinth(RF, 160, 120);
  const rfill = makeRefill(60); rfill.rotation.z = Math.PI; rfill.position.set(0, 70, 0); RF.add(rfill);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 5, 24), M.metal(0xB5BDC7, 0.25)); RF.add(nozzle);
  const tInk = Wd(6, 'injected') - 0.5;
  function refillSet(t) { const u = clamp((t - tInk) / 1.6); rfill.userData.setInk(E.io(u) * 0.92); nozzle.position.set(0, 70 + 3.0 + (u > 0.95 ? (u - 0.95) * 80 : 0), 0); nozzle.visible = u < 1; rfill.userData.tip.userData.setOpen(0); }

  // ================= ASM: assembly on a conveyor, click test =================
  const AS = station(8200); plinth(AS, 420, 160);
  const beltM = new THREE.MeshStandardMaterial({ color: 0x23282f, roughness: 0.8, map: (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#23282f'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#323943'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 4, 64); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(400, 4, 60), beltM); belt.position.y = 2; belt.receiveShadow = true; AS.add(belt);
  const ap = penParts(), aRef = makeRefill(108), aSp = spring();
  const AG = new THREE.Group(); AG.position.set(0, 9.2, 0); AG.rotation.z = -Math.PI / 2; AS.add(AG);          // pen axis along +x on the belt
  AG.add(ap.front, ap.rear, ap.button, aRef, aSp);
  const tAsm = Ls(7) - 0.05, tClick = Wd(7, 'pen') - 0.2;
  function asmSet(t) {
    beltM.map.offset.x = -t * 0.5;
    const u = (i) => E.io(clamp((t - tAsm - i * 0.18) / 0.55));
    ap.front.position.set(0, 0, 0);
    aRef.position.set(0, lerp(150, 3.5, u(0)), lerp(0, 0, 0)); aRef.position.z = lerp(14, 0, u(0)) * 0;
    aSp.position.set(0, lerp(170, 6, u(1)), 0);
    ap.rear.position.set(0, lerp(190, 70, u(2)), 0); ap.rear.rotation.y = (1 - u(2)) * 3;
    ap.button.position.set(0, lerp(230, 131, u(3)), 0);
    // click test: the button is pressed, the tip comes out
    const ck = t > tClick ? Math.sin(Math.PI * clamp((t - tClick) / 0.35)) : 0, out = clamp((t - tClick) / 0.15);
    ap.button.position.y -= 3.5 * ck; aRef.position.y = lerp(aRef.position.y, -1.2, out * u(3));
    AG.position.x = lerp(-20, 20, clamp((t - tAsm) / 3.2));
  }

  // ================= PAY: the finished pen clicks and writes =================
  const PY = station(10400); plinth(PY, 240, 160, 0x1d232c, 6);
  const pc = document.createElement('canvas'); pc.width = 2048; pc.height = 1172; const pcg = pc.getContext('2d'); const pT = new THREE.CanvasTexture(pc); pT.colorSpace = THREE.SRGBColorSpace;
  const pPaper = new THREE.Mesh(new THREE.PlaneGeometry(180, 103), new THREE.MeshStandardMaterial({ map: pT, roughness: 0.9, color: 0xa9a397 })); pPaper.rotation.x = -Math.PI / 2; pPaper.position.y = 0.2; pPaper.receiveShadow = true; PY.add(pPaper);
  const pen = makePen(); PY.add(pen); shadowed(pen);
  const tPClick = Ls(8) - 0.05, tPW0 = Wd(8, 'One') - 0.1;
  function paySet(t) {
    const ck = clamp((t - tPClick) / 0.12), w = clamp((t - tPW0) / 1.6), x = lerp(-40, 30, E.io(w));
    pen.userData.setClick(ck);
    pen.position.set(x, 0.4 + (ck < 1 ? 6 : 0) * (1 - ck), pathZ(x * 0.3) * 3); pen.rotation.set(0, 0, -TILT); pen.rotateX(0.0);
    pen.position.y += 1.2;
    pcg.drawImage(fib, 0, 0, 2048, 1172); pcg.strokeStyle = '#1E4FC4'; pcg.lineWidth = 8; pcg.lineCap = 'round'; pcg.beginPath(); let f = true;
    for (let xx = -40; xx <= x; xx += 0.5) { const cx = (xx + 90) / 180 * 2048, cz = (pathZ(xx * 0.3) * 3 + 51.5) / 103 * 1172; f ? pcg.moveTo(cx, cz) : pcg.lineTo(cx, cz); f = false; } if (w > 0) pcg.stroke(); pT.needsUpdate = true;
  }

  // ================= CHOICE =================
  const chG = station(20000, 0);
  const floorC = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M.std(0x121823, { roughness: 0.6, metalness: 0.2 })); floorC.rotation.x = -Math.PI / 2; floorC.position.y = 2; floorC.receiveShadow = true; chG.add(floorC);
  const pedG = pedestal(78, 130, 0x2BD67B), pedB = pedestal(78, 130, 0x2F7BFF); pedG.position.x = -105; pedB.position.x = 105; chG.add(pedG, pedB);
  const cray = crayon(0x1E9E55); cray.scale.setScalar(2.8); chG.add(cray);
  const clipO = paperClip(); clipO.scale.setScalar(6.5); chG.add(clipO);
  scene.updateMatrixWorld(true);

  // ---------------- camera ----------------
  let shake = 0, TT = 0;
  function cam(pos, subj, fov = 40, low = 0.3) {
    const p = pos.clone(); if (shake > 0) { p.x += noise1(TT * 40) * shake; p.y += noise1(TT * 40 + 9) * shake; p.z += noise1(TT * 40 + 21) * shake; }
    camera.position.copy(p); camera.up.set(0, 1, 0); camera.fov = fov; camera.lookAt(subj);
    const d = p.distanceTo(subj), upv = v3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(subj.clone().addScaledVector(upv, low * Math.tan(fov * Math.PI / 360) * d));
    camera.near = Math.max(0.05, d * 0.02); camera.far = Math.max(60000, d * 80); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const orbit = (c, r, az, el) => c.clone().add(v3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r));

  // ---------------- shots ----------------
  const shots = []; const S = (t0, t1, fn, par = 1) => shots.push({ t0, t1, fn, par });
  const all = [X, EXP, MO, TF, RF, AS, PY, chG];
  const show = (...o) => o.forEach(x => x.visible = true);
  const tc = (t, dy = 0.5) => L(X, tipX(t) + 0.3, TIP.r + dy, pathZ(tipX(t)));
  const hookPlate = (t) => { show(X); tipSet(t); const k = E.o(clamp(t / 1.25)); const c = tc(t, 0.7); cam(orbit(c, lerp(21, 17.85, k), -0.35, 0.05), c, 34, 0.25); rig(c, 20, 1.7); expo = 0.92; ctx.bloom.strength = 0.25; };
  S(0, tSnap, (u, t) => hookPlate(t), 0);
  // R1: the x-ray of the ball in its socket arrives at tSnap
  const xr = (t, opts, r, az, el, dy = 0.7, fov = 34) => { show(X); tipSet(t, { xray: 1, ...opts }); enl.v = 1; const c = tc(t, dy); cam(orbit(c, r * 2.1, az, el), c, fov, 0.25); rig(c, 20, 1.7); expo = 0.92; ctx.bloom.strength = 0.25; };
  const tT1 = Wd(2, 'roller') - 0.1, tT2 = Wd(2, 'one') - 0.05;
  S(tSnap, Ls(2) - 0.05, (u, t) => xr(t, {}, lerp(8.5, 7.6, u), lerp(-0.35, -0.1, u), lerp(0.05, 0.1, u)));
  S(Ls(2) - 0.05, tT1, (u, t) => xr(t, {}, lerp(4.6, 4.0, u), 0.05, 0.08, 0.55));      // tauX runs at 40 % here
  S(tT1, Ls(3) - 0.1, (u, t) => xr(t, {}, lerp(6.5, 6.0, u), -0.25, 0.25, 0.9));
  const tM2 = Wd(3, 'thick') - 0.1, tM3 = Wd(3, 'out') - 0.05;
  S(Ls(3) - 0.1, tM2, (u, t) => xr(t, { arrows: clamp((t - Ls(3)) / 0.2) }, lerp(4.4, 3.8, u), 0.02, 0.06, 0.6));
  S(tM2, tM3, (u, t) => xr(t, { arrows: 1 }, lerp(3.4, 3.0, u), 0.55, 0.05, 0.25));
  S(tM3, Ls(4) - 0.1, (u, t) => xr(t, { arrows: 1 }, lerp(9, 10.5, u), 0.08, 0.35, 1.4));
  // the parts, exploded
  const tE2 = Wd(4, 'brass') - 0.12;
  S(Ls(4) - 0.1, tE2, (u, t) => { show(EXP); expSet(t); enl.v = 1; const c = L(EXP, 0, 28 + 0.6, 0); cam(orbit(c, lerp(41, 37, u), 0.3, 0.02), c, 36, 0); rig(c, 30, 1.8); expo = 0.95; });
  S(tE2, Ls(5) - 0.05, (u, t) => { show(EXP); expSet(t); enl.v = 1; const c = L(EXP, 0, 28 + 3, 0); cam(orbit(c, lerp(24, 22, u), -0.4, 0.2), c, 36, 0); rig(c, 30, 1.8); expo = 0.95; });
  // STEP 1 BARREL
  const tB2 = tMoldOpen - 0.12;
  S(Ls(5) - 0.05, tB2, (u, t) => { show(MO); moldSet(t); const c = L(MO, 0, MY + 38, 0); cam(c.clone().add(v3(lerp(-30, -10, u), lerp(32, 20, u), lerp(195, 180, u))), c, 38, 0.12); rig(c, 120, 1.6); expo = 0.8; ctx.bloom.strength = 0.2; });
  S(tB2, Ls(6) - 0.05, (u, t) => { show(MO); moldSet(t); const c = L(MO, 0, 8, 38); cam(c.clone().add(v3(lerp(-6, 6, u), 95, lerp(155, 145, u))), c, 38, 0.15); rig(c, 120, 1.3); expo = 0.72; ctx.bloom.strength = 0.15; });
  // STEP 2 TIP
  const tF2 = tCrimp - 0.05, tF3 = tInk - 0.1;
  S(Ls(6) - 0.05, tF2, (u, t) => { show(TF); tipFSet(t, 1); enl.v = 1; const c = L(TF, 0, 10.2, 0); cam(c.clone().add(v3(lerp(1.6, 0.8, u), lerp(4.6, 4.0, u), 13)), c, 36, 0.3); rig(c, 14, 1.4); expo = 0.72; ctx.bloom.strength = 0.12; });
  S(tF2, tF3, (u, t) => { show(TF); tipFSet(t, 1); enl.v = 1; const c = L(TF, 0, 9.4, 0); cam(c.clone().add(v3(lerp(-4, -3, u), 4.5, 9)), c, 36, 0.3); rig(c, 14, 1.4); expo = 0.72; ctx.bloom.strength = 0.12; });
  S(tF3, Ls(7) - 0.05, (u, t) => { show(RF); refillSet(t); const c = L(RF, 0, 70 - lerp(0.8, 2.4, u), 0); cam(c.clone().add(v3(10, 4, 30)), c, 38, 0); rig(c, 40, 1.7); expo = 0.85; });
  // STEP 3 ASSEMBLE
  const tA2 = tClick - 0.25, tA3 = Wd(7, 'under') - 0.1;
  S(Ls(7) - 0.05, tA2, (u, t) => { show(AS); asmSet(t); const c = L(AS, 0, 14, 0); cam(c.clone().add(v3(lerp(-40, 0, u), 110, 230)), c, 40, 0.32); rig(c, 160, 1.3); expo = 0.7; ctx.bloom.strength = 0.12; });
  S(tA2, tA3, (u, t) => { show(AS); asmSet(t); const c = L(AS, AG.position.x + 4, 12, 0); cam(c.clone().add(v3(-38, 16, 34)), c, 38, 0.3); rig(c, 60, 1.3); expo = 0.7; ctx.bloom.strength = 0.12; });
  S(tA3, Ls(8) - 0.05, (u, t) => { show(AS); asmSet(t); const c = L(AS, AG.position.x + 60, 12, 0); cam(c.clone().add(v3(lerp(-90, -60, u), 120, 210)), c, 40, 0.35); rig(c, 160, 1.3); expo = 0.7; ctx.bloom.strength = 0.12; });
  // PAYOFF: click, write, dive back into the x-ray of the rolling ball
  const tDive = Wd(8, 'rolling') - 0.45;
  S(Ls(8) - 0.05, tDive, (u, t) => { show(PY); paySet(t); const c = L(PY, pen.position.x - 2, 6, 0); cam(c.clone().add(v3(lerp(-10, 10, u), lerp(110, 70, u), lerp(200, 140, u))), c, 40, 0.32); rig(c, 120, 1.3); expo = 0.72; ctx.bloom.strength = 0.12; });
  S(tDive, tEC, (u, t) => { const k = E.io(u); xr(t, {}, lerp(24, 8, k), lerp(0.55, 0.12, k), lerp(0.4, 0.14, k), 0.7); enl.v = k > 0.3 ? 1 : 0; });
  // END CARD
  const tE3 = tEC + (END - LOOP - tEC) / 2;
  const choiceSet = t => { show(chG); const lt = t - tEC; cray.position.set(-95, 150, 0); cray.rotation.set(0.0, lt * 0.6, 0.3);
    clipO.position.set(105, 250 + Math.sin(lt * 2.2) * 5, 0); clipO.rotation.set(0.15, 0.3 * Math.sin(lt * 1.6), 0.12);
    spotG.intensity = 3 * E.o(clamp(lt / 0.3)); spotB.intensity = 7 * E.o(clamp((lt - 0.15) / 0.3));
    spotG.position.copy(chG.position).add(v3(-260, 520, 260)); spotG.target.position.copy(chG.position).add(v3(-105, 150, 0));
    spotB.position.copy(chG.position).add(v3(260, 520, 260)); spotB.target.position.copy(chG.position).add(v3(105, 150, 0)); };
  S(tEC, tE3, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 215, 0)); cam(chG.position.clone().add(v3(0, lerp(250, 236, E.io(u)), lerp(1080, 1010, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  S(tE3, END - LOOP, (u, t) => { choiceSet(t); const tg = chG.position.clone().add(v3(0, 220, 0)); cam(chG.position.clone().add(v3(lerp(-60, -20, E.io(u)), 160, lerp(950, 900, E.io(u)))), tg, 40, 0.12); rig(tg, 400, 2.0); });
  S(END - LOOP, END + 1, (u, t) => hookPlate(t - (END - 1 / 30)), 0);
  const shotAt = (t) => shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  function stateAt(t) {
    TT = t; shake = 0; expo = 1.15; ctx.bloom.strength = 0.38; enl.v = 0; glow.intensity = 0; spotG.intensity = spotB.intensity = 0; arrowM.opacity = 0;
    all.forEach(o => o.visible = false);
    const sh = shotAt(t); sh.fn(clamp((t - sh.t0) / (sh.t1 - sh.t0)), t);
    ctx.renderer.toneMappingExposure = expo;
    glow.visible = glow.intensity > 0; spotG.visible = spotG.intensity > 0; spotB.visible = spotB.intensity > 0;
    scene.updateMatrixWorld(true); return sh;
  }
  const proj = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; };
  const anchorOf = (fn) => (tt) => { stateAt(tt); return proj(fn(tt)); };

  // ---------------- text events ----------------
  const steps = [{ at: Ls(5), n: 1, word: 'BARREL.' }, { at: Ls(6), n: 2, word: 'TIP.' }, { at: Ls(7), n: 3, word: 'ASSEMBLE.' }];
  const TEXT = []; const T_ = (o) => { TEXT.push(o); return o; };
  const Y = 440;
  const titleO = { l1: 'WHY DOES A PEN WRITE WITH', l2: 'A BALL?', y: 400, words: [Wd(1, 'Why'), Wd(1, 'does'), Wd(1, 'a'), Wd(1, 'pen'), Wd(1, 'have'), Wd(1, 'a', 1)], rawWord: 'PEN', scan: [0.15, 0.85], punchAt: tSnap, until: Ls(2) - 0.06, push: (tt) => clamp(tt / 2) };
  T_({ k: 'title', at: -1, until: Ls(2) - 0.06, label: 'WHY DOES A PEN WRITE WITH / A BALL?', fx: 'RAW TO REAL title, punch on the x-ray snap' });
  T_({ k: 'enl', at: tSnap + 0.15, until: END - LOOP, fx: 'small tag ENLARGED while the tip is shown enlarged' });
  T_({ k: 'cap', at: Wd(2, 'cap'), until: tT2 - 0.04, words: [{ t: 'CAP', a: true, k: 'twist' }, { t: '+', k: 'noun', at: Wd(2, 'and') }, { t: 'ROLLER', a: true, k: 'twist', at: Wd(2, 'roller') }], size: 120 });
  T_({ k: 'cap', at: Wd(2, 'one'), until: Ls(3) - 0.15, words: [{ t: 'ONE', k: 'twist' }, { t: 'BALL.', a: true, k: 'twist', at: Wd(2, 'one') + 0.09 }], size: 150 });
  T_({ k: 'callout', at: Wd(2, 'cap'), until: tT1 - 0.05, text: 'BALL', anchor: anchorOf((tt) => TG.localToWorld(v3(-0.42, 0.1, 0.45))), dx: -170, dy: -150 });
  T_({ k: 'callout', at: tT1 + 0.05, until: Ls(3) - 0.15, text: 'SOCKET', anchor: anchorOf(() => TG.localToWorld(v3(0.8, 1.6, 0))), dx: 150, dy: -200 });
  T_({ k: 'callout', at: Wd(2, 'one') + 0.2, until: Ls(3) - 0.15, text: 'INK', anchor: anchorOf(() => TG.localToWorld(v3(0, 2.6, 0))), dx: -150, dy: -200 });
  T_({ k: 'cap', at: Wd(3, 'Rolling'), until: tM2 - 0.04, words: [{ t: 'ROLLING', k: 'verb' }, { t: 'DRAGS', a: true, k: 'verb', at: Wd(3, 'drags') }], dir: 1, size: 120 });
  T_({ k: 'callout', at: Wd(3, 'tube') - 0.05, until: Ls(4) - 0.15, text: 'REFILL TUBE', anchor: anchorOf(() => TG.localToWorld(v3(0, 6.5, 0))), dx: -280, dy: -160 });
  T_({ k: 'callout', at: Wd(3, 'thick'), until: Wd(3, 'tube') - 0.12, text: 'THICK OIL INK', anchor: anchorOf(() => TG.localToWorld(v3(0, 1.6, 0))), dx: 140, dy: -230 });
  T_({ k: 'callout', at: Wd(4, 'Usually'), until: tE2 - 0.05, text: 'TUNGSTEN CARBIDE', pre: 'USUALLY', anchor: anchorOf(() => eBall.getWorldPosition(new THREE.Vector3())), dx: -230, dy: -110 });
  T_({ k: 'callout', at: Wd(4, 'brass'), until: Ls(5) - 0.1, text: 'BRASS SOCKET', anchor: anchorOf(() => eTip.localToWorld(v3(-0.9, 4.5, 0.4))), dx: -60, dy: -260 });
  for (const s of steps) T_({ k: 'sticker', at: s.at, until: s.at + 1.54, label: 'sticker ' + s.word, s });
  T_({ k: 'cap', at: Wd(5, 'injection'), until: tB2 - 0.04, words: [{ t: 'INJECTION', k: 'noun' }, { t: 'MOLDED', a: true, k: 'verb', at: Wd(5, 'molded') }], size: 100, y: 470 });
  T_({ k: 'callback', at: Wd(5, 'like'), until: Ls(6) - 0.1, fx: 'tag SAME TRICK AS EP. 04 with a tiny brick icon' });
  T_({ k: 'cap', at: Wd(6, 'closes'), until: tF3 - 0.04, words: [{ t: 'CLOSES', a: true, k: 'verb' }, { t: 'AROUND', k: 'noun', at: Wd(6, 'around') }], dir: -1, size: 110 });
  T_({ k: 'cap', at: Wd(6, 'ink'), until: Ls(7) - 0.1, words: [{ t: 'INK', a: true, k: 'noun' }, { t: 'INJECTED', k: 'verb', at: Wd(6, 'injected') }], dir: 1, size: 110 });
  T_({ k: 'odo', at: Wd(7, 'under'), until: Ls(8) - 0.08, value: 5, unit: 'MINUTES', pre: 'UNDER', y: 780, ring: true });
  T_({ k: 'cap', at: Wd(8, 'Click'), until: Wd(8, 'One') - 0.04, words: [{ t: 'CLICK.', a: true, k: 'twist' }], size: 150 });
  T_({ k: 'cap', at: Wd(8, 'rolling'), until: tEC - 0.05, words: [{ t: 'ROLLING.', a: true, k: 'verb' }], size: 130 });
  T_({ k: 'cap', at: Wd(8, 'One'), until: Wd(8, 'rolling') - 0.04, words: [{ t: 'ONE', k: 'noun' }, { t: 'TINY', k: 'noun', at: Wd(8, 'tiny') }, { t: 'BALL.', a: true, k: 'twist', at: Wd(8, 'ball') }], size: 120 });
  T_({ k: 'end', at: tEC, until: END - LOOP, fx: 'NEXT EPISODE? crayon (green) / paper clip (blue), COMMENT BELOW, FOLLOW: NEW ONE EVERY DAY' });
  T_({ k: 'title-loop', at: END - LOOP, until: END + 1, label: 'WHY DOES A PEN WRITE WITH / A BALL?', fx: 'blueprint rebuilds, last frame = frame 0' });
  function tagPill(g, t, o, txt, y, col, icon, xl, fsz = 30) {
    const a = t - o.at, r = o.until - t; if (a < 0 || r < 0) return;
    const s = clamp(a / 0.15) * clamp(r / 0.1), pop = 1 + 0.2 * Math.exp(-a * 9) * Math.cos(a * 30);
    g.save(); g.globalAlpha = s; g.font = `800 ${fsz}px "JBMono"`; const tw = g.measureText(txt).width, iw = icon ? 58 : 0, w = tw + 70 + iw, x = xl ?? SAFE.cx - w / 2, px = x + w / 2;
    g.translate(px, y + 26); g.scale(pop, pop); g.translate(-px, -(y + 26));
    g.fillStyle = 'rgba(16,20,24,0.84)'; g.beginPath(); g.roundRect(x, y, w, 52, 26); g.fill(); g.lineWidth = 3; g.strokeStyle = col; g.stroke();
    if (icon) { g.fillStyle = '#E8261C'; g.beginPath(); g.roundRect(x + 22, y + 20, 40, 20, 3); g.fill(); for (let i = 0; i < 4; i++) { g.beginPath(); g.roundRect(x + 24 + i * 9.5, y + 13, 7, 8, 2); g.fill(); } }
    else { g.fillStyle = col; g.globalAlpha = s * (0.6 + 0.4 * Math.sin(t * 8)); g.beginPath(); g.arc(x + 26, y + 26, 8, 0, 7); g.fill(); g.globalAlpha = s; }
    g.fillStyle = col; g.textBaseline = 'middle'; g.fillText(txt, x + 46 + iw, y + 28); g.restore();
  }
  function timerRing(g, t, o) {
    const a = t - o.at, r = o.until - t; if (a < 0 || r < 0) return;
    const cx = SAFE.cx, cy = o.y - 95, R = 250, fillU = E.io(clamp(a / 1.1)), out = clamp(r / 0.12), sc = (0.85 + 0.15 * clamp(a / 0.2)) * (0.9 + 0.1 * out);
    g.save(); g.globalAlpha = out; g.translate(cx, cy); g.scale(sc, sc);
    g.lineWidth = 22; g.strokeStyle = 'rgba(16,20,24,0.6)'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
    g.lineWidth = 14; g.strokeStyle = 'rgba(243,233,210,0.18)'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
    g.strokeStyle = C.accent; g.lineCap = 'round'; g.shadowColor = C.accent; g.shadowBlur = 18; g.beginPath(); g.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + fillU * Math.PI * 2); g.stroke(); g.shadowBlur = 0;
    for (let i = 0; i < 60; i++) { const an = i / 60 * Math.PI * 2, l = i % 5 ? 10 : 22; g.strokeStyle = 'rgba(243,233,210,0.5)'; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(Math.sin(an) * (R - 26), -Math.cos(an) * (R - 26)); g.lineTo(Math.sin(an) * (R - 26 - l), -Math.cos(an) * (R - 26 - l)); g.stroke(); }
    g.fillStyle = C.cream; g.beginPath(); g.roundRect(-18, -R - 46, 36, 22, 6); g.fill();
    g.restore();
  }
  function drawText(g, t) {
    const sh = shotAt(t); setParallax(((clamp((t - sh.t0) / (sh.t1 - sh.t0)) - 0.5) * 2) * sh.par, 0);
    for (const o of TEXT) {
      if (t < o.at - 0.01 || t > o.until + 0.01) continue;
      if (o.k === 'title') titleRawReal(g, t, titleO);
      else if (o.k === 'title-loop' && t >= END - 1 / 30 - 1e-4) titleRawReal(g, 0, { ...titleO, push: () => 0 });
      else if (o.k === 'title-loop') titleRawReal(g, t, { ...titleO, words: [], loopAt: END - LOOP, push: () => 0 });
      else if (o.k === 'sticker') { inkSwipe(g, t, { at: o.at }); stepSticker(g, t, { at: o.at, n: o.s.n, word: o.s.word }); }
      else if (o.k === 'callout') callout(g, t, o);
      else if (o.k === 'cap') kcap(g, t, { y: o.y || Y, ...o });
      else if (o.k === 'odo') { if (o.ring) timerRing(g, t, o); odometer(g, t, o); }
      else if (o.k === 'enl') { if (enl.v > 0.5 && t < tEC) tagPill(g, t, o, 'ENLARGED', SAFE.top, '#7FE3FF', false, SAFE.left, 24); }
      else if (o.k === 'callback') tagPill(g, t, o, 'SAME TRICK AS EP. 04', 600, '#FF4B3E', true);
      else if (o.k === 'end') endCard2(g, t, { at: o.at, comment: Wd(9, 'Comment'), commentW2: Wd(9, 'below'), follow: Wd(9, 'below') + 0.15, until: o.until, left: 'CRAYON', right: 'PAPER CLIP', next: 'EP. 06', followText: 'FOLLOW: NEW ONE EVERY DAY', rightColor: '#2F7BFF' });
    }
    dock(g, t, { steps: steps.map(s => ({ at: s.at, word: s.word })), total: 3, until: Ls(8) - 0.02 });
  }

  // ---------------- sound events ----------------
  const sfx = [
    { t: 0.0, n: 'pen_scratch' }, { t: 0.15, n: 'ui_tick' }, { t: tSnap, n: 'xray_hit' },
    { t: Wd(2, 'cap'), n: 'glitch' }, { t: Wd(2, 'roller'), n: 'glitch' }, { t: Wd(2, 'one'), n: 'ui_tick' },
    { t: Ls(3), n: 'pen_scratch' }, { t: tM3, n: 'swell' },
    { t: Ls(4) - 0.1, n: 'low_whoosh' }, { t: Wd(4, 'brass'), n: 'metal_click' },
    ...steps.map(s => ({ t: s.at, n: 'swipe' })), ...steps.map(s => ({ t: s.at + 0.2, n: 'ui_tick' })),
    { t: tMoldClose + 0.5, n: 'press_thud' }, { t: tMoldClose + 0.6, n: 'inject_hiss' }, { t: tMoldOpen, n: 'mold_open' }, { t: tMoldOpen + 0.5, n: 'plastic_drop' },
    { t: tDrop + 0.45, n: 'metal_tink' }, { t: tCrimp, n: 'crimp' }, { t: tInk, n: 'inject_hiss' },
    { t: tAsm + 0.2, n: 'plastic_click' }, { t: tAsm + 0.6, n: 'plastic_click' }, { t: tClick, n: 'pen_click' },
    { t: tPClick, n: 'pen_click' }, { t: tPW0, n: 'pen_scratch' }, { t: tDive, n: 'whoosh_soft' },
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
  return { seek, END, sfx, lines, shots: shots.map(s => [s.t0, s.t1]), caps: TEXT.map(o => [o.at, o.until, o.text || o.label || (o.words ? o.words.map(w => w.t).join(' ') : o.value !== undefined ? `${o.pre ? o.pre + ' ' : ''}${o.value} ${o.unit}` : o.k), o.k, o.fx || '']), lockTicks: () => [] };
}
