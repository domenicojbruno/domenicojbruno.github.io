// Shared between Chip.tsx (3D pin meshes) and data/boardLayout.ts (the
// matching solder pads drawn into the board texture) so the two never
// drift apart.

export const PIN_WIDTH = 0.05; // along the chip edge (pin-pitch direction) -- thin
export const PIN_DEPTH = 0.45; // outward reach from the body to the board -- long
export const PIN_PITCH = 0.13;
export const PIN_FOOT_LENGTH = 0.1;
export const PIN_FOOT_HEIGHT = 0.03;

export interface PinPosition {
  /** Local-space position relative to the chip's own origin -- the foot's
   * contact point with the board, i.e. the pad anchor. */
  position: [number, number, number];
  /** Which side of the chip body this pin sits on. */
  side: "+x" | "-x" | "+z" | "-z";
}

export function buildPinPositions(sizeX: number, sizeZ: number): PinPosition[] {
  const countZ = Math.max(4, Math.floor(sizeZ / PIN_PITCH));
  const countX = Math.max(4, Math.floor(sizeX / PIN_PITCH));
  const spacingZ = sizeZ / (countZ + 1);
  const spacingX = sizeX / (countX + 1);

  const pins: PinPosition[] = [];

  // Pins on the ±X faces -- PIN_DEPTH is the outward (X) reach, PIN_WIDTH the
  // along-edge (Z) thickness, so the box must be [PIN_DEPTH, h, PIN_WIDTH].
  for (const side of [1, -1] as const) {
    for (let i = 1; i <= countZ; i++) {
      const z = -sizeZ / 2 + spacingZ * i;
      pins.push({
        position: [side * (sizeX / 2 + PIN_DEPTH), PIN_FOOT_HEIGHT / 2, z],
        side: side === 1 ? "+x" : "-x",
      });
    }
  }

  // Pins on the ±Z faces -- PIN_DEPTH is the outward (Z) reach, PIN_WIDTH the
  // along-edge (X) thickness, so the box must be [PIN_WIDTH, h, PIN_DEPTH].
  for (const side of [1, -1] as const) {
    for (let i = 1; i <= countX; i++) {
      const x = -sizeX / 2 + spacingX * i;
      pins.push({
        position: [x, PIN_FOOT_HEIGHT / 2, side * (sizeZ / 2 + PIN_DEPTH)],
        side: side === 1 ? "+z" : "-z",
      });
    }
  }

  return pins;
}
