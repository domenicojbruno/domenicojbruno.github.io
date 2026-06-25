import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { getChip } from "@/data/chips";

export default function SceneLights() {
  const currentChip = useStore((s) => s.currentChip);
  const transitioning = useStore((s) => s.transitioning);
  const activeLightRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const light = activeLightRef.current;
    if (!light) return;
    const chip = getChip(currentChip);
    light.position.set(chip.position[0], chip.position[1] + 1.5, chip.position[2]);
    const targetIntensity = transitioning ? 0 : 0.3;
    light.intensity = THREE.MathUtils.damp(light.intensity, targetIntensity, 4, delta);
  });

  return (
    <>
      <ambientLight color="#9fb8d9" intensity={0.35} />
      <directionalLight
        color="#fff3d6"
        intensity={1.4}
        position={[-18, 22, -12]}
        castShadow={false}
      />
      <pointLight
        ref={activeLightRef}
        color="#ffd27a"
        intensity={0}
        distance={5}
        decay={2.4}
        castShadow={false}
      />
    </>
  );
}
