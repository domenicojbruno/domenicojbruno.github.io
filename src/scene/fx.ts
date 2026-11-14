// Per-frame shared state for the 3D scene. The camera rig writes it; the trace
// shader, pulse particles, board and post-processing read it. Kept outside
// React so 60 fps updates never trigger a render.

import * as THREE from 'three';
import { NAV } from '../board/nets';
import type { NavId } from '../board/types';
import type { RidePlan } from '../board/routes';

export const NET_INDEX = Object.fromEntries(NAV.map((n, i) => [n.id, i])) as Record<NavId, number>;
export const NET_COUNT = NAV.length;

export const fx = {
  level: new Float32Array(NET_COUNT),          // 0 = idle copper, 1 = lit in the net colour
  head: new Float32Array(NET_COUNT).fill(-1),  // pulse head, mm from the MCU pin (-1 = none)
  dir: new Float32Array(NET_COUNT).fill(1),    // +1 pulse travels away from the MCU
  dim: 1,                                      // board brightness (others dim while a net is lit)
  speed: 0,                                    // 0..1, drives FOV / streaks / aberration
  under: 0,                                    // 1 when the camera is inside the board
  pulse: new THREE.Vector3(),                  // world position of the pulse head
  pulseOn: 0,
  color: new THREE.Color('#ffffff'),
  plan: null as RidePlan | null,
  planId: 0,
  power: { id: null as NavId | null, t0: -100 }, // arrival "power on" of a peripheral
  reset: { t0: -100 },                           // SW1 pressed: brown-out, then the board reboots
  time: 0,
};
