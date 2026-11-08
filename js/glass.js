// Glass: soda-lime material with fresnel rim + temperature-driven glow, a morphing lathe (gob -> parison -> bottle)
// with a capped cutaway, and a flowing molten-glass surface shader.
import * as THREE from 'three';

// temperature ramp shared by every hot-glass shader (°C)
const RAMP = `
vec3 hotRamp(float T){
  vec3 red = vec3(0.479,0.033,0.005), orange = vec3(1.0,0.254,0.024), white = vec3(1.0,0.815,0.392);
  vec3 c = mix(red, orange, smoothstep(600.0, 1100.0, T));
  c = mix(c, white, smoothstep(1100.0, 1550.0, T));
  return c;
}
float hotK(float T){ return smoothstep(400.0, 620.0, T) * (0.5 + 1.5*smoothstep(600.0, 1550.0, T)); }
`;
export const rampJS = (T) => {
  const sm = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const red = [0.479, 0.033, 0.005], or = [1, 0.254, 0.024], wh = [1, 0.815, 0.392];
  let u = sm(600, 1100, T), c = red.map((v, i) => v + (or[i] - v) * u); u = sm(1100, 1550, T); c = c.map((v, i) => v + (wh[i] - v) * u);
  const k = sm(400, 620, T) * (0.5 + 1.5 * sm(600, 1550, T));
  return { c, k };
};

