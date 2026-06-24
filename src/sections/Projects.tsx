import { PROJECTS } from "@/data/content";

export default function Projects() {
  return (
    <div className="grid gap-4">
      {PROJECTS.map((project) => (
        <div
          key={project.title}
          className="rounded border border-[#d4a017]/25 bg-black/20 p-4"
        >
          <h3 className="text-[#e8e8d0] font-semibold tracking-wide">{project.title}</h3>
          <p className="mt-1 text-sm text-[#e8e8d0]/70">{project.blurb}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#d4a017]/40 px-2 py-0.5 text-xs text-[#d4a017]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
