import 'server-only'

import {directwerkFetch} from '@/lib/server/api'
import {createPublicContentParsers} from '@directwerk/api/validation'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'

// Same sanitization policy as the client-side parsers (shared structural
// guards + web's HTML sanitizer).
const {
    parsePublicArticleEnvelope,
    parsePublicArticleListEnvelope,
    parsePublicEpisodeListEnvelope,
} = createPublicContentParsers({sanitizeHtml: sanitizeContentHtml})
import type {PublicArticle, PublicEpisode} from '@directwerk/api/types'

/**
 * Fetches a single public article server-side. Returns `null` when the
 * backend answers 404 (unknown slug); throws for other failures so the route
 * can render its error boundary.
 */
export async function fetchPublicArticleServer(
    host: string,
    slug: string,
): Promise<PublicArticle | null> {
    const response = await directwerkFetch({
        path: `/api/v1/public/articles/${encodeURIComponent(slug)}`,
        tenantHost: host,
        method: 'GET',
    })

    if (response.status === 404) {
        return null
    }
    if (!response.ok) {
        throw new Error(
            `public article request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const parsed = parsePublicArticleEnvelope(await response.json())
    if (parsed === null) {
        throw new Error(`public article response invalid for host ${host}`)
    }

    return parsed.data
}

/**
 * Fetches a single public episode by slug from the public catalog.
 * Returns `null` when the slug is not part of the public catalog (unknown or
 * paid/unpublished); throws for transport/validation failures.
 */
export async function fetchPublicEpisodeServer(
    host: string,
    slug: string,
): Promise<PublicEpisode | null> {
    const response = await directwerkFetch({
        path: '/api/v1/public/episodes',
        tenantHost: host,
        method: 'GET',
    })

    if (!response.ok) {
        throw new Error(
            `public episodes request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const parsed = parsePublicEpisodeListEnvelope(await response.json())
    if (parsed === null) {
        throw new Error(`public episodes response invalid for host ${host}`)
    }

    return parsed.data.find((item) => item.slug === slug) ?? null
}

/**
 * Lists public article slugs and titles for sitemap generation. Returns an
 * empty list on failure — a sitemap must degrade gracefully.
 */
export async function fetchPublicArticleSlugsServer(
    host: string,
): Promise<{slug: string; publishedAt: string | null}[]> {
    const response = await directwerkFetch({
        path: '/api/v1/public/articles',
        tenantHost: host,
        method: 'GET',
    })
    if (!response.ok) {
        return []
    }

    const value: unknown = await response.json()
    const parsed = parsePublicArticleListEnvelope(value)
    if (parsed === null) {
        return []
    }

    return parsed.data.map((article) => ({
        slug: article.slug,
        publishedAt: article.publishedAt,
    }))
}
