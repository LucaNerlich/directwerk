import 'server-only'

import {headers} from 'next/headers'

import {resolveTenantHostFromHeaders} from '@directwerk/api/tenant'

import {fetchSiteConfigServerOptional} from '@/lib/site/fetchSiteConfigServer'

/** Resolves a verified tenant routing host for the public site. */
export async function getTenantHost(): Promise<string | null> {
    const headerStore = await headers()
    const candidate = resolveTenantHostFromHeaders(headerStore, {
        preferForwardedHost: true,
    })
    if (candidate === null) {
        return null
    }

    const config = await fetchSiteConfigServerOptional(candidate)
    return config === null ? null : candidate
}
