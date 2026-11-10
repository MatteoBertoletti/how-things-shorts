// EP 04 parts: a generic 2x4 interlocking toy brick (no marks anywhere), built from real proportions so the
// stud / tube / wall interference can be shown in section; an x-ray material (translucent shell, bright cut surface,
// stress glow), a CSG mould block with the brick cavity, plastic granules, a ballpoint pen. Units: mm, y up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, hash } from './core.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

export const BR = { L: 31.8, W: 15.8, H: 9.6, top: 1.2, wall: 1.5, studR: 2.4, studH: 1.7, tubeRo: 3.255, tubeRi: 2.4, pitch: 8 };
export const STUDS = []; for (const x of [-12, -4, 4, 12]) for (const z of [-4, 4]) STUDS.push([x, z]);
export const TUBES = [[-8, 0], [0, 0], [8, 0]];
export const COL = { red: 0xE8261C, yellow: 0xEFAE12, blue: 0x2F6BFF, green: 0x2BD67B };

// plastic with x-ray + stress: front faces fade to uX (translucent shell), back faces show as the bright cut surface,
// per-vertex stress `aS` glows red-orange where the plastic bends
export function plasticMat(color, { cut = null, ...o } = {}) {
  const c = new THREE.Color(color);
  const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.08, envMapIntensity: 1.1, side: THREE.DoubleSide, transparent: false, ...o });
  const u = { uX: { value: 0 }, uK: { value: 0 }, uCut: { value: cut ? new THREE.Color(cut) : c.clone().lerp(new THREE.Color(0xffffff), 0.28) }, uHot: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aS; varying float vS; varying vec3 vWp2;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvS = aS;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uX; uniform float uK; uniform vec3 uCut; uniform float uHot; varying float vS; varying vec3 vWp2;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float s = clamp(vS * uK, 0.0, 1.0);
        totalEmissiveRadiance += mix(vec3(0.9, 0.06, 0.02), vec3(1.0, 0.42, 0.06), s) * s * 1.3;
        totalEmissiveRadiance += mix(vec3(1.0, 0.25, 0.03), vec3(1.0, 0.62, 0.2), 0.5 + 0.5 * sin(vWp2.y * 0.9)) * uHot * 2.4;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (!gl_FrontFacing) { float s2 = clamp(vS * uK, 0.0, 1.0); gl_FragColor = vec4(mix(uCut, vec3(1.0, 0.35, 0.08), s2 * 0.85) + vec3(1.0, 0.4, 0.05) * uHot, 1.0); }
        `);
  };
  return m;
}
export function setXray(m, x) { m.userData.u.uX.value = x; }
// ghost of the removed half (translucent front faces only), sharing the brick's geometries so it bends with it
export function ghostOf(brick, color, plane) {
  const gm = new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.FrontSide, clippingPlanes: [plane] });
  const g = new THREE.Group(); brick.children.forEach(o => { if (!o.isMesh) return; const m = new THREE.Mesh(o.geometry, gm); m.position.copy(o.position); m.rotation.copy(o.rotation); m.renderOrder = 5; g.add(m); });
  g.userData.mat = gm; return g;
}

function withStress(geo) { geo.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1)); return geo; }
function studGeo() {
  const { studR: r, studH: h } = BR, f = 0.3, pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, h - f)];
  for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - f + Math.cos(a) * f, h - f + Math.sin(a) * f)); }
  pts.push(new THREE.Vector2(0, h)); return withStress(new THREE.LatheGeometry(pts, 40));
}
function tubeGeo(h) { const { tubeRo: o, tubeRi: i } = BR; const pts = [new THREE.Vector2(i, 0), new THREE.Vector2(o, 0), new THREE.Vector2(o, h), new THREE.Vector2(i, h), new THREE.Vector2(i, 0)]; const g = new THREE.LatheGeometry(pts, 48); g.computeVertexNormals(); return withStress(g); }

// one brick. Local origin: centre of the bottom face. userData: { mat, setDeform(d, k), base }
export function makeBrick(color, { outline = false, solidBottom = false, mat: shared = null } = {}) {
  const { L, W, H, top, wall, studH } = BR, g = new THREE.Group(), mat = shared || plasticMat(color);
  const add = (geo, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const plate = add(withStress(new RoundedBoxGeometry(L, top + 0.6, W, 3, 0.35)), 0, H - (top + 0.6) / 2, 0);
  const hw = H - top;
  const longW = [-1, 1].map(s => { const geo = withStress(new THREE.BoxGeometry(L, hw, wall, 64, 6, 1)); return add(geo, 0, hw / 2, s * (W / 2 - wall / 2)); });
  const shortW = [-1, 1].map(s => add(withStress(new RoundedBoxGeometry(wall, hw, W - 0.02, 2, 0.2)), s * (L / 2 - wall / 2), hw / 2, 0));
  // the outer corners get a little bevel strip so the silhouette is not razor sharp
  const studs = STUDS.map(([x, z]) => add(studGeo(), x, H, z));
  const tubes = TUBES.map(([x, z]) => add(tubeGeo(hw), x, 0, z));
  if (solidBottom) add(new THREE.BoxGeometry(L - 2 * wall, 0.4, W - 2 * wall), 0, 0.2, 0);
  const lines = [];
  if (outline) {
    const lm = new THREE.LineBasicMaterial({ color: 0x7FE3FF, transparent: true, opacity: 0 });
    g.children.slice().forEach(o => { if (!o.isMesh) return; const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), lm); e.position.copy(o.position); g.add(e); lines.push(e); });
    g.userData.lineMat = lm;
  }
  // rest copies for deformation
  const rest = (o) => o.geometry.attributes.position.array.slice();
  const R = { long: longW.map(rest), tubes: tubes.map(rest) };
  const bump = (x) => STUDS.reduce((acc, [sx]) => acc + Math.exp(-(((x - sx) / 2.2) ** 2)), 0) / 2 * 2;   // two studs per x column
  // d = bending in mm (already exaggerated by the caller), k = stress glow 0..1
  function setDeform(d = 0, k = 0) {
    longW.forEach((w, wi) => { const p = w.geometry.attributes.position, s = w.geometry.attributes.aS, r = R.long[wi], sg = wi ? 1 : -1;
      for (let i = 0; i < p.count; i++) { const x = r[i * 3], y = r[i * 3 + 1] + hw / 2, z = r[i * 3 + 2]; const b = Math.min(1, bump(x) * 0.5), fy = clamp(1 - y / hw) ** 3;
        p.setZ(i, z + sg * d * b * fy); s.setX(i, b * fy * 1.6); }
      p.needsUpdate = s.needsUpdate = true; w.geometry.computeVertexNormals(); });
    tubes.forEach((tb, ti) => { const p = tb.geometry.attributes.position, s = tb.geometry.attributes.aS, r = R.tubes[ti];
      for (let i = 0; i < p.count; i++) { const x = r[i * 3], y = r[i * 3 + 1], z = r[i * 3 + 2], th = Math.atan2(z, x), w = Math.max(0, -Math.cos(4 * th)) ** 2, fy = clamp(1 - y / hw) ** 3, rr = Math.hypot(x, z);
        const k2 = rr > 1e-6 ? (rr - d * 0.8 * w * fy) / rr : 1; p.setXYZ(i, x * k2, y, z * k2); s.setX(i, w * fy * 1.6); }
      p.needsUpdate = s.needsUpdate = true; tb.geometry.computeVertexNormals(); });
    mat.userData.u.uK.value = k;
  }
  g.userData = { mat, setDeform, lines, lineMat: g.userData.lineMat || new THREE.LineBasicMaterial({ visible: false }), parts: { plate, longW, shortW, studs, tubes } };
  return g;
}

// plastic granules (instanced lentils) in one colour
export function granules(n, color) {
  const geo = new THREE.SphereGeometry(1, 10, 6); geo.scale(1.6, 1.0, 1.3);
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 1.0 });
  const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
  const o = new THREE.Object3D();
  return { im, n, set(i, x, y, z, r = 0, s = 1) { o.position.set(x, y, z); o.rotation.set(r, r * 1.7, r * 0.4); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }, done(c = n) { im.count = c; im.instanceMatrix.needsUpdate = true; } };
}

// generic ballpoint pen (no marks): translucent barrel, ink tube, cap with clip, metal tip. Along +y, tip at y = 0.
export function ballpointPen(color = 0xE33A2F) {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 120, 6), new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, roughness: 0.08, transmission: 0.6, thickness: 2, clearcoat: 1, transparent: true, opacity: 0.9 }));
  barrel.position.y = 22 + 60; g.add(barrel);
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 118, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.4 })); ink.position.y = 22 + 59; g.add(ink);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 1.4, 20, 24), new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, roughness: 0.1, transmission: 0.5, thickness: 2, transparent: true, opacity: 0.9 })); cone.position.y = 12; g.add(cone);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.5, 3, 16), new THREE.MeshStandardMaterial({ color: 0xC9CED6, metalness: 1, roughness: 0.25 })); tip.position.y = 1.5; g.add(tip);
  const capM = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 0.8 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 46, 24), capM); cap.position.y = 142 - 23 + 8; g.add(cap);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(4.6, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM); capTop.scale.y = 0.5; capTop.position.y = 150; g.add(capTop);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 40, 1.4), capM); clip.position.set(0, 128, 5.6); g.add(clip);
  const end = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 4, 24), capM); end.position.y = 22 + 120 - 2 - 40; g.add(end); end.visible = false;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// mould block with one brick cavity (CSG), cavity open on +y (studs point down into the block, the brick bottom at y = 0)
export function mouldBlock(size = [70, 40, 50], mat) {
  const ev = new Evaluator(); ev.attributes = ['position', 'normal'];
  let a = new Brush(new THREE.BoxGeometry(...size)); a.position.y = -size[1] / 2; a.updateMatrixWorld();
  const b = makeBrick(0xffffff); b.rotation.x = Math.PI; b.updateMatrixWorld(true);
  b.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone(); g.deleteAttribute('uv'); g.deleteAttribute('aS'); const br = new Brush(g); o.updateMatrixWorld(); br.applyMatrix4(o.matrixWorld); br.updateMatrixWorld(); a = ev.evaluate(a, br, SUBTRACTION); });
  const m = new THREE.Mesh(a.geometry, mat); m.castShadow = m.receiveShadow = true; return m;
}
