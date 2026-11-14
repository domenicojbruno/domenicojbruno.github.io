import { useEffect, useMemo, useState } from 'react';
import { NAV } from '../board/nets';
import { navBuses } from '../board/layout';
import { labelAnchor } from '../board/view';
import { profile } from '../content';
import { useStore } from '../state/store';
import { useRideLink } from './nav';

const ARROW = { l: '←', r: '→', t: '↑', b: '↓' } as const;

/**
 * Home-view navigation: one silkscreen-style label per page, pinned where that
 * page's bus leaves the frame. Real links; focus behaves like hover.
 */
export function NavLabels() {
  const link = useRideLink();
  const page = useStore((s) => s.page);
  const phase = useStore((s) => s.phase);
  const mode = useStore((s) => s.mode);
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const anchors = useMemo(() => {
    const list = NAV.map((n) => ({ n, a: labelAnchor(n.id, size.w, size.h), west: false }));
    // labels on the top/bottom edge hang to the west or east of their trace; split neighbours apart
    for (const side of ['t', 'b'] as const) {
      const row = list.filter((l) => l.a.side === side).sort((p, q) => p.a.x - q.a.x);
      row.forEach((l, i) => { l.west = row.length === 1 ? l.a.x < 0.5 : i < row.length / 2; });
    }
    return list;
  }, [size]);
  const shown = page === 'home' && phase === 'idle';
  if (mode !== '3d') return null;

  return (
    <div className={`home${shown ? ' is-on' : ''}`} aria-hidden={!shown}>
      <nav className="labels" aria-label="Board navigation">
        {anchors.map(({ n, a, west }) => {
          const tx = a.side === 'l' ? '-100%' : a.side === 'r' ? '0%' : west ? '-94%' : '-6%';
          const ty = a.side === 't' ? '-100%' : a.side === 'b' ? '0%' : '-50%';
          return (
            <a
              key={n.id} {...link(n.id)} tabIndex={shown ? 0 : -1}
              className={`label label--${a.side}${hover === n.id ? ' is-hot' : ''}${west ? ' label--west' : ''}`}
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, transform: `translate(${tx}, ${ty})`, '--net': n.color } as React.CSSProperties}
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
            >
              <span className="label__name">
                {a.side === 'l' && <i aria-hidden="true">{ARROW.l} </i>}
                {n.label}
                {a.side !== 'l' && <i aria-hidden="true"> {ARROW[a.side]}</i>}
              </span>
              <span className="label__net">{navBuses[n.id].pinName} · {n.net}</span>
            </a>
          );
        })}
      </nav>
      <aside className="intro">
        <p className="intro__kicker">U1 · MAIN MCU · REV A</p>
        <h1 className="intro__name">{profile.name}</h1>
        <p className="intro__text">{profile.intro}</p>
        <p className="intro__chips">
          <span>{profile.schoolShort} · {profile.degreeShort} · {profile.grad}</span>
          <span className="intro__status">{profile.status}</span>
        </p>
      </aside>
    </div>
  );
}
