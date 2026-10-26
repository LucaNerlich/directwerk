'use client'

import {useEffect, useRef, useState} from 'react'

const DEFAULT_DELAY_MS = 1500

/**
 * When an authenticated empty default feed finishes loading, wait briefly and
 * reload once (covers provisioning races). Survives Strict Mode remounts by
 * marking retried only when reload runs; keeps `preparing` until loading
 * starts, a feed/error appears, or the reload has settled (so EmptyState does
 * not flash when `isLoading` is batched away in the same tick).
 */
export function useDelayedEmptyReload({
    enabled,
    isLoading,
    error,
    hasDefault,
    reload,
    delayMs = DEFAULT_DELAY_MS,
}: {
    enabled: boolean
    isLoading: boolean
    error: string | null
    hasDefault: boolean
    reload: () => void
    delayMs?: number
}): boolean {
    const [preparing, setPreparing] = useState(false)
    const [reloadRequested, setReloadRequested] = useState(false)
    const retried = useRef(false)

    useEffect(() => {
        if (!enabled || isLoading || error !== null || hasDefault || retried.current) {
            return
        }
        setPreparing(true)
        const timer = window.setTimeout(() => {
            retried.current = true
            setReloadRequested(true)
            reload()
        }, delayMs)
        return () => {
            window.clearTimeout(timer)
        }
    }, [delayMs, enabled, error, hasDefault, isLoading, reload])

    useEffect(() => {
        if (!preparing) {
            return
        }
        if (hasDefault || error !== null || isLoading) {
            setPreparing(false)
            return
        }
        if (!reloadRequested) {
            return
        }
        // Reload finished without a lasting isLoading frame (common with fast mocks).
        const done = window.setTimeout(() => {
            setPreparing(false)
        }, 0)
        return () => {
            window.clearTimeout(done)
        }
    }, [error, hasDefault, isLoading, preparing, reloadRequested])

    return preparing
}
