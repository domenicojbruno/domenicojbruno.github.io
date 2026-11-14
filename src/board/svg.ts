// Top-down SVG renderer for the board. One function, two uses:
//   - 'flat'    the complete 2D board (mobile / no-WebGL version, OG image)
//   - 'texture' soldermask, pour, pads, vias, silkscreen and contact shadows
//               only; rasterised onto the 3D board, with parts drawn as meshes
// It has no three.js dependency, so the mobile bundle never loads WebGL code.

import { BOARD, components, traces, vias, texts, keepouts } from './layout';
import { footprint, toBoard } from './footprints';
import type { Component, Pt, Trace } from './types';

export const COLORS = {
  bg: '#07090b',
  mask: '#0b3d1e',        // soldermask over bare laminate
  pour: '#105428',        // soldermask over the ground pour
  copper: '#1a7a3c',      // traces under mask
  gold: '#d9b24a',        // ENIG
  silk: '#e9ede6',
  hole: '#050806',
  marking: '#9aa1a8',
};

const n2 = (v: number) => (Math.round(v * 100) / 100).toString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rectD(c: Pick<Component, 'x' | 'y' | 'rotation'>, lx: number, ly: number, w: number, h: number): string {
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => toBoard(c, lx + (sx * w) / 2, ly + (sy * h) / 2));
  return `M${pts.map((p) => `${n2(p.x)} ${n2(p.y)}`).join('L')}Z`;
}
const circD = (x: number, y: number, r: number) =>
  `M${n2(x - r)} ${n2(y)}a${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0a${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0Z`;
export const polyD = (pts: Pt[]) => `M${pts.map((p) => `${n2(p.x)} ${n2(p.y)}`).join('L')}`;

/** Path data for every member of a navigation bus, top and inner layers. */
export function navPaths(id: string): { d: string; layer: Trace['layer']; lead: boolean }[] {
  return traces.filter((t) => t.nav === id).map((t) => ({ d: polyD(t.points), layer: t.layer, lead: !!t.lead }));
}

