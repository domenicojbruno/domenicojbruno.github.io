// Footprint templates. Every package on the board is built procedurally from
// these: a list of body primitives (for 3D and the 2D top view) plus pads.
// No CAD models. Local frame: x right, y down, origin at the package centre.

import type { Footprint, Part, PadDef, Mat, Component, Pt } from './types';

const BLACK = '#17181b';
const SILVER = '#c9ccd1';
const GOLD = '#d9b24a';
const TIN = '#b9bcc2';

const box = (
  x: number, y: number, z: number, sx: number, sy: number, sz: number,
  mat: Mat, color: string,
): Part => ({ shape: 'box', x, y, z, sx, sy, sz, mat, color });
const cyl = (
  x: number, y: number, z: number, d: number, sz: number, mat: Mat, color: string,
): Part => ({ shape: 'cyl', x, y, z, sx: d, sy: d, sz, mat, color });

/** Four-sided package. Pin 1 is top-left, numbering runs counter-clockwise. */
function quad(
  id: string, n: number, pitch: number, body: number, padCentre: number,
  padW: number, padL: number, height: number, leaded: boolean,
): Footprint {
  const pads: PadDef[] = [];
  const parts: Part[] = [box(0, 0, leaded ? 0.1 : 0.02, body, body, height - (leaded ? 0.1 : 0.02), 'plastic', BLACK)];
  const leadL = padCentre + padL / 2 - body / 2;
  const leadC = body / 2 + leadL / 2;
  let num = 1;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * pitch;
      let x = 0, y = 0, w = padL, h = padW, lx = 0, ly = 0;
      if (side === 0) { x = -padCentre; y = t; lx = -leadC; ly = t; }
      if (side === 1) { x = t; y = padCentre; w = padW; h = padL; lx = t; ly = leadC; }
      if (side === 2) { x = padCentre; y = -t; lx = leadC; ly = -t; }
      if (side === 3) { x = -t; y = -padCentre; w = padW; h = padL; lx = -t; ly = -leadC; }
      pads.push({ n: num++, x, y, w, h });
      if (leaded) {
        const horiz = side === 0 || side === 2;
        parts.push(box(lx, ly, 0.02, horiz ? leadL : padW * 0.8, horiz ? padW * 0.8 : leadL, 0.32, 'metal', TIN));
      }
    }
  }
  const ext = leaded ? (padCentre + padL / 2) * 2 : body;
  return { id, prefix: 'U', w: ext, h: ext, height, parts, pads, silk: 'outline', marking: true };
}

/** Two-sided package. Pins 1..n down the left side, n+1..2n up the right. */
function dual(
  id: string, n: number, pitch: number, bodyW: number, bodyL: number, padCentre: number,
  padW: number, padL: number, height: number, leaded = true, prefix = 'U',
): Footprint {
  const pads: PadDef[] = [];
  const parts: Part[] = [box(0, 0, leaded ? 0.1 : 0.02, bodyW, bodyL, height - 0.1, 'plastic', BLACK)];
  const leadL = padCentre + padL / 2 - bodyW / 2;
  const leadC = bodyW / 2 + leadL / 2;
  let num = 1;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * pitch;
      const x = side === 0 ? -padCentre : padCentre;
      const y = side === 0 ? t : -t;
      pads.push({ n: num++, x, y, w: padL, h: padW });
      if (leaded) parts.push(box(side === 0 ? -leadC : leadC, y, 0.02, leadL, padW * 0.8, 0.3, 'metal', TIN));
    }
  }
  return {
    id, prefix, w: (padCentre + padL / 2) * 2, h: bodyL, height, parts, pads,
    silk: 'outline', marking: true,
  };
}

