/**
 * Build public RSS URLs. Prefer site-config.publicRssUrl from the API.
 * Fallbacks use HTTP for loopback hosts so local feeds open without TLS.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLoopbackHostname(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase()
    if (LOOPBACK_HOSTS.has(normalized)) {
        return true
    }
    return normalized.endsWith('.localhost')
}

function publicFeedOrigin(hostname: string, apiPort = 8080): string {
    const host = hostname.trim().toLowerCase()
    if (isLoopbackHostname(host)) {
        if (host.includes(':')) {
            return `http://${host}`
        }
        return `http://${host}:${apiPort}`
    }
    return `https://${host}`
}

/**
 * Build public series RSS URL.
 * Matches Directwerk GET /feeds/{tenantSlug}/{seriesSlug}.xml
 */
export function publicSeriesFeedUrl(
    originHost: string,
    tenantSlug: string,
    seriesSlug: string,
): string {
    const origin = originHost.includes('://')
        ? originHost.replace(/\/$/, '')
        : publicFeedOrigin(originHost)
    return (
        `${origin}/feeds/${encodeURIComponent(tenantSlug)}/` +
        `${encodeURIComponent(seriesSlug)}.xml`
    )
}

/**
 * Tenant-wide public podcast feed.
 * Matches Directwerk GET /feeds/{tenantSlug}/podcast.xml
 */
export function publicPodcastFeedUrl(originHost: string, tenantSlug: string): string {
    const origin = originHost.includes('://')
        ? originHost.replace(/\/$/, '')
        : publicFeedOrigin(originHost)
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
