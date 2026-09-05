import type {MetadataRoute} from 'next'
import {headers} from 'next/headers'

import {parseTenantHost} from '@directwerk/api/proxy'

import {
    fetchPublicArticleSlugsServer,
    fetchPublicEpisodeSlugsServer,
} from '@/lib/site/fetchPublicContentServer'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {resolveTenantOrigin} from '@/lib/site/siteOrigin'

function toLastModified(
    publishedAt: string | null,
): Date | undefined {
    if (publishedAt === null) {
        return undefined
    }
    const parsed = new Date(publishedAt)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headerStore = await headers()
    const rawHost =
        headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    // Same validation as robots.ts — never build canonical URLs from a raw
    // forwarded host.
    const firstHost = rawHost?.split(',')[0]?.trim() ?? null
    const validatedHost = parseTenantHost(firstHost)
    const origin = resolveTenantOrigin(validatedHost)

    // Static routes carry no per-request timestamp: `lastModified` must be
    // stable so crawlers do not see every page as changed on each fetch.
    const staticRoutes: MetadataRoute.Sitemap = [
        '',
        '/articles',
        '/episodes',
        '/feeds',
        '/pricing',
    ].map((path) => ({
        url: `${origin}${path}`,
    }))

    let articleEntries: MetadataRoute.Sitemap = []
    let episodeEntries: MetadataRoute.Sitemap = []
    let feedEntries: MetadataRoute.Sitemap = []
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        const [articles, episodes] = await Promise.all([
            fetchPublicArticleSlugsServer(host),
            fetchPublicEpisodeSlugsServer(host),
        ])
        articleEntries = articles.map((article) => ({
            url: `${origin}/articles/${encodeURIComponent(article.slug)}`,
            lastModified: toLastModified(article.publishedAt),
        }))
        episodeEntries = episodes.map((episode) => ({
            url: `${origin}/episodes/${encodeURIComponent(episode.slug)}`,
            lastModified: toLastModified(episode.publishedAt),
        }))

        // Public feed discovery: cheap same-fetch additions from site-config.
        try {
            const config = await fetchSiteConfigServer(host)
            const feedUrls = [config.publicRssUrl, config.publicArticleRssUrl]
            feedEntries = feedUrls.flatMap((feedUrl) =>
                feedUrl === null || feedUrl.length === 0
                    ? []
                    : [{url: feedUrl}],
            )
        } catch {
            // Feed URLs are best-effort — the page entries above still stand.
        }
    } catch {
        // A failing backend must not break the whole sitemap.
    }

    return [...staticRoutes, ...articleEntries, ...episodeEntries, ...feedEntries]
}
