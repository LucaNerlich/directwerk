import 'server-only'

import {fetchSiteConfigServer as fetchSiteConfigShared} from '@directwerk/api/server'
import {parseStudioSiteConfigEnvelope} from '@directwerk/api/validation/catalog'

import type {SiteConfig} from '@directwerk/api/types'
import {directwerkFetch} from '@/lib/server/api'

export async function fetchSiteConfigServer(host: string): Promise<SiteConfig> {
    return fetchSiteConfigShared({
        fetch: directwerkFetch,
        host,
        parseEnvelope: parseStudioSiteConfigEnvelope,
    })
}
