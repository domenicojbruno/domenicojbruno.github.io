// Camera choreography. At rest: a near-orthographic top-down view of the MCU
// or the current peripheral. On navigation: launch -> run -> arrival along the
// ride spline, with banking from path curvature, a look-ahead target, speed-
// driven FOV, shake, the current pulse, and sound. With prefers-reduced-motion
// the ride becomes a gentle top-down glide.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { peripheralOf, navBuses } from '../board/layout';
import { polyLength } from '../board/geom';
import { NAV } from '../board/nets';
import { planRide, toWorld, type RidePlan } from '../board/routes';
import { FOV, TAN, TILT, homeFrame, pageFrame, isWide } from '../board/view';
import type { NavId, PageId } from '../board/types';
import { useStore, type Ride } from '../state/store';
import { fx, NET_INDEX } from './fx';
import { sound } from '../audio/sound';

const ease = gsap.parseEase('power3.inOut');
const UP = new THREE.Vector3(0, 1, 0);
const SCREEN_UP = new THREE.Vector3(0, 0, -1);
const BG = new THREE.Color('#07090b'), BG_IN = new THREE.Color('#140a04');
const LEN = Object.fromEntries(NAV.map((n) => [n.id, polyLength(navBuses[n.id].lead)])) as Record<NavId, number>;

interface Pose { pos: THREE.Vector3; quat: THREE.Quaternion }
const pose = (): Pose => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
const m4 = new THREE.Matrix4();
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();

function restPose(page: PageId, w: number, h: number, out: Pose, target = new THREE.Vector3()): Pose {
  const aspect = w / h;
  let hh: number;
  if (page === 'home') { hh = homeFrame(aspect).hh; target.set(0, 0, 0); }
  else {
    const f = pageFrame(aspect), c = peripheralOf(page);
    hh = f.hh;
    target.copy(toWorld(c.x, c.y, 0));
    if (isWide(w, h)) target.x += f.hw * 0.56; else target.z += f.hh * 0.5;
  }
  const d = hh / TAN;
  out.pos.set(target.x, d * Math.cos(TILT), target.z + d * Math.sin(TILT));
  out.quat.setFromRotationMatrix(m4.lookAt(out.pos, target, SCREEN_UP));
  return out;
}

