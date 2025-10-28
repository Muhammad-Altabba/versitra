import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(import.meta.dirname),
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'server/**/*.test.ts',
      'server/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        'dist/',
        'drizzle/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './client/src'),
    },
  },
});
