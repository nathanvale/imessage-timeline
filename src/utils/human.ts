/**
 * Human Output Helper
 *
 * Centralizes human-facing console output so we can globally toggle it
 * (e.g. suppressed when --json or LOG_FORMAT=json-only is active).
 * Tests that spy on console.* remain compatible.
 */

export type HumanLoggerOptions = {
	enabled?: boolean
}

let humanEnabled = true

export function setHumanLoggingEnabled(enabled: boolean): void {
	humanEnabled = enabled
}

function safeConsole<K extends 'info' | 'warn' | 'error' | 'log'>(
	kind: K,
	...args: Array<unknown>
): void {
	if (!humanEnabled) return
	const c = (
		globalThis as unknown as {
			console?: Record<string, (...a: unknown[]) => void>
		}
	).console
	c?.[kind]?.(...(args as []))
}

export function humanInfo(...args: Array<unknown>): void {
	safeConsole('info', ...args)
}

export function humanWarn(...args: Array<unknown>): void {
	safeConsole('warn', ...args)
}

export function humanError(...args: Array<unknown>): void {
	safeConsole('error', ...args)
}
