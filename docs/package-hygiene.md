# Package Hygiene & Metadata Quality

This guide documents the metadata, packaging rules, and validation checks that
keep `chatline` high-quality, predictable, and easy to consume.

## Objectives

- Accurate and complete metadata on npm (discoverability, support, funding)
- Minimal, intentional publish surface (small tarball, no leaks)
- Strong type metadata with validation
- Automated checks in CI prior to releases

## package.json essentials

We follow npm guidance for top-level metadata fields:

- `name`, `version`, `description`
- `repository`, `bugs`, `homepage`
- `license`, `author`, `funding`
- `keywords`
- `type: module` with `exports` and `types`
- `bin` for CLI
- `engines` and `publishConfig` (with provenance)
- `files` whitelist and `sideEffects: false`

Current config includes:

- `exports` with ESM and `types` for `.`
- `files`: only `dist/**`, `README.md`, `LICENSE`, `CHANGELOG.md`
- `sideEffects: false` for better tree-shaking
- `publishConfig.provenance: true` for npm OIDC provenance

## Validation tools

- publint: Lints publish configuration for cross-env compatibility
- arethetypeswrong (attw): Validates type exports and TypeScript metadata

### Local usage

```bash
pnpm build
pnpm hygiene       # runs publint + attw
pnpm pack:dry      # creates tarball in ./.pack and lists its contents
```

### CI workflow

`.github/workflows/package-hygiene.yml` runs on PRs and manual dispatch:

- Harden-Runner (audit mode)
- Install, build
- publint + attw
- pnpm pack with artifact upload

## Checklist before publishing

- [ ] All public entrypoints defined in `exports`
- [ ] `types` points to generated `.d.ts` in `dist`
- [ ] `files` whitelist contains only what consumers need
- [ ] `README`, `LICENSE`, `CHANGELOG.md` included
- [ ] `bin` points at built CLI with shebang
- [ ] `engines.node` matches supported versions
- [ ] `repository`, `bugs`, `homepage`, `funding` set
- [ ] publint passes
- [ ] attw passes (no red flags)

## Tarball size and contents

We prefer small, predictable tarballs. Use `pnpm pack:dry` to inspect the exact
contents. If extra files slip in, tighten `files` or add `.npmignore` (subdirs
only).

## Types guidance

- Emit `.d.ts` files to `dist` and reference via top-level `types` and
  `exports["."].types`.
- Validate with `attw --pack` to simulate the published tarball’s types.
- Avoid unnecessary `typesVersions` unless targeting older TS versions.

## Security & provenance

- Stable release workflow generates SBOM and publishes with OIDC provenance.
- See `docs/security-supply-chain.md` for details and controls.

## References

- npm package.json docs (description, repository, bugs, homepage, files,
  exports)
- publint (publint.dev)
- AreTheTypesWrong (arethetypeswrong.github.io)

## Future enhancements

- SBOM parity in hygiene workflow (optional) to mirror stable release scans
- Tarball size gating: compute size and fail if exceeding a budget (e.g., 500
  KB)
- License scanning against an allowlist using the generated SBOM
- Strict publint settings once baseline is green; treat as blocking in CI
- Types quality: add a type test project to assert public API types compile
- OpenSSF Scorecard check for repository hygiene signals
- Log strategy: Use `logs/` (or hidden `.logs/` for local-only dev traces)
  ignored via `.gitignore`; prefer structured rotating files (e.g.
  `pipeline-YYYYMMDD.log`). Avoid committing transient logs—commit only curated
  audit data when explicitly needed.
