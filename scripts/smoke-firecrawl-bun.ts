#!/usr/bin/env bun
// Minimal Firecrawl SDK smoke check under Bun runtime
import FirecrawlApp from '@mendable/firecrawl-js'

// Firecrawl client expects string | null; env var is string | undefined
const apiKey: string | null = process.env.FIRECRAWL_API_KEY ?? null
if (!apiKey || apiKey === 'your-firecrawl-api-key-here') {
  console.error('FIRECRAWL_API_KEY not set; skipping Firecrawl smoke')
  process.exit(0)
}

async function main() {
  const app = new FirecrawlApp({ apiKey })
  const url = 'https://example.com'
  try {
    const res = await app.scrape(url)
    type ScrapeResponse = Record<string, unknown> & {
      metadata?: { title?: string }
    }
    if ('success' in res && (res as ScrapeResponse).success) {
      const title = (res as ScrapeResponse).metadata?.title ?? 'no-title'
      console.info('Firecrawl scrape success (Bun):', title)
    } else {
      console.warn(
        'Firecrawl scrape non-success (Bun):',
        (res as ScrapeResponse).error,
      )
    }
  } catch (err) {
    console.error('Firecrawl scrape error (Bun):', err)
  }
}

void main()
