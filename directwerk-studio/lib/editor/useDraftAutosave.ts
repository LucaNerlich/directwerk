'use client'

import {useEffect, useRef} from 'react'


export function useDraftAutosave({
    enabled,
    isDirty,
    isSaving,
    onSave,
    canSave,
    delayMs = 2000,
    revision = 0,
}: {
    enabled: boolean
    isDirty: boolean
    isSaving: boolean
    onSave: () => Promise<void>
    /** Re-checked when the debounce fires so stale timers cannot save after publish. */
    canSave?: () => boolean
    delayMs?: number
    revision?: number
}): void {
    const onSaveRef = useRef(onSave)
    onSaveRef.current = onSave
    const canSaveRef = useRef(canSave)
    canSaveRef.current = canSave
    /** Revision of the last attempted save, so a failed autosave (isDirty stays
     * true) does not retry every `delayMs` forever — only a new edit (new
     * revision) schedules another attempt. */
    const attemptedRevisionRef = useRef<number | null>(null)

    useEffect(() => {
        if (!enabled || !isDirty || isSaving || attemptedRevisionRef.current === revision) {
            return
        }

        const timer = window.setTimeout(() => {
            attemptedRevisionRef.current = revision
            if (canSaveRef.current !== undefined && !canSaveRef.current()) {
                return
            }
            void onSaveRef.current()
        }, delayMs)

        return () => {
            window.clearTimeout(timer)
        }
    }, [delayMs, enabled, isDirty, isSaving, revision])
}
