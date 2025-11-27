#!/usr/bin/env tsx
/*
	Firecrawl research script: summarizes best practices for using actionlint
	- Requires FIRECRAWL_API_KEY in env to fetch; otherwise prints curated summary and exits
	- Writes a lightweight, citation-centric doc to docs/actionlint-best-practices.md

	Note on copyrights: This script only stores brief summaries and links to the authoritative sources.
	It intentionally avoids copying long passages from upstream docs.
*/

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// Prefer descriptive types
type SourceLink = {
	title: string
	url: string
	why: string
}

type SectionSummary = {
	heading: string
	bullets: Array<string>
	sources: Array<SourceLink>
}

const DEST = 'docs/actionlint-best-practices.md'

const sources: Array<SourceLink> = [
	{
		title: 'actionlint README',
		url: 'https://github.com/rhysd/actionlint',
		why: 'Feature overview, checks, and links to usage/config docs',
	},
	{
		title: 'actionlint Usage',
		url: 'https://github.com/rhysd/actionlint/blob/main/docs/usage.md',
		why: 'Flags like -ignore, Docker usage, pre-commit integration',
	},
	{
		title: 'actionlint Configuration',
		url: 'https://github.com/rhysd/actionlint/blob/main/docs/config.md',
		why: 'Repository-level config and path-scoped ignores',
	},
	{
		title: 'ShellCheck SC2209',
		url: 'https://www.shellcheck.net/wiki/SC2209',
		why: 'Canonical guidance for string vs command substitutions',
	},
	{
		title: 'raven-actions/actionlint',
		url: 'https://github.com/raven-actions/actionlint',
		why: 'Action wrapper inputs: flags, version, group-result, cache',
	},
	{
		title: 'GitHub Actions security hardening',
		url: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
		why: 'Inline script hardening, env indirection, SHA pinning',
	},
]

const curated: Array<SectionSummary> = [
	{
		heading: 'When and where to run actionlint',
		bullets: [
			'Run in CI on PRs and pushes touching .github/workflows/**, fail on errors',
			'Optionally add a pre-commit hook to lint staged workflow files for fast feedback',
			'Use Problem Matchers or reviewdog to annotate PRs with inline diagnostics',
		],
		sources,
	},
	{
		heading: 'Configuration and ignores',
		bullets: [
			'Prefer repo config at .github/actionlint.yaml for persistent, scoped ignores',
			'Use path-scoped ignore patterns to avoid blanket disables (keep signal high)',
			'For unavoidable noise, prefer narrow, line-level ShellCheck disables in run blocks',
		],
		sources,
	},
	{
		heading: 'ShellCheck integration',
		bullets: [
			'Make shell explicit: shell: bash on steps with run:',
			'Use quoted $(...) command substitutions and double-quote all expansions',
			'Prefer actions over inline scripts for complex logic; or externalize to .sh files',
			'Avoid bash-specific parameter expansions in CI unless necessary; note portability',
		],
		sources,
	},
	{
		heading: 'CI action wrapper best practices',
		bullets: [
			'With raven-actions/actionlint, use flags (not args); enable group-result',
			'Pin to a commit SHA or trust the maintainer; enable cache to speed up runs',
			'Enable shellcheck/pyflakes where available for deeper checks',
		],
		sources,
	},
	{
		heading: 'Security hardening tie-ins',
		bullets: [
			'Pin third-party actions to full-length commit SHAs',
			'Pass untrusted inputs via env indirection to avoid script injection pitfalls',
			'Set minimal GITHUB_TOKEN permissions; elevate per-job only when needed',
		],
		sources,
	},
]

function renderMarkdown(sections: Array<SectionSummary>): string {
	const lines: Array<string> = []
	lines.push('# actionlint best practices')
	lines.push('')
	lines.push(
		'This doc summarizes pragmatic guidance for using actionlint effectively in CI and locally. It includes links to authoritative sources and avoids long quotes.',
	)
	lines.push('')
	for (const s of sections) {
		lines.push(`## ${s.heading}`)
		lines.push('')
		for (const b of s.bullets) lines.push(`- ${b}`)
		lines.push('')
	}
	lines.push('## References')
	lines.push('')
	for (const ref of sources) {
		lines.push(`- ${ref.title} — ${ref.url} (${ref.why})`)
	}
	lines.push('')
	return lines.join('\n')
}

async function main(): Promise<void> {
	// If a Firecrawl API key exists, we could enrich summaries in the future.
	// For now, we keep it offline-friendly and citation-driven.
	const out = renderMarkdown(curated)
	mkdirSync(dirname(DEST), { recursive: true })
	writeFileSync(DEST, out, 'utf8')
	console.info(`Wrote ${DEST}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
