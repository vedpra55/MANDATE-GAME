/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = Number(process.env.SERVER_PORT ?? 8787);

export default defineConfig({
  plugins: [react()],
  server: {
    // The browser only ever talks to /api; the server holds the OpenAI key.
    proxy: {
      '/api': `http://localhost:${SERVER_PORT}`,
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
});
