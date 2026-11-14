import { profile } from '../../content';
import { toast } from '../Toast';

export function Contact() {
  const copy = async () => {
    try { await navigator.clipboard.writeText(profile.email); toast('Email copied to clipboard'); }
    catch { window.location.href = `mailto:${profile.email}`; }
  };
  return (
    <>
      <h1 tabIndex={-1}>Contact</h1>
      <p className="sheet__sub">{profile.contactLede}</p>
      <ul className="contact">
        <li>
          <span className="eyebrow">Email</span>
          <button className="contact__copy" onClick={copy} aria-label={`Copy email address ${profile.email}`}>
            {profile.email}<span className="contact__hint">click to copy</span>
          </button>
          <a className="contact__alt" href={`mailto:${profile.email}`}>or open in mail app ↗</a>
        </li>
        <li>
          <span className="eyebrow">LinkedIn</span>
          <a href={profile.linkedin} target="_blank" rel="noopener">{profile.linkedinLabel} ↗</a>
        </li>
        <li>
          <span className="eyebrow">GitHub</span>
          <a href={profile.github} target="_blank" rel="noopener">{profile.githubLabel} ↗</a>
        </li>
        <li>
          <span className="eyebrow">Phone</span>
          <a href={`tel:${profile.phone.replace(/[^+\d]/g, '')}`}>{profile.phone}</a>
        </li>
      </ul>
      <p className="links">
        <a className="btn btn--primary" href={`mailto:${profile.email}`}>{profile.email}</a>
        <a className="btn" href={profile.resume} download={profile.resumeFileName}>Download resume (PDF)</a>
      </p>
      <p className="muted small">{profile.location} · No tracking on this site.</p>
    </>
  );
}
