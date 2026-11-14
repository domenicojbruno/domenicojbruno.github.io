// The WebGL scene. Loaded lazily: this chunk (and three.js) is never fetched
// on mobile or when WebGL is unavailable.

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FOV } from '../board/view';
import { useStore } from '../state/store';
import { loadBoardTexture } from './textures';
import { Board } from './Board';
import { Traces } from './Traces';
import { CurrentPulse } from './CurrentPulse';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';

function Loader({ onReady }: { onReady: (t: THREE.Texture) => void }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    let dead = false;
    const set = useStore.getState().set;
    set({ boot: 0.45 });
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    set({ boot: 0.6 });
    loadBoardTexture(gl.capabilities.maxTextureSize, gl.capabilities.getMaxAnisotropy())
      .then((tex) => {
        if (dead) return;
        set({ boot: 0.92 });
        onReady(tex);
        invalidate();
        // two frames later the board is on screen
        requestAnimationFrame(() => requestAnimationFrame(() => { if (!dead) set({ boot: 1, sceneReady: true }); }));
      })
      .catch(() => { if (!dead) set({ mode: '2d' }); });
    return () => { dead = true; pmrem.dispose(); };
  }, [gl, scene, invalidate, onReady]);
  return null;
}

export default function Scene() {
  const quality = useStore((s) => s.quality);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  return (
    <Canvas
      frameloop="demand"
      dpr={quality === 'high' ? [1, 1.75] : 1}
      gl={{ antialias: quality !== 'high', powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: FOV, near: 20, far: 1000, position: [0, 160, 14] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.domElement.addEventListener('webglcontextlost', () => useStore.getState().set({ mode: '2d' }));
      }}
    >
      <Loader onReady={setTex} />
      <ambientLight intensity={0.34} />
      <hemisphereLight args={['#dfe8ff', '#0b1a10', 0.42]} />
      <directionalLight position={[-70, 130, 60]} intensity={1.9} />
      <directionalLight position={[90, 70, -60]} intensity={0.55} color="#bcd0ff" />
      {tex && (
        <>
          <Board texture={tex} />
          <Traces />
          <CurrentPulse />
          <CameraRig />
          {quality === 'high' && <Effects />}
        </>
      )}
    </Canvas>
  );
}
