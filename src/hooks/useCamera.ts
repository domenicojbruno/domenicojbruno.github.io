import { useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useStore } from "@/store/useStore";
import { getChip, TRACE_GEOMETRY, type TraceSegment } from "@/data/chips";
import type { useElectricity } from "./useElectricity";

const TOTAL_DURATION = 1.8;
const IDLE_AUTOROTATE_DELAY = 5000;

interface LegPoint {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

function flyAbove(p: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y + 5.5, p.z + 2.5);
}

/**
 * Owns the camera/OrbitControls state machine: idle orbit <-> locked GSAP
 * flythrough along the active trace <-> settled chip framing. Fires off the
 * lifted useElectricity() pulse so the two stay in lockstep without either
 * hook needing to know the other's internals beyond triggerPulse/resetPulse.
 */
export function useCamera(electricity: ReturnType<typeof useElectricity>) {
  const camera = useThree((s) => s.camera);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const navRequestId = useStore((s) => s.navRequestId);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => setAutoRotate(true), IDLE_AUTOROTATE_DELAY);
  }, [clearIdleTimer]);

  const handleControlsStart = useCallback(() => {
    setAutoRotate(false);
    clearIdleTimer();
  }, [clearIdleTimer]);

  const handleControlsEnd = useCallback(() => {
    scheduleIdleTimer();
  }, [scheduleIdleTimer]);

  // Idle auto-rotate countdown, restarted whenever the user releases the controls.
  useEffect(() => {
    scheduleIdleTimer();
    return clearIdleTimer;
  }, [scheduleIdleTimer, clearIdleTimer]);

  // One-time settle from the high overview start position into CPU's
  // chip-mode framing once the boot sequence finishes.
  const bootComplete = useStore((s) => s.bootComplete);
  useEffect(() => {
    if (!bootComplete) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const cpu = getChip("cpu");
    const finalPos = new THREE.Vector3(...cpu.position).add(
      new THREE.Vector3(...cpu.cameraFraming.offset),
    );
    const finalLook = new THREE.Vector3(...cpu.position).add(
      new THREE.Vector3(...cpu.cameraFraming.lookAtOffset),
    );

    if (useStore.getState().reducedMotion) {
      camera.position.copy(finalPos);
      controls.target.copy(finalLook);
      controls.update();
      scheduleIdleTimer();
      return;
    }

    const proxy = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      lx: controls.target.x,
      ly: controls.target.y,
      lz: controls.target.z,
    };
    const tween = gsap.to(proxy, {
      px: finalPos.x,
      py: finalPos.y,
      pz: finalPos.z,
      lx: finalLook.x,
      ly: finalLook.y,
      lz: finalLook.z,
      duration: 1.4,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.position.set(proxy.px, proxy.py, proxy.pz);
        camera.lookAt(proxy.lx, proxy.ly, proxy.lz);
      },
      onComplete: () => {
        controls.update();
        scheduleIdleTimer();
      },
    });

    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete]);

  // Keyed on navRequestId (not currentChip) so a request that doesn't change
  // currentChip's value still refires -- see useStore's navRequestId doc.
  useEffect(() => {
    if (navRequestId === 0) return; // initial mount, nothing to animate yet

    const { currentChip, navReverse, activeTraceId, reducedMotion } = useStore.getState();
    const controls = controlsRef.current;
    if (!controls || !activeTraceId) return;

    const destChip = getChip(currentChip);
    const finalPos = new THREE.Vector3(...destChip.position).add(
      new THREE.Vector3(...destChip.cameraFraming.offset),
    );
    const finalLook = new THREE.Vector3(...destChip.position).add(
      new THREE.Vector3(...destChip.cameraFraming.lookAtOffset),
    );

    timelineRef.current?.kill();
    setAutoRotate(false);
    clearIdleTimer();

    if (reducedMotion) {
      camera.position.copy(finalPos);
      controls.target.copy(finalLook);
      controls.update();
      controls.enabled = true;
      electricity.resetPulse();
      useStore.getState().setTransitioning(false);
      scheduleIdleTimer();
      return;
    }

    controls.enabled = false;

    const geometryData = TRACE_GEOMETRY[activeTraceId];
    const segments: TraceSegment[] = navReverse
      ? geometryData.segments
          .slice()
          .reverse()
          .map((seg) => ({ start: seg.end, end: seg.start, length: seg.length }))
      : geometryData.segments;

    // Leg 0 flies from wherever the camera actually is right now -- not an
    // assumed idle framing -- to above the first segment's start.
    const startPos = camera.position.clone();
    const startLook = controls.target.clone();
    const approachLength = startPos.distanceTo(flyAbove(segments[0].start));

    const legs: { from: LegPoint; to: LegPoint; length: number }[] = [
      {
        from: { pos: startPos, look: startLook },
        to: { pos: flyAbove(segments[0].start), look: segments[0].end },
        length: approachLength,
      },
    ];
    segments.forEach((seg, i) => {
      const isLast = i === segments.length - 1;
      legs.push({
        from: legs[legs.length - 1].to,
        to: isLast
          ? { pos: finalPos, look: finalLook }
          : { pos: flyAbove(seg.end), look: segments[i + 1].end },
        length: seg.length,
      });
    });

    const totalLength = legs.reduce((sum, leg) => sum + leg.length, 0) || 1;

    const tl = gsap.timeline({
      onComplete: () => {
        camera.position.copy(finalPos);
        controls.target.copy(finalLook);
        controls.update();
        controls.enabled = true;
        electricity.resetPulse();
        useStore.getState().setTransitioning(false);
        scheduleIdleTimer();
      },
    });

    legs.forEach((leg, i) => {
      const isFirst = i === 0;
      const isLast = i === legs.length - 1;
      const ease = isFirst ? "power2.in" : isLast ? "power2.out" : "none";
      const duration = (leg.length / totalLength) * TOTAL_DURATION;
      const proxy = {
        px: leg.from.pos.x,
        py: leg.from.pos.y,
        pz: leg.from.pos.z,
        lx: leg.from.look.x,
        ly: leg.from.look.y,
        lz: leg.from.look.z,
      };
      tl.to(proxy, {
        px: leg.to.pos.x,
        py: leg.to.pos.y,
        pz: leg.to.pos.z,
        lx: leg.to.look.x,
        ly: leg.to.look.y,
        lz: leg.to.look.z,
        duration,
        ease,
        onUpdate: () => {
          camera.position.set(proxy.px, proxy.py, proxy.pz);
          camera.lookAt(proxy.lx, proxy.ly, proxy.lz);
        },
      });
    });

    timelineRef.current = tl;

    // Pulse leads the camera: shorter duration started at the same time,
    // finishing ~0.8s before the ~1.8s camera timeline does.
    electricity.triggerPulse(navReverse, 1.0);

    return () => {
      tl.kill();
    };
    // Intentionally keyed only on navRequestId -- see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navRequestId]);

  return { controlsRef, autoRotate, handleControlsStart, handleControlsEnd };
}
