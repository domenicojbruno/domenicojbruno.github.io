// Builds camera rides from the layout. Every ride is a CatmullRomCurve3
// generated from a navigation bus's lead trace: copper-level on the top layer,
// plunging down each via barrel into the inner layer, cresting over hills,
// with a speed profile keyed to those features. Nothing here is hand-animated;
// reroute a trace in layout.ts and its ride follows.

import * as THREE from 'three';
import { navBuses, mcu, BOARD } from './layout';
import { navById } from './nets';
import type { NavId, PageId } from './types';

export const OX = BOARD.w / 2, OZ = BOARD.h / 2;
/** Board mm -> world. World y is up; the top copper sits at y = 0. */
export const toWorld = (x: number, y: number, h = 0) => new THREE.Vector3(x - OX, h, y - OZ);

export const RIDE_H = 0.62;        // camera height above top copper, mm
export const INNER_Y = -1.0;       // inner-layer copper
export const INNER_CAM = -0.64;    // camera height when riding the inner layer
export const GND_Y = -0.3, PWR_Y = -1.32;
const LOOP_H = 2.6;
const STEP = 0.5;

interface Node { x: number; y: number; h: number; s: number; id: NavId | null; down?: boolean; up?: boolean; loop?: boolean }

const smoother = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * x * (x * (x * 6 - 15) + 10); };