export function boardMarkup(mode: 'flat' | 'texture'): string {
  const o: string[] = [];
  const C = COLORS;
  const top = traces.filter((t) => t.layer === 'top');

  o.push(`<defs><filter id="pcb-sh" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.55"/></filter></defs>`);
  o.push(`<rect width="${BOARD.w}" height="${BOARD.h}" rx="${mode === 'flat' ? BOARD.r : 0}" fill="${C.mask}"/>`);
  o.push(`<rect x="0.9" y="0.9" width="${BOARD.w - 1.8}" height="${BOARD.h - 1.8}" rx="${BOARD.r - 0.6}" fill="${C.pour}"/>`);
  for (const z of keepouts) o.push(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="${C.mask}"/>`);

  // Isolation gaps: the pour pulls back from traces, signal vias and pads.
  o.push(`<g fill="none" stroke="${C.mask}" stroke-linecap="round" stroke-linejoin="round">`);
  for (const t of top) o.push(`<path d="${polyD(t.points)}" stroke-width="${n2(t.width + 0.55)}"/>`);
  o.push('</g>');
  let gap = '';
  for (const v of vias) if (!v.stitch) gap += circD(v.x, v.y, v.pad / 2 + 0.28);
  for (const c of components) {
    for (const p of footprint(c.type).pads) {
      if (p.round) { const q = toBoard(c, p.x, p.y); gap += circD(q.x, q.y, p.w / 2 + 0.28); }
      else gap += rectD(c, p.x, p.y, p.w + 0.5, p.h + 0.5);
    }
  }
  o.push(`<path d="${gap}" fill="${C.mask}"/>`);

  // Copper under mask.
  o.push(`<g fill="none" stroke="${C.copper}" stroke-linecap="round" stroke-linejoin="round">`);
  for (const t of top) if (t.kind !== 'antenna') o.push(`<path d="${polyD(t.points)}" stroke-width="${n2(t.width)}"/>`);
  o.push('</g>');
  for (const t of top) {
    if (t.kind === 'antenna') o.push(`<path d="${polyD(t.points)}" fill="none" stroke="${C.gold}" stroke-width="${n2(t.width)}" stroke-linejoin="miter"/>`);
  }

  // Vias: tented rings; the lead navigation vias are open and plated.
  let ring = '', hole = '', navRing = '', navHole = '';
  for (const v of vias) {
    if (v.nav && v.lead) { navRing += circD(v.x, v.y, v.pad / 2); navHole += circD(v.x, v.y, v.drill / 2); }
    else { ring += circD(v.x, v.y, v.pad / 2); hole += circD(v.x, v.y, v.drill / 2); }
  }
  o.push(`<path d="${ring}" fill="${C.copper}"/><path d="${hole}" fill="#072a14"/>`);
  o.push(`<path d="${navRing}" fill="${C.gold}"/><path d="${navHole}" fill="${C.hole}"/>`);

  // Exposed ENIG pads and drilled holes.
  let pads = '', drills = '', fidClear = '';
  for (const c of components) {
    for (const p of footprint(c.type).pads) {
      const q = toBoard(c, p.x, p.y);
      if (p.round) pads += circD(q.x, q.y, p.w / 2); else pads += rectD(c, p.x, p.y, p.w, p.h);
      if (p.hole) drills += circD(q.x, q.y, p.hole / 2);
    }
    if (c.type === 'fid') fidClear += circD(c.x, c.y, 1.5);
  }
  o.push(`<path d="${fidClear}" fill="${C.mask}"/>`);
  o.push(`<path d="${pads}" fill="${C.gold}"/><path d="${drills}" fill="${C.hole}"/>`);

  // Contact shadows (texture only): one blurred pass under every body.
  if (mode === 'texture') {
    let sh = '';
    for (const c of components) {
      const f = footprint(c.type);
      for (const p of f.parts) {
        if (p.z > 0.2) continue;
        sh += p.shape === 'cyl'
          ? circD(toBoard(c, p.x, p.y).x, toBoard(c, p.x, p.y).y, p.sx / 2 + 0.25)
          : rectD(c, p.x, p.y, p.sx + 0.5, p.sy + 0.5);
      }
    }
    o.push(`<path d="${sh}" fill="#000" opacity="0.42" filter="url(#pcb-sh)"/>`);
  }

  // Silkscreen.
  let outline = '', dots = '';
  for (const c of components) {
    const f = footprint(c.type);
    if (f.silk !== 'outline') continue;
    outline += rectD(c, 0, 0, f.w + 0.5, f.h + 0.5);
    if (f.marking) { const d = toBoard(c, -f.w / 2 - 0.75, -f.h / 2 - 0.1); dots += circD(d.x, d.y, 0.28); }
  }
  o.push(`<path d="${outline}" fill="none" stroke="${C.silk}" stroke-width="0.13"/><path d="${dots}" fill="${C.silk}"/>`);
  for (const z of keepouts) {
    o.push(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="none" stroke="${C.silk}" stroke-width="0.13" stroke-dasharray="0.8 0.6"/>`);
    if (z.label) o.push(`<text x="${n2(z.x + z.w / 2)}" y="${n2(z.y + z.h - 0.9)}" font-size="0.85" text-anchor="middle">${esc(z.label)}</text>`);
  }
  const txt: string[] = [];
  for (const c of components) {
    if (!c.silk) continue;
    const s = c.silk;
    const rot = ((s.rot % 180) + 180) % 180;
    txt.push(`<text x="${n2(s.x)}" y="${n2(s.y)}" font-size="${s.size}" text-anchor="middle"${rot ? ` transform="rotate(${n2(rot > 90 ? rot - 180 : rot)} ${n2(s.x)} ${n2(s.y)})"` : ''}>${esc(c.ref)}</text>`);
  }
  for (const t of texts) {
    txt.push(`<text x="${n2(t.x)}" y="${n2(t.y)}" font-size="${t.size}" text-anchor="${t.anchor ?? 'start'}"${t.bold ? ' font-weight="700"' : ''}${t.rot ? ` transform="rotate(${t.rot} ${n2(t.x)} ${n2(t.y)})"` : ''}>${esc(t.text)}</text>`);
  }
  o.push(`<g fill="${C.silk}" font-family="'JetBrains Mono','IBM Plex Mono','DejaVu Sans Mono',Consolas,Menlo,monospace">${txt.join('')}</g>`);

  // Bodies, top-down (flat only).
  if (mode === 'flat') {
    const layers = new Map<string, string>();
    const order: string[] = [];
    const push = (key: string, d: string) => {
      if (!layers.has(key)) { layers.set(key, ''); order.push(key); }
      layers.set(key, layers.get(key)! + d);
    };
    const maxParts = Math.max(...components.map((c) => footprint(c.type).parts.length));
    const sorted = new Map<string, ReturnType<typeof footprint>['parts']>();
    for (let i = 0; i < maxParts; i++) {
      for (const c of components) {
        let parts = sorted.get(c.type);
        if (!parts) { parts = [...footprint(c.type).parts].sort((a, b) => a.z + a.sz - (b.z + b.sz)); sorted.set(c.type, parts); }
        const p = parts[i];
        if (!p) continue;
        const key = `${String(i).padStart(3, '0')}|${p.color}`;
        if (p.shape === 'cyl') { const q = toBoard(c, p.x, p.y); push(key, circD(q.x, q.y, p.sx / 2)); }
        else push(key, rectD(c, p.x, p.y, p.sx, p.sy));
      }
    }
    for (const key of order) o.push(`<path d="${layers.get(key)}" fill="${key.split('|')[1]}"/>`);
    // Package markings.
    const mk: string[] = [];
    for (const c of components) {
      const f = footprint(c.type);
      if (!f.marking || !c.label) continue;
      const body = f.parts[0];
      const lines = c.label;
      const longest = Math.max(...lines.map((l) => l.length));
      const size = Math.min((body.sx * 0.86) / (longest * 0.62), (body.sy * 0.8) / (lines.length * 1.35), 1.7);
      const rot = ((c.rotation % 180) + 180) % 180;
      const y0 = c.y - ((lines.length - 1) * size * 1.35) / 2 + size * 0.36;
      lines.forEach((l, i) => {
        mk.push(`<text x="${n2(c.x)}" y="${n2(y0 + i * size * 1.35)}" font-size="${n2(size)}"${i === 0 ? ' font-weight="700"' : ''}${rot ? ` transform="rotate(${rot > 90 ? rot - 180 : rot} ${n2(c.x)} ${n2(c.y)})"` : ''}>${esc(l)}</text>`);
      });
      const d = toBoard(c, -body.sx / 2 + 0.7, -body.sy / 2 + 0.7);
      mk.push(`<circle cx="${n2(d.x)}" cy="${n2(d.y)}" r="${n2(Math.min(0.4, body.sx * 0.06))}" fill="#2a2c30"/>`);
    }
    o.push(`<g fill="${C.marking}" text-anchor="middle" font-family="'JetBrains Mono','IBM Plex Mono','DejaVu Sans Mono',Consolas,monospace">${mk.join('')}</g>`);
  }
  return o.join('');
}

/** Standalone SVG document (texture rasterisation, OG image). */
export function boardSvgDocument(mode: 'flat' | 'texture', width: number, height: number, viewBox = `0 0 ${BOARD.w} ${BOARD.h}`): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${boardMarkup(mode)}</svg>`;
}
