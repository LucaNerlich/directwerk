import {headers} from 'next/headers'

import {resolveTenantHost} from '@/lib/tenant/resolveTenantHost'

/**
 * Resolve the tenant host for server-side Directwerk calls.
 * Loopback browser hosts (`localhost`) are not tenants — fall back to the
 * seeded default so local `pnpm dev` on localhost works.
 */
export async function getTenantHost(): Promise<string> {
    const headerStore = await headers()
    // Prefer the canonical `host` (the request's routed host, protected by TLS/SNI)
    // over `x-forwarded-host`, which a client can spoof when the reverse proxy
    // forwards it through unmodified.
    const rawHost = headerStore.get('host') ?? headerStore.get('x-forwarded-host')
    return resolveTenantHost(rawHost)
}
