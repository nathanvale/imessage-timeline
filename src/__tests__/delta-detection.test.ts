import { promises as fs } from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../schema/message'
import { MessageSchema } from '../schema/message'
import {
	detectDelta,
	extractGuidsFromMessages,
	getDeltaStats,
	logDeltaSummary,
} from '../utils/delta-detection'
import { setHumanLoggingEnabled } from '../utils/human'
import type { IncrementalState } from '../utils/incremental-state'
import { createIncrementalState } from '../utils/incremental-state'

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestMessage(overrides: Partial<Message> = {}): Message {
	return MessageSchema.parse({
		guid: `test-${Date.now()}-${Math.random()}`,
		messageKind: 'text',
		text: 'Test message',
		isFromMe: false,
		date: new Date().toISOString(),
		...overrides,
	})
}

function createTestState(overrides: Partial<IncrementalState> = {}): IncrementalState {
	return {
		...createIncrementalState(),
		...overrides,
	}
}

// ============================================================================
// AC02 + AC03: extractGuidsFromMessages
// ============================================================================

describe('extractGuidsFromMessages', () => {
	it('extracts GUIDs from messages', () => {
		const msg1 = createTestMessage({ guid: 'msg-1' })
		const msg2 = createTestMessage({ guid: 'msg-2' })
		const msg3 = createTestMessage({ guid: 'msg-3' })

		const guids = extractGuidsFromMessages([msg1, msg2, msg3])

		expect(guids).toEqual(new Set(['msg-1', 'msg-2', 'msg-3']))
	})

	it('handles empty message array', () => {
		const guids = extractGuidsFromMessages([])
		expect(guids).toEqual(new Set())
	})

	it('deduplicates messages with same GUID', () => {
		const msg1 = createTestMessage({ guid: 'duplicate' })
		const msg2 = createTestMessage({ guid: 'duplicate' })

		const guids = extractGuidsFromMessages([msg1, msg2])

		expect(guids).toEqual(new Set(['duplicate']))
		expect(guids.size).toBe(1)
	})

	it('preserves GUID format for part GUIDs', () => {
		const msg1 = createTestMessage({ guid: 'p:0/base-guid' })
		const msg2 = createTestMessage({ guid: 'p:1/base-guid' })

		const guids = extractGuidsFromMessages([msg1, msg2])

		expect(guids).toEqual(new Set(['p:0/base-guid', 'p:1/base-guid']))
	})

	it('handles large message arrays efficiently', () => {
		const messages = Array.from({ length: 10000 }, (_, i) =>
			createTestMessage({ guid: `msg-${i}` }),
		)

		const guids = extractGuidsFromMessages(messages)

		expect(guids.size).toBe(10000)
		expect(guids.has('msg-0')).toBe(true)
		expect(guids.has('msg-9999')).toBe(true)
	})
})

// ============================================================================
// AC01 + AC04: Delta detection with state loading
// ============================================================================

