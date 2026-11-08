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

// ======================= EP. 02 additions: factory + glass line =======================
// world-space brick / refractory material (optionally hot: emissive tint)
export function brickMat(base = 0x7a4a36, mortar = 0x2a1d18, hot = 0) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.9 });
  const u = { uHot: { value: hot }, uMortar: { value: new THREE.Color(mortar) } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWB; varying vec3 vNB;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWB = (modelMatrix*vec4(transformed,1.0)).xyz; vNB = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWB; varying vec3 vNB; uniform float uHot; uniform vec3 uMortar;\nfloat bh(vec2 p){ return fract(sin(dot(floor(p), vec2(12.9898,78.233)))*43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 an = abs(vNB); vec2 p = an.x > 0.5 ? vWB.zy : (an.z > 0.5 ? vWB.xy : vWB.xz);
        p /= vec2(230.0, 76.0); p.x += 0.5*mod(floor(p.y), 2.0);
        vec2 f = fract(p); float mo = step(f.x, 0.04) + step(f.y, 0.1);
        float v = 0.82 + 0.3*bh(p);
        diffuseColor.rgb = mix(diffuseColor.rgb*v, uMortar, clamp(mo,0.0,1.0));`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0,0.42,0.12)*uHot*(0.35+0.4*(1.0-clamp(mo,0.0,1.0)));');
  };
  m.customProgramCacheKey = () => 'brick';
  return m;
}

export function factoryFloor(size = 60000) {
  const g = new THREE.Group();
  const floorM = new THREE.MeshStandardMaterial({ color: 0x232c33, roughness: 0.85 });
  floorM.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWF;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWF = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWF;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = abs(fract(vWF.xz/2000.0)-0.5)*2000.0; vec2 fw = fwidth(vWF.xz);
        float seam = 1.0 - min(smoothstep(0.0, fw.x*1.5, q.x), smoothstep(0.0, fw.y*1.5, q.y));
        diffuseColor.rgb *= 1.0 - 0.35*seam;`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const colM = M.std(0x3a4652, { roughness: 0.6, metalness: 0.3 }), pipeM = M.metal(0x8f98a3, 0.45), hotPipe = M.std(0xFFB62E, { roughness: 0.5 });
  for (let x = -24000; x <= 24000; x += 6000) for (const z of [-4200, 4200]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(360, 9000, 360), colM); c.position.set(x, 4500, z); g.add(c);
  }
  for (let k = 0; k < 6; k++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(70 + (k % 3) * 40, 70 + (k % 3) * 40, size * 0.8, 16), k % 4 === 1 ? hotPipe : pipeM);
    p.rotation.z = Math.PI / 2; p.position.set(0, 5200 + k * 380, -3600 + (k % 3) * 900); g.add(p);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(size, 14000), M.std(0x1a242c, { roughness: 0.95 })); back.position.set(0, 7000, -5200); back.receiveShadow = true; g.add(back);
  return shadowed(g, true, true);
}

// hopper: square bin + funnel + outlet + legs. top at y = h, outlet at y = 0
export function hopper(w = 900, hBin = 420, hFun = 560, out = 160) {
  const g = new THREE.Group(); const m = M.metal(0xa9b2bb, 0.45, { side: THREE.DoubleSide, envMapIntensity: 1.0 });
  const fun = new THREE.Mesh(new THREE.CylinderGeometry(w / Math.SQRT2, out / Math.SQRT2, hFun, 4, 1, true), m); fun.rotation.y = Math.PI / 4; fun.position.y = hFun / 2 + 120; g.add(fun);
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(w / Math.SQRT2, w / Math.SQRT2, hBin, 4, 1, true), m); bin.rotation.y = Math.PI / 4; bin.position.y = 120 + hFun + hBin / 2; g.add(bin);
  const rimM = M.std(0xFFB62E, { roughness: 0.5 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(w / Math.SQRT2, 14, 6, 4), rimM); rim.rotation.set(Math.PI / 2, 0, Math.PI / 4); rim.position.y = 120 + hFun + hBin; g.add(rim);
  const spout = new THREE.Mesh(new THREE.BoxGeometry(out, 120, out), m); spout.position.y = 60; g.add(spout);
  const legM = M.std(0x3a4652, { roughness: 0.6, metalness: 0.3 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(60, 1400, 60), legM); l.position.set(sx * (w / 2 + 30), 120 + hFun + hBin - 700, sz * (w / 2 + 30)); g.add(l); }
  g.userData = { top: 120 + hFun + hBin, w, funTop: 120 + hFun, out };
  return shadowed(g);
}

