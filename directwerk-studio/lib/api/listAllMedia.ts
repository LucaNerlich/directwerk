import {listMedia} from '@/lib/api/mediaApi'
import type {MediaAsset, TenantMediaQuery} from '@directwerk/api/types'

/** Matches MediaLibraryClient; API caps a page at 100 rows. */
const MEDIA_LIST_PAGE_SIZE = 100

export type ListAllMediaQuery = Omit<TenantMediaQuery, 'limit' | 'offset'>

/**
 * Walks offset/limit media pages until a short page.
 * Pickers must not stop at the API default first page (#885).
 */
export async function listAllMedia(query?: ListAllMediaQuery): Promise<MediaAsset[]> {
    const collected: MediaAsset[] = []
    let offset = 0

    for (;;) {
        const page = await listMedia({
            ...query,
            limit: MEDIA_LIST_PAGE_SIZE,
            offset,
        })
        collected.push(...page)
        if (page.length < MEDIA_LIST_PAGE_SIZE) {
            break
        }
        offset += page.length
    }

    return collected
}
