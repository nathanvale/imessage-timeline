import { resolve } from 'path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: './.vitest',
  resolve: {
    alias: {
      '#schema': resolve(__dirname, './src/schema'),
      '#ingest': resolve(__dirname, './src/ingest'),
      '#normalize': resolve(__dirname, './src/normalize'),
      '#enrich': resolve(__dirname, './src/enrich'),
      '#render': resolve(__dirname, './src/render'),
      '#utils': resolve(__dirname, './src/utils'),
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 20000,
    hookTimeout: 20000,
    // Prefer explicit imports over implicit globals for clarity
    globals: false,
    setupFiles: ['./tests/vitest/vitest-setup.ts'],
    include: ['**/*.{test,spec}.ts', '**/*.{test,spec}.tsx'],
    exclude: ['dist/**', '**/node_modules/**', '**/*.d.ts', 'website/**'],
    // Unified reporters with coverage summary in CI
    reporters: process.env.TF_BUILD ? ['junit', 'default'] : ['default'],
    ...(process.env.TF_BUILD
      ? { outputFile: { junit: './test-results/junit.xml' } }
      : {}),
    isolate: true,
    pool: 'threads',
    allowOnly: false,
    snapshotFormat: {
      // Stabilize Map/Set and plain object printing in snapshots
      printBasicPrototype: true,
    },
    onConsoleLog(log, _type) {
      // Reduce noise in CI/local for known benign warnings
      if (typeof log === 'string' && /MaxListenersExceededWarning/.test(log)) {
        return false
      }
      return undefined
    },
    coverage: {
      provider: 'v8',
      reporter: process.env.TF_BUILD
        ? ['text-summary', 'html', 'lcov']
        : ['text-summary', 'html'],
      reportsDirectory: process.env.TF_BUILD
        ? './test-results/coverage'
        : './coverage',
      exclude: [
        'src/**/*.d.ts',
        '**/*.test.*',
        'dist/**',
        'vitest.config.*',
        'tests/**',
      ],
      thresholds: {
        branches: 80,
        lines: 80,
        functions: 80,
        statements: 80,
        perFile: true,
      },
    },
    // Randomize order to catch hidden state coupling (stable seed in CI)
    sequence: {
      shuffle: true,
      ...(process.env.TF_BUILD ? { seed: 20251111 } : {}),
    },
    // Retry flaky tests only in CI (with low cap) – helps transient network mocks
    retry: process.env.TF_BUILD ? 2 : 0,
  },
})
