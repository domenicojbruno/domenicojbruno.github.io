import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// User GitHub Pages site (domenicojbruno.github.io) is served from the domain
// root, so `base` stays '/'. For a project site, set base to '/<repo>/'.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1400,
  },
});
