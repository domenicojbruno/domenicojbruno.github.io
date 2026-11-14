import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projects, projectBySlug, projectFilters, type Project } from '../../content';
import { useStore } from '../../state/store';

/** Neutral stand-in for projects without imagery (listed as content TODOs). */
function Placeholder() {
  return (
    <svg className="card__ph" viewBox="0 0 160 90" role="img" aria-label="Schematic not yet published" data-todo="project-image">
      <rect x="52" y="23" width="56" height="44" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} stroke="currentColor" strokeWidth="1.5">
          <path d={`M40 ${30 + i * 10}h12M108 ${30 + i * 10}h12`} />
        </g>
      ))}
      <circle cx="59" cy="30" r="1.8" fill="currentColor" />
    </svg>
  );
}

function Card({ p }: { p: Project }) {
  const setHoverProject = useStore((s) => s.setHoverProject);
  const on = () => setHoverProject(p.slug), off = () => setHoverProject(null);
  return (
    <li>
      <Link to={`/projects/${p.slug}`} className={`card card--${p.kind}`} onMouseEnter={on} onMouseLeave={off} onFocus={on} onBlur={off}>
        {p.kind === 'main' && (
          <div className="card__img">
            {p.cover ? <img src={p.cover} alt="" loading="lazy" decoding="async" /> : <Placeholder />}
          </div>
        )}
        <div className="card__body">
          <h3>{p.title}</h3>
          <p className="card__sum">{p.summary}</p>
          <p className="card__meta mono">{p.where} · {p.when}</p>
          <ul className="tags">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </Link>
    </li>
  );
}

function Detail({ p }: { p: Project }) {
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    if (zoom === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null);
      if (e.key === 'ArrowRight') setZoom((z) => (z === null ? z : (z + 1) % p.images.length));
      if (e.key === 'ArrowLeft') setZoom((z) => (z === null ? z : (z + p.images.length - 1) % p.images.length));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [zoom, p.images.length]);
  const meta: [string, string][] = [['Where', p.where], ['When', p.when]];
  if (p.role) meta.push(['My role', p.role]);
  if (p.team.length) meta.push(['With', p.team.join(', ')]);
  return (
    <>
      <p className="crumb"><Link to="/projects">← All projects</Link></p>
      <h1 tabIndex={-1}>{p.title}</h1>
      <p className="sheet__sub">{p.summary}</p>
      <dl className="meta">{meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {p.stats.length > 0 && (
        <dl className="stats">{p.stats.map((s) => <div key={s.k}><dt>{s.k}</dt><dd>{s.v}</dd></div>)}</dl>
      )}
      <ul className="tags tags--lg">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
      {p.kind === 'main' && <p className="lede">{p.blurb}</p>}
      <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
      {p.images.length > 0 && (
        <>
          <h2>Gallery</h2>
          <div className="gallery">
            {p.images.map((im, i) => (
              <figure key={im.src}>
                <button onClick={() => setZoom(i)} aria-label={`Enlarge: ${im.alt ?? im.caption ?? p.title}`}>
                  <img src={im.src} alt={im.alt ?? im.caption ?? ''} loading="lazy" decoding="async" />
                </button>
                {im.caption && <figcaption>{im.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </>
      )}
      {p.links.length > 0 && (
        <p className="links">{p.links.map((l) => <a key={l.href} className="btn" href={l.href} target="_blank" rel="noopener">{l.label} ↗</a>)}</p>
      )}
      {zoom !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={() => setZoom(null)}>
          <img src={p.images[zoom].src} alt={p.images[zoom].alt ?? p.images[zoom].caption ?? ''} />
          {p.images[zoom].caption && <p>{p.images[zoom].caption}</p>}
          <button autoFocus aria-label="Close image">Close ✕</button>
        </div>
      )}
    </>
  );
}

export function Projects({ slug }: { slug?: string }) {
  const [filter, setFilter] = useState<string | null>(null);
  const detail = projectBySlug(slug);
  if (slug && detail) return <Detail p={detail} />;
  const list = projects.filter((p) => !filter || p.filter.includes(filter));
  const main = list.filter((p) => p.kind === 'main'), small = list.filter((p) => p.kind === 'small');
  return (
    <>
      <h1 tabIndex={-1}>Projects</h1>
      <p className="sheet__sub">Things I built, and what they measured. Every number came off a simulation, not a datasheet. Where a target was missed, the case study says so.</p>
      {slug && !detail && <p className="muted">That project was not found — here is everything.</p>}
      <div className="filters" role="group" aria-label="Filter projects">
        <button aria-pressed={filter === null} onClick={() => setFilter(null)}>All</button>
        {projectFilters.map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(filter === f ? null : f)}>{f}</button>
        ))}
      </div>
      {main.length > 0 && <ul className="cards">{main.map((p) => <Card key={p.slug} p={p} />)}</ul>}
      {small.length > 0 && (
        <>
          <h2>Smaller builds</h2>
          <ul className="cards cards--small">{small.map((p) => <Card key={p.slug} p={p} />)}</ul>
        </>
      )}
    </>
  );
}
