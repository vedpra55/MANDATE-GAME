/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = Number(process.env.SERVER_PORT ?? 8787);
// The browser only ever talks to /api; the server holds the OpenAI key.
const proxy = { '/api': `http://localhost:${SERVER_PORT}` };

export default defineConfig({
  plugins: [react()],
  server: {
    proxy,
    // Only the game's own code should wake the dev server. The asset pipeline's output (hundreds
    // of large PNGs), the server's saved settings and the tools are never part of the page.
    watch: {
      ignored: ['**/tools/**', '**/server/**', '**/.claude/**', '**/dist/**'],
    },
  },
  // `npm run play`: the built game, no file watching, no hot reload.
  preview: { proxy },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'tools/**/*.test.mjs'],
    environment: 'node',
  },
});
