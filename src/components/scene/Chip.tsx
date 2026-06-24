import { useMemo, useState } from "react";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import type { ChipDef } from "@/data/chips";

// Tin/silver-plated leads (most commercial QFP packages), not gold --
// gold-plated leads are mostly an aerospace/high-rel thing.
const PIN_COLOR = "#b8b8ae";
const BODY_COLOR = "#3f3f42";
const PIN_WIDTH = 0.05;
const PIN_DEPTH = 0.4;
const PIN_PITCH = 0.2;

function buildPinPositions(sizeX: number, sizeZ: number, pinHeight: number) {
  const countZ = Math.max(4, Math.floor(sizeZ / PIN_PITCH));
  const countX = Math.max(4, Math.floor(sizeX / PIN_PITCH));
  const spacingZ = sizeZ / (countZ + 1);
  const spacingX = sizeX / (countX + 1);

  // Pins on the ±X faces (box oriented [PIN_WIDTH, h, PIN_DEPTH]).
  const xSidePins: [number, number, number][] = [];
  for (const side of [1, -1] as const) {
    for (let i = 1; i <= countZ; i++) {
      const z = -sizeZ / 2 + spacingZ * i;
      xSidePins.push([side * (sizeX / 2 + PIN_WIDTH / 2), pinHeight / 2, z]);
    }
  }

  // Pins on the ±Z faces (box oriented [PIN_DEPTH, h, PIN_WIDTH]).
  const zSidePins: [number, number, number][] = [];
  for (const side of [1, -1] as const) {
    for (let i = 1; i <= countX; i++) {
      const x = -sizeX / 2 + spacingX * i;
      zSidePins.push([x, pinHeight / 2, side * (sizeZ / 2 + PIN_WIDTH / 2)]);
    }
  }

  return { xSidePins, zSidePins };
}

// Drawn locally on a <canvas> rather than via drei's <Text> (troika-three-text),
// which lazily fetches its default font from a CDN at render time -- an
// unnecessary network dependency for plain silkscreen labels, and one that
// blanks the whole Suspense-wrapped scene until it resolves.
function createLabelTexture(text: string, aspect: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.round(512 / aspect);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e8e8d0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontFamily = "'JetBrains Mono', 'Share Tech Mono', ui-monospace, monospace";
  let fontSize = Math.round(canvas.height * 0.22);
  const maxWidth = canvas.width * 0.86;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    fontSize = Math.floor(fontSize * (maxWidth / measured));
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface ChipProps {
  chipDef: ChipDef;
  silkscreenTexture?: THREE.Texture;
}

export default function Chip({ chipDef, silkscreenTexture }: ChipProps) {
  const [hovered, setHovered] = useState(false);
  const currentChip = useStore((s) => s.currentChip);
  const transitioning = useStore((s) => s.transitioning);
  const navigateTo = useStore((s) => s.navigateTo);

  const isCpu = chipDef.id === "cpu";
  const [sizeX, sizeY, sizeZ] = chipDef.size;
  const pinHeight = sizeY * 0.45;
  const { xSidePins, zSidePins } = useMemo(
    () => buildPinPositions(sizeX, sizeZ, pinHeight),
    [sizeX, sizeZ, pinHeight],
  );
  const labelTexture = useMemo(
    () => createLabelTexture(chipDef.label, sizeX / sizeZ),
    [chipDef.label, sizeX, sizeZ],
  );
  const activeTexture = silkscreenTexture ?? labelTexture;

  const handleClick = () => {
    if (isCpu || currentChip !== "cpu" || transitioning) return;
    navigateTo(chipDef.id);
  };

  return (
    <group position={chipDef.position}>
      <mesh
        position={[0, sizeY / 2, 0]}
        onClick={handleClick}
        onPointerOver={(e) => {
          if (isCpu) return;
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[sizeX, sizeY, sizeZ]} />
        <meshStandardMaterial
          color={BODY_COLOR}
          emissive={hovered ? "#3a2a00" : "#000000"}
          roughness={0.55}
          metalness={0.15}
        />
      </mesh>

      {/* Pin-1 indicator dot, like real IC packages. */}
      <mesh position={[sizeX / 2 - 0.22, sizeY + 0.002, -sizeZ / 2 + 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.06, 12]} />
        <meshStandardMaterial color="#9a9a92" roughness={0.6} />
      </mesh>

      <Instances limit={xSidePins.length} castShadow={false}>
        <boxGeometry args={[PIN_WIDTH, pinHeight, PIN_DEPTH]} />
        <meshStandardMaterial color={PIN_COLOR} roughness={0.35} metalness={0.7} />
        {xSidePins.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances limit={zSidePins.length} castShadow={false}>
        <boxGeometry args={[PIN_DEPTH, pinHeight, PIN_WIDTH]} />
        <meshStandardMaterial color={PIN_COLOR} roughness={0.35} metalness={0.7} />
        {zSidePins.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, sizeY + 0.01, 0]}>
        <planeGeometry args={[sizeX * 0.85, sizeZ * 0.85]} />
        <meshBasicMaterial map={activeTexture} transparent />
      </mesh>
    </group>
  );
}