/** Two-terminal chip part (capacitor, resistor, LED…), long axis along x. */
function chip(
  id: string, prefix: string, L: number, W: number, H: number, mat: Mat, color: string,
  topColor?: string,
): Footprint {
  const t = L * 0.24;
  const parts: Part[] = [
    box(0, 0, 0.02, L - 2 * t + 0.02, W, H, mat, color),
    box(-(L - t) / 2, 0, 0.02, t, W * 1.02, H * 1.02, 'metal', SILVER),
    box((L - t) / 2, 0, 0.02, t, W * 1.02, H * 1.02, 'metal', SILVER),
  ];
  if (topColor) parts.push(box(0, 0, H + 0.02, L - 2 * t, W * 0.92, 0.02, mat, topColor));
  const padL = L * 0.42;
  return {
    id, prefix, w: L + 0.5, h: W + 0.3, height: H, parts,
    pads: [
      { n: 1, x: -(L / 2 - padL / 4), y: 0, w: padL, h: W + 0.15 },
      { n: 2, x: L / 2 - padL / 4, y: 0, w: padL, h: W + 0.15 },
    ],
    silk: 'none', marking: false,
  };
}

function header(id: string, cols: number, rows: number, pitch: number): Footprint {
  const w = cols * pitch, h = rows * pitch;
  const base = pitch === 2.54 ? 2.5 : 1.5;
  const pinH = pitch === 2.54 ? 8.5 : 4.2;
  const pin = pitch === 2.54 ? 0.64 : 0.4;
  const parts: Part[] = [box(0, 0, 0.02, w, h, base, 'plastic', '#101114')];
  const pads: PadDef[] = [];
  let n = 1;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = (c - (cols - 1) / 2) * pitch, y = (r - (rows - 1) / 2) * pitch;
    parts.push(box(x, y, 0.02, pin, pin, pinH, 'gold', GOLD));
    pads.push({ n: n++, x, y, w: pitch * 0.68, h: pitch * 0.68, round: true, hole: pin * 1.5 });
  }
  return { id, prefix: 'J', w: w + 0.4, h: h + 0.4, height: pinH, parts, pads, silk: 'outline', marking: false };
}

