// 2D routing geometry used to author the layout: a 45°-only path builder,
// parallel offsets for buses, serpentines for length matching, and the
// intersection helpers the layout checker relies on.

import type { Pt } from './types';

export type Dir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export const DV: Record<Dir, [number, number]> = {
  N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1],
  S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1],
};

export interface VPt extends Pt { via?: boolean }

const EPS = 1e-6;
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Builds a polyline out of compass moves so every bend is 45° by construction. */
export class Path {
  pts: VPt[] = [];
  marks: Record<string, number> = {};
  constructor(start: Pt) { this.pts.push({ x: start.x, y: start.y }); }
  get cur(): VPt { return this.pts[this.pts.length - 1]; }

  /** Move `d` mm along an axis (for diagonals `d` is the x and the y delta). */
  go(dir: Dir, d: number): this {
    if (d < -EPS) throw new Error(`Path.go(${dir}) with negative distance ${d}`);
    const [vx, vy] = DV[dir];
    this.pts.push({ x: r4(this.cur.x + vx * d), y: r4(this.cur.y + vy * d) });
    return this;
  }
  toX(dir: Dir, x: number): this { return this.go(dir, Math.abs(x - this.cur.x)); }
  toY(dir: Dir, y: number): this { return this.go(dir, Math.abs(y - this.cur.y)); }
  /** Layer change at the current point. Must sit on a straight run. */
  via(): this { this.cur.via = true; return this; }
  /** Name the segment that starts at the current point. */
  m(name: string): this { this.marks[name] = this.pts.length - 1; return this; }

  /** Finish on `p`, arriving along `dir` (N/E/S/W) after one 45° jog. */
  land(p: Pt, dir: 'N' | 'E' | 'S' | 'W'): this {
    const [vx, vy] = DV[dir];
    const c = this.cur;
    if (vx !== 0) {
      const dy = p.y - c.y;
      if (Math.abs(dy) > EPS) {
        const mx = c.x + vx * Math.abs(dy);
        if ((p.x - mx) * vx < -EPS) throw new Error(`land(): overshoot at ${p.x},${p.y}`);
        this.pts.push({ x: r4(mx), y: r4(p.y) });
      }
    } else {
      const dx = p.x - c.x;
      if (Math.abs(dx) > EPS) {
        const my = c.y + vy * Math.abs(dx);
        if ((p.y - my) * vy < -EPS) throw new Error(`land(): overshoot at ${p.x},${p.y}`);
        this.pts.push({ x: r4(p.x), y: r4(my) });
      }
    }
    if (dist(this.cur, p) > EPS) this.pts.push({ x: r4(p.x), y: r4(p.y) });
    return this;
  }
}

export function unit(a: Pt, b: Pt): Pt {
  const l = dist(a, b) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}
/** Normal used for signed offsets: n = (-dy, dx). */
export const normal = (d: Pt): Pt => ({ x: -d.y, y: d.x });

/** Parallel copy of a polyline, mitred at the joints. Via flags are kept. */
export function offsetPolyline(pts: VPt[], off: number): VPt[] {
  if (Math.abs(off) < EPS) return pts.map((p) => ({ ...p }));
  const out: VPt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const dIn = i > 0 ? unit(pts[i - 1], pts[i]) : null;
    const dOut = i < pts.length - 1 ? unit(pts[i], pts[i + 1]) : null;
    const n1 = normal((dIn ?? dOut)!);
    const n2 = normal((dOut ?? dIn)!);
    const k = 1 + n1.x * n2.x + n1.y * n2.y;
    out.push({
      x: r4(pts[i].x + (off * (n1.x + n2.x)) / k),
      y: r4(pts[i].y + (off * (n1.y + n2.y)) / k),
      via: pts[i].via,
    });
  }
  return out;
}

/**
 * Trapezoidal serpentine on segment `seg` for length matching. Bumps go out
 * on the side given by sign(amp) of the offset normal, with 45° flanks.
 */
export function serpentine(
  pts: VPt[], seg: number, count: number, amp: number, start: number,
  flat = Math.abs(amp), gap = Math.abs(amp),
): VPt[] {
  const a = pts[seg], b = pts[seg + 1];
  const d = unit(a, b), n = normal(d);
  const A = Math.abs(amp), s = Math.sign(amp);
  const add: VPt[] = [];
  let t = start;
  for (let i = 0; i < count; i++) {
    const at = (along: number, out: number): VPt => ({
      x: r4(a.x + d.x * along + n.x * out * s), y: r4(a.y + d.y * along + n.y * out * s),
    });
    add.push(at(t, 0), at(t + A, A), at(t + A + flat, A), at(t + 2 * A + flat, 0));
    t += 2 * A + flat + gap;
  }
  if (t - gap > dist(a, b) - 0.2) throw new Error('serpentine does not fit on its segment');
  return [...pts.slice(0, seg + 1), ...add, ...pts.slice(seg + 1)];
}

export function polyLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Shortest distance between two segments (0 when they intersect). */
export function segSegDist(a: Pt, b: Pt, c: Pt, d: Pt): number {
  const cross = (o: Pt, p: Pt, q: Pt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(ptSegDist(a, c, d), ptSegDist(b, c, d), ptSegDist(c, a, b), ptSegDist(d, a, b));
}

export function ptSegDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export interface ORect { x: number; y: number; hw: number; hh: number; rot: number }

export function rectCorners(r: ORect, grow = 0): Pt[] {
  const a = (r.rot * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  const hw = r.hw + grow, hh = r.hh + grow;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([lx, ly]) => ({
    x: r.x + lx * cs - ly * sn, y: r.y + lx * sn + ly * cs,
  }));
}

/** Axis-aligned half extents of a rotated rectangle. */
export function rectExtent(r: ORect): { hw: number; hh: number } {
  const a = (r.rot * Math.PI) / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  return { hw: r.hw * cs + r.hh * sn, hh: r.hw * sn + r.hh * cs };
}

export function pointInRect(p: Pt, r: ORect, grow = 0): boolean {
  const a = (-r.rot * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  const dx = p.x - r.x, dy = p.y - r.y;
  const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
  return Math.abs(lx) <= r.hw + grow && Math.abs(ly) <= r.hh + grow;
}

/** Distance from a segment to a rotated rectangle (0 when touching). */
export function segRectDist(a: Pt, b: Pt, r: ORect): number {
  if (pointInRect(a, r) || pointInRect(b, r)) return 0;
  const c = rectCorners(r);
  let m = Infinity;
  for (let i = 0; i < 4; i++) m = Math.min(m, segSegDist(a, b, c[i], c[(i + 1) % 4]));
  return m;
}

/** Separating-axis overlap test for two rotated rectangles. */
export function rectsOverlap(r1: ORect, r2: ORect, grow = 0): boolean {
  const c1 = rectCorners(r1, grow), c2 = rectCorners(r2, grow);
  for (const poly of [c1, c2]) {
    for (let i = 0; i < 2; i++) {
      const e = { x: poly[i + 1].x - poly[i].x, y: poly[i + 1].y - poly[i].y };
      const ax = { x: -e.y, y: e.x };
      const pr = (cs: Pt[]) => cs.map((p) => p.x * ax.x + p.y * ax.y);
      const a = pr(c1), b = pr(c2);
      if (Math.max(...a) < Math.min(...b) || Math.max(...b) < Math.min(...a)) return false;
    }
  }
  return true;
}
