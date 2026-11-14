// The physical board: laminate, soldermask texture, inner planes, via
// barrels, and every component as instanced primitives built from footprints.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BOARD, components, vias, navBuses, comp } from '../board/layout';
import { footprint, toBoard } from '../board/footprints';
import { NAV } from '../board/nets';
import { OX, OZ, GND_Y, PWR_Y } from '../board/routes';
import type { Component, NavId } from '../board/types';
import { markingTexture, planeTexture } from './textures';
import { fx } from './fx';
import { useStore } from '../state/store';

const tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();
const Y = new THREE.Vector3(0, 1, 0);

interface Inst { m: THREE.Matrix4; c: THREE.Color; ref: string }

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  mesh.count = list.length;
  list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

function buildParts() {
  const g: Record<'boxD' | 'boxM' | 'cylD' | 'cylM' | 'led', Inst[]> = { boxD: [], boxM: [], cylD: [], cylM: [], led: [] };
  for (const c of components) {
    tmpQ.setFromAxisAngle(Y, (-c.rotation * Math.PI) / 180);
    for (const p of footprint(c.type).parts) {
      const b = toBoard(c, p.x, p.y);
      tmpP.set(b.x - OX, p.z + p.sz / 2, b.y - OZ);
      tmpS.set(p.sx, p.sz, p.sy);
      const inst: Inst = { m: new THREE.Matrix4().compose(tmpP, tmpQ, tmpS), c: new THREE.Color(p.color), ref: c.ref };
      const metal = p.mat === 'metal' || p.mat === 'gold';
      if (p.mat === 'led') g.led.push(inst);
      else g[`${p.shape === 'box' ? 'box' : 'cyl'}${metal ? 'M' : 'D'}`].push(inst);
    }
  }
  return g;
}

