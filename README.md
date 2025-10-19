# modern-ts-cli-starter

A modern, batteries-included TypeScript CLI starter template with best practices built-in.

## Features

- **TypeScript 5.9+** with strict mode and modern ESM
- **Node.js 22.20+** with native ESM support
- **tsc-only build** — No bundlers, just TypeScript compiler
- **ESLint v9** with flat config system
- **Prettier 3** with JSON sorting plugin
- **Vitest** for fast, modern testing
- **Changesets** for versioning and changelogs
- **Husky** for Git hooks (commitlint, pre-commit quality checks)
- **Environment variables** via Node's `--env-file` flag
- **GitHub Actions** ready with dependabot
- **Quality checks** with @orchestr8/quality-check

## Quick Start

1. **Use this template** by clicking "Use this template" on GitHub, or clone it:
   ```bash
   git clone git@github.com:nathanvale/modern-ts-cli-starter.git my-cli
   cd my-cli
   ```

2. **Customize your project:**
   ```bash
   # Update package.json with your details
   # - name
   # - description
   # - keywords
   # - bin commands
   # - repository URL
   ```

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

4. **Build and test:**
   ```bash
   pnpm build
   pnpm test
   ```

5. **Run your CLI:**
   ```bash
   # Copy example env
   cp .env.example .env

   # Run with example env
   node --env-file=.env.example ./dist/cli.js --help
   ```

## Project Structure

```
modern-ts-cli-starter/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── index.ts            # Library entry point
│   └── __tests__/          # Tests
├── .changeset/             # Changesets configuration
├── .github/                # GitHub Actions workflows
├── .husky/                 # Git hooks
├── tests/vitest/           # Vitest setup
├── dist/                   # Compiled output (git-ignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── prettier.config.mjs
└── README.md
```

## Available Scripts

### Development
- `pnpm build` — Compile TypeScript to `dist/`
- `pnpm clean` — Remove build artifacts
- `pnpm dev -- <args>` — Build and run CLI with arguments
- `pnpm start` — Run the built CLI

### Code Quality
- `pnpm lint` — Run ESLint
- `pnpm lint:fix` — Run ESLint with auto-fix
- `pnpm format` — Format code with Prettier
- `pnpm quality-check` — Run comprehensive quality checks
- `pnpm quality-check:ci` — Quality checks for CI (only changed files)

### Testing
- `pnpm test` — Run tests once
- `pnpm test:watch` — Run tests in watch mode
- `pnpm coverage` — Generate coverage report

### Versioning & Publishing
- `pnpm version:gen` — Create a changeset for versioning
- `pnpm release` — Publish to npm (usually triggered by CI)

## CLI Usage Examples

```bash
# After building
node --env-file=.env ./dist/cli.js --help

# Greet command
node --env-file=.env ./dist/cli.js greet --name "World"

# Environment command
node --env-file=.env ./dist/cli.js env

# After publishing to npm
npx your-cli-name greet --name "World"
```

## Customization Guide

### 1. Update Package Info

Edit `package.json`:
```json
{
  "name": "your-cli-name",
  "description": "Your CLI description",
  "bin": {
    "your-cli": "./dist/cli.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/your-cli-name"
  }
}
```

### 2. Add Your Commands

Edit `src/cli.ts` to add your commands. The starter uses a simple command pattern:

```typescript
// Add your command logic
if (args.includes('your-command')) {
  console.log('Your command executed!');
  process.exit(0);
}
```

For more complex CLIs, consider adding a proper CLI framework like [commander](https://www.npmjs.com/package/commander) or [yargs](https://www.npmjs.com/package/yargs).

### 3. Environment Variables

Add your environment variables to `.env.example` and document them:

```bash
# .env.example
MY_STARTER_TOKEN=replace-me
API_URL=https://api.example.com
```

Users will copy this to `.env` for local development.

### 4. Git Hooks

The template includes pre-configured hooks:
- **pre-commit**: Runs quality checks on staged files
- **commit-msg**: Enforces conventional commit messages

Customize in `.husky/` if needed.

## Publishing to NPM

1. **Create a changeset** when you make changes:
   ```bash
   pnpm version:gen
   # Follow the prompts to describe your changes
   ```

2. **Version and publish** (typically done via CI):
   ```bash
   pnpm changeset version  # Updates version in package.json
   pnpm build
   pnpm release           # Publishes to npm
   ```

## GitHub Actions

The template includes:
- **Dependabot** configuration for dependency updates (`.github/dependabot.yml`)

You may want to add:
- CI workflow for testing/linting on PRs
- Release workflow that publishes on changeset PR merge
- Automated release notes

## Why This Stack?

- **tsc-only**: Simpler, faster, fewer dependencies than bundlers
- **ESM**: Modern JavaScript, better tree-shaking
- **ESLint flat config**: New standard, more flexible
- **Vitest**: Fast, modern, great DX
- **Changesets**: Professional versioning and changelog
- **Node --env-file**: Native env support, no need for dotenv package

## Requirements

- Node.js >= 22.20
- pnpm (recommended) or npm

## License

MIT

---

**Ready to build something awesome?** Start by editing `src/cli.ts` and make it your own!
