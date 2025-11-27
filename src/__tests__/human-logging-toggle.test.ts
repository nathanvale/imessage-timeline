import { beforeEach, describe, expect, it, vi } from 'vitest'

import { humanError, humanInfo, humanWarn, setHumanLoggingEnabled } from '#utils/human'

/**
 * Tests human logging toggle behavior ensuring suppression when disabled.
 */

describe('Human logging toggle', () => {
	const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
	const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
	const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

	beforeEach(() => {
		vi.resetAllMocks()
		setHumanLoggingEnabled(true)
	})

	it('emits console.* when enabled', () => {
		humanInfo('enabled-info')
		humanWarn('enabled-warn')
		humanError('enabled-error')
		expect(infoSpy).toHaveBeenCalledWith('enabled-info')
		expect(warnSpy).toHaveBeenCalledWith('enabled-warn')
		expect(errorSpy).toHaveBeenCalledWith('enabled-error')
	})

	it('suppresses console.* when disabled', () => {
		setHumanLoggingEnabled(false)
		humanInfo('disabled-info')
		humanWarn('disabled-warn')
		humanError('disabled-error')
		expect(infoSpy).not.toHaveBeenCalled()
		expect(warnSpy).not.toHaveBeenCalled()
		expect(errorSpy).not.toHaveBeenCalled()
	})
})