/** Sample one bus lead from `sFrom` mm to its end, as ride nodes (MCU -> peripheral). */
function legNodes(id: NavId, sFrom: number): Node[] {
  const lead = navBuses[id].lead;
  const cum = [0];
  for (let i = 1; i < lead.length; i++) cum.push(cum[i - 1] + Math.hypot(lead[i].x - lead[i - 1].x, lead[i].y - lead[i - 1].y));
  const L = cum[cum.length - 1];
  const viaS = lead.map((p, i) => (p.via ? cum[i] : -1)).filter((v) => v > 0);
  const hills = navById(id).hills;
  const layerH = (s: number) => {
    let i = 1;
    while (i < lead.length - 1 && cum[i] < s) i++;
    return lead[i].layer === 'top' ? RIDE_H : INNER_CAM;
  };
  const nodes: Node[] = [];
  const n = Math.ceil((L - sFrom) / STEP);
  for (let k = 0; k <= n; k++) {
    const s = Math.min(L, sFrom + ((L - sFrom) * k) / n);
    let i = 1;
    while (i < lead.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    const x = lead[i - 1].x + (lead[i].x - lead[i - 1].x) * t;
    const y = lead[i - 1].y + (lead[i].y - lead[i - 1].y) * t;
    let h = layerH(s);
    for (const v of viaS) {
      if (Math.abs(s - v) < 0.75) h = THREE.MathUtils.lerp(layerH(v - 0.8), layerH(v + 0.8), smoother((s - v + 0.75) / 1.5));
    }
    if (h > 0) for (const hill of hills) h += hill.height * Math.exp(-(((s - hill.at) / (hill.width * 0.42)) ** 2));
    nodes.push({ x, y, h, s, id });
  }
  return nodes;
}

export interface RidePlan {
  curve: THREE.CatmullRomCurve3;
  length: number;
  run: number;                         // seconds spent on the curve
  uOfT: (t: number) => number;         // normalised time -> curve parameter
  speed: (u: number) => number;        // 0..1 relative speed at u
  under: (u: number) => boolean;       // camera is below the top copper
  segs: { id: NavId; u0: number; u1: number; s0: number; s1: number }[];
  drops: number[];                     // u of each plunge
  rises: number[];
  glide: THREE.Vector3[];              // planar polyline for the reduced-motion glide
  nets: NavId[];
  color: THREE.Color;
}

const cache = new Map<string, RidePlan>();

export function planRide(from: PageId, to: PageId): RidePlan {
  const key = `${from}>${to}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const via = from !== 'home' && to !== 'home';
  const trim = via ? 5.5 : 0;
  let nodes: Node[] = [];
  if (from !== 'home') nodes = legNodes(from, trim).reverse();
  if (via) {
    // Fast arc around the MCU pins, from one bus's exit to the other's.
    const a = nodes[nodes.length - 1];
    const b = legNodes(to as NavId, trim)[0];
    const pa = Math.atan2(a.y - mcu.y, a.x - mcu.x), pb = Math.atan2(b.y - mcu.y, b.x - mcu.x);
    const ra = Math.hypot(a.x - mcu.x, a.y - mcu.y), rb = Math.hypot(b.x - mcu.x, b.y - mcu.y);
    let d = pb - pa;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const n = Math.max(3, Math.ceil(Math.abs(d) / (Math.PI / 20)));
    for (let k = 1; k < n; k++) {
      const f = k / n, th = pa + d * f;
      const r = Math.max(15.4, THREE.MathUtils.lerp(ra, rb, f));
      nodes.push({
        x: mcu.x + Math.cos(th) * r, y: mcu.y + Math.sin(th) * r,
        h: RIDE_H + (LOOP_H - RIDE_H) * Math.sin(Math.PI * f), s: 0, id: null, loop: true,
      });
    }
  }
  if (to !== 'home') nodes = nodes.concat(legNodes(to, trim));

  // Mark plunges and climbs in travel direction.
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1].h, b = nodes[i].h;
    if (a > -0.05 && b <= -0.05) nodes[i].down = true;
    if (a <= -0.05 && b > -0.05) nodes[i].up = true;
  }

  const pts = nodes.map((n) => toWorld(n.x, n.y, n.h));
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = len[len.length - 1];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = Math.max(600, pts.length * 6);

  // ---- speed profile along arc length --------------------------------
  const downs = nodes.map((n, i) => (n.down ? len[i] : -1)).filter((v) => v >= 0);
  const ups = nodes.map((n, i) => (n.up ? len[i] : -1)).filter((v) => v >= 0);
  let v = nodes.map((node, i) => {
    const l = len[i];
    let s = 1;
    s *= THREE.MathUtils.lerp(0.2, 1, Math.pow(Math.min(1, l / 8), 0.7));        // launch
    s *= THREE.MathUtils.lerp(0.28, 1, Math.min(1, (total - l) / 7));            // brake
    for (const d of downs) {
      if (l > d - 4 && l <= d - 0.4) s *= THREE.MathUtils.lerp(1, 0.52, smoother((l - (d - 4)) / 2.4)); // anticipation
      if (l > d - 0.4 && l < d + 9) s *= THREE.MathUtils.lerp(1.9, 1, (l - d + 0.4) / 9.4);             // the drop
    }
    for (const u of ups) if (l > u - 2 && l < u + 6) s *= 1.3;
    if (node.loop) s *= 1.2;
    if (i > 2 && i < nodes.length - 3) {                                          // ease into bends
      const h1 = Math.atan2(nodes[i].y - nodes[i - 3].y, nodes[i].x - nodes[i - 3].x);
      const h2 = Math.atan2(nodes[i + 3].y - nodes[i].y, nodes[i + 3].x - nodes[i].x);
      let dh = Math.abs(h2 - h1); if (dh > Math.PI) dh = 2 * Math.PI - dh;
      s *= 1 - 0.3 * Math.min(1, dh / 0.8);
    }
    return s;
  });
  for (let pass = 0; pass < 2; pass++) {
    v = v.map((_, i) => { let a = 0, c = 0; for (let k = -3; k <= 3; k++) { const x = v[i + k]; if (x !== undefined) { a += x; c++; } } return a / c; });
  }
  const T = [0];
  for (let i = 1; i < len.length; i++) T.push(T[i - 1] + (len[i] - len[i - 1]) / ((v[i] + v[i - 1]) / 2));
  const Ttot = T[T.length - 1];
  const vmax = Math.max(...v);
  const at = (arr: number[], l: number) => {
    let lo = 0, hi = len.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= l) lo = m; else hi = m; }
    const f = (l - len[lo]) / Math.max(1e-6, len[hi] - len[lo]);
    return arr[lo] + (arr[hi] - arr[lo]) * f;
  };
  const uOfT = (t: number) => {
    const tt = Math.min(1, Math.max(0, t)) * Ttot;
    let lo = 0, hi = T.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= tt) lo = m; else hi = m; }
    const f = (tt - T[lo]) / Math.max(1e-6, T[hi] - T[lo]);
    return (len[lo] + (len[hi] - len[lo]) * f) / total;
  };

  // ---- which net the camera is on, for the current-pulse shader -------
  const segs: RidePlan['segs'] = [];
  let i0 = 0;
  for (let i = 1; i <= nodes.length; i++) {
    if (i === nodes.length || nodes[i].id !== nodes[i0].id) {
      const id = nodes[i0].id;
      if (id) segs.push({ id, u0: len[i0] / total, u1: len[i - 1] / total, s0: nodes[i0].s, s1: nodes[i - 1].s });
      i0 = i;
    }
  }

  const heights = nodes.map((n) => n.h);
  const nets = [from, to].filter((p): p is NavId => p !== 'home');
  const plan: RidePlan = {
    curve, length: total,
    run: via ? 5.3 : THREE.MathUtils.clamp(total / 19, 3.1, 4.0),
    uOfT,
    speed: (u) => at(v, u * total) / vmax,
    under: (u) => at(heights, u * total) < -0.05,
    segs,
    drops: downs.map((d) => d / total),
    rises: ups.map((d) => d / total),
    glide: nodes.filter((_, i) => i % 4 === 0 || i === nodes.length - 1).map((n) => toWorld(n.x, n.y, 0)),
    nets,
    color: new THREE.Color(navById((to !== 'home' ? to : from) as NavId).color),
  };
  cache.set(key, plan);
  return plan;
}
