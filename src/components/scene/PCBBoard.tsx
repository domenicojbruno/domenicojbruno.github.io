import { useMemo } from "react";
import * as THREE from "three";
import { isFarFromChips, isFarFromTraces, mulberry32 } from "@/utils/exclusionZones";

const BOARD_WIDTH = 40;
const BOARD_DEPTH = 30;
const BOARD_THICKNESS = 0.4;
const TEXTURE_WIDTH = 2048;

interface FillerTrace {
  points: [number, number][]; // world (x, z)
}

function toPixel(x: number, z: number, canvas: HTMLCanvasElement): [number, number] {
  return [(x / BOARD_WIDTH + 0.5) * canvas.width, (z / BOARD_DEPTH + 0.5) * canvas.height];
}

// Soft-edged blobs in a slightly different green tint than the base mask --
// the "you can see where copper was removed and filled with soldermask"
// effect: copper-backed regions read as a faintly different green than
// bare-fiberglass regions under the same mask.
function drawCopperPours(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rng: () => number) {
  const patchCount = 8 + Math.floor(rng() * 6);
  for (let p = 0; p < patchCount; p++) {
    const cx = rng() * canvas.width;
    const cy = rng() * canvas.height;
    const baseR = (0.05 + rng() * 0.09) * canvas.width;
    const lighter = rng() > 0.5;
    ctx.fillStyle = lighter ? "rgba(45,150,85,0.07)" : "rgba(8,45,25,0.12)";
    const blobs = 4 + Math.floor(rng() * 3);
    for (let b = 0; b < blobs; b++) {
      const ox = (rng() - 0.5) * baseR * 1.3;
      const oy = (rng() - 0.5) * baseR * 1.3;
      const r = baseR * (0.5 + rng() * 0.6);
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Short Manhattan polylines that don't connect to anything functional --
// pure board clutter, same as a real assembly. Reuses the same
// chip/functional-trace exclusion the 3D passives use so this stays off
// the things that matter; a candidate is simply cut short (not retried)
// the moment a leg would cross into an exclusion zone or off the board.
function generateFillerTraces(rng: () => number, count: number): FillerTrace[] {
  const halfX = BOARD_WIDTH / 2 - 1.5;
  const halfZ = BOARD_DEPTH / 2 - 1.5;
  const traces: FillerTrace[] = [];

  for (let i = 0; i < count; i++) {
    let x = (rng() * 2 - 1) * halfX;
    let z = (rng() * 2 - 1) * halfZ;
    if (!isFarFromChips(x, z, 0.6) || !isFarFromTraces(x, z, 0.35)) continue;

    const points: [number, number][] = [[x, z]];
    const segments = 1 + Math.floor(rng() * 3);
    let axis: "x" | "z" = rng() > 0.5 ? "x" : "z";
    for (let s = 0; s < segments; s++) {
      const length = 0.8 + rng() * 2.4;
      const dir = rng() > 0.5 ? 1 : -1;
      const nx = axis === "x" ? x + dir * length : x;
      const nz = axis === "z" ? z + dir * length : z;
      if (Math.abs(nx) > halfX || Math.abs(nz) > halfZ) break;
      if (!isFarFromChips(nx, nz, 0.6) || !isFarFromTraces(nx, nz, 0.35)) break;
      x = nx;
      z = nz;
      points.push([x, z]);
      axis = axis === "x" ? "z" : "x";
    }
    if (points.length >= 2) traces.push({ points });
  }
  return traces;
}

function drawFillerTraces(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, traces: FillerTrace[]) {
  ctx.strokeStyle = "rgba(150,140,110,0.45)";
  ctx.lineWidth = Math.max(1, canvas.width * 0.0012);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const trace of traces) {
    ctx.beginPath();
    trace.points.forEach(([x, z], i) => {
      const [px, py] = toPixel(x, z, canvas);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
}

function drawVias(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, traces: FillerTrace[]) {
  const outerR = canvas.width * 0.0035;
  const innerR = outerR * 0.55;
  for (const trace of traces) {
    for (const [x, z] of trace.points) {
      const [px, py] = toPixel(x, z, canvas);
      ctx.beginPath();
      ctx.arc(px, py, outerR, 0, Math.PI * 2);
      ctx.fillStyle = "#8a6a2a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, innerR, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0a0a";
      ctx.fill();
    }
  }
}

// Sparse registration/fiducial marks -- a full uniform grid (the Phase 1
// look) reads as schematic, not photographic.
function drawFiducials(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rng: () => number, count: number) {
  ctx.strokeStyle = "rgba(232,232,208,0.25)";
  ctx.lineWidth = 1.5;
  const r = canvas.width * 0.006;
  const tick = canvas.width * 0.01;
  for (let i = 0; i < count; i++) {
    const px = rng() * canvas.width;
    const py = rng() * canvas.height;
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
}

const DESIGNATOR_PREFIXES = ["R", "R", "R", "C", "C", "C", "U", "MH", "TP"];

function drawDesignators(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rng: () => number, count: number) {
  ctx.fillStyle = "rgba(232,232,208,0.55)";
  ctx.font = `${Math.round(canvas.width * 0.0085)}px 'JetBrains Mono', 'Share Tech Mono', ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 8) {
    attempts++;
    const x = (rng() * 2 - 1) * (BOARD_WIDTH / 2 - 2);
    const z = (rng() * 2 - 1) * (BOARD_DEPTH / 2 - 2);
    if (!isFarFromChips(x, z, 0.8) || !isFarFromTraces(x, z, 0.4)) continue;
    const [px, py] = toPixel(x, z, canvas);
    const prefix = DESIGNATOR_PREFIXES[Math.floor(rng() * DESIGNATOR_PREFIXES.length)];
    const num = 1 + Math.floor(rng() * 220);
    ctx.fillText(`${prefix}${num}`, px, py);
    placed++;
  }
}

function createBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = Math.round((TEXTURE_WIDTH * BOARD_DEPTH) / BOARD_WIDTH);
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(2024);

  ctx.fillStyle = "#1a6b3c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Faint procedural fiberglass noise.
  for (let i = 0; i < 16000; i++) {
    const x = rng() * canvas.width;
    const y = rng() * canvas.height;
    const a = rng() * 0.04;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  drawCopperPours(ctx, canvas, rng);

  const fillerTraces = generateFillerTraces(rng, 180);
  drawFillerTraces(ctx, canvas, fillerTraces);
  drawVias(ctx, canvas, fillerTraces);

  drawFiducials(ctx, canvas, rng, 8);
  drawDesignators(ctx, canvas, rng, 35);

  // Vignette toward the edges, standing in for baked ambient occlusion --
  // drawn last so the inspection-light falloff covers the new detail too.
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.25,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.65,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(15,74,40,0.55)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        <meshStandardMaterial map={texture} roughness={0.35} metalness={0.1} />
      </mesh>
    </group>
  );
}

export { BOARD_WIDTH, BOARD_DEPTH, BOARD_THICKNESS };
