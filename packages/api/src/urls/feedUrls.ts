/**
 * Public RSS feed URL grammar — must stay identical to Java {@code FeedUrls}
 * and {@code RssFeedController} route mappings.
 *
 * Prefer server-provided absolute URLs from API responses (`publicRssUrl`, `rssUrl`)
 * when available; this module is a fallback for legacy client-side construction.
 */

import type {PublicSiteConfig} from '../types'
import {isAllowedFeedUrl} from '../validation/primitives'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLoopbackHostname(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase()
    if (LOOPBACK_HOSTS.has(normalized)) {
        return true
    }
    return normalized.endsWith('.localhost')
}

const HOSTNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/

/** Resolve an API/public origin from a hostname (no path). */
export function publicFeedOrigin(hostname: string, apiPort = 8080): string {
    const host = hostname.trim().toLowerCase()
    if (
        host.length === 0 ||
        host.includes('/') ||
        host.includes('?') ||
        host.includes('#') ||
        host.includes('@') ||
        /\s/.test(host)
    ) {
        throw new Error('Invalid feed origin host')
    }
    let parsed: URL
    try {
        parsed = new URL(`http://${host}`)
    } catch {
        throw new Error('Invalid feed origin host')
    }
    const closingBracket = host.startsWith('[') ? host.indexOf(']') : -1
    const portSeparator =
        closingBracket >= 0 ? closingBracket + 1 : host.lastIndexOf(':')
    const hasExplicitPort =
        portSeparator >= 0 && host.charAt(portSeparator) === ':'
    const explicitPort = hasExplicitPort ? host.slice(portSeparator + 1) : null
    if (
        parsed.username.length > 0 ||
        parsed.password.length > 0 ||
        parsed.pathname !== '/' ||
        parsed.search.length > 0 ||
        parsed.hash.length > 0 ||
        (explicitPort !== null && !/^\d+$/.test(explicitPort))
    ) {
        throw new Error('Invalid feed origin host')
    }
    const parsedHostname = parsed.hostname.toLowerCase()
    const loopback = isLoopbackHostname(parsedHostname)
    if (!loopback && !HOSTNAME_PATTERN.test(parsedHostname)) {
        throw new Error('Invalid feed origin host')
    }
    const authority =
        explicitPort === null
            ? parsed.hostname
            : `${parsed.hostname}:${Number(explicitPort)}`
    if (loopback) {
        if (explicitPort !== null) {
            return `http://${authority}`
        }
        return `http://${parsed.hostname}:${apiPort}`
    }
    return `https://${authority}`
}

function normalizeOrigin(originOrHost: string): string {
    if (originOrHost.includes('://')) {
        let candidate: string
        try {
            candidate = new URL(originOrHost).origin
        } catch {
            throw new Error('Invalid feed origin')
        }
        if (!isAllowedFeedUrl(candidate)) {
            throw new Error('Invalid feed origin')
        }
        return candidate
    }
    return publicFeedOrigin(originOrHost)
}

/** Public tenant-level podcast feed: `/feeds/{tenantSlug}/podcast.xml`. */
export function tenantPodcastFeed(origin: string, tenantSlug: string): string {
    return `${normalizeOrigin(origin)}/feeds/${encodeURIComponent(tenantSlug)}/podcast.xml`
}

/** Public per-series feed: `/feeds/{tenantSlug}/{seriesSlug}.xml`. */
export function seriesFeed(
    origin: string,
    tenantSlug: string,
    seriesSlug: string,
): string {
    return `${normalizeOrigin(origin)}/feeds/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(seriesSlug)}.xml`
}

/** Token-authenticated subscriber feed: `/feeds/{tenantSlug}/u/{feedToken}.xml`. */
export function subscriberFeed(
    origin: string,
    tenantSlug: string,
    feedToken: string,
): string {
    return `${normalizeOrigin(origin)}/feeds/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(feedToken)}.xml`
}

/** Public episode enclosure proxy: `/feeds/{tenantSlug}/e/{episodeSlug}.mp3`. */
export function publicEnclosure(
    origin: string,
    tenantSlug: string,
    episodeSlug: string,
): string {
    return `${normalizeOrigin(origin)}/feeds/${encodeURIComponent(tenantSlug)}/e/${encodeURIComponent(episodeSlug)}.mp3`
}

/** Private episode enclosure proxy. */
export function privateEnclosure(
    origin: string,
    tenantSlug: string,
    feedToken: string,
    episodeSlug: string,
): string {
    return (
        `${normalizeOrigin(origin)}/feeds/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(feedToken)}` +
        `/e/${encodeURIComponent(episodeSlug)}.mp3`
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
        try {
            return tenantArticleFeed(preferredOrigin, config.tenant.slug)
        } catch {
            // Unvalidated caller-supplied origin — fall through to the
            // server-provided (validated) URL below.
        }
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
        try {
            return tenantPodcastFeed(preferredOrigin, config.tenant.slug)
        } catch {
            // Unvalidated caller-supplied origin — fall through to the
            // server-provided (validated) URL below.
        }
    }

    return config.publicRssUrl
}

/** Browser-safe tenant-wide public podcast feed URL. */
export function publicPodcastFeedUrl(originHost: string, tenantSlug: string): string {
    return tenantPodcastFeed(normalizeOrigin(originHost), tenantSlug)
}
