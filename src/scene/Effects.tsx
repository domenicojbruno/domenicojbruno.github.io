// Post-processing: bloom on HDR emissive elements only (threshold 1.0, so lit
// traces, the pulse and LEDs glow while the board does not), a speed-driven
// radial chromatic smear, vignette, then tone mapping.

import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { fx } from './fx';

export function Effects() {
  const offset = useMemo(() => new THREE.Vector2(0.0004, 0.0004), []);
  useFrame(() => {
    const k = 0.0004 + fx.speed * fx.speed * 0.0042;
    offset.set(k, k);
  });
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.15} intensity={0.85} radius={0.72} />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.3} />
      <Vignette offset={0.26} darkness={0.74} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
