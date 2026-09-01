import {act, renderHook} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {useDraftAutosave} from '@/lib/editor/useDraftAutosave'

describe('useDraftAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('does not save when autosave is disabled (no persisted id)', () => {
        const onSave = vi.fn()
        renderHook(() =>
            useDraftAutosave({
                enabled: false,
                isDirty: true,
                isSaving: false,
                onSave,
            }),
        )

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(onSave).not.toHaveBeenCalled()
    })

    it('saves after the debounce when a dirty draft is persisted', () => {
        const onSave = vi.fn().mockResolvedValue(undefined)
        renderHook(() =>
            useDraftAutosave({
                enabled: true,
                isDirty: true,
                isSaving: false,
                onSave,
            }),
        )

        act(() => {
            vi.advanceTimersByTime(1999)
        })
        expect(onSave).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('resets the timer when revision changes', () => {
        const onSave = vi.fn().mockResolvedValue(undefined)
        const {rerender} = renderHook(
            ({revision}: {revision: number}) =>
                useDraftAutosave({
                    enabled: true,
                    isDirty: true,
                    isSaving: false,
                    onSave,
                    revision,
                }),
            {initialProps: {revision: 1}},
        )

        act(() => {
            vi.advanceTimersByTime(1500)
        })
        rerender({revision: 2})
        act(() => {
            vi.advanceTimersByTime(1500)
        })
        expect(onSave).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(500)
        })
        expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('does not retry every delayMs after a failed save with an unchanged revision', () => {
        const onSave = vi.fn().mockResolvedValue(undefined)
        const {rerender} = renderHook(
            ({isSaving}: {isSaving: boolean}) =>
                useDraftAutosave({
                    enabled: true,
                    isDirty: true,
                    isSaving,
                    onSave,
                    revision: 1,
                }),
            {initialProps: {isSaving: false}},
        )

        act(() => {
            vi.advanceTimersByTime(2000)
        })
        expect(onSave).toHaveBeenCalledTimes(1)

        // Simulates a failed save: isSaving toggles true -> false but isDirty
        // and revision stay the same because the caller never cleared isDirty.
        rerender({isSaving: true})
        rerender({isSaving: false})

        act(() => {
            vi.advanceTimersByTime(10000)
        })
        expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('retries after a failed save once a new edit bumps the revision', () => {
        const onSave = vi.fn().mockResolvedValue(undefined)
        const {rerender} = renderHook(
            ({isSaving, revision}: {isSaving: boolean; revision: number}) =>
                useDraftAutosave({
                    enabled: true,
                    isDirty: true,
                    isSaving,
                    onSave,
                    revision,
                }),
            {initialProps: {isSaving: false, revision: 1}},
        )

        act(() => {
            vi.advanceTimersByTime(2000)
        })
        expect(onSave).toHaveBeenCalledTimes(1)

        rerender({isSaving: true, revision: 1})
        rerender({isSaving: false, revision: 2})

        act(() => {
            vi.advanceTimersByTime(2000)
        })
        expect(onSave).toHaveBeenCalledTimes(2)
    })

    it('does not save when canSave becomes false before the debounce fires', () => {
        const onSave = vi.fn().mockResolvedValue(undefined)
        let allowed = true
        renderHook(() =>
            useDraftAutosave({
                enabled: true,
                isDirty: true,
                isSaving: false,
                canSave: () => allowed,
                onSave,
            }),
        )

        act(() => {
            vi.advanceTimersByTime(1500)
        })
        allowed = false
        act(() => {
            vi.advanceTimersByTime(500)
        })

        expect(onSave).not.toHaveBeenCalled()
    })
})