describe('detectDelta', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = path.join('/tmp', `delta-test-${Date.now()}-${Math.random()}`)
		await fs.mkdir(tmpDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(tmpDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	})

	// AC04: Handle missing state file (first run)
	it('detects all messages as new on first run (missing state file)', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')
		const msg1 = createTestMessage({ guid: 'msg-1' })
		const msg2 = createTestMessage({ guid: 'msg-2' })
		const msg3 = createTestMessage({ guid: 'msg-3' })

		const result = await detectDelta([msg1, msg2, msg3], stateFile)

		expect(result.isFirstRun).toBe(true)
		expect(result.totalMessages).toBe(3)
		expect(result.newCount).toBe(3)
		expect(result.previousEnrichedCount).toBe(0)
		expect(new Set(result.newGuids)).toEqual(new Set(['msg-1', 'msg-2', 'msg-3']))
	})

	// AC01: Load previous state
	it('loads previous state and detects only new messages', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		// First run: process 3 messages
		const msg1 = createTestMessage({ guid: 'msg-1' })
		const msg2 = createTestMessage({ guid: 'msg-2' })
		const msg3 = createTestMessage({ guid: 'msg-3' })

		const result1 = await detectDelta([msg1, msg2, msg3], stateFile)
		expect(result1.newCount).toBe(3)

		// Save state after first run
		result1.state.enrichedGuids = ['msg-1', 'msg-2', 'msg-3']
		await fs.writeFile(stateFile, JSON.stringify(result1.state, null, 2))

		// Second run: add 2 new messages
		const msg4 = createTestMessage({ guid: 'msg-4' })
		const msg5 = createTestMessage({ guid: 'msg-5' })

		const result2 = await detectDelta([msg1, msg2, msg3, msg4, msg5], stateFile)

		expect(result2.isFirstRun).toBe(false)
		expect(result2.totalMessages).toBe(5)
		expect(result2.previousEnrichedCount).toBe(3)
		expect(result2.newCount).toBe(2)
		expect(new Set(result2.newGuids)).toEqual(new Set(['msg-4', 'msg-5']))
	})

	// AC02 + AC03: Delta computation
	it('correctly identifies new GUIDs in delta', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		const msg1 = createTestMessage({ guid: 'existing-1' })
		const msg2 = createTestMessage({ guid: 'existing-2' })
		const msg3 = createTestMessage({ guid: 'new-1' })
		const msg4 = createTestMessage({ guid: 'new-2' })

		// Create previous state with 2 enriched messages
		const previousState = createTestState({
			enrichedGuids: ['existing-1', 'existing-2'],
		})
		await fs.writeFile(stateFile, JSON.stringify(previousState, null, 2))

		// Detect delta with 2 existing + 2 new
		const result = await detectDelta([msg1, msg2, msg3, msg4], stateFile)

		expect(result.newCount).toBe(2)
		expect(new Set(result.newGuids)).toEqual(new Set(['new-1', 'new-2']))
	})

	// AC04: Corrupted state file (treat as missing)
	it('handles corrupted state file gracefully (treats as first run)', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		// Write corrupted JSON
		await fs.writeFile(stateFile, 'NOT VALID JSON {{{')

		const msg1 = createTestMessage({ guid: 'msg-1' })
		const msg2 = createTestMessage({ guid: 'msg-2' })

		const result = await detectDelta([msg1, msg2], stateFile)

		// Corrupted state treated as first run
		expect(result.isFirstRun).toBe(true)
		expect(result.newCount).toBe(2)
	})

	// AC04: State with wrong version
	it('handles state with incompatible version gracefully', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		// Write state with wrong version
		const badState = {
			version: '2.0',
			lastEnrichedAt: new Date().toISOString(),
			totalMessages: 100,
			enrichedGuids: ['msg-1', 'msg-2'],
			pipelineConfig: { configHash: 'test' },
			enrichmentStats: null,
		}
		await fs.writeFile(stateFile, JSON.stringify(badState, null, 2))

		const msg1 = createTestMessage({ guid: 'msg-1' })
		const msg2 = createTestMessage({ guid: 'msg-2' })
		const msg3 = createTestMessage({ guid: 'msg-3' })

		const result = await detectDelta([msg1, msg2, msg3], stateFile)

		// Incompatible version treated as first run
		expect(result.isFirstRun).toBe(true)
		expect(result.newCount).toBe(3)
	})

	// AC05: Result state for updates
	it('includes state object in result for post-enrichment updates', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')
		const msg1 = createTestMessage({ guid: 'msg-1' })

		const result = await detectDelta([msg1], stateFile)

		expect(result.state).toBeDefined()
		expect(result.state.version).toBe('1.0')
		expect(result.state.enrichedGuids).toEqual([])
	})
})

// ============================================================================
// AC05: Delta Summary Logging
// ============================================================================

