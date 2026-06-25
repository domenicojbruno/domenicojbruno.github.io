import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/utils/exclusionZones";
import { BOARD_LAYOUT } from "@/data/boardLayout";
import { TRACES } from "@/data/chips";
import { PCB_COLORS } from "@/utils/pcbColors";

const BOARD_WIDTH = 42;
const BOARD_DEPTH = 40;
const BOARD_THICKNESS = 0.4;
const TEXTURE_WIDTH = 4096;
const MARGIN_PX = TEXTURE_WIDTH * 0.025;

// One width for every trace on the board, canvas/decorative and 3D/navigable
// alike -- the click-triggered electricity pulse is the only thing that's
// ever allowed to make a path look different from any other. The isolation
// channel is a thin accent border, not a dominant groove -- 1px each side.
const TRACE_WIDTH_PX = 4;
const ISOLATION_WIDTH_PX = 1;

function toPixel(x: number, z: number, canvas: HTMLCanvasElement): [number, number] {
  return [(x / BOARD_WIDTH + 0.5) * canvas.width, (z / BOARD_DEPTH + 0.5) * canvas.height];
}

// Local-space point (length axis = local +X) rotated by a component's
// rotation.y angle -- same convention PassiveComponents.tsx uses for the 3D
// boxes, so the silkscreen outline lines up with the real component.
function rotateLocal(lx: number, lz: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [lx * c + lz * s, -lx * s + lz * c];
}

function drawBoardBase(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  // Perimeter margin (soldermask with no copper beneath) -- fill everything
  // in that color first, then lay the dominant copper-pour ground plane on
  // top, inset by the margin so only the border strip shows through.
  ctx.fillStyle = PCB_COLORS.maskBase;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = PCB_COLORS.maskOverPour;
  ctx.fillRect(MARGIN_PX, MARGIN_PX, canvas.width - MARGIN_PX * 2, canvas.height - MARGIN_PX * 2);
}

