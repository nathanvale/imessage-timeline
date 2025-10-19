/**
 * Enhanced Prettier Configuration
 * Optimized for TypeScript CLI starter with file-specific formatting rules
 */

/** @type {import("prettier").Config} */
export default {
  // Base formatting rules
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'all',
  printWidth: 100,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',

  // Enhanced parser and plugin configuration
  // Note: Import sorting is handled by ESLint to avoid conflicts
  plugins: ['prettier-plugin-sort-json'],

  // JSON sorting configuration
  jsonRecursiveSort: true,

  // File-specific formatting overrides
  overrides: [
    // TypeScript and JavaScript files
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mts', '*.cts'],
      options: {
        parser: 'typescript',
        printWidth: 100,
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
        bracketSpacing: true,
        arrowParens: 'always',
      },
    },

    // JSON files - tighter formatting
    {
      files: ['*.json', '*.jsonc'],
      options: {
        parser: 'json',
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        trailingComma: 'none',
        bracketSpacing: false,
      },
    },

    // Package.json - special formatting for consistent dependency ordering
    {
      files: ['package.json', '**/package.json'],
      options: {
        parser: 'json-stringify',
        printWidth: 120,
        tabWidth: 2,
        trailingComma: 'none',
        bracketSpacing: false,
      },
    },

    // YAML files - preserve structure
    {
      files: ['*.yaml', '*.yml'],
      options: {
        parser: 'yaml',
        printWidth: 120,
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: true,
      },
    },

    // Markdown files - preserve prose formatting
    {
      files: ['*.md', '*.mdx'],
      options: {
        parser: 'markdown',
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        proseWrap: 'preserve',
        bracketSpacing: true,
        singleQuote: false,
        embeddedLanguageFormatting: 'auto',
      },
    },

    // HTML files
    {
      files: ['*.html', '*.htm'],
      options: {
        parser: 'html',
        printWidth: 120,
        tabWidth: 2,
        useTabs: false,
        bracketSameLine: false,
        htmlWhitespaceSensitivity: 'css',
        singleAttributePerLine: true,
      },
    },

    // CSS/SCSS files
    {
      files: ['*.css', '*.scss', '*.less'],
      options: {
        parser: 'css',
        printWidth: 120,
        tabWidth: 2,
        useTabs: false,
        singleQuote: true,
        trailingComma: 'none',
      },
    },

    // GraphQL files
    {
      files: ['*.graphql', '*.gql'],
      options: {
        parser: 'graphql',
        printWidth: 120,
        tabWidth: 2,
        useTabs: false,
      },
    },

    // Configuration files - specialized formatting
    {
      files: [
        '*.config.js',
        '*.config.mjs',
        '*.config.ts',
        'turbo.json',
        'tsconfig.json',
        '**/tsconfig.json',
        'eslint.config.*',
        '.eslintrc.*',
      ],
      options: {
        printWidth: 120,
        tabWidth: 2,
        trailingComma: 'all',
        bracketSpacing: true,
      },
    },

    // Test files - allow longer lines for describe blocks
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        '*.spec.ts',
        '*.spec.tsx',
        '*.spec.js',
        '*.spec.jsx',
        '**/__tests__/**/*',
        '**/tests/**/*',
      ],
      options: {
        printWidth: 120,
        tabWidth: 2,
        trailingComma: 'all',
      },
    },

    // Documentation files
    {
      files: ['CHANGELOG.md', 'README.md', 'CONTRIBUTING.md', 'LICENSE.md'],
      options: {
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2,
      },
    },

    // Scripts and tooling
    {
      files: ['scripts/**/*', 'tooling/**/*'],
      options: {
        printWidth: 100,
        tabWidth: 2,
        trailingComma: 'all',
        semi: false,
        singleQuote: true,
      },
    },
  ],
}
