import type {MetadataRoute} from 'next'

import {locales} from '@/lib/i18n/config'
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

    const staticPaths = ['', '/articles', '/episodes', '/feeds', '/pricing']
    const staticRoutes: MetadataRoute.Sitemap = locales.flatMap((lang) =>
        staticPaths.map((path) => ({
            url: `${origin}/${lang}${path}`,
        })),
    )

    let articleEntries: MetadataRoute.Sitemap = []
    let episodeEntries: MetadataRoute.Sitemap = []
    let feedEntries: MetadataRoute.Sitemap = []
    try {
        const [articles, episodes] = await Promise.all([
            fetchPublicArticleSlugsServer(host),
            fetchPublicEpisodeSlugsServer(host),
        ])
        articleEntries = locales.flatMap((lang) =>
            articles.map((article) => ({
                url: `${origin}/${lang}/articles/${encodeURIComponent(article.slug)}`,
                lastModified: toLastModified(article.publishedAt),
            })),
        )
        episodeEntries = locales.flatMap((lang) =>
            episodes.map((episode) => ({
                url: `${origin}/${lang}/episodes/${encodeURIComponent(episode.slug)}`,
                lastModified: toLastModified(episode.publishedAt),
            })),
        )

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
