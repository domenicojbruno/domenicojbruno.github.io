// The pulse head (a small HDR bead that blooms), its spark trail, and the
// speed streaks: dust motes seeded along the ride corridor that whip past.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { fx } from './fx';
import { useStore } from '../state/store';

const SPARKS = 260, DUST = 520;

export function CurrentPulse() {
  const seeded = useRef(0);
  const cursor = useRef(0);

  const o = useMemo(() => {
    // soft round sprite, so particles read as sparks rather than squares
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(cv);
    const sparkGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(SPARKS * 3).fill(-999);
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sparkMat = new THREE.PointsMaterial({ size: 0.075, map: sprite, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3).fill(-999), 3));
    const dustMat = new THREE.PointsMaterial({ size: 0.034, map: sprite, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), new THREE.MeshBasicMaterial({ toneMapped: false }));
    return { sparks, sparkMat, sp, vel: new Float32Array(SPARKS * 3), life: new Float32Array(SPARKS), dust, dustMat, head };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const low = useStore.getState().quality === 'low';
    const on = fx.pulseOn > 0;

    // seed the streak field when a new ride starts
    if (fx.plan && seeded.current !== fx.planId) {
      seeded.current = fx.planId;
      const a = o.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
      const p = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3();
      for (let i = 0; i < DUST; i++) {
        const u = Math.random();
        fx.plan.curve.getPointAt(u, p); fx.plan.curve.getTangentAt(u, t);
        side.set(-t.z, 0, t.x).normalize();
        const under = fx.plan.under(u);
        const lat = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * (under ? 1.3 : 2.6));
        a.setXYZ(i, p.x + side.x * lat, under ? p.y + (Math.random() - 0.5) * 0.5 : Math.max(0.08, p.y - 0.4 + Math.random() * 1.5), p.z + side.z * lat);
      }
      a.needsUpdate = true;
    }
    o.dust.visible = !low;                       // always drawn (parked off-screen) so its shader is warm
    (o.dust.material as THREE.PointsMaterial).opacity = on ? 0.85 : 0;
    o.dustMat.color.copy(fx.color).multiplyScalar(0.9 + fx.speed);

    if (on) o.head.position.copy(fx.pulse); else o.head.position.set(0, -999, 0);
    (o.head.material as THREE.MeshBasicMaterial).color.copy(fx.color).multiplyScalar(5 + 3 * fx.speed);
    o.head.scale.setScalar(1 + 0.35 * Math.sin(fx.time * 60));

    // sparks: emit at the head, drift, die
    o.sparks.visible = !low;
    o.sparkMat.color.copy(fx.color).multiplyScalar(3.4);
    if (on && !low) {
      const emit = 2 + Math.round(fx.pulseOn * 4);
      for (let k = 0; k < emit; k++) {
        const i = (cursor.current = (cursor.current + 1) % SPARKS);
        o.sp[i * 3] = fx.pulse.x; o.sp[i * 3 + 1] = fx.pulse.y; o.sp[i * 3 + 2] = fx.pulse.z;
        const sp = 1.5 + Math.random() * 5 * fx.pulseOn;
        const th = Math.random() * Math.PI * 2, el = Math.random() * 1.1;
        o.vel[i * 3] = Math.cos(th) * Math.cos(el) * sp;
        o.vel[i * 3 + 1] = Math.sin(el) * sp * 0.7;
        o.vel[i * 3 + 2] = Math.sin(th) * Math.cos(el) * sp;
        o.life[i] = 0.18 + Math.random() * 0.32;
      }
    }
    for (let i = 0; i < SPARKS; i++) {
      if (o.life[i] <= 0) continue;
      o.life[i] -= dt;
      if (o.life[i] <= 0) { o.sp[i * 3 + 1] = -999; continue; }
      o.vel[i * 3 + 1] -= 9 * dt;
      o.sp[i * 3] += o.vel[i * 3] * dt; o.sp[i * 3 + 1] += o.vel[i * 3 + 1] * dt; o.sp[i * 3 + 2] += o.vel[i * 3 + 2] * dt;
    }
    (o.sparks.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <>
      <primitive object={o.dust} />
      <primitive object={o.sparks} />
      <primitive object={o.head} />
    </>
  );
}