// furnace: brick block with a glowing mouth (doghouse) at the front (+z), melt surface inside, crown arch
export function furnaceMouth({ w = 3200, h = 1700, d = 4200, mw = 1500, mh = 520, meltY = 420, meltMat } = {}) {
  const g = new THREE.Group(); const b = brickMat(0x6e4232, 0x241812, 0.0), bh = brickMat(0x3a2018, 0x140a07, 0.3);
  const add = (sx, sy, sz, x, y, z, m = b) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); g.add(o); return o; };
  const side = (w - mw) / 2;
  add(side, h, 300, -(mw / 2 + side / 2), h / 2, d / 2 - 150); add(side, h, 300, mw / 2 + side / 2, h / 2, d / 2 - 150);
  add(mw, h - (meltY + mh), 300, 0, meltY + mh + (h - meltY - mh) / 2, d / 2 - 150); add(mw, meltY, 300, 0, meltY / 2, d / 2 - 150);
  add(300, h, d, -w / 2 + 150, h / 2, 0, bh); add(300, h, d, w / 2 - 150, h / 2, 0, bh); add(w, h, 300, 0, h / 2, -d / 2 + 150, bh);
  add(w, 300, d, 0, -150 + 1, 0, b);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 100, w / 2 - 100, d - 300, 24, 1, true, -Math.PI / 2, Math.PI), bh); crown.rotation.x = Math.PI / 2; crown.rotation.y = 0; crown.position.set(0, h, -150); crown.material = bh; g.add(crown);
  const crownO = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 40, w / 2 + 40, d, 24, 1, false, -Math.PI / 2, Math.PI), b); crownO.rotation.x = Math.PI / 2; crownO.position.set(0, h, 0); g.add(crownO);
  crown.rotation.set(-Math.PI / 2, 0, 0); crownO.rotation.set(-Math.PI / 2, 0, 0);
  const melt = new THREE.Mesh(new THREE.PlaneGeometry(w - 600, d - 300), meltMat); melt.rotation.x = -Math.PI / 2; melt.position.set(0, meltY, 0); g.add(melt);
  // steel buckstays
  const st = M.std(0x2c343c, { roughness: 0.5, metalness: 0.5 });
  for (let x = -w / 2; x <= w / 2; x += 700) { const s = new THREE.Mesh(new THREE.BoxGeometry(90, h + 500, 90), st); s.position.set(x, (h + 500) / 2, d / 2 + 50); g.add(s); }
  g.userData = { melt, meltY, mouthZ: d / 2, mw, mh, bricks: [b, bh] };
  shadowed(g, true, true); melt.castShadow = false; melt.receiveShadow = false;
  return g;
}

