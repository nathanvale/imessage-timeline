export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Remove hard line-length limits in commit body/footer to reduce friction
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
    // Keep header length reasonable but not draconian
    'header-max-length': [2, 'always', 100],
    // Encourage clear types and non-empty subject
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-empty': [2, 'never'],
  },
  // Ignore commits that pre-date this setup
  ignores: [
    (message) => message.includes('[skip ci]'),
    (message) => message.startsWith('Initial commit'),
    (message) => message.startsWith('feat: migrate'),
    (message) => message.startsWith('invalid commit'),
    // Ignore Dependabot-style commits like "Bump X from Y to Z"
    (message) => /^bump\s/i.test(message),
  ],
}
