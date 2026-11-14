import { aboutHtml, profile } from '../../content';

export function About() {
  const facts: [string, string][] = [
    ['Degree', profile.degree],
    ['School', `${profile.school}, ${profile.grad}`],
    ['Based', profile.location],
    ['Pronouns', profile.pronouns],
  ];
  let pin = 1;
  return (
    <>
      <h1 tabIndex={-1}>About</h1>
      <p className="sheet__sub">{profile.tagline}</p>
      {/* TODO(content): headshot — none exists in the source repo yet. */}
      <div className="about">
        <div className="prose prose--lede" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
        <aside className="facts" aria-label="Quick facts">
          <p className="eyebrow">Operating point</p>
          <dl>
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <a className="btn" href={profile.resume} download={profile.resumeFileName}>Download resume</a>
        </aside>
      </div>

      <h2>Education</h2>
      <ul className="edu">
        {profile.education.map((e) => (
          <li key={e.degree}>
            <strong>{e.degree}</strong>
            <span>{e.school} · {e.place}</span>
            <span className="mono">{e.when} · GPA {e.gpa}</span>
          </li>
        ))}
      </ul>

      <h2>Pin function table</h2>
      <div className="tbl">
        <table className="pins">
          <thead><tr><th>Pins</th><th>Function</th><th>Signals</th></tr></thead>
          <tbody>
            {profile.skills.map((g) => {
              const from = pin; pin += g.items.length;
              return (
                <tr key={g.group}>
                  <td className="mono">{from}–{pin - 1}</td>
                  <td className="pins__fn">{g.group}</td>
                  <td><ul className="tags">{g.items.map((i) => <li key={i}>{i}</li>)}</ul></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Coursework behind it</h2>
      <div className="tbl">
        <table>
          <thead><tr><th>Course</th><th>Title</th><th>Level</th><th>What came out of it</th></tr></thead>
          <tbody>
            {profile.coursework.map((c) => (
              <tr key={c.code}><td className="mono accent">{c.code}</td><td>{c.title}</td><td className="mono dim">{c.level}</td><td>{c.outcome}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Off the bench</h2>
      <p className="muted">Marching brass, plastic bricks, and a dog who does not care about noise figures.</p>
      <div className="bench">
        {profile.bench.map((b) => (
          <figure key={b.img} className={'wide' in b && b.wide ? 'is-wide' : undefined}>
            <img src={b.img} alt={b.alt} loading="lazy" decoding="async" />
            <figcaption><strong>{b.caption}</strong><span>{b.note}</span></figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
