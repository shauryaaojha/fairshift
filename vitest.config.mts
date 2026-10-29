import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const alias = { '@': path.resolve('.') };

export default defineConfig({
  test: {
    // Two projects: logic runs in plain Node (fast), components and the IndexedDB outbox in jsdom.
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/offline/**'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.tsx', 'tests/offline/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/server/**', 'src/shared/**', 'src/lib/**'],
      exclude: [
        'src/server/domain/index.ts',
        // Thin MongoDB driver adapter: exercised against a live cluster, not in unit tests.
        'src/server/repos/mongo.ts',
        // Next.js request plumbing (cookies, redirect): covered through the actions that use it.
        'src/server/seed/index.ts',
      ],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
