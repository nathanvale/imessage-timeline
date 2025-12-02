# Dual-Mode Distribution Best Practices

## Overview

This document provides comprehensive guidance on distributing
**chatline** as both a **CLI tool** and a **library package**. It
synthesizes research from official TypeScript and Node.js documentation to
ensure best practices for dual-mode packages.

## Research Foundation

- **TypeScript Documentation**: Explored 60+ package.json configuration examples
  from TypeScript's test baselines, covering conditional exports, ESM/CJS dual
  distributions, and types resolution
- **Node.js Official Packages API**: Complete Node.js v25.1.0 package.json
  specification including exports, bin, main, and conditional exports patterns
- **Key Findings**: Modern Node.js (v12+) with `exports` field provides superior
  encapsulation and subpath control compared to legacy `main`-only
  configurations

---

## Package Architecture

### Dual Entry Points Strategy

The package provides **two distinct entry points**:

1. **CLI Entry Point**: Executable binary for command-line usage
   - **Field**: `bin`
   - **Target**: `./dist/cli.js`
   - **Usage**: `npx chatline` or `chatline` (when installed
     globally)

2. **Library Entry Point**: Module exports for programmatic usage
   - **Fields**: `main`, `exports`, `types`
   - **Target**: `./dist/index.js` (runtime), `./dist/index.d.ts` (types)
   - **Usage**: `import { loadConfig } from 'chatline'`

### Current Configuration Analysis

```json
{
  "bin": {
    "chatline": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "name": "chatline",
  "type": "module",
  "types": "./dist/index.d.ts"
}
```

**Status**: ✅ **Already optimal** for dual-mode distribution

---

## Best Practices from Research

### 1. Module Type Declaration

```json
{
  "type": "module"
}
```

**Why**: Declares all `.js` files as ES modules. This is **essential** for
Node.js v12+ to correctly interpret imports and prevent CommonJS/ESM conflicts.

**Alternatives**:

- `.mjs` extensions force ESM (regardless of `type` field)
- `.cjs` extensions force CommonJS (regardless of `type` field)

**Our Choice**: Use `"type": "module"` with `.js` extensions for simplicity and
consistency.

---

### 2. Exports Field (Modern Standard)

The `exports` field is the **recommended approach** for defining package entry
points in Node.js v12+.

#### Benefits

1. **Encapsulation**: Prevents importing internal modules (e.g.,
   `require('pkg/internal/utils')`)
2. **Conditional Exports**: Different entry points for `import` vs `require`
3. **Subpath Patterns**: Control which subpaths are accessible
4. **Types Integration**: Direct TypeScript declaration file mapping

#### Pattern: Main Entry Point

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Research Insight**: The `"types"` condition should **always be first** in the
condition object (per TypeScript community conventions and Runtime Keys
proposal).

#### Pattern: Exposing package.json

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./package.json": "./package.json"
  }
}
```

**Why**: Allows consumers to read package metadata (e.g., for version checks)
without breaking encapsulation.

#### Pattern: Subpath Exports (Optional)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./config": "./dist/config/index.js",
    "./utils": "./dist/utils/index.js"
  }
}
```

**When to Use**: For large packages where exposing organized subpaths improves
tree-shaking and reduces bundle size. Not necessary for small/medium packages.

#### Pattern: Wildcard Subpath Exports (Advanced)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./config/*": "./dist/config/*.js",
    "./utils/*": "./dist/utils/*.js"
  }
}
```

**When to Use**: For packages with many submodules. Allows
`import { x } from 'pkg/config/loader.js'` without enumerating every file.

**Trade-offs**: Less explicit API surface, harder to track breaking changes.

---

### 3. Main Field (Backward Compatibility)

```json
{
  "main": "./dist/index.js"
}
```

**Why**: Provides fallback for Node.js v10 and older tools that don't support
`exports` field.

**Behavior**: When both `main` and `exports` are present, modern Node.js
**prefers `exports`**, but older environments fall back to `main`.

**Best Practice**: Always include both `main` and `exports` pointing to the same
entry file for maximum compatibility.

---

### 4. Types Field

```json
{
  "types": "./dist/index.d.ts"
}
```

**Why**: Defines the TypeScript declaration entry point for the package.

**Relationship with `exports`**:

- If `exports` includes a `"types"` condition, it takes precedence
- If `exports` doesn't specify `"types"`, TypeScript falls back to the top-level
  `"types"` field

**Best Practice**: Include both:

1. Top-level `"types"` for legacy TypeScript versions
2. `"types"` condition in `exports` for modern resolution

---

### 5. Bin Field (CLI Support)

```json
{
  "bin": {
    "chatline": "./dist/cli.js"
  }
}
```

**Requirements**:

1. **Executable Shebang**: First line of `dist/cli.js` must be
   `#!/usr/bin/env node`
