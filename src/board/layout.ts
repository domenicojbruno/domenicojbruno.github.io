// ---------------------------------------------------------------------------
// PORTFOLIO MAINBOARD, REV A — the PCB definition.
//
// Everything on the board is authored here, in millimetres (x right, y down,
// origin top-left of a 200 x 150 mm outline). Rendering code (3D and SVG)
// only reads the exported arrays: `components`, `traces`, `vias`, `texts`.
//
// To edit: move a part by changing its x/y in an add() call, reroute a bus by
// editing its Path (compass moves keep every bend at 45°), then run
// `npm run check:layout` to catch crossings, overlaps and bad bends.
// ---------------------------------------------------------------------------

import profile from '../content/profile.json';
import { footprint, padPos, courtyard } from './footprints';
import {
  Path, type VPt, offsetPolyline, serpentine, unit, normal, dist,
  ptSegDist, pointInRect, rectExtent,
} from './geom';
import type {
  Component, Trace, Via, SilkText, Zone, NavBus, NavId, Pt, Layer, RoutePt,
} from './types';

export const BOARD = { w: 200, h: 150, r: 3, thickness: 1.6, name: 'DJB-MAINBOARD', rev: 'REV A', year: '2026' };

export const components: Component[] = [];
export const traces: Trace[] = [];
export const vias: Via[] = [];
export const texts: SilkText[] = [];
export const keepouts: Zone[] = [];
export const navBuses = {} as Record<NavId, NavBus>;

const byRef = new Map<string, Component>();
const counters: Record<string, number> = {};

// ------------------------------------------------------------------ helpers

function add(type: string, x: number, y: number, rotation = 0, o: Partial<Component> = {}): Component {
  const f = footprint(type);
  let ref = o.ref;
  if (!ref) {
    do { counters[f.prefix] = (counters[f.prefix] ?? 0) + 1; ref = `${f.prefix}${counters[f.prefix]}`; }
    while (byRef.has(ref));
  }
  if (byRef.has(ref)) throw new Error(`Duplicate reference ${ref}`);
  const c: Component = { type, x, y, rotation, layer: 'top', ...o, ref };
  if (c.silk === undefined) {
    if (type === 'fid' || type === 'mh') c.silk = false;
    else {
      const e = rectExtent(courtyard(c));
      const big = f.silk === 'outline';
      const size = big ? 1.0 : 0.62;
      c.silk = type === 'tp'
        ? { x: x + 1.2, y: y + 0.25, rot: 0, size: 0.62 }
        : { x, y: y - e.hh - (big ? 0.55 : 0.3), rot: 0, size };
    }
  }
  components.push(c);
  byRef.set(ref, c);
  return c;
}

export const comp = (ref: string): Component => {
  const c = byRef.get(ref);
  if (!c) throw new Error(`No component ${ref}`);
  return c;
};
export const pin = (ref: string, n: number): Pt => padPos(comp(ref), n);

/** Split a polyline at its via points into traces on alternating layers. */
function emit(
  pts: VPt[], net: string, width: number,
  o: { nav?: NavId; lead?: boolean; kind?: Trace['kind']; other?: Layer; viaPad?: number; viaDrill?: number } = {},
): RoutePt[] {
  const other: Layer = o.other ?? 'bottom';
  let layer: Layer = 'top';
  let cur: Pt[] = [];
  const route: RoutePt[] = [];
  pts.forEach((p, i) => {
    cur.push({ x: p.x, y: p.y });
    route.push({ x: p.x, y: p.y, layer, via: !!p.via });
    if (p.via && i > 0 && i < pts.length - 1) {
      traces.push({ net, layer, width, points: cur, nav: o.nav, lead: o.lead, kind: o.kind });
      const next: Layer = layer === 'top' ? other : 'top';
      vias.push({
        x: p.x, y: p.y, fromLayer: layer, toLayer: next, net, nav: o.nav, lead: o.lead,
        pad: o.viaPad ?? 0.6, drill: o.viaDrill ?? 0.3,
      });
      layer = next;
      cur = [{ x: p.x, y: p.y }];
    }
  });
  traces.push({ net, layer, width, points: cur, nav: o.nav, lead: o.lead, kind: o.kind });
  return route;
}

/** Single trace. A Path with .via() marks drops to the bottom layer. */
function wire(net: string, width: number, path: Path | Pt[], kind: Trace['kind'] = 'signal') {
  emit(path instanceof Path ? path.pts : path, net, width, { kind });
}

/** Re-anchor one end of an offset polyline onto its pin with a 45° jog. */
function attach(pts: VPt[], p: Pt, atStart: boolean, fan: number): VPt[] {
  const a = atStart ? pts[0] : pts[pts.length - 1];
  const b = atStart ? pts[1] : pts[pts.length - 2];
  if (dist(a, p) < 1e-4) return pts;
  const d = unit(a, b);                     // pointing into the route
  const n = normal(d);
  const delta = (p.x - a.x) * n.x + (p.y - a.y) * n.y;
  const mid: VPt[] = Math.abs(delta) < 1e-4
    ? [{ x: p.x, y: p.y }]
    : [
        { x: p.x, y: p.y },
        { x: p.x + d.x * fan, y: p.y + d.y * fan },
        { x: p.x + d.x * (fan + Math.abs(delta)) - n.x * delta, y: p.y + d.y * (fan + Math.abs(delta)) - n.y * delta },
      ];
  const last = mid[mid.length - 1];
  if ((b.x - last.x) * d.x + (b.y - last.y) * d.y < 0.05) throw new Error('attach(): segment too short for fan-out');
  return atStart ? [...mid, ...pts.slice(1)] : [...pts.slice(0, -1), ...mid.reverse()];
}

interface Member {
  net: string; off: number; from: Pt; to: Pt; pinName?: string; mcuPin?: number;
  serp?: { seg: number; count: number; amp: number; start: number };
}

/**
 * A bus: parallel copies of the lead path, each re-anchored on its own pins.
 * Vias are staggered along the run, as they would be on a real board.
 */
