import { OrbitControls } from "@react-three/drei";
import PCBBoard from "@/components/scene/PCBBoard";
import SceneLights from "@/components/scene/SceneLights";
import Chip from "@/components/scene/Chip";
import Trace from "@/components/scene/Trace";
import PassiveComponents from "@/components/scene/PassiveComponents";
import { CHIPS, TRACES, TRACE_GEOMETRY } from "@/data/chips";
import { useStore } from "@/store/useStore";
import { useElectricity } from "@/hooks/useElectricity";
import { useCamera } from "@/hooks/useCamera";
import { useBootSequence } from "@/hooks/useBootSequence";

export default function Scene() {
  const activeTraceId = useStore((s) => s.activeTraceId);
  const electricity = useElectricity();
  const { controlsRef, autoRotate, handleControlsStart, handleControlsEnd } =
    useCamera(electricity);
  const { texture: bootTexture, bootComplete } = useBootSequence();

  return (
    <>
      <PCBBoard />
      <SceneLights />
      {CHIPS.map((chip) => (
        <Chip
          key={chip.id}
          chipDef={chip}
          silkscreenTexture={chip.id === "cpu" && !bootComplete ? bootTexture : undefined}
        />
      ))}
      {TRACES.map((trace) => (
        <Trace
          key={trace.id}
          traceDef={trace}
          geometryData={TRACE_GEOMETRY[trace.id]}
          uniforms={trace.id === activeTraceId ? electricity.uniforms : undefined}
        />
      ))}
      <PassiveComponents />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        onStart={handleControlsStart}
        onEnd={handleControlsEnd}
      />
    </>
  );
}
