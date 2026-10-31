import {listArticles} from '@/lib/api/writeApi'
import type {ArticleSummary} from '@directwerk/api/types'

/** API default/max page size for publication lists. */
const ARTICLE_LIST_PAGE_SIZE = 100

/**
 * Walks offset/limit article pages until a short page.
 * Slug checks, analytics totals, and setup must not stop at the first page (#953).
 */
export async function listAllArticles(): Promise<ArticleSummary[]> {
    const collected: ArticleSummary[] = []
    let offset = 0

    for (;;) {
        const page = await listArticles({
            limit: ARTICLE_LIST_PAGE_SIZE,
            offset,
        })
        collected.push(...page)
        if (page.length < ARTICLE_LIST_PAGE_SIZE) {
            break
        }
        offset += page.length
    }

    return collected
}
