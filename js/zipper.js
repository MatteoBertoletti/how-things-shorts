// Zipper parts: CSG tooth (nib + scoop), chain laid out from a gap function, tape sweep, slider with cutaway caps.
// Local frame: x across the chain, y along the chain (closed below the slider), z out of the tape.
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { M, shadowed } from './parts.js';
const lerp = (a, b, u) => a + (b - a) * u;

export const P = 3.2;          // tooth pitch on one side (mm)
export const BX = 1.85;        // bead x offset when closed
export const T = 1.52;         // tooth thickness along the chain
export const HEAD = 1.85;      // nib / scoop x (local) -> lands on chain centre when closed

function roundedShape(pts, r) {
  const s = new THREE.Shape(); const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const a = p1.clone().sub(p0).normalize(), b = p2.clone().sub(p1).normalize();
    const rr = Array.isArray(r) ? r[i] : r;
    const q0 = p1.clone().addScaledVector(a, -rr), q1 = p1.clone().addScaledVector(b, rr);
    if (i === 0) s.moveTo(q0.x, q0.y); else s.lineTo(q0.x, q0.y);
    s.quadraticCurveTo(p1.x, p1.y, q1.x, q1.y);
  }
  s.closePath(); return s;
}
const V = (x, y) => new THREE.Vector2(x, y);

let _tooth = null;
export function toothGeometry() {
  if (_tooth) return _tooth;
  const prof = roundedShape([V(-0.75, -0.6), V(3.1, -0.6), V(3.1, 0.6), V(-0.75, 0.6)], [0.22, 0.55, 0.55, 0.22]);
  let base = new THREE.ExtrudeGeometry(prof, { depth: T - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 2, curveSegments: 6 });
  base.rotateX(-Math.PI / 2); // shape y -> -z, extrude z -> y
  base.translate(0, -(T - 0.16) / 2, 0);
  const prep = g => { g = g.index ? g : g; g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = BGU.mergeVertices(g, 1e-4); g.computeVertexNormals(); return g; };
  let scoopGeo = new THREE.SphereGeometry(0.52, 20, 14); scoopGeo.translate(HEAD, -T / 2 - 0.27, 0);
  let res;
  try {
    const ev = new Evaluator(); ev.attributes = ['position', 'normal'];
    const a = new Brush(prep(base)), b = new Brush(prep(scoopGeo));
    a.updateMatrixWorld(); b.updateMatrixWorld();
    res = ev.evaluate(a, b, SUBTRACTION).geometry;
    res.deleteAttribute('normal');
    res = BGU.mergeVertices(res, 1e-4);
    res = BGU.toCreasedNormals(res, 0.6);
  } catch (e) { console.log('CSG failed', e.message); res = base.toNonIndexed(); res.computeVertexNormals(); }
  let nib = new THREE.ConeGeometry(0.42, 0.42, 20, 1); nib.translate(HEAD, T / 2 + 0.19, 0);
  nib = nib.toNonIndexed(); nib.deleteAttribute('uv');
  const r2 = res.index ? res.toNonIndexed() : res;
  for (const k of Object.keys(r2.attributes)) if (!['position', 'normal'].includes(k)) r2.deleteAttribute(k);
  const full = BGU.mergeGeometries([r2, nib]);
  _tooth = { base: r2, nib, full };
  return _tooth;
}

// ---------- gap functions ----------
// slider gap: closed below the throat (d<=0), quadratic in the slider, then a soft splay above it.
const A = 0.035, D1 = 7, SL = 0.49, G12 = A * D1 * D1 + SL * (12 - D1), GMAX = 13;
export function sliderGap(d) {
  if (d <= 0) return [0, 0];
  if (d < D1) return [A * d * d, 2 * A * d];
  if (d < 12) return [A * D1 * D1 + SL * (d - D1), SL];
  const k = SL / (GMAX - G12), e = Math.exp(-k * (d - 12));
  return [GMAX - (GMAX - G12) * e, SL * e];
}

