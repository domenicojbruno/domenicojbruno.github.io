import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { BOARD_LAYOUT, type ComponentPlacement } from "@/data/boardLayout";

const BODY_COLOR = "#3a3530";
const CAP_COLOR = "#9a9a8a";

const RESISTOR_BODY: [number, number, number] = [0.28, 0.1, 0.16];
const RESISTOR_CAP: [number, number, number] = [0.06, 0.11, 0.17];
const RESISTOR_CAP_OFFSET = 0.14; // body half-length -- caps sit flush at the ends

const CAPACITOR_BODY: [number, number, number] = [0.32, 0.14, 0.2];
const CAPACITOR_CAP: [number, number, number] = [0.07, 0.15, 0.21];
const CAPACITOR_CAP_OFFSET = 0.16;

// Same rotation convention as PCBBoard.tsx's silkscreen outlines: rotates a
// local (length-axis, width-axis) offset by the component's rotation.y angle.
function rotateLocal(lx: number, lz: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [lx * c + lz * s, -lx * s + lz * c];
}

function capPositions(
  components: ComponentPlacement[],
  offset: number,
  y: number,
): { a: [number, number, number][]; b: [number, number, number][] } {
  const a: [number, number, number][] = [];
  const b: [number, number, number][] = [];
  for (const comp of components) {
    const [ox, oz] = rotateLocal(-offset, 0, comp.angle);
    const [bx, bz] = rotateLocal(offset, 0, comp.angle);
    a.push([comp.center[0] + ox, y, comp.center[1] + oz]);
    b.push([comp.center[0] + bx, y, comp.center[1] + bz]);
  }
  return { a, b };
}

export default function PassiveComponents() {
  const { resistors, capacitors } = useMemo(() => {
    return {
      resistors: BOARD_LAYOUT.components.filter((c) => c.type === "resistor"),
      capacitors: BOARD_LAYOUT.components.filter((c) => c.type === "capacitor"),
    };
  }, []);

  const resistorY = RESISTOR_BODY[1] / 2;
  const capacitorY = CAPACITOR_BODY[1] / 2;
  const resistorCaps = useMemo(
    () => capPositions(resistors, RESISTOR_CAP_OFFSET, resistorY),
    [resistors, resistorY],
  );
  const capacitorCaps = useMemo(
    () => capPositions(capacitors, CAPACITOR_CAP_OFFSET, capacitorY),
    [capacitors, capacitorY],
  );

  return (
    <group>
      {/* Resistors -- uniform matte ceramic body, two metallic end caps. No
          stripes, no texture, no markings at this scale. */}
      <Instances limit={resistors.length} castShadow={false}>
        <boxGeometry args={RESISTOR_BODY} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.82} metalness={0} />
        {resistors.map((comp, i) => (
          <Instance key={i} position={[comp.center[0], resistorY, comp.center[1]]} rotation={[0, comp.angle, 0]} />
        ))}
      </Instances>
      <Instances limit={resistorCaps.a.length * 2} castShadow={false}>
        <boxGeometry args={RESISTOR_CAP} />
        <meshStandardMaterial color={CAP_COLOR} roughness={0.28} metalness={0.75} />
        {resistorCaps.a.map((p, i) => (
          <Instance key={`a${i}`} position={p} rotation={[0, resistors[i].angle, 0]} />
        ))}
        {resistorCaps.b.map((p, i) => (
          <Instance key={`b${i}`} position={p} rotation={[0, resistors[i].angle, 0]} />
        ))}
      </Instances>

      {/* Capacitors -- same body+cap treatment, larger. */}
      <Instances limit={capacitors.length} castShadow={false}>
        <boxGeometry args={CAPACITOR_BODY} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.82} metalness={0} />
        {capacitors.map((comp, i) => (
          <Instance key={i} position={[comp.center[0], capacitorY, comp.center[1]]} rotation={[0, comp.angle, 0]} />
        ))}
      </Instances>
      <Instances limit={capacitorCaps.a.length * 2} castShadow={false}>
        <boxGeometry args={CAPACITOR_CAP} />
        <meshStandardMaterial color={CAP_COLOR} roughness={0.28} metalness={0.75} />
        {capacitorCaps.a.map((p, i) => (
          <Instance key={`a${i}`} position={p} rotation={[0, capacitors[i].angle, 0]} />
        ))}
        {capacitorCaps.b.map((p, i) => (
          <Instance key={`b${i}`} position={p} rotation={[0, capacitors[i].angle, 0]} />
        ))}
      </Instances>

      {/* Crystal oscillator: real ones are small rectangular metal cans, not cylinders. */}
      <mesh position={[-2.2, 0.2, 2.2]}>
        <boxGeometry args={[0.7, 0.4, 0.5]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.25} metalness={0.9} />
      </mesh>
    </group>
  );
}
