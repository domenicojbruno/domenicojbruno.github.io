import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { CHIPS, TRACES } from "@/data/chips";

const RESISTOR_COUNT = 26;
const CAPACITOR_COUNT = 18;
const PLACEMENT_HALF_X = 18;
const PLACEMENT_HALF_Z = 13;
const CHIP_MARGIN = 1.2;
const TRACE_MARGIN = 0.6;

function mulberry32(seed: number) {
  let s = seed;
  return function rng(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function farFromChips(x: number, z: number): boolean {
  return CHIPS.every((chip) => {
    const [cx, , cz] = chip.position;
    const [sx, , sz] = chip.size;
    const halfX = sx / 2 + CHIP_MARGIN;
    const halfZ = sz / 2 + CHIP_MARGIN;
    return Math.abs(x - cx) > halfX || Math.abs(z - cz) > halfZ;
  });
}

function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq)) : 0;
  const cx = ax + t * abx;
  const cz = az + t * abz;
  return Math.hypot(px - cx, pz - cz);
}

function farFromTraces(x: number, z: number): boolean {
  return TRACES.every((trace) => {
    const wps = trace.waypoints;
    for (let i = 0; i < wps.length - 1; i++) {
      const [ax, , az] = wps[i];
      const [bx, , bz] = wps[i + 1];
      if (distToSegment(x, z, ax, az, bx, bz) < TRACE_MARGIN) return false;
    }
    return true;
  });
}

function scatterPositions(rng: () => number, count: number): [number, number, number][] {
  const positions: [number, number, number][] = [];
  let attempts = 0;
  while (positions.length < count && attempts < 3000) {
    attempts++;
    const x = (rng() * 2 - 1) * PLACEMENT_HALF_X;
    const z = (rng() * 2 - 1) * PLACEMENT_HALF_Z;
    if (farFromChips(x, z) && farFromTraces(x, z)) {
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

  return (
    <group>
      <Instances limit={RESISTOR_COUNT} castShadow={false}>
        <cylinderGeometry args={[0.12, 0.12, 0.45, 10]} />
        <meshStandardMaterial color="#c9a66b" roughness={0.6} metalness={0.1} />
        {resistorPositions.map((pos, i) => (
          <Instance
            key={i}
            position={[pos[0], 0.13, pos[2]]}
            rotation={[0, rngForRotation() * Math.PI * 2, Math.PI / 2]}
          />
        ))}
      </Instances>

      <Instances limit={CAPACITOR_COUNT} castShadow={false}>
        <boxGeometry args={[0.3, 0.35, 0.3]} />
        <meshStandardMaterial color="#1f3a52" roughness={0.45} metalness={0.2} />
        {capacitorPositions.map((pos, i) => (
          <Instance
            key={i}
            position={[pos[0], 0.175, pos[2]]}
            rotation={[0, rngForRotation() * Math.PI * 2, 0]}
          />
        ))}
      </Instances>

      <mesh position={[-2.2, 0.25, 2.2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.25} metalness={0.9} />
      </mesh>
    </group>
  );
}