function bus(o: {
  nav?: NavId; target?: string; lead: Path; width: number; members: Member[];
  stagger?: number; fan?: number; viaPad?: number; viaDrill?: number;
  leadViaPad?: number; leadViaDrill?: number;
}) {
  const sorted = [...o.members].sort((a, b) => a.off - b.off);
  const leadIdx = sorted.findIndex((m) => m.off === 0);
  for (const m of o.members) {
    const rank = sorted.indexOf(m) - leadIdx;
    let pts = offsetPolyline(o.lead.pts, m.off);
    pts.forEach((p, i) => {
      if (!p.via) return;
      const d = unit(pts[i - 1], pts[i + 1]);
      const s = (o.stagger ?? 1.3) * rank;
      p.x += d.x * s; p.y += d.y * s;
    });
    pts = attach(pts, m.from, true, o.fan ?? 1.0);
    pts = attach(pts, m.to, false, o.fan ?? 1.0);
    if (m.serp) pts = serpentine(pts, m.serp.seg, m.serp.count, m.serp.amp, m.serp.start);
    const isLead = m.off === 0;
    const route = emit(pts, m.net, o.width, {
      nav: o.nav, lead: isLead && !!o.nav, other: o.nav ? 'inner' : 'bottom',
      viaPad: isLead ? o.leadViaPad ?? o.viaPad : o.viaPad,
      viaDrill: isLead ? o.leadViaDrill ?? o.viaDrill : o.viaDrill,
    });
    if (isLead && o.nav) {
      navBuses[o.nav] = {
        id: o.nav, lead: route, mcuPin: m.mcuPin!, pinName: m.pinName!, target: o.target!,
        members: o.members.map((x) => ({ net: x.net, pinName: x.pinName!, mcuPin: x.mcuPin! })),
      };
    }
  }
}

/**
 * A row of passives alongside a path segment — the "buildings" a ride passes.
 * `side` is the sign of the offset normal n = (-dy, dx); `gap` is measured
 * from the lead trace to the part centre.
 */
function flank(
  path: Path, mark: string, side: 1 | -1, gap: number, type: string,
  o: { pitch?: number; m0?: number; m1?: number; par?: boolean } = {},
) {
  const i = path.marks[mark];
  const a = path.pts[i], b = path.pts[i + 1];
  const d = unit(a, b), n = normal(d);
  const len = dist(a, b);
  const pitch = o.pitch ?? 1.2;
  const ang = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  const f = footprint(type);
  for (let t = o.m0 ?? 1; t <= len - (o.m1 ?? 1) + 1e-6; t += pitch) {
    const x = a.x + d.x * t + n.x * side * gap, y = a.y + d.y * t + n.y * side * gap;
    const out = (o.par ? f.h : f.w) / 2 + 0.55;
    add(type, +x.toFixed(3), +y.toFixed(3), ang + (o.par ? 0 : 90), {
      silk: { x: x + n.x * side * out, y: y + n.y * side * out, rot: ang + 90, size: 0.5 },
    });
  }
}

/** Decoupling cap placed relative to a chip centre. */
const near = (ref: string, type: string, dx: number, dy: number, rot = 0, o: Partial<Component> = {}) =>
  add(type, comp(ref).x + dx, comp(ref).y + dy, rot, o);

// ================================================================ U1 — MCU
// LQFP-144, pin 1 top-left, counter-clockwise. The home page.
add('lqfp144', 100, 75, 0, {
  ref: 'U1', pageId: 'home',
  label: [profile.name.toUpperCase(), profile.role.toUpperCase(), `${profile.schoolShort} · ${profile.degreeShort}`, `${BOARD.rev} · ${BOARD.year}`],
});

// Corner decoupling, 45° toward the package.
for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
  const cx = 100 + sx * 12.3, cy = 75 + sy * 12.3;
  const rot = (Math.atan2(sy, sx) * 180) / Math.PI;
  add('c0402', cx + sx * 0.55, cy - sy * 0.55, rot, { silk: false });
  add('c0402', cx - sx * 0.55, cy + sy * 0.55, rot, { silk: false });
  add('c0603', cx + sx * 1.35, cy + sy * 1.35, rot + 90, { silk: false });
}

// Y1: 8 MHz crystal and load caps on OSC_IN / OSC_OUT (pins 12, 13).
add('xtal3225', 83, 72, 0, { ref: 'Y1', silk: { x: 80.6, y: 70.1, rot: 0, size: 0.62 } });
wire('OSC_IN', 0.2, new Path(pin('U1', 12)).toX('W', 85.4).land(pin('Y1', 3), 'W'));
wire('OSC_OUT', 0.2, new Path(pin('U1', 13)).toX('W', 85.6).land(pin('Y1', 2), 'W'));
add('c0402', 80.2, 71.2, 0, { silk: false });
add('c0402', 80.2, 72.8, 0, { silk: false });

// ============================================================ page buses
// Each navigation net leaves a named MCU pin, dives through at least one via
// pair into the inner layer, and lands on its peripheral.

// ---- About: U2 24C02 ID EEPROM on I2C1 --------------------------------
add('soic8', 30, 30, 0, { ref: 'U2', pageId: 'about', label: ['24C02', 'ID EEPROM'] });
const about = new Path(pin('U1', 6)).m('w0').toX('W', 80).m('a').toX('NW', 70).m('b')
  .toX('W', 64).via().toX('W', 58).toX('NW', 48).toY('N', 44).via().m('d')
  .toY('N', 39).m('e').land(pin('U2', 6), 'W');
