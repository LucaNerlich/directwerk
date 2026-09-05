import 'server-only'

import {headers} from 'next/headers'

import {resolveTenantHostFromHeaders} from '@directwerk/api/tenant'

/** Resolves the tenant routing host from incoming request headers. */
export async function getTenantHost(): Promise<string | null> {
    const headerStore = await headers()
    return resolveTenantHostFromHeaders(headerStore, {
        // Prefer the direct Host header: x-forwarded-host is only honored as
        // a fallback so a spoofed forwarding header cannot select another
        // tenant's config when a direct host is present. Values are still
        // validated via parseTenantHost (throws on garbage).
        preferForwardedHost: false,
    })
}