export function Board({ texture }: { texture: THREE.Texture }) {
  const invalidate = useThree((s) => s.invalidate);

  const built = useMemo(() => {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    const dielectric = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.04 });
    const metal = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.92, envMapIntensity: 1.1 });
    const ledMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const parts = buildParts();
    const meshes = [
      instanced(boxGeo, dielectric, parts.boxD), instanced(boxGeo, metal, parts.boxM),
      instanced(cylGeo, dielectric, parts.cylD), instanced(cylGeo, metal, parts.cylM),
    ];
    const led = instanced(boxGeo, ledMat, parts.led);
    const ledIndex = (ref: string) => parts.led.findIndex((i) => i.ref === ref);
    // SW1 plunger: animated when the reset button is pressed
    const plungerIndex = parts.cylD.findIndex((i) => i.ref === 'SW1');
    const plunger = { mesh: meshes[2], index: plungerIndex, base: parts.cylD[plungerIndex].m.clone(), m: new THREE.Matrix4() };
    // steady states: D2 power on, D3 idle, connector LEDs dim
    parts.led.forEach((it, i) => {
      const base = it.ref === 'D2' ? tmpC.set('#35ff7a').multiplyScalar(1.7) : it.ref === 'D3' ? tmpC.set('#3a3327') : it.ref === 'D1' ? tmpC.set('#2a0808') : tmpC.copy(it.c).multiplyScalar(0.5);
      led.setColorAt(i, base);
    });
    if (led.instanceColor) led.instanceColor.needsUpdate = true;

    // package markings
    const markings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; c: Component }[] = [];
    for (const c of components) {
      const f = footprint(c.type);
      if (!f.marking || !c.label) continue;
      const body = f.parts[f.parts.length > 1 && c.type === 'rfshield' ? 1 : 0];
      const mat = new THREE.MeshBasicMaterial({
        map: markingTexture(c.label, body.sx, body.sy, c.ref === 'U1'), transparent: true, depthWrite: false, toneMapped: false,
        color: c.type === 'rfshield' ? '#30343a' : '#ffffff',
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(body.sx * 0.96, body.sy * 0.96), mat);
      mesh.rotation.order = 'YXZ';   // lay flat, then spin about the vertical
      mesh.rotation.set(-Math.PI / 2, (-c.rotation * Math.PI) / 180, 0);
      mesh.position.set(c.x - OX, body.z + body.sz + 0.012, c.y - OZ);
      mesh.renderOrder = 2;
      markings.push({ mesh, mat, c });
    }

    // pin glow for the arrival "power on" of each page peripheral
    const glowMat = new THREE.MeshBasicMaterial({ toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const glows = NAV.map((n) => {
      const c = comp(navBuses[n.id].target);
      const f = footprint(c.type);
      const leaded = f.parts.some((p) => p.mat === 'metal' && p.sz < 0.4 && p.z < 0.1);
      tmpQ.setFromAxisAngle(Y, (-c.rotation * Math.PI) / 180);
      const list: Inst[] = f.pads.map((p) => {
        const b = toBoard(c, p.x, p.y);
        tmpP.set(b.x - OX, leaded ? 0.37 : 0.06, b.y - OZ);
        tmpS.set(p.w * 1.05, 0.05, p.h * 1.05);
        return { m: new THREE.Matrix4().compose(tmpP, tmpQ, tmpS), c: new THREE.Color(0, 0, 0), ref: c.ref };
      });
      return { id: n.id as NavId, mesh: instanced(boxGeo, glowMat, list), n: list.length, color: new THREE.Color(n.color) };
    });

    // via barrels through the stackup
    const copper = new THREE.MeshStandardMaterial({ color: '#c0793a', roughness: 0.45, metalness: 0.85 });
    const plain = vias.filter((v) => !(v.nav && v.lead));
    const barrels = instanced(cylGeo, copper, plain.map((v) => {
      tmpP.set(v.x - OX, -BOARD.thickness / 2, v.y - OZ);
      tmpS.set(v.drill + 0.12, BOARD.thickness - 0.04, v.drill + 0.12);
      return { m: new THREE.Matrix4().compose(tmpP, tmpQ.identity(), tmpS), c: new THREE.Color('#ffffff'), ref: '' };
    }));
    const tubeGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 28, 1, true);
    const tubeMat = new THREE.MeshBasicMaterial({ color: '#e9b75a', side: THREE.DoubleSide, toneMapped: false });
    const tubes = instanced(tubeGeo, tubeMat, vias.filter((v) => v.nav && v.lead).map((v) => {
      tmpP.set(v.x - OX, -0.55, v.y - OZ);
      tmpS.set(v.drill, 1.14, v.drill);
      return { m: new THREE.Matrix4().compose(tmpP, tmpQ.identity(), tmpS), c: new THREE.Color('#ffffff').multiplyScalar(1.15), ref: '' };
    }));

    const topMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0.12, envMapIntensity: 0.55 });
    const gndMat = new THREE.MeshBasicMaterial({ map: planeTexture('#7a4418'), side: THREE.BackSide });
    const pwrMat = new THREE.MeshBasicMaterial({ map: planeTexture('#8a4a1a'), side: THREE.FrontSide });
    return { meshes, led, ledIndex, markings, glows, barrels, tubes, topMat, gndMat, pwrMat, plunger };
  }, [texture]);

  useEffect(() => { invalidate(); }, [built, invalidate]);

  const d1 = built.ledIndex('D1'), d2 = built.ledIndex('D2'), d3 = built.ledIndex('D3');
  const white = useMemo(() => new THREE.Color(1, 1, 1), []);
  const projColor = useMemo(() => new THREE.Color(NAV.find((n) => n.id === 'projects')!.color), []);

  useFrame(() => {
    const t = fx.time;
    // D1 heartbeat (lub-dub), D3 activity flicker while a net is lit
    const ph = (t % 1.25) / 1.25;
    const beat = Math.max(Math.exp(-(((ph - 0.08) / 0.045) ** 2)), 0.65 * Math.exp(-(((ph - 0.27) / 0.055) ** 2)));
    // SW1 reset: plunger travels, rails drop for 0.75 s (LEDs and marking go dark), then power returns
    const rz = t - fx.reset.t0;
    const dark = rz < 0.75;
    const press = rz < 0.09 ? rz / 0.09 : rz < 0.45 ? 1 - (rz - 0.09) / 0.36 : 0;
    built.plunger.m.copy(built.plunger.base);
    built.plunger.m.elements[13] -= 0.55 * press;
    built.plunger.mesh.setMatrixAt(built.plunger.index, built.plunger.m);
    built.plunger.mesh.instanceMatrix.needsUpdate = true;
    built.led.setColorAt(d2, dark ? tmpC.setRGB(0.02, 0.05, 0.03) : tmpC.set('#35ff7a').multiplyScalar(1.7));
    if (dark) built.led.setColorAt(d1, tmpC.setRGB(0.05, 0.01, 0.01));
    else built.led.setColorAt(d1, tmpC.setRGB(0.16 + 3.2 * beat, 0.03 + 0.25 * beat, 0.03));
    const act = fx.pulseOn > 0 ? 0.5 + 0.5 * Math.sin(t * 40) : 0;
    built.led.setColorAt(d3, tmpC.setRGB(0.22 + 2.4 * act, 0.2 + 1.6 * act, 0.15));
    built.led.instanceColor!.needsUpdate = true;

    built.topMat.color.setScalar(fx.dim);

    // arrival: pins light in sequence, then the marking glows
    const e = t - fx.power.t0;
    for (const g of built.glows) {
      const on = fx.power.id === g.id;
      for (let i = 0; i < g.n; i++) {
        const local = e - (i / g.n) * 0.55;
        const k = on && local > 0 ? Math.min(1, local / 0.1) * (0.3 + 2.6 * Math.exp(-local * 3.2)) : 0;
        g.mesh.setColorAt(i, tmpC.copy(g.color).multiplyScalar(k));
      }
      g.mesh.instanceColor!.needsUpdate = true;
    }
    const hoverProject = useStore.getState().hoverProject;
    for (const m of built.markings) {
      if (m.c.type === 'rfshield' && fx.power.id !== m.c.pageId) continue;
      if (m.c.ref === 'U1') {
        m.mat.color.setScalar(dark ? 0.2 : rz < 2.6 ? 1 + 2.4 * Math.exp(-(rz - 0.75) * 3.2) : 1);
      } else if (m.c.pageId && m.c.pageId !== 'home') {
        const on = fx.power.id === m.c.pageId;
        const g = on ? THREE.MathUtils.smoothstep(e, 0.4, 0.7) : 0;
        const net = built.glows.find((x) => x.id === m.c.pageId)!.color;
        m.mat.color.copy(white).lerp(tmpC.copy(net).multiplyScalar(1.5 + 2.4 * Math.exp(-Math.max(0, e - 0.5) * 2.2)), g);
      } else if (m.c.projectSlug) {
        if (m.c.projectSlug === hoverProject) m.mat.color.copy(projColor).multiplyScalar(3.2);
        else m.mat.color.copy(white);
      }
    }
  });

  return (
    <group>
      {/* soldermask + silkscreen */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={built.topMat}>
        <planeGeometry args={[BOARD.w, BOARD.h]} />
      </mesh>
      {/* FR-4 edge */}
      <mesh position={[0, -BOARD.thickness / 2 - 0.01, 0]}>
        <boxGeometry args={[BOARD.w, BOARD.thickness, BOARD.h]} />
        <meshStandardMaterial color="#8f8a4e" roughness={0.8} />
      </mesh>
      {/* GND plane (seen from below) and PWR plane (seen from above) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GND_Y, 0]} material={built.gndMat}>
        <planeGeometry args={[BOARD.w, BOARD.h]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PWR_Y, 0]} material={built.pwrMat}>
        <planeGeometry args={[BOARD.w, BOARD.h]} />
      </mesh>
      <primitive object={built.barrels} />
      <primitive object={built.tubes} />
      {built.meshes.map((m, i) => <primitive key={i} object={m} />)}
      <primitive object={built.led} />
      {built.markings.map((m) => <primitive key={m.c.ref} object={m.mesh} />)}
      {built.glows.map((g) => <primitive key={g.id} object={g.mesh} />)}
    </group>
  );
}
