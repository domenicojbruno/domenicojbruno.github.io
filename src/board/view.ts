// Camera framing shared by the 3D rig, the HTML nav labels and the CSS layout.
// No three.js here: the label layer must work before WebGL has loaded.

import { navBuses, mcu } from './layout';
import type { NavId, Pt } from './types';

export const FOV = 20;                                   // degrees, narrow: near-orthographic
export const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
export const TILT = 0.085;                               // radians off vertical, so parts read as 3D

/** Matches the CSS breakpoint: datasheet panel on the right vs. bottom sheet. */
export const isWide = (w: number, h: number) => w >= 900 && w / h >= 1.05;

/** Half extents (mm) of the board area visible on the home view. */
export function homeFrame(aspect: number) {
  const hh = Math.max(28.5, 36 / aspect);                // MCU is ~40% of the viewport height
  return { hh, hw: hh * aspect };
}
export function pageFrame(aspect: number) {
  const hh = Math.max(23, 27 / aspect);
  return { hh, hw: hh * aspect };
}

/** Where a page's bus leaves the home frame: screen position (0..1) + side. */
export function labelAnchor(id: NavId, w: number, h: number): { x: number; y: number; side: 'l' | 'r' | 't' | 'b' } {
  const f = homeFrame(w / h);
  // Labels sit just outside this inner rectangle, so leave room for them (px -> mm).
  const mx = Math.min(0.42, 214 / w) * 2 * f.hw;
  const top = (112 / h) * 2 * f.hh, bot = (66 / h) * 2 * f.hh;
  const x0 = mcu.x - f.hw + mx, x1 = mcu.x + f.hw - mx;
  const y0 = mcu.y - f.hh + top, y1 = mcu.y + f.hh - bot;
  const lead = navBuses[id].lead;
  const inside = (p: Pt) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  let hit: Pt = lead[lead.length - 1], side: 'l' | 'r' | 't' | 'b' = 'r';
  for (let i = 1; i < lead.length; i++) {
    const p = lead[i - 1], q = lead[i];
    if (!inside(p) || inside(q)) continue;
    let best = 2;
    const test = (t: number, sd: 'l' | 'r' | 't' | 'b') => {
      if (t < 0 || t > 1 || t >= best) return;
      const c = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
      if (c.x < x0 - 1e-6 || c.x > x1 + 1e-6 || c.y < y0 - 1e-6 || c.y > y1 + 1e-6) return;
      best = t; hit = c; side = sd;
    };
    if (q.x !== p.x) { test((x0 - p.x) / (q.x - p.x), 'l'); test((x1 - p.x) / (q.x - p.x), 'r'); }
    if (q.y !== p.y) { test((y0 - p.y) / (q.y - p.y), 't'); test((y1 - p.y) / (q.y - p.y), 'b'); }
    break;
  }
  return {
    x: (hit.x - (mcu.x - f.hw)) / (2 * f.hw),
    y: (hit.y - (mcu.y - f.hh)) / (2 * f.hh),
    side,
  };
}
