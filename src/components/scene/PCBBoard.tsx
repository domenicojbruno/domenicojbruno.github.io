import { useMemo } from "react";
import * as THREE from "three";

const BOARD_WIDTH = 40;
const BOARD_DEPTH = 30;
const BOARD_THICKNESS = 0.4;

function createBoardTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = (size * BOARD_DEPTH) / BOARD_WIDTH;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1a6b3c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Faint procedural fiberglass noise.
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const a = Math.random() * 0.04;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Silkscreen registration grid.
  ctx.strokeStyle = "rgba(232, 232, 208, 0.18)";
  ctx.lineWidth = 1;
  const gridStep = canvas.width / 20;
  for (let x = 0; x <= canvas.width; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Vignette toward the edges, standing in for baked ambient occlusion.
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
