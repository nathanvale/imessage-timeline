/**
 * Grouping and Anchor Generation Module (RENDER--T01)
 *
 * Implements message grouping and Obsidian-friendly anchor generation:
 * - AC01: Group messages by date (YYYY-MM-DD)
 * - AC02: Sub-group by time-of-day (Morning/Afternoon/Evening)
 * - AC03: Generate unique anchor IDs (#msg-{guid})
 * - AC04: Obsidian-compatible deep-link anchors
 * - AC05: Maintain chronological ordering within time-of-day groups
 */

import type { Message } from '#schema/message'

/**
 * Time-of-day classification
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

/**
 * Group structure for a single time-of-day period
 */
export interface TimeOfDayGroup {
  morning: Message[]
  afternoon: Message[]
  evening: Message[]
}

/**
 * Grouped messages by date and time-of-day
 * Key: YYYY-MM-DD
 */
export interface GroupedMessages {
  [date: string]: TimeOfDayGroup
}

/**
 * AC02: Classify a timestamp into time-of-day category
 * Morning: 00:00-11:59
 * Afternoon: 12:00-17:59
 * Evening: 18:00-23:59
 */
export function classifyTimeOfDay(isoTimestamp: string): TimeOfDay {
  const date = new Date(isoTimestamp)
  const hours = date.getUTCHours()

  if (hours < 12) {
    return 'morning'
  } else if (hours < 18) {
    return 'afternoon'
  } else {
    return 'evening'
  }
}

/**
 * AC03: Generate unique anchor ID for a message
 * Format: #msg-{guid}
 */
export function generateAnchorId(guid: string): string {
  return `#msg-${guid}`
}

/**
 * AC01: Extract date from ISO timestamp in YYYY-MM-DD format
 */
export function extractDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * AC05: Sort messages chronologically by timestamp
 * Does not mutate original array
 */
export function sortByTimestamp(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.date).getTime()
    const timeB = new Date(b.date).getTime()
    return timeA - timeB
  })
}

/**
 * AC01-AC05: Group messages by date and time-of-day
 * Returns nested structure with chronological ordering maintained
 */
export function groupMessagesByDateAndTimeOfDay(messages: Message[]): GroupedMessages {
  const grouped: GroupedMessages = {}

  // First pass: create date groups and classify by time-of-day
  for (const message of messages) {
    const date = extractDate(message.date)
    const timeOfDay = classifyTimeOfDay(message.date)

    // Initialize date group if not exists
    if (!grouped[date]) {
      grouped[date] = {
        morning: [],
        afternoon: [],
        evening: [],
      }
    }

    // Add message to appropriate time-of-day group
    grouped[date][timeOfDay].push(message)
  }

  // Second pass: sort each time-of-day group chronologically
  for (const date in grouped) {
    grouped[date].morning = sortByTimestamp(grouped[date].morning)
    grouped[date].afternoon = sortByTimestamp(grouped[date].afternoon)
    grouped[date].evening = sortByTimestamp(grouped[date].evening)
  }

  return grouped
}

/**
 * Get all unique dates from grouped messages
 * Returns dates in chronological order
 */
export function getDatesSorted(grouped: GroupedMessages): string[] {
  return Object.keys(grouped).sort((a, b) => {
    const dateA = new Date(a).getTime()
    const dateB = new Date(b).getTime()
    return dateA - dateB
  })
}

/**
 * Get all messages from a date group in chronological order
 * Combines all time-of-day groups in order
 */
export function getAllMessagesForDate(dateGroup: TimeOfDayGroup): Message[] {
  return [...dateGroup.morning, ...dateGroup.afternoon, ...dateGroup.evening]
}

/**
 * Type guards and utilities
 */

/**
 * Check if date group has any messages
 */
export function hasMessages(dateGroup: TimeOfDayGroup): boolean {
  return dateGroup.morning.length > 0 || dateGroup.afternoon.length > 0 || dateGroup.evening.length > 0
}

/**
 * Get count of messages in time-of-day
 */
export function getMessageCount(dateGroup: TimeOfDayGroup): number {
  return dateGroup.morning.length + dateGroup.afternoon.length + dateGroup.evening.length
}
