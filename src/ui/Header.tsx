import { NAV } from '../board/nets';
import { profile } from '../content';
import { useStore } from '../state/store';
import { useRideLink } from './nav';

/** Always-visible top bar: the recruiter's two-click path to everything. */
export function Header() {
  const link = useRideLink();
  const page = useStore((s) => s.page);
  const muted = useStore((s) => s.muted);
  const toggleMute = useStore((s) => s.toggleMute);
  const setHover = useStore((s) => s.setHover);
  const mode = useStore((s) => s.mode);
  return (
    <header className="hdr">
      <a className="hdr__name" {...link('home')} aria-label={`${profile.name} — home`}>
        <span className="hdr__logo" aria-hidden="true">DJB</span>
        <span>{profile.name}</span>
      </a>
      <nav className="hdr__nav" aria-label="Primary">
        {NAV.filter((n) => n.header).map((n) => (
          <a
            key={n.id} {...link(n.id)} className="hdr__link"
            aria-current={page === n.id ? 'page' : undefined}
            style={{ '--net': n.color } as React.CSSProperties}
            onMouseEnter={() => page === 'home' && setHover(n.id)} onMouseLeave={() => setHover(null)}
            onFocus={() => page === 'home' && setHover(n.id)} onBlur={() => setHover(null)}
          >{n.label}</a>
        ))}
      </nav>
      <div className="hdr__tools">
        {mode === '3d' && (
          <button className="hdr__sound" onClick={toggleMute} aria-pressed={!muted} aria-label={muted ? 'Turn ride sound on' : 'Turn ride sound off'} title={muted ? 'Sound off' : 'Sound on'}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9v6h4l5 4V5L8 9H4z" />
              {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />}
            </svg>
          </button>
        )}
        <a className="hdr__pdf" href={profile.resume} download={profile.resumeFileName}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
          <span>Resume <span className="hdr__pdf-x">PDF</span></span>
        </a>
      </div>
    </header>
  );
}