// glass material. instanced: per-instance temperature from attribute aT; otherwise uniform uT.
export function glassMat({ side = THREE.FrontSide, instanced = false, tint = 0x9ADBC0, alpha = 0.22, clip = null } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0, roughness: 0.05, transparent: true, opacity: alpha, depthWrite: false,
    envMapIntensity: 2.2, clearcoat: 1, clearcoatRoughness: 0.04, side, specularIntensity: 1 });
  if (clip) { m.clippingPlanes = clip; }
  const u = { uT: { value: 20 }, uRim: { value: new THREE.Color(0xd8fff0) } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying float vT;\nuniform float uT;\n${instanced ? 'attribute float aT;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvT = ${instanced ? 'aT' : 'uT'};`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying float vT;\nuniform vec3 uRim;\n${RAMP}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += hotRamp(vT) * hotK(vT);`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        vec3 vd = normalize(vViewPosition);
        float fr = pow(1.0 - abs(dot(normalize(normal), vd)), 2.6);
        float hot = smoothstep(380.0, 600.0, vT);
        gl_FragColor.rgb += uRim * fr * 0.55 * (1.0 - hot);
        vec3 glowC = hotRamp(vT) * hotK(vT) * 0.9 * (0.55 + 0.6*(1.0 - fr));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, glowC + uRim*fr*0.12, hot*0.92);
        gl_FragColor.a = mix(mix(diffuseColor.a, 0.9, fr), mix(0.75, 0.97, smoothstep(650.0, 900.0, vT)), hot);`);
  };
  m.customProgramCacheKey = () => 'glass' + (instanced ? 'I' : '') + side;
  return m;
}

// ---------- profiles: arrays of [r, y] in mouth-up local coords (y = 0 base, mouth at top) ----------
// outer: from top inner-most point, over the top, down the outside, to the base centre (NO points)
// inner: from the top (mouth) down to the inner base centre (NI points)
export const NO = 64, NI = 40;
function resample(pts, n) {
  const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1], out = [];
  for (let k = 0; k < n; k++) { const s = L * k / (n - 1); let i = 1; while (i < d.length - 1 && d[i] < s) i++; const u = (s - d[i - 1]) / Math.max(1e-9, d[i] - d[i - 1]); out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]); }
  return out;
}
function arc(cx, cy, r, a0, a1, n = 6) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
// finished long-neck bottle: H 240, body Ø60
export function bottleProfile() {
  const H = 240;
  const outer = [[9, H], [12.5, H], ...arc(12.6, H - 2.2, 2.2, Math.PI / 2, -Math.PI / 2, 5).map(([x, y]) => [x + 1.1, y]), [13.2, H - 5], [12.2, H - 9], [12.2, 216], [12.6, 200], [14.5, 182], [20, 166], [26.5, 150], [29.6, 138], [30, 128], [30, 14],
    ...arc(26, 4, 4, 0, -Math.PI / 2, 5), [12, 0], [6, 0.8], [0, 1.6]];
  const inner = [[9, H], [9.2, H - 10], [9.6, 214], [10, 200], [11.8, 183], [17.3, 166], [23.8, 150], [26.9, 138], [27.2, 128], [27.2, 16], ...arc(23, 8, 4.2, 0, -Math.PI / 2, 4), [10, 3.8], [0, 5.2]];
  return { outer: resample(outer, NO), inner: resample(inner, NI) };
}
// parison (thick preform, mouth-up coords): finish already formed, small thick body
export function parisonProfile(cav = 1) {
  const H = 240; // the finish sits at the same place as on the bottle (the neck ring holds it)
  const ybot = 72;
  const outer = [[9, H], [12.5, H], ...arc(12.6, H - 2.2, 2.2, Math.PI / 2, -Math.PI / 2, 5).map(([x, y]) => [x + 1.1, y]), [13.2, H - 5], [12.2, H - 9], [12.2, 220], [15.5, 210], [19.5, 196], [21, 180], [21, 100], [20.2, 84], ...arc(12, ybot + 8, 8, 0, -Math.PI / 2, 5), [0, ybot]];
  const depth = 10 + cav * 128; // counter blow pushes the cavity down
  const inner = [[9, H], [9, H - 10], [8.6, 220], [7.2, 205], [6.8, Math.max(H - depth + 6, 205)], ...arc(0, H - depth + 6, 6.8, 0, -Math.PI / 2, 4).map(([x, y]) => [x * Math.min(1, 0.15 + cav), Math.min(y, H - 10)]), [0, Math.min(H - depth, H - 10)]];
  return { outer: resample(outer, NO), inner: resample(inner, NI) };
}
// gob: solid elongated cylinder, mouth-up coords with its top at y0
export function gobProfile(len = 100, r = 19, y0 = 240) {
  const outer = [[0.01, y0], ...arc(r - 6, y0 - 6, 6, Math.PI / 2, 0, 5), [r, y0 - 12], [r, y0 - len + 12], ...arc(r - 7, y0 - len + 7, 7, 0, -Math.PI / 2, 5), [0, y0 - len]];
  const inner = [[0.01, y0], [0, y0 - 1]];
  return { outer: resample(outer, NO), inner: resample(inner, NI) };
}
export function lerpProfile(A, B, u) {
  const l = (a, b) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * u, p[1] + (b[i][1] - p[1]) * u]);
  return { outer: l(A.outer, B.outer), inner: l(A.inner, B.inner) };
}

// morphing lathe with front/back shells and a capped cutaway in the plane z = 0 (keeps z <= 0)
export class GlassBody {
  constructor({ seg = 56, clip = true } = {}) {
    this.seg = seg; this.group = new THREE.Group();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4); this.wplane = new THREE.Plane();
    const cp = clip ? [this.wplane] : null;
    const np = NO + NI - 1; this.np = np;
    const pos = new Float32Array((seg + 1) * np * 3), idx = [];
    for (let i = 0; i < seg; i++) for (let j = 0; j < np - 1; j++) { const a = i * np + j, b = a + np; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); this.geo = g;
    this.back = new THREE.Mesh(g, glassMat({ side: THREE.BackSide, clip: cp })); this.back.renderOrder = 1;
    this.front = new THREE.Mesh(g, glassMat({ side: THREE.FrontSide, clip: cp })); this.front.renderOrder = 2;
    for (const m of [this.back, this.front]) { m.frustumCulled = false; this.group.add(m); }
    // cap: the wall section in the cut plane, both sides of the axis
    const cpos = new Float32Array(2 * NO * 2 * 3), cidx = [];
    for (let s = 0; s < 2; s++) for (let j = 0; j < NO - 1; j++) { const a = s * NO * 2 + j * 2; cidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cpos, 3)); cg.setIndex(cidx); this.cgeo = cg;
    this.capMat = new THREE.MeshBasicMaterial({ color: 0xFFB62E, side: THREE.DoubleSide, toneMapped: false });
    this.cap = new THREE.Mesh(cg, this.capMat); this.cap.frustumCulled = false; this.cap.visible = false; this.group.add(this.cap);
    this.mats = [this.back.material, this.front.material];
  }
  setT(T) { for (const m of this.mats) m.userData.u.uT.value = T; const c = rampJS(T); this.capMat.color.setRGB(...c.c.map(v => v * (1.2 + 0.4 * c.k))); }
  setCut(on) { this.plane.constant = on ? 0 : 1e4; this.cap.visible = on; }
  update(P) {
    // profile: outer (top -> base centre) then inner reversed (base centre -> mouth)
    const prof = [...P.outer]; for (let k = NI - 1; k >= 1; k--) prof.push(P.inner[k]);
    const pa = this.geo.attributes.position.array, seg = this.seg, np = this.np;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let j = 0; j < np; j++) { const v = (i * np + j) * 3, [r, y] = prof[j]; pa[v] = r * c; pa[v + 1] = y; pa[v + 2] = r * s; }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals(); this.geo.computeBoundingSphere();
    // cap strips: pair outer side points with the inner wall at the same height (ignore the top lip region)
    const ca = this.cgeo.attributes.position.array;
    const innerAt = (y) => { const I = P.inner; if (y >= I[0][1]) return 0; for (let k = 1; k < I.length; k++) if (I[k][1] <= y) { const u = (y - I[k][1]) / Math.max(1e-6, I[k - 1][1] - I[k][1]); return I[k][0] + (I[k - 1][0] - I[k][0]) * u; } return 0; };
    for (let s = 0; s < 2; s++) for (let j = 0; j < NO; j++) {
      const [r, y] = P.outer[j]; const ri = Math.min(r, innerAt(y)); const sg = s ? -1 : 1; const v = (s * NO * 2 + j * 2) * 3;
      ca[v] = sg * r; ca[v + 1] = y; ca[v + 2] = 0.01; ca[v + 3] = sg * ri; ca[v + 4] = y; ca[v + 5] = 0.01;
    }
    this.cgeo.attributes.position.needsUpdate = true; this.cgeo.computeBoundingSphere();
  }
  updatePlane() { this.group.updateMatrixWorld(true); this.wplane.copy(this.plane).applyMatrix4(this.group.matrixWorld); }
}

// static bottle geometry (for instanced rows / hand / choice)
let _bg = null;
export function bottleGeometry(seg = 40) {
  if (_bg) return _bg;
  const P = bottleProfile(); const prof = [...P.outer]; for (let k = NI - 1; k >= 1; k--) prof.push(P.inner[k]);
  _bg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), seg);
  return _bg;
}

// flowing molten surface (unlit, HDR for bloom)
export function moltenMat({ T = 1550, scale = 0.004, speed = [0, 0.15], bright = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uT: { value: T }, uScale: { value: scale }, uSpeed: { value: new THREE.Vector2(...speed) }, uBright: { value: bright } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime, uT, uScale, uBright; uniform vec2 uSpeed; varying vec3 vW; ${RAMP}
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        vec2 p = vW.xz*uScale + uSpeed*uTime;
        float f = fbm(p + fbm(p*1.7 - uSpeed*uTime*0.6));
        float T = uT - 520.0*(1.0-f)*(1.0-f);
        vec3 crust = vec3(0.6,0.07,0.01), hot = mix(vec3(1.0,0.254,0.024), vec3(1.0,0.815,0.392), smoothstep(1200.0,1600.0,uT));
        vec3 c = mix(crust, hot * 1.45, smoothstep(0.3, 0.8, f)) * uBright;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
