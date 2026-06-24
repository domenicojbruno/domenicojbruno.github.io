import { useMemo, useState } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import type { ChipDef } from "@/data/chips";

const PIN_COLOR = "#b8860b";
const BODY_COLOR = "#1a1a1a";

interface Pin {
  position: [number, number, number];
  size: [number, number, number];
}

function buildPins(sizeX: number, sizeY: number, sizeZ: number): Pin[] {
  const pinCount = sizeZ > 2.5 ? 5 : 4;
  const pinWidth = 0.15;
  const pinHeight = sizeY * 0.5;
  const pinDepth = 0.4;
  const spacing = sizeZ / (pinCount + 1);
  const pins: Pin[] = [];
  for (const side of [1, -1] as const) {
    for (let i = 1; i <= pinCount; i++) {
      const z = -sizeZ / 2 + spacing * i;
      pins.push({
        position: [side * (sizeX / 2 + pinWidth / 2), pinHeight / 2, z],
        size: [pinWidth, pinHeight, pinDepth],
      });
    }
  }
  return pins;
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
  const pins = useMemo(() => buildPins(sizeX, sizeY, sizeZ), [sizeX, sizeY, sizeZ]);
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
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {pins.map((pin, i) => (
        <mesh key={i} position={pin.position}>
          <boxGeometry args={pin.size} />
          <meshStandardMaterial color={PIN_COLOR} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, sizeY + 0.01, 0]}>
        <planeGeometry args={[sizeX * 0.85, sizeZ * 0.85]} />
        <meshBasicMaterial map={activeTexture} transparent />
      </mesh>
    </group>
  );
}