2. **File Permissions**: Must be executable (`chmod +x dist/cli.js`) or npm will
   handle this automatically during install
3. **Separate from Library**: CLI entry point should be distinct from library
   entry point

**Multiple Binaries** (if needed):

```json
{
  "bin": {
    "chatline": "./dist/cli.js",
    "imt": "./dist/cli.js"
  }
}
```

---

### 6. Files Field (Distribution Control)

```json
{
  "files": ["dist/**", "README.md", "LICENSE", "CHANGELOG.md"]
}
```

**Why**: Controls which files are included when publishing to npm. Keeps package
size minimal.

**Note**: `package.json` is **always included** automatically.

---

## Conditional Exports Deep Dive

### Condition Order (Critical)

Conditions are matched **top-to-bottom**, so order matters:

```json
{
  "exports": {
    ".": {
      "default": "./dist/index.js", // 5. Fallback
      "import": "./dist/index.mjs", // 3. ESM import
      "node": "./dist/index.node.js", // 2. Node.js-specific
      "require": "./dist/index.cjs", // 4. CommonJS require
      "types": "./dist/index.d.ts" // 1. Types (TypeScript)
    }
  }
}
```

**Best Practice Order** (from TypeScript and Runtime Keys proposal):

1. `"types"` — TypeScript declaration files
2. Platform-specific (`"node"`, `"browser"`, `"deno"`, etc.)
3. Module format (`"import"`, `"require"`, `"module-sync"`)
4. `"default"` — Always last, as universal fallback

---

### Common Condition Use Cases

#### Import vs Require (Dual Module Support)

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

**When to Use**: When supporting both ESM (`import`) and CommonJS (`require`)
consumers.

**Our Case**: Not needed — we only distribute ESM (via `"type": "module"`).

#### Node.js vs Browser

```json
{
  "exports": {
    ".": {
      "browser": "./dist/index.browser.js",
      "default": "./dist/index.js",
      "node": "./dist/index.node.js"
    }
  }
}
```

**When to Use**: When providing different implementations for server vs browser
environments.

**Our Case**: Not needed — CLI tool is Node.js-only.

#### Development vs Production

```json
{
  "exports": {
    ".": {
      "default": "./dist/index.js",
      "development": "./dist/index.dev.js",
      "production": "./dist/index.prod.js"
    }
  }
}
```

**When to Use**: When providing debug-enabled builds for development.

**Activation**: `node --conditions=development index.js`

**Our Case**: Not needed for MVP, but useful for future enhanced logging.

---

## Subpath Imports (Internal Package Aliases)

### Current Configuration

```json
{
  "imports": {
    "#enrich/*": "./src/enrich/*",
    "#ingest/*": "./src/ingest/*",
    "#normalize/*": "./src/normalize/*",
    "#render/*": "./src/render/*",
    "#schema/*": "./src/schema/*"
  }
}
```

**Purpose**: Creates internal aliases for use **within the package itself**, not
exposed to consumers.

**Requirements**:

- All imports must start with `#`
- Used in source files: `import { Message } from '#schema/message.js'`

**Benefits**:

1. Shorter import paths within the codebase
2. Easy refactoring (change mapping in one place)
3. No impact on consumers (not exported)

**Note**: These are **not** accessible to library consumers — they're
internal-only.

---

## Self-Referencing (Package Name Imports)

### Feature: Importing from Own Package

When `exports` is defined, modules **inside the package** can import using the
package name:

```typescript
// Inside src/some-module.ts
import { loadConfig } from 'chatline'
```

Instead of relative imports:

```typescript
import { loadConfig } from '../config/loader.js'
```

**Requirements**:

1. Must have `"name"` field in package.json
2. Must have `"exports"` field defined
3. Only works for paths explicitly listed in `exports`

**When to Use**:

- Testing internal APIs from the consumer's perspective
- Ensuring consistency between internal and external imports

**Our Case**: Useful for tests, but relative imports are fine for source code.

---

## TypeScript Configuration for Dual Distribution

### tsconfig.json Settings

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Key Settings**:

1. **`module: "NodeNext"`**: Matches Node.js ES module resolution
2. **`moduleResolution: "NodeNext"`**: Enables `exports` field support
3. **`declaration: true`**: Generates `.d.ts` files
4. **`declarationMap: true`**: Enables "Go to Definition" in consumers' editors

### Source File Extensions

**Current**: `.ts` files (source) → `.js` files (compiled)

**Recommendations**:

