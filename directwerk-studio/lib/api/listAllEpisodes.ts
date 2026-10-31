import {listEpisodes} from '@/lib/api/podcastApi'
import type {EpisodeSummary} from '@directwerk/api/types'

/** API default/max page size for publication lists. */
const EPISODE_LIST_PAGE_SIZE = 100

/**
 * Walks offset/limit episode pages until a short page.
 * Slug checks, analytics totals, and setup must not stop at the first page (#953).
 */
export async function listAllEpisodes(): Promise<EpisodeSummary[]> {
    const collected: EpisodeSummary[] = []
    let offset = 0

    for (;;) {
        const page = await listEpisodes({
            limit: EPISODE_LIST_PAGE_SIZE,
            offset,
        })
        collected.push(...page)
        if (page.length < EPISODE_LIST_PAGE_SIZE) {
            break
        }
        offset += page.length
    }

    return collected
}
