import {isAllowedFeedUrl} from '../validation/primitives'

export function publicSiteOrigin(publicSiteUrl: string | null): string | null {
    if (publicSiteUrl != null && publicSiteUrl.trim().length > 0) {
        const candidate = publicSiteUrl.trim().replace(/\/+$/, '')
        return isAllowedFeedUrl(candidate) ? candidate : null
    }
    return null
}

export function publicEpisodePageUrl(
    publicSiteUrl: string | null,
    episodeSlug: string,
): string | null {
    const origin = publicSiteOrigin(publicSiteUrl)
    if (origin === null || episodeSlug.trim().length === 0) {
        return null
    }

    return `${origin}/episodes/${encodeURIComponent(episodeSlug.trim())}`
}

export function publicArticlePageUrl(
    publicSiteUrl: string | null,
    articleSlug: string,
): string | null {
    const origin = publicSiteOrigin(publicSiteUrl)
    if (origin === null || articleSlug.trim().length === 0) {
        return null
    }

    return `${origin}/articles/${encodeURIComponent(articleSlug.trim())}`
}
