'use client'

import {useEffect, useRef} from 'react'


export function useDraftAutosave({
    enabled,
    isDirty,
    isSaving,
    onSave,
    delayMs = 2000,
    revision = 0,
}: {
    enabled: boolean
    isDirty: boolean
    isSaving: boolean
    onSave: () => Promise<unknown>
    delayMs?: number
    revision?: number
}): void {
    const onSaveRef = useRef(onSave)
    onSaveRef.current = onSave

    useEffect(() => {
        if (!enabled || !isDirty || isSaving) {
            return
        }

        const timer = window.setTimeout(() => {
            void onSaveRef.current()
        }, delayMs)

        return () => {
            window.clearTimeout(timer)
        }
    }, [delayMs, enabled, isDirty, isSaving, revision])
}