export class Chain {
  constructor({ N = 52, tapeW = 10, toothMat, tapeMat, stops = true, pad = 8, geo = null } = {}) {
    this.N = N; this.tapeW = tapeW; this.pad = pad;
    this.group = new THREE.Group();
    geo = geo || toothGeometry().full;
    this.teeth = [-1, 1].map(() => { const m = new THREE.InstancedMesh(geo, toothMat, N); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); return m; });
    this.hidden = new Set();
    this.y0 = -pad; this.y1 = (N - 1) * P + P / 2 + pad;
    this.tapes = [-1, 1].map(side => { const m = this._strip(side, tapeMat); this.group.add(m); return m; });
    this.top = (N - 1) * P + P / 2 + 2.6;
    if (stops) {
      const sm = toothMat;
      this.topStops = [-1, 1].map(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.5, 2, 2, 2), sm); b.castShadow = true; this.group.add(b); return b; });
      this.botStop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.2, 1.6), sm); this.botStop.position.set(0, -2.4, 0); this.botStop.castShadow = true; this.group.add(this.botStop);
    }
    this._o = new THREE.Object3D();
    this._qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    this._qz = new THREE.Quaternion(); this._z = new THREE.Vector3(0, 0, 1);
  }
  toothY(side, i) { return i * P + (side > 0 ? P / 2 : 0); }
  _profile() {
    const pts = [], rb = 0.45, W = this.tapeW;
    for (let k = 0; k <= 8; k++) { const a = Math.PI - k * (Math.PI - 0.45) / 8; pts.push([rb * Math.cos(a), rb * Math.sin(a)]); }
    pts.push([0.7, 0.17], [W * 0.5, 0.17], [W - 0.18, 0.17]);
    for (let k = 1; k < 6; k++) { const a = Math.PI / 2 - k * Math.PI / 6; pts.push([W - 0.18 + 0.17 * Math.cos(a), 0.17 * Math.sin(a)]); }
    pts.push([W - 0.18, -0.17], [W * 0.5, -0.17], [0.7, -0.17]);
    for (let k = 0; k < 8; k++) { const a = -0.45 - k * (Math.PI - 0.45) / 8; pts.push([rb * Math.cos(a), rb * Math.sin(a)]); }
    return pts;
  }
  _strip(side, mat) {
    const prof = this._profile(), np = prof.length;
    const ns = Math.ceil((this.y1 - this.y0) / 0.8) + 1;
    const pos = new Float32Array(ns * np * 3), uv = new Float32Array(ns * np * 2), idx = [];
    let L = 0; const acc = [0]; for (let k = 1; k < np; k++) { L += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]); acc.push(L); }
    for (let j = 0; j < ns; j++) for (let k = 0; k < np; k++) { const v = j * np + k; uv[v * 2] = acc[k] / 4; uv[v * 2 + 1] = (this.y0 + j * 0.8) / 4; }
    for (let j = 0; j < ns - 1; j++) for (let k = 0; k < np; k++) {
      const a = j * np + k, b = j * np + (k + 1) % np, c = a + np, d = b + np;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    m.userData = { side, prof, ns, np }; return m;
  }
  // gap(side, y) -> [g, dg/dy]  (g = outward bead shift); lift(side,y) optional z lift
  layout(gap, lift = null) {
    const o = this._o; let locked = 0;
    for (const [si, side] of [[0, -1], [1, 1]]) {
      const im = this.teeth[si];
      for (let i = 0; i < this.N; i++) {
        const y = this.toothY(side, i); const [g, dg] = gap(side, y);
        if (g < 0.3 && !this.hidden.has(si * 1000 + i)) locked++;
        const a = Math.atan(dg);
        o.position.set(side * (BX + g), y, lift ? lift(side, y) : 0);
        if (side < 0) o.quaternion.setFromAxisAngle(this._z, a);
        else { this._qz.setFromAxisAngle(this._z, -a); o.quaternion.copy(this._qz).multiply(this._qy); }
        o.scale.setScalar(this.hidden.has(si * 1000 + i) ? 0 : 1);
        o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      // tape
      const t = this.tapes[si], { prof, ns, np } = t.userData, pa = t.geometry.attributes.position.array;
      for (let j = 0; j < ns; j++) {
        const y = this.y0 + j * 0.8; const [g] = gap(side, y); const bx = side * (BX + g); const z0 = lift ? lift(side, y) : 0;
        for (let k = 0; k < np; k++) { const v = (j * np + k) * 3; pa[v] = bx + side * prof[k][0]; pa[v + 1] = y; pa[v + 2] = z0 + prof[k][1]; }
      }
      t.geometry.attributes.position.needsUpdate = true; t.geometry.computeVertexNormals();
      if (this.topStops) { const [g] = gap(side, this.top); this.topStops[si].position.set(side * (BX + g + 0.2), this.top, lift ? lift(side, this.top) : 0); }
    }
    this.locked = locked; return locked;
  }
  // per-tooth brightness (LONG 02 x-ray: teeth glow while they pass through the slider). f(side, y) -> 0..k
  glow(f, base = new THREE.Color(1, 1, 1), hot = new THREE.Color(0.75, 0.9, 1.0)) {
    const c = this._c || (this._c = new THREE.Color());
    for (const [si, side] of [[0, -1], [1, 1]]) {
      const im = this.teeth[si];
      for (let i = 0; i < this.N; i++) { const k = f(side, this.toothY(side, i)); c.copy(base).lerp(hot, Math.min(1, k)).multiplyScalar(1 + 0.6 * k); im.setColorAt(i, c); }
      im.instanceColor.needsUpdate = true;
    }
  }
}

