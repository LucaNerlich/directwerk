import 'server-only'

import {cache} from 'react'

import {fetchSiteConfigServerOptional as fetchSiteConfigSharedOptional} from '@directwerk/api/server'
import {parsePublicSiteConfigEnvelope} from '@directwerk/api/validation/public'

import type {PublicSiteConfig} from '@directwerk/api/types'
import {directwerkFetch} from '@/lib/server/api'
import {cachePublicBffByHost} from '@/lib/site/publicBffCache'

async function loadSiteConfigOptional(host: string): Promise<PublicSiteConfig | null> {
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
 * Issue #857: unstable_cache adds a short cross-request TTL for anonymous public config.
 */
export const fetchSiteConfigServer = cache(async (host: string): Promise<PublicSiteConfig> => {
    // Throw inside the cache boundary so a miss is not stored for the TTL.
    const config = await cachePublicBffByHost('site-config', host, async () => {
        const loaded = await loadSiteConfigOptional(host)
        if (loaded === null) {
            throw new Error('site-config unavailable')
        }
        return loaded
    })
    return config
})
