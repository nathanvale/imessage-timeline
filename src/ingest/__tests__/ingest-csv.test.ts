import { describe, it, expect, beforeAll } from 'vitest'
import { ingestCSV, parseCSVRow, convertToISO8601, validateMessages, CSVRow } from '../ingest-csv'
import * as path from 'path'
import { readFileSync } from 'fs'

describe('ingest-csv', () => {
  describe('parseCSVRow - iMazing CSV format', () => {
    // AC01: Parse iMazing CSV rows with correct field mapping
    it('should parse incoming SMS message correctly', () => {
      const row: CSVRow = {
        'Chat Session': 'Melanie',
        'Message Date': '2023-10-21 11:06:22',
        'Delivered Date': '',
        'Read Date': '2023-10-21 17:26:02',
        'Edited Date': '',
        'Service': 'SMS',
        'Type': 'Incoming',
        'Sender ID': '+61412667520',
        'Sender Name': 'Melanie',
        'Status': 'Read',
        'Replying to': '',
        'Subject': '',
        'Text': 'Hey Nathan, how are you?',
        'Attachment': '',
        'Attachment type': '',
      }

      const messages = parseCSVRow(row, 2, { attachmentRoots: [] })

      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        guid: 'csv:2:0',
        messageKind: 'text',
        text: 'Hey Nathan, how are you?',
        handle: 'Melanie',
        isFromMe: false,
        service: 'SMS',
        isRead: true,
      })
    })

    it('should parse outgoing iMessage correctly', () => {
      const row: CSVRow = {
        'Chat Session': 'Melanie',
        'Message Date': '2023-10-22 08:30:00',
        'Delivered Date': '2023-10-22 08:30:05',
        'Read Date': '2023-10-22 08:35:00',
        'Edited Date': '',
        'Service': 'iMessage',
        'Type': 'Outgoing',
        'Sender ID': 'Nathan',
        'Sender Name': 'Nathan',
        'Status': 'Read',
        'Replying to': '',
        'Subject': '',
        'Text': 'That sounds great! 😊',
        'Attachment': '',
        'Attachment type': '',
      }

      const messages = parseCSVRow(row, 3, { attachmentRoots: [] })

      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        guid: 'csv:3:0',
        messageKind: 'text',
        isFromMe: true,
        service: 'iMessage',
        dateDelivered: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    })

    it('should handle messages with attachment (unresolved path)', () => {
      const row: CSVRow = {
        'Chat Session': 'Melanie',
        'Message Date': '2023-10-21 15:00:00',
        'Delivered Date': '',
        'Read Date': '',
        'Edited Date': '',
        'Service': 'iMessage',
        'Type': 'Outgoing',
        'Sender ID': 'Nathan',
        'Sender Name': 'Nathan',
        'Status': 'Delivered',
        'Replying to': '',
        'Subject': '',
        'Text': 'Check out this photo',
        'Attachment': 'IMG_001.jpg',
        'Attachment type': 'image/jpeg',
      }

      // With empty attachmentRoots, path cannot be resolved, so no media message created
      const messages = parseCSVRow(row, 4, { attachmentRoots: [] })

      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        guid: 'csv:4:0',
        messageKind: 'text',
        text: 'Check out this photo',
      })
    })

    it('should skip attachment without resolvable path', () => {
      const row: CSVRow = {
        'Chat Session': 'Melanie',
        'Message Date': '2023-10-21 15:00:00',
        'Service': 'iMessage',
        'Type': 'Outgoing',
        'Sender Name': 'Nathan',
        'Text': 'Photo below',
        'Attachment': 'IMG_002.jpg',
        'Attachment type': 'image/jpeg',
      } as any

      const messages = parseCSVRow(row, 5, { attachmentRoots: [] })

      // Should only have text message, not media (path unresolved)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.messageKind).toBe('text')
    })

    // AC02: Determine messageKind and isFromMe from Type field
    it('should set isFromMe=true for Outgoing/Sent types', () => {
      const row: CSVRow = {
        'Type': 'Sent',
        'Message Date': '2023-10-21 11:00:00',
        'Text': 'Test',
      } as any

      const messages = parseCSVRow(row, 5, { attachmentRoots: [] })

      expect(messages[0]?.isFromMe).toBe(true)
    })

    it('should set isFromMe=false for Incoming type', () => {
      const row: CSVRow = {
        'Type': 'Incoming',
        'Message Date': '2023-10-21 11:00:00',
        'Text': 'Test',
        'Sender Name': 'Melanie',
      } as any

      const messages = parseCSVRow(row, 6, { attachmentRoots: [] })

      expect(messages[0]?.isFromMe).toBe(false)
    })

    // AC03: Convert CSV dates to ISO 8601 UTC with Z suffix
    it('should convert CSV dates correctly to ISO 8601', () => {
      const row: CSVRow = {
        'Chat Session': 'Test',
        'Message Date': '2023-10-21 11:06:22',
        'Read Date': '2023-10-21 17:26:02',
        'Type': 'Incoming',
        'Sender Name': 'Test',
        'Text': 'Hello',
      } as any

      const messages = parseCSVRow(row, 7, { attachmentRoots: [] })

      expect(messages[0]?.date).toBe('2023-10-21T11:06:22.000Z')
      expect(messages[0]?.dateRead).toBe('2023-10-21T17:26:02.000Z')
    })

    it('should skip rows with invalid dates', () => {
      const row: CSVRow = {
        'Message Date': 'invalid-date',
        'Text': 'Hello',
      } as any

      const messages = parseCSVRow(row, 8, { attachmentRoots: [] })

      expect(messages).toHaveLength(0)
    })

    it('should handle empty date fields gracefully', () => {
      const row: CSVRow = {
        'Message Date': '2023-10-21 11:00:00',
        'Delivered Date': '',
        'Read Date': '',
        'Type': 'Incoming',
        'Sender Name': 'Test',
        'Text': 'Hello',
      } as any

      const messages = parseCSVRow(row, 9, { attachmentRoots: [] })

      expect(messages[0]?.dateDelivered).toBeUndefined()
      expect(messages[0]?.dateRead).toBeUndefined()
    })

    // AC04: Preserve metadata like sender name, service type
    it('should preserve service field', () => {
      const row: CSVRow = {
        'Message Date': '2023-10-21 11:00:00',
        'Service': 'SMS',
        'Type': 'Incoming',
        'Sender Name': 'Melanie',
        'Text': 'Hello',
      } as any

      const messages = parseCSVRow(row, 10, { attachmentRoots: [] })

      expect(messages[0]?.service).toBe('SMS')
    })

    it('should set isRead based on Status field', () => {
      const readRow: CSVRow = {
        'Message Date': '2023-10-21 11:00:00',
        'Status': 'Read',
        'Type': 'Incoming',
        'Sender Name': 'Melanie',
        'Text': 'Hello',
      } as any

      const unreadRow: CSVRow = {
        'Message Date': '2023-10-21 11:00:00',
        'Status': 'Unread',
        'Type': 'Incoming',
        'Sender Name': 'Melanie',
        'Text': 'Hello',
      } as any

      const readMessages = parseCSVRow(readRow, 11, { attachmentRoots: [] })
      const unreadMessages = parseCSVRow(unreadRow, 12, { attachmentRoots: [] })

      expect(readMessages[0]?.isRead).toBe(true)
      expect(unreadMessages[0]?.isRead).toBe(false)
    })

    // AC05: Preserve row metadata for provenance
    it('should include exportMetadata with source and lineNumber', () => {
      const row: CSVRow = {
        'Message Date': '2023-10-21 11:00:00',
        'Type': 'Incoming',
        'Sender Name': 'Melanie',
        'Text': 'Hello',
      } as any

      const messages = parseCSVRow(row, 42, { attachmentRoots: [] })

      expect(messages[0]?.exportMetadata).toMatchObject({
        source: 'csv',
        lineNumber: 42,
        csvGuid: 'csv:42:0',
      })
    })

    it('should include replyingTo in metadata when present', () => {
      const row: CSVRow = {
        'Message Date': '2023-10-21 11:00:00',
        'Type': 'Incoming',
        'Sender Name': 'Melanie',
        'Text': 'I agree!',
        'Replying to': 'csv:40:0',
      } as any

      const messages = parseCSVRow(row, 41, { attachmentRoots: [] })

      expect(messages[0]?.exportMetadata?.replyingTo).toBe('csv:40:0')
    })
  })

  describe('convertToISO8601', () => {
    it('should convert "YYYY-MM-DD HH:MM:SS" to ISO 8601 Z format', () => {
      const result = convertToISO8601('2023-10-21 11:06:22')
      expect(result).toBe('2023-10-21T11:06:22.000Z')
    })

    it('should handle empty strings', () => {
      const result = convertToISO8601('')
      expect(result).toBeNull()
    })

    it('should handle whitespace-only strings', () => {
      const result = convertToISO8601('   ')
      expect(result).toBeNull()
    })

    it('should handle invalid date formats', () => {
      const result = convertToISO8601('not-a-date')
      expect(result).toBeNull()
    })

    it('should return valid ISO string that parses correctly', () => {
      const result = convertToISO8601('2023-10-21 11:06:22')
      const date = new Date(result!)
      expect(date.getUTCFullYear()).toBe(2023)
      expect(date.getUTCMonth()).toBe(9) // 0-indexed
      expect(date.getUTCDate()).toBe(21)
    })
  })

  describe('validateMessages', () => {
    it('should validate messages against schema', () => {
      const row: CSVRow = {
        'Message Date': '2023-10-21 11:00:00',
        'Type': 'Incoming',
        'Sender Name': 'Melanie',
        'Text': 'Hello',
      } as any

      const messages = parseCSVRow(row, 1, { attachmentRoots: [] })
      const result = validateMessages(messages)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Integration with actual Melanie CSV', () => {
    let csvPath: string
    const expectedMinMessages = 100 // Sanity check - should have at least 100 messages

    beforeAll(() => {
      csvPath = path.join(
        '/Users/nathanvale/code/my-second-brain/02_Areas/Personal/Melanie & Relationship/data',
        'Messages - Melanie.csv'
      )
    })

    it('should ingest actual Melanie CSV file without errors', () => {
      try {
        const messages = ingestCSV(csvPath, { attachmentRoots: [] })

        expect(messages).toBeDefined()
        expect(messages.length).toBeGreaterThan(expectedMinMessages)
        expect(Array.isArray(messages)).toBe(true)
      } catch (error) {
        throw new Error(`Failed to ingest Melanie CSV: ${error}`)
      }
    })

    it('should parse all messages with valid dates', () => {
      const messages = ingestCSV(csvPath, { attachmentRoots: [] })

      const messagesWithoutDates = messages.filter((m) => !m.date)
      expect(messagesWithoutDates).toHaveLength(0)

      // All dates should be ISO 8601 with Z suffix
      const validDates = messages.every((m) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.date))
      expect(validDates).toBe(true)
    })

    it('should have mix of incoming and outgoing messages', () => {
      const messages = ingestCSV(csvPath, { attachmentRoots: [] })

      const outgoing = messages.filter((m) => m.isFromMe)
      const incoming = messages.filter((m) => !m.isFromMe)

      expect(outgoing.length).toBeGreaterThan(0)
      expect(incoming.length).toBeGreaterThan(0)
    })

    it('should handle SMS and iMessage service types', () => {
      const messages = ingestCSV(csvPath, { attachmentRoots: [] })

      const services = [...new Set(messages.map((m) => m.service))]
      expect(services.length).toBeGreaterThan(0)
    })

    it('should validate all ingested messages against schema', () => {
      const messages = ingestCSV(csvPath, { attachmentRoots: [] })
      const result = validateMessages(messages)

      if (!result.valid) {
        console.error('Validation errors:', result.errors.slice(0, 5))
      }
      expect(result.valid).toBe(true)
    })

    it('should have correct GUID format for all messages', () => {
      const messages = ingestCSV(csvPath, { attachmentRoots: [] })

      const guidPattern = /^csv:\d+:/
      const validGuids = messages.every((m) => guidPattern.test(m.guid))
      expect(validGuids).toBe(true)
    })

    it('should track read status correctly', () => {
      const messages = ingestCSV(csvPath, { attachmentRoots: [] })

      // At least some messages should be marked as read
      const readMessages = messages.filter((m) => m.isRead === true)
      expect(readMessages.length).toBeGreaterThan(0)
    })

    it('should preserve handle/sender names', () => {
      const messages = ingestCSV(csvPath, { attachmentRoots: [] })

      const handles = [...new Set(messages.map((m) => m.handle))].filter(Boolean)
      expect(handles.length).toBeGreaterThan(0)
      expect(handles.some((h) => h?.includes('Melanie'))).toBe(true)
    })
  })
})
