import 'server-only'

import {fetchSiteConfigServer as fetchSiteConfigShared} from '@directwerk/api/server'
import {parsePublicSiteConfigEnvelope} from '@directwerk/api/validation'
import type {PublicSiteConfig} from '@directwerk/api/types'
import {directwerkFetch} from '@/lib/server/api'

export async function fetchSiteConfigServer(host: string): Promise<PublicSiteConfig> {
    return fetchSiteConfigShared({
        fetch: directwerkFetch,
        host,
        parseEnvelope: parsePublicSiteConfigEnvelope,
    })
}