function drawFiberglassGrain(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rng: () => number) {
  for (let i = 0; i < 64000; i++) {
    const x = rng() * canvas.width;
    const y = rng() * canvas.height;
    const a = rng() * 0.04;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

// Every trace on the board -- every BOARD_LAYOUT.traces polyline, plus the
// 4 functional CPU<->satellite paths -- gets the identical static channel
// art baked in here. The 3D tube riding on top of the functional ones only
// ever adds the idle/pulse color, never a different width or border.
function allTracePolylines(): [number, number][][] {
  const decorative = BOARD_LAYOUT.traces.map((t) => t.points);
  const functional = TRACES.map((t) => t.waypoints.map(([x, , z]) => [x, z] as [number, number]));
  return [...decorative, ...functional];
}

function drawIsolationChannels(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  polylines: [number, number][][],
) {
  ctx.strokeStyle = PCB_COLORS.isolationChannel;
  ctx.lineWidth = TRACE_WIDTH_PX + ISOLATION_WIDTH_PX * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const points of polylines) {
    ctx.beginPath();
    points.forEach(([x, z], i) => {
      const [px, py] = toPixel(x, z, canvas);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
}

function drawTraceBodies(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  polylines: [number, number][][],
) {
  ctx.strokeStyle = PCB_COLORS.maskOverTrace;
  ctx.lineWidth = TRACE_WIDTH_PX;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const points of polylines) {
    ctx.beginPath();
    points.forEach(([x, z], i) => {
      const [px, py] = toPixel(x, z, canvas);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
}

function drawPinPads(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const scaleX = canvas.width / BOARD_WIDTH;
  const scaleZ = canvas.height / BOARD_DEPTH;
  for (const pad of BOARD_LAYOUT.pinPads) {
    const [px, py] = toPixel(pad.x, pad.z, canvas);
    const w = pad.sizeX * scaleX;
    const h = pad.sizeZ * scaleZ;
    ctx.fillStyle = PCB_COLORS.padGold;
    ctx.fillRect(px - w / 2, py - h / 2, w, h);
    ctx.strokeStyle = PCB_COLORS.padBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(px - w / 2, py - h / 2, w, h);
  }
}

function drawComponentPads(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const padSize = canvas.width * 0.0042;
  for (const comp of BOARD_LAYOUT.components) {
    for (const [x, z] of [comp.padA, comp.padB]) {
      const [px, py] = toPixel(x, z, canvas);
      ctx.fillStyle = PCB_COLORS.padGold;
      ctx.fillRect(px - padSize / 2, py - padSize / 2, padSize, padSize);
      ctx.strokeStyle = PCB_COLORS.padBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(px - padSize / 2, py - padSize / 2, padSize, padSize);
    }
  }
}

// Accent-scale, not a focal point -- absolute canvas pixels at this file's
// TEXTURE_WIDTH, not resolution-relative.
const VIA_OUTER_R_PX = 5;
const VIA_INNER_R_PX = 2;

function drawVias(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const outerR = VIA_OUTER_R_PX;
  const innerR = VIA_INNER_R_PX;
  for (const [x, z] of BOARD_LAYOUT.vias) {
    const [px, py] = toPixel(x, z, canvas);
    ctx.beginPath();
    ctx.arc(px, py, outerR, 0, Math.PI * 2);
    ctx.fillStyle = PCB_COLORS.padGold;
    ctx.fill();
    ctx.strokeStyle = PCB_COLORS.padBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, innerR, 0, Math.PI * 2);
    ctx.fillStyle = PCB_COLORS.drillHole;
    ctx.fill();
  }
}

// Component footprints, designators, polarity ticks, test points, and a
// sparse set of fiducials -- all tied to BOARD_LAYOUT's real geometry
// (nothing here is placed independently of an actual component/via), and
// drawn last so the silkscreen sits visibly on top of every other layer.
function drawSilkscreen(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  // Silkscreen ink isn't fully opaque, and shouldn't compete with the board
  // at a glance -- present, but secondary.
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = PCB_COLORS.silkscreen;
  ctx.fillStyle = PCB_COLORS.silkscreen;
  ctx.font = "13px 'JetBrains Mono', 'Share Tech Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const comp of BOARD_LAYOUT.components) {
    const [ax, az] = comp.padA;
    const [bx, bz] = comp.padB;
    const padSpan = Math.hypot(bx - ax, bz - az);
    const halfLength = padSpan / 2 + 0.04;
    const halfWidth = (comp.type === "resistor" ? 0.11 : 0.12);

    const corners: [number, number][] = [
      [halfLength, halfWidth],
      [halfLength, -halfWidth],
      [-halfLength, -halfWidth],
      [-halfLength, halfWidth],
    ].map(([lx, lz]) => {
      const [ox, oz] = rotateLocal(lx, lz, comp.angle);
      return toPixel(comp.center[0] + ox, comp.center[1] + oz, canvas);
    });

    ctx.lineWidth = 0.8;
    ctx.beginPath();
    corners.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();

    if (comp.type === "capacitor") {
      // Polarity tick at the padA end, just inside the outline.
      const [tx1, tz1] = rotateLocal(halfLength - 0.05, halfWidth, comp.angle);
      const [tx2, tz2] = rotateLocal(halfLength - 0.05, -halfWidth, comp.angle);
      const [px1, py1] = toPixel(comp.center[0] + tx1, comp.center[1] + tz1, canvas);
      const [px2, py2] = toPixel(comp.center[0] + tx2, comp.center[1] + tz2, canvas);
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
    }

    const [lx, lz] = rotateLocal(0, halfWidth + 0.18, comp.angle);
    const [lpx, lpy] = toPixel(comp.center[0] + lx, comp.center[1] + lz, canvas);
    ctx.fillText(comp.designator, lpx, lpy);
  }

  for (const tp of BOARD_LAYOUT.testPoints) {
    const [px, py] = toPixel(tp.x, tp.z, canvas);
    ctx.fillText(tp.label, px, py - canvas.width * 0.012);
  }

  // Exactly 3 fiducials near 3 of the 4 corners -- intentionally asymmetric,
  // the way real pick-and-place registration marks are placed.
  const inset = 2.2;
  const fiducialSpots: [number, number][] = [
    [-(BOARD_WIDTH / 2 - inset), -(BOARD_DEPTH / 2 - inset)],
    [BOARD_WIDTH / 2 - inset, -(BOARD_DEPTH / 2 - inset)],
    [-(BOARD_WIDTH / 2 - inset), BOARD_DEPTH / 2 - inset],
  ];
  const r = canvas.width * 0.006;
  const tick = canvas.width * 0.01;
  ctx.lineWidth = 1.0;
  for (const [x, z] of fiducialSpots) {
    const [px, py] = toPixel(x, z, canvas);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - tick, py);
    ctx.lineTo(px + tick, py);
    ctx.moveTo(px, py - tick);
    ctx.lineTo(px, py + tick);
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;
}

function createBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = Math.round((TEXTURE_WIDTH * BOARD_DEPTH) / BOARD_WIDTH);
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(2024);

  drawBoardBase(ctx, canvas);
  drawFiberglassGrain(ctx, canvas, rng);

  const polylines = allTracePolylines();
  drawIsolationChannels(ctx, canvas, polylines);
  drawTraceBodies(ctx, canvas, polylines);

  drawPinPads(ctx, canvas);
  drawComponentPads(ctx, canvas);
  drawVias(ctx, canvas);

  drawSilkscreen(ctx, canvas);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export default function PCBBoard() {
  const texture = useMemo(() => createBoardTexture(), []);

  return (
    <group>
      {/* Sits slightly below y=0 so its top face never z-fights the green plane above it. */}
      <mesh position={[0, -BOARD_THICKNESS / 2 - 0.02, 0]} receiveShadow={false}>
        <boxGeometry args={[BOARD_WIDTH, BOARD_THICKNESS, BOARD_DEPTH]} />
        <meshStandardMaterial color="#b87333" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[BOARD_WIDTH - 0.3, BOARD_DEPTH - 0.3]} />
        {/* No `color` tint here -- the canvas texture already carries every
            trace/pad/silkscreen color; a tinted `color` would multiply
            against the map and muddy the gold pads. Only roughness/metalness
            convey the LPI mask's overall sheen. */}
        <meshStandardMaterial map={texture} roughness={0.72} metalness={0} />
      </mesh>
    </group>
  );
}

export { BOARD_WIDTH, BOARD_DEPTH, BOARD_THICKNESS };
