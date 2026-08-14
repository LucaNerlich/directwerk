import 'server-only'

import {directwerkFetch} from '@/lib/directwerk'
import {parseSiteConfigEnvelope} from '@/lib/api/responseValidation'
import type {SiteConfig} from '@/lib/api/types'

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
    const parsed = parseSiteConfigEnvelope(value)
    if (parsed === null) {
        throw new Error(`site-config response invalid for host ${host}`)
    }

    return parsed.data
}