- Keep `.ts` for source files (simplicity)
- Use `.js` extensions in imports: `import './foo.js'` (not `'./foo'`)

**Why**: TypeScript requires explicit extensions in ESM mode when using
`moduleResolution: NodeNext`.

---

## API Design Best Practices for Dual Distribution

### 1. Clear Entry Point (src/index.ts)

```typescript
/**
 * Public API for chatline library
 *
 * This package can be used both as:
 * 1. CLI tool: `npx chatline --help`
 * 2. Library: `import { loadConfig } from 'chatline'`
 */

// Export only public APIs
export { loadConfig, generateConfigContent } from './config/index.js'
export type { Config } from './config/schema.js'

// Do NOT export internal utilities unless needed
```

**Guidelines**:

- Document dual-use nature at the top
- Export only stable public APIs
- Use JSDoc comments for each export
- Group exports by feature/module

### 2. Separate CLI and Library Code

**Pattern**:

```
src/
  cli.ts          ← CLI entry point (Commander, arg parsing)
  index.ts        ← Library entry point (public API exports)
  config/         ← Shared logic (used by both CLI and library)
  utils/          ← Shared utilities
```

**Benefits**:

- CLI-specific dependencies (e.g., Commander) don't pollute library consumers
- Clear separation of concerns
- Easier to maintain and test independently

### 3. Avoid CLI-Only Code in Library Exports

**Bad**:

```typescript
// src/index.ts (BAD)
export { parseCliArgs } from './cli.js' // ❌ CLI-specific
```

**Good**:

```typescript
// src/index.ts (GOOD)
export { loadConfig } from './config/loader.js' // ✅ Useful in library
```

**Reason**: Library consumers don't need CLI argument parsing logic.

---

## Testing Dual Distribution

### 1. Test CLI Usage

```bash
# Local development
bun src/cli.ts --help

# After build
node dist/cli.js --help

# As installed package
npx chatline --help
```

### 2. Test Library Import

```typescript
// test-library-import.ts
import { loadConfig } from 'chatline'

const config = loadConfig('path/to/config.yaml')
console.log('Config loaded:', config)
```

Run:

```bash
bun test-library-import.ts
```

### 3. Test Package.json Exports

```bash
# Ensure only exported paths work
node -e "import('chatline').then(console.log)"           # ✅ Should work
node -e "import('chatline/config').then(console.log)"    # ❌ Should fail (not exported)
node -e "import('chatline/package.json').then(console.log)" # ✅ Should work (explicitly exported)
```

---

## Publishing Checklist

### Pre-Publish Validation

1. **Build Check**:

   ```bash
   bun run build
   ls -lh dist/  # Verify cli.js and index.js exist
   ```

2. **Shebang Check**:

   ```bash
   head -n 1 dist/cli.js  # Should be #!/usr/bin/env node
   ```

3. **TypeScript Types Check**:

   ```bash
   ls -lh dist/*.d.ts  # Verify .d.ts files generated
   ```

4. **Files Check**:

   ```bash
   npm pack --dry-run  # Preview what will be published
   ```

5. **Exports Validation**:
   ```bash
   node --input-type=module -e "import('chatline').then(m => console.log(Object.keys(m)))"
   ```

### Package.json Final Check

```json
{
  "bin": { "chatline": "./dist/cli.js" },
  "engines": { "node": ">=22.20" },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./package.json": "./package.json"
  },

  "files": ["dist/**", "README.md", "LICENSE"],
  "main": "./dist/index.js",
  "name": "chatline",
  "type": "module",

  "types": "./dist/index.d.ts",

  "version": "1.0.0"
}
```

---

## Common Pitfalls and Solutions

### Issue 1: CLI Not Executable After Install

**Symptom**: `command not found: chatline` after `npm install -g`

**Solution**:

1. Verify `bin` field points to correct file
2. Ensure `#!/usr/bin/env node` is first line of CLI file
3. Check file permissions: `ls -l dist/cli.js` (should show `x` flag)

---

### Issue 2: Cannot Find Module When Importing

**Symptom**: `ERR_MODULE_NOT_FOUND` when importing from library

**Solution**:

1. Verify `exports` field includes `".": "./dist/index.js"`
2. Check TypeScript compiled files to `dist/`
3. Ensure `"type": "module"` is set
4. Use `.js` extensions in import paths (even in TypeScript)

---

### Issue 3: TypeScript Types Not Found

**Symptom**: `Could not find a declaration file for module 'chatline'`

**Solution**:

1. Verify `"types": "./dist/index.d.ts"` in package.json
2. Add `"types"` condition to `exports` field
3. Check `dist/` contains `.d.ts` files
4. Ensure `tsconfig.json` has `"declaration": true`

---

