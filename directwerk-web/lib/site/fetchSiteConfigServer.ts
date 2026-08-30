import 'server-only'

import {
    fetchSiteConfigServer as fetchSiteConfigShared,
    fetchSiteConfigServerOptional as fetchSiteConfigSharedOptional,
} from '@directwerk/api/server'
import {parsePublicSiteConfigEnvelope} from '@directwerk/api/validation/public'

import type {PublicSiteConfig} from '@directwerk/api/types'
import {directwerkFetch} from '@/lib/server/api'

export async function fetchSiteConfigServerOptional(
    host: string,
): Promise<PublicSiteConfig | null> {
    return fetchSiteConfigSharedOptional({
        fetch: directwerkFetch,
        host,
        parseEnvelope: parsePublicSiteConfigEnvelope,
    })
}

export async function fetchSiteConfigServer(host: string): Promise<PublicSiteConfig> {
    const config = await fetchSiteConfigServerOptional(host)
    if (config === null) {
        throw new Error(`site-config unavailable for host ${host}`)
    }
    return config
}
