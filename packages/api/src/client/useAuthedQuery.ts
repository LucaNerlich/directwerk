'use client'

import {useCallback, useEffect, useState} from 'react'

import {useAuthRequired} from '../auth/useAuthRequired'

export interface UseAuthedQueryResult<T> {
    data: T | null
    error: string | null
    isLoading: boolean
    reload: () => void
}

export interface UseAuthedQueryOptions {
    fallbackError?: string
    enabled?: boolean
}

export function useAuthedQuery<T>(
    fetcher: () => Promise<T>,
    options: UseAuthedQueryOptions = {},
): UseAuthedQueryResult<T> {
    const authRedirect = useAuthRequired()
    const fallbackError = options.fallbackError ?? 'Laden fehlgeschlagen.'
    const enabled = options.enabled !== false

    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(enabled)
    const [reloadToken, setReloadToken] = useState(0)

    const reload = useCallback(() => {
        setReloadToken((current) => current + 1)
    }, [])

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false)
            return
        }

        let active = true
        setIsLoading(true)
        setError(null)

        fetcher()
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
                setError(
                    caught instanceof Error ? caught.message : fallbackError,
                )
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

    return {data, error, isLoading, reload}
}