const defs: Record<string, () => Footprint> = {
  lqfp144: () => quad('lqfp144', 36, 0.5, 20, 10.7, 0.28, 1.5, 1.4, true),
  tqfp100: () => quad('tqfp100', 25, 0.5, 14, 7.75, 0.28, 1.5, 1.0, true),
  tqfp64: () => quad('tqfp64', 16, 0.5, 10, 5.75, 0.28, 1.5, 1.0, true),
  lqfp48: () => quad('lqfp48', 12, 0.5, 7, 4.25, 0.28, 1.5, 1.4, true),
  qfn32: () => quad('qfn32', 8, 0.5, 5, 2.4, 0.26, 0.75, 0.85, false),
  qfn24: () => quad('qfn24', 6, 0.5, 4, 1.95, 0.26, 0.7, 0.85, false),
  qfn16: () => quad('qfn16', 4, 0.5, 3, 1.45, 0.26, 0.6, 0.8, false),
  soic8: () => dual('soic8', 4, 1.27, 3.9, 4.9, 2.7, 0.6, 1.55, 1.5),
  soic16: () => dual('soic16', 8, 1.27, 3.9, 9.9, 2.7, 0.6, 1.55, 1.5),
  tssop20: () => dual('tssop20', 10, 0.65, 4.4, 6.5, 2.95, 0.38, 1.3, 1.05),
  tsop54: () => dual('tsop54', 27, 0.8, 10.16, 22.22, 5.6, 0.45, 1.2, 1.05),
  sot23: () => {
    const parts = [
      box(0, 0, 0.1, 1.3, 2.9, 0.95, 'plastic', BLACK),
      box(-0.95, -0.95, 0.02, 0.7, 0.4, 0.3, 'metal', TIN),
      box(-0.95, 0.95, 0.02, 0.7, 0.4, 0.3, 'metal', TIN),
      box(0.95, 0, 0.02, 0.7, 0.4, 0.3, 'metal', TIN),
    ];
    return {
      id: 'sot23', prefix: 'Q', w: 3.0, h: 3.1, height: 1.05, parts,
      pads: [
        { n: 1, x: -1.1, y: -0.95, w: 0.9, h: 0.6 },
        { n: 2, x: -1.1, y: 0.95, w: 0.9, h: 0.6 },
        { n: 3, x: 1.1, y: 0, w: 0.9, h: 0.6 },
      ],
      silk: 'none', marking: false,
    };
  },
  sot223: () => {
    const parts = [box(0, 0, 0.1, 3.5, 6.5, 1.55, 'plastic', BLACK)];
    const pads: PadDef[] = [];
    [-2.3, 0, 2.3].forEach((y, i) => {
      parts.push(box(-2.6, y, 0.02, 1.8, 0.75, 0.3, 'metal', TIN));
      pads.push({ n: i + 1, x: -3.15, y, w: 1.9, h: 1.0 });
    });
    parts.push(box(2.6, 0, 0.02, 1.8, 3.0, 0.3, 'metal', TIN));
    pads.push({ n: 4, x: 3.15, y: 0, w: 1.9, h: 3.3 });
    return { id: 'sot223', prefix: 'U', w: 8.2, h: 6.7, height: 1.65, parts, pads, silk: 'outline', marking: true };
  },
  // Shielded RF module: can over the radio, castellated pads on three sides.
  rfshield: () => {
    const f = dual('rfshield', 8, 1.27, 12, 12, 6.2, 0.7, 1.2, 2.3, false);
    f.parts = [
      box(0, 0, 0.02, 12.6, 12.6, 0.8, 'plastic', '#0d2a18'),
      box(0, 0, 0.82, 11.2, 11.2, 1.5, 'metal', '#d3d6da'),
    ];
    f.w = 13.6; f.h = 12.8;
    return f;
  },
  c0402: () => chip('c0402', 'C', 1.0, 0.5, 0.5, 'ceramic', '#b99c74'),
  c0603: () => chip('c0603', 'C', 1.6, 0.8, 0.8, 'ceramic', '#b08f66'),
  c0805: () => chip('c0805', 'C', 2.0, 1.25, 1.0, 'ceramic', '#a98a62'),
  r0402: () => chip('r0402', 'R', 1.0, 0.5, 0.33, 'ceramic', '#e4e1d6', '#141416'),
  r0603: () => chip('r0603', 'R', 1.6, 0.8, 0.43, 'ceramic', '#e4e1d6', '#141416'),
  l0402: () => chip('l0402', 'L', 1.0, 0.5, 0.5, 'ceramic', '#5d6068'),
  led0603: () => chip('led0603', 'D', 1.6, 0.8, 0.55, 'led', '#f4f1e4'),
  sod123: () => chip('sod123', 'D', 2.7, 1.6, 1.1, 'plastic', BLACK, '#3a3c40'),
  tant: () => {
    const f = chip('tant', 'C', 3.5, 2.8, 1.9, 'plastic', '#c58a22');
    f.parts.push(box(-0.75, 0, 1.93, 0.35, 2.6, 0.02, 'plastic', '#5b3a08'));
    return f;
  },
  xtal3225: () => ({
    id: 'xtal3225', prefix: 'Y', w: 3.6, h: 2.9, height: 0.75,
    parts: [
      box(0, 0, 0.02, 3.2, 2.5, 0.35, 'ceramic', '#3a3530'),
      box(0, 0, 0.37, 2.9, 2.2, 0.38, 'metal', '#d6d8dc'),
    ],
    pads: [
      { n: 1, x: -1.1, y: 0.8, w: 1.3, h: 1.0 }, { n: 2, x: 1.1, y: 0.8, w: 1.3, h: 1.0 },
      { n: 3, x: 1.1, y: -0.8, w: 1.3, h: 1.0 }, { n: 4, x: -1.1, y: -0.8, w: 1.3, h: 1.0 },
    ],
    silk: 'outline', marking: false,
  }),
  xtal32k: () => ({
    id: 'xtal32k', prefix: 'Y', w: 3.8, h: 1.9, height: 0.85,
    parts: [
      box(0, 0, 0.02, 3.2, 1.5, 0.4, 'ceramic', '#3a3530'),
      box(0, 0, 0.42, 2.9, 1.25, 0.42, 'metal', '#d6d8dc'),
    ],
    pads: [{ n: 1, x: -1.25, y: 0, w: 1.0, h: 1.7 }, { n: 2, x: 1.25, y: 0, w: 1.0, h: 1.7 }],
    silk: 'outline', marking: false,
  }),
  xtalhc49: () => ({
    id: 'xtalhc49', prefix: 'Y', w: 12.4, h: 5.0, height: 3.6,
    parts: [
      box(0, 0, 0.02, 11.4, 4.7, 0.5, 'metal', '#b9bcc2'),
      box(0, 0, 0.5, 10.6, 3.9, 3.1, 'metal', '#d6d8dc'),
    ],
    pads: [{ n: 1, x: -4.75, y: 0, w: 2.6, h: 2.0 }, { n: 2, x: 4.75, y: 0, w: 2.6, h: 2.0 }],
    silk: 'outline', marking: false,
  }),
  ind4: () => ({
    id: 'ind4', prefix: 'L', w: 4.6, h: 4.4, height: 2.0,
    parts: [box(0, 0, 0.02, 4, 4, 1.9, 'plastic', '#34363b'), cyl(0, 0, 1.92, 2.6, 0.06, 'plastic', '#4a4d54')],
    pads: [{ n: 1, x: -1.6, y: 0, w: 1.3, h: 3.6 }, { n: 2, x: 1.6, y: 0, w: 1.3, h: 3.6 }],
    silk: 'outline', marking: false,
  }),
  ind6: () => ({
    id: 'ind6', prefix: 'L', w: 7.4, h: 7.0, height: 3.0,
    parts: [box(0, 0, 0.02, 6.6, 6.6, 2.9, 'plastic', '#34363b'), cyl(0, 0, 2.92, 4.6, 0.08, 'plastic', '#4a4d54')],
    pads: [{ n: 1, x: -2.7, y: 0, w: 1.8, h: 5.4 }, { n: 2, x: 2.7, y: 0, w: 1.8, h: 5.4 }],
    silk: 'outline', marking: false,
  }),
  elec: () => ({
    id: 'elec', prefix: 'C', w: 7.4, h: 6.8, height: 7.9,
    parts: [
      box(0, 0, 0.02, 6.6, 6.6, 0.9, 'plastic', '#101114'),
      cyl(0, 0, 0.9, 6.3, 6.9, 'metal', '#c4c7cc'),
      box(-1.6, 0, 7.8, 2.4, 5.0, 0.03, 'plastic', '#101114'),
    ],
    pads: [{ n: 1, x: -2.9, y: 0, w: 2.6, h: 1.6 }, { n: 2, x: 2.9, y: 0, w: 2.6, h: 1.6 }],
    silk: 'outline', marking: false,
  }),
  btn: () => ({
    id: 'btn', prefix: 'SW', w: 7.6, h: 6.2, height: 4.3,
    parts: [
      box(0, 0, 0.02, 6, 6, 3.2, 'metal', '#c4c7cc'),
      cyl(0, 0, 3.22, 3.4, 1.0, 'plastic', '#0e0f11'),
    ],
    pads: [
      { n: 1, x: -3.3, y: -2.25, w: 1.4, h: 1.0 }, { n: 2, x: 3.3, y: -2.25, w: 1.4, h: 1.0 },
      { n: 3, x: -3.3, y: 2.25, w: 1.4, h: 1.0 }, { n: 4, x: 3.3, y: 2.25, w: 1.4, h: 1.0 },
    ],
    silk: 'outline', marking: false,
  }),
  // Edge connectors: mating face points along +y in the local frame.
  usbc: () => {
    const pads: PadDef[] = [];
    for (let i = 0; i < 12; i++) pads.push({ n: i + 1, x: (i - 5.5) * 0.5, y: -4.0, w: 0.28, h: 1.1 });
    [-4.32, 4.32].forEach((x, i) => {
      pads.push({ n: 13 + i * 2, x, y: -3.1, w: 1.0, h: 2.0, round: true, hole: 0.6 });
      pads.push({ n: 14 + i * 2, x, y: 0.9, w: 1.0, h: 1.8, round: true, hole: 0.6 });
    });
    return {
      id: 'usbc', prefix: 'J', w: 9.6, h: 8.4, height: 3.3,
      parts: [
        box(0, 0.3, 0.02, 8.94, 7.3, 3.2, 'metal', '#cfd2d6'),
        box(0, 3.9, 0.8, 7.4, 0.12, 1.7, 'plastic', '#0b0b0d'),
      ],
      pads, silk: 'outline', marking: false,
    };
  },
  rj45: () => {
    const pads: PadDef[] = [];
    for (let i = 0; i < 8; i++) {
      pads.push({ n: i + 1, x: (i - 3.5) * 1.27, y: -8.9 + (i % 2) * 2.54, w: 1.4, h: 1.4, round: true, hole: 0.9 });
    }
    return {
      id: 'rj45', prefix: 'J', w: 16.4, h: 21.4, height: 13.5,
      parts: [
        box(0, 0, 0.02, 16, 21, 13.4, 'metal', '#c9ccd1'),
        box(0, 10.52, 2.4, 11.8, 0.1, 8.2, 'plastic', '#0b0b0d'),
        box(-6.4, 10.52, 11.2, 2.2, 0.1, 1.4, 'led', '#3ad16b'),
        box(6.4, 10.52, 11.2, 2.2, 0.1, 1.4, 'led', '#f2a81d'),
      ],
      pads, silk: 'outline', marking: false,
    };
  },
  barrel: () => ({
    id: 'barrel', prefix: 'J', w: 9.4, h: 14.9, height: 11,
    parts: [box(0, 0, 0.02, 9, 14.5, 10.9, 'plastic', '#121316')],
    pads: [
      { n: 1, x: 0, y: -6.2, w: 3.6, h: 2.2, round: true, hole: 1.2 },
      { n: 2, x: 0, y: -0.2, w: 3.6, h: 2.2, round: true, hole: 1.2 },
      { n: 3, x: 4.7, y: -3.2, w: 2.2, h: 3.4, round: true, hole: 1.2 },
    ],
    silk: 'outline', marking: false,
  }),
  hdr1x3: () => header('hdr1x3', 3, 1, 2.54),
  hdr1x4: () => header('hdr1x4', 4, 1, 2.54),
  hdr1x8: () => header('hdr1x8', 8, 1, 2.54),
  hdr1x10: () => header('hdr1x10', 10, 1, 2.54),
  hdr2x5: () => header('hdr2x5', 5, 2, 1.27),
  tp: () => ({
    id: 'tp', prefix: 'TP', w: 1.6, h: 1.6, height: 0.05, parts: [],
    pads: [{ n: 1, x: 0, y: 0, w: 1.3, h: 1.3, round: true }], silk: 'none', marking: false,
  }),
  fid: () => ({
    id: 'fid', prefix: 'FID', w: 3, h: 3, height: 0.05, parts: [],
    pads: [{ n: 1, x: 0, y: 0, w: 1.0, h: 1.0, round: true }], silk: 'none', marking: false,
  }),
  mh: () => ({
    id: 'mh', prefix: 'MH', w: 6.8, h: 6.8, height: 0.05, parts: [],
    pads: [{ n: 1, x: 0, y: 0, w: 6.4, h: 6.4, round: true, hole: 3.2 }], silk: 'none', marking: false,
  }),
};

