import 'server-only'

import {cache} from 'react'

import {fetchSiteConfigServerOptional as fetchSiteConfigSharedOptional} from '@directwerk/api/server'
import {parseStudioSiteConfigEnvelope} from '@directwerk/api/validation/catalog'

import type {SiteConfig} from '@directwerk/api/types'
import {directwerkFetch} from '@/lib/server/api'

/**
 * Request-scoped dedupe for studio site-config. Layout, pages, and gates often
 * call this for the same host in one RSC tree; the node transport is not Next fetch-cached.
 */
export const fetchSiteConfigServerOptional = cache(
    async (host: string): Promise<SiteConfig | null> => {
        return fetchSiteConfigSharedOptional({
            fetch: directwerkFetch,
            host,
            parseEnvelope: parseStudioSiteConfigEnvelope,
        })
    },
)