// forehearth: covered refractory channel along +x ending in a spout bowl with an orifice and a plunger
export function forehearth({ len = 2400, w = 260, h = 220, streamMat } = {}) {
  const g = new THREE.Group(); const b = brickMat(0x8a5a40, 0x2a1d18, 0.25);
  const add = (sx, sy, sz, x, y, z, m = b) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); g.add(o); return o; };
  add(len, 120, w + 240, -len / 2, -60, 0);
  add(len, h, 120, -len / 2, h / 2, -(w / 2 + 60)); add(len, h, 120, -len / 2, h / 2, w / 2 + 60);
  const lids = []; for (let x = -len + 200; x < -300; x += 420) lids.push(add(360, 90, w + 240, x, h + 45, 0));
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(len, w), streamMat); stream.rotation.x = -Math.PI / 2; stream.position.set(-len / 2, h * 0.55, 0); g.add(stream);
  // spout bowl + orifice ring at x=0
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(220, 170, 260, 32, 1, true), b); bowl.position.set(0, h * 0.55 - 70, 0); g.add(bowl);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(170, 170, 60, 32), b); bottom.position.set(0, h * 0.55 - 230, 0); g.add(bottom);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 10, 10, 32), M.std(0x5a3a2c, { roughness: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, h * 0.55 - 262, 0); g.add(ring);
  const bowlMelt = new THREE.Mesh(new THREE.CircleGeometry(205, 32), streamMat); bowlMelt.rotation.x = -Math.PI / 2; bowlMelt.position.set(0, h * 0.55, 0); g.add(bowlMelt);
  const plunger = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 900, 24), M.std(0xd9d2c4, { roughness: 0.7 })); plunger.position.set(0, h * 0.55 + 300, 0); g.add(plunger);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 300, 32, 1, true), M.std(0xcfc6b5, { roughness: 0.8, side: THREE.DoubleSide })); tube.position.set(0, h * 0.55 + 60, 0); g.add(tube);
  g.userData = { stream, plunger, orificeY: h * 0.55 - 262, surfY: h * 0.55, bowlMelt, lids };
  shadowed(g, true, true); stream.castShadow = bowlMelt.castShadow = false;
  return g;
}

// shear blades: two flat blades with V notches sliding in x under the orifice. set(u): 0 open, 1 closed
export function shearBlades(span = 140) {
  const g = new THREE.Group(); const m = M.metal(0xb8c0c8, 0.25);
  const blade = (s) => {
    const sh = new THREE.Shape(); sh.moveTo(0, -30); sh.lineTo(s * 520, -30); sh.lineTo(s * 520, 30); sh.lineTo(0, 30); sh.lineTo(s * -40, 0); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 1 }); geo.rotateX(Math.PI / 2);
    const o = new THREE.Mesh(geo, m); const arm = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 120), M.std(0x2c343c, { metalness: 0.5, roughness: 0.5 })); arm.position.set(s * 500, 0, 0); o.add(arm); return o;
  };
  const a = blade(-1), b = blade(1); a.position.y = 5; g.add(a, b);
  g.userData = { a, b, span };
  g.userData.set = (u) => { const x = (1 - u) * span + 2; a.position.x = -x; b.position.x = x; };
  g.userData.set(0);
  return shadowed(g);
}

// mould from a lathe profile (outer [r,y] list, mouth-up), CSG cavity, split front/back (z) into two halves
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
export function mould(outer, { y0, y1, w = 130, d = 130, color = 0x4a5058 } = {}) {
  const prep = (geo) => { geo = geo.index ? geo.toNonIndexed() : geo; geo.deleteAttribute('uv'); geo.deleteAttribute('normal'); geo = BGU.mergeVertices(geo, 1e-3); geo.computeVertexNormals(); return geo; };
  const pts = [new THREE.Vector2(0.001, y1 + 30), ...outer.filter(([r, y]) => y <= y1 + 30 && y >= y0 - 1).map(([r, y]) => new THREE.Vector2(Math.max(0.001, r + 0.4), y)), new THREE.Vector2(0.001, y0 - 0.5)];
  pts.sort((a, b) => b.y - a.y);
  const cav = prep(new THREE.LatheGeometry(pts, 40));
  const box = prep(new THREE.BoxGeometry(w, y1 - y0 + 6, d, 2, 4, 2)); box.translate(0, (y0 + y1) / 2 - 3 + 3, 0);
  const ev = new Evaluator(); ev.attributes = ['position', 'normal'];
  let body;
  try { const A = new Brush(box), B = new Brush(cav); A.updateMatrixWorld(); B.updateMatrixWorld(); body = ev.evaluate(A, B, SUBTRACTION); }
  catch (e) { console.log('mould CSG failed', e.message); body = new Brush(box); }
  const half = (s) => { const hb = prep(new THREE.BoxGeometry(w * 2, (y1 - y0) * 3, d)); hb.translate(0, (y0 + y1) / 2, s * d / 2); const H = new Brush(hb); H.updateMatrixWorld(); const r = ev.evaluate(body, H, INTERSECTION).geometry; r.deleteAttribute('normal'); let q = BGU.mergeVertices(r, 1e-3); q = BGU.toCreasedNormals(q, 0.5); return q; };
  const m = M.metal(color, 0.55, { envMapIntensity: 0.6 });
  const front = new THREE.Mesh(half(1), m), back = new THREE.Mesh(half(-1), m);
  const g = new THREE.Group(); g.add(front, back); shadowed(g);
  g.userData = { front, back, d, set: (open) => { front.position.z = open * 70; back.position.z = -open * 70; } };
  return g;
}

