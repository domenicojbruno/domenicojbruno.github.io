import type { Role } from '../../content';

/** Vertical timeline drawn like a logic trace: each role is an edge on the line. */
export function Timeline({ title, lede, items }: { title: string; lede: string; items: Role[] }) {
  return (
    <>
      <h1 tabIndex={-1}>{title}</h1>
      <p className="sheet__sub">{lede}</p>
      <ol className="tl">
        {items.map((e) => (
          <li key={e.title + e.org}>
            <span className="tl__edge" aria-hidden="true" />
            <p className="tl__when mono">{e.when}</p>
            <div className="tl__body">
              <h3>{e.title}</h3>
              <p className="tl__org mono">{e.org} · {e.place}</p>
              {e.note && <p className="tl__note">{e.note}</p>}
              {e.bullets.length > 0 && <ul>{e.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
            </div>
            <span className="tl__kind mono">{e.kind}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