bus({
  nav: 'about', target: 'U2', lead: about, width: 0.25, leadViaPad: 1.3, leadViaDrill: 0.8,
  members: [
    { net: 'I2C1_SCL', off: 0, from: pin('U1', 6), to: pin('U2', 6), pinName: 'PB6', mcuPin: 6 },
    { net: 'I2C1_SDA', off: -1, from: pin('U1', 8), to: pin('U2', 5), pinName: 'PB7', mcuPin: 8 },
  ],
});
flank(about, 'w0', 1, 1.7, 'r0402', { m0: 5.3, m1: 0.6, pitch: 1.0 });
flank(about, 'a', -1, 3.0, 'c0603', { m0: 2.2, m1: 3.4, pitch: 1.6 });
flank(about, 'b', 1, 2.0, 'c0603', { m0: 0.9, m1: 1.3, pitch: 1.5 });
flank(about, 'b', -1, 3.0, 'c0603', { m0: 2.2, m1: 1.3, pitch: 1.5 });
flank(about, 'd', 1, 2.0, 'c0402', { m0: 1.2, m1: 0.6, pitch: 1.0 });
flank(about, 'd', -1, 3.0, 'c0402', { m0: 1.2, m1: 2.0, pitch: 1.0 });
flank(about, 'e', 1, 2.0, 'r0402', { m0: 1.6, m1: 2.4, pitch: 1.1 });
flank(about, 'e', -1, 3.0, 'c0402', { m0: 2.6, m1: 3.4, pitch: 1.1 });
// Op-amp beside the diagonal: the ride crests over its edge.
add('soic8', 78.0, 60.75, 45, { ref: 'U11', label: ['OPA2333', 'OP-AMP'], silk: { x: 80.6, y: 56.6, rot: 0, size: 0.9 } });
// I2C pull-ups and EEPROM decoupling.
add('r0402', 37.2, 26.6, 90);
add('r0402', 38.6, 26.6, 90);
near('U2', 'c0402', 0, -4.2, 0);

// ---- Extracurriculars: U5 RF module on USART1 --------------------------
add('rfshield', 24, 78, 0, { ref: 'U5', pageId: 'extracurriculars', label: ['RF MODULE', '2.4 GHz'] });
const uart = new Path(pin('U1', 22)).m('w0').toX('W', 81).m('a').toX('SW', 75).m('b')
  .toX('W', 66).via().toX('W', 60).toX('NW', 54).toX('W', 48).via().m('c')
  .toX('W', 40).land(pin('U5', 13), 'W');
bus({
  nav: 'extracurriculars', target: 'U5', lead: uart, width: 0.25, leadViaPad: 1.3, leadViaDrill: 0.8,
  members: [
    { net: 'UART_TX', off: 0, from: pin('U1', 22), to: pin('U5', 13), pinName: 'PA9', mcuPin: 22 },
    { net: 'UART_RX', off: -1, from: pin('U1', 24), to: pin('U5', 12), pinName: 'PA10', mcuPin: 24 },
  ],
});
flank(uart, 'w0', 1, 1.7, 'r0402', { m0: 5.3, m1: 0.6, pitch: 1.0 });
flank(uart, 'w0', -1, 2.7, 'r0402', { m0: 5.3, m1: 1.6, pitch: 1.0 });
flank(uart, 'a', 1, 2.0, 'c0603', { m0: 1.4, m1: 1.4, pitch: 1.6 });
flank(uart, 'a', -1, 3.0, 'c0603', { m0: 3.4, m1: 1.4, pitch: 1.6 });
flank(uart, 'b', 1, 2.0, 'c0603', { m0: 1.2, m1: 1.4, pitch: 1.5 });
flank(uart, 'b', -1, 3.0, 'c0603', { m0: 1.2, m1: 1.4, pitch: 1.5 });
flank(uart, 'c', 1, 2.0, 'c0402', { m0: 1.4, m1: 1.0, pitch: 1.0 });
flank(uart, 'c', -1, 3.0, 'c0402', { m0: 1.4, m1: 1.0, pitch: 1.0 });
// Antenna feed, pi matching network, and the meandered trace antenna.
add('l0402', 15.4, pin('U5', 4).y, 0, { ref: 'L6', silk: false });
wire('ANT_FEED', 0.4, [pin('U5', 4), pin('L6', 2)]);
wire('ANT', 0.4, [pin('L6', 1), { x: 12.5, y: pin('U5', 4).y }]);
add('c0402', 14.0, 79.2, 90, { silk: false });
add('c0402', 16.8, 79.2, 90, { silk: false });
traces.push({
  net: 'ANT', layer: 'top', width: 0.5, kind: 'antenna',
  points: [
    { x: 12.5, y: 77.365 }, { x: 5, y: 77.365 }, { x: 5, y: 74.4 }, { x: 11, y: 74.4 },
    { x: 11, y: 71.4 }, { x: 5, y: 71.4 }, { x: 5, y: 68.4 }, { x: 11, y: 68.4 },
    { x: 11, y: 65.4 }, { x: 5, y: 65.4 },
  ],
});
keepouts.push({ x: 2.4, y: 63, w: 11, h: 18.6, label: 'ANT KEEP-OUT' });
near('U5', 'c0603', -2.6, -8.4, 0, { silk: false });
near('U5', 'c0402', 0, -8.4, 0, { silk: false });
near('U5', 'c0402', 2.2, -8.4, 0, { silk: false });

// ---- Experience: U4 DS1307 RTC on I2C2 + RTC_INT -----------------------
add('soic8', 40, 118, 0, { ref: 'U4', pageId: 'experience', label: ['DS1307Z', 'RTC'] });
const rtc = new Path(pin('U1', 42)).m('s0').toY('S', 93).m('a').toX('SW', 84).m('b')
  .toX('W', 76).via().toX('W', 68).toX('SW', 60).toX('W', 56).via().m('c')
  .toX('W', 53).m('d').land(pin('U4', 6), 'W');