describe('logDeltaSummary', () => {
	let logSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		// Ensure human logging is enabled (may be disabled by other tests)
		setHumanLoggingEnabled(true)
		logSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
	})

	afterEach(() => {
		logSpy.mockRestore()
	})

	it('logs first run message', () => {
		const result = {
			newGuids: ['msg-1', 'msg-2', 'msg-3'],
			totalMessages: 3,
			previousEnrichedCount: 0,
			newCount: 3,
			isFirstRun: true,
			state: createTestState(),
		}

		logDeltaSummary(result)

		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('First enrichment run'))
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('3 messages'))
	})

	it('logs delta detected message with percentage', () => {
		const result = {
			newGuids: ['msg-4', 'msg-5'],
			totalMessages: 100,
			previousEnrichedCount: 98,
			newCount: 2,
			isFirstRun: false,
			state: createTestState(),
		}

		logDeltaSummary(result)

		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Delta detected'))
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 new messages'))
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2.0%'))
	})

	it('logs previously enriched count', () => {
		const result = {
			newGuids: ['msg-4', 'msg-5'],
			totalMessages: 100,
			previousEnrichedCount: 98,
			newCount: 2,
			isFirstRun: false,
			state: createTestState(),
		}

		logDeltaSummary(result)

		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Previously enriched: 98'))
	})

	it('handles 0% delta', () => {
		const result = {
			newGuids: [],
			totalMessages: 100,
			previousEnrichedCount: 100,
			newCount: 0,
			isFirstRun: false,
			state: createTestState(),
		}

		logDeltaSummary(result)

		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('0.0%'))
	})

	it('handles 100% delta on first run', () => {
		const result = {
			newGuids: Array.from({ length: 50 }, (_, i) => `msg-${i}`),
			totalMessages: 50,
			previousEnrichedCount: 0,
			newCount: 50,
			isFirstRun: true,
			state: createTestState(),
		}

		logDeltaSummary(result)

		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('First enrichment run'))
	})
})

// ============================================================================
// getDeltaStats Helper
// ============================================================================

