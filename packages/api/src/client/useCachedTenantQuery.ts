'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

import {useAuthRequired} from '../auth/useAuthRequired'
import type {UseAuthedQueryOptions, UseAuthedQueryResult} from './useAuthedQuery'

const tenantCaches = new Map<string, Map<string, Promise<unknown>>>()

function cacheKey(namespace: string, tenantHost: string): string {
    return `${namespace}:${tenantHost}`
}

function getTenantCache(namespace: string): Map<string, Promise<unknown>> {
    const existing = tenantCaches.get(namespace)
    if (existing !== undefined) {
        return existing
    }

    const created = new Map<string, Promise<unknown>>()
    tenantCaches.set(namespace, created)
    return created
}

export function fetchCachedTenantData<T>(
    namespace: string,
    tenantHost: string,
    fetcher: (host: string) => Promise<T>,
): Promise<T> {
    const cache = getTenantCache(namespace)
    const key = cacheKey(namespace, tenantHost)
    const cached = cache.get(key)
    if (cached !== undefined) {
        return cached as Promise<T>
    }

    const pending = fetcher(tenantHost).catch((error: unknown) => {
        cache.delete(key)
        throw error
    })
    cache.set(key, pending)
    return pending
}

export function clearCachedTenantData(namespace: string, tenantHost?: string): void {
    const cache = getTenantCache(namespace)
    if (tenantHost === undefined) {
        cache.clear()
        return
    }
    cache.delete(cacheKey(namespace, tenantHost))
}

export interface UseCachedTenantQueryOptions extends UseAuthedQueryOptions {
    namespace: string
    tenantHost: string
}

export function useCachedTenantQuery<T>(
    fetcher: (host: string) => Promise<T>,
    options: UseCachedTenantQueryOptions,
): UseAuthedQueryResult<T> {
    const authRedirect = useAuthRequired()
    const fallbackError = options.fallbackError ?? 'Laden fehlgeschlagen.'
    const enabled = options.enabled !== false
    const {namespace, tenantHost} = options

    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(enabled)
    const [reloadToken, setReloadToken] = useState(0)

    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    const reload = useCallback(() => {
        clearCachedTenantData(namespace, tenantHost)
        setReloadToken((current) => current + 1)
    }, [namespace, tenantHost])

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false)
            return
        }

        let active = true
        setIsLoading(true)
        setError(null)

        fetchCachedTenantData(namespace, tenantHost, fetcherRef.current)
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
    }, [authRedirect, enabled, fallbackError, namespace, reloadToken, tenantHost])

    return {data, error, isLoading, reload}
}
