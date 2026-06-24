import { EXPERIENCE } from "@/data/content";

export default function Experience() {
  return (
    <div className="grid gap-5">
      {EXPERIENCE.map((entry) => (
        <div key={entry.role + entry.org} className="border-l-2 border-[#d4a017]/40 pl-4">
          <h3 className="text-[#e8e8d0] font-semibold tracking-wide">{entry.role}</h3>
          <p className="text-sm text-[#d4a017]">
            {entry.org} &mdash; {entry.period}
          </p>
          <ul className="mt-2 list-disc pl-4 text-sm text-[#e8e8d0]/70 space-y-1">
            {entry.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
