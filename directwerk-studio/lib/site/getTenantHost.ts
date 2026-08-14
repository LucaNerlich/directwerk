import {headers} from 'next/headers'

import {resolveTenantHost} from '@/lib/tenant/resolveTenantHost'

/**
 * Resolve the tenant host for server-side Directwerk calls.
 * Loopback browser hosts (`localhost`) are not tenants — fall back to the
 * seeded default so local `pnpm dev` on localhost works.
 */
export async function getTenantHost(): Promise<string> {
    const headerStore = await headers()
    const rawHost = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    return resolveTenantHost(rawHost)
}
