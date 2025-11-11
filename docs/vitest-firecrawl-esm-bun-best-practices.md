# Vitest + Firecrawl ESM & Bun Best Practices for CLI Projects

**Research Date:** 11 November 2025  
**Sources:** Context7 (Vitest & Firecrawl official docs)  
**Project Type:** TypeScript CLI tool with ESM modules

## Executive Summary

This document provides authoritative best practices for configuring Vitest in an
ESM-based CLI project that uses Bun for development and Firecrawl SDK
integration. Key findings:

1. **Current setup is solid** — Single-project Vitest config with proper ESM
   alias support
2. **Bun for dev, Node for tests** — Correct separation (Bun runtime for CLI,
   Vitest on Node for stability)
3. **Firecrawl SDK is ESM-ready** — `@mendable/firecrawl-js` works with Node.js
   ESM and Bun
4. **jsdom v25** — Downgraded from v27 to avoid parse5 ESM/CJS issues (✅
   resolved)

---

## 1. Vitest Configuration Best Practices

### 1.1 Current Setup Analysis

```typescript
// vitest.config.ts (current)
export default defineConfig({
  resolve: {
    alias: {
      '#schema': resolve(__dirname, './src/schema'),
      // ... other path aliases
    },
  },
  test: {
    environment: 'jsdom',
    pool: 'threads',
    isolate: true,
    globals: true,
    setupFiles: ['./tests/vitest/vitest-setup.ts'],
    // ... coverage, reporters
  },
})
```

**✅ What's working well:**

- Path aliases correctly mirror `package.json` imports field
- `pool: 'threads'` with `maxThreads: 8` — optimal for CI and local
- `isolate: true` — prevents test state leakage (recommended for CLI tools)
- Coverage thresholds enforced with `perFile: true`
- Conditional CI reporters (JUnit + coverage)

**⚠️ Considerations:**

- No projects array — fine for single-environment testing
- `globals: true` — convenient but discouraged in modern Vitest (prefer explicit
  imports)

### 1.2 ESM Module Best Practices

**From Vitest docs:**

1. **Always use `import.meta.url` for path resolution in ESM:**

   ```typescript
   // ✅ Correct (ESM-safe)
   alias: {
     '@/': new URL('./src/', import.meta.url).pathname
   }

   // ❌ Avoid __dirname (requires polyfill in pure ESM)
   ```

2. **For CLI projects, avoid `globals: true`:**

   ```typescript
   // Preferred modern approach
   import { describe, it, expect } from 'vitest'

   describe('my test', () => {
     it('should work', () => {
       expect(1).toBe(1)
     })
   })
   ```

3. **Use `defineConfig` from 'vitest/config' (not 'vite'):**
   - Already correct in current setup ✅

### 1.3 Projects Configuration (Optional Enhancement)

**When to use `projects`:**

- Separate unit vs integration tests
- Different environments (node vs jsdom)
- Parallel test execution with distinct configs

**Example for CLI tool:**

```typescript
export default defineConfig({
  test: {
    projects: [
      {
        name: 'unit',
        isolate: false, // Faster for pure unit tests
        include: ['src/**/*.test.ts'],
        exclude: ['**/*.integration.test.ts'],
        environment: 'node', // CLI doesn't need jsdom
      },
      {
        name: 'integration',
        include: ['**/*.integration.test.ts'],
        environment: 'jsdom', // If testing HTML/DOM scenarios
        testTimeout: 30000,
      },
    ],
  },
})
```

**For this project:** Current single-config approach is fine unless you need:

- Separate timeouts for slow integration tests
- Different reporters per test type
- Parallel execution of unit vs integration

---

## 2. Bun Integration Best Practices

### 2.1 Current Approach (✅ Correct)

**Development (Bun):**

```json
{
  "dev": "bun src/cli.ts",
  "validate:json": "bun scripts/validate-json.ts"
}
```

**Testing (Node/Vitest):**

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Why this works:**

- Bun excels at fast TypeScript execution (dev inner loop)
- Vitest on Node ensures deterministic test environment (CI stability)
- Native addons (sharp, better-sqlite3) work predictably on Node

### 2.2 Vitest + Bun Considerations

**From Vitest docs:**

- Vitest can run under Bun (`bunx vitest`) but it's experimental
- Pool options (`threads`, `forks`) behave differently under Bun
- Coverage with V8 provider requires Node runtime

**Recommendation:** Keep tests on Node (current setup ✅)

### 2.3 Path Alias Resolution

**Current aliases work because:**

1. `vitest.config.ts` mirrors `package.json` imports
2. Both Bun and Vitest resolve `#schema/*` correctly
3. No need for `tsconfig-paths` plugin (aliases in Vite config handle it)

**If using `baseUrl` in tsconfig:**

```typescript
// Would need this plugin
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()], // Resolves tsconfig baseUrl/paths
})
```

