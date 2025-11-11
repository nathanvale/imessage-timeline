export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Remove hard line-length limits in commit body/footer to reduce friction
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
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