### Issue 4: Internal Paths Exposed

**Symptom**: Consumers can import `require('pkg/internal/secret.js')`

**Solution**:

1. Use `exports` field to restrict paths
2. Do NOT include `"./internal/*"` in exports
3. Test with: `node -e "import('chatline/internal/file.js')"`
   - Should throw `ERR_PACKAGE_PATH_NOT_EXPORTED`

---

## Advanced Patterns (Future Considerations)

### 1. Subpath Exports for Large Packages

If the package grows significantly, consider exposing organized subpaths:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./config": "./dist/config/index.js",
    "./enrich": "./dist/enrich/index.js",
    "./ingest": "./dist/ingest/index.js",
    "./render": "./dist/render/index.js"
  }
}
```

**Benefits**:

- Tree-shaking: Import only needed modules
- Clear API boundaries
- Easier versioning and deprecation

**Trade-offs**:

- More maintenance (must update for each new subpath)
- Potential breaking changes if internal structure changes

---

### 2. Conditional Exports for Minified Builds

```json
{
  "exports": {
    ".": {
      "default": "./dist/index.js",
      "development": "./dist/index.js",
      "production": "./dist/index.min.js"
    }
  }
}
```

**Activation**: `node --conditions=production index.js`

---

### 3. Dual ESM/CJS Distribution

If CommonJS support becomes necessary:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "type": "module"
}
```

**Requirements**:

1. Compile to both `.mjs` (ESM) and `.cjs` (CommonJS)
2. Handle dual package hazards (see Node.js documentation)
3. Significant complexity increase

**Recommendation**: Avoid unless there's strong demand for CJS support.

---

## Summary

### Current Status: ✅ Excellent

The package is **already configured optimally** for dual CLI + library
distribution:

- ✅ Separate `bin` and `main` entry points
- ✅ Modern `exports` field with types integration
- ✅ Backward-compatible `main` fallback
- ✅ ESM-only distribution (`"type": "module"`)
- ✅ Internal package aliases via `imports`
- ✅ Proper `files` field for distribution control

### No Breaking Changes Needed

All current configurations align with best practices from TypeScript and Node.js
official documentation.

### Recommendations for src/index.ts

1. **Complete API Exports**: Ensure all intended public functions/types are
   exported
2. **Clear Documentation**: Add JSDoc comments for each major export
3. **Verify Import Paths**: Fix any import errors (e.g., missing `.js`
   extensions)

### Next Steps

1. Fix import errors in `src/index.ts` (detailed in next section)
2. Update README with dual-mode usage examples
3. Test both CLI and library usage patterns
4. Publish to npm with confidence 🚀

---

## Appendix: Research Sources

### TypeScript Documentation

- **Source**: microsoft/typescript repository test baselines
- **Key Files**:
  - `nodeModulesDeclarationEmitWithPackageExports`
  - `conditionalExportsResolution*`
  - `nodeModulesExports*`
- **Coverage**: 60+ conditional exports examples, ESM/CJS dual patterns, types
  resolution strategies

### Node.js Documentation

- **Source**: Node.js v25.1.0 official Packages API documentation
- **URL**: https://nodejs.org/api/packages.html
- **Key Sections**:
  - Package entry points (main, exports, bin)
  - Conditional exports and community conditions
  - Subpath exports and subpath patterns
  - Module resolution algorithms (CommonJS vs ESM)
  - Self-referencing and package imports

### Community Standards

- **Runtime Keys Proposal** (WinterCG): Defines standard condition keys for
  cross-runtime compatibility
- **TypeScript Handbook**: Module resolution strategies for package authors
- **NPM Documentation**: Publishing best practices and package.json field
  definitions

---

## Appendix: Quick Reference Card

### Minimal Dual-Mode Package

```json
{
  "bin": { "my-cli": "./dist/cli.js" },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "main": "./dist/index.js",
  "name": "my-package",
  "type": "module",
  "types": "./dist/index.d.ts",
  "version": "1.0.0"
}
```

### CLI Entry Point Template

```typescript
#!/usr/bin/env node

import { Command } from 'commander'
import { doSomething } from './library-code.js'

const program = new Command()
program
  .name('my-cli')
  .description('CLI tool description')
  .action(() => {
    doSomething()
  })

program.parse()
```

### Library Entry Point Template

```typescript
/**
 * Public API for my-package
 *
 * Can be used as:
 * - CLI: npx my-package
 * - Library: import { doSomething } from 'my-package'
 */

export { doSomething } from './library-code.js'
export type { SomeType } from './types.js'
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Author**: GitHub Copilot + TypeScript/Node.js Official Documentation  
**Review Status**: Ready for Implementation ✅
