import 'server-only'

import {unstable_cache} from 'next/cache'

/** Cross-request TTL for anonymous public BFF JSON (site-config, catalogs). */
export const PUBLIC_BFF_REVALIDATE_SECONDS = 60

/**
 * Cache a public (cookie-free) BFF read per tenant host.
 * Do not wrap entitled or cookie-bearing requests.
 */
export function cachePublicBffByHost<T>(
    key: string,
    host: string,
    load: () => Promise<T>,
): Promise<T> {
    return unstable_cache(load, ['public-bff', key, host], {
        revalidate: PUBLIC_BFF_REVALIDATE_SECONDS,
        tags: [`public-bff:${key}:${host}`],
    })()
}

/**
 * Cache a public BFF read per tenant host + slug (article/newsletter detail).
 */
export function cachePublicBffByHostSlug<T>(
    key: string,
    host: string,
    slug: string,
    load: () => Promise<T>,
): Promise<T> {
    return unstable_cache(load, ['public-bff', key, host, slug], {
        revalidate: PUBLIC_BFF_REVALIDATE_SECONDS,
        tags: [`public-bff:${key}:${host}`],
    })()
}
