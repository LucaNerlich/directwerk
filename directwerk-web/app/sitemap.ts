import type {MetadataRoute} from 'next'

import {
    fetchPublicArticleSlugsServer,
    fetchPublicEpisodeSlugsServer,
} from '@/lib/site/fetchPublicContentServer'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {localizedSitemapEntry} from '@/lib/site/sitemapEntries'
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
    let host: string | null
    try {
        host = await getTenantHost()
    } catch {
        host = null
    }
    if (host === null) {
        return []
    }
    const origin = resolveTenantOrigin(host)

    // One `<url>` per logical page (not per locale); hreflang alternates cover de/en/x-default.
    const staticPaths = ['', '/articles', '/episodes', '/feeds', '/pricing']
    const staticRoutes: MetadataRoute.Sitemap = staticPaths.map((path) =>
        localizedSitemapEntry(origin, path),
    )

    let articleEntries: MetadataRoute.Sitemap = []
    let episodeEntries: MetadataRoute.Sitemap = []
    let feedEntries: MetadataRoute.Sitemap = []
    try {
        const [articles, episodes] = await Promise.all([
            fetchPublicArticleSlugsServer(host),
            fetchPublicEpisodeSlugsServer(host),
        ])
        articleEntries = articles.map((article) =>
            localizedSitemapEntry(
                origin,
                `/articles/${encodeURIComponent(article.slug)}`,
                toLastModified(article.publishedAt),
            ),
        )
        episodeEntries = episodes.map((episode) =>
            localizedSitemapEntry(
                origin,
                `/episodes/${encodeURIComponent(episode.slug)}`,
                toLastModified(episode.publishedAt),
            ),
        )

        try {
            const config = await fetchSiteConfigServer(host)
            const feedUrls = [config.publicRssUrl, config.publicArticleRssUrl]
            // RSS endpoints are locale-agnostic — no hreflang cluster.
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
