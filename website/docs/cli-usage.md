---
id: cli-usage
title: CLI Usage
sidebar_label: CLI
sidebar_position: 2
---

# CLI usage

The project provides a CLI named `chatline` for extracting, enriching,
and rendering iMessage conversations.

- Package name: `chatline`
- Executable: `chatline` (mapped via `bin` → `dist/cli.js`)

## Local development

- Run from TypeScript via Bun (fast inner loop):

  ```sh
  pnpm dev -- --help
  pnpm dev -- --config examples/imessage-config.yaml
  ```

  Notes:
  - Everything after `--` is passed through to the CLI.
  - Requires Bun installed locally. See https://bun.sh

- Run the built CLI from `dist`:

  ```sh
  pnpm build
  pnpm cli -- --help
  ```

## Installed usage (after publish)

Once installed globally or used via `pnpm dlx`, the CLI is available as
`chatline`:

```sh
# Global install (optional)
pnpm add -g /chatline
chatline --help

# One-off execution without global install (when published)
pnpm dlx /chatline --help
```

## Common flags (examples)

```sh
# Minimal config
chatline --config examples/imessage-config.yaml

# CSV ingest example
chatline ingest --csv ./path/to/messages.csv --out ./out

# Render timeline to HTML/markdown
chatline render --input ./out/normalized.json --format html
```

Refer to `--help` for the complete, authoritative list of commands and options.
