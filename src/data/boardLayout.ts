import { CHIPS, type ChipDef } from "@/data/chips";
import { buildPinPositions, PIN_WIDTH, PIN_FOOT_LENGTH } from "@/utils/pinLayout";
import { distanceToSegment, isFarFromChips, isFarFromTraces, mulberry32 } from "@/utils/exclusionZones";

// Mirrors PCBBoard.tsx's BOARD_WIDTH/BOARD_DEPTH. Not imported directly to
// avoid a circular import (PCBBoard.tsx reads BOARD_LAYOUT from this file).
const BOARD_WIDTH = 42;
const BOARD_DEPTH = 40;
const PLACEMENT_HALF_X = BOARD_WIDTH / 2 - 1.5;
const PLACEMENT_HALF_Z = BOARD_DEPTH / 2 - 1.5;

const OTHER_CHIP_MARGIN = 0.8;
const FREE_CHIP_MARGIN = 1.0;
const TRACE_MARGIN = 0.4;
// DRC-equivalent minimum clearance between two unrelated traces' isolation
// channels -- keeps generated traces from running alongside or crossing
// each other with no gap, matching PCBBoard.tsx's ISOLATION_WIDTH_PX pass.
const MIN_TRACE_SPACING = 0.12;

const RESISTOR_LENGTH = 0.45;
const CAPACITOR_LENGTH = 0.3;
const ENTRY_STUB_MIN = 0.4;
const ENTRY_STUB_MAX = 1.2;
const EXIT_STUB_MIN = 0.4;
const EXIT_STUB_MAX = 1.2;

export interface PinPad {
  x: number;
  z: number;
  sizeX: number;
  sizeZ: number;
}

export interface ComponentPlacement {
  type: "resistor" | "capacitor";
  designator: string;
  center: [number, number];
  angle: number;
  padA: [number, number];
  padB: [number, number];
}

export interface DecorativeTrace {
  points: [number, number][];
}

export interface TestPoint {
  x: number;
  z: number;
  label: string;
}

export interface BoardLayout {
  pinPads: PinPad[];
  components: ComponentPlacement[];
  traces: DecorativeTrace[];
  vias: [number, number][];
  testPoints: TestPoint[];
}

type Segment = [number, number, number, number];

// Outward-facing unit normal for the side of the chip a pin sits on.
function normalForSide(side: "+x" | "-x" | "+z" | "-z"): [number, number] {
  switch (side) {
    case "+x":
      return [1, 0];
    case "-x":
      return [-1, 0];
    case "+z":
      return [0, 1];
    case "-z":
      return [0, -1];
  }
}

function pinPadsForChip(chip: ChipDef): PinPad[] {
  const [sizeX, , sizeZ] = chip.size;
  const [cx, , cz] = chip.position;
  const pins = buildPinPositions(sizeX, sizeZ);
  return pins.map((pin) => {
    // Pad matches the foot's footprint, not the whole knee+foot lead length.
    const onXFace = pin.side === "+x" || pin.side === "-x";
    return {
      x: cx + pin.position[0],
      z: cz + pin.position[2],
      sizeX: onXFace ? PIN_FOOT_LENGTH * 1.15 : PIN_WIDTH * 1.6,
      sizeZ: onXFace ? PIN_WIDTH * 1.6 : PIN_FOOT_LENGTH * 1.15,
    };
  });
}

interface PinAnchor {
  chipId: string;
  world: [number, number];
  normal: [number, number];
}

function isFarFromOtherChips(x: number, z: number, margin: number, excludeId: string): boolean {
  return CHIPS.every((chip) => {
    if (chip.id === excludeId) return true;
    const [cx, , cz] = chip.position;
    const [sx, , sz] = chip.size;
    return Math.abs(x - cx) > sx / 2 + margin || Math.abs(z - cz) > sz / 2 + margin;
  });
}

