import 'server-only'

import {cookies, headers} from 'next/headers'

import {
    resolveTenantHostFromHeaders,
    TENANT_HOST_COOKIE,
} from '@directwerk/api/tenant'

import {fetchSiteConfigServerOptional} from '@/lib/site/fetchSiteConfigServer'

async function resolveCandidateTenantHost(): Promise<string | null> {
    const headerStore = await headers()
    const cookieStore = await cookies()
    return resolveTenantHostFromHeaders(headerStore, {
        preferForwardedHost: false,
        selectedTenantHost: cookieStore.get(TENANT_HOST_COOKIE)?.value ?? null,
    })
}

/** Resolves a verified tenant routing host, or null on shared studio URLs. */
export async function getTenantHost(): Promise<string | null> {
    const candidate = await resolveCandidateTenantHost()
    if (candidate === null) {
        return null
    }

    const config = await fetchSiteConfigServerOptional(candidate)
    return config === null ? null : candidate
}
