import { useMemo, useState } from "react";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import type { ChipDef } from "@/data/chips";
import { buildPinPositions, PIN_WIDTH, PIN_DEPTH, PIN_FOOT_LENGTH, PIN_FOOT_HEIGHT } from "@/utils/pinLayout";
import { PCB_COLORS } from "@/utils/pcbColors";

// Tin/silver-plated leads (most commercial QFP packages), not gold --
// gold-plated leads are mostly an aerospace/high-rel thing.
const PIN_COLOR = PCB_COLORS.leadTin;
const BODY_COLOR = "#3f3f42";

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
  const pins = useMemo(() => buildPinPositions(sizeX, sizeZ), [sizeX, sizeZ]);
  const xSidePins = useMemo(() => pins.filter((p) => p.side === "+x" || p.side === "-x"), [pins]);
  const zSidePins = useMemo(() => pins.filter((p) => p.side === "+z" || p.side === "-z"), [pins]);
  // Gull-wing silhouette: a tall "knee" box spanning the body edge to the
  // foot, plus a thin flat "foot" box at the pin's anchor (the foot center,
  // which buildPinPositions already places at the board-contact point).
  const xKneePositions = useMemo(
    () =>
      xSidePins.map((p): [number, number, number] => {
        const side = p.side === "+x" ? 1 : -1;
        return [side * (sizeX / 2 + PIN_DEPTH / 2), pinHeight / 2, p.position[2]];
      }),
    [xSidePins, sizeX, pinHeight],
  );
  const zKneePositions = useMemo(
    () =>
      zSidePins.map((p): [number, number, number] => {
        const side = p.side === "+z" ? 1 : -1;
        return [p.position[0], pinHeight / 2, side * (sizeZ / 2 + PIN_DEPTH / 2)];
      }),
    [zSidePins, sizeZ, pinHeight],
  );
  const xFootPositions = useMemo(() => xSidePins.map((p) => p.position), [xSidePins]);
  const zFootPositions = useMemo(() => zSidePins.map((p) => p.position), [zSidePins]);
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

      {/* +X/-X faces: PIN_DEPTH (outward) must be on the X axis, PIN_WIDTH
          (along-edge) on Z -- the two were swapped before, which merged
          every pin on an edge into one solid overlapping bar. */}
      <Instances limit={xKneePositions.length} castShadow={false}>
        <boxGeometry args={[PIN_DEPTH, pinHeight, PIN_WIDTH]} />
        <meshStandardMaterial color={PIN_COLOR} roughness={0.22} metalness={0.85} />
        {xKneePositions.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances limit={xFootPositions.length} castShadow={false}>
        <boxGeometry args={[PIN_FOOT_LENGTH, PIN_FOOT_HEIGHT, PIN_WIDTH]} />
        <meshStandardMaterial color={PIN_COLOR} roughness={0.22} metalness={0.85} />
        {xFootPositions.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>

      {/* +Z/-Z faces: PIN_WIDTH on X, PIN_DEPTH (outward) on Z. */}
      <Instances limit={zKneePositions.length} castShadow={false}>
        <boxGeometry args={[PIN_WIDTH, pinHeight, PIN_DEPTH]} />
        <meshStandardMaterial color={PIN_COLOR} roughness={0.22} metalness={0.85} />
        {zKneePositions.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances limit={zFootPositions.length} castShadow={false}>
        <boxGeometry args={[PIN_WIDTH, PIN_FOOT_HEIGHT, PIN_FOOT_LENGTH]} />
        <meshStandardMaterial color={PIN_COLOR} roughness={0.22} metalness={0.85} />
        {zFootPositions.map((p, i) => (
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
