'use client'

import {useCallback, useEffect, useRef} from 'react'

import {useAuthedQuery} from './useAuthedQuery'
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

/**
 * Provides an authenticated query that caches data separately for each tenant.
 *
 * @param fetcher - Fetches tenant data using the tenant host.
 * @param options - Configures the cache namespace, tenant host, and fallback error.
 * @returns The query result with a reload function that clears the tenant cache before fetching fresh data.
 */
export function useCachedTenantQuery<T>(
    fetcher: (host: string) => Promise<T>,
    options: UseCachedTenantQueryOptions,
): UseAuthedQueryResult<T> {
    const {namespace, tenantHost, fallbackError} = options

    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    const cachedFetcher = useCallback(
        () => fetchCachedTenantData(namespace, tenantHost, fetcherRef.current),
        [namespace, tenantHost],
    )

    const query = useAuthedQuery(cachedFetcher, {fallbackError})

    const isMounted = useRef(false)
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true
            return
        }
        query.reload()
    }, [namespace, query.reload, tenantHost])

    const reload = useCallback(() => {
        clearCachedTenantData(namespace, tenantHost)
        query.reload()
    }, [namespace, query.reload, tenantHost])

    return {...query, reload}
}
