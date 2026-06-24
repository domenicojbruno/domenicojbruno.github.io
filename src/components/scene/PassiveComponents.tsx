import { useMemo } from "react";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { isFarFromChips, isFarFromTraces, mulberry32 } from "@/utils/exclusionZones";

const RESISTOR_COUNT = 40;
const CAPACITOR_COUNT = 28;
const PLACEMENT_HALF_X = 18;
const PLACEMENT_HALF_Z = 13;
const CHIP_MARGIN = 1.0;
const TRACE_MARGIN = 0.5;

// Real SMD passives at this scale read as a dark ceramic body with two
// metallic end-caps -- baked as a small left-cap/body/right-cap strip and
// applied via `map`. BoxGeometry gives every face its own independent 0-1
// UV square, so this paints the same band pattern on top (the dominant
// visible face) and a compressed (but still plausible) version on the sides.
function createSmdSkin(bodyColor: string, capColor: string, capFraction: number): THREE.CanvasTexture {
  const width = 128;
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const capWidth = width * capFraction;

  ctx.fillStyle = bodyColor;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = capColor;
  ctx.fillRect(0, 0, capWidth, height);
  ctx.fillRect(width - capWidth, 0, capWidth, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function scatterPositions(rng: () => number, count: number): [number, number, number][] {
  const positions: [number, number, number][] = [];
  let attempts = 0;
  while (positions.length < count && attempts < 3000) {
    attempts++;
    const x = (rng() * 2 - 1) * PLACEMENT_HALF_X;
    const z = (rng() * 2 - 1) * PLACEMENT_HALF_Z;
    if (isFarFromChips(x, z, CHIP_MARGIN) && isFarFromTraces(x, z, TRACE_MARGIN)) {
      positions.push([x, 0, z]);
    }
  }
  return positions;
}

export default function PassiveComponents() {
  const { resistorPositions, capacitorPositions } = useMemo(() => {
    const rng = mulberry32(1337);
    return {
      resistorPositions: scatterPositions(rng, RESISTOR_COUNT),
      capacitorPositions: scatterPositions(rng, CAPACITOR_COUNT),
    };
  }, []);

  const rngForRotation = useMemo(() => mulberry32(7331), []);
  const resistorSkin = useMemo(() => createSmdSkin("#262420", "#cfd0d2", 0.22), []);
  const capacitorSkin = useMemo(() => createSmdSkin("#1c1f24", "#cfd0d2", 0.3), []);

  return (
    <group>
      <Instances limit={RESISTOR_COUNT} castShadow={false}>
        <boxGeometry args={[0.45, 0.12, 0.22]} />
        <meshStandardMaterial map={resistorSkin} roughness={0.45} metalness={0.3} />
        {resistorPositions.map((pos, i) => (
          <Instance key={i} position={[pos[0], 0.06, pos[2]]} rotation={[0, rngForRotation() * Math.PI * 2, 0]} />
        ))}
      </Instances>

      <Instances limit={CAPACITOR_COUNT} castShadow={false}>
        <boxGeometry args={[0.3, 0.16, 0.24]} />
        <meshStandardMaterial map={capacitorSkin} roughness={0.4} metalness={0.3} />
        {capacitorPositions.map((pos, i) => (
          <Instance key={i} position={[pos[0], 0.08, pos[2]]} rotation={[0, rngForRotation() * Math.PI * 2, 0]} />
        ))}
      </Instances>

      {/* Crystal oscillator: real ones are small rectangular metal cans, not cylinders. */}
      <mesh position={[-2.2, 0.2, 2.2]}>
        <boxGeometry args={[0.7, 0.4, 0.5]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.25} metalness={0.9} />
      </mesh>
    </group>
  );
}
