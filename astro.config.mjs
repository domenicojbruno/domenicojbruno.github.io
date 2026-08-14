// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // User GitHub Pages site, so it is served from the domain root and needs no
  // `base`. Drives canonical links and the absolute og:image URL.
  site: 'https://domenicojbruno.github.io',
});
