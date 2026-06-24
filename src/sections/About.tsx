import { ABOUT_BIO, SKILLS } from "@/data/content";

export default function About() {
  return (
    <div className="grid gap-5">
      <div className="h-24 w-24 rounded-full border border-[#d4a017]/40 bg-black/30 flex items-center justify-center text-xs text-[#e8e8d0]/50">
        PHOTO
      </div>
      <p className="text-sm text-[#e8e8d0]/80 leading-relaxed">{ABOUT_BIO}</p>
      <div className="grid gap-3">
        {SKILLS.map((group) => (
          <div key={group.category}>
            <h4 className="text-xs uppercase tracking-widest text-[#d4a017]">{group.category}</h4>
            <div className="mt-1 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#d4a017]/40 px-2 py-0.5 text-xs text-[#e8e8d0]/80"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