bus({
  nav: 'experience', target: 'U4', lead: rtc, width: 0.25, leadViaPad: 1.3, leadViaDrill: 0.8,
  members: [
    { net: 'RTC_INT', off: 1, from: pin('U1', 40), to: pin('U4', 7), pinName: 'PC13', mcuPin: 40 },
    { net: 'I2C2_SCL', off: 0, from: pin('U1', 42), to: pin('U4', 6), pinName: 'PB10', mcuPin: 42 },
    { net: 'I2C2_SDA', off: -1, from: pin('U1', 44), to: pin('U4', 5), pinName: 'PB11', mcuPin: 44 },
  ],
});
flank(rtc, 's0', 1, 2.7, 'r0402', { m0: 5.3, m1: 1.2, pitch: 1.0 });
flank(rtc, 'a', 1, 3.0, 'c0603', { m0: 3.6, m1: 3.4, pitch: 1.6 });
flank(rtc, 'a', -1, 3.0, 'c0603', { m0: 3.2, m1: 2.0, pitch: 1.6 });
flank(rtc, 'b', 1, 3.0, 'c0603', { m0: 2.6, m1: 1.5, pitch: 1.5 });
flank(rtc, 'b', -1, 3.0, 'c0603', { m0: 1.4, m1: 1.5, pitch: 1.5 });
flank(rtc, 'd', 1, 3.0, 'c0402', { m0: 1.4, m1: 2.6, pitch: 1.1 });
flank(rtc, 'd', -1, 3.0, 'c0402', { m0: 1.4, m1: 3.6, pitch: 1.1 });
// Y2: 32.768 kHz crystal on X1/X2, backup supply cap, I2C pull-ups.
add('xtal32k', 33.6, 116.7, 90, { ref: 'Y2', silk: { x: 31.2, y: 116.7, rot: 90, size: 0.62 } });
wire('RTC_X1', 0.2, new Path(pin('U4', 1)).toX('W', 35.6).land(pin('Y2', 1), 'W'));
wire('RTC_X2', 0.2, new Path(pin('U4', 2)).toX('W', 35.6).land(pin('Y2', 2), 'W'));
near('U4', 'c0603', 0, -4.4, 0);
near('U4', 'tant', 0.6, 6.4, 0);
add('r0402', 46.6, 122.6, 0);
add('r0402', 46.6, 124.0, 0);

// ---- Resume: U6 CP2102N bridge + J1 USB-C, length-matched pair ---------
add('qfn24', 104, 124, 0, { ref: 'U6', pageId: 'resume', label: ['CP2102N', 'USB-UART'] });
const usb = new Path(pin('U1', 58)).m('s0').toY('S', 93).m('a').toX('SW', 96.75).m('b')
  .toY('S', 102).via().toY('S', 106).toX('SE', 103.75).toY('S', 115.5).via().m('c')
  .land(pin('U6', 22), 'S');
bus({
  nav: 'resume', target: 'U6', lead: usb, width: 0.2, stagger: 1.1,
  viaPad: 0.45, viaDrill: 0.25, leadViaPad: 0.5, leadViaDrill: 0.3,
  members: [
    { net: 'USB_D+', off: 0, from: pin('U1', 58), to: pin('U6', 22), pinName: 'PA12', mcuPin: 58 },
    {
      net: 'USB_D-', off: 0.5, from: pin('U1', 57), to: pin('U6', 23), pinName: 'PA11', mcuPin: 57,
      serp: { seg: 0, count: 3, amp: 0.4, start: 2.3 },
    },
  ],
});
flank(usb, 's0', -1, 1.9, 'r0402', { m0: 5.3, m1: 0.5, pitch: 1.0 });
flank(usb, 'a', -1, 1.9, 'c0603', { m0: 1.6, m1: 0.8, pitch: 1.6 });
flank(usb, 'b', 1, 2.4, 'c0402', { m0: 2.6, m1: 1.4, pitch: 1.0 });
flank(usb, 'b', -1, 1.9, 'c0402', { m0: 0.6, m1: 1.4, pitch: 1.0 });
flank(usb, 'c', 1, 2.4, 'c0402', { m0: 1.3, m1: 2.4, pitch: 1.0 });
flank(usb, 'c', -1, 1.9, 'c0402', { m0: 1.3, m1: 2.4, pitch: 1.0 });
add('usbc', 104, 145.2, 0, { ref: 'J1', silk: { x: 111.6, y: 143, rot: 0, size: 1.0 } });
bus({
  lead: new Path(pin('U6', 10)).toY('S', 130).land({ x: 104.25, y: 140.65 }, 'S'), width: 0.2,
  members: [
    { net: 'USB_CONN_D+', off: 0, from: pin('U6', 10), to: { x: 104.25, y: 140.65 } },
    { net: 'USB_CONN_D-', off: 0.5, from: pin('U6', 9), to: { x: 103.75, y: 140.65 } },
  ],
});
add('sot23', 108.6, 135.4, 0, { ref: 'D4', silk: { x: 108.6, y: 133.2, rot: 0, size: 0.62 } });
near('U6', 'c0402', 4.0, -1.0, 90, { silk: false });
near('U6', 'c0402', 4.0, 1.4, 90, { silk: false });
near('U6', 'c0603', -4.4, 0.6, 90, { silk: false });
add('r0402', 98.4, 138.4, 0);
add('r0402', 98.4, 139.8, 0);

// ---- Contact: U7 DP83848 Ethernet PHY on RMII + J2 RJ45 ----------------
add('lqfp48', 160, 112, 0, { ref: 'U7', pageId: 'contact', label: ['DP83848C', 'ETH PHY'] });
const rmii = new Path(pin('U1', 80)).m('e0').toX('E', 121).m('a').toX('SE', 129).m('b')
  .toX('E', 133).via().toX('E', 138).toX('SE', 146).toY('S', 100).via().m('c')
  .toY('S', 104).m('d').land(pin('U7', 7), 'E');
