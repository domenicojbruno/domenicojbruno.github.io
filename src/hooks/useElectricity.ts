import { useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

export interface ElectricityUniforms {
  uProgress: THREE.IUniform<number>;
  uDirection: THREE.IUniform<number>;
  uPulseWidth: THREE.IUniform<number>;
  uTailLength: THREE.IUniform<number>;
  uResidualGlow: THREE.IUniform<number>;
  uColorGold: THREE.IUniform<THREE.Color>;
  uColorPulse: THREE.IUniform<THREE.Color>;
  uColorTip: THREE.IUniform<THREE.Color>;
  // Index signature so this satisfies R3F's shaderMaterial `uniforms` prop type.
  [uniform: string]: THREE.IUniform<unknown>;
}

/** Sentinel that, combined with the idle uDirection, always evaluates to a
 * deeply-negative distBehindHead in the shader, collapsing it to flat matte
 * gold without needing a separate idle material. */
const IDLE_PROGRESS = -1;

export function createElectricityUniforms(): ElectricityUniforms {
  return {
    uProgress: { value: IDLE_PROGRESS },
    uDirection: { value: 1 },
    uPulseWidth: { value: 0.04 },
    uTailLength: { value: 0.25 },
    uResidualGlow: { value: 0.35 },
    uColorGold: { value: new THREE.Color("#d4a017") },
    uColorPulse: { value: new THREE.Color("#ffe066") },
    uColorTip: { value: new THREE.Color("#ffffff") },
  };
}

interface UseElectricityResult {
  uniforms: ElectricityUniforms;
  /** Starts the pulse tween; resolves once the pulse (not the camera) finishes. */
  triggerPulse: (reverse: boolean, duration?: number) => gsap.core.Tween;
  resetPulse: () => void;
}

/**
 * Owns uProgress as a plain mutable object, mutated directly by GSAP every
 * tick. Must be lifted to a single root-level instance and threaded down to
 * every Trace via props -- never called per-Trace, or each satellite would
 * get an independent, uncoordinated pulse state.
 */
export function useElectricity(): UseElectricityResult {
  const uniformsRef = useRef<ElectricityUniforms>(createElectricityUniforms());

  const resetPulse = () => {
    uniformsRef.current.uProgress.value = IDLE_PROGRESS;
    uniformsRef.current.uDirection.value = 1;
  };

  const triggerPulse = (reverse: boolean, duration = 1.0) => {
    const uniforms = uniformsRef.current;
    uniforms.uDirection.value = reverse ? -1 : 1;
    uniforms.uProgress.value = reverse ? 1 : 0;
    return gsap.to(uniforms.uProgress, {
      value: reverse ? 0 : 1,
      duration,
      ease: "power1.in",
    });
  };

  return { uniforms: uniformsRef.current, triggerPulse, resetPulse };
}
