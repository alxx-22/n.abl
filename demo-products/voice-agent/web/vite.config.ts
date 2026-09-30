// The React app. The Node server runs Vite inside itself in development
// (`npm run dev`, one port, hot reload) and serves web/dist in production
// (`npm run build`, then `npm start`).

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Everything lives under /demo, the path the site's Worker forwards (nabl.agency/demo/*).
  base: '/demo/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', sourcemap: true },
});
