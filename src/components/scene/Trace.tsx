import { useMemo } from "react";
import * as THREE from "three";
import type { TraceDef, TraceGeometryData } from "@/data/chips";
import { createElectricityUniforms, type ElectricityUniforms } from "@/hooks/useElectricity";
import { PCB_COLORS } from "@/utils/pcbColors";
import vertexShader from "@/shaders/electricity.vert.glsl?raw";
import fragmentShader from "@/shaders/electricity.frag.glsl?raw";

const VIA_COLOR = PCB_COLORS.padGold;

interface TraceProps {
  traceDef: TraceDef;
  geometryData: TraceGeometryData;
  /** Lifted uniforms from the root-level useElectricity(); omit for an
   * always-idle trace (e.g. before the electricity system is wired up). */
  uniforms?: ElectricityUniforms;
}

export default function Trace({ traceDef, geometryData, uniforms }: TraceProps) {
  // Stable idle fallback so this never recreates the material on re-render.
  const idleUniforms = useMemo(() => createElectricityUniforms(), []);
  const activeUniforms = uniforms ?? idleUniforms;

  const tubeGeometry = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (const seg of geometryData.segments) {
      path.add(new THREE.LineCurve3(seg.start, seg.end));
    }
    const tubularSegments = Math.max(8, Math.round(geometryData.totalLength * 6));
    return new THREE.TubeGeometry(path, tubularSegments, traceDef.radius, 6, false);
  }, [geometryData, traceDef.radius]);

  const viaPoints = traceDef.waypoints.slice(1, -1);

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={activeUniforms}
        />
      </mesh>
      {viaPoints.map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[traceDef.radius * 1.7, traceDef.radius * 1.7, traceDef.radius * 1.2, 12]} />
          <meshStandardMaterial color={VIA_COLOR} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