function isFarFromPlacedSegments(x: number, z: number, margin: number, placed: Segment[]): boolean {
  return placed.every(([ax, az, bx, bz]) => distanceToSegment(x, z, ax, az, bx, bz) >= margin);
}

function randomPinAnchor(rng: () => number): PinAnchor {
  const chip = CHIPS[Math.floor(rng() * CHIPS.length)];
  const [sizeX, , sizeZ] = chip.size;
  const pins = buildPinPositions(sizeX, sizeZ);
  const pin = pins[Math.floor(rng() * pins.length)];
  const [cx, , cz] = chip.position;
  return {
    chipId: chip.id,
    world: [cx + pin.position[0], cz + pin.position[2]],
    normal: normalForSide(pin.side),
  };
}

function randomFreeAnchor(rng: () => number): { world: [number, number]; normal: [number, number] } {
  const x = (rng() * 2 - 1) * PLACEMENT_HALF_X;
  const z = (rng() * 2 - 1) * PLACEMENT_HALF_Z;
  const normals: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  return { world: [x, z], normal: normals[Math.floor(rng() * normals.length)] };
}

function withinBoard(x: number, z: number): boolean {
  return Math.abs(x) <= PLACEMENT_HALF_X && Math.abs(z) <= PLACEMENT_HALF_Z;
}

// True if every functional-trace/other-chip/already-placed-trace check
// passes for a point; the anchor chip itself (if any) is excluded so a
// pin-anchored point can sit right at the edge of its own chip.
function pointIsClear(
  x: number,
  z: number,
  excludeChipId: string | null,
  placed: Segment[],
): boolean {
  if (!withinBoard(x, z)) return false;
  const chipOk = excludeChipId
    ? isFarFromOtherChips(x, z, OTHER_CHIP_MARGIN, excludeChipId)
    : isFarFromChips(x, z, FREE_CHIP_MARGIN);
  return (
    chipOk &&
    isFarFromTraces(x, z, TRACE_MARGIN) &&
    isFarFromPlacedSegments(x, z, MIN_TRACE_SPACING, placed)
  );
}

function angleForDirection(nx: number, nz: number): number {
  return Math.atan2(-nz, nx);
}

function generateComponents(
  rng: () => number,
  placed: Segment[],
): { components: ComponentPlacement[]; traces: DecorativeTrace[]; vias: [number, number][] } {
  const components: ComponentPlacement[] = [];
  const traces: DecorativeTrace[] = [];
  const vias: [number, number][] = [];
  let resistorIndex = 1;
  let capacitorIndex = 1;

  const ATTEMPTS = 130;
  for (let i = 0; i < ATTEMPTS; i++) {
    const pinAnchored = rng() < 0.65;
    const anchor = pinAnchored ? randomPinAnchor(rng) : randomFreeAnchor(rng);
    const excludeChipId = pinAnchored ? (anchor as PinAnchor).chipId : null;
    const [nx, nz] = anchor.normal;
    const [ax, az] = anchor.world;

    const length = rng() < 0.59 ? RESISTOR_LENGTH : CAPACITOR_LENGTH;
    const type: ComponentPlacement["type"] = length === RESISTOR_LENGTH ? "resistor" : "capacitor";

    let entryStub: [number, number][] | null = null;
    let padA: [number, number];
    if (pinAnchored) {
      const stubLen = ENTRY_STUB_MIN + rng() * (ENTRY_STUB_MAX - ENTRY_STUB_MIN);
      padA = [ax + nx * stubLen, az + nz * stubLen];
      entryStub = [[ax, az], padA];
    } else {
      padA = [ax, az];
    }

    const padB: [number, number] = [padA[0] + nx * length, padA[1] + nz * length];

    if (
      !pointIsClear(padA[0], padA[1], excludeChipId, placed) ||
      !pointIsClear(padB[0], padB[1], excludeChipId, placed)
    ) {
      continue;
    }
    if (entryStub && !pointIsClear(entryStub[0][0], entryStub[0][1], excludeChipId, placed)) continue;

    let exitVia: [number, number] | null = null;
    if (rng() < 0.5) {
      const stubLen = EXIT_STUB_MIN + rng() * (EXIT_STUB_MAX - EXIT_STUB_MIN);
      const candidate: [number, number] = [padB[0] + nx * stubLen, padB[1] + nz * stubLen];
      if (pointIsClear(candidate[0], candidate[1], excludeChipId, placed)) exitVia = candidate;
    }

    const center: [number, number] = [(padA[0] + padB[0]) / 2, (padA[1] + padB[1]) / 2];
    const angle = angleForDirection(nx, nz);
    const designator = type === "resistor" ? `R${resistorIndex++}` : `C${capacitorIndex++}`;

    components.push({ type, designator, center, angle, padA, padB });
    placed.push([padA[0], padA[1], padB[0], padB[1]]);
    if (entryStub) {
      traces.push({ points: entryStub });
      placed.push([entryStub[0][0], entryStub[0][1], entryStub[1][0], entryStub[1][1]]);
    }
    if (exitVia) {
      traces.push({ points: [padB, exitVia] });
      placed.push([padB[0], padB[1], exitVia[0], exitVia[1]]);
      vias.push(exitVia);
    }
  }

  return { components, traces, vias };
}

