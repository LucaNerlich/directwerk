'use client'

import {useState} from 'react'

/**
 * Arm-then-confirm state for irreversible row actions (issue #584): the first call returns
 * `false` and records the id, the second call for the same id returns `true`.
 */
export function useTwoStepConfirm<T>(): {
    pending: T | null
    arm: (id: T) => boolean
    reset: () => void
} {
    const [pending, setPending] = useState<T | null>(null)

    function arm(id: T): boolean {
        if (pending === id) {
            return true
        }
        setPending(id)
        return false
    }

    function reset(): void {
        setPending(null)
    }

    return {pending, arm, reset}
}
