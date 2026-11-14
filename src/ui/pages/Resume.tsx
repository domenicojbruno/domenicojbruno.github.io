import { profile } from '../../content';

export function Resume() {
  return (
    <>
      <h1 tabIndex={-1}>Resume</h1>
      <p className="sheet__sub">{profile.summary}</p>
      <p className="links">
        <a className="btn btn--primary" href={profile.resume} download={profile.resumeFileName}>Download PDF</a>
        <a className="btn" href={profile.resume} target="_blank" rel="noopener">Open in new tab ↗</a>
      </p>
      <object className="pdf" data={`${profile.resume}#view=FitH&toolbar=0`} type="application/pdf" aria-label="Resume PDF">
        <p className="muted">
          Your browser cannot show the PDF inline. <a href={profile.resume} download={profile.resumeFileName}>Download the resume</a> instead.
        </p>
      </object>
    </>
  );
}
