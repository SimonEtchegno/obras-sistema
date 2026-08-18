import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// El front vive en web/ y se compila a dist/, que es lo que sirve Express
// (app.js) y lo que publica Vercel. El backend Express de src/ queda intacto.
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Durante el desarrollo, /api/... va al Express de siempre (node server.js).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
