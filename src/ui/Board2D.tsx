// Flat version of the board for phones and browsers without WebGL. Same
// layout data, rendered as SVG; no three.js is loaded. Tapping a label lights
// its bus, runs a current pulse along it, pans to the peripheral, then the
// content slides up as a sheet.

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { BOARD, mcu, navBuses, peripheralOf } from '../board/layout';
import { NAV, navById } from '../board/nets';
import { boardMarkup, navPaths, polyD } from '../board/svg';
import { isWide } from '../board/view';
import type { NavId, PageId } from '../board/types';
import { profile } from '../content';
import { useStore, type Ride } from '../state/store';
import { useRideLink } from './nav';

interface VB { x: number; y: number; w: number; h: number }

function viewFor(page: PageId, W0: number, H0: number): VB {
  const W = W0 || 1, H = H0 || 1;
  const a = W / H;
  if (page === 'home') {
    const w = a < 1 ? 44 : 78 * a, h = w / a;
    return { x: mcu.x - w / 2, y: mcu.y - h * (a < 1 ? 0.3 : 0.4), w, h };
  }
  const c = peripheralOf(page);
  const w = a < 1 ? 40 : 60 * a, h = w / a;
  return isWide(W, H) ? { x: c.x - w * 0.2, y: c.y - h / 2, w, h } : { x: c.x - w / 2, y: c.y - h * 0.2, w, h };
}

export function Board2D() {
  const svg = useRef<SVGSVGElement>(null);
  const pulse = useRef<SVGPathElement>(null);
  const vb = useRef<VB>(viewFor(useStore.getState().page, window.innerWidth, window.innerHeight));
  const page = useStore((s) => s.page);
  const phase = useStore((s) => s.phase);
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const link = useRideLink();
  const [lit, setLit] = useState<NavId[]>([]);
  const markup = useMemo(() => boardMarkup('flat'), []);
  const nets = useMemo(() => NAV.map((n) => ({ n, paths: navPaths(n.id), lead: polyD(navBuses[n.id].lead) })), []);

  const apply = () => svg.current?.setAttribute('viewBox', `${vb.current.x} ${vb.current.y} ${vb.current.w} ${vb.current.h}`);

  useEffect(() => {
    useStore.setState({ executor: true });
    const play = (ride: Ride) => {
      const s = useStore.getState();
      const order = [ride.from, ride.to].filter((p): p is NavId => p !== 'home');
      const done = () => { setLit([]); useStore.getState().finishRide(); };
      const end = viewFor(ride.to, window.innerWidth, window.innerHeight);
      const tl = gsap.timeline({ onComplete: done });
      setLit(order);
      if (!s.reducedMotion && pulse.current) {
        // current pulse along each leg (~1 s in total), back toward the MCU first when leaving a page
        order.forEach((id, i) => {
          const outward = id === ride.to;
          tl.call(() => {
            const el = pulse.current!;
            el.setAttribute('d', polyD(navBuses[id].lead));
            el.setAttribute('stroke', navById(id).color);
            const L = el.getTotalLength();
            el.style.strokeDasharray = `${Math.min(9, L * 0.2)} ${L + 12}`;
            el.style.opacity = '1';
            gsap.fromTo(el, { strokeDashoffset: outward ? 9 : -L }, { strokeDashoffset: outward ? -L : 9, duration: 1 / order.length, ease: 'power2.inOut' });
          }, undefined, i * (1 / order.length));
        });
        tl.to({}, { duration: 1 });
        tl.call(() => { if (pulse.current) pulse.current.style.opacity = '0'; });
      }
      tl.to(vb.current, { ...end, duration: s.reducedMotion ? 0.35 : 0.85, ease: s.reducedMotion ? 'power1.out' : 'power3.inOut', onUpdate: apply });
    };
    const unsub = useStore.subscribe((s, p) => {
      if (s.ride && s.ride !== p.ride) play(s.ride);
      if (s.page !== p.page && !p.ride) { vb.current = viewFor(s.page, window.innerWidth, window.innerHeight); apply(); }
    });
    const resize = () => {
      if (useStore.getState().phase === 'ride') return;
      vb.current = viewFor(useStore.getState().page, window.innerWidth, window.innerHeight); apply();
    };
    window.addEventListener('resize', resize);
    apply();
    return () => { unsub(); window.removeEventListener('resize', resize); useStore.setState({ executor: false }); };
  }, []);

  const home = page === 'home' && phase === 'idle';
  return (
    <>
      <svg ref={svg} className="b2d" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Printed circuit board with a central microcontroller and one chip per page">
        <rect x={-BOARD.w} y={-BOARD.h} width={BOARD.w * 3} height={BOARD.h * 3} fill="#07090b" />
        <g dangerouslySetInnerHTML={{ __html: markup }} />
        {nets.map(({ n, paths }) => {
          const on = lit.includes(n.id) || hover === n.id;
          return (
            <g key={n.id} className={`b2d-net${on ? ' is-on' : ''}`} stroke={n.color} fill="none" strokeLinecap="round" strokeLinejoin="round">
              {paths.map((p, i) => <path key={i} d={p.d} strokeWidth={p.layer === 'top' ? 0.42 : 0.3} strokeOpacity={p.layer === 'top' ? 1 : 0.45} strokeDasharray={p.layer === 'top' ? undefined : '0.9 0.7'} />)}
            </g>
          );
        })}
        <path ref={pulse} className="b2d-pulse" fill="none" strokeWidth="1.1" strokeLinecap="round" style={{ opacity: 0 }} />
      </svg>
      <div className={`m-home${home ? ' is-on' : ''}`} aria-hidden={!home}>
        <div className="m-intro">
          <p className="intro__kicker">U1 · MAIN MCU · REV A</p>
          <h1 className="intro__name">{profile.name}</h1>
          <p className="intro__text">{profile.tagline}</p>
        </div>
        <nav className="m-labels" aria-label="Board navigation">
          {NAV.map((n) => (
            <a
              key={n.id} {...link(n.id)} tabIndex={home ? 0 : -1} className="m-label" style={{ '--net': n.color } as React.CSSProperties}
              onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
            >
              <span className="label__name">{n.label} <i aria-hidden="true">→</i></span>
              <span className="label__net">{navBuses[n.id].pinName} · {n.net}</span>
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
