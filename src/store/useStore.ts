import { create } from "zustand";
import type { ChipId, Direction } from "@/data/chips";
import { chipIdForDirection, traceIdForChip } from "@/data/chips";

interface AppState {
  currentChip: ChipId;
  transitioning: boolean;
  navLocked: boolean;
  muted: boolean;
  panelOpen: boolean;
  reducedMotion: boolean;
  /** Monotonic counter bumped on every nav request, even no-ops/repeats. */
  navRequestId: number;
  /** true when the in-flight/most recent nav is satellite -> CPU. */
  navReverse: boolean;
  /**
   * Which trace owns the live electricity uniforms for the in-flight/most
   * recent nav. Tracked separately from currentChip because currentChip
   * flips to the destination immediately on nav request, but a reverse
   * (satellite -> cpu) trip still needs to know which trace it's flying.
   */
  activeTraceId: string | null;
  /** Flips true once the CPU boot sequence finishes and the compass unlocks. */
  bootComplete: boolean;

  navigateTo: (chip: ChipId) => void;
  navigateByDirection: (dir: Direction) => void;
  returnToHub: () => void;
  closePanel: () => void;
  setTransitioning: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setBootComplete: (v: boolean) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const useStore = create<AppState>((set, get) => ({
  currentChip: "cpu",
  transitioning: false,
  navLocked: true,
  muted: true,
  panelOpen: false,
  reducedMotion: prefersReducedMotion(),
  navRequestId: 0,
  navReverse: false,
  activeTraceId: null,
  bootComplete: false,

  navigateTo: (chip) => {
    const { currentChip, navLocked } = get();
    if (navLocked || chip === currentChip) return;
    const reverse = chip === "cpu";
    const nonCpuChip = reverse ? currentChip : chip;
    set((s) => ({
      currentChip: chip,
      transitioning: true,
      navLocked: true,
      panelOpen: chip !== "cpu",
      navReverse: reverse,
      activeTraceId: traceIdForChip(nonCpuChip),
      navRequestId: s.navRequestId + 1,
    }));
  },

  navigateByDirection: (dir) => {
    const { currentChip, navLocked } = get();
    if (navLocked || currentChip !== "cpu") return;
    const chip = chipIdForDirection(dir);
    set((s) => ({
      currentChip: chip,
      transitioning: true,
      navLocked: true,
      panelOpen: true,
      navReverse: false,
      activeTraceId: traceIdForChip(chip),
      navRequestId: s.navRequestId + 1,
    }));
  },

  returnToHub: () => {
    get().navigateTo("cpu");
  },

  closePanel: () => set({ panelOpen: false }),

  setTransitioning: (v) => set({ transitioning: v, navLocked: v }),

  setReducedMotion: (v) => set({ reducedMotion: v }),

  setBootComplete: (v) => set({ bootComplete: v, navLocked: v ? false : get().navLocked }),
}));
