import {connection} from 'next/server'

import {fetchPublicArticlesServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

import ArticlesClient from './articles-client'

/**
 * Server-seeds the public article catalog so anonymous first paint is not a
 * client JS + BFF waterfall (#855).
 */
export default async function ArticlesPage(): Promise<React.JSX.Element> {
    await connection()

    let initialArticles: Awaited<ReturnType<typeof fetchPublicArticlesServer>> = null
    try {
        const host = await getTenantHost()
        if (host !== null && host.length > 0) {
            initialArticles = await fetchPublicArticlesServer(host)
        }
    } catch {
        initialArticles = null
    }

    return <ArticlesClient initialArticles={initialArticles} />
}
