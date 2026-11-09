// EP 03 typography test reel (GATE 1): every v3 motion helper on a neutral dark plate with one simple 3D cube.
import { makeRenderer, W, H, clamp, lerp, E } from '../../../js/core.js';
import { setAccent, SAFE, titleRawReal, kcap, odometer, strike, callout, stepSticker, dock, inkSwipe, blurred, setParallax, spring } from '../../../js/overlay.js';

export function build(out) {
  const ctx = makeRenderer(), { THREE, scene, camera, composer, lens, bloom } = ctx;
  setAccent('#FFD23A');
  scene.background = new THREE.Color('#14181F');
  scene.add(new THREE.HemisphereLight(0x7FB3D9, 0x0b0d12, 0.5));
  const key = new THREE.DirectionalLight(0xE39A52, 1.7); key.position.set(-300, 420, 380); scene.add(key);
  const fill = new THREE.DirectionalLight(0x7FB3D9, 1.1); fill.position.set(380, 120, -200); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -150; floor.receiveShadow = true; scene.add(floor);
  key.castShadow = true; key.shadow.camera.left = -400; key.shadow.camera.right = 400; key.shadow.camera.top = 400; key.shadow.camera.bottom = -400; key.shadow.camera.far = 1500; key.shadow.mapSize.set(1024, 1024);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(170, 170, 170), new THREE.MeshStandardMaterial({ color: 0xB9824A, roughness: 0.6 })); cube.castShadow = true; scene.add(cube);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0x101418 })); cube.add(edges);
  bloom.strength = 0.2;
  const g = out.getContext('2d');
  const END = 12.6, LOOP = 11.55;
  const proj = (v) => { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H }; };
  const pose = (t) => {
    const pop = spring(t - 1.3, 3.2, 9) * clamp((LOOP - 0.1 - t) / 0.2);                       // the "object" appears on the title punch
    cube.scale.setScalar(Math.max(0.001, pop)); cube.rotation.set(0.35 + 0.1 * Math.sin(t * 0.9), t * 0.7, 0.12 * Math.sin(t * 1.3));
    cube.position.set(40 * Math.sin(t * 0.8), -60 + 26 * Math.sin(t * 1.7), 0);
    const u = Math.sin(Math.PI * t / END); camera.position.set(lerp(0, 90, u), 300, lerp(1250, 1160, u)); camera.lookAt(0, 130, 0); camera.updateMatrixWorld(); cube.updateMatrixWorld();
  };
  const corner = (t, c) => { pose(t); return proj(new THREE.Vector3(...c).multiplyScalar(85).applyMatrix4(cube.matrixWorld)); };
  const steps = [{ at: 2.4, word: 'MIX.' }];
  const draw = (x, t) => {
    setParallax(Math.sin(Math.PI * t / END), 0);
    titleRawReal(x, t, { l1: 'HOW A TREE BECOMES A', l2: 'PENCIL?', y: 400, rawWord: 'TREE', scan: [0.15, 0.85], punchAt: 1.3, until: 2.4, loopAt: LOOP, end: END });
    // step sticker rides the ink swipe, slaps, docks
    dock(x, t, { steps: [{ at: 2.4, word: 'MIX.', n: 2 }], total: 5, until: LOOP - 0.05 });
    stepSticker(x, t, { at: 2.4, n: 2, word: 'MIX.' });
    inkSwipe(x, t, { at: 2.4 });
    // odometer with unit, then the number morphs into its label
    odometer(x, t, { at: 4.1, until: 6.85, value: 1100, unit: '°C', y: 720, dur: 0.8, morph: { at: 5.55, to: { x: SAFE.cx, y: 620 }, label: 'BAKED' } });
    // the strike-through
    strike(x, t, { at: 6.95, strikeAt: 7.45, until: 9.3, word: 'LEAD', repl: 'GRAPHITE', y: 600 });
    // callouts on the cube + the four entrances (noun, verb, question, twist)
    callout(x, t, { at: 9.4, until: 10.45, text: 'CEDAR', anchor: (tt) => corner(tt, [1, 1, 1]), dx: 150, dy: -170 });
    callout(x, t, { at: 10.5, until: LOOP - 0.05, text: 'FERRULE', anchor: (tt) => corner(tt, [-1, 1, 1]), dx: -150, dy: -150 });
    kcap(x, t, { at: 9.4, until: 9.95, words: [{ t: 'CEDAR', a: true, k: 'noun' }], y: 540, size: 150, hit: { kind: 'wood' } });
    kcap(x, t, { at: 9.95, until: 10.5, words: [{ t: 'SLICED', k: 'verb' }], y: 540, size: 150, dir: 1 });
    kcap(x, t, { at: 10.5, until: 11.0, words: [{ t: 'ONE', k: 'q' }, { t: 'PIECE?', k: 'q', at: 10.59 }], y: 540, size: 130 });
    kcap(x, t, { at: 11.0, until: LOOP - 0.05, words: [{ t: 'TWO', k: 'twist' }, { t: 'HALVES.', a: true, k: 'twist', at: 11.09 }], y: 540, size: 130 });
  };
  // the first dock entry is a fake "done" step so the reel shows the dock mid-episode (STEP 2/5)
  function seek(t) {
    pose(t); lens.uniforms.uSeed.value = t >= END - 1e-4 ? 0 : Math.round(t * 30);
    composer.render(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(ctx.canvas3d, 0, 0);
    blurred(g, t, draw);
    // tiny section slate so the reel reads as a test (not part of the grammar)
    const lab = t < 2.4 ? '1 · OPENING TITLE' : t < 4.1 ? '2 · INK SWIPE + STEP STICKER + DOCK' : t < 6.9 ? '3 · ODOMETER + UNIT → LABEL MORPH' : t < 9.35 ? '4 · STRIKE-THROUGH' : t < LOOP ? '5 · 3D CALLOUT + NOUN / VERB / QUESTION / TWIST' : '6 · LOOP FRAMES (BACK TO FRAME 0)';
    g.font = '700 24px "JBMono"'; g.fillStyle = 'rgba(243,233,210,0.55)'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('TYPO TEST  ' + lab, 70, 1530);
  }
  return { END, seek };
}
