import 'server-only'

import {cache} from 'react'

import {fetchSiteConfigServerOptional as fetchSiteConfigSharedOptional} from '@directwerk/api/server'
import {parsePublicSiteConfigEnvelope} from '@directwerk/api/validation/public'

import type {PublicSiteConfig} from '@directwerk/api/types'
import {directwerkFetch} from '@/lib/server/api'

async function fetchSiteConfigServerOptional(
    host: string,
): Promise<PublicSiteConfig | null> {
    return fetchSiteConfigSharedOptional({
        fetch: directwerkFetch,
        host,
        parseEnvelope: parsePublicSiteConfigEnvelope,
    })
}

/**
 * Issue #340: generateMetadata, generateViewport and the layout each called this for the same
 * host, issuing three round trips per page render (the underlying node:http transport is not
 * memoized by Next's fetch cache). React's request-scoped cache collapses them to one.
 */
export const fetchSiteConfigServer = cache(async (host: string): Promise<PublicSiteConfig> => {
    const config = await fetchSiteConfigServerOptional(host)
    if (config === null) {
        throw new Error('site-config unavailable')
    }
    return config
})
