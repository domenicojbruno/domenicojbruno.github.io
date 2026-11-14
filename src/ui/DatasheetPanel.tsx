import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NAV, navById, pageFromPath } from '../board/nets';
import { BOARD } from '../board/layout';
import type { NavId } from '../board/types';
import { useStore } from '../state/store';
import { useRideLink } from './nav';
import { About } from './pages/About';
import { Projects } from './pages/Projects';
import { Timeline } from './pages/Timeline';
import { Resume } from './pages/Resume';
import { Contact } from './pages/Contact';
import { experience, extracurriculars } from '../content';

function Page({ id, slug }: { id: NavId; slug?: string }) {
  switch (id) {
    case 'about': return <About />;
    case 'projects': return <Projects slug={slug} />;
    case 'experience': return <Timeline title="Experience" lede="Research, industry and teaching." items={experience} />;
    case 'extracurriculars': return <Timeline title="Extracurriculars" lede="Clubs, programs, leadership — the things that were never on a syllabus." items={extracurriculars} />;
    case 'resume': return <Resume />;
    case 'contact': return <Contact />;
  }
}

/** Page content, presented as a datasheet beside its chip. Plain HTML over the canvas. */
export function DatasheetPanel() {
  const page = useStore((s) => s.page);
  const phase = useStore((s) => s.phase);
  const direct = useStore((s) => s.direct);
  const link = useRideLink();
  const loc = useLocation();
  const { slug } = pageFromPath(loc.pathname);
  const open = page !== 'home' && phase === 'idle';
  const [shown, setShown] = useState<NavId | null>(page === 'home' ? null : page);
  const scroller = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => { if (page !== 'home') setShown(page); }, [page]);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [shown, slug]);
  useEffect(() => {
    if (open && !direct) panel.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [open, direct, shown]);

  const n = shown ? navById(shown) : null;
  const inert = open ? {} : ({ inert: '' } as Record<string, string>);

  return (
    <main
      id="content" ref={panel}
      className={`panel${open ? ' is-open' : ''}${direct ? ' is-direct' : ''}`}
      style={{ '--net': n?.color ?? '#7fe3a4' } as React.CSSProperties}
      aria-hidden={!open} {...inert}
    >
      {n && shown && (
        <>
          <div className="panel__strip">
            <span>{n.ref}</span><span>{n.label.toUpperCase()}</span><span>{n.part}</span><span>{BOARD.rev}</span>
            <span className="panel__net">{n.net}</span>
          </div>
          <div className="panel__bar">
            <a className="panel__back" {...link('home')}>← Back to MCU <kbd>Esc</kbd></a>
            <nav className="panel__jump" aria-label="Jump to page">
              {NAV.filter((x) => x.id !== shown).map((x) => (
                <a key={x.id} {...link(x.id)} style={{ '--net': x.color } as React.CSSProperties}>{x.label}</a>
              ))}
            </nav>
          </div>
          <div className="panel__scroll" ref={scroller} tabIndex={-1}>
            <article className="sheet"><Page id={shown} slug={shown === 'projects' ? slug : undefined} /></article>
          </div>
        </>
      )}
    </main>
  );
}
