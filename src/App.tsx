import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import Scene from "@/Scene";
import Compass from "@/components/ui/Compass";
import ChipPanel from "@/components/ui/ChipPanel";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { OVERVIEW_CAMERA } from "@/data/chips";

export default function App() {
  useKeyboardNav();

  return (
    <div className="relative w-full h-full">
      <Canvas
        dpr={[1, 2]}
        shadows={false}
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: OVERVIEW_CAMERA.offset, fov: 45 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <Compass />
      <ChipPanel />
    </div>
  );
}
