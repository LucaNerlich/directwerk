import 'server-only'

import {cookies, headers} from 'next/headers'

import {
    resolveTenantHostFromHeaders,
    TENANT_HOST_COOKIE,
} from '@directwerk/api/tenant'

async function resolveCandidateTenantHost(): Promise<string | null> {
    const headerStore = await headers()
    const cookieStore = await cookies()
    return resolveTenantHostFromHeaders(headerStore, {
        preferForwardedHost: false,
        selectedTenantHost: cookieStore.get(TENANT_HOST_COOKIE)?.value ?? null,
    })
}

export async function getTenantHost(): Promise<string | null> {
    return resolveCandidateTenantHost()
}
