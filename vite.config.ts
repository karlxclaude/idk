/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@engine': r('./engine'),
      '@data': r('./data'),
      '@ui': r('./ui'),
      '@minigames': r('./minigames'),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'threads',
  },
});
