import { writeFileSync, mkdirSync, existsSync } from 'fs'
import * as path from 'path'

import { describe, it, expect } from 'vitest'

import { ingestCSV } from '../ingest-csv'

describe.skip('Export real data with actual modules', () => {
  it('should export CSV with real ingestCSV module', () => {
    const csvPath = path.join(
      '/Users/nathanvale/code/my-second-brain/02_Areas/Personal/Melanie & Relationship/data',
      'Messages - Melanie.csv',
    )

    // Use real ingestCSV
    const messages = ingestCSV(csvPath, { attachmentRoots: [] })

    // Filter to January 2025
    const janMessages = messages.filter((msg) => {
      const date = new Date(msg.date)
      return date.getFullYear() === 2025 && date.getMonth() === 0
    })

    console.info(`✅ CSV export: ${janMessages.length} messages`)

    // Save export
    const outputDir = path.join('/Users/nathanvale/code/my-second-brain/output/csv-db-comparison')
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const csvPath2 = path.join(outputDir, 'csv-january-2025-real-module.json')
    writeFileSync(csvPath2, JSON.stringify(janMessages, null, 2))

    console.info(`Saved to: ${csvPath2}`)

    // Verify export
    expect(janMessages.length).toBeGreaterThan(0)
    expect(janMessages[0]).toHaveProperty('guid')
    expect(janMessages[0]).toHaveProperty('date')
    expect(janMessages[0]).toHaveProperty('messageKind')

    // Summary
    const textMsgs = janMessages.filter((m) => m.messageKind === 'text').length
    const mediaMsgs = janMessages.filter((m) => m.messageKind === 'media').length
    console.info(`\nSummary:`)
    console.info(`  Total: ${janMessages.length}`)
    console.info(`  Text: ${textMsgs}`)
    console.info(`  Media: ${mediaMsgs}`)
    console.info(`  Incoming: ${janMessages.filter((m) => !m.isFromMe).length}`)
    console.info(`  Outgoing: ${janMessages.filter((m) => m.isFromMe).length}`)
  })
})
