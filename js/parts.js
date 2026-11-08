// Reusable parts library (procedural). Units: millimetres, y up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const M = {
  std: (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o }),
  metal: (color, rough = 0.3, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough, envMapIntensity: 1.2, ...o }),
  plastic: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, ...o }),
  glow: (color, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false }),
};

export function shadowed(o, cast = true, recv = true) { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; }

// woven fabric texture (canvas), tiles seamlessly
export function weaveTexture(base = '#2E4A6B', rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  const col = new THREE.Color(base);
  const sh = (k) => '#' + col.clone().multiplyScalar(k).getHexString();
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const odd = (i + j) % 2;
    g.fillStyle = sh(odd ? 1.18 : 0.82);
    if (odd) g.fillRect(i * 8 + 1, j * 8, 6, 8); else g.fillRect(i * 8, j * 8 + 1, 8, 6);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function fabricMat(base, rep = [1, 1]) {
  const map = weaveTexture(base, rep);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, bumpMap: map, bumpScale: 0.6, side: THREE.DoubleSide });
}

// Cutting mat with a procedural mm grid (world-space, resolution independent)
export function cuttingMat(w = 640, d = 420, base = 0x123048, line = 0x5EC8E5) {
  const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLine = { value: new THREE.Color(line) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform vec3 uLine;\nfloat gl1(vec2 p, float s, float wpx){ vec2 q = abs(fract(p/s-0.5)-0.5)*s; vec2 fw = fwidth(p); vec2 a = 1.0 - smoothstep(vec2(0.0), fw*wpx, q); return max(a.x,a.y); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p = vWP.xz;
        float g10 = gl1(p, 10.0, 1.3), g50 = gl1(p, 50.0, 2.2), g1 = gl1(p, 1.0, 0.8);
        float fade1 = 1.0 - smoothstep(0.08, 0.35, max(fwidth(p).x, fwidth(p).y));
        diffuseColor.rgb = mix(diffuseColor.rgb, uLine*0.55, max(max(g10*0.55, g50*0.9), g1*0.18*fade1));`);
  };
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), mat); m.position.y = -0.75; m.receiveShadow = true; return m;
}

export function workbench() {
  const g = new THREE.Group();
  const wood = M.std(0x5a3a26, { roughness: 0.75 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(1500, 44, 760, 3, 4), wood); top.position.y = -23.5; g.add(top);
  const legM = M.std(0x2b2f36, { roughness: 0.6 });
  for (const [x, z] of [[-700, -330], [700, -330], [-700, 330], [700, 330]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(60, 860, 60), legM); l.position.set(x, -45 - 430, z); g.add(l);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1440, 20, 680), wood); shelf.position.y = -760; g.add(shelf);
  return shadowed(g);
}

export function room() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), M.std(0x1b2433, { roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -905; floor.receiveShadow = true; g.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9000, 4000), M.std(0x16233a, { roughness: 0.95 }));
  wall.position.set(0, 1000, -900); wall.receiveShadow = true; g.add(wall);
  const wall2 = wall.clone(); wall2.rotation.y = Math.PI / 2; wall2.position.set(-1500, 1000, 0); g.add(wall2);
  // pegboard with procedural holes
  const pegM = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 });
  pegM.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvP = position.xy;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec2 q = fract(vP/25.0)-0.5; float hole = 1.0-smoothstep(0.12,0.17,length(q)); diffuseColor.rgb *= 1.0-0.8*hole;');
  };
  const peg = new THREE.Mesh(new THREE.BoxGeometry(1400, 800, 12), pegM); peg.position.set(0, 520, -880); g.add(peg);
  // tools on the pegboard: generic shapes
  const toolM = [M.metal(0xb8bec6, 0.35), M.std(0xFF5A1F, { roughness: 0.5 }), M.std(0x2b2f36), M.metal(0xd9a441, 0.4)];
  for (let i = 0; i < 9; i++) {
    const x = -560 + i * 140, h = 160 + (i * 53) % 140;
    const t = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 110, 12), toolM[i % 2 ? 1 : 2]); handle.position.y = -h / 2 + 55; t.add(handle);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(i % 3 ? 10 : 50, h - 110, 6), toolM[i % 3 ? 0 : 3]); shaft.position.y = 55; t.add(shaft);
    t.position.set(x, 560 - (i % 2) * 40, -860); g.add(t);
  }
  // shelf with bins on the side wall
  const shelfM = M.std(0x3a4150);
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(300, 18, 900), shelfM); s.position.set(-1340, 150 + k * 380, -100); g.add(s);
    for (let b = 0; b < 4; b++) {
      const bin = new THREE.Mesh(new RoundedBoxGeometry(220, 140, 180, 2, 10), M.plastic([0xFF5A1F, 0x5EC8E5, 0xF3E9D2, 0x2E4A6B][(b + k) % 4]));
      bin.position.set(-1340, 150 + k * 380 + 80, -460 + b * 230); g.add(bin);
    }
  }
  return shadowed(g, true, true);
}

export function deskLamp() {
  const g = new THREE.Group();
  const m = M.std(0x22262d, { roughness: 0.45, metalness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(70, 80, 18, 32), m); base.position.y = 9; g.add(base);
  const a1 = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 330, 12), m); a1.position.set(40, 170, 0); a1.rotation.z = -0.25; g.add(a1);
  const a2 = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 300, 12), m); a2.position.set(150, 380, 0); a2.rotation.z = 1.05; g.add(a2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(70, 110, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xFF5A1F, roughness: 0.5, side: THREE.DoubleSide }));
  shade.position.set(270, 400, 0); shade.rotation.z = 0.6; g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(28, 20, 16), M.glow(0xFFC777, 4)); bulb.position.set(255, 375, 0); g.add(bulb);
  return shadowed(g, true, false);
}

export function tray(w = 120, d = 80, h = 18, t = 3, mat = M.std(0x2b2f36, { roughness: 0.5, metalness: 0.3 })) {
  const g = new THREE.Group();
  const add = (sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); b.position.set(x, y, z); g.add(b); };
  add(w, t, d, 0, t / 2, 0);
  add(w, h, t, 0, h / 2, d / 2 - t / 2); add(w, h, t, 0, h / 2, -d / 2 + t / 2);
  add(t, h, d, w / 2 - t / 2, h / 2, 0); add(t, h, d, -w / 2 + t / 2, h / 2, 0);
  g.userData = { w, d, h, t };
  return shadowed(g);
}

// conveyor: belt (with procedural moving stripes) + rollers + frame
export function conveyor(len = 1200, wid = 300) {
  const g = new THREE.Group();
  const beltM = new THREE.MeshStandardMaterial({ color: 0x1d222a, roughness: 0.9 });
  const u = { uOff: { value: 0 } };
  beltM.onBeforeCompile = (sh) => {
    sh.uniforms.uOff = u.uOff;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvP = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vP; uniform float uOff;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat s = smoothstep(0.45,0.5,abs(fract((vP.y+uOff)/40.0)-0.5)); diffuseColor.rgb *= 0.8+0.35*s;');
  };
  const belt = new THREE.Mesh(new THREE.BoxGeometry(wid, 6, len), beltM); belt.position.y = -3; g.add(belt);
  const frameM = M.metal(0x8f98a3, 0.4);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(14, 40, len + 40), frameM); r.position.set(s * (wid / 2 + 9), -12, 0); g.add(r); }
  for (let z = -len / 2; z <= len / 2; z += 100) { const r = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, wid, 16), frameM); r.rotation.z = Math.PI / 2; r.position.set(0, -24, z); g.add(r); }
  g.userData.uOff = u.uOff;
  return shadowed(g);
}

export function pedestal(r = 70, h = 120, ring = 0x22ff88) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 48), M.std(0x1c2638, { roughness: 0.5, metalness: 0.2 })); body.position.y = h / 2; g.add(body);
  const ringM = M.glow(ring, 2.5);
  const rg = new THREE.Mesh(new THREE.TorusGeometry(r + 1, 2.2, 8, 64), ringM); rg.rotation.x = Math.PI / 2; rg.position.y = h - 4; g.add(rg);
  const rg2 = rg.clone(); rg2.position.y = 10; g.add(rg2);
  g.userData.ringM = ringM;
  return shadowed(g);
}

// a plain generic coin: rim + concentric grooves, no design
export function coin(d = 23.25, t = 2.2) {
  const pts = [];
  const R = d / 2;
  pts.push(new THREE.Vector2(0, t / 2 - 0.15));
  for (let i = 1; i <= 6; i++) { const r = R * 0.75 * i / 6; pts.push(new THREE.Vector2(r, t / 2 - 0.15 - (i % 2) * 0.05)); }
  pts.push(new THREE.Vector2(R - 1.2, t / 2 - 0.25), new THREE.Vector2(R - 0.9, t / 2), new THREE.Vector2(R - 0.2, t / 2), new THREE.Vector2(R, t / 2 - 0.2), new THREE.Vector2(R, -t / 2 + 0.2), new THREE.Vector2(R - 0.2, -t / 2), new THREE.Vector2(0, -t / 2));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), M.metal(0xd6c49a, 0.5, { envMapIntensity: 1.6 }));
  return shadowed(m);
}

// dimension line: two ticks + bar, glowing accent. Spans along local x from -L/2..L/2
export function dimLine(L, color = 0xFF5A1F, th = 0.18) {
  const g = new THREE.Group(); const m = M.glow(color, 2.2);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(L, th, th), m); g.add(bar);
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(th, th, L * 0.35), m); t.position.x = s * L / 2; g.add(t); }
  return g;
}

export { RoundedBoxGeometry };
