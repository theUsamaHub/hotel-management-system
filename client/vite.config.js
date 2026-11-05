import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:5000' } },
  build: { rollupOptions: { output: { manualChunks: { motion: ['framer-motion'] } } } },
  test: {
    // Bound concurrent jsdom environments to avoid CPU starvation on development machines.
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/tests/**', 'src/main.jsx'],
    },
  },
});
