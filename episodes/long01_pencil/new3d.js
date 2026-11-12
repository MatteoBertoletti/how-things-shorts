// LONG 01: the new 3D scenes. Macro writing (hook / CH. 2 dive / payoff), pencil x-ray, carbon layers + flakes in paper
// fibres, the hardness core (graphite / clay ratio), and the factory floor (CH. 5 + end screen). Units mm, y up.
import * as THREE from 'three';
import { clamp, lerp, E, hash, noise1 } from '../../js/core.js';
import { M, shadowed, conveyor } from '../../js/parts.js';
import { PEN, mats, makePencil, tex } from '../../js/pencil.js';

export function buildNew(ctx, S) {
  const { scene } = ctx; const mt = mats(); const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const station = (x, y = 0) => { const g = new THREE.Group(); g.position.set(x, y, 0); scene.add(g); return g; };

  // ================= MACRO: a pencil tip draws a graphite line on paper (x = 30000) =================
  const MAC = station(30000, 760);
  const base = new THREE.Mesh(new THREE.BoxGeometry(400, 20, 300), M.std(0x1d232c, { roughness: 0.7 })); base.position.y = -10; base.receiveShadow = true; MAC.add(base);
  const PW = 100, PH = 100;                                   // paper window that follows the tip (mm)
  const pc = document.createElement('canvas'); pc.width = 2048; pc.height = 2048; const pg = pc.getContext('2d');
  const pT = new THREE.CanvasTexture(pc); pT.colorSpace = THREE.SRGBColorSpace; pT.anisotropy = 8;
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: pT, roughness: 0.9, color: 0xb9b3a6, envMapIntensity: 0.3 }));
  paper.rotation.x = -Math.PI / 2; paper.position.y = 0.05; paper.receiveShadow = true; MAC.add(paper);
  const fibC = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 683; const g = c.getContext('2d'); g.fillStyle = '#F2E8D5'; g.fillRect(0, 0, 1024, 683);
    for (let i = 0; i < 12000; i++) { const x = hash(i * 1.3) * 1024, y = hash(i * 2.7) * 683, a = hash(i * 4.1) * 6.28, l = 3 + hash(i * 5.9) * 12; g.strokeStyle = `rgba(${140 + hash(i) * 60},${120 + hash(i * 2) * 50},${90 + hash(i * 3) * 40},0.16)`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } return c; })();
  const fibPat = pg.createPattern(fibC, 'repeat');
  const lineZ = (x) => 3.2 * Math.sin(x * 0.09) + 1.4 * Math.sin(x * 0.23 + 1);   // the line wanders on the page
  const SPEED = 9;                                                                  // mm per second
  const tipX = (tau) => -20 + SPEED * tau;
  function paperDraw(x1) {
    const x0 = x1 - PW * 0.35; paper.position.x = x0;
    const sx = 2048 / PW, sz = 2048 / PH, toC = (x, z) => [(x - x0 + PW / 2) * sx, (z + PH / 2) * sz];
    pg.save(); pg.setTransform(1, 0, 0, 1, -((x0 * sx) % 1024), 0); pg.fillStyle = fibPat; pg.fillRect(-2048, 0, 6144, 2048); pg.restore();
    // ruled lines (cold fill colour, faint)
    pg.save(); pg.globalAlpha = 0.16; pg.strokeStyle = '#7FB3D9'; pg.lineWidth = 3; for (let z = -24; z <= 24; z += 12) { const [, cy] = toC(0, z + 6); pg.beginPath(); pg.moveTo(0, cy); pg.lineTo(2048, cy); pg.stroke(); } pg.restore();
    // the graphite line: many soft dabs (grainy, slightly shiny)
    pg.save(); const xs = Math.max(-60, x0 - PW / 2 - 2);
    for (let x = xs; x <= x1; x += 0.05) { const z = lineZ(x), [cx, cy] = toC(x, z), k = Math.floor(x * 20);
      pg.fillStyle = `rgba(${44 + hash(k) * 20},${47 + hash(k) * 20},${55 + hash(k) * 22},${0.18 + 0.2 * hash(k * 1.7)})`; const w = 0.9 * sx;
      pg.fillRect(cx - 2, cy - w / 2 + (hash(k * 3.1) - 0.5) * 8, 4, w * (0.7 + 0.3 * hash(k * 5.3))); }
    pg.globalCompositeOperation = 'destination-out'; pg.globalAlpha = 0.35; for (let i = 0; i < 2600; i++) pg.fillRect(hash(i * 3.3) * 2048, hash(i * 7.7) * 2048, 3, 3);
    pg.restore(); pT.needsUpdate = true;
  }
  const writer = makePencil(); MAC.add(writer);
  const TILT = 0.95;                                                                // pencil lean (rad from vertical), top leans to +x
  function macroSet(tau) {
    const x = tipX(tau), z = lineZ(x); paperDraw(x);
    writer.position.set(x, 0.2, z); writer.rotation.set(0, 0, 0); writer.rotateY(0.35); writer.rotateZ(-TILT); writer.rotateX(0.0);
    writer.position.y += 0.02 * Math.sin(tau * 30);
  }
  const macTip = (tau) => MAC.localToWorld(v3(tipX(tau), 0.6, lineZ(tipX(tau))));

  // ================= X-RAY: the same pencil cut along its length, the core glows (x = 32000) =================
  const XR = station(32000, 760);
  const xp = makePencil(); XR.add(xp); xp.rotation.z = -Math.PI / 2;             // lying along +x, point at x = 0
  const clipZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), clipS = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  XR.rotation.x = -Math.PI / 2;                                                     // the cut face looks up
  const xMats = []; xp.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = [clipZ, clipS]; o.material.clipIntersection = true; o.material.side = THREE.FrontSide; xMats.push(o.material); } });
  // the section face: pencil silhouette in the cut plane, painted (cedar + core + lacquer edges + ferrule + eraser)
  const secC = document.createElement('canvas'); secC.width = 2048; secC.height = 128; const sg = secC.getContext('2d');
  { const Lt = PEN.L, px = (mm) => mm / Lt * 2048, R = PEN.R, py = (mm) => (mm / (2 * R) + 0.5) * 128;
    sg.fillStyle = '#C98A52'; sg.fillRect(0, 0, 2048, 128);
    for (let k = 0; k < 14; k++) { sg.strokeStyle = `rgba(120,64,30,${0.2 + 0.2 * hash(k)})`; sg.lineWidth = 2; sg.beginPath(); for (let x = 0; x <= 2048; x += 16) sg.lineTo(x, 8 + k * 8.5 + 3 * Math.sin(x * 0.01 + k)); sg.stroke(); }
    sg.fillStyle = '#F7C21C'; sg.fillRect(px(PEN.cone), 0, px(PEN.body), py(-R + 0.35)); sg.fillRect(px(PEN.cone), py(R - 0.35), px(PEN.body), 128);
    sg.fillStyle = '#2b2f36'; sg.fillRect(0, py(-PEN.core), px(PEN.cone + PEN.body), py(PEN.core) - py(-PEN.core));
    sg.fillStyle = '#EFE3C2'; sg.fillRect(px(PEN.cone), py(0) - 1, px(PEN.body), 2);
    const fg = sg.createLinearGradient(0, 0, 0, 128); fg.addColorStop(0, '#9aa3ad'); fg.addColorStop(0.5, '#e6eaef'); fg.addColorStop(1, '#8a939d'); sg.fillStyle = fg; sg.fillRect(px(PEN.cone + PEN.body), 0, px(PEN.fer), 128);
    sg.fillStyle = '#F29AA8'; sg.fillRect(px(PEN.cone + PEN.body + PEN.fer), 4, px(PEN.er), 120); }
  const secT = new THREE.CanvasTexture(secC); secT.colorSpace = THREE.SRGBColorSpace;
  const secShape = new THREE.Shape(); { const R = PEN.R, Lt = PEN.L; secShape.moveTo(0, 0); secShape.lineTo(PEN.cone, R); secShape.lineTo(Lt - 1.5, R); secShape.quadraticCurveTo(Lt, R, Lt, R - 1.5); secShape.lineTo(Lt, -R + 1.5); secShape.quadraticCurveTo(Lt, -R, Lt - 1.5, -R); secShape.lineTo(PEN.cone, -R); secShape.lineTo(0, 0); }
  const secGeo = new THREE.ShapeGeometry(secShape, 8); { const p = secGeo.attributes.position, uv = secGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / PEN.L, p.getY(i) / (2 * PEN.R) + 0.5); }
  const secM = new THREE.MeshStandardMaterial({ map: secT, roughness: 0.6, emissive: 0xFFD23A, emissiveIntensity: 0, emissiveMap: null, clippingPlanes: [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)] });
  const sec = new THREE.Mesh(secGeo, secM); sec.position.z = 0.02; XR.add(sec);
  const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(PEN.cone + PEN.body, PEN.core * 2, 0.1), new THREE.MeshBasicMaterial({ color: 0xFFD23A, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [secM.clippingPlanes[0]] }));
  coreGlow.position.set((PEN.cone + PEN.body) / 2, 0, 0.08); XR.add(coreGlow);
  const xfloor = new THREE.Mesh(new THREE.PlaneGeometry(900, 600), new THREE.MeshStandardMaterial({ color: 0x4a5464, roughness: 0.8, metalness: 0.1 })); xfloor.rotation.x = -Math.PI / 2; xfloor.position.set(95, -PEN.R - 0.5, 0); xfloor.receiveShadow = true;
  const XRF = new THREE.Group(); XRF.position.copy(XR.position); scene.add(XRF); XRF.add(xfloor);
  const ghostM = new THREE.MeshBasicMaterial({ color: 0x7FB3D9, transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide });
  const ghost = new THREE.Mesh(new THREE.CylinderGeometry(PEN.R * 1.02, PEN.R * 1.02, PEN.L - PEN.cone, 6, 1, true), ghostM); ghost.rotation.z = -Math.PI / 2; ghost.position.x = PEN.cone + (PEN.L - PEN.cone) / 2; XR.add(ghost);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.ShapeGeometry(secShape)), new THREE.LineBasicMaterial({ color: 0x7FE3FF, transparent: true, opacity: 0 })); edges.position.z = 0.05; XR.add(edges);
  function xraySet(t, { scan = 1, glow = 0 }) {
    XR.rotation.set(-Math.PI / 2, 0, 0.0); XR.updateMatrixWorld(true); const sx = lerp(-2, PEN.L + 2, scan), M4 = XR.matrixWorld;
    clipZ.set(v3(0, 0, -1), 0).applyMatrix4(M4); clipS.set(v3(1, 0, 0), -sx).applyMatrix4(M4); secM.clippingPlanes[0].set(v3(-1, 0, 0), sx).applyMatrix4(M4);
    secM.emissiveIntensity = 0; coreGlow.material.opacity = 0.55 * glow * (0.85 + 0.15 * Math.sin(t * 7));
    ghostM.opacity = 0.06 * clamp(scan * 3); edges.material.opacity = 0.9 * clamp(scan * 3);
  }

  // ================= CARBON: stacked graphene sheets (instanced) + flakes caught in paper fibres (x = 34000) =================
  const CB = station(34000, 760);
  const aGeo = new THREE.SphereGeometry(1, 16, 12), bGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 8);
  const atomM = new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.6, roughness: 0.3, envMapIntensity: 1.5 });
  const atomTop = new THREE.MeshStandardMaterial({ color: 0xFFD23A, metalness: 0.2, roughness: 0.35, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
  const bondM = new THREE.MeshStandardMaterial({ color: 0x7FB3D9, metalness: 0.3, roughness: 0.4, emissive: 0x16324a, emissiveIntensity: 0.6 });
  const s = 1.42;  // bond length (scaled units)
  function sheet(nx, nz, mat) {
    const pts = [], bonds = [], key = new Map(); const add = (x, z) => { const k = Math.round(x * 100) + ',' + Math.round(z * 100); if (!key.has(k)) { key.set(k, pts.length); pts.push([x, z]); } return key.get(k); };
    const dx = s * Math.sqrt(3), dz = s * 1.5;
    for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) { const cx = c * dx + (r % 2) * dx / 2, cz = r * dz, vs = []; for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3; vs.push(add(cx + s * Math.cos(an), cz + s * Math.sin(an))); } for (let k = 0; k < 6; k++) { const a = vs[k], b = vs[(k + 1) % 6]; bonds.push(a < b ? a + '-' + b : b + '-' + a); } }
    const B = [...new Set(bonds)].map(k => k.split('-').map(Number));
    const g = new THREE.Group(); const ai = new THREE.InstancedMesh(aGeo, mat, pts.length), bi = new THREE.InstancedMesh(bGeo, bondM, B.length); const o = new THREE.Object3D();
    const cxm = pts.reduce((a, p) => a + p[0], 0) / pts.length, czm = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    pts.forEach((p, i) => { o.position.set(p[0] - cxm, 0, p[1] - czm); o.rotation.set(0, 0, 0); o.scale.setScalar(0.42); o.updateMatrix(); ai.setMatrixAt(i, o.matrix); });
    B.forEach(([a, b], i) => { const A = v3(pts[a][0] - cxm, 0, pts[a][1] - czm), Bq = v3(pts[b][0] - cxm, 0, pts[b][1] - czm); o.position.copy(A).add(Bq).multiplyScalar(0.5); o.scale.set(1, A.distanceTo(Bq), 1); o.quaternion.setFromUnitVectors(v3(0, 1, 0), Bq.clone().sub(A).normalize()); o.updateMatrix(); bi.setMatrixAt(i, o.matrix); });
    ai.castShadow = bi.castShadow = true; g.add(ai, bi); return g;
  }
  const LAY = new THREE.Group(); LAY.position.y = 60; CB.add(LAY);
  const sheets = [0, 1, 2, 3, 4].map(i => { const sh = sheet(12, 9, i === 0 ? atomTop : atomM); sh.position.set((i % 2) * s * Math.sqrt(3) / 2, -i * 3.35, (i % 2) * s / 2); LAY.add(sh); return sh; });
  // paper fibres + flakes (the line seen from very close)
  const FIB = new THREE.Group(); FIB.position.set(400, 0, 0); CB.add(FIB);
  const fibM = new THREE.MeshStandardMaterial({ color: 0xE9DFC8, roughness: 0.85, envMapIntensity: 0.4 });
  for (let i = 0; i < 70; i++) { const pts = []; const z0 = (hash(i * 2.1) - 0.5) * 120, y0 = hash(i * 3.3) * 6; for (let k = 0; k <= 6; k++) pts.push(v3(-120 + k * 40, y0 + 2 * Math.sin(k + i), z0 + (hash(i * 7 + k) - 0.5) * 30));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 1.6 + 1.6 * hash(i * 5.5), 8), fibM); tube.castShadow = tube.receiveShadow = true; FIB.add(tube); }
  const flM = new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.75, roughness: 0.22, envMapIntensity: 1.8 });
  const flakes = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.12, 6), flM, 260); FIB.add(flakes); flakes.castShadow = true;
  { const o = new THREE.Object3D(); for (let i = 0; i < 260; i++) { o.position.set((hash(i * 1.7) - 0.5) * 220, 3 + hash(i * 2.9) * 9, (hash(i * 4.3) - 0.5) * 50); o.rotation.set((hash(i * 5.1) - 0.5) * 1.2, hash(i * 6.7) * 6, (hash(i * 7.9) - 0.5) * 1.2); o.scale.setScalar(2 + 4 * hash(i * 8.3)); o.updateMatrix(); flakes.setMatrixAt(i, o.matrix); } }
  function carbonSet(t, { slide = 0, build = 1 }) {
    sheets.forEach((sh, i) => { const b = clamp(build * 5 - i); sh.visible = b > 0; sh.scale.setScalar(Math.max(0.001, E.back(b))); });
    sheets[0].position.x = slide * 26; sheets[1].position.x = s * Math.sqrt(3) / 2 + slide * 6;
    LAY.rotation.set(0.0, t * 0.08, 0);
  }

  // ================= CORE: the hardness recipe, a core made of graphite flakes and clay grains (x = 36000) =================
  const CR = station(36000, 760);
  const NC = 1400; const grainGeo = new THREE.IcosahedronGeometry(1, 0);
  const grainM = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.45, envMapIntensity: 1.2 });
  const grains = new THREE.InstancedMesh(grainGeo, grainM, NC); grains.castShadow = true; CR.add(grains);
  const gp = []; { const o = new THREE.Object3D(); for (let i = 0; i < NC; i++) { const r = Math.sqrt(hash(i * 1.3)) * 18, a = hash(i * 2.9) * Math.PI * 2, y = (hash(i * 4.1) - 0.5) * 120; gp.push([Math.cos(a) * r, y, Math.sin(a) * r, hash(i * 6.3)]); o.position.set(Math.cos(a) * r, y, Math.sin(a) * r); o.rotation.set(i, i * 1.3, i * 0.7); o.scale.setScalar(1.6 + 1.6 * hash(i * 9.1)); o.updateMatrix(); grains.setMatrixAt(i, o.matrix); } }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(19.5, 19.5, 124, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); CR.add(glass);
  const cG = new THREE.Color(0x24272d), cC = new THREE.Color(0xA7AEB7);
  let lastR = -1;
  function coreSet(t, ratio) {
    if (Math.abs(ratio - lastR) > 0.002) { for (let i = 0; i < NC; i++) grains.setColorAt(i, gp[i][3] < ratio ? cG : cC); grains.instanceColor.needsUpdate = true; lastR = ratio; }
    CR.rotation.set(0.0, t * 0.4, 0.12);
  }

  // ================= FACTORY: conveyors of raw pencils (x = 38000) =================
  const FAC = station(38000, 0);
  const belts = [-260, 260].map(z => { const c = conveyor(6000, 360); c.rotation.y = Math.PI / 2; c.position.set(0, 760, z); FAC.add(c); return c; });
  const NS = 2 * 220; const stickGeo = new THREE.CylinderGeometry(PEN.R, PEN.R, 184, 6); const capGeo = new THREE.CircleGeometry(PEN.R, 6);
  const sticks = new THREE.InstancedMesh(stickGeo, mt.woodSide, NS); sticks.castShadow = sticks.receiveShadow = true; FAC.add(sticks);
  const ends = new THREE.InstancedMesh(new THREE.CircleGeometry(PEN.core, 16), mt.graphite, NS * 2); FAC.add(ends);
  const capsI = new THREE.InstancedMesh(capGeo, mt.woodEnd, NS * 2); FAC.add(capsI);
  // background machines (generic boxes with warm lights)
  const mm = M.std(0x2b323c, { roughness: 0.55, metalness: 0.4 });
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(500, 700 + 300 * hash(i), 600), mm); b.position.set(-2500 + i * 1000, 400, -1300 - 300 * hash(i * 2)); b.castShadow = b.receiveShadow = true; FAC.add(b);
    const l = new THREE.Mesh(new THREE.BoxGeometry(300, 18, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xFFD23A : 0x7FB3D9 })); l.position.set(b.position.x, 600, b.position.z + 305); FAC.add(l); }
  const lamps = []; for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(60, 90, 40, 24, 1, true), M.metal(0x8f98a3, 0.4)); p.position.set(-2500 + i * 1000, 1900, 0); FAC.add(p); }
  function factorySet(t) {
    const o = new THREE.Object3D(); let k = 0, c = 0; const spd = 120;
    belts.forEach((b, bi) => { b.userData.uOff.value = -t * spd; for (let i = 0; i < 220; i++) { const z0 = bi ? 260 : -260; const x = ((i * 26 + t * spd) % 5720) - 2860;
      o.position.set(x, 760 + PEN.R * 0.87, z0); o.rotation.set(Math.PI / 2, 0, 0); o.rotateY(0); o.scale.setScalar(1); o.updateMatrix(); sticks.setMatrixAt(k, o.matrix);
      for (const sgn of [-1, 1]) { o.position.set(x, 760 + PEN.R * 0.87, z0 + sgn * 92.05); o.rotation.set(0, sgn > 0 ? 0 : Math.PI, Math.PI / 6 + Math.PI / 2); o.updateMatrix(); capsI.setMatrixAt(c, o.matrix); o.position.z += sgn * 0.05; o.updateMatrix(); ends.setMatrixAt(c, o.matrix); c++; }
      k++; } });
    sticks.instanceMatrix.needsUpdate = capsI.instanceMatrix.needsUpdate = ends.instanceMatrix.needsUpdate = true;
  }
  scene.updateMatrixWorld(true);
  return { MAC, macroSet, macTip, tipX, lineZ, writer, XR, XRF, xp, xraySet, sec, CB, LAY, sheets, FIB, carbonSet, CR, coreSet, FAC, factorySet, all: [MAC, XR, XRF, CB, CR, FAC] };
}
