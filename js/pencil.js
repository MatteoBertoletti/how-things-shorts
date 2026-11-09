// EP 03 parts: procedural cedar (growth rings), graphite / clay materials, pencil geometry (hexagonal, no marks
// except an optional "HB" stamp), grooved slats, the slat -> hexagon cross-section, a pencil field, a toy brick,
// and a tiny stroke font for handwriting. Units: millimetres, y up.
import * as THREE from 'three';
import { M, shadowed } from './parts.js';
import { hash, clamp, lerp } from './core.js';

export const PEN = { R: 4.0, core: 1.05, cone: 18, body: 150, fer: 12, er: 9 };
PEN.L = PEN.cone + PEN.body + PEN.fer + PEN.er;

// ---------- value noise for the textures ----------
const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(a * 157.31 + b * 31.7 + s * 7.13); return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); };
const fbm = (x, y, s) => vn(x, y, s) * 0.55 + vn(x * 2.1, y * 2.1, s + 1) * 0.28 + vn(x * 4.3, y * 4.3, s + 2) * 0.17;
function canvasTex(w, h, fn, rep = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, gg, b] = fn(x / w, y / h); const i = (y * w + x) * 4; im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = b; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const CED = { light: [214, 150, 98], base: [186, 116, 70], dark: [128, 70, 40] };
const mix3 = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(u)));
// side grain: stripes along v (y in canvas), wavy
function sideGrain(u, v) {
  const w = u * 9 + fbm(u * 3, v * 1.2, 3) * 1.6 + 0.25 * Math.sin(v * 6.28 + u * 2);
  const f = w - Math.floor(w), late = Math.pow(clamp(1 - Math.abs(f - 0.82) / 0.16), 1.6);
  let c = mix3(CED.light, CED.base, f * 0.8); c = mix3(c, CED.dark, late * 0.85);
  const n = (fbm(u * 60, v * 4, 9) - 0.5) * 22; return c.map(x => clamp(x + n, 0, 255));
}
// end grain: concentric growth rings around an off-centre pith
function endGrain(u, v) {
  const dx = u - 0.18, dy = v + 0.35, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy) * 14 + fbm(Math.cos(a) * 2 + 3, Math.sin(a) * 2 + 3, 5) * 0.9;
  const f = r - Math.floor(r), late = Math.pow(clamp(1 - Math.abs(f - 0.85) / 0.14), 1.5);
  let c = mix3(CED.light, CED.base, f * 0.7); c = mix3(c, CED.dark, late * 0.9);
  const n = (fbm(u * 90, v * 90, 4) - 0.5) * 26; return c.map(x => clamp(x + n, 0, 255));
}
let _T = null;
export function tex() {
  if (_T) return _T;
  _T = {
    side: canvasTex(512, 512, sideGrain), end: canvasTex(512, 512, endGrain),
    bark: canvasTex(256, 256, (u, v) => { const f = fbm(u * 14, v * 3, 11), k = Math.pow(clamp(1 - Math.abs(fbm(u * 22, v * 1.5, 12) - 0.5) * 8), 2); const c = mix3([92, 64, 44], [52, 34, 24], f * 0.9 + k * 0.6); return c; }, [3, 1]),
    grain: canvasTex(256, 256, (u, v) => { const n = fbm(u * 40, v * 40, 21) * 0.7 + hash(Math.floor(u * 256) * 3.1 + Math.floor(v * 256) * 7.7) * 0.3; const x = Math.round(70 + n * 140); return [x, x, x]; }, [4, 4], false),
    paper: canvasTex(512, 512, (u, v) => { const n = (fbm(u * 80, v * 80, 31) - 0.5) * 10 + (hash(Math.floor(u * 512) + Math.floor(v * 512) * 517) - 0.5) * 6; return [236 + n, 229 + n, 214 + n]; }),
  };
  return _T;
}
// ---------- materials ----------
let _M = null;
export function mats() {
  if (_M) return _M;
  const T = tex();
  const wood = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.78, bumpMap: tex().grain, bumpScale: 0.3, envMapIntensity: 0.5, ...o });
  _M = {
    woodSide: wood(T.side), woodEnd: wood(T.end),
    bark: new THREE.MeshStandardMaterial({ map: T.bark, bumpMap: T.bark, bumpScale: 3, roughness: 0.95, envMapIntensity: 0.4 }),
    lacquer: new THREE.MeshPhysicalMaterial({ color: 0xF7C21C, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.85 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.65, roughness: 0.34, envMapIntensity: 1.4 }),
    powder: new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.55, roughness: 0.5, bumpMap: T.grain, bumpScale: 1.6, envMapIntensity: 1.5 }),
    clay: new THREE.MeshStandardMaterial({ color: 0x6c737c, metalness: 0, roughness: 0.96, bumpMap: T.grain, bumpScale: 1.8, envMapIntensity: 0.5 }),
    paste: new THREE.MeshStandardMaterial({ color: 0x45484f, metalness: 0.3, roughness: 0.45, bumpMap: T.grain, bumpScale: 1.0, envMapIntensity: 1.1 }),
    glue: new THREE.MeshPhysicalMaterial({ color: 0xEFE3C2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 }),
    ferrule: new THREE.MeshStandardMaterial({ color: 0xCDD2DA, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 }),
    eraser: new THREE.MeshStandardMaterial({ color: 0xF29AA8, roughness: 0.85, envMapIntensity: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5a6470, metalness: 0.75, roughness: 0.38, envMapIntensity: 1.0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x232a33, metalness: 0.4, roughness: 0.55 }),
    paper: new THREE.MeshStandardMaterial({ map: T.paper, roughness: 0.95, envMapIntensity: 0.4 }),
  };
  return _M;
}
// hot material: emissive gradient along the object + fresnel (never a flat colour). k in 0..1
export function hotMat(base = 0x3a2a26) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.5, metalness: 0.2, emissive: 0xFF4A1A, emissiveIntensity: 0 });
  m.userData.u = { uK: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uK = m.userData.u.uK;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vNw;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix*vec4(transformed,1.0)).xyz; vNw = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uK; varying vec3 vWp; varying vec3 vNw;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 V = normalize(cameraPosition - vWp); float fr = pow(1.0 - abs(dot(normalize(vNw), V)), 2.0);
        float g = 0.5 + 0.5*sin(vWp.x*0.08 + vWp.z*0.05);
        vec3 deep = vec3(0.55,0.05,0.01), mid = vec3(1.0,0.22,0.03), hi = vec3(1.0,0.55,0.15);
        vec3 ec = mix(mix(deep, mid, uK), hi, uK*uK*(0.4+0.6*g));
        totalEmissiveRadiance = ec * uK * 2.2 * (0.55 + 0.6*(1.0-fr)) + vec3(1.0,0.4,0.1)*fr*uK*0.6;`);
  };
  return m;
}

// ---------- pencil ----------
// along +y, graphite point at y = 0. parts: cone (wood), tip (graphite), body, ferrule (+ rings), eraser
export function pencilGeos(R = PEN.R) {
  const { core, cone, body, fer, er } = PEN;
  const g = {};
  g.cone = new THREE.CylinderGeometry(R * 0.93, core, cone - 3, 24, 1, true); g.cone.translate(0, 3 + (cone - 3) / 2, 0);
  g.tip = new THREE.CylinderGeometry(core, 0.18, 3, 16); g.tip.translate(0, 1.5, 0);
  g.body = new THREE.CylinderGeometry(R, R, body, 6); g.body.translate(0, cone + body / 2, 0);
  g.bodyCap = new THREE.CircleGeometry(R, 6); g.bodyCap.rotateX(Math.PI / 2); g.bodyCap.rotateY(Math.PI / 6 - Math.PI / 6); g.bodyCap.translate(0, cone + 0.01, 0);
  g.fer = new THREE.CylinderGeometry(R * 1.02, R * 1.02, fer, 32); g.fer.translate(0, cone + body + fer / 2, 0);
  g.ring = new THREE.TorusGeometry(R * 1.03, 0.45, 6, 32); g.ring.rotateX(Math.PI / 2);
  g.er = new THREE.CylinderGeometry(R * 0.96, R * 0.96, er, 32); g.er.translate(0, cone + body + fer + er / 2, 0);
  g.erTop = new THREE.SphereGeometry(R * 0.96, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.erTop.scale(1, 0.25, 1); g.erTop.translate(0, cone + body + fer + er, 0);
  return g;
}
function hbTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128); g.fillStyle = '#16181c'; g.font = '700 92px "JBMono"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HB', 256, 68);
  const t = new THREE.CanvasTexture(c); return t;
}
// finished pencil. opts: { glow } -> group with userData { parts, setStamp(a), setGlow(k) }
export function makePencil({ R = PEN.R, painted = true } = {}) {
  const mt = mats(), G = pencilGeos(R), grp = new THREE.Group();
  const lac = painted ? mt.lacquer.clone() : mt.woodSide;
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); grp.add(o); return o; };
  const parts = { cone: add(G.cone, mt.woodSide), tip: add(G.tip, mt.graphite), body: add(G.body, lac), fer: add(G.fer, mt.ferrule), er: add(G.er, mt.eraser), erTop: add(G.erTop, mt.eraser) };
  parts.rings = [-3.5, 0, 3.5].map(d => { const o = add(G.ring, mt.ferrule); o.position.y = PEN.cone + PEN.body + PEN.fer / 2 + d; return o; });
  // HB stamp decal on one face (faces of a 6-segment cylinder sit between vertices)
  const dm = new THREE.MeshBasicMaterial({ map: hbTexture(), transparent: true, opacity: 0, depthWrite: false });
  const face = R * Math.cos(Math.PI / 6);
  const dec = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.0 * 4, R * 1.0), dm); dec.rotation.set(0, 0, Math.PI / 2);
  const holder = new THREE.Group(); holder.add(dec); dec.position.set(0, 0, 0); grp.add(holder);
  // face normal direction: between vertex 0 (angle 0 -> +z in three's cylinder) and vertex 1
  const ang = Math.PI / 6; holder.position.set(Math.sin(ang) * (face + 0.05), PEN.cone + PEN.body - 26, Math.cos(ang) * (face + 0.05)); holder.rotation.y = ang;
  parts.hb = dec;
  grp.userData = { parts, lac, setStamp: (a) => { dm.opacity = clamp(a); dec.visible = a > 0.001; }, R };
  grp.userData.setStamp(0);
  return shadowed(grp);
}
// unpainted hexagonal stick (after shaping): wood body, end grain caps with the core
export function makeStick(len = 180, R = PEN.R) {
  const mt = mats(), g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 6, 1, true), mt.woodSide); g.add(body);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 6), mt.woodEnd); cap.rotation.x = s * -Math.PI / 2; cap.position.y = s * len / 2; g.add(cap);
    const c = new THREE.Mesh(new THREE.CircleGeometry(PEN.core, 20), mt.graphite); c.rotation.x = s * -Math.PI / 2; c.position.y = s * (len / 2 + 0.05); g.add(c);
  }
  return shadowed(g);
}
// field of standing pencils (instanced, tips up). set(i, x, z, ry, s) then done()
export function pencilField(n) {
  const mt = mats(), G = pencilGeos(), grp = new THREE.Group();
  const geos = [[G.body, mt.lacquer], [G.cone, mt.woodSide], [G.tip, mt.graphite], [G.fer, mt.ferrule], [G.er, mt.eraser]];
  const ims = geos.map(([geo, m]) => { const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; grp.add(im); return im; });
  const o = new THREE.Object3D();
  return { grp, n, set(i, x, y, z, ry = 0, s = 1, tilt = 0) { o.position.set(x, y, z); o.rotation.set(Math.PI + tilt, ry, 0); o.position.y += PEN.L * s; o.scale.setScalar(s); o.updateMatrix(); ims.forEach(im => im.setMatrixAt(i, o.matrix)); },
    done(c = n) { ims.forEach(im => { im.count = c; im.instanceMatrix.needsUpdate = true; }); } };
}

// ---------- slats ----------
export const SLAT = { L: 184, W: 74, T: 5.2, n: 8, pitch: 9.0, r: PEN.core * 1.05 };
export const grooveX = (i) => (i - (SLAT.n - 1) / 2) * SLAT.pitch;   // across the width (local z after rotation, see below)
// slat with its length along x (centred), width along z, thickness y in [0, T]; grooves on the top face
export function slatGeo(grooved = true, { L = SLAT.L, W = SLAT.W, T = SLAT.T } = {}) {
  const s = new THREE.Shape(); s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, T);
  if (grooved) for (let i = SLAT.n - 1; i >= 0; i--) { const c = grooveX(i); s.lineTo(c + SLAT.r, T); s.absarc(c, T, SLAT.r, 0, Math.PI, true); }
  s.lineTo(-W / 2, T); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 10 });
  geo.rotateY(Math.PI / 2); geo.translate(-L / 2, 0, 0);
  // UVs: side grain along the length
  const p = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = Math.abs(nrm.getX(i));
    if (nx > 0.9) uv.setXY(i, (z + W / 2) / W, y / W + 0.3); else uv.setXY(i, (z + y * 0.6 + W) / (W * 2.2), (x + L / 2) / L * 1.6); }
  uv.needsUpdate = true;
  return geo;
}
export function slatMesh(grooved = true, opts) { const mt = mats(); const m = new THREE.Mesh(slatGeo(grooved, opts), [mt.woodEnd, mt.woodSide]); m.castShadow = m.receiveShadow = true; return m; }

// cross-section that morphs from the slat rectangle (u = 0) to the hexagon (u = 1); returns a fresh geometry
export function sectionGeo(u, depth = 8, w = SLAT.pitch, h = SLAT.T * 2, R = PEN.R) {
  const N = 72, pts = [];
  const rect = (a) => { const c = Math.cos(a), s = Math.sin(a); return Math.min(w / 2 / Math.max(1e-6, Math.abs(c)), h / 2 / Math.max(1e-6, Math.abs(s))); };
  const hex = (a) => { const k = Math.PI / 3, aa = ((a % k) + k) % k - k / 2; return R * Math.cos(Math.PI / 6) / Math.cos(aa); };
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + Math.PI / 6 * 0; const r = lerp(rect(a), hex(a + Math.PI / 6 * 0 + Math.PI / 2), u); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  const s = new THREE.Shape(pts);
  const hole = new THREE.Path(); hole.absarc(0, 0, PEN.core, 0, Math.PI * 2, true); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 }); geo.translate(0, 0, -depth / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 30 + 0.5, p.getY(i) / 30 + 0.5); uv.needsUpdate = true;
  return geo;
}

// ---------- toy brick (generic 2x4, no marks) ----------
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function toyBrick(color = 0xE0322B, k = 4) {
  const g = new THREE.Group(), m = M.plastic(color, { roughness: 0.25, clearcoat: 0.8 });
  const b = new THREE.Mesh(new RoundedBoxGeometry(31.8 * k, 9.6 * k, 15.8 * k, 3, 0.6 * k), m); b.position.y = 4.8 * k; g.add(b);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(2.4 * k, 2.4 * k, 1.8 * k, 32), m); s.position.set((i - 1.5) * 8 * k, 9.6 * k + 0.9 * k, (j - 0.5) * 8 * k); g.add(s); }
  return shadowed(g);
}

// ---------- stroke font (capitals used by the payoff), unit box: height 1 ----------
const arc = (cx, cy, r, a0, a1, n = 14) => { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
const D = Math.PI / 180;
export const FONT = {
  G: { w: 0.72, s: [[...arc(0.33, 0.5, 0.33, 50 * D, 330 * D, 22), [0.64, 0.46], [0.64, 0.44], [0.4, 0.44]]] },
  R: { w: 0.66, s: [[[0, 0], [0, 1], [0.32, 1], ...arc(0.32, 0.75, 0.25, 90 * D, -90 * D, 10), [0, 0.5]], [[0.28, 0.5], [0.56, 0]]] },
  A: { w: 0.7, s: [[[0, 0], [0.31, 1], [0.62, 0]], [[0.12, 0.38], [0.5, 0.38]]] },
  P: { w: 0.6, s: [[[0, 0], [0, 1], [0.3, 1], ...arc(0.3, 0.75, 0.25, 90 * D, -90 * D, 10), [0, 0.5]]] },
  H: { w: 0.7, s: [[[0, 1], [0, 0]], [[0.56, 1], [0.56, 0]], [[0, 0.52], [0.56, 0.52]]] },
  I: { w: 0.3, s: [[[0.08, 1], [0.08, 0]]] },
  T: { w: 0.68, s: [[[0, 1], [0.6, 1]], [[0.3, 1], [0.3, 0]]] },
  E: { w: 0.6, s: [[[0.5, 1], [0, 1], [0, 0], [0.52, 0]], [[0, 0.52], [0.4, 0.52]]] },
  '.': { w: 0.25, s: [[[0.05, 0.02], [0.09, 0.05], [0.06, 0.08], [0.05, 0.02]]] },
};
// layout a word into strokes (arrays of [x, y]) in units of the cap height, with a little hand jitter
export function wordStrokes(word, slant = 0.12, seed = 3) {
  const out = []; let x = 0;
  [...word].forEach((ch, k) => { const G = FONT[ch]; if (!G) { x += 0.4; return; }
    for (const st of G.s) out.push(st.map(([a, b], i) => [x + a + b * slant + (hash(seed + k * 13 + i) - 0.5) * 0.025, b + (hash(seed + k * 7 + i * 3) - 0.5) * 0.025]));
    x += G.w + 0.14; });
  return { strokes: out, width: x - 0.14 };
}

// morphable section: one geometry built at u = 0, vertices moved radially for any u (topology stays valid)
export function sectionMorph(depth = 8, w = SLAT.pitch, h = SLAT.T * 2, R = PEN.R) {
  const geo = sectionGeo(0, depth, w, h, R), p = geo.attributes.position, base = p.array.slice();
  const rect = (a) => { const c = Math.cos(a), s = Math.sin(a); return Math.min(w / 2 / Math.max(1e-6, Math.abs(c)), h / 2 / Math.max(1e-6, Math.abs(s))); };
  const hex = (a) => { const k = Math.PI / 3, aa = ((a % k) + k) % k - k / 2; return R * Math.cos(Math.PI / 6) / Math.cos(aa); };
  return { geo, set(u) { for (let i = 0; i < p.count; i++) { const x = base[i * 3], y = base[i * 3 + 1], r = Math.hypot(x, y); if (r < PEN.core + 0.05) continue; const a = Math.atan2(y, x), k = lerp(rect(a), hex(a + Math.PI / 2), u) / r; p.setXY(i, x * k, y * k); }
    p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); } };
}
