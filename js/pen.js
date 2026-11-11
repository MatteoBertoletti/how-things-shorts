// EP 05 parts: a generic click ballpoint pen (round white barrel, blue button and grip ring, no marks), its tip
// (tungsten-carbide-grey ball in a brass socket whose lip can be open or crimped), ink film / string / wet line,
// a transparent refill, a spring, plus a crayon and a paper clip for the end card. Units: mm, y up.
import * as THREE from 'three';
import { clamp, lerp, hash } from './core.js';
import { M } from './parts.js';
import { plasticMat } from './brick.js';

export const TIP = { r: 0.5, seat: 0.52 };
export const PC = { ink: 0x2F7BFF, inkDeep: 0x1A3FA8, brass: 0xC9A24B, ball: 0x8E9AA8, paper: 0xF2E8D5, white: 0xDCDCD8, blue: 0x2F6BFF };

// ball texture: a few dots and one thin groove so the roll reads on camera
function ballTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#9aa5b2'); gr.addColorStop(0.5, '#8a96a4'); gr.addColorStop(1, '#9aa5b2'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) { const v = 120 + hash(i * 1.7) * 60; g.fillStyle = `rgba(${v},${v + 8},${v + 16},0.35)`; g.fillRect(hash(i * 3.1) * 512, hash(i * 5.3) * 256, 2, 2); }
  g.fillStyle = '#3d4550'; for (const [x, y] of [[60, 70], [180, 160], [300, 90], [420, 180], [470, 60], [120, 210]]) { g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); }
  g.fillStyle = '#4a535f'; g.fillRect(0, 124, 512, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function makeBall(r = TIP.r) {
  const m = new THREE.MeshPhysicalMaterial({ map: ballTex(), metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), m); b.castShadow = true; return b;
}
// socket lathe: closed solid ring around the ball, open = 0 (crimped, holds the ball) .. 1 (flared, the ball can drop in)
function socketPts(open = 0) {
  const pts = [], R = TIP.seat;
  pts.push(new THREE.Vector2(0.36, 6.0), new THREE.Vector2(0.36, 0.62));                       // ink bore down to the seat
  for (let i = 0; i <= 18; i++) { const a = lerp(44, 119, i / 18) * Math.PI / 180; let r = Math.sin(a) * R, y = Math.cos(a) * R; if (y < 0) r *= 1 + 0.32 * open * (-y / R); pts.push(new THREE.Vector2(r, y)); }
  const lipR = pts[pts.length - 1].x, lipY = pts[pts.length - 1].y;
  pts.push(new THREE.Vector2(lipR + 0.1 + 0.08 * open, lipY - 0.03), new THREE.Vector2(0.64 + 0.12 * open, -0.02 - 0.05 * open), new THREE.Vector2(1.2, 3.4), new THREE.Vector2(1.22, 6.0));
  pts.push(new THREE.Vector2(0.36, 6.0));
  return pts;
}
export function makeTip({ clip = null } = {}) {
  const g = new THREE.Group();
  const brass = plasticMat(PC.brass, { metalness: 1, roughness: 0.28, clearcoat: 0.2, envMapIntensity: 1.5, cut: 0xF3D68A });
  const inkM = plasticMat(PC.ink, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, cut: 0x5C9BFF });
  const socket = new THREE.Mesh(new THREE.LatheGeometry(socketPts(0), 72), brass); socket.castShadow = true; g.add(socket);
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5.5, 32), inkM); ink.position.y = 0.62 + 2.75 + 0.05; g.add(ink);
  const meniscus = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), inkM); meniscus.position.y = 0.66; meniscus.scale.y = 0.5; g.add(meniscus);
  const ball = makeBall(); g.add(ball);
  if (clip) { brass.clippingPlanes = [clip]; inkM.clippingPlanes = [clip]; }
  let lastOpen = 0;
  g.userData = { socket, ball, ink, inkM, brass, meniscus,
    setOpen(o) { if (Math.abs(o - lastOpen) < 1e-3) return; lastOpen = o; socket.geometry.dispose(); socket.geometry = new THREE.LatheGeometry(socketPts(o), 72); },
    setClip(p) { brass.clippingPlanes = p ? [p] : []; inkM.clippingPlanes = p ? [p] : []; } };
  return g;
}
// ink film: a band on the ball in the plane of motion (local y = roll axis). setArc(from, to) in radians, setFlow(t)
export function inkFilm(r = TIP.r) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g2 = c.getContext('2d');
  for (let x = 0; x < 256; x++) { const v = 0.75 + 0.25 * Math.sin(x * 0.35) * Math.sin(x * 0.11); g2.fillStyle = `rgba(${Math.round(30 * v)},${Math.round(90 * v)},${Math.round(255 * v)},1)`; g2.fillRect(x, 0, 1, 32); }
  const tx = new THREE.CanvasTexture(c); tx.wrapS = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; tx.repeat.set(4, 1);
  const m = new THREE.MeshPhysicalMaterial({ map: tx, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.95, envMapIntensity: 1.4 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.025, 64, 6, 0, 1, Math.PI / 2 - 0.26, 0.52), m);
  const grp = new THREE.Group(); grp.add(mesh); grp.rotation.x = Math.PI / 2;
  let key = '';
  grp.userData = { m, setArc(a0, a1) { const k = a0.toFixed(3) + a1.toFixed(3); if (k === key) return; key = k; mesh.geometry.dispose(); mesh.geometry = new THREE.SphereGeometry(r * 1.025, 64, 6, a0, Math.max(0.01, a1 - a0), Math.PI / 2 - 0.26, 0.52); }, setFlow(t) { tx.offset.x = -t * 1.6; } };
  return grp;
}
// transparent refill tube with ink column; tip socket at y = 0 end
export function makeRefill(len = 110) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, len, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.06, transmission: 0.85, thickness: 0.6, transparent: true, opacity: 0.55, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
  tube.position.y = 6 + len / 2; tube.renderOrder = 3; g.add(tube);
  const inkM = new THREE.MeshPhysicalMaterial({ color: PC.ink, roughness: 0.12, clearcoat: 1 });
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1, 24), inkM); g.add(ink);
  const tip = makeTip(); g.add(tip);
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 3, 24), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5 })); plug.position.y = 6 + len - 1.5; g.add(plug);
  g.userData = { tube, ink, tip, len, setInk(level) { const h = Math.max(0.01, level * (len - 8)); ink.scale.y = h; ink.position.y = 6 + h / 2; ink.visible = level > 0.002; } };
  g.userData.setInk(0.8);
  return g;
}
export function spring(len = 18, r = 2.1, turns = 9) {
  const pts = []; for (let i = 0; i <= turns * 24; i++) { const u = i / (turns * 24), a = u * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, u * len, Math.sin(a) * r)); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 40, 0.22, 8), M.metal(0xC9CED6, 0.25)); m.castShadow = true; return m;
}
// pen body parts (along +y, writing end at y = 0): front barrel (cone + grip ring), rear barrel with clip, button
export function penParts() {
  const white = plasticMat(PC.white, { roughness: 0.32, clearcoat: 0.6, cut: 0xffffff }), blue = plasticMat(PC.blue, { roughness: 0.4, clearcoat: 0.3 });
  const shell = (pts, m) => { const o = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64), m); o.castShadow = o.receiveShadow = true; return o; };
  const front = new THREE.Group();
  front.add(shell([[1.7, 0], [2.2, 0.4], [4.6, 18], [4.8, 22], [4.8, 70], [4.0, 70], [4.0, 22], [1.75, 2.0], [1.7, 0]], white));
  front.add(shell([[4.82, 24], [5.15, 25.5], [5.15, 44.5], [4.82, 46], [4.7, 46], [4.7, 24], [4.82, 24]], blue));    // grip ring
  const rear = new THREE.Group();
  rear.add(shell([[4.8, 0], [4.8, 58], [4.4, 62], [3.7, 62], [3.7, 0], [4.8, 0]], white));
  const clip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 40, 1.2), white); clip.position.set(0, 38, 5.6); rear.add(clip);
  const clipTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 5), white); clipTop.position.set(0, 58, 3.4); rear.add(clipTop);
  const button = new THREE.Group(); button.add(shell([[3.4, 0], [3.4, 11], [3.0, 12.4], [0, 12.6], [0, 0], [3.4, 0]], blue));
  return { front, rear, button, mats: { white, blue } };
}
// a full pen: refill inside, click state 0 (retracted) .. 1 (tip out)
export function makePen() {
  const g = new THREE.Group(), P = penParts(), refill = makeRefill(108), sp = spring();
  g.add(P.front, P.rear, P.button, refill, sp);
  P.rear.position.y = 70; P.button.position.y = 128;
  g.userData = { ...P, refill, spring: sp, setClick(k) { refill.position.y = lerp(3.5, -1.2, k); P.button.position.y = 128 + lerp(3, -0.5, k); sp.position.y = 6 + lerp(0, -0.5, k); sp.scale.y = lerp(1, 0.8, k); } };
  g.userData.setClick(0);
  return g;
}
// end card objects
export function crayon(color = 0x2BD67B) {
  const g = new THREE.Group(), wax = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.2 });
  const paperC = document.createElement('canvas'); paperC.width = 256; paperC.height = 512; const pg = paperC.getContext('2d'); pg.fillStyle = '#1fb565'; pg.fillRect(0, 0, 256, 512);
  pg.fillStyle = '#0d6b3a'; for (const y of [60, 90, 420, 450]) pg.fillRect(0, y, 256, 10); pg.strokeStyle = 'rgba(255,255,255,0.25)'; pg.lineWidth = 3; for (let x = 0; x < 256; x += 18) { pg.beginPath(); pg.moveTo(x, 110); pg.quadraticCurveTo(x + 9, 260, x, 400); pg.stroke(); }
  const tx = new THREE.CanvasTexture(paperC); tx.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 70, 32), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.75 })); body.position.y = 35; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 4, 32), wax); top.position.y = 72; g.add(top);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.2, 10, 32), wax); cone.position.y = 79; g.add(cone);
  const end = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 1, 32), wax); end.position.y = 0; g.add(end);
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); return g;
}
export function paperClip() {
  // classic double-loop wire path in the xy plane (mm)
  const P = [[0, 0], [0, 26], [4, 30], [8, 26], [8, 4], [4, 0], [1.5, 2.5], [1.5, 22], [4, 24.5], [6.3, 22], [6.3, 8]];
  const pts = P.map(([x, y]) => new THREE.Vector3(x - 4, y - 15, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.5, 12), M.metal(0xC9CED6, 0.18)); m.castShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}
