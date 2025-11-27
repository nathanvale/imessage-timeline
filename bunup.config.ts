import { defineConfig } from 'bunup'

// External dependencies - everything else gets bundled
const external = [
	'@google/generative-ai',
	'@mendable/firecrawl-js',
	'better-sqlite3',
	'cli-progress',
	'commander',
	'csv-parse',
	'csv-stringify',
	'js-yaml',
	'pino',
	'sharp',
	'zod',
]

export default defineConfig([
	{
		name: 'main',
		entry: './src/index.ts',
		outDir: './dist',
		format: 'esm',
		dts: true,
		clean: true,
		external,
		splitting: false, // Bundle internal modules into single file
	},
	{
		name: 'cli',
		entry: './src/cli.ts',
		outDir: './dist',
		format: 'esm',
		dts: false, // CLI doesn't need declarations
		external,
		splitting: false, // Bundle internal modules into single file
		// Shebang is already in src/cli.ts
	},
])