bus({
  nav: 'contact', target: 'U7', lead: rmii, width: 0.25, leadViaPad: 1.3, leadViaDrill: 0.8,
  members: [
    { net: 'RMII_RXD1', off: -2, from: pin('U1', 84), to: pin('U7', 3), pinName: 'PC5', mcuPin: 84 },
    { net: 'RMII_RXD0', off: -1, from: pin('U1', 82), to: pin('U7', 5), pinName: 'PC4', mcuPin: 82 },
    { net: 'RMII_TXD1', off: 0, from: pin('U1', 80), to: pin('U7', 7), pinName: 'PB13', mcuPin: 80 },
    { net: 'RMII_TXD0', off: 1, from: pin('U1', 78), to: pin('U7', 9), pinName: 'PB12', mcuPin: 78 },
  ],
});
flank(rmii, 'e0', -1, 3.7, 'r0402', { m0: 5.3, m1: 1.2, pitch: 1.0 });
flank(rmii, 'e0', 1, 2.7, 'r0402', { m0: 5.3, m1: 1.4, pitch: 1.0 });
flank(rmii, 'a', -1, 4.0, 'c0603', { m0: 1.2, m1: 3.0, pitch: 1.6 });
flank(rmii, 'a', 1, 3.0, 'c0603', { m0: 3.4, m1: 1.6, pitch: 1.6 });
flank(rmii, 'b', -1, 4.0, 'c0603', { m0: 2.4, m1: 0.6, pitch: 1.5 });
flank(rmii, 'b', 1, 3.0, 'c0603', { m0: 0.6, m1: 0.6, pitch: 1.5 });
flank(rmii, 'd', -1, 4.0, 'c0402', { m0: 2.2, m1: 3.6, pitch: 1.1 });
flank(rmii, 'd', 1, 3.0, 'c0402', { m0: 1.2, m1: 3.0, pitch: 1.1 });
add('rj45', 189, 112, 270, { ref: 'J2', silk: { x: 189, y: 102.4, rot: 0, size: 1.0 } });
add('xtal3225', 160, 104.2, 0, { ref: 'Y3' });
near('U7', 'c0402', -2.4, 7.0, 0, { silk: false });
near('U7', 'c0402', -0.6, 7.0, 0, { silk: false });
near('U7', 'c0603', 1.6, 7.0, 0, { silk: false });
near('U7', 'c0402', 6.6, -3.0, 90, { silk: false });
near('U7', 'r0402', 6.6, 3.2, 90, { silk: false });
// PHY -> magnetics: two differential pairs.
bus({
  lead: new Path(pin('U7', 28)).toX('E', 172).land(pin('J2', 3), 'E'), width: 0.2, fan: 0.9,
  members: [
    { net: 'ETH_TX+', off: 0, from: pin('U7', 28), to: pin('J2', 3) },
    { net: 'ETH_TX-', off: 0.5, from: pin('U7', 27), to: pin('J2', 1) },
  ],
});
bus({
  lead: new Path(pin('U7', 32)).toX('E', 172).land(pin('J2', 7), 'E'), width: 0.2, fan: 0.9,
  members: [
    { net: 'ETH_RX+', off: 0, from: pin('U7', 32), to: pin('J2', 7) },
    { net: 'ETH_RX-', off: 0.5, from: pin('U7', 31), to: pin('J2', 5) },
  ],
});

// ---- Projects: U3 W25Q512 QSPI flash + one sub-chip per project --------
add('tqfp100', 158, 38, 0, { ref: 'U3', pageId: 'projects', label: ['W25Q512JV', 'QSPI FLASH'] });
const qspi = new Path(pin('U1', 116)).m('n0').toY('N', 57).m('a').toX('NE', 113.25).m('b')
  .toX('E', 119).via().toX('E', 126).toX('NE', 134).toX('E', 138).via().m('c')
  .land(pin('U3', 19), 'E');
bus({
  nav: 'projects', target: 'U3', lead: qspi, width: 0.25, leadViaPad: 1.3, leadViaDrill: 0.8,
  members: [
    { net: 'QSPI_IO3', off: -1, from: pin('U1', 118), to: pin('U3', 17), pinName: 'PF6', mcuPin: 118 },
    { net: 'QSPI_IO2', off: 0, from: pin('U1', 116), to: pin('U3', 19), pinName: 'PF7', mcuPin: 116 },
    { net: 'QSPI_IO1', off: 1, from: pin('U1', 114), to: pin('U3', 21), pinName: 'PF9', mcuPin: 114 },
    { net: 'QSPI_IO0', off: 2, from: pin('U1', 112), to: pin('U3', 23), pinName: 'PF8', mcuPin: 112 },
  ],
});
flank(qspi, 'n0', -1, 2.7, 'r0402', { m0: 5.3, m1: 0.4, pitch: 1.0 });
flank(qspi, 'a', -1, 3.0, 'c0603', { m0: 1.4, m1: 2.2, pitch: 1.6 });
flank(qspi, 'a', 1, 4.0, 'c0603', { m0: 3.4, m1: 3.0, pitch: 1.6 });
flank(qspi, 'b', -1, 3.0, 'c0603', { m0: 0.8, m1: 1.4, pitch: 1.5 });
flank(qspi, 'b', 1, 4.0, 'c0603', { m0: 3.0, m1: 1.4, pitch: 1.5 });
flank(qspi, 'c', -1, 3.0, 'c0402', { m0: 3.2, m1: 2.2, pitch: 1.1 });
flank(qspi, 'c', 1, 4.0, 'c0402', { m0: 4.2, m1: 2.2, pitch: 1.1 });