describe('getDeltaStats', () => {
	it('calculates correct statistics', () => {
		const result = {
			newGuids: ['msg-4', 'msg-5'],
			totalMessages: 100,
			previousEnrichedCount: 98,
			newCount: 2,
			isFirstRun: false,
			state: createTestState(),
		}

		const stats = getDeltaStats(result)

		expect(stats.total).toBe(100)
		expect(stats.new).toBe(2)
		expect(stats.previous).toBe(98)
		expect(stats.percentNew).toBeCloseTo(2.0, 1)
		expect(stats.percentPrevious).toBeCloseTo(98.0, 1)
	})

	it('handles empty message set', () => {
		const result = {
			newGuids: [],
			totalMessages: 0,
			previousEnrichedCount: 0,
			newCount: 0,
			isFirstRun: true,
			state: createTestState(),
		}

		const stats = getDeltaStats(result)

		expect(stats.total).toBe(0)
		expect(stats.new).toBe(0)
		expect(stats.previous).toBe(0)
		expect(stats.percentNew).toBe(0)
		expect(stats.percentPrevious).toBe(0)
	})

	it('handles large datasets', () => {
		const result = {
			newGuids: Array.from({ length: 25000 }, (_, i) => `msg-${i}`),
			totalMessages: 100000,
			previousEnrichedCount: 75000,
			newCount: 25000,
			isFirstRun: false,
			state: createTestState(),
		}

		const stats = getDeltaStats(result)

		expect(stats.total).toBe(100000)
		expect(stats.new).toBe(25000)
		expect(stats.percentNew).toBeCloseTo(25.0, 1)
		expect(stats.percentPrevious).toBeCloseTo(75.0, 1)
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Delta detection integration', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = path.join('/tmp', `delta-integration-${Date.now()}-${Math.random()}`)
		await fs.mkdir(tmpDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(tmpDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	})

	it('handles multiple enrichment cycles correctly', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		// Cycle 1: Enrich 5 messages
		const cycle1Messages = Array.from({ length: 5 }, (_, i) =>
			createTestMessage({ guid: `msg-${i}` }),
		)
		const result1 = await detectDelta(cycle1Messages, stateFile)
		expect(result1.newCount).toBe(5)

		// Save state
		result1.state.enrichedGuids = cycle1Messages.map((m) => m.guid)
		await fs.writeFile(stateFile, JSON.stringify(result1.state, null, 2))

		// Cycle 2: Add 3 new messages
		const newMessages = Array.from({ length: 3 }, (_, i) =>
			createTestMessage({ guid: `new-msg-${i}` }),
		)
		const cycle2Messages = [...cycle1Messages, ...newMessages]
		const result2 = await detectDelta(cycle2Messages, stateFile)
		expect(result2.newCount).toBe(3)

		// Save state
		result2.state.enrichedGuids.push(...newMessages.map((m) => m.guid))
		await fs.writeFile(stateFile, JSON.stringify(result2.state, null, 2))

		// Cycle 3: No new messages
		const result3 = await detectDelta(cycle2Messages, stateFile)
		expect(result3.newCount).toBe(0)

		// Cycle 4: Add 2 more messages
		const moreMessages = Array.from({ length: 2 }, (_, i) =>
			createTestMessage({ guid: `extra-msg-${i}` }),
		)
		const cycle4Messages = [...cycle2Messages, ...moreMessages]
		const result4 = await detectDelta(cycle4Messages, stateFile)
		expect(result4.newCount).toBe(2)
	})

	it('preserves state across enrichment cycles', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		const msg1 = createTestMessage({ guid: 'msg-1' })
		const result1 = await detectDelta([msg1], stateFile)

		// Record enrichment
		result1.state.enrichedGuids = ['msg-1']
		result1.state.enrichmentStats = {
			processedCount: 1,
			failedCount: 0,
			startTime: new Date().toISOString(),
			endTime: new Date().toISOString(),
		}
		await fs.writeFile(stateFile, JSON.stringify(result1.state, null, 2))

		// Load in second run
		const msg2 = createTestMessage({ guid: 'msg-2' })
		const result2 = await detectDelta([msg1, msg2], stateFile)

		expect(result2.previousEnrichedCount).toBe(1)
		expect(result2.state.enrichmentStats).toBeDefined()
		expect(result2.state.enrichmentStats?.processedCount).toBe(1)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Delta detection edge cases', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = path.join('/tmp', `delta-edge-${Date.now()}-${Math.random()}`)
		await fs.mkdir(tmpDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(tmpDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	})

	it('handles messages removed from dataset', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		// First run with 5 messages
		const messages1 = Array.from({ length: 5 }, (_, i) => createTestMessage({ guid: `msg-${i}` }))
		const result1 = await detectDelta(messages1, stateFile)
		result1.state.enrichedGuids = messages1.map((m) => m.guid)
		await fs.writeFile(stateFile, JSON.stringify(result1.state, null, 2))

		// Second run with only 3 messages (2 removed)
		const messages2 = [messages1[0], messages1[1], messages1[2]]
		const result2 = await detectDelta(messages2, stateFile)

		// No new messages (all existing)
		expect(result2.newCount).toBe(0)
		expect(result2.totalMessages).toBe(3)
		expect(result2.previousEnrichedCount).toBe(5)
	})

	it('handles very large GUID sets efficiently', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		// Create 50k messages
		const messages = Array.from({ length: 50000 }, (_, i) =>
			createTestMessage({ guid: `msg-${i}` }),
		)

		const result = await detectDelta(messages, stateFile)

		expect(result.newCount).toBe(50000)
		expect(result.totalMessages).toBe(50000)
	})

	it('handles special GUID formats', async () => {
		const stateFile = path.join(tmpDir, '.imessage-state.json')

		const msg1 = createTestMessage({ guid: 'p:0/base-guid-123' })
		const msg2 = createTestMessage({ guid: 'p:1/base-guid-123' })
		const msg3 = createTestMessage({ guid: 'db:456' })

		const result = await detectDelta([msg1, msg2, msg3], stateFile)

		expect(result.newCount).toBe(3)
		expect(new Set(result.newGuids)).toEqual(
			new Set(['p:0/base-guid-123', 'p:1/base-guid-123', 'db:456']),
		)
	})
})
