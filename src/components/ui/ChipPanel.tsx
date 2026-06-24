import { useStore } from "@/store/useStore";
import { getChip, type ChipId } from "@/data/chips";
import Projects from "@/sections/Projects";
import Experience from "@/sections/Experience";
import About from "@/sections/About";
import Contact from "@/sections/Contact";

const SECTION_MAP: Partial<Record<ChipId, () => React.JSX.Element>> = {
  projects: Projects,
  experience: Experience,
  about: About,
  contact: Contact,
};

export default function ChipPanel() {
  const currentChip = useStore((s) => s.currentChip);
  const transitioning = useStore((s) => s.transitioning);
  const panelOpen = useStore((s) => s.panelOpen);
  const closePanel = useStore((s) => s.closePanel);

  const visible = currentChip !== "cpu" && !transitioning && panelOpen;
  const SectionComponent = currentChip !== "cpu" ? SECTION_MAP[currentChip] : undefined;

  return (
    <div
      className={`pointer-events-none fixed top-0 right-0 h-full w-full max-w-md transition-transform duration-300 ${
        visible ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="pointer-events-auto h-full overflow-y-auto border-l border-[#d4a017]/30 bg-[rgba(10,30,15,0.9)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg tracking-widest text-[#d4a017] uppercase">
            {currentChip !== "cpu" ? getChip(currentChip).label : ""}
          </h2>
          <button
            type="button"
            onClick={closePanel}
            className="text-sm text-[#e8e8d0]/60 hover:text-[#ffe066]"
          >
            ✕ CLOSE
          </button>
        </div>
        {SectionComponent ? <SectionComponent /> : null}
      </div>
    </div>
  );
}
