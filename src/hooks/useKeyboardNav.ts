import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import type { Direction } from "@/data/chips";

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "N",
  KeyN: "N",
  ArrowRight: "E",
  KeyE: "E",
  ArrowDown: "S",
  KeyS: "S",
  ArrowLeft: "W",
  KeyW: "W",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** Arrow keys / N-E-S-W from the hub, Escape/Backspace back to the hub from a satellite. */
export function useKeyboardNav() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const { currentChip, transitioning, navigateByDirection, returnToHub } = useStore.getState();

      if (
        (event.code === "Escape" || event.code === "Backspace") &&
        currentChip !== "cpu" &&
        !transitioning
      ) {
        event.preventDefault();
        returnToHub();
        return;
      }

      const direction = KEY_MAP[event.code];
      if (!direction || currentChip !== "cpu" || transitioning) return;
      event.preventDefault();
      navigateByDirection(direction);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
