/*
  WallabyJS Configuration for imessage-timeline
  Purpose: Fast feedback loop + alignment with Vitest deterministic settings.
*/

/* eslint-env node */
/* eslint-disable */
/**
 * WallabyJS Configuration (CommonJS)
 * Mirrors Vitest settings for fast in-editor feedback.
 */
module.exports = function (wallaby) {
  return {
    files: [
      'src/**/*.ts',
      'tests/vitest/**/*.ts',
      'tests/helpers/**/*.ts',
      '__tests__/fixtures/**/*.ts',
      'tsconfig.base.json',
      'tsconfig.json',
      'package.json'
    ],
    tests: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/*.test.ts',
      '__tests__/**/*.ts'
    ],
    env: {
      type: 'node',
      runner: 'node'
    },
    setup () {
      const { vi } = require('vitest')
      vi.resetAllMocks()
      vi.clearAllMocks()
      vi.useRealTimers()
    },
    compilers: {
      '**/*.ts': wallaby.compilers.typeScript({ module: 'esnext', target: 'es2022' })
    },
    slowTestThreshold: 750,
    hints: { ignoreCoverage: [/node_modules/] },
    workers: { initial: 2, regular: 2 },
    debug: false
  }
}
