export function publicSiteOrigin(
    publicSiteUrl: string | null,
    legacyPublicRssUrl: string | null = null,
): string | null {
    if (publicSiteUrl != null && publicSiteUrl.trim().length > 0) {
        return publicSiteUrl.replace(/\/$/, '')
    }
    if (legacyPublicRssUrl === null || legacyPublicRssUrl.trim().length === 0) {
        return null
    }

    try {
        return new URL(legacyPublicRssUrl).origin
    } catch {
        return null
    }
}

export function publicEpisodePageUrl(
    publicSiteUrl: string | null,
    episodeSlug: string,
    legacyPublicRssUrl: string | null = null,
): string | null {
    const origin = publicSiteOrigin(publicSiteUrl, legacyPublicRssUrl)
    if (origin === null || episodeSlug.trim().length === 0) {
        return null
    }

    return `${origin}/episodes/${encodeURIComponent(episodeSlug.trim())}`
}

export function publicArticlePageUrl(
    publicSiteUrl: string | null,
    articleSlug: string,
    legacyPublicRssUrl: string | null = null,
): string | null {
    const origin = publicSiteOrigin(publicSiteUrl, legacyPublicRssUrl)
    if (origin === null || articleSlug.trim().length === 0) {
        return null
    }

    return `${origin}/articles/${encodeURIComponent(articleSlug.trim())}`
}
