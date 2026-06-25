// Single source of truth for the board's FR4/ENIG/LPI material palette --
// shared by PCBBoard.tsx (canvas texture), Chip.tsx (lead material), and
// useElectricity.ts (idle/pulse uniform defaults). GLSL can't import this,
// so electricity.frag.glsl receives these as uniform values rather than
// hardcoding them.
export const PCB_COLORS = {
  maskBase: "#2d6a3f", // open board area / perimeter margin (no copper beneath)
  maskOverPour: "#357a47", // copper pour / ground plane under mask -- the dominant fill
  maskOverTrace: "#3d8050", // signal trace under mask -- slightly lighter/warmer, narrow
  isolationChannel: "#1a3d26", // etched copper gap -- darkest green on the board
  padGold: "#c8941a", // ENIG finish, exposed pad/via copper
  padBorder: "#a07010",
  drillHole: "#0d1f13",
  leadTin: "#9a9a8a", // IC leads -- tin-plated, not gold
  silkscreen: "#b8b8a0", // muted/slightly yellowed -- not bright white
  pulseCore: "#ffe066",
  pulseTip: "#ffffff",
} as const;
