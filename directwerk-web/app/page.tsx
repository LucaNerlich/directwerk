import {connection} from 'next/server'

import {
    fetchPublicArticlesServer,
    fetchPublicEpisodesServer,
    fetchPublicProductsServer,
} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

import HomeClient, {type HomeInitialData} from './home-client'

/**
 * Server-renders the tenant landing hero and latest content so the first paint
 * does not wait for client JS + API round-trips. `HomeClient` keeps the public
 * data live and re-fetches the entitled catalogs after login.
 */
export default async function HomePage(): Promise<React.JSX.Element> {
    await connection()

    let initialData: HomeInitialData = {
        episodes: null,
        articles: null,
        products: null,
    }
    try {
        const host = await getTenantHost()
        if (host !== null && host.length > 0) {
            const [episodes, articles, products] = await Promise.all([
                fetchPublicEpisodesServer(host),
                fetchPublicArticlesServer(host),
                fetchPublicProductsServer(host),
            ])
            initialData = {episodes, articles, products}
        }
    } catch {
        // Fall back to the client fetch; the layout already degrades gracefully.
    }

    return <HomeClient initialData={initialData} />
}
