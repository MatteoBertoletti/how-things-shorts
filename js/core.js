// Core: renderer, post (bloom + lens), math + keyframe helpers. Shared by every episode.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const W = 1080, H = 1920, FPS = 30;

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const E = {
  lin: u => u,
  i: u => u * u * u,
  o: u => 1 - Math.pow(1 - u, 3),
  io: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  io2: u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  back: u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  expo: u => (u === 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  step: u => (u < 1 ? 0 : 1),
};
// keys: [[t, value, ease?], ...]  value: number | array. ease of a key = ease INTO that key.
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
      const u = (E[e || 'io'])((t - t0) / Math.max(1e-6, t1 - t0));
      if (Array.isArray(v0)) return v0.map((a, k) => lerp(a, v1[k], u));
      return lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}
// deterministic hash noise
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }

// ---------- lens shader: light vignette, fine grain, slight colour fringing ----------
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uSeed: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.045 }, uFringe: { value: 0.0022 }, uFlash: { value: new THREE.Vector4(0, 0, 0, 0) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSeed, uVig, uGrain, uFringe; uniform vec4 uFlash; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed*1.618) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; c.x *= ${(W / H).toFixed(4)};
      float d = dot(c,c);
      vec2 off = (vUv-0.5) * uFringe * (0.6 + 6.0*d);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.0 - uVig * smoothstep(0.08, 0.75, d*2.2);
      col = mix(col, uFlash.rgb, uFlash.a);
      float g = h(vUv*vec2(${W}.0,${H}.0)) - 0.5;
      col += g * uGrain * (0.6 + 0.4*(1.0-dot(col,vec3(0.333))));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function makeRenderer() {
  const canvas3d = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(40, W / H, 1, 5000);
  // shift the picture left so the subject sits in the Shorts safe centre (x ~ 470), clear of the right-hand icons
  camera.setViewOffset(W, H, 70, 0, W, H);
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.38, 0.45, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensShader); composer.addPass(lens);
  return { THREE, renderer, scene, camera, composer, bloom, lens, canvas3d };
}
