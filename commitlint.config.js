export default {
  extends: ['@commitlint/config-conventional'],
  // Ignore commits that pre-date this setup
  ignores: [
    (message) => message.includes('[skip ci]'),
    (message) => message.startsWith('Initial commit'),
    (message) => message.startsWith('feat: migrate'),
    (message) => message.startsWith('invalid commit'),
  ],
}