Not needed for this project (using imports field ✅)

---

## 3. Firecrawl SDK Integration

### 3.1 SDK Installation & ESM Compatibility

**Current SDK:**

```json
{
  "dependencies": {
    "@mendable/firecrawl-js": "^4.3.7"
  }
}
```

**✅ ESM-ready:** Package exports ESM and works with:

- Node.js with `"type": "module"`
- Bun runtime
- TypeScript with `moduleResolution: "bundler"`

### 3.2 Usage Patterns for CLI Tools

**Initialization (Node/Bun compatible):**

```typescript
import Firecrawl from '@mendable/firecrawl-js'

const app = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
})
```

**Scraping:**

```typescript
const doc = await app.scrape('https://example.com', {
  formats: ['markdown', 'html'],
})
```

**Crawling (async with status checks):**

```typescript
// Start crawl
const crawl = await app.startCrawl('https://example.com', {
  limit: 100,
  scrapeOptions: { formats: ['markdown'] },
})

// Check status
const status = await app.getCrawlStatus(crawl.id)
```

**Extract structured data (with Zod):**

```typescript
import { z } from 'zod'

const schema = z.object({
  title: z.string(),
  content: z.string(),
})

const result = await app.extract({
  urls: ['https://example.com'],
  schema,
  prompt: 'Extract title and content',
})
```

### 3.3 Testing Firecrawl Integration

**Mock approach in tests:**

```typescript
import { vi } from 'vitest'
import Firecrawl from '@mendable/firecrawl-js'

vi.mock('@mendable/firecrawl-js')

describe('link enrichment', () => {
  it('should fetch link context', async () => {
    const mockScrape = vi.fn().mockResolvedValue({
      markdown: '# Test Content',
    })

    vi.mocked(Firecrawl).mockImplementation(() => ({
      scrape: mockScrape,
    }))

    // Test your code that uses Firecrawl
  })
})
```

**Real integration tests:**

```typescript
// tests/integration/firecrawl.integration.test.ts
import { describe, it, expect } from 'vitest'
import Firecrawl from '@mendable/firecrawl-js'

describe('Firecrawl integration', { timeout: 30000 }, () => {
  it('should scrape real URL', async () => {
    const app = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
    const result = await app.scrape('https://firecrawl.dev')

    expect(result.markdown).toBeDefined()
  })
})
```

**Conditional execution (CI vs local):**

```typescript
describe.skipIf(!process.env.FIRECRAWL_API_KEY)('Firecrawl live tests', () => {
  // Only runs if API key is set
})
```

---

## 4. CLI-Specific Testing Patterns

### 4.1 CLI Command Testing

**Vitest approach for CLI tools:**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { Command } from 'commander'

