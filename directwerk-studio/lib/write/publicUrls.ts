import {publicSiteOrigin} from '@/lib/podcast/publicUrls'

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
