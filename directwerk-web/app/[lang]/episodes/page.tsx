import {connection} from 'next/server'

import {fetchPublicEpisodesServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

import EpisodesClient from './episodes-client'

/**
 * Server-seeds the public episode catalog so anonymous first paint is not a
 * client JS + BFF waterfall (#855).
 */
export default async function EpisodesPage(): Promise<React.JSX.Element> {
    await connection()

    let initialEpisodes: Awaited<ReturnType<typeof fetchPublicEpisodesServer>> = null
    try {
        const host = await getTenantHost()
        if (host !== null && host.length > 0) {
            initialEpisodes = await fetchPublicEpisodesServer(host)
        }
    } catch {
        initialEpisodes = null
    }

    return <EpisodesClient initialEpisodes={initialEpisodes} />
}
