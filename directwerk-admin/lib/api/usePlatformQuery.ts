'use client'

import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'
import type {UseAuthedQueryResult} from '@directwerk/api/client/useAuthedQuery'

/**
 * Options for the admin platform query wrapper. A `fallbackError` is required
 * because every admin surface shows one fixed, user-facing message for any
 * non-authentication failure (raw error text is never rendered).
 */
export interface PlatformQueryOptions {
    fallbackError: string
    /** When false, skip the fetch and reset to the empty state (e.g. invalid id). */
    enabled?: boolean
    /** Overrides the default "always use fallbackError" error mapping. */
    mapError?: (error: unknown) => string | null
    /** Stable identity derived from every request parameter captured by the fetcher. */
    queryKey?: string
}

/**
 * Authenticated platform-admin query. Thin wrapper over {@link useAuthedQuery}
 * that pins the admin fallback error and delegates `AUTH_REQUIRED` handling to
 * the shared hook (redirect to `/login`).
 *
 * @param fetcher - Asynchronous platform API operation.
 * @param options - Fallback error, conditional fetch, and request identity.
 * @returns The shared query result: data, error, loading state, reload, setter.
 */
export function usePlatformQuery<T>(
    fetcher: () => Promise<T>,
    options: PlatformQueryOptions,
): UseAuthedQueryResult<T> {
    const {fallbackError, mapError, ...rest} = options

    return useAuthedQuery(fetcher, {
        ...rest,
        fallbackError,
        mapError: mapError ?? (() => fallbackError),
    })
}

/**
 * Convenience wrapper for queries scoped to a tenant. Defaults the query key to
 * the tenant id so changing tenants refetches; pass an explicit `queryKey` to
 * fold in additional request parameters (filters, pagination).
 *
 * @param tenantId - Tenant whose data is requested.
 * @param fetcher - Asynchronous platform API operation.
 * @param options - Fallback error, conditional fetch, and request identity.
 * @returns The shared query result: data, error, loading state, reload, setter.
 */
export function useTenantPlatformQuery<T>(
    tenantId: string,
    fetcher: () => Promise<T>,
    options: PlatformQueryOptions,
): UseAuthedQueryResult<T> {
    return usePlatformQuery(fetcher, {
        ...options,
        queryKey: options.queryKey ?? `tenant:${tenantId}`,
    })
}
