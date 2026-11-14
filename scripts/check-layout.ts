// Design-rule check for src/board/layout.ts. Run with `npm run check:layout`.
//   1. every bend on a signal/power trace is exactly 45°
//   2. no two traces of different nets touch on the same layer
//   3. no top-layer trace runs through a part it does not terminate on
//   4. no two courtyards overlap; nothing hangs off the board
//   5. vias keep clear of foreign traces and parts

import { components, traces, vias, navBuses, BOARD } from '../src/board/layout';
import { courtyard, footprint, toBoard } from '../src/board/footprints';
import { segSegDist, segRectDist, rectsOverlap, pointInRect, ptSegDist, dist, polyLength, rectExtent } from '../src/board/geom';

const errors: string[] = [];
const warn: string[] = [];
const f2 = (n: number) => n.toFixed(2);

// 1. bends
for (const t of traces) {
  if (t.kind === 'antenna') continue;
  for (let i = 1; i < t.points.length - 1; i++) {
    const a = t.points[i - 1], b = t.points[i], c = t.points[i + 1];
    const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(((a2 - a1) * 180) / Math.PI);
    if (d > 180) d = 360 - d;
    if (d > 0.5 && Math.abs(d - 45) > 0.5) errors.push(`bend ${f2(d)}° on ${t.net} at (${f2(b.x)}, ${f2(b.y)})`);
  }
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1], b = t.points[i];
    const ang = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 360) % 45;
    if (dist(a, b) > 0.02 && Math.min(ang, 45 - ang) > 0.6) errors.push(`off-grid segment on ${t.net} at (${f2(a.x)}, ${f2(a.y)}) -> (${f2(b.x)}, ${f2(b.y)})`);
  }
}

// 2. trace/trace
const CLEAR = 0.12;
for (let i = 0; i < traces.length; i++) {
  for (let j = i + 1; j < traces.length; j++) {
    const A = traces[i], B = traces[j];
    if (A.layer !== B.layer || A.net === B.net) continue;
    let worst = Infinity, at = A.points[0];
    for (let k = 1; k < A.points.length; k++) for (let m = 1; m < B.points.length; m++) {
      const d = segSegDist(A.points[k - 1], A.points[k], B.points[m - 1], B.points[m]) - (A.width + B.width) / 2;
      if (d < worst) { worst = d; at = A.points[k]; }
    }
    if (worst < CLEAR) errors.push(`${A.layer}: ${A.net} / ${B.net} clearance ${f2(worst)} near (${f2(at.x)}, ${f2(at.y)})`);
  }
}

// 3. trace through a part
const padHit = (cRef: typeof components[number], p: { x: number; y: number }) =>
  footprint(cRef.type).pads.some((pad) => {
    const q = toBoard(cRef, pad.x, pad.y);
    return dist(q, p) < Math.max(pad.w, pad.h) / 2 + 0.3;
  });
for (const t of traces) {
  if (t.layer !== 'top') continue;
  const ends = [t.points[0], t.points[t.points.length - 1]];
  for (const c of components) {
    const f = footprint(c.type);
    if (f.parts.length === 0 && c.type !== 'mh') continue;
    if (ends.some((e) => padHit(c, e))) continue;
    const r = courtyard(c);
    for (let k = 1; k < t.points.length; k++) {
      const d = segRectDist(t.points[k - 1], t.points[k], r) - t.width / 2;
      if (d < 0.05) { errors.push(`${t.net} runs through ${c.ref} near (${f2(t.points[k].x)}, ${f2(t.points[k].y)})`); break; }
    }
  }
}

// 4. courtyards
for (let i = 0; i < components.length; i++) {
  const a = components[i], ra = courtyard(a);
  const e = rectExtent(ra);
  const edge = a.type === 'usbc' || a.type === 'rj45' || a.type === 'barrel' ? -2.5 : 0.2;
  if (a.x - e.hw < edge || a.y - e.hh < edge || a.x + e.hw > BOARD.w - edge || a.y + e.hh > BOARD.h - edge) {
    errors.push(`${a.ref} off board at (${f2(a.x)}, ${f2(a.y)})`);
  }
  for (let j = i + 1; j < components.length; j++) {
    const b = components[j];
    if (Math.abs(a.x - b.x) > 30 || Math.abs(a.y - b.y) > 30) continue;
    if (rectsOverlap(ra, courtyard(b), -0.04)) errors.push(`${a.ref} overlaps ${b.ref} at (${f2(a.x)}, ${f2(a.y)})`);
  }
}

// 5. vias
for (const v of vias) {
  if (v.stitch) continue;
  for (const c of components) {
    if (pointInRect(v, courtyard(c), v.pad / 2 + 0.05)) {
      const own = footprint(c.type).pads.some((pad) => dist(toBoard(c, pad.x, pad.y), v) < 4) && c.ref === 'U1';
      if (!own) errors.push(`via ${v.net} at (${f2(v.x)}, ${f2(v.y)}) under ${c.ref}`);
    }
  }
  for (const t of traces) {
    if (t.net === v.net) continue;
    if (t.layer !== v.fromLayer && t.layer !== v.toLayer) continue;
    for (let k = 1; k < t.points.length; k++) {
      const d = ptSegDist(v, t.points[k - 1], t.points[k]) - t.width / 2 - v.pad / 2;
      if (d < 0.08) { errors.push(`via ${v.net} at (${f2(v.x)}, ${f2(v.y)}) touches ${t.net} (${f2(d)})`); break; }
    }
  }
  for (const w of vias) {
    if (w === v || w.stitch || w.net === v.net) continue;
    if (dist(v, w) - v.pad / 2 - w.pad / 2 < 0.08) warn.push(`vias ${v.net}/${w.net} close at (${f2(v.x)}, ${f2(v.y)})`);
  }
}

console.log(`components: ${components.length}   traces: ${traces.length}   vias: ${vias.length} (${vias.filter((v) => v.stitch).length} stitching)`);
for (const [id, b] of Object.entries(navBuses)) {
  const drops = b.lead.filter((p) => p.via).length;
  console.log(`  ${id.padEnd(17)} ${b.pinName.padEnd(5)} -> ${b.target.padEnd(3)}  ${f2(polyLength(b.lead)).padStart(6)} mm  ${drops} vias  ${b.members.length} traces`);
}
[...new Set(warn)].forEach((w) => console.log('warn:', w));
if (errors.length) {
  [...new Set(errors)].forEach((e) => console.error('ERROR:', e));
  console.error(`\n${new Set(errors).size} layout error(s)`);
  process.exit(1);
}
console.log('layout OK');
