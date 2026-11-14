// Navigation glue between React Router (real URLs) and the ride state machine.
// Clicking a link starts a ride and the URL updates on arrival; back/forward
// changes the URL first and the matching ride plays; direct loads skip the ride.

import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HOME, navById, pageFromPath, pathOf } from '../board/nets';
import type { PageId } from '../board/types';
import { projectBySlug } from '../content';
import { useStore } from '../state/store';
import { track } from '../analytics';

export function useGo() {
  const navigate = useNavigate();
  return useCallback((page: PageId, slug?: string) => {
    const s = useStore.getState();
    if (s.phase === 'ride') return;                       // input is locked during a ride
    const path = slug ? `/projects/${slug}` : pathOf(page);
    if (s.page === page) { if (window.location.pathname !== path) navigate(path); return; }
    const riding = s.startRide(page, path);
    if (!riding && useStore.getState().page === page) navigate(path);   // no executor yet: plain navigation
  }, [navigate]);
}

/** Props for an <a> that rides instead of reloading; still a real link. */
export function useRideLink() {
  const go = useGo();
  return useCallback((page: PageId, slug?: string) => ({
    href: slug ? `/projects/${slug}` : pathOf(page),
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(page, slug);
    },
  }), [go]);
}

export function useRouteSync() {
  const loc = useLocation();
  const navigate = useNavigate();
  const phase = useStore((s) => s.phase);
  const arrivals = useStore((s) => s.arrivals);
  const page = useStore((s) => s.page);
  const done = useRef(0);

  useEffect(() => {
    const s = useStore.getState();
    if (s.phase === 'ride') return;
    const r = s.lastRide;
    if (r && r.id !== done.current) {
      done.current = r.id;
      if (r.push && r.push !== loc.pathname) { navigate(r.push); return; }   // URL updates on arrival
    }
    const target = pageFromPath(loc.pathname).page;
    if (target !== s.page) s.startRide(target);            // back / forward plays the matching ride
  }, [loc.pathname, phase, arrivals, navigate]);

  // one page view per URL (first load and every in-app navigation)
  useEffect(() => { track(loc.pathname); }, [loc.pathname]);

  // <title> and meta description per route
  useEffect(() => {
    const { slug } = pageFromPath(loc.pathname);
    const project = page === 'projects' ? projectBySlug(slug) : undefined;
    const meta = page === 'home' ? HOME : navById(page);
    const title = page === 'home' ? HOME.title : `${project ? `${project.title} · ` : ''}${meta.title} — Domenico J Bruno`;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', project ? project.blurb : meta.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://domenicojbruno.github.io${loc.pathname === '/' ? '' : loc.pathname}`);
  }, [page, loc.pathname]);
}
