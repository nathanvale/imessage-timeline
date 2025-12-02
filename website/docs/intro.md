---
id: intro
title: Getting Started
sidebar_label: Introduction
sidebar_position: 1
---

# iMessage Timeline

Welcome to the iMessage Timeline documentation! This tool helps you extract,
enrich, and render your iMessage conversations into beautiful, interactive
timelines.

## What is iMessage Timeline?

iMessage Timeline is a command-line tool and library that:

- **Extracts** messages from your iMessage database
- **Enriches** messages with context (link previews, metadata, AI summaries)
- **Renders** conversations into various formats (HTML, JSON, etc.)
- **Normalizes** links and handles special message types

## Quick Start

### Installation

```bash
npm install -g chatline
```

### Basic Usage

```bash
# Extract messages from a conversation
chatline extract --conversation "John Doe"

# Enrich messages with link context
chatline enrich --input messages.json

# Render to HTML
chatline render --input enriched.json --output timeline.html
```

## Key Features

### 🔍 Smart Extraction

- Direct access to iMessage database
- Conversation filtering and search
- Attachment handling
- Date range filtering

### 🎨 Rich Enrichment

- AI-powered message summaries (Gemini, Claude)
- Link preview generation
- URL normalization and deduplication
- Context extraction from shared links

### 📊 Flexible Rendering

- Multiple output formats
- Customizable templates
- Timeline visualization
- Export to various formats

### 🔒 Privacy First

- All processing happens locally
- No data sent to external services (unless using AI features)
- Full control over your data

## Documentation Structure

- **[CLI Usage](./cli-usage.md)** - Command-line interface guide
- **Pipeline** - Technical specifications and usage
  - [Tech Spec](./imessage-pipeline-tech-spec.md)
  - [Usage Guide](./imessage-pipeline-usage.md)
  - [Troubleshooting](./imessage-pipeline-troubleshooting.md)
- **Best Practices** - Development and configuration guides
  - [Testing](./testing-best-practices.md)
  - [Security](./security-supply-chain.md)
  - [CI/CD](./ci-workflow-standards.md)
- **Releases** - Version management and release process
  - [Changesets Guide](./releases/changesets-canonical.md)
  - [Pre-Release Guide](./pre-release-guide.md)
  - [Release Channels](./release-channels.md)

## Contributing

This project uses:

- **pnpm** for package management
- **TypeScript** for type safety
- **Vitest** for testing
- **Changesets** for version management
- **GitHub Actions** for CI/CD

See the individual documentation pages for detailed information on each topic.

## Support

- [GitHub Issues](https://github.com/nathanvale/chatline/issues)
- [GitHub Discussions](https://github.com/nathanvale/chatline/discussions)

## License

MIT License - see LICENSE file for details
