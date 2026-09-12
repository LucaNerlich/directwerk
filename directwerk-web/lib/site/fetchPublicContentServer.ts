import 'server-only'

import {directwerkFetch} from '@/lib/server/api'
import {createWebPublicParsers} from '@/lib/publicContent/parsers'
import {
    parsePublicNewsletterListEnvelope,
    parsePublicNewsletterListListEnvelope,
    parsePublicProductListEnvelope,
} from '@directwerk/api/validation/public'
import type {
    PublicArticle,
    PublicEpisode,
    PublicNewsletterList,
    PublicProduct,
} from '@directwerk/api/types'

const {
    parsePublicArticleEnvelope,
    parsePublicArticleListEnvelope,
    parsePublicEpisodeListEnvelope,
} = createWebPublicParsers()

/**
 * Lists the public episode catalog for server-rendered pages. Returns `null`
 * when the upstream call fails so the caller can fall back to a client fetch
 * instead of rendering a false empty state.
 */
export async function fetchPublicEpisodesServer(
    host: string,
): Promise<PublicEpisode[] | null> {
    try {
        const response = await directwerkFetch({
            path: '/api/v1/public/episodes',
            tenantHost: host,
            method: 'GET',
        })
        if (!response.ok) {
            return null
        }
        const parsed = parsePublicEpisodeListEnvelope(await response.json())
        return parsed === null ? null : parsed.data
    } catch {
        return null
    }
}

/**
 * Lists the public article catalog for server-rendered pages. Returns `null`
 * on upstream failure (see {@link fetchPublicEpisodesServer}).
 */
export async function fetchPublicArticlesServer(
    host: string,
): Promise<PublicArticle[] | null> {
    try {
        const response = await directwerkFetch({
            path: '/api/v1/public/articles',
            tenantHost: host,
            method: 'GET',
        })
        if (!response.ok) {
            return null
        }
        const parsed = parsePublicArticleListEnvelope(await response.json())
        return parsed === null ? null : parsed.data
    } catch {
        return null
    }
}

/**
 * Lists published subscription products for server-rendered pages. Returns
 * `null` on upstream failure (see {@link fetchPublicEpisodesServer}).
 */
export async function fetchPublicProductsServer(
    host: string,
): Promise<PublicProduct[] | null> {
    try {
        const response = await directwerkFetch({
            path: '/api/v1/public/products',
            tenantHost: host,
            method: 'GET',
        })
        if (!response.ok) {
            return null
        }
        const parsed = parsePublicProductListEnvelope(await response.json())
        return parsed === null ? null : parsed.data
    } catch {
        return null
    }
}

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

/**
 * Lists public episode slugs for sitemap generation. Returns an empty list on
 * failure — a sitemap must degrade gracefully.
 */
export async function fetchPublicEpisodeSlugsServer(
    host: string,
): Promise<{slug: string; publishedAt: string | null}[]> {
    const response = await directwerkFetch({
        path: '/api/v1/public/episodes',
        tenantHost: host,
        method: 'GET',
    })
    if (!response.ok) {
        return []
    }

    const value: unknown = await response.json()
    const parsed = parsePublicEpisodeListEnvelope(value)
    if (parsed === null) {
        return []
    }

    return parsed.data.map((episode) => ({
        slug: episode.slug,
        publishedAt: episode.publishedAt,
    }))
}

/**
 * Fetches a single public newsletter list by slug. Returns `null` only when the
 * list is missing/archived. Other failures (including undeployed routes) throw
 * so the client can fall back to the share-link subscribe form.
 */
export async function fetchPublicNewsletterListServer(
    host: string,
    slug: string,
): Promise<PublicNewsletterList | null> {
    const response = await directwerkFetch({
        path: `/api/v1/public/newsletter-lists/${encodeURIComponent(slug)}`,
        tenantHost: host,
        method: 'GET',
    })

    if (response.status === 404) {
        const body: unknown = await response.json().catch(() => null)
        const code =
            typeof body === 'object' &&
            body !== null &&
            'errors' in body &&
            Array.isArray((body as {errors: unknown}).errors) &&
            (body as {errors: Array<{code?: string}>}).errors[0]?.code
        if (code === 'NEWSLETTER_LIST_NOT_FOUND') {
            return null
        }
        throw new Error(
            `public newsletter list request failed (HTTP ${response.status}) for host ${host}`,
        )
    }
    if (!response.ok) {
        throw new Error(
            `public newsletter list request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const parsed = parsePublicNewsletterListEnvelope(await response.json())
    if (parsed === null) {
        throw new Error(`public newsletter list response invalid for host ${host}`)
    }

    return parsed.data
}

/**
 * Lists active public newsletter lists. Throws on upstream failure so the page
 * can fall back to a client fetch instead of showing a false empty catalog.
 */
export async function fetchPublicNewsletterListsServer(
    host: string,
): Promise<PublicNewsletterList[]> {
    const response = await directwerkFetch({
        path: '/api/v1/public/newsletter-lists',
        tenantHost: host,
        method: 'GET',
    })
    if (!response.ok) {
        throw new Error(
            `public newsletter lists request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const parsed = parsePublicNewsletterListListEnvelope(await response.json())
    if (parsed === null) {
        throw new Error(`public newsletter lists response invalid for host ${host}`)
    }

    return parsed.data
}
