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
    /** Stable identity derived from every request parameter captured by the fetcher. */
    queryKey?: string
}

interface QueryState<T> {
    identity: string
    data: T | null
    error: string | null
    isLoading: boolean
}

const DEFAULT_QUERY_KEY = 'default'

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
    const queryKey = options.queryKey ?? DEFAULT_QUERY_KEY

    const [state, setState] = useState<QueryState<T>>({
        identity: queryKey,
        data: null,
        error: null,
        isLoading: enabled,
    })
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

    // The redirect handler must not restart the query when it changes identity.
    // Tests (and some callers) return a fresh closure per render; depending on
    // it directly would refetch every render.
    const authRedirectRef = useRef(authRedirect)
    authRedirectRef.current = authRedirect

    const setData = useCallback<React.Dispatch<React.SetStateAction<T | null>>>(
        (action) => {
            setState((current) => {
                const currentData = current.identity === queryKey ? current.data : null
                const data = typeof action === 'function'
                    ? (action as (value: T | null) => T | null)(currentData)
                    : action
                return {
                    identity: queryKey,
                    data,
                    error: current.identity === queryKey ? current.error : null,
                    isLoading: current.identity === queryKey ? current.isLoading : enabled,
                }
            })
        },
        [enabled, queryKey],
    )

    useEffect(() => {
        if (!enabled) {
            setState({identity: queryKey, data: null, error: null, isLoading: false})
            return
        }

        let active = true
        setState((current) => ({
            identity: queryKey,
            data: current.identity === queryKey ? current.data : null,
            error: null,
            isLoading: true,
        }))

        fetcherRef.current()
            .then((result) => {
                if (!active) {
                    return
                }
                setState({identity: queryKey, data: result, error: null, isLoading: true})
            })
            .catch((caught: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirectRef.current(caught)) {
                    return
                }
                const mapper = mapErrorRef.current
                const mapped = mapper?.(caught)
                const message = mapper === undefined
                    ? (caught instanceof Error ? caught.message : fallbackError)
                    : (mapped ?? fallbackError)
                setState((current) => ({...current, identity: queryKey, error: message}))
            })
            .finally(() => {
                if (active) {
                    setState((current) => ({...current, identity: queryKey, isLoading: false}))
                }
            })

        return () => {
            active = false
        }
    }, [enabled, fallbackError, queryKey, reloadToken])

    const visibleState = state.identity === queryKey
        ? state
        : {identity: queryKey, data: null, error: null, isLoading: enabled}
    return {
        data: visibleState.data,
        error: visibleState.error,
        isLoading: visibleState.isLoading,
        reload,
        setData,
    }
}
