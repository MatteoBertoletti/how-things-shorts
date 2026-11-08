// Physics: simulated once at load with a fixed timestep, recorded at 30 fps, sampled by time.
import * as CANNON from 'cannon-es';
import { hash } from './core.js';

function rec(world, bodies, dur, dt, fps = 30) {
  const frames = []; const per = Math.round(1 / (fps * dt)); const n = Math.round(dur / dt);
  const snap = () => frames.push(bodies.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
  snap();
  for (let s = 1; s <= n; s++) { world.fixedStep ? world.step(dt) : world.step(dt); if (s % per === 0) snap(); }
  return frames;
}
export function sample(sim, t, i) {
  const f = Math.max(0, Math.min(sim.frames.length - 1, t * 30));
  const a = Math.floor(f), b = Math.min(sim.frames.length - 1, a + 1), u = f - a;
  const A = sim.frames[a][i], B = sim.frames[b][i];
  return A.map((v, k) => v + (B[k] - v) * u);
}
function toothBody(mat) {
  const b = new CANNON.Body({ mass: 0.05, material: mat, linearDamping: 0.05, angularDamping: 0.1 });
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.92, 0.6, 0.76)), new CANNON.Vec3(1.175, 0, 0));
  return b;
}

// teeth pouring into a tray (tray floor top at y=3, inner half sizes)
export function simPour({ n = 70, w = 120, d = 80, h = 18, t = 3, dur = 3.2 } = {}) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9810, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true;
  world.solver.iterations = 12;
  const m = new CANNON.Material('m'); world.addContactMaterial(new CANNON.ContactMaterial(m, m, { friction: 0.4, restitution: 0.25 }));
  const st = (hx, hy, hz, x, y, z) => { const b = new CANNON.Body({ mass: 0, material: m }); b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(x, y, z); world.addBody(b); };
  st(w / 2, 10, d / 2, 0, t - 10, 0);
  st(w / 2, 40, t / 2, 0, 40, d / 2 - t / 2); st(w / 2, 40, t / 2, 0, 40, -d / 2 + t / 2);
  st(t / 2, 40, d / 2, w / 2 - t / 2, 40, 0); st(t / 2, 40, d / 2, -w / 2 + t / 2, 40, 0);
  const bodies = [], spawn = [];
  for (let i = 0; i < n; i++) {
    const b = toothBody(m);
    const ts = i * 0.016;
    b.position.set((hash(i) - 0.5) * 14, 40 + hash(i + 50) * 8, (hash(i + 99) - 0.5) * 10);
    b.quaternion.setFromEuler(hash(i + 7) * 6.28, hash(i + 13) * 6.28, hash(i + 21) * 6.28);
    b.velocity.set((hash(i + 3) - 0.5) * 120, -300, (hash(i + 4) - 0.5) * 80);
    b.angularVelocity.set((hash(i + 5) - 0.5) * 30, (hash(i + 6) - 0.5) * 30, (hash(i + 8) - 0.5) * 30);
    b.type = CANNON.Body.KINEMATIC; b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
    bodies.push(b); spawn.push(ts); world.addBody(b);
  }
  // release bodies at their spawn time (fixed-step, deterministic)
  const dt = 1 / 600, frames = [], per = 20, nS = Math.round(dur / dt);
  const snap = () => frames.push(bodies.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
  snap();
  for (let s = 1; s <= nS; s++) {
    const tt = s * dt;
    bodies.forEach((b, i) => { if (b.type === CANNON.Body.KINEMATIC && tt >= spawn[i]) { b.type = CANNON.Body.DYNAMIC; b.mass = 0.05; b.updateMassProperties(); b.velocity.set((hash(i + 3) - 0.5) * 120, -350, (hash(i + 4) - 0.5) * 80); b.angularVelocity.set((hash(i + 5) - 0.5) * 30, (hash(i + 6) - 0.5) * 30, (hash(i + 8) - 0.5) * 30); } });
    world.step(dt); if (s % per === 0) snap();
  }
  return { frames, spawn };
}

// one tooth popping out of the chain and bouncing on the mat (ground y=0)
export function simPop({ x = 0, y = 1.6, z = 0, dur = 2.5 } = {}) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9810, 0) });
  const m = new CANNON.Material('m'); world.addContactMaterial(new CANNON.ContactMaterial(m, m, { friction: 0.35, restitution: 0.45 }));
  const ground = new CANNON.Body({ mass: 0, material: m }); ground.addShape(new CANNON.Plane()); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
  const b = toothBody(m); b.position.set(x, y, z); b.velocity.set(-120, 520, 60); b.angularVelocity.set(14, 4, 22); world.addBody(b);
  return { frames: rec(world, [b], dur, 1 / 600) };
}

// generic: n small box bodies released over time into a set of static boxes. Recorded at 30 fps.
// bodies: [{ half:[x,y,z], pos:[x,y,z], vel:[x,y,z], spin:[x,y,z], at }], statics: [{ half:[..], pos:[..], rot:[x,y,z] }]
export function simBodies({ bodies, statics, dur = 3, dt = 1 / 480, mass = 0.02, friction = 0.4, restitution = 0.3, g = -9810 }) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, g, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true; world.solver.iterations = 10;
  const m = new CANNON.Material('m'); world.addContactMaterial(new CANNON.ContactMaterial(m, m, { friction, restitution }));
  for (const s of statics) { const b = new CANNON.Body({ mass: 0, material: m }); b.addShape(new CANNON.Box(new CANNON.Vec3(...s.half))); b.position.set(...s.pos); if (s.rot) b.quaternion.setFromEuler(...s.rot); world.addBody(b); }
  const B = bodies.map(d => { const b = new CANNON.Body({ mass, material: m, linearDamping: 0.02, angularDamping: 0.05 }); b.addShape(new CANNON.Box(new CANNON.Vec3(...d.half))); b.position.set(...d.pos); if (d.rot) b.quaternion.setFromEuler(...d.rot); b.type = CANNON.Body.KINEMATIC; world.addBody(b); return b; });
  const frames = [], per = Math.round(1 / (30 * dt)), n = Math.round(dur / dt);
  const snap = () => frames.push(B.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
  snap();
  for (let s = 1; s <= n; s++) {
    const t = s * dt;
    B.forEach((b, i) => { const d = bodies[i]; if (b.type === CANNON.Body.KINEMATIC && t >= d.at) { b.type = CANNON.Body.DYNAMIC; b.mass = mass; b.updateMassProperties(); b.velocity.set(...d.vel); b.angularVelocity.set(...(d.spin || [0, 0, 0])); } });
    world.step(dt); if (s % per === 0) snap();
  }
  return { frames, spawn: bodies.map(d => d.at) };
}
