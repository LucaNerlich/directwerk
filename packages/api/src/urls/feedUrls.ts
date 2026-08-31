/**
 * Public RSS feed URL grammar — must stay identical to Java {@code FeedUrls}
 * and {@code RssFeedController} route mappings.
 *
 * Prefer server-provided absolute URLs from API responses (`publicRssUrl`, `rssUrl`)
 * when available; this module is a fallback for legacy client-side construction.
 */

import type {PublicSiteConfig} from '../types'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLoopbackHostname(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase()
    if (LOOPBACK_HOSTS.has(normalized)) {
        return true
    }
    return normalized.endsWith('.localhost')
}

/** Resolve an API/public origin from a hostname (no path). */
export function publicFeedOrigin(hostname: string, apiPort = 8080): string {
    const host = hostname.trim().toLowerCase()
    if (isLoopbackHostname(host)) {
        if (host.includes(':')) {
            return `http://${host}`
        }
        return `http://${host}:${apiPort}`
    }
    return `https://${host}`
}

function normalizeOrigin(originOrHost: string): string {
    if (originOrHost.includes('://')) {
        return originOrHost.replace(/\/$/, '')
    }
    return publicFeedOrigin(originOrHost)
}

/** Public tenant-level podcast feed: `/feeds/{tenantSlug}/podcast.xml`. */
export function tenantPodcastFeed(origin: string, tenantSlug: string): string {
    return `${normalizeOrigin(origin)}/feeds/${tenantSlug}/podcast.xml`
}

/** Public per-series feed: `/feeds/{tenantSlug}/{seriesSlug}.xml`. */
export function seriesFeed(
    origin: string,
    tenantSlug: string,
    seriesSlug: string,
): string {
    return `${normalizeOrigin(origin)}/feeds/${tenantSlug}/${seriesSlug}.xml`
}

/** Token-authenticated subscriber feed: `/feeds/{tenantSlug}/u/{feedToken}.xml`. */
export function subscriberFeed(
    origin: string,
    tenantSlug: string,
    feedToken: string,
): string {
    return `${normalizeOrigin(origin)}/feeds/${tenantSlug}/u/${feedToken}.xml`
}

/** Public episode enclosure proxy: `/feeds/{tenantSlug}/e/{episodeSlug}.mp3`. */
export function publicEnclosure(
    origin: string,
    tenantSlug: string,
    episodeSlug: string,
): string {
    return `${normalizeOrigin(origin)}/feeds/${tenantSlug}/e/${episodeSlug}.mp3`
}

/** Private episode enclosure proxy. */
export function privateEnclosure(
    origin: string,
    tenantSlug: string,
    feedToken: string,
    episodeSlug: string,
): string {
    return (
        `${normalizeOrigin(origin)}/feeds/${tenantSlug}/u/${feedToken}` +
        `/e/${episodeSlug}.mp3`
    )
}

/** Browser-safe series feed URL with encoded path segments. */
export function publicSeriesFeedUrl(
    originHost: string,
    tenantSlug: string,
    seriesSlug: string,
): string {
    const origin = normalizeOrigin(originHost)
    return (
        `${origin}/feeds/${encodeURIComponent(tenantSlug)}/` +
        `${encodeURIComponent(seriesSlug)}.xml`
    )
}

/** Public tenant-level article feed: `/feeds/{tenantSlug}/articles.xml`. */
export function tenantArticleFeed(origin: string, tenantSlug: string): string {
    return `${normalizeOrigin(origin)}/feeds/${encodeURIComponent(tenantSlug)}/articles.xml`
}

/** Browser-safe tenant-wide public article feed URL. */
export function publicArticleFeedUrl(originHost: string, tenantSlug: string): string {
    return tenantArticleFeed(normalizeOrigin(originHost), tenantSlug)
}

export interface ResolvePublicArticleFeedUrlOptions {
    /** Tenant request host when no absolute origin is available. */
    originHost?: string
    /** Same-origin web app base URL (preferred for directwerk-web feed proxy). */
    webOrigin?: string
}

/**
 * Resolves the public article RSS URL for a tenant site config.
 * Falls back to a constructed URL when the API value was omitted or stripped
 * by client validation, as long as {@code ARTICLE_RSS} is enabled.
 */
export function resolvePublicArticleFeedUrl(
    config: Pick<
        PublicSiteConfig,
        'enabledModules' | 'publicArticleRssUrl' | 'publicSiteUrl' | 'tenant'
    >,
    options: ResolvePublicArticleFeedUrlOptions = {},
): string | null {
    if (!config.enabledModules.includes('ARTICLE_RSS')) {
        return null
    }

    const preferredOrigin =
        options.webOrigin ?? config.publicSiteUrl ?? options.originHost ?? null
    if (preferredOrigin !== null) {
        return tenantArticleFeed(preferredOrigin, config.tenant.slug)
    }

    return config.publicArticleRssUrl
}

export interface ResolvePublicPodcastFeedUrlOptions {
    originHost?: string
    webOrigin?: string
}

/** Podcast counterpart to {@link resolvePublicArticleFeedUrl}. */
export function resolvePublicPodcastFeedUrl(
    config: Pick<
        PublicSiteConfig,
        'enabledModules' | 'publicRssUrl' | 'publicSiteUrl' | 'tenant'
    >,
    options: ResolvePublicPodcastFeedUrlOptions = {},
): string | null {
    if (!config.enabledModules.includes('PODCAST_RSS')) {
        return null
    }

    const preferredOrigin =
        options.webOrigin ?? config.publicSiteUrl ?? options.originHost ?? null
    if (preferredOrigin !== null) {
        return tenantPodcastFeed(preferredOrigin, config.tenant.slug)
    }

    return config.publicRssUrl
}

/** Browser-safe tenant-wide public podcast feed URL. */
export function publicPodcastFeedUrl(originHost: string, tenantSlug: string): string {
    return tenantPodcastFeed(normalizeOrigin(originHost), tenantSlug)
}