// invert arm: pivot at origin rotating about z; carrier at (-D,0) holds the neck ring (finish)
export function invertArm(D = 220) {
  const pivot = new THREE.Group(); const carrier = new THREE.Group(); carrier.position.set(-D, 0, 0); carrier.rotation.z = Math.PI; pivot.add(carrier);
  const m = M.std(0x2c343c, { metalness: 0.5, roughness: 0.45 }), ringM = M.metal(0xb8c0c8, 0.35);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(D, 40, 30), m); arm.position.set(-D / 2, 0, -60); pivot.add(arm);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 80, 24), m); hub.rotation.x = Math.PI / 2; hub.position.z = -60; pivot.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 6.5, 10, 32), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = -6; carrier.add(ring);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 70), m); yoke.position.set(0, -6, -42); carrier.add(yoke);
  shadowed(pivot);
  pivot.userData = { carrier, ring };
  return pivot;
}

// lehr: wide mesh belt (scrolling) + tunnel with heaters, roof removable
export function lehrBelt({ len = 7000, w = 1300, h = 650 } = {}) {
  const g = new THREE.Group();
  const beltM = new THREE.MeshStandardMaterial({ color: 0x59636e, roughness: 0.55, metalness: 0.6 });
  const u = { uOff: { value: 0 } };
  beltM.onBeforeCompile = (sh) => {
    sh.uniforms.uOff = u.uOff;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvP = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vP; uniform float uOff;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec2 q = abs(fract(vec2(vP.x - uOff, vP.y)/vec2(26.0,18.0))-0.5); float wire = smoothstep(0.32,0.45,max(q.x,q.y)); diffuseColor.rgb *= 0.45+0.8*wire;');
  };
  const belt = new THREE.Mesh(new THREE.BoxGeometry(len, 8, w), beltM); belt.position.set(len / 2, -4, 0); g.add(belt);
  const wallM = M.std(0x3d4a55, { roughness: 0.6, metalness: 0.3 }), roofM = M.std(0x46535f, { roughness: 0.6, metalness: 0.3 });
  const tunnel = new THREE.Group(); g.add(tunnel);
  for (const s of [-1, 1]) { const wl = new THREE.Mesh(new THREE.BoxGeometry(len - 600, h, 60), wallM); wl.position.set(len / 2 + 300, h / 2 - 30, s * (w / 2 + 40)); tunnel.add(wl); }
  const roof = new THREE.Group(); tunnel.add(roof);
  for (let x = 600; x < len; x += 500) { const r = new THREE.Mesh(new THREE.BoxGeometry(480, 50, w + 160), roofM); r.position.set(x + 240, h, 0); roof.add(r); }
  const heaters = [];
  for (let x = 700; x < len - 400; x += 260) for (const s of [-1, 1]) {
    const hm = new THREE.MeshBasicMaterial({ color: 0xff8a2b, toneMapped: false });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(200, 26, 14), hm); bar.position.set(x, h * 0.62, s * (w / 2 + 6)); tunnel.add(bar); heaters.push({ m: hm, x });
  }
  const rollM = M.metal(0x8f98a3, 0.4);
  for (let x = 0; x <= len; x += 250) { const r = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, w, 16), rollM); r.rotation.x = Math.PI / 2; r.position.set(x, -40, 0); g.add(r); }
  g.userData = { uOff: u.uOff, roof, heaters, tunnel, len, w, h };
  return shadowed(g);
}