const cache = new Map<string, Footprint>();
export function footprint(type: string): Footprint {
  let f = cache.get(type);
  if (!f) {
    const make = defs[type];
    if (!make) throw new Error(`Unknown footprint "${type}"`);
    f = make();
    cache.set(type, f);
  }
  return f;
}

/** Local footprint coordinates -> board coordinates. */
export function toBoard(c: Pick<Component, 'x' | 'y' | 'rotation'>, lx: number, ly: number): Pt {
  const a = (c.rotation * Math.PI) / 180;
  const cs = Math.cos(a), sn = Math.sin(a);
  return { x: c.x + lx * cs - ly * sn, y: c.y + lx * sn + ly * cs };
}

export function padPos(c: Component, n: number): Pt {
  const pad = footprint(c.type).pads.find((p) => p.n === n);
  if (!pad) throw new Error(`${c.ref} (${c.type}) has no pin ${n}`);
  const p = toBoard(c, pad.x, pad.y);
  return { x: +p.x.toFixed(4), y: +p.y.toFixed(4) };
}

/** Oriented bounding rectangle of the courtyard: centre, half extents, angle. */
export function courtyard(c: Component) {
  const f = footprint(c.type);
  return { x: c.x, y: c.y, hw: f.w / 2, hh: f.h / 2, rot: c.rotation };
}
