import type {PublicArticle, PublicEpisode} from '@directwerk/api/types'

const JSON_LD_ESCAPE: Record<string, string> = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
}

/** Serializes JSON safely for insertion into an inline script-data context. */
export function serializeJsonLd(value: unknown): string {
    return JSON.stringify(value).replace(
        /[<>&\u2028\u2029]/g,
        (character) => JSON_LD_ESCAPE[character] as string,
    )
}

function plainText(html: string | null, maxLength: number): string | undefined {
    if (html === null || html.length === 0) {
        return undefined
    }
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
    return text.length > 0 ? text : undefined
}

function durationIso8601(totalSeconds: number | null): string | undefined {
    if (totalSeconds === null || totalSeconds <= 0) {
        return undefined
    }
    return `PT${Math.floor(totalSeconds)}S`
}

/** `WebSite` entity rendered once from the root layout (covers home + all pages). */
export function buildWebsiteJsonLd(input: {
    name: string
    origin: string
}): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: input.name,
        url: `${input.origin}/`,
        inLanguage: 'de',
    }
}

/** `PodcastEpisode` entity for episode detail pages. */
export function buildPodcastEpisodeJsonLd(input: {
    episode: PublicEpisode
    origin: string
}): Record<string, unknown> {
    const url = `${input.origin}/episodes/${encodeURIComponent(input.episode.slug)}`
    return {
        '@context': 'https://schema.org',
        '@type': 'PodcastEpisode',
        name: input.episode.title,
        url,
        description: plainText(input.episode.description, 500),
        datePublished: input.episode.publishedAt ?? undefined,
        duration: durationIso8601(input.episode.durationSeconds),
        partOfSeries: {
            '@type': 'PodcastSeries',
            name: input.episode.seriesSlug,
            url: `${input.origin}/episodes`,
        },
    }
}

/** `Article` entity for article detail pages. */
export function buildArticleJsonLd(input: {
    article: PublicArticle
    origin: string
}): Record<string, unknown> {
    const url = `${input.origin}/articles/${encodeURIComponent(input.article.slug)}`
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.article.title,
        url,
        description:
            input.article.seoDescription ??
            input.article.excerpt ??
            plainText(input.article.body, 500),
        datePublished: input.article.publishedAt ?? undefined,
    }
}
