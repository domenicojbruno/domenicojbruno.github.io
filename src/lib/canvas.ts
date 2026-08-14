// Shared plumbing for every canvas on the site: HiDPI sizing, resize handling,
// pausing when scrolled out of view, and honouring reduced-motion by painting
// exactly one frame. Written once here so no individual visual has to remember.

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

/**
 * `animate: false` skips the rAF loop — for plots that only change when an
 * input does. Call the returned `repaint()` then.
 */
export function mountCanvas(canvas: HTMLCanvasElement, draw: Draw, animate = true) {
  const ctx = canvas.getContext('2d')!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, raf = 0, start = performance.now();

  const paint = (now: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, (now - start) / 1000);
  };

  const frame = (now: number) => {
    paint(now);
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const size = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    paint(performance.now());
  };

  new ResizeObserver(size).observe(canvas);

  // An animation nobody can see is pure battery drain.
  new IntersectionObserver(([e]) => {
    if (still || !animate) return;
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(frame);
    else if (!e.isIntersecting && raf) stop();
  }).observe(canvas);

  return { repaint: () => paint(performance.now()) };
}

/** Reads a CSS custom property off an element — lets canvases follow the theme. */
export const cssVar = (el: Element, name: string) =>
  getComputedStyle(el).getPropertyValue(name).trim();