// LONG 02: molded-plastic tooth: a chunky symmetric element (stem + rounded head) with the same nib / scoop logic
let _molded = null;
export function moldedToothGeometry() {
  if (_molded) return _molded;
  const prof = roundedShape([V(-0.9, -0.75), V(1.7, -0.75), V(1.95, -1.0), V(3.25, -1.0), V(3.25, 1.0), V(1.95, 1.0), V(1.7, 0.75), V(-0.9, 0.75)], [0.3, 0.12, 0.25, 0.5, 0.5, 0.25, 0.12, 0.3]);
  let g = new THREE.ExtrudeGeometry(prof, { depth: T - 0.24, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.translate(0, -(T - 0.24) / 2, 0);
  let nib = new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); nib.rotateX(-Math.PI / 2); nib.rotateX(Math.PI); nib.translate(HEAD + 0.35, T / 2 + 0.02, 0);
  nib = nib.toNonIndexed(); nib.deleteAttribute('uv'); g = g.toNonIndexed(); g.deleteAttribute('uv');
  _molded = BGU.mergeGeometries([g, nib]); _molded.computeVertexNormals();
  return _molded;
}

// LONG 02: coil chain: one plastic thread wound into a spiral along each tape edge (the two spirals interlock when closed).
// build(prog) reveals the winding (drawRange) so the coil can "wind" on screen.
export class CoilChain {
  constructor({ N = 40, mat, tapeMat, r = 1.05, tube = 0.36 } = {}) {
    this.N = N; this.group = new THREE.Group(); this.coils = [];
    for (const side of [-1, 1]) {
      const pts = [], turns = N, per = 24;
      for (let i = 0; i <= turns * per; i++) {
        const th = i / per * Math.PI * 2, y = i / per * P + (side > 0 ? P / 2 : 0);
        // a flattened loop: reaches across to the chain centre at the top of each turn (the "head"), back over the tape edge
        const c = Math.cos(th), sn = Math.sin(th);
        pts.push(new THREE.Vector3(side * (BX + 0.2 - (HEAD - 0.1) * 0.5 * (1 + c)), y + 0.25 * sn, r * sn * 0.9));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, turns * per, tube, 8, false);
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.userData = { side, total: geo.index.count };
      this.group.add(m); this.coils.push(m);
    }
    this.chain = new Chain({ N, toothMat: mat, tapeMat, stops: false, pad: 6 });
    this.chain.teeth.forEach(t => t.visible = false); this.group.add(this.chain.group);
  }
  layout(gap) {   // same gap function as Chain: each coil is moved as a whole (good enough for the open/close shots)
    this.chain.layout(gap);
    for (const m of this.coils) { const [g] = gap(m.userData.side, (this.N * P) / 2); m.position.x = m.userData.side * g; }
  }
  build(prog) { for (const m of this.coils) m.geometry.setDrawRange(0, Math.floor(m.userData.total * Math.min(1, Math.max(0, prog)) / 3) * 3); }
}

export class Slider {
  constructor({ mat = M.metal(0xC9CED6, 0.22), capColor = 0xFF5A1F, tab = true } = {}) {
    this.group = new THREE.Group(); this.L = 12;
    const L = this.L, w0 = 3.6, w1 = 7.6;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10); this.wplane = new THREE.Plane();
    const cm = mat.clone(); cm.clippingPlanes = [this.wplane]; cm.clipShadows = true; this.cm = cm;
    const plate = roundedShape([V(-w0, 0), V(w0, 0), V(w1, L), V(-w1, L)], [0.8, 0.8, 1.6, 1.6]);
    const pg = new THREE.ExtrudeGeometry(plate, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2, curveSegments: 5 });
    this.topPlate = new THREE.Mesh(pg, cm); this.topPlate.position.z = 0.9; this.group.add(this.topPlate);
    this.botPlate = new THREE.Mesh(pg, mat); this.botPlate.position.z = -1.4; this.group.add(this.botPlate);
    const fl = s => new THREE.Shape([V(s * w0, 0.3), V(s * (w0 - 0.7), 0.3), V(s * (w1 - 0.7), L - 0.3), V(s * w1, L - 0.3)]);
    this.flShapes = [fl(-1), fl(1)];
    for (const sh of this.flShapes) {
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false });
      const top = new THREE.Mesh(g, cm); top.position.z = 0.25; this.group.add(top);
      const bot = new THREE.Mesh(g, mat); bot.position.z = -0.8; this.group.add(bot);
    }
    this.wedgeShape = new THREE.Shape([V(0, 6.7), V(1.0, 9.2), V(0.9, L - 0.2), V(-0.9, L - 0.2), V(-1.0, 9.2)]);
    this.wedgeMat = cm.clone(); this.wedgeMat.clippingPlanes = [this.wplane]; this.wedgeMat.emissive = new THREE.Color(capColor); this.wedgeMat.emissiveIntensity = 0;
    const wg = new THREE.ExtrudeGeometry(this.wedgeShape, { depth: 1.6, bevelEnabled: false });
    this.wedge = new THREE.Mesh(wg, this.wedgeMat); this.wedge.position.z = -0.8; this.group.add(this.wedge);
    // caps (drawn at the cut height)
    this.capMat = new THREE.MeshStandardMaterial({ color: capColor, emissive: capColor, emissiveIntensity: 0.9, roughness: 0.5, side: THREE.DoubleSide });
    this.caps = {
      plate: new THREE.Mesh(new THREE.ShapeGeometry(plate), this.capMat),
      fl: this.flShapes.map(s => new THREE.Mesh(new THREE.ShapeGeometry(s), this.capMat)),
      wedge: new THREE.Mesh(new THREE.ShapeGeometry(this.wedgeShape), this.capMat),
    };
    this.group.add(this.caps.plate, ...this.caps.fl, this.caps.wedge);
    // ghost edges of the removed top (x-ray)
    this.ghostMat = new THREE.LineBasicMaterial({ color: 0x5EC8E5, transparent: true, opacity: 0, toneMapped: false });
    const eg = new THREE.EdgesGeometry(pg, 30); this.ghost = new THREE.LineSegments(eg, this.ghostMat); this.ghost.position.z = 0.9; this.group.add(this.ghost);
    if (tab) {
      const br = new THREE.TorusGeometry(1.6, 0.45, 8, 18, Math.PI); br.rotateX(Math.PI / 2); br.rotateZ(Math.PI / 2);
      this.bridge = new THREE.Mesh(br, cm); this.bridge.position.set(0, 5.0, 1.45); this.group.add(this.bridge);
      const ts = roundedShape([V(-2.8, 1.8), V(2.8, 1.8), V(2.5, -12.4), V(-2.5, -12.4)], [1.2, 1.2, 1.8, 1.8]);
      const hole = roundedShape([V(-1.6, 0.9), V(1.6, 0.9), V(1.6, -0.9), V(-1.6, -0.9)], 0.6); ts.holes.push(hole);
      const tg = new THREE.ExtrudeGeometry(ts, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 6 });
      this.tab = new THREE.Mesh(tg, cm); this.tab.position.set(0, 5.0, 2.55); this.tab.rotation.x = 0.1; this.group.add(this.tab);
    }
    shadowed(this.group);
    for (const c of [this.caps.plate, ...this.caps.fl, this.caps.wedge]) c.castShadow = false;
    this.setCut(10);
  }
  // cut height in local z: everything above is removed; caps drawn where the cut crosses a solid
  setCut(z, ghost = 0) {
    this.cutZ = z; this.plane.set(new THREE.Vector3(0, 0, -1), z);
    this.caps.plate.visible = z > 0.8 && z < 1.5; this.caps.plate.position.z = z;
    for (const c of this.caps.fl) { c.visible = z > 0.25 && z < 0.8; c.position.z = z; }
    this.caps.wedge.visible = z > -0.8 && z < 0.8; this.caps.wedge.position.z = z + 0.002;
    this.ghostMat.opacity = ghost; this.ghost.visible = ghost > 0.01;
  }
  updatePlane() { this.group.updateMatrixWorld(true); this.wplane.copy(this.plane).applyMatrix4(this.group.matrixWorld); }
  // LONG 02 x-ray: the solid body fades to blue-white glass (k 0..1); the wedge can glow (setWedge)
  setXray(k, tint = 0x8FB6DC) {
    if (!this._xr) { this._xr = []; this.group.traverse(o => { if (o.isMesh && o.material && !o.userData.noXray && !Object.values(this.caps).flat().includes(o) && o.material !== this.capMat) {
      const m0 = o.material; if (!this._xr.find(e => e.m0 === m0)) { const m1 = m0.clone(); this._xr.push({ m0, m1, c0: m0.color.clone() }); } o.material = this._xr.find(e => e.m0 === m0).m1; } }); }
    for (const e of this._xr) { const m = e.m1; m.transparent = k > 0.001; m.opacity = 1 - 0.86 * k; m.depthWrite = k < 0.5; m.color.copy(e.c0).lerp(new THREE.Color(tint), k);
      m.metalness = (e.m0.metalness ?? 0) * (1 - 0.9 * k); m.roughness = lerp(e.m0.roughness ?? 0.5, 0.7, k); if (m.emissive && e.m0 !== this.wedgeMat) { m.emissive.set(0x7FB3D9); m.emissiveIntensity = 0.12 * k; } }
    for (const o of this.group.children) if (o.isMesh) o.castShadow = k < 0.5;
    if (this.tab) this.tab.visible = k < 0.6; if (this.bridge) this.bridge.visible = k < 0.6;
    this.ghostMat.opacity = 0.9 * k; this.ghost.visible = k > 0.01;
  }
  setWedge(k, col = 0xFFD23A) { const w = this._xr ? this._xr.find(e => e.m0 === this.wedgeMat) : null; const m = w ? w.m1 : this.wedgeMat; if (!m.emissive) return; m.emissive.set(col); m.emissiveIntensity = k; }
}
