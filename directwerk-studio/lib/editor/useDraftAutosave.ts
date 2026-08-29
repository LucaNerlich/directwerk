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

    useEffect(() => {
        if (!enabled || !isDirty || isSaving) {
            return
        }

        const timer = window.setTimeout(() => {
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
