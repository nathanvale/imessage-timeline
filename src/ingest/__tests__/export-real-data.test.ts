import { describe, it, expect } from 'vitest'
import { ingestCSV } from '../ingest-csv'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import * as path from 'path'

describe('Export real data with actual modules', () => {
  it('should export CSV with real ingestCSV module', () => {
    const csvPath = path.join(
      '/Users/nathanvale/code/my-second-brain/02_Areas/Personal/Melanie & Relationship/data',
      'Messages - Melanie.csv'
    )

    // Use real ingestCSV
    const messages = ingestCSV(csvPath, { attachmentRoots: [] })

    // Filter to January 2025
    const janMessages = messages.filter(msg => {
      const date = new Date(msg.date)
      return date.getFullYear() === 2025 && date.getMonth() === 0
    })

    console.log(`✅ CSV export: ${janMessages.length} messages`)

    // Save export
    const outputDir = path.join('/Users/nathanvale/code/my-second-brain/output/csv-db-comparison')
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const csvPath2 = path.join(outputDir, 'csv-january-2025-real-module.json')
    writeFileSync(csvPath2, JSON.stringify(janMessages, null, 2))

    console.log(`Saved to: ${csvPath2}`)

    // Verify export
    expect(janMessages.length).toBeGreaterThan(0)
    expect(janMessages[0]).toHaveProperty('guid')
    expect(janMessages[0]).toHaveProperty('date')
    expect(janMessages[0]).toHaveProperty('messageKind')

    // Summary
    const textMsgs = janMessages.filter(m => m.messageKind === 'text').length
    const mediaMsgs = janMessages.filter(m => m.messageKind === 'media').length
    console.log(`\nSummary:`)
    console.log(`  Total: ${janMessages.length}`)
    console.log(`  Text: ${textMsgs}`)
    console.log(`  Media: ${mediaMsgs}`)
    console.log(`  Incoming: ${janMessages.filter(m => !m.isFromMe).length}`)
    console.log(`  Outgoing: ${janMessages.filter(m => m.isFromMe).length}`)
  })
})
