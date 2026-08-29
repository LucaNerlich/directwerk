/**
 * Public RSS feed URL grammar — must stay identical to Java {@code FeedUrls}
 * and {@code RssFeedController} route mappings.
 *
 * Prefer server-provided absolute URLs from API responses (`publicRssUrl`, `rssUrl`)
 * when available; this module is a fallback for legacy client-side construction.
 */

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

/** Browser-safe tenant-wide public podcast feed URL. */
export function publicPodcastFeedUrl(originHost: string, tenantSlug: string): string {
    const origin = normalizeOrigin(originHost)
    return `${origin}/feeds/${encodeURIComponent(tenantSlug)}/podcast.xml`
}