export function CameraRig() {
  const { camera, size, invalidate, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const st = useRef({
    mode: 'rest' as 'rest' | 'ride' | 'glide',
    ride: null as Ride | null, plan: null as RidePlan | null,
    e: 0, start: pose(), startFov: FOV, end: pose(), rp: pose(),
    roll: 0, fov: FOV, lastU: 0, lastRight: new THREE.Vector3(1, 0, 0), arrived: false,
    mouse: { x: 0, y: 0 }, par: { x: 0, y: 0 },
    frames: 0, slow: 0, idle: { id: null as NavId | null, t0: 0, next: 4 },
    rest: pose(), tgt: new THREE.Vector3(),
  }).current;

  useEffect(() => {
    scene.fog = new THREE.Fog(BG.clone(), 400, 900);
    scene.background = BG.clone();
    useStore.setState({ executor: true });
    const s0 = useStore.getState();
    if (s0.page !== 'home') fx.power = { id: s0.page, t0: -100 };

    const begin = (ride: Ride) => {
      const plan = planRide(ride.from, ride.to);
      st.ride = ride; st.plan = plan; st.e = 0; st.roll = 0; st.lastU = 0; st.arrived = false; st.frames = 0; st.slow = 0;
      st.start.pos.copy(cam.position); st.start.quat.copy(cam.quaternion); st.startFov = cam.fov;
      restPose(ride.to, sizeRef.current.width, sizeRef.current.height, st.end);
      st.mode = useStore.getState().reducedMotion ? 'glide' : 'ride';
      fx.plan = plan; fx.planId++; fx.color.copy(plan.color); fx.power.id = null;
      for (const sg of plan.segs) { fx.dir[NET_INDEX[sg.id]] = sg.s1 >= sg.s0 ? 1 : -1; fx.head[NET_INDEX[sg.id]] = -1; }
      if (st.mode === 'ride') sound.start();
      invalidate();
    };

    const unsub = useStore.subscribe((s, p) => {
      if (s.ride && s.ride !== p.ride) begin(s.ride);
      if (s.page !== p.page && !p.ride) { fx.power = { id: s.page === 'home' ? null : s.page, t0: -100 }; }
      if (s.hover !== p.hover || s.hoverProject !== p.hoverProject || s.page !== p.page || s.quality !== p.quality) invalidate();
    });
    const move = (ev: PointerEvent) => {
      st.mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
      st.mouse.y = (ev.clientY / window.innerHeight) * 2 - 1;
      if (st.mode === 'rest' && useStore.getState().page === 'home') invalidate();
    };
    window.addEventListener('pointermove', move, { passive: true });
    // Heartbeat LED and idle pulses: ~9 fps, home view only. Content pages do not render.
    // Precompute every ride out of the current page while idle, so a click never hitches.
    const warmUp = () => {
      const here = useStore.getState().page;
      for (const n of NAV) if (n.id !== here) planRide(here, n.id).curve.getLengths();
      if (here !== 'home') planRide(here, 'home').curve.getLengths();
    };
    const warm = window.setTimeout(warmUp, 600);
    const unsubWarm = useStore.subscribe((s, p) => { if (s.arrivals !== p.arrivals) window.setTimeout(warmUp, 900); });
    const tick = window.setInterval(() => {
      const s = useStore.getState();
      if (!document.hidden && s.page === 'home' && s.phase === 'idle') invalidate();
    }, 110);
    return () => { unsub(); window.removeEventListener('pointermove', move); window.clearInterval(tick); window.clearTimeout(warm); unsubWarm(); useStore.setState({ executor: false }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { invalidate(); }, [size, invalidate]);

  /** Camera pose on the ride curve at parameter u. */
  const ridePose = (plan: RidePlan, u: number, dt: number, speed: number, out: Pose) => {
    const la = (plan.under(u) ? 1.7 : 2.6) / plan.length;
    plan.curve.getPointAt(u, out.pos);
    if (u + la <= 1) plan.curve.getPointAt(u + la, v1).sub(out.pos); else plan.curve.getTangentAt(Math.min(1, u), v1);
    const fwd = v1.normalize();
    const right = v2.crossVectors(fwd, UP);
    if (right.lengthSq() < 0.01) right.copy(st.lastRight); else st.lastRight.copy(right.normalize());
    right.normalize();
    // bank into the turn: heading a few mm ahead, measured against "right"
    plan.curve.getTangentAt(Math.min(1, u + 3.4 / plan.length), v3);
    const turn = THREE.MathUtils.clamp(v3.dot(right), -1, 1);
    const target = THREE.MathUtils.clamp(Math.asin(turn) * (0.55 + 0.75 * speed), -0.44, 0.44);
    st.roll += (target - st.roll) * (1 - Math.exp(-dt * 7));
    const up = v4.crossVectors(right, fwd);
    right.applyAxisAngle(fwd, st.roll); up.applyAxisAngle(fwd, st.roll);
    out.quat.setFromRotationMatrix(m4.makeBasis(right, up, v3.copy(fwd).negate()));
    return out;
  };

  const setHeads = (plan: RidePlan, u: number) => {
    for (const sg of plan.segs) {
      const i = NET_INDEX[sg.id];
      if (u < sg.u0) fx.head[i] = sg.u0 === 0 ? sg.s0 : -1;
      else fx.head[i] = THREE.MathUtils.lerp(sg.s0, sg.s1, Math.min(1, (u - sg.u0) / Math.max(1e-6, sg.u1 - sg.u0)));
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05) * (import.meta.env.DEV ? ((window as unknown as { __rideScale?: number }).__rideScale ?? 1) : 1);
    const s = useStore.getState();
    const now = performance.now() / 1000;
    fx.time = now;
    let busy = false;

    if (st.mode !== 'rest' && st.plan && st.ride) {
      const plan = st.plan;
      st.e += dt; busy = true;
      if (st.mode === 'ride') {
        const tL = plan.nets.length > 1 ? 0.5 : 0.6, tA = 0.8, e = st.e;
        if (e > tL && e < tL + plan.run) { st.frames++; if (rawDt > 0.034) st.slow++; }
        if (e < tL) {
          // launch: swoop to copper level while the pin charges up
          const k = ease(e / tL);
          ridePose(plan, 0, dt, 0, st.rp);
          cam.position.lerpVectors(st.start.pos, st.rp.pos, k);
          cam.quaternion.slerpQuaternions(st.start.quat, st.rp.quat, k);
          st.fov = THREE.MathUtils.lerp(st.startFov, 54, k);
          plan.curve.getPointAt(Math.min(1, 1.2 / plan.length), fx.pulse); fx.pulse.y -= plan.under(0) ? 0.3 : 0.45;
          fx.pulseOn = 0.35 + 0.65 * k; fx.speed = 0; fx.under = 0;
          setHeads(plan, 0);
          sound.update(0.15 * k, false);
        } else if (e < tL + plan.run) {
          const u = plan.uOfT((e - tL) / plan.run);
          const speed = plan.speed(u);
          ridePose(plan, u, dt, speed, st.rp);
          cam.position.copy(st.rp.pos); cam.quaternion.copy(st.rp.quat);
          const shake = speed * speed * 0.022;
          cam.position.x += (Math.sin(now * 91) + Math.sin(now * 57.3)) * shake;
          cam.position.y += Math.sin(now * 73.1) * shake * 0.6;
          st.fov += (50 + 26 * speed - st.fov) * (1 - Math.exp(-dt * 5));
          const under = plan.under(u);
          const up = Math.min(1, u + 2.9 / plan.length);
          plan.curve.getPointAt(up, fx.pulse); fx.pulse.y -= plan.under(up) ? 0.3 : 0.45;
          fx.pulseOn = 1; fx.speed = speed; fx.under = under ? 1 : 0;
          setHeads(plan, up);
          for (const d of plan.drops) if (st.lastU < d && u >= d) sound.whoosh();
          st.lastU = u;
          sound.update(speed, under);
        } else if (e < tL + plan.run + tA) {
          // arrival: brake, rise, settle top-down; the chip powers on
          if (!st.arrived) {
            st.arrived = true;
            ridePose(plan, 1, dt, 0, st.rp);
            st.start.pos.copy(cam.position); st.start.quat.copy(cam.quaternion); st.startFov = st.fov;
            fx.pulseOn = 0; fx.speed = 0; fx.under = 0;
            fx.power = { id: st.ride.to === 'home' ? null : st.ride.to, t0: now };
            for (const sg of plan.segs) fx.head[NET_INDEX[sg.id]] = sg.s1;
            sound.click(); sound.stop();
          }
          const k = ease((e - tL - plan.run) / tA);
          cam.position.lerpVectors(st.start.pos, st.end.pos, k);
          cam.quaternion.slerpQuaternions(st.start.quat, st.end.quat, k);
          st.fov = THREE.MathUtils.lerp(st.startFov, FOV, k);
        } else finish();
      } else {
        // reduced motion: top-down glide along the trace, no banking / drops / FOV change
        const total = plan.nets.length > 1 ? 3.2 : 2.6, e = st.e;
        const g = ease(THREE.MathUtils.clamp((e / total - 0.12) / 0.76, 0, 1));
        const pts = plan.glide, f = g * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
        v1.lerpVectors(pts[i], pts[i + 1], f - i);
        const d = 30 / TAN;
        st.rp.pos.set(v1.x, d * Math.cos(TILT), v1.z + d * Math.sin(TILT));
        st.rp.quat.setFromRotationMatrix(m4.lookAt(st.rp.pos, v1, SCREEN_UP));
        const w1 = ease(Math.min(1, e / 0.7)), w2 = ease(THREE.MathUtils.clamp((e - (total - 0.8)) / 0.8, 0, 1));
        cam.position.lerpVectors(st.start.pos, st.rp.pos, w1).lerp(st.end.pos, w2);
        cam.quaternion.slerpQuaternions(st.start.quat, st.rp.quat, w1).slerp(st.end.quat, w2);
        st.fov = FOV; fx.pulseOn = 0; fx.speed = 0; fx.under = 0;
        setHeads(plan, g);
        if (e >= total) {
          fx.power = { id: st.ride.to === 'home' ? null : st.ride.to, t0: now };
          finish();
        }
      }
    }

    if (st.mode === 'rest') {
      restPose(s.page, size.width, size.height, st.rest, st.tgt);
      // subtle mouse parallax on the home view only
      const want = s.page === 'home' && !s.reducedMotion ? st.mouse : { x: 0, y: 0 };
      st.par.x += (want.x - st.par.x) * (1 - Math.exp(-dt * 4));
      st.par.y += (want.y - st.par.y) * (1 - Math.exp(-dt * 4));
      if (Math.abs(want.x - st.par.x) + Math.abs(want.y - st.par.y) > 0.002) busy = true;
      cam.position.set(st.rest.pos.x + st.par.x * 3.4, st.rest.pos.y, st.rest.pos.z + st.par.y * 2.6);
      cam.quaternion.setFromRotationMatrix(m4.lookAt(cam.position, st.tgt, SCREEN_UP));
      st.fov = FOV;
      // hover: a slow pulse runs from the MCU pin toward the label
      for (const n of NAV) fx.head[NET_INDEX[n.id]] = -1;
      if (s.hover) {
        fx.head[NET_INDEX[s.hover]] = (now * 24) % (LEN[s.hover] + 30); fx.dir[NET_INDEX[s.hover]] = 1; busy = true;
      } else if (s.page === 'home') {
        // occasional faint pulse on a random net
        if (!st.idle.id && now > st.idle.next) st.idle = { id: NAV[Math.floor(Math.random() * NAV.length)].id, t0: now, next: 0 };
        if (st.idle.id) {
          const p = (now - st.idle.t0) * 30;
          if (p > LEN[st.idle.id] + 30) st.idle = { id: null, t0: 0, next: now + 5 + Math.random() * 5 };
          else { fx.head[NET_INDEX[st.idle.id]] = p; fx.dir[NET_INDEX[st.idle.id]] = 1; busy = true; }
        }
      }
      if (now - fx.power.t0 < 2.4) busy = true;
    }

    // net brightness: lit nets fade in/out over ~200 ms, everything else dims
    const k = 1 - Math.exp(-dt * 11);
    let lit = false;
    for (const n of NAV) {
      const i = NET_INDEX[n.id];
      let target = 0;
      if (st.mode !== 'rest' && st.plan) target = st.plan.nets.includes(n.id) ? 1 : 0;
      else if (s.hover === n.id) target = 1;
      else if (!s.hover && st.idle.id === n.id && s.page === 'home') target = 0.1;
      if (target > 0.5) lit = true;
      fx.level[i] += (target - fx.level[i]) * k;
      if (Math.abs(target - fx.level[i]) > 0.004) busy = true; else fx.level[i] = target;
    }
    const dimT = lit ? 0.5 : 1;
    fx.dim += (dimT - fx.dim) * k;
    if (Math.abs(dimT - fx.dim) > 0.004) busy = true; else fx.dim = dimT;

    // projection, fog and background follow the camera height
    const y = cam.position.y;
    cam.fov = st.fov;
    cam.near = y > 6 ? y * 0.25 : 0.02;
    cam.far = 1000;
    cam.updateProjectionMatrix();
    if (!scene.fog) scene.fog = new THREE.Fog(BG.clone(), 400, 900);
    if (!(scene.background instanceof THREE.Color)) scene.background = BG.clone();
    const fog = scene.fog as THREE.Fog, bg = scene.background as THREE.Color;
    if (y < -0.02) { fog.color.copy(BG_IN); bg.copy(BG_IN); fog.near = 1.5; fog.far = 36; }
    else {
      const hgt = THREE.MathUtils.smoothstep(y, 3, 60);
      fog.color.copy(BG); bg.copy(BG);
      fog.near = THREE.MathUtils.lerp(16, 500, hgt); fog.far = THREE.MathUtils.lerp(120, 1000, hgt);
    }
    if (busy) invalidate();
  });

  function finish() {
    const plan = st.plan!;
    for (const sg of plan.segs) fx.head[NET_INDEX[sg.id]] = -1;
    fx.pulseOn = 0; fx.speed = 0; fx.under = 0;
    sound.stop();
    if (st.mode === 'ride' && st.frames > 40 && st.slow / st.frames > 0.5 && useStore.getState().quality === 'high') {
      useStore.setState({ quality: 'low' });       // adaptive quality: drop DPR, bloom and particles
    }
    st.mode = 'rest'; st.plan = null; st.ride = null;
    st.par.x = 0; st.par.y = 0;
    useStore.getState().finishRide();
    invalidate();
  }

  return null;
}
