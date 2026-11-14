import { create } from 'zustand';
import type { NavId, PageId } from '../board/types';
import { pageFromPath } from '../board/nets';

export interface Ride {
  id: number;
  from: PageId;
  to: PageId;
  /** URL to push on arrival; undefined when the browser already moved (back/forward). */
  push?: string;
}

function detectMode(): '3d' | '2d' {
  if (typeof window === 'undefined') return '2d';
  const q = new URLSearchParams(window.location.search);
  if (q.has('flat')) return '2d';
  if (window.innerWidth < 768) return '2d';
  try {
    const c = document.createElement('canvas');
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) return '2d';
  } catch { return '2d'; }
  return '3d';
}

const stored = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

interface State {
  page: PageId;                    // settled page: what the panel shows
  phase: 'idle' | 'ride';
  ride: Ride | null;
  lastRide: Ride | null;
  arrivals: number;                // bumps on every arrival
  direct: boolean;                 // current page was reached without a ride
  hover: NavId | null;
  hoverProject: string | null;
  mode: '3d' | '2d';
  sceneReady: boolean;
  boot: number;                    // 0..1 loading progress of the 3D scene
  executor: boolean;               // something is mounted that can play rides
  reducedMotion: boolean;
  muted: boolean;
  quality: 'high' | 'low';
  resets: number;                  // SW1 presses
  reset: () => void;
  setHover: (h: NavId | null) => void;
  setHoverProject: (s: string | null) => void;
  startRide: (to: PageId, push?: string) => boolean;
  finishRide: () => void;
  jump: (to: PageId) => void;
  set: (p: Partial<State>) => void;
  toggleMute: () => void;
}

let rideId = 0;

export const useStore = create<State>((set, get) => ({
  page: typeof window === 'undefined' ? 'home' : pageFromPath(window.location.pathname).page,
  phase: 'idle',
  ride: null,
  lastRide: null,
  arrivals: 0,
  direct: true,
  hover: null,
  hoverProject: null,
  mode: detectMode(),
  sceneReady: false,
  boot: 0,
  executor: false,
  reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  muted: stored('pcb-sound') !== 'on',
  quality: 'high',
  resets: 0,
  reset: () => { const s = get(); if (s.phase === 'idle' && s.page === 'home') set({ resets: s.resets + 1 }); },
  setHover: (hover) => { if (get().hover !== hover) set({ hover }); },
  setHoverProject: (hoverProject) => { if (get().hoverProject !== hoverProject) set({ hoverProject }); },
  startRide: (to, push) => {
    const s = get();
    if (s.phase === 'ride' || s.page === to) return false;
    if (!s.executor) { get().jump(to); return false; }
    set({ phase: 'ride', ride: { id: ++rideId, from: s.page, to, push }, hover: null, hoverProject: null });
    return true;
  },
  finishRide: () => {
    const r = get().ride;
    if (!r) return;
    set({ phase: 'idle', page: r.to, ride: null, lastRide: r, arrivals: get().arrivals + 1, direct: false });
  },
  jump: (to) => set({ page: to, phase: 'idle', ride: null, direct: true, hover: null }),
  set: (p) => set(p),
  toggleMute: () => {
    const muted = !get().muted;
    try { localStorage.setItem('pcb-sound', muted ? 'off' : 'on'); } catch { /* private mode */ }
    set({ muted });
  },
}));

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    useStore.setState({ reducedMotion: e.matches });
  });
}
