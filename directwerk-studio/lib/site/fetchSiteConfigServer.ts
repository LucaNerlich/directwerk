import 'server-only'

import {directwerkFetch} from '@/lib/server/api'
import {parseStudioSiteConfigEnvelope} from '@directwerk/api/validation'
import type {SiteConfig} from '@directwerk/api/types'

export async function fetchSiteConfigServer(host: string): Promise<SiteConfig> {
    const response = await directwerkFetch({
        path: '/api/v1/public/site-config',
        tenantHost: host,
        method: 'GET',
    })

    if (!response.ok) {
        throw new Error(
            `site-config request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const value: unknown = await response.json()
    const parsed = parseStudioSiteConfigEnvelope(value)
    if (parsed === null) {
        throw new Error(`site-config response invalid for host ${host}`)
    }

    return parsed.data
}
