import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '#schema': resolve(__dirname, './src/schema'),
      '#ingest': resolve(__dirname, './src/ingest'),
      '#normalize': resolve(__dirname, './src/normalize'),
      '#enrich': resolve(__dirname, './src/enrich'),
      '#render': resolve(__dirname, './src/render'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/vitest/vitest-setup.ts'],
    include: ['**/*.{test,spec}.ts', '**/*.{test,spec}.tsx'],
    exclude: ['dist/**', 'node_modules/**', '**/*.d.ts'],
    reporters: process.env.TF_BUILD ? ['junit', 'default'] : ['default'],
    ...(process.env.TF_BUILD ? { outputFile: { junit: './test-results/junit.xml' } } : {}),
    isolate: true,
    pool: 'threads',
    poolOptions: { threads: { maxThreads: 8, minThreads: 1 } },
    allowOnly: false,
    coverage: {
      provider: 'v8',
      reporter: process.env.TF_BUILD ? ['text-summary', 'html', 'lcov'] : ['text-summary', 'html'],
      reportsDirectory: process.env.TF_BUILD ? './test-results/coverage' : './coverage',
      exclude: ['src/**/*.d.ts', '**/*.test.*', 'dist/**', 'vitest.config.*'],
      thresholds: { branches: 70, lines: 70, functions: 70, statements: 70 },
    },
  },
})
