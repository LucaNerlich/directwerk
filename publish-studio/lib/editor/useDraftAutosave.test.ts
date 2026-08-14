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
})