/** Project sub-chip with a two-trace link to the flash. */
function subchip(
  ref: string, type: string, x: number, y: number, rot: number, slug: string, label: string[],
  lead: Path, a: [number, number], b: [number, number], off: number,
) {
  add(type, x, y, rot, { ref, projectSlug: slug, label });
  bus({
    lead: lead.land(pin(ref, a[1]), lead.marks.dir === 0 ? 'N' : lead.marks.dir === 1 ? 'E' : 'S'), width: 0.2,
    members: [
      { net: `${ref}_CS`, off: 0, from: pin('U3', a[0]), to: pin(ref, a[1]) },
      { net: `${ref}_IO`, off, from: pin('U3', b[0]), to: pin(ref, b[1]) },
    ],
  });
}
const from3 = (n: number, dir: 0 | 1 | 2) => { const p = new Path(pin('U3', n)); p.marks.dir = dir; return p; };
// North row: the four main projects.
subchip('U31', 'qfn32', 140.25, 16, 0, 'clear-exg', ['clEAR-ExG', 'EEG/ECG AFE'], from3(3, 0).toX('W', 147), [3, 13], [1, 15], 1);
subchip('U32', 'qfn32', 152.25, 16, 0, 'miller-ota', ['MILLER OTA', '2-STAGE'], from3(99, 0), [99, 13], [97, 15], 1);
subchip('U33', 'qfn32', 163.75, 16, 0, 'event-camera', ['EVENT CAM', 'AUTOFOCUS'], from3(79, 0), [79, 10], [77, 12], 1);
subchip('U34', 'qfn32', 175.75, 16, 0, 'tcbg-temp-control', ['TcBG TEMP', 'CONTROL'], from3(73, 0).toX('E', 169), [73, 12], [75, 10], -1);
// East column and south row: the smaller FPGA builds.
subchip('U35', 'soic8', 186, 29, 0, 'vga-pointer', ['VGA PTR'], from3(69, 1).toX('E', 172), [69, 2], [67, 3], 1);
subchip('U36', 'soic8', 186, 40, 0, 'digital-lock', ['DIG LOCK'], from3(60, 1).toX('E', 176), [60, 2], [58, 3], 1);
subchip('U37', 'soic8', 186, 51, 0, 'microwave-controller', ['MW OVEN'], from3(53, 1).toX('E', 172), [53, 2], [51, 3], 1);
subchip('U38', 'soic8', 152, 58, 90, 'binary-to-bcd', ['BIN2BCD'], from3(28, 2).toY('S', 49), [28, 2], [26, 3], 1);
subchip('U39', 'soic8', 164, 58, 90, 'fsm-calculator', ['FSM CALC'], from3(48, 2).toY('S', 49), [48, 3], [50, 2], -1);
// Flash decoupling at the corners.
for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
  add('c0402', 158 + sx * 9.4, 38 + sy * 9.4, (Math.atan2(sy, sx) * 180) / Math.PI, { silk: false });
}
for (const r of ['U31', 'U32', 'U33', 'U34']) near(r, 'c0402', 0, -3.9, 0, { silk: false });
for (const r of ['U35', 'U36', 'U37']) near(r, 'c0402', 4.6, 0, 90, { silk: false });
for (const r of ['U38', 'U39']) near(r, 'c0402', 0, 4.6, 0, { silk: false });

// =============================================================== scenery
// Non-navigation hardware: it makes the board read as a real dev board and
// gives the rides something to fly past.

// ---- SDRAM with a length-matched bus -----------------------------------
add('tsop54', 80, 39, 90, { ref: 'U8', label: ['IS42S16400J', 'SDRAM 64Mb'] });
{
  const lead = new Path(pin('U1', 138)).toY('N', 59).toX('NW', 84).land(pin('U8', 46), 'N');
  const members: Member[] = [];
  for (let o = 4; o >= -3; o--) {
    const target = 28 + Math.round((84 + o - 69.6) / 0.8 + 1e-9);
    members.push({
      net: `SDRAM_D${4 - o}`, off: o, from: pin('U1', 138 - 2 * o), to: pin('U8', target),
      serp: o === 4 ? { seg: 1, count: 3, amp: 0.7, start: 2.4 }
        : o === -3 ? { seg: 1, count: 3, amp: -0.7, start: 2.4 } : undefined,
    });
  }
  bus({ lead, width: 0.2, members, fan: 0.7 });
}
for (let i = 0; i < 9; i++) add('c0402', 71 + i * 2.25, 30.4, 90, { silk: false });
add('r0402', 67.2, 44, 90, { silk: false });
add('r0402', 67.2, 46, 90, { silk: false });

// ---- Power input: barrel jack -> buck -> LDO ---------------------------
add('barrel', 57, 8.2, 180, { ref: 'J3', silk: { x: 57, y: 17.2, rot: 0, size: 1.0 } });
add('sod123', 65.6, 5.4, 0, { ref: 'D5' });
add('soic8', 70.4, 14.2, 0, { ref: 'U9', label: ['TPS5430', 'BUCK'] });
add('ind6', 80.2, 8.6, 0, { ref: 'L1' });
add('sod123', 76.4, 17.8, 90, { ref: 'D6', silk: false });
add('elec', 89.8, 8.6, 0, { ref: 'C901' });
add('elec', 98.6, 8.6, 0, { ref: 'C902' });
add('tant', 85.6, 19.4, 0, { ref: 'C903' });
add('sot223', 95.6, 21.6, 0, { ref: 'U10', label: ['AMS1117', '3.3'] });
add('tant', 104.6, 20.2, 90, { ref: 'C904' });
add('c0603', 65.2, 11.4, 90, { silk: false });
add('c0603', 65.2, 14.4, 90, { silk: false });
add('r0603', 65.2, 17.6, 90, { silk: false });
add('r0603', 66.6, 20.6, 0, { silk: false });
wire('VIN', 1.0, new Path(pin('J3', 1)).toY('S', 17).toX('SE', 58.5).toX('E', 61.4).toX('NE', 63).toY('N', 6.6).land(pin('D5', 1), 'E'), 'power');
wire('VIN_F', 0.8, new Path(pin('D5', 2)).toX('E', 68.4).toX('SE', 70.9).toY('S', 10.1).land(pin('U9', 8), 'E'), 'power');
wire('SW', 0.8, new Path(pin('U9', 7)).toX('E', 74.4).land(pin('L1', 1), 'N'), 'power');
wire('+5V', 1.0, [pin('L1', 2), pin('C901', 1)], 'power');
wire('+5V', 1.0, new Path(pin('C901', 1)).toY('S', 13).toX('SE', 88.6).toY('S', 17.6).land(pin('U10', 1), 'E'), 'power');
wire('+3V3', 1.0, new Path(pin('U10', 4)).toX('E', 101).land({ x: 104.6, y: 21.6 }, 'E'), 'power');

