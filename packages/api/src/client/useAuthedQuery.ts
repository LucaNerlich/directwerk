'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

import {useAuthRequired} from '../auth/useAuthRequired'

export interface UseAuthedQueryResult<T> {
    data: T | null
    error: string | null
    isLoading: boolean
    reload: () => void
    setData: React.Dispatch<React.SetStateAction<T | null>>
}

export interface UseAuthedQueryOptions {
    fallbackError?: string
    /** When false, skip the fetch and reset to the empty state (e.g. signed out). */
    enabled?: boolean
    /** Maps a thrown error to a user-facing message; returning null uses fallbackError. */
    mapError?: (error: unknown) => string | null
}

/**
 * Fetches authenticated data and exposes its loading, error, and reload state.
 *
 * @param fetcher - Asynchronous operation that retrieves the data
 * @param options - Optional configuration: fallback error, conditional fetch, error mapping
 * @returns The fetched data, current error message, loading state, reload function, and setter
 */
export function useAuthedQuery<T>(
    fetcher: () => Promise<T>,
    options: UseAuthedQueryOptions = {},
): UseAuthedQueryResult<T> {
    const authRedirect = useAuthRequired()
    const fallbackError = options.fallbackError ?? 'Laden fehlgeschlagen.'
    const enabled = options.enabled ?? true

    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reloadToken, setReloadToken] = useState(0)

    const reload = useCallback(() => {
        setReloadToken((current) => current + 1)
    }, [])

    // Latest fetcher wins without forcing callers to stabilize it: storing in
    // a ref avoids stale closures over changed props (tenant host, IDs).
    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    const mapErrorRef = useRef(options.mapError)
    mapErrorRef.current = options.mapError

    useEffect(() => {
        if (!enabled) {
            setData(null)
            setError(null)
            setIsLoading(false)
            return
        }

        let active = true
        setIsLoading(true)
        setError(null)

        fetcherRef.current()
            .then((result) => {
                if (!active) {
                    return
                }
                setData(result)
            })
            .catch((caught: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(caught)) {
                    return
                }
                const mapped = mapErrorRef.current?.(caught) ?? null
                setError(mapped ?? (caught instanceof Error ? caught.message : fallbackError))
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [authRedirect, enabled, fallbackError, reloadToken])

    return {data, error, isLoading, reload, setData}
}
