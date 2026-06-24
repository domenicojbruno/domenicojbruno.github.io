import { useStore } from "@/store/useStore";
import type { Direction } from "@/data/chips";

const LABEL_BASE =
  "pointer-events-auto rounded border border-[#d4a017]/30 bg-[rgba(10,30,15,0.65)] px-4 py-1.5 text-sm tracking-widest text-[#d4a017] backdrop-blur-sm transition-colors hover:text-[#ffe066] hover:border-[#ffe066]/60";

interface DirectionButtonProps {
  direction: Direction;
  label: string;
  className: string;
}

function DirectionButton({ direction, label, className }: DirectionButtonProps) {
  const navigateByDirection = useStore((s) => s.navigateByDirection);
  return (
    <button
      type="button"
      onClick={() => navigateByDirection(direction)}
      className={`${LABEL_BASE} ${className}`}
    >
      {label}
    </button>
  );
}

export default function Compass() {
  const currentChip = useStore((s) => s.currentChip);
  const transitioning = useStore((s) => s.transitioning);
  const bootComplete = useStore((s) => s.bootComplete);

  if (currentChip !== "cpu" || transitioning || !bootComplete) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <DirectionButton
        direction="N"
        label="↑ PROJECTS"
        className="absolute left-1/2 top-10 -translate-x-1/2"
      />
      <DirectionButton
        direction="E"
        label="EXPERIENCE →"
        className="absolute right-10 top-1/2 -translate-y-1/2"
      />
      <DirectionButton
        direction="S"
        label="↓ CONTACT"
        className="absolute left-1/2 bottom-10 -translate-x-1/2"
      />
      <DirectionButton
        direction="W"
        label="← ABOUT"
        className="absolute left-10 top-1/2 -translate-y-1/2"
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs tracking-[0.3em] text-[#e8e8d0]/40">
        SELECT DIRECTION
      </div>
    </div>
  );
}
