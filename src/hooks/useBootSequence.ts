import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useProgress } from "@react-three/drei";
import { useStore } from "@/store/useStore";

const MESSAGES = ["INITIALIZING...", "CHECKING MEMORY...", "PORTFOLIO LOADED"];
const CHAR_INTERVAL_MS = 45;
const MESSAGE_PAUSE_MS = 400;
// Phase 1 has no real async loads, so useProgress() alone would jump to 100%
// almost instantly -- blend in a time-based minimum so the boot sequence has
// a deliberate, consistent presence regardless of what (if anything) loads.
const FAKE_PROGRESS_DURATION_MS = 1800;
const HOLD_AFTER_DONE_MS = 500;
const TICK_MS = 50;

interface TypewriterState {
  messageIndex: number;
  charIndex: number;
  pausedUntil: number;
  doneTypingAt: number | null;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lines: string[],
  progressPercent: number,
) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e8e8d0";
  ctx.font = `${Math.round(canvas.height * 0.085)}px 'JetBrains Mono', 'Share Tech Mono', ui-monospace, monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const lineHeight = canvas.height * 0.14;
  const startY = canvas.height * 0.24;
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width * 0.08, startY + i * lineHeight);
  });

  const barX = canvas.width * 0.08;
  const barY = canvas.height * 0.78;
  const barWidth = canvas.width * 0.84;
  const barHeight = canvas.height * 0.07;
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = "#d4a017";
  ctx.fillRect(barX, barY, barWidth * (progressPercent / 100), barHeight);
}

export function useBootSequence() {
  const { progress: realProgress, active } = useProgress();
  const setBootComplete = useStore((s) => s.setBootComplete);
  const [bootComplete, setLocalBootComplete] = useState(false);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);

  // Refreshed every render so the interval below always reads live values
  // without needing to restart on every progress tick.
  const progressRef = useRef(realProgress);
  const activeRef = useRef(active);
  useEffect(() => {
    progressRef.current = realProgress;
    activeRef.current = active;
  }, [realProgress, active]);

  useEffect(() => {
    const ctx = canvas.getContext("2d")!;
    const startedAt = performance.now();
    const state: TypewriterState = {
      messageIndex: 0,
      charIndex: 0,
      pausedUntil: 0,
      doneTypingAt: null,
    };
    let completed = false;
    let charTickAccumulator = 0;

    const interval = window.setInterval(() => {
      const now = performance.now();
      charTickAccumulator += TICK_MS;

      if (
        now >= state.pausedUntil &&
        state.messageIndex < MESSAGES.length &&
        charTickAccumulator >= CHAR_INTERVAL_MS
      ) {
        charTickAccumulator = 0;
        const currentMessage = MESSAGES[state.messageIndex];
        if (state.charIndex < currentMessage.length) {
          state.charIndex++;
        } else if (state.messageIndex < MESSAGES.length - 1) {
          state.messageIndex++;
          state.charIndex = 0;
          state.pausedUntil = now + MESSAGE_PAUSE_MS;
        } else if (state.doneTypingAt === null) {
          state.doneTypingAt = now;
        }
      }

      const elapsed = now - startedAt;
      const fakeProgress = Math.min(100, (elapsed / FAKE_PROGRESS_DURATION_MS) * 100);
      const combinedProgress = Math.max(progressRef.current, fakeProgress);

      const lines = [
        ...MESSAGES.slice(0, state.messageIndex),
        MESSAGES[state.messageIndex].slice(0, state.charIndex),
      ];
      drawFrame(ctx, canvas, lines, combinedProgress);
      texture.needsUpdate = true;

      if (
        !completed &&
        state.doneTypingAt !== null &&
        combinedProgress >= 100 &&
        !activeRef.current &&
        now - state.doneTypingAt >= HOLD_AFTER_DONE_MS
      ) {
        completed = true;
        setLocalBootComplete(true);
        setBootComplete(true);
        window.clearInterval(interval);
      }
    }, TICK_MS);

    return () => window.clearInterval(interval);
    // Runs once: the interval reads live progress via progressRef/activeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { texture, bootComplete };
}