// ---- Debug, reset, status LEDs -----------------------------------------
add('hdr2x5', 121, 58, 0, { ref: 'J4', silk: { x: 121, y: 54.6, rot: 0, size: 0.9 } });
texts.push({ x: 121, y: 61.6, text: 'SWD', size: 0.9, anchor: 'middle' });
wire('SWDIO', 0.2, new Path(pin('U1', 110)).toY('N', 62.5).land(pin('J4', 1), 'E'));
wire('SWCLK', 0.2, new Path(pin('U1', 109)).toY('N', 63.5).land(pin('J4', 2), 'E'));
add('btn', 119, 93, 0, { ref: 'SW1', silk: { x: 119, y: 97.2, rot: 0, size: 0.9 } });
texts.push({ x: 124.4, y: 93.4, text: 'RST', size: 0.9, anchor: 'start' });
wire('NRST', 0.2, new Path(pin('U1', 70)).toY('S', 88).land(pin('SW1', 1), 'E'));
add('c0402', 112.4, 93.4, 90, { silk: false });
add('r0402', 113.8, 93.4, 90, { silk: false });
// D1 is the heartbeat; D2 power; D3 activity.
[[100, 'D1'], [104, 'D2'], [108, 'D3']].forEach(([p, ref]) => {
  const y = pin('U1', p as number).y;
  const r = add('r0603', 118.4, y, 0, { silk: false });
  const d = add('led0603', 122.4, y, 0, { ref: ref as string, silk: { x: 125.4, y: y + 0.25, rot: 0, size: 0.62 } });
  wire(`LED_${ref}`, 0.2, [pin('U1', p as number), pin(r.ref, 1)]);
  wire(`LED_${ref}_A`, 0.2, [pin(r.ref, 2), pin(d.ref, 1)]);
});

// ---- Left field: IMU, op-amp, gate drivers -----------------------------
add('qfn16', 22, 50, 0, { ref: 'U12', label: ['ICM', '20602'] });
near('U12', 'c0402', -3.2, 0, 90, { silk: false });
near('U12', 'c0402', 3.2, 0, 90, { silk: false });
near('U12', 'c0402', 0, 3.2, 0, { silk: false });
add('soic8', 35, 52, 90, { ref: 'U13', label: ['OPA2333'] });
near('U13', 'r0603', -5, -1.2, 90, { silk: false });
near('U13', 'r0603', -5, 1.6, 90, { silk: false });
near('U13', 'c0603', 5, 0, 90, { silk: false });
add('soic8', 14, 100, 0, { ref: 'U14', label: ['UCC27211', 'GATE DRV'] });
add('soic8', 14, 110, 0, { ref: 'U15', label: ['UCC27211', 'GATE DRV'] });
near('U14', 'c0603', 5.6, -1.2, 90, { silk: false });
near('U14', 'c0603', 5.6, 1.6, 90, { silk: false });
near('U15', 'c0603', 5.6, -1.2, 90, { silk: false });
near('U15', 'c0603', 5.6, 1.6, 90, { silk: false });
add('hdr1x4', 5.4, 105, 90, { ref: 'J7', silk: { x: 5.4, y: 98.6, rot: 0, size: 0.9 } });
add('hdr1x10', 30, 144.6, 0, { ref: 'J6', silk: { x: 30, y: 141.2, rot: 0, size: 0.9 } });
add('ind4', 24, 100, 0, { ref: 'L2' });
add('tant', 25, 108, 0, { silk: false });

// ---- Bottom field: CAN, PMIC -------------------------------------------
add('soic8', 70, 128, 0, { ref: 'U16', label: ['TJA1050', 'CAN'] });
near('U16', 'c0603', 0, -4.4, 0, { silk: false });
near('U16', 'r0603', 5.4, 0, 90, { silk: false });
add('hdr1x3', 70, 144.6, 0, { ref: 'J8', silk: { x: 70, y: 141.2, rot: 0, size: 0.9 } });
add('qfn32', 128, 126, 0, { ref: 'U17', label: ['TPS65217', 'PMIC'] });
add('ind4', 136.4, 122, 0, { ref: 'L3' });
add('ind4', 136.4, 130, 0, { ref: 'L4' });
add('ind4', 128, 135.4, 0, { ref: 'L5' });
near('U17', 'c0603', -4.6, -1.4, 90, { silk: false });
near('U17', 'c0603', -4.6, 1.6, 90, { silk: false });
near('U17', 'c0603', -1.6, -4.6, 0, { silk: false });
near('U17', 'c0603', 1.6, -4.6, 0, { silk: false });
add('c0805', 141.6, 122, 90, { silk: false });
add('c0805', 141.6, 130, 90, { silk: false });
add('c0805', 133.6, 137.4, 0, { silk: false });
add('elec', 120, 141.4, 0, { ref: 'C905', silk: false });

// ---- Right field: audio codec, op-amps, CAN-side header ----------------
add('tssop20', 152, 134, 0, { ref: 'U18', label: ['TLV320', 'CODEC'] });
near('U18', 'c0603', -5.2, -1.6, 90, { silk: false });
near('U18', 'c0603', -5.2, 1.6, 90, { silk: false });
near('U18', 'c0603', 5.2, -1.6, 90, { silk: false });
near('U18', 'c0603', 5.2, 1.6, 90, { silk: false });
add('hdr1x4', 168, 144.6, 0, { ref: 'J9', silk: { x: 168, y: 141.2, rot: 0, size: 0.9 } });
add('soic8', 162, 76, 0, { ref: 'U19', label: ['OPA2333'] });
add('soic8', 174, 76, 0, { ref: 'U20', label: ['INA240', 'CSA'] });
near('U19', 'r0603', -1.5, -4.4, 0, { silk: false });
near('U19', 'r0603', 1.5, -4.4, 0, { silk: false });
near('U19', 'c0603', 0, 4.4, 0, { silk: false });
near('U20', 'r0603', -1.5, -4.4, 0, { silk: false });
near('U20', 'r0603', 1.5, -4.4, 0, { silk: false });
near('U20', 'c0603', 0, 4.4, 0, { silk: false });
add('c0805', 183, 74.6, 90, { silk: false });
add('r0603', 183, 78.4, 90, { silk: false });
add('hdr1x3', 194.4, 80, 90, { ref: 'J10', silk: { x: 190.6, y: 80, rot: 90, size: 0.9 } });
add('xtalhc49', 176, 90, 0, { ref: 'Y4' });
add('c0402', 168.4, 90, 90, { silk: false });
add('c0402', 183.6, 90, 90, { silk: false });
add('hdr1x8', 118, 5.4, 0, { ref: 'J5', silk: { x: 118, y: 8.6, rot: 0, size: 0.9 } });

