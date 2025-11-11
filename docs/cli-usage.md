# CLI usage

The project provides a CLI named `imessage-timeline` for extracting, enriching,
and rendering iMessage conversations.

- Package name: `imessage-timeline`
- Executable: `imessage-timeline` (mapped via `bin` → `dist/cli.js`)

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
`imessage-timeline`:

```sh
# Global install (optional)
pnpm add -g imessage-timeline
imessage-timeline --help

# One-off execution without global install (when published)
pnpm dlx imessage-timeline --help
```

## Common flags (examples)

```sh
# Minimal config
imessage-timeline --config examples/imessage-config.yaml

# CSV ingest example
imessage-timeline ingest --csv ./path/to/messages.csv --out ./out

# Render timeline to HTML/markdown
imessage-timeline render --input ./out/normalized.json --format html
```

Refer to `--help` for the complete, authoritative list of commands and options.
