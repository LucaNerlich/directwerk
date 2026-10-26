import 'server-only'

import {directwerkFetch} from '@/lib/server/api'
import {parseLevelListEnvelope} from '@directwerk/api/validation'
import type {LevelSummary} from '@directwerk/api/types'

/**
 * Lists public membership levels for server-rendered pricing. Returns `null`
 * on upstream failure so the client can fall back to its own fetch.
 */
export async function fetchPublicLevelsServer(
    host: string,
): Promise<LevelSummary[] | null> {
    try {
        const response = await directwerkFetch({
            path: '/api/v1/public/levels',
            tenantHost: host,
            method: 'GET',
        })
        if (!response.ok) {
            return null
        }
        const parsed = parseLevelListEnvelope(await response.json())
        return parsed === null ? null : parsed.data
    } catch {
        return null
    }
}