function generateFanOutTraces(
  rng: () => number,
  count: number,
  placed: Segment[],
): { traces: DecorativeTrace[]; vias: [number, number][]; testPoints: TestPoint[] } {
  const traces: DecorativeTrace[] = [];
  const vias: [number, number][] = [];
  const testPoints: TestPoint[] = [];
  let tpIndex = 1;

  for (let i = 0; i < count; i++) {
    const anchor = randomPinAnchor(rng);
    const [nx, nz] = anchor.normal;
    const [ax, az] = anchor.world;

    const leg1Len = 0.4 + rng() * 1.1;
    const p1: [number, number] = [ax + nx * leg1Len, az + nz * leg1Len];
    if (!pointIsClear(p1[0], p1[1], anchor.chipId, placed)) continue;

    const points: [number, number][] = [[ax, az], p1];
    let last = p1;

    if (rng() < 0.5) {
      // Perpendicular second leg for a Manhattan dogleg.
      const perp: [number, number] = nx !== 0 ? [0, rng() < 0.5 ? 1 : -1] : [rng() < 0.5 ? 1 : -1, 0];
      const leg2Len = 0.3 + rng() * 0.9;
      const p2: [number, number] = [last[0] + perp[0] * leg2Len, last[1] + perp[1] * leg2Len];
      if (pointIsClear(p2[0], p2[1], anchor.chipId, placed)) {
        points.push(p2);
        last = p2;
      }
    }

    traces.push({ points });
    vias.push(last);
    for (let s = 0; s < points.length - 1; s++) {
      placed.push([points[s][0], points[s][1], points[s + 1][0], points[s + 1][1]]);
    }
    if (rng() < 0.4) {
      testPoints.push({ x: last[0], z: last[1], label: `TP${tpIndex++}` });
    }
  }

  return { traces, vias, testPoints };
}

function generateBoardLayout(): BoardLayout {
  const rng = mulberry32(4242);
  const placed: Segment[] = [];

  const pinPads = CHIPS.flatMap(pinPadsForChip);
  const { components, traces: componentTraces, vias: componentVias } = generateComponents(rng, placed);
  const {
    traces: fanOutTraces,
    vias: fanOutVias,
    testPoints,
  } = generateFanOutTraces(rng, 32, placed);

  return {
    pinPads,
    components,
    traces: [...componentTraces, ...fanOutTraces],
    vias: [...componentVias, ...fanOutVias],
    testPoints,
  };
}

export const BOARD_LAYOUT: BoardLayout = generateBoardLayout();
