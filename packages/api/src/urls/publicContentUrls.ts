import {isAllowedFeedUrl} from '../validation/primitives'

/**
 * Default public UI locale — keep in sync with Java `PublicContentPaths.DEFAULT_LOCALE`
 * and `@directwerk/ui` `defaultLocale` (`de`).
 */
export const DEFAULT_PUBLIC_LOCALE = 'de' as const

export function publicSiteOrigin(publicSiteUrl: string | null): string | null {
    if (publicSiteUrl != null && publicSiteUrl.trim().length > 0) {
        const candidate = publicSiteUrl.trim().replace(/\/+$/, '')
        return isAllowedFeedUrl(candidate) ? candidate : null
    }
    return null
}

function localizedPublicPath(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${DEFAULT_PUBLIC_LOCALE}${normalized}`
}

export function publicEpisodePageUrl(
    publicSiteUrl: string | null,
    episodeSlug: string,
): string | null {
    const origin = publicSiteOrigin(publicSiteUrl)
    if (origin === null || episodeSlug.trim().length === 0) {
        return null
    }

    return `${origin}${localizedPublicPath(`/episodes/${encodeURIComponent(episodeSlug.trim())}`)}`
}

export function publicArticlePageUrl(
    publicSiteUrl: string | null,
    articleSlug: string,
): string | null {
    const origin = publicSiteOrigin(publicSiteUrl)
    if (origin === null || articleSlug.trim().length === 0) {
        return null
    }

    return `${origin}${localizedPublicPath(`/articles/${encodeURIComponent(articleSlug.trim())}`)}`
}

export function publicNewsletterSubscribeUrl(
    publicSiteUrl: string | null,
    listSlug: string,
): string | null {
    const origin = publicSiteOrigin(publicSiteUrl)
    if (origin === null || listSlug.trim().length === 0) {
        return null
    }

    return `${origin}${localizedPublicPath(`/newsletter/${encodeURIComponent(listSlug.trim())}`)}`
}