describe('CLI commands', () => {
  it('should parse --help flag', async () => {
    const program = new Command()
    // Set up your CLI

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation()
    const logSpy = vi.spyOn(console, 'log').mockImplementation()

    await program.parseAsync(['node', 'cli.js', '--help'])

    expect(logSpy).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
```

### 4.2 File System Testing

**Use memfs for deterministic FS tests:**

```typescript
import { fs } from 'memfs'
import { vol } from 'memfs'

vi.mock('fs')
vi.mock('fs/promises')

beforeEach(() => {
  vol.reset()
  vol.fromJSON({
    '/test/input.json': '{"messages": []}',
  })
})
```

**Already set up in `__mocks__/fs.cjs` ✅**

### 4.3 Environment Variable Testing

```typescript
import { beforeEach, afterEach } from 'vitest'

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  originalEnv = process.env
  process.env = { ...originalEnv }
})

afterEach(() => {
  process.env = originalEnv
})

it('should use API key from env', () => {
  process.env.FIRECRAWL_API_KEY = 'test-key'
  // Test code
})
```

---

## 5. Coverage & CI Best Practices

### 5.1 Current Coverage Config (✅ Strong)

```typescript
coverage: {
  provider: 'v8',         // Fastest, best for ESM
  all: true,              // Track untested files
  perFile: true,          // Enforce per-file thresholds
  thresholds: {
    branches: 75,
    lines: 80,
    functions: 80,
    statements: 80,
  },
}
```

### 5.2 CI-Specific Enhancements

**Conditional reporters:**

```typescript
reporters: process.env.TF_BUILD
  ? ['junit', 'default']
  : ['default'],
```

**Parallel execution in CI:**

```typescript
poolOptions: {
  threads: {
    maxThreads: process.env.CI ? 4 : 8, // Limit in CI
    minThreads: 1,
  },
},
```

**Fail fast for CI:**

```typescript
test: {
  bail: process.env.CI ? 1 : undefined, // Stop on first failure in CI
}
```

---

## 6. Recommendations & Action Items

### 6.1 Keep Current (✅ No changes needed)

1. **Vitest on Node runtime** — stable, deterministic
2. **Bun for CLI dev** — fast, TypeScript-native
3. **Path aliases** — working correctly
4. **Coverage setup** — comprehensive
5. **jsdom v25** — stable, no ESM issues

### 6.2 Optional Enhancements

#### A. Remove `globals: true` (modern Vitest pattern)

**Before:**

```typescript
test: {
  globals: true,
}
```

**After:**

```typescript
// vitest.config.ts
test: {
  // Remove globals: true
}

// In test files
import { describe, it, expect, vi } from 'vitest'
```

**Benefits:**

- Explicit imports (better for tree-shaking)
- No global pollution
- TypeScript inference works better

#### B. Add `projects` for unit vs integration split (optional)

```typescript
test: {
  projects: [
    {
      name: 'unit',
      isolate: false,
      include: ['src/**/*.test.ts'],
      exclude: ['**/*.integration.test.ts'],
    },
    {
      name: 'integration',
      include: ['**/*.integration.test.ts'],
      testTimeout: 30000,
    },
  ],
}
```

**Run specific project:**

```bash
pnpm test --project unit
pnpm test --project integration
```

#### C. Add Firecrawl integration test suite

**Create:** `tests/integration/firecrawl.integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import Firecrawl from '@mendable/firecrawl-js'

describe.skipIf(!process.env.FIRECRAWL_API_KEY)(
  'Firecrawl integration',
  { timeout: 30000 },
  () => {
    const app = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! })

    it('should scrape real URL', async () => {
      const result = await app.scrape('https://firecrawl.dev')
      expect(result.markdown).toBeDefined()
    })

    it('should extract structured data', async () => {
      const result = await app.extract({
        urls: ['https://firecrawl.dev'],
        prompt: 'Extract page title',
        schema: { type: 'object', properties: { title: { type: 'string' } } },
      })
      expect(result.data).toBeDefined()
    })
  },
)
```

**Run:**

```bash
FIRECRAWL_API_KEY=fc-xxx pnpm test --project integration
```

---

## 7. Common Issues & Solutions

### Issue 1: ESM import errors in tests

**Symptom:**

```
Error: require() of ES Module not supported
```

**Fix:**

- Ensure `"type": "module"` in package.json ✅ (current)
- Use dynamic `import()` for ESM-only packages
- Check jsdom version (v27 has parse5 ESM issues) ✅ (fixed with v25)

### Issue 2: Path aliases not resolving

**Symptom:**

```
Cannot find module '#schema/message'
```

**Fix:**

- Ensure aliases in `vitest.config.ts` match `package.json` imports ✅
- Use `resolve(__dirname, ...)` or `new URL(..., import.meta.url).pathname`
- Consider `vite-tsconfig-paths` plugin if using `baseUrl`

### Issue 3: Firecrawl SDK timeout in tests

**Symptom:**

```
Test timed out after 5000ms
```

**Fix:**

```typescript
describe('slow tests', { timeout: 30000 }, () => {
  // ...
})
```

Or in `vitest.config.ts`:

```typescript
test: {
  testTimeout: 20000, // Already set ✅
}
```

---

## 8. References

**Vitest Documentation:**

- [Vitest Config Reference](https://vitest.dev/config/) — Authoritative config
  options
- [ESM Projects](https://vitest.dev/guide/migration.html) — ESM best practices
- [Projects Feature](https://vitest.dev/guide/projects.html) — Multi-project
  setup
- [Coverage](https://vitest.dev/guide/coverage.html) — V8 provider setup

**Firecrawl Documentation:**

- [Node.js SDK](https://github.com/mendableai/firecrawl/tree/main/apps/js-sdk/firecrawl)
  — Official SDK docs
- [API Reference](https://docs.firecrawl.dev/) — REST API endpoints
- [Examples](https://github.com/mendableai/firecrawl/tree/main/examples) —
  Integration patterns

**Bun Documentation:**

- [Bun Test Runner](https://bun.sh/docs/cli/test) — Bun's native test runner
- [Bun vs Node](https://bun.sh/docs/runtime/nodejs-apis) — Compatibility matrix

---

## Conclusion

Your current setup follows Vitest and Firecrawl best practices for ESM + CLI
projects:

1. ✅ **Vitest on Node** — Stable, deterministic testing
2. ✅ **Bun for dev** — Fast TypeScript execution
3. ✅ **ESM-first** — Proper module resolution
4. ✅ **Path aliases** — Correctly configured
5. ✅ **Coverage enforced** — V8 provider with thresholds
6. ✅ **Firecrawl SDK** — ESM-compatible, tested

**Optional improvements:**

- Remove `globals: true` for modern explicit imports
- Add `projects` array for unit/integration split
- Create Firecrawl integration test suite

**No breaking changes needed** — current config is solid for a CLI tool with ESM
modules.
