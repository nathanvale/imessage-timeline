/**
 * Fixture Loading Helpers (CI-T04-AC03)
 *
 * Utilities for loading and managing JSON message dataset fixtures.
 * Provides consistent fixture loading across test suites with type safety.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { Message } from '../../src/schema/message'

// ============================================================================
// Type Definitions
// ============================================================================

export type FixtureOptions = {
  /** Base directory for fixtures (default: tests/fixtures) */
  baseDir?: string
  /** Whether to parse JSON (default: true) */
  parseJson?: boolean
  /** Whether to throw on missing file (default: true) */
  throwOnMissing?: boolean
}

export type MessageFixture = {
  messages: Message[]
  metadata?: {
    source?: string
    count?: number
    dateRange?: {
      start: string
      end: string
    }
  }
}

// ============================================================================
// Core Fixture Loading Functions
// ============================================================================

/**
 * Loads a JSON fixture file from the tests/fixtures directory
 *
 * @param filename - Name of the fixture file (relative to fixtures dir)
 * @param options - Loading options
 * @returns Parsed JSON content
 *
 * @example
 * const data = loadFixture('messages/small-dataset.json')
 * const csv = loadFixture('csv/melanie-messages.csv', { parseJson: false })
 */
export function loadFixture<T = any>(filename: string, options: FixtureOptions = {}): T {
  const {
    baseDir = resolve(process.cwd(), 'tests/fixtures'),
    parseJson = true,
    throwOnMissing = true,
  } = options

  const fullPath = resolve(baseDir, filename)

  if (!existsSync(fullPath)) {
    if (throwOnMissing) {
      throw new Error(`Fixture file not found: ${fullPath}`)
    }
    return null as T
  }

  const content = readFileSync(fullPath, 'utf-8')

  if (parseJson) {
    try {
      return JSON.parse(content) as T
    } catch (error) {
      throw new Error(
        `Failed to parse JSON fixture ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  return content as T
}

/**
 * Loads a message dataset fixture with type safety
 *
 * @param filename - Name of the message fixture file
 * @returns Message array with metadata
 *
 * @example
 * const { messages, metadata } = loadMessageFixture('small-dataset.json')
 * console.log(`Loaded ${messages.length} messages`)
 */
export function loadMessageFixture(filename: string): MessageFixture {
  const data = loadFixture<MessageFixture>(filename)

  if (!data.messages || !Array.isArray(data.messages)) {
    throw new Error(`Invalid message fixture: ${filename} (missing 'messages' array)`)
  }

  return data
}

/**
 * Checks if a fixture file exists
 *
 * @param filename - Name of the fixture file
 * @param baseDir - Base directory for fixtures
 * @returns True if file exists
 *
 * @example
 * if (fixtureExists('optional-dataset.json')) {
 *   const data = loadFixture('optional-dataset.json')
 * }
 */
export function fixtureExists(filename: string, baseDir?: string): boolean {
  const dir = baseDir || resolve(process.cwd(), 'tests/fixtures')
  const fullPath = resolve(dir, filename)
  return existsSync(fullPath)
}

// ============================================================================
// Fixture Path Helpers
// ============================================================================

/**
 * Gets the absolute path to a fixture file
 *
 * @param filename - Name of the fixture file
 * @param baseDir - Base directory for fixtures
 * @returns Absolute path to fixture
 *
 * @example
 * const path = getFixturePath('test.json')
 * console.log(path) // /abs/path/to/tests/fixtures/test.json
 */
export function getFixturePath(filename: string, baseDir?: string): string {
  const dir = baseDir || resolve(process.cwd(), 'tests/fixtures')
  return resolve(dir, filename)
}

/**
 * Gets the fixtures directory path
 *
 * @param subdir - Optional subdirectory within fixtures
 * @returns Absolute path to fixtures directory
 *
 * @example
 * const messagesDir = getFixturesDir('messages')
 * console.log(messagesDir) // /abs/path/to/tests/fixtures/messages
 */
export function getFixturesDir(subdir?: string): string {
  const baseDir = resolve(process.cwd(), 'tests/fixtures')
  return subdir ? resolve(baseDir, subdir) : baseDir
}

// ============================================================================
// Specialized Fixture Loaders
// ============================================================================

/**
 * Loads a CSV fixture as raw string content
 *
 * @param filename - Name of the CSV fixture file
 * @returns Raw CSV content
 *
 * @example
 * const csvContent = loadCsvFixture('melanie-messages.csv')
 * // Parse with your CSV parser
 */
export function loadCsvFixture(filename: string): string {
  return loadFixture<string>(filename, { parseJson: false })
}

/**
 * Loads a text file fixture
 *
 * @param filename - Name of the text fixture file
 * @returns Text content
 *
 * @example
 * const markdown = loadTextFixture('expected-output.md')
 */
export function loadTextFixture(filename: string): string {
  return loadFixture<string>(filename, { parseJson: false })
}

/**
 * Loads a JSON Lines fixture (JSONL format - one JSON object per line)
 *
 * @param filename - Name of the JSONL fixture file
 * @returns Array of parsed JSON objects
 *
 * @example
 * const messages = loadJsonLinesFixture('stream-output.jsonl')
 */
export function loadJsonLinesFixture<T = any>(filename: string): T[] {
  const content = loadFixture<string>(filename, { parseJson: false })
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T)
}

// ============================================================================
// Fixture Factories
// ============================================================================

/**
 * Creates a minimal valid Message for testing
 *
 * @param overrides - Properties to override
 * @returns Valid Message object
 *
 * @example
 * const msg = createMessageFixture({ text: 'Test message', isFromMe: true })
 */
export function createMessageFixture(overrides: Partial<Message> = {}): Message {
  const defaults: Message = {
    guid: `test-${Date.now()}-${Math.random()}`,
    messageKind: 'text',
    isFromMe: false,
    date: new Date().toISOString(),
    text: 'Test message content',
    handle: 'Test User',
    service: 'iMessage',
    isRead: false,
    metadata: {
      source: 'test-fixture',
    },
  }

  return {
    ...defaults,
    ...overrides,
  }
}

/**
 * Creates multiple message fixtures
 *
 * @param count - Number of messages to create
 * @param overridesFn - Function to generate overrides for each message
 * @returns Array of Message objects
 *
 * @example
 * const messages = createMessagesFixture(5, (i) => ({
 *   text: `Message ${i}`,
 *   isFromMe: i % 2 === 0
 * }))
 */
export function createMessagesFixture(
  count: number,
  overridesFn?: (index: number) => Partial<Message>
): Message[] {
  return Array.from({ length: count }, (_, i) => {
    const overrides = overridesFn ? overridesFn(i) : {}
    return createMessageFixture(overrides)
  })
}

/**
 * Creates a message fixture with media attachment
 *
 * @param mediaKind - Type of media (image, audio, video, pdf)
 * @param overrides - Properties to override
 * @returns Message with media
 *
 * @example
 * const imgMsg = createMediaMessageFixture('image', {
 *   media: { filename: 'photo.heic' }
 * })
 */
export function createMediaMessageFixture(
  mediaKind: 'image' | 'audio' | 'video' | 'pdf',
  overrides: Partial<Message> = {}
): Message {
  const extensions = {
    image: 'jpg',
    audio: 'm4a',
    video: 'mov',
    pdf: 'pdf',
  }

  const ext = extensions[mediaKind]
  const filename = `test-${mediaKind}.${ext}`

  return createMessageFixture({
    messageKind: 'media',
    media: {
      id: `media-${Date.now()}`,
      filename,
      path: `/test/path/${filename}`,
      mediaKind,
    },
    ...overrides,
  })
}

/**
 * Creates a tapback message fixture
 *
 * @param tapbackKind - Type of tapback reaction
 * @param parentGuid - GUID of parent message
 * @param overrides - Properties to override
 * @returns Tapback message
 *
 * @example
 * const reaction = createTapbackFixture('liked', 'parent-guid-123')
 */
export function createTapbackFixture(
  tapbackKind: 'liked' | 'loved' | 'laughed' | 'emphasized' | 'questioned' | 'disliked',
  parentGuid: string,
  overrides: Partial<Message> = {}
): Message {
  return createMessageFixture({
    messageKind: 'tapback',
    tapback: {
      tapbackKind,
      targetGuid: parentGuid,
    },
    ...overrides,
  })
}
