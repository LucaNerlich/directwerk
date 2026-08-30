import 'server-only'

import {headers} from 'next/headers'

import {resolveTenantHostFromHeaders} from '@directwerk/api/tenant'

/** Resolves the tenant routing host from incoming request headers. */
export async function getTenantHost(): Promise<string | null> {
    const headerStore = await headers()
    return resolveTenantHostFromHeaders(headerStore, {
        preferForwardedHost: true,
    })
}
