// Navigation traces as real geometry with the current-pulse shader.
// Idle, they are invisible and the soldermask texture shows the copper; lit,
// they glow in the net colour with a moving pulse (uHead, mm along the net).

import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { traces, navBuses, comp, mcu } from '../board/layout';
import { footprint, toBoard } from '../board/footprints';
import { offsetPolyline } from '../board/geom';
import { NAV } from '../board/nets';
import { OX, OZ, INNER_Y } from '../board/routes';
import type { Component, Pt } from '../board/types';
import { fx, NET_INDEX, NET_COUNT } from './fx';

const vertex = /* glsl */ `
attribute float aNet;
attribute float aS;
varying float vNet;
varying float vS;
void main() {
  vNet = aNet; vS = aS;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform vec3 uColors[${NET_COUNT}];
uniform float uLevel[${NET_COUNT}];
uniform float uHead[${NET_COUNT}];
uniform float uDir[${NET_COUNT}];
uniform float uMode;   // 0 top overlay, 1 inner seen through the board, 2 inner copper (tunnel)
varying float vNet;
varying float vS;
void main() {
  int n = int(vNet + 0.5);
  vec3 c = uColors[n];
  float lv = uLevel[n];
  float hd = uHead[n];
  float d = (vS - hd) * uDir[n];                 // > 0 ahead of the pulse head
  float pulse = hd < -0.5 ? 0.0 : (d > 0.0 ? exp(-d * d / 2.5) : 0.9 * exp(d / 13.0));
  vec3 col = c * (0.72 + 3.6 * pulse);
  float a = smoothstep(0.0, 0.25, lv);
  if (uMode > 0.5 && uMode < 1.5) a *= 0.34 + 0.5 * pulse;
  if (uMode > 1.5) { col = mix(vec3(0.55, 0.27, 0.09), col, max(lv, 0.0)); a = 1.0; }
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

interface Buf { pos: number[]; net: number[]; s: number[]; idx: number[] }
const buf = (): Buf => ({ pos: [], net: [], s: [], idx: [] });

function ribbon(b: Buf, pts: Pt[], width: number, y: number, s0: number, net: number): number {
  const L = offsetPolyline(pts, width / 2), R = offsetPolyline(pts, -width / 2);
  const base = b.pos.length / 3;
  let s = s0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    b.pos.push(L[i].x - OX, y, L[i].y - OZ, R[i].x - OX, y, R[i].y - OZ);
    b.net.push(net, net); b.s.push(s, s);
    if (i > 0) { const k = base + (i - 1) * 2; b.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  return s;
}

function quad(b: Buf, c: Component, lx: number, ly: number, w: number, h: number, y: number, s: number, net: number) {
  const base = b.pos.length / 3;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = toBoard(c, lx + (sx * w) / 2, ly + (sy * h) / 2);
    b.pos.push(p.x - OX, y, p.y - OZ); b.net.push(net); b.s.push(s);
  }
  b.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
}

const padAt = (c: Component, p: Pt) => footprint(c.type).pads.find((pad) => {
  const q = toBoard(c, pad.x, pad.y);
  return Math.hypot(q.x - p.x, q.y - p.y) < 0.06;
});

function geometry(b: Buf): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('aNet', new THREE.Float32BufferAttribute(b.net, 1));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(b.s, 1));
  g.setIndex(b.idx);
  return g;
}

export function Traces() {
  const built = useMemo(() => {
    const top = buf(), ghost = buf(), inner = buf();
    for (const n of NAV) {
      const net = NET_INDEX[n.id];
      const target = comp(navBuses[n.id].target);
      const byNet = new Map<string, typeof traces>();
      for (const t of traces) if (t.nav === n.id) byNet.set(t.net, [...(byNet.get(t.net) ?? []), t]);
      for (const pieces of byNet.values()) {
        let s = 0;
        const first = pieces[0].points[0];
        const p0 = padAt(mcu, first);
        if (p0) quad(top, mcu, p0.x, p0.y, p0.w, p0.h, 0.36, 0, net);
        for (const t of pieces) {
          const w = Math.max(t.width, 0.3) + 0.06;
          if (t.layer === 'top') s = ribbon(top, t.points, w, 0.05, s, net);
          else { ribbon(ghost, t.points, w * 0.9, 0.045, s, net); s = ribbon(inner, t.points, w + 0.08, INNER_Y, s, net); }
        }
        const lastPiece = pieces[pieces.length - 1];
        const last = lastPiece.points[lastPiece.points.length - 1];
        const p1 = padAt(target, last);
        const leaded = footprint(target.type).parts.some((p) => p.mat === 'metal' && p.sz < 0.4 && p.z < 0.1);
        if (p1) quad(top, target, p1.x, p1.y, p1.w, p1.h, leaded ? 0.39 : 0.07, s, net);
      }
    }
    const uniforms = {
      uColors: { value: NAV.map((n) => new THREE.Color(n.color)) },
      uLevel: { value: fx.level }, uHead: { value: fx.head }, uDir: { value: fx.dir },
    };
    const material = (mode: number, transparent: boolean) => new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment,
      uniforms: { ...uniforms, uMode: { value: mode } },
      transparent, depthWrite: !transparent, side: THREE.DoubleSide, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    const mk = (b: Buf, mode: number, transparent: boolean, order: number) => {
      const m = new THREE.Mesh(geometry(b), material(mode, transparent));
      m.frustumCulled = false; m.renderOrder = order;
      return m;
    };
    return [mk(inner, 2, false, 0), mk(ghost, 1, true, 3), mk(top, 0, true, 4)];
  }, []);

  // Float32Array uniforms are shared with fx; just flag them each frame.
  useFrame(() => { for (const m of built) (m.material as THREE.ShaderMaterial).uniformsNeedUpdate = true; });

  return <>{built.map((m, i) => <primitive key={i} object={m} />)}</>;
}