// stylised hand (matte cream, thick dark outline) gripping a cylinder of radius R around the y axis.
// fingers wrap the +z (front) side, palm and forearm sit behind (-z)
export function hand(R = 31) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x9c907a, roughness: 0.95, envMapIntensity: 0.4 });
  const ink = new THREE.MeshBasicMaterial({ color: 0x101418, side: THREE.BackSide });
  const part = (geo, p, r, out = 1.1) => { const m = new THREE.Mesh(geo, skin); m.position.copy(p); m.rotation.copy(r); const o = new THREE.Mesh(geo, ink); o.scale.setScalar(out); m.add(o); g.add(m); return m; };
  for (let k = 0; k < 4; k++) {
    const y = 24 - k * 16, arcL = [2.5, 2.7, 2.6, 2.3][k], c0 = 1.55 - arcL / 2 + 0.25;
    const f = new THREE.Mesh(new THREE.TorusGeometry(R + 7.2, 7.1, 10, 28, arcL), skin); f.position.y = y; f.rotation.set(Math.PI / 2, 0, c0); g.add(f);
    const o = new THREE.Mesh(new THREE.TorusGeometry(R + 7.2, 8.3, 10, 28, arcL + 0.04), ink); o.position.y = y; o.rotation.set(Math.PI / 2, 0, c0 - 0.02); g.add(o);
  }
  part(new THREE.CapsuleGeometry(26, 50, 6, 14), new THREE.Vector3(-6, 8, -(R + 20)), new THREE.Euler(0, 0, 0.1));
  part(new THREE.CapsuleGeometry(10.5, 38, 4, 12), new THREE.Vector3(-(R + 9), 30, -6), new THREE.Euler(0.2, 0, -0.45));
  part(new THREE.CapsuleGeometry(31, 240, 6, 14), new THREE.Vector3(-20, -60, -(R + 150)), new THREE.Euler(-1.15, 0, 0.12));
  g.traverse(m => { if (m.isMesh && m.material === skin) m.castShadow = true; });
  return g;
}

// generic gummy bear (translucent) and pencil (no marks)
export function gummyBear(color = 0x2BD67B) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, transmission: 0, transparent: true, opacity: 0.86, clearcoat: 1, clearcoatRoughness: 0.15, emissive: color, emissiveIntensity: 0.18, envMapIntensity: 1.2 });
  const S = (r, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); g.add(o); };
  S(30, 1, 1.18, 0.75, 0, 40, 0); S(24, 1.05, 0.95, 0.8, 0, 92, 0); S(9, 1, 1, 0.7, -19, 112, 0); S(9, 1, 1, 0.7, 19, 112, 0);
  S(9, 0.8, 1, 0.6, 0, 86, 17); S(11, 1, 1.3, 0.75, -31, 54, 4); S(11, 1, 1.3, 0.75, 31, 54, 4); S(13, 1.1, 1, 0.8, -17, 8, 4); S(13, 1.1, 1, 0.8, 17, 8, 4);
  return shadowed(g);
}
export function pencil() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 150, 6), M.plastic(0xFFB62E)); body.position.y = 85; g.add(body);
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 1.6, 22, 6), M.std(0xE2C08D, { roughness: 0.8 })); wood.position.y = -1; g.add(wood);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(1.7, 6, 12), M.std(0x2a2d33, { roughness: 0.4, metalness: 0.3 })); lead.position.y = -15; lead.rotation.x = Math.PI; g.add(lead);
  const fer = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 16, 24), M.metal(0xC9CED6, 0.3)); fer.position.y = 168; g.add(fer);
  for (const y of [162, 174]) { const r = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.8, 6, 24), M.metal(0xA9AEB6, 0.3)); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  const er = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 16, 24), M.plastic(0xF29BA8)); er.position.y = 184; g.add(er);
  return shadowed(g);
}
