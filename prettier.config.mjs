/**
 * Enhanced Prettier Configuration
 * Optimized for TypeScript CLI starter with file-specific formatting rules
 */

/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'all',
  printWidth: 80,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-sort-json'],
  jsonRecursiveSort: true,
  overrides: [
    {
      files: ['package.json', '**/package.json'],
      options: { parser: 'json-stringify', printWidth: 80 },
    },
    {
      files: ['*.json', '*.jsonc'],
      options: { parser: 'json', trailingComma: 'none' },
    },
    {
      files: ['*.md', '*.mdx'],
      options: { proseWrap: 'always' },
    },
    {
      files: ['*.test.*', '**/__tests__/**/*'],
      options: { printWidth: 100 },
    },
  ],
}