// ---- Mechanical: mounting holes, fiducials, test points ----------------
add('mh', 6, 6, 0, { ref: 'MH1' });
add('mh', 194, 6, 0, { ref: 'MH2' });
add('mh', 194, 144, 0, { ref: 'MH3' });
add('mh', 6, 144, 0, { ref: 'MH4' });
add('fid', 6, 16, 0, { ref: 'FID1' });
add('fid', 184, 6, 0, { ref: 'FID2' });
add('fid', 184, 144, 0, { ref: 'FID3' });
[[112, 99], [80, 96], [126, 76.4], [66, 66], [44, 66], [134, 60], [58, 134], [146, 82]].forEach(([x, y]) => add('tp', x, y));

// ---- MCU fan-out: every unused pin escapes to a via --------------------
{
  const skip = new Set<number>();
  const range = (a: number, b: number) => { for (let i = a; i <= b; i++) skip.add(i); };
  range(6, 8); range(9, 17); range(22, 24);          // I2C1, crystal, USART1
  range(40, 44); range(55, 59);                      // I2C2 + INT, USB pair
  range(78, 84); range(70, 72);                       // RMII, NRST
  [100, 104, 108, 109, 110].forEach((p) => skip.add(p)); // LEDs, SWD
  range(112, 118); range(130, 144);                  // QSPI, SDRAM
  const rows = [1.5, 2.5, 3.5];
  for (let p = 1; p <= 144; p++) {
    if (skip.has(p)) continue;
    const a = pin('U1', p);
    const side = Math.floor((p - 1) / 36);
    const d = [{ x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }][side];
    const len = 0.75 + rows[p % 3];
    const b = { x: +(a.x + d.x * len).toFixed(3), y: +(a.y + d.y * len).toFixed(3) };
    traces.push({ net: `P${p}`, layer: 'top', width: 0.2, points: [a, b] });
    vias.push({ x: b.x, y: b.y, fromLayer: 'top', toLayer: 'bottom', pad: 0.45, drill: 0.2, net: `P${p}` });
  }
}

// ---- Silkscreen ---------------------------------------------------------
texts.push(
  { x: 14, y: 9.4, text: BOARD.name, size: 2.0, bold: true },
  { x: 14, y: 12.4, text: `${BOARD.rev}  ·  ${BOARD.year}  ·  4-LAYER FR-4`, size: 1.05 },
  { x: 14, y: 14.6, text: `${profile.name.toUpperCase()}  ·  ${profile.schoolShort}`, size: 1.05 },
  { x: 16, y: 61.6, text: 'ANT', size: 0.9 },
  { x: 86.2, y: 67.3, text: 'PB6', size: 0.5, anchor: 'end' },
  { x: 86.2, y: 78.9, text: 'PA9', size: 0.5, anchor: 'end' },
  { x: 92.0, y: 88.6, text: 'PB10', size: 0.5, anchor: 'end', rot: 90 },
  { x: 103.0, y: 88.6, text: 'PA12', size: 0.5, anchor: 'end', rot: 90 },
  { x: 113.6, y: 82.6, text: 'PB13', size: 0.5 },
  { x: 108.4, y: 61.2, text: 'PF7', size: 0.5, rot: 90 },
  { x: 62, y: 23.6, text: '7-12V DC', size: 0.9, anchor: 'middle' },
  { x: 97.4, y: 13.6, text: '+5V', size: 0.9 },
  { x: 106.6, y: 26.4, text: '+3V3', size: 0.9 },
);

// ---- Ground stitching ---------------------------------------------------
// Perimeter ring plus a sparse field wherever the pour is unobstructed.
function isFree(x: number, y: number, clear: number): boolean {
  if (x < 1.6 || y < 1.6 || x > BOARD.w - 1.6 || y > BOARD.h - 1.6) return false;
  const p = { x, y };
  for (const c of components) if (pointInRect(p, courtyard(c), clear)) return false;
  for (const z of keepouts) if (x > z.x - clear && x < z.x + z.w + clear && y > z.y - clear && y < z.y + z.h + clear) return false;
  for (const t of traces) {
    for (let i = 1; i < t.points.length; i++) {
      if (ptSegDist(p, t.points[i - 1], t.points[i]) < clear + t.width / 2) return false;
    }
  }
  for (const v of vias) if (dist(p, v) < clear + v.pad / 2) return false;
  for (const t of texts) {
    const w = t.text.length * t.size * 0.62;
    const x0 = t.anchor === 'end' ? t.x - w : t.anchor === 'middle' ? t.x - w / 2 : t.x;
    const vertical = (t.rot ?? 0) % 180 !== 0;
    const bw = vertical ? t.size : w, bh = vertical ? w : t.size;
    const bx = vertical ? t.x - t.size : x0, by = vertical ? t.y - w : t.y - t.size;
    if (x > bx - clear && x < bx + bw + clear && y > by - clear && y < by + bh + clear) return false;
  }
  for (const c of components) {
    if (c.silk && Math.abs(x - c.silk.x) < 2.2 + clear && Math.abs(y - c.silk.y) < 0.9 + clear) return false;
  }
  return true;
}
{
  const stitch = (x: number, y: number) => {
    if (isFree(x, y, 0.75)) vias.push({ x, y, fromLayer: 'top', toLayer: 'bottom', pad: 0.6, drill: 0.3, net: 'GND', stitch: true });
  };
  for (let x = 12; x <= BOARD.w - 12; x += 4) { stitch(x, 2.2); stitch(x, BOARD.h - 2.2); }
  for (let y = 12; y <= BOARD.h - 12; y += 4) { stitch(2.2, y); stitch(BOARD.w - 2.2, y); }
  for (let y = 9; y < BOARD.h - 6; y += 5.5) {
    for (let x = 9 + ((Math.round(y / 5.5) % 2) * 2.75); x < BOARD.w - 6; x += 5.5) stitch(x, y);
  }
}

export const mcu = comp('U1');
export const peripheralOf = (id: NavId): Component => comp(navBuses[id].target);
export const projectChip = (slug: string): Component | undefined =>
  components.find((c) => c.projectSlug === slug);
