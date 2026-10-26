import {cleanup, renderHook} from '@testing-library/react'
import {act} from 'react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {useDelayedEmptyReload} from '@/lib/feeds/useDelayedEmptyReload'

afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

describe('useDelayedEmptyReload', () => {
    it('survives Strict Mode cleanup: reload still runs after remount', async () => {
        vi.useFakeTimers()
        const reload = vi.fn()

        const first = renderHook(() =>
            useDelayedEmptyReload({
                enabled: true,
                error: null,
                hasDefault: false,
                isLoading: false,
                reload,
            }),
        )
        expect(first.result.current).toBe(true)
        first.unmount()

        const second = renderHook(() =>
            useDelayedEmptyReload({
                enabled: true,
                error: null,
                hasDefault: false,
                isLoading: false,
                reload,
            }),
        )
        expect(second.result.current).toBe(true)
        expect(reload).not.toHaveBeenCalled()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500)
        })
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('clears preparing when loading starts after reload', async () => {
        vi.useFakeTimers()
        const reload = vi.fn()
        let isLoading = false
        const {result, rerender} = renderHook(() =>
            useDelayedEmptyReload({
                enabled: true,
                error: null,
                hasDefault: false,
                isLoading,
                reload,
            }),
        )

        expect(result.current).toBe(true)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500)
        })
        expect(reload).toHaveBeenCalledTimes(1)
        expect(result.current).toBe(true)

        isLoading = true
        rerender()
        expect(result.current).toBe(false)
    })

    it('clears preparing after reload settles without a loading frame', async () => {
        vi.useFakeTimers()
        const reload = vi.fn()
        const {result} = renderHook(() =>
            useDelayedEmptyReload({
                enabled: true,
                error: null,
                hasDefault: false,
                isLoading: false,
                reload,
            }),
        )

        expect(result.current).toBe(true)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500)
        })
        expect(reload).toHaveBeenCalledTimes(1)
        expect(result.current).toBe(true)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(result.current).toBe(false)
    })

    it('does not schedule when a default feed already exists', () => {
        const reload = vi.fn()
        const {result} = renderHook(() =>
            useDelayedEmptyReload({
                enabled: true,
                error: null,
                hasDefault: true,
                isLoading: false,
                reload,
            }),
        )
        expect(result.current).toBe(false)
        expect(reload).not.toHaveBeenCalled()
    })
})
