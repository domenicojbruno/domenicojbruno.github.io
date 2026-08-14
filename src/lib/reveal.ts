// Entrance animations + nav highlighting, in two observers and no dependency.

const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      seen.unobserve(e.target); // entrances play once
    }
  },
  { rootMargin: '0px 0px -12% 0px' }
);
for (const el of document.querySelectorAll('.reveal')) seen.observe(el);

// Whichever section owns the middle of the viewport lights up in the rail and
// hands the rail its accent colour, so the nav shifts with the section.
const rail = document.querySelector<HTMLElement>('[data-rail]');
const links = new Map<string, HTMLElement>();
if (rail) {
  for (const a of rail.querySelectorAll<HTMLElement>('a[data-for]')) {
    links.set(a.dataset.for!, a);
  }
}

const active = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const link = links.get(e.target.id);
      if (!link) continue;
      link.classList.toggle('is-active', e.isIntersecting);
      if (e.isIntersecting && rail) {
        rail.dataset.theme = (e.target as HTMLElement).dataset.theme ?? '';
      }
    }
  },
  // A band across the middle of the screen: exactly one section can satisfy it.
  { rootMargin: '-45% 0px -45% 0px' }
);
for (const s of document.querySelectorAll('section[id]')) active.observe(s);
