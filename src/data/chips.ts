import * as THREE from "three";

export type ChipId = "cpu" | "projects" | "experience" | "contact" | "about";
export type Direction = "N" | "E" | "S" | "W";

export interface CameraFraming {
  offset: [number, number, number];
  lookAtOffset: [number, number, number];
}

export interface ChipDef {
  id: ChipId;
  direction: Direction | null;
  label: string;
  position: [number, number, number];
  size: [number, number, number];
  cameraFraming: CameraFraming;
}

export interface TraceDef {
  id: string;
  chipId: ChipId;
  waypoints: [number, number, number][];
  radius: number;
}

const TRACE_Y = 0.05;
const CPU_HEIGHT = 0.6;
const SATELLITE_HEIGHT = 0.4;

export const CHIPS: ChipDef[] = [
  {
    id: "cpu",
    direction: null,
    label: "CPU",
    position: [0, 0, 0],
    size: [3, CPU_HEIGHT, 3],
    cameraFraming: {
      offset: [0, 8, 6],
      lookAtOffset: [0, 0, 0],
    },
  },
  {
    id: "projects",
    direction: "N",
    label: "U1 / PROJECTS",
    position: [3, 0, -10],
    size: [1.5, SATELLITE_HEIGHT, 2],
    cameraFraming: {
      offset: [0, 6.5, 6],
      lookAtOffset: [0, 0, 0],
    },
  },
  {
    id: "experience",
    direction: "E",
    label: "U2 / EXPERIENCE",
    position: [10, 0, 3],
    size: [1.5, SATELLITE_HEIGHT, 2],
    cameraFraming: {
      offset: [0, 6.5, 6],
      lookAtOffset: [0, 0, 0],
    },
  },
  {
    id: "contact",
    direction: "S",
    label: "U3 / CONTACT",
    position: [-3, 0, 10],
    size: [1.5, SATELLITE_HEIGHT, 2],
    cameraFraming: {
      offset: [0, 6.5, 6],
      lookAtOffset: [0, 0, 0],
    },
  },
  {
    id: "about",
    direction: "W",
    label: "U4 / ABOUT",
    position: [-10, 0, -3],
    size: [1.5, SATELLITE_HEIGHT, 2],
    cameraFraming: {
      offset: [0, 6.5, 6],
      lookAtOffset: [0, 0, 0],
    },
  },
];

export const OVERVIEW_CAMERA: CameraFraming = {
  offset: [0, 22, 0.01],
  lookAtOffset: [0, 0, 0],
};

export function getChip(id: ChipId): ChipDef {
  const chip = CHIPS.find((c) => c.id === id);
  if (!chip) throw new Error(`Unknown chip id: ${id}`);
  return chip;
}

export function chipIdForDirection(dir: Direction): ChipId {
  const chip = CHIPS.find((c) => c.direction === dir);
  if (!chip) throw new Error(`No chip registered for direction: ${dir}`);
  return chip.id;
}

// Single-bend (L-shaped) Manhattan traces, CPU pad -> bend/via -> chip pad.
// Pinwheel layout: each satellite is offset off its cardinal axis so the
// bend is real geometry, not a degenerate straight line.
export const TRACES: TraceDef[] = [
  {
    id: "cpu-projects",
    chipId: "projects",
    waypoints: [
      [0, TRACE_Y, -1.5],
      [0, TRACE_Y, -10],
      [2.25, TRACE_Y, -10],
    ],
    radius: 0.15,
  },
  {
    id: "cpu-experience",
    chipId: "experience",
    waypoints: [
      [1.5, TRACE_Y, 0],
      [10, TRACE_Y, 0],
      [10, TRACE_Y, 2],
    ],
    radius: 0.15,
  },
  {
    id: "cpu-contact",
    chipId: "contact",
    waypoints: [
      [0, TRACE_Y, 1.5],
      [0, TRACE_Y, 10],
      [-2.25, TRACE_Y, 10],
    ],
    radius: 0.15,
  },
  {
    id: "cpu-about",
    chipId: "about",
    waypoints: [
      [-1.5, TRACE_Y, 0],
      [-10, TRACE_Y, 0],
      [-10, TRACE_Y, -2],
    ],
    radius: 0.15,
  },
];

export interface TraceSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  length: number;
}

export interface TraceGeometryData {
  segments: TraceSegment[];
  cumulativeLengths: number[];
  totalLength: number;
}

export function buildTraceGeometryData(
  waypoints: [number, number, number][],
): TraceGeometryData {
  const segments: TraceSegment[] = [];
  const cumulativeLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = new THREE.Vector3(...waypoints[i]);
    const end = new THREE.Vector3(...waypoints[i + 1]);
    const length = start.distanceTo(end);
    segments.push({ start, end, length });
    total += length;
    cumulativeLengths.push(total);
  }
  return { segments, cumulativeLengths, totalLength: total };
}

// Single source of truth shared by Trace.tsx (geometry), the electricity
// shader (UV/progress mapping), and useCamera.ts (per-leg tween durations).
export const TRACE_GEOMETRY: Record<string, TraceGeometryData> = Object.fromEntries(
  TRACES.map((t) => [t.id, buildTraceGeometryData(t.waypoints)]),
);

export function traceIdForChip(chipId: ChipId): string {
  const trace = TRACES.find((t) => t.chipId === chipId);
  if (!trace) throw new Error(`No trace registered for chip: ${chipId}`);
  return trace.id;
}
