import { CONTACT_LINKS } from "@/data/content";

export default function Contact() {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-3">
        {CONTACT_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={link.href.startsWith("http") ? "noreferrer" : undefined}
            className="rounded border border-[#d4a017]/40 px-3 py-1.5 text-sm text-[#d4a017] hover:border-[#ffe066]/70 hover:text-[#ffe066] transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>

      <form
        className="grid gap-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="text"
          placeholder="Name"
          className="rounded border border-[#d4a017]/30 bg-black/20 px-3 py-2 text-sm text-[#e8e8d0] placeholder:text-[#e8e8d0]/40 focus:outline-none focus:border-[#d4a017]/70"
        />
        <input
          type="email"
          placeholder="Email"
          className="rounded border border-[#d4a017]/30 bg-black/20 px-3 py-2 text-sm text-[#e8e8d0] placeholder:text-[#e8e8d0]/40 focus:outline-none focus:border-[#d4a017]/70"
        />
        <textarea
          placeholder="Message"
          rows={4}
          className="rounded border border-[#d4a017]/30 bg-black/20 px-3 py-2 text-sm text-[#e8e8d0] placeholder:text-[#e8e8d0]/40 focus:outline-none focus:border-[#d4a017]/70"
        />
        <button
          type="submit"
          className="rounded border border-[#d4a017]/50 px-3 py-2 text-sm text-[#d4a017] hover:border-[#ffe066]/70 hover:text-[#ffe066] transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
