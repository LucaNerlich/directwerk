/**
 * Helpers for public podcast RSS URLs that open in the browser.
 *
 * Prefer {@code site-config.publicRssUrl} from the API (correct scheme/port).
 * Fallbacks use HTTP for loopback hosts so local feeds work without TLS.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLoopbackHostname(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase()
    if (LOOPBACK_HOSTS.has(normalized)) {
        return true
    }
    return normalized.endsWith('.localhost')
}

/**
 * Origin used for clickable feed links. Uses HTTP on loopback, HTTPS elsewhere.
 * Includes `:8080` for bare localhost-style hosts when no origin is provided —
 * callers should prefer {@link feedOriginFromPublicRssUrl}.
 */
export function publicFeedOrigin(hostname: string, apiPort = 8080): string {
    const host = hostname.trim().toLowerCase()
    if (isLoopbackHostname(host)) {
        const hasPort = host.includes(':')
        if (hasPort) {
            return `http://${host}`
        }
        return `http://${host}:${apiPort}`
    }
    return `https://${host}`
}

/**
 * Extract origin from API-provided publicRssUrl (e.g. http://alpha-a.localhost:8080/feeds/…/podcast.xml).
 */
export function feedOriginFromPublicRssUrl(publicRssUrl: string | null | undefined): string | null {
    if (publicRssUrl === null || publicRssUrl === undefined || publicRssUrl.trim().length === 0) {
        return null
    }
    try {
        return new URL(publicRssUrl).origin
    } catch {
        return null
    }
}

/**
 * Public series RSS URL (FREE published episodes for that show).
 */
export function publicSeriesFeedUrl(
    originOrHost: string,
    tenantSlug: string,
    seriesSlug: string,
): string {
    const origin = originOrHost.includes('://')
        ? originOrHost.replace(/\/$/, '')
        : publicFeedOrigin(originOrHost)
    return (
        `${origin}/feeds/${encodeURIComponent(tenantSlug)}/` +
        `${encodeURIComponent(seriesSlug)}.xml`
    )
}

/**
 * Tenant-wide public podcast feed (all FREE published episodes).
 */
export function publicPodcastFeedUrl(originOrHost: string, tenantSlug: string): string {
    const origin = originOrHost.includes('://')
        ? originOrHost.replace(/\/$/, '')
        : publicFeedOrigin(originOrHost)
    return `${origin}/feeds/${encodeURIComponent(tenantSlug)}/podcast.xml`
}

/** True when a feed URL is safe to accept from the API (https, or http on loopback). */
export function isAllowedFeedUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:') {
            return true
        }
        if (parsed.protocol === 'http:') {
            return isLoopbackHostname(parsed.hostname)
        }
        return false
    } catch {
        return false
    }
}
