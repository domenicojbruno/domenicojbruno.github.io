import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './state/store';
import { pageFromPath } from './board/nets';
import { useGo, useRouteSync } from './ui/nav';
import { Header } from './ui/Header';
import { NavLabels } from './ui/NavLabels';
import { DatasheetPanel } from './ui/DatasheetPanel';
import { Boot } from './ui/Boot';
import { Board2D } from './ui/Board2D';
import { Toast } from './ui/Toast';

// three.js, R3F and the whole scene live in this chunk; 2D mode never requests it.
const Scene = lazy(() => {
  useStore.getState().set({ boot: 0.12 });
  return import('./scene/Scene').then((m) => { useStore.getState().set({ boot: 0.38 }); return m; });
});

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { useStore.getState().set({ mode: '2d' }); }   // WebGL failed: fall back to the SVG board
  render() { return this.state.failed ? null : this.props.children; }
}

export default function App() {
  const mode = useStore((s) => s.mode);
  const ready = useStore((s) => s.sceneReady);
  const page = useStore((s) => s.page);
  const phase = useStore((s) => s.phase);
  const go = useGo();
  const loc = useLocation();
  const navigate = useNavigate();
  useRouteSync();

  // Esc: project detail -> project list -> MCU
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useStore.getState().phase === 'ride') return;
      if (document.querySelector('.lightbox')) return;
      const { page: p, slug } = pageFromPath(loc.pathname);
      if (slug) navigate('/projects'); else if (p !== 'home') go('home');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, loc.pathname, navigate]);

  return (
    <div className={`app mode-${mode} page-${page} phase-${phase}`}>
      <a className="skip" href="#content">Skip to content</a>
      <div className={`stage${mode === '3d' && ready ? ' is-ready' : ''}`} aria-hidden="true">
        {mode === '3d'
          ? <SceneBoundary><Suspense fallback={null}><Scene /></Suspense></SceneBoundary>
          : <Board2D />}
      </div>
      {mode === '3d' && <Boot />}
      <Header />
      <NavLabels />
      <DatasheetPanel />
      <Toast />
    </div>
  );
}
