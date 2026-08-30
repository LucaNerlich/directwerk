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

export async function fetchSiteConfigServer(host: string): Promise<SiteConfig> {
    const config = await fetchSiteConfigServerOptional(host)
    if (config === null) {
        throw new Error(`site-config unavailable for host ${host}`)
    }
    return config
}
