'use client'

import {useEffect, type RefObject} from 'react'

/**
 * Moves focus to the first invalid field after a failed submit. `errors` is a
 * fresh object per action result, so the effect re-runs on every attempt and
 * re-focuses even when the same field failed twice.
 */
export function useFocusFirstInvalidField<T extends object>(
    errors: T,
    refs: Record<string, RefObject<HTMLInputElement | null>>,
): void {
    useEffect(() => {
        const entries = errors as Record<string, string | undefined>
        const firstInvalid = Object.keys(entries).find(
            (key) => entries[key] !== undefined,
        )
        if (firstInvalid !== undefined) {
            refs[firstInvalid]?.current?.focus()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errors])
}
