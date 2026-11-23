import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://127.0.0.1:8000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Built files are served by Laravel from backend/public/spa
  base: command === 'build' ? '/spa/' : '/',
  server: {
    port: 5173,
    proxy: { '/api': backend, '/sanctum': backend },
  },
  build: { outDir: '../backend/public/spa', emptyOutDir: true },
}));
