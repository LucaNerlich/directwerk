/**
 * Returns the public site origin derived from a Directwerk feed URL.
 */
export function publicSiteOrigin(publicRssUrl: string | null): string | null {
    if (publicRssUrl === null || publicRssUrl.trim().length === 0) {
        return null
    }

    try {
        return new URL(publicRssUrl).origin
    } catch {
        return null
    }
}

/**
 * Builds the public episode page URL on directwerk-web.
 */
export function publicEpisodePageUrl(
    publicRssUrl: string | null,
    episodeSlug: string,
): string | null {
    const origin = publicSiteOrigin(publicRssUrl)
    if (origin === null || episodeSlug.trim().length === 0) {
        return null
    }

    return `${origin}/episodes/${encodeURIComponent(episodeSlug.trim())}`
}
