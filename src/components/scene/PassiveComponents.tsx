import { useMemo } from "react";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { BOARD_LAYOUT } from "@/data/boardLayout";

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

export default function PassiveComponents() {
  const { resistors, capacitors } = useMemo(() => {
    return {
      resistors: BOARD_LAYOUT.components.filter((c) => c.type === "resistor"),
      capacitors: BOARD_LAYOUT.components.filter((c) => c.type === "capacitor"),
    };
  }, []);

  const resistorSkin = useMemo(() => createSmdSkin("#262420", "#cfd0d2", 0.22), []);
  const capacitorSkin = useMemo(() => createSmdSkin("#1c1f24", "#cfd0d2", 0.3), []);

  return (
    <group>
      <Instances limit={resistors.length} castShadow={false}>
        <boxGeometry args={[0.45, 0.12, 0.22]} />
        <meshStandardMaterial map={resistorSkin} roughness={0.45} metalness={0.3} />
        {resistors.map((comp, i) => (
          <Instance key={i} position={[comp.center[0], 0.06, comp.center[1]]} rotation={[0, comp.angle, 0]} />
        ))}
      </Instances>

      <Instances limit={capacitors.length} castShadow={false}>
        <boxGeometry args={[0.3, 0.16, 0.24]} />
        <meshStandardMaterial map={capacitorSkin} roughness={0.4} metalness={0.3} />
        {capacitors.map((comp, i) => (
          <Instance key={i} position={[comp.center[0], 0.08, comp.center[1]]} rotation={[0, comp.angle, 0]} />
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
