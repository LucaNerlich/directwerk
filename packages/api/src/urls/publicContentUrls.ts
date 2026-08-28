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

export function publicArticlePageUrl(
    publicRssUrl: string | null,
    articleSlug: string,
): string | null {
    const origin = publicSiteOrigin(publicRssUrl)
    if (origin === null || articleSlug.trim().length === 0) {
        return null
    }

    return `${origin}/articles/${encodeURIComponent(articleSlug.trim())}`
}
