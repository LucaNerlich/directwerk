import {act, renderHook} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {useCopyToClipboard} from './use-copy-to-clipboard'

describe('useCopyToClipboard', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {writeText: vi.fn().mockResolvedValue(undefined)},
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('keeps the latest successful copy visible for two seconds', async () => {
        const {result} = renderHook(() => useCopyToClipboard())

        await act(() => result.current.copy('first'))
        act(() => vi.advanceTimersByTime(1000))
        await act(() => result.current.copy('second'))

        act(() => vi.advanceTimersByTime(1999))
        expect(result.current.state).toBe('copied')

        act(() => vi.advanceTimersByTime(1))
        expect(result.current.state).toBe('idle')
    })

    it('clears the active timer when unmounted', async () => {
        const clearTimeout = vi.spyOn(window, 'clearTimeout')
        const {result, unmount} = renderHook(() => useCopyToClipboard())

        await act(() => result.current.copy('text'))
        unmount()

        expect(clearTimeout).toHaveBeenCalledOnce()
    })
})
