import { CHIPS, TRACES } from "@/data/chips";

// Shared by PCBBoard's decorative texture content (filler traces, vias,
// silkscreen designators) and PassiveComponents' 3D placement -- both need
// to keep clutter off the functional chips/traces, just at different
// margins.

export function distanceToSegment(
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

export function isFarFromChips(x: number, z: number, margin: number): boolean {
  return CHIPS.every((chip) => {
    const [cx, , cz] = chip.position;
    const [sx, , sz] = chip.size;
    const halfX = sx / 2 + margin;
    const halfZ = sz / 2 + margin;
    return Math.abs(x - cx) > halfX || Math.abs(z - cz) > halfZ;
  });
}

export function isFarFromTraces(x: number, z: number, margin: number): boolean {
  return TRACES.every((trace) => {
    const wps = trace.waypoints;
    for (let i = 0; i < wps.length - 1; i++) {
      const [ax, , az] = wps[i];
      const [bx, , bz] = wps[i + 1];
      if (distanceToSegment(x, z, ax, az, bx, bz) < margin) return false;
    }
    return true;
  });
}

export function mulberry32(seed: number) {
  let s = seed;
  return function rng(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
