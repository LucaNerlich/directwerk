import 'server-only'

import {fetchSiteConfigServerOptional as fetchSiteConfigSharedOptional} from '@directwerk/api/server'
import {parseStudioSiteConfigEnvelope} from '@directwerk/api/validation/catalog'

import type {SiteConfig} from '@directwerk/api/types'
import {directwerkFetch} from '@/lib/server/api'

export async function fetchSiteConfigServerOptional(
    host: string,
): Promise<SiteConfig | null> {
    return fetchSiteConfigSharedOptional({
        fetch: directwerkFetch,
        host,
        parseEnvelope: parseStudioSiteConfigEnvelope,
    })
}
