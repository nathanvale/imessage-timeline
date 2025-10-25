import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    name: 'eslint/base',
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: { ...js.configs.recommended.rules },
  },

  ...tseslint.configs.recommended,

  // Enable type-aware checks by default for TypeScript files only
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    ...tseslint.configs.recommendedTypeChecked[0],
    languageOptions: {
      parserOptions: { project: ['./tsconfig.eslint.json'] },
    },
  },

  // Optional: enable when you want type-aware checks (slower).
  // ...tseslint.configs.recommendedTypeChecked,
  // {
  //   languageOptions: {
  //     parserOptions: { project: ['./tsconfig.json'] }
  //   }
  // },

  {
    name: 'project/custom',
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: {
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      'no-implicit-coercion': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',
      'no-unused-vars': 'off', // handled by TS
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/require-await': 'off',
      // Typed rules like no-floating-promises can be enabled with type-aware mode above
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // Relax rules for test files
  {
    name: 'project/tests',
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts', '__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },

  {
    name: 'project/ignores',
    ignores: ['dist/**', 'coverage/**', '.claude/**'],
  },
)
